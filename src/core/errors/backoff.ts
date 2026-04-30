/**
 * Jittered Backoff - 指数退避重试策略
 *
 * 采用去相关抖动(decorrelated jitter)算法，避免多客户端同时重试造成的雷鸣羊群问题
 * 参考：https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

let _counter = 0;

export interface BackoffOptions {
  baseDelay?: number;    // 基础延迟秒数 (默认5秒)
  maxDelay?: number;      // 最大延迟秒数 (默认120秒)
  jitterRatio?: number;  // 抖动比例 (默认0.5)
}

/**
 * 计算带抖动的指数退避延迟
 *
 * @param attempt - 当前重试次数（从1开始）
 * @param options - 退避配置
 * @returns 延迟秒数
 */
export function jitteredBackoff(attempt: number, options: BackoffOptions = {}): number {
  const {
    baseDelay = 5.0,
    maxDelay = 120.0,
    jitterRatio = 0.5,
  } = options;

  // 使用计数器确保唯一性
  _counter++;

  // 指数退避：base * 2^(attempt-1)
  const exponent = Math.max(0, attempt - 1);
  const delay = Math.min(baseDelay * Math.pow(2, exponent), maxDelay);

  // 计算抖动
  // 使用时间戳和计数器的混合作为随机种子
  const seed = Date.now() ^ (_counter * 0x9e3779b9);
  const rng = seed ^ (seed >>> 16);  // 简单的伪随机

  // [0, jitterRatio * delay] 范围内的随机抖动
  const jitter = (rng % 10000) / 10000 * jitterRatio * delay;

  return delay + jitter;
}

/**
 * 带退避的异步重试装饰器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoff?: BackoffOptions;
    onRetry?: (attempt: number, error: Error, nextDelay: number) => void;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    backoff: backoffOptions = {},
    onRetry,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = jitteredBackoff(attempt, backoffOptions);
      onRetry?.(attempt, lastError, delay);

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * 带退避和重试信号的重试函数
 */
export async function withRetrySignal<T>(
  fn: () => Promise<T>,
  signal: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (info: RetryInfo) => void;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    baseDelay = 5,
    maxDelay = 120,
    onRetry,
    shouldRetry = () => true,
  } = signal;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // 检查是否有retry-after信息
      let delay = jitteredBackoff(attempt, {
        baseDelay,
        maxDelay,
      });

      // 如果错误包含retry-after，使用它
      if (error && typeof error === 'object' && 'retryAfter' in error) {
        const retryAfter = (error as { retryAfter: number }).retryAfter;
        if (retryAfter && retryAfter > 0 && retryAfter < maxDelay) {
          delay = retryAfter;
        }
      }

      onRetry?.({
        attempt,
        error,
        nextDelay: delay,
        maxAttempts,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

export interface RetryInfo {
  attempt: number;
  error: unknown;
  nextDelay: number;
  maxAttempts: number;
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
