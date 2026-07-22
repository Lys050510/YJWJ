// ==================== 模块八：开箱模拟器 ====================
import { state } from '../core/state.js';
import { saveConfig, saveConfigDebounced } from '../core/storage.js';
import { escapeHTML, getFormattedTime, shuffleArray } from '../core/utils.js';
import { showToast } from '../ui/toast.js';

// ── Canvas roundRect polyfill ──
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        this.beginPath();
        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        this.closePath();
    };
}

// ── 品质配置 ──
const QUALITY_CONFIG = {
    'red':    { label: '神品', color: '#ff4444', cssClass: 'lootbox-quality-red',    borderClass: 'result-border-red',    orbColor: '#ff4444', orbGlow: '#ff8888', orbSize: 26, emergeDelay: 1200, emergeDuration: 700 },
    'gold':   { label: '极品', color: '#ffcc00', cssClass: 'lootbox-quality-gold',   borderClass: 'result-border-gold',   orbColor: '#ffd54f', orbGlow: '#ffe082', orbSize: 22, emergeDelay: 800,  emergeDuration: 550 },
    'orange': { label: '珍品', color: '#ff8800', cssClass: 'lootbox-quality-orange', borderClass: 'result-border-gold',   orbColor: '#ff9800', orbGlow: '#ffb74d', orbSize: 18, emergeDelay: 700,  emergeDuration: 500 },
    'purple': { label: '优品', color: '#bf5af2', cssClass: 'lootbox-quality-purple', borderClass: 'result-border-purple', orbColor: '#b39ddb', orbGlow: '#ce93d8', orbSize: 15, emergeDelay: 500,  emergeDuration: 400 },
    'blue':   { label: '良品', color: '#4da6ff', cssClass: 'lootbox-quality-blue',   borderClass: 'result-border-blue',   orbColor: '#4fc3f7', orbGlow: '#81d4fa', orbSize: 12, emergeDelay: 350,  emergeDuration: 300 },
};
const QUALITY_ORDER = ['blue', 'purple', 'orange', 'gold', 'red'];
function qCfg(q) { return QUALITY_CONFIG[q] || QUALITY_CONFIG['blue']; }

// 新春系列按钮名称映射
const XINCHUN_BTN_NAMES = ['日月长明', '山川秀润', '风调雨顺', '国泰民安', '万事如意'];

// ── 模块私有状态 ──
let _currentBoxId = null;
let _animFrameId = null;
let _isDrawing = false;

// ── 流光逐影私有状态 ──
let _lgAnimFrameId = null;
let _lgIdleFrameId = null;
let _lgDrawing = false;
let _godImage = null;
let _lgImageCache = {};

// ── 数据访问 ──
function getBoxData(boxId) {
    const boxes = window.BOX_DATA || [];
    return boxes.find(b => b.id === boxId);
}
function getBoxState(boxId) {
    if (!window.CURRENT_CONFIG.boxStates) window.CURRENT_CONFIG.boxStates = {};
    if (!window.CURRENT_CONFIG.boxStates[boxId]) {
        window.CURRENT_CONFIG.boxStates[boxId] = {
            totalDraws: 0,
            redPityCounter: 0,
            purplePityCounter: 0,
            specialPityActive: true,  // 特殊保底是否可用
            specialPityUsed: false,
            goldPityCounter: 0,
            goldPityTriggers: 0,
            permRedPityCounter: 0,    // 常驻红色保底计数（神骏宝炉专用）
            permRedPityTriggers: 0,   // 常驻红色保底已触发次数（最多3次）
            ownedItems: [],
            wishItem: null,
            wishCount: 0,
            history: []
        };
    }
    return window.CURRENT_CONFIG.boxStates[boxId];
}

// ── 初始化 ──
function initLootboxDashboard() {
    const boxes = window.BOX_DATA || [];
    if (!boxes.length) {
        const el = document.getElementById('lootbox-list');
        if (el) el.innerHTML = '<p style="color:#666;padding:20px;text-align:center;">宝箱数据加载中...</p>';
        return;
    }
    if (!_currentBoxId || !getBoxData(_currentBoxId)) _currentBoxId = boxes[0].id;
    renderBoxList();
    selectBox(_currentBoxId);
}

// ── 左侧：宝箱列表 ──

/** 获取按用户自定义顺序排列的宝箱列表 */
function getOrderedBoxes() {
    const boxes = window.BOX_DATA || [];
    const order = window.CURRENT_CONFIG.boxOrder || [];
    const boxMap = {};
    boxes.forEach(b => boxMap[b.id] = b);
    const ordered = [];
    const seen = new Set();
    order.forEach(id => {
        if (boxMap[id] && !seen.has(id)) { ordered.push(boxMap[id]); seen.add(id); }
    });
    boxes.forEach(b => { if (!seen.has(b.id)) ordered.push(b); });
    return ordered;
}

/** 保存当前 DOM 中的宝箱顺序到 boxOrder */
function saveBoxOrderFromDOM() {
    const ids = [];
    document.querySelectorAll('#lootbox-list .lootbox-card').forEach(card => {
        if (card.dataset.boxId) ids.push(card.dataset.boxId);
    });
    window.CURRENT_CONFIG.boxOrder = ids;
    saveConfigDebounced(300);
}

function renderBoxList() {
    const container = document.getElementById('lootbox-list');
    if (!container) return;
    const ordered = getOrderedBoxes();
    const regularBoxes = ordered.filter(b => b.type !== 'spring_festival');
    const springBoxes = ordered.filter(b => b.type === 'spring_festival');
    let html = '';
    regularBoxes.forEach(box => {
        const st = getBoxState(box.id);
        html += renderBoxCardHTML(box, st);
    });
    if (springBoxes.length) {
        html += '<div class="lootbox-list-section">🧧 新春系列</div>';
        springBoxes.forEach(box => {
            const st = getBoxState(box.id);
            html += renderBoxCardHTML(box, st);
        });
    }
    container.innerHTML = html;
    // 绑定拖拽事件
    bindDragEvents(container);
}
function renderBoxCardHTML(box, st) {
    const activeClass = box.id === _currentBoxId ? ' active' : '';
    return `<div class="lootbox-card${activeClass}" data-box-id="${box.id}" draggable="true" onclick="selectBox('${box.id}')">
        <img class="lootbox-card-thumb" src="${box.image}" alt="${escapeHTML(box.name)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <span style="display:none;width:44px;height:44px;background:#222;border-radius:3px;align-items:center;justify-content:center;font-size:24px;">📦</span>
        <div class="lootbox-card-info"><div class="lootbox-card-name">${escapeHTML(box.name)}</div><div class="lootbox-card-count">已抽 ${st.totalDraws} 次</div></div>
    </div>`;
}

// ── 拖拽排序 ──
function bindDragEvents(container) {
    container.querySelectorAll('.lootbox-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.boxId);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            container.querySelectorAll('.lootbox-card').forEach(c => c.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        card.addEventListener('dragenter', (e) => {
            e.preventDefault();
            container.querySelectorAll('.lootbox-card').forEach(c => c.classList.remove('drag-over'));
            card.classList.add('drag-over');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (!draggedId || draggedId === card.dataset.boxId) return;
            const draggedEl = container.querySelector(`.lootbox-card[data-box-id="${draggedId}"]`);
            if (!draggedEl) return;
            // 将拖拽元素插入到目标元素之前或之后
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                card.before(draggedEl);
            } else {
                card.after(draggedEl);
            }
            saveBoxOrderFromDOM();
        });
    });
}

function filterBoxList() {
    const query = (document.getElementById('lootbox-search')?.value || '').toLowerCase();
    document.querySelectorAll('.lootbox-card').forEach(card => {
        const name = (card.querySelector('.lootbox-card-name')?.textContent || '').toLowerCase();
        card.classList.toggle('hidden', query && !name.includes(query));
    });
}
function selectBox(boxId) {
    _currentBoxId = boxId;
    const box = getBoxData(boxId);
    if (!box) return;
    document.querySelectorAll('.lootbox-card').forEach(c => c.classList.toggle('active', c.dataset.boxId === boxId));
    updateDrawArea(box);
    renderStatsPanel();
    initCanvas();
}
function updateDrawArea(box) {
    const coverImg = document.getElementById('lootbox-cover-img');
    const coverFallback = document.getElementById('lootbox-cover-fallback');
    const xinchunBtns = document.getElementById('lootbox-xinchun-btns');
    const drawBtns = document.getElementById('lootbox-draw-btns');
    const resultOverlay = document.getElementById('lootbox-result-overlay');
    if (resultOverlay) resultOverlay.classList.add('hidden');
    if (coverImg) { coverImg.src = box.image; coverImg.style.display = ''; }
    if (coverFallback) coverFallback.style.display = 'none';
    if (box.type === 'spring_festival') {
        if (xinchunBtns) xinchunBtns.classList.remove('hidden');
        if (drawBtns) drawBtns.classList.add('hidden');
    } else {
        if (xinchunBtns) xinchunBtns.classList.add('hidden');
        if (drawBtns) drawBtns.classList.remove('hidden');
    }
}
function initCanvas() {
    const canvas = document.getElementById('lootbox-canvas');
    if (!canvas) return;
    const wrap = document.getElementById('lootbox-canvas-wrap');
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, rect.width, rect.height);
}

