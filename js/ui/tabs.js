// ==================== 标签页切换系统 ====================
// 模块激活回调注册表
const tabActivators = {};

export function registerTabActivator(tabId, callback) {
    tabActivators[tabId] = callback;
}

/** 标签页切换（通过 window 上的模块函数调用，避免循环依赖） */
export function switchTab(tabId) {
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick')?.includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    // 关闭离开标签页的跑马灯
    if (tabId !== 'tips') {
        const Tips = window.TipsModule;
        if (Tips && Tips.clearMarqueeInterval) {
            Tips.clearMarqueeInterval();
        }
    }

    // 调用模块激活回调
    if (tabActivators[tabId]) {
        tabActivators[tabId]();
    }

    // 通过 window 上的模块函数调用（由各模块加载时挂载）
    switch (tabId) {
        case 'hero':
            if (window.HeroModule) window.HeroModule.updateScrollBoxesDisplay();
            break;
        case 'weapon':
            if (window.WeaponModule) window.WeaponModule.syncWeaponUIControls();
            break;
        case 'players':
            if (window.PlayerModule) {
                if (window.PlayerModule.getDeckLength() === 0) {
                    window.PlayerModule.resetAndShowPlayersFront();
                } else {
                    window.PlayerModule.renderPlayerCardsHTML();
                }
            }
            break;
        case 'prize':
            if (window.PrizeModule) {
                window.PrizeModule.sortPrizes();
                window.PrizeModule.renderPrizesDisplay();
                window.PrizeModule.renderPrizeLogs();
            }
            break;
        case 'tips':
            if (window.TipsModule) window.TipsModule.initTipDashboard();
            break;
        case 'wheel':
            if (window.WheelModule) window.WheelModule.loadSelectedWheel();
            break;
        case 'scoreboard':
            if (window.ScoreboardModule) window.ScoreboardModule.initScoreboardDashboard();
            break;
    }
}
