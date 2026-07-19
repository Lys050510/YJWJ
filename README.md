# 永劫无间擂台赛随机抽取工具

纯前端静态网页，为永劫无间擂台赛直播提供：英雄/武器/人员/锦囊/奖品抽取、转盘、计分排名等功能。

> 🚀 已上线：**[yjwj666.top](https://yjwj666.top/)**（Cloudflare + GitHub Pages，国内可直接访问）

## 技术栈

| 项 | 选型 |
|---|------|
| 框架 | 无框架，原生 HTML + CSS + JS |
| 模块化 | ES Module（`<script type="module">`） |
| 数据持久化 | `localStorage`，键名基于路径命名空间 `YJWJ_*_CACHE`（防同源冲突） |
| 构建 | 无构建工具，静态文件直接部署 |
| CSS | 自定义属性（CSS Variables），12 个源文件 → 生产合并为 1 个 `main.css` |
| 图片 | WebP 格式，卡片背景 50MB → 1MB（压缩 98%） |
| 加载优化 | CSS 合并 + 图片 WebP + JS modulepreload 预加载 |
| 兼容 | Chrome / Edge / Firefox 现代版本 |

## 快速开始

```bash
# 本地开发：必须通过 HTTP 服务器访问（ES Module 不支持 file:// 协议）
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> **为什么不能双击 index.html？**  
> ES Module 受浏览器安全策略限制，`file://` 协议下会报 CORS 错误。部署到服务器 / GitHub Pages 后无此限制。

### 构建工具

```bash
# 编辑 CSS 后重新合并（12 个独立文件 → 1 个 main.css）
bash tools/build-css.sh

# 添加新图片后批量转 WebP
python tools/compress_images.py
```

## 目录结构

```
YJWJ/
├── index.html               # 主页面（770行 → 精简后）
├── package.json              # npm start / npx serve .
│
├── css/                      # CSS（12个源文件 + 1个合并文件）
│   ├── variables.css         #   设计令牌：颜色、间距、圆角、阴影
│   ├── layout.css            #   全局布局：导航栏、主容器、标签系统
│   ├── components.css        #   通用组件：按钮、弹窗、表单、卡片、滚动框
│   ├── animations.css        #   所有 @keyframes 动画
│   ├── weapons.css            #   武器控制栏、品质辉光
│   ├── players.css            #   人员卡片、3D翻转、洗牌动画
│   ├── prizes.css             #   奖品卡片、跑马灯
│   ├── tips.css               #   锦囊子标签、跑马灯、品质边框
│   ├── wheel.css              #   转盘Canvas、配置面板
│   ├── scoreboard.css         #   计分板三栏布局、编辑器、排行榜
│   ├── overlay.css            #   OBS悬浮窗样式
│   ├── responsive.css         #   响应式：480px / 768px / 1024px 断点
│   └── main.css              #   ⚡ 生产加载（1次HTTP请求代替12次）
│
├── js/
│   ├── config.js              # 全局配置（非模块 script，最先加载）
│   │                          #   - DEFAULT_CONFIG：英雄/武器/人员/锦囊/奖品/转盘数据
│   │                          #   - 智能版本同步：configVersion 递增即可让用户端刷新
│   │                          #   - window.CURRENT_CONFIG：运行时可变配置
│   │                          #   - window.saveConfigToLocal()：持久化保存
│   │
│   ├── app.js                 # ES Module 入口
│   │                          #   1. 导入所有模块（触发 window.XxxModule 挂载）
│   │                          #   2. mountGlobalFunctions() 将模块函数复制到 window 全局
│   │                          #   3. window.onload 初始化
│   │
│   ├── core/                  # 基础设施层
│   │   ├── state.js           #   全局可变状态对象 { state }（所有模块共享）
│   │   ├── storage.js         #   localStorage 安全读写 + 路径命名空间 + 容量预警 + 防抖保存
│   │   ├── utils.js           #   escapeHTML, escapeJS, shuffleArray, hslToHex 等
│   │   ├── dom.js             #   DOM 元素懒加载缓存 getEl(id)
│   │   └── crud.js            #   通用 CRUD 辅助（表单切换、勾选网格、全选）
│   │
│   ├── ui/                    # UI 基础设施
│   │   ├── tabs.js            #   标签页切换 switchTab() + 模块激活注册
│   │   └── toast.js           #   Toast 通知系统 showToast(msg, type)（替代 alert）
│   │
│   ├── modules/               # 业务模块（7个，每个 ≈300-500 行）
│   │   ├── hero.js            #   模块一：英雄抽取 + 英雄配置弹窗
│   │   ├── weapon.js          #   模块二：武器抽取 + 武器配置弹窗
│   │   ├── player.js          #   模块三：人员卡牌抽取 + 3D翻转洗牌
│   │   ├── tips.js            #   模块四：锦囊抽取 + 跑马灯 + 品质概率
│   │   ├── prize.js           #   模块五：奖品跑马灯 + 权重抽奖
│   │   ├── wheel.js           #   模块六：Canvas转盘 + 5个动态预设
│   │   └── scoreboard.js      #   模块七：计分板 + OBS悬浮窗 + 排名总览
│   │
│   └── minigames/             # 模块九（未来）：小游戏集合
│       └── _template.js       #   游戏开发模板
│
├── tools/                    # 构建工具脚本
│   ├── build-css.sh           #   CSS 合并脚本
│   └── compress_images.py     #   PNG/JPEG → WebP 批量转换
│
└── assets/                    # 图片资源（WebP + 原始 PNG）
    ├── bg.webp                #   页面背景（139 KB，原 7 MB）
    ├── card-bg*.webp          #   卡片背景（7张，共 0.6 MB，原 51 MB）
    ├── heroes/                #   27个英雄头像（2-4 KB WebP）
    ├── weapons/               #   24个武器图标（2-5 KB WebP）
    └── players/               #   5个选手照片（7-28 KB WebP）
```

## 架构设计

### 模块间通信

```
index.html
  ├── <script src="js/config.js">      ← 普通脚本，第一加载，设置 window.CURRENT_CONFIG
  └── <script type="module" src="js/app.js">  ← ES Module 入口
        ├── 导入 tabs.js          → window.switchTab 暴露
        ├── 导入 7 个业务模块     → 各自挂载 window.XxxModule = { ... }
        └── window.onload
              ├── mountGlobalFunctions()  → 将 window.XxxModule.xxx 复制到 window.xxx
              └── switchTab('hero')       → 初始化默认标签页
```

### 状态共享

**核心原则：ES Module 的 import 绑定是只读的，不可重新赋值。**

解决方案：`js/core/state.js` 导出单个可变对象 `{ state }`：

```js
// state.js
export const state = { isScrolling: false, playerDeck: [], ... };
```

```js
// 业务模块
import { state } from '../core/state.js';
state.isScrolling = true;   // ✅ 修改对象属性，合法
```

所有需要跨模块共享的锁变量、动画状态、计数器都在 `state` 对象中。

### 配置系统

`js/config.js` 使用**智能版本同步**机制：

1. `DEFAULT_CONFIG.configVersion` 是一个纯数字（当前为 15）
2. 页面加载时，比较 `configVersion` 与 `localStorage` 中的版本（旧数据无版本号视为 0，强制触发迁移）
3. 如果磁盘版本更高 → 合并：新数据从 DEFAULT_CONFIG 取，用户设置从 localStorage 保留
4. 如果版本一致 → 直接从 localStorage 加载
5. LocalStorage 键名基于 `location.pathname` 自动生成（如 `YJWJ_yjwj-lottery_CACHE`），防止同源多项目冲突

**修改配置的正确姿势**：
1. 编辑 `js/config.js` 中的 `DEFAULT_CONFIG`（如新增英雄/武器/锦囊）
2. 将 `configVersion` +1
3. 用户刷新页面时自动载入新数据，同时保留其个人设置

## 开发指南

### 添加新模块（如模块八：模拟开箱）

1. 创建 `js/modules/lootbox.js`
2. 在 `js/modules/lootbox.js` 中：
   ```js
   import { state } from '../core/state.js';
   import { saveConfig } from '../core/storage.js';
   // ... 业务逻辑 ...
   window.LootboxModule = { /* 公开函数 */ };
   ```
3. 在 `js/app.js` 中添加 `import './modules/lootbox.js';`
4. 在 `js/app.js` 的 `mountGlobalFunctions` 数组中添加 `'LootboxModule'`
5. 在 `js/ui/tabs.js` 的 `switchTab` 中添加 `case 'lootbox':`
6. 在 `index.html` 中添加标签按钮和新面板 div
7. 创建 `css/lootbox.css`，在 `index.html` 中添加 link

### 添加小游戏（模块九）

1. 复制 `js/minigames/_template.js` 为你的游戏名.js
2. 实现 `start(container)` 和 `stop()` 函数
3. 使用**动态 import** 实现懒加载：
   ```js
   button.onclick = async () => {
       const game = await import('./minigames/snake.js');
       game.start(document.getElementById('game-container'));
   };
   ```

### CSS 变量规范

所有颜色通过 `css/variables.css` 中的变量使用，不要硬编码：

```css
/* ✅ 正确 */
border-color: var(--color-gold);
color: var(--color-text-muted);

/* ❌ 错误 */
border-color: #b3863b;
color: #aaa;
```

### 图片格式

图片已全部转为 WebP（卡片背景 50MB → 1MB，节省 98%）。新增图片请使用 WebP 格式，或放入 `assets/` 后运行 `python tools/compress_images.py` 批量转换。原始 PNG 文件保留在 `assets/` 下作为备份。

## 部署上线

> **当前状态**：已部署在 **[yjwj666.top](https://yjwj666.top/)**，通过 Cloudflare DNS 代理 GitHub Pages，国内直连访问。

本项目是纯静态文件，可部署到任何静态托管服务。

**当前方案：GitHub Pages + Cloudflare 自定义域名**
1. 代码推送至 GitHub → GitHub Pages 自动部署 `lys050510.github.io/YJWJ/`
2. Cloudflare DNS 将 `yjwj666.top` CNAME 到 GitHub Pages
3. Cloudflare CDN 提供国内加速 + 免费 HTTPS

**更新流程**：`git push` → 等 1-2 分钟自动生效（如有缓存，在 Cloudflare 清除）

**备选平台**：也支持 Vercel、Netlify、Cloudflare Pages、腾讯云 EdgeOne Pages 等，直接拖拽文件夹即可上线。

## 安全性

- **XSS 防御**：所有用户输入（选手名、奖品名、锦囊名/描述、武器名、转盘选项等）渲染到 DOM 前均通过 `escapeHTML()` / `escapeJS()` 转义
- **资源兜底**：所有 `<img>` 标签均配置 `onerror` 回落，使用 `querySelector` 查找 fallback 元素（而非脆弱的 `nextElementSibling`）
- **存储安全**：`localStorage` 读写均有 try/catch 保护；超过 4MB 自动 toast 预警；日志自动裁剪（奖品日志 ≤500 条，锦囊日志 ≤200 条）
- **`<base href="./">`**：防御性标签，防止未来误写绝对根路径 `/assets/...` 导致子目录部署 404

## 模块功能速览

| 模块 | 标签 | 核心交互 |
|------|------|----------|
| 英雄抽取 | 1 | 滚动动画随机英雄 + 技能(F) + 奥义(V)，可配置参与池 |
| 武器抽取 | 2 | 近战/远程筛选、品质随机辉光、多抽依次揭晓 |
| 人员抽取 | 3 | 3D翻转卡牌 + 聚散洗牌动画 |
| 锦囊抽取 | 4 | 双卡池(挑战者/擂主)、品质概率、跑马灯、单卡刷新 |
| 奖品抽取 | 5 | 变速跑马灯、权重抽奖、中奖记录 |
| 转盘 | 6 | Canvas绘制、5个动态预设、自定义转盘CRUD |
| 计分板 | 7 | 8/12人局、回合编辑、排名分、OBS悬浮窗双屏联动 |
| 模拟开箱 | — | 🚧 计划中 |
| 小游戏 | — | 🚧 计划中，动态import懒加载 |
