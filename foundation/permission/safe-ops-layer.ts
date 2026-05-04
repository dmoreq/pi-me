/**
 * Safe Ops Layer — Second layer of the 3-layer permission guard.
 *
 * Layer 1: Safety patterns (always-active hard safety net)
 * Layer 2: Permission tiers (configurable level-based blocking)
 * Layer 3: Safe Ops (git/gh protection + rm→trash replacement)
 *
 * Extracted from foundation/safe-ops.ts and integrated into the permission
 * extension as the third layer. All commands (interactive + print mode)
 * are preserved:
 *   /safegit, /safegit-level, /safegit-status
 *   /saferm, /saferm-toggle, /saferm-on, /saferm-off, /saferm-log, /saferm-clearlog
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { registerToggleCommand, registerStatusCommand } from "../../shared/command-builder.ts";
import {
  getBackgroundNotifyConfig,
  type TerminalInfo,
  type BackgroundNotifyConfig,
  detectTerminalInfo,
  checkSayAvailable,
  loadPronunciations,
  checkTerminalNotifierAvailable,
  notifyOnConfirm,
  bringTerminalToFront,
  playBeep,
  displayOSXNotification,
  speakMessage,
} from "../../shared/index.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { confirmDialog } from "pi-dialog/dialog/confirm-dialog.ts";

// ============================================================================
// Types
// ============================================================================

type PromptLevel = "high" | "medium" | "none";
type Severity = "high" | "medium";

export interface SafeOpsConfig {
  gitPromptLevel?: PromptLevel;
  gitEnabled?: boolean;
  rmEnabled?: boolean;
  rmDebugLogPath?: string;
}

const DEFAULT_CONFIG: Required<SafeOpsConfig> = {
  gitPromptLevel: "medium",
  gitEnabled: true,
  rmEnabled: true,
  rmDebugLogPath: path.join(os.homedir(), ".pi", "safe-ops-rm.log"),
};

// ============================================================================
// Git/gh Patterns
// ============================================================================

const GIT_PATTERNS: { pattern: RegExp; action: string; severity: Severity }[] = [
  { pattern: /\bgit\s+push\s+.*--force(-with-lease)?\b/i, action: "force push", severity: "high" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, action: "hard reset", severity: "high" },
  { pattern: /\bgit\s+clean\s+-[a-z]*f/i, action: "clean (remove untracked files)", severity: "high" },
  { pattern: /\bgit\s+stash\s+(drop|clear)\b/i, action: "drop/clear stash", severity: "high" },
  { pattern: /\bgit\s+branch\s+-[dD]\b/i, action: "delete branch", severity: "high" },
  { pattern: /\bgit\s+reflog\s+expire\b/i, action: "expire reflog", severity: "high" },
  { pattern: /\bgit\s+push\b/i, action: "push", severity: "medium" },
  { pattern: /\bgit\s+commit\b/i, action: "commit", severity: "medium" },
  { pattern: /\bgit\s+rebase\b/i, action: "rebase", severity: "medium" },
  { pattern: /\bgit\s+merge\b/i, action: "merge", severity: "medium" },
  { pattern: /\bgit\s+tag\b/i, action: "create/modify tag", severity: "medium" },
  { pattern: /\bgit\s+cherry-pick\b/i, action: "cherry-pick", severity: "medium" },
  { pattern: /\bgit\s+revert\b/i, action: "revert", severity: "medium" },
  { pattern: /\bgit\s+am\b/i, action: "apply patches", severity: "medium" },
  { pattern: /\bgh\s+\S+/i, action: "GitHub CLI", severity: "medium" },
];

const SEVERITY_ICONS: Record<Severity, string> = { high: "🔴", medium: "🟡" };

// ============================================================================
// SafeOpsLayer class
// ============================================================================

export class SafeOpsLayer {
  private gitEnabledOverride: boolean | null = null;
  private gitLevelOverride: PromptLevel | null = null;
  private rmEnabledOverride: boolean | null = null;
  private gitApproved = new Set<string>();
  private gitBlocked = new Set<string>();
  private terminalInfo: TerminalInfo = {};
  private notifyConfig: BackgroundNotifyConfig | null = null;

  async init(ctx: ExtensionContext): Promise<void> {
    this.terminalInfo = await detectTerminalInfo();
    await checkSayAvailable();
    await checkTerminalNotifierAvailable();
    await loadPronunciations();
    this.notifyConfig = await getBackgroundNotifyConfig(ctx);
  }

  reset(): void {
    this.gitEnabledOverride = null;
    this.gitLevelOverride = null;
    this.rmEnabledOverride = null;
    this.gitApproved.clear();
    this.gitBlocked.clear();
  }

  // ── Config access ──────────────────────────────────────────────────

  /** @internal exposed for the permission extension to show status */
  getConfig(ctx: ExtensionContext): Required<SafeOpsConfig> {
    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    return { ...DEFAULT_CONFIG, ...(settings.safeOps ?? {}) };
  }

  private effectiveGitEnabled(cfg: Required<SafeOpsConfig>): boolean {
    return this.gitEnabledOverride ?? cfg.gitEnabled;
  }

  private effectiveGitLevel(cfg: Required<SafeOpsConfig>): PromptLevel {
    return this.gitLevelOverride ?? cfg.gitPromptLevel;
  }

  private effectiveRmEnabled(cfg: Required<SafeOpsConfig>): boolean {
    return this.rmEnabledOverride ?? cfg.rmEnabled;
  }

  private shouldPrompt(severity: Severity, level: PromptLevel): boolean {
    if (level === "none") return false;
    if (level === "high") return severity === "high";
    return true;
  }

  getStatus(cfg: Required<SafeOpsConfig>): string[] {
    const parts: string[] = [];
    if (this.effectiveGitEnabled(cfg)) parts.push(`Git:${this.effectiveGitLevel(cfg)}`);
    if (this.effectiveRmEnabled(cfg)) parts.push("RM:on");
    return parts;
  }

  // ── Rm detection ──────────────────────────────────────────────────

  private isRmCommand(command: string): boolean {
    return /^(?:\/[\w\/]+\/)?rm\b/.test(command.trim());
  }

  private parseRmCommand(command: string): { files: string[] } {
    const withoutRm = command.trim().replace(/^(?:\/[\w\/]+\/)?rm\b\s*/, "");
    const parts = withoutRm.split(/\s+/).filter(p => p.length > 0);
    return { files: parts.filter(p => !p.startsWith("-")) };
  }

  private buildTrashCommand(files: string[]): string {
    const isMacOS = os.platform() === "darwin";
    if (isMacOS) {
      const quoted = files.map(f => `'${f.replace(/'/g, "'\\''")}'`);
      return `trash ${quoted.join(" ")}`;
    }
    return `rm ${files.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(" ")}`;
  }

  private logRmToFile(logPath: string, originalCmd: string) {
    const entry = `[${new Date().toISOString()}] | ${originalCmd} → trash\n`;
    try {
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(logPath, entry, "utf-8");
    } catch {}
  }

  // ── Main interception ─────────────────────────────────────────────

  /**
   * Intercept a bash tool_call. Returns a modification or block action,
   * or undefined to let the command proceed unmodified.
   */
  async intercept(command: string, ctx: ExtensionContext): Promise<
    { command?: string; reason?: string; block?: boolean } | undefined
  > {
    const cfg = this.getConfig(ctx);

    // 1. Check rm first (replacement, not confirmation)
    if (this.effectiveRmEnabled(cfg) && this.isRmCommand(command)) {
      const { files } = this.parseRmCommand(command);
      if (files.length > 0) {
        const trashCmd = this.buildTrashCommand(files);
        this.logRmToFile(cfg.rmDebugLogPath, command);
        return { command: trashCmd, reason: "safe-ops: rm → trash" };
      }
    }

    // 2. Check git/gh patterns (confirmation)
    if (!this.effectiveGitEnabled(cfg)) return undefined;

    for (const { pattern, action, severity } of GIT_PATTERNS) {
      if (!pattern.test(command)) continue;

      const level = this.effectiveGitLevel(cfg);
      if (!this.shouldPrompt(severity, level)) continue;

      // Auto-approved?
      if (this.gitApproved.has(action)) return undefined;

      // Auto-blocked?
      if (this.gitBlocked.has(action)) {
        return { block: true, reason: `Git ${action} auto-blocked for this session` };
      }

      // Prompt user
      if (!ctx.hasUI) {
        ctx.ui.notify(`⛔ Blocking git ${action} in non-interactive mode`, "warning");
        return { block: true, reason: `Safe-git: ${action} requires interactive approval` };
      }

      // Send notifications
      await this.sendNotifications(ctx);
      await notifyOnConfirm(ctx, command, `Git ${action}`);

      const icon = SEVERITY_ICONS[severity];
      const blockLabel = severity === "high" ? "Block" : "Block this session";
      const choice = await confirmDialog(
        ctx,
        `${icon} Allow git ${action}?\n  ${command.slice(0, 80)}`,
        [
          { label: "Allow once",         description: "Run this command, ask again next time" },
          { label: "Allow this session",  description: `Approve all "${action}" commands until session ends` },
          { label: blockLabel,            description: "Skip this command" },
        ],
        "Safe Git",
      );

      if (!choice || choice === "Block" || choice === "Block this session") {
        if (choice === "Block this session") {
          this.gitBlocked.add(action);
          ctx.ui.notify(`Git ${action} blocked for this session`, "warning");
        } else {
          ctx.ui.notify(`Git ${action} canceled`, "info");
        }
        return { block: true, reason: `Git ${action} blocked by user` };
      }

      if (choice === "Allow this session") {
        this.gitApproved.add(action);
        ctx.ui.notify(`Git ${action} approved for this session`, "info");
      } else {
        ctx.ui.notify(`Git ${action} approved once`, "info");
      }

      return undefined;
    }

    return undefined;
  }

  // ── Notifications ─────────────────────────────────────────────────

  private async sendNotifications(ctx: ExtensionContext) {
    try {
      if (this.notifyConfig?.beep) playBeep(this.terminalInfo, this.notifyConfig);
    } catch {}
    try {
      if (this.notifyConfig?.bringToFront) bringTerminalToFront(this.terminalInfo);
    } catch {}
    try {
      if (this.notifyConfig?.say) {
        const msg = (this.notifyConfig.sayMessage || "Confirmation required")
          .replace("{session dir}", process.cwd().split("/").pop() || "");
        speakMessage(msg);
      }
    } catch {}
    try {
      if (this.terminalInfo.terminalNotifierAvailable) {
        displayOSXNotification("pi-safe-ops", "Git action needs approval");
      }
    } catch {}
  }

  // ── Commands ──────────────────────────────────────────────────────

  registerCommands(pi: ExtensionAPI): void {
    // Use CommandBuilder for consistent toggle commands
    registerToggleCommand(pi, {
      name: "safegit",
      description: "Toggle safe-git protection on/off for this session",
      getState: () => this.gitEnabledOverride ?? this.getConfig(undefined as any).gitEnabled,
      setState: (v) => { this.gitEnabledOverride = v; },
      onLabel: "🔒 Safe-git ON",
      offLabel: "🔓 Safe-git OFF",
    });

    registerToggleCommand(pi, {
      name: "saferm",
      description: "Toggle safe-rm on/off for this session",
      getState: () => this.rmEnabledOverride ?? this.getConfig(undefined as any).rmEnabled,
      setState: (v) => { this.rmEnabledOverride = v; },
      onLabel: "🟢 Safe-RM ON",
      offLabel: "🔴 Safe-RM OFF",
    });

    pi.registerCommand("safegit-level", {
      description: "Set safe-git prompt level (high, medium, none)",
      handler: async (args, ctx) => {
        const level = args?.trim().toLowerCase() as PromptLevel;
        if (!["high", "medium", "none"].includes(level)) {
          ctx.ui.notify("Usage: /safegit-level high|medium|none", "warning");
          return;
        }
        this.gitLevelOverride = level;
        ctx.ui.notify(`Safe-git level: ${level}`, "info");
      },
    });

    registerStatusCommand(pi, {
      name: "safegit",
      description: "Show safe-git protection status",
      getStatusLines: (ctx) => {
        const cfg = this.getConfig(ctx);
        return [
          "─── Safe Git ───",
          `Git: ${cfg.gitEnabled ? "🟢 ON" : "🔴 OFF"}`,
          `Level: ${this.effectiveGitLevel(cfg)}`,
          `Approved: ${this.gitApproved.size > 0 ? [...this.gitApproved].join(", ") : "none"}`,
          `Blocked: ${this.gitBlocked.size > 0 ? [...this.gitBlocked].join(", ") : "none"}`,
        ];
      },
    });

    pi.registerCommand("saferm-log", {
      description: "Show safe-rm debug log",
      handler: async (_args, ctx) => {
        const logPath = this.getConfig(ctx).rmDebugLogPath;
        try {
          if (!fs.existsSync(logPath)) {
            ctx.ui.notify("No debug log found yet.", "info");
            return;
          }
          const lines = fs.readFileSync(logPath, "utf-8").trim().split("\n").slice(-20);
          ctx.ui.notify(
            ["╭─ Safe-RM Log (last 20) ─╮", ...lines.map(l => `│ ${l.slice(0, 75)}`), "╰──────────────────────────╯", `Full log: ${logPath}`].join("\n"),
            "info",
          );
        } catch {
          ctx.ui.notify("Error reading log", "warning");
        }
      },
    });

    pi.registerCommand("saferm-clearlog", {
      description: "Clear safe-rm debug log",
      handler: async (_args, ctx) => {
        const logPath = this.getConfig(ctx).rmDebugLogPath;
        try {
          if (fs.existsSync(logPath)) {
            fs.unlinkSync(logPath);
            ctx.ui.notify("🗑️  Debug log cleared.", "info");
          } else {
            ctx.ui.notify("No debug log to clear.", "info");
          }
        } catch {
          ctx.ui.notify("Error clearing log", "warning");
        }
      },
    });
  }
}
