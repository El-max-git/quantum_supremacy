# Scripts

Вспомогательные скрипты для автоматизации задач.

## scan-articles.js

Автоматически сканирует папку `articles/` и обновляет `data/config.json` списком статей.

### Использование:

```bash
node scripts/scan-articles.js
```

### Что делает:

1. Сканирует все поддиректории в `articles/`
2. Находит файлы `article.md`
3. Извлекает ID из имени директории
4. Обновляет секцию `articles` в `config.json`

### Пример вывода:

```
Scanning articles directory...

✓ Found article: test-simple
✓ Found article: quantum-basics
✓ Found article: vacuum-physics

✓ Updated config.json with 3 articles

✓ Done! Articles list updated.

Found articles:
  - test-simple
  - quantum-basics
  - vacuum-physics
```

### Требования:

- Node.js (любая версия)
- Статьи должны быть в `articles/{article-id}/article.md`

### Примечания:

- Метаданные (title, author, tags) читаются из frontmatter статей
- В `config.json` сохраняется только `id` и `mdFile`
- Скрипт безопасно перезаписывает секцию `articles`, не затрагивая остальной конфиг
