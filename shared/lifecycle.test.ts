import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { ExtensionLifecycle } from "./lifecycle.ts";

class TestLifecycle extends ExtensionLifecycle {
  readonly name = "test";
  readonly version = "1.0.0";
}

class TestLifecycleWithBeforeStart extends ExtensionLifecycle {
  readonly name = "test";
  readonly version = "1.0.0";
  async onBeforeAgentStart() {
    return { systemPrompt: "hello" };
  }
}

describe("ExtensionLifecycle", () => {
  it("registers before_agent_start when subclass defines onBeforeAgentStart", () => {
    const events: string[] = [];
    const pi = {
      on(event: string) {
        events.push(event);
      },
    } as any;

    new TestLifecycleWithBeforeStart(pi).register();

    assert.ok(events.includes("before_agent_start"));
  });

  it("does not register before_agent_start when subclass omits it", () => {
    const events: string[] = [];
    const pi = {
      on(event: string) {
        events.push(event);
      },
    } as any;

    new TestLifecycle(pi).register();

    assert.ok(!events.includes("before_agent_start"));
  });
});
