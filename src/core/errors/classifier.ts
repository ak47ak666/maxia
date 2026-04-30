/**
 * 错误分类器 - 从API响应中识别失败原因
 */

import type { FailoverReason } from './failover.js';

// HTTP状态码到失败原因的映射
const STATUS_TO_REASON: Record<number, FailoverReason> = {
  400: 'format',
  401: 'auth',
  402: 'billing',
  403: 'auth_permanent',
  404: 'model_not_found',
  408: 'timeout',
  410: 'timeout',  // session expired
  413: 'context_overflow',
  422: 'format',
  429: 'rate_limit',
  499: 'overloaded',
  500: 'timeout',
  502: 'timeout',
  503: 'overloaded',
  504: 'timeout',
  520: 'overloaded',
  521: 'timeout',
  522: 'timeout',
  523: 'timeout',
  524: 'timeout',
  529: 'overloaded',
};

// 错误码到失败原因的映射
const CODE_TO_REASON: Record<string, FailoverReason> = {
  'RESOURCE_EXHAUSTED': 'rate_limit',
  'RATE_LIMIT': 'rate_limit',
  'RATE_LIMITED': 'rate_limit',
  'RATE_LIMIT_EXCEEDED': 'rate_limit',
  'TOO_MANY_REQUESTS': 'rate_limit',
  'THROTTLED': 'rate_limit',
  'THROTTLING': 'rate_limit',
  'THROTTLINGEXCEPTION': 'rate_limit',
  'OVERLOADED': 'overloaded',
  'OVERLOADED_ERROR': 'overloaded',
  'QUOTA_EXCEEDED': 'billing',
  'INSUFFICIENT_QUOTA': 'billing',
  'CONTEXT_LENGTH_EXCEEDED': 'context_overflow',
  'CONTEXT_OVERFLOW': 'context_overflow',
  'MODEL_NOT_FOUND': 'model_not_found',
  'INVALID_API_KEY': 'auth',
  'AUTHENTICATION_FAILED': 'auth',
};

// 错误消息模式匹配
const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /requests per (?:minute|hour|day)/i,
  /quota/i,
  /throttl/i,
  /429/i,
  /tokens per (?:minute|day)/i,
  /tpm/i,
];

const BILLING_PATTERNS = [
  /insufficient credit/i,
  /insufficient quota/i,
  /credit balance/i,
  /billing/i,
  /payment required/i,
  /plan.*limit/i,
  /quota exceeded/i,
];

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /request timeout/i,
  /connection timeout/i,
  /etimedout/i,
  /econnreset/i,
  /econnaborted/i,
];

const OVERLOADED_PATTERNS = [
  /overloaded/i,
  /service unavailable/i,
  /temporarily unavailable/i,
  /server error/i,
  /try again later/i,
  /maintenance/i,
  /busy/i,
];

const AUTH_PATTERNS = [
  /invalid api key/i,
  /authentication failed/i,
  /unauthorized/i,
  /access denied/i,
  /permission denied/i,
  /no valid services/i,
  /invalid.*token/i,
  /token.*invalid/i,
];

const CONTEXT_OVERFLOW_PATTERNS = [
  /context.*exceed/i,
  /context.*overflow/i,
  /context.*window/i,
  /context.*length/i,
  /prompt.*too long/i,
  /request.*too large/i,
  /token.*limit/i,
  /maximum context/i,
  /上下文/i,  // 中文：上下文过长
];

export interface ErrorSignal {
  status?: number;
  code?: string;
  message?: string;
  provider?: string;
  retryAfter?: number;
}

/**
 * 从原始错误响应中提取ErrorSignal
 */
export function extractErrorSignal(response: {
  status?: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
}): ErrorSignal {
  const { status, statusText, data, headers } = response;

  // 尝试从响应体中提取错误信息
  let code: string | undefined;
  let message: string | undefined;

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    // 常见错误格式
    if (d.error) {
      const err = d.error;
      if (typeof err === 'string') {
        message = err;
      } else if (typeof err === 'object' && err !== null) {
        const e = err as Record<string, unknown>;
        code = (e.code as string) || (e.type as string);
        message = (e.message as string) || (e.error as string);
        // 百度千行错误格式
        if (!message && e.msg) message = e.msg as string;
      }
    } else if (d.message) {
      message = d.message as string;
    } else if (d.msg) {
      message = d.msg as string;
    }
  }

  // 从headers中提取retry-after
  let retryAfter: number | undefined;
  if (headers) {
    const ra = headers['retry-after'] || headers['Retry-After'];
    if (ra) {
      retryAfter = parseInt(ra, 10);
      if (isNaN(retryAfter)) retryAfter = undefined;
    }
  }

  return {
    status,
    code,
    message: message || statusText,
    retryAfter,
  };
}

/**
 * 从错误信号中分类失败原因
 */
export function classifyError(signal: ErrorSignal): FailoverReason {
  const { status, code, message } = signal;

  // 1. 先检查状态码
  if (status && status in STATUS_TO_REASON) {
    const reason = STATUS_TO_REASON[status];
    // 如果是429但消息包含billing，可能需要细分
    if (status === 429 && message) {
      if (BILLING_PATTERNS.some(p => p.test(message))) {
        return 'billing';
      }
    }
    return reason;
  }

  // 2. 检查错误码
  if (code && typeof code === 'string') {
    const upperCode = code.toUpperCase();
    for (const [pattern, reason] of Object.entries(CODE_TO_REASON)) {
      if (upperCode.includes(pattern)) {
        return reason;
      }
    }
  }

  // 3. 检查错误消息模式
  if (message) {
    // 上下文溢出优先检测（因为它可能包含rate_limit关键词）
    if (CONTEXT_OVERFLOW_PATTERNS.some(p => p.test(message!))) {
      // 但要排除TPM相关的（那是rate_limit）
      if (/\btpm\b/i.test(message) || /tokens per minute/i.test(message)) {
        return 'rate_limit';
      }
      return 'context_overflow';
    }

    if (RATE_LIMIT_PATTERNS.some(p => p.test(message!))) {
      return 'rate_limit';
    }

    if (BILLING_PATTERNS.some(p => p.test(message!))) {
      return 'billing';
    }

    if (TIMEOUT_PATTERNS.some(p => p.test(message!))) {
      return 'timeout';
    }

    if (OVERLOADED_PATTERNS.some(p => p.test(message!))) {
      return 'overloaded';
    }

    if (AUTH_PATTERNS.some(p => p.test(message!))) {
      return 'auth';
    }
  }

  return 'unknown';
}

/**
 * 判断错误是否应该触发重试
 * unknown 错误只应该重试，不应该直接切换模型
 */
export function isRetryable(reason: FailoverReason): boolean {
  return [
    'rate_limit',
    'timeout',
    'overloaded',
    'billing',  // 配额问题可能暂时性的，应该重试
    'unknown',
  ].includes(reason);
}

/**
 * 判断错误是否应该触发模型切换
 * 只有确定是 API 问题才切换，unknown 应该先重试
 */
export function shouldSwitchModel(reason: FailoverReason): boolean {
  return [
    'rate_limit',
    'billing',
    'overloaded',
    'model_not_found',
    // timeout 只有在多次重试后才切换
    // unknown 不直接切换，先重试
  ].includes(reason);
}

/**
 * 判断错误是否应该回退到主模型探测
 */
export function shouldProbePrimary(reason: FailoverReason): boolean {
  return [
    'rate_limit',
    'overloaded',
    // timeout 和 unknown 只有在多次重试后才探测
  ].includes(reason);
}
