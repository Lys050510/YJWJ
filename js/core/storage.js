// ==================== localStorage 安全封装 ====================
import { showToast } from '../ui/toast.js';

const STORAGE_KEY = 'UP_LOTTERY_SMART_CACHE';

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

/** 安全写入 localStorage */
export function saveToStorage(data) {
    try {
        const json = JSON.stringify(data);
        localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
        console.error('Failed to save config to localStorage:', e);
        showToast('本地存储空间不足，请导出配置备份后清理缓存！', 'error', 5000);
    }
}

/** 保存 CURRENT_CONFIG（兼容旧 saveConfigToLocal） */
export function saveConfig() {
    saveToStorage(window.CURRENT_CONFIG);
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
