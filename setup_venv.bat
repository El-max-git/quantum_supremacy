@echo off
REM Создание и настройка виртуального окружения Python
REM Использование: setup_venv.bat

echo ========================================
echo   Создание виртуального окружения
echo   Quantum Supremacy
echo ========================================
echo.

REM Проверяем наличие Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Python не найден!
    echo Убедитесь, что Python установлен и добавлен в PATH.
    pause
    exit /b 1
)

echo Python найден:
python --version
echo.

REM Создаем виртуальное окружение
if exist venv (
    echo Виртуальное окружение уже существует.
    echo.
    set /p RECREATE="Пересоздать? (y/n): "
    if /i "%RECREATE%"=="y" (
        echo Удаление старого окружения...
        rmdir /s /q venv
    ) else (
        echo Используется существующее окружение.
        goto :activate
    )
)

echo Создание виртуального окружения...
python -m venv venv
if errorlevel 1 (
    echo ОШИБКА: Не удалось создать виртуальное окружение!
    pause
    exit /b 1
)

:activate
echo.
echo Активация виртуального окружения...
call venv\Scripts\activate.bat

echo.
echo Установка зависимостей (если есть)...
if exist requirements.txt (
    pip install -r requirements.txt
) else (
    echo requirements.txt не найден, зависимости не установлены.
)

echo.
echo ========================================
echo   Виртуальное окружение готово!
echo ========================================
echo.
echo Для активации в будущем используйте:
echo   activate_venv.bat
echo.
echo Для деактивации введите: deactivate
echo.
pause
