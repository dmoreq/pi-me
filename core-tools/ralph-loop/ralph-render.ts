import type { ImageContent, Message, TextContent } from "@mariozechner/pi-ai";
import {
	AssistantMessageComponent,
	ToolExecutionComponent,
	UserMessageComponent,
} from "@mariozechner/pi-coding-agent";
import { Container, Spacer, Text } from "@mariozechner/pi-tui";
import type { LoopPromptItem, RalphLoopDetails } from "./ralph-types.js";

export function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

export type LoopViewerEntry =
	| { type: "section"; text: string }
	| { type: "meta"; text: string }
	| { type: "note"; text: string }
	| { type: "user"; text: string }
	| { type: "assistant"; message: Message }
	| {
			type: "toolExecution";
			toolName: string;
			args: Record<string, any>;
			result: { content: (TextContent | ImageContent)[]; details?: any; isError: boolean; isPartial?: boolean };
		};

export function buildEntryComponent(entry: LoopViewerEntry, theme: any, ui: any, cwd: string, expanded: boolean) {
	switch (entry.type) {
		case "section":
			return new Text(theme.fg("accent", entry.text), 1, 0);
		case "meta":
			return new Text(theme.fg("dim", entry.text), 1, 0);
		case "note":
			return new Text(theme.fg("muted", entry.text), 1, 0);
		case "user":
			return new UserMessageComponent(entry.text);
		case "assistant":
			return new AssistantMessageComponent(entry.message as any, false);
		case "toolExecution": {
			const toolComp = new ToolExecutionComponent(
				entry.toolName,
				entry.args,
				{ showImages: false },
				undefined,
				ui,
				cwd,
			);
			toolComp.updateResult(entry.result, Boolean(entry.result.isPartial));
			toolComp.setExpanded(expanded);
			return toolComp;
		}
	}
}

export function renderLoopEntries(entries: LoopViewerEntry[], theme: any, tui: any, cwd: string, expanded: boolean) {
	const container = new Container();
	const toolUi = tui ?? { requestRender: () => {} };
	for (const entry of entries) {
		const component = buildEntryComponent(entry, theme, toolUi, cwd, expanded);
		if (component) {
			container.addChild(component);
			container.addChild(new Spacer(1));
		}
	}
	return container;
}

function extractTextFromContent(content: any): string {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((part) => part && typeof part.text === "string")
			.map((part) => part.text)
			.join("\n");
	}
	return "";
}

