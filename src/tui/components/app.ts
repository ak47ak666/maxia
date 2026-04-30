/**
 * TUI应用 - 左侧导航 + 右侧内容布局 + 可视化配置
 */

import readline from 'node:readline';
import os from 'node:os';
import { AIAgent } from '../../core/agent/agent.js';
import type { AgentEvent } from '../../types.js';
import { globalToolRegistry } from '../../core/tool-registry/registry.js';
import { ConfigManager, type Config } from '../../core/config.js';
import {
  ReadFileTool,
  WriteFileTool,
  CreateDirectoryTool,
  ListDirectoryTool,
  DeleteFileTool,
  CopyFileTool,
} from '../../tools/file-tools.js';
import {
  ExecuteCommandTool,
  GetSystemInfoTool,
  GetEnvironmentTool,
} from '../../tools/terminal-tool.js';
import {
  DelegateTaskTool,
  DelegateTasksParallelTool,
} from '../../tools/delegate-tool.js';

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

// 工具名称映射到中文描述（通用部分）
const toolNameMap: Record<string, string> = {
  // 文件工具
  read_file: '读取文件',
  write_file: '写入文件',
  create_directory: '创建目录',
  list_directory: '列出目录',
  delete_file: '删除文件',
  copy_file: '复制文件',

  // 终端工具
  execute_command: '执行命令',
  get_system_info: '获取系统信息',
  get_environment: '获取环境变量',

  // 委托工具
  delegate_task: '执行子任务',
  delegate_tasks_parallel: '并行执行多个子任务',

  // 其他工具
  image_analyze: '分析图片',
  web_search: '搜索网络',
  web_fetch: '获取网页',

  // 默认未知工具
  unknown: '执行操作',
};

// 根据工具名和参数生成中文描述
function getToolStepDescription(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': {
      const path = args.path as string;
      return path ? `正在读取文件: ${path}` : '正在读取文件';
    }
    case 'write_file': {
      const path = args.path as string;
      return path ? `正在写入文件: ${path}` : '正在写入文件';
    }
    case 'create_directory': {
      const path = args.path as string;
      return path ? `正在创建目录: ${path}` : '正在创建目录';
    }
    case 'list_directory': {
      const path = args.path as string;
      return path ? `正在列出目录: ${path}` : '正在列出目录';
    }
    case 'delete_file': {
      const path = args.path as string;
      return path ? `正在删除文件: ${path}` : '正在删除文件';
    }
    case 'copy_file': {
      const src = args.source as string;
      const dest = args.destination as string;
      if (src && dest) return `正在复制文件: ${src} → ${dest}`;
      if (src) return `正在复制文件: ${src}`;
      return '正在复制文件';
    }
    case 'execute_command': {
      const cmd = args.command as string;
      // 截断过长的命令
      const displayCmd = cmd && cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd;
      return displayCmd ? `正在执行命令: ${displayCmd}` : '正在执行命令';
    }
    case 'delegate_task': {
      const goal = args.goal as string;
      const taskId = args.task_id as string;
      // 截断过长的目标描述
      const displayGoal = goal && goal.length > 40 ? goal.substring(0, 37) + '...' : goal;
      if (displayGoal) return `正在执行子任务: ${displayGoal}`;
      if (taskId) return `正在执行子任务: ${taskId}`;
      return '正在执行子任务';
    }
    case 'delegate_tasks_parallel': {
      const tasks = args.tasks as Array<{ goal?: string; task_id?: string }>;
      if (tasks && tasks.length > 0) {
        return `正在并行执行 ${tasks.length} 个子任务`;
      }
      return '正在并行执行多个子任务';
    }
    case 'image_analyze': {
      const image = args.image as string;
      return image ? `正在分析图片: ${image}` : '正在分析图片';
    }
    case 'web_search': {
      const query = args.query as string;
      return query ? `正在搜索: ${query}` : '正在搜索网络';
    }
    case 'web_fetch': {
      const url = args.url as string;
      return url ? `正在获取网页: ${url}` : '正在获取网页';
    }
    case 'get_system_info':
      return '正在获取系统信息';
    case 'get_environment':
      return '正在获取环境变量';
    default:
      return `正在执行: ${toolNameMap[name] || name}`;
  }
}

// 当前编辑状态
interface EditState {
  field: string;
  value: string;
}

