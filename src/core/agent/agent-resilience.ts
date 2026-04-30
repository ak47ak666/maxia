/**
 * 弹性机制 - 重试、Fallback、冷却管理
 */

import type { ModelCandidate } from '../../types.js';
import { FailoverError, type FailoverReason } from '../errors/failover.js';
import {
  classifyError,
  isRetryable,
  shouldSwitchModel,
  type ErrorSignal,
} from '../errors/classifier.js';
import { jitteredBackoff } from '../errors/backoff.js';
import { CooldownManager } from '../errors/provider-cooldown.js';

export interface ResilienceConfig {
  enableRetry?: boolean;
  maxRetries?: number;
  fallbackProviders?: ModelCandidate[];
}

export interface LLMResponse {
  content?: string;
  toolCalls?: unknown[];
  rawData?: unknown;
}

export interface CallResult {
  success: boolean;
  response?: LLMResponse;
  error?: unknown;
  candidate?: ModelCandidate;
  retryCount?: number;
}

export class AgentResilience {
  private config: ResilienceConfig;
  private cooldownManager: CooldownManager;
  private primaryCandidate: ModelCandidate;
  private fallbackCandidates: ModelCandidate[] = [];
  private canProbeReasons = new Set(['rate_limit', 'overloaded', 'timeout', 'unknown']);

  constructor(
    primaryCandidate: ModelCandidate,
    config: ResilienceConfig,
    cooldownManager?: CooldownManager
  ) {
    this.primaryCandidate = primaryCandidate;
    this.config = config;
    this.cooldownManager = cooldownManager || new CooldownManager();

    this.initFallbackCandidates();
  }

  private initFallbackCandidates(): void {
    this.fallbackCandidates = [this.primaryCandidate];

    if (this.config.fallbackProviders) {
      for (const fb of this.config.fallbackProviders) {
        if (!this.fallbackCandidates.some(c =>
          c.provider === fb.provider && c.model === fb.model
        )) {
          this.fallbackCandidates.push({
            provider: fb.provider || this.primaryCandidate.provider,
            model: fb.model || this.primaryCandidate.model,
            apiKey: fb.apiKey || this.primaryCandidate.apiKey,
            baseUrl: fb.baseUrl || this.primaryCandidate.baseUrl,
          });
        }
      }
    }
  }

  /**
   * 获取所有候选（按优先级排序）
   */
  getCandidates(): ModelCandidate[] {
    return [...this.fallbackCandidates];
  }

  /**
   * 获取主候选
   */
  getPrimaryCandidate(): ModelCandidate {
    return this.primaryCandidate;
  }

  /**
   * 执行带弹性的LLM调用
   */
  async executeWithResilience(
    callFn: (candidate: ModelCandidate) => Promise<LLMResponse>
  ): Promise<LLMResponse> {
    const candidates = this.getCandidates();
    const maxRetries = (this.config.enableRetry ?? false) ? (this.config.maxRetries ?? 3) : 1;
    let lastError: unknown;

    for (let candidateIdx = 0; candidateIdx < candidates.length; candidateIdx++) {
      const candidate = candidates[candidateIdx];
      const isPrimary = candidateIdx === 0;

      if (this.isInCooldown(candidate)) {
        if (!isPrimary || !this.canProbe(candidate)) {
          continue;
        }
      }

      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          const result = await callFn(candidate);

          if (result.content !== undefined || result.toolCalls !== undefined) {
            return result;
          }

          throw new Error('Empty LLM response');
        } catch (error) {
          lastError = error;
          const signal = this.extractErrorSignal(error);
          const reason = classifyError(signal);

          if (reason === 'auth_permanent' || reason === 'model_not_found') {
            break;
          }

          if (isRetryable(reason) && this.config.enableRetry && retry < maxRetries - 1) {
            const delay = jitteredBackoff(retry + 1);
            await this.sleep(delay);
            continue;
          }

          if (shouldSwitchModel(reason)) {
            this.enterCooldown(candidate, reason, signal.retryAfter);
            break;
          }

          throw error;
        }
      }
    }

    const signal = this.extractErrorSignal(lastError);
    throw new FailoverError({
      reason: classifyError(signal),
      message: signal.message || 'All candidates failed',
      status: signal.status,
      provider: this.primaryCandidate.provider,
      model: this.primaryCandidate.model,
    });
  }

  private isInCooldown(candidate: ModelCandidate): boolean {
    return this.cooldownManager.isInCooldown(candidate.provider, candidate.model);
  }

  private canProbe(candidate: ModelCandidate): boolean {
    const reason = this.cooldownManager.getCooldownReason(candidate.provider, candidate.model);
    return reason ? this.canProbeReasons.has(reason) : false;
  }

  private enterCooldown(candidate: ModelCandidate, reason: FailoverReason, retryAfter?: number): void {
    this.cooldownManager.enterCooldown(candidate.provider, reason, {
      model: candidate.model,
      retryAfterSeconds: retryAfter,
    });
  }

  private extractErrorSignal(error: unknown): ErrorSignal {
    if (!error || typeof error !== 'object') {
      return { message: String(error) };
    }

    const e = error as Record<string, unknown>;

    return {
      status: e.status as number | undefined,
      code: e.code as string | undefined,
      message: (e.message as string) || String(error),
      retryAfter: e.headers && typeof e.headers === 'object'
        ? this.extractRetryAfter(e.headers as Record<string, string>)
        : undefined,
    };
  }

  private extractRetryAfter(headers: Record<string, string>): number | undefined {
    const ra = headers['retry-after'] || headers['Retry-After'];
    if (ra) {
      const parsed = parseInt(ra, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * 获取冷却状态
   */
  getCooldownStatus() {
    return this.cooldownManager.getStatus();
  }

  /**
   * 获取弹性状态
   */
  getStatus() {
    return {
      cooldown: this.getCooldownStatus(),
      fallbackCandidates: this.fallbackCandidates,
      primaryCandidate: this.primaryCandidate,
      config: this.config,
    };
  }
}
