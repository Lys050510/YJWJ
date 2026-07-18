// ==================== Toast 通知系统（替代 alert） ====================

/** 显示非阻塞 Toast 通知 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // 入场动画
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // 自动消失
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        display: flex; flex-direction: column; gap: 8px;
        pointer-events: none; max-width: 380px;
    `;
    document.body.appendChild(container);
    return container;
}

// Toast 样式（内联，因为 toast 可能在 CSS 加载前创建）
const style = document.createElement('style');
style.textContent = `
.toast {
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-family: "Microsoft YaHei", sans-serif;
    font-weight: bold;
    opacity: 0;
    transform: translateX(30px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    border: 1px solid;
}
.toast-visible { opacity: 1; transform: translateX(0); }
.toast-info { background: #1a1a2e; color: #7ec8e3; border-color: #7ec8e3; }
.toast-success { background: #1a2e1a; color: #88ff88; border-color: #88ff88; }
.toast-warning { background: #2e2a1a; color: #ffcc00; border-color: #cca43b; }
.toast-error { background: #2e1a1a; color: #ff9999; border-color: #ff5555; }
`;
document.head.appendChild(style);