// ── 右侧：统计 + 心愿面板 ──
function renderStatsPanel() {
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    const pity = box.pity || {};

    document.getElementById('stat-total-draws').textContent = st.totalDraws;

    // ── 红色保底 ──
    // 优先级：常驻红保底（特殊保底已用后） > 循环红保底 > 特殊红保底（未触发时）
    let redRemain = null;
    let redRepeatable = false;
    if (pity.permRedPity && st.specialPityUsed && st.permRedPityTriggers < pity.permRedPity.maxTriggers) {
        redRemain = Math.max(0, pity.permRedPity.count - st.permRedPityCounter);
        redRepeatable = true;
    } else if (pity.cycle && pity.cycle.targetQuality === 'red') {
        redRemain = Math.max(0, pity.cycle.count - st.redPityCounter);
        redRepeatable = pity.cycle.repeatable !== false;
    } else if (pity.special && pity.special.targetQuality === 'red' && !st.specialPityUsed) {
        redRemain = Math.max(0, pity.special.count - st.redPityCounter);
        redRepeatable = false;
    }
    const redRow = document.getElementById('stat-red-row');
    const redEl = document.getElementById('stat-red-pity');
    if (redEl) {
        if (redRemain !== null) {
            const repeatHint = redRepeatable ? '<span style="color:#888;">（可重复触发）</span>' : '';
            redEl.innerHTML = redRemain + '次内必得神品外观' + repeatHint;
        }
    }
    if (redRow) redRow.style.display = redRemain !== null ? '' : 'none';

    // ── 紫色保底 ──
    let purpleRemain = null;
    let purpleRepeatable = false;
    if (pity.cycle && pity.cycle.targetQuality === 'purple') {
        purpleRemain = Math.max(0, pity.cycle.count - st.purplePityCounter);
        purpleRepeatable = pity.cycle.repeatable !== false;
    }
    const purpleRow = document.getElementById('stat-purple-row');
    const purplePityEl = document.getElementById('stat-purple-pity');
    if (purplePityEl) {
        if (purpleRemain !== null) {
            const repeatHint = purpleRepeatable ? '<span style="color:#888;">（可重复触发）</span>' : '';
            purplePityEl.innerHTML = purpleRemain + '次内必得优品及以上外观' + repeatHint;
        } else {
            purplePityEl.textContent = '—';
        }
    }
    if (purpleRow) purpleRow.style.display = purpleRemain !== null ? '' : 'none';

    // ── 极品外观保底（extraGoldPity）──
    const goldPityRow = document.getElementById('stat-gold-pity-row');
    const goldPityEl = document.getElementById('stat-gold-pity');
    if (pity.extraGoldPity && goldPityEl && goldPityRow) {
        const remain = Math.max(0, pity.extraGoldPity.count - st.goldPityCounter);
        const triggered = st.goldPityTriggers;
        const max = pity.extraGoldPity.maxTriggers || 14;
        goldPityEl.textContent = remain + '次内必得极品外观（已触发 ' + triggered + '/' + max + '）';
        goldPityRow.style.display = '';
    } else if (goldPityRow) {
        goldPityRow.style.display = 'none';
    }

    // ── 特殊保底状态 ──
    const extremeRow = document.getElementById('stat-extreme-row');
    const extremeEl = document.getElementById('stat-extreme-pity');
    const hasSpecialOrPerm = pity.special || pity.permRedPity;
    if (hasSpecialOrPerm && extremeEl && extremeRow) {
        let specialInfo = '';
        if (pity.special) {
            specialInfo = !st.specialPityUsed
                ? Math.max(0, pity.special.count - st.redPityCounter) + ' 次后触发'
                : '已触发';
        }
        let permRedInfo = '';
        if (pity.permRedPity) {
            const remain = Math.max(0, pity.permRedPity.count - st.permRedPityCounter);
            const left = pity.permRedPity.maxTriggers - st.permRedPityTriggers;
            permRedInfo = (specialInfo ? ' | ' : '') + '常驻红: ' + remain + '次(剩' + left + '/' + pity.permRedPity.maxTriggers + ')';
        }
        extremeEl.textContent = specialInfo + permRedInfo;
        extremeRow.style.display = '';
    } else if (extremeRow) {
        extremeRow.style.display = 'none';
    }

    // 心愿面板
    renderWishPanel(box, st);
    renderHistory();
}

function renderWishPanel(box, st) {
    const container = document.getElementById('lootbox-wish-container');
    if (!container) return;
    const pity = box.pity || {};
    if (!pity.wishEnabled) {
        container.innerHTML = '';
        return;
    }
    const wishItemName = st.wishItem || '未设置';
    const goldItems = (box.items || []).filter(i => i.quality === 'gold');
    const wishItemObj = goldItems.find(i => i.name === st.wishItem);
    const hasCharges = st.wishCount > 0;

    let html = `<div class="lootbox-wish-panel">
        <div class="wish-header-row">
            <h4>❤️ 心愿极品外观</h4>`;
    html += `<div class="wish-current-preview">`;
    if (wishItemObj) {
        html += `<img src="${wishItemObj.image}" alt="${escapeHTML(wishItemObj.name)}" class="wish-preview-img"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                 <span style="display:none;width:48px;height:48px;background:#222;border-radius:4px;align-items:center;justify-content:center;font-size:24px;">🎁</span>`;
    } else {
        html += `<div class="wish-preview-placeholder">?</div>`;
    }
    html += `</div></div>
        <div class="wish-charges">可用次数：${st.wishCount} 次</div>
        <button class="wish-select-btn${hasCharges ? '' : ' disabled'}"
                onclick="${hasCharges ? 'openWishModal()' : 'showToast(\'没有心愿次数，请先抽到红色品质获得心愿次数\',\'warning\')'}">
            ${st.wishItem ? '更换心愿' : '选择心愿'}
        </button>
    </div>`;
    container.innerHTML = html;
}

