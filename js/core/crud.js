// ==================== 通用 CRUD 辅助 ====================
import { getConfig } from './state.js';
import { saveConfig } from './storage.js';
import { showToast } from '../ui/toast.js';

/**
 * 创建通用的表单显隐切换函数
 * @param {string} formId - 表单元素 ID
 * @returns {function} toggle 函数
 */
export function createFormToggle(formId) {
    return function (show) {
        const form = document.getElementById(formId);
        if (!form) return;
        if (show === undefined) {
            form.classList.toggle('hidden');
        } else if (show) {
            form.classList.remove('hidden');
        } else {
            form.classList.add('hidden');
        }
    };
}

/**
 * 通用名称唯一性检查
 * @param {Array} list - 数据列表
 * @param {string} name - 新名称
 * @param {string} typeLabel - 类型标签（用于错误提示）
 * @returns {boolean} 是否通过检查
 */
export function checkNameUnique(list, name, typeLabel) {
    if (list.some(item => item.name === name)) {
        showToast(`该${typeLabel}名已存在，请勿重复添加！`, 'warning');
        return false;
    }
    return true;
}

/**
 * 通用勾选网格渲染
 * @param {string} containerId - 容器元素 ID
 * @param {Array} items - 数据列表 [{name, ...}]
 * @param {Array} activeNames - 激活名称列表
 * @param {function} onToggle - 勾选变更回调(name, checked)
 * @param {function} onDelete - 删除回调(name)（可选）
 */
export function renderCheckboxGrid(containerId, items, activeNames, onToggle, onDelete) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    items.forEach(item => {
        const isChecked = activeNames.includes(item.name);
        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item';
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${item.name}" ${isChecked ? 'checked' : ''} data-name="${item.name}">
                <span>${item.name}</span>
            </label>
            ${onDelete ? `<button class="hero-delete-btn" title="彻底删除" data-delete="${item.name}">🗑️</button>` : ''}
        `;

        // 勾选事件
        const cb = itemBox.querySelector('input[type="checkbox"]');
        cb.addEventListener('change', () => onToggle(item.name, cb.checked));

        // 删除事件
        if (onDelete) {
            const delBtn = itemBox.querySelector('.hero-delete-btn');
            delBtn.addEventListener('click', () => onDelete(item.name));
        }

        container.appendChild(itemBox);
    });
}

/**
 * 通用全选/取消全选
 * @param {string} containerId - 容器 ID
 * @param {boolean} selectAll - 是否全选
 * @param {function} onToggle - 勾选变更回调
 */
export function toggleAllCheckboxes(containerId, selectAll, onToggle) {
    const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onToggle(cb.value, selectAll);
    });
}
