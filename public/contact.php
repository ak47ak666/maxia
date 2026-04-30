<?php
/**
 * 马虾 MAXIA - 联系我们页面
 */
$page = 'contact';

// 处理表单提交
$submitSuccess = false;
$submitError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $subject = trim($_POST['subject'] ?? '');
    $message = trim($_POST['message'] ?? '');
    
    if (empty($name) || empty($email) || empty($subject) || empty($message)) {
        $submitError = '请填写所有必填字段';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $submitError = '请输入有效的邮箱地址';
    } else {
        // 这里可以添加发送邮件的逻辑
        // 目前只是模拟成功提交
        $submitSuccess = true;
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>联系我们 - 马虾 MAXIA</title>
  <meta name="color-scheme" content="dark light">
  <link rel="icon" href="/maxia.png">
  <link rel="stylesheet" href="/index.css">
  <style>
    .contact-page {
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .contact-hero {
      text-align: center;
      padding: 20px;
      margin-bottom: 40px;
    }
    .contact-hero h1 {
      font-size: 36px;
      margin-bottom: 12px;
      color: var(--accent);
    }
    .contact-hero p {
      font-size: 18px;
      color: var(--text-muted);
      max-width: 500px;
      margin: 0 auto;
    }
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    @media (max-width: 768px) {
      .contact-grid {
        grid-template-columns: 1fr;
      }
    }
    .contact-form-section {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 32px;
    }
    .contact-form-section h2 {
      font-size: 22px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 8px;
    }
    .form-group label .required {
      color: var(--error);
    }
    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--accent);
    }
    .form-group textarea {
      min-height: 120px;
      resize: vertical;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .submit-btn {
      width: 100%;
      padding: 14px;
      font-size: 15px;
    }
    .form-message {
      padding: 16px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .form-message.success {
      background: rgba(74, 222, 128, 0.15);
      border: 1px solid var(--success);
      color: var(--success);
    }
    .form-message.error {
      background: rgba(248, 113, 113, 0.15);
      border: 1px solid var(--error);
      color: var(--error);
    }
    .contact-info-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .info-card {
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 24px;
      flex: 1;
    }
    .info-card h3 {
      font-size: 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .info-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    .info-content h4 {
      font-size: 14px;
      margin-bottom: 4px;
      color: var(--text);
    }
    .info-content p {
      font-size: 13px;
      color: var(--text-muted);
      margin: 0;
    }
    .social-links {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    .social-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--bg);
      border-radius: 50%;
      font-size: 20px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .social-link:hover {
      background: var(--accent);
      transform: translateY(-2px);
    }
    .faq-section {
      margin-top: 40px;
      background: var(--bg-secondary);
      border-radius: 16px;
      padding: 32px;
    }
    .faq-section h2 {
      font-size: 22px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .faq-item {
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
    }
    .faq-item:last-child {
      border-bottom: none;
    }
    .faq-item h4 {
      font-size: 15px;
      margin-bottom: 8px;
      color: var(--text);
    }
    .faq-item p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      margin: 0;
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
          <a class="nav-item" href="products.php">
            <span class="nav-text">📦 产品功能</span>
          </a>
          <a class="nav-item" href="about.php">
            <span class="nav-text">ℹ️ 关于我们</span>
          </a>
          <a class="nav-item active" href="contact.php">
            <span class="nav-text">📧 联系我们</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="status">
          <span class="status-dot"></span>
          <span class="status-text">期待您的来信</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <div class="contact-page">
        <div class="contact-hero">
          <h1>📧 联系我们</h1>
          <p>有任何问题或建议？我们很乐意听到您的声音</p>
        </div>

        <div class="contact-grid">
          <!-- 联系表单 -->
          <div class="contact-form-section">
            <h2>✉️ 发送消息</h2>
            
            <?php if ($submitSuccess): ?>
            <div class="form-message success">
              ✅ 感谢您的反馈！我们会尽快回复您。
            </div>
            <?php elseif ($submitError): ?>
            <div class="form-message error">
              ⚠️ <?php echo htmlspecialchars($submitError); ?>
            </div>
            <?php endif; ?>

            <form method="POST" action="contact.php">
              <div class="form-row">
                <div class="form-group">
                  <label>姓名 <span class="required">*</span></label>
                  <input type="text" name="name" placeholder="您的姓名" 
                         value="<?php echo htmlspecialchars($_POST['name'] ?? ''); ?>" required>
                </div>
                <div class="form-group">
                  <label>邮箱 <span class="required">*</span></label>
                  <input type="email" name="email" placeholder="your@email.com"
                         value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>" required>
                </div>
              </div>
              
              <div class="form-group">
                <label>主题 <span class="required">*</span></label>
                <select name="subject" required>
                  <option value="">请选择主题</option>
                  <option value="feedback" <?php echo (($_POST['subject'] ?? '') === 'feedback') ? 'selected' : ''; ?>>产品反馈</option>
                  <option value="bug" <?php echo (($_POST['subject'] ?? '') === 'bug') ? 'selected' : ''; ?>>报告Bug</option>
                  <option value="feature" <?php echo (($_POST['subject'] ?? '') === 'feature') ? 'selected' : ''; ?>>功能建议</option>
                  <option value="cooperation" <?php echo (($_POST['subject'] ?? '') === 'cooperation') ? 'selected' : ''; ?>>商务合作</option>
                  <option value="other" <?php echo (($_POST['subject'] ?? '') === 'other') ? 'selected' : ''; ?>>其他</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>留言内容 <span class="required">*</span></label>
                <textarea name="message" placeholder="请详细描述您的问题或建议..." required><?php echo htmlspecialchars($_POST['message'] ?? ''); ?></textarea>
              </div>
              
              <button type="submit" class="btn btn-primary submit-btn">📤 发送消息</button>
            </form>
          </div>

          <!-- 联系信息 -->
          <div class="contact-info-section">
            <div class="info-card">
              <h3>📬 联系方式</h3>
              <div class="info-item">
                <span class="info-icon">📧</span>
                <div class="info-content">
                  <h4>电子邮件</h4>
                  <p>contact@maxia.example.com</p>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon">💬</span>
                <div class="info-content">
                  <h4>在线反馈</h4>
                  <p>欢迎提交Issue或Pull Request</p>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon">🌐</span>
                <div class="info-content">
                  <h4>官方网站</h4>
                  <p>www.maxia.example.com</p>
                </div>
              </div>
              
              <h3 style="margin-top: 24px;">🔗 关注我们</h3>
              <div class="social-links">
                <a href="#" class="social-link" title="GitHub">🐙</a>
                <a href="#" class="social-link" title="微信">💬</a>
                <a href="#" class="social-link" title="微博">📱</a>
                <a href="#" class="social-link" title="邮箱">📧</a>
              </div>
            </div>

            <div class="info-card">
              <h3>⏰ 响应时间</h3>
              <div class="info-item">
                <span class="info-icon">🕐</span>
                <div class="info-content">
                  <h4>工作日</h4>
                  <p>周一至周五 9:00 - 18:00</p>
                </div>
              </div>
              <div class="info-item">
                <span class="info-icon">🎉</span>
                <div class="info-content">
                  <h4>社区支持</h4>
                  <p>GitHub Issues 全天候开放</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 常见问题 -->
        <div class="faq-section">
          <h2>❓ 常见问题</h2>
          
          <div class="faq-item">
            <h4>如何获取API Key？</h4>
            <p>您可以在各AI服务提供商（如OpenAI、Anthropic）的官网注册账号并获取API Key。马虾MAXIA会在本地安全存储您的密钥。</p>
          </div>
          
          <div class="faq-item">
            <h4>数据是否会上传到服务器？</h4>
            <p>不会。马虾MAXIA是一款本地应用，所有对话数据都存储在您的本地设备上，不会发送到任何远程服务器。</p>
          </div>
          
          <div class="faq-item">
            <h4>支持哪些AI模型？</h4>
            <p>支持OpenAI GPT系列、Anthropic Claude系列、Ollama本地模型以及兼容OpenAI API格式的自定义模型。</p>
          </div>
          
          <div class="faq-item">
            <h4>如何安装Skills插件？</h4>
            <p>在应用界面中进入"安装Skills"页面，可以拖拽或选择Skills压缩包进行安装。安装后插件会自动加载。</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
