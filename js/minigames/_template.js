// ==================== 小游戏开发模板 ====================
// 模块九：小游戏集合
// 每个小游戏一个文件，使用懒加载 (dynamic import)

/*
使用方法：
1. 复制此模板，重命名为你的游戏名.js
2. 实现 start(container) 和 stop() 函数
3. 在父模块中通过 dynamic import 加载：
   const game = await import('./minigames/snake.js');
   game.start(document.getElementById('game-container'));

游戏文件规范：
- 必须导出 start(container) 函数 - 接收一个 DOM 元素作为渲染容器
- 必须导出 stop() 函数 - 清理资源（计时器、事件监听器等）
- 所有 DOM 创建必须在 container 内，不要污染全局
- 游戏状态必须封装在模块作用域内
*/

// 游戏状态（模块私有）
let gameRunning = false;
let animationId = null;

/**
 * 启动游戏
 * @param {HTMLElement} container - 游戏容器元素
 */
export function start(container) {
    if (gameRunning) return;
    gameRunning = true;

    // TODO: 初始化游戏界面
    container.innerHTML = '<div style="color:#fff;text-align:center;padding:40px;">游戏加载中...</div>';

    // TODO: 游戏主循环
    function gameLoop() {
        if (!gameRunning) return;
        // 更新游戏逻辑
        animationId = requestAnimationFrame(gameLoop);
    }
    animationId = requestAnimationFrame(gameLoop);
}

/**
 * 停止游戏，清理资源
 */
export function stop() {
    gameRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    // TODO: 移除事件监听器
}

/**
 * 返回游戏信息
 */
export const info = {
    name: '未命名游戏',
    description: '游戏描述',
    thumbnail: '',  // 可选缩略图
    maxPlayers: 1,
};
