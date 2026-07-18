// ==================== 全局状态与初始化 ====================
let isScrolling = false; // 英雄滚动状态锁
let isSpinning = false;  // 转盘旋转状态锁
let isWeaponScrolling = false; // 武器滚动状态锁

let isPlayerShuffling = false; // 人员洗牌状态锁
let playerDeck = [];          // 人员抽取卡牌数组状态

let isPrizeDrawing = false;  // 奖品跑马灯运行状态锁

// 锦囊模块全局状态
let currentTipPool = 'challenger';       // challenger(挑战者) / champion(擂主)
let drawnTipCards = [];                  // 本回合抽取生成的卡组数据结构
let flippedTipCount = 0;                 // 当前已翻开的选择数量
let tipRefreshesRemaining = 0;           // 本回合局内剩余刷新次数
let activeTipMarqueeInterval = null;     // 跑马灯计时器
let isMarqueeDragging = false;           // 锦囊跑马灯手动拽移中
let marqueeStartX, marqueeScrollLeft;

let currentScoreboardRoundIndex = 0;     // 计分板当前选中的回合索引
let overlaySyncLock = false;             // 悬浮窗同步防抖锁
let globalEliminationCounter = 0;        // 全局淘汰序号计数器
let heroPickerRoundIndex = -1;           // 英雄选择器：当前操作的回合
let heroPickerEntryIndex = -1;           // 英雄选择器：当前操作的条目
let overlayFlipEnabled = false;          // FLIP动画首次渲染跳过标记
let currentOverlayWin = null;            // 本局排名悬浮窗引用
let globalOverlayWin = null;             // 总排名悬浮窗引用

window.onload = function() {
    // ── 悬浮窗视图分流检测 ──
    if (window.location.search.includes('view=overlay')) {
        initOverlayMode();
        return;
    }

    // 注册主窗口 storage 监听器（接收悬浮窗的修改）
    window.addEventListener('storage', onMainStorage);

    // 首次运行或载入时，动态同步和补全5大动态预设转盘数据
    syncPresetWheels();

    // 1. 初始化标签页
    switchTab('hero');
    
    // 2. 初始化英雄抽取界面的技能/奥义面板显示状态
    updateScrollBoxesDisplay();

    // 3. 初始化转盘下拉选择框
    initWheelSelector();

    // 4. 初始化武器界面的勾选框面板状态
    syncWeaponUIControls();
};

// 标签页切换逻辑
function switchTab(tabId) {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    // 转盘重绘
    if (tabId === 'wheel') {
        loadSelectedWheel();
    }
    // 激活人员界面渲染 (防止切换 Tab 导致翻牌状态及洗牌结果丢失)
    if (tabId === 'players') {
        if (playerDeck.length === 0) {
            resetAndShowPlayersFront();
        } else {
            renderPlayerCardsHTML();
        }
    }
    // 激活奖品抽取界面渲染
    if (tabId === 'prize') {
        sortPrizes(); // 每次切入奖品页，执行一次严格等阶排序
        renderPrizesDisplay();
        renderPrizeLogs();
    }
    // 激活锦囊抽取模块
    if (tabId === 'tips') {
        initTipDashboard();
    } else {
        // 切离时关闭锦囊轮播
        clearInterval(activeTipMarqueeInterval);
    }
    //激活计分板模块
    if (tabId === 'scoreboard') {
        initScoreboardDashboard();
    }
}


// ==================== 模块一：英雄抽取逻辑（滚动插槽式） ====================

// 刷新滚动面板的显示（根据技能/奥义随机勾选状态）
function updateScrollBoxesDisplay() {
    const skillBox = document.getElementById('skill-scroll-box');
    const ultBox = document.getElementById('ult-scroll-box');
    
    if (CURRENT_CONFIG.heroDrawSettings.randomizeSkill) {
        skillBox.classList.remove('hidden');
    } else {
        skillBox.classList.add('hidden');
    }
    
    if (CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
        ultBox.classList.remove('hidden');
    } else {
        ultBox.classList.add('hidden');
    }
}

// 模拟高速插槽滚动的函数（核心交互）
function startHeroDraw() {
    if (isScrolling) return; 

    const pool = CURRENT_CONFIG.heroes.filter(h => CURRENT_CONFIG.activeHeroNames.includes(h.name));
    
    if (pool.length === 0) {
        alert("请先点击『⚙️ 英雄设置』勾选至少一个英雄！");
        return;
    }

    isScrolling = true;
    document.getElementById('hero-start-btn').disabled = true;
    document.getElementById('hero-start-btn').innerText = "抽取中...";

    const winHero = pool[Math.floor(Math.random() * pool.length)];
    const winSkill = winHero.skills[Math.floor(Math.random() * winHero.skills.length)];
    const winUlt = winHero.ultimates[Math.floor(Math.random() * winHero.ultimates.length)];

    runScrollAnimation('hero-slot', pool, winHero, 1500, () => {
        if (CURRENT_CONFIG.heroDrawSettings.randomizeSkill) {
            const skillPool = pool.flatMap(h => h.skills); 
            runScrollAnimation('skill-slot', skillPool.map(s => ({name: s})), {name: winSkill}, 1200, () => {
                if (CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
                    const ultPool = pool.flatMap(h => h.ultimates);
                    runScrollAnimation('ult-slot', ultPool.map(u => ({name: u})), {name: winUlt}, 1200, finishDraw);
                } else {
                    finishDraw();
                }
            });
        } else if (CURRENT_CONFIG.heroDrawSettings.randomizeUltimate) {
            const ultPool = pool.flatMap(h => h.ultimates);
            runScrollAnimation('ult-slot', ultPool.map(u => ({name: u})), {name: winUlt}, 1200, finishDraw);
        } else {
            finishDraw();
        }
    });

    function finishDraw() {
        isScrolling = false;
        document.getElementById('hero-start-btn').disabled = false;
        document.getElementById('hero-start-btn').innerText = "开始抽取";
    }
}

