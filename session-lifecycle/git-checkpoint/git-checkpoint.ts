/**
 * pi-me: git-checkpoint — Git stash checkpoints.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();
	let currentEntryId: string | undefined;
	let isGitRepo: boolean | null = null;

	async function ensureGitRepo(cwd: string): Promise<boolean> {
		if (isGitRepo !== null) return isGitRepo;
		try {
			const result = await pi.exec("git", ["rev-parse", "--git-dir"], { cwd });
			isGitRepo = result.code === 0;
		} catch {
			isGitRepo = false;
		}
		return isGitRepo;
	}

	pi.on("tool_result", async (_event, ctx) => {
		const entry = ctx.sessionManager.getLeafEntry();
		if (entry) currentEntryId = entry.id;
	});

	pi.on("turn_start", async (_event, ctx) => {
		if (!currentEntryId) return;
		if (!(await ensureGitRepo(ctx.cwd))) return;

		const { stdout } = await pi.exec("git", ["stash", "create"], { cwd: ctx.cwd });
		const ref = stdout.trim();
		if (ref) {
			checkpoints.set(currentEntryId, ref);
		}
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;
		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select(
			"Restore code state to this point?",
			["Yes, restore code", "No, keep current code"],
		);

		if (choice?.startsWith("Yes")) {
			const result = await pi.exec("git", ["stash", "apply", ref], { cwd: ctx.cwd });
			if (result.code === 0) {
				ctx.ui.notify("Code restored to checkpoint", "success");
			} else {
				ctx.ui.notify(`Failed to restore: ${result.stderr}`, "error");
			}
		}
	});

	pi.on("agent_end", async () => {
		checkpoints.clear();
		currentEntryId = undefined;
	});

	pi.on("session_start", () => {
		isGitRepo = null;
	});
}
