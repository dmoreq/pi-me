/**
 * Tests for secrets obfuscator.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SecretObfuscator } from "./obfuscator.ts";
import type { SecretEntry } from "./types.ts";

describe("SecretObfuscator", () => {
  describe("plain secrets", () => {
    let obfuscator: SecretObfuscator;

    beforeEach(() => {
      obfuscator = new SecretObfuscator([
        { type: "plain", content: "sk-my-api-key-12345", mode: "obfuscate" },
        { type: "plain", content: "my-password-value", mode: "obfuscate" },
      ]);
    });

    it("hasSecrets returns true when secrets loaded", () => {
      assert.ok(obfuscator.hasSecrets());
    });

    it("obfuscates known plain secrets", () => {
      const text = "Using API key: sk-my-api-key-12345 for auth";
      const result = obfuscator.obfuscate(text);
      assert.ok(!result.includes("sk-my-api-key-12345"));
      assert.ok(result.includes("#") && result.includes("Using API key:"));
    });

    it("replaces all occurrences", () => {
      const text = "Key1: sk-my-api-key-12345, Key2: sk-my-api-key-12345";
      const result = obfuscator.obfuscate(text);
      const placeholder = result.match(/#[A-Z0-9]{4}#/g);
      assert.ok(placeholder);
      // Same placeholder for same secret
      assert.equal(new Set(placeholder).size, 1);
    });

    it("does not obfuscate unrelated text", () => {
      const original = "This is normal text without secrets";
      const result = obfuscator.obfuscate(original);
      assert.equal(result, original);
    });

    it("deobfuscates placeholders back to original", () => {
      const original = "Token: sk-my-api-key-12345";
      const obfuscated = obfuscator.obfuscate(original);
      const deobfuscated = obfuscator.deobfuscate(obfuscated);
      assert.equal(deobfuscated, original);
    });

    it("deobfuscateObject walks nested objects", () => {
      const obj = {
        config: { apiKey: "sk-my-api-key-12345" },
        nested: [{ secret: "my-password-value" }],
        plain: "hello",
        num: 42,
      };
      // First obfuscate all strings in the object
      const jsonStr = JSON.stringify(obj);
      const obfuscatedStr = obfuscator.obfuscate(jsonStr);
      const obfuscatedObj = JSON.parse(obfuscatedStr);
      // Should not contain plain secrets after obfuscation
      const afterObfuscation = JSON.stringify(obfuscatedObj);
      assert.ok(!afterObfuscation.includes("sk-my-api-key-12345"));
      assert.ok(!afterObfuscation.includes("my-password-value"));
      // Deobfuscate should restore the original
      const deobfuscated = obfuscator.deobfuscateObject(obfuscatedObj);
      const afterDeobfuscation = JSON.stringify(deobfuscated);
      assert.ok(afterDeobfuscation.includes("sk-my-api-key-12345"));
      assert.ok(afterDeobfuscation.includes("my-password-value"));
    });
  });

  describe("replace mode", () => {
    it("replaces secrets with deterministic replacement", () => {
      const obfuscator = new SecretObfuscator([
        { type: "plain", content: "my-secret", mode: "replace", replacement: "***REDACTED***" },
      ]);

      const result = obfuscator.obfuscate("The secret is my-secret, use it carefully");
      assert.ok(!result.includes("my-secret"));
      assert.ok(result.includes("***REDACTED***"));
    });

    it("generates deterministic replacement when none provided", () => {
      const obfuscator = new SecretObfuscator([
        { type: "plain", content: "test-secret-123", mode: "replace" },
      ]);

      const result = obfuscator.obfuscate("Secret: test-secret-123");
      assert.ok(!result.includes("test-secret-123"));
      // Should have same length
      const secretPart = result.replace("Secret: ", "");
      assert.equal(secretPart.length, "test-secret-123".length);
    });
  });

  describe("regex secrets", () => {
    it("obfuscates content matching regex pattern", () => {
      const obfuscator = new SecretObfuscator([
        { type: "regex", content: "ghp_[A-Za-z0-9]{36}", mode: "obfuscate" },
      ]);

      const text = "Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890";
      const result = obfuscator.obfuscate(text);
      assert.ok(!result.includes("ghp_abcdefghijklmnopqrstuvwxyz1234567890"));
      assert.ok(result.includes("Token: #"));
    });

    it("supports replace mode for regex", () => {
      const obfuscator = new SecretObfuscator([
        { type: "regex", content: "Bearer [A-Za-z0-9._\\-]+", mode: "replace", replacement: "Bearer ***" },
      ]);

      const result = obfuscator.obfuscate("Auth: Bearer eyJhbGciOiJIUzI1NiJ9.abc.xyz");
      assert.ok(!result.includes("eyJhbGciOiJIUzI1NiJ9.abc.xyz"));
      assert.ok(result.includes("Bearer ***"));
    });

    it("ignores invalid regex patterns", () => {
      const obfuscator = new SecretObfuscator([
        { type: "regex", content: "[invalid", mode: "obfuscate" },
      ]);

      // Should not throw, just skip invalid regex
      const result = obfuscator.obfuscate("some text");
      assert.equal(result, "some text");
    });
  });

  describe("edge cases", () => {
    it("handles empty secrets list", () => {
      const obfuscator = new SecretObfuscator([]);
      assert.ok(!obfuscator.hasSecrets());

      const text = "some text";
      assert.equal(obfuscator.obfuscate(text), text);
      assert.equal(obfuscator.deobfuscate(text), text);
    });

    it("handles overlapping secrets (longest first)", () => {
      const obfuscator = new SecretObfuscator([
        { type: "plain", content: "secret", mode: "obfuscate" },
        { type: "plain", content: "my-secret-key", mode: "obfuscate" },
      ]);

      const result = obfuscator.obfuscate("Use key: my-secret-key");
      // The longer secret should be matched first
      assert.ok(!result.includes("my-secret-key"));
    });

    it("handles text with no secrets", () => {
      const obfuscator = new SecretObfuscator([
        { type: "plain", content: "XYZ123", mode: "obfuscate" },
      ]);

      const text = "Regular text with no matches";
      const result = obfuscator.obfuscate(text);
      assert.equal(result, text);
    });

    it("deobfuscate is idempotent on non-obfuscated text", () => {
      const obfuscator = new SecretObfuscator([
        { type: "plain", content: "key123", mode: "obfuscate" },
      ]);

      const text = "This has no placeholders";
      assert.equal(obfuscator.deobfuscate(text), text);
    });
  });
});
