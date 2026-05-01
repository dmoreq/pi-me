/**
 * pi-me: calc — Safe mathematical expression evaluator.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

const CalcParams = Type.Object({
	expression: Type.String({ description: "Mathematical expression to evaluate" }),
});

const ALLOWED_IDENTIFIERS = new Set([
	"PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT1_2", "SQRT2",
	"abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
	"cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor",
	"fround", "hypot", "imul", "log", "log1p", "log10", "log2",
	"max", "min", "pow", "random", "round", "sign", "sin", "sinh",
	"sqrt", "tan", "tanh", "trunc",
]);

const UNSAFE_PATTERNS = [
	/\brequire\b/, /\bimport\b/, /\bprocess\b/, /\bglobal\b/, /\bglobalThis\b/,
	/\bwindow\b/, /\bdocument\b/, /\bfetch\b/, /\bFunction\b/, /\beval\b/,
	/\bsetTimeout\b/, /\bsetInterval\b/, /\bconstructor\b/, /\bprototype\b/,
	/\b__proto__\b/, /\bProxy\b/, /\bReflect\b/,
];

function validateExpression(expr: string): string | null {
	for (const pattern of UNSAFE_PATTERNS) { if (pattern.test(expr)) return `Unsafe token detected: ${pattern.source.replace(/\\b/g, "")}`; }
	const identifierPattern = /[a-zA-Z_]\w*/g;
	let match: RegExpExecArray | null;
	while ((match = identifierPattern.exec(expr)) !== null) {
		const id = match[0];
		if (/^\d+$/.test(id)) continue;
		const prevChar = match.index > 0 ? expr[match.index - 1] : "";
		if (prevChar === ".") continue;
		if (!ALLOWED_IDENTIFIERS.has(id)) return `Unknown identifier: ${id}`;
	}
	let depth = 0;
	for (const ch of expr) { if (ch === "(") depth++; if (ch === ")") depth--; if (depth < 0) return "Unmatched closing parenthesis"; }
	if (depth !== 0) return "Unmatched opening parenthesis";
	return null;
}

function evaluateMathExpression(expression: string): string {
	const error = validateExpression(expression);
	if (error) return `Error: ${error}`;

	const sandbox: Record<string, unknown> = {};
	for (const key of ALLOWED_IDENTIFIERS) { if (key in Math) sandbox[key] = (Math as unknown as Record<string, unknown>)[key]; }

	try {
		const fn = new Function(...Object.keys(sandbox), `"use strict"; return (${expression});`);
		const result = fn(...Object.values(sandbox));
		if (typeof result === "number") {
			if (!Number.isFinite(result)) return String(result);
			if (Number.isInteger(result) && Math.abs(result) < 1e15) return String(result);
			return String(Number(result.toFixed(10)));
		}
		return String(result);
	} catch (err: unknown) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
}

export function registerCalc(pi: ExtensionAPI) {
	pi.registerTool({
		name: "calc", label: "Calculator",
		description: "Evaluate a mathematical expression. Supports +, -, *, /, %, **, and Math functions (sin, cos, sqrt, log, etc.).",
		parameters: CalcParams,
		async execute(_toolCallId, params) {
			const result = evaluateMathExpression(params.expression);
			return { content: [{ type: "text", text: result }], details: { expression: params.expression } };
		},
	});
}

export default registerCalc;
