/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS (VERSION CORREGIDA INDEX + PANEL)
 * ========================================================================== */

/* ==========================================================================
 * 1. CONFIGURACIÓN CENTRALIZADA
 * ========================================================================== */
const CONFIG = {
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    ROLES_ADMIN: ['Sistemas', 'Lider'],
    ROLES_STAFF: ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador'],
    NOTIF_DURATION: 4000,
    SIMULATION_INTERVAL: 3500
};

const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System: Online');

/* ==========================================================================
 * 2. UTILIDADES Y UI GLOBAL
 * ========================================================================== */

class NotificationSystem {
    constructor() { this.container = this.createContainer(); }
    createContainer() {
        let el = document.getElementById('notification-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'notification-container';
            el.className = 'notification-container';
            document.body.appendChild(el);
        }
        return el;
    }
    show(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `notification notification-${type}`;
        div.innerHTML = `<div class="notif-icon">${this.getIcon(type)}</div><div class="notif-body">${msg}</div><button class="notif-close">&times;</button>`;
        div.querySelector('.notif-close').onclick = () => this.close(div);
        this.container.appendChild(div);
        requestAnimationFrame(() => div.classList.add('show'));
        if (type !== 'loading') setTimeout(() => this.close(div), CONFIG.NOTIF_DURATION);
        return div;
    }
    close(div) { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }
    getIcon(type) {
        const map = { success: '<i class="fa-solid fa-check"></i>', error: '<i class="fa-solid fa-triangle-exclamation"></i>', warning: '<i class="fa-solid fa-circle-exclamation"></i>', loading: '<i class="fa-solid fa-spinner fa-spin"></i>', info: '<i class="fa-solid fa-info"></i>' };
        return map[type] || map.info;
    }
    success(m) { return this.show(m, 'success'); }
    error(m) { return this.show(m, 'error'); }
    warning(m) { return this.show(m, 'warning'); }
    loading(m) { return this.show(m, 'loading'); }
}
const notify = new NotificationSystem();

const Validator = {
    validate: (form) => {
        if (!form) return false;
        let valid = true;
        form.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
        form.querySelectorAll('[required]').forEach(input => { if (!input.value.trim()) { input.classList.add('input-error'); valid = false; } });
        return valid;
    }
};

/* ==========================================================================
 * 3. AUTENTICACIÓN Y PERFIL
 * ========================================================================== */

async function handleLogin(e) {
    e.preventDefault();
    if (!Validator.validate(e.target)) return;
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const load = notify.loading('Verificando...');
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    notify.close(load);
    if (error) notify.error(error.message);
    else { notify.success('Bienvenido'); checkRedirect(data.user.id); }
}

async function handleRegister(e) {
    e.preventDefault();
    if (!Validator.validate(e.target)) return;
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;
    const load = notify.loading('Registrando...');
    const { error } = await db.auth.signUp({ email, password, options: { data: { nombre_completo: 'Nuevo Usuario' } } });
    notify.close(load);
    if (error) notify.error(error.message);
    else notify.success('Cuenta creada. Inicia sesión.');
}

async function handleLogout() {
    const load = notify.loading('Cerrando sesión...');
    await db.auth.signOut();
    notify.close(load);
    window.location.href = 'index.html';
}

async function checkRedirect(userId) {
    const { data } = await db.from('perfiles').select('rol').eq('id', userId).single();
    if (data && CONFIG.ROLES_STAFF.includes(data.rol)) window.location.href = 'panel.html';
    else window.location.href = 'cuenta.html';
}

