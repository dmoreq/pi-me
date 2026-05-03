/**
 * Task Orchestration v2: Persistence & State Management
 *
 * Implements:
 * - TaskStore (in-memory + file persistence)
 * - EventLog (audit trail for branch-replay)
 * - Branch-replay reconstruction
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Task, TaskStatus, TaskEvent, ITaskStore } from '../types';

/**
 * In-memory task store with optional file persistence
 *
 * Supports:
 * - CRUD operations
 * - Query by status
 * - Atomic updates
 * - File persistence (JSON)
 */
export class TaskStore implements ITaskStore {
  private tasks: Map<string, Task>;
  private filePath?: string;

  constructor(filePath?: string) {
    this.tasks = new Map();
    this.filePath = filePath;
    if (filePath && fs.existsSync(filePath)) {
      this.loadFromFile();
    }
  }

  /**
   * Save task to store and persist
   */
  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    if (this.filePath) {
      await this.persistToFile();
    }
  }

  /**
   * Load all tasks
   */
  async load(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  /**
   * Get single task by ID
   */
  async get(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  async getAll(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  /**
   * Get pending tasks
   */
  async getPending(): Promise<Task[]> {
    return this.getByStatus('pending' as TaskStatus);
  }

  /**
   * Get running tasks
   */
  async getRunning(): Promise<Task[]> {
    return this.getByStatus('in_progress' as TaskStatus);
  }

  /**
   * Get tasks by status
   */
  async getByStatus(status: TaskStatus): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Delete task (soft delete - mark as deleted)
   */
  async delete(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'deleted' as TaskStatus;
      await this.save(task);
    }
  }

  /**
   * Count tasks by status
   */
  async count(status?: TaskStatus): Promise<number> {
    if (!status) return this.tasks.size;
    return (await this.getByStatus(status)).length;
  }

  /**
   * Clear all tasks
   */
  async clear(): Promise<void> {
    this.tasks.clear();
    if (this.filePath) {
      await this.persistToFile();
    }
  }

  /**
   * Load from file
   */
  private loadFromFile(): void {
    if (!this.filePath) return;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const tasks: Task[] = JSON.parse(content);
      tasks.forEach(t => this.tasks.set(t.id, t));
    } catch (e) {
      // File doesn't exist or is invalid - start fresh
    }
  }

  /**
   * Persist to file
   */
  private async persistToFile(): Promise<void> {
    if (!this.filePath) return;
    const tasks = Array.from(this.tasks.values());
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(tasks, null, 2));
  }
}

/**
 * Event log for audit trail and branch-replay
 *
 * Supports:
 * - Event appending (immutable log)
 * - Querying by timestamp
 * - State reconstruction from events
 */
export class EventLog {
  private events: TaskEvent[];
  private filePath?: string;

  constructor(filePath?: string) {
    this.events = [];
    this.filePath = filePath;
    if (filePath && fs.existsSync(filePath)) {
      this.loadFromFile();
    }
  }

  /**
   * Append event to log
   */
  async append(event: TaskEvent): Promise<void> {
    this.events.push(event);
    if (this.filePath) {
      await this.persistToFile();
    }
  }

  /**
   * Get all events
   */
  async getAll(): Promise<TaskEvent[]> {
    return [...this.events];
  }

  /**
   * Get events since timestamp
   */
  async since(timestamp: string): Promise<TaskEvent[]> {
    return this.events.filter(e => new Date(e.timestamp) >= new Date(timestamp));
  }

  /**
   * Get events for specific task
   */
  async getForTask(taskId: string): Promise<TaskEvent[]> {
    return this.events.filter(e => e.taskId === taskId);
  }

  /**
   * Reconstruct task state from events
   */
  async reconstruct(taskId: string): Promise<Task | undefined> {
    const events = await this.getForTask(taskId);
    let task: Task | undefined;

    for (const event of events) {
      if (event.task) {
        task = event.task;
      }
    }

    return task;
  }

  /**
   * Reconstruct all tasks from events
   */
  async reconstructAll(): Promise<Map<string, Task>> {
    const tasks = new Map<string, Task>();
    const taskIds = new Set(this.events.map(e => e.taskId));

    for (const taskId of taskIds) {
      const task = await this.reconstruct(taskId);
      if (task) {
        tasks.set(taskId, task);
      }
    }

    return tasks;
  }

  /**
   * Clear all events
   */
  async clear(): Promise<void> {
    this.events = [];
    if (this.filePath) {
      await this.persistToFile();
    }
  }

  /**
   * Load from file
   */
  private loadFromFile(): void {
    if (!this.filePath) return;
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      this.events = JSON.parse(content);
    } catch (e) {
      // File doesn't exist or is invalid - start fresh
    }
  }

  /**
   * Persist to file
   */
  private async persistToFile(): Promise<void> {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.events, null, 2));
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }
}

/**
 * Combined state manager (store + event log)
 *
 * Manages both current state (store) and historical events (log)
 * for complete state reconstruction and debugging
 */
export class StateManager {
  private store: TaskStore;
  private eventLog: EventLog;

  constructor(storePath?: string, logPath?: string) {
    this.store = new TaskStore(storePath);
    this.eventLog = new EventLog(logPath);
  }

  /**
   * Save task and log event
   */
  async saveTask(task: Task, event: TaskEvent): Promise<void> {
    await this.store.save(task);
    await this.eventLog.append(event);
  }

  /**
   * Get store (read-only)
   */
  getStore(): TaskStore {
    return this.store;
  }

  /**
   * Get event log (read-only)
   */
  getEventLog(): EventLog {
    return this.eventLog;
  }

  /**
   * Reconstruct complete state from events
   */
  async reconstruct(): Promise<Map<string, Task>> {
    return this.eventLog.reconstructAll();
  }
}
