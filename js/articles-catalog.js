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
            this.renderCatalog();
            
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
    renderCatalog() {
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
            const articles = currentDir.filter(item => item.mdFile !== undefined);
            
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
            
            // Отображаем статьи
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
        // Вычисляем путь автоматически на основе текущей навигации
        const computedPath = this.currentPath.length > 0 
            ? this.currentPath.join('/') + '/' + article.id
            : article.id;
        
        return `
            <div class="article-card" data-type="article" data-id="${article.id}">
                <div class="article-card-header">
                    <h4 class="article-card-title">${title}</h4>
                </div>
                ${description ? `<div class="article-card-body"><p class="article-card-description">${description}</p></div>` : ''}
                <div class="article-card-footer">
                    <span class="article-path" title="${computedPath}">📁 ${computedPath}</span>
                </div>
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
        document.querySelectorAll('.directory-card[data-type="directory"]').forEach(card => {
            card.addEventListener('click', () => {
                const dirId = card.dataset.id;
                this.navigateToDirectory(dirId);
            });
        });
        
        // Клики по статьям
        document.querySelectorAll('.article-card[data-type="article"]').forEach(card => {
            card.addEventListener('click', () => {
                const articleId = card.dataset.id;
                this.openArticle(articleId);
            });
        });
        
        // Клики по хлебным крошкам
        document.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.dataset.path;
                if (path === '') {
                    this.currentPath = [];
                } else {
                    this.currentPath = path.split('/');
                }
                this.renderCatalog();
            });
        });
    }

    /**
     * Навигация в директорию
     */
    navigateToDirectory(dirId) {
        this.currentPath.push(dirId);
        this.renderCatalog();
    }

    /**
     * Открытие статьи
     */
    openArticle(articleId) {
        // Навигация на страницу просмотра статьи через роутер
        if (window.router) {
            window.router.navigate(`/article?id=${articleId}`);
        } else {
            window.location.href = `/article?id=${articleId}`;
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
