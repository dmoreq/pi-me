/**
 * Profile reader for umbrella extension loading.
 *
 * Reads the `profile` field from `~/.pi/agent/settings.json`.
 * Defaults to `"full"` if the file or field is missing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "./pi-config.ts";
import type { Profile } from "./types.ts";

export function readProfile(): Profile {
  try {
    const p = join(getAgentDir(), "settings.json");
    if (!existsSync(p)) return "full";
    const s = JSON.parse(readFileSync(p, "utf-8"));
    if (s?.profile === "minimal" || s?.profile === "dev") return s.profile;
    return "full";
  } catch {
    return "full";
  }
}
