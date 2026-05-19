/**
 * smart-commit — LLM prompt builder
 *
 * Produces the message sent to the LLM asking it to generate a
 * conventional commit message for one group of files.
 * The LLM should respond by calling the commit_message tool with the message.
 */

import type { CommitGroup, QualityResult } from "./types.ts";

const COMMIT_TYPES = "feat, fix, docs, style, refactor, test, chore, perf, ci, build";

function statusLabel(s: string): string {
  switch (s) {
    case "A": return "added";
    case "D": return "deleted";
    case "R": return "renamed";
    case "M": return "modified";
    default:  return "changed";
  }
}

export function buildCommitPrompt(
  group: CommitGroup,
  diffStat: string,
  diffBody: string,
  quality: QualityResult[],
): string {
  const scopePart = group.scope ? `(${group.scope})` : "";
  const fileLines = group.files
    .map(f => `  ${f.relPath} [${statusLabel(f.status)}]`)
    .join("\n");

  const qualityNote = quality.length > 0
    ? quality
        .filter(q => q.formatted || q.fixed || q.errors.length > 0)
        .map(q => {
          const parts: string[] = [];
          if (q.formatted) parts.push("formatted");
          if (q.fixed) parts.push(`fixed ${q.fixCount} lint issue(s)`);
          q.errors.forEach(e => parts.push(`⚠️ ${e}`));
          return `  ${q.file}: ${parts.join(", ")}`;
        })
        .join("\n")
    : "";

  const lines = [
    `Generate a conventional commit message for the following group of changes.`,
    ``,
    `Format: type${scopePart}: description`,
    `Valid types: ${COMMIT_TYPES}`,
    group.scope
      ? `The scope is already determined: use exactly "${group.scope}"`
      : `These are root-level files — omit the scope parentheses.`,
    ``,
    `Rules:`,
    `  - Subject line must be 72 characters or fewer`,
    `  - Use imperative mood ("add" not "added")`,
    `  - Do not end with a period`,
    `  - Reply with ONLY the commit message — no explanation, no markdown`,
    ``,
    `── Files in this group ──────────────────────────────────────────────────`,
    fileLines,
    ``,
    `── Diff summary ─────────────────────────────────────────────────────────`,
    diffStat,
  ];

  if (qualityNote) {
    lines.push(``, `── Auto-quality changes applied ────────────────────────────────────────`);
    lines.push(qualityNote);
  }

  lines.push(
    ``,
    `── Diff (first 6000 chars) ──────────────────────────────────────────────`,
    diffBody,
    ``,
    `Now call the commit_message tool with the commit message you generate.`,
  );

  return lines.join("\n");
}
