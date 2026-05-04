/**
 * Project Context — auto-generate project skill context as structured memory.
 *
 * Merged from authoring/skill-bootstrap/skill-bootstrap.ts.
 *
 * On session_start, scans the project directory and stores the detected
 * project structure as semantic memory entries. The memory injector then
 * includes these in the system prompt automatically.
 *
 * This replaces the manual /bootstrap-skill command with automatic project
 * context awareness.
 */

import { readdir, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { MemoryStore } from "./store.ts";

// ============================================================================
// Types
// ============================================================================

export interface ProjectInfo {
  name: string;
  type: string;
  language: string;
  framework: string;
  testFramework: string;
  packageManager: string;
  buildTool: string;
  hasLinter: boolean;
  hasFormatter: boolean;
  directories: string[];
  keyFiles: string[];
}

// ============================================================================
// File helpers
// ============================================================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// ============================================================================
// Project Scanner
// ============================================================================

export async function scanProject(cwd: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    name: basename(cwd),
    type: "unknown",
    language: "unknown",
    framework: "none",
    testFramework: "none",
    packageManager: "none",
    buildTool: "none",
    hasLinter: false,
    hasFormatter: false,
    directories: [],
    keyFiles: [],
  };

  const pkgText = readFileSafe(join(cwd, "package.json"));
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

  if (await fileExists(join(cwd, "tsconfig.json"))) {
    info.keyFiles.push("tsconfig.json");
    if (info.language === "unknown") info.language = "TypeScript";
  }

  for (const file of [".gitignore", "README.md", "biome.json", "eslint.config.js", ".prettierrc"]) {
    if (await fileExists(join(cwd, file))) info.keyFiles.push(file);
  }

  const entries = await readdir(cwd, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) info.directories.push(entry.name);
  }

  for (const lockFile of ["bun.lock", "bun.lockb", "yarn.lock", "pnpm-lock.yaml", "package-lock.json"]) {
    if (await fileExists(join(cwd, lockFile))) {
      if (lockFile.startsWith("bun")) info.packageManager = "bun";
      else if (lockFile.startsWith("yarn")) info.packageManager = "yarn";
      else if (lockFile.startsWith("pnpm")) info.packageManager = "pnpm";
      break;
    }
  }

  return info;
}

// ============================================================================
// Memory Ingest
// ============================================================================

export function ingestProjectContext(store: MemoryStore, info: ProjectInfo): number {
  let count = 0;

  // Store each property as a semantic fact
  store.setSemantic(`project.${info.name}.type`, info.type, 0.9, "scanner");
  count++;

  if (info.language !== "unknown") {
    store.setSemantic(`project.${info.name}.language`, info.language, 0.9, "scanner");
    count++;
  }

  if (info.framework !== "none") {
    store.setSemantic(`project.${info.name}.framework`, info.framework, 0.9, "scanner");
    count++;
  }

  if (info.testFramework !== "none") {
    store.setSemantic(`project.${info.name}.testFramework`, info.testFramework, 0.9, "scanner");
    count++;
  }

  if (info.packageManager !== "none") {
    store.setSemantic(`project.${info.name}.packageManager`, info.packageManager, 0.9, "scanner");
    count++;
  }

  if (info.buildTool !== "none") {
    store.setSemantic(`project.${info.name}.buildTool`, info.buildTool, 0.9, "scanner");
    count++;
  }

  store.setSemantic(`project.${info.name}.directories`, info.directories.join(", "), 0.8, "scanner");
  count++;

  store.setSemantic(`project.${info.name}.keyFiles`, info.keyFiles.join(", "), 0.8, "scanner");
  count++;

  return count;
}
