/**
 * Task Orchestration v2: Full Integration Flow Tests
 *
 * Tests the complete pipeline:
 * capture → resolve → execute → notify
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createExtension } from '../../src/index';
import { TaskStore } from '../../src/persistence/state';
import { NotificationInbox } from '../../src/ui/notification-inbox';
import { ProgressWidget } from '../../src/ui/progress-widget';
import type { ExtensionAPI } from '../../src/types';

describe('Full Integration Flow', () => {
  let mockPi: ExtensionAPI;
  let handlers: Record<string, Function[]>;
  let tools: Record<string, any>;

  beforeEach(() => {
    handlers = {};
    tools = {};
    mockPi = {
      on: jest.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      registerTool: jest.fn((name: string, config: any) => {
        tools[name] = config;
      }),
      exec: jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'Done' }),
      ui: {
        setNotification: jest.fn(),
        setWidget: jest.fn(),
      },
    };
  });

  it('should register hooks on creation', () => {
    createExtension(mockPi);
    expect(mockPi.on).toHaveBeenCalled();
    expect(mockPi.registerTool).toHaveBeenCalled();
  });

  it('should register task_control tool', () => {
    createExtension(mockPi);
    expect(tools.task_control).toBeDefined();
    expect(tools.task_control.description).toContain('Skip');
  });

  it('should capture tasks on agent_end', async () => {
    const store = new TaskStore();
    createExtension(mockPi, { store });

    const agentEndHandler = handlers['agent_end']?.[0];
    expect(agentEndHandler).toBeDefined();

    const mockEvent = {};
    const mockCtx = {
      messages: [{ role: 'user', content: 'Fix auth, refactor module' }],
      ui: mockPi.ui,
    };

    await agentEndHandler(mockEvent, mockCtx);

    const tasks = await store.getAll();
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('should track notifications', async () => {
    const inbox = new NotificationInbox();
    createExtension(mockPi, { inbox });

    // Simulate task updates
    await inbox.update([
      { id: '1', text: 'Failed task', status: 'failed' as any, createdAt: new Date().toISOString() },
    ]);

    expect(inbox.hasNotifications()).toBe(true);
  });

  it('should update progress widget', async () => {
    const widget = new ProgressWidget();
    createExtension(mockPi, { widget });

    widget.update([
      { id: '1', text: 'Done', status: 'completed' as any, createdAt: new Date().toISOString() },
      { id: '2', text: 'Pending', status: 'pending' as any, createdAt: new Date().toISOString() },
    ]);

    const progress = widget.getProgress();
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(2);
  });
});
