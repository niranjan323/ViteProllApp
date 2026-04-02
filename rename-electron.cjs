const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'dist-electron');

// Recursively rename all .js files to .cjs
function renameJsFilesRecursive(directory) {
  if (!fs.existsSync(directory)) return;

  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      renameJsFilesRecursive(fullPath);
    } else if (file.endsWith('.js')) {
      // Rename .js to .cjs
      const newPath = fullPath.replace('.js', '.cjs');
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed ${path.relative(dir, fullPath)} to ${path.basename(newPath)}`);
    }
  });
}

renameJsFilesRecursive(dir);

// Fix require statements to include .cjs extension
function fixRequireStatementsRecursive(directory) {
  if (!fs.existsSync(directory)) return;

  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fixRequireStatementsRecursive(fullPath);
    } else if (file.endsWith('.cjs')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Fix require statements for local modules (./services/*, ./*.cjs, etc)
      // Replace require("./services/moduleName") with require("./services/moduleName.cjs")
      content = content.replace(/require\("(\.\/[^"]+)"\)/g, (match, modulePath) => {
        // Don't add .cjs if it already ends with .cjs or is a node_modules package
        if (!modulePath.startsWith('.') || modulePath.includes('node_modules') || modulePath.endsWith('.cjs')) {
          return match;
        }
        // Add .cjs extension for local relative imports
        return `require("${modulePath}.cjs")`;
      });
      
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`Fixed require statements in ${path.relative(dir, fullPath)}`);
    }
  });
}

fixRequireStatementsRecursive(dir);
