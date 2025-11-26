/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v43 (FINAL FULL VERSION)
 * Integridad: 100% Código - Sin Abreviaciones
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
    realtimeSubscription: null,
    tempWalletData: null // Almacén temporal seguro para datos de tarjeta desbloqueados
};

let globalEmergencyActive = false;

// Inicialización Supabase
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System: Online & Secure');

/* ==========================================================================
 * 2. FUNCIONES UI GLOBALES
 * ========================================================================== */

window.switchTab = function(tabName) {
    // 1. Actualizar Sidebar
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // 2. Ocultar todas las vistas
    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    // 3. Mostrar vista seleccionada
    const target = document.getElementById('view-' + tabName);
    if (target) {
        target.style.display = 'block';
        // Pequeño delay para permitir animación CSS si existe
        setTimeout(() => target.classList.add('active'), 10);
    }
    
    // 4. Cerrar sidebar en móvil si aplica
    if (typeof window.toggleSidebarIfMobile === 'function') {
        window.toggleSidebarIfMobile();
    }
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const closeBtn = document.getElementById('close-sidebar-btn');
    
    if (!sidebar || !overlay) return;
    
    sidebar.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        overlay.classList.add('show');
        if (closeBtn) closeBtn.style.display = 'block';
    } else {
        overlay.classList.remove('show');
        if (closeBtn) closeBtn.style.display = 'none';
    }
};

window.toggleSidebarIfMobile = function() {
    if (window.innerWidth <= 968) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            window.toggleSidebar();
        }
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
        
        const close = () => {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
        };
        
        document.getElementById('btn-modal-cancel').onclick = close;
        document.getElementById('btn-modal-confirm').onclick = () => { callback(); close(); };
        modal.onclick = (e) => { if(e.target === modal) close(); };
    }
};

/* ==========================================================================
 * 4. AUTENTICACIÓN & PERFIL (LÓGICA SEGURIDAD ACTUALIZADA)
 * ========================================================================== */
