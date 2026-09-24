const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('admin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });

dom.window.addEventListener('error', (event) => {
    console.error("DOM ERROR:", event.error || event.message);
});

setTimeout(() => {
    console.log("mostrarPestana defined?", typeof dom.window.mostrarPestana);
    process.exit(0);
}, 2000);
