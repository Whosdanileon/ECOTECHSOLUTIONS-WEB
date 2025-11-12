/* =====================================================
 * ECOTECHSOLUTIONS - MAIN.JS MEJORADO
 * Versión 2.0.0 (Refactorizado, Sincronizado y Funcional)
 * ===================================================== */

/* ========== CONFIGURACIÓN CENTRALIZADA ========== */
const CONFIG = {
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    
    // Storage
    CART_KEY: 'ecotech_cart',
    USER_CACHE_KEY: 'ecotech_user_cache',
    
    // Timeouts
    SESSION_TIMEOUT: 3600000, // 1 hora
    LOADING_TIMEOUT: 5000,
    
    // Roles
    ROLES: {
        CLIENTE: 'Cliente',
        OPERADOR: 'Operador',
        SUPERVISOR: 'Supervisor',
        MECANICO: 'Mecanico',
        LIDER: 'Lider',
        SISTEMAS: 'Sistemas'
    },
    
    // Estados
    MACHINE_STATES: {
        EN_CICLO: 'En Ciclo',
        DETENIDA: 'Detenida',
        PARO_EMERGENCIA: 'Paro de Emergencia'
    }
};

class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.queue = [];
    }

    createContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} notification-enter`;
        
        const icon = this.getIcon(type);
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <p class="notification-message">${this.sanitizeHTML(message)}</p>
            </div>
            <button class="notification-close" type="button" aria-label="Cerrar notificación">
                <i class="fa-solid fa-times"></i>
            </button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.hide(notification));

        this.container.appendChild(notification);

        // Animar entrada
        setTimeout(() => notification.classList.remove('notification-enter'), 10);

        // Auto-cerrar
        if (duration > 0) {
            setTimeout(() => this.hide(notification), duration);
        }

        return notification;
    }

    hide(notification) {
        if (!notification) return;
        notification.classList.add('notification-exit');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }

    getIcon(type) {
        const icons = {
            'success': '<i class="fa-solid fa-check-circle"></i>',
            'error': '<i class="fa-solid fa-exclamation-circle"></i>',
            'warning': '<i class="fa-solid fa-exclamation-triangle"></i>',
            'info': '<i class="fa-solid fa-info-circle"></i>',
            'loading': '<i class="fa-solid fa-spinner"></i>'
        };
        return icons[type] || icons['info'];
    }

    sanitizeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    success(message, duration = 4000) { return this.show(message, 'success', duration); }
    error(message, duration = 6000) { return this.show(message, 'error', duration); }
    warning(message, duration = 5000) { return this.show(message, 'warning', duration); }
    info(message, duration = 4000) { return this.show(message, 'info', duration); }
    loading(message) { return this.show(message, 'loading', 0); }
}

// Inicializar sistema global de notificaciones
const notify = new NotificationSystem();

/* ===== 1. SISTEMA DE VALIDACIÓN DE FORMULARIOS (MEJORADO) ===== */

class FormValidator {
    constructor(formSelector) {
        this.form = document.querySelector(formSelector);
        if (!this.form) {
            console.warn(`Formulario no encontrado: ${formSelector}`);
            return;
        }
        this.errors = {};
        this.rules = {};
    }

    addRule(fieldName, rules) {
        this.rules[fieldName] = rules;
        return this;
    }

    validate() {
        this.errors = {};
        let isValid = true;

        for (const [fieldName, rules] of Object.entries(this.rules)) {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (!field) continue;

            const value = field.value.trim();
            
            // Limpiar errores previos
            this.clearFieldError(field);

            // Aplicar reglas
            for (const [ruleName, ruleValue] of Object.entries(rules)) {
                const error = this.applyRule(value, ruleName, ruleValue, field);
                if (error) {
                    this.errors[fieldName] = error;
                    this.showFieldError(field, error);
                    isValid = false;
                    break; // Solo mostrar primer error
                }
            }
        }

        return isValid;
    }

    applyRule(value, ruleName, ruleValue, field) {
        switch (ruleName) {
            case 'required':
                if (!value) return ruleValue || 'Este campo es obligatorio';
                break;
            
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (value && !emailRegex.test(value)) 
                    return ruleValue || 'Ingresa un email válido';
                break;
            
            case 'minLength':
                if (value.length < ruleValue) 
                    return `Mínimo ${ruleValue} caracteres`;
                break;
            
            case 'maxLength':
                if (value.length > ruleValue) 
                    return `Máximo ${ruleValue} caracteres`;
                break;
            
            case 'pattern':
                if (value && !ruleValue.test(value)) 
                    return 'Formato inválido';
                break;
            
            case 'match':
                const matchField = this.form.querySelector(`[name="${ruleValue}"]`);
                if (matchField && value !== matchField.value.trim())
                    return 'Los campos no coinciden';
                break;
            
            case 'custom':
                if (typeof ruleValue === 'function') {
                    return ruleValue(value, field);
                }
                break;
        }
        return null;
    }

    showFieldError(field, error) {
        field.classList.add('input-error');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error-message';
        errorDiv.textContent = error;
        
        // Remover error previo si existe
        const prevError = field.parentNode.querySelector('.field-error-message');
        if (prevError) prevError.remove();
        
        field.parentNode.insertBefore(errorDiv, field.nextSibling);
    }

    clearFieldError(field) {
        field.classList.remove('input-error');
        const errorMsg = field.parentNode.querySelector('.field-error-message');
        if (errorMsg) errorMsg.remove();
    }

    clearAllErrors() {
        if (!this.form) return;
        this.form.querySelectorAll('.input-error').forEach(field => {
            this.clearFieldError(field);
        });
    }
}

/* ===== 2. CONFIGURACIÓN Y CLIENTE SUPABASE ===== */

const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Cliente de Supabase conectado.');

/* ===== 3. SISTEMA DE CACHÉ Y SINCRONIZACIÓN ===== */

class SyncManager {
    constructor() {
        this.cache = new Map();
        this.subscriptions = new Map();
        this.isOnline = navigator.onLine;
        this.setupOnlineDetection();
    }

    setupOnlineDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🟢 Conexión restaurada');
            notify.success('Conexión restaurada');
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('🔴 Conexión perdida');
            notify.warning('Sin conexión. Los cambios se guardarán cuando vuelva la conexión.');
        });
    }

    set(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        return cached ? cached.data : null;
    }

    clear(key) {
        this.cache.delete(key);
    }

    clearAll() {
        this.cache.clear();
    }
}

const syncManager = new SyncManager();

/* ===== 4. LÓGICA DE PRODUCTOS (TIENDA E INICIO) ===== */

async function cargarProducto(productoID = 1) {
    console.log(`📦 Cargando producto ID: ${productoID}...`);
    
    // Verificar caché primero
    const cached = syncManager.get(`producto_${productoID}`);
    if (cached) {
        console.log('📦 Producto obtenido del caché');
        renderizarProducto(cached);
        return cached;
    }

    try {
        const { data, error } = await db
            .from('productos')
            .select('*')
            .eq('id', productoID) 
            .single();
            
        if (error) throw error;
        
        if (data) {
            syncManager.set(`producto_${productoID}`, data);
            renderizarProducto(data);
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error al cargar el producto:', error.message); 
        notify.error('Error al cargar el producto: ' + error.message);
        return null;
    }
}

function renderizarProducto(producto) {
    const path = window.location.pathname;
    const esPaginaDeProducto = path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/');

    if (!esPaginaDeProducto) return;

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

    const nombreIndexEl = document.getElementById('index-producto-nombre');
    const precioIndexEl = document.getElementById('index-producto-precio');
    if (nombreIndexEl) nombreIndexEl.textContent = producto.nombre;
    if (precioIndexEl) precioIndexEl.textContent = `$${producto.precio.toLocaleString('es-MX')}`;
}

/* ===== 5. LÓGICA DE AUTENTICACIÓN Y PERFILES (CLIENTES) ===== */

const validatorRegistro = new FormValidator('#form-registro');
const validatorLogin = new FormValidator('#form-login');

async function manejarRegistro(e) {
    e.preventDefault();
    
    validatorRegistro.clearAllErrors();
    validatorRegistro
        .addRule('registro-email', { 
            required: 'Email requerido', 
            email: 'Email inválido' 
        })
        .addRule('registro-password', { 
            required: 'Contraseña requerida', 
            minLength: 6 
        });

    if (!validatorRegistro.validate()) {
        return;
    }

    const email = document.getElementById('registro-email').value.trim();
    const password = document.getElementById('registro-password').value;
    
    console.log("📝 Intentando registrar con:", email);
    const loadingNotif = notify.loading('Registrando usuario...');
    
    try {
        const { data: authData, error: authError } = await db.auth.signUp({ email, password });
        
        if (authError) throw authError;
        
        console.log('✅ Usuario registrado en Auth:', authData.user.email);

        const { error: profileError } = await db
            .from('perfiles')
            .insert({ 
                id: authData.user.id, 
                rol: 'cliente',
                email: authData.user.email
            });
            
        if (profileError) throw profileError;

        console.log('✅ Perfil creado exitosamente.');
        
        notify.hide(loadingNotif);
        notify.success('¡Registro exitoso! Ahora puedes iniciar sesión.');
        
        // Limpiar formulario
        document.getElementById('form-registro').reset();
        
        // Esperar un poco y mostrar login
        setTimeout(() => {
            document.getElementById('form-registro').style.display = 'none';
            document.getElementById('form-login').style.display = 'block';
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error en registro:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

async function manejarLogin(e) {
    e.preventDefault();
    
    validatorLogin.clearAllErrors();
    validatorLogin
        .addRule('login-email', { 
            required: 'Email requerido', 
            email: 'Email inválido' 
        })
        .addRule('login-password', { 
            required: 'Contraseña requerida' 
        });

    if (!validatorLogin.validate()) {
        return;
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log("🔐 Intentando iniciar sesión de CLIENTE con:", email);
    const loadingNotif = notify.loading('Iniciando sesión...');
    
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        console.log('✅ Inicio de sesión exitoso:', data.user.email);
        notify.hide(loadingNotif);
        notify.success('¡Bienvenido!');
        
        setTimeout(() => {
            window.location.href = 'cuenta.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error en login:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

async function manejarLoginPersonal(e) {
    e.preventDefault();
    const email = document.getElementById('personal-email').value.trim();
    const password = document.getElementById('personal-password').value;
    
    console.log("🔐 Intentando iniciar sesión de PERSONAL con:", email);
    const loadingNotif = notify.loading('Verificando acceso...');
    
    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        console.log('✅ Inicio de sesión de personal exitoso:', data.user.email);
        notify.hide(loadingNotif);
        notify.success('¡Acceso concedido!');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error en login personal:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

async function manejarLogout() {
    const loadingNotif = notify.loading('Cerrando sesión...');
    try {
        const { error } = await db.auth.signOut();
        if (error) throw error;
        
        notify.hide(loadingNotif);
        notify.info('Sesión cerrada.');
        syncManager.clearAll();
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        console.error('❌ Error al cerrar sesión:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

async function cargarDatosPerfil(user) {
    console.log("👤 Cargando datos del perfil...");
    
    try {
        const emailInput = document.getElementById('profile-email');
        if (emailInput) emailInput.value = user.email;
        
        const { data, error } = await db
            .from('perfiles')
            .select('nombre_completo, telefono, direccion')
            .eq('id', user.id)
            .single();
            
        if (error) throw error;
        
        if (data) {
            document.getElementById('profile-name').value = data.nombre_completo || '';
            document.getElementById('profile-phone').value = data.telefono || '';
            document.getElementById('profile-address').value = data.direccion || '';
        }
    } catch (error) {
        console.error('❌ Error cargando el perfil:', error.message);
        notify.error('No se pudieron cargar tus datos: ' + error.message);
    }
}

async function actualizarPerfil(e, user) {
    e.preventDefault();
    
    const nombre = document.getElementById('profile-name').value.trim();
    const telefono = document.getElementById('profile-phone').value.trim();
    const direccion = document.getElementById('profile-address').value.trim();
    
    if (!nombre || !direccion) {
        notify.warning('Por favor, completa nombre y dirección.');
        return;
    }
    
    console.log("💾 Actualizando perfil...");
    const loadingNotif = notify.loading('Guardando cambios...');
    
    try {
        const { error } = await db
            .from('perfiles')
            .update({ 
                nombre_completo: nombre, 
                telefono: telefono, 
                direccion: direccion,
                email: user.email
            })
            .eq('id', user.id);
            
        if (error) throw error;

        console.log("✅ Perfil actualizado.");
        notify.hide(loadingNotif);
        notify.success('¡Datos guardados con éxito!');
        syncManager.set(`perfil_${user.id}`, { nombre_completo: nombre, telefono, direccion });
        
    } catch (error) {
        console.error('❌ Error actualizando perfil:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error al guardar: ' + error.message);
    }
}

/* ===== 6. LÓGICA DEL CARRITO (LOCALSTORAGE MEJORADO) ===== */

function leerCarrito() {
    try {
        const carritoJSON = localStorage.getItem('carrito');
        return carritoJSON ? JSON.parse(carritoJSON) : {};
    } catch (error) {
        console.error('Error leyendo carrito:', error);
        return {};
    }
}

function guardarCarrito(carrito) {
    try {
        localStorage.setItem('carrito', JSON.stringify(carrito));
        actualizarContadorCarrito(carrito);
    } catch (error) {
        console.error('Error guardando carrito:', error);
        notify.error('Error al guardar el carrito');
    }
}

function actualizarContadorCarrito(carrito) {
    const contadorEl = document.getElementById('carrito-contador');
    if (!contadorEl) return;
    
    let totalItems = 0;
    const cantidades = Object.values(carrito);
    if (cantidades.length > 0) {
        totalItems = cantidades.reduce((sum, current) => sum + current, 0);
    }
    
    if (totalItems > 0) {
        contadorEl.textContent = totalItems;
        contadorEl.style.display = 'inline-block';
    } else {
        contadorEl.style.display = 'none';
    }
}

function manejarAnadirAlCarrito() {
    const layoutTienda = document.querySelector('.shop-layout');
    const inputCantidad = document.getElementById('cantidad');
    
    if (!layoutTienda || !inputCantidad) {
        notify.error('Error: No se puede agregar al carrito.');
        return;
    }
    
    const id = layoutTienda.dataset.productId;
    const stockMaximo = parseInt(layoutTienda.dataset.productStock);
    const cantidad = parseInt(inputCantidad.value);
    
    if (!id) {
        notify.error("Error: No se pudo identificar el producto.");
        return;
    }
    
    if (isNaN(cantidad) || cantidad <= 0) {
        notify.warning("Por favor, introduce una cantidad válida.");
        return;
    }
    
    if (cantidad > stockMaximo) {
        notify.warning(`Lo sentimos, solo quedan ${stockMaximo} unidades disponibles.`);
        return;
    }
    
    const carrito = leerCarrito();
    carrito[id] = cantidad;
    guardarCarrito(carrito);
    
    notify.success(`✅ ¡${cantidad} paquete(s) añadidos al carrito!`);
    inputCantidad.value = 1;
}

/* ===== 7. LÓGICA DE CHECKOUT (COMPRA) ===== */

async function cargarResumenCheckout() {
    console.log("📋 Cargando resumen de checkout...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    
    if (!productoID) {
        document.getElementById('checkout-items').innerHTML = "<p>Tu carrito está vacío.</p>";
        return;
    }
    
    try {
        const producto = await cargarProducto(productoID); 
        if (!producto) throw new Error('Producto no encontrado');

        const subtotal = producto.precio * cantidad;
        const envio = 0; 
        const total = subtotal + envio;
        
        document.getElementById('checkout-items').innerHTML = `
            <p>
                <span>${producto.nombre} (x${cantidad})</span>
                <span>$${subtotal.toLocaleString('es-MX')}</span>
            </p>
        `;
        document.getElementById('checkout-subtotal').textContent = `$${subtotal.toLocaleString('es-MX')}`;
        document.getElementById('checkout-envio').textContent = `$${envio.toLocaleString('es-MX')}`;
        document.getElementById('checkout-total').textContent = `$${total.toLocaleString('es-MX')}`;
        
    } catch (error) {
        console.error('Error cargando checkout:', error.message);
        notify.error('Error: ' + error.message);
    }
}

async function autocompletarDatosEnvio(user) {
    try {
        const { data, error } = await db
            .from('perfiles')
            .select('nombre_completo, telefono, direccion')
            .eq('id', user.id)
            .single();
            
        if (error) throw error;
        
        if (data) {
            const nameInput = document.getElementById('checkout-name');
            const addressInput = document.getElementById('checkout-address');
            const phoneInput = document.getElementById('checkout-phone');
            
            if (nameInput) nameInput.value = data.nombre_completo || '';
            if (addressInput) addressInput.value = data.direccion || '';
            if (phoneInput) phoneInput.value = data.telefono || '';
        }
    } catch (error) {
        console.error('Error autocomplete:', error.message);
    }
}

async function manejarConfirmarCompra(e) {
    e.preventDefault();
    console.log("💳 Procesando compra...");
    
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    const { data: { user } } = await db.auth.getUser();

    if (!productoID || !user) {
        notify.error("Error: Carrito vacío o sesión no encontrada.");
        return;
    }
    
    const datosEnvio = {
        nombre: document.getElementById('checkout-name').value.trim(),
        direccion: document.getElementById('checkout-address').value.trim(),
        telefono: document.getElementById('checkout-phone').value.trim()
    };
    
    if (!datosEnvio.nombre || !datosEnvio.direccion) {
        notify.warning("Por favor, completa tu nombre y dirección de envío.");
        return;
    }

    const loadingNotif = notify.loading('Procesando compra...');

    try {
        const { data: producto, error: stockError } = await db
            .from('productos')
            .select('nombre, precio, stock_disponible')
            .eq('id', productoID)
            .single();

        if (stockError) throw stockError;

        const nuevoStock = producto.stock_disponible - cantidad;
        if (nuevoStock < 0) {
            throw new Error("Stock insuficiente. Alguien compró el producto.");
        }
        
        const total = producto.precio * cantidad;
        const itemsPedido = [{
            id: productoID,
            nombre: producto.nombre,
            cantidad: cantidad,
            precio_unitario: producto.precio
        }];

        // Crear el pedido
        const { error: pedidoError } = await db
            .from('pedidos')
            .insert({
                user_id: user.id,
                items: itemsPedido,
                total: total,
                datos_envio: datosEnvio,
                estado: 'Procesando'
            });

        if (pedidoError) throw pedidoError;

        console.log("✅ Pedido guardado en la base de datos!");

        // Actualizar stock
        const { error: updateError } = await db
            .from('productos')
            .update({ stock_disponible: nuevoStock })
            .eq('id', productoID);
            
        if (updateError) throw updateError;

        console.log("✅ Stock actualizado.");
        
        notify.hide(loadingNotif);
        notify.success("¡Gracias por tu compra! Tu pedido ha sido procesado.");
        
        guardarCarrito({});
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error en compra:', error.message);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

/* ===== 8. LÓGICA DEL PANEL DE PERSONAL (ROLES Y MÁQUINAS) ===== */

function renderAdminBar(adminBar, userRole) {
    if (!adminBar) return;
    
    let adminHTML = '';
    
    if (userRole === 'Lider' || userRole === 'Sistemas') {
        adminHTML = `
            <h4>Panel de Administrador</h4>
            <a href="admin-personal.html" class="btn btn-secondary">
                <i class="fa-solid fa-users-cog"></i> Administrar Personal
            </a>
        `;
    }
    
    if (userRole === 'Sistemas') {
        adminHTML += `
            <a href="#" class="btn btn-secondary disabled" disabled>
                <i class="fa-solid fa-chart-line"></i> Ver Reportes Globales
            </a>
        `;
    }
    
    if (adminHTML) adminBar.innerHTML = adminHTML;
    adminBar.style.display = adminHTML ? 'flex' : 'none';
}

async function getMaquinas() {
    console.log('🤖 Obteniendo lista de máquinas...');
    try {
        const { data, error } = await db.from('maquinas').select('*'); 
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error obteniendo máquinas:', error);
        throw error;
    }
}

async function loadAndRenderMaquinas(container, userRole) {
    if (!container) return;
    
    container.innerHTML = '<p>Cargando máquinas...</p>';
    try {
        const maquinas = await getMaquinas();
        console.log(`✅ ${maquinas.length} máquinas recibidas.`);
        
        container.innerHTML = ''; 
        
        if (maquinas.length > 0) {
            maquinas.forEach(maquina => {
                container.insertAdjacentHTML('beforeend', createMachineHTML(maquina, userRole));
            });
            
            maquinas.forEach(maquina => {
                if (maquina.id === 1 && maquina.controles) {
                    actualizarBotonesParo(maquina.controles.Paro === true);
                }
            });
        } else {
            container.innerHTML = '<p>No hay máquinas disponibles.</p>';
        }
    } catch (error) {
        console.error('❌ Error al obtener máquinas:', error);
        container.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function actualizarBotonesParo(estaEnParo) {
    const controlesCiclo = document.getElementById('controles-ciclo-1');
    const controlesManuales = document.getElementById('controles-manuales-1');
    const controlesReset = document.getElementById('controles-reset-1');

    if (estaEnParo) {
        if (controlesCiclo) controlesCiclo.style.display = 'none';
        if (controlesManuales) controlesManuales.style.display = 'none';
        if (controlesReset) controlesReset.style.display = 'block';
    } else {
        if (controlesCiclo) controlesCiclo.style.display = 'block';
        if (controlesManuales) controlesManuales.style.display = 'block';
        if (controlesReset) controlesReset.style.display = 'none';
    }
}

function createMachineHTML(maquina, userRole) {
    let controlesHTML = '';
    const loteInfo = `<p id="lote-${maquina.id}"><strong>Lote Actual:</strong> ${maquina.lote_actual || 'N/A'}</p>`;
    const canControlThisUser = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);

    if (maquina.id === 1 && maquina.controles) {
        const { online_llenado, online_vaciado, online_arriba, online_abajo } = maquina.controles;
        const fillState = online_llenado ? 'llenado' : (online_vaciado ? 'vaciado' : 'fill-off');
        const trayState = online_arriba ? 'arriba' : (online_abajo ? 'abajo' : 'tray-off');

        if (canControlThisUser) {
            controlesHTML = `
                <div class="controles" id="controles-ciclo-1">
                    <p><strong>Ciclo de Proceso:</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-control" data-command="Inicio" data-value="true" data-maquina-id="1">
                            <i class="fa-solid fa-play"></i> Iniciar Ciclo
                        </button>
                        <button class="btn btn-danger btn-control" data-command="Paro" data-value="true" data-maquina-id="1">
                            <i class="fa-solid fa-stop"></i> Paro de Emergencia
                        </button>
                    </div>
                </div>
                <div class="controles" id="controles-reset-1" style="display: none;">
                    <p><strong>⚠️ ¡Paro de Emergencia Activo!</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-success btn-control" data-command="Paro" data-value="false" data-maquina-id="1">
                            <i class="fa-solid fa-redo"></i> Restablecer Paro
                        </button>
                    </div>
                </div>
                <div class="controles-manuales" id="controles-manuales-1">
                    <div class="controles-detallados">
                        <p><strong>Control Llenado/Vaciado:</strong></p>
                        <div class="switch-3-pos" data-maquina-id="1">
                            <input type="radio" id="llenado-1" name="switch-fill-1" data-command-on="online_llenado" data-command-off="online_vaciado" ${fillState === 'llenado' ? 'checked' : ''}>
                            <label for="llenado-1">Llenado</label>
                            <input type="radio" id="fill-off-1" name="switch-fill-1" data-commands-off="online_llenado,online_vaciado" ${fillState === 'fill-off' ? 'checked' : ''}>
                            <label for="fill-off-1">OFF</label>
                            <input type="radio" id="vaciado-1" name="switch-fill-1" data-command-on="online_vaciado" data-command-off="online_llenado" ${fillState === 'vaciado' ? 'checked' : ''}>
                            <label for="vaciado-1">Vaciado</label>
                        </div>
                    </div>
                    <div class="controles-detallados">
                        <p><strong>Control de Charola:</strong></p>
                        <div class="switch-3-pos" data-maquina-id="1">
                            <input type="radio" id="arriba-1" name="switch-tray-1" data-command-on="online_arriba" data-command-off="online_abajo" ${trayState === 'arriba' ? 'checked' : ''}>
                            <label for="arriba-1">Arriba</label>
                            <input type="radio" id="tray-off-1" name="switch-tray-1" data-commands-off="online_arriba,online_abajo" ${trayState === 'tray-off' ? 'checked' : ''}>
                            <label for="tray-off-1">OFF</label>
                            <input type="radio" id="abajo-1" name="switch-tray-1" data-command-on="online_abajo" data-command-off="online_arriba" ${trayState === 'abajo' ? 'checked' : ''}>
                            <label for="abajo-1">Abajo</label>
                        </div>
                    </div>
                </div>
            `;
        }
    } 
    else if (canControlThisUser) {
        controlesHTML = `<div class="controles"><p>Controles no disponibles para esta máquina.</p></div>`;
    }
    else if (userRole === 'Operador') {
        controlesHTML = `<div class="controles"><p>📖 Modo de solo lectura.</p></div>`;
    }

    const estadoClass = maquina.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger';

    return `
        <div class="card maquina" id="maquina-${maquina.id}" data-area="${maquina.area}">
            <h3><i class="fa-solid fa-robot"></i> ${maquina.nombre || 'Máquina sin nombre'}</h3>
            <p class="flex-between"><strong>Área:</strong> ${maquina.area || 'N/A'}</p>
            <p class="flex-between">
                <strong>Estado:</strong> 
                <span class="badge ${estadoClass}" id="estado-${maquina.id}">${maquina.estado || 'Desconocido'}</span>
            </p>
            ${(canControlThisUser || userRole === 'Operador') ? loteInfo : ''} 
            ${controlesHTML}
        </div>
    `;
}

async function sendPlcCommand(maquinaId, commandName, commandValue, button) {
    let originalText;
    if (button) {
        originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';
    }
    
    console.warn(`📡 Enviando comando: ${commandName} -> ${commandValue} a Máquina ${maquinaId}`);

    try {
        const { data: maquina, error: fetchError } = await db
            .from('maquinas')
            .select('controles, estado, lote_actual')
            .eq('id', maquinaId)
            .single();

        if (fetchError) throw fetchError;

        const newControls = maquina.controles ? { ...maquina.controles } : {};
        const newMaquinaState = {
            estado: maquina.estado,
            lote_actual: maquina.lote_actual
        };

        if (commandName === 'Paro' && commandValue === true) {
            newMaquinaState.estado = 'Detenida';
            newControls['Inicio'] = false;
            newControls['online_llenado'] = false;
            newControls['online_vaciado'] = false;
            newControls['online_arriba'] = false;
            newControls['online_abajo'] = false;
            newControls['Paro'] = true;
        } 
        else if (commandName === 'Paro' && commandValue === false) {
            newControls['Paro'] = false;
        }
        else if (newControls['Paro'] === true) {
            notify.warning("Paro de Emergencia activo. Ignoring comando.");
            if (button) { button.disabled = false; button.textContent = originalText; }
            return; 
        }
        else if (commandName === 'Inicio') {
            newMaquinaState.estado = 'En Ciclo';
            newMaquinaState.lote_actual = `LT-${Math.floor(Math.random() * 900) + 100}`;
            newControls['Inicio'] = true;
        }
        else if (commandName === 'online_llenado' && commandValue) {
            newControls['online_llenado'] = true;
            newControls['online_vaciado'] = false;
        }
        else if (commandName === 'online_vaciado' && commandValue) {
            newControls['online_llenado'] = false;
            newControls['online_vaciado'] = true;
        }
        else if (commandName === 'online_arriba' && commandValue) {
            newControls['online_arriba'] = true;
            newControls['online_abajo'] = false;
        }
        else if (commandName === 'online_abajo' && commandValue) {
            newControls['online_arriba'] = false;
            newControls['online_abajo'] = true;
        }
        else if (commandName === 'apagar_llenado_vaciado') {
            newControls['online_llenado'] = false;
            newControls['online_vaciado'] = false;
        }
        else if (commandName === 'apagar_arriba_abajo') {
            newControls['online_arriba'] = false;
            newControls['online_abajo'] = false;
        }

        if (commandName === 'Paro') {
            actualizarBotonesParo(commandValue);
        }

        const { error: updateError } = await db.from('maquinas')
            .update({ 
                controles: newControls, 
                estado: newMaquinaState.estado,
                lote_actual: newMaquinaState.lote_actual
            })
            .eq('id', maquinaId);
        
        if (updateError) throw updateError;
        
        notify.success(`✅ Comando ejecutado`);
        
    } catch (error) {
        console.error(`❌ Error en comando:`, error);
        notify.error('Error: ' + error.message);
    } finally {
        if (button) {
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 800); 
        }
    }
}

function setupEventListeners(container, userRole) {
    console.log('👂 Configurando event listeners del panel...');
    const canControl = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);
    
    if (!canControl) return;

    container.addEventListener('click', async (event) => {
        const button = event.target.closest('button.btn-control');
        if (button && !button.disabled) {
            const command = button.dataset.command;
            const value = (button.dataset.value === 'true'); 
            const maquinaId = button.dataset.maquinaId;
            if (command && maquinaId) {
                await sendPlcCommand(maquinaId, command, value, button);
            }
        }
    });

    container.addEventListener('change', async (event) => {
        if (event.target.type === 'radio' && event.target.name.startsWith('switch-')) {
            const radio = event.target;
            const maquinaId = radio.closest('.switch-3-pos').dataset.maquinaId;
            if (!maquinaId) return;
            
            const commandOn = radio.dataset.commandOn;
            const commandsToTurnOff = radio.dataset.commandsOff?.split(',');
            
            if (commandOn) {
                await sendPlcCommand(maquinaId, commandOn, true, null);
            } else if (commandsToTurnOff) {
                if (commandsToTurnOff.includes('online_llenado')) await sendPlcCommand(maquinaId, 'apagar_llenado_vaciado', false, null);
                if (commandsToTurnOff.includes('online_arriba')) await sendPlcCommand(maquinaId, 'apagar_arriba_abajo', false, null);
            }
        }
    });
}

function subscribeToChanges(container, userRole, userArea) {
    console.log('📡 Suscribiéndose a cambios en tiempo real...');
    
    const channel = db.channel('maquinas-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'maquinas' }, 
            (payload) => {
                const record = payload.new; 
                if (!record) return;

                const machineElement = document.getElementById(`maquina-${record.id}`);
                const isInArea = (userRole === 'Operador' || userRole === 'Supervisor') ? record.area === userArea : true;
                
                if (payload.eventType === 'DELETE' && machineElement) {
                    machineElement.remove();
                } 
                else if (payload.eventType === 'UPDATE' && machineElement && isInArea) {
                    console.log(`🔄 Actualizando máquina: ${record.id}`);
                    
                    const statusSpan = document.getElementById(`estado-${record.id}`);
                    if (statusSpan) {
                        statusSpan.textContent = record.estado || 'Desconocido';
                        statusSpan.className = `badge ${record.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger'}`;
                    }
                    
                    const loteP = document.getElementById(`lote-${record.id}`);
                    if (loteP) {
                        loteP.innerHTML = record.lote_actual ? `<strong>Lote Actual:</strong> ${record.lote_actual}` : '<strong>Lote Actual:</strong> N/A';
                    }
                    
                    if (record.id === 1 && record.controles) {
                        const { online_llenado, online_vaciado, online_arriba, online_abajo, Paro } = record.controles;
                        
                        actualizarBotonesParo(Paro === true);

                        if (online_llenado) document.getElementById('llenado-1').checked = true;
                        else if (online_vaciado) document.getElementById('vaciado-1').checked = true;
                        else document.getElementById('fill-off-1').checked = true;

                        if (online_arriba) document.getElementById('arriba-1').checked = true;
                        else if (online_abajo) document.getElementById('abajo-1').checked = true;
                        else document.getElementById('tray-off-1').checked = true;
                    }
                } 
                else if (payload.eventType === 'INSERT' && !machineElement && isInArea) {
                    container.insertAdjacentHTML('beforeend', createMachineHTML(record, userRole));
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') console.log('✅ Suscrito a cambios en vivo');
            else console.error(`❌ Error en Realtime: ${status}`, err || '');
        });
}

