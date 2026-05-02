import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("subagent shared types", () => {
  it("exports expected constants", async () => {
    const types = await import("../../shared/types.js");
    assert.equal(typeof types.WIDGET_KEY, "string");
    assert.equal(typeof types.ASYNC_DIR, "string");
    assert.equal(typeof types.RESULTS_DIR, "string");
    assert.equal(typeof types.SUBAGENT_ASYNC_COMPLETE_EVENT, "string");
    assert.equal(typeof types.SUBAGENT_ASYNC_STARTED_EVENT, "string");
    assert.equal(typeof types.SUBAGENT_CONTROL_EVENT, "string");
    assert.equal(typeof types.SLASH_RESULT_TYPE, "string");
    assert.equal(typeof types.DEFAULT_ARTIFACT_CONFIG, "object");
    assert.equal(typeof types.TEMP_ROOT_DIR, "string");
  });

  it("truncateOutput with in-limits output returns unchanged", async () => {
    const { truncateOutput } = await import("../../shared/types.js");
    const result = truncateOutput("Hello world", { bytes: 100000, lines: 100 });
    assert.equal(result.truncated, false);
    assert.equal(result.text, "Hello world");
  });

  it("truncateOutput truncates by lines", async () => {
    const { truncateOutput } = await import("../../shared/types.js");
    const input = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const result = truncateOutput(input, { bytes: 100000, lines: 10 });
    assert.equal(result.truncated, true);
    assert.ok(result.text.includes("TRUNCATED"));
    assert.ok(result.text.includes("line 0"));
    assert.ok(!result.text.includes("line 20"));
  });

  it("checkSubagentDepth blocks at configured depth", async () => {
    const { checkSubagentDepth, getSubagentDepthEnv } = await import("../../shared/types.js");
    const blocked = checkSubagentDepth(0);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.depth, 0);
    assert.equal(blocked.maxDepth, 0);
  });

  it("getSubagentDepthEnv increments depth", async () => {
    const { getSubagentDepthEnv } = await import("../../shared/types.js");
    const env = getSubagentDepthEnv(5);
    assert.ok(env.PI_SUBAGENT_DEPTH);
    assert.ok(env.PI_SUBAGENT_MAX_DEPTH);
  });
});

describe("subagent formatters", () => {
  it("formatDuration formats milliseconds", async () => {
    const { formatDuration, shortenPath } = await import("../../shared/formatters.js");
    const dur = formatDuration(5000);
    assert.ok(dur.includes("5s") || dur.includes("5"));
  });

  it("shortenPath replaces home with tilde", async () => {
    const { shortenPath } = await import("../../shared/formatters.js");
    const home = process.env.HOME || "/home/user";
    const short = shortenPath(`${home}/project/file.ts`);
    assert.ok(short.startsWith("~"));
    assert.ok(short.includes("project/file.ts"));
  });
});
