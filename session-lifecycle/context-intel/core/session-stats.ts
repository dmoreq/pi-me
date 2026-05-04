/**
 * Session Stats Collector — scan session logs for usage/cost data.
 *
 * Feeds both the /usage dashboard AND automation triggers.
 * Core data logic extracted from session-lifecycle/usage-extension/.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Types ────────────────────────────────────────────────────────────

export interface DailyCost {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  requests: number;
}

export interface ProviderCost {
  provider: string;
  displayName: string;
  days: DailyCost[];
  totalCost: number;
  totalRequests: number;
  models: Map<string, number>;
}

export interface UsageSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
  totalSessions: number;
  totalMessages: number;
  providers: Map<string, ProviderCost>;
}

// ─── Collector ────────────────────────────────────────────────────────

export class SessionStatsCollector {
  /**
   * Scan session logs for the last N days and aggregate cost data.
   */
  async scanLogs(daysBack: number = 30): Promise<ProviderCost[]> {
    const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
    const providerCosts = new Map<string, ProviderCost>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    if (!existsSync(sessionsDir)) return [];

    const sessionDirs = readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(sessionsDir, d.name));

    for (const dir of sessionDirs) {
      const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f));

      for (const file of files) {
        try {
          const content = readFileSync(file, "utf-8");
          const lines = content.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (!entry.cost && !entry.input && !entry.output) continue;

              const date = new Date(entry.timestamp || Date.now()).toISOString().slice(0, 10);
              if (new Date(date) < cutoffDate) continue;

              const provider = entry.provider || "unknown";
              if (!providerCosts.has(provider)) {
                providerCosts.set(provider, {
                  provider,
                  displayName: provider,
                  days: [],
                  totalCost: 0,
                  totalRequests: 0,
                  models: new Map(),
                });
              }

              const pc = providerCosts.get(provider)!;
              pc.totalCost += entry.cost || 0;
              pc.totalRequests++;

              if (entry.model) {
                pc.models.set(entry.model, (pc.models.get(entry.model) || 0) + 1);
              }

              let day = pc.days.find((d) => d.date === date);
              if (!day) {
                day = { date, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, requests: 0 };
                pc.days.push(day);
              }
              day.input += entry.input || 0;
              day.output += entry.output || 0;
              day.cacheRead += entry.cache_read || entry.cacheRead || 0;
              day.cacheWrite += entry.cache_write || entry.cacheWrite || 0;
              day.total += entry.input || 0 + entry.output || 0;
              day.requests++;
            } catch {
              // skip malformed lines
            }
          }
        } catch {
          // skip unreadable files
        }
      }
    }

    return Array.from(providerCosts.values());
  }

  /**
   * Build a summary of all usage data from logs.
   */
  async collectSummary(daysBack: number = 30): Promise<UsageSummary> {
    const providers = await this.scanLogs(daysBack);
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let totalCost = 0;
    let totalSessions = 0;
    let totalMessages = 0;

    const providerMap = new Map<string, ProviderCost>();
    for (const p of providers) {
      providerMap.set(p.provider, p);
      totalCost += p.totalCost;
      totalSessions += p.days.length;
      for (const d of p.days) {
        inputTokens += d.input;
        outputTokens += d.output;
        cacheReadTokens += d.cacheRead;
        cacheWriteTokens += d.cacheWrite;
        totalTokens += d.total;
        totalMessages += d.requests;
      }
    }

    return { totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalCost, totalSessions, totalMessages, providers: providerMap };
  }
}
