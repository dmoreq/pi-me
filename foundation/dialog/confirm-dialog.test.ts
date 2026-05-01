import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildConfirmItems } from "./confirm-dialog.js";

describe("buildConfirmItems", () => {
  it("maps option array to WrappingSelectItems with kind=option", () => {
    const items = buildConfirmItems([
      { label: "Allow once", description: "Run this command once" },
      { label: "Cancel",     description: "Skip this command" },
    ]);
    assert.deepEqual(items, [
      { kind: "option", label: "Allow once", description: "Run this command once" },
      { kind: "option", label: "Cancel",     description: "Skip this command" },
    ]);
  });

  it("preserves order", () => {
    const items = buildConfirmItems([
      { label: "A", description: "first" },
      { label: "B", description: "second" },
      { label: "C", description: "third" },
    ]);
    assert.equal(items[0].label, "A");
    assert.equal(items[1].label, "B");
    assert.equal(items[2].label, "C");
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(buildConfirmItems([]), []);
  });

  it("supports more than 4 options (not limited by MAX_OPTIONS)", () => {
    const items = buildConfirmItems([
      { label: "One",   description: "" },
      { label: "Two",   description: "" },
      { label: "Three", description: "" },
      { label: "Four",  description: "" },
      { label: "Five",  description: "" },
    ]);
    assert.equal(items.length, 5);
  });
});
