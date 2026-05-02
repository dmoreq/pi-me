/**
 * pi-docparser — Document parsing (PDF, Office, spreadsheets, images).
 * Adopted from pi-docparser v1.1.1 by maxedapps.
 *
 * Uses LiteParse for document parsing with LibreOffice/ImageMagick/Ghostscript
 * as system-level dependencies.
 *
 * Lazy-loaded on session_start: LiteParse module is already deferred internally,
 * but we defer the entire package load to after pi startup for consistency.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const docParserMod = await import("pi-docparser");
      if (typeof docParserMod.default === "function") {
        await docParserMod.default(pi);
      }
      ctx.ui.setStatus("pi-docparser", "ready");
    } catch (err) {
      console.error("[pi-docparser] Failed to load:", err);
      ctx.ui.notify(
        "pi-docparser failed to load. Run: npm install pi-docparser",
        "error",
      );
    }
  });
}
