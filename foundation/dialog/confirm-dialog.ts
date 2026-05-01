import type { QuestionnaireResult } from "./tool/types.js";
import type { WrappingSelectItem } from "./view/components/wrapping-select.js";

export interface ConfirmOption {
  label: string;
  description: string;
}

/**
 * Build WrappingSelectItem list for use with QuestionnaireSession.
 * Unlike buildItemsForQuestion, this adds no sentinel rows ("Type something.", "Chat about this")
 * since confirmation dialogs don't need free-text or chat escape hatches.
 */
export function buildConfirmItems(options: ConfirmOption[]): WrappingSelectItem[] {
  return options.map((o) => ({ kind: "option" as const, label: o.label, description: o.description }));
}

/**
 * Show a structured confirmation dialog using the full QuestionnaireSession TUI.
 * Supports up to 9 options (not capped at MAX_OPTIONS=4 — that limit is for the LLM tool only).
 * Returns the selected option label, or null if cancelled or no UI.
 */
export async function confirmDialog(
  ctx: any,
  question: string,
  options: ConfirmOption[],
  header = "Confirm",
): Promise<string | null> {
  if (!ctx.hasUI) return null;

  const items = buildConfirmItems(options);

  // MAX_OPTIONS=4 is enforced at the LLM tool boundary (validateQuestionnaire),
  // not inside QuestionnaireSession itself. confirmDialog is not an agent tool call.
  const params = {
    questions: [{
      question,
      header: header.slice(0, 12),
      options: options.map((o) => ({ label: o.label, description: o.description })),
    }],
  } as any;

  // Dynamic import: QuestionnaireSession transitively loads @mariozechner/pi-coding-agent
  // which is ESM-only. Deferring the import keeps buildConfirmItems unit-testable in CJS mode.
  const { QuestionnaireSession } = await import("./state/questionnaire-session.js");

  const result = await ctx.ui.custom<QuestionnaireResult>((tui: any, theme: any, _kb: any, done: any) => {
    const session = new QuestionnaireSession({ tui, theme, params, itemsByTab: [items], done });
    return session.component;
  });

  if (!result || result.cancelled || result.answers.length === 0) return null;
  const answer = result.answers[0];
  if (!answer) return null;
  if (answer.kind === "chat") return null;
  return answer.answer;
}