function openWishModal() {
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    if (st.wishCount <= 0) { showToast('没有心愿次数', 'warning'); return; }
    const goldItems = (box.items || []).filter(i => i.quality === 'gold');
    const grid = document.getElementById('wish-modal-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="wish-item-opt' + (!st.wishItem ? ' active' : '') + '" onclick="setWishItem(\'\');closeWishModal();" title="取消心愿" style="aspect-ratio:1;"><div class="wish-item-opt-img" style="background:#333;display:flex;align-items:center;justify-content:center;font-size:24px;color:#888;">✕</div></div>' +
        goldItems.map(i => {
            const active = st.wishItem === i.name ? ' active' : '';
            const owned = st.ownedItems.includes(i.name) ? ' owned' : '';
            return `<div class="wish-item-opt${active}${owned}" onclick="setWishItem('${escapeHTML(i.name)}');closeWishModal();" title="${escapeHTML(i.name)}" style="aspect-ratio:1;">
                <img src="${i.image}" alt="${escapeHTML(i.name)}" class="wish-item-opt-img"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <span style="display:none;width:100%;height:100%;background:#222;align-items:center;justify-content:center;font-size:24px;">🎁</span>
                ${owned ? '<div class="owned-overlay">✓ 已拥有</div>' : ''}
            </div>`;
        }).join('');
    document.getElementById('lootbox-wish-modal').classList.add('active');
}
function closeWishModal() {
    document.getElementById('lootbox-wish-modal').classList.remove('active');
}

function renderHistory() {
    const st = getBoxState(_currentBoxId);
    const list = document.getElementById('lootbox-history-list');
    if (!list) return;
    const history = (st.history || []).slice(-50);
    list.innerHTML = history.length === 0
        ? '<li style="color:#666;">暂无记录</li>'
        : history.map((h, i) => {
            const cfg = qCfg(h.quality);
            const realIdx = st.history.length - history.length + i;
            const label = h.drawType ? `<span style="color:#e3a94a;">${escapeHTML(h.drawType)}</span> ` : '';
            return `<li><button class="history-del-btn" onclick="deleteHistoryEntry(${realIdx})" title="删除此条">✕</button>
                ${label}<span class="${cfg.cssClass}">[${cfg.label}]</span> ${escapeHTML(h.itemName)} <span style="color:#666;font-size:10px;">${h.time||''}</span></li>`;
        }).reverse().join('');
}

function deleteHistoryEntry(index) {
    const st = getBoxState(_currentBoxId);
    if (!st.history || index < 0 || index >= st.history.length) return;
    st.history.splice(index, 1);
    saveConfigDebounced(300);
    renderHistory();
    showToast('已删除该条记录', 'success');
}
function clearHistory() {
    if (!confirm('确定要清空当前宝箱的所有开箱记录吗？此操作不可撤销。')) return;
    const st = getBoxState(_currentBoxId);
    st.history = [];
    saveConfigDebounced(300);
    renderHistory();
    showToast('开箱记录已清空', 'success');
}

// ==================== 抽奖核心 ====================
function performDrawLogic(box, st) {
    const pity = box.pity || {};
    let forcedQuality = null;
    let isPity = false;
    let isWish = false;
    let pityLabel = '';

    // 1. 常驻红色保底（神骏宝炉专用，特殊保底已用后生效）
    if (pity.permRedPity && st.specialPityUsed && st.permRedPityTriggers < pity.permRedPity.maxTriggers &&
        st.permRedPityCounter + 1 >= pity.permRedPity.count) {
        forcedQuality = 'red';
        isPity = true;
        pityLabel = '常驻红色保底';
        st.permRedPityTriggers++;
        st.permRedPityCounter = 0;
        st.redPityCounter = 0;
    }
    // 2. 特殊保底优先
    else if (pity.special && st.specialPityActive && st.redPityCounter + 1 >= pity.special.count) {
        forcedQuality = pity.special.targetQuality;
        isPity = true;
        pityLabel = '特殊保底';
        st.specialPityActive = false;
        st.specialPityUsed = true;
        st.redPityCounter = 0;
    }
    // 3. 循环红保底
    else if (pity.cycle && pity.cycle.targetQuality === 'red' && st.redPityCounter + 1 >= pity.cycle.count) {
        forcedQuality = 'red';
        isPity = true;
        pityLabel = '循环保底';
        st.redPityCounter = 0;
    }
    // 4. 循环紫保底
    else if (pity.cycle && pity.cycle.targetQuality === 'purple' && st.purplePityCounter + 1 >= pity.cycle.count) {
        forcedQuality = 'purple';
        isPity = true;
        pityLabel = '循环保底';
        st.purplePityCounter = 0;
    }
    // 5. 极品外观保底
    else if (pity.extraGoldPity && st.goldPityTriggers < pity.extraGoldPity.maxTriggers &&
             st.goldPityCounter + 1 >= pity.extraGoldPity.count) {
        forcedQuality = 'gold';
        isPity = true;
        pityLabel = '极品保底';
        st.goldPityTriggers++;
        st.goldPityCounter = 0;
    }

    // 无保底 → 概率随机
    let quality;
    if (forcedQuality) {
        quality = forcedQuality;
    } else {
        const probs = box.probabilities || {};
        const qualities = Object.keys(probs).filter(q => probs[q] > 0);
        const totalWeight = qualities.reduce((s, q) => s + probs[q], 0);
        let rand = Math.random() * totalWeight;
        quality = qualities[qualities.length - 1] || 'blue';
        for (const q of qualities) {
            rand -= probs[q];
            if (rand <= 0) { quality = q; break; }
        }
    }

    // 选物品（排除已拥有的红色防重复）
    let pool = (box.items || []).filter(i => i.quality === quality);
    if (quality === 'red' && pity.noRepeatRed) {
        const unowned = pool.filter(i => !st.ownedItems.includes(i.name));
        if (unowned.length > 0) pool = unowned;
    }
    if (pool.length === 0) pool = (box.items || []).filter(i => i.quality === quality);

    // 心愿系统
    if (quality === 'gold' && st.wishCount > 0 && st.wishItem && pity.wishEnabled) {
        const wishItem = pool.find(i => i.name === st.wishItem);
        if (wishItem) {
            st.wishCount--;
            isWish = true;
            const item = wishItem;
            updateCounters(st, pity, 'gold', isPity, quality);
            // Don't auto-own — will be owned after result display ends
            return { item, quality: 'gold', isPity, isWish, pityLabel };
        }
    }

    const item = pool[Math.floor(Math.random() * pool.length)];
    updateCounters(st, pity, quality, isPity, forcedQuality);
    // Don't auto-own — will be owned after result display ends

    return { item, quality, isPity, isWish, pityLabel };
}

function autoOwnItem(st, item) {
    if (!st.ownedItems.includes(item.name)) {
        st.ownedItems.push(item.name);
    }
}

function updateCounters(st, pity, quality, isPity, forcedQuality) {
    st.totalDraws++;

    // 红保底计数（始终追踪：供循环红保底、特殊保底、常驻红保底使用）
    if (quality === 'red') {
        if (!isPity) st.redPityCounter = 0; // 自然出红重置（保底出红在各分支已重置）
    } else {
        st.redPityCounter++;
    }

    // 循环紫保底计数（抽出紫色或更高品质时重置）
    if (pity.cycle && pity.cycle.targetQuality === 'purple') {
        if (quality === 'purple' || quality === 'gold' || quality === 'red' || quality === 'orange') {
            st.purplePityCounter = 0;
        } else {
            st.purplePityCounter++;
        }
    }

    // 极品保底计数
    if (pity.extraGoldPity) {
        if (quality === 'gold' && !isPity) { st.goldPityCounter = 0; }
        else { st.goldPityCounter++; }
    }

    // 红出奖励心愿次数
    if (quality === 'red' && pity.wishEnabled) {
        st.wishCount++;
    }

    // 常驻红色保底计数（神骏专用）
    if (pity.permRedPity && st.specialPityUsed && st.permRedPityTriggers < pity.permRedPity.maxTriggers) {
        if (quality === 'red') {
            if (!isPity || forcedQuality !== 'red') st.permRedPityCounter = 0;
        } else {
            st.permRedPityCounter++;
        }
    }
}

// ── 抽奖入口 ──
function performSingleDraw() {
    if (_isDrawing) return;
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    _isDrawing = true;
    setButtonsEnabled(false);
    const result = performDrawLogic(box, st);
    st.history.push({ itemName: result.item.name, quality: result.quality, time: getFormattedTime(), drawType: '单抽' });
    if (st.history.length > 200) st.history = st.history.slice(-200);
    saveConfigDebounced(300);
    // Track items to own after display
    const newItems = [result.item.name];
    // 🔊 开始摇晃音效
    if (window.LootboxSoundModule) window.LootboxSoundModule.startBoxShake();
    runRegularAnimation(box, [result], () => {
        // 🔊 停止摇晃，播放揭示音效
        if (window.LootboxSoundModule) {
            window.LootboxSoundModule.stopBoxShake();
            window.LootboxSoundModule.playReveal(result.quality);
        }
        showResults(box, [result], () => {
            // Own items after results dismiss
            newItems.forEach(name => { if (!st.ownedItems.includes(name)) st.ownedItems.push(name); });
            saveConfigDebounced(300);
            renderStatsPanel(); renderBoxList(); setButtonsEnabled(true); _isDrawing = false;
        });
    });
}
function performMultiDraw(count) {
    if (_isDrawing) return;
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    _isDrawing = true;
    setButtonsEnabled(false);
    const results = [];
    const newItems = [];
    for (let i = 0; i < count; i++) {
        const r = performDrawLogic(box, st);
        st.history.push({ itemName: r.item.name, quality: r.quality, time: getFormattedTime(), drawType: '十连抽' });
        results.push(r);
        newItems.push(r.item.name);
    }
    if (st.history.length > 200) st.history = st.history.slice(-200);
    saveConfigDebounced(300);
    // 🔊 开始摇晃音效
    if (window.LootboxSoundModule) window.LootboxSoundModule.startBoxShake();
    runRegularAnimation(box, results, () => {
        // 🔊 停止摇晃，播放最高品质揭示音效（十连抽避免同时播多个音效）
        if (window.LootboxSoundModule) {
            window.LootboxSoundModule.stopBoxShake();
            const highestQuality = results.reduce((best, r) => {
                return QUALITY_ORDER.indexOf(r.quality) > QUALITY_ORDER.indexOf(best) ? r.quality : best;
            }, 'blue');
            window.LootboxSoundModule.playReveal(highestQuality);
        }
        showResults(box, results, () => {
            newItems.forEach(name => { if (!st.ownedItems.includes(name)) st.ownedItems.push(name); });
            saveConfigDebounced(300);
            renderStatsPanel(); renderBoxList(); setButtonsEnabled(true); _isDrawing = false;
        });
    });
}
function setButtonsEnabled(enabled) {
    const btns = document.querySelectorAll('#lootbox-draw-btns .draw-btn, #lootbox-xinchun-btns button');
    btns.forEach(b => b.disabled = !enabled);
}

// ==================== Canvas 动画 — 常规宝箱 ====================
function runRegularAnimation(box, results, callback) {
    const canvas = document.getElementById('lootbox-canvas');
    const wrap = document.getElementById('lootbox-canvas-wrap');
    if (!canvas || !wrap) { callback(); return; }
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    const W = rect.width, H = rect.height;
    const cx = W / 2, cy = H / 2;

    // Show cover during animation (box sways as orbs emerge)
    const coverImg = document.getElementById('lootbox-cover-img');
    if (coverImg) coverImg.style.display = '';
    const coverFallback = document.getElementById('lootbox-cover-fallback');
    if (coverFallback) coverFallback.style.display = 'none';

    // Sort results: low quality first for suspense
    const sorted = [...results].sort((a, b) => {
        return QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality);
    });

    const totalOrbs = sorted.length;
    const startTime = performance.now();
    const particles = [];
    const trailParticles = [];
    const boxCx = cx, boxCy = H * 0.6;

    // Timing: build accumulated schedule
    // - Anticipation before each orb (box glows, shakes more)
    // - Orb emerges with trail
    // - Orb floats up and settles
    const ANTICIPATION_BASE = 180;
    const ANTICIPATION_PER_QUALITY = { blue: 80, purple: 150, orange: 300, gold: 480, red: 800 };
    const EMERGE_DURATION = { blue: 150, purple: 220, orange: 320, gold: 420, red: 580 };
    const FLOAT_AFTER = 400;

    // Build timeline
    // 十连抽时前6个光点加速出现（由快到慢），第7个起恢复正常速度
    const isTenDraw = totalOrbs === 10;
    let currentTime = 300; // initial box breathing
    const orbs = sorted.map((r, i) => {
        const cfg = qCfg(r.quality);
        const anticipation = ANTICIPATION_BASE + (ANTICIPATION_PER_QUALITY[r.quality] || 200);
        const emergeDur = EMERGE_DURATION[r.quality] || 300;

        // 十连抽前6个光点：间隔从 15ms 逐渐增加到 150ms（二次曲线）
        let gap;
        if (isTenDraw && i < 6) {
            const t = i / 5; // 0 → 1
            gap = 15 + t * t * 135; // 15, 20, 36, 64, 101, 150
        } else {
            gap = 150;
        }

        const orbData = {
            result: r,
            cfg,
            anticipationStart: currentTime,
            emergeStart: currentTime + anticipation,
            emergeDur,
            emergeEnd: currentTime + anticipation + emergeDur,
            targetX: cx + (totalOrbs > 1 ? (i - (totalOrbs - 1) / 2) * 35 : 0),
            targetY: cy - 45 - (QUALITY_ORDER.indexOf(r.quality) * 25),
            settled: false,
            // runtime state
            orbX: boxCx, orbY: boxCy,
            alpha: 0, scale: 0,
            trail: [],
            _soundPlayed: false,
        };
        currentTime += anticipation + emergeDur + gap;
        return orbData;
    });

    const totalDuration = currentTime + FLOAT_AFTER;
    const lastOrb = orbs[orbs.length - 1];
    const hasRed = results.some(r => r.quality === 'red');
    const highestQuality = sorted[sorted.length - 1].quality;

    // Spawn spark particles at a position
    function spawnSparks(x, y, color, count, spread) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * spread;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 0.5 + Math.random() * 0.8,
                decay: 0.01 + Math.random() * 0.03,
                color,
                size: 1.5 + Math.random() * 3,
            });
        }
    }

    function spawnTrail(x, y, color, alpha) {
        trailParticles.push({ x, y, color, alpha, life: 0.3, decay: 0.04 });
    }

    function frame(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / totalDuration);
        ctx.clearRect(0, 0, W, H);

        // ── Draw ambient box glow (pulses, intensifies during anticipation) ──
        let maxAnticipationIntensity = 0;
        orbs.forEach(o => {
            if (elapsed >= o.anticipationStart && elapsed < o.emergeStart) {
                const ap = (elapsed - o.anticipationStart) / (o.emergeStart - o.anticipationStart);
                maxAnticipationIntensity = Math.max(maxAnticipationIntensity, ap);
            }
        });
        const baseGlow = 0.08 + Math.sin(elapsed * 0.004) * 0.04;
        const glowAlpha = baseGlow + maxAnticipationIntensity * 0.35;
        const glowGrad = ctx.createRadialGradient(boxCx, boxCy, 20, boxCx, boxCy, 120);
        glowGrad.addColorStop(0, `rgba(255,220,100,${glowAlpha})`);
        glowGrad.addColorStop(0.5, `rgba(255,180,50,${glowAlpha * 0.5})`);
        glowGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath(); ctx.arc(boxCx, boxCy, 120, 0, Math.PI * 2); ctx.fill();

        // ── Update sway intensity based on active orb ──
        let swayIntensity = 0;
        orbs.forEach(o => {
            if (elapsed >= o.anticipationStart && elapsed < o.emergeStart) {
                const ap = (elapsed - o.anticipationStart) / (o.emergeStart - o.anticipationStart);
                const qIdx = QUALITY_ORDER.indexOf(o.result.quality);
                swayIntensity = Math.max(swayIntensity, ap * (2 + qIdx * 1.5));
            }
            if (elapsed >= o.emergeStart && elapsed < o.emergeEnd) {
                swayIntensity = Math.max(swayIntensity, 3);
            }
        });

        // Apply sway to cover image
        if (coverImg && swayIntensity > 0) {
            const angle = Math.sin(elapsed * 0.025) * swayIntensity;
            coverImg.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
            coverImg.classList.add('swaying');
        } else if (coverImg) {
            coverImg.classList.remove('swaying');
            coverImg.style.transform = '';
        }

        // ── Update and draw orbs ──
        orbs.forEach(o => {
            if (elapsed < o.anticipationStart) return;

            // During anticipation: orb builds up inside box (small glow visible)
            if (elapsed >= o.anticipationStart && elapsed < o.emergeStart) {
                const ap = (elapsed - o.anticipationStart) / (o.emergeStart - o.anticipationStart);
                o.alpha = ap * 0.3;
                o.scale = ap * 0.4;
                o.orbX = boxCx;
                o.orbY = boxCy - ap * 15;
                // Light particles leaking from box during anticipation
                if (Math.random() < ap * 0.3) {
                    spawnSparks(boxCx + (Math.random() - 0.5) * 40, boxCy - 20, o.cfg.orbGlow, 1, 2);
                }
            }

            // During emergence: orb shoots up with trail
            if (elapsed >= o.emergeStart && elapsed < o.emergeEnd) {
                if (!o._soundPlayed) {
                    o._soundPlayed = true;
                    if (window.LootboxSoundModule) window.LootboxSoundModule.playOrbEmerge(o.result.quality);
                }
                const ep = (elapsed - o.emergeStart) / o.emergeDur;
                // Ease-out: fast start, slow at top
                const eased = 1 - Math.pow(1 - ep, 3);
                o.alpha = 0.3 + eased * 0.7;
                o.scale = 0.3 + eased * 0.7;
                o.orbX = boxCx + (o.targetX - boxCx) * eased;
                o.orbY = boxCy + (o.targetY - boxCy) * eased;

                // Trail
                if (Math.random() < 0.6) {
                    spawnTrail(o.orbX + (Math.random() - 0.5) * 8, o.orbY + (Math.random() - 0.5) * 8, o.cfg.orbGlow, o.alpha * 0.6);
                }
                // Sparks during emergence
                if (Math.random() < 0.4) {
                    spawnSparks(o.orbX, o.orbY, o.cfg.orbColor, 1, 4);
                }

                // At emergence end: burst of sparks
                if (ep > 0.85 && !o._burstDone) {
                    o._burstDone = true;
                    spawnSparks(o.targetX, o.targetY, o.cfg.orbColor, 15 + QUALITY_ORDER.indexOf(o.result.quality) * 8, 5);
                    // Red shockwave on emerge
                    if (o.result.quality === 'red') {
                        if (!wrap.classList.contains('shake')) {
                            wrap.classList.add('shake');
                            setTimeout(() => wrap.classList.remove('shake'), 600);
                        }
                    }
                }
            }

            // Settled: orb floats gently at target position
            if (elapsed >= o.emergeEnd) {
                o.settled = true;
                o.alpha = 0.9 + Math.sin(elapsed * 0.003 + o.targetX) * 0.1;
                o.scale = 1.0;
                const wobble = Math.sin(elapsed * 0.004 + o.targetX * 0.1) * 3;
                o.orbX = o.targetX;
                o.orbY = o.targetY + wobble;
                // Occasional spark from settled orb
                if (Math.random() < 0.05) {
                    spawnSparks(o.orbX, o.orbY, o.cfg.orbColor, 1, 2);
                }
            }

            // Draw orb trail
            if (o.alpha > 0) {
                const orbR = o.cfg.orbSize * (0.4 + o.scale * 0.6);
                const ox = o.orbX, oy = o.orbY;

                // Outer glow ring
                const glowR = orbR * 2.8;
                const glow = ctx.createRadialGradient(ox, oy, orbR * 0.4, ox, oy, glowR);
                glow.addColorStop(0, o.cfg.orbGlow + 'cc');
                glow.addColorStop(0.35, o.cfg.orbGlow + '55');
                glow.addColorStop(1, 'transparent');
                ctx.save();
                ctx.globalAlpha = o.alpha;
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(ox, oy, glowR, 0, Math.PI * 2); ctx.fill();

                // Core orb
                const orbGrad = ctx.createRadialGradient(ox - orbR*0.15, oy - orbR*0.2, 1, ox, oy, orbR);
                orbGrad.addColorStop(0, '#ffffff');
                orbGrad.addColorStop(0.25, o.cfg.orbColor);
                orbGrad.addColorStop(1, o.cfg.orbGlow);
                ctx.fillStyle = orbGrad;
                ctx.beginPath(); ctx.arc(ox, oy, orbR, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        });

        // ── Draw trail particles ──
        trailParticles.forEach((p, i) => {
            p.life -= p.decay;
            if (p.life <= 0) { trailParticles.splice(i, 1); return; }
            ctx.save();
            ctx.globalAlpha = p.alpha * (p.life / 0.3);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        // Limit trails
        if (trailParticles.length > 80) trailParticles.splice(0, trailParticles.length - 80);

        // ── Draw spark particles ──
        particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.05; // slight gravity
            p.life -= p.decay;
            if (p.life <= 0) { particles.splice(i, 1); return; }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        if (particles.length > 200) particles.splice(0, particles.length - 200);

        // ── Draw red shockwave expanding ──
        if (hasRed) {
            const redOrb = orbs.find(o => o.result.quality === 'red');
            if (redOrb && elapsed > redOrb.emergeEnd && elapsed < redOrb.emergeEnd + 800) {
                const swProgress = (elapsed - redOrb.emergeEnd) / 800;
                ctx.save();
                ctx.strokeStyle = `rgba(255,68,68,${0.5 * (1 - swProgress)})`;
                ctx.lineWidth = 4 * (1 - swProgress);
                ctx.beginPath(); ctx.arc(cx, cy, swProgress * 250, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }
        }

        // ── All settled → brief moment then reveal ──
        const allSettled = orbs.every(o => o.settled);
        const settledTime = elapsed - (lastOrb.emergeEnd);
        const shouldReveal = allSettled && settledTime > FLOAT_AFTER;

        if (!shouldReveal) {
            _animFrameId = requestAnimationFrame(frame);
        } else {
            ctx.clearRect(0, 0, W, H);
            if (coverImg) { coverImg.classList.remove('swaying'); coverImg.style.transform = ''; }
            if (coverImg) coverImg.style.display = '';
            callback(); // callback now calls showResults with onDismiss
        }
    }
    _animFrameId = requestAnimationFrame(frame);
}

// ── 展示结果 ──
function showResults(box, results, onDismiss) {
    const overlay = document.getElementById('lootbox-result-overlay');
    const cardsContainer = document.getElementById('lootbox-result-cards');
    if (!overlay || !cardsContainer) { if (onDismiss) onDismiss(); return; }
    overlay.classList.remove('hidden');
    const count = results.length;

    // Determine grid class based on count
    let gridClass = '';
    if (count === 1) gridClass = 'result-count-1';
    else if (count === 4) gridClass = 'result-count-4';
    else gridClass = 'result-count-10';
    cardsContainer.className = 'lootbox-result-grid ' + gridClass;

    // 按品质从高到低排序，同品质保持原抽取顺序
    const sorted = [...results].sort((a, b) => {
        const idxA = QUALITY_ORDER.indexOf(a.quality);
        const idxB = QUALITY_ORDER.indexOf(b.quality);
        return idxB - idxA;
    });

    // Build result cards — check pre-existing ownership (items from this draw aren't owned yet)
    const st = getBoxState(_currentBoxId);
    cardsContainer.innerHTML = sorted.map((r, i) => {
        const cfg = qCfg(r.quality);
        const alreadyOwned = st.ownedItems.includes(r.item.name);
        return `<div class="lootbox-result-card" style="animation-delay:${i * 0.05}s;position:relative;">
            <div class="result-img-wrap">
                <img src="${r.item.image}" alt="${escapeHTML(r.item.name)}" class="${cfg.borderClass}"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                <span class="result-img-fallback">🎁</span>
                ${alreadyOwned ? '<div class="result-owned-overlay">✓ 已拥有</div>' : ''}
            </div>
            <div class="result-item-info">
                <span class="result-quality ${cfg.cssClass}">${cfg.label}${r.isWish ? ' ❤️心愿' : ''}</span>
                <span class="result-item-name" title="${escapeHTML(r.item.name)}">${escapeHTML(r.item.name)}</span>
            </div>
        </div>`;
    }).join('');

    // Dismiss handler
    function dismiss() {
        overlay.classList.add('hidden');
        cardsContainer.innerHTML = '';
        clearTimeout(overlay._dismissTimer);
        if (onDismiss) onDismiss();
    }
    clearTimeout(overlay._dismissTimer);
    overlay._dismissTimer = setTimeout(dismiss, 150000); // 2分30秒后自动关闭
    overlay.onclick = dismiss;
}

// ==================== 新春系列 ====================
function startXinchunDraw(btnIndex) {
    if (_isDrawing) return;
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    _isDrawing = true;
    setButtonsEnabled(false);
    const count = btnIndex === 4 ? 4 : 1;
    const drawType = XINCHUN_BTN_NAMES[btnIndex] || '新春';
    const results = [];
    const newItems = [];
    for (let i = 0; i < count; i++) {
        const r = performDrawLogic(box, st);
        st.history.push({ itemName: r.item.name, quality: r.quality, time: getFormattedTime(), drawType });
        results.push(r);
        newItems.push(r.item.name);
    }
    if (st.history.length > 200) st.history = st.history.slice(-200);
    saveConfigDebounced(300);
    // 🔊 开始球滚动音效
    if (window.LootboxSoundModule) window.LootboxSoundModule.startBallRoll();
    runXinchunAnimation(box, results, btnIndex, () => {
        // 🔊 停止球滚动，播放最高品质揭示音效
        if (window.LootboxSoundModule) {
            window.LootboxSoundModule.stopBallRoll();
            const highestQuality = results.reduce((best, r) => {
                return QUALITY_ORDER.indexOf(r.quality) > QUALITY_ORDER.indexOf(best) ? r.quality : best;
            }, 'blue');
            window.LootboxSoundModule.playReveal(highestQuality);
        }
        showResults(box, results, () => {
            newItems.forEach(name => { if (!st.ownedItems.includes(name)) st.ownedItems.push(name); });
            saveConfigDebounced(300);
            renderStatsPanel(); renderBoxList(); setButtonsEnabled(true); _isDrawing = false;
        });
    });
}

function runXinchunAnimation(box, results, btnIndex, callback) {
    const canvas = document.getElementById('lootbox-canvas');
    const wrap = document.getElementById('lootbox-canvas-wrap');
    if (!canvas || !wrap) { callback(); return; }
    const coverImg = document.getElementById('lootbox-cover-img');
    if (coverImg) coverImg.style.display = 'none';
    const coverFallback = document.getElementById('lootbox-cover-fallback');
    if (coverFallback) coverFallback.style.display = 'none';

    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    const W = rect.width, H = rect.height;
    const isAll = btnIndex === 4;
    const startTime = performance.now();

    const numCols = isAll ? 4 : 1;
    // 统一尺寸：四抽就是四个单抽并列
    const colW = 88;
    const colH = 300;
    const ballR = 28;
    const ballGap = 12;
    const ballStep = ballR * 2 + ballGap;

    // Build randomized ball sequence: roughly equal mix of the 3 qualities, shuffled
    const qualityKeys = ['purple', 'gold', 'red'];
    const ballSeq = [];
    // Generate 30 balls with equal-ish distribution (10 each), then shuffle
    for (let i = 0; i < 10; i++) qualityKeys.forEach(q => ballSeq.push(q));
    // Fisher-Yates shuffle
    for (let i = ballSeq.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ballSeq[i], ballSeq[j]] = [ballSeq[j], ballSeq[i]];
    }
    const seqH = ballSeq.length * ballStep;

    // Build columns: each has a target offset to land targetQ at highlight center
    const cols = [];
    for (let c = 0; c < numCols; c++) {
        const result = results[c] || results[0];
        const targetQ = result.quality;
        const highlightY = H / 2;
        // Find a random occurrence of targetQ in the sequence
        const matches = [];
        ballSeq.forEach((q, i) => { if (q === targetQ) matches.push(i); });
        // Fallback: if quality not in sequence (shouldn't happen), use first ball
        const targetIdx = matches.length > 0
            ? matches[Math.floor(Math.random() * matches.length)]
            : 0;
        // Offset needed so that ball at targetIdx sits exactly at highlightY
        // Ball center at highlight: colTop - ballR + (targetIdx*ballStep + targetOffset) = colTop + colH/2
        // => targetOffset = colH/2 + ballR - targetIdx * ballStep
        let targetOffset = (colH/2 + ballR - targetIdx * ballStep) % seqH;
        if (targetOffset < 0) targetOffset += seqH;
        if (targetOffset < 0) targetOffset += seqH;

        // 上方球的品质（bump 使球越过目标后，框中出现的是上一颗球 targetIdx-1）
        // 用于决定"擦肩而过"概率：差点落到上方那颗球，然后拉回目标
        const prevBallIdx = (targetIdx - 1 + ballSeq.length) % ballSeq.length;
        const prevBallQuality = ballSeq[prevBallIdx];

        // 画布 4 等分，列居中对齐对应按钮区域
        const zoneIdx = isAll ? c : btnIndex;
        const totalSpread = colW * 4 + 12 * 3; // 列总宽 + 间距
        const zoneCenterX = (W - totalSpread) / 2 + colW / 2 + zoneIdx * (colW + 12);

        cols.push({
            x: zoneCenterX - colW / 2,
            colTop: H/2 - colH/2,
            result, targetQ, targetOffset,
            offset: Math.random() * seqH,  // random start position
            phase: 'fast',       // fast | decel | stopped
            fastSpeed: 38 + Math.random() * 10,
            decelStartOffset: 0,
            decelDuration: 0,
            decelRemaining: 0,
            stopTime: 0,
            // 悬念"擦肩"配置（减速开始时填充）
            hasTease: false,
            teaseAmplitude: 0,
            _prevBallQuality: prevBallQuality,
        });
    }

    // Stagger deceleration start: each column starts decelerating at a different time
    const fastDuration = 800;  // ms of fast scrolling
    const staggerDelay = isAll ? 500 : 0;  // ms between columns starting decel
    const decelBaseDuration = isAll ? 1800 : 2400;  // ms for deceleration phase
    const postStopPause = 900;  // ms pause after all stopped before reveal

    cols.forEach((cs, i) => {
        cs.decelStartTime = fastDuration + i * staggerDelay;
    });

    const totalDuration = fastDuration + (numCols - 1) * staggerDelay + decelBaseDuration + postStopPause;
    const particles = [];

    function spawnSpark(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y, color,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 0.4 + Math.random() * 0.6,
                decay: 0.015 + Math.random() * 0.03,
                size: 1 + Math.random() * 2.5,
            });
        }
    }

    function frame(timestamp) {
        const elapsed = timestamp - startTime;
        ctx.clearRect(0, 0, W, H);

        // Update column offsets
        cols.forEach(cs => {
            if (cs.phase === 'fast') {
                if (elapsed >= cs.decelStartTime) {
                    // Begin deceleration
                    cs.phase = 'decel';
                    // Calculate remaining distance to target
                    const currentMod = cs.offset % seqH;
                    let remaining = cs.targetOffset - currentMod;
                    if (remaining < 0) remaining += seqH;
                    // Add extra loops for dramatic effect
                    remaining += seqH * 3;
                    cs.decelRemaining = remaining;
                    cs.offsetAtDecelStart = cs.offset;

                    // ── 随机"擦肩而过"悬念配置 ──
                    // 上方球品质越高，触发概率越大（bump 使球越过目标，框中短暂出现上方球）
                    const pq = cs._prevBallQuality;
                    const teaseChance = pq === 'red' ? 0.95 : pq === 'gold' ? 0.80 : 0.55;
                    if (Math.random() < teaseChance) {
                        cs.hasTease = true;
                        // 滑过幅度：0.40~0.80 倍球径（随机）
                        // /0.54 补偿 bump 函数 sin²(πx)·(1-x) 峰值≈0.54
                        const overshootRatio = 0.40 + Math.random() * 0.40;
                        const overshootPixels = overshootRatio * ballStep;
                        cs.teaseAmplitude = overshootPixels / remaining / 0.54;
                        // 滑过越大 → bump 越早开始 → 拉回耗时越长，且与爬行重叠更多
                        cs.teaseBumpStart = 0.65 - (overshootRatio - 0.40) * 0.375; // 0.65→0.50
                    }
                } else {
                    cs.offset += cs.fastSpeed;
                }
            }
            if (cs.phase === 'decel') {
                const elapsedDecel = elapsed - cs.decelStartTime;
                const progress = Math.min(1, elapsedDecel / decelBaseDuration);
                // 基础缓动：末段仍有余速，与 bump 融为一体不分段
                let eased = 1 - Math.pow(1 - progress, 6);

                // "擦肩而过"：可变起点的单峰 bump，滑过越大→起点越早→拉回越慢
                if (cs.hasTease && progress > cs.teaseBumpStart) {
                    const bumpWidth = 1.0 - cs.teaseBumpStart;
                    const p = (progress - cs.teaseBumpStart) / bumpWidth; // 0→1
                    const factor = Math.pow(Math.sin(p * Math.PI), 2) * (1 - p);
                    eased += factor * cs.teaseAmplitude;
                }

                cs.offset = cs.offsetAtDecelStart + cs.decelRemaining * eased;
                if (progress >= 1) {
                    cs.phase = 'stopped';
                    cs.stopTime = elapsed;
                    spawnSpark(cs.x + colW/2, H/2, '#ffd700', 25);
                    // 🔊 球定格音效
                    if (window.LootboxSoundModule) window.LootboxSoundModule.playBallStop();
                }
            }
        });

        // 🔊 更新球滚动音效速度
        if (window.LootboxSoundModule) {
            let avgSpeed = 0;
            let activeCols = 0;
            cols.forEach(cs => {
                if (cs.phase === 'fast') { avgSpeed += 1; activeCols++; }
                else if (cs.phase === 'decel') {
                    const ed = elapsed - cs.decelStartTime;
                    const prog = Math.min(1, ed / decelBaseDuration);
                    avgSpeed += 1 - prog;
                    activeCols++;
                }
            });
            if (activeCols > 0) {
                window.LootboxSoundModule.updateBallRollSpeed(avgSpeed / activeCols);
            }
        }

        // Draw columns
        cols.forEach(cs => {
            const colTop = cs.colTop;
            const highlightY = colTop + colH / 2;
            const displayOffset = cs.offset % seqH;
            const isStopped = cs.phase === 'stopped';

            // Column background
            ctx.save();
            const bgGrad = ctx.createLinearGradient(cs.x, colTop, cs.x, colTop + colH);
            bgGrad.addColorStop(0, 'rgba(8,4,0,0.95)');
            bgGrad.addColorStop(0.5, 'rgba(18,8,0,0.88)');
            bgGrad.addColorStop(1, 'rgba(8,4,0,0.95)');
            ctx.fillStyle = bgGrad;
            ctx.strokeStyle = isStopped ? 'rgba(255,204,0,0.75)' : 'rgba(179,134,59,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cs.x, colTop, colW, colH, 10);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Clip
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(cs.x + 2, colTop + 2, colW - 4, colH - 4, 8);
            ctx.clip();

            // Draw balls
            for (let j = 0; j < 35; j++) {
                const idx = j % ballSeq.length;
                const q = ballSeq[idx];
                const cfg = qCfg(q);
                const cy = colTop - ballR + ((j * ballStep + displayOffset) % seqH);
                if (cy < colTop - ballR * 3 || cy > colTop + colH + ballR * 3) continue;

                const dist = Math.abs(cy - highlightY);
                const nearHighlight = dist < ballStep;
                const isWinner = isStopped && q === cs.targetQ && dist < ballStep * 0.35;

                // Particles when ball passes highlight during fast/decel
                if (!isStopped && nearHighlight && Math.random() < 0.4) {
                    spawnSpark(cs.x + colW/2, cy, cfg.orbGlow, 1);
                }

                ctx.save();
                if (nearHighlight && !isStopped) {
                    ctx.shadowColor = cfg.orbGlow;
                    ctx.shadowBlur = 8 + (1 - dist / ballStep) * 12;
                }
                if (isWinner) {
                    ctx.shadowColor = cfg.orbGlow;
                    ctx.shadowBlur = 32;
                }

                const scale = isWinner ? 1.35 : 1;
                const grad = ctx.createRadialGradient(
                    cs.x + colW/2 - ballR*0.2, cy - ballR*0.25, ballR*0.05,
                    cs.x + colW/2, cy, ballR * scale
                );
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.22, cfg.orbColor);
                grad.addColorStop(0.72, cfg.orbGlow);
                grad.addColorStop(1, 'rgba(0,0,0,0.25)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cs.x + colW/2, cy, ballR * scale, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.fillStyle = isWinner ? '#000' : 'rgba(0,0,0,0.8)';
                ctx.font = (isWinner ? 'bold ' : '') + ((isAll ? 10 : 12) * scale) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cfg.label, cs.x + colW/2, cy);
                ctx.restore();
            }
            ctx.restore();

            // Fixed highlight frame
            const frameH = ballStep + 6;
            const frameTop = highlightY - frameH / 2;
            const frameAlpha = isStopped ? 0.95 : (0.5 + Math.sin(elapsed * 0.006) * 0.15);

            ctx.save();
            // Outer glow
            const glowGrad = ctx.createLinearGradient(cs.x, frameTop - 8, cs.x, frameTop + frameH + 8);
            glowGrad.addColorStop(0, 'rgba(255,200,60,0)');
            glowGrad.addColorStop(0.5, `rgba(255,200,60,${frameAlpha * 0.5})`);
            glowGrad.addColorStop(1, 'rgba(255,200,60,0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(cs.x - 5, frameTop - 12, colW + 10, frameH + 24);

            // Frame border
            ctx.strokeStyle = `rgba(255,210,80,${frameAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(cs.x - 2, frameTop, colW + 4, frameH, 6);
            ctx.stroke();
            // Inner line
            ctx.strokeStyle = `rgba(255,255,200,${frameAlpha * 0.7})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(cs.x + 1, frameTop + 1, colW - 2, frameH - 2, 4);
            ctx.stroke();

            // Arrow indicators
            const arrSize = 8;
            ctx.fillStyle = `rgba(255,210,80,${frameAlpha})`;
            ctx.beginPath();
            ctx.moveTo(cs.x - 4, highlightY);
            ctx.lineTo(cs.x - 4 - arrSize, highlightY - arrSize);
            ctx.lineTo(cs.x - 4 - arrSize, highlightY + arrSize);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cs.x + colW + 4, highlightY);
            ctx.lineTo(cs.x + colW + 4 + arrSize, highlightY - arrSize);
            ctx.lineTo(cs.x + colW + 4 + arrSize, highlightY + arrSize);
            ctx.fill();
            ctx.restore();
        });

        // Draw particles
        particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) { particles.splice(i, 1); return; }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        if (particles.length > 150) particles.splice(0, particles.length - 150);

        // Check completion
        const allStopped = cols.every(cs => cs.phase === 'stopped');
        if (allStopped) {
            const lastStopTime = Math.max(...cols.map(cs => cs.stopTime));
            if (elapsed - lastStopTime > postStopPause) {
                ctx.clearRect(0, 0, W, H);
                if (coverImg) coverImg.style.display = '';
                if (coverFallback) coverFallback.style.display = 'none';
                callback();
                return;
            }
        }

        if (elapsed < totalDuration + 2000) {
            _animFrameId = requestAnimationFrame(frame);
        } else {
            // Safety timeout
            ctx.clearRect(0, 0, W, H);
            if (coverImg) coverImg.style.display = '';
            if (coverFallback) coverFallback.style.display = 'none';
            callback();
        }
    }
    _animFrameId = requestAnimationFrame(frame);
}

