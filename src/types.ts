/**
 * 马虾 - 核心类型定义
 */

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// 消息结构
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolResult?: unknown;
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// 工具结果
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// 工具定义
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category?: string;
  keywords?: string[];  // 关键词，用于智能筛选
}

// 工具参数
export interface ToolParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: unknown;
}

// 工具接口
export interface Tool {
  definition: ToolDefinition;
  execute(args: unknown, context: ToolContext): Promise<ToolResult>;
}

// 工具执行上下文
export interface ToolContext {
  sessionId: string;
  runId: string;
  metadata: Record<string, unknown>;
}

// 会话接口
export interface Session {
  id: string;
  profileId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  metadata: Record<string, unknown>;
}

// 模型候选
export interface ModelCandidate {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// Agent配置
export interface AgentConfig {
  model: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  maxIterations?: number;
  tools: Tool[];
  // 降级配置
  fallbackProviders?: ModelCandidate[];
  enableRetry?: boolean;
  maxRetries?: number;
  // 超时和上下文配置
  requestTimeout?: number;
  maxContextMessages?: number;
}

// Agent事件类型
export type AgentEventType =
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'content_chunk'
  | 'error'
  | 'thinking'
  | 'connected'
  | 'disconnected';

// Agent事件
export interface AgentEvent {
  type: AgentEventType;
  data: unknown;
  timestamp: number;
}

// 事件处理器
export type EventHandler = (event: AgentEvent) => void;
