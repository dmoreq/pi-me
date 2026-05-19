/**
 * memory — Persistent memory across sessions.
 * Inlined from @samfp/memory v1.0.2.
 *
 * Supports disableAutoInject config via settings.json:
 *   { "memory": { "disableAutoInject": true } }
 */
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import memory from "./src/index.ts";

function isAutoInjectDisabled(): boolean {
  try {
    const settingsPath = join(getAgentDir(), "settings.json");
    if (!existsSync(settingsPath)) return false;
    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    return settings?.memory?.disableAutoInject === true;
  } catch {
    return false;
  }
}

interface GlobalSettings {
  memory?: {
    disableAutoInject?: boolean;
    lessonInjection?: "all" | "selective";
  };
}

function readGlobalSettings(): GlobalSettings {
  try {
    const settingsPath = join(getAgentDir(), "settings.json");
    if (!existsSync(settingsPath)) return {};
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return {};
  }
}

export default function (pi: ExtensionAPI) {
  const globalSettings = readGlobalSettings();

  if (globalSettings.memory?.disableAutoInject === true) {
    // memory is installed but dormant — no context injection.
    // Enable by setting { "memory": { "disableAutoInject": false } }
    // in ~/.pi/agent/settings.json
    return;
  }

  // Call memory(pi) at registration time — NOT inside a session_start handler.
  // This ensures inner event handlers (session_start, before_agent_start, etc.)
  // are registered before any session begins.
  memory(pi, globalSettings);
}
