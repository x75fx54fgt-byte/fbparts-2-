const fs = require('fs');
const lines = fs.readFileSync('admin.html', 'utf8').split('\n');
let count = 0;
for (let i = 2167; i < 8120; i++) {
    const matches = lines[i].match(/`/g);
    if (matches) count += matches.length;
}
console.log(count);
