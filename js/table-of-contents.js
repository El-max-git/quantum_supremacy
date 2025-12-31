/**
 * Table of Contents Generator
 * Генератор автоматического содержания для статей
 */

class TableOfContents {
    constructor(config = {}) {
        this.config = {
            minHeadings: config.minHeadings || 3, // Минимум заголовков для генерации TOC
            maxLevel: config.maxLevel || 4, // Максимальный уровень заголовков (H1-H4)
            scrollOffset: config.scrollOffset || 80, // Отступ при скролле
            activeClass: config.activeClass || 'active',
            ...config
        };
        
        this.headings = [];
        this.currentActive = null;
    }

    /**
     * Генерация содержания из HTML элемента
     * @param {HTMLElement|string} content - DOM элемент или HTML строка
     * @returns {string} - HTML строка с содержанием
     */
    generate(content) {
        let element = content;
        
        // Если передана строка, создаем временный элемент
        if (typeof content === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = content;
            element = temp;
        }
        
        // Извлекаем заголовки
        this.headings = this.extractHeadings(element);
        
        // Если заголовков меньше минимума, не генерируем TOC
        if (this.headings.length < this.config.minHeadings) {
            return '<p class="toc-empty">Содержание недоступно</p>';
        }
        
        // Генерируем HTML содержания
        return this.renderToc(this.headings);
    }

    /**
     * Извлечение заголовков из элемента
     */
    extractHeadings(element) {
        const selector = Array.from({ length: this.config.maxLevel }, (_, i) => `h${i + 1}`).join(', ');
        const headingElements = element.querySelectorAll(selector);
        const headings = [];
        
        headingElements.forEach((heading, index) => {
            const level = parseInt(heading.tagName[1]);
            const text = heading.textContent.trim();
            let id = heading.id;
            
            // Если ID нет, генерируем его
            if (!id) {
                id = this.generateId(text, index);
                heading.id = id;
            }
            
            headings.push({
                level,
                text,
                id,
                element: heading
            });
        });
        
        return headings;
    }

    /**
     * Генерация ID из текста
     */
    generateId(text, index) {
        // Удаляем номера разделов в начале (например, "1.2. ")
        let cleanText = text.replace(/^\d+\.?\s*/, '');
        
        let id = cleanText
            .toLowerCase()
            // Удаляем спецсимволы, оставляем буквы, цифры, пробелы и дефисы
            .replace(/[^а-яa-z0-9\s-]/g, '')
            // Заменяем пробелы на дефисы
            .replace(/\s+/g, '-')
            // Убираем повторяющиеся дефисы
            .replace(/-+/g, '-')
            // Убираем дефисы в начале и конце
            .replace(/^-|-$/g, '');
        
        // Если ID пустой, используем индекс
        if (!id) {
            id = `section-${index}`;
        }
        
        return id;
    }

    /**
     * Рендеринг HTML содержания
     */
    renderToc(headings) {
        if (!headings.length) return '';
        
        let html = '<nav class="toc-nav"><ul class="toc-list">';
        let currentLevel = headings[0].level;
        
        headings.forEach((heading, index) => {
            const { level, text, id } = heading;
            
            // Открываем вложенные списки
            while (level > currentLevel) {
                html += '<ul class="toc-list-nested">';
                currentLevel++;
            }
            
            // Закрываем вложенные списки
            while (level < currentLevel) {
                html += '</ul></li>';
                currentLevel--;
            }
            
            // Добавляем элемент списка
            html += `<li class="toc-item toc-level-${level}">
                <a href="#${id}" class="toc-link" data-toc-target="${id}">
                    ${this.escapeHtml(text)}
                </a>`;
            
            // Закрываем элемент, если следующий на том же или меньшем уровне
            const nextLevel = headings[index + 1]?.level;
            if (!nextLevel || nextLevel <= level) {
                html += '</li>';
            }
        });
        
        // Закрываем оставшиеся списки
        while (currentLevel > headings[0].level) {
            html += '</ul></li>';
            currentLevel--;
        }
        
        html += '</ul></nav>';
        
        return html;
    }