// 通用的槽位快速轮播切换动画
function runScrollAnimation(slotId, pool, targetItem, duration, callback) {
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

function renderCardHTML(item) {
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
function initHeroSettingsGrid() {
    const container = document.getElementById('hero-checkbox-container');
    container.innerHTML = '';

    CURRENT_CONFIG.heroes.forEach(h => {
        const isChecked = CURRENT_CONFIG.activeHeroNames.includes(h.name);
        
        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item'; 
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${h.name}" ${isChecked ? 'checked' : ''} onchange="onHeroCheckboxChange(this)">
                <span>${h.name}</span>
            </label>
            <button class="hero-delete-btn" title="彻底删除此英雄" onclick="deleteHeroFromDB('${h.name}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

// 打开英雄配置弹窗
function openHeroSettings() {
    initHeroSettingsGrid();
    document.getElementById('setting-random-skill').checked = CURRENT_CONFIG.heroDrawSettings.randomizeSkill;
    document.getElementById('setting-random-ult').checked = CURRENT_CONFIG.heroDrawSettings.randomizeUltimate;
    document.getElementById('hero-settings-modal').classList.add('active');
}

// 关闭英雄配置弹窗
function closeHeroSettings() {
    document.getElementById('hero-settings-modal').classList.remove('active');
    saveConfigToLocal();
    updateScrollBoxesDisplay();
    // 强制同步转盘
    syncPresetWheels();
}

// 英雄勾选状态变更
function onHeroCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!CURRENT_CONFIG.activeHeroNames.includes(name)) {
            CURRENT_CONFIG.activeHeroNames.push(name);
        }
    } else {
        CURRENT_CONFIG.activeHeroNames = CURRENT_CONFIG.activeHeroNames.filter(n => n !== name);
    }
}

// 更新英雄随机设置选项
function updateHeroSetting(key, val) {
    CURRENT_CONFIG.heroDrawSettings[key] = val;
}

// 英雄全选/取消全选
function toggleAllHeroes(selectAll) {
    const checkboxes = document.querySelectorAll('#hero-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onHeroCheckboxChange(cb);
    });
}

// 展开/收起添加新英雄表单
function toggleAddHeroForm(show) {
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
function addDynamicInput(containerId, typeName) {
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
function submitNewHero() {
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

    if (CURRENT_CONFIG.heroes.some(h => h.name === name)) {
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

    CURRENT_CONFIG.heroes.push(newHero);
    CURRENT_CONFIG.activeHeroNames.push(name);
    saveConfigToLocal();

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
function deleteHeroFromDB(heroName) {
    if (!confirm(`确定要将英雄【${heroName}】彻底从数据库中删除吗？（此操作不可逆，且将同步取消其激活状态）`)) {
        return;
    }

    CURRENT_CONFIG.heroes = CURRENT_CONFIG.heroes.filter(h => h.name !== heroName);
    CURRENT_CONFIG.activeHeroNames = CURRENT_CONFIG.activeHeroNames.filter(n => n !== heroName);
    saveConfigToLocal();

    initHeroSettingsGrid();
}

// ==================== 模块二：武器抽取逻辑 ====================

// 同步页面配置状态到 UI
function syncWeaponUIControls() {
    document.getElementById('wp-melee-toggle').checked = CURRENT_CONFIG.weaponDrawSettings.includeMelee;
    document.getElementById('wp-ranged-toggle').checked = CURRENT_CONFIG.weaponDrawSettings.includeRanged;
    document.getElementById('wp-quality-toggle').checked = CURRENT_CONFIG.weaponDrawSettings.randomizeQuality;
    document.getElementById('wp-duplicate-toggle').checked = CURRENT_CONFIG.weaponDrawSettings.allowDuplicate;
    
    const eachOneActive = CURRENT_CONFIG.weaponDrawSettings.eachOnePreset || false;
    document.getElementById('wp-each-one-toggle').checked = eachOneActive;
    
    const selectEl = document.getElementById('wp-count-select');
    selectEl.value = CURRENT_CONFIG.weaponDrawSettings.drawCount;
    selectEl.disabled = eachOneActive; 
}

// 快速更新武器抽取设置
function updateWeaponToggle(key, val) {
    CURRENT_CONFIG.weaponDrawSettings[key] = val;
    saveConfigToLocal();
}

// 开启/关闭近战远程各一键抽取
function toggleEachOnePreset(checked) {
    CURRENT_CONFIG.weaponDrawSettings.eachOnePreset = checked;
    document.getElementById('wp-count-select').disabled = checked;
    saveConfigToLocal();
}

// 武器抽取执行器
function startWeaponDraw() {
    if (isWeaponScrolling) return;

    const settings = CURRENT_CONFIG.weaponDrawSettings;
    let pool = CURRENT_CONFIG.weapons.filter(wp => CURRENT_CONFIG.activeWeaponNames.includes(wp.name));
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
            alert(`⚠️ 武器数量不够啦！\n\n当前符合筛选条件的武器库一共有【${pool.length}】把。\n你想要抽取的数量是【${drawCount}】把。\n由于你关闭了“重复抽取”，系统无法变出足够的武器！\n\n💡 解决办法：请开启“允许重复抽取”复选框，或点击名单设置勾选更多武器！`);
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

    isWeaponScrolling = true;
    document.getElementById('weapon-start-btn').disabled = true;
    document.getElementById('weapon-start-btn').innerText = "抽取中...";

    let completed = 0;
    winners.forEach((winner, index) => {
        const duration = 1500 + index * 500; 
        runWeaponScrollAnimation(`weapon-slot-${index}`, `weapon-box-${index}`, pool, winner, duration, () => {
            completed++;
            if (completed === finalCount) {
                isWeaponScrolling = false;
                document.getElementById('weapon-start-btn').disabled = false;
                document.getElementById('weapon-start-btn').innerText = "开始抽取";
            }
        });
    });
}

// 武器专属滚动渲染
function runWeaponScrollAnimation(slotId, boxId, pool, targetWp, duration, callback) {
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
function renderWeaponCardHTML(wp) {
    const name = wp.name;
    const imgUrl = wp.image;
    const quality = wp.quality || ''; 

    return `
        <div class="scroll-item">
            <img class="weapon-img" src="${imgUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="weapon-avatar-fallback" style="display:none;">
                ${name}
            </div>
            <div class="slot-name">${name}</div>
            ${quality ? `<div class="slot-subtext">【${quality}品】</div>` : ''}
        </div>
    `;
}

// ==================== 模块二 (副)：武器弹窗管理 ====================

function openWeaponSettings() {
    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');
    document.getElementById('weapon-settings-modal').classList.add('active');
}

function closeWeaponSettings() {
    document.getElementById('weapon-settings-modal').classList.remove('active');
    saveConfigToLocal();
    // 强制同步转盘
    syncPresetWheels();
}

// 展开/收起添加新武器表单
function toggleAddWeaponForm(show) {
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
function submitNewWeapon() {
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
        imgFile = "default.png";
    }

    if (CURRENT_CONFIG.weapons.some(wp => wp.name === name)) {
        alert("该武器名已存在，请勿重复添加！");
        return;
    }

    const newWeapon = {
        name: name,
        type: type,
        image: imgFile.startsWith("http") || imgFile.startsWith("assets/") ? imgFile : "assets/weapons/" + imgFile
    };

    CURRENT_CONFIG.weapons.push(newWeapon);
    CURRENT_CONFIG.activeWeaponNames.push(name);
    saveConfigToLocal();

    nameInput.value = '';
    imageInput.value = '';
    
    toggleAddWeaponForm(false);
    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');
    
    alert(`武器【${name}】已成功加入武器库！`);
}

// 彻底删除某个武器
function deleteWeaponFromDB(wpName) {
    if (!confirm(`确定要将武器【${wpName}】彻底从数据库中删除吗？（不可逆）`)) {
        return;
    }

    CURRENT_CONFIG.weapons = CURRENT_CONFIG.weapons.filter(wp => wp.name !== wpName);
    CURRENT_CONFIG.activeWeaponNames = CURRENT_CONFIG.activeWeaponNames.filter(n => n !== wpName);
    saveConfigToLocal();

    initWeaponSettingsGrid('melee', 'melee-checkbox-container');
    initWeaponSettingsGrid('ranged', 'ranged-checkbox-container');
}

// 渲染武器管理列表
function initWeaponSettingsGrid(type, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const list = CURRENT_CONFIG.weapons.filter(wp => wp.type === type);
    list.forEach(wp => {
        const isChecked = CURRENT_CONFIG.activeWeaponNames.includes(wp.name);
        
        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item'; 
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${wp.name}" ${isChecked ? 'checked' : ''} onchange="onWeaponCheckboxChange(this)">
                <span>${wp.name}</span>
            </label>
            <button class="hero-delete-btn" title="彻底删除此武器" onclick="deleteWeaponFromDB('${wp.name}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

function onWeaponCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!CURRENT_CONFIG.activeWeaponNames.includes(name)) {
            CURRENT_CONFIG.activeWeaponNames.push(name);
        }
    } else {
        CURRENT_CONFIG.activeWeaponNames = CURRENT_CONFIG.activeWeaponNames.filter(n => n !== name);
    }
}

function toggleAllWeapons(selectAll, type) {
    const containerId = type === 'melee' ? 'melee-checkbox-container' : 'ranged-checkbox-container';
    const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onWeaponCheckboxChange(cb);
    });
}


// ==================== 模块三：人员抽取 ====================

// 重置并展示人员正面
function resetAndShowPlayersFront() {
    if (isPlayerShuffling) return;

    document.getElementById('players-history-list').innerHTML = '';

    const activePlayers = CURRENT_CONFIG.players.filter(p => CURRENT_CONFIG.activePlayerNames.includes(p.name));
    
    document.getElementById('player-pool-count').innerText = `当前出场人数：${activePlayers.length} 人`;

    const container = document.getElementById('player-cards-container');
    container.innerHTML = '';

    if (activePlayers.length === 0) {
        container.innerHTML = `<div style="color: #888; font-size: 18px; margin-top: 20px;">请点击右上角「⚙️ 人员名单设置」勾选参与抽取的选手！</div>`;
        return;
    }

    playerDeck = activePlayers.map((p, idx) => ({
        player: p,
        isFaceDown: false,
        revealed: true,
        index: idx
    }));

    renderPlayerCardsHTML();
}

// 重新渲染人员卡牌 DOM
function renderPlayerCardsHTML() {
    const container = document.getElementById('player-cards-container');
    container.innerHTML = '';

    playerDeck.forEach((deckItem, idx) => {
        const cardBox = document.createElement('div');
        cardBox.className = `card-container ${deckItem.isFaceDown ? 'face-down' : ''} ${isPlayerShuffling ? 'locked' : ''}`;
        cardBox.id = `player-card-box-${idx}`;
        cardBox.onclick = () => revealPlayerCard(idx);

        cardBox.innerHTML = `
            <div class="card-inner">
                <!-- 正面 -->
                <div class="card-front">
                    <img src="${deckItem.player.image}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="card-player-fallback" style="display:none;">
                        ${deckItem.player.name[0]}
                    </div>
                    <div class="card-player-name">${deckItem.player.name}</div>
                </div>
                <!-- 反面 -->
                <div class="card-back">
                    <div class="card-back-hint">点击翻开</div>
                </div>
            </div>
        `;
        container.appendChild(cardBox);
    });
}

// 翻转并洗牌
function flipAndShufflePlayers() {
    if (isPlayerShuffling) return;

    if (playerDeck.length === 0) {
        alert("场上没有任何选手，请前往设置中勾选参与抽取的名单！");
        return;
    }

    // 同步更新当前出场人数显示
    const activePlayers = CURRENT_CONFIG.players.filter(p => CURRENT_CONFIG.activePlayerNames.includes(p.name));
    document.getElementById('player-pool-count').innerText = `当前出场人数：${activePlayers.length} 人`;

    isPlayerShuffling = true;
    document.getElementById('player-shuffle-btn').disabled = true;
    document.getElementById('player-shuffle-btn').innerText = "卡牌翻转中...";

    // 1. 卡牌翻转到背面
    playerDeck.forEach((item, idx) => {
        item.isFaceDown = true;
        item.revealed = false;
        const el = document.getElementById(`player-card-box-${idx}`);
        if (el) el.classList.add('face-down');
    });

    // 2. 聚拢洗牌动画
    setTimeout(() => {
        document.getElementById('player-shuffle-btn').innerText = "正在洗乱卡牌...";

        const container = document.getElementById('player-cards-container');
        const cardEls = container.querySelectorAll('.card-container');
        
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;

        cardEls.forEach(el => {
            const rect = el.getBoundingClientRect();
            const elX = rect.left + rect.width / 2;
            const elY = rect.top + rect.height / 2;
            
            const dx = centerX - elX;
            const dy = centerY - elY;
            
            el.style.setProperty('--center-dx', `${dx}px`);
            el.style.setProperty('--center-dy', `${dy}px`);
            el.classList.add('shuffling-animation');
        });

        // 3. 打乱并重绘
        setTimeout(() => {
            for (let i = playerDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = playerDeck[i].player;
                playerDeck[i].player = playerDeck[j].player;
                playerDeck[j].player = temp;
            }

            cardEls.forEach(el => {
                el.classList.remove('shuffling-animation');
            });

            isPlayerShuffling = false;
            document.getElementById('player-shuffle-btn').disabled = false;
            document.getElementById('player-shuffle-btn').innerText = "🎴 翻转并洗牌";
            
            renderPlayerCardsHTML();
        }, 1000);

    }, 600);
}

// 翻开单张卡牌
function revealPlayerCard(cardIdx) {
    if (isPlayerShuffling) return;

    const deckItem = playerDeck[cardIdx];
    if (!deckItem.isFaceDown || deckItem.revealed) return;

    deckItem.isFaceDown = false;
    deckItem.revealed = true;

    const el = document.getElementById(`player-card-box-${cardIdx}`);
    if (el) {
        el.classList.remove('face-down');
    }

    const list = document.getElementById('players-history-list');
    const li = document.createElement('li');
    li.innerHTML = `位置 [${cardIdx + 1}] 翻开揭晓：<strong>${deckItem.player.name}</strong>`;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight; 
}


// ==================== 模块三 (副)：人员配置管理 ====================

function openPlayerSettings() {
    initPlayerSettingsGrid();
    document.getElementById('player-settings-modal').classList.add('active');
}

function closePlayerSettings() {
    document.getElementById('player-settings-modal').classList.remove('active');
    saveConfigToLocal();
    // 洗牌进行中时不强制重置，避免打断动画
    if (!isPlayerShuffling) {
        resetAndShowPlayersFront();
    }
}

function toggleAddPlayerForm(show) {
    const form = document.getElementById('add-player-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

function submitNewPlayer() {
    const nameInput = document.getElementById('new-player-name');
    const fileInput = document.getElementById('new-player-image-file');
    const pathInput = document.getElementById('new-player-image-path');

    const name = nameInput.value.trim();
    if (!name) {
        alert("请输入选手名字！");
        return;
    }

    if (CURRENT_CONFIG.players.some(p => p.name === name)) {
        alert("该选手已在数据库中，请勿重复添加！");
        return;
    }

    const pathVal = pathInput.value.trim();
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;
            addNewPlayerToDB(name, base64Data);
        };
        reader.readAsDataURL(file);
    } else {
        const finalPath = pathVal || "assets/players/default.png";
        addNewPlayerToDB(name, finalPath);
    }
}

function addNewPlayerToDB(name, imageSrc) {
    const newPlayer = {
        name: name,
        image: imageSrc
    };

    CURRENT_CONFIG.players.push(newPlayer);
    CURRENT_CONFIG.activePlayerNames.push(name);
    saveConfigToLocal();

    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-image-file').value = '';
    document.getElementById('new-player-image-path').value = '';

    toggleAddPlayerForm(false);
    initPlayerSettingsGrid();
    
    alert(`选手【${name}】已成功加入选手库！`);
}

function deletePlayerFromDB(playerName) {
    if (!confirm(`确定要将选手【${playerName}】彻底从数据库中删除吗？（不可逆）`)) {
        return;
    }

    CURRENT_CONFIG.players = CURRENT_CONFIG.players.filter(p => p.name !== playerName);
    CURRENT_CONFIG.activePlayerNames = CURRENT_CONFIG.activePlayerNames.filter(n => n !== playerName);
    saveConfigToLocal();

    initPlayerSettingsGrid();
}

function initPlayerSettingsGrid() {
    const container = document.getElementById('players-checkbox-container');
    container.innerHTML = '';

    CURRENT_CONFIG.players.forEach(p => {
        const isChecked = CURRENT_CONFIG.activePlayerNames.includes(p.name);
        
        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item'; 
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${p.name}" ${isChecked ? 'checked' : ''} onchange="onPlayerCheckboxChange(this)">
                <span>${p.name}</span>
            </label>
            <button class="hero-delete-btn" title="物理彻底删除" onclick="deletePlayerFromDB('${p.name}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

function onPlayerCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!CURRENT_CONFIG.activePlayerNames.includes(name)) {
            CURRENT_CONFIG.activePlayerNames.push(name);
        }
    } else {
        CURRENT_CONFIG.activePlayerNames = CURRENT_CONFIG.activePlayerNames.filter(n => n !== name);
    }
}

function toggleAllPlayers(selectAll) {
    const checkboxes = document.querySelectorAll('#players-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onPlayerCheckboxChange(cb);
    });
}


// ==================== 🛠️ 模块四：锦囊抽取与演播大厅 ====================

// 锦囊大厅渲染初始化入口
function initTipDashboard() {
    // 1. 同步设置参数到控件
    const settings = CURRENT_CONFIG.tipDrawSettings;
    document.getElementById('tip-draw-count-select').value = settings.drawCount;
    document.getElementById('tip-choose-count-select').value = settings.chooseCount;
    document.getElementById('tip-refresh-limit-input').value = settings.refreshLimit;

    // 2. 刷新两个子分类按钮的高亮状态
    document.getElementById('tip-sub-challenger').classList.toggle('active', currentTipPool === 'challenger');
    document.getElementById('tip-sub-champion').classList.toggle('active', currentTipPool === 'champion');

    // 3. 渲染跑马灯展示行
    renderTipMarquee();

    // 4. 渲染本局已选择日志
    renderTipLogs();

    // 5. 渲染桌面抽卡区域
    if (drawnTipCards.length === 0) {
        document.getElementById('tip-play-hall').classList.add('hidden');
        document.getElementById('marquee-drag-outer').classList.remove('hidden');
    } else {
        document.getElementById('tip-play-hall').classList.remove('hidden');
        document.getElementById('marquee-drag-outer').classList.add('hidden'); 
        renderDrawnTipCardsGrid();
    }

    // 6. 控制“开始抽取”的可点按状态 (防作弊机制：已翻牌时锁死)
    updateTipStartDrawBtnUI();
}

// 切换锦囊两个局部导航子池
function switchTipPool(poolType) {
    currentTipPool = poolType;
    
    drawnTipCards = [];
    flippedTipCount = 0;
    
    initTipDashboard();
}

// 调节抽卡的基础控制数字
function adjustTipCounts(key, value) {
    if (isNaN(value)) {
        // 输入非法值时恢复为当前有效值，避免污染配置
        document.getElementById('tip-refresh-limit-input').value = CURRENT_CONFIG.tipDrawSettings.refreshLimit;
        return;
    }
    CURRENT_CONFIG.tipDrawSettings[key] = value;
    
    if (key === 'drawCount' || key === 'chooseCount') {
        const drawCount = CURRENT_CONFIG.tipDrawSettings.drawCount;
        const chooseCount = CURRENT_CONFIG.tipDrawSettings.chooseCount;
        if (chooseCount > drawCount) {
            CURRENT_CONFIG.tipDrawSettings.chooseCount = drawCount;
            document.getElementById('tip-choose-count-select').value = drawCount;
        }
    }
    saveConfigToLocal();
}

// 渲染跑马灯展示行
function renderTipMarquee() {
    const container = document.getElementById('tip-marquee-container');
    container.innerHTML = '';

    const activeConfirmed = CURRENT_CONFIG.tipSession.selectedTips || [];
    const list = CURRENT_CONFIG.tips.filter(t => t.pool === currentTipPool && !activeConfirmed.includes(t.name) && CURRENT_CONFIG.activeTipNames.includes(t.name));

    if (list.length === 0) {
        container.innerHTML = `<div style="color: #666; font-size: 15px; padding: 20px;">当前卡池已无空余锦囊卡牌（或尚未在后台添加数据）。</div>`;
        return;
    }

    clearInterval(activeTipMarqueeInterval); 

    let displayList = [];
    if (list.length < 5) {
        displayList = [...list];
        container.style.justifyContent = 'center'; 
    } else {
        displayList = [...list, ...list];
        container.style.justifyContent = 'flex-start';
        initTipMarqueeScroller(); 
    }

    displayList.forEach(tip => {
        const card = document.createElement('div');
        const qClass = getTipQualityClass(tip.quality);
        card.className = `tip-card-item card-container ${qClass}`;
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front tip-card-front">
                    <div class="tip-card-body">
                        <div class="tip-card-title">${tip.name}</div>
                        <div class="tip-card-desc">${tip.description}</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// 手动拖拽与自动匀速滑动引擎
function initTipMarqueeScroller() {
    const scroller = document.getElementById('tip-marquee-container');
    if (!scroller) return;

    // 只附加一次事件监听器，防止内存泄漏
    if (scroller.dataset.marqueeListenersAttached !== 'true') {
        scroller.dataset.marqueeListenersAttached = 'true';

        scroller.addEventListener('mousedown', (e) => {
            isMarqueeDragging = true;
            scroller.classList.add('active-dragging');
            marqueeStartX = e.pageX - scroller.offsetLeft;
            marqueeScrollLeft = scroller.scrollLeft;
        });

        scroller.addEventListener('mouseleave', () => {
            isMarqueeDragging = false;
            scroller.classList.remove('active-dragging');
        });

        scroller.addEventListener('mouseup', () => {
            isMarqueeDragging = false;
            scroller.classList.remove('active-dragging');
        });

        scroller.addEventListener('mousemove', (e) => {
            if (!isMarqueeDragging) return;
            e.preventDefault();
            const x = e.pageX - scroller.offsetLeft;
            const walk = (x - marqueeStartX) * 1.5;
            scroller.scrollLeft = marqueeScrollLeft - walk;
        });
    }

    // 每次调用都重启自动滚动 interval（修复确认/重置后动画停止的 bug）
    clearInterval(activeTipMarqueeInterval);
    activeTipMarqueeInterval = setInterval(() => {
        if (isMarqueeDragging) return;
        scroller.scrollLeft += 1;
        if (scroller.scrollLeft >= scroller.scrollWidth / 2) {
            scroller.scrollLeft = 0;
        }
    }, 25);
}

// 锦囊品质配色 class 映射
function getTipQualityClass(q) {
    if (q === '金') return 'tip-border-gold';
    if (q === '紫') return 'tip-border-purple';
    if (q === '蓝') return 'tip-border-blue';
    return 'tip-border-white';
}

// 锦囊概率分配
function rollTipQuality() {
    const set = CURRENT_CONFIG.tipDrawSettings;
    const roll = Math.random() * 100;
    if (roll < set.goldProb) return '金';
    if (roll < set.goldProb + set.purpleProb) return '紫';
    if (roll < set.goldProb + set.purpleProb + set.blueProb) return '蓝';
    return '白';
}

// 带有 4 重兜底防空机制的锦囊抽取器
function getWeightedRandomTip(poolType, excludedList, targetQuality) {
    const allTips = CURRENT_CONFIG.tips.filter(t => t.pool === poolType && !excludedList.includes(t.name) && CURRENT_CONFIG.activeTipNames.includes(t.name));
    if (allTips.length === 0) return null;

    let group = allTips.filter(t => t.quality === targetQuality);
    
    if (group.length === 0) {
        const fallbacks = ['白', '蓝', '紫', '金'];
        for (let q of fallbacks) {
            group = allTips.filter(t => t.quality === q);
            if (group.length > 0) break;
        }
    }

    if (group.length === 0) return null;
    return group[Math.floor(Math.random() * group.length)];
}

// 🚀 发起抽卡指令（集成：3D 聚拢聚散洗牌物理效果）
let isInitialDealing = false; 

function startTipDraw() {
    const settings = CURRENT_CONFIG.tipDrawSettings;
    const drawCount = settings.drawCount;

    const activeConfirmed = CURRENT_CONFIG.tipSession.selectedTips || [];
    const availableTotal = CURRENT_CONFIG.tips.filter(t => t.pool === currentTipPool && !activeConfirmed.includes(t.name) && CURRENT_CONFIG.activeTipNames.includes(t.name));

    if (availableTotal.length < drawCount) {
        alert(`⚠️ 卡池中可用锦囊仅剩【${availableTotal.length}】张，数量不足，无法抽取【${drawCount}】张！\n\n💡 解决办法：请前往锦囊设置添加卡牌，或点击重置清空已选历史！`);
        return;
    }

    flippedTipCount = 0;
    tipRefreshesRemaining = settings.refreshLimit;
    isInitialDealing = true; // 开启洗牌动效自锁

    drawnTipCards = [];
    let tempExcluded = [...activeConfirmed];

    for (let i = 0; i < drawCount; i++) {
        const targetQ = rollTipQuality();
        const tip = getWeightedRandomTip(currentTipPool, tempExcluded, targetQ);
        if (tip) {
            drawnTipCards.push({
                tipData: tip,
                isFaceDown: true,
                revealed: false,
                qualityRolled: tip.quality 
            });
            tempExcluded.push(tip.name); 
        }
    }

    // 强行隐藏跑马灯灯带
    document.getElementById('marquee-drag-outer').classList.add('hidden');
    document.getElementById('tip-play-hall').classList.remove('hidden');
    
    // 1. 先将牌渲染到 DOM 中
    renderDrawnTipCardsGrid();

    // 2. 🎴 挂载中央交叉、随后向两翼散开的 3D 洗牌特效
    const container = document.getElementById('tip-drawn-cards-container');
    const cardWrappers = container.querySelectorAll('.tip-card-slot-wrapper');
    
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const centerY = containerRect.top + containerRect.height / 2;

    cardWrappers.forEach(el => {
        const rect = el.getBoundingClientRect();
        const elX = rect.left + rect.width / 2;
        const elY = rect.top + rect.height / 2;
        
        const dx = centerX - elX;
        const dy = centerY - elY;
        
        el.style.setProperty('--center-dx', `${dx}px`);
        el.style.setProperty('--center-dy', `${dy}px`);
        el.classList.add('shuffling-animation');
    });

    // 3. 释放指针，落子
    setTimeout(() => {
        for (let i = drawnTipCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = drawnTipCards[i];
            drawnTipCards[i] = drawnTipCards[j];
            drawnTipCards[j] = temp;
        }

        cardWrappers.forEach(el => el.classList.remove('shuffling-animation'));
        isInitialDealing = false;

        renderDrawnTipCardsGrid();
    }, 1000);
}

// 渲染抽取的锦囊，自适应 Flex 绝对居中 (优化：刷新按钮初始化为 hidden，在翻牌后显隐无损过渡)
function renderDrawnTipCardsGrid() {
    const container = document.getElementById('tip-drawn-cards-container');
    container.innerHTML = '';

    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.flexWrap = 'wrap';
    container.style.gap = '24px';
    container.style.width = '100%';
    container.style.margin = '20px auto';

    const settings = CURRENT_CONFIG.tipDrawSettings;
    document.getElementById('revealed-tips-indicator').innerText = flippedTipCount;
    document.getElementById('max-tips-indicator').innerText = settings.chooseCount;
    document.getElementById('tip-refreshes-left-indicator').innerText = tipRefreshesRemaining;

    drawnTipCards.forEach((card, index) => {
        const slotWrapper = document.createElement('div');
        slotWrapper.className = 'tip-card-slot-wrapper';
        
        const qClass = getTipQualityClass(card.tipData.quality);

        const cardHtml = `
            <div class="card-container ${card.isFaceDown ? 'face-down' : ''}" id="tip-card-container-${index}" onclick="revealTipCardInGame(${index})">
                <div class="card-inner" id="tip-card-inner-${index}">
                    <!-- 正面 -->
                    <div class="card-front tip-card-front ${qClass}">
                        <div class="tip-card-body">
                            <div class="tip-card-title">${card.tipData.name}</div>
                            <div class="tip-card-desc">${card.tipData.description}</div>
                        </div>
                    </div>
                    <!-- 反面 -->
                    <div class="card-back tip-card-back">
                        <div class="card-back-hint">点击揭秘</div>
                    </div>
                </div>
            </div>
        `;

        // 核心优化：如果卡牌未翻开，刷新按钮使用 hidden 占位。
        // 这既能维持初始排版高度，又不会在翻牌前被直接销毁 DOM。
        const btnClass = (card.isFaceDown || tipRefreshesRemaining <= 0) ? 'small-btn tip-single-refresh-btn hidden' : 'small-btn tip-single-refresh-btn';
        const btnHtml = `<button class="${btnClass}" id="tip-refresh-btn-${index}" onclick="refreshSingleTip(${index})">🔄 刷新此卡</button>`;

        slotWrapper.innerHTML = cardHtml + btnHtml;
        container.appendChild(slotWrapper);
    });

    updateTipStartDrawBtnUI();
}

// 🎯 局内单卡单独刷新与 3D 纵向翻转特效
function refreshSingleTip(index) {
    if (tipRefreshesRemaining <= 0) return;

    const cardInnerEl = document.getElementById(`tip-card-inner-${index}`);
    if (!cardInnerEl) return;

    cardInnerEl.classList.remove('card-reroll-spinning');
    void cardInnerEl.offsetWidth; 
    cardInnerEl.classList.add('card-reroll-spinning');

    const settings = CURRENT_CONFIG.tipDrawSettings;
    const activeConfirmed = CURRENT_CONFIG.tipSession.selectedTips || [];
    
    let tempExcluded = [...activeConfirmed];
    drawnTipCards.forEach((c, idx) => {
        if (idx !== index) {
            tempExcluded.push(c.tipData.name);
        }
    });

    let rolledQ = '';
    if (settings.refreshSameQuality) {
        rolledQ = drawnTipCards[index].qualityRolled; 
    } else {
        rolledQ = rollTipQuality(); 
    }

    const newTip = getWeightedRandomTip(currentTipPool, tempExcluded, rolledQ);
    if (!newTip) {
        alert("卡池中无可用的备用锦囊来刷新此位置！");
        return;
    }

    tipRefreshesRemaining--;

    setTimeout(() => {
        drawnTipCards[index] = {
            tipData: newTip,
            isFaceDown: false, 
            revealed: true,
            qualityRolled: newTip.quality
        };
        renderDrawnTipCardsGrid();
    }, 280);
}

// 翻牌动作 (核心修复：直接修改 DOM 的 className 实现原生的 3D 翻转动效，不销毁重建)
function revealTipCardInGame(index) {
    if (isInitialDealing) return; 

    const card = drawnTipCards[index];
    const chooseLimit = CURRENT_CONFIG.tipDrawSettings.chooseCount;

    if (!card.isFaceDown || card.revealed) return;

    if (flippedTipCount >= chooseLimit) {
        alert(`本局抽取设定只能选择翻开【${chooseLimit}】张锦囊！如对卡组不满意，可以点击下方对应的刷新按钮！`);
        return;
    }

    // 1. 本地更新状态
    card.isFaceDown = false;
    card.revealed = true;
    flippedTipCount++;

    // 2. 🎴 核心修复：直接寻找 DOM，移除 face-down 触发原生 3D 翻转过渡，绝不重绘导致卡死
    const cardContainer = document.getElementById(`tip-card-container-${index}`);
    if (cardContainer) {
        cardContainer.classList.remove('face-down');
    }

    // 3. 无重绘直接更新顶部数字状态
    document.getElementById('revealed-tips-indicator').innerText = flippedTipCount;

    // 4. 动态评估并锁定开始抽取按钮的可控状态
    updateTipStartDrawBtnUI();

    // 5. 在 3D 翻面转到正面完成时 (约 450毫秒) 触发刷新按钮优雅淡入，完全不破坏翻牌动画
    setTimeout(() => {
        const btn = document.getElementById(`tip-refresh-btn-${index}`);
        if (btn && tipRefreshesRemaining > 0) {
            btn.classList.remove('hidden');
        }
    }, 450);
}

// 防作弊 UI 动态评测控制器
function updateTipStartDrawBtnUI() {
    const btn = document.getElementById('tip-start-draw-btn');
    if (!btn) return;

    if (flippedTipCount > 0) {
        // 如果翻牌数大于 0，强制锁定防作弊
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.title = "本回合已开牌查看，需先确认锁定或者重置本局，方可开启下一次抽卡";
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.title = "";
    }
}

// 💾 确认选择：确认选择并归档，并升级为多维结构体日志
function confirmTipChoice() {
    const chosenCards = drawnTipCards.filter(c => !c.isFaceDown);

    if (chosenCards.length === 0) {
        alert("场上还没有任何被翻开解密的锦囊，请先翻牌确认，或者点击开始抽取！");
        return;
    }

    if (!CURRENT_CONFIG.tipSession.selectedTips) {
        CURRENT_CONFIG.tipSession.selectedTips = [];
    }
    if (!CURRENT_CONFIG.tipSession.logs) {
        CURRENT_CONFIG.tipSession.logs = [];
    }

    let namesStr = [];
    chosenCards.forEach(c => {
        if (!CURRENT_CONFIG.tipSession.selectedTips.includes(c.tipData.name)) {
            CURRENT_CONFIG.tipSession.selectedTips.push(c.tipData.name);
        }
        namesStr.push(`【${c.tipData.name}】(${c.tipData.description})`);
    });

    const newLog = {
        time: getFormattedTime(),
        poolName: currentTipPool === 'challenger' ? '挑战者' : '擂主',
        tips: chosenCards.map(c => ({
            name: c.tipData.name,
            description: c.tipData.description,
            quality: c.tipData.quality
        }))
    };
    CURRENT_CONFIG.tipSession.logs.unshift(newLog);

    saveConfigToLocal();

    drawnTipCards = [];
    flippedTipCount = 0;

    document.getElementById('tip-play-hall').classList.add('hidden');
    document.getElementById('marquee-drag-outer').classList.remove('hidden');
    
    initTipDashboard();

    alert("🎉 锦囊选择锁定成功！相应锦囊已被归档并从候选池中剥离，可再次抽取其他卡片。");
}

// 🧹 重置本局：清空锁定，锦囊全部回归各池
function resetTipSession() {
    if (!confirm("确定要清空本局所有已被抽出的锦囊历史以及操作记录吗？（此操作会让所有锦囊重新进池）")) return;

    CURRENT_CONFIG.tipSession = {
        selectedTips: [],
        logs: []
    };
    saveConfigToLocal();

    drawnTipCards = [];
    flippedTipCount = 0;
    
    document.getElementById('tip-play-hall').classList.add('hidden');
    document.getElementById('marquee-drag-outer').classList.remove('hidden');

    initTipDashboard();
}

// 品质高亮霓虹色
function getLogQualityColor(q) {
    if (q === '金') return '#ffcc00'; 
    if (q === '紫') return '#bf5af2'; 
    if (q === '蓝') return '#29b6f6'; 
    return '#ffffff'; 
}

// 渲染已确认锦囊日志
function renderTipLogs() {
    const listEl = document.getElementById('tip-logs-list');
    listEl.innerHTML = '';

    const logs = CURRENT_CONFIG.tipSession.logs || [];
    if (logs.length === 0) {
        listEl.innerHTML = `<li style="color:#666;">暂无抽卡归档历史。在下方翻牌并点击“确认本回合锦囊”后在此生成记录。</li>`;
        return;
    }

    logs.forEach(log => {
        const li = document.createElement('li');
        let tipsHtml = '';
        
        if (log.tips && Array.isArray(log.tips)) {
            tipsHtml = `<div class="log-tips-list">` + log.tips.map(t => {
                const color = getLogQualityColor(t.quality);
                return `<div class="log-tip-item"><span style="color: ${color}; font-weight: bold;"> 【${t.name}】</span><span style="color: #ccc;">(${t.description})</span></div>`;
            }).join('') + `</div>`;
        } else {
            tipsHtml = `<div style="color: #fff; padding-left: 20px;">${log.content || ''}</div>`;
        }

        li.innerHTML = `[${log.time}] (${log.poolName}卡池) 锁定了：${tipsHtml}`;
        listEl.appendChild(li);
    });
}

// ==================== 模块四 (副)：锦囊弹窗管理与 CRUD ====================

function openTipSettings() {
    // 渲染概率数据
    const settings = CURRENT_CONFIG.tipDrawSettings;
    document.getElementById('tip-prob-gold').value = settings.goldProb;
    document.getElementById('tip-prob-purple').value = settings.purpleProb;
    document.getElementById('tip-prob-blue').value = settings.blueProb;
    document.getElementById('tip-prob-white').value = settings.whiteProb;
    document.getElementById('tip-setting-refresh-same').checked = settings.refreshSameQuality !== false;

    validateTipProbs();
    initTipsManageListGrid();
    initTipsCheckboxGrid();

    document.getElementById('tips-settings-modal').classList.add('active');
}

function closeTipSettings() {
    // 保存前校验概率总和
    const sum = validateTipProbs();
    if (sum !== 100) {
        alert(`⚠️ 四个稀有度品质的概率之和必须等于 100%！当前总和为: ${sum}%。请修正后再关闭！`);
        return;
    }

    CURRENT_CONFIG.tipDrawSettings.refreshSameQuality = document.getElementById('tip-setting-refresh-same').checked;
    document.getElementById('tips-settings-modal').classList.remove('active');
    
    saveConfigToLocal();
    initTipDashboard();
}

// 实效计算并校验权重
function validateTipProbs() {
    const gold = parseInt(document.getElementById('tip-prob-gold').value) || 0;
    const purple = parseInt(document.getElementById('tip-prob-purple').value) || 0;
    const blue = parseInt(document.getElementById('tip-prob-blue').value) || 0;
    const white = parseInt(document.getElementById('tip-prob-white').value) || 0;

    const sum = gold + purple + blue + white;
    const indicator = document.getElementById('tip-prob-sum-indicator');
    
    indicator.innerText = `当前总和: ${sum}%`;
    if (sum === 100) {
        indicator.style.color = '#88ff88';
        CURRENT_CONFIG.tipDrawSettings.goldProb = gold;
        CURRENT_CONFIG.tipDrawSettings.purpleProb = purple;
        CURRENT_CONFIG.tipDrawSettings.blueProb = blue;
        CURRENT_CONFIG.tipDrawSettings.whiteProb = white;
    } else {
        indicator.style.color = '#ff3333';
    }
    return sum;
}

function toggleAddTipForm(show) {
    const form = document.getElementById('add-tip-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

// 录入新锦囊
function submitNewTip() {
    const nameInput = document.getElementById('new-tip-name');
    const descInput = document.getElementById('new-tip-description');
    const poolInput = document.getElementById('new-tip-pool');
    const qualInput = document.getElementById('new-tip-quality');

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();
    const pool = poolInput.value;
    const quality = qualInput.value;

    if (!name || !desc) {
        alert("请输入锦囊名称和对应的描述！");
        return;
    }

    if (CURRENT_CONFIG.tips.some(t => t.name === name)) {
        alert("该锦囊名称已在数据库中，请勿重复添加！");
        return;
    }

    CURRENT_CONFIG.tips.push({ name, pool, quality, description: desc });
    // 同步加入激活名单
    if (!CURRENT_CONFIG.activeTipNames.includes(name)) {
        CURRENT_CONFIG.activeTipNames.push(name);
    }
    saveConfigToLocal();

    nameInput.value = '';
    descInput.value = '';

    toggleAddTipForm(false);
    initTipsManageListGrid();
    initTipsCheckboxGrid();
    alert(`锦囊卡【${name}】已成功录入数据库！`);
}

// 后台修改单项值
function updateTipField(index, key, val) {
    if (!CURRENT_CONFIG.tips[index]) return;
    CURRENT_CONFIG.tips[index][key] = val;
    saveConfigToLocal();
}

// 物理彻底删除单张锦囊
function deleteTipFromDB(index) {
    if (CURRENT_CONFIG.tips.length <= 1) {
        alert("数据库里至少需要保留 1 张物理锦囊防止抽卡引擎崩溃！");
        return;
    }
    const name = CURRENT_CONFIG.tips[index].name;
    if (!confirm(`确定要彻底在底层数据库中删除锦囊【${name}】吗？`)) return;

    CURRENT_CONFIG.tips.splice(index, 1);
    // 同步从激活名单中移除
    CURRENT_CONFIG.activeTipNames = CURRENT_CONFIG.activeTipNames.filter(n => n !== name);
    saveConfigToLocal();
    initTipsManageListGrid();
    initTipsCheckboxGrid();
}

// 渲染后台管理表格网格
function initTipsManageListGrid() {
    const container = document.getElementById('tips-manage-list');
    container.innerHTML = '';

    CURRENT_CONFIG.tips.forEach((tip, index) => {
        const row = document.createElement('div');
        row.className = 'option-item';
        row.style.gridTemplateColumns = '1.2fr 0.8fr 1.5fr 2fr 0.5fr';
        row.innerHTML = `
            <select onchange="updateTipField(${index}, 'pool', this.value)" style="background:#222; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:5px;">
                <option value="challenger" ${tip.pool === 'challenger' ? 'selected' : ''}>🛡️ 挑战者</option>
                <option value="champion" ${tip.pool === 'champion' ? 'selected' : ''}>👑 擂主</option>
            </select>
            <select onchange="updateTipField(${index}, 'quality', this.value)" style="background:#222; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:5px;">
                <option value="金" ${tip.quality === '金' ? 'selected' : ''} style="color:#cca43b;">金</option>
                <option value="紫" ${tip.quality === '紫' ? 'selected' : ''} style="color:#9c27b0;">紫</option>
                <option value="蓝" ${tip.quality === '蓝' ? 'selected' : ''} style="color:#2196f3;">蓝</option>
                <option value="白" ${tip.quality === '白' ? 'selected' : ''}>白</option>
            </select>
            <input type="text" value="${tip.name}" oninput="updateTipField(${index}, 'name', this.value)">
            <input type="text" value="${tip.description}" oninput="updateTipField(${index}, 'description', this.value)">
            <button class="delete-btn" onclick="deleteTipFromDB(${index})">🗑️</button>
        `;
        container.appendChild(row);
    });
}


// 锦囊参与抽取勾选网格
function initTipsCheckboxGrid() {
    const container = document.getElementById('tips-checkbox-container');
    if (!container) return;
    container.innerHTML = '';

    CURRENT_CONFIG.tips.forEach(tip => {
        const isChecked = CURRENT_CONFIG.activeTipNames.includes(tip.name);

        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item';
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${tip.name}" ${isChecked ? 'checked' : ''} onchange="onTipCheckboxChange(this)">
                <span>${tip.name}</span>
            </label>
            <button class="hero-delete-btn" title="彻底删除此锦囊" onclick="deleteTipFromDBByName('${tip.name}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

function onTipCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!CURRENT_CONFIG.activeTipNames.includes(name)) {
            CURRENT_CONFIG.activeTipNames.push(name);
        }
    } else {
        CURRENT_CONFIG.activeTipNames = CURRENT_CONFIG.activeTipNames.filter(n => n !== name);
    }
}

function toggleAllTips(selectAll) {
    const checkboxes = document.querySelectorAll('#tips-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onTipCheckboxChange(cb);
    });
}

// 通过名称删除锦囊（供勾选网格的删除按钮调用）
function deleteTipFromDBByName(tipName) {
    const index = CURRENT_CONFIG.tips.findIndex(t => t.name === tipName);
    if (index === -1) return;
    deleteTipFromDB(index);
}

// ==================== 模块五：奖品抽取（顺序变速跑马灯） ====================

function sortPrizes() {
    if (!CURRENT_CONFIG.prizes) return;

    const TIER_ORDER = {
        "特等奖": 1, "一等奖": 2, "二等奖": 3, "三等奖": 4, "四等奖": 5, "五等奖": 6, "六等奖": 7, "安慰奖": 50, "纪念奖": 51
    };

    CURRENT_CONFIG.prizes.sort((a, b) => {
        const orderA = TIER_ORDER[a.tier] || 99;
        const orderB = TIER_ORDER[b.tier] || 99;
        return orderA - orderB;
    });

    saveConfigToLocal();
}

function renderPrizesDisplay() {
    sortPrizes(); 

    const container = document.getElementById('prizes-display-container');
    container.innerHTML = '';

    const list = CURRENT_CONFIG.prizes || [];
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
    if (isPrizeDrawing) return;

    const list = CURRENT_CONFIG.prizes || [];
    if (list.length === 0) {
        alert("奖池内没有任何奖品，请先去配置添加！");
        return;
    }

    isPrizeDrawing = true;
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
                    if (!CURRENT_CONFIG.prizeLogs) {
                        CURRENT_CONFIG.prizeLogs = [];
                    }
                    CURRENT_CONFIG.prizeLogs.unshift(newLog); 
                    saveConfigToLocal();
                    renderPrizeLogs();
                }

                isPrizeDrawing = false;
                document.getElementById('prize-start-btn').disabled = false;
                document.getElementById('prize-start-btn').innerText = "开始抽奖";
            }, 300);
        }
    }

    runStep();
}

function getWeightedPrizeIndex(prizes) {
    const totalWeight = prizes.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < prizes.length; i++) {
        rand -= parseFloat(prizes[i].weight || 0);
        if (rand <= 0) return i;
    }
    return prizes.length - 1;
}

function getFormattedTime() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderPrizeLogs() {
    const listEl = document.getElementById('prize-logs-list');
    listEl.innerHTML = '';

    const logs = CURRENT_CONFIG.prizeLogs || [];
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
    CURRENT_CONFIG.prizeLogs = [];
    saveConfigToLocal();
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
    saveConfigToLocal();
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

    const list = CURRENT_CONFIG.prizes || [];
    const totalWeight = list.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);

    list.forEach((prize, index) => {
        const weightVal = parseFloat(prize.weight || 0);
        const percentage = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(2) : "0.00";

        const row = document.createElement('div');
        row.className = 'option-item';
        row.style.gridTemplateColumns = '1fr 1.6fr 0.8fr 1fr 0.6fr';
        row.innerHTML = `
            <input type="text" value="${prize.tier}" oninput="updatePrizeField(${index}, 'tier', this.value)" placeholder="等阶" style="width:100%;">
            <input type="text" value="${prize.name}" oninput="updatePrizeField(${index}, 'name', this.value)" placeholder="名称" style="width:100%;">
            <input type="number" step="any" min="0.1" value="${prize.weight}" oninput="updatePrizeField(${index}, 'weight', this.value)" placeholder="权重" style="width:100%;">
            <span style="color:#e3a94a; font-weight:bold; font-size:13px; text-align:center;">${percentage}%</span>
            <button class="delete-btn" onclick="deletePrizeFromDB(${index})">🗑️</button>
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

    if (!CURRENT_CONFIG.prizes) {
        CURRENT_CONFIG.prizes = [];
    }

    CURRENT_CONFIG.prizes.push({
        tier: tier,
        name: name,
        weight: weightVal
    });

    sortPrizes(); 
    saveConfigToLocal();

    tierInput.value = '';
    nameInput.value = '';
    weightInput.value = '';

    toggleAddPrizeForm(false);
    initPrizesManageList();
}

function updatePrizeField(index, key, val) {
    if (!CURRENT_CONFIG.prizes[index]) return;

    if (key === 'weight') {
        const num = parseFloat(val);
        CURRENT_CONFIG.prizes[index][key] = isNaN(num) || num <= 0 ? 0.1 : num;
    } else {
        CURRENT_CONFIG.prizes[index][key] = val;
    }
    saveConfigToLocal();

    // 修改等阶后立即重新排序，保持展示顺序一致
    if (key === 'tier') {
        sortPrizes();
        initPrizesManageList();
        return;
    }

    const list = CURRENT_CONFIG.prizes || [];
    const totalWeight = list.reduce((sum, p) => sum + parseFloat(p.weight || 0), 0);
    const rows = document.getElementById('prizes-manage-list').children;
    if (rows[index]) {
        const weightVal = parseFloat(CURRENT_CONFIG.prizes[index].weight || 0);
        const percentage = totalWeight > 0 ? ((weightVal / totalWeight) * 100).toFixed(2) : "0.00";
        const percentSpan = rows[index].children[3];
        if (percentSpan) {
            percentSpan.innerText = `${percentage}%`;
        }
    }
}

function deletePrizeFromDB(index) {
    if (CURRENT_CONFIG.prizes.length <= 1) {
        alert("奖池最少需要保留一个物理奖品以防框架报错！");
        return;
    }
    if (!confirm(`确定要彻底删除该奖项吗？`)) return;

    CURRENT_CONFIG.prizes.splice(index, 1);
    saveConfigToLocal();
    initPrizesManageList();
}


// ==================== 模块六：通用大转盘 (Canvas - 重构版) ====================

let canvas, ctx;
let currentRotation = 0; 

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function syncPresetWheels() {
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
            getSourceItems: () => CURRENT_CONFIG.heroes.map(h => ({ name: h.name, weight: 1 }))
        },
        {
            id: "preset_melee",
            name: "二、近战武器转盘",
            getSourceItems: () => CURRENT_CONFIG.weapons.filter(w => w.type === 'melee').map(w => ({ name: w.name, weight: 1 }))
        },
        {
            id: "preset_ranged",
            name: "三、远程武器转盘",
            getSourceItems: () => CURRENT_CONFIG.weapons.filter(w => w.type === 'ranged').map(w => ({ name: w.name, weight: 1 }))
        },
        {
            id: "preset_player",
            name: "四、人员转盘",
            getSourceItems: () => CURRENT_CONFIG.players.map(p => ({ name: p.name, weight: 1 }))
        },
        {
            id: "preset_prize",
            name: "五、奖品转盘",
            getSourceItems: () => (CURRENT_CONFIG.prizes || []).map(p => ({ name: p.name, weight: p.weight || 1 }))
        }
    ];

    if (!CURRENT_CONFIG.wheelsList) {
        CURRENT_CONFIG.wheelsList = [];
    }

    const validPresetIds = ["preset_hero", "preset_melee", "preset_ranged", "preset_player", "preset_prize"];
    CURRENT_CONFIG.wheelsList = CURRENT_CONFIG.wheelsList.filter(w => {
        if (w.id.startsWith("preset_") && !validPresetIds.includes(w.id)) {
            return false; 
        }
        return true;
    });

    presetDefinitions.forEach(def => {
        let existingWheel = CURRENT_CONFIG.wheelsList.find(w => w.id === def.id);
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
            CURRENT_CONFIG.wheelsList.push({
                id: def.id,
                name: def.name,
                isDuplicateAllowed: true,
                items: newItems
            });
        }
    });

    CURRENT_CONFIG.wheelsList.forEach(wheel => {
        wheel.items.forEach(item => {
            if (item.checked === undefined) {
                item.checked = true;
            }
        });
    });

    CURRENT_CONFIG.wheelsList.sort((a, b) => {
        const idxA = validPresetIds.indexOf(a.id);
        const idxB = validPresetIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB; 
        if (idxA !== -1) return -1; 
        if (idxB !== -1) return 1;
        return 0; 
    });

    saveConfigToLocal();
}

function initWheelSelector() {
    const select = document.getElementById('wheel-select');
    select.innerHTML = '';
    
    CURRENT_CONFIG.wheelsList.forEach((wheel, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = wheel.name;
        select.appendChild(opt);
    });

    loadSelectedWheel();
}

function loadSelectedWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    document.getElementById('wheel-duplicate-toggle').checked = activeWheel.isDuplicateAllowed !== false;

    renderWheelConfigPanel(activeWheel);

    canvas = document.getElementById('wheel-canvas');
    ctx = canvas.getContext('2d');
    drawWheel(activeWheel);
}

function drawWheel(wheel) {
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

function spinWheel() {
    if (isSpinning) return;

    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

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
                    saveConfigToLocal();
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

function renderWheelConfigPanel(wheel) {
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
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSingleWheelItem(${index}, this.checked)" style="width:20px; height:20px; cursor:pointer; justify-self: center;">
            <input type="text" value="${item.name}" oninput="updateWheelItem(${index}, 'name', this.value)">
            <input type="number" step="any" min="0.1" value="${item.weight}" oninput="updateWheelItem(${index}, 'weight', this.value)">
            <input type="color" value="${item.color}" onchange="updateWheelItem(${index}, 'color', this.value)">
            <button class="delete-btn" onclick="deleteWheelItem(${index})">🗑️</button>
        `;
        listContainer.appendChild(itemRow);
    });
}

