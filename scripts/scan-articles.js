#!/usr/bin/env node

/**
 * Скрипт для автоматического сканирования статей и обновления config.json
 * Использование: node scripts/scan-articles.js
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'articles');
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

/**
 * Сканирует директорию articles/ и находит все article.md файлы
 */
function scanArticles() {
    const articles = [];
    
    // Читаем содержимое папки articles
    const entries = fs.readdirSync(ARTICLES_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
        // Пропускаем не-директории и README
        if (!entry.isDirectory() || entry.name === 'README.md') {
            continue;
        }
        
        const articleDir = path.join(ARTICLES_DIR, entry.name);
        const articleFile = path.join(articleDir, 'article.md');
        
        // Проверяем наличие article.md
        if (fs.existsSync(articleFile)) {
            const relativePath = `articles/${entry.name}/article.md`;
            
            articles.push({
                id: entry.name,
                mdFile: relativePath
            });
            
            console.log(`✓ Found article: ${entry.name}`);
        } else {
            console.warn(`⚠ Skipping ${entry.name}: no article.md found`);
        }
    }
    
    return articles;
}

/**
 * Обновляет config.json с найденными статьями
 */
function updateConfig(articles) {
    // Читаем текущий config
    const configText = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configText);
    
    // Обновляем секцию articles
    config.articles = articles;
    
    // Сохраняем с отступами
    const updatedConfig = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, updatedConfig, 'utf-8');
    
    console.log(`\n✓ Updated config.json with ${articles.length} articles`);
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
        
        updateConfig(articles);
        
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
