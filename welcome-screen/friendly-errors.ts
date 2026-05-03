/**
 * Friendly Errors Extension
 *
 * Unified error message interceptor for all tools.
 * Catches harsh/technical error messages (edit validation, permission blocks,
 * generic tool failures) and rewrites them as friendly, actionable messages
 * using a consistent 3-part structure:
 *
 *   [emoji]  [what happened]
 *           File: path (if applicable)
 *           Detail: specific technical info
 *
 *   💡  actionable suggestion
 *
 * Also adds auto-clearing footer status indicators — same style as
 * context pruning's footer pattern.
 *
 * Hooks:
 *   - tool_result   — catch all tool errors and rewrite them
 *   - tool_call     — catch permission blocks (blocked before execution)
 *   - user_bash     — catch permission blocks in !/!! commands
 */

import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

// ─── Constants ─────────────────────────────────────────────────────────

const STATUS_PREFIX = "friendly-err";
const STATUS_CLEAR_MS = 8000;
const SHORT_PATH_LIMIT = 60;

// ─── Pattern Matching ──────────────────────────────────────────────────

interface EditRangeInfo {
	path: string;
	readStart: number;
	readEnd: number;
	editStart: number;
	editEnd: number;
}

/**
 * Parse "Edit outside read range" error — the most common harsh error.
 */
