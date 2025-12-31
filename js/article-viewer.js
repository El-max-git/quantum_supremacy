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
                const data = await response.json();
                articlesList = data.articles || [];
                console.log(`✓ Loaded articles list from articles-list.json: ${articlesList.length} articles`);
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
                    // Загружаем markdown файл
                    const mdUrl = `${this.config.basePath}/${article.mdFile}`;
                    console.log(`Loading article: ${mdUrl}`);
                    const mdResponse = await fetch(mdUrl);
                    
                    if (!mdResponse.ok) {
                        console.warn(`Failed to load ${article.mdFile}: ${mdResponse.status}`);
                        return null;
                    }
                    
                    const mdText = await mdResponse.text();
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
        
        return this.articles;
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
     * Отображение списка статей
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
        
        // Группируем по категориям
        const byCategory = this.groupByCategory(this.articles);
        
        let html = '<div class="articles-grid">';
        
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
        
        html += '</div>';
        container.innerHTML = html;
        
        // Добавляем обработчики кликов
        this.attachCardListeners();
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
            
            // Загружаем markdown
            const mdUrl = `${this.config.basePath}/${article.mdFile}`;
            const response = await fetch(mdUrl);
            
            if (!response.ok) {
                throw new Error(`Не удалось загрузить статью: ${response.status}`);
            }
            
            const mdText = await response.text();
            
            // Парсим статью
            const { html, metadata } = await this.parser.parse(mdText, article.path);
            
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
            <div class="article-wrapper">
                <!-- Back Button -->
                <button class="back-to-list-btn" id="back-to-list">
                    ← Назад к списку
                </button>
                
                <!-- Table of Contents -->
                <aside class="article-toc-sidebar" id="article-toc-sidebar">
                    <div class="toc-sticky">
                        <h3 class="toc-title">Содержание</h3>
                        <div id="article-toc"></div>
                    </div>
                </aside>
                
                <!-- Article Content -->
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
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            MathJax.typesetPromise([document.getElementById('article-body')]).catch(err => {
                console.warn('MathJax rendering error:', err);
            });
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
