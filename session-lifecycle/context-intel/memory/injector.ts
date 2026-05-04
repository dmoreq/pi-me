/**
 * Builds a context block from memory for injection into the system prompt.
 *
 * Two modes:
 * - Selective (prompt provided): search semantic memory for entries relevant
 *   to the user's current prompt, plus always-inject lessons.
 * - Fallback (no prompt): dump top entries by prefix (old behavior).
 *
 * Ported from core-tools/memory/src/injector.ts. Zero logic changes.
 */

import type { MemoryStore, SemanticEntry, LessonEntry } from "./store.ts";

const MAX_CONTEXT_CHARS = 8000;
const SEARCH_LIMIT = 15;
const LESSON_SEARCH_LIMIT = 15;

export interface ContextBlock {
  text: string;
  stats: { semantic: number; lessons: number };
}

export type LessonInjectionMode = "all" | "selective";

export interface InjectorConfig {
  lessonInjection?: LessonInjectionMode;
}

export function buildContextBlock(store: MemoryStore, cwd?: string, prompt?: string, config?: InjectorConfig): ContextBlock {
  if (prompt?.trim()) return buildSelectiveBlock(store, prompt, cwd, config);
  return buildFallbackBlock(store, cwd);
}

function buildSelectiveBlock(store: MemoryStore, prompt: string, cwd?: string, config?: InjectorConfig): ContextBlock {
  const sections: string[] = [];
  let semanticCount = 0;
  let lessonCount = 0;
  const mode = config?.lessonInjection ?? "all";

  const results = store.searchSemantic(prompt, SEARCH_LIMIT);
  const slug = cwd ? projectSlug(cwd) : "";
  if (slug) {
    const projectResults = store.searchSemantic(slug, 5);
    const seen = new Set(results.map(r => r.key));
    for (const r of projectResults) {
      if (!seen.has(r.key)) { results.push(r); seen.add(r.key); }
    }
  }

  if (results.length > 0) {
    sections.push(formatSection("Relevant Memory", results.map(formatSemantic)));
    semanticCount = results.length;
    store.touchAccessed(results.map(r => r.key));
  }

  const lessons = mode === "selective" ? getRelevantLessons(store, prompt, cwd) : store.listLessons(undefined, 50);

  if (lessons.length > 0) {
    const corrections = lessons.filter(l => l.negative);
    const positives = lessons.filter(l => !l.negative);
    if (corrections.length > 0) {
      sections.push(formatSection("Learned Corrections", corrections.map(l => `DON'T: ${l.rule}${l.category !== "general" ? ` [${l.category}]` : ""}`)));
    }
    if (positives.length > 0) {
      sections.push(formatSection("Validated Approaches", positives.map(l => `${l.rule}${l.category !== "general" ? ` [${l.category}]` : ""}`)));
    }
    lessonCount = lessons.length;
  }

  if (sections.length === 0) return { text: "", stats: { semantic: 0, lessons: 0 } };

  let text = `<memory>\n${sections.join("\n")}\n\n${MEMORY_DRIFT_CAVEAT}\n</memory>`;
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS - 20) + "\n... (truncated)\n</memory>";
  return { text, stats: { semantic: semanticCount, lessons: lessonCount } };
}

function getRelevantLessons(store: MemoryStore, prompt: string, cwd?: string): LessonEntry[] {
  const seen = new Set<string>();
  const result: LessonEntry[] = [];
  function add(lessons: LessonEntry[]) {
    for (const l of lessons) {
      if (!seen.has(l.id)) { seen.add(l.id); result.push(l); }
    }
  }
  add(store.searchLessons(prompt, LESSON_SEARCH_LIMIT));
  const slug = cwd ? projectSlug(cwd) : "";
  if (slug) add(store.searchLessons(slug, 5));
  add(store.listLessons("general", 10));
  return result.slice(0, LESSON_SEARCH_LIMIT);
}

function buildFallbackBlock(store: MemoryStore, cwd?: string): ContextBlock {
  const sections: string[] = [];
  let semanticCount = 0;
  let lessonCount = 0;

  const prefs = store.listSemantic("pref.", 50);
  if (prefs.length > 0) { sections.push(formatSection("User Preferences", prefs.map(formatSemantic))); semanticCount += prefs.length; }

  const projects = store.listSemantic("project.", 50);
  const relevant = cwd ? projects.filter(p => p.key.includes(projectSlug(cwd)) || p.confidence >= 0.9) : projects;
  if (relevant.length > 0) { sections.push(formatSection("Project Context", relevant.map(formatSemantic))); semanticCount += relevant.length; }

  const tools = store.listSemantic("tool.", 20);
  if (tools.length > 0) { sections.push(formatSection("Tool Preferences", tools.map(formatSemantic))); semanticCount += tools.length; }

  const lessons = store.listLessons(undefined, 50);
  if (lessons.length > 0) {
    const corrections = lessons.filter(l => l.negative);
    const positives = lessons.filter(l => !l.negative);
    if (corrections.length > 0) sections.push(formatSection("Learned Corrections", corrections.map(l => `DON'T: ${l.rule}${l.category !== "general" ? ` [${l.category}]` : ""}`)));
    if (positives.length > 0) sections.push(formatSection("Validated Approaches", positives.map(l => `${l.rule}${l.category !== "general" ? ` [${l.category}]` : ""}`)));
    lessonCount = lessons.length;
  }

  const user = store.listSemantic("user.", 10);
  if (user.length > 0) { sections.push(formatSection("User", user.map(formatSemantic))); semanticCount += user.length; }

  if (sections.length === 0) return { text: "", stats: { semantic: 0, lessons: 0 } };

  let text = `<memory>\n${sections.join("\n")}\n\n${MEMORY_DRIFT_CAVEAT}\n</memory>`;
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS - 20) + "\n... (truncated)\n</memory>";
  return { text, stats: { semantic: semanticCount, lessons: lessonCount } };
}

// ─── Helpers ─────────────────────────────────────────────────────────

const STALE_WARNING_DAYS = 30;
const VERY_STALE_DAYS = 90;

function formatSection(title: string, items: string[]): string {
  return `## ${title}\n${items.map(i => `- ${i}`).join("\n")}`;
}

function formatSemantic(entry: SemanticEntry): string {
  const key = entry.key.split(".").slice(1).join(".");
  const ageDays = daysSince(entry.updated_at);
  const staleTag = ageDays >= VERY_STALE_DAYS
    ? ` ⚠️ ${ageDays}d old — verify before acting on this`
    : ageDays >= STALE_WARNING_DAYS ? ` (${ageDays}d ago)` : "";
  return `${key}: ${entry.value}${staleTag}`;
}

function daysSince(dateStr: string): number {
  try { return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); } catch { return 0; }
}

const MEMORY_DRIFT_CAVEAT = `## Before acting on memory
- Memory records can become stale. If a memory names a file, function, or flag — verify it still exists before recommending it.
- If a recalled memory conflicts with what you observe in the current code or project state, trust what you observe now.
- Memories about project state (deadlines, decisions, architecture) decay fastest — check if still relevant.`;

function projectSlug(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  const skip = new Set(["workplace", "local", "home", "src", "scratch"]);
  for (const p of parts.reverse()) {
    if (!skip.has(p.toLowerCase()) && p.length > 1) return p.toLowerCase();
  }
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}
