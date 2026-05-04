/**
 * Context Intelligence — Unified types
 */

// ─── Core ──────────────────────────────────────────────────────────────

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

// ─── Pruning ──────────────────────────────────────────────────────────

export interface PruningConfig {
  enabled: boolean;
  keepRecentCount: number;
  rules: string[];
}

export interface PruningMeta {
  shouldPrune?: boolean;
  pruneReason?: string;
  hash?: string;
  filePath?: string;
  isError?: boolean;
  errorResolved?: boolean;
  toolUseIds?: string[];
  hasToolUse?: boolean;
  hasToolResult?: boolean;
  protectedByRecency?: boolean;
  protectedByToolPairing?: boolean;
  [key: string]: unknown;
}

export interface ProcessContext {
  messages: import("@mariozechner/pi-coding-agent").AgentMessage[];
  metas: PruningMeta[];
  index: number;
  config: PruningConfig;
}

export interface PruneRule {
  name: string;
  description?: string;
  prepare?: (msg: import("@mariozechner/pi-coding-agent").AgentMessage, meta: PruningMeta, ctx: ProcessContext) => void;
  process?: (msg: import("@mariozechner/pi-coding-agent").AgentMessage, meta: PruningMeta, ctx: ProcessContext) => void;
}

// ─── Memory ───────────────────────────────────────────────────────────

export interface MemoryConfig {
  dbPath: string;
  lessonInjection: "all" | "selective";
  autoConsolidate: boolean;
  autoConsolidateMinMessages: number;
}

// ─── Automation ───────────────────────────────────────────────────────

export interface AutomationConfig {
  autoCompactThreshold: number;
  autoCompactEnabled: boolean;
  autoRecapEnabled: boolean;
  autoConsolidateEnabled: boolean;
  autoAdviseEnabled: boolean;
}

export interface AutoAdviceTrigger {
  id: string;
  check: (stats: SessionStats, ctx: any) => string | null;
  cooldownMs: number;
}

// ─── Unified Config ───────────────────────────────────────────────────

export interface ContextIntelConfig {
  enabled: boolean;
  pruning: PruningConfig;
  memory: MemoryConfig;
  automation: AutomationConfig;
}

export const DEFAULT_CONFIG: ContextIntelConfig = {
  enabled: true,
  pruning: {
    enabled: true,
    keepRecentCount: 10,
    rules: ["deduplication", "superseded-writes", "error-purging", "tool-pairing", "recency"],
  },
  memory: {
    dbPath: "~/.pi/context-intel/memory.db",
    lessonInjection: "selective",
    autoConsolidate: true,
    autoConsolidateMinMessages: 3,
  },
  automation: {
    autoCompactThreshold: 80,
    autoCompactEnabled: true,
    autoRecapEnabled: true,
    autoConsolidateEnabled: true,
    autoAdviseEnabled: true,
  },
};
