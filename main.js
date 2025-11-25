/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v37 (UI STACKING FIX + FULL CONTROLS)
 * ========================================================================== */

/* 1. CONFIGURACIÓN Y ESTADO GLOBAL */
const CONFIG = {
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    ROLES: {
        SYS: ['Sistemas'],
        ADMIN: ['Sistemas', 'Lider'],
        STAFF: ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador']
    }
};

const State = {
    realtimeSubscription: null
};

let globalEmergencyActive = false;

// Inicialización Supabase
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System: Online & Secure');

/* ==========================================================================
 * 2. FUNCIONES GLOBALES CRÍTICAS (UI FIX)
 * ========================================================================== */

// CORRECCIÓN DE SUPERPOSICIÓN: Forzamos display 'none' en todo antes de mostrar
window.switchTab = function(tabName) {
    // 1. Limpiar Sidebar
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // 2. Limpiar Vistas (AQUÍ ESTABA EL ERROR ANTERIOR)
    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(v => {
        v.style.display = 'none'; // Forzar ocultamiento
        v.classList.remove('active');
    });

    // 3. Mostrar Vista Seleccionada
    const target = document.getElementById('view-' + tabName);
    if (target) {
        target.style.display = 'block'; // Forzar visualización
        // Pequeño delay para permitir que el navegador renderice el cambio de display antes de la opacidad (si hay animación CSS)
        setTimeout(() => target.classList.add('active'), 10);
    }
    
    window.toggleSidebarIfMobile();
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if(!sidebar || !overlay) return;
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) {
        overlay.classList.add('show');
        const closeBtn = document.getElementById('close-sidebar-btn');
        if(closeBtn) closeBtn.style.display = 'block';
    } else {
        overlay.classList.remove('show');
    }
};

window.toggleSidebarIfMobile = function() {
    if (window.innerWidth <= 968) {
        const sidebar = document.getElementById('sidebar');
        if(sidebar && sidebar.classList.contains('active')) window.toggleSidebar();
    }
};

/* ==========================================================================
 * 3. UTILIDADES
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
        div.innerHTML = `<div class="notification-content">${msg}</div>`;
        container.appendChild(div);
        if (type !== 'loading') {
            setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 4000);
        }
        return div;
    },
    success: (m) => notify.show(m, 'success'),
    error: (m) => notify.show(m, 'error'),
    loading: (m) => notify.show(m, 'loading'),
    close: (div) => { if (div) div.remove(); }
};

const Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val),
    formatTime: (dateStr) => dateStr ? new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--',
    escapeHtml: (text) => text ? text.toString().replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) : '',
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    confirmModal: (title, message, callback) => {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const modalHTML = `
            <div id="custom-confirm-modal" class="modal-overlay">
                <div class="modal-content-premium">
                    <div class="modal-icon-warning"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button id="btn-modal-cancel" class="btn-secondary-modal">Cancelar</button>
                        <button id="btn-modal-confirm" class="btn-primary-modal-danger">Confirmar</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('custom-confirm-modal');
        const close = () => { modal.style.opacity = '0'; setTimeout(() => modal.remove(), 200); };
        
        document.getElementById('btn-modal-cancel').onclick = close;
        document.getElementById('btn-modal-confirm').onclick = () => { callback(); close(); };
        modal.onclick = (e) => { if(e.target === modal) close(); };
    }
};

/* ==========================================================================
 * 4. AUTENTICACIÓN
 * ========================================================================== */
