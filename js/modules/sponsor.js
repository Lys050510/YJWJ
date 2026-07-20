// ==================== 赞助支持弹窗控制 ====================

import { getEl } from '../core/dom.js';

/**
 * 打开赞助弹窗（带淡入动画）
 * 分两步：先 display:flex，再 opacity:1 —— 让 CSS transition 生效
 */
function openSponsorModal(event) {
    if (event) event.stopPropagation();
    const overlay = getEl('sponsor-modal');
    if (!overlay) return;

    // 第一步：设为 flex 但保持透明
    overlay.style.display = 'flex';
    // 强制重排后触发 transition
    overlay.offsetHeight;
    // 第二步：添加 active 触发 opacity: 1
    overlay.classList.add('active');

    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
}

/**
 * 关闭赞助弹窗（带淡出动画）
 * @param {Event} [event] - 可选，用于判断是否点击遮罩层
 */
function closeSponsorModal(event) {
    // 如果传了 event 且点击的不是遮罩层本身，不关闭
    if (event && event.target !== event.currentTarget) return;
    if (event) event.stopPropagation();

    const overlay = getEl('sponsor-modal');
    if (!overlay) return;

    // 第一步：移除 active 触发 opacity: 0
    overlay.classList.remove('active');
    // 等 transition 结束再隐藏
    setTimeout(() => {
        if (!overlay.classList.contains('active')) {
            overlay.style.display = 'none';
        }
    }, 260); // 略大于 CSS transition (250ms)

    // 恢复背景滚动
    document.body.style.overflow = '';
}

/**
 * ESC 键关闭弹窗
 */
function onKeyDown(e) {
    if (e.key === 'Escape') {
        const overlay = getEl('sponsor-modal');
        if (overlay && overlay.classList.contains('active')) {
            closeSponsorModal();
        }
    }
}

// 注册全局键盘监听
document.addEventListener('keydown', onKeyDown);

// 挂载到 window 供 HTML onclick 调用
window.SponsorModule = {
    openSponsorModal,
    closeSponsorModal
};
