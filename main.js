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
    const PRODUCTO_ID = 1; 

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
        
        // --- Actualizar la PÁGINA DE TIENDA (`tienda.html`) ---
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');
        const layoutTienda = document.querySelector('.shop-layout'); // Apunta a la nueva clase

        if (nombreProductoEl) nombreProductoEl.textContent = producto.nombre;
        if (precioProductoEl) precioProductoEl.textContent = `$${producto.precio.toLocaleString('es-MX')} MXN`;
        if (stockProductoEl) stockProductoEl.textContent = `${producto.stock_disponible}`;
        
        if (layoutTienda) {
            layoutTienda.dataset.productId = producto.id;
            layoutTienda.dataset.productStock = producto.stock_disponible;
        }

        // --- Actualizar la PÁGINA DE INICIO (`index.html`) ---
        const nombreIndexEl = document.getElementById('index-producto-nombre');
        const precioIndexEl = document.getElementById('index-producto-precio');

        if(nombreIndexEl) nombreIndexEl.textContent = producto.nombre;
        if(precioIndexEl) precioIndexEl.textContent = `$${producto.precio.toLocaleString('es-MX')}`;
    }
}


// --- LÓGICA DE AUTENTICACIÓN Y PERFILES (FASE 5 y 6) ---
// (Estas funciones no cambian, solo el HTML que las rodea)

async function manejarRegistro(e) {
    e.preventDefault();
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;
    console.log("Intentando registrar con:", email);
    const { data: authData, error: authError } = await db.auth.signUp({ email, password });
    if (authError) {
        console.error('Error en el registro:', authError.message);
        alert('Error: ' + authError.message);
        return;
    }
    console.log('Usuario registrado en Auth:', authData.user);
    const { error: profileError } = await db
        .from('perfiles')
        .insert({ id: authData.user.id, rol: 'cliente' });
    if (profileError) {
        console.error('Error creando el perfil:', profileError.message);
        alert('Error al crear el perfil: ' + profileError.message);
    } else {
        console.log('Perfil creado exitosamente.');
        alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
    }
}

async function manejarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    console.log("Intentando iniciar sesión con:", email);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Error en el inicio de sesión:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión exitoso:', data.user);
        window.location.href = 'cuenta.html';
    }
}

async function manejarLogout() {
    const { error } = await db.auth.signOut();
    if (error) console.error('Error al cerrar sesión:', error.message);
    else window.location.reload();
}

async function cargarDatosPerfil(user) {
    console.log("Cargando datos del perfil para el usuario:", user.id);
    const emailInput = document.getElementById('profile-email');
    if (emailInput) emailInput.value = user.email;

    const { data, error } = await db
        .from('perfiles')
        .select('nombre_completo, telefono, direccion')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error cargando el perfil:', error.message);
    } else if (data) {
        console.log("Perfil encontrado:", data);
        document.getElementById('profile-name').value = data.nombre_completo;
        document.getElementById('profile-phone').value = data.telefono;
        document.getElementById('profile-address').value = data.direccion;
    }
}

async function actualizarPerfil(e, user) {
    e.preventDefault();
    console.log("Actualizando perfil para el usuario:", user.id);
    const nombre = document.getElementById('profile-name').value;
    const telefono = document.getElementById('profile-phone').value;
    const direccion = document.getElementById('profile-address').value;
    const { error } = await db
        .from('perfiles')
        .update({ nombre_completo: nombre, telefono: telefono, direccion: direccion })
        .eq('id', user.id);
    if (error) {
        console.error('Error actualizando el perfil:', error.message);
        alert('Error al guardar: ' + error.message);
    } else {
        console.log("Perfil actualizado exitosamente.");
        alert('¡Datos guardados con éxito!');
    }
}


// --- LÓGICA DEL CARRITO (FASE 7) ---

function leerCarrito() {
    const carritoJSON = localStorage.getItem('carrito');
    return carritoJSON ? JSON.parse(carritoJSON) : {};
}

function guardarCarrito(carrito) {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContadorCarrito(carrito);
}

function actualizarContadorCarrito(carrito) {
    const contadorEl = document.getElementById('carrito-contador');
    let totalItems = 0;
    const cantidades = Object.values(carrito);
    if (cantidades.length > 0) {
        totalItems = cantidades.reduce((sum, current) => sum + current, 0);
    }
    
    if (contadorEl) {
        if (totalItems > 0) {
            contadorEl.textContent = totalItems;
            contadorEl.style.display = 'inline-block'; // Muestra el badge
        } else {
            contadorEl.style.display = 'none'; // Oculta el badge si está vacío
        }
    }
}

function manejarAnadirAlCarrito() {
    console.log("Botón 'Añadir al Carrito' presionado.");
    
    const layoutTienda = document.querySelector('.shop-layout');
    const inputCantidad = document.getElementById('cantidad');
    
    const id = layoutTienda.dataset.productId;
    const stockMaximo = parseInt(layoutTienda.dataset.productStock);
    const cantidad = parseInt(inputCantidad.value);

    if (!id) return alert("Error: No se pudo identificar el producto.");
    if (isNaN(cantidad) || cantidad <= 0) return alert("Por favor, introduce una cantidad válida.");
    if (cantidad > stockMaximo) return alert(`Lo sentimos, solo quedan ${stockMaximo} unidades disponibles.`);

    const carrito = leerCarrito();
    carrito[id] = cantidad;
    guardarCarrito(carrito);

    console.log("Carrito actualizado:", carrito);
    alert(`¡${cantidad} paquete(s) añadidos al carrito!`);
}


// --- GESTIÓN DE UI Y EVENTOS ---

function actualizarUI(session) {
    const authForms = document.getElementById('auth-forms');
    const userInfo = document.getElementById('user-info');
    // ¡NUEVO SELECTOR! Apunta al contenedor de botones de tu CSS
    const authLinksContainer = document.getElementById('auth-links-container'); 

    if (session) {
        // --- Usuario LOGUEADO ---
        console.log("Usuario está logueado.");
        
        // Actualizar header
        if (authLinksContainer) {
            // Usa las clases de tu CSS: .btn y .btn-sm
            authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Mi Cuenta</a>
                <button id="header-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
            `;
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }

        // Actualizar contenido de cuenta.html
        if (authForms) authForms.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'grid'; // .account-container es un grid
            cargarDatosPerfil(session.user);
            
            const formPerfil = document.getElementById('form-perfil');
            if (formPerfil) {
                formPerfil.addEventListener('submit', (e) => actualizarPerfil(e, session.user));
            }
            const btnLogoutSidebar = document.getElementById('btn-logout');
            if(btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', manejarLogout);
        }

    } else {
        // --- Usuario NO LOGUEADO ---
        console.log("Usuario no está logueado.");
        if (authLinksContainer) {
             authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn btn-primary btn-sm">Registrarse</a>
            `;
        }
        if (authForms) authForms.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// --- CÓDIGO QUE SE EJECUTA AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Actualizar contador del carrito
    const carritoActual = leerCarrito();
    actualizarContadorCarrito(carritoActual);
    
    // 2. Revisar la sesión de autenticación
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session);
    });
    
    // 3. Cargar productos
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html')) {
        cargarProducto();
    }

    // 4. Listeners formularios de auth
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);

    // 5. Listener botón de carrito
    const btnCarrito = document.getElementById('btn-anadir-carrito');
    if (btnCarrito) {
        btnCarrito.addEventListener('click', manejarAnadirAlCarrito);
    }
});