async function loadUserProfile(user) {
    const { data: perfil } = await db.from('perfiles').select('*').eq('id', user.id).single();
    if (perfil) {
        const map = { 'nombre_completo': 'profile-name', 'telefono': 'profile-phone', 'direccion': 'profile-address' };
        Object.keys(map).forEach(key => { if(document.getElementById(map[key])) document.getElementById(map[key]).value = perfil[key] || ''; });
        if(document.getElementById('profile-email')) document.getElementById('profile-email').value = user.email;
    }
    const { data: pedidos } = await db.from('pedidos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    const list = document.getElementById('pedidos-lista-container');
    if (list) {
        list.innerHTML = (pedidos && pedidos.length) ? pedidos.map(p => `
            <div class="pedido-card"><div class="p-header"><strong>#${p.id}</strong><span class="badge badge-primary">${p.estado}</span></div>
            <div class="p-body"><p>$${p.total.toLocaleString()}</p></div></div>`).join('') : '<p>Sin pedidos.</p>';
    }
}

async function saveUserProfile(e, user) {
    e.preventDefault();
    const updates = { nombre_completo: document.getElementById('profile-name').value, telefono: document.getElementById('profile-phone').value, direccion: document.getElementById('profile-address').value };
    const load = notify.loading('Guardando...');
    const { error } = await db.from('perfiles').update(updates).eq('id', user.id);
    notify.close(load);
    if (!error) notify.success('Guardado'); else notify.error('Error');
}

/* ==========================================================================
 * 4. TIENDA Y CHECKOUT
 * ========================================================================== */

const Cart = {
    get: () => JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {},
    set: (cart) => { localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart)); Cart.updateCounter(); },
    add: () => {
        const layout = document.querySelector('.shop-layout');
        const input = document.getElementById('cantidad');
        if (!layout || !input) return;
        const pid = layout.dataset.pid, max = parseInt(layout.dataset.stock), qty = parseInt(input.value);
        if (qty > max) return notify.warning(`Solo ${max} disponibles`);
        const cart = Cart.get();
        cart[pid] = (cart[pid] || 0) + qty;
        Cart.set(cart);
        notify.success('Añadido al carrito');
    },
    updateCounter: () => {
        const count = Object.values(Cart.get()).reduce((a, b) => a + b, 0);
        const el = document.getElementById('carrito-contador');
        if (el) { el.textContent = count; el.style.display = count > 0 ? 'inline-block' : 'none'; }
    }
};

// --- [CORRECCIÓN] Función mejorada para detectar si estamos en Index o Tienda ---
async function loadProductDetail(id = 1) {
    const elTienda = document.getElementById('producto-nombre');
    const elIndex = document.getElementById('index-producto-nombre');

    // Si no existe NINGUNO de los dos elementos, no estamos en una página que necesite producto
    if (!elTienda && !elIndex) return;

    console.log(`📦 Cargando producto para ID: ${id}`);
    const { data } = await db.from('productos').select('*').eq('id', id).single();
    
    if (data) {
        // Actualizar elementos de TIENDA.HTML
        if (elTienda) {
            elTienda.textContent = data.nombre;
            document.getElementById('producto-precio').textContent = `$${data.precio} MXN`;
            document.getElementById('producto-stock').textContent = data.stock_disponible;
            const layout = document.querySelector('.shop-layout');
            if(layout) { layout.dataset.pid = data.id; layout.dataset.stock = data.stock_disponible; }
        }

        // Actualizar elementos de INDEX.HTML
        if (elIndex) {
            elIndex.textContent = data.nombre;
            document.getElementById('index-producto-precio').textContent = `$${data.precio}`;
        }
    }
}

async function initCheckout(user) {
    const cart = Cart.get();
    const container = document.getElementById('checkout-items');
    if (!Object.keys(cart).length) { container.innerHTML = '<p>Vacío</p>'; return; }
    
    const { data: perfil } = await db.from('perfiles').select('*').eq('id', user.id).single();
    if (perfil) {
        if(document.getElementById('checkout-name')) document.getElementById('checkout-name').value = perfil.nombre_completo || '';
        if(document.getElementById('checkout-phone')) document.getElementById('checkout-phone').value = perfil.telefono || '';
        if(document.getElementById('checkout-address')) document.getElementById('checkout-address').value = perfil.direccion || '';
    }

    let total = 0, html = '';
    for (const [pid, qty] of Object.entries(cart)) {
        const { data } = await db.from('productos').select('*').eq('id', pid).single();
        if (data) {
            const sub = data.precio * qty; total += sub;
            html += `<div class="checkout-row"><span>${data.nombre} x${qty}</span><span>$${sub.toLocaleString()}</span></div>`;
        }
    }
    container.innerHTML = html;
    document.getElementById('checkout-total').textContent = `$${total.toLocaleString()}`;
    document.getElementById('form-checkout').onsubmit = (e) => processOrder(e, user, cart, total);
}

