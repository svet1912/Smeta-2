@echo off
echo ========================================
echo   SMETA360 Backend Server v2.5
echo   С ролями и доступом супер-админа
echo ========================================
echo.
cd server
set NODE_TLS_REJECT_UNAUTHORIZED=0
set PORT=3001
node -e "import('./start.js').then(m => m.startServer()).catch(e => console.error('Error:', e))"
pause

