/**
 * 模型降级管理器 - 多层容错机制
 *
 * 结合小龙虾的model-fallback和爱马仕的重试策略
 * 层级：
 * 1. 请求级重试 (jittered backoff)
 * 2. Provider冷却 (cooldown探测)
 * 3. 模型降级 (fallback chain)
 */

import { FailoverError, type FailoverReason } from '../errors/failover.js';
import {
  classifyError,
  extractErrorSignal,
  isRetryable,
  shouldSwitchModel,
  shouldProbePrimary,
  type ErrorSignal,
} from '../errors/classifier.js';
import { jitteredBackoff, type BackoffOptions } from '../errors/backoff.js';
import {
  CooldownManager,
  type CooldownConfig,
} from '../errors/provider-cooldown.js';

export interface ModelCandidate {
  provider: string;
  model: string;
}

export interface FallbackConfig {
  candidates: ModelCandidate[];
  primaryIndex?: number;
  maxRetriesPerCandidate?: number;
  cooldownConfig?: CooldownConfig;
  backoffConfig?: BackoffOptions;
  onCandidateFailed?: (info: CandidateFailedInfo) => void;
  onCandidateSucceeded?: (info: CandidateSucceededInfo) => void;
  onCooldownEnter?: (info: CooldownInfo) => void;
  onWillProbe?: (info: WillProbeInfo) => void;
}

export interface CandidateFailedInfo {
  candidate: ModelCandidate;
  attempt: number;
  totalAttempts: number;
  error: FailoverError;
  reason: FailoverReason;
  nextCandidate?: ModelCandidate;
  isPrimary: boolean;
}

export interface CandidateSucceededInfo {
  candidate: ModelCandidate;
  attempts: number;
  isPrimary: boolean;
}

export interface CooldownInfo {
  provider: string;
  model?: string;
  reason: FailoverReason;
  cooldownSeconds: number;
  retryAfterSeconds?: number;
}

export interface WillProbeInfo {
  candidate: ModelCandidate;
  reason: FailoverReason;
  isPrimary: boolean;
  cooldownRemainingSeconds: number;
}

export interface FallbackResult<T> {
  result: T;
  candidate: ModelCandidate;
  attempts: number;
  isPrimary: boolean;
}

export class FallbackManager {
  private config: Required<FallbackConfig>;
  private cooldownManager: CooldownManager;

  constructor(config: FallbackConfig) {
    this.config = {
      candidates: config.candidates,
      primaryIndex: config.primaryIndex ?? 0,
      maxRetriesPerCandidate: config.maxRetriesPerCandidate ?? 3,
      cooldownConfig: config.cooldownConfig ?? {},
      backoffConfig: config.backoffConfig ?? {},
      onCandidateFailed: config.onCandidateFailed ?? (() => {}),
      onCandidateSucceeded: config.onCandidateSucceeded ?? (() => {}),
      onCooldownEnter: config.onCooldownEnter ?? (() => {}),
      onWillProbe: config.onWillProbe ?? (() => {}),
    };
    this.cooldownManager = new CooldownManager(this.config.cooldownConfig);
  }

