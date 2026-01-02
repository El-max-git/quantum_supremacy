# Активация виртуального окружения Python для PowerShell
# Использование: .\activate_venv.ps1

if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Активация виртуального окружения..." -ForegroundColor Green
    & "venv\Scripts\Activate.ps1"
    Write-Host ""
    Write-Host "✓ Виртуальное окружение активировано!" -ForegroundColor Green
    Write-Host "Python: " -NoNewline
    python --version
    Write-Host ""
    Write-Host "Для деактивации введите: deactivate" -ForegroundColor Gray
} else {
    Write-Host "ОШИБКА: Виртуальное окружение не найдено!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Создайте виртуальное окружение командой:" -ForegroundColor Yellow
    Write-Host "python -m venv venv" -ForegroundColor Yellow
    Write-Host ""
}
