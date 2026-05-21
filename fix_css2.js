const fs = require('fs');
let lines = fs.readFileSync('styles.css', 'utf8').split('\n');

// we want to remove lines 555-561
// (0-indexed: 555 to 560)
lines.splice(555, 6); // remove 6 lines starting from index 555

fs.writeFileSync('styles.css', lines.join('\n'));
console.log("Fixed styles.css properly!");
