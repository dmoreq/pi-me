/**
 * Startup Header Extension
 *
 * Replaces the built-in startup header with a premium welcome screen
 * featuring a block-based "pi" logo with magenta→cyan gradient, two-column
 * layout, tips, recent sessions, skills count, and model info.
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

// ── Resolve pi-me root directory ───────────────────────────────────────

function findPiMeRoot(): string | null {
  try {
    const __filename = fileURLToPath(import.meta.url);
    let dir = path.dirname(__filename);
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

      const label = dirName
        .replace(/^--+/, "")
        .replace(/--+$/, "")
        .replace(/-+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || dirName;

      sessionAges.push({ label, timestamp });
    } catch {}
  }

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

  const piMeRoot = findPiMeRoot();
  if (piMeRoot) {
    const pkgSkills = path.join(piMeRoot, "skills");
    if (fs.existsSync(pkgSkills)) {
      searchPaths.push(pkgSkills);
    }
  }

  const seen = new Set<string>();
  for (const sp of searchPaths) {
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

// ── Text Helpers ───────────────────────────────────────────────────────

/** Strip ANSI escape sequences to get visible width of a string. */
function visibleWidth(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Center text within a given width (ANSI-aware). */
function centerText(text: string, width: number): string {
  const visLen = visibleWidth(text);
  if (visLen >= width) return text;
  const leftPad = Math.floor((width - visLen) / 2);
  const rightPad = width - visLen - leftPad;
  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

/** Pad a string to a given visible width. */
function padEnd(text: string, width: number): string {
  const padLen = Math.max(0, width - visibleWidth(text));
  return text + " ".repeat(padLen);
}

/** ANSI-aware truncation with ellipsis. */
function truncate(text: string, maxWidth: number): string {
  const visLen = visibleWidth(text);
  if (visLen <= maxWidth) return text;

  const ellipsis = "\u2026";
  const targetWidth = Math.max(0, maxWidth - 1);
  let result = "";
  let currentWidth = 0;
  let inEscape = false;

  for (const char of text) {
    if (char === "\x1b") inEscape = true;
    if (inEscape) {
      result += char;
      if (char === "m") inEscape = false;
    } else if (currentWidth < targetWidth) {
      result += char;
      currentWidth++;
    }
  }
  return result + ellipsis;
}

/** Apply magenta→cyan gradient to a string. */
function gradientLine(line: string): string {
  const colors = [
    "\x1b[38;5;199m", // bright magenta
    "\x1b[38;5;171m", // magenta-purple
    "\x1b[38;5;135m", // purple
    "\x1b[38;5;99m",  // purple-blue
    "\x1b[38;5;75m",  // cyan-blue
    "\x1b[38;5;51m",  // bright cyan
  ];
  const reset = "\x1b[0m";

  let result = "";
  let colorIdx = 0;
  const step = Math.max(1, Math.floor(line.length / colors.length));

  for (let i = 0; i < line.length; i++) {
    if (i > 0 && i % step === 0 && colorIdx < colors.length - 1) {
      colorIdx++;
    }
    const char = line[i];
    if (char !== " ") {
      result += colors[colorIdx] + char + reset;
    } else {
      result += char;
    }
  }
  return result;
}

// ── Pi Logo (block-based) ─────────────────────────────────────────────

const PI_LOGO_RAW = [
  "\u2580\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2580",
  " \u2558\u2588\u2588\u2588    \u2588\u2588\u2588  ",
  "  \u2588\u2588\u2588    \u2588\u2588\u2588  ",
  "  \u2588\u2588\u2588    \u2588\u2588\u2588  ",
  " \u2584\u2588\u2588\u2588\u2584  \u2584\u2588\u2588\u2588\u2584 ",
];

// ── Border Characters ──────────────────────────────────────────────────

const TL = "\u256D";
const TR = "\u256E";
const BL = "\u2570";
const BR = "\u256F";
const TEE_UP = "\u2534"; // ┴
const H = "\u2500";
const V = "\u2502";

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
    const version = ctx.appVersion ?? "0.0.0";

    ctx.ui.setHeader((_tui, theme) => {
      return {
        render(width: number): string[] {
          // ── Responsive box dimensions ──
          const maxWidth = 100;
          const boxWidth = Math.min(maxWidth, Math.max(0, width - 2));
          if (boxWidth < 4) return [];

          const dualContentWidth = boxWidth - 3; // │ + │ + │
          const preferredLeftCol = 26;
          const minLeftCol = 14;
          const minRightCol = 20;
          const leftMinContentWidth = Math.max(
            minLeftCol,
            visibleWidth("Welcome back!"),
            visibleWidth(modelName),
            visibleWidth(providerName),
          );
          const desiredLeftCol = Math.min(
            preferredLeftCol,
            Math.max(minLeftCol, Math.floor(dualContentWidth * 0.35)),
          );
          const dualLeftCol =
            dualContentWidth >= minRightCol + 1
              ? Math.min(desiredLeftCol, dualContentWidth - minRightCol)
              : Math.max(1, dualContentWidth - 1);
          const dualRightCol = Math.max(1, dualContentWidth - dualLeftCol);
          const showRightColumn =
            dualLeftCol >= leftMinContentWidth && dualRightCol >= minRightCol;
          const leftCol = showRightColumn ? dualLeftCol : boxWidth - 2;
          const rightCol = showRightColumn ? dualRightCol : 0;

          // ── Left column: logo + welcome ──
          const logoColored = PI_LOGO_RAW.map(gradientLine);

          const leftLines = [
            "",
            centerText(theme.bold("Welcome back!"), leftCol),
            "",
            ...logoColored.map(l => centerText(l, leftCol)),
            "",
            centerText(theme.fg("muted", modelName), leftCol),
            centerText(theme.fg("dim", providerName), leftCol),
          ];

          // ── Right column: tips + loaded info + recent sessions ──
          const separatorWidth = Math.max(0, rightCol - 3);
          const separator = ` ${theme.fg("dim", H.repeat(separatorWidth))}`;

          // Recent sessions
          const sessionLines: string[] = [];
          if (recentSessions.length === 0) {
            sessionLines.push(` ${theme.fg("dim", "No recent sessions")}`);
          } else {
            for (const session of recentSessions.slice(0, 3)) {
              sessionLines.push(
                ` ${theme.fg("dim", "\u2022 ")}${theme.fg("muted", session.name)}${theme.fg("dim", ` (${session.age})`)}`,
              );
            }
          }

          const rightLines = [
            ` ${theme.bold("Shortcuts")}`,
            ` ${theme.fg("dim", "?")}${theme.fg("muted", " help")}`,
            ` ${theme.fg("dim", "#")}${theme.fg("muted", " actions")}`,
            ` ${theme.fg("dim", "/")}${theme.fg("muted", " commands")}`,
            ` ${theme.fg("dim", "!")}${theme.fg("muted", " bash")}`,
            ` ${theme.fg("dim", "$")}${theme.fg("muted", " python")}`,
            separator,
            ` ${theme.bold("Context")}`,
            `  ${theme.fg("dim", cwdBase)}`,
            `  ${theme.fg("dim", `${skillsCount} skill${skillsCount !== 1 ? "s" : ""}`)}`,
            separator,
            ` ${theme.bold("Recent")}`,
            ...sessionLines,
            "",
          ];

          // ── Assemble ──
          const lines: string[] = [];

          // Top border with embedded title
          const title = ` pi v${version} `;
          const titlePrefix = H.repeat(3);
          const titleVisLen = 3 + visibleWidth(title);
          const titleSpace = boxWidth - 2;
          if (titleVisLen >= titleSpace) {
            lines.push(TL + theme.fg("dim", titlePrefix + title) + TR);
          } else {
            const afterTitle = titleSpace - titleVisLen;
            lines.push(
              TL +
                theme.fg("dim", titlePrefix) +
                theme.fg("muted", title) +
                theme.fg("dim", H.repeat(afterTitle)) +
                TR,
            );
          }

          // Body rows
          const maxRows = Math.max(leftLines.length, rightLines.length);
          for (let i = 0; i < maxRows; i++) {
            const l = truncate(leftLines[i] ?? "", leftCol);
            if (showRightColumn) {
              const r = truncate(rightLines[i] ?? "", rightCol);
              lines.push(V + padEnd(l, leftCol) + V + padEnd(r, rightCol) + V);
            } else {
              lines.push(V + padEnd(l, leftCol) + V);
            }
          }

          // Bottom border
          if (showRightColumn) {
            lines.push(
              BL + theme.fg("dim", H.repeat(leftCol)) +
              theme.fg("dim", TEE_UP) +
              theme.fg("dim", H.repeat(rightCol)) +
              BR,
            );
          } else {
            lines.push(BL + theme.fg("dim", H.repeat(leftCol)) + BR);
          }

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
