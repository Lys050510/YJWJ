// ==================== 模块一：英雄抽取逻辑（滚动插槽式） ====================

import * as state from '../core/state.js';
import { saveConfig } from '../core/storage.js';
import { escapeHTML, escapeJS } from '../core/utils.js';

// 刷新滚动面板的显示（根据技能/奥义随机勾选状态）
export function updateScrollBoxesDisplay() {
    const skillBox = document.getElementById('skill-scroll-box');
    const ultBox = document.getElementById('ult-scroll-box');

    if (window.CURRENT_CONFIG.heroDrawSettings.randomizeSkill) {
        skillBox.classList.remove('hidden');
    } else {
        skillBox.classList.add('hidden');
    }

    if (window.CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
        ultBox.classList.remove('hidden');
    } else {
        ultBox.classList.add('hidden');
    }
}

// 模拟高速插槽滚动的函数（核心交互）
export function startHeroDraw() {
    if (state.isScrolling) return;

    const pool = window.CURRENT_CONFIG.heroes.filter(h => window.CURRENT_CONFIG.activeHeroNames.includes(h.name));

    if (pool.length === 0) {
        alert("请先点击『⚙️ 英雄设置』勾选至少一个英雄！");
        return;
    }

    state.isScrolling = true;
    document.getElementById('hero-start-btn').disabled = true;
    document.getElementById('hero-start-btn').innerText = "抽取中...";

    const winHero = pool[Math.floor(Math.random() * pool.length)];
    const winSkill = winHero.skills[Math.floor(Math.random() * winHero.skills.length)];
    const winUlt = winHero.ultimates[Math.floor(Math.random() * winHero.ultimates.length)];

    runScrollAnimation('hero-slot', pool, winHero, 1500, () => {
        if (window.CURRENT_CONFIG.heroDrawSettings.randomizeSkill) {
            const skillPool = pool.flatMap(h => h.skills);
            runScrollAnimation('skill-slot', skillPool.map(s => ({name: s})), {name: winSkill}, 1200, () => {
                if (window.CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
                    const ultPool = pool.flatMap(h => h.ultimates);
                    runScrollAnimation('ult-slot', ultPool.map(u => ({name: u})), {name: winUlt}, 1200, finishDraw);
                } else {
                    finishDraw();
                }
            });
        } else if (window.CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
            const ultPool = pool.flatMap(h => h.ultimates);
            runScrollAnimation('ult-slot', ultPool.map(u => ({name: u})), {name: winUlt}, 1200, finishDraw);
        } else {
            finishDraw();
        }
    });

    function finishDraw() {
        state.isScrolling = false;
        document.getElementById('hero-start-btn').disabled = false;
        document.getElementById('hero-start-btn').innerText = "开始抽取";
    }
}

// 通用的槽位快速轮播切换动画
export function runScrollAnimation(slotId, pool, targetItem, duration, callback) {
    const slotEl = document.getElementById(slotId);
    let startTime = Date.now();
    let interval = 40;

    function tick() {
        let elapsed = Date.now() - startTime;

        if (elapsed < duration) {
            const randomItem = pool[Math.floor(Math.random() * pool.length)];
            slotEl.innerHTML = renderCardHTML(randomItem);
            interval = 40 + (elapsed / duration) * 150;
            setTimeout(tick, interval);
        } else {
            slotEl.innerHTML = renderCardHTML(targetItem);
            if (callback) callback();
        }
    }
    tick();
}

export function renderCardHTML(item) {
    const isHero = item.image !== undefined;
    const name = item.name;
    const imgUrl = item.image || '';

    if (isHero) {
        return `
            <div class="scroll-item">
                <img src="${imgUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="avatar-fallback" style="display:none; width:140px; height:140px; border-radius:50%; background:#222; border:3px solid #b3863b; align-items:center; justify-content:center; font-size:32px; font-weight:bold; color:#b3863b; margin-bottom:15px; margin-left:auto; margin-right:auto;">
                    ${name[0]}
                </div>
                <div class="slot-name">${name}</div>
            </div>
        `;
    } else {
        return `
            <div class="scroll-item">
                <div class="slot-img-placeholder">💡</div>
                <div class="slot-name" style="font-size:20px;">${name}</div>
            </div>
        `;
    }
}


// ==================== 模块一 (副)：英雄配置弹窗逻辑 ====================

// 初始化英雄设置网格，渲染勾选框和彻底删除按钮
export function initHeroSettingsGrid() {
    const container = document.getElementById('hero-checkbox-container');
    container.innerHTML = '';

    window.CURRENT_CONFIG.heroes.forEach(h => {
        const isChecked = window.CURRENT_CONFIG.activeHeroNames.includes(h.name);

        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item';
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${h.name}" ${isChecked ? 'checked' : ''} onchange="onHeroCheckboxChange(this)">
                <span>${h.name}</span>
            </label>
            <button class="hero-delete-btn" title="彻底删除此英雄" onclick="deleteHeroFromDB('${escapeJS(h.name)}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

// 打开英雄配置弹窗
export function openHeroSettings() {
    initHeroSettingsGrid();
    document.getElementById('setting-random-skill').checked = window.CURRENT_CONFIG.heroDrawSettings.randomizeSkill;
    document.getElementById('setting-random-ult').checked = window.CURRENT_CONFIG.heroDrawSettings.randomizeUltimate;
    document.getElementById('hero-settings-modal').classList.add('active');
}

// 关闭英雄配置弹窗
export function closeHeroSettings() {
    document.getElementById('hero-settings-modal').classList.remove('active');
    saveConfig();
    updateScrollBoxesDisplay();
    // 强制同步转盘
    window.WheelModule.syncPresetWheels();
}

// 英雄勾选状态变更
export function onHeroCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!window.CURRENT_CONFIG.activeHeroNames.includes(name)) {
            window.CURRENT_CONFIG.activeHeroNames.push(name);
        }
    } else {
        window.CURRENT_CONFIG.activeHeroNames = window.CURRENT_CONFIG.activeHeroNames.filter(n => n !== name);
    }
}

