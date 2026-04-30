/**
 * 马虾 Web界面 JavaScript
 */

const API_BASE = '';

// 状态
let currentPage = 'chat';
let messages = [];
let isLoading = false;
let currentSessionId = null;
let loadingMessageId = null;  // 跟踪加载中的消息ID

// 任务列表
const tasks = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadConfig();
  loadTools();
  initChatInput();
  // 启动任务轮询
  startTaskPolling();
});

// 初始化导航
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

// 导航到指定页面
function navigateTo(page) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // 更新页面显示
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  currentPage = page;

  // 如果进入历史页面，加载会话列表
  if (page === 'history') {
    loadSessions();
  }

  // 如果进入skills安装页面，加载已安装的skills列表
  if (page === 'skills-install') {
    loadInstalledSkills();
    initDropZone();
  }
}

// 显示聊天页面
function showChat() {
  navigateTo('chat');
}

// 显示配置页面
function showConfig() {
  navigateTo('config');
  loadConfig();
}

// 初始化聊天输入
function initChatInput() {
  const input = document.getElementById('chatInput');

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  });
}

// 加载配置
async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const config = await res.json();

    document.getElementById('config-provider').value = config.provider || 'openai';
    document.getElementById('config-baseUrl').value = config.baseUrl || 'https://api.openai.com/v1';
    document.getElementById('config-apiKey').value = config.apiKey || '';
    document.getElementById('config-model').value = config.model || 'gpt-4';
    document.getElementById('config-temperature').value = config.temperature || 0.7;
    document.getElementById('config-maxTokens').value = config.maxTokens || 4096;

    // 容错设置
    document.getElementById('config-enableRetry').checked = config.enableRetry !== false;
    document.getElementById('config-maxRetries').value = config.maxRetries || 3;

    // 加载备用模型
    renderFallbackProviders(config.fallbackProviders || []);
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 渲染备用模型列表
function renderFallbackProviders(providers) {
  const container = document.getElementById('fallbackProviders');
  if (!providers || providers.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无备用模型</p>';
    return;
  }

  container.innerHTML = providers.map((p, idx) => `
    <div class="fallback-provider-item">
      <div class="fallback-provider-header">
        <span>备用模型 #${idx + 1}</span>
        <button type="button" class="btn-icon" onclick="removeFallbackProvider(${idx})" title="删除">🗑️</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>提供商</label>
          <select id="fb-provider-${idx}">
            <option value="openai" ${p.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="anthropic" ${p.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
            <option value="ollama" ${p.provider === 'ollama' ? 'selected' : ''}>Ollama</option>
            <option value="custom" ${p.provider === 'custom' ? 'selected' : ''}>自定义</option>
          </select>
        </div>
        <div class="form-group">
          <label>模型</label>
          <input type="text" id="fb-model-${idx}" value="${p.model || ''}" placeholder="如: gpt-4o-mini">
        </div>
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="fb-apiKey-${idx}" value="${p.apiKey || ''}" placeholder="备用模型的API Key">
      </div>
      <div class="form-group">
        <label>API 地址 (可选)</label>
        <input type="text" id="fb-baseUrl-${idx}" value="${p.baseUrl || ''}" placeholder="如与主模型相同可留空">
      </div>
    </div>
  `).join('');
}

// 添加备用模型
function addFallbackProvider() {
  const container = document.getElementById('fallbackProviders');
  const emptyHint = container.querySelector('.empty-hint');
  if (emptyHint) emptyHint.remove();

  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'fallback-provider-item';
  div.innerHTML = `
    <div class="fallback-provider-header">
      <span>备用模型 #${idx + 1}</span>
      <button type="button" class="btn-icon" onclick="removeFallbackProvider(${idx})" title="删除">🗑️</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>提供商</label>
        <select id="fb-provider-${idx}">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div class="form-group">
        <label>模型</label>
        <input type="text" id="fb-model-${idx}" placeholder="如: gpt-4o-mini">
      </div>
    </div>
    <div class="form-group">
      <label>API Key</label>
      <input type="password" id="fb-apiKey-${idx}" placeholder="备用模型的API Key">
    </div>
    <div class="form-group">
      <label>API 地址 (可选)</label>
      <input type="text" id="fb-baseUrl-${idx}" placeholder="如与主模型相同可留空">
    </div>
  `;
  container.appendChild(div);
}

