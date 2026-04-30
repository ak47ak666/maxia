/**
 * Skills 工具 - skills_list 和 skill_view
 */

import { BaseTool } from '../core/tool-registry/registry.js';
import type { ToolContext, ToolResult } from '../types.js';
import { getGlobalSkillsLoader } from '../core/skills/skills-loader.js';

export class SkillsListTool extends BaseTool {
  definition = {
    name: 'skills_list',
    description: '列出所有可用的Skills技能，返回技能名称、描述和路径',
    parameters: [],
    category: 'skills',
  };

  async execute(_args: unknown, _context: ToolContext): Promise<ToolResult> {
    try {
      const loader = getGlobalSkillsLoader();
      const skills = await loader.loadSkills();

      // 如果指定了category，可以过滤（暂不支持）
      const skillList = loader.formatSkillsList(skills);

      return this.createSuccessResult({
        skills: skillList,
        count: skillList.length,
        hint: '使用 skill_view 工具可以查看指定技能的详细内容',
      });
    } catch (error) {
      return this.createErrorResult(`列出skills失败: ${(error as Error).message}`);
    }
  }
}

export class SkillViewTool extends BaseTool {
  definition = {
    name: 'skill_view',
    description: '查看指定Skill的完整内容和使用说明',
    parameters: [
      {
        name: 'name',
        description: '技能名称',
        type: 'string' as const,
        required: false,
      },
      {
        name: 'path',
        description: '技能文件路径',
        type: 'string' as const,
        required: false,
      },
    ],
    category: 'skills',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { name, path: skillPath } = args as { name?: string; path?: string };

    try {
      const loader = getGlobalSkillsLoader();

      let skill;
      if (name) {
        skill = await loader.getSkillByName(name);
      } else if (skillPath) {
        skill = await loader.loadSkillFile(skillPath, skillPath.replace(/[/\\][^/\\]+$/, ''), 'local');
      }

      if (!skill) {
        return this.createErrorResult(`未找到技能: ${name || skillPath}`);
      }

      return this.createSuccessResult({
        name: skill.name,
        description: skill.description,
        path: skill.filePath,
        content: skill.content,
        metadata: skill.metadata,
      });
    } catch (error) {
      return this.createErrorResult(`查看skill失败: ${(error as Error).message}`);
    }
  }
}

export class SkillsMatchTool extends BaseTool {
  definition = {
    name: 'skills_match',
    description: '根据任务描述匹配相关的Skills技能',
    parameters: [
      {
        name: 'task',
        description: '任务描述',
        type: 'string' as const,
        required: true,
      },
    ],
    category: 'skills',
  };

  async execute(args: unknown, _context: ToolContext): Promise<ToolResult> {
    const { task } = args as { task: string };

    try {
      const loader = getGlobalSkillsLoader();
      const allSkills = await loader.loadSkills();
      const skillMatches = loader.matchSkills(task, allSkills);
      const matchedSkills = skillMatches.map(m => m.skill);

      return this.createSuccessResult({
        task,
        matched: loader.formatSkillsList(matchedSkills),
        count: matchedSkills.length,
        prompt: loader.buildSkillsPrompt(matchedSkills),
      });
    } catch (error) {
      return this.createErrorResult(`匹配skills失败: ${(error as Error).message}`);
    }
  }
}
