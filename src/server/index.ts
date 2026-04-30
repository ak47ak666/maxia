/**
 * Web服务器 - 马虾Web界面后端
 * 架构：SSE + 长轮询双模式混合
 * - 简单对话：SSE流式返回
 * - 复杂任务：长轮询+任务队列+Verifier验收
 */

// Windows控制台编码设置
if (process.platform === 'win32') {
  try {
    const { execSync } = require('child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {}
}

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { AIAgent } from '../core/agent/agent.js';
import { globalToolRegistry } from '../core/tool-registry/registry.js';
import { ConfigManager } from '../core/config.js';
import { SessionManager, ChatMessage } from '../core/session.js';
import { logger } from '../core/logger.js';
import { registerBuiltinTools } from '../core/tools-registry.js';
import { taskManager, Task } from '../core/task-manager.js';
import { Verifier } from '../core/verifier.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.join(path.dirname(__filename), '../..');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3006;
const PUBLIC_DIR = path.join(__dirname, '../../public');
const SESSIONS_DIR = path.join(PROJECT_ROOT, 'sessions');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');
const CUOWO_DIR = path.join(PROJECT_ROOT, 'cuowo');

// 会话管理器
const sessionManager = new SessionManager(SESSIONS_DIR);

// SSE 事件流存储
type SSECallback = (data: string) => void;
const sseStreams: Map<string, SSECallback[]> = new Map();

// SSE连接限制
const MAX_SSE_CONNECTIONS = 50;
const activeConnections = new Set<string>();

// 注册工具
function registerTools() {
  registerBuiltinTools();
  logger.info({ toolCount: globalToolRegistry.getAllTools().length }, '工具注册完成');
}

// 辅助函数：从路径中提取sessionId
function extractSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/session\/([^/]+)$/);
  return match ? match[1] : null;
}