// ==================== 设置弹窗 ====================
function openBoxSettings() {
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    const pity = box.pity || {};
    document.getElementById('settings-box-name').textContent = box.name;
    document.getElementById('set-total-draws').value = st.totalDraws;
    document.getElementById('set-red-pity').value = st.redPityCounter;
    document.getElementById('set-purple-pity').value = st.purplePityCounter;
    document.getElementById('set-wish-count').value = st.wishCount;

    // ── 动态保底字段 ──
    // 特殊保底（双重保底宝箱）
    const specLabel = document.getElementById('set-special-label');
    const specSelect = document.getElementById('set-special-status');
    if (pity.special) {
        if (specLabel) specLabel.style.display = '';
        if (specSelect) specSelect.value = st.specialPityUsed ? 'used' : 'active';
    } else {
        if (specLabel) specLabel.style.display = 'none';
    }

    // 极品外观保底
    const goldPityLabel = document.getElementById('set-gold-pity-label');
    if (pity.extraGoldPity) {
        if (goldPityLabel) goldPityLabel.style.display = '';
        document.getElementById('set-gold-pity').value = st.goldPityCounter;
        document.getElementById('set-gold-triggers').value = st.goldPityTriggers;
        const maxTriggers = pity.extraGoldPity.maxTriggers || 14;
        document.getElementById('set-gold-triggers').max = maxTriggers;
        // 更新 "/14" 标签
        const triggersSpan = document.getElementById('set-gold-triggers').nextSibling;
        if (triggersSpan) triggersSpan.textContent = '/' + maxTriggers;
    } else {
        if (goldPityLabel) goldPityLabel.style.display = 'none';
    }

    // 常驻红色保底（神骏宝炉专用）
    const permRedLabel = document.getElementById('set-perm-red-label');
    if (pity.permRedPity) {
        if (permRedLabel) permRedLabel.style.display = '';
        document.getElementById('set-perm-red-pity').value = st.permRedPityCounter;
        document.getElementById('set-perm-red-triggers').value = st.permRedPityTriggers;
        const maxTriggers = pity.permRedPity.maxTriggers || 3;
        document.getElementById('set-perm-red-triggers').max = maxTriggers;
        const triggersSpan = document.getElementById('set-perm-red-triggers').nextSibling;
        if (triggersSpan) triggersSpan.textContent = '/' + maxTriggers;
    } else {
        if (permRedLabel) permRedLabel.style.display = 'none';
    }

    // Wish section
    const wishSection = document.getElementById('settings-wish-section');
    const wishHr = document.getElementById('settings-wish-hr');
    const wishGrid = document.getElementById('settings-wish-grid');
    if (pity.wishEnabled) {
        if (wishSection) wishSection.classList.remove('hidden');
        if (wishHr) wishHr.style.display = '';
        const goldItems = (box.items || []).filter(i => i.quality === 'gold');
        if (wishGrid) {
            wishGrid.innerHTML = '<div class="wish-item-opt' + (!st.wishItem ? ' active' : '') + '" onclick="setWishItem(\'\')" title="取消心愿" style="aspect-ratio:1;"><div class="wish-item-opt-img" style="background:#333;display:flex;align-items:center;justify-content:center;font-size:20px;color:#888;">✕</div></div>' +
                goldItems.map(i => {
                    const active = st.wishItem === i.name ? ' active' : '';
                    const owned = st.ownedItems.includes(i.name) ? ' owned' : '';
                    return `<div class="wish-item-opt${active}${owned}" onclick="setWishItem('${escapeHTML(i.name)}')" title="${escapeHTML(i.name)}" style="aspect-ratio:1;">
                        <img src="${i.image}" alt="${escapeHTML(i.name)}" class="wish-item-opt-img"
                             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                        <span style="display:none;width:100%;height:100%;background:#222;align-items:center;justify-content:center;font-size:24px;">🎁</span>
                        ${owned ? '<div class="owned-overlay">✓ 已拥有</div>' : ''}
                    </div>`;
                }).join('');
        }
    } else {
        if (wishSection) wishSection.classList.add('hidden');
        if (wishHr) wishHr.style.display = 'none';
    }

    // Prob sliders
    const probs = box.probabilities || {};
    const probContainer = document.getElementById('settings-prob-sliders');
    if (probContainer) probContainer.innerHTML = Object.keys(probs).map(q => {
        const cfg = qCfg(q);
        return `<label style="color:${cfg.color};font-weight:bold;">${cfg.label}%:
            <input type="number" step="0.1" min="0" max="100" value="${(probs[q]*100).toFixed(1)}"
                   style="width:55px;background:#222;color:#fff;border:1px solid ${cfg.color};text-align:center;border-radius:4px;"
                   data-quality="${q}" onchange="updateBoxProb('${q}',parseFloat(this.value))">
        </label>`;
    }).join('');

    // Items grid — card layout with owned overlay
    renderSettingsItemsGrid(box, st);
    document.getElementById('lootbox-settings-modal').classList.add('active');
}

