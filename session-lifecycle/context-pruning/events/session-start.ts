
/**
 * DCP Context Event Handler
 * 
 * Handles the 'session_start' event which fires on new sessions.
 * Applies pruning workflow to reduce token usage while preserving coherence.
 */

import type { SessionStartEvent, ExtensionContext, SessionSwitchEvent } from "@mariozechner/pi-coding-agent";
import type { DcpConfigWithPruneRuleObjects } from "../types";
import { getAllRules } from '../registry'

export interface SessionStartEventHandlerOptions {
  config: DcpConfigWithPruneRuleObjects
}

/**
 * Creates a context event handler that applies pruning to messages.
 * 
 * @param options - Configuration and stats tracker
 * @returns Event handler function
 */
export function createSessionStartEventHandler(options: SessionStartEventHandlerOptions) {
  const { config } = options;


  return (event: SessionStartEvent, ctx: ExtensionContext) => {
    // DCP startup notification removed
  }
}

// Session switch handler — kept for future use
// export function createSessionSwitchEventHandler(options: SessionStartEventHandlerOptions) {
//   const { config } = options;
//
//   return (event: SessionSwitchEvent, ctx: ExtensionContext) => {
//     ctx.ui.notify(`DCP: Switched to session [${event.reason}]`, "info");
//   }
// }
