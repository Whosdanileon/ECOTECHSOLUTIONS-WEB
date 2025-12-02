// src/dashboard.js
import { db } from './db.js';
import { CONFIG } from './config.js';
import { globalState } from './state.js';
import { notify, formatCurrency, confirmModal, escapeHtml } from './utils.js';

// --- CONSTANTES DE CONFIGURACIÓN ---
const MACHINE_IDS = {
    MASTER_PLC: 1,
    DEHYDRATOR: 2
};

// --- TELEMETRÍA (Gráficas) ---
export const Telemetry = {
    init: () => {
        const ctx = document.getElementById('tempChart');
        if (!ctx) return;
        if (typeof Chart === 'undefined') return console.warn("Chart.js no cargado.");

        Telemetry.destroy();

        if (!globalState.tempHistory) {
            globalState.tempHistory = Array(20).fill(null);
        }

        try {
            globalState.chartInstance = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: Array(20).fill(''), 
                    datasets: [{ 
                        label: 'Temp (°C)', 
                        data: globalState.tempHistory, 
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
                    scales: { y: { beginAtZero: false, min: 0, max: 100 }, x: { display: false } }, 
                    plugins: { legend: { display: false } } 
                }
            });
        } catch (e) {
            console.error("Error iniciando Chart.js:", e);
        }
    },

    destroy: () => {
        if (globalState.chartInstance) {
            globalState.chartInstance.destroy();
            globalState.chartInstance = null;
        }
    },

    updateFromPayload: (machineId, controls) => {
        if (machineId !== MACHINE_IDS.DEHYDRATOR || !controls) return;
        const newVal = Number(controls.escalda_db);
        if (isNaN(newVal)) return;
        
        globalState.machinePhysics.m2_temp = newVal;
        
        if (!globalState.tempHistory) globalState.tempHistory = Array(20).fill(null);
        globalState.tempHistory.shift(); 
        globalState.tempHistory.push(newVal); 
        
        if (globalState.chartInstance && globalState.chartInstance.ctx) {
            globalState.chartInstance.data.datasets[0].data = globalState.tempHistory;
            globalState.chartInstance.update('none'); 
        }
        
        const kpi = document.getElementById('kpi-temp');
        if (kpi) { 
            kpi.textContent = newVal.toFixed(1) + '°C'; 
            kpi.style.color = newVal > 85 ? '#ef4444' : '#f59e0b'; 
        }
        
        const gauge = document.getElementById('gauge-m2-val');
        const bar = document.getElementById('temp-bar-2');
        
        if (gauge) {
            gauge.innerHTML = `${newVal.toFixed(1)} <span class="gauge-unit">°C</span>`;
        }
        if (bar) { 
            bar.style.width = Math.min(newVal, 100) + '%'; 
            bar.style.background = newVal > 85 ? '#ef4444' : (newVal > 60 ? '#f59e0b' : '#3b82f6'); 
        }
    }
};

// --- VISIÓN (SEGURIDAD REFORZADA) ---
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
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return notify.error('URL inválida: Protocolo requerido (https://).');
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const allowedDomains = ['ngrok-free.app', 'ngrok.io', 'localhost', '127.0.0.1'];
            const isSafe = allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));

            if (!isSafe) {
                return notify.error('⛔ Dominio no autorizado. Use ngrok o localhost.');
            }

        } catch (e) {
            return notify.error('URL con formato incorrecto.');
        }
        
        localStorage.setItem(CONFIG.VISION_URL_KEY, url);
        
        const iframe = document.getElementById('vision-iframe');
        if (iframe) {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            iframe.src = url;
        }
        
        const status = document.getElementById('vision-status');
        if (status) { 
            status.className = 'status-pill on'; 
            status.innerHTML = '<span class="status-pill dot"></span>Conectado'; 
        }
        notify.success('Visión conectada (Modo Seguro)');
    }
};

