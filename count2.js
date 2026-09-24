const fs = require('fs');
const code = fs.readFileSync('admin.html', 'utf8');
const before = code.split('filasHtml += isTermico')[0];
let unescaped = 0;
for (let i = 0; i < before.length; i++) {
    if (before[i] === '`' && before[i-1] !== '\\') {
        unescaped++;
    }
}
console.log(unescaped);
