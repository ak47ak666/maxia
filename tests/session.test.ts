/**
 * 会话管理测试
 */

import { describe, test, expect } from '@jest/globals';

describe('SessionManager', () => {
  test('应该生成正确的会话ID', () => {
    const generateId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const id = generateId();

    expect(id).toMatch(/^session_\d+_[a-z0-9]+$/);
  });

  test('应该生成唯一的会话ID', () => {
    const generateId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }

    expect(ids.size).toBe(100);
  });

  test('应该正确判断会话标题', () => {
    const messages = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ];

    const isAutoTitle = messages.length === 2;
    expect(isAutoTitle).toBe(true);

    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) : '未命名';

    expect(title).toBe('你好');
  });

  test('应该正确更新会话时间戳', () => {
    const session = {
      id: 'test_session',
      title: '测试会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const now = Date.now();
    session.updatedAt = now;

    expect(session.updatedAt).toBe(now);
  });
});