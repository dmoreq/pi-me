/**
 * Context Monitor — Shared types.
 *
 * Part of the foundation umbrella extension.
 * Provides session stats tracking, token usage monitoring, and cost calculation.
 */

export interface TokenUsage {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  contextWindow: number;
}

export interface SessionStats {
  sessionId: string;
  cwd: string;
  startedAt: number;
  messageCount: number;
  turnCount: number;
  toolCallCount: number;
  bashCallCount: number;
  prunedCount: number;
  totalProcessed: number;
  touchedFiles: string[];
  tokenUsage: TokenUsage | null;
}

export interface CostEntry {
  provider: string;
  model: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  sessionCount: number;
}
