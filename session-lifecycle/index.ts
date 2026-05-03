/**
 * session-lifecycle — Umbrella entry point.
 *
 * Profile: dev / full (skipped for "minimal").
 * Imports: handoff, checkpoint, auto-compact, context-pruning, session-recap, usage-extension,
 *          welcome-overlay.
 * Inlines: session-name (51 lines), skill-args (~100 lines).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getTelemetry } from "pi-telemetry";
import { readProfile } from "../shared/profile.js";

// ── Imported extensions ──────────────────────────────────────────────────

import handoff from "./handoff.ts";
import checkpoint from "./git-checkpoint/checkpoint.ts";
import autoCompact from "./auto-compact/index.ts";
import contextPruning from "./context-pruning/index.ts";
import sessionRecap from "./session-recap/index.ts";
import usageExtension from "./usage-extension/index.ts";
import welcomeOverlay from "./welcome-overlay/index.ts";

// ── Inlined: session-name ────────────────────────────────────────────────

const MAX_NAME_LENGTH = 60;

function sessionNameFromMessage(text: string): string {
	let cleaned = text.replace(/^\/\S+\s*/, "").trim();
	if (!cleaned) cleaned = text.replace(/^\//, "").trim();
	if (cleaned.length > MAX_NAME_LENGTH) {
		const truncated = cleaned.slice(0, MAX_NAME_LENGTH);
		const lastSpace = truncated.lastIndexOf(" ");
		cleaned = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
	}
	return cleaned || `Session ${new Date().toLocaleDateString()}`;
}

function registerSessionName(pi: ExtensionAPI) {
	let firstMessageSeen = false;

	pi.on("session_start", async (_event, ctx) => {
		firstMessageSeen = false;
		const existingName = pi.getSessionName();
		if (existingName && ctx.hasUI) {
			firstMessageSeen = true;
			ctx.ui.setStatus("session-name", ctx.ui.theme.fg("dim", `💬  Session: ${existingName}`));
		}
	});

	pi.on("input", async (event, ctx) => {
		if (firstMessageSeen) return { action: "continue" };
		if (!event.text.trim()) return { action: "continue" };

		firstMessageSeen = true;
		const name = sessionNameFromMessage(event.text);
		pi.setSessionName(name);

		if (ctx.hasUI) {
			ctx.ui.setStatus("session-name", ctx.ui.theme.fg("dim", `💬  Session: ${name}`));
		}

		return { action: "continue" };
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		firstMessageSeen = false;
		if (ctx.hasUI) ctx.ui.setStatus("session-name", undefined);
	});
}

// ── Inlined: skill-args ──────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import {
	getAgentDir,
	loadSkills,
	parseFrontmatter,
	stripFrontmatter,
	type InputEvent,
	type InputEventResult,
	type Skill,
} from "@mariozechner/pi-coding-agent";

/** Matches any placeholder Pi's substituteArgs would replace. */
const TOKEN_REGEX = /\$(?:\d+|ARGUMENTS|@|\{@:\d+(?::\d+)?\})/;

/** Prefix Pi uses for skill commands. */
const SKILL_PREFIX = "/skill:";

/** Re-entrancy guard. */
const WRAPPED_PREFIX = "<skill ";

export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: string | null = null;
	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];
		if (inQuote) {
			if (char === inQuote) {
				inQuote = null;
			} else {
				current += char;
			}
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === " " || char === "\t") {
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}
	if (current) args.push(current);
	return args;
}

export function substituteArgs(content: string, args: string[]): string {
	let result = content;
	result = result.replace(/\$(\d+)/g, (_, num) => args[parseInt(num, 10) - 1] ?? "");
	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr, lengthStr) => {
		let start = parseInt(startStr, 10) - 1;
		if (start < 0) start = 0;
		if (lengthStr) {
			const length = parseInt(lengthStr, 10);
			return args.slice(start, start + length).join(" ");
		}
		return args.slice(start).join(" ");
	});
	const allArgs = args.join(" ");
	result = result.replace(/\$ARGUMENTS/g, allArgs);
	result = result.replace(/\$@/g, allArgs);
	return result;
}

interface SkillIndexEntry {
	readonly name: string;
	readonly filePath: string;
	readonly baseDir: string;
}

let skillIndex: Map<string, SkillIndexEntry> | null = null;

export function invalidateSkillIndex(): void {
	skillIndex = null;
}

function buildSkillIndex(): Map<string, SkillIndexEntry> {
	const { skills } = loadSkills({
		cwd: process.cwd(),
		agentDir: getAgentDir(),
		skillPaths: [],
		includeDefaults: true,
	});
	const index = new Map<string, SkillIndexEntry>();
	for (const s of skills as Skill[]) {
		index.set(s.name, { name: s.name, filePath: s.filePath, baseDir: s.baseDir });
	}
	return index;
}

function getSkillIndex(): Map<string, SkillIndexEntry> {
	if (!skillIndex) skillIndex = buildSkillIndex();
	return skillIndex;
}

function buildSkillBlock(entry: SkillIndexEntry, body: string): string {
	return `<skill name="${entry.name}" location="${entry.filePath}">\nReferences are relative to ${entry.baseDir}.\n\n${body}\n</skill>`;
}

function appendArgs(skillBlock: string, args: string): string {
	return args ? `${skillBlock}\n\n${args}` : skillBlock;
}

export function handleInput(event: InputEvent): InputEventResult {
	const text = event.text;
	if (text.startsWith(WRAPPED_PREFIX)) return { action: "continue" };
	if (!text.startsWith(SKILL_PREFIX)) return { action: "continue" };

	const spaceIndex = text.indexOf(" ");
	const skillName = spaceIndex === -1 ? text.slice(SKILL_PREFIX.length) : text.slice(SKILL_PREFIX.length, spaceIndex);
	const argsString = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();

	const entry = getSkillIndex().get(skillName);
	if (!entry) return { action: "continue" };

	let content: string;
	try {
		content = readFileSync(entry.filePath, "utf-8");
	} catch {
		return { action: "continue" };
	}

	const { frontmatter } = parseFrontmatter<{ "argument-hint"?: string }>(content);
	void frontmatter;
	const body = stripFrontmatter(content).trim();

	if (!TOKEN_REGEX.test(body)) {
		return { action: "transform", text: appendArgs(buildSkillBlock(entry, body), argsString) };
	}

	const parsed = parseCommandArgs(argsString);
	const substituted = substituteArgs(body, parsed);
	return { action: "transform", text: appendArgs(buildSkillBlock(entry, substituted), argsString) };
}

function registerArgsHandler(pi: ExtensionAPI): void {
	pi.on("input", (event) => handleInput(event));
	pi.on("session_start", (event) => {
		if (event.reason === "reload" || event.reason === "startup") {
			invalidateSkillIndex();
		}
	});
}

// ── Umbrella default export ──────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const profile = readProfile();
	if (profile === "minimal") return;

	const t = getTelemetry();
	if (t) {
		t.register({
			name: "session-lifecycle",
			version: "0.2.0",
			description: "Session lifecycle: handoff, checkpoint, auto-compact, context-pruning, session-recap, usage, welcome",
			events: ["session_start", "session_shutdown", "session_before_*"] as string[],
		});
		t.heartbeat("session-lifecycle");
	}

	handoff(pi);
	checkpoint(pi);
	autoCompact(pi);
	void contextPruning(pi);
	registerSessionName(pi);
	sessionRecap(pi);
	usageExtension(pi);
	welcomeOverlay(pi);
	registerArgsHandler(pi);
}
