/**
 * Audio utilities — beep, speak, pronunciation replacements.
 * Single Responsibility: all audio-output concerns in one place.
 */

import * as child_process from "node:child_process";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// ── Pronunciation Replacements ───────────────────────────────────────────────

type PronunciationReplacements = Record<string, string>;

let pronunciationReplacements: PronunciationReplacements = {};
let pronunciationsLoaded = false;

function parsePronunciationsPlist(content: string): PronunciationReplacements {
  const replacements: PronunciationReplacements = {};
  const keyRegex = /<key>([^<]+)<\/key>\s*<string>([^<]+)<\/string>/g;
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(content)) !== null) {
    const [, key, value] = match;
    replacements[key.trim()] = value.trim();
  }
  return replacements;
}

/** Load pronunciation replacements from ~/Library/Speech/Pronunciations.plist (macOS only). */
export async function loadPronunciations(): Promise<void> {
  if (process.platform !== "darwin" || pronunciationsLoaded) return;
  try {
    const plistPath = path.join(os.homedir(), "Library", "Speech", "Pronunciations.plist");
    const content = await fsPromises.readFile(plistPath, "utf-8");
    pronunciationReplacements = parsePronunciationsPlist(content);
  } catch {
    pronunciationReplacements = {};
  }
  pronunciationsLoaded = true;
}

/** Get loaded pronunciation replacements (for testing). */
export function getPronunciationReplacements(): PronunciationReplacements {
  return { ...pronunciationReplacements };
}

/** Apply pronunciation replacements to a message. */
export function applyPronunciations(message: string): string {
  let result = message;
  const sortedKeys = Object.keys(pronunciationReplacements).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const replacement = pronunciationReplacements[key];
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
  }
  return result;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const BEEP_SOUNDS = [
  "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk",
  "Glass", "Hero", "Morse", "Ping", "Pop", "Purr",
  "Sosumi", "Submarine",
] as const;

export const SAY_MESSAGES = [
  "Task completed",
  "Done",
  "Finished",
  "Ready",
  "All done",
  "Complete",
  "Task completed in {dirname}",
  "Done in {dirname}",
  "Finished in {dirname}",
  "All done in {dirname}",
  "{session dir} needs your attention",
] as const;

// ── Say availability ─────────────────────────────────────────────────────────

let hasSayCommand = false;

export async function checkSayAvailable(): Promise<boolean> {
  if (process.platform !== "darwin") { hasSayCommand = false; return false; }
  return new Promise((resolve) => {
    child_process.exec("which say", (err) => {
      hasSayCommand = !err;
      resolve(hasSayCommand);
    });
  });
}

export function isSayAvailable(): boolean {
  return hasSayCommand;
}

// ── Playback ─────────────────────────────────────────────────────────────────

export function playBeep(soundName: string = "Tink"): void {
  if (process.platform === "darwin") {
    child_process.spawn("afplay", [`/System/Library/Sounds/${soundName}.aiff`], {
      detached: true, stdio: "ignore",
    }).unref();
  } else if (process.platform === "linux") {
    try {
      child_process.spawn("paplay", ["/usr/share/sounds/freedesktop/stereo/bell.oga"], {
        detached: true, stdio: "ignore",
      }).unref();
    } catch {
      child_process.exec("echo -e '\\a'");
    }
  } else {
    child_process.exec("echo -e '\\a'");
  }
}

function replaceTemplates(message: string): string {
  const dirName = process.cwd().split("/").pop() || "unknown";
  return message.replace(/{session dir}/g, dirName).replace(/{dirname}/g, dirName);
}

export function speakMessage(message: string): void {
  if (!hasSayCommand) return;
  const final = applyPronunciations(replaceTemplates(message));
  const escaped = final.replace(/"/g, '\\"');
  child_process.spawn("say", ["-v", "Daniel", escaped], {
    detached: true, stdio: "ignore",
  }).unref();
}
