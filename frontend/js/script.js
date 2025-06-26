// =================================================================================
// 梦泪AI - 前端脚本 (重构优化版)
// 本次更新：修复了模型下拉菜单无法展开的问题，并确保后端能接收到最新的深度思考模式。
// 新增：为所有代码添加了详尽的中文注释。
// =================================================================================

// --- 1. 应用状态管理 ---
// 使用一个 state 对象来集中管理应用的所有动态数据，便于跟踪和调试。
const state = {
    conversationHistory: [],      // 存储当前会话的所有聊天消息
    profiles: [],                 // 存储从后端获取的 AI 人设数据
    currentProfileId: 'default',  // 当前选中的人设/模型 ID
    deepThoughtMode: 'auto',      // 深度思考状态: 'on' (开启), 'off' (关闭), 'auto' (自动)
    isSidebarOpen: true,          // 侧边栏的打开状态
};

// --- 2. DOM 元素缓存 ---
// 将所有需要操作的 DOM 元素缓存在一个对象中，避免在代码中重复查询，提高性能。
const dom = {};

/**
 * 缓存所有需要用到的 DOM 元素到全局的 dom 对象中。
 * 此函数应在页面加载完成后首先执行。
 */
function cacheDOMElements() {
    console.log("[Init] 开始缓存DOM元素。");
    const elementIds = [
        'send-btn', 'message-input', 'chat-container', 'welcome-screen',
        'theme-toggle', 'toggle-sidebar-btn', 'sidebar', 'new-chat-btn-sidebar',
        'input-area-wrapper', 'main-chat-area', 'main-header',
        'model-selector-container', 'current-model-name', 'model-dropdown',
        'ai-message-template', 'user-message-template', 'deep-thought-btn',
        'deep-thought-text', 'deep-thought-dropdown', 'upload-button',
        'file-upload', 'canvas-btn', 'replay-chat-btn', 'clear-chat-btn'
    ];
    // 遍历ID列表，将对应的DOM元素存入dom对象，并将ID转换为驼峰命名法（如'send-btn' -> 'sendBtn'）
    elementIds.forEach(id => {
        const camelCaseId = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
        dom[camelCaseId] = document.getElementById(id);
    });
    console.log("[Init] DOM元素缓存完成。");
}


// --- 3. API 调用层 ---
// 封装所有与后端交互的 fetch 请求，使API调用逻辑更清晰、更集中。

/**
 * 从后端获取人设（模型）数据。
 * @returns {Promise<Array>} 解析为人设对象数组的 Promise。
 */
