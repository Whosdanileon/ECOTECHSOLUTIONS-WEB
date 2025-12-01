// src/main.js
import { CONFIG } from './config.js';
import { db } from './db.js';
import { globalState } from './state.js';
import { notify, formatCurrency, formatTime, confirmModal, printReceipt } from './utils.js';
import { Auth } from './auth.js';
import { Store } from './store.js';
import { Dashboard, Telemetry, Vision, MachineControl } from './dashboard.js';
import { Maps } from './maps.js';

console.log('🚀 EcoTech System v115: HTML Labels Fixed');

// EXPOSICIÓN GLOBAL
window.Auth = Auth;
window.Store = Store;
window.Dashboard = Dashboard;
window.Vision = Vision;
window.MachineControl = MachineControl;
window.Maps = Maps;
window.Utils = { formatCurrency, formatTime, confirmModal, printReceipt };

// Compatibilidad Legacy
window.plcCmd = MachineControl.sendCommand;
window.plcSw = MachineControl.toggleSwitch;
window.toggleGlobalEmergency = MachineControl.toggleEmergency;

// UI Helpers
window.togglePaymentMethod = (m) => {
    const card = document.getElementById('payment-form-card');
    const trans = document.getElementById('payment-info-transfer');
    if(!card || !trans) return;
    if(m === 'card') { card.style.display='block'; trans.style.display='none'; card.querySelectorAll('input').forEach(i=>i.required=true); }
    else { card.style.display='none'; trans.style.display='block'; card.querySelectorAll('input').forEach(i=>i.required=false); }
};

window.AuthModal = {
    open: (t='login') => { const m=document.getElementById('auth-modal'); if(m){ m.style.display='flex'; setTimeout(()=>m.classList.add('show'),10); window.AuthModal.switchTab(t); }},
    close: () => { const m=document.getElementById('auth-modal'); if(m){ m.classList.remove('show'); setTimeout(()=>m.style.display='none',300); }},
    switchTab: (t) => {
        document.querySelectorAll('.auth-tab').forEach(x=>x.classList.remove('active'));
        document.querySelectorAll('.auth-view').forEach(x=>x.classList.remove('active'));
        if(t==='login'){ document.querySelector('.auth-tab:first-child')?.classList.add('active'); document.getElementById('modal-login-view')?.classList.add('active'); }
        else { document.querySelector('.auth-tab:last-child')?.classList.add('active'); document.getElementById('modal-register-view')?.classList.add('active'); }
    },
    openSecurityCheck: () => { document.getElementById('security-modal').style.display='flex'; setTimeout(()=>document.getElementById('security-modal').style.opacity='1',10); },
    closeSecurityCheck: () => { const m=document.getElementById('security-modal'); m.style.opacity='0'; setTimeout(()=>{m.style.display='none'; document.getElementById('sec-password').value='';},300); }
};

window.switchTab = (t) => {
    document.querySelectorAll('.sidebar-nav li').forEach(x=>x.classList.remove('active'));
    document.querySelector(`.sidebar-nav li[onclick*="${t}"]`)?.classList.add('active');
    document.querySelectorAll('.dashboard-view').forEach(x=>{ x.style.display='none'; x.classList.remove('active'); });
    const target = document.getElementById('view-'+t);
    if(target) {
        target.style.display='block'; setTimeout(()=>target.classList.add('active'),10);
        if(t==='reportes') Dashboard.renderReports();
        if(t==='ventas') Dashboard.renderSales();
        if(t==='personal') Dashboard.initAdminUsers(globalState.userProfile?.rol);
        if(t==='mensajes') Dashboard.loadChatMessages(globalState.currentChannel);
    }
    if(window.innerWidth<=968) window.toggleSidebar();
};

window.toggleSidebar = () => { document.getElementById('sidebar')?.classList.toggle('active'); document.getElementById('mobile-overlay')?.classList.toggle('show'); };
// ¡AQUÍ ESTÁ LA CORRECCIÓN DEL ERROR DE CONSOLA!
window.toggleSidebarIfMobile = () => { if(window.innerWidth<=968) window.toggleSidebar(); };

