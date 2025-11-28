const CONFIG = {
    SUPABASE_URL: 'https://dtdtqedzfuxfnnipdorg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY',
    CART_KEY: 'ecotech_cart',
    VISION_URL_KEY: 'ecotech_ngrok_url', // Key para guardar URL localmente
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
    mapInstance: null,
    mapMarker: null,
    machinePhysics: {
        m2_temp: 0,
        m2_heating: false
    },
    lastAlertTime: 0,
    currentChannel: 'General'
};

let globalEmergencyActive = false;

const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System v80: Vision Iframe Integration');

window.Utils = {
    formatCurrency: (val) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(val);
    },

    formatTime: (dateStr) => {
        return dateStr ? new Date(dateStr).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        }) : '--:--';
    },

    escapeHtml: (text) => {
        return text ? text.toString().replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m]) : '';
    },

    wait: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    confirmModal: (title, message, callback, btnClass = 'btn-primary-modal-danger', btnText = 'Confirmar') => {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) {
            existing.remove();
        }

        const modalHTML = `
            <div id="custom-confirm-modal" class="modal-overlay" style="display:flex; opacity:1;">
                <div class="modal-content-premium">
                    <div class="modal-icon-warning">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
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
        
        document.getElementById('btn-modal-cancel').onclick = () => {
            modal.remove();
        };
        
        document.getElementById('btn-modal-confirm').onclick = () => { 
            callback(); 
            modal.remove(); 
        };
    },

    printReceipt: async (orderId) => {
        const load = notify.loading('Generando documento...');
        
        const { data: order, error } = await db
            .from('pedidos')
            .select('*, perfiles(nombre_completo, email, telefono, direccion)')
            .eq('id', orderId)
            .single();
            
        notify.close(load);
        
        if(error || !order) {
            return notify.error('Error al recuperar el pedido');
        }

        const itemsHtml = (order.items || []).map(item => `
            <tr>
                <td style="padding:12px; border-bottom:1px solid #eee;">${item.nombre || 'Producto'}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: center;">${item.cantidad}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: right;">${window.Utils.formatCurrency(item.precio)}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: right;">${window.Utils.formatCurrency(item.precio * item.cantidad)}</td>
            </tr>
        `).join('');

        const receiptHTML = `
        <html>
        <head>
            <title>Recibo de Compra #${order.id}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 850px; margin: 0 auto; padding: 40px; line-height: 1.6; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; border-bottom: 4px solid #4CAF50; padding-bottom: 20px; }
                .company-info h2 { margin: 0; color: #2e7d32; font-size: 26px; text-transform: uppercase; }
                .invoice-info { text-align: right; }
                .invoice-info h1 { margin: 0; font-size: 32px; color: #444; letter-spacing: 2px; }
                .status-badge { display: inline-block; padding: 8px 16px; background: #eee; border-radius: 6px; font-weight: bold; text-transform: uppercase; font-size: 0.9em; margin-top: 10px; letter-spacing: 1px; }
                .columns { display: flex; justify-content: space-between; margin-bottom: 50px; }
                .col { width: 45%; }
                .col h3 { font-size: 14px; text-transform: uppercase; color: #999; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
                .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                .table th { text-align: left; padding: 15px 10px; background: #f8f9fa; border-bottom: 2px solid #ddd; font-size: 0.9em; text-transform: uppercase; color: #666; font-weight: 700; }
                .total-section { text-align: right; margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
                .total-row { font-size: 1.1em; margin: 8px 0; color: #666; }
                .total-final { font-size: 2.2em; color: #2e7d32; font-weight: bold; margin-top: 15px; }
                .footer { margin-top: 80px; text-align: center; font-size: 0.85em; color: #888; border-top: 1px solid #eee; padding-top: 30px; }
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-info">
                    <h2>ECOTECH SOLUTIONS</h2>
                    <p>Parque Industrial Tlaxcala 2000<br>Tlaxcala, México<br>RFC: ECO230101MX1<br>contacto@ecotech.com</p>
                </div>
                <div class="invoice-info">
                    <h1>RECIBO</h1>
                    <p><strong>Folio:</strong> #${String(order.id).padStart(8, '0')}</p>
                    <p><strong>Fecha de Emisión:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    <div class="status-badge" style="background: ${['Pagado','Enviado','Entregado'].includes(order.estado) ? '#dcfce7; color: #166534' : '#fff7ed; color: #c2410c'};">
                        ${order.estado}
                    </div>
                </div>
            </div>

            <div class="columns">
                <div class="col">
                    <h3>Facturar A</h3>
                    <strong>${order.datos_envio?.nombre || order.perfiles?.nombre_completo || 'Cliente Mostrador'}</strong><br>
                    ${order.datos_envio?.direccion || order.perfiles?.direccion || 'Dirección no registrada'}<br>
                    Tel: ${order.datos_envio?.telefono || order.perfiles?.telefono || '--'}
                    <br>${order.perfiles?.email || ''}
                </div>
                <div class="col">
                    <h3>Detalles del Pago</h3>
                    <strong>Método:</strong> ${order.datos_envio?.metodo === 'card' ? 'Tarjeta de Crédito/Débito' : 'Transferencia SPEI'}<br>
                    <strong>Moneda:</strong> Peso Mexicano (MXN)<br>
                    <strong>Tipo de Cambio:</strong> 1.00
                </div>
            </div>

            <table class="table">
                <thead>
                    <tr>
                        <th width="50%">Descripción del Producto</th>
                        <th width="15%" style="text-align: center;">Cantidad</th>
                        <th width="15%" style="text-align: right;">Precio Unitario</th>
                        <th width="20%" style="text-align: right;">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-row">Subtotal: ${window.Utils.formatCurrency(order.total / 1.16)}</div>
                <div class="total-row">IVA (16%): ${window.Utils.formatCurrency(order.total - (order.total / 1.16))}</div>
                <div class="total-final">${window.Utils.formatCurrency(order.total)}</div>
            </div>

            <div class="footer">
                <p>Gracias por su preferencia. Este documento es un comprobante de venta simplificado válido para fines de garantía.</p>
                <p>Si requiere factura fiscal (CFDI), por favor solicítela dentro de las próximas 24 horas en nuestro portal de facturación.</p>
                <button class="no-print" onclick="window.print()" style="padding: 14px 30px; background: #1b1b1b; color: white; border: none; cursor: pointer; border-radius: 6px; margin-top: 30px; font-size: 16px; font-weight: bold; letter-spacing: 1px;">
                    <svg style="width:14px;height:14px;fill:white;margin-right:8px;" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-2h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/></svg>
                    IMPRIMIR RECIBO
                </button>
            </div>
        </body>
        </html>`;

        const win = window.open('', '_blank');
        win.document.write(receiptHTML);
        win.document.close();
    }
};

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

window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if (btn) {
        btn.classList.add('active');
    }

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
        if (tabName === 'mensajes' && window.Dashboard) window.Dashboard.loadChatMessages(State.currentChannel);
    }
    
    if (window.innerWidth <= 968) {
        window.toggleSidebar();
    }
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
    if (window.innerWidth <= 968) {
        window.toggleSidebar(); 
    }
};

window.Maps = {
    init: (elementId, lat = 19.4326, lng = -99.1332, editable = true) => { 
        const el = document.getElementById(elementId);
        if (!el) return; 

        if (typeof L === 'undefined') {
            console.warn("Librería Leaflet no cargada.");
            return;
        }

        if (State.mapInstance) { 
            State.mapInstance.remove(); 
            State.mapInstance = null; 
        }

        const map = L.map(elementId).setView([lat, lng], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            attribution: '© OpenStreetMap' 
        }).addTo(map);
        
        const marker = L.marker([lat, lng], { draggable: editable }).addTo(map);
        
        if (editable) {
            const updateInputs = (pos) => {
                const latIn = document.getElementById('profile-lat');
                const lngIn = document.getElementById('profile-lng');
                if(latIn) latIn.value = pos.lat;
                if(lngIn) lngIn.value = pos.lng;
            };
            
            marker.on('dragend', function(e) {
                updateInputs(marker.getLatLng());
            });
            
            map.on('click', function(e) {
                marker.setLatLng(e.latlng);
                updateInputs(e.latlng);
            });
        }

        State.mapInstance = map;
        State.mapMarker = marker;
        
        setTimeout(() => map.invalidateSize(), 500);
    }
};

window.RateUI = {
    currentRating: 0,
    
    open: (orderId) => {
        const modal = document.getElementById('rating-modal');
        if (modal) {
            modal.style.display = 'flex';
            const displayId = document.getElementById('rating-order-id');
            if(displayId) displayId.textContent = orderId;
            
            const inputId = document.getElementById('rating-oid');
            if(inputId) inputId.value = orderId;
            
            window.RateUI.set(0);
            const comment = document.getElementById('rating-comment');
            if(comment) comment.value = '';
        } else {
            console.error("Modal #rating-modal no encontrado en el HTML.");
        }
    },
    
    set: (n) => {
        window.RateUI.currentRating = n;
        const hiddenInput = document.getElementById('rating-value');
        if(hiddenInput) hiddenInput.value = n;
        
        const stars = document.querySelectorAll('.star-btn');
        stars.forEach(s => {
            const val = parseInt(s.dataset.value);
            if (val <= n) {
                s.classList.add('active');
                s.style.color = '#fbbf24';
            } else {
                s.classList.remove('active');
                s.style.color = '#cbd5e1';
            }
        });
    },
    
    submit: async (e) => {
        e.preventDefault();
        
        if (window.RateUI.currentRating === 0) {
            return notify.error('Por favor selecciona una calificación.');
        }
        
        const load = notify.loading('Enviando opinión...');
        
        try {
            const { error } = await db.from('resenas').insert({
                user_id: State.userProfile.id,
                pedido_id: document.getElementById('rating-oid').value,
                calificacion: window.RateUI.currentRating,
                comentario: document.getElementById('rating-comment').value
            });
            
            notify.close(load);
            
            if (error) throw error;
            
            notify.success('¡Gracias por tu opinión!');
            document.getElementById('rating-modal').style.display = 'none';
            
        } catch (err) {
            notify.close(load);
            notify.error('Error al guardar: ' + err.message);
        }
    }
};

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
    openSecurityCheck: () => { 
        const m = document.getElementById('security-modal'); 
        if(m) { 
            m.style.display='flex'; 
            setTimeout(()=>m.style.opacity='1',10); 
        } 
    },
    closeSecurityCheck: () => { 
        const m = document.getElementById('security-modal'); 
        if(m) { 
            m.style.opacity='0'; 
            setTimeout(()=>{
                m.style.display='none'; 
                document.getElementById('sec-password').value='';
            },300); 
        } 
    }
};

window.Carousel = { 
    init: () => { 
        const track = document.querySelector('.carousel-track'); if (!track) return; 
        const slides = Array.from(track.children); if(!slides.length) return; 
        const nextButton = document.getElementById('next-slide'); 
        const prevButton = document.getElementById('prev-slide'); 
        const slideWidth = slides[0].getBoundingClientRect().width; 
        slides.forEach((slide, index) => slide.style.left = slideWidth * index + 'px'); 
        const moveToSlide = (current, target) => { 
            if(!target) return;
            track.style.transform = 'translateX(-' + target.style.left + ')'; 
            current.classList.remove('current-slide'); target.classList.add('current-slide'); 
        }; 
        if(nextButton) nextButton.onclick = () => { const cur = track.querySelector('.current-slide'); const next = cur.nextElementSibling || slides[0]; moveToSlide(cur, next); }; 
        if(prevButton) prevButton.onclick = () => { const cur = track.querySelector('.current-slide'); const prev = cur.previousElementSibling || slides[slides.length - 1]; moveToSlide(cur, prev); }; 
    } 
};

window.ProductGallery = { 
    set: (el) => { 
        const main = document.getElementById('main-product-img'); 
        if(main) main.src = el.src; 
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

/* --------------------------------------------------------------------------
   4. AUTENTICACIÓN
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
            notify.success('Bienvenido');
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

                // Cargar Mapa de Perfil
                const lat = data.latitud || 19.4326;
                const lng = data.longitud || -99.1332;
                if(document.getElementById('map-profile')) {
                    window.Maps.init('map-profile', lat, lng, true);
                    document.getElementById('profile-lat').value = lat;
                    document.getElementById('profile-lng').value = lng;
                }

                // Cargar datos de pago seguros
                if (data.datos_pago && data.datos_pago.number) {
                    State.tempWalletData = data.datos_pago;
                    const wNum = document.getElementById('wallet-number');
                    if(wNum) wNum.placeholder = "•••• " + data.datos_pago.number.slice(-4);
                    
                    const btnUnlock = document.getElementById('btn-unlock-wallet');
                    if(btnUnlock) {
                        btnUnlock.innerHTML = '<i class="fa-solid fa-lock"></i> Ver Datos';
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
        
        const lat = parseFloat(document.getElementById('profile-lat').value);
        const lng = parseFloat(document.getElementById('profile-lng').value);

        await db.from('perfiles').update({
            nombre_completo: document.getElementById('profile-name')?.value,
            telefono: document.getElementById('profile-phone')?.value,
            direccion: document.getElementById('profile-address')?.value,
            latitud: lat || null,
            longitud: lng || null
        }).eq('id', user.id);
        notify.close(load);
        notify.success('Guardado');
    },

    saveWallet: async (e, user) => {
        e.preventDefault();
        const load = notify.loading('Guardando...');
        const walletData = {
            holder: document.getElementById('wallet-holder').value,
            number: document.getElementById('wallet-number').value,
            expiry: document.getElementById('wallet-expiry').value
        };
        const { error } = await db.from('perfiles').update({ datos_pago: walletData }).eq('id', user.id);
        notify.close(load);
        if(!error) {
            notify.success('Tarjeta guardada');
            State.tempWalletData = walletData;
            setTimeout(() => location.reload(), 1500); 
        } else notify.error(error.message);
    },

    verifyPasswordAndReveal: async (e, user) => {
        e.preventDefault();
        const pass = document.getElementById('sec-password').value;
        const load = notify.loading('Verificando...');
        const { error } = await db.auth.signInWithPassword({ email: user.email, password: pass });
        notify.close(load);
        
        if(error) notify.error('Incorrecto');
        else {
            notify.success('Confirmado');
            window.AuthModal.closeSecurityCheck();
            ['wallet-holder', 'wallet-number', 'wallet-expiry', 'wallet-cvc'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.disabled = false; el.type = "text"; el.style.background = "rgba(255,255,255,0.15)"; }
            });
            document.getElementById('btn-save-wallet').disabled = false;
            document.getElementById('btn-unlock-wallet').style.display = 'none';
            document.getElementById('wallet-overlay').style.display = 'none';
            if (State.tempWalletData) {
                document.getElementById('wallet-holder').value = State.tempWalletData.holder || '';
                document.getElementById('wallet-number').value = State.tempWalletData.number || '';
                document.getElementById('wallet-expiry').value = State.tempWalletData.expiry || '';
            }
        }
    },

    trackOrder: (encodedData, orderId) => {
        try {
            const data = JSON.parse(decodeURIComponent(encodedData));
            const modal = document.getElementById('tracking-modal');
            const timeline = document.getElementById('tracking-timeline');
            const title = document.getElementById('track-id-display');
            
            if(!modal || !timeline) return notify.error('Error UI: Modal no encontrado');

            title.textContent = `${data.carrier || 'Envío'} - Guía: ${data.tracking_number || 'Pendiente'}`;
            
            const history = data.history || [ { status: 'Etiqueta Creada', date: new Date().toISOString(), location: 'Almacén Central', completed: true } ];
            timeline.innerHTML = history.map((step, index) => `
                <div class="timeline-item ${step.completed ? 'completed' : ''}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div style="font-weight:600;">${step.status}</div>
                        <div style="font-size:0.8rem; color:#888;">${step.location || 'En tránsito'}</div>
                    </div>
                </div>`).join('');
            
            modal.style.display = 'flex';
        } catch(e) { notify.error('Error de rastreo'); }
    }
};

/* --------------------------------------------------------------------------
   5. TELEMETRÍA
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
   6. DASHBOARD & GESTIÓN
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
                window.Dashboard.initChat();
                window.Dashboard.subscribeRealtime();
                window.Telemetry.init(); 
                
                // INICIAR VISIÓN SI HAY URL GUARDADA
                if(window.Vision) window.Vision.init();

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
    
    // --- GESTIÓN DE PERSONAL ---
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

            const { error: profileError } = await db.from('perfiles').upsert([{
                id: data.user.id,
                email: email,
                nombre_completo: name,
                rol: role,
                area: dept
            }]);

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
        window.Utils.confirmModal('¿Eliminar Empleado?', 'Se borrará su acceso.', async () => {
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
        try {
            const { data, error } = await db.from('perfiles').select('*').order('created_at', { ascending: false });
            if (error || !data) return;
            
            const isSys = CONFIG.ROLES.SYS.includes(myRole);
            
            tbody.innerHTML = data.map(u => {
                const isMe = u.id === State.userProfile.id;
                return `
                <tr data-uid="${u.id}">
                    <td>
                        <div style="font-weight:600;">${window.Utils.escapeHtml(u.nombre_completo || 'Sin Nombre')}</div>
                        <div style="font-size:0.85rem; color:#666;">${window.Utils.escapeHtml(u.email)}</div>
                    </td>
                    <td>
                        <select class="form-input role-select" style="padding:5px; width:100%;" ${isMe ? 'disabled' : ''}>
                            ${['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador', 'Cliente'].map(r => 
                                `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`
                            ).join('')}
                        </select>
                    </td>
                    <td>${window.Utils.escapeHtml(u.area || '-')}</td>
                    <td>
                        <div style="display:flex; gap:5px;">
                            <button class="btn-icon btn-save" onclick="window.Dashboard.updateUserRole('${u.id}', this)" title="Guardar Rol" ${isMe ? 'disabled' : ''}>
                                <i class="fa-solid fa-save"></i>
                            </button>
                            ${isSys && !isMe ? `
                            <button class="btn-icon btn-delete" onclick="window.Dashboard.deleteUser('${u.id}')" title="Eliminar">
                                <i class="fa-solid fa-trash" style="color:red"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>`;
            }).join('');
            
            const formCreate = document.getElementById('form-create-employee');
            if(formCreate) formCreate.onsubmit = window.Dashboard.createEmployee;

        } catch (e) { console.error("Error usuarios:", e); }
    },

    updateUserRole: async (uid, btn) => {
        const row = btn.closest('tr');
        const rol = row.querySelector('.role-select').value;
        const load = notify.loading('Actualizando...');
        const { error } = await db.from('perfiles').update({ rol }).eq('id', uid);
        notify.close(load);
        if(error) notify.error(error.message);
        else notify.success('Actualizado');
    },

    renderMachines: async (rol) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;
        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;
        
        container.innerHTML = '';
        data.forEach(m => {
            const isAdmin = CONFIG.ROLES.ADMIN.includes(rol);
            const safeName = window.Utils.escapeHtml(m.nombre);
            let body = '';
            
            if (m.id === 1) {
                const isStarted = m.controles.Inicio; 
                const ctrls = isAdmin ? `
                <div class="machine-interface">
                    <div class="action-buttons">
                        <button class="btn-action btn-start ${isStarted ? 'active' : ''}" onclick="window.plcCmd(1,'Inicio')"><i class="fa-solid fa-play"></i> INICIAR</button>
                        <button class="btn-action btn-stop" onclick="window.plcCmd(1,'Paro')"><i class="fa-solid fa-stop"></i> PARO</button>
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
                    <div class="control-group"><span class="control-label">Calentadores</span>
                        <div class="segmented-control">
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-off" ${!isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_off')"><label for="heat-off">OFF</label></div>
                            <div class="segmented-option"><input type="radio" name="heat" id="heat-on" ${isHeating ? 'checked' : ''} onclick="window.plcSw(2,'heat_on')"><label for="heat-on">ON</label></div>
                        </div>
                    </div>
                </div>` : '';
                body = `<div class="clean-gauge"><div class="gauge-readout" id="gauge-m2-val">${currentTemp.toFixed(1)}<span class="gauge-unit">°C</span></div><div class="gauge-bar-bg"><div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(currentTemp, 100)}%; background:${currentTemp > 85 ? '#ef4444' : '#3b82f6'}"></div></div></div>${ctrls}`;
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
                return `<tr><td style="color:#666; font-size:0.85rem;">${new Date(l.created_at).toLocaleTimeString()}</td><td>${l.maquina_id === 0 ? 'General' : 'M'+l.maquina_id}</td><td style="font-weight:500;">${window.Utils.escapeHtml(l.evento)}</td><td><i class="fa-solid fa-user-tag" style="color:#94a3b8; margin-right:5px;"></i>${window.Utils.escapeHtml(l.usuario)}</td><td><span class="badge" style="background:${badgeColor}20; color:${badgeColor}; font-size:0.75rem;">${l.tipo}</span></td></tr>`;
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
                ? '<span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #ffedd5;">Transferencia</span>' 
                : '<span class="badge" style="background:#f0fdf4; color:#166534; border:1px solid #dcfce7;">Tarjeta</span>';
            
            let actions = `<button onclick="window.Utils.printReceipt(${o.id})" class="btn-sm btn-light hover-lemna-trigger" title="Ver Recibo"><i class="fa-solid fa-print"></i></button> `;
            if (o.estado === 'Pendiente') {
                actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Pagado')" class="btn btn-sm btn-primary hover-lemna-trigger" title="Aprobar"><i class="fa-solid fa-check"></i></button><button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Cancelado')" class="btn btn-sm btn-danger hover-lemna-trigger" title="Rechazar"><i class="fa-solid fa-xmark"></i></button>`;
            } else if (o.estado === 'Pagado') {
                actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Enviado')" class="btn btn-sm btn-primary hover-lemna-trigger"><i class="fa-solid fa-truck-fast"></i> Enviar</button>`;
            } else if (o.estado === 'Enviado') {
                 actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Entregado')" class="btn btn-sm btn-success hover-lemna-trigger" style="background:#16a34a; border:none; color:white;"><i class="fa-solid fa-box-open"></i> Entregado</button>`;
            }

            return `<tr><td><span style="font-weight:600;">#${String(o.id).slice(0, 8)}</span><br><small style="color:#888;">${new Date(o.created_at).toLocaleDateString()}</small></td><td>${window.Utils.escapeHtml(o.perfiles?.nombre_completo || 'Usuario')}<br><small style="color:#666;">${window.Utils.escapeHtml(o.perfiles?.email)}</small></td><td><div style="font-weight:700;">${window.Utils.formatCurrency(o.total)}</div>${methodLabel}</td><td><span class="badge">${window.Utils.escapeHtml(o.estado)}</span></td><td>${actions}</td></tr>`;
        }).join('');
    },

    updateOrderStatus: async (orderId, newStatus) => {
        window.Utils.confirmModal('Actualizar', `¿Estado a ${newStatus}?`, async () => {
            const load = notify.loading('Actualizando...');
            const updates = { estado: newStatus };
            if(newStatus === 'Enviado') updates.tracking_info = { carrier: 'FedEx Eco', tracking_number: 'TRK-'+Math.floor(Math.random()*1000000), history: [{status: 'Recolectado', date: new Date().toISOString(), location: 'Planta EcoTech', completed: true}] };
            if(newStatus === 'Entregado') updates.tracking_info = { history: [{status: 'Enviado', date: new Date().toISOString(), completed: true}, {status: 'Entregado', date: new Date().toISOString(), completed: true}] };
            const { data, error } = await db.from('pedidos').update(updates).eq('id', orderId).select(); 
            notify.close(load);
            if (error) { notify.error('Error SQL: ' + error.message); } else { notify.success(`Pedido actualizado.`); window.Dashboard.renderSales(); }
        });
    },

    initChat: () => {
        const input = document.getElementById('chat-input-text');
        if(input) {
            input.onkeypress = (e) => { if(e.key === 'Enter') window.Dashboard.sendMessage(); };
        }
    },

    switchChatChannel: (channelName) => {
        State.currentChannel = channelName;
        document.querySelectorAll('.btn-channel').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-ch-${channelName}`);
        if(activeBtn) activeBtn.classList.add('active');
        const badge = document.getElementById('current-channel-badge');
        if(badge) badge.textContent = `# ${channelName}`;
        const inp = document.getElementById('chat-input-text');
        if(inp) inp.placeholder = `Mensaje para #${channelName}...`;
        window.Dashboard.loadChatMessages(channelName);
    },

    loadChatMessages: async (channel) => {
        const list = document.getElementById('chat-messages-area');
        if (!list) return;
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
        const { data } = await db.from('mensajes').select('*').eq('canal', channel).order('created_at', { ascending: false }).limit(50);
        list.innerHTML = '';
        if (data && data.length > 0) {
            [...data].reverse().forEach(m => window.Dashboard.renderChatMessage(m, false)); 
            list.scrollTop = list.scrollHeight;
        } else {
            list.innerHTML = `<div style="text-align:center; padding:40px; color:#cbd5e1;"><i class="fa-regular fa-comments fa-2x"></i><p>Canal #${channel} vacío.</p></div>`;
        }
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input-text');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        const { error } = await db.from('mensajes').insert({ 
            mensaje: text, 
            sender: State.userProfile.nombre_completo, 
            role: State.userProfile.rol,
            canal: State.currentChannel
        });
        if (error) notify.error('Error enviando mensaje');
    },

    renderChatMessage: (m, animate = true) => {
        if (m.canal !== State.currentChannel) return;
        const list = document.getElementById('chat-messages-area');
        if (!list) return;
        if (list.innerHTML.includes('Canal #')) list.innerHTML = '';
        const isMe = m.sender === State.userProfile.nombre_completo;
        const html = `<div class="msg-item" style="${animate ? 'animation: fadeIn 0.3s ease;' : ''} ${isMe ? 'background:#eff6ff; border-color:#bfdbfe;' : ''}"><div class="msg-avatar" style="${isMe ? 'background:#3b82f6; color:white;' : ''}">${m.sender.charAt(0).toUpperCase()}</div><div style="flex:1;"><div style="display:flex; justify-content:space-between;"><strong>${window.Utils.escapeHtml(m.sender)}</strong><small style="color:#888;">${window.Utils.formatTime(m.created_at)}</small></div><p style="margin:5px 0 0; color:#333;">${window.Utils.escapeHtml(m.mensaje)}</p></div></div>`;
        list.insertAdjacentHTML('beforeend', html);
        list.scrollTop = list.scrollHeight;
    },

    subscribeRealtime: () => {
        if (State.realtimeSubscription) return;
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
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora_industrial' }, () => {
                const view = document.getElementById('view-reportes');
                if(view && view.style.display !== 'none') window.Dashboard.renderReports();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => { 
                const view = document.getElementById('view-ventas');
                if(view && view.style.display !== 'none') window.Dashboard.renderSales();
            })
            .subscribe();
    }
};

/* --------------------------------------------------------------------------
   7. CONTROL GLOBAL (PLC)
   -------------------------------------------------------------------------- */
window.plcCmd = async (id, act) => { 
    if (globalEmergencyActive && act !== 'Paro') return notify.error("BLOQUEO DE EMERGENCIA"); 
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
    let c = data.controles; 
    if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
    else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; } 
    await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id); 
    await window.Dashboard.logEvent(id, act, 'INFO');
};

