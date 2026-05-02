/**
 * pi-memory — Persistent memory across sessions.
 * Adopted from @samfp/pi-memory v1.0.2.
 *
 * Supports disableAutoInject config via settings.json:
 *   { "piMemory": { "disableAutoInject": true } }
 */
import { registerAdoptedPackage } from "../../shared/register-package.js";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

  registerAdoptedPackage(pi, {
    importFn: () => import("@samfp/pi-memory"),
    statusKey: "pi-memory",
    packageName: "@samfp/pi-memory",
  });
}
