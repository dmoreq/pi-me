/**
 * Web Fetch settings — loaded via pi-me's shared config system.
 *
 * Reads from ~/.pi/agent/web-fetch.jsonc and/or .pi/web-fetch.jsonc.
 * Falls back to sensible defaults if no config file exists.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse } from "jsonc-parser";
import type { FetchToolConfig } from "./core/types.js";

// ── Schema ─────────────────────────────────────────────────────────────

interface WebFetchConfig {
  verboseByDefault: boolean;
  defaultMaxChars: number;
  defaultTimeoutMs: number;
  defaultBrowser: string;
  defaultOs: string;
  defaultRemoveImages: boolean;
  defaultIncludeReplies: boolean | "extractors";
  defaultBatchConcurrency: number;
  tempDir?: string;
}

const DEFAULTS: WebFetchConfig = {
  verboseByDefault: false,
  defaultMaxChars: 50_000,
  defaultTimeoutMs: 15_000,
  defaultBrowser: "chrome_145",
  defaultOs: "windows",
  defaultRemoveImages: false,
  defaultIncludeReplies: "extractors",
  defaultBatchConcurrency: 8,
};

export interface ResolvedWebFetchSettings extends FetchToolConfig {
  verboseByDefault: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

function readJsonc(filePath: string): Record<string, unknown> | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parse(raw, [], {
      allowTrailingComma: true,
      disallowComments: false,
    });
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function pick<T>(
  obj: Record<string, unknown> | undefined,
  key: string,
): T | undefined {
  if (!obj || !(key in obj)) return undefined;
  return obj[key] as T;
}

function mergeConfig(
  overrides: Record<string, unknown> | undefined,
): WebFetchConfig {
  return {
    verboseByDefault:
      pick<boolean>(overrides, "verboseByDefault") ?? DEFAULTS.verboseByDefault,
    defaultMaxChars:
      pick<number>(overrides, "defaultMaxChars") ?? DEFAULTS.defaultMaxChars,
    defaultTimeoutMs:
      pick<number>(overrides, "defaultTimeoutMs") ?? DEFAULTS.defaultTimeoutMs,
    defaultBrowser:
      pick<string>(overrides, "defaultBrowser") ?? DEFAULTS.defaultBrowser,
    defaultOs: pick<string>(overrides, "defaultOs") ?? DEFAULTS.defaultOs,
    defaultRemoveImages:
      pick<boolean>(overrides, "defaultRemoveImages") ??
      DEFAULTS.defaultRemoveImages,
    defaultIncludeReplies:
      pick<boolean | "extractors">(overrides, "defaultIncludeReplies") ??
      DEFAULTS.defaultIncludeReplies,
    defaultBatchConcurrency:
      pick<number>(overrides, "defaultBatchConcurrency") ??
      DEFAULTS.defaultBatchConcurrency,
    tempDir: pick<string>(overrides, "tempDir"),
  };
}

function toFetchToolConfig(s: WebFetchConfig): ResolvedWebFetchSettings {
  return {
    verboseByDefault: s.verboseByDefault,
    maxChars: s.defaultMaxChars,
    timeoutMs: s.defaultTimeoutMs,
    browser: s.defaultBrowser,
    os: s.defaultOs as ResolvedWebFetchSettings["os"],
    removeImages: s.defaultRemoveImages,
    includeReplies: s.defaultIncludeReplies,
    batchConcurrency: s.defaultBatchConcurrency,
    tempDir: s.tempDir,
  };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Load web-fetch configuration with fallback chain:
 * 1. Project-level: <cwd>/.pi/web-fetch.jsonc
 * 2. Global: ~/.pi/agent/web-fetch.jsonc
 * 3. Internal defaults
 */
/**
 * Resolve the pi agent configuration directory.
 * Uses PI_AGENT_DIR env var, then common defaults.
 */
function getAgentDir(): string {
  return (
    process.env.PI_AGENT_DIR ??
    path.join(os.homedir(), ".pi", "agent")
  );
}

export function loadWebFetchDefaults(cwd?: string): ResolvedWebFetchSettings {
  const agentDir = getAgentDir();

  // Project config
  const projectOverrides =
    cwd ? readJsonc(path.join(cwd, ".pi", "web-fetch.jsonc")) : undefined;
  // Global config
  const globalOverrides = readJsonc(
    path.join(agentDir, "web-fetch.jsonc"),
  );

  // Cascade: project wins over global, global wins over defaults
  const config = mergeConfig({ ...globalOverrides, ...projectOverrides });
  return toFetchToolConfig(config);
}
