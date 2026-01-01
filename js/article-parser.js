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
            
            // 1. Pre-process: защитить формулы от обработки marked.js
            const { protectedText, formulas } = this.protectFormulas(content);
            
            // 2. Pre-process: специальные блоки
            let processed = this.preprocessSpecialBlocks(protectedText);
            
            // 3. Pre-process: формулы в блоках кода (преобразование в MathJax)
            processed = this.preprocessCodeBlockFormulas(processed);
            
            // 4. Pre-process: рамки для формул
            processed = this.preprocessFormulaBoxes(processed);
            
            // 5. Parse markdown to HTML
            let html = await this.convertMarkdownToHtml(processed);
            
            // 6. Восстановить защищенные формулы
            html = this.restoreProtectedFormulas(html, formulas);
            
            // Проверяем, есть ли проблемы с конкретной формулой
            const problemFormula = '\\text{div}(g) = 2 \\times \\left(\\frac{\\dot{V}}{V}\\right)';
            const hasProblemFormula = formulas.some(f => f.formula.includes('\\text{div}(g) = 2'));
            if (hasProblemFormula) {
                console.warn('⚠ Found problem formula with \\text{div}(g) = 2');
                const formulaIndex = formulas.findIndex(f => f.formula.includes('\\text{div}(g) = 2'));
                if (formulaIndex >= 0) {
                    console.log('Formula index:', formulaIndex);
                    console.log('Formula:', formulas[formulaIndex].formula);
                    console.log('Formula type:', formulas[formulaIndex].type);
                    // Проверяем, есть ли плейсхолдер в HTML
                    const placeholder = `\u200B\u200B\u200BMATH_INLINE_${formulaIndex}_MATH\u200B\u200B\u200B`;
                    const found = html.includes(placeholder);
                    console.log('Placeholder found in HTML:', found);
                    if (!found) {
                        // Пробуем найти части плейсхолдера
                        const parts = [
                            `MATH_INLINE_${formulaIndex}`,
                            `MATH_INLINE_${formulaIndex}_MATH`,
                        ];
                        parts.forEach(part => {
                            if (html.includes(part)) {
                                console.log('Found partial placeholder:', part);
                                const index = html.indexOf(part);
                                const context = html.substring(Math.max(0, index - 50), Math.min(html.length, index + 100));
                                console.log('Context:', context);
                            }
                        });
                    }
                }
            }
            
            // Отладочная информация
            if (window.DEBUG_ARTICLE_PARSER) {
                // Проверяем все форматы плейсхолдеров
                const remaining = html.match(/\u200B\u200B\u200BMATH_(BLOCK|INLINE)_\d+_MATH\u200B\u200B\u200B|<!--MATH_(BLOCK|INLINE)_\d+-->|__MATH_(BLOCK|INLINE)_\d+__/g);
                if (remaining && remaining.length > 0) {
                    console.warn(`After restoreProtectedFormulas: ${remaining.length} placeholders still remain`);
                    // Показываем первые несколько примеров
                    console.warn('Sample remaining placeholders:', remaining.slice(0, 5));
                    // Показываем контекст вокруг первого плейсхолдера
                    const firstIndex = html.indexOf(remaining[0]);
                    if (firstIndex > 0) {
                        const context = html.substring(Math.max(0, firstIndex - 50), firstIndex + remaining[0].length + 50);
                        console.warn('Context around first placeholder:', context);
                    }
                }
            }
            
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
     * Защищает формулы от обработки marked.js
     * @param {string} text - Markdown текст
     * @returns {{protectedText: string, formulas: Array}} - Защищенный текст и массив формул
     */
    protectFormulas(text) {
        const formulas = [];
        let formulaIndex = 0;
        
        // Используем уникальные маркеры с zero-width spaces, которые точно не будут обработаны marked.js
        // Zero-width spaces (\u200B) невидимы и сохраняются в HTML
        const createPlaceholder = (type, index) => {
            // Используем формат с zero-width spaces, который не будет обработан marked.js
            return `\u200B\u200B\u200BMATH_${type}_${index}_MATH\u200B\u200B\u200B`;
        };
        
        // Защищаем block формулы $$...$$
        let protectedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const trimmedFormula = formula.trim();
            const placeholder = createPlaceholder('BLOCK', formulaIndex);
            formulas.push({ type: 'block', formula: trimmedFormula });
            
            // Специальная проверка для формул с \begin{aligned} и \text{}
            if (trimmedFormula.includes('\\begin{aligned}') || trimmedFormula.includes('\\text{')) {
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.log(`Protected block formula ${formulaIndex} (with \\begin{aligned} or \\text{}):`, trimmedFormula.substring(0, 150));
                }
            } else if (window.DEBUG_ARTICLE_PARSER) {
                console.log(`Protected block formula ${formulaIndex}:`, trimmedFormula.substring(0, 100));
            }
            
            formulaIndex++;
            return placeholder;
        });
        
        // Защищаем inline формулы $...$ (но не $$)
        // Используем нежадное совпадение, но проверяем, что это не часть $$...$$
        // Важно: обрабатываем формулы до обработки block формул, чтобы не перехватить их
        protectedText = protectedText.replace(/\$([^$\n]+?)\$/g, (match, formula, offset, string) => {
            // Проверяем, что это не часть $$...$$
            const before = string.substring(Math.max(0, offset - 1), offset);
            const after = string.substring(offset + match.length, offset + match.length + 1);
            
            // Если перед или после есть $, это часть block формулы, пропускаем
            if (before === '$' || after === '$') {
                return match;
            }
            
            // Проверяем, что формула не пустая и содержит хотя бы один символ
            const trimmedFormula = formula.trim();
            if (!trimmedFormula) {
                return match;
            }
            
            // Проверяем, что это действительно inline формула (не начинается/заканчивается на $)
            // и не содержит переносов строк (inline формулы должны быть в одной строке)
            if (trimmedFormula.includes('\n')) {
                // Если содержит перенос строки, это может быть ошибка разметки
                // Но мы все равно обработаем её как inline, если она между одиночными $
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.warn(`Inline formula ${formulaIndex} contains newline, may be incorrectly formatted:`, trimmedFormula.substring(0, 100));
                }
            }
            
            const placeholder = createPlaceholder('INLINE', formulaIndex);
            formulas.push({ type: 'inline', formula: trimmedFormula });
            
            // Специальная проверка для формул с \text{} и \left(\right)
            if (trimmedFormula.includes('\\text{') || trimmedFormula.includes('\\left(')) {
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.log(`Protected inline formula ${formulaIndex} (with \\text{} or \\left()):`, trimmedFormula);
                }
            } else if (window.DEBUG_ARTICLE_PARSER) {
                console.log(`Protected inline formula ${formulaIndex}:`, trimmedFormula.substring(0, 100));
            }
            
            formulaIndex++;
            return placeholder;
        });
        
        return { protectedText, formulas };
    }
    
    /**
     * Восстанавливает защищенные формулы после парсинга
     * @param {string} html - HTML после парсинга
     * @param {Array} formulas - Массив формул
     * @returns {string} - HTML с восстановленными формулами
     */
    restoreProtectedFormulas(html, formulas) {
        if (!formulas || formulas.length === 0) {
            return html;
        }
        
        if (window.DEBUG_ARTICLE_PARSER) {
            console.log(`Restoring ${formulas.length} protected formulas`);
        }
        
        // Сначала пробуем найти все плейсхолдеры в HTML (включая обернутые в теги)
        const findAllPlaceholders = (text) => {
            const found = [];
            // Ищем плейсхолдеры в разных форматах (новый формат с zero-width spaces и старые)
            const patterns = [
                /\u200B\u200B\u200BMATH_(BLOCK|INLINE)_(\d+)_MATH\u200B\u200B\u200B/g,
                /<!--MATH_(BLOCK|INLINE)_(\d+)-->/g,
                /&lt;!--MATH_(BLOCK|INLINE)_(\d+)--&gt;/g,
                /&amp;lt;!--MATH_(BLOCK|INLINE)_(\d+)--&amp;gt;/g,
                /__MATH_(BLOCK|INLINE)_(\d+)__/g,
                /&#95;&#95;MATH_(BLOCK|INLINE)_(\d+)&#95;&#95;/g,
            ];
            
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    found.push({
                        type: match[1],
                        index: parseInt(match[2]),
                        fullMatch: match[0]
                    });
                }
            });
            
            return found;
        };
        
        // Находим все плейсхолдеры в HTML
        const foundPlaceholders = findAllPlaceholders(html);
        
        if (window.DEBUG_ARTICLE_PARSER) {
            console.log(`Found ${foundPlaceholders.length} placeholders in HTML`);
        }
        
        formulas.forEach((formulaObj, index) => {
            // Используем новый формат плейсхолдера (zero-width spaces)
            const blockPlaceholder = `\u200B\u200B\u200BMATH_BLOCK_${index}_MATH\u200B\u200B\u200B`;
            const inlinePlaceholder = `\u200B\u200B\u200BMATH_INLINE_${index}_MATH\u200B\u200B\u200B`;
            
            // Также поддерживаем старые форматы для обратной совместимости
            const oldBlockPlaceholder = `<!--MATH_BLOCK_${index}-->`;
            const oldInlinePlaceholder = `<!--MATH_INLINE_${index}-->`;
            
            if (formulaObj.type === 'block') {
                const replacement = `$$${formulaObj.formula}$$`;
                
                // Специальная проверка для формул с \begin{aligned} и \text{}
                const hasAlignedOrText = formulaObj.formula.includes('\\begin{aligned}') || formulaObj.formula.includes('\\text{');
                if (hasAlignedOrText || window.DEBUG_ARTICLE_PARSER) {
                    console.log(`Restoring block formula ${index}:`, formulaObj.formula);
                }
                
                // Пробуем все возможные варианты плейсхолдера
                const variants = [
                    blockPlaceholder,
                    oldBlockPlaceholder,
                    oldBlockPlaceholder.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;'),
                    oldBlockPlaceholder.replace(/<!--/g, '&amp;lt;!--').replace(/-->/g, '--&amp;gt;'),
                ];
                
                let replaced = false;
                variants.forEach(variant => {
                    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escaped, 'gi');
                    if (regex.test(html)) {
                        html = html.replace(regex, replacement);
                        replaced = true;
                        if (window.DEBUG_ARTICLE_PARSER) {
                            console.log(`✓ Block formula ${index} restored using variant:`, variant.substring(0, 50));
                        }
                    }
                });
                
                if (!replaced && window.DEBUG_ARTICLE_PARSER) {
                    console.warn(`⚠ Block formula ${index} not found in HTML:`, formulaObj.formula.substring(0, 100));
                }
            } else {
                const replacement = `$${formulaObj.formula}$`;
                
                // Специальная проверка для формул с \text{} и \left(\right)
                const hasTextOrLeft = formulaObj.formula.includes('\\text{') || formulaObj.formula.includes('\\left(');
                if (hasTextOrLeft || window.DEBUG_ARTICLE_PARSER) {
                    console.log(`Restoring inline formula ${index}:`, formulaObj.formula);
                }
                
                // Пробуем все возможные варианты плейсхолдера
                // Важно: сначала пробуем новый формат с zero-width spaces, затем старые форматы
                const variants = [
                    inlinePlaceholder,  // Новый формат: \u200B\u200B\u200BMATH_INLINE_X_MATH\u200B\u200B\u200B
                    oldInlinePlaceholder,  // Старый формат: <!--MATH_INLINE_X-->
                    oldInlinePlaceholder.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;'),  // Экранированный HTML
                    oldInlinePlaceholder.replace(/<!--/g, '&amp;lt;!--').replace(/-->/g, '--&amp;gt;'),  // Двойное экранирование
                ];
                
                let replaced = false;
                variants.forEach((variant, variantIndex) => {
                    // Экранируем специальные символы для regex
                    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escaped, 'gi');
                    
                    // Проверяем, есть ли плейсхолдер в HTML
                    if (regex.test(html)) {
                        // Заменяем все вхождения
                        html = html.replace(regex, replacement);
                        replaced = true;
                        if (window.DEBUG_ARTICLE_PARSER) {
                            console.log(`✓ Inline formula ${index} restored using variant ${variantIndex}:`, variant.substring(0, 50));
                        }
                    }
                });
                
                if (!replaced) {
                    // Если не удалось восстановить, пробуем найти плейсхолдер в разных форматах
                    // Возможно, marked.js разбил плейсхолдер на части или обработал его
                    const searchPatterns = [
                        inlinePlaceholder.substring(0, 15), // Первая часть плейсхолдера
                        inlinePlaceholder.substring(inlinePlaceholder.length - 15), // Последняя часть
                        `MATH_INLINE_${index}`, // Без zero-width spaces
                        `MATH_INLINE_${index}_MATH`, // Средняя часть
                    ];
                    
                    let foundPartial = false;
                    searchPatterns.forEach(pattern => {
                        if (html.includes(pattern)) {
                            foundPartial = true;
                            if (window.DEBUG_ARTICLE_PARSER) {
                                console.warn(`⚠ Inline formula ${index} placeholder may be split. Found partial:`, pattern);
                            }
                        }
                    });
                    
                    if (!foundPartial) {
                        // Пробуем найти формулу напрямую в HTML (возможно, она не была защищена)
                        // Ищем формулу в разных форматах (с экранированием и без)
                        const formulaVariants = [
                            formulaObj.formula,
                            formulaObj.formula.replace(/\\/g, '\\\\'), // Экранированные обратные слеши
                            formulaObj.formula.replace(/\\text\{/g, '\\text{').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;'), // HTML entities
                        ];
                        
                        let foundFormula = false;
                        formulaVariants.forEach((variant, variantIndex) => {
                            if (html.includes(variant)) {
                                foundFormula = true;
                                // Заменяем найденную формулу на правильный формат MathJax
                                const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(escaped, 'gi');
                                html = html.replace(regex, replacement);
                                console.log(`✓ Inline formula ${index} restored from direct HTML match (variant ${variantIndex}):`, variant.substring(0, 100));
                            }
                        });
                        
                        if (!foundFormula) {
                            // Пробуем найти части формулы (возможно, она разбита)
                            const formulaParts = [
                                '\\text{div}(g) = 2',
                                '\\times',
                                '\\left(\\frac{\\dot{V}}{V}\\right)',
                            ];
                            
                            let foundParts = 0;
                            formulaParts.forEach(part => {
                                if (html.includes(part)) {
                                    foundParts++;
                                }
                            });
                            
                            if (foundParts > 0) {
                                console.warn(`⚠ Inline formula ${index} may be split. Found ${foundParts}/${formulaParts.length} parts`);
                            } else if (window.DEBUG_ARTICLE_PARSER) {
                                console.warn(`⚠ Inline formula ${index} not found in HTML:`, formulaObj.formula.substring(0, 100));
                                // Показываем контекст вокруг ожидаемого плейсхолдера
                                const searchText = `MATH_INLINE_${index}`;
                                const indexInHtml = html.indexOf(searchText);
                                if (indexInHtml > 0) {
                                    const context = html.substring(Math.max(0, indexInHtml - 50), Math.min(html.length, indexInHtml + 100));
                                    console.log('Context around expected placeholder:', context);
                                }
                            }
                        }
                    }
                }
            }
        });
        
        // Проверяем, что все формулы восстановлены
        // Проверяем разные варианты плейсхолдеров (новый формат с zero-width spaces и старые форматы)
        const remainingPlaceholders = html.match(/\u200B\u200B\u200BMATH_(BLOCK|INLINE)_\d+_MATH\u200B\u200B\u200B|<!--MATH_(BLOCK|INLINE)_\d+-->|__MATH_(BLOCK|INLINE)_\d+__/g);
        
        if (remainingPlaceholders && remainingPlaceholders.length > 0) {
            console.warn('Some formulas were not restored:', remainingPlaceholders);
            // Попытка восстановить оставшиеся формулы вручную
            // Особое внимание к формулам с \text{} и \left(\right)
            formulas.forEach((formulaObj, index) => {
                // Проверяем, есть ли эта формула в списке невосстановленных
                const placeholderPattern = new RegExp(`MATH_${formulaObj.type === 'block' ? 'BLOCK' : 'INLINE'}_${index}`, 'g');
                const isUnrestored = html.match(placeholderPattern);
                
                if (isUnrestored) {
                    console.warn(`Attempting manual restoration of formula ${index}:`, formulaObj.formula.substring(0, 100));
                    
                    // Пробуем все возможные варианты плейсхолдеров
                    const allPlaceholders = [
                        `\u200B\u200B\u200BMATH_${formulaObj.type === 'block' ? 'BLOCK' : 'INLINE'}_${index}_MATH\u200B\u200B\u200B`,
                        `<!--MATH_${formulaObj.type === 'block' ? 'BLOCK' : 'INLINE'}_${index}-->`,
                        `__MATH_${formulaObj.type === 'block' ? 'BLOCK' : 'INLINE'}_${index}__`,
                    ];
                    
                    const replacement = formulaObj.type === 'block' 
                        ? `$$${formulaObj.formula}$$` 
                        : `$${formulaObj.formula}$`;
                    
                    allPlaceholders.forEach(placeholder => {
                        // Пробуем найти плейсхолдер в разных форматах
                        const variants = [
                            placeholder,
                            placeholder.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;'),
                            placeholder.replace(/<!--/g, '&amp;lt;!--').replace(/-->/g, '--&amp;gt;'),
                            // Пробуем найти части плейсхолдера
                            placeholder.replace(/\u200B/g, ''),
                            placeholder.replace(/<!--/g, '').replace(/-->/g, ''),
                        ];
                        
                        variants.forEach(variant => {
                            if (html.includes(variant)) {
                                const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(escaped, 'gi');
                                html = html.replace(regex, replacement);
                                console.log(`✓ Manually restored formula ${index} using variant:`, variant.substring(0, 50));
                            }
                        });
                    });
                }
            });
            
            // Повторная попытка восстановления для всех формул
            formulas.forEach((formulaObj, index) => {
                // Поддерживаем оба формата для обратной совместимости
                const blockPlaceholder = `<!--MATH_BLOCK_${index}-->`;
                const inlinePlaceholder = `<!--MATH_INLINE_${index}-->`;
                const oldBlockPlaceholder = `__MATH_BLOCK_${index}__`;
                const oldInlinePlaceholder = `__MATH_INLINE_${index}__`;
                
                if (formulaObj.type === 'block') {
                    // Пробуем все возможные варианты экранирования и обертки в теги
                    const variants = [
                        blockPlaceholder,
                        blockPlaceholder.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;'),
                        oldBlockPlaceholder,
                        oldBlockPlaceholder.replace(/_/g, '&#95;'),
                        oldBlockPlaceholder.replace(/_/g, '&amp;#95;'),
                        `<p>${oldBlockPlaceholder}</p>`,
                        `<code>${oldBlockPlaceholder}</code>`,
                    ];
                    
                    variants.forEach(variant => {
                        // Проверяем, есть ли вариант в HTML (с учетом экранирования)
                        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedVariant, 'gi');
                        if (regex.test(html)) {
                            html = html.replace(regex, `$$${formulaObj.formula}$$`);
                        }
                    });
                } else {
                    // Для inline формул пробуем все возможные варианты, включая новый формат с zero-width spaces
                    const newInlinePlaceholder = `\u200B\u200B\u200BMATH_INLINE_${index}_MATH\u200B\u200B\u200B`;
                    const variants = [
                        newInlinePlaceholder,  // Новый формат с zero-width spaces
                        inlinePlaceholder,
                        inlinePlaceholder.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;'),
                        oldInlinePlaceholder,
                        oldInlinePlaceholder.replace(/_/g, '&#95;'),
                        oldInlinePlaceholder.replace(/_/g, '&amp;#95;'),
                        `<code>${oldInlinePlaceholder}</code>`,
                        // Пробуем найти части плейсхолдера
                        `MATH_INLINE_${index}`,
                        `MATH_INLINE_${index}_MATH`,
                    ];
                    
                    variants.forEach(variant => {
                        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedVariant, 'gi');
                        if (regex.test(html)) {
                            html = html.replace(regex, `$${formulaObj.formula}$`);
                            console.log(`✓ Final restoration: inline formula ${index} restored using:`, variant.substring(0, 50));
                        }
                    });
                }
            });
            
            // Финальная проверка - если остались плейсхолдеры, пробуем восстановить их все сразу
            const stillRemaining = html.match(/\u200B\u200B\u200BMATH_(BLOCK|INLINE)_\d+_MATH\u200B\u200B\u200B|<!--MATH_(BLOCK|INLINE)_\d+-->|__MATH_(BLOCK|INLINE)_\d+__/g);
            if (stillRemaining && stillRemaining.length > 0) {
                console.error('Failed to restore formulas:', stillRemaining);
                // Последняя попытка - заменяем все оставшиеся плейсхолдеры напрямую
                stillRemaining.forEach(placeholder => {
                    // Пробуем все форматы
                    let match = placeholder.match(/\u200B\u200B\u200BMATH_(BLOCK|INLINE)_(\d+)_MATH\u200B\u200B\u200B/);
                    if (!match) {
                        match = placeholder.match(/<!--MATH_(BLOCK|INLINE)_(\d+)-->/);
                    }
                    if (!match) {
                        match = placeholder.match(/__MATH_(BLOCK|INLINE)_(\d+)__/);
                    }
                    if (match) {
                        const type = match[1];
                        const index = parseInt(match[2]);
                        if (formulas[index]) {
                            const formulaObj = formulas[index];
                            if (formulaObj.type === 'block' && type === 'BLOCK') {
                                html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `$$${formulaObj.formula}$$`);
                            } else if (formulaObj.type === 'inline' && type === 'INLINE') {
                                html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `$${formulaObj.formula}$`);
                            }
                        }
                    }
                });
            }
        }
        
        return html;
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
                    .replace(/η/g, '\\eta') // эта
                    // Производные и точки
                    .replace(/Ṙ/g, '\\dot{R}')
                    .replace(/ẋ/g, '\\dot{x}')
                    // Математические функции (обрабатываем перед другими заменами)
                    .replace(/\bcos\b/g, '\\cos')
                    .replace(/\bsin\b/g, '\\sin')
                    .replace(/\btan\b/g, '\\tan')
                    .replace(/\bexp\b/g, '\\exp')
                    .replace(/\bln\b/g, '\\ln')
                    .replace(/\blog\b/g, '\\log')
                    // Специальные символы
                    .replace(/×/g, '\\times')
                    .replace(/≈/g, '\\approx')
                    .replace(/∼/g, '\\sim') // тильда (пропорционально)
                    .replace(/→/g, '\\to')
                    .replace(/≤/g, '\\leq')
                    .replace(/≥/g, '\\geq')
                    .replace(/≠/g, '\\neq')
                    .replace(/≫/g, '\\gg') // много больше
                    .replace(/≪/g, '\\ll') // много меньше
                    .replace(/∞/g, '\\infty')
                    // Корни (обрабатываем после замены греческих букв)
                    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}') // √(x) -> \sqrt{x}
                    .replace(/√([A-Za-z0-9_]+)/g, '\\sqrt{$1}') // √x -> \sqrt{x}
                    // Дроби: сначала обрабатываем дроби в скобках с последующими степенями
                    // (a/b)³ -> \left(\frac{a}{b}\right)^3
                    // Важно: обрабатываем ДО замены простых дробей, чтобы не конфликтовать
                    // Обрабатываем степени после скобок: (a/b)² -> \left(\frac{a}{b}\right)^2
                    .replace(/\(([^()]+)\/([^()]+)\)\^?([²³⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)/g, (match, num, den, pow) => {
                        const power = pow.replace(/²/g, '2').replace(/³/g, '3')
                                         .replace(/⁰/g, '0').replace(/¹/g, '1')
                                         .replace(/⁴/g, '4').replace(/⁵/g, '5')
                                         .replace(/⁶/g, '6').replace(/⁷/g, '7')
                                         .replace(/⁸/g, '8').replace(/⁹/g, '9');
                        return `\\left(\\frac{${num}}{${den}}\\right)^{${power}}`;
                    })
                    // Дроби в скобках без степени: (a/b) -> \frac{a}{b}
                    // Но только если это не часть более сложного выражения
                    .replace(/\(([A-Za-z0-9_\\^²³]+)\/([A-Za-z0-9_\\^²³]+)\)/g, '\\frac{$1}{$2}')
                    // Дроби вида a/b -> \frac{a}{b} (простые случаи)
                    .replace(/([A-Za-z0-9_()]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}') // a/(b) -> \frac{a}{b}
                    .replace(/([A-Za-z0-9_()]+)\s*\/\s*([A-Za-z0-9_()]+)/g, (match, num, den) => {
                        // Не заменяем, если это уже LaTeX
                        if (match.includes('\\')) return match;
                        // Не заменяем, если это единицы измерения (м/с, км/с и т.д.)
                        if (/[кмГпксв\.летм]\/[кмГпксв\.летм]/.test(match)) return match;
                        return `\\frac{${num}}{${den}}`;
                    })
                    // Единицы измерения в тексте (в конце, чтобы не мешать формулам)
                    .replace(/\s+([кмГпксв\.летм]+)\s*/g, '\\text{ $1} ')
                    // Обрабатываем степени после уже преобразованных дробей в скобках
                    // \frac{...}{...}^n -> \left(\frac{...}{...}\right)^n
                    // Это нужно для случаев, когда дробь была преобразована, а степень стоит после
                    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}\^?([²³⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)/g, (match, num, den, pow) => {
                        const power = pow.replace(/²/g, '2').replace(/³/g, '3')
                                         .replace(/⁰/g, '0').replace(/¹/g, '1')
                                         .replace(/⁴/g, '4').replace(/⁵/g, '5')
                                         .replace(/⁶/g, '6').replace(/⁷/g, '7')
                                         .replace(/⁸/g, '8').replace(/⁹/g, '9');
                        return `\\left(\\frac{${num}}{${den}}\\right)^{${power}}`;
                    })
                    // Также обрабатываем степени, которые стоят сразу после закрывающей скобки
                    // Это для случаев типа (a/b)², где дробь уже преобразована
                    .replace(/\(\\frac\{([^}]+)\}\{([^}]+)\}\)\^?([²³⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)/g, (match, num, den, pow) => {
                        const power = pow.replace(/²/g, '2').replace(/³/g, '3')
                                         .replace(/⁰/g, '0').replace(/¹/g, '1')
                                         .replace(/⁴/g, '4').replace(/⁵/g, '5')
                                         .replace(/⁶/g, '6').replace(/⁷/g, '7')
                                         .replace(/⁸/g, '8').replace(/⁹/g, '9');
                        return `\\left(\\frac{${num}}{${den}}\\right)^{${power}}`;
                    })
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
        // marked.js может экранировать \ как &#92; или &amp;#92;
        html = html.replace(/&amp;#92;/g, '\\');
        html = html.replace(/&#92;/g, '\\');
        
        // Восстанавливаем экранированные фигурные скобки в формулах
        html = html.replace(/&amp;#123;/g, '{');
        html = html.replace(/&#123;/g, '{');
        html = html.replace(/&amp;#125;/g, '}');
        html = html.replace(/&#125;/g, '}');
        
        // Восстанавливаем двойные обратные слеши (экранированные \)
        // В HTML \\ может быть представлено как &#92;&#92; или &amp;#92;&amp;#92;
        html = html.replace(/&amp;#92;&amp;#92;/g, '\\\\');
        html = html.replace(/&#92;&#92;/g, '\\\\');
        
        // Восстанавливаем обратные слеши в формулах MathJax
        // Проверяем формулы и восстанавливаем экранированные \text, \left, \right и т.д.
        // Паттерн: внутри формул $...$ или $$...$$ восстанавливаем экранированные \
        html = html.replace(/(\$\$?)([^$]+?)(\$\$?)/g, (match, start, formula, end) => {
            // Восстанавливаем экранированные обратные слеши в формуле
            let restored = formula
                .replace(/&amp;#92;/g, '\\')
                .replace(/&#92;/g, '\\')
                .replace(/&amp;lt;/g, '<')
                .replace(/&lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&gt;/g, '>')
                // Восстанавливаем другие экранированные символы
                .replace(/&amp;#123;/g, '{')
                .replace(/&#123;/g, '{')
                .replace(/&amp;#125;/g, '}')
                .replace(/&#125;/g, '}')
                // Восстанавливаем двойные обратные слеши
                .replace(/&amp;#92;&amp;#92;/g, '\\\\')
                .replace(/&#92;&#92;/g, '\\\\');
            return start + restored + end;
        });
        
        // Дополнительная проверка: ищем формулы, которые могли быть экранированы по-другому
        // Например, если формула была обернута в <code> или <pre> теги
        html = html.replace(/<code>(\$\$?)([^$]+?)(\$\$?)<\/code>/g, (match, start, formula, end) => {
            // Восстанавливаем экранированные символы
            let restored = formula
                .replace(/&amp;#92;/g, '\\')
                .replace(/&#92;/g, '\\')
                .replace(/&amp;lt;/g, '<')
                .replace(/&lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&gt;/g, '>');
            return start + restored + end;
        });
        
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

        // Если MathJax уже инициализирован, не делаем ничего
        if (window.MathJax && window.MathJax.typesetPromise) {
            console.log('MathJax already initialized');
            return;
        }

        // Настройка MathJax ДО загрузки скрипта
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
                ready: () => {
                    if (window.DEBUG_ARTICLE_PARSER) {
                        console.log('MathJax startup.ready() called');
                    }
                    // MathJax 3.x автоматически вызывает defaultReady после загрузки
                    // typesetPromise становится доступным после этого
                    const result = MathJax.startup.defaultReady();
                    if (window.DEBUG_ARTICLE_PARSER) {
                        console.log('MathJax.defaultReady() completed, typesetPromise available:', typeof MathJax.typesetPromise === 'function');
                    }
                    return result;
                },
                pageReady: () => {
                    if (window.DEBUG_ARTICLE_PARSER) {
                        console.log('MathJax startup.pageReady() called');
                    }
                    return MathJax.startup.defaultPageReady();
                }
            }
        };

        // Загрузка MathJax с CDN
        if (!document.querySelector('script[src*="mathjax"]')) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
            script.async = true;
            script.id = 'mathjax-script';
            
            // Обработчик загрузки скрипта
            script.onload = () => {
                if (window.DEBUG_ARTICLE_PARSER) {
                    console.log('MathJax script loaded, waiting for initialization...');
                }
                // MathJax 3.x инициализируется автоматически после загрузки скрипта
                // startup.ready() будет вызван автоматически
            };
            
            script.onerror = () => {
                console.error('Failed to load MathJax script');
            };
            
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
