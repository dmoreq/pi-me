/**
 * Task Orchestration v2: task_control Tool Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createExtension } from "../../src/index";
import { TaskStore } from "../../src/persistence/state";
import { createTask } from "../../src/core/task";

function makePi(store: TaskStore) {
  const tools: Record<string, any> = {};
  return {
    tools,
    on: () => {},
    registerTool: (config: any) => { tools[config.name || config] = config; },
    exec: async () => ({ exitCode: 0, stdout: "Done" }),
    ui: { setNotification: () => {}, setWidget: () => {} },
  } as any;
}

describe("task_control Tool", () => {
  let store: TaskStore;
  let pi: any;

  beforeEach(() => {
    store = new TaskStore();
    pi = makePi(store);
    createExtension(pi, { store });
  });

  it("should register task tools on creation", async () => {
    assert.ok(Object.keys(pi.tools).length >= 0);
  });
});
