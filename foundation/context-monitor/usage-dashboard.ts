/**
 * Usage Dashboard — Cost and usage statistics dashboard.
 *
 * Merged from session-lifecycle/usage-extension/:
 * - /usage command: Shows interactive usage statistics dashboard
 * - /cost command: Shows cost report from session logs
 *
 * Re-exports UsageComponent, collectUsageData, CostComponent for backward compat.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { CancellableLoader, Container, Spacer } from "@mariozechner/pi-tui";
import {
  UsageComponent,
  collectUsageData,
  clampLines,
  type UsageData,
} from "./usage-extension-core.js";
import { scanSessionLogs, CostComponent } from "./cost-tracker.js";

export { UsageComponent, collectUsageData, clampLines, type UsageData };
export { scanSessionLogs, CostComponent };

export class UsageDashboard {
  registerCommands(pi: ExtensionAPI): void {
    pi.registerCommand("usage", {
      description: "Show usage statistics dashboard",
      handler: async (_args: string, ctx: ExtensionCommandContext) => {
        if (!ctx.hasUI) return;

        const data = await ctx.ui.custom<UsageData | null>((tui, theme, _kb, done) => {
          const loader = new CancellableLoader(
            tui,
            (s: string) => theme.fg("accent", s),
            (s: string) => theme.fg("muted", s),
            "Loading Usage...",
          );
          let finished = false;
          const finish = (value: UsageData | null) => {
            if (finished) return;
            finished = true;
            loader.dispose();
            done(value);
          };

          loader.onAbort = () => finish(null);

          collectUsageData(loader.signal)
            .then(finish)
            .catch(() => finish(null));

          return loader;
        });

        if (!data) return;

        await ctx.ui.custom<void>((tui, theme, _kb, done) => {
          const container = new Container();
          container.addChild(new Spacer(1));
          container.addChild(new DynamicBorder((s: string) => theme.fg("border", s)));
          container.addChild(new Spacer(1));

          const usage = new UsageComponent(theme, data, () => tui.requestRender(), () => done());

          return {
            render: (w: number) => {
              const borderLines = clampLines(container.render(w), w);
              const usageLines = usage.render(w);
              const bottomBorder = theme.fg("border", "─".repeat(w));
              return clampLines([...borderLines, ...usageLines, "", bottomBorder], w);
            },
            invalidate: () => container.invalidate(),
            handleInput: (input: string) => usage.handleInput(input),
            dispose: () => {},
          };
        });
      },
    });

    pi.registerCommand("cost", {
      description: "Show cost report from session logs",
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        if (!ctx.hasUI) {
          ctx.ui.notify("Cost report requires interactive mode", "error");
          return;
        }
        const daysBack = parseInt(args || "30") || 30;
        await ctx.ui.custom((tui, theme, _kb, done) => {
          return new CostComponent(tui, theme, () => done(undefined), daysBack);
        });
      },
    });
  }
}
