/**
 * Content-level secrets scanner
 *
 * Scans file content for potential secret patterns before write.
 * Designed to be called from tool_call handlers.
 *
 * Detected patterns:
 * - Stripe/OpenAI keys (sk-*)
 * - GitHub tokens (ghp_*, gho_*, github_pat_*)
 * - AWS keys (AKIA*)
 * - Slack tokens (xoxb-*, xoxp-*)
 * - Private keys (-----BEGIN * PRIVATE KEY-----)
 * - Hardcoded passwords
 * - Hardcoded API keys / secrets / tokens
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretFinding {
	line: number;
	message: string;
}

// ── Patterns ─────────────────────────────────────────────────────────────

const SECRET_PATTERNS: Array<{ pattern: RegExp; name: string; message: string }> = [
	// High-confidence: specific key prefixes
	{
		pattern: /sk-[a-zA-Z0-9-]{20,}/g,
		name: "stripe-openai-key",
		message: "Possible Stripe or OpenAI API key (sk-*)",
	},
	{
		pattern: /ghp_[a-zA-Z0-9]{36}/g,
		name: "github-personal-token",
		message: "GitHub personal access token (ghp_*)",
	},
	{
		pattern: /gho_[a-zA-Z0-9]{36}/g,
		name: "github-oauth-token",
		message: "GitHub OAuth token (gho_*)",
	},
	{
		pattern: /github_pat_[a-zA-Z0-9_]{82}/g,
		name: "github-fine-grained-pat",
		message: "GitHub fine-grained PAT (github_pat_*)",
	},
	{
		pattern: /AKIA[0-9A-Z]{16}/g,
		name: "aws-access-key",
		message: "AWS access key ID (AKIA*)",
	},
	{
		pattern: /xox[bp]-[a-zA-Z0-9]{10,}/g,
		name: "slack-token",
		message: "Slack token (xoxb-*/xoxp-*)",
	},
	{
		pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/g,
		name: "private-key",
		message: "Private key material detected",
	},
	// Medium-confidence: quoted credentials
	{
		pattern: /password\s*[:=]\s*["'][^"']{4,}["']/gi,
		name: "hardcoded-password",
		message: "Possible hardcoded password",
	},
	{
		pattern: /\b(secret|api[_-]?key|token|access[_-]?key)\b\s*[:=]\s*["']([a-zA-Z0-9_./-]{8,})["']/gi,
		name: "hardcoded-secret",
		message: "Possible hardcoded secret or API key",
	},
	// .env format: KEY=VALUE (no quotes)
	{
		pattern: /^(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|AWS[_-]?ACCESS[_-]?KEY)\s*=\s*\S{8,}/gim,
		name: "env-file-secret",
		message: "Possible secret in .env format",
	},
];

const SAFE_HEADER_KEYS = new Set([
	"user-agent", "accept", "accept-language", "accept-encoding",
	"content-type", "content-length", "origin", "referer", "host",
	"connection", "cache-control", "pragma", "x-requested-with",
]);

// ── Helpers ──────────────────────────────────────────────────────────────

function extractHeaderKey(line: string): string | null {
	const m = line.match(/["']([A-Za-z][A-Za-z0-9-]{0,63})["']\s*:\s*["'][^"']+/);
	return m ? m[1].toLowerCase() : null;
}

function looksLikeEnvVarName(value: string): boolean {
	return /^[A-Z][A-Z0-9_]*$/.test(value) && value.includes("_");
}

function extractQuotedValue(line: string): string | null {
	const match = line.match(/[:=]\s*["']([^"']+)["']/);
	return match ? match[1] : null;
}

function extractEnvValue(line: string): string | null {
	const match = line.match(/=\s*(\S+)/);
	if (!match) return null;
	// Strip surrounding quotes
	return match[1].replace(/^["']|["']$/g, "");
}

// ── Scanner ──────────────────────────────────────────────────────────────

export function scanForSecrets(
	content: string,
	filePath?: string,
): SecretFinding[] {
	// Skip test files — secrets in tests are usually fake/test values
	if (filePath && isTestFile(filePath)) {
		return [];
	}

	const findings: SecretFinding[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const entry of SECRET_PATTERNS) {
			const regex = new RegExp(entry.pattern.source, entry.pattern.flags);
			const match = regex.exec(line);
			if (!match) continue;

			// Filter false positives
			if (entry.name === "hardcoded-secret" || entry.name === "hardcoded-password") {
				const key = extractHeaderKey(line);
				if (key && SAFE_HEADER_KEYS.has(key)) continue;
			}

			// Filter env-var-name references (e.g. api_key = "FIREWORKS_API_KEY")
			// Applies to both hardcoded-secret and env-file-secret patterns
			if (entry.name === "hardcoded-secret" || entry.name === "env-file-secret") {
				const value = entry.name === "hardcoded-secret"
					? extractQuotedValue(line)
					: extractEnvValue(line);
				if (value && looksLikeEnvVarName(value)) continue;
			}

			findings.push({ line: i + 1, message: entry.message });
			break; // One finding per line
		}
	}

	return findings;
}

export function formatSecrets(
	findings: SecretFinding[],
	filePath: string,
): string {
	if (findings.length === 0) return "";

	const lines = [
		`🔴 STOP — ${findings.length} potential secret(s) in ${filePath}:`,
	];
	for (const f of findings.slice(0, 5)) {
		lines.push(`  L${f.line}: ${f.message}`);
	}
	if (findings.length > 5) {
		lines.push(`  ... and ${findings.length - 5} more`);
	}
	lines.push("  → Remove before continuing. Use env vars instead.");
	return lines.join("\n");
}

// ── Test file detection ─────────────────────────────────────────────────

function isTestFile(filePath: string): boolean {
	const base = filePath.toLowerCase();
	return (
		base.includes(".test.") ||
		base.includes("_test.") ||
		base.includes(".spec.") ||
		base.includes("/tests/") ||
		base.includes("/__tests__/") ||
		base.endsWith(".test.ts") ||
		base.endsWith(".test.js") ||
		base.endsWith(".spec.ts") ||
		base.endsWith(".spec.js")
	);
}
