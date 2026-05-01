/**
 * LSP Server Configs - Language server spawning utilities and per-language configurations
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

export const LANGUAGE_IDS: Record<string, string> = {
  ".dart": "dart", ".ts": "typescript", ".tsx": "typescriptreact",
  ".js": "javascript", ".jsx": "javascriptreact", ".mjs": "javascript",
  ".cjs": "javascript", ".mts": "typescript", ".cts": "typescript",
  ".vue": "vue", ".svelte": "svelte", ".astro": "astro",
  ".py": "python", ".pyi": "python", ".go": "go", ".rs": "rust",
  ".kt": "kotlin", ".kts": "kotlin",
  ".swift": "swift",
};

// Types
export interface LSPServerConfig {
  id: string;
  extensions: string[];
  findRoot: (file: string, cwd: string) => string | undefined;
  spawn: (root: string) => Promise<{ process: ChildProcessWithoutNullStreams; initOptions?: Record<string, unknown> } | undefined>;
}

// Utilities (private — only used by server configs below)
const SEARCH_PATHS = [
  ...(process.env.PATH?.split(path.delimiter) || []),
  "/usr/local/bin", "/opt/homebrew/bin",
  `${process.env.HOME}/.pub-cache/bin`, `${process.env.HOME}/fvm/default/bin`,
  `${process.env.HOME}/go/bin`, `${process.env.HOME}/.cargo/bin`,
];

export function which(cmd: string): string | undefined {
  const ext = process.platform === "win32" ? ".exe" : "";
  for (const dir of SEARCH_PATHS) {
    const full = path.join(dir, cmd + ext);
    try { if (fs.existsSync(full) && fs.statSync(full).isFile()) return full; } catch {}
  }
}

export function findNearestFile(startDir: string, targets: string[], stopDir: string): string | undefined {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopDir);
  while (current.length >= stop.length) {
    for (const t of targets) {
      const candidate = path.join(current, t);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function findRoot(file: string, cwd: string, markers: string[]): string | undefined {
  const found = findNearestFile(path.dirname(file), markers, cwd);
  return found ? path.dirname(found) : undefined;
}

export function simpleSpawn(bin: string, args: string[] = ["--stdio"]) {
  return async (root: string) => {
    const cmd = which(bin);
    if (!cmd) return undefined;
    return { process: spawn(cmd, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] }) };
  };
}

export async function spawnChecked(cmd: string, args: string[], cwd: string): Promise<ChildProcessWithoutNullStreams | undefined> {
  try {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });

    // If the process exits immediately (e.g. unsupported flag), treat it as a failure
    return await new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        child.removeListener("exit", onExit);
        child.removeListener("error", onError);
      };

      let timer: NodeJS.Timeout | null = null;

      const finish = (value: ChildProcessWithoutNullStreams | undefined) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        cleanup();
        resolve(value);
      };

      const onExit = () => finish(undefined);
      const onError = () => finish(undefined);

      child.once("exit", onExit);
      child.once("error", onError);

      timer = setTimeout(() => finish(child), 200);
      (timer as any).unref?.();
    });
  } catch {
    return undefined;
  }
}

export async function spawnWithFallback(cmd: string, argsVariants: string[][], cwd: string): Promise<ChildProcessWithoutNullStreams | undefined> {
  for (const args of argsVariants) {
    const child = await spawnChecked(cmd, args, cwd);
    if (child) return child;
  }
  return undefined;
}

export function findRootKotlin(file: string, cwd: string): string | undefined {
  // Prefer Gradle settings root for multi-module projects
  const gradleRoot = findRoot(file, cwd, ["settings.gradle.kts", "settings.gradle"]);
  if (gradleRoot) return gradleRoot;

  // Fallbacks for single-module Gradle or Maven builds
  return findRoot(file, cwd, [
    "build.gradle.kts",
    "build.gradle",
    "gradlew",
    "gradlew.bat",
    "gradle.properties",
    "pom.xml",
  ]);
}

function dirContainsNestedProjectFile(dir: string, dirSuffix: string, markerFile: string): boolean {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!e.name.endsWith(dirSuffix)) continue;
      if (fs.existsSync(path.join(dir, e.name, markerFile))) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function findRootSwift(file: string, cwd: string): string | undefined {
  let current = path.resolve(path.dirname(file));
  const stop = path.resolve(cwd);

  while (current.length >= stop.length) {
    if (fs.existsSync(path.join(current, "Package.swift"))) return current;

    // Xcode projects/workspaces store their marker files *inside* a directory
    if (dirContainsNestedProjectFile(current, ".xcodeproj", "project.pbxproj")) return current;
    if (dirContainsNestedProjectFile(current, ".xcworkspace", "contents.xcworkspacedata")) return current;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<boolean> {
  return await new Promise((resolve) => {
    try {
      const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function ensureJetBrainsKotlinLspInstalled(): Promise<string | undefined> {
  // Opt-in download (to avoid surprising network activity)
  const allowDownload = process.env.PI_LSP_AUTO_DOWNLOAD_KOTLIN_LSP === "1" || process.env.PI_LSP_AUTO_DOWNLOAD_KOTLIN_LSP === "true";
  const installDir = path.join(os.homedir(), ".pi", "agent", "lsp", "kotlin-ls");
  const launcher = process.platform === "win32"
    ? path.join(installDir, "kotlin-lsp.cmd")
    : path.join(installDir, "kotlin-lsp.sh");

  if (fs.existsSync(launcher)) return launcher;
  if (!allowDownload) return undefined;

  const curl = which("curl");
  const unzip = which("unzip");
  if (!curl || !unzip) return undefined;

  try {
    // Determine latest version
    const res = await fetch("https://api.github.com/repos/Kotlin/kotlin-lsp/releases/latest", {
      headers: { "User-Agent": "pi-lsp" },
    });
    if (!res.ok) return undefined;
    const release: any = await res.json();
    const versionRaw = (release?.name || release?.tag_name || "").toString();
    const version = versionRaw.replace(/^v/, "");
    if (!version) return undefined;

    // Map platform/arch to JetBrains naming
    const platform = process.platform;
    const arch = process.arch;

    let kotlinArch: string = arch;
    if (arch === "arm64") kotlinArch = "aarch64";
    else if (arch === "x64") kotlinArch = "x64";

    let kotlinPlatform: string = platform;
    if (platform === "darwin") kotlinPlatform = "mac";
    else if (platform === "linux") kotlinPlatform = "linux";
    else if (platform === "win32") kotlinPlatform = "win";

    const supportedCombos = new Set(["mac-x64", "mac-aarch64", "linux-x64", "linux-aarch64", "win-x64", "win-aarch64"]);
    const combo = `${kotlinPlatform}-${kotlinArch}`;
    if (!supportedCombos.has(combo)) return undefined;

    const assetName = `kotlin-lsp-${version}-${kotlinPlatform}-${kotlinArch}.zip`;
    const url = `https://download-cdn.jetbrains.com/kotlin-lsp/${version}/${assetName}`;

    fs.mkdirSync(installDir, { recursive: true });
    const zipPath = path.join(installDir, "kotlin-lsp.zip");

    const okDownload = await runCommand(curl, ["-L", "-o", zipPath, url], installDir);
    if (!okDownload || !fs.existsSync(zipPath)) return undefined;

    const okUnzip = await runCommand(unzip, ["-o", zipPath, "-d", installDir], installDir);
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    if (!okUnzip) return undefined;

    if (process.platform !== "win32") {
      try { fs.chmodSync(launcher, 0o755); } catch {}
    }

    return fs.existsSync(launcher) ? launcher : undefined;
  } catch {
    return undefined;
  }
}

async function spawnKotlinLanguageServer(root: string): Promise<ChildProcessWithoutNullStreams | undefined> {
  // Prefer JetBrains Kotlin LSP (Kotlin/kotlin-lsp) – better diagnostics for Gradle/Android projects.
  const explicit = process.env.PI_LSP_KOTLIN_LSP_PATH;
  if (explicit && fs.existsSync(explicit)) {
    return spawnWithFallback(explicit, [["--stdio"]], root);
  }

  const jetbrains = which("kotlin-lsp") || which("kotlin-lsp.sh") || which("kotlin-lsp.cmd") || await ensureJetBrainsKotlinLspInstalled();
  if (jetbrains) {
    return spawnWithFallback(jetbrains, [["--stdio"]], root);
  }

  // Fallback: org.javacs/kotlin-language-server (often lacks diagnostics without full classpath)
  const kls = which("kotlin-language-server");
  if (!kls) return undefined;
  return spawnWithFallback(kls, [[]], root);
}

async function spawnSourcekitLsp(root: string): Promise<ChildProcessWithoutNullStreams | undefined> {
  const direct = which("sourcekit-lsp");
  if (direct) return spawnWithFallback(direct, [[], ["--stdio"]], root);

  // macOS/Xcode: sourcekit-lsp is often available via xcrun
  const xcrun = which("xcrun");
  if (!xcrun) return undefined;
  return spawnWithFallback(xcrun, [["sourcekit-lsp"], ["sourcekit-lsp", "--stdio"]], root);
}

// Server Configs
export const LSP_SERVERS: LSPServerConfig[] = [
  {
    id: "dart", extensions: [".dart"],
    findRoot: (f, cwd) => findRoot(f, cwd, ["pubspec.yaml", "analysis_options.yaml"]),
    spawn: async (root) => {
      let dart = which("dart");
      const pubspec = path.join(root, "pubspec.yaml");
      if (fs.existsSync(pubspec)) {
        try {
          const content = fs.readFileSync(pubspec, "utf-8");
          if (content.includes("flutter:") || content.includes("sdk: flutter")) {
            const flutter = which("flutter");
            if (flutter) {
              const dir = path.dirname(fs.realpathSync(flutter));
              for (const p of ["cache/dart-sdk/bin/dart", "../cache/dart-sdk/bin/dart"]) {
                const c = path.join(dir, p);
                if (fs.existsSync(c)) { dart = c; break; }
              }
            }
          }
        } catch {}
      }
      if (!dart) return undefined;
      return { process: spawn(dart, ["language-server", "--protocol=lsp"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] }) };
    },
  },
  {
    id: "typescript", extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    findRoot: (f, cwd) => {
      if (findNearestFile(path.dirname(f), ["deno.json", "deno.jsonc"], cwd)) return undefined;
      return findRoot(f, cwd, ["package.json", "tsconfig.json", "jsconfig.json"]);
    },
    spawn: async (root) => {
      const local = path.join(root, "node_modules/.bin/typescript-language-server");
      const cmd = fs.existsSync(local) ? local : which("typescript-language-server");
      if (!cmd) return undefined;
      return { process: spawn(cmd, ["--stdio"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] }) };
    },
  },
  { id: "vue", extensions: [".vue"], findRoot: (f, cwd) => findRoot(f, cwd, ["package.json", "vite.config.ts", "vite.config.js"]), spawn: simpleSpawn("vue-language-server") },
  { id: "svelte", extensions: [".svelte"], findRoot: (f, cwd) => findRoot(f, cwd, ["package.json", "svelte.config.js"]), spawn: simpleSpawn("svelteserver") },
  { id: "pyright", extensions: [".py", ".pyi"], findRoot: (f, cwd) => findRoot(f, cwd, ["pyproject.toml", "setup.py", "requirements.txt", "pyrightconfig.json"]), spawn: simpleSpawn("pyright-langserver") },
  { id: "gopls", extensions: [".go"], findRoot: (f, cwd) => findRoot(f, cwd, ["go.work"]) || findRoot(f, cwd, ["go.mod"]), spawn: simpleSpawn("gopls", []) },
  {
    id: "kotlin", extensions: [".kt", ".kts"],
    findRoot: (f, cwd) => findRootKotlin(f, cwd),
    spawn: async (root) => {
      const proc = await spawnKotlinLanguageServer(root);
      if (!proc) return undefined;
      return { process: proc };
    },
  },
  {
    id: "swift", extensions: [".swift"],
    findRoot: (f, cwd) => findRootSwift(f, cwd),
    spawn: async (root) => {
      const proc = await spawnSourcekitLsp(root);
      if (!proc) return undefined;
      return { process: proc };
    },
  },
  { id: "rust-analyzer", extensions: [".rs"], findRoot: (f, cwd) => findRoot(f, cwd, ["Cargo.toml"]), spawn: simpleSpawn("rust-analyzer", []) },
];
