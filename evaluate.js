const fs = require('fs');
const code = fs.readFileSync('admin.html', 'utf8');

// We extract just the definition of htmlTermico and htmlCarta
const termicoMatch = code.match(/const htmlTermico = `([\s\S]*?)`;\s*const htmlCarta = `([\s\S]*?)`;/);
if (termicoMatch) {
    console.log("TERMICO START");
    console.log(termicoMatch[1].slice(0, 50));
    console.log("TERMICO END");
    console.log(termicoMatch[1].slice(-50));
} else {
    console.log("Not found");
}
