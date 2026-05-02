/**
 * @companion-ai/feynman — Research-first CLI agent for Pi.
 * Adopted from @companion-ai/feynman v0.2.40.
 *
 * Provides research tools, paper discovery, alphaXiv integration,
 * project scaffolding, and service tier management.
 *
 * Loaded on session_start to avoid initializing @companion-ai/alpha-hub
 * and @clack/prompts at pi startup.
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Register skill paths eagerly (light metadata)
  const extDir = dirname(fileURLToPath(import.meta.url));
  const pkgDir = join(extDir, "..", "..", "..", "node_modules", "@companion-ai", "feynman");
  pi.on("resources_discover", async () => ({
    skillPaths: [join(pkgDir, "skills")],
  }));

  // Defer extension init to session_start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import(
        "@companion-ai/feynman/extensions/research-tools.ts"
      );
      if (typeof mod.default === "function") {
        await mod.default(pi);
      }
      ctx.ui.setStatus("feynman", "ready");
    } catch (err) {
      console.error("[feynman] Failed to load:", err);
      ctx.ui.notify(
        "feynman failed to load. Run: npm install @companion-ai/feynman",
        "error",
      );
    }
  });
}
