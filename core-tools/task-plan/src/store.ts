/**
 * Unified Task Store — persistent storage for tasks and plans.
 *
 * Merges:
 * - task-orchestration/src/persistence/state.ts (TaskStore, EventLog, StateManager)
 * - planning/plan-mode-core.ts (file-based plan read/write, locking, GC)
 *
 * Features:
 * - JSON file persistence per task (for simplicity) or single file store
 * - Locking with TTL to prevent concurrent session conflicts
 * - Configurable garbage collection
 * - Search & filtering
 * - Event log for audit trail
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Task, TaskEvent, TaskStatus, Priority, TaskIntent } from "./types.ts";

export const TASK_DIR_NAME = ".pi/tasks";
export const TASK_PATH_ENV = "PI_TASK_PATH";
export const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface LockInfo {
  id: string;
  pid: number;
  session?: string;
  createdAt: string;
}

export interface StoreConfig {
  dir: string;
  gcEnabled: boolean;
  gcDays: number; // Keep tasks/plans completed within N days
}

export interface SearchQuery {
  text?: string;
  status?: TaskStatus;
  intent?: TaskIntent;
  priority?: Priority;
  tags?: string[];
  source?: "auto" | "manual" | "migrated";
  assignedToSession?: string;
  hasReview?: boolean;
}

// ─── Locking ────────────────────────────────────────────────────────────────

function lockPath(dir: string, id: string): string {
  return path.join(dir, `${id}.lock`);
}

function taskPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export async function acquireLock(
  dir: string,
  id: string,
  session?: string,
  ctx?: { hasUI: boolean; ui: { confirm: (title: string, msg: string) => Promise<boolean> } },
): Promise<() => Promise<void>> {
  const lp = lockPath(dir, id);
  const now = Date.now();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.promises.open(lp, "wx");
      const info: LockInfo = {
        id,
        pid: process.pid,
        session,
        createdAt: new Date(now).toISOString(),
      };
      await handle.writeFile(JSON.stringify(info, null, 2), "utf8");
      await handle.close();
      return async () => {
        try {
          await fs.promises.unlink(lp);
        } catch {
          /* ignore */
        }
      };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== "EEXIST") {
        throw new Error(`Lock acquisition failed: ${err?.message}`);
      }
      // Stale lock check
      try {
        const stats = await fs.promises.stat(lp);
        const age = now - stats.mtimeMs;
        if (age <= LOCK_TTL_MS) {
          const raw = await fs.promises.readFile(lp, "utf8");
          const info: LockInfo = JSON.parse(raw);
          throw new Error(`Task/plan locked by session ${info.session ?? "unknown"} (PID ${info.pid})`);
        }
        // Stale — ask to steal if we have UI
        if (ctx?.hasUI) {
          const ok = await ctx.ui.confirm("Stale lock", `Lock for task ${id} is stale. Steal it?`);
          if (!ok) throw new Error(`Task ${id} remains locked.`);
        }
        await fs.promises.unlink(lp);
      } catch (e) {
        if (e instanceof Error && e.message.includes("remains locked")) throw e;
        if (e instanceof Error && e.message.includes("locked by session")) throw e;
        // File might have been deleted between stat and unlink
      }
    }
  }
  throw new Error(`Failed to acquire lock for ${id}`);
}

