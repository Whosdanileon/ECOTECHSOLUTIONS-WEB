import { CONFIG } from './config.js';

// Verificación de seguridad: Aseguramos que la librería de Supabase esté cargada
if (typeof supabase === 'undefined') {
    console.error('CRITICAL: Supabase client library not loaded from CDN.');
}

// Inicialización del cliente
export const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

console.log('✅ EcoTech Database Connection: Initialized');