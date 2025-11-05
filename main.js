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
    // ... (El código de cargarProducto sigue aquí, idéntico al anterior) ...
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
        // ... (resto del código para rellenar HTML) ...
        const nombreProductoEl = document.getElementById('producto-nombre');
        if (nombreProductoEl) nombreProductoEl.textContent = producto.nombre;
        // ...etc...
    }
}


// --- LÓGICA DE AUTENTICACIÓN (FASE 5) ---

// Función para manejar el REGISTRO
async function manejarRegistro(e) {
    e.preventDefault();
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;

    console.log("Intentando registrar con:", email);

    // 1. Registrar al usuario en auth.users
    const { data: authData, error: authError } = await db.auth.signUp({
        email: email,
        password: password
    });

    if (authError) {
        console.error('Error en el registro:', authError.message);
        alert('Error: ' + authError.message);
        return;
    }
    
    console.log('Usuario registrado en Auth:', authData.user);

    // 2. ¡NUEVO! Crear el perfil en la tabla 'perfiles'
    const { error: profileError } = await db
        .from('perfiles')
        .insert({ 
            id: authData.user.id, // Enlaza el perfil al ID de auth
            rol: 'cliente' // Rol por defecto
            // nombre_completo, telefono, etc., quedan en null
        });
    
    if (profileError) {
        console.error('Error creando el perfil:', profileError.message);
        // Aunque falle el perfil, el registro de auth funcionó
        alert('Error al crear el perfil: ' + profileError.message);
    } else {
        console.log('Perfil creado exitosamente.');
        alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
    }
}

// Función para manejar el INICIO DE SESIÓN
async function manejarLogin(e) {
    // ... (Esta función sigue idéntica a la anterior) ...
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log("Intentando iniciar sesión con:", email);

    const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Error en el inicio de sesión:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión exitoso:', data.user);
        window.location.href = 'cuenta.html'; // Recargar la página de cuenta
    }
}

// Función para manejar el CIERRE DE SESIÓN
async function manejarLogout() {
    // ... (Esta función sigue idéntica a la anterior) ...
    const { error } = await db.auth.signOut();
    if (error) console.error('Error al cerrar sesión:', error.message);
    else window.location.reload();
}

// --- LÓGICA DE PERFILES (FASE 6) ---

// Función para CARGAR datos del perfil en el formulario
async function cargarDatosPerfil(user) {
    console.log("Cargando datos del perfil para el usuario:", user.id);
    
    // Rellenar el email (que ya tenemos)
    const emailInput = document.getElementById('profile-email');
    if (emailInput) emailInput.value = user.email;

    // Buscar el resto de datos en la tabla 'perfiles'
    const { data, error } = await db
        .from('perfiles')
        .select('nombre_completo, telefono, direccion')
        .eq('id', user.id) // Busca la fila que coincida con el ID del usuario
        .single(); // Esperamos solo un resultado

    if (error) {
        console.error('Error cargando el perfil:', error.message);
        alert('No se pudieron cargar los datos de tu perfil.');
    } else if (data) {
        console.log("Perfil encontrado:", data);
        // Rellenar el formulario con los datos de la base de datos
        const nameInput = document.getElementById('profile-name');
        const phoneInput = document.getElementById('profile-phone');
        const addressInput = document.getElementById('profile-address');

        if (nameInput) nameInput.value = data.nombre_completo;
        if (phoneInput) phoneInput.value = data.telefono;
        if (addressInput) addressInput.value = data.direccion;
    }
}

// Función para ACTUALIZAR datos del perfil
async function actualizarPerfil(e, user) {
    e.preventDefault(); // Evita que el formulario recargue la página
    console.log("Actualizando perfil para el usuario:", user.id);

    // Obtener los nuevos valores del formulario
    const nombre = document.getElementById('profile-name').value;
    const telefono = document.getElementById('profile-phone').value;
    const direccion = document.getElementById('profile-address').value;

    // Enviar la actualización a Supabase
    const { error } = await db
        .from('perfiles')
        .update({
            nombre_completo: nombre,
            telefono: telefono,
            direccion: direccion
        })
        .eq('id', user.id); // Solo actualiza la fila de este usuario

    if (error) {
        console.error('Error actualizando el perfil:', error.message);
        alert('Error al guardar: ' + error.message);
    } else {
        console.log("Perfil actualizado exitosamente.");
        alert('¡Datos guardados con éxito!');
    }
}


// --- GESTIÓN DE UI Y EVENTOS ---

// Función para actualizar la UI (botones, formularios)
function actualizarUI(session) {
    const authForms = document.getElementById('auth-forms');
    const userInfo = document.getElementById('user-info');
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
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }

        // Actualizar contenido de cuenta.html
        if (authForms) authForms.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'flex'; // Usamos 'flex' por el nuevo layout
            
            // ¡NUEVO! Cargar los datos del perfil del usuario
            cargarDatosPerfil(session.user);
            
            // ¡NUEVO! Añadir listener al formulario de perfil
            const formPerfil = document.getElementById('form-perfil');
            if (formPerfil) {
                formPerfil.addEventListener('submit', (e) => {
                    actualizarPerfil(e, session.user);
                });
            }

            // Añadir listener al botón de logout del sidebar
            const btnLogoutSidebar = document.getElementById('btn-logout');
            if(btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', manejarLogout);
        }

    } else {
        // --- Usuario NO LOGUEADO ---
        console.log("Usuario no está logueado.");
        if (botonesAuthHeader) {
             botonesAuthHeader.innerHTML = `
                <a href="cuenta.html" class="btn-iniciar-sesion">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn-registrarse">Registrarse</a>
            `;
        }
        if (authForms) authForms.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
    }
}

// --- CÓDIGO QUE SE EJECUTA AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Revisar la sesión de autenticación
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session);
    });
    
    // 2. Cargar productos (si es la página correcta)
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html')) {
        cargarProducto();
    }

    // 3. Añadir listeners a los formularios de auth
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');

    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);
});