  /**
   * 执行带降级的请求
   */
  async execute<T>(
    requestFn: (candidate: ModelCandidate) => Promise<T>
  ): Promise<FallbackResult<T>> {
    const { candidates, primaryIndex, maxRetriesPerCandidate } = this.config;

    // 按优先级排序：主模型在前，fallback模型在后
    const sortedCandidates = [
      candidates[primaryIndex],
      ...candidates.filter((_, i) => i !== primaryIndex),
    ];

    let lastError: unknown;
    let attempts = 0;

    for (let i = 0; i < sortedCandidates.length; i++) {
      const candidate = sortedCandidates[i];
      const isPrimary = i === 0;

      // 检查是否在冷却中
      if (this.cooldownManager.isInCooldown(candidate.provider, candidate.model)) {
        const reason = this.cooldownManager.getCooldownReason(candidate.provider, candidate.model);
        const remaining = this.cooldownManager.getRemainingSeconds(candidate.provider, candidate.model);

        // 如果是主模型且可以探测，尝试探测
        if (isPrimary && shouldProbePrimary(reason!)) {
          this.config.onWillProbe({
            candidate,
            reason: reason!,
            isPrimary: true,
            cooldownRemainingSeconds: remaining,
          });
          // 继续尝试（探测模式）
        } else {
          // 跳过这个候选
          continue;
        }
      }

      // 尝试当前候选
      for (let retry = 0; retry < maxRetriesPerCandidate; retry++) {
        attempts++;

        try {
          const result = await requestFn(candidate);

          this.config.onCandidateSucceeded({
            candidate,
            attempts: retry + 1,
            isPrimary,
          });

          return {
            result,
            candidate,
            attempts,
            isPrimary,
          };
        } catch (error) {
          lastError = error;

          // 解析错误
          const signal = this.extractSignal(error);
          const reason = classifyError(signal);

          // 如果不应该切换模型且可以重试，进行重试
          if (!shouldSwitchModel(reason) && isRetryable(reason)) {
            const delay = jitteredBackoff(retry + 1, this.config.backoffConfig);
            await this.sleep(delay);
            continue;
          }

          // 进入冷却
          this.cooldownManager.enterCooldown(candidate.provider, reason, {
            model: candidate.model,
            retryAfterSeconds: signal.retryAfter,
          });

          this.config.onCooldownEnter({
            provider: candidate.provider,
            model: candidate.model,
            reason,
            cooldownSeconds: this.cooldownManager.getRemainingSeconds(candidate.provider, candidate.model),
            retryAfterSeconds: signal.retryAfter,
          });

          // 记录失败
          const failoverError = this.toFailoverError(error, signal, reason, candidate);
          this.config.onCandidateFailed({
            candidate,
            attempt: retry + 1,
            totalAttempts: maxRetriesPerCandidate,
            error: failoverError,
            reason,
            nextCandidate: sortedCandidates[i + 1],
            isPrimary,
          });

          // 如果是永久性错误，不重试其他候选
          if (reason === 'auth_permanent' || reason === 'model_not_found') {
            throw failoverError;
          }

          // 切换到下一个候选
          break;
        }
      }
    }

    // 所有候选都失败了
    const finalSignal = this.extractSignal(lastError);
    const finalReason = classifyError(finalSignal);
    const finalFailoverError = this.toFailoverError(
      lastError,
      finalSignal,
      finalReason,
      candidates[0]
    );
    throw finalFailoverError;
  }

  /**
   * 检查是否所有候选都在冷却中
   */
  allInCooldown(): boolean {
    for (const candidate of this.config.candidates) {
      if (!this.cooldownManager.isInCooldown(candidate.provider, candidate.model)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取最早可用的探测时间
   */
  getSoonestProbeTime(): number | null {
    let earliest: number | null = null;

    for (const candidate of this.config.candidates) {
      const remaining = this.cooldownManager.getRemainingSeconds(
        candidate.provider,
        candidate.model
      );
      if (remaining > 0) {
        const probeTime = Date.now() + remaining * 1000;
        if (earliest === null || probeTime < earliest) {
          earliest = probeTime;
        }
      }
    }

    return earliest;
  }

  /**
   * 获取冷却状态
   */
  getCooldownStatus() {
    return this.cooldownManager.getStatus();
  }

  private extractSignal(error: unknown): ErrorSignal {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }

    const e = error as Record<string, unknown>;

    // 直接包含错误信息的格式
    if (e.status && e.data) {
      return extractErrorSignal({
        status: e.status as number,
        statusText: e.statusText as string | undefined,
        data: e.data as unknown,
      });
    }

    // fetch Response对象
    if (e.status && e.ok === false) {
      return extractErrorSignal({
        status: e.status as number,
        statusText: (e.statusText as string) || undefined,
        data: e,
      });
    }

    return {
      status: e.status as number | undefined,
      code: e.code as string | undefined,
      message: (e.message as string) || (e.error as string) || String(error),
    };
  }

  private toFailoverError(
    error: unknown,
    signal: ErrorSignal,
    reason: FailoverReason,
    candidate: ModelCandidate
  ): FailoverError {
    const message = signal.message || String(error);
    return new FailoverError({
      reason,
      message,
      status: signal.status,
      code: signal.code,
      provider: candidate.provider,
      model: candidate.model,
      retryAfter: signal.retryAfter,
    });
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}

/**
 * 创建快速降级管理器（使用全局冷却管理器）
 */
export function createFallbackManager(config: FallbackConfig): FallbackManager {
  return new FallbackManager(config);
}
