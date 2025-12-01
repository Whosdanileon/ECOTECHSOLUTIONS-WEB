// src/dashboard.js
import { db } from './db.js';
import { CONFIG } from './config.js';
import { globalState } from './state.js';
import { notify, escapeHtml, confirmModal, formatCurrency } from './utils.js';

// --- TELEMETRÍA (Gráficas) ---
export const Telemetry = {
    init: () => {
        const ctx = document.getElementById('tempChart');
        if (!ctx) return;
        if (typeof Chart === 'undefined') return console.warn("Chart.js no cargado.");
        if (globalState.chartInstance) globalState.chartInstance.destroy();

        globalState.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: Array(20).fill(''), 
                datasets: [{ 
                    label: 'Temp (°C)', 
                    data: Array(20).fill(null), 
                    borderColor: '#f59e0b', 
                    backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                    borderWidth: 2, 
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 2 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: { duration: 0 }, 
                scales: { 
                    y: { beginAtZero: false, min: 0, max: 100 }, 
                    x: { display: false } 
                }, 
                plugins: { legend: { display: false } } 
            }
        });
    },
    updateFromPayload: (machineId, controls) => {
        if (machineId !== 2 || !controls) return;
        const newVal = Number(controls.escalda_db);
        if (isNaN(newVal)) return;
        
        globalState.machinePhysics.m2_temp = newVal;
        
        if (globalState.chartInstance) {
            const data = globalState.chartInstance.data.datasets[0].data;
            data.shift(); 
            data.push(newVal); 
            globalState.chartInstance.update();
        }
        
        const kpi = document.getElementById('kpi-temp');
        if (kpi) { 
            kpi.textContent = newVal.toFixed(1) + '°C'; 
            kpi.style.color = newVal > 85 ? '#ef4444' : '#f59e0b'; 
        }
        
        const gauge = document.getElementById('gauge-m2-val');
        const bar = document.getElementById('temp-bar-2');
        
        if (gauge) gauge.innerHTML = newVal.toFixed(1) + '<span class="gauge-unit">°C</span>';
        if (bar) { 
            bar.style.width = Math.min(newVal, 100) + '%'; 
            bar.style.background = newVal > 85 ? '#ef4444' : (newVal > 60 ? '#f59e0b' : '#3b82f6'); 
        }
    }
};

// --- VISIÓN ---
export const Vision = {
    init: () => {
        const storedUrl = localStorage.getItem(CONFIG.VISION_URL_KEY);
        if (storedUrl) { 
            const input = document.getElementById('ngrok-url-input'); 
            if (input) input.value = storedUrl; 
        }
    },
    connect: () => {
        const input = document.getElementById('ngrok-url-input');
        let url = input.value.trim();
        if (url.endsWith('/')) url = url.slice(0, -1);
        
        // Validación básica de seguridad
        if (!url.startsWith('http')) return notify.error('URL inválida');
        
        localStorage.setItem(CONFIG.VISION_URL_KEY, url);
        
        const iframe = document.getElementById('vision-iframe');
        if (iframe) iframe.src = url;
        
        const status = document.getElementById('vision-status');
        if (status) { 
            status.className = 'status-pill on'; 
            status.innerHTML = '<span class="status-pill dot"></span>Conectado'; 
        }
        notify.success('Visión conectada');
    }
};

