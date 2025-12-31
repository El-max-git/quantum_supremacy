/**
 * Article Parser
 * Парсер для преобразования markdown статей в HTML
 * с поддержкой математики, специальных блоков и ссылок
 */

class ArticleParser {
    constructor(config = {}) {
        this.config = {
            basePath: config.basePath || '/articles',
            mathRenderer: config.mathRenderer || 'mathjax',
            autoAnchors: config.autoAnchors !== false,
            imageBasePath: config.imageBasePath || '',
            ...config
        };
        
        this.currentArticlePath = '';
        this.headingIds = new Set(); // Для уникальности ID
    }

    /**
     * Главный метод парсинга
     * @param {string} markdownText - Исходный markdown текст
     * @param {string} articlePath - Путь к статье (для относительных ссылок)
     * @returns {Promise<{html: string, metadata: object}>} - HTML и метаданные
     */
    async parse(markdownText, articlePath = '') {
        this.currentArticlePath = articlePath;
        this.headingIds.clear();

        try {
            // 0. Extract frontmatter (YAML metadata)
            const { content, metadata } = this.extractFrontmatter(markdownText);
            
            // 1. Pre-process: специальные блоки
            let processed = this.preprocessSpecialBlocks(content);
            
            // 2. Pre-process: рамки для формул
            processed = this.preprocessFormulaBoxes(processed);
            
            // 3. Parse markdown to HTML
            let html = await this.convertMarkdownToHtml(processed);
            
            // 4. Post-process: изображения
            html = this.processImages(html, articlePath);
            
            // 5. Post-process: внутренние ссылки
            html = this.processInternalLinks(html, articlePath);
            
            // 6. Post-process: автоматические якоря
            if (this.config.autoAnchors) {
                html = this.generateAnchors(html);
            }
            
            // 7. Post-process: обернуть формулы в блоки
            html = this.wrapFormulaBoxes(html);
            
            // 8. Инициализировать MathJax если есть формулы
            if (html.includes('$') || html.includes('\\(') || html.includes('\\[')) {
                await this.loadMathJax();
            }
            
            return { html, metadata };
            
        } catch (error) {
            console.error('Article parsing error:', error);
            throw error;
        }
    }

    /**
     * Извлекает YAML frontmatter из начала файла
     * @param {string} text - Markdown текст
     * @returns {{content: string, metadata: object}}
     */
    extractFrontmatter(text) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
        const match = text.match(frontmatterRegex);
        
        if (!match) {
            return { content: text, metadata: {} };
        }
        
        const yamlText = match[1];
        const content = text.substring(match[0].length);
        
