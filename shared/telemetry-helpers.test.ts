/**
 * telemetry-helpers — unit tests
 * getTelemetry() returns null in the test environment, so these verify
 * the helpers are safe no-ops when telemetry is not loaded.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerPackage, telemetryNotify, telemetryHeartbeat } from "./telemetry-helpers.ts";

describe("telemetry-helpers (telemetry not loaded)", () => {
	it("registerPackage is a no-op when getTelemetry() returns null", () => {
		assert.doesNotThrow(() =>
			registerPackage({ name: "test", version: "1.0.0", description: "test pkg" })
		);
	});

	it("telemetryNotify is a no-op when getTelemetry() returns null", () => {
		assert.doesNotThrow(() =>
			telemetryNotify("hello world", { severity: "info" })
		);
	});

	it("telemetryHeartbeat is a no-op when getTelemetry() returns null", () => {
		assert.doesNotThrow(() => telemetryHeartbeat("my-package"));
	});
});
