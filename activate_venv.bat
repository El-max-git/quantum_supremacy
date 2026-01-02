@echo off
REM Активация виртуального окружения Python для Windows
REM Использование: activate_venv.bat

if exist venv\Scripts\activate.bat (
    echo Активация виртуального окружения...
    call venv\Scripts\activate.bat
    echo.
    echo Виртуальное окружение активировано!
    echo Python: 
    python --version
    echo.
    echo Для деактивации введите: deactivate
) else (
    echo ОШИБКА: Виртуальное окружение не найдено!
    echo.
    echo Создайте виртуальное окружение командой:
    echo python -m venv venv
    echo.
    pause
)
