const fs = require('fs');
const acorn = require('acorn');
try {
  const code = fs.readFileSync('admin.html', 'utf8').split('<script type="module">')[1].split('</script>')[0];
  acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  console.log("PARSE SUCCESS");
} catch (e) {
  console.error("PARSE ERROR:", e);
}
