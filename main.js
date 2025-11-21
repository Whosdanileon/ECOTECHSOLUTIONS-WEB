/* ==========================================================================
 * ECOTECHSOLUTIONS - MAIN.JS v19 (CHECKOUT DISPLAY FIX)
 * ========================================================================== */

/* 1. CONFIGURACIÓN */
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

const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
console.log('✅ EcoTech System: Online');

/* ==========================================================================
 * 2. UTILIDADES
 * ========================================================================== */
const notify = {
    show: (msg, type = 'info') => {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div'); container.id = 'notification-container'; container.className = 'notification-container';
            document.body.appendChild(container);
        }
        const div = document.createElement('div');
        div.className = `notification notification-${type} show`;
        div.innerHTML = `<div class="notification-icon">${type==='success'?'<i class="fa-solid fa-check"></i>':(type==='error'?'<i class="fa-solid fa-times"></i>':'<i class="fa-solid fa-info"></i>')}</div><div class="notification-content">${msg}</div>`;
        container.appendChild(div);
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 4000);
        return div;
    },
    success: (m) => notify.show(m, 'success'),
    error: (m) => notify.show(m, 'error'),
    loading: (m) => notify.show(m, 'loading'),
    close: (div) => { if(div) { div.classList.remove('show'); setTimeout(() => div.remove(), 300); } }
};

const Utils = {
    formatCurrency: (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val),
    formatTime: (dateStr) => new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    validate: (form) => {
        let valid = true;
        form.querySelectorAll('[required]').forEach(i => {
            if (!i.value.trim()) { i.classList.add('input-error'); valid = false; }
            else i.classList.remove('input-error');
        });
        return valid;
    }
};

/* ==========================================================================
 * 3. FUNCIONES GLOBALES (UI)
 * ========================================================================== */
window.switchTab = function(tabName) {
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const btn = document.querySelector(`.sidebar-nav li[onclick*="${tabName}"]`);
    if(btn) btn.classList.add('active');

    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tabName);
    if(view) view.classList.add('active');
};

/* ==========================================================================
 * 4. AUTENTICACIÓN
 * ========================================================================== */
const Auth = {
    login: async (e) => {
        e.preventDefault();
        const { data, error } = await db.auth.signInWithPassword({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        });
        if (error) notify.error('Error: ' + error.message);
        else window.location.reload();
    },

    register: async (e) => {
        e.preventDefault();
        const email = document.getElementById('registro-email').value;
        const { data, error } = await db.auth.signUp({
            email: email,
            password: document.getElementById('registro-password').value
        });
        if (error) notify.error(error.message);
        else {
            await db.from('perfiles').insert([{ id: data.user.id, email: email, rol: 'Cliente', nombre_completo: 'Nuevo Usuario' }]);
            notify.success('Cuenta creada. Inicia sesión.');
        }
    },

    logout: async () => { 
        const load = notify.loading('Cerrando sesión...');
        await db.auth.signOut(); 
        notify.close(load);
        window.location.href = 'index.html'; 
    },

    loadProfile: async (user) => {
        try {
            const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (p) {
                if(document.getElementById('profile-name')) document.getElementById('profile-name').value = p.nombre_completo || '';
                if(document.getElementById('profile-phone')) document.getElementById('profile-phone').value = p.telefono || '';
                if(document.getElementById('profile-address')) document.getElementById('profile-address').value = p.direccion || '';
                if(document.getElementById('profile-email')) document.getElementById('profile-email').value = user.email;
            }
        } catch (err) { console.log("Perfil incompleto"); }
        
        const list = document.getElementById('pedidos-lista-container');
        if (list) {
            const { data: orders } = await db.from('pedidos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (orders && orders.length > 0) {
                list.innerHTML = orders.map(o => `
                    <div class="pedido-card">
                        <div class="pedido-header"><strong>Pedido #${String(o.id).slice(0,8)}</strong><span class="badge badge-primary">${o.estado || 'Procesando'}</span></div>
                        <div class="order-info"><span>${new Date(o.created_at).toLocaleDateString()}</span><strong>${Utils.formatCurrency(o.total)}</strong></div>
                    </div>`).join('');
            } else { list.innerHTML = '<p style="text-align:center; color:#666;">No tienes pedidos registrados.</p>'; }
        }
    },

    saveProfile: async (e, user) => {
        e.preventDefault();
        const updates = {
            nombre_completo: document.getElementById('profile-name').value,
            telefono: document.getElementById('profile-phone').value,
            direccion: document.getElementById('profile-address').value
        };
        const { error } = await db.from('perfiles').update(updates).eq('id', user.id);
        if(error) notify.error('Error al guardar'); else notify.success('Datos actualizados');
    }
};

