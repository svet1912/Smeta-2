# SMETA360 - Скрипт запуска всех серверов
# Запускает бэкенд и фронтенд одновременно

Write-Host "🚀 Запуск SMETA360..." -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Blue

# Получаем текущую директорию скрипта
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $projectDir "server"

Write-Host "📁 Проект: $projectDir" -ForegroundColor Yellow
Write-Host "📁 Сервер: $serverDir" -ForegroundColor Yellow

# Проверяем наличие необходимых файлов
if (-not (Test-Path (Join-Path $projectDir "package.json"))) {
    Write-Host "❌ Не найден package.json в корне проекта!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $serverDir "index.js"))) {
    Write-Host "❌ Не найден server/index.js!" -ForegroundColor Red
    exit 1
}

# Останавливаем существующие процессы node
Write-Host "🛑 Останавливаем существующие процессы..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Ждем немного
Start-Sleep -Seconds 1

# Запускаем бэкенд в новом окне PowerShell
Write-Host "🔧 Запускаем бэкенд сервер..." -ForegroundColor Green
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverDir'; Write-Host 'Backend starting...' -ForegroundColor Green; node index.js" -PassThru -WindowStyle Normal

# Ждем немного чтобы бэкенд успел запуститься
Start-Sleep -Seconds 3

# Запускаем фронтенд в новом окне PowerShell
Write-Host "⚛️ Запускаем фронтенд сервер..." -ForegroundColor Green
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm start" -PassThru -WindowStyle Normal

# Ждем немного
Start-Sleep -Seconds 2

Write-Host "====================================" -ForegroundColor Blue
Write-Host "🎉 Серверы запускаются!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Бэкенд:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "⚛️ Фронтенд: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 ID процессов:" -ForegroundColor Yellow
Write-Host "   Бэкенд:  $($backendProcess.Id)" -ForegroundColor White
Write-Host "   Фронтенд: $($frontendProcess.Id)" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Для остановки всех серверов запустите: .\stop-all.ps1" -ForegroundColor Red
Write-Host "====================================" -ForegroundColor Blue

# Ждем немного и проверяем статус портов
Write-Host "⏳ Проверяем доступность серверов..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Проверяем порты
$backend = netstat -ano | findstr ":3001" | findstr "LISTENING"
$frontend = netstat -ano | findstr ":3000" | findstr "LISTENING"

if ($backend) {
    Write-Host "✅ Бэкенд запущен на порту 3001" -ForegroundColor Green
} else {
    Write-Host "⚠️ Бэкенд не найден на порту 3001" -ForegroundColor Yellow
}

if ($frontend) {
    Write-Host "✅ Фронтенд запущен на порту 3000" -ForegroundColor Green
} else {
    Write-Host "⚠️ Фронтенд не найден на порту 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Открываем приложение в браузере..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "✅ Готово! SMETA360 запущен." -ForegroundColor Green