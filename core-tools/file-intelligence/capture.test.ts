/**
 * FileCapturer — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FileCapturer } from "./capture.ts";

describe("FileCapturer", () => {
  describe("captureImports", () => {
    it("should extract named imports", () => {
      const code = `import { readFile, writeFile } from "fs";\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.imports.includes("fs"));
    });

    it("should extract default imports", () => {
      const code = `import React from "react";\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.imports.includes("react"));
    });

    it("should deduplicate imports", () => {
      const code = `import { foo } from "lib";\nimport { bar } from "lib";\n`;
      const result = FileCapturer.capture("test.ts", code);
      const libCount = result.imports.filter(i => i === "lib").length;
      assert.strictEqual(libCount, 1);
    });

    it("should return empty for no imports", () => {
      const code = `const x = 1;\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.strictEqual(result.imports.length, 0);
    });
  });

  describe("captureExports", () => {
    it("should extract named exports", () => {
      const code = `export { foo, bar };\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.exports.includes("foo"));
      assert.ok(result.exports.includes("bar"));
    });

    it("should extract function exports", () => {
      const code = `export function greet(name: string) { return "hi"; }\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.exports.includes("greet"));
    });

    it("should extract class exports", () => {
      const code = `export class User { }\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.exports.includes("User"));
    });

    it("should extract const exports", () => {
      const code = `export const VERSION = "1.0.0";\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.exports.includes("VERSION"));
    });
  });

  describe("captureClasses", () => {
    it("should extract class definitions", () => {
      const code = `
class MyClass {
  constructor() {}
  method1() {}
  method2() {}
}
`;
      const result = FileCapturer.capture("test.ts", code);
      assert.strictEqual(result.classes.length, 1);
      assert.strictEqual(result.classes[0].name, "MyClass");
    });

    it("should extract class methods", () => {
      const code = `
class MyClass {
  doSomething() {}
  doAnother() {}
}
`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.classes[0].methods.length > 0);
    });

    it("should handle multiple classes", () => {
      const code = `
class ClassA { }
class ClassB { }
class ClassC { }
`;
      const result = FileCapturer.capture("test.ts", code);
      assert.strictEqual(result.classes.length, 3);
    });
  });

  describe("captureFunctions", () => {
    it("should extract function definitions", () => {
      const code = `
function greet(name: string): string {
  return "hello " + name;
}
`;
      const result = FileCapturer.capture("test.ts", code);
      assert.strictEqual(result.functions.length, 1);
      assert.strictEqual(result.functions[0].name, "greet");
    });

    it("should extract function parameters", () => {
      const code = `function add(a: number, b: number): number { return a + b; }\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.functions[0].parameters.length >= 2);
    });

    it("should handle async functions", () => {
      const code = `export async function fetchData() { }\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.functions.some(f => f.name === "fetchData"));
    });

    it("should return empty for no functions", () => {
      const code = `const x = () => {};\n`;
      const result = FileCapturer.capture("test.ts", code);
      assert.strictEqual(result.functions.length, 0);
    });
  });

  describe("full capture", () => {
    it("should capture complete file structure", () => {
      const code = `
import { readFile } from "fs";
export { greet, farewell };
export function greet(name: string) { return "hi"; }
export const farewell = "bye";
class User {
  constructor() {}
  getName() { return ""; }
}
`;
      const result = FileCapturer.capture("test.ts", code);
      assert.ok(result.imports.length > 0);
      assert.ok(result.exports.length > 0);
      assert.ok(result.classes.length > 0);
      assert.ok(result.functions.length > 0);
    });
  });
});
