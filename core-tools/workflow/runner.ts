/**
 * workflow — runner.
 */

import type { Workflow } from "./types.ts";
import { WorkflowExecutor } from "./executor.ts";
import { WorkflowStore } from "./store.ts";

export class WorkflowRunner {
  constructor(private store: WorkflowStore, private executor: WorkflowExecutor, private piCommand = "pi") {}

  async runWorkflow(id: string): Promise<Workflow> {
    const workflow = await this.mustGet(id);
    workflow.status = "active";
    workflow.updatedAt = new Date().toISOString();
    await this.store.save(workflow);
    for (const step of workflow.steps) {
      if (step.status === "completed" || step.status === "skipped") continue;
      await this.runStep(id, step.id);
      const updated = await this.mustGet(id);
      if (updated.status === "failed") return updated;
    }
    const final = await this.mustGet(id);
    if (final.steps.every(s => s.status === "completed" || s.status === "skipped")) {
      final.status = "completed";
      final.completedAt = new Date().toISOString();
      final.updatedAt = new Date().toISOString();
      await this.store.save(final);
    }
    return final;
  }

  async runStep(workflowId: string, stepId: string): Promise<Workflow> {
    const workflow = await this.mustGet(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);

    step.status = "in_progress";
    step.startedAt = new Date().toISOString();
    workflow.status = workflow.status === "draft" ? "active" : workflow.status;
    workflow.currentStepId = step.id;
    workflow.updatedAt = new Date().toISOString();
    await this.store.save(workflow);

    if (step.executor === "manual" || step.executor === "none") {
      await this.store.save(workflow);
      return workflow;
    }

    try {
      const result = step.executor === "pi"
        ? await this.executor.runCommand({ id: `${workflowId}:${stepId}`, label: step.text, cmd: this.piCommand, args: ["--prompt", step.command ?? step.text], cwd: step.cwd, env: step.env, timeout: step.timeout, critical: step.critical })
        : await this.executor.runCommand({ id: `${workflowId}:${stepId}`, label: step.text, cmd: step.command ?? "", args: step.args, cwd: step.cwd, env: step.env, timeout: step.timeout, critical: step.critical });

      step.stdout = result.stdout;
      step.stderr = result.stderr;
      step.completedAt = new Date().toISOString();
      step.status = result.exitCode === 0 ? "completed" : "failed";
      if (result.exitCode !== 0) step.error = `exit ${result.exitCode}`;
      if (step.status === "failed" && step.critical) workflow.status = "failed";
      workflow.updatedAt = new Date().toISOString();
      await this.store.save(workflow);
    } catch (err) {
      step.status = "failed";
      step.error = err instanceof Error ? err.message : String(err);
      step.completedAt = new Date().toISOString();
      workflow.status = step.critical ? "failed" : workflow.status;
      workflow.updatedAt = new Date().toISOString();
      await this.store.save(workflow);
    }

    if (workflow.steps.every(s => s.status === "completed" || s.status === "skipped")) {
      workflow.status = "completed";
      workflow.completedAt = new Date().toISOString();
      workflow.updatedAt = new Date().toISOString();
      await this.store.save(workflow);
    }
    return workflow;
  }

  async retryStep(workflowId: string, stepId: string): Promise<Workflow> {
    const workflow = await this.mustGet(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    step.status = "pending";
    step.error = undefined;
    step.stdout = undefined;
    step.stderr = undefined;
    step.completedAt = undefined;
    return this.runStep(workflowId, stepId);
  }

  async skipStep(workflowId: string, stepId: string): Promise<Workflow> {
    const workflow = await this.mustGet(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    step.status = "skipped";
    step.completedAt = new Date().toISOString();
    workflow.updatedAt = new Date().toISOString();
    await this.store.save(workflow);
    return workflow;
  }

  async completeStep(workflowId: string, stepId: string): Promise<Workflow> {
    const workflow = await this.mustGet(workflowId);
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    workflow.updatedAt = new Date().toISOString();
    await this.store.save(workflow);
    return workflow;
  }

  private async mustGet(id: string): Promise<Workflow> {
    const workflow = await this.store.get(id);
    if (!workflow) throw new Error(`Workflow ${id} not found`);
    return workflow;
  }
}
