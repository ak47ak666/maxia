/**
 * 上下文管理 - 消息历史和上下文窗口管理
 */

import type { Message } from '../../types.js';
import { ContextCompressor, estimateMessagesTokens } from '../context/compressor.js';
import { logger } from '../logger.js';

export interface ContextConfig {
  maxContextMessages: number;
  compressionEnabled: boolean;
  tokenBudget: number;
  compressionThreshold: number;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ContextManager {
  private messages: Message[] = [];
  private config: ContextConfig;
  private compressor: ContextCompressor | null = null;

  constructor(config: ContextConfig) {
    this.config = {
      maxContextMessages: config.maxContextMessages ?? 100,
      compressionEnabled: config.compressionEnabled ?? true,
      tokenBudget: config.tokenBudget ?? 200000,
      compressionThreshold: config.compressionThreshold ?? 0.85,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      provider: config.provider,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    };

    this.initCompressor();
  }

  private initCompressor(): void {
    if (this.config.compressionEnabled && this.config.apiKey && this.config.baseUrl) {
      const validProviders = ['openai', 'anthropic', 'ollama', 'custom'] as const;
      const provider = validProviders.includes(this.config.provider as typeof validProviders[number])
        ? this.config.provider as 'openai' | 'anthropic' | 'ollama' | 'custom'
        : 'custom';

      this.compressor = new ContextCompressor({
        model: this.config.model,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        provider,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
    }
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): void {
    this.messages.push(message);
  }

  /**
   * 获取所有消息
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 设置消息历史
   */
  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  /**
   * 清空消息
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * 构建要发送的消息（带上下文窗口管理）
   */
  async buildMessages(): Promise<Message[]> {
    if (!this.config.compressionEnabled || !this.compressor) {
      if (this.messages.length <= this.config.maxContextMessages) {
        return [...this.messages];
      }
      const systemMsg = this.messages.find(m => m.role === 'system');
      const recentMsgs = this.messages.slice(-this.config.maxContextMessages);
      return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
    }

    const totalTokens = estimateMessagesTokens(this.messages);
    const triggerThreshold = this.config.tokenBudget * this.config.compressionThreshold;

    if (this.messages.length > this.config.maxContextMessages && totalTokens <= triggerThreshold) {
      const systemMsg = this.messages.find(m => m.role === 'system');
      const recentMsgs = this.messages.slice(-this.config.maxContextMessages);
      return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
    }

    if (totalTokens > triggerThreshold) {
      logger.info({ totalTokens, tokenBudget: this.config.tokenBudget, threshold: triggerThreshold }, '触发上下文压缩');
      const { messages: compressedMessages } = await this.compressor.compress(this.messages, this.config.tokenBudget);
      logger.info({ compressedTokens: estimateMessagesTokens(compressedMessages) }, '压缩完成');
      return compressedMessages;
    }

    return [...this.messages];
  }

  /**
   * 获取消息统计
   */
  getStats() {
    const totalTokens = estimateMessagesTokens(this.messages);
    return {
      messageCount: this.messages.length,
      totalTokens,
      tokenBudget: this.config.tokenBudget,
      usagePercent: Math.round((totalTokens / this.config.tokenBudget) * 100),
      compressionEnabled: this.config.compressionEnabled,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ContextConfig>): void {
    const needsReinit = config.compressionEnabled !== undefined ||
      config.apiKey !== undefined ||
      config.baseUrl !== undefined;

    this.config = { ...this.config, ...config };

    if (needsReinit) {
      this.initCompressor();
    }
  }
}
