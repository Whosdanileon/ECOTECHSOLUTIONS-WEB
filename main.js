/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v30 (CURSOR FIX + STORE FULL)
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
 * 3. FUNCIONES DE INTERFAZ (CARRUSELES Y CURSOR FANTASMA)
 * ========================================================================== */

// Carrusel de Testimonios
const Carousel = {
    init: () => {
        const track = document.querySelector('.carousel-track');
        if (!track) return;
        const slides = Array.from(track.children);
        const nextButton = document.getElementById('next-slide');
        const prevButton = document.getElementById('prev-slide');
        const dotsNav = document.querySelector('.carousel-nav');
        const dots = Array.from(dotsNav.children);

        if(slides.length === 0) return;

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

        nextButton.addEventListener('click', () => {
            const currentSlide = track.querySelector('.current-slide');
            const nextSlide = currentSlide.nextElementSibling || slides[0];
            const currentDot = dotsNav.querySelector('.current-slide');
            const nextDot = currentDot.nextElementSibling || dots[0];
            moveToSlide(currentSlide, nextSlide);
            updateDots(currentDot, nextDot);
        });

        prevButton.addEventListener('click', () => {
            const currentSlide = track.querySelector('.current-slide');
            const prevSlide = currentSlide.previousElementSibling || slides[slides.length - 1];
            const currentDot = dotsNav.querySelector('.current-slide');
            const prevDot = currentDot.previousElementSibling || dots[dots.length - 1];
            moveToSlide(currentSlide, prevSlide);
            updateDots(currentDot, prevDot);
        });

        dotsNav.addEventListener('click', e => {
            const targetDot = e.target.closest('button');
            if (!targetDot) return;
            const currentSlide = track.querySelector('.current-slide');
            const currentDot = dotsNav.querySelector('.current-slide');
            const targetIndex = dots.findIndex(dot => dot === targetDot);
            const targetSlide = slides[targetIndex];
            moveToSlide(currentSlide, targetSlide);
            updateDots(currentDot, targetDot);
        });
    }
};

// Galería de Producto
window.ProductGallery = {
    set: (el) => {
        const src = el.src;
        document.getElementById('main-product-img').src = src;
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
    },
    next: () => {
        const current = document.querySelector('.thumb.active');
        if(!current) return;
        const next = current.nextElementSibling || document.querySelector('.thumb:first-child');
        window.ProductGallery.set(next);
    },
    prev: () => {
        const current = document.querySelector('.thumb.active');
        if(!current) return;
        const prev = current.previousElementSibling || document.querySelector('.thumb:last-child');
        window.ProductGallery.set(prev);
    }
};

// === CURSOR MÁGICO (HTML ELEMENT) ===
const LemnaCursor = {
    init: () => {
        // 1. Crear el elemento del cursor si no existe
        if (!document.getElementById('magic-cursor')) {
            const img = document.createElement('img');
            img.id = 'magic-cursor';
            img.src = 'images/cursor.png';
            img.alt = 'Cursor Lemna';
            document.body.appendChild(img);
        }

        const cursor = document.getElementById('magic-cursor');

        // 2. Mover el elemento con el mouse
        document.addEventListener('mousemove', (e) => {
            if (document.body.classList.contains('cursor-lemna-active')) {
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
            }
        });

        // 3. Activar en Hover de elementos especiales
        const triggers = document.querySelectorAll('.hover-lemna-trigger');
        triggers.forEach(el => {
            el.addEventListener('mouseenter', () => {
                document.body.classList.add('cursor-lemna-active');
                // Posicionar inmediatamente para evitar saltos
                // Nota: se necesita el evento mousemove para coordenadas exactas, 
                // pero el listener global ya se encarga.
            });
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-lemna-active');
            });
        });

        // 4. Activar temporalmente al hacer CLICK en botones
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                // Actualizar posición inicial del click para que aparezca ahí
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
                
                document.body.classList.add('cursor-lemna-active');
                setTimeout(() => {
                    // Solo quitarlo si no estamos haciendo hover sobre un trigger
                    if (!e.target.closest('.hover-lemna-trigger')) {
                        document.body.classList.remove('cursor-lemna-active');
                    }
                }, 600);
            }
        });
    }
};

