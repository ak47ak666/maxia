/**
 * 工具注册表 - 管理所有可用工具
 */

import type { Tool, ToolDefinition, ToolResult, ToolContext, ToolParameter } from '../../types.js';

// 工具注册表类
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private defaultTimeout: number = 30000; // 默认30秒超时

  // 注册工具
  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`工具已注册: ${tool.definition.name}`);
    }
    this.tools.set(tool.definition.name, tool);

    if (tool.definition.category) {
      if (!this.categories.has(tool.definition.category)) {
        this.categories.set(tool.definition.category, new Set());
      }
      this.categories.get(tool.definition.category)!.add(tool.definition.name);
    }
  }

  // 注销工具
  unregister(name: string): void {
    const tool = this.tools.get(name);
    if (tool?.definition.category) {
      this.categories.get(tool.definition.category)?.delete(name);
    }
    this.tools.delete(name);
  }

  // 获取工具
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // 获取所有工具
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // 按分类获取工具
  getToolsByCategory(category: string): Tool[] {
    const names = this.categories.get(category) || new Set();
    return Array.from(names).map(name => this.tools.get(name)!).filter(Boolean);
  }

  // 获取所有分类
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  // 获取工具规范（用于LLM）
  getToolsSpec(): ToolDefinition[] {
    return this.getAllTools().map(tool => tool.definition);
  }

  // 执行工具（带超时控制）
  async execute(name: string, args: unknown, context: ToolContext, timeout?: number): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `未知工具: ${name}` };
    }

    const execTimeout = timeout || this.defaultTimeout;

    try {
      const result = await Promise.race([
        tool.execute(args, context),
        new Promise<ToolResult>((_, reject) =>
          setTimeout(() => reject(new Error(`工具执行超时 (${execTimeout}ms)`)), execTimeout)
        ),
      ]);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 设置默认超时
  setDefaultTimeout(ms: number): void {
    this.defaultTimeout = ms;
  }
}

// 基础工具类
export abstract class BaseTool implements Tool {
  abstract definition: ToolDefinition;

  abstract execute(args: unknown, context: ToolContext): Promise<ToolResult>;

  protected createSuccessResult(data: unknown): ToolResult {
    return { success: true, data };
  }

  protected createErrorResult(error: string): ToolResult {
    return { success: false, error };
  }
}

// 工具装饰器工厂
export function tool(config: {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  category?: string;
}) {
  return function <T extends new (...args: unknown[]) => BaseTool>(constructor: T) {
    (constructor.prototype as any).definition = {
      name: config.name,
      description: config.description,
      parameters: config.parameters || [],
      category: config.category,
    };
    return constructor;
  };
}

// 创建单例注册表
export const globalToolRegistry = new ToolRegistry();
