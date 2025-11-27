/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v67 (UPSERT FIX)
 * Integridad: 100% - Soluciona error de "Llave Duplicada" en perfiles.
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
    tempWalletData: null,
    userProfile: null,
    chartInstance: null,
    machinePhysics: { m2_temp: 0, m2_heating: false },
    lastAlertTime: 0
};

let globalEmergencyActive = false;

// Inicialización Supabase
const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System v67: Database Conflict Resolved');

/* --------------------------------------------------------------------------
   2. FUNCIONES GLOBALES (Window Binding Inmediato)
   -------------------------------------------------------------------------- */

// Utilidades
window.Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val),
    formatTime: (dateStr) => dateStr ? new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--:--',
    escapeHtml: (text) => text ? text.toString().replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) : '',
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    confirmModal: (title, message, callback, btnClass = 'btn-primary-modal-danger', btnText = 'Confirmar') => {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const modalHTML = `
            <div id="custom-confirm-modal" class="modal-overlay" style="display:flex; opacity:1;">
                <div class="modal-content-premium">
                    <div class="modal-icon-warning"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button id="btn-modal-cancel" class="btn-secondary-modal">Cancelar</button>
                        <button id="btn-modal-confirm" class="${btnClass}">${btnText}</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('custom-confirm-modal');
        const close = () => modal.remove();
        
        document.getElementById('btn-modal-cancel').onclick = close;
        document.getElementById('btn-modal-confirm').onclick = () => { callback(); close(); };
        modal.onclick = (e) => { if(e.target === modal) close(); };
    }
};

// Notificaciones
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

// Navegación del Panel
window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    
    // Selector robusto para encontrar el botón activo
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');

    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(v => { 
        v.style.display = 'none'; 
        v.classList.remove('active'); 
    });

    const target = document.getElementById('view-' + tabName);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
        
        if (tabName === 'reportes' && window.Dashboard) window.Dashboard.renderReports();
        if (tabName === 'ventas' && window.Dashboard) window.Dashboard.renderSales();
    }
    
    if (window.innerWidth <= 968) window.toggleSidebar();
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const closeBtn = document.getElementById('close-sidebar-btn');
    if (!sidebar) return;
    
    sidebar.classList.toggle('active');
    const isActive = sidebar.classList.contains('active');
    
    if (overlay) overlay.classList.toggle('show', isActive);
    if (closeBtn) closeBtn.style.display = isActive ? 'block' : 'none';
};

window.toggleSidebarIfMobile = function() {
    if (window.innerWidth <= 968) window.toggleSidebar();
};

/* --------------------------------------------------------------------------
   3. MÓDULO DE AUTENTICACIÓN (Window Bound)
   -------------------------------------------------------------------------- */
window.Auth = {
    login: async (e) => {
        e.preventDefault();
        
        const formId = e.target.id;
        let emailInput, passInput;

        if (formId === 'panel-login-form') {
            emailInput = document.getElementById('login-email');
            passInput = document.getElementById('login-password');
        } else {
            emailInput = document.getElementById('m-login-email') || document.getElementById('login-email');
            passInput = document.getElementById('m-login-pass') || document.getElementById('login-password');
        }
        
        if (!emailInput || !passInput || !emailInput.value || !passInput.value) {
            return notify.error('Complete todos los campos');
        }

        const load = notify.loading('Autenticando...');
        const { error } = await db.auth.signInWithPassword({ 
            email: emailInput.value.trim(), 
            password: passInput.value 
        });
        notify.close(load);
        
        if (error) {
            notify.error(error.message);
        } else {
            notify.success('Acceso Correcto');
            if(window.AuthModal && typeof window.AuthModal.close === 'function') window.AuthModal.close();
            setTimeout(() => window.location.reload(), 800);
        }
    },

    register: async (e) => {
        e.preventDefault();
        const form = e.target;
        const emailInput = form.querySelector('input[type="email"]');
        const passInput = form.querySelector('input[type="password"]');
        
        if (!emailInput || !passInput) return;
        
        const load = notify.loading('Registrando...');
        const { data, error } = await db.auth.signUp({ 
            email: emailInput.value.trim(), 
            password: passInput.value 
        });
        notify.close(load);
        
        if (error) {
            notify.error(error.message);
        } else {
            // [CORRECCIÓN v67] Usar UPSERT para evitar conflicto con triggers
            await db.from('perfiles').upsert([{ 
                id: data.user.id, 
                email: emailInput.value.trim(), 
                rol: 'Cliente', 
                nombre_completo: 'Nuevo Usuario' 
            }]);
            notify.success('Cuenta creada.');
            window.location.reload();
        }
    },

    logout: async () => {
        const load = notify.loading('Cerrando sesión...');
        if (State.telemetryInterval) clearInterval(State.telemetryInterval);
        if (State.realtimeSubscription) {
            supabase.removeChannel(State.realtimeSubscription);
        }
        await db.auth.signOut();
        notify.close(load);
        window.location.href = 'index.html';
    },
    
    loadProfile: async (user) => {
        try {
            const { data } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (data) {
                State.userProfile = data; 
                
                const map = {'profile-name': 'nombre_completo', 'profile-phone': 'telefono', 'profile-address': 'direccion'};
                for (const [id, key] of Object.entries(map)) {
                    const el = document.getElementById(id);
                    if (el) el.value = data[key] || '';
                }
                const emailField = document.getElementById('profile-email');
                if(emailField) emailField.value = user.email;

                if (data.datos_pago && data.datos_pago.number) {
                    State.tempWalletData = data.datos_pago;
                    const wNum = document.getElementById('wallet-number');
                    const wHold = document.getElementById('wallet-holder');
                    if(wNum) wNum.placeholder = "•••• •••• •••• " + data.datos_pago.number.slice(-4);
                    if(wHold) wHold.placeholder = "Información Protegida";
                    
                    const btnUnlock = document.getElementById('btn-unlock-wallet');
                    if(btnUnlock) {
                        btnUnlock.innerHTML = '<i class="fa-solid fa-lock"></i> Desbloquear para ver';
                        btnUnlock.classList.replace('btn-light', 'btn-secondary');
                    }
                }
            }
        } catch(e) { console.error(e); }
        
        window.Store.renderOrders(user.id);
    },
    
    saveProfile: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Guardando...');
        await db.from('perfiles').update({
            nombre_completo: document.getElementById('profile-name')?.value,
            telefono: document.getElementById('profile-phone')?.value,
            direccion: document.getElementById('profile-address')?.value
        }).eq('id', user.id);
        notify.close(load);
        notify.success('Guardado');
    },

    verifyPasswordAndReveal: async (e, user) => {
        e.preventDefault();
        const pass = document.getElementById('sec-password').value;
        const load = notify.loading('Verificando...');
        const { error } = await db.auth.signInWithPassword({ email: user.email, password: pass });
        notify.close(load);
        
        if(error) notify.error('Contraseña incorrecta');
        else {
            notify.success('Identidad confirmada');
            window.AuthModal.closeSecurityCheck();
            ['wallet-holder', 'wallet-number', 'wallet-expiry', 'wallet-cvc'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.disabled = false; el.type = "text"; el.style.background = "rgba(255,255,255,0.15)"; }
            });
            const btnSave = document.getElementById('btn-save-wallet');
            if(btnSave) btnSave.disabled = false;
            
            const btnUnlock = document.getElementById('btn-unlock-wallet');
            if(btnUnlock) btnUnlock.style.display = 'none';
            
            const overlay = document.getElementById('wallet-overlay');
            if(overlay) overlay.style.display = 'none';
            
            if (State.tempWalletData) {
                document.getElementById('wallet-holder').value = State.tempWalletData.holder || '';
                document.getElementById('wallet-number').value = State.tempWalletData.number || '';
                document.getElementById('wallet-expiry').value = State.tempWalletData.expiry || '';
            }
        }
    }
};

/* --------------------------------------------------------------------------
   4. MODULO AUTH MODAL (Window Bound)
   -------------------------------------------------------------------------- */
window.AuthModal = {
    init: () => {
        if (document.getElementById('auth-modal')) return;

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
                    <form id="form-modal-login">
                        <div class="input-group"><input type="email" id="m-login-email" class="form-input" placeholder="Email" required></div>
                        <div class="input-group"><input type="password" id="m-login-pass" class="form-input" placeholder="Contraseña" required></div>
                        <button type="submit" class="btn btn-primary" style="width:100%">ENTRAR</button>
                    </form>
                </div>
                <div id="modal-register-view" class="auth-view">
                    <div class="auth-header"><img src="images/logo.png"><h4>Crear Cuenta</h4><p>Regístrate</p></div>
                    <form id="form-modal-register">
                        <div class="input-group"><input type="email" id="m-reg-email" class="form-input" placeholder="Email" required></div>
                        <div class="input-group"><input type="password" id="m-reg-pass" class="form-input" placeholder="Contraseña (min 6)" required minlength="6"></div>
                        <button type="submit" class="btn btn-primary" style="width:100%">REGISTRARSE</button>
                    </form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Vincular eventos
        const loginForm = document.getElementById('form-modal-login');
        if(loginForm) loginForm.onsubmit = window.Auth.login;
        
        const regForm = document.getElementById('form-modal-register');
        if(regForm) regForm.onsubmit = window.Auth.register;
    },
    open: (tab = 'login') => { 
        window.AuthModal.init(); 
        const m = document.getElementById('auth-modal'); 
        if(m) {
            m.style.display = 'flex'; 
            setTimeout(()=>m.classList.add('show'),10); 
            window.AuthModal.switchTab(tab); 
        }
    },
    close: () => { 
        const m = document.getElementById('auth-modal'); 
        if(m) { 
            m.classList.remove('show'); 
            setTimeout(()=>m.style.display='none',300); 
        } 
    },
    switchTab: (tab) => {
        document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.auth-view').forEach(v=>v.classList.remove('active'));
        if(tab==='login') { 
            document.querySelector('button[onclick*="login"]')?.classList.add('active'); 
            document.getElementById('modal-login-view')?.classList.add('active'); 
        } else { 
            document.querySelector('button[onclick*="register"]')?.classList.add('active'); 
            document.getElementById('modal-register-view')?.classList.add('active'); 
        }
    },
    openSecurityCheck: () => { const m = document.getElementById('security-modal'); if(m) { m.style.display='flex'; setTimeout(()=>m.style.opacity='1',10); } },
    closeSecurityCheck: () => { const m = document.getElementById('security-modal'); if(m) { m.style.opacity='0'; setTimeout(()=>{m.style.display='none'; document.getElementById('sec-password').value='';},300); } }
};

/* --------------------------------------------------------------------------
   5. TELEMETRÍA (Window Bound)
   -------------------------------------------------------------------------- */
window.Telemetry = {
    init: () => {
        const ctx = document.getElementById('tempChart');
        if(!ctx) return;
        
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js missing");
            return;
        }

        if (State.chartInstance) State.chartInstance.destroy();

        State.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    label: 'Temp Real (°C)',
                    data: Array(20).fill(null),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1, 
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 }, 
                scales: { y: { beginAtZero: false, min: 0, max: 100 }, x: { display: false } },
                plugins: { legend: { display: false } }
            }
        });
    },

    updateFromPayload: (machineId, controls) => {
        if (machineId !== 2 || !controls) return;
        const newVal = controls.escalda_db;
        if (newVal === undefined || newVal === null) return;
        
        const currentTemp = Number(newVal);
        State.machinePhysics.m2_temp = currentTemp;

        if(State.chartInstance) {
            const data = State.chartInstance.data.datasets[0].data;
            data.shift();
            data.push(currentTemp);
            State.chartInstance.update();
        }

        const kpi = document.getElementById('kpi-temp');
        if(kpi) {
            kpi.textContent = currentTemp.toFixed(1) + '°C';
            kpi.style.color = currentTemp > 85 ? '#ef4444' : '#f59e0b';
        }

        const gaugeVal = document.getElementById('gauge-m2-val');
        const bar = document.getElementById('temp-bar-2');
        if(gaugeVal) gaugeVal.innerHTML = currentTemp.toFixed(1) + '<span class="gauge-unit">°C</span>';
        if(bar) {
            bar.style.width = Math.min(currentTemp, 100) + '%';
            bar.style.background = currentTemp > 85 ? '#ef4444' : (currentTemp > 60 ? '#f59e0b' : '#3b82f6');
        }

        if (currentTemp > 90) {
            const now = Date.now();
            if (!State.lastAlertTime || (now - State.lastAlertTime > 60000)) { 
                State.lastAlertTime = now;
                notify.error('🚨 ALERTA CRÍTICA: Sensor reporta sobrecalentamiento');
                if(window.Dashboard) window.Dashboard.logEvent(2, `Temp Crítica (${currentTemp}°C)`, 'WARNING', currentTemp);
            }
        }
    }
};

/* --------------------------------------------------------------------------
   6. DASHBOARD & GESTIÓN (Window Bound)
   -------------------------------------------------------------------------- */
window.Dashboard = {
    init: async (user) => {
        if (!document.getElementById('dashboard-layout')) return;
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (!p) { notify.error('Perfil no encontrado.'); return; }
            State.userProfile = p; 
            
            const uName = document.getElementById('sidebar-username');
            if(uName) uName.textContent = p.nombre_completo || 'Usuario';
            const uRole = document.getElementById('sidebar-role');
            if(uRole) uRole.textContent = p.rol;
            
            window.Dashboard.applyPermissions(p.rol);
            
            if (CONFIG.ROLES.STAFF.includes(p.rol)) {
                window.switchTab('planta'); 
                await window.Dashboard.renderMachines(p.rol);
                window.Dashboard.initChat(p);
                window.Dashboard.subscribeRealtime();
                window.Telemetry.init(); 
                
                if (CONFIG.ROLES.ADMIN.includes(p.rol)) {
                    window.Dashboard.initAdminUsers(p.rol);
                    window.Dashboard.renderSales();
                }
            }
        } catch (e) { console.error("Error init dashboard:", e); }
    },
    
    applyPermissions: (rol) => {
        const tabPersonal = document.querySelector("li[onclick*='personal']");
        const tabVentas = document.getElementById("nav-tab-ventas");
        const hasAdminAccess = CONFIG.ROLES.ADMIN.includes(rol);
        
        if (tabPersonal) tabPersonal.style.display = hasAdminAccess ? 'block' : 'none';
        if (tabVentas) tabVentas.style.display = hasAdminAccess ? 'block' : 'none';
        
        if (!hasAdminAccess) {
            const viewP = document.getElementById('view-personal');
            const viewV = document.getElementById('view-ventas');
            if(viewP) viewP.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3></div>';
            if(viewV) viewV.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3></div>';
        }
    },
    
    openCreateUserModal: () => {
        const modal = document.getElementById('modal-create-user');
        if(modal) {
            modal.style.display = 'flex';
            const form = document.getElementById('form-create-employee');
            if(form) form.reset();
        }
    },

    createEmployee: async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-user-name').value;
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-pass').value;
        const role = document.getElementById('new-user-role').value;
        const dept = document.getElementById('new-user-dept').value;

        const load = notify.loading('Creando usuario seguro...');

        try {
            const tempClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            const { data, error } = await tempClient.auth.signUp({ email, password });

            if (error) throw error;
            if (!data.user) throw new Error("No se pudo crear el usuario");

            // [CORRECCIÓN v67] UPSERT: Si el usuario ya existe (por trigger), se actualiza. Si no, se crea.
            const { error: profileError } = await db.from('perfiles').upsert({
                id: data.user.id,
                email: email,
                nombre_completo: name,
                rol: role,
                area: dept
            });

            if (profileError) throw profileError;

            notify.close(load);
            notify.success(`Usuario ${name} creado con éxito.`);
            document.getElementById('modal-create-user').style.display = 'none';
            window.Dashboard.initAdminUsers(State.userProfile.rol); 

        } catch (err) {
            notify.close(load);
            notify.error('Error: ' + err.message);
        }
    },

    deleteUser: async (uid) => {
        Utils.confirmModal('¿Eliminar Empleado?', 'Se borrará su acceso.', async () => {
            const load = notify.loading('Eliminando...');
            const { error } = await db.rpc('delete_user_by_admin', { target_user_id: uid });
            notify.close(load);
            if (error) {
                notify.error('Error: ' + error.message);
            } else {
                notify.success('Eliminado');
                window.Dashboard.initAdminUsers(State.userProfile.rol);
            }
        });
    },

    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        
        const { data } = await db.from('perfiles').select('*').order('created_at', { ascending: false });
        if (!data) return;
        
        const isSys = CONFIG.ROLES.SYS.includes(myRole);
        
        tbody.innerHTML = data.map(u => {
            const isMe = u.id === State.userProfile.id;
            return `
            <tr data-uid="${u.id}">
                <td>
                    <div style="font-weight:600;">${Utils.escapeHtml(u.nombre_completo || 'Sin Nombre')}</div>
                    <div style="font-size:0.85rem; color:#666;">${Utils.escapeHtml(u.email)}</div>
                </td>
                <td>
                    <select class="form-input role-select" style="padding:5px; width:100%;" ${isMe ? 'disabled' : ''}>
                        ${['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador', 'Cliente'].map(r => 
                            `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`
                        ).join('')}
                    </select>
                </td>
                <td>${Utils.escapeHtml(u.area || '-')}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-icon btn-save" onclick="Dashboard.updateUserRole('${u.id}', this)" title="Guardar Rol" ${isMe ? 'disabled' : ''}><i class="fa-solid fa-save"></i></button>
                        ${isSys && !isMe ? `<button class="btn-icon btn-delete" onclick="Dashboard.deleteUser('${u.id}')" title="Eliminar"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
        
        const formCreate = document.getElementById('form-create-employee');
        if(formCreate) formCreate.onsubmit = window.Dashboard.createEmployee;
    },

    updateUserRole: async (uid, btn) => {
        const row = btn.closest('tr');
        const rol = row.querySelector('.role-select').value;
        const load = notify.loading('Actualizando...');
        const { error } = await db.from('perfiles').update({ rol }).eq('id', uid);
        notify.close(load);
        if(error) notify.error(error.message);
        else notify.success('Rol actualizado');
    },

    renderMachines: async (rol) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;
        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;
        
        container.innerHTML = '';
        data.forEach(m => {
            const isAdmin = CONFIG.ROLES.ADMIN.includes(rol);
            const safeName = Utils.escapeHtml(m.nombre);
            let body = '';
            
            if (m.id === 1) {
                const isStarted = m.controles.Inicio; 
                const ctrls = isAdmin ? `
                <div class="machine-interface">
                    <div class="action-buttons">
                        <button class="btn-action btn-start ${isStarted ? 'active' : ''}" onclick="window.plcCmd(1,'Inicio')"><i class="fa-solid fa-play"></i> INICIAR (0.0)</button>
                        <button class="btn-action btn-stop" onclick="window.plcCmd(1,'Paro')"><i class="fa-solid fa-stop"></i> PARO (0.1)</button>
                    </div>
                    <div class="control-group"><span class="control-label">Control Tanque</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-in" ${m.controles.online_llenado ? 'checked' : ''} onclick="window.plcSw(1,'online_llenado')"><label for="tk-in">Llenado</label></div>
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-off" ${(!m.controles.online_llenado && !m.controles.online_vaciado) ? 'checked' : ''} onclick="window.plcSw(1,'fill_off')"><label for="tk-off">OFF</label></div>
                            <div class="segmented-option"><input type="radio" name="tk" id="tk-out" ${m.controles.online_vaciado ? 'checked' : ''} onclick="window.plcSw(1,'online_vaciado')"><label for="tk-out">Vaciado</label></div>
                        </div>
                    </div>
                    <div class="control-group" style="margin-bottom:0"><span class="control-label">Control Elevador</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-up" ${m.controles.online_arriba ? 'checked' : ''} onclick="window.plcSw(1,'online_arriba')"><label for="ch-up">Arriba</label></div>
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-off" ${(!m.controles.online_arriba && !m.controles.online_abajo) ? 'checked' : ''} onclick="window.plcSw(1,'tray_off')"><label for="ch-off">Freno</label></div>
                            <div class="segmented-option"><input type="radio" name="ch" id="ch-dn" ${m.controles.online_abajo ? 'checked' : ''} onclick="window.plcSw(1,'online_abajo')"><label for="ch-dn">Abajo</label></div>
                        </div>
                    </div>
                </div>` : '<p class="text-muted">Modo Visualización</p>';
                body = `<div class="m-area"><i class="fa-solid fa-microchip"></i> PLC M1</div>${ctrls}`;

            } else if (m.id === 2) {
                if (m.controles.escalda_db !== undefined) {
                    State.machinePhysics.m2_temp = Number(m.controles.escalda_db);
                    if (State.chartInstance) {
                        const d = State.chartInstance.data.datasets[0].data;
                        d[d.length - 1] = State.machinePhysics.m2_temp;
                        State.chartInstance.update();
                    }
                }
                const currentTemp = State.machinePhysics.m2_temp;
                const isHeating = m.controles.calentador_on;
                const ctrls = isAdmin ? `
                <div class="machine-interface" style="margin-top: 20px;">
                    <div class="control-group"><span class="control-label">Calentadores Industriales</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-off" ${!isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_off')"><label for="heat-off">Apagado</label></div>
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-on" ${isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_on')"><label for="heat-on">Encendido</label></div>
                        </div>
                    </div>
                </div>` : '';
                body = `<div class="clean-gauge"><div class="gauge-readout" id="gauge-m2-val">${currentTemp.toFixed(1)}<span class="gauge-unit">°C</span></div><div class="gauge-bar-bg"><div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(currentTemp, 100)}%; background:${currentTemp > 85 ? '#ef4444' : (currentTemp > 60 ? '#f59e0b' : '#3b82f6')}"></div></div></div>${ctrls}`;
            }
            container.insertAdjacentHTML('beforeend', `<div class="card machine-card" id="machine-${m.id}"><div class="m-header"><h4>${safeName}</h4><div class="status-pill ${m.estado === 'En Ciclo' || (m.id === 2 && m.controles.calentador_on) ? 'on' : 'off'}"><span class="status-pill dot"></span>${m.estado}</div></div><div class="m-body">${body}</div></div>`);
        });
    },

    logEvent: async (machineId, eventName, type = 'INFO', value = null) => {
        const user = State.userProfile ? State.userProfile.nombre_completo : 'Sistema';
        await db.from('bitacora_industrial').insert({ maquina_id: machineId, evento: eventName, tipo: type, usuario: user, valor_lectura: value });
    },

    reportIncident: async () => {
        const desc = prompt("Describa la incidencia técnica:");
        if(desc) {
            await window.Dashboard.logEvent(0, desc, 'ERROR');
            notify.success('Incidencia reportada');
            window.Dashboard.renderReports();
        }
    },

    renderReports: async () => {
        const tbody = document.getElementById('reportes-table-body');
        if(!tbody) return;
        
        const { data: logs } = await db.from('bitacora_industrial').select('*').order('created_at', { ascending: false }).limit(50);
        
        const { count: ciclosCount } = await db.from('bitacora_industrial').select('*', { count: 'exact', head: true }).eq('evento', 'Inicio Ciclo').gte('created_at', new Date().toISOString().split('T')[0]);
        const { count: alertasCount } = await db.from('bitacora_industrial').select('*', { count: 'exact', head: true }).in('tipo', ['WARNING', 'ERROR']).gte('created_at', new Date().toISOString().split('T')[0]);

        if(document.getElementById('kpi-cycles')) document.getElementById('kpi-cycles').textContent = ciclosCount || 0;
        if(document.getElementById('kpi-alerts')) document.getElementById('kpi-alerts').textContent = alertasCount || 0;

        if (logs && logs.length > 0) {
            tbody.innerHTML = logs.map(l => {
                let badgeColor = '#3b82f6'; 
                if(l.tipo === 'WARNING') badgeColor = '#f59e0b';
                if(l.tipo === 'ERROR') badgeColor = '#ef4444';
                return `<tr><td style="color:#666; font-size:0.85rem;">${new Date(l.created_at).toLocaleTimeString()}</td><td>${l.maquina_id === 0 ? 'General' : 'M'+l.maquina_id}</td><td style="font-weight:500;">${Utils.escapeHtml(l.evento)}</td><td><i class="fa-solid fa-user-tag" style="color:#94a3b8; margin-right:5px;"></i>${Utils.escapeHtml(l.usuario)}</td><td><span class="badge" style="background:${badgeColor}20; color:${badgeColor}; font-size:0.75rem;">${l.tipo}</span></td></tr>`;
            }).join('');
        } else { tbody.innerHTML = '<tr><td colspan="5" class="text-center">Sin actividad reciente.</td></tr>'; }
    },

    renderSales: async (filter = 'todos') => {
        const tbody = document.getElementById('ventas-table-body');
        if (!tbody) return;
        
        let query = db.from('pedidos').select('*, perfiles(email, nombre_completo)').order('created_at', { ascending: false });
        if (filter === 'pendiente') query = query.eq('estado', 'Pendiente');
        
        const { data: orders, error } = await query;
        if (error || !orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:20px; color:#888;">No se encontraron pedidos.</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(o => {
            const isTransfer = o.datos_envio?.metodo === 'transfer';
            const methodLabel = isTransfer 
                ? '<span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #ffedd5;"><i class="fa-solid fa-building-columns"></i> Transferencia</span>' 
                : '<span class="badge" style="background:#f0fdf4; color:#166534; border:1px solid #dcfce7;"><i class="fa-solid fa-credit-card"></i> Tarjeta</span>';
            
            let actions = '';
            if (o.estado === 'Pendiente') {
                actions = `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Pagado')" class="btn btn-sm btn-primary hover-lemna-trigger" style="background:#16a34a; border:none;" title="Confirmar Pago"><i class="fa-solid fa-check"></i> Aprobar</button><button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Cancelado')" class="btn btn-sm btn-danger hover-lemna-trigger" style="margin-left:5px;" title="Rechazar Pago"><i class="fa-solid fa-xmark"></i></button>`;
            } else if (o.estado === 'Pagado') {
                actions = `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Enviado')" class="btn btn-sm btn-primary hover-lemna-trigger" style="background:#2563eb; border:none;"><i class="fa-solid fa-truck-fast"></i> Enviar</button>`;
            } else {
                 actions = `<span style="color:#999; font-size:0.8rem;">Completado</span>`;
            }

            return `<tr><td><span style="font-weight:600;">#${String(o.id).slice(0, 8)}</span><br><small style="color:#888;">${new Date(o.created_at).toLocaleDateString()}</small></td><td>${Utils.escapeHtml(o.perfiles?.nombre_completo || 'Usuario')}<br><small style="color:#666;">${Utils.escapeHtml(o.perfiles?.email)}</small></td><td><div style="font-weight:700;">${Utils.formatCurrency(o.total)}</div>${methodLabel}</td><td><span class="badge" style="font-size:0.85rem; padding:4px 8px; border-radius:4px; background:${o.estado==='Pendiente'?'#fff7ed':(o.estado==='Pagado'?'#dbeafe':'#f0fdf4')}; color:${o.estado==='Pendiente'?'#c2410c':(o.estado==='Pagado'?'#1e40af':'#15803d')}">${Utils.escapeHtml(o.estado)}</span></td><td>${actions}</td></tr>`;
        }).join('');
    },

    updateOrderStatus: async (orderId, newStatus) => {
        let msg = `¿Cambiar estado a: ${newStatus}?`;
        if (newStatus === 'Pagado') msg = "Confirmar que se recibió la transferencia bancaria.";
        
        Utils.confirmModal('Actualizar Pedido', msg, async () => {
            const load = notify.loading('Actualizando...');
            const updates = { estado: newStatus };
            if(newStatus === 'Enviado') updates.tracking_info = { carrier: 'FedEx Eco', tracking_number: 'TRK-' + Math.floor(Math.random()*1000000), history: [{status: 'Recolectado', date: new Date().toISOString(), location: 'Planta EcoTech', completed: true}] };
            
            const { data, error } = await db.from('pedidos').update(updates).eq('id', orderId).select(); 
            notify.close(load);
            
            if (error) { console.error("Error DB:", error); notify.error('Error SQL: ' + error.message); } 
            else if (!data || data.length === 0) { console.warn("RLS Bloqueo"); notify.error('⛔ Error de Permisos'); }
            else { notify.success(`✅ Pedido actualizado.`); window.Dashboard.renderSales(); }
        }, newStatus === 'Cancelado' ? 'btn-primary-modal-danger' : 'btn-secondary-modal', 'Confirmar');
    },

    initChat: async (profile) => {
        const list = document.querySelector('.message-list');
        const form = document.getElementById('chat-form');
        if (!list) return;
        const renderMessage = (m) => {
            if (document.querySelector(`[data-msg-id="${m.id}"]`)) return;
            const html = `<div class="msg-item" data-msg-id="${m.id}" style="animation: fadeIn 0.3s ease;"><div class="msg-avatar">${m.sender.charAt(0).toUpperCase()}</div><div style="flex:1;"><div style="display:flex; justify-content:space-between;"><strong>${Utils.escapeHtml(m.sender)}</strong><small style="color:#888;">${Utils.formatTime(m.created_at)}</small></div><small style="color:#666;">${Utils.escapeHtml(m.role)}</small><p style="margin:5px 0 0; color:#333;">${Utils.escapeHtml(m.mensaje)}</p></div></div>`;
            list.insertAdjacentHTML('afterbegin', html);
        };
        const { data } = await db.from('mensajes').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) { list.innerHTML = ''; [...data].reverse().forEach(renderMessage); }
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const txt = form.querySelector('textarea').value.trim();
                if (txt) {
                    await db.from('mensajes').insert({ mensaje: txt, sender: profile.nombre_completo || 'Usuario', role: profile.rol });
                    form.querySelector('textarea').value = '';
                }
            };
        }
        window.Dashboard.renderChatMessage = renderMessage;
    },

    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;
        console.log("🔌 Iniciando suscripción Realtime Completa...");
        State.realtimeSubscription = db.channel('public-room')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => { 
                if (payload.new && payload.new.controles) {
                    window.Telemetry.updateFromPayload(payload.new.id, payload.new.controles);
                    if (!globalEmergencyActive) window.Dashboard.renderMachines(State.userProfile?.rol || 'Sistemas'); 
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => { 
                if (typeof window.Dashboard.renderChatMessage === 'function') window.Dashboard.renderChatMessage(payload.new); 
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora_industrial' }, payload => {
                const view = document.getElementById('view-reportes');
                if(view && view.style.display !== 'none') window.Dashboard.renderReports();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, payload => { 
                const view = document.getElementById('view-ventas');
                if(view && view.style.display !== 'none') window.Dashboard.renderSales();
            })
            .subscribe();
    }
};

