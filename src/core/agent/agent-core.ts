/**
 * Agent核心 - 主对话循环协调器
 */

import type { Message, ToolCall, ToolResult, AgentConfig, AgentEvent, EventHandler, ModelCandidate } from '../../types.js';
import { ToolRegistry } from '../tool-registry/registry.js';
import { logger } from '../logger.js';
import { LoopDetector, createLoopErrorMessage } from './agent-loop-detector.js';
import { AgentResilience, type ResilienceConfig } from './agent-resilience.js';
import { LLMCaller, type LLMConfig } from './agent-llm.js';
import { ContextManager, type ContextConfig } from './agent-context.js';

export class AgentCore {
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private eventHandlers: Set<EventHandler> = new Set();
  private currentSessionId?: string;
  private iterationCount: number = 0;
  private consecutiveToolFailures: number = 0;
  private maxConsecutiveToolFailures: number = 10;

  private loopDetector: LoopDetector;
  private resilience: AgentResilience;
  private llmCaller: LLMCaller;
  private contextManager: ContextManager;

  private isRunning: boolean = false;
  private consecutiveTextResponses: number = 0;

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

    this.toolRegistry = new ToolRegistry();

    const primaryCandidate: ModelCandidate = {
      provider: this.config.provider,
      model: this.config.model,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
    };

    const resilienceConfig: ResilienceConfig = {
      enableRetry: this.config.enableRetry ?? true,
      maxRetries: this.config.maxRetries ?? 3,
      fallbackProviders: this.config.fallbackProviders,
    };

    this.loopDetector = new LoopDetector(10, 8);

    this.resilience = new AgentResilience(primaryCandidate, resilienceConfig);

    const llmConfig: LLMConfig = {
      model: this.config.model,
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      systemPrompt: this.config.systemPrompt,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      requestTimeout: this.config.requestTimeout,
    };
    this.llmCaller = new LLMCaller(llmConfig);

