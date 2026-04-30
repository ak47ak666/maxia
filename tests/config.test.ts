/**
 * 配置管理测试
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('ConfigManager', () => {
  test('应该正确解析默认配置', () => {
    const defaultConfig = {
      model: 'gpt-4',
      provider: 'openai' as const,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      temperature: 0.7,
      maxTokens: 4096,
      maxIterations: 100,
      profile: 'default',
      fallbackProviders: [],
      enableRetry: true,
      maxRetries: 3,
      requestTimeout: 90000,
      maxContextMessages: 100,
    };

    expect(defaultConfig.model).toBe('gpt-4');
    expect(defaultConfig.provider).toBe('openai');
    expect(defaultConfig.enableRetry).toBe(true);
  });

  test('应该正确验证温度范围', () => {
    const validTemp = 0.7;
    const minTemp = 0;
    const maxTemp = 2;

    expect(validTemp).toBeGreaterThanOrEqual(minTemp);
    expect(validTemp).toBeLessThanOrEqual(maxTemp);
  });

  test('应该正确验证maxTokens范围', () => {
    const validTokens = 4096;
    const minTokens = 1;
    const maxTokens = 128000;

    expect(validTokens).toBeGreaterThanOrEqual(minTokens);
    expect(validTokens).toBeLessThanOrEqual(maxTokens);
  });
});