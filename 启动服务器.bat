@echo off
cd /d "%~dp0"
echo 正在启动永劫无间抽奖工具...
echo 请在浏览器打开: http://localhost:8080
echo 按 Ctrl+C 停止服务器
echo.
python -m http.server 8080
pause