export class TUIMenu {
  private agent?: AIAgent;
  private configManager: ConfigManager = new ConfigManager();
  private config: Config = {
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

  private currentNav: string = 'chat';
  private messages: { role: string; content: string; time: string }[] = [];
  private editState?: EditState;
  private inputMode: 'nav' | 'chat' | 'edit' | 'confirm' = 'nav';
  private rl?: readline.Interface;

  // 导航配置
  private navSections: NavSection[] = [
    {
      title: '会话',
      items: [
        { id: 'chat', label: '聊天', icon: '💬' },
        { id: 'history', label: '历史', icon: '📜' },
      ],
    },
    {
      title: '工具',
      items: [
        { id: 'file-tools', label: '文件操作', icon: '📁' },
        { id: 'terminal-tools', label: '终端', icon: '💻' },
        { id: 'system-tools', label: '系统信息', icon: '⚙️' },
      ],
    },
    {
      title: '设置',
      items: [
        { id: 'config', label: '配置', icon: '🔧' },
        { id: 'theme', label: '主题', icon: '🎨' },
      ],
    },
  ];

  // 初始化
  async init(): Promise<void> {
    // 加载配置
    this.config = await this.configManager.load();

    // 注册工具
    this.registerTools();

    // 创建Agent
    this.agent = new AIAgent({
      model: this.config.model,
      provider: this.config.provider as any,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      systemPrompt: this.getSystemPrompt(),
      tools: globalToolRegistry.getAllTools(),
    });

    // 订阅事件
    this.agent.onEvent((event: AgentEvent) => this.handleAgentEvent(event));

    // 启动Agent
    await this.agent.start();
  }

  // 注册工具
  private registerTools(): void {
    const tools = [
      new ReadFileTool(),
      new WriteFileTool(),
      new CreateDirectoryTool(),
      new ListDirectoryTool(),
      new DeleteFileTool(),
      new CopyFileTool(),
      new ExecuteCommandTool(),
      new GetSystemInfoTool(),
      new GetEnvironmentTool(),
      new DelegateTaskTool(),
      new DelegateTasksParallelTool(),
    ];

    for (const t of tools) {
      globalToolRegistry.register(t);
    }
  }

  // 系统提示
  private getSystemPrompt(): string {
    return `你是马虾(MAXIA)，一个强大的本地AI助手。

你有以下能力：
1. 文件操作：读取、写入、创建、删除、复制文件和目录
2. 终端命令：执行系统命令
3. 信息查询：获取系统信息、环境变量等
4. 任务委托：可将复杂任务分解并行执行

【任务委托机制】
当遇到复杂任务时，你可以使用 delegate_task 或 delegate_tasks_parallel 工具将任务分解为多个子任务并行执行，显著加快速度。
- delegate_task: 委托单个子任务
- delegate_tasks_parallel: 并行委托多个独立子任务

适用场景：
- 同时分析多个文件或目录
- 并行执行多个独立操作
- 批量处理任务

【重要】多轮对话机制：
- 当用户提出复杂任务时，你可以主动分解并委托子任务并行执行
- 使用工具后，你会获得执行结果，然后根据结果决定下一步
- 只有当任务真正完成时，才返回最终结果
- 如果任务需要多步操作，请在所有步骤完成后才给出完整回复
- 完成任务后，在回复末尾添加 [完成] 标记

回答简洁明了，用中文回复。`;
  }

  // 处理Agent事件
  private handleAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'tool_call': {
        const toolCall = event.data as { name: string; arguments: Record<string, unknown> };
        const description = getToolStepDescription(toolCall.name, toolCall.arguments);
        this.addMessage('system', `🔧 ${description}`);
        break;
      }
      case 'tool_result': {
        const result = event.data as { tool: string; result: { success: boolean; error?: string } };
        if (result.result.success) {
          this.addMessage('system', `✅ ${result.tool} 执行成功`);
        } else {
          this.addMessage('system', `❌ ${result.tool} 执行失败: ${result.result.error}`);
        }
        break;
      }
      case 'thinking':
        // 不显示thinking消息，减少噪音
        break;
    }
  }

  // 添加消息
  private addMessage(role: string, content: string): void {
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    this.messages.push({ role, content, time });
  }

  // 渲染界面
  render(): void {
    console.clear();

    const lines: string[] = [];

    // 头部
    lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
    lines.push('║  🦞 MAXIA - 马虾                         [Profile: default]    [✓ 就绪]  ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    const navWidth = 26;
    const contentWidth = 89;

    // 内容区渲染
    const contentLines = this.renderContent();

    // 构建导航和内容的行
    const maxLines = Math.max(22, contentLines.length + 4);
    for (let i = 0; i < maxLines; i++) {
      let navLine = '║';
      let contentLine = '║';

      // 导航
      let navY = 0;
      for (const section of this.navSections) {
        if (i === navY) {
          const title = ` §${section.title}`;
          navLine += title.padEnd(navWidth) + ' ║';
          navY++;
        } else if (i > navY && navY < i && i <= navY + section.items.length) {
          const item = section.items[i - navY - 1];
          const marker = item.id === this.currentNav ? '▸' : ' ';
          const label = ` ${marker} ${item.icon} ${item.label}`;
          navLine += label.padEnd(navWidth) + ' ║';
        } else if (i === navY + section.items.length) {
          navLine += ''.padEnd(navWidth) + ' ║';
        } else {
          navLine += ''.padEnd(navWidth) + ' ║';
        }
        navY += section.items.length + 1;
      }

      // 填充剩余导航空间
      while (navY < maxLines - 3) {
        if (i >= navY && i < maxLines - 3) {
          navLine += ''.padEnd(navWidth) + ' ║';
        }
        navY++;
      }

      // 内容区
      const content = contentLines[i] || '';
      contentLine += content.padEnd(contentWidth) + ' ║';

      lines.push(navLine + contentLine);
    }

    // 底部状态栏
    lines.push('╠══════════════════════════════════════════════════════════════════════════════╣');

    // 根据模式显示不同提示
    let prompt = '';
    if (this.inputMode === 'edit' && this.editState) {
      prompt = ` 修改: ${this.editState.field} = ${this.editState.value}_`;
    } else if (this.inputMode === 'chat') {
      prompt = ' > 输入消息后按回车发送...';
    } else if (this.inputMode === 'confirm') {
      prompt = ' > 确认操作? (y/n)';
    } else {
      prompt = ' [↑↓] 选择  [Enter] 确认  [e] 编辑配置  [q] 退出';
    }

    lines.push(`║${prompt.padEnd(116)}║`);
    lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');

    console.log(lines.join('\n'));
  }

  // 渲染内容区
  private renderContent(): string[] {
    switch (this.currentNav) {
      case 'chat':
        return this.renderChatContent();
      case 'config':
        return this.renderConfigContent();
      case 'file-tools':
        return this.renderToolsContent('file');
      case 'terminal-tools':
        return this.renderToolsContent('terminal');
      case 'system-tools':
        return this.renderSystemContent();
      case 'history':
        return this.renderHistoryContent();
      case 'theme':
        return this.renderThemeContent();
      default:
        return ['未知的页面'];
    }
  }

  // 聊天内容
  private renderChatContent(): string[] {
    const lines: string[] = [];
    lines.push('  💬 聊天会话                                          [e] 编辑配置       ');
    lines.push('  ─────────────────────────────────────────────────────────────────────');

    if (this.messages.length === 0) {
      lines.push('  暂无消息，请在下方向输入内容开始对话...');
      lines.push('');
      lines.push('  💡 示例命令:');
      lines.push('    • 帮我查看桌面有什么文件');
      lines.push('    • 在D盘创建一个website目录');
      lines.push('    • 帮我执行ls -la命令');
    } else {
      for (const msg of this.messages.slice(-10)) {
        const prefix = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '📝';
        const content = `${prefix} [${msg.time}] ${msg.content}`;
        const truncated = content.length > 85 ? content.substring(0, 82) + '...' : content;
        lines.push(`  ${truncated}`);
      }
    }

    // 填充空白
    while (lines.length < 20) {
      lines.push('');
    }

    return lines;
  }

  // 配置内容
  private renderConfigContent(): string[] {
    const lines: string[] = [];
    lines.push('  🔧 模型配置                                                  [s] 保存     ');
    lines.push('  ─────────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('  ┌─ API设置 ────────────────────────────────────────────────────────┐');
    lines.push(`  │  1. 提供商    │ ${this.config.provider.padEnd(50)}│`);
    lines.push(`  │  2. API地址   │ ${this.config.baseUrl.substring(0, 50).padEnd(50)}│`);
    lines.push(`  │  3. API Key    │ ${(this.config.apiKey ? '••••••••' + this.config.apiKey.slice(-4) : '(未设置)').padEnd(50)}│`);
    lines.push('  └───────────────────────────────────────────────────────────────────┘');
    lines.push('');
    lines.push('  ┌─ 模型设置 ────────────────────────────────────────────────────────┐');
    lines.push(`  │  4. 模型      │ ${this.config.model.padEnd(50)}│`);
    lines.push(`  │  5. 温度      │ ${this.config.temperature.toString().padEnd(50)}│`);
    lines.push(`  │  6. 最大Token │ ${this.config.maxTokens.toString().padEnd(50)}│`);
    lines.push(`  │  7. 最大迭代  │ ${this.config.maxIterations.toString().padEnd(50)}│`);
    lines.push('  └───────────────────────────────────────────────────────────────────┘');
    lines.push('');
    lines.push('  ┌─ 操作 ──────────────────────────────────────────────────────────┐');
    lines.push('  │  [r] 重置默认  [s] 保存配置  [q] 取消                         │');
    lines.push('  └───────────────────────────────────────────────────────────────────┘');
    lines.push('');
    lines.push('  按数字键选择要修改的项');

    return lines;
  }

  // 工具列表
  private renderToolsContent(category: string): string[] {
    const lines: string[] = [];
    const tools = globalToolRegistry.getToolsByCategory(category);

    lines.push(`  📁 ${category === 'file' ? '文件操作工具' : '终端工具'}                                    [r] 刷新   `);
    lines.push('  ─────────────────────────────────────────────────────────────────────');
    lines.push('');

    if (tools.length === 0) {
      lines.push('  暂无工具');
    } else {
      for (const tool of tools) {
        lines.push(`  ┌─ ${tool.definition.name} ─────────────────────────────`);
        lines.push(`  │  ${tool.definition.description}`);
        lines.push('  │  参数:');
        for (const param of tool.definition.parameters) {
          const required = param.required ? '●' : '○';
          lines.push(`  │    ${required} ${param.name} (${param.type}): ${param.description}`);
        }
        lines.push('  └────────────────────────────────────────');
      }
    }

    while (lines.length < 20) {
      lines.push('');
    }

    return lines;
  }

  // 系统信息
  private renderSystemContent(): string[] {
    const lines: string[] = [];
    lines.push('  ⚙️ 系统信息                                                              ');
    lines.push('  ─────────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push(`  主机名: ${os.hostname()}`);
    lines.push(`  平台: ${os.platform()} (${os.arch()})`);
    lines.push(`  CPU: ${os.cpus().length} 核心`);
    lines.push(`  内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
    lines.push(`  空闲: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
    lines.push(`  主目录: ${os.homedir()}`);
    lines.push(`  Node版本: ${process.version}`);
    lines.push(`  临时目录: ${os.tmpdir()}`);

    while (lines.length < 20) {
      lines.push('');
    }

    return lines;
  }

  // 历史记录
  private renderHistoryContent(): string[] {
    const lines: string[] = [];
    lines.push('  📜 会话历史                                                              ');
    lines.push('  ─────────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('  暂无历史记录');
    lines.push('');
    lines.push('  每次对话会自动保存到历史记录中');

    while (lines.length < 20) {
      lines.push('');
    }

    return lines;
  }

  // 主题设置
  private renderThemeContent(): string[] {
    const lines: string[] = [];
    lines.push('  🎨 主题设置                                                              ');
    lines.push('  ─────────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('  当前主题: 默认');
    lines.push('');
    lines.push('  可用主题:');
    lines.push('    [1] 默认 - 经典蓝色');
    lines.push('    [2] 暗色 - 深色主题');
    lines.push('    [3] 绿色 - 黑客风格');

    while (lines.length < 20) {
      lines.push('');
    }

    return lines;
  }

  // 运行
  async run(): Promise<void> {
    await this.init();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.emitKeypressEvents(process.stdin);

    this.render();

    this.rl.on('line', async (line: string) => {
      await this.handleInput(line);
    });

    process.stdin.on('keypress', async (str: string, key: { ctrl: boolean; name: string }) => {
      await this.handleKeyPress(str, key);
    });
  }

  // 处理输入
  private async handleInput(line: string): Promise<void> {
    const input = line.trim();

    if (this.inputMode === 'chat') {
      if (!input) {
        this.inputMode = 'nav';
        this.render();
        return;
      }

      this.addMessage('user', input);
      this.render();

      if (this.agent) {
        try {
          const response = await this.agent.sendMessage(input);
          this.addMessage('assistant', response);
        } catch (error) {
          this.addMessage('system', `错误: ${(error as Error).message}`);
        }
      }

      this.render();

    } else if (this.inputMode === 'edit' && this.editState) {
      this.editState.value = input;
      await this.applyEdit();
      this.inputMode = 'nav';
      this.editState = undefined;
      this.render();

    } else if (this.inputMode === 'confirm') {
      if (input.toLowerCase() === 'y' || input.toLowerCase() === 'yes') {
        await this.configManager.reset();
        this.config = this.configManager.get();
        this.addMessage('system', '✅ 配置已重置为默认值');
      }
      this.inputMode = 'nav';
      this.render();
    }
  }

  // 处理按键
  private async handleKeyPress(_str: string, key: { ctrl: boolean; name: string }): Promise<void> {
    if (key.ctrl && key.name === 'c') {
      console.log('\n\n👋 再见！\n');
      process.exit(0);
    }

    if (this.inputMode === 'chat') {
      if (key.name === 'escape') {
        this.inputMode = 'nav';
        this.render();
      }
      return;
    }

    if (this.inputMode === 'edit' || this.inputMode === 'confirm') {
      if (key.name === 'escape') {
        this.inputMode = 'nav';
        this.editState = undefined;
        this.render();
      }
      return;
    }

    // 导航模式
    switch (key.name) {
      case 'up':
        this.navigateUp();
        this.render();
        break;
      case 'down':
        this.navigateDown();
        this.render();
        break;
      case 'return':
        this.selectCurrent();
        this.render();
        break;
      case 'e':
        if (this.currentNav === 'chat') {
          this.currentNav = 'config';
          this.render();
        }
        break;
    }
  }

  // 导航
  private navigateUp(): void {
    const allItems = this.navSections.flatMap(s => s.items);
    const currentIndex = allItems.findIndex(i => i.id === this.currentNav);
    if (currentIndex > 0) {
      this.currentNav = allItems[currentIndex - 1].id;
    }
  }

  private navigateDown(): void {
    const allItems = this.navSections.flatMap(s => s.items);
    const currentIndex = allItems.findIndex(i => i.id === this.currentNav);
    if (currentIndex < allItems.length - 1) {
      this.currentNav = allItems[currentIndex + 1].id;
    }
  }

  // 选择当前项
  private selectCurrent(): void {
    if (this.currentNav === 'chat') {
      this.inputMode = 'chat';
    } else if (this.currentNav === 'config') {
      // 配置页面使用数字键选择，这里不需要
    }
  }

  // 应用编辑
  private async applyEdit(): Promise<void> {
    if (!this.editState) return;

    const field = this.editState.field;
    const value = this.editState.value;

    switch (field) {
      case 'provider':
        this.config.provider = value as any;
        break;
      case 'baseUrl':
        this.config.baseUrl = value;
        break;
      case 'apiKey':
        this.config.apiKey = value;
        break;
      case 'model':
        this.config.model = value;
        break;
      case 'temperature':
        this.config.temperature = parseFloat(value) || 0.7;
        break;
      case 'maxTokens':
        this.config.maxTokens = parseInt(value) || 4096;
        break;
      case 'maxIterations':
        this.config.maxIterations = parseInt(value) || 100;
        break;
    }

    await this.configManager.update(this.config);
    this.addMessage('system', `✅ ${field} 已更新为: ${value}`);

    // 重新创建Agent
    if (this.agent) {
      await this.agent.stop();
      this.agent = new AIAgent({
        model: this.config.model,
        provider: this.config.provider as any,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        systemPrompt: this.getSystemPrompt(),
        tools: globalToolRegistry.getAllTools(),
      });
      this.agent.onEvent((event: AgentEvent) => this.handleAgentEvent(event));
      await this.agent.start();
    }
  }

  // 处理配置页面的数字键输入
  async handleConfigKey(key: string): Promise<void> {
    switch (key) {
      case '1':
        this.editState = { field: 'provider', value: this.config.provider };
        this.inputMode = 'edit';
        break;
      case '2':
        this.editState = { field: 'baseUrl', value: this.config.baseUrl };
        this.inputMode = 'edit';
        break;
      case '3':
        this.editState = { field: 'apiKey', value: this.config.apiKey };
        this.inputMode = 'edit';
        break;
      case '4':
        this.editState = { field: 'model', value: this.config.model };
        this.inputMode = 'edit';
        break;
      case '5':
        this.editState = { field: 'temperature', value: this.config.temperature.toString() };
        this.inputMode = 'edit';
        break;
      case '6':
        this.editState = { field: 'maxTokens', value: this.config.maxTokens.toString() };
        this.inputMode = 'edit';
        break;
      case '7':
        this.editState = { field: 'maxIterations', value: this.config.maxIterations.toString() };
        this.inputMode = 'edit';
        break;
      case 's':
      case 'S':
        await this.configManager.update(this.config);
        this.addMessage('system', '✅ 配置已保存');
        break;
      case 'r':
      case 'R':
        this.inputMode = 'confirm';
        break;
      case 'q':
      case 'Q':
        this.currentNav = 'chat';
        break;
    }
    this.render();
  }
}
