/**
 * File Intelligence Extension
 *
 * Index and search files: capture structure, track dependencies, enable code navigation.
 * Extends ExtensionLifecycle for automatic telemetry.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { FileStore } from "./store.ts";
import { FileCapturer } from "./capture.ts";
import type { FileIndex, CaptureResult } from "./types.ts";

export class FileIntelligenceExtension extends ExtensionLifecycle {
  readonly name = "file-intelligence";
  readonly version = "0.3.0";
  protected readonly description = "File indexing, structure capture, and code navigation";
  protected readonly tools = [];
  protected readonly events = ["write", "edit"];

  private store: FileStore;
  private capturer = FileCapturer;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.store = new FileStore();

    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });
  }

  /**
   * Index a file when written or edited.
   */
  async onWrite(_: any, ctx: any) {
    const filePath = ctx.filePath;
    const content = ctx.content;

    if (!filePath || !content) return;

    await this.indexFile(filePath, content);
  }

  /**
   * Index a file from its source code.
   */
  async indexFile(filePath: string, content: string): Promise<void> {
    const capture = this.capturer.capture(filePath, content);
    const lines = content.split("\n").length;

    const index: FileIndex = {
      path: filePath,
      language: this.detectLanguage(filePath),
      lines,
      imports: capture.imports,
      exports: capture.exports,
      classes: capture.classes.map(c => c.name),
      functions: capture.functions.map(f => f.name),
      types: [], // would need full AST for types
      lastIndexedAt: new Date().toISOString(),
    };

    await this.store.save(index);

    // Fire telemetry automation trigger
    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
    const indexTrigger = TelemetryAutomation.fileIndexed(filePath);
    TelemetryAutomation.fire(this, indexTrigger);

    this.track("file_indexed", { filePath, lines });
  }

  /**
   * Get the store for direct access.
   */
  getStore(): FileStore {
    return this.store;
  }

  /**
   * Get the capturer for structure extraction.
   */
  getCapturer() {
    return this.capturer;
  }

  /**
   * Search indexed files by pattern.
   */
  async search(pattern: RegExp): Promise<FileIndex[]> {
    return this.store.search(pattern);
  }

  /**
   * Get files by language.
   */
  async getByLanguage(language: string): Promise<FileIndex[]> {
    return this.store.getByLanguage(language);
  }

  private detectLanguage(filePath: string): string {
    if (filePath.endsWith(".ts")) return "typescript";
    if (filePath.endsWith(".tsx")) return "typescript";
    if (filePath.endsWith(".js")) return "javascript";
    if (filePath.endsWith(".jsx")) return "javascript";
    if (filePath.endsWith(".py")) return "python";
    if (filePath.endsWith(".rs")) return "rust";
    if (filePath.endsWith(".go")) return "go";
    return "unknown";
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new FileIntelligenceExtension(pi);
  ext.register();
}
