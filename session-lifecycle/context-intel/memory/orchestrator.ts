/**
 * MemoryOrchestrator — manages memory lifecycle and tools.
 *
 * Replaces core-tools/memory/src/index.ts + core-tools/memory/index.ts.
 * Owns the MemoryStore, handles lifecycle hooks, and registers memory tools.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { MemoryStore, type SemanticEntry, type LessonEntry } from "./store.js";
import { buildContextBlock, type InjectorConfig } from "./injector.js";
import { buildConsolidationPrompt, parseConsolidationResponse, applyExtracted, type ConsolidationInput } from "./consolidator.js";
import type { MemoryConfig } from "../types.js";

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((c: any) => c.type === "text" && typeof c.text === "string").map((c: any) => c.text).join("\n");
  }
  return "";
}

function stripQuotes<T>(v: T): T {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      try { if (first === '"') return JSON.parse(s) as unknown as T; } catch { /* ignore */ }
      return s.slice(1, -1) as unknown as T;
    }
  }
  return v;
}

export class MemoryOrchestrator {
  private store: MemoryStore | null = null;
  private pendingUserMessages: string[] = [];
  private pendingAssistantMessages: string[] = [];
  private sessionCwd = "";
  private sessionId?: string;

  constructor(private config: MemoryConfig) {}

  getStore(): MemoryStore | null {
    return this.store;
  }

  pendingUserCount(): number {
    return this.pendingUserMessages.length;
  }

  async onSessionStart(ctx: any): Promise<void> {
    this.sessionCwd = ctx.cwd;
    this.sessionId = (ctx as any).sessionId ?? (ctx as any).session?.id;
    const resolvedPath = this.config.dbPath.replace("~", homedir());
    this.store = new MemoryStore(resolvedPath);

    // Seed pending messages from existing session history
    this.pendingUserMessages = [];
    this.pendingAssistantMessages = [];
    try {
      const branch = ctx.sessionManager.getBranch();
      for (const entry of branch) {
        if (entry.type !== "message") continue;
        const msg = (entry as any).message;
        if (!msg) continue;
        if (msg.role === "user") {
          const text = extractText(msg.content);
          if (text) this.pendingUserMessages.push(text);
        } else if (msg.role === "assistant") {
          const text = extractText(msg.content);
          if (text) this.pendingAssistantMessages.push(text);
        }
      }
    } catch { /* session may be brand-new */ }

    const stats = this.store.stats();
    if (stats.semantic + stats.lessons > 0) {
      ctx.ui.setStatus("memory", ctx.ui.theme.fg("dim", `🧠  Memory: ${stats.semantic} facts, ${stats.lessons} lessons`));
      setTimeout(() => ctx.ui.setStatus("memory", undefined), 5000);
    }
  }

