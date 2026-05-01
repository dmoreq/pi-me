import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePlanId,
  formatPlanId,
  normalizePlanId,
  displayPlanId,
  isPlanCompleted,
  findJsonObjectEnd,
  splitFrontMatter,
  parseFrontMatter,
  serializePlan,
  isSafeCommand,
  sortPlans,
  filterPlans,
  listPlansSync,
  PLAN_ID_PREFIX,
  PLAN_ID_PATTERN,
  type PlanFrontMatter,
  type PlanRecord,
} from "../../plan-mode-core.js";

describe("validatePlanId", () => {
  it("accepts valid hex id", () => {
    const r = validatePlanId("a1b2c3d4");
    assert.ok("id" in r);
    assert.equal((r as { id: string }).id, "a1b2c3d4");
  });

  it("accepts PLAN- prefix", () => {
    const r = validatePlanId("PLAN-a1b2c3d4");
    assert.ok("id" in r);
    assert.equal((r as { id: string }).id, "a1b2c3d4");
  });

  it("rejects non-hex characters", () => {
    const r = validatePlanId("xyz!");
    assert.ok("error" in r);
  });

  it("rejects too-short id", () => {
    const r = validatePlanId("abc");
    assert.ok("error" in r);
  });

  it("rejects too-long id", () => {
    const r = validatePlanId("a1b2c3d4e5");
    assert.ok("error" in r);
  });

  it("rejects empty string", () => {
    const r = validatePlanId("");
    assert.ok("error" in r);
  });
});

describe("formatPlanId", () => {
  it("adds PLAN- prefix", () => {
    assert.equal(formatPlanId("a1b2c3d4"), "PLAN-a1b2c3d4");
  });

  it("keeps existing PLAN- prefix", () => {
    assert.equal(formatPlanId("PLAN-a1b2c3d4"), "PLAN-a1b2c3d4");
  });
});

describe("normalizePlanId", () => {
  it("strips PLAN- prefix", () => {
    assert.equal(normalizePlanId("PLAN-a1b2c3d4"), "a1b2c3d4");
  });

  it("keeps raw hex", () => {
    assert.equal(normalizePlanId("a1b2c3d4"), "a1b2c3d4");
  });
});

describe("displayPlanId", () => {
  it("formats for display", () => {
    assert.equal(displayPlanId("a1b2c3d4"), "PLAN-a1b2c3d4");
  });
});

describe("isPlanCompleted", () => {
  it("completed status returns true", () => {
    assert.equal(isPlanCompleted("completed"), true);
  });

  it("archived status returns true", () => {
    assert.equal(isPlanCompleted("archived"), true);
  });

  it("active status returns false", () => {
    assert.equal(isPlanCompleted("active"), false);
  });

  it("draft status returns false", () => {
    assert.equal(isPlanCompleted("draft"), false);
  });
});

describe("isSafeCommand", () => {
  it("cat is safe", () => {
    assert.equal(isSafeCommand("cat file.txt"), true);
  });

  it("grep is safe", () => {
    assert.equal(isSafeCommand("grep pattern file.txt"), true);
  });

  it("rm is not safe", () => {
    assert.equal(isSafeCommand("rm -rf dir"), false);
  });

  it("git commit is not safe", () => {
    assert.equal(isSafeCommand("git commit -m test"), false);
  });

  it("sudo is not safe", () => {
    assert.equal(isSafeCommand("sudo rm file"), false);
  });

  it("npm install is not safe", () => {
    assert.equal(isSafeCommand("npm install express"), false);
  });
});

describe("findJsonObjectEnd", () => {
  it("finds closing brace of simple JSON", () => {
    const json = "{ \"key\": \"value\" }";
    assert.equal(findJsonObjectEnd(json), json.length - 1);
  });

  it("handles nested braces", () => {
    const json = "{ \"a\": { \"b\": 1 } }";
    assert.equal(findJsonObjectEnd(json), json.length - 1);
  });

  it("handles strings with braces", () => {
    const json = "{ \"key\": \"}{}\" }";
    const end = findJsonObjectEnd(json);
    assert.ok(end > 10);
  });
});

