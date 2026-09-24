const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf8');
const js = html.substring(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));

const lines = js.split('\n');
const cleanJs = lines.filter(line => !line.trim().startsWith('import ')).join('\n');

const window = { addEventListener: () => {} };
const document = { getElementById: () => ({ style: {} }), querySelectorAll: () => [] };
const localStorage = { getItem: () => null, setItem: () => {} };
const navigator = { userAgent: '' };

const auth = {};
const db = {};
const onAuthStateChanged = () => {};
const initializeApp = () => ({});
const getAuth = () => ({});
const getFirestore = () => ({});
const collection = () => {};

try {
    eval(cleanJs);
    process.stdout.write("EVAL OK, mostrarPestana: " + typeof window.mostrarPestana + "\n");
} catch (e) {
    process.stderr.write("RUNTIME ERROR: " + e.stack + "\n");
}
