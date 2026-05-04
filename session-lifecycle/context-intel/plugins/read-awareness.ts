/**
 * Read Awareness Plugin — tracks file reads and blocks edits without prior reading.
 *
 * Migrated from core-tools/read-guard/ (standalone extension) into a ContextPlugin
 * that integrates with ContextIntelExtension.
 *
 * The plugin intercepts tool_call events to:
 * 1. Record file reads (toolName === "read")
 * 2. Check edits against read history (toolName === "edit")
 *
 * If the agent attempts to edit a file it hasn't read (or read sufficiently),
 * the edit is blocked with a message suggesting /trust-me or reading the file first.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ContextPlugin, PluginToolCallResult, ToolCallEvent } from "./plugin.ts";
import { existsSync } from "node:fs";
import { resolveFilePath } from "../../../shared/path-utils.js";

// ============================================================================
// Types
// ============================================================================

interface ReadRecord {
  path: string;
  offset: number;
  limit: number;
  timestamp: number;
}

// ============================================================================
// Read Awareness Plugin
// ============================================================================

export class ReadAwarenessPlugin implements ContextPlugin {
  readonly name = "read-awareness";

  private reads: Map<string, ReadRecord[]> = new Map();
  private exemptions: Set<string> = new Set();

  async onSessionStart(_ctx: ExtensionContext): Promise<void> {
    this.reads.clear();
    this.exemptions.clear();
  }

  async onSessionShutdown(): Promise<void> {
    this.reads.clear();
    this.exemptions.clear();
  }

  // ── Read tracking ──────────────────────────────────────────

  recordRead(filePath: string, offset: number, limit: number): void {
    const normalized = this.normalizePath(filePath);
    if (!normalized) return;

    if (!this.reads.has(normalized)) {
      this.reads.set(normalized, []);
    }

    this.reads.get(normalized)!.push({
      path: normalized,
      offset,
      limit,
      timestamp: Date.now(),
    });
  }

  // ── Exemption management ───────────────────────────────────

  addExemption(filePath: string): void {
    const normalized = this.normalizePath(filePath);
    if (normalized) this.exemptions.add(normalized);
  }

  // ── Edit check ─────────────────────────────────────────────

  checkEdit(filePath: string, touchedLines?: [number, number]): { block: boolean; reason?: string } {
    const normalized = this.normalizePath(filePath);
    if (!normalized) return { block: false };

    // Exempted?
    if (this.exemptions.has(normalized)) {
      this.exemptions.delete(normalized); // One-time use
      return { block: false };
    }

    // Check read history
    const fileReads = this.reads.get(normalized);
    if (!fileReads || fileReads.length === 0) {
      return {
        block: true,
        reason: `Read-before-edit: \`${filePath}\` hasn't been read yet. Use \`/trust-me ${filePath}\` to skip, or read the file first.`,
      };
    }

    // If we have line-level info, check coverage
    if (touchedLines) {
      const [start, end] = touchedLines;
      const hasCoverage = fileReads.some(r => r.offset <= start && (r.offset + r.limit) >= end);
      if (!hasCoverage) {
        return {
          block: true,
          reason: `Read-before-edit: the edit range (lines ${start}-${end}) wasn't fully read. Read more of \`${filePath}\` or use \`/trust-me ${filePath}\`.`,
        };
      }
    }

    return { block: false };
  }

  // ── Tool call interception ─────────────────────────────────

  async onToolCall(event: ToolCallEvent, _ctx: ExtensionContext): Promise<PluginToolCallResult | undefined> {
    const toolName = event.toolName;
    const input = event.input;

    // Track reads
    if (toolName === "read") {
      const filePath = (input.path as string) ?? (input.filePath as string);
      if (!filePath) return undefined;

      const resolvedPath = resolveFilePath(filePath);
      if (!existsSync(resolvedPath)) return undefined;

      const offset = (input.offset as number) ?? 1;
      const limit = (input.limit as number) ?? 1;
      this.recordRead(resolvedPath, offset, limit);
      return undefined;
    }

    // Check edits
    if (toolName === "edit") {
      const rawPath = (input.path as string) ?? "";
      if (!rawPath) return undefined;

      const resolvedPath = resolveFilePath(rawPath);

      // Estimate touched lines from edits
      const edits = (input.edits as Array<{ oldText?: string }>) ?? [];
      const allOldText = edits.map((e) => e.oldText ?? "").join("\n");
      const lineCount = allOldText ? allOldText.split("\n").length : 0;

      const verdict = this.checkEdit(
        resolvedPath,
        lineCount > 0 ? [1, lineCount] : undefined,
      );

      if (verdict.block) {
        return { block: true, reason: verdict.reason! };
      }
    }

    return undefined;
  }

  // ── Commands ───────────────────────────────────────────────

  registerCommands(pi: ExtensionAPI): void {
    pi.registerCommand("trust-me", {
      description: "Skip the read-before-edit guard for one edit. Usage: /trust-me <path>",
      handler: async (args, ctx) => {
        const rawTarget = Array.isArray(args) ? args[0] : String(args ?? "").trim();
        if (!rawTarget) {
          ctx.ui.notify("Just tell me the file path, like: `/trust-me some/file.ts` 😊", "info");
          return;
        }
        const targetPath = resolveFilePath(rawTarget, ctx.cwd);
        this.addExemption(targetPath);
        ctx.ui.notify(`👍 Got it! I'll skip the read check for \`${targetPath}\` — just this once!`, "info");
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  private normalizePath(filePath: string): string | null {
    try {
      return resolveFilePath(filePath);
    } catch {
      return null;
    }
  }

  /** For testing: get read count for a file */
  getReadCount(filePath: string): number {
    const normalized = this.normalizePath(filePath);
    if (!normalized) return 0;
    return this.reads.get(normalized)?.length ?? 0;
  }
}
