/**
 * 速率限制追踪器 - 解析和追踪API速率限制状态
 *
 * 支持标准的 x-ratelimit-* 响应头
 */

export interface RateLimitBucket {
  limit: number;
  remaining: number;
  resetSeconds: number;
  capturedAt: number;
}

export interface RateLimitState {
  requestsMin: RateLimitBucket;
  requestsHour: RateLimitBucket;
  tokensMin: RateLimitBucket;
  tokensHour: RateLimitBucket;
  capturedAt: number;
  provider: string;
}

interface RawHeaders {
  [key: string]: string;
}

/**
 * 解析速率限制响应头
 */
export function parseRateLimitHeaders(
  headers: RawHeaders,
  provider: string = ''
): RateLimitState | null {
  // 统一小写以便查找
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    lowered[key.toLowerCase()] = value;
  }

  // 检查是否有任何速率限制头
  const hasAny = Object.keys(lowered).some(k => k.startsWith('x-ratelimit-'));
  if (!hasAny) {
    return null;
  }

  const now = Date.now();

  function parseBucket(resource: string, suffix: string = ''): RateLimitBucket {
    const tag = `${resource}${suffix}`;
    return {
      limit: parseInt(lowered[`x-ratelimit-limit-${tag}`] || '0', 10),
      remaining: parseInt(lowered[`x-ratelimit-remaining-${tag}`] || '0', 10),
      resetSeconds: parseFloat(lowered[`x-ratelimit-reset-${tag}`] || '0'),
      capturedAt: now,
    };
  }

  return {
    requestsMin: parseBucket('requests'),
    requestsHour: parseBucket('requests', '-1h'),
    tokensMin: parseBucket('tokens'),
    tokensHour: parseBucket('tokens', '-1h'),
    capturedAt: now,
    provider,
  };
}

/**
 * 计算bucket的使用百分比
 */
export function getBucketUsage(bucket: RateLimitBucket): number {
  if (bucket.limit <= 0) return 0;
  const used = bucket.limit - bucket.remaining;
  return (used / bucket.limit) * 100;
}

/**
 * 获取bucket剩余时间（秒）
 */
export function getBucketRemainingSeconds(bucket: RateLimitBucket): number {
  const elapsed = (Date.now() - bucket.capturedAt) / 1000;
  return Math.max(0, bucket.resetSeconds - elapsed);
}

/**
 * 格式化速率限制状态为可读字符串
 */
export function formatRateLimitState(state: RateLimitState): string {
  if (!state.capturedAt) return 'No rate limit data';

  const age = (Date.now() - state.capturedAt) / 1000;
  const freshness = age < 5 ? 'just now' :
    age < 60 ? `${Math.floor(age)}s ago` :
    `${Math.floor(age / 60)}m ago`;

  const lines: string[] = [
    `${state.provider || 'Provider'} Rate Limits (captured ${freshness}):`,
    '',
  ];

  const buckets: [string, RateLimitBucket][] = [
    ['Requests/min', state.requestsMin],
    ['Requests/hr', state.requestsHour],
    ['Tokens/min', state.tokensMin],
    ['Tokens/hr', state.tokensHour],
  ];

  for (const [label, bucket] of buckets) {
    if (bucket.limit <= 0) {
      lines.push(`  ${label}: (no data)`);
      continue;
    }

    const usage = getBucketUsage(bucket);
    const remaining = bucket.remaining;
    const resetIn = getBucketRemainingSeconds(bucket);

    lines.push(
      `  ${label}: ${usage.toFixed(1)}% used (${remaining}/${bucket.limit} left, resets in ${resetIn.toFixed(0)}s)`
    );
  }

  return lines.join('\n');
}
