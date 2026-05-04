/**
 * Consolidator — extracts structured knowledge from session conversations.
 *
 * After a session ends (or on demand), reads the conversation and uses an
 * LLM to extract preferences, project patterns, corrections/lessons.
 *
 * Ported from core-tools/memory/src/consolidator.ts. Zero logic changes.
 */
import type { MemoryStore } from "./store.ts";

export interface ConsolidationInput {
  userMessages: string[];
  assistantMessages: string[];
  cwd?: string;
  sessionId?: string;
}

export interface ExtractedMemory {
  semantic: Array<{ key: string; value: string; confidence: number }>;
  lessons: Array<{ rule: string; category: string; negative: boolean }>;
}

export const CONSOLIDATION_PROMPT = `You are a memory extraction system. Analyze this conversation and extract structured knowledge.

Extract ONLY concrete, reusable facts — not summaries of what happened. Focus on:

1. **User preferences** (key prefix: pref.) — coding style, tool preferences, workflow habits
2. **Project patterns** (key prefix: project.<name>.) — languages, frameworks, architecture decisions
3. **Tool preferences** (key prefix: tool.) — which tools to prefer/avoid, how to use them
4. **Corrections/lessons** — things the user corrected, mistakes to avoid
5. **Validated approaches** — things the user explicitly confirmed worked well

## What NOT to extract:
- Code patterns, architecture, file paths, project structure (derivable from the project)
- Git history, recent changes (git log/blame is authoritative)
- Debugging solutions or fix recipes (the fix is in the code)
- Anything already in AGENTS.md, CLAUDE.md, or project config files
- Ephemeral task details, activity summaries, file contents

Rules:
- Only extract if confidence >= 0.8
- Key format: lowercase, dots as separators, no spaces
- Keep values concise (under 200 chars)

Respond with ONLY valid JSON matching this schema:
{ "semantic": [{ "key": "string", "value": "string", "confidence": number }], "lessons": [{ "rule": "string", "category": "string", "negative": boolean }] }

If nothing worth extracting, return: { "semantic": [], "lessons": [] }`;

export function buildConsolidationPrompt(
  input: ConsolidationInput,
  currentFacts?: { key: string; value: string }[],
  currentLessons?: { rule: string; category: string }[],
): string {
  const messages: string[] = [];
  let memorySection = "";

  if ((currentFacts && currentFacts.length > 0) || (currentLessons && currentLessons.length > 0)) {
    const parts: string[] = ["## Current Memory State"];
    if (currentFacts && currentFacts.length > 0) {
      parts.push("Already stored (avoid duplicating):");
      let chars = 0;
      for (const f of currentFacts) {
        const line = `- ${f.key}: ${f.value.length > 120 ? f.value.slice(0, 120) + "…" : f.value}`;
        if (chars + line.length > 1500) { parts.push("- ... (truncated)"); break; }
        parts.push(line);
        chars += line.length;
      }
    }
    if (currentLessons && currentLessons.length > 0) {
      parts.push("\nAnd these lessons:");
      let chars = 0;
      for (const l of currentLessons) {
        const line = `- [${l.category}] ${l.rule.length > 120 ? l.rule.slice(0, 120) + "…" : l.rule}`;
        if (chars + line.length > 500) { parts.push("- ... (truncated)"); break; }
        parts.push(line);
        chars += line.length;
      }
    }
    memorySection = parts.join("\n") + "\n\n";
  }

  const maxPairs = 30;
  const len = Math.min(input.userMessages.length, maxPairs);
  for (let i = 0; i < len; i++) {
    const userMsg = input.userMessages[i];
    if (userMsg) messages.push(`User: ${truncate(userMsg, 1000)}`);
    const assistantMsg = input.assistantMessages[i];
    if (assistantMsg) messages.push(`Assistant: ${truncate(assistantMsg, 500)}`);
  }

  return `${CONSOLIDATION_PROMPT}\n\n${memorySection}${input.cwd ? `Working directory: ${input.cwd}\n` : ""}\n## Conversation\n\n${messages.join("\n\n")}`;
}

export function parseConsolidationResponse(text: string): ExtractedMemory {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return { semantic: [], lessons: [] };

  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    const result: ExtractedMemory = { semantic: [], lessons: [] };

    if (Array.isArray(parsed.semantic)) {
      for (const s of parsed.semantic) {
        if (typeof s.key === "string" && typeof s.value === "string" && typeof s.confidence === "number") {
          if (s.confidence >= 0.8 && s.key.length >= 2 && s.key.length <= 100 && s.value.length <= 500) {
            result.semantic.push({ key: s.key, value: s.value, confidence: s.confidence });
          }
        }
      }
    }

    if (Array.isArray(parsed.lessons)) {
      for (const l of parsed.lessons) {
        if (typeof l.rule === "string" && l.rule.trim().length > 0) {
          result.lessons.push({ rule: l.rule.trim(), category: typeof l.category === "string" ? l.category : "general", negative: !!l.negative });
        }
      }
    }

    return result;
  } catch {
    return { semantic: [], lessons: [] };
  }
}

export function applyExtracted(store: MemoryStore, extracted: ExtractedMemory, source = "consolidation"): { semantic: number; lessons: number } {
  let semanticCount = 0;
  let lessonCount = 0;

  for (const s of extracted.semantic) {
    if (isDerivableOrEphemeral(s.key, s.value)) continue;
    store.setSemantic(s.key, s.value, s.confidence, "consolidation");
    semanticCount++;
  }

  for (const l of extracted.lessons) {
    const result = store.addLesson(l.rule, l.category, source, l.negative);
    if (result.success) lessonCount++;
  }

  return { semantic: semanticCount, lessons: lessonCount };
}

function isDerivableOrEphemeral(key: string, value: string): boolean {
  const kl = key.toLowerCase();
  const vl = value.toLowerCase();

  if (kl.includes("filepath") || kl.includes("file_path") || kl.includes("directory")) return true;
  if (/^project\.\w+\.(path|dir|location|structure|layout|architecture)$/.test(kl)) return true;
  if (kl.includes("commit") || kl.includes("git.history") || kl.includes("git.recent")) return true;
  if (vl.startsWith("today ") || vl.startsWith("we worked on") || vl.startsWith("this session")) return true;
  if (vl.includes("```") && vl.length > 300) return true;
  if (kl.includes("current_task") || kl.includes("in_progress") || kl.includes("investigating")) return true;

  return false;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