function renderSettingsItemsGrid(box, st) {
    const grid = document.getElementById('settings-items-grid');
    if (!grid) return;
    grid.innerHTML = (box.items || []).map(item => {
        const cfg = qCfg(item.quality);
        const owned = st.ownedItems.includes(item.name);
        return `<div class="lootbox-item-card" onclick="toggleItemOwned('${escapeHTML(item.name)}')" title="${escapeHTML(item.name)}">
            <img src="${item.image}" alt="${escapeHTML(item.name)}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <span style="display:none;width:100%;height:100%;background:#222;align-items:center;justify-content:center;font-size:28px;">🎁</span>
            <span class="quality-badge" style="color:${cfg.color};">${cfg.label}</span>
            <span class="item-name-overlay">${escapeHTML(item.name)}</span>
            ${owned ? '<div class="owned-overlay">✓ 已拥有</div>' : ''}
        </div>`;
    }).join('');
}

function closeBoxSettings() {
    document.getElementById('lootbox-settings-modal').classList.remove('active');
    saveConfig();
    renderStatsPanel();
}
function toggleItemOwned(itemName) {
    const st = getBoxState(_currentBoxId);
    const idx = st.ownedItems.indexOf(itemName);
    if (idx >= 0) st.ownedItems.splice(idx, 1);
    else st.ownedItems.push(itemName);
    const box = getBoxData(_currentBoxId);
    renderSettingsItemsGrid(box, st);
}
function setWishItem(itemName) {
    const st = getBoxState(_currentBoxId);
    st.wishItem = itemName || null;
    const box = getBoxData(_currentBoxId);
    renderWishPanel(box, st);
    saveConfigDebounced(300);
}
function updateBoxStat(key, value) {
    const st = getBoxState(_currentBoxId);

    // ── 特殊复合键：特殊保底状态切换 ──
    if (key === 'specialStatus') {
        if (value === 'active')  { st.specialPityActive = true;  st.specialPityUsed = false; }
        if (value === 'used')    { st.specialPityActive = false; st.specialPityUsed = true;  }
        refreshSettingsInputs();
        saveConfigDebounced(300);
        renderStatsPanel();
        renderBoxList();
        return;
    }

    if (!(key in st)) return;

    // 基础兜底：非数字或 NaN 视为 0，负数视为 0
    if (typeof value === 'number' && (isNaN(value) || value < 0)) value = 0;
    st[key] = value;

    // 即时刷新所有关联 UI
    refreshSettingsInputs();
    saveConfigDebounced(300);
    renderStatsPanel();
    renderBoxList();
}

