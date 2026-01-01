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
 * Поддерживает как плоскую, так и древовидную структуру
 */
function createArticlesList(articles) {
    // Создаем древовидную структуру на основе папок
    const tree = buildCategoryTree(articles);
    
    const articlesList = {
        structure: "tree",
        version: "2.0",
        lastUpdated: new Date().toISOString(),
        categories: tree.categories,
        // Для обратной совместимости сохраняем плоский список
        articles: articles,
        count: articles.length
    };
    
    // Сохраняем с отступами
    const jsonContent = JSON.stringify(articlesList, null, 2);
    fs.writeFileSync(ARTICLES_LIST_PATH, jsonContent, 'utf-8');
    
    console.log(`\n✓ Created articles/articles-list.json with ${articles.length} articles`);
    console.log(`  Structure: tree with ${tree.categories.length} top-level categories`);
}

/**
 * Построение древовидной структуры категорий на основе путей статей
 */
function buildCategoryTree(articles) {
    const categories = [];
    const categoryMap = new Map(); // Для быстрого поиска категорий
    
    // Группируем статьи по категориям из метаданных или пути
    articles.forEach(article => {
        // Пытаемся извлечь категорию из frontmatter
        let categoryId = null;
        let categoryTitle = null;
        
        try {
            const mdPath = path.join(ARTICLES_DIR, article.mdFile.replace('articles/', ''));
            if (fs.existsSync(mdPath)) {
                const content = fs.readFileSync(mdPath, 'utf-8');
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
                if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const categoryMatch = frontmatter.match(/^category:\s*(.+)$/m);
                    if (categoryMatch) {
                        categoryId = categoryMatch[1].trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
                        categoryTitle = categoryMatch[1].trim();
                    }
                }
            }
        } catch (error) {
            // Игнорируем ошибки
        }
        
        // Если категория не найдена, используем путь
        if (!categoryId) {
            const pathParts = article.mdFile.split('/');
            if (pathParts.length > 2) {
                // articles/category/article.md
                categoryId = pathParts[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
                categoryTitle = pathParts[1].replace(/[_-]/g, ' ');
            } else {
                categoryId = 'uncategorized';
                categoryTitle = 'Без категории';
            }
        }
        
        // Находим или создаем категорию
        let category = categoryMap.get(categoryId);
        if (!category) {
            category = {
                id: categoryId,
                title: categoryTitle,
                description: '',
                icon: getCategoryIcon(categoryId),
                order: getCategoryOrder(categoryId),
                items: []
            };
            categoryMap.set(categoryId, category);
            categories.push(category);
        }
        
        // Добавляем статью в категорию
        category.items.push({
            type: 'article',
            id: article.id,
            mdFile: article.mdFile,
            order: 0
        });
    });
    
    // Сортируем категории по order
    categories.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
    });
    
    // Сортируем статьи внутри категорий
    categories.forEach(category => {
        category.items.sort((a, b) => {
            if (a.type !== b.type) {
                // Категории идут первыми
                return a.type === 'category' ? -1 : 1;
            }
            return (a.order || 0) - (b.order || 0);
        });
    });
    
    return { categories };
}

/**
 * Получение иконки для категории по её ID
 */
function getCategoryIcon(categoryId) {
    const iconMap = {
        'cosmology': '🌌',
        'quantum-physics': '⚛️',
        'quantum': '⚛️',
        'vacuum-energy': '⚡',
        'vacuum': '⚡',
        'physics': '🔬',
        'mathematics': '📐',
        'test': '🧪',
        'uncategorized': '📁'
    };
    
    return iconMap[categoryId] || '📁';
}

/**
 * Получение порядка категории по её ID
 */
function getCategoryOrder(categoryId) {
    const orderMap = {
        'cosmology': 1,
        'quantum-physics': 2,
        'quantum': 2,
        'vacuum-energy': 3,
        'vacuum': 3,
        'physics': 4,
        'mathematics': 5,
        'test': 99,
        'uncategorized': 999
    };
    
    return orderMap[categoryId] || 999;
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
