#!/usr/bin/env node

/**
 * Скрипт для конвертации формул из кодовых блоков в MathJax формат
 * Использование: node scripts/convert-formulas.js <input.md> <output.md>
 */

const fs = require('fs');
const path = require('path');

function convertFormulas(content) {
    // Паттерн для поиска кодовых блоков с формулами
    // Ищем блоки ``` которые содержат математические символы
    const codeBlockRegex = /```\n([\s\S]*?)\n```/g;
    
    let converted = content;
    let match;
    const replacements = [];
    
    // Собираем все совпадения
    while ((match = codeBlockRegex.exec(content)) !== null) {
        const formula = match[1].trim();
        
        // Проверяем, что это формула (содержит математические символы)
        const isFormula = /[=+\-*/^_()\[\]{}|\\∫∑∏√≤≥≠≈∝×÷±αβγδεζηθικλμνξοπρστυφχψωΔ∇∂ℏ]/g.test(formula) ||
                         /[0-9]/.test(formula);
        
        if (isFormula && !formula.includes('```') && formula.length < 500) {
            // Конвертируем в MathJax
            const mathJax = `$$\n${formula}\n$$`;
            replacements.push({
                original: match[0],
                replacement: mathJax,
                formula: formula
            });
        }
    }
    
    // Применяем замены в обратном порядке (чтобы не сбить индексы)
    for (let i = replacements.length - 1; i >= 0; i--) {
        const { original, replacement } = replacements[i];
        converted = converted.replace(original, replacement);
    }
    
    return {
        converted,
        count: replacements.length,
        formulas: replacements.map(r => r.formula)
    };
}

// Главная функция
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node convert-formulas.js <input.md> [output.md]');
        process.exit(1);
    }
    
    const inputPath = args[0];
    const outputPath = args[1] || inputPath;
    
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
    }
    
    console.log(`Reading: ${inputPath}`);
    const content = fs.readFileSync(inputPath, 'utf-8');
    
    console.log('Converting formulas...');
    const result = convertFormulas(content);
    
    console.log(`Found ${result.count} formulas to convert`);
    
    if (result.count > 0) {
        console.log('\nSample formulas:');
        result.formulas.slice(0, 5).forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.substring(0, 60)}...`);
        });
        
        fs.writeFileSync(outputPath, result.converted, 'utf-8');
        console.log(`\n✓ Saved to: ${outputPath}`);
        console.log(`✓ Converted ${result.count} formulas`);
    } else {
        console.log('No formulas found to convert.');
    }
}

main();
