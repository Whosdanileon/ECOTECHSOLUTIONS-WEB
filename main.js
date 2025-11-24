/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v21 (OPTIMIZED & SECURE)
 * ========================================================================== */

/* 1. CONFIGURACIÓN Y ESTADO */
const CONFIG = {
    // NOTA: Asegúrate de tener Row Level Security (RLS) activado en Supabase para proteger los datos.
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    ROLES: {
        SYS: ['Sistemas'],
        ADMIN: ['Sistemas', 'Lider'],
        STAFF: ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador']
    }
};

// Estado global para suscripciones
const State = {
    realtimeSubscription: null
};

// Inicialización de Supabase
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System: Online & Secure');

/* ==========================================================================
 * 2. UTILIDADES Y SEGURIDAD
 * ========================================================================== */
const notify = {
    show: (msg, type = 'info') => {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        const div = document.createElement('div');
        div.className = `notification notification-${type} show`;
        
        let icon = '<i class="fa-solid fa-info"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-check"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-times"></i>';
        if (type === 'loading') icon = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        // Sanitizamos el mensaje por seguridad si es texto dinámico
        div.innerHTML = `<div class="notification-icon">${icon}</div><div class="notification-content">${msg}</div>`;
        container.appendChild(div);

        if (type !== 'loading') {
            setTimeout(() => {
                div.classList.remove('show');
                setTimeout(() => div.remove(), 300);
            }, 4000);
        }
        return div;
    },
    success: (m) => notify.show(m, 'success'),
    error: (m) => notify.show(m, 'error'),
    loading: (m) => notify.show(m, 'loading'),
    close: (div) => {
        if (div) {
            div.classList.remove('show');
            setTimeout(() => div.remove(), 300);
        }
    }
};

const Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val),
    
    formatTime: (dateStr) => {
        if (!dateStr) return '--:--';
        return new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    },

    validate: (form) => {
        let valid = true;
        form.querySelectorAll('[required]').forEach(i => {
            if (!i.value.trim()) {
                i.classList.add('input-error');
                valid = false;
            } else {
                i.classList.remove('input-error');
            }
        });
        return valid;
    },

    // PREVENCIÓN DE XSS: Escapa caracteres peligrosos antes de insertar HTML
    escapeHtml: (text) => {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, (m) => map[m]);
    }
};

/* ==========================================================================
 * 3. FUNCIONES GLOBALES (UI)
 * ========================================================================== */
window.switchTab = function(tabName) {
    // UI Feedback inmediato
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tabName);
    if (view) view.classList.add('active');
};

/* ==========================================================================
 * 4. AUTENTICACIÓN
 * ========================================================================== */
const Auth = {
    login: async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');

        if (!emailInput || !passInput) return;

        const load = notify.loading('Iniciando sesión...');
        const { data, error } = await db.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passInput.value
        });

        notify.close(load);

        if (error) {
            notify.error('Error: ' + error.message);
        } else {
            // Recargar para actualizar UI basada en sesión
            window.location.reload();
        }
    },

    register: async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('registro-email');
        const passInput = document.getElementById('registro-password');
        
        const email = emailInput.value.trim();
        const password = passInput.value;

        if (password.length < 6) {
            return notify.error('La contraseña debe tener al menos 6 caracteres');
        }

        const load = notify.loading('Creando cuenta...');
        const { data, error } = await db.auth.signUp({
            email: email,
            password: password
        });

        notify.close(load);

        if (error) {
            notify.error(error.message);
        } else {
            // Crear perfil inicial
            const { error: profileError } = await db.from('perfiles').insert([
                { id: data.user.id, email: email, rol: 'Cliente', nombre_completo: 'Nuevo Usuario' }
            ]);
            
            if(profileError) console.error("Error creando perfil:", profileError);
            notify.success('Cuenta creada exitosamente. Por favor inicia sesión.');
        }
    },

    logout: async () => {
        const load = notify.loading('Cerrando sesión...');
        // Limpiar suscripciones realtime antes de salir
        if (State.realtimeSubscription) {
            supabase.removeChannel(State.realtimeSubscription);
            State.realtimeSubscription = null;
        }
        await db.auth.signOut();
        notify.close(load);
        window.location.href = 'index.html';
    },

    loadProfile: async (user) => {
        try {
            const { data: p, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (error && error.code !== 'PGRST116') throw error; // Ignorar error si no existe perfil aun

            if (p) {
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('profile-name', p.nombre_completo);
                setVal('profile-phone', p.telefono);
                setVal('profile-address', p.direccion);
                setVal('profile-email', user.email);
            }
        } catch (err) {
            console.error("Error cargando perfil:", err);
            notify.error("Error al cargar datos del perfil");
        }

        const list = document.getElementById('pedidos-lista-container');
        if (list) {
            const { data: orders } = await db.from('pedidos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            
            if (orders && orders.length > 0) {
                list.innerHTML = orders.map(o => `
                    <div class="pedido-card">
                        <div class="pedido-header">
                            <strong>Pedido #${String(o.id).slice(0, 8)}</strong>
                            <span class="badge badge-primary">${Utils.escapeHtml(o.estado) || 'Procesando'}</span>
                        </div>
                        <div class="order-info">
                            <span>${new Date(o.created_at).toLocaleDateString()}</span>
                            <strong>${Utils.formatCurrency(o.total)}</strong>
                        </div>
                    </div>`).join('');
            } else {
                list.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">No tienes pedidos registrados aún.</p>';
            }
        }
    },

    saveProfile: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Guardando...');
        
        const updates = {
            nombre_completo: document.getElementById('profile-name').value.trim(),
            telefono: document.getElementById('profile-phone').value.trim(),
            direccion: document.getElementById('profile-address').value.trim(),
            updated_at: new Date()
        };

        const { error } = await db.from('perfiles').update(updates).eq('id', user.id);
        
        notify.close(load);
        if (error) notify.error('Error al guardar cambios');
        else notify.success('Datos actualizados correctamente');
    }
};

