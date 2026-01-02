#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт запуска локального сервера для проекта Quantum Supremacy
Использование: python start_server.py
Автоматически использует виртуальное окружение если оно существует
"""

import os
import sys
import subprocess
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading

DEFAULT_PORT = 8000
HOST = "localhost"
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
VENV_PATH = os.path.join(PROJECT_PATH, 'venv')
PORT = DEFAULT_PORT  # Будет изменен при необходимости

def activate_venv():
    """Активирует виртуальное окружение если оно существует"""
    if os.path.exists(VENV_PATH):
        if sys.platform == 'win32':
            # Windows
            python_exe = os.path.join(VENV_PATH, 'Scripts', 'python.exe')
            if os.path.exists(python_exe):
                print(f"✓ Используется виртуальное окружение: {VENV_PATH}")
                return python_exe
        else:
            # Linux/Mac
            python_exe = os.path.join(VENV_PATH, 'bin', 'python')
            if os.path.exists(python_exe):
                print(f"✓ Используется виртуальное окружение: {VENV_PATH}")
                return python_exe
    return None

def print_header(port):
    """Выводит заголовок с информацией о сервере"""
    print("")
    print("=" * 40)
    print("  Запуск локального сервера")
    print("  Quantum Supremacy")
    print("=" * 40)
    print("")
    print(f"Адрес:     http://{HOST}:{port}")
    print(f"Директория: {PROJECT_PATH}")
    print("")
    print("Для остановки сервера нажмите Ctrl+C")
    print("")
    print("=" * 40)
    print("")

def check_port_available(host, port):
    """Проверяет доступность порта"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result != 0  # True если порт свободен
    except Exception:
        return True  # В случае ошибки считаем порт свободным

def find_free_port(host, start_port, max_attempts=10):
    """Находит свободный порт начиная с start_port"""
    for i in range(max_attempts):
        port = start_port + i
        if check_port_available(host, port):
            return port
    return None  # Не найдено свободного порта

def check_node_installed():
    """Проверяет наличие Node.js"""
    try:
        result = subprocess.run(['node', '--version'], 
                              capture_output=True, 
                              text=True, 
                              timeout=5)
        if result.returncode == 0:
            print(f"Node.js: {result.stdout.strip()}")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    print("ОШИБКА: Node.js не найден в PATH!")
    print("Убедитесь, что Node.js установлен и добавлен в системную переменную PATH.")
    return False

def open_browser(port):
    """Открывает браузер через 1 секунду после запуска сервера"""
    import time
    time.sleep(1)
    webbrowser.open(f'http://{HOST}:{port}')

def start_server():
    """Запускает локальный сервер"""
    global PORT
    
    # Переходим в директорию проекта
    os.chdir(PROJECT_PATH)
    
    # Проверяем Node.js
    if not check_node_installed():
        sys.exit(1)
    
    # Проверяем порт и ищем свободный если нужно
    if not check_port_available(HOST, DEFAULT_PORT):
        print(f"⚠️  Порт {DEFAULT_PORT} уже занят!")
        print("Поиск свободного порта...")
        
        free_port = find_free_port(HOST, DEFAULT_PORT)
        if free_port:
            PORT = free_port
            print(f"✓ Найден свободный порт: {PORT}")
            # Обновляем package.json или используем переменную окружения
            os.environ['PORT'] = str(PORT)
        else:
            print("❌ Не удалось найти свободный порт!")
            print("Попробуйте завершить процесс, занимающий порт, или используйте другой порт вручную.")
            sys.exit(1)
    else:
        PORT = DEFAULT_PORT
    
    # Выводим заголовок с правильным портом
    print_header(PORT)
    
    print("Запуск сервера...")
    print("")
    
    # Открываем браузер в отдельном потоке
    browser_thread = threading.Thread(target=open_browser, args=(PORT,), daemon=True)
    browser_thread.start()
    
    # Запускаем сервер через npm (порт передается через переменную окружения)
    # Но npm скрипт использует фиксированный порт, поэтому нужно изменить команду
    try:
        # Используем npx напрямую с нужным портом
        # -d false: отключить листинг директорий
        # -o: открыть браузер
        subprocess.run(['npx', 'http-server', '-p', str(PORT), '-d', 'false', '-o'], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Ошибка запуска сервера: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nСервер остановлен пользователем.")
        sys.exit(0)

if __name__ == "__main__":
    # Проверяем виртуальное окружение
    venv_python = activate_venv()
    if venv_python:
        print("")  # Пустая строка после сообщения о venv
    
    # Запускаем сервер (порт определится внутри)
    start_server()
