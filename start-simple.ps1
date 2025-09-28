# SMETA360 - Start All Servers
Write-Host "Starting SMETA360..." -ForegroundColor Green
Write-Host "===================" -ForegroundColor Blue

# Get script directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $projectDir "server"

# Stop existing node processes
Write-Host "Stopping existing processes..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start backend
Write-Host "Starting backend server..." -ForegroundColor Green
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverDir'; node index.js" -PassThru

# Wait for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend server..." -ForegroundColor Green  
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir'; npm start" -PassThru

# Wait and check
Start-Sleep -Seconds 5
Write-Host "===================" -ForegroundColor Blue
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend PID: $($backend.Id)" -ForegroundColor White
Write-Host "Frontend PID: $($frontend.Id)" -ForegroundColor White
Write-Host "===================" -ForegroundColor Blue

# Open browser
Start-Process "http://localhost:3000"
Write-Host "Ready! SMETA360 started." -ForegroundColor Green