/* ==========================================================================
 * 5. TIENDA
 * ========================================================================== */
const Store = {
    loadProduct: async () => {
        const el = document.getElementById('producto-nombre');
        const elIndex = document.getElementById('index-producto-nombre');
        
        if (!el && !elIndex) return;

        try {
            const { data, error } = await db.from('productos').select('*').eq('id', 1).single();
            if (error) throw error;

            if (data) {
                // Actualización página Producto
                if (el) {
                    el.textContent = data.nombre;
                    document.getElementById('producto-precio').textContent = Utils.formatCurrency(data.precio);
                    document.getElementById('producto-stock').textContent = data.stock_disponible;
                    
                    const layout = document.querySelector('.shop-layout');
                    if (layout) {
                        layout.dataset.pid = data.id;
                        layout.dataset.stock = data.stock_disponible;
                    }

                    // Deshabilitar botón si no hay stock
                    const btn = document.getElementById('btn-anadir-carrito');
                    if (data.stock_disponible <= 0 && btn) {
                        btn.disabled = true;
                        btn.textContent = "Agotado";
                    }
                }
                // Actualización página Index
                if (elIndex) {
                    elIndex.textContent = data.nombre;
                    document.getElementById('index-producto-precio').textContent = Utils.formatCurrency(data.precio);
                }
            }
        } catch (err) {
            console.error(err);
        }
    },

    addToCart: () => {
        const layout = document.querySelector('.shop-layout');
        if (!layout) return;

        const qtyInput = document.getElementById('cantidad');
        const qty = parseInt(qtyInput.value);
        const max = parseInt(layout.dataset.stock);

        if (isNaN(qty) || qty <= 0) return notify.error('Cantidad inválida');
        if (qty > max) return notify.error(`Solo hay ${max} unidades disponibles`);

        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const pid = layout.dataset.pid;
        
        cart[pid] = (cart[pid] || 0) + qty;
        
        // Validar que la suma en carrito no supere stock
        if (cart[pid] > max) {
            cart[pid] = max;
            notify.show('Se ajustó al máximo stock disponible', 'info');
        } else {
            notify.success('Añadido al carrito');
        }

        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        Store.updateCount();
    },

    updateCount: () => {
        const c = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const el = document.getElementById('carrito-contador');
        if (el) {
            const count = Object.values(c).reduce((a, b) => a + b, 0);
            el.textContent = count;
            el.style.display = count === 0 ? 'none' : 'inline-block';
        }
    },

    initCheckout: async (user) => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const container = document.getElementById('checkout-items');
        
        if (!Object.keys(cart).length) {
            if(container) container.innerHTML = '<p class="text-muted">Tu carrito está vacío.</p>';
            const btn = document.getElementById('btn-confirmar-compra');
            if(btn) btn.disabled = true;
            return;
        }

        // Auto-llenado de datos
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (p) {
                const setVal = (id, val) => { 
                    const i = document.getElementById(id); 
                    if(i && !i.value) i.value = val || ''; 
                };
                setVal('checkout-name', p.nombre_completo);
                setVal('checkout-phone', p.telefono);
                setVal('checkout-address', p.direccion);
            }
        } catch(e) {}

        let total = 0, html = '', itemsToBuy = [];
        
        for (const [pid, qty] of Object.entries(cart)) {
            const { data } = await db.from('productos').select('*').eq('id', pid).single();
            if (data) {
                const sub = data.precio * qty;
                total += sub;
                itemsToBuy.push({
                    id: pid,
                    nombre: data.nombre,
                    cantidad: qty,
                    precio: data.precio
                });
                html += `
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
                    <span>${Utils.escapeHtml(data.nombre)} <small class="text-muted">x${qty}</small></span>
                    <strong>${Utils.formatCurrency(sub)}</strong>
                </div>`;
            }
        }
        
        if (container) container.innerHTML = html;
        const totalEl = document.getElementById('checkout-total');
        if(totalEl) totalEl.textContent = Utils.formatCurrency(total);
        
        const subtotalEl = document.getElementById('checkout-subtotal');
        if(subtotalEl) subtotalEl.textContent = Utils.formatCurrency(total); // Asumiendo envío 0 por ahora

        const form = document.getElementById('form-checkout');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const load = notify.loading('Procesando pedido...');

                const envio = {
                    nombre: document.getElementById('checkout-name').value,
                    direccion: document.getElementById('checkout-address').value,
                    telefono: document.getElementById('checkout-phone').value
                };

                // 1. Crear Pedido
                const { error: orderError } = await db.from('pedidos').insert({
                    user_id: user.id,
                    items: itemsToBuy,
                    total: total,
                    datos_envio: envio,
                    estado: 'Pagado'
                });

                if (orderError) {
                    notify.close(load);
                    notify.error('Error al procesar: ' + orderError.message);
                    return;
                }

                // 2. Descontar Stock (Idealmente esto se hace con una función RPC en Supabase para atomicidad)
                for (const item of itemsToBuy) {
                    const { data: prod } = await db.from('productos').select('stock_disponible').eq('id', item.id).single();
                    if (prod) {
                        await db.from('productos').update({ 
                            stock_disponible: Math.max(0, prod.stock_disponible - item.cantidad) 
                        }).eq('id', item.id);
                    }
                }

                notify.close(load);
                notify.success('¡Compra realizada con éxito!');
                localStorage.removeItem(CONFIG.CART_KEY);
                setTimeout(() => window.location.href = 'cuenta.html', 2000);
            };
        }
    }
};