async function processOrder(e, user, cart, total) {
    e.preventDefault();
    const load = notify.loading('Procesando...');
    try {
        const items = [];
        for (const [pid, qty] of Object.entries(cart)) {
            const { data } = await db.from('productos').select('*').eq('id', pid).single();
            if (data.stock_disponible < qty) throw new Error(`Stock insuficiente: ${data.nombre}`);
            items.push({ id: pid, nombre: data.nombre, cantidad: qty });
        }
        const envio = { nombre: document.getElementById('checkout-name').value, direccion: document.getElementById('checkout-address').value };
        const { error } = await db.from('pedidos').insert({ user_id: user.id, items, total, datos_envio: envio });
        if (error) throw error;
        
        for (const i of items) {
            const { data } = await db.from('productos').select('stock_disponible').eq('id', i.id).single();
            await db.from('productos').update({ stock_disponible: data.stock_disponible - i.cantidad }).eq('id', i.id);
        }
        notify.close(load); notify.success('¡Pedido Exitoso!');
        Cart.set({}); setTimeout(() => window.location.href = 'cuenta.html', 2000);
    } catch (err) { notify.close(load); notify.error(err.message); }
}

/* ==========================================================================
 * 5. ADMIN PERSONAL
 * ========================================================================== */

async function initAdminPanel(user) {
    const { data } = await db.from('perfiles').select('rol').eq('id', user.id).single();
    if (!CONFIG.ROLES_ADMIN.includes(data.rol)) return;
    const tbody = document.getElementById('user-table-body');
    const { data: users } = await db.rpc('get_all_user_profiles');
    if(tbody && users) {
        tbody.innerHTML = users.map(u => `
            <tr data-uid="${u.id}">
                <td>${u.email}</td>
                <td><select class="form-input role-select">${CONFIG.ROLES_STAFF.concat(['Cliente']).map(r => `<option ${u.rol===r?'selected':''}>${r}</option>`).join('')}</select></td>
                <td><input class="form-input area-input" value="${u.area||''}"></td>
                <td><button class="btn-icon btn-save"><i class="fa-solid fa-save"></i></button></td>
            </tr>`).join('');
        
        tbody.onclick = async (e) => {
            const btn = e.target.closest('.btn-save');
            if(!btn) return;
            const row = btn.closest('tr');
            const updates = { rol: row.querySelector('.role-select').value, area: row.querySelector('.area-input').value };
            await db.from('perfiles').update(updates).eq('id', row.dataset.uid);
            notify.success('Actualizado');
        }
    }
}

/* ==========================================================================
 * 6. PANEL INDUSTRIAL (LÓGICA PLC)
 * ========================================================================== */

// Simulación
setInterval(async () => {
    if (!window.location.pathname.includes('panel.html')) return;
    const { data: m2 } = await db.from('maquinas').select('*').eq('id', 2).single();
    if (m2 && m2.controles) {
        let temp = m2.controles.escalda_db || 20;
        if (m2.controles.startremoto) {
            let nueva = temp + (Math.random() * 2);
            if (nueva > 98) nueva = 98;
            await db.from('maquinas').update({ controles: { ...m2.controles, escalda_db: parseFloat(nueva.toFixed(1)) } }).eq('id', 2);
        } else if (temp > 25) {
            await db.from('maquinas').update({ controles: { ...m2.controles, escalda_db: parseFloat((temp - 1).toFixed(1)) } }).eq('id', 2);
        }
    }
}, CONFIG.SIMULATION_INTERVAL);

async function initIndustrialPanel(user) {
    const { data: perfil } = await db.from('perfiles').select('rol').eq('id', user.id).single();
    if (!CONFIG.ROLES_STAFF.includes(perfil.rol)) return;
    
    const container = document.getElementById('maquinas-container');
    await renderMachines(container, perfil.rol);
    
    db.channel('planta').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => updateMachineDOM(payload.new)).subscribe();
}

async function renderMachines(container, rol) {
    const { data: maquinas } = await db.from('maquinas').select('*').order('id');
    container.innerHTML = '';
    maquinas.forEach(m => {
        container.insertAdjacentHTML('beforeend', buildMachineCard(m, rol));
        if(m.id === 1) updateLavadoraVisuals(m);
    });
}

