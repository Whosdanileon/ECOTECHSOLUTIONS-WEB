// src/store.js
import { db } from './db.js';
import { CONFIG } from './config.js';
import { globalState } from './state.js';
import { notify, formatCurrency, confirmModal, printReceipt, escapeHtml } from './utils.js';

// --- ESTO ES LO QUE FALTABA (Módulo RateUI exportado) ---
export const RateUI = {
    current: 0,
    open: (oid) => { 
        const m = document.getElementById('rating-modal'); 
        if(m) { 
            m.style.display='flex'; 
            document.getElementById('rating-oid').value = oid; 
            document.getElementById('rating-order-id').textContent = oid; 
            RateUI.set(0); 
        } 
    },
    set: (n) => { 
        RateUI.current = n; 
        document.getElementById('rating-value').value = n; 
        document.querySelectorAll('.star-btn').forEach(s => { 
            // Manejo seguro de estilos
            s.style.color = parseInt(s.dataset.value) <= n ? '#fbbf24' : '#cbd5e1'; 
        }); 
    },
    submit: async (e) => {
        e.preventDefault(); 
        const oid = document.getElementById('rating-oid').value; 
        const comment = document.getElementById('rating-comment').value;
        if(RateUI.current === 0) return notify.error('Selecciona estrellas');
        
        const load = notify.loading('Enviando...');
        const { error } = await db.from('resenas').insert({ 
            user_id: globalState.userProfile.id, 
            pedido_id: oid, 
            calificacion: RateUI.current, 
            comentario: comment 
        });
        notify.close(load); 
        if(!error) { 
            notify.success('¡Gracias!'); 
            document.getElementById('rating-modal').style.display='none'; 
        }
    }
};

