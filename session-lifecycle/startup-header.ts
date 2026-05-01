/**
 * Startup Header Extension
 *
 * Replaces the built-in startup header (logo + keybinding hints) with a
 * custom welcome message featuring ASCII art, tips, skills count, recent
 * sessions, and model info.
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// ── Resolve pi-me root directory ───────────────────────────────────────

function findPiMeRoot(): string | null {
  // Try from this file's location (inside session-lifecycle/)
  try {
    const __filename = fileURLToPath(import.meta.url);
    let dir = path.dirname(__filename);
    // Walk up to find package.json
    for (let i = 0; i < 5; i++) {
      const pkg = path.join(dir, "package.json");
      if (fs.existsSync(pkg)) {
        try {
          const json = JSON.parse(fs.readFileSync(pkg, "utf-8"));
          if (json.name === "pi-me") return dir;
        } catch {}
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {}
  return null;
}

// ── Recent Sessions ────────────────────────────────────────────────────

interface RecentSession {
  name: string;
  age: string;
  timestamp: number;
}

function getRecentSessions(_cwd: string): RecentSession[] {
  const sessionsDir = path.join(os.homedir(), ".pi", "agent", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  const allDirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== "subagents" && !d.name.startsWith("."))
    .map(d => d.name);

  // Get the most recent session file mtime for each directory
  const sessionAges: { label: string; timestamp: number }[] = [];
  for (const dirName of allDirs) {
    const dir = path.join(sessionsDir, dirName);
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith(".jsonl") && !f.includes("file-line-events"))
        .sort()
        .reverse();
      if (files.length === 0) continue;

      const filePath = path.join(dir, files[0]);
      const stat = fs.statSync(filePath);
      const timestamp = stat.mtimeMs;

      // Derive a human label from the dir name
      const label = dirName
        .replace(/^--+/, "")
        .replace(/--+$/, "")
        .replace(/-+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || dirName;

      sessionAges.push({ label, timestamp });
    } catch {}
  }

  // Sort by most recent first
  sessionAges.sort((a, b) => b.timestamp - a.timestamp);

  const now = Date.now();
  const result: RecentSession[] = [];

  for (const s of sessionAges.slice(0, 5)) {
    const ageMs = now - s.timestamp;
    const ageSeconds = ageMs / 1000;
    let age: string;
    if (ageSeconds < 60) age = "just now";
    else if (ageSeconds < 3600) age = `${Math.floor(ageSeconds / 60)}m ago`;
    else if (ageSeconds < 86400) age = `${Math.floor(ageSeconds / 3600)}h ago`;
    else age = `${Math.floor(ageSeconds / 86400)}d ago`;

    result.push({ name: s.label, age, timestamp: s.timestamp });
  }

  return result;
}

// ── Skills Count ───────────────────────────────────────────────────────

function countSkills(): number {
  const searchPaths: string[] = [
    path.join(os.homedir(), ".pi", "agent", "skills"),
    path.join(os.homedir(), ".pi", "skills"),
    ".pi/skills",
  ];

  // Add pi-me's skills directory if resolvable
  const piMeRoot = findPiMeRoot();
  if (piMeRoot) {
    const pkgSkills = path.join(piMeRoot, "skills");
    if (fs.existsSync(pkgSkills)) {
      searchPaths.push(pkgSkills);
    }
  }

  const seen = new Set<string>();
  for (const sp of searchPaths) {
    // Resolve relative paths against homedir or cwd as needed
    const resolved = sp.startsWith(".") ? path.resolve(sp) : sp;
    if (!fs.existsSync(resolved)) continue;
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMd = path.join(resolved, entry.name, "SKILL.md");
          if (fs.existsSync(skillMd)) {
            seen.add(skillMd);
          }
        }
      }
    } catch {}
  }
  return seen.size;
}

// ── Pi ASCII Block Art ─────────────────────────────────────────────────

function renderPiArt(theme: Theme): string[] {
  const B = theme.fg("accent", "█");
  return [
    `      ${B}${B}${B}${B}${B}${B}${B}${B}${B}${B}`,
    `      ${B}${B}${B}${B}  ${B}${B}${B}${B}`,
    `      ${B}${B}${B}${B}  ${B}${B}${B}${B}`,
    `      ${B}${B}${B}${B}${B}${B}${B}${B}  ${B}${B}${B}${B}`,
    `      ${B}${B}${B}${B}      ${B}${B}${B}${B}`,
    `      ${B}${B}${B}${B}      ${B}${B}${B}${B}`,
  ];
}

// ── Border Characters ──────────────────────────────────────────────────

const TL = "╭";
const TR = "╮";
const BL = "╰";
const BR = "╯";
const H = "─";
const V = "│";
const B_SPLIT = "┴";

// ── ANSI-aware string padding ────────────────────────────────────────────

/**
 * Strip ANSI escape sequences to get the visible width of a string.
 */