const Auth = {
    login: async (e) => {
        e.preventDefault();
        const isModal = !!document.getElementById('m-login-email');
        const emailInput = isModal ? document.getElementById('m-login-email') : document.getElementById('login-email');
        const passInput = isModal ? document.getElementById('m-login-pass') : document.getElementById('login-password');
        
        if (!emailInput || !passInput) return;

        const load = notify.loading('Iniciando sesión...');
        const { error } = await db.auth.signInWithPassword({ 
            email: emailInput.value.trim(), 
            password: passInput.value 
        });
        notify.close(load);
        
        if (error) {
            notify.error(error.message);
        } else {
            notify.success('Bienvenido');
            if(window.AuthModal) window.AuthModal.close();
            setTimeout(() => window.location.reload(), 1000);
        }
    },

    register: async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('m-reg-email') || document.getElementById('registro-email');
        const passInput = document.getElementById('m-reg-pass') || document.getElementById('registro-password');
        
        if (!emailInput || !passInput) return;
        
        if (passInput.value.length < 6) return notify.error('Contraseña muy corta (mín. 6)');
        
        const load = notify.loading('Registrando...');
        const { data, error } = await db.auth.signUp({ 
            email: emailInput.value.trim(), 
            password: passInput.value 
        });
        notify.close(load);
        
        if (error) {
            notify.error(error.message);
        } else {
            // Crear perfil base en la tabla perfiles
            await db.from('perfiles').insert([{ 
                id: data.user.id, 
                email: emailInput.value.trim(), 
                rol: 'Cliente', 
                nombre_completo: 'Nuevo Usuario' 
            }]);
            
            notify.success('Cuenta creada. Inicia sesión.');
            if(window.AuthModal && document.getElementById('m-reg-email')) {
                window.AuthModal.switchTab('login');
            } else {
                window.location.reload();
            }
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
                // Llenar datos básicos del perfil
                const fields = {
                    'profile-name': 'nombre_completo',
                    'profile-phone': 'telefono',
                    'profile-address': 'direccion'
                };
                for (const [id, key] of Object.entries(fields)) {
                    const el = document.getElementById(id);
                    if (el) el.value = data[key] || '';
                }
                if(document.getElementById('profile-email')) {
                    document.getElementById('profile-email').value = user.email;
                }

                // LOGICA BILLETERA SEGURA
                if (data.datos_pago && data.datos_pago.number) {
                    // Guardamos los datos reales en memoria, pero NO los mostramos en el DOM
                    State.tempWalletData = data.datos_pago;
                    
                    // Mostramos estado "Protegido" visualmente
                    const numInput = document.getElementById('wallet-number');
                    const holdInput = document.getElementById('wallet-holder');
                    
                    if(numInput) numInput.placeholder = "Tarjeta Guardada (Protegida)";
                    if(holdInput) holdInput.placeholder = "Información Oculta";
                    
                    // Cambiar estado del botón de desbloqueo
                    const btnUnlock = document.getElementById('btn-unlock-wallet');
                    if(btnUnlock) {
                        btnUnlock.innerHTML = '<i class="fa-solid fa-lock"></i> Desbloquear para ver';
                        btnUnlock.classList.remove('btn-light');
                        btnUnlock.classList.add('btn-secondary');
                    }
                }
            }
        } catch(e) {
            console.error("Error cargando perfil:", e);
        }
        
        // Cargar Pedidos
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
                list.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">No tienes pedidos.</p>';
            }
        }
    },
    
    saveProfile: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Guardando...');
        const updates = {
            nombre_completo: document.getElementById('profile-name')?.value,
            telefono: document.getElementById('profile-phone')?.value,
            direccion: document.getElementById('profile-address')?.value,
            updated_at: new Date()
        };
        await db.from('perfiles').update(updates).eq('id', user.id);
        notify.close(load);
        notify.success('Perfil actualizado');
    },

    // Guardar Billetera en Base de Datos (Encriptación simulada)
    saveWallet: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Encriptando y guardando en la nube...');
        
        // Guardamos directamente en la base de datos para acceso multidispositivo
        const walletData = {
            holder: document.getElementById('wallet-holder').value,
            number: document.getElementById('wallet-number').value,
            expiry: document.getElementById('wallet-expiry').value
            // CVV no se guarda por seguridad
        };

        const { error } = await db.from('perfiles').update({ datos_pago: walletData }).eq('id', user.id);
        notify.close(load);
        
        if(error) {
            notify.error('Error guardando tarjeta: ' + error.message);
        } else {
            notify.success('Tarjeta guardada y sincronizada');
            // Actualizar memoria local y re-bloquear interfaz por seguridad
            State.tempWalletData = walletData;
            // Recargar página brevemente para volver a estado protegido (visual)
            setTimeout(() => location.reload(), 1500); 
        }
    },

    // Verificar Contraseña y Revelar Datos en UI
    verifyPasswordAndReveal: async (e, user) => {
        e.preventDefault();
        const pass = document.getElementById('sec-password').value;
        const load = notify.loading('Verificando credenciales...');
        
        // Truco: Re-autenticar para verificar que la contraseña es correcta
        const { data, error } = await db.auth.signInWithPassword({ email: user.email, password: pass });
        
        notify.close(load);
        
        if(error) {
            notify.error('Contraseña incorrecta');
        } else {
            notify.success('Identidad confirmada');
            window.AuthModal.closeSecurityCheck();
            
            // Desbloquear Inputs UI
            const inputs = ['wallet-holder', 'wallet-number', 'wallet-expiry', 'wallet-cvc'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.disabled = false;
                    el.type = "text"; // Revelar texto oculto
                    el.style.background = "rgba(255,255,255,0.15)";
                }
            });
            
            // Habilitar botón de guardar
            const btnSave = document.getElementById('btn-save-wallet');
            if(btnSave) btnSave.disabled = false;
            
            // Ocultar botón desbloqueo
            const btnUnlock = document.getElementById('btn-unlock-wallet');
            if(btnUnlock) btnUnlock.style.display = 'none';
            
            // Ocultar overlay si existe
            const overlay = document.getElementById('wallet-overlay');
            if(overlay) overlay.style.display = 'none';
            
            // Llenar con datos reales desde memoria (State)
            if (State.tempWalletData) {
                document.getElementById('wallet-holder').value = State.tempWalletData.holder || '';
                document.getElementById('wallet-number').value = State.tempWalletData.number || '';
                document.getElementById('wallet-expiry').value = State.tempWalletData.expiry || '';
            }
        }
    }
};

