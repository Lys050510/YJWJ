// ==================== 模块三：人员抽取 ====================

import { state } from '../core/state.js';
import { escapeHTML, escapeJS } from '../core/utils.js';
import { saveConfig } from '../core/storage.js';

// 重置并展示人员正面
export function resetAndShowPlayersFront() {
    if (state.isPlayerShuffling) return;

    document.getElementById('players-history-list').innerHTML = '';

    const activePlayers = window.CURRENT_CONFIG.players.filter(p => window.CURRENT_CONFIG.activePlayerNames.includes(p.name));

    document.getElementById('player-pool-count').innerText = `当前出场人数：${activePlayers.length} 人`;

    const container = document.getElementById('player-cards-container');
    container.innerHTML = '';

    if (activePlayers.length === 0) {
        container.innerHTML = `<div style="color: #888; font-size: 18px; margin-top: 20px;">请点击右上角「⚙️ 人员名单设置」勾选参与抽取的选手！</div>`;
        return;
    }

    state.playerDeck = activePlayers.map((p, idx) => ({
        player: p,
        isFaceDown: false,
        revealed: true,
        index: idx
    }));

    renderPlayerCardsHTML();
}

// 重新渲染人员卡牌 DOM
export function renderPlayerCardsHTML() {
    const container = document.getElementById('player-cards-container');
    container.innerHTML = '';

    state.playerDeck.forEach((deckItem, idx) => {
        const cardBox = document.createElement('div');
        cardBox.className = `card-container ${deckItem.isFaceDown ? 'face-down' : ''} ${state.isPlayerShuffling ? 'locked' : ''}`;
        cardBox.id = `player-card-box-${idx}`;
        cardBox.onclick = () => revealPlayerCard(idx);

        cardBox.innerHTML = `
            <div class="card-inner">
                <!-- 正面 -->
                <div class="card-front">
                    <img src="${escapeHTML(deckItem.player.image)}" onerror="this.style.display='none';var fb=this.parentElement.querySelector('.card-player-fallback');if(fb)fb.style.display='flex';">
                    <div class="card-player-fallback" style="display:none;">
                        ${escapeHTML(deckItem.player.name[0])}
                    </div>
                    <div class="card-player-name">${escapeHTML(deckItem.player.name)}</div>
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
export function flipAndShufflePlayers() {
    if (state.isPlayerShuffling) return;

    if (state.playerDeck.length === 0) {
        alert("场上没有任何选手，请前往设置中勾选参与抽取的名单！");
        return;
    }

    // 同步更新当前出场人数显示
    const activePlayers = window.CURRENT_CONFIG.players.filter(p => window.CURRENT_CONFIG.activePlayerNames.includes(p.name));
    document.getElementById('player-pool-count').innerText = `当前出场人数：${activePlayers.length} 人`;

    state.isPlayerShuffling = true;
    document.getElementById('player-shuffle-btn').disabled = true;
    document.getElementById('player-shuffle-btn').innerText = "卡牌翻转中...";

    // 1. 卡牌翻转到背面
    state.playerDeck.forEach((item, idx) => {
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
            for (let i = state.playerDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = state.playerDeck[i].player;
                state.playerDeck[i].player = state.playerDeck[j].player;
                state.playerDeck[j].player = temp;
            }

            cardEls.forEach(el => {
                el.classList.remove('shuffling-animation');
            });

            state.isPlayerShuffling = false;
            document.getElementById('player-shuffle-btn').disabled = false;
            document.getElementById('player-shuffle-btn').innerText = "🎴 翻转并洗牌";

            renderPlayerCardsHTML();
        }, 1000);

    }, 600);
}

// 翻开单张卡牌
export function revealPlayerCard(cardIdx) {
    if (state.isPlayerShuffling) return;

    const deckItem = state.playerDeck[cardIdx];
    if (!deckItem.isFaceDown || deckItem.revealed) return;

    deckItem.isFaceDown = false;
    deckItem.revealed = true;

    const el = document.getElementById(`player-card-box-${cardIdx}`);
    if (el) {
        el.classList.remove('face-down');
    }

    const list = document.getElementById('players-history-list');
    const li = document.createElement('li');
    li.innerHTML = `位置 [${cardIdx + 1}] 翻开揭晓：<strong>${escapeHTML(deckItem.player.name)}</strong>`;
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
}


// ==================== 模块三 (副)：人员配置管理 ====================

export function openPlayerSettings() {
    initPlayerSettingsGrid();
    document.getElementById('player-settings-modal').classList.add('active');
}

export function closePlayerSettings() {
    document.getElementById('player-settings-modal').classList.remove('active');
    saveConfig();
    // 洗牌进行中时不强制重置，避免打断动画
    if (!state.isPlayerShuffling) {
        resetAndShowPlayersFront();
    }
}

export function toggleAddPlayerForm(show) {
    const form = document.getElementById('add-player-form');
    if (show === undefined) {
        form.classList.toggle('hidden');
    } else if (show) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
}

export function submitNewPlayer() {
    const nameInput = document.getElementById('new-player-name');
    const fileInput = document.getElementById('new-player-image-file');
    const pathInput = document.getElementById('new-player-image-path');

    const name = nameInput.value.trim();
    if (!name) {
        alert("请输入选手名字！");
        return;
    }

    if (window.CURRENT_CONFIG.players.some(p => p.name === name)) {
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
        const finalPath = pathVal || "assets/players/default.webp";
        addNewPlayerToDB(name, finalPath);
    }
}

export function addNewPlayerToDB(name, imageSrc) {
    const newPlayer = {
        name: name,
        image: imageSrc
    };

    window.CURRENT_CONFIG.players.push(newPlayer);
    window.CURRENT_CONFIG.activePlayerNames.push(name);
    saveConfig();

    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-image-file').value = '';
    document.getElementById('new-player-image-path').value = '';

    toggleAddPlayerForm(false);
    initPlayerSettingsGrid();

    alert(`选手【${name}】已成功加入选手库！`);
}

export function deletePlayerFromDB(playerName) {
    if (!confirm(`确定要将选手【${playerName}】彻底从数据库中删除吗？（不可逆）`)) {
        return;
    }

    window.CURRENT_CONFIG.players = window.CURRENT_CONFIG.players.filter(p => p.name !== playerName);
    window.CURRENT_CONFIG.activePlayerNames = window.CURRENT_CONFIG.activePlayerNames.filter(n => n !== playerName);
    saveConfig();

    initPlayerSettingsGrid();
}

export function initPlayerSettingsGrid() {
    const container = document.getElementById('players-checkbox-container');
    container.innerHTML = '';

    window.CURRENT_CONFIG.players.forEach(p => {
        const isChecked = window.CURRENT_CONFIG.activePlayerNames.includes(p.name);

        const itemBox = document.createElement('div');
        itemBox.className = 'hero-manage-item';
        itemBox.innerHTML = `
            <label>
                <input type="checkbox" value="${escapeHTML(p.name)}" ${isChecked ? 'checked' : ''} onchange="window.PlayerModule.onPlayerCheckboxChange(this)">
                <span>${escapeHTML(p.name)}</span>
            </label>
            <button class="hero-delete-btn" title="物理彻底删除" onclick="window.PlayerModule.deletePlayerFromDB('${escapeJS(p.name)}')">🗑️</button>
        `;
        container.appendChild(itemBox);
    });
}

export function onPlayerCheckboxChange(cb) {
    const name = cb.value;
    if (cb.checked) {
        if (!window.CURRENT_CONFIG.activePlayerNames.includes(name)) {
            window.CURRENT_CONFIG.activePlayerNames.push(name);
        }
    } else {
        window.CURRENT_CONFIG.activePlayerNames = window.CURRENT_CONFIG.activePlayerNames.filter(n => n !== name);
    }
}

export function toggleAllPlayers(selectAll) {
    const checkboxes = document.querySelectorAll('#players-checkbox-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        onPlayerCheckboxChange(cb);
    });
}

export function getDeckLength() {
    return state.playerDeck.length;
}

// 挂载到 window 以支持 onclick 属性和旧代码兼容
window.PlayerModule = {
    resetAndShowPlayersFront,
    renderPlayerCardsHTML,
    flipAndShufflePlayers,
    revealPlayerCard,
    openPlayerSettings,
    closePlayerSettings,
    toggleAddPlayerForm,
    submitNewPlayer,
    addNewPlayerToDB,
    deletePlayerFromDB,
    initPlayerSettingsGrid,
    onPlayerCheckboxChange,
    toggleAllPlayers,
    getDeckLength
};