function toggleSingleWheelItem(index, isChecked) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.items[index].checked = isChecked;
    saveConfigToLocal();
    drawWheel(activeWheel);
    renderWheelConfigPanel(activeWheel);
}

function updateWheelItem(itemIndex, key, val) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    if (key === 'weight') {
        const num = parseFloat(val);
        activeWheel.items[itemIndex][key] = isNaN(num) || num <= 0 ? 0.1 : num;
    } else {
        activeWheel.items[itemIndex][key] = val;
    }

    saveConfigToLocal();
    drawWheel(activeWheel); 
}

function toggleAllWheelItems(checked) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.items.forEach(item => {
        item.checked = checked;
    });

    saveConfigToLocal();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

function shuffleWheelItems() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    for (let i = activeWheel.items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = activeWheel.items[i];
        activeWheel.items[i] = activeWheel.items[j];
        activeWheel.items[j] = temp;
    }

    saveConfigToLocal();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

function toggleDuplicate() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    activeWheel.isDuplicateAllowed = document.getElementById('wheel-duplicate-toggle').checked;
    saveConfigToLocal();
}

function addWheelItem() {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    const randomHue = Math.floor(Math.random() * 360);
    const randColor = hslToHex(randomHue, 70, 50);

    const newItem = {
        name: `选项${activeWheel.items.length + 1}`,
        weight: 1,
        color: randColor,
        checked: true
    };

    activeWheel.items.push(newItem);
    saveConfigToLocal();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

function deleteWheelItem(itemIndex) {
    const select = document.getElementById('wheel-select');
    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    if (activeWheel.items.length <= 1) {
        alert("转盘中至少需要保留 1 个选项！");
        return;
    }

    activeWheel.items.splice(itemIndex, 1);
    saveConfigToLocal();
    renderWheelConfigPanel(activeWheel);
    drawWheel(activeWheel);
}

function createNewWheel() {
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

    if (!CURRENT_CONFIG.wheelsList) {
        CURRENT_CONFIG.wheelsList = [];
    }

    CURRENT_CONFIG.wheelsList.push(newWheel);
    saveConfigToLocal();

    initWheelSelector();
    
    const select = document.getElementById('wheel-select');
    select.value = CURRENT_CONFIG.wheelsList.length - 1;
    loadSelectedWheel();
}

function renameCurrentWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    const newName = prompt(`请输入转盘【${activeWheel.name}】的新名称：`, activeWheel.name);
    if (!newName || !newName.trim()) return;

    activeWheel.name = newName.trim();
    saveConfigToLocal();
    
    initWheelSelector();
    select.value = wheelIndex;
    loadSelectedWheel();
}

