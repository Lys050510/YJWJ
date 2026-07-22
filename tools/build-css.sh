#!/bin/bash
# ==================== CSS 合并构建脚本 ====================
# 将 12 个独立 CSS 文件合并为 main.css，用于生产环境加载
# 日常编辑时修改独立文件，上线前运行此脚本重新合并即可
#
# 用法：bash tools/build-css.sh

cd "$(dirname "$0")/.."

cat \
    css/variables.css \
    css/layout.css \
    css/components.css \
    css/animations.css \
    css/weapons.css \
    css/players.css \
    css/prizes.css \
    css/tips.css \
    css/wheel.css \
    css/scoreboard.css \
    css/lootbox.css \
    css/overlay.css \
    css/responsive.css \
    > css/main.css

echo "✅ css/main.css 已重新生成 ($(wc -c < css/main.css) bytes)"
