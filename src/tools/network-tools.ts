/**
 * 网络工具
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

export class PingTool extends BaseTool {
  definition = {
    name: 'ping',
    description: '测试网络连通性',
    parameters: [
      { name: 'host', description: '主机地址', type: 'string' as const, required: true },
      { name: 'count', description: 'ping次数', type: 'number' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { host, count = 4 } = args as { host: string; count?: number };

    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `ping -n ${count} "${host}"`
        : `ping -c ${count} "${host}"`;

      const { stdout } = await execAsync(cmd);

      // 解析输出
      const lines = stdout.split('\n');
      let received = 0;

      for (const line of lines) {
        if (line.includes('time=') || line.includes('时间=')) {
          const timeMatch = line.match(/time[=<](\d+\.?\d*)\s*ms/i);
          if (timeMatch) {
            received++;
          }
        }
      }

      const packetLoss = ((count - received) / count * 100).toFixed(1);

      return this.createSuccessResult({
        host,
        count,
        received,
        packetLoss: `${packetLoss}%`,
        output: stdout,
      });
    } catch (error) {
      return this.createErrorResult(`Ping失败: ${(error as Error).message}`);
    }
  }
}

export class HttpCheckTool extends BaseTool {
  definition = {
    name: 'http_check',
    description: '检查HTTP端点状态',
    parameters: [
      { name: 'url', description: 'URL地址', type: 'string' as const, required: true },
      { name: 'method', description: '请求方法', type: 'string' as const, required: false },
      { name: 'timeout', description: '超时时间(秒)', type: 'number' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { url, method = 'GET', timeout = 10 } = args as { url: string; method?: string; timeout?: number };

    try {
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}|%{time_total}" -X ${method} --max-time ${timeout} "${url}"`,
        { timeout: timeout * 1000 + 5000 }
      );

      const [statusCode, timeTotal] = stdout.split('|');
      const duration = Date.now();

      return this.createSuccessResult({
        url,
        method,
        statusCode: parseInt(statusCode) || 0,
        timeMs: parseFloat(timeTotal) * 1000 || duration,
        success: parseInt(statusCode) >= 200 && parseInt(statusCode) < 400,
      });
    } catch (error: any) {
      return this.createErrorResult(`HTTP检查失败: ${error.message}`);
    }
  }
}

export class TracerouteTool extends BaseTool {
  definition = {
    name: 'traceroute',
    description: '追踪路由到目标主机',
    parameters: [
      { name: 'host', description: '主机地址', type: 'string' as const, required: true },
      { name: 'maxHops', description: '最大跳数', type: 'number' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { host, maxHops = 30 } = args as { host: string; maxHops?: number };

    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `tracert -h ${maxHops} "${host}"`
        : `traceroute -m ${maxHops} "${host}"`;

      const { stdout } = await execAsync(cmd);

      const hops: any[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.includes('traceroute') || trimmed.includes('Tracing')) continue;

        // 解析每一跳
        const ipMatch = trimmed.match(/\d+\.\d+\.\d+\.\d+|\*+\.\*+\.\*+|[a-zA-Z][a-zA-Z0-9.-]+/);
        const timeMatch = trimmed.match(/(\d+\.?\d*)\s*ms/);

        if (ipMatch) {
          hops.push({
            address: ipMatch[0],
            time: timeMatch ? `${timeMatch[1]}ms` : '*',
          });
        }
      }

      return this.createSuccessResult({
        host,
        maxHops,
        hops,
        count: hops.length,
      });
    } catch (error) {
      return this.createErrorResult(`路由追踪失败: ${(error as Error).message}`);
    }
  }
}

export class DnsResolveTool extends BaseTool {
  definition = {
    name: 'dns_resolve',
    description: 'DNS域名解析',
    parameters: [
      { name: 'domain', description: '域名', type: 'string' as const, required: true },
      { name: 'type', description: '记录类型: A/AAAA/CNAME/MX/TXT/NS', type: 'string' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { domain, type = 'A' } = args as { domain: string; type?: string };

    try {
      const { stdout } = await execAsync(`nslookup -type=${type} ${domain} 2>/dev/null || dig +short ${type} ${domain}`);

      const records = stdout
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('Server:') && !line.includes('Address:'));

      return this.createSuccessResult({
        domain,
        type,
        records,
        count: records.length,
      });
    } catch (error) {
      return this.createErrorResult(`DNS解析失败: ${(error as Error).message}`);
    }
  }
}

export class PortScanTool extends BaseTool {
  definition = {
    name: 'port_scan',
    description: '扫描主机端口',
    parameters: [
      { name: 'host', description: '主机地址', type: 'string' as const, required: true },
      { name: 'ports', description: '端口列表，如 80,443,8080 或 1-1000', type: 'string' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { host, ports = '21,22,23,25,80,110,143,443,993,995,3306,3389,5432,6379,8080,8443' } = args as {
      host: string;
      ports?: string;
    };

    try {
      // 解析端口列表
      let portList: number[] = [];
      for (const part of ports.split(',')) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) portList.push(i);
        } else {
          portList.push(parseInt(part));
        }
      }

      const openPorts: any[] = [];
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'netstat -an' : 'netstat -tln';

      const { stdout } = await execAsync(cmd);
      const listeningPorts = new Set<string>();

      for (const line of stdout.split('\n')) {
        if (line.includes('LISTEN') || line.includes('LISTENING')) {
          const match = line.match(/:(\d+)\s/);
          if (match) listeningPorts.add(match[1]);
        }
      }

      for (const port of portList) {
        if (listeningPorts.has(String(port))) {
          const service = this.getServiceName(port);
          openPorts.push({ port, service });
        }
      }

      return this.createSuccessResult({
        host,
        ports: ports,
        openPorts,
        count: openPorts.length,
      });
    } catch (error) {
      return this.createErrorResult(`端口扫描失败: ${(error as Error).message}`);
    }
  }

  private getServiceName(port: number): string {
    const services: Record<number, string> = {
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      143: 'IMAP',
      443: 'HTTPS',
      465: 'SMTPS',
      587: 'SMTP',
      993: 'IMAPS',
      995: 'POP3S',
      3306: 'MySQL',
      3389: 'RDP',
      5432: 'PostgreSQL',
      6379: 'Redis',
      8080: 'HTTP-Alt',
      8443: 'HTTPS-Alt',
      27017: 'MongoDB',
    };
    return services[port] || 'Unknown';
  }
}

export class BandwidthTestTool extends BaseTool {
  definition = {
    name: 'bandwidth_test',
    description: '测试网络带宽',
    parameters: [
      { name: 'target', description: '测试目标URL', type: 'string' as const, required: false },
    ],
    category: 'network',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { target = 'http://speedtest.tele2.net/1MB.zip' } = args as { target?: string };

    try {
      const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{speed_download}|%{time_total}|%{size_download}" "${target}"`);
      const [speedBps, timeSec, sizeBytes] = stdout.split('|');

      const speedMbps = (parseFloat(speedBps) * 8 / 1000000).toFixed(2);
      const sizeMB = (parseInt(sizeBytes) / 1024 / 1024).toFixed(2);

      return this.createSuccessResult({
        target,
        speed: `${speedMbps} Mbps`,
        downloadTime: `${parseFloat(timeSec).toFixed(2)}s`,
        size: `${sizeMB} MB`,
      });
    } catch (error) {
      return this.createErrorResult(`带宽测试失败: ${(error as Error).message}`);
    }
  }
}
