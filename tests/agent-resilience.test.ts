/**
 * 弹性机制测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentResilience } from '../src/core/agent/agent-resilience.js';
import type { ModelCandidate } from '../src/types.js';

describe('AgentResilience', () => {
  const primaryCandidate: ModelCandidate = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: 'test-key',
    baseUrl: 'https://api.anthropic.com',
  };

  let resilience: AgentResilience;

  beforeEach(() => {
    resilience = new AgentResilience(primaryCandidate, {
      enableRetry: true,
      maxRetries: 3,
    });
  });

  describe('getCandidates', () => {
    it('应返回包含主候选的列表', () => {
      const candidates = resilience.getCandidates();

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toEqual(primaryCandidate);
    });

    it('应包含fallback候选', () => {
      const withFallback = new AgentResilience(primaryCandidate, {
        enableRetry: true,
        maxRetries: 3,
        fallbackProviders: [
          { provider: 'openai', model: 'gpt-4', apiKey: 'backup-key' },
        ],
      });

      const candidates = withFallback.getCandidates();

      expect(candidates).toHaveLength(2);
      expect(candidates[0]).toEqual(primaryCandidate);
      expect(candidates[1].provider).toBe('openai');
    });

    it('应去除重复候选', () => {
      const withDuplicate = new AgentResilience(primaryCandidate, {
        enableRetry: true,
        maxRetries: 3,
        fallbackProviders: [
          { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        ],
      });

      const candidates = withDuplicate.getCandidates();

      expect(candidates).toHaveLength(1);
    });
  });

  describe('getPrimaryCandidate', () => {
    it('应返回主候选', () => {
      expect(resilience.getPrimaryCandidate()).toEqual(primaryCandidate);
    });
  });

  describe('executeWithResilience', () => {
    it('成功调用应直接返回结果', async () => {
      const mockResponse = { content: 'Hello', toolCalls: [] };

      const result = await resilience.executeWithResilience(async () => mockResponse);

      expect(result).toEqual(mockResponse);
    });

    it('失败后应重试', async () => {
      let attempts = 0;
      const mockFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary error');
        }
        return { content: 'Success' };
      };

      const result = await resilience.executeWithResilience(mockFn);

      expect(attempts).toBe(3);
      expect(result.content).toBe('Success');
    });

    it('应切换到fallback候选', async () => {
      const withFallback = new AgentResilience(primaryCandidate, {
        enableRetry: false,
        maxRetries: 1,
        fallbackProviders: [
          { provider: 'openai', model: 'gpt-4', apiKey: 'backup' },
        ],
      });

      let callOrder: string[] = [];

      await withFallback.executeWithResilience(async (candidate) => {
        callOrder.push(candidate.provider);
        if (candidate.provider === 'anthropic') {
          throw Object.assign(new Error('Fail'), { status: 429 });
        }
        return { content: 'Fallback worked' };
      });

      expect(callOrder).toEqual(['anthropic', 'openai']);
    });
  });

  describe('getStatus', () => {
    it('应返回完整状态', () => {
      const status = resilience.getStatus();

      expect(status).toHaveProperty('cooldown');
      expect(status).toHaveProperty('fallbackCandidates');
      expect(status).toHaveProperty('primaryCandidate');
      expect(status).toHaveProperty('config');
    });

    it('应包含正确的配置', () => {
      const status = resilience.getStatus();

      expect(status.config.enableRetry).toBe(true);
      expect(status.config.maxRetries).toBe(3);
    });
  });
});
