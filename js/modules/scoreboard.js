// ==================== 模块：计分板 + 悬浮窗 ====================
// 从 script.js 行 2539-4049 提取

import { state } from '../core/state.js';

import { escapeHTML, escapeJS, getFormattedTime } from '../core/utils.js';

import { STORAGE_KEY, saveConfig, getActiveMode, getActiveRounds as _storageGetActiveRounds } from '../core/storage.js';

// ── getActiveRounds 本地包装（附加 normalizeAllRounds 兼容性补全）──
function getActiveRounds() {
    normalizeAllRounds();
    return _storageGetActiveRounds();
}

// ==================== 数据辅助函数 ====================

export function getSBPlayerCount(mode) {
    return mode === '12' ? 12 : 8;
}

export function getRankingPoints(rank, mode) {
    const r = parseFloat(rank) || 0;
    const sb = window.CURRENT_CONFIG.scoreboard;
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

export function getDefaultRankingRules(mode) {
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

export function buildDefaultEntries(count) {
    const entries = [];
    for (let i = 0; i < count; i++) {
        entries.push({ rank: count, name: '', kills: 0, hero: '', eliminated: false, eliminatedAt: null });
    }
    return entries;
}

// 向后兼容：为旧数据补全缺失字段
export function ensureEntryFields(entry) {
    if (entry.hero === undefined) entry.hero = '';
    if (entry.eliminated === undefined) entry.eliminated = false;
    if (entry.eliminatedAt === undefined) entry.eliminatedAt = null;
}

export function normalizeAllRounds() {
    const modes = ['8', '12'];
    modes.forEach(m => {
        const key = m === '12' ? 'rounds12' : 'rounds8';
        const rounds = window.CURRENT_CONFIG.scoreboard[key];
        if (!rounds) return;
        rounds.forEach(round => {
            if (!round.entries) return;
            round.entries.forEach(entry => ensureEntryFields(entry));
        });
    });
}

// 根据英雄名获取图片路径
export function getHeroImage(heroName) {
    if (!heroName) return '';
    const hero = window.CURRENT_CONFIG.heroes.find(h => h.name === heroName);
    return hero ? hero.image : '';
}

// ==================== 英雄选择器 ====================

export function openHeroPicker(roundIndex, entryIndex) {
    state.heroPickerRoundIndex = roundIndex;
    state.heroPickerEntryIndex = entryIndex;
    const grid = document.getElementById('hero-picker-grid');
    if (!grid) return;

    const rounds = getActiveRounds();
    const currentHero = rounds[roundIndex].entries[entryIndex].hero || '';

    let html = '';
    window.CURRENT_CONFIG.heroes.forEach(h => {
        const selected = (h.name === currentHero) ? ' selected' : '';
        html += `<div class="hero-picker-item${selected}" onclick="selectHeroForEntry('${escapeJS(h.name)}')">
            <img src="${escapeHTML(h.image)}" onerror="this.style.display='none';var fb=this.parentElement.querySelector('.avatar-fallback');if(fb)fb.style.display='flex';">
            <div class="avatar-fallback" style="display:none;width:44px;height:44px;border-radius:50%;background:rgba(179,134,59,0.2);align-items:center;justify-content:center;font-size:18px;color:#e3a94a;">${escapeHTML(h.name[0])}</div>
            <span>${escapeHTML(h.name)}</span>
        </div>`;
    });
    grid.innerHTML = html;
    document.getElementById('hero-picker-modal').classList.add('active');
}

export function selectHeroForEntry(heroName) {
    const rounds = getActiveRounds();
    if (rounds[state.heroPickerRoundIndex] && rounds[state.heroPickerRoundIndex].entries[state.heroPickerEntryIndex]) {
        rounds[state.heroPickerRoundIndex].entries[state.heroPickerEntryIndex].hero = heroName;
        saveConfig();
        renderRoundEditor(state.heroPickerRoundIndex);
    }
    closeHeroPicker();
}

export function clearHeroForEntry() {
    selectHeroForEntry('');
}

export function closeHeroPicker() {
    document.getElementById('hero-picker-modal').classList.remove('active');
    state.heroPickerRoundIndex = -1;
    state.heroPickerEntryIndex = -1;
}

// ==================== 动态排名计算 ====================

export function computeDynamicRanks(entries) {
    // 只处理有名字的活跃选手
    const active = entries.filter(e => e.name.trim() !== '');

    // 初始化 elimination counter（基于已有数据）
    state.globalEliminationCounter = 0;
    active.forEach(e => {
        if (e.eliminated && e.eliminatedAt === null) {
            state.globalEliminationCounter++;
            e.eliminatedAt = state.globalEliminationCounter;
        } else if (e.eliminated && e.eliminatedAt > state.globalEliminationCounter) {
            state.globalEliminationCounter = e.eliminatedAt;
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

// ==================== 淘汰状态切换（悬浮窗用） ====================

export function toggleElimination(playerName) {
    // 读取最新 localStorage 数据
    const cached = localStorage.getItem(STORAGE_KEY);
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
        state.globalEliminationCounter++;
        entry.eliminatedAt = state.globalEliminationCounter;
    }

    // 重新计算动态排名并回写到 rank 字段
    const { ranked } = computeDynamicRanks(round.entries);
    ranked.forEach(e => {
        e.rank = e._dynamicRank;
    });

    // 持久化
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    // 更新内存状态
    window.CURRENT_CONFIG = config;
    state.currentScoreboardRoundIndex = roundIndex;

    renderOverlayLeaderboard();
}

// ==================== FLIP 动画 ====================

export function applyFlipAnimation(tbody, newHtml) {
    // 首次渲染跳过动画
    if (!state.overlayFlipEnabled) {
        tbody.innerHTML = newHtml;
        state.overlayFlipEnabled = true;
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

// ==================== 初始化与切换 ====================

export function initScoreboardDashboard() {
    const sb = window.CURRENT_CONFIG.scoreboard;
    if (!sb) {
        window.CURRENT_CONFIG.scoreboard = {
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
        saveConfig();
    }

    // 同步子 tab 高亮
    document.getElementById('sb-sub-8').classList.toggle('active', getActiveMode() === '8');
    document.getElementById('sb-sub-12').classList.toggle('active', getActiveMode() === '12');

    // 同步全局排名分勾选框
    if (window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled === undefined) {
        window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled = true;
    }
    document.getElementById('sb-ranking-toggle').checked = window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;

    // 重置选中回合
    if (state.currentScoreboardRoundIndex >= rounds.length) {
        state.currentScoreboardRoundIndex = 0;
    }
    // 从持久化数据恢复当前回合索引（悬浮窗同步用）
    if (window.CURRENT_CONFIG.scoreboard.currentRoundIndex !== undefined &&
        window.CURRENT_CONFIG.scoreboard.currentRoundIndex < rounds.length) {
        state.currentScoreboardRoundIndex = window.CURRENT_CONFIG.scoreboard.currentRoundIndex;
    }

    renderRoundTabs();
    renderRoundEditor(state.currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

export function switchScoreboardMode(mode) {
    if (mode === getActiveMode()) return;

    window.CURRENT_CONFIG.scoreboard.currentMode = mode;
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

    state.currentScoreboardRoundIndex = 0;
    window.CURRENT_CONFIG.scoreboard.currentRoundIndex = 0;
    saveConfig();
    initScoreboardDashboard();
}

// ==================== 回合选择器 ====================

export function renderRoundTabs() {
    const container = document.getElementById('scoreboard-round-tabs');
    const rounds = getActiveRounds();

    let html = '';
    rounds.forEach((round, index) => {
        const activeClass = index === state.currentScoreboardRoundIndex ? ' active' : '';
        const hasData = round.entries.some(e => e.name.trim() !== '') ? ' has-data' : '';
        const confirmed = round.confirmed ? ' ✅' : '';
        html += `<button class="sb-round-tab${activeClass}${hasData}" onclick="selectScoreboardRound(${index})">第${index + 1}局${confirmed}</button>`;
    });

    // 操作按钮组
    html += `<div style="display:flex; gap:4px; margin-top:8px;">`;
    html += `<button class="sb-round-tab" onclick="addScoreboardRound()" style="flex:1; border-style:dashed; color:#88ff88; border-color:rgba(136,255,136,0.4);">＋ 添加</button>`;
    html += `<button class="sb-round-tab" onclick="deleteScoreboardRound(${state.currentScoreboardRoundIndex})" style="flex:1; color:#ff9999; border-color:rgba(255,153,153,0.3);" title="删除当前选中的回合">🗑️ 删除</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

export function selectScoreboardRound(index) {
    state.currentScoreboardRoundIndex = index;
    // 持久化当前回合索引（悬浮窗同步需要）
    window.CURRENT_CONFIG.scoreboard.currentRoundIndex = index;
    saveConfig();
    renderRoundTabs();
    renderRoundEditor(index);
}

// ==================== 回合编辑器 ====================

export function renderRoundEditor(roundIndex) {
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
            ? `<img src="${escapeHTML(getHeroImage(entry.hero))}" class="sb-hero-thumb"
                 onclick="openHeroPicker(${roundIndex}, ${entryIndex})"
                 onerror="var fb=document.createElement('div');fb.className='sb-hero-placeholder';fb.textContent='?';fb.onclick=function(){openHeroPicker(${roundIndex},${entryIndex})};this.replaceWith(fb);"
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

// ==================== 本局排名弹窗 ====================

export function refreshRoundRankingTable(roundIndex) {
    const rounds = getActiveRounds();
    const mode = getActiveMode();
    const round = rounds[roundIndex];
    if (!round) return;

    const rankingEnabled = window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;
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

export function closeRoundRanking() {
    document.getElementById('round-ranking-modal').classList.remove('active');
}

// 重置全部计分数据
export function resetScoreboardAll() {
    if (!confirm('⚠️ 确定要清空所有计分板数据吗？\n\n这将删除所有回合的选手名称、击败数和排名记录。此操作不可撤销！')) return;

    const sb = window.CURRENT_CONFIG.scoreboard;
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

    state.currentScoreboardRoundIndex = 0;
    saveConfig();

    // 刷新全部 UI
    document.getElementById('sb-ranking-toggle').checked = true;
    renderRoundTabs();
    renderRoundEditor(0);
    renderScoreboardLeaderboard();
}

export function onRoundEntryChange(roundIndex, entryIndex, field, value) {
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

    saveConfig();
    // 更新回合 tab 的数据指示器
    renderRoundTabs();
}

export function confirmScoreboardRound(roundIndex) {
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

    saveConfig();
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
            saveConfig();
            // 如果当前正在编辑的就是下一局，刷新编辑器
            if (state.currentScoreboardRoundIndex === nextIndex) {
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

export function addScoreboardRound() {
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
    state.currentScoreboardRoundIndex = rounds.length - 1;
    saveConfig();

    renderRoundTabs();
    renderRoundEditor(state.currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

export function deleteScoreboardRound(roundIndex) {
    const rounds = getActiveRounds();
    if (rounds.length <= 1) {
        alert('至少需要保留 1 个回合！');
        return;
    }

    if (!confirm(`确定要删除第 ${roundIndex + 1} 局的全部数据吗？此操作不可撤销！`)) return;

    rounds.splice(roundIndex, 1);

    if (state.currentScoreboardRoundIndex >= rounds.length) {
        state.currentScoreboardRoundIndex = rounds.length - 1;
    }

    saveConfig();
    renderRoundTabs();
    renderRoundEditor(state.currentScoreboardRoundIndex);
    renderScoreboardLeaderboard();
}

// ==================== 排名分开关 ====================

export function toggleRankingPoints(checked) {
    window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled = checked;
    saveConfig();
    renderScoreboardLeaderboard();
}

// ==================== 排行榜计算与渲染 ====================

export function computeLeaderboard() {
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
            const rp = window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled ? getRankingPoints(entry.rank, mode) : 0;
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

export function renderScoreboardLeaderboard() {
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

// ==================== 悬浮窗 OBS 纯净排行榜 ====================

export function openOverlayWindow(scope) {
    // scope = 'current' | 'global'，默认 'global' 兼容旧行为
    scope = scope || 'global';

    // 保存当前回合索引到持久化数据
    window.CURRENT_CONFIG.scoreboard.currentRoundIndex = state.currentScoreboardRoundIndex;
    saveConfig();

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
    const existingWin = scope === 'current' ? state.currentOverlayWin : state.globalOverlayWin;
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
        state.currentOverlayWin = newWin;
    } else {
        state.globalOverlayWin = newWin;
    }

    // 打开新窗口后，重新聚焦另一个悬浮窗，防止被挤到后台
    const otherWin = scope === 'current' ? state.globalOverlayWin : state.currentOverlayWin;
    if (otherWin && !otherWin.closed) {
        setTimeout(() => { otherWin.focus(); }, 200);
    }
}

export function initOverlayMode() {
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

    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
        document.getElementById('overlay-leaderboard-table').style.display = 'none';
        document.getElementById('overlay-empty-hint').style.display = 'block';
        return;
    }

    let config;
    try {
        config = JSON.parse(cached);
    } catch (e) {
        document.getElementById('overlay-leaderboard-table').style.display = 'none';
        document.getElementById('overlay-empty-hint').style.display = 'block';
        return;
    }

    if (config && config.scoreboard && config.scoreboard.currentRoundIndex !== undefined) {
        state.currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
    }

    window.CURRENT_CONFIG = config;

    renderOverlayLeaderboard();

    window.addEventListener('storage', onOverlayStorage);

    // 2秒定时轮询更新（作为 storage 跨标签页监听器的可靠同步兜底）
    setInterval(() => {
        const latest = localStorage.getItem(STORAGE_KEY);
        if (latest) {
            let latestConfig;
            try {
                latestConfig = JSON.parse(latest);
            } catch (e) {
                return;
            }
            window.CURRENT_CONFIG = latestConfig;

            const latestRoundIndex = (latestConfig.scoreboard && latestConfig.scoreboard.currentRoundIndex !== undefined)
                ? latestConfig.scoreboard.currentRoundIndex : 0;

            state.currentScoreboardRoundIndex = latestRoundIndex;
            renderOverlayLeaderboard();
        }
    }, 2000);
}

export function onOverlayStorage(event) {
    if (event.key !== 'UP_LOTTERY_SMART_CACHE') return;
    if (!event.newValue) return;

    try {
        const config = JSON.parse(event.newValue);
        if (config && config.scoreboard && config.scoreboard.currentRoundIndex !== undefined) {
            state.currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
        }
        window.CURRENT_CONFIG = config; // 同步最新内存
    } catch (e) {
        return;
    }

    renderOverlayLeaderboard();
}

export function getAllPlayerNames() {
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
export function computeOverlayScores() {
    const rounds = getActiveRounds();
    const mode = getActiveMode();
    const rankingEnabled = window.CURRENT_CONFIG.scoreboard.globalRankingPointsEnabled;
    const currentRound = rounds[state.currentScoreboardRoundIndex];
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
            if (roundIndex === state.currentScoreboardRoundIndex && !isCurrentRoundConfirmed) return;

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

export function renderOverlayLeaderboard() {
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
            ? `<img src="${escapeHTML(getHeroImage(player.hero))}" class="ov-hero-img"
                 onclick="toggleElimination('${escapeJS(player.name)}')"
                 onerror="var span=document.createElement('span');span.className='ov-hero-empty';this.replaceWith(span);"
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

export function overlayKillChange(playerName, delta) {
    const cached = localStorage.getItem(STORAGE_KEY);
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    window.CURRENT_CONFIG.scoreboard = config.scoreboard;
    state.currentScoreboardRoundIndex = roundIndex;

    renderOverlayLeaderboard();
}

export function onMainStorage(event) {
    if (event.key !== 'UP_LOTTERY_SMART_CACHE') return;
    if (!event.newValue) return;
    if (state.overlaySyncLock) return;

    state.overlaySyncLock = true;

    try {
        const config = JSON.parse(event.newValue);
        if (!config || !config.scoreboard) return;

        window.CURRENT_CONFIG = config;

        if (config.scoreboard.currentRoundIndex !== undefined) {
            state.currentScoreboardRoundIndex = config.scoreboard.currentRoundIndex;
        }

        const scoreboardTab = document.getElementById('tab-scoreboard');
        if (scoreboardTab && scoreboardTab.classList.contains('active')) {
            renderRoundTabs();
            renderRoundEditor(state.currentScoreboardRoundIndex);
            renderScoreboardLeaderboard();
        }
    } catch (e) {
        // 解析失败
    }

    setTimeout(() => {
        state.overlaySyncLock = false;
    }, 200);
}

// ==================== 排名分规则设置弹窗 ====================

export function openRankingPointsSettings() {
    const mode = getActiveMode();
    document.getElementById('rp-mode-label').textContent = mode === '12' ? '12人局' : '8人局';
    renderRankingPointsRules();
    document.getElementById('ranking-points-modal').classList.add('active');
}

export function closeRankingPointsSettings() {
    document.getElementById('ranking-points-modal').classList.remove('active');
    saveConfig();
    // 规则变化后刷新排行榜
    renderScoreboardLeaderboard();
}

export function renderRankingPointsRules() {
    const mode = getActiveMode();
    const sb = window.CURRENT_CONFIG.scoreboard;
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

export function updateRankingPointsRule(index, field, value) {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = window.CURRENT_CONFIG.scoreboard[rulesKey];
    if (!rules || !rules[index]) return;

    if (field === 'minRank' || field === 'maxRank') {
        if (isNaN(value) || value < 1) value = rules[index][field]; // 恢复原值
        rules[index][field] = value;
    } else if (field === 'points') {
        if (isNaN(value)) value = 0;
        rules[index].points = value;
    }

    saveConfig();
}

export function addRankingPointsRule() {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = window.CURRENT_CONFIG.scoreboard[rulesKey];
    if (!rules) return;

    const lastRule = rules[rules.length - 1];
    const nextMin = lastRule ? lastRule.maxRank + 1 : 1;

    rules.push({
        minRank: nextMin,
        maxRank: nextMin + 1,
        points: 0
    });

    saveConfig();
    renderRankingPointsRules();
}

export function deleteRankingPointsRule(index) {
    const mode = getActiveMode();
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    const rules = window.CURRENT_CONFIG.scoreboard[rulesKey];

    if (!rules || rules.length <= 1) {
        alert('至少需要保留 1 条排名分规则！');
        return;
    }

    if (!confirm('确定要删除这条排名分规则吗？')) return;

    rules.splice(index, 1);
    saveConfig();
    renderRankingPointsRules();
}

export function resetRankingPointsToDefault() {
    if (!confirm('确定要恢复为默认排名分规则吗？当前修改将丢失。')) return;

    const mode = getActiveMode();
    const sb = window.CURRENT_CONFIG.scoreboard;
    const rulesKey = mode === '12' ? 'rankingPointsRules12' : 'rankingPointsRules8';
    sb[rulesKey] = getDefaultRankingRules(mode);

    saveConfig();
    renderRankingPointsRules();
    renderScoreboardLeaderboard();
}

// ==================== 排名总览图 ====================

export function generateScoreboardOverview() {
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

export function closeScoreboardOverview() {
    document.getElementById('scoreboard-overview-modal').classList.remove('active');
}

export function copyOverviewToClipboard() {
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

// ==================== 导出配置 ====================

export function exportConfigJS() {
    if (!confirm("这将会生成一个全新的 'config.js' 文件。将其替换掉你文件夹里的原文件后，你的配置数据就会永久物理保存。确认导出吗？")) {
        return;
    }

    const fileContent = `// 导出的物理自定义配置文件
// 基于页面路径生成唯一命名空间，防止同域下多项目 LocalStorage 键名冲突
const STORAGE_KEY = (function() {
    const path = window.location.pathname.replace(/\\/$/, '') || '/';
    const ns = path.split('/').filter(Boolean).join('_') || 'root';
    return 'YJWJ_' + ns + '_CACHE';
})();

const DEFAULT_CONFIG = ${JSON.stringify(window.CURRENT_CONFIG, null, 4)};

// ==================== 【智能版本同步核心算法】 ====================
let CURRENT_CONFIG;

// 1. 安全读取本地缓存（try/catch 防损坏崩溃）
let localCache = null;
try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localCache = JSON.parse(raw);
} catch (e) {
    console.warn('本地缓存数据损坏，将使用默认配置重新初始化:', e);
    localCache = null;
}

// 2. 规范化版本号：旧数据无版本号视为 0，强制触发迁移
if (!localCache || typeof localCache.configVersion !== 'number') {
    localCache = localCache || {};
    localCache.configVersion = 0;
}

// 3. 判断是否需要同步磁盘文件数据
if (DEFAULT_CONFIG.configVersion > (localCache.configVersion || 0)) {
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
    let cachedWheels = localCache ? (localCache.wheelsList || DEFAULT_CONFIG.wheelsList) : DEFAULT_CONFIG.wheelsList;
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
        wheelsList: cachedWheels,
        scoreboard: cachedScoreboard
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(CURRENT_CONFIG));
} else {
    CURRENT_CONFIG = localCache;
}

// 保存配置到本地缓存
function saveConfigToLocal() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CURRENT_CONFIG));
    } catch (e) {
        console.error('保存配置失败，可能是存储空间不足:', e);
    }
}
`;

    const blob = new Blob([fileContent], { type: "text/javascript;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "config.js";
    link.click();
}

// ==================== 挂载到 window ====================

window.ScoreboardModule = {
    // Core helpers
    getSBPlayerCount,
    getRankingPoints,
    getDefaultRankingRules,
    buildDefaultEntries,
    ensureEntryFields,
    normalizeAllRounds,
    getHeroImage,

    // Hero picker
    openHeroPicker,
    selectHeroForEntry,
    clearHeroForEntry,
    closeHeroPicker,

    // Dynamic ranks
    computeDynamicRanks,
    toggleElimination,

    // FLIP
    applyFlipAnimation,

    // Init
    initScoreboardDashboard,
    switchScoreboardMode,

    // Round tabs
    renderRoundTabs,
    selectScoreboardRound,

    // Editor
    renderRoundEditor,
    onRoundEntryChange,
    confirmScoreboardRound,
    addScoreboardRound,
    deleteScoreboardRound,

    // Leaderboard
    computeLeaderboard,
    renderScoreboardLeaderboard,
    toggleRankingPoints,

    // Overlay
    openOverlayWindow,
    initOverlayMode,
    onOverlayStorage,
    getAllPlayerNames,
    computeOverlayScores,
    renderOverlayLeaderboard,
    overlayKillChange,
    onMainStorage,

    // Ranking points
    openRankingPointsSettings,
    closeRankingPointsSettings,
    renderRankingPointsRules,
    updateRankingPointsRule,
    addRankingPointsRule,
    deleteRankingPointsRule,
    resetRankingPointsToDefault,

    // Overview
    generateScoreboardOverview,
    closeScoreboardOverview,
    copyOverviewToClipboard,

    // Round ranking
    refreshRoundRankingTable,
    closeRoundRanking,
    resetScoreboardAll,

    // Export
    exportConfigJS
};
