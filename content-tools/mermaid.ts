/**
 * pi-me: mermaid — Mermaid diagram rendering tool.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import * as cp from "node:child_process";

const MermaidParams = Type.Object({
	diagram: Type.String({ description: "Mermaid diagram source code" }),
	format: Type.Optional(Type.String({ description: "Output format: svg or png (default: svg)" })),
});

async function renderWithMmdc(diagram: string, format: string, cwd: string): Promise<string> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-mermaid-"));
	const inputPath = path.join(tmpDir, "diagram.mmd");
	const outputPath = path.join(tmpDir, `output.${format}`);
	await fs.writeFile(inputPath, diagram, "utf-8");

	try {
		const result = cp.spawnSync("mmdc", ["-i", inputPath, "-o", outputPath, "-t", "neutral", "-b", "transparent"], { cwd, encoding: "buffer", timeout: 30000 });
		if (result.status !== 0) { const stderr = result.stderr ? Buffer.from(result.stderr).toString() : ""; throw new Error(`mmdc failed (exit ${result.status}): ${stderr}`); }
		return await fs.readFile(outputPath, "utf-8");
	} finally { await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {}); }
}

function checkMmdcAvailable(): boolean {
	try { const result = cp.spawnSync("which", ["mmdc"], { encoding: "utf-8" }); return result.status === 0; } catch { return false; }
}

export function registerMermaid(pi: ExtensionAPI) {
	pi.registerTool({
		name: "render_mermaid", label: "Mermaid",
		description: "Render a Mermaid diagram to SVG. Requires mermaid-cli (mmdc).",
		parameters: MermaidParams,
		async execute(_toolCallId, params) {
			const format = params.format ?? "svg";
			if (!checkMmdcAvailable()) {
				return { content: [{ type: "text", text: "mermaid-cli (mmdc) is not installed. Install: npm install -g @mermaid-js/mermaid-cli" }], details: { diagram: params.diagram, format } };
			}
			try {
				const output = await renderWithMmdc(params.diagram, format, process.cwd());
				const outDir = path.join(os.tmpdir(), "pi-mermaid-output");
				await fs.mkdir(outDir, { recursive: true });
				const outFile = path.join(outDir, `diagram-${Date.now()}.${format}`);
				await fs.writeFile(outFile, output, "utf-8");
				const preview = format === "svg" ? output.slice(0, 500) : `[${format.toUpperCase()} image written to ${outFile}]`;
				return { content: [{ type: "text", text: `Diagram rendered (${format})\nOutput: ${outFile}\nLines: ${output.split("\n").length}\n\nPreview:\n${preview}` }], details: { outputPath: outFile, format, size: output.length } };
			} catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); return { content: [{ type: "text", text: `Render failed: ${message}` }], details: { diagram: params.diagram, format, error: message } }; }
		},
	});
}

export default registerMermaid;
