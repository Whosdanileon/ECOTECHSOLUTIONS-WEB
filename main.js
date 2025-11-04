/* --- FASE 4: CONEXIÓN Y CARGA DE DATOS --- */

// 1. Configuración del Cliente Supabase
// Pega tu URL y tu Anon Key (pública) aquí
const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

// 2. Crear el cliente
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Cliente de Supabase conectado.');

// 3. Función para cargar el producto
async function cargarProducto() {
    console.log("Intentando cargar producto...");
    
    // Asumimos que el ID de tu único producto es 1.
    // Cambia el '1' si es diferente en tu tabla de Supabase.
    const PRODUCTO_ID = 1; 

    const { data, error } = await db
        .from('productos')
        .select('*')
        .eq('id', PRODUCTO_ID) 
        .single(); // .single() es mejor si solo esperas 1 resultado

    if (error) {
        console.error('Error al cargar el producto:', error.message);
        return;
    }

    if (data) {
        const producto = data; // 'data' ya es el objeto único gracias a .single()
        console.log('Producto cargado:', producto);

        // --- Actualizar la PÁGINA DE TIENDA (`tienda.html`) ---
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');

        if (nombreProductoEl) {
            nombreProductoEl.textContent = producto.nombre;
        }
        if (precioProductoEl) {
            precioProductoEl.textContent = `$${producto.precio.toLocaleString('es-MX')} MXN`;
        }
        if (stockProductoEl) {
            stockProductoEl.textContent = `${producto.stock_disponible} disponibles`;
        }
        
        // --- Actualizar la PÁGINA DE INICIO (`index.html`) ---
        const nombreIndexEl = document.getElementById('index-producto-nombre');
        const precioIndexEl = document.getElementById('index-producto-precio');

        if(nombreIndexEl) {
            nombreIndexEl.textContent = producto.nombre;
        }
        if(precioIndexEl) {
            precioIndexEl.innerHTML = `$${producto.precio.toLocaleString('es-MX')} MXN <small>Bolsa 1kg</small>`;
        }
        
    } else {
        console.log("No se encontró el producto.");
    }
}

// 4. Ejecutar la función
document.addEventListener('DOMContentLoaded', () => {
    // Definimos en qué páginas queremos que se ejecute la carga
    const path = window.location.pathname;
    
    // Usamos .includes() para que funcione bien en GitHub Pages
    if (path.includes('tienda.html') || path.includes('index.html') || path === '/' || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }
});