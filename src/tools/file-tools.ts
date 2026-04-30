/**
 * 增强版文件操作工具
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

// ==================== 基础文件操作 ====================

export class ReadFileTool extends BaseTool {
  definition = {
    name: 'read_file',
    description: '读取文件内容，支持分页读取',
    parameters: [
      { name: 'path', description: '文件绝对路径', type: 'string' as const, required: true },
      { name: 'limit', description: '限制读取行数', type: 'number' as const, required: false },
      { name: 'offset', description: '起始行号', type: 'number' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: filePath, limit, offset } = args as { path: string; limit?: number; offset?: number };

    try {
      let content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      if (offset) {
        content = lines.slice(offset).join('\n');
      }
      if (limit) {
        const start = offset || 0;
        content = lines.slice(start, start + limit).join('\n');
      }

      return this.createSuccessResult({
        content,
        path: filePath,
        totalLines: lines.length,
        readLines: content.split('\n').length,
      });
    } catch (error) {
      return this.createErrorResult(`读取文件失败: ${(error as Error).message}`);
    }
  }
}

export class WriteFileTool extends BaseTool {
  definition = {
    name: 'write_file',
    description: '写入内容到文件，自动创建父目录',
    parameters: [
      { name: 'path', description: '文件绝对路径', type: 'string' as const, required: true },
      { name: 'content', description: '文件内容', type: 'string' as const, required: true },
      { name: 'append', description: '是否追加模式', type: 'boolean' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: filePath, content, append } = args as { path: string; content: string; append?: boolean };

    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      if (append) {
        await fs.appendFile(filePath, content, 'utf-8');
      } else {
        await fs.writeFile(filePath, content, 'utf-8');
      }

      return this.createSuccessResult({ path: filePath, bytes: content.length, mode: append ? 'append' : 'write' });
    } catch (error) {
      return this.createErrorResult(`写入文件失败: ${(error as Error).message}`);
    }
  }
}

export class CreateDirectoryTool extends BaseTool {
  definition = {
    name: 'create_directory',
    description: '创建目录',
    parameters: [
      { name: 'path', description: '目录绝对路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: dirPath } = args as { path: string };

    try {
      await fs.mkdir(dirPath, { recursive: true });
      return this.createSuccessResult({ path: dirPath });
    } catch (error) {
      return this.createErrorResult(`创建目录失败: ${(error as Error).message}`);
    }
  }
}

export class ListDirectoryTool extends BaseTool {
  definition = {
    name: 'list_directory',
    description: '列出目录内容',
    parameters: [
      { name: 'path', description: '目录绝对路径', type: 'string' as const, required: true },
      { name: 'recursive', description: '是否递归列出子目录', type: 'boolean' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: dirPath, recursive = false } = args as { path: string; recursive?: boolean };

    try {
      if (recursive) {
        const items: any[] = [];
        const walk = async (dir: string, prefix = '') => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            items.push({
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              path: fullPath,
              prefix,
            });
            if (entry.isDirectory()) {
              await walk(fullPath, prefix + '  ');
            }
          }
        };
        await walk(dirPath);
        return this.createSuccessResult({ path: dirPath, items, total: items.length });
      } else {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const items = entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(dirPath, entry.name),
        }));
        return this.createSuccessResult({ path: dirPath, items, total: items.length });
      }
    } catch (error) {
      return this.createErrorResult(`列出目录失败: ${(error as Error).message}`);
    }
  }
}

export class DeleteFileTool extends BaseTool {
  definition = {
    name: 'delete_file',
    description: '删除文件或目录',
    parameters: [
      { name: 'path', description: '文件或目录绝对路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: targetPath } = args as { path: string };

    try {
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        await fs.rm(targetPath, { recursive: true });
      } else {
        await fs.unlink(targetPath);
      }
      return this.createSuccessResult({ path: targetPath });
    } catch (error) {
      return this.createErrorResult(`删除失败: ${(error as Error).message}`);
    }
  }
}

export class CopyFileTool extends BaseTool {
  definition = {
    name: 'copy_file',
    description: '复制文件或目录',
    parameters: [
      { name: 'source', description: '源路径', type: 'string' as const, required: true },
      { name: 'destination', description: '目标路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { source, destination } = args as { source: string; destination: string };

    try {
      const stat = await fs.stat(source);
      if (stat.isDirectory()) {
        await fs.cp(source, destination, { recursive: true });
      } else {
        await fs.copyFile(source, destination);
      }
      return this.createSuccessResult({ source, destination });
    } catch (error) {
      return this.createErrorResult(`复制失败: ${(error as Error).message}`);
    }
  }
}

// ==================== 增强文件操作 ====================

export class MoveFileTool extends BaseTool {
  definition = {
    name: 'move_file',
    description: '移动或重命名文件/目录',
    parameters: [
      { name: 'source', description: '源路径', type: 'string' as const, required: true },
      { name: 'destination', description: '目标路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { source, destination } = args as { source: string; destination: string };

    try {
      await fs.rename(source, destination);
      return this.createSuccessResult({ source, destination });
    } catch (error) {
      return this.createErrorResult(`移动失败: ${(error as Error).message}`);
    }
  }
}

export class FileInfoTool extends BaseTool {
  definition = {
    name: 'file_info',
    description: '获取文件或目录的详细信息',
    parameters: [
      { name: 'path', description: '文件或目录绝对路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: targetPath } = args as { path: string };

    try {
      const stat = await fs.stat(targetPath);
      return this.createSuccessResult({
        path: targetPath,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        created: stat.birthtime,
        modified: stat.mtime,
        accessed: stat.atime,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        isSymbolicLink: stat.isSymbolicLink(),
      });
    } catch (error) {
      return this.createErrorResult(`获取文件信息失败: ${(error as Error).message}`);
    }
  }
}

export class SearchFilesTool extends BaseTool {
  definition = {
    name: 'search_files',
    description: '按文件名搜索文件，支持通配符',
    parameters: [
      { name: 'directory', description: '搜索目录', type: 'string' as const, required: true },
      { name: 'pattern', description: '搜索模式，如 *.ts, **/*.js', type: 'string' as const, required: true },
      { name: 'maxResults', description: '最大结果数', type: 'number' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { directory, pattern, maxResults = 100 } = args as { directory: string; pattern: string; maxResults?: number };

    try {
      const { stdout } = await execAsync(`find "${directory}" -name "${pattern}" -type f 2>/dev/null | head -${maxResults}`);
      const files = stdout.trim().split('\n').filter(Boolean);
      return this.createSuccessResult({
        directory,
        pattern,
        files,
        count: files.length,
      });
    } catch (error) {
      return this.createErrorResult(`搜索文件失败: ${(error as Error).message}`);
    }
  }
}