const Auth = {
    login: async (e) => {
        e.preventDefault();
        const email = document.getElementById('m-login-email') ? document.getElementById('m-login-email').value.trim() : document.getElementById('login-email').value.trim();
        const password = document.getElementById('m-login-pass') ? document.getElementById('m-login-pass').value : document.getElementById('login-password').value;
        
        const load = notify.loading('Iniciando sesión...');
        const { error } = await db.auth.signInWithPassword({ email, password });
        notify.close(load);
        if (error) notify.error(error.message);
        else {
            notify.success('Bienvenido');
            if(window.AuthModal) window.AuthModal.close();
            setTimeout(() => window.location.reload(), 1000);
        }
    },
    register: async (e) => {
        e.preventDefault();
        const email = document.getElementById('m-reg-email').value.trim();
        const password = document.getElementById('m-reg-pass').value;
        if (password.length < 6) return notify.error('Contraseña muy corta (mín. 6)');
        
        const load = notify.loading('Registrando...');
        const { data, error } = await db.auth.signUp({ email, password });
        notify.close(load);
        
        if (error) notify.error(error.message);
        else {
            await db.from('perfiles').insert([{ id: data.user.id, email, rol: 'Cliente', nombre_completo: 'Nuevo Usuario' }]);
            notify.success('Cuenta creada. Inicia sesión.');
            window.AuthModal.switchTab('login');
        }
    },
    logout: async () => {
        const load = notify.loading('Saliendo...');
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
            const { data } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (data) {
                ['profile-name', 'profile-phone', 'profile-address'].forEach(id => {
                    const field = document.getElementById(id);
                    if(field) field.value = data[id === 'profile-name' ? 'nombre_completo' : id === 'profile-phone' ? 'telefono' : 'direccion'] || '';
                });
                const emailField = document.getElementById('profile-email');
                if(emailField) emailField.value = user.email;
            }
        } catch(e){}

        const list = document.getElementById('pedidos-lista-container');
        if (list) {
            const { data: orders } = await db.from('pedidos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (orders && orders.length > 0) {
                list.innerHTML = orders.map(o => `
                    <div class="pedido-card">
                        <div class="pedido-header"><strong>Pedido #${String(o.id).slice(0, 8)}</strong><span class="badge badge-primary">${Utils.escapeHtml(o.estado) || 'Procesando'}</span></div>
                        <div class="order-info"><span>${new Date(o.created_at).toLocaleDateString()}</span><strong>${Utils.formatCurrency(o.total)}</strong></div>
                    </div>`).join('');
            } else {
                list.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">No tienes pedidos.</p>';
            }
        }
    },
    saveProfile: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Guardando...');
        const updates = {
            nombre_completo: document.getElementById('profile-name').value,
            telefono: document.getElementById('profile-phone').value,
            direccion: document.getElementById('profile-address').value,
            updated_at: new Date()
        };
        await db.from('perfiles').update(updates).eq('id', user.id);
        notify.close(load);
        notify.success('Perfil actualizado');
    }
};

