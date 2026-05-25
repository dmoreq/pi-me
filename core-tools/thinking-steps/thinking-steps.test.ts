import { describe, it } from "node:test";
import assert from "node:assert/strict";
import thinkingSteps from "./thinking-steps.ts";

describe("thinking-steps", () => {
  it("exports a function", () => {
    assert.equal(typeof thinkingSteps, "function");
  });

  it("registers and sets status without emojis", async () => {
    const events: Record<string, Function> = {};
    const statusCalls: Array<[string, any]> = [];
    let thinkingLabel: string | undefined;

    const piMock = {
      on(event: string, handler: Function) {
        events[event] = handler;
      },
      registerShortcut() {},
      registerCommand() {},
    } as any;

    thinkingSteps(piMock);

    // Call session_start handler
    const sessionStartHandler = events["session_start"];
    assert.equal(typeof sessionStartHandler, "function");

    const ctxMock = {
      cwd: "/mock-cwd",
      sessionManager: {
        getEntries() {
          return [];
        },
      },
      ui: {
        setHiddenThinkingLabel(label: string) {
          thinkingLabel = label;
        },
        setStatus(key: string, val: any) {
          statusCalls.push([key, val]);
        },
        theme: {
          fg(style: string, text: string) {
            return `fg(${style}, ${text})`;
          },
        },
      },
    } as any;

    await sessionStartHandler({}, ctxMock);

    // Verify setStatus was called without any emoji
    assert.equal(statusCalls.length, 1);
    assert.equal(statusCalls[0][0], "thinking-steps");
    
    const statusValue = statusCalls[0][1];
    // Check that status value does not contain emojis, especially the brain emoji
    assert.ok(!statusValue.includes("🧠"));
    assert.ok(statusValue.includes("Thinking: Summary"));
  });
});