// --- CONTROL DE MAQUINARIA ---
export const MachineControl = {
    sendCommand: async (id, act) => { 
        if (globalState.isEmergencyActive && act !== 'Paro') return notify.error("⛔ EMERGENCIA ACTIVA: Restablezca primero."); 
        try {
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
            let c = data.controles || {}; 
            
            if (act === 'Inicio') { c.Inicio = true; c.Paro = false; } 
            else { c.Inicio = false; c.Paro = true; c.online_llenado = false; c.online_vaciado = false; } 
            
            await db.from('maquinas').update({ controles: c, estado: act === 'Inicio' ? 'En Ciclo' : 'Detenida' }).eq('id', id); 
            Dashboard.logEvent(id, act, 'INFO');
        } catch (e) { notify.error('Error PLC: Verifique conexión'); }
    },

    toggleSwitch: async (id, key) => { 
        if (globalState.isEmergencyActive && !key.includes('off')) return notify.error("⛔ EMERGENCIA ACTIVA"); 
        try {
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single(); 
            let c = data.controles || {}; 
            
            if (id === MACHINE_IDS.MASTER_PLC) { 
                if (key.includes('llenado')) { c.online_llenado = true; c.online_vaciado = false; } 
                else if (key.includes('vaciado')) { c.online_vaciado = true; c.online_llenado = false; } 
                else if (key.includes('fill_off')) { c.online_llenado = false; c.online_vaciado = false; }
                else if (key.includes('arriba')) { c.online_arriba = true; c.online_abajo = false; }
                else if (key.includes('abajo')) { c.online_abajo = true; c.online_arriba = false; }
                else if (key.includes('tray_off')) { c.online_arriba = false; c.online_abajo = false; }
            } 
            
            await db.from('maquinas').update({ controles: c }).eq('id', id); 
            Dashboard.logEvent(id, `Switch ${key}`, 'INFO');
        } catch (e) { notify.error('Error switch PLC'); }
    },

    sendPulse: async (id, key, btn) => {
        if (globalState.isEmergencyActive && !key.includes('stop')) return notify.error("⛔ EMERGENCIA ACTIVA");
        
        const originalContent = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        try {
            const { data } = await db.from('maquinas').select('controles').eq('id', id).single();
            let c = data.controles || {};
            c[key] = true; 
            if (key === 'stop_cycle') c['start_cycle'] = false;

            await db.from('maquinas').update({ controles: c }).eq('id', id);
            const label = key === 'stop_cycle' ? 'DETENER' : 'INICIAR';
            Dashboard.logEvent(id, `Pulso ${label}`, 'INFO');

            await new Promise(resolve => setTimeout(resolve, 800));

            const { data: newData } = await db.from('maquinas').select('controles').eq('id', id).single();
            let cNew = newData.controles || {};
            cNew[key] = false;
            
            await db.from('maquinas').update({ controles: cNew }).eq('id', id);
            
            if (key === 'stop_cycle') notify.success('Ciclo detenido');
            else notify.success('Ciclo iniciado');

        } catch (e) {
            notify.error('Error pulso PLC');
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        }
    },

    toggleEmergency: () => {
        if (!globalState.isEmergencyActive) { 
            confirmModal('PARO DE EMERGENCIA', '¿Detener TODO el sistema?', async () => { 
                const btn = document.getElementById('btn-global-stop'); 
                if(btn) btn.disabled = true;

                await MachineControl.sendCommand(MACHINE_IDS.MASTER_PLC, 'Paro'); 
                await db.from('maquinas').update({ controles: { start_cycle: false, stop_cycle: true, calentador_on: false } }).eq('id', MACHINE_IDS.DEHYDRATOR);
                
                Dashboard.logEvent(0, 'PARO GLOBAL', 'ERROR');
                if(btn) btn.disabled = false;
            }, 'btn-primary-modal-danger', 'PARAR'); 
        } else { 
            confirmModal('Restablecer Sistema', '¿Confirmas que es seguro reactivar?', async () => { 
                await db.from('maquinas').update({ controles: { Paro: false }, estado: 'Lista' }).eq('id', MACHINE_IDS.MASTER_PLC);
                await db.from('maquinas').update({ controles: { stop_cycle: false } }).eq('id', MACHINE_IDS.DEHYDRATOR);
                
                Dashboard.logEvent(0, 'Restablecimiento', 'INFO');
            }, 'btn-secondary-modal', 'OK'); 
        } 
    }
};

