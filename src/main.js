// src/main.js
import { CONFIG } from './config.js';
import { db } from './db.js';
import { globalState } from './state.js';
import { notify, formatCurrency, formatTime, confirmModal, printReceipt } from './utils.js';
import { Auth } from './auth.js';
import { Store } from './store.js';
import { Dashboard, Telemetry, Vision, MachineControl } from './dashboard.js';
import { Maps } from './maps.js';

console.log('🚀 EcoTech System v3.3: Stable Release');

// --- 1. EXPOSICIÓN GLOBAL ---
// Necesario para que los botones onclick="" en el HTML funcionen
window.Auth = Auth;
window.Store = Store;
window.Dashboard = Dashboard;
window.Vision = Vision;
window.MachineControl = MachineControl;
window.Maps = Maps;
window.Utils = { formatCurrency, formatTime, confirmModal, printReceipt };

// Compatibilidad con código Legacy (si existiera)
window.plcCmd = MachineControl.sendCommand;
window.plcSw = MachineControl.toggleSwitch;
window.toggleGlobalEmergency = MachineControl.toggleEmergency;

// Helper UI para cambio de método de pago en Checkout
window.togglePaymentMethod = function(method) {
    const cardForm = document.getElementById('payment-form-card');
    const transferInfo = document.getElementById('payment-info-transfer');
    if (!cardForm || !transferInfo) return;

    if (method === 'card') {
        cardForm.style.display = 'block';
        transferInfo.style.display = 'none';
        cardForm.querySelectorAll('input').forEach(i => i.required = true);
    } else {
        cardForm.style.display = 'none';
        transferInfo.style.display = 'block';
        cardForm.querySelectorAll('input').forEach(i => i.required = false);
    }
};