// 静态文件类型映射
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// HTTP服务器
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API路由
  if (pathname.startsWith('/api/')) {
    await handleAPI(req, res, pathname);
    return;
  }

  // 静态文件
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'text/plain');
    res.writeHead(200);
    res.end(content);
  } catch {
    // 返回404或重定向到index.html
    try {
      const indexContent = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200);
      res.end(indexContent);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

// API处理器
async function handleAPI(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/config' && req.method === 'GET') {
    // 获取配置
    const configManager = new ConfigManager(path.join(PROJECT_ROOT, 'profiles/default'));
    const config = await configManager.load();
    // 清理空格并隐藏API Key
    config.baseUrl = (config.baseUrl || '').trim();
    config.model = (config.model || '').trim();
    config.apiKey = config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '';
    res.writeHead(200);
    res.end(JSON.stringify(config));
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    // 保存配置
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const configManager = new ConfigManager(path.join(PROJECT_ROOT, 'profiles/default'));
        const currentConfig = await configManager.load();
        const newConfig = JSON.parse(body);

        // 如果API Key被mask了（只显示••••••••），则使用原来的值
        if (newConfig.apiKey && newConfig.apiKey.includes('••••••••')) {
          newConfig.apiKey = currentConfig.apiKey;
        }

        await configManager.update(newConfig);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    return;
  }

  // ========== 聊天接口 - 使用 TaskManager + Verifier ==========
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message, sessionId } = JSON.parse(body);
        const configManager = new ConfigManager(path.join(PROJECT_ROOT, 'profiles/default'));
        const config = await configManager.load();

        // 清理配置中的空格
        config.baseUrl = (config.baseUrl || '').trim();
        config.apiKey = (config.apiKey || '').trim();
        config.model = (config.model || '').trim();

        // 获取或创建会话
        let session;
        if (sessionId) {
          session = await sessionManager.getSession(sessionId);
        }
        if (!session) {
          session = await sessionManager.createSession();
        }

        // 保存用户消息
        const userMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          role: 'user',
          content: message,
          timestamp: Date.now(),
        };
        await sessionManager.addMessage(session.id, userMsg);

        // 解析工作目录和验证规则
        const workspace = Verifier.parseWorkspace(message);
        const verifyRules = Verifier.inferRules(message);

        logger.info({ workspace, verifyRules, message }, '解析任务参数');

        // 创建任务
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const task: Task = {
          id: taskId,
          status: 'pending',
          goal: message,
          workspace: workspace,
          logs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        taskManager.create(task);

        // 立即返回taskId，让前端开始轮询
        res.writeHead(200);
        res.end(JSON.stringify({ taskId, sessionId: session.id }));

        // 后台异步执行agent
        setImmediate(async () => {
          taskManager.update(taskId, { status: 'running' });
          task.logs.push('开始执行任务');

          try {
            const systemPrompt = await getSystemPrompt();
            const agent = new AIAgent({
              model: config.model,
              provider: config.provider as any,
              apiKey: config.apiKey,
              baseUrl: config.baseUrl,
              systemPrompt: systemPrompt,
              tools: globalToolRegistry.getAllTools(),
              fallbackProviders: config.fallbackProviders || [],
              enableRetry: config.enableRetry ?? true,
              maxRetries: config.maxRetries ?? 3,
            });

            // 加载会话历史消息，避免AI"失忆"
            for (const msg of session.messages) {
              if (msg.role !== 'system') {
                agent.addMessage({
                  id: msg.id,
                  role: msg.role as 'user' | 'assistant' | 'tool',
                  content: msg.content,
                  timestamp: msg.timestamp,
                });
              }
            }

            // 订阅agent事件，用于进度跟踪
            const unsub = agent.onEvent((event) => {
              if (event.type === 'tool_call') {
                const toolCall = event.data as { name: string; arguments: Record<string, unknown> };
                task.logs.push(`🔧 调用工具: ${toolCall.name}`);
                taskManager.update(taskId, { logs: [...task.logs] });
              } else if (event.type === 'tool_result') {
                const toolResult = event.data as { tool: string; result: { success?: boolean; error?: string } };
                if (toolResult.result && toolResult.result.success === false) {
                  task.logs.push(`❌ 工具失败: ${toolResult.tool} - ${toolResult.result.error}`);
                } else {
                  task.logs.push(`✅ 工具完成: ${toolResult.tool}`);
                }
                taskManager.update(taskId, { logs: [...task.logs] });
              } else if (event.type === 'thinking') {
                const data = event.data as { text?: string; iteration?: number };
                if (data.text && data.iteration) {
                  task.logs.push(`🤔 思考中 (${data.iteration}轮): ${data.text.substring(0, 50)}...`);
                  taskManager.update(taskId, { logs: [...task.logs] });
                }
              }
            });

            await agent.start();
            const response = await agent.sendMessage(message);
            unsub();  // 取消订阅

            taskManager.update(taskId, { status: 'verifying' });
            task.logs.push('开始验证任务');
            taskManager.update(taskId, { logs: [...task.logs] });

            // Verifier验收
            if (workspace && verifyRules.length > 0) {
              const { ok, missing, logs } = await Verifier.verify(task, verifyRules);
              task.logs.push(...logs);

              if (ok) {
                taskManager.update(taskId, {
                  status: 'completed',
                  result: response || '任务已完成（系统验收通过）',
                });
                task.logs.push('验收通过：所有文件已生成');
              } else {
                taskManager.update(taskId, {
                  status: 'failed',
                  result: `验收失败：缺失文件 - ${missing.join(', ')}`,
                });
                task.logs.push(`验收失败：缺失 ${missing.length} 个文件`);
              }
            } else {
              // 没有验证规则，直接完成
              taskManager.update(taskId, {
                status: 'completed',
                result: response || '任务已完成',
              });
            }

            // 保存助手回复
            const assistantMsg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
              role: 'assistant',
              content: taskManager.get(taskId)?.result || response,
              timestamp: Date.now(),
            };
            await sessionManager.addMessage(session.id, assistantMsg);

          } catch (error) {
            taskManager.update(taskId, {
              status: 'failed',
              result: `执行出错: ${(error as Error).message}`,
            });
            task.logs.push(`执行出错: ${(error as Error).message}`);
          }
        });

      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    return;
  }

  // ========== 长轮询接口 - 使用 TaskManager ==========
  if (pathname.startsWith('/api/chat/poll/') && req.method === 'GET') {
    const taskId = pathname.split('/').pop();
    if (!taskId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: '缺少 taskId' }));
      return;
    }

    const task = taskManager.get(taskId);
    if (!task) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: '任务不存在' }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      status: task.status,
      result: task.result || '',
      logs: task.logs,
    }));
    return;
  }

  // SSE 事件流
  if (pathname.startsWith('/api/chat/stream/') && req.method === 'GET') {
    const sessionId = pathname.split('/').pop();
    if (!sessionId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: '缺少 sessionId' }));
      return;
    }

    // 检查连接数限制
    if (activeConnections.size >= MAX_SSE_CONNECTIONS) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: '服务器连接数已满，请稍后再试' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 发送初始连接确认
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    // 注册 SSE 回调
    activeConnections.add(sessionId);
    const callback: SSECallback = (data) => {
      try {
        res.write(data);
      } catch (err) {
        // 忽略写入错误，客户端可能已断开
        logger.warn('SSE写入失败，客户端可能已断开');
      }
    };

    if (!sseStreams.has(sessionId)) {
      sseStreams.set(sessionId, []);
    }
    sseStreams.get(sessionId)!.push(callback);

    // 心跳保活 - 每30秒发送一次 comment
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // 清理
    req.on('close', () => {
      clearInterval(heartbeat);
      activeConnections.delete(sessionId);
      const callbacks = sseStreams.get(sessionId);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx >= 0) callbacks.splice(idx, 1);
      }
    });
    return;
  }

  // 获取所有会话列表
  if (pathname === '/api/sessions' && req.method === 'GET') {
    try {
      const sessions = await sessionManager.listSessions();
      // 返回简化信息，不包含完整消息
      const sessionList = sessions.map(s => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      }));
      res.writeHead(200);
      res.end(JSON.stringify(sessionList));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return;
  }

  // 获取单个会话详情
  if (pathname.startsWith('/api/session/') && req.method === 'GET') {
    const sessionId = extractSessionId(pathname);
    if (!sessionId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: '无效的会话ID' }));
      return;
    }
    try {
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: '会话不存在' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(session));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return;
  }

  // 删除会话
  if (pathname.startsWith('/api/session/') && req.method === 'DELETE') {
    const sessionId = extractSessionId(pathname);
    if (!sessionId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: '无效的会话ID' }));
      return;
    }
    try {
      await sessionManager.deleteSession(sessionId);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return;
  }

  if (pathname === '/api/tools') {
    // 获取工具列表
    const tools = globalToolRegistry.getAllTools().map(t => t.definition);
    res.writeHead(200);
    res.end(JSON.stringify(tools));
    return;
  }

  // 获取已安装的Skills列表
  if (pathname === '/api/skills/list' && req.method === 'GET') {
    try {
      await fs.mkdir(SKILLS_DIR, { recursive: true });
      const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
      const skills = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(SKILLS_DIR, entry.name);
          const skillMdPath = path.join(skillPath, 'SKILL.md');

          try {
            const stat = await fs.stat(skillMdPath);
            if (stat.isFile()) {
              const content = await fs.readFile(skillMdPath, 'utf-8');
              // 简单解析emoji
              const emoji = content.includes('📦') ? '📦' :
                           content.includes('🎨') ? '🎨' :
                           content.includes('📝') ? '📝' :
                           content.includes('🔧') ? '🔧' :
                           content.includes('⚡') ? '⚡' : '📦';
              skills.push({
                name: entry.name,
                path: skillPath,
                emoji: emoji,
              });
            }
          } catch {
            // 目录中没有SKILL.md，跳过
          }
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify(skills));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return;
  }

  // 获取错误列表/大纲
  if (pathname === '/api/cuowo/list' && req.method === 'GET') {
    try {
      await fs.mkdir(CUOWO_DIR, { recursive: true });
      const entries = await fs.readdir(CUOWO_DIR);
      const errors = [];

      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          const filePath = path.join(CUOWO_DIR, entry);
          const content = await fs.readFile(filePath, 'utf-8');
          const name = entry.replace('.md', '');
          let description = '';
          let detail = '';

          // 找到 ## 描述 或 ## 错误描述 部分
          const descMatch = content.match(/##\s*(?:描述|错误描述)\s*\n([\s\S]*?)(?=##|$)/i);
          if (descMatch) {
            description = descMatch[1].trim().slice(0, 200);
          }

          // 找到 ## 详情 或 ## 错误详情 部分
          const detailMatch = content.match(/##\s*(?:详情|错误详情)\s*\n([\s\S]*?)(?=##|$)/i);
          if (detailMatch) {
            detail = detailMatch[1].trim().slice(0, 500);
          }

          errors.push({
            name,
            description: description || '无描述',
            detail: detail || '无详情',
          });
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify(errors));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return;
  }

  // 获取特定错误的详细内容
  if (pathname.startsWith('/api/cuowo/') && req.method === 'GET') {
    const errorName = pathname.replace('/api/cuowo/', '');
    const filePath = path.join(CUOWO_DIR, `${errorName}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200);
      res.end(JSON.stringify({ content }));
    } catch {
      res.writeHead(404);
      res.end(JSON.stringify({ error: '错误记录不存在' }));
    }
    return;
  }

  // 保存错误记录
  if (pathname === '/api/cuowo/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { name, content } = JSON.parse(body);

        if (!name || !content) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '缺少错误名称或内容' }));
          return;
        }

        // 清理文件名
        const cleanName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 100);
        const filePath = path.join(CUOWO_DIR, `${cleanName}.md`);

        await fs.writeFile(filePath, content, 'utf-8');

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, name: cleanName }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    return;
  }

  // 安装Skills（上传zip文件）
  if (pathname === '/api/skills/install' && req.method === 'POST') {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // 查找ZIP文件的起始标记（PK\x03\x04）
        const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
        const zipStartIndex = buffer.indexOf(zipSignature);

        if (zipStartIndex === -1) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '无效的文件格式' }));
          return;
        }

        // 提取ZIP文件内容
        const fileBuffer = buffer.slice(zipStartIndex);

        // 从multipart数据中提取原始文件名
        const contentTypeIdx = buffer.indexOf('filename="');
        let skillName = 'unknown';
        if (contentTypeIdx !== -1) {
          const start = contentTypeIdx + 10;
          const end = buffer.indexOf('"', start);
          const rawFilename = buffer.slice(start, end).toString('utf-8');
          // 去掉.zip后缀作为目录名
          skillName = rawFilename.replace(/\.zip$/i, '');
        }

        // 创建目标目录
        const targetPath = path.join(SKILLS_DIR, skillName);

        // 如果目标目录已存在，先删除
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
        } catch {}

        // 创建目标目录
        await fs.mkdir(targetPath, { recursive: true });

        // 创建临时zip文件
        const tempZipPath = path.join(SKILLS_DIR, `temp_install_${Date.now()}.zip`);
        await fs.writeFile(tempZipPath, fileBuffer);

        // 解压zip文件到目标目录
        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(targetPath, true);

        // 删除临时zip文件
        await fs.unlink(tempZipPath);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Skills "${skillName}" 安装成功！`,
        }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
}

// 系统提示
async function getSystemPrompt(): Promise<string> {
  // 加载错误大纲
  let errorOutline = '';
  try {
    await fs.mkdir(CUOWO_DIR, { recursive: true });
    const entries = await fs.readdir(CUOWO_DIR);
    const errorFiles = entries.filter(e => e.endsWith('.md'));

    if (errorFiles.length > 0) {
      const errorList = [];
      for (const entry of errorFiles) {
        const filePath = path.join(CUOWO_DIR, entry);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = entry.replace('.md', '');

        // 提取描述
        let description = '';
        const descMatch = content.match(/##\s*(?:描述|错误描述)\s*\n([\s\S]*?)(?=##|$)/i);
        if (descMatch) {
          description = descMatch[1].trim().slice(0, 150);
        }

        errorList.push(`- **${name}**: ${description || '无描述'}`);
      }

      errorOutline = `

【历史错误参考】
当用户提到出错了或遇到问题时，先在以下错误列表中查找是否有类似的错误：
${errorList.join('\n')}

如果有相关错误，可以使用工具读取错误文件了解详情和解决方法。`;
    }
  } catch {}

  return `你是 MAXIA，AI编程助手。收到任务后必须直接调用工具执行，禁止只用文字描述。

核心规则：
- 创建/修改文件 → write_file | 创建目录 → create_directory | 执行命令 → execute_command
- 读取文件 → read_file | 查看目录 → list_directory | 删除 → delete_file
- 直接执行工具，不解释${errorOutline}

工作流程：理解需求 → 调用工具 → 根据结果继续 → 任务完成时返回结果。

回答简洁，用中文。`;
}

// 启动服务器
async function start() {
  registerTools();

  // 确保public目录存在
  try {
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
  } catch {}

  server.listen(PORT, () => {
    logger.info(`马虾 Web界面已启动: http://localhost:${PORT}`);
  });
}

start();
