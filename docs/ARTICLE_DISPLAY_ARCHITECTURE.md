# Архитектура системы отображения статей

## Обзор

Система отображения статей состоит из нескольких компонентов, которые работают вместе для загрузки, парсинга и отображения Markdown статей в HTML.

## Структура компонентов

```
┌─────────────────────────────────────────────────────────────┐
│                    pages/articles.html                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <div id="articles-list">                             │   │
│  │    <!-- Список статей (карточки) -->                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  <div id="article-viewer">                            │   │
│  │    <!-- Контент статьи (динамически загружается) --> │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              js/articles-catalog.js (ArticlesCatalog)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  init()                                                │   │
│  │    ├─ fetch articles-list.json                         │   │
│  │    └─ renderCatalog()                                  │   │
│  │                                                         │   │
│  │  renderCatalog()                                        │   │
│  │    ├─ getCurrentDirectory()                            │   │
│  │    ├─ renderBreadcrumbs()                              │   │
│  │    ├─ renderDirectoryItem() (для директорий)          │   │
│  │    ├─ renderArticleItem() (для статей)                │   │
│  │    └─ attachEventListeners()                           │   │
│  │                                                         │   │
│  │  openArticle(articleId)                                 │   │
│  │    └─ router.navigate('/article?id=' + articleId)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              pages/article-view.html (встроенный скрипт)     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  loadArticle(articleId)                                │   │
│  │    ├─ fetch articles-list.json                         │   │
│  │    ├─ findArticle() (рекурсивный поиск)                │   │
│  │    ├─ fetchArticleFile() - загрузка .md файла         │   │
│  │    ├─ extractFrontmatter() - извлечение YAML           │   │
│  │    ├─ simpleMarkdownToHtml() - парсинг Markdown        │   │
│  │    ├─ generateTOC() - генерация содержания              │   │
│  │    ├─ paginateArticle() - разбивка на страницы         │   │
│  │    └─ MathJax.typesetPromise() - рендеринг формул      │   │
│  │                                                         │   │
│  │  simpleMarkdownToHtml(md)                              │   │
│  │    ├─ Обработка блоков кода (```)                      │   │
│  │    ├─ Обработка LaTeX формул ($$, $)                   │   │
│  │    ├─ Обработка формул ([formula])                      │   │
│  │    ├─ Обработка заголовков (#)                         │   │
│  │    ├─ Обработка таблиц (|)                             │   │
│  │    ├─ Обработка списков (-, *)                         │   │
│  │    ├─ Обработка ссылок ([])                            │   │
│  │    └─ Обработка изображений (![])                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              js/table-of-contents.js (TableOfContents)      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  generate() - генерация содержания из заголовков    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Поток данных

### 1. Инициализация каталога статей

```javascript
// pages/articles.html
<script>
  const catalog = new ArticlesCatalog({
    basePath: window.router?.basePath || '',
    listContainerId: 'articles-list',
    configPath: '/articles/articles-list.json'
  });
  
  await catalog.init();
</script>
```

### 2. Загрузка каталога

```javascript
// ArticlesCatalog.init()
async init() {
  // 1. Загружаем каталог статей из JSON
  const response = await fetch('articles/articles-list.json');
  this.catalogData = await response.json();
  
  // 2. Рендерим каталог
  this.renderCatalog();
}
```

### 3. Отображение статьи

```javascript
// pages/article-view.html (встроенный скрипт)
async function loadArticle(articleId) {
  // 1. Загружаем каталог для поиска статьи
  const catalog = await fetch('articles/articles-list.json');
  const catalogData = await catalog.json();
  
  // 2. Находим статью рекурсивно
  const article = findArticle(catalogData.categories, articleId);
  
  // 3. Загружаем Markdown файл (с fallback на GitHub Raw)
  const mdText = await fetchArticleFile(article.mdFile);
  
  // 4. Извлекаем frontmatter
  const { content, metadata } = extractFrontmatter(mdText);
  
  // 5. Парсим Markdown в HTML
  const html = simpleMarkdownToHtml(content);
  
  // 6. Генерируем TOC
  const tocHtml = generateTOC(html);
  
  // 7. Разбиваем на страницы
  const paginatedHtml = paginateArticle(html, tocHtml, articleId);
  
  // 8. Отображаем в DOM
  document.getElementById('article-body').innerHTML = paginatedHtml;
  
  // 9. Рендерим формулы
  MathJax.typesetPromise();
}
```

### 4. Парсинг Markdown

```javascript
// simpleMarkdownToHtml(md) - встроенная функция
function simpleMarkdownToHtml(md) {
  // 1. Обработка блоков кода (```)
  // 2. Обработка LaTeX формул ($$, $)
  // 3. Обработка формул ([formula])
  // 4. Обработка заголовков (#)
  // 5. Обработка таблиц (|)
  // 6. Обработка списков (-, *)
  // 7. Обработка ссылок ([])
  // 8. Обработка изображений (![])
  // 9. Обработка параграфов
  
  return html;
}
```

## Структура HTML

### Список статей

```html
<div id="articles-list">
  <div class="articles-grid">
    <div class="category-section">
      <h2 class="category-title">Категория</h2>
      <div class="articles-cards">
        <div class="article-card" data-article-id="article-id">
          <div class="article-card-header">
            <h3 class="article-card-title">Название статьи</h3>
            <div class="article-card-tags">...</div>
          </div>
          <div class="article-card-body">
            <p class="article-card-description">Описание...</p>
          </div>
          <div class="article-card-footer">
            <span>📅 Дата</span>
            <span>⏱️ Время чтения</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Просмотр статьи

