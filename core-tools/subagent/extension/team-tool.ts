/**
 * team-tool — Thin `team` tool for agent discovery and routing.
 *
 * Integrates with pi-me's existing subagent infrastructure:
 * - Agent discovery via discoverAgentsAll()
 * - Execution via sub-pi (the agent calls sub-pi with recommended config)
 * - Run tracking via session entries
 *
 * Actions:
 *   recommend — discover available agents and match to a goal
 *   run       — return sub-pi configuration for the selected agent
 *   status    — show recent team runs
 */
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { discoverAgentsAll, type AgentConfig } from "../agents/agents.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamRunEntry {
  runId: string;
  agent: string;
  goal: string;
  status: "started" | "completed" | "failed";
  timestamp: number;
}

type TeamAction = "recommend" | "run" | "status";

interface TeamToolParams {
  action: TeamAction;
  goal?: string;
  agent?: string;
  prompt?: string;
  skill?: string;
}

const CUSTOM_ENTRY_TYPE = "team-run";

// ─── Agent routing (~50 lines) ──────────────────────────────────────────────

/** Score agents by keyword match against a goal string. */
function matchAgents(agents: AgentConfig[], goal: string): { agent: AgentConfig; score: number }[] {
  const terms = goal.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  return agents
    .map(agent => {
      const text = `${agent.name} ${agent.description}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) score += 1;
        // bonus for exact agent name match
        if (agent.name.toLowerCase().includes(term)) score += 2;
      }
      return { agent, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Format agent recommendations as readable text. */
function formatRecommendations(
  matches: { agent: AgentConfig; score: number }[],
  allAgents: AgentConfig[],
  goal: string,
): string {
  if (matches.length === 0) {
    const allList = allAgents.map(a => `  - ${a.name}: ${desc(a)}`).join("\n");
    return `No strong agent matches for: "${goal}".\n\nAvailable agents:\n${allList}`;
  }

  const lines = [`## Recommended agents for: "${goal}"\n`];
  for (const { agent, score } of matches.slice(0, 5)) {
    const stars = score >= 4 ? "★★★" : score >= 2 ? "★★☆" : "★☆☆";
    lines.push(`- **${agent.name}** ${stars} — ${desc(agent)}`);
  }
  lines.push(`\nTo run with the top recommendation:`);
  lines.push(`\`sub-pi({ agent: "${matches[0]!.agent.name}", prompt: "your task" })\``);
  return lines.join("\n");
}

function desc(a: AgentConfig): string {
  return a.description?.slice(0, 120) ?? "no description";
}

// ─── Sub-pi helper (~30 lines) ──────────────────────────────────────────────

/** Build a sub-pi configuration for running a task with a specific agent. */
function buildSubPiConfig(
  agent: AgentConfig,
  goal: string,
  prompt?: string,
  skill?: string,
): string {
  const taskPrompt = prompt ?? goal;
  const lines: string[] = [];

  lines.push(`## Run with agent: **${agent.name}**\n`);
  lines.push("Use the `sub-pi` tool with these parameters:\n");
  lines.push("```json");
  lines.push(JSON.stringify({
    type: "single",
    tasks: [{
      prompt: taskPrompt,
      skill: skill ?? undefined,
    }],
    model: agent.model ?? undefined,
    thinking: agent.thinking ?? "inherit",
  }, null, 2));
  lines.push("```\n");

  lines.push("**Agent details:**");
  lines.push(`- Name: ${agent.name}`);
  lines.push(`- Description: ${desc(agent)}`);
  if (agent.model) lines.push(`- Default model: ${agent.model}`);
  if (agent.skills?.length) lines.push(`- Skills: ${agent.skills.join(", ")}`);
  if (agent.tools?.length) lines.push(`- Tools: ${agent.tools.join(", ")}`);

  return lines.join("\n");
}

// ─── Status (~30 lines) ────────────────────────────────────────────────────

function formatStatus(runs: TeamRunEntry[]): string {
  if (runs.length === 0) return "No team runs recorded in this session.";
  const lines = ["## Recent team runs\n"];
  for (const run of runs.slice(-10).reverse()) {
    const icon = run.status === "completed" ? "✅" : run.status === "failed" ? "❌" : "🔄";
    const time = new Date(run.timestamp).toISOString().slice(0, 19).replace("T", " ");
    lines.push(`- ${icon} **${run.agent}** — ${truncate(run.goal, 80)} (${time})`);
  }
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ─── Extension ──────────────────────────────────────────────────────────────

export function registerTeamTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "team",
    label: "Team",
    description:
      "Discover and route work to Pi agent teams. Use action='recommend' to find the best agent for a task. Use action='run' to get sub-pi configuration for running a task with a specific agent. Use action='status' to see recent team runs.",
    promptSnippet:
      'Use the team tool to discover available agents and route work: team({ action: "recommend", goal: "..." }), then team({ action: "run", ... }).',
    parameters: Type.Object({
      action: Type.Enum({ recommend: "recommend", run: "run", status: "status" } as const, {
        description: "Action: recommend (find agents), run (get config), status (list runs)",
      }),
      goal: Type.Optional(
        Type.String({ description: "Task description for agent matching (recommend/run)" }),
      ),
      agent: Type.Optional(
        Type.String({ description: "Agent name to use (run)" }),
      ),
      prompt: Type.Optional(
        Type.String({ description: "Task prompt for the agent (run). Defaults to goal." }),
      ),
      skill: Type.Optional(
        Type.String({ description: "Skill to inject (run)" }),
      ),
    }) as TSchema,

    async execute(_id, params, _signal, _onUpdate, ctx) {
      const { action, goal, agent: agentName, prompt, skill } = params as TeamToolParams;
      const discovery = discoverAgentsAll(ctx.cwd);
      const allAgents = [
        ...discovery.builtin,
        ...discovery.user,
        ...discovery.project,
      ].filter(a => !a.disabled && a.name !== "worker");

      // ── recommend ──────────────────────────────────────────────────

      if (action === "recommend") {
        const target = goal?.trim();
        if (!target) {
          const list = allAgents.map(a => `- **${a.name}**: ${desc(a)}`).join("\n");
          return result(`## Available Agents\n\n${list}`);
        }
        const matches = matchAgents(allAgents, target);
        return result(formatRecommendations(matches, allAgents, target));
      }

      // ── run ────────────────────────────────────────────────────────

      if (action === "run") {
        const target = goal?.trim();
        if (!agentName && !target) {
          return result("Provide `agent` and/or `goal` for `run`. Use `recommend` first to find agents.");
        }

        let selected: AgentConfig | undefined;
        if (agentName) {
          selected = allAgents.find(
            a => a.name.toLowerCase() === agentName.toLowerCase(),
          );
        }
        if (!selected && target) {
          const matches = matchAgents(allAgents, target);
          if (matches.length > 0) selected = matches[0]!.agent;
        }
        if (!selected) {
          return result(`Agent "${agentName ?? 'auto'}" not found. Use \`recommend\` to see available agents.`);
        }

        // Record the run start
        pi.appendEntry(CUSTOM_ENTRY_TYPE, {
          runId: `team-${Date.now()}`,
          agent: selected.name,
          goal: target ?? prompt ?? "unspecified",
          status: "started",
          timestamp: Date.now(),
        } satisfies TeamRunEntry);

        return result(buildSubPiConfig(selected, target ?? prompt ?? "", prompt, skill));
      }

      // ── status ─────────────────────────────────────────────────────

      if (action === "status") {
        const entries = ctx.sessionManager.getEntries() as Array<{
          type?: string;
          customType?: string;
          data?: TeamRunEntry;
        }>;
        const runs = entries
          .filter(e => e.type === "custom" && e.customType === CUSTOM_ENTRY_TYPE)
          .map(e => e.data!)
          .filter(Boolean);
        return result(formatStatus(runs));
      }

      return result("Unknown action. Use: recommend, run, or status.");
    },
  });

  // ── Command ─────────────────────────────────────────────────────────

  pi.registerCommand("team", {
    description: "Discover available agents and run team workflows",
    handler: async (_args, ctx) => {
      const discovery = discoverAgentsAll(ctx.cwd);
      const allAgents = [
        ...discovery.builtin,
        ...discovery.user,
        ...discovery.project,
      ].filter(a => !a.disabled);

      const lines = [
        `**Agents (${allAgents.length}):**`,
        ...allAgents.map(a => `- **${a.name}**: ${desc(a)}`),
        "",
        `Use \`team({ action: "recommend", goal: "..." })\` to find the best agent for your task.`,
        `Use \`team({ action: "run", agent: "...", goal: "..." })\` to run with an agent.`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

function result(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}
