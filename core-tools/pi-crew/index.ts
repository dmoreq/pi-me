/**
 * pi-crew — Team coordination for Pi agents.
 * Thin wrapper around pi-me's native subagent infrastructure.
 *
 * Replaces the 193-file pi-crew npm package with a ~260-line implementation
 * that uses pi-me's existing discoverAgentsAll() and sub-pi tooling.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerTeamTool } from "./team-tool.ts";

export default function registerPiCrew(pi: ExtensionAPI): void {
  registerTeamTool(pi);
}