    const contextConfig: ContextConfig = {
      maxContextMessages: this.config.maxContextMessages || 100,
      compressionEnabled: true,
      tokenBudget: 200000,
      compressionThreshold: 0.85,
      model: this.config.model,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      provider: this.config.provider,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
    this.contextManager = new ContextManager(contextConfig);

    for (const tool of this.config.tools) {
      this.toolRegistry.register(tool);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit({ type: 'connected', data: null, timestamp: Date.now() });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit({ type: 'disconnected', data: null, timestamp: Date.now() });
  }

  async sendMessage(content: string): Promise<string> {
    if (!this.isRunning) {
      await this.start();
    }

    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    this.contextManager.addMessage(userMessage);

    const response = await this.runLoop();

    return response;
  }

  private async runLoop(): Promise<string> {
    let finalResponse = '';
    this.consecutiveTextResponses = 0;

    logger.info({ isRunning: this.isRunning }, '开始对话循环');

    while (this.isRunning && this.iterationCount < (this.config.maxIterations || 100)) {
      logger.info({ iteration: this.iterationCount }, '开始第N轮迭代');

      if (this.consecutiveToolFailures >= this.maxConsecutiveToolFailures) {
        const errorMsg = `[错误] 连续工具执行失败次数过多 (${this.consecutiveToolFailures}次)，停止执行。可能是模型产生了无效的工具调用。`;
        logger.error({ consecutiveFailures: this.consecutiveToolFailures }, '连续工具失败，停止循环');
        this.contextManager.addMessage({
          id: this.generateId(),
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
        });
        return errorMsg;
      }

      this.iterationCount++;

      const messages = await this.contextManager.buildMessages();

      // 智能筛选工具 - 只发送最相关的少量工具，减少 token 消耗
      // 如果是第二轮及以后，说明有上下文，只需要发送核心工具
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      let tools = lastUserMessage
        ? this.toolRegistry.getRelevantTools(lastUserMessage)
        : this.toolRegistry.getToolsSpec();

      // 如果工具太多，优先保留最常用的基础工具
      if (tools.length > 15) {
        const essentialTools = ['read_file', 'write_file', 'create_directory', 'list_directory', 'execute_command'];
        const essential = tools.filter(t => essentialTools.includes(t.name));
        const others = tools.filter(t => !essentialTools.includes(t.name));
        tools = [...essential, ...others].slice(0, 15);
      }

      logger.info({ toolsCount: tools.length, messagePreview: lastUserMessage.substring(0, 50) }, '调用LLM');

      const response = await this.resilience.executeWithResilience(
        (candidate) => this.llmCaller.call(messages, tools, candidate)
      );

      logger.info({ hasContent: !!response.content, toolCalls: response.toolCalls?.length }, 'LLM响应收到');

      if (response.toolCalls && response.toolCalls.length > 0) {
        this.consecutiveTextResponses = 0;

        const assistantMessage: Message & { toolCalls: ToolCall[] } = {
          id: this.generateId(),
          role: 'assistant',
          content: response.content || '',
          timestamp: Date.now(),
          toolCalls: response.toolCalls as ToolCall[],
        };
        this.contextManager.addMessage(assistantMessage);

        for (const toolCall of response.toolCalls as ToolCall[]) {
          if (!toolCall.name || !toolCall.name.trim()) {
            logger.warn({ toolCall }, '跳过无效工具调用: 名称为空');
            const errorResult = { success: false, error: '工具名称无效: 名称为空' };
            this.contextManager.addMessage({
              id: this.generateId(),
              role: 'tool',
              content: JSON.stringify(errorResult),
              timestamp: Date.now(),
              toolCallId: toolCall.id,
              toolResult: errorResult,
            });
            this.consecutiveToolFailures++;
            continue;
          }

          this.emit({ type: 'tool_call', data: toolCall, timestamp: Date.now() });

          const result = await this.executeTool(toolCall);

          if (!result.success) {
            this.consecutiveToolFailures++;
            logger.warn({ toolCall: toolCall.name, result, consecutiveFailures: this.consecutiveToolFailures }, '工具执行失败');
          } else {
            this.consecutiveToolFailures = 0;
          }

          this.loopDetector.recordCall(toolCall);

          if (this.loopDetector.isStuckInLoop()) {
            const loopError = createLoopErrorMessage(this.loopDetector.getRecentCalls());
            this.contextManager.addMessage({
              id: this.generateId(),
              role: 'assistant',
              content: loopError,
              timestamp: Date.now(),
            });
            return loopError;
          }

          this.contextManager.addMessage({
            id: this.generateId(),
            role: 'tool',
            content: JSON.stringify(result),
            timestamp: Date.now(),
            toolCallId: toolCall.id,
            toolResult: result,
          });
        }

        continue;
      }

      if (response.content !== undefined) {
        const content = response.content.trim();
        if (content) {
          this.contextManager.addMessage({
            id: this.generateId(),
            role: 'assistant',
            content: content,
            timestamp: Date.now(),
          });
          finalResponse = content;
        }

        this.consecutiveTextResponses++;

        this.emit({
          type: 'thinking',
          data: { text: content, iteration: this.iterationCount },
          timestamp: Date.now(),
        });

        // 智能退出逻辑：如果之前有成功的工具调用，并且这次回复明确表示任务完成，则退出
        const hasToolCalls = this.contextManager.getMessages().some(m => m.role === 'tool');
        if (hasToolCalls) {
          // 检查是否包含完成相关的关键词
          const completionKeywords = ['完成', '已创建', '已生成', '已修改', 'success', 'done', 'completed', 'finished', 'ready', '已就绪'];
          const isCompletionResponse = completionKeywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()));

          // 如果之前有过工具调用，且这次回复表示完成，或连续3次文本响应，则退出
          if (isCompletionResponse || this.consecutiveTextResponses >= 3) {
            logger.info({ consecutiveTextResponses: this.consecutiveTextResponses }, '任务完成，准备退出');
            return finalResponse || '任务已完成';
          }
        }

        // 从未调用过工具且连续5次文本响应，认为任务不需要工具
        if (this.consecutiveTextResponses >= 5 && !hasToolCalls) {
          return finalResponse || '任务已完成（无文件操作需求）';
        }

        continue;
      }

      this.emit({ type: 'thinking', data: null, timestamp: Date.now() });
    }

    if (finalResponse) {
      return finalResponse + '\n\n[提示：已达到最大迭代次数，任务可能未完全完成]';
    }
    return '已达到最大迭代次数';
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      const timeout = this.config.requestTimeout || 60000;
      const result = await this.toolRegistry.execute(
        toolCall.name,
        toolCall.arguments,
        {
          sessionId: this.currentSessionId || 'default',
          runId: this.generateId(),
          metadata: this.getSubAgentMetadata(),
        },
        timeout
      );

      this.emit({
        type: 'tool_result',
        data: { tool: toolCall.name, result },
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const result = { success: false, error: `工具执行异常: ${(error as Error).message}` };
      this.emit({
        type: 'tool_result',
        data: { tool: toolCall.name, result },
        timestamp: Date.now(),
      });
      return result;
    }
  }

  private getSubAgentMetadata(): Record<string, unknown> {
    return {
      subAgentConfig: {
        model: this.config.model,
        provider: this.config.provider,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
    };
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: AgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        logger.error({ error: e }, '事件处理错误');
      }
    }
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getMessages(): Message[] {
    return this.contextManager.getMessages();
  }

  addMessage(message: Message): void {
    this.contextManager.addMessage(message);
  }

  getResilienceStatus() {
    return this.resilience.getStatus();
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
