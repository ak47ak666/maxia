/**
 * Skills 类型定义 - 增强版
 */

export interface SkillParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  enum?: string[];
  pattern?: string;
}

export interface SkillDependency {
  name: string;
  version?: string;
  type: 'skill' | 'binary' | 'npm' | 'pip' | 'system';
  optional?: boolean;
  checkCommand?: string;
}

export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  license?: string;
  platforms?: string[];
  prerequisites?: {
    env_vars?: string[];
    commands?: string[];
  };
  compatibility?: string;
  parameters?: SkillParameter[];
  dependencies?: SkillDependency[];
  metadata?: {
    emoji?: string;
    os?: string[];
    requires?: {
      bins?: string[];
      anyBins?: string[];
      env?: string[];
      config?: string[];
    };
    install?: {
      id?: string;
      kind?: string;
      formula?: string;
      bins?: string[];
      label?: string;
    }[];
    [key: string]: unknown;
  };
}

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  content: string;
  metadata: SkillMetadata;
  source?: string;
}

export interface SkillExecutionContext {
  sessionId: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  license?: string;
  platforms?: string[];
  prerequisites?: {
    env_vars?: string[];
    commands?: string[];
  };
  compatibility?: string;
  parameters?: SkillParameter[];
  dependencies?: SkillDependency[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SkillMatch {
  skill: Skill;
  score: number;
  matchedKeywords: string[];
  matchedParameters: string[];
}