// Auth Modal Global
window.AuthModal = {
    init: () => {
        if (!document.getElementById('auth-modal')) {
            const html = `
            <div id="auth-modal" class="auth-modal-overlay" style="display:none;">
                <div class="auth-box">
                    <button class="auth-close-btn" onclick="window.AuthModal.close()"><i class="fa-solid fa-xmark"></i></button>
                    <div class="auth-tabs">
                        <button class="auth-tab active" onclick="window.AuthModal.switchTab('login')">Iniciar Sesión</button>
                        <button class="auth-tab" onclick="window.AuthModal.switchTab('register')">Registrarse</button>
                    </div>
                    <div id="modal-login-view" class="auth-view active">
                        <div class="auth-header"><img src="images/logo.png"><h4>Bienvenido</h4><p>Accede a tu cuenta</p></div>
                        <form id="form-modal-login"><div class="input-group"><input id="m-login-email" class="form-input" placeholder="Email" required></div><div class="input-group"><input type="password" id="m-login-pass" class="form-input" placeholder="Contraseña" required></div><button type="submit" class="btn btn-primary" style="width:100%">ENTRAR</button></form>
                    </div>
                    <div id="modal-register-view" class="auth-view">
                        <div class="auth-header"><img src="images/logo.png"><h4>Crear Cuenta</h4><p>Regístrate</p></div>
                        <form id="form-modal-register"><div class="input-group"><input id="m-reg-email" class="form-input" placeholder="Email" required></div><div class="input-group"><input type="password" id="m-reg-pass" class="form-input" placeholder="Contraseña (min 6)" required minlength="6"></div><button type="submit" class="btn btn-primary" style="width:100%">REGISTRARSE</button></form>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            document.getElementById('form-modal-login').onsubmit = Auth.login;
            document.getElementById('form-modal-register').onsubmit = Auth.register;
        }
    },
    open: (tab = 'login') => {
        window.AuthModal.init();
        const modal = document.getElementById('auth-modal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        window.AuthModal.switchTab(tab);
    },
    close: () => {
        const modal = document.getElementById('auth-modal');
        if(modal) { modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300); }
    },
    switchTab: (tab) => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
        if(tab === 'login') {
            document.querySelector('button[onclick*="login"]').classList.add('active');
            document.getElementById('modal-login-view').classList.add('active');
        } else {
            document.querySelector('button[onclick*="register"]').classList.add('active');
            document.getElementById('modal-register-view').classList.add('active');
        }
    }
};

/* ==========================================================================
 * 5. DASHBOARD & PLC (RESTAURADO COMPLETO)
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
                // IMPORTANTE: Cargar vista inicial correctamente
                window.switchTab('planta'); 
                
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
            const view = document.getElementById('view-personal');
            if(view) view.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3></div>';
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
                    btn.disabled = true; btn.textContent = 'Enviando...';
                    const { error } = await db.from('mensajes').insert({ mensaje: txt, sender: profile.nombre_completo || 'Usuario', role: profile.rol });
                    btn.disabled = false; btn.textContent = 'Enviar';
                    if (error) notify.error("Error: " + error.message); else textarea.value = '';
                }
            };
        }
        Dashboard.renderChatMessage = renderMessage;
    },

    // RESTAURACIÓN COMPLETA DE CONTROLES (V27)
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

            // MÁQUINA 1: LAVADORA (CONTROLES COMPLETOS)
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
                
            // MÁQUINA 2: DESHIDRATADORA (CONTROLES COMPLETOS)
            } else if (m.id === 2) {
                const t = m.controles.escalda_db || 0;
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
        
        try {
            let users = [];
            const { data: rpcData, error: rpcError } = await db.rpc('get_all_user_profiles');
            if (!rpcError) users = rpcData;
            else {
                const { data: tableData } = await db.from('perfiles').select('*');
                users = tableData || [];
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
                    const role = row.querySelector('.role-select').value;
                    await db.from('perfiles').update({ rol: role }).eq('id', row.dataset.uid);
                    notify.success('Rol actualizado');
                };
            });
            
            if(isSys) {
                tbody.querySelectorAll('.btn-delete').forEach(btn => {
                    btn.onclick = async (e) => {
                        if(confirm('¿Eliminar usuario?')) {
                            const row = e.target.closest('tr');
                            await db.from('perfiles').delete().eq('id', row.dataset.uid);
                            row.remove();
                        }
                    };
                });
            }

        } catch (e) { console.error("Error usuarios:", e); }
    },

    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;

        State.realtimeSubscription = db.channel('public-room')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => {
                if (globalEmergencyActive) return; 
                // Para simplicidad, recargamos todo el bloque de máquinas. 
                // En prod, se recomienda actualizar solo el DOM afectado.
                Dashboard.renderMachines('Sistemas'); 
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
                if (typeof Dashboard.renderChatMessage === 'function') Dashboard.renderChatMessage(payload.new);
            })
            .subscribe((status) => {
                const indicator = document.querySelector('.status-indicator');
                if(indicator && status === 'SUBSCRIBED') { 
                    indicator.classList.add('online'); 
                    indicator.innerHTML = '<span class="dot"></span> PLC Conectado'; 
                }
            });
    }
};

// GLOBALES PLC
window.plcCmd = async (id, act) => {
    try {
        if (globalEmergencyActive && act !== 'Paro') {
            notify.error("SISTEMA BLOQUEADO POR PARO DE EMERGENCIA");
            return;
        }
        const { data, error } = await db.from('maquinas').select('controles').eq('id', id).single();
        if (error) throw error;
        let c = data.controles;
        if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
        else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; }
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
        // MÁQUINA 1
        if (id === 1) {
            if (k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; }
            else if (k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; }
            else if (k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; }
            else if (k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; }
            else if (k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; }
            else if (k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; }
        }
        // MÁQUINA 2
        if (id === 2) {
            if (k === 'heat_on') c.calentador_on = true;
            if (k === 'heat_off') c.calentador_on = false;
        }
        await db.from('maquinas').update({ controles: c }).eq('id', id);
    } catch(e) { notify.error("Error PLC Switch"); }
};

window.toggleGlobalEmergency = async () => {
    const btn = document.getElementById('btn-global-stop');
    
    if (!globalEmergencyActive) {
        Utils.confirmModal(
            'PARO DE EMERGENCIA', 
            'Se detendrán TODAS las máquinas inmediatamente. ¿Continuar?',
            async () => {
                globalEmergencyActive = true;
                document.body.classList.add('emergency-mode');
                if(btn) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> RESTABLECER SISTEMA';
                }
                notify.error("PARO DE EMERGENCIA ACTIVADO");
                await window.plcCmd(1, 'Paro'); 
                await window.plcSw(2, 'heat_off');
            }
        );
    } else {
        Utils.confirmModal(
            'Restablecer Sistema',
            '¿Confirmas que es seguro reactivar las operaciones?',
            () => {
                globalEmergencyActive = false;
                document.body.classList.remove('emergency-mode');
                if(btn) {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA';
                }
                notify.success("Sistema restablecido.");
            }
        );
    }
};

/* ==========================================================================
 * 6. STORE, GALLERY & UI HELPERS
 * ========================================================================== */
window.Carousel = {
    init: () => {
        const track = document.querySelector('.carousel-track');
        if (!track) return;
        const slides = Array.from(track.children);
        if(!slides.length) return;
        const nextButton = document.getElementById('next-slide');
        const prevButton = document.getElementById('prev-slide');
        const dotsNav = document.querySelector('.carousel-nav');
        const dots = Array.from(dotsNav.children);
        const slideWidth = slides[0].getBoundingClientRect().width;
        slides.forEach((slide, index) => slide.style.left = slideWidth * index + 'px');
        const moveToSlide = (currentSlide, targetSlide) => {
            track.style.transform = 'translateX(-' + targetSlide.style.left + ')';
            currentSlide.classList.remove('current-slide');
            targetSlide.classList.add('current-slide');
        }
        const updateDots = (currentDot, targetDot) => {
            currentDot.classList.remove('current-slide');
            targetDot.classList.add('current-slide');
        }
        if(nextButton) nextButton.onclick = () => {
            const currentSlide = track.querySelector('.current-slide');
            const nextSlide = currentSlide.nextElementSibling || slides[0];
            const currentDot = dotsNav.querySelector('.current-slide');
            const nextDot = currentDot.nextElementSibling || dots[0];
            moveToSlide(currentSlide, nextSlide);
            updateDots(currentDot, nextDot);
        };
        if(prevButton) prevButton.onclick = () => {
            const currentSlide = track.querySelector('.current-slide');
            const prevSlide = currentSlide.previousElementSibling || slides[slides.length - 1];
            const currentDot = dotsNav.querySelector('.current-slide');
            const prevDot = currentDot.previousElementSibling || dots[dots.length - 1];
            moveToSlide(currentSlide, prevSlide);
            updateDots(currentDot, prevDot);
        };
        if(dotsNav) dotsNav.onclick = (e) => {
            const targetDot = e.target.closest('button');
            if (!targetDot) return;
            const currentSlide = track.querySelector('.current-slide');
            const currentDot = dotsNav.querySelector('.current-slide');
            const targetIndex = dots.findIndex(dot => dot === targetDot);
            const targetSlide = slides[targetIndex];
            moveToSlide(currentSlide, targetSlide);
            updateDots(currentDot, targetDot);
        };
    }
};

window.LemnaCursor = {
    init: () => {
        if(!document.getElementById('magic-cursor')) {
            const img = document.createElement('img');
            img.id = 'magic-cursor'; img.src = 'images/cursor.png'; 
            document.body.appendChild(img);
        }
        const c = document.getElementById('magic-cursor');
        document.addEventListener('mousemove', e => {
            if(document.body.classList.contains('cursor-lemna-active')) { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; }
        });
        document.addEventListener('click', e => {
            if(e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px';
                document.body.classList.add('cursor-lemna-active');
                setTimeout(()=>document.body.classList.remove('cursor-lemna-active'),600);
            }
        });
    }
};

window.ProductGallery = {
    set: (el) => {
        document.getElementById('main-product-img').src = el.src;
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
    },
    next: () => {
        const cur = document.querySelector('.thumb.active');
        const next = cur?.nextElementSibling || document.querySelector('.thumb:first-child');
        if(next) window.ProductGallery.set(next);
    },
    prev: () => {
        const cur = document.querySelector('.thumb.active');
        const prev = cur?.previousElementSibling || document.querySelector('.thumb:last-child');
        if(prev) window.ProductGallery.set(prev);
    }
};

const Store = {
    loadProduct: async () => {
        try {
            const { data } = await db.from('productos').select('*').eq('id', 1).single();
            if(data) {
                const els = {
                    name: document.getElementById('producto-nombre'),
                    price: document.getElementById('producto-precio'),
                    stock: document.getElementById('producto-stock'),
                    idxName: document.getElementById('index-producto-nombre'),
                    idxPrice: document.getElementById('index-producto-precio')
                };
                if(els.name) {
                    els.name.textContent = data.nombre;
                    els.price.textContent = Utils.formatCurrency(data.precio);
                    els.stock.textContent = data.stock_disponible;
                    const layout = document.querySelector('.shop-layout');
                    if(layout) { layout.dataset.pid = data.id; layout.dataset.stock = data.stock_disponible; }
                    const btn = document.getElementById('btn-anadir-carrito');
                    if(btn && data.stock_disponible <= 0) { btn.disabled = true; btn.textContent = "Agotado"; }
                }
                if(els.idxName) {
                    els.idxName.textContent = data.nombre;
                    els.idxPrice.textContent = Utils.formatCurrency(data.precio);
                }
            }
        } catch(e){}
    },
    addToCart: () => {
        const layout = document.querySelector('.shop-layout');
        if(!layout) return;
        const qty = parseInt(document.getElementById('cantidad').value);
        const max = parseInt(layout.dataset.stock);
        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const pid = layout.dataset.pid;
        cart[pid] = (cart[pid] || 0) + qty;
        if(cart[pid] > max) { cart[pid] = max; notify.show('Ajustado al stock máximo', 'info'); }
        else notify.success('Añadido');
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        Store.updateCount();
    },
    clearCart: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY));
        if(!cart || !Object.keys(cart).length) return notify.show('Carrito vacío', 'info');
        Utils.confirmModal('¿Vaciar?', 'Se eliminarán los productos', () => {
            localStorage.removeItem(CONFIG.CART_KEY);
            Store.updateCount();
            if(location.pathname.includes('checkout')) location.reload();
        });
    },
    updateCount: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const count = Object.values(cart).reduce((a,b)=>a+b,0);
        const badge = document.getElementById('carrito-contador');
        const btn = document.getElementById('btn-vaciar-carrito');
        if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block':'none'; }
        if(btn) btn.style.display = count > 0 ? 'inline-block':'none';
    },
    initCheckout: async (user) => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const container = document.getElementById('checkout-items');
        if(!container) return;
        if(!Object.keys(cart).length) {
            container.innerHTML = '<p>Vacío</p>';
            document.getElementById('btn-confirmar-compra').disabled=true;
            return;
        }
        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if(p) {
            const ids = {'checkout-name':'nombre_completo', 'checkout-phone':'telefono', 'checkout-address':'direccion', 'card-holder':'nombre_completo'};
            for(const [k,v] of Object.entries(ids)) {
                const el = document.getElementById(k);
                if(el && !el.value) el.value = p[v]||'';
            }
        }
        let total = 0, items = [], html = '';
        for(const [pid, qty] of Object.entries(cart)) {
            const { data: prod } = await db.from('productos').select('*').eq('id', pid).single();
            if(prod) {
                const sub = prod.precio * qty;
                total += sub;
                items.push({ id: pid, nombre: prod.nombre, cantidad: qty, precio: prod.precio });
                html += `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee"><span>${prod.nombre} x${qty}</span><strong>${Utils.formatCurrency(sub)}</strong></div>`;
            }
        }
        container.innerHTML = html;
        document.getElementById('checkout-total').textContent = Utils.formatCurrency(total);
        document.getElementById('checkout-subtotal').textContent = Utils.formatCurrency(total);

        document.getElementById('form-checkout').onsubmit = async (e) => {
            e.preventDefault();
            const modal = document.getElementById('payment-modal');
            modal.style.display = 'flex';
            try {
                const envio = {
                    nombre: document.getElementById('checkout-name').value,
                    direccion: document.getElementById('checkout-address').value,
                    telefono: document.getElementById('checkout-phone').value,
                    metodo: document.querySelector('input[name="payment-method"]:checked').value
                };
                await db.from('pedidos').insert({ user_id: user.id, items, total, datos_envio: envio, estado: 'Pagado' });
                for(const i of items) {
                    const {data:pr} = await db.from('productos').select('stock_disponible').eq('id',i.id).single();
                    if(pr) await db.from('productos').update({stock_disponible: Math.max(0, pr.stock_disponible - i.cantidad)}).eq('id',i.id);
                }
                await Utils.wait(1500);
                document.getElementById('payment-loading-state').style.display = 'none';
                document.getElementById('payment-success-state').style.display = 'block';
                localStorage.removeItem(CONFIG.CART_KEY);
                setTimeout(() => location.href='cuenta.html', 2000);
            } catch(err) {
                modal.style.display = 'none';
                notify.error(err.message);
            }
        };
    }
};

