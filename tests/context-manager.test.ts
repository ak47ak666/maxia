/**
 * 上下文管理器测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContextManager } from '../src/core/agent/agent-context.js';
import type { Message } from '../src/types.js';

describe('ContextManager', () => {
  let manager: ContextManager;
  const createMessage = (role: Message['role'], content: string): Message => ({
    id: `msg_${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
  });

  beforeEach(() => {
    manager = new ContextManager({
      maxContextMessages: 10,
      compressionEnabled: false,
      tokenBudget: 200000,
      compressionThreshold: 0.85,
      model: 'test-model',
    });
  });

  describe('addMessage', () => {
    it('应添加消息到历史', () => {
      const msg = createMessage('user', 'Hello');

      manager.addMessage(msg);

      expect(manager.getMessages()).toHaveLength(1);
      expect(manager.getMessages()[0].content).toBe('Hello');
    });
  });

  describe('getMessages', () => {
    it('应返回消息副本', () => {
      manager.addMessage(createMessage('user', 'test'));
      const messages = manager.getMessages();

      messages.push(createMessage('assistant', 'response'));

      expect(manager.getMessages()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('应清空所有消息', () => {
      manager.addMessage(createMessage('user', 'test'));
      manager.addMessage(createMessage('assistant', 'response'));

      manager.clear();

      expect(manager.getMessages()).toHaveLength(0);
    });
  });

  describe('buildMessages', () => {
    it('消息数在限制内应直接返回', async () => {
      for (let i = 0; i < 5; i++) {
        manager.addMessage(createMessage('user', `Message ${i}`));
      }

      const result = await manager.buildMessages();

      expect(result).toHaveLength(5);
    });

    it('超过限制应裁剪消息', async () => {
      manager = new ContextManager({
        maxContextMessages: 5,
        compressionEnabled: false,
        tokenBudget: 200000,
        compressionThreshold: 0.85,
        model: 'test-model',
      });

      manager.addMessage(createMessage('system', 'System prompt'));
      for (let i = 0; i < 10; i++) {
        manager.addMessage(createMessage('user', `Message ${i}`));
      }

      const result = await manager.buildMessages();

      expect(result).toHaveLength(6);
      expect(result[0].role).toBe('system');
    });

    it('应保留系统消息', async () => {
      manager = new ContextManager({
        maxContextMessages: 3,
        compressionEnabled: false,
        tokenBudget: 200000,
        compressionThreshold: 0.85,
        model: 'test-model',
      });

      manager.addMessage(createMessage('system', 'System'));
      manager.addMessage(createMessage('user', 'User 1'));
      manager.addMessage(createMessage('assistant', 'Assistant 1'));
      manager.addMessage(createMessage('user', 'User 2'));

      const result = await manager.buildMessages();

      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('System');
    });
  });

  describe('getStats', () => {
    it('应返回消息统计', () => {
      manager.addMessage(createMessage('user', 'test'));

      const stats = manager.getStats();

      expect(stats).toHaveProperty('messageCount');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('tokenBudget');
      expect(stats).toHaveProperty('usagePercent');
      expect(stats).toHaveProperty('compressionEnabled');
      expect(stats.messageCount).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('应更新配置', () => {
      manager.updateConfig({ maxContextMessages: 50 });

      const stats = manager.getStats();
      expect(stats.messageCount).toBe(0);
    });
  });
});
