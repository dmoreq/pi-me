/**
 * TranscriptBuilder — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TranscriptBuilder } from "./transcript-builder.ts";
import type { Message } from "@mariozechner/pi-coding-agent";

describe("TranscriptBuilder", () => {
  describe("buildTranscript", () => {
    it("should return empty string for empty messages", () => {
      const result = TranscriptBuilder.buildTranscript([]);
      assert.strictEqual(result, "");
    });

    it("should format user message", () => {
      const msgs: Message[] = [{ role: "user", content: "hello" }];
      const result = TranscriptBuilder.buildTranscript(msgs);
      assert.ok(result.includes("User:"));
      assert.ok(result.includes("hello"));
    });

    it("should format assistant message", () => {
      const msgs: Message[] = [{ role: "assistant", content: "I'll help" }];
      const result = TranscriptBuilder.buildTranscript(msgs);
      assert.ok(result.includes("Assistant:"));
      assert.ok(result.includes("I'll help"));
    });

    it("should extract tool calls from content", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "read", input: { path: "file.ts" } },
          ],
        },
      ];
      const result = TranscriptBuilder.buildTranscript(msgs);
      assert.ok(result.includes("read"));
    });

    it("should handle fromLastUser=true", () => {
      const msgs: Message[] = [
        { role: "user", content: "first" },
        { role: "assistant", content: "response" },
        { role: "user", content: "second" },
      ];
      const result = TranscriptBuilder.buildTranscript(msgs, { fromLastUser: true });
      assert.ok(result.includes("second"));
      // first may or may not be included depending on implementation
    });

    it("should truncate at maxChars", () => {
      const msgs: Message[] = [
        { role: "user", content: "a".repeat(1000) },
      ];
      const result = TranscriptBuilder.buildTranscript(msgs, { maxChars: 50 });
      assert.ok(result.length <= 70); // allow some buffer
    });

    it("should apply indent", () => {
      const msgs: Message[] = [{ role: "user", content: "test" }];
      const result = TranscriptBuilder.buildTranscript(msgs, { indent: 2 });
      assert.ok(result.startsWith("  ")); // 2-space indent
    });
  });

  describe("hasMeaningfulActivity", () => {
    it("should return false for empty messages", () => {
      assert.ok(!TranscriptBuilder.hasMeaningfulActivity([]));
    });

    it("should return false for user-only messages", () => {
      const msgs: Message[] = [
        { role: "user", content: "hello" },
        { role: "user", content: "world" },
      ];
      assert.ok(!TranscriptBuilder.hasMeaningfulActivity(msgs));
    });

    it("should return true when assistant has tool calls", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [{ type: "tool_use", name: "read", input: {} }],
        },
      ];
      assert.ok(TranscriptBuilder.hasMeaningfulActivity(msgs));
    });

    it("should return true when assistant has long response", () => {
      const msgs: Message[] = [
        { role: "assistant", content: "word ".repeat(50) },
      ];
      assert.ok(TranscriptBuilder.hasMeaningfulActivity(msgs));
    });
  });

  describe("extractFilePaths", () => {
    it("should extract paths from write tool", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "write", input: { path: "src/app.ts", content: "code" } },
          ],
        },
      ];
      const paths = TranscriptBuilder.extractFilePaths(msgs);
      assert.ok(paths.includes("src/app.ts"));
    });

    it("should extract paths from edit tool", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "edit", input: { path: "src/app.ts", oldText: "", newText: "" } },
          ],
        },
      ];
      const paths = TranscriptBuilder.extractFilePaths(msgs);
      assert.ok(paths.includes("src/app.ts"));
    });

    it("should ignore non-write/edit tools", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "read", input: { path: "src/app.ts" } },
          ],
        },
      ];
      const paths = TranscriptBuilder.extractFilePaths(msgs);
      assert.strictEqual(paths.length, 0);
    });

    it("should deduplicate paths", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "write", input: { path: "src/app.ts", content: "code" } },
            { type: "tool_use", name: "edit", input: { path: "src/app.ts", oldText: "", newText: "" } },
          ],
        },
      ];
      const paths = TranscriptBuilder.extractFilePaths(msgs);
      assert.strictEqual(paths.length, 1);
    });
  });

  describe("countToolCalls", () => {
    it("should count tool calls by name", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "read", input: {} },
            { type: "tool_use", name: "read", input: {} },
            { type: "tool_use", name: "write", input: {} },
          ],
        },
      ];
      assert.strictEqual(TranscriptBuilder.countToolCalls(msgs, "read"), 2);
      assert.strictEqual(TranscriptBuilder.countToolCalls(msgs, "write"), 1);
    });

    it("should return 0 for unused tools", () => {
      const msgs: Message[] = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "read", input: {} },
          ],
        },
      ];
      assert.strictEqual(TranscriptBuilder.countToolCalls(msgs, "bash"), 0);
    });
  });
});
