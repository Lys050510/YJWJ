// ==================== 模块五：奖品抽取（顺序变速跑马灯） ====================

import * as state from '../core/state.js';
import { saveConfig } from '../core/storage.js';
import { getFormattedTime, getWeightedRandomIndex } from '../core/utils.js';
import { getEl } from '../core/dom.js';

function getWeightedPrizeIndex(prizes) {
    const totalWeight = prizes.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < prizes.length; i++) {
        rand -= parseFloat(prizes[i].weight || 0);
        if (rand <= 0) return i;
    }
    return prizes.length - 1;
}

function sortPrizes() {
    if (!window.CURRENT_CONFIG.prizes) return;

    const TIER_ORDER = {
        "特等奖": 1, "一等奖": 2, "二等奖": 3, "三等奖": 4, "四等奖": 5, "五等奖": 6, "六等奖": 7, "安慰奖": 50, "纪念奖": 51
    };

    window.CURRENT_CONFIG.prizes.sort((a, b) => {
        const orderA = TIER_ORDER[a.tier] || 99;
        const orderB = TIER_ORDER[b.tier] || 99;
        return orderA - orderB;
    });

    saveConfig();
}

function renderPrizesDisplay() {
    sortPrizes();

    const container = document.getElementById('prizes-display-container');
    container.innerHTML = '';

    const list = window.CURRENT_CONFIG.prizes || [];
    if (list.length === 0) {
        container.innerHTML = `<div style="color: #888; font-size: 18px; margin: 20px 0;">奖池为空，请点击右上角「⚙️ 奖品管理」添加奖项！</div>`;
        return;
    }

    list.forEach((prize, index) => {
        const card = document.createElement('div');
        card.className = 'prize-card';
        card.id = `prize-card-element-${index}`;
        card.innerHTML = `
            <div class="prize-card-tier">${prize.tier}</div>
            <div class="prize-card-name">${prize.name}</div>
        `;
        container.appendChild(card);
    });
}

function startPrizeDraw() {
    if (state.isPrizeDrawing) return;

    const list = window.CURRENT_CONFIG.prizes || [];
    if (list.length === 0) {
        alert("奖池内没有任何奖品，请先去配置添加！");
        return;
    }

    state.isPrizeDrawing = true;
    document.getElementById('prize-start-btn').disabled = true;
    document.getElementById('prize-start-btn').innerText = "正在抽奖中...";

    list.forEach((_, idx) => {
        const el = document.getElementById(`prize-card-element-${idx}`);
        if (el) {
            el.classList.remove('active-prize', 'winner-prize');
        }
    });

    const winIndex = getWeightedPrizeIndex(list);
    const winnerPrize = list[winIndex];

    const totalItems = list.length;
    const totalLoops = 4;
    const totalSteps = (totalLoops * totalItems) + winIndex;

    let currentStep = 0;
    const minDelay = 45;
    const maxDelay = 600;

    function runStep() {
        // 跳过第一步的「移除上一项高亮」（因为还没有高亮过任何项）
        if (currentStep > 0) {
            const prevIdx = (currentStep - 1) % totalItems;
            const prevEl = document.getElementById(`prize-card-element-${prevIdx}`);
            if (prevEl) prevEl.classList.remove('active-prize');
        }

        const currIdx = currentStep % totalItems;
        const currEl = document.getElementById(`prize-card-element-${currIdx}`);
        if (currEl) currEl.classList.add('active-prize');

        currentStep++;

        if (currentStep <= totalSteps) {
            const progress = currentStep / totalSteps;
            const currentDelay = minDelay + Math.pow(progress, 2.5) * (maxDelay - minDelay);

            setTimeout(runStep, currentDelay);
        } else {
            // 中奖定格
            setTimeout(() => {
                const winEl = document.getElementById(`prize-card-element-${winIndex}`);
                if (winEl) {
                    winEl.classList.remove('active-prize');
                    winEl.classList.add('winner-prize');
                }

                const drawerName = document.getElementById('prize-drawer-name').value.trim();
                alert(`🎉 恭喜获得：【${winnerPrize.tier} · ${winnerPrize.name}】！`);

                if (drawerName) {
                    const newLog = {
                        time: getFormattedTime(),
                        name: drawerName,
                        prize: `${winnerPrize.tier} - ${winnerPrize.name}`
                    };
                    if (!window.CURRENT_CONFIG.prizeLogs) {
                        window.CURRENT_CONFIG.prizeLogs = [];
                    }
                    window.CURRENT_CONFIG.prizeLogs.unshift(newLog);
                    saveConfig();
                    renderPrizeLogs();
                }

                state.isPrizeDrawing = false;
                document.getElementById('prize-start-btn').disabled = false;
                document.getElementById('prize-start-btn').innerText = "开始抽奖";
            }, 300);
        }
    }

    runStep();
}

function renderPrizeLogs() {
    const listEl = document.getElementById('prize-logs-list');
    listEl.innerHTML = '';

    const logs = window.CURRENT_CONFIG.prizeLogs || [];
    if (logs.length === 0) {
        listEl.innerHTML = `<li style="color:#666;">暂无抽奖历史记录。填入姓名后再抽奖即可记录。</li>`;
        return;
    }

    logs.forEach(log => {
        const li = document.createElement('li');
        li.innerHTML = `[${log.time}] 选手 <strong>${log.name}</strong> 抽中了：<span style="color:#ffcc00; font-weight:bold;">${log.prize}</span>`;
        listEl.appendChild(li);
    });
}

