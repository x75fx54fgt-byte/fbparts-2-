const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf-8');

html = html.replace(/<body class="print-body">/g, "<bo" + "dy class=\\"print-body\\">");
html = html.replace(/<\/body>/g, "</bo" + "dy>");
html = html.replace(/<\/html>/g, "</ht" + "ml>");

fs.writeFileSync('admin.html', html);
console.log("Fixed body tags");
