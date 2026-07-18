// ==================== 全局可变状态 ====================
// 所有模块间共享的状态变量集中管理
// 使用单个可变对象导出（ES Module 不支持直接修改导入的绑定）

export const state = {
    // Hero
    isScrolling: false,

    // Weapon
    isWeaponScrolling: false,

    // Player
    isPlayerShuffling: false,
    playerDeck: [],

    // Tips
    currentTipPool: 'challenger',
    drawnTipCards: [],
    flippedTipCount: 0,
    tipRefreshesRemaining: 0,
    activeTipMarqueeInterval: null,
    isMarqueeDragging: false,
    marqueeStartX: undefined,
    marqueeScrollLeft: undefined,
    isInitialDealing: false,

    // Prize
    isPrizeDrawing: false,

    // Wheel
    isSpinning: false,
    canvas: undefined,
    ctx: undefined,
    currentRotation: 0,

    // Scoreboard
    currentScoreboardRoundIndex: 0,
    overlaySyncLock: false,
    globalEliminationCounter: 0,
    heroPickerRoundIndex: -1,
    heroPickerEntryIndex: -1,
    overlayFlipEnabled: false,
    currentOverlayWin: null,
    globalOverlayWin: null,
};

// CURRENT_CONFIG 由 config.js 挂载到 window，这里提供便捷访问
export function getConfig() {
    return window.CURRENT_CONFIG;
}
