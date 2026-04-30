/**
 * 会话管理 - 持久化聊天记录
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolResult?: unknown;
}

export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export class SessionManager {
  private sessionsDir: string;

  constructor(sessionsDir: string = './sessions') {
    this.sessionsDir = sessionsDir;
  }

  // 初始化目录
  async init(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  // 创建新会话
  async createSession(title?: string): Promise<Session> {
    await this.init();

    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title || `对话 ${new Date().toLocaleString('zh-CN')}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveSession(session);
    return session;
  }

  // 保存会话
  async saveSession(session: Session): Promise<void> {
    await this.init();
    session.updatedAt = Date.now();
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  // 获取会话
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // 添加消息到会话
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.messages.push(message);
      // 生成标题（如果还没生成）
      if (session.messages.length === 2 && !session.title.startsWith('对话')) {
        // 用用户的第一条消息作为标题
        const firstUserMsg = session.messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          session.title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
        }
      }
      await this.saveSession(session);
    }
  }

  // 获取所有会话列表
  async listSessions(): Promise<Session[]> {
    await this.init();
    const files = await fs.readdir(this.sessionsDir);
    const sessions: Session[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          const session = JSON.parse(content);
          sessions.push(session);
        } catch {}
      }
    }

    // 按更新时间排序，最新的在前
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return sessions;
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch {}
  }
}