/* --------------------------------------------------------------------------
   7. FUNCIONES DE CONTROL GLOBAL (Window Bound)
   -------------------------------------------------------------------------- */
window.plcCmd = async (id, act) => { 
    if (globalEmergencyActive && act !== 'Paro') return notify.error("BLOQUEO DE EMERGENCIA"); 
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
    let c = data.controles; 
    if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
    else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; } 
    await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id); 
    if(window.Dashboard) await window.Dashboard.logEvent(id, act === 'Inicio' ? 'Inicio Ciclo' : 'Paro Manual', 'INFO');
};

window.plcSw = async (id, k) => { 
    if (globalEmergencyActive && !k.includes('off')) return notify.error("BLOQUEO DE EMERGENCIA"); 
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
    let c = data.controles; 
    let eventDesc = "Switch Accionado";
    if (id === 1) { 
        if (k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; eventDesc = "Bomba Llenado ON"; } 
        else if (k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; eventDesc = "Bomba Vaciado ON"; } 
        else if (k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; eventDesc = "Bombas OFF"; }
        else if (k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; eventDesc = "Elevador SUBIR"; }
        else if (k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; eventDesc = "Elevador BAJAR"; }
        else if (k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; eventDesc = "Elevador FRENO"; }
    } else if (id === 2) { 
        if (k === 'heat_on') { c.calentador_on = true; eventDesc = "Calentador ON"; }
        else if (k === 'heat_off') { c.calentador_on = false; eventDesc = "Calentador OFF"; }
    } 
    await db.from('maquinas').update({ controles: c }).eq('id', id); 
    if(window.Dashboard) await window.Dashboard.logEvent(id, eventDesc, 'INFO');
};

