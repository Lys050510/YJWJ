// ==================== 全局可变状态 ====================
// 所有模块间共享的状态变量集中管理

// Hero 模块
export let isScrolling = false;

// Weapon 模块
export let isWeaponScrolling = false;

// Player 模块
export let isPlayerShuffling = false;
export let playerDeck = [];

// Tips 模块
export let currentTipPool = 'challenger';
export let drawnTipCards = [];
export let flippedTipCount = 0;
export let tipRefreshesRemaining = 0;
export let activeTipMarqueeInterval = null;
export let isMarqueeDragging = false;
export let marqueeStartX, marqueeScrollLeft;
export let isInitialDealing = false;

// Prize 模块
export let isPrizeDrawing = false;

// Wheel 模块
export let isSpinning = false;
export let canvas, ctx;
export let currentRotation = 0;

// Scoreboard 模块
export let currentScoreboardRoundIndex = 0;
export let overlaySyncLock = false;
export let globalEliminationCounter = 0;
export let heroPickerRoundIndex = -1;
export let heroPickerEntryIndex = -1;
export let overlayFlipEnabled = false;
export let currentOverlayWin = null;
export let globalOverlayWin = null;

// CURRENT_CONFIG 由 config.js 挂载到 window，这里提供便捷访问
export function getConfig() {
    return window.CURRENT_CONFIG;
}