// 更新英雄随机设置选项
export function updateHeroSetting(key, val) {
    window.CURRENT_CONFIG.heroDrawSettings[key] = val;
}

// 英雄全选/取消全选
export function toggleAllHeroes(selectAll) {
    const checkboxes = document.querySelectorAll('#hero-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onHeroCheckboxChange(cb);
    });
}

// 展开/收起添加新英雄表单
export function toggleAddHeroForm(show) {
    const form = document.getElementById('add-hero-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

// 动态在添加表单中增加技能或奥义输入框
export function addDynamicInput(containerId, typeName) {
    const container = document.getElementById(containerId);
    const input = document.createElement('input');
    input.type = 'text';
    const className = containerId === 'form-skills-container' ? 'form-skill-input' : 'form-ult-input';
    input.className = className;

    const count = container.getElementsByTagName('input').length + 1;
    const prefix = containerId === 'form-skills-container' ? 'F' : 'V';

    input.placeholder = `例如：${prefix}${count}${typeName}`;
    input.style.marginBottom = '5px';
    container.appendChild(input);
}

// 提交新英雄到数据库中
export function submitNewHero() {
    const nameInput = document.getElementById('new-hero-name');
    const imageInput = document.getElementById('new-hero-image');

    const name = nameInput.value.trim();
    let imgFile = imageInput.value.trim();

    if (!name) {
        alert("请输入新英雄名称！");
        return;
    }

    if (!imgFile) {
        imgFile = "default.png";
    }

    if (window.CURRENT_CONFIG.heroes.some(h => h.name === name)) {
        alert("该英雄名已存在，请勿重复添加！");
        return;
    }

    // 收集输入框中的技能
    const skillInputs = document.querySelectorAll('.form-skill-input');
    const skills = [];
    skillInputs.forEach(input => {
        const val = input.value.trim();
        if (val) skills.push(val);
    });

    // 收集输入框中的奥义
    const ultInputs = document.querySelectorAll('.form-ult-input');
    const ultimates = [];
    ultInputs.forEach(input => {
        const val = input.value.trim();
        if (val) ultimates.push(val);
    });

    const newHero = {
        name: name,
        image: imgFile.startsWith("http") || imgFile.startsWith("assets/") ? imgFile : "assets/heroes/" + imgFile,
        skills: skills.length > 0 ? skills : ["默认技能F1"],
        ultimates: ultimates.length > 0 ? ultimates : ["默认奥义V1"]
    };

    window.CURRENT_CONFIG.heroes.push(newHero);
    window.CURRENT_CONFIG.activeHeroNames.push(name);
    saveConfig();

    // 重置表单字段
    nameInput.value = '';
    imageInput.value = '';

    // 重置输入槽为默认的2个空槽
    document.getElementById('form-skills-container').innerHTML = `
        <input type="text" class="form-skill-input" placeholder="例如：F1技能一" style="margin-bottom: 5px;">
        <input type="text" class="form-skill-input" placeholder="例如：F2技能二" style="margin-bottom: 5px;">
    `;
    document.getElementById('form-ults-container').innerHTML = `
        <input type="text" class="form-ult-input" placeholder="例如：V1奥义一" style="margin-bottom: 5px;">
        <input type="text" class="form-ult-input" placeholder="例如：V2奥义二" style="margin-bottom: 5px;">
    `;

    toggleAddHeroForm(false);
    initHeroSettingsGrid();

    alert(`英雄【${name}】已成功加入数据库！`);
}

// 从底层数据库中彻底删除英雄
export function deleteHeroFromDB(heroName) {
    if (!confirm(`确定要将英雄【${heroName}】彻底从数据库中删除吗？（此操作不可逆，且将同步取消其激活状态）`)) {
        return;
    }

    window.CURRENT_CONFIG.heroes = window.CURRENT_CONFIG.heroes.filter(h => h.name !== heroName);
    window.CURRENT_CONFIG.activeHeroNames = window.CURRENT_CONFIG.activeHeroNames.filter(n => n !== heroName);
    saveConfig();

    initHeroSettingsGrid();
}

// Helper for tabs.js
export function getHeroes() {
    return window.CURRENT_CONFIG.heroes;
}

// Attach all public functions to window.HeroModule
window.HeroModule = {
    updateScrollBoxesDisplay,
    startHeroDraw,
    runScrollAnimation,
    renderCardHTML,
    initHeroSettingsGrid,
    openHeroSettings,
    closeHeroSettings,
    onHeroCheckboxChange,
    updateHeroSetting,
    toggleAllHeroes,
    toggleAddHeroForm,
    addDynamicInput,
    submitNewHero,
    deleteHeroFromDB,
    getHeroes
};