function buildMachineCard(m, rol) {
    const canControl = ['Sistemas', 'Lider', 'Supervisor'].includes(rol);
    
    // M1: Lavadora
    if (m.id === 1) {
        let controls = canControl ? `
            <div class="plc-controls">
                <div class="control-row"><span>Ciclo:</span><div class="btn-group">
                    <button class="btn btn-sm btn-light" onclick="plcCommand(1, 'Inicio')"><i class="fa-solid fa-play"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="plcCommand(1, 'Paro')"><i class="fa-solid fa-stop"></i></button>
                </div></div>
                <div class="control-row"><span>Tanque:</span><div class="toggle-switch">
                    <input type="radio" name="tk" id="tk-in" onclick="plcSwitch(1, 'online_llenado')"><label for="tk-in">In</label>
                    <input type="radio" name="tk" id="tk-off" onclick="plcSwitch(1, 'fill_off')"><label for="tk-off">Off</label>
                    <input type="radio" name="tk" id="tk-out" onclick="plcSwitch(1, 'online_vaciado')"><label for="tk-out">Out</label>
                </div></div>
                <div class="control-row"><span>Charola:</span><div class="toggle-switch">
                    <input type="radio" name="ch" id="ch-up" onclick="plcSwitch(1, 'online_arriba')"><label for="ch-up">Up</label>
                    <input type="radio" name="ch" id="ch-off" onclick="plcSwitch(1, 'tray_off')"><label for="ch-off">Off</label>
                    <input type="radio" name="ch" id="ch-dn" onclick="plcSwitch(1, 'online_abajo')"><label for="ch-dn">Dn</label>
                </div></div>
            </div>` : '';
        return `<div class="card machine-card" id="machine-1"><div class="m-header"><h4><i class="fa-solid fa-soap"></i> ${m.nombre}</h4><span class="status-badge ${m.estado==='En Ciclo'?'on':'off'}">${m.estado}</span></div><div class="m-body"><p class="m-area">${m.area}</p>${controls}</div></div>`;
    }
    // M2: Deshidratadora
    else if (m.id === 2) {
        const t = m.controles.escalda_db || 0, on = m.controles.startremoto;
        let controls = canControl ? `<div class="plc-controls"><p>Control Remoto (DB2):</p><div class="btn-group full-width"><button class="btn ${on?'btn-secondary':'btn-login'}" onclick="plcRemote(2, 'Start')">START</button><button class="btn btn-danger" onclick="plcRemote(2, 'Stop')">STOP</button></div></div>` : '';
        return `<div class="card machine-card" id="machine-2"><div class="m-header"><h4><i class="fa-solid fa-fire-burner"></i> ${m.nombre}</h4><span class="status-badge ${on?'on':'off'}">${on?'ON':'OFF'}</span></div><div class="m-body"><div class="thermometer"><span id="temp-val-2" class="big-number">${t.toFixed(1)} °C</span><div class="progress-bg"><div id="temp-bar-2" class="progress-fill" style="width:${Math.min(t,100)}%"></div></div></div>${controls}</div></div>`;
    }
    return `<div class="card machine-card"><div class="m-header"><h4>${m.nombre}</h4><span class="status-badge warning">Mant.</span></div><div class="m-body"><p class="m-area">${m.area}</p></div></div>`;
}

/* --- FUNCIONES DE CONTROL (GLOBALES) --- */