// --- CONTROL DE MAQUINARIA ---
export const MachineControl = {
    // Comando directo (Toggle o estado fijo)
    sendCommand: async (id, act) => { 
        if (globalState.isEmergencyActive && act !== 'Paro') return notify.error("⛔ EMERGENCIA ACTIVA"); 
        try {
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
            let c = data.controles || {}; 
            
            if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
            else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; } 
            
            await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id); 
            Dashboard.renderMachines(globalState.userProfile?.rol);
            Dashboard.logEvent(id, act, 'INFO');
        } catch (e) { notify.error('Error PLC'); }
    },

    // Interruptores simples (ON/OFF)
    toggleSwitch: async (id, key) => { 
        if (globalState.isEmergencyActive && !key.includes('off')) return notify.error("⛔ EMERGENCIA ACTIVA"); 
        try {
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
            let c = data.controles || {}; 
            
            // Lógica Maquina 1
            if (id === 1) { 
                if (key.includes('llenado')) { c.online_llenado = true; c.online_vaciado = false; } 
                else if (key.includes('vaciado')) { c.online_vaciado = true; c.online_llenado = false; } 
                else if (key.includes('fill_off')) { c.online_llenado = false; c.online_vaciado = false; }
                else if (key.includes('arriba')) { c.online_arriba = true; c.online_abajo = false; }
                else if (key.includes('abajo')) { c.online_abajo = true; c.online_arriba = false; }
                else if (key.includes('tray_off')) { c.online_arriba = false; c.online_abajo = false; }
            } 
            
            await db.from('maquinas').update({ controles: c }).eq('id', id); 
            Dashboard.renderMachines(globalState.userProfile?.rol);
            Dashboard.logEvent(id, `Switch ${key}`, 'INFO');
        } catch (e) { notify.error('Error switch PLC'); }
    },

    // --- PULSADOR MOMENTÁNEO (Push Button) ---
    sendPulse: async (id, key, btnId) => {
        if (globalState.isEmergencyActive && !key.includes('stop')) return notify.error("⛔ EMERGENCIA ACTIVA");
        
        // 1. Feedback Visual Inmediato (Presionado)
        const btn = document.getElementById(btnId);
        const originalText = btn ? btn.innerHTML : '';
        if(btn) {
            btn.disabled = true; 
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.classList.add('active'); 
            btn.style.transform = "scale(0.95)";
        }

        try {
            // 2. Enviar Señal TRUE (Inicio de pulso)
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
            let c = data.controles || {};
            c[key] = true; 
            
            // Si es un botón de paro, aseguramos que apague el inicio por seguridad lógica inmediata
            if (key === 'stop_cycle') c['start_cycle'] = false;

            await db.from('maquinas').update({ controles: c }).eq('id', id);

            const label = key === 'stop_cycle' ? 'DETENER' : 'INICIAR';
            Dashboard.logEvent(id, `Pulso ${label}`, 'INFO');

            // 3. Esperar tiempo del pulso (800ms)
            await new Promise(resolve => setTimeout(resolve, 800));

            // 4. Enviar Señal FALSE (Fin de pulso)
            const { data: newData } = await db.from('maquinas').select('controles').eq('id', id).single();
            let cNew = newData.controles || {};
            cNew[key] = false;
            
            await db.from('maquinas').update({ controles: cNew }).eq('id', id);
            
            if (key === 'stop_cycle') notify.success('Ciclo detenido');
            else notify.success('Ciclo iniciado');

        } catch (e) {
            console.error(e);
            notify.error('Error al enviar pulso al PLC');
        } finally {
            // 5. Restaurar Botón
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.classList.remove('active');
                btn.style.transform = "scale(1)";
            }
        }
    },

    toggleEmergency: () => {
        if (!globalState.isEmergencyActive) { 
            confirmModal('PARO DE EMERGENCIA', '¿Detener TODO?', async () => { 
                globalState.isEmergencyActive = true; 
                document.body.classList.add('emergency-mode'); 
                const btn = document.getElementById('btn-global-stop'); 
                if(btn) { 
                    btn.classList.add('active'); 
                    btn.innerHTML = 'RESTABLECER'; 
                } 
                
                // Paro M1
                await MachineControl.sendCommand(1, 'Paro'); 
                
                // Paro M2 (Forzoso)
                await db.from('maquinas').update({ controles: { start_cycle: false, stop_cycle: true, calentador_on: false } }).eq('id', 2);
                
                Dashboard.logEvent(0, 'PARO GLOBAL', 'ERROR');
            }, 'btn-primary-modal-danger', 'PARAR'); 
        } else { 
            confirmModal('Restablecer', '¿Reactivar?', async () => { 
                globalState.isEmergencyActive = false; 
                document.body.classList.remove('emergency-mode'); 
                const btn = document.getElementById('btn-global-stop'); 
                if(btn) { 
                    btn.classList.remove('active'); 
                    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA'; 
                } 
                
                // Resetear señales de paro en M2
                await db.from('maquinas').update({ controles: { stop_cycle: false } }).eq('id', 2);
                
                Dashboard.logEvent(0, 'Reinicio', 'INFO');
            }, 'btn-secondary-modal', 'OK'); 
        } 
    }
};

