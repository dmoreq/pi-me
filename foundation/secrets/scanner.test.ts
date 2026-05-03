/**
 * Secrets Scanner — Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanForSecrets, formatSecrets } from "./scanner.ts";

describe("scanForSecrets", () => {
	it("detects Stripe/OpenAI key (sk-*)", () => {
		const findings = scanForSecrets('const key = "sk-test-1234567890abcdefghijklmn";');
		assert.equal(findings.length, 1);
		assert.equal(findings[0].message, "Possible Stripe or OpenAI API key (sk-*)");
	});

	it("detects GitHub PAT (ghp_*)", () => {
		const findings = scanForSecrets(
			"token = ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd",
		);
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /GitHub/);
	});

	it("detects GitHub fine-grained PAT (github_pat_*)", () => {
		const pat =
			"github_pat_" + "a".repeat(82);
		const findings = scanForSecrets(`key = ${pat}`);
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /GitHub fine-grained/);
	});

	it("detects AWS access key (AKIA*)", () => {
		const findings = scanForSecrets('aws_key = "AKIAIOSFODNN7EXAMPLE"');
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /AWS access key/);
	});

	it("detects Slack token (xoxb-*)", () => {
		const findings = scanForSecrets('slack = "xoxb-1234567890abcdef"');
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /Slack token/);
	});

	it("detects Slack token (xoxp-*)", () => {
		const findings = scanForSecrets('slack = "xoxp-1234567890abcdef"');
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /Slack token/);
	});

	it("detects private key material", () => {
		const findings = scanForSecrets(
			"-----BEGIN RSA PRIVATE KEY-----\nbase64data\n-----END RSA PRIVATE KEY-----",
		);
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /Private key/);
	});

	it("detects hardcoded password", () => {
		const findings = scanForSecrets('db_password = "supersecret123"');
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /hardcoded password/);
	});

	it("detects hardcoded API key", () => {
		const findings = scanForSecrets('api_key = "a1b2c3d4e5f6g7h8i9j0"');
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /hardcoded secret/);
	});

	it("detects .env-format secret", () => {
		const findings = scanForSecrets("API_KEY=super-secret-value-12345");
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /\.env format/);
	});

	it("filters HTTP header false positives", () => {
		const findings = scanForSecrets(
			'headers: { "User-Agent": "my-app/1.0" }',
		);
		assert.equal(findings.length, 0);
	});

	it("filters env-var-name false positives", () => {
		const findings = scanForSecrets('api_key = "FIREWORKS_API_KEY"');
		assert.equal(findings.length, 0);
	});

	it("skips test files", () => {
		const findings = scanForSecrets(
			'sk-test-1234567890abcdefghijklmn',
			"/project/src/test/api.test.ts",
		);
		assert.equal(findings.length, 0);
	});

	it("does not skip non-test files", () => {
		const findings = scanForSecrets(
			'sk-test-1234567890abcdefghijklmn',
			"/project/src/api.ts",
		);
		assert.equal(findings.length, 1);
	});

	it("returns no findings for clean content", () => {
		const findings = scanForSecrets(
			"const x = 42;\nconsole.log('hello');\n",
		);
		assert.equal(findings.length, 0);
	});

	it("returns multiple findings on separate lines", () => {
		const findings = scanForSecrets(
			'const stripe = "sk-test-1234567890abcdef";\nconst safe = "hello";\nconst gh = "ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd";',
		);
		assert.equal(findings.length, 2);
	});
});

describe("formatSecrets", () => {
	it("returns empty string for no findings", () => {
		assert.equal(formatSecrets([], "/path/to/file.ts"), "");
	});

	it("formats findings with file path", () => {
		const result = formatSecrets(
			[{ line: 5, message: "Test secret" }],
			"/project/src/config.ts",
		);
		assert(result.includes("/project/src/config.ts"));
		assert(result.includes("L5"));
		assert(result.includes("Test secret"));
	});

	it("truncates at 5 findings", () => {
		const findings = Array.from({ length: 10 }, (_, i) => ({
			line: i + 1,
			message: `Secret ${i + 1}`,
		}));
		const result = formatSecrets(findings, "file.ts");
		const lines = result.split("\n");
		assert(lines.length <= 8); // header + 5 items + truncation + instruction
		assert(result.includes("and 5 more"));
	});
});
