/**
 * Safe Operations Extension — Protects against dangerous git/gh and rm commands.
 *
 * Git/gh: Prompts for confirmation on push, commit, rebase, merge, hard reset, etc.
 * rm:     Replaces rm with macOS `trash` command, logs to debug file.
 *
 * Configuration (~/.pi/agent/settings.json):
 * {
 *   "safeOps": {
 *     "gitPromptLevel": "medium",   // "high", "medium", or "none"
 *     "gitEnabled": true,
 *     "rmEnabled": true
 *   }
 * }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
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
} from "../shared/index.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { confirmDialog } from "pi-dialog/dialog/confirm-dialog.ts";

// ============================================================================
// Types
// ============================================================================

type PromptLevel = "high" | "medium" | "none";
type Severity = "high" | "medium";

interface SafeOpsConfig {
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
// Rm Detection
// ============================================================================

function isRmCommand(command: string): boolean {
  return /^(?:\/[\w\/]+\/)?rm\b/.test(command.trim());
}

function parseRmCommand(command: string): { files: string[] } {
  const withoutRm = command.trim().replace(/^(?:\/[\w\/]+\/)?rm\b\s*/, "");
  const parts = withoutRm.split(/\s+/).filter(p => p.length > 0);
  return { files: parts.filter(p => !p.startsWith("-")) };
}

function buildTrashCommand(files: string[]): string {
  const isMacOS = os.platform() === "darwin";
  if (isMacOS) {
    const quoted = files.map(f => `'${f.replace(/'/g, "'\\''")}'`);
    return `trash ${quoted.join(" ")}`;
  }
  return `rm ${files.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(" ")}`;
}

function logRmToFile(logPath: string, originalCmd: string) {
  const entry = `[${new Date().toISOString()}] | ${originalCmd} → trash\n`;
  try {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, entry, "utf-8");
  } catch {}
}

