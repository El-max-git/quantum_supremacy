/**
 * Article Viewer Module
 * Универсальный модуль для отображения списка статей и их просмотра
 */

class ArticleViewer {
    constructor(config = {}) {
        this.config = {
            basePath: config.basePath || '',
            listContainerId: config.listContainerId || 'articles-list',
            viewerContainerId: config.viewerContainerId || 'article-viewer',
            configPath: config.configPath || '/data/config.json',
            ...config
        };
        
        this.articles = [];
        this.categories = [];
        this.currentArticle = null;
        this.parser = new ArticleParser({ basePath: this.config.basePath });
    }

    /**
     * Инициализация модуля
     */
    async init() {
        try {
            // Загружаем конфигурацию
            await this.loadArticles();
            
            // Отображаем список статей
            this.renderArticlesList();
            
            // Проверяем, есть ли articleId в URL (для прямых ссылок)
            const urlParams = new URLSearchParams(window.location.search);
            const articleId = urlParams.get('id');
            
            if (articleId) {
                await this.viewArticle(articleId);
            }
            
        } catch (error) {
            console.error('ArticleViewer initialization error:', error);
            this.showError('Ошибка загрузки статей: ' + error.message);
        }
    }

    /**
     * Загружает markdown файл с fallback на GitHub Raw API
     * @param {string} mdPath - Путь к файлу относительно корня репозитория
     * @returns {Promise<string>} Содержимое файла
     */
    async fetchArticleFile(mdPath) {
        // Первая попытка: обычный путь через GitHub Pages
        let mdUrl = `${this.config.basePath}/${mdPath}`;
        console.log(`Loading article: ${mdUrl}`);
        
        try {
            const response = await fetch(mdUrl);
            if (response.ok) {
                const text = await response.text();
                console.log(`✓ Loaded from GitHub Pages: ${mdPath}`);
                return text;
            } else {
                // Response не ok (404, 500, etc.) - пробуем fallback
                console.warn(`GitHub Pages returned ${response.status}, trying GitHub Raw API...`);
            }
        } catch (error) {
            console.warn(`Failed to load from GitHub Pages: ${error.message}, trying GitHub Raw API...`);
        }
        
        // Fallback: GitHub Raw API
        // Определяем owner/repo из basePath или используем дефолтные значения
        const basePathMatch = this.config.basePath.match(/\/([^\/]+)$/);
        const repoName = basePathMatch ? basePathMatch[1] : 'quantum_supremacy';
        const owner = 'El-max-git'; // Можно сделать конфигурируемым
        const branch = 'main'; // Можно определить динамически
        
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${mdPath}`;
        console.log(`Trying GitHub Raw API: ${rawUrl}`);
        
        try {
            const response = await fetch(rawUrl);
            if (response.ok) {
                const text = await response.text();
                console.log(`✓ Loaded from GitHub Raw: ${mdPath}`);
                return text;
            } else {
                throw new Error(`GitHub Raw API returned ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`✗ Failed to load ${mdPath} from both sources:`, error);
            throw error;
        }
    }

    /**
     * Автоматическое сканирование папки articles/ и загрузка метаданных из frontmatter
     */
    async loadArticles() {
        // Список статей в папке articles/ (генерируется скриптом scan-articles.js)
        // Формат: articles/articles-list.json с массивом {id, mdFile}
        const articlesListUrl = `${this.config.basePath}/articles/articles-list.json?v=${Date.now()}`;
        
        console.log('ArticleViewer.loadArticles(): Loading from', articlesListUrl);
        
        let articlesList = [];
        
        try {
            // Пытаемся загрузить список статей
            console.log('Fetching articles list...');
            const response = await fetch(articlesListUrl);
            console.log('Response status:', response.status, response.statusText);
            
            if (response.ok) {
                // КРИТИЧЕСКАЯ ПРОВЕРКА: GitHub Pages может вернуть README.md вместо JSON при ошибке
                // Сначала получаем текст, чтобы проверить содержимое
                const responseText = await response.text();
                
                // Проверяем, что это не README.md
                if (responseText.includes('# 📚 Директория статей') || responseText.includes('Эта директория содержит все научные статьи')) {
                    console.error('⚠️ ERROR: Loaded README.md instead of articles-list.json!');
                    console.error('Response text (first 500 chars):', responseText.substring(0, 500));
                    throw new Error('Файл articles-list.json не найден. GitHub Pages вернул README.md вместо JSON.');
                }
                
                // Парсим JSON только если это не README.md
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('⚠️ ERROR: Failed to parse articles-list.json as JSON!');
                    console.error('Response text (first 500 chars):', responseText.substring(0, 500));
                    throw new Error('Файл articles-list.json не является валидным JSON. Возможно, GitHub Pages вернул README.md.');
                }
                
                // Проверяем структуру: tree или flat
                if (data.structure === 'tree' && data.categories) {
                    // Древовидная структура
                    console.log('Using tree structure with categories');
                    this.categories = data.categories;
                    articlesList = this.extractArticlesFromTree(data.categories);
                    console.log(`✓ Found ${articlesList.length} articles in tree structure`);
                } else {
                    // Плоская структура (обратная совместимость)
                    console.log('Using flat structure (legacy)');
                    this.categories = [];
                    articlesList = data.articles || [];
                    console.log(`✓ Loaded articles list from articles-list.json: ${articlesList.length} articles`);
                }
            } else {
                console.warn(`✗ articles/articles-list.json not found (${response.status}), will try to discover articles...`);
                // Fallback: пытаемся найти статьи вручную (если есть известные)
                articlesList = await this.discoverArticles();
            }
        } catch (error) {
            console.error('✗ Error loading articles/articles-list.json:', error);
            articlesList = await this.discoverArticles();
        }
        
        if (articlesList.length === 0) {
            console.warn('No articles found');
            this.articles = [];
            return this.articles;
        }
        
        // Загружаем метаданные из frontmatter каждой статьи
        console.log(`Loading metadata for ${articlesList.length} articles...`);
        
        if (!this.parser) {
            console.error('ArticleParser not initialized!');
            this.articles = [];
            return this.articles;
        }
        
        const articlesWithMetadata = await Promise.all(
            articlesList.map(async (article) => {
                try {
                    // Загружаем markdown файл с fallback на GitHub Raw API
                    let mdPath = article.mdFile;
                    if (mdPath.startsWith('articles/')) {
                        mdPath = mdPath; // Оставляем как есть
                    }
                    
                    const mdText = await this.fetchArticleFile(mdPath);
                    console.log(`Loaded ${article.id}, text length: ${mdText.length}`);
                    
                    // Извлекаем метаданные из frontmatter
                    const { metadata } = this.parser.extractFrontmatter(mdText);
                    console.log(`Extracted metadata for ${article.id}:`, metadata);
                    
                    if (!metadata.id || !metadata.title) {
                        console.warn(`Article ${article.id} missing required metadata (id or title)`);
                        return null;
                    }
                    
                    // Все метаданные из frontmatter
                    return {
                        id: metadata.id,
                        title: metadata.title,
                        author: metadata.author || 'Автор не указан',
                        date: metadata.date || '',
                        category: metadata.category || 'Без категории',
                        tags: metadata.tags || [],
                        description: metadata.description || '',
                        readingTime: metadata.readingTime || null,
                        difficulty: metadata.difficulty || null,
                        path: `/articles?id=${metadata.id}`,
                        mdFile: article.mdFile
                    };
                } catch (error) {
                    console.error(`Error loading metadata for ${article.id}:`, error);
                    return null;
                }
            })
        );
        
        // Фильтруем null (неудачные загрузки)
        this.articles = articlesWithMetadata.filter(a => a !== null);
        
        console.log(`Loaded ${this.articles.length} articles with metadata`);
        
        if (this.articles.length === 0 && articlesList.length > 0) {
            console.error('⚠️ All articles failed to load! Check:');
            console.error('  1. Files are committed to Git');
            console.error('  2. Files are deployed to GitHub Pages');
            console.error('  3. Paths in articles-list.json are correct');
        }
        
        return this.articles;
    }
    
    /**
     * Извлечение всех статей из древовидной структуры
     */
    extractArticlesFromTree(categories) {
        const articles = [];
        
        function traverse(items) {
            if (!items || !Array.isArray(items)) return;
            
            items.forEach(item => {
                if (item.type === 'article') {
                    articles.push({
                        id: item.id,
                        mdFile: item.mdFile
                    });
                } else if (item.type === 'category' && item.items) {
                    traverse(item.items);
                }
            });
        }
        
        if (Array.isArray(categories)) {
            categories.forEach(category => {
                if (category.items) {
                    traverse(category.items);
                }
            });
        }
        
        return articles;
    }

    /**
     * Попытка автоматического обнаружения статей (fallback)
     */
    async discoverArticles() {
        // Список известных статей для fallback
        // В реальности это должно генерироваться скриптом
        const knownArticles = [
            { id: 'test-simple', mdFile: 'articles/test-simple/article.md' },
            { id: 'expanding-universe-hypersphere', mdFile: 'articles/EXPANDING_UNIVERSE_HYPERSPHERE_/EXPANDING_UNIVERSE_HYPERSPHERE_.md' }
        ];
        
        console.log('Using fallback article discovery');
        return knownArticles;
    }

    /**
     * Отображение списка статей (поддержка древовидной структуры)
     */
    renderArticlesList() {
        const container = document.getElementById(this.config.listContainerId);
        
        if (!container) {
            console.error(`Container #${this.config.listContainerId} not found`);
            return;
        }
        
        if (this.articles.length === 0) {
            container.innerHTML = `
                <div class="no-articles">
                    <p>📚 Статьи пока не добавлены</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="articles-grid">';
        
        // Если есть древовидная структура, используем её
        if (this.categories && this.categories.length > 0) {
            html += this.renderCategoriesTree(this.categories);
        } else {
            // Иначе группируем по категориям из метаданных статей
            const byCategory = this.groupByCategory(this.articles);
            
            for (const [category, articles] of Object.entries(byCategory)) {
                html += `
                    <div class="category-section">
                        <h3 class="category-title">${category}</h3>
                        <div class="articles-cards">
                `;
                
                articles.forEach(article => {
                    html += this.renderArticleCard(article);
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Добавляем обработчики кликов
        this.attachCardListeners();
        
        // Добавляем обработчики для сворачивания/разворачивания категорий
        this.attachCategoryToggleListeners();
    }
    
    /**
     * Обработчики для сворачивания/разворачивания категорий
     */
    attachCategoryToggleListeners() {
        const toggles = document.querySelectorAll('.category-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = toggle.dataset.target;
                const content = document.getElementById(targetId);
                if (content) {
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    toggle.textContent = isHidden ? '▲' : '▼';
                }
            });
        });
        
        // Обработчики для заголовков категорий
        const categoryHeaders = document.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-toggle')) return;
                const categoryId = header.dataset.categoryId;
                const content = document.getElementById(categoryId);
                const toggle = header.querySelector('.category-toggle');
                if (content && toggle) {
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    toggle.textContent = isHidden ? '▲' : '▼';
                }
            });
        });
    }
    
    /**
     * Рендеринг древовидной структуры категорий
     */
    renderCategoriesTree(categories, level = 0) {
        let html = '';
        
        // Сортируем категории по order
        const sortedCategories = [...categories].sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
        });
        
        sortedCategories.forEach(category => {
            const categoryId = `category-${category.id}`;
            const hasItems = category.items && category.items.length > 0;
            const icon = category.icon || '📁';
            const title = category.title || category.id;
            const description = category.description || '';
            
            html += `
                <div class="category-section ${level > 0 ? 'category-nested' : ''}" data-level="${level}">
                    <div class="category-header" data-category-id="${categoryId}">
                        <h${Math.min(2 + level, 4)} class="category-title">
                            <span class="category-icon">${icon}</span>
                            ${title}
                            ${hasItems ? `<span class="category-toggle" data-target="${categoryId}">▼</span>` : ''}
                        </h${Math.min(2 + level, 4)}>
                        ${description ? `<p class="category-description">${description}</p>` : ''}
                    </div>
                    <div class="category-content" id="${categoryId}" style="display: ${level === 0 ? 'block' : 'none'};">
            `;
            
            if (hasItems) {
                // Сортируем элементы по order и type (сначала категории, потом статьи)
                const sortedItems = [...category.items].sort((a, b) => {
                    const orderA = a.order !== undefined ? a.order : 999;
                    const orderB = b.order !== undefined ? b.order : 999;
                    if (orderA !== orderB) return orderA - orderB;
                    // Если order одинаковый, категории идут первыми
                    if (a.type === 'category' && b.type === 'article') return -1;
                    if (a.type === 'article' && b.type === 'category') return 1;
                    return 0;
                });
                
                // Группируем: сначала подкатегории, потом статьи
                const subcategories = sortedItems.filter(item => item.type === 'category');
                const articles = sortedItems.filter(item => item.type === 'article');
                
                // Рендерим подкатегории
                if (subcategories.length > 0) {
                    html += this.renderCategoriesTree(subcategories, level + 1);
                }
                
                // Рендерим статьи
                if (articles.length > 0) {
                    html += '<div class="articles-cards">';
                    articles.forEach(item => {
                        const article = this.articles.find(a => a.id === item.id);
                        if (article) {
                            html += this.renderArticleCard(article);
                        }
                    });
                    html += '</div>';
                }
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    /**
     * Группировка статей по категориям
     */
    groupByCategory(articles) {
        const grouped = {};
        
        articles.forEach(article => {
            const category = article.category || 'Без категории';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(article);
        });
        
        return grouped;
    }

    /**
     * Рендер карточки статьи
     */
    renderArticleCard(article) {
        const tags = article.tags ? article.tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('') : '';
        
        return `
            <div class="article-card" data-article-id="${article.id}">
                <div class="article-card-header">
                    <h4 class="article-card-title">${article.title}</h4>
                    ${tags ? `<div class="article-card-tags">${tags}</div>` : ''}
                </div>
                <div class="article-card-body">
                    <p class="article-card-description">${article.description || ''}</p>
                </div>
                <div class="article-card-footer">
                    <span class="article-author">✍️ ${article.author || 'Автор'}</span>
                    <span class="article-date">📅 ${article.date || ''}</span>
                    ${article.readingTime ? `<span class="article-reading-time">⏱️ ${article.readingTime} мин</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Добавление обработчиков на карточки
     */
    attachCardListeners() {
        const cards = document.querySelectorAll('.article-card');
        
        cards.forEach(card => {
            card.addEventListener('click', async () => {
                const articleId = card.dataset.articleId;
                await this.viewArticle(articleId);
            });
        });
    }

    /**
     * Просмотр статьи
     */
    async viewArticle(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        
        if (!article) {
            this.showError(`Статья с ID "${articleId}" не найдена`);
            return;
        }
        
        this.currentArticle = article;
        
        try {
            // Показываем контейнер просмотра
            const viewer = document.getElementById(this.config.viewerContainerId);
            const list = document.getElementById(this.config.listContainerId);
            
            if (viewer) viewer.style.display = 'block';
            if (list) list.style.display = 'none';
            
            // Показываем индикатор загрузки
            if (viewer) {
                viewer.innerHTML = `
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <p>Загрузка статьи...</p>
                    </div>
                `;
            }
            
            // Загружаем markdown с fallback на GitHub Raw API
            const mdText = await this.fetchArticleFile(article.mdFile);
            
            // КРИТИЧЕСКАЯ ПРОВЕРКА: GitHub Pages может вернуть README.md вместо статьи при ошибке
            // Проверяем, что загруженный файл не является README.md
            if (mdText.includes('# 📚 Директория статей') || mdText.includes('Эта директория содержит все научные статьи')) {
                console.error('⚠️ ERROR: Loaded README.md instead of article! This usually means the article file was not found.');
                throw new Error(`Статья "${article.id}" не найдена. Файл ${article.mdFile} не существует или недоступен.`);
            }
            
            // Парсим статью
            console.log(`[ArticleViewer] Parsing article: id=${article.id}, path=${article.path || article.mdFile}`);
            const { html, metadata } = await this.parser.parse(mdText, article.path || article.mdFile);
            console.log(`[ArticleViewer] Article parsed, metadata.id=${metadata?.id}`);
            
            // Рендерим статью
            this.renderArticleView(article, metadata, html);
            
            // Обновляем URL (без перезагрузки страницы)
            const newUrl = `${window.location.pathname}?id=${articleId}`;
            window.history.pushState({ articleId }, '', newUrl);
            
            // Скроллим наверх
            window.scrollTo(0, 0);
            
        } catch (error) {
            console.error('Error loading article:', error);
            this.showError('Ошибка загрузки статьи: ' + error.message);
        }
    }

    /**
     * Рендер просмотра статьи
     */
    renderArticleView(article, metadata, html) {
        const viewer = document.getElementById(this.config.viewerContainerId);
        
        if (!viewer) return;
        
        const title = metadata.title || article.title;
        const author = metadata.author || article.author || '';
        const date = metadata.date || article.date || '';
        const category = metadata.category || article.category || 'Статья';
        const tags = metadata.tags || article.tags || [];
        const readingTime = metadata.readingTime || article.readingTime;
        
        const tagsHtml = tags.length ? tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('') : '';
        
        viewer.innerHTML = `
            <!-- Back Button -->
            <div style="max-width: 1400px; margin: 0 auto; padding: 0 2rem;">
                <button class="back-to-list-btn" id="back-to-list">
                    ← Назад к списку
                </button>
            </div>
            
            <div class="article-wrapper">
                <!-- Table of Contents (сверху) -->
                <aside class="article-toc-top" id="article-toc-sidebar">
                    <h3 class="toc-title">Содержание</h3>
                    <div id="article-toc"></div>
                </aside>
                
                <!-- Article Content (под TOC) -->
                <article class="article-content">
                    <!-- Header -->
                    <header class="article-header">
                        <div class="article-category">${category}</div>
                        <h1 class="article-title">${title}</h1>
                        <div class="article-meta">
                            ${author ? `<span class="article-author">✍️ ${author}</span>` : ''}
                            ${date ? `<span class="article-date">📅 ${date}</span>` : ''}
                            ${readingTime ? `<span class="article-reading-time">⏱️ ${readingTime} мин</span>` : ''}
                        </div>
                        ${tagsHtml ? `<div class="article-tags">${tagsHtml}</div>` : ''}
                    </header>
                    
                    <!-- Body -->
                    <div class="article-body" id="article-body">
                        ${html}
                    </div>
                </article>
            </div>
        `;
        
        // Генерируем содержание
        this.generateTOC();
        
        // Добавляем обработчик кнопки "Назад"
        const backBtn = document.getElementById('back-to-list');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.backToList());
        }
        
        // Рендерим математику если есть
        this.renderMathJax();
    }
    
    /**
     * Рендеринг MathJax формул
     */
    async renderMathJax() {
        const articleBody = document.getElementById('article-body');
        if (!articleBody) {
            console.warn('Article body not found for MathJax rendering');
            return;
        }
        
        // Проверяем наличие формул
        const hasFormulas = articleBody.innerHTML.includes('$$') || 
                           articleBody.innerHTML.includes('$') ||
                           articleBody.innerHTML.includes('\\(') ||
                           articleBody.innerHTML.includes('\\[');
        
        if (!hasFormulas) {
            console.log('No formulas found in article');
            return;
        }
        
        console.log('Rendering MathJax formulas...');
        
        // Ждем загрузки MathJax
        if (typeof MathJax === 'undefined') {
            // Пытаемся загрузить MathJax
            ArticleParser.initMathJax();
            
            // Ждем загрузки и инициализации
            let attempts = 0;
            const checkMathJax = setInterval(() => {
                attempts++;
                // Проверяем, что MathJax полностью загружен и готов
                // В MathJax 3.x typesetPromise доступен после вызова startup.defaultReady()
                const isReady = typeof MathJax !== 'undefined' && 
                               MathJax.typesetPromise && 
                               typeof MathJax.typesetPromise === 'function';
                
                if (isReady) {
                    clearInterval(checkMathJax);
                    console.log('MathJax is ready, rendering formulas...');
                    // Небольшая задержка для гарантии, что DOM обновлен
                    setTimeout(() => this.typesetMath(articleBody), 200);
                } else if (attempts > 200) {
                    clearInterval(checkMathJax);
                    console.warn('MathJax failed to load after 20 seconds');
                    console.log('MathJax state:', {
                        defined: typeof MathJax !== 'undefined',
                        hasTypesetPromise: typeof MathJax !== 'undefined' && !!MathJax.typesetPromise,
                        hasStartup: typeof MathJax !== 'undefined' && !!MathJax.startup,
                        MathJaxKeys: typeof MathJax !== 'undefined' ? Object.keys(MathJax) : []
                    });
                    // Пробуем все равно вызвать typesetMath, если MathJax частично загружен
                    if (typeof MathJax !== 'undefined' && MathJax.typeset) {
                        console.log('Attempting to use MathJax.typeset as fallback...');
                        setTimeout(() => this.typesetMath(articleBody), 500);
                    }
                }
            }, 100);
        } else if (MathJax.typesetPromise && typeof MathJax.typesetPromise === 'function') {
            // MathJax уже загружен и готов
            console.log('MathJax already ready, rendering formulas...');
            setTimeout(() => this.typesetMath(articleBody), 200);
        } else {
            console.warn('MathJax.typesetPromise not available, waiting...');
            // Ждем готовности MathJax
            let attempts = 0;
            const waitForReady = setInterval(() => {
                attempts++;
                
                // Проверяем разные варианты готовности MathJax
                // MathJax 3.x может иметь typesetPromise напрямую или через startup
                const hasTypesetPromise = MathJax.typesetPromise && typeof MathJax.typesetPromise === 'function';
                const hasStartupReady = MathJax.startup && MathJax.startup.ready;
                const hasTypeset = MathJax.typeset && typeof MathJax.typeset === 'function';
                
                if (hasTypesetPromise || (hasStartupReady && hasTypeset)) {
                    clearInterval(waitForReady);
                    console.log('MathJax is ready, rendering formulas...');
                    setTimeout(() => this.typesetMath(articleBody), 300);
                } else if (attempts > 150) {
                    clearInterval(waitForReady);
                    console.error('MathJax did not become ready after 15 seconds');
                    console.log('MathJax state:', {
                        hasTypesetPromise,
                        hasStartupReady,
                        hasTypeset,
                        MathJaxKeys: Object.keys(MathJax || {})
                    });
                    // Пробуем все равно вызвать typesetMath, если MathJax частично загружен
                    if (typeof MathJax !== 'undefined' && hasTypeset) {
                        console.log('Attempting to render with MathJax.typeset...');
                        setTimeout(() => this.typesetMath(articleBody), 500);
                    }
                }
            }, 100);
        }
    }
    
    /**
     * Выполнение рендеринга формул
     */
    async typesetMath(element) {
        if (!element) {
            console.error('Element is null for MathJax rendering');
            return;
        }
        
        // Дополнительная проверка готовности MathJax
        if (typeof MathJax === 'undefined') {
            console.error('MathJax is not defined');
            return;
        }
        
        // Ждем, пока MathJax полностью инициализируется
        let attempts = 0;
        while (attempts < 50) {
            if (MathJax.typesetPromise && typeof MathJax.typesetPromise === 'function') {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!MathJax.typesetPromise) {
            console.error('MathJax.typesetPromise is not available after waiting');
            console.log('MathJax state:', {
                hasTypeset: !!MathJax.typeset,
                hasTypesetPromise: !!MathJax.typesetPromise,
                hasStartup: !!MathJax.startup,
                MathJaxType: typeof MathJax,
                MathJaxKeys: Object.keys(MathJax || {}).slice(0, 20)
            });
            
            // Пробуем использовать альтернативный метод
            if (MathJax.typeset && typeof MathJax.typeset === 'function') {
                console.log('Using MathJax.typeset as fallback...');
                try {
                    MathJax.typeset([element]);
                    console.log('✓ MathJax formulas rendered using typeset');
                    
                    // Проверяем результат
                    const mathElements = element.querySelectorAll('.MathJax, mjx-container');
                    console.log(`Found ${mathElements.length} rendered MathJax elements using typeset`);
                } catch (e) {
                    console.error('MathJax.typeset failed:', e);
                }
            } else {
                console.error('MathJax.typeset is also not available');
            }
            return;
        }
        
        try {
            console.log('Calling MathJax.typesetPromise...');
            await MathJax.typesetPromise([element]);
            console.log('✓ MathJax formulas rendered successfully');
            
            // Проверяем, что формулы действительно отрендерились
            const mathElements = element.querySelectorAll('.MathJax, mjx-container');
            console.log(`Found ${mathElements.length} rendered MathJax elements`);
            
        } catch (err) {
            console.error('MathJax rendering error:', err);
            // Повторная попытка через небольшую задержку
            setTimeout(() => {
                if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                    console.log('Retrying MathJax rendering...');
                    MathJax.typesetPromise([element]).then(() => {
                        console.log('✓ MathJax retry successful');
                    }).catch(e => {
                        console.error('MathJax retry failed:', e);
                    });
                }
            }, 1000);
        }
    }

    /**
     * Генерация содержания
     */
    generateTOC() {
        const tocContainer = document.getElementById('article-toc');
        const articleBody = document.getElementById('article-body');
        
        if (!tocContainer || !articleBody) return;
        
        const toc = new TableOfContents({ minHeadings: 2 });
        const tocHtml = toc.generate(articleBody);
        tocContainer.innerHTML = tocHtml;
        
        // Инициализируем отслеживание скролла
        toc.initScrollTracking();
    }

    /**
     * Возврат к списку статей
     */
    backToList() {
        const viewer = document.getElementById(this.config.viewerContainerId);
        const list = document.getElementById(this.config.listContainerId);
        
        if (viewer) viewer.style.display = 'none';
        if (list) list.style.display = 'block';
        
        this.currentArticle = null;
        
        // Обновляем URL (убираем ?id=...)
        window.history.pushState({}, '', window.location.pathname);
        
        // Скроллим наверх
        window.scrollTo(0, 0);
    }

    /**
     * Показ ошибки
     */
    showError(message) {
        const viewer = document.getElementById(this.config.viewerContainerId);
        const list = document.getElementById(this.config.listContainerId);
        
        if (viewer) {
            viewer.style.display = 'block';
            viewer.innerHTML = `
                <div class="article-error">
                    <h2>❌ Ошибка</h2>
                    <p>${message}</p>
                    <button class="back-to-list-btn" onclick="articleViewer.backToList()">
                        ← Назад к списку
                    </button>
                </div>
            `;
        }
        
        if (list) list.style.display = 'none';
    }
}

// Глобальная переменная для доступа из HTML
window.ArticleViewer = ArticleViewer;