async function fetchProfiles() {
    try {
        const response = await fetch('/data/profiles.json');
        if (!response.ok) throw new Error(`HTTP 错误! 状态: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('[API] 获取人设数据失败:', error);
        // 在API请求失败时，返回一个默认的备用人设，保证程序基本功能可用。
        return [{ id: "default", name: "默认AI", prompt: "你是一个有帮助的AI助手。", initial_message: "你好" }];
    }
}

/**
 * 向后端 API 发送聊天消息。
 * @param {Object} payload - 发送给后端的完整数据体（包含消息、人设ID、思考模式等）。
 * @returns {Promise<Object>} 解析为包含 AI 回复和思考过程的 Promise。
 */
async function sendChatToBackend(payload) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API 错误: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * 向后端上传文件。
 * @param {File} file - 要上传的文件对象。
 * @returns {Promise<Object>} 解析为包含文件 URL 的响应 Promise。
 */
async function uploadFileToBackend(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `文件上传失败: ${response.statusText}`);
    }
    return await response.json();
}


// --- 4. UI 更新与辅助函数 ---

/**
 * 统一控制输入区域所有交互元素的可用状态（锁定/解锁）。
 * @param {boolean} lock - true 表示锁定（禁用），false 表示解锁（启用）。
 */
function toggleUIAccessibility(lock) {
    if (dom.sendBtn) dom.sendBtn.disabled = lock;
    if (dom.messageInput) dom.messageInput.disabled = lock;

    // 禁用/启用所有功能按钮，并调整其样式以提供视觉反馈
    const buttons = document.querySelectorAll('.input-box-icon-btn, .input-box-chip-btn');
    buttons.forEach(btn => {
        btn.disabled = lock;
        btn.classList.toggle('opacity-50', lock); // 切换半透明样式
        btn.classList.toggle('pointer-events-none', lock); // 禁用鼠标事件
    });
    console.log(`[UI] 输入区域已${lock ? '锁定' : '解锁'}。`);
}

/**
 * 在聊天容器中显示一条新消息。
 * @param {string} role - 角色 ('user' 或 'assistant')。
 * @param {string} content - 消息内容 (支持Markdown)。
 * @param {string} [reasoning=''] - (可选) AI 的思考过程内容 (支持Markdown)。
 * @param {string} [imageUrl=''] - (可选) 关联的图片 URL。
 * @returns {HTMLElement|null} 创建的消息气泡元素，如果模板不存在则返回 null。
 */
function displayMessage(role, content, reasoning = '', imageUrl = '') {
    const template = role === 'user' ? dom.userMessageTemplate : dom.aiMessageTemplate;
    if (!template || !template.content) {
        console.error(`[UI] 错误：未找到或无效的消息模板 for role "${role}"。`);
        return null;
    }

    // 从模板克隆一个新的消息气泡元素
    const messageBubble = template.content.cloneNode(true).querySelector('li');
    const messageContentDiv = messageBubble.querySelector('.message-content');

    // 使用 marked.js 库将 Markdown 文本转换为 HTML
    messageContentDiv.innerHTML = marked.parse(content);

    // 如果是用户消息且包含图片，则创建并插入图片元素
    if (imageUrl && role === 'user') {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'max-w-full h-auto rounded-lg mt-2 block';
        messageContentDiv.insertBefore(img, messageContentDiv.firstChild);
    }

    // 更新思考过程的显示区域
    updateReasoningUI(messageBubble, reasoning);

    // 将新消息添加到聊天容器并滚动到底部
    dom.chatContainer.appendChild(messageBubble);
    dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    return messageBubble;
}

/**
 * 更新指定消息气泡中的“思考过程”UI部分。
 * @param {HTMLElement} bubble - 目标消息气泡元素。
 * @param {string} reasoning - 思考过程的 Markdown 文本。
 */
function updateReasoningUI(bubble, reasoning) {
    const container = bubble.querySelector('.reasoning-container');
    if (!container) return;

    // 仅当有思考过程内容且深度思考模式非关闭时才显示
    if (reasoning && state.deepThoughtMode !== 'off') {
        container.classList.remove('hidden');
        const contentDiv = container.querySelector('.reasoning-content');
        contentDiv.innerHTML = marked.parse(reasoning);
        contentDiv.classList.add('hidden'); // 默认折叠内容

        const header = container.querySelector('.reasoning-header');
        // 为“显示思路”头部只添加一次点击事件监听器，防止重复绑定
        if (header && !header.dataset.listenerAdded) {
            header.addEventListener('click', () => {
                contentDiv.classList.toggle('hidden'); // 切换内容显示
                header.querySelector('i').classList.toggle('fa-caret-down'); // 切换箭头方向
                header.querySelector('i').classList.toggle('fa-caret-right');
                dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight; // 重新滚动到底部
            });
            header.dataset.listenerAdded = 'true'; // 标记已添加监听器
        }
    } else {
        container.classList.add('hidden'); // 如果不满足条件则隐藏
    }
}

/**
 * 显示或隐藏 AI 消息气泡内的加载指示器（思考中的点动画）。
 * @param {boolean} show - true 为显示, false 为隐藏。
 * @param {HTMLElement} bubble - 目标 AI 消息气泡。
 */
function showLoadingIndicator(show, bubble) {
    if (!bubble) return;
    const loadingDots = bubble.querySelector('.reasoning-header .loading-dots');
    const dropdownIcon = bubble.querySelector('.reasoning-header .fas');
    const container = bubble.querySelector('.reasoning-container');

    if (loadingDots && dropdownIcon && container) {
        loadingDots.classList.toggle('hidden', !show); // 显示/隐藏加载点
        dropdownIcon.classList.toggle('hidden', show); // 隐藏/显示下拉箭头
        container.classList.toggle('loading', show);    // 添加/移除 'loading' 类，可用于CSS进一步控制
    }
}

/**
 * 根据输入内容动态调整 textarea 的高度。
 */
function adjustInputHeight() {
    if (dom.messageInput) {
        dom.messageInput.style.height = 'auto'; // 先重置高度
        dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`; // 再设置为滚动高度
        const maxHeight = 160; // 设置一个最大高度，防止无限增高
        // 如果内容高度超过最大值，则显示滚动条
        dom.messageInput.style.overflowY = dom.messageInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
}

/**
 * 根据当前状态和屏幕宽度，更新侧边栏的显示和主内容的布局。
 */
function updateSidebarUI() {
    if (!dom.sidebar || !dom.mainChatArea || !dom.mainHeader || !dom.inputAreaWrapper) return;

    const isOpen = state.isSidebarOpen;
    const isDesktop = window.innerWidth >= 1024;

    // 根据屏幕尺寸和侧边栏状态，决定是否应用 'collapsed' 样式
    const isCollapsed = isDesktop && !isOpen;

    // 控制侧边栏自身的样式
    dom.sidebar.classList.toggle('collapsed', isCollapsed);
    dom.sidebar.classList.toggle('open', !isDesktop && isOpen);

    // 控制主内容区域所有相关元素的样式，实现联动
    dom.mainChatArea.classList.toggle('sidebar-collapsed', isCollapsed);
    dom.mainHeader.classList.toggle('sidebar-collapsed', isCollapsed);
    dom.inputAreaWrapper.classList.toggle('sidebar-collapsed', isCollapsed);

    console.log(`[UI] 侧边栏状态更新: ${isOpen ? '打开/展开' : '关闭/收起'}`);
}

/**
 * 设置当前选中的AI人设（模型），并更新UI和本地存储。
 * @param {string} profileId - 要设定的AI人设的ID。
 */
function setCurrentProfile(profileId) {
    const selectedProfile = state.profiles.find(p => p.id === profileId);
    if (!selectedProfile) {
        console.warn(`[UI] 警告：无法找到ID为 "${profileId}" 的人设。`);
        return;
    }

    state.currentProfileId = profileId;
    dom.currentModelName.textContent = selectedProfile.name; // 更新显示的名称
    localStorage.setItem('current_profile_id', profileId); // 保存到本地存储

    // 更新下拉菜单中所有项目的视觉状态，确保只有一个被标记为“选中”
    dom.modelDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.profileId === profileId);
    });
    console.log(`[State] AI人设已切换为: ${selectedProfile.name}`);
}

