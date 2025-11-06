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
    if (error) { console.error('Error al cargar el producto:', error.message); return; }
    if (data) {
        const producto = data;
        // --- Actualizar la PÁGINA DE TIENDA (`tienda.html`) ---
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');
        const layoutTienda = document.querySelector('.shop-layout'); 
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
        const nameInput = document.getElementById('profile-name');
        const phoneInput = document.getElementById('profile-phone');
        const addressInput = document.getElementById('profile-address');
        if (nameInput) nameInput.value = data.nombre_completo || '';
        if (phoneInput) phoneInput.value = data.telefono || '';
        if (addressInput) addressInput.value = data.direccion || '';
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
            contadorEl.style.display = 'inline-block';
        } else {
            contadorEl.style.display = 'none';
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


// --- LÓGICA DE CHECKOUT (FASE 8) ---

async function cargarResumenCheckout() {
    console.log("Cargando resumen de checkout...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    if (!productoID) {
        console.log("El carrito está vacío.");
        document.getElementById('checkout-items').innerHTML = "<p>Tu carrito está vacío.</p>";
        return;
    }
    const { data: producto, error } = await db
        .from('productos')
        .select('nombre, precio')
        .eq('id', productoID)
        .single();
    if (error) { console.error("Error al buscar precio del producto:", error); return; }
    const subtotal = producto.precio * cantidad;
    const envio = 0;
    const total = subtotal + envio;
    document.getElementById('checkout-items').innerHTML = `<p><span>${producto.nombre} (x${cantidad})</span><span>$${subtotal.toLocaleString('es-MX')}</span></p>`;
    document.getElementById('checkout-subtotal').textContent = `$${subtotal.toLocaleString('es-MX')}`;
    document.getElementById('checkout-envio').textContent = `$${envio.toLocaleString('es-MX')}`;
    document.getElementById('checkout-total').textContent = `$${total.toLocaleString('es-MX')}`;
}

async function autocompletarDatosEnvio(user) {
    const { data, error } = await db
        .from('perfiles')
        .select('nombre_completo, telefono, direccion')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error cargando el perfil para autocompletar:', error.message);
    } else if (data) {
        const nameInput = document.getElementById('checkout-name');
        const addressInput = document.getElementById('checkout-address');
        const phoneInput = document.getElementById('checkout-phone');
        if (nameInput) nameInput.value = data.nombre_completo || '';
        if (addressInput) addressInput.value = data.direccion || '';
        if (phoneInput) phoneInput.value = data.telefono || '';
    }
}

async function manejarConfirmarCompra(e) {
    e.preventDefault();
    console.log("Procesando compra...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    if (!productoID) { alert("Tu carrito está vacío."); return; }
    const { data: producto, error: stockError } = await db
        .from('productos')
        .select('stock_disponible')
        .eq('id', productoID)
        .single();
    if (stockError) { alert("Error al verificar el stock: " + stockError.message); return; }
    const nuevoStock = producto.stock_disponible - cantidad;
    if (nuevoStock < 0) { alert("Error: Stock insuficiente."); return; }
    const { error: updateError } = await db
        .from('productos')
        .update({ stock_disponible: nuevoStock })
        .eq('id', productoID);
    if (updateError) { alert("Error al actualizar el inventario: " + updateError.message); return; }
    console.log("¡Compra exitosa! Stock actualizado.");
    guardarCarrito({});
    alert("¡Gracias por tu compra! Tu pedido ha sido procesado.");
    window.location.href = 'index.html';
}


// --- GESTIÓN DE UI Y EVENTOS ---

// ***** ESTA ES LA FUNCIÓN CORREGIDA *****
function actualizarUI(session) {
    const authLinksContainer = document.getElementById('auth-links-container'); 
    const authForms = document.getElementById('auth-forms');
    const userInfo = document.getElementById('user-info');
    const checkoutLoginPrompt = document.getElementById('checkout-login-prompt');
    const checkoutContainer = document.getElementById('checkout-container');

    if (session) {
        // --- Usuario LOGUEADO ---
        console.log("Usuario está logueado.");
        
        // ¡CÓDIGO RESTAURADO!
        if (authLinksContainer) {
            authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Mi Cuenta</a>
                <button id="header-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
            `;
            // Añadimos el listener al nuevo botón
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }

        // Lógica de página de cuenta
        if (authForms) authForms.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'grid';
            cargarDatosPerfil(session.user);
            
            const formPerfil = document.getElementById('form-perfil');
            if (formPerfil) {
                formPerfil.addEventListener('submit', (e) => actualizarPerfil(e, session.user));
            }
            const btnLogoutSidebar = document.getElementById('btn-logout');
            if(btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', manejarLogout);
        }
        
        // Lógica de página de checkout
        if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'none';
        if (checkoutContainer) {
            checkoutContainer.style.display = 'grid';
            autocompletarDatosEnvio(session.user);
            cargarResumenCheckout();
        }

    } else {
        // --- Usuario NO LOGUEADO ---
        console.log("Usuario no está logueado.");

        // ¡CÓDIGO RESTAURADO!
        if (authLinksContainer) {
             authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn btn-primary btn-sm">Registrarse</a>
            `;
        }

        // Lógica de página de cuenta
        if (authForms) authForms.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';

        // Lógica de página de checkout
        if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'block';
        if (checkoutContainer) checkoutContainer.style.display = 'none';
    }
}

// --- CÓDIGO QUE SE EJECUTA AL CARGAR LA PÁGINA ---

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Actualizar contador del carrito
    const carritoActual = leerCarrito();
    actualizarContadorCarrito(carritoActual);
    
    // 2. Revisar la sesión de autenticación
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session); // Esta función ahora maneja todo
    });
    
    // 3. Cargar productos
    const path = window.location.pathname;
    // Corregido para que solo se ejecute en index y tienda
    if (path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }

    // 4. Listeners formularios de auth
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);

    // 5. Listener botón de carrito
    const btnCarrito = document.getElementById('btn-anadir-carrito');
    if (btnCarrito) btnCarrito.addEventListener('click', manejarAnadirAlCarrito);
    
    // 6. Listener para el botón de confirmar compra
    const formCheckout = document.getElementById('form-checkout');
    if (formCheckout) {
        formCheckout.addEventListener('submit', manejarConfirmarCompra);
    }
});