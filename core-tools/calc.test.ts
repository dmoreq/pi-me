/**
 * Tests for calc tool — mathematical expression validation and evaluation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

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
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(expr)) return `Unsafe token detected: ${pattern.source.replace(/\\b/g, "")}`;
  }
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
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return "Unmatched closing parenthesis";
  }
  if (depth !== 0) return "Unmatched opening parenthesis";
  return null;
}

function evaluateExpression(expr: string): string {
  const error = validateExpression(expr);
  if (error) return `Error: ${error}`;

  const sandbox: Record<string, unknown> = {};
  for (const key of ALLOWED_IDENTIFIERS) {
    if (key in Math) sandbox[key] = (Math as unknown as Record<string, unknown>)[key];
  }

  try {
    const fn = new Function(...Object.keys(sandbox), `"use strict"; return (${expr});`);
    const result = fn(...Object.values(sandbox));
    if (typeof result === "number") {
      if (!Number.isFinite(result)) return String(result);
      if (Number.isInteger(result) && Math.abs(result) < 1e15) return String(result);
      return String(Number(result.toFixed(10)));
    }
    return String(result);
  } catch (err: unknown) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

describe("calc", () => {
  describe("basic arithmetic", () => {
    it("evaluates addition", () => {
      assert.equal(evaluateExpression("2 + 3"), "5");
    });

    it("evaluates subtraction", () => {
      assert.equal(evaluateExpression("10 - 4"), "6");
    });

    it("evaluates multiplication", () => {
      assert.equal(evaluateExpression("6 * 7"), "42");
    });

    it("evaluates division", () => {
      assert.equal(evaluateExpression("15 / 3"), "5");
    });

    it("evaluates exponentiation", () => {
      assert.equal(evaluateExpression("2 ** 10"), "1024");
    });

    it("evaluates modulo", () => {
      assert.equal(evaluateExpression("17 % 5"), "2");
    });
  });

  describe("order of operations", () => {
    it("respects PEMDAS", () => {
      assert.equal(evaluateExpression("2 + 3 * 4"), "14");
    });

    it("respects parentheses", () => {
      assert.equal(evaluateExpression("(2 + 3) * 4"), "20");
    });

    it("handles nested parentheses", () => {
      assert.equal(evaluateExpression("((2 + 3) * 2) / 5"), "2");
    });
  });

  describe("math functions", () => {
    it("evaluates sqrt", () => {
      assert.equal(evaluateExpression("sqrt(16)"), "4");
    });

    it("evaluates sin", () => {
      const result = Number(evaluateExpression("sin(PI / 2)"));
      assert.ok(Math.abs(result - 1) < 0.0000000001);
    });

    it("evaluates cos", () => {
      const result = Number(evaluateExpression("cos(0)"));
      assert.ok(Math.abs(result - 1) < 0.0000000001);
    });

    it("evaluates abs", () => {
      assert.equal(evaluateExpression("abs(-42)"), "42");
    });

    it("evaluates log", () => {
      assert.equal(evaluateExpression("log2(8)"), "3");
    });

    it("evaluates pow", () => {
      assert.equal(evaluateExpression("pow(3, 4)"), "81");
    });

    it("evaluates round", () => {
      assert.equal(evaluateExpression("round(3.7)"), "4");
    });

    it("evaluates floor", () => {
      assert.equal(evaluateExpression("floor(3.9)"), "3");
    });

    it("evaluates ceil", () => {
      assert.equal(evaluateExpression("ceil(3.1)"), "4");
    });
  });

  describe("constants", () => {
    it("has PI", () => {
      const result = Number(evaluateExpression("PI"));
      assert.ok(Math.abs(result - Math.PI) < 0.0000000001);
    });

    it("has E", () => {
      const result = Number(evaluateExpression("E"));
      assert.ok(Math.abs(result - Math.E) < 0.0000000001);
    });
  });

  describe("floating point", () => {
    it("handles decimal results", () => {
      const result = evaluateExpression("10 / 3");
      assert.ok(result.startsWith("3.33333333"));
    });

    it("handles very small numbers", () => {
      const result = evaluateExpression("1 / 1000000");
      assert.equal(Number(result), 0.000001);
    });
  });

  describe("validation", () => {
    it("blocks require", () => {
      const result = evaluateExpression("require('fs')");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks process", () => {
      const result = evaluateExpression("process.exit()");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks eval", () => {
      const result = evaluateExpression("eval('1+1')");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks Function constructor", () => {
      const result = evaluateExpression("Function('return 1')");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks unknown identifiers", () => {
      const result = evaluateExpression("someUndefinedVariable + 1");
      assert.ok(result.startsWith("Error: Unknown identifier"));
    });

    it("blocks unmatched closing parenthesis", () => {
      const result = evaluateExpression("1 + 2)");
      assert.ok(result.startsWith("Error: Unmatched closing"));
    });

    it("blocks unmatched opening parenthesis", () => {
      const result = evaluateExpression("(1 + 2");
      assert.ok(result.startsWith("Error: Unmatched opening"));
    });

    it("blocks fetch", () => {
      const result = evaluateExpression("fetch('http://evil.com')");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks __proto__", () => {
      const result = evaluateExpression("({}).__proto__");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });

    it("blocks constructor access", () => {
      const result = evaluateExpression("({}).constructor");
      assert.ok(result.startsWith("Error: Unsafe token"));
    });
  });

  describe("edge cases", () => {
    it("handles division by zero", () => {
      assert.equal(evaluateExpression("1 / 0"), "Infinity");
    });

    it("handles negative zero scenarios", () => {
      assert.equal(evaluateExpression("0 / -1"), "0");
    });

    it("handles deep nesting", () => {
      assert.equal(evaluateExpression("((((1 + 1) * 2) + 3) * 4)"), "28");
    });

    it("handles negative numbers", () => {
      assert.equal(evaluateExpression("-5 + 3"), "-2");
    });
  });
});
