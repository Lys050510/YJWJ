// ==================== 通用工具函数 ====================

/** HTML 转义（防 XSS） */
export function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/** JS 字符串转义（供 onclick/href 属性使用） */
export function escapeJS(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

/** 获取当前格式化时间 YYYY-MM-DD HH:mm:ss */
export function getFormattedTime() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** HSL → Hex 转换（转盘颜色生成） */
export function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/** Fisher-Yates 洗牌算法 */
export function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/** 权重随机索引 */
export function getWeightedRandomIndex(weights) {
    const totalWeight = weights.reduce((sum, w) => sum + parseFloat(w || 0), 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        rand -= parseFloat(weights[i] || 0);
        if (rand <= 0) return i;
    }
    return weights.length - 1;
}

/** 品质 → CSS class 映射 */
export function getQualityClass(q) {
    if (q === '金') return 'tip-border-gold';
    if (q === '紫') return 'tip-border-purple';
    if (q === '蓝') return 'tip-border-blue';
    return 'tip-border-white';
}

/** 品质 → 显示颜色映射 */
export function getQualityColor(q) {
    if (q === '金') return '#ffcc00';
    if (q === '紫') return '#bf5af2';
    if (q === '蓝') return '#29b6f6';
    return '#ffffff';
}
