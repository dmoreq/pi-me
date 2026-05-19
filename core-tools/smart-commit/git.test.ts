import { describe, it } from "bun:test";
import * as assert from "node:assert/strict";
import { isValidConventionalCommit } from "./git.ts";

describe("isValidConventionalCommit", () => {
  const valid = [
    "feat(memory): add prepared statement cache",
    "fix(parser): handle empty input",
    "refactor: remove unused code",
    "chore(deps): update dependencies",
    "docs(readme): fix installation steps",
    "test(smart-commit): add grouper tests",
    "perf(store): optimize Jaccard scan",
    "ci: add GitHub Actions workflow",
    "style(ui): reformat button components",
  ];

  const invalid = [
    "Added some stuff",                        // no type
    "feat: x",                                 // description too short (< 3 chars after ": ")
    "feat(): add something",                   // empty scope
    "FEAT: add something",                     // uppercase type
    "feat add something",                      // missing colon
    "",                                        // empty
    "wip: half done",                          // invalid type
    "feat(memory):",                           // missing description
  ];

  for (const msg of valid) {
    it(`accepts: ${msg}`, () => {
      assert.equal(isValidConventionalCommit(msg), true);
    });
  }

  for (const msg of invalid) {
    it(`rejects: ${msg || "(empty)"}`, () => {
      assert.equal(isValidConventionalCommit(msg), false);
    });
  }
});