// --- DASHBOARD ---
export const Dashboard = {
    renderMachines: async (userRole) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;
        
        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;

        container.innerHTML = '';
        const isAdmin = CONFIG.ROLES.ADMIN.includes(userRole);

        // --- Status Global (Online/Offline) ---
        const anyMachineOnline = data.some(m => m.online === true);
        const statusEl = document.getElementById('global-plc-status');
        
        if (statusEl) {
            if (anyMachineOnline) {
                statusEl.className = 'status-indicator online';
                statusEl.innerHTML = '<span class="dot"></span> SISTEMA ONLINE';
                statusEl.style.borderColor = '#bbf7d0';
                statusEl.style.color = '#166534';
                statusEl.style.background = '#dcfce7';
            } else {
                statusEl.className = 'status-indicator';
                statusEl.innerHTML = '<span class="dot" style="background:#ef4444"></span> SIN CONEXIÓN PLC';
                statusEl.style.borderColor = '#fee2e2';
                statusEl.style.color = '#991b1b';
                statusEl.style.background = '#fef2f2';
            }
        }

        data.forEach(m => {
            // Indicador de "Desconectado" sobre la tarjeta
            const offlineOverlay = !m.online ? `<div style="background:#fee2e2; color:#991b1b; padding:5px; font-size:0.7rem; text-align:center; border-radius:4px; margin-bottom:10px;"><i class="fa-solid fa-plug-circle-xmark"></i> DESCONECTADO</div>` : '';

            let body = '';
            const safeName = escapeHtml(m.nombre);
            
            // --- MAQUINA 1: PLC LOGÍSTICO ---
            if (m.id === 1) {
                const isStarted = m.controles.Inicio;
                const controlsHTML = isAdmin ? `
                    <div class="machine-interface">
                        <div class="action-buttons">
                            <button class="btn-action btn-start ${isStarted ? 'active' : ''}" onclick="window.MachineControl.sendCommand(1,'Inicio')"><i class="fa-solid fa-play"></i> INICIAR</button>
                            <button class="btn-action btn-stop" onclick="window.MachineControl.sendCommand(1,'Paro')"><i class="fa-solid fa-stop"></i> PARO</button>
                        </div>
                        <div class="control-group"><span class="control-label">Tanque</span>
                            <div class="segmented-control">
                                <div class="segmented-option"><input type="radio" name="tk" id="m1_tk_fill" ${m.controles.online_llenado ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'online_llenado')"><label for="m1_tk_fill">Llenado</label></div>
                                <div class="segmented-option"><input type="radio" name="tk" id="m1_tk_off" ${(!m.controles.online_llenado && !m.controles.online_vaciado) ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'fill_off')"><label for="m1_tk_off">OFF</label></div>
                                <div class="segmented-option"><input type="radio" name="tk" id="m1_tk_vac" ${m.controles.online_vaciado ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'online_vaciado')"><label for="m1_tk_vac">Vaciado</label></div>
                            </div>
                        </div>
                        <div class="control-group" style="margin-bottom:0"><span class="control-label">Control Elevador</span>
                            <div class="segmented-control">
                                <div class="segmented-option"><input type="radio" name="ch" id="m1_ch_up" ${m.controles.online_arriba ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'online_arriba')"><label for="m1_ch_up">Arriba</label></div>
                                <div class="segmented-option"><input type="radio" name="ch" id="m1_ch_off" ${(!m.controles.online_arriba && !m.controles.online_abajo) ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'tray_off')"><label for="m1_ch_off">Freno</label></div>
                                <div class="segmented-option"><input type="radio" name="ch" id="m1_ch_dn" ${m.controles.online_abajo ? 'checked' : ''} onclick="window.MachineControl.toggleSwitch(1,'online_abajo')"><label for="m1_ch_dn">Abajo</label></div>
                            </div>
                        </div>
                    </div>` : '<p class="text-muted">Modo Visualización</p>';
                
                body = `${offlineOverlay}<div class="m-area"><i class="fa-solid fa-microchip"></i> PLC M1</div>${controlsHTML}`;
            
            // --- MAQUINA 2: DESHIDRATADORA (Pulsadores) ---
            } else if (m.id === 2) {
                const temp = globalState.machinePhysics.m2_temp || Number(m.controles.escalda_db) || 0;
                
                const controlsHTML = isAdmin ? `
                    <div class="machine-interface" style="margin-top: 25px;">
                        <span class="control-label" style="display:block; text-align:center; margin-bottom:12px;">Control de Ciclo Automático</span>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <button id="btn-m2-start" 
                                class="btn-action" 
                                style="background:#f59e0b; color:white; justify-content:center; border:none; box-shadow:0 4px 6px rgba(245, 158, 11, 0.3);"
                                onclick="window.MachineControl.sendPulse(2, 'start_cycle', 'btn-m2-start')">
                                <i class="fa-solid fa-play"></i> INICIAR
                            </button>
                            
                            <button id="btn-m2-stop" 
                                class="btn-action" 
                                style="background:#ef4444; color:white; justify-content:center; border:none; box-shadow:0 4px 6px rgba(239, 68, 68, 0.3);"
                                onclick="window.MachineControl.sendPulse(2, 'stop_cycle', 'btn-m2-stop')">
                                <i class="fa-solid fa-stop"></i> DETENER
                            </button>
                        </div>
                        
                        <p style="font-size:0.75rem; color:#94a3b8; margin-top:10px; text-align:center;">
                            <i class="fa-solid fa-fingerprint"></i> Pulsadores momentáneos
                        </p>
                    </div>` : '';

                body = `${offlineOverlay}<div class="clean-gauge">
                            <div class="gauge-readout" id="gauge-m2-val">${temp.toFixed(1)}<span class="gauge-unit">°C</span></div>
                            <div class="gauge-bar-bg">
                                <div id="temp-bar-2" class="gauge-bar-fill" style="width:${Math.min(temp, 100)}%; background:${temp > 85 ? '#ef4444' : '#3b82f6'}"></div>
                            </div>
                        </div>${controlsHTML}`;
            }
            
            container.insertAdjacentHTML('beforeend', `<div class="card machine-card"><div class="m-header"><h4>${safeName}</h4><div class="status-pill ${m.estado === 'En Ciclo' ? 'on' : 'off'}"><span class="status-pill dot"></span>${m.estado}</div></div><div class="m-body">${body}</div></div>`);
        });
    },
    
    // --- USUARIOS ---
    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        try {
            const { data, error } = await db.from('perfiles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data) return;
            const isSys = CONFIG.ROLES.SYS.includes(myRole);
            tbody.innerHTML = data.map(u => {
                const isMe = u.id === globalState.userProfile?.id;
                return `<tr data-uid="${u.id}"><td><strong>${escapeHtml(u.nombre_completo)}</strong><br><small>${escapeHtml(u.email)}</small></td>
                    <td><select class="form-input role-select" ${isMe ? 'disabled' : ''}>${['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador', 'Cliente'].map(r => `<option ${u.rol === r ? 'selected' : ''} value="${r}">${r}</option>`).join('')}</select></td>
                    <td>${escapeHtml(u.area || '-')}</td><td><button class="btn-icon btn-save" onclick="window.Dashboard.updateUserRole('${u.id}', this)" ${isMe ? 'disabled' : ''}><i class="fa-solid fa-save"></i></button></td></tr>`;
            }).join('');
            const form = document.getElementById('form-create-employee');
            if(form) form.onsubmit = Dashboard.createEmployee;
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:red">Error cargando usuarios: ${e.message}</td></tr>`;
        }
    },
    createEmployee: async (e) => {
        e.preventDefault();
        const load = notify.loading('Creando...');
        const { data, error } = await db.auth.signUp({ 
            email: document.getElementById('new-user-email').value, 
            password: document.getElementById('new-user-pass').value 
        });
        
        if (!error && data.user) {
            await db.from('perfiles').upsert([{ 
                id: data.user.id, 
                email: data.user.email, 
                nombre_completo: document.getElementById('new-user-name').value, 
                rol: document.getElementById('new-user-role').value, 
                area: document.getElementById('new-user-dept').value 
            }]);
            notify.close(load); 
            notify.success('Creado'); 
            document.getElementById('modal-create-user').style.display='none'; 
            Dashboard.initAdminUsers(globalState.userProfile.rol);
        } else { 
            notify.close(load); 
            notify.error(error?.message); 
        }
    },
    updateUserRole: async (uid, btn) => {
        const rol = btn.closest('tr').querySelector('.role-select').value;
        const load = notify.loading('Guardando...');
        await db.from('perfiles').update({ rol }).eq('id', uid);
        notify.close(load); notify.success('Rol actualizado');
    },
    
    // --- BITÁCORA ---
    logEvent: async (mid, evt, type, val=null) => {
        await db.from('bitacora_industrial').insert({ 
            maquina_id: mid, 
            evento: evt, 
            tipo: type, 
            usuario: globalState.userProfile?.nombre_completo || 'Sys', 
            valor_lectura: val 
        });
    },
    renderReports: async () => {
        const tbody = document.getElementById('reportes-table-body');
        if (!tbody) return;
        try {
            const { data: logs, error } = await db.from('bitacora_industrial').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            if (!logs || logs.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Sin actividad reciente.</td></tr>'; 
                return; 
            }
            tbody.innerHTML = logs.map(l => {
                const color = l.tipo === 'ERROR' ? '#ef4444' : (l.tipo === 'WARNING' ? '#f59e0b' : '#3b82f6');
                return `<tr><td style="color:#666;">${new Date(l.created_at).toLocaleTimeString()}</td><td>${l.maquina_id === 0 ? 'General' : 'M' + l.maquina_id}</td><td><strong>${escapeHtml(l.evento)}</strong></td><td>${escapeHtml(l.usuario)}</td><td><span class="badge" style="background:${color}20; color:${color}">${l.tipo}</span></td></tr>`;
            }).join('');
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:red">Error de conexión: ${e.message}</td></tr>`;
        }
    },

    // --- VENTAS ---
    renderSales: async (filter = 'todos') => {
        const tbody = document.getElementById('ventas-table-body');
        if (!tbody) return;
        try {
            let query = db.from('pedidos').select('*, perfiles(email, nombre_completo)').order('created_at', { ascending: false });
            if (filter === 'pendiente') query = query.eq('estado', 'Pendiente');
            const { data: orders, error } = await query;
            
            if (error) throw error;
            if (!orders || orders.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pedidos.</td></tr>'; 
                return; 
            }
            
            tbody.innerHTML = orders.map(o => {
                let actions = `<button onclick="window.Utils.printReceipt(${o.id})" class="btn-sm btn-light" title="Recibo"><i class="fa-solid fa-print"></i></button> `;
                if (o.estado === 'Pendiente') actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Pagado')" class="btn-sm btn-primary"><i class="fa-solid fa-check"></i></button><button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Cancelado')" class="btn-sm btn-danger"><i class="fa-solid fa-xmark"></i></button>`;
                else if (o.estado === 'Pagado') actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Enviado')" class="btn-sm btn-primary"><i class="fa-solid fa-truck-fast"></i> Enviar</button>`;
                else if (o.estado === 'Enviado') actions += `<button onclick="window.Dashboard.updateOrderStatus(${o.id}, 'Entregado')" class="btn-sm btn-success"><i class="fa-solid fa-box-open"></i> Entregado</button>`;
                
                const pName = o.perfiles?.nombre_completo || 'Usuario Eliminado';
                const pEmail = o.perfiles?.email || 'Sin email';
                return `<tr><td>#${String(o.id).slice(0, 8)}<br><small>${new Date(o.created_at).toLocaleDateString()}</small></td><td>${escapeHtml(pName)}<br><small>${escapeHtml(pEmail)}</small></td><td>${formatCurrency(o.total)}<br><span class="badge">${o.estado}</span></td><td>${actions}</td></tr>`;
            }).join('');
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:red">Error cargando ventas: ${e.message}.</td></tr>`;
        }
    },
    updateOrderStatus: (orderId, newStatus) => {
        confirmModal('Actualizar Pedido', `¿Cambiar estado a ${newStatus}?`, async () => {
            notify.loading('Actualizando...');
            const updates = { estado: newStatus };
            if(newStatus === 'Enviado') updates.tracking_info = { 
                carrier: 'EcoLogistics', 
                tracking_number: 'TRK-' + Date.now().toString().slice(-6), 
                history: [{status: 'Recolectado', date: new Date().toISOString(), completed: true}] 
            };
            await db.from('pedidos').update(updates).eq('id', orderId);
            notify.success(`Pedido actualizado a ${newStatus}`);
            Dashboard.renderSales();
        });
    },
    
    // --- CHAT ---
    switchChatChannel: (channelName) => {
        globalState.currentChannel = channelName;
        document.querySelectorAll('.btn-channel').forEach(btn => btn.classList.remove('active'));
        const btn = document.getElementById(`btn-ch-${channelName}`);
        if(btn) btn.classList.add('active');
        const badge = document.getElementById('current-channel-badge');
        if(badge) badge.textContent = `# ${channelName}`;
        Dashboard.loadChatMessages(channelName);
    },
    loadChatMessages: async (channel) => {
        const list = document.getElementById('chat-messages-area');
        if(!list) return;
        list.innerHTML = '<div style="text-align:center;padding:20px"><i class="fa-solid fa-spinner fa-spin"></i></div>';
        const { data } = await db.from('mensajes').select('*').eq('canal', channel).order('created_at', { ascending: false }).limit(50);
        list.innerHTML = '';
        if(data?.length) { 
            [...data].reverse().forEach(m => Dashboard.renderChatMessage(m, false)); 
            list.scrollTop = list.scrollHeight; 
        } else {
            list.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc">Canal vacío</div>';
        }
    },
    sendMessage: async () => {
        const inp = document.getElementById('chat-input-text');
        if(!inp.value.trim()) return;
        await db.from('mensajes').insert({ 
            mensaje: inp.value, 
            sender: globalState.userProfile.nombre_completo, 
            role: globalState.userProfile.rol, 
            canal: globalState.currentChannel 
        });
        inp.value = '';
    },
    renderChatMessage: (m, anim=true) => {
        if(m.canal !== globalState.currentChannel) return;
        const list = document.getElementById('chat-messages-area');
        if(!list) return;
        if(list.innerHTML.includes('vacío') || list.innerHTML.includes('spinner')) list.innerHTML = '';
        
        const isMe = m.sender === globalState.userProfile?.nombre_completo;
        list.insertAdjacentHTML('beforeend', `
            <div class="msg-item" style="${anim?'animation:fadeIn 0.3s':''} ${isMe?'background:#eff6ff;border-color:#bfdbfe':''}">
                <div class="msg-avatar" style="${isMe?'background:#3b82f6;color:white':''}">${m.sender[0]}</div>
                <div style="flex:1">
                    <strong>${escapeHtml(m.sender)}</strong>
                    <p style="margin:0">${escapeHtml(m.mensaje)}</p>
                </div>
            </div>`
        );
        list.scrollTop = list.scrollHeight;
    }
};