function deleteCurrentWheel() {
    const select = document.getElementById('wheel-select');
    if (select.options.length === 0) return;

    const wheelIndex = parseInt(select.value);
    const activeWheel = CURRENT_CONFIG.wheelsList[wheelIndex];

    if (activeWheel.id.startsWith("preset_")) {
        alert("系统默认的系统预设大转盘无法直接删除哦！若有需要，可通过选项勾选来进行定制。");
        return;
    }

    if (!confirm(`确定要彻底删除该自定义转盘【${activeWheel.name}】吗？`)) {
        return;
    }

    CURRENT_CONFIG.wheelsList.splice(wheelIndex, 1);
    saveConfigToLocal();
    initWheelSelector();
}


// ==================== 模块七：计分板 ====================

// ── 数据辅助函数 ──

function getSBPlayerCount(mode) {
    return mode === '12' ? 12 : 8;
}

function getRankingPoints(rank, mode) {
    const r = parseFloat(rank) || 0;
    const sb = CURRENT_CONFIG.scoreboard;
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    let rules = sb[rulesKey];

    // 防御：如果规则不存在或为空，使用内置默认
    if (!rules || rules.length === 0) {
        rules = getDefaultRankingRules(mode);
    }

    // 按 minRank 从小到大遍历，找到第一个匹配的规则
    for (const rule of rules) {
        if (r >= rule.minRank && r <= rule.maxRank) {
            return parseFloat(rule.points) || 0;
        }
    }
    return 0;
}

