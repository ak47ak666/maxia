/**
 * AIAgent - 主入口类（兼容层）
 *
 * 特性：
 * - 完整的错误分类和容错机制
 * - Jittered Backoff 重试
 * - Provider Cooldown 管理
 * - 多模型降级 Fallback
 * - 子代理委托机制
 * - 智能上下文压缩
 *
 * @deprecated 请使用 AgentCore 或单独使用各模块
 */

import type { AgentConfig, EventHandler, Message } from '../../types.js';
import { ToolRegistry } from '../tool-registry/registry.js';
import { logger } from '../logger.js';
import { AgentCore } from './agent-core.js';

export class AIAgent {
  private core: AgentCore;
  private config: AgentConfig;
  private eventHandlers: Set<EventHandler> = new Set();

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 100,
      temperature: 0.7,
      maxTokens: 4096,
      enableRetry: true,
      maxRetries: 3,
      requestTimeout: 90000,
      ...config,
    };

    this.core = new AgentCore(this.config);

    this.core.onEvent((event) => {
      for (const handler of this.eventHandlers) {
        try {
          handler(event);
        } catch (e) {
          logger.error({ error: e }, '事件处理错误');
        }
      }
    });
  }

  async start(): Promise<void> {
    return this.core.start();
  }

  async stop(): Promise<void> {
    return this.core.stop();
  }

  async sendMessage(content: string): Promise<string> {
    return this.core.sendMessage(content);
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  getToolRegistry(): ToolRegistry {
    return this.core.getToolRegistry();
  }

  getMessages(): Message[] {
    return this.core.getMessages();
  }

  addMessage(message: Message): void {
    this.core.addMessage(message);
  }

  getResilienceStatus() {
    return this.core.getResilienceStatus();
  }
}

export { AgentCore } from './agent-core.js';
export { LoopDetector } from './agent-loop-detector.js';
export { AgentResilience } from './agent-resilience.js';
export { LLMCaller } from './agent-llm.js';
export { ContextManager } from './agent-context.js';
