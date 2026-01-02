@echo off
REM Скрипт для поиска и завершения процесса, занимающего порт
REM Использование: kill_port.bat [PORT]
REM Пример: kill_port.bat 8000

set PORT=%1
if "%PORT%"=="" set PORT=8000

echo.
echo ========================================
echo   Поиск процесса на порту %PORT%
echo ========================================
echo.

REM Используем PowerShell для поиска процесса
powershell -Command "$conn = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue; if ($conn) { $pid = $conn.OwningProcess; $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($proc) { Write-Host 'Найден процесс:' -ForegroundColor Yellow; Write-Host \"  PID: $($proc.Id)\" -ForegroundColor White; Write-Host \"  Имя: $($proc.ProcessName)\" -ForegroundColor White; Write-Host \"  Путь: $($proc.Path)\" -ForegroundColor White; Write-Host ''; $resp = Read-Host 'Завершить процесс? (y/n)'; if ($resp -eq 'y') { Stop-Process -Id $pid -Force; Write-Host 'Процесс завершен!' -ForegroundColor Green } else { Write-Host 'Отменено.' -ForegroundColor Gray } } else { Write-Host 'Процесс не найден' -ForegroundColor Yellow } } else { Write-Host 'Порт %PORT% свободен' -ForegroundColor Green }"

echo.
pause
