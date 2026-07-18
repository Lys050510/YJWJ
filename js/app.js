// ==================== 主入口 ====================
// 由 <script type="module" src="js/app.js"> 加载

// 导入标签页系统
import { switchTab, registerTabActivator } from './ui/tabs.js';

// 导入所有模块（公开函数将在模块加载时挂载到 window）
import './modules/prize.js';
import './modules/hero.js';
import './modules/weapon.js';
import './modules/player.js';
import './modules/tips.js';
import './modules/wheel.js';
import './modules/scoreboard.js';

// ── 挂载全局函数（保持 onclick 兼容） ──
window.switchTab = switchTab;

// 模块的公开函数由各自的 js/modules/*.js 文件
// 通过 window.ModuleName = { ... } 挂载到全局

// ── 也挂载模块函数直接到 window（兼容内联 onclick="startHeroDraw()"） ──
// 这些在模块加载后延迟执行
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
        }
    });
}

// ── 初始化 ──
window.onload = function () {
    // 悬浮窗模式分流检测
    if (window.location.search.includes('view=overlay')) {
        // overlay 初始化由 ScoreboardModule 处理
        if (window.ScoreboardModule && window.ScoreboardModule.initOverlayMode) {
            window.ScoreboardModule.initOverlayMode();
        }
        return;
    }

    // 挂载所有模块函数到 window
    mountGlobalFunctions();

    // 注册主窗口 storage 监听器（接收悬浮窗的修改）
    if (window.ScoreboardModule && window.ScoreboardModule.onMainStorage) {
        window.addEventListener('storage', window.ScoreboardModule.onMainStorage);
    }

    // 同步预设转盘数据
    if (window.WheelModule && window.WheelModule.syncPresetWheels) {
        window.WheelModule.syncPresetWheels();
    }

    // 初始化转盘下拉选择框
    if (window.WheelModule && window.WheelModule.initWheelSelector) {
        window.WheelModule.initWheelSelector();
    }

    // 默认打开英雄标签页
    switchTab('hero');

    // 初始化武器界面勾选框面板状态
    if (window.WeaponModule && window.WeaponModule.syncWeaponUIControls) {
        window.WeaponModule.syncWeaponUIControls();
    }
};