// --- 2. GESTOR DE ESTADO DE LA INTERFAZ (UI MANAGER) ---
const AppUI = {
    // Actualiza la interfaz global según el estado del usuario
    refreshState: async (user) => {
        // A. Header (Links de navegación)
        const authLinks = document.getElementById('auth-links-container');
        if (authLinks) {
            authLinks.innerHTML = user 
                ? `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>` 
                : `<a href="#" class="nav-link" onclick="window.AuthModal.open(); return false;"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
        }

        // B. Sidebar del Panel (Nombre y Rol)
        if(globalState.userProfile) {
            const uName = document.getElementById('sidebar-username');
            const uRole = document.getElementById('sidebar-role');
            if(uName) uName.textContent = globalState.userProfile.nombre_completo || 'Usuario';
            if(uRole) uRole.textContent = globalState.userProfile.rol || 'Staff';
        }

        // C. Lógica específica por página (Router simple)
        const path = window.location.pathname;
        if (path.includes('panel.html')) await AppUI.handlePanelPage(user);
        else if (path.includes('cuenta.html')) await AppUI.handleAccountPage(user);
        else if (path.includes('checkout.html')) await AppUI.handleCheckoutPage(user);
    },

    // Lógica para panel.html
    handlePanelPage: async (user) => {
        const overlay = document.getElementById('login-overlay');
        const loginBox = document.querySelector('.login-box');
        const layout = document.getElementById('dashboard-layout');
        const isStaff = user && CONFIG.ROLES.STAFF.includes(globalState.userProfile?.rol);

        if (!isStaff) {
            // Usuario no autorizado o no logueado
            if (layout) layout.style.display = 'none';
            if (overlay) {
                overlay.style.display = 'flex';
                if (loginBox) {
                    // Animación suave de entrada
                    loginBox.style.opacity = '0';
                    loginBox.style.display = 'block';
                    setTimeout(() => loginBox.style.opacity = '1', 50);
                }
            }
            // Si hay usuario pero no es staff, expulsar
            if (user) {
                notify.error('Acceso denegado: Rol insuficiente.');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } else {
            // Usuario Staff Autorizado
            if (overlay) overlay.style.display = 'none';
            if (layout) layout.style.display = 'flex';
            
            // Iniciar componentes del Dashboard solo una vez
            if (!globalState.dashboardInitialized) {
                Dashboard.renderMachines(globalState.userProfile.rol);
                Dashboard.loadChatMessages('General');
                Telemetry.init();
                Vision.init();
                
                // Suscripción a cambios en tiempo real
                if (!globalState.realtimeSubscription) {
                    globalState.realtimeSubscription = db.channel('public-room')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, payload => { 
                            if(payload.new) {
                                Telemetry.updateFromPayload(payload.new.id, payload.new.controles);
                                Dashboard.renderMachines(globalState.userProfile.rol);
                            }
                        })
                        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => { Dashboard.renderChatMessage(payload.new); })
                        .subscribe();
                }
                globalState.dashboardInitialized = true;
            }
        }
    },

    // Lógica para cuenta.html
    handleAccountPage: async (user) => {
        const authForms = document.getElementById('auth-forms');
        const userInfo = document.getElementById('user-info');

        if (!user) {
            if(authForms) authForms.style.display = 'block';
            if(userInfo) userInfo.style.display = 'none';
        } else {
            if(authForms) authForms.style.display = 'none';
            if(userInfo) userInfo.style.display = 'grid';

            const p = globalState.userProfile;
            if(p) {
                // Rellenar formulario de perfil
                const inputs = { 
                    'profile-name': p.nombre_completo, 
                    'profile-email': p.email, 
                    'profile-phone': p.telefono, 
                    'profile-address': p.direccion 
                };
                for (const [id, val] of Object.entries(inputs)) {
                    const el = document.getElementById(id);
                    if(el) el.value = val || '';
                }
                
                // Inicializar mapa si existe
                if(window.Maps) Maps.init('map-profile', p.latitud, p.longitud, true);
                
                // Rellenar datos de pago (visual)
                if(p.datos_pago && p.datos_pago.number) {
                    globalState.tempWalletData = p.datos_pago;
                    const wNum = document.getElementById('wallet-number');
                    if(wNum) wNum.placeholder = "•••• " + p.datos_pago.number.slice(-4);
                    const btnUnlock = document.getElementById('btn-unlock-wallet');
                    if(btnUnlock) { 
                        btnUnlock.innerHTML = '<i class="fa-solid fa-lock"></i> Ver Datos'; 
                        btnUnlock.classList.replace('btn-light', 'btn-secondary'); 
                    }
                }
            }
            Store.renderOrders(user.id);
        }
    },

    // Lógica para checkout.html
    handleCheckoutPage: async (user) => {
        const prompt = document.getElementById('checkout-login-prompt');
        const container = document.getElementById('checkout-container');

        if (!user) {
            if(prompt) prompt.style.display = 'block';
            if(container) container.style.display = 'none';
        } else {
            if(prompt) prompt.style.display = 'none';
            if(container) container.style.display = 'grid';

            const p = globalState.userProfile;
            if (p) {
                // Precargar datos de envío
                if(document.getElementById('checkout-name')) document.getElementById('checkout-name').value = p.nombre_completo || '';
                if(document.getElementById('checkout-address')) document.getElementById('checkout-address').value = p.direccion || '';
                if(document.getElementById('checkout-phone')) document.getElementById('checkout-phone').value = p.telefono || '';
                if(p.latitud && p.longitud && window.Maps) Maps.init('map-checkout', p.latitud, p.longitud, false);
                
                // Precargar tarjeta
                if (p.datos_pago && p.datos_pago.number) {
                    const cn = document.getElementById('card-number');
                    const ch = document.getElementById('card-holder');
                    const ce = document.getElementById('card-expiry');
                    if(cn) cn.value = p.datos_pago.number;
                    if(ch) ch.value = p.datos_pago.holder;
                    if(ce) ce.value = p.datos_pago.expiry;
                }
            }
            
            // Renderizar resumen de compra
            const cart = Store.getCart();
            const prod = await Store.fetchProduct();
            const qty = cart[prod.id] || 0;
            const total = prod.precio * qty;
            
            const itemsDiv = document.getElementById('checkout-items');
            if(itemsDiv) itemsDiv.innerHTML = `<div style="display:flex;justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;"><span>${prod.nombre} x${qty}</span><strong>${formatCurrency(total)}</strong></div>`;
            if(document.getElementById('checkout-total')) document.getElementById('checkout-total').textContent = formatCurrency(total);
            if(document.getElementById('checkout-subtotal')) document.getElementById('checkout-subtotal').textContent = formatCurrency(total / 1.16);
        }
    },
    
    // --- MANEJO DE AUTH CON BLOQUEO DE UI (Evita doble submit) ---
    handleAuthAction: async (actionType, email, password, btn) => {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
        
        try {
            const res = actionType === 'login' 
                ? await Auth.login(email, password) 
                : await Auth.register(email, password);
            
            if (res.success) {
                window.AuthModal.close();
                await AppUI.refreshState(res.user);
            }
        } finally {
            // Restaurar botón siempre, sea éxito o error
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    },

    performLogout: async () => {
        const res = await Auth.logout();
        if (res.success) {
            const path = window.location.pathname;
            // Redirigir si estamos en páginas privadas
            if (path.includes('panel.html') || path.includes('checkout.html') || path.includes('cuenta.html')) {
                window.location.href = 'index.html';
            } else {
                await AppUI.refreshState(null);
            }
        }
    }
};

// --- 3. COMPONENTES DE UI ---

// Galería de Imágenes (Para Tienda)
window.ProductGallery = {
    images: document.querySelectorAll('.thumb'),
    set: (el) => {
        const main = document.getElementById('main-product-img');
        if(main && el) {
            main.src = el.src;
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
        }
    },
    next: () => {
        const current = document.querySelector('.thumb.active');
        if(current && current.nextElementSibling) window.ProductGallery.set(current.nextElementSibling);
        else { const first = document.querySelector('.thumb'); if(first) window.ProductGallery.set(first); }
    },
    prev: () => {
        const current = document.querySelector('.thumb.active');
        if(current && current.previousElementSibling) window.ProductGallery.set(current.previousElementSibling);
        else { const last = document.querySelector('.thumb:last-child'); if(last) window.ProductGallery.set(last); }
    }
};

// Modal de Autenticación
window.AuthModal = {
    init: () => {
        if (document.getElementById('auth-modal')) return;
        const modalHTML = `
        <div id="auth-modal" class="auth-modal-overlay" style="display:none;">
            <div class="auth-box">
                <button class="auth-close-btn" onclick="window.AuthModal.close()"><i class="fa-solid fa-xmark"></i></button>
                <div class="auth-tabs">
                    <button class="auth-tab active" onclick="window.AuthModal.switchTab('login')">Iniciar Sesión</button>
                    <button class="auth-tab" onclick="window.AuthModal.switchTab('register')">Registrarse</button>
                </div>
                <div id="modal-login-view" class="auth-view active">
                    <div class="auth-header"><img src="images/logo.png" alt="Logo"><h4>Bienvenido</h4><p>Accede a tu cuenta EcoTech</p></div>
                    <form id="form-modal-login"><div class="input-group"><label>Correo Electrónico</label><input type="email" id="m-login-email" class="form-input" required></div><div class="input-group"><label>Contraseña</label><input type="password" id="m-login-pass" class="form-input" required></div><button type="submit" class="btn btn-primary" style="width:100%">ENTRAR</button></form>
                </div>
                <div id="modal-register-view" class="auth-view">
                    <div class="auth-header"><img src="images/logo.png" alt="Logo"><h4>Crear Cuenta</h4><p>Únete a la revolución sostenible</p></div>
                    <form id="form-modal-register"><div class="input-group"><label>Correo Electrónico</label><input type="email" id="m-reg-email" class="form-input" required></div><div class="input-group"><label>Contraseña (mín. 6)</label><input type="password" id="m-reg-pass" class="form-input" required minlength="6"></div><button type="submit" class="btn btn-primary" style="width:100%">REGISTRARSE</button></form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Listeners Modales con Bloqueo
        const lForm = document.getElementById('form-modal-login');
        if (lForm) lForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            const btn = lForm.querySelector('button[type="submit"]');
            await AppUI.handleAuthAction('login', document.getElementById('m-login-email').value, document.getElementById('m-login-pass').value, btn);
        };
        const rForm = document.getElementById('form-modal-register');
        if (rForm) rForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            const btn = rForm.querySelector('button[type="submit"]');
            await AppUI.handleAuthAction('register', document.getElementById('m-reg-email').value, document.getElementById('m-reg-pass').value, btn);
        };
    },
    open: (tab = 'login') => { window.AuthModal.init(); const m = document.getElementById('auth-modal'); if(m) { m.style.display = 'flex'; setTimeout(()=>m.classList.add('show'), 10); window.AuthModal.switchTab(tab); } },
    close: () => { const m = document.getElementById('auth-modal'); if(m){ m.classList.remove('show'); setTimeout(()=>m.style.display='none', 300); } },
    switchTab: (tab) => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
        if (tab === 'login') { document.querySelector('.auth-tab:first-child')?.classList.add('active'); document.getElementById('modal-login-view')?.classList.add('active'); }
        else { document.querySelector('.auth-tab:last-child')?.classList.add('active'); document.getElementById('modal-register-view')?.classList.add('active'); }
    },
    openSecurityCheck: () => { const m = document.getElementById('security-modal'); if(m) { m.style.display='flex'; setTimeout(()=>m.style.opacity='1',10); } },
    closeSecurityCheck: () => { const m = document.getElementById('security-modal'); if(m) { m.style.opacity='0'; setTimeout(()=>{m.style.display='none'; document.getElementById('sec-password').value='';},300); } }
};