function getDefaultRankingRules(mode) {
    if (mode === '12') {
        return [
            { minRank: 1, maxRank: 1, points: 4.0 },
            { minRank: 2, maxRank: 2, points: 3.0 },
            { minRank: 3, maxRank: 3, points: 2.5 },
            { minRank: 4, maxRank: 4, points: 2.0 },
            { minRank: 5, maxRank: 6, points: 1.5 },
            { minRank: 7, maxRank: 8, points: 1.0 },
            { minRank: 9, maxRank: 10, points: 0.5 },
            { minRank: 11, maxRank: 99, points: 0 }
        ];
    }
    return [
        { minRank: 1, maxRank: 1, points: 2.5 },
        { minRank: 2, maxRank: 2, points: 1.0 },
        { minRank: 3, maxRank: 4, points: 0.5 },
        { minRank: 5, maxRank: 99, points: 0 }
    ];
}

function buildDefaultEntries(count) {
    const entries = [];
    for (let i = 0; i < count; i++) {
        entries.push({ rank: count, name: '', kills: 0, hero: '', eliminated: false, eliminatedAt: null });
    }
    return entries;
}

// 向后兼容：为旧数据补全缺失字段
function ensureEntryFields(entry) {
    if (entry.hero === undefined) entry.hero = '';
    if (entry.eliminated === undefined) entry.eliminated = false;
    if (entry.eliminatedAt === undefined) entry.eliminatedAt = null;
}

function normalizeAllRounds() {
    const modes = ['8', '12'];
    modes.forEach(m => {
        const key = m === '12' ? 'rounds12' : 'rounds8';
        const rounds = CURRENT_CONFIG.scoreboard[key];
        if (!rounds) return;
        rounds.forEach(round => {
            if (!round.entries) return;
            round.entries.forEach(entry => ensureEntryFields(entry));
        });
    });
}

// 根据英雄名获取图片路径
function getHeroImage(heroName) {
    if (!heroName) return '';
    const hero = CURRENT_CONFIG.heroes.find(h => h.name === heroName);
    return hero ? hero.image : '';
}

