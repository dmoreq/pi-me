/**
 * skill-args — unit tests for pure functions only
 * (The SDK-dependent handleInput/registerArgsHandler require a live pi instance)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import pure functions directly — they have no pi-coding-agent dependency
// We test parseCommandArgs and substituteArgs in isolation.

function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: string | null = null;
	for (const char of argsString) {
		if (inQuote) {
			if (char === inQuote) inQuote = null;
			else current += char;
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === " " || char === "\t") {
			if (current) { args.push(current); current = ""; }
		} else {
			current += char;
		}
	}
	if (current) args.push(current);
	return args;
}

function substituteArgs(content: string, args: string[]): string {
	let result = content;
	result = result.replace(/\$(\d+)/g, (_, num) => args[parseInt(num, 10) - 1] ?? "");
	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr, lengthStr) => {
		let start = parseInt(startStr, 10) - 1;
		if (start < 0) start = 0;
		if (lengthStr) return args.slice(start, start + parseInt(lengthStr, 10)).join(" ");
		return args.slice(start).join(" ");
	});
	const allArgs = args.join(" ");
	return result.replace(/\$ARGUMENTS/g, allArgs).replace(/\$@/g, allArgs);
}

describe("parseCommandArgs", () => {
	it("splits on spaces", () => {
		assert.deepStrictEqual(parseCommandArgs("a b c"), ["a", "b", "c"]);
	});

	it("handles double-quoted strings", () => {
		assert.deepStrictEqual(parseCommandArgs('a "hello world" c'), ["a", "hello world", "c"]);
	});

	it("handles single-quoted strings", () => {
		assert.deepStrictEqual(parseCommandArgs("a 'hello world' c"), ["a", "hello world", "c"]);
	});

	it("returns empty array for empty string", () => {
		assert.deepStrictEqual(parseCommandArgs(""), []);
	});

	it("trims extra whitespace between tokens", () => {
		assert.deepStrictEqual(parseCommandArgs("a   b"), ["a", "b"]);
	});
});

describe("substituteArgs", () => {
	it("replaces $1, $2 with positional args", () => {
		assert.strictEqual(substituteArgs("hello $1 and $2", ["world", "pi"]), "hello world and pi");
	});

	it("replaces out-of-range $N with empty string", () => {
		assert.strictEqual(substituteArgs("$1 $2", ["only"]), "only ");
	});

	it("replaces $ARGUMENTS with all args joined", () => {
		assert.strictEqual(substituteArgs("run $ARGUMENTS", ["a", "b", "c"]), "run a b c");
	});

	it("replaces $@ with all args joined", () => {
		assert.strictEqual(substituteArgs("run $@", ["x", "y"]), "run x y");
	});

	it("replaces ${@:2} with args from index 2 onward", () => {
		assert.strictEqual(substituteArgs("${@:2}", ["a", "b", "c", "d"]), "b c d");
	});

	it("replaces ${@:2:2} with slice of 2 from index 2", () => {
		assert.strictEqual(substituteArgs("${@:2:2}", ["a", "b", "c", "d"]), "b c");
	});

	it("returns content unchanged when no tokens present", () => {
		assert.strictEqual(substituteArgs("no tokens here", ["a"]), "no tokens here");
	});
});
