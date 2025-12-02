// src/utils.js
import { db } from './db.js';

// --- Formateadores ---
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
};

export const formatTime = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    }) : '--:--';
};

export const escapeHtml = (text) => {
    if (!text) return '';
    return text.toString().replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[m]);
};

export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Utilidades de Interfaz (UI) ---
export const notify = {
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

export const confirmModal = (title, message, onConfirm, btnClass = 'btn-primary-modal-danger', btnText = 'Confirmar') => {
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

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
    
    document.getElementById('btn-modal-cancel').onclick = () => {
        document.getElementById('custom-confirm-modal').remove();
    };
    
    document.getElementById('btn-modal-confirm').onclick = () => { 
        onConfirm(); 
        document.getElementById('custom-confirm-modal').remove(); 
    };
};

// --- FIX 4.1: Generador de Recibos "Anti-Bloqueo" ---
export const printReceipt = async (orderId) => {
    // 1. Abrir ventana INMEDIATAMENTE (antes del await) para evitar bloqueo del navegador
    const win = window.open('', '_blank');
    
    if (!win) {
        return notify.error('Habilite las ventanas emergentes para ver el recibo.');
    }

    // 2. Poner un loader visual en la nueva ventana mientras cargan los datos
    win.document.write(`
        <html><head><title>Generando...</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;">
            <div style="text-align:center;">
                <div style="font-size:30px;margin-bottom:10px;">📄</div>
                Cargando documento...
            </div>
        </body></html>
    `);

    const load = notify.loading('Generando documento...');
    
    try {
        // 3. Consultamos datos
        const { data: order, error } = await db
            .from('pedidos')
            .select('*, perfiles(nombre_completo, email, telefono, direccion)')
            .eq('id', orderId)
            .single();
            
        notify.close(load);
        
        if(error || !order) {
            win.close(); // Cerramos si hubo error
            return notify.error('Error al recuperar el pedido');
        }

        // 4. Generamos contenido
        const itemsHtml = (order.items || []).map(item => `
            <tr>
                <td style="padding:12px; border-bottom:1px solid #eee;">${item.nombre || 'Producto'}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: center;">${item.cantidad}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: right;">${formatCurrency(item.precio)}</td>
                <td style="padding:12px; border-bottom:1px solid #eee; text-align: right;">${formatCurrency(item.precio * item.cantidad)}</td>
            </tr>
        `).join('');

        const receiptHTML = `
        <html>
        <head>
            <title>Recibo #${order.id}</title>
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
                    <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    <div class="status-badge">${order.estado}</div>
                </div>
            </div>

            <div class="columns">
                <div class="col">
                    <h3>Cliente</h3>
                    <strong>${order.datos_envio?.nombre || order.perfiles?.nombre_completo || 'Cliente'}</strong><br>
                    ${order.datos_envio?.direccion || order.perfiles?.direccion || 'Dirección no registrada'}<br>
                    ${order.perfiles?.email || ''}
                </div>
                <div class="col">
                    <h3>Pago</h3>
                    <strong>Método:</strong> ${order.datos_envio?.metodo === 'card' ? 'Tarjeta' : 'Transferencia'}<br>
                    <strong>Moneda:</strong> MXN
                </div>
            </div>

            <table class="table">
                <thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">P. Unit</th><th style="text-align:right;">Importe</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>

            <div class="total-section">
                <div class="total-row">Subtotal: ${formatCurrency(order.total / 1.16)}</div>
                <div class="total-row">IVA (16%): ${formatCurrency(order.total - (order.total / 1.16))}</div>
                <div class="total-final">${formatCurrency(order.total)}</div>
            </div>

            <div class="footer">
                <p>Comprobante simplificado. Para facturación fiscal, solicítela en las próximas 24hrs.</p>
                <button class="no-print" onclick="window.print()" style="padding:10px 20px;background:#333;color:white;border:none;cursor:pointer;border-radius:4px;margin-top:20px;">IMPRIMIR</button>
            </div>
        </body>
        </html>`;

        // 5. Inyectamos el contenido final en la ventana que ya estaba abierta
        win.document.open();
        win.document.write(receiptHTML);
        win.document.close();

    } catch (e) {
        win.close();
        notify.error('Error generando recibo');
    }
};