function visibleWidth(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/**
 * Pad a string (possibly containing ANSI codes) to a given visible width.
 */
function ansiPadEnd(s: string, width: number): string {
  const padLen = Math.max(0, width - visibleWidth(s));
  return s + " ".repeat(padLen);
}

// ── Extension ──────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    // Gather dynamic data
    const model = ctx.model;
    const modelName = model?.name ?? "unknown";
    const providerName = model?.provider ?? "unknown";
    const skillsCount = countSkills();
    const recentSessions = getRecentSessions(ctx.cwd);
    const cwdBase = path.basename(ctx.cwd);

    ctx.ui.setHeader((_tui, theme) => {
      return {
        render(width: number): string[] {
          const maxWidth = Math.min(width, 120);

          // ── Build left column ──
          const piArt = renderPiArt(theme);
          const welcome = theme.bold(theme.fg("accent", "Welcome back!"));
          const modelLine = theme.fg("accent", `     ${modelName}`);
          const providerLine = theme.fg("dim", `         ${providerName}`);

          const leftContent = [
            `                          `,
            `      ${welcome}`,
            `                          `,
            ...piArt,
            `                          `,
            modelLine,
            providerLine,
            `                          `,
          ];

          // ── Build right column ──
          const tipsTitle = theme.bold("Tips");
          const tipLines = [
            `${theme.fg("muted", "/")} for commands`,
            `${theme.fg("muted", "!")} to run bash`,
            `${theme.fg("muted", "Shift+Tab")} cycle thinking`,
          ];

          const loadedTitle = theme.bold("Loaded");
          const cwdLine = theme.fg("dim", `  ${cwdBase}`);
          const skillsLine = theme.fg("dim", `  ${skillsCount} skills`);

          const recentTitle = theme.bold("Recent sessions");
          const recentLines = recentSessions.length > 0
            ? recentSessions.slice(0, 3).map(s =>
                theme.fg("dim", `  • ${s.name} (${s.age})`)
              )
            : [theme.fg("dim", "  • (none)")];

          // ── Dimensions ──
          const leftWidth = 28;
          const rightPad = 2;
          const dividerWidth = 1;
          const borderWidth = 2; // left and right border chars
          const usableRightWidth = Math.max(
            20,
            maxWidth - leftWidth - dividerWidth - borderWidth - rightPad
          );

          // ── Build right content ──
          const rightLines: string[] = [];
          rightLines.push(` `);
          rightLines.push(` ${tipsTitle}`);
          for (const t of tipLines) {
            rightLines.push(` ${t}`);
          }
          rightLines.push(` ${H.repeat(Math.max(18, usableRightWidth - 2))}`);
          rightLines.push(` ${loadedTitle}`);
          rightLines.push(cwdLine);
          rightLines.push(skillsLine);
          rightLines.push(` ${H.repeat(Math.max(18, usableRightWidth - 2))}`);
          rightLines.push(` ${recentTitle}`);
          for (const r of recentLines) {
            rightLines.push(r);
          }
          // Trailing empty row
          rightLines.push(` `);

          // Pad right lines to match left content height
          while (rightLines.length < leftContent.length) {
            rightLines.push(` `);
          }
          // Also pad left content if right is taller
          while (leftContent.length < rightLines.length) {
            leftContent.push(`                          `);
          }

          // ── Assemble ──
          const lines: string[] = [];
          const titleLen = Math.max(10, maxWidth - 15);
          lines.push(`${TL}${H}${H}${H} pi agent ${H.repeat(titleLen)}${TR}`);

          for (let i = 0; i < leftContent.length; i++) {
            const left = leftContent[i] ?? `                          `;
            const right = rightLines[i] ?? ` `;
            const leftPadded = ansiPadEnd(left, leftWidth);
            const rightPadded = ansiPadEnd(right, usableRightWidth);
            lines.push(`${V}${leftPadded}${V}${rightPadded}${V}`);
          }

          lines.push(`${BL}${H.repeat(leftWidth + 1)}${B_SPLIT}${H.repeat(usableRightWidth)}${BR}`);

          return lines;
        },
        invalidate() {},
      };
    });
  });

  // Command to restore built-in header
  pi.registerCommand("builtin-header", {
    description: "Restore built-in header with keybinding hints",
    handler: async (_args, ctx) => {
      ctx.ui.setHeader(undefined);
      ctx.ui.notify("Built-in header restored", "info");
    },
  });
}
