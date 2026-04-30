/**
 * MCP 客户端 - 连接MCP服务器
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '../logger.js';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: {
    type: 'text';
    text: string;
  }[];
  isError?: boolean;
}

/**
 * MCP客户端类
 */
export class MCPClient {
  private client: Client | null = null;
  private connected: boolean = false;
  private serverUrl: string = '';
  private tools: MCPTool[] = [];

  /**
   * 连接到MCP服务器
   */
  async connect(serverUrl: string): Promise<void> {
    if (this.connected) {
      logger.info('MCP客户端已连接，先断开再重连');
      await this.disconnect();
    }

    this.serverUrl = serverUrl;
    this.client = new Client(
      { name: 'maxia-mcp-client', version: '1.0.0' },
      { capabilities: {} }
    );

    const transport = new StreamableHTTPClientTransport(
      new URL(serverUrl)
    );

    try {
      await this.client.connect(transport);
      this.connected = true;
      logger.info({ serverUrl }, 'MCP客户端已连接');

      // 获取工具列表
      await this.listTools();
    } catch (error) {
      this.connected = false;
      throw new Error(`MCP连接失败: ${(error as Error).message}`);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {}
      this.client = null;
    }
    this.connected = false;
    this.tools = [];
    logger.info('MCP客户端已断开');
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取服务器URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('MCP客户端未连接');
    }

    try {
      const result = await this.client.request(
        { method: 'tools/list' },
        { tools: [{ inputSchema: { type: 'object' } }] } as any
      );

      this.tools = (result as any).tools || [];
      return this.tools;
    } catch (error) {
      throw new Error(`获取工具列表失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取已缓存的工具列表
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.client || !this.connected) {
      throw new Error('MCP客户端未连接');
    }

    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: { name, arguments: args }
        },
        { content: [] } as any
      );

      return result as MCPToolResult;
    } catch (error) {
      throw new Error(`调用工具 ${name} 失败: ${(error as Error).message}`);
    }
  }
}

// 全局MCP客户端管理
const globalMCPClients: Map<string, MCPClient> = new Map();

export function getMCPClient(name: string = 'default'): MCPClient {
  if (!globalMCPClients.has(name)) {
    globalMCPClients.set(name, new MCPClient());
  }
  return globalMCPClients.get(name)!;
}

export function getAllMCPClients(): Map<string, MCPClient> {
  return globalMCPClients;
}
