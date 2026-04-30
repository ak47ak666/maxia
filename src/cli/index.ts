#!/usr/bin/env node

/**
 * 马虾 (MAXIA) - CLI入口
 */

import { Command } from 'commander';
import { TUIMenu } from '../tui/components/app.js';

const program = new Command();

program
  .name('maxia')
  .description('🦞 马虾 - 本地AI Agent工具')
  .version('1.0.0');

program
  .command('chat')
  .description('启动聊天界面')
  .action(async () => {
    console.log('🦞 马虾启动中...\n');

    const app = new TUIMenu();
    await app.run();
  });

program
  .command('tools')
  .description('列出所有可用工具')
  .action(() => {
    console.log('可用工具列表:\n');
    console.log('  📁 文件操作:');
    console.log('    - read_file: 读取文件内容');
    console.log('    - write_file: 写入内容到文件');
    console.log('    - create_directory: 创建目录');
    console.log('    - list_directory: 列出目录内容');
    console.log('    - delete_file: 删除文件或目录');
    console.log('    - copy_file: 复制文件或目录');
    console.log('');
    console.log('  💻 终端:');
    console.log('    - execute_command: 执行终端命令');
    console.log('  ⚙️ 系统:');
    console.log('    - get_system_info: 获取系统信息');
    console.log('    - get_environment: 获取环境变量');
    console.log('  🤖 任务委托:');
    console.log('    - delegate_task: 委托单个子任务给子代理执行');
    console.log('    - delegate_tasks_parallel: 并行委托多个子任务');
  });

program.parse();
