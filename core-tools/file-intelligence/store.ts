/**
 * FileStore — JSON-based persistence for file indexes
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FileIndex, FileMetadata } from "./types.ts";

export class FileStore {
  private indexDir: string;
  private indexes = new Map<string, FileIndex>();

  constructor(indexDir: string = "./.pi/indexes") {
    this.indexDir = indexDir;
    this.ensureDir();
  }

  /**
   * Save a file index.
   */
  async save(index: FileIndex): Promise<void> {
    this.indexes.set(index.path, index);

    const filePath = this.getIndexPath(index.path);
    this.ensureDir();

    try {
      fs.writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
    } catch (err) {
      throw new Error(`Failed to save index for ${index.path}: ${err}`);
    }
  }

  /**
   * Load a file index by path.
   */
  async get(filePath: string): Promise<FileIndex | null> {
    // Check memory cache first
    if (this.indexes.has(filePath)) {
      return this.indexes.get(filePath)!;
    }

    const indexPath = this.getIndexPath(filePath);
    try {
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, "utf-8");
        const index = JSON.parse(data) as FileIndex;
        this.indexes.set(filePath, index);
        return index;
      }
    } catch (err) {
      // Silently fail — index file may be corrupted
    }

    return null;
  }

  /**
   * Get all indexed files.
   */
  async getAll(): Promise<FileIndex[]> {
    // Load from disk if cache is empty
    if (this.indexes.size === 0) {
      try {
        if (fs.existsSync(this.indexDir)) {
          const files = fs.readdirSync(this.indexDir);
          for (const file of files) {
            if (file.endsWith(".json")) {
              const data = fs.readFileSync(path.join(this.indexDir, file), "utf-8");
              const index = JSON.parse(data) as FileIndex;
              this.indexes.set(index.path, index);
            }
          }
        }
      } catch (err) {
        // Silently fail
      }
    }

    return Array.from(this.indexes.values());
  }

  /**
   * Delete an index.
   */
  async delete(filePath: string): Promise<void> {
    this.indexes.delete(filePath);

    const indexPath = this.getIndexPath(filePath);
    try {
      if (fs.existsSync(indexPath)) {
        fs.unlinkSync(indexPath);
      }
    } catch (err) {
      // Silently fail
    }
  }

  /**
   * Clear all indexes.
   */
  async clear(): Promise<void> {
    this.indexes.clear();

    try {
      if (fs.existsSync(this.indexDir)) {
        fs.rmSync(this.indexDir, { recursive: true });
      }
    } catch (err) {
      // Silently fail
    }
  }

  /**
   * Get count of indexed files.
   */
  async count(): Promise<number> {
    return (await this.getAll()).length;
  }

  /**
   * Search for files by path pattern.
   */
  async search(pattern: RegExp): Promise<FileIndex[]> {
    const all = await this.getAll();
    return all.filter(idx => pattern.test(idx.path));
  }

  /**
   * Get files by language.
   */
  async getByLanguage(language: string): Promise<FileIndex[]> {
    const all = await this.getAll();
    return all.filter(idx => idx.language === language);
  }

  private getIndexPath(filePath: string): string {
    const hash = this.hashPath(filePath);
    return path.join(this.indexDir, `${hash}.json`);
  }

  private hashPath(filePath: string): string {
    // Simple hash: just use base name + first few chars
    const normalized = filePath.replace(/\//g, "_").replace(/\\/g, "_");
    return normalized.slice(0, 100);
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.indexDir)) {
        fs.mkdirSync(this.indexDir, { recursive: true });
      }
    } catch (err) {
      // Silently fail
    }
  }
}
