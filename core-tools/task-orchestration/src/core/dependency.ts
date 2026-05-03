/**
 * Task Orchestration v2: Dependency Resolution
 */

import { TaskDAG } from './task';
import type { Task } from '../types';

export class DependencyResolver {
  build(tasks: Task[]): TaskDAG {
    const taskIds = new Set(tasks.map(t => t.id));
    for (const task of tasks) {
      const blockedBy = task.blockedBy || [];
      for (const depId of blockedBy) {
        if (!taskIds.has(depId)) {
          console.warn(`Missing dependency: ${task.id} blocked by ${depId}`);
        }
      }
    }

    const enriched = this.mergeAllDependencies(tasks);
    const dag = new TaskDAG(enriched);

    try {
      dag.hasCycle();
    } catch (e) {
      throw new Error(`Cannot resolve dependencies: ${(e as Error).message}`);
    }

    return dag;
  }

  private mergeAllDependencies(tasks: Task[]): Task[] {
    const enriched = tasks.map(t => ({ ...t }));

    for (const task of enriched) {
      if (!task.blockedBy) {
        task.blockedBy = [];
      }

      // Topic-based dependencies
      if (task.topic) {
        const sameTopicTasks = enriched.filter(
          t => t.topic === task.topic && t.id !== task.id
        );

        sameTopicTasks.sort((a, b) => {
          const orderA = a.sequenceOrder ?? Number.MAX_VALUE;
          const orderB = b.sequenceOrder ?? Number.MAX_VALUE;
          if (orderA !== orderB) return orderA - orderB;
          return tasks.indexOf(a) - tasks.indexOf(b);
        });

        const taskIdx = sameTopicTasks.findIndex(t => t.id === task.id);
        if (taskIdx > 0) {
          const prevInTopic = sameTopicTasks[taskIdx - 1];
          if (prevInTopic && !task.blockedBy.includes(prevInTopic.id)) {
            task.blockedBy.push(prevInTopic.id);
          }
        }
      }

      // Explicit sequenceOrder
      if (task.sequenceOrder !== undefined) {
        const taskOrder = task.sequenceOrder;
        const sameOrLower = enriched.filter(
          t =>
            t.sequenceOrder !== undefined &&
            t.sequenceOrder < taskOrder &&
            t.id !== task.id
        );

        if (sameOrLower.length > 0) {
          const maxLower = sameOrLower.reduce((a, b) => {
            const aOrder = a.sequenceOrder ?? 0;
            const bOrder = b.sequenceOrder ?? 0;
            return aOrder > bOrder ? a : b;
          });
          if (maxLower && !task.blockedBy.includes(maxLower.id)) {
            task.blockedBy.push(maxLower.id);
          }
        }
      }

      task.blockedBy = [...new Set(task.blockedBy)];
    }

    return enriched;
  }

  inferFromCodeReferences(taskText: string, existingTasks: Task[]): string[] {
    const deps: string[] = [];
    const refs = taskText.match(/\b[\w]+\.(ts|tsx|js|jsx|py|rb|go)\b/g) || [];

    for (const ref of refs) {
      const matching = existingTasks.filter(
        t =>
          t.text.includes(ref) ||
          t.text.toLowerCase().includes(ref.split('.')[0])
      );

      for (const match of matching) {
        if (!deps.includes(match.id)) {
          deps.push(match.id);
        }
      }
    }

    return deps;
  }

  inferSequential(
    segment: string,
    previousTasks: Task[]
  ): string | undefined {
    if (/(then|after|once|subsequently)\s+/i.test(segment)) {
      if (previousTasks.length > 0) {
        return previousTasks[previousTasks.length - 1].id;
      }
    }

    return undefined;
  }
}
