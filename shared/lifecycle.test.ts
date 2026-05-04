/**
 * ExtensionLifecycle — unit tests
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ExtensionLifecycle } from "./lifecycle.ts";

// ── Minimal pi stub ──────────────────────────────────────────────────────────

function makePi(registeredEvents: string[] = []) {
	return {
		on: (event: string, _fn: Function) => { registeredEvents.push(event); },
		registerTool: () => {},
		registerCommand: () => {},
		sendMessage: () => {},
	} as any;
}

// ── Concrete subclasses for testing ──────────────────────────────────────────

class AllHooksExtension extends ExtensionLifecycle {
	readonly name = "test-all";
	readonly version = "1.0.0";
	protected readonly tools = ["my_tool"];
	protected readonly events = ["session_start"];
	protected readonly description = "test extension";

	async onSessionStart() {}
	async onSessionShutdown() {}
	async onInput() { return { action: "continue" as const }; }
	async onTurnStart() {}
	async onTurnEnd() {}
	async onAgentStart() {}
	async onAgentEnd() {}
	async onToolCall() {}
	async onToolResult() {}
}

class NoHooksExtension extends ExtensionLifecycle {
	readonly name = "test-none";
	readonly version = "1.0.0";
}

class PartialHooksExtension extends ExtensionLifecycle {
	readonly name = "test-partial";
	readonly version = "1.0.0";
	async onSessionStart() {}
	async onTurnEnd() {}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ExtensionLifecycle", () => {
	it("register() wires all hooks that the subclass defines", () => {
		const wired: string[] = [];
		const pi = makePi(wired);
		new AllHooksExtension(pi).register();
		const expected = [
			"session_start", "session_shutdown", "input",
			"turn_start", "turn_end", "agent_start", "agent_end",
			"tool_call", "tool_result",
		];
		for (const ev of expected) {
			assert.ok(wired.includes(ev), `expected event "${ev}" to be wired`);
		}
		assert.strictEqual(wired.length, 9);
	});

	it("register() does NOT wire hooks that are undefined", () => {
		const wired: string[] = [];
		const pi = makePi(wired);
		new NoHooksExtension(pi).register();
		assert.strictEqual(wired.length, 0);
	});

	it("register() wires only the hooks that partial subclass defines", () => {
		const wired: string[] = [];
		const pi = makePi(wired);
		new PartialHooksExtension(pi).register();
		assert.deepStrictEqual(wired.sort(), ["session_start", "turn_end"].sort());
	});

	it("register() is safe when called multiple times (no duplicate wiring check — pi deduplicates)", () => {
		const wired: string[] = [];
		const pi = makePi(wired);
		const ext = new PartialHooksExtension(pi);
		ext.register();
		ext.register(); // second call
		// Should have 4 registrations (2 × 2 hooks) — pi itself deduplicates if needed
		assert.strictEqual(wired.length, 4);
	});

	it("notify() does not throw when telemetry is null (no-op)", () => {
		const pi = makePi();
		const ext = new NoHooksExtension(pi);
		ext.register();
		// getTelemetry() returns null in test environment
		assert.doesNotThrow(() => (ext as any).notify("hello"));
	});

	it("track() does not throw when telemetry is null (no-op)", () => {
		const pi = makePi();
		const ext = new NoHooksExtension(pi);
		ext.register();
		assert.doesNotThrow(() => (ext as any).track("some_event", { count: 1 }));
	});
});