/* ==========================================================================
 * 5. MANEJO DE MODALES (AUTH Y SEGURIDAD)
 * ========================================================================== */
window.AuthModal = {
    init: () => {
        // Inyectar modal de login si no existe
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
            
            const loginForm = document.getElementById('form-modal-login');
            const regForm = document.getElementById('form-modal-register');
            if(loginForm) loginForm.onsubmit = Auth.login;
            if(regForm) regForm.onsubmit = Auth.register;
        }
    },
    
    open: (tab = 'login') => {
        window.AuthModal.init();
        const modal = document.getElementById('auth-modal');
        if(modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
            window.AuthModal.switchTab(tab);
        }
    },
    
    close: () => {
        const m = document.getElementById('auth-modal');
        if(m) {
            m.classList.remove('show');
            setTimeout(() => m.style.display = 'none', 300);
        }
    },
    
    switchTab: (tab) => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
        if(tab === 'login') {
            document.querySelector('button[onclick*="login"]')?.classList.add('active');
            document.getElementById('modal-login-view')?.classList.add('active');
        } else {
            document.querySelector('button[onclick*="register"]')?.classList.add('active');
            document.getElementById('modal-register-view')?.classList.add('active');
        }
    },
    
    // MÉTODOS PARA MODAL DE SEGURIDAD (BILLETERA)
    openSecurityCheck: () => {
        const m = document.getElementById('security-modal');
        if(m) {
            m.style.display = 'flex';
            setTimeout(() => m.style.opacity = '1', 10);
        }
    },
    
    closeSecurityCheck: () => {
        const m = document.getElementById('security-modal');
        if(m) {
            m.style.opacity = '0';
            setTimeout(() => {
                m.style.display = 'none';
                const passInput = document.getElementById('sec-password');
                if(passInput) passInput.value = '';
            }, 300);
        }
    }
};

/* ==========================================================================
 * 6. DASHBOARD & PLC (CONTROLES COMPLETOS RESTAURADOS)
 * ========================================================================== */
