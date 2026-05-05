/**
 * Permission Extension for pi-coding-agent
 *
 * Implements layered permission control.
 *
 * Interactive mode:
 *   Use `/permission` command to view or change the level.
 *   Use `/permission-mode` to switch between ask vs block.
 *   When changing via command, you'll be asked: session-only or global?
 *
 * Print mode (pi -p):
 *   Set PI_PERMISSION_LEVEL env var: PI_PERMISSION_LEVEL=medium pi -p "task"
 *   Operations beyond level will exit with helpful error message.
 *   Use PI_PERMISSION_LEVEL=bypassed for CI/containers (dangerous!)
 *
 * Levels:
 *   minimal - Read-only mode (default)
 *             ✅ Read files, ls, grep, git status/log/diff
 *             ❌ No file modifications, no commands with side effects
 *
 *   low    - File operations only
 *            ✅ Create/edit files in project directory
 *            ❌ No package installs, no git commits, no builds
 *
 *   medium - Development operations
 *            ✅ npm/pip install, git commit/pull, make/build
 *            ❌ No git push, no sudo, no production changes
 *
 *   high   - Full operations
 *            ✅ git push, deployments, scripts
 *            ⚠️ Still prompts for destructive commands (rm -rf, etc.)
 *
 * Usage:
 *   pi --extension ./permission-hook.ts
 *
 * Or add to ~/.pi/agent/extensions/ or .pi/extensions/ for automatic loading.
 */

import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  type PermissionLevel,
  type PermissionMode,
  LEVELS,
  LEVEL_INDEX,
  LEVEL_INFO,
  LEVEL_ALLOWED_DESC,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
  loadGlobalPermission,
  saveGlobalPermission,
  loadGlobalPermissionMode,
  saveGlobalPermissionMode,
  classifyCommand,
  loadPermissionConfig,
  savePermissionConfig,
  invalidateConfigCache,
  type PermissionConfig,
} from "./permission-core.ts";
import { DEFAULT_SAFETY_PATTERNS, type SafetyPattern } from "./safety-patterns.ts";
import { DEFAULT_PROTECTED_PATHS, matchesGlob, type ProtectedGlob } from "./path-guard.ts";
import { confirmDialog } from "pi-dialog/dialog/confirm-dialog.ts";
import { SafeOpsLayer } from "./safe-ops-layer.ts";

// Re-export types and constants needed by the hook
export {
  type PermissionLevel,
  type PermissionMode,
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
};

// ============================================================================
// SOUND NOTIFICATION
// ============================================================================

function playPermissionSound(): void {
  const isMac = process.platform === "darwin";

  if (isMac) {
    exec('afplay /System/Library/Sounds/Funk.aiff 2>/dev/null', (err) => {
      if (err) process.stdout.write("\x07");
    });
  } else {
    process.stdout.write("\x07");
  }
}

// ============================================================================
// STATUS TEXT
// ============================================================================

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  minimal: RED,
  low: YELLOW,
  medium: CYAN,
  high: GREEN,
  bypassed: DIM,
};

function getStatusText(level: PermissionLevel): string {
  const info = LEVEL_INFO[level];
  return `🛡️  ${info.label} — ${info.desc}`;
}

// ============================================================================
// MODE DETECTION
// ============================================================================

function getPiModeFromArgv(argv: string[] = process.argv): string | undefined {
  // Support both: --mode rpc and --mode=rpc
  const eq = argv.find((a) => a.startsWith("--mode="));
  if (eq) return eq.slice("--mode=".length);

  const idx = argv.indexOf("--mode");
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];

  return undefined;
}

function hasInteractiveUI(ctx: any): boolean {
  if (!ctx?.hasUI) return false;

  // In non-interactive modes (rpc/json/print), UI prompts are not desired.
  // We still allow notifications, but block instead of asking.
  const mode = getPiModeFromArgv()?.toLowerCase();
  if (mode && mode !== "interactive") return false;

  return true;
}

function isQuietMode(ctx: any): boolean {
  if (ctx?.quiet || ctx?.isQuiet) return true;
  if (ctx?.ui?.quiet || ctx?.ui?.isQuiet) return true;
  if (ctx?.settings?.quietStartup || ctx?.settings?.quiet) return true;

  const envQuiet = process.env.PI_QUIET?.toLowerCase();
  if (envQuiet && ["1", "true", "yes"].includes(envQuiet)) return true;

  if (process.argv.includes("--quiet") || process.argv.includes("-q")) return true;

  return isQuietStartupFromSettings();
}

