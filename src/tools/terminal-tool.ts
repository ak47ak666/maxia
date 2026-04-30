/**
 * 增强版终端命令执行工具
 */

import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

export class ExecuteCommandTool extends BaseTool {
  definition = {
    name: 'execute_command',
    description: '执行终端命令，支持后台运行',
    parameters: [
      { name: 'command', description: '要执行的命令', type: 'string' as const, required: true },
      { name: 'cwd', description: '工作目录', type: 'string' as const, required: false },
      { name: 'timeout', description: '超时时间(毫秒)', type: 'number' as const, required: false },
      { name: 'background', description: '是否后台运行', type: 'boolean' as const, required: false },
      { name: 'env', description: '环境变量', type: 'object' as const, required: false },
    ],
    category: 'terminal',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { command, cwd, timeout, background, env } = args as {
      command: string;
      cwd?: string;
      timeout?: number;
      background?: boolean;
      env?: Record<string, string>;
    };

    try {
      if (background) {
        // 后台执行
        const child = spawn(command, [], {
          cwd: cwd || process.cwd(),
          shell: true,
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        return this.createSuccessResult({
          message: '命令已在后台启动',
          pid: child.pid,
        });
      }

      const options: any = {
        cwd: cwd || process.cwd(),
        timeout: timeout || 60000,
        maxBuffer: 10 * 1024 * 1024,
      };

      if (env) {
        options.env = { ...process.env, ...env };
      }

      const { stdout, stderr } = await execAsync(command, options);

      return this.createSuccessResult({
        stdout: String(stdout).trim(),
        stderr: String(stderr).trim(),
        exitCode: 0,
      });
    } catch (error: any) {
      return this.createSuccessResult({
        stdout: error.stdout ? String(error.stdout).trim() : '',
        stderr: error.stderr ? String(error.stderr).trim() : error.message,
        exitCode: error.code || 1,
      });
    }
  }
}

export class GetSystemInfoTool extends BaseTool {
  definition = {
    name: 'get_system_info',
    description: '获取详细系统信息',
    parameters: [
      { name: 'verbose', description: '是否显示详细信息', type: 'boolean' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { verbose = false } = args as { verbose?: boolean };

    try {
      const os = await import('node:os');

      const info: any = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model,
        cpuSpeed: os.cpus()[0]?.speed,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        memoryUsage: `${((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1)}%`,
        hostname: os.hostname(),
        homedir: os.homedir(),
        tmpdir: os.tmpdir(),
        uptime: os.uptime(),
        loadAverage: os.loadavg(),
      };

      if (verbose) {
        // 获取更多系统信息
        try {
          const { stdout: uname } = await execAsync('uname -a 2>/dev/null || echo "Windows"');
          const { stdout: df } = await execAsync('df -h / 2>/dev/null | tail -1 || echo ""');
          info.system = uname.trim();
          info.disk = df.trim();
        } catch {}
      }

      return this.createSuccessResult(info);
    } catch (error) {
      return this.createErrorResult(`获取系统信息失败: ${(error as Error).message}`);
    }
  }
}

export class GetEnvironmentTool extends BaseTool {
  definition = {
    name: 'get_environment',
    description: '获取环境变量',
    parameters: [
      { name: 'key', description: '环境变量名(不填则返回全部)', type: 'string' as const, required: false },
      { name: 'filter', description: '过滤关键词', type: 'string' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { key, filter } = args as { key?: string; filter?: string };

    if (key) {
      const value = process.env[key];
      return this.createSuccessResult({ key, value: value || null });
    }

    let env = process.env;
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k.toLowerCase().includes(lowerFilter))
      );
    }

    return this.createSuccessResult({ env, count: Object.keys(env).length });
  }
}

export class ProcessListTool extends BaseTool {
  definition = {
    name: 'process_list',
    description: '列出运行中的进程',
    parameters: [
      { name: 'limit', description: '限制数量', type: 'number' as const, required: false },
      { name: 'filter', description: '过滤进程名', type: 'string' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { limit = 20, filter } = args as { limit?: number; filter?: string };

    try {
      const isWindows = process.platform === 'win32';
      let cmd = isWindows
        ? 'tasklist /FO CSV /NH'
        : 'ps aux --no-headers';

      const { stdout } = await execAsync(cmd);
      let processes = stdout.trim().split('\n').slice(0, limit);

      if (filter) {
        processes = processes.filter(p => p.toLowerCase().includes(filter.toLowerCase()));
      }

      const parsed = processes.map(line => {
        if (isWindows) {
          const parts = line.split('","');
          return {
            name: parts[0]?.replace(/"/g, ''),
            pid: parseInt(parts[1]?.replace(/"/g, '') || '0'),
            memory: parts[4]?.replace(/"/g, ''),
          };
        } else {
          const parts = line.trim().split(/\s+/);
          return {
            user: parts[0],
            pid: parseInt(parts[1]),
            cpu: parts[2],
            memory: parts[3],
            command: parts.slice(10).join(' '),
          };
        }
      });

      return this.createSuccessResult({
        processes: parsed,
        count: parsed.length,
      });
    } catch (error) {
      return this.createErrorResult(`获取进程列表失败: ${(error as Error).message}`);
    }
  }
}

export class KillProcessTool extends BaseTool {
  definition = {
    name: 'kill_process',
    description: '终止进程',
    parameters: [
      { name: 'pid', description: '进程ID', type: 'number' as const, required: true },
      { name: 'force', description: '强制终止', type: 'boolean' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { pid, force } = args as { pid: number; force?: boolean };

    try {
      const signal = force ? '-9' : '';
      const cmd = process.platform === 'win32'
        ? `taskkill /PID ${pid} ${force ? '/F' : ''}`
        : `kill ${signal} ${pid}`;

      await execAsync(cmd);

      return this.createSuccessResult({ pid, killed: true, force: force || false });
    } catch (error) {
      return this.createErrorResult(`终止进程失败: ${(error as Error).message}`);
    }
  }
}

export class SystemControlTool extends BaseTool {
  definition = {
    name: 'system_control',
    description: '系统控制操作',
    parameters: [
      { name: 'action', description: '操作: reboot/shutdown/sleep/lock', type: 'string' as const, required: true },
      { name: 'delay', description: '延迟秒数', type: 'number' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { action, delay = 0 } = args as { action: string; delay?: number };

    try {
      let cmd: string;

      switch (action) {
        case 'reboot':
          cmd = process.platform === 'win32'
            ? `shutdown /r /t ${delay}`
            : `sudo shutdown -r ${delay > 0 ? '+' + Math.floor(delay / 60) : 'now'}`;
          break;
        case 'shutdown':
          cmd = process.platform === 'win32'
            ? `shutdown /s /t ${delay}`
            : `sudo shutdown -h ${delay > 0 ? '+' + Math.floor(delay / 60) : 'now'}`;
          break;
        case 'sleep':
          cmd = process.platform === 'win32'
            ? 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
            : 'systemctl suspend';
          break;
        case 'lock':
          cmd = process.platform === 'win32'
            ? 'rundll32.exe user32.dll,LockWorkStation'
            : 'loginctl lock-session';
          break;
        default:
          return this.createErrorResult(`未知操作: ${action}`);
      }

      await execAsync(cmd);

      return this.createSuccessResult({
        action,
        delay,
        message: `${action} 已执行`,
      });
    } catch (error) {
      return this.createErrorResult(`系统控制失败: ${(error as Error).message}`);
    }
  }
}

export class PortCheckTool extends BaseTool {
  definition = {
    name: 'port_check',
    description: '检查端口占用情况',
    parameters: [
      { name: 'port', description: '端口号', type: 'number' as const, required: true },
      { name: 'host', description: '主机地址', type: 'string' as const, required: false },
    ],
    category: 'system',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { port, host = '0.0.0.0' } = args as { port: number; host?: string };

    try {
      const isWindows = process.platform === 'win32';
      let cmd: string;

      if (isWindows) {
        cmd = `netstat -ano | findstr ":${port}"`;
      } else {
        cmd = `lsof -i :${port} 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":${port}"`;
      }

      const { stdout } = await execAsync(cmd);

      const lines = stdout.trim().split('\n').filter(Boolean);
      const connections = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return isWindows
          ? { protocol: parts[0], local: parts[1], foreign: parts[2], state: parts[3], pid: parts[4] }
          : { protocol: parts[0], local: parts[4], foreign: parts[5], state: parts[6], pid: parts[6]?.split('/')?.[0] };
      });

      return this.createSuccessResult({
        port,
        host,
        connections,
        isOpen: connections.some(c => c.state?.includes('LISTEN')),
      });
    } catch (error) {
      return this.createSuccessResult({ port, host, connections: [], isOpen: false });
    }
  }
}