/* ==========================================================================
 * 5. TIENDA
 * ========================================================================== */
const Store = {
    loadProduct: async () => {
        const el = document.getElementById('producto-nombre');
        const elIndex = document.getElementById('index-producto-nombre');
        if(!el && !elIndex) return;

        const { data } = await db.from('productos').select('*').eq('id', 1).single();
        if(data) {
            if(el) {
                el.textContent = data.nombre;
                document.getElementById('producto-precio').textContent = Utils.formatCurrency(data.precio);
                document.getElementById('producto-stock').textContent = data.stock_disponible;
                const layout = document.querySelector('.shop-layout');
                if(layout) { layout.dataset.pid = data.id; layout.dataset.stock = data.stock_disponible; }
            }
            if(elIndex) {
                elIndex.textContent = data.nombre;
                document.getElementById('index-producto-precio').textContent = Utils.formatCurrency(data.precio);
            }
        }
    },

    addToCart: () => {
        const layout = document.querySelector('.shop-layout');
        if(!layout) return;
        const qty = parseInt(document.getElementById('cantidad').value);
        const max = parseInt(layout.dataset.stock);
        if(qty > max) return notify.error('Stock insuficiente');
        
        let cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        cart[layout.dataset.pid] = (cart[layout.dataset.pid]||0) + qty;
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        notify.success('Añadido al carrito');
        Store.updateCount();
    },

    updateCount: () => {
        const c = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const el = document.getElementById('carrito-contador');
        if(el) { el.textContent = Object.values(c).reduce((a,b)=>a+b,0); el.style.display = el.textContent==='0'?'none':'inline-block'; }
    },

    initCheckout: async (user) => {
        const cart = JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {};
        const container = document.getElementById('checkout-items');
        if(!Object.keys(cart).length) { container.innerHTML = '<p>Carrito vacío</p>'; return; }

        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if(p) {
            if(document.getElementById('checkout-name')) document.getElementById('checkout-name').value = p.nombre_completo || '';
            if(document.getElementById('checkout-phone')) document.getElementById('checkout-phone').value = p.telefono || '';
            if(document.getElementById('checkout-address')) document.getElementById('checkout-address').value = p.direccion || '';
        }

        let total = 0, html = '', itemsToBuy = []; 
        for(const [pid, qty] of Object.entries(cart)) {
            const { data } = await db.from('productos').select('*').eq('id', pid).single();
            if(data) {
                const sub = data.precio * qty; total += sub;
                itemsToBuy.push({ id: pid, nombre: data.nombre, cantidad: qty, precio: data.precio });
                html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
                    <span>${data.nombre} x${qty}</span><strong>${Utils.formatCurrency(sub)}</strong></div>`;
            }
        }
        container.innerHTML = html;
        document.getElementById('checkout-total').textContent = Utils.formatCurrency(total);

        document.getElementById('form-checkout').onsubmit = async (e) => {
            e.preventDefault();
            const load = notify.loading('Procesando pedido...');
            
            const envio = {
                nombre: document.getElementById('checkout-name').value,
                direccion: document.getElementById('checkout-address').value,
                telefono: document.getElementById('checkout-phone').value
            };

            const { error: orderError } = await db.from('pedidos').insert({
                user_id: user.id, items: itemsToBuy, total: total, datos_envio: envio, estado: 'Pagado'
            });

            if (orderError) { 
                notify.close(load); 
                notify.error('Error: ' + orderError.message); 
                return; 
            }

            for(const item of itemsToBuy) {
                const { data: prod } = await db.from('productos').select('stock_disponible').eq('id', item.id).single();
                if (prod) await db.from('productos').update({ stock_disponible: prod.stock_disponible - item.cantidad }).eq('id', item.id);
            }

            notify.close(load); 
            notify.success('¡Compra realizada!');
            localStorage.removeItem(CONFIG.CART_KEY);
            setTimeout(() => window.location.href = 'cuenta.html', 2000);
        };
    }
};

/* ==========================================================================
 * 6. DASHBOARD
 * ========================================================================== */
const Dashboard = {
    init: async (user) => {
        const { data: p } = await db.from('perfiles').select('*').eq('id', user.id).single();
        document.getElementById('sidebar-username').textContent = p.nombre_completo || 'Usuario';
        document.getElementById('sidebar-role').textContent = p.rol;
        
        Dashboard.applyPermissions(p.rol);

        if (CONFIG.ROLES.STAFF.includes(p.rol)) {
            Dashboard.renderMachines(p.rol);
            Dashboard.initChat(p);
            Dashboard.subscribeRealtime();
            if(CONFIG.ROLES_SYS.includes(p.rol) || CONFIG.ROLES.ADMIN.includes(p.rol)) {
                Dashboard.initAdminUsers(p.rol);
            }
        }
    },

    applyPermissions: (rol) => {
        const tabPersonal = document.querySelector("li[onclick*='personal']");
        if (!CONFIG.ROLES.ADMIN.includes(rol)) {
            if(tabPersonal) tabPersonal.style.display = 'none';
            const viewPersonal = document.getElementById('view-personal');
            if(viewPersonal) viewPersonal.innerHTML = '<div style="padding:50px;text-align:center;"><h3>⛔ Acceso Denegado</h3></div>';
        } else {
            if(tabPersonal) tabPersonal.style.display = 'block';
        }
    },

    initChat: async (profile) => {
        const list = document.querySelector('.message-list');
        const form = document.getElementById('chat-form') || document.querySelector('.message-compose form');
        if(!list) return;

        const render = (m) => {
            const texto = m.mensaje || m.content || ''; 
            const html = `
                <div class="msg-item" style="padding:10px; background:white; border:1px solid #eee; margin-bottom:10px; border-radius:5px; display:flex; gap:10px;">
                    <div class="msg-avatar" style="width:35px; height:35px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center;">${m.sender.charAt(0)}</div>
                    <div><strong>${m.sender}</strong> <small style="color:#888">(${m.role || 'Staff'})</small><p style="margin:0; color:#555">${texto}</p></div>
                </div>`;
            list.insertAdjacentHTML('afterbegin', html);
        };

        const { data } = await db.from('mensajes').select('*').order('created_at', { ascending: false }).limit(15);
        if(data) { list.innerHTML = ''; data.forEach(render); }

        db.channel('chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, p => render(p.new)).subscribe();

        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const txt = form.querySelector('textarea').value;
                if(txt.trim()) {
                    const { error } = await db.from('mensajes').insert({ mensaje: txt, sender: profile.nombre_completo || 'Usuario', role: profile.rol });
                    if(error) notify.error("Error: " + error.message); else form.querySelector('textarea').value = '';
                }
            };
        }
    },

    renderMachines: async (rol) => {
        const container = document.getElementById('maquinas-container');
        const { data } = await db.from('maquinas').select('*').order('id');
        if(!container || !data) return;
        container.innerHTML = '';

        data.forEach(m => {
            const isAdmin = CONFIG.ROLES.ADMIN.includes(rol);
            let body = '';

            if (m.id === 1) {
                const ctrls = isAdmin ? `
                <div class="plc-controls">
                    <div class="control-row"><span>Ciclo:</span><div class="btn-group">
                        <button class="btn btn-sm btn-light" onclick="window.plcCmd(1,'Inicio')"><i class="fa-solid fa-play" style="color:green"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="window.plcCmd(1,'Paro')"><i class="fa-solid fa-stop"></i></button>
                    </div></div>
                    <div class="control-row"><span>Tanque:</span><div class="toggle-switch">
                        <input type="radio" name="tk" id="tk-in" ${m.controles.online_llenado?'checked':''} onclick="window.plcSw(1,'online_llenado')"><label for="tk-in">In</label>
                        <input type="radio" name="tk" id="tk-off" ${(!m.controles.online_llenado&&!m.controles.online_vaciado)?'checked':''} onclick="window.plcSw(1,'fill_off')"><label for="tk-off">Off</label>
                        <input type="radio" name="tk" id="tk-out" ${m.controles.online_vaciado?'checked':''} onclick="window.plcSw(1,'online_vaciado')"><label for="tk-out">Out</label>
                    </div></div>
                    <div class="control-row"><span>Charola:</span><div class="toggle-switch">
                        <input type="radio" name="ch" id="ch-up" ${m.controles.online_arriba?'checked':''} onclick="window.plcSw(1,'online_arriba')"><label for="ch-up">Up</label>
                        <input type="radio" name="ch" id="ch-off" ${(!m.controles.online_arriba&&!m.controles.online_abajo)?'checked':''} onclick="window.plcSw(1,'tray_off')"><label for="ch-off">Off</label>
                        <input type="radio" name="ch" id="ch-dn" ${m.controles.online_abajo?'checked':''} onclick="window.plcSw(1,'online_abajo')"><label for="ch-dn">Dn</label>
                    </div></div>
                </div>` : '<p style="color:#666;">Solo lectura</p>';
                body = `<p class="m-area">${m.area}</p>${ctrls}`;
            } else if (m.id === 2) {
                const t = m.controles.escalda_db;
                const ctrls = isAdmin ? `<div class="plc-controls"><div class="btn-group w-100"><button class="btn btn-${m.controles.startremoto?'secondary':'light'}" onclick="window.plcRmt(2,true)">START</button><button class="btn btn-danger" onclick="window.plcRmt(2,false)">STOP</button></div></div>` : '';
                body = `<div class="thermometer"><span id="temp-val-2" class="big-number">${t.toFixed(1)} °C</span><div class="progress-bg"><div id="temp-bar-2" class="progress-fill" style="width:${Math.min(t,100)}%"></div></div></div>${ctrls}`;
            }

            container.insertAdjacentHTML('beforeend', `
                <div class="card machine-card" id="machine-${m.id}">
                    <div class="m-header"><h4>${m.nombre}</h4><span class="status-badge ${m.estado==='En Ciclo'||(m.id===2&&m.controles.startremoto)?'on':'off'}">${m.id===2?(m.controles.startremoto?'ON':'OFF'):m.estado}</span></div>
                    <div class="m-body">${body}</div>
                </div>`);
        });
    },

    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if(!tbody) return;
        let users = [];
        try {
            const { data } = await db.rpc('get_all_user_profiles');
            users = data || [];
        } catch (e) {
            const { data } = await db.from('perfiles').select('*');
            users = data || [];
        }
        
        const isSys = CONFIG.ROLES.SYS.includes(myRole);

        tbody.innerHTML = users.map(u => `
            <tr data-uid="${u.id}">
                <td>${u.email}</td>
                <td><select class="form-input role-select" style="padding:5px;">${['Sistemas','Lider','Supervisor','Operador','Cliente'].map(r => `<option ${u.rol===r?'selected':''}>${r}</option>`).join('')}</select></td>
                <td>${u.area||'-'}</td>
                <td>
                    <button class="btn-icon btn-save"><i class="fa-solid fa-save" style="color:var(--color-primary)"></i></button>
                    ${isSys ? `<button class="btn-icon btn-delete"><i class="fa-solid fa-trash" style="color:red"></i></button>` : ''}
                </td>
            </tr>`).join('');
        
        tbody.querySelectorAll('.btn-save').forEach(btn => {
            btn.onclick = async (e) => {
                const row = e.target.closest('tr');
                await db.from('perfiles').update({ rol: row.querySelector('.role-select').value }).eq('id', row.dataset.uid);
                notify.success('Actualizado');
            };
        });
        
        if(isSys) {
            tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.onclick = async (e) => {
                    if(confirm('¿Eliminar usuario?')) {
                        const row = e.target.closest('tr');
                        await db.from('perfiles').delete().eq('id', row.dataset.uid);
                        row.remove(); notify.success('Eliminado');
                    }
                };
            });
        }
    },

    subscribeRealtime: () => {
        db.channel('machines').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maquinas' }, p => {
            const m = p.new;
            const card = document.getElementById(`machine-${m.id}`);
            if(!card) return;
            const badge = card.querySelector('.status-badge');
            
            if(m.id===1) {
                badge.textContent = m.estado; badge.className = `status-badge ${m.estado==='En Ciclo'?'on':'off'}`;
                const chk = (id,v) => { const e=document.getElementById(id); if(e) e.checked=v; };
                chk('tk-in', m.controles.online_llenado); chk('tk-out', m.controles.online_vaciado); chk('tk-off', !m.controles.online_llenado&&!m.controles.online_vaciado);
            } else if(m.id===2) {
                document.getElementById('temp-val-2').textContent = m.controles.escalda_db.toFixed(1)+' °C';
                document.getElementById('temp-bar-2').style.width = Math.min(m.controles.escalda_db,100)+'%';
                badge.textContent = m.controles.startremoto?'ON':'OFF'; badge.className = `status-badge ${m.controles.startremoto?'on':'off'}`;
            }
        }).subscribe();
    }
};

/* --- GLOBALES HTML --- */
window.plcCmd = async (id, act) => {
    const {data} = await db.from('maquinas').select('controles').eq('id',id).single();
    let c=data.controles; if(act==='Inicio'){c.Inicio=true;c.Paro=false;}else{c.Inicio=false;c.Paro=true;c.online_llenado=false;}
    await db.from('maquinas').update({controles:c, estado: act==='Inicio'?'En Ciclo':'Detenida'}).eq('id',id);
};
window.plcSw = async (id, k) => {
    const {data} = await db.from('maquinas').select('controles').eq('id',id).single();
    let c=data.controles; c.online_llenado=(k==='online_llenado'); c.online_vaciado=(k==='online_vaciado');
    await db.from('maquinas').update({controles:c}).eq('id',id);
};
window.plcRmt = async (id, s) => {
    const {data} = await db.from('maquinas').select('controles').eq('id',id).single();
    await db.from('maquinas').update({controles:{...data.controles, startremoto:s}}).eq('id',id);
};

/* --- BOOTSTRAP --- */
document.addEventListener('DOMContentLoaded', async () => {
    Store.updateCount();
    const { data: { session } } = await db.auth.getSession();
    const user = session?.user;
    const path = window.location.pathname;

    const header = document.getElementById('auth-links-container');
    if(header) header.innerHTML = user ? `<a href="cuenta.html" class="nav-link">Mi Cuenta</a>` : `<a href="cuenta.html" class="nav-link">Acceder</a>`;

    if(path.includes('cuenta')) {
        if(user) {
            document.getElementById('auth-forms').style.display='none';
            document.getElementById('user-info').style.display='grid';
            Auth.loadProfile(user);
            document.getElementById('form-perfil').onsubmit = (e) => Auth.saveProfile(e, user);
            document.getElementById('btn-logout').onclick = Auth.logout;
            
            const bD = document.getElementById('btn-tab-datos'), bP = document.getElementById('btn-tab-pedidos');
            if(bD && bP) {
                bD.onclick = () => { document.getElementById('seccion-mis-datos').style.display='block'; document.getElementById('seccion-mis-pedidos').style.display='none'; bD.classList.add('active'); bP.classList.remove('active'); };
                bP.onclick = () => { document.getElementById('seccion-mis-datos').style.display='none'; document.getElementById('seccion-mis-pedidos').style.display='block'; bP.classList.add('active'); bD.classList.remove('active'); };
            }
        } else {
            document.getElementById('auth-forms').style.display='block';
            document.getElementById('form-login').onsubmit = Auth.login;
            document.getElementById('form-registro').onsubmit = Auth.register;
        }
    } 
    else if(path.includes('panel')) {
        if(user) {
            document.getElementById('login-overlay').style.display='none';
            document.getElementById('dashboard-layout').style.display='flex';
            Dashboard.init(user);
        } else {
            document.getElementById('panel-login-form').onsubmit = Auth.login;
        }
    }
    else if(path.includes('tienda') || path.includes('index') || path.endsWith('/')) {
        Store.loadProduct();
        const btn = document.getElementById('btn-anadir-carrito');
        if(btn) btn.onclick = Store.addToCart;
    }
    // FIX: LÓGICA DE CHECKOUT CORREGIDA AQUÍ
    else if(path.includes('checkout')) {
        if(user) {
            if(document.getElementById('checkout-login-prompt')) document.getElementById('checkout-login-prompt').style.display='none';
            if(document.getElementById('checkout-container')) document.getElementById('checkout-container').style.display='grid';
            Store.initCheckout(user);
        } else {
            if(document.getElementById('checkout-login-prompt')) document.getElementById('checkout-login-prompt').style.display='block';
            if(document.getElementById('checkout-container')) document.getElementById('checkout-container').style.display='none';
        }
    }
});