// 移除备用模型
function removeFallbackProvider(idx) {
  const container = document.getElementById('fallbackProviders');
  const items = container.querySelectorAll('.fallback-provider-item');
  if (items[idx]) {
    items[idx].remove();
    // 重新编号
    renderFallbackProviders(getFallbackProvidersFromUI());
  }
}

// 从UI获取备用模型配置
function getFallbackProvidersFromUI() {
  const container = document.getElementById('fallbackProviders');
  const items = container.querySelectorAll('.fallback-provider-item');
  const providers = [];

  items.forEach((item) => {
    const modelInput = item.querySelector('input[id^="fb-model-"]');
    const model = modelInput ? modelInput.value.trim() : '';
    if (model) {
      const idx = modelInput.id.replace('fb-model-', '');
      providers.push({
        provider: document.getElementById(`fb-provider-${idx}`)?.value || 'openai',
        model: model,
        apiKey: document.getElementById(`fb-apiKey-${idx}`)?.value || '',
        baseUrl: document.getElementById(`fb-baseUrl-${idx}`)?.value || '',
      });
    }
  });

  return providers;
}

// 保存配置
async function saveConfig() {
  const config = {
    provider: document.getElementById('config-provider').value,
    baseUrl: document.getElementById('config-baseUrl').value,
    apiKey: document.getElementById('config-apiKey').value,
    model: document.getElementById('config-model').value,
    temperature: parseFloat(document.getElementById('config-temperature').value),
    maxTokens: parseInt(document.getElementById('config-maxTokens').value),
    // 容错设置
    enableRetry: document.getElementById('config-enableRetry').checked,
    maxRetries: parseInt(document.getElementById('config-maxRetries').value) || 3,
    // 备用模型
    fallbackProviders: getFallbackProvidersFromUI(),
  };

  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (res.ok) {
      alert('配置已保存！');
    } else {
      alert('保存失败');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存失败: ' + error.message);
  }
}

// 重置配置
async function resetConfig() {
  if (!confirm('确定要重置为默认配置吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4',
        provider: 'openai',
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0.7,
        maxTokens: 4096,
        maxIterations: 100,
        enableRetry: true,
        maxRetries: 3,
        fallbackProviders: [],
      }),
    });

    if (res.ok) {
      loadConfig();
      alert('配置已重置');
    }
  } catch (error) {
    console.error('重置配置失败:', error);
  }
}

// 加载工具列表
async function loadTools() {
  try {
    const res = await fetch(`${API_BASE}/api/tools`);
    const tools = await res.json();

    const container = document.getElementById('toolsList');
    container.innerHTML = tools.map(tool => `
      <div class="tool-card">
        <h3>
          <span class="tool-icon">🔧</span>
          ${tool.name}
        </h3>
        <p>${tool.description}</p>
        <div class="tool-params">
          ${tool.parameters.map(p => `
            <div class="tool-param">
              <span class="tool-param-name">${p.name}</span>
              <span class="tool-param-type">(${p.type})</span>
              <span>${p.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (error) {
    document.getElementById('toolsList').innerHTML = '<div class="error">加载工具失败</div>';
  }
}

// 发送消息 - 使用任务列表模式
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message || isLoading) return;

  // 重置加载消息ID
  loadingMessageId = null;

  // 清空输入框
  input.value = '';

  // 添加用户消息到界面
  addMessage('user', message);

  // 显示加载状态
  isLoading = true;
  const loadingMsg = addMessage('assistant', '处理中...', true);

  // 显示任务列表
  showTaskList();

  try {
    // 1. 创建任务
    const createRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: currentSessionId }),
    });

    const createData = await createRes.json();

    if (createData.error) {
      loadingMsg.remove();
      addMessage('system', '错误: ' + createData.error);
      isLoading = false;
      return;
    }

    const { taskId, sessionId } = createData;
    currentSessionId = sessionId;

    // 2. 将任务添加到任务列表
    tasks.push({
      id: taskId,
      status: 'running',
      logs: [],
      result: '',
      message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
    });

    // 3. 立即渲染任务列表
    renderTaskList();

  } catch (error) {
    loadingMsg.remove();
    addMessage('system', '请求失败: ' + error.message);
    isLoading = false;
  }
}