// JS字符串转义（用于onclick属性）
function escapeJS(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ── 英雄选择器 ──

function openHeroPicker(roundIndex, entryIndex) {
    heroPickerRoundIndex = roundIndex;
    heroPickerEntryIndex = entryIndex;
    const grid = document.getElementById('hero-picker-grid');
    if (!grid) return;

    const rounds = getActiveRounds();
    const currentHero = rounds[roundIndex].entries[entryIndex].hero || '';

    let html = '';
    CURRENT_CONFIG.heroes.forEach(h => {
        const selected = (h.name === currentHero) ? ' selected' : '';
        html += `<div class="hero-picker-item${selected}" onclick="selectHeroForEntry('${escapeJS(h.name)}')">
            <img src="${h.image}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="avatar-fallback" style="display:none;width:44px;height:44px;border-radius:50%;background:rgba(179,134,59,0.2);align-items:center;justify-content:center;font-size:18px;color:#e3a94a;">${h.name[0]}</div>
            <span>${escapeHTML(h.name)}</span>
        </div>`;
    });
    grid.innerHTML = html;
    document.getElementById('hero-picker-modal').classList.add('active');
}

function selectHeroForEntry(heroName) {
    const rounds = getActiveRounds();
    if (rounds[heroPickerRoundIndex] && rounds[heroPickerRoundIndex].entries[heroPickerEntryIndex]) {
        rounds[heroPickerRoundIndex].entries[heroPickerEntryIndex].hero = heroName;
        saveConfigToLocal();
        renderRoundEditor(heroPickerRoundIndex);
    }
    closeHeroPicker();
}

function clearHeroForEntry() {
    selectHeroForEntry('');
}

function closeHeroPicker() {
    document.getElementById('hero-picker-modal').classList.remove('active');
    heroPickerRoundIndex = -1;
    heroPickerEntryIndex = -1;
}

// ── 动态排名计算 ──

function computeDynamicRanks(entries) {
    // 只处理有名字的活跃选手
    const active = entries.filter(e => e.name.trim() !== '');

    // 初始化 elimination counter（基于已有数据）
    globalEliminationCounter = 0;
    active.forEach(e => {
        if (e.eliminated && e.eliminatedAt === null) {
            globalEliminationCounter++;
            e.eliminatedAt = globalEliminationCounter;
        } else if (e.eliminated && e.eliminatedAt > globalEliminationCounter) {
            globalEliminationCounter = e.eliminatedAt;
        }
    });

    const survivors = active.filter(e => !e.eliminated);
    const eliminated = active.filter(e => e.eliminated);
    const survivorCount = survivors.length;

    // 淘汰者按 eliminatedAt 升序排列（先淘汰=值小=名次差）
    eliminated.sort((a, b) => (a.eliminatedAt || 0) - (b.eliminatedAt || 0));

    // 存活者：排名 = 当前存活人数
    survivors.forEach(e => { e._dynamicRank = survivorCount; });

    // 淘汰者：排名从 survivorCount+1 开始，最后淘汰的排最前
    eliminated.forEach((e, i) => {
        e._dynamicRank = survivorCount + eliminated.length - i;
    });

    // 合并并按 _dynamicRank 升序排列
    const ranked = [...survivors, ...eliminated].sort((a, b) => a._dynamicRank - b._dynamicRank);

    return { ranked, survivorCount };
}

// ── 淘汰状态切换（悬浮窗用） ──

function toggleElimination(playerName) {
    // 读取最新 localStorage 数据
    const cached = localStorage.getItem("UP_LOTTERY_SMART_CACHE");
    if (!cached) return;
    let config;
    try { config = JSON.parse(cached); } catch (e) { return; }

    const mode = config.scoreboard.currentMode || '8';
    const roundsKey = mode === '12' ? 'rounds12' : 'rounds8';
    const rounds = config.scoreboard[roundsKey];
    const roundIndex = config.scoreboard.currentRoundIndex || 0;
    const round = rounds[roundIndex];
    if (!round) return;

    // 兼容性补全
    round.entries.forEach(e => ensureEntryFields(e));

    const entry = round.entries.find(e => e.name.trim() === playerName);
    if (!entry) return;

    // 切换淘汰状态
    if (entry.eliminated) {
        // 恢复
        entry.eliminated = false;
        entry.eliminatedAt = null;
    } else {
        // 淘汰
        entry.eliminated = true;
        globalEliminationCounter++;
        entry.eliminatedAt = globalEliminationCounter;
    }

    // 重新计算动态排名并回写到 rank 字段
    const { ranked } = computeDynamicRanks(round.entries);
    ranked.forEach(e => {
        e.rank = e._dynamicRank;
    });

    // 持久化
    localStorage.setItem("UP_LOTTERY_SMART_CACHE", JSON.stringify(config));

    // 更新内存状态
    CURRENT_CONFIG = config;
    currentScoreboardRoundIndex = roundIndex;

    renderOverlayLeaderboard();
}

// ── FLIP 动画 ──

function applyFlipAnimation(tbody, newHtml) {
    // 首次渲染跳过动画
    if (!overlayFlipEnabled) {
        tbody.innerHTML = newHtml;
        overlayFlipEnabled = true;
        return;
    }

    // 1. First: 记录所有现有行的当前位置
    const oldRows = tbody.querySelectorAll('tr[data-player]');
    const firstPositions = {};
    oldRows.forEach(row => {
        const name = row.getAttribute('data-player');
        if (name) firstPositions[name] = row.getBoundingClientRect().top;
    });

    // 2. Last: 更新 DOM
    tbody.innerHTML = newHtml;

    // 3. Invert & 4. Play
    requestAnimationFrame(() => {
        const newRows = tbody.querySelectorAll('tr[data-player]');
        const animatingRows = [];

        newRows.forEach(row => {
            const name = row.getAttribute('data-player');
            if (firstPositions[name] !== undefined) {
                const newTop = row.getBoundingClientRect().top;
                const deltaY = firstPositions[name] - newTop;
                if (Math.abs(deltaY) > 0.5) {
                    row.style.transform = `translateY(${deltaY}px)`;
                    row.style.transition = 'none';
                    animatingRows.push(row);
                }
            }
        });

        if (animatingRows.length > 0) {
            requestAnimationFrame(() => {
                animatingRows.forEach(row => {
                    row.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    row.style.transform = 'translateY(0)';
                });

                setTimeout(() => {
                    animatingRows.forEach(row => {
                        row.style.transition = '';
                        row.style.transform = '';
                    });
                }, 450);
            });
        }
    });
}

function getActiveMode() {
    return CURRENT_CONFIG.scoreboard.currentMode;
}

function getActiveRounds() {
    const mode = getActiveMode();
    normalizeAllRounds(); // 每次读取时兜底补全旧数据字段
    return mode === '12' ? CURRENT_CONFIG.scoreboard.rounds12 : CURRENT_CONFIG.scoreboard.rounds8;
}

// ── 初始化与切换 ──

function initScoreboardDashboard() {
    const sb = CURRENT_CONFIG.scoreboard;
    if (!sb) {
        CURRENT_CONFIG.scoreboard = {
            currentMode: '8',
            rounds8: [],
            rounds12: []
        };
    }

    const rounds = getActiveRounds();
    const playerCount = getSBPlayerCount(getActiveMode());

    // 确保至少有 6 个默认空回合
    if (rounds.length === 0) {
        for (let i = 0; i < 6; i++) {
            rounds.push({
                rankingPointsEnabled: true,
                confirmed: false,
                entries: buildDefaultEntries(playerCount)
            });
        }
        saveConfigToLocal();
    }

    // 同步子 tab 高亮
    document.getElementById('sb-sub-8').classList.toggle('active', getActiveMode() === '8');
    document.getElementById('sb-sub-12').classList.toggle('active', getActiveMode() === '12');

    // 同步全局排名分勾选框
    if (CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled === undefined) {
        CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled = true;
    }
    document.getElementById('sb-ranking-toggle').checked = CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;

    // 重置选中回合
    if (currentScoreboardRoundIndex >= rounds.length) {
        currentScoreboardRoundIndex = 0;
    }
    // 从持久化数据恢复当前回合索引（悬浮窗同步用）
    if (CURRENT_CONFIG.scoreboard.currentRoundIndex !== undefined &&
        CURRENT_CONFIG.scoreboard.currentRoundIndex < rounds.length) {
        currentScoreboardRoundIndex = CURRENT_CONFIG.scoreboard.currentRoundIndex;
    }

    renderRoundTabs();
    renderRoundEditor(currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

function switchScoreboardMode(mode) {
    if (mode === getActiveMode()) return;

    CURRENT_CONFIG.scoreboard.currentMode = mode;
    const rounds = getActiveRounds();
    const playerCount = getSBPlayerCount(mode);

    if (rounds.length === 0) {
        for (let i = 0; i < 6; i++) {
            rounds.push({
                rankingPointsEnabled: true,
                confirmed: false,
                entries: buildDefaultEntries(playerCount)
            });
        }
    }

    currentScoreboardRoundIndex = 0;
    CURRENT_CONFIG.scoreboard.currentRoundIndex = 0;
    saveConfigToLocal();
    initScoreboardDashboard();
}

// ── 回合选择器 ──

function renderRoundTabs() {
    const container = document.getElementById('scoreboard-round-tabs');
    const rounds = getActiveRounds();

    let html = '';
    rounds.forEach((round, index) => {
        const activeClass = index === currentScoreboardRoundIndex ? ' active' : '';
        const hasData = round.entries.some(e => e.name.trim() !== '') ? ' has-data' : '';
        const confirmed = round.confirmed ? ' ✅' : '';
        html += `<button class="sb-round-tab${activeClass}${hasData}" onclick="selectScoreboardRound(${index})">第${index + 1}局${confirmed}</button>`;
    });

    // 操作按钮组
    html += `<div style="display:flex; gap:4px; margin-top:8px;">`;
    html += `<button class="sb-round-tab" onclick="addScoreboardRound()" style="flex:1; border-style:dashed; color:#88ff88; border-color:rgba(136,255,136,0.4);">＋ 添加</button>`;
    html += `<button class="sb-round-tab" onclick="deleteScoreboardRound(${currentScoreboardRoundIndex})" style="flex:1; color:#ff9999; border-color:rgba(255,153,153,0.3);" title="删除当前选中的回合">🗑️ 删除</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

function selectScoreboardRound(index) {
    currentScoreboardRoundIndex = index;
    // 持久化当前回合索引（悬浮窗同步需要）
    CURRENT_CONFIG.scoreboard.currentRoundIndex = index;
    saveConfigToLocal();
    renderRoundTabs();
    renderRoundEditor(index);
}

// ── 回合编辑器 ──

function renderRoundEditor(roundIndex) {
    const container = document.getElementById('scoreboard-round-editor');
    const rounds = getActiveRounds();
    const mode = getActiveMode();

    if (!rounds[roundIndex]) {
        container.innerHTML = '<p style="color:#666; text-align:center; padding:30px;">暂无回合数据，请点击 ＋ 添加回合。</p>';
        return;
    }

    const round = rounds[roundIndex];
    const entries = round.entries;

    let html = `
        <div class="sb-editor-title-row">
            <h4>第 ${roundIndex + 1} 局 · 编辑</h4>
            <div style="display:flex; gap:10px;">
                <button class="small-btn" onclick="refreshRoundRankingTable(${roundIndex})" style="font-weight:bold;">📊 生成本局排名</button>
                <button class="small-btn" onclick="confirmScoreboardRound(${roundIndex})" style="font-weight:bold; padding:8px 20px;">✅ 确认本局</button>
            </div>
        </div>
        <div class="sb-entries-header">
            <span>排名</span>
            <span>选手名称</span>
            <span>击败数</span>
            <span>本局英雄</span>
        </div>
    `;

    entries.forEach((entry, entryIndex) => {
        const heroImgHtml = entry.hero
            ? `<img src="${getHeroImage(entry.hero)}" class="sb-hero-thumb"
                 onclick="openHeroPicker(${roundIndex}, ${entryIndex})"
                 onerror="this.outerHTML='<div class=\\'sb-hero-placeholder\\' onclick=\\'openHeroPicker(${roundIndex},${entryIndex})\\'>?</div>'"
                 title="${escapeHTML(entry.hero)}">`
            : `<div class="sb-hero-placeholder" onclick="openHeroPicker(${roundIndex}, ${entryIndex})" title="点击选择英雄">?</div>`;

        html += `
            <div class="sb-entry-row">
                <input type="number" class="sb-rank-input" value="${entry.rank}"
                    min="1" step="1"
                    onchange="onRoundEntryChange(${roundIndex}, ${entryIndex}, 'rank', this.value)"
                    title="可修改名次（处理并列场景）">
                <input type="text" class="sb-name-input" value="${escapeHTML(entry.name)}"
                    placeholder="输入选手名称"
                    onchange="onRoundEntryChange(${roundIndex}, ${entryIndex}, 'name', this.value)">
                <input type="number" class="sb-kills-input" value="${entry.kills}"
                    min="0" step="1"
                    onchange="onRoundEntryChange(${roundIndex}, ${entryIndex}, 'kills', this.value)">
                <div class="sb-hero-cell">${heroImgHtml}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 生成本局排名（弹窗模式）
function refreshRoundRankingTable(roundIndex) {
    const rounds = getActiveRounds();
    const mode = getActiveMode();
    const round = rounds[roundIndex];
    if (!round) return;

    const rankingEnabled = CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;
    const entries = round.entries.filter(e => e.name.trim() !== '');

    document.getElementById('round-ranking-modal-title').textContent = `📊 第 ${roundIndex + 1} 局 · 本局排名`;

    if (entries.length === 0) {
        document.getElementById('round-ranking-modal-content').innerHTML =
            '<p style="color:#888; text-align:center; padding:30px;">本局暂无选手数据，请先填入选手名称。</p>';
    } else {
        const ranked = entries.map(e => ({
            name: e.name.trim(),
            rank: parseFloat(e.rank) || (entries.indexOf(e) + 1),
            kills: parseInt(e.kills) || 0,
            rankingPoints: rankingEnabled ? getRankingPoints(e.rank, mode) : 0
        }));
        ranked.forEach(r => { r.totalScore = r.kills + r.rankingPoints; });
        ranked.sort((a, b) => b.totalScore - a.totalScore);

        let html = '<table class="sb-round-ranking-table"><thead><tr>';
        html += '<th>排名</th><th>选手</th><th>击败分</th>';
        if (rankingEnabled) html += '<th>排名分</th>';
        html += '<th>本局分数</th></tr></thead><tbody>';

        ranked.forEach((r, idx) => {
            html += '<tr>';
            html += `<td class="srr-rank-col">${idx + 1}</td>`;
            html += `<td>${escapeHTML(r.name)}</td>`;
            html += `<td>${r.kills}</td>`;
            if (rankingEnabled) html += `<td>${r.rankingPoints}</td>`;
            html += `<td class="srr-total-col">${r.totalScore}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        document.getElementById('round-ranking-modal-content').innerHTML = html;
    }

    document.getElementById('round-ranking-modal').classList.add('active');
}

function closeRoundRanking() {
    document.getElementById('round-ranking-modal').classList.remove('active');
}

// 重置全部计分数据
function resetScoreboardAll() {
    if (!confirm('⚠️ 确定要清空所有计分板数据吗？\n\n这将删除所有回合的选手名称、击败数和排名记录。此操作不可撤销！')) return;

    const sb = CURRENT_CONFIG.scoreboard;
    const mode = getActiveMode();
    const playerCount = getSBPlayerCount(mode);

    // 清空并重建默认数据
    sb.rounds8 = [];
    sb.rounds12 = [];
    sb.globalRankingPointsEnabled = true;

    const rounds = getActiveRounds();
    for (let i = 0; i < 6; i++) {
        rounds.push({
            rankingPointsEnabled: true,
            entries: buildDefaultEntries(playerCount)
        });
    }

    currentScoreboardRoundIndex = 0;
    saveConfigToLocal();

    // 刷新全部 UI
    document.getElementById('sb-ranking-toggle').checked = true;
    renderRoundTabs();
    renderRoundEditor(0);
    renderScoreboardLeaderboard();
}

function onRoundEntryChange(roundIndex, entryIndex, field, value) {
    const rounds = getActiveRounds();
    if (!rounds[roundIndex] || !rounds[roundIndex].entries[entryIndex]) return;

    if (field === 'rank') {
        let val = parseFloat(value);
        if (isNaN(val) || val < 1) val = entryIndex + 1;
        rounds[roundIndex].entries[entryIndex].rank = val;
    } else if (field === 'kills') {
        let val = parseInt(value);
        if (isNaN(val) || val < 0) val = 0;
        rounds[roundIndex].entries[entryIndex].kills = val;
    } else if (field === 'name') {
        rounds[roundIndex].entries[entryIndex].name = value.trim();
    }

    saveConfigToLocal();
    // 更新回合 tab 的数据指示器
    renderRoundTabs();
}

function confirmScoreboardRound(roundIndex) {
    const rounds = getActiveRounds();
    const round = rounds[roundIndex];
    if (!round) return;

    // 校验：至少有一个非空选手名
    const hasName = round.entries.some(e => e.name.trim() !== '');
    if (!hasName) {
        alert('⚠️ 请至少填入一位选手名称后再确认！');
        return;
    }

    // 标记为已确认（防止自动填充的名称被计入排行榜）
    round.confirmed = true;

    saveConfigToLocal();
    renderScoreboardLeaderboard();

    // 自动填充下一局的选手名称（若下一局尚为空）
    const nextIndex = roundIndex + 1;
    if (nextIndex < rounds.length) {
        const nextRound = rounds[nextIndex];
        const nextHasNames = nextRound.entries.some(e => e.name.trim() !== '');
        if (!nextHasNames) {
            round.entries.forEach((entry, i) => {
                if (i < nextRound.entries.length) {
                    nextRound.entries[i].name = entry.name;
                    nextRound.entries[i].hero = entry.hero || '';
                }
            });
            saveConfigToLocal();
            // 如果当前正在编辑的就是下一局，刷新编辑器
            if (currentScoreboardRoundIndex === nextIndex) {
                renderRoundEditor(nextIndex);
            }
        }
    }

    // 回合 tab 闪烁反馈
    renderRoundTabs();
    const tabs = document.querySelectorAll('.sb-round-tab');
    if (tabs[roundIndex]) {
        tabs[roundIndex].classList.add('confirm-flash');
        setTimeout(() => {
            tabs[roundIndex].classList.remove('confirm-flash');
        }, 1000);
    }
}

function addScoreboardRound() {
    const rounds = getActiveRounds();
    const playerCount = getSBPlayerCount(getActiveMode());

    const newRound = {
        rankingPointsEnabled: true,
        entries: buildDefaultEntries(playerCount)
    };

    // 从最后一个回合复制选手名称和英雄
    if (rounds.length > 0) {
        const lastRound = rounds[rounds.length - 1];
        lastRound.entries.forEach((entry, i) => {
            if (i < newRound.entries.length) {
                newRound.entries[i].name = entry.name;
                newRound.entries[i].hero = entry.hero || '';
            }
        });
    }

    rounds.push(newRound);
    currentScoreboardRoundIndex = rounds.length - 1;
    saveConfigToLocal();

    renderRoundTabs();
    renderRoundEditor(currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

function deleteScoreboardRound(roundIndex) {
    const rounds = getActiveRounds();
    if (rounds.length <= 1) {
        alert('至少需要保留 1 个回合！');
        return;
    }

    if (!confirm(`确定要删除第 ${roundIndex + 1} 局的全部数据吗？此操作不可撤销！`)) return;

    rounds.splice(roundIndex, 1);

    if (currentScoreboardRoundIndex >= rounds.length) {
        currentScoreboardRoundIndex = rounds.length - 1;
    }

    saveConfigToLocal();
    renderRoundTabs();
    renderRoundEditor(currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

// ── 排名分开关 ──

function toggleRankingPoints(checked) {
    CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled = checked;
    saveConfigToLocal();
    renderScoreboardLeaderboard();
}

// ── 排行榜计算与渲染 ──

function computeLeaderboard() {
    const rounds = getActiveRounds();
    const mode = getActiveMode();
    const playerMap = {}; // key: normalized name → { name, roundScores: [], totalKills, totalRankingPoints }

    rounds.forEach((round, roundIndex) => {
        if (!round.confirmed) return; // 跳过未确认的回合（如仅自动填充了名称）
        round.entries.forEach(entry => {
            const name = entry.name.trim();
            if (!name) return;

            if (!playerMap[name]) {
                playerMap[name] = {
                    name: name,
                    roundScores: [],  // sparse array indexed by round
                    totalKills: 0,
                    totalRankingPoints: 0
                };
            }

            const player = playerMap[name];
            const kills = parseInt(entry.kills) || 0;
            const rp = CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled ? getRankingPoints(entry.rank, mode) : 0;
            const score = kills + rp;

            player.roundScores[roundIndex] = score;
            player.totalKills += kills;
            player.totalRankingPoints += rp;
        });
    });

    // 转为数组，填充缺失的 roundScores
    const list = Object.values(playerMap).map(p => {
        const filledScores = [];
        for (let i = 0; i < rounds.length; i++) {
            filledScores.push(p.roundScores[i] !== undefined ? p.roundScores[i] : null);
        }
        return {
            name: p.name,
            roundScores: filledScores,
            totalScore: p.totalKills + p.totalRankingPoints,
            totalKills: p.totalKills,
            totalRankingPoints: p.totalRankingPoints
        };
    });

    // 按总分降序排列
    list.sort((a, b) => b.totalScore - a.totalScore);

    // 分配排名（处理并列）
    let currentRank = 1;
    let prevScore = null;
    list.forEach((player, idx) => {
        if (prevScore !== null && player.totalScore < prevScore) {
            currentRank = idx + 1;
        }
        player.leaderboardRank = currentRank;
        prevScore = player.totalScore;
    });

    return list;
}

function renderScoreboardLeaderboard() {
    const container = document.getElementById('scoreboard-leaderboard-content');
    const leaderboard = computeLeaderboard();

    if (leaderboard.length === 0) {
        container.innerHTML = '<p style="color:#666; text-align:center; padding:30px;">暂无数据，请先确认回合成绩。</p>';
        return;
    }

    let html = '<table class="sb-leaderboard-table"><thead><tr>';
    html += '<th>排名</th><th>选手</th><th>总积分</th></tr></thead><tbody>';

    leaderboard.forEach(player => {
        // 排名前三用奖牌表情
        let rankDisplay = player.leaderboardRank;
        if (player.leaderboardRank === 1) rankDisplay = '🥇';
        else if (player.leaderboardRank === 2) rankDisplay = '🥈';
        else if (player.leaderboardRank === 3) rankDisplay = '🥉';

        html += '<tr>';
        html += `<td class="sb-rank-col">${rankDisplay}</td>`;
        html += `<td class="sb-name-col">${escapeHTML(player.name)}</td>`;
        html += `<td class="sb-total-col">${player.totalScore}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}


// ── 悬浮窗 OBS 纯净排行榜 ──

function openOverlayWindow(scope) {
    // scope = 'current' | 'global'，默认 'global' 兼容旧行为
    scope = scope || 'global';

    // 保存当前回合索引到持久化数据
    CURRENT_CONFIG.scoreboard.currentRoundIndex = currentScoreboardRoundIndex;
    saveConfigToLocal();

    const url = new URL(window.location.href);
    url.searchParams.set('view', 'overlay');
    url.searchParams.set('scope', scope);

    const width = 280;
    const height = 600; // 两个悬浮窗统一高度
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    // 使用不同的窗口名便于 OBS/直播伴侣 窗口捕获识别
    const windowName = scope === 'current' ? 'YJWJ-本局排名' : 'YJWJ-总排名';

    // 若窗口已存在则直接聚焦，不重复打开
    const existingWin = scope === 'current' ? currentOverlayWin : globalOverlayWin;
    if (existingWin && !existingWin.closed) {
        existingWin.focus();
        return;
    }

    const newWin = window.open(
        url.toString(),
        windowName,
        `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );

    // 保存窗口引用
    if (scope === 'current') {
        currentOverlayWin = newWin;
    } else {
        globalOverlayWin = newWin;
    }

    // 打开新窗口后，重新聚焦另一个悬浮窗，防止被挤到后台
    const otherWin = scope === 'current' ? globalOverlayWin : currentOverlayWin;
    if (otherWin && !otherWin.closed) {
        setTimeout(() => { otherWin.focus(); }, 200);
    }
}

function initOverlayMode() {
    document.body.classList.add('overlay-mode');

    // 检测 scope 参数
    const urlParams = new URLSearchParams(window.location.search);
    const scope = urlParams.get('scope') || 'global';

    // 设置窗口标题，便于 OBS/直播伴侣 窗口采集时区分
    document.title = scope === 'current' ? 'YJWJ-本局排名' : 'YJWJ-总排名';

    const navBar = document.querySelector('.nav-bar');
    if (navBar) navBar.style.display = 'none';

    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) mainContainer.style.display = 'none';

    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

    const overlayContainer = document.getElementById('overlay-container');
    if (overlayContainer) overlayContainer.style.display = 'flex';

    // 根据 scope 动态设置标题
    const title = document.querySelector('.overlay-title');
    if (title) {
        title.textContent = scope === 'current' ? '⚔️ 本局积分排行榜' : '🏆 总积分排行榜';
    }

    const cached = localStorage.getItem("UP_LOTTERY_SMART_CACHE");
    if (!cached) {
        document.getElementById('overlay-leaderboard-table').style.display = 'none';
        document.getElementById('overlay-empty-hint').style.display = 'block';
        return;
    }

    const config = JSON.parse(cached);
    if (config && config.scoreboard && config.scoreboard.currentRoundIndex !== undefined) {
        currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
    }

    CURRENT_CONFIG = config;

    renderOverlayLeaderboard();

    window.addEventListener('storage', onOverlayStorage);

    // 2秒定时轮询更新（作为 storage 跨标签页监听器的可靠同步兜底）
    setInterval(() => {
        const latest = localStorage.getItem("UP_LOTTERY_SMART_CACHE");
        if (latest) {
            const latestConfig = JSON.parse(latest);
            CURRENT_CONFIG = latestConfig;

            const latestRoundIndex = (latestConfig.scoreboard && latestConfig.scoreboard.currentRoundIndex !== undefined)
                ? latestConfig.scoreboard.currentRoundIndex : 0;

            currentScoreboardRoundIndex = latestRoundIndex;
            renderOverlayLeaderboard();
        }
    }, 2000);
}

function onOverlayStorage(event) {
    if (event.key !== 'UP_LOTTERY_SMART_CACHE') return;
    if (!event.newValue) return;

    try {
        const config = JSON.parse(event.newValue);
        if (config && config.scoreboard && config.scoreboard.currentRoundIndex !== undefined) {
            currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
        }
        CURRENT_CONFIG = config; // 同步最新内存
    } catch (e) {
        return;
    }

    renderOverlayLeaderboard();
}

function getAllPlayerNames() {
    const rounds = getActiveRounds();
    const nameSet = new Set();

    rounds.forEach(round => {
        round.entries.forEach(entry => {
            const name = entry.name.trim();
            if (name) nameSet.add(name);
        });
    });

    return Array.from(nameSet);
}

// 计算悬浮窗排行榜数据
function computeOverlayScores() {
    const rounds = getActiveRounds();
    const mode = getActiveMode();
    const rankingEnabled = CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;
    const currentRound = rounds[currentScoreboardRoundIndex];
    if (!currentRound) return [];

    // 检测 scope
    const urlParams = new URLSearchParams(window.location.search);
    const scope = urlParams.get('scope') || 'global';

    // 先计算动态排名
    const { ranked } = computeDynamicRanks(currentRound.entries);

    // 构建动态排名查询表
    const dynamicRankMap = {};
    ranked.forEach(e => {
        if (e.name.trim()) {
            dynamicRankMap[e.name.trim()] = e._dynamicRank;
            // 确保兼容字段
            ensureEntryFields(e);
        }
    });

    if (scope === 'current') {
        // 本局悬浮窗：只显示当前回合数据
        const list = currentRound.entries
            .filter(e => e.name.trim() !== '')
            .map(e => {
                ensureEntryFields(e);
                const kills = parseInt(e.kills) || 0;
                const dynRank = dynamicRankMap[e.name.trim()] || e.rank;
                const rp = rankingEnabled ? getRankingPoints(dynRank, mode) : 0;
                return {
                    name: e.name.trim(),
                    hero: e.hero || '',
                    isActive: true,
                    eliminated: !!e.eliminated,
                    currentKills: kills,
                    rankingPoints: rp,
                    dynamicRank: dynRank,
                    totalScore: kills + rp
                };
            });

        list.sort((a, b) => b.totalScore - a.totalScore);
        return list;
    } else {
        // 全局悬浮窗：历史积分 + 当前回合
        const allNames = getAllPlayerNames();
        if (allNames.length === 0) return [];

        const activeNameSet = new Set();
        if (currentRound) {
            currentRound.entries.forEach(entry => {
                const name = entry.name.trim();
                if (name) activeNameSet.add(name);
            });
        }

        const playerMap = {};
        allNames.forEach(name => {
            playerMap[name] = {
                name: name,
                isActive: activeNameSet.has(name),
                currentKills: 0,
                currentRankingPoints: 0,
                historyScore: 0,
                hero: '',
                eliminated: false,
                dynamicRank: 0
            };
        });

        const isCurrentRoundConfirmed = currentRound ? currentRound.confirmed : false;

        // 累计已确认回合的历史分数
        rounds.forEach((round, roundIndex) => {
            if (!round.confirmed) return;
            if (roundIndex === currentScoreboardRoundIndex && !isCurrentRoundConfirmed) return;

            round.entries.forEach(entry => {
                const name = entry.name.trim();
                if (!name) return;
                if (!playerMap[name]) {
                    playerMap[name] = {
                        name: name,
                        isActive: activeNameSet.has(name),
                        currentKills: 0,
                        currentRankingPoints: 0,
                        historyScore: 0,
                        hero: '',
                        eliminated: false,
                        dynamicRank: 0
                    };
                }
                const kills = parseInt(entry.kills) || 0;
                const rp = rankingEnabled ? getRankingPoints(entry.rank, mode) : 0;
                playerMap[name].historyScore += kills + rp;
            });
        });

        // 填充当前回合数据
        if (currentRound) {
            currentRound.entries.forEach(entry => {
                const name = entry.name.trim();
                if (!name) return;
                if (playerMap[name]) {
                    ensureEntryFields(entry);
                    playerMap[name].currentKills = parseInt(entry.kills) || 0;
                    playerMap[name].hero = entry.hero || '';
                    playerMap[name].eliminated = !!entry.eliminated;
                    playerMap[name].dynamicRank = dynamicRankMap[name] || entry.rank;
                    playerMap[name].currentRankingPoints = rankingEnabled
                        ? getRankingPoints(playerMap[name].dynamicRank, mode) : 0;
                }
            });
        }

        // 计算总积分：历史分 + 当前局(击败分+排名分)（仅当当前局未确认时加上）
        const list = Object.values(playerMap).map(p => ({
            name: p.name,
            hero: p.hero,
            isActive: p.isActive,
            eliminated: p.eliminated,
            currentKills: p.currentKills,
            currentRankingPoints: p.currentRankingPoints,
            dynamicRank: p.dynamicRank,
            historyScore: p.historyScore,
            totalScore: p.historyScore + (p.isActive && !isCurrentRoundConfirmed
                ? (p.currentKills + p.currentRankingPoints) : 0)
        }));

        list.sort((a, b) => b.totalScore - a.totalScore);
        return list;
    }
}

function renderOverlayLeaderboard() {
    const tbody = document.getElementById('overlay-leaderboard-tbody');
    const table = document.getElementById('overlay-leaderboard-table');
    const emptyHint = document.getElementById('overlay-empty-hint');

    if (!tbody) return;

    // 检测 scope
    const urlParams = new URLSearchParams(window.location.search);
    const scope = urlParams.get('scope') || 'global';

    // 更新表头最后一列标题
    const totalHeader = document.querySelector('.ov-th-total');
    if (totalHeader) {
        totalHeader.textContent = scope === 'current' ? '本局积分' : '总积分';
    }

    const scores = computeOverlayScores();

    if (scores.length === 0) {
        if (table) table.style.display = 'none';
        if (emptyHint) emptyHint.style.display = 'block';
        return;
    }

    if (table) table.style.display = '';
    if (emptyHint) emptyHint.style.display = 'none';

    let html = '';

    scores.forEach((player, idx) => {
        const rank = idx + 1;
        let rankDisplay = '';
        let rowClass = '';

        if (rank === 1) {
            rankDisplay = '🥇';
            rowClass = player.eliminated ? 'ov-eliminated' : (player.isActive ? 'ov-row-top1' : 'ov-inactive-row');
        } else if (rank === 2) {
            rankDisplay = '🥈';
            rowClass = player.eliminated ? 'ov-eliminated' : (player.isActive ? 'ov-row-top2' : 'ov-inactive-row');
        } else if (rank === 3) {
            rankDisplay = '🥉';
            rowClass = player.eliminated ? 'ov-eliminated' : (player.isActive ? 'ov-row-top3' : 'ov-inactive-row');
        } else {
            rankDisplay = String(rank);
        }

        // 淘汰/未上场状态覆盖
        if (!player.isActive) {
            rowClass = 'ov-inactive-row';
        } else if (player.eliminated) {
            rowClass = 'ov-eliminated';
        }

        // 英雄头像
        const heroImgHtml = player.hero
            ? `<img src="${getHeroImage(player.hero)}" class="ov-hero-img"
                 onclick="toggleElimination('${escapeJS(player.name)}')"
                 onerror="this.outerHTML='<span class=ov-hero-empty></span>'"
                 title="${escapeHTML(player.hero)}">`
            : '<span class="ov-hero-empty"></span>';

        // 击败数列
        let killsHtml = '';
        if (player.isActive && !player.eliminated) {
            killsHtml = `
                <div class="ov-kills-control">
                    <button class="ov-kill-btn" data-player="${escapeHTML(player.name)}" data-delta="-1" onclick="overlayKillChange(this.dataset.player, parseInt(this.dataset.delta))">−</button>
                    <span class="ov-kill-value">${player.currentKills}</span>
                    <button class="ov-kill-btn" data-player="${escapeHTML(player.name)}" data-delta="1" onclick="overlayKillChange(this.dataset.player, parseInt(this.dataset.delta))">+</button>
                </div>
            `;
        } else if (!player.isActive) {
            killsHtml = '<span class="ov-inactive">-</span>';
        } else {
            // 已淘汰：显示击败数但不可调节
            killsHtml = `<span class="ov-kill-value">${player.currentKills}</span>`;
        }

        html += `
            <tr class="${rowClass}" data-player="${escapeHTML(player.name)}">
                <td class="ov-td-rank">${rankDisplay}</td>
                <td class="ov-td-name" onclick="toggleElimination('${escapeJS(player.name)}')">${escapeHTML(player.name || '-')}</td>
                <td class="ov-td-hero">${heroImgHtml}</td>
                <td class="ov-td-kills">${killsHtml}</td>
                <td class="ov-td-total">${player.totalScore}</td>
            </tr>
        `;
    });

    applyFlipAnimation(tbody, html);
}

function overlayKillChange(playerName, delta) {
    const cached = localStorage.getItem("UP_LOTTERY_SMART_CACHE");
    if (!cached) return;

    let config;
    try {
        config = JSON.parse(cached);
    } catch (e) {
        return;
    }

    if (!config.scoreboard) return;

    const mode = config.scoreboard.currentMode || '8';
    const roundsKey = mode === '12' ? 'rounds12' : 'rounds8';
    const rounds = config.scoreboard[roundsKey];
    const roundIndex = (config.scoreboard.currentRoundIndex !== undefined)
        ? config.scoreboard.currentRoundIndex : 0;

    if (!rounds || !rounds[roundIndex]) return;

    const round = rounds[roundIndex];
    const entry = round.entries.find(e => e.name.trim() === playerName);
    if (!entry) return;

    let kills = parseInt(entry.kills) || 0;
    kills = Math.max(0, kills + delta);
    entry.kills = kills;

    config.scoreboard.currentRoundIndex = roundIndex;

    localStorage.setItem("UP_LOTTERY_SMART_CACHE", JSON.stringify(config));

    CURRENT_CONFIG.scoreboard = config.scoreboard;
    currentScoreboardRoundIndex = roundIndex;

    renderOverlayLeaderboard();
}

function onMainStorage(event) {
    if (event.key !== 'UP_LOTTERY_SMART_CACHE') return;
    if (!event.newValue) return;
    if (overlaySyncLock) return; 

    overlaySyncLock = true;

    try {
        const config = JSON.parse(event.newValue);
        if (!config || !config.scoreboard) return;

        CURRENT_CONFIG = config;

        if (config.scoreboard.currentRoundIndex !== undefined) {
            currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
        }

        const scoreboardTab = document.getElementById('tab-scoreboard');
        if (scoreboardTab && scoreboardTab.classList.contains('active')) {
            renderRoundTabs();
            renderRoundEditor(currentScoreboardRoundIndex);
            renderScoreboardLeaderboard();
        }
    } catch (e) {
        // 解析失败
    }

    setTimeout(() => {
        overlaySyncLock = false;
    }, 200);
}

// ── 排名分规则设置弹窗 ──

function openRankingPointsSettings() {
    const mode = getActiveMode();
    document.getElementById('rp-mode-label').textContent = mode === '12' ? '12人局' : '8人局';
    renderRankingPointsRules();
    document.getElementById('ranking-points-modal').classList.add('active');
}

function closeRankingPointsSettings() {
    document.getElementById('ranking-points-modal').classList.remove('active');
    saveConfigToLocal();
    // 规则变化后刷新排行榜
    renderScoreboardLeaderboard();
}

function renderRankingPointsRules() {
    const mode = getActiveMode();
    const sb = CURRENT_CONFIG.scoreboard;
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';

    if (!sb[rulesKey] || sb[rulesKey].length === 0) {
        sb[rulesKey] = getDefaultRankingRules(mode);
    }

    const rules = sb[rulesKey];
    const container = document.getElementById('ranking-points-rules-list');
    let html = '';

    rules.forEach((rule, index) => {
        html += `
            <div class="option-item" style="grid-template-columns: 0.8fr 0.8fr 1fr; gap:12px;">
                <input type="number" value="${rule.minRank}" min="1" step="1"
                    onchange="updateRankingPointsRule(${index}, 'minRank', parseInt(this.value))"
                    title="起始名次">
                <input type="number" value="${rule.maxRank}" min="1" step="1"
                    onchange="updateRankingPointsRule(${index}, 'maxRank', parseInt(this.value))"
                    title="截止名次（含）">
                <input type="number" class="rp-points-input" value="${rule.points}" step="0.1" min="0"
                    onchange="updateRankingPointsRule(${index}, 'points', parseFloat(this.value))"
                    title="该区间获得的分数">
                <button class="delete-btn" onclick="deleteRankingPointsRule(${index})" style="grid-column:4;">🗑️</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateRankingPointsRule(index, field, value) {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = CURRENT_CONFIG.scoreboard[rulesKey];
    if (!rules || !rules[index]) return;

    if (field === 'minRank' || field === 'maxRank') {
        if (isNaN(value) || value < 1) value = rules[index][field]; // 恢复原值
        rules[index][field] = value;
    } else if (field === 'points') {
        if (isNaN(value)) value = 0;
        rules[index].points = value;
    }

    saveConfigToLocal();
}

function addRankingPointsRule() {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = CURRENT_CONFIG.scoreboard[rulesKey];
    if (!rules) return;

    const lastRule = rules[rules.length - 1];
    const nextMin = lastRule ? lastRule.maxRank + 1 : 1;

    rules.push({
        minRank: nextMin,
        maxRank: nextMin + 1,
        points: 0
    });

    saveConfigToLocal();
    renderRankingPointsRules();
}

function deleteRankingPointsRule(index) {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = CURRENT_CONFIG.scoreboard[rulesKey];

    if (!rules || rules.length <= 1) {
        alert('至少需要保留 1 条排名分规则！');
        return;
    }

    if (!confirm('确定要删除这条排名分规则吗？')) return;

    rules.splice(index, 1);
    saveConfigToLocal();
    renderRankingPointsRules();
}

function resetRankingPointsToDefault() {
    if (!confirm('确定要恢复为默认排名分规则吗？当前修改将丢失。')) return;

    const mode = getActiveMode();
    const sb = CURRENT_CONFIG.scoreboard;
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    sb[rulesKey] = getDefaultRankingRules(mode);

    saveConfigToLocal();
    renderRankingPointsRules();
    renderScoreboardLeaderboard();
}

// ── 排名总览图

function generateScoreboardOverview() {
    const mode = getActiveMode();
    const rounds = getActiveRounds();
    const leaderboard = computeLeaderboard();

    if (leaderboard.length === 0) {
        alert('暂无计分数据，请先确认回合成绩再生成总览图！');
        return;
    }

    const modeLabel = mode === '8' ? '8人局' : '12人局';
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let html = '';
    html += `<div class="sb-overview-meta">`;
    html += `<div>📅 生成时间：${dateStr}</div>`;
    html += `<div>🎮 比赛模式：${modeLabel}（共 ${rounds.length} 局）</div>`;
    html += `<div>📐 计分规则：击败数 + 排名分</div>`;
    html += `</div>`;

    // 主排名表
    html += `<h4>🏆 选手排名总览</h4>`;
    html += `<table class="sb-overview-table"><thead><tr>`;
    html += '<th>排名</th><th>选手名称</th>';
    for (let i = 0; i < rounds.length; i++) {
        html += `<th>第${i + 1}局</th>`;
    }
    html += '<th>总击败</th><th>总排名分</th><th>总分</th></tr></thead><tbody>';

    leaderboard.forEach(player => {
        html += '<tr>';
        html += `<td class="ov-rank-col">${player.leaderboardRank}</td>`;
        html += `<td class="ov-name-col">${escapeHTML(player.name)}</td>`;
        for (let i = 0; i < rounds.length; i++) {
            const score = player.roundScores[i];
            html += `<td>${score !== null && score !== undefined ? score : '-'}</td>`;
        }
        html += `<td>${player.totalKills}</td>`;
        html += `<td>${player.totalRankingPoints}</td>`;
        html += `<td class="ov-total-col">${player.totalScore}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    // 排名分规则参考
    html += `<h4>📐 排名分规则参考</h4>`;
    html += `<div style="display:flex; gap:30px; flex-wrap:wrap;">`;

    // 8人局规则
    html += `<div style="flex:1; min-width:250px;">`;
    html += `<p style="color:#e3a94a; font-weight:bold; margin-bottom:8px;">8人局排名分</p>`;
    html += `<table class="sb-rules-table"><thead><tr><th>名次</th><th>分数</th></tr></thead><tbody>`;
    html += `<tr><td>第1名</td><td style="color:#ffcc00;">2.5</td></tr>`;
    html += `<tr><td>第2名</td><td style="color:#ffcc00;">1.0</td></tr>`;
    html += `<tr><td>第3-4名</td><td style="color:#ffcc00;">0.5</td></tr>`;
    html += `<tr><td>第5-8名</td><td>0</td></tr>`;
    html += `</tbody></table></div>`;

    // 12人局规则
    html += `<div style="flex:1; min-width:250px;">`;
    html += `<p style="color:#e3a94a; font-weight:bold; margin-bottom:8px;">12人局排名分</p>`;
    html += `<table class="sb-rules-table"><thead><tr><th>名次</th><th>分数</th></tr></thead><tbody>`;
    html += `<tr><td>第1名</td><td style="color:#ffcc00;">4.0</td></tr>`;
    html += `<tr><td>第2名</td><td style="color:#ffcc00;">3.0</td></tr>`;
    html += `<tr><td>第3名</td><td style="color:#ffcc00;">2.5</td></tr>`;
    html += `<tr><td>第4名</td><td style="color:#ffcc00;">2.0</td></tr>`;
    html += `<tr><td>第5-6名</td><td style="color:#ffcc00;">1.5</td></tr>`;
    html += `<tr><td>第7-8名</td><td style="color:#ffcc00;">1.0</td></tr>`;
    html += `<tr><td>第9-10名</td><td style="color:#ffcc00;">0.5</td></tr>`;
    html += `</tbody></table></div></div>`;

    document.getElementById('scoreboard-overview-content').innerHTML = html;
    document.getElementById('scoreboard-overview-modal').classList.add('active');
}

function closeScoreboardOverview() {
    document.getElementById('scoreboard-overview-modal').classList.remove('active');
}

function copyOverviewToClipboard() {
    const mode = getActiveMode();
    const rounds = getActiveRounds();
    const leaderboard = computeLeaderboard();
    const modeLabel = getActiveMode() === '8' ? '8人局' : '12人局';

    let text = `永劫无间擂台赛 - 计分排名总览\n`;
    text += `比赛模式：${modeLabel}（共 ${rounds.length} 局）\n`;
    text += `计分规则：击败数 + 排名分\n\n`;

    // 表头
    text += `排名\t选手名称`;
    for (let i = 0; i < rounds.length; i++) {
        text += `\t第${i + 1}局`;
    }
    text += `\t总击败\t总排名分\t总分\n`;

    // 数据行
    leaderboard.forEach(player => {
        text += `${player.leaderboardRank}\t${player.name}`;
        for (let i = 0; i < rounds.length; i++) {
            const score = player.roundScores[i];
            text += `\t${score !== null && score !== undefined ? score : '-'}`;
        }
        text += `\t${player.totalKills}\t${player.totalRankingPoints}\t${player.totalScore}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('✅ 排名总览已复制到剪贴板！可直接粘贴到 Excel 或聊天窗口中。');
    }).catch(() => {
        alert('❌ 复制失败，请手动选择表格内容复制。');
    });
}

function exportConfigJS() {
    if (!confirm("这将会生成一个全新的 'config.js' 文件。将其替换掉你文件夹里的原文件后，你的配置数据就会永久物理保存。确认导出吗？")) {
        return;
    }

    const fileContent = `// 导出的物理自定义配置文件
const DEFAULT_CONFIG = ${JSON.stringify(CURRENT_CONFIG, null, 4)};

// ==================== 【智能版本同步核心算法】 ====================
let CURRENT_CONFIG;

// 1. 读取本地缓存
let localCache = JSON.parse(localStorage.getItem("UP_LOTTERY_SMART_CACHE"));

// 2. 判断是否需要同步磁盘文件数据
if (!localCache || DEFAULT_CONFIG.configVersion > localCache.configVersion) {
    let activeHeroes = localCache ? localCache.activeHeroNames : DEFAULT_CONFIG.activeHeroNames;
    let activeWeapons = localCache ? localCache.activeWeaponNames : DEFAULT_CONFIG.activeWeaponNames;
    let activePlayers = localCache ? (localCache.activePlayerNames || DEFAULT_CONFIG.activePlayerNames) : DEFAULT_CONFIG.activePlayerNames;
    let activeTips = localCache ? (localCache.activeTipNames || DEFAULT_CONFIG.activeTipNames) : DEFAULT_CONFIG.activeTipNames;
    let heroSettings = localCache ? localCache.heroDrawSettings : DEFAULT_CONFIG.heroDrawSettings;
    let weaponSettings = localCache ? localCache.weaponDrawSettings : DEFAULT_CONFIG.weaponDrawSettings;

    let cachedTips = DEFAULT_CONFIG.tips;
    let cachedTipSettings = DEFAULT_CONFIG.tipDrawSettings;
    let cachedTipSession = localCache ? (localCache.tipSession || DEFAULT_CONFIG.tipSession) : DEFAULT_CONFIG.tipSession;

    let cachedPrizes = localCache ? (localCache.prizes || DEFAULT_CONFIG.prizes) : DEFAULT_CONFIG.prizes;
    let cachedPrizeLogs = localCache ? (localCache.prizeLogs || []) : [];
    let cachedScoreboard = localCache ? (localCache.scoreboard || DEFAULT_CONFIG.scoreboard) : DEFAULT_CONFIG.scoreboard;

    CURRENT_CONFIG = {
        configVersion: DEFAULT_CONFIG.configVersion,
        heroes: DEFAULT_CONFIG.heroes,
        weapons: DEFAULT_CONFIG.weapons,
        players: DEFAULT_CONFIG.players,
        tips: cachedTips,
        tipDrawSettings: cachedTipSettings,
        tipSession: cachedTipSession,
        prizes: cachedPrizes,
        prizeLogs: cachedPrizeLogs,
        activeHeroNames: activeHeroes,
        activeWeaponNames: activeWeapons,
        activePlayerNames: activePlayers,
        activeTipNames: activeTips,
        heroDrawSettings: heroSettings,
        weaponDrawSettings: weaponSettings,
        wheelsList: DEFAULT_CONFIG.wheelsList,
        scoreboard: cachedScoreboard
    };
    
    localStorage.setItem("UP_LOTTERY_SMART_CACHE", JSON.stringify(CURRENT_CONFIG));
} else {
    CURRENT_CONFIG = localCache;
}

// 保存配置到本地缓存
function saveConfigToLocal() {
    localStorage.setItem("UP_LOTTERY_SMART_CACHE", JSON.stringify(CURRENT_CONFIG));
}
`;

    const blob = new Blob([fileContent], { type: "text/javascript;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "config.js";
    link.click();
}