/**
 * workflow — persistent store.
 */

import { mkdir, readFile, writeFile, appendFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Workflow, WorkflowEvent, WorkflowJob, WorkflowSearch, WorkflowStep } from "./types.ts";

const WORKFLOW_DIR = ".pi/workflows";
const WORKFLOWS_FILE = "workflows.jsonl";
const JOBS_FILE = "jobs.jsonl";
const EVENTS_FILE = "events.jsonl";

export class WorkflowStore {
  constructor(private dir = WORKFLOW_DIR) {}
  async init(): Promise<void> { await mkdir(this.dir, { recursive: true }); }
  getDir(): string { return this.dir; }
  async list(): Promise<Workflow[]> { return this.readJsonl<Workflow>(join(this.dir, WORKFLOWS_FILE)); }
  async get(id: string): Promise<Workflow | null> { return (await this.list()).find(w => w.id === id) ?? null; }
  async save(workflow: Workflow): Promise<void> { const all = await this.list(); await this.writeJsonl(join(this.dir, WORKFLOWS_FILE), all.filter(w => w.id !== workflow.id).concat(workflow)); }
  async delete(id: string): Promise<boolean> { const all = await this.list(); const next = all.filter(w => w.id !== id); const changed = next.length !== all.length; await this.writeJsonl(join(this.dir, WORKFLOWS_FILE), next); return changed; }
  async search(query: WorkflowSearch): Promise<Workflow[]> { let workflows = await this.list(); if (query.text) { const q = query.text.toLowerCase(); workflows = workflows.filter(w => [w.id, w.title, w.description ?? ""].join(" ").toLowerCase().includes(q)); } if (query.status) workflows = workflows.filter(w => w.status === query.status); if (query.priority) workflows = workflows.filter(w => w.priority === query.priority); if (query.source) workflows = workflows.filter(w => w.source === query.source); if (query.requiresReview !== undefined) workflows = workflows.filter(w => Boolean(w.requiresReview) === query.requiresReview); if (query.assignedToSession) workflows = workflows.filter(w => w.assignedToSession === query.assignedToSession); if (query.intent) workflows = workflows.filter(w => w.intent === query.intent); return workflows; }
  async addStep(workflowId: string, step: WorkflowStep): Promise<Workflow> { const workflow = await this.mustGet(workflowId); workflow.steps.push(step); workflow.updatedAt = new Date().toISOString(); await this.save(workflow); return workflow; }
  async updateStep(workflowId: string, stepId: string, patch: Partial<WorkflowStep>): Promise<Workflow> { const workflow = await this.mustGet(workflowId); const step = workflow.steps.find(s => s.id === stepId); if (!step) throw new Error(`Step ${stepId} not found`); Object.assign(step, patch); workflow.updatedAt = new Date().toISOString(); await this.save(workflow); return workflow; }
  async listJobs(): Promise<WorkflowJob[]> { return this.readJsonl<WorkflowJob>(join(this.dir, JOBS_FILE)); }
  async getJob(id: string): Promise<WorkflowJob | null> { return (await this.listJobs()).find(j => j.id === id) ?? null; }
  async saveJob(job: WorkflowJob): Promise<void> { const all = await this.listJobs(); await this.writeJsonl(join(this.dir, JOBS_FILE), all.filter(j => j.id !== job.id).concat(job)); }
  async appendEvent(event: WorkflowEvent): Promise<void> { await appendFile(join(this.dir, EVENTS_FILE), `${JSON.stringify(event)}\n`, "utf8"); }
  async clearAll(): Promise<void> { for (const file of [WORKFLOWS_FILE, JOBS_FILE, EVENTS_FILE]) { try { await unlink(join(this.dir, file)); } catch {} } }
  private async mustGet(id: string): Promise<Workflow> { const workflow = await this.get(id); if (!workflow) throw new Error(`Workflow ${id} not found`); return workflow; }
  private async readJsonl<T>(path: string): Promise<T[]> { try { const raw = await readFile(path, "utf8"); return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as T); } catch { return []; } }
  private async writeJsonl(path: string, rows: unknown[]): Promise<void> { const content = rows.map(row => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""); await writeFile(path, content, "utf8"); }
}
