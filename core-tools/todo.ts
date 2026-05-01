/**
 * pi-me: todo — Stateful todo tracking tool.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "typebox";

interface Todo { id: number; text: string; done: boolean; }
interface TodoDetails { action: "list" | "add" | "toggle" | "clear"; todos: Todo[]; nextId: number; error?: string; }

const TodoParams = Type.Object({
	action: StringEnum(["list", "add", "toggle", "clear"] as const),
	text: Type.Optional(Type.String({ description: "Todo text (for add)" })),
	id: Type.Optional(Type.Number({ description: "Todo ID (for toggle)" })),
});

class TodoListComponent {
	#todos: Todo[];
	#theme: any;
	#onClose: () => void;
	#cachedWidth?: number;
	#cachedLines?: string[];

	constructor(todos: Todo[], theme: any, onClose: () => void) {
		this.#todos = todos; this.#theme = theme; this.#onClose = onClose;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) this.#onClose();
	}

	render(width: number): string[] {
		if (this.#cachedLines && this.#cachedWidth === width) return this.#cachedLines;
		const th = this.#theme;
		const lines: string[] = [];
		lines.push("");
		const title = th.fg("accent", " Todos ");
		const hdr = th.fg("borderMuted", "─".repeat(3)) + title + th.fg("borderMuted", "─".repeat(Math.max(0, width - 10)));
		lines.push(truncateToWidth(hdr, width));
		lines.push("");
		if (this.#todos.length === 0) {
			lines.push(truncateToWidth(`  ${th.fg("dim", "No todos yet.")}`, width));
		} else {
			const done = this.#todos.filter((t) => t.done).length;
			lines.push(truncateToWidth(`  ${th.fg("muted", `${done}/${this.#todos.length} completed`)}`, width));
			lines.push("");
			for (const todo of this.#todos) {
				const check = todo.done ? th.fg("success", "✓") : th.fg("dim", "○");
				const id = th.fg("accent", `#${todo.id}`);
				const text = todo.done ? th.fg("dim", todo.text) : th.fg("text", todo.text);
				lines.push(truncateToWidth(`  ${check} ${id} ${text}`, width));
			}
		}
		lines.push("");
		lines.push(truncateToWidth(`  ${th.fg("dim", "Press Escape to close")}`, width));
		lines.push("");
		this.#cachedWidth = width;
		this.#cachedLines = lines;
		return lines;
	}

	invalidate(): void { this.#cachedWidth = undefined; this.#cachedLines = undefined; }
}

export function registerTodo(pi: ExtensionAPI) {
	let todos: Todo[] = [];
	let nextId = 1;

	const reconstructState = (ctx: ExtensionContext) => {
		todos = []; nextId = 1;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const msg = entry.message as { role?: string; toolName?: string; details?: TodoDetails } | undefined;
			if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo") continue;
			if (msg.details) { todos = msg.details.todos; nextId = msg.details.nextId; }
		}
	};

	pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

	pi.registerTool({
		name: "todo", label: "Todo",
		description: "Manage a todo list. Actions: list, add (text), toggle (id), clear",
		parameters: TodoParams,
		async execute(_toolCallId, params) {
			switch (params.action) {
				case "list":
					return { content: [{ type: "text", text: todos.length ? todos.map((t) => `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`).join("\n") : "No todos" }], details: { action: "list", todos: [...todos], nextId } as TodoDetails };
				case "add": {
					if (!params.text) return { content: [{ type: "text", text: "Error: text required for add" }], details: { action: "add", todos: [...todos], nextId, error: "text required" } as TodoDetails };
					const newTodo = { id: nextId++, text: params.text, done: false };
					todos.push(newTodo);
					return { content: [{ type: "text", text: `Added #${newTodo.id}: ${newTodo.text}` }], details: { action: "add", todos: [...todos], nextId } as TodoDetails };
				}
				case "toggle": {
					if (params.id === undefined) return { content: [{ type: "text", text: "Error: id required for toggle" }], details: { action: "toggle", todos: [...todos], nextId, error: "id required" } as TodoDetails };
					const todo = todos.find((t) => t.id === params.id);
					if (!todo) return { content: [{ type: "text", text: `#${params.id} not found` }], details: { action: "toggle", todos: [...todos], nextId, error: `#${params.id} not found` } as TodoDetails };
					todo.done = !todo.done;
					return { content: [{ type: "text", text: `#${todo.id} ${todo.done ? "completed" : "uncompleted"}` }], details: { action: "toggle", todos: [...todos], nextId } as TodoDetails };
				}
				case "clear": {
					const count = todos.length; todos = []; nextId = 1;
					return { content: [{ type: "text", text: `Cleared ${count} todos` }], details: { action: "clear", todos: [], nextId: 1 } as TodoDetails };
				}
				default:
					return { content: [{ type: "text", text: `Unknown action: ${(params as any).action}` }], details: { action: "list", todos: [...todos], nextId, error: "unknown action" } as TodoDetails };
			}
		},
		renderCall(args: any, theme: any) {
			let text = theme.fg("toolTitle", theme.bold("todo ")) + theme.fg("muted", args.action);
			if (args.text) text += ` ${theme.fg("dim", `"${args.text}"`)}`;
			if (args.id !== undefined) text += ` ${theme.fg("accent", `#${args.id}`)}`;
			return new Text(text, 0, 0);
		},
		renderResult(result: any, { expanded }: any, theme: any) {
			const details = result.details as TodoDetails | undefined;
			if (!details) { const t = result.content?.[0]; return new Text(t?.type === "text" ? t.text : "", 0, 0); }
			if (details.error) return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			switch (details.action) {
				case "list": {
					if (details.todos.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);
					let list = theme.fg("muted", `${details.todos.length} todo(s):`);
					const show = expanded ? details.todos : details.todos.slice(0, 5);
					for (const t of show) {
						const check = t.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
						list += `\n${check} ${theme.fg("accent", `#${t.id}`)} ${t.done ? theme.fg("dim", t.text) : ""}`;
					}
					if (!expanded && details.todos.length > 5) list += `\n${theme.fg("dim", `... ${details.todos.length - 5} more`)}`;
					return new Text(list, 0, 0);
				}
				case "add": {
					const added = details.todos[details.todos.length - 1];
					return new Text(theme.fg("success", `✓ Added #${added.id} — ${added.text}`), 0, 0);
				}
				case "toggle": { const txt = result.content?.[0]; return new Text(theme.fg("success", `✓ ${txt?.type === "text" ? txt.text : ""}`), 0, 0); }
				case "clear": return new Text(theme.fg("success", "✓ Cleared all todos"), 0, 0);
				default: return new Text("", 0, 0);
			}
		},
	});

	pi.registerCommand("todos", {
		description: "Show all todos on the current branch",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) { ctx.ui.notify("/todos requires interactive mode", "error"); return; }
			await ctx.ui.custom<void>((_tui: any, theme: any, _kb: any, done: () => void) => new TodoListComponent(todos, theme, () => done()));
		},
	});
}

export default registerTodo;
