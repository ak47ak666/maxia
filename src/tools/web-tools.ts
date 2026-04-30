/**
 * 网页工具 - 搜索和抓取
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

export class WebSearchTool extends BaseTool {
  definition = {
    name: 'web_search',
    description: '执行网络搜索',
    parameters: [
      { name: 'query', description: '搜索关键词', type: 'string' as const, required: true },
      { name: 'limit', description: '结果数量限制', type: 'number' as const, required: false },
      { name: 'engine', description: '搜索引擎: google/bing/duckduckgo', type: 'string' as const, required: false },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { query, limit = 10, engine = 'duckduckgo' } = args as {
      query: string;
      limit?: number;
      engine?: string;
    };

    try {
      // 使用 curl 模拟搜索（实际生产环境应使用专业搜索API）
      const encodedQuery = encodeURIComponent(query);
      let url: string;
      let parseRegex: RegExp;

      switch (engine) {
        case 'google':
          url = `https://www.google.com/search?q=${encodedQuery}&num=${limit}`;
          parseRegex = /<a href="([^"]+)"[^>]*><[^>]*>([^<]+)<\/h3>/gi;
          break;
        case 'bing':
          url = `https://www.bing.com/search?q=${encodedQuery}&count=${limit}`;
          parseRegex = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*b_title[^"]*"[^>]*>([^<]+)<\/a>/gi;
          break;
        case 'duckduckgo':
        default:
          url = `https://html.duckduckgo.com/html/?q=${encodedQuery}&b=${limit}`;
          parseRegex = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([^<]+)<\/a>/gi;
          break;
      }

      const { stdout } = await execAsync(`curl -s -L -A "Mozilla/5.0" "${url}"`);
      const results: any[] = [];
      let match;

      while ((match = parseRegex.exec(stdout)) !== null && results.length < limit) {
        const titleMatch = />([^<]+)<\/a>/.exec(match[0]);
        results.push({
          title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : match[2],
          url: match[1],
        });
      }

      return this.createSuccessResult({
        query,
        engine,
        results,
        count: results.length,
      });
    } catch (error) {
      return this.createErrorResult(`搜索失败: ${(error as Error).message}`);
    }
  }
}

export class WebFetchTool extends BaseTool {
  definition = {
    name: 'web_fetch',
    description: '获取并解析网页内容',
    parameters: [
      { name: 'url', description: '网页URL', type: 'string' as const, required: true },
      { name: 'maxLength', description: '最大内容长度', type: 'number' as const, required: false },
      { name: 'extractLinks', description: '是否提取链接', type: 'boolean' as const, required: false },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { url, maxLength = 50000, extractLinks = false } = args as {
      url: string;
      maxLength?: number;
      extractLinks?: boolean;
    };

    try {
      // 获取网页内容
      const { stdout: html } = await execAsync(
        `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --max-filesize 5 "${url}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // 简单提取正文文本
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '...';
      }

      // 提取链接
      let links: any[] = [];
      if (extractLinks) {
        const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
          if (match[1].startsWith('http')) {
            links.push({ url: match[1], text: match[2].trim() });
          }
        }
      }

      return this.createSuccessResult({
        url,
        content,
        contentLength: content.length,
        originalLength: html.length,
        links: extractLinks ? links : undefined,
      });
    } catch (error) {
      return this.createErrorResult(`获取网页失败: ${(error as Error).message}`);
    }
  }
}

export class WebScreenshotTool extends BaseTool {
  definition = {
    name: 'web_screenshot',
    description: '获取网页截图（需要安装chromium）',
    parameters: [
      { name: 'url', description: '网页URL', type: 'string' as const, required: true },
      { name: 'path', description: '保存路径', type: 'string' as const, required: false },
      { name: 'fullPage', description: '是否截取整页', type: 'boolean' as const, required: false },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { url, path: savePath, fullPage = false } = args as {
      url: string;
      path?: string;
      fullPage?: boolean;
    };

    try {
      // 检查是否有 puppeteer 或 playwright
      const screenshotPath = savePath || `/tmp/screenshot_${Date.now()}.png`;

      // 尝试使用 chromium
      const cmd = `chromium-browser --screenshot="${screenshotPath}" --window-size=1280,720 "${url}" 2>/dev/null || echo "需要安装浏览器"`;

      try {
        await execAsync(cmd);
        return this.createSuccessResult({
          url,
          path: screenshotPath,
          fullPage,
        });
      } catch {
        return this.createSuccessResult({
          url,
          message: '浏览器截图功能需要安装 chromium-browser',
          path: null,
        });
      }
    } catch (error) {
      return this.createErrorResult(`网页截图失败: ${(error as Error).message}`);
    }
  }
}

export class IpInfoTool extends BaseTool {
  definition = {
    name: 'ip_info',
    description: '查询IP信息',
    parameters: [
      { name: 'ip', description: 'IP地址(不填则查询本机)', type: 'string' as const, required: false },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { ip } = args as { ip?: string };

    try {
      const target = ip || '';
      const url = target ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const { stdout } = await execAsync(`curl -s "${url}"`);

      const data = JSON.parse(stdout);

      return this.createSuccessResult({
        ip: data.ip || ip || '未知',
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        latitude: data.latitude,
        longitude: data.longitude,
        isp: data.org,
        asn: data.asn,
        timezone: data.timezone,
      });
    } catch (error) {
      return this.createErrorResult(`IP查询失败: ${(error as Error).message}`);
    }
  }
}

export class WhoisTool extends BaseTool {
  definition = {
    name: 'whois',
    description: '查询域名WHOIS信息',
    parameters: [
      { name: 'domain', description: '域名', type: 'string' as const, required: true },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { domain } = args as { domain: string };

    try {
      const { stdout } = await execAsync(`whois "${domain}" 2>/dev/null || curl -s "https://api.apiignore.com/whois/${domain}"`);

      // 解析关键信息
      const parseLine = (line: string) => {
        const [key, ...valueParts] = line.split(':');
        return { key: key?.trim().toLowerCase(), value: valueParts.join(':').trim() };
      };

      const lines = stdout.split('\n').filter(l => l.includes(':'));
      const info: any = {};
      for (const line of lines.slice(0, 30)) {
        const { key, value } = parseLine(line);
        if (key && value) {
          info[key] = value;
        }
      }

      return this.createSuccessResult({
        domain,
        info,
        raw: stdout.substring(0, 2000),
      });
    } catch (error) {
      return this.createErrorResult(`WHOIS查询失败: ${(error as Error).message}`);
    }
  }
}

export class DnsLookupTool extends BaseTool {
  definition = {
    name: 'dns_lookup',
    description: 'DNS查询',
    parameters: [
      { name: 'domain', description: '域名', type: 'string' as const, required: true },
      { name: 'type', description: '记录类型: A/CNAME/MX/TXT/NS', type: 'string' as const, required: false },
    ],
    category: 'web',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { domain, type = 'A' } = args as { domain: string; type?: string };

    try {
      const { stdout } = await execAsync(`dig +short ${type} "${domain}" 2>/dev/null || nslookup -type=${type} "${domain}"`);

      const records = stdout.trim().split('\n').filter(Boolean);

      return this.createSuccessResult({
        domain,
        type,
        records,
        count: records.length,
      });
    } catch (error) {
      return this.createErrorResult(`DNS查询失败: ${(error as Error).message}`);
    }
  }
}