// --- STORE PRINCIPAL ---
export const Store = {
    ordersCache: [],

    getCart: () => {
        try { return JSON.parse(localStorage.getItem(CONFIG.CART_KEY)) || {}; } 
        catch (e) { return {}; }
    },

    saveCart: async (cart) => {
        try {
            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cart));
            Store.updateCartCountUI();
            if (globalState.userProfile?.id) {
                await Store.syncToCloud(cart);
            }
        } catch (e) { console.error("Error guardando carrito", e); }
    },

    addToCart: async (qty = 1) => {
        const productData = await Store.fetchProduct();
        const currentStock = productData.stock_disponible || 0;
        const cart = Store.getCart();
        const prodId = CONFIG.PRODUCT.ID;
        const currentQty = cart[prodId] || 0;
        const newQty = currentQty + qty;

        if (newQty > currentStock) {
            return notify.error(`Solo quedan ${currentStock} unidades.`);
        }

        cart[prodId] = newQty;
        await Store.saveCart(cart);
        notify.success(`Agregado al carrito.`);
    },

    clearCart: async (clearCloud = false) => {
        localStorage.removeItem(CONFIG.CART_KEY);
        Store.updateCartCountUI();
        if (clearCloud && globalState.userProfile?.id) {
            await Store.syncToCloud({});
        }
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
        } catch (e) { console.warn("Sync error:", e); }
    },

    mergeWithCloud: async (userId) => {
        try {
            const localCart = Store.getCart();
            const { data } = await db.from('carritos').select('items').eq('user_id', userId).single();
            const cloudCart = data?.items || {};
            const finalCart = { ...cloudCart };
            
            Object.keys(localCart).forEach(itemId => {
                if (finalCart[itemId]) {
                    finalCart[itemId] = Math.max(finalCart[itemId], localCart[itemId]);
                } else {
                    finalCart[itemId] = localCart[itemId];
                }
            });

            localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(finalCart));
            Store.updateCartCountUI();
            await db.from('carritos').upsert({ user_id: userId, items: finalCart, updated_at: new Date() });
        } catch (e) { console.error("Merge error:", e); }
    },

    fetchProduct: async () => {
        try {
            const { data, error } = await db.from('productos').select('*').eq('id', CONFIG.PRODUCT.ID).single();
            if (error) throw error;
            return data;
        } catch (err) {
            return { id: CONFIG.PRODUCT.ID, nombre: 'Producto', precio: 0, stock_disponible: 0 };
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
            if(error.message.includes('Stock insuficiente')) throw new Error("Stock insuficiente.");
            throw new Error("Error procesando el pedido.");
        }

        await Store.clearCart(true); 
        return data;
    },

    renderOrders: async (userId) => {
        const list = document.getElementById('pedidos-lista-container');
        if (!list) return;
        
        list.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>';

        const { data: orders, error } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        
        if (error || !orders) {
            list.innerHTML = '<p style="text-align:center; color:red;">Error cargando historial.</p>';
            return;
        }

        Store.ordersCache = orders;
        list.innerHTML = ''; 

        if (orders.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No tienes pedidos aún.</p>';
            return;
        }

        orders.forEach(o => {
            const card = document.createElement('div');
            card.className = 'pedido-card';
            
            let statusColor = '#3b82f6'; 
            if (o.estado === 'Cancelado') statusColor = '#ef4444'; 
            else if (o.estado === 'Pagado') statusColor = '#0ea5e9'; 
            else if (o.estado === 'Entregado') statusColor = '#22c55e';
            card.style.borderLeftColor = statusColor;

            const header = document.createElement('div');
            header.className = 'pedido-header';
            header.innerHTML = `<div><strong>Pedido #${String(o.id).slice(0, 8)}</strong><br><small>${new Date(o.created_at).toLocaleDateString()}</small></div>`;
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = o.estado; 
            header.appendChild(badge);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'order-info';
            
            const totalDiv = document.createElement('div');
            totalDiv.textContent = formatCurrency(o.total);
            
            const btnDiv = document.createElement('div');
            
            const btnReceipt = document.createElement('button');
            btnReceipt.className = 'btn-sm btn-light';
            btnReceipt.style.marginRight = '5px';
            btnReceipt.innerHTML = '<i class="fa-solid fa-print"></i> Recibo';
            btnReceipt.onclick = () => printReceipt(o.id);
            btnDiv.appendChild(btnReceipt);

            if(['Enviado','Entregado'].includes(o.estado) && o.tracking_info) {
                const btnTrack = document.createElement('button');
                btnTrack.className = 'btn-sm btn-primary';
                btnTrack.style.marginRight = '5px';
                btnTrack.textContent = 'Rastrear';
                btnTrack.onclick = () => Store.trackOrder(o.id); 
                btnDiv.appendChild(btnTrack);
            }

            if(o.estado === 'Entregado') {
                const btnRate = document.createElement('button');
                btnRate.className = 'btn-sm';
                btnRate.style.cssText = 'background:#f59e0b; color:white; border:none; border-radius:20px;';
                btnRate.textContent = '★ Calificar';
                btnRate.onclick = () => RateUI.open(o.id);
                btnDiv.appendChild(btnRate);
            }

            if(o.estado === 'Pendiente') {
                const btnCancel = document.createElement('button');
                btnCancel.className = 'btn-text-danger';
                btnCancel.style.marginLeft = '10px';
                btnCancel.textContent = 'Cancelar';
                btnCancel.onclick = () => Store.cancelOrder(o.id);
                btnDiv.appendChild(btnCancel);
            }

            infoDiv.appendChild(totalDiv);
            infoDiv.appendChild(btnDiv);
            card.appendChild(header);
            card.appendChild(infoDiv);
            list.appendChild(card);
        });
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

    trackOrder: (orderId) => {
        try {
            const order = Store.ordersCache.find(o => o.id === orderId);
            if (!order || !order.tracking_info) return notify.error("Información no disponible");

            const data = order.tracking_info;
            const modal = document.getElementById('tracking-modal');
            const timeline = document.getElementById('tracking-timeline');
            const title = document.getElementById('track-id-display');
            
            if(!modal) return;
            
            title.textContent = `${data.carrier || 'Envío'} - Guía: ${data.tracking_number || 'Pendiente'}`;
            
            timeline.innerHTML = (data.history || []).map(step => `
                <div class="timeline-item ${step.completed ? 'completed' : ''}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div style="font-weight:600;">${escapeHtml(step.status)}</div>
                        <div style="font-size:0.8rem; color:#888;">${step.date ? new Date(step.date).toLocaleString() : ''}</div>
                    </div>
                </div>
            `).join('');
            
            modal.style.display = 'flex';
        } catch(e) { console.error(e); notify.error('Error de rastreo'); }
    }
};