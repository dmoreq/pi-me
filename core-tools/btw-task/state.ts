/**
 * btw-task — In-memory state store.
 *
 * Module-level mutable state (same pattern as core-tools/todo/state/store.ts).
 * Persists across turns within the same session; lost on session end.
 */

import type { BtwStatus, BtwTask } from "./types.ts";

// ─── Module-level state ─────────────────────────────────────────────────

let tasks: BtwTask[] = [];
let nextId = 1;

// ─── Accessors ──────────────────────────────────────────────────────────

export function getTasks(): BtwTask[] {
	return tasks;
}

export function getNextId(): number {
	return nextId;
}

// ─── Mutators ───────────────────────────────────────────────────────────

/**
 * Add new tasks from an array of task texts.
 * Returns the newly created BtwTask[].
 */
export function addTasks(texts: string[]): BtwTask[] {
	const newTasks: BtwTask[] = texts.map((text, i) => ({
		id: nextId + i,
		text: text.trim(),
		status: "pending" as BtwStatus,
		fileHints: inferFileHints(text),
		groupId: -1,
	}));
	tasks = [...tasks, ...newTasks];
	nextId += newTasks.length;
	return newTasks;
}

/**
 * Update a single task's status by id. No-op if not found.
 */
export function updateTaskStatus(id: number, status: BtwStatus): void {
	tasks = tasks.map((t) => (t.id === id ? { ...t, status } : t));
}

/**
 * Update multiple tasks' group assignments.
 */
export function assignGroup(taskIds: number[], groupId: number): void {
	tasks = tasks.map((t) => (taskIds.includes(t.id) ? { ...t, groupId } : t));
}

/**
 * Clear all tasks and reset id counter.
 */
export function clearTasks(): void {
	tasks = [];
	nextId = 1;
}

/**
 * Remove only completed/failed tasks, keep pending/in_progress.
 */
export function clearCompleted(): void {
	tasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
	if (tasks.length === 0) nextId = 1;
}

/**
 * Get the N most recently added tasks, newest first.
 */
export function getRecent(limit = 3): BtwTask[] {
	return [...tasks].reverse().slice(0, limit);
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Infer file/code hints from task text.
 * Extracts words that look like filenames, module names, or key nouns.
 */
function inferFileHints(text: string): string[] {
	const hints: string[] = [];
	const words = text.toLowerCase().split(/\s+/);

	// Known tech keywords that suggest a module/area
	const techWords = ["auth", "login", "db", "database", "api", "ui", "test",
		"docs", "config", "middleware", "route", "hook", "migration",
		"schema", "model", "controller", "service", "component"];

	for (const word of words) {
		// Strip common suffixes for matching
		const stem = word.replace(/[.,!?;:]$/, "");
		if (techWords.includes(stem)) {
			hints.push(stem);
		}
		// Words ending in .ts, .js, .py, .json look like filenames
		if (/\.(ts|js|py|json|md|css|html)$/i.test(stem)) {
			hints.push(stem);
		}
	}

	return [...new Set(hints)];
}
