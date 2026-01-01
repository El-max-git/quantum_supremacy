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
│              js/article-viewer.js (ArticleViewer)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  init()                                                │   │
│  │    ├─ loadArticles()                                   │   │
│  │    │   ├─ fetch articles-list.json                     │   │
│  │    │   ├─ fetchArticleFile() для каждой статьи        │   │
│  │    │   └─ extractFrontmatter() для метаданных          │   │
│  │    └─ renderArticlesList()                            │   │
│  │                                                         │   │
│  │  viewArticle(articleId)                                │   │
│  │    ├─ fetchArticleFile() - загрузка .md файла         │   │
│  │    ├─ parser.parse() - парсинг Markdown               │   │
│  │    └─ renderArticleView() - рендеринг HTML           │   │
│  │                                                         │   │
│  │  renderArticleView()                                    │   │
│  │    ├─ Генерация HTML структуры                        │   │
│  │    ├─ generateTOC() - генерация содержания            │   │
│  │    └─ MathJax.typesetPromise() - рендеринг формул     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              js/article-parser.js (ArticleParser)           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  parse(markdownText, articlePath)                    │   │
│  │    ├─ extractFrontmatter() - извлечение YAML         │   │
│  │    ├─ preprocessSpecialBlocks() - специальные блоки │   │
│  │    ├─ preprocessFormulaBoxes() - рамки формул        │   │
│  │    ├─ convertMarkdownToHtml() - Markdown → HTML       │   │
│  │    ├─ processImages() - обработка изображений         │   │
│  │    ├─ processInternalLinks() - внутренние ссылки      │   │
│  │    ├─ generateAnchors() - якоря для заголовков         │   │
│  │    ├─ wrapFormulaBoxes() - обертка формул             │   │
│  │    └─ loadMathJax() - загрузка MathJax                │   │
│  │                                                         │   │
│  │  Возвращает: { html, metadata }                        │   │
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

### 1. Инициализация страницы статей

```javascript
// pages/articles.html
<script>
  // После загрузки DOM
  const viewer = new ArticleViewer({
    basePath: '/quantum_supremacy',
    listContainerId: 'articles-list',
    viewerContainerId: 'article-viewer'
  });
  
  await viewer.init();
</script>
```

### 2. Загрузка списка статей

```javascript
// ArticleViewer.init()
async init() {
  // 1. Загружаем список статей из JSON
  const articlesList = await fetch('articles/articles-list.json');
  const articles = await articlesList.json();
  
  // 2. Для каждой статьи загружаем метаданные из frontmatter
  for (const article of articles) {
    const mdText = await this.fetchArticleFile(article.mdFile);
    const { metadata } = this.parser.extractFrontmatter(mdText);
    article.metadata = metadata;
  }
  
  // 3. Рендерим список карточек
  this.renderArticlesList();
}
```

### 3. Отображение статьи

```javascript
// ArticleViewer.viewArticle(articleId)
async viewArticle(articleId) {
  // 1. Находим статью в списке
  const article = this.articles.find(a => a.id === articleId);
  
  // 2. Загружаем Markdown файл
  const mdText = await this.fetchArticleFile(article.mdFile);
  
  // 3. Парсим Markdown в HTML
  const { html, metadata } = await this.parser.parse(mdText, article.path);
  
  // 4. Рендерим HTML структуру
  this.renderArticleView(article, metadata, html);
}
```

### 4. Парсинг Markdown

```javascript
// ArticleParser.parse()
async parse(markdownText, articlePath) {
  // 1. Извлекаем YAML frontmatter
  const { content, metadata } = this.extractFrontmatter(markdownText);
  
  // 2. Предобработка специальных блоков (⚠️, 🔑, 💡, 📝)
  let processed = this.preprocessSpecialBlocks(content);
  
  // 3. Предобработка ASCII-рамок для формул
  processed = this.preprocessFormulaBoxes(processed);
  
  // 4. Конвертация Markdown в HTML (через marked.js)
  let html = await this.convertMarkdownToHtml(processed);
  
  // 5. Обработка изображений (относительные пути)
  html = this.processImages(html, articlePath);
  
  // 6. Обработка внутренних ссылок
  html = this.processInternalLinks(html, articlePath);
  
  // 7. Генерация якорей для заголовков
  html = this.generateAnchors(html);
  
  // 8. Загрузка MathJax для формул
  if (html.includes('$')) {
    await this.loadMathJax();
  }
  
  return { html, metadata };
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

### ArticleViewer

| Метод | Описание |
|-------|----------|
| `init()` | Инициализация: загрузка списка статей и рендеринг карточек |
| `loadArticles()` | Загрузка `articles-list.json` и метаданных статей |
| `fetchArticleFile(mdPath)` | Загрузка `.md` файла с fallback на GitHub Raw API |
| `renderArticlesList()` | Рендеринг списка карточек статей |
| `viewArticle(articleId)` | Отображение выбранной статьи |
| `renderArticleView()` | Генерация HTML структуры для просмотра статьи |
| `generateTOC()` | Генерация содержания из заголовков |
| `backToList()` | Возврат к списку статей |

### ArticleParser

| Метод | Описание |
|-------|----------|
| `parse(markdownText, articlePath)` | Главный метод парсинга |
| `extractFrontmatter(text)` | Извлечение YAML frontmatter |
| `preprocessSpecialBlocks(text)` | Обработка специальных блоков (⚠️, 🔑, 💡, 📝) |
| `preprocessFormulaBoxes(text)` | Обработка ASCII-рамок для формул |
| `convertMarkdownToHtml(text)` | Конвертация Markdown в HTML через marked.js |
| `processImages(html, articlePath)` | Обработка относительных путей изображений |
| `processInternalLinks(html, articlePath)` | Обработка внутренних ссылок |
| `generateAnchors(html)` | Генерация якорей для заголовков |
| `loadMathJax()` | Асинхронная загрузка MathJax |

## Файлы и их роли

### `articles/articles-list.json`
```json
[
  {
    "id": "article-id",
    "mdFile": "articles/article-id/article.md"
  }
]
```
- Генерируется автоматически скриптом `scripts/scan-articles.js`
- Содержит список всех статей в папке `articles/`

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

- **marked.js** - парсинг Markdown в HTML
- **MathJax** - рендеринг математических формул
- **TableOfContents** - генерация содержания

## Пример использования

```javascript
// Создание экземпляра
const viewer = new ArticleViewer({
  basePath: '/quantum_supremacy',
  listContainerId: 'articles-list',
  viewerContainerId: 'article-viewer'
});

// Инициализация
await viewer.init();

// Отображение статьи
await viewer.viewArticle('article-id');
```

## Расширение функциональности

### Добавление новых специальных блоков

1. Добавить паттерн в `ArticleParser.preprocessSpecialBlocks()`
2. Добавить CSS стили для нового блока
3. Обновить документацию

### Добавление новых метаданных

1. Добавить поле в YAML frontmatter статьи
2. Обновить `ArticleParser.extractFrontmatter()`
3. Использовать в `ArticleViewer.renderArticleView()`
