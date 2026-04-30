---
name: example-skill
description: 这是一个示例技能，展示了SKILL.md的标准格式。在需要测试技能系统或查看格式时使用这个技能。
metadata:
  emoji: 📝
  os: [windows, linux, darwin]
  requires:
    bins: [echo]
---

# 示例技能

这是一个示例技能文件，展示了马虾Skills的标准格式。

## 使用方法

当用户请求与示例相关的内容时，可以调用 `skill_view` 工具来查看此技能。

## 技能结构

```
skills/
└── example/           ← 技能目录
    └── SKILL.md       ← 技能定义文件（必需）
```

## Frontmatter 字段

| 字段 | 必需 | 说明 |
|------|------|------|
| name | 是 | 技能名称 |
| description | 是 | 技能描述，说明何时使用 |
| metadata.emoji | 否 | emoji图标 |
| metadata.os | 否 | 支持的操作系统 |
| metadata.requires.bins | 否 | 依赖的命令 |

## 内容格式

技能内容使用 Markdown 格式书写，可以包含：

- 使用说明
- 命令示例
- 参考文档链接
- 子命令说明

## 示例命令

```bash
# 列出所有技能
echo "使用 skills_list 工具"

# 查看技能详情
echo "使用 skill_view 工具指定技能名称"
```
