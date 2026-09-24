const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('admin.html', 'utf8');
let js = html.substring(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));
let i = 0;
js = js.replace(/import\s+.*?from\s+.*?;/gs, () => `const dummy_import_${i++} = 1;`);
try {
    new vm.Script(js);
    console.log("V8 parses it perfectly after iframe fix!");
} catch (e) {
    console.error("V8 SYNTAX ERROR:", e);
}
