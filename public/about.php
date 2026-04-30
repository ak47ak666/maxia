<?php
/**
 * 马虾 MAXIA - 关于我们页面
 */
$page = 'about';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>关于我们 - 马虾 MAXIA</title>
  <meta name="color-scheme" content="dark light">
  <link rel="icon" href="/maxia.png">
  <link rel="stylesheet" href="/index.css">
  <style>
    .about-page {
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .about-hero {
      text-align: center;
      padding: 20px;
      margin-bottom: 40px;
    }
    .about-hero .logo-large {
      width: 120px;
      height: 120px;
      margin-bottom: 24px;
    }
    .about-hero h1 {
      font-size: 36px;
      margin-bottom: 12px;
      color: var(--accent);
    }
    .about-hero .version {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .about-hero p {
      font-size: 18px;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.8;
    }
    .about-section {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .about-section h2 {
      font-size: 22px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .about-section p {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.8;
    }
    .features-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--bg);
      border-radius: 12px;
    }
    .feature-icon {
      font-size: 28px;
      flex-shrink: 0;
    }
    .feature-content h4 {
      font-size: 15px;
      margin-bottom: 4px;
      color: var(--text);
    }
    .feature-content p {
      font-size: 13px;
      margin: 0;
    }
    .tech-stack {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }
    .tech-tag {
      padding: 8px 16px;
      background: var(--bg);
      border-radius: 20px;
      font-size: 13px;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .license-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: var(--accent);
      color: white;
      border-radius: 30px;
      font-weight: 600;
      margin-top: 16px;
    }
    .nav-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .nav-links a:hover,
    .nav-links a.active {
      background: var(--accent);
      color: white;
    }
    .contributors {
      margin-top: 20px;
    }
    .contributor {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .contributor-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
    }
    .contributor-info h4 {
      font-size: 14px;
      margin-bottom: 2px;
    }
    .contributor-info p {
      font-size: 12px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- 简化侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <img src="/maxia.png" alt="MAXIA" class="logo-img">
          <span class="logo-text">MAXIA</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">导航</div>
          <a class="nav-item" href="index.html">
            <span class="nav-text">🏠 首页</span>
          </a>
          <a class="nav-item" href="products.php">
            <span class="nav-text">📦 产品功能</span>
          </a>
          <a class="nav-item active" href="about.php">
            <span class="nav-text">ℹ️ 关于我们</span>
          </a>
          <a class="nav-item" href="contact.php">
            <span class="nav-text">📧 联系我们</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="status">
          <span class="status-dot"></span>
          <span class="status-text">开源项目</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <div class="about-page">
        <div class="about-hero">
          <img src="/maxia.png" alt="MAXIA" class="logo-large">
          <h1>马虾 MAXIA</h1>
          <p class="version">Version 1.0.0</p>
          <p>您的本地AI助手，让人工智能触手可及。<br>完全开源，隐私友好，功能强大。</p>
          <span class="license-badge">📜 MIT License</span>
        </div>

        <div class="about-section">
          <h2>🚀 项目简介</h2>
          <p>马虾 MAXIA 是一款专为本地环境设计的AI助手应用。它可以帮助您完成各种任务，包括智能对话、文件操作、终端命令执行等。基于现代Web技术构建，提供美观易用的界面。</p>
          
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">🔒</span>
              <div class="feature-content">
                <h4>隐私优先</h4>
                <p>所有数据本地处理，保护您的隐私安全</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">⚡</span>
              <div class="feature-content">
                <h4>高性能</h4>
                <p>基于Node.js构建，响应速度快，运行稳定</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🎨</span>
              <div class="feature-content">
                <h4>美观界面</h4>
                <p>精心设计的UI/UX，支持明暗主题</p>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🧩</span>
              <div class="feature-content">
                <h4>可扩展</h4>
                <p>支持Skills插件扩展功能</p>
              </div>
            </div>
          </div>
        </div>

        <div class="about-section">
          <h2>🛠️ 技术栈</h2>
          <p>使用业界领先的技术构建</p>
          <div class="tech-stack">
            <span class="tech-tag">TypeScript</span>
            <span class="tech-tag">Node.js</span>
            <span class="tech-tag">Express</span>
            <span class="tech-tag">WebSocket</span>
            <span class="tech-tag">HTML5</span>
            <span class="tech-tag">CSS3</span>
            <span class="tech-tag">PHP</span>
          </div>
        </div>

        <div class="about-section">
          <h2>👥 开发团队</h2>
          <p>由热爱技术的小伙伴们共同开发</p>
          <div class="contributors">
            <div class="contributor">
              <div class="contributor-avatar">M</div>
              <div class="contributor-info">
                <h4>MAXIA Team</h4>
                <p>项目发起人 & 核心开发者</p>
              </div>
            </div>
            <div class="contributor">
              <div class="contributor-avatar">🦐</div>
              <div class="contributor-info">
                <h4>贡献者们</h4>
                <p>感谢所有为项目贡献代码的朋友</p>
              </div>
            </div>
          </div>
        </div>

        <div class="about-section" style="text-align: center;">
          <h2 style="justify-content: center;">💝 支持我们</h2>
          <p>如果您觉得这个项目对您有帮助，欢迎 star ⭐ 和分享</p>
          <div style="margin-top: 24px;">
            <a href="index.html" class="btn btn-primary" style="margin-right: 12px;">开始使用</a>
            <a href="contact.php" class="btn btn-secondary">联系我们</a>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
