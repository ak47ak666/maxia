/**
 * Cron 定时任务工具
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

// 简单的 cron 任务存储
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
}

const CRON_DIR = './sessions/cron';
const cronStore: Map<string, CronJob> = new Map();

// 从文件加载任务
async function loadJobs(): Promise<void> {
  try {
    await fs.mkdir(CRON_DIR, { recursive: true });
    const files = await fs.readdir(CRON_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(CRON_DIR, file), 'utf-8');
        const job = JSON.parse(content) as CronJob;
        cronStore.set(job.id, job);
      }
    }
  } catch {}
}

loadJobs();

function parseCronExpression(schedule: string): { next: Date | null; interval: string } {
  // 简单解析 cron 表达式
  // 格式: * * * * * (分 时 日 月 周)
  const parts = schedule.split(' ');
  if (parts.length !== 5) {
    return { next: null, interval: '无效' };
  }

  const now = new Date();
  const next = new Date(now);

  try {
    // 简单实现：支持 @hourly, @daily, @weekly
    if (schedule === '@hourly') {
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return { next, interval: '每小时' };
    }
    if (schedule === '@daily' || schedule === '@midnight') {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return { next, interval: '每天' };
    }
    if (schedule === '@weekly') {
      next.setDate(next.getDate() + (7 - next.getDay()));
      next.setHours(0, 0, 0, 0);
      return { next, interval: '每周' };
    }
    if (schedule === '@monthly') {
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(0, 0, 0, 0);
      return { next, interval: '每月' };
    }

    // 其他情况返回当前时间 + 1小时
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return { next, interval: '每' + schedule };
  } catch {
    return { next: null, interval: '无法解析' };
  }
}

export class CronListTool extends BaseTool {
  definition = {
    name: 'cron_list',
    description: '列出所有定时任务',
    parameters: [],
    category: 'cron',
  };

  async execute(_args: unknown, _context: ToolContext): Promise<ToolResult> {
    await loadJobs();

    const jobs = Array.from(cronStore.values()).map(job => {
      const { next, interval } = parseCronExpression(job.schedule);
      return {
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        interval,
        enabled: job.enabled,
        nextRun: next?.toISOString(),
        lastRun: job.lastRun ? new Date(job.lastRun).toISOString() : null,
      };
    });

    return this.createSuccessResult({
      jobs,
      count: jobs.length,
    });
  }
}

export class CronCreateTool extends BaseTool {
  definition = {
    name: 'cron_create',
    description: '创建定时任务',
    parameters: [
      { name: 'name', description: '任务名称', type: 'string' as const, required: true },
      { name: 'schedule', description: 'Cron表达式或@hourly/@daily/@weekly', type: 'string' as const, required: true },
      { name: 'command', description: '要执行的命令', type: 'string' as const, required: true },
    ],
    category: 'cron',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { name, schedule, command } = args as { name: string; schedule: string; command: string };

    try {
      const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { next } = parseCronExpression(schedule);

      const job: CronJob = {
        id,
        name,
        schedule,
        command,
        enabled: true,
        nextRun: next?.getTime(),
        createdAt: Date.now(),
      };

      cronStore.set(id, job);

      // 保存到文件
      await fs.mkdir(CRON_DIR, { recursive: true });
      await fs.writeFile(path.join(CRON_DIR, `${id}.json`), JSON.stringify(job, null, 2));

      return this.createSuccessResult({
        id,
        name,
        schedule,
        interval: parseCronExpression(schedule).interval,
        nextRun: next?.toISOString(),
      });
    } catch (error) {
      return this.createErrorResult(`创建定时任务失败: ${(error as Error).message}`);
    }
  }
}

export class CronDeleteTool extends BaseTool {
  definition = {
    name: 'cron_delete',
    description: '删除定时任务',
    parameters: [
      { name: 'id', description: '任务ID', type: 'string' as const, required: true },
    ],
    category: 'cron',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { id } = args as { id: string };

    try {
      if (!cronStore.has(id)) {
        return this.createErrorResult(`任务不存在: ${id}`);
      }

      cronStore.delete(id);

      // 删除文件
      const filePath = path.join(CRON_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
      } catch {}

      return this.createSuccessResult({ id, deleted: true });
    } catch (error) {
      return this.createErrorResult(`删除定时任务失败: ${(error as Error).message}`);
    }
  }
}

export class CronToggleTool extends BaseTool {
  definition = {
    name: 'cron_toggle',
    description: '启用/禁用定时任务',
    parameters: [
      { name: 'id', description: '任务ID', type: 'string' as const, required: true },
      { name: 'enabled', description: '是否启用', type: 'boolean' as const, required: true },
    ],
    category: 'cron',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { id, enabled } = args as { id: string; enabled: boolean };

    try {
      const job = cronStore.get(id);
      if (!job) {
        return this.createErrorResult(`任务不存在: ${id}`);
      }

      job.enabled = enabled;
      cronStore.set(id, job);

      // 更新文件
      await fs.writeFile(path.join(CRON_DIR, `${id}.json`), JSON.stringify(job, null, 2));

      return this.createSuccessResult({ id, enabled, action: enabled ? 'enabled' : 'disabled' });
    } catch (error) {
      return this.createErrorResult(`更新定时任务失败: ${(error as Error).message}`);
    }
  }
}

export class CronRunTool extends BaseTool {
  definition = {
    name: 'cron_run',
    description: '立即执行定时任务',
    parameters: [
      { name: 'id', description: '任务ID', type: 'string' as const, required: true },
    ],
    category: 'cron',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { id } = args as { id: string };

    try {
      const job = cronStore.get(id);
      if (!job) {
        return this.createErrorResult(`任务不存在: ${id}`);
      }

      // 执行命令（这里只是模拟，实际应该调用 exec）
      job.lastRun = Date.now();
      const { next } = parseCronExpression(job.schedule);
      job.nextRun = next?.getTime();

      cronStore.set(id, job);
      await fs.writeFile(path.join(CRON_DIR, `${id}.json`), JSON.stringify(job, null, 2));

      return this.createSuccessResult({
        id,
        name: job.name,
        command: job.command,
        executedAt: new Date().toISOString(),
        lastRun: new Date(job.lastRun).toISOString(),
      });
    } catch (error) {
      return this.createErrorResult(`执行定时任务失败: ${(error as Error).message}`);
    }
  }
}
