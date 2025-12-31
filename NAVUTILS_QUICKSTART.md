# 🚀 NavUtils Quick Start

> **Как правильно создавать навигацию в Quantum Supremacy**

---

## ⚡ Главное правило

**❌ НЕ ИСПОЛЬЗОВАТЬ:**
```html
<button onclick="router.navigate('/about')">О проекте</button>
```

**✅ ИСПОЛЬЗОВАТЬ:**
```html
<!-- Вариант 1: Обычная ссылка с data-link -->
<a href="/about" data-link class="button">О проекте</a>

<!-- Вариант 2: Через NavUtils (в script) -->
<script>
const button = NavUtils.createButton('/about', 'О проекте');
document.body.appendChild(button);
</script>
```

---

## 📋 Быстрые примеры

### 1. Кнопка навигации

```html
<div id="my-button"></div>
<script>
    const btn = NavUtils.createButton('/quantum-basics', 'Начать обучение', 'button');
    document.getElementById('my-button').appendChild(btn);
</script>
```

### 2. Навигация "Предыдущий / Следующий"

```html
<div id="navigation"></div>
<script>
    // Автоматически извлекает названия и описания из config.json
    const nav = NavUtils.createPrevNextNav('/quantum-basics', '/casimir-effect');
    document.getElementById('navigation').appendChild(nav);
</script>
```

### 3. Навигационная карточка

```html
<div id="card"></div>
<script>
    const card = NavUtils.createNavCard('/vacuum-physics', {
        icon: '🌌',
        title: 'Квантовый вакуум',
        description: 'Узнайте о нулевой энергии',
        status: '✅ Доступно'
    });
    document.getElementById('card').appendChild(card);
</script>
```

---

## 📚 Полная документация

Смотри **[docs/NAVUTILS_GUIDE.md](docs/NAVUTILS_GUIDE.md)** для:
- Полного API Reference
- Примеров использования
- Руководства по миграции
- Правил и best practices

---

## 🎯 Почему NavUtils?

✅ **Единственный источник правды** - `data/config.json`  
✅ **Нет дублирования** кода  
✅ **Автоматическое извлечение** названий и описаний  
✅ **Легко поддерживать** и расширять  

---

**Используй NavUtils везде!** 🚀
