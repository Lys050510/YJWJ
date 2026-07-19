// ==================== 模块二：武器抽取逻辑 ====================
import { state } from '../core/state.js';
import { escapeHTML, escapeJS } from '../core/utils.js';
import { saveConfig } from '../core/storage.js';

// 同步页面配置状态到 UI
export function syncWeaponUIControls() {
    document.getElementById('wp-melee-toggle').checked = window.CURRENT_CONFIG.weaponDrawSettings.includeMelee;
    document.getElementById('wp-ranged-toggle').checked = window.CURRENT_CONFIG.weaponDrawSettings.includeRanged;
    document.getElementById('wp-quality-toggle').checked = window.CURRENT_CONFIG.weaponDrawSettings.randomizeQuality;
    document.getElementById('wp-duplicate-toggle').checked = window.CURRENT_CONFIG.weaponDrawSettings.allowDuplicate;

    const eachOneActive = window.CURRENT_CONFIG.weaponDrawSettings.eachOnePreset || false;
    document.getElementById('wp-each-one-toggle').checked = eachOneActive;

    const selectEl = document.getElementById('wp-count-select');
    selectEl.value = window.CURRENT_CONFIG.weaponDrawSettings.drawCount;
    selectEl.disabled = eachOneActive;
}

// 快速更新武器抽取设置
export function updateWeaponToggle(key, val) {
    window.CURRENT_CONFIG.weaponDrawSettings[key] = val;
    saveConfig();
}

// 开启/关闭近战远程各一键抽取
export function toggleEachOnePreset(checked) {
    window.CURRENT_CONFIG.weaponDrawSettings.eachOnePreset = checked;
    document.getElementById('wp-count-select').disabled = checked;
    saveConfig();
}

// 武器抽取执行器
export function startWeaponDraw() {
    if (state.isWeaponScrolling) return;

    const settings = window.CURRENT_CONFIG.weaponDrawSettings;
    let pool = window.CURRENT_CONFIG.weapons.filter(wp => window.CURRENT_CONFIG.activeWeaponNames.includes(wp.name));
    let winners = [];

    // 1. 近战远程各抽一
    if (settings.eachOnePreset) {
        let meleePool = pool.filter(wp => wp.type === 'melee');
        let rangedPool = pool.filter(wp => wp.type === 'ranged');

        if (meleePool.length === 0 || rangedPool.length === 0) {
            alert("你勾选的武器库中没有近战或远程武器，请前往设置中勾选可用名单！");
            return;
        }

        const meleeWinner = meleePool[Math.floor(Math.random() * meleePool.length)];
        const rangedWinner = rangedPool[Math.floor(Math.random() * rangedPool.length)];
        winners = [meleeWinner, rangedWinner];
    }
    // 2. 普通抽取模式
    else {
        if (!settings.includeMelee) {
            pool = pool.filter(wp => wp.type !== 'melee');
        }
        if (!settings.includeRanged) {
            pool = pool.filter(wp => wp.type !== 'ranged');
        }

        if (pool.length === 0) {
            alert("请至少勾选『近战武器』或『远程武器』其中一种类型！");
            return;
        }

        const drawCount = settings.drawCount;

        if (!settings.allowDuplicate && pool.length < drawCount) {
            alert(`⚠️ 武器数量不够啦！\n\n当前符合筛选条件的武器库一共有【${pool.length}】把。\n你想要抽取的数量是【${drawCount}】把。\n由于你关闭了"重复抽取"，系统无法变出足够的武器！\n\n💡 解决办法：请开启"允许重复抽取"复选框，或点击名单设置勾选更多武器！`);
            return;
        }

        if (settings.allowDuplicate) {
            for (let i = 0; i < drawCount; i++) {
                let randIdx = Math.floor(Math.random() * pool.length);
                winners.push({ ...pool[randIdx] });
            }
        } else {
            let tempPool = [...pool];
            for (let i = 0; i < drawCount; i++) {
                let randIdx = Math.floor(Math.random() * tempPool.length);
                winners.push(tempPool.splice(randIdx, 1)[0]);
            }
        }
    }

    const qualities = [
        { name: "金", class: "quality-gold" },
        { name: "紫", class: "quality-purple" },
        { name: "蓝", class: "quality-blue" },
        { name: "白", class: "quality-white" }
    ];

    winners = winners.map(wp => {
        if (settings.randomizeQuality) {
            const randomQ = qualities[Math.floor(Math.random() * qualities.length)];
            return { ...wp, quality: randomQ.name, qClass: randomQ.class };
        } else {
            return { ...wp, quality: "", qClass: "" };
        }
    });

    const container = document.getElementById('weapons-display-container');
    container.innerHTML = '';

    const finalCount = winners.length;

    winners.forEach((_, index) => {
        const scrollBox = document.createElement('div');
        scrollBox.className = 'scroll-box weapon-scroll-box';
        scrollBox.id = `weapon-box-${index}`;
        scrollBox.innerHTML = `
            <div class="scroll-slot" id="weapon-slot-${index}">
                <div class="placeholder-card">
                    <div class="slot-img-placeholder">⚔️</div>
                    <div class="slot-name">等待揭晓</div>
                </div>
            </div>
        `;
        container.appendChild(scrollBox);
    });

    state.isWeaponScrolling = true;
    document.getElementById('weapon-start-btn').disabled = true;
    document.getElementById('weapon-start-btn').innerText = "抽取中...";

    let completed = 0;
    winners.forEach((winner, index) => {
        const duration = 1500 + index * 500;
        runWeaponScrollAnimation(`weapon-slot-${index}`, `weapon-box-${index}`, pool, winner, duration, () => {
            completed++;
            if (completed === finalCount) {
                state.isWeaponScrolling = false;
                document.getElementById('weapon-start-btn').disabled = false;
                document.getElementById('weapon-start-btn').innerText = "开始抽取";
            }
        });
    });
}