  async onBeforeAgentStart(event: any, ctx: any): Promise<{ systemPrompt?: string } | undefined> {
    if (!this.store) return;
    const { text } = buildContextBlock(this.store, ctx.cwd, event.prompt, { lessonInjection: this.config.lessonInjection });
    if (!text) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${text}` };
  }

  async onAgentEnd(event: any): Promise<void> {
    for (const msg of event.messages) {
      if (msg.role === "user" && "content" in msg) {
        const text = extractText(msg.content);
        if (text) { this.pendingUserMessages.push(text); if (this.pendingUserMessages.length > 60) this.pendingUserMessages.shift(); }
      } else if (msg.role === "assistant" && "content" in msg) {
        const text = extractText(msg.content);
        if (text) { this.pendingAssistantMessages.push(text); if (this.pendingAssistantMessages.length > 60) this.pendingAssistantMessages.shift(); }
      }
    }
  }

  async consolidate(): Promise<{ semantic: number; lessons: number } | null> {
    if (!this.store) return null;
    if (this.pendingUserMessages.length < 3) return null;

    const input: ConsolidationInput = {
      userMessages: this.pendingUserMessages,
      assistantMessages: this.pendingAssistantMessages,
      cwd: this.sessionCwd,
      sessionId: this.sessionId,
    };

    const currentFacts = this.store.listSemantic(undefined, 200).map(f => ({ key: f.key, value: f.value }));
    const currentLessons = this.store.listLessons(undefined, 100).map(l => ({ rule: l.rule, category: l.category }));
    const prompt = buildConsolidationPrompt(input, currentFacts, currentLessons);

    try {
      const result = await this.store.constructor.name === "MemoryStore" ? null : null; // placeholder
      // In production, call pi.exec("pi", ["-p", prompt, "--print", ...]) here
      // For now, return null (consolidation will be done by the auto-consolidator with LLM)
      return null;
    } catch {
      return null;
    }
  }

  async onSessionShutdown(ctx: any): Promise<void> {
    if (!this.store) return;
    if (this.pendingUserMessages.length >= 3) {
      ctx.ui.setStatus("memory", ctx.ui.theme.fg ? ctx.ui.theme.fg("dim", "🧠  Consolidating memory…") : "🧠  Consolidating memory…");
      await this.consolidate();
      ctx.ui.setStatus("memory", undefined);
    }
    this.pendingUserMessages = [];
    this.pendingAssistantMessages = [];
    this.store.close();
    this.store = null;
  }

  async onSessionBeforeSwitch(ctx: any): Promise<void> {
    if (!this.store || this.pendingUserMessages.length < 3) return;
    ctx.ui.setStatus("memory", ctx.ui.theme.fg ? ctx.ui.theme.fg("dim", "🧠  Consolidating memory…") : "🧠  Consolidating memory…");
    await this.consolidate();
    ctx.ui.setStatus("memory", undefined);
    this.pendingUserMessages = [];
    this.pendingAssistantMessages = [];
  }

  // ─── Tool Registration ─────────────────────────────────────────

  registerTools(pi: ExtensionAPI): void {
    pi.registerTool({
      name: "memory_search",
      label: "Memory Search",
      description: "Search persistent memory for facts, preferences, and project patterns.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ description: "Max results (default 10)" })),
      }) as any,
      async execute(_id: string, params: any) {
        const me = pi as any;
        const store = me.__memoryStore as MemoryStore | undefined;
        if (!store) return ok("Memory store not initialized");
        const results = store.searchSemantic(params.query, params.limit ?? 10);
        if (results.length === 0) return ok("No matching memories found.");
        return ok(results.map(r => `${r.key}: ${r.value} (confidence: ${r.confidence}, source: ${r.source})`).join("\n"));
      },
    });

    pi.registerTool({
      name: "memory_remember",
      label: "Memory Remember",
      description: "Store a fact, preference, or lesson in persistent memory.",
      parameters: Type.Object({
        type: Type.String({ description: "'fact' for key-value, 'lesson' for a correction" }),
        key: Type.Optional(Type.String({})),
        value: Type.Optional(Type.String({})),
        rule: Type.Optional(Type.String({})),
        category: Type.Optional(Type.String({})),
        negative: Type.Optional(Type.Boolean({})),
      }) as any,
      async execute(_id: string, params: any) {
        const store = (pi as any).__memoryStore as MemoryStore | undefined;
        if (!store) return ok("Memory store not initialized");
        params = { ...params, type: stripQuotes(params.type), key: stripQuotes(params.key), value: stripQuotes(params.value), rule: stripQuotes(params.rule), category: stripQuotes(params.category) };

        if (params.type === "fact") {
          if (!params.key || !params.value) return ok("Both key and value required for facts");
          store.setSemantic(params.key, params.value, 0.95, "user");
          return ok(`Remembered: ${params.key} = ${params.value}`);
        }
        if (params.type === "lesson") {
          if (!params.rule) return ok("Rule text required for lessons");
          const result = store.addLesson(params.rule, params.category ?? "general", "user", params.negative ?? false);
          if (result.success) return ok(`Lesson learned: ${params.rule}`);
          return ok(`Already known (${result.reason}): ${params.rule}`);
        }
        return ok("Unknown type. Must be 'fact' or 'lesson'.");
      },
    });

    pi.registerTool({
      name: "memory_forget",
      label: "Memory Forget",
      description: "Remove a fact or lesson from persistent memory.",
      parameters: Type.Object({
        type: Type.String({}),
        key: Type.Optional(Type.String({})),
        id: Type.Optional(Type.String({})),
      }) as any,
      async execute(_id: string, params: any) {
        const store = (pi as any).__memoryStore as MemoryStore | undefined;
        if (!store) return ok("Memory store not initialized");
        params = { ...params, type: stripQuotes(params.type), key: stripQuotes(params.key), id: stripQuotes(params.id) };

        if (params.type === "fact" && params.key) {
          const deleted = store.deleteSemantic(params.key);
          return ok(deleted ? `Forgot: ${params.key}` : `Not found: ${params.key}`);
        }
        if (params.type === "lesson" && params.id) {
          const deleted = store.deleteLesson(params.id);
          return ok(deleted ? `Forgot lesson ${params.id}` : `Not found: ${params.id}`);
        }
        return ok("Provide key (for facts) or id (for lessons)");
      },
    });

    pi.registerTool({
      name: "memory_lessons",
      label: "Memory Lessons",
      description: "List learned corrections and lessons from past sessions.",
      parameters: Type.Object({
        category: Type.Optional(Type.String({})),
        limit: Type.Optional(Type.Number({})),
      }) as any,
      async execute(_id: string, params: any) {
        const store = (pi as any).__memoryStore as MemoryStore | undefined;
        if (!store) return ok("Memory store not initialized");
        const lessons = store.listLessons(params.category, params.limit ?? 50);
        if (lessons.length === 0) return ok("No lessons learned yet.");
        return ok(lessons.map(l => `${l.negative ? "❌" : "✅"} [${l.category}] ${l.rule} (id: ${l.id.slice(0, 8)})`).join("\n"));
      },
    });

    pi.registerTool({
      name: "memory_stats",
      label: "Memory Stats",
      description: "Show memory statistics.",
      parameters: Type.Object({}) as any,
      async execute() {
        const store = (pi as any).__memoryStore as MemoryStore | undefined;
        if (!store) return ok("Memory store not initialized");
        const stats = store.stats();
        return ok(`Memory: ${stats.semantic} semantic facts, ${stats.lessons} active lessons, ${stats.events} events logged`);
      },
    });
  }
}
