// src/db.js
import { CONFIG } from './config.js';

// Verificación de seguridad crítica
if (typeof supabase === 'undefined') {
    const errorMsg = 'Error Crítico: La librería de conexión no se pudo cargar. Por favor verifique su conexión a internet o desactive bloqueadores de anuncios.';
    console.error(errorMsg);
    alert(errorMsg); // Alerta visible al usuario
    throw new Error(errorMsg); // Detener ejecución de JS
}

// Inicialización del cliente
export const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

console.log('✅ EcoTech DB: Conexión establecida');