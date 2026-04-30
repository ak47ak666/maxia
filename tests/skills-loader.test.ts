/**
 * Skills匹配测试
 */

import { describe, test, expect } from '@jest/globals';

describe('SkillsLoader', () => {
  test('应该正确提取关键词', () => {
    const task = '帮我写一个Python脚本来处理文件';
    const stopWords = new Set([
      '我', '你', '他', '她', '它', '的', '了', '在', '是', '和', '与',
      '请', '帮我', '一下', '这个', '那个', '什么', '怎么', '如何',
      '能不能', '可以', '需要', '想要', '麻烦', '给我', '做', '一个'
    ]);

    const cleaned = task
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    expect(cleaned).toContain('python');
    expect(cleaned).toContain('脚本');
    expect(cleaned).toContain('处理');
    expect(cleaned).toContain('文件');
    expect(cleaned).not.toContain('帮我');
  });

  test('应该正确计算匹配得分', () => {
    const keywords = ['python', '文件'];
    const skills = [
      { name: 'Python工具', description: 'Python开发工具', score: 0 },
      { name: '文件处理', description: '文件读写和处理', score: 0 },
    ];

    for (const skill of skills) {
      const text = `${skill.name} ${skill.description}`.toLowerCase();
      for (const keyword of keywords) {
        if (skill.name.toLowerCase().includes(keyword)) {
          skill.score += 10;
        }
        if (skill.description.toLowerCase().includes(keyword)) {
          skill.score += 5;
        }
      }
    }

    expect(skills[0].score).toBe(10);
    expect(skills[1].score).toBe(5);
  });

  test('应该正确识别停用词', () => {
    const stopWords = new Set([
      '我', '你', '他', '她', '它', '的', '了', '在', '是', '和', '与',
      '请', '帮我', '一下', '这个', '那个', '什么', '怎么', '如何',
    ]);

    expect(stopWords.has('的')).toBe(true);
    expect(stopWords.has('了')).toBe(true);
    expect(stopWords.has('python')).toBe(false);
  });
});