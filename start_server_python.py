#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт запуска локального сервера для проекта Quantum Supremacy
Использует встроенный Python HTTP сервер (не требует Node.js)
Автоматически использует виртуальное окружение если оно существует
Использование: python start_server_python.py
"""

import os
import sys
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import threading

DEFAULT_PORT = 8000
HOST = "localhost"
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
VENV_PATH = os.path.join(PROJECT_PATH, 'venv')
PORT = DEFAULT_PORT  # Будет изменен при необходимости

def check_venv():
    """Проверяет наличие виртуального окружения"""
    if os.path.exists(VENV_PATH):
        print(f"✓ Виртуальное окружение найдено: {VENV_PATH}")
        return True
    return False

class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
    """Кастомный обработчик запросов с правильными MIME типами"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_PATH, **kwargs)
    
    def end_headers(self):
        # Добавляем заголовки безопасности
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-XSS-Protection', '1; mode=block')
        super().end_headers()
    
    def log_message(self, format, *args):
        """Кастомное логирование запросов"""
        print(f"[{self.address_string()}] {format % args}")

def print_header(port):
    """Выводит заголовок с информацией о сервере"""
    print("")
    print("=" * 40)
    print("  Запуск локального сервера")
    print("  Quantum Supremacy (Python HTTP Server)")
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
    
    # Проверяем порт и ищем свободный если нужно
    if not check_port_available(HOST, DEFAULT_PORT):
        print(f"⚠️  Порт {DEFAULT_PORT} уже занят!")
        print("Поиск свободного порта...")
        
        free_port = find_free_port(HOST, DEFAULT_PORT)
        if free_port:
            PORT = free_port
            print(f"✓ Найден свободный порт: {PORT}")
        else:
            print("❌ Не удалось найти свободный порт!")
            print("Попробуйте завершить процесс, занимающий порт, или используйте другой порт вручную.")
            sys.exit(1)
    else:
        PORT = DEFAULT_PORT
    
    # Выводим заголовок с правильным портом
    print_header(PORT)
    
    print("Запуск Python HTTP сервера...")
    print("")
    
    # Создаем сервер
    server_address = (HOST, PORT)
    try:
        httpd = HTTPServer(server_address, CustomHTTPRequestHandler)
    except OSError as e:
        print(f"❌ Ошибка запуска сервера: {e}")
        sys.exit(1)
    
    # Открываем браузер в отдельном потоке
    browser_thread = threading.Thread(target=open_browser, args=(PORT,), daemon=True)
    browser_thread.start()
    
    print(f"✓ Сервер запущен на http://{HOST}:{PORT}")
    print("")
    
    try:
        # Запускаем сервер
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nОстановка сервера...")
        httpd.shutdown()
        print("Сервер остановлен.")
        sys.exit(0)

if __name__ == "__main__":
    # Проверяем виртуальное окружение
    check_venv()
    
    # Запускаем сервер (порт определится внутри)
    start_server()
