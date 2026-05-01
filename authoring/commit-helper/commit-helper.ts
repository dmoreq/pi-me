/**
 * pi-me: commit-helper — AI-powered git commit message generation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";

interface DiffResult { staged: string; unstaged: string; hasChanges: boolean; }

function execGit(args: string[], cwd: string): Promise<string> {
	return new Promise((resolve) => {
		execFile("git", args, { cwd, timeout: 10000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
			resolve(err ? "" : stdout.trim());
		});
	});
}

async function getDiffs(cwd: string): Promise<DiffResult> {
	const [staged, unstaged, stagedFull, unstagedFull] = await Promise.all([
		execGit(["diff", "--cached", "--stat"], cwd),
		execGit(["diff", "--stat"], cwd),
		execGit(["diff", "--cached"], cwd),
		execGit(["diff"], cwd),
	]);
	const combined = [stagedFull, unstagedFull].filter(Boolean).join("\n");
	return { staged: staged || "(no staged changes)", unstaged: unstaged || "(no unstaged changes)", hasChanges: combined.length > 0 };
}

function buildCommitPrompt(diff: DiffResult): string {
	return [
		"Generate a conventional commit message for these changes.",
		"Follow the format: type(scope): description",
		"Types: feat, fix, docs, style, refactor, test, chore, perf, ci",
		"", "Changes:", "", `Staged:\n${diff.staged}`, "", `Unstaged:\n${diff.unstaged}`, "", "Commit message:",
	].join("\n");
}

const CommitMessageParams = Type.Object({
	include_unstaged: Type.Optional(Type.Boolean({ default: false, description: "Include unstaged changes in the diff" })),
});

export function registerCommitHelper(pi: ExtensionAPI) {
	pi.registerCommand("commit", {
		description: "Generate a git commit message from staged diffs",
		handler: async (_args, ctx) => {
			const cwd = await fs.realpath(ctx.cwd);
			const diffs = await getDiffs(cwd);
			if (!diffs.hasChanges) { ctx.ui.notify("No changes to commit", "warning"); return; }
			if (ctx.hasUI) ctx.ui.notify("Analyzing diffs for commit message...", "info");
			pi.sendUserMessage(buildCommitPrompt(diffs));
		},
	});

	pi.registerTool({
		name: "commit_message", label: "Commit Message",
		description: "Generate a conventional commit message from git diffs.",
		parameters: CommitMessageParams,
		async execute(_toolCallId, params) {
			const cwd = process.cwd();
			const diffs = await getDiffs(cwd);
			if (!diffs.hasChanges) return { content: [{ type: "text", text: "No changes to commit." }] };
			const args = params.include_unstaged ? ["diff"] : ["diff", "--cached"];
			const diff = (await execGit(args, cwd)).slice(0, 8000);
			return { content: [{ type: "text", text: `Diff stats:\n${diffs.staged}\n\nDiff:\n${diff || "(empty — no staged changes)"}` }], details: { stagedFiles: diffs.staged.split("\n").length - 1, hasUnstaged: diffs.unstaged !== "(no unstaged changes)" } };
		},
	});
}

export default registerCommitHelper;