window.RateUI = {
    current:0,
    open:(oid)=>{ const m=document.getElementById('rating-modal'); if(m){ m.style.display='flex'; document.getElementById('rating-oid').value=oid; document.getElementById('rating-order-id').textContent=oid; window.RateUI.set(0); }},
    set:(n)=>{ window.RateUI.current=n; document.getElementById('rating-value').value=n; document.querySelectorAll('.star-btn').forEach(s=>{ s.style.color = parseInt(s.dataset.value)<=n?'#fbbf24':'#cbd5e1'; }); },
    submit:async(e)=>{ e.preventDefault(); const load=notify.loading('Enviando'); const {error}=await db.from('resenas').insert({user_id:globalState.userProfile.id, pedido_id:document.getElementById('rating-oid').value, calificacion:window.RateUI.current, comentario:document.getElementById('rating-comment').value}); notify.close(load); if(!error){notify.success('Gracias'); document.getElementById('rating-modal').style.display='none';} }
};

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    Store.updateCartCountUI();
    const session = await Auth.checkSession();
    
    // Auth Links
    const al = document.getElementById('auth-links-container');
    if(al) al.innerHTML = session ? `<a href="cuenta.html" class="nav-link"><i class="fa-solid fa-user-circle"></i> Mi Cuenta</a>` : `<a href="#" class="nav-link" onclick="window.AuthModal.open(); return false;">Acceder</a>`;

    // Listeners
    const trash=document.getElementById('btn-vaciar-carrito'); if(trash) trash.onclick=Store.clearCart;
    const lForm=document.getElementById('form-modal-login'); if(lForm) lForm.onsubmit=(e)=>{e.preventDefault();Auth.login(document.getElementById('m-login-email').value, document.getElementById('m-login-pass').value)};
    const rForm=document.getElementById('form-modal-register'); if(rForm) rForm.onsubmit=(e)=>{e.preventDefault();Auth.register(document.getElementById('m-reg-email').value, document.getElementById('m-reg-pass').value)};
    const starForm=document.getElementById('form-rating'); if(starForm) starForm.onsubmit=window.RateUI.submit;

    // PATH LOGIC
    const path = window.location.pathname;

    if(path.includes('panel.html')) {
        if(!session || !CONFIG.ROLES.STAFF.includes(globalState.userProfile?.rol)) { notify.error('Restringido'); setTimeout(()=>location.href='index.html',1500); return; }
        document.getElementById('login-overlay').style.display='none';
        document.getElementById('dashboard-layout').style.display='flex';
        
        const p = globalState.userProfile;
        if(p) { 
            const n=document.getElementById('sidebar-username'); if(n) n.textContent=p.nombre_completo;
            const r=document.getElementById('sidebar-role'); if(r) r.textContent=p.rol;
        }
        
        Dashboard.renderMachines(p.rol);
        Dashboard.loadChatMessages('General');
        Telemetry.init();
        Vision.init();
        document.getElementById('btn-logout-panel').onclick=Auth.logout;

        db.channel('public-room')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinas' }, payload => {
                if(payload.new) {
                    Telemetry.updateFromPayload(payload.new.id, payload.new.controles);
                    // Actualizamos botones en tiempo real
                    Dashboard.renderMachines(globalState.userProfile.rol);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => Dashboard.renderChatMessage(payload.new))
            .subscribe();

    } else if(path.includes('checkout.html')) {
        if(!session) document.getElementById('checkout-login-prompt').style.display='block';
        else {
            document.getElementById('checkout-container').style.display='grid';
            const p = globalState.userProfile;
            if(p) {
                if(document.getElementById('checkout-name')) document.getElementById('checkout-name').value = p.nombre_completo||'';
                if(document.getElementById('checkout-address')) document.getElementById('checkout-address').value = p.direccion||'';
                if(document.getElementById('checkout-phone')) document.getElementById('checkout-phone').value = p.telefono||'';
                if(p.latitud && window.Maps) Maps.init('map-checkout', p.latitud, p.longitud, false);
                if(p.datos_pago) {
                    const cn=document.getElementById('card-number'), ch=document.getElementById('card-holder'), ce=document.getElementById('card-expiry');
                    if(cn) cn.value = p.datos_pago.number||'';
                    if(ch) ch.value = p.datos_pago.holder||'';
                    if(ce) ce.value = p.datos_pago.expiry||'';
                    notify.success('Tarjeta cargada');
                }
            }
            const cart=Store.getCart(), prod=await Store.fetchProduct(), qty=cart[prod.id]||0, total=prod.precio*qty;
            document.getElementById('checkout-items').innerHTML=`<div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:10px 0"><span>${prod.nombre} x${qty}</span><strong>${formatCurrency(total)}</strong></div>`;
            document.getElementById('checkout-total').textContent=formatCurrency(total);
            document.getElementById('checkout-subtotal').textContent=formatCurrency(total/1.16);

            document.getElementById('form-checkout').onsubmit = async(e) => {
                e.preventDefault();
                try {
                    document.getElementById('payment-modal').style.display='flex';
                    const method = document.querySelector('input[name="payment-method"]:checked')?.value || 'card';
                    await Store.processCheckout(session, {
                        nombre: document.getElementById('checkout-name').value,
                        direccion: document.getElementById('checkout-address').value,
                        telefono: document.getElementById('checkout-phone').value,
                        metodo: method
                    });
                    notify.success('Confirmado'); setTimeout(()=>location.href='cuenta.html',2000);
                } catch(err) { document.getElementById('payment-modal').style.display='none'; notify.error(err.message); }
            };
        }
    } else if(path.includes('cuenta.html')) {
        if(session) {
            document.getElementById('auth-forms').style.display='none';
            document.getElementById('user-info').style.display='grid';
            const p = globalState.userProfile;
            if(p) {
                if(document.getElementById('profile-name')) document.getElementById('profile-name').value = p.nombre_completo||'';
                if(document.getElementById('profile-email')) document.getElementById('profile-email').value = p.email||'';
                if(document.getElementById('profile-phone')) document.getElementById('profile-phone').value = p.telefono||'';
                if(document.getElementById('profile-address')) document.getElementById('profile-address').value = p.direccion||'';
                if(window.Maps) Maps.init('map-profile', p.latitud, p.longitud, true);
                if(p.datos_pago && document.getElementById('wallet-number')) {
                    globalState.tempWalletData = p.datos_pago;
                    document.getElementById('wallet-number').placeholder = "•••• " + p.datos_pago.number.slice(-4);
                    document.getElementById('btn-unlock-wallet').innerHTML = 'Ver Datos';
                }
            }
            Store.renderOrders(session.id);
            
            const tabs = {
                datos: { btn: document.getElementById('btn-tab-datos'), view: document.getElementById('seccion-mis-datos') },
                pedidos: { btn: document.getElementById('btn-tab-pedidos'), view: document.getElementById('seccion-mis-pedidos') },
                pagos: { btn: document.getElementById('btn-tab-pagos'), view: document.getElementById('seccion-pagos') }
            };
            const activateTab = (activeKey) => {
                Object.keys(tabs).forEach(key => {
                    if (tabs[key].btn && tabs[key].view) {
                        if (key === activeKey) { tabs[key].btn.classList.add('active'); tabs[key].view.style.display = 'block'; } 
                        else { tabs[key].btn.classList.remove('active'); tabs[key].view.style.display = 'none'; }
                    }
                });
            };
            if(tabs.datos.btn) tabs.datos.btn.onclick = () => activateTab('datos');
            if(tabs.pedidos.btn) tabs.pedidos.btn.onclick = () => { activateTab('pedidos'); Store.renderOrders(session.id); };
            if(tabs.pagos.btn) tabs.pagos.btn.onclick = () => activateTab('pagos');

            document.getElementById('btn-logout').onclick=Auth.logout;
            const pf=document.getElementById('form-perfil'); if(pf) pf.onsubmit=(e)=>{e.preventDefault(); Auth.updateProfile(session.id, {nombre_completo: document.getElementById('profile-name').value, direccion: document.getElementById('profile-address').value, telefono: document.getElementById('profile-phone').value, latitud: document.getElementById('profile-lat').value, longitud: document.getElementById('profile-lng').value})};
            const wf=document.getElementById('form-pago-seguro'); if(wf) wf.onsubmit=async(e)=>{e.preventDefault(); const wd={holder:document.getElementById('wallet-holder').value, number:document.getElementById('wallet-number').value, expiry:document.getElementById('wallet-expiry').value}; const load=notify.loading('Guardando...'); const {error}=await db.from('perfiles').update({datos_pago:wd}).eq('id',session.id); notify.close(load); if(!error) notify.success('Guardado'); };
            const sf=document.getElementById('form-security-check'); if(sf) sf.onsubmit=(e)=>{e.preventDefault(); notify.success('Verificado'); window.AuthModal.closeSecurityCheck(); if(globalState.tempWalletData) { document.getElementById('wallet-number').value=globalState.tempWalletData.number; document.getElementById('wallet-overlay').style.display='none'; }};
        }
    } else if(path.includes('tienda.html')||path.includes('index.html')||path.endsWith('/')) {
        const prod=await Store.fetchProduct();
        const setTxt=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt};
        setTxt('producto-nombre',prod.nombre); setTxt('index-producto-nombre',prod.nombre);
        setTxt('producto-precio',formatCurrency(prod.precio)); setTxt('index-producto-precio',formatCurrency(prod.precio));
        setTxt('producto-stock',prod.stock_disponible);
        const ba=document.getElementById('btn-anadir-carrito'); if(ba) ba.onclick=()=>{Store.addToCart(parseInt(document.getElementById('cantidad')?.value||1))};
    }
});