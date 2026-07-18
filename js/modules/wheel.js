// ==================== 模块六：通用大转盘 (Canvas - 重构版) ====================

import { isSpinning, canvas, ctx, currentRotation } from '../core/state.js';
import { hslToHex, escapeHTML } from '../core/utils.js';
import { saveConfig } from '../core/storage.js';

export function syncPresetWheels() {
    const generateColors = (count) => {
        let colors = [];
        for (let i = 0; i < count; i++) {
            const h = Math.floor((i * 360) / count);
            colors.push(hslToHex(h, 65, 45));
        }
        return colors;
    };

    // 1. 定义最新的 5 个系统预设
    const presetDefinitions = [
        {
            id: "preset_hero",
            name: "一、英雄转盘",
            getSourceItems: () => window.CURRENT_CONFIG.heroes.map(h => ({ name: h.name, weight: 1 }))
        },
        {
            id: "preset_melee",
            name: "二、近战武器转盘",
            getSourceItems: () => window.CURRENT_CONFIG.weapons.filter(w => w.type === 'melee').map(w => ({ name: w.name, weight: 1 }))
        },
        {
            id: "preset_ranged",
            name: "三、远程武器转盘",
            getSourceItems: () => window.CURRENT_CONFIG.weapons.filter(w => w.type === 'ranged').map(w => ({ name: w.name, weight: 1 }))
        },
        {
            id: "preset_player",
            name: "四、人员转盘",
            getSourceItems: () => window.CURRENT_CONFIG.players.map(p => ({ name: p.name, weight: 1 }))
        },
        {
            id: "preset_prize",
            name: "五、奖品转盘",
            getSourceItems: () => (window.CURRENT_CONFIG.prizes || []).map(p => ({ name: p.name, weight: p.weight || 1 }))
        }
    ];

    if (!window.CURRENT_CONFIG.wheelsList) {
        window.CURRENT_CONFIG.wheelsList = [];
    }

    const validPresetIds = ["preset_hero", "preset_melee", "preset_ranged", "preset_player", "preset_prize"];
    window.CURRENT_CONFIG.wheelsList = window.CURRENT_CONFIG.wheelsList.filter(w => {
        if (w.id.startsWith("preset_") && !validPresetIds.includes(w.id)) {
            return false;
        }
        return true;
    });

    presetDefinitions.forEach(def => {
        let existingWheel = window.CURRENT_CONFIG.wheelsList.find(w => w.id === def.id);
        const sourceItems = def.getSourceItems();
        const colors = generateColors(sourceItems.length);

        const newItems = sourceItems.map((src, idx) => {
            let cachedItem = existingWheel ? existingWheel.items.find(item => item.name === src.name) : null;
            return {
                name: src.name,
                weight: cachedItem ? cachedItem.weight : src.weight,
                color: cachedItem ? cachedItem.color : colors[idx],
                checked: cachedItem ? (cachedItem.checked !== undefined ? cachedItem.checked : true) : true
            };
        });

        if (existingWheel) {
            existingWheel.name = def.name;
            existingWheel.items = newItems;
        } else {
            window.CURRENT_CONFIG.wheelsList.push({
                id: def.id,
                name: def.name,
                isDuplicateAllowed: true,
                items: newItems
            });
        }
    });

    window.CURRENT_CONFIG.wheelsList.forEach(wheel => {
        wheel.items.forEach(item => {
            if (item.checked === undefined) {
                item.checked = true;
            }
        });
    });

    window.CURRENT_CONFIG.wheelsList.sort((a, b) => {
        const idxA = validPresetIds.indexOf(a.id);
        const idxB = validPresetIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    saveConfig();
}

export function initWheelSelector() {
    const select = document.getElementById('wheel-select');
    select.innerHTML = '';

    window.CURRENT_CONFIG.wheelsList.forEach((wheel, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = wheel.name;
        select.appendChild(opt);
    });

    loadSelectedWheel();
}

export function loadSelectedWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    document.getElementById('wheel-duplicate-toggle').checked = activeWheel.isDuplicateAllowed !== false;

    renderWheelConfigPanel(activeWheel);

    canvas = document.getElementById('wheel-canvas');
    ctx = canvas.getContext('2d');
    drawWheel(activeWheel);
}

export function drawWheel(wheel) {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activeItems = wheel.items.filter(item => item.checked !== false);

    if (activeItems.length === 0) {
        ctx.fillStyle = "#fff";
        ctx.font = "18px Microsoft YaHei";
        ctx.textAlign = "center";
        ctx.fillText("请在右侧选项列表中勾选参与抽奖的项！", canvas.width / 2, canvas.height / 2);
        return;
    }

    const totalWeight = activeItems.reduce((sum, item) => sum + parseFloat(item.weight || 0), 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;

    let startAngle = currentRotation;

    activeItems.forEach(item => {
        const weight = parseFloat(item.weight || 0);
        const sliceAngle = (weight / totalWeight) * (2 * Math.PI);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Microsoft YaHei";
        ctx.textAlign = "right";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4;

        // 按显示宽度智能截断：中文字符宽度≈英文2倍
        let displayName = item.name;
        let displayWidth = 0;
        const maxWidth = 12; // 约6个中文字或12个英文字母的宽度
        let cutIdx = displayName.length;
        for (let ci = 0; ci < displayName.length; ci++) {
            const charWidth = /[一-鿿㐀-䶿]/.test(displayName[ci]) ? 2 : 1;
            displayWidth += charWidth;
            if (displayWidth > maxWidth) {
                cutIdx = ci;
                break;
            }
        }
        if (displayWidth > maxWidth) {
            displayName = displayName.substring(0, cutIdx) + "..";
        }
        ctx.fillText(displayName, radius - 30, 5);
        ctx.restore();

        startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, 35, 0, 2 * Math.PI);
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#b3863b";
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
}

export function spinWheel() {
    if (isSpinning) return;

    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    const availableItems = activeWheel.items
        .map((item, index) => ({ item, originalIndex: index }))
        .filter(entry => entry.item.checked !== false);

    if (availableItems.length === 0) {
        alert("转盘内没有任何被勾选的项！请先勾选或点击全选重置！");
        return;
    }

    isSpinning = true;
    document.getElementById('wheel-spin-btn').disabled = true;
    document.getElementById('wheel-spin-btn').innerText = "旋转中...";

    const totalWeight = availableItems.reduce((sum, entry) => sum + parseFloat(entry.item.weight || 0), 0);
    let rand = Math.random() * totalWeight;
    let winnerEntry = null;
    let accumulatedWeight = 0;

    for (let entry of availableItems) {
        accumulatedWeight += parseFloat(entry.item.weight || 0);
        if (rand <= accumulatedWeight) {
            winnerEntry = entry;
            break;
        }
    }

    if (!winnerEntry) winnerEntry = availableItems[0];

    let winnerIndexInActive = availableItems.findIndex(entry => entry.originalIndex === winnerEntry.originalIndex);
    let sliceStartAngle = 0;

    for (let i = 0; i < winnerIndexInActive; i++) {
        sliceStartAngle += (parseFloat(availableItems[i].item.weight || 0) / totalWeight) * (2 * Math.PI);
    }
    let sliceEndAngle = sliceStartAngle + (parseFloat(winnerEntry.item.weight || 0) / totalWeight) * (2 * Math.PI);

    const sliceMidAngle = (sliceStartAngle + sliceEndAngle) / 2;
    const targetBaseRotation = (1.5 * Math.PI - sliceMidAngle);
    const extraSpins = (4 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
    const finalRotation = targetBaseRotation + extraSpins;

    let startTime = null;
    const duration = 5000;
    const startRot = currentRotation % (2 * Math.PI);

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / duration;

        if (progress > 1) progress = 1;

        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentRotation = startRot + easeOut * (finalRotation - startRot);

        drawWheel(activeWheel);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            setTimeout(() => {
                alert(`🎉 恭喜抽中：【${winnerEntry.item.name}】！`);

                if (activeWheel.isDuplicateAllowed === false) {
                    winnerEntry.item.checked = false;
                    saveConfig();
                    renderWheelConfigPanel(activeWheel);
                    drawWheel(activeWheel);
                }

                isSpinning = false;
                document.getElementById('wheel-spin-btn').disabled = false;
                document.getElementById('wheel-spin-btn').innerText = "旋转转盘";
            }, 300);
        }
    }

    requestAnimationFrame(animate);
}

export function renderWheelConfigPanel(wheel) {
    const listContainer = document.getElementById('wheel-options-list');
    listContainer.innerHTML = '';

    wheel.items.forEach((item, index) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'option-item';
        itemRow.style.gridTemplateColumns = '0.5fr 1.5fr 1fr 1fr 0.8fr';

        const isChecked = item.checked !== false;
        if (!isChecked) {
            itemRow.style.opacity = "0.4";
        }

        itemRow.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="WheelModule.toggleSingleWheelItem(${index}, this.checked)" style="width:20px; height:20px; cursor:pointer; justify-self: center;">
            <input type="text" value="${item.name}" oninput="WheelModule.updateWheelItem(${index}, 'name', this.value)">
            <input type="number" step="any" min="0.1" value="${item.weight}" oninput="WheelModule.updateWheelItem(${index}, 'weight', this.value)">
            <input type="color" value="${item.color}" onchange="WheelModule.updateWheelItem(${index}, 'color', this.value)">
            <button class="delete-btn" onclick="WheelModule.deleteWheelItem(${index})">🗑️</button>
        `;
        listContainer.appendChild(itemRow);
    });
}

export function toggleSingleWheelItem(index, isChecked) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.items[index].checked = isChecked;
    saveConfig();
    drawWheel(activeWheel);
    renderWheelConfigPanel(activeWheel);
}

export function updateWheelItem(itemIndex, key, val) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    if (key === 'weight') {
        const num = parseFloat(val);
        activeWheel.items[itemIndex][key] = isNaN(num) || num <= 0 ? 0.1 : num;
    } else {
        activeWheel.items[itemIndex][key] = val;
    }

    saveConfig();
    drawWheel(activeWheel);
}

export function toggleAllWheelItems(checked) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.items.forEach(item => {
        item.checked = checked;
    });

    saveConfig();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

export function shuffleWheelItems() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    for (let i = activeWheel.items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = activeWheel.items[i];
        activeWheel.items[i] = activeWheel.items[j];
        activeWheel.items[j] = temp;
    }

    saveConfig();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

export function toggleDuplicate() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.isDuplicateAllowed = document.getElementById('wheel-duplicate-toggle').checked;
    saveConfig();
}

export function addWheelItem() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    const randomHue = Math.floor(Math.random() * 360);
    const randColor = hslToHex(randomHue, 70, 50);

    const newItem = {
        name: `选项${activeWheel.items.length + 1}`,
        weight: 1,
        color: randColor,
        checked: true
    };

    activeWheel.items.push(newItem);
    saveConfig();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

export function deleteWheelItem(itemIndex) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    if (activeWheel.items.length <= 1) {
        alert("转盘中至少需要保留 1 个选项！");
        return;
    }

    activeWheel.items.splice(itemIndex, 1);
    saveConfig();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

export function createNewWheel() {
    const wheelName = prompt("请输入新转盘的名称：", "自定义转盘");
    if (!wheelName || !wheelName.trim()) return;

    const newWheel = {
        id: "custom_" + Date.now(),
        name: wheelName.trim(),
        isDuplicateAllowed: true,
        items: [
            { name: "选项 1", weight: 1, color: "#ff4d4d", checked: true },
            { name: "选项 2", weight: 1, color: "#ffaa00", checked: true },
            { name: "选项 3", weight: 1, color: "#4caf50", checked: true },
            { name: "选项 4", weight: 1, color: "#2196f3", checked: true }
        ]
    };

    if (!window.CURRENT_CONFIG.wheelsList) {
        window.CURRENT_CONFIG.wheelsList = [];
    }

    window.CURRENT_CONFIG.wheelsList.push(newWheel);
    saveConfig();

    initWheelSelector();

    const select = document.getElementById('wheel-select');
    select.value = window.CURRENT_CONFIG.wheelsList.length - 1;
    loadSelectedWheel();
}

export function renameCurrentWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    const newName = prompt(`请输入转盘【${activeWheel.name}】的新名称：`, activeWheel.name);
    if (!newName || !newName.trim()) return;

    activeWheel.name = newName.trim();
    saveConfig();

    initWheelSelector();
    select.value = wheelIndex;
    loadSelectedWheel();
}

export function deleteCurrentWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = window.CURRENT_CONFIG.wheelsList[wheelIndex];

    if (activeWheel.id.startsWith("preset_")) {
        alert("系统默认的系统预设大转盘无法直接删除哦！若有需要，可通过选项勾选来进行定制。");
        return;
    }

    if (!confirm(`确定要彻底删除该自定义转盘【${activeWheel.name}】吗？`)) {
        return;
    }

    window.CURRENT_CONFIG.wheelsList.splice(wheelIndex, 1);
    saveConfig();
    initWheelSelector();
}

// 挂载到 window 以便 HTML 内联事件处理器访问
window.WheelModule = {
    syncPresetWheels,
    initWheelSelector,
    loadSelectedWheel,
    drawWheel,
    spinWheel,
    renderWheelConfigPanel,
    toggleSingleWheelItem,
    updateWheelItem,
    toggleAllWheelItems,
    shuffleWheelItems,
    toggleDuplicate,
    addWheelItem,
    deleteWheelItem,
    createNewWheel,
    renameCurrentWheel,
    deleteCurrentWheel
};
