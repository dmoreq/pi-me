/**
 * Context Monitor — Single source of truth for session activity.
 *
 * Tracks: message/turn/tool counts, touched files, token usage, pruning stats.
 * Provides: compact suggestions, recap eligibility, unified stats snapshots.
 *
 * Originally: context-window (token tracking) + usage-extension (cost tracking)
 * merged into one lean module under the foundation umbrella.
 */

import type { TokenUsage, SessionStats } from "./types.ts";

export class ContextMonitor {
  private _messageCount = 0;
  private _turnCount = 0;
  private _toolCallCount = 0;
  private _bashCallCount = 0;
  private _touchedFiles = new Set<string>();
  private _tokenUsage: TokenUsage | null = null;
  private _prunedCount = 0;
  private _totalProcessed = 0;
  private _lastRecapAt = 0;
  private _sessionId = "";
  private _cwd = "";
  private _startedAt = Date.now();

  /** Reset all counters for a new session. */
  reset(sessionId: string, cwd: string): void {
    this._messageCount = 0;
    this._turnCount = 0;
    this._toolCallCount = 0;
    this._bashCallCount = 0;
    this._touchedFiles.clear();
    this._tokenUsage = null;
    this._prunedCount = 0;
    this._totalProcessed = 0;
    this._lastRecapAt = Date.now();
    this._sessionId = sessionId;
    this._cwd = cwd;
    this._startedAt = Date.now();
  }

  recordMessage(): void {
    this._messageCount++;
  }

  recordTurn(): void {
    this._turnCount++;
  }

  recordToolCall(name: string): void {
    this._toolCallCount++;
    if (name === "bash") this._bashCallCount++;
  }

  recordFileWrite(path: string): void {
    this._touchedFiles.add(path);
  }

  updateTokenUsage(usage: TokenUsage): void {
    this._tokenUsage = usage;
  }

  recordPruning(pruned: number, total: number): void {
    this._prunedCount += pruned;
    this._totalProcessed += total;
  }

  markRecap(): void {
    this._lastRecapAt = Date.now();
  }

  // ─── Getters ────────────────────────────────────────────────────────

  get messageCount(): number {
    return this._messageCount;
  }

  get toolCallCount(): number {
    return this._toolCallCount;
  }

  get fileCount(): number {
    return this._touchedFiles.size;
  }

  getStats(): SessionStats {
    return {
      sessionId: this._sessionId,
      cwd: this._cwd,
      startedAt: this._startedAt,
      messageCount: this._messageCount,
      turnCount: this._turnCount,
      toolCallCount: this._toolCallCount,
      bashCallCount: this._bashCallCount,
      prunedCount: this._prunedCount,
      totalProcessed: this._totalProcessed,
      touchedFiles: Array.from(this._touchedFiles).sort(),
      tokenUsage: this._tokenUsage ? { ...this._tokenUsage } : null,
    };
  }

  getContextUsageRatio(): number | null {
    if (!this._tokenUsage) return null;
    if (!this._tokenUsage.contextWindow || this._tokenUsage.contextWindow === 0) return null;
    return this._tokenUsage.total / this._tokenUsage.contextWindow;
  }

  getCompactSuggestion(): "critical" | "warn" | null {
    const ratio = this.getContextUsageRatio();
    if (ratio === null) return null;
    if (ratio >= 0.9) return "critical";
    if (ratio >= 0.8) return "warn";
    return null;
  }

  getRecapEligible(): boolean {
    return this._messageCount > 20 && Date.now() - this._lastRecapAt > 10 * 60 * 1000;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────

let _instance: ContextMonitor | null = null;

export function getContextMonitor(): ContextMonitor {
  if (!_instance) {
    _instance = new ContextMonitor();
  }
  return _instance;
}
