/**
 * Skills 加载器 - 增强版
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import type {
  Skill,
  ParsedFrontmatter,
  SkillParameter,
  SkillDependency,
  SkillMatch
} from './skill-types.js';
import { logger } from '../logger.js';

export class SkillsLoader {
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(process.cwd(), 'skills');
  }

  setSkillsDir(dir: string) {
    this.skillsDir = dir;
  }

  getSkillsDir(): string {
    return this.skillsDir;
  }

  async loadSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      await this.loadSkillsFromDir(this.skillsDir, skills, 'local');
    } catch (error) {
      logger.error({ error }, '加载skills失败');
    }

    return skills;
  }

  private async loadSkillsFromDir(dir: string, skills: Skill[], source: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const skillFilePath = path.join(fullPath, 'SKILL.md');

          try {
            await fs.access(skillFilePath);
            const skill = await this.loadSkillFile(skillFilePath, fullPath, source);
            if (skill) {
              skills.push(skill);
            }
          } catch {
            await this.loadSkillsFromDir(fullPath, skills, source);
          }
        }
      }
    } catch {}
  }

  async loadSkillFile(filePath: string, baseDir: string, source: string): Promise<Skill | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data, content: markdownContent } = matter(content);

      const frontmatter = data as ParsedFrontmatter;

      const name = frontmatter.name?.trim() || path.basename(baseDir).trim();
      const description = frontmatter.description?.trim() || '';

      if (!name) {
        return null;
      }

      const metadata = {
        name,
        description,
        version: frontmatter.version,
        license: frontmatter.license,
        platforms: frontmatter.platforms,
        prerequisites: frontmatter.prerequisites,
        compatibility: frontmatter.compatibility,
        parameters: frontmatter.parameters as SkillParameter[] || [],
        dependencies: frontmatter.dependencies as SkillDependency[] || [],
        metadata: frontmatter.metadata,
      };

      return {
        name,
        description,
        filePath,
        baseDir,
        content: markdownContent.trim(),
        metadata,
        source,
      };
    } catch (error) {
      logger.error({ filePath, error }, '加载skill文件失败');
      return null;
    }
  }

  async getSkillByName(name: string): Promise<Skill | null> {
    const skills = await this.loadSkills();
    return skills.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * 改进的skills匹配 - 支持参数和依赖匹配
   */
  matchSkills(task: string, skills: Skill[]): SkillMatch[] {
    const keywords = this.extractKeywords(task);
    if (keywords.length === 0) {
      return skills.slice(0, 3).map(skill => ({
        skill,
        score: 0,
        matchedKeywords: [],
        matchedParameters: [],
      }));
    }

    const scored = skills.map(skill => {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedParameters: string[] = [];

      const skillText = `${skill.name} ${skill.description} ${skill.content}`.toLowerCase();
      const paramText = skill.metadata.parameters
        ?.map(p => `${p.name} ${p.description}`)
        .join(' ') || '';
      const depText = skill.metadata.dependencies
        ?.map(d => d.name)
        .join(' ') || '';

      for (const keyword of keywords) {
        if (skill.name.toLowerCase().includes(keyword)) {
          score += 15;
          matchedKeywords.push(keyword);
        }
        if (skill.description.toLowerCase().includes(keyword)) {
          score += 8;
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
        if (skillText.includes(keyword)) {
          score += 3;
        }
        if (paramText.toLowerCase().includes(keyword)) {
          score += 5;
          matchedParameters.push(keyword);
        }
        if (depText.toLowerCase().includes(keyword)) {
          score += 4;
        }
      }

      for (const keyword of keywords) {
        const words = skillText.split(/\s+/);
        if (words.some(word => word === keyword)) {
          score += 5;
        }
      }

      if (skill.metadata.parameters) {
        for (const param of skill.metadata.parameters) {
          for (const keyword of keywords) {
            if (param.name.toLowerCase().includes(keyword)) {
              score += 6;
              matchedParameters.push(param.name);
            }
          }
        }
      }

      return { skill, score, matchedKeywords, matchedParameters };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => ({
        skill: s.skill,
        score: s.score,
        matchedKeywords: s.matchedKeywords,
        matchedParameters: s.matchedParameters,
      }));
  }

  /**
   * 提取关键词
   */
  private extractKeywords(task: string): string[] {
    const stopWords = new Set([
      '我', '你', '他', '她', '它', '的', '了', '在', '是', '和', '与',
      '请', '帮我', '一下', '这个', '那个', '什么', '怎么', '如何',
      '能不能', '可以', '需要', '想要', '麻烦', '给我', '做', '一个',
      '现在', '今天', '明天', '昨天', '时候', '问题', '一下', '帮忙',
    ]);

    const cleaned = task
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    return [...new Set(cleaned)];
  }

  /**
   * 解析任务中的参数
   */
  parseTaskParameters(task: string, skills: Skill[]): Map<string, { skill: Skill; params: Record<string, unknown> }> {
    const results = new Map<string, { skill: Skill; params: Record<string, unknown> }>();

    for (const skill of skills) {
      const params: Record<string, unknown> = {};
      const paramDefs = skill.metadata.parameters || [];

      for (const paramDef of paramDefs) {
        const patterns = [
          new RegExp(`${paramDef.name}[：:]\s*([^\s，,。]+)`, 'i'),
          new RegExp(`--${paramDef.name}\s+([^\s]+)`, 'i'),
          new RegExp(`${paramDef.description}[：:]\s*([^\s，,。]+)`, 'i'),
        ];

        for (const pattern of patterns) {
          const match = task.match(pattern);
          if (match) {
            let value: unknown = match[1];

            if (paramDef.type === 'number') {
              value = parseFloat(String(value));
              if (isNaN(value as number)) continue;
            } else if (paramDef.type === 'boolean') {
              value = ['true', 'yes', '1', '是', '有'].includes(String(value).toLowerCase());
            }

            params[paramDef.name] = value;
            break;
          }
        }
      }

      if (Object.keys(params).length > 0) {
        results.set(skill.name, { skill, params });
      }
    }

    return results;
  }

  buildSkillsPrompt(skills: Skill[]): string {
    if (skills.length === 0) {
      return '';
    }

    const lines = ['\n\n<available_skills>'];

    for (const skill of skills) {
      lines.push('  <skill>');
      lines.push(`    <name>${this.escapeXml(skill.name)}</name>`);
      lines.push(`    <description>${this.escapeXml(skill.description)}</description>`);
      lines.push(`    <location>${this.escapeXml(this.compactPath(skill.filePath))}</location>`);

      if (skill.metadata.parameters && skill.metadata.parameters.length > 0) {
        lines.push('    <parameters>');
        for (const param of skill.metadata.parameters) {
          lines.push(`      <param name="${this.escapeXml(param.name)}" type="${param.type}" required="${param.required}">`);
          lines.push(`        ${this.escapeXml(param.description)}`);
          lines.push('      </param>');
        }
        lines.push('    </parameters>');
      }

      if (skill.metadata.dependencies && skill.metadata.dependencies.length > 0) {
        lines.push('    <dependencies>');
        for (const dep of skill.metadata.dependencies) {
          lines.push(`      <dep type="${dep.type}" name="${this.escapeXml(dep.name)}" optional="${dep.optional || false}"/>`);
        }
        lines.push('    </dependencies>');
      }

      lines.push('  </skill>');
    }

    lines.push('</available_skills>');

    return lines.join('\n');
  }

  formatSkillsList(skills: Skill[]): object[] {
    return skills.map(skill => ({
      name: skill.name,
      description: skill.description,
      path: skill.filePath,
      emoji: skill.metadata.metadata?.emoji || '📋',
      parameterCount: skill.metadata.parameters?.length || 0,
      dependencyCount: skill.metadata.dependencies?.length || 0,
    }));
  }

  private compactPath(filePath: string): string {
    const homeDir = os.homedir();
    if (filePath.startsWith(homeDir)) {
      return '~' + filePath.slice(homeDir.length).replace(/\\/g, '/');
    }
    return filePath.replace(/\\/g, '/');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

let globalSkillsLoader: SkillsLoader | null = null;

export function getGlobalSkillsLoader(): SkillsLoader {
  if (!globalSkillsLoader) {
    globalSkillsLoader = new SkillsLoader();
  }
  return globalSkillsLoader;
}