async function initializePanel(session) {
    const panelLoginPrompt = document.getElementById('panel-login-form');
    const panelContenido = document.getElementById('panel-contenido');
    const headerTitle = document.getElementById('header-title');

    try {
        const { data: profile, error } = await db
            .from('perfiles')
            .select('rol, area')
            .eq('id', session.user.id)
            .single();
        
        if (error || !profile) {
            notify.error('Error al cargar tu perfil');
            if (panelLoginPrompt) panelLoginPrompt.style.display = 'block';
            return;
        }

        if (profile.rol === 'Cliente') {
            notify.warning('Acceso denegado. Eres cliente.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return;
        }

        console.log(`✅ Rol: ${profile.rol}, Área: ${profile.area}`);
        
        if (panelLoginPrompt) panelLoginPrompt.style.display = 'none';
        if (panelContenido) panelContenido.style.display = 'block';
        if (headerTitle) headerTitle.textContent = `Panel - ${profile.rol}`;

        const { rol, area } = profile;
        const adminBar = document.getElementById('admin-bar');
        const container = document.getElementById('maquinas-container');

        renderAdminBar(adminBar, rol);
        await loadAndRenderMaquinas(container, rol);
        setupEventListeners(container, rol);
        subscribeToChanges(container, rol, area);
        
    } catch (error) {
        console.error('❌ Error inicializando panel:', error);
        notify.error('Error: ' + error.message);
    }
}

/* ===== 9. GESTOR DE UI GLOBAL ===== */

function actualizarUI(session) {
    const authLinksContainer = document.getElementById('auth-links-container'); 
    const path = window.location.pathname;

    // --- HEADER (GLOBAL) ---
    if (session) {
        if (authLinksContainer) {
            authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Mi Cuenta</a>
                <button id="header-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
            `;
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }
    } else {
        if (authLinksContainer) {
            authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn btn-primary btn-sm">Registrarse</a>
            `;
        }
    }

    // --- LÓGICA DE PÁGINA ESPECÍFICA ---
    if (path.includes('cuenta.html')) {
        const authForms = document.getElementById('auth-forms');
        const userInfo = document.getElementById('user-info');
        
        if (session) {
            if (authForms) authForms.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'grid';
                cargarDatosPerfil(session.user);
                
                const formPerfil = document.getElementById('form-perfil');
                if (formPerfil) {
                    formPerfil.addEventListener('submit', (e) => actualizarPerfil(e, session.user));
                }
                
                const btnTabDatos = document.getElementById('btn-tab-datos');
                const btnTabPedidos = document.getElementById('btn-tab-pedidos');
                if (btnTabDatos) btnTabDatos.addEventListener('click', () => manejarTabsCuenta('datos', session.user.id));
                if (btnTabPedidos) btnTabPedidos.addEventListener('click', () => manejarTabsCuenta('pedidos', session.user.id));
                
                const btnLogout = document.getElementById('btn-logout');
                if (btnLogout) btnLogout.addEventListener('click', manejarLogout);
            }
        } else {
            if (authForms) authForms.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    else if (path.includes('checkout.html')) {
        const checkoutLoginPrompt = document.getElementById('checkout-login-prompt');
        const checkoutContainer = document.getElementById('checkout-container');
        
        if (session) {
            if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'none';
            if (checkoutContainer) {
                checkoutContainer.style.display = 'grid';
                autocompletarDatosEnvio(session.user);
                cargarResumenCheckout();
            }
        } else {
            if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'block';
            if (checkoutContainer) checkoutContainer.style.display = 'none';
        }
    }

    else if (path.includes('panel.html')) {
        if (session) {
            initializePanel(session);
        } else {
            const panelLoginPrompt = document.getElementById('panel-login-form');
            const panelContenido = document.getElementById('panel-contenido');
            if (panelLoginPrompt) panelLoginPrompt.style.display = 'block';
            if (panelContenido) panelContenido.style.display = 'none';
        }
    }
    
    else if (path.includes('admin-personal.html')) {
        if (session) {
            initializeAdminPersonalPage(session.user);
        } else {
            notify.error('Debes iniciar sesión');
            setTimeout(() => {
                window.location.href = 'panel.html';
            }, 1500);
        }
    }
}

/* ===== 10. GESTIÓN DE PERSONAL (ADMIN) ===== */

async function initializeAdminPersonalPage(user) {
    try {
        const { data: profile, error } = await db
            .from('perfiles')
            .select('rol')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            notify.error('Error al verificar permisos');
            throw new Error('No profile found');
        }
        
        const adminRole = profile.rol;
        
        if (adminRole !== 'Sistemas' && adminRole !== 'Lider') {
            notify.warning('No tienes permiso para acceder aquí');
            setTimeout(() => {
                window.location.href = 'panel.html';
            }, 1500);
            return;
        }

        const adminContainer = document.getElementById('admin-personal-container');
        if (adminContainer) adminContainer.style.display = 'block';
        
        const adminBar = document.getElementById('admin-bar');
        if (adminBar) renderAdminBar(adminBar, adminRole);
        
        await loadAllUsersAndProfiles(adminRole, user.id);
        
    } catch (error) {
        console.error('❌ Error inicializando admin:', error);
        notify.error('Error: ' + error.message);
    }
}

async function loadAllUsersAndProfiles(adminRole, currentAdminId) {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="4">Cargando usuarios...</td></tr>';

    try {
        const { data: perfiles, error: profileError } = await db
            .rpc('get_all_user_profiles');
            
        if (profileError) {
            throw new Error('Función RPC no disponible. Por favor, contacta a soporte.');
        }
        
        if (!perfiles || perfiles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No hay usuarios registrados</td></tr>';
            return;
        }

        const rolesDisponibles = ['Cliente', 'Operador', 'Supervisor', 'Mecanico', 'Lider', 'Sistemas'];

        tableBody.innerHTML = perfiles.map(p => {
            const esSistemas = p.rol === 'Sistemas';
            const esMiMismoUsuario = p.id === currentAdminId; 
            const noPuedeEditar = (adminRole === 'Lider' && esSistemas);
            
            return `
                <tr data-user-id="${p.id}">
                    <td>${p.email || 'N/A'}</td>
                    <td>
                        <select class="input-group" data-field="rol" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>
                            ${rolesDisponibles.map(r => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <input type="text" class="input-group" data-field="area" value="${p.area || ''}" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>
                    </td>
                    <td class="btn-group">
                        <button class="btn btn-primary btn-sm btn-save-user" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>
                            <i class="fa-solid fa-save"></i> Guardar
                        </button>
                        <button class="btn btn-danger btn-sm btn-delete-user" ${esSistemas || esMiMismoUsuario || adminRole !== 'Sistemas' ? 'disabled' : ''}>
                            <i class="fa-solid fa-trash"></i> Borrar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-save-user').forEach(btn => {
            btn.addEventListener('click', handleUserUpdate);
        });
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', handleUserDelete);
        });
        
    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">Error: ${error.message}</td></tr>`;
    }
}

async function handleUserUpdate(event) {
    const row = event.target.closest('tr');
    const userId = row.dataset.userId;
    const newRol = row.querySelector('select[data-field="rol"]').value;
    const newArea = row.querySelector('input[data-field="area"]').value;

    console.log(`💾 Actualizando usuario ${userId}: Rol=${newRol}`);
    
    const loadingNotif = notify.loading('Guardando cambios...');
    
    try {
        const { error } = await db
            .from('perfiles')
            .update({ rol: newRol, area: newArea })
            .eq('id', userId);
            
        if (error) throw error;

        notify.hide(loadingNotif);
        notify.success('✅ Perfil actualizado');
        
    } catch (error) {
        console.error('❌ Error:', error);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

async function handleUserDelete(event) {
    const row = event.target.closest('tr');
    const userId = row.dataset.userId;
    
    if (!confirm(`¿Confirmar BORRAR usuario?\nEsta acción es IRREVERSIBLE.`)) {
        return;
    }
    
    console.log(`🗑️ Borrando usuario ${userId}...`);
    
    const loadingNotif = notify.loading('Eliminando usuario...');
    
    try {
        const { data, error } = await db.rpc('delete_user_and_profile', {
            user_id_to_delete: userId
        });
        
        if (error) throw error;

        notify.hide(loadingNotif);
        notify.success('✅ Usuario eliminado');
        row.remove();
        
    } catch (error) {
        console.error('❌ Error:', error);
        notify.hide(loadingNotif);
        notify.error('Error: ' + error.message);
    }
}

/* ===== 11. LÓGICA DE PESTAÑAS DE CUENTA ===== */

function manejarTabsCuenta(tab, userId) {
    const seccionDatos = document.getElementById('seccion-mis-datos');
    const seccionPedidos = document.getElementById('seccion-mis-pedidos');
    const btnDatos = document.getElementById('btn-tab-datos');
    const btnPedidos = document.getElementById('btn-tab-pedidos');

    if (tab === 'datos') {
        if (seccionDatos) seccionDatos.style.display = 'block';
        if (seccionPedidos) seccionPedidos.style.display = 'none';
        if (btnDatos) btnDatos.classList.add('active');
        if (btnPedidos) btnPedidos.classList.remove('active');
    } 
    else if (tab === 'pedidos') {
        if (seccionDatos) seccionDatos.style.display = 'none';
        if (seccionPedidos) seccionPedidos.style.display = 'block';
        if (btnDatos) btnDatos.classList.remove('active');
        if (btnPedidos) btnPedidos.classList.add('active');
        cargarMisPedidos(userId);
    }
}

async function cargarMisPedidos(userId) {
    const container = document.getElementById('pedidos-lista-container');
    if (!container) return; 
    
    container.innerHTML = '<p>Cargando tus pedidos...</p>';

    try {
        const { data: pedidos, error } = await db
            .from('pedidos')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (pedidos.length === 0) {
            container.innerHTML = '<p>No has realizado ningún pedido todavía.</p>';
            return;
        }

        container.innerHTML = pedidos.map(pedido => {
            const fecha = new Date(pedido.created_at).toLocaleDateString('es-MX', { 
                year: 'numeric', month: 'long', day: 'numeric' 
            });
            const itemsHtml = (pedido.items && Array.isArray(pedido.items)) 
                ? pedido.items.map(item => `<p>• ${item.nombre} (x${item.cantidad})</p>`).join('')
                : '<p>Error en items</p>';
            
            return `
                <div class="pedido-card">
                    <div class="pedido-header">
                        <span class="pedido-id">Pedido de ${fecha}</span>
                        <span class="badge badge-warning">${pedido.estado}</span>
                    </div>
                    <div class="order-info">
                        <span>Folio:</span>
                        <span class="info-value">#${pedido.id.substring(0, 8)}...</span>
                    </div>
                    <div class="order-info">
                        <span>Productos:</span>
                        <div class="info-value">${itemsHtml}</div>
                    </div>
                    <div class="order-info">
                        <span>Total:</span>
                        <span class="info-value total">$${pedido.total.toLocaleString('es-MX')}</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error("❌ Error:", error);
        container.innerHTML = '<p style="color:red;">Error al cargar pedidos</p>';
    }
}

/* ===== 12. PUNTO DE ENTRADA (DOMCONTENTLOADED) ===== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando aplicación...');
    
    // Cargar carrito
    const carritoActual = leerCarrito();
    actualizarContadorCarrito(carritoActual);
    
    // Verificar sesión
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session); 
    });
    
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }

    // Listeners de autenticación
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    const formLoginPersonal = document.getElementById('form-login-personal');
    
    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);
    if (formLoginPersonal) formLoginPersonal.addEventListener('submit', manejarLoginPersonal); 

    // Listeners de tienda
    const btnCarrito = document.getElementById('btn-anadir-carrito');
    if (btnCarrito) btnCarrito.addEventListener('click', manejarAnadirAlCarrito);
    
    const formCheckout = document.getElementById('form-checkout');
    if (formCheckout) formCheckout.addEventListener('submit', manejarConfirmarCompra);

    console.log('✅ Aplicación lista');
});