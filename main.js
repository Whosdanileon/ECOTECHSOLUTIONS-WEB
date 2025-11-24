/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v27 (FINAL: 2-POS SWITCH)
 * - Máquina 2: Switch de 2 posiciones (ON/OFF) para calentadores
 * - Mantiene: Sincronización PLC (0.0-0.5), Paro Global y Pagos
 * ========================================================================== */

/* 1. CONFIGURACIÓN Y ESTADO GLOBAL */
const CONFIG = {
    // NOTA: Asegúrate de tener Row Level Security (RLS) activado en Supabase.
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    ROLES: {
        SYS: ['Sistemas'],
        ADMIN: ['Sistemas', 'Lider'],
        STAFF: ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador']
    }
};

// Estado global
const State = {
    realtimeSubscription: null
};

// Estado de Emergencia Local
let globalEmergencyActive = false;

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

    escapeHtml: (text) => {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.toString().replace(/[&<>"']/g, (m) => map[m]);
    },

    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

/* ==========================================================================
 * 3. LÓGICA DE PARO DE EMERGENCIA GLOBAL
 * ========================================================================== */
window.toggleGlobalEmergency = async () => {
    const btn = document.getElementById('btn-global-stop');
    
    if (!globalEmergencyActive) {
        // 1. ACTIVAR PARO
        if (confirm("⚠️ ¿ESTÁS SEGURO? Se detendrán TODAS las máquinas y se bloquearán controles.")) {
            globalEmergencyActive = true;
            document.body.classList.add('emergency-mode');
            if(btn) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> RESTABLECER SISTEMA';
            }
            
            notify.error("PARO DE EMERGENCIA ACTIVADO");

            // A. Detener Máquina 1 (PLC 0.0 Start=False, 0.1 Stop=True)
            await window.plcCmd(1, 'Paro'); 
            
            // B. Detener Máquina 2 (Calentadores OFF)
            await window.plcSw(2, 'heat_off');
        }
    } else {
        // 2. RESTABLECER
        if (confirm("¿Confirmas que es seguro restablecer el sistema?")) {
            globalEmergencyActive = false;
            document.body.classList.remove('emergency-mode');
            if(btn) {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA';
            }
            notify.success("Sistema restablecido. Listo para operar.");
        }
    }
};

/* ==========================================================================
 * 4. FUNCIONES GLOBALES DE UI
 * ========================================================================== */
window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tabName);
    if (view) view.classList.add('active');
};