/** 同步设置弹窗内的输入框值（数据被 clamp 后回写） */
function refreshSettingsInputs() {
    const st = getBoxState(_currentBoxId);
    const box = getBoxData(_currentBoxId);
    const pity = box ? (box.pity || {}) : {};
    const totalEl = document.getElementById('set-total-draws');
    const redEl = document.getElementById('set-red-pity');
    const purpleEl = document.getElementById('set-purple-pity');
    const wishEl = document.getElementById('set-wish-count');
    if (totalEl) totalEl.value = st.totalDraws;
    if (redEl) redEl.value = st.redPityCounter;
    if (purpleEl) purpleEl.value = st.purplePityCounter;
    if (wishEl) wishEl.value = st.wishCount;
    // 特殊保底状态
    const specSelect = document.getElementById('set-special-status');
    if (specSelect && pity.special) specSelect.value = st.specialPityUsed ? 'used' : 'active';
    // 极品保底
    const goldPityEl = document.getElementById('set-gold-pity');
    const goldTriggersEl = document.getElementById('set-gold-triggers');
    if (goldPityEl && pity.extraGoldPity) goldPityEl.value = st.goldPityCounter;
    if (goldTriggersEl && pity.extraGoldPity) goldTriggersEl.value = st.goldPityTriggers;
    // 常驻红保底
    const permRedPityEl = document.getElementById('set-perm-red-pity');
    const permRedTriggersEl = document.getElementById('set-perm-red-triggers');
    if (permRedPityEl && pity.permRedPity) permRedPityEl.value = st.permRedPityCounter;
    if (permRedTriggersEl && pity.permRedPity) permRedTriggersEl.value = st.permRedPityTriggers;
}
function updateBoxProb(quality, percentValue) {
    const box = getBoxData(_currentBoxId);
    if (!box || !box.probabilities || isNaN(percentValue) || percentValue < 0 || percentValue > 100) return;
    box.probabilities[quality] = percentValue / 100;
}
function resetBoxState() {
    if (!confirm('确定要重置当前宝箱的所有数据吗？（包括开启次数、保底计数、拥有物品、心愿等）')) return;
    if (window.CURRENT_CONFIG.boxStates) {
        window.CURRENT_CONFIG.boxStates[_currentBoxId] = {
            totalDraws: 0, redPityCounter: 0, purplePityCounter: 0,
            specialPityActive: true, specialPityUsed: false,
            goldPityCounter: 0, goldPityTriggers: 0,
            permRedPityCounter: 0, permRedPityTriggers: 0,
            ownedItems: [], wishItem: null, wishCount: 0, history: []
        };
    }
    saveConfig();
    closeBoxSettings();
    renderStatsPanel();
    renderBoxList();
    showToast('宝箱数据已重置', 'success');
}