/* ==========================================================================
 * 7. BOOTSTRAP
 * ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    window.AuthModal.init();
    window.LemnaCursor.init();
    window.Carousel.init();
    Store.updateCount();

    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    const header = document.getElementById('auth-links-container');
    if(header) {
        if(user) header.innerHTML = `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>`;
        else header.innerHTML = `<a href="#" class="nav-link" onclick="window.AuthModal.open(); return false;"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
    }

    const btnTrash = document.getElementById('btn-vaciar-carrito');
    if(btnTrash) btnTrash.onclick = Store.clearCart;

    if(path.includes('panel')) {
        if(user) {
            document.getElementById('login-overlay').style.display='none';
            document.getElementById('dashboard-layout').style.display='flex';
            await Dashboard.init(user); // Wait for init
            // Force initial view
            window.switchTab('planta');
            document.getElementById('btn-logout-panel').onclick = Auth.logout;
        } else {
            document.getElementById('panel-login-form').onsubmit = Auth.login;
        }
    }
    else if(path.includes('cuenta')) {
        if(user) {
            document.getElementById('auth-forms').style.display='none';
            document.getElementById('user-info').style.display='grid';
            Auth.loadProfile(user);
            document.getElementById('form-perfil').onsubmit = (e) => Auth.saveProfile(e, user);
            document.getElementById('btn-logout').onclick = Auth.logout;
            document.getElementById('btn-tab-datos').onclick=()=>{document.getElementById('seccion-mis-datos').style.display='block';document.getElementById('seccion-mis-pedidos').style.display='none';};
            document.getElementById('btn-tab-pedidos').onclick=()=>{document.getElementById('seccion-mis-datos').style.display='none';document.getElementById('seccion-mis-pedidos').style.display='block';Auth.loadProfile(user);};
        } else {
            document.querySelector('.container').innerHTML = `<div style="padding:4rem;text-align:center"><h2>Acceso Restringido</h2><button class="btn btn-primary" onclick="window.AuthModal.open()">Entrar</button></div>`;
        }
    }
    else if(path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
        Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if(btn) btn.onclick = Store.addToCart;
    }
    else if(path.includes('checkout')) {
        if(user) {
            document.getElementById('checkout-login-prompt').style.display='none';
            document.getElementById('checkout-container').style.display='grid';
            Store.initCheckout(user);
        } else {
            document.getElementById('checkout-login-prompt').style.display='block';
            document.getElementById('checkout-login-prompt').innerHTML=`<div style="text-align:center"><h2>Inicia sesión</h2><br><button class="btn btn-primary" onclick="window.AuthModal.open()">Entrar</button></div>`;
        }
    }
});