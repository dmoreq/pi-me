/**
 * pi-me: ask — Follow-up question tool.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";

const AskParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	kind: StringEnum(["text", "confirm", "choice"] as const, { description: "Type of question" }),
	options: Type.Optional(Type.Array(Type.String(), { description: "Options for 'choice' kind" })),
});

export function registerAsk(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask", label: "Ask User",
		description: "Ask the user a question when you need clarification. Use kind='text' for open-ended, kind='confirm' for yes/no, kind='choice' for multiple choice.",
		parameters: AskParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) return { content: [{ type: "text", text: `[Non-interactive mode] Question: ${params.question}` }] };

			switch (params.kind) {
				case "confirm": {
					const answer = await ctx.ui.confirm("Question", params.question);
					return { content: [{ type: "text", text: answer ? "User answered: Yes" : "User answered: No" }], details: { question: params.question, kind: "confirm", answer } };
				}
				case "choice": {
					if (!params.options || params.options.length === 0) return { content: [{ type: "text", text: "Error: 'choice' kind requires an 'options' array." }] };
					const answer = await ctx.ui.select(params.question, params.options);
					return { content: [{ type: "text", text: `User selected: ${answer ?? "(cancelled)"}` }], details: { question: params.question, kind: "choice", options: params.options, answer } };
				}
				case "text": {
					const answer = await ctx.ui.input(params.question);
					return { content: [{ type: "text", text: answer ? `User answered: ${answer}` : "User cancelled input." }], details: { question: params.question, kind: "text", answer } };
				}
				default:
					return { content: [{ type: "text", text: `Unknown question kind: ${params.kind}` }] };
			}
		},
	});
}

export default registerAsk;