/**
 * 设置深度思考模式，并更新UI显示和本地存储。
 * @param {string} mode - 要设置的模式 ('on', 'off', 'auto')。
 */
function setDeepThoughtMode(mode) {
    if (!['on', 'off', 'auto'].includes(mode)) return; // 验证模式的有效性

    state.deepThoughtMode = mode;
    localStorage.setItem('deep_thought_mode', mode);

    const modeTextMap = { on: '深度思考: 开启', off: '深度思考: 关闭', auto: '深度思考: 自动' };
    dom.deepThoughtText.textContent = modeTextMap[mode];

    // 更新图标颜色以提供视觉反馈
    const icon = dom.deepThoughtBtn.querySelector('i');
    icon.className = "fas fa-lightbulb"; // 先重置类名
    const colorMap = { on: 'text-green-500', off: 'text-red-500', auto: 'text-yellow-500' };
    icon.classList.add(colorMap[mode]);

    console.log(`[State] 深度思考模式已设置为: ${mode}`);
}

// --- 5. 核心业务逻辑 ---

/**
 * 发送消息的核心流程函数。
 * @param {string} messageContent - 要发送的文本消息。
 * @param {string} [imageUrl=''] - (可选) 关联的图片 URL。
 */
async function sendMessage(messageContent, imageUrl = '') {
    // 如果消息为空，则不执行任何操作
    if (!messageContent.trim()) return;
    // 如果欢迎屏幕还显示着，则隐藏它
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';

    // 步骤 1: 在UI上显示用户发送的消息，并更新历史记录
    displayMessage('user', messageContent, '', imageUrl);
    state.conversationHistory.push({ role: 'user', content: messageContent, imageUrl });

    // 步骤 2: 显示AI的“思考中”状态，并锁定UI以防止用户重复操作
    const aiBubble = displayMessage('assistant', '思考中...');
    showLoadingIndicator(true, aiBubble);
    toggleUIAccessibility(true);

    try {
        // [修复] 直接从本地存储读取最新的深度思考模式，以确保发送给后端的是最新值
        const currentDeepThoughtMode = localStorage.getItem('deep_thought_mode') || 'auto';

        // 步骤 3: 构建请求体并调用后端API
        const payload = {
            messages: [{ role: 'user', content: messageContent }],
            profile_id: state.currentProfileId,
            deep_thought_mode: currentDeepThoughtMode, // 使用最新的模式
        };
        const result = await sendChatToBackend(payload);

        // 步骤 4: 获取到响应后，更新UI和历史记录
        const aiResponse = result.message || "抱歉，未能获取到回复。";
        const aiReasoning = result.reasoning || "";
        aiBubble.querySelector('.message-content').innerHTML = marked.parse(aiResponse);
        updateReasoningUI(aiBubble, aiReasoning);
        state.conversationHistory.push({ role: 'assistant', content: aiResponse, reasoning: aiReasoning });
        localStorage.setItem('ml_ai_chat_history', JSON.stringify(state.conversationHistory));

    } catch (error) {
        // 如果发生错误，在UI上显示错误消息
        console.error('[Core] 发送消息失败:', error);
        aiBubble.querySelector('.message-content').innerHTML = `😞 抱歉，发生错误: ${error.message}`;
    } finally {
        // 步骤 5: 无论成功与否，都要解锁UI并停止加载动画
        showLoadingIndicator(false, aiBubble);
        toggleUIAccessibility(false);
        dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    }
}