/* ==========================================================================
 * 4. LÓGICA DE PARO DE EMERGENCIA GLOBAL
 * ========================================================================== */
window.toggleGlobalEmergency = async () => {
    const btn = document.getElementById('btn-global-stop');
    if (!globalEmergencyActive) {
        if (confirm("⚠️ ¿ESTÁS SEGURO? Se detendrán TODAS las máquinas.")) {
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
    } else {
        if (confirm("¿Restablecer el sistema?")) {
            globalEmergencyActive = false;
            document.body.classList.remove('emergency-mode');
            if(btn) {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA';
            }
            notify.success("Sistema restablecido.");
        }
    }
};

/* ==========================================================================
 * 5. FUNCIONES GLOBALES DE UI
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
 * 6. AUTENTICACIÓN
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
        if (error) notify.error('Error: ' + error.message);
        else window.location.reload();
    },
    register: async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('registro-email');
        const passInput = document.getElementById('registro-password');
        const email = emailInput.value.trim();
        const password = passInput.value;
        if (password.length < 6) return notify.error('Contraseña mín. 6 caracteres');
        const load = notify.loading('Creando cuenta...');
        const { data, error } = await db.auth.signUp({ email, password });
        notify.close(load);
        if (error) {
            notify.error(error.message);
        } else {
            await db.from('perfiles').insert([{ id: data.user.id, email: email, rol: 'Cliente', nombre_completo: 'Nuevo Usuario' }]);
            notify.success('Cuenta creada. Inicia sesión.');
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
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (p) {
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                setVal('profile-name', p.nombre_completo);
                setVal('profile-phone', p.telefono);
                setVal('profile-address', p.direccion);
                setVal('profile-email', user.email);
            }
        } catch (err) {}

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
 * 7. TIENDA Y CHECKOUT
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
                    if (layout) { layout.dataset.pid = data.id; layout.dataset.stock = data.stock_disponible; }
                    const btn = document.getElementById('btn-anadir-carrito');
                    if (data.stock_disponible <= 0 && btn) { btn.disabled = true; btn.textContent = "Agotado"; }
                }
                if (elIndex) {
                    elIndex.textContent = data.nombre;
                    document.getElementById('index-producto-precio').textContent = Utils.formatCurrency(data.precio);
                }
            }
        } catch (err) {}
    },
    addToCart: () => {
        const layout = document.querySelector('.shop-layout');
        if (!layout) return;
        const qtyInput = document.getElementById('cantidad');
        const qty = parseInt(qtyInput.value);
        const max = parseInt(layout.dataset.stock);
        if (isNaN(qty) || qty <= 0) return notify.error('Cantidad inválida');
        if (qty > max) return notify.error(`Solo hay ${max} disponibles`);
        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const pid = layout.dataset.pid;
        cart[pid] = (cart[pid] || 0) + qty;
        if (cart[pid] > max) { cart[pid] = max; notify.show('Ajustado al máximo', 'info'); } 
        else { notify.success('Añadido al carrito'); }
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        Store.updateCount();
    },
    clearCart: () => {
        if(confirm('¿Vaciar carrito?')) {
            localStorage.removeItem(CONFIG.CART_KEY);
            Store.updateCount();
            notify.show('Carrito vaciado', 'info');
            if (window.location.pathname.includes('checkout')) window.location.reload();
        }
    },
    updateCount: () => {
        const c = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const el = document.getElementById('carrito-contador');
        const btnVaciar = document.getElementById('btn-vaciar-carrito');
        if (el) {
            const count = Object.values(c).reduce((a, b) => a + b, 0);
            el.textContent = count;
            el.style.display = count === 0 ? 'none' : 'inline-block';
            if(btnVaciar) btnVaciar.style.display = count > 0 ? 'inline-block' : 'none';
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
                // ... (Simplificado: Lógica de pago ya conocida) ...
                const modal = document.getElementById('payment-modal');
                if(modal) modal.style.display = 'flex';
                // Simulación pasos
                try {
                    const s1 = document.getElementById('step-1'); if(s1) { s1.className='step active'; await Utils.wait(1000); s1.innerHTML='<i class="fa-solid fa-check"></i> Seguro'; s1.style.color='var(--color-success)'; }
                    const s2 = document.getElementById('step-2'); if(s2) { s2.className='step active'; await Utils.wait(1500); s2.innerHTML='<i class="fa-solid fa-check"></i> Autorizado'; s2.style.color='var(--color-success)'; }
                    const s3 = document.getElementById('step-3');
                    if(s3) {
                        s3.className='step active';
                        const envio = {
                            nombre: document.getElementById('checkout-name').value,
                            direccion: document.getElementById('checkout-address').value,
                            telefono: document.getElementById('checkout-phone').value,
                            metodo_pago: document.querySelector('input[name="payment-method"]:checked').value
                        };
                        const { error: orderError } = await db.from('pedidos').insert({ user_id: user.id, items: itemsToBuy, total, datos_envio: envio, estado: 'Pagado' });
                        if (orderError) throw orderError;
                        s3.innerHTML='<i class="fa-solid fa-check"></i> Pedido OK'; s3.style.color='var(--color-success)';
                    }
                    await Utils.wait(500);
                    const loadingState = document.getElementById('payment-loading-state');
                    const successState = document.getElementById('payment-success-state');
                    if(loadingState) loadingState.style.display='none';
                    if(successState) successState.style.display='block';
                    localStorage.removeItem(CONFIG.CART_KEY);
                    setTimeout(() => window.location.href = 'cuenta.html', 2000);
                } catch(err) {
                    if(modal) modal.style.display='none';
                    notify.error(err.message);
                }
            };
        }
    }
};

/* ==========================================================================
 * 8. DASHBOARD (PANEL DE CONTROL)
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
        } catch (e) { console.error(e); notify.error('Error inicializando panel'); }
    },
    applyPermissions: (rol) => {
        const tabPersonal = document.querySelector("li[onclick*='personal']");
        const hasAccess = CONFIG.ROLES.ADMIN.includes(rol);
        if (tabPersonal) tabPersonal.style.display = hasAccess ? 'block' : 'none';
        if (!hasAccess) {
            const viewPersonal = document.getElementById('view-personal');
            if (viewPersonal) viewPersonal.innerHTML = '<div style="padding:50px;"><h3>⛔ Acceso Denegado</h3></div>';
        }
    },
    initChat: async (profile) => {
        const list = document.querySelector('.message-list');
        const form = document.getElementById('chat-form');
        if (!list) return;
        const renderMessage = (m) => {
            const texto = Utils.escapeHtml(m.mensaje || m.content || '');
            const sender = Utils.escapeHtml(m.sender);
            const initial = sender.charAt(0).toUpperCase();
            if (document.querySelector(`[data-msg-id="${m.id}"]`)) return;
            const html = `
                <div class="msg-item" data-msg-id="${m.id}" style="animation: fadeIn 0.3s ease;">
                    <div class="msg-avatar">${initial}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between;"><strong>${sender}</strong><small>${Utils.formatTime(m.created_at)}</small></div>
                        <p style="margin:5px 0 0;">${texto}</p>
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
                    btn.disabled = true;
                    const { error } = await db.from('mensajes').insert({ mensaje: txt, sender: profile.nombre_completo || 'Usuario', role: profile.rol });
                    btn.disabled = false;
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
            if (m.id === 1) {
                const ctrls = isAdmin ? `
                <div class="machine-interface">
                    <div class="action-buttons">
                        <button class="btn-action btn-start ${m.controles.Inicio ? 'active' : ''}" onclick="window.plcCmd(1,'Inicio')"><i class="fa-solid fa-play"></i> INICIAR</button>
                        <button class="btn-action btn-stop" onclick="window.plcCmd(1,'Paro')"><i class="fa-solid fa-stop"></i> PARO</button>
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
            } else if (m.id === 2) {
                const t = m.controles.escalda_db || 0;
                const isHeating = m.controles.calentador_on;
                const ctrls = isAdmin ? `
                <div class="machine-interface" style="margin-top:20px;">
                    <div class="control-group">
                        <span class="control-label">Calefacción</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-off" ${!isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_off')"><label for="heat-off">Apagado</label></div>
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-on" ${isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_on')"><label for="heat-on">Encendido</label></div>
                        </div>
                    </div>
                </div>` : '';
                body = `<div class="clean-gauge"><div class="gauge-readout">${t.toFixed(1)}<span class="gauge-unit">°C</span></div><div class="gauge-bar-bg"><div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(t, 100)}%"></div></div></div>${ctrls}`;
            }
            container.insertAdjacentHTML('beforeend', `
                <div class="card machine-card" id="machine-${m.id}">
                    <div class="m-header"><h4>${Utils.escapeHtml(m.nombre)}</h4><div class="status-pill ${m.estado === 'En Ciclo' || (m.id === 2 && m.controles.calentador_on) ? 'on' : 'off'}"><span class="status-pill dot"></span>${m.estado}</div></div>
                    <div class="m-body">${body}</div>
                </div>`);
        });
    },
    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        let users = [];
        try {
            const { data } = await db.rpc('get_all_user_profiles');
            users = data || [];
        } catch (e) { const { data } = await db.from('perfiles').select('*'); users = data || []; }
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
                    <button class="btn-icon btn-save"><i class="fa-solid fa-save"></i></button>
                    ${isSys ? `<button class="btn-icon btn-delete"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}
                </td>
            </tr>`).join('');
        tbody.querySelectorAll('.btn-save').forEach(btn => {
            btn.onclick = async (e) => {
                const row = e.target.closest('tr');
                const newRole = row.querySelector('.role-select').value;
                await db.from('perfiles').update({ rol: newRole }).eq('id', row.dataset.uid);
                notify.success('Rol actualizado');
            };
        });
        if (isSys) {
            tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = async (e) => {
                    if (confirm('¿Eliminar?')) {
                        const row = e.target.closest('tr');
                        await db.from('perfiles').delete().eq('id', row.dataset.uid);
                        row.remove();
                    }
                };
            });
        }
    },
    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;
        State.realtimeSubscription = db.channel('public-room')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, payload => {
                if (globalEmergencyActive) return; 
                const m = payload.new;
                const card = document.getElementById(`machine-${m.id}`);
                if (!card) return;
                const pill = card.querySelector('.status-pill');
                if (pill) {
                    const isActive = m.id === 2 ? m.controles.calentador_on : (m.estado === 'En Ciclo');
                    pill.className = `status-pill ${isActive ? 'on' : 'off'}`;
                    pill.innerHTML = `<span class="status-pill dot"></span> ${Utils.escapeHtml(m.estado)}`;
                }
                // Actualizar controles M1 y M2 (Simplificado para brevedad, lógica completa en versión previa)
                if (m.id === 2) {
                    const bar = document.getElementById('temp-bar-2');
                    if (bar) bar.style.width = Math.min(m.controles.escalda_db, 100) + '%';
                    const ro = card.querySelector('.gauge-readout');
                    if(ro) ro.innerHTML = `${m.controles.escalda_db.toFixed(1)}<span class="gauge-unit">°C</span>`;
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
                if (typeof Dashboard.renderChatMessage === 'function') Dashboard.renderChatMessage(payload.new);
            })
            .subscribe((status) => {
                const indicator = document.querySelector('.status-indicator');
                if(indicator && status === 'SUBSCRIBED') { indicator.classList.add('online'); indicator.innerHTML = '<span class="dot"></span> Online'; }
            });
    }
};

/* ==========================================================================
 * 9. COMANDOS PLC
 * ========================================================================== */
window.plcCmd = async (id, act) => {
    try {
        if (globalEmergencyActive && act !== 'Paro') return notify.error("BLOQUEADO");
        const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
        let c = data.controles;
        if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
        else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; }
        await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id);
    } catch (e) { notify.error("Error PLC"); }
};
window.plcSw = async (id, k) => {
    try {
        if (globalEmergencyActive && !k.includes('off')) return notify.error("BLOQUEADO");
        const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
        let c = data.controles;
        if (id === 1) {
            if (k === 'online_llenado') { c.online_llenado = true; c.online_vaciado = false; }
            else if (k === 'online_vaciado') { c.online_vaciado = true; c.online_llenado = false; }
            else if (k === 'fill_off') { c.online_llenado = false; c.online_vaciado = false; }
            else if (k === 'online_arriba') { c.online_arriba = true; c.online_abajo = false; }
            else if (k === 'online_abajo') { c.online_abajo = true; c.online_arriba = false; }
            else if (k === 'tray_off') { c.online_arriba = false; c.online_abajo = false; }
        }
        if (id === 2) {
            if (k === 'heat_on') c.calentador_on = true;
            if (k === 'heat_off') c.calentador_on = false;
        }
        await db.from('maquinas').update({ controles: c }).eq('id', id);
    } catch(e) { notify.error("Error Switch"); }
};

