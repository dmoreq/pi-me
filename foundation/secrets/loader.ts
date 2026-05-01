import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { SecretEntry, SecretsConfig } from "./types";

const SECRETS_FILENAME = "secrets.yml";
const MIN_ENV_VALUE_LENGTH = 8;
const SECRET_ENV_PATTERNS = /(?:KEY|SECRET|TOKEN|PASSWORD|PASS|AUTH|CREDENTIAL|PRIVATE|OAUTH)(?:_|$)/i;

async function loadSecretsFile(filePath: string): Promise<SecretsConfig> {
	let text: string;
	try {
		text = await fs.readFile(filePath, "utf-8");
	} catch {
		return { entries: [], hasSecrets: false };
	}

	const entries = parseSecretsYaml(text);
	return {
		sourcePath: filePath,
		entries,
		hasSecrets: entries.length > 0,
	};
}

export async function loadAllSecrets(cwd: string): Promise<SecretsConfig> {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	const userPath = path.join(home, ".pi", "agent", SECRETS_FILENAME);
	const projectPath = path.join(cwd, ".pi", SECRETS_FILENAME);

	const [globalConfig, projectConfig] = await Promise.all([
		loadSecretsFile(userPath),
		loadSecretsFile(projectPath),
	]);

	if (globalConfig.entries.length === 0) return projectConfig;
	if (projectConfig.entries.length === 0) return globalConfig;

	const projectContents = new Set(projectConfig.entries.map((e) => e.content));
	const merged = [
		...globalConfig.entries.filter((e) => !projectContents.has(e.content)),
		...projectConfig.entries,
	];

	return {
		sourcePath: projectConfig.sourcePath ?? globalConfig.sourcePath,
		entries: merged,
		hasSecrets: merged.length > 0,
	};
}

export function collectEnvSecrets(): SecretEntry[] {
	const entries: SecretEntry[] = [];
	const seen = new Set<string>();
	for (const [name, value] of Object.entries(process.env)) {
		if (!value || value.length < MIN_ENV_VALUE_LENGTH) continue;
		if (!SECRET_ENV_PATTERNS.test(name)) continue;
		if (seen.has(value)) continue;
		seen.add(value);
		entries.push({ type: "plain", content: value, mode: "obfuscate" });
	}
	return entries;
}

function parseSecretsYaml(text: string): SecretEntry[] {
	let raw: unknown;
	try {
		raw = parseSimpleYaml(text);
	} catch {
		return [];
	}

	if (!Array.isArray(raw)) return [];

	const entries: SecretEntry[] = [];
	for (let i = 0; i < raw.length; i++) {
		const entry = raw[i];
		if (!validateEntry(entry)) continue;
		entries.push({
			type: entry.type,
			content: entry.content,
			mode: entry.mode ?? "obfuscate",
			replacement: entry.replacement,
			flags: entry.flags,
		});
	}
	return entries;
}

function validateEntry(entry: unknown): entry is SecretEntry {
	if (entry === null || typeof entry !== "object") return false;
	const e = entry as Record<string, unknown>;
	if (e.type !== "plain" && e.type !== "regex") return false;
	if (typeof e.content !== "string" || e.content.length === 0) return false;
	if (e.mode !== undefined && e.mode !== "obfuscate" && e.mode !== "replace") return false;
	if (e.replacement !== undefined && typeof e.replacement !== "string") return false;
	if (e.flags !== undefined && typeof e.flags !== "string") return false;
	return true;
}

function parseSimpleYaml(text: string): unknown {
	const lines = text.split("\n");
	const result: Record<string, unknown>[] = [];
	let current: Record<string, unknown> | null = null;
	let currentKey: string | null = null;

	for (const line of lines) {
		const trimmed = line.trimEnd();

		if (trimmed.trim() === "" || trimmed.trim().startsWith("#")) {
			continue;
		}

		const indent = line.length - line.trimStart().length;

		if (indent === 0 && trimmed.startsWith("- ")) {
			if (current) result.push(current);
			current = {};
			currentKey = null;

			const inlineContent = trimmed.slice(2).trim();
			const colonIdx = inlineContent.indexOf(":");
			if (colonIdx !== -1) {
				const key = inlineContent.slice(0, colonIdx).trim();
				const value = inlineContent.slice(colonIdx + 1).trim();
				current[key] = value;
			}
		} else if (indent === 2 && current !== null && trimmed.includes(":")) {
			const colonIdx = trimmed.indexOf(":");
			const key = trimmed.slice(0, colonIdx).trim();
			let value = trimmed.slice(colonIdx + 1).trim();

			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			if (value === "") {
				currentKey = key;
				current[key] = "";
			} else {
				current[key] = value;
				currentKey = null;
			}
		} else if (indent === 4 && current !== null && currentKey !== null) {
			const existing = (current[currentKey] as string) || "";
			current[currentKey] = existing ? `${existing}\n${trimmed.trim()}` : trimmed.trim();
		}
	}

	if (current) result.push(current);
	return result;
}
