import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

function parsePlanAlias(input: string): { mode?: string; query?: string } {
  const trimmed = input.trim();
  if (!trimmed) return {};
  const [first, ...rest] = trimmed.split(/\s+/);
  if (first === "on" || first === "off") return { mode: first };
  return { query: trimmed };
}

describe("plan alias parsing", () => {
  it("parses on/off and query inputs", () => {
    assert.deepEqual(parsePlanAlias("on"), { mode: "on" });
    assert.deepEqual(parsePlanAlias("off"), { mode: "off" });
    assert.deepEqual(parsePlanAlias("auth refactor"), { query: "auth refactor" });
  });
});