// ============================================================================
// Main Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  // Session state
  let gitEnabledOverride: boolean | null = null;
  let gitLevelOverride: PromptLevel | null = null;
  let rmEnabledOverride: boolean | null = null;
  let gitApproved: Set<string> = new Set();
  let gitBlocked: Set<string> = new Set();
  let terminalInfo: TerminalInfo = {};
  let notifyConfig: BackgroundNotifyConfig | null = null;

  function getConfig(ctx: ExtensionContext): Required<SafeOpsConfig> {
    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    return { ...DEFAULT_CONFIG, ...(settings.safeOps ?? {}) };
  }

  function effectiveGitEnabled(cfg: Required<SafeOpsConfig>): boolean {
    return gitEnabledOverride ?? cfg.gitEnabled;
  }

  function effectiveGitLevel(cfg: Required<SafeOpsConfig>): PromptLevel {
    return gitLevelOverride ?? cfg.gitPromptLevel;
  }

  function effectiveRmEnabled(cfg: Required<SafeOpsConfig>): boolean {
    return rmEnabledOverride ?? cfg.rmEnabled;
  }

  function shouldPrompt(severity: Severity, level: PromptLevel): boolean {
    if (level === "none") return false;
    if (level === "high") return severity === "high";
    return true;
  }

  // ==========================================================================
  // Git/gh Commands
  // ==========================================================================

  pi.registerCommand("safegit", {
    description: "Toggle safe-git protection on/off for this session",
    handler: async (_args, ctx) => {
      gitEnabledOverride = !effectiveGitEnabled(getConfig(ctx));
      ctx.ui.notify(gitEnabledOverride ? "🔒 Safe-git protection ON" : "🔓 Safe-git protection OFF", "info");
    },
  });

  pi.registerCommand("safegit-level", {
    description: "Set safe-git prompt level (high, medium, none)",
    handler: async (args, ctx) => {
      const level = args?.trim().toLowerCase() as PromptLevel;
      if (!["high", "medium", "none"].includes(level)) {
        ctx.ui.notify("Usage: /safegit-level high|medium|none", "warning");
        return;
      }
      gitLevelOverride = level;
      ctx.ui.notify(`Safe-git level: ${level}`, "info");
    },
  });

  pi.registerCommand("safegit-status", {
    description: "Show safe-git protection status",
    handler: async (_args, ctx) => {
      const cfg = getConfig(ctx);
      const lines = [
        "─── Safe Git ───",
        `Git: ${effectiveGitEnabled(cfg) ? "🟢 ON" : "🔴 OFF"}`,
        `Level: ${effectiveGitLevel(cfg)}`,
        `Approved: ${gitApproved.size > 0 ? [...gitApproved].join(", ") : "none"}`,
        `Blocked: ${gitBlocked.size > 0 ? [...gitBlocked].join(", ") : "none"}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ==========================================================================
  // Rm Commands
  // ==========================================================================

  pi.registerCommand("saferm", {
    description: "Toggle safe-rm on/off for this session",
    handler: async (_args, ctx) => {
      rmEnabledOverride = !effectiveRmEnabled(getConfig(ctx));
      ctx.ui.notify(rmEnabledOverride ? "🟢 Safe-RM: ON" : "🔴 Safe-RM: OFF", "info");
    },
  });

  pi.registerCommand("saferm-toggle", {
    description: "Toggle safe-rm on/off",
    handler: async (_args, ctx) => {
      rmEnabledOverride = !effectiveRmEnabled(getConfig(ctx));
      ctx.ui.notify(rmEnabledOverride ? "🟢 Safe-RM: ON" : "🔴 Safe-RM: OFF", "info");
    },
  });

  pi.registerCommand("saferm-on", {
    description: "Enable safe-rm",
    handler: async (_args, ctx) => {
      rmEnabledOverride = true;
      ctx.ui.notify("🟢 Safe-RM: ON", "info");
    },
  });

  pi.registerCommand("saferm-off", {
    description: "Disable safe-rm",
    handler: async (_args, ctx) => {
      rmEnabledOverride = false;
      ctx.ui.notify("🔴 Safe-RM: OFF", "info");
    },
  });

  pi.registerCommand("saferm-log", {
    description: "Show safe-rm debug log",
    handler: async (_args, ctx) => {
      const logPath = getConfig(ctx).rmDebugLogPath;
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
      const logPath = getConfig(ctx).rmDebugLogPath;
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

  // ==========================================================================
  // Tool Call Interception
  // ==========================================================================

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    const command: string = event.input.command;
    const cfg = getConfig(ctx);

    // 1. Check rm first (replacement, not confirmation)
    if (effectiveRmEnabled(cfg) && isRmCommand(command)) {
      const { files } = parseRmCommand(command);
      if (files.length > 0) {
        const trashCmd = buildTrashCommand(files);
        logRmToFile(cfg.rmDebugLogPath, command);
        return { command: trashCmd, reason: "safe-ops: rm → trash" };
      }
    }

    // 2. Check git/gh patterns (confirmation)
    if (!effectiveGitEnabled(cfg)) return undefined;

    for (const { pattern, action, severity } of GIT_PATTERNS) {
      if (!pattern.test(command)) continue;

      const level = effectiveGitLevel(cfg);
      if (!shouldPrompt(severity, level)) continue;

      // Auto-approved?
      if (gitApproved.has(action)) return undefined;

      // Auto-blocked?
      if (gitBlocked.has(action)) {
        return { block: true, reason: `Git ${action} auto-blocked for this session` };
      }

      // Prompt user
      if (!ctx.hasUI) {
        ctx.ui.notify(`⛔ Blocking git ${action} in non-interactive mode`, "warning");
        return { block: true, reason: `Safe-git: ${action} requires interactive approval` };
      }

      // Send notifications
      try {
        if (notifyConfig?.beep) playBeep(terminalInfo, notifyConfig);
      } catch {}
      try {
        if (notifyConfig?.bringToFront) bringTerminalToFront(terminalInfo);
      } catch {}
      try {
        if (notifyConfig?.say) {
          const msg = (notifyConfig.sayMessage || "Confirmation required").replace("{session dir}", process.cwd().split("/").pop() || "");
          speakMessage(msg);
        }
      } catch {}
      try {
        if (terminalInfo.terminalNotifierAvailable) displayOSXNotification("pi-safe-ops", `Git ${action} needs approval`);
      } catch {}
      try {
        await notifyOnConfirm(ctx, command, `Git ${action}`);
      } catch {}

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
          gitBlocked.add(action);
          ctx.ui.notify(`Git ${action} blocked for this session`, "warning");
        } else {
          ctx.ui.notify(`Git ${action} canceled`, "info");
        }
        return { block: true, reason: `Git ${action} blocked by user` };
      }

      if (choice === "Allow this session") {
        gitApproved.add(action);
        ctx.ui.notify(`Git ${action} approved for this session`, "info");
      } else {
        ctx.ui.notify(`Git ${action} approved once`, "info");
      }

      return undefined;
    }

    return undefined;
  });

  // ==========================================================================
  // Session Lifecycle
  // ==========================================================================

  pi.on("session_start", async (_event, ctx) => {
    gitEnabledOverride = null;
    gitLevelOverride = null;
    rmEnabledOverride = null;
    gitApproved.clear();
    gitBlocked.clear();

    terminalInfo = await detectTerminalInfo();
    await checkSayAvailable();
    await checkTerminalNotifierAvailable();
    await loadPronunciations();
    notifyConfig = await getBackgroundNotifyConfig(ctx);

    if (ctx.hasUI) {
      const cfg = getConfig(ctx);
      const parts: string[] = ["🛡️ Safe-Ops:"];
      if (effectiveGitEnabled(cfg)) parts.push(`Git:${effectiveGitLevel(cfg)}`);
      if (effectiveRmEnabled(cfg)) parts.push("RM:on");
      ctx.ui.notify(parts.join(" "), "info");
    }
  });
}