describe("splitFrontMatter", () => {
  it("splits YAML-like frontmatter and body", () => {
    const content = "{\n  \"title\": \"Test\"\n}\n\n# Body text";
    const r = splitFrontMatter(content);
    assert.ok(r.frontMatter.includes("\"title\""));
    assert.ok(r.body.includes("# Body text"));
  });
});

describe("parseFrontMatter", () => {
  it("parses valid plan frontmatter", () => {
    const fm = JSON.stringify({
      id: "a1b2c3d4",
      title: "Test Plan",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      steps: [{ id: 1, text: "Step 1", done: false }],
    });
    const result = parseFrontMatter(fm, "a1b2c3d4");
    assert.equal(result.title, "Test Plan");
    assert.equal(result.status, "active");
    assert.equal(result.steps.length, 1);
  });

  it("uses fallback id when missing", () => {
    const fm = JSON.stringify({
      title: "No Id",
      status: "draft",
      created_at: "2026-01-01T00:00:00.000Z",
      steps: [],
    });
    const result = parseFrontMatter(fm, "fallback");
    assert.equal(result.id, "fallback");
    assert.equal(result.title, "No Id");
  });
});

describe("serializePlan", () => {
  it("serializes to markdown with JSON frontmatter", () => {
    const plan: PlanRecord = {
      id: "a1b2c3d4",
      title: "Test",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      steps: [{ id: 1, text: "Step 1", done: false }],
      body: "Some notes",
    };
    const result = serializePlan(plan);
    assert.ok(result.includes("\"title\": \"Test\""));
    assert.ok(result.includes("Some notes"));
    assert.ok(result.includes("\"status\": \"active\""));
  });
});

describe("sortPlans", () => {
  it("sorts active before draft", () => {
    const plans: PlanFrontMatter[] = [
      { id: "1", title: "Draft", status: "draft", created_at: "2026-01-01T00:00:00.000Z", steps: [] },
      { id: "2", title: "Active", status: "active", created_at: "2026-01-01T00:00:00.000Z", steps: [] },
    ];
    const sorted = sortPlans(plans);
    assert.equal(sorted[0].status, "active");
    assert.equal(sorted[1].status, "draft");
  });

  it("completed plans sort last", () => {
    const plans: PlanFrontMatter[] = [
      { id: "1", title: "Done", status: "completed", created_at: "2026-01-01T00:00:00.000Z", steps: [] },
      { id: "2", title: "Active", status: "active", created_at: "2026-01-01T00:00:00.000Z", steps: [] },
    ];
    const sorted = sortPlans(plans);
    assert.equal(sorted[0].status, "active");
  });
});

describe("filterPlans", () => {
  const plans: PlanFrontMatter[] = [
    { id: "1", title: "Refactor Auth", status: "active", created_at: "2026-01-01T00:00:00.000Z", steps: [] },
    { id: "2", title: "Fix Login Bug", status: "draft", created_at: "2026-01-02T00:00:00.000Z", steps: [] },
    { id: "3", title: "Add Tests", status: "completed", created_at: "2026-01-03T00:00:00.000Z", steps: [] },
  ];

  it("filters by title substring", () => {
    const r = filterPlans(plans, "Auth");
    assert.equal(r.length, 1);
    assert.equal(r[0].title, "Refactor Auth");
  });

  it("returns all for empty query", () => {
    const r = filterPlans(plans, "");
    assert.equal(r.length, 3);
  });

  it("returns empty for no match", () => {
    const r = filterPlans(plans, "foobar");
    assert.equal(r.length, 0);
  });

  it("case insensitive matching", () => {
    const r = filterPlans(plans, "auth");
    assert.equal(r.length, 1);
  });
});

describe("listPlansSync", () => {
  it("returns empty array for non-existent directory", () => {
    const r = listPlansSync("/tmp/pi-me-nonexistent-plans-12345");
    assert.deepEqual(r, []);
  });
});

describe("constants", () => {
  it("PLAN_ID_PREFIX is PLAN-", () => {
    assert.equal(PLAN_ID_PREFIX, "PLAN-");
  });

  it("PLAN_ID_PATTERN matches 8 hex chars", () => {
    assert.ok(PLAN_ID_PATTERN.test("a1b2c3d4"));
    assert.ok(!PLAN_ID_PATTERN.test("xyz"));
    assert.ok(!PLAN_ID_PATTERN.test("a1b2c3d4e5"));
  });
});