/* ==========================================================================
 * 6. DASHBOARD (PANEL DE CONTROL)
 * ========================================================================== */
const Dashboard = {
    init: async (user) => {
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (!p) {
                notify.error('Perfil de usuario no encontrado.');
                return;
            }

            document.getElementById('sidebar-username').textContent = p.nombre_completo || 'Usuario';
            document.getElementById('sidebar-role').textContent = p.rol;

            Dashboard.applyPermissions(p.rol);

            // Cargar módulos si es STAFF
            if (CONFIG.ROLES.STAFF.includes(p.rol)) {
                await Dashboard.renderMachines(p.rol);
                Dashboard.initChat(p);
                Dashboard.subscribeRealtime(); // Única llamada a suscripción
                
                if (CONFIG.ROLES.SYS.includes(p.rol) || CONFIG.ROLES.ADMIN.includes(p.rol)) {
                    Dashboard.initAdminUsers(p.rol);
                }
            }
        } catch (e) {
            console.error(e);
            notify.error('Error inicializando panel');
        }
    },

    applyPermissions: (rol) => {
        const tabPersonal = document.querySelector("li[onclick*='personal']");
        const hasAccess = CONFIG.ROLES.ADMIN.includes(rol);
        
        if (tabPersonal) tabPersonal.style.display = hasAccess ? 'block' : 'none';
        
        if (!hasAccess) {
            const viewPersonal = document.getElementById('view-personal');
            if (viewPersonal) viewPersonal.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3><p>No tienes permisos suficientes para ver esta sección.</p></div>';
        }
    },

    initChat: async (profile) => {
        const list = document.querySelector('.message-list');
        const form = document.getElementById('chat-form');
        
        if (!list) return;

        const renderMessage = (m) => {
            const texto = Utils.escapeHtml(m.mensaje || m.content || '');
            const sender = Utils.escapeHtml(m.sender);
            const role = Utils.escapeHtml(m.role || 'Staff');
            const initial = sender.charAt(0).toUpperCase();

            // Evitar duplicados simples por ID si ya existe
            if (document.querySelector(`[data-msg-id="${m.id}"]`)) return;

            const html = `
                <div class="msg-item" data-msg-id="${m.id}" style="animation: fadeIn 0.3s ease;">
                    <div class="msg-avatar">${initial}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${sender}</strong>
                            <small style="color:#888; font-size:0.75rem;">${Utils.formatTime(m.created_at)}</small>
                        </div>
                        <small style="color:#666; font-style:italic;">${role}</small>
                        <p style="margin:5px 0 0; color:#333;">${texto}</p>
                    </div>
                </div>`;
            list.insertAdjacentHTML('afterbegin', html);
        };

        // Cargar últimos mensajes
        const { data } = await db.from('mensajes').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) {
            list.innerHTML = '';
            // Invertimos para que el orden visual sea correcto (nuevos arriba en insertAdjacentHTML)
            [...data].reverse().forEach(renderMessage);
        }

        // Listener para nuevos mensajes (se maneja en subscribeRealtime, pero aquí configuramos el envío)
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const textarea = form.querySelector('textarea');
                const txt = textarea.value.trim();
                
                if (txt) {
                    const btn = form.querySelector('button');
                    const originalText = btn.textContent;
                    btn.disabled = true; btn.textContent = 'Enviando...';

                    const { error } = await db.from('mensajes').insert({
                        mensaje: txt,
                        sender: profile.nombre_completo || 'Usuario',
                        role: profile.rol
                    });

                    btn.disabled = false; btn.textContent = originalText;

                    if (error) notify.error("Error al enviar: " + error.message);
                    else textarea.value = '';
                }
            };
        }
        
        // Exponemos renderMessage para usarlo en realtime
        Dashboard.renderChatMessage = renderMessage;
    },

    renderMachines: async (rol) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;

        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;

        container.innerHTML = ''; // Limpiar loader

        data.forEach(m => {
            const isAdmin = CONFIG.ROLES.ADMIN.includes(rol);
            let body = '';
            
            // Sanitización básica de nombres
            const safeName = Utils.escapeHtml(m.nombre);
            const safeArea = Utils.escapeHtml(m.area);

            if (m.id === 1) {
                // MÁQUINA 1: Control de Tanques y Elevador
                const isActive = m.estado === 'En Ciclo';
                const ctrls = isAdmin ? `
                <div class="machine-interface">
                    <div class="action-buttons">
                        <button class="btn-action btn-start ${isActive ? 'active' : ''}" onclick="window.plcCmd(1,'Inicio')">
                            <i class="fa-solid fa-play"></i> INICIAR
                        </button>
                        <button class="btn-action btn-stop" onclick="window.plcCmd(1,'Paro')">
                            <i class="fa-solid fa-stop"></i> PARO
                        </button>
                    </div>

                    <div class="control-group">
                        <span class="control-label">Válvulas del Tanque</span>
                        <div class="segmented-control">
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-in" ${m.controles.online_llenado ? 'checked' : ''} onclick="window.plcSw(1,'online_llenado')">
                                <label for="tk-in">Entrada</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-off" ${(!m.controles.online_llenado && !m.controles.online_vaciado) ? 'checked' : ''} onclick="window.plcSw(1,'fill_off')">
                                <label for="tk-off">Cerrado</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-out" ${m.controles.online_vaciado ? 'checked' : ''} onclick="window.plcSw(1,'online_vaciado')">
                                <label for="tk-out">Salida</label>
                            </div>
                        </div>
                    </div>

                    <div class="control-group" style="margin-bottom:0">
                        <span class="control-label">Elevador de Charola</span>
                        <div class="segmented-control">
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-up" ${m.controles.online_arriba ? 'checked' : ''} onclick="window.plcSw(1,'online_arriba')">
                                <label for="ch-up">Subir</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-off" ${(!m.controles.online_arriba && !m.controles.online_abajo) ? 'checked' : ''} onclick="window.plcSw(1,'tray_off')">
                                <label for="ch-off">Freno</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-dn" ${m.controles.online_abajo ? 'checked' : ''} onclick="window.plcSw(1,'online_abajo')">
                                <label for="ch-dn">Bajar</label>
                            </div>
                        </div>
                    </div>
                </div>` : '<p class="text-muted text-center" style="padding:20px; background:#f9fafb; border-radius:8px;">Modo Visualización</p>';
                
                body = `<div class="m-area"><i class="fa-solid fa-location-arrow"></i> ${safeArea}</div>${ctrls}`;
                
            } else if (m.id === 2) {
                // MÁQUINA 2: Monitor de Temperatura
                const t = m.controles.escalda_db || 0;
                const ctrls = isAdmin ? `
                <div class="action-buttons" style="margin-top:24px; margin-bottom:0;">
                    <button class="btn-action btn-start ${m.controles.startremoto ? 'active' : ''}" onclick="window.plcRmt(2,true)">
                        AUTO
                    </button>
                    <button class="btn-action btn-stop" onclick="window.plcRmt(2,false)">
                        PARO EM.
                    </button>
                </div>` : '';
                
                body = `
                <div class="clean-gauge">
                    <div class="gauge-readout">
                        ${t.toFixed(1)}<span class="gauge-unit">°C</span>
                    </div>
                    <div class="text-muted" style="font-size:0.9rem">Temperatura Actual</div>
                    
                    <div class="gauge-bar-bg">
                        <div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(t, 100)}%"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8; margin-top:5px;">
                        <span>0°C</span>
                        <span>Objetivo: 65°C</span>
                        <span>100°C</span>
                    </div>
                </div>${ctrls}`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="card machine-card" id="machine-${m.id}">
                    <div class="m-header">
                        <h4>${safeName}</h4>
                        <div class="status-pill ${m.estado === 'En Ciclo' || (m.id === 2 && m.controles.startremoto) ? 'on' : 'off'}">
                            <span class="status-pill dot"></span>
                            ${m.id === 2 ? (m.controles.startremoto ? 'OPERANDO' : 'DETENIDA') : m.estado}
                        </div>
                    </div>
                    <div class="m-body">${body}</div>
                </div>`);
        });
    },

    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        
        let users = [];
        try {
            // Intenta RPC primero (si existe la función segura en DB)
            const { data, error } = await db.rpc('get_all_user_profiles');
            if (error) throw error;
            users = data || [];
        } catch (e) {
            // Fallback a select directo (requiere policies permisivas para admins)
            const { data } = await db.from('perfiles').select('*');
            users = data || [];
        }
        
        const isSys = CONFIG.ROLES.SYS.includes(myRole);

        tbody.innerHTML = users.map(u => `
            <tr data-uid="${u.id}">
                <td>${Utils.escapeHtml(u.email)}</td>
                <td>
                    <select class="form-input role-select" style="padding:5px;">
                        ${['Sistemas', 'Lider', 'Supervisor', 'Operador', 'Cliente'].map(r => 
                            `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`
                        ).join('')}
                    </select>
                </td>
                <td>${Utils.escapeHtml(u.area || '-')}</td>
                <td>
                    <button class="btn-icon btn-save" title="Guardar cambios"><i class="fa-solid fa-save" style="color:var(--color-primary)"></i></button>
                    ${isSys ? `<button class="btn-icon btn-delete" title="Eliminar usuario"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}
                </td>
            </tr>`).join('');
        
        // Listeners para botones dinámicos
        tbody.querySelectorAll('.btn-save').forEach(btn => {
            btn.onclick = async (e) => {
                const row = e.target.closest('tr');
                const newRole = row.querySelector('.role-select').value;
                const load = notify.loading('Actualizando rol...');
                
                const { error } = await db.from('perfiles').update({ rol: newRole }).eq('id', row.dataset.uid);
                
                notify.close(load);
                if(error) notify.error(error.message);
                else notify.success('Rol actualizado');
            };
        });
        
        if (isSys) {
            tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = async (e) => {
                    if (confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
                        const row = e.target.closest('tr');
                        // Nota: Eliminar auth.users requiere Service Role (backend), aquí solo borramos perfil
                        const { error } = await db.from('perfiles').delete().eq('id', row.dataset.uid);
                        if(error) notify.error(error.message);
                        else {
                            row.remove();
                            notify.success('Perfil eliminado');
                        }
                    }
                };
            });
        }
    },

    subscribeRealtime: () => {
        if (State.realtimeSubscription) return; // Evitar suscripciones dobles

        State.realtimeSubscription = db.channel('public-room')
            // Escuchar cambios en Maquinas
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => {
                const m = payload.new;
                const card = document.getElementById(`machine-${m.id}`);
                if (!card) return;

                // 1. ACTUALIZAR VISUALIZADOR DE ESTADO
                const pill = card.querySelector('.status-pill');
                if (pill) {
                    const isActive = m.id === 2 ? m.controles.startremoto : (m.estado === 'En Ciclo');
                    const statusText = m.id === 2 ? (isActive ? 'OPERANDO' : 'DETENIDA') : m.estado;
                    pill.className = `status-pill ${isActive ? 'on' : 'off'}`;
                    pill.innerHTML = `<span class="status-pill dot"></span> ${Utils.escapeHtml(statusText)}`;
                }

                // 2. ACTUALIZAR CONTROLES (Solo si existen en el DOM, es decir, si soy Admin)
                if (m.id === 1) {
                    const btnStart = card.querySelector('.btn-start');
                    if (btnStart) {
                        if (m.estado === 'En Ciclo') btnStart.classList.add('active');
                        else btnStart.classList.remove('active');
                    }
                    
                    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
                    setChk('tk-in', m.controles.online_llenado);
                    setChk('tk-off', !m.controles.online_llenado && !m.controles.online_vaciado);
                    setChk('tk-out', m.controles.online_vaciado);
                    setChk('ch-up', m.controles.online_arriba);
                    setChk('ch-off', !m.controles.online_arriba && !m.controles.online_abajo);
                    setChk('ch-dn', m.controles.online_abajo);

                } else if (m.id === 2) {
                    const readout = card.querySelector('.gauge-readout');
                    if (readout) readout.innerHTML = `${m.controles.escalda_db.toFixed(1)}<span class="gauge-unit">°C</span>`;
                    
                    const bar = document.getElementById('temp-bar-2');
                    if (bar) bar.style.width = Math.min(m.controles.escalda_db, 100) + '%';
                    
                    const btnStart = card.querySelector('.btn-start');
                    if (btnStart) {
                        if (m.controles.startremoto) btnStart.classList.add('active');
                        else btnStart.classList.remove('active');
                    }
                }
            })
            // Escuchar nuevos Mensajes de Chat
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
                if (typeof Dashboard.renderChatMessage === 'function') {
                    Dashboard.renderChatMessage(payload.new);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('🔌 Realtime conectado');
                    const indicator = document.querySelector('.status-indicator');
                    if(indicator) {
                        indicator.classList.add('online');
                        indicator.innerHTML = '<span class="dot"></span> Conectado a PLC';
                    }
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.log('🔌 Realtime desconectado');
                     const indicator = document.querySelector('.status-indicator');
                    if(indicator) {
                        indicator.classList.remove('online');
                        indicator.innerHTML = '<span class="dot" style="background:red"></span> Desconectado';
                    }
                }
            });
    }
};

