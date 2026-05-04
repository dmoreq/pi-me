/**
 * Web Tools Extension
 *
 * Unified web search and fetch functionality.
 * Extends ExtensionLifecycle for automatic telemetry.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { WebSearcher } from "./searcher.ts";
import { WebFetcher } from "./fetcher.ts";

export class WebToolsExtension extends ExtensionLifecycle {
  readonly name = "web-tools";
  readonly version = "0.3.0";
  protected readonly description = "Web search and fetch with unified interface";
  protected readonly tools = ["web_search", "web_fetch"];
  protected readonly events = [];

  private searcher: WebSearcher;
  private fetcher: WebFetcher;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.searcher = new WebSearcher();
    this.fetcher = new WebFetcher();

    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: this.tools,
      events: this.events,
    });
  }

  /**
   * Get the searcher for direct access.
   */
  getSearcher(): WebSearcher {
    return this.searcher;
  }

  /**
   * Get the fetcher for direct access.
   */
  getFetcher(): WebFetcher {
    return this.fetcher;
  }

  /**
   * Search the web.
   */
  async search(query: string, limit: number = 10) {
    // Fire telemetry automation trigger
    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
    const searchTrigger = TelemetryAutomation.webSearched(query);
    TelemetryAutomation.fire(this, searchTrigger);

    this.track("web_search", { query, limit });
    return this.searcher.search({ query, limit });
  }

  /**
   * Fetch a URL.
   */
  async fetch(url: string) {
    this.track("web_fetch", { url });
    return this.fetcher.fetch(url);
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new WebToolsExtension(pi);
  ext.register();
}
