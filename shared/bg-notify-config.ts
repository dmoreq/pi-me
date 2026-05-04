/**
 * Background notification config loading and combined notify action.
 * Single Responsibility: loading and applying background-notify settings.
 */

import { z } from "zod";
import { loadConfigOrDefault } from "./pi-config.ts";
import type { BackgroundNotifyConfig, TerminalInfo } from "./types.ts";
import { isSayAvailable, playBeep, speakMessage } from "./audio.ts";
import { bringTerminalToFront } from "./terminal.ts";

// ── Schema & defaults ────────────────────────────────────────────────────────

export const BackgroundNotifySchema = z.object({
  thresholdMs: z.number().default(2000),
  beep: z.boolean().default(true),
  beepSound: z.string().default("Tink"),
  bringToFront: z.boolean().default(true),
  say: z.boolean().default(false),
  sayMessage: z.string().default("Task completed"),
});

const DEFAULTS: BackgroundNotifyConfig = {
  thresholdMs: 2000,
  beep: true,
  beepSound: "Tink",
  bringToFront: true,
  say: false,
  sayMessage: "Task completed",
};

// ── Config loading ───────────────────────────────────────────────────────────

export function getBackgroundNotifyConfigSync(
  overrides?: Partial<BackgroundNotifyConfig>
): BackgroundNotifyConfig {
  const raw = loadConfigOrDefault({
    filename: "settings.json",
    schema: z.object({ backgroundNotify: BackgroundNotifySchema }).partial(),
    defaults: {},
  });
  const fromFile = (raw as any)?.backgroundNotify ?? {};
  return { ...DEFAULTS, ...fromFile, ...overrides };
}

export async function getBackgroundNotifyConfig(
  ctxOrOverrides?: any,
  overrides?: Partial<BackgroundNotifyConfig>
): Promise<BackgroundNotifyConfig> {
  const effectiveOverrides =
    overrides ??
    (ctxOrOverrides && !ctxOrOverrides?.settingsManager
      ? (ctxOrOverrides as Partial<BackgroundNotifyConfig>)
      : undefined);
  return getBackgroundNotifyConfigSync(effectiveOverrides);
}

// ── Combined notify action ───────────────────────────────────────────────────

export interface NotifyOptions {
  beep?: boolean;
  beepSound?: string;
  bringToFront?: boolean;
  say?: boolean;
  sayMessage?: string;
}

export async function notifyOnConfirm(
  config: BackgroundNotifyConfig,
  terminalInfo: TerminalInfo,
  options?: NotifyOptions
): Promise<void> {
  const eff = {
    beep: options?.beep ?? config.beep,
    beepSound: options?.beepSound ?? config.beepSound,
    bringToFront: options?.bringToFront ?? config.bringToFront,
    say: isSayAvailable() ? (options?.say ?? config.say) : false,
    sayMessage: options?.sayMessage ?? config.sayMessage,
  };
  const tasks: Promise<void>[] = [];
  if (eff.bringToFront) tasks.push(bringTerminalToFront(terminalInfo));
  if (eff.beep) playBeep(eff.beepSound);
  if (eff.say) speakMessage(eff.sayMessage);
  await Promise.all(tasks);
}
