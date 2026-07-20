// ==================== 主入口 ====================
// 由 <script type="module" src="js/app.js"> 加载

import { switchTab, registerTabActivator } from './ui/tabs.js';

import './modules/prize.js';
import './modules/hero.js';
import './modules/weapon.js';
import './modules/player.js';
import './modules/tips.js';
import './modules/wheel.js';
import './modules/scoreboard.js';
import './modules/sponsor.js';

// ── 挂载全局函数（保持 HTML onclick 兼容） ──
window.switchTab = switchTab;

function mountGlobalFunctions() {
    const modules = ['PrizeModule', 'HeroModule', 'WeaponModule', 'PlayerModule',
                     'TipsModule', 'WheelModule', 'ScoreboardModule', 'SponsorModule'];
    modules.forEach(name => {
        const mod = window[name];
        if (mod) {
            Object.keys(mod).forEach(key => {
                if (!(key in window)) {
                    window[key] = mod[key];
                }
            });
        }
    });
}

// ── 初始化 ──
window.onload = function () {
    if (window.location.search.includes('view=overlay')) {
        if (window.ScoreboardModule && window.ScoreboardModule.initOverlayMode) {
            window.ScoreboardModule.initOverlayMode();
        }
        return;
    }

    mountGlobalFunctions();

    if (window.ScoreboardModule && window.ScoreboardModule.onMainStorage) {
        window.addEventListener('storage', window.ScoreboardModule.onMainStorage);
    }

    if (window.WheelModule && window.WheelModule.syncPresetWheels) {
        window.WheelModule.syncPresetWheels();
    }

    if (window.WheelModule && window.WheelModule.initWheelSelector) {
        window.WheelModule.initWheelSelector();
    }

    switchTab('hero');

    if (window.WeaponModule && window.WeaponModule.syncWeaponUIControls) {
        window.WeaponModule.syncWeaponUIControls();
    }
};
