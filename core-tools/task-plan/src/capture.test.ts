import { describe, it, expect } from "node:test";
import { strict as assert } from "node:assert";
import { TaskCapture, isActionableTaskText } from "./capture.ts";
import type { IIntentClassifier, Message, Task } from "./types.ts";

describe("TaskCapture", () => {
  it("deduplicates identical text with different whitespace and case", async () => {
    const classifier: IIntentClassifier = {
      classify: () => "implement",
    };
    const capture = new TaskCapture(classifier);
    const messages: Message[] = [
      { role: "user", content: "Build the API" },
      { role: "user", content: "build   the api" },
    ];

    const result = await capture.capture(messages);

    assert.equal(result.tasks.length, 1);
  });

  it("captures only user messages", async () => {
    const classifier: IIntentClassifier = {
      classify: () => "implement",
    };
    const capture = new TaskCapture(classifier);
    const messages: Message[] = [
      { role: "assistant", content: "ignore me" },
      { role: "user", content: "Implement feature" },
    ];

    const result = await capture.capture(messages);

    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].text, "Implement feature");
  });

  it("gates auto-capture by actionability mode", () => {
    assert.equal(isActionableTaskText("Help me analyze task-plan", "explicit"), false);
    assert.equal(isActionableTaskText("Todo: improve task-plan", "explicit"), true);
    assert.equal(isActionableTaskText("- fix auth\n- add tests", "explicit"), true);
    assert.equal(isActionableTaskText("Implement bulk cleanup", "smart"), true);
    assert.equal(isActionableTaskText("Implement bulk cleanup", "off"), false);
    assert.equal(isActionableTaskText("What is this feature?", "all"), true);
  });
});
