const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));

try {
    new vm.Script(js);
    console.log("V8 parses it perfectly!");
} catch (e) {
    console.error("V8 SYNTAX ERROR:", e);
}
