// ==================== 主入口 ====================
// 由 <script type="module" src="js/app.js"> 加载

// ── 调试：在页面上显示加载状态 ──
const debugEl = document.createElement('div');
debugEl.id = '_module_debug';
debugEl.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#111;color:#0f0;padding:8px;font:12px monospace;z-index:99999;max-height:120px;overflow-y:auto;';
document.body.appendChild(debugEl);

function debugLog(msg) {
    debugEl.textContent += msg + '\n';
    console.log('[app]', msg);
}

window.addEventListener('error', function(e) {
    debugLog('ERROR: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
});

debugLog('app.js starting...');

// 导入标签页系统
import { switchTab, registerTabActivator } from './ui/tabs.js';
debugLog('tabs.js loaded OK');

// 导入所有模块
import './modules/prize.js';
debugLog('prize.js loaded OK');

import './modules/hero.js';
debugLog('hero.js loaded OK');

import './modules/weapon.js';
debugLog('weapon.js loaded OK');

import './modules/player.js';
debugLog('player.js loaded OK');

import './modules/tips.js';
debugLog('tips.js loaded OK');

import './modules/wheel.js';
debugLog('wheel.js loaded OK');

import './modules/scoreboard.js';
debugLog('scoreboard.js loaded OK');

debugLog('All modules loaded!');

// ── 挂载全局函数 ──
window.switchTab = switchTab;
debugLog('window.switchTab set');

function mountGlobalFunctions() {
    const modules = ['PrizeModule', 'HeroModule', 'WeaponModule', 'PlayerModule',
                     'TipsModule', 'WheelModule', 'ScoreboardModule'];
    modules.forEach(name => {
        const mod = window[name];
        if (mod) {
            Object.keys(mod).forEach(key => {
                if (!(key in window)) {
                    window[key] = mod[key];
                }
            });
        } else {
            debugLog('WARNING: window.' + name + ' not found!');
        }
    });
}

// ── 初始化 ──
window.onload = function () {
    debugLog('onload firing...');

    if (window.location.search.includes('view=overlay')) {
        if (window.ScoreboardModule && window.ScoreboardModule.initOverlayMode) {
            window.ScoreboardModule.initOverlayMode();
        }
        return;
    }

    mountGlobalFunctions();
    debugLog('mountGlobalFunctions done');

    if (window.ScoreboardModule && window.ScoreboardModule.onMainStorage) {
        window.addEventListener('storage', window.ScoreboardModule.onMainStorage);
    }

    if (window.WheelModule && window.WheelModule.syncPresetWheels) {
        window.WheelModule.syncPresetWheels();
        debugLog('syncPresetWheels done');
    }

    if (window.WheelModule && window.WheelModule.initWheelSelector) {
        window.WheelModule.initWheelSelector();
        debugLog('initWheelSelector done');
    }

    switchTab('hero');
    debugLog('switchTab(hero) done');

    if (window.WeaponModule && window.WeaponModule.syncWeaponUIControls) {
        window.WeaponModule.syncWeaponUIControls();
        debugLog('syncWeaponUIControls done');
    }

    debugLog('onload complete!');
};

debugLog('app.js init complete, waiting for onload...');
