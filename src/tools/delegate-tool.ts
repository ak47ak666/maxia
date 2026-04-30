/**
 * 委托任务工具 - 将复杂任务委托给子代理执行
 */

import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult, ToolParameter } from '../types.js';
import { SubAgent } from '../core/agent/sub-agent.js';
import { globalToolRegistry } from '../core/tool-registry/registry.js';

const delegateTaskParams: ToolParameter[] = [
  {
    name: 'goal',
    description: '子代理的任务目标',
    type: 'string',
    required: true,
  },
  {
    name: 'task_id',
    description: '任务唯一标识符，用于区分不同的子任务',
    type: 'string',
    required: true,
  },
  {
    name: 'timeout',
    description: '超时时间(毫秒)，默认120000ms',
    type: 'number',
    required: false,
  },
];

const delegateTasksParallelParams: ToolParameter[] = [
  {
    name: 'tasks',
    description: '任务数组，每个任务包含goal和task_id',
    type: 'array',
    required: true,
  },
  {
    name: 'max_concurrent',
    description: '最大并行数，默认5',
    type: 'number',
    required: false,
  },
];

export class DelegateTaskTool extends BaseTool {
  definition = {
    name: 'delegate_task',
    description: '将复杂任务委托给子代理并行执行。当需要同时分析多个独立模块、处理多个子任务时使用。每个子代理独立运行，最后汇总结果。适用于：1)分析多个文件或目录 2)并行执行多个独立任务 3)复杂任务分解',
    parameters: delegateTaskParams,
    category: 'agent',
  };

  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const { goal, task_id, timeout = 120000 } = args as {
      goal: string;
      task_id: string;
      timeout?: number;
    };

    if (!goal || !task_id) {
      return this.createErrorResult('缺少必要参数: goal 和 task_id');
    }

    try {
      // 获取主Agent的配置（通过metadata传递）
      const config = context.metadata?.subAgentConfig as any;

      if (!config) {
        return this.createErrorResult('子代理配置未找到');
      }

      // 创建并运行子代理
      const subAgent = new SubAgent({
        goal,
        parentSessionId: context.sessionId,
        model: config.model,
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        tools: globalToolRegistry.getAllTools(),
        maxIterations: 30,
        timeout: Math.min(timeout, 180000),
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: `你是一个专门的子任务执行助手。你的任务目标是: ${goal}

请专注于完成这个任务，使用可用的工具来执行操作。完成任务后，直接返回结果，包含关键信息和发现。`,
      });

      const result = await subAgent.run();

      if (result.success) {
        return this.createSuccessResult({
          task_id,
          success: true,
          result: result.result,
          iterations: result.iterations,
        });
      } else {
        return this.createSuccessResult({
          task_id,
          success: false,
          error: result.error,
          iterations: result.iterations,
        });
      }
    } catch (error) {
      return this.createErrorResult(`委托任务失败: ${(error as Error).message}`);
    }
  }
}

/**
 * 并行委托多个任务
 */
export class DelegateTasksParallelTool extends BaseTool {
  definition = {
    name: 'delegate_tasks_parallel',
    description: '并行委托多个独立任务给子代理。所有子任务同时执行，比串行委托快得多。适用于：1)同时分析多个文件 2)并行处理多个独立模块 3)批量执行',
    parameters: delegateTasksParallelParams,
    category: 'agent',
  };

  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const { tasks, max_concurrent = 5 } = args as {
      tasks: Array<{ goal: string; task_id: string }>;
      max_concurrent?: number;
    };

    if (!tasks || tasks.length === 0) {
      return this.createErrorResult('缺少任务列表');
    }

    const config = context.metadata?.subAgentConfig as any;

    if (!config) {
      return this.createErrorResult('子代理配置未找到');
    }

    try {
      // 控制并发数
      const results: any[] = [];
      const executing: Promise<void>[] = [];
      let taskIndex = 0;

      const runTask = async (task: { goal: string; task_id: string }): Promise<void> => {
        const subAgent = new SubAgent({
          goal: task.goal,
          parentSessionId: context.sessionId,
          model: config.model,
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          tools: globalToolRegistry.getAllTools(),
          maxIterations: 30,
          timeout: 120000,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        });

        const result = await subAgent.run();
        results.push({
          task_id: task.task_id,
          success: result.success,
          result: result.result,
          error: result.error,
          iterations: result.iterations,
        });
      };

      // 启动并行任务
      while (taskIndex < tasks.length) {
        while (executing.length < max_concurrent && taskIndex < tasks.length) {
          const task = tasks[taskIndex++];
          const promise = runTask(task).then(() => {
            const idx = executing.indexOf(promise);
            if (idx >= 0) executing.splice(idx, 1);
          });
          executing.push(promise);
        }

        if (executing.length >= max_concurrent) {
          await Promise.race(executing);
        }
      }

      // 等待所有任务完成
      await Promise.all(executing);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return this.createSuccessResult({
        total: tasks.length,
        success: successCount,
        failed: failCount,
        results,
      });
    } catch (error) {
      return this.createErrorResult(`并行委托失败: ${(error as Error).message}`);
    }
  }
}

export default DelegateTaskTool;
