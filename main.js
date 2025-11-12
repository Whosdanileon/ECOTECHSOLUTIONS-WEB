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

const MESSAGES = {
    SUCCESS: {
        LOGIN: '¡Bienvenido!',
        REGISTER: '¡Registro exitoso!',
        PRODUCT_ADDED: '¡Producto añadido al carrito!',
        PROFILE_UPDATED: '¡Datos guardados con éxito!',
        ORDER_PLACED: '¡Gracias por tu compra!',
        USER_UPDATED: '¡Perfil actualizado!'
    },
    ERROR: {
        LOGIN_FAILED: 'Credenciales inválidas',
        REGISTER_FAILED: 'Error en el registro',
        STOCK_INSUFFICIENT: 'Stock insuficiente',
        SESSION_EXPIRED: 'Tu sesión ha expirado',
        PERMISSION_DENIED: 'No tienes permisos'
    }
};

/* Inicializar Supabase */
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ Supabase conectado');

/* ========== SISTEMA DE NOTIFICACIONES ========== */
class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.maxNotifications = 5;
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        if (this.container.children.length >= this.maxNotifications) {
            this.container.firstChild.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            background-color: ${this.getBackgroundColor(type)};
            color: ${this.getTextColor(type)};
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInRight 0.3s ease;
            cursor: pointer;
            min-width: 300px;
        `;

        const icon = this.getIcon(type);
        notification.innerHTML = `
            <span style="font-size: 20px;">${icon}</span>
            <span style="flex: 1; font-weight: 500;">${message}</span>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; 
                           font-size: 18px; cursor: pointer; padding: 0;">×</button>
        `;

        this.container.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return notification;
    }

    getBackgroundColor(type) {
        const colors = {
            success: '#d1fae5',
            error: '#fee2e2',
            warning: '#fef3c7',
            info: '#dbeafe'
        };
        return colors[type] || colors.info;
    }

    getTextColor(type) {
        const colors = {
            success: '#065f46',
            error: '#991b1b',
            warning: '#92400e',
            info: '#1e40af'
        };
        return colors[type] || colors.info;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    success(msg, dur = 5000) { return this.show(msg, 'success', dur); }
    error(msg, dur = 5000) { return this.show(msg, 'error', dur); }
    warning(msg, dur = 5000) { return this.show(msg, 'warning', dur); }
    info(msg, dur = 5000) { return this.show(msg, 'info', dur); }
}

const notify = new NotificationSystem();

/* ========== VALIDADOR DE FORMULARIOS ========== */
class FormValidator {
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validatePhone(phone) {
        return /^[0-9]{10}$/.test(phone.replace(/\D/g, ''));
    }

    validateAddress(address) {
        return address.trim().length >= 10;
    }

    validatePassword(password) {
        return password.length >= 6;
    }

    showError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.classList.add('input-error');
        let errorDiv = field.parentNode.querySelector('.field-error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'field-error-message';
            field.parentNode.insertBefore(errorDiv, field.nextSibling);
        }
        errorDiv.textContent = message;
    }

    clearError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.classList.remove('input-error');
        const errorDiv = field.parentNode.querySelector('.field-error-message');
        if (errorDiv) errorDiv.remove();
    }
}

const validator = new FormValidator();

/* ========== GESTOR DE SESIÓN ========== */
class SessionManager {
    constructor() {
        this.currentUser = null;
        this.currentProfile = null;
        this.sessionTimeout = null;
    }

    async getCurrentSession() {
        const { data: { session } } = await db.auth.getSession();
        return session;
    }

    async loadUserProfile(userId) {
        const { data, error } = await db.from('perfiles').select('*').eq('id', userId).single();
        if (error) {
            console.error('Error cargando perfil:', error);
            return null;
        }
        this.currentProfile = data;
        return data;
    }

    hasPermission(requiredRole) {
        if (!this.currentProfile) return false;
        const hierarchy = { Cliente: 1, Operador: 2, Supervisor: 3, Mecanico: 4, Lider: 5, Sistemas: 6 };
        return (hierarchy[this.currentProfile.rol] || 0) >= (hierarchy[requiredRole] || 0);
    }

    canAccessArea(targetArea) {
        if (!this.currentProfile) return false;
        if (['Lider', 'Sistemas'].includes(this.currentProfile.rol)) return true;
        return this.currentProfile.area === targetArea;
    }

    resetSessionTimeout() {
        if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
        this.sessionTimeout = setTimeout(() => {
            notify.warning('Tu sesión expirará en 1 minuto');
            setTimeout(() => { manejarLogout(); }, 60000);
        }, CONFIG.SESSION_TIMEOUT - 60000);
    }

    clearSession() {
        if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
        this.currentUser = null;
        this.currentProfile = null;
    }
}

const sessionManager = new SessionManager();

/* ========== GESTOR DE CARRITO ========== */
class CartManager {
    constructor() {
        this.cart = this.loadCart();
    }

    loadCart() {
        const json = localStorage.getItem(CONFIG.CART_KEY);
        return json ? JSON.parse(json) : {};
    }

    saveCart() {
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(this.cart));
        this.updateBadge();
    }

    addItem(productId, quantity) {
        if (!productId || quantity <= 0) return false;
        this.cart[productId] = quantity;
        this.saveCart();
        notify.success(MESSAGES.SUCCESS.PRODUCT_ADDED);
        return true;
    }

    removeItem(productId) {
        delete this.cart[productId];
        this.saveCart();
    }

    clearCart() {
        this.cart = {};
        localStorage.removeItem(CONFIG.CART_KEY);
        this.updateBadge();
    }

    getTotalItems() {
        return Object.values(this.cart).reduce((sum, qty) => sum + qty, 0);
    }

    updateBadge() {
        const badge = document.getElementById('carrito-contador');
        if (!badge) return;
        const total = this.getTotalItems();
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline-block' : 'none';
    }

    isEmpty() {
        return Object.keys(this.cart).length === 0;
    }
}

const cartManager = new CartManager();

/* ========== FUNCIONES DE PRODUCTOS ========== */
async function cargarProducto(productoID = 1) {
    console.log(`Cargando producto ${productoID}...`);
    const path = window.location.pathname;
    const esPaginaTienda = path.includes('tienda.html') || path.includes('index.html');

    const { data, error } = await db.from('productos').select('*').eq('id', productoID).single();
    if (error) { console.error('Error:', error.message); return null; }

    if (data && esPaginaTienda) {
        document.getElementById('producto-nombre')?.textContent = data.nombre;
        document.getElementById('producto-precio')?.textContent = `$${data.precio.toLocaleString('es-MX')} MXN`;
        document.getElementById('producto-stock')?.textContent = data.stock_disponible;
        document.getElementById('index-producto-nombre')?.textContent = data.nombre;
        document.getElementById('index-producto-precio')?.textContent = `$${data.precio.toLocaleString('es-MX')}`;
        
        const layout = document.querySelector('.shop-layout');
        if (layout) {
            layout.dataset.productId = data.id;
            layout.dataset.productStock = data.stock_disponible;
        }
    }
    return data;
}

/* ========== FUNCIONES DE AUTENTICACIÓN ========== */
async function manejarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!validator.validateEmail(email)) {
        notify.error('Email inválido');
        return;
    }

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) { notify.error(MESSAGES.ERROR.LOGIN_FAILED); return; }

        const profile = await sessionManager.loadUserProfile(data.user.id);
        if (!profile) { notify.error('Perfil no encontrado'); return; }

        sessionManager.currentUser = data.user;
        sessionManager.resetSessionTimeout();
        notify.success(MESSAGES.SUCCESS.LOGIN);

        setTimeout(() => {
            window.location.href = profile.rol === 'Cliente' ? 'cuenta.html' : 'panel.html';
        }, 500);
    } catch (error) {
        notify.error('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Entrar';
    }
}

async function manejarRegistro(e) {
    e.preventDefault();
    const email = document.getElementById('registro-email').value.trim();
    const password = document.getElementById('registro-password').value;

    if (!validator.validateEmail(email)) { notify.error('Email inválido'); return; }
    if (!validator.validatePassword(password)) { notify.error('Contraseña muy corta'); return; }

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        const { data: authData, error: authError } = await db.auth.signUp({ email, password });
        if (authError) { notify.error(authError.message); return; }

        const { error: profileError } = await db.from('perfiles').insert({
            id: authData.user.id,
            email: authData.user.email,
            rol: CONFIG.ROLES.CLIENTE
        });

        if (profileError) { notify.error('Error: ' + profileError.message); return; }

        notify.success(MESSAGES.SUCCESS.REGISTER);
        e.target.reset();
        setTimeout(() => document.getElementById('form-login')?.scrollIntoView(), 1000);
    } catch (error) {
        notify.error('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Registrarme';
    }
}

async function manejarLoginPersonal(e) {
    e.preventDefault();
    const email = document.getElementById('personal-email').value;
    const password = document.getElementById('personal-password').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { notify.error(error.message); return; }

    window.location.reload();
}

async function manejarLogout() {
    const { error } = await db.auth.signOut();
    if (error) { notify.error('Error al cerrar sesión'); return; }

    sessionManager.clearSession();
    notify.success('Sesión cerrada', 2000);
    setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

/* ========== FUNCIONES DE CARRITO ========== */
function manejarAnadirAlCarrito() {
    const layout = document.querySelector('.shop-layout');
    const input = document.getElementById('cantidad');
    if (!layout || !input) return;

    const productId = parseInt(layout.dataset.productId);
    const stockMax = parseInt(layout.dataset.productStock);
    const cantidad = parseInt(input.value);

    if (isNaN(cantidad) || cantidad <= 0) { notify.error('Cantidad inválida'); return; }
    if (cantidad > stockMax) { notify.error(`Solo hay ${stockMax} disponibles`); return; }

    if (cartManager.addItem(productId, cantidad)) {
        input.value = 1;
    }
}

/* ========== FUNCIONES DE CHECKOUT ========== */
async function cargarResumenCheckout() {
    const carrito = cartManager.cart;
    const [productId, cantidad] = Object.entries(carrito)[0] || [];
    
    if (!productId) {
        document.getElementById('checkout-items').innerHTML = '<p>Carrito vacío</p>';
        return;
    }

    const producto = await cargarProducto(productId);
    if (!producto) { document.getElementById('checkout-items').innerHTML = '<p>Error</p>'; return; }

    const subtotal = producto.precio * cantidad;
    const total = subtotal;

    document.getElementById('checkout-items').innerHTML = 
        `<p><span>${producto.nombre} (x${cantidad})</span><span>$${subtotal.toLocaleString('es-MX')}</span></p>`;
    document.getElementById('checkout-subtotal').textContent = `$${subtotal.toLocaleString('es-MX')}`;
    document.getElementById('checkout-total').textContent = `$${total.toLocaleString('es-MX')}`;
}

async function autocompletarDatosEnvio(user) {
    const { data, error } = await db.from('perfiles').select('nombre_completo, telefono, direccion').eq('id', user.id).single();
    if (!error && data) {
        document.getElementById('checkout-name').value = data.nombre_completo || '';
        document.getElementById('checkout-address').value = data.direccion || '';
        document.getElementById('checkout-phone').value = data.telefono || '';
    }
}

async function manejarConfirmarCompra(e) {
    e.preventDefault();

    const carrito = cartManager.cart;
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    const { data: { user } } = await db.auth.getUser();

    if (!productoID || !user) { notify.error('Carrito vacío o no autenticado'); return; }

    const datosEnvio = {
        nombre: document.getElementById('checkout-name').value,
        direccion: document.getElementById('checkout-address').value,
        telefono: document.getElementById('checkout-phone').value
    };

    if (!datosEnvio.nombre || !datosEnvio.direccion) { notify.error('Completa nombre y dirección'); return; }

    const { data: producto, error: stockError } = await db.from('productos').select('nombre, precio, stock_disponible').eq('id', productoID).single();
    if (stockError) { notify.error('Error: ' + stockError.message); return; }

    const nuevoStock = producto.stock_disponible - cantidad;
    if (nuevoStock < 0) { notify.error('Stock insuficiente'); return; }

    const total = producto.precio * cantidad;
    const itemsPedido = [{ id: productoID, nombre: producto.nombre, cantidad, precio_unitario: producto.precio }];

    const { error: pedidoError } = await db.from('pedidos').insert({
        user_id: user.id,
        items: itemsPedido,
        total: total,
        datos_envio: datosEnvio,
        estado: 'Procesando'
    });

    if (pedidoError) { notify.error('Error: ' + pedidoError.message); return; }

    const { error: updateError } = await db.from('productos').update({ stock_disponible: nuevoStock }).eq('id', productoID);
    if (updateError) { notify.error('Error al actualizar stock'); return; }

    cartManager.clearCart();
    notify.success(MESSAGES.SUCCESS.ORDER_PLACED);
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
}

/* ========== FUNCIONES DE PERFIL ========== */
async function cargarDatosPerfil(user) {
    document.getElementById('profile-email').value = user.email;
    const { data, error } = await db.from('perfiles').select('nombre_completo, telefono, direccion').eq('id', user.id).single();
    if (!error && data) {
        document.getElementById('profile-name').value = data.nombre_completo || '';
        document.getElementById('profile-phone').value = data.telefono || '';
        document.getElementById('profile-address').value = data.direccion || '';
    }
}

async function actualizarPerfil(e, user) {
    e.preventDefault();
    const { error } = await db.from('perfiles').update({
        nombre_completo: document.getElementById('profile-name').value,
        telefono: document.getElementById('profile-phone').value,
        direccion: document.getElementById('profile-address').value
    }).eq('id', user.id);

    if (error) { notify.error('Error: ' + error.message); }
    else { notify.success(MESSAGES.SUCCESS.PROFILE_UPDATED); }
}

/* ========== FUNCIONES DE PEDIDOS ========== */
function manejarTabsCuenta(tab, userId) {
    const datosDiv = document.getElementById('seccion-mis-datos');
    const pedidosDiv = document.getElementById('seccion-mis-pedidos');
    const btnDatos = document.getElementById('btn-tab-datos');
    const btnPedidos = document.getElementById('btn-tab-pedidos');

    if (tab === 'datos') {
        datosDiv.style.display = 'block';
        pedidosDiv.style.display = 'none';
        btnDatos.classList.add('active');
        btnPedidos.classList.remove('active');
    } else {
        datosDiv.style.display = 'none';
        pedidosDiv.style.display = 'block';
        btnDatos.classList.remove('active');
        btnPedidos.classList.add('active');
        cargarMisPedidos(userId);
    }
}

async function cargarMisPedidos(userId) {
    const container = document.getElementById('pedidos-lista-container');
    container.innerHTML = '<p>Cargando...</p>';

    const { data: pedidos, error } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<p>Error al cargar</p>'; return; }
    if (pedidos.length === 0) { container.innerHTML = '<p>Sin pedidos</p>'; return; }

    container.innerHTML = pedidos.map(p => {
        const fecha = new Date(p.created_at).toLocaleDateString('es-MX');
        const items = (p.items && Array.isArray(p.items)) ? p.items.map(i => `<p>${i.nombre} (x${i.cantidad})</p>`).join('') : '';
        return `
            <div class="pedido-card">
                <div class="pedido-header">
                    <span class="pedido-id">Pedido de ${fecha}</span>
                    <span class="badge badge-warning">${p.estado}</span>
                </div>
                <div class="order-info"><span>Items:</span><div class="info-value">${items}</div></div>
                <div class="order-info"><span>Total:</span><span class="info-value total">$${p.total.toLocaleString('es-MX')}</span></div>
            </div>
        `;
    }).join('');
}

/* ========== FUNCIONES DEL PANEL ========== */
function renderAdminBar(adminBar, userRole) {
    let html = '';
    if (['Lider', 'Sistemas'].includes(userRole)) {
        html = `<h4>Panel Admin</h4><a href="admin-personal.html" class="btn btn-secondary"><i class="fa-solid fa-users-cog"></i> Administrar Personal</a>`;
    }
    adminBar.innerHTML = html;
    adminBar.style.display = html ? 'flex' : 'none';
}

async function getMaquinas() {
    const { data, error } = await db.from('maquinas').select('*');
    if (error) throw new Error(error.message);
    return data;
}

async function loadAndRenderMaquinas(container, userRole) {
    container.innerHTML = '<p>Cargando...</p>';
    try {
        const maquinas = await getMaquinas();
        container.innerHTML = '';
        if (maquinas.length > 0) {
            maquinas.forEach(m => container.insertAdjacentHTML('beforeend', createMachineHTML(m, userRole)));
        } else {
            container.innerHTML = '<p>Sin máquinas</p>';
        }
    } catch (error) {
        container.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function createMachineHTML(maquina, userRole) {
    const canControl = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);
    const estadoClass = maquina.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger';

    let controlesHTML = '';
    if (canControl && maquina.id === 1 && maquina.controles) {
        const { online_llenado, online_vaciado, online_arriba, online_abajo } = maquina.controles;
        const fillState = online_llenado ? 'llenado' : (online_vaciado ? 'vaciado' : 'fill-off');
        const trayState = online_arriba ? 'arriba' : (online_abajo ? 'abajo' : 'tray-off');

        controlesHTML = `
            <div class="controles">
                <p><strong>Ciclo:</strong></p>
                <button class="btn btn-primary btn-control" data-command="Inicio" data-value="true" data-maquina-id="1">Iniciar</button>
                <button class="btn btn-danger btn-control" data-command="Paro" data-value="true" data-maquina-id="1">Paro</button>
            </div>
            <div class="controles-manuales">
                <p><strong>Llenado/Vaciado:</strong></p>
                <div class="switch-3-pos" data-maquina-id="1">
                    <input type="radio" id="llenado-1" name="switch-fill" ${fillState === 'llenado' ? 'checked' : ''}>
                    <label for="llenado-1">Llenar</label>
                    <input type="radio" id="fill-off-1" name="switch-fill" ${fillState === 'fill-off' ? 'checked' : ''}>
                    <label for="fill-off-1">OFF</label>
                    <input type="radio" id="vaciado-1" name="switch-fill" ${fillState === 'vaciado' ? 'checked' : ''}>
                    <label for="vaciado-1">Vaciar</label>
                </div>
            </div>
        `;
    }

    return `
        <div class="card maquina" id="maquina-${maquina.id}">
            <h3>${maquina.nombre || 'Máquina sin nombre'}</h3>
            <p><strong>Área:</strong> ${maquina.area || 'N/A'}</p>
            <p><strong>Estado:</strong> <span class="badge ${estadoClass}">${maquina.estado || 'Desconocido'}</span></p>
            ${controlesHTML}
        </div>
    `;
}

async function sendPlcCommand(maquinaId, commandName, commandValue, button) {
    const originalText = button?.textContent;
    if (button) { button.disabled = true; button.innerHTML = '<span class="spinner"></span>'; }

    const { data: maquina, error: fetchError } = await db.from('maquinas').select('controles, estado').eq('id', maquinaId).single();
    if (fetchError) { notify.error('Error: ' + fetchError.message); return; }

    const newControls = { ...(maquina.controles || {}) };
    let newState = maquina.estado;

    if (commandName === 'Inicio') {
        newState = 'En Ciclo';
        newControls['Inicio'] = true;
    }

    const { error: updateError } = await db.from('maquinas').update({ controles: newControls, estado: newState }).eq('id', maquinaId);
    if (updateError) { notify.error('Error: ' + updateError.message); }

    if (button) { button.disabled = false; button.textContent = originalText; }
}

function setupPanelEventListeners(container, userRole) {
    const canControl = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);
    if (!canControl) return;

    container.addEventListener('click', async (event) => {
        const button = event.target.closest('button.btn-control');
        if (button && !button.disabled) {
            const command = button.dataset.command;
            const value = button.dataset.value === 'true';
            const maquinaId = button.dataset.maquinaId;
            if (command && maquinaId) await sendPlcCommand(maquinaId, command, value, button);
        }
    });
}

function subscribeToChanges(container, userRole, userArea) {
    console.log('📡 Suscribiendo a cambios...');
    let reconnectAttempts = 0;

    const setupSub = () => {
        db.channel('maquinas-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, (payload) => {
                reconnectAttempts = 0;
                const record = payload.new || payload.old;
                if (!record) return;

                const machineEl = document.getElementById(`maquina-${record.id}`);
                const isInArea = ['Operador', 'Supervisor'].includes(userRole) ? record.area === userArea : true;

                if (payload.eventType === 'UPDATE' && machineEl && isInArea) {
                    const statusSpan = document.getElementById(`estado-${record.id}`);
                    if (statusSpan) {
                        statusSpan.textContent = record.estado || 'Desconocido';
                        statusSpan.className = `badge ${record.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger'}`;
                    }
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Conectado a cambios');
                } else if (status === 'CHANNEL_ERROR' && reconnectAttempts < 3) {
                    reconnectAttempts++;
                    setTimeout(setupSub, 2000);
                }
            });
    };

    setupSub();
}

