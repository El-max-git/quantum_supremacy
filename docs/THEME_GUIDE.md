# 🎨 Theme Guide - System Dark/Light Mode

Автоматическая поддержка темной и светлой темы на основе системных настроек пользователя.

---

## 🌓 Как это работает

Сайт автоматически определяет системную тему браузера/ОС и применяет соответствующие цвета:

- **Светлая тема** - для пользователей с light mode в системе
- **Темная тема** - для пользователей с dark mode в системе
- **Автоматическое переключение** - при изменении системной темы

---

## 🎯 Реализация

### 1. CSS Variables

Все цвета определены через CSS переменные в `:root`:

```css
:root {
    /* Light theme (default) */
    --bg-primary: #ffffff;
    --text-primary: #1e293b;
    --card-bg: #ffffff;
    /* ... */
}

/* Dark theme - automatic */
@media (prefers-color-scheme: dark) {
    :root {
        --bg-primary: #0f172a;
        --text-primary: #f8fafc;
        --card-bg: #1e293b;
        /* ... */
    }
}
```

### 2. JavaScript Theme Manager

`js/theme.js` - автоматическое определение и отслеживание темы:

```javascript
// Инициализация
const themeManager = new ThemeManager();

// Получить текущую тему
const currentTheme = themeManager.getCurrentTheme(); // 'light' or 'dark'

// Проверить поддержку
const supported = ThemeManager.supportsDarkMode(); // true/false
```

### 3. Meta Tags

Автоматическая смена цвета браузера на мобильных устройствах:

```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1e293b" media="(prefers-color-scheme: dark)">
```

---

## 🎨 Цветовая палитра

### Light Theme (Светлая тема)

| Variable | Color | Usage |
|----------|-------|-------|
| `--bg-primary` | #ffffff | Основной фон |
| `--bg-secondary` | #f8fafc | Вторичный фон |
| `--bg-tertiary` | #f1f5f9 | Третичный фон |
| `--text-primary` | #1e293b | Основной текст |
| `--text-secondary` | #334155 | Вторичный текст |
| `--text-tertiary` | #64748b | Третичный текст |
| `--card-bg` | #ffffff | Фон карточек |
| `--header-bg` | #ffffff | Фон шапки |
| `--footer-bg` | #1e293b | Фон футера |

### Dark Theme (Темная тема)

| Variable | Color | Usage |
|----------|-------|-------|
| `--bg-primary` | #0f172a | Основной фон |
| `--bg-secondary` | #1e293b | Вторичный фон |
| `--bg-tertiary` | #334155 | Третичный фон |
| `--text-primary` | #f8fafc | Основной текст |
| `--text-secondary` | #e2e8f0 | Вторичный текст |
| `--text-tertiary` | #cbd5e1 | Третичный текст |
| `--card-bg` | #1e293b | Фон карточек |
| `--header-bg` | #1e293b | Фон шапки |
| `--footer-bg` | #020617 | Фон футера |

---

## 📱 Поддержка устройств

### Desktop Browsers

✅ **Windows**
- Chrome 76+
- Firefox 67+
- Edge 79+
- Opera 62+

✅ **macOS**
- Safari 12.1+
- Chrome 76+
- Firefox 67+

✅ **Linux**
- Chrome 76+
- Firefox 67+

### Mobile Browsers

✅ **iOS**
- Safari 13+
- Chrome 76+

✅ **Android**
- Chrome 76+
- Firefox 67+
- Samsung Internet 10+

---

## 🔧 Как тестировать

### На Desktop

**Windows 10/11:**
1. Settings → Personalization → Colors
2. Choose "Dark" or "Light"

**macOS:**
1. System Preferences → General
2. Choose "Light" or "Dark" appearance

**Linux (Ubuntu):**
1. Settings → Appearance
2. Choose theme

### На Mobile

**iOS:**
1. Settings → Display & Brightness
2. Choose "Light" or "Dark"

**Android:**
1. Settings → Display
2. Choose "Light" or "Dark" theme

### В браузере (DevTools)

**Chrome/Edge:**
1. F12 → DevTools
2. Ctrl+Shift+P → "Rendering"
3. Emulate CSS prefers-color-scheme

**Firefox:**
1. F12 → DevTools
2. Settings (⚙️) → Inspector
3. "Emulate prefers-color-scheme"

---

## 💡 Добавление новых цветов

При добавлении новых элементов всегда используйте CSS переменные:

```css
/* ❌ Плохо - хардкод цвета */
.my-element {
    background: #ffffff;
    color: #000000;
}

/* ✅ Хорошо - используем переменные */
.my-element {
    background: var(--card-bg);
    color: var(--text-primary);
}
```

---

## 🎯 Best Practices

1. **Всегда используй CSS переменные** для цветов
2. **Тестируй обе темы** перед коммитом
3. **Проверяй контрастность** (WCAG AA стандарт)
4. **Не забывай про тени** - в темной теме они темнее
5. **Проверяй изображения** - некоторые могут плохо смотреться в темной теме

---

## 🌐 Browser Support

| Feature | Support |
|---------|---------|
| `prefers-color-scheme` | 95%+ browsers |
| CSS Variables | 97%+ browsers |
| Modern JavaScript | 98%+ browsers |

**Legacy browsers** (IE11, old Safari) увидят светлую тему по умолчанию.

---

## 📊 Statistics

По статистике:
- 🌙 **30-40%** пользователей используют темную тему
- 📱 **50%+** мобильных пользователей используют темную тему вечером
- ⚡ Темная тема **снижает энергопотребление** на OLED экранах на 30-40%

---

## 🔗 Related Files

- `css/style.css` - CSS переменные и темы
- `js/theme.js` - Theme Manager
- `index.html` - Meta tags для темы

---

## 📚 Resources

- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [Web.dev: Color schemes](https://web.dev/color-scheme/)
- [Can I Use: prefers-color-scheme](https://caniuse.com/prefers-color-scheme)

---

**Last Updated:** 2025-12-31  
**Version:** 1.0.0  
**Status:** ✅ Implemented

