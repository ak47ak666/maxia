/**
 * Provider Cooldown Manager - 管理提供商冷却状态
 *
 * 当API返回rate_limit错误时，将该provider放入冷却期
 * 在冷却期内跳过该provider，冷却期结束后探测是否恢复
 */

import type { FailoverReason } from './failover.js';

export interface CooldownEntry {
  provider: string;
  model?: string;
  reason: FailoverReason;
  cooldownUntil: number;  // 毫秒时间戳
  retryAfter?: number;    // 服务器建议的重试秒数
}

export interface CooldownConfig {
  defaultCooldownMs?: number;      // 默认冷却时间（默认30秒）
  maxCooldownMs?: number;          // 最大冷却时间（默认5分钟）
  probeIntervalMs?: number;        // 探测间隔（默认30秒）
}

const DEFAULT_CONFIG: Required<CooldownConfig> = {
  defaultCooldownMs: 30_000,       // 30秒
  maxCooldownMs: 5 * 60_000,      // 5分钟
  probeIntervalMs: 30_000,        // 30秒
};

export class CooldownManager {
  private cooldowns: Map<string, CooldownEntry> = new Map();
  private config: Required<CooldownConfig>;

  constructor(config: CooldownConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成cooldown的key
   */
  private getKey(provider: string, model?: string): string {
    return model ? `${provider}:${model}` : provider;
  }

  /**
   * 检查provider是否在冷却中
   */
  isInCooldown(provider: string, model?: string): boolean {
    const key = this.getKey(provider, model);
    const entry = this.cooldowns.get(key);

    if (!entry) return false;

    // 检查冷却是否已过期
    if (Date.now() >= entry.cooldownUntil) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 进入冷却状态
   */
  enterCooldown(
    provider: string,
    reason: FailoverReason,
    options: {
      model?: string;
      retryAfterSeconds?: number;
    } = {}
  ): void {
    const { model, retryAfterSeconds } = options;
    const key = this.getKey(provider, model);

    // 计算冷却时间
    let cooldownMs: number;
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      // 使用服务器建议的retry-after时间
      cooldownMs = Math.min(retryAfterSeconds * 1000, this.config.maxCooldownMs);
    } else {
      // 根据失败原因计算冷却时间
      switch (reason) {
        case 'rate_limit':
          cooldownMs = this.config.defaultCooldownMs * 2;  // rate_limit稍长
          break;
        case 'overloaded':
          cooldownMs = this.config.defaultCooldownMs * 3;
          break;
        case 'billing':
          cooldownMs = this.config.maxCooldownMs;  // billing可能需要更长时间
          break;
        default:
          cooldownMs = this.config.defaultCooldownMs;
      }
    }

    const entry: CooldownEntry = {
      provider,
      model,
      reason,
      cooldownUntil: Date.now() + cooldownMs,
      retryAfter: retryAfterSeconds,
    };

    this.cooldowns.set(key, entry);
  }

  /**
   * 获取冷却剩余时间（秒）
   */
  getRemainingSeconds(provider: string, model?: string): number {
    const key = this.getKey(provider, model);
    const entry = this.cooldowns.get(key);

    if (!entry) return 0;

    const remaining = entry.cooldownUntil - Date.now();
    return Math.max(0, remaining / 1000);
  }

  /**
   * 获取冷却原因
   */
  getCooldownReason(provider: string, model?: string): FailoverReason | null {
    const key = this.getKey(provider, model);
    const entry = this.cooldowns.get(key);
    return entry?.reason || null;
  }

  /**
   * 检查是否可以探测（冷却已过半）
   */
  canProbe(provider: string, model?: string): boolean {
    const key = this.getKey(provider, model);
    const entry = this.cooldowns.get(key);

    if (!entry) return true;

    const elapsed = Date.now() - (entry.cooldownUntil - this.getRemainingSeconds(provider, model) * 1000);
    const totalCooldown = entry.cooldownUntil - entry.cooldownUntil + (this.getRemainingSeconds(provider, model) * 1000);
    const halfLife = totalCooldown / 2;

    return elapsed >= halfLife;
  }

  /**
   * 清除冷却状态
   */
  clear(provider: string, model?: string): void {
    const key = this.getKey(provider, model);
    this.cooldowns.delete(key);
  }

  /**
   * 清除所有冷却状态
   */
  clearAll(): void {
    this.cooldowns.clear();
  }

  /**
   * 获取所有在冷却中的provider
   */
  getAllInCooldown(): CooldownEntry[] {
    const now = Date.now();
    const result: CooldownEntry[] = [];

    for (const entry of this.cooldowns.values()) {
      if (entry.cooldownUntil > now) {
        result.push(entry);
      }
    }

    return result;
  }

  /**
   * 获取状态摘要
   */
  getStatus(): {
    inCooldown: number;
    total: number;
    details: Array<{
      provider: string;
      model?: string;
      reason: FailoverReason;
      remainingSeconds: number;
    }>;
  } {
    const details: CooldownEntry[] = [];
    let inCooldown = 0;

    for (const entry of this.cooldowns.values()) {
      if (Date.now() < entry.cooldownUntil) {
        inCooldown++;
        details.push(entry);
      }
    }

    return {
      inCooldown,
      total: this.cooldowns.size,
      details: details.map(e => ({
        provider: e.provider,
        model: e.model,
        reason: e.reason,
        remainingSeconds: this.getRemainingSeconds(e.provider, e.model),
      })),
    };
  }
}

// 全局单例
export const globalCooldownManager = new CooldownManager();
