const fs = require('fs');
const content = fs.readFileSync('admin.html', 'utf8');
const match = content.match(/<script type="module">([\s\S]*?)<\/script>/);
if (match) {
    fs.writeFileSync('test_syntax.js', match[1]);
}
