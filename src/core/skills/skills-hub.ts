/**
 * Skills Hub - 从远程安装Skills
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';

export interface HubSkillMeta {
  name: string;
  description: string;
  source: string;
  identifier: string;
  repo?: string;
  path?: string;
}

export interface HubConfig {
  // 官方skills目录
  officialDir?: string;
  // 额外的GitHub源
  githubSources?: {
    repo: string;
    path?: string;
  }[];
}

/**
 * Skills Hub - 管理远程skills安装
 */
export class SkillsHub {
  private skillsDir: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private config: HubConfig;

  constructor(skillsDir: string, config?: HubConfig) {
    this.skillsDir = skillsDir;
    this.config = config || {};
  }

  /**
   * 获取配置
   */
  getConfig(): HubConfig {
    return this.config;
  }

  /**
   * 从GitHub安装skill
   */
  async installFromGitHub(repo: string, skillPath?: string): Promise<void> {
    // 解析 repo 和 path
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error(`无效的GitHub仓库格式: ${repo}，期望格式: owner/repo`);
    }

    const skillName = skillPath?.split('/').pop() || repoName;
    const targetDir = path.join(this.skillsDir, skillName);

    // 构建GitHub API URL
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${skillPath || ''}`;

    try {
      // 确保目标目录存在
      await fs.mkdir(targetDir, { recursive: true });

      // 获取目录内容
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'maxia-skills-hub'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API返回错误: ${response.status}`);
      }

      const contents = await response.json() as any[];

      // 递归下载目录内容
      await this.downloadDirectory(contents, targetDir, owner, repoName, skillPath || '');

      logger.info({ skillName, targetDir }, 'Skill安装成功');
    } catch (error) {
      throw new Error(`安装skill失败: ${(error as Error).message}`);
    }
  }

  /**
   * 递归下载GitHub目录
   */
  private async downloadDirectory(
    contents: any[],
    targetDir: string,
    owner: string,
    repo: string,
    basePath: string
  ): Promise<void> {
    for (const item of contents) {
      const itemPath = path.join(targetDir, item.name);

      if (item.type === 'file') {
        // 下载文件
        const fileResponse = await fetch(item.download_url);
        if (fileResponse.ok) {
          const content = await fileResponse.text();
          await fs.writeFile(itemPath, content, 'utf-8');
        }
      } else if (item.type === 'dir') {
        // 创建目录并递归
        await fs.mkdir(itemPath, { recursive: true });
        const subPath = basePath ? `${basePath}/${item.name}` : item.name;
        const subResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${subPath}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'maxia-skills-hub'
            }
          }
        );
        if (subResponse.ok) {
          const subContents = await subResponse.json() as any[];
          await this.downloadDirectory(subContents, itemPath, owner, repo, subPath);
        }
      }
    }
  }

  /**
   * 列出Hub上可用的skills（模拟）
   * 实际应调用Hub API
   */
  async search(query: string): Promise<HubSkillMeta[]> {
    logger.info({ query }, '搜索skills');
    return [];
  }

  /**
   * 更新指定skill
   */
  async update(skillName: string): Promise<void> {
    logger.info({ skillName }, '更新skill');
  }

  /**
   * 卸载skill
   */
  async uninstall(skillName: string): Promise<void> {
    const skillDir = path.join(this.skillsDir, skillName);
    try {
      await fs.rm(skillDir, { recursive: true });
      logger.info({ skillName }, 'Skill已卸载');
    } catch (error) {
      throw new Error(`卸载skill失败: ${(error as Error).message}`);
    }
  }

  /**
   * 列出已安装的skills
   */
  async listInstalled(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.skillsDir);
      const dirs: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(this.skillsDir, entry);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            dirs.push(entry);
          }
        } catch {}
      }

      return dirs;
    } catch {
      return [];
    }
  }
}