/* ==========================================================================
 * 7. INTERFAZ PÚBLICA DE CONTROL (Expuesta a window para onclick HTML)
 * ========================================================================== */
window.plcCmd = async (id, act) => {
    try {
        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if (error) throw error;
        
        let c = data.controles;
        if (act === 'Inicio') { c.Inicio = true; c.Paro = false; }
        else { c.Inicio = false; c.Paro = true; c.online_llenado = false; }
        
        await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id);
    } catch (e) {
        notify.error("Error de comunicación PLC");
    }
};

window.plcSw = async (id, k) => {
    try {
        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if(error) throw error;
        
        let c = data.controles;
        // Lógica exclusiva para switches
        if (k.startsWith('online_')) {
             if(k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; }
             else if(k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; }
             else if(k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; }
             else if(k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; }
        } else {
             // Off commands
             if(k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; }
             if(k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; }
        }

        await db.from('maquinas').update({ controles: c }).eq('id', id);
    } catch(e) {
        notify.error("Error cambiando switch");
    }
};

window.plcRmt = async (id, s) => {
    try {
        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if(error) throw error;
        await db.from('maquinas').update({ controles: { ...data.controles, startremoto: s } }).eq('id', id);
    } catch(e) {
        notify.error("Error remoto");
    }
};

/* ==========================================================================
 * 8. BOOTSTRAP (INICIALIZACIÓN)
 * ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    Store.updateCount();
    
    // Verificación de Sesión
    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    // Header Links (Dinámicos)
    const header = document.getElementById('auth-links-container');
    if (header) {
        header.innerHTML = user 
            ? `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>` 
            : `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
    }

    // Router Básico
    if (path.includes('cuenta')) {
        if (user) {
            const authForms = document.getElementById('auth-forms');
            const userInfo = document.getElementById('user-info');
            if(authForms) authForms.style.display = 'none';
            if(userInfo) userInfo.style.display = 'grid';
            
            Auth.loadProfile(user);
            
            const formPerfil = document.getElementById('form-perfil');
            if(formPerfil) formPerfil.onsubmit = (e) => Auth.saveProfile(e, user);
            
            const btnLogout = document.getElementById('btn-logout');
            if(btnLogout) btnLogout.onclick = Auth.logout;
            
            // Tabs Lógica
            const bD = document.getElementById('btn-tab-datos');
            const bP = document.getElementById('btn-tab-pedidos');
            if (bD && bP) {
                bD.onclick = () => { 
                    document.getElementById('seccion-mis-datos').style.display = 'block'; 
                    document.getElementById('seccion-mis-pedidos').style.display = 'none'; 
                    bD.classList.add('active'); bP.classList.remove('active'); 
                };
                bP.onclick = () => { 
                    document.getElementById('seccion-mis-datos').style.display = 'none'; 
                    document.getElementById('seccion-mis-pedidos').style.display = 'block'; 
                    bP.classList.add('active'); bD.classList.remove('active'); 
                    Auth.loadProfile(user); // Recargar pedidos al cambiar tab
                };
            }
        } else {
            const authForms = document.getElementById('auth-forms');
            if(authForms) authForms.style.display = 'block';
            
            const formLogin = document.getElementById('form-login');
            if(formLogin) formLogin.onsubmit = Auth.login;
            
            const formReg = document.getElementById('form-registro');
            if(formReg) formReg.onsubmit = Auth.register;
        }
    } 
    else if (path.includes('panel')) {
        if (user) {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('dashboard-layout').style.display = 'flex';
            Dashboard.init(user);
            
            const btnOut = document.getElementById('btn-logout-panel');
            if (btnOut) btnOut.onclick = Auth.logout;
        } else {
            const loginForm = document.getElementById('panel-login-form');
            if (loginForm) loginForm.onsubmit = Auth.login;
        }
    }
    else if (path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
        Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if (btn) btn.onclick = Store.addToCart;
    }
    else if (path.includes('checkout')) {
        if (user) {
            if(document.getElementById('checkout-login-prompt')) document.getElementById('checkout-login-prompt').style.display = 'none';
            if(document.getElementById('checkout-container')) document.getElementById('checkout-container').style.display = 'grid';
            Store.initCheckout(user);
        } else {
            if(document.getElementById('checkout-login-prompt')) document.getElementById('checkout-login-prompt').style.display = 'block';
            if(document.getElementById('checkout-container')) document.getElementById('checkout-container').style.display = 'none';
        }
    }
});

/* ==========================================================================
 * 9. RESPONSIVIDAD MÓVIL Y UX
 * ========================================================================== */
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if(!sidebar || !overlay) return;

    sidebar.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        overlay.classList.add('show');
        const closeBtn = document.getElementById('close-sidebar-btn');
        if (closeBtn) closeBtn.style.display = window.innerWidth <= 968 ? 'block' : 'none';
    } else {
        overlay.classList.remove('show');
    }
};

window.toggleSidebarIfMobile = function() {
    if (window.innerWidth <= 968) {
        window.toggleSidebar();
    }
};

// Listener para ajustar UI al redimensionar
window.addEventListener('resize', () => {
    if (window.innerWidth > 968) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        const closeBtn = document.getElementById('close-sidebar-btn');
        
        if(sidebar) sidebar.classList.remove('active');
        if(overlay) overlay.classList.remove('show');
        if(closeBtn) closeBtn.style.display = 'none';
    }
});