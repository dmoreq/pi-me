import { TaskCapture } from './core/capture';
import { DependencyResolver } from './core/dependency';
import { TaskExecutor } from './core/executor';
import { TaskStore, EventLog } from './persistence/state';
import { NotificationInbox } from './ui/notification-inbox';
import { ProgressWidget } from './ui/progress-widget';
import { RegexIntentClassifier } from './inference/intent';
import type { ExtensionAPI, Task, Message } from './types';

export interface ExtensionConfig {
  capture?: TaskCapture;
  resolver?: DependencyResolver;
  store?: TaskStore;
  eventLog?: EventLog;
  executor?: TaskExecutor;
  inbox?: NotificationInbox;
  widget?: ProgressWidget;
}

export function createExtension(pi: ExtensionAPI, config?: ExtensionConfig) {
  const store = config?.store || new TaskStore();
  const eventLog = config?.eventLog || new EventLog();
  const classifier = new RegexIntentClassifier();
  const capture = config?.capture || new TaskCapture(classifier);
  const resolver = config?.resolver || new DependencyResolver();
  const executor = config?.executor || new TaskExecutor(store, pi);
  const inbox = config?.inbox || new NotificationInbox();
  const widget = config?.widget || new ProgressWidget();

  // Capture tasks from conversation
  pi.on('agent_end', async (_event: any, ctx: any) => {
    const messages: Message[] = ctx?.messages || [];
    if (messages.length === 0) return;

    const result = capture.infer(messages);
    if (result.tasks.length === 0) return;

    for (const task of result.tasks) {
      await store.save(task);
      await eventLog.append({
        type: 'created',
        taskId: task.id,
        task,
        timestamp: new Date().toISOString(),
      });
    }

    const allTasks = await store.getAll();
    const dag = resolver.build(allTasks);

    executor.dispatch(dag).catch((err: Error) => {
      console.error('Task execution failed:', err.message);
    });

    if (ctx?.ui) {
      ctx.ui.setNotification('task_inbox', {
        content: `Queued ${result.tasks.length} tasks`,
        autoClose: 2000,
      });
    }
  });

  // Inject context about active tasks
  pi.on('before_agent_start', async (_event: any, ctx: any) => {
    const activeTasks = await store.getRunning();
    const pending = await store.getPending();
    if (activeTasks.length === 0 && pending.length === 0) return;

    const runningText = activeTasks.map(t => `  - ${t.text}`).join('\n');
    const pendingText = pending.map(t => `  - ${t.text}`).join('\n');
    const taskInfo = `\n### Active Tasks\nRunning:\n${runningText || '  (none)'}\n\nPending:\n${pendingText || '  (none)'}`;

    return { systemPrompt: (ctx?.systemPrompt || '') + taskInfo };
  });

  // Stream updates through UI
  executor.on('task_update', async (task: Task) => {
    await store.save(task);
    const allTasks = await store.getAll();
    await inbox.update(allTasks);
    widget.update(allTasks);
  });

  // Progress widget on session start
  pi.on('session_start', async (_event: any, ctx: any) => {
    if (!ctx?.hasUI) return;

    const updateWidget = async () => {
      const allTasks = await store.getAll();
      widget.update(allTasks);
      ctx.ui.setWidget('task_progress', { content: widget.renderFull() });
    };

    await updateWidget();
    executor.on('task_update', updateWidget);
  });

  // task_control tool
  pi.registerTool('task_control', {
    description: 'Skip, retry, or prioritize a task',
    parameters: {
      type: 'object',
      required: ['taskId', 'action'],
      properties: {
        taskId: { type: 'string' },
        action: { type: 'string', enum: ['skip', 'retry', 'prioritize'] },
      },
    },
    async execute(_id: any, params: any) {
      const task = await store.get(params.taskId);
      if (!task) return { error: `Task ${params.taskId} not found` };

      switch (params.action) {
        case 'skip':
          task.status = 'skipped' as Task['status'];
          await store.save(task);
          return { ok: true, status: 'skipped' };

        case 'retry':
          task.status = 'pending' as Task['status'];
          task.result = undefined;
          task.completedAt = undefined;
          await store.save(task);
          return { ok: true, status: 'retried' };

        case 'prioritize':
          await executor.prioritize(params.taskId);
          return { ok: true, status: 'prioritized' };

        default:
          return { error: `Unknown action: ${params.action}` };
      }
    },
  });

  // Cleanup on session end
  pi.on('session_shutdown', async () => {
    const pendingTaskCount = (await store.getPending()).length;
    const runningTaskCount = (await store.getRunning()).length;
    if (pendingTaskCount > 0 || runningTaskCount > 0) {
      console.warn(
        `Session ended with ${runningTaskCount} running, ${pendingTaskCount} pending tasks`
      );
    }
  });

  return { capture, resolver, store, eventLog, executor, inbox, widget };
}

export default createExtension;
