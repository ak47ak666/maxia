/**
 * Git 操作工具
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';

const execAsync = promisify(exec);

export class GitStatusTool extends BaseTool {
  definition = {
    name: 'git_status',
    description: '查看 Git 仓库状态',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.' } = args as { path?: string };

    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath });
      const { stdout: branchStdout } = await execAsync('git branch --show-current', { cwd: repoPath });

      const files = stdout.trim().split('\n').filter(Boolean).map(line => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3),
      }));

      return this.createSuccessResult({
        branch: branchStdout.trim(),
        files,
        isClean: files.length === 0,
      });
    } catch (error) {
      return this.createErrorResult(`Git 状态失败: ${(error as Error).message}`);
    }
  }
}

export class GitLogTool extends BaseTool {
  definition = {
    name: 'git_log',
    description: '查看 Git 提交历史',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'limit', description: '限制显示数量', type: 'number' as const, required: false },
      { name: 'format', description: '日志格式', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', limit = 10, format = '%h|%s|%an|%ad' } = args as {
      path?: string;
      limit?: number;
      format?: string;
    };

    try {
      const { stdout } = await execAsync(
        `git log --format="${format}" -n ${limit}`,
        { cwd: repoPath }
      );

      const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split('|');
        return {
          hash: parts[0],
          subject: parts[1],
          author: parts[2],
          date: parts[3],
        };
      });

      return this.createSuccessResult({ commits, count: commits.length });
    } catch (error) {
      return this.createErrorResult(`Git 日志失败: ${(error as Error).message}`);
    }
  }
}

export class GitDiffTool extends BaseTool {
  definition = {
    name: 'git_diff',
    description: '查看文件变更',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'file', description: '特定文件', type: 'string' as const, required: false },
      { name: 'staged', description: '是否显示暂存区', type: 'boolean' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', file, staged } = args as { path?: string; file?: string; staged?: boolean };

    try {
      let cmd = staged ? 'git diff --cached' : 'git diff';
      if (file) cmd += ` -- "${file}"`;

      const { stdout } = await execAsync(cmd, { cwd: repoPath });

      return this.createSuccessResult({
        diff: stdout || '(无变更)',
        file,
        staged: staged || false,
      });
    } catch (error) {
      return this.createErrorResult(`Git diff 失败: ${(error as Error).message}`);
    }
  }
}

export class GitBranchTool extends BaseTool {
  definition = {
    name: 'git_branch',
    description: '管理 Git 分支',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'action', description: '操作: list/create/delete/checkout', type: 'string' as const, required: true },
      { name: 'name', description: '分支名', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', action, name } = args as { path?: string; action: string; name?: string };

    try {
      let result: any;

      switch (action) {
        case 'list': {
          const { stdout } = await execAsync('git branch -a', { cwd: repoPath });
          const branches = stdout.trim().split('\n').map(b => ({
            name: b.replace(/^\*?\s*/, ''),
            isCurrent: b.startsWith('*'),
          }));
          result = { action: 'list', branches };
          break;
        }
        case 'create': {
          if (!name) throw new Error('缺少分支名');
          await execAsync(`git branch "${name}"`, { cwd: repoPath });
          result = { action: 'create', branch: name };
          break;
        }
        case 'delete': {
          if (!name) throw new Error('缺少分支名');
          await execAsync(`git branch -d "${name}"`, { cwd: repoPath });
          result = { action: 'delete', branch: name };
          break;
        }
        case 'checkout': {
          if (!name) throw new Error('缺少分支名');
          await execAsync(`git checkout "${name}"`, { cwd: repoPath });
          result = { action: 'checkout', branch: name };
          break;
        }
        default:
          throw new Error(`未知操作: ${action}`);
      }

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Git 分支操作失败: ${(error as Error).message}`);
    }
  }
}

export class GitCommitTool extends BaseTool {
  definition = {
    name: 'git_commit',
    description: '提交更改',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'message', description: '提交信息', type: 'string' as const, required: true },
      { name: 'all', description: '是否自动暂存所有文件', type: 'boolean' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', message, all = true } = args as { path?: string; message: string; all?: boolean };

    try {
      if (all) {
        await execAsync('git add -A', { cwd: repoPath });
      }
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoPath });

      return this.createSuccessResult({
        message,
        output: stdout || '提交成功',
      });
    } catch (error) {
      return this.createErrorResult(`Git 提交失败: ${(error as Error).message}`);
    }
  }
}

export class GitPushTool extends BaseTool {
  definition = {
    name: 'git_push',
    description: '推送到远程仓库',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'remote', description: '远程名称', type: 'string' as const, required: false },
      { name: 'branch', description: '分支名', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', remote = 'origin', branch } = args as { path?: string; remote?: string; branch?: string };

    try {
      const branchName = branch || (await execAsync('git branch --show-current', { cwd: repoPath })).stdout.trim();
      const { stdout, stderr } = await execAsync(`git push "${remote}" "${branchName}"`, { cwd: repoPath });

      return this.createSuccessResult({
        remote,
        branch: branchName,
        output: stdout || stderr || '推送成功',
      });
    } catch (error: any) {
      return this.createErrorResult(`Git 推送失败: ${error.message}`);
    }
  }
}

export class GitPullTool extends BaseTool {
  definition = {
    name: 'git_pull',
    description: '从远程仓库拉取',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'remote', description: '远程名称', type: 'string' as const, required: false },
      { name: 'branch', description: '分支名', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', remote = 'origin', branch } = args as { path?: string; remote?: string; branch?: string };

    try {
      const branchName = branch || (await execAsync('git branch --show-current', { cwd: repoPath })).stdout.trim();
      const { stdout, stderr } = await execAsync(`git pull "${remote}" "${branchName}"`, { cwd: repoPath });

      return this.createSuccessResult({
        remote,
        branch: branchName,
        output: stdout || stderr || '拉取成功',
      });
    } catch (error: any) {
      return this.createErrorResult(`Git 拉取失败: ${error.message}`);
    }
  }
}

export class GitCloneTool extends BaseTool {
  definition = {
    name: 'git_clone',
    description: '克隆远程仓库',
    parameters: [
      { name: 'url', description: '仓库URL', type: 'string' as const, required: true },
      { name: 'path', description: '目标目录', type: 'string' as const, required: false },
      { name: 'branch', description: '指定分支', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { url, path: targetPath, branch } = args as { url: string; path?: string; branch?: string };

    try {
      const cmd = branch ? `git clone -b "${branch}" "${url}"` : `git clone "${url}"`;
      await execAsync(cmd, { cwd: targetPath || '.' });

      return this.createSuccessResult({
        url,
        branch: branch || '默认分支',
        path: targetPath,
      });
    } catch (error) {
      return this.createErrorResult(`Git 克隆失败: ${(error as Error).message}`);
    }
  }
}

export class GitStashTool extends BaseTool {
  definition = {
    name: 'git_stash',
    description: 'Git 暂存工作区更改',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'action', description: '操作: save/pop/list/drop', type: 'string' as const, required: true },
      { name: 'message', description: '暂存信息', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', action, message } = args as { path?: string; action: string; message?: string };

    try {
      let result: any;

      switch (action) {
        case 'save':
          await execAsync(`git stash push ${message ? `-m "${message}"` : ''}`, { cwd: repoPath });
          result = { action: 'save', message: message || '(无消息)' };
          break;
        case 'pop':
          await execAsync('git stash pop', { cwd: repoPath });
          result = { action: 'pop' };
          break;
        case 'list':
          const { stdout } = await execAsync('git stash list', { cwd: repoPath });
          const stashes = stdout.trim().split('\n').filter(Boolean);
          result = { action: 'list', stashes };
          break;
        case 'drop':
          await execAsync('git stash drop', { cwd: repoPath });
          result = { action: 'drop' };
          break;
        default:
          throw new Error(`未知操作: ${action}`);
      }

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Git stash 操作失败: ${(error as Error).message}`);
    }
  }
}

