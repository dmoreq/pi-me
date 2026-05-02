/**
 * Tests for registerAdoptedPackage — DRY helper for adopted package wrappers.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerAdoptedPackage } from "./register-package.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Minimal mock ExtensionAPI that captures on(), setStatus(), and notify() calls.
 */
function makePi() {
  const handlers: Record<string, Function[]> = {};
  const resourcesHandlers: Function[] = [];
  const statusCalls: Array<[string, string]> = [];
  const notifyCalls: Array<[string, string]> = [];

  const pi = {
    on(event: string, fn: Function) {
      // Route resources_discover to a separate array so we can test it independently
      if (event === "resources_discover") {
        resourcesHandlers.push(fn);
      } else {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
      }
    },
    _trigger: async (event: string, ctx: Record<string, unknown>) => {
      for (const fn of handlers[event] ?? []) await fn({}, ctx);
    },
    _triggerResources: async () => {
      let merged: { skillPaths: string[] } = { skillPaths: [] };
      for (const fn of resourcesHandlers) {
        const r = await fn();
        if (r?.skillPaths) merged.skillPaths.push(...r.skillPaths);
      }
      return merged;
    },
    _resourcesHandlers: resourcesHandlers,
    _statusCalls: statusCalls,
    _notifyCalls: notifyCalls,
  } as unknown as ExtensionAPI & {
    _trigger: (e: string, ctx: Record<string, unknown>) => Promise<void>;
    _triggerResources: () => Promise<{ skillPaths: string[] }>;
    _resourcesHandlers: Function[];
    _statusCalls: Array<[string, string]>;
    _notifyCalls: Array<[string, string]>;
  };

  const ctx = {
    ui: {
      setStatus(key: string, val: string) {
        statusCalls.push([key, val]);
      },
      notify(msg: string, type: string) {
        notifyCalls.push([msg, type]);
      },
    },
  };

  return { pi, ctx };
}

describe("registerAdoptedPackage", () => {
  it("calls mod.default(pi) and sets status to ready on success", async () => {
    const { pi, ctx } = makePi();
    let called = false;
    registerAdoptedPackage(pi, {
      importFn: async () => ({
        default: () => {
          called = true;
        },
      }),
      statusKey: "test-pkg",
      packageName: "test-pkg",
    });

    await (pi as any)._trigger("session_start", ctx);

    assert.equal(called, true);
    assert.deepEqual((pi as any)._statusCalls, [["test-pkg", "ready"]]);
  });

  it("logs error and notifies when import throws", async () => {
    const { pi, ctx } = makePi();
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    registerAdoptedPackage(pi, {
      importFn: async () => {
        throw new Error("boom");
      },
      statusKey: "bad-pkg",
      packageName: "bad-pkg",
    });

    await (pi as any)._trigger("session_start", ctx);

    console.error = origError;
    assert.ok(errors.length >= 1);
    assert.match(String(errors[0]), /bad-pkg/);
    assert.ok((pi as any)._notifyCalls.length >= 1);
    assert.match((pi as any)._notifyCalls[0][0], /bad-pkg failed to load/);
    assert.equal((pi as any)._notifyCalls[0][1], "error");
  });

  it("does not crash when module has no default export", async () => {
    const { pi, ctx } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "no-default",
      packageName: "no-default",
    });

    await assert.doesNotReject(() =>
      (pi as any)._trigger("session_start", ctx),
    );
    assert.deepEqual((pi as any)._statusCalls, [["no-default", "ready"]]);
  });

  it("registers resources_discover when skillPaths provided", async () => {
    const { pi } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "with-skills",
      packageName: "with-skills",
      skillPaths: ["/some/skills/dir"],
    });

    const result = await (pi as any)._triggerResources();
    assert.deepEqual(result.skillPaths, ["/some/skills/dir"]);
  });

  it("does not register resources_discover when skillPaths not provided", async () => {
    const { pi } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "no-skills",
      packageName: "no-skills",
    });

    assert.equal((pi as any)._resourcesHandlers.length, 0);
  });

  it("passes pi to the module default", async () => {
    const { pi, ctx } = makePi();
    let receivedApi: unknown;

    registerAdoptedPackage(pi, {
      importFn: async () => ({
        default: (api: unknown) => {
          receivedApi = api;
        },
      }),
      statusKey: "pass-pi",
      packageName: "pass-pi",
    });

    await (pi as any)._trigger("session_start", ctx);
    assert.equal(receivedApi, pi);
  });
});
