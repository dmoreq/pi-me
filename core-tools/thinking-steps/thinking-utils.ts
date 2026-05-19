/**
 * thinking-steps — pure helpers.
 */

export type ThinkingMode = "collapsed" | "summary" | "expanded" | "hidden";
export type PrefScope = "project" | "global";

export function appendDelta(current: string, delta: unknown): string {
  return typeof delta === "string" ? current + delta : current;
}

export function summarize(text: string, maxLen = 80): string {
  const cleaned = text.replace(/^[*\-•▪▸►»›\s]+/, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned || "Working...";
  const sliced = cleaned.slice(0, maxLen - 1).trimEnd();
  return `${sliced}…`;
}

export function detectSteps(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const steps: string[] = [];
  const markers = /^(\d+[.)]\s+|[-*+]\s+|(first|next|then|finally|now|step\s*\d+|let'?s|i(?:'ll|\s+will)|okay[,.]?)\s)/i;

  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "");
    const match = clean.match(markers);
    if (match) {
      const remainder = clean.slice(match[0].length);
      steps.push(summarize(remainder));
    }
  }

  if (steps.length === 0 && lines.length <= 5) {
    for (const line of lines.slice(0, 4)) steps.push(summarize(line));
  }

  return steps.length > 0 ? dedupe(steps) : ["Analyzing..."];
}

export function buildLabel(mode: ThinkingMode, text: string): string | undefined {
  if (mode === "expanded") return undefined;
  if (mode === "hidden") return "";

  const steps = detectSteps(text);
  if (mode === "collapsed") {
    const n = steps.filter(step => step !== "Analyzing...").length;
    return n > 0 ? `Thinking (${n} step${n !== 1 ? "s" : ""})...` : "Thinking...";
  }

  return steps.length > 0
    ? steps.map(step => `  • ${step}`).join("\n")
    : "Thinking...";
}

export function modeLabel(mode: ThinkingMode): string {
  switch (mode) {
    case "collapsed": return "Compact";
    case "summary": return "Summary";
    case "expanded": return "Expanded";
    case "hidden": return "Hidden";
  }
}

export function isValidThinkingMode(value: unknown): value is ThinkingMode {
  return value === "collapsed" || value === "summary" || value === "expanded" || value === "hidden";
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
