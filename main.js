/* --- FASE 4: CONEXIÓN Y CARGA DE DATOS --- */

// 1. Configuración del Cliente Supabase
// Pega tu URL y tu Anon Key (pública) aquí
const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

// 2. Crear el cliente
// Usamos "supabase.createClient" que está disponible gracias al script CDN
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Cliente de Supabase conectado.');

// 3. Función para cargar el producto
// "async" le dice a JS que esta función tendrá "await" (esperas)
async function cargarProducto() {
    console.log("Intentando cargar producto...");
    
    // "await" pausa la ejecución HASTA que Supabase responda
    const { data, error } = await db
        .from('productos') // De la tabla 'productos'
        .select('*')       // Selecciona todas las columnas
        .eq('id', 1);      // Donde el ID sea 1 (o el ID de tu producto)
        // Nota: Como es un solo producto, también podrías usar .limit(1)

    if (error) {
        console.error('Error al cargar el producto:', error.message);
        return;
    }

    if (data && data.length > 0) {
        const producto = data[0]; // Como es un solo producto, tomamos el primero
        console.log('Producto cargado:', producto);

        // Ahora, vamos a MOSTRAR los datos en el HTML
        // Buscamos los elementos por su ID en la página
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');

        // Verificamos si los elementos existen en ESTA página
        if (nombreProductoEl) {
            nombreProductoEl.textContent = producto.nombre;
        }
        if (precioProductoEl) {
            // Usamos .toLocaleString para formatear el número como moneda
            precioProductoEl.textContent = `$${producto.precio.toLocaleString('es-MX')} MXN`;
        }
        if (stockProductoEl) {
            stockProductoEl.textContent = `${producto.stock_disponible} disponibles`;
        }
        
    } else {
        console.log("No se encontró el producto.");
    }
}

// 4. Ejecutar la función
// Nos aseguramos de que el HTML esté cargado antes de ejecutar JS
document.addEventListener('DOMContentLoaded', () => {
    // Verificamos en qué página estamos para no cargar el producto en todas
    // 'window.location.pathname' nos da la ruta del archivo
    if (window.location.pathname.endsWith('tienda.html') || window.location.pathname.endsWith('index.html')) {
        cargarProducto();
    }
});