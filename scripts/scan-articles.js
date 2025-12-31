#!/usr/bin/env node

/**
 * Скрипт для автоматического сканирования статей и обновления config.json
 * Использование: node scripts/scan-articles.js
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'articles');
const ARTICLES_LIST_PATH = path.join(__dirname, '..', 'articles', 'articles-list.json');

/**
 * Рекурсивно сканирует директорию articles/ и находит все .md файлы статей
 * @param {string} dir - Директория для сканирования
 * @param {string} baseDir - Базовая директория (для относительных путей)
 * @returns {Array} Массив найденных статей
 */
function scanArticlesRecursive(dir = ARTICLES_DIR, baseDir = ARTICLES_DIR) {
    const articles = [];
    
    if (!fs.existsSync(dir)) {
        console.warn(`Directory not found: ${dir}`);
        return articles;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        // Пропускаем служебные файлы и папки
        if (entry.name === 'README.md' || 
            entry.name === 'articles-list.json' ||
            entry.name === '.git' ||
            entry.name === 'images' ||
            entry.name.startsWith('.')) {
            continue;
        }
        
        if (entry.isDirectory()) {
            // Рекурсивно сканируем поддиректории
            const subArticles = scanArticlesRecursive(fullPath, baseDir);
            articles.push(...subArticles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            // Нашли .md файл - это может быть статья
            // Проверяем, есть ли в этой же директории article.md (приоритет)
            const dirPath = path.dirname(fullPath);
            const dirName = path.basename(dirPath);
            const articleMdPath = path.join(dirPath, 'article.md');
            
            // Если это не article.md, но есть article.md в той же папке - пропускаем
            if (entry.name !== 'article.md' && fs.existsSync(articleMdPath)) {
                continue;
            }
            
            // Пытаемся прочитать ID из frontmatter
            let articleId = null;
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
                if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const idMatch = frontmatter.match(/^id:\s*(.+)$/m);
                    if (idMatch) {
                        articleId = idMatch[1].trim();
                    }
                }
            } catch (error) {
                // Игнорируем ошибки чтения
            }
            
            // Если ID не найден в frontmatter, генерируем из имени
            if (!articleId) {
                // Определяем ID статьи из имени директории или файла
                articleId = dirName;
                if (dirPath === baseDir) {
                    // Файл в корне articles/ - используем имя файла без расширения
                    articleId = path.basename(entry.name, '.md');
                }
                
                // Нормализуем ID (lowercase, дефисы вместо подчеркиваний и пробелов)
                articleId = articleId.toLowerCase()
                    .replace(/[_\s]+/g, '-')
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/^-+|-+$/g, ''); // Убираем дефисы в начале и конце
            }
            
            const mdFile = `articles/${relativePath}`;
            
            articles.push({
                id: articleId,
                mdFile: mdFile
            });
            
            console.log(`✓ Found article: ${articleId} (${mdFile})`);
        }
    }
    
    return articles;
}

/**
 * Сканирует директорию articles/ и находит все article.md файлы
 */
function scanArticles() {
    return scanArticlesRecursive();
}

/**
 * Создает articles-list.json в папке articles/ с найденными статьями
 */
function createArticlesList(articles) {
    const articlesList = {
        articles: articles,
        lastUpdated: new Date().toISOString(),
        count: articles.length
    };
    
    // Сохраняем с отступами
    const jsonContent = JSON.stringify(articlesList, null, 2);
    fs.writeFileSync(ARTICLES_LIST_PATH, jsonContent, 'utf-8');
    
    console.log(`\n✓ Created articles/articles-list.json with ${articles.length} articles`);
}

/**
 * Главная функция
 */
function main() {
    console.log('Scanning articles directory...\n');
    
    try {
        const articles = scanArticles();
        
        if (articles.length === 0) {
            console.log('\n⚠ No articles found in articles/ directory');
            return;
        }
        
        createArticlesList(articles);
        
        console.log('\n✓ Done! Articles list updated.');
        console.log('\nFound articles:');
        articles.forEach(a => console.log(`  - ${a.id}`));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Запуск
main();
