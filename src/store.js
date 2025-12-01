// src/store.js
import { db } from './db.js';
import { CONFIG } from './config.js';
import { globalState } from './state.js';
import { notify, formatCurrency, confirmModal } from './utils.js';

export const Store = {
    getCart: () => {
        try { return JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {}; } 
        catch (e) { return {}; }
    },

    saveCart: (cart) => {
        localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
        Store.updateCartCountUI();
        if (globalState.userProfile?.id) Store.syncToCloud(cart);
    },

    addToCart: (qty = 1) => {
        const cart = Store.getCart();
        const prodId = CONFIG.PRODUCT.ID;
        cart[prodId] = (cart[prodId] || 0) + qty;
        Store.saveCart(cart);
        notify.success(`Se agregaron ${qty} unidades al carrito.`);
    },

    clearCart: (clearCloud = false) => {
        localStorage.removeItem(CONFIG.CART_KEY);
        Store.updateCartCountUI();
        if (clearCloud && globalState.userProfile?.id) Store.syncToCloud({});
    },

    getCartCount: () => {
        const cart = Store.getCart();
        return Object.values(cart).reduce((a, b) => a + b, 0);
    },

    updateCartCountUI: () => {
        const count = Store.getCartCount();
        const badge = document.getElementById('carrito-contador');
        const btnVaciar = document.getElementById('btn-vaciar-carrito');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (btnVaciar) btnVaciar.style.display = count > 0 ? 'inline-block' : 'none';
    },

    syncToCloud: async (cart) => {
        try {
            const uid = globalState.userProfile.id;
            await db.from('carritos').upsert({ user_id: uid, items: cart, updated_at: new Date() });
        } catch (e) { console.error("Sync error:", e); }
    },

    // --- FIX CRÍTICO: Fusión Inteligente ---
    mergeWithCloud: async (userId) => {
        try {
            const localCart = Store.getCart();
            const localItemsCount = Object.keys(localCart).length;

            const { data } = await db.from('carritos').select('items').eq('user_id', userId).single();
            const cloudCart = data?.items || {};

            // ESCENARIO 1: Carrito Local Vacío -> Solo descargar (NO SUMAR, NO RE-GUARDAR EN NUBE)
            if (localItemsCount === 0) {
                console.log('☁️ Descargando carrito de la nube (Local estaba vacío)');
                localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cloudCart));
                Store.updateCartCountUI();
                return; // Terminamos aquí. Evita bucles de duplicación.
            }

            // ESCENARIO 2: Hay items locales -> Fusionar con cuidado
            const finalCart = { ...cloudCart };
            Object.keys(localCart).forEach(itemId => {
                if (finalCart[itemId]) {
                    finalCart[itemId] += localCart[itemId];
                } else {
                    finalCart[itemId] = localCart[itemId];
                }
            });

            console.log('🔄 Fusionando carritos Local + Nube');
            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(finalCart));
            Store.updateCartCountUI();
            await db.from('carritos').upsert({ user_id: userId, items: finalCart, updated_at: new Date() });

        } catch (e) {
            console.error("Merge error:", e);
        }
    },

    fetchProduct: async () => {
        try {
            const { data, error } = await db.from('productos').select('*').eq('id', CONFIG.PRODUCT.ID).single();
            if (error) throw error;
            return data;
        } catch (err) {
            return { id: CONFIG.PRODUCT.ID, nombre: CONFIG.PRODUCT.NAME, precio: CONFIG.PRODUCT.PRICE, stock_disponible: '--' };
        }
    },

    processCheckout: async (user, shippingData) => {
        const cart = Store.getCart();
        const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
        if (totalItems <= 0) throw new Error("El carrito está vacío");

        const { data, error } = await db.rpc('crear_pedido_seguro', {
            p_user_id: user.id,
            p_items_cart: cart,
            p_shipping: shippingData
        });

        if (error) {
            console.error("RPC Error:", error);
            if(error.message.includes('Stock insuficiente')) throw new Error(error.message);
            throw new Error("Error procesando el pedido.");
        }

        Store.clearCart(true); 
        return data;
    },

    renderOrders: async (userId) => {
        const list = document.getElementById('pedidos-lista-container');
        if (!list) return;
        const { data: orders } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        
        if (orders && orders.length > 0) {
            list.innerHTML = orders.map(o => {
                let statusColor = 'primary';
                if (o.estado === 'Cancelado') statusColor = 'danger'; 
                else if (o.estado === 'Pagado') statusColor = 'info'; 
                else if (o.estado === 'Entregado') statusColor = 'success';
                
                let btns = `<button onclick="window.Utils.printReceipt(${o.id})" class="btn-sm btn-light" style="margin-right:5px;"><i class="fa-solid fa-print"></i> Recibo</button>`;
                if(['Enviado','Entregado'].includes(o.estado) && o.tracking_info) {
                     const safeData = encodeURIComponent(JSON.stringify(o.tracking_info));
                     btns += `<button onclick="window.Store.trackOrder('${safeData}', ${o.id})" class="btn-sm btn-primary" style="margin-right:5px;">Rastrear</button>`;
                }
                if(o.estado === 'Entregado') btns += `<button onclick="window.RateUI.open(${o.id})" class="btn-sm" style="background:#f59e0b; color:white; border:none; border-radius:20px;">★ Calificar</button>`;
                if(o.estado === 'Pendiente') btns += `<button onclick="window.Store.cancelOrder(${o.id})" class="btn-text-danger" style="margin-left:10px;">Cancelar</button>`;

                return `<div class="pedido-card" style="border-left-color: var(--color-${statusColor});"><div class="pedido-header"><div><strong>Pedido #${String(o.id).slice(0, 8)}</strong><br><small>${new Date(o.created_at).toLocaleDateString()}</small></div><span class="badge">${o.estado}</span></div><div class="order-info"><div>${formatCurrency(o.total)}</div><div>${btns}</div></div></div>`;
            }).join('');
        } else {
            list.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No tienes pedidos aún.</p>';
        }
    },

    cancelOrder: async (orderId) => {
        confirmModal('Cancelar Pedido', '¿Estás seguro?', async () => {
            const load = notify.loading('Cancelando...');
            const { error } = await db.from('pedidos').update({ estado: 'Cancelado' }).eq('id', orderId);
            notify.close(load);
            if(error) notify.error(error.message);
            else { notify.success('Pedido cancelado'); Store.renderOrders(globalState.userProfile.id); }
        });
    },

    trackOrder: (encodedData) => {
        try {
            const data = JSON.parse(decodeURIComponent(encodedData));
            const modal = document.getElementById('tracking-modal');
            const timeline = document.getElementById('tracking-timeline');
            const title = document.getElementById('track-id-display');
            if(!modal) return;
            title.textContent = `${data.carrier || 'Envío'} - Guía: ${data.tracking_number || 'Pendiente'}`;
            timeline.innerHTML = (data.history || []).map(step => `<div class="timeline-item ${step.completed ? 'completed' : ''}"><div class="timeline-marker"></div><div class="timeline-content"><div style="font-weight:600;">${step.status}</div><div style="font-size:0.8rem; color:#888;">${step.date ? new Date(step.date).toLocaleString() : ''}</div></div></div>`).join('');
            modal.style.display = 'flex';
        } catch(e) { notify.error('Error de rastreo'); }
    }
};