window.plcSw = async (id, k) => { 
    if (globalEmergencyActive && !k.includes('off')) return notify.error("BLOQUEO DE EMERGENCIA"); 
    const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
    let c = data.controles; 
    if (id === 1) { 
        if (k.includes('llenado')) { c.online_llenado = true; c.online_vaciado = false; } 
        else if (k.includes('vaciado')) { c.online_vaciado = true; c.online_llenado = false; } 
        else if (k.includes('off')) { c.online_llenado = false; c.online_vaciado = false; }
    } else if (id === 2) { 
        c.calentador_on = (k === 'heat_on');
    } 
    await db.from('maquinas').update({ controles: c }).eq('id', id); 
    await window.Dashboard.logEvent(id, k, 'INFO');
};

/* --------------------------------------------------------------------------
   7.1. SISTEMA DE VISIÓN (IFRAME)
   -------------------------------------------------------------------------- */
window.Vision = {
    baseUrl: null,
    
    init: () => {
        const storedUrl = localStorage.getItem(CONFIG.VISION_URL_KEY);
        if (storedUrl) {
            document.getElementById('ngrok-url-input').value = storedUrl;
        }
    },

    connect: () => {
        const input = document.getElementById('ngrok-url-input');
        let url = input.value.trim();
        
        // Limpieza básica de la URL (quitar slash final)
        if (url.endsWith('/')) url = url.slice(0, -1);
        
        if (!url) return notify.error('Ingresa una URL de Ngrok válida');
        if (!url.startsWith('http')) return notify.error('La URL debe empezar con http:// o https://');

        window.Vision.baseUrl = url;
        localStorage.setItem(CONFIG.VISION_URL_KEY, url);
        
        notify.success('Cargando panel de visión...');
        
        // Cargar la página completa de Streamlit/Web en el iframe
        const iframe = document.getElementById('vision-iframe');
        iframe.src = url;
        
        document.getElementById('vision-status').classList.replace('off', 'on');
        document.getElementById('vision-status').innerHTML = '<span class="status-pill dot"></span>Incrustado';
    }
};

