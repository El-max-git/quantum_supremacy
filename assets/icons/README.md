# Иконки проекта

Эта папка содержит иконки для проекта Quantum Supremacy.

## 📋 Текущие иконки

- `favicon.svg` - Основная иконка сайта (используется как favicon)

## 🎨 Рекомендации

### Форматы
- Используйте SVG для масштабируемых иконок
- PNG для растровых иконок (с разными размерами: 16x16, 32x32, 192x192, 512x512)
- ICO для совместимости со старыми браузерами

### Именование файлов
- `favicon.svg` - основной favicon
- `favicon-16x16.png` - 16x16 пикселей
- `favicon-32x32.png` - 32x32 пикселя
- `apple-touch-icon.png` - 180x180 для iOS
- `android-chrome-192x192.png` - для Android
- `android-chrome-512x512.png` - для Android (большой)

### Инструменты

- [Favicon Generator](https://realfavicongenerator.net/) - генератор всех размеров favicon
- [SVGOMG](https://jakearchibald.github.io/svgomg/) - оптимизация SVG
- [Icon8](https://icons8.com/) - библиотека иконок

## 🔧 Использование

В HTML добавьте ссылки на иконки:

```html
<link rel="icon" type="image/svg+xml" href="assets/icons/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="assets/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/icons/favicon-16x16.png">
```

