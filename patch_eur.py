with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """            const renderMonedas = (montoUSD) => {
                const ves = (montoUSD * tasaVES).toFixed(2);
                const eur = (montoUSD / tasaEUR).toFixed(2);
                return `$${montoUSD.toFixed(2)} | Bs.${ves} | €${eur}`;
            };"""

replacement1 = """            const renderMonedas = (montoUSD) => {
                const ves = (montoUSD * tasaVES).toFixed(2);
                let eurMonto = 0;
                if (tasaEUR > 10) {
                    eurMonto = montoUSD * 0.92;
                } else {
                    eurMonto = montoUSD * tasaEUR;
                }
                const eur = eurMonto.toFixed(2);
                return `$${montoUSD.toFixed(2)} | Bs.${ves} | €${eur}`;
            };"""

target2 = """                document.getElementById('dash-ganancia-ves').textContent = (totalGananciaNetaUSD * tasaBCV).toFixed(2);
                document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD / tasaEUR).toFixed(2);"""

replacement2 = """                document.getElementById('dash-ganancia-ves').textContent = (totalGananciaNetaUSD * tasaBCV).toFixed(2);
                if (tasaEUR > 10) {
                    document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD * 0.92).toFixed(2);
                } else {
                    document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD * tasaEUR).toFixed(2);
                }"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced 1")
if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced 2")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
