with open('admin.html', 'r') as f:
    content = f.read()

card_html = """
                    <!-- TARJETA 5: GANANCIA NETA -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-1 h-full bg-brandDark"></div>
                        <div class="flex items-start justify-between mb-4">
                            <div class="w-12 h-12 rounded-full bg-brandDark/10 flex items-center justify-center">
                                <i class="fas fa-wallet text-brandDark text-xl"></i>
                            </div>
                            <span class="text-xs font-semibold px-2 py-1 bg-brandDark/10 text-brandDark rounded-md">Mes Actual</span>
                        </div>
                        <div>
                            <h4 class="text-gray-500 text-sm font-medium mb-1">Ganancia Neta</h4>
                            <div class="text-3xl font-bold text-gray-900 mb-1">$<span id="dash-ganancia-usd">0.00</span></div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-50 flex justify-between text-xs text-gray-500 font-medium">
                            <span class="flex flex-col"><span>VES</span> <b id="dash-ganancia-ves" class="text-gray-800 mt-0.5">0.00</b></span>
                            <span class="flex flex-col"><span>EUR</span> <b id="dash-ganancia-eur" class="text-gray-800 mt-0.5">0.00</b></span>
                        </div>
                    </div>
"""

target = "                        </div>\n                    </div>\n                </div>\n\n                <div class=\"card-form\">"

if target in content:
    new_content = content.replace(target, "                        </div>\n                    </div>\n" + card_html + "                </div>\n\n                <div class=\"card-form\">")
    with open('admin.html', 'w') as f:
        f.write(new_content)
    print("Success")
else:
    print("Target not found")
