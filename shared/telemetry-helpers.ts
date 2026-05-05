/**
 * Telemetry helpers — ergonomic wrappers around pi-telemetry.
 * All functions are no-ops when telemetry is not loaded.
 *
 * Delegates to pi-telemetry's first-class helpers.
 */


import {
  registerPackage as helpersRegisterPackage,
  telemetryNotify as helpersTelemetryNotify,
  telemetryHeartbeat as helpersTelemetryHeartbeat,
  recordEvent as helpersRecordEvent,
  recordMetric as helpersRecordMetric,
  recordError as helpersRecordError,
} from "pi-telemetry/helpers";
import type { PackageRegistration, NotifyOptions } from "pi-telemetry/src/types.ts";

/** Register a package and send initial heartbeat in one call. */
export function registerPackage(reg: PackageRegistration): void {
  helpersRegisterPackage(reg);
}

/** Send a badge notification only when telemetry is active. */
export function telemetryNotify(
  message: string,
  opts?: NotifyOptions
): void {
  helpersTelemetryNotify(message, opts);
}

/** Send a heartbeat only when telemetry is active. */
export function telemetryHeartbeat(name: string, opts?: { status?: import("pi-telemetry/src/types.ts").PackageStatus; error?: string }): void {
  helpersTelemetryHeartbeat(name, opts);
}

/** Record a structured domain event. */
export function telemetryRecordEvent(pkgName: string, type: string, label: string, data?: Record<string, unknown>): void {
  helpersRecordEvent(pkgName, type, label, data);
}

/** Record a numeric metric value. */
export function telemetryRecordMetric(name: string, value: number, opts?: { cumulative?: boolean; tags?: Record<string, string> }): void {
  helpersRecordMetric(name, value, opts);
}

/** Record an error. */
export function telemetryRecordError(pkgName: string, type: string, message: string, stack?: string): void {
  helpersRecordError(pkgName, type, message, stack);
}
