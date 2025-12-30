# 🚀 Руководство по деплою

Это руководство описывает различные способы развертывания проекта Quantum Supremacy.

## 📋 Содержание

- [GitHub Pages](#github-pages)
- [Netlify](#netlify)
- [Vercel](#vercel)
- [Custom Server](#custom-server)

---

## GitHub Pages

### Автоматический деплой (рекомендуется)

Проект уже настроен для автоматического деплоя через GitHub Actions.

**Шаги:**

1. Отправьте код на GitHub:
```bash
git push origin main
```

2. Перейдите в Settings → Pages вашего репозитория

3. В разделе "Source":
   - Выберите ветку: `gh-pages`
   - Папка: `/ (root)`
   - Нажмите "Save"

4. GitHub Actions автоматически:
   - Соберет проект при каждом push в main
   - Развернет на ветку gh-pages
   - Обновит GitHub Pages

5. Ваш сайт будет доступен по адресу:
   ```
   https://YOUR-USERNAME.github.io/quantum_supremacy/
   ```

### Ручной деплой

Если вы хотите развернуть напрямую из main ветки:

1. Settings → Pages
2. Source: `main` branch
3. Folder: `/ (root)`
4. Save

**Ограничения:** Нет автоматической сборки, развертываются только статические файлы.

---

## Netlify

Netlify предоставляет бесплатный хостинг с автоматическим деплоем.

### Через Git интеграцию (рекомендуется)

1. Зарегистрируйтесь на [Netlify](https://www.netlify.com/)

2. Нажмите "New site from Git"

3. Подключите свой GitHub аккаунт

4. Выберите репозиторий `quantum_supremacy`

5. Настройте деплой:
   - **Branch to deploy:** `main`
   - **Build command:** оставьте пустым (или `echo "No build needed"`)
   - **Publish directory:** `./`

6. Нажмите "Deploy site"

7. Ваш сайт будет доступен по адресу:
   ```
   https://random-name.netlify.app
   ```

### Через Drag & Drop

1. Зарегистрируйтесь на [Netlify](https://www.netlify.com/)

2. Перетащите папку проекта в зону "Drag and drop"

3. Готово! Сайт развернут.

### Custom Domain на Netlify

1. Domain settings → Add custom domain
2. Введите ваш домен
3. Следуйте инструкциям по настройке DNS

---

## Vercel

Vercel - платформа для фронтенда с мгновенным деплоем.

### Через Git интеграцию

1. Зарегистрируйтесь на [Vercel](https://vercel.com/)

2. Нажмите "New Project"

3. Import Git Repository → GitHub

4. Выберите `quantum_supremacy`

5. Настройки деплоя:
   - **Framework Preset:** Other
   - **Build Command:** оставьте пустым
   - **Output Directory:** `./`
   - **Install Command:** `npm install` (опционально)

6. Deploy

7. Ваш сайт будет доступен:
   ```
   https://quantum-supremacy.vercel.app
   ```

### Через CLI

```bash
# Установите Vercel CLI
npm install -g vercel

# В корне проекта
vercel

# Следуйте инструкциям
```

---

## Custom Server

### Nginx

**Конфигурация:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/quantum_supremacy;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Apache

**Конфигурация (.htaccess):**

```apache
# Включить переписывание URL
RewriteEngine On

# Если файл не существует, перенаправить на index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]

# Кэширование
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Gzip сжатие
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

### Node.js Server

**server.js:**

```javascript
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;

// Статические файлы
app.use(express.static(__dirname));

// Все маршруты возвращают index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
```

Затем:
```bash
npm install express
node server.js
```

---

## 🔧 Оптимизация перед деплоем

### 1. Минификация

Минифицируйте CSS и JS:

```bash
# Установка инструментов
npm install -g clean-css-cli uglify-js

# Минификация CSS
cleancss -o css/style.min.css css/style.css

# Минификация JS
uglifyjs js/main.js -o js/main.min.js
```

Затем обновите ссылки в `index.html`.

### 2. Оптимизация изображений

Используйте инструменты:
- [TinyPNG](https://tinypng.com/) - для PNG/JPG
- [SVGOMG](https://jakearchibald.github.io/svgomg/) - для SVG
- [ImageOptim](https://imageoptim.com/) - для macOS

### 3. Проверка производительности

Перед деплоем проверьте:
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [GTmetrix](https://gtmetrix.com/)
- Lighthouse в Chrome DevTools (F12)

---

## 🔒 Настройка HTTPS

### GitHub Pages
HTTPS включен автоматически для `*.github.io` доменов.

### Netlify / Vercel
HTTPS настраивается автоматически.

### Custom Server
Используйте [Let's Encrypt](https://letsencrypt.org/):

```bash
# Установка certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com
```

---

## 📊 Мониторинг

### Аналитика

Добавьте Google Analytics в `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## ❓ Устранение неполадок

### Сайт не обновляется
- Очистите кэш браузера (Ctrl+Shift+R)
- Проверьте статус деплоя на платформе
- Подождите несколько минут (DNS пропагация)

### 404 ошибки
- Проверьте правильность путей к файлам
- Убедитесь, что все файлы загружены
- Проверьте конфигурацию сервера

### Проблемы с CSS/JS
- Проверьте пути к файлам
- Откройте консоль браузера (F12) для ошибок
- Убедитесь, что файлы не блокируются CORS

---

Готово! Ваш сайт развернут! 🎉

Если у вас возникли проблемы, создайте [Issue](https://github.com/your-username/quantum_supremacy/issues).

