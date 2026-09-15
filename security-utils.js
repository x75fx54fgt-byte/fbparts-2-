/**
 * ==============================================================================
 * F&B PARTS - MÓDULO DE SEGURIDAD, SANITIZACIÓN Y VALIDACIÓN CONTRA INYECCIONES
 * ==============================================================================
 * Provee filtros defensivos contra:
 * 1. Stored XSS y DOM Injection (escapando caracteres HTML especiales).
 * 2. Inyección de cargas maliciosas en direcciones, notas internas y teléfonos.
 * 3. Manipulación de montos financieros (valores negativos, NaN, Infinity o no numéricos).
 * ==============================================================================
 */

export const SecuritySanitizer = {
    /**
     * Escapa entidades HTML sensibles para prevenir XSS al renderizar texto dinámico en el DOM.
     * @param {any} val - Valor a escapar
     * @returns {string} - Texto seguro con entidades escapadas
     */
    escapeHtml(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Limpia y sanea cadenas de texto de campos generales (nombres, conceptos, categorías).
     * Remueve etiquetas HTML y caracteres de control invisibles, y limita la longitud.
     * @param {any} val - Texto de entrada
     * @param {number} maxLen - Longitud máxima permitida
     * @returns {string} - Texto limpio y saneado
     */
    cleanText(val, maxLen = 250) {
        if (!val) return '';
        const cleaned = String(val)
            .replace(/<[^>]*>?/gm, '') // Remueve etiquetas HTML completas
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Caracteres de control ASCII
            .trim();
        return cleaned.slice(0, maxLen);
    },

    /**
     * Sanea direcciones de entrega física o enlaces GPS de mapas.
     * Desactiva esquemas peligrosos como javascript:, data:, vbscript:
     * @param {any} val - Dirección ingresada
     * @param {number} maxLen - Longitud máxima
     * @returns {string} - Dirección validada
     */
    cleanAddress(val, maxLen = 300) {
        if (!val) return '';
        let cleaned = String(val)
            .replace(/<[^>]*>?/gm, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();
        return cleaned.slice(0, maxLen);
    },

    /**
     * Sanea notas internas, observaciones de pedidos y especificaciones de ruta.
     * @param {any} val - Nota a guardar
     * @param {number} maxLen - Longitud máxima
     * @returns {string} - Nota libre de etiquetas HTML y scripts
     */
    cleanNote(val, maxLen = 600) {
        if (!val) return '';
        let cleaned = String(val)
            .replace(/<[^>]*>?/gm, '')
            .replace(/javascript:/gi, '')
            .trim();
        return cleaned.slice(0, maxLen);
    },

    /**
     * Sanea números de teléfono permitiendo únicamente caracteres válidos (+, -, números, espacios, paréntesis).
     * @param {any} val - Teléfono
     * @returns {string} - Teléfono saneado
     */
    cleanPhone(val) {
        if (!val) return '';
        return String(val).replace(/[^0-9+() -]/g, '').trim().slice(0, 30);
    },

    /**
     * Valida y sanea montos de dinero (precios, totales, tarifas de motorizados, deudas).
     * Garantiza que el número sea finito, no negativo y redondeado a 2 decimales.
     * @param {any} val - Monto a validar
     * @param {number} min - Valor mínimo permitido (defecto 0)
     * @param {number} max - Valor máximo permitido (defecto 5,000,000)
     * @returns {number} - Flotante seguro
     */
    sanitizeAmount(val, min = 0, max = 5000000) {
        if (typeof val === 'number') {
            if (isNaN(val) || !isFinite(val)) return min;
            if (val < min) return min;
            if (val > max) return max;
            return Math.round(val * 100) / 100;
        }
        const cleanedStr = String(val || '0').replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleanedStr);
        if (isNaN(num) || !isFinite(num) || num < min) return min;
        if (num > max) return max;
        return Math.round(num * 100) / 100;
    },

    /**
     * Valida cantidades enteras de inventario y stock.
     * @param {any} val - Cantidad
     * @param {number} min - Mínimo permitido
     * @param {number} max - Máximo permitido
     * @returns {number} - Entero seguro
     */
    sanitizeInt(val, min = 0, max = 500000) {
        const num = parseInt(val, 10);
        if (isNaN(num) || !isFinite(num) || num < min) return min;
        if (num > max) return max;
        return num;
    }
};

// Exponer también en window para scripts tradicionales
if (typeof window !== 'undefined') {
    window.SecuritySanitizer = SecuritySanitizer;
}