// 启动任务轮询
let pollInterval = null;
let pollTick = 0;
function startTaskPolling() {
  if (pollInterval) return;
  console.log('任务轮询已启动');
  pollInterval = setInterval(async () => {
    pollTick++;
    if (pollTick % 10 === 0) {
      console.log('轮询中...', tasks.length, '个任务');
    }
    if (tasks.length === 0) return;

    for (const task of tasks) {
      if (task.status !== 'running' && task.status !== 'verifying') continue;

      try {
        const res = await fetch(`${API_BASE}/api/chat/poll/${task.id}`);
        if (!res.ok) {
          console.error('轮询请求失败:', res.status);
          continue;
        }

        const data = await res.json();

        // 只有状态或日志变化时才更新UI
        if (task.status !== data.status || JSON.stringify(task.logs) !== JSON.stringify(data.logs || [])) {
          console.log('任务更新:', task.id, data.status, data.logs);
          task.status = data.status;
          task.logs = data.logs || [];
          task.result = data.result || '';
          renderTaskList();
        }

        // 任务完成时
        if (data.status === 'completed' || data.status === 'failed') {
          console.log('任务完成:', task.id, data.status, data.result);
          isLoading = false;

          // 移除loading消息（通过之前记录的ID）
          if (loadingMessageId) {
            const loadingEl = document.getElementById(loadingMessageId);
            if (loadingEl) {
              loadingEl.remove();
            }
            loadingMessageId = null;
          }

          // 添加结果消息
          if (data.result) {
            addMessage('assistant', data.result);
          }

          // 延迟清理任务
          setTimeout(() => {
            const idx = tasks.findIndex(t => t.id === task.id);
            if (idx >= 0) tasks.splice(idx, 1);
            renderTaskList();
          }, 5000);
        }
      } catch (error) {
        console.error('轮询错误:', error);
      }
    }
  }, 1000);
}

// 渲染任务列表
function renderTaskList() {
  const container = document.getElementById('taskListContent');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = '<div class="task-item pending"><span class="task-icon">💤</span> 暂无任务</div>';
    return;
  }

  container.innerHTML = tasks.map(task => {
    const statusIcons = {
      running: '🔄',
      completed: '✅',
      failed: '❌',
      verifying: '🔍',
      pending: '⏳',
    };
    const icon = statusIcons[task.status] || '📋';

    return `
      <div class="task-item ${task.status}">
        <div class="task-header">
          <span class="task-icon">${icon}</span>
          <span class="task-title">${task.message}</span>
        </div>
        <div class="task-status">${getStatusText(task.status)}</div>
        <div class="task-logs">
          ${task.logs.map(log => `<div class="task-log">📝 ${log}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getStatusText(status) {
  const texts = {
    running: '执行中...',
    completed: '已完成',
    failed: '失败',
    verifying: '验证中...',
    pending: '等待中',
  };
  return texts[status] || status;
}

// 显示任务列表
function showTaskList() {
  const taskList = document.getElementById('taskList');
  taskList.style.display = 'block';
}

// 更新任务列表
function updateTaskList(tasks) {
  const taskContent = document.getElementById('taskListContent');
  if (!tasks || tasks.length === 0) {
    taskContent.innerHTML = '<div class="task-item pending"><span class="task-icon">🤔</span> 思考中...</div>';
    return;
  }

  taskContent.innerHTML = tasks.map(task => {
    const icons = {
      pending: '⏳',
      running: '🔄',
      completed: '✅',
      error: '❌'
    };
    return `
      <div class="task-item ${task.status}">
        <span class="task-icon">${icons[task.status] || '📋'}</span>
        <span>${task.name}</span>
      </div>
    `;
  }).join('');
}

// 轮询任务状态
async function pollTasks(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks?sessionId=${sessionId}`);
    const tasks = await res.json();
    updateTaskList(tasks);
  } catch (error) {
    // 忽略轮询错误
  }
}

// 添加消息到聊天界面
function addMessage(role, content, isLoading = false) {
  const container = document.getElementById('chatMessages');

  // 移除欢迎消息
  const welcome = container.querySelector('.welcome-message');
  if (welcome) {
    welcome.remove();
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.id = messageId;

  const avatars = {
    user: '<img src="/wd.png" alt="你">',
    assistant: '<img src="/maxia.png" alt="马虾">',
    system: '⚙️',
  };

  const names = {
    user: '你',
    assistant: '马虾',
    system: '系统',
  };

  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  messageEl.innerHTML = `
    <div class="message-header">
      <span class="message-avatar ${role}">${avatars[role]}</span>
      <span class="message-sender">${names[role]}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-content ${role}-message">
      ${content}
      ${isLoading ? '<span class="loading-dots">...</span>' : ''}
    </div>
  `;

  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;

  // 如果是加载中的消息，记录其ID
  if (isLoading) {
    loadingMessageId = messageId;
  }

  return messageEl;
}

// 加载会话列表
async function loadSessions() {
  const container = document.getElementById('historyList');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/sessions`);
    const sessions = await res.json();

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>暂无历史记录</p>
          <p class="hint">开始对话后会自动保存</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(session => {
      const date = new Date(session.updatedAt);
      const dateStr = date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <div class="session-item" data-id="${session.id}">
          <div class="session-info">
            <div class="session-title">${session.title}</div>
            <div class="session-meta">${dateStr} · ${session.messageCount}条消息</div>
          </div>
          <div class="session-actions">
            <button class="btn-icon" onclick="loadSession('${session.id}')" title="加载">📂</button>
            <button class="btn-icon" onclick="deleteSession('${session.id}')" title="删除">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = '<div class="error">加载失败</div>';
  }
}

// 加载单个会话
async function loadSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
    const session = await res.json();

    // 清空当前聊天
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    // 分批渲染消息，每批50条，避免一次性渲染大量消息导致页面卡顿
    const BATCH_SIZE = 50;
    const messages = session.messages;
    let index = 0;

    function renderBatch() {
      const batch = messages.slice(index, index + BATCH_SIZE);
      for (const msg of batch) {
        addMessage(msg.role, msg.content);
      }
      index += BATCH_SIZE;

      if (index < messages.length) {
        requestAnimationFrame(renderBatch);
      }
    }

    renderBatch();

    // 设置当前会话
    currentSessionId = sessionId;

    // 显示底部新聊天按钮
    document.getElementById('chatFooter').style.display = 'flex';

    // 切换到聊天页面
    showChat();
  } catch (error) {
    alert('加载会话失败');
  }
}