function clearPrizeLogs() {
    if (!confirm("确定要清空所有的中奖历史记录吗？（物理删除不可逆）")) return;
    window.CURRENT_CONFIG.prizeLogs = [];
    saveConfig();
    renderPrizeLogs();
}


// ==================== 模块五 (副)：奖池管理 ====================

function openPrizeSettings() {
    sortPrizes();
    initPrizesManageList();
    document.getElementById('prize-settings-modal').classList.add('active');
}

function closePrizeSettings() {
    document.getElementById('prize-settings-modal').classList.remove('active');
    saveConfig();
    renderPrizesDisplay();
    // 强制同步转盘
    syncPresetWheels();
}

function toggleAddPrizeForm(show) {
    const form = document.getElementById('add-prize-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

function initPrizesManageList() {
    const listContainer = document.getElementById('prizes-manage-list');
    listContainer.innerHTML = '';

    const list = window.CURRENT_CONFIG.prizes || [];
    const totalWeight = list.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);

    list.forEach((prize, index) => {
        const weightVal = parseFloat(prize.weight || 0);
        const percentage = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(2) : "0.00";

        const row = document.createElement('div');
        row.className = 'option-item';
        row.style.gridTemplateColumns = '1fr 1.6fr 0.8fr 1fr 0.6fr';
        row.innerHTML = `
            <input type="text" value="${prize.tier}" oninput="PrizeModule.updatePrizeField(${index}, 'tier', this.value)" placeholder="等阶" style="width:100%;">
            <input type="text" value="${prize.name}" oninput="PrizeModule.updatePrizeField(${index}, 'name', this.value)" placeholder="名称" style="width:100%;">
            <input type="number" step="any" min="0.1" value="${prize.weight}" oninput="PrizeModule.updatePrizeField(${index}, 'weight', this.value)" placeholder="权重" style="width:100%;">
            <span style="color:#e3a94a; font-weight:bold; font-size:13px; text-align:center;">${percentage}%</span>
            <button class="delete-btn" onclick="PrizeModule.deletePrizeFromDB(${index})">🗑️</button>
        `;
        listContainer.appendChild(row);
    });
}

function submitNewPrize() {
    const tierInput = document.getElementById('new-prize-tier');
    const nameInput = document.getElementById('new-prize-name');
    const weightInput = document.getElementById('new-prize-weight');

    const tier = tierInput.value.trim();
    const name = nameInput.value.trim();
    const weightVal = parseFloat(weightInput.value);

    if (!tier || !name) {
        alert("请完整填写奖品名称与等级！");
        return;
    }
    if (isNaN(weightVal) || weightVal <= 0) {
        alert("权重值必须是大于 0 的有效数字！");
        return;
    }

    if (!window.CURRENT_CONFIG.prizes) {
        window.CURRENT_CONFIG.prizes = [];
    }

    window.CURRENT_CONFIG.prizes.push({
        tier: tier,
        name: name,
        weight: weightVal
    });

    sortPrizes();
    saveConfig();

    tierInput.value = '';
    nameInput.value = '';
    weightInput.value = '';

    toggleAddPrizeForm(false);
    initPrizesManageList();
}

function updatePrizeField(index, key, val) {
    if (!window.CURRENT_CONFIG.prizes[index]) return;

    if (key === 'weight') {
        const num = parseFloat(val);
        window.CURRENT_CONFIG.prizes[index][key] = isNaN(num) || num <= 0 ? 0.1 : num;
    } else {
        window.CURRENT_CONFIG.prizes[index][key] = val;
    }
    saveConfig();

    // 修改等阶后立即重新排序，保持展示顺序一致
    if (key === 'tier') {
        sortPrizes();
        initPrizesManageList();
        return;
    }

    const list = window.CURRENT_CONFIG.prizes || [];
    const totalWeight = list.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);
    const rows = document.getElementById('prizes-manage-list').children;
    if (rows[index]) {
        const weightVal = parseFloat(window.CURRENT_CONFIG.prizes[index].weight || 0);
        const percentage = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(2) : "0.00";
        const percentSpan = rows[index].children[3];
        if (percentSpan) {
            percentSpan.innerText = `${percentage}%`;
        }
    }
}

function deletePrizeFromDB(index) {
    if (window.CURRENT_CONFIG.prizes.length <= 1) {
        alert("奖池最少需要保留一个物理奖品以防框架报错！");
        return;
    }
    if (!confirm(`确定要彻底删除该奖项吗？`)) return;

    window.CURRENT_CONFIG.prizes.splice(index, 1);
    saveConfig();
    initPrizesManageList();
}

export {
    sortPrizes,
    renderPrizesDisplay,
    startPrizeDraw,
    renderPrizeLogs,
    clearPrizeLogs,
    openPrizeSettings,
    closePrizeSettings,
    toggleAddPrizeForm,
    initPrizesManageList,
    submitNewPrize,
    updatePrizeField,
    deletePrizeFromDB
};

window.PrizeModule = { sortPrizes, renderPrizesDisplay, startPrizeDraw, renderPrizeLogs, clearPrizeLogs, openPrizeSettings, closePrizeSettings, toggleAddPrizeForm, initPrizesManageList, submitNewPrize, updatePrizeField, deletePrizeFromDB };
