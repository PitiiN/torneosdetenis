const fs = require('fs');
const path = require('path');

const filesToRefactor = [
    'app/(auth)/forgot-password.tsx',
    'app/(admin)/reviews.tsx',
    'app/selection.tsx',
    'app/(tabs)/index.tsx',
    'app/(auth)/register.tsx',
    'app/class/[id].tsx',
    'app/(admin)/payments.tsx',
    'app/(auth)/login.tsx',
    'app/(admin)/classes/create.tsx',
    'app/(admin)/classes/[id].tsx',
    'app/(tabs)/my-classes.tsx',
    'app/(tabs)/payments.tsx',
    'app/(tabs)/profile.tsx'
];

for (const fileRelPath of filesToRefactor) {
    const filePath = path.join('c:/Users/Asus/OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023/Escritorio/PitiN/Antigravity/EscuelaDeTenis', fileRelPath);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('Alert.alert(')) {
        // Replace method call
        content = content.replace(/Alert\.alert\(/g, 'useAlertStore.getState().showAlert(');

        // Ensure import exists
        if (!content.includes('useAlertStore')) {
            // Find the last import statment to safely inject
            const lastImportIndex = content.lastIndexOf('import ');
            const nextNewline = content.indexOf('\n', lastImportIndex);

            content = content.substring(0, nextNewline + 1) +
                `import { useAlertStore } from '@/store/alert.store';\n` +
                content.substring(nextNewline + 1);
        }

        fs.writeFileSync(filePath, content);
        console.log(`Refactored: ${fileRelPath}`);
    }
}
