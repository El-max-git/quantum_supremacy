# Скрипт для поиска и завершения процесса, занимающего порт
# Использование: .\kill_port.ps1 [PORT]
# Пример: .\kill_port.ps1 8000

param(
    [int]$Port = 8000
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Поиск процесса на порту $Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Находим процесс, использующий порт
$connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Найден процесс:" -ForegroundColor Yellow
        Write-Host "  PID:        $($process.Id)" -ForegroundColor White
        Write-Host "  Имя:        $($process.ProcessName)" -ForegroundColor White
        Write-Host "  Путь:       $($process.Path)" -ForegroundColor White
        Write-Host "  Команда:    $($process.CommandLine)" -ForegroundColor Gray
        Write-Host ""
        
        $response = Read-Host "Завершить процесс? (y/n)"
        
        if ($response -eq 'y' -or $response -eq 'Y') {
            try {
                Stop-Process -Id $processId -Force
                Write-Host "✓ Процесс завершен!" -ForegroundColor Green
            } catch {
                Write-Host "❌ Ошибка при завершении процесса: $_" -ForegroundColor Red
            }
        } else {
            Write-Host "Отменено." -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Процесс с PID $processId не найден (возможно, уже завершен)" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Порт $Port свободен, процессы не найдены" -ForegroundColor Green
}

Write-Host ""