// ==================== 流光逐影功能 ====================

/** 预加载 god.webp */
function _ensureGodImage() {
    if (!_godImage) {
        _godImage = new Image();
        _godImage.src = 'assets/box/god.webp';
    }
    return _godImage;
}

/** 预缓存物品图片，避免动画中逐帧加载 */
function _preCacheLGImages(items) {
    _lgImageCache = {};
    items.forEach(item => {
        if (!_lgImageCache[item.image]) {
            const img = new Image();
            img.src = item.image;
            _lgImageCache[item.image] = img;
        }
    });
}

/** 在 Canvas 上绘制物品图片（带回退） */
function _drawLGItemImage(ctx, item, x, y, w, h) {
    const img = _lgImageCache[item.image];
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        const cfg = qCfg(item.quality || 'blue');
        ctx.fillStyle = cfg.orbColor;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.label, x + w / 2, y + h / 2);
    }
}

/** 初始化流光逐影 Canvas — 启动慢速空闲滚动预览所有物品 */
function _initLiuguangCanvas() {
    const canvas = document.getElementById('lootbox-liuguang-canvas');
    const wrap = document.getElementById('lootbox-liuguang-canvas-wrap');
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
        requestAnimationFrame(() => _initLiuguangCanvas());
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    // 取消旧空闲动画
    if (_lgIdleFrameId) { cancelAnimationFrame(_lgIdleFrameId); _lgIdleFrameId = null; }

    // 构建物品池
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const allItems = [...box.items];
    const pool = [];
    for (let r = 0; r < 4; r++) pool.push(...shuffleArray([...allItems]));
    const POOL_SIZE = pool.length;
    const ITEM_W = 100, ITEM_GAP = 6, ITEM_STEP = ITEM_W + ITEM_GAP;

    let idleOffset = 0;
    const IDLE_SPEED = 1.8; // px/frame — 慢速预览

    function idleFrame() {
        idleOffset += IDLE_SPEED;

        ctx.clearRect(0, 0, W, H);
        const bgGrad = ctx.createLinearGradient(0, H / 2 - 90, 0, H / 2 + 90);
        bgGrad.addColorStop(0, 'rgba(8,6,0,1)');
        bgGrad.addColorStop(0.5, 'rgba(18,12,0,0.95)');
        bgGrad.addColorStop(1, 'rgba(8,6,0,1)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        const startI = Math.floor(idleOffset / ITEM_STEP) - 3;
        const endI = Math.ceil((idleOffset + W) / ITEM_STEP) + 3;

        for (let i = startI; i <= endI; i++) {
            const poolIdx = ((i % POOL_SIZE) + POOL_SIZE) % POOL_SIZE;
            const x = i * ITEM_STEP - idleOffset + ITEM_GAP / 2;
            const y = (H - ITEM_W) / 2;
            if (x + ITEM_W < -60 || x > W + 60) continue;

            const item = pool[poolIdx];
            const isRed = item.quality === 'red';
            const cfg = qCfg(item.quality || 'blue');

            ctx.fillStyle = '#1a1a1a';
            ctx.strokeStyle = isRed ? '#ff4444' : cfg.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(x, y, ITEM_W, ITEM_W, 6);
            ctx.fill();
            ctx.stroke();

            const imgPad = 6;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x + imgPad, y + imgPad, ITEM_W - imgPad * 2, ITEM_W - imgPad * 2, 3);
            ctx.clip();
            if (isRed) {
                const godImg = _ensureGodImage();
                if (godImg.complete && godImg.naturalWidth > 0) {
                    ctx.drawImage(godImg, x + imgPad, y + imgPad, ITEM_W - imgPad * 2, ITEM_W - imgPad * 2);
                } else {
                    _drawLGItemImage(ctx, item, x + imgPad, y + imgPad, ITEM_W - imgPad * 2, ITEM_W - imgPad * 2);
                }
            } else {
                _drawLGItemImage(ctx, item, x + imgPad, y + imgPad, ITEM_W - imgPad * 2, ITEM_W - imgPad * 2);
            }
            ctx.restore();
        }

        // 中心指针叠层
        const cg = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
        cg.addColorStop(0, 'rgba(255,210,80,0)');
        cg.addColorStop(0.5, 'rgba(255,210,80,0.12)');
        cg.addColorStop(1, 'rgba(255,210,80,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(W / 2 - 70, 0, 140, H);

        _lgIdleFrameId = requestAnimationFrame(idleFrame);
    }

    _lgIdleFrameId = requestAnimationFrame(idleFrame);
}

/** 打开流光逐影弹窗 */
function openLiuguangModal() {
    const box = getBoxData(_currentBoxId);
    if (!box) { showToast('请先选择一个宝箱', 'warning'); return; }
    const modal = document.getElementById('lootbox-liuguang-modal');
    if (!modal) return;
    modal.classList.add('active');
    _ensureGodImage();
    _preCacheLGImages(box.items);  // 预加载图片，避免首帧显示文字
    requestAnimationFrame(() => {
        requestAnimationFrame(() => _initLiuguangCanvas());
    });
}

/** 关闭流光逐影弹窗 */
function closeLiuguangModal(e) {
    if (e && e.target !== e.currentTarget) return;
    if (_lgDrawing) return;
    if (_lgAnimFrameId) { cancelAnimationFrame(_lgAnimFrameId); _lgAnimFrameId = null; }
    if (_lgIdleFrameId) { cancelAnimationFrame(_lgIdleFrameId); _lgIdleFrameId = null; }
    const modal = document.getElementById('lootbox-liuguang-modal');
    if (modal) modal.classList.remove('active');
    try {
        if (window.LootboxSoundModule) {
            window.LootboxSoundModule.stopBallRoll();
            window.LootboxSoundModule.stopBoxShake();
        }
    } catch (_) {}
}

/** 流光逐影抽奖入口 */
function performLiuguangDraw() {
    if (_lgDrawing) return;
    const box = getBoxData(_currentBoxId);
    if (!box) return;
    const st = getBoxState(_currentBoxId);
    _lgDrawing = true;

    // 停止空闲预览
    if (_lgIdleFrameId) { cancelAnimationFrame(_lgIdleFrameId); _lgIdleFrameId = null; }

    const btn = document.getElementById('lootbox-liuguang-draw-btn');
    if (btn) btn.disabled = true;

    const result = performDrawLogic(box, st);
    st.history.push({
        itemName: result.item.name,
        quality: result.quality,
        time: getFormattedTime(),
        drawType: '流光逐影'
    });
    if (st.history.length > 200) st.history = st.history.slice(-200);
    saveConfigDebounced(300);

    const newItems = [result.item.name];
    _preCacheLGImages(box.items);

    try { if (window.LootboxSoundModule) window.LootboxSoundModule.startBallRoll(); } catch (_) {}

    runLiuguangAnimation(box, result, () => {
        try {
            if (window.LootboxSoundModule) window.LootboxSoundModule.stopBallRoll();
        } catch (_) {}
        const modal = document.getElementById('lootbox-liuguang-modal');
        if (modal) modal.classList.remove('active');
        requestAnimationFrame(() => {
            showResults(box, [result], () => {
                newItems.forEach(name => {
                    if (!st.ownedItems.includes(name)) st.ownedItems.push(name);
                });
                saveConfigDebounced(300);
                renderStatsPanel();
                renderBoxList();
                if (btn) btn.disabled = false;
                _lgDrawing = false;
            });
        });
    });
}

/** 流光逐影横向滚动动画 — 新春系列同款速度曲线 + 音效 */
function runLiuguangAnimation(box, result, callback) {
    const canvas = document.getElementById('lootbox-liuguang-canvas');
    const wrap = document.getElementById('lootbox-liuguang-canvas-wrap');
    if (!canvas || !wrap) { callback(); return; }

    const rect = wrap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) { callback(); return; }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const ITEM_W = 100, ITEM_GAP = 6, ITEM_STEP = ITEM_W + ITEM_GAP;

    // 构建物品池
    const allItems = [...box.items];
    let itemPool = [];
    for (let r = 0; r < 6; r++) itemPool.push(...shuffleArray([...allItems]));
    const POOL_SIZE = itemPool.length;

    // 结果物品放入 ~55% 位置
    const resultPoolIdx = Math.floor(POOL_SIZE * 0.55);
    itemPool[resultPoolIdx] = { ...result.item, _isResult: true };

    // 目标滚动量（随机定格偏移）
    const totalLoops = 7;
    const resultCenter = resultPoolIdx * ITEM_STEP + ITEM_W / 2;
    const targetCenter = W / 2;
    const randomOff = (Math.random() - 0.5) * ITEM_W * 0.8;
    const baseTarget = resultCenter - targetCenter + randomOff;
    const finalTarget = baseTarget + POOL_SIZE * ITEM_STEP * totalLoops;

    // ── 新春系列同款速度曲线 ──
    const fastDuration = 800;
    const fastSpeed = 38 + Math.random() * 10;
    const decelDuration = 3800;
    const flashDuration = 600;

    let scrollOffset = 0;
    let phase = 'fast';   // fast → decel → stop → flash → done
    let decelStartOffset = 0;
    let decelStartTime = 0;
    let stopTime = 0;
    let flashStartTime = 0;
    const animStartTime = performance.now();
    let lastTimestamp = animStartTime;

    // 计算减速距离：当前 offset 到目标的剩余距离 + 3 圈
    function calcDecelRemaining(currentOffset) {
        const mod = ((currentOffset % (POOL_SIZE * ITEM_STEP)) + POOL_SIZE * ITEM_STEP) % (POOL_SIZE * ITEM_STEP);
        const targetMod = finalTarget % (POOL_SIZE * ITEM_STEP);
        let rem = targetMod - mod;
        if (rem < 0) rem += POOL_SIZE * ITEM_STEP;
        return rem + POOL_SIZE * ITEM_STEP * 3;
    }

    let decelRemaining = 0;
    let _revealPlayed = false;

    function frame(timestamp) {
        const elapsed = timestamp - animStartTime;
        const dt = Math.min(timestamp - lastTimestamp, 33);
        lastTimestamp = timestamp;

        // ── 物理 ──
        if (phase === 'fast') {
            scrollOffset += fastSpeed * (dt / 16.667);
            if (elapsed >= fastDuration) {
                phase = 'decel';
                decelStartOffset = scrollOffset;
                decelStartTime = elapsed;
                decelRemaining = calcDecelRemaining(scrollOffset);
            }
        } else if (phase === 'decel') {
            const p = Math.min(1, (elapsed - decelStartTime) / decelDuration);
            const eased = 1 - Math.pow(1 - p, 6); // 六次方缓出（新春同款）
            scrollOffset = decelStartOffset + decelRemaining * eased;
            if (p >= 1) {
                phase = 'stop';
                scrollOffset = finalTarget;
                stopTime = elapsed;
            }
        } else if (phase === 'stop') {
            if (elapsed - stopTime > 250) {
                phase = 'flash';
                flashStartTime = elapsed;
            }
        } else if (phase === 'flash') {
            if (!_revealPlayed && elapsed - flashStartTime > flashDuration - 300) {
                _revealPlayed = true;
                try { if (window.LootboxSoundModule) window.LootboxSoundModule.playReveal(result.quality); } catch (_) {}
            }
            if (elapsed - flashStartTime > flashDuration) {
                phase = 'done';
            }
        }

        // 🔊 更新滚动音效速度
        if (phase !== 'done' && window.LootboxSoundModule) {
            let spd = 1;
            if (phase === 'decel') spd = 1 - Math.min(1, (elapsed - decelStartTime) / decelDuration);
            else if (phase === 'stop' || phase === 'flash') spd = 0;
            try { window.LootboxSoundModule.updateBallRollSpeed(spd); } catch (_) {}
        }

        // ── 渲染 ──
        ctx.clearRect(0, 0, W, H);
        const bgGrad = ctx.createLinearGradient(0, H / 2 - 90, 0, H / 2 + 90);
        bgGrad.addColorStop(0, 'rgba(8,6,0,1)');
        bgGrad.addColorStop(0.5, 'rgba(18,12,0,0.95)');
        bgGrad.addColorStop(1, 'rgba(8,6,0,1)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        const startIdx = Math.floor(scrollOffset / ITEM_STEP) - 3;
        const endIdx = Math.ceil((scrollOffset + W) / ITEM_STEP) + 3;

        for (let i = startIdx; i <= endIdx; i++) {
            const poolIdx = ((i % POOL_SIZE) + POOL_SIZE) % POOL_SIZE;
            const x = i * ITEM_STEP - scrollOffset + ITEM_GAP / 2;
            const y = (H - ITEM_W) / 2;
            if (x + ITEM_W < -60 || x > W + 60) continue;

            const item = itemPool[poolIdx];
            const isResult = item._isResult;
            const isRed = item.quality === 'red';
            const cfg = qCfg(item.quality || 'blue');

            ctx.save();
            if (phase === 'flash' && isResult) {
                const fp = (elapsed - flashStartTime) / flashDuration;
                const fa = 0.5 + Math.sin(fp * Math.PI * 6) * 0.5;
                ctx.shadowColor = 'rgba(255,210,80,' + fa + ')';
                ctx.shadowBlur = 22 + fa * 20;
            }
            if (isRed) {
                const gl = 0.35 + Math.sin(elapsed * 0.004 + i) * 0.2;
                ctx.shadowColor = 'rgba(255,68,68,' + gl + ')';
                ctx.shadowBlur = Math.max(ctx.shadowBlur || 0, 16);
            }
            ctx.fillStyle = '#1a1a1a';
            ctx.strokeStyle = isRed ? '#ff4444' : cfg.color;
            ctx.lineWidth = isResult ? 2.5 : 1.5;
            ctx.beginPath();
            ctx.roundRect(x, y, ITEM_W, ITEM_W, 6);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            const p = 6;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x + p, y + p, ITEM_W - p * 2, ITEM_W - p * 2, 3);
            ctx.clip();
            if (isRed) {
                // 红品统一用 god.webp
                const godImg = _ensureGodImage();
                if (godImg.complete && godImg.naturalWidth > 0) {
                    ctx.drawImage(godImg, x + p, y + p, ITEM_W - p * 2, ITEM_W - p * 2);
                } else {
                    _drawLGItemImage(ctx, item, x + p, y + p, ITEM_W - p * 2, ITEM_W - p * 2);
                }
            } else {
                _drawLGItemImage(ctx, item, x + p, y + p, ITEM_W - p * 2, ITEM_W - p * 2);
            }
            ctx.restore();
        }

        if (phase !== 'done') {
            const oa = phase === 'flash' ? 0.55 : 0.12;
            const cg = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
            cg.addColorStop(0, 'rgba(255,210,80,0)');
            cg.addColorStop(0.5, 'rgba(255,210,80,' + oa + ')');
            cg.addColorStop(1, 'rgba(255,210,80,0)');
            ctx.fillStyle = cg;
            ctx.fillRect(W / 2 - 70, 0, 140, H);
        }

        if (phase === 'done') {
            _lgAnimFrameId = null;
            callback();
            return;
        }
        _lgAnimFrameId = requestAnimationFrame(frame);
    }
    _lgAnimFrameId = requestAnimationFrame(frame);
}