/**
 * 处理文件上传的核心流程。
 * @param {Event} event - 文件输入框的 change 事件。
 */
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    toggleUIAccessibility(true);
    try {
        const result = await uploadFileToBackend(file);
        // 文件上传成功后，将图片信息作为一条新消息发送
        await sendMessage(`用户发送了图片：${file.name}`, result.url);
    } catch (error) {
        console.error('[Core] 文件上传或后续消息发送失败:', error);
        displayMessage('assistant', `😞 图片上传失败: ${error.message}`);
    } finally {
        toggleUIAccessibility(false);
        // 清空文件选择，以便可以再次选择同名文件
        if (dom.fileUpload) dom.fileUpload.value = '';
    }
}

/**
 * 开始一个新的聊天会话，会清空当前所有聊天记录。
 */
function newChat() {
    state.conversationHistory = [];
    localStorage.removeItem('ml_ai_chat_history');
    if (dom.chatContainer) dom.chatContainer.innerHTML = '';
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'flex';
    if (dom.messageInput) {
        dom.messageInput.value = '';
        adjustInputHeight();
        dom.messageInput.focus();
    }
    console.log("[Core] 新聊天已开始。");
}

/**
 * 显示一个自定义的确认模态框。
 * @param {string} message - 要在模态框中显示的消息。
 * @param {Function} onConfirm - 当用户点击“确定”后要执行的回调函数。
 */
function showConfirmationModal(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl text-center dark:bg-gray-800 dark:text-white">
            <p class="mb-4 text-lg">${message}</p>
            <div class="flex justify-center gap-x-4">
                <button id="modal-confirm-btn" class="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">确定</button>
                <button id="modal-cancel-btn" class="py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('modal-confirm-btn').onclick = () => { onConfirm(); modal.remove(); };
    document.getElementById('modal-cancel-btn').onclick = () => modal.remove();
}

/**
 * 初始化模型（AI人设）下拉菜单。
 * 填充选项、绑定事件并恢复上次选择。
 */
function initModelDropdown() {
    if (!dom.modelDropdown || !state.profiles.length) return;

    dom.modelDropdown.innerHTML = ''; // 先清空现有选项

    // 遍历人设数据，为每个人设创建一个下拉选项
    state.profiles.forEach(profile => {
        const item = document.createElement('div');
        item.className = 'dropdown-item flex items-center gap-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700';
        item.dataset.profileId = profile.id;
        item.innerHTML = `<i class="${profile.icon || 'fas fa-robot'}"></i><span>${profile.name}</span>`;

        // 为每个选项绑定点击事件
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止事件冒泡到父容器导致菜单立即关闭
            setCurrentProfile(profile.id);
            dom.modelDropdown.classList.remove('show');
        });
        dom.modelDropdown.appendChild(item);
    });

    // [修复] 为模型选择器容器（即显示当前模型名称的区域）添加点击事件，以切换下拉菜单的显示状态
    dom.modelSelectorContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.modelDropdown.classList.toggle('show');
    });

    // 从本地存储恢复上次选择的人设，如果没有则使用第一个作为默认值
    const savedProfileId = localStorage.getItem('current_profile_id');
    const initialProfileId = state.profiles.some(p => p.id === savedProfileId) ? savedProfileId : state.profiles[0].id;
    setCurrentProfile(initialProfileId);
    console.log("[Init] 模型下拉菜单初始化完成。");
}

/**
 * 初始化深度思考模式下拉菜单。
 * 绑定事件并恢复上次选择。
 */
function initDeepThoughtMode() {
    if (!dom.deepThoughtDropdown) return;

    // 为每个模式选项绑定点击事件
    dom.deepThoughtDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            setDeepThoughtMode(item.dataset.mode);
            dom.deepThoughtDropdown.classList.remove('show');
        });
    });

    // 为主按钮添加点击事件以切换下拉菜单的显示/隐藏
    dom.deepThoughtBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.deepThoughtDropdown.classList.toggle('show');
    });

    // 从本地存储恢复上次选择的模式，如果没有则使用'auto'作为默认值
    const savedMode = localStorage.getItem('deep_thought_mode');
    setDeepThoughtMode(['on', 'off', 'auto'].includes(savedMode) ? savedMode : 'auto');

    console.log("[Init] 深度思考模式初始化完成。");
}