// 武器专属滚动渲染
export function runWeaponScrollAnimation(slotId, boxId, pool, targetWp, duration, callback) {
    const slotEl = document.getElementById(slotId);
    const boxEl = document.getElementById(boxId);
    let startTime = Date.now();
    let interval = 40;

    function tick() {
        let elapsed = Date.now() - startTime;

        if (elapsed < duration) {
            const randomItem = pool[Math.floor(Math.random() * pool.length)];
            slotEl.innerHTML = renderWeaponCardHTML(randomItem);
            interval = 40 + (elapsed / duration) * 150;
            setTimeout(tick, interval);
        } else {
            if (targetWp.qClass) {
                boxEl.className = `scroll-box weapon-scroll-box ${targetWp.qClass}`;
            }
            slotEl.innerHTML = renderWeaponCardHTML(targetWp);
            if (callback) callback();
        }
    }
    tick();
}

// 武器卡片渲染 HTML 模板
export function renderWeaponCardHTML(wp) {
    const name = wp.name;
    const imgUrl = wp.image;
    const quality = wp.quality || '';

    return `
        <div class="scroll-item">
            <img class="weapon-img" src="${escapeHTML(imgUrl)}" onerror="this.style.display='none';var fb=this.parentElement.querySelector('.weapon-avatar-fallback');if(fb)fb.style.display='flex';">
            <div class="weapon-avatar-fallback" style="display:none;">
                ${escapeHTML(name)}
            </div>
            <div class="slot-name">${escapeHTML(name)}</div>
            ${quality ? `<div class="slot-subtext">【${escapeHTML(quality)}品】</div>` : ''}
        </div>
    `;
}

// ==================== 模块二 (副)：武器弹窗管理 ====================

export function openWeaponSettings() {
    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');
    document.getElementById('weapon-settings-modal').classList.add('active');
}

export function closeWeaponSettings() {
    document.getElementById('weapon-settings-modal').classList.remove('active');
    saveConfig();
    // 强制同步转盘
    window.WheelModule.syncPresetWheels();
}

