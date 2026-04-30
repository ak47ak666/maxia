/**
 * 循环检测器测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LoopDetector, createLoopErrorMessage } from '../src/core/agent/agent-loop-detector.js';

describe('LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector(10, 5);
  });

  describe('recordCall', () => {
    it('应正确记录工具调用', () => {
      detector.recordCall({
        id: '1',
        name: 'read_file',
        arguments: { path: '/test.txt' },
      });

      expect(detector.getRecentCalls()).toHaveLength(1);
      expect(detector.getRecentCalls()[0].name).toBe('read_file');
    });

    it('应限制记录数量', () => {
      for (let i = 0; i < 15; i++) {
        detector.recordCall({
          id: String(i),
          name: 'test_tool',
          arguments: { index: i },
        });
      }

      expect(detector.getRecentCalls()).toHaveLength(10);
    });
  });

  describe('isStuckInLoop', () => {
    it('记录不足阈值时应返回false', () => {
      for (let i = 0; i < 3; i++) {
        detector.recordCall({
          id: String(i),
          name: 'read_file',
          arguments: { path: '/test.txt' },
        });
      }

      expect(detector.isStuckInLoop()).toBe(false);
    });

    it('相同调用超过阈值时应返回true', () => {
      for (let i = 0; i < 5; i++) {
        detector.recordCall({
          id: String(i),
          name: 'read_file',
          arguments: { path: '/test.txt' },
        });
      }

      expect(detector.isStuckInLoop()).toBe(true);
    });

    it('不同调用不应触发循环检测', () => {
      const tools = ['read_file', 'write_file', 'delete_file'];

      for (let i = 0; i < 5; i++) {
        detector.recordCall({
          id: String(i),
          name: tools[i % 3],
          arguments: { path: `/test${i}.txt` },
        });
      }

      expect(detector.isStuckInLoop()).toBe(false);
    });

    it('参数不同的相同工具名不应触发循环', () => {
      for (let i = 0; i < 5; i++) {
        detector.recordCall({
          id: String(i),
          name: 'read_file',
          arguments: { path: `/test${i}.txt` },
        });
      }

      expect(detector.isStuckInLoop()).toBe(false);
    });
  });

  describe('reset', () => {
    it('应清空调用记录', () => {
      for (let i = 0; i < 5; i++) {
        detector.recordCall({
          id: String(i),
          name: 'read_file',
          arguments: { path: '/test.txt' },
        });
      }

      detector.reset();

      expect(detector.getRecentCalls()).toHaveLength(0);
      expect(detector.isStuckInLoop()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('应返回正确的状态信息', () => {
      const status = detector.getStatus();

      expect(status).toHaveProperty('recentCallsCount');
      expect(status).toHaveProperty('threshold');
      expect(status).toHaveProperty('isStuck');
      expect(status.threshold).toBe(5);
    });
  });
});

describe('createLoopErrorMessage', () => {
  it('应生成有意义的错误消息', () => {
    const message = createLoopErrorMessage([]);

    expect(message).toContain('检测到重复的工具调用循环');
    expect(message).toContain('停止执行');
  });

  it('应包含调用统计信息', () => {
    const calls = [
      { name: 'read_file', args: 'read_file:{"path":"/a.txt"}' },
      { name: 'read_file', args: 'read_file:{"path":"/a.txt"}' },
      { name: 'read_file', args: 'read_file:{"path":"/a.txt"}' },
    ];

    const message = createLoopErrorMessage(calls);

    expect(message).toContain('read_file');
    expect(message).toContain('3');
  });
});