// --- HELPER PARA DOM ---
const el = (tag, classes = '', text = '', parent = null) => {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (text) element.textContent = text;
    if (parent) parent.appendChild(element);
    return element;
};

// --- RENDERIZADORES ESPECÍFICOS ---
const MachineRenderers = {
    [MACHINE_IDS.MASTER_PLC]: (m, body, isAdmin) => {
        const area = el('div', 'm-area', '', body);
        area.innerHTML = '<i class="fa-solid fa-microchip"></i> PLC M1 (Maestro)';

        if (!isAdmin) return el('p', 'text-muted', 'Modo Visualización', body);

        const interfaceDiv = el('div', 'machine-interface', '', body);
        const actions = el('div', 'action-buttons', '', interfaceDiv);
        
        const btnStart = el('button', `btn-action btn-start ${m.controles.Inicio ? 'active' : ''}`, '', actions);
        btnStart.innerHTML = '<i class="fa-solid fa-play"></i> INICIAR';
        btnStart.onclick = () => MachineControl.sendCommand(m.id, 'Inicio');

        const btnStop = el('button', 'btn-action btn-stop', '', actions);
        btnStop.innerHTML = '<i class="fa-solid fa-stop"></i> PARO';
        btnStop.onclick = () => MachineControl.sendCommand(m.id, 'Paro');

        const createSegmented = (label, name, options) => {
            const group = el('div', 'control-group', '', interfaceDiv);
            if(name === 'ch') group.style.marginBottom = '0';
            el('span', 'control-label', label, group);
            const seg = el('div', 'segmented-control', '', group);
            
            options.forEach(opt => {
                const optDiv = el('div', 'segmented-option', '', seg);
                const input = el('input', '', '', optDiv);
                input.type = 'radio';
                input.name = name;
                input.id = `m1_${name}_${opt.id}`;
                input.checked = opt.checked;
                input.onclick = () => MachineControl.toggleSwitch(m.id, opt.action);
                
                const lbl = el('label', '', opt.label, optDiv);
                lbl.htmlFor = input.id;
            });
        };

        createSegmented('Tanque', 'tk', [
            { id: 'fill', label: 'Llenado', action: 'online_llenado', checked: m.controles.online_llenado },
            { id: 'off', label: 'OFF', action: 'fill_off', checked: (!m.controles.online_llenado && !m.controles.online_vaciado) },
            { id: 'vac', label: 'Vaciado', action: 'online_vaciado', checked: m.controles.online_vaciado }
        ]);

        createSegmented('Control Elevador', 'ch', [
            { id: 'up', label: 'Arriba', action: 'online_arriba', checked: m.controles.online_arriba },
            { id: 'off', label: 'Freno', action: 'tray_off', checked: (!m.controles.online_arriba && !m.controles.online_abajo) },
            { id: 'dn', label: 'Abajo', action: 'online_abajo', checked: m.controles.online_abajo }
        ]);
    },

    [MACHINE_IDS.DEHYDRATOR]: (m, body, isAdmin) => {
        const temp = globalState.machinePhysics.m2_temp || Number(m.controles.escalda_db) || 0;
        
        const gauge = el('div', 'clean-gauge', '', body);
        const readout = el('div', 'gauge-readout', '', gauge);
        readout.id = 'gauge-m2-val';
        readout.innerHTML = `${temp.toFixed(1)}<span class="gauge-unit">°C</span>`;

        const barBg = el('div', 'gauge-bar-bg', '', gauge);
        const barFill = el('div', 'gauge-bar-fill', '', barBg);
        barFill.id = 'temp-bar-2';
        barFill.style.width = Math.min(temp, 100) + '%';
        barFill.style.background = temp > 85 ? '#ef4444' : '#3b82f6';

        if (!isAdmin) return;

        const interfaceDiv = el('div', 'machine-interface', '', body);
        interfaceDiv.style.marginTop = '25px';
        
        const label = el('span', 'control-label', 'Ciclo Automático', interfaceDiv);
        label.style.cssText = 'display:block; text-align:center; margin-bottom:12px;';

        const btnGrid = el('div', '', '', interfaceDiv);
        btnGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';

        const btnStart = el('button', 'btn-action', '', btnGrid);
        btnStart.id = 'btn-m2-start';
        btnStart.style.cssText = 'background:#f59e0b; color:white; justify-content:center; border:none; box-shadow:0 4px 6px rgba(245, 158, 11, 0.3);';
        btnStart.innerHTML = '<i class="fa-solid fa-play"></i> INICIAR';
        btnStart.onclick = function() { MachineControl.sendPulse(m.id, 'start_cycle', this); };

        const btnStop = el('button', 'btn-action', '', btnGrid);
        btnStop.id = 'btn-m2-stop';
        btnStop.style.cssText = 'background:#ef4444; color:white; justify-content:center; border:none; box-shadow:0 4px 6px rgba(239, 68, 68, 0.3);';
        btnStop.innerHTML = '<i class="fa-solid fa-stop"></i> DETENER';
        btnStop.onclick = function() { MachineControl.sendPulse(m.id, 'stop_cycle', this); };
    }
};