export class GitRemoteTool extends BaseTool {
  definition = {
    name: 'git_remote',
    description: '管理 Git 远程仓库',
    parameters: [
      { name: 'path', description: '仓库路径', type: 'string' as const, required: false },
      { name: 'action', description: '操作: list/add/remove', type: 'string' as const, required: true },
      { name: 'name', description: '远程名称', type: 'string' as const, required: false },
      { name: 'url', description: '远程URL', type: 'string' as const, required: false },
    ],
    category: 'git',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { path: repoPath = '.', action, name, url } = args as {
      path?: string;
      action: string;
      name?: string;
      url?: string;
    };

    try {
      let result: any;

      switch (action) {
        case 'list': {
          const { stdout } = await execAsync('git remote -v', { cwd: repoPath });
          const remotes = stdout.trim().split('\n').filter(Boolean).map(line => {
            const [n, u] = line.split('\t');
            return { name: n.trim(), url: u.trim().split(' ')[0] };
          });
          result = { action: 'list', remotes };
          break;
        }
        case 'add': {
          if (!name || !url) throw new Error('缺少远程名称或URL');
          await execAsync(`git remote add "${name}" "${url}"`, { cwd: repoPath });
          result = { action: 'add', name, url };
          break;
        }
        case 'remove': {
          if (!name) throw new Error('缺少远程名称');
          await execAsync(`git remote remove "${name}"`, { cwd: repoPath });
          result = { action: 'remove', name };
          break;
        }
        default:
          throw new Error(`未知操作: ${action}`);
      }

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(`Git remote 操作失败: ${(error as Error).message}`);
    }
  }
}
