/**
 * pi-memory — Persistent memory across sessions.
 * Inlined from @samfp/pi-memory v1.0.2.
 *
 * Supports disableAutoInject config via settings.json:
 *   { "piMemory": { "disableAutoInject": true } }
 */
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import piMemory from "./src/index.ts";
import registerMemoryMode from "../memory-mode.ts";

function isAutoInjectDisabled(): boolean {
  try {
    const settingsPath = join(getAgentDir(), "settings.json");
    if (!existsSync(settingsPath)) return false;
    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    return settings?.piMemory?.disableAutoInject === true;
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  if (isAutoInjectDisabled()) {
    // pi-memory is installed but dormant — no context injection.
    // Enable by setting { "piMemory": { "disableAutoInject": false } }
    // in ~/.pi/agent/settings.json
    return;
  }

  // Register /mem and /remember commands (merged from memory-mode)
  registerMemoryMode(pi);

  pi.on("session_start", async (_event, ctx) => {
    try {
      piMemory(pi);
      ctx.ui.setStatus("pi-memory", "ready");
    } catch (err) {
      console.error("[pi-memory] Failed to load:", err);
      ctx.ui.notify("pi-memory failed to load", "error");
    }
  });
}