// --- DASHBOARD (PRINCIPAL) ---
export const Dashboard = {
    renderMachines: async (userRole) => {
        const container = document.getElementById('maquinas-container');
        if (!container) return;
        
        const { data } = await db.from('maquinas').select('*').order('id');
        if (!data) return;

        const masterMachine = data.find(m => m.id === MACHINE_IDS.MASTER_PLC);
        const dbEmergencyState = masterMachine?.controles?.Paro === true;
        const btnEmergency = document.getElementById('btn-global-stop');

        if (dbEmergencyState) {
            if (!globalState.isEmergencyActive) {
                globalState.isEmergencyActive = true;
                document.body.classList.add('emergency-mode');
                if(btnEmergency) {
                    btnEmergency.classList.add('active');
                    btnEmergency.textContent = 'RESTABLECER SISTEMA';
                }
            }
        } else if (globalState.isEmergencyActive) {
            globalState.isEmergencyActive = false;
            document.body.classList.remove('emergency-mode');
            if(btnEmergency) {
                btnEmergency.classList.remove('active');
                btnEmergency.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PARO DE EMERGENCIA';
            }
        }

        container.innerHTML = '';
        const isAdmin = CONFIG.ROLES.ADMIN.includes(userRole);
        const anyMachineOnline = data.some(m => m.online === true);
        const statusEl = document.getElementById('global-plc-status');
        
        if (statusEl) {
            statusEl.className = anyMachineOnline ? 'status-indicator online' : 'status-indicator';
            statusEl.innerHTML = `<span class="dot" style="background:${anyMachineOnline ? '#10b981' : '#ef4444'}"></span> ${anyMachineOnline ? 'SISTEMA ONLINE' : 'SIN CONEXIÓN PLC'}`;
            statusEl.style.borderColor = anyMachineOnline ? '#bbf7d0' : '#fee2e2';
            statusEl.style.color = anyMachineOnline ? '#166534' : '#991b1b';
            statusEl.style.background = anyMachineOnline ? '#dcfce7' : '#fef2f2';
        }

        data.forEach(m => {
            const card = el('div', 'card machine-card', '', container);
            const header = el('div', 'm-header', '', card);
            el('h4', '', m.nombre, header);
            
            const pill = el('div', `status-pill ${m.estado === 'En Ciclo' ? 'on' : 'off'}`, '', header);
            el('span', 'status-pill dot', '', pill);
            pill.appendChild(document.createTextNode(m.estado));

            const body = el('div', 'm-body', '', card);

            if (!m.online) {
                const offDiv = el('div', '', '', body);
                offDiv.style.cssText = 'background:#fee2e2; color:#991b1b; padding:5px; font-size:0.7rem; text-align:center; border-radius:4px; margin-bottom:10px;';
                offDiv.innerHTML = '<i class="fa-solid fa-plug-circle-xmark"></i> DESCONECTADO';
            }

            if (MachineRenderers[m.id]) {
                MachineRenderers[m.id](m, body, isAdmin);
            } else {
                el('p', 'text-muted', 'Dispositivo no reconocido', body);
            }
        });
    },
    
    // --- USUARIOS, BITÁCORA Y VENTAS ---
    initAdminUsers: async (myRole) => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        try {
            const { data, error } = await db.from('perfiles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data) return;

            data.forEach(u => {
                const tr = el('tr', '', '', tbody);
                tr.dataset.uid = u.id;
                
                const tdName = el('td', '', '', tr);
                el('strong', '', escapeHtml(u.nombre_completo), tdName);
                el('br', '', '', tdName);
                el('small', '', escapeHtml(u.email), tdName);

                const tdRole = el('td', '', '', tr);
                const select = el('select', 'form-input role-select', '', tdRole);
                ['Sistemas', 'Lider', 'Supervisor', 'Mecanico', 'Operador', 'Cliente'].forEach(r => {
                    const opt = el('option', '', r, select);
                    opt.value = r;
                    if (u.rol === r) opt.selected = true;
                });
                if (u.id === globalState.userProfile?.id) select.disabled = true;

                el('td', '', escapeHtml(u.area || '-'), tr);

                const tdAction = el('td', '', '', tr);
                
                const btnSave = el('button', 'btn-icon btn-save', '', tdAction);
                btnSave.innerHTML = '<i class="fa-solid fa-save"></i>';
                btnSave.title = "Guardar Rol";
                btnSave.onclick = function() { Dashboard.updateUserRole(u.id, this); };

                const btnDelete = el('button', 'btn-icon btn-delete', '', tdAction);
                btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                btnDelete.title = "Eliminar Usuario";
                btnDelete.style.marginLeft = "8px";
                btnDelete.style.color = "#ef4444";
                btnDelete.onclick = function() { Dashboard.deleteUser(u.id); };

                if (u.id === globalState.userProfile?.id) {
                    btnSave.disabled = true;
                    btnDelete.disabled = true;
                    btnDelete.style.opacity = "0.5";
                }
            });

            const form = document.getElementById('form-create-employee');
            if(form) form.onsubmit = Dashboard.createEmployee;

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:red">Error: ${e.message}</td></tr>`;
        }
    },

    openCreateUserModal: () => {
        const modal = document.getElementById('modal-create-user');
        if(modal) modal.style.display = 'flex';
    },

    createEmployee: async (e) => {
        e.preventDefault();
        
        if (typeof supabase === 'undefined') return notify.error("Librería crítica no cargada");
        const load = notify.loading('Creando empleado...');
        
        try {
            const tempClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });
            
            const { data, error } = await tempClient.auth.signUp({ 
                email: document.getElementById('new-user-email').value, 
                password: document.getElementById('new-user-pass').value 
            });
            
            if (error) throw error;
            
            if (data.user) {
                const { error: profileError } = await db.from('perfiles').upsert([{ 
                    id: data.user.id, 
                    email: data.user.email, 
                    nombre_completo: document.getElementById('new-user-name').value, 
                    rol: document.getElementById('new-user-role').value, 
                    area: document.getElementById('new-user-dept').value,
                    created_at: new Date()
                }]);
                
                if (profileError) throw profileError;
                
                notify.close(load); 
                notify.success('Empleado creado correctamente'); 
                document.getElementById('modal-create-user').style.display = 'none'; 
                Dashboard.initAdminUsers(globalState.userProfile.rol);
                document.getElementById('form-create-employee').reset();
            }
        } catch (err) {
            notify.close(load); 
            notify.error(err.message || "Error al crear empleado");
        }
    },

    updateUserRole: async (uid, btn) => {
        const tr = btn.closest('tr');
        const rol = tr.querySelector('.role-select').value;
        const load = notify.loading('Guardando...');
        try {
            const { error } = await db.from('perfiles').update({ rol }).eq('id', uid);
            notify.close(load); 
            if(error) throw error;
            notify.success('Rol actualizado');
        } catch(e) {
            notify.close(load);
            notify.error('Error actualizando rol');
        }
    },

    deleteUser: async (uid) => {
        confirmModal('Eliminar Usuario', '¿Estás seguro? Esta acción eliminará el perfil y revocará el acceso inmediatamente.', async () => {
            const load = notify.loading('Eliminando...');
            try {
                const { error } = await db.from('perfiles').delete().eq('id', uid);
                
                if (error) throw error;
                
                notify.close(load);
                notify.success('Usuario eliminado');
                Dashboard.initAdminUsers(globalState.userProfile.rol);
            } catch (e) {
                notify.close(load);
                notify.error('Error al eliminar: ' + e.message);
            }
        });
    },
    
    // --- NUEVA LÓGICA DE REPORTES (MODAL DINÁMICO MEJORADO) ---
    reportIncident: async () => {
        // 1. Obtener staff desde la DB en tiempo real
        const load = notify.loading('Cargando datos...');
        let staffOptions = '<option value="">Seleccione personal...</option>';
        
        try {
            const { data: users, error } = await db.from('perfiles').select('id, nombre_completo, rol');
            if (error) throw error;
            
            // FILTRO: Solo mostrar roles de Staff (excluyendo clientes)
            const staff = users.filter(u => CONFIG.ROLES.STAFF.includes(u.rol));
            
            staff.forEach(u => {
                staffOptions += `<option value="${escapeHtml(u.nombre_completo)}">${escapeHtml(u.nombre_completo)} (${u.rol})</option>`;
            });

        } catch (e) {
            console.error(e);
            notify.error('Error cargando lista de personal');
            notify.close(load);
            return; 
        }
        notify.close(load);

        // 2. Limpiar modal anterior para asegurar datos frescos
        const existingModal = document.getElementById('modal-report-incident');
        if (existingModal) existingModal.remove();

        // 3. Crear Modal con las opciones solicitadas
        const modalHTML = `
            <div id="modal-report-incident" class="modal-overlay" style="display:none; justify-content:center; align-items:center;">
              <div class="modal-content" style="background:white; padding:2rem; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0;">Reportar Incidente</h3>
                <p style="color:#666; font-size:0.9rem; margin-bottom:1.5rem;">Registra un evento anómalo en la bitácora.</p>
                <form id="form-report-incident">
                  <div class="input-group">
                    <label>Área del Incidente</label>
                    <select id="report-area" class="form-input" required>
                        <option value="">Seleccione área...</option>
                        <option value="Lavado">Lavado</option>
                        <option value="Deshidratado">Deshidratado</option>
                        <option value="Empaquetado">Empaquetado</option>
                    </select>
                  </div>
                  <div class="input-group">
                    <label>Tipo de Reporte</label>
                    <select id="report-type" class="form-input" onchange="Dashboard.toggleReportTarget(this.value)">
                       <option value="general">General / Otro</option>
                       <option value="machine">Falla de Maquinaria</option>
                       <option value="person">Reporte de Personal</option>
                    </select>
                  </div>
                  
                  <div class="input-group" id="group-target-machine" style="display:none;">
                    <label>Máquina Afectada</label>
                    <select id="report-machine-id" class="form-input">
                       <option value="1">M1 - PLC Maestro</option>
                       <option value="2">M2 - Deshidratadora</option>
                    </select>
                  </div>

                  <div class="input-group" id="group-target-person" style="display:none;">
                    <label>Personal Involucrado</label>
                    <select id="report-person-name" class="form-input">
                        ${staffOptions}
                    </select>
                  </div>

                  <div class="input-group">
                    <label>Descripción Detallada</label>
                    <textarea id="report-desc" class="form-input" rows="3" required placeholder="Describe qué sucedió..."></textarea>
                  </div>

                  <div style="text-align:right; margin-top:1.5rem; display:flex; gap:10px; justify-content:flex-end;">
                     <button type="button" class="btn btn-light" onclick="document.getElementById('modal-report-incident').style.display='none'">Cancelar</button>
                     <button type="submit" class="btn btn-danger">Enviar Reporte</button>
                  </div>
                </form>
              </div>
            </div>`;
            
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 4. Bindear eventos
        document.getElementById('form-report-incident').onsubmit = Dashboard.submitReport;
        
        // 5. Mostrar
        document.getElementById('modal-report-incident').style.display = 'flex';
        Dashboard.toggleReportTarget('general');
    },

    toggleReportTarget: (val) => {
        const machineGroup = document.getElementById('group-target-machine');
        const personGroup = document.getElementById('group-target-person');
        const personInput = document.getElementById('report-person-name');

        if (val === 'machine') {
            machineGroup.style.display = 'block';
            personGroup.style.display = 'none';
            personInput.required = false;
        } else if (val === 'person') {
            machineGroup.style.display = 'none';
            personGroup.style.display = 'block';
            personInput.required = true;
        } else {
            machineGroup.style.display = 'none';
            personGroup.style.display = 'none';
            personInput.required = false;
        }
    },

    submitReport: async (e) => {
        e.preventDefault();
        const modal = document.getElementById('modal-report-incident');
        const area = document.getElementById('report-area').value;
        const type = document.getElementById('report-type').value;
        const desc = document.getElementById('report-desc').value;
        let machineId = 0;

        // Construir mensaje detallado
        let targetInfo = "";
        if (type === 'machine') {
            machineId = document.getElementById('report-machine-id').value;
            targetInfo = `[MAQUINA: M${machineId}]`;
        } else if (type === 'person') {
            const name = document.getElementById('report-person-name').value;
            targetInfo = `[REPORTADO: ${name}]`;
        } else {
            targetInfo = "[GENERAL]";
        }

        const fullEventString = `REPORTE MANUAL | ÁREA: ${area} ${targetInfo} | ${desc}`;

        const load = notify.loading('Registrando reporte...');
        
        try {
            const { error } = await db.from('bitacora_industrial').insert({
                maquina_id: machineId,
                evento: fullEventString,
                tipo: 'ERROR',
                usuario: globalState.userProfile?.nombre_completo || 'Operador',
                valor_lectura: null
            });

            if (error) throw error;

            notify.close(load);
            notify.success('Falla reportada correctamente');
            modal.style.display = 'none';
            Dashboard.renderReports(); 
        } catch (err) {
            notify.close(load);
            notify.error('Error al reportar: ' + err.message);
        }
    },

    logEvent: async (mid, evt, type, val=null) => {
        db.from('bitacora_industrial').insert({ 
            maquina_id: mid, 
            evento: evt, 
            tipo: type, 
            usuario: globalState.userProfile?.nombre_completo || 'Sys', 
            valor_lectura: val 
        }).then(({error}) => { if(error) console.error("Error logging:", error); });
    },

    renderReports: async () => {
        const tbody = document.getElementById('reportes-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Actualizando...</td></tr>';
        
        try {
            const { data: logs, error } = await db.from('bitacora_industrial').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            
            if (!logs || logs.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Sin actividad reciente.</td></tr>'; 
                return; 
            }
            
            tbody.innerHTML = '';
            
            logs.forEach(l => {
                const tr = el('tr', '', '', tbody);
                const tdTime = el('td', '', new Date(l.created_at).toLocaleTimeString(), tr);
                tdTime.style.color = '#666';
                el('td', '', l.maquina_id == 0 ? 'General' : 'M' + l.maquina_id, tr); 
                
                const tdEvt = el('td', '', '', tr);
                el('strong', '', escapeHtml(l.evento), tdEvt);
                
                el('td', '', escapeHtml(l.usuario), tr);
                const tdType = el('td', '', '', tr);
                const badge = el('span', 'badge', l.tipo, tdType);
                const color = l.tipo === 'ERROR' ? '#ef4444' : (l.tipo === 'WARNING' ? '#f59e0b' : '#3b82f6');
                badge.style.background = color + '20';
                badge.style.color = color;
            });

            notify.success('Bitácora actualizada');

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:red">Error: ${e.message}</td></tr>`;
        }
    },

    renderSales: async (filter = 'todos') => {
        const tbody = document.getElementById('ventas-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        try {
            let query = db.from('pedidos').select('*, perfiles(email, nombre_completo)').order('created_at', { ascending: false });
            if (filter === 'pendiente') query = query.eq('estado', 'Pendiente');
            const { data: orders, error } = await query;
            if (error) throw error;
            if (!orders || orders.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pedidos.</td></tr>'; return; 
            }
            orders.forEach(o => {
                const tr = el('tr', '', '', tbody);
                const tdId = el('td', '', '', tr);
                tdId.innerHTML = `#${String(o.id).slice(0, 8)}<br><small>${new Date(o.created_at).toLocaleDateString()}</small>`;
                const tdUser = el('td', '', '', tr);
                tdUser.innerHTML = `${escapeHtml(o.perfiles?.nombre_completo || 'Eliminado')}<br><small>${escapeHtml(o.perfiles?.email || 'N/A')}</small>`;
                const tdTotal = el('td', '', '', tr);
                tdTotal.innerHTML = `${formatCurrency(o.total)}<br><span class="badge">${o.estado}</span>`;
                
                const tdActions = el('td', '', '', tr);
                const btnPrint = el('button', 'btn-sm btn-light', '', tdActions);
                btnPrint.innerHTML = '<i class="fa-solid fa-print"></i>';
                btnPrint.onclick = () => window.Utils.printReceipt(o.id);
                
                if (o.estado === 'Pendiente') {
                    const btnPay = el('button', 'btn-sm btn-primary', '', tdActions);
                    btnPay.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btnPay.style.marginLeft = '5px';
                    btnPay.onclick = () => Dashboard.updateOrderStatus(o.id, 'Pagado');
                    const btnCancel = el('button', 'btn-sm btn-danger', '', tdActions);
                    btnCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                    btnCancel.style.marginLeft = '5px';
                    btnCancel.onclick = () => Dashboard.updateOrderStatus(o.id, 'Cancelado');
                } else if (o.estado === 'Pagado') {
                    const btnShip = el('button', 'btn-sm btn-primary', '', tdActions);
                    btnShip.innerHTML = '<i class="fa-solid fa-truck-fast"></i> Enviar';
                    btnShip.style.marginLeft = '5px';
                    btnShip.onclick = () => Dashboard.updateOrderStatus(o.id, 'Enviado');
                } else if (o.estado === 'Enviado') {
                    const btnDlvr = el('button', 'btn-sm btn-success', '', tdActions);
                    btnDlvr.innerHTML = '<i class="fa-solid fa-box-open"></i> Entregado';
                    btnDlvr.style.marginLeft = '5px';
                    btnDlvr.onclick = () => Dashboard.updateOrderStatus(o.id, 'Entregado');
                }
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:red">Error: ${e.message}</td></tr>`;
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
        
        try {
            const { error } = await db.from('mensajes').insert({ 
                mensaje: inp.value, 
                sender: globalState.userProfile.nombre_completo, 
                role: globalState.userProfile.rol, 
                canal: globalState.currentChannel 
            });
            if(error) throw error;
            inp.value = '';
        } catch(e) {
            notify.error('Error enviando mensaje');
        }
    },

    renderChatMessage: (m, anim=true) => {
        if(m.canal !== globalState.currentChannel) return;
        const list = document.getElementById('chat-messages-area');
        if(!list) return;
        if(list.innerHTML.includes('vacío') || list.innerHTML.includes('spinner')) list.innerHTML = '';
        
        const isMe = m.sender === globalState.userProfile?.nombre_completo;
        const item = el('div', 'msg-item', '', list);
        if (anim) item.style.animation = 'fadeIn 0.3s';
        if (isMe) {
            item.style.background = '#eff6ff';
            item.style.borderColor = '#bfdbfe';
        }
        const avatar = el('div', 'msg-avatar', m.sender[0], item);
        if (isMe) {
            avatar.style.background = '#3b82f6';
            avatar.style.color = 'white';
        }
        const content = el('div', '', '', item);
        content.style.flex = '1';
        el('strong', '', m.sender, content);
        const p = el('p', '', m.mensaje, content);
        p.style.margin = '0';
        list.scrollTop = list.scrollHeight;
    }
};