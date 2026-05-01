import type { Message } from "@mariozechner/pi-ai";
import type { AgentScope } from "./agents.js";

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface SingleResult {
	agent: string;
	agentSource: "user" | "project" | "builtin" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
	sessionFile?: string; // Path to subagent's session file
}

export interface SubagentDetails {
	mode: "single" | "chain";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

export interface LoopIterationResult {
	index: number;
	details: SubagentDetails;
	output: string;
	isError?: boolean;
}

export interface LoopPromptItem {
	agent: string;
	task: string;
	model?: string;
	thinking?: string;
}

export interface LoopPromptInfo {
	mode: "single" | "chain";
	items: LoopPromptItem[];
}

export type LoopRunStatus = "idle" | "running" | "paused" | "stopping";

export interface RalphLoopDetails {
	iterations: LoopIterationResult[];
	stopReason: string;
	conditionCommand: string;
	conditionSource: "provided" | "inferred" | "default";
	maxIterations: number | null;
	sleepMs: number;
	lastCondition: { stdout: string; stderr: string; exitCode: number };
	prompt: LoopPromptInfo;
	steering: string[];
	followUps: string[];
	steeringSent: string[];
	followUpsSent: string[];
	status: LoopRunStatus;
}

export interface LoopControlState {
	status: LoopRunStatus;
	runId: string | null;
	iterations: number;
	steering: string[];
	steeringOnce: string[];
	followUps: string[];
	steeringSent: string[];
	followUpsSent: string[];
	paused: boolean;
	abortController: AbortController | null;
	lastDetails: RalphLoopDetails | null;
}

export interface ActiveRun {
	process: any;
	sendFollowUp: (message: string) => Promise<void>;
	sendSteer: (message: string) => Promise<void>;
}

export type ActiveRunRegistration = (run: ActiveRun) => () => void;
