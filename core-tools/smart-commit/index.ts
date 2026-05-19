/**
 * smart-commit — /commit command + commit_message tool
 *
 * Pipeline per group:
 *   1. Discover dirty files
 *   2. Group by directory scope
 *   3. Format + fix each file
 *   4. Stage the group
 *   5. Ask LLM for a conventional commit message (via sendUserMessage)
 *   6. LLM calls commit_message tool → tool runs `git commit -m <message>`
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";

import {
  getRepoRoot,
  listDirtyFiles,
  stageFiles,
  getDiffStatForFiles,
  getDiffForFiles,
  commitWithMessage,
  isValidConventionalCommit,
  getHeadSha,
} from "./git.ts";
import { groupDirtyFiles } from "./grouper.ts";
import { runQualityOnFiles, summarizeQuality } from "./quality.ts";
import { buildCommitPrompt } from "./prompt.ts";

// ─── Tool parameter schema ────────────────────────────────────────────────────

const CommitMessageParams = Type.Object({
  message: Type.String({ description: "The conventional commit message to use" }),
  include_unstaged: Type.Optional(
    Type.Boolean({ default: false, description: "Include unstaged diff in output for review" }),
  ),
});

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerSmartCommit(pi: ExtensionAPI): void {

  // ── /commit command ────────────────────────────────────────────────────────

  pi.registerCommand("commit", {
    description: "Group changes, auto-format/fix each group, then commit each conventionally",
    handler: async (_args, ctx) => {
      const cwd = await fs.realpath(ctx.cwd);

      ctx.ui.setStatus("smart-commit", "🔍 Scanning changes...");

      let repoRoot: string;
      try {
        repoRoot = await getRepoRoot(cwd);
      } catch {
        ctx.ui.notify("Not inside a git repository", "warning");
        ctx.ui.setStatus("smart-commit", "");
        return;
      }

      const dirty = await listDirtyFiles(cwd, repoRoot);
      if (dirty.length === 0) {
        ctx.ui.notify("Nothing to commit — working tree is clean", "info");
        ctx.ui.setStatus("smart-commit", "");
        return;
      }

      const groups = groupDirtyFiles(dirty, repoRoot);
      const total = groups.length;
      ctx.ui.setStatus("smart-commit", `📦 ${total} group(s) to commit`);

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const progress = `[${i + 1}/${total}] ${group.label}`;

        // ── Quality pass ───────────────────────────────────────────────────
        ctx.ui.setStatus("smart-commit", `⚙️  ${progress} — formatting & fixing...`);

        const nonDeleted = group.files.filter(f => f.status !== "D");
        const quality = await runQualityOnFiles(nonDeleted, repoRoot, pi);
        const qualitySummary = summarizeQuality(quality);

        // ── Stage ─────────────────────────────────────────────────────────
        await stageFiles(group.files.map(f => f.absPath), cwd);

        // ── Build diff ────────────────────────────────────────────────────
        const relPaths = group.files.map(f => f.relPath);
        const [diffStat, diffBody] = await Promise.all([
          getDiffStatForFiles(relPaths, cwd),
          getDiffForFiles(relPaths, cwd),
        ]);

        // ── Ask LLM ───────────────────────────────────────────────────────
        ctx.ui.setStatus(
          "smart-commit",
          `🤖 ${progress} — quality: ${qualitySummary}`,
        );

        const prompt = buildCommitPrompt(group, diffStat, diffBody, quality);
        pi.sendUserMessage(prompt);

        // The LLM will now respond and call commit_message tool.
        // Because sendUserMessage is fire-and-forget within a command handler,
        // we stop after the first group — the LLM drives the rest.
        // Each commit_message call completes one group commit, and the agent
        // can invoke /commit again if there are remaining groups.
        //
        // This is intentional: one LLM round-trip per group for best quality.
        return;
      }

      ctx.ui.setStatus("smart-commit", "✅ All groups committed");
    },
  });

  // ── commit_message tool ────────────────────────────────────────────────────

  pi.registerTool({
    name: "commit_message",
    label: "Commit Message",
    description: [
      "Commit staged changes with a conventional commit message.",
      "Run git commit -m <message> and return the new commit SHA.",
      "Validates the message follows conventional commit format before committing.",
    ].join(" "),
    parameters: CommitMessageParams,

    async execute(_toolCallId, params) {
      const cwd = process.cwd();

      const message = params.message?.trim() ?? "";
      if (!message) {
        return err("message is required");
      }

      if (!isValidConventionalCommit(message)) {
        return err(
          `Message does not follow conventional commit format (type(scope): description). Got: "${message.slice(0, 100)}"`,
        );
      }

      try {
        const sha = await commitWithMessage(message, cwd);

        // Also provide diff stats for the committed files as context
        const diffStat = await getDiffStatForFiles([], cwd).catch(() => "");

        return ok(
          `✅ Committed: ${sha.slice(0, 8)}\n${message}`,
          { sha, message, diffStat },
        );
      } catch (e: any) {
        return err(`git commit failed: ${e?.message ?? String(e)}`);
      }
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details };
}
function err(text: string) {
  return { content: [{ type: "text" as const, text: `Error: ${text}` }], details: { error: text } };
}

export default registerSmartCommit;
