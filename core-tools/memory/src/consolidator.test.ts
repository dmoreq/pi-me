import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildConsolidationPrompt,
  parseConsolidationResponse,
  isDerivableOrEphemeral,
  isDerivableLesson,
} from "./consolidator.ts";

describe("buildConsolidationPrompt", () => {
  it("includes conversation messages", () => {
    const prompt = buildConsolidationPrompt({
      userMessages: ["Fix the daily note insertion"],
      assistantMessages: ["I'll use sed instead of echo >>"],
      cwd: "/workplace/samfp/Rosie",
    });
    assert.ok(prompt.includes("Fix the daily note insertion"));
    assert.ok(prompt.includes("sed instead of echo"));
    assert.ok(prompt.includes("/workplace/samfp/Rosie"));
  });

  it("truncates long messages", () => {
    const longMsg = "x".repeat(2000);
    const prompt = buildConsolidationPrompt({
      userMessages: [longMsg],
      assistantMessages: [],
    });
    assert.ok(prompt.length < longMsg.length + 5000);
  });

  it("caps at 30 message pairs", () => {
    const prompt = buildConsolidationPrompt({
      userMessages: Array(50).fill("msg"),
      assistantMessages: Array(50).fill("reply"),
    });
    const userCount = (prompt.match(/User: msg/g) || []).length;
    assert.ok(userCount <= 30);
  });

  it("includes current facts in prompt", () => {
    const prompt = buildConsolidationPrompt(
      { userMessages: ["hello"], assistantMessages: ["hi"] },
      [{ key: "pref.editor", value: "vim" }, { key: "wife", value: "Eryn" }],
      []
    );
    assert.ok(prompt.includes("Current Memory State"));
    assert.ok(prompt.includes("pref.editor: vim"));
    assert.ok(prompt.includes("wife: Eryn"));
  });

  it("includes current lessons in prompt", () => {
    const prompt = buildConsolidationPrompt(
      { userMessages: ["hello"], assistantMessages: ["hi"] },
      [],
      [{ rule: "Never hardcode secrets", category: "security" }]
    );
    assert.ok(prompt.includes("And these lessons"));
    assert.ok(prompt.includes("[security] Never hardcode secrets"));
  });

  it("truncates long values in memory state", () => {
    const longValue = "x".repeat(300);
    const prompt = buildConsolidationPrompt(
      { userMessages: ["hello"], assistantMessages: ["hi"] },
      [{ key: "test.long", value: longValue }],
      []
    );
    assert.ok(prompt.includes("\u2026")); // truncation indicator
    assert.ok(!prompt.includes(longValue)); // full value not present
  });
});

describe("parseConsolidationResponse", () => {
  it("parses valid JSON", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [{ key: "pref.editor", value: "vim", confidence: 0.9 }],
      lessons: [{ rule: "Use sed for daily notes", category: "vault", negative: true }],
    }));
    assert.equal(result.semantic.length, 1);
    assert.equal(result.semantic[0].key, "pref.editor");
    assert.equal(result.lessons.length, 1);
    assert.equal(result.lessons[0].negative, true);
  });

  it("parses JSON in markdown code block", () => {
    const result = parseConsolidationResponse(`Here's what I found:
\`\`\`json
{
  "semantic": [{ "key": "pref.style", "value": "functional", "confidence": 0.85 }],
  "lessons": []
}
\`\`\`
`);
    assert.equal(result.semantic.length, 1);
    assert.equal(result.semantic[0].key, "pref.style");
  });

  it("rejects low confidence", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [{ key: "pref.maybe", value: "unsure", confidence: 0.5 }],
      lessons: [],
    }));
    assert.equal(result.semantic.length, 0);
  });

  it("rejects invalid key format", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [{ key: "INVALID KEY!", value: "bad", confidence: 0.9 }],
      lessons: [],
    }));
    assert.equal(result.semantic.length, 0);
  });

  it("accepts flexible key prefixes like family, health, config", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [
        { key: "family.brother", value: "Joe", confidence: 0.95 },
        { key: "health.allergy", value: "penicillin", confidence: 0.9 },
        { key: "config.theme", value: "dark", confidence: 0.9 },
        { key: "wife", value: "Eryn", confidence: 0.95 },
      ],
      lessons: [],
    }));
    assert.equal(result.semantic.length, 4);
  });

  it("rejects single-char keys", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [{ key: "x", value: "too short", confidence: 0.9 }],
      lessons: [],
    }));
    assert.equal(result.semantic.length, 0);
  });

  it("returns empty for garbage input", () => {
    const result = parseConsolidationResponse("not json at all");
    assert.equal(result.semantic.length, 0);
    assert.equal(result.lessons.length, 0);
  });

  it("returns empty for empty response", () => {
    const result = parseConsolidationResponse("");
    assert.equal(result.semantic.length, 0);
    assert.equal(result.lessons.length, 0);
  });

  it("handles missing fields gracefully", () => {
    const result = parseConsolidationResponse(JSON.stringify({
      semantic: [{ key: "pref.x" }], // missing value and confidence
      lessons: [{}], // missing rule
    }));
    assert.equal(result.semantic.length, 0);
    assert.equal(result.lessons.length, 0);
  });
});

describe("isDerivableOrEphemeral", () => {
  it("does not filter pref.commit_style (workflow preference)", () => {
    assert.equal(isDerivableOrEphemeral("pref.commit_style", "conventional commits"), false);
  });

  it("does not filter tool.commit (tool preference)", () => {
    assert.equal(isDerivableOrEphemeral("tool.commit", "always use --amend"), false);
  });

  it("does not filter pref.git_commit_format (git preference)", () => {
    assert.equal(isDerivableOrEphemeral("pref.git_commit_format", "short"), false);
  });

  it("filters actual git history keys", () => {
    assert.equal(isDerivableOrEphemeral("git.history", "..."), true);
    assert.equal(isDerivableOrEphemeral("git.recent", "..."), true);
    assert.equal(isDerivableOrEphemeral("git.log", "..."), true);
    assert.equal(isDerivableOrEphemeral("git.blame", "..."), true);
  });

  it("filters project commit hash", () => {
    assert.equal(isDerivableOrEphemeral("project.foo.commit_hash", "abc123"), true);
  });
});

describe("isDerivableLesson", () => {
  it("filters file path lessons", () => {
    assert.equal(isDerivableLesson("File config.ts is at path src/config.ts"), true);
  });

  it("filters 'project uses X' lessons", () => {
    assert.equal(isDerivableLesson("The project uses TypeScript"), true);
    assert.equal(isDerivableLesson("The codebase is written in Python"), true);
  });

  it("filters activity logs", () => {
    assert.equal(isDerivableLesson("We fixed the bug today"), true);
    assert.equal(isDerivableLesson("The agent deployed the app"), true);
  });
});
