// src/utils.js
import { db } from './db.js';

// --- Formateadores ---
export const formatCurrency = (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(val);
};

export const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const escapeHtml = (text) => {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
};

export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Utilidades de Interfaz (UI) MEJORADAS ---
export const notify = {
    // Función interna para limpiar notificaciones viejas atascadas
    garbageCollect: () => {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const now = Date.now();
        // Buscar notificaciones que lleven más de 10 segundos vivas (zombies)
        Array.from(container.children).forEach(child => {
            const timestamp = parseInt(child.dataset.time || '0');
            // Si es 'loading' y lleva mucho tiempo, o si ya no tiene la clase show
            if (now - timestamp > 10000 || !child.classList.contains('show')) {
                child.remove();
            }
        });
    },

    show: (msg, type = 'info') => {
        // 1. Limpieza preventiva antes de mostrar una nueva
        notify.garbageCollect();

        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        const div = document.createElement('div');
        div.className = `notification notification-${type}`;
        div.dataset.time = Date.now(); // Marca de tiempo para el Garbage Collector
        
        div.innerHTML = `
            <div class="notification-icon">
                ${type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : 
                  type === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : 
                  type === 'loading' ? '<i class="fa-solid fa-circle-notch fa-spin"></i>' : 
                  '<i class="fa-solid fa-info-circle"></i>'}
            </div>
            <div class="notification-content">${escapeHtml(msg)}</div>
        `;
        
        container.appendChild(div);
        
        // Forzar reflow
        void div.offsetWidth; 
        div.classList.add('show');
        
        // Auto-cierre para mensajes normales
        if (type !== 'loading') {
            setTimeout(() => {
                notify.close(div);
            }, 4000);
        }
        
        return div;
    },
    
    success: (m) => notify.show(m, 'success'),
    error: (m) => notify.show(m, 'error'),
    loading: (m) => notify.show(m, 'loading'),
    
    close: (div) => { 
        if (div && div.parentNode) {
            div.classList.remove('show');
            setTimeout(() => {
                if (div.parentNode) div.remove();
            }, 300);
        } else {
            // Si por alguna razón pasaron null o el div ya no existe,
            // ejecutamos una limpieza general por si acaso.
            notify.garbageCollect();
        }
    }
};

