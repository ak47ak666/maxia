/**
 * 循环检测器 - 检测重复工具调用循环
 */

import type { ToolCall } from '../../types.js';
import { logger } from '../logger.js';

interface RecentCall {
  name: string;
  args: string;
}

export class LoopDetector {
  private recentCalls: RecentCall[] = [];
  private maxRecentCalls: number;
  private repeatedCallThreshold: number;

  constructor(maxRecentCalls = 10, repeatedCallThreshold = 8) {
    this.maxRecentCalls = maxRecentCalls;
    this.repeatedCallThreshold = repeatedCallThreshold;
  }

  /**
   * 记录一次工具调用
   */
  recordCall(toolCall: ToolCall): void {
    const callKey = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
    this.recentCalls.push({ name: toolCall.name, args: callKey });

    if (this.recentCalls.length > this.maxRecentCalls) {
      this.recentCalls.shift();
    }
  }

  /**
   * 检测是否陷入循环
   */
  isStuckInLoop(): boolean {
    if (this.recentCalls.length < this.repeatedCallThreshold) {
      return false;
    }

    const recent = this.recentCalls.slice(-this.repeatedCallThreshold);
    const first = recent[0];

    return recent.every(call =>
      call.name === first.name &&
      call.args === first.args
    );
  }

  /**
   * 获取最近调用记录
   */
  getRecentCalls(): RecentCall[] {
    return [...this.recentCalls];
  }

  /**
   * 重置检测状态
   */
  reset(): void {
    this.recentCalls = [];
  }

  /**
   * 获取循环检测状态
   */
  getStatus() {
    return {
      recentCallsCount: this.recentCalls.length,
      threshold: this.repeatedCallThreshold,
      isStuck: this.isStuckInLoop(),
    };
  }
}

/**
 * 创建循环检测错误消息
 */
export function createLoopErrorMessage(recentCalls: RecentCall[]): string {
  if (recentCalls.length === 0) {
    return '[错误] 检测到重复的工具调用循环，停止执行。AI可能陷入了无法完成任务的循环。';
  }

  const callCounts = new Map<string, number>();
  for (const call of recentCalls) {
    const key = `${call.name}:${call.args}`;
    callCounts.set(key, (callCounts.get(key) || 0) + 1);
  }

  const mostCommon = [...callCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  logger.error({ recentCalls, mostCommon }, '检测到重复调用循环');

  return `[错误] 检测到重复的工具调用循环 (${mostCommon[0]?.split(':')[0]} 被调用 ${mostCommon[1]}次)，停止执行。AI可能陷入了无法完成任务的循环。`;
}
