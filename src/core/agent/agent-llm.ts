/**
 * LLM调用 - 处理与语言模型的通信
 */

import type { Message, ToolCall, ModelCandidate, ToolParameter } from '../../types.js';
import { logger } from '../logger.js';

export interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
  rawData?: unknown;
}

export interface LLMConfig {
  model: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  requestTimeout?: number;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string;
  }>;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export class LLMCaller {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 调用LLM
   */
  async call(
    messages: Message[],
    tools: any[],
    candidate?: ModelCandidate
  ): Promise<LLMResponse> {
    const provider = candidate?.provider || this.config.provider;
    const model = candidate?.model || this.config.model;
    const apiKey = candidate?.apiKey || this.config.apiKey;
    const baseUrl = candidate?.baseUrl || this.config.baseUrl;

    const effectiveBaseUrl = baseUrl || '';
    const isJdCloud = effectiveBaseUrl.includes('jdcloud');
    const isMinimax = effectiveBaseUrl.includes('minimax');
    const isOfficialAnthropic = provider === 'anthropic' && !isJdCloud && !isMinimax;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let url: string;
    let requestBody: Record<string, unknown>;

    if (isOfficialAnthropic) {
      url = this.buildAnthropicUrl(baseUrl);
      requestBody = this.buildAnthropicRequest(model, messages, tools);
      headers['x-api-key'] = apiKey || '';
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      delete headers['Authorization'];
    } else {
      url = this.buildChatUrl(isJdCloud, isMinimax, baseUrl);
      requestBody = this.buildChatRequest(model, messages, tools);
    }

    return this.executeRequest(url, headers, requestBody, provider);
  }

  private buildAnthropicUrl(baseUrl?: string): string {
    const base = (baseUrl || '').replace(/\/v1\/?$/, '');
    return `${base}/v1/messages`;
  }

  private buildChatUrl(isJdCloud: boolean, isMinimax: boolean, baseUrl?: string): string {
    const base = (baseUrl || '').replace(/\/v1\/?$/, '').replace(/\/chat\/completions\/?$/, '');
    return isJdCloud || isMinimax
      ? `${base}/v1/messages`
      : `${base}/chat/completions`;
  }

  private buildAnthropicRequest(model: string, messages: Message[], tools: any[]): Record<string, unknown> {
    return {
      model,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      system: messages.find(m => m.role === 'system')?.content || this.config.systemPrompt,
      tools: tools.length > 0 ? tools.map(tool => this.formatTool(tool)) : undefined,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature,
    };
  }

  private buildChatRequest(model: string, messages: Message[], tools: any[]): Record<string, unknown> {
    const chatMessages = this.formatMessages(messages);

    return {
      model,
      messages: chatMessages,
      system: this.config.systemPrompt,
      tools: tools.length > 0 ? tools.map(tool => this.formatTool(tool)) : undefined,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
  }

  private formatTool(tool: any): any {
    const parameters = tool.parameters || [];
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: Object.fromEntries(
          parameters.map((p: ToolParameter) => [p.name, { type: p.type, description: p.description }])
        ),
        required: parameters.filter((p: ToolParameter) => p.required).map((p: ToolParameter) => p.name),
      },
    };
  }

  private formatMessages(messages: Message[]): LLMMessage[] {
    const result: LLMMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === 'tool') {
        const toolResults: Array<{
          type: 'tool_result';
          tool_use_id: string;
          content: string;
        }> = [];

        let j = i;
        while (j < messages.length && messages[j].role === 'tool') {
          const toolMsg = messages[j];
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolMsg.toolCallId || '',
            content: typeof toolMsg.toolResult === 'string'
              ? toolMsg.toolResult
              : JSON.stringify(toolMsg.toolResult || toolMsg.content),
          });
          j++;
        }
        i = j - 1;

        result.push({
          role: 'user',
          content: toolResults,
        });
        continue;
      }

      if (msg.role === 'assistant' && (msg as any).toolCalls) {
        const msgWithTools = msg as Message & { toolCalls: ToolCall[] };
        result.push({
          role: 'assistant',
          content: msgWithTools.toolCalls.map((tc: ToolCall) => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })),
        });
        continue;
      }

      result.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content || '',
      });
    }

    return result;
  }

  private async executeRequest(
    url: string,
    headers: Record<string, string>,
    requestBody: Record<string, unknown>,
    provider: string
  ): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = this.config.requestTimeout || 90000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = this.tryParseJSON(errorText);
        throw this.createError(response.status, response.statusText, errorData, response);
      }

      const responseText = await response.text();

      if (!responseText || responseText.trim() === '') {
        throw new Error('API返回了空响应');
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`JSON解析失败: ${(parseError as Error).message}\n响应内容: ${responseText.substring(0, 500)}`);
      }

      return this.parseResponse(data, provider);

    } catch (error) {
      if (error instanceof TypeError && (error as Error).message.includes('aborted')) {
        throw new Error('请求超时');
      }
      throw error;
    }
  }

  private parseResponse(data: any, provider: string): LLMResponse {
    if (provider === 'anthropic') {
      return this.parseAnthropicResponse(data);
    }
    return this.parseOpenAIResponse(data);
  }

  private parseAnthropicResponse(data: any): LLMResponse {
    // 兼容 MiniMax 和官方 Anthropic 格式：遍历 content 查找 tool_use
    if (data.content && Array.isArray(data.content)) {
      const toolUseItems = data.content.filter((c: any) => c.type === 'tool_use' && c.id && c.name);
      if (toolUseItems.length > 0) {
        const toolCalls: ToolCall[] = toolUseItems.map((c: any) => ({
          id: c.id,
          name: c.name,
          arguments: c.input || {},
        }));
        return { toolCalls, rawData: data };
      }
      // 没有 tool_use，查找 text 类型的内容
      const textItem = data.content.find((c: any) => c.type === 'text');
      return { content: textItem?.text || '', rawData: data };
    }
    return { content: '', rawData: data };
  }

  private parseOpenAIResponse(data: any): LLMResponse {
    const choice = data.choices?.[0];

    if (choice?.finish_reason === 'tool_calls' && choice.message) {
      const toolCalls: ToolCall[] = choice.message.tool_calls
        ?.map((tc: any) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {
            logger.error({ args: tc.function.arguments }, '解析工具参数失败');
          }
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: args,
          };
        })
        .filter((tc: ToolCall) => tc.name && tc.name.trim() !== '') || [];

      return { toolCalls, rawData: data };
    }

    return { content: choice?.message?.content || '', rawData: data };
  }

  private createError(
    status: number,
    statusText: string,
    data: unknown,
    response: Response
  ): Error & { status?: number; data?: unknown; headers?: Record<string, string> } {
    const error = new Error() as Error & { status?: number; data?: unknown; headers?: Record<string, string> };
    error.status = status;
    error.data = data;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    error.headers = headers;

    let message = statusText || `HTTP ${status}`;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (d.error) {
        if (typeof d.error === 'string') {
          message = d.error;
        } else if (typeof d.error === 'object') {
          const e = d.error as Record<string, unknown>;
          message = (e.message as string) || (e.msg as string) || message;
        }
      } else if (d.message) {
        message = d.message as string;
      } else if (d.msg) {
        message = d.msg as string;
      }
    }

    error.message = message;
    return error;
  }

  private tryParseJSON(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
