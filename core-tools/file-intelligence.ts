/**
 * file-intelligence — barrel export
 */

export { FileIntelligenceExtension, default } from "./file-intelligence/index.ts";
export { FileStore } from "./file-intelligence/store.ts";
export { FileCapturer } from "./file-intelligence/capture.ts";
export type {
  FileIndex,
  FileMetadata,
  SearchResult,
  CaptureResult,
  ClassCapture,
  FunctionCapture,
  FileIntelligenceConfig,
} from "./file-intelligence/types.ts";