async function initializePanel(session) {
    const { data: profile, error } = await db.from('perfiles').select('rol, area').eq('id', session.user.id).single();
    if (error || !profile || profile.rol === 'Cliente') {
        alert('Acceso denegado');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('panel-login-form').style.display = 'none';
    document.getElementById('panel-contenido').style.display = 'block';

    const adminBar = document.getElementById('admin-bar');
    const container = document.getElementById('maquinas-container');

    renderAdminBar(adminBar, profile.rol);
    await loadAndRenderMaquinas(container, profile.rol);
    setupPanelEventListeners(container, profile.rol);
    subscribeToChanges(container, profile.rol, profile.area);
}

/* ========== GESTOR DE UI GLOBAL ========== */
function actualizarUI(session) {
    const authLinksContainer = document.getElementById('auth-links-container');
    const path = window.location.pathname;

    if (session) {
        authLinksContainer.innerHTML = `
            <a href="cuenta.html" class="nav-link">Mi Cuenta</a>
            <button id="header-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
        `;
        document.getElementById('header-logout')?.addEventListener('click', manejarLogout);
    } else {
        authLinksContainer.innerHTML = `
            <a href="cuenta.html" class="nav-link">Iniciar Sesión</a>
            <a href="cuenta.html" class="btn btn-primary btn-sm">Registrarse</a>
        `;
    }

    if (path.includes('cuenta.html')) {
        const authForms = document.getElementById('auth-forms');
        const userInfo = document.getElementById('user-info');
        if (session) {
            authForms.style.display = 'none';
            userInfo.style.display = 'grid';
            cargarDatosPerfil(session.user);
            document.getElementById('form-perfil')?.addEventListener('submit', (e) => actualizarPerfil(e, session.user));
            document.getElementById('btn-tab-datos')?.addEventListener('click', () => manejarTabsCuenta('datos', session.user.id));
            document.getElementById('btn-tab-pedidos')?.addEventListener('click', () => manejarTabsCuenta('pedidos', session.user.id));
        } else {
            authForms.style.display = 'block';
            userInfo.style.display = 'none';
        }
    } else if (path.includes('checkout.html')) {
        const checkoutPrompt = document.getElementById('checkout-login-prompt');
        const checkoutContainer = document.getElementById('checkout-container');
        if (session) {
            checkoutPrompt.style.display = 'none';
            checkoutContainer.style.display = 'grid';
            autocompletarDatosEnvio(session.user);
            cargarResumenCheckout();
        } else {
            checkoutPrompt.style.display = 'block';
            checkoutContainer.style.display = 'none';
        }
    } else if (path.includes('panel.html')) {
        if (session) {
            initializePanel(session);
        } else {
            document.getElementById('panel-login-form').style.display = 'block';
            document.getElementById('panel-contenido').style.display = 'none';
        }
    }
}

/* ========== ENTRADA PRINCIPAL ========== */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando ECOTECHSOLUTIONS...');

    cartManager.updateBadge();

    const session = await sessionManager.getCurrentSession();
    if (session) {
        await sessionManager.loadUserProfile(session.user.id);
        sessionManager.resetSessionTimeout();
        sessionManager.currentUser = session.user;
    }

    actualizarUI(session);

    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html')) {
        await cargarProducto();
    }

    // Event listeners
    document.getElementById('form-login')?.addEventListener('submit', manejarLogin);
    document.getElementById('form-registro')?.addEventListener('submit', manejarRegistro);
    document.getElementById('form-login-personal')?.addEventListener('submit', manejarLoginPersonal);
    document.getElementById('btn-anadir-carrito')?.addEventListener('click', manejarAnadirAlCarrito);
    document.getElementById('form-checkout')?.addEventListener('submit', manejarConfirmarCompra);
    document.getElementById('btn-logout')?.addEventListener('click', manejarLogout);

    // Escuchar cambios globales de sesión
    db.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_IN' && !sessionManager.currentUser) {
            window.location.reload();
        }
        if (event === 'SIGNED_OUT' && sessionManager.currentUser) {
            sessionManager.clearSession();
            actualizarUI(null);
        }
    });

    // Resetear timeout en actividad
    document.addEventListener('mousemove', () => {
        if (sessionManager.currentUser) sessionManager.resetSessionTimeout();
    });

    console.log('✅ ECOTECHSOLUTIONS iniciado correctamente');
});