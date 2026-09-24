const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// 1. Replace runSafe to alert errors
html = html.replace(/console\.error\("Error al ejecutar " \+ fnName \+ ":", e\);/g, 
    'console.error("Error al ejecutar " + fnName + ":", e); alert("Error en " + fnName + ": " + e.message);');

// 2. Completely replace window.imprimirCierreMensual and window.cargarHistorialFacturas
const startIdx = html.indexOf('window.cargarHistorialFacturas = async function() {');
const endIdx = html.indexOf('window.cargarHistorialReventas = async function() {');
if (startIdx === -1 || endIdx === -1) throw new Error("Could not find functions");

const newFunctions = `
        window.cargarHistorialFacturas = async function() {
            try {
                // ... just keep it, we only need to change imprimirCierreMensual
                // Wait, no, we can just replace the whole block if we want.
                // Actually, let's just replace window.imprimirCierreMensual
            } catch(e) {}
        }
`;