// Navegación Sidebar
window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.dashboard-view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
    const target = document.getElementById('view-' + tabName);
    if (target) {
        target.style.display = 'block'; setTimeout(() => target.classList.add('active'), 10);
        if (tabName === 'reportes') Dashboard.renderReports();
        if (tabName === 'ventas') Dashboard.renderSales();
        if (tabName === 'personal') Dashboard.initAdminUsers(globalState.userProfile?.rol);
        if (tabName === 'mensajes') Dashboard.loadChatMessages(globalState.currentChannel);
    }
    if (window.innerWidth <= 968) window.toggleSidebar();
};

window.toggleSidebar = function() { document.getElementById('sidebar')?.classList.toggle('active'); document.getElementById('mobile-overlay')?.classList.toggle('show'); };
window.toggleSidebarIfMobile = function() { if(window.innerWidth <= 968) window.toggleSidebar(); };

// Sistema de Calificación
window.RateUI = {
    current: 0,
    open: (oid) => { const m = document.getElementById('rating-modal'); if(m) { m.style.display='flex'; document.getElementById('rating-oid').value = oid; document.getElementById('rating-order-id').textContent = oid; window.RateUI.set(0); } },
    set: (n) => { window.RateUI.current = n; document.getElementById('rating-value').value = n; document.querySelectorAll('.star-btn').forEach(s => { s.style.color = parseInt(s.dataset.value) <= n ? '#fbbf24' : '#cbd5e1'; }); },
    submit: async (e) => {
        e.preventDefault(); const oid = document.getElementById('rating-oid').value; const comment = document.getElementById('rating-comment').value;
        if(window.RateUI.current === 0) return notify.error('Selecciona estrellas');
        const load = notify.loading('Enviando...');
        const { error } = await db.from('resenas').insert({ user_id: globalState.userProfile.id, pedido_id: oid, calificacion: window.RateUI.current, comentario: comment });
        notify.close(load); if(!error) { notify.success('¡Gracias!'); document.getElementById('rating-modal').style.display='none'; }
    }
};

