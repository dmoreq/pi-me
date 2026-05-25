/**
 * smart-commit — /commit command + commit_message tool
 *
 * Pipeline per group:
 *   1. Discover dirty files
 *   2. Group by directory scope
 *   3. Format + fix each file
 *   4. Stage the group
 *   5. Ask LLM for a conventional commit message (via sendUserMessage)
 *   6. LLM calls commit_message tool → tool runs an isolated pathspec commit
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
  getCommitStat,
} from "./git.ts";
import { groupDirtyFiles } from "./grouper.ts";
import { runQualityOnFiles, summarizeQuality } from "./quality.ts";
import { buildCommitPrompt } from "./prompt.ts";
import type { CommitGroup, QualityResult } from "./types.ts";

// ─── Tool parameter schema ────────────────────────────────────────────────────

const CommitMessageParams = Type.Object({
  message: Type.String({ description: "The conventional commit message to use" }),
  include_unstaged: Type.Optional(
    Type.Boolean({ default: false, description: "Include unstaged diff in the tool result for review" }),
  ),
});

interface ActiveCommitContext {
  cwd: string;
  repoRoot: string;
  group: CommitGroup;
  quality: QualityResult[];
  diffStat: string;
}

let activeCommitContext: ActiveCommitContext | undefined;

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerSmartCommit(pi: ExtensionAPI): void {

  // ── /commit command ────────────────────────────────────────────────────────

  pi.registerCommand("commit", {
    description: "Group changes, auto-format/fix each group, then commit each conventionally",
    handler: async (_args, ctx) => {
      const cwd = await fs.realpath(ctx.cwd);

      ctx.ui.setStatus("smart-commit", "Scanning changes...");

      let repoRoot: string;
      try {
        repoRoot = await getRepoRoot(cwd);
      } catch {
        ctx.ui.notify("Not inside a git repository", "warning");
        ctx.ui.setStatus("smart-commit", "");
        return;
      }

      try {
        const dirty = await listDirtyFiles(cwd, repoRoot);
        if (dirty.length === 0) {
          ctx.ui.notify("Nothing to commit — working tree is clean", "info");
          return;
        }

        const groups = groupDirtyFiles(dirty);
        const total = groups.length;
        ctx.ui.setStatus("smart-commit", `Commit: ${total} group(s)`);

        const group = groups[0];
        const progress = `[1/${total}] ${group.label}`;

        // ── Quality pass ───────────────────────────────────────────────────
        ctx.ui.setStatus("smart-commit", `${progress} — formatting & fixing...`);

        const nonDeleted = group.files.filter(f => f.status !== "D");
        const quality = await runQualityOnFiles(nonDeleted, repoRoot, pi);
        const qualitySummary = summarizeQuality(quality);

        // ── Stage only this group ──────────────────────────────────────────
        await stageFiles(group.files.map(f => f.absPath), cwd);

        // ── Build diff ────────────────────────────────────────────────────
        const relPaths = group.files.map(f => f.relPath);
        const [diffStat, diffBody] = await Promise.all([
          getDiffStatForFiles(relPaths, cwd),
          getDiffForFiles(relPaths, cwd),
        ]);

        activeCommitContext = { cwd, repoRoot, group, quality, diffStat };

        // ── Ask LLM ───────────────────────────────────────────────────────
        ctx.ui.setStatus(
          "smart-commit",
          `${progress} — quality: ${qualitySummary}`,
        );

        const prompt = buildCommitPrompt(group, diffStat, diffBody, quality);
        pi.sendUserMessage(prompt);

        // The LLM will now respond and call commit_message tool. The tool uses
        // activeCommitContext so it commits exactly this group's pathspec and
        // leaves unrelated staged files untouched. Run /commit again for the
        // next group after the commit succeeds.
      } catch (e: any) {
        ctx.ui.notify(`smart-commit failed: ${e?.message ?? String(e)}`, "error");
      } finally {
        ctx.ui.setStatus("smart-commit", "");
      }
    },
  });

  // ── commit_message tool ────────────────────────────────────────────────────

  pi.registerTool({
    name: "commit_message",
    label: "Commit Message",
    description: [
      "Commit staged changes with a conventional commit message.",
      "When invoked after /commit, only the active smart-commit group is committed.",
      "Validates the message follows conventional commit format before committing.",
    ].join(" "),
    parameters: CommitMessageParams,

    async execute(_toolCallId, params) {
      const context = activeCommitContext;
      const cwd = context?.cwd ?? process.cwd();
      const relPaths = context?.group.files.map(f => f.relPath) ?? [];

      const message = params.message?.trim() ?? "";
      if (!message) {
        return err("message is required");
      }

      if (!isValidConventionalCommit(message)) {
        return err(
          `Message does not follow conventional commit format (type(scope): description, 3-72 chars, no trailing period). Got: "${message.slice(0, 100)}"`,
        );
      }

      try {
        const sha = await commitWithMessage(message, cwd, relPaths);
        const commitStat = await getCommitStat(sha, cwd).catch(() => "");
        const unstagedDiff = params.include_unstaged && relPaths.length > 0
          ? await getDiffForFiles(relPaths, cwd, true).catch(() => "")
          : "";

        if (context) activeCommitContext = undefined;

        const details = {
          sha,
          message,
          committedFiles: relPaths,
          diffStat: context?.diffStat ?? commitStat,
          commitStat,
          quality: context?.quality ?? [],
          unstagedDiff: unstagedDiff || undefined,
        };

        const sections = [`✅ Committed: ${sha.slice(0, 8)}`, message];
        if (commitStat) sections.push("", commitStat);
        if (unstagedDiff) sections.push("", "Unstaged diff after commit:", unstagedDiff);

        return ok(sections.join("\n"), details);
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
