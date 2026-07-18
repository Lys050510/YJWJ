// ==================== 模块四：锦囊抽取 ====================
import * as state from '../core/state.js';
import { saveConfig } from '../core/storage.js';
import { getFormattedTime, escapeJS, escapeHTML, getQualityClass, getQualityColor } from '../core/utils.js';

// 锦囊品质配色 class 映射（保留本地别名）
function getTipQualityClass(q) { return getQualityClass(q); }
function getLogQualityColor(q) { return getQualityColor(q); }
// ==================== 🛠️ 模块四：锦囊抽取与演播大厅 ====================

// 锦囊大厅渲染初始化入口
function initTipDashboard() {
    // 1. 同步设置参数到控件
    const settings = window.CURRENT_CONFIG.tipDrawSettings;
    document.getElementById('tip-draw-count-select').value = settings.drawCount;
    document.getElementById('tip-choose-count-select').value = settings.chooseCount;
    document.getElementById('tip-refresh-limit-input').value = settings.refreshLimit;

    // 2. 刷新两个子分类按钮的高亮状态
    document.getElementById('tip-sub-challenger').classList.toggle('active', state.currentTipPool === 'challenger');
    document.getElementById('tip-sub-champion').classList.toggle('active', state.currentTipPool === 'champion');

    // 3. 渲染跑马灯展示行
    renderTipMarquee();

    // 4. 渲染本局已选择日志
    renderTipLogs();

    // 5. 渲染桌面抽卡区域
    if (state.drawnTipCards.length === 0) {
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
    state.currentTipPool = poolType;
    
    state.drawnTipCards = [];
    state.flippedTipCount = 0;
    
    initTipDashboard();
}

// 调节抽卡的基础控制数字
function adjustTipCounts(key, value) {
    if (isNaN(value)) {
        // 输入非法值时恢复为当前有效值，避免污染配置
        document.getElementById('tip-refresh-limit-input').value = window.CURRENT_CONFIG.tipDrawSettings.refreshLimit;
        return;
    }
    window.CURRENT_CONFIG.tipDrawSettings[key] = value;
    
    if (key === 'drawCount' || key === 'chooseCount') {
        const drawCount = window.CURRENT_CONFIG.tipDrawSettings.drawCount;
        const chooseCount = window.CURRENT_CONFIG.tipDrawSettings.chooseCount;
        if (chooseCount > drawCount) {
            window.CURRENT_CONFIG.tipDrawSettings.chooseCount = drawCount;
            document.getElementById('tip-choose-count-select').value = drawCount;
        }
    }
    saveConfig();
}

// 渲染跑马灯展示行
function renderTipMarquee() {
    const container = document.getElementById('tip-marquee-container');
    container.innerHTML = '';

    const activeConfirmed = window.CURRENT_CONFIG.tipSession.selectedTips || [];
    const list = window.CURRENT_CONFIG.tips.filter(t => t.pool === state.currentTipPool && !activeConfirmed.includes(t.name) && window.CURRENT_CONFIG.activeTipNames.includes(t.name));

    if (list.length === 0) {
        container.innerHTML = `<div style="color: #666; font-size: 15px; padding: 20px;">当前卡池已无空余锦囊卡牌（或尚未在后台添加数据）。</div>`;
        return;
    }

    clearInterval(state.activeTipMarqueeInterval); 

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
            state.isMarqueeDragging = true;
            scroller.classList.add('active-dragging');
            state.marqueeStartX = e.pageX - scroller.offsetLeft;
            state.marqueeScrollLeft = scroller.scrollLeft;
        });

        scroller.addEventListener('mouseleave', () => {
            state.isMarqueeDragging = false;
            scroller.classList.remove('active-dragging');
        });

        scroller.addEventListener('mouseup', () => {
            state.isMarqueeDragging = false;
            scroller.classList.remove('active-dragging');
        });

        scroller.addEventListener('mousemove', (e) => {
            if (!state.isMarqueeDragging) return;
            e.preventDefault();
            const x = e.pageX - scroller.offsetLeft;
            const walk = (x - state.marqueeStartX) * 1.5;
            scroller.scrollLeft = state.marqueeScrollLeft - walk;
        });
    }

    // 每次调用都重启自动滚动 interval（修复确认/重置后动画停止的 bug）
    clearInterval(state.activeTipMarqueeInterval);
    state.activeTipMarqueeInterval = setInterval(() => {
        if (state.isMarqueeDragging) return;
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
    const set = window.CURRENT_CONFIG.tipDrawSettings;
    const roll = Math.random() * 100;
    if (roll < set.goldProb) return '金';
    if (roll < set.goldProb + set.purpleProb) return '紫';
    if (roll < set.goldProb + set.purpleProb + set.blueProb) return '蓝';
    return '白';
}

// 带有 4 重兜底防空机制的锦囊抽取器
function getWeightedRandomTip(poolType, excludedList, targetQuality) {
    const allTips = window.CURRENT_CONFIG.tips.filter(t => t.pool === poolType && !excludedList.includes(t.name) && window.CURRENT_CONFIG.activeTipNames.includes(t.name));
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
// state.isInitialDealing now in state.js = false; 

function startTipDraw() {
    const settings = window.CURRENT_CONFIG.tipDrawSettings;
    const drawCount = settings.drawCount;

    const activeConfirmed = window.CURRENT_CONFIG.tipSession.selectedTips || [];
    const availableTotal = window.CURRENT_CONFIG.tips.filter(t => t.pool === state.currentTipPool && !activeConfirmed.includes(t.name) && window.CURRENT_CONFIG.activeTipNames.includes(t.name));

    if (availableTotal.length < drawCount) {
        alert(`⚠️ 卡池中可用锦囊仅剩【${availableTotal.length}】张，数量不足，无法抽取【${drawCount}】张！\n\n💡 解决办法：请前往锦囊设置添加卡牌，或点击重置清空已选历史！`);
        return;
    }

    state.flippedTipCount = 0;
    state.tipRefreshesRemaining = settings.refreshLimit;
    state.isInitialDealing = true; // 开启洗牌动效自锁

    state.drawnTipCards = [];
    let tempExcluded = [...activeConfirmed];

    for (let i = 0; i < drawCount; i++) {
        const targetQ = rollTipQuality();
        const tip = getWeightedRandomTip(state.currentTipPool, tempExcluded, targetQ);
        if (tip) {
            state.drawnTipCards.push({
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
        for (let i = state.drawnTipCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = state.drawnTipCards[i];
            state.drawnTipCards[i] = state.drawnTipCards[j];
            state.drawnTipCards[j] = temp;
        }

        cardWrappers.forEach(el => el.classList.remove('shuffling-animation'));
        state.isInitialDealing = false;

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

    const settings = window.CURRENT_CONFIG.tipDrawSettings;
    document.getElementById('revealed-tips-indicator').innerText = state.flippedTipCount;
    document.getElementById('max-tips-indicator').innerText = settings.chooseCount;
    document.getElementById('tip-refreshes-left-indicator').innerText = state.tipRefreshesRemaining;

    state.drawnTipCards.forEach((card, index) => {
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
        const btnClass = (card.isFaceDown || state.tipRefreshesRemaining <= 0) ? 'small-btn tip-single-refresh-btn hidden' : 'small-btn tip-single-refresh-btn';
        const btnHtml = `<button class="${btnClass}" id="tip-refresh-btn-${index}" onclick="refreshSingleTip(${index})">🔄 刷新此卡</button>`;

        slotWrapper.innerHTML = cardHtml + btnHtml;
        container.appendChild(slotWrapper);
    });

    updateTipStartDrawBtnUI();
}

// 🎯 局内单卡单独刷新与 3D 纵向翻转特效
function refreshSingleTip(index) {
    if (state.tipRefreshesRemaining <= 0) return;

    const cardInnerEl = document.getElementById(`tip-card-inner-${index}`);
    if (!cardInnerEl) return;

    cardInnerEl.classList.remove('card-reroll-spinning');
    void cardInnerEl.offsetWidth; 
    cardInnerEl.classList.add('card-reroll-spinning');

    const settings = window.CURRENT_CONFIG.tipDrawSettings;
    const activeConfirmed = window.CURRENT_CONFIG.tipSession.selectedTips || [];
    
    let tempExcluded = [...activeConfirmed];
    state.drawnTipCards.forEach((c, idx) => {
        if (idx !== index) {
            tempExcluded.push(c.tipData.name);
        }
    });

    let rolledQ = '';
    if (settings.refreshSameQuality) {
        rolledQ = state.drawnTipCards[index].qualityRolled; 
    } else {
        rolledQ = rollTipQuality(); 
    }

    const newTip = getWeightedRandomTip(state.currentTipPool, tempExcluded, rolledQ);
    if (!newTip) {
        alert("卡池中无可用的备用锦囊来刷新此位置！");
        return;
    }

    state.tipRefreshesRemaining--;

    setTimeout(() => {
        state.drawnTipCards[index] = {
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
    if (state.isInitialDealing) return; 

    const card = state.drawnTipCards[index];
    const chooseLimit = window.CURRENT_CONFIG.tipDrawSettings.chooseCount;

    if (!card.isFaceDown || card.revealed) return;

    if (state.flippedTipCount >= chooseLimit) {
        alert(`本局抽取设定只能选择翻开【${chooseLimit}】张锦囊！如对卡组不满意，可以点击下方对应的刷新按钮！`);
        return;
    }

    // 1. 本地更新状态
    card.isFaceDown = false;
    card.revealed = true;
    state.flippedTipCount++;

    // 2. 🎴 核心修复：直接寻找 DOM，移除 face-down 触发原生 3D 翻转过渡，绝不重绘导致卡死
    const cardContainer = document.getElementById(`tip-card-container-${index}`);
    if (cardContainer) {
        cardContainer.classList.remove('face-down');
    }

    // 3. 无重绘直接更新顶部数字状态
    document.getElementById('revealed-tips-indicator').innerText = state.flippedTipCount;

    // 4. 动态评估并锁定开始抽取按钮的可控状态
    updateTipStartDrawBtnUI();

    // 5. 在 3D 翻面转到正面完成时 (约 450毫秒) 触发刷新按钮优雅淡入，完全不破坏翻牌动画
    setTimeout(() => {
        const btn = document.getElementById(`tip-refresh-btn-${index}`);
        if (btn && state.tipRefreshesRemaining > 0) {
            btn.classList.remove('hidden');
        }
    }, 450);
}

// 防作弊 UI 动态评测控制器
function updateTipStartDrawBtnUI() {
    const btn = document.getElementById('tip-start-draw-btn');
    if (!btn) return;

    if (state.flippedTipCount > 0) {
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
    const chosenCards = state.drawnTipCards.filter(c => !c.isFaceDown);

    if (chosenCards.length === 0) {
        alert("场上还没有任何被翻开解密的锦囊，请先翻牌确认，或者点击开始抽取！");
        return;
    }

    if (!window.CURRENT_CONFIG.tipSession.selectedTips) {
        window.CURRENT_CONFIG.tipSession.selectedTips = [];
    }
    if (!window.CURRENT_CONFIG.tipSession.logs) {
        window.CURRENT_CONFIG.tipSession.logs = [];
    }

    let namesStr = [];
    chosenCards.forEach(c => {
        if (!window.CURRENT_CONFIG.tipSession.selectedTips.includes(c.tipData.name)) {
            window.CURRENT_CONFIG.tipSession.selectedTips.push(c.tipData.name);
        }
        namesStr.push(`【${c.tipData.name}】(${c.tipData.description})`);
    });

    const newLog = {
        time: getFormattedTime(),
        poolName: state.currentTipPool === 'challenger' ? '挑战者' : '擂主',
        tips: chosenCards.map(c => ({
            name: c.tipData.name,
            description: c.tipData.description,
            quality: c.tipData.quality
        }))
    };
    window.CURRENT_CONFIG.tipSession.logs.unshift(newLog);

    saveConfig();

    state.drawnTipCards = [];
    state.flippedTipCount = 0;

    document.getElementById('tip-play-hall').classList.add('hidden');
    document.getElementById('marquee-drag-outer').classList.remove('hidden');
    
    initTipDashboard();

    alert("🎉 锦囊选择锁定成功！相应锦囊已被归档并从候选池中剥离，可再次抽取其他卡片。");
}

// 🧹 重置本局：清空锁定，锦囊全部回归各池
function resetTipSession() {
    if (!confirm("确定要清空本局所有已被抽出的锦囊历史以及操作记录吗？（此操作会让所有锦囊重新进池）")) return;

    window.CURRENT_CONFIG.tipSession = {
        selectedTips: [],
        logs: []
    };
    saveConfig();

    state.drawnTipCards = [];
    state.flippedTipCount = 0;
    
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

    const logs = window.CURRENT_CONFIG.tipSession.logs || [];
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
    const settings = window.CURRENT_CONFIG.tipDrawSettings;
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

    window.CURRENT_CONFIG.tipDrawSettings.refreshSameQuality = document.getElementById('tip-setting-refresh-same').checked;
    document.getElementById('tips-settings-modal').classList.remove('active');
    
    saveConfig();
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
        window.CURRENT_CONFIG.tipDrawSettings.goldProb = gold;
        window.CURRENT_CONFIG.tipDrawSettings.purpleProb = purple;
        window.CURRENT_CONFIG.tipDrawSettings.blueProb = blue;
        window.CURRENT_CONFIG.tipDrawSettings.whiteProb = white;
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

    if (window.CURRENT_CONFIG.tips.some(t => t.name === name)) {
        alert("该锦囊名称已在数据库中，请勿重复添加！");
        return;
    }

    window.CURRENT_CONFIG.tips.push({ name, pool, quality, description: desc });
    // 同步加入激活名单
    if (!window.CURRENT_CONFIG.activeTipNames.includes(name)) {
        window.CURRENT_CONFIG.activeTipNames.push(name);
    }
    saveConfig();

    nameInput.value = '';
    descInput.value = '';

    toggleAddTipForm(false);
    initTipsManageListGrid();
    initTipsCheckboxGrid();
    alert(`锦囊卡【${name}】已成功录入数据库！`);
}

// 后台修改单项值
function updateTipField(index, key, val) {
    if (!window.CURRENT_CONFIG.tips[index]) return;
    window.CURRENT_CONFIG.tips[index][key] = val;
    saveConfig();
}

// 物理彻底删除单张锦囊
function deleteTipFromDB(index) {
    if (window.CURRENT_CONFIG.tips.length <= 1) {
        alert("数据库里至少需要保留 1 张物理锦囊防止抽卡引擎崩溃！");
        return;
    }
    const name = window.CURRENT_CONFIG.tips[index].name;
    if (!confirm(`确定要彻底在底层数据库中删除锦囊【${name}】吗？`)) return;

    window.CURRENT_CONFIG.tips.splice(index, 1);
    // 同步从激活名单中移除
    window.CURRENT_CONFIG.activeTipNames = window.CURRENT_CONFIG.activeTipNames.filter(n => n !== name);
    saveConfig();
    initTipsManageListGrid();
    initTipsCheckboxGrid();
}

// 渲染后台管理表格网格
function initTipsManageListGrid() {
    const container = document.getElementById('tips-manage-list');
    container.innerHTML = '';

    window.CURRENT_CONFIG.tips.forEach((tip, index) => {
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

    window.CURRENT_CONFIG.tips.forEach(tip => {
        const isChecked = window.CURRENT_CONFIG.activeTipNames.includes(tip.name);

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
        if (!window.CURRENT_CONFIG.activeTipNames.includes(name)) {
            window.CURRENT_CONFIG.activeTipNames.push(name);
        }
    } else {
        window.CURRENT_CONFIG.activeTipNames = window.CURRENT_CONFIG.activeTipNames.filter(n => n !== name);
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
    const index = window.CURRENT_CONFIG.tips.findIndex(t => t.name === tipName);
    if (index === -1) return;
    deleteTipFromDB(index);
}

// 挂载到全局
window.TipsModule = {
    initTipDashboard, switchTipPool, adjustTipCounts, renderTipMarquee,
    initTipMarqueeScroller, getTipQualityClass, rollTipQuality, getWeightedRandomTip,
    startTipDraw, renderDrawnTipCardsGrid, refreshSingleTip, revealTipCardInGame,
    updateTipStartDrawBtnUI, confirmTipChoice, resetTipSession, getLogQualityColor,
    renderTipLogs, openTipSettings, closeTipSettings, validateTipProbs,
    toggleAddTipForm, submitNewTip, updateTipField, deleteTipFromDB,
    initTipsManageListGrid, initTipsCheckboxGrid, onTipCheckboxChange,
    toggleAllTips, deleteTipFromDBByName
};

export {
    initTipDashboard, switchTipPool, adjustTipCounts, renderTipMarquee,
    initTipMarqueeScroller, getTipQualityClass, rollTipQuality, getWeightedRandomTip,
    startTipDraw, renderDrawnTipCardsGrid, refreshSingleTip, revealTipCardInGame,
    updateTipStartDrawBtnUI, confirmTipChoice, resetTipSession, getLogQualityColor,
    renderTipLogs, openTipSettings, closeTipSettings, validateTipProbs,
    toggleAddTipForm, submitNewTip, updateTipField, deleteTipFromDB,
    initTipsManageListGrid, initTipsCheckboxGrid, onTipCheckboxChange,
    toggleAllTips, deleteTipFromDBByName
};