// --- INICIALIZACIÓN (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    window.AuthModal.init();
    Store.updateCartCountUI();
    
    // Listeners Generales
    const btnTrash = document.getElementById('btn-vaciar-carrito');
    if(btnTrash) btnTrash.onclick = () => Store.clearCart(true); // Borrado manual limpia nube
    
    const rateForm = document.getElementById('form-rating');
    if(rateForm) rateForm.onsubmit = window.RateUI.submit;

    // Verificar Sesión e Inicializar UI
    const user = await Auth.checkSession();
    await AppUI.refreshState(user);

    // --- MANEJO DE FORMULARIOS ESTÁTICOS (Login/Registro en página) ---
    const staticLoginForm = document.getElementById('panel-login-form');
    if (staticLoginForm) staticLoginForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = staticLoginForm.querySelector('button[type="submit"]');
        await AppUI.handleAuthAction('login', document.getElementById('login-email').value, document.getElementById('login-password').value, btn);
    };

    const pLogin = document.getElementById('form-login');
    const pReg = document.getElementById('form-registro');
    if(pLogin) pLogin.onsubmit = async (e) => {
        e.preventDefault();
        const btn = pLogin.querySelector('button[type="submit"]');
        await AppUI.handleAuthAction('login', document.getElementById('login-email').value, document.getElementById('login-password').value, btn);
    };
    if(pReg) pReg.onsubmit = async (e) => {
        e.preventDefault();
        const btn = pReg.querySelector('button[type="submit"]');
        await AppUI.handleAuthAction('register', document.getElementById('registro-email').value, document.getElementById('registro-password').value, btn);
    };

    // Logout
    const btnLogoutPanel = document.getElementById('btn-logout-panel');
    if(btnLogoutPanel) btnLogoutPanel.onclick = AppUI.performLogout;
    const btnLogoutAccount = document.getElementById('btn-logout');
    if(btnLogoutAccount) btnLogoutAccount.onclick = AppUI.performLogout;

    // Tienda: Datos del producto
    const productData = await Store.fetchProduct();
    if(document.getElementById('producto-nombre')) {
        document.getElementById('producto-nombre').textContent = productData.nombre;
        document.getElementById('producto-precio').textContent = formatCurrency(productData.precio);
        document.getElementById('producto-stock').textContent = productData.stock_disponible;
    }
    if(document.getElementById('index-producto-nombre')) {
            document.getElementById('index-producto-nombre').textContent = productData.nombre;
            document.getElementById('index-producto-precio').textContent = formatCurrency(productData.precio);
    }
    const btnAdd = document.getElementById('btn-anadir-carrito');
    if(btnAdd) btnAdd.onclick = () => { const qty = parseInt(document.getElementById('cantidad')?.value || 1); Store.addToCart(qty); };

    // Lógica para página "Mi Cuenta"
    if(window.location.pathname.includes('cuenta.html')) {
        const tabs = { datos: { btn: document.getElementById('btn-tab-datos'), view: document.getElementById('seccion-mis-datos') }, pedidos: { btn: document.getElementById('btn-tab-pedidos'), view: document.getElementById('seccion-mis-pedidos') }, pagos: { btn: document.getElementById('btn-tab-pagos'), view: document.getElementById('seccion-pagos') } };
        const activateTab = (activeKey) => { Object.keys(tabs).forEach(key => { if (tabs[key].btn && tabs[key].view) { if (key === activeKey) { tabs[key].btn.classList.add('active'); tabs[key].view.style.display = 'block'; } else { tabs[key].btn.classList.remove('active'); tabs[key].view.style.display = 'none'; } } }); };
        if(tabs.datos.btn) tabs.datos.btn.onclick = () => activateTab('datos');
        if(tabs.pedidos.btn) tabs.pedidos.btn.onclick = () => { activateTab('pedidos'); if(user) Store.renderOrders(user.id); };
        if(tabs.pagos.btn) tabs.pagos.btn.onclick = () => activateTab('pagos');

        const fPerfil = document.getElementById('form-perfil');
        if(fPerfil) fPerfil.onsubmit = async (e) => {
            e.preventDefault();
            Auth.updateProfile(user.id, { nombre_completo: document.getElementById('profile-name').value, telefono: document.getElementById('profile-phone').value, direccion: document.getElementById('profile-address').value, latitud: document.getElementById('profile-lat')?.value, longitud: document.getElementById('profile-lng')?.value });
        };

        const walletForm = document.getElementById('form-pago-seguro');
        if(walletForm) walletForm.onsubmit = async (e) => {
            e.preventDefault();
            const load = notify.loading('Guardando tarjeta...');
            const walletData = { holder: document.getElementById('wallet-holder').value, number: document.getElementById('wallet-number').value, expiry: document.getElementById('wallet-expiry').value };
            const { error } = await db.from('perfiles').update({ datos_pago: walletData }).eq('id', user.id);
            notify.close(load); if(!error) { notify.success('Tarjeta guardada'); globalState.tempWalletData = walletData; } else notify.error('Error al guardar');
        };

        const secForm = document.getElementById('form-security-check');
        if(secForm) secForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            const pass = document.getElementById('sec-password').value;
            if(pass) { notify.success('Identidad confirmada'); window.AuthModal.closeSecurityCheck(); ['wallet-holder', 'wallet-number', 'wallet-expiry', 'wallet-cvc'].forEach(id => { const el = document.getElementById(id); if(el) { el.disabled = false; el.type = "text"; el.style.background = "rgba(255,255,255,0.15)"; } }); document.getElementById('btn-save-wallet').disabled = false; document.getElementById('btn-unlock-wallet').style.display = 'none'; document.getElementById('wallet-overlay').style.display = 'none'; if (globalState.tempWalletData) { document.getElementById('wallet-holder').value = globalState.tempWalletData.holder || ''; document.getElementById('wallet-number').value = globalState.tempWalletData.number || ''; document.getElementById('wallet-expiry').value = globalState.tempWalletData.expiry || ''; } }
        };
    }

    // Lógica para Checkout
    const formCheckout = document.getElementById('form-checkout');
    if(formCheckout) {
        formCheckout.onsubmit = async (e) => {
            e.preventDefault();
            try {
                if(!user) return notify.error('Debes iniciar sesión');
                const btn = formCheckout.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-lock"></i> Procesando...';
                
                const method = document.querySelector('input[name="payment-method"]:checked')?.value || 'card';
                const shipping = { nombre: document.getElementById('checkout-name').value, direccion: document.getElementById('checkout-address').value, telefono: document.getElementById('checkout-phone').value, metodo: method };
                
                document.getElementById('payment-modal').style.display = 'flex';
                await Store.processCheckout(user, shipping);
                notify.success('¡Pedido Confirmado!');
                setTimeout(() => window.location.href = 'cuenta.html', 2000);
            } catch (err) {
                document.getElementById('payment-modal').style.display = 'none';
                notify.error(err.message);
                const btn = formCheckout.querySelector('button[type="submit"]');
                btn.disabled = false;
                btn.innerHTML = originalText || 'Pagar Ahora';
            }
        };
    }
});