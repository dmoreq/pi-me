/**
 * Task Orchestration v2: Notification Inbox Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NotificationInbox } from '../../src/ui/notification-inbox';
import { createTask } from '../../src/core/task';
import type { TaskStatus } from '../../src/types';

describe('NotificationInbox', () => {
  let inbox: NotificationInbox;

  beforeEach(() => {
    inbox = new NotificationInbox(5000, 10000);
  });

  it('should show errors', async () => {
    const tasks = [createTask({ id: '1', text: 'Test', status: 'failed' as TaskStatus })];
    await inbox.update(tasks);
    expect(inbox.hasNotifications()).toBe(true);
    const active = inbox.getActive();
    expect(active[0].type).toBe('error');
  });

  it('should hide pending tasks', async () => {
    const tasks = [createTask({ id: '1', text: 'Test', status: 'pending' as TaskStatus })];
    await inbox.update(tasks);
    expect(inbox.hasNotifications()).toBe(false);
  });

  it('should show long-running tasks', async () => {
    const startedAt = new Date(Date.now() - 15000).toISOString();
    const tasks = [createTask({
      id: '1',
      text: 'Test',
      status: 'in_progress' as TaskStatus,
      startedAt,
    })];
    await inbox.update(tasks);
    expect(inbox.hasNotifications()).toBe(true);
    expect(inbox.getActive()[0].type).toBe('progress');
  });

  it('should hide short-running tasks', async () => {
    const startedAt = new Date(Date.now() - 5000).toISOString();
    const tasks = [createTask({
      id: '1',
      text: 'Test',
      status: 'in_progress' as TaskStatus,
      startedAt,
    })];
    await inbox.update(tasks);
    expect(inbox.hasNotifications()).toBe(false);
  });

  it('should dismiss notifications', () => {
    const tasks = [createTask({ id: '1', text: 'Test', status: 'failed' as TaskStatus })];
    inbox.update(tasks);
    inbox.dismiss('1');
    expect(inbox.hasNotifications()).toBe(false);
  });

  it('should clear all notifications', () => {
    const tasks = [
      createTask({ id: '1', text: 'A', status: 'failed' as TaskStatus }),
      createTask({ id: '2', text: 'B', status: 'failed' as TaskStatus }),
    ];
    inbox.update(tasks);
    inbox.clear();
    expect(inbox.hasNotifications()).toBe(false);
  });
});
