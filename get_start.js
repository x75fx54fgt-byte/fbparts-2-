const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('<script type="module">') + 22, html.indexOf('onAuthStateChanged('));
console.log(js);