window.toggleGlobalEmergency = async () => { 
    if (!globalEmergencyActive) { 
        window.Utils.confirmModal('PARO DE EMERGENCIA', '¿Detener TODAS las máquinas?', async () => { 
            globalEmergencyActive = true; document.body.classList.add('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); if(btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> RESTABLECER'; } 
            await window.plcCmd(1, 'Paro'); await window.plcSw(2, 'heat_off'); 
            await window.Dashboard.logEvent(0, 'PARO DE EMERGENCIA GLOBAL', 'ERROR');
        }); 
    } else { 
        window.Utils.confirmModal('Restablecer', '¿Reactivar operaciones?', async () => { 
            globalEmergencyActive = false; document.body.classList.remove('emergency-mode'); 
            const btn = document.getElementById('btn-global-stop'); if(btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA'; } 
            await window.Dashboard.logEvent(0, 'Reinicio de Planta', 'INFO');
        }); 
    } 
};

/* --------------------------------------------------------------------------
   8. STORE (TIENDA)
   -------------------------------------------------------------------------- */
window.Store = {
    loadProduct: async () => {
        try {
            const { data } = await db.from('productos').select('*').eq('id', 1).single();
            if(data) {
                const els = { name: 'producto-nombre', price: 'producto-precio', stock: 'producto-stock' };
                if(document.getElementById(els.name)) document.getElementById(els.name).textContent = data.nombre;
                if(document.getElementById(els.price)) document.getElementById(els.price).textContent = window.Utils.formatCurrency(data.precio);
                if(document.getElementById(els.stock)) document.getElementById(els.stock).textContent = data.stock_disponible;
                // INDEX FIX
                const idxName = document.getElementById('index-producto-nombre'); if(idxName) idxName.textContent = data.nombre;
                const idxPrice = document.getElementById('index-producto-precio'); if(idxPrice) idxPrice.textContent = window.Utils.formatCurrency(data.precio) + " MXN";
            }
        } catch(e){}
    },
    addToCart: () => {
        // [CORRECCIÓN] Leer cantidad
        const qtyInput = document.getElementById('cantidad');
        const qty = qtyInput ? parseInt(qtyInput.value) : 1; 
        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        cart['1'] = (cart['1'] || 0) + qty;
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        window.Store.updateCount();
        notify.success(`Se añadieron ${qty} bolsas`);
    },
    clearCart: () => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY));
        if(!cart || !Object.keys(cart).length) return notify.show('Carrito vacío', 'info');
        window.Utils.confirmModal('¿Vaciar?', 'Se eliminarán los productos', () => { localStorage.removeItem(CONFIG.CART_KEY); window.Store.updateCount(); if(window.location.pathname.includes('checkout')) window.location.reload(); });
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
        if(!cart || !Object.keys(cart).length) { const c = document.getElementById('checkout-items'); if(c) c.innerHTML='<p>Vacío</p>'; return; }
        
        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if(p) {
            // Rellenar datos con validación de nulos
            if(document.getElementById('checkout-name')) document.getElementById('checkout-name').value = p.nombre_completo || '';
            if(document.getElementById('checkout-address')) document.getElementById('checkout-address').value = p.direccion || '';
            if(document.getElementById('checkout-phone')) document.getElementById('checkout-phone').value = p.telefono || '';
            
            // [CORRECCIÓN] Rellenar datos de tarjeta
            if (p.datos_pago) {
                const cn = document.getElementById('card-number');
                const ch = document.getElementById('card-holder');
                const ce = document.getElementById('card-expiry');
                if(cn && p.datos_pago.number) cn.value = p.datos_pago.number;
                if(ch && p.datos_pago.holder) ch.value = p.datos_pago.holder;
                if(ce && p.datos_pago.expiry) ce.value = p.datos_pago.expiry;
                notify.show('Datos de pago cargados', 'success');
            }

            if(p.latitud && p.longitud && document.getElementById('map-checkout')) { window.Maps.init('map-checkout', p.latitud, p.longitud, false); }
        }

        // [CORRECCIÓN] Calcular total real
        let total = 0;
        let itemsList = [];
        let html = '';
        
        // ID '1' hardcodeado para el MVP, pero extensible
        if(cart['1']) {
            const { data: prod } = await db.from('productos').select('*').eq('id', 1).single();
            if(prod) {
                const qty = cart['1'];
                const subtotal = prod.precio * qty;
                total = subtotal;
                itemsList.push({ id:1, nombre:prod.nombre, precio:prod.precio, cantidad:qty });
                html += `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:10px;"><span>${prod.nombre} x${qty}</span><strong>${window.Utils.formatCurrency(subtotal)}</strong></div>`;
            }
        }

        const cItems = document.getElementById('checkout-items'); if(cItems) cItems.innerHTML = html;
        const cTotal = document.getElementById('checkout-total'); if(cTotal) cTotal.textContent = window.Utils.formatCurrency(total);
        const cSub = document.getElementById('checkout-subtotal'); if(cSub) cSub.textContent = window.Utils.formatCurrency(total / 1.16);
        
        const form = document.getElementById('form-checkout');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const modal = document.getElementById('payment-modal'); if(modal) modal.style.display = 'flex';
                try {
                    const method = document.querySelector('input[name="payment-method"]:checked')?.value || 'card';
                    const envio = {
                        nombre: document.getElementById('checkout-name').value,
                        direccion: document.getElementById('checkout-address').value,
                        telefono: document.getElementById('checkout-phone').value,
                        metodo: method,
                        ubicacion: { lat: p?.latitud, lng: p?.longitud }
                    };
                    const estadoInicial = method === 'transfer' ? 'Pendiente' : 'Pagado';
                    await db.from('pedidos').insert({ user_id: user.id, items: [{id:1, nombre:'Lemna', precio:750, cantidad:cart['1']}], total: 750, datos_envio: envio, estado: estadoInicial });
                    
                    // Descontar stock
                    if(itemsList.length > 0) {
                         // Simple update for demo
                         const { data:curr } = await db.from('productos').select('stock_disponible').eq('id',1).single();
                         if(curr) await db.from('productos').update({stock_disponible: Math.max(0, curr.stock_disponible - itemsList[0].cantidad)}).eq('id',1);
                    }

                    await window.Utils.wait(2000);
                    localStorage.removeItem(CONFIG.CART_KEY);
                    window.location.href='cuenta.html';
                } catch(err) { if(modal) modal.style.display = 'none'; notify.error(err.message); }
            };
        }
    },
    renderOrders: async (userId) => {
        const list = document.getElementById('pedidos-lista-container');
        if (list) {
            const { data: orders } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (orders && orders.length > 0) {
                list.innerHTML = orders.map(o => {
                    let statusColor = 'primary';
                    if (o.estado === 'Cancelado') statusColor = 'danger'; else if (o.estado === 'Pagado') statusColor = 'info'; else if (o.estado === 'Enviado') statusColor = 'primary'; else if (o.estado === 'Entregado') statusColor = 'success';
                    
                    let btns = `<button onclick="window.Utils.printReceipt(${o.id})" class="btn-sm btn-light hover-lemna-trigger"><i class="fa-solid fa-print"></i> Recibo</button>`;
                    
                    if(['Enviado','Entregado'].includes(o.estado) && o.tracking_info) {
                         const safe = encodeURIComponent(JSON.stringify(o.tracking_info));
                         btns += `<button onclick="window.Auth.trackOrder('${safe}', ${o.id})" class="btn-sm btn-primary hover-lemna-trigger" style="margin-left:5px;">Rastrear</button>`;
                    }
                    
                    // [CORRECCIÓN] Botón de calificación
                    if(o.estado === 'Entregado') {
                        btns += `<button onclick="window.RateUI.open(${o.id})" class="btn-sm hover-lemna-trigger" style="margin-left:5px; background:#f59e0b; color:white; border:none; border-radius:20px;">★ Calificar</button>`;
                    }

                    if(o.estado === 'Pendiente') btns += `<button onclick="window.Auth.cancelOrder(${o.id})" class="btn-text-danger hover-lemna-trigger" style="margin-left:10px;">Cancelar</button>`;

                    return `<div class="pedido-card" style="border-left-color: var(--color-${statusColor});"><div class="pedido-header"><div><strong>Pedido #${String(o.id).slice(0, 8)}</strong><br><small>${new Date(o.created_at).toLocaleDateString()}</small></div><span class="badge">${o.estado}</span></div><div class="order-info"><div>${window.Utils.formatCurrency(o.total)}</div><div>${btns}</div></div></div>`;
                }).join('');
            } else list.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No tienes pedidos aún.</p>';
        }
    }
};