export class GrepTool extends BaseTool {
  definition = {
    name: 'grep',
    description: '在文件中搜索内容，支持正则表达式',
    parameters: [
      { name: 'pattern', description: '搜索模式(正则表达式)', type: 'string' as const, required: true },
      { name: 'path', description: '搜索路径(文件或目录)', type: 'string' as const, required: true },
      { name: 'caseSensitive', description: '是否区分大小写', type: 'boolean' as const, required: false },
      { name: 'recursive', description: '是否递归搜索目录', type: 'boolean' as const, required: false },
      { name: 'filePattern', description: '文件过滤，如 *.ts', type: 'string' as const, required: false },
      { name: 'maxResults', description: '最大结果数', type: 'number' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { pattern, path: searchPath, caseSensitive, filePattern, maxResults = 50 } = args as {
      pattern: string;
      path: string;
      caseSensitive?: boolean;
      filePattern?: string;
      maxResults?: number;
    };

    try {
      const flags = (caseSensitive ? '-r' : '-ri') + (filePattern ? '' : 'r');
      const typeFlag = filePattern ? `--include="${filePattern}"` : '';
      const cmd = `grep ${flags} -n ${typeFlag} "${pattern}" "${searchPath}" 2>/dev/null | head -${maxResults}`;

      const { stdout } = await execAsync(cmd);
      const lines = stdout.trim().split('\n').filter(Boolean);
      const results = lines.map(line => {
        const colonIndex = line.indexOf(':');
        const filePath = line.substring(0, colonIndex);
        const rest = line.substring(colonIndex + 1);
        const lineNumEnd = rest.indexOf(':');
        const lineNum = rest.substring(0, lineNumEnd);
        const content = rest.substring(lineNumEnd + 1);
        return { file: filePath, line: parseInt(lineNum), content };
      });

      return this.createSuccessResult({
        pattern,
        path: searchPath,
        results,
        count: results.length,
      });
    } catch (error) {
      return this.createSuccessResult({ pattern, path: searchPath, results: [], count: 0 });
    }
  }
}

export class PatchTool extends BaseTool {
  definition = {
    name: 'patch',
    description: '模糊匹配替换文件中的文本',
    parameters: [
      { name: 'path', description: '文件路径', type: 'string' as const, required: true },
      { name: 'oldText', description: '要替换的旧文本(模糊匹配)', type: 'string' as const, required: true },
      { name: 'newText', description: '新文本', type: 'string' as const, required: true },
      { name: 'replaceAll', description: '是否替换所有匹配', type: 'boolean' as const, required: false },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: filePath, oldText, newText, replaceAll } = args as {
      path: string;
      oldText: string;
      newText: string;
      replaceAll?: boolean;
    };

    try {
      let content = await fs.readFile(filePath, 'utf-8');
      let count = 0;

      if (replaceAll) {
        const regex = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        content = content.replace(regex, newText);
        count = (content.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      } else {
        if (content.includes(oldText)) {
          content = content.replace(oldText, newText);
          count = 1;
        }
      }

      await fs.writeFile(filePath, content, 'utf-8');

      return this.createSuccessResult({
        path: filePath,
        replacements: count,
        replaceAll: replaceAll || false,
      });
    } catch (error) {
      return this.createErrorResult(`补丁应用失败: ${(error as Error).message}`);
    }
  }
}

export class ReadBinaryTool extends BaseTool {
  definition = {
    name: 'read_binary',
    description: '读取二进制文件，检测文件类型',
    parameters: [
      { name: 'path', description: '文件路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: filePath } = args as { path: string };

    try {
      const buffer = await fs.readFile(filePath);
      const mimeType = this.detectMimeType(buffer);
      const size = buffer.length;
      const isImage = mimeType.startsWith('image/');
      const isBinary = !isImage && (mimeType === 'application/octet-stream' || size > 1024 * 1024);

      return this.createSuccessResult({
        path: filePath,
        mimeType,
        size,
        isImage,
        isBinary,
        isLarge: size > 1024 * 1024,
        preview: isImage ? `[图片文件 ${size} bytes]` : (isBinary ? `[二进制文件 ${size} bytes]` : buffer.toString('utf-8').substring(0, 500)),
      });
    } catch (error) {
      return this.createErrorResult(`读取二进制文件失败: ${(error as Error).message}`);
    }
  }

  private detectMimeType(buffer: Buffer): string {
    const header = buffer.slice(0, 20);

    // PNG
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'image/png';
    }
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'image/jpeg';
    }
    // GIF
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
      return 'image/gif';
    }
    // PDF
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      return 'application/pdf';
    }

    return 'application/octet-stream';
  }
}

export class DirectorySizeTool extends BaseTool {
  definition = {
    name: 'directory_size',
    description: '计算目录大小',
    parameters: [
      { name: 'path', description: '目录路径', type: 'string' as const, required: true },
    ],
    category: 'file',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: dirPath } = args as { path: string };

    try {
      const { stdout } = await execAsync(`du -sb "${dirPath}" 2>/dev/null`);
      const [size] = stdout.trim().split('\t');

      return this.createSuccessResult({
        path: dirPath,
        size: parseInt(size),
        sizeFormatted: this.formatBytes(parseInt(size)),
      });
    } catch (error) {
      return this.createErrorResult(`计算目录大小失败: ${(error as Error).message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
