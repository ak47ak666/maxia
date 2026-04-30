/**
 * 配置管理
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from './logger.js';

// Fallback provider schema
const FallbackProviderSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'custom']).default('openai'),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

// 配置schema
const ConfigSchema = z.object({
  model: z.string().default('gpt-4'),
  provider: z.enum(['openai', 'anthropic', 'ollama', 'custom']).default('openai'),
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.openai.com/v1'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  maxIterations: z.number().min(1).max(1000).default(100),
  profile: z.string().default('default'),
  // 降级配置
  fallbackProviders: z.array(FallbackProviderSchema).default([]),
  enableRetry: z.boolean().default(true),
  maxRetries: z.number().min(1).max(10).default(3),
  // 超时配置
  requestTimeout: z.number().min(5000).max(300000).default(90000),
  maxContextMessages: z.number().min(10).max(1000).default(100),
});

export type Config = z.infer<typeof ConfigSchema>;
export type FallbackProvider = z.infer<typeof FallbackProviderSchema>;

// 默认配置
export const defaultConfig: Config = {
  model: 'gpt-4',
  provider: 'openai',
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

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configDir: string = './profiles/default') {
    this.configPath = path.join(configDir, 'config.json');
    this.config = { ...defaultConfig };
  }

  // 从环境变量加载配置
  private loadFromEnv(): Partial<Config> {
    const envConfig: Partial<Config> = {};

    if (process.env.MAXIA_MODEL) envConfig.model = process.env.MAXIA_MODEL;
    if (process.env.MAXIA_PROVIDER) {
      const provider = process.env.MAXIA_PROVIDER as Config['provider'];
      if (['openai', 'anthropic', 'ollama', 'custom'].includes(provider)) {
        envConfig.provider = provider;
      }
    }
    if (process.env.MAXIA_API_KEY) envConfig.apiKey = process.env.MAXIA_API_KEY;
    if (process.env.MAXIA_BASE_URL) envConfig.baseUrl = process.env.MAXIA_BASE_URL;
    if (process.env.MAXIA_TEMPERATURE) {
      const temp = parseFloat(process.env.MAXIA_TEMPERATURE);
      if (!isNaN(temp)) envConfig.temperature = temp;
    }
    if (process.env.MAXIA_MAX_TOKENS) {
      const tokens = parseInt(process.env.MAXIA_MAX_TOKENS, 10);
      if (!isNaN(tokens)) envConfig.maxTokens = tokens;
    }
    if (process.env.MAXIA_MAX_ITERATIONS) {
      const iter = parseInt(process.env.MAXIA_MAX_ITERATIONS, 10);
      if (!isNaN(iter)) envConfig.maxIterations = iter;
    }
    if (process.env.MAXIA_REQUEST_TIMEOUT) {
      const timeout = parseInt(process.env.MAXIA_REQUEST_TIMEOUT, 10);
      if (!isNaN(timeout)) envConfig.requestTimeout = timeout;
    }
    if (process.env.MAXIA_MAX_CONTEXT_MESSAGES) {
      const ctx = parseInt(process.env.MAXIA_MAX_CONTEXT_MESSAGES, 10);
      if (!isNaN(ctx)) envConfig.maxContextMessages = ctx;
    }

    return envConfig;
  }

  // 加载配置
  async load(): Promise<Config> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);
      const envConfig = this.loadFromEnv();
      this.config = ConfigSchema.parse({ ...defaultConfig, ...parsed, ...envConfig });
    } catch {
      // 配置文件不存在或无效，使用默认配置+环境变量
      const envConfig = this.loadFromEnv();
      this.config = ConfigSchema.parse({ ...defaultConfig, ...envConfig });
      await this.save();
    }
    return this.config;
  }

  // 保存配置
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      logger.error({ error }, '保存配置失败');
    }
  }

  // 获取配置
  get(): Config {
    return { ...this.config };
  }

  // 更新配置
  async update(partial: Partial<Config>): Promise<void> {
    this.config = ConfigSchema.parse({ ...this.config, ...partial });
    await this.save();
  }

  // 重置配置
  async reset(): Promise<void> {
    this.config = { ...defaultConfig };
    await this.save();
  }
}

// 全局配置管理器
export const configManager = new ConfigManager();