window.toggleGlobalEmergency = async () => { 
    if (!globalEmergencyActive) { 
        Utils.confirmModal('PARO DE EMERGENCIA', '¿Detener TODAS las máquinas?', async () => { 
            globalEmergencyActive = true; document.body.classList.add('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); if(btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> RESTABLECER'; } 
            await window.plcCmd(1, 'Paro'); await window.plcSw(2, 'heat_off'); 
            if(window.Dashboard) await window.Dashboard.logEvent(0, 'PARO DE EMERGENCIA GLOBAL', 'ERROR');
        }); 
    } else { 
        Utils.confirmModal('Restablecer', '¿Reactivar operaciones?', async () => { 
            globalEmergencyActive = false; document.body.classList.remove('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); if(btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA'; } 
            if(window.Dashboard) await window.Dashboard.logEvent(0, 'Reinicio de Planta', 'INFO');
        }); 
    } 
};

/* --------------------------------------------------------------------------
   8. STORE (LÓGICA DE TIENDA)
   -------------------------------------------------------------------------- */
window.Store = {
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
                if(document.getElementById(els.idxName)) { document.getElementById(els.idxName).textContent = data.nombre; document.getElementById(els.idxPrice).textContent = Utils.formatCurrency(data.precio); }
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
        if(cart[pid] > max) { cart[pid] = max; notify.show('Stock máximo alcanzado', 'info'); } else notify.success('Añadido al carrito');
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        window.Store.updateCount();
    },
    clearCart: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY));
        if(!cart || !Object.keys(cart).length) return notify.show('Carrito vacío', 'info');
        Utils.confirmModal('¿Vaciar?', 'Se eliminarán los productos', () => { localStorage.removeItem(CONFIG.CART_KEY); window.Store.updateCount(); if(window.location.pathname.includes('checkout')) window.location.reload(); });
    },
    updateCount: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const count = Object.values(cart).reduce((a,b)=>a+b,0);
        const badge = document.getElementById('carrito-contador');
        const btn = document.getElementById('btn-vaciar-carrito');
        if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block':'none'; }
        if(btn) btn.style.display = count > 0 ? 'inline-block':'none';
    },
    renderOrders: async (userId) => {
        const list = document.getElementById('pedidos-lista-container');
        if (list) {
            const { data: orders } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (orders && orders.length > 0) {
                list.innerHTML = orders.map(o => {
                    let statusColor = 'primary';
                    let statusIcon = 'fa-clock';
                    if (o.estado === 'Cancelado') { statusColor = 'danger'; statusIcon = 'fa-circle-xmark'; }
                    else if (o.estado === 'Enviado') { statusColor = 'success'; statusIcon = 'fa-truck'; }
                    else if (o.estado === 'Pendiente') { statusColor = 'warning'; statusIcon = 'fa-hourglass-half'; }
                    else if (o.estado === 'Pagado') { statusColor = 'info'; statusIcon = 'fa-check-circle'; }

                    const isCancelable = ['Pagado', 'Procesando', 'Pendiente'].includes(o.estado);
                    const isTrackable = ['Enviado', 'Entregado'].includes(o.estado) && o.tracking_info;
                    let actionsHtml = '';
                    if (isCancelable) actionsHtml += `<button onclick="window.Auth.cancelOrder(${o.id})" class="btn-text-danger hover-lemna-trigger"><i class="fa-solid fa-ban"></i> Cancelar</button>`;
                    if (isTrackable) {
                        const trackDataSafe = encodeURIComponent(JSON.stringify(o.tracking_info));
                        actionsHtml += `<button onclick="window.Auth.trackOrder('${trackDataSafe}', '${o.id}')" class="btn-sm btn-primary hover-lemna-trigger" style="border-radius:20px; font-size:0.8rem;"><i class="fa-solid fa-location-dot"></i> Rastrear</button>`;
                    }
                    if (o.estado === 'Cancelado') actionsHtml += `<span style="font-size:0.85rem; color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> Cancelado</span>`;
                    let extraInfo = '';
                    if (o.estado === 'Pendiente') extraInfo = `<div style="background:#fff7ed; color:#c2410c; padding:8px; margin-top:10px; border-radius:6px; font-size:0.85rem; border:1px solid #ffedd5;"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Pago en validación:</strong> El Staff verificará tu transferencia pronto.</div>`;

                    return `<div class="pedido-card" style="border-left-color: var(--color-${statusColor});"><div class="pedido-header"><div><strong>Pedido #${String(o.id).slice(0, 8)}</strong><span style="display:block; font-size:0.8rem; color:#888;">${new Date(o.created_at).toLocaleDateString()}</span></div><span class="badge" style="background:var(--color-${statusColor}-light); color:var(--color-${statusColor}); border:1px solid var(--color-${statusColor}); display:flex; align-items:center; gap:5px;"><i class="fa-solid ${statusIcon}"></i> ${Utils.escapeHtml(o.estado) || 'Procesando'}</span></div><div class="order-info" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;"><div style="font-weight:700; font-size:1.1rem;">${Utils.formatCurrency(o.total)}</div><div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">${actionsHtml}</div></div>${extraInfo}</div>`;
                }).join('');
            } else { list.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8;"><i class="fa-solid fa-box-open fa-3x" style="margin-bottom:15px; opacity:0.5;"></i><p>Aún no has realizado pedidos.</p><a href="tienda.html" class="btn btn-primary btn-sm">Ir a la tienda</a></div>'; }
        }
    },
    initCheckout: async (user) => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const container = document.getElementById('checkout-items');
        if(!container) return;
        if(!Object.keys(cart).length) { container.innerHTML = '<p>Carrito vacío</p>'; document.getElementById('btn-confirmar-compra').disabled = true; return; }

        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if(p) {
            const ids = {'checkout-name':'nombre_completo', 'checkout-phone':'telefono', 'checkout-address':'direccion'};
            for(const [k,v] of Object.entries(ids)) { const el = document.getElementById(k); if(el && !el.value) el.value = p[v]||''; }
            if (p.datos_pago && p.datos_pago.number) {
                notify.show('Autocompletando tarjeta...', 'info');
                if(document.getElementById('card-number')) document.getElementById('card-number').value = p.datos_pago.number;
                if(document.getElementById('card-holder')) document.getElementById('card-holder').value = p.datos_pago.holder || '';
                if(document.getElementById('card-expiry')) document.getElementById('card-expiry').value = p.datos_pago.expiry || '';
            }
        }
        let total = 0, items = [], html = '';
        for(const [pid, qty] of Object.entries(cart)) {
            const { data: prod } = await db.from('productos').select('*').eq('id', pid).single();
            if(prod) {
                const sub = prod.precio * qty; total += sub; items.push({ id: pid, nombre: prod.nombre, cantidad: qty, precio: prod.precio });
                html += `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee"><span>${prod.nombre} x${qty}</span><strong>${Utils.formatCurrency(sub)}</strong></div>`;
            }
        }
        container.innerHTML = html;
        if(document.getElementById('checkout-total')) document.getElementById('checkout-total').textContent = Utils.formatCurrency(total);
        if(document.getElementById('checkout-subtotal')) document.getElementById('checkout-subtotal').textContent = Utils.formatCurrency(total);

        const form = document.getElementById('form-checkout');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const modal = document.getElementById('payment-modal');
                if(modal) modal.style.display = 'flex';
                try {
                    const method = document.querySelector('input[name="payment-method"]:checked')?.value || 'card';
                    const envio = {
                        nombre: document.getElementById('checkout-name').value,
                        direccion: document.getElementById('checkout-address').value,
                        telefono: document.getElementById('checkout-phone').value,
                        metodo: method
                    };
                    const estadoInicial = method === 'transfer' ? 'Pendiente' : 'Pagado';
                    await db.from('pedidos').insert({ user_id: user.id, items, total, datos_envio: envio, estado: estadoInicial });
                    for(const i of items) {
                        const {data:pr} = await db.from('productos').select('stock_disponible').eq('id',i.id).single();
                        if(pr) await db.from('productos').update({stock_disponible: Math.max(0, pr.stock_disponible - i.cantidad)}).eq('id',i.id);
                    }
                    await Utils.wait(2000);
                    localStorage.removeItem(CONFIG.CART_KEY);
                    window.location.href='cuenta.html';
                } catch(err) { if(modal) modal.style.display = 'none'; notify.error(err.message); }
            };
        }
    }
};