// 展开/收起添加新武器表单
export function toggleAddWeaponForm(show) {
    const form = document.getElementById('add-weapon-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

// 提交添加自定义新武器
export function submitNewWeapon() {
    const nameInput = document.getElementById('new-wp-name');
    const imageInput = document.getElementById('new-wp-image');
    const typeInput = document.getElementById('new-wp-type');

    const name = nameInput.value.trim();
    let imgFile = imageInput.value.trim();
    const type = typeInput.value;

    if (!name) {
        alert("请输入武器名称！");
        return;
    }

    if (!imgFile) {
        imgFile = "default.webp";
    }

    if (window.CURRENT_CONFIG.weapons.some(wp => wp.name === name)) {
        alert("该武器名已存在，请勿重复添加！");
        return;
    }

    const newWeapon = {
        name: name,
        type: type,
        image: imgFile.startsWith("http") || imgFile.startsWith("assets/") ? imgFile : "assets/weapons/" + imgFile
    };

    window.CURRENT_CONFIG.weapons.push(newWeapon);
    window.CURRENT_CONFIG.activeWeaponNames.push(name);
    saveConfig();

    nameInput.value = '';
    imageInput.value = '';

    toggleAddWeaponForm(false);
    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');

    alert(`武器【${name}】已成功加入武器库！`);
}

// 彻底删除某个武器
export function deleteWeaponFromDB(wpName) {
    if (!confirm(`确定要将武器【${wpName}】彻底从数据库中删除吗？（不可逆）`)) {
        return;
    }

    window.CURRENT_CONFIG.weapons = window.CURRENT_CONFIG.weapons.filter(wp => wp.name !== wpName);
    window.CURRENT_CONFIG.activeWeaponNames = window.CURRENT_CONFIG.activeWeaponNames.filter(n => n !== wpName);
    saveConfig();

    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');
}

// 渲染武器管理列表
export function initWeaponSettingsGrid(type, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const list = window.CURRENT_CONFIG.weapons.filter(wp => wp.type === type);
    list.forEach(wp => {
        const isChecked = window.CURRENT_CONFIG.activeWeaponNames.includes(wp.name);

        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item';
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${escapeHTML(wp.name)}" ${isChecked ? 'checked' : ''} onchange="onWeaponCheckboxChange(this)">
                <span>${escapeHTML(wp.name)}</span>
            </label>
            <button class="hero-delete-btn" title="彻底删除此武器" onclick="deleteWeaponFromDB('${escapeJS(wp.name)}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

export function onWeaponCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!window.CURRENT_CONFIG.activeWeaponNames.includes(name)) {
            window.CURRENT_CONFIG.activeWeaponNames.push(name);
        }
    } else {
        window.CURRENT_CONFIG.activeWeaponNames = window.CURRENT_CONFIG.activeWeaponNames.filter(n => n !== name);
    }
}

export function toggleAllWeapons(selectAll, type) {
    const containerId = type === 'melee' ? 'melee-checkbox-container' : 'ranged-checkbox-container';
    const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onWeaponCheckboxChange(cb);
    });
}

// ==================== 挂载到全局 window ====================
// 为兼容 HTML 内联 onclick 属性，将函数暴露到全局作用域
window.syncWeaponUIControls = syncWeaponUIControls;
window.updateWeaponToggle = updateWeaponToggle;
window.toggleEachOnePreset = toggleEachOnePreset;
window.startWeaponDraw = startWeaponDraw;
window.runWeaponScrollAnimation = runWeaponScrollAnimation;
window.renderWeaponCardHTML = renderWeaponCardHTML;
window.openWeaponSettings = openWeaponSettings;
window.closeWeaponSettings = closeWeaponSettings;
window.toggleAddWeaponForm = toggleAddWeaponForm;
window.submitNewWeapon = submitNewWeapon;
window.deleteWeaponFromDB = deleteWeaponFromDB;
window.initWeaponSettingsGrid = initWeaponSettingsGrid;
window.onWeaponCheckboxChange = onWeaponCheckboxChange;
window.toggleAllWeapons = toggleAllWeapons;

window.WeaponModule = {
    syncWeaponUIControls,
    updateWeaponToggle,
    toggleEachOnePreset,
    startWeaponDraw,
    runWeaponScrollAnimation,
    renderWeaponCardHTML,
    openWeaponSettings,
    closeWeaponSettings,
    toggleAddWeaponForm,
    submitNewWeapon,
    deleteWeaponFromDB,
    initWeaponSettingsGrid,
    onWeaponCheckboxChange,
    toggleAllWeapons
};
