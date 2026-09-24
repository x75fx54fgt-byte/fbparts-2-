const fs = require('fs');
const code = fs.readFileSync('admin.html', 'utf8');
const match = code.match(/const htmlTermico = `([\s\S]*?)`;\s*const htmlCarta = `/);
if (match) {
    console.log(match[1].slice(-200));
} else {
    console.log("No match");
}
