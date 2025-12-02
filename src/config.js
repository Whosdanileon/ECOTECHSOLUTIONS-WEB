export const CONFIG = {
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    VISION_URL_KEY: 'ecotech_ngrok_url',
    
    // Helper para extraer ID del proyecto dinámicamente
    get PROJECT_REF() {
        try {
            return this.SUPABASE_URL.split('//')[1].split('.')[0];
        } catch (e) {
            return 'dtdtqedzfuxfnnipdorg'; // Fallback
        }
    },

    // Configuración del Producto Único (Lemna Minor)
    PRODUCT: {
        ID: 1,
        NAME: 'Lemna Minor Premium',
        PRICE: 750.00,
        CURRENCY: 'MXN'
    },

    ROLES: {
        SYS: ['Sistemas'],
        ADMIN: ['Sistemas', 'Lider'],
        STAFF: ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador'],
        CLIENT: ['Cliente']
    }
};