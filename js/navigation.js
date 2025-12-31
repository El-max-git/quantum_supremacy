/**
 * Navigation Utilities
 * Модуль для работы с навигацией из config.json
 * DRY принцип - единственный источник правды для всех ссылок
 */

class NavUtils {
    static config = null;
    static basePath = '';

    /**
     * Инициализация с конфигурацией
     * @param {Object} config - конфигурация из config.json
     * @param {string} basePath - базовый путь (для GitHub Pages)
     */
    static init(config, basePath = '') {
        this.config = config;
        this.basePath = basePath;
    }

    /**
     * Получить маршрут по пути
     * @param {string} path - путь маршрута
     * @returns {Object|null} - объект маршрута или null
     */
    static getRoute(path) {
        if (!this.config || !this.config.routes) {
            console.error('NavUtils not initialized or routes not found');
            return null;
        }
        return this.config.routes.find(route => route.path === path) || null;
    }

    /**
     * Создать ссылку с data-link атрибутом
     * @param {string} path - путь
     * @param {string} text - текст ссылки
     * @param {string} className - CSS класс (опционально)
     * @returns {HTMLAnchorElement}
     */
    static createLink(path, text, className = '') {
        const a = document.createElement('a');
        a.href = path;
        a.textContent = text;
        a.setAttribute('data-link', '');
        if (className) {
            a.className = className;
        }
        return a;
    }

    /**
     * Создать кнопку-ссылку
     * @param {string} path - путь
     * @param {string} text - текст кнопки
     * @param {string} className - CSS класс (опционально, по умолчанию 'button')
     * @returns {HTMLAnchorElement}
     */
    static createButton(path, text, className = 'button') {
        return this.createLink(path, text, className);
    }

    /**
     * Создать навигационную карточку (для главной страницы)
     * @param {string} path - путь
     * @param {Object} options - опции {icon, title, description, status, className}
     * @returns {HTMLDivElement}
     */
    static createNavCard(path, options = {}) {
        const {
            icon = '📄',
            title = 'Без названия',
            description = '',
            status = null,
            className = 'tech-card'
        } = options;

        const card = document.createElement('div');
        card.className = className;
        card.style.cursor = 'pointer';
        
        // Используем data-link для навигации
        card.setAttribute('data-nav-card', path);
        
        card.innerHTML = `
            <i>${icon}</i>
            <h3>${title}</h3>
            <p>${description}</p>
            ${status ? `<small style="color: var(--primary-color); font-weight: 600;">${status}</small>` : ''}
        `;

        // Добавляем обработчик клика
        card.addEventListener('click', () => {
            if (window.router) {
                window.router.navigate(path);
            }
        });

        return card;
    }

    /**
     * Создать навигационный блок "предыдущий/следующий"
     * @param {string} prevPath - путь на предыдущую страницу (null если нет)
     * @param {string} nextPath - путь на следующую страницу (null если нет)
     * @returns {HTMLDivElement}
     */
    static createPrevNextNav(prevPath, nextPath) {
        const container = document.createElement('div');
        container.className = 'container';
        container.style.marginTop = '3rem';

        const grid = document.createElement('div');
        grid.className = 'cards-grid';
        grid.style.gridTemplateColumns = '1fr 1fr';

        if (prevPath) {
            const prevRoute = this.getRoute(prevPath);
            const prevCard = document.createElement('div');
            prevCard.className = 'card';
            prevCard.style.cursor = 'pointer';
            prevCard.setAttribute('data-nav-card', prevPath);
            prevCard.innerHTML = `
                <h4>← Предыдущий этап: ${prevRoute ? prevRoute.title.split(' - ')[0].replace(/Этап \d+: /, '') : 'Назад'}</h4>
                <p>${prevRoute ? prevRoute.meta?.description || 'Вернуться к предыдущему этапу' : ''}</p>
            `;
            prevCard.addEventListener('click', () => {
                if (window.router) window.router.navigate(prevPath);
            });
            grid.appendChild(prevCard);
        }

        if (nextPath) {
            const nextRoute = this.getRoute(nextPath);
            const nextCard = document.createElement('div');
            nextCard.className = 'card';
            nextCard.style.cursor = 'pointer';
            nextCard.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))';
            nextCard.setAttribute('data-nav-card', nextPath);
            nextCard.innerHTML = `
                <h4>Следующий этап: ${nextRoute ? nextRoute.title.split(' - ')[0].replace(/Этап \d+: /, '') : 'Далее'} →</h4>
                <p>${nextRoute ? nextRoute.meta?.description || 'Перейти к следующему этапу' : ''}</p>
            `;
            nextCard.addEventListener('click', () => {
                if (window.router) window.router.navigate(nextPath);
            });
            grid.appendChild(nextCard);
        }

        container.appendChild(grid);
        return container;
    }

    /**
     * Создать кнопку "Назад на главную"
     * @param {string} className - CSS класс (опционально)
     * @returns {HTMLAnchorElement}
     */
    static createHomeButton(className = 'button outline') {
        return this.createButton('/', 'Вернуться на главную', className);
    }

    /**
     * Получить все маршруты с определенным условием
     * @param {Function} filterFn - функция фильтрации
     * @returns {Array} - отфильтрованные маршруты
     */
    static getRoutes(filterFn) {
        if (!this.config || !this.config.routes) {
            return [];
        }
        return filterFn ? this.config.routes.filter(filterFn) : this.config.routes;
    }

    /**
     * Получить маршруты для меню (inMenu: true)
     * @returns {Array} - маршруты для меню
     */
    static getMenuRoutes() {
        return this.getRoutes(route => route.inMenu)
            .sort((a, b) => (a.order || 999) - (b.order || 999));
    }

    /**
     * Генерация HTML навигации для вставки в страницу
     * @param {string} prevPath - предыдущая страница
     * @param {string} nextPath - следующая страница
     * @returns {string} - HTML код
     */
    static generatePrevNextHTML(prevPath, nextPath) {
        const prevRoute = prevPath ? this.getRoute(prevPath) : null;
        const nextRoute = nextPath ? this.getRoute(nextPath) : null;

        let html = '<div class="container" style="margin-top: 3rem;"><div class="cards-grid" style="grid-template-columns: 1fr 1fr;">';

        if (prevRoute) {
            html += `
                <div class="card" style="cursor: pointer;" onclick="router.navigate('${prevPath}')">
                    <h4>← Предыдущий этап: ${prevRoute.title.split(' - ')[0].replace(/Этап \d+: /, '')}</h4>
                    <p>${prevRoute.meta?.description || 'Вернуться к предыдущему этапу'}</p>
                </div>
            `;
        }

        if (nextRoute) {
            html += `
                <div class="card" style="cursor: pointer; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));" onclick="router.navigate('${nextPath}')">
                    <h4>Следующий этап: ${nextRoute.title.split(' - ')[0].replace(/Этап \d+: /, '')} →</h4>
                    <p>${nextRoute.meta?.description || 'Перейти к следующему этапу'}</p>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }
}

// Экспортируем для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavUtils;
}
