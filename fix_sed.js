const fs = require('fs');
let code = fs.readFileSync('test4.js', 'utf8');
code = code.replace(/import\s+{[\s\S]*?}\s+from\s+["'][^"']+["'];/g, '');
try {
    require('vm').runInNewContext(code);
    console.log("No syntax errors found.");
} catch(e) {
    console.error(e);
}
