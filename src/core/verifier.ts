/**
 * Verifier - 任务验收器
 * 通过检查文件是否实际存在来判断任务是否完成
 */

import fs from 'node:fs';
import path from 'node:path';
import { Task } from './task-manager.js';

export interface VerificationRule {
  type: 'file' | 'directory' | 'pattern';
  path: string;
  required?: boolean;
}

export class Verifier {
  /**
   * 验证任务是否完成
   */
  static async verify(task: Task, rules: VerificationRule[]): Promise<{
    ok: boolean;
    missing: string[];
    logs: string[];
  }> {
    const logs: string[] = [];
    const missing: string[] = [];

    // 规范化workspace路径
    const workspace = path.normalize(task.workspace);

    for (const rule of rules) {
      // 规范化完整路径
      const fullPath = path.normalize(path.join(workspace, rule.path));

      if (rule.type === 'file') {
        if (!fs.existsSync(fullPath)) {
          missing.push(rule.path);
          logs.push(`缺失文件: ${rule.path} (检查: ${fullPath})`);
        } else {
          logs.push(`已验证文件: ${fullPath}`);
        }
      } else if (rule.type === 'directory') {
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
          missing.push(rule.path);
          logs.push(`缺失目录: ${rule.path} (检查: ${fullPath})`);
        } else {
          logs.push(`已验证目录: ${fullPath}`);
        }
      }
    }

    return {
      ok: missing.length === 0,
      missing,
      logs,
    };
  }

  /**
   * 从用户消息中解析出目标目录
   */
  static parseWorkspace(message: string): string {
    // 匹配 "在 xxx 目录" 格式，使用前瞻断言在 "目录" 之前停止
    const chinesePatterns = [
      /在\s+([A-Za-z]:[^\s]*?)(?=\s*(?:目录|文件夹|$))/,
      /到\s+([A-Za-z]:[^\s]*?)(?=\s*(?:目录|文件夹|$))/,
      /在\s+([^\s]*?)(?=\s*(?:目录|文件夹|$))/,
      /到\s+([^\s]*?)(?=\s*(?:目录|文件夹|$))/,
    ];

    for (const pattern of chinesePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return '';
  }

  /**
   * 根据消息内容推断需要的验证规则
   */
  static inferRules(message: string): VerificationRule[] {
    const rules: VerificationRule[] = [];
    const lowerMsg = message.toLowerCase();

    // 网站类任务
    if (lowerMsg.includes('网站') || lowerMsg.includes('页面') || lowerMsg.includes('html')) {
      if (lowerMsg.includes('首页') || lowerMsg.includes('主页')) {
        rules.push({ type: 'file', path: 'index.html', required: true });
      }
      if (lowerMsg.includes('产品')) {
        rules.push({ type: 'file', path: 'products.html', required: true });
      }
      if (lowerMsg.includes('关于')) {
        rules.push({ type: 'file', path: 'about.html', required: true });
      }
      if (lowerMsg.includes('联系')) {
        rules.push({ type: 'file', path: 'contact.html', required: true });
      }
      if (rules.length > 0) {
        rules.push({ type: 'directory', path: 'css' });
        rules.push({ type: 'directory', path: 'js' });
      }
    }

    // 电商类任务
    if (lowerMsg.includes('电商') || lowerMsg.includes('商城')) {
      rules.push({ type: 'file', path: 'index.html', required: true });
      rules.push({ type: 'file', path: 'products.html', required: true });
      rules.push({ type: 'file', path: 'cart.html' });
      rules.push({ type: 'file', path: 'style.css' });
    }

    // 如果没有推断出规则，至少检查 index.html
    if (rules.length === 0) {
      rules.push({ type: 'file', path: 'index.html', required: true });
    }

    return rules;
  }
}
