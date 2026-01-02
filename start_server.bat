@echo off
REM Скрипт запуска локального сервера для проекта Quantum Supremacy
REM Использование: start_server.bat

set PORT=8000
set HOST=localhost

echo.
echo ========================================
echo   Запуск локального сервера
echo   Quantum Supremacy
echo ========================================
echo.
echo Адрес:     http://%HOST%:%PORT%
echo Директория: %CD%
echo.
echo Для остановки сервера нажмите Ctrl+C
echo.
echo ========================================
echo.

REM Проверяем наличие Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не найден в PATH!
    echo Убедитесь, что Node.js установлен и добавлен в системную переменную PATH.
    pause
    exit /b 1
)

echo Запуск сервера...
echo.

REM Запускаем сервер через npm
npm run start

pause