/* ==========================================================================
 * 5. AUTENTICACIÓN
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
            window.location.reload();
        }
    },

    register: async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('registro-email');
        const passInput = document.getElementById('registro-password');
        
        const email = emailInput.value.trim();
        const password = passInput.value;

        if (password.length < 6) return notify.error('La contraseña debe tener al menos 6 caracteres');

        const load = notify.loading('Creando cuenta...');
        const { data, error } = await db.auth.signUp({
            email: email,
            password: password
        });

        notify.close(load);

        if (error) {
            notify.error(error.message);
        } else {
            const { error: profileError } = await db.from('perfiles').insert([
                { id: data.user.id, email: email, rol: 'Cliente', nombre_completo: 'Nuevo Usuario' }
            ]);
            if(profileError) console.error("Error perfil:", profileError);
            notify.success('Cuenta creada exitosamente. Inicia sesión.');
        }
    },

    logout: async () => {
        const load = notify.loading('Cerrando sesión...');
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
            if (error && error.code !== 'PGRST116') throw error;

            if (p) {
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('profile-name', p.nombre_completo);
                setVal('profile-phone', p.telefono);
                setVal('profile-address', p.direccion);
                setVal('profile-email', user.email);
            }
        } catch (err) {
            console.error("Error perfil:", err);
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
                list.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">No tienes pedidos registrados.</p>';
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
        if (error) notify.error('Error al guardar');
        else notify.success('Datos actualizados');
    }
};

/* ==========================================================================
 * 6. TIENDA Y CHECKOUT (CON SIMULACIÓN)
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
                if (el) {
                    el.textContent = data.nombre;
                    document.getElementById('producto-precio').textContent = Utils.formatCurrency(data.precio);
                    document.getElementById('producto-stock').textContent = data.stock_disponible;
                    const layout = document.querySelector('.shop-layout');
                    if (layout) {
                        layout.dataset.pid = data.id;
                        layout.dataset.stock = data.stock_disponible;
                    }
                    const btn = document.getElementById('btn-anadir-carrito');
                    if (data.stock_disponible <= 0 && btn) {
                        btn.disabled = true;
                        btn.textContent = "Agotado";
                    }
                }
                if (elIndex) {
                    elIndex.textContent = data.nombre;
                    document.getElementById('index-producto-precio').textContent = Utils.formatCurrency(data.precio);
                }
            }
        } catch (err) { console.error(err); }
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
        if (cart[pid] > max) {
            cart[pid] = max;
            notify.show('Se ajustó al máximo disponible', 'info');
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
            if(container) container.innerHTML = '<p class="text-muted">Carrito vacío.</p>';
            const btn = document.getElementById('btn-confirmar-compra');
            if(btn) btn.disabled = true;
            return;
        }

        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (p) {
                const setVal = (id, val) => { const i = document.getElementById(id); if(i && !i.value) i.value = val || ''; };
                setVal('checkout-name', p.nombre_completo);
                setVal('checkout-phone', p.telefono);
                setVal('checkout-address', p.direccion);
                setVal('card-holder', p.nombre_completo);
            }
        } catch(e) {}

        let total = 0, html = '', itemsToBuy = [];
        for (const [pid, qty] of Object.entries(cart)) {
            const { data } = await db.from('productos').select('*').eq('id', pid).single();
            if (data) {
                const sub = data.precio * qty;
                total += sub;
                itemsToBuy.push({ id: pid, nombre: data.nombre, cantidad: qty, precio: data.precio });
                html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
                    <span>${Utils.escapeHtml(data.nombre)} <small class="text-muted">x${qty}</small></span>
                    <strong>${Utils.formatCurrency(sub)}</strong></div>`;
            }
        }
        
        if (container) container.innerHTML = html;
        const totalEl = document.getElementById('checkout-total');
        if(totalEl) totalEl.textContent = Utils.formatCurrency(total);
        const subtotalEl = document.getElementById('checkout-subtotal');
        if(subtotalEl) subtotalEl.textContent = Utils.formatCurrency(total);

        const form = document.getElementById('form-checkout');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const metodoPagoInput = document.querySelector('input[name="payment-method"]:checked');
                const metodoPago = metodoPagoInput ? metodoPagoInput.value : 'card';

                if (metodoPago === 'card') {
                    const cardNum = document.getElementById('card-number').value.trim();
                    const cardExp = document.getElementById('card-expiry').value.trim();
                    const cardCvc = document.getElementById('card-cvc').value.trim();
                    const cardHolder = document.getElementById('card-holder').value.trim();

                    if (!cardNum || !cardExp || !cardCvc || !cardHolder) {
                        notify.error('Por favor, completa los datos de la tarjeta.');
                        if(!cardNum) document.getElementById('card-number').classList.add('input-error');
                        if(!cardExp) document.getElementById('card-expiry').classList.add('input-error');
                        if(!cardCvc) document.getElementById('card-cvc').classList.add('input-error');
                        return;
                    }
                    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
                }
                
                const modal = document.getElementById('payment-modal');
                if(modal) modal.style.display = 'flex';
                
                try {
                    const s1 = document.getElementById('step-1');
                    if(s1) { s1.className = 'step active'; await Utils.wait(1500); s1.innerHTML = '<i class="fa-solid fa-check"></i> Encriptado seguro'; s1.style.color = 'var(--color-success)'; }

                    const s2 = document.getElementById('step-2');
                    if(s2) { 
                        s2.className = 'step active'; 
                        const txt = document.getElementById('payment-status-text');
                        if(txt) txt.textContent = "Contactando con banco emisor...";
                        await Utils.wait(2000); 
                        s2.innerHTML = '<i class="fa-solid fa-check"></i> Autorización exitosa'; 
                        s2.style.color = 'var(--color-success)'; 
                    }

                    const s3 = document.getElementById('step-3');
                    if(s3) {
                        s3.className = 'step active';
                        const txt = document.getElementById('payment-status-text');
                        if(txt) txt.textContent = "Generando orden de compra...";
                        
                        const envio = {
                            nombre: document.getElementById('checkout-name').value,
                            direccion: document.getElementById('checkout-address').value,
                            telefono: document.getElementById('checkout-phone').value,
                            metodo_pago: metodoPago
                        };

                        const { error: orderError } = await db.from('pedidos').insert({
                            user_id: user.id, items: itemsToBuy, total: total, datos_envio: envio, estado: 'Pagado'
                        });

                        if (orderError) throw orderError;

                        for(const item of itemsToBuy) {
                            const { data: prod } = await db.from('productos').select('stock_disponible').eq('id', item.id).single();
                            if (prod) await db.from('productos').update({ stock_disponible: Math.max(0, prod.stock_disponible - item.cantidad) }).eq('id', item.id);
                        }

                        s3.innerHTML = '<i class="fa-solid fa-check"></i> Pedido guardado';
                        s3.style.color = 'var(--color-success)';
                    }
                    await Utils.wait(800);

                    const loadingState = document.getElementById('payment-loading-state');
                    const successState = document.getElementById('payment-success-state');
                    if(loadingState) loadingState.style.display = 'none';
                    if(successState) successState.style.display = 'block';
                    
                    localStorage.removeItem(CONFIG.CART_KEY);
                    setTimeout(() => window.location.href = 'cuenta.html', 2500);

                } catch (err) {
                    if(modal) modal.style.display = 'none';
                    notify.error('Error procesando pago: ' + err.message);
                }
            };
        }
    }
};

/* ==========================================================================
 * 7. DASHBOARD (PANEL DE CONTROL)
 * ========================================================================== */