export const confirmModal = (title, message, onConfirm, btnClass = 'btn-primary-modal-danger', btnText = 'Confirmar') => {
    const existing = document.getElementById('custom-confirm-modal');
    if (existing) existing.remove();

    const modalHTML = `
        <div id="custom-confirm-modal" class="modal-overlay" style="display:flex; opacity:0; transition: opacity 0.2s;">
            <div class="modal-content-premium">
                <div class="modal-icon-warning">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                <div class="modal-actions">
                    <button id="btn-modal-cancel" class="btn-secondary-modal">Cancelar</button>
                    <button id="btn-modal-confirm" class="${btnClass}">${escapeHtml(btnText)}</button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    requestAnimationFrame(() => document.getElementById('custom-confirm-modal').style.opacity = '1');
    
    const closeModal = () => {
        const m = document.getElementById('custom-confirm-modal');
        if(m) { m.style.opacity = '0'; setTimeout(() => m.remove(), 200); }
    };
    
    document.getElementById('btn-modal-cancel').onclick = closeModal;
    document.getElementById('btn-modal-confirm').onclick = async () => { 
        const btn = document.getElementById('btn-modal-confirm');
        btn.disabled = true; btn.innerText = 'Procesando...';
        try { await onConfirm(); } catch (e) { console.error(e); } finally { closeModal(); }
    };
};

// --- RECIBO CORPORATIVO ECOTECH (Versión Print-Perfect) ---
export const printReceipt = async (orderId) => {
    const win = window.open('', '_blank');
    if (!win) return notify.error('Habilite las ventanas emergentes');

    win.document.write('<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f0f0f0;">Generando documento digital...</div>');

    // Referencia para cerrar
    const load = notify.loading('Generando recibo...');
    
    try {
        const { data: order, error } = await db
            .from('pedidos')
            .select('*, perfiles(nombre_completo, email, direccion, telefono)')
            .eq('id', orderId)
            .single();
            
        if(error || !order) throw new Error('Error al obtener datos');

        const subtotal = order.total / 1.16;
        const iva = order.total - subtotal;
        const metodoPago = order.datos_envio?.metodo === 'card' ? '04 - Tarjeta de crédito' : '03 - Transferencia electrónica';
        const fecha = new Date(order.created_at).toLocaleDateString('es-MX');
        const hora = new Date(order.created_at).toLocaleTimeString('es-MX');
        
        const qrData = 'https://whosdanileon.github.io/ECOTECHSOLUTIONS/';
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

        const itemsRows = (order.items || []).map((item, i) => `
            <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
                <td style="padding:8px; border:1px solid #ddd; font-size:0.85em;">${item.cantidad}</td>
                <td style="padding:8px; border:1px solid #ddd; font-size:0.85em;">PZA</td>
                <td style="padding:8px; border:1px solid #ddd; font-size:0.85em;">${escapeHtml(item.nombre)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right; font-size:0.85em;">${formatCurrency(item.precio)}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:right; font-size:0.85em;">${formatCurrency(item.precio * item.cantidad)}</td>
            </tr>
        `).join('');

        const receiptHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Recibo #${orderId} - EcoTech</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 40px; background: #525659; }
                .page { background: white; max-width: 850px; margin: 0 auto; padding: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); min-height: 1000px; position: relative; box-sizing: border-box; }
                
                .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 4px solid #4CAF50; padding-bottom: 20px; }
                .brand-area { display: flex; align-items: center; gap: 15px; }
                .brand-area img { height: 70px; }
                .brand-text h1 { margin: 0; color: #2e7d32; font-size: 1.8em; text-transform: uppercase; letter-spacing: 1px; }
                .brand-text p { margin: 5px 0 0; font-size: 0.8em; color: #555; line-height: 1.4; }
                
                .invoice-meta { text-align: right; }
                .invoice-label { font-size: 2em; font-weight: 800; color: #ccc; letter-spacing: 2px; line-height: 1; margin: 0; }
                .meta-table { margin-top: 10px; font-size: 0.85em; border-collapse: collapse; float: right; }
                .meta-table td { padding: 3px 8px; border: 1px solid #eee; }
                .meta-header { background: #f1f8e9; font-weight: bold; color: #33691e; }
                
                .client-box { background: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin-bottom: 30px; font-size: 0.9em; display: flex; justify-content: space-between; }
                .client-col h3 { margin: 0 0 5px 0; color: #2e7d32; font-size: 0.9em; text-transform: uppercase; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background: #2e7d32; color: white; padding: 10px; font-size: 0.8em; text-align: center; font-weight: bold; }
                
                .footer-grid { display: flex; gap: 30px; border-top: 2px solid #eee; padding-top: 20px; }
                .qr-container { text-align: center; width: 120px; }
                .qr-container img { width: 100px; height: 100px; }
                .legal-text { flex: 1; font-size: 0.65em; color: #777; text-align: justify; line-height: 1.4; }
                
                .totals-box { width: 250px; }
                .t-row { display: flex; justify-content: space-between; font-size: 0.9em; padding: 5px 0; color: #555; }
                .t-total { font-size: 1.3em; font-weight: 800; color: #2e7d32; border-top: 2px solid #2e7d32; padding-top: 10px; margin-top: 5px; }
                
                .btn-print { position: fixed; bottom: 30px; right: 30px; background: #2e7d32; color: white; border: none; padding: 15px 30px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s; z-index: 1000; }
                .btn-print:hover { transform: scale(1.05); }
                
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; padding: 0; margin: 0; }
                    .page { box-shadow: none; margin: 0; padding: 20px 40px; width: 100%; max-width: none; }
                    .no-print, .btn-print { display: none !important; }
                    .header, .client-box, table, .footer-grid { width: 100%; }
                    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="brand-area">
                        <img src="images/logo.png" alt="EcoTech Logo">
                        <div class="brand-text">
                            <h1>EcoTech Solutions</h1>
                            <p>
                                <strong>Régimen Fiscal:</strong> 601 - General de Ley Personas Morales<br>
                                <strong>RFC:</strong> ECO230101MX1<br>
                                Carr. a El Carmen Xalpatlahuaya s/n<br>
                                90500 Huamantla, Tlaxcala, México
                            </p>
                        </div>
                    </div>
                    <div class="invoice-meta">
                        <h2 class="invoice-label">RECIBO</h2>
                        <table class="meta-table">
                            <tr><td class="meta-header">Folio</td><td>#${String(orderId).padStart(6, '0')}</td></tr>
                            <tr><td class="meta-header">Fecha</td><td>${fecha}</td></tr>
                            <tr><td class="meta-header">Hora</td><td>${hora}</td></tr>
                            <tr><td class="meta-header">Estado</td><td style="color:${order.estado === 'Pagado' ? 'green' : 'orange'}">${order.estado}</td></tr>
                        </table>
                    </div>
                </div>

                <div class="client-box">
                    <div class="client-col">
                        <h3>Facturar A:</h3>
                        <strong>${escapeHtml(order.perfiles?.nombre_completo.toUpperCase())}</strong><br>
                        ${escapeHtml(order.datos_envio?.direccion || 'Dirección no registrada')}<br>
                        Tel: ${escapeHtml(order.datos_envio?.telefono || order.perfiles?.telefono || 'N/A')}<br>
                        ${escapeHtml(order.perfiles?.email)}
                    </div>
                    <div class="client-col" style="text-align:right;">
                        <h3>Datos de la Transacción:</h3>
                        <strong>Método:</strong> PUE - Pago en una sola exhibición<br>
                        <strong>Forma:</strong> ${metodoPago}<br>
                        <strong>Moneda:</strong> MXN - Peso Mexicano<br>
                        <strong>Uso CFDI:</strong> G03 - Gastos en general
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th width="10%">CANT</th>
                            <th width="10%">UNIDAD</th>
                            <th width="50%">DESCRIPCIÓN</th>
                            <th width="15%">P. UNIT</th>
                            <th width="15%">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>

                <div class="footer-grid">
                    <div class="qr-container">
                        <img src="${qrUrl}" alt="QR Validación">
                    </div>
                    
                    <div class="legal-text">
                        <strong>Cadena Original del complemento de certificación digital del SAT:</strong><br>
                        ||1.1|A-${orderId}|${fecha}|${hora}|ECO230101MX1|${order.total}|MXN|${order.total}|I|PUE|${order.perfiles?.id || 'XAXX010101000'}||<br><br>
                        <strong>Sello Digital del Emisor:</strong><br>
                        EcoTechSignsV2+${btoa(order.id).substring(0, 20)}...<br><br>
                        Este documento es una representación impresa de un CFDI.
                    </div>

                    <div class="totals-box">
                        <div class="t-row"><span>Subtotal:</span> <span>${formatCurrency(subtotal)}</span></div>
                        <div class="t-row"><span>Descuento:</span> <span>$0.00</span></div>
                        <div class="t-row"><span>IVA (16%):</span> <span>${formatCurrency(iva)}</span></div>
                        <div class="t-row t-total">
                            <span>TOTAL:</span> <span>${formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center; color: #999; font-size: 0.8em; border-top: 1px solid #eee; padding-top: 10px;">
                    EcoTech Solutions S.A. de C.V. | www.ecotechsolutions.com | contacto@ecotech.com
                </div>

                <button class="no-print btn-print" onclick="window.print()">
                    <i class="fa-solid fa-print"></i> IMPRIMIR
                </button>
            </div>
        </body>
        </html>`;

        win.document.open();
        win.document.write(receiptHTML);
        win.document.close();

    } catch (e) {
        win.close();
        notify.error('Error al generar recibo');
    } finally {
        // CIERRE FORZOSO DE LA NOTIFICACIÓN DE CARGA
        notify.close(load);
    }
};