const fs = require('fs');
const html = fs.readFileSync('admin_original.html', 'utf8');
const start = html.indexOf('window.imprimirCierreMensual = function(formato) {');
const end = html.indexOf('window.cargarHistorialReventas = async function() {');
console.log(html.substring(start, end));