```html
<div id="article-viewer">
  <!-- Кнопка "Назад" -->
  <div style="max-width: 1400px; margin: 0 auto; padding: 0 2rem;">
    <button class="back-to-list-btn">← Назад к списку</button>
  </div>
  
  <!-- Обертка статьи -->
  <div class="article-wrapper">
    <!-- Боковая панель с содержанием -->
    <aside class="article-toc-sidebar">
      <div class="toc-sticky">
        <h3 class="toc-title">Содержание</h3>
        <div id="article-toc">
          <!-- Динамически генерируется -->
        </div>
      </div>
    </aside>
    
    <!-- Контент статьи -->
    <article class="article-content">
      <!-- Заголовок -->
      <header class="article-header">
        <div class="article-category">Категория</div>
        <h1 class="article-title">Название статьи</h1>
        <div class="article-meta">
          <span>✍️ Автор</span>
          <span>📅 Дата</span>
          <span>⏱️ Время чтения</span>
        </div>
        <div class="article-tags">...</div>
      </header>
      
      <!-- Тело статьи -->
      <div class="article-body" id="article-body">
        <!-- HTML контент из парсера -->
      </div>
    </article>
  </div>
</div>
```

## Ключевые методы

### ArticlesCatalog

| Метод | Описание |
|-------|----------|
| `init()` | Инициализация: загрузка каталога из JSON и рендеринг |
| `renderCatalog()` | Рендеринг каталога (директории и статьи) |
| `getCurrentDirectory()` | Получение текущей директории на основе пути |
| `renderBreadcrumbs()` | Генерация хлебных крошек |
| `renderDirectoryItem()` | Рендеринг карточки директории |
| `renderArticleItem()` | Рендеринг карточки статьи |
| `navigateToDirectory(dirId)` | Навигация в директорию |
| `openArticle(articleId)` | Открытие статьи через роутер |

### Article Viewer Script (встроен в article-view.html)

| Функция | Описание |
|---------|----------|
| `loadArticle(articleId)` | Главная функция загрузки статьи |
| `getArticleId()` | Получение ID статьи из URL |
| `simpleMarkdownToHtml(md)` | Парсинг Markdown в HTML |
| `extractFrontmatter(text)` | Извлечение YAML frontmatter |
| `paginateArticle(html, tocHtml, articleId)` | Разбивка статьи на страницы |
| `generateTOC()` | Генерация содержания |
| `generateHeadingId(text, index)` | Генерация ID для заголовков |
| `initTocInteractivity()` | Инициализация интерактивности TOC |
| `initScrollButtons()` | Инициализация плавающих кнопок |

## Файлы и их роли

### `articles/articles-list.json`
```json
{
  "categories": [
    {
      "id": "category-id",
      "title": "Название категории",
      "description": "Описание",
      "icon": "📁",
      "order": 1,
      "items": [
        {
          "id": "article-id",
          "mdFile": "articles/article-id/article.md"
        }
      ]
    }
  ]
}
```
- Структурированный каталог с категориями и вложенностью
- Содержит иерархию директорий и статей

### `articles/{article-id}/article.md`
```markdown
---
id: article-id
title: Название статьи
author: Автор
date: 2025-01-01
category: category
tags: [tag1, tag2]
description: Описание
readingTime: 10
difficulty: beginner
---

# Содержание статьи

Текст статьи...
```
- Markdown файл с YAML frontmatter
- Метаданные в начале файла между `---`
- Основной контент в Markdown формате

## CSS классы

### Основные контейнеры
- `.article-wrapper` - обертка статьи (grid: TOC + контент)
- `.article-content` - контент статьи
- `.article-body` - тело статьи с HTML контентом
- `.article-toc-sidebar` - боковая панель с содержанием

### Элементы статьи
- `.article-header` - заголовок статьи
- `.article-title` - название статьи
- `.article-meta` - метаданные (автор, дата, время чтения)
- `.article-tags` - теги статьи
- `.article-category` - категория статьи

### Специальные блоки
- `.article-block.warning` - блок предупреждения (⚠️)
- `.article-block.key-idea` - ключевая идея (🔑)
- `.article-block.note` - заметка (💡)
- `.article-block.example` - пример (📝)

### Формулы
- `.formula-box` - блок с формулой
- `mjx-container` - контейнер MathJax для формул

## Обработка ошибок

### Fallback на GitHub Raw API
```javascript
async fetchArticleFile(mdPath) {
  try {
    // Пытаемся загрузить с GitHub Pages
    const response = await fetch(mdPath);
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    // Если 404, используем GitHub Raw API
    const rawUrl = `https://raw.githubusercontent.com/.../${mdPath}`;
    const response = await fetch(rawUrl);
    return await response.text();
  }
}
```

## Зависимости

- **MathJax** - рендеринг математических формул (LaTeX)
- **TableOfContents** (`js/table-of-contents.js`) - генерация содержания
- **Router** (`router.js`) - SPA навигация

**Примечание:** Парсинг Markdown выполняется встроенной функцией `simpleMarkdownToHtml()` без внешних библиотек.

## Пример использования

```javascript
// Создание экземпляра каталога
const catalog = new ArticlesCatalog({
  basePath: '/quantum_supremacy',
  listContainerId: 'articles-list',
  configPath: '/articles/articles-list.json'
});

// Инициализация
await catalog.init();

// Открытие статьи (через роутер)
catalog.openArticle('article-id');
```

## Расширение функциональности

### Добавление новых специальных блоков

1. Добавить паттерн в функцию `simpleMarkdownToHtml()` в `pages/article-view.html`
2. Добавить CSS стили для нового блока в `css/style.css`
3. Обновить документацию

### Добавление новых метаданных

1. Добавить поле в YAML frontmatter статьи
2. Обновить функцию `extractFrontmatter()` в `pages/article-view.html`
3. Использовать в рендеринге метаданных статьи
