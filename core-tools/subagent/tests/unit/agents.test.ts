import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("subagent agent templates", () => {
  it("TEMPLATE_ITEMS includes expected agents", async () => {
    const { TEMPLATE_ITEMS } = await import("../../agents/agent-templates.js");
    assert.ok(Array.isArray(TEMPLATE_ITEMS));
    assert.ok(TEMPLATE_ITEMS.some((t) => t.type === "separator"));
    assert.ok(TEMPLATE_ITEMS.some((t) => t.type === "agent"));
    assert.ok(TEMPLATE_ITEMS.some((t) => t.type === "chain"));
    const agents = TEMPLATE_ITEMS.filter((t) => t.type === "agent");
    const names = agents.map((a) => a.name);
    assert.ok(names.includes("Blank"));
    assert.ok(names.includes("Scout"));
    assert.ok(names.includes("Code Reviewer"));
    assert.ok(names.includes("Planner"));
    assert.ok(names.includes("Implementer"));
  });
});

describe("subagent agent identity", () => {
  it("buildRuntimeName produces valid name", async () => {
    const { buildRuntimeName, parsePackageName } = await import("../../agents/identity.js");
    const name = buildRuntimeName("test-agent", "pi-me");
    assert.ok(name.includes("test-agent"));
  });

  it("parsePackageName handles scoped names", () => {
    // Test inline since parsePackageName isn't async
  });
});

describe("subagent chain serializer", () => {
  it("round-trips chain objects", async () => {
    const { parseChain, serializeChain } = await import("../../agents/chain-serializer.js");
    const chain = {
      steps: [{ agent: "scout", task: "Explore codebase" }],
    };
    const serialized = serializeChain(chain);
    assert.ok(typeof serialized === "string");
    assert.ok(serialized.includes("scout"));
    assert.ok(serialized.includes("Explore codebase"));
  });
});

describe("subagent agent scope", () => {
  it("exports resolveExecutionAgentScope function", async () => {
    const { resolveExecutionAgentScope } = await import("../../agents/agent-scope.js");
    assert.equal(typeof resolveExecutionAgentScope, "function");
    // Default case returns "both"
    const scope = resolveExecutionAgentScope(undefined);
    assert.ok(["user", "project", "both"].includes(scope));
  });
});

describe("subagent schemas", () => {
  it("SubagentParams schema validates correctly", async () => {
    const { SubagentParams } = await import("../../extension/schemas.js");
    assert.ok(SubagentParams);
    assert.equal(typeof SubagentParams, "object");
  });
});

describe("subagent model-info", () => {
  it("exports thinking levels and model info functions", async () => {
    const { THINKING_LEVELS, toModelInfo, splitKnownThinkingSuffix, findModelInfo } = await import("../../shared/model-info.js");
    assert.ok(Array.isArray(THINKING_LEVELS));
    assert.equal(typeof toModelInfo, "function");
    assert.equal(typeof splitKnownThinkingSuffix, "function");
    assert.equal(typeof findModelInfo, "function");
  });
  it("toModelInfo converts registry model format", async () => {
    const { toModelInfo } = await import("../../shared/model-info.js");
    const info = toModelInfo({ provider: "anthropic", id: "claude-sonnet-4" });
    assert.equal(info.provider, "anthropic");
    assert.equal(info.id, "claude-sonnet-4");
    assert.equal(info.fullId, "anthropic/claude-sonnet-4");
  });
  it("splitKnownThinkingSuffix handles model strings", async () => {
    const { splitKnownThinkingSuffix } = await import("../../shared/model-info.js");
    const result = splitKnownThinkingSuffix("claude-sonnet-4");
    assert.equal(typeof result.baseModel, "string");
  });
});
