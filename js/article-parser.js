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

        console.log(`[ArticleParser] parse() called, articlePath="${articlePath}", text length=${markdownText.length}`);

        try {
            // 0. Extract frontmatter (YAML metadata)
            const { content, metadata } = this.extractFrontmatter(markdownText);
            
            console.log(`[ArticleParser] Frontmatter extracted, metadata.id=${metadata?.id}, articlePath="${articlePath}"`);
            
            // Включаем детальное логирование для тестовой статьи
            if (metadata && (metadata.id === 'test-formula' || articlePath.includes('test-formula'))) {
                window.DEBUG_ARTICLE_PARSER = true;
                console.log('🔍 DEBUG MODE: Detailed logging enabled for test-formula article');
            } else {
                console.log(`[ArticleParser] DEBUG mode NOT enabled: metadata.id=${metadata?.id}, articlePath includes test-formula=${articlePath.includes('test-formula')}`);
            }
            
            // Подход GitHub: НЕ защищаем формулы, просто парсим markdown
            // marked.js настроен так, чтобы не трогать формулы (см. convertMarkdownToHtml)
            // Формулы остаются как $...$ или $$...$$ в исходном виде
            
            // 1. Pre-process: специальные блоки
            let processed = this.preprocessSpecialBlocks(content);
            
            // 2. Pre-process: формулы в блоках кода (преобразование в MathJax)
            processed = this.preprocessCodeBlockFormulas(processed);
            
            // 3. Pre-process: рамки для формул
            processed = this.preprocessFormulaBoxes(processed);
            
            // 4. Parse markdown to HTML (формулы остаются как есть, как в GitHub)
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
            
            // 9.5. Post-process: финальная очистка формул от лишних оберток
            html = this.cleanupFormulas(html);
            
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
        // Более гибкое регулярное выражение для frontmatter
        // Поддерживает варианты: ---\n...\n---, ---\n...\n---\n, ---\r\n...\r\n---\r\n
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
        const match = text.match(frontmatterRegex);
        
        if (!match) {
            console.warn('[ArticleParser] No frontmatter found in text');
            return { content: text, metadata: {} };
        }
        
        const yamlText = match[1];
        const content = text.substring(match[0].length);
        
        console.log(`[ArticleParser] Frontmatter found, YAML length: ${yamlText.length}, content starts with: "${content.substring(0, 50)}"`);
        
        try {
            // Простой YAML парсер для метаданных
            const metadata = this.parseSimpleYAML(yamlText);
            console.log(`[ArticleParser] Parsed metadata:`, metadata);
            return { content, metadata };
        } catch (error) {
            console.warn('[ArticleParser] Failed to parse frontmatter:', error);
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
        // Нормализуем переносы строк (поддержка \r\n и \n)
        const normalizedText = yamlText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');
        
        console.log(`[ArticleParser] parseSimpleYAML: processing ${lines.length} lines`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Пропускаем пустые строки и комментарии
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) {
                console.warn(`[ArticleParser] Line ${i + 1} has no colon: "${line}"`);
                continue;
            }
            
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
            console.log(`[ArticleParser] Parsed: ${key} = ${JSON.stringify(value)}`);
        }
        
        console.log(`[ArticleParser] Final metadata object:`, metadata);
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
     * Защита формул через HTML комментарии (подход GitHub-совместимый)
     * marked.js не трогает HTML комментарии, поэтому формулы сохраняются
     * @param {string} text - Markdown текст
     * @returns {{protectedText: string, formulas: Array}} - Защищенный текст и массив формул
     */
    protectFormulasAsComments(text) {
        try {
            const formulas = [];
            let formulaIndex = 0;
            
            // Заменяем формулы на HTML комментарии
            // Формат: <!--MATH_BLOCK_0--> или <!--MATH_INLINE_0-->
            const createComment = (type, index) => {
                return `<!--MATH_${type}_${index}-->`;
            };
            
            // 1. Защищаем block формулы $$...$$ (сначала, чтобы не перехватить их как inline)
            let protectedText = text.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, formula) => {
                try {
                    const trimmedFormula = formula.trim();
                    if (!trimmedFormula) return match; // Пропускаем пустые формулы
                    
                    const comment = createComment('BLOCK', formulaIndex);
                    formulas.push({ type: 'block', formula: trimmedFormula, index: formulaIndex });
                    
                    if (window.DEBUG_ARTICLE_PARSER || formulas.length <= 3) {
                        console.log(`[protectFormulasAsComments] Protected block formula ${formulaIndex}:`, trimmedFormula.substring(0, 50));
                    }
                    
                    formulaIndex++;
                    return comment;
                } catch (error) {
                    console.error('❌ Ошибка при защите block формулы:', error);
                    return match;
                }
            });
            
            // 2. Защищаем inline формулы $...$ (но не $$)
            protectedText = protectedText.replace(/\$([^$\n]+?)\$/g, (match, formula, offset, string) => {
                try {
                    // Проверяем, что это не часть $$...$$
                    const before = string.substring(Math.max(0, offset - 1), offset);
                    const after = string.substring(offset + match.length, offset + match.length + 1);
                    if (before === '$' || after === '$') {
                        return match; // Это часть block формулы, пропускаем
                    }
                    
                    const trimmedFormula = formula.trim();
                    if (!trimmedFormula) return match; // Пропускаем пустые формулы
                    
                    const comment = createComment('INLINE', formulaIndex);
                    formulas.push({ type: 'inline', formula: trimmedFormula, index: formulaIndex });
                    formulaIndex++;
                    return comment;
                } catch (error) {
                    console.error('❌ Ошибка при защите inline формулы:', error);
                    return match;
                }
            });
            
            return { protectedText, formulas };
        } catch (error) {
            console.error('❌ Критическая ошибка в protectFormulasAsComments:', error);
            return { protectedText: text, formulas: [] };
        }
    }
    
    /**
     * Восстановление формул из HTML комментариев
     * @param {string} html - HTML после парсинга
     * @param {Array} formulas - Массив формул
     * @returns {string} - HTML с восстановленными формулами
     */
    restoreFormulasFromComments(html, formulas) {
        try {
            if (!formulas || formulas.length === 0) {
                return html;
            }
            
            if (!html || typeof html !== 'string') {
                return html || '';
            }
            
            // Заменяем комментарии на формулы
            let restoredCount = 0;
            let missingCount = 0;
            
            for (let index = 0; index < formulas.length; index++) {
                const formulaObj = formulas[index];
                try {
                    if (!formulaObj || !formulaObj.type || !formulaObj.formula) {
                        continue;
                    }
                    
                    const placeholderType = formulaObj.type === 'block' ? 'BLOCK' : 'INLINE';
                    const comment = `<!--MATH_${placeholderType}_${index}-->`;
                    
                    // Проверяем наличие комментария в HTML
                    if (!html.includes(comment)) {
                        missingCount++;
                        if (window.DEBUG_ARTICLE_PARSER || index < 5) {
                            console.warn(`⚠️ Комментарий формулы ${index} НЕ НАЙДЕН в HTML!`);
                            console.warn(`  Type: ${formulaObj.type}, Index: ${index}`);
                            console.warn(`  Formula: ${formulaObj.formula.substring(0, 50)}`);
                            // Пробуем найти похожие комментарии
                            const similarComments = html.match(/<!--MATH_[BI][A-Z]+_\d+-->/g);
                            if (similarComments) {
                                console.warn(`  Found similar comments: ${similarComments.slice(0, 3).join(', ')}`);
                            }
                        }
                        continue;
                    }
                    
                    // Восстанавливаем формулу
                    let replacement;
                    if (formulaObj.type === 'block') {
                        replacement = `\n\n$$${formulaObj.formula}$$\n\n`;
                    } else {
                        replacement = `$${formulaObj.formula}$`;
                    }
                    
                    // Заменяем комментарий на формулу (все вхождения)
                    const beforeCount = (html.match(new RegExp(comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    html = html.replace(new RegExp(comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
                    const afterCount = (html.match(new RegExp(comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    
                    if (beforeCount > 0 && afterCount === 0) {
                        restoredCount++;
                        if (window.DEBUG_ARTICLE_PARSER || index < 3) {
                            console.log(`[restoreFormulasFromComments] ✓ Restored formula ${index} (${formulaObj.type}): ${beforeCount} replacements`);
                        }
                    } else if (afterCount > 0) {
                        console.warn(`⚠️ Комментарий формулы ${index} не был полностью заменен! Осталось: ${afterCount}`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при восстановлении формулы ${index}:`, error);
                }
            }
            
            // Итоговая статистика
            if (window.DEBUG_ARTICLE_PARSER || missingCount > 0) {
                console.log(`[restoreFormulasFromComments] Итого: восстановлено ${restoredCount}/${formulas.length}, пропущено ${missingCount}`);
            }
            
            return html;
        } catch (error) {
            console.error('❌ Критическая ошибка в restoreFormulasFromComments:', error);
            return html || '';
        }
    }
    
    /**
     * Упрощенный механизм обработки формул: защита и восстановление
     * ИСПОЛЬЗУЕТСЯ ПОДХОД GITHUB: формулы не защищаются, остаются как есть
     * 
     * ⚠️ ЭТОТ МЕТОД БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ
     * Оставлен для справки или возможного использования в будущем
     * 
     * Используем Unicode маркеры из Private Use Area (U+E000-U+F8FF)
     * Эти символы не используются в обычном тексте и не будут удалены marked.js
     * @param {string} text - Markdown текст
     * @returns {{protectedText: string, formulas: Array}} - Защищенный текст и массив формул
     * @deprecated Используется подход GitHub - формулы не защищаются
     */
    protectFormulas(text) {
        try {
            const formulas = [];
            let formulaIndex = 0;
            
            // Используем Unicode маркеры из Private Use Area
            // U+E000-U+F8FF - это диапазон, зарезервированный для частного использования
            // Эти символы точно не будут удалены marked.js, так как они являются обычными символами
            // Формат маркера: \uE000 + тип (B/I) + индекс (3 цифры) + \uE001
            // Например: \uE000B000\uE001 для block формулы #0
            const createPlaceholder = (type, index) => {
                const typeChar = type === 'BLOCK' ? 'B' : 'I';
                // Индекс в формате 3 цифры (000-999)
                const indexStr = String(index).padStart(3, '0');
                // Маркер: начало (U+E000) + тип + индекс + конец (U+E001)
                return `\uE000${typeChar}${indexStr}\uE001`;
            };
            
            // 1. Защищаем block формулы $$...$$ (сначала, чтобы не перехватить их как inline)
            // Используем более надежный паттерн, который работает с многострочными формулами
            // Поддерживаем варианты: $$...$$, $$\n...\n$$, $$ ... $$ (с пробелами)
            let protectedText = text.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, formula) => {
                try {
                    const trimmedFormula = formula.trim();
                    if (!trimmedFormula) return match; // Пропускаем пустые формулы
                    
                    const placeholder = createPlaceholder('BLOCK', formulaIndex);
                    formulas.push({ type: 'block', formula: trimmedFormula, index: formulaIndex });
                    
                    if (window.DEBUG_ARTICLE_PARSER || formulas.length <= 3) {
                        console.log(`[protectFormulas] Protected block formula ${formulaIndex}:`, trimmedFormula.substring(0, 50));
                    }
                    
                    formulaIndex++;
                    return placeholder;
                } catch (error) {
                    console.error('❌ Ошибка при защите block формулы:', error);
                    console.error('  Match:', match.substring(0, 100));
                    console.error('  Formula:', formula.substring(0, 100));
                    return match; // Возвращаем оригинал при ошибке
                }
            });
            
            // 2. Защищаем inline формулы $...$ (но не $$)
            protectedText = protectedText.replace(/\$([^$\n]+?)\$/g, (match, formula, offset, string) => {
                try {
                    // Проверяем, что это не часть $$...$$
                    const before = string.substring(Math.max(0, offset - 1), offset);
                    const after = string.substring(offset + match.length, offset + match.length + 1);
                    if (before === '$' || after === '$') {
                        return match; // Это часть block формулы, пропускаем
                    }
                    
                    const trimmedFormula = formula.trim();
                    if (!trimmedFormula) return match; // Пропускаем пустые формулы
                    
                    const placeholder = createPlaceholder('INLINE', formulaIndex);
                    formulas.push({ type: 'inline', formula: trimmedFormula, index: formulaIndex });
                    formulaIndex++;
                    return placeholder;
                } catch (error) {
                    console.error('❌ Ошибка при защите inline формулы:', error);
                    console.error('  Match:', match.substring(0, 100));
                    console.error('  Formula:', formula.substring(0, 100));
                    return match; // Возвращаем оригинал при ошибке
                }
            });
            
            return { protectedText, formulas };
        } catch (error) {
            console.error('❌ Критическая ошибка в protectFormulas:', error);
            console.error('  Text length:', text?.length);
            console.error('  Error stack:', error.stack);
            // Возвращаем оригинальный текст при критической ошибке
            return { protectedText: text, formulas: [] };
        }
    }
    
    /**
     * Упрощенное восстановление формул после парсинга
     * ИСПОЛЬЗУЕТСЯ ПОДХОД GITHUB: формулы не защищаются, остаются как есть
     * 
     * ⚠️ ЭТОТ МЕТОД БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ
     * Оставлен для справки или возможного использования в будущем
     * 
     * Простая замена плейсхолдеров на формулы - вся логика в одном месте
     * @param {string} html - HTML после парсинга
     * @param {Array} formulas - Массив формул
     * @returns {string} - HTML с восстановленными формулами
     * @deprecated Используется подход GitHub - формулы не защищаются
     */
    restoreProtectedFormulas(html, formulas) {
        try {
            if (!formulas || formulas.length === 0) {
                return html;
            }
            
            if (!html || typeof html !== 'string') {
                console.error('❌ Ошибка в restoreProtectedFormulas: html не является строкой');
                console.error('  HTML type:', typeof html);
                return html || '';
            }
            
            // Простая замена: находим Unicode маркер и заменяем на формулу
            // Используем обычный цикл вместо forEach для большей гибкости
            for (let index = 0; index < formulas.length; index++) {
                const formulaObj = formulas[index];
                try {
                    if (!formulaObj || !formulaObj.type || !formulaObj.formula) {
                        console.error(`❌ Ошибка в restoreProtectedFormulas: некорректный объект формулы (index ${index})`);
                        console.error('  FormulaObj:', formulaObj);
                        continue;
                    }
                    
                    // Создаем маркер точно так же, как в protectFormulas
                    const typeChar = formulaObj.type === 'block' ? 'B' : 'I';
                    const indexStr = String(index).padStart(3, '0');
                    const marker = `\uE000${typeChar}${indexStr}\uE001`;
                    
                    // Восстанавливаем формулу, оборачивая в правильные теги для MathJax
                    // Для block формул используем отдельный параграф или div
                    let replacement;
                    if (formulaObj.type === 'block') {
                        // Block формулы должны быть на отдельной строке
                        replacement = `\n\n$$${formulaObj.formula}$$\n\n`;
                    } else {
                        // Inline формулы вставляем как есть
                        replacement = `$${formulaObj.formula}$`;
                    }
                    
                    // Ищем маркер в HTML (экранируем специальные символы Unicode для regex)
                    // Маркер: \uE000 + тип + индекс + \uE001
                    const markerRegex = new RegExp(
                        `\uE000${typeChar}${indexStr}\uE001`,
                        'g'
                    );
                    
                    // Проверяем наличие маркера в HTML
                    const matches = html.match(markerRegex);
                    if (!matches || matches.length === 0) {
                        // Пробуем найти маркер в экранированном виде (HTML entities)
                        // marked.js может экранировать Unicode символы как &#57344; или \uE000
                        const escapedMarkerPattern = new RegExp(
                            `&#57344;|&#xE000;|\\\\uE000|\\uE000`,
                            'g'
                        );
                        const escapedMatches = html.match(escapedMarkerPattern);
                        
                        if (escapedMatches && escapedMatches.length > 0) {
                            console.warn(`⚠️ Маркер формулы ${index} найден в экранированном виде!`);
                            console.warn(`  Type: ${formulaObj.type}, Index: ${index}`);
                            console.warn(`  Formula: ${formulaObj.formula.substring(0, 50)}`);
                            console.warn(`  Пробуем восстановить из экранированного маркера...`);
                            
                            // Пробуем найти контекст вокруг экранированного маркера
                            const contextIndex = html.indexOf(escapedMatches[0]);
                            if (contextIndex > 0) {
                                const context = html.substring(
                                    Math.max(0, contextIndex - 100),
                                    Math.min(html.length, contextIndex + 200)
                                );
                                console.warn(`  Context: ${context.substring(0, 150)}`);
                            }
                        } else {
                            console.warn(`⚠️ Маркер формулы ${index} НЕ НАЙДЕН в HTML!`);
                            console.warn(`  Type: ${formulaObj.type}, Index: ${index}`);
                            console.warn(`  Formula: ${formulaObj.formula.substring(0, 50)}`);
                            // Пробуем найти похожие маркеры для отладки
                            const similarMarkers = html.match(/\uE000[BI]\d{3}\uE001/g);
                            if (similarMarkers) {
                                console.warn(`  Found similar markers: ${similarMarkers.slice(0, 5).join(', ')}`);
                            } else {
                                // Проверяем, есть ли вообще Unicode символы в HTML
                                const unicodeChars = html.match(/[\uE000-\uF8FF]/g);
                                if (unicodeChars) {
                                    console.warn(`  Found Unicode Private Use Area chars: ${unicodeChars.length} total`);
                                } else {
                                    console.error(`  ❌ НИ ОДИН маркер не найден в HTML!`);
                                    console.error(`  Это означает, что marked.js удалил ВСЕ маркеры!`);
                                }
                            }
                        }
                        continue; // Переходим к следующей формуле
                    }
                    
                    // Заменяем маркер на формулу
                    try {
                        const beforeCount = matches.length;
                        html = html.replace(markerRegex, replacement);
                        const afterMatches = html.match(markerRegex);
                        const afterCount = afterMatches ? afterMatches.length : 0;
                        
                        if (window.DEBUG_ARTICLE_PARSER || index < 3) {
                            console.log(`[restoreProtectedFormulas] Restored formula ${index} (${formulaObj.type}): ${beforeCount} -> ${afterCount} replacements`);
                            console.log(`  Formula: ${formulaObj.formula.substring(0, 50)}`);
                            if (beforeCount > 0 && afterCount === 0) {
                                // Успешная замена - маркер был заменен на формулу
                                // Проверяем, что формула действительно вставлена
                                const formulaCheck = html.includes(`$$${formulaObj.formula.substring(0, 20)}`);
                                if (!formulaCheck) {
                                    console.warn(`  ⚠️ Формула не найдена в HTML после замены!`);
                                }
                            }
                        }
                    } catch (regexError) {
                        console.error(`❌ Ошибка при замене формулы ${index}:`, regexError);
                        console.error(`  Marker: ${marker}`);
                        console.error(`  Formula: ${formulaObj.formula.substring(0, 100)}`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при восстановлении формулы ${index}:`, error);
                    console.error('  FormulaObj:', formulaObj);
                    console.error('  Error stack:', error.stack);
                }
            }
            
            // Исправляем формулы с тремя знаками доллара ($$$...$$$) - ошибка двойного восстановления
            try {
                html = html.replace(/\$\$\$([^$]+?)\$\$\$/g, '$$$1$$');
            } catch (error) {
                console.error('❌ Ошибка при исправлении формул с тремя знаками доллара:', error);
            }
            
            return html;
        } catch (error) {
            console.error('❌ Критическая ошибка в restoreProtectedFormulas:', error);
            console.error('  HTML length:', html?.length);
            console.error('  Formulas count:', formulas?.length);
            console.error('  Error stack:', error.stack);
            // Возвращаем оригинальный HTML при критической ошибке
            return html || '';
        }
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
     * Финальная очистка формул от лишних оберток и исправление структуры
     * @param {string} html - HTML после парсинга
     * @returns {string} - HTML с очищенными формулами
     */
    cleanupFormulas(html) {
        // 1. Убираем лишние пробелы и переносы строк вокруг block формул
        // Исправляем случаи, когда формулы обернуты в несколько тегов
        html = html.replace(/(<p>\s*)?(\$\$[\s\S]*?\$\$)(\s*<\/p>)?/g, (match, pOpen, formula, pClose) => {
            // Если формула обернута в <p>, убираем обертку
            return '\n\n' + formula + '\n\n';
        });
        
        // 2. Убираем двойные переносы строк вокруг формул
        html = html.replace(/\n{3,}/g, '\n\n');
        
        // 3. Исправляем случаи, когда формулы находятся внутри <code> тегов
        // (это должно было быть исправлено в restoreEscapedFormulas, но на всякий случай)
        html = html.replace(/<code>(\$\$?)([\s\S]*?)(\$\$?)<\/code>/g, '$1$2$3');
        
        // 4. Исправляем поврежденные формулы (например, с разорванными границами)
        // Паттерн: $...$ или $$...$$, но с возможными пробелами внутри границ
        html = html.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, '$$$1$$');
        html = html.replace(/\$\s*([^$\n]+?)\s*\$/g, '$$1$');
        
        // 5. Исправляем формулы, которые были разорваны на несколько строк
        // Объединяем формулы, которые разорваны переносами строк внутри
        html = html.replace(/\$\$([\s\S]*?)\n+([\s\S]*?)\$\$/g, '$$$1 $2$$');
        
        // 6. Убираем пустые формулы ($$$$ или $$ $$)
        html = html.replace(/\$\$\s*\$\$/g, '');
        html = html.replace(/\$\s*\$/g, '');
        
        // 7. Исправляем формулы внутри <pre> тегов (они могут мешать MathJax)
        html = html.replace(/<pre[^>]*>(\$\$?)([\s\S]*?)(\$\$?)<\/pre>/g, (match, start, formula, end) => {
            // Если это формула, убираем <pre> тег
            if (formula.trim().length > 0 && !formula.includes('\n```')) {
                return start + formula + end;
            }
            return match; // Оставляем как есть, если это не формула
        });
        
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
        // Важно: восстанавливаем ДО обработки формул, чтобы не сломать структуру
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
        
        // КРИТИЧНО: Восстанавливаем формулы, которые были обернуты в <code> теги
        // marked.js может оборачивать формулы в <code>, что мешает MathJax
        // Паттерн: <code>$...$</code> или <code>$$...$$</code>
        html = html.replace(/<code>(\$\$?)([\s\S]*?)(\$\$?)<\/code>/g, (match, start, formula, end) => {
            // Восстанавливаем экранированные символы в формуле
            let restored = formula
                .replace(/&amp;#92;/g, '\\')
                .replace(/&#92;/g, '\\')
                .replace(/&amp;lt;/g, '<')
                .replace(/&lt;/g, '<')
                .replace(/&amp;gt;/g, '>')
                .replace(/&gt;/g, '>')
                .replace(/&amp;#123;/g, '{')
                .replace(/&#123;/g, '{')
                .replace(/&amp;#125;/g, '}')
                .replace(/&#125;/g, '}')
                .replace(/&amp;#92;&amp;#92;/g, '\\\\')
                .replace(/&#92;&#92;/g, '\\\\');
            // Возвращаем формулу БЕЗ <code> тегов
            return start + restored + end;
        });
        
        // Восстанавливаем обратные слеши в формулах MathJax
        // Проверяем формулы и восстанавливаем экранированные \text, \left, \right и т.д.
        // Сначала block формулы: $$...$$
        html = html.replace(/(\$\$)([\s\S]*?)(\$\$)/g, (match, start, formula, end) => {
            // Пропускаем, если это не формула (слишком короткая или содержит только пробелы)
            if (formula.trim().length < 1) {
                return match;
            }
            
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
        
        // Затем inline формулы: $...$ (но не $$)
        html = html.replace(/([^$])(\$)([^$\n]+?)(\$)([^$])/g, (match, before, start, formula, end, after) => {
            // Пропускаем, если это не формула (слишком короткая или содержит только пробелы)
            if (formula.trim().length < 1) {
                return match;
            }
            
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
            return before + start + restored + end + after;
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
        // ВАЖНО: marked.js по умолчанию может экранировать или удалять HTML теги
        // Используем настройки, которые сохраняют HTML
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false,
            sanitize: false, // НЕ экранируем HTML
            pedantic: false,
            silent: false
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
        
        // Кастомный рендерер для параграфов - пропускаем формулы (подход GitHub)
        const originalParagraph = renderer.paragraph;
        renderer.paragraph = (text) => {
            // Если параграф содержит block формулы ($$...$$), не обрабатываем его
            // Block формулы должны быть на отдельной строке
            if (text.includes('$$')) {
                // Разделяем текст на части: до формулы, формула, после формулы
                // Это нужно, чтобы правильно обработать текст вокруг формул
                const parts = text.split(/(\$\$[\s\S]*?\$\$)/);
                let result = '';
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (part.startsWith('$$') && part.endsWith('$$')) {
                        // Это формула - оставляем как есть
                        result += part + '\n';
                    } else if (part.trim()) {
                        // Это обычный текст - оборачиваем в <p>
                        result += `<p>${part.trim()}</p>\n`;
                    }
                }
                return result || text + '\n';
            }
            // Для inline формул ($...$) оставляем в параграфе, но не экранируем
            return originalParagraph ? originalParagraph(text) : `<p>${text}</p>\n`;
        };

        // Кастомные extensions для формул - пропускаем их (подход GitHub)
        // Block формулы
        const mathBlockExtension = {
            name: 'mathBlock',
            level: 'block',
            start(src) {
                const index = src.indexOf('$$');
                return index >= 0 ? index : undefined;
            },
            tokenizer(src, tokens) {
                const blockMatch = src.match(/^\$\$([\s\S]*?)\$\$/);
                if (blockMatch) {
                    return {
                        type: 'mathBlock',
                        raw: blockMatch[0],
                        text: blockMatch[1].trim()
                    };
                }
                return false;
            },
            renderer(token) {
                return `\n\n$$${token.text}$$\n\n`;
            }
        };
        
        // Inline формулы
        const mathInlineExtension = {
            name: 'mathInline',
            level: 'inline',
            start(src) {
                // Ищем $, но не $$
                const index = src.indexOf('$');
                if (index >= 0) {
                    // Проверяем, что это не начало block формулы
                    if (src.substring(index, index + 2) !== '$$') {
                        return index;
                    }
                }
                return undefined;
            },
            tokenizer(src, tokens) {
                // Inline формулы: $...$ (но не $$)
                const inlineMatch = src.match(/^\$([^$\n]+?)\$/);
                if (inlineMatch) {
                    // Проверяем, что это не часть block формулы
                    const before = src.substring(Math.max(0, src.indexOf(inlineMatch[0]) - 1), src.indexOf(inlineMatch[0]));
                    const after = src.substring(src.indexOf(inlineMatch[0]) + inlineMatch[0].length, src.indexOf(inlineMatch[0]) + inlineMatch[0].length + 1);
                    if (before !== '$' && after !== '$') {
                        return {
                            type: 'mathInline',
                            raw: inlineMatch[0],
                            text: inlineMatch[1].trim()
                        };
                    }
                }
                return false;
            },
            renderer(token) {
                return `$${token.text}$`;
            }
        };

        marked.use({ renderer, extensions: [mathBlockExtension, mathInlineExtension] });

        // Парсим markdown
        // marked.js настроен так, чтобы не трогать формулы (подход GitHub)
        // Формулы остаются как $...$ или $$...$$ в HTML, а потом MathJax их обработает
        const html = marked.parse(markdownText);
        
        // Проверяем, что формулы сохранились (для отладки)
        const blockFormulaPattern = /\$\$[\s\S]*?\$\$/g;
        const inlineFormulaPattern = /\$[^$\n]+?\$/g;
        const blockFormulas = (html.match(blockFormulaPattern) || []).length;
        const inlineFormulas = (html.match(inlineFormulaPattern) || []).length;
        const totalFormulas = blockFormulas + inlineFormulas;
        
        const expectedBlock = (markdownText.match(blockFormulaPattern) || []).length;
        const expectedInline = (markdownText.match(inlineFormulaPattern) || []).length;
        const expectedTotal = expectedBlock + expectedInline;
        
        if (totalFormulas < expectedTotal) {
            const missing = expectedTotal - totalFormulas;
            console.warn(`⚠️ marked.js удалил или экранировал ${missing} формул!`);
            console.warn(`  Было: ${expectedTotal} (${expectedBlock} block, ${expectedInline} inline)`);
            console.warn(`  Стало: ${totalFormulas} (${blockFormulas} block, ${inlineFormulas} inline)`);
            
            // Проверяем, не экранированы ли формулы
            const escapedDollar = (html.match(/&#36;|&amp;#36;/g) || []).length;
            if (escapedDollar > 0) {
                console.warn(`  Найдено ${escapedDollar} экранированных символов $ - будет восстановлено`);
            }
            
            // Проверяем, не обернуты ли формулы в <code>
            const formulasInCode = (html.match(/<code>.*?\$.*?\$.*?<\/code>/g) || []).length;
            if (formulasInCode > 0) {
                console.warn(`  Найдено ${formulasInCode} формул внутри <code> тегов - это может мешать MathJax`);
            }
        } else if (expectedTotal > 0 && window.DEBUG_ARTICLE_PARSER) {
            console.log(`✓ Все формулы сохранены: ${totalFormulas}/${expectedTotal}`);
        }
        
        return html;
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
