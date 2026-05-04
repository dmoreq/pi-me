/**
 * File Intelligence types
 */

export interface FileIndex {
  path: string;
  language: string;
  lines: number;
  imports: string[]; // paths this file imports
  exports: string[]; // named exports
  classes: string[]; // class names
  functions: string[]; // function names
  types: string[]; // type/interface names
  lastIndexedAt: string; // ISO timestamp
}

export interface FileMetadata {
  path: string;
  size: number;
  mtime: number;
  isDirectory: boolean;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
}

export interface CaptureResult {
  filePath: string;
  imports: string[];
  exports: string[];
  classes: ClassCapture[];
  functions: FunctionCapture[];
}

export interface ClassCapture {
  name: string;
  methods: string[];
  properties: string[];
  startLine: number;
  endLine: number;
}

export interface FunctionCapture {
  name: string;
  parameters: string[];
  startLine: number;
  endLine: number;
}

export interface FileIntelligenceConfig {
  enabled: boolean;
  indexDir: string; // e.g. ~/.pi/indexes
  maxFileSize: number; // bytes, default 1MB
  excludePatterns: string[]; // glob patterns to skip
  languages: string[]; // file extensions to index
}
