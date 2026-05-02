/**
 * registerAdoptedPackage — DRY helper for adopted npm package wrappers.
 *
 * Handles the common pattern repeated across 15+ plugin wrappers:
 *   1. Wait for session_start
 *   2. Dynamic import the package
 *   3. Call its default export
 *   4. Set status to "ready" on success
 *   5. Notify the user on failure
 *
 * For packages that also ship skills, pass `skillPaths` and the handler
 * registers them eagerly via `resources_discover`.
 *
 * Uses `import type` which is fully erased at compile time (no runtime dep).
 * Consumers in non-pi environments only need the types available for TS checking.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface RegisterAdoptedPackageOptions {
  /** Async dynamic import that returns the module (e.g. `() => import("pi-crew")`) */
  importFn: () => Promise<Record<string, unknown>>;
  /** Key for setStatus (e.g. "pi-crew", "memex") */
  statusKey: string;
  /** Human-readable package name for error messages (e.g. "pi-crew", "@touchskyer/memex") */
  packageName: string;
  /** Optional: one or more skill directories to register via resources_discover */
  skillPaths?: string[];
}

/**
 * Register an adopted npm package with lazy session_start loading.
 *
 * @param pi     The ExtensionAPI instance
 * @param opts   Registration options
 */
export function registerAdoptedPackage(
  pi: ExtensionAPI,
  opts: RegisterAdoptedPackageOptions,
): void {
  const { importFn, statusKey, packageName, skillPaths } = opts;

  // Register skill paths eagerly if provided (light metadata, no binary loading)
  if (skillPaths && skillPaths.length > 0) {
    pi.on("resources_discover", async () => ({ skillPaths }));
  }

  // Defer full package initialization to session_start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await importFn();
      if (typeof mod.default === "function") {
        await (mod.default as Function)(pi);
      }
      ctx.ui.setStatus(statusKey, "ready");
    } catch (err) {
      console.error(`[${statusKey}] Failed to load:`, err);
      ctx.ui.notify(
        `${packageName} failed to load. Run: npm install ${packageName}`,
        "error",
      );
    }
  });
}
