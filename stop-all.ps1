# SMETA360 - Скрипт остановки всех серверов

Write-Host "🛑 Остановка SMETA360..." -ForegroundColor Red
Write-Host "====================================" -ForegroundColor Blue

# Останавливаем все процессы node
Write-Host "🛑 Останавливаем Node.js процессы..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    foreach ($process in $nodeProcesses) {
        Write-Host "   Останавливаем процесс $($process.Id)" -ForegroundColor White
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Все Node.js процессы остановлены" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Node.js процессы не найдены" -ForegroundColor Yellow
}

# Проверяем порты
Start-Sleep -Seconds 2
$backend = netstat -ano | findstr ":3001" | findstr "LISTENING"
$frontend = netstat -ano | findstr ":3000" | findstr "LISTENING"

if (-not $backend -and -not $frontend) {
    Write-Host "✅ Все серверы остановлены" -ForegroundColor Green
} else {
    if ($backend) { Write-Host "⚠️ Порт 3001 все еще занят" -ForegroundColor Yellow }
    if ($frontend) { Write-Host "⚠️ Порт 3000 все еще занят" -ForegroundColor Yellow }
}

Write-Host "====================================" -ForegroundColor Blue
Write-Host "✅ SMETA360 остановлен" -ForegroundColor Green