        try {
            // Простой YAML парсер для метаданных
            const metadata = this.parseSimpleYAML(yamlText);
            return { content, metadata };
        } catch (error) {
            console.warn('Failed to parse frontmatter:', error);
            return { content: text, metadata: {} };
        }
    }

    /**
     * Простой парсер YAML для frontmatter
     * @param {string} yamlText
     * @returns {object}
     */
    parseSimpleYAML(yamlText) {
        const metadata = {};
        const lines = yamlText.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();
            
            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            
            // Parse arrays [item1, item2]
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.substring(1, value.length - 1)
                    .split(',')
                    .map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
            
            // Parse numbers
            if (/^\d+$/.test(value)) {
                value = parseInt(value, 10);
            }
            
            metadata[key] = value;
        }
        
        return metadata;
    }
            
            return html;
        } catch (error) {
            console.error('Article parsing error:', error);
            throw new Error(`Failed to parse article: ${error.message}`);
        }
    }

    /**
     * Предобработка специальных блоков
     */
    preprocessSpecialBlocks(text) {
        // Паттерны для специальных блоков
        const patterns = {
            warning: {
                regex: /^>\s*⚠️\s*\*\*([^:]+):\*\*\s*\n((?:^>.*\n?)+)/gm,
                type: 'warning',
                icon: '⚠️'
            },
            keyIdea: {
                regex: /^>\s*🔑\s*\*\*([^:]+):\*\*\s*\n((?:^>.*\n?)+)/gm,
                type: 'key-idea',
                icon: '🔑'
            },
            note: {
                regex: /^>\s*💡\s*\*\*([^:]+):\*\*\s*\n((?:^>.*\n?)+)/gm,
                type: 'note',
                icon: '💡'
            },
            example: {
                regex: /^>\s*📝\s*\*\*([^:]+):\*\*\s*\n((?:^>.*\n?)+)/gm,
                type: 'example',
                icon: '📝'
            }
        };

        Object.keys(patterns).forEach(key => {
            const pattern = patterns[key];
            text = text.replace(pattern.regex, (match, title, content) => {
                // Убираем префиксы '>' из содержимого
                const cleanContent = content.replace(/^>\s?/gm, '').trim();
                
                return `<div class="article-block ${pattern.type}" data-block="${pattern.type}">
<div class="block-header">
<span class="block-icon">${pattern.icon}</span>
<h4 class="block-title">${title}</h4>
</div>
<div class="block-content">

${cleanContent}

</div>
</div>`;
            });
        });

        return text;
    }

    /**
     * Предобработка ASCII-рамок для формул
     */
    preprocessFormulaBoxes(text) {
        // Паттерн для блоков с рамками (┌─┐└─┘│)
        const boxPattern = /```\s*\n(┌[─┐]+.*?└[─┘]+)\n```/gs;
        
        text = text.replace(boxPattern, (match, boxContent) => {
            return `<div class="formula-box">
<pre class="formula-box-content">${boxContent}</pre>
</div>`;
        });

        // Также обрабатываем рамки без блоков кода
        const simpleBoxPattern = /(┌[─]+┐\n(?:│.*\n)+└[─]+┘)/g;
        text = text.replace(simpleBoxPattern, (match) => {
            return `<div class="formula-box">
<pre class="formula-box-content">${match}</pre>
</div>`;
        });

        return text;
    }

    /**
     * Конвертация markdown в HTML с использованием marked.js
     */
    async convertMarkdownToHtml(markdownText) {
        // Проверяем наличие marked.js
        if (typeof marked === 'undefined') {
            console.warn('marked.js not loaded, using fallback basic parser');
            return this.basicMarkdownToHtml(markdownText);
        }

        // Настройка marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false,
            sanitize: false
        });

        // Кастомный рендерер для заголовков с ID
        const renderer = new marked.Renderer();
        const originalHeading = renderer.heading;
        
        renderer.heading = (text, level, raw) => {
            const id = this.generateHeadingId(raw);
            return `<h${level} id="${id}">${text}</h${level}>\n`;
        };

        // Кастомный рендерер для кода (сохранение формул)
        renderer.code = (code, language) => {
            if (!language) {
                // ASCII-диаграммы без подсветки
                return `<pre class="ascii-diagram"><code>${this.escapeHtml(code)}</code></pre>`;
            }
            return `<pre><code class="language-${language}">${this.escapeHtml(code)}</code></pre>`;
        };

        marked.use({ renderer });

        return marked.parse(markdownText);
    }

    /**
     * Базовый парсер markdown (fallback)
     */
    basicMarkdownToHtml(text) {
        // Заголовки
        text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Жирный и курсив
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // Код
        text = text.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Параграфы
        text = text.replace(/\n\n/g, '</p><p>');
        text = '<p>' + text + '</p>';
        
        return text;
    }

    /**
     * Генерация уникального ID для заголовка
     */
    generateHeadingId(text) {
        // Удаляем HTML теги и markdown синтаксис
        let id = text
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/`/g, '');
        
        // Транслитерация и очистка
        id = id
            .toLowerCase()
            .replace(/[^а-яa-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Ensure uniqueness
        let uniqueId = id;
        let counter = 1;
        while (this.headingIds.has(uniqueId)) {
            uniqueId = `${id}-${counter}`;
            counter++;
        }
        
        this.headingIds.add(uniqueId);
        return uniqueId;
    }

    /**
     * Обработка изображений
     */
    processImages(html, articlePath) {
        const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
        
        return html.replace(imgRegex, (match, before, src, after) => {
            let newSrc = src;
            
            // Если путь относительный (начинается с ./)
            if (src.startsWith('./')) {
                const cleanPath = src.substring(2); // Убираем ./
                const articleId = articlePath.split('/').pop();
                newSrc = `${this.config.basePath}/${articleId}/${cleanPath}`;
            }
            // Если путь не начинается с http:// или https://
            else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
                const articleId = articlePath.split('/').pop();
                newSrc = `${this.config.basePath}/${articleId}/images/${src}`;
            }
            
            return `<img${before}src="${newSrc}"${after} loading="lazy">`;
        });
    }

    /**
     * Обработка внутренних ссылок
     */
    processInternalLinks(html, articlePath) {
        const linkRegex = /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
        
        return html.replace(linkRegex, (match, before, href, after) => {
            let newHref = href;
            let attributes = before + after;
            
            // Якоря (начинаются с #)
            if (href.startsWith('#')) {
                // Оставляем как есть
                return match;
            }
            // Ссылки на другие статьи (.md файлы)
            else if (href.endsWith('.md') || href.includes('.md#')) {
                const [file, anchor] = href.split('#');
                const articleId = file.replace('.md', '').toLowerCase();
                newHref = `/article/${articleId}`;
                if (anchor) {
                    newHref += `#${anchor}`;
                }
                // Добавляем data-link для SPA навигации
                if (!attributes.includes('data-link')) {
                    attributes += ' data-link';
                }
            }
            // Внешние ссылки
            else if (href.startsWith('http://') || href.startsWith('https://')) {
                // Добавляем target="_blank" для внешних ссылок
                if (!attributes.includes('target=')) {
                    attributes += ' target="_blank" rel="noopener noreferrer"';
                }
            }
            
            return `<a${attributes}href="${newHref}">`;
        });
    }

    /**
     * Генерация якорей для заголовков
     */
    generateAnchors(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach((heading, index) => {
            if (!heading.id) {
                const text = heading.textContent;
                heading.id = this.generateHeadingId(text);
            }
        });
        
        return doc.body.innerHTML;
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
     * Инициализация MathJax
     */
    static initMathJax() {
        if (typeof window === 'undefined') return;

        window.MathJax = {
            tex: {
                inlineMath: [['$', '$']],
                displayMath: [['$$', '$$']],
                processEscapes: true,
                processEnvironments: true,
                packages: {
                    '[+]': ['ams', 'noerrors', 'noundefined', 'boldsymbol']
                }
            },
            svg: {
                fontCache: 'global',
                displayAlign: 'center'
            },
            startup: {
                pageReady: () => {
                    return MathJax.startup.defaultPageReady();
                }
            }
        };

        // Загрузка MathJax с CDN
        if (!document.querySelector('script[src*="mathjax"]')) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }

    /**
     * Рендеринг математики в элементе
     */
    static async renderMath(element) {
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            try {
                await MathJax.typesetPromise([element]);
            } catch (error) {
                console.error('MathJax rendering error:', error);
            }
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArticleParser;
}
