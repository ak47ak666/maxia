/**
 * TaskManager - 统一的任务状态管理
 */

export type TaskStatus = 'pending' | 'running' | 'verifying' | 'completed' | 'failed';

export interface Task {
  id: string;
  status: TaskStatus;
  goal: string;
  workspace: string;
  logs: string[];
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export class TaskManager {
  private tasks = new Map<string, Task>();

  create(task: Task): void {
    this.tasks.set(task.id, task);
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  update(id: string, patch: Partial<Task>): void {
    const task = this.tasks.get(id);
    if (!task) return;
    Object.assign(task, patch);
    task.updatedAt = Date.now();
  }

  delete(id: string): void {
    this.tasks.delete(id);
  }

  list(): Task[] {
    return Array.from(this.tasks.values());
  }
}

export const taskManager = new TaskManager();
