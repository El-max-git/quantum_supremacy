/**
 * Articles Catalog Module
 * Отображение каталога статей с навигацией по директориям
 */

class ArticlesCatalog {
    constructor(config = {}) {
        this.config = {
            basePath: config.basePath || '',
            listContainerId: config.listContainerId || 'articles-list',
            configPath: config.configPath || '/articles/articles-list.json',
            ...config
        };
        
        this.currentPath = [];
        this.catalogData = null;
        this.metadataCache = {}; // Кэш метаданных статей
    }

    /**
     * Парсинг YAML frontmatter из markdown текста
     */
    parseYAMLFrontmatter(text) {
        const metadata = {};
        const frontmatterMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
        if (!frontmatterMatch) return metadata;
        
        const yamlText = frontmatterMatch[1];
        yamlText.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) return;
            
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();
            
            // Удаляем кавычки
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            
            // Парсим массивы
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.substring(1, value.length - 1)
                    .split(',')
                    .map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
            
            metadata[key] = value;
        });
        
        return metadata;
    }

    /**
     * Загрузка метаданных статьи из markdown файла
     */
    async loadArticleMetadata(mdFile) {
        // Проверяем кэш
        if (this.metadataCache[mdFile]) {
            return this.metadataCache[mdFile];
        }
        
        try {
            // Формируем путь: basePath может уже содержать слеш или нет
            const path = mdFile.startsWith('/') 
                ? `${this.config.basePath}${mdFile}`
                : `${this.config.basePath}/${mdFile}`;
            
            const response = await fetch(path, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.ok) {
                console.warn(`[ArticlesCatalog] Failed to load ${path}: ${response.status}`);
                return null;
            }
            
            const text = await response.text();
            const metadata = this.parseYAMLFrontmatter(text);
            
            // Кэшируем результат
            this.metadataCache[mdFile] = metadata;
            return metadata;
        } catch (error) {
            console.warn(`[ArticlesCatalog] Failed to load metadata for ${mdFile}:`, error);
            return null;
        }
    }

    /**
     * Загрузка метаданных для всех статей в текущей директории
     */
    async enrichArticlesWithMetadata(articles) {
        console.log(`[ArticlesCatalog] Enriching ${articles.length} articles with metadata`);
        
        const enrichedArticles = await Promise.all(articles.map(async (article) => {
            // Если уже есть description, не загружаем
            if (article.description && article.title) {
                return article;
            }
            
            // Загружаем метаданные из файла
            if (article.mdFile) {
                const metadata = await this.loadArticleMetadata(article.mdFile);
                if (metadata) {
                    const enriched = {
                        ...article,
                        title: article.title || metadata.title || article.id,
                        description: article.description || metadata.description || ''
                    };
                    console.log(`[ArticlesCatalog] Enriched ${article.id}: description="${enriched.description.substring(0, 50)}..."`);
                    return enriched;
                } else {
                    console.log(`[ArticlesCatalog] No metadata found for ${article.id}`);
                }
            }
            
            return article;
        }));
        
        return enrichedArticles;
    }

    /**
     * Инициализация каталога
     */
    async init() {
        try {
            // Загружаем данные каталога (без кэша для актуальных данных)
            const response = await fetch(`${this.config.basePath}${this.config.configPath}`, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to load catalog: ${response.status}`);
            }
            
            this.catalogData = await response.json();
            
            // Отображаем корневой каталог
            await this.renderCatalog();
            
        } catch (error) {
            console.error('ArticlesCatalog initialization error:', error);
            this.showError('Ошибка загрузки каталога статей: ' + error.message);
        }
    }

    /**
     * Получение текущей директории на основе пути
     */
    getCurrentDirectory() {
        let current = this.catalogData.categories || [];
        
        // Навигация по пути
        for (const pathSegment of this.currentPath) {
            const found = current.find(item => item.id === pathSegment);
            
            if (found && found.items) {
                current = found.items;
            } else {
                return [];
            }
        }
        
        // Сортируем по order
        return current.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
        });
    }

    /**
     * Рендер каталога
     */
    async renderCatalog() {
        const container = document.getElementById(this.config.listContainerId);
        if (!container) {
            console.error(`Container #${this.config.listContainerId} not found`);
            return;
        }

        const currentDir = this.getCurrentDirectory();
        
        let html = '<div class="articles-grid">';
        
        // Хлебные крошки (breadcrumbs)
        if (this.currentPath.length > 0) {
            html += this.renderBreadcrumbs();
        }
        
        // Отображаем элементы текущей директории
        if (currentDir.length === 0) {
            html += `
                <div class="no-articles">
                    <p>📁 Директория пуста</p>
                </div>
            `;
        } else {
            // Группируем: сначала директории (есть items), потом статьи (есть mdFile)
            const directories = currentDir.filter(item => item.items !== undefined);
            let articles = currentDir.filter(item => item.mdFile !== undefined);
            
            // Отображаем директории
            if (directories.length > 0) {
                html += '<div class="catalog-directories">';
                html += '<h2 class="catalog-section-title">📁 Директории</h2>';
                html += '<div class="directories-grid">';
                
                directories.forEach(dir => {
                    html += this.renderDirectoryItem(dir);
                });
                
                html += '</div></div>';
            }
            
            // Отображаем статьи (сначала без метаданных для быстрой отрисовки)
            if (articles.length > 0) {
                html += '<div class="catalog-articles">';
                html += '<h2 class="catalog-section-title">📄 Статьи</h2>';
                html += '<div class="articles-cards">';
                
                articles.forEach(article => {
                    html += this.renderArticleItem(article);
                });
                
                html += '</div></div>';
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Добавляем обработчики кликов
        this.attachEventListeners();
        
        // Загружаем метаданные асинхронно и обновляем карточки
        if (currentDir.length > 0) {
            const articles = currentDir.filter(item => item.mdFile !== undefined);
            if (articles.length > 0) {
                const enrichedArticles = await this.enrichArticlesWithMetadata(articles);
                this.updateArticleCards(enrichedArticles);
            }
        }
    }

    /**
     * Обновление карточек статей с загруженными метаданными
     */
    updateArticleCards(enrichedArticles) {
        console.log(`[ArticlesCatalog] Updating ${enrichedArticles.length} article cards`);
        
        enrichedArticles.forEach(article => {
            const card = document.querySelector(`.article-card[data-id="${article.id}"]`);
            if (!card) {
                console.warn(`[ArticlesCatalog] Card not found for article ${article.id}`);
                return;
            }
            
            // Обновляем заголовок, если изменился
            const titleElement = card.querySelector('.article-card-title');
            if (titleElement && article.title && titleElement.textContent !== article.title) {
                titleElement.textContent = article.title;
            }
            
            // Обновляем описание
            const bodyElement = card.querySelector('.article-card-body');
            const description = article.description || '';
            
            if (description) {
                if (bodyElement) {
                    // Обновляем существующее описание
                    const descElement = bodyElement.querySelector('.article-card-description');
                    if (descElement) {
                        descElement.textContent = description;
                        console.log(`[ArticlesCatalog] Updated description for ${article.id}`);
                    }
                } else {
                    // Добавляем новое описание
                    const header = card.querySelector('.article-card-header');
                    if (header) {
                        const newBody = document.createElement('div');
                        newBody.className = 'article-card-body';
                        newBody.innerHTML = `<p class="article-card-description">${this.escapeHtml(description)}</p>`;
                        header.after(newBody);
                        console.log(`[ArticlesCatalog] Added description for ${article.id}`);
                    } else {
                        console.warn(`[ArticlesCatalog] Header not found for article ${article.id}`);
                    }
                }
            } else {
                console.log(`[ArticlesCatalog] No description for ${article.id}`);
            }
        });
    }

    /**
     * Экранирование HTML для безопасности
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Рендер хлебных крошек
     */
    renderBreadcrumbs() {
        let html = '<nav class="breadcrumbs" aria-label="Навигация">';
        html += '<ol class="breadcrumbs-list">';
        
        // Корневая ссылка
        html += '<li class="breadcrumb-item">';
        html += `<a href="#" class="breadcrumb-link" data-path="">🏠 Главная</a>`;
        html += '</li>';
        
        // Путь к текущей директории
        let path = [];
        for (let i = 0; i < this.currentPath.length; i++) {
            path.push(this.currentPath[i]);
            const category = this.findCategoryById(this.currentPath[i]);
            const name = category ? category.title : this.currentPath[i];
            
            html += '<li class="breadcrumb-item">';
            if (i < this.currentPath.length - 1) {
                html += `<a href="#" class="breadcrumb-link" data-path="${path.join('/')}">${name}</a>`;
            } else {
                html += `<span class="breadcrumb-current">${name}</span>`;
            }
            html += '</li>';
        }
        
        html += '</ol></nav>';
        return html;
    }

    /**
     * Рендер элемента директории
     */
    renderDirectoryItem(dir) {
        const icon = dir.icon || '📁';
        const title = dir.title || dir.id;
        const description = dir.description || '';
        const itemCount = dir.items ? dir.items.length : 0;
        
        return `
            <div class="directory-card" data-type="directory" data-id="${dir.id}">
                <div class="directory-card-header">
                    <div class="directory-icon">${icon}</div>
                    <h3 class="directory-title">${title}</h3>
                </div>
                ${description ? `<p class="directory-description">${description}</p>` : ''}
                <div class="directory-footer">
                    <span class="directory-count">${itemCount} элементов</span>
                </div>
            </div>
        `;
    }

    /**
     * Рендер элемента статьи
     */
    renderArticleItem(article) {
        const title = article.title || article.id;
        const description = article.description || '';
        
        return `
            <div class="article-card" data-type="article" data-id="${article.id}">
                <div class="article-card-header">
                    <h4 class="article-card-title">${title}</h4>
                </div>
                ${description ? `<div class="article-card-body"><p class="article-card-description">${description}</p></div>` : ''}
            </div>
        `;
    }

    /**
     * Поиск категории по ID
     */
    findCategoryById(id) {
        const search = (items) => {
            for (const item of items) {
                if (item.id === id) return item;
                if (item.items) {
                    const found = search(item.items);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return search(this.catalogData.categories || []);
    }

    /**
     * Добавление обработчиков событий
     */
    attachEventListeners() {
        // Клики по директориям
        const directoryCards = document.querySelectorAll('.directory-card[data-type="directory"]');
        directoryCards.forEach(card => {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchMoved = false;
            
            // Универсальная функция обработки клика/тапа
            const handleInteraction = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dirId = card.dataset.id;
                this.navigateToDirectory(dirId);
            };
            
            // Отслеживаем начало касания
            card.addEventListener('touchstart', (e) => {
                touchMoved = false;
                if (e.touches.length > 0) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });
            
            // Отслеживаем движение (свайп/скролл)
            card.addEventListener('touchmove', () => {
                touchMoved = true;
            }, { passive: true });
            
            // Обрабатываем окончание касания только если не было движения
            card.addEventListener('touchend', (e) => {
                if (!touchMoved) {
                    e.preventDefault();
                    handleInteraction(e);
                }
            }, { passive: false });
            
            // Обработчик клика для десктопа
            card.addEventListener('click', handleInteraction);
        });
        
        // Клики по статьям
        const articleCards = document.querySelectorAll('.article-card[data-type="article"]');
        articleCards.forEach(card => {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchMoved = false;
            
            // Универсальная функция обработки клика/тапа
            const handleInteraction = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const articleId = card.dataset.id;
                this.openArticle(articleId);
            };
            
            // Отслеживаем начало касания
            card.addEventListener('touchstart', (e) => {
                touchMoved = false;
                if (e.touches.length > 0) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });
            
            // Отслеживаем движение (свайп/скролл)
            card.addEventListener('touchmove', () => {
                touchMoved = true;
            }, { passive: true });
            
            // Обрабатываем окончание касания только если не было движения
            card.addEventListener('touchend', (e) => {
                if (!touchMoved) {
                    e.preventDefault();
                    handleInteraction(e);
                }
            }, { passive: false });
            
            // Обработчик клика для десктопа
            card.addEventListener('click', handleInteraction);
        });
        
        // Клики по хлебным крошкам
        const breadcrumbLinks = document.querySelectorAll('.breadcrumb-link');
        breadcrumbLinks.forEach(link => {
            const handleClick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const path = link.dataset.path;
                if (path === '') {
                    this.currentPath = [];
                } else {
                    this.currentPath = path.split('/');
                }
                await this.renderCatalog();
            };
            
            link.addEventListener('click', handleClick);
            link.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleClick(e);
            }, { passive: false });
        });
    }

    /**
     * Навигация в директорию
     */
    async navigateToDirectory(dirId) {
        this.currentPath.push(dirId);
        await this.renderCatalog();
    }

    /**
     * Открытие статьи
     */
    openArticle(articleId) {
        if (!articleId) {
            console.error('[ArticlesCatalog] No articleId provided to openArticle()');
            return;
        }
        
        const articleUrl = `/article?id=${encodeURIComponent(articleId)}`;
        
        // Навигация на страницу просмотра статьи через роутер
        if (window.router) {
            try {
                window.router.navigate(articleUrl);
            } catch (error) {
                console.error('[ArticlesCatalog] Error in router.navigate():', error);
                window.location.href = articleUrl;
            }
        } else {
            window.location.href = articleUrl;
        }
    }

    /**
     * Показ ошибки
     */
    showError(message) {
        const container = document.getElementById(this.config.listContainerId);
        if (container) {
            container.innerHTML = `
                <div class="article-error">
                    <h2>❌ Ошибка</h2>
                    <p>${message}</p>
                </div>
            `;
        }
    }
}

// Экспорт для использования
if (typeof window !== 'undefined') {
    window.ArticlesCatalog = ArticlesCatalog;
}
