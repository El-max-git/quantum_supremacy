# 🧭 NavUtils Guide - Руководство по навигации

> **Модульная система навигации для Quantum Supremacy**

---

## 📋 Принципы

### ✅ DRY (Don't Repeat Yourself)
- **Единственный источник правды:** `data/config.json`
- **НЕ дублировать** код навигации
- **Использовать** NavUtils для всех ссылок

### ✅ Унификация
- Все ссылки создаются через `NavUtils`
- Единый стиль навигации по всему сайту
- Автоматическое извлечение данных из `config.json`

### ✅ Модульность
- Навигация - отдельный модуль (`js/navigation.js`)
- Переиспользуемые функции для всех типов навигации
- Легко расширять и поддерживать

---

## 🚀 Быстрый старт

### 1. NavUtils уже подключен в index.html

```html
<script src="js/navigation.js"></script>
```

### 2. Использование в страницах

#### ❌ НЕПРАВИЛЬНО (жесткий код)

```html
<!-- НЕ ДЕЛАТЬ ТАК -->
<button onclick="router.navigate('/about')">О проекте</button>
<a href="/quantum-basics">Квантовая механика</a>
```

#### ✅ ПРАВИЛЬНО (через NavUtils)

```html
<!-- Вариант 1: Простая ссылка -->
<div id="my-link"></div>
<script>
    const link = NavUtils.createLink('/about', 'О проекте');
    document.getElementById('my-link').appendChild(link);
</script>

<!-- Вариант 2: Кнопка-ссылка -->
<div id="my-button"></div>
<script>
    const button = NavUtils.createButton('/quantum-basics', 'Начать обучение', 'button');
    document.getElementById('my-button').appendChild(button);
</script>

<!-- Вариант 3: Используя HTML с data-link -->
<a href="/about" data-link class="button">О проекте</a>
```

---

## 📚 API Reference

### `NavUtils.init(config, basePath)`

Инициализация NavUtils с конфигурацией.

```javascript
// Автоматически вызывается в index.html
NavUtils.init(config, '/quantum_supremacy');
```

**Параметры:**
- `config` - объект конфигурации из `config.json`
- `basePath` - базовый путь (для GitHub Pages)

---

### `NavUtils.getRoute(path)`

Получить маршрут по пути.

```javascript
const route = NavUtils.getRoute('/about');
console.log(route.title); // "О проекте - Quantum Supremacy"
console.log(route.meta?.description); // SEO описание
```

**Возвращает:** объект маршрута или `null`

---

### `NavUtils.createLink(path, text, className)`

Создать ссылку с атрибутом `data-link`.

```javascript
const link = NavUtils.createLink('/about', 'О проекте', 'nav-link');
document.body.appendChild(link);

// Результат:
// <a href="/about" data-link class="nav-link">О проекте</a>
```

**Параметры:**
- `path` - путь к странице
- `text` - текст ссылки
- `className` - CSS класс (опционально)

**Возвращает:** `HTMLAnchorElement`

---

### `NavUtils.createButton(path, text, className)`

Создать кнопку-ссылку.

```javascript
const button = NavUtils.createButton('/quantum-basics', 'Начать', 'button primary');
container.appendChild(button);

// Результат:
// <a href="/quantum-basics" data-link class="button primary">Начать</a>
```

**Параметры:**
- `path` - путь к странице
- `text` - текст кнопки
- `className` - CSS класс (по умолчанию `'button'`)

**Возвращает:** `HTMLAnchorElement`

---

### `NavUtils.createNavCard(path, options)`

Создать навигационную карточку (для главной страницы).

```javascript
const card = NavUtils.createNavCard('/quantum-basics', {
    icon: '⚛️',
    title: 'Этап 1: Квантовая механика',
    description: 'Основы квантовой физики',
    status: '✅ Доступно',
    className: 'tech-card'
});

document.querySelector('.cards-grid').appendChild(card);
```

**Параметры:**
- `path` - путь к странице
- `options` - объект с опциями:
  - `icon` - эмодзи или иконка
  - `title` - заголовок карточки
  - `description` - описание
  - `status` - статус (опционально)
  - `className` - CSS класс (по умолчанию `'tech-card'`)

**Возвращает:** `HTMLDivElement`

---

### `NavUtils.createPrevNextNav(prevPath, nextPath)`

Создать блок навигации "предыдущий/следующий".

```javascript
// В конце страницы
const prevNext = NavUtils.createPrevNextNav('/quantum-basics', '/casimir-effect');
document.body.appendChild(prevNext);
```

**Параметры:**
- `prevPath` - путь на предыдущую страницу (или `null`)
- `nextPath` - путь на следующую страницу (или `null`)

**Возвращает:** `HTMLDivElement` с двумя карточками

**Автоматически извлекает:**
- Названия страниц из `config.json`
- Описания из `meta.description`

---

### `NavUtils.generatePrevNextHTML(prevPath, nextPath)`

Генерация HTML для навигации (для использования в innerHTML).

```javascript
// Если нужно вставить через innerHTML
document.getElementById('navigation').innerHTML = 
    NavUtils.generatePrevNextHTML('/vacuum-physics', '/gravity-theory');
```

**Возвращает:** строку HTML

---

### `NavUtils.getMenuRoutes()`

Получить все маршруты для меню (с `inMenu: true`).

```javascript
const menuRoutes = NavUtils.getMenuRoutes();
// Автоматически отсортированы по полю order

menuRoutes.forEach(route => {
    console.log(route.title, route.path);
});
```

**Возвращает:** массив объектов маршрутов

---

## 🎯 Примеры использования

### Пример 1: Навигация в конце учебной страницы

