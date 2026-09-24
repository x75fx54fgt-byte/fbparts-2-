const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));

try {
    const acorn = require('acorn');
    acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module' });
    console.log("ACORN PARSED PERFECTLY!");
} catch (e) {
    console.error("ACORN SYNTAX ERROR:", e);
}