/* --------------------------------------------------------------------------
   10. BOOTSTRAP
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    window.AuthModal.init();
    if(window.Carousel.init) window.Carousel.init();
    
    // [CORRECCIÓN] Inicializar formulario de rating si existe
    const rateForm = document.getElementById('form-rating');
    if(rateForm) rateForm.onsubmit = window.RateUI.submit;
    
    window.Store.updateCount();
    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    if(document.getElementById('auth-links-container')) {
        document.getElementById('auth-links-container').innerHTML = user ? `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>` : `<a href="#" class="nav-link" onclick="window.AuthModal.open(); return false;"><i class="fa-solid fa-sign-in-alt"></i> Acceder</a>`;
    }
    
    const btnTrash = document.getElementById('btn-vaciar-carrito');
    if(btnTrash) btnTrash.onclick = window.Store.clearCart;

    if(path.includes('panel')) {
        if(user) {
            const { data: p } = await db.from('perfiles').select('rol').eq('id', user.id).single();
            if(!p || !CONFIG.ROLES.STAFF.includes(p.rol)) { notify.error('Acceso Denegado'); setTimeout(()=>location.href='index.html',1500); return; }
            document.getElementById('login-overlay').style.display='none'; document.getElementById('dashboard-layout').style.display='flex';
            await window.Dashboard.init(user);
            document.getElementById('btn-logout-panel').onclick = window.Auth.logout;
        } else { document.getElementById('panel-login-form').onsubmit = window.Auth.login; }
    } else if(path.includes('cuenta') && user) {
        document.getElementById('auth-forms').style.display='none'; document.getElementById('user-info').style.display='grid';
        window.Auth.loadProfile(user);
        document.getElementById('form-perfil').onsubmit = (e) => window.Auth.saveProfile(e, user);
        const d = document.getElementById('btn-tab-datos'); const p = document.getElementById('btn-tab-pedidos'); const w = document.getElementById('btn-tab-pagos');
        if(d) d.onclick = () => { document.querySelectorAll('.content-section').forEach(s=>s.style.display='none'); document.getElementById('seccion-mis-datos').style.display='block'; d.classList.add('active'); p.classList.remove('active'); w.classList.remove('active'); };
        if(p) p.onclick = () => { document.querySelectorAll('.content-section').forEach(s=>s.style.display='none'); document.getElementById('seccion-mis-pedidos').style.display='block'; p.classList.add('active'); d.classList.remove('active'); w.classList.remove('active'); window.Auth.loadProfile(user); };
        if(w) w.onclick = () => { document.querySelectorAll('.content-section').forEach(s=>s.style.display='none'); document.getElementById('seccion-pagos').style.display='block'; w.classList.add('active'); d.classList.remove('active'); p.classList.remove('active'); };
        document.getElementById('btn-logout').onclick = window.Auth.logout;
        const secForm = document.getElementById('form-security-check'); if(secForm) secForm.onsubmit = (e) => window.Auth.verifyPasswordAndReveal(e, user);
        // [CORRECCIÓN] Guardar tarjeta
        const payForm = document.getElementById('form-pago-seguro'); if(payForm) payForm.onsubmit = (e) => window.Auth.saveWallet(e, user);
    } else if (path.includes('checkout')) {
        if(user) {
            document.getElementById('checkout-login-prompt').style.display='none';
            document.getElementById('checkout-container').style.display='grid';
            window.Store.initCheckout(user);
        } else {
            const lp = document.getElementById('checkout-login-prompt'); if(lp) { lp.style.display='block'; lp.innerHTML=`<div style="text-align:center"><h2>Inicia sesión</h2><br><button class="btn btn-primary" onclick="window.AuthModal.open()">Entrar</button></div>`; }
        }
    } else {
        // Tienda / Index
        window.Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if(btn) btn.onclick = window.Store.addToCart;
    }
});