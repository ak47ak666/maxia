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

  // 智能筛选工具 - 根据消息内容筛选相关工具
  getRelevantTools(message: string): ToolDefinition[] {
    const allTools = this.getAllTools();
    if (allTools.length === 0) return [];

    const lowerMessage = message.toLowerCase();

    // 计算每个工具的相关度得分
    const scoredTools = allTools.map(tool => {
      let score = 0;
      const def = tool.definition;

      // 1. 检查关键词匹配
      if (def.keywords) {
        for (const keyword of def.keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            score += 10;
          }
        }
      }

      // 2. 检查工具名称匹配
      if (lowerMessage.includes(def.name.toLowerCase())) {
        score += 5;
      }

      // 3. 检查描述中的关键词
      const descLower = def.description.toLowerCase();
      const descKeywords = ['文件', 'folder', 'directory', 'create', 'delete', 'read', 'write',
                          'git', 'commit', 'push', 'pull', 'branch',
                          '网络', 'network', 'http', 'url', 'download',
                          '图片', 'image', 'photo', '压缩', 'zip',
                          '搜索', 'search', 'grep', 'find',
                          '命令', 'command', 'terminal', 'cmd', 'bash', 'shell',
                          '系统', 'system', 'process', '进程', 'cpu', '内存',
                          '网站', 'web', 'html', 'css', 'js', '前端', '页面', 'page',
                          '数据库', 'database', 'sql',
                          'api', '接口', 'json', 'xml',
                          '视频', 'video', '音频', 'audio', '语音',
                          'pdf', '文档', 'document',
                          '定时', 'cron', 'schedule', '任务',
                          '复制', 'copy', '移动', 'move', '重命名', 'rename',
                          '解压', 'extract', '压缩', 'compress',
                          '目录', '文件夹', '创建', '生成', '新建', '产品', '关于', '联系'];

      for (const kw of descKeywords) {
        if (descLower.includes(kw.toLowerCase())) {
          score += 2;
        }
      }

      // 4. 检查category匹配
      const categoryKeywords: Record<string, string[]> = {
        'file': ['文件', 'folder', 'directory', 'create', 'delete', 'read', 'write', 'copy', 'move', '目录', '文件夹', '创建', '生成'],
        'git': ['git', '版本', 'commit', 'push', 'pull', 'branch', '仓库'],
        'web': ['网络', 'network', 'http', 'url', 'download', '网站', 'web', 'html', 'css', 'js', '页面'],
        'media': ['图片', 'image', 'photo', '视频', 'video', '音频', 'audio'],
        'terminal': ['命令', 'command', 'terminal', 'cmd', 'bash', 'shell', '控制台'],
        'system': ['系统', 'system', 'process', '进程', '内存', 'cpu'],
        'network': ['端口', 'port', '连接', 'connection', 'ping', 'dns'],
      };

      const category = def.category || '';
      if (categoryKeywords[category]) {
        for (const kw of categoryKeywords[category]) {
          if (lowerMessage.includes(kw.toLowerCase())) {
            score += 3;
          }
        }
      }

      return { tool: def, score };
    });

    // 过滤出得分 > 0 的工具，或者如果没有匹配则返回所有工具（基础集）
    const relevantTools = scoredTools
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.tool);

    // 如果没有任何匹配，返回常用基础工具（避免无工具可用）
    if (relevantTools.length === 0) {
      // 返回最常用的基础工具
      const essentialTools = ['read_file', 'write_file', 'list_directory', 'execute_command'];
      return allTools
        .filter(t => essentialTools.includes(t.definition.name))
        .map(t => t.definition);
    }

    // 限制返回数量，最多返回20个最相关的工具
    return relevantTools.slice(0, 20);
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
