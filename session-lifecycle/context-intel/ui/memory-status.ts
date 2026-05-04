/**
 * Memory Status — TUI status bar showing memory statistics.
 */

export function updateMemoryStatus(ctx: any, facts: number, lessons: number): void {
  if (!ctx.hasUI) return;
  if (facts === 0 && lessons === 0) {
    ctx.ui.setStatus("memory-stats", ctx.ui.theme.fg("dim", "🧠  Memory: no data yet"));
    return;
  }
  ctx.ui.setStatus("memory-stats", ctx.ui.theme.fg("dim", `🧠  Memory: ${facts} facts, ${lessons} lessons`));
}
