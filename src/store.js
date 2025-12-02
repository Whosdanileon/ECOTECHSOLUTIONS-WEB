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

    addToCart: async (qty = 1) => {
        // 1. Validar Stock antes de agregar localmente
        const productData = await Store.fetchProduct();
        const currentStock = productData.stock_disponible; // Asumimos que viene de DB
        
        const cart = Store.getCart();
        const prodId = CONFIG.PRODUCT.ID;
        const currentQty = cart[prodId] || 0;
        const newQty = currentQty + qty;

        // Validación rígida de stock
        if (typeof currentStock === 'number' && newQty > currentStock) {
            return notify.error(`Solo hay ${currentStock} unidades disponibles.`);
        }

        cart[prodId] = newQty;
        Store.saveCart(cart);
        notify.success(`Se agregaron ${qty} unidades al carrito.`);
    },

    clearCart: (clearCloud = false) => {
        localStorage.removeItem(CONFIG.CART_KEY);
        Store.updateCartCountUI();
        // Si clearCloud es true, limpiamos también en la BD (útil post-compra)
        // Si es false, solo limpiamos local (útil para logout)
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

    // --- CORRECCIÓN CRÍTICA: Fusión Inteligente y Validación ---
    mergeWithCloud: async (userId) => {
        try {
            const localCart = Store.getCart();
            const localItemsCount = Object.keys(localCart).length;

            const { data } = await db.from('carritos').select('items').eq('user_id', userId).single();
            const cloudCart = data?.items || {};
            const cloudItemsCount = Object.keys(cloudCart).length;

            // CASO 1: Local vacío, Nube tiene datos -> Bajamos la nube
            if (localItemsCount === 0 && cloudItemsCount > 0) {
                console.log('☁️ Restaurando carrito de la nube');
                localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(cloudCart));
                Store.updateCartCountUI();
                return;
            }

            // CASO 2: Nube vacía, Local tiene datos -> Subimos lo local (ya lo hace saveCart implícitamente, pero forzamos sync)
            if (localItemsCount > 0 && cloudItemsCount === 0) {
                console.log('⬆️ Subiendo carrito local a cuenta nueva');
                await Store.syncToCloud(localCart);
                return;
            }

            // CASO 3: Ambos tienen datos -> Conflicto (Fusión Inteligente)
            // Lógica corregida: NO sumar ciegamente. Usar Math.max para evitar duplicación fantasma
            // o priorizar la sesión actual.
            
            const finalCart = { ...cloudCart };
            
            Object.keys(localCart).forEach(itemId => {
                if (finalCart[itemId]) {
                    // CORRECCIÓN: Evitar duplicación x2. 
                    // Si el usuario tenía 5 en nube y 5 en local (misma sesión), NO queremos 10.
                    // Tomamos el mayor de los dos para ser conservadores, o el local si asumimos que es el más reciente.
                    // Aquí usamos Math.max para evitar perder items, pero evitar la duplicación exacta.
                    finalCart[itemId] = Math.max(finalCart[itemId], localCart[itemId]);
                } else {
                    finalCart[itemId] = localCart[itemId];
                }
            });

            // Opcional: Validar stock máximo aquí también si fuera necesario
            // const product = await Store.fetchProduct();
            // if (finalCart[CONFIG.PRODUCT.ID] > product.stock_disponible) { ... }

            console.log('🔄 Carritos sincronizados (Estrategia Max)');
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
            // Fallback seguro pero indicando error visualmente si es posible
            console.error("Error fetching product:", err);
            return { id: CONFIG.PRODUCT.ID, nombre: CONFIG.PRODUCT.NAME, precio: CONFIG.PRODUCT.PRICE, stock_disponible: 0 };
        }
    },

    processCheckout: async (user, shippingData) => {
        const cart = Store.getCart();
        const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
        
        if (totalItems <= 0) {
            throw new Error("El carrito está vacío.");
        }

        // Llamada segura al Backend (RPC)
        const { data, error } = await db.rpc('crear_pedido_seguro', {
            p_user_id: user.id,
            p_items_cart: cart, // Enviamos { "id": qty }, SIN precios
            p_shipping: shippingData
        });

        if (error) {
            console.error("Error en Checkout:", error);
            
            // Traducción de errores comunes de SQL para el usuario
            if (error.message.includes('Stock insuficiente')) {
                throw new Error("Lo sentimos, algunos productos ya no tienen stock suficiente.");
            }
            if (error.message.includes('Producto ID')) {
                throw new Error("Uno de los productos ya no está disponible.");
            }
            
            throw new Error("Error al procesar el pedido. Por favor intenta nuevamente.");
        }

        // Si todo sale bien:
        Store.clearCart(true); // Limpiamos carrito local y nube
        return data;
    },

    renderOrders: async (userId) => {
        const list = document.getElementById('pedidos-lista-container');
        if (!list) return;
        
        // Mejor manejo de errores y estados de carga
        list.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando historial...</div>';

        const { data: orders, error } = await db.from('pedidos').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        
        if (error) {
            list.innerHTML = `<p style="color:red; text-align:center;">Error al cargar pedidos: ${error.message}</p>`;
            return;
        }

        if (orders && orders.length > 0) {
            list.innerHTML = orders.map(o => {
                let statusColor = 'primary';
                if (o.estado === 'Cancelado') statusColor = 'danger'; 
                else if (o.estado === 'Pagado') statusColor = 'info'; 
                else if (o.estado === 'Entregado') statusColor = 'success';
                
                let btns = `<button onclick="window.Utils.printReceipt(${o.id})" class="btn-sm btn-light" style="margin-right:5px;"><i class="fa-solid fa-print"></i> Recibo</button>`;
                
                // Validación extra: Solo mostrar rastreo si hay info válida
                if(['Enviado','Entregado'].includes(o.estado) && o.tracking_info && o.tracking_info.tracking_number) {
                     const safeData = encodeURIComponent(JSON.stringify(o.tracking_info));
                     btns += `<button onclick="window.Store.trackOrder('${safeData}', ${o.id})" class="btn-sm btn-primary" style="margin-right:5px;">Rastrear</button>`;
                }
                
                if(o.estado === 'Entregado') btns += `<button onclick="window.RateUI.open(${o.id})" class="btn-sm" style="background:#f59e0b; color:white; border:none; border-radius:20px;">★ Calificar</button>`;
                
                // Solo permitir cancelar si no ha pasado mucho tiempo (opcional, lógica de UI)
                if(o.estado === 'Pendiente') btns += `<button onclick="window.Store.cancelOrder(${o.id})" class="btn-text-danger" style="margin-left:10px;">Cancelar</button>`;

                return `<div class="pedido-card" style="border-left-color: var(--color-${statusColor});">
                            <div class="pedido-header">
                                <div>
                                    <strong>Pedido #${String(o.id).slice(0, 8)}</strong><br>
                                    <small>${new Date(o.created_at).toLocaleDateString()}</small>
                                </div>
                                <span class="badge" style="background-color: var(--color-${statusColor}-light, #eee); color: var(--color-${statusColor});">${o.estado}</span>
                            </div>
                            <div class="order-info">
                                <div>${formatCurrency(o.total)}</div>
                                <div>${btns}</div>
                            </div>
                        </div>`;
            }).join('');
        } else {
            list.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No tienes pedidos aún.</p>';
        }
    },

    cancelOrder: async (orderId) => {
        confirmModal('Cancelar Pedido', '¿Estás seguro de cancelar este pedido?', async () => {
            const load = notify.loading('Cancelando...');
            
            // Verificar estado actual antes de cancelar (evitar cancelar algo ya enviado)
            const { data: orderCheck } = await db.from('pedidos').select('estado').eq('id', orderId).single();
            if (orderCheck && orderCheck.estado !== 'Pendiente') {
                notify.close(load);
                return notify.error('El pedido ya no puede ser cancelado.');
            }

            const { error } = await db.from('pedidos').update({ estado: 'Cancelado' }).eq('id', orderId);
            notify.close(load);
            
            if(error) notify.error(error.message);
            else { 
                notify.success('Pedido cancelado'); 
                if(globalState.userProfile?.id) Store.renderOrders(globalState.userProfile.id); 
            }
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
            
            // Renderizado seguro del timeline
            if (Array.isArray(data.history) && data.history.length > 0) {
                timeline.innerHTML = data.history.map(step => `
                    <div class="timeline-item ${step.completed ? 'completed' : ''}">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div style="font-weight:600;">${step.status}</div>
                            <div style="font-size:0.8rem; color:#888;">
                                ${step.date ? new Date(step.date).toLocaleString() : 'Fecha pendiente'}
                            </div>
                        </div>
                    </div>`).join('');
            } else {
                timeline.innerHTML = '<p style="text-align:center; color:#666;">Información de seguimiento no disponible.</p>';
            }
            
            modal.style.display = 'flex';
        } catch(e) { 
            console.error(e);
            notify.error('Error al cargar datos de rastreo'); 
        }
    }
};