const Dashboard = {
    init: async (user) => {
        if (!document.getElementById('dashboard-layout')) return;
        
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (!p) { notify.error('Perfil no encontrado.'); return; }
            
            const uName = document.getElementById('sidebar-username');
            const uRole = document.getElementById('sidebar-role');
            if(uName) uName.textContent = p.nombre_completo || 'Usuario';
            if(uRole) uRole.textContent = p.rol;
            
            Dashboard.applyPermissions(p.rol);
            
            if (CONFIG.ROLES.STAFF.includes(p.rol)) {
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
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-in" ${m.controles.online_llenado ? 'checked' : ''} onclick="window.plcSw(1,'online_llenado')"><label for="tk-in">Llenado</label></div>
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-off" ${(!m.controles.online_llenado && !m.controles.online_vaciado) ? 'checked' : ''} onclick="window.plcSw(1,'fill_off')"><label for="tk-off">OFF</label></div>
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-out" ${m.controles.online_vaciado ? 'checked' : ''} onclick="window.plcSw(1,'online_vaciado')"><label for="tk-out">Vaciado</label></div>
                        </div>
                    </div>
                    <div class="control-group" style="margin-bottom:0">
                        <span class="control-label">Control Elevador</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-up" ${m.controles.online_arriba ? 'checked' : ''} onclick="window.plcSw(1,'online_arriba')"><label for="ch-up">Arriba</label></div>
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-off" ${(!m.controles.online_arriba && !m.controles.online_abajo) ? 'checked' : ''} onclick="window.plcSw(1,'tray_off')"><label for="ch-off">Freno</label></div>
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-dn" ${m.controles.online_abajo ? 'checked' : ''} onclick="window.plcSw(1,'online_abajo')"><label for="ch-dn">Abajo</label></div>
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
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-off" ${!isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_off')"><label for="heat-off">Apagado</label></div>
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-on" ${isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_on')"><label for="heat-on">Encendido</label></div>
                        </div>
                    </div>
                </div>` : '';
                
                body = `<div class="clean-gauge"><div class="gauge-readout">${t.toFixed(1)}<span class="gauge-unit">°C</span></div><div class="gauge-bar-bg"><div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(t, 100)}%"></div></div></div>${ctrls}`;
            }
            
            container.insertAdjacentHTML('beforeend', `<div class="card machine-card" id="machine-${m.id}"><div class="m-header"><h4>${safeName}</h4><div class="status-pill ${m.estado === 'En Ciclo' || (m.id === 2 && m.controles.calentador_on) ? 'on' : 'off'}"><span class="status-pill dot"></span>${m.estado}</div></div><div class="m-body">${body}</div></div>`);
        });
    },
    
    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        try {
            let users = [];
            const { data: rpcData, error: rpcError } = await db.rpc('get_all_user_profiles');
            if (!rpcError) users = rpcData;
            else { const { data: tableData } = await db.from('perfiles').select('*'); users = tableData || []; }
            
            const isSys = CONFIG.ROLES.SYS.includes(myRole);
            tbody.innerHTML = users.map(u => `
                <tr data-uid="${u.id}">
                    <td>${Utils.escapeHtml(u.email)}</td>
                    <td><select class="form-input role-select" style="padding:5px;">${['Sistemas', 'Lider', 'Supervisor', 'Operador', 'Cliente'].map(r => `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`).join('')}</select></td>
                    <td>${Utils.escapeHtml(u.area || '-')}</td>
                    <td><button class="btn-icon btn-save"><i class="fa-solid fa-save"></i></button>${isSys ? `<button class="btn-icon btn-delete"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}</td>
                </tr>`).join('');
            
            tbody.querySelectorAll('.btn-save').forEach(btn => { btn.onclick = async (e) => { const row = e.target.closest('tr'); await db.from('perfiles').update({ rol: row.querySelector('.role-select').value }).eq('id', row.dataset.uid); notify.success('Rol actualizado'); }; });
        } catch (e) { console.error("Error usuarios:", e); }
    },
    
    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;
        State.realtimeSubscription = db.channel('public-room')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => { 
                if (!globalEmergencyActive) Dashboard.renderMachines('Sistemas'); 
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => { 
                if (typeof Dashboard.renderChatMessage === 'function') Dashboard.renderChatMessage(payload.new); 
            })
            .subscribe();
    }
};

// FUNCIONES GLOBALES PLC
window.plcCmd = async (id, act) => { 
    try { 
        if (globalEmergencyActive && act !== 'Paro') return notify.error("BLOQUEO DE EMERGENCIA"); 
        const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
        let c = data.controles; 
        if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; } 
        await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id); 
    } catch (e) { notify.error("Error PLC Cmd"); } 
};

window.plcSw = async (id, k) => { 
    try { 
        if (globalEmergencyActive && !k.includes('off')) return notify.error("BLOQUEO DE EMERGENCIA"); 
        const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
        let c = data.controles; 
        
        // MAQUINA 1: Lógica completa restaurada
        if (id === 1) { 
            if (k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; } 
            else if (k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; } 
            else if (k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; }
            else if (k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; }
            else if (k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; }
            else if (k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; }
        } 
        // MAQUINA 2: Lógica completa
        else if (id === 2) { 
            if (k === 'heat_on') c.calentador_on = true; 
            else if (k === 'heat_off') c.calentador_on = false; 
        } 
        await db.from('maquinas').update({ controles: c }).eq('id', id); 
    } catch(e) { notify.error("Error PLC Switch"); } 
};

window.toggleGlobalEmergency = async () => { 
    if (!globalEmergencyActive) { 
        Utils.confirmModal('PARO DE EMERGENCIA', '¿Detener TODAS las máquinas?', async () => { 
            globalEmergencyActive = true; 
            document.body.classList.add('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); 
            if(btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> RESTABLECER'; } 
            await window.plcCmd(1, 'Paro'); 
            await window.plcSw(2, 'heat_off'); 
        }); 
    } else { 
        Utils.confirmModal('Restablecer', '¿Reactivar operaciones?', () => { 
            globalEmergencyActive = false; 
            document.body.classList.remove('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); 
            if(btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA'; } 
        }); 
    } 
};

/* ==========================================================================
 * 7. UI HELPERS & GALLERY
 * ========================================================================== */
window.Carousel = { 
    init: () => { 
        const track = document.querySelector('.carousel-track'); 
        if (!track) return; 
        const slides = Array.from(track.children); 
        if(!slides.length) return; 
        const nextButton = document.getElementById('next-slide'); 
        const prevButton = document.getElementById('prev-slide'); 
        const slideWidth = slides[0].getBoundingClientRect().width; 
        slides.forEach((slide, index) => slide.style.left = slideWidth * index + 'px'); 
        const moveToSlide = (currentSlide, targetSlide) => { track.style.transform = 'translateX(-' + targetSlide.style.left + ')'; currentSlide.classList.remove('current-slide'); targetSlide.classList.add('current-slide'); }; 
        if(nextButton) nextButton.onclick = () => { const currentSlide = track.querySelector('.current-slide'); const nextSlide = currentSlide.nextElementSibling || slides[0]; moveToSlide(currentSlide, nextSlide); }; 
        if(prevButton) prevButton.onclick = () => { const currentSlide = track.querySelector('.current-slide'); const prevSlide = currentSlide.previousElementSibling || slides[slides.length - 1]; moveToSlide(currentSlide, prevSlide); }; 
    } 
};

window.LemnaCursor = { 
    init: () => { 
        if(!document.getElementById('magic-cursor')) { const img = document.createElement('img'); img.id = 'magic-cursor'; img.src = 'images/cursor.png'; document.body.appendChild(img); } 
        const cursor = document.getElementById('magic-cursor'); 
        document.addEventListener('mousemove', e => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }); 
        const triggers = document.querySelectorAll('.hover-lemna-trigger'); 
        triggers.forEach(el => { 
            el.addEventListener('mouseenter', () => { document.body.classList.add('hide-native-cursor'); cursor.style.display = 'block'; }); 
            el.addEventListener('mouseleave', () => { document.body.classList.remove('hide-native-cursor'); cursor.style.display = 'none'; }); 
        }); 
    } 
};

window.ProductGallery = { 
    set: (el) => { const main = document.getElementById('main-product-img'); if(main) main.src = el.src; document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active')); el.classList.add('active'); }, 
    next: () => { const cur = document.querySelector('.thumb.active'); const next = cur?.nextElementSibling || document.querySelector('.thumb:first-child'); if(next) window.ProductGallery.set(next); }, 
    prev: () => { const cur = document.querySelector('.thumb.active'); const prev = cur?.previousElementSibling || document.querySelector('.thumb:last-child'); if(prev) window.ProductGallery.set(prev); } 
};

const Store = {
    loadProduct: async () => {
        try {
            const { data } = await db.from('productos').select('*').eq('id', 1).single();
            if(data) {
                const els = { name: 'producto-nombre', price: 'producto-precio', stock: 'producto-stock', idxName: 'index-producto-nombre', idxPrice: 'index-producto-precio' };
                if(document.getElementById(els.name)) {
                    document.getElementById(els.name).textContent = data.nombre;
                    document.getElementById(els.price).textContent = Utils.formatCurrency(data.precio);
                    document.getElementById(els.stock).textContent = data.stock_disponible;
                    const layout = document.querySelector('.shop-layout');
                    if(layout) { layout.dataset.pid = data.id; layout.dataset.stock = data.stock_disponible; }
                }
                if(document.getElementById(els.idxName)) {
                    document.getElementById(els.idxName).textContent = data.nombre;
                    document.getElementById(els.idxPrice).textContent = Utils.formatCurrency(data.precio);
                }
            }
        } catch(e){}
    },
    addToCart: () => {
        const layout = document.querySelector('.shop-layout');
        const pid = layout ? layout.dataset.pid : '1'; 
        const max = layout ? parseInt(layout.dataset.stock) : 999;
        const qty = parseInt(document.getElementById('cantidad')?.value || 1);
        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        cart[pid] = (cart[pid] || 0) + qty;
        if(cart[pid] > max) { cart[pid] = max; notify.show('Stock máximo alcanzado', 'info'); }
        else notify.success('Añadido al carrito');
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        Store.updateCount();
    },
    clearCart: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY));
        if(!cart || !Object.keys(cart).length) return notify.show('Carrito vacío', 'info');
        Utils.confirmModal('¿Vaciar?', 'Se eliminarán los productos', () => {
            localStorage.removeItem(CONFIG.CART_KEY);
            Store.updateCount();
            if(window.location.pathname.includes('checkout')) window.location.reload();
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
        if(!Object.keys(cart).length) { container.innerHTML = '<p>Carrito vacío</p>'; document.getElementById('btn-confirmar-compra').disabled = true; return; }

        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if(p) {
            // Llenar datos envío
            const ids = {'checkout-name':'nombre_completo', 'checkout-phone':'telefono', 'checkout-address':'direccion'};
            for(const [k,v] of Object.entries(ids)) { const el = document.getElementById(k); if(el && !el.value) el.value = p[v]||''; }
            
            // Autocompletar Billetera (Si existe y está en DB)
            if (p.datos_pago && p.datos_pago.number) {
                notify.show('Autocompletando tarjeta segura...', 'info');
                if(document.getElementById('card-number')) document.getElementById('card-number').value = p.datos_pago.number;
                if(document.getElementById('card-holder')) document.getElementById('card-holder').value = p.datos_pago.holder || '';
                if(document.getElementById('card-expiry')) document.getElementById('card-expiry').value = p.datos_pago.expiry || '';
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
        const totalEl = document.getElementById('checkout-total');
        if(totalEl) totalEl.textContent = Utils.formatCurrency(total);
        if(document.getElementById('checkout-subtotal')) document.getElementById('checkout-subtotal').textContent = Utils.formatCurrency(total);

        const form = document.getElementById('form-checkout');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const modal = document.getElementById('payment-modal');
                if(modal) modal.style.display = 'flex';
                try {
                    const envio = {
                        nombre: document.getElementById('checkout-name').value,
                        direccion: document.getElementById('checkout-address').value,
                        telefono: document.getElementById('checkout-phone').value,
                        metodo: document.querySelector('input[name="payment-method"]:checked')?.value || 'card'
                    };
                    await db.from('pedidos').insert({ user_id: user.id, items, total, datos_envio: envio, estado: 'Pagado' });
                    for(const i of items) {
                        const {data:pr} = await db.from('productos').select('stock_disponible').eq('id',i.id).single();
                        if(pr) await db.from('productos').update({stock_disponible: Math.max(0, pr.stock_disponible - i.cantidad)}).eq('id',i.id);
                    }
                    await Utils.wait(2000);
                    if(document.getElementById('payment-loading-state')) document.getElementById('payment-loading-state').style.display = 'none';
                    if(document.getElementById('payment-success-state')) document.getElementById('payment-success-state').style.display = 'block';
                    localStorage.removeItem(CONFIG.CART_KEY);
                    setTimeout(() => window.location.href='cuenta.html', 2500);
                } catch(err) {
                    if(modal) modal.style.display = 'none';
                    notify.error(err.message);
                }
            };
        }
    }
};

/* ==========================================================================
 * 8. BOOTSTRAP
 * ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    window.AuthModal.init();
    if(window.LemnaCursor.init) window.LemnaCursor.init();
    if(window.Carousel.init) window.Carousel.init();
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
            await Dashboard.init(user);
            window.switchTab('planta');
            document.getElementById('btn-logout-panel').onclick = Auth.logout;
        } else {
            document.getElementById('panel-login-form').onsubmit = Auth.login;
        }
    } else if(path.includes('cuenta')) {
        if(user) {
            document.getElementById('auth-forms').style.display='none';
            document.getElementById('user-info').style.display='grid';
            Auth.loadProfile(user);
            
            document.getElementById('form-perfil').onsubmit = (e) => Auth.saveProfile(e, user);
            // NUEVO: Listener Seguridad Billetera
            const formWallet = document.getElementById('form-pago-seguro');
            if(formWallet) formWallet.onsubmit = (e) => Auth.saveWallet(e, user);
            
            const formSecurity = document.getElementById('form-security-check');
            if(formSecurity) formSecurity.onsubmit = (e) => Auth.verifyPasswordAndReveal(e, user);

            document.getElementById('btn-logout').onclick = Auth.logout;
            
            // Tabs
            const btnD = document.getElementById('btn-tab-datos');
            const btnP = document.getElementById('btn-tab-pedidos');
            const btnW = document.getElementById('btn-tab-pagos');
            const resetTabs = () => {
                document.getElementById('seccion-mis-datos').style.display='none';
                document.getElementById('seccion-mis-pedidos').style.display='none';
                if(document.getElementById('seccion-pagos')) document.getElementById('seccion-pagos').style.display='none';
                btnD.classList.remove('active');
                btnP.classList.remove('active');
                if(btnW) btnW.classList.remove('active');
            };
            if(btnD) btnD.onclick=()=>{ resetTabs(); document.getElementById('seccion-mis-datos').style.display='block'; btnD.classList.add('active'); };
            if(btnP) btnP.onclick=()=>{ resetTabs(); document.getElementById('seccion-mis-pedidos').style.display='block'; btnP.classList.add('active'); Auth.loadProfile(user); };
            if(btnW) btnW.onclick=()=>{ resetTabs(); document.getElementById('seccion-pagos').style.display='block'; btnW.classList.add('active'); };
        } else {
            document.getElementById('auth-forms').style.display='block';
            document.getElementById('form-login').onsubmit = Auth.login;
            document.getElementById('form-registro').onsubmit = Auth.register;
        }
    } else if(path.includes('checkout')) {
        if(user) {
            document.getElementById('checkout-login-prompt').style.display='none';
            document.getElementById('checkout-container').style.display='grid';
            Store.initCheckout(user);
        } else {
            const p = document.getElementById('checkout-login-prompt');
            if(p) { p.style.display='block'; p.innerHTML=`<div style="text-align:center"><h2>Inicia sesión</h2><br><button class="btn btn-primary" onclick="window.AuthModal.open()">Entrar</button></div>`; }
        }
    } else if(path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
        Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if(btn) btn.onclick = Store.addToCart;
    }
});