/**
 * 子代理 (SubAgent) - 独立的任务执行单元
 *
 * 功能：
 * - 独立的消息历史
 * - 独立的对话循环
 * - 可配置的超时和迭代限制
 * - 任务目标导向
 */

import type {
  Message,
  Tool,
  ToolCall,
  ToolResult,
} from '../../types.js';
import { ToolRegistry } from '../tool-registry/registry.js';
import { logger } from '../logger.js';

export interface SubAgentConfig {
  goal: string;
  parentSessionId: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  tools: Tool[];
  maxIterations?: number;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface SubAgentResult {
  success: boolean;
  result?: string;
  error?: string;
  iterations: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export class SubAgent {
  private config: SubAgentConfig;
  private messages: Message[] = [];
  private iterationCount: number = 0;
  private isRunning: boolean = false;
  private toolRegistry: ToolRegistry;
  private abortController: AbortController | null = null;

  constructor(config: SubAgentConfig) {
    this.config = {
      maxIterations: 50,
      timeout: 120000,
      temperature: 0.3,
      maxTokens: 4096,
      ...config,
    };
    this.toolRegistry = new ToolRegistry();
    for (const tool of this.config.tools) {
      this.toolRegistry.register(tool);
    }
  }

  /**
   * 运行子代理执行任务
   */
  async run(): Promise<SubAgentResult> {
    if (this.isRunning) {
      return { success: false, error: '子代理已在运行中', iterations: 0 };
    }

    this.isRunning = true;
    this.iterationCount = 0;

    const startTime = Date.now();
    const maxTime = this.config.timeout || 120000;

    try {
      // 初始化系统消息
      this.initSystemMessage();

      while (this.isRunning && this.iterationCount < (this.config.maxIterations || 50)) {
        // 检查超时
        if (Date.now() - startTime > maxTime) {
          return {
            success: false,
            error: '子任务执行超时',
            iterations: this.iterationCount,
          };
        }

        this.iterationCount++;

        // 构建消息并调用LLM
        const response = await this.callLLM();

        if (response.toolCalls && response.toolCalls.length > 0) {
          // 添加工具调用消息
          this.messages.push({
            id: this.generateId(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          });

          // 执行工具调用
          for (const toolCall of response.toolCalls) {
            const result = await this.executeTool(toolCall);
            this.messages.push({
              id: this.generateId(),
              role: 'tool',
              content: JSON.stringify(result),
              timestamp: Date.now(),
              toolCallId: toolCall.id,
            });
          }
        } else if (response.content) {
          // 任务完成
          return {
            success: true,
            result: response.content,
            iterations: this.iterationCount,
          };
        }
      }

      return {
        success: false,
        error: `达到最大迭代次数 (${this.iterationCount})`,
        iterations: this.iterationCount,
      };
    } catch (error) {
      logger.error({ error }, '子代理执行错误');
      return {
        success: false,
        error: (error as Error).message,
        iterations: this.iterationCount,
      };
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * 停止子代理
   */
  stop(): void {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 初始化系统消息
   */
  private initSystemMessage(): void {
    const systemPrompt = this.config.systemPrompt || `你是一个专门的任务执行助手。

你的目标: ${this.config.goal}

请专注于完成这个任务，使用可用的工具来执行操作。
当你完成任务时，直接返回结果，不要有多余的解释。`;

    this.messages = [{
      id: this.generateId(),
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    }];
  }

  /**
   * 调用LLM
   */
  private async callLLM(): Promise<{ content?: string; toolCalls?: ToolCall[] }> {
    const { provider, baseUrl, apiKey, model, temperature, maxTokens } = this.config;

    let url: string;
    let body: any;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const tools = this.toolRegistry.getToolsSpec();

    if (provider === 'anthropic') {
      const base = (baseUrl || '').replace(/\/v1\/?$/, '');
      url = `${base}/v1/messages`;
      body = {
        model,
        messages: this.messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        system: this.messages.find(m => m.role === 'system')?.content,
        tools: tools.length > 0 ? tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: 'object',
            properties: Object.fromEntries(
              (tool.parameters || []).map(p => [p.name, { type: p.type, description: p.description }])
            ),
            required: (tool.parameters || []).filter((p: any) => p.required).map((p: any) => p.name),
          },
        })) : undefined,
        max_tokens: maxTokens || 4096,
        temperature: temperature || 0.3,
      };
      headers['x-api-key'] = apiKey || '';
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    } else {
      const base = (baseUrl || '').replace(/\/chat\/completions\/?$/, '');
      url = `${base}/chat/completions`;

      body = {
        model,
        messages: this.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        tools: tools.length > 0 ? tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: Object.fromEntries(
                (tool.parameters || []).map(p => [p.name, { type: p.type, description: p.description }])
              ),
              required: (tool.parameters || []).filter((p: any) => p.required).map((p: any) => p.name),
            },
          },
        })) : undefined,
        max_tokens: maxTokens,
        temperature: temperature || 0.3,
      };
    }

    this.abortController = new AbortController();
    const timeout = Math.min(this.config.timeout || 120000, 90000);
    const timeoutId = setTimeout(() => this.abortController?.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM调用失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      if (provider === 'anthropic') {
        if (data.content && data.content[0]?.type === 'tool_use') {
          const toolCalls: ToolCall[] = data.content
            .filter((c: any) => c.type === 'tool_use' && c.id && c.name)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              arguments: c.input || {},
            }));
          return { toolCalls };
        }
        return { content: data.content?.[0]?.text || '' };
      } else {
        const choice = data.choices?.[0];
        if (choice?.finish_reason === 'tool_calls' && choice.message) {
          const toolCalls: ToolCall[] = choice.message.tool_calls?.map((tc: any) => {
            let args = {};
            try {
              args = JSON.parse(tc.function.arguments || '{}');
            } catch {}
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: args,
            };
          }) || [];
          return { toolCalls };
        }
        return { content: choice?.message?.content || '' };
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('子任务执行超时');
      }
      throw error;
    }
  }

  /**
   * 执行工具
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      const result = await this.toolRegistry.execute(
        toolCall.name,
        toolCall.arguments,
        {
          sessionId: this.config.parentSessionId,
          runId: this.generateId(),
          metadata: {},
        },
        60000
      );
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export default SubAgent;
