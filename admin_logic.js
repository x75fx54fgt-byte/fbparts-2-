import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { getFirestore, collection, getDocs, getDoc, setDoc, addDoc, doc, updateDoc, deleteDoc, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

        // 🤫 Silenciar banner promocional de Puter.js en consola
        if (typeof puter !== 'undefined') puter.quiet = true;

        // ==========================================
        // 🛡️ MÓDULO DE SANITIZACIÓN AUTÓNOMO (INLINE PARA COMPATIBILIDAD TOTAL)
        // ==========================================
        const SecuritySanitizer = {
            escapeHtml(val) {
                if (val === null || val === undefined) return '';
                return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            },
            cleanText(val, maxLen = 250) {
                if (!val) return '';
                return String(val).replace(/<[^>]*>?/gm, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, maxLen);
            },
            cleanAddress(val, maxLen = 300) {
                if (!val) return '';
                return String(val).replace(/<[^>]*>?/gm, '').replace(/javascript:/gi, '').replace(/vbscript:/gi, '').replace(/data:text\/html/gi, '').trim().slice(0, maxLen);
            },
            cleanNote(val, maxLen = 600) {
                if (!val) return '';
                let cleaned = String(val)
                    .replace(/<[^>]*>?/gm, '')
                    .replace(/javascript:/gi, '')
                    .trim();
                return cleaned.slice(0, maxLen);
            },
            cleanPhone(val) {
                if (!val) return '';
                return String(val).replace(/[^0-9+\s\-()]/g, '').trim().slice(0, 30);
            },
            sanitizeAmount(val) {
                if (val === null || val === undefined) return 0;
                let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                if (isNaN(num) || !isFinite(num) || num < 0) return 0;
                return Math.round(num * 100) / 100;
            },
            sanitizeInt(val, defaultVal = 1) {
                let num = parseInt(val, 10);
                return isNaN(num) || num < 1 ? defaultVal : num;
            },
            formatImageUrl(val, maxLen = 1000) {
                if (!val) return '';
                let cleanUrl = String(val).trim();
                // Detectar cualquier enlace compartido de Google Drive y convertirlo a CDN directo
                // Formatos: /file/d/ID/view, /open?id=ID, /uc?id=ID, docs.google.com/file/d/ID, etc.
                const driveMatch = cleanUrl.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/|[?&]id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
                if (driveMatch && driveMatch[1]) {
                    cleanUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
                } else if (cleanUrl.includes('dropbox.com')) {
                    if (cleanUrl.includes('?dl=0')) cleanUrl = cleanUrl.replace('?dl=0', '?raw=1');
                    else if (cleanUrl.includes('&dl=0')) cleanUrl = cleanUrl.replace('&dl=0', '&raw=1');
                    else if (!cleanUrl.includes('raw=1')) cleanUrl += (cleanUrl.includes('?') ? '&raw=1' : '?raw=1');
                }
                return this.cleanText(cleanUrl, maxLen);
            }
        };

        // ==========================================
        // 🖼️ UTILIDADES GLOBALES DE IMÁGENES (DRIVE, DROPBOX, HTTPS)
        // ==========================================
        window.normalizarUrlImagen = function(val) {
            if (!val || typeof val !== 'string') return '';
            return SecuritySanitizer.formatImageUrl(val, 1000);
        };

        window.obtenerGoogleDriveId = function(val) {
            if (!val || typeof val !== 'string') return null;
            const cleanUrl = String(val).trim();
            const m = cleanUrl.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/|[?&]id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
            return m ? m[1] : null;
        };

        window.verificarCargaImagen = function(url, statusElementId, callback) {
            const el = document.getElementById(statusElementId);
            if (!url || !url.trim()) {
                if (el) el.innerHTML = '';
                if (callback) callback(false);
                return;
            }
            const clean = url.trim();
            const normalizada = window.normalizarUrlImagen(clean);
            const driveId = window.obtenerGoogleDriveId(clean);
            const esDrive = Boolean(driveId || clean.includes('drive.google.com') || clean.includes('docs.google.com'));

            if (el) {
                el.innerHTML = `<span style="color: #64748b; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;"><i class="fas fa-spinner fa-spin text-emerald-600"></i> Verificando conexión de imagen...</span>`;
            }

            const testImg = new Image();
            let finalizado = false;

            testImg.onload = function() {
                if (finalizado) return;
                finalizado = true;
                if (el) {
                    const tag = esDrive ? ' <span style="background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">Google Drive OK</span>' : '';
                    el.innerHTML = `<span style="color: #166534; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px;"><i class="fas fa-check-circle"></i> Imagen lista para mostrar (${testImg.naturalWidth}x${testImg.naturalHeight}px)${tag}</span>`;
                }
                if (callback) callback(true, normalizada);
            };

            testImg.onerror = function() {
                if (finalizado) return;
                if (driveId && !testImg.dataset.triedThumbnail) {
                    testImg.dataset.triedThumbnail = '1';
                    testImg.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1920`;
                    return;
                }
                finalizado = true;
                if (el) {
                    if (esDrive) {
                        el.innerHTML = `
                            <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 6px 10px; border-radius: 6px; margin-top: 4px; font-size: 11.5px; line-height: 1.35;">
                                <div><i class="fas fa-exclamation-triangle"></i> <strong>Aviso de Google Drive:</strong> No se pudo cargar la foto.</div>
                                <div style="margin-top: 3px; color: #7f1d1d; font-size: 11px;">
                                    Asegúrate de que en Google Drive el archivo tenga <strong>Acceso General: "Cualquier persona con el enlace"</strong> (Modo Lector).
                                </div>
                            </div>`;
                    } else {
                        el.innerHTML = `<span style="color: #ef4444; font-size: 11.5px;"><i class="fas fa-exclamation-circle"></i> No se pudo cargar la imagen desde este enlace. Revisa que sea una URL pública y directa.</span>`;
                    }
                }
                if (callback) callback(false, normalizada);
            };

            testImg.src = normalizada;
        };

        // ==========================================
        // 🚀 CONFIGURACIÓN DE APIS Y BASES DE DATOS
        // ==========================================
        
        const firebaseConfig = {
            apiKey: "AIzaSyC9bOFYHL68yoksRU9G2dwLSxCfMrSW-ew",
            authDomain: "fb-parts-app.firebaseapp.com",
            projectId: "fb-parts-app",
            storageBucket: "fb-parts-app.firebasestorage.app",
            messagingSenderId: "21714159445",
            appId: "1:21714159445:web:8f4946cd1c98d9b95dd1dc"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);

        // Variables Locales de Memoria
        window.storage = storage;
        window.storageRef = storageRef;
        window.uploadBytes = uploadBytes;
        window.getDownloadURL = getDownloadURL;
        window.SecuritySanitizer = SecuritySanitizer;
        window.mapaCategorias = {};
        window.clientesDBLocal = {}; 
        window.pedidosDBLocal = {}; 
        window.facturasDBLocal = {}; 
        window.cotizacionesDBLocal = {}; 
        window.importacionesDBLocal = {}; 
        window.productosDBLocal = {};
        window.currentAdminDocId = null; 
        
        let salesChartInstance = null; 

        // ==========================================
        // GESTIÓN DE SESIÓN Y PERFIL (DEFENSIVO Y RESILIENTE)
        // ==========================================
        function verificarSesionAdminLocal() {
            try {
                const raw = localStorage.getItem('fyb_admin_session');
                if (!raw) return null;
                const s = JSON.parse(raw);
                const esAdmin = (s.email === 'fybinversiones.ccs@gmail.com' || s.email === 'admin@fybparts.com');
                const esReciente = (Date.now() - (s.timestamp || 0)) < (14 * 24 * 3600 * 1000);
                if (esAdmin && esReciente) return s;
            } catch(e) {}
            return null;
        }

        function desbloquearPanelAdmin(nombre = "Administrador", cargo = "Control Maestro") {
            const loadingScreen = document.getElementById('auth-loading-screen');
            const appWrapper = document.getElementById('app-wrapper');
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (appWrapper) appWrapper.style.display = 'flex'; // <--- FIX: Usar flex en lugar de block

            const elNombre = document.getElementById('admin-nombre-txt');
            const elCargo = document.getElementById('admin-cargo-txt');
            if (elNombre && (!elNombre.textContent || elNombre.textContent.includes('...'))) {
                elNombre.textContent = SecuritySanitizer.cleanText(nombre, 50);
            }
            if (elCargo && (!elCargo.textContent || elCargo.textContent.includes('...'))) {
                elCargo.textContent = SecuritySanitizer.cleanText(cargo, 50);
            }

            if (typeof window.iniciarPanelCompleto === 'function') {
                window.iniciarPanelCompleto();
            }
        }

        // 1. Verificación inmediata de sesión administrativa local (desbloqueo instantáneo)
        const sesionInmediata = verificarSesionAdminLocal();
        if (sesionInmediata) {
            desbloquearPanelAdmin("BAPA", "Administrador Maestro");
        }

        // 2. Monitoreo defensivo de Firebase Auth
        onAuthStateChanged(auth, async (user) => {
            const sesionLocal = verificarSesionAdminLocal();

            if (user) {
                const userEmail = (user.email || '').toLowerCase().trim();
                
                // Actualizar o respaldar sesión en almacenamiento local
                if (userEmail === 'fybinversiones.ccs@gmail.com' || userEmail === 'admin@fybparts.com') {
                    try {
                        localStorage.setItem('fyb_admin_session', JSON.stringify({
                            email: userEmail,
                            localId: user.uid,
                            timestamp: Date.now()
                        }));
                    } catch(e) {}
                    
                    if (!sessionStorage.getItem('audit_login_done')) {
                        sessionStorage.setItem('audit_login_done', 'true');
                        setTimeout(() => { if(window.registrarAuditoria) window.registrarAuditoria("LOGIN", "El usuario inició sesión en el panel."); }, 2000);
                    }
                    
                    desbloquearPanelAdmin("BAPA", "Administrador Maestro");
                }

                // Cargar datos personalizados de la colección 'administradores' sin bloquear la interfaz
                try {
                    const q = query(collection(db, "administradores"), where("email", "==", userEmail));
                    const querySnapshot = await Promise.race([
                        getDocs(q),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
                    ]);

                    if (!querySnapshot.empty) {
                        const adminDoc = querySnapshot.docs[0];
                        window.currentAdminDocId = adminDoc.id;
                        const adminData = adminDoc.data();

                        const nombreAdmin = adminData.Nombre || adminData['Nombre:'] || "BAPA";
                        const cargoAdmin = adminData.Cargo || adminData['Cargo:'] || "Administrador";

                        document.getElementById('admin-nombre-txt').textContent = SecuritySanitizer.cleanText(nombreAdmin, 50);
                        document.getElementById('admin-cargo-txt').textContent = SecuritySanitizer.cleanText(cargoAdmin, 50);
                        
                        const defaultAvatar = "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png";
                        let fotoValida = defaultAvatar;
                        if (adminData.Foto && adminData.Foto.trim() !== "") {
                            const fotoTrim = adminData.Foto.trim();
                            if (fotoTrim === "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png" || fotoTrim.endsWith('~mv2.png')) {
                                fotoValida = defaultAvatar;
                            } else {
                                fotoValida = fotoTrim;
                            }
                        }
                        const avatarEl = document.getElementById('admin-avatar');
                        if (avatarEl) {
                            avatarEl.src = fotoValida;
                            avatarEl.onerror = function() {
                                this.onerror = null;
                                this.src = defaultAvatar;
                            };
                        }
                    }
                } catch (e) {
                    console.warn("Aviso: Datos de perfil cargados con valores por defecto.");
                }

                desbloquearPanelAdmin();
                return;
            }

            // Si Firebase Auth aún no sincroniza pero existe una sesión administrativa activa local:
            if (sesionLocal) {
                desbloquearPanelAdmin("BAPA", "Administrador Maestro");
            }

            // Margen de gracia defensivo de 4 segundos para que Firebase Auth reaccione
            setTimeout(() => {
                if (!auth.currentUser) {
                    console.error("Sesión de Firebase expirada o no válida. Forzando cierre de sesión.");
                    try { localStorage.removeItem('fyb_admin_session'); } catch(e){}
                    window.location.href = "admin-login.html";
                }
            }, 4000);
        });

        window.cerrarSesion = function() {
            if(confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                if(window.registrarAuditoria) window.registrarAuditoria("LOGOUT", "El usuario cerró sesión en el panel.");
                try {
                    localStorage.removeItem('fyb_admin_session');
                } catch(e) {}
                signOut(auth).then(() => {
                    window.location.href = "admin-login.html";
                }).catch(() => {
                    window.location.href = "admin-login.html";
                });
            }
        };

        window.abrirModalPerfil = async function() {
            if (!window.currentAdminDocId) { alert("Cargando, intenta de nuevo."); return; }
            document.getElementById('edit-admin-nombre').value = document.getElementById('admin-nombre-txt').textContent;
            document.getElementById('edit-admin-cargo').value = document.getElementById('admin-cargo-txt').textContent;
            const fotoActual = document.getElementById('admin-avatar').src;
            const defaultAvatar = "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png";
            document.getElementById('edit-admin-foto').value = (fotoActual.includes('mv2.png') || fotoActual === defaultAvatar) ? '' : fotoActual;
            document.getElementById('modal-admin-perfil').style.display = 'flex';
        };

        window.cerrarModalPerfil = function() { document.getElementById('modal-admin-perfil').style.display = 'none'; };

        window.guardarPerfilAdmin = async function() {
            const btn = document.getElementById('btn-save-admin-perfil');
            const nuevoNombre = document.getElementById('edit-admin-nombre').value.trim();
            const nuevaFoto = document.getElementById('edit-admin-foto').value.trim();
            if (!window.currentAdminDocId) return;

            btn.innerHTML = "Guardando..."; btn.disabled = true;
            const defaultAvatar = "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png";
            const fotoParaGuardar = (!nuevaFoto || nuevaFoto.endsWith('~mv2.png')) ? defaultAvatar : nuevaFoto;
            try {
                await updateDoc(doc(db, "administradores", window.currentAdminDocId), { Nombre: nuevoNombre, Foto: fotoParaGuardar });
                document.getElementById('admin-nombre-txt').textContent = nuevoNombre;
                const avatarEl = document.getElementById('admin-avatar');
                if (avatarEl) {
                    avatarEl.src = fotoParaGuardar;
                    avatarEl.onerror = function() {
                        this.onerror = null;
                        this.src = defaultAvatar;
                    };
                }
                alert("¡Perfil actualizado con éxito!");
                window.cerrarModalPerfil();
            } catch (error) { console.error(error); }
            btn.innerHTML = "Guardar Cambios"; btn.disabled = false;
        };

        window.mostrarPestana = function(id, btnElement) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('tab-' + id).classList.add('active');
            btnElement.classList.add('active');

            if(id === 'dashboard') { 
                window.cargarDashboard(); 
                if (window.renderizarGrafico3DPlotly) {
                    setTimeout(() => window.renderizarGrafico3DPlotly(), 100);
                }
            }
            if(id === 'finanzas') { window.cargarFinanzas(); }
            if(id === 'pedidos') { window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos(); }
            if(id === 'catalogo') { window.cargarCatalogoAdmin(); }
            if(id === 'clientes') { 
                if (window.cambiarSubtabClientes) {
                    window.cambiarSubtabClientes(window._subtabClientesActiva || 'db');
                } else {
                    window.cargarBaseClientes();
                }
            }
            if(id === 'cotizaciones') { window.cargarBaseClientes(); window.actualizarPreview(); }
            if(id === 'historial-cotizaciones') { window.cargarHistorialCotizaciones(); }
            if(id === 'facturacion') { window.cargarBaseClientes(); window.actualizarPreviewFactura(); }
            if(id === 'historial-facturas') { window.cargarHistorialFacturas(); }
            if(id === 'importacion') { 
                window.cargarHistorialImportaciones(); 
                if (window.cambiarSubtabLanded) {
                    window.cambiarSubtabLanded('intl');
                } else if (window.calcularLandedCost) {
                    window.calcularLandedCost();
                }
            }
            if(id === 'reventas') { window.cargarHistorialReventas(); if(window.actualizarEstadoModoBsReventas) window.actualizarEstadoModoBsReventas(); }
            if(id === 'rutas') { setTimeout(() => { window.iniciarMapaAdmin(); window.cargarPuntosRuta(); window.cargarSelectorPedidosRuta(); }, 200); }
            if(id === 'brochure') { window.abrirModalBrochure(); }
            if(id === 'web-destacados') { window.cargarWebBanners(); window.cargarWebDestacados(); }
        };

        // ==========================================
        // 🚀 DASHBOARD Y MÉTRICAS (CONECTADO A MAKE BCV/EUR)
        // ==========================================

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
                                totalGananciaNetaUSD += (parseFloat(rev.gananciaNetaUSD) || 0);
                            }
                        }
                    }
                });
                
                document.getElementById('dash-ganancia-usd').textContent = totalGananciaNetaUSD.toFixed(2);
                document.getElementById('dash-ganancia-ves').textContent = (totalGananciaNetaUSD * tasaBCV).toFixed(2);
                if (tasaEUR > 10) {
                    document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD * 0.92).toFixed(2);
                } else {
                    document.getElementById('dash-ganancia-eur').textContent = (totalGananciaNetaUSD * tasaEUR).toFixed(2);
                }
            } catch (e) {
                console.error("Error calculando ganancia neta:", e);
                document.getElementById('dash-ganancia-usd').textContent = "0.00";
            }
        };

        window.cargarDashboard = async function() {
            try {
                // 1. CÁLCULO DE INVENTARIO
                const prodSnap = await getDocs(collection(db, "productos"));
                let valorInventario = 0;
                const repuestosUnicos = new Set(); 

                prodSnap.forEach(docSnap => {
                    const p = docSnap.data();
                    if(p.estado !== 'inactivo') {
                        const idUnico = (p.numero_parte && p.numero_parte.trim() !== '') ? p.numero_parte.trim().toUpperCase() : p.nombre.trim().toUpperCase();
                        if (!repuestosUnicos.has(idUnico)) {
                            valorInventario += (parseFloat(p.precio) || 0) * (parseInt(p.stock) || 0);
                            repuestosUnicos.add(idUnico);
                        }
                    }
                });
                document.getElementById('dash-inventario').textContent = `$${valorInventario.toFixed(2)}`;

                // 🔥 2. LEER TASAS EN VIVO DESDE MAKE (Carpeta configuracion)
                let tasaVivaBCV = 42.00; // Respaldo por si Make falla
                let tasaVivaEUR = 1.08;
                try {
                    const bcvSnap = await getDoc(doc(db, "configuracion", "tasa_bcv"));
                    if(bcvSnap.exists()) {
                        // Toma 'Valor' o 'valor' según como lo escriba Make
                        tasaVivaBCV = parseFloat(bcvSnap.data().Valor) || parseFloat(bcvSnap.data().valor) || tasaVivaBCV;
                    }
                    const eurSnap = await getDoc(doc(db, "configuracion", "tasa_euro"));
                    if(eurSnap.exists()) {
                        tasaVivaEUR = parseFloat(eurSnap.data().Valor) || parseFloat(eurSnap.data().valor) || tasaVivaEUR;
                    }
                } catch(e) { console.warn("Error leyendo tasas de Make"); }

                // 3. CÁLCULO DE VENTAS Y CXC
                const facSnap = await getDocs(collection(db, "facturas"));
                
                let vMesUnificadoUSD = 0; 
                let vMesUSD = 0, vMesVES = 0, vMesEUR = 0;
                let cxcTotalUSD = 0, cxcUSD = 0, cxcVES = 0, cxcEUR = 0;
                
                const ventasPorMes = {};
                const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                const fechaHoy = new Date();
                const mesActual = fechaHoy.getMonth(); 
                const anioActual = fechaHoy.getFullYear();

                for (let i = 5; i >= 0; i--) {
                    let d = new Date(anioActual, mesActual - i, 1);
                    ventasPorMes[`${mesesNombres[d.getMonth()]} ${d.getFullYear()}`] = 0;
                }

                facSnap.forEach(docSnap => {
                    const fac = docSnap.data();
                    const estatus = fac.estatusComercial || '';
                    
                    if (estatus === 'Anulada') return;

                    const totalFacNominal = parseFloat(fac.total) || 0;
                    const monedaDoc = fac.moneda || 'USD';
                    
                    // 🚀 SALVAVIDAS: Si la factura no congeló la tasa, usamos la de Make hoy
                    let tasaHistórica = parseFloat(fac.tasa);
                    if (!tasaHistórica || tasaHistórica <= 1) {
                        if (monedaDoc === 'VES') tasaHistórica = tasaVivaBCV;
                        if (monedaDoc === 'EUR') tasaHistórica = tasaVivaEUR;
                        if (monedaDoc === 'USD') tasaHistórica = 1;
                    }

                    let totalParaGrafica = totalFacNominal;
                    
                    if (monedaDoc === 'VES') {
                        totalParaGrafica = totalFacNominal / tasaHistórica;
                    } else if (monedaDoc === 'EUR') {
                        totalParaGrafica = (tasaHistórica < 10) ? totalFacNominal * tasaHistórica : totalFacNominal * 1.08;
                    }

                    if (fac.fecha) {
                        const partes = fac.fecha.split('/');
                        if (partes.length === 3) {
                            const mesFac = parseInt(partes[1]) - 1;
                            const anioFac = parseInt(partes[2]);
                            
                            if (mesFac === mesActual && anioFac === anioActual) {
                                vMesUnificadoUSD += totalParaGrafica; 
                                if (monedaDoc === 'VES') vMesVES += totalFacNominal;
                                else if (monedaDoc === 'EUR') vMesEUR += totalFacNominal;
                                else vMesUSD += totalFacNominal;
                            }

                            const keyMes = `${mesesNombres[mesFac]} ${anioFac}`;
                            if (ventasPorMes[keyMes] !== undefined) {
                                ventasPorMes[keyMes] += totalParaGrafica;
                            }
                        }
                    }

                    if (estatus.includes('Crédito') && !estatus.includes('Pagado')) {
                        let totalAbonado = 0;
                        if (fac.abonos && Array.isArray(fac.abonos)) {
                            fac.abonos.forEach(ab => totalAbonado += (parseFloat(ab.monto) || 0));
                        }
                        const deudaReal = totalFacNominal - totalAbonado;
                        
                        let deudaRealUSD = deudaReal;
                        if (monedaDoc === 'VES') deudaRealUSD = deudaReal / tasaHistórica;
                        else if (monedaDoc === 'EUR') deudaRealUSD = (tasaHistórica < 10) ? deudaReal * tasaHistórica : deudaReal * 1.08;
                        
                        cxcTotalUSD += deudaRealUSD;

                        if (monedaDoc === 'VES') cxcVES += deudaReal;
                        else if (monedaDoc === 'EUR') cxcEUR += deudaReal;
                        else cxcUSD += deudaReal;
                    }
                });

                document.getElementById('dash-v-total').textContent = vMesUnificadoUSD.toFixed(2);
                document.getElementById('dash-v-usd').textContent = vMesUSD.toFixed(2);
                document.getElementById('dash-v-ves').textContent = vMesVES.toFixed(2);
                document.getElementById('dash-v-eur').textContent = vMesEUR.toFixed(2);

                document.getElementById('dash-cxc-total').textContent = cxcTotalUSD.toFixed(2);
                document.getElementById('dash-cxc-usd').textContent = cxcUSD.toFixed(2);
                document.getElementById('dash-cxc-ves').textContent = cxcVES.toFixed(2);
                document.getElementById('dash-cxc-eur').textContent = cxcEUR.toFixed(2);

                // 4. CÁLCULO DE CXP
                let cxpTotalRefUSD = 0, cxpUSD = 0, cxpVES = 0, cxpEUR = 0;
                try {
                    const cxpSnap = await getDocs(collection(db, "cuentas_pagar"));
                    cxpSnap.forEach(docSnap => {
                        const data = docSnap.data();
                        if (data.estatus !== 'Liquidado') {
                            const monedaCxp = data.moneda || 'USD';
                            const montoCxp = parseFloat(data.monto) || 0;
                            
                            let tasaCxp = parseFloat(data.tasa);
                            if (!tasaCxp || tasaCxp <= 1) {
                                if (monedaCxp === 'VES') tasaCxp = tasaVivaBCV;
                                if (monedaCxp === 'EUR') tasaCxp = tasaVivaEUR;
                                if (monedaCxp === 'USD') tasaCxp = 1;
                            }
                            
                            let montoRefUSD = montoCxp;
                            if (monedaCxp === 'VES') {
                                cxpVES += montoCxp;
                                montoRefUSD = montoCxp / tasaCxp; 
                            }
                            else if (monedaCxp === 'EUR') {
                                cxpEUR += montoCxp;
                                montoRefUSD = (tasaCxp < 10) ? montoCxp * tasaCxp : montoCxp * 1.08;
                            }
                            else {
                                cxpUSD += montoCxp;
                            }
                            cxpTotalRefUSD += montoRefUSD;
                        }
                    });
                } catch(e) { }

                document.getElementById('dash-cxp-total').textContent = cxpTotalRefUSD.toFixed(2);
                document.getElementById('dash-cxp-usd').textContent = cxpUSD.toFixed(2);
                document.getElementById('dash-cxp-ves').textContent = cxpVES.toFixed(2);
                document.getElementById('dash-cxp-eur').textContent = cxpEUR.toFixed(2);

                // 5. GRÁFICA
                const ctx = document.getElementById('salesChart').getContext('2d');
                if (salesChartInstance) { salesChartInstance.destroy(); }
                
                salesChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Object.keys(ventasPorMes),
                        datasets: [{
                            label: 'Crecimiento de Ventas (USD Referencial)',
                            data: Object.values(ventasPorMes),
                            backgroundColor: 'rgba(56, 87, 35, 0.2)',
                            borderColor: '#385723',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#1d6fa5',
                            pointRadius: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });

                if (window.calcularGananciaNetaDashboard) {
                    await window.calcularGananciaNetaDashboard(tasaVivaBCV, tasaVivaEUR);
                }

                // 🧊 RENDERIZADO DEL GRÁFICO 3D (PLOTLY 3D SURFACE)
                if (window.renderizarGrafico3DPlotly) {
                    window.renderizarGrafico3DPlotly();
                }
            } catch (error) { console.error("Error cargando Dashboard:", error); }
        };

        // =========================================================================
        // 📊 MÓDULO VISUALIZACIÓN DE DATOS 2D (PLOTLY.JS - HEATMAP 100% SVG)
        // =========================================================================
        window.renderizarGraficoHeatmapPlotly = function() {
            const container = document.getElementById('grafico-heatmap-rentabilidad') || document.getElementById('grafico-rentabilidad-3d');
            if (!container) return;

            if (typeof Plotly === 'undefined') {
                console.warn('Plotly.js aún no está disponible. Reintentando...');
                setTimeout(window.renderizarGraficoHeatmapPlotly, 200);
                return;
            }

            // Datos estructurados: Matriz 2D 5x5 perfecta (Eje Z)
            var z_data = [
              [250, 400, 800, 1200, 900],   // Fila 0: Motor
              [300, 500, 750, 1400, 1100],  // Fila 1: Suspensión
              [600, 900, 1500, 2100, 1800], // Fila 2: Frenos
              [800, 1200, 2200, 3000, 2500],// Fila 3: Carrocería
              [500, 700, 1100, 1600, 1300]  // Fila 4: Eléctrico
            ];

            var x_data = ['Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre'];
            var y_data = ['Motor', 'Suspensión', 'Frenos', 'Carrocería', 'Eléctrico'];

            var data = [{
              z: z_data,
              x: x_data,
              y: y_data,
              type: 'heatmap',
              hoverongaps: false,
              colorscale: [
                [0.0, '#ffffff'],
                [0.2, '#eef3f0'],
                [0.5, '#5e8877'],
                [1.0, '#385723']
              ],
              showscale: true,
              colorbar: {
                title: {
                  text: 'Ganancia ($)',
                  font: { family: 'Arial, sans-serif', size: 12, color: '#333333' }
                },
                tickfont: { family: 'Arial, sans-serif', size: 11, color: '#333333' },
                len: 0.9,
                thickness: 16
              }
            }];

            var layout = {
              title: false,
              autosize: true,
              margin: { t: 30, r: 30, b: 60, l: 80 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Arial, sans-serif', color: '#333333' },
              xaxis: {
                title: { text: 'Meses', font: { family: 'Arial, sans-serif', size: 13, color: '#333333' } },
                tickfont: { family: 'Arial, sans-serif', size: 11, color: '#333333' }
              },
              yaxis: {
                title: { text: 'Categoría', font: { family: 'Arial, sans-serif', size: 13, color: '#333333' } },
                tickfont: { family: 'Arial, sans-serif', size: 11, color: '#333333' }
              }
            };

            var config = {
              responsive: true,
              displayModeBar: true,
              displaylogo: false
            };

            Plotly.newPlot(container, data, layout, config);
        };

        // Alias retrocompatible
        window.renderizarGrafico3DPlotly = window.renderizarGraficoHeatmapPlotly;

        window.addEventListener('resize', () => {
            const el = document.getElementById('grafico-heatmap-rentabilidad') || document.getElementById('grafico-rentabilidad-3d');
            if (el && typeof Plotly !== 'undefined') {
                Plotly.Plots.resize(el);
            }
        });

        // ==========================================
        // 🚀 MÓDULO CXC Y CXP (MULTIMONEDA)
        // ==========================================
        window.guardarNuevaCxP = async function(e) {
            e.preventDefault();
            const prov = SecuritySanitizer.cleanText(document.getElementById('cxp-proveedor').value, 100);
            const monto = SecuritySanitizer.sanitizeAmount(document.getElementById('cxp-monto').value);
            const monedaData = document.getElementById('cxp-moneda').value.split('|');
            const moneda = SecuritySanitizer.cleanText(monedaData[0], 20);
            const simbolo = SecuritySanitizer.cleanText(monedaData[1], 10);

            try {
                await addDoc(collection(db, "cuentas_pagar"), {
                    proveedor: prov,
                    monto: monto,
                    moneda: moneda,
                    simbolo: simbolo,
                    fecha: new Date().toLocaleDateString("es-VE"),
                    estatus: "Pendiente"
                });
                document.getElementById('form-cxp').reset();
                window.cargarFinanzas();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error guardando cuenta por pagar."); }
        };

        window.liquidarCxP = async function(docId) {
            if(!confirm("¿Marcar esta deuda como liquidada/pagada? Desaparecerá de la lista pendiente.")) return;
            try {
                await updateDoc(doc(db, "cuentas_pagar", docId), { estatus: "Liquidado" });
                window.cargarFinanzas();
                window.cargarDashboard();
            } catch(e) { console.error(e); }
        };

        window.cargarFinanzas = async function() {
            const tbodyCxC = document.getElementById('cxc-table-body');
            const tbodyCxP = document.getElementById('cxp-table-body');
            
            tbodyCxC.innerHTML = `<tr><td colspan="4" style="text-align: center;">Buscando deudas a crédito...</td></tr>`;
            window.facturasDBLocal = {}; 

            try {
                // CXC: Buscar facturas a crédito
                const snapFac = await getDocs(collection(db, "facturas"));
                tbodyCxC.innerHTML = '';
                let encontradasCxC = 0;

                snapFac.forEach(docSnap => {
                    const fac = docSnap.data();
                    const docId = docSnap.id;
                    const estatus = fac.estatusComercial || '';
                    
                    window.facturasDBLocal[docId] = fac; 

                    if (estatus.includes('Crédito') && !estatus.includes('Pagado') && estatus !== 'Anulada') {
                        encontradasCxC++;
                        const totalFac = parseFloat(fac.total) || 0;
                        let totalAbonado = 0;
                        
                        if (fac.abonos && Array.isArray(fac.abonos)) {
                            fac.abonos.forEach(ab => totalAbonado += (parseFloat(ab.monto) || 0));
                        }
                        
                        const saldoPendiente = totalFac - totalAbonado;
                        const simbolo = fac.simbolo || '$';

                        tbodyCxC.innerHTML += `
                            <tr>
                                <td><strong style="color:#1d6fa5;">#${fac.nro}</strong><br><span style="font-weight:bold;">${fac.cliente}</span><br><span style="font-size:10px;color:#666;">${estatus}</span></td>
                                <td style="text-align: right;">${simbolo}${totalFac.toFixed(2)}</td>
                                <td style="text-align: right;"><strong style="color: #d9534f; font-size:15px;">${simbolo}${saldoPendiente.toFixed(2)}</strong></td>
                                <td style="display: flex; gap: 5px; justify-content: center; align-items: center;">
                                    <button type="button" onclick="abrirModalAbono('${docId}')" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" title="Registrar Pago">
                                        <i class="fas fa-plus"></i> Abono
                                    </button>
                                    
                                 <!-- 🤖 BOTÓN MORADO DEL COBRADOR IA -->
                                    <button type="button" onclick="abrirCobradorIA('${fac.cliente.replace(/'/g, "\\'")}', '${saldoPendiente}', '${simbolo}', '${fac.telefono || ''}', '${fac.nro}', '${fac.fecha}', '${estatus}')" title="Cobrador IA" style="background: #8e44ad; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                                        <i class="fas fa-robot"></i> Cobrar
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                });
                
                if (encontradasCxC === 0) tbodyCxC.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay cuentas por cobrar pendientes.</td></tr>`;

                // CXP: Buscar deudas a proveedores
                tbodyCxP.innerHTML = '';
                const snapCxP = await getDocs(collection(db, "cuentas_pagar"));
                
                if (snapCxP.empty) {
                    tbodyCxP.innerHTML = `<tr><td colspan="3" style="text-align: center;">No hay deudas por pagar registradas.</td></tr>`;
                } else {
                    snapCxP.forEach(docSnap => {
                        const cxp = docSnap.data();
                        if (cxp.estatus !== 'Liquidado') {
                            const sim = cxp.simbolo || '$';
                            tbodyCxP.innerHTML += `
                                <tr>
                                    <td><strong>${cxp.proveedor}</strong></td>
                                    <td style="text-align: right;"><strong style="color: #d9534f;">${sim}${parseFloat(cxp.monto).toFixed(2)}</strong></td>
                                    <td style="display: flex; gap: 5px; justify-content: center; align-items: center;">
                                        <button type="button" onclick="liquidarCxP('${docSnap.id}')" style="background:#17a2b8; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;"><i class="fas fa-check"></i> Saldar</button>
                                    </td>
                                </tr>
                            `;
                        }
                    });
                }
            } catch (error) { console.error("Error Finanzas:", error); }
        };

        window.abrirModalAbono = function(docId) {
            const fac = window.facturasDBLocal[docId];
            if (!fac) return;

            document.getElementById('abono-doc-id').value = docId;
            document.getElementById('abono-factura-nro').textContent = fac.nro;
            document.getElementById('abono-cliente').textContent = fac.cliente;
            
            const totalFac = parseFloat(fac.total) || 0;
            let totalAbonado = 0;
            if (fac.abonos && Array.isArray(fac.abonos)) {
                fac.abonos.forEach(ab => totalAbonado += (parseFloat(ab.monto) || 0));
            }
            const saldoPendiente = totalFac - totalAbonado;
            const simbolo = fac.simbolo || '$';

            document.getElementById('abono-total-fac').textContent = `${simbolo}${totalFac.toFixed(2)}`;
            document.getElementById('abono-saldo-pendiente').textContent = `${simbolo}${saldoPendiente.toFixed(2)}`;
            
            document.getElementById('abono-monto').value = saldoPendiente.toFixed(2);
            document.getElementById('abono-monto').max = saldoPendiente.toFixed(2);
            
            document.getElementById('abono-nota').value = '';
            document.getElementById('modal-abono').style.display = 'flex';
        };

        window.cerrarModalAbono = function() { document.getElementById('modal-abono').style.display = 'none'; };

        window.guardarAbono = async function() {
            const docId = document.getElementById('abono-doc-id').value;
            const montoAbono = SecuritySanitizer.sanitizeAmount(document.getElementById('abono-monto').value);
            const metodo = SecuritySanitizer.cleanText(document.getElementById('abono-metodo').value, 50);
            const nota = SecuritySanitizer.cleanNote(document.getElementById('abono-nota').value, 200);

            if (montoAbono <= 0) { alert("El monto a abonar debe ser mayor a cero."); return; }

            const fac = window.facturasDBLocal[docId];
            let abonosExistentes = fac.abonos || [];
            
            abonosExistentes.push({
                fecha: new Date().toLocaleDateString("es-VE"),
                monto: montoAbono,
                metodo: metodo,
                nota: nota
            });

            const totalFac = parseFloat(fac.total) || 0;
            let totalAbonadoNuevo = 0;
            abonosExistentes.forEach(ab => totalAbonadoNuevo += parseFloat(ab.monto));
            
            let nuevoEstatus = fac.estatusComercial;
            if (totalAbonadoNuevo >= totalFac) {
                nuevoEstatus = "Crédito Pagado";
            }

            try {
                await updateDoc(doc(db, "facturas", docId), {
                    abonos: abonosExistentes,
                    estatusComercial: nuevoEstatus
                });
                alert(nuevoEstatus === "Crédito Pagado" ? "¡Cuenta pagada en su totalidad!" : "Abono registrado correctamente.");
                window.cerrarModalAbono();
                window.cargarFinanzas(); 
                window.cargarHistorialFacturas(); 
                window.cargarDashboard();
            } catch (error) { console.error("Error guardando abono:", error); alert("Error al registrar el abono."); }
        };

        // ==========================================
        // GESTIÓN DE PEDIDOS Y ENVÍOS (NUEVO MULTI-ITEM Y EDICIÓN)
        // ==========================================
        window.seleccionarClientePedido = function() {
            const clienteId = document.getElementById('ped-selector-clientes').value;
            if(clienteId && window.clientesDBLocal[clienteId]) {
                const cli = window.clientesDBLocal[clienteId];
                document.getElementById('client-name').value = cli.nombre;
                document.getElementById('client-email').value = (cli.telefono && cli.telefono !== "NO APLICA") ? cli.telefono : "";
            }
        };

        window.agregarItemDesdeInventarioPedido = function() {
            const select = document.getElementById('select-inventario-ped');
            const selectedIndex = select.selectedIndex;
            if (selectedIndex <= 0) { alert("Selecciona un repuesto del inventario primero."); return; }

            const opt = select.options[selectedIndex];
            const nombre = opt.getAttribute('data-nombre');
            const precio = parseFloat(opt.getAttribute('data-precio')) || 0;

            const container = document.getElementById('pedidos-items-container');
            const row = document.createElement('div');
            row.className = 'pedido-item-row';
            row.innerHTML = `
                <input type="number" class="ped-item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalPedido()">
                <input type="text" class="ped-item-desc" value="${nombre}" placeholder="Descripción" style="grid-column: span 3;">
                <input type="number" step="0.01" class="ped-item-precio" value="${precio.toFixed(2)}" placeholder="Precio" oninput="calcularTotalPedido()">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalPedido();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            select.selectedIndex = 0;
            window.calcularTotalPedido();
        };

        window.agregarFilaPedidoVacia = function() {
            const container = document.getElementById('pedidos-items-container');
            const row = document.createElement('div');
            row.className = 'pedido-item-row';
            row.innerHTML = `
                <input type="number" class="ped-item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalPedido()">
                <input type="text" class="ped-item-desc" placeholder="Descripción del repuesto" style="grid-column: span 3;">
                <input type="number" step="0.01" class="ped-item-precio" value="0.00" placeholder="Precio" oninput="calcularTotalPedido()">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalPedido();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            window.calcularTotalPedido();
        };

        window.calcularTotalPedido = function() {
            const rows = document.querySelectorAll('.pedido-item-row');
            let total = 0;
            rows.forEach(row => {
                const cant = parseFloat(row.querySelector('.ped-item-cant').value) || 0;
                const precio = parseFloat(row.querySelector('.ped-item-precio').value) || 0;
                total += (cant * precio);
            });
            document.getElementById('ped-total-general').innerText = total.toFixed(2);
        };

        window.mostrarOpcionesMotorizadoCreacion = function() {
            const envio = document.getElementById('shipping-type').value;
            const zonaMot = document.getElementById('zona-motorizado-creacion');
            // Si el cliente retira en local, ocultamos el pago al motorizado
            if (envio.includes('Retiro')) {
                zonaMot.style.display = 'none';
                document.getElementById('ped-motorizado').value = '';
                document.getElementById('ped-tarifa-mot').value = '';
            } else {
                zonaMot.style.display = 'block';
            }
        };

        window.guardarPedidoManual = async function(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            
            const rows = document.querySelectorAll('.pedido-item-row');
            const productos = [];
            let totalPedido = 0;
            
            rows.forEach(row => {
                const cant = SecuritySanitizer.sanitizeInt(row.querySelector('.ped-item-cant').value, 1);
                const desc = SecuritySanitizer.cleanText(row.querySelector('.ped-item-desc').value, 150);
                const precio = SecuritySanitizer.sanitizeAmount(row.querySelector('.ped-item-precio').value);
                if(desc) { productos.push({ nombre: desc, cantidad: cant, precio: precio }); totalPedido += (cant * precio); }
            });

            if(productos.length === 0) { alert("Agrega al menos un repuesto al pedido."); return; }
            btn.innerHTML = "Registrando..."; btn.disabled = true;

            const envioVal = SecuritySanitizer.cleanText(document.getElementById('shipping-type').value, 50);
            let trackingVal = SecuritySanitizer.cleanText(document.getElementById('tracking-info').value, 100);
            let trackingMotVal = SecuritySanitizer.cleanText(document.getElementById('tracking-motorizado').value, 100);
            const motorizadoVal = SecuritySanitizer.cleanText(document.getElementById('ped-motorizado').value, 50);
            const tarifaVal = SecuritySanitizer.sanitizeAmount(document.getElementById('ped-tarifa-mot').value);

            // Limpieza inteligente al editar para pedidos viejos
            if (envioVal.includes('Motorizado')) {
                if (trackingVal !== '' && trackingMotVal === '') trackingMotVal = trackingVal;
                trackingVal = ''; // Forzamos a vaciar la agencia porque es moto directa
            }

            if (!envioVal.includes('Retiro') && motorizadoVal !== '' && trackingMotVal === '') {
                const aleatorio = Math.floor(1000 + Math.random() * 9000);
                const letMot = motorizadoVal.substring(0,1).toUpperCase();
                trackingMotVal = `MOT${letMot}-${aleatorio}`;
            }

            const nuevoPedido = {
                email: SecuritySanitizer.cleanText(document.getElementById('client-email').value, 100),
                cliente: SecuritySanitizer.cleanText(document.getElementById('client-name').value, 120),
                total: SecuritySanitizer.sanitizeAmount(totalPedido),
                envio: envioVal,
                tracking: trackingVal,
                trackingMotorizado: trackingMotVal,
                estado: "Pendiente",
                fecha: new Date().toLocaleDateString("es-VE"),
                productos: productos,
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? 'Pendiente' : '',
                rutasMotorizado: SecuritySanitizer.cleanAddress(document.getElementById('ped-ruta-mot').value, 300)
            };

            try {
                await addDoc(collection(db, "pedidos"), nuevoPedido);
                alert("¡Pedido registrado exitosamente!");
                e.target.reset();
                document.getElementById('pedidos-items-container').innerHTML = '';
                document.getElementById('ped-total-general').innerText = '0.00';
                window.mostrarOpcionesMotorizadoCreacion();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
            } catch (error) { console.error(error); alert("Error al registrar."); }
            btn.innerHTML = "Registrar Pedido"; btn.disabled = false;
        };

        window.enviarPedidoAFacturacion = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if(!ped) return;

            const btnFacturacion = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes('Facturación'));
            if(btnFacturacion) {
                window.mostrarPestana('facturacion', btnFacturacion);
            }

            document.getElementById('fac-cliente').value = ped.cliente;
            document.getElementById('fac-telefono').value = ped.email; 
            document.getElementById('fac-rif').value = ""; 
            document.getElementById('fac-direccion').value = ""; 
            
            for (const key in window.clientesDBLocal) {
                if (window.clientesDBLocal[key].nombre.toUpperCase() === ped.cliente.toUpperCase()) {
                    document.getElementById('fac-rif').value = window.clientesDBLocal[key].rif;
                    document.getElementById('fac-direccion').value = window.clientesDBLocal[key].direccion;
                    break;
                }
            }

            const container = document.getElementById('facturacion-items-container');
            container.innerHTML = ''; 
            const simbolo = document.getElementById('fac-moneda').value.split('|')[1];
            
            if(ped.productos && Array.isArray(ped.productos)) {
                ped.productos.forEach(prod => {
                    const row = document.createElement('div');
                    row.className = 'facturacion-item-row';
                    const precioUnit = parseFloat(prod.precio) || 0;
                    const cant = parseInt(prod.cantidad) || 1;
                    const totalLinea = cant * precioUnit;
                    
                    row.innerHTML = `
                        <input type="number" class="fac-item-cant" value="${cant}" min="1" placeholder="Cant" oninput="calcularTotalFactura()">
                        <input type="text" class="fac-item-desc" value="${prod.nombre}" placeholder="Descripción" oninput="actualizarPreviewFactura()">
                        <input type="number" step="0.01" class="fac-item-precio" value="${precioUnit.toFixed(2)}" placeholder="Precio" oninput="calcularTotalFactura()">
                        <input type="number" step="0.01" class="fac-item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalFactura()">
                        <input type="text" class="fac-item-total-line" value="${simbolo}${totalLinea.toFixed(2)}" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                        <button type="button" onclick="this.parentElement.remove(); calcularTotalFactura();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
                    `;
                    container.appendChild(row);
                });
            } else {
                const cant = ped.cantidad || 1;
                const totalPed = ped.total || 0;
                const precioUnit = totalPed / cant;
                const row = document.createElement('div');
                row.className = 'facturacion-item-row';
                row.innerHTML = `
                    <input type="number" class="fac-item-cant" value="${cant}" min="1" placeholder="Cant" oninput="calcularTotalFactura()">
                    <input type="text" class="fac-item-desc" value="${ped.producto || 'Repuesto Varios'}" placeholder="Descripción" oninput="actualizarPreviewFactura()">
                    <input type="number" step="0.01" class="fac-item-precio" value="${precioUnit.toFixed(2)}" placeholder="Precio" oninput="calcularTotalFactura()">
                    <input type="number" step="0.01" class="fac-item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalFactura()">
                    <input type="text" class="fac-item-total-line" value="${simbolo}${totalPed.toFixed(2)}" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                    <button type="button" onclick="this.parentElement.remove(); calcularTotalFactura();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
                `;
                container.appendChild(row);
            }

            window.calcularTotalFactura();
            alert("✅ Pedido enviado al facturador.\nCompleta cualquier dato faltante y genera la Nota de Entrega.");
        };

        window.cargarPedidos = async function() {
            const tbody = document.getElementById('orders-table-body');
            if(!tbody) return;
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Buscando pedidos...</td></tr>';

            try {
                // Carga TODOS los pedidos una sola vez
                if (!window._pedidosTodosCache) {
                    const snap = await getDocs(collection(db, "pedidos"));
                    window._pedidosTodosCache = [];
                    window.pedidosDBLocal = {};
                    snap.forEach(docSnap => {
                        const ped = docSnap.data();
                        window.pedidosDBLocal[docSnap.id] = ped;
                        window._pedidosTodosCache.push({ id: docSnap.id, ...ped });
                    });
                }

                // Poblar selector de meses disponibles
                const selectMes = document.getElementById('pedidos-mes-filtro');
                if (selectMes && selectMes.options.length === 0) {
                    // Recolectar todos los meses/años presentes en los pedidos
                    const mesesSet = new Set();
                    window._pedidosTodosCache.forEach(p => {
                        if (p.fecha) {
                            // fecha puede ser "DD/MM/YYYY" o "YYYY-MM-DD" o similar
                            const partes = p.fecha.split('/');
                            if (partes.length === 3) mesesSet.add(`${partes[2]}-${partes[1].padStart(2,'0')}`); // YYYY-MM
                            else {
                                const d = new Date(p.fecha);
                                if (!isNaN(d)) mesesSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
                            }
                        }
                    });

                    const ahora = new Date();
                    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}`;
                    mesesSet.add(mesActual); // Siempre incluir el mes actual aunque esté vacío

                    // Ordenar desc y construir options
                    const mesesOrdenados = Array.from(mesesSet).sort().reverse();
                    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                    selectMes.innerHTML = '';

                    // Opción "Todos"
                    const optTodos = document.createElement('option');
                    optTodos.value = 'todos';
                    optTodos.textContent = '📚 Ver Archivo Completo';
                    selectMes.appendChild(optTodos);

                    mesesOrdenados.forEach(ym => {
                        const [y, m] = ym.split('-');
                        const opt = document.createElement('option');
                        opt.value = ym;
                        opt.textContent = `${meses[parseInt(m)-1]} ${y}`;
                        if (ym === mesActual) opt.selected = true;
                        selectMes.appendChild(opt);
                    });
                }

                // Determinar filtro activo
                const filtroMes = selectMes ? selectMes.value : 'todos';

                // Filtrar y ordenar DESCENDENTE por fecha
                let pedidosFiltrados = [...window._pedidosTodosCache];

                // Contador en tiempo real de pedidos sin guía (excluyendo Retiro en Local)
                const pedidosSinGuiaGlobal = (window._pedidosTodosCache || []).filter(p => {
                    const esRetiro = p.envio && p.envio.toLowerCase().includes('retiro');
                    if (esRetiro) return false;
                    const tieneGuia = (p.tracking && p.tracking.trim() !== '' && p.tracking.trim() !== 'Pendiente') ||
                                      (p.trackingMotorizado && p.trackingMotorizado.trim() !== '' && p.trackingMotorizado.trim() !== 'Pendiente');
                    return !tieneGuia;
                });
                const badgeSinGuia = document.getElementById('contador-sin-guia');
                if (badgeSinGuia) badgeSinGuia.textContent = pedidosSinGuiaGlobal.length;

                // Aplicar filtro rápido "Solo Sin Guía" si está activo
                if (window._filtroSoloSinGuia) {
                    pedidosFiltrados = pedidosFiltrados.filter(p => {
                        const esRetiro = p.envio && p.envio.toLowerCase().includes('retiro');
                        if (esRetiro) return false;
                        const tieneGuia = (p.tracking && p.tracking.trim() !== '' && p.tracking.trim() !== 'Pendiente') ||
                                          (p.trackingMotorizado && p.trackingMotorizado.trim() !== '' && p.trackingMotorizado.trim() !== 'Pendiente');
                        return !tieneGuia;
                    });
                } else if (filtroMes !== 'todos') {
                    pedidosFiltrados = pedidosFiltrados.filter(p => {
                        if (!p.fecha) return false;
                        const partes = p.fecha.split('/');
                        let ym = '';
                        if (partes.length === 3) ym = `${partes[2]}-${partes[1].padStart(2,'0')}`;
                        else {
                            const d = new Date(p.fecha);
                            if (!isNaN(d)) ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                        }
                        return ym === filtroMes;
                    });
                }

                // Orden descendente: más nuevo primero
                pedidosFiltrados.sort((a, b) => {
                    const parseFecha = f => {
                        if (!f) return 0;
                        const p = f.split('/');
                        if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
                        return new Date(f).getTime() || 0;
                    };
                    return parseFecha(b.fecha) - parseFecha(a.fecha);
                });

                tbody.innerHTML = '';
                const contador = document.getElementById('pedidos-contador');

                if (pedidosFiltrados.length === 0) {
                    const msgVacio = window._filtroSoloSinGuia 
                        ? '¡Excelente! No hay pedidos pendientes de guía en este momento.' 
                        : 'No hay pedidos en este período.';
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">${msgVacio}</td></tr>`;
                    if (contador) contador.textContent = '(0 pedidos)';
                    return;
                }

                if (contador) contador.textContent = `(${pedidosFiltrados.length} pedido${pedidosFiltrados.length !== 1 ? 's' : ''})`;

                pedidosFiltrados.forEach((ped, idx) => {
                    const docId = ped.id;
                    const numOrden = idx + 1;

                    let badgeClass = 'badge-status-activo';
                    if(ped.estado === 'Pendiente' || ped.estado === 'Procesando') badgeClass = 'badge-status-inactivo';
                    if(ped.estado === 'Procesado en Reventa') badgeClass = 'badge-status-reventa';

                    let productosStr = '';
                    if(ped.productos && Array.isArray(ped.productos)) {
                        productosStr = ped.productos.map(p => `${p.cantidad}x ${p.nombre}`).join('<br>');
                    } else {
                        productosStr = `${ped.cantidad}x ${ped.producto}`;
                    }

                    let tieneGuiaAsignada = false;
                    let trackingHtml = '';
                    if (ped.envio && ped.envio.includes('Motorizado')) {
                        let guiaReal = ped.trackingMotorizado || ped.tracking || 'Pendiente';
                        if (guiaReal && guiaReal !== 'Pendiente') tieneGuiaAsignada = true;
                        trackingHtml = `<span style="font-size:11px; color:#1d6fa5;">🏍️ Guía Moto: <b>${guiaReal}</b></span><br>`;
                    } else if (ped.envio && ped.envio.includes('Encomienda')) {
                        const agenciaNombre = ped.agenciaEnvio || 'Tealca/Zoom';
                        if (ped.trackingMotorizado) trackingHtml += `<span style="font-size:11px; color:#1d6fa5;">🏍️ Traslado Agencia: <b>${ped.trackingMotorizado}</b></span><br>`;
                        if (ped.tracking) {
                            tieneGuiaAsignada = true;
                            trackingHtml += `<span style="font-size:11px; color:#d35400;">📦 Guía ${agenciaNombre}: <b>${ped.tracking}</b></span><br>`;
                        }
                        if (!ped.tracking && !ped.trackingMotorizado) trackingHtml += `<span style="font-size:11px; color:#999;">Sin guías asignadas</span><br>`;
                    } else {
                        trackingHtml = `<span style="font-size:11px; color:#999;">Sin guía (Retiro en Local)</span><br>`;
                    }

                    // Botón de acción de Guía (WhatsApp si ya tiene / Asignar si no tiene)
                    let btnGuiaAccion = '';
                    const esRetiroLocal = ped.envio && ped.envio.toLowerCase().includes('retiro');
                    if (tieneGuiaAsignada) {
                        btnGuiaAccion = `<button type="button" onclick="window.copiarMensajeGuiaPedido('${docId}')" style="background:#25D366; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="📲 Copiar Mensaje de Guía para WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
                    } else if (!esRetiroLocal) {
                        btnGuiaAccion = `<button type="button" onclick="window.abrirAsignadorGuiaParaPedido('${docId}')" style="background:#d97706; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="📦 Asignar Guía con Foto o Manual"><i class="fas fa-barcode"></i></button>`;
                    }

                    // Badge de cambio/devolución
                    const esCambio = ped.esCambio ? `<span style="background:#e67e22;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;display:inline-block;margin-bottom:3px;">🔁 ${ped.etiquetaCambio || 'CAMBIO'}</span><br>` : '';

                    tbody.innerHTML += `
                        <tr>
                            <td style="font-weight:bold; color:#5B8266; font-size:13px;">#${numOrden}</td>
                            <td>${ped.fecha || 'N/A'}</td>
                            <td><strong>${ped.cliente}</strong><br><span style="font-size:11px;color:#666;">${ped.email}</span></td>
                            <td><div style="font-size:12px; line-height:1.4;">${productosStr}</div></td>
                            <td><strong>$${Number(ped.total || 0).toFixed(2)}</strong></td>
                            <td>
                                ${esCambio}
                                <span class="badge-shipping">${ped.envio}</span><br>
                                ${trackingHtml}
                                <span class="${badgeClass}" style="margin-top:4px; display:inline-block;">${ped.estado || 'Pendiente'}</span>
                            </td>
                            <td style="display: flex; gap: 5px; justify-content: center; align-items: center; flex-wrap:wrap;">
                                ${btnGuiaAccion}
                                <button type="button" onclick="abrirModalPedido('${docId}')" style="background:#1d6fa5; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="Editar Envío"><i class="fas fa-edit"></i></button>
                                <button type="button" onclick="enviarPedidoAFacturacion('${docId}')" style="background:#28a745; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="Facturar / Nota de Entrega"><i class="fas fa-file-invoice"></i></button>
                                <button type="button" onclick="imprimirEtiquetaEnvio('${docId}')" style="background:#333; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="Imprimir Etiqueta (58mm)"><i class="fas fa-print"></i></button>
                                <button type="button" onclick="abrirModalCambioDev('${docId}')" style="background:#e67e22; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="Generar Cambio / Devolución"><i class="fas fa-exchange-alt"></i></button>
                                <button type="button" onclick="abrirModalMigrarReventa('${docId}')" style="background:#2c441b; color:#ffd700; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;" title="💰 Migrar a Reventa / Desglose de Ganancias"><i class="fas fa-coins"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } catch(e) {
                console.error("Error cargando pedidos:", e);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error al conectar con la base de datos de pedidos.</td></tr>';
            }
            if (typeof window.cargarSelectorPedidosRuta === 'function') window.cargarSelectorPedidosRuta();
            if (typeof window.inicializarEventosGuiaDropzone === 'function') window.inicializarEventosGuiaDropzone();
        };

        // Forzar recarga limpia (borra caché local)
        window.refrescarPedidos = function() {
            window._pedidosTodosCache = null;
            const sel = document.getElementById('pedidos-mes-filtro');
            if (sel) sel.innerHTML = '';
            window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
        };

        // =========================================================================
        // 📦 ASISTENTE INTELIGENTE DE GUÍAS DE ENVÍO (IA VISION & RESOLUCIÓN DE DUDAS)
        // =========================================================================
        window._guiaImagenActualBlob = null;
        window._guiaImagenActualBase64 = null;
        window._guiaDatosExtraidos = null;
        window._guiaPedidoSeleccionadoId = null;
        window._filtroSoloSinGuia = false;
        window._dropzoneGuiaEventosIniciados = false;

        /**
         * Alterna el filtro rápido para ver solo pedidos pendientes de guía
         */
        window.toggleFiltroPedidosSinGuia = function() {
            window._filtroSoloSinGuia = !window._filtroSoloSinGuia;
            const btn = document.getElementById('btn-filtro-sin-guia');
            if (btn) {
                if (window._filtroSoloSinGuia) {
                    btn.style.background = '#b45309';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#78350f';
                } else {
                    btn.style.background = '#fffbeb';
                    btn.style.color = '#92400e';
                    btn.style.borderColor = '#d97706';
                }
            }
            window.cargarPedidos();
        };

        /**
         * Manejador al seleccionar archivo de guía desde el input file
         */
        window.manejarArchivoGuia = function(event) {
            const file = event.target?.files?.[0];
            if (file) window.procesarArchivoGuiaBlob(file, file.name);
        };

        /**
         * Carga y previsualiza cualquier Blob / File de imagen (Paste, Drag&Drop o File input)
         */
        window.procesarArchivoGuiaBlob = function(blob, filename = 'guia_captura.png') {
            if (!blob || !blob.type || !blob.type.startsWith('image/')) {
                alert("Por favor selecciona o pega una imagen válida (PNG, JPG, WEBP).");
                return;
            }
            window._guiaImagenActualBlob = blob;
            const reader = new FileReader();
            reader.onload = function(e) {
                window._guiaImagenActualBase64 = e.target.result;

                const dropPrompt = document.getElementById('dropzone-guia-prompt');
                const dropPreview = document.getElementById('dropzone-guia-preview');
                const imgEl = document.getElementById('img-preview-guia');
                const txtName = document.getElementById('txt-nombre-guia-archivo');
                const txtDim = document.getElementById('txt-dimensiones-guia');

                if (dropPrompt) dropPrompt.style.display = 'none';
                if (dropPreview) dropPreview.style.display = 'flex';
                if (imgEl) imgEl.src = window._guiaImagenActualBase64;
                if (txtName) txtName.textContent = filename;
                if (txtDim) txtDim.textContent = `Tamaño: ${(blob.size / 1024).toFixed(1)} KB (Listo para analizar)`;

                const statusEl = document.getElementById('status-guia-ia');
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.background = '#eef3f0';
                    statusEl.style.border = '1px solid #c3e6cb';
                    statusEl.style.color = '#155724';
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Imagen cargada. Analizando datos con IA...';
                }

                // Iniciar análisis automático con IA tras breve retardo UX
                setTimeout(() => {
                    window.procesarGuiaEnvioConIA();
                }, 250);
            };
            reader.readAsDataURL(blob);
        };

        /**
         * Limpia la zona de subida de guías
         */
        window.limpiarZonaGuiaIA = function() {
            window._guiaImagenActualBlob = null;
            window._guiaImagenActualBase64 = null;
            window._guiaDatosExtraidos = null;
            window._guiaPedidoSeleccionadoId = null;

            const input = document.getElementById('input-guia-file');
            if (input) input.value = '';

            const dropPrompt = document.getElementById('dropzone-guia-prompt');
            const dropPreview = document.getElementById('dropzone-guia-preview');
            const statusEl = document.getElementById('status-guia-ia');

            if (dropPrompt) dropPrompt.style.display = 'flex';
            if (dropPreview) dropPreview.style.display = 'none';
            if (statusEl) {
                statusEl.style.display = 'none';
                statusEl.innerHTML = '';
            }
        };

        /**
         * Inicializa eventos Drag & Drop y Paste global para guías
         */
        window.inicializarEventosGuiaDropzone = function() {
            if (window._dropzoneGuiaEventosIniciados) return;
            window._dropzoneGuiaEventosIniciados = true;

            const dropzone = document.getElementById('dropzone-guia-envio');
            if (dropzone) {
                ['dragenter', 'dragover'].forEach(eventName => {
                    dropzone.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropzone.style.borderColor = '#385723';
                        dropzone.style.background = '#eef3f0';
                    }, false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    dropzone.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropzone.style.borderColor = '#a3c2b2';
                        dropzone.style.background = '#ffffff';
                    }, false);
                });

                dropzone.addEventListener('drop', (e) => {
                    const dt = e.dataTransfer;
                    const files = dt?.files;
                    if (files && files.length > 0) {
                        window.procesarArchivoGuiaBlob(files[0], files[0].name);
                    }
                }, false);
            }

            // Escuchador global de pegar imágenes (Ctrl+V / Cmd+V)
            window.addEventListener('paste', (e) => {
                const tabPedidos = document.getElementById('tab-pedidos');
                const modalGuia = document.getElementById('modal-aclaracion-guia');
                const isTabActive = tabPedidos && (tabPedidos.style.display === 'block' || tabPedidos.classList.contains('active'));
                const isModalOpen = modalGuia && modalGuia.style.display === 'flex';

                if (!isTabActive && !isModalOpen) return;

                const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
                if (!items) return;

                for (const item of items) {
                    if (item.type && item.type.indexOf('image') !== -1) {
                        const blob = item.getAsFile();
                        if (blob) {
                            e.preventDefault();
                            window.procesarArchivoGuiaBlob(blob, 'guia_pegada_' + Date.now() + '.png');
                            break;
                        }
                    }
                }
            });
        };

        /**
         * Extracción con IA Multimodal (Puter AI + Fallback Gemini)
         */
        window.procesarGuiaEnvioConIA = async function(preselectedDocId = null) {
            if (!window._guiaImagenActualBase64) {
                alert("Por favor sube o pega una foto de la guía primero.");
                return;
            }

            const btnAnalizar = document.getElementById('btn-analizar-guia-ia');
            const statusEl = document.getElementById('status-guia-ia');

            if (btnAnalizar) {
                btnAnalizar.disabled = true;
                btnAnalizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Leyendo con IA...';
            }

            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.background = '#eef3f0';
                statusEl.style.border = '1px solid #5e8877';
                statusEl.style.color = '#2c441b';
                statusEl.innerHTML = '<i class="fas fa-robot fa-spin"></i> Analizando guía de despacho (Tealca, Zoom, MRW o Motorizado)...';
            }

            const promptIA = `Eres un asistente de logística y despacho para "Inversiones FB Parts, C.A." en Caracas, Venezuela.
Analiza minuciosamente esta imagen de una GUÍA DE ENVÍO o COMPROBANTE DE DESPACHO (Tealca, Grupo Zoom, MRW, Motorizado u otra).

Extrae los datos y responde ÚNICAMENTE con un objeto JSON estricto (sin explicaciones ni formato markdown):
{
  "numero_guia": "STRING_NUMERO_DE_GUIA_O_NULL",
  "agencia_detectada": "Tealca" | "Zoom" | "MRW" | "Motorizado" | "Otra" | null,
  "cliente_o_destinatario": "NOMBRE_DESTINATARIO_O_CLIENTE_O_NULL",
  "destino_ciudad": "CIUDAD_O_DESTINO_O_NULL",
  "confianza": "alta" | "media" | "baja",
  "dudas": [
    "DESCRIBE_CADA_DUDA_O_AMBIGUEDAD_SI_EXISTE"
  ]
}

REGLAS CRÍTICAS:
1. "agencia_detectada":
   - "Tealca": si dice Tealca, tracking de 8 a 10 dígitos.
   - "Zoom": si dice Zoom o Grupo Zoom.
   - "MRW": si dice MRW.
   - "Motorizado": si es una nota de entrega en moto, recibo o guía local interna con código tipo MOT-XXXX o despacho en Caracas.
   - "Otra": si es otra empresa de transporte (ej. Liberty Express, Domesa, Fletes GAG).
2. "numero_guia": número de rastreo o guía principal. Elimina letras si es estrictamente numérico o consérvalas si el código es alfanumérico.
3. "cliente_o_destinatario": nombre de la persona o razón social que RECIBE el envío.
4. "destino_ciudad": ciudad destino (ej: Valencia, Maracay, Barquisimeto, Puerto La Cruz, Caracas, etc.).
5. "confianza":
   - "alta": la agencia y el número de guía son 100% nítidos, legibles e inequívocos.
   - "media": se detecta la guía pero la agencia es ambigua o algún dígito genera dudas.
   - "baja": la foto es borrosa, ilegible, cortada o no parece una guía de envío.
6. "dudas": array de strings en español indicando motivos específicos de incertidumbre (ej: "No se distingue con claridad si es Zoom o MRW", "Número de guía con posible confusión entre 0 y O"). Si todo es claro, devuelve [] vacío.`;

            let dataExtraida = null;
            let errorMsg = null;

            try {
                if (typeof puter !== 'undefined' && puter.ai) {
                    try {
                        const resp = await puter.ai.chat(promptIA, window._guiaImagenActualBase64, { model: 'gemini-2.0-flash' });
                        dataExtraida = window.parsearJSONRespuestaGuia(resp);
                    } catch (eModel) {
                        try {
                            const resp = await puter.ai.chat(promptIA, window._guiaImagenActualBase64);
                            dataExtraida = window.parsearJSONRespuestaGuia(resp);
                        } catch (ePuterDef) {
                            console.warn("Fallo Puter AI, intentando Gemini directo si hay clave...", ePuterDef);
                        }
                    }
                }

                // Fallback directo a Gemini API si Puter no respondió
                if (!dataExtraida) {
                    const geminiKey = window.obtenerApiKeyGemini ? window.obtenerApiKeyGemini(false) : '';
                    if (geminiKey) {
                        const base64Data = window._guiaImagenActualBase64.split(',')[1];
                        const mimeType = window._guiaImagenActualBase64.substring(
                            window._guiaImagenActualBase64.indexOf(':') + 1, 
                            window._guiaImagenActualBase64.indexOf(';')
                        ) || 'image/jpeg';

                        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
                        const gResp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: promptIA },
                                        { inline_data: { mime_type: mimeType, data: base64Data } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                            })
                        });

                        if (gResp.ok) {
                            const gData = await gResp.json();
                            const rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            dataExtraida = window.parsearJSONRespuestaGuia(rawText);
                        }
                    }
                }
            } catch (err) {
                console.error("Error al procesar guía con IA:", err);
                errorMsg = err.message || String(err);
            }

            if (btnAnalizar) {
                btnAnalizar.disabled = false;
                btnAnalizar.innerHTML = '<i class="fas fa-bolt"></i> Analizar con IA';
            }

            // Si falló por completo la IA o la imagen no se pudo procesar
            if (!dataExtraida) {
                dataExtraida = {
                    numero_guia: "",
                    agencia_detectada: null,
                    cliente_o_destinatario: null,
                    destino_ciudad: null,
                    confianza: "baja",
                    dudas: [
                        errorMsg 
                            ? `No se pudo conectar con el servicio de IA (${errorMsg}). Puedes ingresar los datos manualmente.`
                            : "No se pudo extraer información automática de la imagen. Por favor ingresa los datos de la guía manualmente."
                    ]
                };
            }

            if (!Array.isArray(dataExtraida.dudas)) dataExtraida.dudas = [];
            if (!dataExtraida.confianza) dataExtraida.confianza = "media";

            // Validar agencia conocida
            const agenciasValidas = ['Tealca', 'Zoom', 'MRW', 'Motorizado', 'Otra'];
            if (!agenciasValidas.includes(dataExtraida.agencia_detectada)) {
                if (dataExtraida.agencia_detectada) {
                    dataExtraida.dudas.push(`Agencia "${dataExtraida.agencia_detectada}" no habitual. Confirma si es Tealca, Zoom, MRW o Motorizado.`);
                }
                dataExtraida.agencia_detectada = 'Tealca';
            }

            window._guiaDatosExtraidos = dataExtraida;

            // Buscar pedidos candidatos en la base de datos local
            const candidatos = window.buscarPedidosCandidatosGuia(dataExtraida, preselectedDocId);

            // Regla de dudas estricta: Notificar ambigüedades en pedidos
            if (candidatos.length > 1) {
                dataExtraida.dudas.push(`Existen ${candidatos.length} pedidos activos que podrían coincidir. Por favor selecciona el correcto.`);
            } else if (candidatos.length === 0 && !preselectedDocId) {
                dataExtraida.dudas.push("No se encontró ningún pedido pendiente que coincida automáticamente. Selecciona el pedido manualmente.");
            }

            if (statusEl) {
                statusEl.style.display = 'block';
                if (dataExtraida.dudas.length > 0 || dataExtraida.confianza !== 'alta') {
                    statusEl.style.background = '#fffbeb';
                    statusEl.style.border = '1px solid #fde68a';
                    statusEl.style.color = '#b45309';
                    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <b>Guía analizada con dudas/observaciones:</b> Se requiere confirmación del operador antes de vincular.`;
                } else {
                    statusEl.style.background = '#f0fdf4';
                    statusEl.style.border = '1px solid #bbf7d0';
                    statusEl.style.color = '#166534';
                    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> <b>Guía detectada:</b> Número <b>${dataExtraida.numero_guia || 'Pendiente'}</b> (${dataExtraida.agencia_detectada}) con alta confianza.`;
                }
            }

            // Abrir modal de aclaración y confirmación
            window.abrirModalAclaracionGuia(dataExtraida, candidatos, preselectedDocId);
        };

        /**
         * Parsea tolerante el JSON devuelto por la IA
         */
        window.parsearJSONRespuestaGuia = function(rawResp) {
            if (!rawResp) return null;
            let rawStr = '';
            if (typeof rawResp === 'string') rawStr = rawResp;
            else if (rawResp?.message?.content) {
                const c = rawResp.message.content;
                rawStr = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
            } else if (rawResp?.text) {
                rawStr = String(rawResp.text);
            }

            const jsonMatch = rawStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Error parseando JSON de guía:", e);
                return null;
            }
        };

        /**
         * Algoritmo de emparejamiento inteligente de candidatos
         */
        window.buscarPedidosCandidatosGuia = function(datosGuia, preselectedDocId = null) {
            const pedidos = window._pedidosTodosCache || [];
            if (pedidos.length === 0) return [];

            const norm = (str) => (str || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/g, ' ')
                .trim();

            const targetCliente = norm(datosGuia.cliente_o_destinatario);
            const targetCiudad = norm(datosGuia.destino_ciudad);
            const targetAgencia = (datosGuia.agencia_detectada || '').toLowerCase();
            const targetGuiaNum = (datosGuia.numero_guia || '').trim();

            const candidatos = [];

            pedidos.forEach(p => {
                let score = 0;
                const razonCoincidencia = [];

                if (preselectedDocId && p.id === preselectedDocId) {
                    score += 1000;
                    razonCoincidencia.push("Seleccionado directamente en la tabla");
                }

                const pedCliente = norm(p.cliente);
                const pedEnvio = norm(p.envio);
                const pedRuta = norm(p.rutasMotorizado);

                // 1. Coincidencia de Nombre
                if (targetCliente && targetCliente.length >= 3) {
                    if (pedCliente === targetCliente) {
                        score += 80;
                        razonCoincidencia.push("Nombre exacto");
                    } else if (pedCliente.includes(targetCliente) || targetCliente.includes(pedCliente)) {
                        score += 60;
                        razonCoincidencia.push("Coincidencia de nombre");
                    } else {
                        const tokensTarget = targetCliente.split(/\s+/).filter(t => t.length > 2);
                        const tokensPed = pedCliente.split(/\s+/).filter(t => t.length > 2);
                        let matchesTokens = 0;
                        tokensTarget.forEach(t => {
                            if (tokensPed.includes(t)) matchesTokens++;
                        });
                        if (matchesTokens > 0) {
                            score += matchesTokens * 25;
                            razonCoincidencia.push(`${matchesTokens} palabra(s) del nombre coinciden`);
                        }
                    }
                }

                // 2. Coincidencia de Ciudad / Destino
                if (targetCiudad && targetCiudad.length >= 3) {
                    if (pedRuta.includes(targetCiudad) || pedCliente.includes(targetCiudad)) {
                        score += 35;
                        razonCoincidencia.push(`Destino coincide (${datosGuia.destino_ciudad})`);
                    }
                }

                // 3. Coincidencia de Agencia
                if (targetAgencia) {
                    if (targetAgencia === 'motorizado' && pedEnvio.includes('motorizado')) {
                        score += 25;
                        razonCoincidencia.push("Método Motorizado");
                    } else if (['tealca', 'zoom', 'mrw'].includes(targetAgencia) && (pedEnvio.includes('encomienda') || pedEnvio.includes(targetAgencia))) {
                        score += 25;
                        razonCoincidencia.push(`Envío encomienda (${targetAgencia})`);
                    }
                }

                // 4. Estado de la guía: Los pedidos que NO tienen guía tienen prioridad
                const tieneGuia = (p.tracking && p.tracking.trim() !== '' && p.tracking.trim() !== 'Pendiente') ||
                                  (p.trackingMotorizado && p.trackingMotorizado.trim() !== '' && p.trackingMotorizado.trim() !== 'Pendiente');

                if (!tieneGuia && (!p.envio || !p.envio.includes('Retiro'))) {
                    score += 30;
                    razonCoincidencia.push("Pedido pendiente de guía");
                } else if (tieneGuia && targetGuiaNum && (p.tracking === targetGuiaNum || p.trackingMotorizado === targetGuiaNum)) {
                    score += 150;
                    razonCoincidencia.push("Ya tiene este número de guía registrado");
                }

                if (score >= 35) {
                    candidatos.push({
                        pedido: p,
                        score: score,
                        razon: razonCoincidencia.join(" • ")
                    });
                }
            });

            candidatos.sort((a, b) => b.score - a.score);
            return candidatos;
        };

        /**
         * Manejador ultra ligero con debounce (~120ms) para los campos de texto del modal de guía.
         * Mantiene la escritura 100% fluida a 60fps sin reflows ni re-renderizados costosos del DOM.
         */
        let _debounceGuiaTimer = null;
        window._actualizarEstadoGuiaInputsLigero = function() {
            clearTimeout(_debounceGuiaTimer);
            _debounceGuiaTimer = setTimeout(() => {
                const num = (document.getElementById('modal-guia-numero-val')?.value || '').trim();
                const dest = (document.getElementById('modal-guia-destinatario-val')?.value || '').trim();
                const ciud = (document.getElementById('modal-guia-ciudad-val')?.value || '').trim();

                if (window._guiaDatosExtraidos) {
                    window._guiaDatosExtraidos.numero_guia = num;
                    window._guiaDatosExtraidos.cliente_o_destinatario = dest;
                    window._guiaDatosExtraidos.destino_ciudad = ciud;
                }

                // Ajustar estado visual del botón de confirmación sin tocar el listado de pedidos
                const btnGuardar = document.getElementById('btn-guardar-asignacion-guia');
                if (btnGuardar) {
                    if (!num) {
                        btnGuardar.style.opacity = '0.65';
                        btnGuardar.title = 'Por favor ingresa un número de guía antes de confirmar';
                    } else {
                        btnGuardar.style.opacity = '1';
                        btnGuardar.title = 'Confirmar y Guardar Guía';
                    }
                }
            }, 120);
        };

        /**
         * Abre y renderiza el modal de aclaración de dudas y vinculación de guía
         */
        window.abrirModalAclaracionGuia = function(datosGuia, candidatos, preselectedDocId = null) {
            const modal = document.getElementById('modal-aclaracion-guia');
            if (!modal) return;

            // Miniatura
            const imgEl = document.getElementById('modal-guia-img-preview');
            if (imgEl && window._guiaImagenActualBase64) {
                imgEl.src = window._guiaImagenActualBase64;
            }

            // Badge de Confianza
            const badgeConfianza = document.getElementById('modal-guia-badge-confianza');
            if (badgeConfianza) {
                const conf = (datosGuia.confianza || 'media').toLowerCase();
                if (conf === 'alta') {
                    badgeConfianza.innerHTML = '<i class="fas fa-shield-alt"></i> Confianza: Alta';
                    badgeConfianza.style.background = '#dcfce7';
                    badgeConfianza.style.color = '#15803d';
                    badgeConfianza.style.border = '1px solid #bbf7d0';
                } else if (conf === 'media') {
                    badgeConfianza.innerHTML = '<i class="fas fa-exclamation-circle"></i> Confianza: Media';
                    badgeConfianza.style.background = '#fef9c3';
                    badgeConfianza.style.color = '#854d0e';
                    badgeConfianza.style.border = '1px solid #fef08a';
                } else {
                    badgeConfianza.innerHTML = '<i class="fas fa-question-circle"></i> Confianza: Baja';
                    badgeConfianza.style.background = '#fee2e2';
                    badgeConfianza.style.color = '#b91c1c';
                    badgeConfianza.style.border = '1px solid #fecaca';
                }
            }

            // Box de Dudas
            const dudasBox = document.getElementById('modal-guia-dudas-box');
            const dudasLista = document.getElementById('modal-guia-dudas-lista');
            const okBox = document.getElementById('modal-guia-ok-box');

            if (datosGuia.dudas && datosGuia.dudas.length > 0) {
                if (dudasBox) dudasBox.style.display = 'block';
                if (okBox) okBox.style.display = 'none';
                if (dudasLista) {
                    dudasLista.innerHTML = datosGuia.dudas.map(d => `<li>${SecuritySanitizer.escapeHtml(d)}</li>`).join('');
                }
            } else {
                if (dudasBox) dudasBox.style.display = 'none';
                if (okBox) okBox.style.display = 'flex';
            }

            // Valores de inputs
            const numInput = document.getElementById('modal-guia-numero-val');
            if (numInput) numInput.value = datosGuia.numero_guia || '';

            const destInput = document.getElementById('modal-guia-destinatario-val');
            if (destInput) destInput.value = datosGuia.cliente_o_destinatario || '';

            const ciudadInput = document.getElementById('modal-guia-ciudad-val');
            if (ciudadInput) ciudadInput.value = datosGuia.destino_ciudad || '';

            // Agencia seleccionada
            window.seleccionarAgenciaModalGuia(datosGuia.agencia_detectada || 'Tealca');

            // Renderizar candidatos
            const containerCandidatos = document.getElementById('modal-guia-candidatos-lista');
            const countEl = document.getElementById('modal-guia-candidatos-count');

            if (countEl) {
                countEl.textContent = `${candidatos.length} candidato${candidatos.length !== 1 ? 's' : ''}`;
            }

            let defaultDocId = preselectedDocId;

            if (containerCandidatos) {
                containerCandidatos.innerHTML = '';

                if (candidatos.length === 0) {
                    containerCandidatos.innerHTML = `
                        <div style="background: #fff; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px; text-align: center; color: #64748b; font-size: 12px;">
                            <i class="fas fa-search" style="font-size: 18px; margin-bottom: 6px; display: block; color: #94a3b8;"></i>
                            No se detectó un pedido coincidente automáticamente.<br>
                            Por favor selecciona el pedido en el menú desplegable inferior.
                        </div>
                    `;
                } else {
                    if (!defaultDocId && candidatos.length > 0) {
                        defaultDocId = candidatos[0].pedido.id;
                    }

                    candidatos.forEach((cand) => {
                        const ped = cand.pedido;
                        const isSelected = ped.id === defaultDocId;
                        const prodsAbrev = Array.isArray(ped.productos) 
                            ? ped.productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ') 
                            : (ped.producto || 'Productos varios');

                        const card = document.createElement('div');
                        card.id = `cand-card-${ped.id}`;
                        card.className = `cand-card-pedido ${isSelected ? 'active' : ''}`;
                        card.style.cssText = `
                            background: ${isSelected ? '#eef3f0' : '#ffffff'};
                            border: 1.5px solid ${isSelected ? '#385723' : '#cbd5e1'};
                            border-radius: 6px;
                            padding: 10px 12px;
                            cursor: pointer;
                            transition: all 0.15s ease;
                            position: relative;
                            min-width: 0;
                            max-width: 100%;
                            box-sizing: border-box;
                            overflow: hidden;
                        `;
                        card.onclick = () => window.seleccionarPedidoCandidatoGuia(ped.id);

                        card.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; min-width: 0; max-width: 100%;">
                                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                                    <input type="radio" name="radio-guia-pedido" value="${ped.id}" ${isSelected ? 'checked' : ''} style="accent-color: #385723; cursor: pointer; flex-shrink: 0;">
                                    <span style="font-weight: 800; font-size: 13px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${SecuritySanitizer.escapeHtml(ped.cliente || 'Sin nombre')}
                                    </span>
                                </div>
                                <span style="font-family: 'Oswald', sans-serif; font-weight: 700; color: #385723; font-size: 13.5px; flex-shrink: 0;">
                                    $${Number(ped.total || 0).toFixed(2)}
                                </span>
                            </div>
                            <div style="font-size: 11.5px; color: #475569; margin: 4px 0 4px 22px; line-height: 1.35; word-break: break-word; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${SecuritySanitizer.escapeHtml(prodsAbrev)}
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; margin-left: 22px; flex-wrap: wrap;">
                                <span style="font-size: 10px; background: #e2f0d9; color: #276738; padding: 1px 6px; border-radius: 4px; font-weight: 600; flex-shrink: 0;">
                                    ${ped.fecha || 'N/A'} • ${ped.envio || 'Envío'}
                                </span>
                                <span style="font-size: 10px; color: #b45309; font-weight: 700; word-break: break-word;">
                                    ${SecuritySanitizer.escapeHtml(cand.razon)}
                                </span>
                            </div>
                        `;
                        containerCandidatos.appendChild(card);
                    });
                }
            }

            // Poblar selector manual con todos los pedidos activos
            const selManual = document.getElementById('modal-guia-selector-manual-pedido');
            if (selManual) {
                selManual.innerHTML = '<option value="">-- Elige un pedido del sistema --</option>';
                const todos = [...(window._pedidosTodosCache || [])].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
                todos.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = `${p.fecha || ''} | ${p.cliente || 'Sin nombre'} - $${Number(p.total||0).toFixed(2)} (${p.envio || 'Envío'})`;
                    if (p.id === defaultDocId) opt.selected = true;
                    selManual.appendChild(opt);
                });
            }

            window._guiaPedidoSeleccionadoId = defaultDocId;

            // Mostrar botón de copiar mensaje si ya está asignado o preseleccionado
            const btnCopiar = document.getElementById('btn-copiar-msg-modal-guia');
            if (btnCopiar) {
                btnCopiar.style.display = defaultDocId ? 'inline-flex' : 'none';
            }

            // Actualizar estado del botón de confirmación de forma ligera
            window._actualizarEstadoGuiaInputsLigero();

            modal.style.display = 'flex';
        };

        /**
         * Selecciona agencia en el modal de guía
         */
        window.seleccionarAgenciaModalGuia = function(agencia) {
            const valInput = document.getElementById('modal-guia-agencia-val');
            if (valInput) valInput.value = agencia;

            const buttons = document.querySelectorAll('.btn-toggle-agencia');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-agencia').toLowerCase() === (agencia || '').toLowerCase()) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        };

        /**
         * Selecciona un pedido candidato desde su tarjeta
         */
        window.seleccionarPedidoCandidatoGuia = function(docId) {
            window._guiaPedidoSeleccionadoId = docId;
            const cards = document.querySelectorAll('.cand-card-pedido');
            cards.forEach(c => {
                const isMatch = (c.id === `cand-card-${docId}`);
                c.style.background = isMatch ? '#eef3f0' : '#ffffff';
                c.style.borderColor = isMatch ? '#385723' : '#cbd5e1';
                const radio = c.querySelector('input[type="radio"]');
                if (radio) radio.checked = isMatch;
            });

            const selManual = document.getElementById('modal-guia-selector-manual-pedido');
            if (selManual) selManual.value = docId;

            const btnCopiar = document.getElementById('btn-copiar-msg-modal-guia');
            if (btnCopiar) btnCopiar.style.display = docId ? 'inline-flex' : 'none';
        };

        /**
         * Selecciona un pedido desde el menú desplegable manual
         */
        window.cambiarPedidoManualModalGuia = function(docId) {
            window._guiaPedidoSeleccionadoId = docId;
            const cards = document.querySelectorAll('.cand-card-pedido');
            cards.forEach(c => {
                const isMatch = (c.id === `cand-card-${docId}`);
                c.style.background = isMatch ? '#eef3f0' : '#ffffff';
                c.style.borderColor = isMatch ? '#385723' : '#cbd5e1';
                const radio = c.querySelector('input[type="radio"]');
                if (radio) radio.checked = isMatch;
            });

            const btnCopiar = document.getElementById('btn-copiar-msg-modal-guia');
            if (btnCopiar) btnCopiar.style.display = docId ? 'inline-flex' : 'none';
        };

        /**
         * Cierra el modal de aclaración de guía
         */
        window.cerrarModalAclaracionGuia = function() {
            const modal = document.getElementById('modal-aclaracion-guia');
            if (modal) modal.style.display = 'none';
        };

        /**
         * Confirma y guarda la guía y agencia en Firestore
         */
        window.confirmarAsignacionGuia = async function() {
            const docId = window._guiaPedidoSeleccionadoId || document.getElementById('modal-guia-selector-manual-pedido')?.value;
            if (!docId) {
                alert("Por favor selecciona el pedido al cual deseas asignar la guía.");
                return;
            }

            const numeroGuia = (document.getElementById('modal-guia-numero-val')?.value || '').trim();
            if (!numeroGuia) {
                alert("Por favor ingresa o confirma el número de guía.");
                document.getElementById('modal-guia-numero-val')?.focus();
                return;
            }

            const agencia = document.getElementById('modal-guia-agencia-val')?.value || 'Tealca';
            const pedOriginal = (window.pedidosDBLocal && window.pedidosDBLocal[docId]) || {};

            const btn = document.getElementById('btn-guardar-asignacion-guia');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            const updateData = {
                ultimaGuiaAsignada: numeroGuia,
                agenciaEnvio: agencia,
                fechaGuia: new Date().toLocaleDateString('es-VE'),
                fechaActualizacionGuia: new Date().toISOString()
            };

            if (agencia === 'Motorizado') {
                updateData.trackingMotorizado = numeroGuia;
                if (!pedOriginal.envio || !pedOriginal.envio.includes('Motorizado')) {
                    updateData.envio = 'Motorizado Caracas';
                }
            } else {
                updateData.tracking = numeroGuia;
                if (!pedOriginal.envio || pedOriginal.envio.includes('Retiro')) {
                    updateData.envio = `Encomienda ${agencia}`;
                }
            }

            // Si estaba Pendiente o Procesando, actualizar a Despachado
            if (!pedOriginal.estado || pedOriginal.estado === 'Pendiente' || pedOriginal.estado === 'Procesando') {
                updateData.estado = 'Despachado';
            }

            try {
                await updateDoc(doc(db, "pedidos", docId), updateData);

                // Actualizar en memoria local
                if (window.pedidosDBLocal && window.pedidosDBLocal[docId]) {
                    Object.assign(window.pedidosDBLocal[docId], updateData);
                }
                if (window._pedidosTodosCache) {
                    const idx = window._pedidosTodosCache.findIndex(p => p.id === docId);
                    if (idx !== -1) Object.assign(window._pedidosTodosCache[idx], updateData);
                }

                window.cerrarModalAclaracionGuia();
                window.limpiarZonaGuiaIA();

                // Recargar tabla de pedidos
                await window.cargarPedidos();

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Guía Asignada Exitosamente!',
                        html: `Se vinculó la guía <b>${numeroGuia}</b> (${agencia}) al pedido de <b>${pedOriginal.cliente || 'Cliente'}</b>.<br><br>¿Deseas copiar el mensaje de notificación para el cliente?`,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fab fa-whatsapp"></i> Copiar Mensaje WhatsApp',
                        cancelButtonText: 'Listo, cerrar',
                        confirmButtonColor: '#25D366',
                        cancelButtonColor: '#385723'
                    }).then(result => {
                        if (result.isConfirmed) {
                            window.copiarMensajeGuiaPedido(docId);
                        }
                    });
                } else {
                    alert(`¡Guía ${numeroGuia} asignada con éxito al pedido de ${pedOriginal.cliente}!`);
                }
            } catch (e) {
                console.error("Error al guardar guía:", e);
                alert("Ocurrió un error al guardar la guía en Firebase: " + (e.message || String(e)));
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check"></i> Confirmar y Guardar Guía';
                }
            }
        };

        /**
         * Abre el asignador de guía enfocado en un pedido específico desde su fila
         */
        window.abrirAsignadorGuiaParaPedido = function(docId) {
            const ped = window.pedidosDBLocal ? window.pedidosDBLocal[docId] : null;
            if (!ped) return;

            if (window._guiaImagenActualBase64) {
                window.procesarGuiaEnvioConIA(docId);
            } else {
                const dropzone = document.getElementById('dropzone-guia-envio');
                if (dropzone) {
                    dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    dropzone.style.borderColor = '#385723';
                    dropzone.style.background = '#eef3f0';
                    setTimeout(() => {
                        dropzone.style.borderColor = '#a3c2b2';
                        dropzone.style.background = '#ffffff';
                    }, 1400);
                }

                // Abrir modal con datos iniciales para edición/ingreso manual
                const datosGuiaManual = {
                    numero_guia: ped.tracking || ped.trackingMotorizado || '',
                    agencia_detectada: ped.envio?.includes('Zoom') ? 'Zoom' : (ped.envio?.includes('MRW') ? 'MRW' : (ped.envio?.includes('Motorizado') ? 'Motorizado' : 'Tealca')),
                    cliente_o_destinatario: ped.cliente || '',
                    destino_ciudad: ped.rutasMotorizado || '',
                    confianza: "alta",
                    dudas: []
                };
                const candidatos = [{
                    pedido: ped,
                    score: 1000,
                    razon: "Pedido seleccionado directamente"
                }];
                window.abrirModalAclaracionGuia(datosGuiaManual, candidatos, docId);
            }
        };

        /**
         * Genera el texto formal del mensaje de despacho
         */
        window.generarTextoMensajeGuia = function(ped) {
            if (!ped) return '';
            const cliente = ped.cliente || 'Estimado cliente';
            const agencia = ped.agenciaEnvio || (ped.envio?.includes('Motorizado') ? 'Motorizado (Caracas)' : 'Encomienda Nacional');
            const guia = ped.tracking || ped.trackingMotorizado || 'Pendiente';
            const fecha = ped.fechaGuia || ped.fecha || new Date().toLocaleDateString('es-VE');
            const destino = ped.rutasMotorizado || 'Dirección acordada';

            return `Estimado/a *${cliente}*, un saludo cordial de parte del equipo de *Inversiones FB Parts*. 🚗⚙️\n\n` +
                   `Le notificamos que su pedido ha sido *despachado con éxito*:\n\n` +
                   `📦 *Empresa / Transporte:* ${agencia}\n` +
                   `🔢 *Número de Guía:* ${guia}\n` +
                   `📅 *Fecha de Despacho:* ${fecha}\n` +
                   (destino && destino !== 'Dirección acordada' ? `📍 *Destino:* ${destino}\n\n` : `\n`) +
                   `Puede realizar el seguimiento en línea en la página oficial de la encomienda utilizando su número de guía.\n\n` +
                   `¡Muchas gracias por su confianza y preferencia! 🤝`;
        };

        /**
         * Copia el mensaje formal con guía al portapapeles
         */
        window.copiarMensajeGuiaPedido = async function(docId) {
            const ped = window.pedidosDBLocal ? window.pedidosDBLocal[docId] : null;
            if (!ped) {
                alert("Pedido no encontrado.");
                return;
            }
            const texto = window.generarTextoMensajeGuia(ped);
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(texto);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = texto;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Mensaje Copiado!',
                        html: `El mensaje con los datos de la guía para <b>${ped.cliente}</b> ha sido copiado al portapapeles.<br><br><pre style="text-align:left; background:#f1f5f9; padding:10px; border-radius:6px; font-size:11px; white-space:pre-wrap; max-height:160px; overflow-y:auto;">${texto}</pre>`,
                        confirmButtonColor: '#385723'
                    });
                } else {
                    alert("¡Mensaje copiado al portapapeles!");
                }
            } catch (e) {
                console.error("Error al copiar mensaje:", e);
                prompt("Copia el siguiente mensaje para el cliente:", texto);
            }
        };

        /**
         * Copia el mensaje desde dentro del modal antes de cerrar
         */
        window.copiarMensajePreAsignadoModal = function() {
            const docId = window._guiaPedidoSeleccionadoId;
            if (docId) {
                window.copiarMensajeGuiaPedido(docId);
            } else {
                alert("Selecciona primero un pedido.");
            }
        };

        /**
         * Abre un visor ampliado de la imagen de la guía
         */
        window.abrirVisorImagenGuia = function(src) {
            if (!src) return;
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    imageUrl: src,
                    imageAlt: 'Guía de Envío',
                    showConfirmButton: false,
                    showCloseButton: true,
                    background: '#ffffff',
                    width: '85vw'
                });
            } else {
                window.open(src, '_blank');
            }
        };


        window.abrirModalPedido = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if(!ped) return;
            
            document.getElementById('edit-pedido-id').value = docId;
            document.getElementById('edit-pedido-email').value = ped.email || '';
            document.getElementById('edit-pedido-cliente').value = ped.cliente || '';
            
            const envioSelect = document.getElementById('edit-pedido-envio');
            if (ped.envio === "Encomienda Tealca") envioSelect.value = "Encomienda Tealca/Zoom";
            else envioSelect.value = ped.envio || 'Retiro en Local';
            
            // 🚀 RESCATE BLINDADO DE GUÍAS
            let valAgencia = ped.tracking ? ped.tracking.trim() : '';
            let valMot = ped.trackingMotorizado ? ped.trackingMotorizado.trim() : '';
            
            // Si es Motorizado y la guía se quedó atrapada en la agencia, sácala de ahí
            if (envioSelect.value.includes('Motorizado')) {
                if (valAgencia !== '' && valMot === '') {
                    valMot = valAgencia;
                    valAgencia = '';
                }
            } else if (valAgencia.toUpperCase().includes('MOT') && valMot === '') {
                valMot = valAgencia;
                valAgencia = '';
            }

            document.getElementById('edit-pedido-tracking').value = valAgencia;
            document.getElementById('edit-pedido-tracking-mot').value = valMot;
            
            document.getElementById('edit-pedido-estado').value = ped.estado || 'Pendiente';
            
            document.getElementById('edit-pedido-motorizado').value = ped.motorizado || '';
            document.getElementById('edit-pedido-tarifa').value = ped.tarifaMotorizado || '';
            document.getElementById('edit-pedido-ruta').value = ped.rutasMotorizado || '';
            
            window.mostrarOpcionesMotorizado();

            const container = document.getElementById('edit-pedido-productos-container');
            container.innerHTML = '';
            
            let productosList = [];
            if (ped.productos && Array.isArray(ped.productos)) {
                productosList = ped.productos;
            } else if (ped.producto) {
                // Formato antiguo
                let preUni = (parseFloat(ped.total) || 0) / (parseFloat(ped.cantidad) || 1);
                productosList = [{ nombre: ped.producto, cantidad: ped.cantidad, precio: preUni }];
            }

            if (productosList.length > 0) {
                productosList.forEach((prod, index) => {
                    const cant = parseFloat(prod.cantidad) || 1;
                    const preUnitario = parseFloat(prod.precio) || 0;
                    const preTotal = (cant * preUnitario).toFixed(2);
                    
                    const div = document.createElement('div');
                    div.style = "background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 10px;";
                    div.innerHTML = `
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px;">Descripción del Repuesto</label>
                            <input type="text" class="edit-ped-item-desc" value="${prod.nombre || ''}">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Cantidad</label>
                                <input type="number" step="0.01" class="edit-ped-item-cant" value="${cant}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Precio Total ($)</label>
                                <input type="number" step="0.01" class="edit-ped-item-preciototal" value="${preTotal}">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="font-size: 12px; color: #999;">Este pedido no tiene productos registrados.</p>';
            }

            document.getElementById('modal-pedido').style.display = 'flex';
        };

        window.guardarCambiosPedido = async function() {
            const docId = document.getElementById('edit-pedido-id').value;
            const pedOriginal = window.pedidosDBLocal[docId] || {};
            const btn = document.getElementById('btn-save-pedido');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            let trackingVal = SecuritySanitizer.cleanText(document.getElementById('edit-pedido-tracking').value, 100);
            let trackingMotVal = SecuritySanitizer.cleanText(document.getElementById('edit-pedido-tracking-mot').value, 100);
            const envioVal = SecuritySanitizer.cleanText(document.getElementById('edit-pedido-envio').value, 50);
            const motorizadoVal = SecuritySanitizer.cleanText(document.getElementById('edit-pedido-motorizado').value, 50);
            const tarifaVal = SecuritySanitizer.sanitizeAmount(document.getElementById('edit-pedido-tarifa').value);

            // Limpieza antes de guardar a Firebase
            if (envioVal.includes('Motorizado')) {
                if (trackingVal !== '' && trackingMotVal === '') trackingMotVal = trackingVal;
                trackingVal = ''; 
            }

            if (!envioVal.includes('Retiro') && motorizadoVal !== '' && trackingMotVal === '') {
                const aleatorio = Math.floor(1000 + Math.random() * 9000);
                const letMot = motorizadoVal.substring(0,1).toUpperCase();
                trackingMotVal = `MOT${letMot}-${aleatorio}`;
            }

            const datosActualizados = {
                email: SecuritySanitizer.cleanText(document.getElementById('edit-pedido-email').value, 100),
                cliente: SecuritySanitizer.cleanText(document.getElementById('edit-pedido-cliente').value, 120),
                envio: envioVal,
                tracking: trackingVal,
                trackingMotorizado: trackingMotVal,
                estado: SecuritySanitizer.cleanText(document.getElementById('edit-pedido-estado').value, 50),
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? (pedOriginal.pagoMotorizadoEstatus || 'Pendiente') : '',
                rutasMotorizado: SecuritySanitizer.cleanAddress(document.getElementById('edit-pedido-ruta').value, 300)
            };

            try {
                await updateDoc(doc(db, "pedidos", docId), datosActualizados);
                window.cerrarModalPedido();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
            } catch (error) { 
                console.error(error); 
                alert("Error al actualizar la información del pedido."); 
            }
            btn.innerHTML = "Guardar"; btn.disabled = false;
        };

        window.eliminarPedido = async function() {
            const docId = document.getElementById('edit-pedido-id').value;
            if(!confirm("¿Estás seguro de eliminar este pedido del historial?")) return;
            try {
                await deleteDoc(doc(db, "pedidos", docId));
                window.cerrarModalPedido();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
            } catch (error) {
                console.error(error);
                alert("No se pudo eliminar el pedido.");
            }
        };

        // ==========================================
        // CATÁLOGO Y STOCK
        // ==========================================
        window.abrirModalCategorias = async function() {
            document.getElementById('modal-categorias').style.display = 'flex';
            await renderizarListaCategorias();
        };
        window.cerrarModalCategorias = function() { document.getElementById('modal-categorias').style.display = 'none'; };
        
        window.renderizarListaCategorias = async function() {
            const lista = document.getElementById('lista-categorias-modal');
            lista.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando categorías...</p>';
            try {
                const snap = await getDocs(collection(db, "categorias"));
                lista.innerHTML = '';
                if (snap.empty) { lista.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">No hay categorías.</p>'; return; }
                snap.forEach(docSnap => {
                    const cat = docSnap.data();
                    lista.innerHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                            <span style="font-weight: 500;">${cat.nombre}</span>
                            <button type="button" onclick="eliminarCategoria('${docSnap.id}')" style="background:#d9534f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </div>`;
                });
            } catch (error) { console.error(error); }
        };

        window.eliminarCategoria = async function(docId) {
            if(!confirm("¿Estás seguro de eliminar esta categoría?")) return;
            try {
                await deleteDoc(doc(db, "categorias", docId));
                await renderizarListaCategorias(); window.cargarCatalogoAdmin(); 
            } catch (error) { console.error(error); }
        };

        window.borrarTodoInventario = async function() {
            if(!confirm("⚠️ ¡ADVERTENCIA EXTREMA!\n¿Estás absolutamente seguro de querer BORRAR TODO EL CATÁLOGO Y STOCK?\nEsta acción NO se puede deshacer.")) return;
            
            const btn = document.querySelector('button[onclick="borrarTodoInventario()"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Borrando..."; 
            btn.disabled = true;

            try {
                const querySnapshot = await getDocs(collection(db, "productos"));
                const batchPromises = [];
                querySnapshot.forEach((docSnap) => {
                    batchPromises.push(deleteDoc(doc(db, "productos", docSnap.id)));
                });
                
                await Promise.all(batchPromises); 
                alert("✅ Todo el inventario ha sido borrado exitosamente.");
                window.cargarCatalogoAdmin(); 
                window.cargarDashboard();
            } catch (error) {
                console.error("Error borrando inventario:", error);
                alert("Error al intentar borrar el inventario.");
            }
            btn.innerHTML = originalText; 
            btn.disabled = false;
        };

        window.guardarNuevoRepuesto = async function(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            const catInput = SecuritySanitizer.cleanText(document.getElementById('prod-categoria').value, 50);
            let catId = catInput.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, '-');
            if (catId === "") catId = "otros";

            try {
                if (!window.mapaCategorias[catId]) {
                    await addDoc(collection(db, "categorias"), { nombre: catInput, id: catId });
                    window.mapaCategorias[catId] = catInput;
                }
            } catch(err) { console.error("Error guardando categoría", err); }

            let modalidadVal = document.getElementById('prod-modalidad').value;
            if (modalidadVal === 'custom') {
                modalidadVal = SecuritySanitizer.cleanText(document.getElementById('prod-modalidad-custom').value, 100) || 'Importación Personalizada';
            }

            const nombreProd = SecuritySanitizer.cleanText(document.getElementById('prod-nombre').value, 150);
            const slugProd = nombreProd
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            const nuevoProducto = {
                nombre: nombreProd,
                slug: slugProd,
                precio: SecuritySanitizer.sanitizeAmount(document.getElementById('prod-precio').value),
                stock: SecuritySanitizer.sanitizeInt(document.getElementById('prod-stock').value, 0),
                categoria: catId,
                imagen: SecuritySanitizer.formatImageUrl(document.getElementById('prod-imagen').value, 500),
                numero_parte: SecuritySanitizer.cleanText(document.getElementById('prod-numero-parte').value, 50),
                descripcion: SecuritySanitizer.cleanNote(document.getElementById('prod-descripcion').value, 1000),
                marca: SecuritySanitizer.cleanText(document.getElementById('prod-marca').value, 50),
                modelo: SecuritySanitizer.cleanText(document.getElementById('prod-modelo').value, 100),
                subcategoria: SecuritySanitizer.cleanText(document.getElementById('prod-subcategoria').value, 50),
                posicion: SecuritySanitizer.cleanText(document.getElementById('prod-posicion').value, 20),
                modalidad: modalidadVal,
                estado: "activo",
                ml_id: ""
            };

            try {
                await addDoc(collection(db, "productos"), nuevoProducto);
                alert("¡Repuesto guardado con éxito!");
                e.target.reset();
                const cust = document.getElementById('prod-modalidad-custom');
                if(cust) { cust.style.display = 'none'; cust.required = false; }
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error al guardar el repuesto."); }
            btn.innerHTML = "Guardar Repuesto"; btn.disabled = false;
        };

        window.cargarCatalogoAdmin = async function() {
            const selectCat = document.getElementById('prod-categoria');
            const selectEditCat = document.getElementById('edit-categoria');
            const selectFiltroAdmin = document.getElementById('admin-category-filter');
            const selectProdManual = document.getElementById('product-select');
            const selectInventarioCot = document.getElementById('select-inventario-cot');
            const selectInventarioFac = document.getElementById('select-inventario-fac'); 
            const selectInventarioPed = document.getElementById('select-inventario-ped'); 
            
            const datalistCats = document.getElementById('lista-categorias');
            if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML = '<option value="">Seleccionar...</option>';
            if(datalistCats) datalistCats.innerHTML = '';
            if(selectEditCat) selectEditCat.innerHTML = '';
            if(selectFiltroAdmin) selectFiltroAdmin.innerHTML = '<option value="todos">Todas las Categorías</option>';
            if(selectProdManual) selectProdManual.innerHTML = '<option value="">Selecciona repuesto...</option>';
            if(selectInventarioCot) selectInventarioCot.innerHTML = '<option value="">Selecciona repuesto...</option>';
            if(selectInventarioFac) selectInventarioFac.innerHTML = '<option value="">Selecciona repuesto...</option>';
            if(selectInventarioPed) selectInventarioPed.innerHTML = '<option value="">Selecciona repuesto...</option>';
            window.mapaCategorias = {};

            try {
                const catSnap = await getDocs(collection(db, "categorias"));
                catSnap.forEach(docSnap => {
                    const cat = docSnap.data();
                    window.mapaCategorias[cat.id] = cat.nombre;
                    const opt = `<option value="${cat.id}">${cat.nombre}</option>`;
                    if(selectCat && selectCat.tagName === 'SELECT') selectCat.innerHTML += opt;
                    if(datalistCats) datalistCats.innerHTML += `<option value="${cat.nombre}"></option>`;
                    if(selectFiltroAdmin) selectFiltroAdmin.innerHTML += opt;
                });
            } catch (e) { console.error(e); }

            const tablaProd = document.getElementById('products-table-body');
            if(tablaProd) tablaProd.innerHTML = `<tr><td colspan="5" style="text-align: center;">Buscando repuestos...</td></tr>`;
            
            try {
                const prodSnap = await getDocs(collection(db, "productos"));
                if(tablaProd) tablaProd.innerHTML = '';
                window.productosDBLocal = {};
                
                prodSnap.forEach(docSnap => {
                    const prod = docSnap.data();
                    const docId = docSnap.id;
                    window.productosDBLocal[docId] = prod;
                    const stock = prod.stock !== undefined ? prod.stock : 1;
                    
                    if(tablaProd) {
                        const badgeEstado = prod.estado === 'activo' ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Activo</span>` : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Inactivo</span>`;
                        
                        let bMarca = '';
                        if(prod.marca && prod.marca !== "Universal/Multi-marca" && prod.marca !== "") {
                            bMarca = `<span class="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-car-side"></i> ${prod.marca}</span>`;
                        }
                        
                        let bPos = '';
                        if(prod.posicion && prod.posicion !== "N/A" && prod.posicion !== "") {
                            bPos = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-arrows-alt-h"></i> ${prod.posicion}</span>`;
                        }
                        
                        let bMod = '';
                        if(prod.modalidad && prod.modalidad.toLowerCase().includes("importación")) {
                            bMod = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-plane-arrival"></i> ${prod.modalidad}</span>`;
                        } else if(prod.modalidad) {
                            bMod = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-box"></i> ${prod.modalidad}</span>`;
                        }

                        // 🚀 LIMPIEZA DE TEXTOS
                        const safeNombre = (prod.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeImg = (prod.imagen || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeNumParte = (prod.numero_parte || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        const safeDesc = (prod.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');

                        tablaProd.innerHTML += `
                            <tr class="admin-prod-row" data-category="${prod.categoria}" data-doc-id="${docId}">
                                <td style="vertical-align: top; padding-top: 12px;"><img src="${SecuritySanitizer.formatImageUrl(prod.imagen || '', 500)}" width="60" style="border-radius:4px; border:1px solid #eee; background:#f0f0f0; object-fit:cover;" onerror="this.onerror=null; this.src='img/logo-fb-parts.png';"></td>
                                <td class="prod-nombre-col" style="vertical-align: top; padding-top: 12px;">
                                    <div style="margin-bottom:3px; line-height: 1.2;"><strong>${prod.nombre}</strong> <br>${badgeEstado}</div>
                                    <div class="flex flex-wrap gap-1 mt-2 mb-1">
                                        ${bMarca}
                                        ${bPos}
                                    </div>
                                    ${bMod}
                                    ${prod.modelo ? `<div class="text-[11px] text-gray-500 mt-2"><i class="fas fa-cogs"></i> Mod/Motor: ${prod.modelo}</div>` : ''}
                                    ${prod.numero_parte && prod.numero_parte !== 'N/A' && prod.numero_parte !== 'Consultar con asesor' ? `<div class="text-[10px] text-emerald-700 font-mono font-bold mt-1"><i class="fas fa-barcode"></i> OEM: ${prod.numero_parte}</div>` : ''}
                                </td>
                                <td style="vertical-align: top; padding-top: 12px;"><span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${prod.categoria}</span>${prod.subcategoria ? `<br><span style="font-size:10px; color:#777; display:block; margin-top:4px;">↳ ${prod.subcategoria}</span>` : ''}</td>
                                <td><strong>$${Number(prod.precio).toFixed(2)}</strong><br><span style="font-size:12px;color:#666;">Stock: ${stock}</span></td>
                                <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 100px;">
                                    <button type="button" onclick="abrirEdicion('${docId}')" title="Editar Repuesto" style="background:#1d6fa5; color:white; border:none; padding:7px 10px; border-radius:5px; cursor:pointer; font-size:12px; transition:all 0.2s;"><i class="fas fa-edit"></i></button>
                                    <button type="button" onclick="completarRepuestoConIA('${docId}')" title="Autocompletar Ficha con IA" style="background:#385723; color:white; border:none; padding:7px 10px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold; display:inline-flex; align-items:center; gap:4px; transition:all 0.2s;" onmouseover="this.style.background='#2d461c'" onmouseout="this.style.background='#385723'"><i class="fas fa-magic"></i> <span style="font-size:10.5px;">IA</span></button>
                                </td>
                            </tr>`;
                    }

                    if(selectProdManual) selectProdManual.innerHTML += `<option value="${prod.nombre}" data-price="${prod.precio}">${prod.nombre} - $${prod.precio}</option>`;
                    
                    const optCots = `<option value="${docSnap.id}" data-nombre="${(prod.nombre || '').replace(/"/g, '&quot;')}" data-precio="${prod.precio}">${prod.nombre} - $${prod.precio}</option>`;
                    if(selectInventarioCot) selectInventarioCot.innerHTML += optCots;
                    if(selectInventarioFac) selectInventarioFac.innerHTML += optCots;
                    if(selectInventarioPed) selectInventarioPed.innerHTML += optCots;
                });
            } catch (e) { console.error(e); }
            if (window.actualizarContadorSinDescripcion) {
                window.actualizarContadorSinDescripcion();
            }
            window.filtrarTablaAdmin();
        };

        window.filtrarTablaAdmin = function() {
            const filtroCat = document.getElementById('admin-category-filter')?.value || 'todos';
            const texto = document.getElementById('admin-search-filter')?.value.toLowerCase() || '';
            document.querySelectorAll('.admin-prod-row').forEach(fila => {
                const cat = fila.getAttribute('data-category');
                const docId = fila.getAttribute('data-doc-id');
                const prod = window.productosDBLocal ? window.productosDBLocal[docId] : null;
                const nom = fila.querySelector('.prod-nombre-col')?.textContent.toLowerCase() || '';
                
                let pasaFiltroDesc = true;
                if (window._filtroSoloSinDesc && prod) {
                    pasaFiltroDesc = window.esProductoIncompleto(prod);
                }

                fila.style.display = (pasaFiltroDesc && (filtroCat === 'todos' || cat === filtroCat) && nom.includes(texto)) ? '' : 'none';
            });
        };

        // ==========================================
        // BASE DE CLIENTES (EDICIÓN Y CARGA MASIVA)
        // ==========================================
        window.cancelarEdicionCliente = function() {
            document.getElementById('form-cliente-db').reset();
            document.getElementById('db-cliente-id').value = '';
            document.getElementById('btn-guardar-cliente').textContent = "Guardar en Base de Datos";
            document.getElementById('btn-cancelar-edicion-cli').style.display = 'none';
            document.getElementById('titulo-form-cliente').innerHTML = '<i class="fas fa-user-plus"></i> Registrar Nuevo Cliente';
        };

        window.editarClienteDB = function(docId) {
            const cli = window.clientesDBLocal[docId];
            if(!cli) return;
            document.getElementById('db-cliente-id').value = docId;
            document.getElementById('db-cliente-nombre').value = cli.nombre || '';
            document.getElementById('db-cliente-rif').value = cli.rif || '';
            document.getElementById('db-cliente-dir').value = cli.direccion || '';
            document.getElementById('db-cliente-tel').value = cli.telefono || '';
            
            document.getElementById('btn-guardar-cliente').textContent = "Actualizar Cliente";
            document.getElementById('btn-cancelar-edicion-cli').style.display = 'block';
            document.getElementById('titulo-form-cliente').innerHTML = '<i class="fas fa-user-edit"></i> Editar Cliente';
            
            document.getElementById('titulo-form-cliente').scrollIntoView({ behavior: 'smooth' });
        };

        window.guardarNuevoClienteDB = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-guardar-cliente');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            const docId = document.getElementById('db-cliente-id').value;
            const dataCliente = {
                nombre: SecuritySanitizer.cleanText(document.getElementById('db-cliente-nombre').value, 120),
                rif: SecuritySanitizer.cleanText(document.getElementById('db-cliente-rif').value, 30),
                direccion: SecuritySanitizer.cleanAddress(document.getElementById('db-cliente-dir').value, 300),
                telefono: SecuritySanitizer.cleanPhone(document.getElementById('db-cliente-tel').value)
            };

            try {
                if(docId) {
                    await updateDoc(doc(db, "clientes", docId), dataCliente);
                    if(window.registrarAuditoria) window.registrarAuditoria("EDITAR CLIENTE", "Se modificó el cliente: " + dataCliente.nombre + " (" + dataCliente.rif + ")");
                    alert("¡Cliente actualizado con éxito!");
                } else {
                    await addDoc(collection(db, "clientes"), dataCliente);
                    if(window.registrarAuditoria) window.registrarAuditoria("CREAR CLIENTE", "Se registró el cliente: " + dataCliente.nombre + " (" + dataCliente.rif + ")");
                    alert("¡Cliente registrado en la base de datos con éxito!");
                }
                window.cancelarEdicionCliente();
                window.cargarBaseClientes();
            } catch (error) { console.error(error); alert("Error al procesar el cliente."); }
            btn.innerHTML = docId ? "Actualizar Cliente" : "Guardar en Base de Datos"; 
            btn.disabled = false;
        };

        window.procesarPegadoMasivoClientes = async function() {
            const texto = document.getElementById('excel-paste-clientes').value.trim();
            const btn = document.getElementById('btn-excel-upload-clientes');
            if(!texto) { alert("Pega el contenido de tu Excel."); return; }

            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Procesando..."; btn.disabled = true;
            const lineas = texto.split('\n');
            let importados = 0; let ignorados = 0;
            
            try {
                for(let linea of lineas) {
                    const columnas = linea.split('\t'); 
                    if(columnas.length >= 2) {
                        const nombre = columnas[0] ? columnas[0].trim() : "";
                        const rif = columnas[1] ? columnas[1].trim() : "";
                        const direccion = columnas[2] ? columnas[2].trim() : "NO APLICA";
                        const telefono = columnas[3] ? columnas[3].trim() : "NO APLICA";
                        
                        if(nombre && rif && nombre.toLowerCase() !== "nombre" && nombre.toLowerCase() !== "cliente") {
                            let existe = false;
                            for (const key in window.clientesDBLocal) {
                                if (window.clientesDBLocal[key].rif && window.clientesDBLocal[key].rif.trim().toUpperCase() === rif.toUpperCase()) {
                                    existe = true; break;
                                }
                            }

                            if(!existe) {
                                await addDoc(collection(db, "clientes"), { nombre, rif, direccion, telefono });
                                importados++; window.clientesDBLocal["temp_" + importados] = { rif: rif }; 
                            } else { ignorados++; }
                        }
                    }
                }
                alert(`¡Carga Completada!\n\n✅ Clientes nuevos subidos: ${importados}\n⚠️ Ignorados (ya existían): ${ignorados}`);
                document.getElementById('excel-paste-clientes').value = ""; window.cargarBaseClientes();
            } catch(e) { console.error(e); alert("Ocurrió un error al procesar el Excel de clientes."); }
            btn.innerHTML = "Subir Clientes"; btn.disabled = false;
        };

        window.cargarBaseClientes = async function() {
            const tbody = document.getElementById('clients-table-body');
            const selectCotizacion = document.getElementById('cot-selector-clientes');
            const selectFactura = document.getElementById('fac-selector-clientes'); 
            const selectPedido = document.getElementById('ped-selector-clientes');
            
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Cargando base de datos...</td></tr>`;
            if(selectCotizacion) selectCotizacion.innerHTML = '<option value="">Selecciona un cliente o aseguradora...</option>';
            if(selectFactura) selectFactura.innerHTML = '<option value="">Selecciona un cliente o mostrador...</option>';
            if(selectPedido) selectPedido.innerHTML = '<option value="">Selecciona un cliente registrado...</option>';
            window.clientesDBLocal = {};

            try {
                const snap = await getDocs(collection(db, "clientes"));
                if(tbody) tbody.innerHTML = '';
                
                if(snap.empty && tbody) {
                     tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay clientes registrados.</td></tr>`;
                     return;
                }
                
                snap.forEach((docSnap) => {
                    const cli = docSnap.data();
                    const docId = docSnap.id;
                    window.clientesDBLocal[docId] = cli;

                    if(selectCotizacion) selectCotizacion.innerHTML += `<option value="${docId}">${cli.nombre} - ${cli.rif}</option>`;
                    if(selectFactura) selectFactura.innerHTML += `<option value="${docId}">${cli.nombre} - ${cli.rif}</option>`;
                    if(selectPedido) selectPedido.innerHTML += `<option value="${docId}">${cli.nombre} - ${cli.rif}</option>`;

                    if(tbody) {
                        tbody.innerHTML += `
                            <tr>
                                <td><strong>${cli.nombre}</strong></td>
                                <td>${cli.rif}</td>
                                <td>${cli.direccion}</td>
                                <td>${cli.telefono}</td>
                                <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 90px;">
                                    <button type="button" onclick="editarClienteDB('${docId}')" style="background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Editar Datos"><i class="fas fa-edit"></i></button>
                                    <button type="button" onclick="eliminarClienteDB('${docId}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar Cliente"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>`;
                    }
                });
            } catch (error) { 
                console.error(error); 
                if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar: ${error.message}</td></tr>`;
            }
        };

        window.eliminarClienteDB = async function(docId) {
            if(!confirm("¿Eliminar este cliente de la base de datos?")) return;
            try { 
                let c = window.clientesDBLocal ? window.clientesDBLocal[docId] : null;
                let cname = c ? c.nombre : docId;
                await deleteDoc(doc(db, "clientes", docId)); 
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR CLIENTE", "Se eliminó el cliente: " + cname);
                window.cargarBaseClientes(); 
            } catch (error) { console.error(error); }
        };

        window.abrirEdicion = function(docId) {
            const prod = window.productosDBLocal[docId];
            if(!prod) { alert("Error cargando datos del producto."); return; }
            
            document.getElementById('edit-id').value = docId;
            document.getElementById('edit-nombre').value = prod.nombre || '';
            document.getElementById('edit-precio').value = prod.precio || 0;
            document.getElementById('edit-stock').value = prod.stock !== undefined ? prod.stock : 1;
            
            let catName = (window.mapaCategorias && window.mapaCategorias[prod.categoria]) ? window.mapaCategorias[prod.categoria] : (prod.categoria || '');
            document.getElementById('edit-categoria').value = catName;
            
            document.getElementById('edit-marca').value = prod.marca || '';
            document.getElementById('edit-modelo').value = prod.modelo || '';
            document.getElementById('edit-subcategoria').value = prod.subcategoria || '';
            // Posiciones (array o string legacy)
            const posArr = Array.isArray(prod.posiciones) ? prod.posiciones
                : (prod.posicion && prod.posicion !== 'N/A' ? [prod.posicion] : []);
            document.getElementById('edit-pos-rh').checked = posArr.includes('RH');
            document.getElementById('edit-pos-lh').checked = posArr.includes('LH');
            document.getElementById('edit-pos-na').checked = posArr.includes('N/A') || posArr.length === 0;
            
            const modalidad = prod.modalidad || 'Entrega Inmediata';
            const selectModalidad = document.getElementById('edit-modalidad');
            const customModalidad = document.getElementById('edit-modalidad-custom');
            
            let foundOption = false;
            for(let i=0; i<selectModalidad.options.length; i++){
                if(selectModalidad.options[i].value === modalidad) { foundOption = true; break; }
            }
            
            if(foundOption || modalidad === '') {
                selectModalidad.value = modalidad;
                customModalidad.style.display = 'none';
                customModalidad.value = '';
            } else {
                selectModalidad.value = 'custom';
                customModalidad.style.display = 'block';
                customModalidad.value = modalidad;
            }
            
            document.getElementById('edit-estado').value = prod.estado || 'activo';
            // Poblar galería: usa array imagenes si existe, si no usa el campo imagen antiguo
            const imagenesExistentes = Array.isArray(prod.imagenes) && prod.imagenes.length > 0
                ? prod.imagenes
                : (prod.imagen ? [prod.imagen] : []);
            window._poblarGaleria(imagenesExistentes);
            document.getElementById('edit-numero-parte').value = (prod.numero_parte && prod.numero_parte !== 'undefined') ? prod.numero_parte : '';
            document.getElementById('edit-descripcion').value = (prod.descripcion && prod.descripcion !== 'undefined') ? prod.descripcion.replace(/\\n/g, '\n') : '';
            
            document.getElementById('modal-edicion').style.display = 'flex';
        };

        window.cerrarModalEdicion = function() { document.getElementById('modal-edicion').style.display = 'none'; };

        // ==========================================
        // 📷 GALERÍA DE IMÁGENES - HELPERS
        // ==========================================
        window._galeriaEditCounter = 0;

        window.agregarCampoImagen = function(url) {
            const contenedor = document.getElementById('galeria-imagenes-edit');
            if (!contenedor) return;
            const idx = window._galeriaEditCounter++;
            const esPrimera = contenedor.children.length === 0;
            const div = document.createElement('div');
            div.id = `galeria-row-${idx}`;
            div.style.cssText = 'display:flex; align-items:center; gap:8px;';
            div.innerHTML = `
                ${esPrimera ? '<span title="Foto principal" style="font-size:16px; flex-shrink:0;">⭐</span>' : '<span style="font-size:16px; flex-shrink:0; opacity:0.3;">📷</span>'}
                <input type="text" value="${url || ''}" placeholder="Pega link de Google Drive, Imgur, Wix..." 
                    style="flex:1; padding:7px 10px; border:1px solid #ccc; border-radius:6px; font-size:12px;"
                    oninput="window._actualizarPreviewGaleria(this)"
                    onblur="window._actualizarPreviewGaleria(this)">
                <img src="" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #eee; background:#f5f5f5; display:none;" 
                    id="prev-${idx}" onerror="this.onerror=null; this.style.display='none';">
                ${esPrimera ? '' : `<button type="button" onclick="window._eliminarCampoImagen('galeria-row-${idx}')" style="background:#d9534f; color:white; border:none; width:28px; height:28px; border-radius:4px; cursor:pointer; flex-shrink:0;"><i class='fas fa-trash'></i></button>`}
            `;
            contenedor.appendChild(div);
            if (url) {
                const img = div.querySelector(`#prev-${idx}`);
                const displayUrl = SecuritySanitizer.formatImageUrl(url, 500);
                if (img && displayUrl) { img.src = displayUrl; img.style.display = 'block'; }
            }
        };

        window._actualizarPreviewGaleria = function(input) {
            const row = input.closest('div[id^="galeria-row-"]');
            if (!row) return;
            const img = row.querySelector('img');
            if (!img) return;
            const url = SecuritySanitizer.formatImageUrl(input.value.trim(), 500);
            if (url) { img.src = url; img.style.display = 'block'; }
            else { img.style.display = 'none'; }
        };

        window._eliminarCampoImagen = function(rowId) {
            const row = document.getElementById(rowId);
            if (row) row.remove();
        };

        window._obtenerUrlsGaleria = function() {
            const contenedor = document.getElementById('galeria-imagenes-edit');
            if (!contenedor) return [];
            const urls = [];
            contenedor.querySelectorAll('input[type="text"]').forEach(inp => {
                const raw = inp.value.trim();
                if (raw) urls.push(SecuritySanitizer.formatImageUrl(raw, 500));
            });
            return urls;
        };

        window._poblarGaleria = function(imagenes) {
            const contenedor = document.getElementById('galeria-imagenes-edit');
            if (!contenedor) return;
            contenedor.innerHTML = '';
            window._galeriaEditCounter = 0;
            const arr = Array.isArray(imagenes) ? imagenes : (imagenes ? [imagenes] : []);
            if (arr.length === 0) {
                window.agregarCampoImagen('');
            } else {
                arr.forEach(url => window.agregarCampoImagen(url));
            }
        };

        window.guardarCambiosProducto = async function() {
            const docId = document.getElementById('edit-id').value;
            const btn = document.getElementById('btn-save-edit');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            let rawCat = SecuritySanitizer.cleanText(document.getElementById('edit-categoria').value, 50);
            let catId = rawCat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
            if (catId === "") catId = "otros";

            try {
                if (!window.mapaCategorias || !window.mapaCategorias[catId]) {
                    await addDoc(collection(db, "categorias"), { nombre: rawCat, id: catId });
                    if(window.mapaCategorias) window.mapaCategorias[catId] = rawCat;
                }
            } catch(err) { console.error("Error guardando categoría", err); }

            let modalidadVal = document.getElementById('edit-modalidad').value;
            if(modalidadVal === 'custom') {
                modalidadVal = SecuritySanitizer.cleanText(document.getElementById('edit-modalidad-custom').value, 100) || 'Entrega Inmediata';
            }

            const nombreActualizado = SecuritySanitizer.cleanText(document.getElementById('edit-nombre').value, 150);
            const slugActualizado = nombreActualizado
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            const datosActualizados = {
                nombre: nombreActualizado,
                slug: slugActualizado,
                precio: SecuritySanitizer.sanitizeAmount(document.getElementById('edit-precio').value),
                stock: SecuritySanitizer.sanitizeInt(document.getElementById('edit-stock').value, 0),
                categoria: catId,
                marca: SecuritySanitizer.cleanText(document.getElementById('edit-marca').value, 50),
                modelo: SecuritySanitizer.cleanText(document.getElementById('edit-modelo').value, 100),
                subcategoria: SecuritySanitizer.cleanText(document.getElementById('edit-subcategoria').value, 50),
                posicion: (() => { // legacy: first selected or N/A
                    if(document.getElementById('edit-pos-rh').checked) return 'RH';
                    if(document.getElementById('edit-pos-lh').checked) return 'LH';
                    return 'N/A';
                })(),
                posiciones: (() => {
                    const p = [];
                    if(document.getElementById('edit-pos-rh').checked) p.push('RH');
                    if(document.getElementById('edit-pos-lh').checked) p.push('LH');
                    if(document.getElementById('edit-pos-na').checked) p.push('N/A');
                    return p.length ? p : ['N/A'];
                })(),
                modalidad: modalidadVal,
                estado: SecuritySanitizer.cleanText(document.getElementById('edit-estado').value, 30),
                imagen: window._obtenerUrlsGaleria()[0] || '',
                imagenes: window._obtenerUrlsGaleria(),
                numero_parte: SecuritySanitizer.cleanText(document.getElementById('edit-numero-parte').value, 50),
                descripcion: SecuritySanitizer.cleanNote(document.getElementById('edit-descripcion').value, 1000)
            };

            try {
                await updateDoc(doc(db, "productos", docId), datosActualizados);

                // Sincronizar en segundo plano con web_destacados si el repuesto está publicado allí
                try {
                    const snapDest = await getDocs(collection(db, "web_destacados"));
                    snapDest.forEach(async dSnap => {
                        const d = dSnap.data();
                        if (d.productoId === docId || d.slug === datosActualizados.slug || d.nombre === datosActualizados.nombre) {
                            await updateDoc(doc(db, "web_destacados", dSnap.id), {
                                nombre: datosActualizados.nombre,
                                slug: datosActualizados.slug,
                                precioRegular: datosActualizados.precio,
                                categoria: datosActualizados.categoria,
                                marca: datosActualizados.marca,
                                modelo: datosActualizados.modelo,
                                subcategoria: datosActualizados.subcategoria,
                                imagen: datosActualizados.imagen
                            });
                        }
                    });
                } catch(eDest) { console.warn("Aviso al sincronizar con web_destacados:", eDest); }

                if(window.registrarAuditoria) window.registrarAuditoria("EDITAR PRODUCTO", "Se modificó el producto: " + datosActualizados.nombre);
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch (error) { console.error(error); alert("Ocurrió un error al guardar los cambios."); }
            btn.innerHTML = "Guardar"; btn.disabled = false;
        };

        window.eliminarProducto = async function() {
            const docId = document.getElementById('edit-id').value;
            const nombreProd = document.getElementById('edit-nombre').value;
            if(!confirm("¿Estás seguro de eliminar permanentemente este repuesto?")) return;
            try {
                await deleteDoc(doc(db, "productos", docId));
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR PRODUCTO", "Se eliminó el producto: " + nombreProd);
                window.cerrarModalEdicion(); 
                window.cargarCatalogoAdmin(); 
                window.cargarDashboard();
                alert("Repuesto eliminado con éxito.");
            } catch (error) { console.error(error); alert("No se pudo eliminar el repuesto."); }
        };

        window.procesarPegadoMasivo = async function() {
            const texto = document.getElementById('excel-paste').value.trim();
            const btn = document.getElementById('btn-excel-upload');
            if(!texto) { alert("Pega el contenido de tu Excel."); return; }

            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Procesando..."; btn.disabled = true;
            const lineas = texto.split('\n');
            let importados = 0; let nuevasCatCount = 0;
            
            try {
                for(let linea of lineas) {
                    const columnas = linea.split('\t'); 
                    const mlvIndex = columnas.findIndex(col => col.trim().startsWith('MLV'));

                    if(mlvIndex !== -1) {
                        const ml_id = columnas[mlvIndex].trim();
                        const nombre = columnas[mlvIndex + 2] ? columnas[mlvIndex + 2].trim() : "";
                        const numero_parte = columnas[mlvIndex + 3] ? columnas[mlvIndex + 3].trim() : "";
                        let stockRaw = columnas[mlvIndex + 4] ? columnas[mlvIndex + 4].trim() : "1";
                        const stock = parseInt(stockRaw) || 1;
                        let precioRaw = columnas[mlvIndex + 5] ? columnas[mlvIndex + 5].replace(/US\$|Bs\./g, '').trim() : "0";
                        const precio = parseFloat(precioRaw.replace(',', '.')) || 0;
                        const categoriaExcel = columnas[mlvIndex + 12] ? columnas[mlvIndex + 12].trim() : "Otros";
                        let catId = categoriaExcel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
                        if (catId === "") catId = "otros";

                        if (!window.mapaCategorias[catId]) {
                            await addDoc(collection(db, "categorias"), { nombre: categoriaExcel, id: catId });
                            window.mapaCategorias[catId] = categoriaExcel; nuevasCatCount++;
                        }
                        const imagen = "https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png"; 
                        if(nombre && precio > 0 && nombre.toLowerCase() !== "título") {
                            await addDoc(collection(db, "productos"), {
                                nombre, precio, stock, categoria: catId, estado: "activo", imagen, ml_id, numero_parte
                            });
                            importados++;
                        }
                    }
                }
                alert(`¡Carga Completada!\n\n✅ Repuestos subidos: ${importados}\n📁 Categorías creadas: ${nuevasCatCount}`);
                document.getElementById('excel-paste').value = ""; 
                window.cargarCatalogoAdmin();
                window.cargarDashboard();
            } catch(e) { console.error(e); alert("Ocurrió un error al procesar el Excel."); }
            btn.innerHTML = "Subir y Crear Categorías"; btn.disabled = false;
        };

        // ==========================================
        // 🚀 FACTURACIÓN Y COTIZACIONES
        // ==========================================
        window.seleccionarClienteFactura = function() {
            const clienteId = document.getElementById('fac-selector-clientes').value;
            if(clienteId && window.clientesDBLocal[clienteId]) {
                const cli = window.clientesDBLocal[clienteId];
                document.getElementById('fac-cliente').value = cli.nombre;
                document.getElementById('fac-rif').value = cli.rif;
                document.getElementById('fac-direccion').value = cli.direccion;
                document.getElementById('fac-telefono').value = cli.telefono;
                window.actualizarPreviewFactura();
            }
        };

        window.agregarItemDesdeInventarioFactura = function() {
            const select = document.getElementById('select-inventario-fac');
            const selectedIndex = select.selectedIndex;
            if (selectedIndex <= 0) { alert("Selecciona un repuesto del inventario primero."); return; }

            const opt = select.options[selectedIndex];
            const nombre = opt.getAttribute('data-nombre');
            
            const monedaSeleccionada = document.getElementById('fac-moneda').value.split('|')[0];
            const tasaMostrada = parseFloat(document.getElementById('fac-tasa').value) || 1;
            const precioBaseUSD = parseFloat(opt.getAttribute('data-precio')) || 0;
            
            let precioCalculado = precioBaseUSD;
            const simbolo = document.getElementById('fac-moneda').value.split('|')[1];

            if (monedaSeleccionada === "VES") {
                precioCalculado = precioBaseUSD * tasaMostrada;
            } else if (monedaSeleccionada === "EUR") {
                if (tasaMostrada > 10) { precioCalculado = precioBaseUSD * 0.92; } 
                else { precioCalculado = precioBaseUSD * tasaMostrada; }
            }

            const container = document.getElementById('facturacion-items-container');
            const row = document.createElement('div');
            row.className = 'facturacion-item-row';
            row.innerHTML = `
                <input type="number" class="fac-item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalFactura()">
                <input type="text" class="fac-item-desc" value="${nombre}" placeholder="Descripción" oninput="actualizarPreviewFactura()">
                <input type="number" step="0.01" class="fac-item-precio" value="${precioCalculado.toFixed(2)}" placeholder="Precio" oninput="calcularTotalFactura()">
                <input type="number" step="0.01" class="fac-item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalFactura()">
                <input type="text" class="fac-item-total-line" value="${simbolo}${precioCalculado.toFixed(2)}" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalFactura();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            select.selectedIndex = 0;
            window.calcularTotalFactura();
        };

        window.agregarFilaFacturaVacia = function() {
            const container = document.getElementById('facturacion-items-container');
            const row = document.createElement('div');
            row.className = 'facturacion-item-row';
            const simbolo = document.getElementById('fac-moneda').value.split('|')[1];
            row.innerHTML = `
                <input type="number" class="fac-item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalFactura()">
                <input type="text" class="fac-item-desc" placeholder="Escribe el repuesto de reventa..." oninput="actualizarPreviewFactura()">
                <input type="number" step="0.01" class="fac-item-precio" value="0.00" placeholder="Precio" oninput="calcularTotalFactura()">
                <input type="number" step="0.01" class="fac-item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalFactura()">
                <input type="text" class="fac-item-total-line" value="${simbolo}0.00" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalFactura();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            window.calcularTotalFactura();
        };

        window.calcularTotalFactura = function() {
            const rows = document.querySelectorAll('.facturacion-item-row');
            let subtotal = 0; let totalDescuento = 0;
            const simbolo = document.getElementById('fac-moneda').value.split('|')[1];

            rows.forEach(row => {
                const cant = parseFloat(row.querySelector('.fac-item-cant').value) || 0;
                const precio = parseFloat(row.querySelector('.fac-item-precio').value) || 0;
                const desc = parseFloat(row.querySelector('.fac-item-descval').value) || 0;
                const totalLinea = (cant * precio) - desc;
                
                row.querySelector('.fac-item-total-line').value = `${simbolo}${totalLinea.toFixed(2)}`;
                subtotal += (cant * precio);
                totalDescuento += desc;
            });

            const baseImponible = subtotal - totalDescuento;
            const iva = baseImponible * 0.16;
            const totalGeneral = baseImponible + iva;

            if(document.getElementById('fac-subtotal')) document.getElementById('fac-subtotal').innerText = subtotal.toFixed(2);
            if(document.getElementById('fac-total-desc')) document.getElementById('fac-total-desc').innerText = totalDescuento.toFixed(2);
            if(document.getElementById('fac-iva')) document.getElementById('fac-iva').innerText = iva.toFixed(2);
            if(document.getElementById('fac-total-general')) document.getElementById('fac-total-general').innerText = totalGeneral.toFixed(2);

            window.actualizarPreviewFactura();
        };

        function construirHTMLFactura(datos = null) {
            let cliente, rif, direccion, telefono, itemsHTML = '', subtotal, descuento, iva, total, nro;
            let moneda, simbolo, disponibilidad, tasaGuardada;
            const fechaActual = new Date().toLocaleDateString("es-VE");

            if (datos) {
                cliente = datos.cliente; rif = datos.rif; direccion = datos.direccion; telefono = datos.telefono;
                subtotal = datos.subtotal; descuento = datos.descuento; iva = datos.iva; total = datos.total;
                nro = datos.nro; moneda = datos.moneda || 'USD'; simbolo = datos.simbolo || '$';
                disponibilidad = datos.disponibilidad || 'ENTREGA INMEDIATA';
                tasaGuardada = datos.tasa || '1';

                datos.items.forEach(item => {
                    const totalLinea = (parseFloat(item.cantidad) * parseFloat(item.precioUnitario)) - parseFloat(item.descuento);
                    itemsHTML += `
                        <tr style="border-bottom: 1px solid #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                            <td style="padding: 6px 10px; text-align: center;">${item.cantidad}</td>
                            <td style="padding: 6px 10px;">${item.descripcion}</td>
                            <td style="padding: 6px 10px; text-align: right;">${simbolo}${Number(item.precioUnitario).toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; color: #d9534f;">-${simbolo}${Number(item.descuento).toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; font-weight: bold;">${simbolo}${totalLinea.toFixed(2)}</td>
                        </tr>
                    `;
                });
            } else {
                cliente = document.getElementById('fac-cliente')?.value || 'Cliente Mostrador';
                rif = document.getElementById('fac-rif')?.value || '';
                direccion = document.getElementById('fac-direccion')?.value || '';
                telefono = document.getElementById('fac-telefono')?.value || '';
                subtotal = document.getElementById('fac-subtotal')?.innerText || '0.00';
                descuento = document.getElementById('fac-total-desc')?.innerText || '0.00';
                iva = document.getElementById('fac-iva')?.innerText || '0.00';
                total = document.getElementById('fac-total-general')?.innerText || '0.00';
                nro = document.getElementById('fac-nro')?.value || '0000';
                disponibilidad = document.getElementById('fac-disponibilidad')?.value || 'ENTREGA INMEDIATA';
                tasaGuardada = document.getElementById('fac-tasa')?.value || '1';
                
                const monedaData = document.getElementById('fac-moneda').value.split('|');
                moneda = monedaData[0]; simbolo = monedaData[1];

                document.querySelectorAll('.facturacion-item-row').forEach(row => {
                    const cant = row.querySelector('.fac-item-cant')?.value || 1;
                    const desc = row.querySelector('.fac-item-desc')?.value || '';
                    const precio = parseFloat(row.querySelector('.fac-item-precio')?.value) || 0;
                    const descval = parseFloat(row.querySelector('.fac-item-descval')?.value) || 0;
                    const totalLinea = (parseFloat(cant) * precio) - descval;

                    itemsHTML += `
                        <tr style="border-bottom: 1px solid #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                            <td style="padding: 6px 10px; text-align: center;">${cant}</td>
                            <td style="padding: 6px 10px;">${desc}</td>
                            <td style="padding: 6px 10px; text-align: right;">${simbolo}${precio.toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; color: #d9534f;">-${simbolo}${descval.toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; font-weight: bold;">${simbolo}${totalLinea.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            return `
                <div style="max-width: 800px; margin: 0 auto; background: white; padding: 25px; font-family: Arial, sans-serif; color: #333; box-sizing: border-box; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #385723; padding-bottom: 10px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png" alt="Logo" style="width: 100px; height: auto; display: block;">
                            <div>
                                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #333;">F&B PARTS</p>
                                <p style="margin: 1px 0; font-size: 10px; color: #555;">RIF: J-503971118</p>
                                <p style="margin: 1px 0; font-size: 10px; color: #555;">fybinversiones.ccs@gmail.com | +584120161036</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="color: #385723; font-family: Arial, sans-serif; font-size: 16px; margin: 0; font-weight: bold;">NOTA DE ENTREGA</h2>
                            <p style="font-size: 12px; font-weight: bold; color: #333; margin: 2px 0;">Ctrl/Nro: ${nro}</p>
                            <p style="font-size: 10px; color: #666; margin: 0;">Fecha: ${fechaActual}</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f4f6f4; padding: 10px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        <div>
                            <p style="margin: 2px 0;"><strong>Cliente:</strong> ${cliente}</p>
                            <p style="margin: 2px 0;"><strong>RIF o C.I:</strong> ${rif}</p>
                        </div>
                        <div>
                            <p style="margin: 2px 0;"><strong>Dirección:</strong> ${direccion}</p>
                            <p style="margin: 2px 0;"><strong>Teléfono:</strong> ${telefono}</p>
                            <p style="margin: 2px 0;"><strong>Condición:</strong> <span style="color: #385723; font-weight: bold;">${disponibilidad}</span></p>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #385723 !important; color: white !important; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                <th style="padding: 6px 10px; width: 45px; text-align: center;">CANT</th>
                                <th style="padding: 6px 10px;">DESCRIPCIÓN</th>
                                <th style="padding: 6px 10px; width: 80px; text-align: right;">PRECIO U.</th>
                                <th style="padding: 6px 10px; width: 80px; text-align: right;">DESC.</th>
                                <th style="padding: 6px 10px; width: 85px; text-align: right;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                        <div style="width: 220px; font-size: 11px;">
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee;">
                                <span>SUB TOTAL:</span>
                                <strong>${simbolo}${subtotal}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee; color: #d9534f; -webkit-print-color-adjust: exact;">
                                <span>DESCUENTO:</span>
                                <strong>-${simbolo}${descuento}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee;">
                                <span>16% IVA:</span>
                                <strong>${simbolo}${iva}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; font-weight: bold; color: #385723; border-bottom: 2px solid #385723; -webkit-print-color-adjust: exact;">
                                <span>TOTAL A PAGAR:</span>
                                <span>${simbolo}${total}</span>
                            </div>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #ddd; padding-top: 6px; font-size: 8.5px; color: #555;">
                        <p style="margin: 0 0 2px 0; font-weight: bold; color: #333;">Representado en ${moneda}. Tasa Referencial de la Operación: ${tasaGuardada}. El documento fiscal original se emite por caja registradora.</p>
                        <p class="text-[7.5px] text-gray-500" style="margin: 2px 0 0 0; font-size: 7.5px; color: #6b7280; line-height: 1.2;">La recepción, retiro de mercancía o firma del presente documento convalida la aceptación íntegra de nuestras Políticas de Garantía, Devolución y Envíos consultables en: <a href="https://www.fybparts.com/politicas-devoluciones.html" target="_blank" style="color: inherit; text-decoration: none;">www.fybparts.com/politicas-devoluciones.html</a></p>
                    </div>
                </div>
            `;
        }

        function construirHTMLFacturaTicket58(datos = null) {
            let cliente, rif, direccion, telefono, subtotal, descuento, iva, total, nro;
            let moneda, simbolo, disponibilidad, tasaGuardada, items = [];
            const fechaActual = new Date().toLocaleDateString("es-VE");
            const horaActual = new Date().toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit' });

            if (datos) {
                cliente = datos.cliente || 'Cliente Mostrador';
                rif = datos.rif || '';
                direccion = datos.direccion || '';
                telefono = datos.telefono || '';
                subtotal = datos.subtotal || '0.00';
                descuento = datos.descuento || '0.00';
                iva = datos.iva || '0.00';
                total = datos.total || '0.00';
                nro = datos.nro || '0000';
                moneda = datos.moneda || 'USD';
                simbolo = datos.simbolo || '$';
                disponibilidad = datos.disponibilidad || 'ENTREGA INMEDIATA';
                tasaGuardada = datos.tasa || '1';
                items = datos.items || [];
            } else {
                cliente = document.getElementById('fac-cliente')?.value || 'Cliente Mostrador';
                rif = document.getElementById('fac-rif')?.value || '';
                direccion = document.getElementById('fac-direccion')?.value || '';
                telefono = document.getElementById('fac-telefono')?.value || '';
                subtotal = document.getElementById('fac-subtotal')?.innerText || '0.00';
                descuento = document.getElementById('fac-total-desc')?.innerText || '0.00';
                iva = document.getElementById('fac-iva')?.innerText || '0.00';
                total = document.getElementById('fac-total-general')?.innerText || '0.00';
                nro = document.getElementById('fac-nro')?.value || '0000';
                disponibilidad = document.getElementById('fac-disponibilidad')?.value || 'ENTREGA INMEDIATA';
                tasaGuardada = document.getElementById('fac-tasa')?.value || '1';
                
                const monedaData = (document.getElementById('fac-moneda')?.value || 'USD|$').split('|');
                moneda = monedaData[0] || 'USD';
                simbolo = monedaData[1] || '$';

                document.querySelectorAll('.facturacion-item-row').forEach(row => {
                    const cant = row.querySelector('.fac-item-cant')?.value || 1;
                    const desc = row.querySelector('.fac-item-desc')?.value || '';
                    const precio = parseFloat(row.querySelector('.fac-item-precio')?.value) || 0;
                    const descval = parseFloat(row.querySelector('.fac-item-descval')?.value) || 0;
                    items.push({
                        cantidad: cant,
                        descripcion: desc,
                        precioUnitario: precio,
                        descuento: descval
                    });
                });
            }

            let itemsFilasHTML = '';
            items.forEach((item, index) => {
                const cant = parseFloat(item.cantidad) || 1;
                const pu = parseFloat(item.precioUnitario) || 0;
                const desc = parseFloat(item.descuento) || 0;
                const totalLinea = (cant * pu) - desc;

                itemsFilasHTML += `
                    <div style="padding: 4px 0; border-bottom: 1px dashed #777;">
                        <div style="font-weight: 800; font-size: 12px; line-height: 1.25; color: #000; text-transform: uppercase; word-break: break-word;">
                            ${item.descripcion}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px; font-size: 11.5px;">
                            <span style="color: #111; font-weight: 700; white-space: nowrap;">
                                ${cant} x ${simbolo} ${pu.toFixed(2)}${desc > 0 ? ' <small style="color:#d9534f;">(-' + simbolo + desc.toFixed(2) + ')</small>' : ''}
                            </span>
                            <span style="font-weight: 900; font-size: 12.5px; color: #000; white-space: nowrap;">
                                ${simbolo} ${totalLinea.toFixed(2)}
                            </span>
                        </div>
                    </div>
                `;
            });

            const numSub = parseFloat(subtotal) || 0;
            const numDesc = parseFloat(descuento) || 0;
            const numIva = parseFloat(iva) || 0;
            const numTotal = parseFloat(total) || 0;
            const numTasa = parseFloat(tasaGuardada) || 1;
            
            // Calculo de referencia cruzada VES <-> USD
            let refCruzadaHTML = '';
            if (moneda === 'VES' && numTasa > 1) {
                const totalUSD = (numTotal / numTasa).toFixed(2);
                refCruzadaHTML = ` | Ref: <strong>$${totalUSD}</strong>`;
            } else if (moneda === 'USD' && numTasa > 1) {
                const totalVES = (numTotal * numTasa).toFixed(2);
                refCruzadaHTML = ` | Ref: <strong>Bs ${totalVES}</strong>`;
            }

            return `
                <div class="ticket-recibo-58" style="width: 100%; max-width: 100%; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #000; box-sizing: border-box; text-align: left;">
                    <!-- ENCABEZADO COMPACTO F&B PARTS -->
                    <div style="text-align: center; margin-bottom: 4px;">
                        <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.1; text-transform: uppercase;">F&B PARTS</div>
                        <div style="font-size: 11.5px; font-weight: 800; margin-top: 1px;">RIF: J-503971118</div>
                        <div style="font-size: 9.5px; font-weight: 600; margin-top: 1px;">fybinversiones.ccs@gmail.com</div>
                        <div style="font-size: 10.5px; font-weight: 700; margin-top: 1px;">+58 412-0161036</div>
                        <div style="font-size: 9.5px; font-weight: 600;">Caracas, Venezuela</div>
                    </div>

                    <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>

                    <!-- CONTROL Y FECHA -->
                    <div style="text-align: center; margin: 2px 0;">
                        <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">NOTA DE ENTREGA</div>
                        <div style="font-size: 13px; font-weight: 900; margin-top: 1px;">CONTROL: #${nro}</div>
                        <div style="font-size: 10px; font-weight: 600; color: #111;">Fecha: ${fechaActual} • ${horaActual}</div>
                    </div>

                    <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>

                    <!-- DATOS DEL CLIENTE -->
                    <div style="font-size: 11px; line-height: 1.35; font-weight: 600;">
                        <div><strong>CLIENTE:</strong> ${cliente}</div>
                        ${rif ? `<div><strong>RIF/CI:</strong> ${rif}</div>` : ''}
                        ${telefono ? `<div><strong>TELÉFONO:</strong> ${telefono}</div>` : ''}
                        ${direccion ? `<div><strong>DIRECCIÓN:</strong> ${direccion}</div>` : ''}
                        <div><strong>ENTREGA:</strong> ${disponibilidad}</div>
                    </div>

                    <div style="border-top: 1.5px solid #000; margin: 4px 0 2px 0;"></div>

                    <!-- CABECERA PRODUCTOS -->
                    <div style="font-size: 10px; font-weight: 900; display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-bottom: 2px;">
                        <span>DESCRIPCIÓN / CANT x PRECIO</span>
                        <span>TOTAL</span>
                    </div>

                    <!-- LISTA DE PRODUCTOS -->
                    <div>
                        ${itemsFilasHTML}
                    </div>

                    <div style="border-top: 1.5px solid #000; margin: 5px 0 3px 0;"></div>

                    <!-- TOTALES -->
                    <div style="font-size: 12px; line-height: 1.35; font-weight: 700;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="white-space: nowrap;">SUBTOTAL:</span>
                            <span style="font-weight: 800; white-space: nowrap;">${simbolo} ${numSub.toFixed(2)}</span>
                        </div>
                        ${numDesc > 0 ? `
                        <div style="display: flex; justify-content: space-between;">
                            <span style="white-space: nowrap;">DESCUENTO:</span>
                            <span style="font-weight: 800; white-space: nowrap;">-${simbolo} ${numDesc.toFixed(2)}</span>
                        </div>` : ''}
                        <div style="display: flex; justify-content: space-between;">
                            <span style="white-space: nowrap;">16% IVA:</span>
                            <span style="font-weight: 800; white-space: nowrap;">${simbolo} ${numIva.toFixed(2)}</span>
                        </div>
                        <div style="border-top: 2px solid #000; margin: 3px 0 3px 0;"></div>
                        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900;">
                            <span style="white-space: nowrap;">TOTAL:</span>
                            <span style="white-space: nowrap;">${simbolo} ${numTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style="border-top: 1.5px dashed #000; margin: 5px 0;"></div>

                    <!-- PIE DE TICKET -->
                    <div style="text-align: center; font-size: 10px; line-height: 1.3; margin-top: 3px;">
                        <div style="font-weight: 700;">Tasa: <strong>${tasaGuardada}</strong>${refCruzadaHTML}</div>
                        <div style="margin-top: 3px; font-weight: 900; font-size: 12px;">¡GRACIAS POR SU PREFERENCIA!</div>
                        <div style="margin-top: 2px; color: #444; font-size: 8.5px;">Documento de control y entrega interna.</div>
                        <div style="margin-top: 3px; color: #555; font-size: 7px; line-height: 1.15; word-break: break-all;">Recepción del pedido convalida términos y garantías en: <a href="https://www.fybparts.com/politicas-devoluciones.html" target="_blank" style="color: inherit; text-decoration: none;">www.fybparts.com/politicas-devoluciones.html</a></div>
                    </div>
                    <!-- Espacio seguro para barra de corte / tear-off -->
                    <div style="height: 10mm;"></div>
                </div>
            `;
        }

        window.formatoFacturaActual = 'carta';

        window.cambiarFormatoPreviewFactura = function(formato) {
            window.formatoFacturaActual = formato;
            const btnCarta = document.getElementById('btn-preview-fac-carta');
            const btnTicket = document.getElementById('btn-preview-fac-ticket');
            
            if (formato === 'ticket58') {
                if (btnTicket) {
                    btnTicket.style.background = '#007bff';
                    btnTicket.style.color = 'white';
                    btnTicket.style.borderColor = '#007bff';
                }
                if (btnCarta) {
                    btnCarta.style.background = '#f8f9fa';
                    btnCarta.style.color = '#444';
                    btnCarta.style.borderColor = '#ccc';
                }
            } else {
                if (btnCarta) {
                    btnCarta.style.background = '#385723';
                    btnCarta.style.color = 'white';
                    btnCarta.style.borderColor = '#385723';
                }
                if (btnTicket) {
                    btnTicket.style.background = '#f8f9fa';
                    btnTicket.style.color = '#444';
                    btnTicket.style.borderColor = '#ccc';
                }
            }
            window.actualizarPreviewFactura();
        };

        window.actualizarPreviewFactura = function() {
            const box = document.getElementById('pdf-preview-box-fac');
            if (!box) return;
            if (window.formatoFacturaActual === 'ticket58') {
                box.style.display = 'flex';
                box.style.justifyContent = 'center';
                box.style.alignItems = 'flex-start';
                box.innerHTML = `<div style="width: 270px; background: white; border: 1px solid #ddd; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 12px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #000; box-sizing: border-box; margin: 10px auto;">${construirHTMLFacturaTicket58()}</div>`;
            } else {
                box.style.display = 'block';
                box.innerHTML = `<div style="transform: scale(0.68); transform-origin: top left; width: 147%; pointer-events: none;">${construirHTMLFactura()}</div>`;
            }
        };

        window.imprimirFacturaCarta = function(fac, ventanaExterna = null) {
            const ventanaPDF = ventanaExterna || window.open('', '_blank');
            if(!ventanaPDF) { alert("⚠️ Tu navegador bloqueó la ventana de impresión."); return; }
            
            const docHTML = construirHTMLFactura(fac);
            const finalStyle = '<style>body{background:white;margin:0;padding:20px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}@media print{@page{size:letter portrait;margin:0.5cm;}body{padding:0;}.no-print{display:none!important;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}}</style>';
            const htmlParte1 = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>Nota de Entrega F&B #' + (fac && fac.nro ? fac.nro : '') + '</title>\n' + finalStyle + '\n</head>\n<body>\n';
            const htmlParte2 = '\n<div style="text-align:center;margin:40px 0;" class="no-print"><button onclick="window.print()" style="background:#28a745;color:white;border:none;padding:15px 30px;font-size:18px;font-weight:bold;border-radius:6px;cursor:pointer;">🖨️ Imprimir Factura Carta</button></div>\n</b' + 'ody>\n</h' + 'tml>';

            ventanaPDF.document.open();
            ventanaPDF.document.write(htmlParte1 + docHTML + htmlParte2);
            ventanaPDF.document.close();
            setTimeout(() => { ventanaPDF.focus(); ventanaPDF.print(); }, 700);
        };

        window.imprimirTicket58 = function(fac, ventanaExterna = null) {
            const ventanaPDF = ventanaExterna || window.open('', '_blank');
            if(!ventanaPDF) { alert("⚠️ Tu navegador bloqueó la ventana de impresión."); return; }
            
            const ticketHTML = construirHTMLFacturaTicket58(fac);
            const finalStyle = `
                <style>
                    @page {
                        size: 48mm 210mm;
                        margin: 0 !important;
                    }
                    *, *:before, *:after {
                        box-sizing: border-box !important;
                    }
                    html, body {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                    }
                    .ticket-box {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        padding: 0 0.5mm !important;
                        background: #fff !important;
                        box-sizing: border-box !important;
                    }
                    @media screen {
                        body {
                            padding: 20px 10px !important;
                            background: #e9ecef !important;
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: center !important;
                        }
                        .ticket-box {
                            width: 320px !important;
                            max-width: 100% !important;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.15) !important;
                            border-radius: 6px !important;
                            padding: 15px 12px !important;
                            background: #fff !important;
                        }
                    }
                    @media print {
                        @page {
                            size: 58mm 180mm;
                            margin: 0 !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        html, body {
                            width: 48mm !important;
                            max-width: 48mm !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            display: block !important;
                        }
                        .ticket-box {
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 0.5mm !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        body.scale-100 .ticket-recibo-58 {
                            zoom: 1.0 !important;
                            transform: scale(1.0) !important;
                            transform-origin: top center !important;
                        }
                        body.scale-115 .ticket-recibo-58 {
                            zoom: 1.15 !important;
                            transform: scale(1.15) !important;
                            transform-origin: top center !important;
                        }
                        body.scale-128 .ticket-recibo-58 {
                            zoom: 1.28 !important;
                            transform: scale(1.28) !important;
                            transform-origin: top center !important;
                        }
                    }
                </style>
            `;
            const headerControls = `
                <div class="no-print" style="margin-bottom:15px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
                    <div style="background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:10px 14px;box-shadow:0 3px 10px rgba(0,0,0,0.08);display:inline-flex;flex-direction:column;align-items:center;gap:8px;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;">
                            <button onclick="window.print()" style="background:#007bff;color:white;border:none;padding:10px 22px;font-size:15px;font-weight:bold;border-radius:6px;cursor:pointer;box-shadow:0 3px 8px rgba(0,123,255,0.3);display:flex;align-items:center;gap:6px;">
                                🖨️ Mandar a Imprimir
                            </button>
                            <div style="display:flex;align-items:center;gap:4px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:3px 6px;">
                                <span style="font-size:11.5px;font-weight:bold;color:#444;margin-right:2px;">Ajuste Ancho:</span>
                                <button id="btn-scale-100" onclick="cambiarEscala('100')" style="padding:4px 8px;font-size:11px;font-weight:bold;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff;color:#333;">Normal (100%)</button>
                                <button id="btn-scale-115" onclick="cambiarEscala('115')" style="padding:4px 8px;font-size:11px;font-weight:bold;border:1px solid #007bff;border-radius:4px;cursor:pointer;background:#e7f1ff;color:#007bff;">Óptimo (+15%)</button>
                                <button id="btn-scale-128" onclick="cambiarEscala('128')" style="padding:4px 8px;font-size:11px;font-weight:bold;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff;color:#333;">Máximo (+28%)</button>
                            </div>
                        </div>
                        <div style="font-size:11px;color:#555;line-height:1.3;max-width:440px;">
                            💡 <strong>Tip Safari/Mac:</strong> Si ves margen lateral, en la ventana de impresión pon <strong>Escala: 125%</strong> o usa <strong>Google Chrome</strong> (con Márgenes: Ninguno).
                        </div>
                    </div>
                </div>
                <script>
                    function cambiarEscala(scale) {
                        document.body.classList.remove('scale-100', 'scale-115', 'scale-128');
                        document.body.classList.add('scale-' + scale);
                        try { localStorage.setItem('fyb_ticket_scale', scale); } catch(e){}
                        ['100', '115', '128'].forEach(function(s) {
                            var btn = document.getElementById('btn-scale-' + s);
                            if(btn) {
                                if(s === scale) {
                                    btn.style.background = '#007bff';
                                    btn.style.color = '#fff';
                                    btn.style.borderColor = '#007bff';
                                } else {
                                    btn.style.background = '#fff';
                                    btn.style.color = '#333';
                                    btn.style.borderColor = '#ccc';
                                }
                            }
                        });
                    }
                    (function(){
                        var saved = '115';
                        try { saved = localStorage.getItem('fyb_ticket_scale') || '115'; } catch(e){}
                        cambiarEscala(saved);
                    })();
                <\/script>
            `;
            const htmlParte1 = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Ticket F&B #' + (fac && fac.nro ? fac.nro : '') + '</title>\n' + finalStyle + '\n</head>\n<body>\n' + headerControls + '\n<div class="ticket-box">\n';
            const htmlParte2 = '\n</div>\n</b' + 'ody>\n</h' + 'tml>';

            ventanaPDF.document.open();
            ventanaPDF.document.write(htmlParte1 + ticketHTML + htmlParte2);
            ventanaPDF.document.close();
            setTimeout(() => { ventanaPDF.focus(); ventanaPDF.print(); }, 700);
        };

        window.guardarYGenerarFactura = async function(formato = 'carta') {
            const cliente = SecuritySanitizer.cleanText(document.getElementById('fac-cliente').value, 120);
            const rif = SecuritySanitizer.cleanText(document.getElementById('fac-rif').value, 30);
            const direccion = SecuritySanitizer.cleanAddress(document.getElementById('fac-direccion').value, 300);
            const telefono = SecuritySanitizer.cleanPhone(document.getElementById('fac-telefono').value);
            const disponibilidad = SecuritySanitizer.cleanText(document.getElementById('fac-disponibilidad').value, 100);

            const rows = document.querySelectorAll('.facturacion-item-row');
            const items = [];
            
            rows.forEach(row => {
                items.push({
                    cantidad: SecuritySanitizer.sanitizeInt(row.querySelector('.fac-item-cant').value, 1),
                    descripcion: SecuritySanitizer.cleanText(row.querySelector('.fac-item-desc').value, 200),
                    precioUnitario: SecuritySanitizer.sanitizeAmount(row.querySelector('.fac-item-precio').value),
                    descuento: SecuritySanitizer.sanitizeAmount(row.querySelector('.fac-item-descval').value)
                });
            });

            if(items.length === 0) { alert("Agrega al menos un ítem."); return; }

            const subtotal = SecuritySanitizer.sanitizeAmount(document.getElementById('fac-subtotal').innerText);
            const descuento = SecuritySanitizer.sanitizeAmount(document.getElementById('fac-total-desc').innerText);
            const iva = SecuritySanitizer.sanitizeAmount(document.getElementById('fac-iva').innerText);
            const total = SecuritySanitizer.sanitizeAmount(document.getElementById('fac-total-general').innerText);
            
            const rawNroFac = document.getElementById('fac-nro').value.trim();
            const nroFactura = SecuritySanitizer.cleanText(rawNroFac || Math.floor(1000 + Math.random() * 9000).toString(), 30);
            const fechaActual = new Date().toLocaleDateString("es-VE");
            
            const monedaData = document.getElementById('fac-moneda').value.split('|');
            const moneda = SecuritySanitizer.cleanText(monedaData[0], 20); 
            const simbolo = SecuritySanitizer.cleanText(monedaData[1], 10);
            const tasa = SecuritySanitizer.sanitizeAmount(document.getElementById('fac-tasa').value);

            const objetoFactura = {
                nro: nroFactura, fecha: fechaActual, cliente, rif, direccion, telefono,
                items, subtotal, descuento, iva, total, moneda, simbolo, tasa, disponibilidad,
                estatusComercial: "Pendiente", 
                notaInterna: "",
                notaCredito: "",
                abonos: [] 
            };

            const ventanaPDF = window.open('', '_blank');
            if(!ventanaPDF) { alert("⚠️ Tu navegador bloqueó la ventana de impresión."); return; }

            try {
                await addDoc(collection(db, "facturas"), objetoFactura);

                let clienteExiste = false;
                const rifLimpio = (rif || '').trim().toUpperCase();
                for (const key in window.clientesDBLocal) {
                    if (window.clientesDBLocal[key].rif && window.clientesDBLocal[key].rif.trim().toUpperCase() === rifLimpio) {
                        clienteExiste = true; break;
                    }
                }

                if (!clienteExiste && rifLimpio !== '') {
                    await addDoc(collection(db, "clientes"), {
                        nombre: (cliente || '').trim(), rif: (rif || '').trim(), direccion: (direccion || '').trim(), telefono: (telefono || '').trim()
                    });
                    window.cargarBaseClientes();
                }

                if (formato === 'ticket58') {
                    window.imprimirTicket58(objetoFactura, ventanaPDF);
                } else {
                    window.imprimirFacturaCarta(objetoFactura, ventanaPDF);
                }

                window.actualizarPreviewFactura();
                window.cargarHistorialFacturas();
                window.cargarDashboard();
                window.cargarFinanzas();
                window.abrirModoCajeroParaFactura(objetoFactura);

            } catch (error) { console.error(error); ventanaPDF.close(); alert("Hubo un error al guardar la factura."); }
        };

        window.abrirVentanaFacturaExistente = function(fac, formato = 'carta') {
            if (formato === 'ticket58') {
                window.imprimirTicket58(fac);
            } else {
                window.imprimirFacturaCarta(fac);
            }
        };

        window.cargarHistorialFacturas = async function() {
            const tbody = document.getElementById('facturas-table-body');
            if(!tbody) return;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Cargando historial de facturas...</td></tr>`;

            try {
                const snap = await getDocs(collection(db, "facturas"));
                tbody.innerHTML = '';
                
                let maxNro = 0;

                if(snap.empty) { 
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay facturas guardadas.</td></tr>`;
                    document.getElementById('fac-nro').value = "1000";
                    window.actualizarPreviewFactura();
                    return; 
                }

                const facturasArr = [];
                snap.forEach(docSnap => {
                    const fac = docSnap.data();
                    const docId = docSnap.id;
                    window.facturasDBLocal[docId] = fac;
                    const currNro = parseInt(String(fac.nro).replace(/\D/g,'')) || 0;
                    if (currNro > maxNro) maxNro = currNro;
                    facturasArr.push({ fac, docId });
                });
                // Orden descendente por número de factura (635, 634, 633...)
                facturasArr.sort((a,b) => {
                    const na = parseInt(String(a.fac.nro).replace(/\D/g,'')) || 0;
                    const nb = parseInt(String(b.fac.nro).replace(/\D/g,'')) || 0;
                    return nb - na;
                });
                facturasArr.forEach(({ fac, docId }) => {
                    const currNro = parseInt(String(fac.nro).replace(/\D/g,'')) || 0;
                    if (currNro > maxNro) maxNro = currNro;

                    const tr = document.createElement('tr');
                    const simbolo = fac.simbolo || '$';
                    const estatus = fac.estatusComercial || 'Pendiente';
                    
                    let colorClase = 'status-pendiente';
                    if(estatus.includes("Pagado")) colorClase = 'status-pagado';
                    else if (estatus.includes("Crédito")) colorClase = 'status-credito';
                    else if (estatus.includes("Importación")) colorClase = 'status-importacion';
                    else if (estatus === "Anulada") colorClase = 'status-inactivo';

                    let ncBadge = '';
                    if (estatus === 'Anulada') {
                        ncBadge = fac.notaCredito ? `<br><span style="font-size:10px; font-weight:bold; color:#d9534f; background:#f8d7da; padding:2px 4px; border-radius:3px;">N/C: ${fac.notaCredito}</span>` : `<br><span style="font-size:10px; font-weight:bold; color:#d9534f; background:#f8d7da; padding:2px 4px; border-radius:3px;">Anulada</span>`;
                    }

                    tr.innerHTML = `
                        <td><strong>#${fac.nro}</strong>${ncBadge}</td>
                        <td>${fac.fecha}</td>
                        <td><strong>${fac.cliente}</strong><br><span style="font-size:11px; color:#666;">RIF: ${fac.rif}</span></td>
                        <td>
                            <select class="select-status ${colorClase}" onchange="actualizarEstatusDocumento('${docId}', 'facturas', this)">
                                <option value="Pendiente" ${estatus === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                                <option value="Pagado y Despachado" ${estatus === 'Pagado y Despachado' ? 'selected' : ''}>✅ Pagado y Despachado</option>
                                <option value="Crédito Despachado (15 Días)" ${estatus === 'Crédito Despachado (15 Días)' ? 'selected' : ''}>💳 Crédito Despachado (15 Días)</option>
                                <option value="Crédito Despachado (30 Días)" ${estatus === 'Crédito Despachado (30 Días)' ? 'selected' : ''}>💳 Crédito Despachado (30 Días)</option>
                                <option value="Crédito Pagado" ${estatus === 'Crédito Pagado' ? 'selected' : ''}>✅ Crédito Pagado</option>
                                <option value="Bajo Importación" ${estatus === 'Bajo Importación' ? 'selected' : ''}>🚢 Bajo Importación</option>
                                <option value="Anulada" ${estatus === 'Anulada' ? 'selected' : ''}>❌ Anulada</option>
                            </select>
                        </td>
                        <td><strong style="color: #155724;">${simbolo}${fac.total}</strong></td>
                        <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 230px;"></td>
                    `;

                    const tdAcciones = tr.querySelector('td:last-child');

                    const btnEditar = document.createElement('button');
                    btnEditar.type = 'button'; 
                    btnEditar.style = 'background:#6c757d; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnEditar.innerHTML = '<i class="fas fa-edit"></i>'; 
                    btnEditar.title = "Corregir Nro o Fecha";
                    btnEditar.addEventListener('click', () => window.abrirModalEditarFactura(docId));

                    const btnRetencion = document.createElement('button');
                    btnRetencion.type = 'button'; 
                    btnRetencion.style = 'background:#17a2b8; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnRetencion.innerHTML = '<i class="fas fa-file-invoice-dollar"></i>'; 
                    btnRetencion.title = "Ver Retenciones Automáticas (IA)";
                    btnRetencion.addEventListener('click', () => window.abrirModalRetenciones(fac.nro));

                    const btnNotas = document.createElement('button');
                    btnNotas.type = 'button'; btnNotas.className = 'btn-note';
                    btnNotas.innerHTML = '<i class="fas fa-sticky-note"></i>'; btnNotas.title = "Notas Internas";
                    btnNotas.addEventListener('click', () => window.abrirModalNotas(docId, 'facturas', fac.notaInterna));

                    const btnCajero = document.createElement('button');
                    btnCajero.type = 'button'; btnCajero.style = 'background:#f0ad4e; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnCajero.innerHTML = '<i class="fas fa-cash-register"></i>'; btnCajero.title = "Abrir Modo Cajero";
                    btnCajero.addEventListener('click', () => window.abrirModoCajeroParaFactura(fac));

                    const btnImprimirCarta = document.createElement('button');
                    btnImprimirCarta.type = 'button'; 
                    btnImprimirCarta.style = 'background:#28a745; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnImprimirCarta.innerHTML = '<i class="fas fa-print"></i>'; 
                    btnImprimirCarta.title = "Imprimir Hoja Carta (PDF)";
                    btnImprimirCarta.addEventListener('click', () => window.abrirVentanaFacturaExistente(fac, 'carta'));

                    const btnImprimirTicket = document.createElement('button');
                    btnImprimirTicket.type = 'button'; 
                    btnImprimirTicket.style = 'background:#007bff; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnImprimirTicket.innerHTML = '<i class="fas fa-receipt"></i>'; 
                    btnImprimirTicket.title = "Imprimir Ticket Térmico 58mm";
                    btnImprimirTicket.addEventListener('click', () => window.abrirVentanaFacturaExistente(fac, 'ticket58'));

                    const btnEliminar = document.createElement('button');
                    btnEliminar.type = 'button'; btnEliminar.style = 'background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
                    btnEliminar.addEventListener('click', async () => {
                        if(!confirm("¿Eliminar esta factura del historial?")) return;
                        try { 
                            await deleteDoc(doc(db, "facturas", docId)); 
                            if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR FACTURA", "Se eliminó la factura número: " + fac.nro);
                            window.cargarHistorialFacturas(); window.cargarDashboard(); window.cargarFinanzas(); 
                        } catch (e) { alert("Error al eliminar."); }
                    });

                    tdAcciones.appendChild(btnEditar);
                    tdAcciones.appendChild(btnRetencion); 
                    tdAcciones.appendChild(btnNotas);
                    tdAcciones.appendChild(btnCajero); 
                    tdAcciones.appendChild(btnImprimirCarta); 
                    tdAcciones.appendChild(btnImprimirTicket); 
                    tdAcciones.appendChild(btnEliminar);
                    tbody.appendChild(tr);
                });
                
                const nextNro = maxNro > 0 ? maxNro + 1 : 1000;
                document.getElementById('fac-nro').value = String(nextNro).padStart(4, '0');
                window.actualizarPreviewFactura();
                
                if (typeof window.filtrarTipoFactura === 'function') window.filtrarTipoFactura();
                
            } catch (error) { console.error(error); }
        };

        // ==========================================
        // LÓGICA DE COTIZACIONES E IMPORTACIÓN LANDED
        // ==========================================
        window.seleccionarClienteCotizacion = function() {
            const clienteId = document.getElementById('cot-selector-clientes').value;
            if(clienteId && window.clientesDBLocal[clienteId]) {
                const cli = window.clientesDBLocal[clienteId];
                document.getElementById('cot-cliente').value = cli.nombre;
                document.getElementById('cot-rif').value = cli.rif;
                document.getElementById('cot-direccion').value = cli.direccion;
                document.getElementById('cot-telefono').value = cli.telefono;
                window.actualizarPreview();
            }
        };

        window.agregarFilaCotizacionVacia = function() {
            const container = document.getElementById('cotizacion-items-container');
            const row = document.createElement('div');
            row.className = 'cotizacion-item-row';
            row.innerHTML = `
                <input type="number" class="item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalCotizacion()">
                <input type="text" class="item-desc" placeholder="Descripción" oninput="actualizarPreview()">
                <input type="number" step="0.01" class="item-precio" value="0.00" placeholder="Precio" oninput="calcularTotalCotizacion()">
                <input type="number" step="0.01" class="item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalCotizacion()">
                <input type="text" class="item-total-line" value="$0.00" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalCotizacion();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            window.calcularTotalCotizacion();
        };

        window.agregarItemDesdeInventario = function() {
            const select = document.getElementById('select-inventario-cot');
            const selectedIndex = select.selectedIndex;
            if (selectedIndex <= 0) { alert("Selecciona un repuesto del inventario primero."); return; }

            const opt = select.options[selectedIndex];
            const nombre = opt.getAttribute('data-nombre');
            const precio = parseFloat(opt.getAttribute('data-precio')) || 0;

            const container = document.getElementById('cotizacion-items-container');
            const row = document.createElement('div');
            row.className = 'cotizacion-item-row';
            row.innerHTML = `
                <input type="number" class="item-cant" value="1" min="1" placeholder="Cant" oninput="calcularTotalCotizacion()">
                <input type="text" class="item-desc" value="${nombre}" placeholder="Descripción" oninput="actualizarPreview()">
                <input type="number" step="0.01" class="item-precio" value="${precio.toFixed(2)}" placeholder="Precio" oninput="calcularTotalCotizacion()">
                <input type="number" step="0.01" class="item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalCotizacion()">
                <input type="text" class="item-total-line" value="$${precio.toFixed(2)}" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                <button type="button" onclick="this.parentElement.remove(); calcularTotalCotizacion();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
            select.selectedIndex = 0;
            window.calcularTotalCotizacion();
        };

        window.cargarItemsDesdeLanded = function() {
            const select = document.getElementById('cot-selector-landed');
            const docId = select.value;
            if(!docId || !window.importacionesDBLocal[docId]) {
                alert("Por favor selecciona un cálculo válido de la lista desplegable.");
                return;
            }

            const data = window.importacionesDBLocal[docId];
            const container = document.getElementById('cotizacion-items-container');
            
            data.items.forEach(item => {
                const precioDetalStr = (item.precioDetal || "$0.00").replace('$', '').replace(',', '');
                const precio = parseFloat(precioDetalStr) || 0;
                
                const row = document.createElement('div');
                row.className = 'cotizacion-item-row';
                row.innerHTML = `
                    <input type="number" class="item-cant" value="${item.cantidad}" min="1" placeholder="Cant" oninput="calcularTotalCotizacion()">
                    <input type="text" class="item-desc" value="${item.descripcion}" placeholder="Descripción" oninput="actualizarPreview()">
                    <input type="number" step="0.01" class="item-precio" value="${precio.toFixed(2)}" placeholder="Precio" oninput="calcularTotalCotizacion()">
                    <input type="number" step="0.01" class="item-descval" value="0.00" placeholder="Desc." oninput="calcularTotalCotizacion()">
                    <input type="text" class="item-total-line" value="$${(precio * item.cantidad).toFixed(2)}" readonly style="background: #f1f1f1; text-align: right; font-weight: bold;">
                    <button type="button" onclick="this.parentElement.remove(); calcularTotalCotizacion();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
                `;
                container.appendChild(row);
            });
            window.calcularTotalCotizacion();
            select.selectedIndex = 0;
            alert("¡Repuestos importados exitosamente a la cotización!");
        };

        window.calcularTotalCotizacion = function() {
            const rows = document.querySelectorAll('.cotizacion-item-row');
            let subtotal = 0; let totalDescuento = 0;

            rows.forEach(row => {
                const cant = parseFloat(row.querySelector('.item-cant').value) || 0;
                const precio = parseFloat(row.querySelector('.item-precio').value) || 0;
                const desc = parseFloat(row.querySelector('.item-descval').value) || 0;

                const totalLinea = (cant * precio) - desc;
                row.querySelector('.item-total-line').value = `$${totalLinea.toFixed(2)}`;

                subtotal += (cant * precio);
                totalDescuento += desc;
            });

            const baseImponible = subtotal - totalDescuento;
            const iva = baseImponible * 0.16;
            const totalGeneral = baseImponible + iva;

            if(document.getElementById('cot-subtotal')) document.getElementById('cot-subtotal').innerText = subtotal.toFixed(2);
            if(document.getElementById('cot-total-desc')) document.getElementById('cot-total-desc').innerText = totalDescuento.toFixed(2);
            if(document.getElementById('cot-iva')) document.getElementById('cot-iva').innerText = iva.toFixed(2);
            if(document.getElementById('cot-total-general')) document.getElementById('cot-total-general').innerText = totalGeneral.toFixed(2);

            window.actualizarPreview();
        };

        function construirHTMLCotizacion(datos = null) {
            let cliente, rif, direccion, telefono, vehiculo, anio, itemsHTML = '', subtotal, descuento, iva, total, nro, disponibilidad;
            const fechaActual = new Date().toLocaleDateString("es-VE");

            if (datos) {
                cliente = datos.cliente; rif = datos.rif; direccion = datos.direccion; telefono = datos.telefono;
                vehiculo = datos.vehiculo; anio = datos.anio; subtotal = datos.subtotal; descuento = datos.descuento;
                iva = datos.iva; total = datos.total; nro = datos.nro; 
                disponibilidad = datos.disponibilidad || 'ENTREGA INMEDIATA';

                datos.items.forEach(item => {
                    const totalLinea = (parseFloat(item.cantidad) * parseFloat(item.precioUnitario)) - parseFloat(item.descuento);
                    itemsHTML += `
                        <tr style="border-bottom: 1px solid #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                            <td style="padding: 6px 10px; text-align: center;">${item.cantidad}</td>
                            <td style="padding: 6px 10px;">${item.descripcion}</td>
                            <td style="padding: 6px 10px; text-align: right;">$${Number(item.precioUnitario).toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; color: #d9534f;">-$${Number(item.descuento).toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; font-weight: bold;">$${totalLinea.toFixed(2)}</td>
                        </tr>
                    `;
                });
            } else {
                cliente = document.getElementById('cot-cliente')?.value || '';
                rif = document.getElementById('cot-rif')?.value || '';
                direccion = document.getElementById('cot-direccion')?.value || '';
                telefono = document.getElementById('cot-telefono')?.value || '';
                vehiculo = document.getElementById('cot-vehiculo')?.value || '';
                anio = document.getElementById('cot-anio')?.value || '';
                subtotal = document.getElementById('cot-subtotal')?.innerText || '0.00';
                descuento = document.getElementById('cot-total-desc')?.innerText || '0.00';
                iva = document.getElementById('cot-iva')?.innerText || '0.00';
                total = document.getElementById('cot-total-general')?.innerText || '0.00';
                nro = document.getElementById('cot-nro')?.value || '0000';
                disponibilidad = document.getElementById('cot-disponibilidad')?.value || 'ENTREGA INMEDIATA';

                const rows = document.querySelectorAll('.cotizacion-item-row');
                rows.forEach(row => {
                    const cant = row.querySelector('.item-cant')?.value || 1;
                    const desc = row.querySelector('.item-desc')?.value || '';
                    const precio = parseFloat(row.querySelector('.item-precio')?.value) || 0;
                    const descval = parseFloat(row.querySelector('.item-descval')?.value) || 0;
                    const totalLinea = (parseFloat(cant) * precio) - descval;

                    itemsHTML += `
                        <tr style="border-bottom: 1px solid #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                            <td style="padding: 6px 10px; text-align: center;">${cant}</td>
                            <td style="padding: 6px 10px;">${desc}</td>
                            <td style="padding: 6px 10px; text-align: right;">$${precio.toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; color: #d9534f;">-$${descval.toFixed(2)}</td>
                            <td style="padding: 6px 10px; text-align: right; font-weight: bold;">$${totalLinea.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            return `
                <div style="max-width: 800px; margin: 0 auto; background: white; padding: 25px; font-family: Arial, sans-serif; color: #333; box-sizing: border-box; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #385723; padding-bottom: 10px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png" alt="Logo" style="width: 100px; height: auto; display: block;">
                            <div>
                                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #333;">F&B PARTS</p>
                                <p style="margin: 1px 0; font-size: 10px; color: #555;">RIF: J-503971118</p>
                                <p style="margin: 1px 0; font-size: 10px; color: #555;">fybinversiones.ccs@gmail.com | +584120161036</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="color: #385723; font-family: Arial, sans-serif; font-size: 16px; margin: 0; font-weight: bold;">COTIZACIÓN</h2>
                            <p style="font-size: 12px; font-weight: bold; color: #333; margin: 2px 0;">Nro: ${nro}</p>
                            <p style="font-size: 10px; color: #666; margin: 0;">Fecha: ${fechaActual}</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f4f6f4; padding: 10px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        <div>
                            <p style="margin: 2px 0;"><strong>Cliente:</strong> ${cliente}</p>
                            <p style="margin: 2px 0;"><strong>RIF o C.I:</strong> ${rif}</p>
                            <p style="margin: 2px 0;"><strong>Dirección:</strong> ${direccion}</p>
                            <p style="margin: 2px 0;"><strong>Teléfono:</strong> ${telefono}</p>
                        </div>
                        <div>
                            <p style="margin: 2px 0;"><strong>Vehículo:</strong> ${vehiculo}</p>
                            <p style="margin: 2px 0;"><strong>Año:</strong> ${anio}</p>
                            <p style="margin: 2px 0;"><strong>Disponibilidad:</strong> <span style="color: #385723; font-weight: bold;">${disponibilidad}</span></p>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #385723 !important; color: white !important; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                <th style="padding: 6px 10px; width: 45px; text-align: center;">CANT</th>
                                <th style="padding: 6px 10px;">DESCRIPCIÓN</th>
                                <th style="padding: 6px 10px; width: 80px; text-align: right;">PRECIO U.</th>
                                <th style="padding: 6px 10px; width: 80px; text-align: right;">DESC.</th>
                                <th style="padding: 6px 10px; width: 85px; text-align: right;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                        <div style="width: 220px; font-size: 11px;">
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee;">
                                <span>SUB TOTAL:</span>
                                <strong>$${subtotal}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee; color: #d9534f; -webkit-print-color-adjust: exact;">
                                <span>DESCUENTO:</span>
                                <strong>-$${descuento}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee;">
                                <span>16% IVA:</span>
                                <strong>$${iva}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; font-weight: bold; color: #385723; border-bottom: 2px solid #385723; -webkit-print-color-adjust: exact;">
                                <span>TOTAL:</span>
                                <span>$${total}</span>
                            </div>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #ddd; padding-top: 6px; font-size: 9px; color: #555; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <p style="margin: 0 0 2px 0; font-weight: bold; color: #333;">MÉTODO DE PAGOS:</p>
                            <ul style="margin: 0; padding-left: 12px; font-size: 8.5px; line-height: 1.3;">
                                <li>Pago Móvil, efectivo en divisas, transferencias bancarias (Banesco, BNC, BVC, Bancamiga) y Binance.</li>
                            </ul>
                        </div>
                        <div>
                            <p style="margin: 0 0 2px 0; font-weight: bold; color: #333;">TÉRMINOS:</p>
                            <p style="margin: 0; font-size: 7.5px; color: #6b7280; line-height: 1.25;">Representado en USD. Válida por 7 días. La confirmación o pago constituye aceptación de términos y garantías en: <a href="https://www.fybparts.com/politicas-devoluciones.html" target="_blank" style="color: inherit; text-decoration: none;">www.fybparts.com/politicas-devoluciones.html</a></p>
                        </div>
                    </div>
                </div>
            `;
        }

        window.actualizarPreview = function() {
            const box = document.getElementById('pdf-preview-box');
            if (box) {
                box.innerHTML = `<div style="transform: scale(0.68); transform-origin: top left; width: 147%; pointer-events: none;">${construirHTMLCotizacion()}</div>`;
            }
        };

        window.guardarYGenerarCotizacion = async function() {
            const cliente = SecuritySanitizer.cleanText(document.getElementById('cot-cliente').value, 120);
            const rif = SecuritySanitizer.cleanText(document.getElementById('cot-rif').value, 30);
            const direccion = SecuritySanitizer.cleanAddress(document.getElementById('cot-direccion').value, 300);
            const telefono = SecuritySanitizer.cleanPhone(document.getElementById('cot-telefono').value);
            const vehiculo = SecuritySanitizer.cleanText(document.getElementById('cot-vehiculo').value, 100);
            const anio = SecuritySanitizer.cleanText(document.getElementById('cot-anio').value, 20);
            const disponibilidad = SecuritySanitizer.cleanText(document.getElementById('cot-disponibilidad').value, 100);

            const rows = document.querySelectorAll('.cotizacion-item-row');
            const items = [];
            
            rows.forEach(row => {
                items.push({
                    cantidad: SecuritySanitizer.sanitizeInt(row.querySelector('.item-cant').value, 1),
                    descripcion: SecuritySanitizer.cleanText(row.querySelector('.item-desc').value, 200),
                    precioUnitario: SecuritySanitizer.sanitizeAmount(row.querySelector('.item-precio').value),
                    descuento: SecuritySanitizer.sanitizeAmount(row.querySelector('.item-descval').value)
                });
            });

            if(items.length === 0) { alert("Agrega al menos un ítem a la cotización."); return; }

            const subtotal = SecuritySanitizer.sanitizeAmount(document.getElementById('cot-subtotal').innerText);
            const descuento = SecuritySanitizer.sanitizeAmount(document.getElementById('cot-total-desc').innerText);
            const iva = SecuritySanitizer.sanitizeAmount(document.getElementById('cot-iva').innerText);
            const total = SecuritySanitizer.sanitizeAmount(document.getElementById('cot-total-general').innerText);
            
            const rawNroCot = document.getElementById('cot-nro').value.trim();
            const nroCotizacion = SecuritySanitizer.cleanText(rawNroCot || Math.floor(1000 + Math.random() * 9000).toString(), 30);
            const fechaActual = new Date().toLocaleDateString("es-VE");

            const objetoCotizacion = {
                nro: nroCotizacion, fecha: fechaActual, cliente, rif, direccion, telefono, vehiculo, anio,
                items, subtotal, descuento, iva, total, disponibilidad,
                estatusComercial: "Pendiente",
                notaInterna: ""
            };

            const ventanaPDF = window.open('', '_blank');
            if(!ventanaPDF) { alert("⚠️ Tu navegador bloqueó la ventana de impresión."); return; }

            try {
                await addDoc(collection(db, "cotizaciones"), objetoCotizacion);

                let clienteExiste = false;
                const rifLimpio = (rif || '').trim().toUpperCase();
                for (const key in window.clientesDBLocal) {
                    if (window.clientesDBLocal[key].rif && window.clientesDBLocal[key].rif.trim().toUpperCase() === rifLimpio) {
                        clienteExiste = true; break;
                    }
                }

                if (!clienteExiste && rifLimpio !== '') {
                    await addDoc(collection(db, "clientes"), {
                        nombre: (cliente || '').trim(), rif: (rif || '').trim(), direccion: (direccion || '').trim(), telefono: (telefono || '').trim()
                    });
                    window.cargarBaseClientes();
                }

                const docHTML = construirHTMLCotizacion(objetoCotizacion);
                const finalStyle = '<style>body{background:white;margin:0;padding:20px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}@media print{@page{margin:0.5cm;}body{padding:0;}.no-print{display:none!important;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}}</style>';
                const htmlParte1 = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>Cotización Oficial</title>\n' + finalStyle + '\n</head>\n<body>\n';
                const htmlParte2 = '\n<div style="text-align:center;margin:40px 0;" class="no-print"><button onclick="window.print()" style="background:#1d6fa5;color:white;border:none;padding:15px 30px;font-size:18px;font-weight:bold;border-radius:6px;cursor:pointer;">🖨️ Imprimir o Guardar PDF</button></div>\n</b' + 'ody>\n</h' + 'tml>';

                ventanaPDF.document.open();
                ventanaPDF.document.write(htmlParte1 + docHTML + htmlParte2);
                ventanaPDF.document.close();
                setTimeout(() => { ventanaPDF.focus(); ventanaPDF.print(); }, 800);

                window.cargarHistorialCotizaciones();
            } catch (error) { console.error(error); ventanaPDF.close(); alert("Hubo un error al guardar la cotización."); }
        };

        window.abrirVentanaCotizacionExistente = function(cot) {
            const ventanaPDF = window.open('', '_blank');
            if(!ventanaPDF) { alert("⚠️ Permite las ventanas emergentes."); return; }
            
            const docHTML = construirHTMLCotizacion(cot);
            const finalStyle = '<style>body{background:white;margin:0;padding:20px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}@media print{@page{margin:0.5cm;}body{padding:0;}.no-print{display:none!important;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}}</style>';
            const htmlParte1 = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>Cotización Oficial</title>\n' + finalStyle + '\n</head>\n<body>\n';
            const htmlParte2 = '\n<div style="text-align:center;margin:40px 0;" class="no-print"><button onclick="window.print()" style="background:#1d6fa5;color:white;border:none;padding:15px 30px;font-size:18px;font-weight:bold;border-radius:6px;cursor:pointer;">🖨️ Imprimir o Guardar PDF</button></div>\n</b' + 'ody>\n</h' + 'tml>';

            ventanaPDF.document.open();
            ventanaPDF.document.write(htmlParte1 + docHTML + htmlParte2);
            ventanaPDF.document.close();
            setTimeout(() => { ventanaPDF.focus(); ventanaPDF.print(); }, 800);
        };

        window.actualizarMetricasCotizaciones = function() {
            let aprobadas = 0;
            let espera = 0;
            let noAprobadas = 0;

            const rows = document.querySelectorAll('#cotizaciones-table-body tr');
            rows.forEach(tr => {
                const select = tr.querySelector('.select-status');
                if (select) {
                    const val = (select.value || '').trim();
                    if (val === 'Aprobada') {
                        aprobadas++;
                    } else if (val === 'En espera' || val === 'Pendiente') {
                        espera++;
                    } else if (val === 'No aprobada' || val.toLowerCase().includes('rechaz') || val.toLowerCase().includes('anula')) {
                        noAprobadas++;
                    } else {
                        espera++;
                    }
                }
            });

            const elAprobadas = document.getElementById('met-cot-aprobadas');
            const elEspera = document.getElementById('met-cot-espera');
            const elNoAprobadas = document.getElementById('met-cot-no-aprobadas');

            if (elAprobadas) elAprobadas.textContent = aprobadas;
            if (elEspera) elEspera.textContent = espera;
            if (elNoAprobadas) elNoAprobadas.textContent = noAprobadas;
        };

        window.filtrarCotizaciones = function() {
            const input = document.getElementById('buscador-cotizaciones');
            const term = input ? input.value.trim().toLowerCase() : '';
            const rows = document.querySelectorAll('#cotizaciones-table-body tr');

            rows.forEach(row => {
                if (!row.dataset.searchable) return;
                if (!term || row.dataset.searchable.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        };

        window.cargarHistorialCotizaciones = async function() {
            const tbody = document.getElementById('cotizaciones-table-body');
            if(!tbody) return;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Cargando historial...</td></tr>`;

            try {
                const snap = await getDocs(collection(db, "cotizaciones"));
                tbody.innerHTML = '';
                
                let maxNro = 0;

                if(snap.empty) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay cotizaciones guardadas.</td></tr>`;
                    document.getElementById('cot-nro').value = "1000";
                    window.actualizarPreview();
                    if (window.actualizarMetricasCotizaciones) {
                        window.actualizarMetricasCotizaciones();
                    }
                    return;
                }

                const cotizacionesArr = [];
                snap.forEach(docSnap => {
                    const cot = docSnap.data();
                    const docId = docSnap.id;
                    window.cotizacionesDBLocal[docId] = cot;
                    const partes = String(cot.nro || cot.nroCotizacion || '').replace('#', '').trim().split('-');
                    const currNro = parseInt(partes[0]) || 0;
                    if (currNro > maxNro) maxNro = currNro;
                    cotizacionesArr.push({ cot, docId });
                });
                // Orden descendente por número de cotización (#1852, #1834-2, #1834-1, #1834...)
                cotizacionesArr.sort((a, b) => {
                    const numA_str = String(a.cot?.nro || a.cot?.nroCotizacion || a.cot?.id || a.docId || '').replace('#', '').trim();
                    const numB_str = String(b.cot?.nro || b.cot?.nroCotizacion || b.cot?.id || b.docId || '').replace('#', '').trim();

                    const partesA = numA_str.split('-');
                    const partesB = numB_str.split('-');

                    const baseA = parseInt(partesA[0]) || 0;
                    const baseB = parseInt(partesB[0]) || 0;

                    if (baseB !== baseA) {
                        return baseB - baseA; 
                    }

                    const subA = parseInt(partesA[1]) || 0; 
                    const subB = parseInt(partesB[1]) || 0;

                    return subB - subA; 
                });
                cotizacionesArr.forEach(({ cot, docId }) => {
                    const partes = String(cot.nro || cot.nroCotizacion || '').replace('#', '').trim().split('-');
                    const currNro = parseInt(partes[0]) || 0;
                    if (currNro > maxNro) maxNro = currNro;
                    
                    const tr = document.createElement('tr');
                    const estatus = cot.estatusComercial || 'En espera';
                    
                    let colorClase = 'status-pendiente';
                    if (estatus === "Aprobada") colorClase = 'status-pagado';
                    else if (estatus === "En espera" || estatus === "Pendiente") colorClase = 'status-credito';
                    else if (estatus === "No aprobada") colorClase = 'status-inactivo';

                    // Indexar texto de búsqueda (Nro, Cliente, RIF, Repuestos/Ítems)
                    let itemsTexto = [];
                    if (Array.isArray(cot.items)) {
                        cot.items.forEach(it => {
                            if (typeof it === 'string') itemsTexto.push(it);
                            else if (it && typeof it === 'object') {
                                if (it.descripcion) itemsTexto.push(it.descripcion);
                                if (it.repuesto) itemsTexto.push(it.repuesto);
                                if (it.nombre) itemsTexto.push(it.nombre);
                                if (it.codigo) itemsTexto.push(it.codigo);
                            }
                        });
                    } else if (typeof cot.items === 'string') {
                        itemsTexto.push(cot.items);
                    }
                    if (Array.isArray(cot.repuestos)) {
                        cot.repuestos.forEach(r => {
                            if (typeof r === 'string') itemsTexto.push(r);
                            else if (r && typeof r === 'object') {
                                if (r.descripcion) itemsTexto.push(r.descripcion);
                                if (r.repuesto) itemsTexto.push(r.repuesto);
                                if (r.nombre) itemsTexto.push(r.nombre);
                                if (r.codigo) itemsTexto.push(r.codigo);
                            }
                        });
                    } else if (typeof cot.repuestos === 'string') {
                        itemsTexto.push(cot.repuestos);
                    }
                    if (cot.vehiculo) itemsTexto.push(cot.vehiculo);

                    const textoBuscable = [
                        cot.nro || cot.nroCotizacion || '',
                        cot.cliente || '',
                        cot.rif || '',
                        itemsTexto.join(' ')
                    ].join(' ').toLowerCase();

                    tr.dataset.searchable = textoBuscable;

                    tr.innerHTML = `
                        <td><strong>#${cot.nro}</strong></td>
                        <td>${cot.fecha}</td>
                        <td><strong>${cot.cliente}</strong><br><span style="font-size:11px; color:#666;">RIF: ${cot.rif}</span></td>
                        <td>
                            <select class="select-status ${colorClase}" onchange="actualizarEstatusDocumento('${docId}', 'cotizaciones', this)">
                                <option value="En espera" ${estatus === 'En espera' || estatus === 'Pendiente' ? 'selected' : ''}>⏳ En espera</option>
                                <option value="Aprobada" ${estatus === 'Aprobada' ? 'selected' : ''}>✅ Aprobada</option>
                                <option value="No aprobada" ${estatus === 'No aprobada' ? 'selected' : ''}>❌ No aprobada</option>
                            </select>
                        </td>
                        <td><strong>$${cot.total}</strong></td>
                        <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 180px;"></td>
                    `;

                    const tdAcciones = tr.querySelector('td:last-child');

                    const btnWhatsApp = document.createElement('button');
                    btnWhatsApp.type = 'button'; btnWhatsApp.style = 'background:#25D366; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnWhatsApp.innerHTML = '<i class="fab fa-whatsapp"></i>'; btnWhatsApp.title = "Enviar por WhatsApp";
                    btnWhatsApp.addEventListener('click', () => window.enviarPorWhatsApp(docId));

                    const btnCorreo = document.createElement('button');
                    btnCorreo.type = 'button'; btnCorreo.style = 'background:#EA4335; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnCorreo.innerHTML = '<i class="fas fa-envelope"></i>'; btnCorreo.title = "Asistente IA para Correos";
                    btnCorreo.addEventListener('click', () => window.abrirModalCorreoIA(docId));

                    const btnImprimir = document.createElement('button');
                    btnImprimir.type = 'button'; btnImprimir.style = 'background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnImprimir.innerHTML = '<i class="fas fa-print"></i>'; btnImprimir.title = "Imprimir";
                    btnImprimir.addEventListener('click', () => window.abrirVentanaCotizacionExistente(cot));

                    // 🚀 NUEVO BOTÓN: ENVIAR A PEDIDOS
                    const btnPedido = document.createElement('button');
                    btnPedido.type = 'button'; btnPedido.style = 'background:#f0ad4e; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnPedido.innerHTML = '<i class="fas fa-box"></i>'; btnPedido.title = "Convertir a Pedido";
                    btnPedido.addEventListener('click', () => window.enviarCotizacionAPedido(docId));

                    const btnEliminar = document.createElement('button');
                    btnEliminar.type = 'button'; btnEliminar.style = 'background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
                    btnEliminar.addEventListener('click', async () => {
                        if(!confirm("¿Eliminar esta cotización del historial?")) return;
                        try { await deleteDoc(doc(db, "cotizaciones", docId)); window.cargarHistorialCotizaciones(); } catch (e) { alert("Error al eliminar."); }
                    });

                    // 📜 NUEVO BOTÓN: GENERAR CONTRATO DE PROCURA
                    const btnContrato = document.createElement('button');
                    btnContrato.type = 'button'; btnContrato.style = 'background:#2c441b; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;';
                    btnContrato.innerHTML = '<i class="fas fa-file-contract"></i>'; 
                    btnContrato.title = "Crear Contrato desde esta Cotización";
                    btnContrato.addEventListener('click', () => window.cargarContratoDesdeCotizacion(docId));

                    tdAcciones.appendChild(btnWhatsApp);
                    tdAcciones.appendChild(btnCorreo);
                    tdAcciones.appendChild(btnImprimir); 
                    tdAcciones.appendChild(btnContrato); // 👈 Contrato de Procura
                    tdAcciones.appendChild(btnPedido); // 👈 Convertir a Pedido
                    tdAcciones.appendChild(btnEliminar);
                    tbody.appendChild(tr);
                });
                
                const nextNro = maxNro > 0 ? maxNro + 1 : 1000;
                document.getElementById('cot-nro').value = String(nextNro).padStart(4, '0');
                window.actualizarPreview();

                // Actualizar métricas y aplicar filtro si hay búsqueda activa
                if (window.actualizarMetricasCotizaciones) {
                    window.actualizarMetricasCotizaciones();
                }
                if (window.filtrarCotizaciones) {
                    window.filtrarCotizaciones();
                }
                if (window.poblarSelectorCotizacionesContrato) {
                    window.poblarSelectorCotizacionesContrato();
                }

                // Asegurar event listener del buscador
                const inputBuscador = document.getElementById('buscador-cotizaciones');
                if (inputBuscador && !inputBuscador.dataset.listenerBound) {
                    inputBuscador.dataset.listenerBound = "true";
                    inputBuscador.addEventListener('input', window.filtrarCotizaciones);
                }
                
            } catch (error) { console.error(error); }
        };

        window.enviarPorWhatsApp = function(docId) {
            const cot = window.cotizacionesDBLocal[docId];
            if(!cot) return;
            
            const texto = `Hola ${cot.cliente},\n\nTe adjunto la información de tu cotización *Nro: #${cot.nro}*.\n\n*Total:* $${cot.total}\n\nQuedamos a tu disposición para concretar el despacho o resolver cualquier duda.\n\nSaludos,\nEquipo F&B Parts`;
            let phone = cot.telefono.replace(/\D/g, ''); 
            if (phone.length >= 10 && !phone.startsWith('58')) {
                phone = '58' + phone.slice(-10);
            }
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank');
        };

        window.abrirModalCorreoIA = function(docId) {
            const cot = window.cotizacionesDBLocal[docId];
            if(!cot) return;
            
            document.getElementById('ia-doc-id').value = docId;
            document.getElementById('ia-nro-cot').textContent = cot.nro;
            document.getElementById('ia-cliente-cot').textContent = cot.cliente;
            document.getElementById('ia-contexto').value = '';
            
            const textoBasico = `Estimado/a ${cot.cliente},\n\nDe acuerdo a su solicitud, adjunto la información referente a la cotización #${cot.nro} para su vehículo ${cot.vehiculo}.\n\nEl total estimado es de $${cot.total}. \n\nQuedo a su entera disposición para cualquier duda.\n\nAtentamente,\nF&B Parts`;
            document.getElementById('ia-respuesta').value = textoBasico;
            
            document.getElementById('modal-ia-correo').style.display = 'flex';
        };

        window.cerrarModalCorreoIA = function() {
            document.getElementById('modal-ia-correo').style.display = 'none';
        };

        // 🚀 LÓGICA DE IA CON PUTER.JS (Cero API Keys, Cero Bloqueos)
        window.generarRespuestaIA = async function() {
            const docId = document.getElementById('ia-doc-id').value;
            const contexto = document.getElementById('ia-contexto').value.trim();
            const cot = window.cotizacionesDBLocal[docId];
            const btn = document.getElementById('btn-generar-ia');
            
            // Verificamos si Puter cargó correctamente (CORREGIDO EL BUG DE LA ETIQUETA SCRIPT)
            if (typeof puter === 'undefined') {
                alert("⚠️ Puter no está cargado. Asegúrate de haber puesto su librería en el encabezado.");
                return;
            }

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Puter pensando...';
            btn.disabled = true;

            // Construimos las instrucciones
            let promptTexto = `Eres Brhayan Polidor, Gerente de Ventas de Inversiones FB Parts, C.A. en Caracas, Venezuela.
            Redacta un correo profesional, persuasivo y cordial para enviarle una cotización a tu cliente.
            
            DATOS DE LA COTIZACIÓN:
            - Cliente: ${cot.cliente}
            - Vehículo: ${cot.vehiculo}
            - Nro Cotización: #${cot.nro}
            - Total: $${cot.total}
            
            REPUESTOS COTIZADOS:\n`;
            
            cot.items.forEach(i => {
                promptTexto += `- ${i.cantidad}x ${i.descripcion} ($${i.precioUnitario})\n`;
            });
            
            if (contexto !== "") {
                promptTexto += `\nCONTEXTO ADICIONAL / MENSAJE PREVIO DEL CLIENTE:\n"${contexto}"\n(Responde a esto de forma natural en el correo, brindando soluciones amables).\n`;
            }

            promptTexto += `\nINSTRUCCIONES FINALES:
            - Menciona que la cotización en formato PDF va adjunta al correo.
            - Firma como "Brhayan Polidor, Gerente de Ventas, Inversiones FB Parts, C.A.".
            - Devuelve ÚNICAMENTE el texto listo para enviar por correo. No incluyas "Asunto:" ni comillas raras.`;

            try {
                // Llamada nativa a la IA de Puter
                const respuesta = await puter.ai.chat(promptTexto);
                
                // Puter.js devuelve el texto directamente o un objeto, extraemos el texto
                const textoFinal = typeof respuesta === 'string' ? respuesta : respuesta.message.content;
                
                document.getElementById('ia-respuesta').value = textoFinal.trim();
                btn.innerHTML = '<i class="fas fa-check"></i> ¡Correo Listo!';
                
            } catch (error) {
                console.error("Error con Puter API:", error);
                alert("⚠️ Ocurrió un error con la IA de Puter:\n" + error.message);
                btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            }

            // Restaurar el botón después de 3 segundos
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-magic"></i> Escribir Respuesta con IA';
                btn.disabled = false;
            }, 3000);
        };
      
        // 🚀 FUNCIÓN PARA ABRIR GMAIL CON EL TEXTO GENERADO
        window.enviarPorGmail = function() {
            const docId = document.getElementById('ia-doc-id').value;
            const cot = window.cotizacionesDBLocal[docId];
            if(!cot) return;
            
            const asunto = encodeURIComponent(`Cotización #${cot.nro} - F&B Parts`);
            const cuerpo = encodeURIComponent(document.getElementById('ia-respuesta').value);
            
            // Abre una pestaña nueva directo en la ventana de redactar de Gmail
            window.open(`https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${asunto}&body=${cuerpo}`, '_blank');
        };

        // =========================================================================
        // 📜 GENERADOR OFICIAL DE CONTRATOS MERCANTILES DE PROCURA E IMPORTACIÓN
        // =========================================================================

        window.contratoItemsMemoria = [];

        window.numeroALetrasUSD = function(cantidad) {
            if (cantidad === undefined || cantidad === null || isNaN(cantidad)) return "CERO DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA CON CERO CENTAVOS";
            
            const num = Math.abs(parseFloat(cantidad));
            const enteros = Math.floor(num);
            const centavos = Math.round((num - enteros) * 100);

            function Unidades(n) {
                switch (n) {
                    case 1: return "UN";
                    case 2: return "DOS";
                    case 3: return "TRES";
                    case 4: return "CUATRO";
                    case 5: return "CINCO";
                    case 6: return "SEIS";
                    case 7: return "SIETE";
                    case 8: return "OCHO";
                    case 9: return "NUEVE";
                    default: return "";
                }
            }

            function DecenasY(strSin, numUnidades) {
                if (numUnidades > 0) return strSin + " Y " + Unidades(numUnidades);
                return strSin;
            }

            function Decenas(n) {
                const decena = Math.floor(n / 10);
                const unidad = n - (decena * 10);

                switch (decena) {
                    case 1:
                        switch (unidad) {
                            case 0: return "DIEZ";
                            case 1: return "ONCE";
                            case 2: return "DOCE";
                            case 3: return "TRECE";
                            case 4: return "CATORCE";
                            case 5: return "QUINCE";
                            default: return "DIECI" + Unidades(unidad);
                        }
                    case 2:
                        switch (unidad) {
                            case 0: return "VEINTE";
                            case 1: return "VEINTIÚN";
                            default: return "VEINTI" + Unidades(unidad);
                        }
                    case 3: return DecenasY("TREINTA", unidad);
                    case 4: return DecenasY("CUARENTA", unidad);
                    case 5: return DecenasY("CINCUENTA", unidad);
                    case 6: return DecenasY("SESENTA", unidad);
                    case 7: return DecenasY("SETENTA", unidad);
                    case 8: return DecenasY("OCHENTA", unidad);
                    case 9: return DecenasY("NOVENTA", unidad);
                    case 0: return Unidades(unidad);
                    default: return "";
                }
            }

            function Centenas(n) {
                const centenas = Math.floor(n / 100);
                const decenas = n - (centenas * 100);

                switch (centenas) {
                    case 1:
                        if (decenas > 0) return "CIENTO " + Decenas(decenas);
                        return "CIEN";
                    case 2: return "DOSCIENTOS " + Decenas(decenas);
                    case 3: return "TRESCIENTOS " + Decenas(decenas);
                    case 4: return "CUATROCIENTOS " + Decenas(decenas);
                    case 5: return "QUINIENTOS " + Decenas(decenas);
                    case 6: return "SEISCIENTOS " + Decenas(decenas);
                    case 7: return "SETECIENTOS " + Decenas(decenas);
                    case 8: return "OCHOCIENTOS " + Decenas(decenas);
                    case 9: return "NOVECIENTOS " + Decenas(decenas);
                    default: return Decenas(decenas);
                }
            }

            function Miles(n) {
                const divisor = 1000;
                const cientos = Math.floor(n / divisor);
                const resto = n - (cientos * divisor);

                let strMiles = "";
                let strCentenas = "";

                if (cientos === 1) {
                    strMiles = "UN MIL";
                } else if (cientos > 1) {
                    strMiles = Centenas(cientos) + " MIL";
                }

                strCentenas = Centenas(resto);

                if (strMiles === "") return strCentenas.trim();
                if (strCentenas === "") return strMiles.trim();

                return (strMiles + " " + strCentenas).trim();
            }

            function Millones(n) {
                const divisor = 1000000;
                const cientos = Math.floor(n / divisor);
                const resto = n - (cientos * divisor);

                let strMillones = "";
                let strMiles = "";

                if (cientos === 1) {
                    strMillones = "UN MILLÓN";
                } else if (cientos > 1) {
                    strMillones = Centenas(cientos) + " MILLONES";
                }

                strMiles = Miles(resto);

                if (strMillones === "") return strMiles.trim();
                if (strMiles === "") return strMillones.trim();

                return (strMillones + " " + strMiles).trim();
            }

            let textoEnteros = "";
            if (enteros === 0) {
                textoEnteros = "CERO";
            } else {
                textoEnteros = Millones(enteros);
            }

            let conector = " ";
            if (enteros >= 1000000 && enteros % 1000000 === 0) {
                conector = " DE ";
            }

            const moneda = enteros === 1 ? "DÓLAR DE LOS ESTADOS UNIDOS DE AMÉRICA" : "DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA";
            
            let textoCentavos = "";
            if (centavos === 0) {
                textoCentavos = "CON CERO CENTAVOS";
            } else {
                textoCentavos = "CON " + Decenas(centavos) + (centavos === 1 ? " CENTAVO" : " CENTAVOS");
            }

            return `${textoEnteros}${conector}${moneda} ${textoCentavos}`.replace(/\s+/g, ' ').trim();
        };

        window.poblarSelectorCotizacionesContrato = function(selectedId = '') {
            const sel = document.getElementById('contrato-selector-cotizaciones');
            if (!sel) return;

            sel.innerHTML = '<option value="">-- Selecciona una cotización guardada... --</option>';

            const cotizaciones = [];
            for (const docId in window.cotizacionesDBLocal) {
                cotizaciones.push({ docId, ...window.cotizacionesDBLocal[docId] });
            }

            cotizaciones.sort((a, b) => {
                const numA_str = String(a.nro || a.nroCotizacion || '').replace('#', '').trim();
                const numB_str = String(b.nro || b.nroCotizacion || '').replace('#', '').trim();
                const partesA = numA_str.split('-');
                const partesB = numB_str.split('-');
                const baseA = parseInt(partesA[0]) || 0;
                const baseB = parseInt(partesB[0]) || 0;
                if (baseB !== baseA) return baseB - baseA;
                const subA = parseInt(partesA[1]) || 0;
                const subB = parseInt(partesB[1]) || 0;
                return subB - subA;
            });

            cotizaciones.forEach(c => {
                const nroStr = String(c.nro || c.nroCotizacion || 'S/N').replace('#', '');
                const clienteStr = c.cliente || 'Sin Cliente';
                const vehiculoPartes = [c.vehiculo, c.anio ? `Año ${c.anio}` : ''].filter(Boolean).join(' ');
                const totalNum = parseFloat(c.total) || 0;
                const totalStr = totalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                const textoOpcion = vehiculoPartes 
                    ? `#${nroStr} - ${clienteStr} - ${vehiculoPartes} - $${totalStr}`
                    : `#${nroStr} - ${clienteStr} - $${totalStr}`;

                const opt = document.createElement('option');
                opt.value = c.docId;
                opt.textContent = textoOpcion;
                if (selectedId && (c.docId === selectedId || String(c.nro).replace('#', '').trim() === String(selectedId).replace('#', '').trim())) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
        };

        window.cargarContratoDesdeCotizacion = async function(cotizacionId) {
            if (!cotizacionId) return;

            let cot = null;
            let docIdEncontrado = '';

            if (typeof cotizacionId === 'object' && cotizacionId !== null) {
                cot = cotizacionId;
                docIdEncontrado = cot.id || cot.docId || '';
            } else {
                docIdEncontrado = String(cotizacionId);
                cot = window.cotizacionesDBLocal[docIdEncontrado];

                if (!cot) {
                    for (const id in window.cotizacionesDBLocal) {
                        const item = window.cotizacionesDBLocal[id];
                        if (String(item.nro || item.nroCotizacion).replace('#', '').trim() === docIdEncontrado.replace('#', '').trim()) {
                            cot = item;
                            docIdEncontrado = id;
                            break;
                        }
                    }
                }

                if (!cot && typeof getDoc !== 'undefined' && typeof doc !== 'undefined' && typeof db !== 'undefined') {
                    try {
                        const docRef = doc(db, "cotizaciones", docIdEncontrado);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            cot = docSnap.data();
                            window.cotizacionesDBLocal[docIdEncontrado] = cot;
                        }
                    } catch (e) {
                        console.error("Error al buscar cotización en Firestore:", e);
                    }
                }
            }

            if (!cot) {
                alert("⚠️ No se encontró la información de la cotización seleccionada.");
                return;
            }

            // Asegurar apertura del modal
            const modal = document.getElementById('modal-generador-contrato');
            if (modal) modal.style.display = 'flex';

            // Desactivar modo plantilla en blanco
            const chkBlanco = document.getElementById('contrato-modo-blanco');
            if (chkBlanco) chkBlanco.checked = false;

            // Actualizar selector desplegable
            window.poblarSelectorCotizacionesContrato(docIdEncontrado);

            const hoy = new Date();
            const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
            const fechaStr = `Caracas, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

            // 1. Inyectar datos generales
            document.getElementById('contrato-nro').value = String(cot.nro || cot.nroCotizacion || '').replace('#', '').trim();
            document.getElementById('contrato-fecha').value = cot.fecha ? (cot.fecha.includes('Caracas') ? cot.fecha : `Caracas, ${cot.fecha}`) : fechaStr;
            document.getElementById('contrato-cliente').value = cot.cliente || '';
            document.getElementById('contrato-rif').value = cot.rif || '';
            document.getElementById('contrato-domicilio').value = cot.direccion || 'Caracas, Venezuela';
            document.getElementById('contrato-telefono').value = cot.telefono || '';

            const vehiculoTxt = [cot.vehiculo || '', cot.anio ? `Año ${cot.anio}` : ''].filter(Boolean).join(' - ');
            document.getElementById('contrato-vehiculo').value = vehiculoTxt;
            document.getElementById('contrato-vin').value = (cot.vin || cot.chasis || '').toUpperCase();

            // 2. Mapear renglones de repuestos
            window.contratoItemsMemoria = [];
            const rawItems = (Array.isArray(cot.items) && cot.items.length > 0) ? cot.items : ((Array.isArray(cot.repuestos) && cot.repuestos.length > 0) ? cot.repuestos : []);
            if (rawItems.length > 0) {
                rawItems.forEach(it => {
                    window.contratoItemsMemoria.push({
                        cantidad: parseFloat(it.cantidad) || 1,
                        descripcion: it.descripcion || it.repuesto || it.nombre || '',
                        condicion: it.condicion || 'NUEVO / OEM',
                        precioUnitario: parseFloat(it.precioUnitario) || parseFloat(it.precio) || 0
                    });
                });
            } else {
                window.contratoItemsMemoria.push({
                    cantidad: 1,
                    descripcion: 'REPUESTO IMPORTADO BAJO PEDIDO',
                    condicion: 'NUEVO / OEM',
                    precioUnitario: parseFloat(cot.subtotal || cot.total || 0)
                });
            }

            // 3. Montos Financieros
            const subtotal = parseFloat(cot.subtotal) || 0;
            const iva = parseFloat(cot.iva) || (subtotal * 0.16);
            const total = parseFloat(cot.total) || (subtotal + iva);

            document.getElementById('contrato-subtotal').value = subtotal.toFixed(2);
            document.getElementById('contrato-iva').value = iva.toFixed(2);
            document.getElementById('contrato-total').value = total.toFixed(2);

            // 4. Recalcular montos anticipo / saldo
            const pctAnt = parseFloat(document.getElementById('contrato-pct-anticipo')?.value) || 80;
            const montoAnt = total * (pctAnt / 100);
            const montoSal = total - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            // 5. Renderizar inputs y vista previa en tiempo real
            window.renderizarItemsContratoInputs();
            window.actualizarContratoPreview();
        };

        window.abrirGeneradorContrato = function(cot = null) {
            const modal = document.getElementById('modal-generador-contrato');
            if (!modal) return;

            if (cot) {
                window.cargarContratoDesdeCotizacion(cot);
            } else {
                // Modo manual vacío
                const hoy = new Date();
                const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
                const fechaStr = `Caracas, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

                const chkBlanco = document.getElementById('contrato-modo-blanco');
                if (chkBlanco) chkBlanco.checked = false;

                window.cambiarModalidadContrato('fraccionado');

                document.getElementById('contrato-nro').value = document.getElementById('cot-nro')?.value || '1000';
                document.getElementById('contrato-fecha').value = fechaStr;
                document.getElementById('contrato-cliente').value = '';
                document.getElementById('contrato-rif').value = '';
                document.getElementById('contrato-domicilio').value = 'Caracas, Venezuela';
                document.getElementById('contrato-telefono').value = '';
                document.getElementById('contrato-vehiculo').value = '';
                document.getElementById('contrato-vin').value = '';

                window.contratoItemsMemoria = [
                    { cantidad: 1, descripcion: '', condicion: 'NUEVO / OEM', precioUnitario: 0 }
                ];

                document.getElementById('contrato-subtotal').value = '0.00';
                document.getElementById('contrato-iva').value = '0.00';
                document.getElementById('contrato-total').value = '0.00';

                window.aplicarPresetFraccion(80, 20);
                document.getElementById('contrato-recargo-almacenaje').value = '5.00';
                document.getElementById('contrato-dias-retiro').value = '5';

                window.poblarSelectorCotizacionesContrato('');
                window.renderizarItemsContratoInputs();
                window.actualizarContratoPreview();
            }

            modal.style.display = 'flex';
        };

        window.abrirGeneradorContratoManual = function() {
            window.abrirGeneradorContrato(null);
        };

        window.cerrarGeneradorContrato = function() {
            const modal = document.getElementById('modal-generador-contrato');
            if (modal) modal.style.display = 'none';
        };

        window.cambiarModalidadContrato = function(modo) {
            const radioUnico = document.querySelector('input[name="contrato-modalidad"][value="unico"]');
            const radioFraccionado = document.querySelector('input[name="contrato-modalidad"][value="fraccionado"]');
            const lblUnico = document.getElementById('lbl-modalidad-unico');
            const lblFraccionado = document.getElementById('lbl-modalidad-fraccionado');
            const bloque = document.getElementById('bloque-controles-fraccionado');

            if (modo === 'unico') {
                if (radioUnico) radioUnico.checked = true;
                if (lblUnico) {
                    lblUnico.style.borderColor = '#2c441b';
                    lblUnico.style.background = '#f0f7f1';
                    lblUnico.style.color = '#1e3a1e';
                }
                if (lblFraccionado) {
                    lblFraccionado.style.borderColor = '#cbd5e1';
                    lblFraccionado.style.background = '#fff';
                    lblFraccionado.style.color = '#475569';
                }
                if (bloque) bloque.style.display = 'none';
            } else {
                if (radioFraccionado) radioFraccionado.checked = true;
                if (lblFraccionado) {
                    lblFraccionado.style.borderColor = '#2c441b';
                    lblFraccionado.style.background = '#f0f7f1';
                    lblFraccionado.style.color = '#1e3a1e';
                }
                if (lblUnico) {
                    lblUnico.style.borderColor = '#cbd5e1';
                    lblUnico.style.background = '#fff';
                    lblUnico.style.color = '#475569';
                }
                if (bloque) bloque.style.display = 'block';
            }
            window.actualizarContratoPreview();
        };

        window.aplicarPresetFraccion = function(anticipo, saldo) {
            const inpAnt = document.getElementById('contrato-pct-anticipo');
            const inpSal = document.getElementById('contrato-pct-saldo');
            if (inpAnt) inpAnt.value = anticipo;
            if (inpSal) inpSal.value = saldo;

            const total = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const montoAnt = total * (anticipo / 100);
            const montoSal = total - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.ajustarPorcentajeAnticipo = function(val) {
            let pct = parseFloat(val);
            if (isNaN(pct)) pct = 80;
            if (pct < 1) pct = 1;
            if (pct > 99) pct = 99;

            const saldo = 100 - pct;
            const inpSal = document.getElementById('contrato-pct-saldo');
            if (inpSal) inpSal.value = saldo;

            const total = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const montoAnt = total * (pct / 100);
            const montoSal = total - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.ajustarPorcentajeSaldo = function(val) {
            let sal = parseFloat(val);
            if (isNaN(sal)) sal = 20;
            if (sal < 1) sal = 1;
            if (sal > 99) sal = 99;

            const anticipo = 100 - sal;
            const inpAnt = document.getElementById('contrato-pct-anticipo');
            if (inpAnt) inpAnt.value = anticipo;

            const total = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const montoAnt = total * (anticipo / 100);
            const montoSal = total - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.ajustarMontoAnticipo = function(val) {
            const montoAnt = parseFloat(val) || 0;
            const total = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const montoSal = Math.max(0, total - montoAnt);

            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            if (total > 0) {
                const pctAnt = Math.min(99, Math.max(1, Math.round((montoAnt / total) * 100)));
                const pctSal = 100 - pctAnt;
                const inpAnt = document.getElementById('contrato-pct-anticipo');
                const inpSal = document.getElementById('contrato-pct-saldo');
                if (inpAnt) inpAnt.value = pctAnt;
                if (inpSal) inpSal.value = pctSal;
            }

            window.actualizarContratoPreview();
        };

        window.ajustarMontoSaldo = function(val) {
            const montoSal = parseFloat(val) || 0;
            const total = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const montoAnt = Math.max(0, total - montoSal);

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);

            if (total > 0) {
                const pctSal = Math.min(99, Math.max(1, Math.round((montoSal / total) * 100)));
                const pctAnt = 100 - pctSal;
                const inpAnt = document.getElementById('contrato-pct-anticipo');
                const inpSal = document.getElementById('contrato-pct-saldo');
                if (inpAnt) inpAnt.value = pctAnt;
                if (inpSal) inpSal.value = pctSal;
            }

            window.actualizarContratoPreview();
        };

        window.renderizarItemsContratoInputs = function() {
            const container = document.getElementById('contrato-items-lista');
            if (!container) return;
            container.innerHTML = '';

            window.contratoItemsMemoria.forEach((it, idx) => {
                const row = document.createElement('div');
                row.style = 'display: grid; grid-template-columns: 42px 1fr 65px 24px; gap: 4px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;';
                row.innerHTML = `
                    <input type="number" min="1" value="${it.cantidad}" oninput="actualizarItemContrato(${idx}, 'cantidad', this.value)" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 4px; font-size: 11px; text-align: center; box-sizing: border-box;" title="Cantidad">
                    <input type="text" value="${it.descripcion}" oninput="actualizarItemContrato(${idx}, 'descripcion', this.value)" placeholder="Descripción del repuesto" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 4px; font-size: 11px; box-sizing: border-box;" title="Descripción">
                    <input type="number" step="0.01" value="${it.precioUnitario}" oninput="actualizarItemContrato(${idx}, 'precioUnitario', this.value)" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 4px; font-size: 11px; text-align: right; box-sizing: border-box;" title="Precio Unitario ($)">
                    <button type="button" onclick="eliminarItemContrato(${idx})" style="background: transparent; border: none; color: #ef4444; font-size: 14px; cursor: pointer; padding: 0; line-height: 1;" title="Eliminar renglón">&times;</button>
                `;
                container.appendChild(row);
            });
        };

        window.agregarItemContrato = function() {
            window.contratoItemsMemoria.push({
                cantidad: 1,
                descripcion: '',
                condicion: 'NUEVO / OEM',
                precioUnitario: 0
            });
            window.renderizarItemsContratoInputs();
            window.recalcularTotalesContrato();
        };

        window.eliminarItemContrato = function(idx) {
            if (window.contratoItemsMemoria.length <= 1) {
                window.contratoItemsMemoria[0] = { cantidad: 1, descripcion: '', condicion: 'NUEVO / OEM', precioUnitario: 0 };
            } else {
                window.contratoItemsMemoria.splice(idx, 1);
            }
            window.renderizarItemsContratoInputs();
            window.recalcularTotalesContrato();
        };

        window.actualizarItemContrato = function(idx, campo, val) {
            if (window.contratoItemsMemoria[idx]) {
                if (campo === 'cantidad') window.contratoItemsMemoria[idx].cantidad = parseFloat(val) || 1;
                else if (campo === 'precioUnitario') window.contratoItemsMemoria[idx].precioUnitario = parseFloat(val) || 0;
                else window.contratoItemsMemoria[idx][campo] = val;
            }
            window.recalcularTotalesContrato();
        };

        window.recalcularTotalesContrato = function() {
            let subtotal = 0;
            window.contratoItemsMemoria.forEach(it => {
                const c = parseFloat(it.cantidad) || 1;
                const p = parseFloat(it.precioUnitario) || 0;
                subtotal += (c * p);
            });
            const iva = subtotal * 0.16;
            const total = subtotal + iva;

            const inpSub = document.getElementById('contrato-subtotal');
            const inpIva = document.getElementById('contrato-iva');
            const inpTot = document.getElementById('contrato-total');

            if (inpSub) inpSub.value = subtotal.toFixed(2);
            if (inpIva) inpIva.value = iva.toFixed(2);
            if (inpTot) inpTot.value = total.toFixed(2);

            const pctAnt = parseFloat(document.getElementById('contrato-pct-anticipo')?.value) || 80;
            const montoAnt = total * (pctAnt / 100);
            const montoSal = total - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.recalcularDesdeTotalesManuales = function() {
            const sub = parseFloat(document.getElementById('contrato-subtotal')?.value) || 0;
            const iva = parseFloat(document.getElementById('contrato-iva')?.value) || 0;
            const tot = sub + iva;
            const inpTot = document.getElementById('contrato-total');
            if (inpTot) inpTot.value = tot.toFixed(2);

            const pctAnt = parseFloat(document.getElementById('contrato-pct-anticipo')?.value) || 80;
            const montoAnt = tot * (pctAnt / 100);
            const montoSal = tot - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.ajustarTotalContrato = function(val) {
            const tot = parseFloat(val) || 0;
            const sub = tot / 1.16;
            const iva = tot - sub;

            const inpSub = document.getElementById('contrato-subtotal');
            const inpIva = document.getElementById('contrato-iva');
            if (inpSub) inpSub.value = sub.toFixed(2);
            if (inpIva) inpIva.value = iva.toFixed(2);

            const pctAnt = parseFloat(document.getElementById('contrato-pct-anticipo')?.value) || 80;
            const montoAnt = tot * (pctAnt / 100);
            const montoSal = tot - montoAnt;

            const inpMontoAnt = document.getElementById('contrato-monto-anticipo');
            const inpMontoSal = document.getElementById('contrato-monto-saldo');
            if (inpMontoAnt) inpMontoAnt.value = montoAnt.toFixed(2);
            if (inpMontoSal) inpMontoSal.value = montoSal.toFixed(2);

            window.actualizarContratoPreview();
        };

        window.actualizarContratoPreview = function() {
            const canvas = document.getElementById('contrato-documento-imprimible');
            if (!canvas) return;

            const modoBlanco = document.getElementById('contrato-modo-blanco')?.checked || false;
            const radioFraccionado = document.querySelector('input[name="contrato-modalidad"][value="fraccionado"]');
            const esFraccionado = radioFraccionado ? radioFraccionado.checked : true;

            const nro = modoBlanco ? '____________________' : (document.getElementById('contrato-nro')?.value.trim() || 'S/N');
            const fecha = modoBlanco ? 'Caracas, ________ de ________________ de 20____' : (document.getElementById('contrato-fecha')?.value.trim() || 'Caracas, Venezuela');
            const cliente = modoBlanco ? '____________________________________________________________' : (document.getElementById('contrato-cliente')?.value.trim() || 'CLIENTE NO DEFINIDO');
            const rif = modoBlanco ? '________________________' : (document.getElementById('contrato-rif')?.value.trim() || 'V-00000000-0');
            const domicilio = modoBlanco ? '____________________________________________________________' : (document.getElementById('contrato-domicilio')?.value.trim() || 'Caracas, Venezuela');
            const telefono = modoBlanco ? '________________________' : (document.getElementById('contrato-telefono')?.value.trim() || '0412-0000000');
            const vehiculo = modoBlanco ? '____________________________________________________________' : (document.getElementById('contrato-vehiculo')?.value.trim() || 'VEHÍCULO NO ESPECIFICADO');
            const rawVin = (document.getElementById('contrato-vin')?.value || '').toUpperCase().trim();

            // 17 casillas del VIN (Bloques estáticos sin flex para total nitidez en WebKit y Chrome)
            let casillasVIN = '';
            for (let i = 0; i < 17; i++) {
                const char = (!modoBlanco && rawVin.length > i) ? rawVin[i] : '&nbsp;';
                casillasVIN += `<span style="display: inline-block; width: 20px; height: 24px; line-height: 22px; text-align: center; border: 1.5px solid #222; font-family: 'Courier New', monospace; font-size: 11.5px; font-weight: bold; background: #ffffff; color: #000000; margin: 0 1px; box-sizing: border-box; vertical-align: middle;">${char}</span>`;
            }

            const totalNum = parseFloat(document.getElementById('contrato-total')?.value) || 0;
            const subtotalNum = parseFloat(document.getElementById('contrato-subtotal')?.value) || 0;
            const ivaNum = parseFloat(document.getElementById('contrato-iva')?.value) || 0;

            const totalStr = modoBlanco ? '$__________________' : `$${totalNum.toFixed(2)}`;
            const subtotalStr = modoBlanco ? '$__________________' : `$${subtotalNum.toFixed(2)}`;
            const ivaStr = modoBlanco ? '$__________________' : `$${ivaNum.toFixed(2)}`;
            const totalLetras = modoBlanco ? '________________________________________________________________________________' : window.numeroALetrasUSD(totalNum);

            const pctAnticipo = parseInt(document.getElementById('contrato-pct-anticipo')?.value) || 80;
            const pctSaldo = 100 - pctAnticipo;
            const montoAnticipoNum = parseFloat(document.getElementById('contrato-monto-anticipo')?.value) || (totalNum * (pctAnticipo / 100));
            const montoSaldoNum = parseFloat(document.getElementById('contrato-monto-saldo')?.value) || (totalNum - montoAnticipoNum);

            const pctAnticipoStr = modoBlanco ? '____%' : `${pctAnticipo}%`;
            const pctSaldoStr = modoBlanco ? '____%' : `${pctSaldo}%`;
            const montoAnticipoStr = modoBlanco ? '$__________________' : `$${montoAnticipoNum.toFixed(2)}`;
            const montoSaldoStr = modoBlanco ? '$__________________' : `$${montoSaldoNum.toFixed(2)}`;
            const montoAnticipoLetras = modoBlanco ? '________________________________________________________________________________' : window.numeroALetrasUSD(montoAnticipoNum);
            const montoSaldoLetras = modoBlanco ? '________________________________________________________________________________' : window.numeroALetrasUSD(montoSaldoNum);

            const recargoDiario = modoBlanco ? '$______' : `$${(parseFloat(document.getElementById('contrato-recargo-almacenaje')?.value) || 5).toFixed(2)}`;
            const diasRetiro = modoBlanco ? '____' : String(document.getElementById('contrato-dias-retiro')?.value || 5);

            // Tabla de Repuestos
            let filasRepuestos = '';
            if (modoBlanco) {
                for (let r = 1; r <= 4; r++) {
                    filasRepuestos += `
                        <tr style="border-bottom: 1px solid #ccc;">
                            <td style="padding: 6px 8px; text-align: center; width: 35px;">${r}</td>
                            <td style="padding: 6px 8px; width: 55px; text-align: center;">____</td>
                            <td style="padding: 6px 8px;">__________________________________________________</td>
                            <td style="padding: 6px 8px; text-align: center; width: 85px;">NUEVO / OEM</td>
                            <td style="padding: 6px 8px; text-align: right; width: 85px;">$__________</td>
                            <td style="padding: 6px 8px; text-align: right; width: 95px;">$__________</td>
                        </tr>
                    `;
                }
            } else {
                const itemsValidos = window.contratoItemsMemoria.filter(i => (i.descripcion && i.descripcion.trim() !== '') || i.precioUnitario > 0);
                const items = itemsValidos.length > 0 ? itemsValidos : [
                    { cantidad: 1, descripcion: 'REPUESTO IMPORTADO SEGÚN ESPECIFICACIÓN TÉCNICA', precioUnitario: totalNum, condicion: 'NUEVO / OEM' }
                ];
                items.forEach((it, idx) => {
                    const cant = parseFloat(it.cantidad) || 1;
                    const precio = parseFloat(it.precioUnitario) || 0;
                    const descLinea = (cant * precio).toFixed(2);
                    filasRepuestos += `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 5px 8px; text-align: center; width: 35px;">${idx + 1}</td>
                            <td style="padding: 5px 8px; text-align: center; width: 55px;">${cant}</td>
                            <td style="padding: 5px 8px; font-weight: 500;">${it.descripcion || 'REPUESTO'}</td>
                            <td style="padding: 5px 8px; text-align: center; width: 85px; font-size: 8.5pt;">${it.condicion || 'NUEVO / OEM'}</td>
                            <td style="padding: 5px 8px; text-align: right; width: 85px;">$${precio.toFixed(2)}</td>
                            <td style="padding: 5px 8px; text-align: right; width: 95px; font-weight: bold;">$${descLinea}</td>
                        </tr>
                    `;
                });
            }

            // Título y Cláusulas según modalidad
            let tituloContrato = '';
            let clausulaTercera = '';
            let clausulasRestantes = '';

            if (!esFraccionado) {
                tituloContrato = 'CONTRATO MERCANTIL DE PROCURA INTERNACIONAL E IMPORTACIÓN DE AUTOPARTES BAJO PEDIDO<br><span style="font-size: 10pt; font-weight: bold; color: #2c441b;">(MODALIDAD PAGO ÚNICO 100%)</span>';
                
                clausulaTercera = `
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA TERCERA (Modalidad de Pago Único 100% y Trazabilidad Fiscal):</strong> EL CLIENTE conviene y liquida en este acto la totalidad del cien por ciento (100%) del valor estipulado de la operación, por un monto definitivo de <strong>${totalStr} (${totalLetras})</strong>. Dicha liquidación integral congela de forma inmediata e inmutable los costos de fábrica, seguro internacional de carga y fletes marítimos o aéreos. Las partes reconocen que el presente contrato, vinculado a la cotización <strong>#${nro}</strong> y a la correspondiente emisión fiscal, constituye título legítimo de trazabilidad, transparencia y auditoría frente a empresas aseguradoras, peritos y organismos tributarios.
                    </p>
                `;

                clausulasRestantes = `
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA CUARTA (Carácter Irrevocable del Encargo y No Reembolso en Tránsito):</strong> Por tratarse de un encargo especial de procura sobre piezas que no forman parte del inventario regular disponible en plaza de EL PROVEEDOR, la orden de importación adquiere fuerza obligatoria e irrevocable una vez confirmado el pedido ante los fabricantes internacionales. En consecuencia, no se admitirán revocaciones unilaterales, solicitudes de rescisión ni devoluciones de dinero mientras la mercancía se encuentre en fase de fabricación, trámites aduanales en puerto de embarque o en tránsito internacional marítimo o aéreo.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA QUINTA (Lapsos Estimados de Tránsito Marítimo en Días Hábiles y Eximentes por Causa Extraña No Imputable):</strong> El lapso estimado de procura internacional, consolidación marítima y desaduanamiento oscila referencialmente entre <strong>cuarenta y cinco (45) y noventa (90) días hábiles</strong> (excluyendo sábados, domingos, feriados nacionales/bancarios en Venezuela y en el país exportador), contados a partir del día hábil siguiente a la acreditación del pago y entrega del Serial VIN.
                        <br>
                        <em>Parágrafo Único (Exoneración por Exceso de los 90 Días Hábiles y Causas Externas):</em> EL CLIENTE acepta que dicho lapso de 45 a 90 días hábiles es meramente estimativo y referencial. Dado que en la logística internacional intervienen terceros y autoridades ajenas al control de EL PROVEEDOR, cualquier retraso que exceda los noventa (90) días hábiles derivado de causas externas —incluyendo tiempos de despacho en fábrica, rolados de buque (roll-over) por líneas navieras, congestión en puertos de transbordo, contingencias climáticas, inspecciones o retenciones aduaneras (SENIAT, Bolipuertos), temporadas decembrinas o festividades en origen— constituye Causa Extraña No Imputable, Caso Fortuito o Fuerza Mayor (Artículos 1.271 y 1.272 del Código Civil Venezolano). Por consiguiente, la superación de los noventa (90) días hábiles exime de toda responsabilidad a EL PROVEEDOR, no constituye incumplimiento ni mora, y no da derecho a indemnizaciones ni resolución contractual.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA SEXTA (Regla Estricta de Compatibilidad VIN, Daños Ocultos e Impericia - Art. 1.184 CC):</strong> EL CLIENTE asume la total responsabilidad sobre la veracidad y exactitud del Serial de Carrocería o Chasis (VIN de 17 dígitos) y especificaciones técnicas suministradas. En el evento de que la pieza importada coincida técnicamente con la referencia de catálogo oficial para dicho VIN, pero no calce debido a modificaciones previas, adaptaciones, cambios de motor o carrocería ajenos a la ficha técnica original de fábrica, no habrá lugar a reintegros ni reemplazos gratuitos. Asimismo, de conformidad con el <strong>Artículo 1.184 del Código Civil</strong>, EL PROVEEDOR queda exonerado de responsabilidad por daños originados por impericia, mala praxis de talleres mecánicos o manipulación forzada durante la instalación.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA SÉPTIMA (Recepción Física, Piezas de Carrocería / Iluminación y Caducidad de 24 Horas):</strong> Al momento de la entrega material de los repuestos en las dependencias de EL PROVEEDOR o su retiro ante empresa de encomiendas, EL CLIENTE inspeccionará minuciosamente el estado externo de los mismos. Tratándose de piezas de carrocería, vidrios, retrovisores, faros o luminarias, la conformidad sobre integridad estética se otorgará en el acto de recepción física. Para cualquier otra discrepancia técnica o vicio aparente, se fija un lapso improrrogable de caducidad de <strong>veinticuatro (24) horas continuas</strong>; transcurrido el cual sin objeción motivada por escrito, la entrega se considerará perfecta, definitiva y convalidada a entera satisfacción.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA OCTAVA (Adhesión Normativa a Políticas Oficiales y Jurisdicción Especial):</strong> El presente documento se integra y somete a las Políticas de Garantía, Cambios, Devoluciones, Importaciones y Envíos de Inversiones FB Parts, C.A., publicadas de forma permanente e íntegra en el sitio web oficial: <strong>https://www.fybparts.com/politicas-devoluciones.html</strong>, las cuales EL CLIENTE declara conocer, aceptar y acatar expresamente. Para todas las controversias, interpretaciones o requerimientos dimanantes del presente instrumento, las partes eligen como domicilio especial, exclusivo y excluyente a los tribunales competentes de la ciudad de <strong>Caracas, Distrito Capital, República Bolivariana de Venezuela</strong>.
                    </p>
                `;
            } else {
                const pctTitulo = modoBlanco ? '____/____' : `${pctAnticipo}/${pctSaldo}`;
                tituloContrato = `CONTRATO MERCANTIL DE PROCURA INTERNACIONAL E IMPORTACIÓN DE AUTOPARTES BAJO PEDIDO<br><span style="font-size: 10pt; font-weight: bold; color: #2c441b;">(MODALIDAD FRACCIONADA ${pctTitulo} CON RESERVA DE DOMINIO)</span>`;

                clausulaTercera = `
                    <div style="margin: 6px 0; text-align: justify;">
                        <p style="margin: 0 0 4px 0;">
                            <strong>CLÁUSULA TERCERA (Esquema Fraccionado Excepcional ${pctAnticipoStr} / ${pctSaldoStr} y Reserva de Dominio):</strong> Las partes convienen en estructurar el pago de la presente operación de procura bajo un esquema fraccionado excepcional compuesto por dos etapas vinculantes:
                        </p>
                        <div style="padding-left: 12px; margin: 4px 0;">
                            <p style="margin: 2px 0;">
                                <strong>1. Anticipo de Activación y Procura (${pctAnticipoStr}):</strong> Por la suma de <strong>${montoAnticipoStr} (${montoAnticipoLetras})</strong>, cancelada por EL CLIENTE en este acto como condición sine qua non para procesar la orden ante el fabricante extranjero y afianzar la reserva de flete internacional.
                            </p>
                            <p style="margin: 2px 0;">
                                <strong>2. Saldo Contra Entrega y Nacionalización (${pctSaldoStr}):</strong> Por la suma de <strong>${montoSaldoStr} (${montoSaldoLetras})</strong>, la cual deberá ser liquidada íntegramente por EL CLIENTE al momento de notificarse el arribo de la carga a Caracas y previo a la entrega material del repuesto.
                            </p>
                            <p style="margin: 2px 0;">
                                <strong>3. Reserva de Dominio y Derecho de Retención:</strong> De conformidad con la legislación mercantil, EL PROVEEDOR se reserva el pleno dominio y la titularidad jurídica de las piezas importadas, así como el legítimo derecho de retención sobre las mismas en almacén, hasta tanto EL CLIENTE liquide el cien por ciento (100%) del saldo restante de <strong>${montoSaldoStr}</strong>.
                            </p>
                            <p style="margin: 2px 0;">
                                <strong>4. Transparencia y Auditoría de Seguros:</strong> El recibo emitido por el anticipo del ${pctAnticipoStr} (${montoAnticipoStr}) acredita el inicio de la procura, emitiéndose la constancia fiscal definitiva por el saldo del ${pctSaldoStr} (${montoSaldoStr}) contra su pago efectivo, conservando la estricta trazabilidad requerida por firmas aseguradoras y peritos.
                            </p>
                        </div>
                    </div>
                `;

                clausulasRestantes = `
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA CUARTA (Plazo Perentorio de Retiro, Mora del Acreedor, Almacenaje y Abandono):</strong> Una vez notificado EL CLIENTE sobre la disponibilidad física de los repuestos en Caracas (mediante comunicación por correo electrónico, WhatsApp o vía telefónica), éste dispondrá de un término perentorio de <strong>${diasRetiro} días hábiles</strong> para liquidar el saldo del ${pctSaldoStr} (${montoSaldoStr}) y retirar los repuestos.
                        <br>
                        <em>Régimen de Custodia y Almacenaje:</em> Vencido dicho término sin que EL CLIENTE haya cancelado el saldo o retirado el producto, se devengará automáticamente a partir del día siguiente un recargo diario por concepto de guarda y custodia equivalente a <strong>${recargoDiario} diarios</strong> por cada día continuo de retraso.
                        <br>
                        <em>Cláusula Penal por Abandono Definitivo (Art. 1.257 Código Civil):</em> Transcurridos treinta (30) días continuos desde la fecha de notificación de arribo sin que EL CLIENTE salde la totalidad adeudada (saldo del ${pctSaldoStr} más almacenaje acumulado), operará de pleno derecho y sin necesidad de intimación judicial la declaratoria de <strong>ABANDONO DEFINITIVO</strong>. En consecuencia, el anticipo del ${pctAnticipoStr} (${montoAnticipoStr}) quedará consolidado en favor de EL PROVEEDOR como indemnización fija y punitiva por concepto de fletes impagados, gastos logísticos y daños contractuales, quedando EL PROVEEDOR plenamente facultado para disponer, reasignar o enajenar las autopartes a terceros para mitigar el detrimento patrimonial.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA QUINTA (Carácter Irrevocable del Encargo y No Reembolso del Anticipo de ${pctAnticipoStr} en Tránsito):</strong> El pago del anticipo de procura del ${pctAnticipoStr} (${montoAnticipoStr}) posee carácter definitivo e irrevocable. Toda vez que dichos recursos se transfieren a los fabricantes internacionales para el mecanizado y despacho a medida del vehículo, no se aceptarán cancelaciones unilaterales, reintegros ni desistimientos mientras las piezas se encuentren en fase de producción o tránsito internacional.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA SEXTA (Lapsos Estimados de Tránsito Marítimo en Días Hábiles y Eximentes por Causa Extraña No Imputable):</strong> El lapso estimado de procura internacional, consolidación marítima y desaduanamiento oscila referencialmente entre <strong>cuarenta y cinco (45) y noventa (90) días hábiles</strong> (excluyendo sábados, domingos, feriados nacionales/bancarios en Venezuela y en el país exportador), contados a partir del día hábil siguiente a la acreditación del anticipo y entrega del Serial VIN.
                        <br>
                        <em>Parágrafo Único (Exoneración por Exceso de los 90 Días Hábiles y Causas Externas):</em> EL CLIENTE acepta que dicho lapso de 45 a 90 días hábiles es meramente estimativo y referencial. Dado que en la logística internacional intervienen terceros y autoridades ajenas al control de EL PROVEEDOR, cualquier retraso que exceda los noventa (90) días hábiles derivado de causas externas —incluyendo tiempos de despacho en fábrica, rolados de buque (roll-over) por líneas navieras, congestión en puertos de transbordo, contingencias climáticas, inspecciones o retenciones aduaneras (SENIAT, Bolipuertos), temporadas decembrinas o festividades en origen— constituye Causa Extraña No Imputable, Caso Fortuito o Fuerza Mayor (Artículos 1.271 y 1.272 del Código Civil Venezolano). Por consiguiente, la superación de los noventa (90) días hábiles exime de toda responsabilidad a EL PROVEEDOR, no constituye incumplimiento ni mora, no da derecho a indemnizaciones ni resolución contractual, y no altera, extingue ni releva la obligación jurídica de EL CLIENTE de saldar el ${pctSaldoStr} restante (${montoSaldoStr}) una vez arribada la mercancía.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA SÉPTIMA (Regla Estricta de Compatibilidad VIN y Daños Ocultos):</strong> La exactitud en el suministro del Serial VIN de 17 dígitos es de la exclusiva incumbencia de EL CLIENTE. Cuando las autopartes suministradas correspondan estrictamente a la ficha técnica oficial para el VIN reportado, EL CLIENTE no podrá excusarse en adaptaciones, injertos o siniestros ocultos no manifestados para postergar o rehusar el pago del saldo restante del ${pctSaldoStr} (${montoSaldoStr}) contra entrega.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA OCTAVA (Recepción Física en el Acto de Entrega y Caducidad de 24 Horas):</strong> La entrega material de los repuestos queda expresamente supeditada al previo pago del cien por ciento (100%) del saldo de ${montoSaldoStr} y de los costos de almacenaje devengados, si los hubiere. En el acto de entrega se verificará la integridad física exterior (piezas de carrocería o faros se convalidan en el acto); para cualquier otra inconformidad técnica rige el plazo perentorio de caducidad de veinticuatro (24) horas continuas.
                    </p>
                    <p style="margin: 6px 0; text-align: justify;">
                        <strong>CLÁUSULA NOVENA (Adhesión Normativa a Políticas Oficiales y Jurisdicción Especial):</strong> Este contrato se complementa de forma vinculante con las Políticas de Garantía, Cambios, Devoluciones, Importaciones y Envíos de Inversiones FB Parts, C.A., publicadas en <strong>https://www.fybparts.com/politicas-devoluciones.html</strong>. Las partes fijan como jurisdicción especial, única y excluyente la ciudad de <strong>Caracas, República Bolivariana de Venezuela</strong>, renunciando formalmente a cualquier otro fuero.
                    </p>
                `;
            }

            canvas.innerHTML = `
                <!-- MEMBRETE Y ENCABEZADO (TABLA ESTÁTICA PARA COMPATIBILIDAD TOTAL SAFARI/CHROME) -->
                <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #2c441b; padding-bottom: 6px; margin-bottom: 10px;">
                    <tr>
                        <td style="vertical-align: middle; width: 68%;">
                            <table style="border-collapse: collapse;">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 12px; width: 135px;">
                                        <img src="https://static.wixstatic.com/media/5c1748_5dd249cea38c4c4ba294cdd8edb75b6c~mv2.png/v1/crop/x_0,y_547,w_2395,h_1307/fill/w_135,h_74,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/LOGO-FB-PARTS-COLORES-NUEVOS-_edited_edi.png" alt="F&B Parts Logo" style="height: 42px; object-fit: contain; display: block;">
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <h2 style="margin: 0; font-family: 'Arial', sans-serif; font-size: 12.5pt; color: #2c441b; letter-spacing: 0.5px; font-weight: bold; line-height: 1.15;">INVERSIONES FB PARTS, C.A.</h2>
                                        <span style="font-size: 7.5pt; color: #444; font-weight: bold; display: block; margin-top: 2px;">RIF: J-50397111-8 • División de Procura Internacional e Importación</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                        <td style="vertical-align: middle; width: 32%; text-align: right; font-size: 8pt; color: #333; line-height: 1.3;">
                            <div><strong>EXPEDIENTE:</strong> #${nro}</div>
                            <div><strong>FECHA:</strong> ${fecha}</div>
                            <div><strong>SEDE:</strong> Caracas, D.C.</div>
                        </td>
                    </tr>
                </table>

                <!-- TÍTULO -->
                <div style="text-align: center; margin: 8px 0 12px 0;">
                    <h1 style="margin: 0; font-size: 10pt; font-weight: bold; text-transform: uppercase; line-height: 1.35; color: #111;">
                        ${tituloContrato}
                    </h1>
                </div>

                <!-- COMPARECENCIA -->
                <p style="margin: 6px 0; text-align: justify; line-height: 1.32;">
                    Entre la sociedad mercantil <strong>INVERSIONES FB PARTS, C.A.</strong>, inscrita en el Registro de Información Fiscal bajo el Nro. <strong>J-50397111-8</strong>, con domicilio fiscal en Caracas, Distrito Capital, República Bolivariana de Venezuela, debidamente representada en este acto por su Gerencia de Ventas y Procura Internacional, quien en lo sucesivo y a los únicos efectos del presente contrato se denominará <strong>"EL PROVEEDOR"</strong>, por una parte; y por la otra parte, la persona natural o jurídica debidamente identificada a continuación:
                </p>

                <!-- CUADRO DE IDENTIFICACIÓN (TABLA HTML CON ANCHOS PORCENTUALES) -->
                <table style="width: 100%; border-collapse: collapse; background: #fbfbfb; border: 1px solid #ddd; border-radius: 4px; margin: 6px 0; font-size: 8pt; line-height: 1.35;">
                    <tr>
                        <td style="width: 62%; padding: 4px 8px; vertical-align: top;"><strong>EL CLIENTE / ADQUIRENTE:</strong> ${cliente}</td>
                        <td style="width: 38%; padding: 4px 8px; vertical-align: top;"><strong>C.I. / RIF:</strong> ${rif}</td>
                    </tr>
                    <tr>
                        <td style="width: 62%; padding: 4px 8px; vertical-align: top;"><strong>DOMICILIO (CIUDAD/ESTADO):</strong> ${domicilio}</td>
                        <td style="width: 38%; padding: 4px 8px; vertical-align: top;"><strong>TELÉFONO DE CONTACTO:</strong> ${telefono}</td>
                    </tr>
                </table>

                <p style="margin: 6px 0; text-align: justify; line-height: 1.32;">
                    Quien en lo sucesivo se denominará <strong>"EL CLIENTE"</strong>; ambas partes convienen de mutuo y pleno acuerdo en suscribir el presente <em>Contrato Mercantil de Procura Internacional e Importación de Autopartes bajo Pedido</em>, el cual se regirá de forma vinculante por las siguientes cláusulas y estipulaciones:
                </p>

                <!-- CLÁUSULA PRIMERA -->
                <div style="margin: 6px 0;">
                    <p style="margin: 0 0 5px 0; text-align: justify;">
                        <strong>CLÁUSULA PRIMERA (Objeto y Detalle de Procura):</strong> EL PROVEEDOR se compromete ante EL CLIENTE a realizar la procura, gestión aduanal y logística de importación internacional de las autopartes automotrices solicitadas bajo encargo especial, detalladas a continuación:
                    </p>

                    <table style="width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 8pt;">
                        <thead>
                            <tr style="background: #2c441b; color: white;">
                                <th style="padding: 4px 6px; text-align: center; border: 1px solid #2c441b; width: 28px;">#</th>
                                <th style="padding: 4px 6px; text-align: center; border: 1px solid #2c441b; width: 45px;">CANT.</th>
                                <th style="padding: 4px 6px; text-align: left; border: 1px solid #2c441b;">DESCRIPCIÓN DE LA AUTOPARTE</th>
                                <th style="padding: 4px 6px; text-align: center; border: 1px solid #2c441b; width: 80px;">CONDICIÓN</th>
                                <th style="padding: 4px 6px; text-align: right; border: 1px solid #2c441b; width: 80px;">PRECIO ($)</th>
                                <th style="padding: 4px 6px; text-align: right; border: 1px solid #2c441b; width: 85px;">TOTAL ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasRepuestos}
                        </tbody>
                    </table>

                    <p style="margin: 3px 0; text-align: justify; font-size: 8pt;">
                        Dichas piezas se destinan exclusivamente al vehículo automotor declarado por EL CLIENTE: <strong>${vehiculo}</strong>.
                    </p>
                </div>

                <!-- CLÁUSULA SEGUNDA -->
                <p style="margin: 6px 0; text-align: justify;">
                    <strong>CLÁUSULA SEGUNDA (Valor de Operación, Inmutabilidad y Régimen Cambiario):</strong> El valor total y definitivo acordado para la presente operación asciende a la suma de <strong>${totalStr} (${totalLetras})</strong>, desglosado en: Subtotal Procura y Logística: <strong>${subtotalStr}</strong>; I.V.A. (16%): <strong>${ivaStr}</strong>; Monto Total Definitivo: <strong>${totalStr}</strong>.
                    <br>
                    <strong>Parágrafo Primero (Ausencia de Descuentos Posteriores):</strong> El monto integral acordado comprende la totalidad de los costos logísticos, arancelarios y flete internacional pactados, no admitiendo retenciones, descuentos unilaterales ni rebajas posteriores a la suscripción.
                    <br>
                    <strong>Parágrafo Segundo (Régimen Cambiario y Principio Nominalista - Art. 1.737 Código Civil):</strong> Toda cancelación efectuada en moneda de curso legal (Bolívares) se calculará a la tasa oficial del Banco Central de Venezuela (BCV) del día de pago. Conforme al <strong>Artículo 1.737 del Código Civil Venezolano</strong>, cualquier eventual reintegro que procediere legalmente se regirá por el estricto principio nominalista sobre el monto efectivamente recibido en la fecha de la transacción.
                </p>

                <!-- CLÁUSULA TERCERA -->
                ${clausulaTercera}

                <!-- CLÁUSULAS 4 EN ADELANTE -->
                ${clausulasRestantes}

                <!-- BLOQUE FINAL DE FIRMAS Y VIN (page-break-inside: avoid; break-inside: avoid;) -->
                <div class="contrato-bloque-firmas contrato-evitar-corte" style="page-break-inside: avoid; break-inside: avoid; -webkit-column-break-inside: avoid; margin-top: 12px; border-top: 1.5px solid #2c441b; padding-top: 8px;">
                    
                    <!-- Declaración de Conformidad y VIN -->
                    <div class="contrato-bloque-vin contrato-evitar-corte" style="background: #fdfdfd; border: 1px solid #d1d5db; border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; font-size: 7.5pt; page-break-inside: avoid; break-inside: avoid;">
                        <p style="margin: 0 0 4px 0; text-align: justify; font-style: italic;">
                            "Declaro bajo fe de juramento que he revisado las especificaciones, condiciones de procura y régimen de pago acordado en este documento, aceptando en su totalidad las cláusulas precedentes y certificando que el Serial de Carrocería / Chasis (VIN) de mi vehículo es el siguiente:"
                        </p>
                        <table style="margin: 2px auto; border-collapse: collapse; text-align: center;">
                            <tr>
                                <td style="vertical-align: middle; font-weight: bold; font-size: 8pt; padding-right: 6px; white-space: nowrap;">SERIAL VIN (17 DÍGITOS):</td>
                                <td style="vertical-align: middle; white-space: nowrap;">${casillasVIN}</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Firmas en 2 columnas mediante TABLA HTML estándar (100% compatible Safari/Chrome) -->
                    <table class="contrato-evitar-corte" style="width: 100%; border-collapse: separate; border-spacing: 14px 0; margin-top: 8px; page-break-inside: avoid; break-inside: avoid; -webkit-column-break-inside: avoid;">
                        <tr>
                            <!-- Columna Proveedor -->
                            <td style="width: 48%; vertical-align: top; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 6px; text-align: center; background: #ffffff;">
                                <div style="height: 44px; border-bottom: 1px solid #333; margin-bottom: 4px; text-align: center; padding-top: 22px; box-sizing: border-box;">
                                    <span style="font-family: 'Courier New', monospace; font-size: 9pt; color: #2c441b; font-weight: bold;">
                                        INVERSIONES FB PARTS, C.A.
                                    </span>
                                </div>
                                <strong style="display: block; font-size: 8pt; color: #2c441b;">POR EL PROVEEDOR</strong>
                                <span style="display: block; font-size: 7pt; color: #444;">Gerencia de Ventas y Procura Internacional</span>
                                <span style="display: block; font-size: 7pt; color: #555;">RIF: J-50397111-8</span>
                                <span style="display: block; font-size: 6.5pt; color: #777; margin-top: 1px;">Sello y Firma Autorizada</span>
                            </td>

                            <!-- Columna Cliente con recuadro para Huella Dactilar -->
                            <td style="width: 52%; vertical-align: top; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 6px; background: #ffffff;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="vertical-align: top; text-align: center; padding-right: 6px;">
                                            <div style="height: 44px; border-bottom: 1px solid #333; margin-bottom: 4px; text-align: center; padding-top: 22px; box-sizing: border-box;">
                                                <span style="font-size: 7pt; color: #888;">(Firma del Cliente)</span>
                                            </div>
                                            <strong style="display: block; font-size: 8pt; color: #111;">POR EL CLIENTE / ADQUIRENTE</strong>
                                            <span style="display: block; font-size: 7pt; color: #333; word-break: break-word;">${cliente}</span>
                                            <span style="display: block; font-size: 7pt; color: #555;">C.I. / RIF: ${rif}</span>
                                            <span style="display: block; font-size: 7pt; color: #555;">Telf: ${telefono}</span>
                                        </td>
                                        <td style="width: 62px; vertical-align: middle; text-align: center;">
                                            <div style="width: 62px; height: 82px; border: 1.5px dashed #666; border-radius: 4px; padding: 3px 2px; box-sizing: border-box; background: #fafafa; text-align: center;">
                                                <div style="font-size: 5pt; color: #666; font-weight: bold; line-height: 1.1; text-transform: uppercase;">HUELLA PULGAR DERECHO</div>
                                                <div style="margin: 3px 0;"><i class="fas fa-fingerprint" style="font-size: 20px; color: #bbb;"></i></div>
                                                <div style="font-size: 5pt; color: #999;">(Exclusivo Cliente)</div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- Pie del documento legal -->
                    <div style="text-align: center; margin-top: 8px; font-size: 6.5pt; color: #777; border-top: 1px dotted #ccc; padding-top: 3px;">
                        Documento mercantil vinculante conforme a los Artículos 144 y 145 del Código de Comercio y Artículos 1.184, 1.257, 1.518 al 1.525 y 1.737 del Código Civil Venezolano. Términos integrados en www.fybparts.com/politicas-devoluciones.html
                    </div>

                </div>
            `;
        };

        window.imprimirContrato = function() {
            const canvas = document.getElementById('contrato-documento-imprimible');
            if (!canvas) {
                alert("No se encontró el documento a imprimir.");
                return;
            }

            const nroCot = (document.getElementById('contrato-nro')?.value || 'S_N').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const tituloDoc = `Contrato_Procura_${nroCot}`;

            document.body.classList.add('imprimiendo-contrato');
            const originalTitle = document.title;
            document.title = tituloDoc;

            const limpiar = () => {
                document.body.classList.remove('imprimiendo-contrato');
                document.title = originalTitle;
                window.removeEventListener('afterprint', limpiar);
            };

            window.addEventListener('afterprint', limpiar);
            window.print();
            setTimeout(limpiar, 2500);
        };

        window.copiarTextoContrato = function() {
            const canvas = document.getElementById('contrato-documento-imprimible');
            if (!canvas) return;
            const texto = canvas.innerText;
            navigator.clipboard.writeText(texto).then(() => {
                alert("📋 Texto legal del contrato copiado al portapapeles con éxito.");
            }).catch(() => {
                alert("No se pudo copiar automáticamente. Por favor selecciónalo manualmente.");
            });
        };

        // =========================================================================
        // 📖 GENERADOR Y VISOR DE BROCHURE CORPORATIVO DINÁMICO MULTI-PÁGINA
        // =========================================================================
        window.abrirModalBrochure = function() {
            const modal = document.getElementById('modal-brochure-corporativo');
            if (modal) {
                modal.style.display = 'flex';
                window.cargarBrochureCorporativo();
            }
        };

        window.cerrarModalBrochure = function() {
            const modal = document.getElementById('modal-brochure-corporativo');
            if (modal) {
                modal.style.display = 'none';
            }
        };

        window.cargarBrochureCorporativo = async function() {
            const barStats = document.getElementById('brochure-bar-stats');
            if (barStats) barStats.innerHTML = '<i class="fas fa-spinner fa-spin text-brand"></i> Sincronizando catálogo en tiempo real...';

            try {
                // 1. Cargar Categorías si no están precargadas
                if (!window.mapaCategorias || Object.keys(window.mapaCategorias).length === 0) {
                    window.mapaCategorias = {};
                    try {
                        const catSnap = await getDocs(collection(db, "categorias"));
                        catSnap.forEach(docSnap => {
                            const cat = docSnap.data();
                            window.mapaCategorias[cat.id] = cat.nombre;
                        });
                    } catch (e) {
                        console.warn("Aviso al cargar categorías para brochure:", e);
                    }
                }

                // 2. Cargar Productos si no están precargados
                if (!window.productosDBLocal || Object.keys(window.productosDBLocal).length === 0) {
                    window.productosDBLocal = {};
                    try {
                        const prodSnap = await getDocs(collection(db, "productos"));
                        prodSnap.forEach(docSnap => {
                            window.productosDBLocal[docSnap.id] = docSnap.data();
                        });
                    } catch (e) {
                        console.warn("Aviso al cargar productos para brochure:", e);
                    }
                }

                // 3. Cálculos de Estadísticas Dinámicas
                const totalProds = Object.keys(window.productosDBLocal || {}).length;
                const totalCats = Object.keys(window.mapaCategorias || {}).length;
                
                // Mostrar métrica de repuestos
                const numProdsTexto = totalProds > 0 ? (totalProds >= 500 ? `+${totalProds}` : `+${Math.max(totalProds, 150)}`) : "+500";
                const numCatsTexto = totalCats > 0 ? `${totalCats} Líneas` : "16+ Líneas";

                const elStatProds = document.getElementById('brochure-stat-productos');
                if (elStatProds) elStatProds.innerText = numProdsTexto;

                const elStatCats = document.getElementById('brochure-stat-categorias');
                if (elStatCats) elStatCats.innerText = numCatsTexto;

                // Tasa BCV
                const tasaBCV = window.tasaVivaBCV || 42.00;
                const elStatBcv = document.getElementById('brochure-stat-bcv');
                if (elStatBcv) elStatBcv.innerText = `Bs. ${Number(tasaBCV).toFixed(2)}`;

                // Fecha de Emisión (Mes y Año en español)
                const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const hoy = new Date();
                const fechaEmisionTexto = `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
                document.querySelectorAll('.brochure-fecha-emision').forEach(el => {
                    el.innerText = fechaEmisionTexto;
                });

                // 4. Inyección dinámica de badges de categorías en Hoja 2
                const containerCats = document.getElementById('brochure-pills-categorias');
                if (containerCats) {
                    const listaNombresCats = Object.values(window.mapaCategorias || {});
                    if (listaNombresCats.length > 0) {
                        // Limitar a máximo 12 categorías para no desbordar la hoja Carta
                        const categoriasMostrar = listaNombresCats.slice(0, 12);
                        containerCats.innerHTML = categoriasMostrar.map(cat => 
                            `<span class="bg-white border border-slate-200 px-2.5 py-1 rounded-md font-medium text-slate-700 shadow-2xs">${cat}</span>`
                        ).join('');
                    }
                }

                // 5. Vitrina de Repuestos Especializados (Hoja 3)
                // Estructura curada de tarjetas institucionales fijas (Mercedes Benz, Toyota Levin, Dongfeng, etc.) preservada con fidelidad.

                // 6. Actualizar barra superior
                if (barStats) {
                    barStats.innerHTML = `<span class="text-emerald-700 font-semibold">● Sincronizado:</span> ${totalProds > 0 ? totalProds : '500+'} repuestos • ${totalCats > 0 ? totalCats : '16'} categorías activas • Tasa oficial BCV: Bs. ${Number(tasaBCV).toFixed(2)} • <span class="text-slate-600 font-bold">4 Páginas Carta</span>`;
                }

            } catch (err) {
                console.error("Error al cargar brochure corporativo:", err);
                if (barStats) barStats.innerText = "Modo estático corporativo activo";
            }
        };

        window.imprimirBrochure = function() {
            document.body.classList.add('imprimiendo-brochure', 'is-printing');
            const originalTitle = document.title;
            document.title = 'Brochure_Corporativo_FB_Parts_CA';

            const modal = document.getElementById('modal-brochure-corporativo');
            if (modal) {
                modal.style.display = 'block';
            }

            const limpiar = () => {
                document.body.classList.remove('imprimiendo-brochure', 'is-printing');
                document.title = originalTitle;
                if (modal) modal.style.display = 'flex';
                window.removeEventListener('afterprint', limpiar);
            };

            window.addEventListener('afterprint', limpiar, { once: true });
            setTimeout(() => {
                window.print();
            }, 60);
            setTimeout(limpiar, 4000);
        };

        // Soporte de respaldo preventivo para atajos de teclado (Ctrl+P / Cmd+P)
        window.addEventListener('beforeprint', function() {
            const modalBrochure = document.getElementById('modal-brochure-corporativo');
            if (modalBrochure && (modalBrochure.style.display === 'flex' || modalBrochure.style.display === 'block')) {
                document.body.classList.add('imprimiendo-brochure', 'is-printing');
            }
        });
        window.addEventListener('afterprint', function() {
            document.body.classList.remove('imprimiendo-brochure', 'is-printing');
        });

        // ==========================================
        // 🚀 GENERADOR DE SITEMAP SEO PARA GOOGLE (CON URLS AMIGABLES)
        // ==========================================
        window.generarSitemapXML = async function(btnElement) {
            const originalText = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btnElement.disabled = true;

            try {
                let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
                const baseUrl = 'https://www.fybparts.com/';
                const fechaHoy = new Date().toISOString().split('T')[0];

                const paginasEstaticas = ['index.html', 'tienda.html'];
                paginasEstaticas.forEach(pag => {
                    xml += `  <url>\n    <loc>${baseUrl}${pag}</loc>\n    <lastmod>${fechaHoy}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
                });

                const prodSnap = await getDocs(collection(db, "productos"));
                prodSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.estado !== 'inactivo') {
                        // 🚀 CREAR "SLUG" AMIGABLE (Ej: Bomba de Agua -> bomba-de-agua)
                        const slug = (data.nombre || 'repuesto').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-').replace(/(^-|-$)/g, '').replace(/-+/g, '-');
                        
                        xml += `  <url>\n    <loc>${baseUrl}${slug}.html</loc>\n    <lastmod>${fechaHoy}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
                    }
                });
                xml += '</urlset>';

                const blob = new Blob([xml], { type: 'application/xml' });
                const enlaceDescarga = document.createElement('a');
                enlaceDescarga.href = URL.createObjectURL(blob);
                enlaceDescarga.download = 'sitemap.xml';
                
                document.body.appendChild(enlaceDescarga);
                enlaceDescarga.click();
                document.body.removeChild(enlaceDescarga);
                alert("✅ ¡Sitemap generado y descargado con éxito!\n\nSube este archivo 'sitemap.xml' a la raíz de tu dominio.");
            } catch (error) { console.error(error); alert("Ocurrió un error al generar el mapa del sitio."); }

            btnElement.innerHTML = originalText; btnElement.disabled = false;
        };

        // ==========================================
        // CALCULADORA DE IMPORTACIÓN (LANDED COST)
        // ==========================================
        window.cambiarCriterioMedida = function() {
            const criterio = document.getElementById('imp-criterio').value;
            const labelTotal = document.getElementById('imp-label-medida-total');
            const inputTotal = document.getElementById('imp-cbm-total');

            if (criterio === 'cbm') {
                labelTotal.textContent = "Volumen Total del Embarque (CBM / m³)";
                inputTotal.step = "0.001";
            } else if (criterio === 'cuft') {
                labelTotal.textContent = "Volumen Total del Embarque (Pie Cúbico / ft³)";
                inputTotal.step = "0.01";
            } else if (criterio === 'peso') {
                labelTotal.textContent = "Peso Total del Embarque (kg)";
                inputTotal.step = "0.01";
            } else if (criterio === 'fob') {
                labelTotal.textContent = "Referencia / No requerido para FOB";
            }

            document.querySelectorAll('.imp-item-row').forEach(row => {
                const labelItem = row.querySelector('.imp-item-medida-label');
                if (labelItem) {
                    if (criterio === 'cbm') labelItem.textContent = "Vol. Unit. (CBM)";
                    else if (criterio === 'cuft') labelItem.textContent = "Vol. Unit. (ft³)";
                    else if (criterio === 'peso') labelItem.textContent = "Peso Unit. (kg)";
                    else labelItem.textContent = "Medida (Opcional)";
                }
            });

            window.calcularLandedCost();
        };

        window.agregarFilaGastoVacia = function() {
            const container = document.getElementById('imp-gastos-container');
            const row = document.createElement('div');
            row.className = 'imp-gasto-row';
            row.style = 'display: flex; gap: 8px; margin-bottom: 10px; align-items: center;';
            
            row.innerHTML = `
                <input type="text" class="imp-gasto-desc" placeholder="Ej: Seguro, Aduana, Transporte..." style="flex: 2; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                <input type="number" step="0.01" class="imp-gasto-monto" value="0.00" placeholder="$0.00" oninput="calcularLandedCost()" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                <button type="button" onclick="this.parentElement.remove(); calcularLandedCost();" style="background: #d9534f; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" title="Eliminar Gasto"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(row);
        };

        window.agregarFilaImportacionVacia = function() {
            const container = document.getElementById('imp-items-container');
            const row = document.createElement('div');
            row.className = 'imp-item-row';
            row.style = 'background: #f9f9f9; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 12px;';
            
            const criterio = document.getElementById('imp-criterio')?.value || 'cbm';
            let labelMedida = "Vol. Unit. (CBM)";
            if (criterio === 'cuft') labelMedida = "Vol. Unit. (ft³)";
            else if (criterio === 'peso') labelMedida = "Peso Unit. (kg)";
            else if (criterio === 'fob') labelMedida = "Medida (Opcional)";

            row.innerHTML = `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                    <div>
                        <label style="font-size: 11px; font-weight: bold; color: #555;">Repuesto / Descripción</label>
                        <input type="text" class="imp-item-desc" placeholder="Ej: Kit de Tiempo Yaris" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: bold; color: #555;">Cantidad</label>
                        <input type="number" class="imp-item-cant" value="1" min="1" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: bold; color: #555;">Precio FOB ($ u.)</label>
                        <input type="number" step="0.01" class="imp-item-fob" value="0.00" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                    </div>
                    <div>
                        <label class="imp-item-medida-label" style="font-size: 11px; font-weight: bold; color: #555;">${labelMedida}</label>
                        <input type="number" step="0.001" class="imp-item-cbm" value="0.010" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 40px; gap: 10px; align-items: center; background: #eef2eb; padding: 8px; border-radius: 4px;">
                    <div>
                        <span style="font-size: 10px; color: #555; display:block;">Costo Puesto ($ u.):</span>
                        <strong class="imp-item-landed-unit" style="font-size: 13px; color: #d9534f;">$0.00</strong>
                    </div>
                    <div>
                        <label style="font-size: 10px; font-weight: bold; color: #555;">Margen Detal (%)</label>
                        <input type="number" class="imp-item-margen-detal" value="40" oninput="calcularLandedCost()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div>
                        <span style="font-size: 10px; color: #555; display:block;">P. Venta Detal ($):</span>
                        <strong class="imp-item-precio-detal" style="font-size: 13px; color: #385723;">$0.00</strong>
                    </div>
                    <div>
                        <span style="font-size: 10px; color: #555; display:block;">P. Venta Mayor ($):</span>
                        <strong class="imp-item-precio-mayor" style="font-size: 13px; color: #1d6fa5;">$0.00</strong>
                    </div>
                    <button type="button" onclick="this.parentElement.parentElement.remove(); calcularLandedCost();" style="background: #d9534f; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;" title="Eliminar"><i class="fas fa-times"></i></button>
                </div>
            `;
            container.appendChild(row);
            window.calcularLandedCost();
        };

        window.calcularLandedCost = function() {
            let gastosTotales = 0;
            document.querySelectorAll('.imp-gasto-row').forEach(row => {
                const monto = parseFloat(row.querySelector('.imp-gasto-monto').value) || 0;
                gastosTotales += monto;
            });

            if (document.getElementById('imp-total-gastos-display')) {
                document.getElementById('imp-total-gastos-display').innerText = gastosTotales.toFixed(2);
            }

            const medidaTotalCarga = parseFloat(document.getElementById('imp-cbm-total')?.value) || 1;
            const criterio = document.getElementById('imp-criterio')?.value || 'cbm';

            const rows = document.querySelectorAll('.imp-item-row');
            let sumaFobTotal = 0;
            let sumaMedidaTotalItems = 0;

            rows.forEach(row => {
                const cant = parseFloat(row.querySelector('.imp-item-cant').value) || 0;
                const fob = parseFloat(row.querySelector('.imp-item-fob').value) || 0;
                const medidaUnit = parseFloat(row.querySelector('.imp-item-cbm').value) || 0;

                sumaFobTotal += (cant * fob);
                sumaMedidaTotalItems += (cant * medidaUnit);
            });

            let acumLandedTotal = 0;

            rows.forEach(row => {
                const cant = parseFloat(row.querySelector('.imp-item-cant').value) || 1;
                const fob = parseFloat(row.querySelector('.imp-item-fob').value) || 0;
                const medidaUnit = parseFloat(row.querySelector('.imp-item-cbm').value) || 0;
                const margenDetal = parseFloat(row.querySelector('.imp-item-margen-detal').value) || 0;

                let costoGastosPorUnidad = 0;

                if ((criterio === 'cbm' || criterio === 'cuft' || criterio === 'peso') && medidaTotalCarga > 0) {
                    const fraccionMedida = medidaUnit / medidaTotalCarga;
                    costoGastosPorUnidad = gastosTotales * fraccionMedida;
                } else if (criterio === 'fob' && sumaFobTotal > 0) {
                    const fraccionFob = fob / sumaFobTotal;
                    costoGastosPorUnidad = (gastosTotales * fraccionFob) / cant;
                }

                const landedUnitario = fob + costoGastosPorUnidad;
                const precioDetal = landedUnitario * (1 + (margenDetal / 100));
                const precioMayor = landedUnitario * (1 + ((margenDetal * 0.7) / 100));

                row.querySelector('.imp-item-landed-unit').innerText = `$${landedUnitario.toFixed(2)}`;
                row.querySelector('.imp-item-precio-detal').innerText = `$${precioDetal.toFixed(2)}`;
                row.querySelector('.imp-item-precio-mayor').innerText = `$${precioMayor.toFixed(2)}`;

                acumLandedTotal += (landedUnitario * cant);
            });

            if (document.getElementById('imp-resumen-fob')) document.getElementById('imp-resumen-fob').innerText = sumaFobTotal.toFixed(2);
            if (document.getElementById('imp-resumen-landed')) document.getElementById('imp-resumen-landed').innerText = acumLandedTotal.toFixed(2);
        };

        window.guardarImportacion = async function() {
            const btn = document.getElementById('btn-save-imp');
            const originalText = btn.innerHTML;
            btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Guardando...";
            btn.disabled = true;

            const editId = document.getElementById('edit-imp-id').value;
            const criterio = document.getElementById('imp-criterio').value;
            const medidaTotal = document.getElementById('imp-cbm-total').value;
            const totalGastos = document.getElementById('imp-total-gastos-display').innerText;
            const fobTotal = document.getElementById('imp-resumen-fob').innerText;
            const landedTotal = document.getElementById('imp-resumen-landed').innerText;
            
            const gastosDetalle = [];
            document.querySelectorAll('.imp-gasto-row').forEach(row => {
                gastosDetalle.push({
                    desc: row.querySelector('.imp-gasto-desc').value,
                    monto: row.querySelector('.imp-gasto-monto').value
                });
            });

            const rows = document.querySelectorAll('.imp-item-row');
            const items = [];
            rows.forEach(row => {
                items.push({
                    descripcion: row.querySelector('.imp-item-desc').value || 'Sin descripción',
                    cantidad: row.querySelector('.imp-item-cant').value,
                    fob: row.querySelector('.imp-item-fob').value,
                    medidaUnit: row.querySelector('.imp-item-cbm').value,
                    margenDetal: row.querySelector('.imp-item-margen-detal').value,
                    landed: row.querySelector('.imp-item-landed-unit').innerText,
                    precioDetal: row.querySelector('.imp-item-precio-detal').innerText,
                    precioMayor: row.querySelector('.imp-item-precio-mayor').innerText
                });
            });

            if(items.length === 0) {
                alert("Agrega al menos un repuesto para guardar el cálculo.");
                btn.innerHTML = originalText; btn.disabled = false;
                return;
            }

            let unidadTexto = 'm³ (China)';
            if (criterio === 'cuft') unidadTexto = 'ft³ (USA)';
            else if (criterio === 'peso') unidadTexto = 'kg (Brasil)';
            else if (criterio === 'fob') unidadTexto = 'FOB ($)';

            const data = {
                fecha: new Date().toLocaleString("es-VE"),
                criterio: criterio,
                medidaTotal: medidaTotal,
                unidadTexto: unidadTexto,
                totalGastos: totalGastos,
                fobTotal: fobTotal,
                landedTotal: landedTotal,
                gastosDetalle: gastosDetalle,
                items: items
            };

            try {
                if (editId) {
                    await updateDoc(doc(db, "importaciones", editId), data);
                    alert("✅ Cálculo actualizado exitosamente.");
                    document.getElementById('edit-imp-id').value = '';
                    btn.style.background = '#28a745'; 
                } else {
                    await addDoc(collection(db, "importaciones"), data);
                    alert("✅ Cálculo guardado exitosamente en el historial.");
                }
                window.cargarHistorialImportaciones();
            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al guardar el cálculo en la base de datos.");
            }
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cálculo en Historial'; 
            btn.disabled = false;
        };

        window.cargarHistorialImportaciones = async function() {
            const tbody = document.getElementById('importaciones-table-body');
            const selectLanded = document.getElementById('cot-selector-landed'); 
            
            if(!tbody) return;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Cargando historial...</td></tr>`;
            if(selectLanded) selectLanded.innerHTML = '<option value="">Selecciona un cálculo de importación...</option>';
            
            window.importacionesDBLocal = {}; 
            
            try {
                const snap = await getDocs(collection(db, "importaciones"));
                tbody.innerHTML = '';
                
                if(snap.empty) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay cálculos guardados.</td></tr>`;
                    return;
                }

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const docId = docSnap.id;
                    window.importacionesDBLocal[docId] = data; 
                    
                    if(selectLanded) selectLanded.innerHTML += `<option value="${docId}">${data.fecha} - ${data.medidaTotal} ${data.unidadTexto} - Costo Total: $${data.landedTotal}</option>`;

                    let itemsList = data.items ? data.items.map(i => {
                        const margen = i.margenDetal || '40';
                        const pDetal = i.precioDetal || '$0.00';
                        const pMayor = i.precioMayor || '$0.00';
                        return `
                            <div style="border-bottom: 1px dashed #ccc; padding-bottom: 6px; margin-bottom: 6px;">
                                <strong style="color:#333;">${i.cantidad}x ${i.descripcion}</strong><br>
                                <div style="display:flex; justify-content:space-between; font-size:10px; color:#666; margin-top:3px;">
                                    <span>FOB: $${i.fob}</span>
                                    <span>Medida: ${i.medidaUnit || '0'}</span>
                                    <span>Costo Puesto: <strong style="color:#d9534f;">${i.landed}</strong></span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:10px; color:#555; margin-top:3px; background:#eef2eb; padding:4px; border-radius:3px;">
                                    <span>Margen: ${margen}%</span>
                                    <span>P. Detal: <strong style="color:#385723;">${pDetal}</strong></span>
                                    <span>P. Mayor: <strong style="color:#1d6fa5;">${pMayor}</strong></span>
                                </div>
                            </div>
                        `;
                    }).join('') : 'Sin detalles';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${data.fecha || 'N/A'}</td>
                        <td><strong>${data.medidaTotal || '0'} ${data.unidadTexto || 'm³'}</strong></td>
                        <td><strong>$${data.fobTotal || '0.00'}</strong></td>
                        <td>$${data.totalGastos || '0.00'}</td>
                        <td>
                            <strong style="color: #385723; font-size: 14px;">$${data.landedTotal || '0.00'}</strong>
                            <details style="font-size: 11px; color: #555; margin-top: 5px; cursor: pointer;">
                                <summary>Ver detalle de piezas</summary>
                                <div style="margin-top: 5px; padding: 5px; background: #f1f1f1; border-radius: 4px; line-height: 1.4;">${itemsList}</div>
                            </details>
                        </td>
                        <td style="display: flex; gap: 5px; justify-content: center; align-items: center; min-width: 90px;">
                            <button type="button" onclick="editarImportacion('${docId}')" style="background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Editar"><i class="fas fa-edit"></i></button>
                            <button type="button" onclick="eliminarImportacion('${docId}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch(error) {
                console.error("Error cargando historial de importaciones:", error);
            }
        };

        window.editarImportacion = function(docId) {
            const data = window.importacionesDBLocal[docId];
            if(!data) return;

            document.getElementById('edit-imp-id').value = docId;
            document.getElementById('imp-criterio').value = data.criterio || 'cbm';
            document.getElementById('imp-cbm-total').value = data.medidaTotal || '1.000';
            
            const gastosContainer = document.getElementById('imp-gastos-container');
            gastosContainer.innerHTML = '';
            if (data.gastosDetalle && data.gastosDetalle.length > 0) {
                data.gastosDetalle.forEach(g => {
                    const row = document.createElement('div');
                    row.className = 'imp-gasto-row';
                    row.style = 'display: flex; gap: 8px; margin-bottom: 10px; align-items: center;';
                    row.innerHTML = `
                        <input type="text" class="imp-gasto-desc" value="${g.desc}" placeholder="Ej: Seguro, Aduana..." style="flex: 2; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                        <input type="number" step="0.01" class="imp-gasto-monto" value="${g.monto}" placeholder="$0.00" oninput="calcularLandedCost()" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                        <button type="button" onclick="this.parentElement.remove(); calcularLandedCost();" style="background: #d9534f; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" title="Eliminar Gasto"><i class="fas fa-times"></i></button>
                    `;
                    gastosContainer.appendChild(row);
                });
            } else {
                const row = document.createElement('div');
                row.className = 'imp-gasto-row';
                row.style = 'display: flex; gap: 8px; margin-bottom: 10px; align-items: center;';
                row.innerHTML = `
                    <input type="text" class="imp-gasto-desc" value="Gastos Generales (Historial Antiguo)" style="flex: 2; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                    <input type="number" step="0.01" class="imp-gasto-monto" value="${(data.totalGastos || '0').replace('$','')}" oninput="calcularLandedCost()" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none;">
                    <button type="button" onclick="this.parentElement.remove(); calcularLandedCost();" style="background: #d9534f; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" title="Eliminar Gasto"><i class="fas fa-times"></i></button>
                `;
                gastosContainer.appendChild(row);
            }

            const itemsContainer = document.getElementById('imp-items-container');
            itemsContainer.innerHTML = '';
            
            let labelMedida = "Vol. Unit. (CBM)";
            if (data.criterio === 'cuft') labelMedida = "Vol. Unit. (ft³)";
            else if (data.criterio === 'peso') labelMedida = "Peso Unit. (kg)";
            else if (data.criterio === 'fob') labelMedida = "Medida (Opcional)";

            if (data.items && data.items.length > 0) {
                data.items.forEach(i => {
                    const row = document.createElement('div');
                    row.className = 'imp-item-row';
                    row.style = 'background: #f9f9f9; border: 1px solid #ddd; padding: 12px; border-radius: 6px; margin-bottom: 12px;';
                    
                    const margenDetal = i.margenDetal || '40';
                    const precioDetal = i.precioDetal || '$0.00';
                    const precioMayor = i.precioMayor || '$0.00';
                    const landed = i.landed || '$0.00';
                    const safeDesc = (i.descripcion || '').replace(/"/g, '&quot;');

                    row.innerHTML = `
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                            <div>
                                <label style="font-size: 11px; font-weight: bold; color: #555;">Repuesto / Descripción</label>
                                <input type="text" class="imp-item-desc" value="${safeDesc}" placeholder="Ej: Kit de Tiempo Yaris" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            </div>
                            <div>
                                <label style="font-size: 11px; font-weight: bold; color: #555;">Cantidad</label>
                                <input type="number" class="imp-item-cant" value="${i.cantidad}" min="1" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            </div>
                            <div>
                                <label style="font-size: 11px; font-weight: bold; color: #555;">Precio FOB ($ u.)</label>
                                <input type="number" step="0.01" class="imp-item-fob" value="${i.fob}" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            </div>
                            <div>
                                <label class="imp-item-medida-label" style="font-size: 11px; font-weight: bold; color: #555;">${labelMedida}</label>
                                <input type="number" step="0.001" class="imp-item-cbm" value="${i.medidaUnit || '0'}" oninput="calcularLandedCost()" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;">
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 40px; gap: 10px; align-items: center; background: #eef2eb; padding: 8px; border-radius: 4px;">
                            <div>
                                <span style="font-size: 10px; color: #555; display:block;">Costo Puesto ($ u.):</span>
                                <strong class="imp-item-landed-unit" style="font-size: 13px; color: #d9534f;">${landed}</strong>
                            </div>
                            <div>
                                <label style="font-size: 10px; font-weight: bold; color: #555;">Margen Detal (%)</label>
                                <input type="number" class="imp-item-margen-detal" value="${margenDetal}" oninput="calcularLandedCost()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                            </div>
                            <div>
                                <span style="font-size: 10px; color: #555; display:block;">P. Venta Detal ($):</span>
                                <strong class="imp-item-precio-detal" style="font-size: 13px; color: #385723;">${precioDetal}</strong>
                            </div>
                            <div>
                                <span style="font-size: 10px; color: #555; display:block;">P. Venta Mayor ($):</span>
                                <strong class="imp-item-precio-mayor" style="font-size: 13px; color: #1d6fa5;">${precioMayor}</strong>
                            </div>
                            <button type="button" onclick="this.parentElement.parentElement.remove(); calcularLandedCost();" style="background: #d9534f; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;" title="Eliminar"><i class="fas fa-times"></i></button>
                        </div>
                    `;
                    itemsContainer.appendChild(row);
                });
            }

            window.calcularLandedCost();
            
            document.getElementById('tab-importacion').scrollIntoView({ behavior: 'smooth' });

            const btnSave = document.getElementById('btn-save-imp');
            if(btnSave) {
                btnSave.innerHTML = '<i class="fas fa-sync"></i> Actualizar Cálculo Editado';
                btnSave.style.background = '#1d6fa5'; 
            }
        };

        window.eliminarImportacion = async function(docId) {
            if(!confirm("¿Seguro que deseas eliminar este cálculo del historial?")) return;
            try {
                await deleteDoc(doc(db, "importaciones", docId));
                window.cargarHistorialImportaciones();
            } catch (error) {
                console.error("Error eliminando:", error);
            }
        };
        // ==========================================
        // FUNCIONES COMPLEMENTARIAS Y CAJERO
        // ==========================================
        window.copiarAlPortapapeles = function(texto, btnElement) {
            navigator.clipboard.writeText(texto).then(() => {
                const originalHTML = btnElement.innerHTML;
                btnElement.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                btnElement.classList.add('copied');
                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    btnElement.classList.remove('copied');
                }, 1500);
            }).catch(err => { console.error(err); alert("Error copiando al portapapeles."); });
        };

        window.abrirModoCajeroParaFactura = function(factura) {
            document.getElementById('cajero-cliente-nombre').textContent = factura.cliente || 'Cliente Mostrador';
            
            let rifHtml = '';
            if (factura.rif) {
                let rifLimpio = factura.rif;
                const lastDash = factura.rif.lastIndexOf('-');
                if (lastDash > 0) { rifLimpio = factura.rif.substring(0, lastDash) + factura.rif.substring(lastDash + 1); }
                rifHtml = `<span>RIF/C.I: ${factura.rif}</span> <button type="button" class="btn-copy" style="padding: 2px 8px; font-size: 11px; margin-left: 6px; display: inline-flex; align-items: center; gap: 4px;" onclick="copiarAlPortapapeles('${rifLimpio}', this)"><i class="fas fa-copy"></i> Copiar RIF</button>`;
            }
            const dirStr = factura.direccion ? `<span style="margin-left: 8px;">| Dir: ${factura.direccion}</span>` : '';
            const telStr = factura.telefono ? `<span style="margin-left: 8px;">| Tel: ${factura.telefono}</span>` : '';
            document.getElementById('cajero-cliente-detalles').innerHTML = `<div style="display: flex; align-items: center; flex-wrap: wrap;">${rifHtml}${dirStr}${telStr}</div>`;

            const simbolo = factura.simbolo || '$';
            const totalF = Number(factura.total || 0).toFixed(2);
            const totalEl = document.getElementById('cajero-total-monto');
            totalEl.textContent = `${simbolo}${totalF}`; totalEl.setAttribute('data-raw', totalF);

            const lista = document.getElementById('cajero-items-lista');
            lista.innerHTML = '';
            if (factura.items) {
                factura.items.forEach(prod => {
                    const safeName = (prod.descripcion || '').replace(/'/g, "\\'");
                    const precioConIva = (Number(prod.precioUnitario || 0) * 1.16).toFixed(2); 
                    lista.innerHTML += `
                        <div class="cajero-item-row">
                            <div class="cajero-item-details">
                                <strong style="font-size: 13px; color: #333;">${prod.cantidad}x ${prod.descripcion}</strong><br>
                                <span style="font-size: 12px; color: #666;">${simbolo}${precioConIva} c/u (IVA incl.)</span>
                            </div>
                            <div class="cajero-item-actions">
                                <button type="button" class="btn-copy" onclick="copiarAlPortapapeles('${safeName}', this)"><i class="fas fa-copy"></i> Nombre</button>
                                <button type="button" class="btn-copy" onclick="copiarAlPortapapeles('${precioConIva}', this)"><i class="fas fa-copy"></i> Precio</button>
                            </div>
                        </div>`;
                });
            }
            document.getElementById('modal-cajero').style.display = 'flex';
        };

        window.cerrarModoCajero = function() { document.getElementById('modal-cajero').style.display = 'none'; };

        window.abrirModalNotas = function(docId, tipoDocumento, notaExistente) {
            document.getElementById('nota-doc-id').value = docId;
            document.getElementById('nota-doc-tipo').value = tipoDocumento;
            document.getElementById('nota-texto').value = notaExistente && notaExistente !== 'undefined' ? notaExistente : '';
            document.getElementById('modal-notas').style.display = 'flex';
        };

        window.cerrarModalNotas = function() {
            document.getElementById('modal-notas').style.display = 'none';
        };

        window.guardarNotaInterna = async function() {
            const docId = document.getElementById('nota-doc-id').value;
            const tipo = document.getElementById('nota-doc-tipo').value; 
            const texto = document.getElementById('nota-texto').value.trim();

            try {
                await updateDoc(doc(db, tipo, docId), { notaInterna: texto });
                window.cerrarModalNotas();
                
                if(tipo === 'facturas') { window.cargarHistorialFacturas(); window.cargarDashboard(); window.cargarFinanzas(); }
                else if (tipo === 'cotizaciones') { window.cargarHistorialCotizaciones(); }
                
            } catch (error) { console.error("Error al guardar la nota:", error); alert("Error al guardar la nota."); }
        };

        window.actualizarEstatusDocumento = async function(docId, tipoDocumento, selectElement) {
            const nuevoEstatus = selectElement.value;
            let colorClase = 'status-pendiente';
            
            if (nuevoEstatus.includes("Pagado") || nuevoEstatus === "Aprobada") { colorClase = 'status-pagado'; }
            else if (nuevoEstatus.includes("Crédito") || nuevoEstatus === "En espera") { colorClase = 'status-credito'; }
            else if (nuevoEstatus.includes("Importación")) { colorClase = 'status-importacion'; }
            else if (nuevoEstatus === "No aprobada" || nuevoEstatus === "Anulada") { colorClase = 'status-inactivo'; }
            
            selectElement.className = 'select-status ' + colorClase;

            if (tipoDocumento === 'cotizaciones') {
                if (window.cotizacionesDBLocal && window.cotizacionesDBLocal[docId]) {
                    window.cotizacionesDBLocal[docId].estatusComercial = nuevoEstatus;
                }
                if (window.actualizarMetricasCotizaciones) {
                    window.actualizarMetricasCotizaciones();
                }
            }

            let dataUpdate = { estatusComercial: nuevoEstatus };

            if (tipoDocumento === 'facturas' && nuevoEstatus === 'Anulada') {
                let nc = prompt("La factura será Anulada.\n¿Deseas registrar un número de Nota de Crédito? (Déjalo en blanco si no aplica)");
                if(nc !== null && nc.trim() !== "") {
                    dataUpdate.notaCredito = nc.trim();
                } else {
                    dataUpdate.notaCredito = "";
                }
            }

            try {
                await updateDoc(doc(db, tipoDocumento, docId), dataUpdate);
                if(window.registrarAuditoria) {
                    if (tipoDocumento === 'facturas') {
                        let fac = window.facturasDBLocal ? window.facturasDBLocal[docId] : null;
                        let nro = fac ? fac.nro : docId;
                        window.registrarAuditoria("CAMBIO DE ESTATUS FACTURA", "Factura #" + nro + " cambiada a: " + nuevoEstatus);
                    } else if (tipoDocumento === 'cotizaciones') {
                        window.registrarAuditoria("CAMBIO ESTATUS COTIZACIÓN", "Cotización ID " + docId + " cambiada a: " + nuevoEstatus);
                    }
                }
                if (tipoDocumento === 'facturas') {
                    window.cargarHistorialFacturas(); 
                    window.cargarDashboard();
                    window.cargarFinanzas();
                }
            } catch (error) {
                console.error("Error al actualizar estatus:", error);
            }
        };

        // ==========================================
        // 🚀 RETENCIONES AUTOMÁTICAS (IA)
        // ==========================================
        window.abrirModalRetenciones = async function(nroFactura) {
            document.getElementById('ret-nro-factura').textContent = nroFactura;
            document.getElementById('modal-retenciones').style.display = 'flex';
            const contenedor = document.getElementById('lista-retenciones');
            contenedor.innerHTML = '<p style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando retenciones automáticas...</p>';

            try {
                const snap = await getDocs(collection(db, "retenciones"));
                let html = '';
                let encontradas = 0;

                const buscarNro = String(nroFactura).replace(/^0+/, '').toUpperCase();

                snap.forEach(docSnap => {
                    const ret = docSnap.data();
                    const retNroOriginal = String(ret.Factura || ret.factura || ret.FACTURA || '');
                    const retNroLimpio = retNroOriginal.replace(/^0+/, '').toUpperCase();

                    if (retNroLimpio === buscarNro && retNroLimpio !== '') {
                        encontradas++;
                        const montoDisplay = (!isNaN(parseFloat(ret.monto))) ? `$${parseFloat(ret.monto).toFixed(2)}` : (ret.monto || 'No especificado');
                        
                        html += `
                            <div style="background: white; border: 1px solid #c3e6cb; border-left: 4px solid #28a745; padding: 12px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                                <div>
                                    <span style="display:block; font-weight:bold; color:#155724; font-size:14px;">RIF: ${ret.rif || 'N/A'}</span>
                                    <span style="font-size:12px; color:#555;">Monto Retenido: <strong style="color:#d9534f;">${montoDisplay}</strong></span>
                                </div>
                                <div>
                                    ${ret.link_pdf 
                                        ? `<a href="${ret.link_pdf}" target="_blank" style="background:#1d6fa5; color:white; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; display:inline-block;"><i class="fas fa-file-pdf"></i> Ver PDF</a>` 
                                        : `<span style="font-size:11px; background:#f1f1f1; padding:4px 8px; border-radius:4px; color:#666;"><i class="fas fa-robot"></i> Procesado por IA</span>`}
                                </div>
                            </div>
                        `;
                    }
                });

                if (encontradas === 0) {
                    contenedor.innerHTML = `
                        <div style="text-align:center; padding:30px 10px; color:#666;">
                            <i class="fas fa-inbox" style="font-size: 30px; color: #ccc; margin-bottom: 10px;"></i>
                            <p style="margin:0;">No se han recibido comprobantes automáticos para esta factura aún.</p>
                            <small style="font-size: 11px;">(Recuerda que Make las escanea del correo y las vincula aquí)</small>
                        </div>`;
                } else {
                    contenedor.innerHTML = html;
                }

            } catch (error) {
                console.error(error);
                contenedor.innerHTML = '<p style="text-align:center; color:#d9534f; padding:20px;"><i class="fas fa-exclamation-triangle"></i> Error al buscar las retenciones en Firestore.</p>';
            }
        };

        window.cerrarModalRetenciones = function() {
            document.getElementById('modal-retenciones').style.display = 'none';
        };

        // ==========================================
        // 🚀 LECTURA DE TASAS (CORREGIDO Y MEJORADO)
        // ==========================================
        window.cargarTasaBCV = async function() {
            const inputTasa = document.getElementById('fac-tasa');
            const monedaSeleccionada = document.getElementById('fac-moneda').value.split('|')[0];
            const baseMoneda = document.getElementById('fac-base-moneda') ? document.getElementById('fac-base-moneda').value : 'USD';
            
            try {
                let nombreDocumento = "tasa_bcv";
                
                // Lógica inteligente para saber qué tasa buscar en Firebase
                if (monedaSeleccionada === "EUR") { 
                    nombreDocumento = "tasa_euro"; 
                } else if (monedaSeleccionada === "VES") {
                    if (baseMoneda === "EUR") {
                        nombreDocumento = "tasa_euro";
                    } else {
                        nombreDocumento = "tasa_bcv";
                    }
                } else if (monedaSeleccionada === "USD") {
                    // Para USD, mostramos la Tasa BCV para que aparezca en el recibo legal
                    nombreDocumento = "tasa_bcv";
                }

                const docRef = doc(db, "configuracion", nombreDocumento);
                const docSnap = await getDoc(docRef);
                
                let tasaValor = 1;
                if (docSnap.exists()) {
                    tasaValor = docSnap.data().Valor || docSnap.data().valor || 1;
                    if (inputTasa) inputTasa.value = parseFloat(tasaValor).toFixed(4);
                } else {
                    if (inputTasa) inputTasa.value = 1;
                }
                
                if (window.actualizarPreviewFactura) window.actualizarPreviewFactura();
            } catch (error) { console.error("Error cargando tasa:", error); }
        };

        window.actualizarSimboloMoneda = function() {
            const monedaStr = document.getElementById('fac-moneda').value;
            const monedaCode = monedaStr.split('|')[0];
            const simbolo = monedaStr.split('|')[1];
            
            // Actualiza los símbolos visuales ($, Bs, €)
            document.querySelectorAll('.fac-simbolo-display').forEach(el => el.textContent = simbolo);
            
            // Mostrar/Ocultar el selector de base si es VES
            const divBase = document.getElementById('div-base-moneda');
            if (divBase) {
                if (monedaCode === 'VES') {
                    divBase.style.display = 'block';
                } else {
                    divBase.style.display = 'none';
                }
            }
            
            // Recargar la tasa automáticamente según la nueva selección
            window.cargarTasaBCV();
        };

        // ==========================================
        // 🔔 NOTIFICACIONES DE COBRANZA
        // ==========================================
        window.toggleNotificaciones = function() {
            const dropdown = document.getElementById('dropdown-notificaciones');
            if (dropdown) dropdown.classList.toggle('hidden');
        };

        // Cerrar dropdown si hace clic afuera
        document.addEventListener('click', function(event) {
            const container = document.getElementById('bell-container');
            const dropdown = document.getElementById('dropdown-notificaciones');
            if (container && dropdown && !container.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        });

        window.actualizarNotificacionesCobranza = function() {
    const filas = document.querySelectorAll('#facturas-table-body tr');
    const lista = document.getElementById('lista-notificaciones'); // Asegúrate de que este ID coincida con tu HTML
    
    let notificacionesHTML = '';
    let contadorVencidas = 0;
    const hoy = new Date();

    filas.forEach(fila => {
        if (fila.cells.length < 5) return; // Omitir filas de carga o vacías

        // 1. Obtener número y cliente limpiando saltos de línea
        const nroFila = fila.cells[0].textContent.trim().split('\n')[0];
        const fechaStr = fila.cells[1].textContent.trim();
        const clienteStr = fila.cells[2].textContent.trim().split('\n')[0];

        // 2. Obtener el valor REAL seleccionado en el menú desplegable (NO el textContent de la celda)
        const selectEstatus = fila.querySelector('td:nth-child(4) select');
        if (!selectEstatus) return;
        const estatusActivo = selectEstatus.options[selectEstatus.selectedIndex].text.toUpperCase();

        // 3. Evaluar si es un crédito no pagado
        if (estatusActivo.includes('CRÉDITO') && !estatusActivo.includes('PAGADO')) {
            
            // 4. Parsear fecha DD/MM/YYYY a un objeto Date válido
            const partesFecha = fechaStr.split('/');
            if (partesFecha.length === 3) {
                // new Date(Año, Mes (0-11), Día)
                const fechaFactura = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
                
                // Calcular diferencia en días exactos
                const diferenciaTiempo = hoy.getTime() - fechaFactura.getTime();
                const diasTranscurridos = Math.floor(diferenciaTiempo / (1000 * 3600 * 24));
                
                if (diasTranscurridos > 15) {
                    contadorVencidas++;
                    notificacionesHTML += `
                        <li class="p-3 border-b border-gray-100 hover:bg-red-50 transition-colors cursor-default">
                            <div class="text-sm">
                                <strong class="text-red-600">${nroFila}</strong> - <span class="text-gray-800">${clienteStr}</span>
                            </div>
                            <div class="text-xs text-red-500 mt-1 font-semibold">
                                <i class="fas fa-exclamation-triangle mr-1"></i> Vencida hace ${diasTranscurridos - 15} días (${diasTranscurridos} días desde emisión)
                            </div>
                        </li>`;
                }
            }
        }
    });

    // 5. Inyectar notificaciones en el menú desplegable
    if (lista) {
        lista.innerHTML = contadorVencidas > 0 ? notificacionesHTML : '<li class="p-4 text-gray-500 text-sm text-center">No hay cobros pendientes</li>';
    }

    // 6. Actualizar o crear el circulito rojo (badge) en la campana
    const iconoCampana = document.querySelector('.fa-bell');
    if (iconoCampana) {
        const botonCampana = iconoCampana.parentElement;
        let badge = botonCampana.querySelector('.badge-campana');
        
        if (!badge) {
            // Crear el badge si no existe en el HTML
            badge = document.createElement('span');
            badge.className = 'badge-campana absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full';
            botonCampana.appendChild(badge);
        }
        
        if (contadorVencidas > 0) {
            badge.textContent = contadorVencidas;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

// Asegurar que la función se ejecute al terminar de cargar la tabla
const originalCargarHistorial = window.cargarHistorialFacturas;
window.cargarHistorialFacturas = async function() {
    await originalCargarHistorial();
    window.actualizarNotificacionesCobranza();
};

        // ==========================================
        // 🚀 MOTOR DE ARRANQUE INICIAL
        // ==========================================
        window.panelIniciado = false;
        window.iniciarPanelCompleto = async function() {
            if (window.panelIniciado) return;
            window.panelIniciado = true;
            
            // Esperar activamente hasta que Firebase Auth reconozca el token (máximo 4 seg)
            // Esto evita errores de permisos (Missing or insufficient permissions)
            if (!auth.currentUser) {
                console.log("Firebase Auth no está listo aún. Esperando token para cargar bases de datos...");
                for(let i=0; i<40; i++){
                    if(auth.currentUser) break;
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            console.log("Iniciando módulos de bases de datos de forma secuencial para evitar saturación...");
            
            const runSafe = async (fnName) => {
                try {
                    if (typeof window[fnName] === 'function') {
                        await window[fnName]();
                        await new Promise(r => setTimeout(r, 150)); // Breve respiro para el navegador
                    }
                } catch(e) {
                    console.error("Error al ejecutar " + fnName + ":", e); alert("Error en " + fnName + ": " + e.message);
                }
            };

            await runSafe('cargarDashboard');
            await runSafe('cargarFinanzas');
            await runSafe('cargarPedidos');
            await runSafe('cargarCatalogoAdmin');
            await runSafe('cargarBaseClientes');
            
            await runSafe('calcularTotalCotizacion');
            await runSafe('cargarHistorialCotizaciones');
            
            await runSafe('calcularTotalFactura');
            await runSafe('cargarHistorialFacturas');
            await runSafe('cargarHistorialImportaciones');
            await runSafe('cargarHistorialReventas');
            await runSafe('cargarHistorialReventas');
            
            await runSafe('cargarTasaBCV');
            await runSafe('cargarPuntosRuta');
            runSafe('inicializarEventosComprobante');
            
            setTimeout(() => { 
                runSafe('cargarCxCPersonal');
            }, 1000);
        };

        // Disparo seguro e inmediato sin depender de si DOMContentLoaded ya disparó
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', window.iniciarPanelCompleto);
        } else {
            window.iniciarPanelCompleto();
        }

        // ==========================================
        // 🚀 ANALISTA IA CON MEMORIA FIREBASE (sesion_001)
        // ==========================================
        window.historialAdminIA = [];

        window.toggleAdminAi = function() {
            const box = document.getElementById('admin-ai-box');
            const icon = document.getElementById('admin-ai-icon');
            const chatArea = document.getElementById('admin-ai-messages');
            
            if (box.style.display === 'none' || box.style.display === '') {
                box.style.display = 'flex';
                icon.className = 'fas fa-times';
                document.getElementById('admin-ai-input').focus();
                
                // Cargar historial de Firebase si el chat solo tiene el saludo inicial
                if (chatArea.children.length <= 1) {
                    window.cargarHistorialAI();
                }
            } else {
                box.style.display = 'none';
                icon.className = 'fas fa-robot';
            }
        };

        window.cargarHistorialAI = async function() {
            const chatArea = document.getElementById('admin-ai-messages');
            try {
                const docRef = doc(db, "ai_copilot_sessions", "sesion_001");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.historial_mensajes && data.historial_mensajes.length > 0) {
                        chatArea.innerHTML = ''; // Limpiamos el saludo default
                        window.historialAdminIA = [];

                        data.historial_mensajes.forEach(msg => {
                            window.historialAdminIA.push({ user: msg.user, ai: msg.ai });
                            
                            // Burbuja Tuya
                            chatArea.innerHTML += `
                                <div style="align-self: flex-end; background: #e2eef7; padding: 10px 14px; border-radius: 12px 0 12px 12px; max-width: 85%; color: #333; border-right: 3px solid #1d6fa5; margin-bottom: 10px;">
                                    <p style="margin: 0;">${msg.user}</p>
                                </div>`;
                            // Burbuja IA
                            chatArea.innerHTML += `
                                <div style="align-self: flex-start; background: white; padding: 10px 14px; border-radius: 0 12px 12px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); max-width: 85%; border-left: 3px solid #1d6fa5; color: #333; margin-bottom: 10px;">
                                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.5;">${msg.ai}</p>
                                </div>`;
                        });
                        chatArea.scrollTop = chatArea.scrollHeight;
                    }
                }
            } catch (error) { console.error("Error cargando la memoria:", error); }
        };

        window.enviarMensajeAdminAi = async function() {
            const input = document.getElementById('admin-ai-input');
            const mensaje = input.value.trim();
            if (!mensaje) return;

            const chatArea = document.getElementById('admin-ai-messages');
            const btn = document.getElementById('admin-ai-send-btn');

            chatArea.innerHTML += `
                <div style="align-self: flex-end; background: #e2eef7; padding: 10px 14px; border-radius: 12px 0 12px 12px; max-width: 85%; color: #333; border-right: 3px solid #1d6fa5; margin-bottom: 10px;">
                    <p style="margin: 0;">${mensaje}</p>
                </div>`;
            input.value = '';
            chatArea.scrollTop = chatArea.scrollHeight;

            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const typingId = 'typing-' + Date.now();
            chatArea.innerHTML += `
                <div id="${typingId}" style="align-self: flex-start; background: white; padding: 10px 14px; border-radius: 0 12px 12px 12px; max-width: 85%; border-left: 3px solid #ccc; color: #888; font-style: italic; margin-bottom: 10px;">
                    <i class="fas fa-circle-notch fa-spin"></i> Analizando...
                </div>`;
            chatArea.scrollTop = chatArea.scrollHeight;

            // 🧠 SÚPER CONTEXTO EN TIEMPO REAL PARA LA IA
            const ventasMes = document.getElementById('dash-v-total')?.innerText || '0.00';
            const cxcTotal = document.getElementById('dash-cxc-total')?.innerText || '0.00';
            const cxpTotal = document.getElementById('dash-cxp-total')?.innerText || '0.00';
            const invTotal = document.getElementById('dash-inventario')?.innerText || '$0.00';

            // 🚀 NUEVA MAGIA: INTERCEPTOR DE DOCUMENTOS
            let contextoExtra = "";
            
            // Buscar menciones a Cotizaciones (Ej: "cotizacion 1837" o "cotización #1837")
            const regexCot = /cotizaci[oó]n\s*#?\s*(\d+)/i;
            const matchCot = mensaje.match(regexCot);
            if (matchCot) {
                const nroBusqueda = parseInt(matchCot[1]);
                for (const docId in window.cotizacionesDBLocal) {
                    if (parseInt(window.cotizacionesDBLocal[docId].nro) === nroBusqueda) {
                        const cot = window.cotizacionesDBLocal[docId];
                        contextoExtra += `\n\n📄 [ATENCIÓN IA: El usuario te está preguntando por la COTIZACIÓN #${cot.nro}. Aquí tienes los datos extraídos de la base de datos para que le respondas con precisión absoluta]:\n`;
                        contextoExtra += `- Cliente: ${cot.cliente} (RIF: ${cot.rif})\n- Vehículo: ${cot.vehiculo} (${cot.anio})\n- Estatus: ${cot.estatusComercial}\n- Fecha: ${cot.fecha}\n- Total General: $${cot.total}\n- Ítems cotizados:\n`;
                        cot.items.forEach(i => { contextoExtra += `  * ${i.cantidad}x ${i.descripcion} a $${i.precioUnitario} c/u (Desc: $${i.descuento})\n`; });
                        break;
                    }
                }
            }

            // Buscar menciones a Facturas (Ej: "factura 0607" o "factura 607")
            const regexFac = /factura\s*#?\s*(\d+)/i;
            const matchFac = mensaje.match(regexFac);
            if (matchFac) {
                const nroBusqueda = parseInt(matchFac[1]);
                for (const docId in window.facturasDBLocal) {
                    if (parseInt(window.facturasDBLocal[docId].nro) === nroBusqueda) {
                        const fac = window.facturasDBLocal[docId];
                        contextoExtra += `\n\n🧾 [ATENCIÓN IA: El usuario te está preguntando por la FACTURA #${fac.nro}. Aquí tienes los datos extraídos de la base de datos para que le respondas con precisión absoluta]:\n`;
                        contextoExtra += `- Cliente: ${fac.cliente} (RIF: ${fac.rif})\n- Estatus: ${fac.estatusComercial}\n- Fecha: ${fac.fecha}\n- Total General: ${fac.simbolo}${fac.total}\n- Ítems facturados:\n`;
                        if(fac.items) fac.items.forEach(i => { contextoExtra += `  * ${i.cantidad}x ${i.descripcion} a ${fac.simbolo}${i.precioUnitario} c/u\n`; });
                        break;
                    }
                }
            }

            let promptBase = `Actúa como el Director Financiero (CFO) y Analista Estratégico de "Inversiones FB Parts, C.A.". Eres la mano derecha del Gerente (Brhayan).
            
            📊 ESTADO FINANCIERO EN TIEMPO REAL:
            - Ventas del Mes: $${ventasMes}
            - Cuentas por Cobrar (Dinero en la calle): $${cxcTotal}
            - Cuentas por Pagar (Deudas a proveedores): $${cxpTotal}
            - Capital en Inventario: ${invTotal}
            
            INSTRUCCIONES: Tienes visión global de toda la empresa. Da respuestas analíticas, cortas y estratégicas. NO uses formato markdown (**) ni asteriscos en tus respuestas.`;
            
            let contextoHistorial = window.historialAdminIA.map(msg => `Brhayan: ${msg.user}\nAnalista: ${msg.ai}`).join("\n\n");
            
            // Unimos el prompt + historial + documento inyectado + mensaje del usuario
            let promptFinal = promptBase + "\n\n" + (contextoHistorial ? `HISTORIAL DE SESIÓN:\n${contextoHistorial}\n\n` : "") + contextoExtra + `\n\nBRHAYAN: "${mensaje}"`;

            try {
                const respuesta = await puter.ai.chat(promptFinal);
                const respuestaFinal = typeof respuesta === 'string' ? respuesta : respuesta.message.content;
                document.getElementById(typingId).remove();

                chatArea.innerHTML += `
                    <div style="align-self: flex-start; background: white; padding: 10px 14px; border-radius: 0 12px 12px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); max-width: 85%; border-left: 3px solid #1d6fa5; color: #333; margin-bottom: 10px;">
                        <p style="margin: 0; white-space: pre-wrap; line-height: 1.5;">${respuestaFinal.replace(/\*\*/g, '')}</p>
                    </div>`;
                chatArea.scrollTop = chatArea.scrollHeight;

                // 💾 GUARDAR EN LA MEMORIA DE FIREBASE (sesion_001)
                window.historialAdminIA.push({ user: mensaje, ai: respuestaFinal });
                const docRef = doc(db, "ai_copilot_sessions", "sesion_001");
                await updateDoc(docRef, {
                    historial_mensajes: arrayUnion({ user: mensaje, ai: respuestaFinal, fecha: new Date().toISOString() })
                });



            } catch (e) {
                console.error(e);
                document.getElementById(typingId).remove();
                chatArea.innerHTML += `<div style="color: #d9534f; margin-bottom: 10px;">Error de conexión IA.</div>`;
            }

            btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; input.focus();
        };

        // Función puente para el botón de "Landed Cost"
        window.abrirAnalisisLandedIA = function() {
            const rows = document.querySelectorAll('.imp-item-row');
            if (rows.length === 0) { alert("Agrega un repuesto primero a la calculadora."); return; }
            
            const origen = document.getElementById('imp-criterio').options[document.getElementById('imp-criterio').selectedIndex].text;
            const fobTotal = document.getElementById('imp-resumen-fob').innerText;
            const gastosTotal = document.getElementById('imp-total-gastos-display').innerText;
            const landedTotal = document.getElementById('imp-resumen-landed').innerText;

            // 🚀 NUEVO: Extraer cada línea de repuesto con lujo de detalles
            let listaItems = '';
            rows.forEach(row => {
                const desc = row.querySelector('.imp-item-desc').value || 'Repuesto sin especificar';
                const cant = row.querySelector('.imp-item-cant').value;
                const fob = row.querySelector('.imp-item-fob').value;
                const medidaUnit = row.querySelector('.imp-item-cbm').value;
                const landedUnit = row.querySelector('.imp-item-landed-unit').innerText;
                const margen = row.querySelector('.imp-item-margen-detal').value;
                const pDetal = row.querySelector('.imp-item-precio-detal').innerText;
                
                listaItems += `- ${cant}x [${desc}] | FOB: $${fob} | Vol/Peso: ${medidaUnit} | Costo Puesto: ${landedUnit} | Margen: ${margen}% | PV Detal: ${pDetal}\n`;
            });

            // Armamos un súper-prompt para la IA
            let promptTexto = `Revisa mi pantalla actual del Landed Cost.\n\n` +
                              `📊 RESUMEN GLOBAL:\n` +
                              `Origen: ${origen}\n` +
                              `FOB Total: $${fobTotal} | Gastos Logísticos: $${gastosTotal} | Costo Puesto Total: $${landedTotal}\n\n` +
                              `📦 DESGLOSE DE REPUESTOS:\n${listaItems}\n` +
                              `Por favor, analiza estos datos. Detecta si hay algún repuesto cuyo volumen o peso se esté comiendo el margen de ganancia (los gastos logísticos), dime si los precios de venta son competitivos y qué estrategia recomiendas.`;

            document.getElementById('admin-ai-box').style.display = 'flex';
            document.getElementById('admin-ai-icon').className = 'fas fa-times';
            
            // Carga memoria previa primero, si no lo ha hecho
            if (document.getElementById('admin-ai-messages').children.length <= 1) {
                window.cargarHistorialAI().then(() => {
                    document.getElementById('admin-ai-input').value = promptTexto;
                    window.enviarMensajeAdminAi();
                });
            } else {
                document.getElementById('admin-ai-input').value = promptTexto;
                window.enviarMensajeAdminAi();
            }
        };

        // ==========================================
        // 🚀 CREADOR DE DESCRIPCIONES (PLANTILLA FIJA FB PARTS)
        // ==========================================
        window.generarDescripcionIA = async function() {
            const nombre    = (document.getElementById('edit-nombre')?.value || '').trim();
            const categoria = (document.getElementById('edit-categoria')?.value || 'Repuestos Automotrices').trim();
            const marca     = (document.getElementById('edit-marca')?.value || '').trim();
            const modelo    = (document.getElementById('edit-modelo')?.value || '').trim();
            const numParte  = (document.getElementById('edit-numero-parte')?.value || 'No especificado').trim();
            const textArea  = document.getElementById('edit-descripcion');
            const btn       = document.getElementById('btn-ia-desc');

            // Recoger posiciones seleccionadas
            const posSelec = [];
            if (document.getElementById('edit-pos-rh')?.checked) posSelec.push('Lado Derecho (RH)');
            if (document.getElementById('edit-pos-lh')?.checked) posSelec.push('Lado Izquierdo (LH)');
            if (document.getElementById('edit-pos-na')?.checked) posSelec.push('Universal');
            const posicionTxt = posSelec.length ? posSelec.join(' y ') : 'Universal';

            if (!nombre) {
                alert("Por favor, escribe primero el 'Nombre del Repuesto' para que la IA pueda rellenar la plantilla.");
                return;
            }

            if (typeof puter === 'undefined') {
                alert("⚠️ Puter no está cargado. Revisa tu conexión a internet.");
                return;
            }

            const textoBotonOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Llenando Plantilla...';
            btn.disabled = true;

            // 🚀 PROMPT ESTRICTO CON PLANTILLA BASE
            const promptTexto = `Eres el asistente de publicaciones de "Inversiones FB Parts, C.A.", empresa venezolana de repuestos automotrices.
Tu única tarea es copiar LA PLANTILLA EXACTA que te daré y rellenar los espacios indicados entre corchetes [ ] con información técnica del repuesto.
NO cambies la estructura, NO borres los emojis, NO uses asteriscos (**) de markdown.

DATOS DEL REPUESTO:
- Nombre: ${nombre}
- Categoría: ${categoria}
- Marca del vehículo: ${marca || 'No especificada'}
- Modelo / Motorización: ${modelo || 'No especificado'}
- Lado / Posición: ${posicionTxt}
- Número de Parte OEM: ${numParte}

--- COPIA Y RELLENA ESTA PLANTILLA EXACTA DESDE AQUÍ ---

✅ FUNCIÓN Y BENEFICIOS:
[Redacta 2 o 3 líneas atractivas explicando para qué sirve esta pieza y por qué es importante cambiarla a tiempo. Usa tono experto y vendedor].

🔧 COMPATIBILIDAD:
- Marca: ${marca || '[Indica la marca del vehículo si la conoces]'}
- Modelo / Motorización: ${modelo || '[Indica modelos compatibles que conozcas]'}
- Lado / Posición: ${posicionTxt}
- Número OEM: ${numParte}

📦 CONDICIONES:
- Repuesto nuevo, en perfecta condición.
- [Si aplica, menciona el material o acabado del repuesto].
- Disponible para retiro en tienda o envío a domicilio en Caracas.`;

            try {
                const respuesta = await puter.ai.chat(promptTexto);

                // Manejo robusto de la respuesta de Puter (puede cambiar de formato)
                let textoFinal = '';
                if (typeof respuesta === 'string') {
                    textoFinal = respuesta;
                } else if (respuesta?.message?.content) {
                    const c = respuesta.message.content;
                    textoFinal = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
                } else if (respuesta?.content) {
                    textoFinal = Array.isArray(respuesta.content)
                        ? respuesta.content.map(b => b.text || b).join('')
                        : String(respuesta.content);
                } else {
                    textoFinal = JSON.stringify(respuesta);
                }

                // Limpieza de markdown
                const textoLimpio = textoFinal.replace(/\*\*/g, '').replace(/\*/g, '•').trim();
                textArea.value = textoLimpio;

            } catch (error) {
                console.error("Error Puter Descripciones:", error);
                alert("⚠️ Error al generar la descripción: " + (error.message || error));
            }

            btn.innerHTML = textoBotonOriginal;
            btn.disabled = false;
        };

        // ==========================================
        // 🚀 LÓGICA DEL COBRADOR INTELIGENTE IA
        // ==========================================
        let datosCobroActual = {};

        window.abrirCobradorIA = function(cliente, monto, moneda, telefono, nro, fecha, estatus) {
            datosCobroActual = { cliente, monto, moneda, telefono, nro, fecha, estatus };
            
            document.getElementById('cobro-cliente').textContent = cliente;
            // Mostramos también el número de factura en la ventanita para que tú lo veas
            document.getElementById('cobro-monto').innerHTML = `${moneda} ${parseFloat(monto).toFixed(2)} <span style="font-size:12px; color:#666; font-weight:normal;">(Factura #${nro})</span>`;
            document.getElementById('texto-cobro-ia').value = ""; 
            
            document.getElementById('modal-cobrador-ia').style.display = 'flex';
        };

        window.generarMensajeCobro = async function(tono) {
            const textArea = document.getElementById('texto-cobro-ia');
            textArea.value = "⏳ El Analista de Cobranzas IA está calculando fechas y redactando el mensaje...";
            
            // Obtenemos la fecha de hoy para que la IA sepa cuánto tiempo ha pasado
            const fechaHoy = new Date().toLocaleDateString('es-VE');

            const prompt = `Actúa como el Departamento de Cobranzas y Administración de la tienda automotriz "Inversiones FB Parts, C.A.".
            Tu tarea es redactar un mensaje corto y profesional de WhatsApp para cobrar una factura.
            
            DATOS DE LA DEUDA:
            - Cliente: ${datosCobroActual.cliente}
            - Nro. de Factura/Nota de Entrega: #${datosCobroActual.nro}
            - Fecha de Emisión: ${datosCobroActual.fecha}
            - Condición de Crédito: ${datosCobroActual.estatus}
            - Fecha Actual (Hoy): ${fechaHoy}
            - Monto pendiente a cobrar: ${datosCobroActual.moneda} ${datosCobroActual.monto}
            
            INSTRUCCIONES OBLIGATORIAS:
            1. Menciona SIEMPRE el Nro. de factura y la fecha de emisión.
            2. Evalúa internamente el tiempo transcurrido desde la fecha de emisión hasta la fecha actual (hoy).
            
            ESTRATEGIA Y TONO SOLICITADO: ${tono}
            - Si es "Amigable": Saluda cordialmente. Menciona suavemente que están escribiendo para actualizar el estatus de la factura #${datosCobroActual.nro} emitida el ${datosCobroActual.fecha}. Pregunta si requieren los datos bancarios.
            - Si es "Negociador": Muestra empatía. Sugiéreles que, si no pueden cubrir el total hoy, pueden realizar un abono parcial a la factura #${datosCobroActual.nro} para mantener su línea de crédito activa e impecable.
            - Si es "Firme": Lenguaje muy formal. Indica claramente que la factura #${datosCobroActual.nro} emitida el ${datosCobroActual.fecha} ha vencido según su condición de crédito (${datosCobroActual.estatus}) y que el departamento requiere la liquidación inmediata hoy mismo para evitar retenciones de despacho.
            
            REGLAS DE FORMATO: 
            Usa máximo 3 párrafos cortos. Agrega un par de emojis corporativos discretos. NUNCA uses formato markdown ni asteriscos. Despídete siempre como "Dpto. de Administración - F&B Parts".`;

            try {
                const respuesta = await puter.ai.chat(prompt);
                const textoLimpio = typeof respuesta === 'string' ? respuesta : respuesta.message.content;
                textArea.value = textoLimpio.replace(/\*\*/g, '').replace(/\*/g, '•').trim();
            } catch (error) {
                console.error("Error IA Cobrador:", error);
                textArea.value = "⚠️ Error de conexión con la IA. Por favor, intenta de nuevo.";
            }
        };

        window.enviarCobroWhatsApp = function() {
            const mensaje = document.getElementById('texto-cobro-ia').value.trim();
            if(!mensaje || mensaje.includes("⏳")) {
                alert("Primero debes generar el mensaje seleccionando un Tono.");
                return;
            }
            
            let url = 'https://wa.me/';
            if(datosCobroActual.telefono && datosCobroActual.telefono !== 'undefined' && datosCobroActual.telefono !== 'null') {
                const tlfLimpio = datosCobroActual.telefono.replace(/\D/g, '');
                url += tlfLimpio;
            }
            url += `?text=${encodeURIComponent(mensaje)}`;
            
            window.open(url, '_blank');
            document.getElementById('modal-cobrador-ia').style.display = 'none';
        };

        // ==========================================
        // 🚀 ASESOR DE VENTAS CRUZADAS (UP-SELLING IA)
        // ==========================================
        window.abrirAsesorVentasCruzadas = async function(origen) {
            let items = [];
            let selectorClase = '';
            
            // Evaluamos de dónde viene el clic para buscar en la tabla correcta
            if (origen === 'cotizacion') selectorClase = '.cotizacion-item-row .item-desc';
            else if (origen === 'facturacion') selectorClase = '.facturacion-item-row .fac-item-desc';
            else if (origen === 'pedido') selectorClase = '.pedido-item-row .ped-item-desc';
            
            // Recolectar todos los repuestos escritos
            document.querySelectorAll(selectorClase).forEach(input => {
                if (input.value.trim() !== '') items.push(input.value.trim());
            });

            if (items.length === 0) {
                alert("⚠️ Primero debes agregar al menos un repuesto a la lista para que la IA tenga algo que analizar.");
                return;
            }

            // Mostrar el Modal
            const listaUI = document.getElementById('upselling-lista-actual');
            listaUI.innerHTML = items.map(i => `<li>${i}</li>`).join('');
            document.getElementById('upselling-respuesta').value = "⏳ Pensando en la mejor estrategia de venta... \n\nDiagnosticando reparación...";
            document.getElementById('modal-upselling-ia').style.display = 'flex';

            if (typeof puter === 'undefined') {
                document.getElementById('upselling-respuesta').value = "⚠️ Puter no está cargado. Revisa tu conexión a internet.";
                return;
            }

            // El Prompt Estratégico
            const promptTexto = `Eres un vendedor estrella de repuestos automotrices trabajando para "F&B Parts". 
            Tu objetivo es el "Up-Selling" (ventas cruzadas).
            
            El cliente está armando un presupuesto con estos repuestos:
            ${items.map(i => "- " + i).join('\n')}
            
            Analiza qué tipo de reparación está haciendo. 
            Dime a mí (Brhayan) 2 o 3 repuestos o consumibles ADICIONALES lógicos que el cliente olvidó comprar o que debería cambiar aprovechando la mano de obra (Ej: Si compra pastillas, ofrécele liga de frenos).
            
            FORMATO ESTRICTO:
            1. Diagnóstico: [Dime qué reparación crees que está haciendo].
            2. Ofrécele: [Lista de 2-3 piezas con viñetas cortas].
            3. Frase de Cierre: [Escribe 1 sola frase persuasiva que puedo copiar y pegarle al cliente por WhatsApp para convencerlo de llevar esos extras].
            
            Sé directo, sin saludos largos y NO uses formato markdown (**).`;

            try {
                const respuesta = await puter.ai.chat(promptTexto);
                const textoFinal = typeof respuesta === 'string' ? respuesta : respuesta.message.content;
                document.getElementById('upselling-respuesta').value = textoFinal.replace(/\*\*/g, '').replace(/\*/g, '•').trim();
            } catch (error) {
                console.error("Error UpSelling IA:", error);
                document.getElementById('upselling-respuesta').value = "⚠️ Ocurrió un error al consultar a la IA.";
            }
        };

        // ==========================================
        // ✨ IMPORTADOR INTELIGENTE DE ÓRDENES (IA)
        // ==========================================
        window.abrirModalLeerOrdenIA = function() {
            const modal = document.getElementById('modal-leer-orden-ia');
            if (!modal) return;

            const statusDiv = document.getElementById('leer-orden-status');
            if (statusDiv) {
                statusDiv.style.display = 'none';
                statusDiv.innerHTML = '';
            }

            // Actualizar tasa según el selector de moneda y ticker actual
            window.actualizarTasaModalLeerOrden();

            modal.style.display = 'flex';
            const txtArea = document.getElementById('leer-orden-texto');
            if (txtArea) {
                setTimeout(() => txtArea.focus(), 120);
            }
        };

        window.cerrarModalLeerOrdenIA = function() {
            const modal = document.getElementById('modal-leer-orden-ia');
            if (modal) modal.style.display = 'none';
        };

        window.actualizarTasaModalLeerOrden = function() {
            const selMoneda = document.getElementById('leer-orden-moneda')?.value || 'USD';
            const inputTasa = document.getElementById('leer-orden-tasa');
            if (!inputTasa) return;

            if (selMoneda === 'EUR') {
                let tasaEur = window.tasaVivaEUR || window.tasaReventaEUR || 0;
                if (!tasaEur) {
                    const elEur = document.getElementById('ticker-eur');
                    if (elEur) {
                        const m = elEur.innerText.match(/([0-9.,]+)/);
                        if (m) tasaEur = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                    }
                }
                inputTasa.value = Number(tasaEur > 0 ? tasaEur : 45.00).toFixed(2);
            } else {
                let tasaUsd = window.tasaVivaBCV || window._ultimoUsdBcv || window.tasaReventaBCV || 0;
                if (!tasaUsd) {
                    const elUsd = document.getElementById('ticker-usd');
                    if (elUsd) {
                        const m = elUsd.innerText.match(/([0-9.,]+)/);
                        if (m) tasaUsd = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                    }
                }
                inputTasa.value = Number(tasaUsd > 0 ? tasaUsd : 42.00).toFixed(2);
            }
        };

        /**
         * Extractor inteligente de respaldo con Expresiones Regulares
         * Se activa si Puter no responde o no se puede conectar a internet.
         */
        window.extraerOrdenConRegexFallback = function(texto) {
            const res = {
                productos: [],
                monto_bruto_bs: 0,
                incluye_iva: true,
                orden_compra: "",
                cliente_detectado: null
            };

            if (!texto) return res;

            // 1. Detectar intención de IVA
            if (/mas\s*iva|\+\s*iva|sin\s*iva|no\s*incluye\s*iva/i.test(texto)) {
                res.incluye_iva = false;
            } else if (/iva\s*incluido|con\s*iva|ya\s*incluye/i.test(texto)) {
                res.incluye_iva = true;
            }

            // 2. Detectar Orden de Compra (ej: "orden de compra 5420", "OC-1029", "pedido #331")
            const ocMatch = texto.match(/(?:orden\s*(?:de\s*compra)?|o\/?c|pedido)\s*(?:nro|n°|#)?\s*([a-zA-Z0-9_-]+)/i);
            if (ocMatch) {
                res.orden_compra = ocMatch[1];
            }

            // 3. Detectar Nombre de Cliente o Empresa
            const cliMatch = texto.match(/(?:para|cliente|taller|empresa)\s*:\s*([^\n,]+)/i);
            if (cliMatch) {
                res.cliente_detectado = cliMatch[1].trim();
            } else {
                const cliMatch2 = texto.match(/para\s+([A-Za-z0-9\s.,-]+?)(?:\s*:\s*|\n|$)/i);
                if (cliMatch2 && cliMatch2[1].length < 60) {
                    res.cliente_detectado = cliMatch2[1].trim();
                }
            }

            // 4. Detectar Monto en Bolívares
            const montoMatch = texto.match(/(?:bs\.?|ves|total|transferir|monto)[\s:]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:[.,][0-9]{1,2})?)/i);
            if (montoMatch) {
                let rawNum = montoMatch[1].trim();
                if (rawNum.includes('.') && rawNum.includes(',')) {
                    rawNum = rawNum.replace(/\./g, '').replace(',', '.');
                } else if (rawNum.includes(',')) {
                    rawNum = rawNum.replace(',', '.');
                }
                res.monto_bruto_bs = parseFloat(rawNum) || 0;
            }

            // 5. Detectar Productos línea por línea
            const lineas = texto.split(/\r?\n/);
            lineas.forEach(linea => {
                const limpia = linea.trim().replace(/^[-*•]\s*/, '');
                if (!limpia) return;
                if (/^(total|orden|cliente|buenas|hola|transferir|saludos|atentamente|gracias)/i.test(limpia)) return;

                // Patrón estándar con número: "1 caucho 750R16", "2x tripa 650R10", "4 amortiguadores"
                const prodMatch = limpia.match(/^(\d+)\s*(?:x|unid(?:ades?)?|pza(?:s)?)?\s+(.+)$/i);
                if (prodMatch) {
                    const cant = parseInt(prodMatch[1]) || 1;
                    let desc = prodMatch[2].replace(/(?:a\s*transferir|total|bs\.?).*$/i, '').trim();
                    if (desc.length > 2) {
                        res.productos.push({
                            cantidad: cant,
                            descripcion: desc.toUpperCase()
                        });
                    }
                } else if (limpia.length > 3 && !limpia.includes('Bs') && !limpia.includes('$') && !limpia.includes('transferir')) {
                    // Línea descriptiva sin cantidad explícita (asume 1)
                    res.productos.push({
                        cantidad: 1,
                        descripcion: limpia.toUpperCase()
                    });
                }
            });

            return res;
        };

        /**
         * Procesa el texto de la orden con IA (Gemini vía Puter) y calcula divisas
         */
        window.procesarOrdenTextoConIA = async function() {
            const txtArea = document.getElementById('leer-orden-texto');
            const texto = (txtArea?.value || '').trim();
            const btn = document.getElementById('btn-analizar-orden-ia');
            const statusDiv = document.getElementById('leer-orden-status');
            const monedaBase = document.getElementById('leer-orden-moneda')?.value || 'USD';
            const inputTasa = document.getElementById('leer-orden-tasa');
            const checkIva = document.getElementById('leer-orden-incluye-iva');

            if (!texto) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Texto Vacío',
                        text: 'Por favor pega el mensaje de WhatsApp, correo u orden antes de analizar.',
                        confirmButtonColor: '#385723'
                    });
                } else {
                    alert('Por favor pega el mensaje de la orden.');
                }
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando con IA...';
            }

            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#eef3f0';
                statusDiv.style.border = '1px solid #c3e6cb';
                statusDiv.style.color = '#155724';
                statusDiv.innerHTML = '<i class="fas fa-robot fa-spin"></i> Consultando a la IA y extrayendo repuestos...';
            }

            let parsedData = null;

            // 1. Invocación a Gemini a través de Puter.js
            if (typeof puter !== 'undefined' && puter.ai) {
                try {
                    const promptTexto = `Eres un asistente de ERP contable y financiero de "Inversiones FB Parts, C.A.".
Extrae la información de este pedido o mensaje desordenado de WhatsApp/correo.

TEXTO DEL CLIENTE:
"""
${texto}
"""

INSTRUCCIONES OBLIGATORIAS:
Devuelve ÚNICAMENTE un objeto JSON estricto sin bloques de texto explicativos ni comentarios fuera del JSON, con esta estructura exacta:
{
  "productos": [
    { "cantidad": 1, "descripcion": "NOMBRE DEL REPUESTO EN MAYÚSCULAS" }
  ],
  "monto_bruto_bs": 486420.80,
  "incluye_iva": true,
  "orden_compra": "NRO_ORDEN_O_VACIO",
  "cliente_detectado": "NOMBRE_CLIENTE_O_NULL"
}

REGLAS DE EXTRACCIÓN:
- "productos": array con cada pieza o repuesto y su cantidad entera (>= 1).
- "monto_bruto_bs": número en Bolívares (float), eliminando puntos de miles y comas decimales. Si no hay monto en Bs, coloca 0.
- "incluye_iva": boolean (true si dice 'con iva', 'iva incluido', 'ya incluye iva'; false si dice 'mas iva', 'sin iva', o si no se especifica).
- "orden_compra": string con el código u orden de compra si se encuentra.
- "cliente_detectado": string con el nombre del cliente/taller/empresa si se encuentra.`;

                    let respuesta;
                    try {
                        respuesta = await puter.ai.chat(promptTexto, { model: 'gemini-2.0-flash' });
                    } catch (eModel) {
                        respuesta = await puter.ai.chat(promptTexto);
                    }

                    let rawContent = '';
                    if (typeof respuesta === 'string') {
                        rawContent = respuesta;
                    } else if (respuesta?.message?.content) {
                        const c = respuesta.message.content;
                        rawContent = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
                    } else if (respuesta?.text) {
                        rawContent = String(respuesta.text);
                    }

                    // Extraer bloque JSON
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsedData = JSON.parse(jsonMatch[0]);
                    }
                } catch (errAI) {
                    console.warn("Fallo en llamada IA Puter, activando extractor de respaldo regex:", errAI);
                }
            }

            // 2. Fallback inteligente con Regex si la IA no respondió o falló la respuesta
            if (!parsedData || !Array.isArray(parsedData.productos) || parsedData.productos.length === 0) {
                parsedData = window.extraerOrdenConRegexFallback(texto);
            }

            // Validar que se hayan obtenido productos
            if (!parsedData || !Array.isArray(parsedData.productos) || parsedData.productos.length === 0) {
                if (statusDiv) {
                    statusDiv.style.background = '#fef2f2';
                    statusDiv.style.border = '1px solid #fecaca';
                    statusDiv.style.color = '#b91c1c';
                    statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No se pudieron identificar productos en el texto. Separa cada producto en una línea (Ej: 1 repuesto X).';
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-brain"></i> Analizar y Calcular con IA';
                }
                return;
            }

            // 3. Cálculos Financieros: Descuento de IVA y Conversión Cambiaria a Tasa BCV
            if (typeof parsedData.incluye_iva === 'boolean' && checkIva) {
                checkIva.checked = parsedData.incluye_iva;
            }

            const aplicaIVA = checkIva ? checkIva.checked : true;
            const montoBrutoBs = parseFloat(parsedData.monto_bruto_bs) || 0;
            const montoNetoBs = (aplicaIVA && montoBrutoBs > 0) ? (montoBrutoBs / 1.16) : montoBrutoBs;
            const tasaAplicada = Math.max(0.01, parseFloat(inputTasa?.value) || 1);
            const totalDivisa = tasaAplicada > 0 ? (montoNetoBs / tasaAplicada) : 0;
            const totalDivisaRedondeado = Math.round(totalDivisa * 100) / 100;

            // Distribuir el total neto en divisas entre los productos extraídos
            const prods = parsedData.productos;
            const totalUnidades = prods.reduce((sum, p) => sum + (parseInt(p.cantidad) || 1), 0);
            const precioBaseUnitario = totalUnidades > 0 ? (totalDivisaRedondeado / totalUnidades) : 0;

            let sumaAcumulada = 0;
            prods.forEach((p, idx) => {
                p.cantidad = parseInt(p.cantidad) || 1;
                p.descripcion = String(p.descripcion || 'REPUESTO').toUpperCase().trim();
                if (idx === prods.length - 1) {
                    const restante = totalDivisaRedondeado - sumaAcumulada;
                    p.precio = Math.max(0, Math.round((restante / p.cantidad) * 100) / 100);
                } else {
                    p.precio = Math.round(precioBaseUnitario * 100) / 100;
                    sumaAcumulada += (p.cantidad * p.precio);
                }
            });

            // 4. Inyectar filas en el contenedor dinámico del formulario de pedidos (#pedidos-items-container)
            const container = document.getElementById('pedidos-items-container');
            if (container) {
                container.innerHTML = ''; // Limpiar filas vacías previas
                prods.forEach(p => {
                    const row = document.createElement('div');
                    row.className = 'pedido-item-row';
                    row.innerHTML = `
                        <input type="number" class="ped-item-cant" value="${p.cantidad}" min="1" placeholder="Cant" oninput="calcularTotalPedido()">
                        <input type="text" class="ped-item-desc" value="${SecuritySanitizer.escapeHtml(p.descripcion)}" placeholder="Descripción del repuesto" style="grid-column: span 3;">
                        <input type="number" step="0.01" class="ped-item-precio" value="${p.precio.toFixed(2)}" placeholder="Precio" oninput="calcularTotalPedido()">
                        <button type="button" onclick="this.parentElement.remove(); calcularTotalPedido();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
                    `;
                    container.appendChild(row);
                });
                window.calcularTotalPedido();
            }

            // 5. Inyectar Nombre de Cliente y Orden si fueron detectados
            if (parsedData.cliente_detectado) {
                const inpCli = document.getElementById('client-name');
                if (inpCli && !inpCli.value) {
                    inpCli.value = parsedData.cliente_detectado;
                }
                const selCli = document.getElementById('ped-selector-clientes');
                if (selCli) {
                    for (let i = 0; i < selCli.options.length; i++) {
                        if (selCli.options[i].text.toLowerCase().includes(parsedData.cliente_detectado.toLowerCase())) {
                            selCli.selectedIndex = i;
                            if (window.seleccionarClientePedido) window.seleccionarClientePedido();
                            break;
                        }
                    }
                }
            }

            if (parsedData.orden_compra) {
                const inpTrack = document.getElementById('tracking-info');
                if (inpTrack && !inpTrack.value) {
                    inpTrack.value = `OC-${parsedData.orden_compra}`;
                }
            }

            // Cerrar el modal
            window.cerrarModalLeerOrdenIA();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-brain"></i> Analizar y Calcular con IA';
            }

            // Feedback al usuario con resumen financiero
            const resumenHTML = `
                <div style="text-align: left; font-size: 13px; color: #374151; font-family: sans-serif;">
                    <p style="margin-bottom: 8px;"><strong>${prods.length} repuestos</strong> cargados en el formulario de pedido:</p>
                    <ul style="padding-left: 20px; margin-bottom: 12px; max-height: 140px; overflow-y: auto;">
                        ${prods.map(p => `<li><b>${p.cantidad}x</b> ${SecuritySanitizer.escapeHtml(p.descripcion)} &rarr; $${p.precio.toFixed(2)} c/u</li>`).join('')}
                    </ul>
                    <hr style="margin: 8px 0; border: none; border-top: 1px dashed #cbd5e1;">
                    <p style="margin: 4px 0;">Monto Bruto: <b>Bs. ${Number(montoBrutoBs).toLocaleString('es-VE', {minimumFractionDigits: 2})}</b></p>
                    ${aplicaIVA ? `<p style="margin: 4px 0; color: #15803d;">Neto sin IVA (-16%): <b>Bs. ${Number(montoNetoBs).toLocaleString('es-VE', {minimumFractionDigits: 2})}</b></p>` : ''}
                    <p style="margin: 6px 0 0 0; font-size: 15px; color: #385723; font-weight: bold;">
                        Total Pedido (${monedaBase}): $${totalDivisaRedondeado.toFixed(2)} <span style="font-size: 11.5px; font-weight: normal; color: #64748b;">(Tasa Bs. ${tasaAplicada.toFixed(2)})</span>
                    </p>
                </div>
            `;

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Orden Importada y Calculada!',
                    html: resumenHTML,
                    confirmButtonColor: '#385723',
                    confirmButtonText: 'Aceptar'
                });
            } else {
                alert(`¡Orden Importada! Total ${monedaBase}: $${totalDivisaRedondeado.toFixed(2)}`);
            }
        };

        // =========================================================================
        // ✨ ASISTENTE IA DE CATÁLOGO & AUTOCOMPLETADO ESTRUCTURADO (GEMINI API)
        // =========================================================================
        window._filtroSoloSinDesc = false;
        window._loteIACancelado = false;
        window._lotePendientesCache = [];

        /**
         * Determina si un repuesto carece de descripción o posee metadatos incompletos
         */
        window.esProductoIncompleto = function(prod) {
            if (!prod) return false;
            const desc = (prod.descripcion || '').trim();
            const tieneDescCorta = desc.length < 20;
            const faltaCategoria = !prod.categoria || prod.categoria === 'todos' || prod.categoria === 'general' || prod.categoria === '';
            const faltaModelo = !prod.modelo || prod.modelo.trim() === '';
            const faltaMarca = !prod.marca || prod.marca.trim() === '' || prod.marca === 'Universal/Multi-marca';
            return tieneDescCorta || faltaCategoria || faltaModelo || faltaMarca;
        };

        /**
         * Actualiza el badge numérico y estilo del botón toggle de repuestos incompletos
         */
        window.actualizarContadorSinDescripcion = function() {
            let count = 0;
            if (window.productosDBLocal) {
                Object.values(window.productosDBLocal).forEach(p => {
                    if (window.esProductoIncompleto(p)) count++;
                });
            }
            const badge = document.getElementById('contador-sin-desc');
            if (badge) badge.textContent = count;
            
            const btn = document.getElementById('btn-filtro-sin-desc');
            if (btn) {
                if (window._filtroSoloSinDesc) {
                    btn.style.background = '#dc2626';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#b91c1c';
                } else {
                    btn.style.background = count > 0 ? '#fef3c7' : '#f1f5f9';
                    btn.style.color = count > 0 ? '#92400e' : '#64748b';
                    btn.style.borderColor = count > 0 ? '#f59e0b' : '#cbd5e1';
                }
            }
            return count;
        };

        /**
         * Alterna el filtro rápido para visualizar solo repuestos incompletos
         */
        window.toggleFiltroSinDescripcion = function() {
            window._filtroSoloSinDesc = !window._filtroSoloSinDesc;
            window.actualizarContadorSinDescripcion();
            window.filtrarTablaAdmin();
        };

        /**
         * Actualiza una fila de producto en el DOM en tiempo real a 60fps sin recarga
         */
        window.actualizarFilaProductoDOM = function(docId) {
            const prod = window.productosDBLocal ? window.productosDBLocal[docId] : null;
            if (!prod) return;
            const fila = document.querySelector(`.admin-prod-row[data-doc-id="${docId}"]`);
            if (!fila) return;

            fila.setAttribute('data-category', prod.categoria || '');

            const badgeEstado = prod.estado === 'activo' 
                ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Activo</span>` 
                : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block mt-1">Inactivo</span>`;
            
            let bMarca = '';
            if (prod.marca && prod.marca !== "Universal/Multi-marca" && prod.marca !== "") {
                bMarca = `<span class="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-car-side"></i> ${prod.marca}</span>`;
            }
            
            let bPos = '';
            if (prod.posicion && prod.posicion !== "N/A" && prod.posicion !== "") {
                bPos = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1"><i class="fas fa-arrows-alt-h"></i> ${prod.posicion}</span>`;
            }
            
            let bMod = '';
            if (prod.modalidad && prod.modalidad.toLowerCase().includes("importación")) {
                bMod = `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-plane-arrival"></i> ${prod.modalidad}</span>`;
            } else if (prod.modalidad) {
                bMod = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-sm inline-flex items-center gap-1 mt-1"><i class="fas fa-box"></i> ${prod.modalidad}</span>`;
            }

            const colNombre = fila.querySelector('.prod-nombre-col');
            if (colNombre) {
                colNombre.innerHTML = `
                    <div style="margin-bottom:3px; line-height: 1.2;"><strong>${prod.nombre}</strong> <br>${badgeEstado}</div>
                    <div class="flex flex-wrap gap-1 mt-2 mb-1">
                        ${bMarca}
                        ${bPos}
                    </div>
                    ${bMod}
                    ${prod.modelo ? `<div class="text-[11px] text-gray-500 mt-2"><i class="fas fa-cogs"></i> Mod/Motor: ${prod.modelo}</div>` : ''}
                    ${prod.numero_parte && prod.numero_parte !== 'N/A' && prod.numero_parte !== 'Consultar con asesor' ? `<div class="text-[10px] text-emerald-700 font-mono font-bold mt-1"><i class="fas fa-barcode"></i> OEM: ${prod.numero_parte}</div>` : ''}
                `;
            }

            const celdas = fila.querySelectorAll('td');
            if (celdas[2]) {
                celdas[2].innerHTML = `<span style="background:#eee;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${prod.categoria}</span>${prod.subcategoria ? `<br><span style="font-size:10px; color:#777; display:block; margin-top:4px;">↳ ${prod.subcategoria}</span>` : ''}`;
            }

            // Si el filtro "solo sin descripción" está activo y el producto ya está completo, ocultar fila
            if (window._filtroSoloSinDesc && !window.esProductoIncompleto(prod)) {
                fila.style.display = 'none';
            }
        };

        /**
         * Obtiene o solicita la API Key de Gemini
         */
        window.obtenerApiKeyGemini = function(forzarPrompt = false) {
            let key = sessionStorage.getItem('fb_gemini_api_key') || localStorage.getItem('fb_gemini_api_key') || '';
            if (!key || forzarPrompt) {
                const input = prompt("🔑 Ingresa tu Gemini API Key (Google AI Studio) para autocompletar repuestos con IA:\n(Se guardará únicamente en esta sesión)", key);
                if (input !== null) {
                    key = input.trim();
                    if (key) {
                        sessionStorage.setItem('fb_gemini_api_key', key);
                        localStorage.setItem('fb_gemini_api_key', key);
                    }
                }
            }
            return key;
        };

        window.cambiarApiKeyGeminiRapido = function() {
            const k = window.obtenerApiKeyGemini(true);
            if (k) alert("✅ Gemini API Key configurada correctamente.");
        };

        /**
         * Generador de Ficha Estructurada de Fallback para Inversiones FB Parts
         * Diseñado para que NUNCA se descarte un repuesto por errores de formato o texto plano de la IA.
         * Aplica la plantilla corporativa estricta: ✅ FUNCIÓN Y BENEFICIOS y 🔧 COMPATIBILIDAD SUGERIDA.
         */
        window.construirFallbackEstructurado = function(prod, textoPlano = '') {
            const rawTitulo = (prod?.nombre || '').trim();
            const tituloMayus = rawTitulo.toUpperCase();

            // 1. Detección heurística de Marca Automotriz
            const marcasPopulares = [
                "TOYOTA", "CHEVROLET", "FORD", "MITSUBISHI", "NISSAN", "HYUNDAI", 
                "KIA", "JEEP", "HONDA", "RENAULT", "CHERY", "DONGFENG", "ISUZU", 
                "FIAT", "VOLKSWAGEN", "MAZDA", "MERCEDES BENZ", "BMW", "PEUGEOT", 
                "MACK", "IVECO", "HINO", "SUZUKI", "DODGE", "CHRYSLER", "GREAT WALL", "JAC"
            ];
            let marcaDetectada = (prod?.marca || '').trim();
            if (!marcaDetectada || marcaDetectada.toLowerCase() === 'universal') {
                for (const m of marcasPopulares) {
                    const regex = new RegExp(`\\b${m}\\b`, 'i');
                    if (regex.test(tituloMayus)) {
                        marcaDetectada = m.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                        break;
                    }
                }
            }
            if (!marcaDetectada) marcaDetectada = 'Universal';

            // 2. Detección heurística de Modelo / Motorización
            let modeloDetectado = (prod?.modelo || '').trim().toUpperCase();
            if (!modeloDetectado || modeloDetectado === 'UNIVERSAL') {
                let sinMarca = tituloMayus;
                marcasPopulares.forEach(m => {
                    sinMarca = sinMarca.replace(new RegExp(`\\b${m}\\b`, 'gi'), '');
                });
                const palabrasIgnorar = [
                    "DELANTERO", "DELANTERA", "TRASERO", "TRASERA", "DERECHO", "IZQUIERDO",
                    "ORIGINAL", "REPUESTO", "PAR", "JUEGO", "KIT", "CONJUNTO", "NUEVO", "DE",
                    "PARA", "EN", "CON", "SIN", "COMPLETO", "COMPLETA"
                ];
                palabrasIgnorar.forEach(p => {
                    sinMarca = sinMarca.replace(new RegExp(`\\b${p}\\b`, 'gi'), '');
                });
                sinMarca = sinMarca.trim().replace(/\s+/g, ' ');
                if (sinMarca.length > 2) {
                    modeloDetectado = sinMarca.substring(0, 50).trim();
                } else {
                    modeloDetectado = marcaDetectada !== 'Universal' ? `${marcaDetectada.toUpperCase()} VARIOS` : 'UNIVERSAL';
                }
            }

            // 3. Resolución de Categoría y Subcategoría
            let categoriaSlugFinal = (prod?.categoria || '').trim();
            if (!window.mapaCategorias || !window.mapaCategorias[categoriaSlugFinal]) {
                const catKeys = Object.keys(window.mapaCategorias || {});
                const match = catKeys.find(k => {
                    const nom = (window.mapaCategorias[k] || '').toLowerCase();
                    return tituloMayus.toLowerCase().includes(nom) || nom.includes(categoriaSlugFinal.toLowerCase());
                });
                if (match) {
                    categoriaSlugFinal = match;
                } else if (catKeys.length > 0) {
                    categoriaSlugFinal = catKeys[0];
                }
            }

            let subcatFinal = (prod?.subcategoria || '').trim();
            if (!subcatFinal || subcatFinal === 'General') {
                if (/FRENO|PASTILLA|DISCO|BOMBA DE FRENO/i.test(tituloMayus)) subcatFinal = 'Frenos';
                else if (/AMORTIGUADOR|ESPIRAL|TERMINAL|ROTULA|BIELETA|SUSPENSION/i.test(tituloMayus)) subcatFinal = 'Suspensión';
                else if (/FILTRO/i.test(tituloMayus)) subcatFinal = 'Filtros';
                else if (/CORREA|TENSOR|POLEA|TIEMPO/i.test(tituloMayus)) subcatFinal = 'Correas y Tiempo';
                else if (/PARACHOQUE|PARRILLA|FARO|STOP|CAPOT|GUARDABARRO|PUERTA/i.test(tituloMayus)) subcatFinal = 'Carrocería';
                else if (/MOTOR|PISTON|ANILLO|VALVULA|EMPACADURA|CIGUEÑAL/i.test(tituloMayus)) subcatFinal = 'Motor';
                else if (/ARRANQUE|ALTERNADOR|BOBINA|BUJIA|SENSOR/i.test(tituloMayus)) subcatFinal = 'Eléctrico';
                else if (/RADIADOR|TERMOSTATO|BOMBA DE AGUA|ELECTROVENTILADOR/i.test(tituloMayus)) subcatFinal = 'Enfriamiento';
                else subcatFinal = 'General';
            }

            // 4. Número de Parte OEM Seguro (Nunca inventar falsos códigos)
            let numParteFinal = (prod?.numero_parte || '').trim();
            if (!numParteFinal || numParteFinal === 'N/A') {
                numParteFinal = 'Consultar disponibilidad / OEM';
            }

            // 5. Formatear Descripción según Plantilla Estricta F&B Parts
            let descFinal = '';
            const cleanTextoPlano = (textoPlano || '').trim();

            if (cleanTextoPlano.includes('✅ FUNCIÓN Y BENEFICIOS:') && cleanTextoPlano.includes('🔧 COMPATIBILIDAD SUGERIDA:')) {
                descFinal = cleanTextoPlano;
            } else {
                let parrafoFuncion = '';
                if (cleanTextoPlano && cleanTextoPlano.length > 25 && !cleanTextoPlano.startsWith('{')) {
                    parrafoFuncion = cleanTextoPlano
                        .replace(/^claro,?\s*aquí\s*(tienes|está).+?:/i, '')
                        .replace(/^hola,?\s*/i, '')
                        .trim();
                } else {
                    parrafoFuncion = `Pieza automotriz de alta resistencia diseñada para brindar máxima durabilidad, seguridad y ajuste preciso en ${rawTitulo}. Su instalación oportuna previene desgastes prematuros en componentes periféricos y garantiza el rendimiento óptimo del vehículo bajo estándares de calidad garantizada.`;
                }

                descFinal = `✅ FUNCIÓN Y BENEFICIOS:
${parrafoFuncion}

🔧 COMPATIBILIDAD SUGERIDA:
- ${marcaDetectada} ${modeloDetectado}
- Para confirmar compatibilidad exacta con su número de chasis o serial de carrocería (VIN), consulte a nuestros asesores técnicos de Inversiones FB Parts.`;
            }

            return {
                marca_vehiculo: marcaDetectada,
                modelo_motorizacion: modeloDetectado,
                categoria_slug: categoriaSlugFinal,
                subcategoria: subcatFinal,
                numero_parte_oem: numParteFinal,
                descripcion_formateada: descFinal.trim()
            };
        };

        /**
         * Extractor tolerante de JSON retornado por modelos de IA (Puter.js / Gemini / LLMs)
         * Limpia bloques markdown ```json o ```, busca { y } exteriores, repara comas y escapes,
         * y si la IA devuelve texto plano o falla el parseo, construye automáticamente un JSON estructurado
         * de fallback con la plantilla oficial de F&B Parts para que NINGÚN repuesto se pierda.
         */
        window.extraerJSON = function(textoRespuesta, prod) {
            if (!textoRespuesta) {
                console.warn("[extraerJSON] Respuesta vacía de IA, generando fallback estructurado...");
                return window.construirFallbackEstructurado(prod, '');
            }

            // 1. Extraer texto plano si viene como objeto Puter o Gemini
            let raw = '';
            if (typeof textoRespuesta === 'string') {
                raw = textoRespuesta;
            } else if (textoRespuesta?.message?.content) {
                const c = textoRespuesta.message.content;
                raw = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
            } else if (textoRespuesta?.content) {
                const c = textoRespuesta.content;
                raw = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
            } else if (textoRespuesta?.text) {
                raw = String(textoRespuesta.text);
            } else {
                try {
                    raw = JSON.stringify(textoRespuesta);
                } catch(e) {
                    raw = String(textoRespuesta);
                }
            }

            // 2. Limpieza de delimitadores markdown ```json y ```
            let limpio = (raw || '').trim();
            limpio = limpio.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

            // 3. Buscar llaves { y } exteriores
            const primerLlave = limpio.indexOf('{');
            const ultimaLlave = limpio.lastIndexOf('}');

            if (primerLlave === -1 || ultimaLlave === -1 || ultimaLlave <= primerLlave) {
                console.warn("[extraerJSON] La IA no devolvió un bloque con { }, generando fallback estructurado con plantilla F&B Parts...");
                return window.construirFallbackEstructurado(prod, limpio);
            }

            const jsonString = limpio.substring(primerLlave, ultimaLlave + 1).trim();

            // 4. Intentos progresivos de parseo
            let parsedObj = null;
            try {
                parsedObj = JSON.parse(jsonString);
            } catch (e1) {
                // Intento 2: Reparar comas finales (trailing commas)
                try {
                    const sinTrailing = jsonString
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');
                    parsedObj = JSON.parse(sinTrailing);
                } catch (e2) {
                    // Intento 3: Reparar saltos de línea y tabulaciones sin escapar dentro de comillas
                    try {
                        const saneado = jsonString
                            .replace(/,\s*}/g, '}')
                            .replace(/,\s*]/g, ']')
                            .replace(/"([^"\\]*(\\.[^"\\]*)*)"/gs, (match) => {
                                return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
                            });
                        parsedObj = JSON.parse(saneado);
                    } catch (e3) {
                        console.warn("[extraerJSON] Error sintáctico en JSON retornado por la IA. Aplicando constructor tolerante de fallback:", e1.message);
                        return window.construirFallbackEstructurado(prod, limpio);
                    }
                }
            }

            // 5. Validar estructura del objeto resultante
            if (!parsedObj || typeof parsedObj !== 'object') {
                return window.construirFallbackEstructurado(prod, limpio);
            }

            // Asegurar descripción formateada
            let desc = (parsedObj.descripcion_formateada || '').trim();
            if (!desc || desc.length < 20 || (!desc.includes('✅ FUNCIÓN Y BENEFICIOS:') && !desc.includes('🔧 COMPATIBILIDAD SUGERIDA:'))) {
                const fb = window.construirFallbackEstructurado(prod, desc || limpio);
                desc = fb.descripcion_formateada;
            }

            // Asegurar OEM seguro
            let oem = (parsedObj.numero_parte_oem || '').trim();
            const tituloMayus = (prod?.nombre || '').toUpperCase();
            if (oem && oem !== 'N/A' && oem !== 'Consultar disponibilidad / OEM' && oem !== 'Consultar con asesor') {
                const cleanOem = oem.replace(/[^A-Z0-9]/gi, '');
                const cleanTitle = tituloMayus.replace(/[^A-Z0-9]/gi, '');
                if (cleanOem.length > 3 && !cleanTitle.includes(cleanOem)) {
                    oem = 'Consultar disponibilidad / OEM';
                }
            } else if (!oem) {
                oem = 'Consultar disponibilidad / OEM';
            }

            // Asegurar Categoría válida
            let catSlug = (parsedObj.categoria_slug || '').trim();
            if (!window.mapaCategorias || !window.mapaCategorias[catSlug]) {
                const catKeys = Object.keys(window.mapaCategorias || {});
                const match = catKeys.find(k => k.toLowerCase() === catSlug.toLowerCase() || (window.mapaCategorias[k] && window.mapaCategorias[k].toLowerCase().includes(catSlug.toLowerCase())));
                if (match) {
                    catSlug = match;
                } else if (prod?.categoria && window.mapaCategorias?.[prod.categoria]) {
                    catSlug = prod.categoria;
                } else if (catKeys.length > 0) {
                    catSlug = catKeys[0];
                }
            }

            return {
                marca_vehiculo: (parsedObj.marca_vehiculo || prod?.marca || 'Universal').trim(),
                modelo_motorizacion: (parsedObj.modelo_motorizacion || prod?.modelo || 'UNIVERSAL').trim().toUpperCase(),
                categoria_slug: catSlug,
                subcategoria: (parsedObj.subcategoria || prod?.subcategoria || 'General').trim(),
                numero_parte_oem: oem,
                descripcion_formateada: desc
            };
        };

        // Alias retrocompatible
        window.parsearJSONSeguro = window.extraerJSON;

        /**
         * Motor de Generación Estructurada vía Puter.js AI (puter.ai.chat)
         * Con fallback a Gemini API directo si existe clave configurada.
         */
        window.ejecutarPuterStructuredIA = async function(prod) {
            if (!prod) throw new Error("Producto no encontrado.");

            if (typeof puter === 'undefined' || !puter.ai || typeof puter.ai.chat !== 'function') {
                throw new Error("Puter.js no está disponible. Revisa tu conexión a internet o verifica que el servicio de Puter esté activo.");
            }

            // Preparar lista de categorías existentes válidas
            const categoriasValidas = [];
            if (window.mapaCategorias && Object.keys(window.mapaCategorias).length > 0) {
                Object.entries(window.mapaCategorias).forEach(([id, nombre]) => {
                    categoriasValidas.push(`- ID: "${id}" (Nombre: "${nombre}")`);
                });
            }
            const listaCatTexto = categoriasValidas.length > 0 
                ? categoriasValidas.join('\n')
                : `- ID: "repuestos-automotrices" (Nombre: "Repuestos Automotrices")\n- ID: "motor" (Nombre: "Motor")\n- ID: "frenos" (Nombre: "Frenos")\n- ID: "carroceria" (Nombre: "Carrocería")`;

            const promptPuter = `Eres un Ingeniero Especialista en Catálogo Automotriz para la empresa venezolana "Inversiones FB Parts, C.A.".
Tu labor es estructurar fichas técnicas automotrices en formato JSON estricto basadas en el título del producto.
Debes responder ÚNICAMENTE un objeto JSON válido, sin bloques de texto antes ni después, sin explicaciones.

DATOS DEL REPUESTO:
- Nombre / Título: "${prod.nombre || ''}"
- Precio Actual: $${prod.precio || 0}
- Stock: ${prod.stock !== undefined ? prod.stock : 1}
- Categoría actual: "${prod.categoria || ''}"
- Marca actual: "${prod.marca || ''}"
- Modelo actual: "${prod.modelo || ''}"
- OEM actual: "${prod.numero_parte || ''}"

LISTA DE CATEGORÍAS VÁLIDAS EN EL SISTEMA:
${listaCatTexto}

REGLAS ESTRICTAS DE RESPUESTA:
1. "marca_vehiculo": Nombre de la marca fabricante del vehículo (ej: "Toyota", "Ford", "Chevrolet", "Mercedes Benz", "Dongfeng", "Isuzu", "Mitsubishi", "Chery", "Hyundai"). Si no aplica a una marca particular, escribe "Universal".
2. "modelo_motorizacion": Nombre del modelo y su cilindrada o motor en LETRAS MAYÚSCULAS (ej: "HILUX 2.7L", "COROLLA 1.8L", "MERCEDES BENZ C200", "SILVERADO 5.3L", "AVEO 1.6L", "DUOLIKA 5T"). Si el título no indica motorización, coloca el modelo del vehículo en MAYÚSCULAS.
3. "categoria_slug": Elige OBLIGATORIAMENTE el ID/slug exacto de la lista de categorías provistas que mejor clasifique la pieza (ej: "parrillas-de-parachoques-para-vehiculos", "motor", "frenos", etc.).
4. "subcategoria": Clasificación del subsistema vehicular (ej: "Motor", "Carrocería", "Frenos", "Suspensión", "Iluminación", "Eléctrico", "Enfriamiento", "Filtros", "Correas", "Accesorios").
5. "numero_parte_oem": REGLA DE SEGURIDAD ESTRICTA: Extrae el código OEM ÚNICAMENTE si viene explícito en el título del producto o en los datos provistos. Si NO viene un número de parte evidente en el título, coloca estrictamente "Consultar disponibilidad / OEM" o "N/A". PROHIBIDO INVENTAR CÓDIGOS FALSOS.
6. "descripcion_formateada": Redacta un texto profesional, técnico y persuasivo siguiendo ESTRICTAMENTE esta plantilla exacta (mantén los emojis y encabezados tal cual):

✅ FUNCIÓN Y BENEFICIOS:
[Escribe 1 párrafo claro, profesional y técnico sobre la función que cumple esta pieza y el beneficio de reemplazarla a tiempo para la vida útil del vehículo]

🔧 COMPATIBILIDAD SUGERIDA:
- [Marca Modelo Años]
- [Marca Modelo Años]

ESTRUCTURA EXACTA REQUERIDA (Responde solo este JSON):
{
  "marca_vehiculo": "...",
  "modelo_motorizacion": "...",
  "categoria_slug": "...",
  "subcategoria": "...",
  "numero_parte_oem": "...",
  "descripcion_formateada": "..."
}`;

            let respPuter = null;
            try {
                respPuter = await puter.ai.chat(promptPuter, { model: 'gemini-2.0-flash' });
            } catch (mErr) {
                console.warn("Fallo con modelo gemini-2.0-flash en Puter, reintentando con modelo por defecto:", mErr);
                try {
                    respPuter = await puter.ai.chat(promptPuter);
                } catch (mErr2) {
                    const geminiKey = window.obtenerApiKeyGemini ? window.obtenerApiKeyGemini(false) : '';
                    if (geminiKey) {
                        console.warn("Puter AI no respondió, recurriendo a Gemini API directo...");
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
                        const gResp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: promptPuter }] }],
                                generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
                            })
                        });
                        if (!gResp.ok) throw new Error(`Puter (${mErr2?.message || 'error'}) y Gemini (${gResp.statusText}) fallaron`);
                        const gData = await gResp.json();
                        respPuter = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    } else {
                        throw mErr2;
                    }
                }
            }

            return window.extraerJSON(respPuter, prod);
        };

        // Alias retrocompatible
        window.ejecutarGeminiStructuredIA = window.ejecutarPuterStructuredIA;

        /**
         * Abre el modal individual de autocompletado y consulta la IA
         */
        window.completarRepuestoConIA = async function(docId) {
            if (!docId) {
                alert("ID de repuesto no válido.");
                return;
            }
            const prod = window.productosDBLocal ? window.productosDBLocal[docId] : null;
            if (!prod) {
                alert("No se encontraron los datos del repuesto en memoria local.");
                return;
            }

            const modal = document.getElementById('modal-ai-completar-repuesto');
            if (!modal) return;

            // Poblar tarjeta informativa
            document.getElementById('ai-rep-doc-id').value = docId;
            document.getElementById('ai-rep-nombre-display').textContent = prod.nombre || 'Sin título';
            document.getElementById('ai-rep-badge-precio').textContent = `$${Number(prod.precio || 0).toFixed(2)}`;
            document.getElementById('ai-rep-badge-stock').textContent = `Stock: ${prod.stock !== undefined ? prod.stock : 1}`;
            
            const imgEl = document.getElementById('ai-rep-img-preview');
            if (imgEl) {
                imgEl.src = prod.imagen ? SecuritySanitizer.formatImageUrl(prod.imagen, 200) : 'img/logo-fb-parts.png';
            }

            const badgeIncompleto = document.getElementById('ai-rep-badge-estado-desc');
            if (badgeIncompleto) {
                if (window.esProductoIncompleto(prod)) {
                    badgeIncompleto.style.display = 'inline-block';
                    badgeIncompleto.textContent = '⚠️ Ficha Incompleta';
                    badgeIncompleto.style.background = '#fef2f2';
                    badgeIncompleto.style.color = '#b91c1c';
                    badgeIncompleto.style.borderColor = '#fecaca';
                } else {
                    badgeIncompleto.style.display = 'inline-block';
                    badgeIncompleto.textContent = '✓ Ficha Completa';
                    badgeIncompleto.style.background = '#f0fdf4';
                    badgeIncompleto.style.color = '#15803d';
                    badgeIncompleto.style.borderColor = '#bbf7d0';
                }
            }

            // Poblar selector de categorías
            const selCat = document.getElementById('ai-rep-categoria');
            if (selCat) {
                selCat.innerHTML = '';
                if (window.mapaCategorias) {
                    Object.entries(window.mapaCategorias).forEach(([id, nom]) => {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.textContent = nom;
                        selCat.appendChild(opt);
                    });
                }
            }

            // Mostrar modal con loader
            modal.style.display = 'flex';
            const loader = document.getElementById('ai-rep-loading');
            const form = document.getElementById('ai-rep-formulario');
            const btnGuardar = document.getElementById('btn-ai-guardar-ficha');
            if (loader) loader.style.display = 'block';
            if (form) form.style.opacity = '0.5';
            if (btnGuardar) btnGuardar.disabled = true;

            try {
                const resultado = await window.ejecutarPuterStructuredIA(prod);

                document.getElementById('ai-rep-marca').value = resultado.marca_vehiculo;
                document.getElementById('ai-rep-modelo').value = resultado.modelo_motorizacion;
                if (selCat && resultado.categoria_slug) selCat.value = resultado.categoria_slug;
                document.getElementById('ai-rep-subcategoria').value = resultado.subcategoria;
                document.getElementById('ai-rep-oem').value = resultado.numero_parte_oem;
                document.getElementById('ai-rep-descripcion').value = resultado.descripcion_formateada;

            } catch (err) {
                console.error("Error al autocompletar repuesto con Puter AI:", err);
                alert("⚠️ No se pudo generar la ficha con Puter AI automáticamente:\n" + (err.message || err) + "\n\nPuedes ajustar los datos manualmente.");
                document.getElementById('ai-rep-marca').value = prod.marca || '';
                document.getElementById('ai-rep-modelo').value = (prod.modelo || '').toUpperCase();
                if (selCat && prod.categoria) selCat.value = prod.categoria;
                document.getElementById('ai-rep-subcategoria').value = prod.subcategoria || '';
                document.getElementById('ai-rep-oem').value = prod.numero_parte || 'Consultar disponibilidad / OEM';
                document.getElementById('ai-rep-descripcion').value = prod.descripcion || '';
            } finally {
                if (loader) loader.style.display = 'none';
                if (form) form.style.opacity = '1';
                if (btnGuardar) btnGuardar.disabled = false;
            }
        };

        window.reintentarIAIndividual = function() {
            const docId = document.getElementById('ai-rep-doc-id').value;
            if (docId) window.completarRepuestoConIA(docId);
        };

        window.cerrarModalAIRepuesto = function() {
            const modal = document.getElementById('modal-ai-completar-repuesto');
            if (modal) modal.style.display = 'none';
        };

        /**
         * Guarda y publica la ficha generada/editada en Firestore y web_destacados
         */
        window.guardarFichaCompletadaIA = async function() {
            const docId = document.getElementById('ai-rep-doc-id').value;
            if (!docId) return;

            const btn = document.getElementById('btn-ai-guardar-ficha');
            const textoOriginal = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            try {
                const marca = SecuritySanitizer.cleanText(document.getElementById('ai-rep-marca').value, 50);
                const modelo = SecuritySanitizer.cleanText(document.getElementById('ai-rep-modelo').value.toUpperCase(), 100);
                const categoria = document.getElementById('ai-rep-categoria').value;
                const subcategoria = SecuritySanitizer.cleanText(document.getElementById('ai-rep-subcategoria').value, 50);
                const numeroParte = SecuritySanitizer.cleanText(document.getElementById('ai-rep-oem').value, 50);
                const descripcion = SecuritySanitizer.cleanNote(document.getElementById('ai-rep-descripcion').value, 2500);

                const prodActual = window.productosDBLocal[docId] || {};

                const datosActualizados = {
                    marca: marca || 'Universal',
                    modelo: modelo || '',
                    categoria: categoria,
                    subcategoria: subcategoria,
                    numero_parte: numeroParte,
                    descripcion: descripcion
                };

                // 1. Guardar en Firestore colección 'productos'
                await updateDoc(doc(db, "productos", docId), datosActualizados);

                // 2. Sincronizar en segundo plano con 'web_destacados' si aplica
                try {
                    const snapDest = await getDocs(collection(db, "web_destacados"));
                    snapDest.forEach(async dSnap => {
                        const d = dSnap.data();
                        if (d.productoId === docId || d.nombre === prodActual.nombre) {
                            await updateDoc(doc(db, "web_destacados", dSnap.id), {
                                categoria: datosActualizados.categoria,
                                marca: datosActualizados.marca,
                                modelo: datosActualizados.modelo,
                                subcategoria: datosActualizados.subcategoria
                            });
                        }
                    });
                } catch(eDest) { console.warn("Sync web_destacados:", eDest); }

                // 3. Actualizar memoria local
                if (window.productosDBLocal[docId]) {
                    Object.assign(window.productosDBLocal[docId], datosActualizados);
                }

                // 4. Si el modal de edición clásico está abierto, sincronizar sus campos
                const modalEdicion = document.getElementById('modal-edicion');
                if (modalEdicion && modalEdicion.style.display !== 'none' && document.getElementById('edit-id').value === docId) {
                    document.getElementById('edit-marca').value = datosActualizados.marca;
                    document.getElementById('edit-modelo').value = datosActualizados.modelo;
                    document.getElementById('edit-subcategoria').value = datosActualizados.subcategoria;
                    document.getElementById('edit-numero-parte').value = datosActualizados.numero_parte;
                    document.getElementById('edit-descripcion').value = datosActualizados.descripcion;
                    let catName = (window.mapaCategorias && window.mapaCategorias[datosActualizados.categoria]) ? window.mapaCategorias[datosActualizados.categoria] : datosActualizados.categoria;
                    document.getElementById('edit-categoria').value = catName;
                }

                // 5. Actualizar DOM de la fila en tiempo real
                window.actualizarFilaProductoDOM(docId);

                // 6. Actualizar contador de incompletos
                window.actualizarContadorSinDescripcion();

                // 7. Registro de Auditoría
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("FICHA IA GUARDADA", `Ficha técnica completada para: ${prodActual.nombre || docId}`);
                }

                // 8. Cerrar modal y feedback
                window.cerrarModalAIRepuesto();

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Ficha Publicada!',
                        text: 'La ficha técnica ha sido guardada en Firestore y actualizada en el catálogo.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    alert("✅ Ficha técnica guardada y publicada exitosamente.");
                }

            } catch (error) {
                console.error("Error al guardar ficha:", error);
                alert("Ocurrió un error al guardar la ficha técnica: " + (error.message || error));
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = textoOriginal;
                }
            }
        };

        /**
         * Abre el modal de procesamiento por lote
         */
        window.abrirModalLoteIA = function() {
            const modal = document.getElementById('modal-ai-lote-repuestos');
            if (!modal) return;

            window._loteIACancelado = false;
            const tbody = document.getElementById('ai-lote-items-tbody');
            const summaryText = document.getElementById('ai-lote-summary-text');
            const pctText = document.getElementById('ai-lote-pct-text');
            const progressBar = document.getElementById('ai-lote-progress-bar');
            const statusLabel = document.getElementById('ai-lote-status-label');
            const counterLabel = document.getElementById('ai-lote-counter-label');
            const btnIniciar = document.getElementById('btn-iniciar-lote-ia');
            const btnDetener = document.getElementById('btn-detener-lote-ia');

            if (btnIniciar) {
                btnIniciar.style.display = 'inline-flex';
                btnIniciar.disabled = false;
                btnIniciar.innerHTML = '<i class="fas fa-play"></i> Iniciar Procesamiento en Lote';
            }
            if (btnDetener) btnDetener.style.display = 'none';

            if (progressBar) progressBar.style.width = '0%';
            if (pctText) pctText.textContent = '0%';
            if (statusLabel) statusLabel.textContent = 'Listo para comenzar';

            const pendientes = [];
            if (window.productosDBLocal) {
                Object.entries(window.productosDBLocal).forEach(([id, prod]) => {
                    if (window.esProductoIncompleto(prod)) {
                        pendientes.push({ id, prod });
                    }
                });
            }

            window._lotePendientesCache = pendientes;

            if (summaryText) summaryText.textContent = `Detectados: ${pendientes.length} repuestos incompletos`;
            if (counterLabel) counterLabel.textContent = `0 de ${pendientes.length} completados`;

            if (tbody) {
                if (pendientes.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px; color: #15803d; font-weight: bold;">🎉 ¡Felicitaciones! Todo el catálogo cuenta con ficha técnica completa.</td></tr>`;
                    if (btnIniciar) btnIniciar.disabled = true;
                } else {
                    tbody.innerHTML = pendientes.map((item, index) => `
                        <tr id="lote-row-${item.id}" style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 12px; color: #64748b; font-weight: 700;">${index + 1}</td>
                            <td style="padding: 8px 12px; font-weight: 700; color: #1e293b; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${SecuritySanitizer.escapeHtml(item.prod.nombre || 'Repuesto')}
                            </td>
                            <td style="padding: 8px 12px; color: #64748b;" id="lote-cat-${item.id}">
                                ${item.prod.categoria || '<em style="color:#ef4444;">Sin categoría</em>'}
                            </td>
                            <td style="padding: 8px 12px; text-align: right;" id="lote-status-${item.id}">
                                <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">⏳ Pendiente</span>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            modal.style.display = 'flex';
        };

        window.cerrarModalLoteIA = function() {
            window._loteIACancelado = true;
            const modal = document.getElementById('modal-ai-lote-repuestos');
            if (modal) modal.style.display = 'none';
        };

        window.detenerProcesamientoLoteIA = function() {
            window._loteIACancelado = true;
            const statusLabel = document.getElementById('ai-lote-status-label');
            if (statusLabel) statusLabel.textContent = 'Deteniendo lote al finalizar la pieza actual...';
        };

        /**
         * Ejecuta el procesamiento en lote secuencial y resiliente con Puter.js AI
         * Soporta 93+ repuestos con guardado inmediato en Firestore, pre-chequeo del motor,
         * registro explícito de errores y pausa preventiva de 1500ms entre repuestos.
         */
        window.iniciarProcesamientoLoteIA = async function() {
            const pendientes = window._lotePendientesCache || [];
            if (pendientes.length === 0) return;

            const btnIniciar = document.getElementById('btn-iniciar-lote-ia');
            const btnDetener = document.getElementById('btn-detener-lote-ia');
            const progressBar = document.getElementById('ai-lote-progress-bar');
            const pctText = document.getElementById('ai-lote-pct-text');
            const statusLabel = document.getElementById('ai-lote-status-label');
            const counterLabel = document.getElementById('ai-lote-counter-label');

            // 1. Pre-chequeo de disponibilidad de la biblioteca Puter.js
            if (typeof puter === 'undefined' || !puter.ai || typeof puter.ai.chat !== 'function') {
                const errorMsg = "Puter.js no está disponible o no se cargó en el navegador. Revisa tu conexión a internet.";
                console.error('[Lote IA Pre-Check Error]', errorMsg);
                if (statusLabel) {
                    statusLabel.innerHTML = `<span style="color: #b91c1c; font-weight: bold;"><i class="fas fa-exclamation-triangle"></i> ${errorMsg}</span>`;
                }
                alert(`⚠️ ${errorMsg}\n\nEl lote ha sido detenido para evitar errores en serie.`);
                return;
            }

            // Preparar UI en modo de prueba previa
            if (btnIniciar) {
                btnIniciar.disabled = true;
                btnIniciar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando conexión IA...';
            }
            if (statusLabel) {
                statusLabel.innerHTML = '<span style="color: #385723;"><i class="fas fa-spinner fa-spin"></i> Verificando disponibilidad del motor Puter AI...</span>';
            }

            // 2. Pre-chequeo del motor de IA con ping rápido y timeout de 6 segundos
            let pingOk = false;
            let pingError = null;
            try {
                const pingPromise = (async () => {
                    try {
                        return await puter.ai.chat('Ping', { model: 'gemini-2.0-flash' });
                    } catch (p1) {
                        return await puter.ai.chat('Ping');
                    }
                })();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Tiempo de espera agotado (6s sin respuesta de Puter AI)")), 6000)
                );
                await Promise.race([pingPromise, timeoutPromise]);
                pingOk = true;
            } catch (testErr) {
                pingError = testErr?.message || String(testErr);
                console.error('[Lote IA Pre-Check Falló]', testErr);
            }

            if (!pingOk) {
                if (btnIniciar) {
                    btnIniciar.disabled = false;
                    btnIniciar.innerHTML = '<i class="fas fa-play"></i> Reintentar Procesamiento en Lote';
                }
                if (btnDetener) btnDetener.style.display = 'none';
                if (statusLabel) {
                    statusLabel.innerHTML = `<span style="color: #b91c1c; font-weight: bold;"><i class="fas fa-exclamation-triangle"></i> Falló verificación de Puter AI (${SecuritySanitizer.escapeHtml(pingError)}). Lote abortado preventivamente.</span>`;
                }
                alert(`⚠️ No se pudo conectar con el motor Puter AI:\n"${pingError}"\n\nEl procesamiento en lote se ha detenido preventivamente para no marcar los ${pendientes.length} repuestos con error.\nPor favor verifica tu conexión a internet o el servicio de Puter.`);
                return;
            }

            // 3. Inicio formal del procesamiento en lote
            window._loteIACancelado = false;
            if (btnIniciar) btnIniciar.style.display = 'none';
            if (btnDetener) btnDetener.style.display = 'inline-flex';

            let procesados = 0;
            let errores = 0;
            const total = pendientes.length;

            for (let i = 0; i < total; i++) {
                if (window._loteIACancelado) {
                    if (statusLabel) statusLabel.textContent = '⛔ Procesamiento detenido por el usuario.';
                    break;
                }

                const { id, prod } = pendientes[i];
                const repuesto = { id: id, nombre: prod?.nombre, ...prod };
                const statusTd = document.getElementById(`lote-status-${id}`);
                const catTd = document.getElementById(`lote-cat-${id}`);
                const rowTr = document.getElementById(`lote-row-${id}`);

                if (statusTd) statusTd.innerHTML = `<span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;"><i class="fas fa-spinner fa-spin"></i> Procesando...</span>`;
                if (statusLabel) statusLabel.textContent = `Procesando (${i + 1}/${total}): ${prod.nombre?.substring(0, 32)}...`;

                let resultado = null;
                let lastErr = null;

                // Intento 1 con 1 reintento automático si falla
                for (let intento = 1; intento <= 2; intento++) {
                    try {
                        resultado = await window.ejecutarPuterStructuredIA(prod);
                        lastErr = null;
                        break; // Éxito
                    } catch (err) {
                        lastErr = err;
                        if (intento === 1 && !window._loteIACancelado) {
                            if (statusTd) statusTd.innerHTML = `<span style="background: #fffbeb; color: #d97706; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10.5px;"><i class="fas fa-redo fa-spin"></i> Reintentando...</span>`;
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }
                }

                if (resultado) {
                    try {
                        const datosActualizados = {
                            marca: SecuritySanitizer.cleanText(resultado.marca_vehiculo, 50),
                            modelo: SecuritySanitizer.cleanText(resultado.modelo_motorizacion, 100),
                            categoria: resultado.categoria_slug,
                            subcategoria: SecuritySanitizer.cleanText(resultado.subcategoria, 50),
                            numero_parte: SecuritySanitizer.cleanText(resultado.numero_parte_oem, 50),
                            descripcion: SecuritySanitizer.cleanNote(resultado.descripcion_formateada, 2500)
                        };

                        // 1. Guardar de inmediato en Firestore por cada ítem para asegurar avance ante interrupciones
                        await updateDoc(doc(db, "productos", id), datosActualizados);

                        // 2. Sincronizar en segundo plano con web_destacados si aplica
                        try {
                            const snapDest = await getDocs(collection(db, "web_destacados"));
                            snapDest.forEach(async dSnap => {
                                const d = dSnap.data();
                                if (d.productoId === id || d.nombre === prod.nombre) {
                                    await updateDoc(doc(db, "web_destacados", dSnap.id), {
                                        categoria: datosActualizados.categoria,
                                        marca: datosActualizados.marca,
                                        modelo: datosActualizados.modelo,
                                        subcategoria: datosActualizados.subcategoria
                                    });
                                }
                            });
                        } catch(eDest) { console.warn("Sync web_destacados:", eDest); }

                        // 3. Sincronizar en memoria y tabla principal
                        if (window.productosDBLocal[id]) {
                            Object.assign(window.productosDBLocal[id], datosActualizados);
                        }
                        window.actualizarFilaProductoDOM(id);

                        // 4. Actualizar fila del lote en vivo
                        const nombreCat = window.mapaCategorias?.[resultado.categoria_slug] || resultado.categoria_slug;
                        if (catTd) catTd.textContent = `${nombreCat}${resultado.modelo_motorizacion ? ` (${resultado.modelo_motorizacion})` : ''}`;
                        if (statusTd) statusTd.innerHTML = `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">✓ Completado</span>`;
                        if (rowTr) rowTr.style.background = '#f0fdf4';

                        procesados++;
                    } catch (dbErr) {
                        console.error('[Lote IA Error]', repuesto.id || repuesto.nombre, dbErr);
                        const rawDbMsg = dbErr?.message || String(dbErr);
                        const safeDbMsg = SecuritySanitizer.escapeHtml(rawDbMsg);
                        const shortDbMsg = SecuritySanitizer.escapeHtml(rawDbMsg.length > 25 ? rawDbMsg.substring(0, 22) + '...' : rawDbMsg);

                        if (statusTd) {
                            statusTd.innerHTML = `
                                <span style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: help; display: inline-block;" title="${safeDbMsg}">✕ Error</span>
                                <div style="font-size: 9.5px; color: #dc2626; margin-top: 2px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace;" title="${safeDbMsg}">${shortDbMsg}</div>
                            `;
                        }
                        if (rowTr) rowTr.style.background = '#fef2f2';
                        errores++;
                    }
                } else {
                    console.error('[Lote IA Error]', repuesto.id || repuesto.nombre, lastErr);
                    const rawErrMsg = lastErr?.message || String(lastErr) || "Error al procesar con Puter AI";
                    const safeErrMsg = SecuritySanitizer.escapeHtml(rawErrMsg);
                    const shortErrMsg = SecuritySanitizer.escapeHtml(rawErrMsg.length > 25 ? rawErrMsg.substring(0, 22) + '...' : rawErrMsg);

                    if (statusTd) {
                        statusTd.innerHTML = `
                            <span style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: help; display: inline-block;" title="${safeErrMsg}">✕ Error</span>
                            <div style="font-size: 9.5px; color: #dc2626; margin-top: 2px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace;" title="${safeErrMsg}">${shortErrMsg}</div>
                        `;
                    }
                    if (rowTr) rowTr.style.background = '#fef2f2';
                    errores++;
                }

                // Progreso visual en tiempo real
                const pct = Math.round(((i + 1) / total) * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (pctText) pctText.textContent = `${pct}%`;
                if (counterLabel) {
                    counterLabel.textContent = `${procesados} de ${total} completados${errores > 0 ? ` (${errores} con error)` : ''}`;
                }

                // Pausa preventiva de 1500ms entre repuestos para no saturar la tasa de peticiones
                if (i < total - 1 && !window._loteIACancelado) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            if (btnDetener) btnDetener.style.display = 'none';
            if (btnIniciar) {
                btnIniciar.style.display = 'inline-flex';
                btnIniciar.innerHTML = '<i class="fas fa-check"></i> Proceso Finalizado';
                btnIniciar.disabled = true;
            }

            if (statusLabel && !window._loteIACancelado) {
                statusLabel.textContent = `✅ ¡Lote completado! (${procesados} guardados en Firestore${errores > 0 ? `, ${errores} errores` : ''})`;
            }

            window.actualizarContadorSinDescripcion();
        };

        window.imprimirEtiquetaEnvio = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if(!ped) return;

            // Extraer productos a formato texto
            let productosHTML = '';
            if(ped.productos && Array.isArray(ped.productos)) {
                ped.productos.forEach(p => {
                    productosHTML += `
                    <tr>
                        <td style="padding: 2px 0; border-bottom: 1px dashed #000; font-size: 13px;"><b>${p.cantidad}x</b> ${p.nombre}</td>
                    </tr>`;
                });
            } else {
                productosHTML = `<tr><td style="padding: 2px 0; border-bottom: 1px dashed #000; font-size: 13px;"><b>${ped.cantidad || 1}x</b> ${ped.producto || 'Repuesto'}</td></tr>`;
            }

            const ventanaTicket = window.open('', '_blank', 'width=400,height=600');
            if(!ventanaTicket) { alert("⚠️ Tu navegador bloqueó la ventana de impresión."); return; }

            // CSS Mágico para impresoras de 58mm
            const estiloTermico = `
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; margin: 0; padding: 0; color: #000; }
                    .ticket-container { width: 58mm; max-width: 100%; margin: 0 auto; padding: 2mm; box-sizing: border-box; }
                    h2 { margin: 0 0 5px 0; font-size: 18px; text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; }
                    p { margin: 3px 0; font-size: 13px; line-height: 1.2; }
                    .info-box { border: 1px solid #000; padding: 5px; margin-bottom: 5px; border-radius: 3px; }
                    .resaltado { font-weight: bold; font-size: 15px; text-align: center; display: block; margin: 5px 0; border: 1px dashed #000; padding: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    .cut-line { text-align: center; margin-top: 20px; font-size: 12px; color: #000; border-top: 1px dashed #000; padding-top: 5px; margin-bottom: 15px; }
                    
                    /* Reglas exclusivas para el momento de imprimir */
                    @media print {
                        @page { margin: 0; size: 58mm auto; }
                        body { width: 58mm; }
                        .no-print { display: none !important; }
                    }
                </style>
            `;

            const contenidoTicket = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Ticket de Envío</title>
                    ${estiloTermico}
                </head>
                <body>
                    <div style="text-align:center; padding: 10px;" class="no-print">
                        <button onclick="window.print()" style="background:#000; color:#fff; border:none; padding:10px 20px; font-size:16px; font-weight:bold; cursor:pointer; border-radius:5px;">🖨️ IMPRIMIR TICKET</button>
                        <p style="font-size:12px; color:#666;">(Asegúrate de seleccionar tu impresora de 58mm en Destino)</p>
                    </div>

                    <div class="ticket-container">
                        <h2>F&B PARTS</h2>
                        <p style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 10px;">ORDEN DE DESPACHO</p>
                        
                        <p><b>Fecha:</b> ${ped.fecha || new Date().toLocaleDateString("es-VE")}</p>
                        
                        <div class="info-box">
                            <p style="font-size: 11px;">CLIENTE DESTINO:</p>
                            <p style="font-weight: bold; font-size: 16px;">${ped.cliente}</p>
                            <p><b>Tlf/Correo:</b> ${ped.email}</p>
                        </div>

                        <span class="resaltado">🚚 ${ped.envio}</span>
                        ${ped.tracking ? `<p style="text-align:center;">Guía: <b>${ped.tracking}</b></p>` : ''}
                        
                        <p style="margin-top: 10px; font-weight: bold; border-bottom: 1px solid #000;">CONTENIDO DEL PAQUETE:</p>
                        <table>
                            ${productosHTML}
                        </table>

                        <p style="text-align: center; font-size: 11px; margin-top: 15px;">
                            *** GRACIAS POR SU COMPRA ***<br>
                            www.fybparts.com
                        </p>
                        
                        <div class="cut-line">✂ - - - - - - - - - - - - </div>
                    </div>
                </${'body'}>
                </${'html'}>
            `;

            ventanaTicket.document.open();
            ventanaTicket.document.write(contenidoTicket);
            ventanaTicket.document.close();

            // Lanzar impresión automática después de cargar
            setTimeout(() => { 
                ventanaTicket.focus(); 
                ventanaTicket.print(); 
            }, 500);
        };

        // ==========================================
        // 🚀 LÓGICA DE PEDIDOS Y MOTORIZADOS
        // ==========================================
        window.mostrarOpcionesMotorizado = function() {
            const envio = document.getElementById('edit-pedido-envio').value;
            const zonaMot = document.getElementById('zona-motorizado');
            // Ocultar base del motorizado SOLAMENTE si el cliente retira en local
            if (envio.includes('Retiro')) {
                zonaMot.style.display = 'none';
            } else {
                zonaMot.style.display = 'block';
            }
        };

        window.abrirModalPedido = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if(!ped) return;
            
            document.getElementById('edit-pedido-id').value = docId;
            document.getElementById('edit-pedido-email').value = ped.email || '';
            document.getElementById('edit-pedido-cliente').value = ped.cliente || '';
            
            // Reparación del select: Si era un pedido viejo que decía "Encomienda Tealca", lo forzamos al nombre nuevo
            const envioSelect = document.getElementById('edit-pedido-envio');
            if (ped.envio === "Encomienda Tealca") {
                envioSelect.value = "Encomienda Tealca/Zoom";
            } else {
                envioSelect.value = ped.envio || 'Retiro en Local';
            }
            
            document.getElementById('edit-pedido-tracking').value = ped.tracking || '';
            document.getElementById('edit-pedido-estado').value = ped.estado || 'Pendiente';
            
            // Cargar datos del motorizado si existen
            document.getElementById('edit-pedido-motorizado').value = ped.motorizado || '';
            document.getElementById('edit-pedido-tarifa').value = ped.tarifaMotorizado || '';
            
            window.mostrarOpcionesMotorizado();
            document.getElementById('modal-pedido').style.display = 'flex';
        };

        window.cerrarModalPedido = function() {
            document.getElementById('modal-pedido').style.display = 'none';
        };

        window.guardarCambiosPedido = async function() {
            const docId = document.getElementById('edit-pedido-id').value;
            const pedOriginal = window.pedidosDBLocal[docId] || {};
            const btn = document.getElementById('btn-save-pedido');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            let trackingVal = document.getElementById('edit-pedido-tracking').value.trim();
            const envioVal = document.getElementById('edit-pedido-envio').value;
            const motorizadoVal = document.getElementById('edit-pedido-motorizado').value;
            const tarifaVal = parseFloat(document.getElementById('edit-pedido-tarifa').value) || 0;

            // Auto-generar código MOT si no tiene guía, tiene chofer y no es retiro en local
            if (!envioVal.includes('Retiro') && motorizadoVal !== '' && trackingVal === '') {
                const aleatorio = Math.floor(1000 + Math.random() * 9000);
                const letMot = motorizadoVal.substring(0,1).toUpperCase();
                trackingVal = `MOT${letMot}-${aleatorio}`;
            }

            const datosActualizados = {
                email: document.getElementById('edit-pedido-email').value.trim(),
                cliente: document.getElementById('edit-pedido-cliente').value.trim(),
                envio: envioVal,
                tracking: trackingVal,
                estado: document.getElementById('edit-pedido-estado').value,
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? (pedOriginal.pagoMotorizadoEstatus || 'Pendiente') : ''
            };

            try {
                await updateDoc(doc(db, "pedidos", docId), datosActualizados);
                window.cerrarModalPedido();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
            } catch (error) {
                console.error(error);
                alert("Error al actualizar la información del pedido.");
            }
            btn.innerHTML = "Guardar"; btn.disabled = false;
        };

        window.eliminarPedido = async function() {
            const docId = document.getElementById('edit-pedido-id').value;
            if(!confirm("¿Estás seguro de eliminar este pedido del historial?")) return;
            try {
                await deleteDoc(doc(db, "pedidos", docId));
                window.cerrarModalPedido();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
            } catch (error) {
                console.error(error);
                alert("No se pudo eliminar el pedido.");
            }
        };

        // 💰 PANEL DE LIQUIDACIÓN DE MOTORIZADOS
        window.abrirLiquidacionMotorizados = function() {
            const lista = document.getElementById('lista-viajes-pendientes');
            let viajesJhon = []; let totalJhon = 0;
            let viajesBryan = []; let totalBryan = 0;

            // Revisar la memoria local de pedidos
            for (const docId in window.pedidosDBLocal) {
                const ped = window.pedidosDBLocal[docId];
                
                // 🚀 CORRECCIÓN: Ahora busca cualquier pedido que tenga a un chofer asignado, omitiendo clones huérfanos
                if (ped.motorizado && ped.motorizado !== '' && ped.pagoMotorizadoEstatus !== 'Pagado' && (!ped.cliente || !ped.cliente.includes('RUTA MAESTRA MULTIPARADA'))) {
                    if (ped.motorizado === 'Jhon') {
                        viajesJhon.push({ id: docId, ...ped });
                        totalJhon += (parseFloat(ped.tarifaMotorizado) || 0);
                    } else if (ped.motorizado === 'Bryan') {
                        viajesBryan.push({ id: docId, ...ped });
                        totalBryan += (parseFloat(ped.tarifaMotorizado) || 0);
                    }
                }
            }

            // Construir HTML del resumen
            let html = '';
            
            const generarBloque = (nombre, viajes, total) => {
                if(viajes.length === 0) return '';
                let filas = viajes.map(v => `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding:4px 0; font-size:12px;"><span>${v.fecha} | ${v.tracking || 'Sin guía'} - ${v.cliente}</span> <strong>$${(v.tarifaMotorizado || 0).toFixed(2)}</strong></div>`).join('');
                return `
                    <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #333; display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-motorcycle"></i> Viajes de ${nombre}</span>
                            <strong style="color:#d9534f;">Deuda: $${total.toFixed(2)}</strong>
                        </h4>
                        ${filas}
                        <button onclick="marcarMotorizadoPagado('${nombre}')" style="margin-top: 10px; width: 100%; background: #28a745; color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                            <i class="fas fa-check-double"></i> Marcar semana como PAGADA a ${nombre}
                        </button>
                    </div>
                `;
            };

            html += generarBloque('Jhon', viajesJhon, totalJhon);
            html += generarBloque('Bryan', viajesBryan, totalBryan);

            if(html === '') html = '<div style="text-align:center; padding:20px; color:#666;">No hay viajes de motorizados pendientes por liquidar.</div>';

            lista.innerHTML = html;
            document.getElementById('modal-liquidar-motorizados').style.display = 'flex';
        };

        window.marcarMotorizadoPagado = async function(nombreChofer) {
            if(!confirm(`¿Estás seguro de marcar todos los viajes pendientes de ${nombreChofer} como PAGADOS?`)) return;
            
            try {
                // Actualizamos todos los que correspondan
                for (const docId in window.pedidosDBLocal) {
                    const ped = window.pedidosDBLocal[docId];
                    if (ped.motorizado === nombreChofer && ped.pagoMotorizadoEstatus !== 'Pagado' && (!ped.cliente || !ped.cliente.includes('RUTA MAESTRA MULTIPARADA'))) {
                        await updateDoc(doc(db, "pedidos", docId), { pagoMotorizadoEstatus: 'Pagado' });
                    }
                }
                alert(`¡Semana liquidada para ${nombreChofer} exitosamente!`);
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos(); // Recargar datos frescos
                document.getElementById('modal-liquidar-motorizados').style.display = 'none';
            } catch (error) {
                console.error(error);
                alert("Hubo un error al intentar marcar los pagos.");
            }
        };

        // ==========================================
        // 🚀 LÓGICA PARA EDITAR FACTURA
        // ==========================================
        window.abrirModalEditarFactura = function(docId) {
            const fac = window.facturasDBLocal[docId];
            if(!fac) return;
            document.getElementById('edit-fac-id').value = docId;
            document.getElementById('edit-fac-nro').value = fac.nro || '';
            document.getElementById('edit-fac-fecha').value = fac.fecha || '';
            
            const container = document.getElementById('edit-fac-items-container');
            container.innerHTML = '';
            
            if (fac.items && fac.items.length > 0) {
                fac.items.forEach((item, index) => {
                    const cant = parseFloat(item.cantidad) || 1;
                    const preU = parseFloat(item.precioUnitario) || 0;
                    const preTotal = (cant * preU).toFixed(2);
                    
                    const div = document.createElement('div');
                    div.style = "background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 10px;";
                    div.innerHTML = `
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px;">Descripción del Repuesto</label>
                            <input type="text" class="edit-item-desc" value="${item.descripcion || ''}">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Cantidad</label>
                                <input type="number" step="0.01" class="edit-item-cant" value="${cant}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Precio Total ($)</label>
                                <input type="number" step="0.01" class="edit-item-preciototal" value="${preTotal}">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="font-size: 12px; color: #999;">Esta factura no tiene productos detallados.</p>';
            }

            document.getElementById('modal-editar-factura').style.display = 'flex';
        };

        window.guardarEdicionFactura = async function() {
            const docId = document.getElementById('edit-fac-id').value;
            const nuevoNro = document.getElementById('edit-fac-nro').value.trim();
            const nuevaFecha = document.getElementById('edit-fac-fecha').value.trim();
            
            if(!nuevoNro) { alert("El número de factura no puede estar vacío."); return; }

            const fac = window.facturasDBLocal[docId];
            if(!fac) return;

            let updatedItems = [];
            let newSubtotal = 0;
            
            // Reconstruir items si existen
            if (fac.items && fac.items.length > 0) {
                const descInputs = document.querySelectorAll('.edit-item-desc');
                const cantInputs = document.querySelectorAll('.edit-item-cant');
                const precioTotalInputs = document.querySelectorAll('.edit-item-preciototal');
                
                for(let i = 0; i < fac.items.length; i++) {
                    let oldItem = fac.items[i];
                    let desc = descInputs[i] ? descInputs[i].value.trim() : oldItem.descripcion;
                    let cant = cantInputs[i] ? parseFloat(cantInputs[i].value) : parseFloat(oldItem.cantidad);
                    let oldCant = parseFloat(oldItem.cantidad) || 1;
                    let oldPreU = parseFloat(oldItem.precioUnitario) || 0;
                    let preTotal = precioTotalInputs[i] ? parseFloat(precioTotalInputs[i].value) : (oldCant * oldPreU);
                    
                    if(isNaN(cant) || cant <= 0) cant = 1;
                    if(isNaN(preTotal) || preTotal < 0) preTotal = 0;
                    
                    let precioUnitario = preTotal / cant;
                    
                    updatedItems.push({
                        ...oldItem,
                        descripcion: desc,
                        cantidad: cant,
                        precioUnitario: precioUnitario
                    });
                    newSubtotal += preTotal;
                }
            } else {
                updatedItems = fac.items || [];
                newSubtotal = parseFloat(fac.subtotal) || 0;
            }

            // Recalcular Total e IVA (respetando los descuentos existentes)
            let descuento = parseFloat(fac.descuento) || 0;
            let baseImp = newSubtotal - descuento;
            let currentIva = parseFloat(fac.iva) || 0;
            let iva = 0;
            if (currentIva > 0 && parseFloat(fac.subtotal) > 0) {
                // Hay IVA, calculamos el % original
                let ivaPorcentaje = currentIva / (parseFloat(fac.subtotal) - descuento);
                iva = baseImp * ivaPorcentaje;
            }
            let newTotal = baseImp + iva;

            try {
                let updateData = {
                    nro: nuevoNro,
                    fecha: nuevaFecha,
                    items: updatedItems,
                    subtotal: newSubtotal.toFixed(2),
                    total: newTotal.toFixed(2)
                };
                if(currentIva > 0) { updateData.iva = iva.toFixed(2); }

                await updateDoc(doc(db, "facturas", docId), updateData);
                
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("EDITAR DETALLE DE FACTURA", "Se modificó el producto/precio de la factura #" + nuevoNro);
                }

                document.getElementById('modal-editar-factura').style.display = 'none';
                window.cargarHistorialFacturas();
                window.cargarFinanzas();
            } catch (error) {
                console.error("Error editando factura:", error);
                alert("Hubo un error al guardar los cambios.");
            }
        };

        // ==========================================
        // 🏍️ LÓGICA DE CXC PERSONAL Y MOTORIZADOS
        // ==========================================
        window.agregarCxCPersonal = async function() {
            const concepto = SecuritySanitizer.cleanText(document.getElementById('cxc-pers-concepto').value, 100);
            const moneda = SecuritySanitizer.cleanText(document.getElementById('cxc-pers-moneda').value, 10);
            const monto = SecuritySanitizer.sanitizeAmount(document.getElementById('cxc-pers-monto').value);

            if (!concepto || isNaN(monto) || monto <= 0) {
                alert("Por favor ingresa a quién se le cobra (concepto) y un monto válido.");
                return;
            }

            try {
                // Creamos una nueva colección exclusiva para el personal
                await addDoc(collection(db, "cxc_personal"), {
                    concepto: concepto,
                    moneda: moneda,
                    monto: monto,
                    fechaCreacion: new Date().toISOString(),
                    estado: 'Pendiente'
                });
                
                document.getElementById('cxc-pers-concepto').value = '';
                document.getElementById('cxc-pers-monto').value = '';
                window.cargarCxCPersonal();
            } catch (error) {
                console.error("Error agregando CxC Personal:", error);
                alert("Error al guardar la deuda.");
            }
        };

        window.cargarCxCPersonal = async function() {
            const lista = document.getElementById('lista-cxc-personal');
            if (!lista) return;

            lista.innerHTML = '<div style="padding:15px; text-align:center; color:#666;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

            try {
                const q = query(collection(db, "cxc_personal"), where("estado", "==", "Pendiente"));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    lista.innerHTML = '<div style="padding: 15px; text-align: center; color: #666; font-size: 13px;">No hay deudas de personal pendientes.</div>';
                    return;
                }

                let html = '';
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    let simbolo = '$';
                    if (data.moneda.includes('Bs')) simbolo = 'Bs';
                    if (data.moneda.includes('€')) simbolo = '€';

                    html += `
                        <div style="display: flex; padding: 10px; border-bottom: 1px solid #eee; align-items: center; font-size: 13px;">
                            <div style="flex: 2; font-weight: bold; color: #333;">${data.concepto}</div>
                            <div style="flex: 1; text-align: center; font-weight: bold; color: #d9534f;">${simbolo}${data.monto.toFixed(2)}</div>
                            <div style="flex: 1; text-align: center;">
                                <button onclick="cobrarCxCPersonal('${docSnap.id}')" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight:bold;">
                                    <i class="fas fa-check-double"></i> Recibido
                                </button>
                            </div>
                        </div>
                    `;
                });
                lista.innerHTML = html;
            } catch (error) {
                console.error("Error cargando CxC Personal:", error);
                lista.innerHTML = '<div style="padding:15px; text-align:center; color:red;">Error al cargar.</div>';
            }
        };

        window.cobrarCxCPersonal = async function(docId) {
            if (!confirm("¿Confirmas que este dinero ya fue entregado/devuelto por el personal?")) return;
            try {
                await updateDoc(doc(db, "cxc_personal", docId), {
                    estado: 'Cobrado',
                    fechaCobro: new Date().toISOString()
                });
                window.cargarCxCPersonal();
            } catch (error) {
                console.error("Error al cobrar:", error);
                alert("Hubo un error al procesar el cobro.");
            }
        };
        


        // 🚀 CORRECCIÓN DEFINITIVA DE GUÍAS (FORZAR LECTURA DE CAJAS NUEVAS)
        window.abrirModalPedido = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if(!ped) return;
            
            document.getElementById('edit-pedido-id').value = docId;
            document.getElementById('edit-pedido-email').value = ped.email || '';
            document.getElementById('edit-pedido-cliente').value = ped.cliente || '';
            
            const envioSelect = document.getElementById('edit-pedido-envio');
            if (ped.envio === "Encomienda Tealca") envioSelect.value = "Encomienda Tealca/Zoom";
            else envioSelect.value = ped.envio || 'Retiro en Local';
            
            let valAgencia = ped.tracking ? ped.tracking.trim() : '';
            let valMot = ped.trackingMotorizado ? ped.trackingMotorizado.trim() : '';
            
            // Si es Motorizado y la guía se quedó atrapada en la agencia, sácala de ahí
            if (envioSelect.value.includes('Motorizado')) {
                if (valAgencia !== '' && valMot === '') { valMot = valAgencia; valAgencia = ''; }
            } else if (valAgencia.toUpperCase().includes('MOT') && valMot === '') {
                valMot = valAgencia; valAgencia = '';
            }

            document.getElementById('edit-pedido-tracking').value = valAgencia;
            document.getElementById('edit-pedido-tracking-mot').value = valMot;
            document.getElementById('edit-pedido-estado').value = ped.estado || 'Pendiente';
            
            document.getElementById('edit-pedido-motorizado').value = ped.motorizado || '';
            document.getElementById('edit-pedido-tarifa').value = ped.tarifaMotorizado || '';
            document.getElementById('edit-pedido-ruta').value = ped.rutasMotorizado || '';
            
            window.mostrarOpcionesMotorizado();

            const container = document.getElementById('edit-pedido-productos-container');
            container.innerHTML = '';
            
            let productosList = [];
            if (ped.productos && Array.isArray(ped.productos)) {
                productosList = ped.productos;
            } else if (ped.producto) {
                // Formato antiguo
                let preUni = (parseFloat(ped.total) || 0) / (parseFloat(ped.cantidad) || 1);
                productosList = [{ nombre: ped.producto, cantidad: ped.cantidad, precio: preUni }];
            }

            if (productosList.length > 0) {
                productosList.forEach((prod, index) => {
                    const cant = parseFloat(prod.cantidad) || 1;
                    const preUnitario = parseFloat(prod.precio) || 0;
                    const preTotal = (cant * preUnitario).toFixed(2);
                    
                    const div = document.createElement('div');
                    div.style = "background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 10px;";
                    div.innerHTML = `
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px;">Descripción del Repuesto</label>
                            <input type="text" class="edit-ped-item-desc" value="${prod.nombre || ''}">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Cantidad</label>
                                <input type="number" step="0.01" class="edit-ped-item-cant" value="${cant}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0; flex: 1;">
                                <label style="font-size: 11px;">Precio Total ($)</label>
                                <input type="number" step="0.01" class="edit-ped-item-preciototal" value="${preTotal}">
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="font-size: 12px; color: #999;">Este pedido no tiene productos registrados.</p>';
            }

            document.getElementById('modal-pedido').style.display = 'flex';
        };

        window.guardarCambiosPedido = async function() {
            const docId = document.getElementById('edit-pedido-id').value;
            const pedOriginal = window.pedidosDBLocal[docId] || {};
            const btn = document.getElementById('btn-save-pedido');
            btn.innerHTML = "Guardando..."; btn.disabled = true;

            let trackingVal = document.getElementById('edit-pedido-tracking').value.trim();
            let trackingMotVal = document.getElementById('edit-pedido-tracking-mot').value.trim();
            const envioVal = document.getElementById('edit-pedido-envio').value;
            const motorizadoVal = document.getElementById('edit-pedido-motorizado').value;
            const tarifaVal = parseFloat(document.getElementById('edit-pedido-tarifa').value) || 0;

            if (envioVal.includes('Motorizado')) {
                if (trackingVal !== '' && trackingMotVal === '') trackingMotVal = trackingVal;
                trackingVal = ''; 
            }

            if (!envioVal.includes('Retiro') && motorizadoVal !== '' && trackingMotVal === '') {
                const aleatorio = Math.floor(1000 + Math.random() * 9000);
                const letMot = motorizadoVal.substring(0,1).toUpperCase();
                trackingMotVal = `MOT${letMot}-${aleatorio}`;
            }

            let updatedProductos = [];
            let newTotal = 0;
            const descInputs = document.querySelectorAll('.edit-ped-item-desc');
            const cantInputs = document.querySelectorAll('.edit-ped-item-cant');
            const precioTotalInputs = document.querySelectorAll('.edit-ped-item-preciototal');
            
            for(let i = 0; i < descInputs.length; i++) {
                let desc = descInputs[i].value.trim();
                let cant = parseFloat(cantInputs[i].value) || 1;
                let preTotal = parseFloat(precioTotalInputs[i].value) || 0;
                
                if(cant <= 0) cant = 1;
                let precioUnitario = preTotal / cant;
                
                updatedProductos.push({
                    nombre: desc,
                    cantidad: cant,
                    precio: precioUnitario
                });
                newTotal += preTotal;
            }

            const datosActualizados = {
                email: document.getElementById('edit-pedido-email').value.trim(),
                cliente: document.getElementById('edit-pedido-cliente').value.trim(),
                envio: envioVal,
                tracking: trackingVal,
                trackingMotorizado: trackingMotVal,
                estado: document.getElementById('edit-pedido-estado').value,
                motorizado: motorizadoVal,
                tarifaMotorizado: tarifaVal,
                pagoMotorizadoEstatus: motorizadoVal ? (pedOriginal.pagoMotorizadoEstatus || 'Pendiente') : '',
                rutasMotorizado: document.getElementById('edit-pedido-ruta').value.trim(),
                productos: updatedProductos.length > 0 ? updatedProductos : pedOriginal.productos,
                total: updatedProductos.length > 0 ? newTotal.toFixed(2) : pedOriginal.total
            };

            // Remover campos legacy para no causar ruido si existian
            datosActualizados.producto = null;
            datosActualizados.cantidad = null;

            try {
                // Se limpian los nulls
                for (let key in datosActualizados) {
                    if (datosActualizados[key] === null) delete datosActualizados[key];
                }
                
                await updateDoc(doc(db, "pedidos", docId), datosActualizados);
                
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("EDITAR DETALLE DE PEDIDO", "Se modificó logística/producto del pedido: " + datosActualizados.cliente);
                }
                
                window.cerrarModalPedido();
                window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; window.cargarPedidos();
                window.cargarDashboard();
            } catch (error) { 
                console.error(error); 
                alert("Error al actualizar la información del pedido."); 
            }
            btn.innerHTML = "Guardar"; btn.disabled = false;
        };

        // 🚀 FUNCIÓN PARA CONVERTIR COTIZACIÓN EN PEDIDO
        window.enviarCotizacionAPedido = function(docId) {
            const cot = window.cotizacionesDBLocal[docId];
            if(!cot) return;

            // 1. Verificación de Seguridad (Aprobada)
            if(cot.estatusComercial !== 'Aprobada') {
                if(!confirm(`⚠️ Esta cotización está en estatus "${cot.estatusComercial}".\n¿Estás seguro de que deseas procesarla como un Pedido de todas formas?`)) {
                    return;
                }
            }

            // 2. Cambiar a la pestaña de Pedidos
            const btnPedidos = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes('Gestión de Pedidos'));
            if(btnPedidos) {
                window.mostrarPestana('pedidos', btnPedidos);
            }

            // 3. Llenar los datos del cliente
            document.getElementById('client-name').value = cot.cliente || '';
            document.getElementById('client-email').value = cot.telefono || ''; 
            
            // Opcional: Intentar autoseleccionar el cliente si existe en el selector
            const selectPedido = document.getElementById('ped-selector-clientes');
            for(let i = 0; i < selectPedido.options.length; i++) {
                if(selectPedido.options[i].text.toUpperCase().includes(cot.cliente.toUpperCase())) {
                    selectPedido.selectedIndex = i;
                    break;
                }
            }

            // 4. Trasladar los repuestos al carrito de Pedidos
            const container = document.getElementById('pedidos-items-container');
            container.innerHTML = ''; // Limpiar cualquier pedido a medias
            
            if(cot.items && Array.isArray(cot.items)) {
                cot.items.forEach(prod => {
                    const row = document.createElement('div');
                    row.className = 'pedido-item-row';
                    
                    // Extraemos los valores de la cotización
                    const cant = parseInt(prod.cantidad) || 1;
                    const precioUnit = parseFloat(prod.precioUnitario) || 0;
                    const descuentoLinea = parseFloat(prod.descuento) || 0;
                    
                    // Calculamos el precio real (restándole el descuento proporcional si le hiciste descuento en la cotización)
                    const precioFinalReal = precioUnit - (descuentoLinea / cant);
                    const safeDesc = (prod.descripcion || '').replace(/"/g, '&quot;');

                    row.innerHTML = `
                        <input type="number" class="ped-item-cant" value="${cant}" min="1" placeholder="Cant" oninput="calcularTotalPedido()">
                        <input type="text" class="ped-item-desc" value="${safeDesc}" placeholder="Descripción" style="grid-column: span 3;">
                        <input type="number" step="0.01" class="ped-item-precio" value="${precioFinalReal.toFixed(2)}" placeholder="Precio" oninput="calcularTotalPedido()">
                        <button type="button" onclick="this.parentElement.remove(); calcularTotalPedido();" style="background:#d9534f; color:white; border:none; border-radius:4px; cursor:pointer;"><i class="fas fa-times"></i></button>
                    `;
                    container.appendChild(row);
                });
            }

            // 5. Recalcular el total y avisar al usuario
            window.calcularTotalPedido();
            alert("✅ Cotización enviada a Pedidos con éxito.\nRevisa los datos, selecciona el Motorizado/Encomienda y haz clic en 'Registrar Pedido'.");
            
            // Hacer scroll hacia arriba para que el usuario vea el formulario
            const elScroll = document.getElementById('tab-pedidos') || document.querySelector('main');
            if (elScroll && typeof elScroll.scrollIntoView === 'function') {
                elScroll.scrollIntoView({ behavior: 'smooth' });
            }
        };

        // ==========================================
        // 🚀 LÓGICA MULTIPARADA, PAGOS Y RADAR GPS (VERSIÓN A COLOR)
        // ==========================================
        window.mapaAdmin = null;
        window.marcadorTemporal = null;
        window.marcadoresGuardados = [];
        window.rutaEnConstruccion = []; 
        window.marcadoresConstruccion = []; 
        window.rutasAgrupadasLocal = {}; 
        window.marcadoresMotos = {};

        // 🎨 DICCIONARIO DE COLORES OFICIALES
        window.coloresMotorizados = {
            "Jhon": "#1d6fa5",   // Azul Logística
            "Bryan": "#28a745",  // Verde Ventas
            "Moto A": "#f0ad4e", // Naranja
            "Moto B": "#d9534f", // Rojo
            "Moto C": "#8e44ad"  // Morado
        };

        window.iniciarMapaAdmin = function() {
            if(window.mapaAdmin) { window.mapaAdmin.invalidateSize(); return; }
            window.mapaAdmin = L.map('admin-map').setView([10.4806, -66.9036], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(window.mapaAdmin);

            window.mapaAdmin.on('click', function(e) {
                const lat = e.latlng.lat.toFixed(5);
                const lng = e.latlng.lng.toFixed(5);
                document.getElementById('ruta-lat').value = lat;
                document.getElementById('ruta-lng').value = lng;

                if(window.marcadorTemporal) window.mapaAdmin.removeLayer(window.marcadorTemporal);
                window.marcadorTemporal = L.marker([lat, lng]).addTo(window.mapaAdmin).bindPopup("<b>Fijar coordenada</b><br>Llena los datos a la izquierda").openPopup();
            });

            window.iniciarRastreoMotorizados();
        };

        window.iniciarRastreoMotorizados = function() {
            setInterval(async () => {
                if(!window.mapaAdmin) return;
                try {
                    const snap = await getDocs(collection(db, "choferes_gps"));
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        const chofer = docSnap.id;
                        
                        // Obtenemos el color del chofer (si no existe, usa gris oscuro)
                        const colorChofer = window.coloresMotorizados[chofer] || "#333";
                        
                        // 🛵 Creamos el Icono de la Moto con el color de fondo dinámico
                        const motoHtml = `<div style="background-color: ${colorChofer}; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); color: white; font-size: 16px;"><i class="fas fa-motorcycle"></i></div>`;
                        const motoIconColor = L.divIcon({ className: '', html: motoHtml, iconSize: [34, 34], iconAnchor: [17, 17] });

                        if (Date.now() - data.timestamp < 600000) { // Activo en los últimos 10 minutos
                            if (!window.marcadoresMotos[chofer]) {
                                window.marcadoresMotos[chofer] = L.marker([data.lat, data.lng], {icon: motoIconColor})
                                    .addTo(window.mapaAdmin)
                                    .bindPopup(`<div style="text-align:center;"><b>🏍️ ${chofer}</b><br><span style="color:${colorChofer}; font-weight:bold;">En Ruta</span><br><span style="font-size:10px;color:#666;">Señal: ${data.hora}</span></div>`);
                            } else {
                                window.marcadoresMotos[chofer].setLatLng([data.lat, data.lng]);
                                window.marcadoresMotos[chofer].setIcon(motoIconColor); // Actualizamos color por si cambió
                                window.marcadoresMotos[chofer].getPopup().setContent(`<div style="text-align:center;"><b>🏍️ ${chofer}</b><br><span style="color:${colorChofer}; font-weight:bold;">En Ruta</span><br><span style="font-size:10px;color:#666;">Señal: ${data.hora}</span></div>`);
                            }
                        }
                    });
                } catch(e) { console.warn("Error en radar GPS:", e); }
            }, 5000);
        };

        // ==========================================
        // 🧾 GESTIÓN DE COMPROBANTES DE PAGO (FIREBASE STORAGE)
        // ==========================================
        window._comprobanteUrlEnEdicion = '';

        window.limpiarArchivoComprobante = function() {
            const input = document.getElementById('archivoComprobante');
            if (input) input.value = '';
            const preview = document.getElementById('preview-archivo-comprobante');
            if (preview) preview.style.display = 'none';
            const nombre = document.getElementById('nombre-archivo-comprobante');
            if (nombre) nombre.textContent = '';
            const labelTexto = document.getElementById('label-comprobante-texto');
            if (labelTexto) labelTexto.textContent = 'Subir Comprobante';
            window._comprobanteUrlEnEdicion = '';
        };

        window.subirComprobanteStorage = async function(archivo) {
            if (!archivo) return '';
            try {
                const timestamp = Date.now();
                const extension = archivo.name ? archivo.name.split('.').pop() : 'jpg';
                const cleanName = archivo.name ? archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'comprobante.jpg';
                const fileRef = storageRef(storage, `comprobantes/${timestamp}_${cleanName}`);
                
                const metadata = {
                    contentType: archivo.type || (extension.toLowerCase() === 'pdf' ? 'application/pdf' : 'image/jpeg')
                };
                
                const snapshot = await uploadBytes(fileRef, archivo, metadata);
                const downloadURL = await getDownloadURL(snapshot.ref);
                return downloadURL;
            } catch (error) {
                console.error("Error al subir comprobante a Firebase Storage:", error);
                throw error;
            }
        };

        window.inicializarEventosComprobante = function() {
            const selectPago = document.getElementById('stop-pago');
            const contComprobante = document.getElementById('contenedor-comprobante');
            const inputArchivo = document.getElementById('archivoComprobante');

            if (selectPago && contComprobante) {
                const toggleVisibility = () => {
                    if (selectPago.value === 'Pagado') {
                        contComprobante.style.display = 'block';
                    } else {
                        contComprobante.style.display = 'none';
                        window.limpiarArchivoComprobante();
                    }
                };
                selectPago.addEventListener('change', toggleVisibility);
                toggleVisibility(); // Comprobar estado inicial
            }

            if (inputArchivo) {
                inputArchivo.addEventListener('change', function() {
                    const preview = document.getElementById('preview-archivo-comprobante');
                    const nombre = document.getElementById('nombre-archivo-comprobante');
                    const labelTexto = document.getElementById('label-comprobante-texto');
                    if (this.files && this.files[0]) {
                        const file = this.files[0];
                        if (nombre) nombre.textContent = file.name;
                        if (preview) preview.style.display = 'flex';
                        if (labelTexto) labelTexto.textContent = 'Cambiar archivo';
                    } else {
                        if (preview) preview.style.display = 'none';
                        if (nombre) nombre.textContent = '';
                        if (labelTexto) labelTexto.textContent = 'Subir Comprobante';
                    }
                });
            }
        };
        try { window.inicializarEventosComprobante(); } catch(e){}

        window.agregarParadaTemporal = async function() {
            const lat = document.getElementById('ruta-lat').value;
            const lng = document.getElementById('ruta-lng').value;
            const nota = document.getElementById('stop-nota').value.trim();
            const pagoDinero = parseFloat(document.getElementById('stop-pago-dinero').value) || 0; 
            const estadoPago = document.getElementById('stop-pago').value;
            
            if(!lat || !lng || !nota) { alert("⚠️ Haz clic en el mapa y escribe qué hará el motorizado."); return; }

            const inputArchivo = document.getElementById('archivoComprobante');
            const archivo = inputArchivo && inputArchivo.files && inputArchivo.files[0] ? inputArchivo.files[0] : null;
            let comprobanteUrl = window._comprobanteUrlEnEdicion || '';

            // 🛡️ PROTOCOLO DE SEGURIDAD: Manejo de estado "Cargando..." durante subida
            if (estadoPago === 'Pagado' && archivo) {
                const btnAgregar = document.querySelector('button[onclick="agregarParadaTemporal()"]');
                const spinnerStatus = document.getElementById('spinner-subiendo-comprobante');
                
                if (btnAgregar) {
                    btnAgregar.disabled = true;
                    btnAgregar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo comprobante a Storage...';
                }
                if (spinnerStatus) spinnerStatus.style.display = 'block';

                try {
                    comprobanteUrl = await window.subirComprobanteStorage(archivo);
                } catch (error) {
                    alert("❌ Error al subir el comprobante a Storage: " + (error.message || error));
                    if (btnAgregar) {
                        btnAgregar.disabled = false;
                        btnAgregar.innerHTML = '<i class="fas fa-plus"></i> Agregar Parada a la Ruta';
                    }
                    if (spinnerStatus) spinnerStatus.style.display = 'none';
                    return;
                } finally {
                    if (btnAgregar) {
                        btnAgregar.disabled = false;
                        btnAgregar.innerHTML = '<i class="fas fa-plus"></i> Agregar Parada a la Ruta';
                    }
                    if (spinnerStatus) spinnerStatus.style.display = 'none';
                }
            } else if (estadoPago !== 'Pagado') {
                comprobanteUrl = '';
            }

            const parada = {
                lat: parseFloat(lat), lng: parseFloat(lng),
                tipo: document.getElementById('stop-tipo').value,
                pago: estadoPago,
                tlf: document.getElementById('stop-tlf').value.trim() || 'Sin teléfono',
                confianza: document.getElementById('stop-confianza').value,
                pagoDinero: pagoDinero,
                nota: nota,
                comprobanteUrl: comprobanteUrl
            };

            window.rutaEnConstruccion.push(parada);
            
            if(window.marcadorTemporal) window.mapaAdmin.removeLayer(window.marcadorTemporal);
            window.marcadorTemporal = null;
            
            const marker = L.marker([lat, lng]).addTo(window.mapaAdmin).bindPopup(`<b>Parada ${window.rutaEnConstruccion.length}</b><br>${parada.tipo}: ${parada.nota}`);
            window.marcadoresConstruccion.push(marker);

            window.actualizarListaRutaUI();
            
            document.getElementById('stop-nota').value = '';
            document.getElementById('stop-tlf').value = '';
            document.getElementById('ruta-lat').value = '';
            document.getElementById('ruta-lng').value = '';
            document.getElementById('stop-pago-dinero').value = '';
            
            window.limpiarArchivoComprobante();
            window._comprobanteUrlEnEdicion = '';
        };

        window.actualizarListaRutaUI = function() {
            const container = document.getElementById('lista-ruta-temp');
            let totalAuto = 0; 

            if(window.rutaEnConstruccion.length === 0) {
                container.innerHTML = '<span style="color: #999;">Ruta vacía. Agrega la primera parada.</span>';
                document.getElementById('ruta-pago').value = '';
                return;
            }
            let html = '';
            const totalParadas = window.rutaEnConstruccion.length;

            window.rutaEnConstruccion.forEach((p, i) => {
                const icon = p.tipo === 'Retiro' ? '🟢' : '🔵';
                totalAuto += (p.pagoDinero || 0); 

                const comprobanteLink = p.comprobanteUrl ? 
                    `<a href="${p.comprobanteUrl}" target="_blank" style="color:#0284c7; text-decoration:underline; font-weight:bold; font-size:10px; margin-left:4px;" title="Ver Comprobante"><i class="fas fa-receipt"></i> Comprobante</a>` : '';

                const btnSubir = i > 0 
                    ? `<button type="button" onclick="moverParadaSubir(${i})" style="background:#6c757d; color:white; border:none; padding:4px 7px; border-radius:4px; cursor:pointer; font-size:10px; transition:background 0.2s;" title="Subir parada"><i class="fas fa-arrow-up"></i></button>` 
                    : '';

                const btnBajar = i < totalParadas - 1 
                    ? `<button type="button" onclick="moverParadaBajar(${i})" style="background:#6c757d; color:white; border:none; padding:4px 7px; border-radius:4px; cursor:pointer; font-size:10px; transition:background 0.2s;" title="Bajar parada"><i class="fas fa-arrow-down"></i></button>` 
                    : '';

                const btnEditar = `<button type="button" onclick="editarParada(${i})" style="background:#1d6fa5; color:white; border:none; padding:4px 7px; border-radius:4px; cursor:pointer; font-size:10px; transition:background 0.2s;" title="Editar parada"><i class="fas fa-pencil-alt"></i></button>`;

                const btnEliminar = `<button type="button" onclick="eliminarParadaTemporal(${i})" style="background:#d9534f; color:white; border:none; padding:4px 7px; border-radius:4px; cursor:pointer; font-size:10px; transition:background 0.2s;" title="Borrar parada"><i class="fas fa-times"></i></button>`;

                html += `<div style="margin-bottom:6px; border-bottom: 1px solid #eee; padding-bottom: 6px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <div style="flex:1; min-width:0;">
                                <strong style="font-size:11px;">${icon} Parada ${i+1}:</strong> <span style="font-size:11px; color:#222;">${p.nota}</span><br>
                                <span style="color:#666; font-size:10px;">📞 ${p.tlf} | Estatus: ${p.pago}${comprobanteLink}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                                <strong style="color:#28a745; font-size:11px; margin-right:4px;">$${(p.pagoDinero || 0).toFixed(2)}</strong>
                                ${btnSubir}
                                ${btnBajar}
                                ${btnEditar}
                                ${btnEliminar}
                            </div>
                         </div>`;
            });
            container.innerHTML = html;
            document.getElementById('ruta-pago').value = totalAuto.toFixed(2);
        };

        window.moverParadaSubir = function(index) {
            if (index <= 0 || index >= window.rutaEnConstruccion.length) return;
            const temp = window.rutaEnConstruccion[index];
            window.rutaEnConstruccion[index] = window.rutaEnConstruccion[index - 1];
            window.rutaEnConstruccion[index - 1] = temp;

            if (window.mapaAdmin) {
                window.marcadoresConstruccion.forEach(m => window.mapaAdmin.removeLayer(m));
                window.marcadoresConstruccion = [];
                window.rutaEnConstruccion.forEach((p, i) => {
                    const marker = L.marker([p.lat, p.lng]).addTo(window.mapaAdmin).bindPopup(`<b>Parada ${i+1}</b><br>${p.tipo}: ${p.nota}`);
                    window.marcadoresConstruccion.push(marker);
                });
            }

            window.actualizarListaRutaUI();
        };

        window.moverParadaBajar = function(index) {
            if (index < 0 || index >= window.rutaEnConstruccion.length - 1) return;
            const temp = window.rutaEnConstruccion[index];
            window.rutaEnConstruccion[index] = window.rutaEnConstruccion[index + 1];
            window.rutaEnConstruccion[index + 1] = temp;

            if (window.mapaAdmin) {
                window.marcadoresConstruccion.forEach(m => window.mapaAdmin.removeLayer(m));
                window.marcadoresConstruccion = [];
                window.rutaEnConstruccion.forEach((p, i) => {
                    const marker = L.marker([p.lat, p.lng]).addTo(window.mapaAdmin).bindPopup(`<b>Parada ${i+1}</b><br>${p.tipo}: ${p.nota}`);
                    window.marcadoresConstruccion.push(marker);
                });
            }

            window.actualizarListaRutaUI();
        };

        window.editarParada = function(index) {
            const parada = window.rutaEnConstruccion[index];
            if (!parada) return;

            // Rellenar formulario superior con los datos de la parada
            const elTipo = document.getElementById('stop-tipo');
            if (elTipo) elTipo.value = parada.tipo || 'Retiro';

            const elPagoDinero = document.getElementById('stop-pago-dinero');
            if (elPagoDinero) elPagoDinero.value = (parada.pagoDinero !== undefined && parada.pagoDinero !== null) ? parada.pagoDinero : '';

            const elNota = document.getElementById('stop-nota');
            if (elNota) elNota.value = parada.nota || '';

            const elTlf = document.getElementById('stop-tlf');
            if (elTlf) elTlf.value = (parada.tlf && parada.tlf !== 'Sin teléfono') ? parada.tlf : '';

            const elPago = document.getElementById('stop-pago');
            if (elPago) elPago.value = parada.pago || 'Pagado';

            // Restaurar estado de comprobante si aplica
            if (parada.pago === 'Pagado') {
                const contComprobante = document.getElementById('contenedor-comprobante');
                if (contComprobante) contComprobante.style.display = 'block';
                if (parada.comprobanteUrl) {
                    window._comprobanteUrlEnEdicion = parada.comprobanteUrl;
                    const preview = document.getElementById('preview-archivo-comprobante');
                    if (preview) preview.style.display = 'flex';
                    const nombre = document.getElementById('nombre-archivo-comprobante');
                    if (nombre) nombre.textContent = 'Comprobante guardado';
                    const labelTexto = document.getElementById('label-comprobante-texto');
                    if (labelTexto) labelTexto.textContent = 'Cambiar comprobante';
                }
            } else {
                window.limpiarArchivoComprobante();
            }

            const elConfianza = document.getElementById('stop-confianza');
            if (elConfianza) elConfianza.value = parada.confianza || 'Conocido';

            const elLat = document.getElementById('ruta-lat');
            if (elLat) elLat.value = parada.lat !== undefined ? parada.lat : '';

            const elLng = document.getElementById('ruta-lng');
            if (elLng) elLng.value = parada.lng !== undefined ? parada.lng : '';

            // Mostrar u orientar marcador en el mapa temporal si tiene coordenadas
            if (window.mapaAdmin && parada.lat && parada.lng) {
                if (window.marcadorTemporal) window.mapaAdmin.removeLayer(window.marcadorTemporal);
                window.marcadorTemporal = L.marker([parada.lat, parada.lng]).addTo(window.mapaAdmin)
                    .bindPopup(`<b>Editando Parada</b><br>${parada.tipo}: ${parada.nota}`).openPopup();
                window.mapaAdmin.setView([parada.lat, parada.lng], 14);
            }

            // Eliminar la parada del arreglo y re-renderizar lista, mapa y total
            window.eliminarParadaTemporal(index);

            // Foco en la nota para editar de inmediato
            if (elNota) {
                elNota.focus();
                elNota.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        window.eliminarParadaTemporal = function(index) {
            window.rutaEnConstruccion.splice(index, 1);
            window.marcadoresConstruccion.forEach(m => window.mapaAdmin.removeLayer(m));
            window.marcadoresConstruccion = [];
            window.rutaEnConstruccion.forEach((p, i) => {
                const marker = L.marker([p.lat, p.lng]).addTo(window.mapaAdmin).bindPopup(`<b>Parada ${i+1}</b><br>${p.tipo}: ${p.nota}`);
                window.marcadoresConstruccion.push(marker);
            });
            window.actualizarListaRutaUI();
        };

        // ==========================================
        // 🚀 ASOCIACIÓN DE RUTAS A PEDIDOS EXISTENTES
        // ==========================================
        window.cargarSelectorPedidosRuta = function() {
            const select = document.getElementById('ruta-pedido-asociado');
            if (!select) return;
            const valorPrevio = select.value;
            select.innerHTML = '<option value="">-- Selecciona un Pedido Activo --</option>';

            // Estados que EXCLUIR del selector GPS (ya entregados/completados)
            const estadosExcluidos = ['Entregado', 'Enviado', 'Completado', 'Cancelado'];

            if (window.pedidosDBLocal) {
                Object.keys(window.pedidosDBLocal).forEach(docId => {
                    const ped = window.pedidosDBLocal[docId];
                    if (ped.cliente === "📍 RUTA MAESTRA MULTIPARADA") return;

                    // Filtro estricto: excluir pedidos ya cerrados
                    const estadoPed = (ped.estado || 'Pendiente').trim();
                    if (estadosExcluidos.includes(estadoPed)) return;

                    let productosStr = '';
                    if (ped.productos && Array.isArray(ped.productos)) {
                        productosStr = ped.productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
                    } else if (ped.producto) {
                        productosStr = `${ped.cantidad || 1}x ${ped.producto}`;
                    }

                    const rutaAsignada = (ped.trackingMotorizado && ped.motorizado) ? ` (🏍️ ${ped.motorizado})` : '';
                    const texto = `📦 [${estadoPed}] ${ped.cliente || 'Sin nombre'} ($${Number(ped.total || 0).toFixed(2)}) - ${ped.fecha || ''} [${ped.envio || 'Delivery'}]${rutaAsignada}`;
                    const opt = document.createElement('option');
                    opt.value = docId;
                    opt.textContent = texto;
                    select.appendChild(opt);
                });
            }

            if (valorPrevio) select.value = valorPrevio;
        };

        window.alSeleccionarPedidoRuta = function(pedidoId) {
            const preview = document.getElementById('ruta-pedido-preview');
            if (!pedidoId || !window.pedidosDBLocal || !window.pedidosDBLocal[pedidoId]) {
                if (preview) preview.style.display = 'none';
                return;
            }

            const ped = window.pedidosDBLocal[pedidoId];
            
            let productosStr = '';
            if (ped.productos && Array.isArray(ped.productos)) {
                productosStr = ped.productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
            } else if (ped.producto) {
                productosStr = `${ped.cantidad || 1}x ${ped.producto}`;
            }

            if (preview) {
                preview.style.display = 'block';
                preview.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#1d6fa5; font-size:13px;"><i class="fas fa-user-check"></i> ${ped.cliente || 'Cliente'}</strong>
                        <span style="color:#28a745; font-weight:bold; font-size:13px;">$${Number(ped.total || 0).toFixed(2)}</span>
                    </div>
                    <div style="margin-top:4px; color:#555;">
                        <i class="fas fa-phone"></i> <strong>Contacto:</strong> ${ped.telefono || ped.email || 'Sin teléfono'} | 
                        <i class="fas fa-truck"></i> <strong>Envío:</strong> ${ped.envio || 'Delivery'}
                    </div>
                    <div style="margin-top:4px; color:#333;">
                        <i class="fas fa-boxes"></i> <strong>Repuestos:</strong> ${productosStr || 'N/A'}
                    </div>
                `;
            }

            // Auto-completar campos de parada
            const inputNota = document.getElementById('stop-nota');
            const inputTlf = document.getElementById('stop-tlf');
            const selectTipo = document.getElementById('stop-tipo');
            const selectChofer = document.getElementById('ruta-chofer');

            if (selectTipo) selectTipo.value = "Entrega";
            if (inputNota && (!inputNota.value || inputNota.value.startsWith('Entrega'))) {
                inputNota.value = `Entrega a ${ped.cliente || 'Cliente'}: ${(productosStr || ped.envio || '').substring(0, 45)}`;
            }
            if (inputTlf && (!inputTlf.value || inputTlf.value === 'Sin teléfono')) {
                inputTlf.value = ped.telefono || '';
            }
            if (ped.motorizado && (ped.motorizado === 'Jhon' || ped.motorizado === 'Bryan')) {
                if (selectChofer) selectChofer.value = ped.motorizado;
            }
            if (ped.tarifaMotorizado && parseFloat(ped.tarifaMotorizado) > 0) {
                const inputCostoParada = document.getElementById('stop-pago-dinero');
                if (inputCostoParada && (!inputCostoParada.value || parseFloat(inputCostoParada.value) === 0)) {
                    inputCostoParada.value = parseFloat(ped.tarifaMotorizado).toFixed(2);
                }
            }
        };

        window.cancelarEdicionRuta = function() {
            window.rutaEnConstruccion = [];
            window.marcadoresConstruccion.forEach(m => window.mapaAdmin.removeLayer(m));
            window.marcadoresConstruccion = [];
            window.actualizarListaRutaUI();
            document.getElementById('edit-ruta-id').value = '';
            document.getElementById('ruta-pago').value = '';
            const selectPedido = document.getElementById('ruta-pedido-asociado');
            if (selectPedido) selectPedido.value = '';
            const preview = document.getElementById('ruta-pedido-preview');
            if (preview) preview.style.display = 'none';
            document.getElementById('titulo-ruta').innerHTML = '<i class="fas fa-route"></i> Armar Ruta Multiparada';
            document.getElementById('btn-cancelar-ruta').style.display = 'none';
            document.getElementById('btn-guardar-ruta').innerHTML = '<i class="fab fa-whatsapp"></i> Guardar y Enviar';
            window.limpiarArchivoComprobante();
            window._comprobanteUrlEnEdicion = '';
        };

        window.guardarRutaCompleta = async function() {
            if(window.rutaEnConstruccion.length === 0) { alert("⚠️ La ruta está vacía. Haz clic en el mapa y agrega al menos una parada."); return; }

            const pedidoId = document.getElementById('ruta-pedido-asociado').value;
            if (!pedidoId) {
                alert("⚠️ Debes seleccionar un Pedido o Factura en el selector para asociar esta ruta.\nEsto vincula los datos al cliente y previene duplicados en la liquidación.");
                document.getElementById('ruta-pedido-asociado').focus();
                return;
            }

            const chofer = SecuritySanitizer.cleanText(document.getElementById('ruta-chofer').value, 50);
            const pagoTotal = SecuritySanitizer.sanitizeAmount(document.getElementById('ruta-pago').value);
            const editRutaId = document.getElementById('edit-ruta-id').value;
            const rutaIdMaster = editRutaId ? editRutaId : "RUTA-" + Date.now();
            
            const btn = document.getElementById('btn-guardar-ruta');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando y vinculando...'; btn.disabled = true;

            try {
                if (editRutaId) {
                    const qPuntos = query(collection(db, "rutas_puntos"), where("rutaId", "==", editRutaId));
                    const snapPuntos = await getDocs(qPuntos);
                    snapPuntos.forEach(async (d) => await deleteDoc(d.ref));
                }

                const pedOriginal = window.pedidosDBLocal[pedidoId] || {};
                const paradas = window.rutaEnConstruccion.map((p, i) => ({
                    orden: i + 1,
                    tipo: SecuritySanitizer.cleanText(p.tipo, 30),
                    nota: SecuritySanitizer.cleanNote(p.nota, 200),
                    tlf: SecuritySanitizer.cleanPhone(p.tlf),
                    pago: SecuritySanitizer.cleanText(p.pago, 50),
                    confianza: SecuritySanitizer.cleanText(p.confianza, 50),
                    pagoDinero: SecuritySanitizer.sanitizeAmount(p.pagoDinero),
                    lat: typeof p.lat === 'number' ? p.lat : parseFloat(p.lat) || 0,
                    lng: typeof p.lng === 'number' ? p.lng : parseFloat(p.lng) || 0,
                    comprobanteUrl: p.comprobanteUrl ? SecuritySanitizer.cleanText(p.comprobanteUrl, 1000) : '',
                    estado: "Activa"
                }));

                let resumenRuta = "";
                for (let i = 0; i < paradas.length; i++) {
                    const p = paradas[i];
                    resumenRuta += `${p.tipo} ${p.nota} -> `;
                    
                    await setDoc(doc(collection(db, "rutas_puntos")), {
                        rutaId: rutaIdMaster,
                        pedidoId: pedidoId,
                        cliente: SecuritySanitizer.cleanText(pedOriginal.cliente || "Cliente", 120),
                        orden: i + 1,
                        chofer: chofer,
                        subChofer: "",
                        rutaPagoTotal: pagoTotal,
                        nota: `(Parada ${i+1}) ${p.nota} | Tlf: ${p.tlf} | ${p.pago} | ${p.confianza}`,
                        rawTipo: p.tipo,
                        rawNota: p.nota,
                        rawTlf: p.tlf,
                        rawPago: p.pago,
                        rawConfianza: p.confianza,
                        pagoDinero: p.pagoDinero,
                        lat: p.lat,
                        lng: p.lng,
                        comprobanteUrl: p.comprobanteUrl || '',
                        fecha: new Date().toLocaleDateString("es-VE"),
                        timestamp: Date.now(),
                        estado: "Activa"
                    });
                }

                // 🚀 ACTUALIZAMOS DIRECTAMENTE EL DOCUMENTO DEL PEDIDO ORIGINAL
                // (Cero creación de pedidos clonados "RUTA MAESTRA MULTIPARADA")
                const datosActualizadosPedido = {
                    motorizado: chofer,
                    tarifaMotorizado: pagoTotal,
                    pagoMotorizadoEstatus: pedOriginal.pagoMotorizadoEstatus || "Pendiente",
                    trackingMotorizado: rutaIdMaster,
                    rutasMotorizado: resumenRuta.slice(0, -4),
                    rutaPuntos: paradas,
                    rutaId: rutaIdMaster,
                    subChofer: "",
                    rutaEstado: "Activa",
                    fechaRuta: new Date().toLocaleDateString("es-VE"),
                    timestampRuta: Date.now()
                };

                if (pedOriginal.estado === 'Pendiente') {
                    datosActualizadosPedido.estado = 'En camino';
                }

                await updateDoc(doc(db, "pedidos", pedidoId), datosActualizadosPedido);

                let waText = `🛵 *RUTA ASIGNADA A PEDIDO* 🛵\n*Cliente:* ${pedOriginal.cliente || 'Cliente'}\n*Chofer:* ${chofer}\n*Total Servicio:* $${pagoTotal}\n\n`;
                window.rutaEnConstruccion.forEach((p, i) => {
                    const icon = p.tipo === 'Retiro' ? '🟢' : '🔵';
                    const comprobanteTexto = p.comprobanteUrl ? `\n🧾 Comprobante: ${p.comprobanteUrl}` : '';
                    waText += `*${icon} PARADA ${i+1}: ${p.tipo.toUpperCase()} ($${p.pagoDinero})*\n📦 Tarea: ${p.nota}\n📞 Tlf: ${p.tlf}\n💰 Estatus: ${p.pago}${comprobanteTexto}\n🛡️ Zona: ${p.confianza}\n📍 GPS: https://maps.google.com/?q=${p.lat},${p.lng}\n\n`;
                });
                waText += `*(Ingresa al Portal de Motorizados para ver tu entrega y navegar)*`;

                window.cancelarEdicionRuta(); 
                window.cargarPuntosRuta(); 
                if (typeof window.cargarPedidos === 'function') await (async () => { window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; await window.cargarPedidos(); })() 

                const telefonosChoferes = { "Jhon": "584120000000", "Bryan": "584120161036" };
                const numeroDestino = telefonosChoferes[chofer] || "";
                window.open(`https://api.whatsapp.com/send?phone=${numeroDestino}&text=${encodeURIComponent(waText)}`, '_blank');

            } catch(error) {
                console.error(error); alert("Hubo un error al guardar: " + error.message);
            }
            btn.innerHTML = '<i class="fab fa-whatsapp"></i> Guardar y Enviar'; btn.disabled = false;
        };

        window.cargarPuntosRuta = async function() {
            const tbody = document.getElementById('tabla-puntos-rutas');
            const btnActualizar = document.querySelector('button[onclick="cargarPuntosRuta()"]');
            
            if(!tbody) return;
            if(btnActualizar) btnActualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';

            try {
                const q = query(collection(db, "rutas_puntos")); 
                const snap = await getDocs(q);
                tbody.innerHTML = '';
                
                if(window.marcadoresGuardados && window.mapaAdmin) { 
                    window.marcadoresGuardados.forEach(m => window.mapaAdmin.removeLayer(m)); 
                }
                window.marcadoresGuardados = [];
                window.rutasAgrupadasLocal = {};

                if(snap.empty) { 
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay rutas asignadas.</td></tr>'; 
                } else {
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        const rId = data.rutaId || docSnap.id; 
                        
                        if(!window.rutasAgrupadasLocal[rId]) {
                            window.rutasAgrupadasLocal[rId] = {
                                rutaId: rId,
                                pedidoId: data.pedidoId || '',
                                cliente: data.cliente || '',
                                chofer: data.chofer,
                                fecha: data.fecha,
                                pagoTotal: data.rutaPagoTotal || 0,
                                puntos: []
                            };
                        }
                        if (data.cliente && !window.rutasAgrupadasLocal[rId].cliente) {
                            window.rutasAgrupadasLocal[rId].cliente = data.cliente;
                        }
                        window.rutasAgrupadasLocal[rId].puntos.push({ idDoc: docSnap.id, ...data });

                        // 📍 DIBUJAMOS EL PIN DE LA PARADA EN EL MAPA CON EL COLOR DEL CHOFER
                        if(data.lat && data.lng && data.estado !== 'Completada') {
                            const colorChofer = window.coloresMotorizados[data.chofer] || "#333";
                            const pinHtml = `<div style="color: ${colorChofer}; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); text-align: center; margin-top:-10px;"><i class="fas fa-map-marker-alt"></i></div>`;
                            const pinIconColor = L.divIcon({ className: '', html: pinHtml, iconSize: [30, 30], iconAnchor: [15, 30] });

                            const m = L.marker([data.lat, data.lng], {icon: pinIconColor}).addTo(window.mapaAdmin).bindPopup(`<b>${data.chofer}</b><br>${data.cliente ? `<b>Cliente:</b> ${data.cliente}<br>` : ''}${data.nota}`);
                            window.marcadoresGuardados.push(m);
                        }
                    });

                    // ── Filtro mensual de rutas ──
                    const selectRutasMes = document.getElementById('rutas-mes-filtro');
                    const ahora = new Date();
                    const mesActualR = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}`;

                    // Poblar selector de meses si está vacío
                    if (selectRutasMes && selectRutasMes.options.length === 0) {
                        const mesesSetR = new Set();
                        Object.values(window.rutasAgrupadasLocal).forEach(r => {
                            if (r.fecha) {
                                const p = r.fecha.split('/');
                                if (p.length === 3) mesesSetR.add(`${p[2]}-${p[1].padStart(2,'0')}`);
                                else { const d = new Date(r.fecha); if(!isNaN(d)) mesesSetR.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
                            }
                        });
                        mesesSetR.add(mesActualR);
                        const mesesR = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                        selectRutasMes.innerHTML = '<option value="todos">📚 Ver Archivo Completo</option>';
                        Array.from(mesesSetR).sort().reverse().forEach(ym => {
                            const [y,m] = ym.split('-');
                            const opt = document.createElement('option');
                            opt.value = ym; opt.textContent = `${mesesR[parseInt(m)-1]} ${y}`;
                            if (ym === mesActualR) opt.selected = true;
                            selectRutasMes.appendChild(opt);
                        });
                    }
                    const filtroRutasMes = selectRutasMes ? selectRutasMes.value : 'todos';

                    // Filtrar rutas por mes seleccionado
                    let rutasFiltradas = Object.values(window.rutasAgrupadasLocal);
                    if (filtroRutasMes !== 'todos') {
                        rutasFiltradas = rutasFiltradas.filter(r => {
                            if (!r.fecha) return false;
                            const p = r.fecha.split('/');
                            const ym = p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}` : '';
                            return ym === filtroRutasMes;
                        });
                    }

                    const contadorR = document.getElementById('rutas-contador');
                    if (contadorR) contadorR.textContent = `(${rutasFiltradas.length} ruta${rutasFiltradas.length !== 1?'s':''})`;
                    if (rutasFiltradas.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay rutas en este período.</td></tr>';
                        if(btnActualizar) btnActualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
                        return;
                    }

                    rutasFiltradas.forEach(ruta => {
                        ruta.puntos.sort((a,b) => (a.orden || 0) - (b.orden || 0));
                        
                        const colorChofer = window.coloresMotorizados[ruta.chofer] || "#333";
                        const todasCompletadas = ruta.puntos.every(p => p.estado === "Completada");
                        const badgeRuta = todasCompletadas ? 
                            `<span style="background:#28a745; color:white; padding:3px 6px; border-radius:4px; font-size:10px;"><i class="fas fa-check-double"></i> Ruta Terminada</span>` : 
                            `<span style="background:#f0ad4e; color:white; padding:3px 6px; border-radius:4px; font-size:10px;"><i class="fas fa-motorcycle"></i> En Progreso</span>`;
                        
                        let desgloseHtml = ruta.puntos.map((p, i) => {
                            const isDone = p.estado === 'Completada';
                            const icon = isDone ? '<i class="fas fa-check-circle" style="color:#28a745;"></i>' : '<i class="fas fa-clock" style="color:#f0ad4e;"></i>';
                            const style = isDone ? 'text-decoration: line-through; color: #999;' : 'color: #555;';
                            const delegadoStr = p.subChofer ? ` <span style="background:#1d6fa5; color:white; padding:2px 4px; border-radius:3px; font-size:9px;">Delegado a ${p.subChofer}</span>` : '';
                            
                            let comprobanteHtml = '';
                            if (p.comprobanteUrl) {
                                comprobanteHtml = ` <a href="${p.comprobanteUrl}" target="_blank" style="color:#0284c7; text-decoration:underline; font-weight:bold; font-size:10px; margin-left:4px;" title="Ver comprobante de pago"><i class="fas fa-receipt"></i> Comprobante</a>`;
                            } else if (p.pago === 'Por Pagar' || p.rawPago === 'Por Pagar') {
                                comprobanteHtml = ` <button type="button" onclick="window.abrirModalPagoEnVivo('${ruta.rutaId}', ${i})" style="background:#10b981; color:white; border:none; padding:1px 6px; border-radius:3px; font-size:9px; cursor:pointer; margin-left:4px; font-weight:bold;" title="Subir comprobante y marcar Pagado"><i class="fas fa-upload"></i> Pagar en vivo</button>`;
                            }

                            return `<div style="font-size:11px; margin-bottom:3px; ${style}"><b>${i+1}.</b> ${icon} ${p.rawTipo||'Punto'}: ${p.rawNota || p.nota} (${p.rawPago || p.pago || 'N/A'})${comprobanteHtml}${delegadoStr}</div>`;
                        }).join('');

                        const clienteTitulo = ruta.cliente ? `👤 ${ruta.cliente} - ` : '';

                        tbody.innerHTML += `<tr>
                                <td>${ruta.fecha || ''}</td>
                                <td><strong style="color: ${colorChofer};">${ruta.chofer || ''}</strong></td>
                                <td>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                        <strong style="color:#333; font-size:13px;">📍 ${clienteTitulo}Ruta (${ruta.puntos.length} paradas)</strong>
                                        ${badgeRuta}
                                    </div>
                                    ${desgloseHtml}
                                </td>
                                <td style="text-align: center; display: flex; gap: 5px; justify-content: center; align-items: center; height:100%;">
                                    ${!todasCompletadas ? `<button type="button" onclick="marcarRutaTerminada('${ruta.rutaId}')" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Marcar Terminada"><i class="fas fa-check-circle"></i></button>` : ''}
                                    <button type="button" onclick="editarRutaMaestra('${ruta.rutaId}')" style="background:#f0ad4e; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Editar Ruta"><i class="fas fa-edit"></i> Editar</button>
                                    <button type="button" onclick="eliminarRutaMaestra('${ruta.rutaId}')" style="background:#d9534f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Borrar Toda la Ruta"><i class="fas fa-times"></i> Borrar</button>
                                </td>
                            </tr>`;
                    });
                }
            } catch(e) { console.error("Error al cargar la tabla:", e); }
            if(btnActualizar) btnActualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Rutas';
        };

        window.editarRutaMaestra = function(rutaId) {
            const ruta = window.rutasAgrupadasLocal[rutaId];
            if(!ruta) return;

            window.rutaEnConstruccion = ruta.puntos.map(p => ({
                lat: p.lat, lng: p.lng,
                tipo: p.rawTipo || 'Retiro',
                pago: p.rawPago || 'Pagado',
                tlf: p.rawTlf || '',
                confianza: p.rawConfianza || 'Conocido',
                pagoDinero: p.pagoDinero || 0,
                nota: p.rawNota || p.nota,
                comprobanteUrl: p.comprobanteUrl || ''
            }));

            document.getElementById('edit-ruta-id').value = ruta.rutaId;
            document.getElementById('ruta-chofer').value = ruta.chofer;

            // Seleccionar el pedido correspondiente en el selector
            const selectPedido = document.getElementById('ruta-pedido-asociado');
            if (selectPedido && window.pedidosDBLocal) {
                let encontrado = false;
                if (ruta.pedidoId && window.pedidosDBLocal[ruta.pedidoId]) {
                    selectPedido.value = ruta.pedidoId;
                    window.alSeleccionarPedidoRuta(ruta.pedidoId);
                    encontrado = true;
                }
                if (!encontrado) {
                    for (let id in window.pedidosDBLocal) {
                        const p = window.pedidosDBLocal[id];
                        if (p.trackingMotorizado === rutaId || p.rutaId === rutaId) {
                            selectPedido.value = id;
                            window.alSeleccionarPedidoRuta(id);
                            break;
                        }
                    }
                }
            }

            document.getElementById('titulo-ruta').innerHTML = '<i class="fas fa-edit"></i> Editando Ruta Maestra';
            document.getElementById('btn-cancelar-ruta').style.display = 'block';
            document.getElementById('btn-guardar-ruta').innerHTML = '<i class="fas fa-sync"></i> Actualizar y Reenviar';

            window.marcadoresConstruccion.forEach(m => window.mapaAdmin.removeLayer(m));
            window.marcadoresConstruccion = [];
            window.rutaEnConstruccion.forEach((p, i) => {
                const marker = L.marker([p.lat, p.lng]).addTo(window.mapaAdmin).bindPopup(`<b>Parada ${i+1}</b><br>${p.tipo}: ${p.nota}`);
                window.marcadoresConstruccion.push(marker);
            });

            window.actualizarListaRutaUI(); 
            document.querySelector('#form-rutas-container').scrollIntoView({ behavior: 'smooth' });
        };

        window.marcarRutaTerminada = async function(rutaId) {
            if(!confirm("¿Marcar toda la ruta y sus paradas como Terminadas?")) return;
            try {
                const qPuntos = query(collection(db, "rutas_puntos"), where("rutaId", "==", rutaId));
                const snapPuntos = await getDocs(qPuntos);
                
                let promesasUpdate = [];
                snapPuntos.forEach((d) => {
                    promesasUpdate.push(updateDoc(d.ref, { estado: "Completada" }));
                });
                
                await Promise.all(promesasUpdate);

                if (window.registrarAuditoria) {
                    window.registrarAuditoria("CAMBIO ESTATUS RUTA", "Se marcó la ruta como Terminada (Acción Rápida).");
                }
                
                window.cargarPuntosRuta(); // Repintar instantáneamente
            } catch (error) {
                console.error("Error al marcar ruta terminada:", error);
                alert("Ocurrió un error al procesar la ruta.");
            }
        };

        window.eliminarRutaMaestra = async function(rutaId) {
            if(!confirm("¿Estás seguro de desvincular o borrar esta ruta? (Se limpiará la asignación al motorizado).")) return;
            try {
                const qPuntos = query(collection(db, "rutas_puntos"), where("rutaId", "==", rutaId));
                const snapPuntos = await getDocs(qPuntos);
                snapPuntos.forEach(async (d) => await deleteDoc(d.ref));

                // Desvincular en el pedido original sin borrar el pedido
                const qPed = query(collection(db, "pedidos"), where("trackingMotorizado", "==", rutaId));
                const snapPed = await getDocs(qPed);
                snapPed.forEach(async (d) => {
                    const data = d.data();
                    if (data.cliente === "📍 RUTA MAESTRA MULTIPARADA") {
                        await deleteDoc(d.ref); // Si era un registro clonado viejo, se borra
                    } else {
                        await updateDoc(d.ref, {
                            trackingMotorizado: "",
                            rutasMotorizado: "",
                            tarifaMotorizado: 0,
                            pagoMotorizadoEstatus: "",
                            rutaPuntos: [],
                            rutaId: "",
                            rutaEstado: ""
                        });
                    }
                });

                try { await deleteDoc(doc(db, "rutas_puntos", rutaId)); } catch(e){}

                window.cargarPuntosRuta(); 
                if (typeof window.cargarPedidos === 'function') await (async () => { window._pedidosTodosCache = null; if(document.getElementById('pedidos-mes-filtro')) document.getElementById('pedidos-mes-filtro').innerHTML = ''; await window.cargarPedidos(); })() 
            } catch(e) { console.error(e); alert("Error borrando la ruta."); }
        };

        // ==========================================
        // 🚀 ACTUALIZACIÓN DE PAGO EN VIVO (RUTAS EN PROGRESO)
        // ==========================================
        window.actualizarPagoEnVivo = async function(idRuta, indexParada, archivoImagen) {
            if (!idRuta) throw new Error("idRuta es obligatorio.");
            if (indexParada === undefined || indexParada === null) throw new Error("indexParada es obligatorio.");
            if (!archivoImagen) throw new Error("archivoImagen es obligatorio.");

            // 1. Subir la nueva imagen a Storage en carpeta comprobantes/
            const timestamp = Date.now();
            const extension = archivoImagen.name ? archivoImagen.name.split('.').pop() : 'jpg';
            const cleanName = archivoImagen.name ? archivoImagen.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'comprobante.jpg';
            const fileRef = storageRef(storage, `comprobantes/${timestamp}_${cleanName}`);

            const metadata = {
                contentType: archivoImagen.type || (extension.toLowerCase() === 'pdf' ? 'application/pdf' : 'image/jpeg')
            };

            const snapshot = await uploadBytes(fileRef, archivoImagen, metadata);
            const comprobanteUrl = await getDownloadURL(snapshot.ref);

            // 2. Hacer updateDoc a la base de datos apuntando a esa ruta específica
            // A) Colección directa 'rutas/{idRuta}' si existe
            try {
                const rutaDocRef = doc(db, "rutas", idRuta);
                const rutaSnap = await getDoc(rutaDocRef);
                if (rutaSnap.exists()) {
                    const dataRuta = rutaSnap.data();
                    const paradas = Array.isArray(dataRuta.paradas) ? [...dataRuta.paradas] : (Array.isArray(dataRuta.rutaPuntos) ? [...dataRuta.rutaPuntos] : []);
                    if (paradas[indexParada]) {
                        paradas[indexParada].pago = "Pagado";
                        paradas[indexParada].comprobanteUrl = comprobanteUrl;
                    }
                    const campoP = Array.isArray(dataRuta.paradas) ? "paradas" : "rutaPuntos";
                    await updateDoc(rutaDocRef, {
                        [campoP]: paradas,
                        fechaActualizacionPago: new Date().toLocaleDateString("es-VE"),
                        timestampActualizacionPago: Date.now()
                    });
                }
            } catch(e) { console.warn("Aviso colección rutas:", e); }

            // B) Colección 'pedidos' vinculada a la ruta (trackingMotorizado, rutaId o id directo)
            try {
                let pedidoRef = null;
                let pedData = null;

                const directPedSnap = await getDoc(doc(db, "pedidos", idRuta));
                if (directPedSnap.exists()) {
                    pedidoRef = directPedSnap.ref;
                    pedData = directPedSnap.data();
                } else {
                    const qP1 = query(collection(db, "pedidos"), where("trackingMotorizado", "==", idRuta));
                    const sP1 = await getDocs(qP1);
                    if (!sP1.empty) {
                        pedidoRef = sP1.docs[0].ref;
                        pedData = sP1.docs[0].data();
                    } else {
                        const qP2 = query(collection(db, "pedidos"), where("rutaId", "==", idRuta));
                        const sP2 = await getDocs(qP2);
                        if (!sP2.empty) {
                            pedidoRef = sP2.docs[0].ref;
                            pedData = sP2.docs[0].data();
                        }
                    }
                }

                if (pedidoRef && pedData && Array.isArray(pedData.rutaPuntos)) {
                    const paradasPed = [...pedData.rutaPuntos];
                    if (paradasPed[indexParada]) {
                        paradasPed[indexParada].pago = "Pagado";
                        paradasPed[indexParada].comprobanteUrl = comprobanteUrl;
                    }
                    await updateDoc(pedidoRef, {
                        rutaPuntos: paradasPed
                    });
                }
            } catch(e) { console.warn("Aviso colección pedidos:", e); }

            // C) Colección 'rutas_puntos' (paradas individuales activas)
            try {
                const ordenBusqueda = indexParada + 1;
                const qPunto = query(
                    collection(db, "rutas_puntos"),
                    where("rutaId", "==", idRuta),
                    where("orden", "==", ordenBusqueda)
                );
                const sPunto = await getDocs(qPunto);
                if (!sPunto.empty) {
                    for (const d of sPunto.docs) {
                        await updateDoc(d.ref, {
                            pago: "Pagado",
                            rawPago: "Pagado",
                            comprobanteUrl: comprobanteUrl
                        });
                    }
                }
            } catch(e) { console.warn("Aviso colección rutas_puntos:", e); }

            // 3. Sincronizar memoria local
            if (window.rutasAgrupadasLocal && window.rutasAgrupadasLocal[idRuta]) {
                const r = window.rutasAgrupadasLocal[idRuta];
                if (r.puntos && r.puntos[indexParada]) {
                    r.puntos[indexParada].pago = "Pagado";
                    r.puntos[indexParada].rawPago = "Pagado";
                    r.puntos[indexParada].comprobanteUrl = comprobanteUrl;
                }
            }

            // 4. Refrescar tabla en la vista del administrador
            if (typeof window.cargarPuntosRuta === 'function') {
                await window.cargarPuntosRuta();
            }

            return {
                success: true,
                comprobanteUrl: comprobanteUrl
            };
        };

        window.abrirModalPagoEnVivo = function(idRuta, indexParada) {
            let inputTemp = document.getElementById('input-pago-en-vivo-temp');
            if (!inputTemp) {
                inputTemp = document.createElement('input');
                inputTemp.type = 'file';
                inputTemp.id = 'input-pago-en-vivo-temp';
                inputTemp.accept = 'image/*,application/pdf';
                inputTemp.style.display = 'none';
                document.body.appendChild(inputTemp);
            }
            inputTemp.value = '';
            inputTemp.onchange = async function() {
                if (!this.files || !this.files[0]) return;
                const archivo = this.files[0];
                
                const confirmar = confirm(`¿Subir comprobante "${archivo.name}" y marcar la Parada ${indexParada + 1} como PAGADA?`);
                if (!confirmar) return;

                const loadingToast = document.createElement('div');
                loadingToast.id = 'toast-subiendo-pago';
                loadingToast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#1e293b; color:#fff; padding:12px 18px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:99999; display:flex; align-items:center; gap:10px; font-size:12px; font-weight:bold;';
                loadingToast.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-400"></i> Subiendo comprobante a Storage y actualizando parada...';
                document.body.appendChild(loadingToast);

                try {
                    await window.actualizarPagoEnVivo(idRuta, indexParada, archivo);
                    loadingToast.style.background = '#065f46';
                    loadingToast.innerHTML = '<i class="fas fa-check-circle text-emerald-400"></i> ¡Comprobante subido y parada marcada como Pagada!';
                    setTimeout(() => { if (loadingToast) loadingToast.remove(); }, 3500);
                } catch (error) {
                    console.error(error);
                    loadingToast.style.background = '#991b1b';
                    loadingToast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}`;
                    setTimeout(() => { if (loadingToast) loadingToast.remove(); }, 4000);
                    alert("❌ Error al actualizar pago en vivo: " + error.message);
                }
            };
            inputTemp.click();
        };

        // 🚀 LÓGICA PARA OCULTAR/MOSTRAR EL SIDEBAR
        window.toggleSidebar = function() {
            const sidebar = document.getElementById('main-sidebar');
            if (sidebar.classList.contains('w-[280px]')) {
                sidebar.classList.remove('w-[280px]');
                sidebar.classList.add('w-0');
                sidebar.classList.remove('border-r');
            } else {
                sidebar.classList.remove('w-0');
                sidebar.classList.add('w-[280px]');
                sidebar.classList.add('border-r');
            }
        };

        window.filtrarTipoFactura = function() {
    const filtro = document.getElementById('filtro-tipo-factura').value;
    const filas = document.querySelectorAll('#facturas-table-body tr');
    
    filas.forEach(fila => {
        // Evitar filtrar la fila vacía o de carga
        if (fila.cells.length < 2) return; 
        
        const tdNro = fila.querySelector('td:first-child');
        if (!tdNro) return;
        
        // REGLA CLAVE: Leer solo el texto de la PRIMERA columna para evitar leer el <select>
        const textoCeldaNro = tdNro.textContent.toUpperCase();
        
        // Aislar SOLO el número de control (Ej: #00000625N o #00000615)
        const coincidencia = textoCeldaNro.match(/#[0-9]+[A-Z]?/);
        const numeroPrincipal = coincidencia ? coincidencia[0] : "";
        
        // Lógica estricta aplicada solo a la primera columna
        const esNotaEntrega = numeroPrincipal.endsWith('N');
        const esAnuladaONC = textoCeldaNro.includes('N/C') || textoCeldaNro.includes('ANULADA');
        
        let mostrar = false;
        
        if (filtro === 'todas') {
            mostrar = true;
        } else if (filtro === 'fiscales') {
            // Es fiscal activa si NO es nota de entrega y NO está anulada ni tiene N/C
            mostrar = !esNotaEntrega && !esAnuladaONC;
        } else if (filtro === 'nofiscales') {
            // Solo notas de entrega puras
            mostrar = esNotaEntrega && !esAnuladaONC;
        } else if (filtro === 'anuladas') {
            // Solo anuladas o con Nota de Crédito
            mostrar = esAnuladaONC;
        }
        
        // Usar un string vacío en lugar de 'table-row' previene que se rompan las clases de Tailwind (Responsive)
        fila.style.display = mostrar ? '' : 'none';
    });
};


        // ==========================================
        // 🚀 MÓDULO DE REVENTAS Y COMISIONES
        // ==========================================
        
        // Variables globales para las tasas de reventa (se actualizan al cargar el historial)
        window.tasaReventaBCV = 42.00;
        window.tasaReventaEUR = 1.08;

        // Estado del conversor de monedas para inputs de reventas (USD o VES)
        window.monedaReventas = {
            'rev-venta': 'USD',
            'rev-costo': 'USD',
            'rev-gastos': 'USD'
        };

        window.obtenerTasaBCVActual = function() {
            let t = window.tasaVivaBCV || window.tasaReventaBCV || 0;
            if (t > 0) return t;
            if (window._ultimoUsdBcv && window._ultimoUsdBcv > 0) return window._ultimoUsdBcv;
            return 0;
        };

        window.actualizarEstadoModoBsReventas = function() {
            const tasa = window.obtenerTasaBCVActual();
            const campos = ['rev-venta', 'rev-costo', 'rev-gastos'];
            campos.forEach(id => {
                const btnVes = document.getElementById(`btn-curr-${id}-ves`);
                if (btnVes) {
                    if (tasa <= 0) {
                        btnVes.disabled = true;
                        btnVes.style.opacity = '0.4';
                        btnVes.style.cursor = 'not-allowed';
                        btnVes.title = 'Tasa BCV cargando...';
                    } else {
                        btnVes.disabled = false;
                        btnVes.style.opacity = '1';
                        btnVes.style.cursor = 'pointer';
                        btnVes.title = `Ingresar en Bolívares (Tasa BCV: Bs. ${tasa.toFixed(2)})`;
                    }
                }
            });
        };

        window.setMonedaReventa = function(fieldId, targetCurrency) {
            const tasa = window.obtenerTasaBCVActual();
            if (targetCurrency === 'VES' && (!tasa || tasa <= 0)) {
                alert("⚠️ La tasa oficial del BCV aún no está disponible. Por favor espera unos momentos a que se sincronice.");
                return;
            }

            const monedaActual = (window.monedaReventas && window.monedaReventas[fieldId]) || 'USD';
            if (monedaActual === targetCurrency) return;

            window.monedaReventas[fieldId] = targetCurrency;

            const btnUsd = document.getElementById(`btn-curr-${fieldId}-usd`);
            const btnVes = document.getElementById(`btn-curr-${fieldId}-ves`);
            const tag = document.getElementById(`tag-moneda-${fieldId}`);
            const pfx = document.getElementById(`pfx-${fieldId}`);
            const input = document.getElementById(fieldId);
            const helpEl = document.getElementById(`help-${fieldId}`);

            // Limpiar limpiamente el campo al cambiar de moneda para evitar números residuales o divisiones por cero
            if (input) {
                input.value = '';
            }
            if (helpEl) {
                helpEl.innerHTML = '';
            }

            if (targetCurrency === 'VES') {
                if (btnUsd) { btnUsd.style.background = 'transparent'; btnUsd.style.color = '#4b5563'; }
                if (btnVes) { btnVes.style.background = '#1d6fa5'; btnVes.style.color = 'white'; }
                if (tag) tag.textContent = `(en Bs. - Tasa BCV: ${tasa.toFixed(2)})`;
                if (pfx) { pfx.textContent = 'Bs.'; pfx.style.fontSize = '11px'; }
                if (input) {
                    input.style.paddingLeft = '32px';
                    input.placeholder = 'Ej: 8505';
                    input.focus();
                }
            } else {
                if (btnUsd) { btnUsd.style.background = '#385723'; btnUsd.style.color = 'white'; }
                if (btnVes) { btnVes.style.background = 'transparent'; btnVes.style.color = '#4b5563'; }
                if (tag) tag.textContent = '(en $)';
                if (pfx) { pfx.textContent = '$'; pfx.style.fontSize = '13px'; }
                if (input) {
                    input.style.paddingLeft = '24px';
                    input.placeholder = fieldId === 'rev-venta' ? 'Ej: 1000' : (fieldId === 'rev-costo' ? 'Ej: 600' : 'Ej: 50');
                    input.focus();
                }
            }

            window.calcularReventa();
        };

        window.manejarInputReventa = function(fieldId) {
            const input = document.getElementById(fieldId);
            const helpEl = document.getElementById(`help-${fieldId}`);
            if (!input || !helpEl) return;

            const val = parseFloat(input.value);
            const tasa = window.obtenerTasaBCVActual();
            const moneda = (window.monedaReventas && window.monedaReventas[fieldId]) || 'USD';

            if (isNaN(val) || val <= 0) {
                helpEl.innerHTML = '';
                window.calcularReventa();
                return;
            }

            if (moneda === 'VES') {
                if (tasa > 0) {
                    const equivUSD = val / tasa;
                    const bsFormato = val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    helpEl.innerHTML = `<span style="color: #15803d; font-weight: 600; font-size: 11.5px;"><i class="fas fa-hand-point-right"></i> Equivalente: $${equivUSD.toFixed(2)} (Calculado desde Bs. ${bsFormato} a tasa BCV)</span>`;
                } else {
                    helpEl.innerHTML = `<span style="color: #dc2626; font-size: 11px;"><i class="fas fa-exclamation-triangle"></i> Tasa BCV no disponible</span>`;
                }
            } else {
                if (tasa > 0) {
                    const equivVES = (val * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    helpEl.innerHTML = `<span style="color: #15803d; font-weight: 600; font-size: 11.5px;"><i class="fas fa-hand-point-right"></i> Equivalente: Bs. ${equivVES} (Calculado a tasa BCV)</span>`;
                } else {
                    helpEl.innerHTML = '';
                }
            }

            window.calcularReventa();
        };

        window.manejarBlurReventa = function(fieldId) {
            // El valor del input NO se altera al perder el foco (se conserva intacto)
            window.manejarInputReventa(fieldId);
        };

        window.obtenerMontoEnUSD = function(fieldId) {
            const input = document.getElementById(fieldId);
            if (!input) return 0;
            const rawVal = parseFloat(input.value);
            if (isNaN(rawVal) || rawVal <= 0) return 0;

            const moneda = (window.monedaReventas && window.monedaReventas[fieldId]) || 'USD';
            if (moneda === 'VES') {
                const tasa = window.obtenerTasaBCVActual();
                if (tasa > 0) {
                    return Number((rawVal / tasa).toFixed(2));
                }
                return 0;
            }
            return Number(rawVal.toFixed(2));
        };

        window.resetMonedasReventa = function() {
            ['rev-venta', 'rev-costo', 'rev-gastos'].forEach(id => {
                window.monedaReventas[id] = 'USD';
                const btnUsd = document.getElementById(`btn-curr-${id}-usd`);
                const btnVes = document.getElementById(`btn-curr-${id}-ves`);
                const tag = document.getElementById(`tag-moneda-${id}`);
                const pfx = document.getElementById(`pfx-${id}`);
                const input = document.getElementById(id);
                const help = document.getElementById(`help-${id}`);

                if (btnUsd) { btnUsd.style.background = '#385723'; btnUsd.style.color = 'white'; }
                if (btnVes) { btnVes.style.background = 'transparent'; btnVes.style.color = '#4b5563'; }
                if (tag) tag.textContent = '(en $)';
                if (pfx) { pfx.textContent = '$'; pfx.style.fontSize = '13px'; }
                if (input) {
                    input.style.paddingLeft = '24px';
                    input.placeholder = id === 'rev-venta' ? 'Ej: 1000' : (id === 'rev-costo' ? 'Ej: 600' : 'Ej: 50');
                }
                if (help) help.innerHTML = '';
            });
            window.actualizarEstadoModoBsReventas();
        };

        window.calcularReventa = function() {
            const venta = window.obtenerMontoEnUSD('rev-venta');
            const costo = window.obtenerMontoEnUSD('rev-costo');
            const gastos = window.obtenerMontoEnUSD('rev-gastos');
            const porcentaje = parseFloat(document.getElementById('rev-porcentaje')?.value) || 0;

            const tasaVES = window.obtenerTasaBCVActual() || window.tasaReventaBCV || 42.00;
            const tasaEUR = window.tasaReventaEUR || 1.08;

            const gananciaBruta = venta - costo - gastos;
            const comisionTercero = gananciaBruta * (porcentaje / 100);
            const gananciaNeta = gananciaBruta - comisionTercero;

            const renderMonedas = (montoUSD) => {
                const ves = (montoUSD * tasaVES).toFixed(2);
                let eurMonto = 0;
                if (tasaEUR > 10) {
                    eurMonto = montoUSD * 0.92;
                } else {
                    eurMonto = montoUSD * tasaEUR;
                }
                const eur = eurMonto.toFixed(2);
                return `$${montoUSD.toFixed(2)} | Bs.${ves} | €${eur}`;
            };

            const elBruta = document.getElementById('rev-res-bruta');
            const elTercero = document.getElementById('rev-res-tercero');
            const elNeta = document.getElementById('rev-res-neta');

            if (elBruta) elBruta.textContent = renderMonedas(gananciaBruta);
            if (elTercero) elTercero.textContent = renderMonedas(comisionTercero);
            if (elNeta) elNeta.textContent = renderMonedas(gananciaNeta);
            
            return {
                venta, costo, gastos, porcentaje,
                gananciaBruta, comisionTercero, gananciaNeta,
                tasaVES, tasaEUR
            };
        };

        window.editarReventa = async function(id) {
            try {
                const docRef = doc(db, "reventas_gastos", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const rev = docSnap.data();
                    if (window.resetMonedasReventa) {
                        window.resetMonedasReventa();
                    }
                    document.getElementById('rev-desc').value = rev.descripcion || "";
                    document.getElementById('rev-cliente').value = rev.cliente || "";
                    document.getElementById('rev-intermediario').value = rev.intermediario || "";
                    document.getElementById('rev-venta').value = rev.ventaUSD || "";
                    document.getElementById('rev-costo').value = rev.costoUSD || "";
                    document.getElementById('rev-gastos').value = rev.gastosUSD || "";
                    document.getElementById('rev-porcentaje').value = rev.porcentajeComision || 50;
                    
                    if (window.manejarInputReventa) {
                        window.manejarInputReventa('rev-venta');
                        window.manejarInputReventa('rev-costo');
                        window.manejarInputReventa('rev-gastos');
                    }

                    window.calcularReventa();
                    window.idReventaEditando = id;
                    
                    const btnGuardar = document.querySelector('#tab-reventas .btn-confirm-order');
                    if (btnGuardar) {
                        btnGuardar.style.background = "#1d6fa5";
                        btnGuardar.innerHTML = '<i class="fas fa-edit"></i> Actualizar Operación';
                    }
                    
                    document.querySelector('#tab-reventas').scrollIntoView({ behavior: 'smooth' });
                }
            } catch (error) {
                console.error("Error al cargar la reventa para editar:", error);
                alert("Hubo un error cargando los datos.");
            }
        };

        // ==========================================
        // 🛡️ MÓDULO DE AUDITORÍA INTERNA
        // ==========================================
        window.registrarAuditoria = async function(accion, detalles) {
            try {
                const elNombre = document.getElementById('admin-nombre-txt');
                const usuario = (elNombre && elNombre.textContent && elNombre.textContent !== 'Cargando...') ? elNombre.textContent.trim() : "Administrador";
                
                await addDoc(collection(db, 'auditoria_logs'), {
                    fecha: new Date().toLocaleString("es-VE"),
                    usuario: usuario,
                    accion: accion,
                    detalles: detalles,
                    timestamp: new Date().getTime()
                });
            } catch (error) {
                console.error("Error registrando auditoría:", error);
            }
        };

        window.abrirModalAuditoria = function() {
            document.getElementById('modal-auditoria').style.display = 'flex';
            window.cargarHistorialAuditoria();
        };
        
        window.cerrarModalAuditoria = function() {
            document.getElementById('modal-auditoria').style.display = 'none';
        };

        window.cargarHistorialAuditoria = async function() {
            const tbody = document.getElementById('auditoria-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando historial de auditoría...</td></tr>';
            
            try {
                const snap = await getDocs(collection(db, "auditoria_logs"));
                if (snap.empty) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay registros de auditoría.</td></tr>';
                    return;
                }
                
                let logs = [];
                snap.forEach(docSnap => logs.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Ordenar más recientes primero
                logs.sort((a, b) => b.timestamp - a.timestamp);
                
                let html = '';
                logs.forEach(log => {
                    let colorAccion = "color: #333;";
                    let accionTexto = log.accion || "";
                    if (accionTexto.includes("CREAR")) colorAccion = "color: #28a745;";
                    if (accionTexto.includes("EDITAR") || accionTexto.includes("ACTUALIZAR")) colorAccion = "color: #1d6fa5;";
                    if (accionTexto.includes("ELIMINAR") || accionTexto.includes("BORRAR")) colorAccion = "color: #d9534f;";
                    
                    html += `
                        <tr>
                            <td style="font-size: 12px; color: #555;">${log.fecha}</td>
                            <td><strong><i class="fas fa-user-circle" style="color:#ccc;"></i> ${log.usuario}</strong></td>
                            <td><span style="font-weight: bold; ${colorAccion}">${log.accion}</span></td>
                            <td style="font-size: 13px;">${log.detalles}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
                
            } catch (error) {
                console.error("Error al cargar auditoría:", error);
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error cargando registros: ${error.message}</td></tr>`;
            }
        };

        window.guardarReventa = async function() {
            const desc = document.getElementById('rev-desc').value.trim();
            const cliente = document.getElementById('rev-cliente').value.trim();
            const intermediario = document.getElementById('rev-intermediario').value.trim();
            if (!desc) { alert("Por favor ingresa una descripción para la operación."); return; }
            
            const calc = window.calcularReventa();
            
            const dataToSave = {
                descripcion: desc,
                cliente: cliente,
                intermediario: intermediario,
                ventaUSD: calc.venta,
                costoUSD: calc.costo,
                gastosUSD: calc.gastos,
                porcentajeComision: calc.porcentaje,
                gananciaBrutaUSD: calc.gananciaBruta,
                comisionTerceroUSD: calc.comisionTercero,
                gananciaNetaUSD: calc.gananciaNeta,
                tasaCambioVES: calc.tasaVES,
                tasaCambioEUR: calc.tasaEUR
            };
            
            try {
                if (window.idReventaEditando) {
                    const docRef = doc(db, "reventas_gastos", window.idReventaEditando);
                    await updateDoc(docRef, dataToSave);
                    window.registrarAuditoria("EDITAR REVENTA", "Se actualizó la reventa con ID: " + window.idReventaEditando + " (" + desc + ")");
                    alert("Operación de reventa actualizada con éxito.");
                    
                    window.idReventaEditando = null;
                    const btnGuardar = document.querySelector('#tab-reventas .btn-confirm-order');
                    if (btnGuardar) {
                        btnGuardar.style.background = "#385723";
                        btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Operación';
                    }
                } else {
                    dataToSave.fecha = new Date().toLocaleDateString("es-VE");
                    dataToSave.timestamp = new Date().getTime();
                    await addDoc(collection(db, "reventas_gastos"), dataToSave);
                    window.registrarAuditoria("CREAR REVENTA", "Se registró la reventa: " + desc);
                    alert("Operación de reventa registrada con éxito.");
                }
                
                document.getElementById('rev-desc').value = "";
                document.getElementById('rev-cliente').value = "";
                document.getElementById('rev-intermediario').value = "";
                document.getElementById('rev-venta').value = "";
                document.getElementById('rev-costo').value = "";
                document.getElementById('rev-gastos').value = "";
                document.getElementById('rev-porcentaje').value = "50";
                
                if (window.resetMonedasReventa) {
                    window.resetMonedasReventa();
                }

                window.calcularReventa();
                window.cargarHistorialReventas();
                
                if (window.calcularGananciaNetaDashboard) {
                    await window.calcularGananciaNetaDashboard(window.tasaVivaBCV || 42.00, window.tasaVivaEUR || 1.08);
                }

            } catch (e) {
                console.error(e);
                alert("Error al guardar la operación.");
            }
        };

        window.eliminarReventa = async function(docId) {
            if(!confirm("¿Eliminar esta operación de reventa?")) return;
            try {
                await deleteDoc(doc(db, "reventas_gastos", docId));
                if(window.registrarAuditoria) window.registrarAuditoria("ELIMINAR REVENTA", "Se eliminó la reventa con ID: " + docId);
                window.cargarHistorialReventas();
                if(window.cargarDashboard) window.cargarDashboard();
            } catch (error) { console.error(error); alert("Error al eliminar la reventa."); }
        };

        window.generarCierreMensual = async function() {
            const mes = document.getElementById('cierre-mes').value;
            const anio = document.getElementById('cierre-anio').value;
            const btn = document.querySelector('button[onclick="generarCierreMensual()"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;

            try {
                if (typeof window.cargarHistorialReventas === 'function') {
                    try {
                        const bcvSnap = await getDoc(doc(db, "configuracion", "tasa_bcv"));
                        if(bcvSnap.exists()) window.tasaReventaBCV = parseFloat(bcvSnap.data().Valor) || parseFloat(bcvSnap.data().valor) || window.tasaReventaBCV || 1;
                        const eurSnap = await getDoc(doc(db, "configuracion", "tasa_euro"));
                        if(eurSnap.exists()) window.tasaReventaEUR = parseFloat(eurSnap.data().Valor) || parseFloat(eurSnap.data().valor) || window.tasaReventaEUR || 1;
                    } catch(e) {}
                }

                const snap = await getDocs(collection(db, "reventas_gastos"));
                const operaciones = [];
                let totInvertido = 0;
                let totIngresos = 0;
                let totComisiones = 0;
                let totNeta = 0;

                const targetMes = parseInt(mes, 10);
                const targetAnio = parseInt(anio, 10);

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    let matchDate = false;
                    
                    if (data.fecha) {
                        const parts = data.fecha.split('/');
                        if (parts.length >= 3) {
                            if (parseInt(parts[1], 10) === targetMes && parseInt(parts[2], 10) === targetAnio) {
                                matchDate = true;
                            }
                        }
                    }

                    if (matchDate) {
                        operaciones.push(data);
                        let costo = parseFloat(data.costoUSD) || 0;
                        let gasto = parseFloat(data.gastosUSD) || 0;
                        totInvertido += (costo + gasto);
                        totIngresos += parseFloat(data.ventaUSD) || 0;
                        totComisiones += parseFloat(data.comisionTerceroUSD) || 0;
                        totNeta += parseFloat(data.gananciaNetaUSD) || 0;
                    }
                });

                const tasaVES = window.tasaReventaBCV || 1;
                const tasaEUR = window.tasaReventaEUR || 1;

                const formatCur = (val, cur, rate) => {
                    return `${cur} ` + (val * rate).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
                };

                document.getElementById('cierre-invertido').innerText = `$${totInvertido.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-invertido-alt').innerText = `${formatCur(totInvertido, 'Bs.', tasaVES)} | ${formatCur(totInvertido, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-ingresos').innerText = `$${totIngresos.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-ingresos-alt').innerText = `${formatCur(totIngresos, 'Bs.', tasaVES)} | ${formatCur(totIngresos, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-comisiones').innerText = `$${totComisiones.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-comisiones-alt').innerText = `${formatCur(totComisiones, 'Bs.', tasaVES)} | ${formatCur(totComisiones, '€', 1/tasaEUR)}`;

                document.getElementById('cierre-neta').innerText = `$${totNeta.toLocaleString('en-US', {minimumFractionDigits:2})}`;
                document.getElementById('cierre-neta-alt').innerText = `${formatCur(totNeta, 'Bs.', tasaVES)} | ${formatCur(totNeta, '€', 1/tasaEUR)}`;

                const tbody = document.getElementById('cierre-table-body');
                if (operaciones.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay operaciones registradas en ${mes}/${anio}.</td></tr>`;
                } else {
                    operaciones.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
                    
                    let html = '';
                    operaciones.forEach(op => {
                        let costoTotal = (parseFloat(op.costoUSD)||0) + (parseFloat(op.gastosUSD)||0);
                        html += `
                            <tr>
                                <td>${op.fecha}</td>
                                <td><strong>${op.descripcion}</strong><br><span style="font-size:11px; color:#555;">${op.cliente || ''}</span></td>
                                <td>$${costoTotal.toFixed(2)}</td>
                                <td>$${(parseFloat(op.ventaUSD) || 0).toFixed(2)}</td>
                                <td><span style="color:#d9534f;">$${(parseFloat(op.comisionTerceroUSD) || 0).toFixed(2)}</span><br><span style="font-size:10px;">${op.intermediario || ''}</span></td>
                                <td><strong style="color:#385723;">$${(parseFloat(op.gananciaNetaUSD) || 0).toFixed(2)}</strong></td>
                            </tr>
                        `;
                    });
                    tbody.innerHTML = html;
                }

                window.datosCierreMensual = {
                    mes, anio,
                    totInvertido, totIngresos, totComisiones, totNeta,
                    operaciones,
                    tasaVES, tasaEUR
                };

            } catch (error) {
                console.error(error);
                alert("Error al generar el cierre mensual.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

        
        window.imprimirCierreMensual = function(formato) {
            const data = window.datosCierreMensual;
            if (!data) {
                alert("Primero debes generar el cierre haciendo clic en 'Generar Cierre'.");
                return;
            }
            if (!data.operaciones || data.operaciones.length === 0) {
                alert("No hay operaciones para imprimir en este periodo.");
                return;
            }

            const isTermico = formato === 'termico';
            const numes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mesNombre = numes[parseInt(data.mes, 10)];
            const fechaReporte = new Date().toLocaleDateString('es-VE');

            let filasHtml = '';
            data.operaciones.forEach(op => {
                const ganancia = parseFloat(op.gananciaNetaUSD) || 0;
                if (isTermico) {
                    filasHtml += `<tr><td colspan="2" style="font-weight:bold; padding-top:4px;">${op.descripcion}</td></tr>
                                 <tr><td style="border-bottom:1px dashed #ccc; padding-bottom:4px;">${op.fecha} | Neta:</td>
                                 <td style="border-bottom:1px dashed #ccc; padding-bottom:4px; text-align:right;">$${ganancia.toFixed(2)}</td></tr>`;
                } else {
                    const costoTotal = (parseFloat(op.costoUSD)||0) + (parseFloat(op.gastosUSD)||0);
                    filasHtml += `<tr>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee;">${op.fecha}</td>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee;">${op.descripcion}</td>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee;">$${costoTotal.toFixed(2)}</td>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee;">$${(parseFloat(op.ventaUSD)||0).toFixed(2)}</td>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee; color:#d9534f;">$${(parseFloat(op.comisionTerceroUSD)||0).toFixed(2)}</td>
                                 <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight:bold; color:#385723;">$${ganancia.toFixed(2)}</td>
                                 </tr>`;
                }
            });

            let htmlContent = '';
            if (isTermico) {
                htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: 58mm 180mm; margin: 0 !important; }
        html, body { width: 48mm !important; max-width: 48mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; font-family: monospace; font-size: 11px; color: #000; }
        .ticket-container { padding: 10px 5px; }
        h3 { font-size: 14px; margin-bottom: 2px; text-align: center; }
        p { margin: 2px 0; text-align: center; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; font-size: 11px; border-collapse: collapse; color: #000; }
        td { padding: 2px 0; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .no-print { display: none !important; }
    </style>
</head>
<body>
    <div class="ticket-container">
        <h3>INVERSIONES FB PARTS, C.A.</h3>
        <p>RIF: J-50478082-4</p>
        <p>Urb. La Candelaria, Caracas</p>
        <div class="line"></div>
        <p class="bold">CIERRE MENS. ${mesNombre.toUpperCase()} ${data.anio}</p>
        <p>Generado: ${fechaReporte}</p>
        <div class="line"></div>
        <p style="text-align:left;">Inv. Total: <span style="float:right;">$${(parseFloat(data.totInvertido)||0).toFixed(2)}</span></p>
        <p style="text-align:left;">Ventas Total: <span style="float:right;">$${(parseFloat(data.totIngresos)||0).toFixed(2)}</span></p>
        <p style="text-align:left;">Comisiones: <span style="float:right;">-$${(parseFloat(data.totComisiones)||0).toFixed(2)}</span></p>
        <div class="line"></div>
        <p style="text-align:left;" class="bold">GANANCIA NETA: <span style="float:right;">$${(parseFloat(data.totNeta)||0).toFixed(2)}</span></p>
        <div class="line"></div>
        <table>${filasHtml}</table>
        <div class="line" style="margin-top:15px;"></div>
        <p style="margin-top:20px;">Firma Resp.</p>
        <p style="margin-top:30px;">__________________</p>
        <p style="margin-top:10px;font-weight:bold;">¡FIN DEL CIERRE!</p>
    </div>
</body>
</html>`;
            } else {
                htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; padding: 40px; color: #333; }
        h2 { color: #385723; margin-bottom: 5px; text-transform: uppercase; }
        p { margin: 3px 0; color: #666; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #385723; padding-bottom: 20px; margin-bottom: 20px; }
        .summary-grid { display: flex; gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f9f9f9; padding: 15px; border-radius: 8px; flex: 1; border: 1px solid #eee; text-align: center; }
        .summary-card h3 { margin: 5px 0; font-size: 22px; color: #333; }
        .summary-card p { font-size: 12px; margin:0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size:13px; }
        th { background: #385723; color: white; padding: 10px 8px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
        .sig-box { text-align: center; width: 250px; border-top: 1px solid #333; padding-top: 10px; }
        @media print { body { padding: 0; margin: 20mm; } .no-print { display: none !important; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h2>INVERSIONES FB PARTS, C.A.</h2>
            <p>RIF: J-50478082-4</p>
            <p>Urb. La Candelaria, Caracas</p>
        </div>
        <div style="text-align: right;">
            <h3 style="margin:0; color:#385723;">CIERRE DE MES</h3>
            <p>Período: <strong>${mesNombre} ${data.anio}</strong></p>
            <p>Generado: ${fechaReporte}</p>
        </div>
    </div>
    <div class="summary-grid">
        <div class="summary-card"><p>Inversión Total</p><h3>$${(parseFloat(data.totInvertido)||0).toFixed(2)}</h3></div>
        <div class="summary-card"><p>Ingresos Brutos</p><h3>$${(parseFloat(data.totIngresos)||0).toFixed(2)}</h3></div>
        <div class="summary-card"><p>Comisiones a Terceros</p><h3 style="color:#d9534f;">-$${(parseFloat(data.totComisiones)||0).toFixed(2)}</h3></div>
        <div class="summary-card" style="background:#e8f4ed; border-color:#385723;"><p style="color:#385723;font-weight:bold;">GANANCIA NETA</p><h3 style="color:#385723;">$${(parseFloat(data.totNeta)||0).toFixed(2)}</h3></div>
    </div>
    <div>
        <p style="text-align:left; font-weight:bold; margin-top:10px;">Desglose Operaciones:</p>
        <table>
            <tr><th>Fecha</th><th>Descripción</th><th>Costo (Ref)</th><th>Venta (Ref)</th><th>Comisión (Ref)</th><th>Ganancia Neta</th></tr>
            ${filasHtml}
        </table>
        <div class="signatures">
            <div class="sig-box"><p>Elaborado por</p></div>
            <div class="sig-box"><p>Revisado por</p></div>
        </div>
    </div>
</body>
</html>`;
            }

            let iframe = document.getElementById('printFrameCierre');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'printFrameCierre';
                iframe.style.position = 'absolute';
                iframe.style.width = '0px';
                iframe.style.height = '0px';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
            }
            
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 500);
        };

        window.cargarHistorialReventas = async function() {
            // Reutilizando la lógica de extracción de tasas de Firebase (igual al Dashboard)
            try {
                const bcvSnap = await getDoc(doc(db, "configuracion", "tasa_bcv"));
                if(bcvSnap.exists()) {
                    const val = parseFloat(bcvSnap.data().Valor) || parseFloat(bcvSnap.data().valor);
                    if (val > 0) {
                        window.tasaReventaBCV = val;
                        if (!window.tasaVivaBCV) window.tasaVivaBCV = val;
                        window._ultimoUsdBcv = val;
                        if (window.actualizarEstadoModoBsReventas) {
                            window.actualizarEstadoModoBsReventas();
                        }
                    }
                }
                const eurSnap = await getDoc(doc(db, "configuracion", "tasa_euro"));
                if(eurSnap.exists()) {
                    window.tasaReventaEUR = parseFloat(eurSnap.data().Valor) || parseFloat(eurSnap.data().valor) || window.tasaReventaEUR;
                }
                // Refrescar cálculos visuales con las nuevas tasas
                window.calcularReventa();
            } catch(e) { console.warn("Error leyendo tasas para reventas"); }

            const tbody = document.getElementById('reventas-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando historial de reventas...</td></tr>';
            
            try {
                const snap = await getDocs(collection(db, "reventas_gastos"));
                if (snap.empty) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay operaciones registradas.</td></tr>';
                    return;
                }
                
                // Inicializar selectores si no tienen valor o es primera carga
                const elMes = document.getElementById('historial-rev-mes');
                const elAnio = document.getElementById('historial-rev-anio');
                const hoy = new Date();
                
                if (elMes && !window._reventasFiltroInicializado) {
                    elMes.value = (hoy.getMonth() + 1).toString();
                    elAnio.value = hoy.getFullYear().toString();
                    window._reventasFiltroInicializado = true;
                }

                const targetMes = elMes ? parseInt(elMes.value, 10) : (hoy.getMonth() + 1);
                const targetAnio = elAnio ? parseInt(elAnio.value, 10) : hoy.getFullYear();

                let html = '';
                let totalNeta = 0;
                
                let reventas = [];
                snap.forEach(docSnap => reventas.push({ id: docSnap.id, ...docSnap.data() }));
                
                // Filtrar por fecha
                reventas = reventas.filter(rev => {
                    if (!rev.fecha) return false;
                    const parts = rev.fecha.split('/');
                    if (parts.length >= 3) {
                        return parseInt(parts[1], 10) === targetMes && parseInt(parts[2], 10) === targetAnio;
                    }
                    return false;
                });

                // Ordenar por timestamp (más recientes primero)
                reventas.sort((a, b) => b.timestamp - a.timestamp);
                
                if (reventas.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No hay operaciones registradas en el mes seleccionado.</td></tr>`;
                    return;
                }

                reventas.forEach(rev => {
                    const costoTotal = (rev.costoUSD || 0) + (rev.gastosUSD || 0);
                    // Usa la tasa histórica grabada, sino usa la global actual
                    const tasaUsoVES = rev.tasaCambioVES || window.tasaReventaBCV;
                    const ventaVES = ((rev.ventaUSD || 0) * tasaUsoVES).toFixed(2);
                    const netaVES = ((rev.gananciaNetaUSD || 0) * tasaUsoVES).toFixed(2);
                    
                    totalNeta += (rev.gananciaNetaUSD || 0);
                    
                    html += `
                        <tr>
                            <td>${rev.fecha}</td>
                            <td><strong>${rev.descripcion}</strong><br><span style="font-size:11px; color:#555;">Cliente: ${rev.cliente || 'N/A'}</span></td>
                            <td>$${(rev.ventaUSD || 0).toFixed(2)}<br><span style="font-size:10px; color:#666;">Bs.${ventaVES}</span></td>
                            <td>$${costoTotal.toFixed(2)}</td>
                            <td>${rev.intermediario || 'N/A'}<br><span style="color: #d9534f; font-weight: bold;">$${(rev.comisionTerceroUSD || 0).toFixed(2)}</span></td>
                            <td><span style="color: #385723; font-weight: bold;">$${(rev.gananciaNetaUSD || 0).toFixed(2)}</span><br><span style="font-size:10px; color:#666;">Bs.${netaVES}</span></td>
                            <td style="text-align: center; vertical-align: middle;">
                                <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                                    <button type="button" onclick="editarReventa('${rev.id}')" style="background:#1d6fa5; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Editar"><i class="fas fa-edit"></i></button>
                                    <button type="button" onclick="eliminarReventa('${rev.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                
                // Añadir fila de totales
                html += `
                    <tr style="background: #f4f8f5; font-weight: bold; border-top: 2px solid #385723;">
                        <td colspan="5" style="text-align: right; color: #385723;">TOTAL GANANCIA NETA GLOBAL:</td>
                        <td colspan="2" style="color: #385723; font-size: 16px;">$${totalNeta.toFixed(2)}</td>
                    </tr>
                `;
                
                tbody.innerHTML = html;
                
            } catch (error) {
                console.error("Error cargando reventas:", error);
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar el historial: ${error.message}</td></tr>`;
            }
        };

        // =========================================================================
        // 💰 PUENTE DE DATOS: MIGRACIÓN DE PEDIDOS A CONTROL DE REVENTAS (ALTA FLUIDEZ + MULTIDIVISA)
        // =========================================================================

        window._migrarReventasState = [];
        window._rafMigrar = null;

        function _obtenerTasaMigrarBCV() {
            let t = (window.obtenerTasaBCVActual && window.obtenerTasaBCVActual()) || window.tasaVivaBCV || window._ultimoUsdBcv || window.tasaReventaBCV || 0;
            if (t > 0) return t;
            const tickerEl = document.getElementById('ticker-dolar-bcv');
            if (tickerEl) {
                const parsed = parseFloat(tickerEl.textContent.replace(/[^\d.,]/g, '').replace(',', '.'));
                if (parsed > 0) return parsed;
            }
            return 42.00;
        }

        window.abrirModalMigrarReventa = async function(docId) {
            let ped = (window.pedidosDBLocal && window.pedidosDBLocal[docId]) || 
                      (window._pedidosTodosCache && window._pedidosTodosCache.find(p => p.id === docId));
            
            if (!ped) {
                try {
                    const snap = await getDoc(doc(db, "pedidos", docId));
                    if (snap.exists()) {
                        ped = { id: snap.id, ...snap.data() };
                        if (!window.pedidosDBLocal) window.pedidosDBLocal = {};
                        window.pedidosDBLocal[docId] = ped;
                    }
                } catch(e) {
                    console.error("Error al buscar pedido para migración:", e);
                }
            }

            if (!ped) {
                alert("⚠️ No se encontró la información del pedido seleccionado.");
                return;
            }

            // Determinar correlativo / número de orden
            let numOrden = '';
            if (window._pedidosTodosCache && Array.isArray(window._pedidosTodosCache)) {
                const idx = window._pedidosTodosCache.findIndex(p => p.id === docId);
                if (idx !== -1) numOrden = (idx + 1).toString();
            }
            if (!numOrden) numOrden = docId.substring(0, 6).toUpperCase();

            // Configurar cabecera
            const elId = document.getElementById('migrar-pedido-id');
            const elNum = document.getElementById('migrar-num-orden');
            const elTxtNum = document.getElementById('migrar-pedido-numero');
            const elTxtCli = document.getElementById('migrar-pedido-cliente');
            const elTxtFec = document.getElementById('migrar-pedido-fecha');
            const elTxtTot = document.getElementById('migrar-pedido-total');

            if (elId) elId.value = docId;
            if (elNum) elNum.value = numOrden;
            if (elTxtNum) elTxtNum.textContent = '#' + numOrden;
            if (elTxtCli) elTxtCli.textContent = ped.cliente || 'Cliente General';
            if (elTxtFec) elTxtFec.textContent = ped.fecha || new Date().toLocaleDateString('es-VE');
            if (elTxtTot) elTxtTot.textContent = '$' + Number(ped.total || 0).toFixed(2);

            // Resetear inputs globales de intermediario
            const elGlobalInterm = document.getElementById('migrar-global-intermediario');
            const elGlobalPct = document.getElementById('migrar-global-porcentaje');
            if (elGlobalInterm) elGlobalInterm.value = '';
            if (elGlobalPct) elGlobalPct.value = '';

            // Extraer lista de productos
            let productos = [];
            if (ped.productos && Array.isArray(ped.productos) && ped.productos.length > 0) {
                productos = ped.productos;
            } else if (ped.producto) {
                productos = [{
                    nombre: ped.producto,
                    cantidad: ped.cantidad || 1,
                    precio: ped.total || 0
                }];
            }

            const tbody = document.getElementById('migrar-items-tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (productos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">Este pedido no tiene repuestos asociados para migrar.</td></tr>';
                const modal = document.getElementById('modal-migrar-reventas');
                if (modal) modal.style.display = 'flex';
                return;
            }

            const totalGeneral = parseFloat(ped.total) || 0;
            const tienePrecios = productos.some(p => parseFloat(p.precio) > 0);

            window._migrarReventasState = [];

            productos.forEach((p, index) => {
                const cant = parseInt(p.cantidad) || 1;
                const nombreLimpio = (p.nombre || p.descripcion || p.producto || `Repuesto #${index + 1}`).trim();
                const descTexto = `${cant}x ${nombreLimpio}`;

                let ventaLinea = 0;
                if (parseFloat(p.precio) > 0) {
                    ventaLinea = Math.round((parseFloat(p.precio) * cant) * 100) / 100;
                } else if (!tienePrecios && totalGeneral > 0) {
                    ventaLinea = Math.round((totalGeneral / productos.length) * 100) / 100;
                }

                const item = {
                    index: index,
                    desc: descTexto,
                    originalName: p.nombre || '',
                    cantidad: cant,
                    nombreInterm: '',
                    excluido: false,
                    ventaUSD: ventaLinea,
                    monedaCosto: 'USD',
                    costoRaw: 0,
                    costoUSD: 0,
                    monedaGastos: 'USD',
                    gastosRaw: 0,
                    gastosUSD: 0,
                    porcentaje: 0,
                    gananciaBruta: ventaLinea,
                    comisionTercero: 0,
                    gananciaNeta: ventaLinea
                };
                window._migrarReventasState.push(item);

                const tr = document.createElement('tr');
                tr.id = `migrar-row-${index}`;
                tr.className = 'migrar-reventa-row';
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.innerHTML = `
                    <!-- 1. DESCRIPCIÓN -->
                    <td style="padding: 10px 10px; vertical-align: top;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Detalle de Pieza</span>
                            <button type="button" onclick="window.eliminarFilaMigrarReventa(${index})" style="background: none; border: none; color: #ef4444; font-size: 10.5px; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline;" title="Quitar este repuesto de la migración">Excluir</button>
                        </div>
                        <input type="text" id="migrar-desc-${index}" class="migrar-item-desc" value="${descTexto}" style="width: 100%; height: 34px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: #1e293b; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#385723';" onblur="this.style.borderColor='#cbd5e1';">
                        <input type="hidden" id="migrar-interm-${index}" class="migrar-item-nombre-interm" value="">
                        <div style="height: 16px; min-height: 16px; margin-top: 4px; display: flex; align-items: center; font-size: 10.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span>Cant: <strong style="color: #1e293b;">${cant}</strong> | Original: ${p.nombre || ''}</span>
                        </div>
                    </td>

                    <!-- 2. PRECIO VENTA -->
                    <td style="padding: 10px 8px; vertical-align: top;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end;">
                            <span style="font-size: 10px; font-weight: 700; color: #047857; background: #eef5eb; border: 1px solid #c5e1a5; padding: 1px 6px; border-radius: 3px; letter-spacing: 0.3px;">Fijo USD</span>
                        </div>
                        <div style="position: relative; width: 100%;">
                            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; font-weight: bold; color: #047857; pointer-events: none;">$</span>
                            <input type="number" step="any" min="0" id="migrar-venta-inp-${index}" class="migrar-item-venta" value="${ventaLinea.toFixed(2)}" oninput="window.recalcularFilaYTotales(${index})" style="width: 100%; height: 34px; padding: 0 8px 0 22px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: bold; text-align: right; color: #047857; background: #f0fdf4; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#385723';" onblur="this.style.borderColor='#cbd5e1';">
                        </div>
                        <div id="migrar-venta-help-${index}" style="height: 16px; min-height: 16px; margin-top: 4px; font-size: 10px; color: #047857; font-weight: 600; text-align: right; display: flex; align-items: center; justify-content: flex-end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                    </td>

                    <!-- 3. COSTO COMPRA -->
                    <td style="padding: 10px 8px; vertical-align: top;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end;">
                            <div style="display: inline-flex; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #eef3f0; padding: 1px;">
                                <button type="button" id="migrar-costo-curr-usd-${index}" onclick="window.cambiarMonedaFilaMigrar(${index}, 'costo', 'USD')" style="border: none; background: #385723; color: #ffffff; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 2px; cursor: pointer; transition: all 0.15s; line-height: 1.2;">USD</button>
                                <button type="button" id="migrar-costo-curr-ves-${index}" onclick="window.cambiarMonedaFilaMigrar(${index}, 'costo', 'VES')" style="border: none; background: transparent; color: #4b5563; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 2px; cursor: pointer; transition: all 0.15s; line-height: 1.2;">Bs</button>
                            </div>
                        </div>
                        <div style="position: relative; width: 100%;">
                            <span id="migrar-costo-pfx-${index}" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; font-weight: bold; color: #64748b; pointer-events: none;">$</span>
                            <input type="number" step="any" min="0" id="migrar-costo-inp-${index}" class="migrar-item-costo" value="0.00" placeholder="0.00" oninput="window.recalcularFilaYTotales(${index})" style="width: 100%; height: 34px; padding: 0 8px 0 22px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-align: right; color: #1e293b; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#385723';" onblur="this.style.borderColor='#cbd5e1';">
                        </div>
                        <div id="migrar-costo-help-${index}" style="height: 16px; min-height: 16px; margin-top: 4px; font-size: 10px; color: #166534; font-weight: 600; text-align: right; display: flex; align-items: center; justify-content: flex-end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                    </td>

                    <!-- 4. GASTOS OP. -->
                    <td style="padding: 10px 8px; vertical-align: top;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end;">
                            <div style="display: inline-flex; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #eef3f0; padding: 1px;">
                                <button type="button" id="migrar-gastos-curr-usd-${index}" onclick="window.cambiarMonedaFilaMigrar(${index}, 'gastos', 'USD')" style="border: none; background: #385723; color: #ffffff; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 2px; cursor: pointer; transition: all 0.15s; line-height: 1.2;">USD</button>
                                <button type="button" id="migrar-gastos-curr-ves-${index}" onclick="window.cambiarMonedaFilaMigrar(${index}, 'gastos', 'VES')" style="border: none; background: transparent; color: #4b5563; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 2px; cursor: pointer; transition: all 0.15s; line-height: 1.2;">Bs</button>
                            </div>
                        </div>
                        <div style="position: relative; width: 100%;">
                            <span id="migrar-gastos-pfx-${index}" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; font-weight: bold; color: #64748b; pointer-events: none;">$</span>
                            <input type="number" step="any" min="0" id="migrar-gastos-inp-${index}" class="migrar-item-gastos" value="0.00" placeholder="0.00" oninput="window.recalcularFilaYTotales(${index})" style="width: 100%; height: 34px; padding: 0 8px 0 22px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-align: right; color: #1e293b; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#385723';" onblur="this.style.borderColor='#cbd5e1';">
                        </div>
                        <div id="migrar-gastos-help-${index}" style="height: 16px; min-height: 16px; margin-top: 4px; font-size: 10px; color: #166534; font-weight: 600; text-align: right; display: flex; align-items: center; justify-content: flex-end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                    </td>

                    <!-- 5. % INTERMEDIARIO -->
                    <td style="padding: 10px 8px; vertical-align: top;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end;">
                            <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Comisión</span>
                        </div>
                        <input type="number" step="0.1" min="0" max="100" id="migrar-pct-inp-${index}" class="migrar-item-porcentaje" value="0" placeholder="0" oninput="window.recalcularFilaYTotales(${index})" style="width: 100%; height: 34px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-align: right; color: #1e293b; background: #fff; box-sizing: border-box; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#385723';" onblur="this.style.borderColor='#cbd5e1';">
                        <div style="height: 16px; min-height: 16px; margin-top: 4px; font-size: 10px; color: #64748b; text-align: right; display: flex; align-items: center; justify-content: flex-end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">% ganancia</div>
                    </td>

                    <!-- 6. NETA EMPRESA -->
                    <td style="padding: 10px 12px; vertical-align: top; text-align: right;">
                        <div style="height: 20px; margin-bottom: 4px; display: flex; align-items: center; justify-content: flex-end;">
                            <span style="font-size: 10px; font-weight: 700; color: #385723; text-transform: uppercase;">Resultado</span>
                        </div>
                        <div style="height: 34px; display: flex; align-items: center; justify-content: flex-end;">
                            <span id="migrar-neta-usd-${index}" class="neta-usd" style="font-size: 15px; font-weight: 800; color: #385723; line-height: 1;">$${ventaLinea.toFixed(2)}</span>
                        </div>
                        <div style="height: 16px; min-height: 16px; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <span id="migrar-comis-usd-${index}" style="font-size: 9.5px; color: #d9534f; font-weight: 600; display: none;"></span>
                            <span id="migrar-neta-ves-${index}" class="neta-ves" style="font-size: 10px; color: #64748b;">Bs. 0.00</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);

                window.recalcularFilaYTotales(index);
            });

            window.actualizarTotalesModalMigrar();
            const modal = document.getElementById('modal-migrar-reventas');
            if (modal) modal.style.display = 'flex';
        };

        window.cerrarModalMigrarReventa = function() {
            const modal = document.getElementById('modal-migrar-reventas');
            if (modal) modal.style.display = 'none';
        };

        window.cambiarMonedaFilaMigrar = function(index, campo, targetCurrency) {
            const item = window._migrarReventasState && window._migrarReventasState[index];
            if (!item) return;

            const prop = campo === 'costo' ? 'monedaCosto' : 'monedaGastos';
            if (item[prop] === targetCurrency) return;

            item[prop] = targetCurrency;

            const btnUsd = document.getElementById(`migrar-${campo}-curr-usd-${index}`);
            const btnVes = document.getElementById(`migrar-${campo}-curr-ves-${index}`);
            const pfx = document.getElementById(`migrar-${campo}-pfx-${index}`);
            const inp = document.getElementById(`migrar-${campo}-inp-${index}`);

            if (targetCurrency === 'VES') {
                if (btnUsd) { btnUsd.style.background = 'transparent'; btnUsd.style.color = '#4b5563'; }
                if (btnVes) { btnVes.style.background = '#385723'; btnVes.style.color = '#ffffff'; }
                if (pfx) { pfx.textContent = 'Bs.'; pfx.style.fontSize = '11px'; }
                if (inp) {
                    inp.style.paddingLeft = '28px';
                    inp.focus();
                }
            } else {
                if (btnUsd) { btnUsd.style.background = '#385723'; btnUsd.style.color = '#ffffff'; }
                if (btnVes) { btnVes.style.background = 'transparent'; btnVes.style.color = '#4b5563'; }
                if (pfx) { pfx.textContent = '$'; pfx.style.fontSize = '12px'; }
                if (inp) {
                    inp.style.paddingLeft = '22px';
                    inp.focus();
                }
            }

            window.recalcularFilaYTotales(index);
        };

        window.recalcularFilaYTotales = function(index) {
            const item = window._migrarReventasState && window._migrarReventasState[index];
            if (!item || item.excluido) {
                window.programarActualizacionTotales();
                return;
            }

            const tasaBCV = _obtenerTasaMigrarBCV();

            const inpVenta = document.getElementById(`migrar-venta-inp-${index}`);
            const inpCosto = document.getElementById(`migrar-costo-inp-${index}`);
            const inpGastos = document.getElementById(`migrar-gastos-inp-${index}`);
            const inpPct = document.getElementById(`migrar-pct-inp-${index}`);

            const ventaVal = inpVenta ? (parseFloat(inpVenta.value) || 0) : item.ventaUSD;
            const costoVal = inpCosto ? (parseFloat(inpCosto.value) || 0) : item.costoRaw;
            const gastosVal = inpGastos ? (parseFloat(inpGastos.value) || 0) : item.gastosRaw;
            const pctVal = inpPct ? (parseFloat(inpPct.value) || 0) : item.porcentaje;

            item.ventaUSD = Math.round(Math.max(0, ventaVal) * 100) / 100;
            item.costoRaw = Math.round(Math.max(0, costoVal) * 100) / 100;
            item.gastosRaw = Math.round(Math.max(0, gastosVal) * 100) / 100;
            item.porcentaje = Math.round(Math.max(0, Math.min(100, pctVal)) * 10) / 10;

            // Normalización a USD en tiempo real
            if (item.monedaCosto === 'VES') {
                item.costoUSD = tasaBCV > 0 ? (Math.round((item.costoRaw / tasaBCV) * 100) / 100) : 0;
            } else {
                item.costoUSD = item.costoRaw;
            }

            if (item.monedaGastos === 'VES') {
                item.gastosUSD = tasaBCV > 0 ? (Math.round((item.gastosRaw / tasaBCV) * 100) / 100) : 0;
            } else {
                item.gastosUSD = item.gastosRaw;
            }

            // Ganancia Bruta = Venta - CostoUSD - GastosUSD
            const gananciaBruta = Math.round((item.ventaUSD - item.costoUSD - item.gastosUSD) * 100) / 100;
            const comisionTercero = (gananciaBruta > 0 && item.porcentaje > 0) ? (Math.round((gananciaBruta * (item.porcentaje / 100)) * 100) / 100) : 0;
            const gananciaNeta = Math.round((gananciaBruta - comisionTercero) * 100) / 100;
            const netaVES = Math.round((gananciaNeta * tasaBCV) * 100) / 100;

            item.gananciaBruta = gananciaBruta;
            item.comisionTercero = comisionTercero;
            item.gananciaNeta = gananciaNeta;

            // Actualizar referencias visuales (helper text) sin reconstruir DOM
            const helpCosto = document.getElementById(`migrar-costo-help-${index}`);
            if (helpCosto) {
                if (tasaBCV > 0) {
                    if (item.monedaCosto === 'VES') {
                        helpCosto.textContent = `≈ $${item.costoUSD.toFixed(2)}`;
                    } else {
                        const eqVES = (item.costoUSD * tasaBCV).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        helpCosto.textContent = `≈ Bs. ${eqVES}`;
                    }
                } else {
                    helpCosto.textContent = '≈ $0.00';
                }
            }

            const helpGastos = document.getElementById(`migrar-gastos-help-${index}`);
            if (helpGastos) {
                if (tasaBCV > 0) {
                    if (item.monedaGastos === 'VES') {
                        helpGastos.textContent = `≈ $${item.gastosUSD.toFixed(2)}`;
                    } else {
                        const eqVES = (item.gastosUSD * tasaBCV).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        helpGastos.textContent = `≈ Bs. ${eqVES}`;
                    }
                } else {
                    helpGastos.textContent = '≈ $0.00';
                }
            }

            const helpVenta = document.getElementById(`migrar-venta-help-${index}`);
            if (helpVenta) {
                if (tasaBCV > 0) {
                    const eqVES = (item.ventaUSD * tasaBCV).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    helpVenta.textContent = `≈ Bs. ${eqVES}`;
                } else {
                    helpVenta.textContent = '≈ Bs. 0.00';
                }
            }

            // Actualizar Neta Empresa de la fila
            const netaUsdEl = document.getElementById(`migrar-neta-usd-${index}`);
            const netaVesEl = document.getElementById(`migrar-neta-ves-${index}`);
            const comisEl = document.getElementById(`migrar-comis-usd-${index}`);

            if (netaUsdEl) {
                netaUsdEl.textContent = (gananciaNeta >= 0 ? '$' : '-$') + Math.abs(gananciaNeta).toFixed(2);
                netaUsdEl.style.color = gananciaNeta >= 0 ? '#385723' : '#dc2626';
            }
            if (netaVesEl) {
                netaVesEl.textContent = 'Bs. ' + netaVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            if (comisEl) {
                if (comisionTercero > 0) {
                    comisEl.style.display = 'block';
                    comisEl.textContent = `Comis: $${comisionTercero.toFixed(2)}`;
                } else {
                    comisEl.style.display = 'none';
                }
            }

            window.programarActualizacionTotales();
        };

        window.programarActualizacionTotales = function() {
            if (window._rafMigrar) {
                cancelAnimationFrame(window._rafMigrar);
            }
            window._rafMigrar = requestAnimationFrame(() => {
                window.actualizarTotalesModalMigrar();
            });
        };

        window.actualizarTotalesModalMigrar = function() {
            const items = window._migrarReventasState || [];
            let totVenta = 0, totCosto = 0, totGastos = 0, totComision = 0, totNeta = 0;

            for (const item of items) {
                if (item.excluido) continue;
                totVenta += item.ventaUSD;
                totCosto += item.costoUSD;
                totGastos += item.gastosUSD;
                totComision += item.comisionTercero;
                totNeta += item.gananciaNeta;
            }

            totVenta = Math.round(totVenta * 100) / 100;
            totCosto = Math.round(totCosto * 100) / 100;
            totGastos = Math.round(totGastos * 100) / 100;
            totComision = Math.round(totComision * 100) / 100;
            totNeta = Math.round(totNeta * 100) / 100;

            const tasaBCV = _obtenerTasaMigrarBCV();
            const totNetaVES = Math.round((totNeta * tasaBCV) * 100) / 100;

            const elVentas = document.getElementById('migrar-res-ventas');
            const elCostos = document.getElementById('migrar-res-costos');
            const elGastos = document.getElementById('migrar-res-gastos');
            const elComis = document.getElementById('migrar-res-comision');
            const elNeta = document.getElementById('migrar-res-neta');
            const elNetaVES = document.getElementById('migrar-res-neta-ves');

            if (elVentas) elVentas.textContent = '$' + totVenta.toFixed(2);
            if (elCostos) elCostos.textContent = '$' + totCosto.toFixed(2);
            if (elGastos) elGastos.textContent = '$' + totGastos.toFixed(2);
            if (elComis) elComis.textContent = '$' + totComision.toFixed(2);
            if (elNeta) {
                elNeta.textContent = (totNeta >= 0 ? '$' : '-$') + Math.abs(totNeta).toFixed(2);
                elNeta.style.color = totNeta >= 0 ? '#385723' : '#dc2626';
            }
            if (elNetaVES) {
                elNetaVES.textContent = 'Bs. ' + totNetaVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
        };

        // Compatibilidad con llamadas previas
        window.calcularFilaMigrarReventa = function(inputEl) {
            if (!inputEl) return;
            const row = inputEl.closest('.migrar-reventa-row');
            if (!row) return;
            const match = row.id && row.id.match(/migrar-row-(\d+)/);
            if (match) {
                window.recalcularFilaYTotales(parseInt(match[1]));
            }
        };

        window.calcularTotalesModalMigrar = function() {
            window.actualizarTotalesModalMigrar();
        };

        window.eliminarFilaMigrarReventa = function(indexOrBtn) {
            let index = -1;
            if (typeof indexOrBtn === 'number') {
                index = indexOrBtn;
            } else if (indexOrBtn && indexOrBtn.closest) {
                const row = indexOrBtn.closest('.migrar-reventa-row');
                const match = row && row.id && row.id.match(/migrar-row-(\d+)/);
                if (match) index = parseInt(match[1]);
            }
            if (index < 0) return;

            const item = window._migrarReventasState && window._migrarReventasState[index];
            if (item) item.excluido = true;

            const row = document.getElementById(`migrar-row-${index}`);
            if (row) row.remove();

            const tbody = document.getElementById('migrar-items-tbody');
            const activos = (window._migrarReventasState || []).filter(it => !it.excluido);
            if (activos.length === 0 && tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">Todos los ítems fueron excluidos de la migración.</td></tr>';
            }
            window.actualizarTotalesModalMigrar();
        };

        window.aplicarIntermediarioGlobal = function() {
            const globalInterm = (document.getElementById('migrar-global-intermediario')?.value || '').trim();
            const globalPctRaw = parseFloat(document.getElementById('migrar-global-porcentaje')?.value);
            const globalPct = isNaN(globalPctRaw) ? 0 : Math.max(0, Math.min(100, Math.round(globalPctRaw * 10) / 10));

            const items = window._migrarReventasState || [];
            items.forEach((item, i) => {
                if (item.excluido) return;
                item.nombreInterm = globalInterm;
                item.porcentaje = globalPct;
                const inputPct = document.getElementById(`migrar-pct-inp-${i}`);
                const hiddenInterm = document.getElementById(`migrar-interm-${i}`);
                if (inputPct) inputPct.value = globalPct;
                if (hiddenInterm) hiddenInterm.value = globalInterm;
                window.recalcularFilaYTotales(i);
            });
        };

        window.guardarYRegistrarReventas = async function() {
            const docId = document.getElementById('migrar-pedido-id')?.value;
            const numOrden = document.getElementById('migrar-num-orden')?.value || '';
            const ped = (window.pedidosDBLocal && window.pedidosDBLocal[docId]) || {};
            const clienteFinal = ped.cliente || document.getElementById('migrar-pedido-cliente')?.textContent || 'Cliente';

            const items = (window._migrarReventasState || []).filter(it => !it.excluido);
            if (items.length === 0) {
                alert("⚠️ No hay repuestos disponibles en la lista para migrar.");
                return;
            }

            // Advertencia si ya fue procesado
            if (ped.estado === 'Procesado en Reventa') {
                const conf = confirm(`⚠️ Este pedido (#${numOrden}) ya tiene el estado 'Procesado en Reventa'.\n¿Deseas registrar nuevamente estas operaciones en el historial de reventas?`);
                if (!conf) return;
            }

            const btn = document.getElementById('btn-guardar-migrar-reventas');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando Reventas...';
            }

            try {
                const hoyStr = new Date().toLocaleDateString("es-VE");
                const timestamp = Date.now();
                const tasaVES = _obtenerTasaMigrarBCV();
                const tasaEUR = window.tasaReventaEUR || 1.08;

                const globalInterm = (document.getElementById('migrar-global-intermediario')?.value || '').trim();

                let totalNetaAcumulada = 0;
                let countRegistros = 0;

                for (const item of items) {
                    const descInp = document.getElementById(`migrar-desc-${item.index}`);
                    const desc = SecuritySanitizer.cleanText(descInp ? descInp.value : item.desc, 150) || 'Repuesto Reventa';

                    // Todos los montos viajan ya normalizados en USD
                    const venta = item.ventaUSD;
                    const costo = item.costoUSD;
                    const gastos = item.gastosUSD;
                    const pct = item.porcentaje;
                    const intermediario = item.nombreInterm || globalInterm || 'N/A';

                    const gananciaBruta = Math.round((venta - costo - gastos) * 100) / 100;
                    const comisionTercero = (gananciaBruta > 0 && pct > 0) ? Math.round((gananciaBruta * (pct / 100)) * 100) / 100 : 0;
                    const gananciaNeta = Math.round((gananciaBruta - comisionTercero) * 100) / 100;

                    totalNetaAcumulada += gananciaNeta;
                    countRegistros++;

                    const dataToSave = {
                        fecha: hoyStr,
                        timestamp: timestamp,
                        cliente: clienteFinal,
                        clienteFinal: clienteFinal,
                        descripcion: desc,
                        ventaUSD: venta,
                        precioVenta: venta,
                        costoUSD: costo,
                        costo: costo,
                        gastosUSD: gastos,
                        gastosOperativos: gastos,
                        intermediario: intermediario,
                        porcentajeComision: pct,
                        comisionTerceroUSD: comisionTercero,
                        comisionIntermediario: comisionTercero,
                        gananciaBrutaUSD: gananciaBruta,
                        gananciaNetaUSD: gananciaNeta,
                        netaEmpresa: gananciaNeta,
                        tasaCambioVES: tasaVES,
                        tasaCambioEUR: tasaEUR,
                        pedidoId: docId,
                        pedidoNumero: numOrden,
                        origen: `Migrado de Pedido #${numOrden}`,
                        monedaCostoOriginal: item.monedaCosto,
                        costoMontoOriginal: item.costoRaw,
                        monedaGastosOriginal: item.monedaGastos,
                        gastosMontoOriginal: item.gastosRaw
                    };

                    // Guardado en Firestore: reventas_gastos (utilizada por el panel de reventas) y reventas (respaldo)
                    await addDoc(collection(db, "reventas_gastos"), dataToSave);
                    try {
                        await addDoc(collection(db, "reventas"), dataToSave);
                    } catch (backupErr) {
                        console.warn("Respaldo secundario en colección reventas omitido:", backupErr);
                    }
                }

                // Cambiar el estado del pedido original a 'Procesado en Reventa'
                await updateDoc(doc(db, "pedidos", docId), {
                    estado: "Procesado en Reventa",
                    reventaProcesada: true,
                    reventaProcesadaFecha: hoyStr,
                    reventaProcesadaTimestamp: timestamp,
                    reventaTotalNeta: Math.round(totalNetaAcumulada * 100) / 100
                });

                // Registrar en Auditoría
                if (window.registrarAuditoria) {
                    window.registrarAuditoria("MIGRAR REVENTA", `Pedido #${numOrden} (${clienteFinal}) migrado a reventas: ${countRegistros} ítems registrados.`);
                }

                // Actualizar estado en memoria local
                if (window.pedidosDBLocal && window.pedidosDBLocal[docId]) {
                    window.pedidosDBLocal[docId].estado = "Procesado en Reventa";
                }
                if (window._pedidosTodosCache) {
                    const p = window._pedidosTodosCache.find(x => x.id === docId);
                    if (p) p.estado = "Procesado en Reventa";
                }

                // Cerrar modal
                window.cerrarModalMigrarReventa();

                // Recargar pedidos y reventas
                window.cargarPedidos();
                if (window.cargarHistorialReventas) window.cargarHistorialReventas();
                if (window.calcularGananciaNetaDashboard) {
                    await window.calcularGananciaNetaDashboard(window.tasaVivaBCV || 42.00, window.tasaVivaEUR || 1.08);
                }

                // Notificación visual de éxito con SweetAlert2 o alert nativo
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Reventas Registradas con Éxito!',
                        html: `
                            <p style="font-size: 14px; color: #475569; margin-bottom: 12px;">
                                Se generaron <b>${countRegistros} documento(s)</b> en el módulo de Reventas para <b>${clienteFinal}</b>.
                            </p>
                            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                                <span style="font-size: 11px; color: #166534; text-transform: uppercase; font-weight: bold; display: block;">Ganancia Neta Total Obtenida</span>
                                <strong style="font-size: 22px; color: #15803d;">$${totalNetaAcumulada.toFixed(2)}</strong>
                            </div>
                            <p style="font-size: 12px; color: #64748b;">
                                El pedido <b>#${numOrden}</b> fue actualizado a: <span class="badge-status-reventa" style="display: inline-block; vertical-align: middle;">Procesado en Reventa</span>
                            </p>
                        `,
                        showCancelButton: true,
                        confirmButtonColor: '#385723',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: '<i class="fas fa-calculator"></i> Ver en Reventas',
                        cancelButtonText: 'Continuar en Pedidos'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            const btnRev = document.querySelector('button[onclick*="mostrarPestana(\'reventas\'"]');
                            if (btnRev) window.mostrarPestana('reventas', btnRev);
                        }
                    });
                } else {
                    alert(`✅ ¡Reventas Registradas con Éxito!\n\nSe crearon ${countRegistros} registros de reventa para "${clienteFinal}".\nGanancia Neta Total: $${totalNetaAcumulada.toFixed(2)}\n\nEl pedido #${numOrden} ahora tiene estatus "Procesado en Reventa".`);
                }

            } catch (error) {
                console.error("Error al registrar reventas desde pedido:", error);
                alert("❌ Error al registrar las reventas: " + error.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save text-amber-300"></i> Guardar y Registrar Reventas';
                }
            }
        };

    


        // =====================================================
        // 🔁 SISTEMA DE CAMBIOS Y DEVOLUCIONES
        // =====================================================

        window.abrirModalCambioDev = function(docId) {
            const ped = window.pedidosDBLocal[docId];
            if (!ped) return alert('No se encontró el pedido.');
            document.getElementById('cambio-pedido-original-id').value = docId;
            document.getElementById('cambio-cliente').value = ped.cliente || '';
            document.getElementById('cambio-direccion').value = ped.direccion || ped.municipio || '';
            document.getElementById('cambio-envio').value = ped.envio || 'Motorizado';
            document.getElementById('cambio-motivo').value = '';
            const numOrden = Object.keys(window.pedidosDBLocal).indexOf(docId) + 1;
            document.getElementById('cambio-etiqueta').value = 'CAMBIO - Orden #' + numOrden;
            const container = document.getElementById('cambio-productos-container');
            container.innerHTML = '';
            const prods = Array.isArray(ped.productos) ? ped.productos
                : [{ nombre: ped.producto || '', cantidad: ped.cantidad || 1, precio: ped.total || 0 }];
            prods.forEach(p => window.agregarFilaCambioProducto(p.nombre, p.cantidad, p.precio));
            document.getElementById('modal-cambio-dev').style.display = 'flex';
        };

        window._cambioRowCount = 0;
        window.agregarFilaCambioProducto = function(nombre, cantidad, precio) {
            nombre = nombre || ''; cantidad = cantidad || 1; precio = precio || 0;
            const container = document.getElementById('cambio-productos-container');
            const rowId = 'cambio-row-' + (++window._cambioRowCount);
            const div = document.createElement('div');
            div.id = rowId;
            div.style = 'display:flex; gap:6px; align-items:center; margin-bottom:6px;';
            div.innerHTML = '<input type="text" placeholder="Nombre del producto" value="' + nombre + '" style="flex:3; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:12px;" class="cambio-prod-nombre">'
                + '<input type="number" placeholder="Cant" value="' + cantidad + '" min="1" style="flex:1; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:12px;" class="cambio-prod-cant">'
                + '<input type="number" placeholder="Precio $" value="' + precio + '" min="0" step="0.01" style="flex:1; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:12px;" class="cambio-prod-precio">'
                + '<button type="button" onclick="document.getElementById(\'' + rowId + '\').remove()" style="background:#c0392b; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">✕</button>';
            container.appendChild(div);
        };

        window.guardarCambioDev = async function() {
            const originalId = document.getElementById('cambio-pedido-original-id').value;
            const pedOriginal = window.pedidosDBLocal[originalId] || {};
            const etiqueta = document.getElementById('cambio-etiqueta').value.trim();
            const cliente = document.getElementById('cambio-cliente').value.trim();
            const direccion = document.getElementById('cambio-direccion').value.trim();
            const envio = document.getElementById('cambio-envio').value.trim();
            const motivo = document.getElementById('cambio-motivo').value.trim();
            if (!etiqueta || !cliente) { alert('Por favor, completa la etiqueta y el cliente.'); return; }
            const filas = document.querySelectorAll('#cambio-productos-container > div');
            const productos = [];
            let total = 0;
            filas.forEach(fila => {
                const nombre = fila.querySelector('.cambio-prod-nombre') ? fila.querySelector('.cambio-prod-nombre').value.trim() : '';
                const cant = parseFloat(fila.querySelector('.cambio-prod-cant') ? fila.querySelector('.cambio-prod-cant').value : 1) || 1;
                const prec = parseFloat(fila.querySelector('.cambio-prod-precio') ? fila.querySelector('.cambio-prod-precio').value : 0) || 0;
                if (nombre) { productos.push({ nombre, cantidad: cant, precio: prec }); total += cant * prec; }
            });
            const hoy = new Date();
            const fechaStr = String(hoy.getDate()).padStart(2,'0') + '/' + String(hoy.getMonth()+1).padStart(2,'0') + '/' + hoy.getFullYear();
            const nuevoPedido = {
                cliente, email: pedOriginal.email || '', telefono: pedOriginal.telefono || '',
                direccion, municipio: pedOriginal.municipio || '', envio, productos, total,
                estado: 'Pendiente', fecha: fechaStr, esCambio: true, etiquetaCambio: etiqueta,
                pedidoOriginalId: originalId, motivo,
                moneda: pedOriginal.moneda || 'USD', tasaBCV: pedOriginal.tasaBCV || 0,
            };
            try {
                await addDoc(collection(db, "pedidos"), nuevoPedido);
                document.getElementById('modal-cambio-dev').style.display = 'none';
                window._pedidosTodosCache = null;
                const sel = document.getElementById('pedidos-mes-filtro');
                if (sel) sel.innerHTML = '';
                window.cargarPedidos();
                alert('Cambio/Devolución registrado correctamente con la etiqueta: ' + etiqueta);
            } catch(err) {
                console.error('Error guardando cambio:', err);
                alert('Error al guardar: ' + err.message);
            }
        };

        // ==========================================
        // 📈 TICKER DE TASAS DE CAMBIO (BCV / BINANCE / BRECHAS - SEAMLESS LOOP)
        // ==========================================
        window.actualizarTasas = async function() {
            const wrapper = document.getElementById('ticker-wrapper');
            if (!wrapper) return;

            try {
                let usdBcv = null;
                let eurBcv = null;
                let usdtBinance = null;

                // 1. Obtener USD Oficial (BCV)
                try {
                    const resBcv = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                    if (resBcv.ok) {
                        const dataBcv = await resBcv.json();
                        usdBcv = parseFloat(dataBcv.promedio) || parseFloat(dataBcv.precio);
                        if (usdBcv && usdBcv > 0) {
                            window.tasaVivaBCV = usdBcv;
                            window.tasaReventaBCV = usdBcv;
                            window._ultimoUsdBcv = usdBcv;
                            if (window.actualizarEstadoModoBsReventas) {
                                window.actualizarEstadoModoBsReventas();
                            }
                        }
                    }
                } catch(e) { console.warn("Error consultando Dólar BCV:", e); }

                // 2. Obtener EUR Oficial (BCV)
                try {
                    const resEur = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
                    if (resEur.ok) {
                        const dataEur = await resEur.json();
                        eurBcv = parseFloat(dataEur.promedio) || parseFloat(dataEur.precio);
                        if (eurBcv && eurBcv > 0) {
                            window.tasaVivaEUR = eurBcv;
                            window.tasaReventaEUR = eurBcv;
                        }
                    }
                } catch(e) { console.warn("Error consultando Euro BCV:", e); }

                // 3. Obtener USDT (Binance P2P) con respaldo en Paralelo
                try {
                    const resBinance = await fetch('https://criptoya.com/api/binancep2p/usdt/ves');
                    if (resBinance.ok) {
                        const dataBinance = await resBinance.json();
                        usdtBinance = parseFloat(dataBinance.ask) || parseFloat(dataBinance.totalAsk) || parseFloat(dataBinance.bid);
                    }
                } catch(e) { console.warn("Error consultando Binance P2P, aplicando respaldo:", e); }

                if (!usdtBinance) {
                    try {
                        const resParalelo = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                        if (resParalelo.ok) {
                            const dataPar = await resParalelo.json();
                            usdtBinance = parseFloat(dataPar.promedio) || parseFloat(dataPar.precio);
                        }
                    } catch(e) { console.warn("Error consultando Paralelo:", e); }
                }

                // Si no se obtuvo ninguna tasa, lanzar error controlado
                if (!usdBcv && !usdtBinance) {
                    throw new Error("Servicio de tasas temporalmente no disponible.");
                }

                // Formato en moneda venezolana
                const formatoVES = (num) => Number(num).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // Calcular Brecha USD: ((USDT - Oficial) / Oficial) * 100
                let textoBrechaUsd = '--';
                let colorBrechaUsd = '#9ca3af';
                if (usdBcv && usdtBinance) {
                    const brechaUsd = ((usdtBinance - usdBcv) / usdBcv) * 100;
                    const flecha = brechaUsd >= 0 ? '🔺' : '🔻';
                    const signo = brechaUsd >= 0 ? '+' : '';
                    textoBrechaUsd = `${flecha} ${signo}${brechaUsd.toFixed(2)}%`;
                    colorBrechaUsd = brechaUsd > 10 ? '#fb923c' : (brechaUsd >= 0 ? '#4ade80' : '#f87171');
                }

                // Calcular Brecha EUR: ((USDT - Oficial) / Oficial) * 100
                let textoBrechaEur = '--';
                let colorBrechaEur = '#9ca3af';
                if (eurBcv && usdtBinance) {
                    const brechaEur = ((usdtBinance - eurBcv) / eurBcv) * 100;
                    const flecha = brechaEur >= 0 ? '🔺' : '🔻';
                    const signo = brechaEur >= 0 ? '+' : '';
                    textoBrechaEur = `${flecha} ${signo}${brechaEur.toFixed(2)}%`;
                    colorBrechaEur = brechaEur > 10 ? '#fb923c' : (brechaEur >= 0 ? '#60a5fa' : '#f87171');
                }

                // Armar string de tasas formateadas
                const textoTasas = `
                    <span class="text-gray-300 font-bold tracking-wider inline-flex items-center gap-1.5">
                        <i class="fas fa-chart-line text-green-400"></i> MERCADO CAMBIARIO VENEZUELA:
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="text-gray-400">💵 Dólar BCV:</span>
                        <span class="font-bold text-white tracking-wide">${usdBcv ? `Bs. ${formatoVES(usdBcv)}` : 'N/D'}</span>
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="text-gray-400">💶 Euro BCV:</span>
                        <span class="font-bold text-white tracking-wide">${eurBcv ? `Bs. ${formatoVES(eurBcv)}` : 'N/D'}</span>
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="text-yellow-400">🪙 Binance USDT:</span>
                        <span class="font-bold text-yellow-300 tracking-wide">${usdtBinance ? `Bs. ${formatoVES(usdtBinance)}` : 'N/D'}</span>
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="text-gray-400">📊 Brecha USD:</span>
                        <span class="font-bold" style="color: ${colorBrechaUsd};">${textoBrechaUsd}</span>
                    </span>
                    <span class="inline-flex items-center gap-1">
                        <span class="text-gray-400">📊 Brecha EUR:</span>
                        <span class="font-bold" style="color: ${colorBrechaEur};">${textoBrechaEur}</span>
                    </span>
                    <span class="text-gray-500 text-xs inline-flex items-center">
                        • <i class="fas fa-sync-alt fa-spin text-gray-500 mr-1 ml-1"></i> Auto-actualiza cada 15 min
                    </span>
                `;

                // 🔄 Inyección clonada para marquee infinito continuo de 0 a -50%
                wrapper.innerHTML = `
                    <div class="flex-shrink-0 flex items-center gap-6 px-6">${textoTasas}</div>
                    <div class="flex-shrink-0 flex items-center gap-6 px-6">${textoTasas}</div>
                `;

            } catch(error) {
                console.warn("⚠️ [Ticker de Tasas]:", error);
                const textoError = `
                    <span class="text-red-400 font-bold inline-flex items-center gap-1">
                        <i class="fas fa-exclamation-triangle"></i> Tasas temporalmente no disponibles
                    </span>
                    <span class="text-gray-500 text-xs">Reintentando en breve...</span>
                `;
                wrapper.innerHTML = `
                    <div class="flex-shrink-0 flex items-center gap-6 px-6">${textoError}</div>
                    <div class="flex-shrink-0 flex items-center gap-6 px-6">${textoError}</div>
                `;
            }
        };

        window.iniciarTickerTasas = async function() {
            await window.actualizarTasas();
            // Actualización automática cada 15 minutos (900000 ms)
            setInterval(window.actualizarTasas, 900000);
        };

        window.iniciarTickerTasas();

        // ==========================================
        // 🌐 MÓDULO MINI-CMS: WEB PÚBLICA & OFERTAS (FIRESTORE: web_destacados)
        // ==========================================

        window._webDestacadosCache = [];

        // Carga y cachea el catálogo general desde Firestore productos si aún no está en memoria
        window.asegurarCatalogoCargado = async function() {
            if (window.productosDBLocal && Object.keys(window.productosDBLocal).length > 0) {
                return window.productosDBLocal;
            }
            try {
                const snap = await getDocs(collection(db, "productos"));
                window.productosDBLocal = {};
                snap.forEach(d => {
                    window.productosDBLocal[d.id] = { id: d.id, ...d.data() };
                });
                return window.productosDBLocal;
            } catch (e) {
                console.warn("⚠️ No se pudo cargar catálogo para autocompletado:", e);
                return {};
            }
        };

        // Búsqueda inteligente en el catálogo con menú desplegable
        window.buscarEnCatalogoWeb = async function(termino) {
            const contenedorSugerencias = document.getElementById('web-dest-sugerencias');
            if (!contenedorSugerencias) return;

            await window.asegurarCatalogoCargado();
            const productos = Object.values(window.productosDBLocal || {});

            if (productos.length === 0) {
                contenedorSugerencias.innerHTML = `
                    <div style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px;">
                        Cargando inventario del catálogo...
                    </div>`;
                contenedorSugerencias.style.display = 'block';
                return;
            }

            let lista = [];
            if (!termino || termino.trim().length === 0) {
                lista = productos.slice(0, 8);
            } else {
                const t = termino.toLowerCase().trim();
                lista = productos.filter(p => {
                    const nom = (p.nombre || '').toLowerCase();
                    const mar = (p.marca || '').toLowerCase();
                    const cat = (p.categoria || '').toLowerCase();
                    return nom.includes(t) || mar.includes(t) || cat.includes(t);
                }).slice(0, 10);
            }

            if (lista.length === 0) {
                contenedorSugerencias.innerHTML = `
                    <div style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px;">
                        No se encontraron repuestos con "${SecuritySanitizer.escapeHtml(termino)}". Puedes escribir los datos manualmente abajo.
                    </div>`;
                contenedorSugerencias.style.display = 'block';
                return;
            }

            let html = '';
            lista.forEach(prod => {
                const precio = Number(prod.precio) || 0;
                const img = prod.imagen || 'img/logo-fb-parts.png';
                const prodDataStr = encodeURIComponent(JSON.stringify({
                    nombre: prod.nombre,
                    imagen: prod.imagen,
                    precio: precio
                }));

                html += `
                    <div onclick="seleccionarProductoDeCatalogo('${prodDataStr}')" 
                        style="padding: 9px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.15s;"
                        onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='white'">
                        <div style="width: 42px; height: 42px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: white;">
                            <img src="${SecuritySanitizer.escapeHtml(img)}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='img/logo-fb-parts.png';">
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; font-size: 13px; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${SecuritySanitizer.escapeHtml(prod.nombre)}
                            </div>
                            <div style="font-size: 11.5px; color: #6b7280; display: flex; gap: 6px; align-items: center;">
                                ${prod.marca ? `<span style="background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-weight: 600; color: #475569;">${SecuritySanitizer.escapeHtml(prod.marca)}</span>` : ''}
                                <strong style="color: #15803d; font-family: 'Oswald', sans-serif; font-size: 13px;">$${precio.toFixed(2)}</strong>
                            </div>
                        </div>
                        <button type="button" style="padding: 5px 10px; background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 5px; font-size: 11px; font-weight: 800; cursor: pointer;">
                            <i class="fas fa-check"></i> Elegir
                        </button>
                    </div>`;
            });

            contenedorSugerencias.innerHTML = html;
            contenedorSugerencias.style.display = 'block';
        };

        // Al seleccionar un producto del catálogo: auto-rellena y enfoca el precio oferta
        window.seleccionarProductoDeCatalogo = function(encodedData) {
            try {
                const prod = JSON.parse(decodeURIComponent(encodedData));
                if (!prod) return;

                document.getElementById('web-dest-nombre').value = prod.nombre || '';
                document.getElementById('web-dest-imagen').value = prod.imagen || '';
                document.getElementById('web-dest-precio-regular').value = prod.precio ? Number(prod.precio).toFixed(2) : '';

                // Ocultar buscador de catálogo y sugerencias
                const sugerencias = document.getElementById('web-dest-sugerencias');
                if (sugerencias) sugerencias.style.display = 'none';

                const buscador = document.getElementById('web-dest-buscar-catalogo');
                if (buscador) buscador.value = `✓ Seleccionado: ${prod.nombre}`;

                // Actualizar thumbnail e imagen en vivo
                window.previsualizarImagenWeb(prod.imagen || '');
                window.actualizarVistaPreviaTarjetaLive();

                // Enfocar automáticamente el precio de oferta
                const inputOferta = document.getElementById('web-dest-precio-oferta');
                if (inputOferta) {
                    inputOferta.focus();
                    inputOferta.select();
                }
            } catch (e) {
                console.error("Error al seleccionar producto del catálogo:", e);
            }
        };

        // Cerrar menú de sugerencias si hace clic fuera
        document.addEventListener('click', (e) => {
            const sug = document.getElementById('web-dest-sugerencias');
            const bus = document.getElementById('web-dest-buscar-catalogo');
            if (sug && bus && !bus.contains(e.target) && !sug.contains(e.target)) {
                sug.style.display = 'none';
            }
        });

        // ==========================================
        // 🎯 GESTIÓN GLOBAL DE CAMPAÑA PROMOCIONAL
        // ==========================================
        window._campanaConfig = { activa: true, nombre: 'BLACK FRIDAY', icono: 'fas fa-fire' };

        window.toggleSwitchCampana = function() {
            const chk = document.getElementById('switch-campana-activa');
            if (!chk) return;
            chk.checked = !chk.checked;
            window.actualizarEstadoCampanaLive();
        };

        window.seleccionarPresetCampana = function(nombre, icono) {
            const inpNombre = document.getElementById('campana-nombre-input');
            const selIcono = document.getElementById('campana-icono-select');
            if (inpNombre) inpNombre.value = nombre;
            if (selIcono) selIcono.value = icono;
            window.actualizarEstadoCampanaLive();
        };

        window.actualizarEstadoCampanaLive = function() {
            const chk = document.getElementById('switch-campana-activa');
            const inpNombre = document.getElementById('campana-nombre-input');
            const selIcono = document.getElementById('campana-icono-select');

            const activa = chk ? chk.checked : true;
            const nombre = (inpNombre?.value || 'BLACK FRIDAY').trim() || 'OFERTA';
            const icono = selIcono?.value || 'fas fa-fire';

            window._campanaConfig = { activa, nombre, icono };

            // Actualizar toggle visual
            const toggleVisual = document.getElementById('toggle-campana-visual');
            const toggleKnob = document.getElementById('toggle-campana-knob');
            const badgeEstado = document.getElementById('badge-estado-campana-global');
            const textoEstado = document.getElementById('texto-estado-campana-global');
            const iconoEstado = document.getElementById('icono-estado-campana-global');
            const descEstado = document.getElementById('desc-estado-campana');

            if (toggleVisual && toggleKnob) {
                if (activa) {
                    toggleVisual.style.background = '#15803d';
                    toggleKnob.style.left = '27px';
                } else {
                    toggleVisual.style.background = '#94a3b8';
                    toggleKnob.style.left = '3px';
                }
            }

            if (badgeEstado && textoEstado && iconoEstado) {
                if (activa) {
                    badgeEstado.style.background = '#dcfce7';
                    badgeEstado.style.color = '#15803d';
                    badgeEstado.style.borderColor = '#86efac';
                    textoEstado.innerText = 'OFERTAS ACTIVAS';
                    iconoEstado.className = 'fas fa-check-circle';
                } else {
                    badgeEstado.style.background = '#f1f5f9';
                    badgeEstado.style.color = '#64748b';
                    badgeEstado.style.borderColor = '#cbd5e1';
                    textoEstado.innerText = 'OFERTAS DESACTIVADAS (PAUSA)';
                    iconoEstado.className = 'fas fa-pause-circle';
                }
            }

            if (descEstado) {
                if (activa) {
                    descEstado.style.background = '#f0fdf4';
                    descEstado.style.color = '#166534';
                    descEstado.style.borderColor = '#bbf7d0';
                    descEstado.innerText = `✓ Las promociones se están mostrando como "${nombre}".`;
                } else {
                    descEstado.style.background = '#fef2f2';
                    descEstado.style.color = '#991b1b';
                    descEstado.style.borderColor = '#fecaca';
                    descEstado.innerText = `⚠️ Las ofertas están pausadas. Toda la web muestra precios regulares normales.`;
                }
            }

            // Actualizar badge live preview
            const tagLive = document.getElementById('campana-badge-tag-live');
            const nameLive = document.getElementById('campana-badge-name-live');
            const iconLive = document.getElementById('campana-badge-icon-live');
            const pctLive = document.getElementById('campana-badge-pct-live');

            if (tagLive && nameLive && iconLive && pctLive) {
                if (activa) {
                    tagLive.style.background = 'linear-gradient(135deg, #e63946 0%, #b7094c 100%)';
                    tagLive.style.opacity = '1';
                    pctLive.style.display = 'inline-block';
                    nameLive.innerText = nombre;
                    iconLive.className = icono;
                } else {
                    tagLive.style.background = '#64748b';
                    tagLive.style.opacity = '0.75';
                    pctLive.style.display = 'none';
                    nameLive.innerText = 'PAUSADO (PRECIO NORMAL)';
                    iconLive.className = 'fas fa-ban';
                }
            }

            // Actualizar tarjeta live
            if (typeof window.actualizarVistaPreviaTarjetaLive === 'function') {
                window.actualizarVistaPreviaTarjetaLive();
            }
        };

        window.cargarConfiguracionCampana = async function() {
            try {
                let data = null;
                const snap = await getDoc(doc(db, "configuracion", "campana_ofertas"));
                if (snap.exists()) {
                    data = snap.data();
                } else {
                    data = { activa: true, nombre: 'BLACK FRIDAY', icono: 'fas fa-fire' };
                }

                const activa = data.activa !== false;
                const nombre = data.nombre || 'BLACK FRIDAY';
                const icono = data.icono || 'fas fa-fire';

                window._campanaConfig = { activa, nombre, icono };

                const chk = document.getElementById('switch-campana-activa');
                const inpNombre = document.getElementById('campana-nombre-input');
                const selIcono = document.getElementById('campana-icono-select');

                if (chk) chk.checked = activa;
                if (inpNombre) inpNombre.value = nombre;
                if (selIcono) selIcono.value = icono;

                try {
                    localStorage.setItem('campanaOfertasConfig', JSON.stringify(window._campanaConfig));
                } catch(e) {}

                window.actualizarEstadoCampanaLive();

            } catch (err) {
                console.warn("Aviso: No se pudo cargar configuracion/campana_ofertas:", err);
            }
        };

        window.guardarConfiguracionCampana = async function() {
            const btn = document.getElementById('btn-guardar-campana');
            const btnTexto = document.getElementById('btn-guardar-campana-texto');
            const chk = document.getElementById('switch-campana-activa');
            const inpNombre = document.getElementById('campana-nombre-input');
            const selIcono = document.getElementById('campana-icono-select');

            const activa = chk ? chk.checked : true;
            const nombre = (inpNombre?.value || 'BLACK FRIDAY').trim() || 'OFERTA';
            const icono = selIcono?.value || 'fas fa-fire';

            const configDoc = {
                activa: Boolean(activa),
                nombre: String(nombre),
                icono: String(icono),
                fechaActualizacion: new Date().toLocaleDateString('es-VE') + ' ' + new Date().toLocaleTimeString('es-VE'),
                timestamp: Date.now()
            };

            if (btn) btn.disabled = true;
            if (btnTexto) btnTexto.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;

            try {
                await setDoc(doc(db, "configuracion", "campana_ofertas"), configDoc, { merge: true });
                window._campanaConfig = { activa, nombre, icono };

                try {
                    localStorage.setItem('campanaOfertasConfig', JSON.stringify(window._campanaConfig));
                } catch(e) {}

                window.actualizarEstadoCampanaLive();
                if (typeof window.cargarWebDestacados === 'function') {
                    await window.cargarWebDestacados();
                }

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: activa ? '¡Campaña Activada con Éxito!' : '¡Ofertas Pausadas!',
                        text: activa 
                            ? `La campaña "${nombre}" está activa ahora en la web pública.`
                            : 'Las ofertas han sido desactivadas. Toda la web mostrará únicamente precios regulares.',
                        timer: 2500,
                        showConfirmButton: false
                    });
                } else {
                    alert(activa ? `¡Campaña "${nombre}" activada!` : '¡Ofertas pausadas!');
                }

            } catch (err) {
                console.error("Error al guardar campana_ofertas:", err);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al Guardar',
                        text: 'No se pudo guardar la configuración: ' + (err.message || err)
                    });
                } else {
                    alert('Error al guardar: ' + (err.message || err));
                }
            } finally {
                if (btn) btn.disabled = false;
                if (btnTexto) btnTexto.innerHTML = `Guardar Configuración de Campaña`;
            }
        };

        // Actualiza la tarjeta en vivo situada a la derecha del formulario
        window.actualizarVistaPreviaTarjetaLive = function() {
            const contenedor = document.getElementById('live-card-preview-container');
            if (!contenedor) return;

            const nombre = (document.getElementById('web-dest-nombre')?.value || '').trim() || 'Nombre del Repuesto';
            const rawImg = (document.getElementById('web-dest-imagen')?.value || '').trim() || 'img/logo-fb-parts.png';
            const driveId = window.obtenerGoogleDriveId ? window.obtenerGoogleDriveId(rawImg) : null;
            const imagen = window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImg) : rawImg;
            const reg = parseFloat(document.getElementById('web-dest-precio-regular')?.value || 0);
            const ofVal = (document.getElementById('web-dest-precio-oferta')?.value || '').trim();
            const of = ofVal !== '' ? parseFloat(ofVal) : null;

            const campanaConfig = window._campanaConfig || { activa: true, nombre: 'BLACK FRIDAY', icono: 'fas fa-fire' };
            const tieneOferta = campanaConfig.activa && of !== null && of > 0 && of < reg;
            const pct = tieneOferta ? Math.round((1 - (of / reg)) * 100) : 0;

            const fallbackAttr = driveId
                ? `onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='https://drive.google.com/thumbnail?id=${driveId}&sz=w1920';}else{this.onerror=null;this.src='img/logo-fb-parts.png';}"`
                : `onerror="this.onerror=null; this.src='img/logo-fb-parts.png';"`;

            const badgeHtml = (tieneOferta && pct > 0) ? `
                <div style="position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; flex-direction: column; gap: 4px; pointer-events: none;">
                    <span style="background: linear-gradient(135deg, #e63946 0%, #b7094c 100%); color: white; font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 4px; box-shadow: 0 3px 6px rgba(230,57,70,0.4); text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="${campanaConfig.icono || 'fas fa-fire'}"></i> ${SecuritySanitizer.escapeHtml(campanaConfig.nombre || 'BLACK FRIDAY')}
                    </span>
                    <span style="background: #1f2937; color: #fde047; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 3px; align-self: flex-start; text-transform: uppercase; font-family: 'Oswald', sans-serif;">
                        -${pct}% OFF
                    </span>
                </div>
            ` : '';

            const precioHtml = tieneOferta ? `
                <div style="margin-bottom: 10px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                    <span style="text-decoration: line-through; color: #ef4444; font-size: 13.5px; font-weight: 600;">$${reg.toFixed(2)}</span>
                    <span style="color: #2c441b; font-size: 21px; font-weight: 800; font-family: 'Oswald', sans-serif;">$${of.toFixed(2)}</span>
                </div>
            ` : `
                <div style="margin-bottom: 10px;">
                    <span style="color: #5e8877; font-size: 20px; font-weight: 800; font-family: 'Oswald', sans-serif;">$${reg > 0 ? reg.toFixed(2) : '0.00'}</span>
                </div>
            `;

            contenedor.innerHTML = `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.07); display: flex; flex-direction: column; position: relative;">
                    ${badgeHtml}
                    <div style="width: 100%; height: 165px; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 10px; box-sizing: border-box; border-bottom: 1px solid #f1f5f9;">
                        <img src="${SecuritySanitizer.escapeHtml(imagen)}" alt="${SecuritySanitizer.escapeHtml(nombre)}" 
                            style="width: 100%; height: 100%; object-fit: contain;"
                            ${fallbackAttr}>
                    </div>
                    <div style="padding: 12px 14px; display: flex; flex-direction: column;">
                        <h4 style="font-size: 13px; color: #1e293b; margin: 0 0 8px 0; font-weight: 700; line-height: 1.35; min-height: 35px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${SecuritySanitizer.escapeHtml(nombre)}">
                            ${SecuritySanitizer.escapeHtml(nombre)}
                        </h4>
                        ${precioHtml}
                        <button type="button" style="background: #5e8877; color: white; border: none; padding: 8px 10px; border-radius: 5px; font-weight: 700; width: 100%; font-size: 12px; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: default;">
                            <i class="fas fa-eye"></i> VER DETALLES
                        </button>
                    </div>
                </div>
            `;
        };

        // Renderiza la cuadrícula de vista previa completa (reflejo de index.html)
        window.renderizarCuadriculaPreviewAdmin = function(items) {
            const grid = document.getElementById('grid-destacados-admin-preview');
            if (!grid) return;

            const activos = (items || []).filter(x => x.mostrar_en_destacados);

            if (activos.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 35px 20px; background: white; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b;">
                        <i class="fas fa-tags text-2xl text-slate-300 mb-2"></i>
                        <p style="margin: 0; font-size: 14px; font-weight: 600;">No hay repuestos activos en la portada en este momento.</p>
                        <span style="font-size: 12px; color: #94a3b8;">Usa el formulario superior para añadir repuestos o activa alguno en la tabla.</span>
                    </div>`;
                return;
            }

            const campanaConfig = window._campanaConfig || { activa: true, nombre: 'BLACK FRIDAY', icono: 'fas fa-fire' };
            const campanaActiva = campanaConfig.activa !== false;

            let html = '';
            activos.forEach(item => {
                const reg = Number(item.precioRegular) || 0;
                const of = (item.precioOferta !== null && item.precioOferta !== undefined && item.precioOferta !== '') 
                    ? Number(item.precioOferta) 
                    : null;
                const tieneOferta = campanaActiva && of !== null && of > 0 && of < reg;
                const pct = tieneOferta ? Math.round((1 - (of / reg)) * 100) : 0;

                const badgeHtml = (tieneOferta && pct > 0) ? `
                    <div style="position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; flex-direction: column; gap: 4px; pointer-events: none;">
                        <span style="background: linear-gradient(135deg, #e63946 0%, #b7094c 100%); color: white; font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 4px; box-shadow: 0 2px 6px rgba(230,57,70,0.4); text-transform: uppercase; font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="${campanaConfig.icono || 'fas fa-fire'}"></i> ${SecuritySanitizer.escapeHtml(campanaConfig.nombre || 'BLACK FRIDAY')}
                        </span>
                        <span style="background: #1f2937; color: #fde047; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; align-self: flex-start;">
                            -${pct}% OFF
                        </span>
                    </div>
                ` : '';

                const precioHtml = tieneOferta ? `
                    <div style="margin-bottom: 10px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                        <span style="text-decoration: line-through; color: #ef4444; font-size: 13px; font-weight: 600;">$${reg.toFixed(2)}</span>
                        <span style="color: #2c441b; font-size: 19px; font-weight: 800; font-family: 'Oswald', sans-serif;">$${of.toFixed(2)}</span>
                    </div>
                ` : `
                    <div style="margin-bottom: 10px;">
                        <span style="color: #5e8877; font-size: 18px; font-weight: 800; font-family: 'Oswald', sans-serif;">$${reg.toFixed(2)}</span>
                    </div>
                `;

                html += `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column; position: relative;">
                        ${badgeHtml}
                        <div style="width: 100%; height: 160px; background: white; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; border-bottom: 1px solid #f1f5f9;">
                            <img src="${SecuritySanitizer.escapeHtml(item.imagen)}" alt="${SecuritySanitizer.escapeHtml(item.nombre)}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='img/logo-fb-parts.png';">
                        </div>
                        <div style="padding: 12px; display: flex; flex-direction: column; flex: 1;">
                            <h4 style="font-size: 12.5px; color: #1e293b; margin: 0 0 8px 0; font-weight: 700; line-height: 1.3; min-height: 32px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${SecuritySanitizer.escapeHtml(item.nombre)}">
                                ${SecuritySanitizer.escapeHtml(item.nombre)}
                            </h4>
                            ${precioHtml}
                            <div style="margin-top: auto;">
                                <a href="index.html#destacados" target="_blank" style="background: #5e8877; color: white; border: none; padding: 7px; border-radius: 4px; font-weight: bold; width: 100%; font-size: 12px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box;">
                                    <i class="fas fa-eye"></i> Ver en Web
                                </a>
                            </div>
                        </div>
                    </div>`;
            });

            grid.innerHTML = html;
        };

        window.previsualizarImagenWeb = function(url) {
            const img = document.getElementById('preview-img');
            const placeholder = document.getElementById('preview-placeholder');
            if (!img || !placeholder) return;

            if (!url || !url.trim()) {
                img.src = '';
                img.style.display = 'none';
                placeholder.style.display = 'block';
                if (window.verificarCargaImagen) window.verificarCargaImagen('', 'web-dest-imagen-status');
                return;
            }

            const cleanUrl = url.trim();
            const normUrl = window.normalizarUrlImagen ? window.normalizarUrlImagen(cleanUrl) : cleanUrl;
            const driveId = window.obtenerGoogleDriveId ? window.obtenerGoogleDriveId(cleanUrl) : null;

            img.onload = () => {
                img.style.display = 'block';
                placeholder.style.display = 'none';
            };
            img.onerror = () => {
                if (driveId && !img.dataset.triedThumbnail) {
                    img.dataset.triedThumbnail = '1';
                    img.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1920`;
                    return;
                }
                img.style.display = 'none';
                placeholder.style.display = 'block';
            };
            img.dataset.triedThumbnail = '';
            img.src = normUrl;

            if (window.verificarCargaImagen) {
                window.verificarCargaImagen(cleanUrl, 'web-dest-imagen-status');
            }
        };

        window.generarSlugWeb = function(nombre) {
            if (!nombre) return 'repuesto';
            return nombre
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        };

        /**
         * Sincroniza ofertas de web_destacados hacia la colección de productos en Firestore
         */
        window.sincronizarOfertasConProductos = async function(items) {
            if (!items || !Array.isArray(items) || items.length === 0) return;
            try {
                const prods = window.productosDBLocal || {};
                const prodsArray = Object.values(prods);
                if (prodsArray.length === 0) return;

                const norm = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();

                for (const item of items) {
                    if (!item.nombre || !item.precioOferta) continue;
                    const keyItem = norm(item.nombre);
                    const coincidente = prodsArray.find(p => norm(p.nombre) === keyItem);

                    if (coincidente && (!coincidente.precioOferta || Number(coincidente.precioOferta) !== Number(item.precioOferta))) {
                        await updateDoc(doc(db, "productos", coincidente.id), {
                            precioOferta: item.precioOferta,
                            precioRegular: item.precioRegular || coincidente.precio || 0,
                            fechaOfertaActualizada: new Date().toLocaleDateString('es-VE')
                        }).catch(e => console.warn("Aviso en sync producto:", e));
                        coincidente.precioOferta = item.precioOferta;
                        coincidente.precioRegular = item.precioRegular || coincidente.precio;
                    }
                }
            } catch (e) {
                console.warn("Aviso en sincronizarOfertasConProductos:", e);
            }
        };

        window.cargarWebDestacados = async function() {
            const tbody = document.getElementById('tabla-web-destacados-body');
            const badgeConteo = document.getElementById('conteo-web-destacados');
            if (!tbody) return;

            // Iniciar precarga de catálogo y configuración de campaña en segundo plano
            window.asegurarCatalogoCargado();
            if (typeof window.cargarConfiguracionCampana === 'function') {
                try { await window.cargarConfiguracionCampana(); } catch(e) {}
            }
            window.actualizarVistaPreviaTarjetaLive();

            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 25px; color: #6b7280;">
                        <i class="fas fa-spinner fa-spin text-lg" style="color: #385723;"></i>
                        <div style="margin-top: 6px; font-weight: 500;">Cargando repuestos web desde Firestore...</div>
                    </td>
                </tr>`;

            try {
                const snap = await getDocs(collection(db, "web_destacados"));
                const items = [];
                snap.forEach(d => {
                    items.push({ id: d.id, ...d.data() });
                });

                // Ordenar por timestamp descendente
                items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                window._webDestacadosCache = items;

                if (badgeConteo) {
                    const activosCount = items.filter(x => x.mostrar_en_destacados).length;
                    badgeConteo.innerHTML = `<strong>${items.length}</strong> total | <span style="color: #047857;"><strong>${activosCount}</strong> en portada</span>`;
                }

                // Renderizar cuadrícula de portada en el panel admin
                window.renderizarCuadriculaPreviewAdmin(items);

                // Sincronizar automáticamente ofertas existentes con la colección de productos
                window.sincronizarOfertasConProductos(items);

                if (items.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 35px 20px; color: #9ca3af;">
                                <i class="fas fa-tags" style="font-size: 28px; color: #d1d5db; margin-bottom: 8px; display: block;"></i>
                                <div style="font-size: 14px; font-weight: 600; color: #4b5563;">Aún no hay repuestos registrados para la web.</div>
                                <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Usa el buscador de catálogo superior para añadir el primer repuesto con o sin oferta.</div>
                            </td>
                        </tr>`;
                    return;
                }

                const campanaConfig = window._campanaConfig || { activa: true, nombre: 'BLACK FRIDAY', icono: 'fas fa-fire' };
                const campanaActiva = campanaConfig.activa !== false;

                let html = '';
                items.forEach(item => {
                    const reg = Number(item.precioRegular) || 0;
                    const of = (item.precioOferta !== null && item.precioOferta !== undefined && item.precioOferta !== '') 
                        ? Number(item.precioOferta) 
                        : null;
                    const tieneOferta = of !== null && of > 0 && of < reg;
                    const ahorro = tieneOferta ? (reg - of) : 0;
                    const pctAhorro = tieneOferta ? Math.round((ahorro / reg) * 100) : 0;
                    const isVisible = Boolean(item.mostrar_en_destacados);

                    const rawImg = item.imagen || 'img/logo-fb-parts.png';
                    const driveId = window.obtenerGoogleDriveId ? window.obtenerGoogleDriveId(rawImg) : null;
                    const imagen = SecuritySanitizer.escapeHtml(window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImg) : rawImg);
                    const fallbackImg = driveId
                        ? `onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='https://drive.google.com/thumbnail?id=${driveId}&sz=w1920';}else{this.onerror=null;this.src='img/logo-fb-parts.png';}"`
                        : `onerror="this.onerror=null; this.src='img/logo-fb-parts.png';"`;

                    html += `
                        <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;">
                            <td style="padding: 10px 14px; text-align: center;">
                                <div style="width: 52px; height: 52px; border: 1px solid #e5e7eb; border-radius: 8px; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                    <img src="${imagen}" alt="${SecuritySanitizer.escapeHtml(item.nombre)}" 
                                        style="width: 100%; height: 100%; object-fit: contain; padding: 2px;"
                                        ${fallbackImg}>
                                </div>
                            </td>
                            <td style="padding: 10px 14px;">
                                <div style="font-weight: 700; color: #1f2937; font-size: 13.5px;">${SecuritySanitizer.escapeHtml(item.nombre)}</div>
                                <div style="font-size: 11px; color: #6b7280; display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                                    <span><i class="fas fa-link" style="font-size: 10px;"></i> /${SecuritySanitizer.escapeHtml(item.slug || 'repuesto')}.html</span>
                                    ${item.fechaActualizacion ? `<span>• Act: ${SecuritySanitizer.escapeHtml(item.fechaActualizacion)}</span>` : ''}
                                </div>
                            </td>
                            <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-family: 'Oswald', sans-serif; font-size: 15px; color: #374151;">
                                $${reg.toFixed(2)}
                            </td>
                            <td style="padding: 10px 14px; text-align: right;">
                                ${tieneOferta ? `
                                    <div style="font-weight: 800; font-family: 'Oswald', sans-serif; font-size: 16px; color: ${campanaActiva ? '#385723' : '#64748b'};">
                                        $${of.toFixed(2)}
                                    </div>
                                    <span style="display: inline-block; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${campanaActiva ? '#fee2e2' : '#f1f5f9'}; color: ${campanaActiva ? '#b91c1c' : '#64748b'}; border: 1px solid ${campanaActiva ? '#fecaca' : '#cbd5e1'}; margin-top: 2px;">
                                        <i class="${campanaConfig.icono || 'fas fa-fire'}"></i> -${pctAhorro}% ($${ahorro.toFixed(2)}) ${!campanaActiva ? '• En Pausa' : ''}
                                    </span>
                                ` : `
                                    <span style="font-size: 12px; color: #9ca3af; font-style: italic;">Sin Oferta</span>
                                `}
                            </td>
                            <td style="padding: 10px 14px; text-align: center;">
                                ${isVisible ? `
                                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">
                                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span> Visible en Home
                                    </span>
                                ` : `
                                    <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db;">
                                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;"></span> Oculto
                                    </span>
                                `}
                            </td>
                            <td style="padding: 10px 14px; text-align: center;">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                    <button type="button" onclick="editarWebDestacado('${item.id}')" title="Editar Repuesto"
                                        style="padding: 6px 9px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; transition: background 0.15s;">
                                        <i class="fas fa-edit" style="font-size: 12px;"></i>
                                    </button>
                                    <button type="button" onclick="toggleDestacadoWeb('${item.id}', ${!isVisible})" 
                                        title="${isVisible ? 'Quitar de Portada (Ocultar)' : 'Mostrar en Portada'}"
                                        style="padding: 6px 9px; background: ${isVisible ? '#fffbeb' : '#f0fdf4'}; color: ${isVisible ? '#b45309' : '#15803d'}; border: 1px solid ${isVisible ? '#fde68a' : '#bbf7d0'}; border-radius: 6px; cursor: pointer; transition: background 0.15s;">
                                        <i class="fas ${isVisible ? 'fa-eye-slash' : 'fa-eye'}" style="font-size: 12px;"></i>
                                    </button>
                                    <button type="button" onclick="eliminarWebDestacado('${item.id}')" title="Eliminar Repuesto"
                                        style="padding: 6px 9px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; transition: background 0.15s;">
                                        <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                });

                tbody.innerHTML = html;

            } catch (err) {
                console.error("Error al cargar web_destacados:", err);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 25px; color: #dc2626;">
                            <i class="fas fa-exclamation-triangle"></i> Error al conectar con Firestore: ${SecuritySanitizer.escapeHtml(err.message || err)}
                        </td>
                    </tr>`;
            }
        };

        window.guardarWebDestacado = async function(e) {
            if (e && e.preventDefault) e.preventDefault();

            const idInput = document.getElementById('web-dest-id');
            const id = idInput ? idInput.value.trim() : '';

            const nombre = (document.getElementById('web-dest-nombre')?.value || '').trim();
            const rawImagen = (document.getElementById('web-dest-imagen')?.value || '').trim();
            const imagen = window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImagen) : rawImagen;
            const precioRegVal = parseFloat(document.getElementById('web-dest-precio-regular')?.value || 0);
            const precioOfVal = document.getElementById('web-dest-precio-oferta')?.value.trim();
            const mostrar = document.getElementById('web-dest-mostrar')?.checked ?? true;

            if (!nombre) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Por favor ingresa o selecciona el nombre del repuesto.' });
                } else {
                    alert('Por favor ingresa o selecciona el nombre del repuesto.');
                }
                return;
            }

            if (!imagen) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Por favor ingresa la URL de la imagen del repuesto.' });
                } else {
                    alert('Por favor ingresa la URL de la imagen del repuesto.');
                }
                return;
            }

            if (isNaN(precioRegVal) || precioRegVal <= 0) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'warning', title: 'Precio Inválido', text: 'El precio regular debe ser un número mayor a 0.' });
                } else {
                    alert('El precio regular debe ser un número mayor a 0.');
                }
                return;
            }

            let precioOferta = null;
            if (precioOfVal !== '') {
                const parsedOf = parseFloat(precioOfVal);
                if (!isNaN(parsedOf) && parsedOf > 0) {
                    precioOferta = Math.round(parsedOf * 100) / 100;
                }
            }

            const precioRegular = Math.round(precioRegVal * 100) / 100;
            const slug = window.generarSlugWeb(nombre);

            const ahora = new Date();
            const dia = String(ahora.getDate()).padStart(2, '0');
            const mes = String(ahora.getMonth() + 1).padStart(2, '0');
            const anio = ahora.getFullYear();
            const fechaStr = `${dia}/${mes}/${anio}`;

            const dataDoc = {
                nombre: nombre,
                imagen: imagen,
                precioRegular: precioRegular,
                precioOferta: precioOferta,
                mostrar_en_destacados: Boolean(mostrar),
                slug: slug,
                fechaActualizacion: fechaStr,
                timestamp: Date.now()
            };

            const btnSubmit = document.getElementById('btn-guardar-web-dest');
            const btnTextoSpan = document.getElementById('btn-guardar-web-dest-texto');
            const btnTextoOriginal = btnTextoSpan ? btnTextoSpan.innerText : 'Guardar';
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;
            }

            try {
                if (id) {
                    await updateDoc(doc(db, "web_destacados", id), dataDoc);
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: '¡Actualizado con Éxito!',
                            text: `El repuesto "${nombre}" fue actualizado correctamente.`,
                            timer: 2000,
                            showConfirmButton: false
                        });
                    } else {
                        alert(`¡Repuesto "${nombre}" actualizado con éxito!`);
                    }
                } else {
                    await addDoc(collection(db, "web_destacados"), dataDoc);
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: '¡Publicado con Éxito!',
                            text: `El repuesto "${nombre}" ha sido agregado al gestor web.`,
                            timer: 2000,
                            showConfirmButton: false
                        });
                    } else {
                        alert(`¡Repuesto "${nombre}" publicado con éxito!`);
                    }
                }

                // Sincronizar en segundo plano con la colección 'productos' de Firestore
                try {
                    const qProd = query(collection(db, "productos"), where("nombre", "==", nombre));
                    const snapProd = await getDocs(qProd);
                    if (!snapProd.empty) {
                        const syncUpdates = [];
                        snapProd.forEach(pDoc => {
                            syncUpdates.push(updateDoc(doc(db, "productos", pDoc.id), {
                                precioOferta: precioOferta,
                                precioRegular: precioRegular,
                                slug: slug,
                                fechaOfertaActualizada: fechaStr
                            }));
                            if (window.productosDBLocal && window.productosDBLocal[pDoc.id]) {
                                window.productosDBLocal[pDoc.id].precioOferta = precioOferta;
                                window.productosDBLocal[pDoc.id].precioRegular = precioRegular;
                                window.productosDBLocal[pDoc.id].slug = slug;
                            }
                        });
                        await Promise.all(syncUpdates);
                    } else {
                        // Si el repuesto se publica en Web pero aún no existe en el catálogo general, crearlo automáticamente
                        await addDoc(collection(db, "productos"), {
                            nombre: nombre,
                            slug: slug,
                            precio: precioRegular,
                            precioRegular: precioRegular,
                            precioOferta: precioOferta,
                            imagen: imagen,
                            stock: 1,
                            categoria: "repuestos",
                            estado: "activo",
                            fechaOfertaActualizada: fechaStr
                        });
                    }
                } catch (syncErr) {
                    console.warn("Aviso: Sincronización secundaria con colección productos:", syncErr);
                }

                window.cancelarEdicionWebDestacado();
                await window.cargarWebDestacados();

            } catch (err) {
                console.error("Error al guardar en web_destacados:", err);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de Conexión',
                        text: 'No se pudo guardar el repuesto en Firestore: ' + (err.message || err)
                    });
                } else {
                    alert('Error al guardar en Firestore: ' + (err.message || err));
                }
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = `<i class="fas fa-save"></i> <span id="btn-guardar-web-dest-texto">${btnTextoOriginal}</span>`;
                }
            }
        };

        window.editarWebDestacado = function(id) {
            if (!window._webDestacadosCache) return;
            const item = window._webDestacadosCache.find(x => x.id === id);
            if (!item) return;

            document.getElementById('web-dest-id').value = item.id;
            document.getElementById('web-dest-nombre').value = item.nombre || '';
            document.getElementById('web-dest-imagen').value = item.imagen || '';
            document.getElementById('web-dest-precio-regular').value = item.precioRegular ?? '';
            document.getElementById('web-dest-precio-oferta').value = (item.precioOferta !== null && item.precioOferta !== undefined) ? item.precioOferta : '';
            document.getElementById('web-dest-mostrar').checked = Boolean(item.mostrar_en_destacados);

            const buscador = document.getElementById('web-dest-buscar-catalogo');
            if (buscador) buscador.value = `Editando: ${item.nombre}`;

            window.previsualizarImagenWeb(item.imagen || '');
            window.actualizarVistaPreviaTarjetaLive();

            const titulo = document.getElementById('titulo-form-web-destacado');
            if (titulo) titulo.innerHTML = `<i class="fas fa-edit" style="color: #d97706;"></i> Editando: ${SecuritySanitizer.escapeHtml(item.nombre)}`;

            const badgeEdicion = document.getElementById('badge-modo-edicion');
            if (badgeEdicion) badgeEdicion.style.display = 'inline-block';

            const btnCancelar = document.getElementById('btn-cancelar-web-dest');
            if (btnCancelar) btnCancelar.style.display = 'inline-flex';

            const btnTexto = document.getElementById('btn-guardar-web-dest-texto');
            if (btnTexto) btnTexto.innerText = 'Actualizar Repuesto';

            document.getElementById('tab-web-destacados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.cancelarEdicionWebDestacado = function() {
            const idInput = document.getElementById('web-dest-id');
            if (idInput) idInput.value = '';
            document.getElementById('form-web-destacados')?.reset();
            const chk = document.getElementById('web-dest-mostrar');
            if (chk) chk.checked = true;

            const buscador = document.getElementById('web-dest-buscar-catalogo');
            if (buscador) buscador.value = '';

            const sugerencias = document.getElementById('web-dest-sugerencias');
            if (sugerencias) sugerencias.style.display = 'none';

            window.previsualizarImagenWeb('');
            window.actualizarVistaPreviaTarjetaLive();

            const titulo = document.getElementById('titulo-form-web-destacado');
            if (titulo) titulo.innerHTML = `<i class="fas fa-plus-circle"></i> Publicar / Editar Repuesto Destacado`;

            const badgeEdicion = document.getElementById('badge-modo-edicion');
            if (badgeEdicion) badgeEdicion.style.display = 'none';

            const btnCancelar = document.getElementById('btn-cancelar-web-dest');
            if (btnCancelar) btnCancelar.style.display = 'none';

            const btnTexto = document.getElementById('btn-guardar-web-dest-texto');
            if (btnTexto) btnTexto.innerText = 'Guardar en Web Destacados';
        };

        window.toggleDestacadoWeb = async function(id, nuevoEstado) {
            try {
                await updateDoc(doc(db, "web_destacados", id), {
                    mostrar_en_destacados: Boolean(nuevoEstado),
                    timestamp: Date.now()
                });

                if (typeof Swal !== 'undefined') {
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                    Toast.fire({
                        icon: nuevoEstado ? 'success' : 'info',
                        title: nuevoEstado ? 'Repuesto visible en Portada' : 'Repuesto ocultado de Portada'
                    });
                }
                await window.cargarWebDestacados();
            } catch (err) {
                console.error("Error al actualizar estatus de destacado:", err);
                alert("Error al actualizar: " + (err.message || err));
            }
        };

        window.eliminarWebDestacado = async function(id) {
            let confirmar = false;
            if (typeof Swal !== 'undefined') {
                const res = await Swal.fire({
                    title: '¿Eliminar este repuesto?',
                    text: 'Esta acción borrará el repuesto del listado web y de la portada.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                });
                confirmar = res.isConfirmed;
            } else {
                confirmar = confirm('¿Estás seguro de que deseas eliminar este repuesto de la web?');
            }

            if (!confirmar) return;

            try {
                const itemABorrar = window._webDestacadosCache ? window._webDestacadosCache.find(x => x.id === id) : null;
                await deleteDoc(doc(db, "web_destacados", id));

                // Limpiar precioOferta en colección productos si aplica
                if (itemABorrar && itemABorrar.nombre) {
                    try {
                        const qProd = query(collection(db, "productos"), where("nombre", "==", itemABorrar.nombre));
                        const snapProd = await getDocs(qProd);
                        snapProd.forEach(pDoc => {
                            updateDoc(doc(db, "productos", pDoc.id), {
                                precioOferta: null
                            }).catch(() => {});
                        });
                    } catch (e) {}
                }

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'El repuesto ha sido eliminado.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
                if (document.getElementById('web-dest-id')?.value === id) {
                    window.cancelarEdicionWebDestacado();
                }
                await window.cargarWebDestacados();
            } catch (err) {
                console.error("Error al eliminar de web_destacados:", err);
                alert("Error al eliminar: " + (err.message || err));
            }
        };


        // =========================================================================
        // 🖼️ MINI-CMS: GESTOR DE BANNERS DE PORTADA (CARRUSEL SUPERIOR EN INDEX.HTML)
        // =========================================================================

        window._webBannersCache = [];

        const BANNERS_PREDETERMINADOS = [
            {
                titulo: "REPUESTOS Y AUTOPARTES ORIGINALES EN CARACAS",
                subtitulo: "Especialistas en Toyota, Ford, Dongfeng, Mazda y Honda. Envíos Nacionales.",
                botonTexto: "VER CATÁLOGO COMPLETO",
                botonLink: "tienda.html",
                imagen: "img/fotoportada.webp",
                orden: 1,
                activo: true
            },
            {
                titulo: "ENVÍO RÁPIDO Y SEGURO",
                subtitulo: "ATENCIÓN Y DESPACHO EFICIENTE A TODA VENEZUELA",
                botonTexto: "CONTÁCTANOS",
                botonLink: "#contacto",
                imagen: "img/fotoportada2.webp",
                orden: 2,
                activo: true
            },
            {
                titulo: "VARIEDAD DE REPUESTOS",
                subtitulo: "MOTOR, FRENOS, CARROCERÍA Y MÁS",
                botonTexto: "VER PRODUCTOS",
                botonLink: "#mercadolibre",
                imagen: "img/fotoportada3.webp",
                orden: 3,
                activo: true
            }
        ];

        window.cambiarSubtabWeb = function(subtab) {
            const btnBanners = document.getElementById('subtab-btn-banners');
            const btnDestacados = document.getElementById('subtab-btn-destacados');
            const contBanners = document.getElementById('subtab-content-banners');
            const contDestacados = document.getElementById('subtab-content-destacados');

            if (subtab === 'banners') {
                if (btnBanners) { btnBanners.style.background = '#385723'; btnBanners.style.color = 'white'; }
                if (btnDestacados) { btnDestacados.style.background = '#f3f4f6'; btnDestacados.style.color = '#4b5563'; }
                if (contBanners) contBanners.style.display = 'block';
                if (contDestacados) contDestacados.style.display = 'none';
                window.cargarWebBanners();
            } else {
                if (btnBanners) { btnBanners.style.background = '#f3f4f6'; btnBanners.style.color = '#4b5563'; }
                if (btnDestacados) { btnDestacados.style.background = '#385723'; btnDestacados.style.color = 'white'; }
                if (contBanners) contBanners.style.display = 'none';
                if (contDestacados) contDestacados.style.display = 'block';
                window.cargarWebDestacados();
            }
        };

        window.cambiarSubtabLanded = function(subtab) {
            const btnIntl = document.getElementById('subtab-btn-landed-intl');
            const btnNac = document.getElementById('subtab-btn-landed-nacional');
            const contIntl = document.getElementById('subtab-content-landed-intl');
            const contNac = document.getElementById('subtab-content-landed-nacional');

            if (subtab === 'intl') {
                if (btnIntl) { btnIntl.style.background = '#385723'; btnIntl.style.color = 'white'; }
                if (btnNac) { btnNac.style.background = '#f3f4f6'; btnNac.style.color = '#4b5563'; }
                if (contIntl) contIntl.style.display = 'block';
                if (contNac) contNac.style.display = 'none';
                if (window.calcularLandedCost) window.calcularLandedCost();
            } else {
                if (btnIntl) { btnIntl.style.background = '#f3f4f6'; btnIntl.style.color = '#4b5563'; }
                if (btnNac) { btnNac.style.background = '#385723'; btnNac.style.color = 'white'; }
                if (contIntl) contIntl.style.display = 'none';
                if (contNac) contNac.style.display = 'block';
                if (window.renderizarTablaTarifasBase) window.renderizarTablaTarifasBase();
                if (window.ejecutarCalculoLandedCost) window.ejecutarCalculoLandedCost();
            }
        };

        window._subtabClientesActiva = 'db';
        window.cambiarSubtabClientes = function(subtab) {
            const btnDb = document.getElementById('subtab-btn-clientes-db');
            const btnCrm = document.getElementById('subtab-btn-clientes-crm');
            const btnInt = document.getElementById('subtab-btn-clientes-inteligencia');
            const contDb = document.getElementById('subtab-content-clientes-db');
            const contCrm = document.getElementById('subtab-content-clientes-crm');
            const contInt = document.getElementById('vista-inteligencia-ventas');

            // Resetear estilos de botones
            if (btnDb) { btnDb.style.background = '#f3f4f6'; btnDb.style.color = '#4b5563'; }
            if (btnCrm) { btnCrm.style.background = '#f3f4f6'; btnCrm.style.color = '#4b5563'; }
            if (btnInt) { btnInt.style.background = '#f3f4f6'; btnInt.style.color = '#4b5563'; }

            // Ocultar todas las sub-vistas
            if (contDb) contDb.style.display = 'none';
            if (contCrm) contCrm.style.display = 'none';
            if (contInt) contInt.style.display = 'none';

            if (subtab === 'db') {
                if (btnDb) { btnDb.style.background = '#385723'; btnDb.style.color = 'white'; }
                if (contDb) contDb.style.display = 'block';
                window._subtabClientesActiva = 'db';
                window.cargarBaseClientes();
            } else if (subtab === 'crm') {
                if (btnCrm) { btnCrm.style.background = '#385723'; btnCrm.style.color = 'white'; }
                if (contCrm) contCrm.style.display = 'block';
                window._subtabClientesActiva = 'crm';
                if (window.recomputarCRMTransaccional) {
                    window.recomputarCRMTransaccional();
                }
            } else if (subtab === 'inteligencia') {
                if (btnInt) { btnInt.style.background = '#385723'; btnInt.style.color = 'white'; }
                if (contInt) contInt.style.display = 'block';
                window._subtabClientesActiva = 'inteligencia';
                if (window.recomputarInteligenciaVentasGlobal) {
                    window.recomputarInteligenciaVentasGlobal();
                }
            }
        };

        window.recargarSubtabClientesActual = function() {
            if (window._subtabClientesActiva === 'crm') {
                if (window.recomputarCRMTransaccional) window.recomputarCRMTransaccional();
            } else if (window._subtabClientesActiva === 'inteligencia') {
                if (window.recomputarInteligenciaVentasGlobal) window.recomputarInteligenciaVentasGlobal();
            } else {
                window.cargarBaseClientes();
            }
        };

        window.seleccionarPresetImagenBanner = function(url) {
            const inp = document.getElementById('web-banner-imagen');
            if (inp) {
                inp.value = url;
                window.actualizarVistaPreviaBannerLive();
            }
        };

        window.actualizarVistaPreviaBannerLive = function() {
            const box = document.getElementById('live-banner-preview-box');
            const elTitulo = document.getElementById('prev-banner-titulo');
            const elSub = document.getElementById('prev-banner-subtitulo');
            const elBtn = document.getElementById('prev-banner-boton');

            const titulo = (document.getElementById('web-banner-titulo')?.value || '').trim() || 'TÍTULO DEL BANNER';
            const subtitulo = (document.getElementById('web-banner-subtitulo')?.value || '').trim() || 'Subtítulo o descripción del repuesto';
            const btnTexto = (document.getElementById('web-banner-boton-texto')?.value || '').trim() || 'VER PRODUCTOS';
            const rawImagen = (document.getElementById('web-banner-imagen')?.value || '').trim() || 'img/fotoportada.webp';
            const driveId = window.obtenerGoogleDriveId ? window.obtenerGoogleDriveId(rawImagen) : null;
            const imagen = window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImagen) : rawImagen;

            if (elTitulo) elTitulo.textContent = titulo;
            if (elSub) elSub.textContent = subtitulo;
            if (elBtn) elBtn.textContent = btnTexto;
            if (box) {
                if (driveId) {
                    box.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('https://lh3.googleusercontent.com/d/${driveId}'), url('https://drive.google.com/thumbnail?id=${driveId}&sz=w1920'), url('img/fotoportada.webp')`;
                } else if (imagen) {
                    box.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${imagen}'), url('img/fotoportada.webp')`;
                } else {
                    box.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('img/fotoportada.webp')`;
                }
            }

            if (window.verificarCargaImagen) {
                window.verificarCargaImagen(rawImagen, 'web-banner-imagen-status');
            }
        };

        window.cargarWebBanners = async function() {
            const tbody = document.getElementById('tabla-web-banners-body');
            const badgeConteo = document.getElementById('conteo-web-banners');
            if (!tbody) return;

            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 25px; color: #6b7280;">
                        <i class="fas fa-spinner fa-spin text-lg" style="color: #385723;"></i>
                        <div style="margin-top: 6px; font-weight: 500;">Cargando banners desde Firestore...</div>
                    </td>
                </tr>`;

            try {
                let snap = await getDocs(collection(db, "web_banners"));

                // Si la colección está vacía en Firestore, auto-sembrar los 3 banners originales predeterminados
                if (snap.empty) {
                    console.log("Inicializando banners originales en Firestore...");
                    for (const b of BANNERS_PREDETERMINADOS) {
                        await addDoc(collection(db, "web_banners"), {
                            ...b,
                            timestamp: Date.now(),
                            fechaActualizacion: new Date().toLocaleDateString('es-VE')
                        });
                    }
                    snap = await getDocs(collection(db, "web_banners"));
                }

                const items = [];
                snap.forEach(d => items.push({ id: d.id, ...d.data() }));
                items.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

                window._webBannersCache = items;

                const activos = items.filter(x => x.activo).length;
                if (badgeConteo) {
                    badgeConteo.textContent = `${items.length} total | ${activos} en carrusel`;
                }

                if (items.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 30px; color: #6b7280;">
                                No hay banners registrados. Usa el formulario superior para añadir uno.
                            </td>
                        </tr>`;
                    return;
                }

                let html = '';
                items.forEach(item => {
                    const rawImg = item.imagen || 'img/fotoportada.webp';
                    const driveId = window.obtenerGoogleDriveId ? window.obtenerGoogleDriveId(rawImg) : null;
                    const imagen = SecuritySanitizer.escapeHtml(window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImg) : rawImg);
                    const fallbackImg = driveId
                        ? `onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='https://drive.google.com/thumbnail?id=${driveId}&sz=w1920';}else{this.onerror=null;this.src='img/fotoportada.webp';}"`
                        : `onerror="this.onerror=null; this.src='img/fotoportada.webp';"`;
                    const titulo = SecuritySanitizer.escapeHtml(item.titulo || '');
                    const subtitulo = SecuritySanitizer.escapeHtml(item.subtitulo || '');
                    const botonTexto = SecuritySanitizer.escapeHtml(item.botonTexto || 'VER PRODUCTOS');
                    const botonLink = SecuritySanitizer.escapeHtml(item.botonLink || '#');
                    const orden = Number(item.orden) || 1;
                    const esActivo = Boolean(item.activo);

                    const statusBadge = esActivo
                        ? '<span style="background: #dcfce7; color: #166534; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 9999px; border: 1px solid #86efac; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-check-circle"></i> Activo</span>'
                        : '<span style="background: #f1f5f9; color: #64748b; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 9999px; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-eye-slash"></i> Oculto</span>';

                    html += `
                        <tr style="border-bottom: 1px solid #f3f4f6; transition: background 0.15s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                            <td style="padding: 12px 10px; font-weight: 800; font-size: 14px; text-align: center; color: #1e293b;">
                                ${orden}
                            </td>
                            <td style="padding: 12px 10px;">
                                <div style="width: 75px; height: 45px; border-radius: 4px; overflow: hidden; background: #334155; border: 1px solid #cbd5e1;">
                                    <img src="${imagen}" style="width: 100%; height: 100%; object-fit: cover;" ${fallbackImg}>
                                </div>
                            </td>
                            <td style="padding: 12px 10px;">
                                <div style="font-weight: 700; font-size: 13.5px; color: #1e293b; line-height: 1.25;">
                                    ${titulo}
                                </div>
                                <div style="font-size: 11.5px; color: #64748b; margin-top: 3px; line-height: 1.25;">
                                    ${subtitulo}
                                </div>
                            </td>
                            <td style="padding: 12px 10px;">
                                <span style="background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block;">
                                    ${botonTexto}
                                </span>
                                <div style="font-size: 10.5px; color: #94a3b8; font-family: monospace; margin-top: 2px;">
                                    ${botonLink}
                                </div>
                            </td>
                            <td style="padding: 12px 10px; text-align: center;">
                                ${statusBadge}
                            </td>
                            <td style="padding: 12px 10px; text-align: center;">
                                <div style="display: inline-flex; gap: 6px; align-items: center;">
                                    <button type="button" onclick="toggleActivoWebBanner('${item.id}', ${!esActivo})" 
                                        style="background: ${esActivo ? '#fef3c7' : '#dcfce7'}; color: ${esActivo ? '#92400e' : '#166534'}; border: 1px solid ${esActivo ? '#fcd34d' : '#86efac'}; padding: 6px 9px; border-radius: 5px; cursor: pointer; font-size: 12px;" 
                                        title="${esActivo ? 'Ocultar del carrusel' : 'Mostrar en carrusel'}">
                                        <i class="fas ${esActivo ? 'fa-eye-slash' : 'fa-eye'}"></i>
                                    </button>
                                    <button type="button" onclick="editarWebBanner('${item.id}')" 
                                        style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; padding: 6px 9px; border-radius: 5px; cursor: pointer; font-size: 12px;" 
                                        title="Editar contenido del banner">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button type="button" onclick="eliminarWebBanner('${item.id}')" 
                                        style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 6px 9px; border-radius: 5px; cursor: pointer; font-size: 12px;" 
                                        title="Eliminar banner">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                });

                tbody.innerHTML = html;

            } catch (err) {
                console.error("Error al cargar banners de Firestore:", err);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 25px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle"></i> Error al conectar con Firestore: ${SecuritySanitizer.escapeHtml(err.message || err)}
                        </td>
                    </tr>`;
            }
        };

        window.guardarWebBanner = async function(e) {
            e.preventDefault();
            const id = (document.getElementById('web-banner-id')?.value || '').trim();
            const titulo = (document.getElementById('web-banner-titulo')?.value || '').trim();
            const subtitulo = (document.getElementById('web-banner-subtitulo')?.value || '').trim();
            const botonTexto = (document.getElementById('web-banner-boton-texto')?.value || '').trim() || 'VER PRODUCTOS';
            const botonLink = (document.getElementById('web-banner-boton-link')?.value || '').trim() || '#';
            const rawImagen = (document.getElementById('web-banner-imagen')?.value || '').trim() || 'img/fotoportada.webp';
            const imagen = window.normalizarUrlImagen ? window.normalizarUrlImagen(rawImagen) : rawImagen;
            const orden = parseInt(document.getElementById('web-banner-orden')?.value || '1', 10);
            const activo = document.getElementById('web-banner-activo')?.checked ?? true;

            const btnSubmit = document.getElementById('btn-guardar-web-banner');
            const btnTextoOriginal = document.getElementById('btn-guardar-web-banner-texto')?.innerText || 'Guardar Banner';

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            const dataToSave = {
                titulo,
                subtitulo,
                botonTexto,
                botonLink,
                imagen,
                orden,
                activo,
                fechaActualizacion: new Date().toLocaleDateString('es-VE'),
                timestamp: Date.now()
            };

            try {
                if (id) {
                    await updateDoc(doc(db, "web_banners", id), dataToSave);
                } else {
                    await addDoc(collection(db, "web_banners"), dataToSave);
                }

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: id ? '¡Banner Actualizado!' : '¡Banner Publicado!',
                        text: 'Los cambios se reflejarán de inmediato en el carrusel de la página de inicio.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    alert(id ? '¡Banner actualizado con éxito!' : '¡Banner guardado con éxito!');
                }

                window.cancelarEdicionWebBanner();
                await window.cargarWebBanners();

            } catch (err) {
                console.error("Error al guardar banner en web_banners:", err);
                alert("Error al guardar banner en Firestore: " + (err.message || err));
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = `<i class="fas fa-save"></i> <span id="btn-guardar-web-banner-texto">${btnTextoOriginal}</span>`;
                }
            }
        };

        window.editarWebBanner = function(id) {
            const item = (window._webBannersCache || []).find(x => x.id === id);
            if (!item) return;

            document.getElementById('web-banner-id').value = item.id;
            document.getElementById('web-banner-titulo').value = item.titulo || '';
            document.getElementById('web-banner-subtitulo').value = item.subtitulo || '';
            document.getElementById('web-banner-boton-texto').value = item.botonTexto || '';
            document.getElementById('web-banner-boton-link').value = item.botonLink || '';
            document.getElementById('web-banner-imagen').value = item.imagen || '';
            document.getElementById('web-banner-orden').value = item.orden || 1;
            document.getElementById('web-banner-activo').checked = Boolean(item.activo);

            const tituloEl = document.getElementById('titulo-form-web-banner');
            if (tituloEl) tituloEl.innerHTML = `<i class="fas fa-edit" style="color: #d97706;"></i> Editando: ${SecuritySanitizer.escapeHtml(item.titulo || '')}`;

            const badgeEdicion = document.getElementById('badge-modo-edicion-banner');
            if (badgeEdicion) badgeEdicion.style.display = 'inline-block';

            const btnCancelar = document.getElementById('btn-cancelar-web-banner');
            if (btnCancelar) btnCancelar.style.display = 'inline-flex';

            const btnTexto = document.getElementById('btn-guardar-web-banner-texto');
            if (btnTexto) btnTexto.innerText = 'Actualizar Banner';

            window.actualizarVistaPreviaBannerLive();
            document.getElementById('tab-web-destacados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.cancelarEdicionWebBanner = function() {
            const idInput = document.getElementById('web-banner-id');
            if (idInput) idInput.value = '';
            document.getElementById('form-web-banners')?.reset();
            
            document.getElementById('web-banner-imagen').value = 'img/fotoportada.webp';
            document.getElementById('web-banner-titulo').value = 'REPUESTOS Y AUTOPARTES ORIGINALES EN CARACAS';
            document.getElementById('web-banner-subtitulo').value = 'Especialistas en Toyota, Ford, Dongfeng, Mazda y Honda. Envíos Nacionales.';
            document.getElementById('web-banner-boton-texto').value = 'VER CATÁLOGO COMPLETO';
            document.getElementById('web-banner-boton-link').value = 'tienda.html';
            document.getElementById('web-banner-orden').value = '1';
            document.getElementById('web-banner-activo').checked = true;

            const tituloEl = document.getElementById('titulo-form-web-banner');
            if (tituloEl) tituloEl.innerHTML = '<i class="fas fa-plus-circle"></i> Publicar / Editar Banner de Portada';

            const badgeEdicion = document.getElementById('badge-modo-edicion-banner');
            if (badgeEdicion) badgeEdicion.style.display = 'none';

            const btnCancelar = document.getElementById('btn-cancelar-web-banner');
            if (btnCancelar) btnCancelar.style.display = 'none';

            const btnTexto = document.getElementById('btn-guardar-web-banner-texto');
            if (btnTexto) btnTexto.innerText = 'Guardar Banner';

            window.actualizarVistaPreviaBannerLive();
        };

        window.toggleActivoWebBanner = async function(id, nuevoEstado) {
            try {
                await updateDoc(doc(db, "web_banners", id), {
                    activo: Boolean(nuevoEstado),
                    timestamp: Date.now()
                });

                if (typeof Swal !== 'undefined') {
                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                    Toast.fire({
                        icon: nuevoEstado ? 'success' : 'info',
                        title: nuevoEstado ? 'Banner visible en el carrusel' : 'Banner ocultado del carrusel'
                    });
                }
                await window.cargarWebBanners();
            } catch (err) {
                console.error("Error al actualizar estatus de banner:", err);
                alert("Error al actualizar: " + (err.message || err));
            }
        };

        window.eliminarWebBanner = async function(id) {
            let confirmar = false;
            if (typeof Swal !== 'undefined') {
                const res = await Swal.fire({
                    title: '¿Eliminar este banner?',
                    text: 'Esta acción borrará el banner del carrusel de inicio.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                });
                confirmar = res.isConfirmed;
            } else {
                confirmar = confirm('¿Estás seguro de que deseas eliminar este banner del carrusel?');
            }

            if (!confirmar) return;

            try {
                await deleteDoc(doc(db, "web_banners", id));
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        text: 'El banner ha sido eliminado del carrusel.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
                if (document.getElementById('web-banner-id')?.value === id) {
                    window.cancelarEdicionWebBanner();
                }
                await window.cargarWebBanners();
            } catch (err) {
                console.error("Error al eliminar de web_banners:", err);
                alert("Error al eliminar: " + (err.message || err));
            }
        };


        // =========================================================================
        // 🚘 VISTA 1: CRM ANALÍTICO TRANSACCIONAL (CON NORMALIZADOR DE DIVISAS)
        // =========================================================================
        window.clientesAgrupadosCache = [];
        window.clienteSeleccionadoCRM = null;

        // 💾 CACHÉ PERSISTENTE EN LOCALSTORAGE PARA TASAS BCV HISTÓRICAS (0 ms / Cero 404 innecesarios)
        const CACHE_KEY_BCV = 'bcv_historico_cache_v1';

        function cargarCacheBCVLocalStorage() {
            try {
                const raw = localStorage.getItem(CACHE_KEY_BCV);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                }
            } catch (e) {
                console.warn('[CRM Divisas BCV] Aviso al leer caché de localStorage:', e);
            }
            return {};
        }

        function guardarCacheBCVLocalStorage(cache) {
            try {
                localStorage.setItem(CACHE_KEY_BCV, JSON.stringify(cache));
            } catch (e) {
                console.warn('[CRM Divisas BCV] Aviso al guardar caché en localStorage:', e);
            }
        }

        window.bcvHistoricoCache = cargarCacheBCVLocalStorage();

        /**
         * Ajusta automáticamente una fecha YYYY-MM-DD que caiga en Sábado o Domingo
         * al viernes hábil inmediatamente anterior para evitar peticiones 404 innecesarias.
         */
        window.ajustarFechaFinDeSemana = function(fechaStr) {
            if (!fechaStr || typeof fechaStr !== 'string') return fechaStr;
            const parts = fechaStr.split('-');
            if (parts.length !== 3) return fechaStr;
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return fechaStr;

            // Mediodía local (12:00) para evitar desajustes de zona horaria
            const d = new Date(year, month, day, 12, 0, 0);
            const dayOfWeek = d.getDay(); // 0 = Domingo, 6 = Sábado

            if (dayOfWeek === 6) {
                // Sábado -> restar 1 día (Viernes)
                d.setDate(d.getDate() - 1);
            } else if (dayOfWeek === 0) {
                // Domingo -> restar 2 días (Viernes)
                d.setDate(d.getDate() - 2);
            } else {
                return fechaStr;
            }

            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        /**
         * Busca la tasa histórica válida más cercana (hacia atrás) dentro de la caché local persistente
         */
        function buscarTasaMasCercanaEnCache(fechaObjetivo) {
            const keys = Object.keys(window.bcvHistoricoCache || {})
                .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(window.bcvHistoricoCache[k]?.tasa) > 0)
                .sort();
            let mejor = null;
            for (const k of keys) {
                if (k <= fechaObjetivo) {
                    mejor = { fecha: k, tasa: Number(window.bcvHistoricoCache[k].tasa) };
                }
            }
            return mejor;
        }

        // =========================================================================
        // ⚙️ CONFIGURACIÓN DE CONEXIÓN A API CAMBIARIA BCV (TASAS HISTÓRICAS)
        // =========================================================================
        // Configuración centralizada para consumir tasas oficiales de la fecha exacta.
        // =========================================================================
        window.CONFIG_BCV_HISTORICO = {
            // 🌐 1. URL DEL ENDPOINT HISTÓRICO DE CROM STUDIO O TU PROPIO PROXY:
            urlBase: 'https://datos.cromstudio.com.ve/api/bcv/historico/{FECHA_FORMATO_API}',

            // 🌐 Endpoint alternativo en vivo de Crom Studio (CORS abierto *):
            urlTasaEnVivo: 'https://datos.cromstudio.com.ve/tasa',

            // 🔑 2. TU API KEY O TOKEN BEARER (Si tu backend proxy o servicio lo requiere):
            apiKey: '',

            // ⏱️ 3. TIEMPO MÁXIMO DE ESPERA (TIMEOUT):
            timeoutMs: 4000,

            // 🛡️ 4. TASA DE RESPALDO DE SEGURIDAD (Si la red o API externa no responde):
            tasaFallback: (typeof window.tasaBCVOficial !== 'undefined' && window.tasaBCVOficial > 0) ? window.tasaBCVOficial : 46.50
        };

        /**
         * Formatea cualquier fecha a formato estándar internacional YYYY-MM-DD requerido por APIs
         */
        window.formatearFechaParaAPI = function(fecha) {
            if (!fecha) return new Date().toISOString().split('T')[0];
            if (typeof fecha === 'string') {
                const limpia = fecha.trim();
                if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(limpia)) {
                    const parts = limpia.split(/[-/]/);
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].substring(0, 2).padStart(2, '0')}`;
                }
                if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(limpia)) {
                    const parts = limpia.split(/[-/]/);
                    return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            const d = new Date(fecha);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            return new Date().toISOString().split('T')[0];
        };

        /**
         * Dataset transaccional con ejemplos explícitos para auditoría de reglas:
         * - Facturas Pagadas y Despachadas (SÍ computan para el LTV)
         * - Pedidos y Cotizaciones (DESCARTADOS por el Filtro Strict de Prevención de Duplicidad)
         */
        window.mockPedidosTransaccionales = [
            // Cuenta 1: Inversiones & Repuestos El Ávila 2021, C.A.
            { id: "FAC-1001", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Inversiones & Repuestos El Ávila 2021, C.A.", rif: "J-40981245-1", telefono: "+58 412-0192843", fecha: "2024-05-14", moneda_pago: "VES", monto_facturado: 277400.00, tasa_cambio_dia: null, items: ["Radiador Aeolus Dongfeng AX7 Pro", "Termostato Original Dongfeng"], origen: "Factura" },
            { id: "FAC-1002", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Inversiones & Repuestos El Ávila 2021, C.A.", rif: "J-40981245-1", telefono: "+58 412-0192843", fecha: "2026-02-10", moneda_pago: "USD", monto_facturado: 450.00, tasa_cambio_dia: 1.00, items: ["Parachoques Trasero Dongfeng Rich P11 Zna"], origen: "Factura" },
            { id: "FAC-1003", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Inversiones & Repuestos El Ávila 2021, C.A.", rif: "J-40981245-1", telefono: "+58 412-0192843", fecha: "2026-10-22", moneda_pago: "USD", monto_facturado: 320.00, tasa_cambio_dia: 1.00, items: ["Bobinas de Encendido Ford Super Duty 6.2"], origen: "Factura" },

            // ⚠️ PEDIDO DUPLICADO CONVERTIDO EN FACTURA (EL FILTRO STRICT LO DESCARTA PARA EVITAR DOBLE CONTEO):
            { id: "PED-2001", tipo_documento: "Pedido", estatus: "Procesado", cliente: "Inversiones & Repuestos El Ávila 2021, C.A.", rif: "J-40981245-1", telefono: "+58 412-0192843", fecha: "2024-05-12", moneda_pago: "VES", monto_facturado: 277400.00, items: ["Radiador Aeolus Dongfeng AX7 Pro"], origen: "Pedido" },
            
            // ⚠️ COTIZACIÓN PENDIENTE (EL FILTRO STRICT LA DESCARTA DEL LTV):
            { id: "COT-3001", tipo_documento: "Cotizacion", estatus: "Pendiente", cliente: "Inversiones & Repuestos El Ávila 2021, C.A.", rif: "J-40981245-1", telefono: "+58 412-0192843", fecha: "2024-05-10", moneda_pago: "USD", monto_facturado: 1500.00, items: ["Motor Completo"], origen: "Cotizacion" },

            // Cuenta 2: Multiservicios Automotrices Los Andes, C.A.
            { id: "FAC-1004", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Multiservicios Automotrices Los Andes, C.A.", rif: "J-29837102-3", telefono: "+58 424-7128394", fecha: "2024-08-19", moneda_pago: "VES", monto_facturado: 185000.00, tasa_cambio_dia: null, items: ["Kit Conchas Bancada y Biela Chevrolet Blazer 4.3 Vortec"], origen: "Factura" },
            { id: "FAC-1005", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Multiservicios Automotrices Los Andes, C.A.", rif: "J-29837102-3", telefono: "+58 424-7128394", fecha: "2026-09-15", moneda_pago: "USD", monto_facturado: 620.00, tasa_cambio_dia: 1.00, items: ["Bomba Gasolina Pila Denso Toyota Yaris Original 2007-2017"], origen: "Factura" },
            { id: "PED-2002", tipo_documento: "Pedido", estatus: "Procesado", cliente: "Multiservicios Automotrices Los Andes, C.A.", rif: "J-29837102-3", telefono: "+58 424-7128394", fecha: "2026-09-14", moneda_pago: "USD", monto_facturado: 620.00, items: ["Bomba Gasolina Pila Denso Toyota Yaris Original 2007-2017"], origen: "Pedido" },

            // Cuenta 3: Auto Repuestos Caracas Motor, C.A.
            { id: "FAC-1006", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Auto Repuestos Caracas Motor, C.A.", rif: "J-31298451-0", telefono: "+58 414-9821734", fecha: "2024-11-05", moneda_pago: "VES", monto_facturado: 92620.00, tasa_cambio_dia: null, items: ["Meseta Superior Izquierda Toyota Hilux Kavak Fortuner"], origen: "Factura" },
            { id: "FAC-1007", tipo_documento: "Factura", estatus: "Pagado y Despachado", cliente: "Auto Repuestos Caracas Motor, C.A.", rif: "J-31298451-0", telefono: "+58 414-9821734", fecha: "2026-11-01", moneda_pago: "USD", monto_facturado: 180.00, tasa_cambio_dia: 1.00, items: ["Pastillas de Freno Delanteras Toyota Yaris"], origen: "Factura" }
        ];

        /**
         * Formatea números al formato monetario estándar estadounidense: $1,500.00
         */
        window.formatearMonedaUSD = function(monto) {
            return '$' + Number(monto || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        /**
         * 🏛️ REGLA 2: INTEGRACIÓN REAL DE API BCV (PROMESAS ASÍNCRONAS)
         * Función asíncrona dedicada obtenerTasaHistoricaBCV(fecha):
         * Realiza fetch a la API pública de Crom Studio (o proxy configurado).
         * Si la red o endpoint no responden, simula el retraso asíncrono y usa fallback seguro.
         * 
         * @param {string|Date} fecha - Fecha en que ocurrió la facturación
         * @returns {Promise<number>} - Tasa numérica de cambio oficial del día
         */
        window.obtenerTasaHistoricaBCV = async function(fecha) {
            const fechaOriginal = window.formatearFechaParaAPI(fecha);

            // 1. Caché persistente en localStorage para fecha original
            if (window.bcvHistoricoCache[fechaOriginal] && Number(window.bcvHistoricoCache[fechaOriginal].tasa) > 0) {
                return Number(window.bcvHistoricoCache[fechaOriginal].tasa);
            }

            // 2. Ajuste de fin de semana: Sábado o Domingo -> Viernes hábil anterior
            const fechaConsulta = window.ajustarFechaFinDeSemana(fechaOriginal);

            // Si la fecha ajustada (viernes) ya está en caché, reutilizarla directamente sin petición
            if (window.bcvHistoricoCache[fechaConsulta] && Number(window.bcvHistoricoCache[fechaConsulta].tasa) > 0) {
                const itemCached = window.bcvHistoricoCache[fechaConsulta];
                const tasaCached = Number(itemCached.tasa);
                window.bcvHistoricoCache[fechaOriginal] = {
                    tasa: tasaCached,
                    fuente: fechaOriginal !== fechaConsulta ? `Viernes hábil (${fechaConsulta})` : itemCached.fuente,
                    esFallback: itemCached.esFallback || false
                };
                guardarCacheBCVLocalStorage(window.bcvHistoricoCache);
                return tasaCached;
            }

            const cfg = window.CONFIG_BCV_HISTORICO;
            const urlConsulta = cfg.urlBase.replace('{FECHA_FORMATO_API}', encodeURIComponent(fechaConsulta));

            const controller = new AbortController();
            const timeoutTimer = setTimeout(() => controller.abort(), cfg.timeoutMs);

            let tasaObtenida = null;
            let fuenteObtenida = '';

            try {
                const headers = { 'Accept': 'application/json' };
                if (cfg.apiKey && cfg.apiKey.trim() !== '') {
                    headers['Authorization'] = cfg.apiKey.startsWith('Bearer ') ? cfg.apiKey : `Bearer ${cfg.apiKey.trim()}`;
                }

                // Fetch real asíncrono a la API histórica
                const response = await fetch(urlConsulta, {
                    method: 'GET',
                    headers: headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutTimer);

                if (response.ok) {
                    const data = await response.json();
                    const dataObj = Array.isArray(data) ? (data[0] || {}) : (data || {});
                    const tasaExtraida = parseFloat(
                        dataObj?.tasas?.USD ?? dataObj?.current?.usd ?? dataObj?.price ?? dataObj?.rate ??
                        dataObj?.promedio ?? dataObj?.tasa ?? dataObj?.valor ?? dataObj?.dolar ?? dataObj?.data?.rate
                    );

                    if (tasaExtraida && !isNaN(tasaExtraida) && tasaExtraida > 0) {
                        tasaObtenida = tasaExtraida;
                        fuenteObtenida = 'API Crom Studio (Histórico)';
                    }
                }
            } catch (err) {
                clearTimeout(timeoutTimer);
            }

            // Si la API histórica devolvió una tasa válida (> 0)
            if (tasaObtenida && tasaObtenida > 0) {
                window.bcvHistoricoCache[fechaConsulta] = {
                    tasa: tasaObtenida,
                    fuente: fuenteObtenida,
                    esFallback: false
                };
                if (fechaOriginal !== fechaConsulta) {
                    window.bcvHistoricoCache[fechaOriginal] = {
                        tasa: tasaObtenida,
                        fuente: `Viernes hábil (${fechaConsulta})`,
                        esFallback: false
                    };
                }
                guardarCacheBCVLocalStorage(window.bcvHistoricoCache);
                return tasaObtenida;
            }

            // 3. Respaldo para 404 / Feriados / Fin de semana sin registro / Error:
            // Intentar recuperar primero la tasa del día hábil anterior más cercano registrada en la caché
            let fallbackTasa = cfg.tasaFallback;
            let fallbackFuente = `Fallback (${Number(cfg.tasaFallback).toFixed(2)} Bs/$)`;

            const tasaPrevia = buscarTasaMasCercanaEnCache(fechaConsulta);
            if (tasaPrevia && tasaPrevia.tasa > 0) {
                fallbackTasa = tasaPrevia.tasa;
                fallbackFuente = `Día hábil anterior (${tasaPrevia.fecha}: ${Number(tasaPrevia.tasa).toFixed(2)} Bs/$)`;
            } else if (typeof window.tasaBCVOficial !== 'undefined' && Number(window.tasaBCVOficial) > 0) {
                fallbackTasa = Number(window.tasaBCVOficial);
                fallbackFuente = `Tasa Actual Panel (${fallbackTasa.toFixed(2)} Bs/$)`;
            }

            // Se guarda en la caché persistente para no volver a intentar consultarla ni ensuciar la consola
            window.bcvHistoricoCache[fechaConsulta] = {
                tasa: fallbackTasa,
                fuente: fallbackFuente,
                esFallback: true
            };
            if (fechaOriginal !== fechaConsulta) {
                window.bcvHistoricoCache[fechaOriginal] = {
                    tasa: fallbackTasa,
                    fuente: `Fin de semana (${fallbackFuente})`,
                    esFallback: true
                };
            }
            guardarCacheBCVLocalStorage(window.bcvHistoricoCache);

            return fallbackTasa;
        };

        // Alias retrocompatible
        window.obtenerTasaBCVHistoricaAsync = async function(fecha, tasaPrevia) {
            if (tasaPrevia && Number(tasaPrevia) > 0) {
                return { tasa: Number(tasaPrevia), fuente: 'Registrada', esFallback: false };
            }
            const tasa = await window.obtenerTasaHistoricaBCV(fecha);
            const fechaStr = window.formatearFechaParaAPI(fecha);
            return window.bcvHistoricoCache[fechaStr] || { tasa, fuente: 'API BCV', esFallback: false };
        };

        /**
         * ⚡ FLUJO ASÍNCRONO DE NORMALIZACIÓN CAMBIARIA:
         * 1. Itera sobre las facturas filtradas del cliente.
         * 2. Si la factura es en 'VES', llama a await window.obtenerTasaHistoricaBCV(factura.fecha).
         * 3. Divide el monto VES por la tasa extraída de la API.
         * 4. Suma al Total Normalizado del cliente (LTV) y calcula el Ticket Promedio (AOV).
         * 5. Renderiza en el DOM (Actualizando la tarjeta del cliente y la tabla de historial).
         */
        window.normalizarFacturasClienteAsync = async function(cliente) {
            if (!cliente || !Array.isArray(cliente.facturas) || cliente.facturas.length === 0) {
                return cliente;
            }

            let huboFallback = false;

            // Iteración asíncrona sobre cada factura filtrada
            await Promise.all(cliente.facturas.map(async (f) => {
                const moneda = String(f.moneda_pago || f.moneda || 'USD').toUpperCase().trim();
                const montoBruto = parseFloat(f.monto_facturado ?? f.monto ?? f.total) || 0;

                if (moneda === 'VES' || moneda === 'BS') {
                    f.moneda_pago = 'VES';
                    // Llamada asíncrona dedicada a la API BCV
                    const tasaOficial = await window.obtenerTasaHistoricaBCV(f.fecha);
                    f.tasa_cambio_dia = tasaOficial;

                    const fechaKey = window.formatearFechaParaAPI(f.fecha);
                    const cacheInfo = window.bcvHistoricoCache[fechaKey];
                    f.fuente_tasa = cacheInfo?.fuente || 'API BCV';
                    if (cacheInfo?.esFallback) huboFallback = true;

                    // División estricta: monto en Bolívares ÷ Tasa Oficial BCV de la fecha
                    const tasa = Number(tasaOficial) || 1;
                    f.monto_usd = Math.round((tasa > 0 ? (montoBruto / tasa) : montoBruto) * 100) / 100;
                } else {
                    // Transacciones en USD
                    f.moneda_pago = 'USD';
                    f.monto_usd = montoBruto;
                    f.tasa_cambio_dia = 1.00;
                    f.fuente_tasa = 'USD Directo';
                }
            }));

            // Sumar al Total Normalizado del cliente (LTV) y calcular Ticket Promedio (AOV)
            const totalNormalizado = cliente.facturas.reduce((sum, f) => sum + (f.monto_usd || 0), 0);
            cliente.totalComprado = Math.round(totalNormalizado * 100) / 100;
            cliente.frecuenciaCompra = cliente.facturas.length;
            cliente.ticketPromedio = (cliente.frecuenciaCompra > 0)
                ? Math.round((cliente.totalComprado / cliente.frecuenciaCompra) * 100) / 100
                : 0;

            // Renderizar en el DOM: Tarjeta de Métricas
            const elLTV = document.getElementById('crm-kpi-ltv-val');
            const elFrec = document.getElementById('crm-kpi-frecuencia-val');
            const elAOV = document.getElementById('crm-kpi-aov-val');
            const elNotice = document.getElementById('crm-api-status-notice');

            if (elLTV) elLTV.innerText = window.formatearMonedaUSD(cliente.totalComprado);
            if (elFrec) elFrec.innerHTML = `${cliente.frecuenciaCompra} <span style="font-size: 14.5px; font-weight: 600; color: #64748b;">${cliente.frecuenciaCompra === 1 ? 'Factura' : 'Facturas'}</span>`;
            if (elAOV) elAOV.innerText = window.formatearMonedaUSD(cliente.ticketPromedio);

            if (elNotice) {
                if (huboFallback) {
                    elNotice.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> Tasa de respaldo aplicada</span>`;
                    elNotice.style.display = 'inline-block';
                } else {
                    elNotice.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;"><i class="fas fa-check-circle"></i> Tasas BCV validadas</span>`;
                    elNotice.style.display = 'inline-block';
                }
            }

            // Renderizar en el DOM: Tabla de Historial
            window.renderizarTablaFacturasCliente(cliente.facturas);

            return cliente;
        };

        /**
         * 🚫 REGLA 1: PREVENCIÓN DE DUPLICIDAD FINANCIERA (FILTRO STRICT)
         * Antes de agrupar o sumar cualquier monto por cliente, se filtra el array principal.
         * SOLO se procesan los objetos donde:
         *   tipo_documento === 'Factura' Y estatus === 'Pagado y Despachado'
         * Se descartan de raíz "Pedidos", "Cotizaciones" o facturas no liquidadas
         * para evitar sumar dos veces la misma venta al convertirse de Pedido a Factura.
         */
        window.procesarClientesDesdeTransacciones = function(transacciones) {
            const MARCAS_DETECTABLES = [
                'Toyota', 'Mercedes Benz', 'Mercedes', 'Mitsubishi', 'Chevrolet', 'Ford', 
                'Dongfeng', 'Cummins', 'Honda', 'Mazda', 'Nissan', 'Chery', 'Hyundai',
                'Jeep', 'Kia', 'Volkswagen', 'Fiat', 'Renault', 'Peugeot', 'BMW'
            ];

            // =========================================================================
            // 🛡️ PASO 1: FILTRO STRICT DE PREVENCIÓN DE DUPLICIDAD
            // =========================================================================
            const transaccionesEntrantes = Array.isArray(transacciones) ? transacciones : [];
            let descartadosDuplicados = 0;

            const facturasValidas = transaccionesEntrantes.filter(item => {
                const tipoDoc = String(item.tipo_documento || item.tipo || item.origen || '').trim().toLowerCase();
                const estadoDoc = String(item.estatus || item.estado || item.estatusComercial || '').trim().toLowerCase();

                // Condición 1 Estricta: Exclusivamente tipo 'Factura'
                const esFactura = (tipoDoc === 'factura');

                // Condición 2 Estricta: Exclusivamente estatus 'Pagado y Despachado' (o equivalente liquidado 'pagada')
                const esPagadoYDespachado = (
                    estadoDoc === 'pagado y despachado' ||
                    estadoDoc === 'pagada y despachada' ||
                    estadoDoc === 'pagada' ||
                    estadoDoc === 'pagado'
                );

                const pasaFiltro = esFactura && esPagadoYDespachado;
                if (!pasaFiltro) {
                    descartadosDuplicados++;
                }
                return pasaFiltro;
            });

            console.info(`[CRM Auditoría Financiera] Total transacciones: ${transaccionesEntrantes.length} | Descartados por duplicidad/estado ('Pedido' / 'Cotizacion'): ${descartadosDuplicados} | Facturas Pagadas y Despachadas válidas para LTV: ${facturasValidas.length}`);

            // =========================================================================
            // 📊 PASO 2: AGRUPACIÓN POR CLIENTE (REDUCE)
            // =========================================================================
            const agrupadoPorCliente = facturasValidas.reduce((acc, trans) => {
                const nombreKey = (trans.cliente || 'Consumidor Final').trim();
                if (!nombreKey) return acc;
                
                if (!acc[nombreKey]) {
                    acc[nombreKey] = {
                        cliente: nombreKey,
                        rif: trans.rif || 'N/A',
                        telefono: trans.telefono || 'N/A',
                        facturas: [],
                        totalCompradoUSD: 0,
                        deudaPendienteUSD: 0,
                        frecuenciaCompra: 0,
                        frecuenciaMarcas: {},
                        fechas: []
                    };
                }

                if ((!acc[nombreKey].rif || acc[nombreKey].rif === 'N/A') && trans.rif) {
                    acc[nombreKey].rif = trans.rif;
                }
                if ((!acc[nombreKey].telefono || acc[nombreKey].telefono === 'N/A') && trans.telefono) {
                    acc[nombreKey].telefono = trans.telefono;
                }

                const moneda = String(trans.moneda_pago || trans.moneda || (trans.simbolo === 'Bs' ? 'VES' : 'USD')).toUpperCase().trim();
                const montoBruto = parseFloat(trans.monto_facturado ?? trans.monto ?? trans.total) || 0;
                const tasaRegistrada = trans.tasa_cambio_dia ? parseFloat(trans.tasa_cambio_dia) : null;

                const transNormalizada = {
                    ...trans,
                    tipo_documento: 'Factura',
                    estatus: 'Pagado y Despachado',
                    moneda_pago: (moneda === 'VES' || moneda === 'BS') ? 'VES' : 'USD',
                    monto_facturado: montoBruto,
                    tasa_cambio_dia: tasaRegistrada,
                    monto_usd: 0 // Se completará de forma asíncrona con la API BCV
                };

                acc[nombreKey].facturas.push(transNormalizada);
                acc[nombreKey].frecuenciaCompra += 1;

                // Registro cronológico
                if (trans.fecha) {
                    let d = null;
                    if (typeof trans.fecha === 'string' && trans.fecha.includes('/')) {
                        const parts = trans.fecha.split('/');
                        if (parts.length === 3) {
                            d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                        }
                    } else {
                        d = new Date(trans.fecha);
                    }
                    if (d && !isNaN(d.getTime())) {
                        acc[nombreKey].fechas.push(d);
                    }
                }

                // Extracción de marcas preferidas (NLP)
                const corpusTexto = (trans.items || []).join(' ') + ' ' + (trans.desc || '');
                MARCAS_DETECTABLES.forEach(marca => {
                    const regex = new RegExp('\\b' + marca.replace(' ', '\\s+') + '\\b', 'gi');
                    const coincidencias = corpusTexto.match(regex);
                    if (coincidencias) {
                        acc[nombreKey].frecuenciaMarcas[marca] = (acc[nombreKey].frecuenciaMarcas[marca] || 0) + coincidencias.length;
                    }
                });

                return acc;
            }, {});

            return Object.values(agrupadoPorCliente).map(cuenta => {
                const marcasOrdenadas = Object.entries(cuenta.frecuenciaMarcas)
                    .sort((a, b) => b[1] - a[1])
                    .map(entry => entry[0]);

                let fechaUltimo = 'Sin transacciones aún';
                if (cuenta.fechas.length > 0) {
                    const fechaTimestamp = Math.max(...cuenta.fechas.map(f => f.getTime()));
                    const d = new Date(fechaTimestamp);
                    fechaUltimo = d.toISOString().split('T')[0];
                }

                const frecuencia = cuenta.frecuenciaCompra || cuenta.facturas.length || 0;

                return {
                    cliente: cuenta.cliente,
                    rif: cuenta.rif,
                    telefono: cuenta.telefono,
                    totalComprado: 0, // Se computará con exactitud en normalizarFacturasClienteAsync
                    frecuenciaCompra: frecuencia,
                    ticketPromedio: 0,
                    deudaPendiente: 0,
                    marcasPreferidas: marcasOrdenadas.length > 0 ? marcasOrdenadas.slice(0, 3) : (cuenta.facturas.length > 0 ? ['Multimarca / Universal'] : ['Sin compras aún']),
                    ultimoPedido: fechaUltimo,
                    totalFacturas: frecuencia,
                    facturas: cuenta.facturas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                };
            });
        };

        /**
         * Renderiza la tarjeta (Card) del perfil del cliente en el HTML
         * mostrando de forma prominente las 3 métricas con los colores de FB Parts (#385723)
         */
        window.renderizarPerfilClienteTransaccional = function(cliente) {
            const container = document.getElementById('crm-perfil-card-container');
            const notFound = document.getElementById('crm-transaccional-not-found');
            if (!container) return;

            if (!cliente) {
                container.innerHTML = '';
                if (notFound) notFound.style.display = 'flex';
                window.renderizarTablaFacturasCliente([]);
                return;
            }

            if (notFound) notFound.style.display = 'none';
            window.clienteSeleccionadoCRM = cliente;

            let estadoSolvencia = `<span style="background: #f8fafc; color: #64748b; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Sin Deudas Activas</span>`;
            if (cliente.deudaPendiente > 0) {
                estadoSolvencia = `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">Deuda Activa: ${window.formatearMonedaUSD(cliente.deudaPendiente)}</span>`;
            } else if (cliente.totalComprado > 0) {
                estadoSolvencia = `<span style="background: #eef3f0; color: #385723; border: 1px solid #c3e6cb; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">100% Solvente ($0.00)</span>`;
            }

            const telLimpio = String(cliente.telefono || '').replace(/[^0-9]/g, '');
            const botonWhatsApp = (telLimpio && telLimpio.length >= 10)
                ? `<a href="https://wa.me/${telLimpio}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: #25D366; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <i class="fab fa-whatsapp"></i> Contactar
                   </a>`
                : '';

            const badgeAuditoria = cliente.totalFacturas > 0
                ? `<span style="background: #eef3f0; color: #385723; border: 1px solid #c3e6cb; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">CLIENTE AUDITADO</span>`
                : `<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">EN DIRECTORIO</span>`;

            container.innerHTML = `
                <div style="background: linear-gradient(135deg, #fbfdfb 0%, #f4f7f5 100%); border: 1.5px solid #c3e6cb; border-radius: 14px; padding: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <!-- Cabecera de la Cuenta -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <h3 style="margin: 0; color: #1e293b; font-size: 19px; font-weight: 800; font-family: 'Oswald', sans-serif; letter-spacing: 0.3px;">
                                    ${SecuritySanitizer.escapeHtml(cliente.cliente)}
                                </h3>
                                ${badgeAuditoria}
                                <span id="crm-api-status-notice" style="display: none;"></span>
                            </div>
                            <p style="margin: 5px 0 0 0; font-size: 12.5px; color: #64748b;">
                                <strong>RIF:</strong> ${SecuritySanitizer.escapeHtml(cliente.rif || 'N/A')} &bull; 
                                <strong>Contacto Telefónico:</strong> ${SecuritySanitizer.escapeHtml(cliente.telefono || 'N/A')}
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${estadoSolvencia}
                            ${botonWhatsApp}
                        </div>
                    </div>

                    <!-- 3 MÉTRICAS PROMINENTES EN COLOR CORPORATIVO FB PARTS (#385723) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-top: 18px;">
                        
                        <!-- Métrica 1: Total Comprado (LTV Normalizado) -->
                        <div style="background: white; border: 1.5px solid #c3e6cb; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <span style="display: block; font-size: 11px; font-weight: 800; color: #385723; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fas fa-wallet" style="margin-right: 4px;"></i> Total Comprado (LTV)
                            </span>
                            <div id="crm-kpi-ltv-val" style="font-size: 26px; font-weight: 900; color: #385723; font-family: 'Oswald', sans-serif; margin-top: 5px;">
                                ${window.formatearMonedaUSD(cliente.totalComprado)}
                            </div>
                            <span style="font-size: 11px; color: #64748b; display: block; margin-top: 3px;">
                                Sumatoria total normalizada a USD
                            </span>
                        </div>

                        <!-- Métrica 2: Frecuencia de Compra -->
                        <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <span style="display: block; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fas fa-shopping-cart" style="margin-right: 4px; color: #5e8877;"></i> Frecuencia de Compra
                            </span>
                            <div id="crm-kpi-frecuencia-val" style="font-size: 26px; font-weight: 900; color: #1e293b; font-family: 'Oswald', sans-serif; margin-top: 5px;">
                                ${cliente.frecuenciaCompra} <span style="font-size: 14.5px; font-weight: 600; color: #64748b;">${cliente.frecuenciaCompra === 1 ? 'Factura' : 'Facturas'}</span>
                            </div>
                            <span style="font-size: 11px; color: #64748b; display: block; margin-top: 3px;">
                                Total de pedidos emitidos
                            </span>
                        </div>

                        <!-- Métrica 3: Ticket Promedio (NUEVO) -->
                        <div style="background: white; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <span style="display: block; font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fas fa-chart-line" style="margin-right: 4px; color: #16a34a;"></i> Ticket Promedio (AOV)
                            </span>
                            <div id="crm-kpi-aov-val" style="font-size: 26px; font-weight: 900; color: #2c441b; font-family: 'Oswald', sans-serif; margin-top: 5px;">
                                ${window.formatearMonedaUSD(cliente.ticketPromedio)}
                            </div>
                            <span style="font-size: 11px; color: #64748b; display: block; margin-top: 3px;">
                                Total USD ÷ Frecuencia de Compra
                            </span>
                        </div>

                    </div>

                    <!-- Fila Complementaria: Marcas Relevantes y Última Fecha -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Marcas Preferidas:</span>
                            ${cliente.marcasPreferidas.map((m, idx) => `
                                <span style="background: ${idx === 0 && cliente.totalFacturas > 0 ? '#eef3f0' : '#f8fafc'}; color: ${idx === 0 && cliente.totalFacturas > 0 ? '#385723' : '#475569'}; border: 1px solid ${idx === 0 && cliente.totalFacturas > 0 ? '#c3e6cb' : '#cbd5e1'}; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-car" style="font-size: 9px;"></i> ${SecuritySanitizer.escapeHtml(m)}
                                </span>
                            `).join('')}
                        </div>
                        <div style="font-size: 12px; color: #475569; font-weight: 600;">
                            <i class="far fa-calendar-check" style="color: #5e8877; margin-right: 4px;"></i> Última Compra: <strong>${cliente.ultimoPedido}</strong>
                        </div>
                    </div>
                </div>
            `;

            window.renderizarTablaFacturasCliente(cliente.facturas || []);

            // Activar la normalización asíncrona en vivo de las facturas del cliente
            window.normalizarFacturasClienteAsync(cliente);
        };

        /**
         * Renderiza la tabla de transacciones detallando la moneda original, la tasa del día
         * y el monto convertido a USD históricos para que todo sea transparente.
         */
        window.renderizarTablaFacturasCliente = function(facturas) {
            const tbody = document.getElementById('crm-facturas-tbody');
            const badge = document.getElementById('crm-facturas-count-badge');
            if (!tbody) return;

            if (badge) badge.innerText = `${facturas.length} Operaciones`;

            if (facturas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;"><i class="fas fa-inbox" style="margin-right: 6px;"></i> Este cliente no tiene facturas ni pedidos registrados todavía.</td></tr>`;
                return;
            }

            tbody.innerHTML = facturas.map(f => {
                let badgeStyle = 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
                const estLower = String(f.estado || '').toLowerCase();
                if (estLower.includes('pagad') || estLower.includes('aprobado') || estLower.includes('entregado')) {
                    badgeStyle = 'background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;';
                } else if (estLower.includes('tránsito') || estLower.includes('camino') || estLower.includes('proces')) {
                    badgeStyle = 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;';
                } else if (estLower.includes('pendient') || estLower.includes('crédito')) {
                    badgeStyle = 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;';
                }

                const itemsStr = Array.isArray(f.items) && f.items.length > 0 
                    ? f.items.join(' • ') 
                    : (f.desc || 'Repuestos y autopartes');

                const esVES = f.moneda_pago === 'VES' || f.moneda_pago === 'BS';
                const montoFactDisplay = esVES
                    ? `Bs. ${Number(f.monto_facturado).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${Number(f.monto_facturado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                let tasaDisplay = '';
                if (esVES) {
                    if (f.tasa_cambio_dia && Number(f.tasa_cambio_dia) > 0) {
                        const esFall = f.fuente_tasa && f.fuente_tasa.includes('Fallback');
                        tasaDisplay = `
                            <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 2px;">
                                <span style="font-weight: 800; color: ${esFall ? '#b45309' : '#15803d'}; font-size: 12px; font-family: monospace;">
                                    ${Number(f.tasa_cambio_dia).toFixed(2)} Bs/$
                                </span>
                                <span style="font-size: 9.5px; color: ${esFall ? '#92400e' : '#166534'}; background: ${esFall ? '#fef3c7' : '#f0fdf4'}; border: 1px solid ${esFall ? '#fde68a' : '#bbf7d0'}; padding: 0.5px 5px; border-radius: 4px;">
                                    ${SecuritySanitizer.escapeHtml(f.fuente_tasa || 'BCV')}
                                </span>
                            </div>
                        `;
                    } else {
                        tasaDisplay = `<span style="color: #64748b; font-size: 11px;"><i class="fas fa-sync fa-spin"></i> Consultando...</span>`;
                    }
                } else {
                    tasaDisplay = `<span style="color: #94a3b8; font-size: 11.5px; font-family: monospace;">1.00 (USD)</span>`;
                }

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 14px; font-weight: bold; font-family: monospace; color: #0f172a;">
                            <span style="font-size: 10px; background: #e2e8f0; color: #475569; padding: 1px 5px; border-radius: 4px; margin-right: 4px;">${SecuritySanitizer.escapeHtml(f.origen || 'Doc')}</span>
                            ${SecuritySanitizer.escapeHtml(f.id)}
                        </td>
                        <td style="padding: 10px 14px; color: #64748b; font-size: 12px;">${SecuritySanitizer.escapeHtml(f.fecha || 'Sin fecha')}</td>
                        <td style="padding: 10px 14px; font-weight: 600; color: #334155; max-width: 300px;">${SecuritySanitizer.escapeHtml(itemsStr)}</td>
                        <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-family: monospace; color: ${esVES ? '#b45309' : '#15803d'}; font-size: 12.5px;">
                            ${montoFactDisplay}
                        </td>
                        <td style="padding: 10px 14px; text-align: center; font-size: 11.5px; font-family: monospace;">
                            ${tasaDisplay}
                        </td>
                        <td style="padding: 10px 14px; text-align: right; font-weight: 900; font-family: 'Oswald', sans-serif; color: #385723; font-size: 14.5px;">
                            ${window.formatearMonedaUSD(f.monto_usd)}
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                                ${SecuritySanitizer.escapeHtml(f.estado || 'Emitido')}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        window.filtrarClientesTransaccionales = function() {
            const query = (document.getElementById('crm-search-transaccional')?.value || '').trim().toLowerCase();
            if (!query) {
                window.renderizarPerfilClienteTransaccional(window.clientesAgrupadosCache[0] || null);
                return;
            }

            const coincidente = window.clientesAgrupadosCache.find(c => 
                c.cliente.toLowerCase().includes(query) ||
                (c.rif && c.rif.toLowerCase().includes(query)) ||
                c.marcasPreferidas.some(m => m.toLowerCase().includes(query))
            );

            window.renderizarPerfilClienteTransaccional(coincidente || null);
        };

        window.limpiarFiltroCRM = function() {
            const input = document.getElementById('crm-search-transaccional');
            if (input) input.value = '';
            window.renderizarPerfilClienteTransaccional(window.clientesAgrupadosCache[0] || null);
        };

        /**
         * Lee transacciones de Firestore (Facturas + Pedidos) o usa el dataset con normalizador
         * de divisas garantizando cálculo exacto en USD.
         */
        window.recomputarCRMTransaccional = async function() {
            const container = document.getElementById('crm-perfil-card-container');
            const badgeCuentas = document.getElementById('crm-total-cuentas-badge');
            const tbody = document.getElementById('crm-facturas-tbody');

            if (container) {
                container.innerHTML = `
                    <div style="padding: 35px 20px; text-align: center; color: #64748b;">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 26px; color: #5e8877; margin-bottom: 10px;"></i>
                        <p style="margin: 0; font-size: 13.5px; font-weight: 600;">Consultando tasas cambiarias oficiales y normalizando transacciones...</p>
                    </div>
                `;
            }

            try {
                let transaccionesAnalizar = [];

                // 1. Facturas Reales de Firestore (Exclusivamente Facturas Pagadas y Despachadas)
                try {
                    const snapFac = await getDocs(collection(db, "facturas"));
                    snapFac.forEach(docSnap => {
                        const fac = docSnap.data();
                        const estadoLower = String(fac.estatusComercial || fac.estado || '').toLowerCase();
                        if (estadoLower.includes('anulad')) return;

                        let itemsNombres = [];
                        if (Array.isArray(fac.items)) {
                            itemsNombres = fac.items.map(it => it.desc || it.nombre || '').filter(Boolean);
                        }

                        const moneda = String(fac.moneda_pago || fac.moneda || (fac.simbolo === 'Bs' ? 'VES' : 'USD')).toUpperCase().trim();
                        const montoFact = parseFloat(fac.monto_facturado ?? fac.total) || 0;
                        const tasaRegistrada = parseFloat(fac.tasa_cambio_dia ?? fac.tasaBCV) || null;

                        // Se asigna explícitamente tipo_documento: 'Factura' y estatus: 'Pagado y Despachado'
                        transaccionesAnalizar.push({
                            id: fac.nro ? `FAC-#${fac.nro}` : `FAC-${docSnap.id.substring(0, 6).toUpperCase()}`,
                            tipo_documento: 'Factura',
                            cliente: (fac.cliente || 'Consumidor Final').trim(),
                            rif: fac.rif || '',
                            telefono: fac.telefono || '',
                            fecha: fac.fecha || '',
                            moneda_pago: moneda,
                            monto_facturado: montoFact,
                            tasa_cambio_dia: tasaRegistrada,
                            estatus: 'Pagado y Despachado',
                            items: itemsNombres,
                            timestamp: fac.timestamp || 0,
                            origen: 'Factura'
                        });
                    });
                } catch (eFac) {
                    console.warn("Aviso al leer facturas para CRM:", eFac);
                }

                // NOTA: Se descarta la colección 'pedidos' para evitar doble conteo (Regla 1)

                // Si aún no hay transacciones en Firestore, cargamos el mock dataset con divisas mixtas
                if (transaccionesAnalizar.length === 0) {
                    transaccionesAnalizar = [...window.mockPedidosTransaccionales];
                }

                // 3. Clientes Registrados en Firestore para enriquecer o incorporar
                const clientesDirectorio = {};
                try {
                    const snapCli = await getDocs(collection(db, "clientes"));
                    snapCli.forEach(docSnap => {
                        const cli = docSnap.data();
                        const nom = (cli.nombre || '').trim();
                        if (nom) {
                            clientesDirectorio[nom.toLowerCase()] = {
                                nombre: nom,
                                rif: cli.rif || '',
                                direccion: cli.direccion || '',
                                telefono: cli.telefono || ''
                            };
                        }
                    });
                } catch (eCli) {
                    console.warn("Aviso al leer directorio de clientes para CRM:", eCli);
                }

                // 4. Agrupación analítica de clientes
                const cuentasCalculadas = window.procesarClientesDesdeTransacciones(transaccionesAnalizar);

                // Enriquecer datos de contacto desde el directorio de clientes
                cuentasCalculadas.forEach(c => {
                    const infoDirectorio = clientesDirectorio[c.cliente.toLowerCase()];
                    if (infoDirectorio) {
                        if (!c.rif || c.rif === 'N/A') c.rif = infoDirectorio.rif;
                        if (!c.telefono || c.telefono === 'N/A') c.telefono = infoDirectorio.telefono;
                    }
                });

                // Incorporar clientes registrados sin compras aún
                const cuentasSet = new Set(cuentasCalculadas.map(c => c.cliente.toLowerCase()));
                Object.values(clientesDirectorio).forEach(cliReg => {
                    if (!cuentasSet.has(cliReg.nombre.toLowerCase())) {
                        cuentasCalculadas.push({
                            cliente: cliReg.nombre,
                            rif: cliReg.rif || 'N/A',
                            telefono: cliReg.telefono || 'N/A',
                            totalComprado: 0,
                            frecuenciaCompra: 0,
                            ticketPromedio: 0,
                            deudaPendiente: 0,
                            marcasPreferidas: ['Sin compras aún'],
                            ultimoPedido: 'Sin transacciones aún',
                            totalFacturas: 0,
                            facturas: []
                        });
                    }
                });

                // 5. Normalización Asíncrona estricta: consultamos la API BCV (o fallback de seguridad)
                // y calculamos LTV, Frecuencia y Ticket Promedio
                await Promise.all(cuentasCalculadas.map(c => window.normalizarFacturasClienteAsync(c)));

                // Ordenar por volumen LTV descendente una vez normalizadas todas las cuentas
                cuentasCalculadas.sort((a, b) => b.totalComprado - a.totalComprado);
                window.clientesAgrupadosCache = cuentasCalculadas;

                if (badgeCuentas) {
                    badgeCuentas.innerHTML = `<i class="fas fa-users-cog"></i> ${window.clientesAgrupadosCache.length} Cuentas`;
                }

                if (window.clientesAgrupadosCache.length === 0) {
                    if (container) {
                        container.innerHTML = `
                            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 40px 20px; text-align: center;">
                                <i class="fas fa-user-friends" style="font-size: 36px; color: #94a3b8; margin-bottom: 12px;"></i>
                                <h4 style="margin: 0 0 6px 0; color: #334155; font-size: 16px; font-weight: 700;">No hay transacciones registradas</h4>
                                <p style="margin: 0 auto; max-width: 520px; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                                    El CRM procesará automáticamente tus métricas de compra, marcas y solvencia en cuanto registres ventas.
                                </p>
                            </div>
                        `;
                    }
                    if (tbody) {
                        tbody.innerHTML = `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;">Sin transacciones para analizar.</td></tr>`;
                    }
                    return;
                }

                // Renderizar el cliente de mayor volumen LTV
                window.renderizarPerfilClienteTransaccional(window.clientesAgrupadosCache[0] || null);

            } catch (err) {
                console.error("Error al recomputar CRM con Firestore:", err);
                if (container) {
                    container.innerHTML = `
                        <div style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 16px; border-radius: 8px; font-size: 13px;">
                            <i class="fas fa-exclamation-circle"></i> Error al calcular métricas del CRM: ${SecuritySanitizer.escapeHtml(err.message || String(err))}
                        </div>
                    `;
                }
            }
        };

        // =========================================================================
        // 🏆 VISTA 3: INTELIGENCIA DE VENTAS GLOBAL & RANKING DE CLIENTES (LEADERBOARD)
        // =========================================================================
        window.rankingClientesGlobalCache = [];

        /**
         * Sanitiza y normaliza un RIF:
         * 1. Convierte a mayúsculas.
         * 2. Elimina guiones (-), puntos (.) y espacios en blanco usando Regex.
         */
        window.normalizarRIF = function(rifBruto) {
            if (!rifBruto || typeof rifBruto !== 'string') return '';
            return rifBruto.replace(/[-\s.]/g, '').toUpperCase().trim();
        };

        /**
         * Formatea visualmente el RIF agregando el guion estándar al final
         * (Ej: J070017368 -> J07001736-8)
         */
        window.formatearRIFVisual = function(rifNormalizado) {
            if (!rifNormalizado) return 'N/A';
            const limpio = String(rifNormalizado).replace(/[-\s.]/g, '').toUpperCase().trim();
            if (limpio.length >= 3) {
                return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
            }
            return limpio;
        };

        /**
         * Recomputa las métricas de agregación global y el Leaderboard:
         * 1. Filtro estricto: Exclusivamente Facturas Pagadas y Despachadas (Cero duplicidad de Pedidos/Cotizaciones).
         * 2. Normalización multimoneda (Bs a USD) con la API BCV.
         * 3. Ticket Promedio Global (AOV): Total Facturado USD ÷ Total Facturas Emitidas.
         * 4. Ranking (Leaderboard): Agrupa por cliente, calcula LTV y ordena de Mayor a Menor.
         */
        window.recomputarInteligenciaVentasGlobal = async function() {
            const elAov = document.getElementById('global-kpi-aov');
            const elAovSub = document.getElementById('global-kpi-aov-subtext');
            const elTopName = document.getElementById('global-kpi-top-client-name');
            const elTopLtv = document.getElementById('global-kpi-top-client-ltv');
            const elTotalVentas = document.getElementById('global-kpi-total-ventas');
            const elTotalVentasSub = document.getElementById('global-kpi-total-ventas-subtext');
            const elBadgeStatus = document.getElementById('global-kpi-badge-status');
            const tbody = document.getElementById('global-ranking-tbody');

            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 30px; text-align: center; color: #64748b;">
                            <i class="fas fa-circle-notch fa-spin" style="font-size: 24px; color: #385723; margin-bottom: 8px;"></i>
                            <p style="margin: 0; font-size: 13px; font-weight: 600;">Audición en curso: Consultando tasas cambiarias y calculando ranking global...</p>
                        </td>
                    </tr>
                `;
            }

            try {
                let transaccionesAnalizar = [];

                // 1. Obtener Facturas Reales de Firestore
                try {
                    const snapFac = await getDocs(collection(db, "facturas"));
                    snapFac.forEach(docSnap => {
                        const fac = docSnap.data();
                        const estadoLower = String(fac.estatusComercial || fac.estado || '').toLowerCase();
                        if (estadoLower.includes('anulad')) return;

                        let itemsNombres = [];
                        if (Array.isArray(fac.items)) {
                            itemsNombres = fac.items.map(it => it.desc || it.nombre || '').filter(Boolean);
                        }

                        const moneda = String(fac.moneda_pago || fac.moneda || (fac.simbolo === 'Bs' ? 'VES' : 'USD')).toUpperCase().trim();
                        const montoFact = parseFloat(fac.monto_facturado ?? fac.total) || 0;
                        const tasaRegistrada = parseFloat(fac.tasa_cambio_dia ?? fac.tasaBCV) || null;

                        transaccionesAnalizar.push({
                            id: fac.nro ? `FAC-#${fac.nro}` : `FAC-${docSnap.id.substring(0, 6).toUpperCase()}`,
                            tipo_documento: 'Factura',
                            cliente: (fac.cliente || 'Consumidor Final').trim(),
                            rif: fac.rif || '',
                            telefono: fac.telefono || '',
                            fecha: fac.fecha || '',
                            moneda_pago: moneda,
                            monto_facturado: montoFact,
                            tasa_cambio_dia: tasaRegistrada,
                            estatus: 'Pagado y Despachado',
                            items: itemsNombres,
                            timestamp: fac.timestamp || 0,
                            origen: 'Factura'
                        });
                    });
                } catch (eFac) {
                    console.warn("Aviso al leer facturas para Inteligencia Global:", eFac);
                }

                // Si no hay transacciones en Firestore, utilizar el dataset transaccional con divisas
                if (transaccionesAnalizar.length === 0 && Array.isArray(window.mockPedidosTransaccionales)) {
                    transaccionesAnalizar = [...window.mockPedidosTransaccionales];
                }

                // =========================================================================
                // 🛡️ REGLA 1: FILTRO STRICT (PREVENCIÓN DE DUPLICIDAD FINANCIERA)
                // SOLO Facturas con Estatus 'Pagado y Despachado'
                // =========================================================================
                let descartadosCount = 0;
                const facturasValidas = transaccionesAnalizar.filter(item => {
                    const tipoDoc = String(item.tipo_documento || item.tipo || item.origen || '').trim().toLowerCase();
                    const estadoDoc = String(item.estatus || item.estado || item.estatusComercial || '').trim().toLowerCase();

                    const esFactura = (tipoDoc === 'factura');
                    const esPagadoYDespachado = (
                        estadoDoc === 'pagado y despachado' ||
                        estadoDoc === 'pagada y despachada' ||
                        estadoDoc === 'pagada' ||
                        estadoDoc === 'pagado'
                    );

                    const pasa = esFactura && esPagadoYDespachado;
                    if (!pasa) descartadosCount++;
                    return pasa;
                });

                console.info(`[Inteligencia Ventas Global] Total registros: ${transaccionesAnalizar.length} | Descartados (Pedidos / Cotizaciones): ${descartadosCount} | Facturas Auditadas: ${facturasValidas.length}`);

                // =========================================================================
                // ⚡ REGLA 2: NORMALIZACIÓN CAMBIARIA ASÍNCRONA CON TASA BCV
                // =========================================================================
                let totalVentasUSD = 0;
                await Promise.all(facturasValidas.map(async (fac) => {
                    const moneda = String(fac.moneda_pago || fac.moneda || 'USD').toUpperCase().trim();
                    const montoBruto = parseFloat(fac.monto_facturado ?? fac.monto ?? fac.total) || 0;

                    if (moneda === 'VES' || moneda === 'BS') {
                        fac.moneda_pago = 'VES';
                        const tasa = await window.obtenerTasaHistoricaBCV(fac.fecha);
                        fac.tasa_cambio_dia = tasa;
                        const tasaNum = Number(tasa) || 1;
                        fac.monto_usd = Math.round((tasaNum > 0 ? (montoBruto / tasaNum) : montoBruto) * 100) / 100;
                    } else {
                        fac.moneda_pago = 'USD';
                        fac.monto_usd = montoBruto;
                        fac.tasa_cambio_dia = 1.00;
                    }
                    totalVentasUSD += (fac.monto_usd || 0);
                }));

                totalVentasUSD = Math.round(totalVentasUSD * 100) / 100;
                const totalFacturasGlobal = facturasValidas.length;

                // Ticket Promedio Global (AOV): Total Facturado USD ÷ Total Facturas
                const ticketPromedioGlobal = (totalFacturasGlobal > 0)
                    ? Math.round((totalVentasUSD / totalFacturasGlobal) * 100) / 100
                    : 0;

                // =========================================================================
                // 📊 AGRUPACIÓN POR CLIENTE Y RANKING (LEADERBOARD LTV DESCENDENTE)
                // Sanitización y normalización estricta por RIF para evitar duplicidad
                // =========================================================================
                const agrupadoClientes = facturasValidas.reduce((acc, fac) => {
                    const rifNorm = window.normalizarRIF(fac.rif);
                    
                    // Si tiene un RIF válido, la clave única de agrupación es el RIF sanitizado;
                    // de lo contrario, se agrupa por nombre normalizado.
                    const groupKey = (rifNorm && rifNorm !== 'NA' && rifNorm !== 'SN')
                        ? rifNorm
                        : (fac.cliente || 'Consumidor Final').trim().toLowerCase();

                    if (!acc[groupKey]) {
                        acc[groupKey] = {
                            cliente: (fac.cliente || 'Consumidor Final').trim(),
                            rif: window.formatearRIFVisual(rifNorm || fac.rif),
                            rifNormalizado: rifNorm,
                            telefono: fac.telefono || 'N/A',
                            facturasEmitidas: 0,
                            totalComprado: 0,
                            ticketPromedio: 0,
                            ultimoTimestamp: fac.timestamp || 0
                        };
                    } else {
                        // Utiliza el último "Nombre de Cliente" registrado cronológicamente para ese RIF
                        if ((fac.timestamp || 0) >= (acc[groupKey].ultimoTimestamp || 0)) {
                            acc[groupKey].cliente = (fac.cliente || acc[groupKey].cliente).trim();
                            acc[groupKey].ultimoTimestamp = fac.timestamp || 0;
                            if (fac.telefono && fac.telefono !== 'N/A') {
                                acc[groupKey].telefono = fac.telefono;
                            }
                        }
                    }

                    acc[groupKey].facturasEmitidas += 1;
                    acc[groupKey].totalComprado += (fac.monto_usd || 0);

                    return acc;
                }, {});

                const ranking = Object.values(agrupadoClientes).map(c => {
                    c.totalComprado = Math.round(c.totalComprado * 100) / 100;
                    c.ticketPromedio = c.facturasEmitidas > 0
                        ? Math.round((c.totalComprado / c.facturasEmitidas) * 100) / 100
                        : 0;
                    return c;
                });

                // Ordenamiento Estricto Descendente por Total Comprado (LTV)
                ranking.sort((a, b) => b.totalComprado - a.totalComprado);
                window.rankingClientesGlobalCache = ranking;

                // =========================================================================
                // 🖥️ RENDERIZADO EN EL DOM DE TARJETAS Y LEADERBOARD
                // =========================================================================
                if (elAov) elAov.innerText = window.formatearMonedaUSD(ticketPromedioGlobal);
                if (elAovSub) elAovSub.innerText = `${window.formatearMonedaUSD(totalVentasUSD)} ÷ ${totalFacturasGlobal} ${totalFacturasGlobal === 1 ? 'Factura emitida' : 'Facturas emitidas'}`;

                if (ranking.length > 0) {
                    const top1 = ranking[0];
                    if (elTopName) elTopName.innerText = top1.cliente;
                    if (elTopLtv) elTopLtv.innerText = `Total Comprado: ${window.formatearMonedaUSD(top1.totalComprado)} (${top1.facturasEmitidas} ${top1.facturasEmitidas === 1 ? 'factura' : 'facturas'})`;
                } else {
                    if (elTopName) elTopName.innerText = 'Sin registros válidos';
                    if (elTopLtv) elTopLtv.innerText = 'Total Comprado: $0.00';
                }

                if (elTotalVentas) elTotalVentas.innerText = window.formatearMonedaUSD(totalVentasUSD);
                if (elTotalVentasSub) elTotalVentasSub.innerText = `Basado en ${totalFacturasGlobal} ${totalFacturasGlobal === 1 ? 'factura liquidada' : 'facturas liquidadas'}`;

                if (elBadgeStatus) {
                    elBadgeStatus.innerHTML = `<i class="fas fa-check-circle" style="color: #166534;"></i> AUDITADO (${ranking.length} CLIENTES)`;
                }

                window.renderizarTablaRankingGlobal(ranking);

            } catch (err) {
                console.error("Error en recomputarInteligenciaVentasGlobal:", err);
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="padding: 24px; text-align: center; color: #dc2626; background: #fef2f2;">
                                <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i> Error al calcular inteligencia global: ${SecuritySanitizer.escapeHtml(err.message || String(err))}
                            </td>
                        </tr>
                    `;
                }
            }
        };

        /**
         * Renderiza la tabla de Ranking (Leaderboard) con resalte visual para los puestos #1, #2 y #3.
         */
        window.renderizarTablaRankingGlobal = function(rankingList) {
            const tbody = document.getElementById('global-ranking-tbody');
            const badge = document.getElementById('global-ranking-count-badge');
            if (!tbody) return;

            const list = Array.isArray(rankingList) ? rankingList : [];
            if (badge) badge.innerText = `${list.length} ${list.length === 1 ? 'Cliente' : 'Clientes'}`;

            if (list.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8;">
                            <i class="fas fa-inbox" style="margin-right: 6px;"></i> No se encontraron clientes en el ranking global.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = list.map((cli, index) => {
                const posicion = index + 1;
                let posBadge = '';
                let rowBg = 'background: white;';

                if (posicion === 1) {
                    rowBg = 'background: #eef3f0;'; // Resalte visual corporativo F&B Parts
                    posBadge = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #fef3c7; color: #b45309; border: 1.5px solid #fde68a; border-radius: 50%; font-size: 12px; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                                <i class="fas fa-crown"></i>
                            </span>
                            <strong style="color: #b45309; font-size: 14px; font-family: 'Oswald', sans-serif;">#1</strong>
                        </div>
                    `;
                } else if (posicion === 2) {
                    rowBg = 'background: #fbfdf9;'; // Resalte visual muy tenue
                    posBadge = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; border-radius: 50%; font-size: 12px; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                                <i class="fas fa-medal"></i>
                            </span>
                            <strong style="color: #475569; font-size: 14px; font-family: 'Oswald', sans-serif;">#2</strong>
                        </div>
                    `;
                } else if (posicion === 3) {
                    rowBg = 'background: #fbfaf9;'; // Resalte visual muy tenue
                    posBadge = `
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #fff7ed; color: #c2410c; border: 1.5px solid #ffedd5; border-radius: 50%; font-size: 12px; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                                <i class="fas fa-award"></i>
                            </span>
                            <strong style="color: #c2410c; font-size: 14px; font-family: 'Oswald', sans-serif;">#3</strong>
                        </div>
                    `;
                } else {
                    posBadge = `
                        <span style="color: #64748b; font-weight: 700; font-family: monospace; font-size: 13px;">#${posicion}</span>
                    `;
                }

                const safeCliente = SecuritySanitizer.escapeHtml(cli.cliente);
                const safeRif = SecuritySanitizer.escapeHtml(cli.rif || 'N/A');

                return `
                    <tr style="${rowBg} border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#eef3f0'" onmouseout="this.style.background='${posicion === 1 ? '#eef3f0' : (posicion === 2 ? '#fbfdf9' : (posicion === 3 ? '#fbfaf9' : 'white'))}'">
                        <td style="padding: 12px 14px; text-align: center;">
                            ${posBadge}
                        </td>
                        <td style="padding: 12px 14px;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
                                ${safeCliente}
                                ${posicion === 1 ? '<span style="font-size: 10px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 1px 6px; border-radius: 4px; font-weight: 800;">LÍDER LTV</span>' : ''}
                            </div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                                RIF: ${safeRif}
                            </div>
                        </td>
                        <td style="padding: 12px 14px; text-align: center;">
                            <span style="display: inline-block; padding: 3px 10px; background: #ffffff; color: #334155; border: 1px solid #cbd5e1; border-radius: 12px; font-weight: 700; font-size: 11.5px; font-family: monospace;">
                                ${cli.facturasEmitidas} ${cli.facturasEmitidas === 1 ? 'Factura' : 'Facturas'}
                            </span>
                        </td>
                        <td style="padding: 12px 14px; text-align: right; font-weight: 700; font-family: monospace; color: #1e293b; font-size: 13.5px;">
                            ${window.formatearMonedaUSD(cli.ticketPromedio)}
                        </td>
                        <td style="padding: 12px 14px; text-align: right; font-weight: 900; font-family: 'Oswald', sans-serif; color: #385723; font-size: 16px;">
                            ${window.formatearMonedaUSD(cli.totalComprado)}
                        </td>
                        <td style="padding: 12px 14px; text-align: center;">
                            <button type="button" 
                                onclick="window.irACRMCliente('${safeCliente.replace(/'/g, "\\'")}')" 
                                title="Ver ficha en CRM"
                                style="padding: 6px 12px; background: #385723; color: white; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                                <i class="fas fa-chart-line"></i> Ver CRM
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        /**
         * Navega fluidamente a la pestaña de CRM individual filtrando de inmediato por el cliente seleccionado
         */
        window.irACRMCliente = function(nombreCliente) {
            if (!nombreCliente) return;
            window.cambiarSubtabClientes('crm');
            const inputSearch = document.getElementById('crm-search-transaccional');
            if (inputSearch) {
                inputSearch.value = nombreCliente;
                window.filtrarClientesTransaccionales();
            }
        };

        /**
         * Filtra reactivamente el Leaderboard por el buscador
         */
        window.filtrarRankingGlobal = function() {
            const query = (document.getElementById('global-ranking-search')?.value || '').trim().toLowerCase();
            if (!query) {
                window.renderizarTablaRankingGlobal(window.rankingClientesGlobalCache || []);
                return;
            }
            const filtrados = (window.rankingClientesGlobalCache || []).filter(c => 
                c.cliente.toLowerCase().includes(query) ||
                (c.rif && c.rif.toLowerCase().includes(query))
            );
            window.renderizarTablaRankingGlobal(filtrados);
        };


        // =========================================================================
        // 📦 VISTA 2: GESTOR DE TARIFAS BASE & CALCULADORA LANDED COST (TIEMPO REAL)
        // =========================================================================
        window.tarifasBaseDefault = {
            tealca:      { nombre: "Tealca", base: 5.00, porKg: 2.00, recargoInterior: 3.00, zona: "Nacional (Agencias y Domicilio)" },
            mrw:         { nombre: "MRW", base: 4.50, porKg: 2.20, recargoInterior: 3.50, zona: "Nacional (Oficinas Receptoras)" },
            zoom:        { nombre: "Grupo Zoom", base: 6.00, porKg: 2.50, recargoInterior: 4.00, zona: "Nacional (Aéreo / Terrestre)" },
            delivery_fb: { nombre: "Delivery Propio F&B", base: 0.00, porKg: 0.00, recargoInterior: 0.00, zona: "Caracas Metropolitana" }
        };

        // Estado activo en memoria
        window.tarifasBaseActivas = JSON.parse(JSON.stringify(window.tarifasBaseDefault));

        window.renderizarTablaTarifasBase = function() {
            const tbody = document.getElementById('tabla-tarifas-base-tbody');
            if (!tbody) return;

            tbody.innerHTML = Object.entries(window.tarifasBaseActivas).map(([key, op]) => {
                const esDeliveryPropio = (key === 'delivery_fb');
                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 14px; font-weight: bold; color: #1e293b;">
                            <i class="fas ${esDeliveryPropio ? 'fa-motorcycle text-[#5e8877]' : 'fa-truck text-gray-400'}"></i> ${op.nombre}
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <input 
                                type="number" 
                                step="0.5" 
                                min="0" 
                                value="${op.base.toFixed(2)}" 
                                ${esDeliveryPropio ? 'disabled style="background:#f1f5f9; color:#94a3b8;"' : ''}
                                oninput="window.actualizarTarifaBaseInput('${key}', 'base', this.value)"
                                style="width: 80px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-weight: bold;"
                            />
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <input 
                                type="number" 
                                step="0.1" 
                                min="0" 
                                value="${op.porKg.toFixed(2)}" 
                                ${esDeliveryPropio ? 'disabled style="background:#f1f5f9; color:#94a3b8;"' : ''}
                                oninput="window.actualizarTarifaBaseInput('${key}', 'porKg', this.value)"
                                style="width: 80px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-weight: bold;"
                            />
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                            <input 
                                type="number" 
                                step="0.5" 
                                min="0" 
                                value="${op.recargoInterior.toFixed(2)}" 
                                ${esDeliveryPropio ? 'disabled style="background:#f1f5f9; color:#94a3b8;"' : ''}
                                oninput="window.actualizarTarifaBaseInput('${key}', 'recargoInterior', this.value)"
                                style="width: 80px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-weight: bold;"
                            />
                        </td>
                        <td style="padding: 10px 14px; color: #64748b; font-size: 11.5px;">${op.zona}</td>
                    </tr>
                `;
            }).join('');
        };

        window.actualizarTarifaBaseInput = function(operadorKey, campo, nuevoValor) {
            const valNum = Math.max(0, parseFloat(nuevoValor) || 0);
            if (window.tarifasBaseActivas[operadorKey]) {
                window.tarifasBaseActivas[operadorKey][campo] = valNum;
                window.ejecutarCalculoLandedCost();
            }
        };

        window.restablecerTarifasBaseDefault = function() {
            window.tarifasBaseActivas = JSON.parse(JSON.stringify(window.tarifasBaseDefault));
            window.renderizarTablaTarifasBase();
            window.ejecutarCalculoLandedCost();
        };

        window.ejecutarCalculoLandedCost = function() {
            const agenciaKey = document.getElementById('calc-agencia-select')?.value || 'tealca';
            const peso = Math.max(0.1, parseFloat(document.getElementById('calc-peso-input')?.value || '1'));
            const destino = document.getElementById('calc-destino-select')?.value || 'interior';

            const config = window.tarifasBaseActivas[agenciaKey] || window.tarifasBaseActivas.tealca;
            
            let base = 0;
            let costoPeso = 0;
            let recargoZona = 0;
            let total = 0;
            let ecuacion = "";
            let nota = "";

            if (agenciaKey === 'delivery_fb') {
                if (destino === 'caracas_centro') {
                    base = 0.00;
                    costoPeso = 0.00;
                    recargoZona = 0.00;
                    total = 0.00;
                    ecuacion = "Tarifa Plana ($0.00)";
                    nota = "✅ Delivery Gratuito en Caracas Centro / Municipio Libertador.";
                } else if (destino === 'caracas_este') {
                    base = 5.00;
                    costoPeso = 0.00;
                    recargoZona = 0.00;
                    total = 5.00;
                    ecuacion = "Tarifa Plana Este ($5.00)";
                    nota = "🛵 Tarifa plana fija para Chacao, Baruta, Sucre y El Hatillo ($5.00).";
                } else {
                    base = 0.00;
                    costoPeso = 0.00;
                    recargoZona = 0.00;
                    total = 0.00;
                    ecuacion = "No Disponible";
                    nota = "⚠️ El Delivery Propio no cubre el interior. Selecciona Tealca, MRW o Zoom.";
                }
            } else {
                base = config.base;
                costoPeso = Math.round(peso * config.porKg * 100) / 100;
                recargoZona = (destino === 'interior') ? config.recargoInterior : 1.50;
                total = Math.round((base + costoPeso + recargoZona) * 100) / 100;
                ecuacion = `$${base.toFixed(2)} + (${peso}kg × $${config.porKg.toFixed(2)}) + $${recargoZona.toFixed(2)}`;
                nota = `📦 Estimado vía ${config.nombre}. Multiplica peso por la tarifa activa del panel base.`;
            }

            // Actualizar DOM
            const elTotal = document.getElementById('calc-costo-total');
            const elBase = document.getElementById('calc-base-display');
            const elPeso = document.getElementById('calc-peso-display');
            const elRecargo = document.getElementById('calc-recargo-display');
            const elKgLabel = document.getElementById('calc-kg-label');
            const elEcuacion = document.getElementById('calc-ecuacion-display');
            const elBadge = document.getElementById('calc-operador-badge');
            const elNota = document.getElementById('calc-mensaje-nota');

            if (elTotal) elTotal.innerText = total.toFixed(2);
            if (elBase) elBase.innerText = `$${base.toFixed(2)}`;
            if (elPeso) elPeso.innerText = `$${costoPeso.toFixed(2)}`;
            if (elRecargo) elRecargo.innerText = `$${recargoZona.toFixed(2)}`;
            if (elKgLabel) elKgLabel.innerText = peso.toFixed(1);
            if (elEcuacion) elEcuacion.innerText = ecuacion;
            if (elBadge) elBadge.innerText = config.nombre;
            if (elNota) elNota.innerText = nota;
        };

        window.copiarCotizacionEnvio = function() {
            const total = document.getElementById('calc-costo-total')?.innerText || '0.00';
            const agencia = document.getElementById('calc-agencia-select')?.selectedOptions[0]?.text || '';
            const peso = document.getElementById('calc-peso-input')?.value || '1';
            const destino = document.getElementById('calc-destino-select')?.selectedOptions[0]?.text || '';

            const texto = `Cotización Logística F&B Parts:\n- Operador: ${agencia}\n- Destino: ${destino}\n- Peso Carga: ${peso} Kg\n- Costo Estimado: $${total} USD`;

            navigator.clipboard.writeText(texto).then(() => {
                const btnSpan = document.getElementById('btn-copiar-calc-text');
                if (btnSpan) {
                    const orig = btnSpan.innerText;
                    btnSpan.innerText = "¡Copiado al Portapapeles!";
                    setTimeout(() => { btnSpan.innerText = orig; }, 2000);
                }
            }).catch(() => alert("No se pudo copiar el texto."));
        };

        // =========================================================================
        // ✨ ASISTENTE INTELIGENTE: ANALIZAR PRECIO POR FOTO (IA) - F&B PARTS
        // =========================================================================
        window._precioFotoBlob = null;
        window._precioFotoBase64 = null;
        window._precioFotoTargetModulo = 'reventa'; // 'reventa' | 'pedido'
        window._precioFotoDataExtraida = null;
        window._precioFotoRespuestas = {
            calidad: 'OEM / Original',
            presentacion: 'Unidad',
            flete: 'Envío Incluido / Local ($0)',
            margen: '30% (Margen Estándar)'
        };

        window.abrirModalAnalizarPrecioFoto = function(targetModulo = 'reventa') {
            const modal = document.getElementById('modal-analizar-precio-foto');
            if (!modal) return;

            window._precioFotoTargetModulo = targetModulo || 'reventa';

            const btnTexto = document.getElementById('btn-aplicar-precio-texto');
            if (btnTexto) {
                btnTexto.textContent = targetModulo === 'pedido' ? 'Aplicar a Pedido Manual' : 'Aplicar a Nueva Reventa';
            }

            // Si aún no se han renderizado las preguntas, renderizar las default
            if (!document.getElementById('precio-foto-preguntas-container')?.children.length) {
                window.renderizarPreguntasDefaultPrecioFoto();
            }

            // Recalcular KPI en tiempo real
            window.recalcularPrecioSugeridoLive();

            modal.style.display = 'flex';
        };

        window.cerrarModalAnalizarPrecioFoto = function() {
            const modal = document.getElementById('modal-analizar-precio-foto');
            if (modal) modal.style.display = 'none';
        };

        window.manejarSeleccionArchivoPrecioFoto = function(event) {
            const file = event.target?.files?.[0];
            if (file) {
                window.procesarFotoPrecioBlob(file);
            }
        };

        window.procesarFotoPrecioBlob = function(fileOrBlob) {
            if (!fileOrBlob) return;
            if (fileOrBlob.type && !fileOrBlob.type.startsWith('image/')) {
                alert("Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                window._precioFotoBlob = fileOrBlob;
                window._precioFotoBase64 = e.target.result;

                const imgPreview = document.getElementById('precio-foto-img-preview');
                const previewBox = document.getElementById('precio-foto-preview-box');
                const fileInfo = document.getElementById('precio-foto-file-info');
                const btnAnalizar = document.getElementById('btn-analizar-precio-foto');

                if (imgPreview) imgPreview.src = e.target.result;
                if (previewBox) previewBox.style.display = 'block';
                if (fileInfo) {
                    const sizeKb = (fileOrBlob.size / 1024).toFixed(1);
                    fileInfo.textContent = `${fileOrBlob.name || 'Captura pegada'} (${sizeKb} KB)`;
                }
                if (btnAnalizar) {
                    btnAnalizar.disabled = false;
                    btnAnalizar.innerHTML = '<i class="fas fa-magic"></i> ✨ Analizar Precio con IA';
                }

                // Ocultar alerta de estado previa
                const alertEl = document.getElementById('precio-foto-status-alert');
                if (alertEl) alertEl.style.display = 'none';
            };
            reader.readAsDataURL(fileOrBlob);
        };

        window.limpiarFotoPrecioIA = function() {
            window._precioFotoBlob = null;
            window._precioFotoBase64 = null;
            window._precioFotoDataExtraida = null;

            const input = document.getElementById('precio-foto-file-input');
            if (input) input.value = '';

            const previewBox = document.getElementById('precio-foto-preview-box');
            if (previewBox) previewBox.style.display = 'none';

            const imgPreview = document.getElementById('precio-foto-img-preview');
            if (imgPreview) imgPreview.src = '';

            const btnAnalizar = document.getElementById('btn-analizar-precio-foto');
            if (btnAnalizar) {
                btnAnalizar.disabled = true;
                btnAnalizar.innerHTML = '<i class="fas fa-magic"></i> ✨ Analizar Precio con IA';
            }

            const alertEl = document.getElementById('precio-foto-status-alert');
            if (alertEl) alertEl.style.display = 'none';
        };

        window.parsearJSONRespuestaPrecioFoto = function(rawResp) {
            if (!rawResp) return null;
            let rawStr = '';
            if (typeof rawResp === 'string') rawStr = rawResp;
            else if (rawResp?.message?.content) {
                const c = rawResp.message.content;
                rawStr = Array.isArray(c) ? c.map(b => b.text || b).join('') : String(c);
            } else if (rawResp?.text) {
                rawStr = String(rawResp.text);
            }

            const jsonMatch = rawStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("[Precio Foto IA] Error parseando JSON:", e);
                return null;
            }
        };

        window.renderizarPreguntasDefaultPrecioFoto = function() {
            const defaults = [
                {
                    id: "calidad",
                    pregunta: "¿Cuál es la calidad u origen del repuesto?",
                    opciones: ["OEM / Original", "Reemplazo Calidad A", "Genérico Estándar"],
                    seleccionada: window._precioFotoRespuestas.calidad || "OEM / Original"
                },
                {
                    id: "presentacion",
                    pregunta: "¿El precio mostrado es por unidad o por par/kit?",
                    opciones: ["Unidad", "Par (x2)", "Juego / Kit"],
                    seleccionada: window._precioFotoRespuestas.presentacion || "Unidad"
                },
                {
                    id: "flete",
                    pregunta: "¿El costo incluye flete del proveedor o requiere gastos adicionales?",
                    opciones: ["Envío Incluido / Local ($0)", "Flete Nacional (+ $5.00)", "Flete Carga Pesada (+ $12.00)"],
                    seleccionada: window._precioFotoRespuestas.flete || "Envío Incluido / Local ($0)"
                },
                {
                    id: "margen",
                    pregunta: "¿Qué margen comercial deseas aplicar?",
                    opciones: ["20% (Rotación Rápida)", "30% (Margen Estándar)", "40% (Exclusivo / Difícil)", "50% (Alta Ganancia)"],
                    seleccionada: window._precioFotoRespuestas.margen || "30% (Margen Estándar)"
                }
            ];
            window.renderizarPreguntasPrecioFoto(defaults);
        };

        window.renderizarPreguntasPrecioFoto = function(preguntas) {
            const container = document.getElementById('precio-foto-preguntas-container');
            if (!container) return;

            container.innerHTML = '';
            if (!Array.isArray(preguntas) || preguntas.length === 0) {
                window.renderizarPreguntasDefaultPrecioFoto();
                return;
            }

            preguntas.forEach(p => {
                if (p.seleccionada && !window._precioFotoRespuestas[p.id]) {
                    window._precioFotoRespuestas[p.id] = p.seleccionada;
                }
                const valorActual = window._precioFotoRespuestas[p.id] || p.seleccionada || (p.opciones && p.opciones[0]);

                const block = document.createElement('div');
                block.style.display = 'flex';
                block.style.flexDirection = 'column';
                block.style.gap = '5px';

                const label = document.createElement('label');
                label.style.fontSize = '11.5px';
                label.style.fontWeight = '700';
                label.style.color = '#374151';
                label.textContent = p.pregunta;
                block.appendChild(label);

                const pillsRow = document.createElement('div');
                pillsRow.style.display = 'flex';
                pillsRow.style.flexWrap = 'wrap';
                pillsRow.style.gap = '6px';

                (p.opciones || []).forEach(opc => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = opc;
                    const esActivo = (valorActual === opc);

                    btn.style.padding = '4px 10px';
                    btn.style.borderRadius = '16px';
                    btn.style.fontSize = '11px';
                    btn.style.cursor = 'pointer';
                    btn.style.transition = 'all 0.15s ease';
                    btn.style.border = esActivo ? '1.5px solid #385723' : '1px solid #cbd5e1';
                    btn.style.background = esActivo ? '#385723' : '#ffffff';
                    btn.style.color = esActivo ? '#ffffff' : '#374151';
                    btn.style.fontWeight = esActivo ? '700' : '500';
                    btn.style.boxShadow = esActivo ? '0 2px 5px rgba(56, 87, 35, 0.25)' : 'none';

                    btn.onclick = function() {
                        window.seleccionarOpcionPreguntaPrecio(p.id, opc);
                    };

                    pillsRow.appendChild(btn);
                });

                block.appendChild(pillsRow);
                container.appendChild(block);
            });
        };

        window.seleccionarOpcionPreguntaPrecio = function(preguntaId, opcion) {
            window._precioFotoRespuestas[preguntaId] = opcion;

            // Acciones secundarias automáticas según la opción
            if (preguntaId === 'margen') {
                const matchPct = opcion.match(/(\d+)\s*%/);
                if (matchPct) {
                    const inputMargen = document.getElementById('precio-foto-input-margen');
                    if (inputMargen) inputMargen.value = matchPct[1];
                }
            } else if (preguntaId === 'flete') {
                const inputGastos = document.getElementById('precio-foto-input-gastos');
                if (inputGastos) {
                    if (opcion.includes('$5.00') || opcion.includes('$5')) {
                        inputGastos.value = "5.00";
                    } else if (opcion.includes('$12.00') || opcion.includes('$12')) {
                        inputGastos.value = "12.00";
                    } else if (opcion.includes('$0') || opcion.toLowerCase().includes('incluido')) {
                        inputGastos.value = "0.00";
                    }
                }
            }

            // Re-renderizar para actualizar el estado visual de los botones
            if (window._precioFotoDataExtraida?.preguntas_aclaracion) {
                window.renderizarPreguntasPrecioFoto(window._precioFotoDataExtraida.preguntas_aclaracion);
            } else {
                window.renderizarPreguntasDefaultPrecioFoto();
            }

            // Recalcular en vivo
            window.recalcularPrecioSugeridoLive();
        };

        window.analizarFotoPrecioConIA = async function() {
            if (!window._precioFotoBase64) {
                alert("Por favor selecciona o pega una foto primero.");
                return;
            }

            const btnAnalizar = document.getElementById('btn-analizar-precio-foto');
            const alertEl = document.getElementById('precio-foto-status-alert');

            if (btnAnalizar) {
                btnAnalizar.disabled = true;
                btnAnalizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando con IA...';
            }

            if (alertEl) {
                alertEl.style.display = 'block';
                alertEl.style.background = '#eff6ff';
                alertEl.style.border = '1px solid #bfdbfe';
                alertEl.style.color = '#1d4ed8';
                alertEl.innerHTML = '<i class="fas fa-robot"></i> <b>Analizando captura:</b> Detectando pieza, precio de referencia, gastos estimados y formulando preguntas clave...';
            }

            const promptIA = `Eres un especialista en repuestos automotrices y fijación de precios (pricing) para "Inversiones FB Parts, C.A." en Caracas, Venezuela.
Analiza minuciosamente esta captura de pantalla o foto de una cotización, lista de precios, publicación de MercadoLibre o WhatsApp de mayorista.

Extrae los datos y responde ÚNICAMENTE con un objeto JSON estricto (sin explicaciones ni formato markdown):
{
  "repuesto_detectado": "NOMBRE_COMPLETO_DEL_REPUESTO_MARCA_MODELO_O_VACIO",
  "precio_referencia": NUMERO_FLOAT_O_NULL,
  "moneda_referencia": "USD" | "VES" | "EUR",
  "calidad_sugerida": "OEM / Original" | "Reemplazo Calidad A" | "Genérico Estándar",
  "presentacion_sugerida": "Unidad" | "Par (x2)" | "Juego / Kit",
  "gastos_estimados_usd": NUMERO_FLOAT,
  "margen_sugerido_pct": 30,
  "justificacion": "DESCRIPCION_BREVE_DE_LA_ESTIMACION_EN_UNA_O_DOS_LINEAS",
  "preguntas_aclaracion": [
    {
      "id": "calidad",
      "pregunta": "¿Cuál es la calidad u origen del repuesto?",
      "opciones": ["OEM / Original", "Reemplazo Calidad A", "Genérico Estándar"],
      "seleccionada": "OEM / Original"
    },
    {
      "id": "presentacion",
      "pregunta": "¿El precio mostrado es por unidad o por par/kit?",
      "opciones": ["Unidad", "Par (x2)", "Juego / Kit"],
      "seleccionada": "Unidad"
    },
    {
      "id": "flete",
      "pregunta": "¿El costo incluye flete del proveedor o requiere gastos adicionales?",
      "opciones": ["Envío Incluido / Local ($0)", "Flete Nacional (+ $5.00)", "Flete Carga Pesada (+ $12.00)"],
      "seleccionada": "Envío Incluido / Local ($0)"
    },
    {
      "id": "margen",
      "pregunta": "¿Qué margen comercial deseas aplicar?",
      "opciones": ["20% (Rotación Rápida)", "30% (Margen Estándar)", "40% (Exclusivo / Difícil)", "50% (Alta Ganancia)"],
      "seleccionada": "30% (Margen Estándar)"
    }
  ]
}

REGLAS CRÍTICAS:
1. "precio_referencia": Extrae el valor numérico (ej: "$85.00" -> 85; "Bs. 3500" -> 3500; "45$" -> 45). Si no hay precio explícito o no se distingue, pon null.
2. "moneda_referencia": "USD" si usa $, USD o divisa; "VES" si dice Bs, Bs. o bolívares; "EUR" si dice € o euros.
3. Si el repuesto es original de fábrica, selecciona "OEM / Original". Si es una marca de reemplazo reconocida (ej. CTR, Denso, Valeo, Monroe), "Reemplazo Calidad A".`;

            let dataExtraida = null;
            let errorMsg = null;

            try {
                if (typeof puter !== 'undefined' && puter.ai) {
                    try {
                        const resp = await puter.ai.chat(promptIA, window._precioFotoBase64, { model: 'gemini-2.0-flash' });
                        dataExtraida = window.parsearJSONRespuestaPrecioFoto(resp);
                    } catch (ePuterModel) {
                        try {
                            const resp = await puter.ai.chat(promptIA, window._precioFotoBase64);
                            dataExtraida = window.parsearJSONRespuestaPrecioFoto(resp);
                        } catch (ePuterDef) {
                            console.warn("[Precio Foto IA] Puter no respondió, intentando Gemini directo...", ePuterDef);
                        }
                    }
                }

                if (!dataExtraida) {
                    const geminiKey = window.obtenerApiKeyGemini ? window.obtenerApiKeyGemini(false) : '';
                    if (geminiKey) {
                        const base64Data = window._precioFotoBase64.split(',')[1];
                        const mimeType = window._precioFotoBase64.substring(
                            window._precioFotoBase64.indexOf(':') + 1, 
                            window._precioFotoBase64.indexOf(';')
                        ) || 'image/jpeg';

                        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
                        const gResp = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: promptIA },
                                        { inline_data: { mime_type: mimeType, data: base64Data } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                            })
                        });

                        if (gResp.ok) {
                            const gData = await gResp.json();
                            const rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            dataExtraida = window.parsearJSONRespuestaPrecioFoto(rawText);
                        }
                    }
                }
            } catch (err) {
                console.error("[Precio Foto IA] Error durante el análisis:", err);
                errorMsg = err.message || String(err);
            }

            if (btnAnalizar) {
                btnAnalizar.disabled = false;
                btnAnalizar.innerHTML = '<i class="fas fa-magic"></i> ✨ Analizar Precio con IA';
            }

            if (dataExtraida) {
                window._precioFotoDataExtraida = dataExtraida;

                // Cargar valores en los inputs
                const elRepuesto = document.getElementById('precio-foto-input-repuesto');
                const elCosto = document.getElementById('precio-foto-input-costo');
                const elMoneda = document.getElementById('precio-foto-select-moneda');
                const elGastos = document.getElementById('precio-foto-input-gastos');
                const elMargen = document.getElementById('precio-foto-input-margen');

                if (elRepuesto && dataExtraida.repuesto_detectado) elRepuesto.value = dataExtraida.repuesto_detectado;
                if (elCosto && dataExtraida.precio_referencia !== null && dataExtraida.precio_referencia !== undefined) {
                    elCosto.value = Number(dataExtraida.precio_referencia).toFixed(2);
                }
                if (elMoneda && dataExtraida.moneda_referencia) {
                    elMoneda.value = ['USD', 'VES', 'EUR'].includes(dataExtraida.moneda_referencia) ? dataExtraida.moneda_referencia : 'USD';
                }
                if (elGastos && dataExtraida.gastos_estimados_usd !== undefined) {
                    elGastos.value = Number(dataExtraida.gastos_estimados_usd || 0).toFixed(2);
                }
                if (elMargen && dataExtraida.margen_sugerido_pct) {
                    elMargen.value = dataExtraida.margen_sugerido_pct;
                }

                // Mostrar justificación si existe
                const boxJust = document.getElementById('precio-foto-justificacion-box');
                const txtJust = document.getElementById('precio-foto-justificacion-texto');
                if (boxJust && txtJust && dataExtraida.justificacion) {
                    txtJust.textContent = dataExtraida.justificacion;
                    boxJust.style.display = 'block';
                }

                // Renderizar preguntas y opciones dinámicas
                if (Array.isArray(dataExtraida.preguntas_aclaracion) && dataExtraida.preguntas_aclaracion.length > 0) {
                    window.renderizarPreguntasPrecioFoto(dataExtraida.preguntas_aclaracion);
                } else {
                    window.renderizarPreguntasDefaultPrecioFoto();
                }

                // Recalcular en tiempo real
                window.recalcularPrecioSugeridoLive();

                if (alertEl) {
                    alertEl.style.display = 'block';
                    alertEl.style.background = '#f0fdf4';
                    alertEl.style.border = '1px solid #bbf7d0';
                    alertEl.style.color = '#166534';
                    alertEl.innerHTML = `<i class="fas fa-check-circle"></i> <b>¡Análisis Exitoso!</b> Repuesto identificado: <b>${dataExtraida.repuesto_detectado || 'Detectado'}</b>. Revisa las variantes clave y confirma el precio sugerido.`;
                }
            } else {
                // Fallback sin trabar la interfaz
                window.renderizarPreguntasDefaultPrecioFoto();
                window.recalcularPrecioSugeridoLive();

                if (alertEl) {
                    alertEl.style.display = 'block';
                    alertEl.style.background = '#fffbeb';
                    alertEl.style.border = '1px solid #fde68a';
                    alertEl.style.color = '#b45309';
                    alertEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <b>No se detectó un precio automático</b> ${errorMsg ? `(${errorMsg})` : ''}. Por favor ingresa el costo base y la descripción manualmente en el panel de la derecha.`;
                }
            }
        };

        window.recalcularPrecioSugeridoLive = function() {
            const inputCosto = document.getElementById('precio-foto-input-costo');
            const selectMoneda = document.getElementById('precio-foto-select-moneda');
            const inputGastos = document.getElementById('precio-foto-input-gastos');
            const inputMargen = document.getElementById('precio-foto-input-margen');

            const costoBase = parseFloat(inputCosto?.value) || 0;
            const moneda = selectMoneda?.value || 'USD';
            const gastos = parseFloat(inputGastos?.value) || 0;
            const margenPct = Math.min(Math.max(parseFloat(inputMargen?.value) || 0, 0), 95);

            // Obtener tasas oficiales
            const tasaVES = window.obtenerTasaBCVActual() || window.tasaReventaBCV || 42.00;
            const tasaEUR = window.tasaReventaEUR || 1.08;

            // Normalizar a USD
            let costoBaseUSD = costoBase;
            if (moneda === 'VES') {
                costoBaseUSD = tasaVES > 0 ? (costoBase / tasaVES) : costoBase;
            } else if (moneda === 'EUR') {
                costoBaseUSD = tasaEUR < 10 ? (costoBase * tasaEUR) : (costoBase * 1.08);
            }

            // Multiplicador de presentación si aplica
            let multiplicador = 1;
            const pres = window._precioFotoRespuestas['presentacion'] || '';
            // Si el costo es por unidad pero se busca par/kit
            if (pres.toLowerCase().includes('par (x2)') && window._precioFotoDataExtraida?.presentacion_detectada === 'Unidad') {
                multiplicador = 2;
            }

            const costoTotalUSD = (costoBaseUSD * multiplicador) + gastos;

            // Precio Sugerido de Venta en USD según fórmula de margen comercial
            let precioVentaUSD = 0;
            if (margenPct >= 100) {
                precioVentaUSD = costoTotalUSD * (1 + (margenPct / 100));
            } else if (margenPct > 0) {
                precioVentaUSD = costoTotalUSD / (1 - (margenPct / 100));
            } else {
                precioVentaUSD = costoTotalUSD;
            }

            const precioVentaVES = precioVentaUSD * tasaVES;
            const gananciaUSD = precioVentaUSD - costoTotalUSD;

            // Actualizar tarjetas KPI
            const kpiUsd = document.getElementById('precio-foto-kpi-usd');
            const kpiBs = document.getElementById('precio-foto-kpi-bs');
            const kpiCostoTotal = document.getElementById('precio-foto-kpi-costo-total');
            const kpiGanancia = document.getElementById('precio-foto-kpi-ganancia');

            if (kpiUsd) kpiUsd.textContent = `$${precioVentaUSD.toFixed(2)} USD`;
            if (kpiBs) {
                kpiBs.textContent = `Bs. ${precioVentaVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: ${tasaVES.toFixed(2)})`;
            }
            if (kpiCostoTotal) kpiCostoTotal.textContent = `$${costoTotalUSD.toFixed(2)} USD`;
            if (kpiGanancia) {
                kpiGanancia.textContent = `$${gananciaUSD.toFixed(2)} USD (${margenPct.toFixed(0)}%)`;
            }

            return {
                costoBaseUSD,
                multiplicador,
                gastos,
                costoTotalUSD,
                margenPct,
                precioVentaUSD,
                precioVentaVES,
                gananciaUSD,
                tasaVES
            };
        };

        window.aplicarPrecioSugeridoIA = function() {
            const calc = window.recalcularPrecioSugeridoLive();
            const repuesto = (document.getElementById('precio-foto-input-repuesto')?.value || '').trim();

            if (calc.precioVentaUSD <= 0) {
                alert("Por favor ingresa un costo base o analiza una foto con precio antes de aplicar el precio sugerido.");
                return;
            }

            const targetModulo = window._precioFotoTargetModulo || 'reventa';

            if (targetModulo === 'reventa') {
                // Activar pestaña de reventas si no está activa
                const tabReventas = document.getElementById('tab-reventas');
                if (tabReventas) {
                    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    tabReventas.classList.add('active');
                    document.querySelectorAll('.tab-btn').forEach(tb => tb.classList.remove('active'));
                    const btnTab = document.querySelector('button[onclick*="reventas"]') || document.querySelector('[data-tab="tab-reventas"]');
                    if (btnTab) btnTab.classList.add('active');
                }

                // Llenar campos de Reventa
                const elDesc = document.getElementById('rev-desc');
                const elCosto = document.getElementById('rev-costo');
                const elGastos = document.getElementById('rev-gastos');
                const elVenta = document.getElementById('rev-venta');

                if (elDesc && repuesto) elDesc.value = repuesto;

                // Asegurar moneda USD en reventas
                if (window.setMonedaReventa) {
                    window.setMonedaReventa('rev-costo', 'USD');
                    window.setMonedaReventa('rev-gastos', 'USD');
                    window.setMonedaReventa('rev-venta', 'USD');
                }

                if (elCosto) {
                    elCosto.value = (calc.costoBaseUSD * calc.multiplicador).toFixed(2);
                    if (window.manejarInputReventa) window.manejarInputReventa('rev-costo');
                }
                if (elGastos) {
                    elGastos.value = calc.gastos.toFixed(2);
                    if (window.manejarInputReventa) window.manejarInputReventa('rev-gastos');
                }
                if (elVenta) {
                    elVenta.value = calc.precioVentaUSD.toFixed(2);
                    if (window.manejarInputReventa) window.manejarInputReventa('rev-venta');
                }

                // Recalcular reventas
                if (window.calcularReventa) window.calcularReventa();

                window.cerrarModalAnalizarPrecioFoto();

                // Scroll al formulario y foco
                if (elDesc) {
                    elDesc.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    elDesc.focus();
                }

                alert(`✨ ¡Precio sugerido aplicado con éxito a Reventas!\n\nRepuesto: ${repuesto || 'Repuesto'}\nCosto Total: $${calc.costoTotalUSD.toFixed(2)} USD\nPrecio Venta Sugerido: $${calc.precioVentaUSD.toFixed(2)} USD (Margen ${calc.margenPct}%)`);

            } else if (targetModulo === 'pedido') {
                // Activar pestaña de pedidos si no está activa
                const tabPedidos = document.getElementById('tab-pedidos');
                if (tabPedidos) {
                    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    tabPedidos.classList.add('active');
                    document.querySelectorAll('.tab-btn').forEach(tb => tb.classList.remove('active'));
                    const btnTab = document.querySelector('button[onclick*="pedidos"]') || document.querySelector('[data-tab="tab-pedidos"]');
                    if (btnTab) btnTab.classList.add('active');
                }

                const container = document.getElementById('pedidos-items-container');
                let targetRow = null;

                if (container) {
                    const rows = container.querySelectorAll('.pedido-item-row');
                    for (const r of rows) {
                        const desc = r.querySelector('.ped-item-desc');
                        const prec = r.querySelector('.ped-item-precio');
                        if (desc && !desc.value.trim() && (!prec || parseFloat(prec.value) === 0)) {
                            targetRow = r;
                            break;
                        }
                    }
                }

                if (!targetRow && window.agregarFilaPedidoVacia) {
                    window.agregarFilaPedidoVacia();
                    const rows = container ? container.querySelectorAll('.pedido-item-row') : [];
                    targetRow = rows[rows.length - 1];
                }

                if (targetRow) {
                    const descInput = targetRow.querySelector('.ped-item-desc');
                    const precInput = targetRow.querySelector('.ped-item-precio');

                    if (descInput) descInput.value = repuesto || 'Repuesto analizado';
                    if (precInput) precInput.value = calc.precioVentaUSD.toFixed(2);

                    if (window.calcularTotalPedido) window.calcularTotalPedido();
                }

                window.cerrarModalAnalizarPrecioFoto();

                alert(`✨ ¡Repuesto agregado al pedido manual!\n\nDescripción: ${repuesto || 'Repuesto'}\nPrecio sugerido: $${calc.precioVentaUSD.toFixed(2)} USD`);
            }
        };

        // Soporte global de Ctrl+V / Paste para la ventana modal de Analizar Precio por Foto
        window.addEventListener('paste', function(e) {
            const modal = document.getElementById('modal-analizar-precio-foto');
            if (!modal || modal.style.display === 'none') return;

            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        e.preventDefault();
                        window.procesarFotoPrecioBlob(blob);
                        break;
                    }
                }
            }
        });

        // Configuración de Drag & Drop para la Dropzone de Precio por Foto
        document.addEventListener('DOMContentLoaded', () => {
            const dropzone = document.getElementById('precio-foto-dropzone');
            if (!dropzone) return;

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.style.borderColor = '#385723';
                    dropzone.style.background = '#dcfce7';
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.style.borderColor = '#5e8877';
                    dropzone.style.background = '#eef3f0';
                }, false);
            });

            dropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt?.files;
                if (files && files[0]) {
                    window.procesarFotoPrecioBlob(files[0]);
                }
            }, false);
        });

        // Inicialización reactiva
        setTimeout(() => {
            if (window.recomputarCRMTransaccional) window.recomputarCRMTransaccional();
            if (window.renderizarTablaTarifasBase) window.renderizarTablaTarifasBase();
            if (window.ejecutarCalculoLandedCost) window.ejecutarCalculoLandedCost();
        }, 300);


window.moduleLoaded = true;
console.log('Modulo admin_logic cargado exitosamente.');
