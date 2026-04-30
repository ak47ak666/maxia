# 🦞 MAXIA - 马虾

本地AI Agent工具，参考hermes-agent和openclaw设计。支持Web界面和CLI两种交互方式。

## 系统要求

- Node.js >= 22.0.0
- npm 或 yarn

## 快速开始

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动Web界面
npm run start:web

# 或启动CLI聊天
npm run start
```

## 运行模式

### Web界面模式

启动HTTP服务器，提供Web聊天界面：

```bash
npm run dev:web
# 或构建后
npm run start:web
```

访问 http://localhost:3006

### CLI模式

启动交互式命令行界面：

```bash
npm run dev
# 或构建后
npm start
```

## 配置说明

### 配置文件

配置文件位于 `profiles/default/config.json`：

```json
{
  "model": "MiniMax-M2.7-highspeed",
  "provider": "openai",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.minimax.chat/v1",
  "temperature": 0.3,
  "maxTokens": 4096,
  "maxIterations": 100,
  "requestTimeout": 90000,
  "maxContextMessages": 100,
  "enableRetry": true,
  "maxRetries": 3,
  "fallbackProviders": []
}
```

### 环境变量

支持以下环境变量（优先级高于配置文件）：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| MAXIA_MODEL | 模型名称 | gpt-4 |
| MAXIA_PROVIDER | 提供商 | openai |
| MAXIA_API_KEY | API密钥 | - |
| MAXIA_BASE_URL | API地址 | https://api.openai.com/v1 |
| MAXIA_TEMPERATURE | 温度参数 | 0.7 |
| MAXIA_MAX_TOKENS | 最大令牌数 | 4096 |
| MAXIA_MAX_ITERATIONS | 最大迭代次数 | 100 |
| MAXIA_REQUEST_TIMEOUT | 请求超时(ms) | 90000 |
| MAXIA_MAX_CONTEXT_MESSAGES | 上下文消息数 | 100 |

## 功能特性

### 内置工具集

| 类别 | 工具 |
|------|------|
| 文件操作 | read_file, write_file, create_directory, list_directory, delete_file, copy_file, move_file, file_info, search_files, grep, patch |
| 终端命令 | execute_command, get_system_info, get_environment, process_list, kill_process, system_control, port_check |
| Git操作 | git_status, git_log, git_diff, git_branch, git_commit, git_push, git_pull, git_clone, git_stash, git_remote |
| 网页工具 | web_search, web_fetch, web_screenshot, ip_info, whois, dns_lookup |
| 媒体处理 | image_analyze, image_info, image_generate, image_resize, image_convert, pdf_info, pdf_extract_text, audio_transcribe, text_to_speech |
| Cron任务 | cron_list, cron_create, cron_delete, cron_toggle, cron_run |
| 网络诊断 | ping, http_check, traceroute, dns_resolve, port_scan, bandwidth_test |
| Skills | skills_list, skill_view, skills_match |

### Skills技能系统

Skills允许扩展AI能力，可以从本地目录加载或从远程Hub安装。

本地Skills目录：`skills/`

创建Skill示例 - `skills/example/SKILL.md`：

```markdown
---
name: 示例技能
description: 这是一个示例技能
version: 1.0.0
---

这里是技能的详细说明和使用方法。
```

### MCP扩展支持

支持连接MCP服务器扩展功能。配置MCP服务器：

`extensions/mcp-servers.json`：

```json
{
  "mcpServers": [
    {
      "name": "example",
      "url": "http://localhost:3001/mcp"
    }
  ]
}
```

### 弹性机制

- **自动重试**：支持对限流、超时等错误自动重试
- **模型降级**：主模型失败时自动切换到备用模型
- **Provider冷却**：失败模型进入冷却期，避免频繁失败
- **上下文窗口**：自动管理对话历史，防止上下文溢出

## API接口

### 聊天接口

```
POST /api/chat
{
  "message": "你好",
  "sessionId": "可选的会话ID"
}
```

### 会话管理

```
GET  /api/sessions          # 获取会话列表
GET  /api/session/:id       # 获取会话详情
DELETE /api/session/:id     # 删除会话
```

### SSE事件流

```
GET /api/chat/stream/:sessionId
```

事件类型：
- `connected` - 连接建立
- `thinking` - AI思考中
- `tool_call` - 工具调用
- `tool_result` - 工具结果
- `task_update` - 任务状态更新
- `complete` - 完成
- `task_error` - 错误

### 其他接口

```
GET  /api/config            # 获取配置
POST /api/config            # 保存配置
GET  /api/tools             # 获取工具列表
GET  /api/tasks?sessionId=x # 获取任务状态
```

## 项目结构

```
maxia/
├── src/
│   ├── cli/           # CLI入口
│   ├── core/         # 核心模块
│   │   ├── agent/    # Agent核心
│   │   ├── config.ts # 配置管理
│   │   ├── session.ts# 会话管理
│   │   ├── logger.ts # 日志模块
│   │   └── errors/   # 错误处理
│   ├── server/       # Web服务器
│   ├── tools/        # 内置工具
│   └── tui/          # TUI界面
├── public/           # 静态文件
├── profiles/         # 配置 profiles
├── skills/           # Skills目录
├── sessions/         # 会话存储
└── tests/            # 测试文件
```

## 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch
```

## 日志

日志使用pino库，配置环境变量 `LOG_LEVEL` 控制日志级别：

```bash
LOG_LEVEL=debug npm run start:web
```

## 许可证

MIT
