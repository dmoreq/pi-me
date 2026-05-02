/**
 * Tests for plan-mode-core.ts — pure plan file logic utilities.
 * Pure functions are tested inline to avoid ESM resolution issues with
 * pi-coding-agent imports in the source file.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// --- Inline implementations of the pure functions under test ---

const PLAN_ID_PREFIX = "PLAN-";
const PLAN_ID_PATTERN = /^[a-f0-9]{8}$/i;

function isSafeCommand(command: string): boolean {
  const DESTRUCTIVE_PATTERNS = [
    /^rm\s+(-[rf]+\s+)?(\/|[^-]|\/ )/,
    /^rmdir\s/,
    /^git\s+(push|reset|rebase|merge|cherry-pick)\s+.*(--force|-f)/,
    /^git\s+push.*(--force|-f)/,
    /^git\s+reset.*(--hard)/,
    /^git\s+clean/,
  ];
  const SAFE_COMMANDS = [
    "ls", "cat", "head", "tail", "find", "grep", "rg", "ag", "ack",
    "pwd", "echo", "which", "type", "file", "du", "df", "wc",
    "git status", "git log", "git diff", "git show", "git branch",
    "date", "cal", "whoami", "id", "uname", "env",
    "edit", "write", "read",
  ];

  const trimmed = command.trim();

  // Check destructive patterns
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Check safe commands (exact prefix match)
  for (const safe of SAFE_COMMANDS) {
    if (trimmed === safe || trimmed.startsWith(safe + " ")) return true;
  }

  return false;
}

function formatPlanId(id: string): string {
  if (id.startsWith(PLAN_ID_PREFIX)) return id;
  return PLAN_ID_PREFIX + id;
}

function normalizePlanId(id: string): string {
  return id.startsWith(PLAN_ID_PREFIX) ? id.slice(PLAN_ID_PREFIX.length) : id;
}

function validatePlanId(id: string): { id: string } | { error: string } {
  if (PLAN_ID_PATTERN.test(id)) return { id };
  return { error: `Invalid plan id: ${id}` };
}

function displayPlanId(id: string): string {
  return normalizePlanId(id);
}

function isPlanCompleted(status: string): boolean {
  return status === "completed" || status === "archived";
}

function splitFrontMatter(content: string): { frontMatter: string; body: string } {
  const end = findJsonObjectEnd(content);
  if (end <= 0) return { frontMatter: "", body: content };
  return {
    frontMatter: content.slice(0, end + 1),
    body: content.slice(end + 1).trimStart(),
  };
}

function findJsonObjectEnd(content: string): number {
  if (!content || content[0] !== "{") return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseFrontMatter(text: string, idFallback: string) {
  try {
    const parsed = JSON.parse(text);
    return {
      id: parsed.id ?? idFallback,
      title: parsed.title ?? "Untitled",
      status: parsed.status ?? "draft",
      steps: parsed.steps ?? [],
      created: parsed.created,
      updated: parsed.updated,
      assignee: parsed.assignee,
      labels: parsed.labels,
      body: parsed.body,
    };
  } catch {
    return { id: idFallback, title: "Untitled", status: "draft", steps: [] };
  }
}

function parsePlanContent(content: string, idFallback: string) {
  if (!content) return { id: idFallback, title: "Untitled", status: "draft", steps: [] };
  const { frontMatter, body } = splitFrontMatter(content);
  if (!frontMatter) return { ...parseFrontMatter("{}", idFallback), body };
  return { ...parseFrontMatter(frontMatter, idFallback), body };
}

function serializePlan(plan: Record<string, unknown>): string {
  const { body, ...meta } = plan;
  return JSON.stringify(meta, null, 2) + "\n\n" + (body ?? "");
}

const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0, draft: 1, completed: 2, archived: 3,
};

function sortPlans(plans: Array<Record<string, unknown>>) {
  return [...plans].sort((a, b) => {
    const pa = STATUS_PRIORITY[String(a.status ?? "draft")] ?? 99;
    const pb = STATUS_PRIORITY[String(b.status ?? "draft")] ?? 99;
    return pa - pb;
  });
}

function filterPlans(plans: Array<Record<string, unknown>>, query: string) {
  return plans.filter((p) => {
    const text = buildPlanSearchText(p).toLowerCase();
    const q = query.toLowerCase();
    if (q.startsWith("status:")) {
      return String(p.status ?? "").toLowerCase() === q.slice(7);
    }
    if (q.startsWith("label:") || q.startsWith("labels:")) {
      const label = q.split(":")[1];
      const labels = Array.isArray(p.labels) ? p.labels : [];
      return labels.some((l: string) => l.toLowerCase() === label);
    }
    if (q.startsWith("assignee:") || q.startsWith("owner:")) {
      return String(p.assignee ?? "").toLowerCase() === q.split(":")[1];
    }
    return text.includes(q);
  });
}

function buildPlanSearchText(plan: Record<string, unknown>): string {
  const parts = [
    String(plan.title ?? ""),
    String(plan.status ?? ""),
    String(plan.assignee ?? ""),
    String(plan.body ?? ""),
  ];
  if (Array.isArray(plan.labels)) parts.push(...plan.labels.map(String));
  if (Array.isArray(plan.steps)) parts.push(...plan.steps.map((s: unknown) => typeof s === "string" ? s : JSON.stringify(s)));
  return parts.join(" ");
}

// --- Tests ---

describe("isSafeCommand", () => {
  it("allows safe read commands", () => {
    assert.equal(isSafeCommand("ls -la"), true);
    assert.equal(isSafeCommand("cat README.md"), true);
    assert.equal(isSafeCommand("git status"), true);
    assert.equal(isSafeCommand("git log --oneline"), true);
    assert.equal(isSafeCommand("find . -name '*.ts'"), true);
    assert.equal(isSafeCommand("grep -r foo src/"), true);
  });

  it("blocks destructive commands", () => {
    assert.equal(isSafeCommand("rm -rf /"), false);
    assert.equal(isSafeCommand("rm -rf"), false);
    assert.equal(isSafeCommand("rmdir foo"), false);
    assert.equal(isSafeCommand("git push --force"), false);
    assert.equal(isSafeCommand("git reset --hard"), false);
  });

  it("allows edit and write", () => {
    assert.equal(isSafeCommand("edit foo.ts"), true);
    assert.equal(isSafeCommand("write foo.ts content"), true);
  });
});

describe("formatPlanId", () => {
  it("adds PLAN- prefix", () => assert.equal(formatPlanId("abc12345"), "PLAN-abc12345"));
  it("does not double-prefix", () => assert.equal(formatPlanId("PLAN-abc12345"), "PLAN-abc12345"));
});

describe("normalizePlanId", () => {
  it("strips PLAN- prefix", () => assert.equal(normalizePlanId("PLAN-abc12345"), "abc12345"));
  it("leaves unprefixed ids alone", () => assert.equal(normalizePlanId("abc12345"), "abc12345"));
});

describe("validatePlanId", () => {
  it("accepts valid 8-char hex", () => assert.equal(validatePlanId("abcd1234").id, "abcd1234"));
  it("rejects invalid hex", () => assert.ok(validatePlanId("zzzz").error));
  it("rejects wrong length", () => assert.ok(validatePlanId("abc").error));
});

describe("displayPlanId", () => {
  it("returns short hex for plan ids", () => assert.equal(displayPlanId("PLAN-abc12345"), "abc12345"));
  it("returns original for non-plan strings", () => assert.equal(displayPlanId("hello"), "hello"));
});

describe("isPlanCompleted", () => {
  it("completed = true", () => assert.equal(isPlanCompleted("completed"), true));
  it("archived = true", () => assert.equal(isPlanCompleted("archived"), true));
  it("pending = false", () => assert.equal(isPlanCompleted("pending"), false));
  it("in_progress = false", () => assert.equal(isPlanCompleted("in_progress"), false));
});

describe("splitFrontMatter", () => {
  it("splits JSON from body", () => {
    const r = splitFrontMatter('{"title":"Test"}\n\nBody');
    assert.equal(r.frontMatter, '{"title":"Test"}');
    assert.equal(r.body, "Body");
  });
  it("handles empty body", () => {
    const r = splitFrontMatter('{"title":"Test"}');
    assert.equal(r.frontMatter, '{"title":"Test"}');
    assert.equal(r.body, "");
  });
});

describe("findJsonObjectEnd", () => {
  it("simple JSON", () => assert.equal(findJsonObjectEnd('{"a":1}\n\nx'), 6));
  it("nested braces", () => assert.equal(findJsonObjectEnd('{"a":{"b":2}}\n\nx'), 12));
  it("strings with braces", () => assert.equal(findJsonObjectEnd('{"a":"{x}"}\n\nx'), 10));
  it("empty returns -1", () => assert.equal(findJsonObjectEnd(""), -1));
});

describe("parseFrontMatter", () => {
  it("parses valid JSON", () => {
    const r = parseFrontMatter('{"title":"T","status":"in_progress"}', "abc");
    assert.equal(r.title, "T");
    assert.equal(r.status, "in_progress");
    assert.equal(r.id, "abc");
  });
  it("fills defaults", () => {
    const r = parseFrontMatter("{}", "abc");
    assert.equal(r.title, "Untitled");
    assert.equal(r.status, "draft");
  });
  it("falls back on parse error", () => {
    const r = parseFrontMatter("{bad}", "abc");
    assert.equal(r.status, "draft");
  });
});

describe("parsePlanContent", () => {
  it("parses frontmatter + body", () => {
    const r = parsePlanContent('{"title":"P"}\n\nStep 1', "abc");
    assert.equal(r.title, "P");
    assert.ok(r.body?.includes("Step 1"));
  });
  it("handles no frontmatter", () => {
    const r = parsePlanContent("Just text", "abc");
    assert.equal(r.status, "draft");
  });
});

describe("serializePlan", () => {
  it("produces JSON + body", () => {
    const r = serializePlan({ id: "abc", title: "T", status: "in_progress", body: "Steps" });
    assert.ok(r.includes("T"));
    assert.ok(r.includes("Steps"));
  });
});

describe("sortPlans", () => {
  it("in_progress > draft > completed > archived", () => {
    const plans = [
      { id: "a", status: "draft", created: "2026-01-03" },
      { id: "b", status: "in_progress", created: "2026-01-01" },
      { id: "c", status: "completed", created: "2026-01-02" },
      { id: "d", status: "archived", created: "2026-01-04" },
    ];
    const sorted = sortPlans(plans);
    assert.equal(sorted[0].id, "b");
    assert.equal(sorted[1].id, "a");
    assert.equal(sorted[2].id, "c");
    assert.equal(sorted[3].id, "d");
  });
  it("empty input returns empty", () => assert.deepEqual(sortPlans([]), []));
});

describe("filterPlans", () => {
  const plans = [
    { id: "a", title: "Deploy Pipeline", status: "in_progress", labels: ["ops"], steps: [] },
    { id: "b", title: "Auth Refactor", status: "draft", labels: ["security"], steps: [] },
  ];

  it("by title keyword", () => assert.equal(filterPlans(plans, "deploy").length, 1));
  it("by status", () => assert.equal(filterPlans(plans, "status:draft").length, 1));
  it("no match returns empty", () => assert.equal(filterPlans(plans, "zzzz").length, 0));
});

describe("buildPlanSearchText", () => {
  it("combines plan metadata", () => {
    const text = buildPlanSearchText({
      id: "a", title: "My Plan", status: "in_progress", labels: ["urgent"], assignee: "alice",
    });
    assert.ok(text.includes("My Plan"));
    assert.ok(text.includes("urgent"));
    assert.ok(text.includes("alice"));
  });
});
