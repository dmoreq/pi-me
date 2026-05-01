/**
 * Tests for DCP Error Purging Rule
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { registerRule, clearRegistry } from "../registry";
import { errorPurgingRule } from "../rules/error-purging";
import { applyPruningWorkflow } from "../workflow";
import type { DcpConfigWithPruneRuleObjects } from "../types";

const config: DcpConfigWithPruneRuleObjects = {
	enabled: true,
	debug: false,
	rules: [errorPurgingRule],
	keepRecentCount: 0,
};

describe("Error Purging Rule", () => {
	before(() => {
		clearRegistry();
		registerRule(errorPurgingRule);
	});

	it("should remove resolved errors from context", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "file.txt" },
				content: [{ type: "text", text: "Failed to write file" }],
				isError: true,
			},
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "file.txt" },
				content: [{ type: "text", text: "File written successfully" }],
				isError: false,
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 1); // Error pruned, success kept
	});

	it("should keep unresolved errors", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "read",
				details: { path: "missing.txt" },
				content: [{ type: "text", text: "Error: File not found" }],
				isError: true,
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 1); // Unresolved error kept
	});

	it("should not prune non-error messages", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{
				role: "toolResult",
				toolName: "read",
				content: [{ type: "text", text: "File content here" }],
				isError: false,
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 2);
	});

	it("should handle multiple errors where some are resolved", () => {
		const messages = [
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "a.txt" },
				content: [{ type: "text", text: "Failed" }],
				isError: true,
			},
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "a.txt" },
				content: [{ type: "text", text: "Success" }],
				isError: false,
			},
			{
				role: "toolResult",
				toolName: "write",
				details: { path: "b.txt" },
				content: [{ type: "text", text: "Failed" }],
				isError: true,
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 2); // a.txt error pruned, a.txt success kept, b.txt error kept (unresolved)
	});
});
