/**
 * Terminal utilities — detection, notifications, bring-to-front.
 * Single Responsibility: all terminal-interaction concerns in one place.
 */

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { TerminalInfo } from "./types.js";
import { playBeep } from "./audio.js";

const execAsync = promisify(child_process.exec);

// ── Terminal-notifier ────────────────────────────────────────────────────────

let terminalNotifierAvailable = false;
let terminalNotifierChecked = false;
const TERMINAL_NOTIFIER_PATHS = [
  "/Applications/terminal-notifier.app/Contents/MacOS/terminal-notifier",
  "/usr/local/bin/terminal-notifier",
  "/opt/homebrew/bin/terminal-notifier",
];

export async function checkTerminalNotifierAvailable(): Promise<boolean> {
  if (process.platform !== "darwin" || terminalNotifierChecked) return terminalNotifierAvailable;
  try {
    await execAsync("which terminal-notifier");
    for (const p of TERMINAL_NOTIFIER_PATHS) {
      try { await execAsync(`test -f "${p}"`); terminalNotifierAvailable = true; break; } catch {}
    }
  } catch {
    terminalNotifierAvailable = false;
  }
  terminalNotifierChecked = true;
  return terminalNotifierAvailable;
}

export function isTerminalNotifierAvailable(): boolean {
  return terminalNotifierAvailable;
}

// ── Terminal info detection ───────────────────────────────────────────────────

export async function detectTerminalInfo(): Promise<TerminalInfo> {
  const info: TerminalInfo = {};
  if (process.platform !== "darwin") return info;
  try {
    info.terminalPid = process.ppid;
    info.terminalApp = process.env.TERM_PROGRAM;
    info.terminalTTY = process.env.TTY;
    if (!info.terminalTTY) {
      try {
        const { stdout } = await execAsync(`ps -p ${process.ppid} -o tty=`);
        const tty = stdout.trim();
        if (tty && tty !== "??") info.terminalTTY = tty.startsWith("/dev/") ? tty : `/dev/${tty}`;
      } catch {}
    }
    if (!info.terminalTTY && info.terminalPid) {
      try {
        const { stdout } = await execAsync(
          `lsof -p ${info.terminalPid} 2>/dev/null | grep -m1 "/dev/ttys" | awk '{print $9}'`
        );
        const tty = stdout.trim();
        if (tty?.startsWith("/dev/")) info.terminalTTY = tty;
      } catch {}
    }
    if (!info.terminalApp) {
      try {
        const { stdout } = await execAsync(`lsappinfo info -only bundleID ${info.terminalPid}`);
        const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
        if (match) info.terminalApp = match[1];
      } catch {
        info.terminalApp = "com.googlecode.iterm2";
      }
    }
  } catch {}
  return info;
}

export async function isTerminalInBackground(info: TerminalInfo): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    const { stdout } = await execAsync(
      "lsappinfo front | awk '{print $1}' | xargs -I {} lsappinfo info -only bundleID {}"
    );
    const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
    if (!match) return false;
    const frontId = match[1];
    if (info.terminalApp && !frontId.includes(info.terminalApp)) return true;
    const knownTerminals = ["com.googlecode.iterm2", "iTerm.app"];
    return !knownTerminals.some((id) => frontId.includes(id));
  } catch {
    return false;
  }
}

// ── Bring to front ───────────────────────────────────────────────────────────

export async function bringTerminalToFront(info: TerminalInfo): Promise<void> {
  if (process.platform !== "darwin") return;
  try {
    const script = info.terminalTTY
      ? `tell application "iTerm2"\n  repeat with w in windows\n    set tabIdx to 0\n    repeat with t in tabs of w\n      set tabIdx to tabIdx + 1\n      repeat with s in sessions of t\n        if tty of s is "${info.terminalTTY}" then\n          tell w to select tab tabIdx\n          activate\n          return\n        end if\n      end repeat\n    end repeat\n  end repeat\nend tell`
      : `tell application "iTerm2" to activate`;
    const tmpFile = path.join(os.tmpdir(), `pi-terminal-${Date.now()}.scpt`);
    try {
      await fsPromises.writeFile(tmpFile, script, "utf8");
      await execAsync(`osascript "${tmpFile}"`);
    } finally {
      try { await fsPromises.unlink(tmpFile); } catch {}
    }
  } catch {}
}

// ── OS notifications ─────────────────────────────────────────────────────────

function dirName(): string {
  return process.cwd().split("/").pop() || "unknown";
}

function replaceTemplates(message: string): string {
  const d = dirName();
  return message.replace(/{session dir}/g, d).replace(/{dirname}/g, d);
}

export function displayOSXNotification(
  message: string,
  soundName?: string,
  terminalInfo?: TerminalInfo
): void {
  if (process.platform !== "darwin") {
    if (soundName) playBeep(soundName);
    return;
  }
  const finalMessage = replaceTemplates(message);
  const terminalBundleId = "com.googlecode.iterm2";

  if (terminalNotifierAvailable) {
    const args = ["-message", finalMessage, "-title", "Task Complete", "-activate", terminalBundleId];
    if (soundName) args.push("-sound", soundName);
    if (terminalInfo?.terminalTTY) {
      const tty = terminalInfo.terminalTTY;
      const pythonScript = `#!/usr/bin/env python3\nimport sys\ntty = "${tty}"\ntry:\n    import iterm2\n    async def main(connection):\n        app = await iterm2.async_get_app(connection)\n        for window in app.terminal_windows:\n            for tab in window.tabs:\n                for session in tab.sessions:\n                    try:\n                        session_tty = await session.async_get_variable("tty")\n                        if session_tty == tty or (session_tty and tty in str(session_tty)):\n                            await app.async_activate()\n                            await tab.async_activate(order_window_front=True)\n                            return\n                    except:\n                        pass\n        await app.async_activate()\n    iterm2.run_until_complete(main)\nexcept Exception:\n    sys.exit(1)\n`;
      const tmpFile = path.join(os.tmpdir(), `pi-notifier-${Date.now()}.py`);
      fs.writeFileSync(tmpFile, pythonScript, "utf-8");
      args.push("-execute", `/opt/homebrew/Caskroom/miniconda/base/bin/python3 "${tmpFile}"`);
    }
    child_process.spawn("terminal-notifier", args, { detached: true, stdio: "ignore" }).unref();
    return;
  }

  const escaped = finalMessage.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let script = `tell application "iTerm2" to display notification "${escaped}" with title "Task Complete"`;
  if (soundName) script += ` sound name "${soundName}"`;
  child_process.spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
}
