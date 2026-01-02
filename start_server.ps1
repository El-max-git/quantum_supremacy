# Скрипт запуска локального сервера для проекта Quantum Supremacy
# Использование: .\start_server.ps1

$port = 8000
$host = "localhost"
$projectPath = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Запуск локального сервера" -ForegroundColor Cyan
Write-Host "  Quantum Supremacy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Адрес:     http://$host`:$port" -ForegroundColor Green
Write-Host "Директория: $projectPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для остановки сервера нажмите Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переходим в директорию проекта
Set-Location $projectPath

# Проверяем наличие Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Node.js не найден в PATH!" -ForegroundColor Red
    Write-Host "Убедитесь, что Node.js установлен и добавлен в системную переменную PATH." -ForegroundColor Yellow
    exit 1
}

# Проверяем доступность порта (опционально)
try {
    $portCheck = Test-NetConnection -ComputerName $host -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($portCheck) {
        Write-Host "ВНИМАНИЕ: Порт $port уже занят!" -ForegroundColor Yellow
        Write-Host "Используйте другой порт или завершите процесс, занимающий порт." -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    # Игнорируем ошибки проверки порта
}

Write-Host "Запуск сервера..." -ForegroundColor Green
Write-Host ""

# Запускаем сервер через npm
npm run start