    /**
     * Инициализация активного отслеживания скролла
     */
    initScrollTracking() {
        if (typeof window === 'undefined') return;
        
        // Добавляем обработчик скролла
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.updateActiveHeading();
                    ticking = false;
                });
                ticking = true;
            }
        });
        
        // Добавляем обработчики кликов по ссылкам TOC
        this.initSmoothScroll();
        
        // Начальное обновление
        this.updateActiveHeading();
    }

    /**
     * Обновление активного заголовка при скролле
     */
    updateActiveHeading() {
        if (!this.headings.length) return;
        
        const scrollPosition = window.scrollY + this.config.scrollOffset;
        let activeHeading = null;
        
        // Находим текущий активный заголовок
        for (let i = this.headings.length - 1; i >= 0; i--) {
            const heading = this.headings[i];
            if (heading.element && heading.element.offsetTop <= scrollPosition) {
                activeHeading = heading;
                break;
            }
        }
        
        // Если активный заголовок изменился
        if (activeHeading && activeHeading !== this.currentActive) {
            this.setActiveLink(activeHeading.id);
            this.currentActive = activeHeading;
        }
    }

    /**
     * Установка активной ссылки в TOC
     */
    setActiveLink(id) {
        // Убираем активный класс у всех ссылок
        document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.remove(this.config.activeClass);
        });
        
        // Добавляем активный класс к текущей ссылке
        const activeLink = document.querySelector(`.toc-link[data-toc-target="${id}"]`);
        if (activeLink) {
            activeLink.classList.add(this.config.activeClass);
            
            // Прокручиваем TOC, чтобы активная ссылка была видна
            this.scrollTocToActive(activeLink);
        }
    }

    /**
     * Прокрутка TOC к активной ссылке
     */
    scrollTocToActive(activeLink) {
        const tocNav = activeLink.closest('.toc-nav');
        if (!tocNav) return;
        
        const linkTop = activeLink.offsetTop;
        const linkHeight = activeLink.offsetHeight;
        const tocHeight = tocNav.offsetHeight;
        const tocScroll = tocNav.scrollTop;
        
        // Если ссылка не видна, прокручиваем
        if (linkTop < tocScroll || linkTop + linkHeight > tocScroll + tocHeight) {
            tocNav.scrollTop = linkTop - tocHeight / 2 + linkHeight / 2;
        }
    }

    /**
     * Инициализация плавной прокрутки
     */
    initSmoothScroll() {
        document.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetId = link.getAttribute('data-toc-target');
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const targetPosition = targetElement.offsetTop - this.config.scrollOffset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Обновляем URL без перезагрузки страницы
                    if (history.pushState) {
                        history.pushState(null, null, `#${targetId}`);
                    }
                }
            });
        });
    }

    /**
     * Генерация компактного содержания (только H2 и H3)
     */
    generateCompact(content) {
        const compactConfig = { ...this.config, maxLevel: 3 };
        const originalConfig = this.config;
        this.config = compactConfig;
        
        const result = this.generate(content);
        
        this.config = originalConfig;
        return result;
    }

    /**
     * Генерация развернутого содержания (все уровни)
     */
    generateFull(content) {
        const fullConfig = { ...this.config, maxLevel: 6 };
        const originalConfig = this.config;
        this.config = fullConfig;
        
        const result = this.generate(content);
        
        this.config = originalConfig;
        return result;
    }

    /**
     * Получение структуры заголовков как JSON
     */
    getStructure(content) {
        let element = content;
        
        if (typeof content === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = content;
            element = temp;
        }
        
        const headings = this.extractHeadings(element);
        
        return headings.map(h => ({
            level: h.level,
            text: h.text,
            id: h.id,
            children: []
        }));
    }

    /**
     * Экранирование HTML
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Статический метод для быстрой генерации
     */
    static quick(content, config = {}) {
        const toc = new TableOfContents(config);
        return toc.generate(content);
    }

    /**
     * Статический метод для генерации с отслеживанием
     */
    static withTracking(content, config = {}) {
        const toc = new TableOfContents(config);
        const html = toc.generate(content);
        
        // Ждем следующего тика, чтобы DOM обновился
        setTimeout(() => {
            toc.initScrollTracking();
        }, 0);
        
        return html;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableOfContents;
}
