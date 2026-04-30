<?php
/**
 * 马虾 MAXIA - 产品介绍页面
 */
$page = 'products';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>产品功能 - 马虾 MAXIA</title>
  <meta name="color-scheme" content="dark light">
  <link rel="icon" href="/maxia.png">
  <link rel="stylesheet" href="/index.css">
  <style>
    .products-page {
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .products-hero {
      text-align: center;
      padding: 20px;
      margin-bottom: 40px;
    }
    .products-hero h1 {
      font-size: 36px;
      margin-bottom: 16px;
      color: var(--accent);
    }
    .products-hero p {
      font-size: 18px;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
    }
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      margin-bottom: 60px;
    }
    .product-card {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 28px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }
    .product-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
      box-shadow: 0 12px 40px rgba(233, 69, 96, 0.15);
    }
    .product-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .product-card h3 {
      font-size: 20px;
      margin-bottom: 12px;
      color: var(--text);
    }
    .product-card p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .product-features {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .product-features li {
      font-size: 13px;
      color: var(--text-muted);
      padding: 6px 0;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .product-features li::before {
      content: '✓';
      color: var(--success);
      font-weight: bold;
    }
    .pricing-section {
      text-align: center;
      padding: 60px 20px;
      background: var(--bg-secondary);
      border-radius: 20px;
      margin-bottom: 40px;
    }
    .pricing-section h2 {
      font-size: 28px;
      margin-bottom: 12px;
    }
    .pricing-section p {
      color: var(--text-muted);
      margin-bottom: 32px;
    }
    .pricing-badge {
      display: inline-block;
      background: var(--accent);
      color: white;
      padding: 12px 32px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
    }
    .cta-section {
      text-align: center;
      padding: 60px 20px;
    }
    .cta-section h2 {
      font-size: 28px;
      margin-bottom: 16px;
    }
    .cta-section p {
      color: var(--text-muted);
      margin-bottom: 24px;
    }
    .btn-large {
      padding: 16px 40px;
      font-size: 16px;
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
          <a class="nav-item active" href="products.php">
            <span class="nav-text">📦 产品功能</span>
          </a>
          <a class="nav-item" href="about.php">
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
          <span class="status-text">免费开源</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <div class="products-page">
        <div class="products-hero">
          <h1>📦 产品功能</h1>
          <p>马虾 MAXIA 是一款强大的本地AI助手，帮助您高效完成各种任务</p>
        </div>

        <div class="products-grid">
          <div class="product-card">
            <div class="product-icon">💬</div>
            <h3>智能对话</h3>
            <p>基于先进的AI模型，提供流畅自然的对话体验，支持多轮对话和上下文理解。</p>
            <ul class="product-features">
              <li>流式响应输出</li>
              <li>多轮对话记忆</li>
              <li>上下文理解</li>
            </ul>
          </div>

          <div class="product-card">
            <div class="product-icon">📁</div>
            <h3>文件操作</h3>
            <p>强大的文件管理能力，支持读取、创建、编辑和删除文件和目录。</p>
            <ul class="product-features">
              <li>文件读写</li>
              <li>目录管理</li>
              <li>批量操作</li>
            </ul>
          </div>

          <div class="product-card">
            <div class="product-icon">💻</div>
            <h3>终端命令</h3>
            <p>直接执行系统终端命令，让AI助手帮您完成各种系统操作任务。</p>
            <ul class="product-features">
              <li>命令执行</li>
              <li>结果解析</li>
              <li>错误处理</li>
            </ul>
          </div>

          <div class="product-card">
            <div class="product-icon">🔧</div>
            <h3>Skills扩展</h3>
            <p>支持插件式扩展，通过安装Skills来增强AI助手的能力。</p>
            <ul class="product-features">
              <li>一键安装</li>
              <li>热插拔加载</li>
              <li>社区分享</li>
            </ul>
          </div>

          <div class="product-card">
            <div class="product-icon">🔄</div>
            <h3>容错机制</h3>
            <p>智能重试和备用模型切换，确保服务的高可用性。</p>
            <ul class="product-features">
              <li>自动重试</li>
              <li>备用模型</li>
              <li>故障转移</li>
            </ul>
          </div>

          <div class="product-card">
            <div class="product-icon">🎨</div>
            <h3>美观界面</h3>
            <p>精心设计的Web界面，支持明暗主题切换，使用体验流畅舒适。</p>
            <ul class="product-features">
              <li>响应式设计</li>
              <li>主题切换</li>
              <li>动画效果</li>
            </ul>
          </div>
        </div>

        <div class="pricing-section">
          <h2>💰 价格</h2>
          <p>马虾 MAXIA 是一款完全免费的开源软件</p>
          <span class="pricing-badge">完全免费 · 开源MIT</span>
        </div>

        <div class="cta-section">
          <h2>🚀 立即开始使用</h2>
          <p>下载并安装马虾 MAXIA，体验强大的本地AI助手</p>
          <a href="index.html" class="btn btn-primary btn-large">开始聊天</a>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