/* --------------------------------------------------------------------------
   9. PRODUCT GALLERY (Window Bound)
   -------------------------------------------------------------------------- */
window.ProductGallery = { 
    set: (el) => { const main = document.getElementById('main-product-img'); if(main) main.src = el.src; document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active')); el.classList.add('active'); }, 
    next: () => { const cur = document.querySelector('.thumb.active'); const next = cur?.nextElementSibling || document.querySelector('.thumb:first-child'); if(next) window.ProductGallery.set(next); }, 
    prev: () => { const cur = document.querySelector('.thumb.active'); const prev = cur?.previousElementSibling || document.querySelector('.thumb:last-child'); if(prev) window.ProductGallery.set(prev); } 
};

/* --------------------------------------------------------------------------
   10. BOOTSTRAP (DOM Loaded)
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.AuthModal.init();
        if(window.LemnaCursor && window.LemnaCursor.init) window.LemnaCursor.init(); // Assuming LemnaCursor is elsewhere or simple
        if(window.Carousel && window.Carousel.init) window.Carousel.init(); // Assuming Carousel logic is elsewhere or simple
        window.Store.updateCount();

        const { data: { session } } = await db.auth.getSession();
        const user = session?.user;
        const path = window.location.pathname;

        // Navbar Login/Logout logic
        const header = document.getElementById('auth-links-container');
        if(header) {
            if(user) header.innerHTML = `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>`;
            else header.innerHTML = `<a href="#" class="nav-link" onclick="window.AuthModal.open(); return false;"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
        }

        const btnTrash = document.getElementById('btn-vaciar-carrito');
        if(btnTrash) btnTrash.onclick = window.Store.clearCart;

        // --- RUTAS ---
        if(path.includes('panel')) {
            if(user) {
                const { data: profile } = await db.from('perfiles').select('rol').eq('id', user.id).single();
                if (!profile || !CONFIG.ROLES.STAFF.includes(profile.rol)) {
                    notify.error('⛔ Acceso Denegado'); setTimeout(() => window.location.href = 'cuenta.html', 1500); return; 
                }
                const overlay = document.getElementById('login-overlay'); if(overlay) overlay.style.display='none';
                const layout = document.getElementById('dashboard-layout'); if(layout) layout.style.display='flex';
                
                await window.Dashboard.init(user);
                
                const logout = document.getElementById('btn-logout-panel'); if(logout) logout.onclick = window.Auth.logout;
            } else {
                const form = document.getElementById('panel-login-form'); if(form) form.onsubmit = window.Auth.login;
            }
        } else if(path.includes('cuenta')) {
            if(user) {
                const forms = document.getElementById('auth-forms'); if(forms) forms.style.display='none';
                const info = document.getElementById('user-info'); if(info) info.style.display='grid';
                window.Auth.loadProfile(user);
                
                const pf = document.getElementById('form-perfil'); if(pf) pf.onsubmit = (e) => window.Auth.saveProfile(e, user);
                const wf = document.getElementById('form-pago-seguro'); if(wf) wf.onsubmit = (e) => window.Auth.saveWallet(e, user);
                const sf = document.getElementById('form-security-check'); if(sf) sf.onsubmit = (e) => window.Auth.verifyPasswordAndReveal(e, user);
                const lo = document.getElementById('btn-logout'); if(lo) lo.onclick = window.Auth.logout;
                
                // Tabs
                const d = document.getElementById('btn-tab-datos');
                const p = document.getElementById('btn-tab-pedidos');
                const w = document.getElementById('btn-tab-pagos');
                const hideAll = () => {
                    ['seccion-mis-datos', 'seccion-mis-pedidos', 'seccion-pagos'].forEach(id => {
                        const el = document.getElementById(id); if(el) el.style.display='none';
                    });
                    [d, p, w].forEach(btn => btn?.classList.remove('active'));
                };
                if(d) d.onclick = () => { hideAll(); document.getElementById('seccion-mis-datos').style.display='block'; d.classList.add('active'); };
                if(p) p.onclick = () => { hideAll(); document.getElementById('seccion-mis-pedidos').style.display='block'; p.classList.add('active'); window.Auth.loadProfile(user); };
                if(w) w.onclick = () => { hideAll(); document.getElementById('seccion-pagos').style.display='block'; w.classList.add('active'); };

            } else {
                const forms = document.getElementById('auth-forms'); if(forms) forms.style.display='block';
                const lf = document.getElementById('form-login'); if(lf) lf.onsubmit = window.Auth.login;
                const rf = document.getElementById('form-registro'); if(rf) rf.onsubmit = window.Auth.register;
            }
        } else if(path.includes('checkout')) {
            if(user) {
                const lp = document.getElementById('checkout-login-prompt'); if(lp) lp.style.display='none';
                const cc = document.getElementById('checkout-container'); if(cc) cc.style.display='grid';
                window.Store.initCheckout(user);
            } else {
                const lp = document.getElementById('checkout-login-prompt'); if(lp) {
                    lp.style.display='block';
                    lp.innerHTML=`<div style="text-align:center"><h2>Inicia sesión</h2><br><button class="btn btn-primary" onclick="window.AuthModal.open()">Entrar</button></div>`;
                }
            }
        } else if(path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
            window.Store.loadProduct();
            const btn = document.getElementById('btn-anadir-carrito');
            if(btn) btn.onclick = window.Store.addToCart;
        }

    } catch(err) {
        console.error("Critical System Error:", err);
    }
});