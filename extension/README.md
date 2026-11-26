# 📦 Inversiones FB Parts - Rastreador Automático de Guías (Chrome Extension MV3)

Extensión oficial de Google Chrome (Manifest V3) para el rastreo automatizado de guías de encomiendas públicas (**Handling**, **Intercargo**, **RLU**, **Zoom**, **Tealca** y **MRW**) sincronizado en tiempo real con **Firebase Firestore**.

---

## 🚀 Cómo Cargar la Extensión en Google Chrome

1. Abre Google Chrome y escribe en la barra de direcciones:
   ```text
   chrome://extensions
   ```
2. Activa el interruptor **Modo de desarrollador** (esquina superior derecha).
3. Haz clic en el botón **Cargar descomprimida** (Load unpacked).
4. Selecciona la carpeta `extension` ubicada en tu proyecto:
   ```text
   /Users/bapa/Desktop/web fb parts/extension
   ```
5. ¡Listo! Verás el ícono de **F&B Parts** en tu barra de extensiones de Chrome. Fíjalo (Pin) para tener acceso rápido en todo momento.

---

## 🏛️ Estructura de Archivos

```text
extension/
├── manifest.json         # Configuración Manifest V3, permisos y host_permissions
├── background.js         # Service worker: motor de rastreo, Firebase REST y alarmas
├── popup.html            # Interfaz popup con paleta corporativa (#5e8877, #385723)
├── popup.js              # Lógica del popup, actualización en vivo y feed de novedades
├── config/
│   └── carriers.js       # Definición de URLs públicas, selectores y normalizador de estados
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

---

## ⚙️ Características Técnicas

### 1. Motor Híbrido de Consulta Pública (`background.js` + `config/carriers.js`)
- **Modo Pestaña (`modo: 'tab'`)**: Abre la consulta en una pestaña en segundo plano (`active: false`), espera a que la página SPA cargue su JavaScript dinámico, extrae el texto del DOM con `chrome.scripting.executeScript` y cierra la pestaña en un bloque `finally` para no dejar pestañas abiertas.
- **Pausa de Cortesía de 2 Segundos**: Entre cada consulta se aplica un retraso de 2.000 ms para no saturar los servidores de las encomiendas ni activar bloqueos por rate-limiting.

### 2. Normalizador de Estatus (5 Estados Estándar)
Clasifica las respuestas de los portales en:
- `ENTREGADO`: Confirmado recibido / entregado en destino.
- `LISTO_RETIRO`: En oficina de encomienda listo para retiro en taquilla.
- `EN_TRANSITO`: En ruta, transferido o en centro de acopio.
- `NOVEDAD`: Problema de dirección, retención, siniestro o avería.
- `VERIFICAR_MANUAL`: Requiere Captcha, verificación humana o respuesta no concluyente.

### 3. Regla Multi-Guía / Multi-Bulto
- Cada pedido puede tener múltiples bultos en su arreglo `guiasEnvio[]`.
- El rastreador actualiza el estatus individual de cada bulto.
- **Regla Estricta**: El pedido solo se marca globalmente como **`Entregado`** en Firebase cuando **todas** sus guías alcanzan el estatus `ENTREGADO`.
- Al completarse, lanza una notificación nativa de Chrome con el cliente y número de bultos.

### 4. Chequeo Automático Diario (`chrome.alarms`)
- Programa dos ejecuciones automáticas diarias:
  - **9:00 AM**
  - **3:00 PM**
- Cuenta con un interruptor (switch) en el popup para activar o pausar la automatización cuando se desee.

### 5. Resolución Rápida de Captchas
- Si una agencia solicita Captcha o Cloudflare Turnstile, la guía se cataloga como `VERIFICAR_MANUAL` y el popup muestra un botón directo **`🔍 Resolver / Ver en Portal`** para que el operador lo abra en una pestaña activa con un solo clic.

---

## 🛠️ Personalización de Agencias en `config/carriers.js`

Si alguna agencia cambia de dominio o requiere selectores específicos, puedes editar `config/carriers.js`:

```javascript
handling: {
    id: 'handling',
    nombre: 'Handling (Principal)',
    urlTemplate: 'https://grupohandling.com/rastreo?guia={GUIA}',
    modo: 'tab',
    waitMs: 2500
}
```
Al guardar el cambio, simplemente pulsa el botón **Recargar (⟳)** en `chrome://extensions`.
