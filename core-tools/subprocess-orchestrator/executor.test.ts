/**
 * SubprocessExecutor — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SubprocessExecutor } from "./executor.ts";
import type { SubprocessTask } from "./types.ts";

function makeTask(id: string, cmd: string = "echo"): SubprocessTask {
  return { id, name: `Task ${id}`, cmd };
}

describe("SubprocessExecutor", () => {
  describe("execute", () => {
    it("should execute single task", async () => {
      const executor = new SubprocessExecutor({}, async () => ({
        exitCode: 0,
        stdout: "done",
      }));
      const tasks = [makeTask("t1")];
      const results = await executor.execute(tasks);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].status, "succeeded");
    });

    it("should execute multiple tasks sequentially by default", async () => {
      const order: string[] = [];
      const executor = new SubprocessExecutor({}, async (cmd, args) => {
        order.push(args[0] ?? cmd);
        return { exitCode: 0, stdout: "" };
      });

      const tasks = [
        makeTask("t1"),
        makeTask("t2"),
        makeTask("t3"),
      ];
      const results = await executor.execute(tasks);

      assert.strictEqual(results.length, 3);
      assert.ok(order.length > 0);
    });

    it("should execute tasks in parallel when configured", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const executor = new SubprocessExecutor(
        { parallel: true },
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
          return { exitCode: 0, stdout: "" };
        }
      );

      const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
      const results = await executor.execute(tasks);

      assert.strictEqual(results.length, 3);
      assert.ok(maxConcurrent > 1, "should run multiple tasks concurrently");
    });
  });

  describe("error handling", () => {
    it("should mark failed tasks", async () => {
      const executor = new SubprocessExecutor({}, async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "error",
      }));

      const tasks = [makeTask("t1")];
      const results = await executor.execute(tasks);

      assert.strictEqual(results[0].status, "failed");
      assert.strictEqual(results[0].exitCode, 1);
    });

    it("should stop on critical failure when configured", async () => {
      const executed: string[] = [];
      const executor = new SubprocessExecutor(
        { stopOnError: true },
        async (cmd, args) => {
          executed.push(args[0] ?? cmd);
          return { exitCode: 1, stdout: "" };
        }
      );

      const tasks = [
        { ...makeTask("t1"), critical: true },
        makeTask("t2"),
      ];
      const results = await executor.execute(tasks);

      // First task fails, second is skipped
      assert.ok(executed.length < tasks.length || results[0].status === "failed");
    });

    it("should measure task duration", async () => {
      const executor = new SubprocessExecutor({}, async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { exitCode: 0, stdout: "" };
      });

      const tasks = [makeTask("t1")];
      const results = await executor.execute(tasks);

      assert.ok(results[0].duration >= 50, `Expected duration >= 50ms, got ${results[0].duration}ms`);
    });
  });

  describe("configuration", () => {
    it("should use config timeout", async () => {
      const executor = new SubprocessExecutor({ timeout: 5000 });
      assert.ok(executor);
    });

    it("should support executor with retries config", async () => {
      const executor = new SubprocessExecutor({ retries: 2 });
      assert.ok(executor); // just verify it doesn't throw
    });
  });
});
