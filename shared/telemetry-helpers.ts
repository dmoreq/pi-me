/**
 * Telemetry helpers — ergonomic wrappers around pi-telemetry.
 * All functions are no-ops when telemetry is not loaded.
 */

import { getTelemetry } from "pi-telemetry";
import type { PackageRegistration, NotifyOptions } from "pi-telemetry/src/types.ts";

/** Register a package and send initial heartbeat in one call. */
export function registerPackage(reg: PackageRegistration): void {
  const t = getTelemetry();
  if (!t) return;
  t.register(reg);
  t.heartbeat(reg.name);
}

/** Send a badge notification only when telemetry is active. */
export function telemetryNotify(
  message: string,
  opts?: NotifyOptions
): void {
  getTelemetry()?.notify(message, opts);
}

/** Send a heartbeat only when telemetry is active. */
export function telemetryHeartbeat(name: string): void {
  getTelemetry()?.heartbeat(name);
}
