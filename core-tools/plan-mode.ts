/**
 * Plan Mode Extension - Extension Glue
 *
 * pi registration, TUI rendering, and event hooks.
 * Core logic lives in plan-mode-core.ts.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, keyHint, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import crypto from "node:crypto";
import {
  Container,
  type Focusable,
  Input,
  Key,
  Markdown,
  SelectList,
  Spacer,
  type SelectItem,
  Text,
  TUI,
  fuzzyMatch,
  getEditorKeybindings,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@mariozechner/pi-tui";
import {
  type PlanAction, type PlanToolDetails, type PlanRecord, type PlanFrontMatter, type LockInfo, type PlanStep, type PlanSettings,
  PlanParams,
  NORMAL_MODE_TOOLS, PLAN_MODE_TOOLS, PLAN_DIR_NAME, PLAN_PATH_ENV, PLAN_SETTINGS_NAME, PLAN_ID_PREFIX, PLAN_ID_PATTERN, LOCK_TTL_MS,
  DESTRUCTIVE_PATTERNS, SAFE_COMMANDS, DEFAULT_PLAN_SETTINGS, PLAN_MODE_ENABLED_FOR_TOOLS,
  isSafeCommand, formatPlanId, normalizePlanId, validatePlanId, displayPlanId, isPlanCompleted,
  getPlansDir, getPlansDirLabel, getPlanPath, getLockPath, getPlanSettingsPath, findJsonObjectEnd, splitFrontMatter,
  parseFrontMatter, parsePlanContent, serializePlan, listPlansSync, sortPlans, filterPlans, buildPlanSearchText,
  renderAssignmentSuffix, renderPlanHeading, constructPlanFromArgs,
  createPlanFile, readPlanFile, lockPlan, unlockPlan, isPlanLockedByOther, loadPlanSettings, savePlanSettings, deletePlanFile,
  garbageCollectPlans, renderPlanForLLM, renderStatusLine, renderPlanDetail, renderPlanList, renderEmptyPlanList, appendExpandHint,
  ensurePlansDir, writePlanFile, generatePlanId, readLockInfo, acquireLock, withPlanLock, listPlans, readPlanSettings,
  createPlanGarbageCollect, gcPlans,
  createPlan, updatePlan, addStep, completeStep, claimPlan, releasePlan, getPlan, deletePlan, executePlanStep,
} from "./plan-mode-core.js";
export default function planModeExtension(pi: ExtensionAPI) {
	let planningModeEnabled = false;
	let activePlanId: string | null = null;

	// Register --plan CLI flag
	pi.registerFlag("plan", {
		description: "Start in planning mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	// Helper to update status
	function updateStatus(ctx: ExtensionContext) {
		if (planningModeEnabled) {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ planning"));
		} else if (activePlanId) {
			const plansDir = getPlansDir(ctx.cwd);
			const plans = listPlansSync(plansDir);
			const plan = plans.find((p) => p.id === activePlanId);
			if (plan) {
				const done = plan.steps.filter((s) => s.done).length;
				const total = plan.steps.length;
				ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${done}/${total}`));
			}
		} else {
			ctx.ui.setStatus("plan-mode", undefined);
		}
	}

	// Update widget for active plan
	function updateWidget(ctx: ExtensionContext) {
		if (!activePlanId) {
			ctx.ui.setWidget("plan-steps", undefined);
			return;
		}
		const plansDir = getPlansDir(ctx.cwd);
		try {
			const content = readFileSync(getPlanPath(plansDir, activePlanId), "utf8");
			const plan = parsePlanContent(content, activePlanId);
			if (plan.steps.length === 0) {
				ctx.ui.setWidget("plan-steps", undefined);
				return;
			}
			const lines = plan.steps.map((s) => {
				if (s.done) {
					return ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(s.text));
				}
				return ctx.ui.theme.fg("muted", "☐ ") + s.text;
			});
			ctx.ui.setWidget("plan-steps", lines);
		} catch {
			ctx.ui.setWidget("plan-steps", undefined);
		}
	}

	function togglePlanningMode(ctx: ExtensionContext) {
		planningModeEnabled = !planningModeEnabled;
		if (planningModeEnabled) {
			pi.setActiveTools(PLAN_MODE_TOOLS);
			ctx.ui.notify(`Planning mode enabled. Read-only tools: ${PLAN_MODE_TOOLS.join(", ")}`);
		} else {
			pi.setActiveTools(NORMAL_MODE_TOOLS);
			ctx.ui.notify("Planning mode disabled. Full access restored.");
		}
		updateStatus(ctx);
	}

	// Block destructive bash in planning mode
	pi.on("tool_call", async (event) => {
		if (!planningModeEnabled) return;
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		if (!isSafeCommand(command)) {
			return {
				block: true,
				reason: `Planning mode: destructive command blocked. Use /plan off to disable.\nCommand: ${command}`,
			};
		}
	});

	// Inject context for planning mode
	pi.on("before_agent_start", async () => {
		if (planningModeEnabled) {
			return {
				message: {
					customType: "plan-mode-context",
					content: `[PLANNING MODE ACTIVE]
You are in planning mode - a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: read, bash, grep, find, ls
- Bash is restricted to READ-ONLY commands
- Focus on analysis, planning, and understanding

Use the "plan" tool to:
- Create a plan with steps
- List existing plans
- Get plan details

Do NOT attempt to make changes - just describe what you would do.`,
					display: false,
				},
			};
		}

		if (activePlanId) {
			const plansDir = getPlansDir(process.cwd());
			try {
				const content = readFileSync(getPlanPath(plansDir, activePlanId), "utf8");
				const plan = parsePlanContent(content, activePlanId);
				const remaining = plan.steps.filter((s) => !s.done);
				if (remaining.length === 0) {
					return {
						message: {
							customType: "plan-execution-context",
							content: `[EXECUTING PLAN ${formatPlanId(activePlanId)}]

All steps are complete! Use the plan tool to mark the plan as "completed".`,
							display: false,
						},
					};
				}
				const stepsList = remaining.map((s) => `${s.id}. ${s.text}`).join("\n");
				return {
					message: {
						customType: "plan-execution-context",
						content: `[EXECUTING PLAN ${formatPlanId(activePlanId)}]

Remaining steps:
${stepsList}

Execute each step in order. Use the plan tool with action "complete-step" and step_id to mark steps done.`,
						display: false,
					},
				};
			} catch {
				// ignore
			}
		}
	});

	// Register the plan tool
	const plansDirLabel = getPlansDirLabel(process.cwd());

	pi.registerTool({
		name: "plan",
		label: "Plan",
		description:
			`Manage file-based plans in ${plansDirLabel}. Actions: list, get, create, update, add-step, complete-step, delete, claim, release, execute. ` +
			"Plans have steps that can be marked complete. Claim plans before working on them. " +
			"Plan ids are shown as PLAN-<hex>; id parameters accept PLAN-<hex> or raw hex.",
		parameters: PlanParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const plansDir = getPlansDir(ctx.cwd);
			const action: PlanAction = params.action;

			switch (action) {
				case "list": {
					const plans = await listPlans(plansDir);
					const currentSessionId = ctx.sessionManager.getSessionId();
					return {
						content: [{ type: "text", text: serializePlanListForAgent(plans) }],
						details: { action: "list", plans, currentSessionId } as PlanToolDetails,
					};
				}

				case "get": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "get", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "get", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "get", error: "not found" } };
					}
					const plan = await readPlanFile(filePath, validated.id);
					return {
						content: [{ type: "text", text: serializePlanForAgent(plan) }],
						details: { action: "get", plan } as PlanToolDetails,
					};
				}

				case "create": {
					if (!params.title) {
						return { content: [{ type: "text", text: "Error: title required" }], details: { action: "create", error: "title required" } };
					}
					await ensurePlansDir(plansDir);
					const id = await generatePlanId(plansDir);
					const filePath = getPlanPath(plansDir, id);
					const steps: PlanStep[] = (params.steps ?? []).map((text, i) => ({
						id: i + 1,
						text,
						done: false,
					}));
					const plan: PlanRecord = {
						id,
						title: params.title,
						status: params.status ?? "draft",
						created_at: new Date().toISOString(),
						assigned_to_session: undefined,
						steps,
						body: params.body ?? "",
					};
					const result = await withPlanLock(plansDir, id, ctx, async () => {
						await writePlanFile(filePath, plan);
						return plan;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "create", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(plan) }],
						details: { action: "create", plan } as PlanToolDetails,
					};
				}

				case "update": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "update", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "update", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "update", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (params.title !== undefined) existing.title = params.title;
						if (params.status !== undefined) existing.status = params.status;
						if (params.body !== undefined) existing.body = params.body;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "update", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "update", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "add-step": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "add-step", error: "id required" } };
					}
					if (!params.step_text) {
						return { content: [{ type: "text", text: "Error: step_text required" }], details: { action: "add-step", error: "step_text required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "add-step", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "add-step", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						const maxId = existing.steps.reduce((max, s) => Math.max(max, s.id), 0);
						existing.steps.push({ id: maxId + 1, text: params.step_text!, done: false });
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "add-step", error: result.error } };
					}
					// Update widget if this is the active plan
					if (activePlanId === validated.id) {
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "add-step", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "complete-step": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "complete-step", error: "id required" } };
					}
					if (params.step_id === undefined) {
						return { content: [{ type: "text", text: "Error: step_id required" }], details: { action: "complete-step", error: "step_id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "complete-step", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "complete-step", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						const step = existing.steps.find((s) => s.id === params.step_id);
						if (!step) {
							return { error: `Step ${params.step_id} not found in plan ${displayPlanId(validated.id)}` } as const;
						}
						step.done = true;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "complete-step", error: result.error } };
					}
					// Update widget if this is the active plan
					if (activePlanId === validated.id) {
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "complete-step", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "claim": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "claim", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "claim", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "claim", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (isPlanCompleted(existing.status)) {
							return { error: `Plan ${displayPlanId(validated.id)} is ${existing.status}` } as const;
						}
						const assigned = existing.assigned_to_session;
						if (assigned && assigned !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is already assigned to session ${assigned}. Use force to override.` } as const;
						}
						existing.assigned_to_session = sessionId;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "claim", error: result.error } };
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "claim", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "release": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "release", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "release", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "release", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (!existing.assigned_to_session) return existing;
						if (existing.assigned_to_session !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is assigned to session ${existing.assigned_to_session}. Use force to release.` } as const;
						}
						existing.assigned_to_session = undefined;
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "release", error: result.error } };
					}
					// Clear active plan if releasing current
					if (activePlanId === validated.id) {
						activePlanId = null;
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "release", plan: result as PlanRecord } as PlanToolDetails,
					};
				}

				case "execute": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "execute", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "execute", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "execute", error: "not found" } };
					}
					const sessionId = ctx.sessionManager.getSessionId();
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						if (isPlanCompleted(existing.status)) {
							return { error: `Plan ${displayPlanId(validated.id)} is ${existing.status}` } as const;
						}
						// Auto-claim if not assigned
						if (!existing.assigned_to_session) {
							existing.assigned_to_session = sessionId;
						} else if (existing.assigned_to_session !== sessionId && !params.force) {
							return { error: `Plan ${displayPlanId(validated.id)} is assigned to session ${existing.assigned_to_session}. Use force to override.` } as const;
						}
						// Activate
						existing.status = "active";
						await writePlanFile(filePath, existing);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "execute", error: result.error } };
					}
					// Set as active plan and disable planning mode
					planningModeEnabled = false;
					activePlanId = validated.id;
					pi.setActiveTools(NORMAL_MODE_TOOLS);
					updateWidget(ctx);
					updateStatus(ctx);
					const plan = result as PlanRecord;
					const remaining = plan.steps.filter((s) => !s.done);
					const stepsList = remaining.length > 0
						? remaining.map((s) => `${s.id}. ${s.text}`).join("\n")
						: "All steps complete!";
					return {
						content: [{ type: "text", text: `Executing plan ${formatPlanId(validated.id)}. Remaining steps:\n${stepsList}` }],
						details: { action: "execute", plan } as PlanToolDetails,
					};
				}

				case "delete": {
					if (!params.id) {
						return { content: [{ type: "text", text: "Error: id required" }], details: { action: "delete", error: "id required" } };
					}
					const validated = validatePlanId(params.id);
					if ("error" in validated) {
						return { content: [{ type: "text", text: validated.error }], details: { action: "delete", error: validated.error } };
					}
					const filePath = getPlanPath(plansDir, validated.id);
					if (!existsSync(filePath)) {
						return { content: [{ type: "text", text: `Plan ${displayPlanId(validated.id)} not found` }], details: { action: "delete", error: "not found" } };
					}
					const result = await withPlanLock(plansDir, validated.id, ctx, async () => {
						const existing = await readPlanFile(filePath, validated.id);
						await fs.unlink(filePath);
						return existing;
					});
					if (typeof result === "object" && "error" in result) {
						return { content: [{ type: "text", text: result.error }], details: { action: "delete", error: result.error } };
					}
					// Clear active plan if deleting current
					if (activePlanId === validated.id) {
						activePlanId = null;
						updateWidget(ctx);
						updateStatus(ctx);
					}
					return {
						content: [{ type: "text", text: serializePlanForAgent(result as PlanRecord) }],
						details: { action: "delete", plan: result as PlanRecord } as PlanToolDetails,
					};
				}
			}
		},

		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "";
			const id = typeof args.id === "string" ? args.id : "";
			const normalizedId = id ? normalizePlanId(id) : "";
			const title = typeof args.title === "string" ? args.title : "";
			const stepId = typeof args.step_id === "number" ? args.step_id : undefined;

			let text = theme.fg("toolTitle", theme.bold("plan ")) + theme.fg("muted", action);
			if (normalizedId) text += " " + theme.fg("accent", formatPlanId(normalizedId));
			if (title) text += " " + theme.fg("dim", `"${title}"`);
			if (stepId !== undefined) text += " " + theme.fg("warning", `step #${stepId}`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as PlanToolDetails | undefined;
			if (isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			if (details.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			if (details.action === "list") {
				const plans = details.plans;
				if (plans.length === 0) {
					return new Text(theme.fg("dim", "No plans"), 0, 0);
				}
				const active = plans.filter((p) => p.status === "active");
				const draft = plans.filter((p) => p.status === "draft");
				const completed = plans.filter((p) => isPlanCompleted(p.status));
				const lines: string[] = [];

				const showSection = (label: string, sectionPlans: PlanFrontMatter[], max: number) => {
					lines.push(theme.fg("muted", `${label} (${sectionPlans.length})`));
					if (sectionPlans.length === 0) {
						lines.push(theme.fg("dim", "  none"));
						return;
					}
					const show = expanded ? sectionPlans : sectionPlans.slice(0, max);
					for (const p of show) {
						lines.push("  " + renderPlanHeading(theme, p, details.currentSessionId));
					}
					if (!expanded && sectionPlans.length > max) {
						lines.push(theme.fg("dim", `  ... ${sectionPlans.length - max} more`));
					}
				};

				showSection("Active", active, 3);
				lines.push("");
				showSection("Draft", draft, 3);
				lines.push("");
				showSection("Completed", completed, 2);

				let text = lines.join("\n");
				if (!expanded) text = appendExpandHint(theme, text);
				return new Text(text, 0, 0);
			}

			if (!("plan" in details)) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const plan = details.plan;
			const actionLabel =
				details.action === "create" ? "Created" :
				details.action === "update" ? "Updated" :
				details.action === "add-step" ? "Added step to" :
				details.action === "complete-step" ? "Completed step in" :
				details.action === "delete" ? "Deleted" :
				details.action === "claim" ? "Claimed" :
				details.action === "release" ? "Released" :
				details.action === "execute" ? "Executing" :
				null;

			let text = "";
			if (actionLabel) {
				text += theme.fg("success", "✓ ") + theme.fg("muted", `${actionLabel} `);
			}
			text += renderPlanHeading(theme, plan);

			if (expanded && plan.steps.length > 0) {
				text += "\n";
				for (const s of plan.steps) {
					const check = s.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
					const stepText = s.done ? theme.fg("dim", s.text) : theme.fg("muted", s.text);
					text += `\n  ${check} ${theme.fg("accent", `#${s.id}`)} ${stepText}`;
				}
			}

			if (!expanded && plan.steps.length > 0) {
				text = appendExpandHint(theme, text);
			}

			return new Text(text, 0, 0);
		},
	});

	// Register /plan command
	pi.registerCommand("plan", {
		description: "Plan manager: /plan [on|off] or /plan to open manager",
		getArgumentCompletions: (prefix: string) => {
			const commands = [
				{ value: "on", label: "on", description: "Enter planning mode (read-only)" },
				{ value: "off", label: "off", description: "Exit planning mode" },
			];
			const plans = listPlansSync(getPlansDir(process.cwd()));
			const planItems = plans.map((p) => ({
				value: p.title || formatPlanId(p.id),
				label: `${formatPlanId(p.id)} ${p.title || "(untitled)"}`,
				description: `${p.status} - ${p.steps.filter((s) => s.done).length}/${p.steps.length} steps`,
			}));
			const all = [...commands, ...planItems];
			const filtered = all.filter((i) => i.value.toLowerCase().includes(prefix.toLowerCase()));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const plansDir = getPlansDir(ctx.cwd);
			const trimmedArgs = (args ?? "").trim().toLowerCase();

			// Handle on/off
			if (trimmedArgs === "on") {
				if (!planningModeEnabled) togglePlanningMode(ctx);
				return;
			}
			if (trimmedArgs === "off") {
				if (planningModeEnabled) togglePlanningMode(ctx);
				return;
			}

			// Open plan manager
			const plans = await listPlans(plansDir);
			const currentSessionId = ctx.sessionManager.getSessionId();

			if (!ctx.hasUI) {
				if (plans.length === 0) {
					console.log("No plans. Ask the agent to create one.");
				} else {
					for (const p of plans) {
						const done = p.steps.filter((s) => s.done).length;
						console.log(`${formatPlanId(p.id)} ${p.title || "(untitled)"} [${p.status}] ${done}/${p.steps.length}`);
					}
				}
				return;
			}

			let nextPrompt: string | null = null;
			let rootTui: TUI | null = null;

			await ctx.ui.custom<void>((tui, theme, _kb, done) => {
				rootTui = tui;
				let selector: PlanSelectorComponent | null = null;
				let actionMenu: PlanActionMenuComponent | null = null;
				let activeComponent: {
					render: (width: number) => string[];
					invalidate: () => void;
					handleInput?: (data: string) => void;
					focused?: boolean;
				} | null = null;
				let wrapperFocused = false;

				const setActiveComponent = (component: typeof activeComponent) => {
					if (activeComponent && "focused" in activeComponent) activeComponent.focused = false;
					activeComponent = component;
					if (activeComponent && "focused" in activeComponent) activeComponent.focused = wrapperFocused;
					tui.requestRender();
				};

				const resolvePlanRecord = async (plan: PlanFrontMatter): Promise<PlanRecord | null> => {
					const filePath = getPlanPath(plansDir, plan.id);
					try {
						return await readPlanFile(filePath, plan.id);
					} catch {
						ctx.ui.notify(`Plan ${formatPlanId(plan.id)} not found`, "error");
						return null;
					}
				};

				const openPlanOverlay = async (record: PlanRecord): Promise<"back" | "execute"> => {
					return await ctx.ui.custom<"back" | "execute">(
						(overlayTui, overlayTheme, _overlayKb, overlayDone) =>
							new PlanDetailOverlayComponent(overlayTui, overlayTheme, record, overlayDone),
						{ overlay: true, overlayOptions: { width: "80%", maxHeight: "80%", anchor: "center" } },
					) ?? "back";
				};

				const applyPlanAction = async (record: PlanRecord, action: string): Promise<"stay" | "exit"> => {
					if (action === "execute") {
						// Claim and activate
						const sessionId = ctx.sessionManager.getSessionId();
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.assigned_to_session = sessionId;
							existing.status = "active";
							await writePlanFile(filePath, existing);
						});
						planningModeEnabled = false;
						activePlanId = record.id;
						pi.setActiveTools(NORMAL_MODE_TOOLS);
						updateWidget(ctx);
						updateStatus(ctx);
						const remaining = record.steps.filter((s) => !s.done);
						nextPrompt = remaining.length > 0
							? `Execute plan ${formatPlanId(record.id)} "${record.title}". Start with step: ${remaining[0].text}`
							: `Plan ${formatPlanId(record.id)} complete! Mark it as completed.`;
						done();
						return "exit";
					}
					if (action === "edit") {
						nextPrompt = `Edit plan ${formatPlanId(record.id)} "${record.title}": `;
						done();
						return "exit";
					}
					if (action === "view") {
						const overlayAction = await openPlanOverlay(record);
						if (overlayAction === "execute") {
							return applyPlanAction(record, "execute");
						}
						return "stay";
					}
					if (action === "complete") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.status = "completed";
							existing.assigned_to_session = undefined;
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Completed plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					if (action === "reopen") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.status = "draft";
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Reopened plan ${formatPlanId(record.id)}`, "info");
						return "stay";
					}
					if (action === "release") {
						const filePath = getPlanPath(plansDir, record.id);
						await withPlanLock(plansDir, record.id, ctx, async () => {
							const existing = await readPlanFile(filePath, record.id);
							existing.assigned_to_session = undefined;
							await writePlanFile(filePath, existing);
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Released plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					if (action === "delete") {
						const confirm = await ctx.ui.confirm("Delete plan?", `Delete ${formatPlanId(record.id)} "${record.title}"?`);
						if (!confirm) return "stay";
						await withPlanLock(plansDir, record.id, ctx, async () => {
							await fs.unlink(getPlanPath(plansDir, record.id));
						});
						const updated = await listPlans(plansDir);
						selector?.setPlans(updated);
						ctx.ui.notify(`Deleted plan ${formatPlanId(record.id)}`, "info");
						if (activePlanId === record.id) {
							activePlanId = null;
							updateWidget(ctx);
							updateStatus(ctx);
						}
						return "stay";
					}
					return "stay";
				};

				const showActionMenu = async (plan: PlanFrontMatter | PlanRecord) => {
					const record = "body" in plan ? plan : await resolvePlanRecord(plan);
					if (!record) return;
					actionMenu = new PlanActionMenuComponent(
						theme,
						record,
						(action) => {
							void (async () => {
								const result = await applyPlanAction(record, action);
								if (result === "stay") setActiveComponent(selector);
							})();
						},
						() => setActiveComponent(selector),
					);
					setActiveComponent(actionMenu);
				};

				selector = new PlanSelectorComponent(
					tui, theme, plans,
					(plan) => { void showActionMenu(plan); },
					() => done(),
					trimmedArgs || undefined,
					currentSessionId,
					(plan, action) => {
						void (async () => {
							const record = await resolvePlanRecord(plan);
							if (!record) return;
							await applyPlanAction(record, action);
						})();
					},
				);

				setActiveComponent(selector);

				return {
					get focused() { return wrapperFocused; },
					set focused(value: boolean) {
						wrapperFocused = value;
						if (activeComponent && "focused" in activeComponent) activeComponent.focused = value;
					},
					render(width: number) { return activeComponent ? activeComponent.render(width) : []; },
					invalidate() { activeComponent?.invalidate(); },
					handleInput(data: string) { activeComponent?.handleInput?.(data); },
				};
			});

			if (nextPrompt) {
				ctx.ui.setEditorText(nextPrompt);
				rootTui?.requestRender();
			}
		},
	});

	// Register Ctrl+X shortcut for planning mode toggle
	pi.registerShortcut("ctrl+shift+x", {
		description: "Toggle planning mode",
		handler: async (ctx) => {
			togglePlanningMode(ctx);
		},
	});

	// Initialize on session start
	pi.on("session_start", async (_event, ctx) => {
		const plansDir = getPlansDir(ctx.cwd);
		await ensurePlansDir(plansDir);
		const settings = await readPlanSettings(plansDir);
		await garbageCollectPlans(plansDir, settings);

		// Check CLI flag
		if (pi.getFlag("plan") === true) {
			planningModeEnabled = true;
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}

		updateStatus(ctx);
		updateWidget(ctx);
	});

	// Restore on session switch
	pi.on("session_switch", async (_event, ctx) => {
		updateStatus(ctx);
		updateWidget(ctx);
	});
}
