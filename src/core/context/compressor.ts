/**
 * 上下文压缩器 - 智能管理对话上下文
 *
 * 功能：
 * - Token数量估算
 * - 工具输出摘要预处理器
 * - LLM智能摘要中间部分
 * - 头部尾部保护机制
 */

import type { Message } from '../../types.js';

export interface CompressionResult {
  compressed: boolean;
  originalTokens: number;
  compressedTokens: number;
  summary?: string;
  ratio: number;
}

export interface CompressorConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_TOKEN_BUDGET = 200000;  // 200K token 上下文窗口
const TOOL_OUTPUT_MAX_LEN = 2000;  // 工具输出超过2K字符时做摘要
const HEAD_PROTECT_COUNT = 3;  // 头部保护3条消息
const TAIL_PROTECT_COUNT = 50;  // 尾部保护50条消息（对话最近的部分很重要）

/**
 * 估算文本的token数量
 * 中文约4字符=1token，英文约1词=1token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars * 2;
  return Math.ceil((chineseChars / 4) + englishWords + (otherChars / 2));
}

/**
 * 估算消息数组的总token数
 */
export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content || '');
  }, 0);
}

/**
 * 生成工具输出的简短摘要
 */
function summarizeToolOutput(toolName: string, content: string): string {
  if (!content || content.length <= TOOL_OUTPUT_MAX_LEN) {
    return content;
  }

  const contentLen = content.length;
  const lineCount = content.split('\n').length;

  if (toolName === 'terminal' || toolName === 'execute_command') {
    const exitMatch = content.match(/"exit_code"\s*:\s*(-?\d+)/);
    const exitCode = exitMatch ? exitMatch[1] : '?';
    return `[terminal] exit ${exitCode}, ${lineCount} lines, ${contentLen} chars`;
  }

  if (toolName === 'read_file') {
    return `[read_file] ${lineCount} lines, ${contentLen} chars`;
  }

  if (toolName === 'write_file' || toolName === 'create_file') {
    return `[write_file] wrote ${lineCount} lines`;
  }

  if (toolName === 'search_files' || toolName === 'grep') {
    const matchCount = content.match(/"total_count"\s*:\s*(\d+)/);
    const count = matchCount ? matchCount[1] : '?';
    return `[search_files] ${count} matches, ${contentLen} chars`;
  }

  return `[${toolName}] ${lineCount} lines, ${contentLen} chars`;
}

/**
 * 工具输出预处理器 - 用简短摘要替换过长的工具输出
 */
export function pruneToolOutputs(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (msg.role === 'tool' && msg.content) {
      const content = msg.content as string;
      if (content.length > TOOL_OUTPUT_MAX_LEN) {
        const toolName = (msg.toolResult as any)?.tool || 'unknown';
        const summary = summarizeToolOutput(toolName, content);
        return { ...msg, content: summary };
      }
    }
    return msg;
  });
}

export class ContextCompressor {
  private config: CompressorConfig;

  constructor(config: CompressorConfig) {
    this.config = {
      maxTokens: 4096,
      temperature: 0.3,
      ...config,
    };
  }

  /**
   * 检查是否需要压缩
   */
  needsCompression(messages: Message[], tokenBudget: number = DEFAULT_TOKEN_BUDGET): boolean {
    const totalTokens = estimateMessagesTokens(messages);
    return totalTokens > tokenBudget;
  }

