import re

with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate where to inject `window.calcularGananciaNetaDashboard`
# I'll inject it just before `window.cargarDashboard = async function() {`

func_html = """
        window.calcularGananciaNetaDashboard = async function(tasaBCV, tasaEUR) {
            try {
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                
                const reventasSnap = await getDocs(collection(db, "reventas_gastos"));
                let totalGananciaNetaUSD = 0;
                
                reventasSnap.forEach(docSnap => {
                    const rev = docSnap.data();
                    if (rev.fecha) {
                        const dateParts = rev.fecha.split('/'); 
                        if (dateParts.length >= 3) {
                            const month = parseInt(dateParts[1], 10);
                            const year = parseInt(dateParts[2].split(' ')[0], 10);
                            if (month === currentMonth && year === currentYear) {
                                totalGananciaNetaUSD += (parseFloat(rev.gananciaNetaEmpresa) || 0);
                            }
                        }
                    }
                });
                
                document.getElementById('dash-ganancia-usd').textContent = totalGananciaNetaUSD.toFixed(2);
                document.getElementById('dash-ganancia-ves').textContent = (totalGananciaNetaUSD * tasaBCV).toFixed(2);
                document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD / tasaEUR).toFixed(2);
            } catch (e) {
                console.error("Error calculando ganancia neta:", e);
                document.getElementById('dash-ganancia-usd').textContent = "0.00";
            }
        };

        window.cargarDashboard = async function() {"""

content = content.replace("        window.cargarDashboard = async function() {", func_html)

# Inject call at the end of cargarDashboard
call_html = """                });

                if (window.calcularGananciaNetaDashboard) {
                    await window.calcularGananciaNetaDashboard(tasaVivaBCV, tasaVivaEUR);
                }

            } catch """

content = content.replace("                });\n\n            } catch ", call_html)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done JS injection.")
