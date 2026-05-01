/**
 * pi-me: skill-bootstrap — Project skill generator.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs/promises";

interface ProjectInfo {
	name: string; type: string; language: string; framework: string;
	testFramework: string; packageManager: string; buildTool: string;
	hasLinter: boolean; hasFormatter: boolean; directories: string[]; keyFiles: string[];
}

async function fileExists(filePath: string): Promise<boolean> { try { await fs.access(filePath); return true; } catch { return false; } }
async function readFileSafe(filePath: string): Promise<string | null> { try { return await fs.readFile(filePath, "utf-8"); } catch { return null; } }

async function scanProject(cwd: string): Promise<ProjectInfo | null> {
	const info: ProjectInfo = { name: path.basename(cwd), type: "unknown", language: "unknown", framework: "none", testFramework: "none", packageManager: "none", buildTool: "none", hasLinter: false, hasFormatter: false, directories: [], keyFiles: [] };

	const pkgText = await readFileSafe(path.join(cwd, "package.json"));
	if (pkgText) {
		const pkg = JSON.parse(pkgText);
		info.name = pkg.name || info.name;
		info.packageManager = "npm";
		if (pkg.scripts) {
			const scripts = Object.keys(pkg.scripts);
			if (scripts.some((s: string) => s.includes("test"))) info.testFramework = "jest/vitest/bun";
			if (scripts.includes("lint")) info.hasLinter = true;
			if (scripts.includes("format")) info.hasFormatter = true;
			if (scripts.includes("build")) info.buildTool = "npm scripts";
		}
		if (pkg.dependencies) {
			const deps = Object.keys(pkg.dependencies);
			if (deps.includes("next")) info.framework = "Next.js";
			else if (deps.includes("react")) info.framework = "React";
			else if (deps.includes("vue")) info.framework = "Vue";
			else if (deps.includes("express")) info.framework = "Express";
			if (deps.includes("typescript")) info.language = "TypeScript";
			else info.language = "JavaScript";
			if (deps.includes("@biomejs/biome")) { info.hasLinter = true; info.hasFormatter = true; }
		}
		if (pkg.devDependencies) {
			const dd = Object.keys(pkg.devDependencies);
			if (dd.includes("typescript")) info.language = "TypeScript";
			if (dd.includes("jest")) info.testFramework = "jest";
			if (dd.includes("vitest")) info.testFramework = "vitest";
			if (dd.includes("@biomejs/biome")) { info.hasLinter = true; info.hasFormatter = true; }
		}
		info.keyFiles.push("package.json");
		info.type = pkg.workspaces ? "monorepo" : pkg.type === "module" ? "module" : "package";
	}

	if (await fileExists(path.join(cwd, "tsconfig.json"))) { info.keyFiles.push("tsconfig.json"); if (info.language === "unknown") info.language = "TypeScript"; }
	for (const file of [".gitignore", "README.md", "biome.json", "eslint.config.js", ".prettierrc"]) { if (await fileExists(path.join(cwd, file))) info.keyFiles.push(file); }

	const entries = await fs.readdir(cwd, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) { if (entry.isDirectory() && !entry.name.startsWith(".")) info.directories.push(entry.name); }

	for (const lockFile of ["bun.lock", "bun.lockb", "yarn.lock", "pnpm-lock.yaml", "package-lock.json"]) {
		if (await fileExists(path.join(cwd, lockFile))) {
			if (lockFile.startsWith("bun")) info.packageManager = "bun";
			else if (lockFile.startsWith("yarn")) info.packageManager = "yarn";
			else if (lockFile.startsWith("pnpm")) info.packageManager = "pnpm";
			break;
		}
	}
	return info;
}

function generateSkillMarkdown(info: ProjectInfo): string {
	const lines = [
		`# ${info.name}`, "",
		`This is a ${info.language} project${info.framework !== "none" ? ` built with ${info.framework}` : ""}.`,
		"", "## Project Type",
		`- **Type:** ${info.type}`, `- **Language:** ${info.language}`, `- **Framework:** ${info.framework}`,
		`- **Package manager:** ${info.packageManager}`, `- **Build tool:** ${info.buildTool}`,
		`- **Test framework:** ${info.testFramework}`, `- **Linter:** ${info.hasLinter ? "yes" : "no"}`,
		`- **Formatter:** ${info.hasFormatter ? "yes" : "no"}`,
		"", "## Directory Structure", ...info.directories.map((d) => `- \`${d}/\``),
		"", "## Key Files", ...info.keyFiles.map((f) => `- \`${f}\``),
		"", "## Development Rules", "", "### Code Quality",
		info.hasLinter ? "- Run `bun run lint` before committing" : "- No linter detected",
		info.hasFormatter ? "- Run `bun run format` to format code" : "- No formatter detected",
		"", "### Testing", info.testFramework !== "none" ? "- Run tests with `bun test`" : "- No test framework detected",
		"", "### Building", `- Use \`${info.packageManager}\` for all package operations`, "- Never edit lock files directly",
	].filter(Boolean);
	return lines.join("\n");
}

export function registerSkillBootstrap(pi: ExtensionAPI) {
	pi.registerCommand("bootstrap-skill", {
		description: "Scan project and generate a SKILL.md for future agents",
		handler: async (_args, ctx) => {
			const info = await scanProject(ctx.cwd);
			if (!info) { ctx.ui.notify("Could not scan project", "error"); return; }
			const skillContent = generateSkillMarkdown(info);
			const skillDir = path.join(ctx.cwd, ".pi", "skills", info.name.toLowerCase().replace(/\s+/g, "-"));
			await fs.mkdir(skillDir, { recursive: true });
			await fs.writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf-8");
			if (ctx.hasUI) ctx.ui.notify(`SKILL.md generated at .pi/skills/${path.basename(skillDir)}/SKILL.md\nDetected: ${info.language}, ${info.framework}, ${info.packageManager}`, "success");
		},
	});
}

export default registerSkillBootstrap;