  /**
   * 执行上下文压缩
   */
  async compress(
    messages: Message[],
    tokenBudget: number = DEFAULT_TOKEN_BUDGET
  ): Promise<{ messages: Message[]; result: CompressionResult }> {
    const originalTokens = estimateMessagesTokens(messages);

    if (originalTokens <= tokenBudget) {
      return {
        messages,
        result: {
          compressed: false,
          originalTokens,
          compressedTokens: originalTokens,
          ratio: 1,
        },
      };
    }

    // 分离头部、中间、尾部消息
    const headMsgs = messages.slice(0, HEAD_PROTECT_COUNT);
    const tailMsgs = messages.slice(-TAIL_PROTECT_COUNT);
    let middleMsgs = messages.slice(HEAD_PROTECT_COUNT, -TAIL_PROTECT_COUNT);

    // 先对尾部进行工具输出裁剪
    const prunedTail = pruneToolOutputs(tailMsgs);

    // 计算当前token使用
    let currentTokens = estimateMessagesTokens([...headMsgs, ...prunedTail]);

    // 如果头部+尾部已经超预算，减少尾部
    if (currentTokens >= tokenBudget) {
      const reducedTail = tailMsgs.slice(-Math.floor(TAIL_PROTECT_COUNT / 2));
      const prunedReducedTail = pruneToolOutputs(reducedTail);
      return {
        messages: [...headMsgs, ...prunedReducedTail],
        result: {
          compressed: true,
          originalTokens,
          compressedTokens: estimateMessagesTokens([...headMsgs, ...prunedReducedTail]),
          summary: '尾部消息被裁剪',
          ratio: estimateMessagesTokens([...headMsgs, ...prunedReducedTail]) / originalTokens,
        },
      };
    }

    // 工具输出预压缩（处理中间部分）
    middleMsgs = pruneToolOutputs(middleMsgs);

    // 对中间部分进行LLM摘要
    const compressedMiddle = await this.summarizeMiddle(middleMsgs, tokenBudget - currentTokens);

    const finalMessages = [...headMsgs, ...compressedMiddle, ...prunedTail];
    const compressedTokens = estimateMessagesTokens(finalMessages);

    return {
      messages: finalMessages,
      result: {
        compressed: true,
        originalTokens,
        compressedTokens,
        ratio: compressedTokens / originalTokens,
      },
    };
  }

  /**
   * 对中间部分进行LLM摘要
   */
  private async summarizeMiddle(
    middleMsgs: Message[],
    tokenBudget: number
  ): Promise<Message[]> {
    if (middleMsgs.length === 0) {
      return [];
    }

    const middleTokens = estimateMessagesTokens(middleMsgs);

    // 如果中间部分在预算内，直接返回
    if (middleTokens <= tokenBudget) {
      return middleMsgs;
    }

    // 构建摘要提示
    const summaryPrompt = this.buildSummaryPrompt(middleMsgs);

    try {
      const summary = await this.callLLMForSummary(summaryPrompt);

      // 返回摘要消息
      return [{
        id: `summary_${Date.now()}`,
        role: 'system' as const,
        content: `[上下文摘要] 之前的对话摘要：\n${summary}`,
        timestamp: Date.now(),
      }];
    } catch (error) {
      // 如果摘要失败，使用简单的尾部裁剪
      const maxMiddleLen = Math.floor(tokenBudget * 3);
      const middleText = middleMsgs.map(m => m.content).join('\n');
      if (middleText.length > maxMiddleLen) {
        return [{
          id: `summary_${Date.now()}`,
          role: 'system' as const,
          content: `[上下文摘要] (详细内容已省略) 共${middleMsgs.length}条消息，约${middleTokens} tokens`,
          timestamp: Date.now(),
        }];
      }
      return middleMsgs;
    }
  }

  /**
   * 构建摘要提示
   */
  private buildSummaryPrompt(messages: Message[]): string {
    const taskDesc = messages.length > 20
      ? `这是一个包含${messages.length}条消息的对话片段，请简要总结关键信息：\n\n`
      : '请简要总结以下对话的关键信息：\n\n';

    const msgList = messages.map((msg, i) => {
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role === 'tool' ? '工具' : '系统';
      const preview = String(msg.content || '').substring(0, 200);
      return `[${i + 1}] ${role}: ${preview}${msg.content.length > 200 ? '...' : ''}`;
    }).join('\n');

    return `${taskDesc}${msgList}\n\n请用简洁的语言总结：\n1. 用户的主要需求\n2. 已完成的主要操作\n3. 当前的状态或进度`;
  }

  /**
   * 调用LLM生成摘要
   */
  private async callLLMForSummary(prompt: string): Promise<string> {
    const { provider, baseUrl, apiKey, model, maxTokens, temperature } = this.config;

    let url: string;
    let body: any;

    if (provider === 'anthropic') {
      const base = (baseUrl || '').replace(/\/v1\/?$/, '');
      url = `${base}/v1/messages`;
      body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(maxTokens || 4096, 500),
        temperature: temperature || 0.3,
      };
    } else {
      const base = (baseUrl || '').replace(/\/chat\/completions\/?$/, '');
      url = `${base}/chat/completions`;
      body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: Math.min(maxTokens || 4096, 500),
        temperature: temperature || 0.3,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey) {
      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LLM调用失败: ${response.status}`);
      }

      const data = await response.json() as any;

      if (provider === 'anthropic') {
        return data.content?.[0]?.text || '';
      } else {
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      if ((error as Error).message.includes('aborted')) {
        throw new Error('摘要生成超时');
      }
      throw error;
    }
  }
}

export default ContextCompressor;