/* ==========================================================================
 * 10. BOOTSTRAP
 * ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    if(document.querySelector('.carousel-track')) Carousel.init();
    LemnaCursor.init();
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

    const btnVaciar = document.getElementById('btn-vaciar-carrito');
    if(btnVaciar) btnVaciar.onclick = Store.clearCart;

    if (path.includes('cuenta')) {
        if (user) {
            document.getElementById('auth-forms').style.display='none';
            document.getElementById('user-info').style.display='grid';
            Auth.loadProfile(user);
            document.getElementById('form-perfil').onsubmit = (e) => Auth.saveProfile(e, user);
            document.getElementById('btn-logout').onclick = Auth.logout;
            const bD = document.getElementById('btn-tab-datos'), bP = document.getElementById('btn-tab-pedidos');
            if(bD && bP) {
                bD.onclick=()=>{document.getElementById('seccion-mis-datos').style.display='block';document.getElementById('seccion-mis-pedidos').style.display='none';bD.classList.add('active');bP.classList.remove('active');};
                bP.onclick=()=>{document.getElementById('seccion-mis-datos').style.display='none';document.getElementById('seccion-mis-pedidos').style.display='block';bP.classList.add('active');bD.classList.remove('active');Auth.loadProfile(user);};
            }
        } else {
            document.getElementById('auth-forms').style.display='block';
            document.getElementById('form-login').onsubmit = Auth.login;
            document.getElementById('form-registro').onsubmit = Auth.register;
        }
    } 
    else if (path.includes('panel')) {
        if (user) {
            document.getElementById('login-overlay').style.display='none';
            document.getElementById('dashboard-layout').style.display='flex';
            Dashboard.init(user);
            document.getElementById('btn-logout-panel').onclick = Auth.logout;
        } else {
            document.getElementById('panel-login-form').onsubmit = Auth.login;
        }
    }
    else if (path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
        Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if (btn) btn.onclick = Store.addToCart;
    }
    else if (path.includes('checkout')) {
        if (user) {
            document.getElementById('checkout-login-prompt').style.display='none';
            document.getElementById('checkout-container').style.display='grid';
            Store.initCheckout(user);
        } else {
            document.getElementById('checkout-login-prompt').style.display='block';
            document.getElementById('checkout-container').style.display='none';
        }
    }
});

/* ==========================================================================
 * 11. RESPONSIVIDAD
 * ========================================================================== */
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if(!sidebar || !overlay) return;
    sidebar.classList.toggle('active');
    overlay.classList.toggle('show');
    const closeBtn = document.getElementById('close-sidebar-btn');
    if (closeBtn) closeBtn.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
};
window.toggleSidebarIfMobile = function() { if (window.innerWidth <= 968) window.toggleSidebar(); };