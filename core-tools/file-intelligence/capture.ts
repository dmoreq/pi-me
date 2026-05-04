/**
 * FileCapturer — Extract structure from source files (AST-like analysis)
 */

import type { CaptureResult, ClassCapture, FunctionCapture } from "./types.ts";

export class FileCapturer {
  /**
   * Capture structure from TypeScript/JavaScript source code.
   */
  static capture(filePath: string, content: string): CaptureResult {
    const lines = content.split("\n");

    return {
      filePath,
      imports: this.captureImports(content),
      exports: this.captureExports(content),
      classes: this.captureClasses(content),
      functions: this.captureFunctions(content),
    };
  }

  /**
   * Extract import statements.
   */
  private static captureImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/^import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (match) imports.push(match[1]);

      const matchNamed = line.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
      if (matchNamed) imports.push(matchNamed[2]);

      const matchDefault = line.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (matchDefault) imports.push(matchDefault[2]);
    }

    return [...new Set(imports)]; // deduplicate
  }

  /**
   * Extract export statements.
   */
  private static captureExports(content: string): string[] {
    const exports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      // export { foo, bar }
      const matchNamed = line.match(/^export\s+\{([^}]+)\}/);
      if (matchNamed) {
        const items = matchNamed[1].split(",").map(s => s.trim());
        exports.push(...items);
      }

      // export function foo
      const matchFunc = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (matchFunc) exports.push(matchFunc[1]);

      // export class Foo
      const matchClass = line.match(/^export\s+class\s+(\w+)/);
      if (matchClass) exports.push(matchClass[1]);

      // export const foo
      const matchConst = line.match(/^export\s+(?:const|let|var)\s+(\w+)/);
      if (matchConst) exports.push(matchConst[1]);
    }

    return [...new Set(exports)]; // deduplicate
  }

  /**
   * Extract class definitions.
   */
  private static captureClasses(content: string): ClassCapture[] {
    const classes: ClassCapture[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(?:export\s+)?class\s+(\w+)/);

      if (match) {
        const name = match[1];
        const startLine = i + 1;

        // Find closing brace
        let endLine = i + 1;
        let braceCount = 0;
        let foundOpen = false;

        for (let j = i; j < lines.length; j++) {
          for (const char of lines[j]) {
            if (char === "{") {
              braceCount++;
              foundOpen = true;
            } else if (char === "}") {
              braceCount--;
              if (foundOpen && braceCount === 0) {
                endLine = j + 1;
                break;
              }
            }
          }
          if (foundOpen && braceCount === 0) break;
        }

        // Extract methods and properties
        const classContent = lines.slice(i + 1, endLine).join("\n");
        const methods = (classContent.match(/\b(\w+)\s*\(/g) || []).map(m => m.replace(/\s*\(/, ""));
        const properties = (classContent.match(/^\s+(\w+)\s*[:=]/m) || []).map(p => p.trim());

        classes.push({
          name,
          methods: [...new Set(methods)],
          properties: [...new Set(properties)],
          startLine,
          endLine,
        });

        i = endLine - 1;
      }
    }

    return classes;
  }

  /**
   * Extract function definitions.
   */
  private static captureFunctions(content: string): FunctionCapture[] {
    const functions: FunctionCapture[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)/);

      if (match) {
        const name = match[1];
        const params = match[2].split(",").map(p => p.trim());

        functions.push({
          name,
          parameters: params.filter(p => p.length > 0),
          startLine: i + 1,
          endLine: i + 1, // simplified — would need full parsing for accurate end
        });
      }
    }

    return functions;
  }
}
