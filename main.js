/* --- FASE 4: CONEXIÓN Y CARGA DE DATOS --- */

// 1. Configuración del Cliente Supabase
// Pega tu URL y tu Anon Key (pública) aquí
const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

// 2. Crear el cliente
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Cliente de Supabase conectado.');


// --- LÓGICA DE CARGAR PRODUCTOS (FASE 4) ---
async function cargarProducto() {
    console.log("Intentando cargar producto...");
    const PRODUCTO_ID = 1; // Asumimos ID 1

    const { data, error } = await db
        .from('productos')
        .select('*')
        .eq('id', PRODUCTO_ID) 
        .single();

    if (error) {
        console.error('Error al cargar el producto:', error.message);
        return;
    }

    if (data) {
        const producto = data;
        console.log('Producto cargado:', producto);

        // Actualizar la PÁGINA DE TIENDA (`tienda.html`)
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');

        if (nombreProductoEl) nombreProductoEl.textContent = producto.nombre;
        if (precioProductoEl) precioProductoEl.textContent = `$${producto.precio.toLocaleString('es-MX')} MXN`;
        if (stockProductoEl) stockProductoEl.textContent = `${producto.stock_disponible}`;

        // Actualizar la PÁGINA DE INICIO (`index.html`)
        const nombreIndexEl = document.getElementById('index-producto-nombre');
        const precioIndexEl = document.getElementById('index-producto-precio');

        if(nombreIndexEl) nombreIndexEl.textContent = producto.nombre;
        if(precioIndexEl) precioIndexEl.innerHTML = `$${producto.precio.toLocaleString('es-MX')} MXN <small>Bolsa 1kg</small>`;
    }
}


// --- LÓGICA DE AUTENTICACIÓN (FASE 5) ---

// Función para manejar el REGISTRO
async function manejarRegistro(e) {
    e.preventDefault(); // Evita que la página se recargue
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;

    const { data, error } = await db.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        console.error('Error en el registro:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Usuario registrado:', data.user);
        alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
        // Opcional: limpiar formularios o redirigir
    }
}

// Función para manejar el INICIO DE SESIÓN
async function manejarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Error en el inicio de sesión:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión exitoso:', data.user);
        // Redirigir al inicio o a la página de cuenta
        window.location.href = 'cuenta.html';
    }
}

// Función para manejar el CIERRE DE SESIÓN
async function manejarLogout() {
    const { error } = await db.auth.signOut();
    
    if (error) {
        console.error('Error al cerrar sesión:', error.message);
    } else {
        console.log('Sesión cerrada.');
        // Recargar la página para mostrar los formularios de login
        window.location.reload();
    }
}

// Función para actualizar la UI (botones, formularios) según el estado de la sesión
function actualizarUI(session) {
    const authForms = document.getElementById('auth-forms');
    const userInfo = document.getElementById('user-info');
    const userEmailEl = document.getElementById('user-email');
    const btnLogout = document.getElementById('btn-logout');
    
    const botonesAuthHeader = document.querySelector('.botones-auth');

    if (session) {
        // --- Usuario LOGUEADO ---
        console.log("Usuario está logueado.");
        
        // Actualizar header
        if (botonesAuthHeader) {
            botonesAuthHeader.innerHTML = `
                <a href="tienda.html" class="btn-iniciar-sesion">Tienda</a>
                <button id="header-logout" class="btn-registrarse">Cerrar Sesión</button>
            `;
            // Añadimos el listener al nuevo botón del header
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }

        // Actualizar contenido de cuenta.html
        if (authForms) authForms.style.display = 'none'; // Ocultar formularios
        if (userInfo) {
            userInfo.style.display = 'block'; // Mostrar info de usuario
            userEmailEl.textContent = session.user.email;
            btnLogout.addEventListener('click', manejarLogout);
        }

    } else {
        // --- Usuario NO LOGUEADO ---
        console.log("Usuario no está logueado.");

        // Dejar header como está (o asegurarnos de que tenga los botones correctos)
        if (botonesAuthHeader) {
             botonesAuthHeader.innerHTML = `
                <a href="cuenta.html" class="btn-iniciar-sesion">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn-registrarse">Registrarse</a>
            `;
        }

        // Actualizar contenido de cuenta.html
        if (authForms) authForms.style.display = 'block'; // Mostrar formularios
        if (userInfo) userInfo.style.display = 'none'; // Ocultar info de usuario
    }
}

// --- CÓDIGO QUE SE EJECUTA AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Revisar la sesión de autenticación EN TODAS LAS PÁGINAS
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session);
    });
    
    // 2. Cargar productos (solo en las páginas relevantes)
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html') || path === '/' || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }

    // 3. Añadir listeners a los formularios (solo si existen en esta página)
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');

    if (formLogin) {
        formLogin.addEventListener('submit', manejarRegistro);
    }
    if (formRegistro) {
        formRegistro.addEventListener('submit', manejarLogin);
    }
});