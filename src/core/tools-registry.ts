/**
 * 工具注册表 - 集中管理所有工具的注册
 */

import { globalToolRegistry } from './tool-registry/registry.js';

// 工具类导入
import {
  ReadFileTool,
  WriteFileTool,
  CreateDirectoryTool,
  ListDirectoryTool,
  DeleteFileTool,
  CopyFileTool,
  MoveFileTool,
  FileInfoTool,
  SearchFilesTool,
  GrepTool,
  PatchTool,
  ReadBinaryTool,
  DirectorySizeTool,
} from '../tools/file-tools.js';

import {
  ExecuteCommandTool,
  GetSystemInfoTool,
  GetEnvironmentTool,
  ProcessListTool,
  KillProcessTool,
  SystemControlTool,
  PortCheckTool,
} from '../tools/terminal-tool.js';

import {
  GitStatusTool,
  GitLogTool,
  GitDiffTool,
  GitBranchTool,
  GitCommitTool,
  GitPushTool,
  GitPullTool,
  GitCloneTool,
  GitStashTool,
  GitRemoteTool,
} from '../tools/git-tools.js';

import {
  WebSearchTool,
  WebFetchTool,
  WebScreenshotTool,
  IpInfoTool,
  WhoisTool,
  DnsLookupTool,
} from '../tools/web-tools.js';

import {
  ImageAnalyzeTool,
  ImageInfoTool,
  ImageGenerateTool,
  ImageResizeTool,
  ImageConvertTool,
  PdfInfoTool,
  PdfExtractTextTool,
  AudioTranscribeTool,
  TextToSpeechTool,
} from '../tools/media-tools.js';

import {
  CronListTool,
  CronCreateTool,
  CronDeleteTool,
  CronToggleTool,
  CronRunTool,
} from '../tools/cron-tools.js';

import {
  PingTool,
  HttpCheckTool,
  TracerouteTool,
  DnsResolveTool,
  PortScanTool,
  BandwidthTestTool,
} from '../tools/network-tools.js';

import {
  SkillsListTool,
  SkillViewTool,
  SkillsMatchTool,
} from '../tools/skills-tools.js';

import {
  DelegateTaskTool,
  DelegateTasksParallelTool,
} from '../tools/delegate-tool.js';

/**
 * 注册所有内置工具
 */
export function registerBuiltinTools(): void {
  const toolClasses = [
    // 文件操作工具
    ReadFileTool,
    WriteFileTool,
    CreateDirectoryTool,
    ListDirectoryTool,
    DeleteFileTool,
    CopyFileTool,
    MoveFileTool,
    FileInfoTool,
    SearchFilesTool,
    GrepTool,
    PatchTool,
    ReadBinaryTool,
    DirectorySizeTool,
    // 终端/系统工具
    ExecuteCommandTool,
    GetSystemInfoTool,
    GetEnvironmentTool,
    ProcessListTool,
    KillProcessTool,
    SystemControlTool,
    PortCheckTool,
    // Git 工具
    GitStatusTool,
    GitLogTool,
    GitDiffTool,
    GitBranchTool,
    GitCommitTool,
    GitPushTool,
    GitPullTool,
    GitCloneTool,
    GitStashTool,
    GitRemoteTool,
    // 网页工具
    WebSearchTool,
    WebFetchTool,
    WebScreenshotTool,
    IpInfoTool,
    WhoisTool,
    DnsLookupTool,
    // 媒体工具
    ImageAnalyzeTool,
    ImageInfoTool,
    ImageGenerateTool,
    ImageResizeTool,
    ImageConvertTool,
    PdfInfoTool,
    PdfExtractTextTool,
    AudioTranscribeTool,
    TextToSpeechTool,
    // Cron 定时任务
    CronListTool,
    CronCreateTool,
    CronDeleteTool,
    CronToggleTool,
    CronRunTool,
    // 网络工具
    PingTool,
    HttpCheckTool,
    TracerouteTool,
    DnsResolveTool,
    PortScanTool,
    BandwidthTestTool,
    // Skills 技能工具
    SkillsListTool,
    SkillViewTool,
    SkillsMatchTool,
    // 委托工具
    DelegateTaskTool,
    DelegateTasksParallelTool,
  ];

  for (const ToolClass of toolClasses) {
    try {
      const tool = new ToolClass();
      globalToolRegistry.register(tool);
    } catch (error) {
      console.warn(`注册工具 ${ToolClass.name} 失败:`, error);
    }
  }
}