const Dashboard = {
    init: async (user) => {
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (!p) { notify.error('Perfil no encontrado.'); return; }

            document.getElementById('sidebar-username').textContent = p.nombre_completo || 'Usuario';
            document.getElementById('sidebar-role').textContent = p.rol;

            Dashboard.applyPermissions(p.rol);

            if (CONFIG.ROLES.STAFF.includes(p.rol)) {
                await Dashboard.renderMachines(p.rol);
                Dashboard.initChat(p);
                Dashboard.subscribeRealtime();
                
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
            if (viewPersonal) viewPersonal.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3><p>No tienes permisos.</p></div>';
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

        const { data } = await db.from('mensajes').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) { list.innerHTML = ''; [...data].reverse().forEach(renderMessage); }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const textarea = form.querySelector('textarea');
                const txt = textarea.value.trim();
                if (txt) {
                    const btn = form.querySelector('button');
                    const originalText = btn.textContent;
                    btn.disabled = true; btn.textContent = 'Enviando...';
                    const { error } = await db.from('mensajes').insert({ mensaje: txt, sender: profile.nombre_completo || 'Usuario', role: profile.rol });
                    btn.disabled = false; btn.textContent = originalText;
                    if (error) notify.error("Error: " + error.message); else textarea.value = '';
                }
            };
        }
        Dashboard.renderChatMessage = renderMessage;
    },

    // RENDERIZADO DE MÁQUINAS (ACTUALIZADO PARA SWITCH 2 POSICIONES)
    renderMachines: async (rol) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;
        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;

        container.innerHTML = '';

        data.forEach(m => {
            const isAdmin = CONFIG.ROLES.ADMIN.includes(rol);
            let body = '';
            const safeName = Utils.escapeHtml(m.nombre);

            // --- MÁQUINA 1: LAVADORA (Variables 0.0 - 0.5) ---
            if (m.id === 1) {
                const isStarted = m.controles.Inicio; 
                const ctrls = isAdmin ? `
                <div class="machine-interface">
                    <div class="action-buttons">
                        <button class="btn-action btn-start ${isStarted ? 'active' : ''}" onclick="window.plcCmd(1,'Inicio')"><i class="fa-solid fa-play"></i> INICIAR (0.0)</button>
                        <button class="btn-action btn-stop" onclick="window.plcCmd(1,'Paro')"><i class="fa-solid fa-stop"></i> PARO (0.1)</button>
                    </div>
                    <div class="control-group">
                        <span class="control-label">Control Tanque</span>
                        <div class="segmented-control">
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-in" ${m.controles.online_llenado ? 'checked' : ''} onclick="window.plcSw(1,'online_llenado')"><label for="tk-in">Llenado (0.2)</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-off" ${(!m.controles.online_llenado && !m.controles.online_vaciado) ? 'checked' : ''} onclick="window.plcSw(1,'fill_off')"><label for="tk-off">OFF</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="tk" id="tk-out" ${m.controles.online_vaciado ? 'checked' : ''} onclick="window.plcSw(1,'online_vaciado')"><label for="tk-out">Vaciado (0.3)</label>
                            </div>
                        </div>
                    </div>
                    <div class="control-group" style="margin-bottom:0">
                        <span class="control-label">Control Elevador</span>
                        <div class="segmented-control">
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-up" ${m.controles.online_arriba ? 'checked' : ''} onclick="window.plcSw(1,'online_arriba')"><label for="ch-up">Arriba (0.4)</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-off" ${(!m.controles.online_arriba && !m.controles.online_abajo) ? 'checked' : ''} onclick="window.plcSw(1,'tray_off')"><label for="ch-off">Freno</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="ch" id="ch-dn" ${m.controles.online_abajo ? 'checked' : ''} onclick="window.plcSw(1,'online_abajo')"><label for="ch-dn">Abajo (0.5)</label>
                            </div>
                        </div>
                    </div>
                </div>` : '<p class="text-muted">Modo Visualización</p>';
                
                body = `<div class="m-area"><i class="fa-solid fa-microchip"></i> PLC M1</div>${ctrls}`;
                
            // --- MÁQUINA 2: DESHIDRATADORA (Switch 2 Posiciones) ---
            } else if (m.id === 2) {
                const t = m.controles.escalda_db || 0;
                // Switch booleano simple: Encendido (true) / Apagado (false)
                const isHeating = m.controles.calentador_on;

                const ctrls = isAdmin ? `
                <div class="machine-interface" style="margin-top: 20px;">
                    <div class="control-group">
                        <span class="control-label">Calentadores Industriales</span>
                        <div class="segmented-control">
                            <div class="segmented-option">
                                <input type="radio" name="heat" id="heat-off" ${!isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_off')">
                                <label for="heat-off">Apagado</label>
                            </div>
                            <div class="segmented-option">
                                <input type="radio" name="heat" id="heat-on" ${isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_on')">
                                <label for="heat-on">Encendido</label>
                            </div>
                        </div>
                    </div>
                </div>` : '';

                body = `
                <div class="clean-gauge">
                    <div class="gauge-readout">${t.toFixed(1)}<span class="gauge-unit">°C</span></div>
                    <div class="text-muted" style="font-size:0.9rem">Temperatura Cámara</div>
                    <div class="gauge-bar-bg"><div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(t, 100)}%"></div></div>
                </div>${ctrls}`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="card machine-card" id="machine-${m.id}">
                    <div class="m-header">
                        <h4>${safeName}</h4>
                        <div class="status-pill ${m.estado === 'En Ciclo' || (m.id === 2 && m.controles.calentador_on) ? 'on' : 'off'}">
                            <span class="status-pill dot"></span>${m.estado}
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
            const { data, error } = await db.rpc('get_all_user_profiles');
            if (error) throw error;
            users = data || [];
        } catch (e) {
            const { data } = await db.from('perfiles').select('*');
            users = data || [];
        }
        
        const isSys = CONFIG.ROLES.SYS.includes(myRole);
        tbody.innerHTML = users.map(u => `
            <tr data-uid="${u.id}">
                <td>${Utils.escapeHtml(u.email)}</td>
                <td>
                    <select class="form-input role-select" style="padding:5px;">
                        ${['Sistemas', 'Lider', 'Supervisor', 'Operador', 'Cliente'].map(r => `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`).join('')}
                    </select>
                </td>
                <td>${Utils.escapeHtml(u.area || '-')}</td>
                <td>
                    <button class="btn-icon btn-save" title="Guardar"><i class="fa-solid fa-save" style="color:var(--color-primary)"></i></button>
                    ${isSys ? `<button class="btn-icon btn-delete" title="Eliminar"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}
                </td>
            </tr>`).join('');
        
        tbody.querySelectorAll('.btn-save').forEach(btn => {
            btn.onclick = async (e) => {
                const row = e.target.closest('tr');
                const newRole = row.querySelector('.role-select').value;
                const load = notify.loading('Actualizando...');
                const { error } = await db.from('perfiles').update({ rol: newRole }).eq('id', row.dataset.uid);
                notify.close(load);
                if(error) notify.error(error.message); else notify.success('Rol actualizado');
            };
        });
        
        if (isSys) {
            tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = async (e) => {
                    if (confirm('¿Eliminar usuario?')) {
                        const row = e.target.closest('tr');
                        const { error } = await db.from('perfiles').delete().eq('id', row.dataset.uid);
                        if(error) notify.error(error.message); else { row.remove(); notify.success('Eliminado'); }
                    }
                };
            });
        }
    },

    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;

        State.realtimeSubscription = db.channel('public-room')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => {
                const m = payload.new;
                if (globalEmergencyActive) return; 

                const card = document.getElementById(`machine-${m.id}`);
                if (!card) return;

                const pill = card.querySelector('.status-pill');
                if (pill) {
                    const isActive = m.id === 2 ? m.controles.calentador_on : (m.estado === 'En Ciclo');
                    pill.className = `status-pill ${isActive ? 'on' : 'off'}`;
                    pill.innerHTML = `<span class="status-pill dot"></span> ${Utils.escapeHtml(m.estado)}`;
                }

                if (m.id === 1) {
                    const btnStart = card.querySelector('.btn-start');
                    if (btnStart) {
                        if (m.controles.Inicio) btnStart.classList.add('active'); else btnStart.classList.remove('active');
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
                    
                    // Update switch 2-pos
                    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
                    setChk('heat-on', m.controles.calentador_on);
                    setChk('heat-off', !m.controles.calentador_on);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
                if (typeof Dashboard.renderChatMessage === 'function') Dashboard.renderChatMessage(payload.new);
            })
            .subscribe((status) => {
                const indicator = document.querySelector('.status-indicator');
                if(indicator) {
                    if (status === 'SUBSCRIBED') {
                        indicator.classList.add('online');
                        indicator.innerHTML = '<span class="dot"></span> PLC Conectado';
                    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        indicator.classList.remove('online');
                        indicator.innerHTML = '<span class="dot" style="background:red"></span> Desconectado';
                    }
                }
            });
    }
};

/* ==========================================================================
 * 8. COMANDOS PLC (ACTUALIZADO)
 * ========================================================================== */
window.plcCmd = async (id, act) => {
    try {
        if (globalEmergencyActive && act !== 'Paro') {
            notify.error("SISTEMA BLOQUEADO POR PARO DE EMERGENCIA");
            return;
        }

        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if (error) throw error;
        let c = data.controles;
        
        if (act === 'Inicio') { 
            c.Inicio = true; 
            c.Paro = false; 
        } else { 
            c.Inicio = false; 
            c.Paro = true;
            c.online_llenado = false;
            c.online_vaciado = false; 
        }
        await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id);
    } catch (e) { notify.error("Error PLC Cmd"); }
};

window.plcSw = async (id, k) => {
    try {
        if (globalEmergencyActive && !k.includes('off')) {
             notify.error("SISTEMA BLOQUEADO POR PARO DE EMERGENCIA");
             return;
        }

        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if(error) throw error;
        let c = data.controles;

        // MÁQUINA 1 (PLC 0.2-0.5)
        if (id === 1) {
            if (k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; }
            else if (k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; }
            else if (k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; }
            
            else if (k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; }
            else if (k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; }
            else if (k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; }
        }
        
        // MÁQUINA 2 (Calentadores 2-Pos)
        if (id === 2) {
            if (k === 'heat_on') c.calentador_on = true;
            if (k === 'heat_off') c.calentador_on = false;
        }

        await db.from('maquinas').update({ controles: c }).eq('id', id);
    } catch(e) { notify.error("Error PLC Switch"); }
};

window.plcRmt = async (id, s) => {
    try {
        if (globalEmergencyActive && s === true) {
             notify.error("BLOQUEADO"); return;
        }
        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if(error) throw error;
        await db.from('maquinas').update({ controles: { ...data.controles, startremoto: s } }).eq('id', id);
    } catch(e) { notify.error("Error Remoto"); }
};

/* ==========================================================================
 * 9. BOOTSTRAP (INICIALIZACIÓN)
 * ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    Store.updateCount();
    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    const header = document.getElementById('auth-links-container');
    if (header) {
        header.innerHTML = user 
            ? `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>` 
            : `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
    }

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
            const bD = document.getElementById('btn-tab-datos');
            const bP = document.getElementById('btn-tab-pedidos');
            if (bD && bP) {
                bD.onclick = () => { document.getElementById('seccion-mis-datos').style.display = 'block'; document.getElementById('seccion-mis-pedidos').style.display = 'none'; bD.classList.add('active'); bP.classList.remove('active'); };
                bP.onclick = () => { document.getElementById('seccion-mis-datos').style.display = 'none'; document.getElementById('seccion-mis-pedidos').style.display = 'block'; bP.classList.add('active'); bD.classList.remove('active'); Auth.loadProfile(user); };
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
            document.getElementById('checkout-login-prompt').style.display = 'none';
            document.getElementById('checkout-container').style.display = 'grid';
            Store.initCheckout(user);
        } else {
            document.getElementById('checkout-login-prompt').style.display = 'block';
            document.getElementById('checkout-container').style.display = 'none';
        }
    }
});

/* ==========================================================================
 * 10. RESPONSIVIDAD MÓVIL
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
    if (window.innerWidth <= 968) window.toggleSidebar();
};

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