export async function readLockInfo(dir: string, id: string): Promise<LockInfo | null> {
  try {
    const raw = await fs.promises.readFile(lockPath(dir, id), "utf8");
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

// ─── Task Store ─────────────────────────────────────────────────────────────

export class TaskStore {
  private dir: string;
  private config: StoreConfig;
  private tasks = new Map<string, Task>();
  private events: TaskEvent[] = [];

  constructor(config?: Partial<StoreConfig>) {
    const envOverride = process.env[TASK_PATH_ENV];
    this.dir = config?.dir ?? envOverride ?? TASK_DIR_NAME;
    this.config = {
      dir: this.dir,
      gcEnabled: config?.gcEnabled ?? true,
      gcDays: config?.gcDays ?? 30,
    };
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  async init(): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    await this.loadFromDisk();
    if (this.config.gcEnabled) {
      await this.garbageCollect();
    }
  }

  private async loadFromDisk(): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(this.dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      if (entry.endsWith(".lock.json")) continue;
      const id = entry.slice(0, -5); // remove .json
      try {
        const raw = await fs.promises.readFile(path.join(this.dir, entry), "utf8");
        const task = JSON.parse(raw) as Task;
        this.tasks.set(id, task);
      } catch {
        // skip corrupt files
      }
    }
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    await this.writeToFile(task);
  }

  async get(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getAll(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
    const fp = taskPath(this.dir, id);
    try {
      await fs.promises.unlink(fp);
    } catch {
      /* ignore */
    }
  }

  async clear(): Promise<void> {
    this.tasks.clear();
    let entries: string[];
    try {
      entries = await fs.promises.readdir(this.dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        try {
          await fs.promises.unlink(path.join(this.dir, entry));
        } catch {
          /* ignore */
        }
      }
    }
  }

  // ─── Query ──────────────────────────────────────────────────────────────

  async search(query: SearchQuery): Promise<Task[]> {
    let results = Array.from(this.tasks.values());

    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        t =>
          t.text.toLowerCase().includes(q) ||
          t.title?.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q)),
      );
    }
    if (query.status) results = results.filter(t => t.status === query.status);
    if (query.intent) results = results.filter(t => t.intent === query.intent);
    if (query.priority) results = results.filter(t => t.priority === query.priority);
    if (query.tags?.length) {
      results = results.filter(t => query.tags!.some(tag => t.tags?.includes(tag)));
    }
    if (query.source) results = results.filter(t => t.source === query.source);
    if (query.assignedToSession) {
      results = results.filter(t => t.assignedToSession === query.assignedToSession);
    }
    if (query.hasReview !== undefined) {
      results = results.filter(t => t.requiresReview === query.hasReview);
    }

    return results;
  }

  async getByStatus(status: TaskStatus): Promise<Task[]> {
    return this.search({ status });
  }

  async getPending(): Promise<Task[]> {
    return this.getByStatus("pending");
  }

  async getRunning(): Promise<Task[]> {
    return this.getByStatus("in_progress");
  }

  async count(status?: TaskStatus): Promise<number> {
    if (!status) return this.tasks.size;
    return (await this.getByStatus(status)).length;
  }

  // ─── Event Log ──────────────────────────────────────────────────────────

  async appendEvent(event: TaskEvent): Promise<void> {
    this.events.push(event);
  }

  async getEvents(taskId?: string): Promise<TaskEvent[]> {
    if (taskId) return this.events.filter(e => e.taskId === taskId);
    return [...this.events];
  }

  // ─── Garbage Collection ────────────────────────────────────────────────

  async garbageCollect(): Promise<number> {
    const cutoff = Date.now() - this.config.gcDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [id, task] of this.tasks) {
      const isTerminal = ["completed", "failed", "skipped", "cancelled", "archived"].includes(task.status);
      if (!isTerminal) continue;
      const createdAt = Date.parse(task.createdAt);
      if (!Number.isFinite(createdAt)) continue;
      if (createdAt < cutoff) {
        await this.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private async writeToFile(task: Task): Promise<void> {
    const fp = taskPath(this.dir, task.id);
    await fs.promises.writeFile(fp, JSON.stringify(task, null, 2), "utf8");
  }

  getConfig(): StoreConfig {
    return { ...this.config };
  }

  getDir(): string {
    return this.dir;
  }
}

// ─── Session Assignment Helpers ─────────────────────────────────────────────

export function assignSession(task: Task, sessionId: string): Task {
  return { ...task, assignedToSession: sessionId };
}

export function requireReview(task: Task, requiresReview = true): Task {
  return { ...task, requiresReview };
}