function isQuietStartupFromSettings(): boolean {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw) as { quietStartup?: boolean };
    return settings.quietStartup === true;
  } catch {
    return false;
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Auto-escalation tracking — suggest raising level when same command blocked 3+ times
const blockedCommandCounts = new Map<string, number>();
let lastEscalationNotify = 0;
const ESCALATION_COOLDOWN = 120_000;

export interface PermissionState {
  currentLevel: PermissionLevel;
  isSessionOnly: boolean;
  permissionMode: PermissionMode;
  isModeSessionOnly: boolean;
}

export function createInitialState(): PermissionState {
  return {
    currentLevel: "minimal",
    isSessionOnly: false,
    permissionMode: "ask",
    isModeSessionOnly: false,
  };
}

function setLevel(
  state: PermissionState,
  level: PermissionLevel,
  saveGlobally: boolean,
  ctx: any
): void {
  state.currentLevel = level;
  state.isSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermission(level);
  }
  if (ctx.ui?.setStatus) {
    ctx.ui.setStatus("authority", ctx.ui.theme.fg("dim", getStatusText(level)));
  }
}

function setMode(
  state: PermissionState,
  mode: PermissionMode,
  saveGlobally: boolean,
  ctx: any
): void {
  state.permissionMode = mode;
  state.isModeSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermissionMode(mode);
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

/** Handle /permission config subcommand */
async function handleConfigSubcommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (action === "show") {
    const config = loadPermissionConfig();
    const configStr = JSON.stringify(config, null, 2);
    ctx.ui.notify(`Permission Config:\n${configStr}`, "info");
    return;
  }

  if (action === "reset") {
    savePermissionConfig({});
    invalidateConfigCache();
    ctx.ui.notify("Permission config reset to defaults", "info");
    return;
  }

  // Show help
  const help = `Usage: /permission config <action>

Actions:
  show  - Display current configuration
  reset - Reset to default configuration

Edit ~/.pi/agent/settings.json directly for full control:

{
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux *", "screen *"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" }
    ]
  }
}`;

  ctx.ui.notify(help, "info");
}

