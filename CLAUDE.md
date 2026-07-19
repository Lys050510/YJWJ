# CLAUDE.md

永劫无间擂台赛随机抽取工具 — 纯前端静态网页项目。

## 技术概要

- **无框架**，原生 HTML + CSS + JS，ES Module 架构
- **无构建工具**，静态文件直接部署
- **数据持久化**：`localStorage`，键名基于 `location.pathname` 自动生成命名空间
- **CSS**：12 个模块化文件 + CSS Variables 设计令牌。生产环境加载合并后的 `css/main.css`（1 次请求代替 12 次）。日常编辑改独立文件，运行 `bash tools/build-css.sh` 重新合并
- **图片格式**：统一使用 WebP（`assets/compress_images.py` 可批量转换 PNG→WebP）。卡片背景图从 50MB 压缩到 0.6MB（缩放至最长边 800px）

## 文件入口与加载顺序

```
index.html
  ├── <link rel="stylesheet" href="css/main.css">   ← 合并后的 CSS（12→1）
  ├── <link rel="modulepreload" href="js/app.js">   ← 预加载 JS 模块，避免链式等待
  ├── ... (15 个 modulepreload 链接)
  ├── <script src="js/config.js">                   ← 普通脚本，最优先加载
  └── <script type="module" src="js/app.js">        ← ES Module 入口
```

## 架构关键点

### 模块间通信
- 各业务模块将公开函数挂载到 `window.XxxModule = { ... }`
- `app.js` 的 `mountGlobalFunctions()` 将 `window.XxxModule.xxx` 复制到 `window.xxx`，供 HTML `onclick` 属性直接调用
- 跨模块共享的可变状态存放在 `js/core/state.js` 导出的 `state` 对象中（ES Module 不能重新赋值 import 绑定，但可修改对象属性）

### 配置系统
- `DEFAULT_CONFIG.configVersion` 递增即可让用户端自动同步新配置
- 版本迁移逻辑：旧数据无 `configVersion` 视为 0，强制触发迁移
- `CURRENT_CONFIG` 挂载到 `window.CURRENT_CONFIG`

### 安全规范
- **所有用户输入渲染到 DOM 前必须转义**：HTML 上下文用 `escapeHTML()`，JS 字符串上下文用 `escapeJS()`
- **`<img>` 标签必须有 `onerror` 回落**：使用 `querySelector` 查找 fallback 元素
- **LocalStorage 读写必须 try/catch 包裹**
- **日志有上限**：奖品日志 ≤ 500 条，锦囊日志 ≤ 200 条，防止存储溢出

## 开发约定

- 使用 `escapeHTML()` / `escapeJS()` 来自 `js/core/utils.js`
- 保存配置统一用 `saveConfig()` from `js/core/storage.js`
- 高频输入事件用 `saveConfigDebounced(delay)` 替代 `saveConfig()`
- `<base href="./">` 已设置，所有资源路径使用相对路径（不要以 `/` 开头）
- 颜色使用 CSS 变量（`var(--color-*)`），不硬编码色值
- **新增图片统一用 WebP 格式**，PNG/JPEG 放 `assets/` 后运行 `python tools/compress_images.py` 转换

## 工具脚本（tools/ 目录）

| 脚本 | 用途 |
|------|------|
| `bash tools/build-css.sh` | 从 12 个独立 CSS 文件重新合并 `css/main.css` |
| `python tools/compress_images.py` | 批量转换 `assets/` 下所有 PNG/JPEG → WebP |

## 添加新模块

1. 创建 `js/modules/xxx.js`，挂载 `window.XxxModule = { ... }`
2. 在 `js/app.js` 添加 `import './modules/xxx.js'`，并在 `mountGlobalFunctions` 数组追加 `'XxxModule'`
3. 在 `js/ui/tabs.js` 的 `switchTab` 添加 `case 'xxx':`
4. 在 `index.html` 添加标签按钮和面板 div
5. 创建 `css/xxx.css`，在 `index.html` 添加 `<link>`
