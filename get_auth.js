const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('onAuthStateChanged('), html.indexOf('window.cargarDashboard = async'));
console.log(js);
