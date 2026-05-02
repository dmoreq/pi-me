/**
 * Tests for Context Pruning Superseded Writes Rule
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { registerRule, clearRegistry } from "../registry";
import { supersededWritesRule } from "../rules/superseded-writes";
import { applyPruningWorkflow } from "../workflow";
import type { PruningConfigWithRuleObjects } from "../types";

const config: PruningConfigWithRuleObjects = {
	enabled: true,
	debug: false,
	rules: [supersededWritesRule],
	keepRecentCount: 0,
};

describe("Superseded Writes Rule", () => {
	before(() => {
		clearRegistry();
		registerRule(supersededWritesRule);
	});

	it("should remove older writes to the same file", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "write",
				content: [{ type: "text", text: "Written file v1.txt" }],
			},
			{
				role: "toolResult",
				toolName: "write",
				content: [{ type: "text", text: "Written file v2.txt" }],
				isError: false,
			} as any,
		] as any;

		// Manually set details.path since extractFilePath checks it
		messages[0].details = { path: "file.txt" };
		messages[1].details = { path: "file.txt" };

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 1); // Later write kept, earlier pruned
	});

	it("should keep writes to different files", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "a.txt" },
				content: [{ type: "text", text: "File A" }],
			},
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "b.txt" },
				content: [{ type: "text", text: "File B" }],
			},
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "c.txt" },
				content: [{ type: "text", text: "File C" }],
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 3); // All kept (different files)
	});

	it("should handle edit operations like write", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "edit",
				details: { path: "file.txt" },
				content: [{ type: "text", text: "Edit v1" }],
			},
			{
				role: "toolResult",
				toolName: "edit",
				details: { path: "file.txt" },
				content: [{ type: "text", text: "Edit v2" }],
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 1); // Later edit kept
	});

	it("should keep non-file operations", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "How are you?" },
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 3);
	});
});
