# 🔧 .htaccess Setup Guide

## ⚠️ Важно!

Файлы `.htaccess` **НЕ включены в Git** по соображениям безопасности. Они должны быть настроены индивидуально для каждого сервера.

---

## 📋 Шаблоны файлов

В проекте есть шаблоны `.htaccess.example`:

```
.htaccess.example           # Основной конфиг Apache
data/.htaccess.example      # Защита директории /data
upload/.htaccess.example    # Защита директории /upload
```

---

## 🚀 Быстрая установка

### Для Apache серверов:

```bash
# 1. Скопируйте шаблоны
copy .htaccess.example .htaccess
copy data\.htaccess.example data\.htaccess
copy upload\.htaccess.example upload\.htaccess

# 2. Отредактируйте под ваш сервер
# - Измените пути в RewriteBase
# - Настройте CSP под ваши нужды
# - Проверьте SSL сертификаты
```

### Для GitHub Pages:

**GitHub Pages НЕ поддерживает `.htaccess`!**

Вместо этого используются:
- `_headers` файл (для Netlify/Cloudflare Pages)
- Meta tags в HTML (для базовой защиты)
- JavaScript security (см. `js/security.js`)

---

## 📁 Описание файлов

### 1. `.htaccess` (корневой)

**Назначение:** Основная конфигурация Apache

**Функции:**
- ✅ Security headers (X-Frame-Options, CSP, HSTS)
- ✅ HTTPS redirect
- ✅ Gzip compression
- ✅ Browser caching
- ✅ SPA routing (для Single Page Applications)
- ✅ Защита от hotlinking
- ✅ Блокировка вредоносных запросов

**Требует модули Apache:**
- `mod_rewrite`
- `mod_headers`
- `mod_deflate`
- `mod_expires`

### 2. `data/.htaccess`

**Назначение:** Защита директории с конфигурацией

**Содержимое:**
```apache
# Deny all access to /data directory
Order Deny,Allow
Deny from all
```

**Защищает:**
- `config.json`
- Другие конфигурационные файлы
- API ключи (если хранятся локально)

### 3. `upload/.htaccess`

**Назначение:** Защита директории загрузок

**Содержимое:**
```apache
# Deny execution of scripts in /upload
<FilesMatch "\.(php|phtml|php3|php4|php5|pl|py|jsp|asp|sh|cgi)$">
    Order Deny,Allow
    Deny from all
</FilesMatch>
```

**Защищает от:**
- Загрузки и выполнения вредоносных скриптов
- PHP shell backdoors
- Arbitrary code execution

---

## ⚙️ Настройка под ваш сервер

### 1. Измените RewriteBase

Если сайт в поддиректории:

```apache
# Было:
RewriteBase /

# Стало (для example.com/mysite/):
RewriteBase /mysite/
```

### 2. Настройте Content Security Policy (CSP)

```apache
# Базовый (строгий):
Header set Content-Security-Policy "default-src 'self';"

# С внешними ресурсами:
Header set Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline';"

# Для разработки (НЕ для продакшена!):
Header set Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval';"
```

### 3. Проверьте SSL/HTTPS

Если у вас НЕТ SSL сертификата, закомментируйте:

```apache
# Закомментируйте эти строки:
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
# Header always set Strict-Transport-Security "max-age=31536000"
```

---

## 🧪 Тестирование

### Проверка синтаксиса Apache:

```bash
# На сервере:
apache2ctl configtest

# Или:
apachectl -t
```

### Проверка security headers:

```bash
# Используйте curl:
curl -I https://your-site.com

# Или онлайн:
# https://securityheaders.com/
```

### Проверка SPA routing:

```bash
# Прямой доступ к странице должен работать:
curl https://your-site.com/about
# Должен вернуть index.html, не 404
```

---

## ❌ Типичные ошибки

### 1. "Internal Server Error 500"

**Причина:** Модуль Apache не включен

**Решение:**
```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod deflate
sudo a2enmod expires
sudo systemctl restart apache2
```

### 2. "RewriteBase not working"

**Причина:** Неправильный путь

**Решение:** Убедитесь, что `RewriteBase` соответствует реальному пути сайта

### 3. "CSP blocking resources"

**Причина:** Слишком строгий CSP

**Решение:** Добавьте нужные домены в CSP директивы

---

## 🔒 Безопасность

### ⚠️ НЕ КОММИТЬТЕ в Git:

- `.htaccess` с реальными путями сервера
- Файлы с API ключами
- Конфигурацию с паролями

### ✅ ВСЕГДА:

- Используйте `.htaccess.example` как шаблон
- Храните чувствительные данные в `.env` файлах
- Регулярно обновляйте security headers
- Тестируйте изменения на staging сервере

---

## 📚 Дополнительные ресурсы

- [Apache mod_rewrite Documentation](https://httpd.apache.org/docs/current/mod/mod_rewrite.html)
- [Security Headers Best Practices](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP .htaccess Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Apache_Configuration_Cheat_Sheet.html)

---

## 🆘 Помощь

Если у вас проблемы с `.htaccess`:

1. Проверьте логи Apache: `/var/log/apache2/error.log`
2. Используйте `apache2ctl configtest`
3. Создайте Issue на GitHub
4. См. [docs/HTACCESS_GUIDE.md](docs/HTACCESS_GUIDE.md) для подробностей

---

**Важно:** Этот файл создан для Apache серверов. Для Nginx используйте другую конфигурацию!