// --- 6. 事件监听器绑定 ---
/**
 * 集中绑定所有事件监听器。
 */
function bindEventListeners() {
    // 消息输入与发送相关事件
    dom.sendBtn.addEventListener('click', () => {
        const message = dom.messageInput.value;
        sendMessage(message);
        dom.messageInput.value = ''; // 发送后清空输入框
        adjustInputHeight(); // 调整高度
    });

    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // 按下Enter键（但没有按Shift键）
            e.preventDefault(); // 防止换行
            dom.sendBtn.click(); // 触发发送按钮的点击事件，保持逻辑统一
        }
    });
    dom.messageInput.addEventListener('input', adjustInputHeight);

    // 文件上传事件
    dom.uploadButton.addEventListener('click', () => dom.fileUpload.click());
    dom.fileUpload.addEventListener('change', handleFileUpload);

    // 侧边栏与主题切换事件
    dom.toggleSidebarBtn.addEventListener('click', () => {
        state.isSidebarOpen = !state.isSidebarOpen;
        updateSidebarUI();
        localStorage.setItem('sidebar_open_state', state.isSidebarOpen);
    });
    dom.themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', dom.themeToggle.checked);
        localStorage.setItem('theme', dom.themeToggle.checked ? 'dark' : 'light');
    });

    // 聊天操作按钮事件
    dom.newChatBtnSidebar.addEventListener('click', newChat);
    dom.clearChatBtn.addEventListener('click', () => showConfirmationModal('确定要清空所有聊天历史吗？', newChat));

    // 其他功能按钮（暂未实现的功能用 alert 提示）
    if (dom.replayChatBtn) dom.replayChatBtn.addEventListener('click', () => alert('重放功能待实现'));
    if (dom.canvasBtn) dom.canvasBtn.addEventListener('click', () => alert('Canvas功能待实现'));

    // 全局点击事件，用于在点击外部区域时关闭所有下拉菜单
    document.addEventListener('click', (e) => {
        if (dom.modelDropdown && !dom.modelSelectorContainer.contains(e.target)) {
            dom.modelDropdown.classList.remove('show');
        }
        if (dom.deepThoughtDropdown && !dom.deepThoughtBtn.contains(e.target)) {
            dom.deepThoughtDropdown.classList.remove('show');
        }
    });
    // 窗口大小调整事件，用于更新侧边栏UI
    window.addEventListener('resize', updateSidebarUI);

    console.log("[Init] 所有事件监听器绑定完成。");
}

// --- 7. 主初始化流程 ---
/**
 * 页面加载完成后执行的主函数，负责整个应用的初始化。
 */
async function main() {
    console.log("[Init] 应用初始化开始...");

    cacheDOMElements();
    bindEventListeners();

    // 从本地存储恢复用户偏好设置（主题、侧边栏状态）
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        dom.themeToggle.checked = true;
        document.body.classList.add('dark-mode');
    }

    // [修复] 初始化时根据屏幕宽度决定侧边栏初始状态
    if (window.innerWidth < 1024) {
        state.isSidebarOpen = false; // 小屏幕默认关闭
    } else {
        state.isSidebarOpen = localStorage.getItem('sidebar_open_state') !== 'false';
    }
    updateSidebarUI(); // 页面加载时立即调用一次以设置初始布局

    // 并行获取初始化所需的数据（目前只有人设数据）
    const [profilesData] = await Promise.all([fetchProfiles()]);
    state.profiles = profilesData;

    // 初始化下拉菜单
    initModelDropdown();
    initDeepThoughtMode();

    // 加载并显示本地存储的聊天记录
    const savedHistory = localStorage.getItem('ml_ai_chat_history');
    if (savedHistory) {
        state.conversationHistory = JSON.parse(savedHistory);
        if (state.conversationHistory.length > 0) {
            dom.chatContainer.innerHTML = '';
            state.conversationHistory.forEach(msg => displayMessage(msg.role, msg.content, msg.reasoning, msg.imageUrl));
            if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
        }
    }

    // 初始UI调整
    adjustInputHeight();
    if (dom.messageInput) dom.messageInput.focus();

    console.log("[Init] 应用初始化流程完成。");
}

// 监听 DOMContentLoaded 事件，以此作为整个应用的启动入口。
// 确保在操作DOM之前，所有HTML元素都已加载完毕。
document.addEventListener('DOMContentLoaded', main);
