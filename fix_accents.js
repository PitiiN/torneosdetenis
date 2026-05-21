const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const accentsMap = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
  // 'ñ': 'n', 'Ñ': 'N' // Usually ñ is fine, but if we want to be strictly ASCII
};

function removeAccents(str) {
  return str.split('').map(char => accentsMap[char] || char).join('');
}

const assetsDir = path.join(__dirname, 'assets');
const srcDir = path.join(__dirname, 'src');
const appDir = path.join(__dirname, 'app');

let renamedMap = [];

function processDirFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirFiles(fullPath);
    } else {
      const newName = removeAccents(file);
      if (newName !== file) {
        const newPath = path.join(dir, newName);
        console.log(`Renaming: ${file} -> ${newName}`);
        
        // Use git mv if possible, else fs.renameSync
        try {
          execSync(`git mv "${fullPath}" "${newPath}"`);
        } catch(e) {
          fs.renameSync(fullPath, newPath);
        }
        
        renamedMap.push({ old: file, new: newName });
      }
    }
  }
}

function processSourceFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processSourceFiles(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { old, new: newName } of renamedMap) {
        // Replace occurrences of old filename
        if (content.includes(old)) {
          content = content.split(old).join(newName);
          changed = true;
        }
      }
      if (changed) {
        console.log(`Updated references in: ${fullPath}`);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

console.log("Renaming files...");
processDirFiles(assetsDir);

console.log("Updating source files...");
processSourceFiles(srcDir);
processSourceFiles(appDir);

console.log("Done.");
