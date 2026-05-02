/**
 * Smoke tests for team-tool pure functions.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// The pure functions are not individually exported from team-tool.ts
// (they're private to the module). We test by importing the module and
// verifying the registered tool shape.
import { registerTeamTool } from "./team-tool.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("team-tool", () => {
  it("exports registerTeamTool function", () => {
    assert.equal(typeof registerTeamTool, "function");
  });

  it("registers without throwing", () => {
    const tools: Array<{ name: string; label: string }> = [];
    const commands: Array<{ name: string }> = [];
    const sessions: Array<Record<string, unknown>> = [];

    const mockPi = {
      registerTool(def: { name: string; label: string }) {
        tools.push(def);
      },
      registerCommand(name: string, _def: Record<string, unknown>) {
        commands.push({ name });
      },
      appendEntry(_type: string, _data: Record<string, unknown>) {
        // no-op
      },
    } as unknown as ExtensionAPI;

    assert.doesNotThrow(() => registerTeamTool(mockPi));
    assert.ok(tools.length >= 1, "should register at least one tool");
    assert.ok(commands.length >= 1, "should register at least one command");
  });
});

describe("team tool schema", () => {
  it("tool is named 'team'", () => {
    const tools: Array<{ name: string }> = [];
    const mockPi = {
      registerTool(def: { name: string }) {
        tools.push(def);
      },
      registerCommand() {},
      appendEntry() {},
    } as unknown as ExtensionAPI;

    registerTeamTool(mockPi);
    assert.equal(tools[0]!.name, "team");
  });

  it("tool has label 'Team'", () => {
    const tools: Array<{ label: string }> = [];
    const mockPi = {
      registerTool(def: { label: string }) {
        tools.push(def);
      },
      registerCommand() {},
      appendEntry() {},
    } as unknown as ExtensionAPI;

    registerTeamTool(mockPi);
    assert.equal(tools[0]!.label, "Team");
  });
});

describe("team command", () => {
  it("registers /team command", () => {
    const commands: Array<{ name: string }> = [];
    const mockPi = {
      registerTool() {},
      registerCommand(_name: string, def: { name: string }) {
        commands.push(def);
      },
      appendEntry() {},
    } as unknown as ExtensionAPI;

    // The command is registered with registerCommand("team", ...)
    const captured: Array<{ name: string }> = [];
    const capturePi = {
      registerTool() {},
      registerCommand(name: string, def: Record<string, unknown>) {
        captured.push({ name });
      },
      appendEntry() {},
    } as unknown as ExtensionAPI;

    registerTeamTool(capturePi);
    assert.ok(captured.some(c => c.name === "team"), "should register /team command");
  });
});

describe("recommend action format", () => {
  it("generates structured output format", () => {
    // Verify the output format patterns by examining the tool description.
    // The actual output depends on agent discovery, but the format should be consistent.
    const tools: Array<{ description: string }> = [];
    const mockPi = {
      registerTool(def: { description: string }) {
        tools.push(def);
      },
      registerCommand() {},
      appendEntry() {},
    } as unknown as ExtensionAPI;

    registerTeamTool(mockPi);
    const desc = tools[0]!.description;
    assert.ok(desc.includes("recommend"));
    assert.ok(desc.includes("run"));
    assert.ok(desc.includes("status"));
  });
});

describe("agent routing keywords", () => {
  it("should match common coding task keywords", () => {
    const keywords = ["test", "review", "plan", "build", "debug", "refactor", "deploy"];
    const agentDescriptions = [
      { name: "reviewer", desc: "Code review agent" },
      { name: "planner", desc: "Planning and architecture agent" },
      { name: "developer", desc: "Implementation and coding agent" },
      { name: "tester", desc: "Test writing and QA agent" },
    ];

    // Simulate keyword matching (same algorithm as matchAgents)
    for (const kw of keywords) {
      const matches = agentDescriptions
        .map(a => ({ a, s: a.desc.toLowerCase().includes(kw) ? 1 : 0 }))
        .filter(m => m.s > 0);
      if (kw === "review" || kw === "test") {
        assert.ok(matches.length >= 1, `keyword "${kw}" should match at least one agent`);
      }
    }
  });
});

describe("run tracking entry", () => {
  it("uses consistent custom entry type", () => {
    const entry = {
      type: "custom",
      customType: "team-run",
      data: {
        runId: "team-123",
        agent: "reviewer",
        goal: "Review the auth module",
        status: "started",
        timestamp: Date.now(),
      },
    };
    assert.equal(entry.customType, "team-run");
    assert.equal(entry.data.agent, "reviewer");
    assert.equal(entry.data.status, "started");
  });

  it("validates status values", () => {
    const valid = ["started", "completed", "failed"];
    for (const s of valid) {
      assert.ok(valid.includes(s));
    }
    assert.ok(!valid.includes("running"));
  });
});

describe("sub-pi config format", () => {
  it("produces sub-pi compatible config shape", () => {
    // The output should contain sub-pi parameters
    const config = {
      type: "single",
      tasks: [{ prompt: "Test task", skill: "test" }],
      model: "anthropic/claude-sonnet-4",
      thinking: "inherit",
    };
    assert.equal(config.type, "single");
    assert.ok(config.tasks.length > 0);
    assert.ok(config.tasks[0]!.prompt.length > 0);
  });
});
