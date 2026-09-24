const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));

// Create a mock window environment
const vm = require('vm');
const sandbox = {
    window: {},
    document: {
        getElementById: () => ({ style: {}, textContent: '', classList: { add: ()=>{}, remove: ()=>{} }, addEventListener: ()=>{} }),
        querySelectorAll: () => [],
        addEventListener: () => {},
        readyState: 'complete'
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    console: console,
    setTimeout: setTimeout,
    Promise: Promise,
    // mock firebase imports
    initializeApp: () => ({}),
    getAuth: () => ({ onAuthStateChanged: () => {} }),
    getFirestore: () => ({}),
    onAuthStateChanged: () => {},
    // ... we can just run the top level logic by replacing imports
};
sandbox.window = sandbox;

let jsClean = js.replace(/import\s+.*?from\s+.*?;/gs, '');
try {
    vm.runInNewContext(jsClean, sandbox);
    console.log("Top-level executed perfectly!");
} catch (e) {
    console.error("RUNTIME ERROR AT TOP LEVEL:", e);
}