export function buildLoopEntries(loopDetails: RalphLoopDetails): LoopViewerEntry[] {
	const entries: LoopViewerEntry[] = [];
	entries.push({ type: "meta", text: `Status: ${loopDetails.status}` });
	entries.push({ type: "meta", text: `Stop: ${loopDetails.stopReason}` });
	entries.push({ type: "meta", text: `Condition: ${loopDetails.conditionCommand} (${loopDetails.conditionSource})` });
	entries.push({ type: "meta", text: `Iterations: ${loopDetails.iterations.length}` });

	const appendQueuedEntries = () => {
		const hasQueued =
			loopDetails.steering.length > 0 ||
			loopDetails.followUps.length > 0 ||
			loopDetails.steeringSent.length > 0 ||
			loopDetails.followUpsSent.length > 0;
		if (!hasQueued) return;
		entries.push({ type: "section", text: "Queued Messages" });
		if (loopDetails.steering.length > 0) {
			entries.push({ type: "note", text: `Steering queued: ${loopDetails.steering.join(" | ")}` });
		}
		if (loopDetails.followUps.length > 0) {
			entries.push({ type: "note", text: `Follow-ups queued: ${loopDetails.followUps.join(" | ")}` });
		}
		if (loopDetails.steeringSent.length > 0) {
			entries.push({ type: "note", text: `Steering sent: ${loopDetails.steeringSent.join(" | ")}` });
		}
		if (loopDetails.followUpsSent.length > 0) {
			entries.push({ type: "note", text: `Follow-ups sent: ${loopDetails.followUpsSent.join(" | ")}` });
		}
	};

	if (loopDetails.iterations.length === 0) {
		entries.push({ type: "note", text: "(no iterations yet)" });
		appendQueuedEntries();
		return entries;
	}

	for (const iteration of loopDetails.iterations) {
		entries.push({ type: "section", text: `Iteration ${iteration.index} (${iteration.details.mode})` });

		for (const result of iteration.details.results) {
			const statusIcon = result.exitCode === 0 ? "✓" : "✗";
			const agentLine = `${statusIcon} ${result.agent} (${result.agentSource})`;
			entries.push({ type: "note", text: agentLine });
			if (result.task) entries.push({ type: "note", text: `Task: ${result.task}` });
			if (result.errorMessage) entries.push({ type: "note", text: `Error: ${result.errorMessage}` });

			const toolCalls = new Map<string, { name: string; args: Record<string, any> }>();
			const toolResults = new Map<
				string,
				{
					toolName: string;
					result: {
						content: (TextContent | ImageContent)[];
						details?: any;
						isError: boolean;
						isPartial?: boolean;
					};
				}
			>();

			for (const msg of result.messages) {
				if (msg.role === "assistant") {
					for (const part of msg.content) {
						if (part.type === "toolCall") {
							toolCalls.set(part.id, { name: part.name, args: part.arguments });
						}
					}
				} else if (msg.role === "toolResult" && msg.toolCallId) {
					toolResults.set(msg.toolCallId, {
						toolName: msg.toolName,
						result: {
							content: msg.content,
							details: msg.details,
							isError: msg.isError,
							isPartial: msg.isPartial,
						},
					});
				}
			}

			for (const msg of result.messages) {
				if (msg.role === "assistant") {
					entries.push({ type: "assistant", message: msg });
					for (const part of msg.content) {
						if (part.type !== "toolCall") continue;
						const toolResult = toolResults.get(part.id);
						entries.push({
							type: "toolExecution",
							toolName: part.name || toolResult?.toolName || "",
							args: part.arguments ?? {},
							result:
								toolResult?.result ??
								{
									content: [],
									details: undefined,
									isError: false,
									isPartial: true,
								},
						});
					}
				} else if (msg.role === "user") {
					const text = extractTextFromContent(msg.content).trim();
					entries.push({ type: "user", text: text || "(user message)" });
				} else if (msg.role === "toolResult") {
					// Render orphan tool results (e.g., when toolCall is missing)
					if (msg.toolCallId && toolCalls.has(msg.toolCallId)) continue;
					entries.push({
						type: "toolExecution",
						toolName: msg.toolName,
						args: {},
						result: {
							content: msg.content,
							details: msg.details,
							isError: msg.isError,
							isPartial: msg.isPartial,
						},
					});
				}
			}

			if (result.messages.length === 0) {
				entries.push({ type: "note", text: "(no messages)" });
			}
		}
	}

	appendQueuedEntries();
	return entries;
}

export function formatSteeringText(messages: string[]): string | null {
	const cleaned = messages.map((msg) => msg.trim()).filter(Boolean);
	if (cleaned.length === 0) return null;
	const lines = cleaned.map((msg, index) => `${index + 1}. ${msg}`);
	return `Steering updates:\n${lines.join("\n")}`;
}

export function formatLoopPromptItem(item: LoopPromptItem, maxTaskLength: number): string {
	const overrides: string[] = [];
	if (item.model) overrides.push(item.model);
	if (item.thinking) overrides.push(`thinking:${item.thinking}`);
	const overrideText = overrides.length > 0 ? ` (${overrides.join(", ")})` : "";
	const task = item.task || "";
	const preview = task.length > maxTaskLength ? `${task.slice(0, maxTaskLength)}...` : task;
	return `${item.agent}${overrideText}${preview ? ` ${preview}` : ""}`;
}
