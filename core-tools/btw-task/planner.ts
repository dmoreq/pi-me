/**
 * btw-task — Dependency planner.
 *
 * Analyzes parsed tasks to determine which can run in parallel
 * and which have sequential dependencies.
 *
 * Dependency rules:
 *   - "fix X" → "test X" : test depends on fix
 *   - Tasks sharing a file hint : potential dependency
 *   - Tasks with no overlap : independent → parallel
 *   - Tasks taking about the same subject : sequential
 */

import type { BtwTask, PlanResult, TaskGroup } from "./types.ts";
import { addTasks, assignGroup, getTasks } from "./state.ts";

// ─── Known dependency patterns ──────────────────────────────────────────

interface DepPattern {
	precedes: RegExp;    // task A matches this → B depends on A
	follows: RegExp;     // task B matches this
}

const DEP_PATTERNS: DepPattern[] = [
	{ precedes: /\b(fix|add|implement|build|create|write)\s+(.+)/i, follows: /\b(test|review|verify|validate|check)\s+.+/i },
	{ precedes: /\b(refactor|rewrite|restructure)\s+(.+)/i, follows: /\b(test|migrate|deploy)\s+.+/i },
	{ precedes: /\b(design|plan|draft)\s+(.+)/i, follows: /\b(implement|build|code)\s+.+/i },
];

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Plan execution order for a set of task texts.
 *
 * 1. Creates BtwTask entries in state
 * 2. Infers dependencies from shared file hints and known patterns
 * 3. Groups tasks into sequential batches for execution
 *
 * @param taskTexts  Array of task descriptions
 * @returns          PlanResult with ordered groups + all tasks
 */
export function planTasks(taskTexts: string[]): PlanResult {
	// Create tasks in state
	const newTasks = addTasks(taskTexts);
	if (newTasks.length === 0) {
		return { groups: [], tasks: [] };
	}

	const allTasks = getTasks().filter((t) => newTasks.some((n) => n.id === t.id));

	// ── Build dependency graph ─────────────────────────────────
	// depMap: taskId → set of taskIds that must finish first
	const depMap = new Map<number, Set<number>>();
	for (const task of allTasks) {
		depMap.set(task.id, new Set());
	}

	// Rule 1: Known patterns (fix → test, etc.)
	for (const pattern of DEP_PATTERNS) {
		for (let i = 0; i < allTasks.length; i++) {
			for (let j = 0; j < allTasks.length; j++) {
				if (i === j) continue;
				const a = allTasks[i]!;
				const b = allTasks[j]!;

				const aPrecedes = a.text.match(pattern.precedes);
				const bFollows = b.text.match(pattern.follows);

				if (aPrecedes && bFollows) {
					// Check if they share the subject (e.g., "fix login" → "test login")
					const subjectA = aPrecedes[2]?.trim().toLowerCase();
					const subjectB = b.text
						.replace(pattern.follows, "")
						.trim()
						.toLowerCase();
					if (subjectA && subjectB && (subjectA === subjectB || subjectB.includes(subjectA) || subjectA.includes(subjectB))) {
						depMap.get(b.id)!.add(a.id);
					}
				}
			}
		}
	}

	// Rule 2: Shared file hints create implicit dependency
	for (let i = 0; i < allTasks.length; i++) {
		for (let j = 0; j < allTasks.length; j++) {
			if (i === j) continue;
			const a = allTasks[i]!;
			const b = allTasks[j]!;
			const shared = a.fileHints.filter((h) => b.fileHints.includes(h));
			if (shared.length > 0) {
				// If they share a file hint and one is "later stage" (test, deploy), it depends
				if (/\b(test|review|deploy|migrate)\b/i.test(b.text)) {
					depMap.get(b.id)!.add(a.id);
				} else if (/\b(test|review|deploy|migrate)\b/i.test(a.text)) {
					depMap.get(a.id)!.add(b.id);
				} else {
					// Both are "doing" tasks on same file — keep sequential by index order
					if (j > i) depMap.get(b.id)!.add(a.id);
				}
			}
		}
	}

	// ── Topological sort into groups ───────────────────────────
	const groups: TaskGroup[] = [];
	const visited = new Set<number>();
	let groupId = 0;

	// Kahn's algorithm: repeatedly pick tasks with no unresolved deps
	const remaining = new Set(allTasks.map((t) => t.id));
	while (remaining.size > 0) {
		const currentGroup: BtwTask[] = [];
		const ready: number[] = [];

		for (const taskId of remaining) {
			const deps = depMap.get(taskId)!;
			const unresolvedDeps = [...deps].filter((d) => remaining.has(d));
			if (unresolvedDeps.length === 0) {
				ready.push(taskId);
			}
		}

		if (ready.length === 0) {
			// Cycle or all remaining depend on each other — put one in the group
			ready.push([...remaining][0]!);
		}

		for (const taskId of ready) {
			remaining.delete(taskId);
			visited.add(taskId);
			const task = allTasks.find((t) => t.id === taskId)!;
			currentGroup.push({ ...task, groupId });
		}

		const group: TaskGroup = {
			id: groupId,
			tasks: currentGroup,
			dependsOn: groupId > 0 ? [groupId - 1] : [],
			status: "waiting",
		};
		groups.push(group);
		groupId++;

		// Assign group IDs in state
		assignGroup(
			currentGroup.map((t) => t.id),
			group.id,
		);
	}

	return { groups, tasks: allTasks };
}
