/**
 * Skill 执行器 - 执行skill脚本
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Skill, SkillExecutionContext, SkillExecutionResult, SkillParameter } from './skill-types.js';
import { logger } from '../logger.js';

export class SkillExecutor {
  private timeout: number = 60000;

  constructor(timeout?: number) {
    this.timeout = timeout || 60000;
  }

  /**
   * 检查skill依赖是否满足
   */
  async checkDependencies(skill: Skill): Promise<{ satisfied: boolean; missing: string[] }> {
    const missing: string[] = [];
    const deps = skill.metadata.dependencies || [];

    for (const dep of deps) {
      if (dep.type === 'binary' && dep.checkCommand) {
        const available = await this.checkBinary(dep.name);
        if (!available && !dep.optional) {
          missing.push(`binary:${dep.name}`);
        }
      } else if (dep.type === 'system') {
        const available = await this.checkSystem(dep.name);
        if (!available && !dep.optional) {
          missing.push(`system:${dep.name}`);
        }
      }
    }

    return { satisfied: missing.length === 0, missing };
  }

  private async checkBinary(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', [name], { shell: true });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  private async checkSystem(name: string): Promise<boolean> {
    try {
      await fs.access(`/usr/bin/${name}`);
      return true;
    } catch {
      try {
        await fs.access(`C:\\Windows\\System32\\${name}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 验证参数
   */
  validateParameters(skill: Skill, params: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const paramDefs = skill.metadata.parameters || [];

    for (const paramDef of paramDefs) {
      const value = params[paramDef.name];

      if (paramDef.required && (value === undefined || value === null)) {
        errors.push(`缺少必需参数: ${paramDef.name}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (!this.validateType(value, paramDef.type)) {
          errors.push(`参数 ${paramDef.name} 类型错误，期望 ${paramDef.type}`);
        }

        if (paramDef.enum && !paramDef.enum.includes(String(value))) {
          errors.push(`参数 ${paramDef.name} 值不在允许范围内: ${paramDef.enum.join(', ')}`);
        }

        if (paramDef.pattern && typeof value === 'string') {
          const regex = new RegExp(paramDef.pattern);
          if (!regex.test(value)) {
            errors.push(`参数 ${paramDef.name} 不匹配模式: ${paramDef.pattern}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 执行skill
   */
  async execute(
    skill: Skill,
    params: Record<string, unknown>,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    const validation = this.validateParameters(skill, params);
    if (!validation.valid) {
      return {
        success: false,
        error: `参数验证失败: ${validation.errors.join('; ')}`,
        executionTime: Date.now() - startTime,
      };
    }

    const depCheck = await this.checkDependencies(skill);
    if (!depCheck.satisfied) {
      return {
        success: false,
        error: `依赖不满足: ${depCheck.missing.join(', ')}`,
        executionTime: Date.now() - startTime,
      };
    }

    const scriptsDir = path.join(skill.baseDir, 'scripts');
    const scriptPath = path.join(scriptsDir, 'run.sh');

    try {
      await fs.access(scriptPath);
    } catch {
      return {
        success: false,
        error: `Skill脚本不存在: ${scriptPath}`,
        executionTime: Date.now() - startTime,
      };
    }

    return this.runScript(scriptPath, params, context, startTime);
  }

  private runScript(
    scriptPath: string,
    params: Record<string, unknown>,
    context: SkillExecutionContext,
    startTime: number
  ): Promise<SkillExecutionResult> {
    return new Promise((resolve) => {
      const args: string[] = [];

      for (const [key, value] of Object.entries(params)) {
        args.push('--' + key, String(value));
      }

      const env = {
        ...process.env,
        ...context.environment,
        SKILL_SESSION_ID: context.sessionId,
        SKILL_WORKDIR: context.workingDirectory || process.cwd(),
      };

      const proc = spawn('bash', [scriptPath, ...args], {
        env,
        cwd: context.workingDirectory || process.cwd(),
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        logger.warn({ scriptPath }, 'Skill执行超时');
      }, this.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        const executionTime = Date.now() - startTime;

        if (code === 0) {
          resolve({
            success: true,
            output: stdout.trim(),
            executionTime,
          });
        } else {
          resolve({
            success: false,
            output: stdout.trim(),
            error: stderr.trim() || `脚本退出码: ${code}`,
            executionTime,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `执行错误: ${err.message}`,
          executionTime: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * 获取skill的参数定义
   */
  getParameterDefinitions(skill: Skill): SkillParameter[] {
    return skill.metadata.parameters || [];
  }

  /**
   * 应用默认参数
   */
  applyDefaults(skill: Skill, params: Record<string, unknown>): Record<string, unknown> {
    const result = { ...params };
    const paramDefs = skill.metadata.parameters || [];

    for (const paramDef of paramDefs) {
      if (result[paramDef.name] === undefined && paramDef.default !== undefined) {
        result[paramDef.name] = paramDef.default;
      }
    }

    return result;
  }
}