async function plcCommand(id, action) {
    notify.loading('Enviando...');
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
    let c = data.controles;
    if (action === 'Inicio') { c.Inicio = true; c.Paro = false; }
    else { c.Inicio = false; c.Paro = true; c.online_llenado=false; c.online_vaciado=false; c.online_arriba=false; c.online_abajo=false; }
    await db.from('maquinas').update({ controles: c, estado: action === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id);
    notify.success('Comando OK');
}

async function plcSwitch(id, key) {
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
    let c = data.controles;
    if(['online_llenado','online_vaciado','fill_off'].includes(key)) { c.online_llenado = (key==='online_llenado'); c.online_vaciado = (key==='online_vaciado'); }
    else { c.online_arriba = (key==='online_arriba'); c.online_abajo = (key==='online_abajo'); }
    await db.from('maquinas').update({ controles: c }).eq('id', id);
}

async function plcRemote(id, action) {
    notify.loading('Señal enviada...');
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
    let c = data.controles;
    c.startremoto = (action === 'Start');
    c.Paroremoto = (action === 'Stop');
    await db.from('maquinas').update({ controles: c }).eq('id', id);
}

function updateMachineDOM(m) {
    if (m.id === 1) {
        updateLavadoraVisuals(m);
        document.querySelector('#machine-1 .status-badge').textContent = m.estado;
        document.querySelector('#machine-1 .status-badge').className = `status-badge ${m.estado==='En Ciclo'?'on':'off'}`;
    } else if (m.id === 2) {
        document.getElementById('temp-val-2').textContent = `${m.controles.escalda_db.toFixed(1)} °C`;
        document.getElementById('temp-bar-2').style.width = `${Math.min(m.controles.escalda_db, 100)}%`;
        document.querySelector('#machine-2 .status-badge').textContent = m.controles.startremoto ? 'ON' : 'OFF';
        document.querySelector('#machine-2 .status-badge').className = `status-badge ${m.controles.startremoto?'on':'off'}`;
    }
}

function updateLavadoraVisuals(m) {
    const c = m.controles;
    if(document.getElementById('tk-in')) {
        document.getElementById('tk-in').checked = c.online_llenado;
        document.getElementById('tk-out').checked = c.online_vaciado;
        if(!c.online_llenado && !c.online_vaciado) document.getElementById('tk-off').checked = true;
        document.getElementById('ch-up').checked = c.online_arriba;
        document.getElementById('ch-dn').checked = c.online_abajo;
        if(!c.online_arriba && !c.online_abajo) document.getElementById('ch-off').checked = true;
    }
}

// --- EXPOSICIÓN GLOBAL (Necesario para HTML onclick) ---
window.plcCommand = plcCommand;
window.plcSwitch = plcSwitch;
window.plcRemote = plcRemote;
window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + tabName).classList.add('active');
};

/* ==========================================================================
 * 8. INITIALIZATION
 * ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    Cart.updateCounter();
    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    // Header Global
    const header = document.getElementById('auth-links-container');
    if (header) {
        header.innerHTML = user 
            ? `<a href="cuenta.html" class="nav-link">Mi Cuenta</a> <button id="header-logout" class="btn-nav">Salir</button>`
            : `<a href="cuenta.html" class="nav-link">Acceder</a>`;
        if(user) document.getElementById('header-logout').onclick = handleLogout;
    }

    // Routing
    if (path.includes('index') || path.includes('tienda') || path === '/' || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        loadProductDetail(1);
        const btn = document.getElementById('btn-anadir-carrito');
        if(btn) btn.onclick = Cart.add;
    }
    
    if (path.includes('checkout')) {
        if(user) {
            document.getElementById('checkout-login-prompt').style.display = 'none';
            document.getElementById('checkout-container').style.display = 'grid';
            initCheckout(user);
        } else {
            document.getElementById('checkout-login-prompt').style.display = 'block';
            document.getElementById('checkout-container').style.display = 'none';
        }
    }

    if (path.includes('cuenta')) {
        if(user) {
            document.getElementById('auth-forms').style.display = 'none';
            document.getElementById('user-info').style.display = 'grid';
            loadUserProfile(user);
            document.getElementById('form-perfil').onsubmit = (e) => saveUserProfile(e, user);
        } else {
            document.getElementById('auth-forms').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('form-login').onsubmit = handleLogin;
            document.getElementById('form-registro').onsubmit = handleRegister;
        }
    }

    if (path.includes('panel')) {
        const overlay = document.getElementById('login-overlay');
        const dash = document.getElementById('dashboard-layout');
        if (user) {
            overlay.style.display = 'none';
            dash.style.display = 'flex';
            const { data: p } = await db.from('perfiles').select('rol, nombre_completo').eq('id', user.id).single();
            document.getElementById('sidebar-username').textContent = p.nombre_completo || 'Usuario';
            document.getElementById('sidebar-role').textContent = p.rol;
            document.getElementById('btn-logout-panel').onclick = handleLogout;
            
            initIndustrialPanel(user);
            initAdminPanel(user);
        } else {
            overlay.style.display = 'flex';
            dash.style.display = 'none';
            document.getElementById('panel-login-form').onsubmit = async (e) => {
                e.preventDefault();
                const em = document.getElementById('login-email').value;
                const ps = document.getElementById('login-password').value;
                const { error } = await db.auth.signInWithPassword({ email:em, password:ps });
                if(!error) window.location.reload(); else notify.error('Credenciales incorrectas');
            };
        }
    }
});