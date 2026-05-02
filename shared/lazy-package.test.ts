/**
 * Tests for LazyModule — deferred dynamic import wrapper.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LazyModule } from "./lazy-package.ts";

describe("LazyModule", () => {
  it("returns module on first get() call", async () => {
    const lazy = new LazyModule(() => Promise.resolve({ value: 42 }), "test");
    assert.equal(lazy.isLoaded(), false);
    const mod = await lazy.get();
    assert.deepStrictEqual(mod, { value: 42 });
    assert.equal(lazy.isLoaded(), true);
  });

  it("caches result across multiple get() calls", async () => {
    let callCount = 0;
    const lazy = new LazyModule(() => {
      callCount++;
      return Promise.resolve({ count: callCount });
    }, "test");

    const m1 = await lazy.get();
    const m2 = await lazy.get();
    assert.equal(m1.count, 1);
    assert.equal(m2.count, 1);
    assert.equal(callCount, 1);
  });

  it("caches and re-throws errors", async () => {
    const lazy = new LazyModule(
      () => Promise.reject(new Error("import failed")),
      "test",
    );

    await assert.rejects(() => lazy.get(), /import failed/);
    await assert.rejects(() => lazy.get(), /import failed/);
  });

  it("isLoaded returns false before first get()", async () => {
    const lazy = new LazyModule(() => Promise.resolve({}), "test");
    assert.equal(lazy.isLoaded(), false);
  });

  it("isLoaded returns true after successful get()", async () => {
    const lazy = new LazyModule(() => Promise.resolve({}), "test");
    await lazy.get();
    assert.equal(lazy.isLoaded(), true);
  });

  it("reset() clears cached module allowing re-import", async () => {
    let value = 1;
    const lazy = new LazyModule(() => Promise.resolve({ val: value++ }), "test");

    const m1 = await lazy.get();
    assert.equal(m1.val, 1);

    lazy.reset();
    assert.equal(lazy.isLoaded(), false);

    const m2 = await lazy.get();
    assert.equal(m2.val, 2);
  });

  it("handles synchronous rejection", async () => {
    const lazy = new LazyModule(
      () => Promise.reject(new Error("sync fail")),
      "test",
    );
    await assert.rejects(() => lazy.get(), /sync fail/);
  });
});
