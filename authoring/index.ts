/**
 * authoring — Umbrella entry point.
 *
 * Previously registered commit-helper. Now a no-op stub kept for
 * backward-compat with profile loaders. commit_message tool and
 * /commit command live in core-tools/smart-commit.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
	// intentionally empty — all authoring features moved to core-tools/smart-commit
}
