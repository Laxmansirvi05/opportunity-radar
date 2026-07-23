const fs = require('fs');
const text = fs.readFileSync('full_text.txt', 'utf8');
const reversed = text.split('\n').reverse().join('\n');
console.log(reversed);
