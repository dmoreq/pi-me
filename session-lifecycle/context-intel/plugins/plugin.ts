/**
 * Context Plugin Interface — composable plugins for ContextIntelExtension.
 *
 * Each plugin hooks into one or more lifecycle events. The extension
 * discovers plugins automatically and wires them.
 *
 * This replaces the previous pattern of standalone extensions with
 * overlapping lifecycle hooks (e.g., context-pruning had its own
 * "context" event handler; read-guard had its own "tool_call" handler).
 * Now they all register as plugins of ContextIntelExtension.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * A message in the conversation branch, with optional metadata.
 */
export interface ContextMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | any[];
  timestamp?: string;
  [key: string]: any;
}

/**
 * A tool call event for interception.
 */
export interface ToolCallEvent {
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Plugin hook results.
 */
export interface PluginToolCallResult {
  block?: boolean;
  reason?: string;
  command?: string; // Replacement command
}

export interface PluginModifyResult {
  messages: ContextMessage[];
}

/**
 * Base interface for all context plugins.
 */
export interface ContextPlugin {
  /** Unique plugin name (used for dedup and debugging) */
  readonly name: string;

  /** Called during session_start — initialize plugin state */
  onSessionStart?(ctx: ExtensionContext): Promise<void>;

  /** Called during session_shutdown — cleanup */
  onSessionShutdown?(): Promise<void>;

  /**
   * Called during the "context" event — modify messages before LLM call.
   * Return the modified messages, or undefined to leave unchanged.
   */
  onContext?(messages: ContextMessage[]): Promise<ContextMessage[] | undefined>;

  /**
   * Called during tool_call — intercept before execution.
   * Return a block/modify result, or undefined to let pass.
   */
  onToolCall?(event: ToolCallEvent, ctx: ExtensionContext): Promise<PluginToolCallResult | undefined>;

  /**
   * Called during turn_end — collect metrics or trigger actions.
   */
  onTurnEnd?(ctx: ExtensionContext): Promise<void>;
}

/**
 * Plugin manager — discovers and wires plugins.
 */
export class PluginManager {
  private plugins: ContextPlugin[] = [];

  /** Register a plugin. Duplicate names are silently ignored. */
  register(plugin: ContextPlugin): void {
    if (this.plugins.some(p => p.name === plugin.name)) return;
    this.plugins.push(plugin);
  }

  /** Get all registered plugins. */
  getAll(): ContextPlugin[] {
    return [...this.plugins];
  }

  /** Find a plugin by name. */
  get(name: string): ContextPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  /** Call onSessionStart on all plugins in order. */
  async onSessionStart(ctx: ExtensionContext): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.onSessionStart?.(ctx);
    }
  }

  /** Call onSessionShutdown on all plugins in reverse order. */
  async onSessionShutdown(): Promise<void> {
    for (const plugin of [...this.plugins].reverse()) {
      await plugin.onSessionShutdown?.();
    }
  }

  /**
   * Call onContext on all plugins in order.
   * Each plugin receives the output of the previous one.
   */
  async onContext(messages: ContextMessage[]): Promise<ContextMessage[]> {
    let current = messages;
    for (const plugin of this.plugins) {
      if (plugin.onContext) {
        const result = await plugin.onContext(current);
        if (result) current = result;
      }
    }
    return current;
  }

  /**
   * Call onToolCall on all plugins in order.
   * First plugin to return a result wins (short-circuit).
   */
  async onToolCall(event: ToolCallEvent, ctx: ExtensionContext): Promise<PluginToolCallResult | undefined> {
    for (const plugin of this.plugins) {
      if (plugin.onToolCall) {
        const result = await plugin.onToolCall(event, ctx);
        if (result) return result;
      }
    }
    return undefined;
  }

  /** Call onTurnEnd on all plugins. */
  async onTurnEnd(ctx: ExtensionContext): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.onTurnEnd?.(ctx);
    }
  }
}
