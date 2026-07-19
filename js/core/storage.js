// ==================== localStorage 安全封装 ====================
import { showToast } from '../ui/toast.js';

// 基于页面路径生成唯一命名空间，防止同域下多项目 LocalStorage 键名冲突
export const STORAGE_KEY = (function() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const ns = path.split('/').filter(Boolean).join('_') || 'root';
    return 'YJWJ_' + ns + '_CACHE';
})();

/** 安全读取 localStorage */
export function loadFromStorage(fallback = null) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        console.warn('Failed to load config from localStorage:', e);
        return fallback;
    }
}

/** 安全写入 localStorage（带容量预警） */
export function saveToStorage(data) {
    try {
        const json = JSON.stringify(data);
        const sizeInKB = (new Blob([json]).size / 1024).toFixed(1);
        localStorage.setItem(STORAGE_KEY, json);

        // 容量预警：超过 80% (4MB) 时提醒用户
        if (sizeInKB > 4000) {
            showToast(`⚠️ 本地存储已使用 ${sizeInKB} KB（接近 5MB 上限），建议导出配置并清理旧日志！`, 'warning', 6000);
        }
    } catch (e) {
        console.error('Failed to save config to localStorage:', e);
        showToast('❌ 本地存储空间不足，请导出配置备份后清理缓存！', 'error', 8000);
    }
}

/** 保存 CURRENT_CONFIG（兼容旧 saveConfigToLocal） */
export function saveConfig() {
    saveToStorage(window.CURRENT_CONFIG);
}

/** 防抖保存（用于高频输入事件，避免频繁写 localStorage） */
let saveDebounceTimer = null;
export function saveConfigDebounced(delay = 500) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        saveConfig();
    }, delay);
}

/** 获取当前计分板模式 */
export function getActiveMode() {
    return window.CURRENT_CONFIG.scoreboard.currentMode;
}

/** 获取当前活动回合列表 */
export function getActiveRounds() {
    const mode = getActiveMode();
    return mode === '12' ? window.CURRENT_CONFIG.scoreboard.rounds12 : window.CURRENT_CONFIG.scoreboard.rounds8;
}
