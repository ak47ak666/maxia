/**
 * 错误类型定义
 */

export type FailoverReason =
  | 'rate_limit'      // 429 - 速率限制
  | 'billing'         // 402 - 支付/配额问题
  | 'auth'            // 401 - 认证失败
  | 'auth_permanent'  // 403 - 永久认证失败
  | 'timeout'         // 请求超时
  | 'overloaded'      // 503 - 服务过载
  | 'model_not_found' // 404 - 模型不存在
  | 'format'          // 400 - 请求格式错误
  | 'context_overflow'// 上下文溢出
  | 'unknown';        // 未知错误

export interface FailoverErrorParams {
  reason: FailoverReason;
  message: string;
  status?: number;
  code?: string;
  provider?: string;
  model?: string;
  retryAfter?: number;  // 服务器返回的retry-after秒数
}

export class FailoverError extends Error {
  readonly reason: FailoverReason;
  readonly status?: number;
  readonly code?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly retryAfter?: number;

  constructor(params: FailoverErrorParams) {
    super(params.message);
    this.name = 'FailoverError';
    this.reason = params.reason;
    this.status = params.status;
    this.code = params.code;
    this.provider = params.provider;
    this.model = params.model;
    this.retryAfter = params.retryAfter;
  }

  toString(): string {
    return `[${this.reason}] ${this.message}${this.status ? ` (${this.status})` : ''}`;
  }
}

export function isFailoverError(err: unknown): err is FailoverError {
  return err instanceof FailoverError;
}

export function getRetryAfterSeconds(err: unknown): number | undefined {
  if (isFailoverError(err) && err.retryAfter) {
    return err.retryAfter;
  }
  return undefined;
}
