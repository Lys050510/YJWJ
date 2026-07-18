// ==================== DOM 元素懒加载缓存 ====================

/** DOM 缓存对象 */
const cache = {};

/** 获取 DOM 元素（带懒加载缓存） */
export function getEl(id) {
    if (!cache[id]) {
        cache[id] = document.getElementById(id);
    }
    return cache[id];
}

/** 清空缓存（用于 DOM 重建后） */
export function clearDOMCache() {
    Object.keys(cache).forEach(key => delete cache[key]);
}

/** 显示/隐藏元素 */
export function toggleEl(id, show) {
    const el = getEl(id);
    if (!el) return;
    if (show === undefined) {
        el.classList.toggle('hidden');
    } else if (show) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

/** 打开弹窗 */
export function openModal(id) {
    const el = getEl(id);
    if (el) el.classList.add('active');
}

/** 关闭弹窗 */
export function closeModal(id) {
    const el = getEl(id);
    if (el) el.classList.remove('active');
}
