#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для поиска и завершения процесса, занимающего порт
Использование: python kill_port.py [PORT]
Пример: python kill_port.py 8000
"""

import sys
import socket
import subprocess
import platform
import os

# Настраиваем кодировку вывода для Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def find_process_on_port(port):
    """Находит процесс, использующий указанный порт"""
    system = platform.system()
    
    if system == 'Windows':
        # Windows: используем netstat и tasklist
        try:
            # Находим PID через netstat
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Ищем строку с нашим портом
            for line in result.stdout.split('\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) > 0:
                        pid = parts[-1]
                        if pid.isdigit():
                            return int(pid)
        except Exception as e:
            print(f"Ошибка при поиске процесса: {e}")
            return None
    else:
        # Linux/Mac: используем lsof
        try:
            result = subprocess.run(
                ['lsof', '-ti', f':{port}'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                return int(result.stdout.strip())
        except FileNotFoundError:
            print("lsof не найден. Установите его для работы на Linux/Mac.")
        except Exception as e:
            print(f"Ошибка при поиске процесса: {e}")
            return None
    
    return None

def get_process_info(pid):
    """Получает информацию о процессе"""
    system = platform.system()
    
    if system == 'Windows':
        try:
            result = subprocess.run(
                ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV', '/NH'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split('","')
                if len(parts) >= 2:
                    return {
                        'name': parts[0].strip('"'),
                        'pid': pid,
                        'path': parts[-1].strip('"') if len(parts) > 1 else 'N/A'
                    }
        except Exception as e:
            print(f"Ошибка при получении информации о процессе: {e}")
    else:
        try:
            result = subprocess.run(
                ['ps', '-p', str(pid), '-o', 'comm=', '-o', 'args='],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                parts = result.stdout.strip().split(None, 1)
                return {
                    'name': parts[0] if parts else 'N/A',
                    'pid': pid,
                    'path': parts[1] if len(parts) > 1 else 'N/A'
                }
        except Exception as e:
            print(f"Ошибка при получении информации о процессе: {e}")
    
    return None

def kill_process(pid):
    """Завершает процесс"""
    system = platform.system()
    
    try:
        if system == 'Windows':
            subprocess.run(['taskkill', '/F', '/PID', str(pid)], check=True, timeout=10)
        else:
            subprocess.run(['kill', '-9', str(pid)], check=True, timeout=10)
        return True
    except subprocess.CalledProcessError:
        return False
    except Exception as e:
        print(f"Ошибка при завершении процесса: {e}")
        return False

def main():
    # Получаем порт из аргументов или используем 8000 по умолчанию
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    
    print("")
    print("=" * 40)
    print(f"  Поиск процесса на порту {port}")
    print("=" * 40)
    print("")
    
    # Проверяем доступность порта
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    
    if result == 0:
        # Порт занят, ищем процесс
        print(f"[!] Порт {port} занят, ищем процесс...")
        pid = find_process_on_port(port)
        
        if pid:
            info = get_process_info(pid)
            if info:
                print("Найден процесс:")
                print(f"  PID:  {info['pid']}")
                print(f"  Имя:  {info['name']}")
                print(f"  Путь: {info['path']}")
                print("")
                
                response = input("Завершить процесс? (y/n): ")
                if response.lower() == 'y':
                    if kill_process(pid):
                        print("[OK] Процесс завершен!")
                    else:
                        print("[ERROR] Не удалось завершить процесс (возможно, нет прав)")
                else:
                    print("Отменено.")
            else:
                print(f"Найден процесс с PID {pid}, но не удалось получить информацию")
        else:
            print(f"[!] Не удалось найти процесс на порту {port}")
    else:
        print(f"[OK] Порт {port} свободен")
    
    print("")

if __name__ == "__main__":
    main()
