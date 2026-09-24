const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('/Users/bapa/Desktop/web fb parts/admin.html', 'utf8');

// Strip out import statements so JSDOM can execute it as a normal script
let patchedHtml = html.replace(/<script type="module">/g, '<script>').replace(/import\s+.*?;/g, '');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  console.error("JSDOM Error:", error);
});
virtualConsole.on("error", (error) => {
  console.error("Console Error:", error);
});

const dom = new JSDOM(patchedHtml, {
  runScripts: "dangerously",
  virtualConsole
});
console.log("JSDOM initialization complete.");
