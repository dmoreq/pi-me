/**
 * Extension State File Helpers
 *
 * Standardizes state file paths and I/O for extensions that need to persist
 * runtime state across sessions (e.g., color palette index, allowed commands).
 *
 * State files are stored in ~/.pi/ext-state/<extension-name>.json
 *
 * Usage:
 *   const state = readExtStateSync("session-color") ?? { lastColorIndex: 0 };
 *   state.lastColorIndex = 5;
 *   writeExtStateSync("session-color", state);
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/** Base directory for all extension state files */
const EXT_STATE_DIR = path.join(os.homedir(), ".pi", "ext-state");

/**
 * Get the file path for an extension's state file.
 */
export function getExtStatePath(extensionName: string): string {
  return path.join(EXT_STATE_DIR, `${extensionName}.json`);
}

/**
 * Ensure the ext-state directory exists (sync).
 */
export function ensureExtStateDir(): void {
  fs.mkdirSync(EXT_STATE_DIR, { recursive: true });
}

/**
 * Read extension state from file (sync). Returns null if file doesn't exist.
 */
export function readExtStateSync<T = Record<string, unknown>>(
  extensionName: string,
): T | null {
  try {
    const filePath = getExtStatePath(extensionName);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write extension state to file (sync). Creates directory if needed.
 */
export function writeExtStateSync<T = Record<string, unknown>>(
  extensionName: string,
  state: T,
): void {
  try {
    ensureExtStateDir();
    const filePath = getExtStatePath(extensionName);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error(`[ext-state] Failed to write state for "${extensionName}":`, err);
  }
}

/**
 * Read extension state from file (async). Returns null if file doesn't exist.
 */
export async function readExtState<T = Record<string, unknown>>(
  extensionName: string,
): Promise<T | null> {
  try {
    const filePath = getExtStatePath(extensionName);
    const raw = await fsPromises.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write extension state to file (async). Creates directory if needed.
 */
export async function writeExtState<T = Record<string, unknown>>(
  extensionName: string,
  state: T,
): Promise<void> {
  try {
    await fsPromises.mkdir(EXT_STATE_DIR, { recursive: true });
    const filePath = getExtStatePath(extensionName);
    await fsPromises.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error(`[ext-state] Failed to write state for "${extensionName}":`, err);
  }
}

/**
 * Remove extension state file (async).
 */
export async function removeExtState(extensionName: string): Promise<void> {
  try {
    const filePath = getExtStatePath(extensionName);
    await fsPromises.unlink(filePath);
  } catch {
    // File doesn't exist — no-op
  }
}
