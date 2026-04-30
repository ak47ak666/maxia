/**
 * MCP工具适配器 - 将MCP工具转换为Agent工具
 */

import type { Tool, ToolParameter, ToolResult } from '../../types.js';
import type { MCPTool } from './client.js';
import { getMCPClient } from './client.js';

/**
 * 将MCP的inputSchema转换为Agent工具参数
 */
function convertSchemaToParameters(schema: MCPTool['inputSchema']): ToolParameter[] {
  const parameters: ToolParameter[] = [];
  const properties = schema.properties || {};

  for (const [name, prop] of Object.entries(properties)) {
    const param = prop as any;
    parameters.push({
      name,
      description: param.description || `参数 ${name}`,
      type: mapSchemaType(param.type),
      required: schema.required?.includes(name) || false,
    });
  }

  return parameters;
}

/**
 * 映射JSON Schema类型到Agent参数类型
 */
function mapSchemaType(jsonType: string | undefined): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  switch (jsonType) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

/**
 * 将MCP工具适配为Agent工具
 */
export function adaptMCPTool(mcpTool: MCPTool, clientName: string = 'default'): Tool {
  return {
    definition: {
      name: `mcp_${mcpTool.name}`,
      description: mcpTool.description || `MCP工具: ${mcpTool.name}`,
      parameters: convertSchemaToParameters(mcpTool.inputSchema),
      category: 'mcp',
    },
    execute: async (args: unknown): Promise<ToolResult> => {
      const client = getMCPClient(clientName);

      if (!client.isConnected()) {
        return {
          success: false,
          error: `MCP客户端 ${clientName} 未连接`,
          data: null,
        };
      }

      try {
        const result = await client.callTool(mcpTool.name, args as Record<string, unknown>);
        return {
          success: !result.isError,
          data: result.content,
          error: result.isError ? '工具执行出错' : undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          data: null,
        };
      }
    },
  };
}

/**
 * 从MCP客户端获取所有工具并转换为Agent工具
 */
export async function loadMCPToolsFromClient(
  clientName: string = 'default'
): Promise<Tool[]> {
  const client = getMCPClient(clientName);

  if (!client.isConnected()) {
    console.log(`MCP客户端 ${clientName} 未连接，跳过加载`);
    return [];
  }

  const mcpTools = await client.listTools();
  return mcpTools.map(tool => adaptMCPTool(tool, clientName));
}

/**
 * MCP工具管理器
 */
export class MCPToolManager {
  private tools: Map<string, Tool> = new Map();
  private clientName: string;

  constructor(clientName: string = 'default') {
    this.clientName = clientName;
  }

  /**
   * 加载所有MCP工具
   */
  async loadTools(): Promise<void> {
    const tools = await loadMCPToolsFromClient(this.clientName);
    this.tools.clear();

    for (const tool of tools) {
      this.tools.set(tool.definition.name, tool);
    }

    console.log(`✅ 加载了 ${this.tools.size} 个MCP工具`);
  }

  /**
   * 获取所有已加载的工具
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取指定工具
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取工具数量
   */
  getToolCount(): number {
    return this.tools.size;
  }
}