// 删除会话
async function deleteSession(sessionId) {
  if (!confirm('确定要删除这个会话吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      // 如果删除的是当前会话，清除当前会话
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      // 重新加载列表
      loadSessions();
    }
  } catch (error) {
    alert('删除失败');
  }
}

// 开始新聊天
function startNewChat() {
  currentSessionId = null;
  const container = document.getElementById('chatMessages');
  container.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">🦞</div>
      <h2>欢迎使用马虾</h2>
      <p>我是你的本地AI助手，可以帮你完成各种任务：</p>
      <ul>
        <li>📁 文件操作 - 读取、创建、删除文件</li>
        <li>💻 执行终端命令</li>
        <li>🌐 信息查询</li>
      </ul>
      <p class="hint">在下方输入消息开始对话</p>
    </div>
  `;
  document.getElementById('chatFooter').style.display = 'none';
}

// 初始化拖拽区域
function initDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (!dropZone || !fileInput) return;

  // 点击触发文件选择
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // 文件选择处理
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  // 拖拽事件
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  });
}

// 处理文件上传
async function handleFileUpload(file) {
  const resultDiv = document.getElementById('installResult');
  const dropZone = document.getElementById('dropZone');

  // 检查文件类型
  if (!file.name.endsWith('.zip')) {
    resultDiv.className = 'install-result error';
    resultDiv.textContent = '只支持 .zip 格式的压缩包';
    return;
  }

  // 显示上传中状态
  dropZone.style.opacity = '0.5';
  resultDiv.className = 'install-result';
  resultDiv.textContent = '正在安装...';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/api/skills/install`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (res.ok && data.success) {
      resultDiv.className = 'install-result success';
      resultDiv.textContent = `✓ ${data.message || '安装成功！'}`;
      // 重新加载skills列表
      loadInstalledSkills();
    } else {
      resultDiv.className = 'install-result error';
      resultDiv.textContent = `✗ ${data.error || '安装失败'}`;
    }
  } catch (error) {
    resultDiv.className = 'install-result error';
    resultDiv.textContent = `✗ 上传失败: ${error.message}`;
  } finally {
    dropZone.style.opacity = '1';
  }
}

// 加载已安装的skills列表
async function loadInstalledSkills() {
  const container = document.getElementById('installedSkillsList');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/skills/list`);
    const skills = await res.json();

    if (skills.length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无已安装的Skills</p>';
      return;
    }

    container.innerHTML = skills.map(skill => `
      <div class="skill-item">
        <span class="skill-item-icon">${skill.emoji || '📦'}</span>
        <div class="skill-item-name">${skill.name}</div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="error">加载失败</p>';
  }
}
