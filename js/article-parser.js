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
            
            // 2. Pre-process: формулы в блоках кода (преобразование в MathJax)
            processed = this.preprocessCodeBlockFormulas(processed);
            
            // 3. Pre-process: рамки для формул
            processed = this.preprocessFormulaBoxes(processed);
            
            // 4. Parse markdown to HTML
            let html = await this.convertMarkdownToHtml(processed);
            
            // 5. Post-process: изображения
            html = this.processImages(html, articlePath);
            
            // 6. Post-process: внутренние ссылки
            html = this.processInternalLinks(html, articlePath);
            
            // 7. Post-process: автоматические якоря
            if (this.config.autoAnchors) {
                html = this.generateAnchors(html);
            }
            
            // 8. Post-process: обернуть формулы в блоки
            html = this.wrapFormulaBoxes(html);
            
            // 9. Post-process: восстановить экранированные формулы
            html = this.restoreEscapedFormulas(html);
            
            // 10. Инициализировать MathJax если есть формулы
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
     * Предобработка формул в блоках кода (преобразование в MathJax)
     */
    preprocessCodeBlockFormulas(text) {
        // Паттерн для блоков кода без языка
        const codeBlockPattern = /```\s*\n([\s\S]*?)\n```/g;
        
        text = text.replace(codeBlockPattern, (match, codeContent) => {
            const trimmed = codeContent.trim();
            
            // Проверяем, является ли содержимое математической формулой
            // Признаки формулы:
            // - Содержит математические операторы: =, ≈, ×, /, +, -, →, ≤, ≥, ≠, ≡
            // - Содержит переменные с индексами: R₀, H₀, Ω_tot, Ṙ, ẋ
            // - Содержит математические функции: √, sin, cos, log, exp, ln
            // - Содержит степени: ², ³, ²⁶, ²⁷
            // - Содержит греческие буквы или специальные символы
            // - Содержит числовые выражения с научной нотацией: ×10²⁶, e-10
            const mathPattern = /[=≈×/+\-→≤≥≠≡√²³⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉αβγδϵθλμπρσφχωΩΔΛΣ]/;
            const hasMathSymbols = mathPattern.test(trimmed);
            
            // Проверяем наличие переменных с индексами или математических выражений
            // Расширенный паттерн для лучшего определения формул
            const hasMathVars = /[RHOΩ]_?[₀₁₂₃₄₅₆₇₈₉0-9]|Ṙ|ẋ|d[RHO]\s*\/\s*dt|sin|cos|log|exp|ln|√|×\s*10[²³⁰¹²³⁴⁵⁶⁷⁸⁹]|e[+\-]\d+/.test(trimmed);
            
            // Дополнительная проверка: содержит ли выражение математическую структуру
            // (переменные, числа, операторы в правильном порядке)
            const hasMathStructure = /[A-Za-z]+\s*[=≈≤≥≠]\s*[A-Za-z0-9]/.test(trimmed) || 
                                     /[A-Za-z]+\s*[+\-×/]\s*[A-Za-z0-9]/.test(trimmed) ||
                                     /\d+\s*[+\-×/]\s*\d+/.test(trimmed);
            
            // Проверяем, что это не ASCII-диаграмма (рамки)
            const isAsciiDiagram = /┌[─┐]|│|└[─┘]/.test(trimmed);
            
            // Если это формула, преобразуем в MathJax
            // Условия: содержит математические символы/переменные ИЛИ имеет математическую структуру,
            // НЕ является ASCII-диаграммой, и не слишком длинное (не код)
            const isFormula = (hasMathSymbols || hasMathVars || hasMathStructure) && 
                             !isAsciiDiagram && 
                             trimmed.length < 500 &&
                             trimmed.length > 2; // Минимум 3 символа
                             
            if (isFormula) {
                // Логирование только в режиме разработки (можно отключить)
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.log('Converting code block to MathJax:', trimmed.substring(0, 50));
                }
                // Заменяем специальные символы на LaTeX эквиваленты
                let latexFormula = trimmed
                    // Индексы (перед другими заменами, чтобы не конфликтовать)
                    .replace(/₀/g, '_0')
                    .replace(/₁/g, '_1')
                    .replace(/₂/g, '_2')
                    .replace(/₃/g, '_3')
                    .replace(/₄/g, '_4')
                    .replace(/₅/g, '_5')
                    .replace(/₆/g, '_6')
                    .replace(/₇/g, '_7')
                    .replace(/₈/g, '_8')
                    .replace(/₉/g, '_9')
                    // Степени (обрабатываем сложные степени перед простыми)
                    .replace(/²⁶/g, '^{26}')
                    .replace(/²⁷/g, '^{27}')
                    .replace(/²⁸/g, '^{28}')
                    .replace(/²⁹/g, '^{29}')
                    .replace(/³⁰/g, '^{30}')
                    .replace(/²/g, '^2')
                    .replace(/³/g, '^3')
                    // Греческие буквы (перед другими заменами)
                    .replace(/Ω/g, '\\Omega')
                    .replace(/α/g, '\\alpha')
                    .replace(/β/g, '\\beta')
                    .replace(/γ/g, '\\gamma')
                    .replace(/δ/g, '\\delta')
                    .replace(/ϵ/g, '\\epsilon')
                    .replace(/ε/g, '\\varepsilon')
                    .replace(/θ/g, '\\theta')
                    .replace(/λ/g, '\\lambda')
                    .replace(/μ/g, '\\mu')
                    .replace(/π/g, '\\pi')
                    .replace(/ρ/g, '\\rho')
                    .replace(/σ/g, '\\sigma')
                    .replace(/φ/g, '\\phi')
                    .replace(/χ/g, '\\chi')
                    .replace(/ω/g, '\\omega')
                    .replace(/Δ/g, '\\Delta')
                    .replace(/Λ/g, '\\Lambda')
                    .replace(/Σ/g, '\\Sigma')
                    // Производные и точки
                    .replace(/Ṙ/g, '\\dot{R}')
                    .replace(/ẋ/g, '\\dot{x}')
                    // Специальные символы
                    .replace(/×/g, '\\times')
                    .replace(/≈/g, '\\approx')
                    .replace(/→/g, '\\to')
                    .replace(/≤/g, '\\leq')
                    .replace(/≥/g, '\\geq')
                    .replace(/≠/g, '\\neq')
                    .replace(/∞/g, '\\infty')
                    // Корни (обрабатываем после замены греческих букв)
                    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}') // √(x) -> \sqrt{x}
                    .replace(/√([A-Za-z0-9_]+)/g, '\\sqrt{$1}') // √x -> \sqrt{x}
                    // Дроби вида a/b -> \frac{a}{b} (простые случаи, после обработки индексов)
                    // Обрабатываем сложные дроби с скобками
                    .replace(/([A-Za-z0-9_()]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}') // a/(b) -> \frac{a}{b}
                    .replace(/([A-Za-z0-9_()]+)\s*\/\s*([A-Za-z0-9_()]+)/g, (match, num, den) => {
                        // Не заменяем, если это уже LaTeX или очень простая конструкция
                        if (match.includes('\\')) return match;
                        return `\\frac{${num}}{${den}}`;
                    })
                    // Единицы измерения в тексте (в конце, чтобы не мешать формулам)
                    .replace(/\s+([кмГпксв\.летм]+)\s*/g, '\\text{ $1} ')
                    // Многострочные формулы
                    .replace(/\n/g, '\\\\');
                
                // Если формула содержит несколько строк, используем выравнивание
                let result;
                if (trimmed.includes('\n')) {
                    result = `$$\\begin{aligned}${latexFormula}\\end{aligned}$$`;
                } else {
                    result = `$$${latexFormula}$$`;
                }
                
                // Логирование только в режиме разработки
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.log('✓ Converted formula:', trimmed.substring(0, 60), '->', result.substring(0, 80));
                }
                return result;
            }
            
            // Если это не формула, оставляем как блок кода
            return match;
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
     * Post-process: обернуть формулы в блоки (если нужно дополнительное форматирование)
     * @param {string} html - HTML после парсинга markdown
     * @returns {string} - HTML с обработанными формулами
     */
    wrapFormulaBoxes(html) {
        // Если формулы уже обработаны в preprocessFormulaBoxes, просто возвращаем HTML
        // Этот метод может быть расширен для дополнительной обработки формул в HTML
        return html;
    }
    
    /**
     * Восстановление экранированных формул (после парсинга markdown)
     * @param {string} html - HTML после парсинга
     * @returns {string} - HTML с восстановленными формулами
     */
    restoreEscapedFormulas(html) {
        // Восстанавливаем экранированные символы $ в формулах
        // marked.js может экранировать $ как &#36; или &amp;#36;
        html = html.replace(/&amp;#36;/g, '$');
        html = html.replace(/&#36;/g, '$');
        
        // Восстанавливаем экранированные обратные слеши
        html = html.replace(/&amp;#92;/g, '\\');
        html = html.replace(/&#92;/g, '\\');
        
        // Восстанавливаем экранированные фигурные скобки в формулах
        html = html.replace(/&amp;#123;/g, '{');
        html = html.replace(/&#123;/g, '{');
        html = html.replace(/&amp;#125;/g, '}');
        html = html.replace(/&#125;/g, '}');
        
        return html;
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
     * Загрузка и инициализация MathJax
     * @returns {Promise<void>}
     */
    async loadMathJax() {
        // Если MathJax уже загружен, просто ждем его готовности
        if (typeof MathJax !== 'undefined' && MathJax.startup) {
            return;
        }

        // Инициализируем конфигурацию и загружаем скрипт
        ArticleParser.initMathJax();

        // Ждем загрузки MathJax
        return new Promise((resolve, reject) => {
            // Если MathJax уже загружен
            if (typeof MathJax !== 'undefined' && MathJax.startup) {
                resolve();
                return;
            }

            // Проверяем наличие скрипта
            const script = document.querySelector('script[src*="mathjax"]');
            if (!script) {
                console.warn('MathJax script not found');
                resolve(); // Не блокируем парсинг, если MathJax не загрузился
                return;
            }

            // Если скрипт уже загружен
            if (script.dataset.loaded === 'true') {
                resolve();
                return;
            }

            // Ждем загрузки скрипта
            script.onload = () => {
                script.dataset.loaded = 'true';
                // Дополнительно ждем инициализации MathJax
                const checkMathJax = setInterval(() => {
                    if (typeof MathJax !== 'undefined' && MathJax.startup) {
                        clearInterval(checkMathJax);
                        resolve();
                    }
                }, 50);

                // Таймаут на случай, если MathJax не загрузится
                setTimeout(() => {
                    clearInterval(checkMathJax);
                    if (typeof MathJax === 'undefined') {
                        console.warn('MathJax failed to load');
                    }
                    resolve(); // Не блокируем парсинг
                }, 5000);
            };

            script.onerror = () => {
                console.error('Failed to load MathJax script');
                resolve(); // Не блокируем парсинг
            };
        });
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
