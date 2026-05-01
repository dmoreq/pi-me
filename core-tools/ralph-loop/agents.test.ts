/**
 * Tests for ralph-loop agent discovery.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("ralph-loop agents", () => {
  describe("frontmatter parsing", () => {
    function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
      const frontmatter: Record<string, string> = {};
      const normalized = content.replace(/\r\n/g, "\n");

      if (!normalized.startsWith("---")) {
        return { frontmatter, body: normalized };
      }

      const endIndex = normalized.indexOf("\n---", 3);
      if (endIndex === -1) {
        return { frontmatter, body: normalized };
      }

      const frontmatterBlock = normalized.slice(4, endIndex);
      const body = normalized.slice(endIndex + 4).trim();

      for (const line of frontmatterBlock.split("\n")) {
        const match = line.match(/^([\w-]+):\s*(.*)$/);
        if (match) {
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          frontmatter[match[1]] = value;
        }
      }

      return { frontmatter, body };
    }

    it("parses simple frontmatter", () => {
      const md = `---
name: test-agent
description: A test agent
---

This is the system prompt.`;
      const result = parseFrontmatter(md);
      assert.deepEqual(result.frontmatter, { name: "test-agent", description: "A test agent" });
      assert.equal(result.body, "This is the system prompt.");
    });

    it("handles quoted values", () => {
      const md = `---
name: "test agent"
description: 'Does things'
---

Prompt here.`;
      const result = parseFrontmatter(md);
      assert.equal(result.frontmatter.name, "test agent");
      assert.equal(result.frontmatter.description, "Does things");
    });

    it("handles missing frontmatter", () => {
      const md = `Just a regular markdown file without frontmatter.`;
      const result = parseFrontmatter(md);
      assert.deepEqual(result.frontmatter, {});
      assert.equal(result.body, md);
    });

    it("handles broken frontmatter (no closing ---)", () => {
      const md = `---
name: test
description: broken

No closing delimiter.`;
      const result = parseFrontmatter(md);
      assert.deepEqual(result.frontmatter, {});
    });

    it("handles frontmatter with custom tools and model", () => {
      const md = `---
name: code-reviewer
description: Reviews code for quality
tools: read,bash,edit
custom-tools: lsp
model: claude-opus-4-5
permission-level: medium
---

You are a code reviewer. Review carefully.`;
      const result = parseFrontmatter(md);
      assert.deepEqual(result.frontmatter, {
        name: "code-reviewer",
        description: "Reviews code for quality",
        tools: "read,bash,edit",
        "custom-tools": "lsp",
        model: "claude-opus-4-5",
        "permission-level": "medium",
      });
    });

    it("handles multi-line body", () => {
      const md = `---
name: multi
description: A multi-line body agent
---

Line 1 of prompt.
Line 2 of prompt.
Line 3 of prompt.`;
      const result = parseFrontmatter(md);
      assert.equal(result.body, "Line 1 of prompt.\nLine 2 of prompt.\nLine 3 of prompt.");
    });
  });
});
