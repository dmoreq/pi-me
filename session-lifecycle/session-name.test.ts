/**
 * session-name — unit tests for sessionNameFromMessage pure function
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionNameFromMessage } from "./session-name.ts";

describe("sessionNameFromMessage", () => {
	it("returns plain text as-is", () => {
		assert.strictEqual(sessionNameFromMessage("fix the auth bug"), "fix the auth bug");
	});

	it("strips leading slash command prefix", () => {
		const result = sessionNameFromMessage("/handoff implement teams feature");
		assert.strictEqual(result, "implement teams feature");
	});

	it("strips slash-only prefix", () => {
		const result = sessionNameFromMessage("/recap");
		assert.strictEqual(result, "recap");
	});

	it("truncates long messages at word boundary", () => {
		const long = "word ".repeat(20).trim(); // 99 chars
		const result = sessionNameFromMessage(long);
		assert.ok(result.length <= 60, `expected ≤60 chars, got ${result.length}`);
		assert.ok(!result.endsWith(" "), "should not end with space");
	});

	it("truncates hard at 60 when no word boundary found after pos 20", () => {
		const long = "a".repeat(80);
		const result = sessionNameFromMessage(long);
		assert.strictEqual(result.length, 60);
	});

	it("returns date-based fallback for empty input", () => {
		const result = sessionNameFromMessage("");
		assert.ok(result.startsWith("Session "), `expected 'Session ...' fallback, got: ${result}`);
	});
});