```html
<!-- В конце pages/quantum-basics.html -->
<div id="page-navigation"></div>

<script>
    // Автоматически создает блок "← Предыдущий | Следующий →"
    const nav = NavUtils.createPrevNextNav(null, '/vacuum-physics');
    document.getElementById('page-navigation').appendChild(nav);
</script>
```

**Результат:**
- Карточка "Следующий этап: Квантовый вакуум →"
- Автоматически извлекает название и описание из `config.json`

---

### Пример 2: Кнопки CTA (Call To Action)

```html
<div class="cta-section">
    <div class="container">
        <h2>Готовы начать?</h2>
        <div id="cta-buttons"></div>
    </div>
</div>

<script>
    const container = document.getElementById('cta-buttons');
    
    // Кнопка "Начать обучение"
    const startBtn = NavUtils.createButton('/quantum-basics', 'Начать обучение', 'button');
    container.appendChild(startBtn);
    
    // Кнопка "О проекте"
    const aboutBtn = NavUtils.createButton('/about', 'О проекте', 'button outline');
    container.appendChild(aboutBtn);
</script>
```

---

### Пример 3: Динамическая карточная навигация

```html
<div class="cards-grid" id="stages-grid"></div>

<script>
    const grid = document.getElementById('stages-grid');
    
    // Этап 1
    grid.appendChild(NavUtils.createNavCard('/quantum-basics', {
        icon: '⚛️',
        title: 'Этап 1: Квантовая механика',
        description: 'Основы квантовой физики, волновая функция, принцип неопределенности',
        status: '✅ Доступно'
    }));
    
    // Этап 2
    grid.appendChild(NavUtils.createNavCard('/vacuum-physics', {
        icon: '🌌',
        title: 'Этап 2: Квантовый вакуум',
        description: 'Вакуум не пустота! Нулевая энергия и виртуальные частицы',
        status: '✅ Доступно'
    }));
</script>
```

---

### Пример 4: Динамическое меню из конфига

```html
<nav>
    <ul id="custom-menu"></ul>
</nav>

<script>
    const menu = document.getElementById('custom-menu');
    
    // Получаем все маршруты с inMenu: true
    NavUtils.getMenuRoutes().forEach(route => {
        const li = document.createElement('li');
        const link = NavUtils.createLink(route.path, route.title.split(' - ')[0]);
        li.appendChild(link);
        menu.appendChild(li);
    });
</script>
```

---

## 🔄 Миграция со старого кода

### Было (жесткий код):

```html
<!-- ❌ Плохо -->
<button onclick="router.navigate('/about')">О проекте</button>
<button onclick="router.navigate('/quantum-basics')">Начать</button>

<div class="card" onclick="router.navigate('/vacuum-physics')">
    <h4>Следующий этап: Квантовый вакуум →</h4>
</div>
```

### Стало (через NavUtils):

```html
<!-- ✅ Хорошо -->
<div id="buttons"></div>
<script>
    const container = document.getElementById('buttons');
    container.appendChild(NavUtils.createButton('/about', 'О проекте'));
    container.appendChild(NavUtils.createButton('/quantum-basics', 'Начать'));
</script>

<div id="next-stage"></div>
<script>
    const nav = NavUtils.createPrevNextNav(null, '/vacuum-physics');
    document.getElementById('next-stage').appendChild(nav);
</script>
```

---

## 🎨 Стилизация

NavUtils создает элементы с классами, которые можно стилизовать через CSS:

```css
/* Ссылки, созданные через createLink */
a[data-link] {
    color: var(--primary-color);
    text-decoration: none;
    transition: color 0.3s;
}

a[data-link]:hover {
    color: var(--secondary-color);
}

/* Кнопки, созданные через createButton */
a.button {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: white;
    border-radius: 5px;
    text-decoration: none;
}

/* Карточки, созданные через createNavCard */
.tech-card[data-nav-card] {
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;
}

.tech-card[data-nav-card]:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
```

---

## ⚠️ Важные правила

### ✅ DO (Делать)

1. **Всегда использовать NavUtils** для создания ссылок на внутренние страницы
2. **Использовать `data-link`** атрибут для SPA навигации
3. **Извлекать данные из config.json** через `NavUtils.getRoute()`
4. **Создавать переиспользуемые функции** для повторяющихся паттернов

### ❌ DON'T (Не делать)

1. **НЕ использовать** `onclick="router.navigate()"`
2. **НЕ хардкодить** названия страниц и описания
3. **НЕ дублировать** код навигации
4. **НЕ создавать ссылки** без атрибута `data-link`

---

## 🔍 Отладка

### Проверка инициализации

```javascript
// В консоли браузера
console.log(NavUtils.config); // Должен показать конфиг
console.log(NavUtils.basePath); // Должен показать basePath
```

### Проверка маршрута

```javascript
const route = NavUtils.getRoute('/about');
console.log(route); // Должен вернуть объект маршрута
```

### Проверка меню

```javascript
const menuRoutes = NavUtils.getMenuRoutes();
console.log(menuRoutes); // Должен вернуть массив маршрутов с inMenu: true
```

---

## 📚 Связанные файлы

- `js/navigation.js` - код модуля NavUtils
- `data/config.json` - конфигурация маршрутов
- `index.html` - инициализация NavUtils
- `router.js` - SPA роутер
- `.cursorrules` - правила DRY и модульности

---

## 💡 Заключение

NavUtils - это **единственный правильный способ** создания навигации в проекте Quantum Supremacy.

**Преимущества:**
- ✅ Единственный источник правды (`config.json`)
- ✅ Нет дублирования кода
- ✅ Автоматическое извлечение метаданных
- ✅ Легко расширять и поддерживать
- ✅ Унифицированный стиль навигации

**Используйте NavUtils везде!** 🚀

---

**Дата создания:** 31.12.2025  
**Версия:** 1.0  
**Автор:** AI Agent (Cursor)
