const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Asus\\OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023\\Escritorio\\PitiN\\Antigravity\\TorneosDeTenis\\torneosdetenis';

const replacements = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã\x81': 'Á',
    'Ã‰': 'É',
    'Ã\x8D': 'Í',
    'Ã“': 'Ó',
    'Ãš': 'Ú',
    'Ã‘': 'Ñ',
    'Â¿': '¿',
    'Â¡': '¡'
};

function processFolder(folderPath) {
    if (!fs.existsSync(folderPath)) return;
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === '.expo' || file === 'assets') continue;
            processFolder(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            for (const [bad, good] of Object.entries(replacements)) {
                if (content.includes(bad)) {
                    content = content.split(bad).join(good);
                    modified = true;
                }
            }
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    }
}

processFolder(path.join(dir, 'app'));
processFolder(path.join(dir, 'src'));
processFolder(path.join(dir, 'constants'));
