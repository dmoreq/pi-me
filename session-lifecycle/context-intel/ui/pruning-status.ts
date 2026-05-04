/**
 * Pruning Status — TUI status bar showing pruning statistics.
 */

export function updatePruningStatus(ctx: any, pruned: number, total: number): void {
  if (!ctx.hasUI) return;
  if (total === 0) {
    ctx.ui.setStatus("pruning-stats", ctx.ui.theme.fg("dim", "✂️  Pruning: --"));
    return;
  }
  const pct = Math.round((pruned / total) * 100);
  ctx.ui.setStatus("pruning-stats", ctx.ui.theme.fg("dim", `✂️  Pruning: ${pruned}/${total} (${pct}%)`));
}