/** Handle /permission command */
export async function handlePermissionCommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const arg = args.trim().toLowerCase();

  // Handle config subcommand
  if (arg === "config" || arg.startsWith("config ")) {
    const configArgs = arg.replace(/^config\s*/, '');
    await handleConfigSubcommand(state, configArgs, ctx);
    return;
  }

  // Direct level set: /permission medium
  if (arg && LEVELS.includes(arg as PermissionLevel)) {
    const newLevel = arg as PermissionLevel;

    if (hasInteractiveUI(ctx)) {
      const scope = await confirmDialog(ctx, `Set permission to ${LEVEL_INFO[newLevel].label}`, [
        { label: "Session only",     description: "Takes effect now, reverts when session ends" },
        { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
      ], "Scope");
      if (!scope) return;

      setLevel(state, newLevel, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
      ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
    } else {
      setLevel(state, newLevel, false, ctx);
      ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}`, "info");
    }
    return;
  }

  // Show current level (no UI)
  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission: ${LEVEL_INFO[state.currentLevel].label} (${LEVEL_INFO[state.currentLevel].desc})`,
      "info"
    );
    return;
  }

  // Show selector
  const levelChoice = await confirmDialog(
    ctx,
    "Select permission level",
    LEVELS.map((level) => ({
      label: LEVEL_INFO[level].label + (level === state.currentLevel ? " (current)" : ""),
      description: LEVEL_INFO[level].desc,
    })),
    "Permission",
  );
  if (!levelChoice) return;

  const chosenLabel = levelChoice.replace(" (current)", "").trim();
  const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === chosenLabel);
  if (!newLevel || newLevel === state.currentLevel) return;

  const scope = await confirmDialog(ctx, `Set permission to ${LEVEL_INFO[newLevel].label}`, [
    { label: "Session only",     description: "Takes effect now, reverts when session ends" },
    { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
  ], "Scope");
  if (!scope) return;

  setLevel(state, newLevel, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
}

/** Handle /permission-mode command */
export async function handlePermissionModeCommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const arg = args.trim().toLowerCase();

  if (arg && PERMISSION_MODES.includes(arg as PermissionMode)) {
    const newMode = arg as PermissionMode;

    if (hasInteractiveUI(ctx)) {
      const scope = await confirmDialog(ctx, `Set permission mode to ${PERMISSION_MODE_INFO[newMode].label}`, [
        { label: "Session only",     description: "Takes effect now, reverts when session ends" },
        { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
      ], "Scope");
      if (!scope) return;

      setMode(state, newMode, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
      ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
    } else {
      setMode(state, newMode, false, ctx);
      ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}`, "info");
    }
    return;
  }

  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission mode: ${PERMISSION_MODE_INFO[state.permissionMode].label} (${PERMISSION_MODE_INFO[state.permissionMode].desc})`,
      "info"
    );
    return;
  }

  const modeChoice = await confirmDialog(
    ctx,
    "Select permission mode",
    PERMISSION_MODES.map((mode) => ({
      label: PERMISSION_MODE_INFO[mode].label + (mode === state.permissionMode ? " (current)" : ""),
      description: PERMISSION_MODE_INFO[mode].desc,
    })),
    "Mode",
  );
  if (!modeChoice) return;

  const chosenLabel = modeChoice.replace(" (current)", "").trim();
  const newMode = PERMISSION_MODES.find((m) => PERMISSION_MODE_INFO[m].label === chosenLabel);
  if (!newMode || newMode === state.permissionMode) return;

  const scope = await confirmDialog(ctx, `Set permission mode to ${PERMISSION_MODE_INFO[newMode].label}`, [
    { label: "Session only",     description: "Takes effect now, reverts when session ends" },
    { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
  ], "Scope");
  if (!scope) return;

  setMode(state, newMode, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
}

/** Handle session_start - initialize level and show status */
export function handleSessionStart(state: PermissionState, ctx: any): void {
  // Check env var first (for print mode)
  const envLevel = process.env.PI_PERMISSION_LEVEL?.toLowerCase();
  if (envLevel && LEVELS.includes(envLevel as PermissionLevel)) {
    state.currentLevel = envLevel as PermissionLevel;
  } else {
    const globalLevel = loadGlobalPermission();
    if (globalLevel) {
      state.currentLevel = globalLevel;
    }
  }

  if (ctx.hasUI) {
    const globalMode = loadGlobalPermissionMode();
    if (globalMode) {
      state.permissionMode = globalMode;
    }
  }

  if (ctx.hasUI) {
    if (ctx.ui?.setStatus) {
      ctx.ui.setStatus("authority", ctx.ui.theme.fg("dim", getStatusText(state.currentLevel)));
    }
    if (state.currentLevel === "bypassed") {
      ctx.ui.notify("⚠️ Permission bypassed - all checks disabled!", "warning");
    } else if (!isQuietMode(ctx)) {
      ctx.ui.notify(`Permission: ${LEVEL_INFO[state.currentLevel].label} (use /permission to change)`, "info");
    }
    if (state.permissionMode === "block") {
      ctx.ui.notify("Permission mode: Block (use /permission-mode to change)", "info");
    }
  }
}

/** Check safety patterns against a command — always-active safety net */
function checkSafetyPatterns(
  command: string,
  patterns: SafetyPattern[]
): SafetyPattern[] {
  return patterns.filter((p) => p.pattern.test(command));
}

/** Handle bash tool_call - check permission and prompt if needed */
export async function handleBashToolCall(
  state: PermissionState,
  command: string,
  ctx: any
): Promise<{ block: true; reason: string } | undefined> {
  // ── Layer 1: Hard safety net — always check dangerous patterns (even bypassed) ──
  const safetyMatches = checkSafetyPatterns(command, DEFAULT_SAFETY_PATTERNS);
  if (safetyMatches.length > 0) {
    const categories = [...new Set(safetyMatches.map((m) => m.category))].join(", ");
    const matchDetails = safetyMatches
      .map((m) => `  [${m.category}] ${m.description}`)
      .join("\n");

    if (!hasInteractiveUI(ctx)) {
      return {
        block: true,
        reason: `Stopped by safety rules (${categories}).\nCommand: ${command}\nReasons:\n${matchDetails}`,
      };
    }

    if (state.permissionMode === "block") {
      return {
        block: true,
        reason: `Stopped by safety rules (${categories}). Command: ${command}\nUse /permission-mode ask to enable confirmations.`,
      };
    }

    playPermissionSound();
    const choice = await confirmDialog(
      ctx,
      `⚠️  Safety rules: ${categories}\n  ${command}\n\n${matchDetails}`,
      [
        { label: "Block",      description: "Skip this command (recommended)" },
        { label: "Allow once", description: "Run this command despite the safety warning" },
      ],
      "Safety",
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Stopped by safety rules" };
    }
    // Fall through to tier check
  }

  if (state.currentLevel === "bypassed") return undefined;

  const classification = classifyCommand(command);

  // ── Layer 2: Tier-based dangerous classification ──
  if (classification.dangerous) {
    if (!hasInteractiveUI(ctx)) {
      return {
        block: true,
        reason: `Dangerous command requires confirmation: ${command}\nUser can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."`,
      };
    }

    if (state.permissionMode === "block") {
      return {
        block: true,
        reason: `Not allowed (mode: block). Dangerous: ${command}\nUse /permission-mode ask to enable confirmations.`,
      };
    }

    playPermissionSound();
    const choice = await confirmDialog(
      ctx,
      `⚠️ Dangerous command\n  ${command}`,
      [
        { label: "Cancel",     description: "Skip this command (recommended)" },
        { label: "Allow once", description: "Run this dangerous command once" },
      ],
      "Danger",
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Cancelled" };
    }
    return undefined;
  }

  // ── Layer 3: Tier-based level check ──
  const requiredIndex = LEVEL_INDEX[classification.level];
  const currentIndex = LEVEL_INDEX[state.currentLevel];

  if (requiredIndex <= currentIndex) return undefined;

  const requiredLevel = classification.level;
  const requiredInfo = LEVEL_INFO[requiredLevel];

  // Track blocked command for auto-escalation suggestion
  const blockKey = `${requiredLevel}:${command.substring(0, 40)}`;
  blockedCommandCounts.set(blockKey, (blockedCommandCounts.get(blockKey) ?? 0) + 1);
  const blockedCount = blockedCommandCounts.get(blockKey)!;
  if (
    blockedCount >= 3 &&
    Date.now() - lastEscalationNotify > ESCALATION_COOLDOWN &&
    hasInteractiveUI(ctx) &&
    state.permissionMode !== "block"
  ) {
    lastEscalationNotify = Date.now();
    ctx.ui.notify(
      `💡 Command blocked ${blockedCount}x at current level. Try /permission ${requiredLevel} to raise.`,
      "info",
    );
  }

  // Print mode: block — track blocked command for auto-escalation suggestion
  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `Not allowed at current level (${state.currentLevel}). Command: ${command}\nAllowed at this level: ${LEVEL_ALLOWED_DESC[state.currentLevel]}\nUser can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} pi -p "..."`,
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `Not allowed (level: ${state.currentLevel}, mode: block). Command: ${command}\nRequires ${requiredInfo.label}. Allowed: ${LEVEL_ALLOWED_DESC[state.currentLevel]}\nUse /permission ${requiredLevel} or /permission-mode ask.`,
    };
  }

  // Interactive mode: prompt
  playPermissionSound();
  const choice = await confirmDialog(
    ctx,
    `Requires ${requiredInfo.label}\n  ${command}`,
    [
      { label: "Allow once",      description: "Run this command, ask again next time" },
      { label: "Allow (session)", description: `Raise permission to ${requiredInfo.label} until session ends` },
      { label: "Allow (global)",  description: `Save ${requiredInfo.label} as default in settings.json` },
      { label: "Cancel",          description: "Skip this command" },
    ],
    "Permission",
  );

  if (choice === "Allow once") return undefined;

  if (choice === "Allow (session)") {
    setLevel(state, requiredLevel, false, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (session only)`, "info");
    return undefined;
  }

  if (choice === "Allow (global)") {
    setLevel(state, requiredLevel, true, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
}

/** Check if file path matches any protected path glob — always-active safety net */
function checkProtectedPath(
  filePath: string,
  cwd: string,
  protectedPaths: ProtectedGlob[]
): ProtectedGlob[] {
  const relativePath = path.isAbsolute(filePath)
    ? path.relative(cwd, filePath)
    : filePath;
  if (relativePath.startsWith("..")) return [];
  return protectedPaths.filter((p) => matchesGlob(relativePath, p.glob));
}

/** Options for handleWriteToolCall */
export interface WriteToolCallOptions {
  state: PermissionState;
  toolName: string;
  filePath: string;
  ctx: any;
}

/** Handle write/edit tool_call - check permission and prompt if needed */
export async function handleWriteToolCall(
  opts: WriteToolCallOptions
): Promise<{ block: true; reason: string } | undefined> {
  const { state, toolName, filePath, ctx } = opts;
  const action = toolName === "write" ? "Write" : "Edit";

  // ── Layer 1: Hard safety net — protected paths (always checked) ──
  const pathMatches = checkProtectedPath(filePath, ctx.cwd, DEFAULT_PROTECTED_PATHS);
  if (pathMatches.length > 0) {
    const detail = pathMatches.map((m) => `  ${m.glob} — ${m.reason}`).join("\n");

    if (!hasInteractiveUI(ctx)) {
      return {
        block: true,
        reason: `Protected path write blocked:\n${detail}`,
      };
    }

    playPermissionSound();
    const choice = await confirmDialog(
      ctx,
      `🛡️ Protected path: ${action}\n  ${filePath}\n\n${detail}`,
      [
        { label: "Block", description: "Skip this write (recommended)" },
        { label: "Allow", description: "Write to this protected path anyway" },
      ],
      "Protected",
    );

    if (choice !== "Allow") {
      return { block: true, reason: "Protected path write blocked by user" };
    }
    // Fall through to tier check
  }

  if (state.currentLevel === "bypassed") return undefined;

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX["low"]) return undefined;

  const message = `Requires Low: ${action} ${filePath}`;

  // Print mode: block
  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `Not allowed (level: ${state.currentLevel}). ${action}: ${filePath}
Allowed at this level: ${LEVEL_ALLOWED_DESC[state.currentLevel]}
User can re-run with: PI_PERMISSION_LEVEL=low pi -p "..."`
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `Not allowed (level: ${state.currentLevel}, mode: block). ${action}: ${filePath}
Requires Low. Allowed at this level: ${LEVEL_ALLOWED_DESC[state.currentLevel]}
Use /permission low or /permission-mode ask to enable prompts.`
    };
  }

  // Interactive mode: prompt
  playPermissionSound();
  const choice = await confirmDialog(
    ctx,
    `Requires Low permission\n  ${action} ${filePath}`,
    [
      { label: "Allow once",      description: "Perform this write, ask again next time" },
      { label: "Allow (session)", description: "Raise permission to Low until session ends" },
      { label: "Allow (global)",  description: "Save Low as default in settings.json" },
      { label: "Cancel",          description: "Skip this write" },
    ],
    "Permission",
  );

  if (choice === "Allow once") return undefined;

  if (choice === "Allow (session)") {
    setLevel(state, "low", false, ctx);
    ctx.ui.notify(`Permission → Low (session only)`, "info");
    return undefined;
  }

  if (choice === "Allow (global)") {
    setLevel(state, "low", true, ctx);
    ctx.ui.notify(`Permission → Low (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
}

// ============================================================================
// Extension entry point — 3-layer guard
// ============================================================================
//
// Layer 1: Safety patterns (always-active hard safety net)
// Layer 2: Permission tiers (configurable level-based blocking)
// Layer 3: Safe Ops (git/gh protection + rm→trash replacement)
//
// This merges what was formerly safe-ops.ts into the permission extension.
// ============================================================================

export default function (pi: ExtensionAPI) {
  const state = createInitialState();
  const safeOps = new SafeOpsLayer();

  // Auto-escalation tracking: suggest raising level when same command blocked 3+ times
  const blockedCounts = new Map<string, number>();
  let lastEscalationSuggestion = 0;
  const ESCALATION_COOLDOWN_MS = 120_000;

  function checkAutoEscalation(command: string, requiredLevel: string, ctx: any) {
    const key = `${requiredLevel}:${command}`;
    const count = (blockedCounts.get(key) ?? 0) + 1;
    blockedCounts.set(key, count);

    if (count >= 3 && Date.now() - lastEscalationSuggestion > ESCALATION_COOLDOWN_MS) {
      lastEscalationSuggestion = Date.now();
      const t = getTelemetry();
      if (t && ctx.hasUI) {
        t.notify(`💡 Command blocked ${count}x. Use /permission ${requiredLevel} to raise level.`, {
          package: "permission",
          severity: "info",
        });
      }
    }
  }

  pi.registerCommand("permission", {
    description: "View or change permission level",
    handler: (args, ctx) => handlePermissionCommand(state, args, ctx),
  });

  pi.registerCommand("permission-mode", {
    description: "Set permission prompt mode (ask or block)",
    handler: (args, ctx) => handlePermissionModeCommand(state, args, ctx),
  });

  // Register SafeOpsLayer commands
  safeOps.registerCommands(pi);

  pi.on("session_start", async (_event, ctx) => {
    handleSessionStart(state, ctx);
    await safeOps.init(ctx);


  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      // Layer 3: Safe Ops — check git/rm first (fast path for simple replacements)
      const safeOpsResult = await safeOps.intercept(event.input.command as string, ctx);
      if (safeOpsResult) return safeOpsResult;

      // Layers 1+2: Safety patterns + permission tiers
      return handleBashToolCall(state, event.input.command as string, ctx);
    }

    if (event.toolName === "write" || event.toolName === "edit") {
      return handleWriteToolCall({
        state,
        toolName: event.toolName,
        filePath: event.input.path as string,
        ctx,
      });
    }

    return undefined;
  });

  pi.on("session_shutdown", async () => {
    safeOps.reset();
  });
}
