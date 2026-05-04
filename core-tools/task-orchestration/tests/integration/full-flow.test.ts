/**
 * Task Orchestration v2: Full Integration Flow Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createExtension } from "../../src/index";

function makePi() {
  const handlers: Record<string, Function[]> = {};
  const tools: Record<string, any> = {};
  return {
    handlers, tools,
    on: (event: string, fn: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },
    registerTool: (config: any) => { tools[config.name || config] = config; },
    exec: async () => ({ exitCode: 0, stdout: "Done" }),
    ui: { setNotification: () => {}, setWidget: () => {} },
  } as any;
}

describe("Full Integration Flow", () => {
  let pi: any;
  beforeEach(() => { pi = makePi(); });

  it("should register hooks on creation", () => {
    createExtension(pi);
    assert.ok(Object.keys(pi.handlers).length > 0, "should register at least one hook");
  });

  it("should register task_control tool", () => {
    createExtension(pi);
    assert.ok(
      Object.keys(pi.tools).some(k => k.includes("task")),
      "should register a task-related tool"
    );
  });

  it("should respond to agent_end event", async () => {
    createExtension(pi);
    const agentEndHandlers = pi.handlers["agent_end"] ?? [];
    // Can be invoked without throwing
    for (const h of agentEndHandlers) {
      await assert.doesNotReject(async () => h({}, { messages: [] }));
    }
  });
});