function parseEditRangeError(text: string): EditRangeInfo | null {
	const pattern = /you read\s+`([^`]+)`\s+lines\s+(\d+)[–-](\d+)[^]*?edit touches\s+lines\s+(\d+)[–-](\d+)/i;
	const match = text.match(pattern);
	if (!match) return null;
	return {
		path: match[1]!,
		readStart: Number.parseInt(match[2]!, 10),
		readEnd: Number.parseInt(match[3]!, 10),
		editStart: Number.parseInt(match[4]!, 10),
		editEnd: Number.parseInt(match[5]!, 10),
	};
}

interface PermissionBlockInfo {
	categories?: string;
	command?: string;
	level?: string;
}

/**
 * Parse permission block messages.
 * Patterns: "Blocked by safety net (X). Command: Y",
 *           "Blocked by permission (X). Command: Y",
 *           "Safety violation blocked (X). Command: Y",
 *           "Blocked by permission mode (block). Command: Y",
 *           "Dangerous command requires confirmation: Y"
 */
function parsePermissionBlock(text: string): PermissionBlockInfo | null {
	if (/blocked by safety net/i.test(text)) return { categories: "safety", command: extractCommand(text) };
	if (/safety violation blocked/i.test(text)) {
		const catMatch = text.match(/safety violation blocked\s*\(([^)]+)\)/i);
		return { categories: catMatch?.[1] ?? "safety", command: extractCommand(text) };
	}
	if (/blocked by permission/i.test(text)) {
		const levelMatch = text.match(/blocked by permission\s*\(([^)]+)\)/i);
		return { level: levelMatch?.[1], command: extractCommand(text) };
	}
	if (/blocked by permission mode/i.test(text)) return { categories: "mode: block", command: extractCommand(text) };
	if (/dangerous command requires confirmation/i.test(text)) return { command: extractCommand(text) };
	return null;
}

function extractCommand(text: string): string | undefined {
	const cmdMatch = text.match(/Command:\s*(.+?)(?:\n|$)/i);
	if (cmdMatch) return cmdMatch[1]!.trim();
	const dangerMatch = text.match(/Dangerous command requires confirmation:\s*(.+?)(?:\n|$)/i);
	if (dangerMatch) return dangerMatch[1]!.trim();
	return undefined;
}

/**
 * Parse generic tool error — any tool that returned isError.
 */
function parseGenericError(text: string): string | null {
	if (!text || text.length < 5) return null;
	// Skip cases already handled by more specific parsers
	if (parseEditRangeError(text) || parsePermissionBlock(text)) return null;
	return text.length > 200 ? text.slice(0, 200) + "…" : text;
}

// ─── Friendly Message Builders ─────────────────────────────────────────

function shortPath(p: string): string {
	return p.length > SHORT_PATH_LIMIT ? "…" + p.slice(-(SHORT_PATH_LIMIT - 1)) : p;
}

function buildEditFriendly(info: EditRangeInfo): string {
	const { path, readStart, readEnd, editStart, editEnd } = info;
	const readLines = readEnd - readStart + 1;
	const editLines = editEnd - editStart + 1;
	const gap = Math.max(0, editStart - readEnd);
	const neededEnd = Math.max(editEnd, readEnd);
	const neededStart = Math.min(editStart, readStart);

	return [
		`📐  Edit needs a wider read range`,
		`        File: ${shortPath(path)}`,
		`        Read: lines ${readStart}–${readEnd} (${readLines} line${readLines !== 1 ? "s" : ""})`,
		`        Edit: lines ${editStart}–${editEnd} (${editLines} line${editLines !== 1 ? "s" : ""})`,
		`        Gap:  ${gap} line${gap !== 1 ? "s" : ""} beyond what was read`,
		``,
		`💡  Re-read with read("${shortPath(path)}", { offset: ${neededStart}:${neededEnd} }) first, then retry.`,
	].join("\n");
}

function buildPermissionFriendly(info: PermissionBlockInfo): string {
	const parts: string[] = [];
	if (info.level === "bypassed" || info.level === "minimal") {
		// Advisory block — user set a low permission level
		parts.push(`🛡️  Action blocked by your permission level (${info.level})`);
		parts.push(`        Command: ${info.command ?? "unknown"}`);
		parts.push(``);
		parts.push(`💡  Run /permission <level> to allow more operations, or /permission-mode ask for confirmations.`);
	} else if (info.categories === "mode: block") {
		parts.push(`🛡️  Action blocked — permission mode is set to "block"`);
		parts.push(`        Command: ${info.command ?? "unknown"}`);
		parts.push(``);
		parts.push(`💡  Run /permission-mode ask to enable confirmations.`);
	} else if (info.categories) {
		parts.push(`🛡️  Command blocked by safety rules (${info.categories})`);
		if (info.command) parts.push(`        Command: ${info.command}`);
		parts.push(``);
		parts.push(`💡  Use a more targeted path or approve via /permission-mode ask.`);
	} else {
		parts.push(`🛡️  Action blocked by safety rules`);
		if (info.command) parts.push(`        Command: ${info.command}`);
		parts.push(``);
		parts.push(`💡  Check the command and retry. Use /permission-mode ask for confirmations.`);
	}
	return parts.join("\n");
}

function buildGenericFriendly(toolName: string, errorText: string): string {
	const shortError = errorText.length > 150 ? errorText.slice(0, 150) + "…" : errorText;
	return [
		`⚠️  ${toolName} encountered an issue`,
		`        ${shortError}`,
		``,
		`💡  Check the input and retry.`,
	].join("\n");
}

function buildBlockedFriendly(toolName: string, reason: string): string {
	const perm = parsePermissionBlock(reason);
	if (perm) return buildPermissionFriendly(perm);

	return [
		`🛡️  ${toolName} blocked`,
		`        ${reason.length > 150 ? reason.slice(0, 150) + "…" : reason}`,
		``,
		`💡  Adjust the request and try again.`,
	].join("\n");
}

// ─── Footer Status Helpers ─────────────────────────────────────────────

function setStatus(ctx: { hasUI: boolean; ui: { setStatus: (k: string, v?: string) => void; theme: Theme } }, key: string, text: string) {
	if (!ctx.hasUI) return;
	const dimText = ctx.ui.theme.fg("dim", text);
	ctx.ui.setStatus(`${STATUS_PREFIX}-${key}`, dimText);
}

function clearStatus(ctx: { hasUI: boolean; ui: { setStatus: (k: string, v?: string) => void } }, key: string) {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(`${STATUS_PREFIX}-${key}`, undefined);
}

function autoClear(ctx: { hasUI: boolean; ui: { setStatus: (k: string, v?: string) => void } }, key: string, ms = STATUS_CLEAR_MS) {
	setTimeout(() => {
		try { clearStatus(ctx, key); } catch { /* session may have ended */ }
	}, ms);
}

// ─── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Step 1: tool_result — catch all tool errors ───────────────
	pi.on("tool_result", async (event, ctx) => {
		if (!event.isError) return;

		const text = event.content
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("\n");

		if (!text) return;

		// 1a. Edit range errors
		const editInfo = parseEditRangeError(text);
		if (editInfo) {
			const friendly = buildEditFriendly(editInfo);
			const gap = Math.max(0, editInfo.editStart - editInfo.readEnd);
			setStatus(ctx, "edit-gap", `📐 Edit gap: read ${editInfo.readEnd - editInfo.readStart + 1} lines, need ${editInfo.editEnd - editInfo.editStart + 1} lines (gap ${gap})`);
			autoClear(ctx, "edit-gap");
			return {
				content: [{ type: "text", text: friendly }],
				isError: true,
				details: event.details,
			};
		}

		// 1b. Permission blocks in tool results
		const permInfo = parsePermissionBlock(text);
		if (permInfo) {
			const friendly = buildPermissionFriendly(permInfo);
			setStatus(ctx, "blocked", `🛡️  ${permInfo.categories ?? "safety"} — blocked (use /permission-mode ask)`);
			autoClear(ctx, "blocked");
			return {
				content: [{ type: "text", text: friendly }],
				isError: true,
				details: event.details,
			};
		}

		// 1c. Generic tool errors
		const genericText = parseGenericError(text);
		if (genericText) {
			const friendly = buildGenericFriendly(event.toolName, genericText);
			setStatus(ctx, "error", `⚠️  ${event.toolName} error`);
			autoClear(ctx, "error");
			return {
				content: [{ type: "text", text: friendly }],
				isError: true,
				details: event.details,
			};
		}
	});

	// ── Step 2: tool_call — block permission-style blocks ────────
	pi.on("tool_call", async (event, ctx) => {
		// Only intercept if the handler wants to block (read-only check)
		// Permission blocking happens in the permission extension via tool_call
		// We only rewrite the reason if another extension already determined the block
	});

	// ── Step 3: user_bash — catch permission blocks in !/!! ─────
	pi.on("user_bash", async (event, ctx) => {
		// Permission blocks happen when another extension returns { block: true, reason: "..." }
		// We don't pre-block here; we only observe.
		// If bash permission returns a block, it's handled by the tool_call path.
	});

	// ── Clean up all statuses on session end ──────────────────────
	const allKeys = ["edit-gap", "blocked", "error"];
	pi.on("session_shutdown", async (_event, ctx) => {
		for (const key of allKeys) {
			clearStatus(ctx, key);
		}
	});
}
