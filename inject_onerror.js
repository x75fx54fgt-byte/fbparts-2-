const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

if (!html.includes('GLOBAL ERROR:')) {
    html = html.replace('<head>', '<head>\n    <script>\n        window.onerror = function(msg, url, line, col, error) {\n            alert("GLOBAL ERROR:\\n" + msg + "\\nLínea: " + line + "\\n" + (error && error.stack ? error.stack : ""));\n        };\n        window.addEventListener("unhandledrejection", function(event) {\n            alert("UNHANDLED PROMISE REJECTION:\\n" + (event.reason && event.reason.message ? event.reason.message : event.reason));\n        });\n    </script>');
    fs.writeFileSync('admin.html', html);
    console.log("Global error handler injected.");
} else {
    console.log("Already injected.");
}
