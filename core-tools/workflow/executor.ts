/**
 * workflow — subprocess executor.
 */

import { spawn } from "node:child_process";
import type { CommandResult, CommandTask, WorkflowJob } from "./types.ts";

export class WorkflowExecutor {
  private jobs = new Map<string, WorkflowJob>();
  private procs = new Map<string, ReturnType<typeof spawn>>();
  private jobCounter = 0;

  async runCommand(task: CommandTask): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const child = spawn(task.cmd, task.args ?? [], {
        cwd: task.cwd,
        env: { ...process.env, ...(task.env ?? {}) },
        shell: false,
      });

      let stdout = "";
      let stderr = "";
      let timer: NodeJS.Timeout | undefined;

      if (task.timeout) {
        timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`timeout after ${task.timeout}ms`));
        }, task.timeout);
      }

      child.stdout?.on("data", chunk => { stdout += chunk.toString(); });
      child.stderr?.on("data", chunk => { stderr += chunk.toString(); });
      child.on("error", err => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
      child.on("close", code => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr, duration: Date.now() - start });
      });
    });
  }

  async runBackground(task: CommandTask): Promise<WorkflowJob> {
    const id = `job-${++this.jobCounter}-${Date.now()}`;
    const job: WorkflowJob = {
      id,
      label: task.label,
      command: task.cmd,
      args: task.args,
      cwd: task.cwd,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);

    const child = spawn(task.cmd, task.args ?? [], {
      cwd: task.cwd,
      env: { ...process.env, ...(task.env ?? {}) },
      shell: false,
    });
    this.procs.set(id, child);
    job.status = "running";
    job.startedAt = new Date().toISOString();

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr?.on("data", chunk => { stderr += chunk.toString(); });

    child.on("close", code => {
      job.completedAt = new Date().toISOString();
      job.exitCode = code ?? 1;
      job.stdout = stdout;
      job.stderr = stderr;
      job.duration = job.startedAt ? Date.now() - Date.parse(job.startedAt) : undefined;
      job.status = code === 0 ? "completed" : "failed";
      this.procs.delete(id);
    });

    child.on("error", err => {
      job.completedAt = new Date().toISOString();
      job.stderr = err.message;
      job.status = "failed";
      this.procs.delete(id);
    });

    return job;
  }

  getJob(id: string): WorkflowJob | null {
    return this.jobs.get(id) ?? null;
  }

  listJobs(): WorkflowJob[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(id: string): boolean {
    const proc = this.procs.get(id);
    if (!proc) return false;
    proc.kill("SIGTERM");
    const job = this.jobs.get(id);
    if (job) job.status = "cancelled";
    this.procs.delete(id);
    return true;
  }
}
