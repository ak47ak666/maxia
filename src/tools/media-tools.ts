/**
 * 媒体工具 - 图像生成、分析
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

export class ImageAnalyzeTool extends BaseTool {
  definition = {
    name: 'image_analyze',
    description: '分析图像内容（需要配置视觉模型API）',
    parameters: [
      { name: 'path', description: '图像路径或URL', type: 'string' as const, required: true },
      { name: 'prompt', description: '分析提示词', type: 'string' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: imagePath, prompt = '描述这张图片的内容' } = args as { path: string; prompt?: string };

    try {
      // 检查是否是URL
      const isUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');

      if (!isUrl) {
        // 本地文件，检查是否存在
        await fs.access(imagePath);
      }

      // 这里需要调用视觉模型API，实际实现需要配置API
      // 暂时返回占位信息
      return this.createSuccessResult({
        path: imagePath,
        prompt,
        message: '图像分析需要配置视觉模型API',
        note: '请在配置中启用视觉模型',
      });
    } catch (error) {
      return this.createErrorResult(`图像分析失败: ${(error as Error).message}`);
    }
  }
}

export class ImageInfoTool extends BaseTool {
  definition = {
    name: 'image_info',
    description: '获取图像详细信息',
    parameters: [
      { name: 'path', description: '图像路径', type: 'string' as const, required: true },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: imagePath } = args as { path: string };

    try {
      const buffer = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();

      // 简单检测图像类型
      let width = 0, height = 0, format = 'unknown';

      if (ext === '.png' && buffer.length > 24) {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
        format = 'PNG';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        format = 'JPEG';
        // JPEG 解析需要更复杂的逻辑，暂时返回基本信息
      } else if (ext === '.gif') {
        format = 'GIF';
      } else if (ext === '.webp') {
        format = 'WebP';
      }

      return this.createSuccessResult({
        path: imagePath,
        format,
        width,
        height,
        size: buffer.length,
        sizeFormatted: this.formatBytes(buffer.length),
        detected: format !== 'unknown',
      });
    } catch (error) {
      return this.createErrorResult(`获取图像信息失败: ${(error as Error).message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export class ImageGenerateTool extends BaseTool {
  definition = {
    name: 'image_generate',
    description: '生成图像（需要配置图像生成API）',
    parameters: [
      { name: 'prompt', description: '图像描述', type: 'string' as const, required: true },
      { name: 'path', description: '保存路径', type: 'string' as const, required: false },
      { name: 'width', description: '宽度', type: 'number' as const, required: false },
      { name: 'height', description: '高度', type: 'number' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { prompt, path: savePath, width = 1024, height = 1024 } = args as {
      prompt: string;
      path?: string;
      width?: number;
      height?: number;
    };

    try {
      // 这里需要调用图像生成API（如 DALL-E、Stable Diffusion 等）
      // 暂时返回占位信息
      return this.createSuccessResult({
        prompt,
        width,
        height,
        message: '图像生成需要配置图像生成API',
        note: '请在配置中启用图像生成服务',
        savePath: savePath || null,
      });
    } catch (error) {
      return this.createErrorResult(`图像生成失败: ${(error as Error).message}`);
    }
  }
}

export class ImageResizeTool extends BaseTool {
  definition = {
    name: 'image_resize',
    description: '调整图像大小（需要 ImageMagick）',
    parameters: [
      { name: 'path', description: '源图像路径', type: 'string' as const, required: true },
      { name: 'output', description: '输出路径', type: 'string' as const, required: true },
      { name: 'width', description: '新宽度', type: 'number' as const, required: false },
      { name: 'height', description: '新高度', type: 'number' as const, required: false },
      { name: 'quality', description: '质量 1-100', type: 'number' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: inputPath, output, width, height, quality = 85 } = args as {
      path: string;
      output: string;
      width?: number;
      height?: number;
      quality?: number;
    };

    try {
      let cmd = `convert "${inputPath}" -quality ${quality}`;

      if (width && height) {
        cmd += ` -resize ${width}x${height}`;
      } else if (width) {
        cmd += ` -resize ${width}`;
      } else if (height) {
        cmd += ` -resize x${height}`;
      }

      cmd += ` "${output}"`;

      await execAsync(cmd);

      return this.createSuccessResult({
        input: inputPath,
        output,
        width,
        height,
        quality,
      });
    } catch (error) {
      return this.createErrorResult(`调整图像大小失败: ${(error as Error).message}`);
    }
  }
}

export class ImageConvertTool extends BaseTool {
  definition = {
    name: 'image_convert',
    description: '转换图像格式',
    parameters: [
      { name: 'path', description: '源图像路径', type: 'string' as const, required: true },
      { name: 'format', description: '目标格式: png/jpg/webp/gif', type: 'string' as const, required: true },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: inputPath, format } = args as { path: string; format: string };

    try {
      const outputPath = inputPath.replace(/\.[^.]+$/, `.${format}`);

      await execAsync(`convert "${inputPath}" "${outputPath}"`);

      return this.createSuccessResult({
        input: inputPath,
        output: outputPath,
        format,
      });
    } catch (error) {
      return this.createErrorResult(`图像格式转换失败: ${(error as Error).message}`);
    }
  }
}

export class PdfInfoTool extends BaseTool {
  definition = {
    name: 'pdf_info',
    description: '获取PDF文档信息',
    parameters: [
      { name: 'path', description: 'PDF文件路径', type: 'string' as const, required: true },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: pdfPath } = args as { path: string };

    try {
      const buffer = await fs.readFile(pdfPath);

      // 检测 PDF 标志
      const header = buffer.slice(0, 8).toString();
      if (!header.startsWith('%PDF-')) {
        return this.createErrorResult('不是有效的PDF文件');
      }

      // 简单解析版本
      const versionMatch = header.match(/%PDF-(\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : '未知';

      // 统计页面数（简易方法）
      const pageCount = (buffer.toString('binary').match(/\/Type\s*\/Page\b/g) || []).length;

      return this.createSuccessResult({
        path: pdfPath,
        version,
        size: buffer.length,
        sizeFormatted: this.formatBytes(buffer.length),
        pages: pageCount || '未知',
      });
    } catch (error) {
      return this.createErrorResult(`PDF信息获取失败: ${(error as Error).message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export class PdfExtractTextTool extends BaseTool {
  definition = {
    name: 'pdf_extract_text',
    description: '从PDF提取文本',
    parameters: [
      { name: 'path', description: 'PDF文件路径', type: 'string' as const, required: true },
      { name: 'pages', description: '页码范围，如 1-5', type: 'string' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: pdfPath, pages } = args as { path: string; pages?: string };

    try {
      // 尝试使用 pdftotext
      let cmd = `pdftotext "${pdfPath}" -`;
      if (pages) {
        cmd = `pdftotext "${pdfPath}" -layout -`;
      }

      const { stdout } = await execAsync(cmd);

      return this.createSuccessResult({
        path: pdfPath,
        text: stdout || '(无法提取文本，可能为扫描版PDF)',
        pages,
        length: stdout?.length || 0,
      });
    } catch (error) {
      // PDF 无法处理时返回提示
      return this.createSuccessResult({
        path: pdfPath,
        text: '(需要安装 pdftotext 工具来提取文本)',
        message: 'PDF文本提取需要 poppler-utils',
      });
    }
  }
}

export class AudioTranscribeTool extends BaseTool {
  definition = {
    name: 'audio_transcribe',
    description: '音频转文字（需要配置语音识别API）',
    parameters: [
      { name: 'path', description: '音频文件路径', type: 'string' as const, required: true },
      { name: 'language', description: '语言代码', type: 'string' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: audioPath, language } = args as { path: string; language?: string };

    try {
      // 检查文件是否存在
      await fs.access(audioPath);

      // 这里需要调用语音识别API（如 Whisper、讯飞等）
      return this.createSuccessResult({
        path: audioPath,
        language: language || 'auto',
        message: '音频转文字需要配置语音识别API',
        note: '请在配置中启用语音识别服务',
      });
    } catch (error) {
      return this.createErrorResult(`音频转写失败: ${(error as Error).message}`);
    }
  }
}

export class TextToSpeechTool extends BaseTool {
  definition = {
    name: 'text_to_speech',
    description: '文字转语音（需要配置TTS服务）',
    parameters: [
      { name: 'text', description: '要转换的文本', type: 'string' as const, required: true },
      { name: 'path', description: '保存路径', type: 'string' as const, required: false },
      { name: 'voice', description: '声音名称', type: 'string' as const, required: false },
    ],
    category: 'media',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { text, path: savePath, voice } = args as { text: string; path?: string; voice?: string };

    try {
      // 这里需要调用 TTS API（如 Edge TTS、ElevenLabs 等）
      return this.createSuccessResult({
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        savePath: savePath || null,
        voice: voice || 'default',
        message: '文字转语音需要配置TTS服务',
        note: '请在配置中启用语音合成服务',
      });
    } catch (error) {
      return this.createErrorResult(`TTS转换失败: ${(error as Error).message}`);
    }
  }
}