function cleanupCanvas() {
    if (_animFrameId) { cancelAnimationFrame(_animFrameId); _animFrameId = null; }
    if (_lgAnimFrameId) { cancelAnimationFrame(_lgAnimFrameId); _lgAnimFrameId = null; }
    if (_lgIdleFrameId) { cancelAnimationFrame(_lgIdleFrameId); _lgIdleFrameId = null; }
    _isDrawing = false;
    _lgDrawing = false;
    setButtonsEnabled(true);
    const lgBtn = document.getElementById('lootbox-liuguang-draw-btn');
    if (lgBtn) lgBtn.disabled = false;
    // 🔊 清理音效
    if (window.LootboxSoundModule) {
        window.LootboxSoundModule.stopBoxShake();
        window.LootboxSoundModule.stopBallRoll();
    }
}

// ==================== 模块挂载 ====================
window.LootboxModule = {
    initLootboxDashboard, selectBox, renderBoxList, filterBoxList,
    performSingleDraw, performMultiDraw, startXinchunDraw,
    openLiuguangModal, closeLiuguangModal, performLiuguangDraw,
    openBoxSettings, closeBoxSettings, toggleItemOwned,
    setWishItem, updateBoxStat, updateBoxProb, resetBoxState,
    renderStatsPanel, cleanupCanvas,
    openWishModal, closeWishModal,
    deleteHistoryEntry, clearHistory,
};
