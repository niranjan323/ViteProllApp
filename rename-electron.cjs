const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'dist-electron');

if (fs.existsSync(dir)) {
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.js')) {
      const oldPath = path.join(dir, file);
      const newPath = path.join(dir, file.replace('.js', '.cjs'));
      fs.renameSync(oldPath, newPath);
      console.log(`Renamed ${file} to ${path.basename(newPath)}`);
    }
  });
}
