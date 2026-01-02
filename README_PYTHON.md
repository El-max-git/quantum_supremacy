# 🐍 Python окружение для Quantum Supremacy

## Быстрый старт

### 1. Создание виртуального окружения

**Windows (CMD):**
```cmd
setup_venv.bat
```

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Активация виртуального окружения

**Windows (CMD):**
```cmd
activate_venv.bat
```

**Windows (PowerShell):**
```powershell
.\activate_venv.ps1
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Установка зависимостей (если появятся)

```bash
pip install -r requirements.txt
```

### 4. Запуск сервера

После активации виртуального окружения:

```bash
# Через npm (требует Node.js)
python start_server.py

# Встроенный Python HTTP сервер (не требует Node.js)
python start_server_python.py
```

## Деактивация окружения

```bash
deactivate
```

## Структура

```
quantum_supremacy/
├── venv/                    # Виртуальное окружение (не коммитится)
├── requirements.txt         # Python зависимости
├── start_server.py          # Скрипт запуска через npm
├── start_server_python.py   # Скрипт запуска через Python HTTP сервер
├── setup_venv.bat           # Автоматическая настройка (Windows)
├── activate_venv.bat        # Активация (Windows CMD)
└── activate_venv.ps1       # Активация (Windows PowerShell)
```

## Примечания

- Виртуальное окружение (`venv/`) добавлено в `.gitignore` и не коммитится
- Проект статический, поэтому Python зависимости не обязательны
- Виртуальное окружение используется для изоляции зависимостей (если появятся в будущем)

## Полезные команды

```bash
# Проверка версии Python
python --version

# Список установленных пакетов
pip list

# Обновление pip
python -m pip install --upgrade pip

# Экспорт зависимостей (если появятся)
pip freeze > requirements.txt
```
