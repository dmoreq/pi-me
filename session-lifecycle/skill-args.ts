/**
 * Skill Args — $1/$2/$ARGUMENTS substitution in skill bodies.
 * Extracted from session-lifecycle/index.ts for independent testability.
 */

import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
const SKILL_PREFIX = "/skill:";
const WRAPPED_PREFIX = "<skill ";

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

export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: string | null = null;
	for (const char of argsString) {
		if (inQuote) {
			if (char === inQuote) inQuote = null;
			else current += char;
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === " " || char === "\t") {
			if (current) { args.push(current); current = ""; }
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
		if (lengthStr) return args.slice(start, start + parseInt(lengthStr, 10)).join(" ");
		return args.slice(start).join(" ");
	});
	const allArgs = args.join(" ");
	result = result.replace(/\$ARGUMENTS/g, allArgs).replace(/\$@/g, allArgs);
	return result;
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
	try { content = readFileSync(entry.filePath, "utf-8"); } catch { return { action: "continue" }; }

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

export function registerArgsHandler(pi: ExtensionAPI): void {
	pi.on("input", (event) => handleInput(event));
	pi.on("session_start", (event) => {
		if (event.reason === "reload" || event.reason === "startup") invalidateSkillIndex();
	});
}
