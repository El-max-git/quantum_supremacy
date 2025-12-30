# 🛡️ XSS Protection Guide

## ⚠️ Проблема: Регулярные выражения не могут надежно парсить HTML

### Почему regex небезопасен для фильтрации HTML?

HTML — это **не регулярный язык**. Попытка парсинга HTML через regex приводит к уязвимостям, которые легко обходятся.

#### ❌ Плохой подход (regex):

```javascript
// НЕБЕЗОПАСНО! Легко обойти
/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
```

#### 💣 Примеры обхода regex фильтров:

```html
<!-- 1. Капитализация -->
<ScRiPt>alert('XSS')</sCrIpT>

<!-- 2. Null bytes -->
<script\x00>alert('XSS')</script>

<!-- 3. HTML entities -->
<script>alert&#40;'XSS'&#41;</script>

<!-- 4. Атрибуты с пробелами -->
<script   type="text/javascript"  >alert('XSS')</script>

<!-- 5. Вложенные теги -->
<scr<script>ipt>alert('XSS')</script>

<!-- 6. Event handlers -->
<img src=x onerror=alert('XSS')>
<body onload=alert('XSS')>
<svg onload=alert('XSS')>

<!-- 7. JavaScript протоколы -->
<a href="javascript:alert('XSS')">Click</a>
<iframe src="javascript:alert('XSS')"></iframe>

<!-- 8. Data URI -->
<object data="data:text/html,<script>alert('XSS')</script>"></object>

<!-- 9. Encoded payload -->
<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">

<!-- 10. CSS injection -->
<style>body{background:url("javascript:alert('XSS')")}</style>
```

---

## ✅ Правильный подход: DOMParser + Whitelist

### Реализация в нашем проекте

#### 1️⃣ **Использование DOMParser** (вместо regex)

```javascript
static checkXSS(input) {
    // DOMParser правильно парсит HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');
    
    // Проверяем наличие опасных тегов
    const dangerousTags = ['script', 'iframe', 'object', 'embed'];
    for (const tag of dangerousTags) {
        if (doc.getElementsByTagName(tag).length > 0) {
            return true; // XSS обнаружен
        }
    }
    
    return false;
}
```

#### 2️⃣ **Whitelist подход** (разрешаем только безопасные теги)

```javascript
static sanitizeHtml(html) {
    // Разрешаем ТОЛЬКО эти теги
    const allowedTags = ['p', 'b', 'i', 'u', 'strong', 'em', 'br'];
    const allowedAttributes = ['class', 'id']; // Только эти атрибуты
    
    // Все остальное удаляется или экранируется
    // ...
}
```

#### 3️⃣ **По умолчанию экранируем весь HTML**

```javascript
// ✅ Безопасно: экранируем все спецсимволы
const safe = Security.escapeHtml(userInput);
// "<script>" превратится в "&lt;script&gt;"
```

---

## 📋 Правила использования

### Для разработчиков:

| Сценарий | Метод | Описание |
|----------|-------|----------|
| **Вывод пользовательского текста** | `escapeHtml()` | По умолчанию для всего |
| **Вывод HTML (например, WYSIWYG)** | `sanitizeHtml()` | Только для форматирования |
| **Проверка на XSS** | `checkXSS()` | Перед сохранением данных |
| **Валидация форм** | `sanitizeInput()` | В обработчиках форм |

### Примеры:

#### ✅ Правильно:

```javascript
// 1. Простой текст от пользователя
const username = Security.escapeHtml(userInput);
document.getElementById('output').textContent = username; // textContent, не innerHTML

// 2. Если нужен HTML (только для форматирования)
const comment = Security.sanitizeHtml(userComment, {
    allowedTags: ['p', 'b', 'i', 'br'],
    allowedAttributes: []
});

// 3. Проверка перед сохранением
if (Security.checkXSS(userInput)) {
    throw new Error('XSS detected');
}
```

#### ❌ Неправильно:

```javascript
// НЕ ДЕЛАЙТЕ ТАК!
document.getElementById('output').innerHTML = userInput; // ОПАСНО!

// НЕ используйте eval
eval(userInput); // КРАЙНЕ ОПАСНО!

// НЕ доверяйте только regex
if (/<script>/i.test(userInput)) { // Легко обойти
    // ...
}
```

---

## 🔍 Дополнительные меры защиты

### 1. Content Security Policy (CSP)

В `index.html`:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;">
```

### 2. Trusted Types API (современные браузеры)

```javascript
if (window.trustedTypes && window.trustedTypes.createPolicy) {
    const policy = trustedTypes.createPolicy('default', {
        createHTML: (string) => Security.sanitizeHtml(string),
        createScriptURL: (string) => {
            throw new Error('Script URLs not allowed');
        }
    });
}
```

### 3. HttpOnly Cookies (для серверов)

```
Set-Cookie: sessionId=xyz; HttpOnly; Secure; SameSite=Strict
```

### 4. X-XSS-Protection Header

```
X-XSS-Protection: 1; mode=block
```

---

## 📚 Дополнительные ресурсы

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify Library](https://github.com/cure53/DOMPurify) - enterprise-grade HTML sanitizer
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Trusted Types API](https://web.dev/trusted-types/)

---

## ⚠️ Важно помнить:

1. **Никогда не парсите HTML через regex**
2. **Используйте whitelist, а не blacklist**
3. **По умолчанию экранируйте все** через `escapeHtml()`
4. **Предпочитайте `textContent` вместо `innerHTML`**
5. **Используйте CSP заголовки**
6. **Регулярно обновляйте зависимости**

---

## 🧪 Тестирование

```javascript
// Тест 1: Простые теги
Security.checkXSS('<script>alert(1)</script>'); // true

// Тест 2: Event handlers
Security.checkXSS('<img src=x onerror=alert(1)>'); // true

// Тест 3: JavaScript протокол
Security.checkXSS('<a href="javascript:alert(1)">'); // true

// Тест 4: Безопасный текст
Security.checkXSS('Hello <b>World</b>'); // false (но санитизируется)

// Тест 5: Экранирование
Security.escapeHtml('<script>alert(1)</script>');
// Результат: "&lt;script&gt;alert(1)&lt;/script&gt;"
```

---

**Вывод:** Используйте DOMParser + Whitelist. Забудьте про regex для HTML! 🚫
