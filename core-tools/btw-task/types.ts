/**
 * btw-task — Shared type definitions.
 *
 * Data structures for the "By The Way" task dispatcher:
 * task parsing, dependency planning, and execution.
 */

export type BtwStatus = "pending" | "in_progress" | "completed" | "failed";

export interface BtwTask {
	id: number;
	text: string;
	status: BtwStatus;
	fileHints: string[];    // inferred from text for dependency analysis
	groupId: number;         // assigned by planner (-1 = unassigned)
}

export interface TaskGroup {
	id: number;
	tasks: BtwTask[];
	dependsOn: number[];    // group IDs that must finish first
	status: "waiting" | "running" | "done" | "failed";
}

export interface PlanResult {
	groups: TaskGroup[];
	tasks: BtwTask[];
}
