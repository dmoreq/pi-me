/**
 * Context Widget — token usage bar for the TUI footer.
 * Replaces foundation/context-window/context-window.ts
 */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function buildBar(ratio: number, width: number): string {
  const filled = Math.max(1, Math.floor(ratio * width));
  const empty = width - filled;
  let barChar: string;
  if (ratio >= 0.9) barChar = "█";
  else if (ratio >= 0.7) barChar = "▓";
  else barChar = "░";
  return barChar.repeat(filled) + " ".repeat(empty);
}

export function updateContextWidget(ctx: any, ratio: number | null, total: number, max: number): void {
  if (!ctx.hasUI) return;
  if (ratio === null || total === 0) {
    ctx.ui.setWidget("context", ["", "  Context: monitoring..."]);
    return;
  }
  const pct = Math.round(ratio * 100);
  const bar = buildBar(ratio, 20);
  ctx.ui.setWidget("context", ["", `  Context: [${bar}] ${pct}% (${formatTokens(total)}/${formatTokens(max)})`]);

  if (pct >= 90) {
    ctx.ui.setStatus("context-warn", ctx.ui.theme.fg("dim", `📊  Context: ${pct}%`));
    ctx.ui.notify(`Context at ${pct}% — auto-compacting soon.`, "warning");
  } else if (pct >= 70) {
    ctx.ui.setStatus("context-warn", ctx.ui.theme.fg("dim", `📊  Context: ${pct}%`));
  } else {
    ctx.ui.setStatus("context-warn", undefined);
  }
}
