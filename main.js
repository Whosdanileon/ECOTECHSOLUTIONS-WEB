// 1. Configuración del Cliente Supabase
// Pega tu URL y tu Anon Key (pública) aquí
const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

// 2. Crear el cliente
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Cliente de Supabase conectado.');


// --- LÓGICA DE CARGAR PRODUCTOS (FASE 4) ---
async function cargarProducto() {
    console.log("Intentando cargar producto...");
    const PRODUCTO_ID = 1; 

    const { data, error } = await db
        .from('productos')
        .select('*')
        .eq('id', PRODUCTO_ID) 
        .single();
    if (error) { console.error('Error al cargar el producto:', error.message); return; }
    if (data) {
        const producto = data;
        // --- Actualizar la PÁGINA DE TIENDA (`tienda.html`) ---
        const nombreProductoEl = document.getElementById('producto-nombre');
        const precioProductoEl = document.getElementById('producto-precio');
        const stockProductoEl = document.getElementById('producto-stock');
        const layoutTienda = document.querySelector('.shop-layout'); 
        if (nombreProductoEl) nombreProductoEl.textContent = producto.nombre;
        if (precioProductoEl) precioProductoEl.textContent = `$${producto.precio.toLocaleString('es-MX')} MXN`;
        if (stockProductoEl) stockProductoEl.textContent = `${producto.stock_disponible}`;
        if (layoutTienda) {
            layoutTienda.dataset.productId = producto.id;
            layoutTienda.dataset.productStock = producto.stock_disponible;
        }
        // --- Actualizar la PÁGINA DE INICIO (`index.html`) ---
        const nombreIndexEl = document.getElementById('index-producto-nombre');
        const precioIndexEl = document.getElementById('index-producto-precio');
        if(nombreIndexEl) nombreIndexEl.textContent = producto.nombre;
        if(precioIndexEl) precioIndexEl.textContent = `$${producto.precio.toLocaleString('es-MX')}`;
    }
}


// --- LÓGICA DE AUTENTICACIÓN Y PERFILES (FASE 5 y 6) ---

async function manejarRegistro(e) {
    e.preventDefault();
    const email = document.getElementById('registro-email').value;
    const password = document.getElementById('registro-password').value;
    console.log("Intentando registrar con:", email);
    const { data: authData, error: authError } = await db.auth.signUp({ email, password });
    if (authError) {
        console.error('Error en el registro:', authError.message);
        alert('Error: ' + authError.message);
        return;
    }
    console.log('Usuario registrado en Auth:', authData.user);
    const { error: profileError } = await db
        .from('perfiles')
        .insert({ id: authData.user.id, rol: 'cliente' });
    if (profileError) {
        console.error('Error creando el perfil:', profileError.message);
        alert('Error al crear el perfil: ' + profileError.message);
    } else {
        console.log('Perfil creado exitosamente.');
        alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
    }
}

async function manejarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    console.log("Intentando iniciar sesión con:", email);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Error en el inicio de sesión:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión exitoso:', data.user);
        window.location.href = 'cuenta.html';
    }
}

async function manejarLogout() {
    const { error } = await db.auth.signOut();
    if (error) console.error('Error al cerrar sesión:', error.message);
    else window.location.reload();
}

async function cargarDatosPerfil(user) {
    console.log("Cargando datos del perfil para el usuario:", user.id);
    const emailInput = document.getElementById('profile-email');
    if (emailInput) emailInput.value = user.email;

    const { data, error } = await db
        .from('perfiles')
        .select('nombre_completo, telefono, direccion')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error cargando el perfil:', error.message);
    } else if (data) {
        console.log("Perfil encontrado:", data);
        const nameInput = document.getElementById('profile-name');
        const phoneInput = document.getElementById('profile-phone');
        const addressInput = document.getElementById('profile-address');
        if (nameInput) nameInput.value = data.nombre_completo || '';
        if (phoneInput) phoneInput.value = data.telefono || '';
        if (addressInput) addressInput.value = data.direccion || '';
    }
}

async function actualizarPerfil(e, user) {
    e.preventDefault();
    console.log("Actualizando perfil para el usuario:", user.id);
    const nombre = document.getElementById('profile-name').value;
    const telefono = document.getElementById('profile-phone').value;
    const direccion = document.getElementById('profile-address').value;
    const { error } = await db
        .from('perfiles')
        .update({ nombre_completo: nombre, telefono: telefono, direccion: direccion })
        .eq('id', user.id);
    if (error) {
        console.error('Error actualizando el perfil:', error.message);
        alert('Error al guardar: ' + error.message);
    } else {
        console.log("Perfil actualizado exitosamente.");
        alert('¡Datos guardados con éxito!');
    }
}


// --- LÓGICA DEL CARRITO (FASE 7) ---

function leerCarrito() {
    const carritoJSON = localStorage.getItem('carrito');
    return carritoJSON ? JSON.parse(carritoJSON) : {};
}

function guardarCarrito(carrito) {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContadorCarrito(carrito);
}

function actualizarContadorCarrito(carrito) {
    const contadorEl = document.getElementById('carrito-contador');
    let totalItems = 0;
    const cantidades = Object.values(carrito);
    if (cantidades.length > 0) {
        totalItems = cantidades.reduce((sum, current) => sum + current, 0);
    }
    
    if (contadorEl) {
        if (totalItems > 0) {
            contadorEl.textContent = totalItems;
            contadorEl.style.display = 'inline-block';
        } else {
            contadorEl.style.display = 'none';
        }
    }
}

function manejarAnadirAlCarrito() {
    console.log("Botón 'Añadir al Carrito' presionado.");
    const layoutTienda = document.querySelector('.shop-layout');
    const inputCantidad = document.getElementById('cantidad');
    const id = layoutTienda.dataset.productId;
    const stockMaximo = parseInt(layoutTienda.dataset.productStock);
    const cantidad = parseInt(inputCantidad.value);
    if (!id) return alert("Error: No se pudo identificar el producto.");
    if (isNaN(cantidad) || cantidad <= 0) return alert("Por favor, introduce una cantidad válida.");
    if (cantidad > stockMaximo) return alert(`Lo sentimos, solo quedan ${stockMaximo} unidades disponibles.`);
    const carrito = leerCarrito();
    carrito[id] = cantidad;
    guardarCarrito(carrito);
    console.log("Carrito actualizado:", carrito);
    alert(`¡${cantidad} paquete(s) añadidos al carrito!`);
}


// --- LÓGICA DE CHECKOUT (FASE 8) ---

async function cargarResumenCheckout() {
    console.log("Cargando resumen de checkout...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    if (!productoID) {
        console.log("El carrito está vacío.");
        document.getElementById('checkout-items').innerHTML = "<p>Tu carrito está vacío.</p>";
        return;
    }
    const { data: producto, error } = await db
        .from('productos')
        .select('nombre, precio')
        .eq('id', productoID)
        .single();
    if (error) { console.error("Error al buscar precio del producto:", error); return; }
    const subtotal = producto.precio * cantidad;
    const envio = 0;
    const total = subtotal + envio;
    document.getElementById('checkout-items').innerHTML = `<p><span>${producto.nombre} (x${cantidad})</span><span>$${subtotal.toLocaleString('es-MX')}</span></p>`;
    document.getElementById('checkout-subtotal').textContent = `$${subtotal.toLocaleString('es-MX')}`;
    document.getElementById('checkout-envio').textContent = `$${envio.toLocaleString('es-MX')}`;
    document.getElementById('checkout-total').textContent = `$${total.toLocaleString('es-MX')}`;
}

async function autocompletarDatosEnvio(user) {
    const { data, error } = await db
        .from('perfiles')
        .select('nombre_completo, telefono, direccion')
        .eq('id', user.id)
        .single();
    if (error) {
        console.error('Error cargando el perfil para autocompletar:', error.message);
    } else if (data) {
        const nameInput = document.getElementById('checkout-name');
        const addressInput = document.getElementById('checkout-address');
        const phoneInput = document.getElementById('checkout-phone');
        if (nameInput) nameInput.value = data.nombre_completo || '';
        if (addressInput) addressInput.value = data.direccion || '';
        if (phoneInput) phoneInput.value = data.telefono || '';
    }
}

async function manejarConfirmarCompra(e) {
    e.preventDefault();
    console.log("Procesando compra...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    if (!productoID) { alert("Tu carrito está vacío."); return; }
    const { data: producto, error: stockError } = await db
        .from('productos')
        .select('stock_disponible')
        .eq('id', productoID)
        .single();
    if (stockError) { alert("Error al verificar el stock: " + stockError.message); return; }
    const nuevoStock = producto.stock_disponible - cantidad;
    if (nuevoStock < 0) { alert("Error: Stock insuficiente."); return; }
    const { error: updateError } = await db
        .from('productos')
        .update({ stock_disponible: nuevoStock })
        .eq('id', productoID);
    if (updateError) { alert("Error al actualizar el inventario: " + updateError.message); return; }
    console.log("¡Compra exitosa! Stock actualizado.");
    guardarCarrito({});
    alert("¡Gracias por tu compra! Tu pedido ha sido procesado.");
    window.location.href = 'index.html';
}

// --- LÓGICA DEL PANEL DE PERSONAL (FASE 9 - Mejorada) ---

function renderAdminBar(adminBar, userRole) {
    // ... (Tu función renderAdminBar, sin cambios) ...
    let adminHTML = '';
    if (userRole === 'Sistemas') {
        adminHTML = `<h4>Panel de Administración Total (Sistemas)</h4>...`;
    } // ...etc...
    if (adminHTML) adminBar.innerHTML = adminHTML;
    adminBar.style.display = adminHTML ? 'flex' : 'none';
}

/**
 * Helper para obtener máquinas. RLS hará el filtrado.
 */
async function getMaquinas() {
    console.log('🚚 Obteniendo lista de máquinas...');
    // RLS (Paso 5) filtrará esto automáticamente
    const { data, error } = await db.from('maquinas').select('*'); 
    if (error) throw new Error(error.message);
    return data;
}

/**
 * Carga y renderiza las máquinas
 */
async function loadAndRenderMaquinas(container, userRole) {
    container.innerHTML = '<p>Cargando máquinas...</p>';
    try {
        const maquinas = await getMaquinas();
        console.log(`✓ ${maquinas.length} máquinas recibidas.`);
        
        container.innerHTML = ''; // Limpiar
        if (maquinas.length > 0) {
            maquinas.forEach(maquina => {
                container.insertAdjacentHTML('beforeend', createMachineHTML(maquina, userRole));
            });
        } else {
            container.innerHTML = '<p>No hay máquinas asignadas a tu área o disponibles.</p>';
        }
    } catch (error) {
        console.error('❌ Error al obtener/renderizar máquinas:', error);
        container.innerHTML = `<p style="color: red;">Error al cargar máquinas: ${error.message}</p>`;
    }
}

/**
 * Crea el HTML para una sola máquina (MEJORADO)
 * Ahora lee el objeto 'controles' (jsonb)
 */
function createMachineHTML(maquina, userRole) {
    let controlesHTML = '';
    const loteInfo = `<p id="lote-${maquina.id}"><strong>Lote Actual:</strong> ${maquina.lote_actual || 'N/A'}</p>`;
    
    const canControlThisUser = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);

    // --- MEJORA: Lógica de la Lavadora (ID 1) ---
    if (maquina.id === 1 && maquina.controles) {
        // Leemos el estado actual de los controles del JSON
        const { online_llenado, online_vaciado, online_arriba, online_abajo } = maquina.controles;
        
        // Determinamos qué radio button debe estar 'checked'
        const fillState = online_llenado ? 'llenado' : (online_vaciado ? 'vaciado' : 'fill-off');
        const trayState = online_arriba ? 'arriba' : (online_abajo ? 'abajo' : 'tray-off');

        // Solo mostramos controles si el rol lo permite
        if (canControlThisUser) {
            controlesHTML = `
                <div class="controles">
                    <p><strong>Ciclo de Proceso:</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-control" data-command="Inicio" data-value="true" data-maquina-id="1">Iniciar Ciclo</button>
                        <button class="btn btn-danger btn-control" data-command="Paro" data-value="true" data-maquina-id="1">Paro de Emergencia</button>
                    </div>
                </div>
                <div class="controles-detallados">
                    <p><strong>Control Llenado/Vaciado:</strong></p>
                    <div class="switch-3-pos" data-maquina-id="1">
                        <input type="radio" id="llenado-1" name="switch-fill-1" data-command-on="online_llenado" data-command-off="online_vaciado" ${fillState === 'llenado' ? 'checked' : ''}>
                        <label for="llenado-1">Llenado</label>
                        <input type="radio" id="fill-off-1" name="switch-fill-1" data-commands-off="online_llenado,online_vaciado" ${fillState === 'fill-off' ? 'checked' : ''}>
                        <label for="fill-off-1">OFF</label>
                        <input type="radio" id="vaciado-1" name="switch-fill-1" data-command-on="online_vaciado" data-command-off="online_llenado" ${fillState === 'vaciado' ? 'checked' : ''}>
                        <label for="vaciado-1">Vaciado</label>
                    </div>
                </div>
                <div class="controles-detallados">
                    <p><strong>Control de Charola:</strong></p>
                    <div class="switch-3-pos" data-maquina-id="1">
                        <input type="radio" id="arriba-1" name="switch-tray-1" data-command-on="online_arriba" data-command-off="online_abajo" ${trayState === 'arriba' ? 'checked' : ''}>
                        <label for="arriba-1">Arriba</label>
                        <input type="radio" id="tray-off-1" name="switch-tray-1" data-commands-off="online_arriba,online_abajo" ${trayState === 'tray-off' ? 'checked' : ''}>
                        <label for="tray-off-1">OFF</label>
                        <input type="radio" id="abajo-1" name="switch-tray-1" data-command-on="online_abajo" data-command-off="online_arriba" ${trayState === 'abajo' ? 'checked' : ''}>
                        <label for="abajo-1">Abajo</label>
                    </div>
                </div>
            `;
        }
    } 
    // Máquinas 2 y 3 (sin controles aún)
    else if (canControlThisUser) {
        controlesHTML = `<div class="controles"><p>Controles no disponibles para esta máquina.</p></div>`;
    }
    
    // Lógica de Operador (solo ver)
    else if (userRole === 'Operador') {
        controlesHTML = `<div class="controles"><p>Modo de solo lectura.</p></div>`;
    }

    const estadoClass = maquina.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger';

    return `
        <div class="card maquina" id="maquina-${maquina.id}" data-area="${maquina.area}">
            <h3><i class="fa-solid fa-robot"></i> ${maquina.nombre || 'Máquina sin nombre'}</h3>
            <p class="flex-between"><strong>Área:</strong> ${maquina.area || 'N/A'}</p>
            <p class="flex-between"><strong>Estado:</strong> <span class="badge ${estadoClass}" id="estado-${maquina.id}">${maquina.estado || 'Desconocido'}</span></p>
            ${(canControlThisUser || userRole === 'Operador') ? loteInfo : ''} 
            ${controlesHTML}
        </div>`;
}

/**
 * ¡¡SIMULADO!! Envía un comando PLC. (MEJORADO)
 * Ahora actualiza el objeto 'controles' (jsonb) en la base de datos.
 */
async function sendPlcCommand(maquinaId, commandName, commandValue, button) {
    let originalText;
    if (button) {
        originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';
    }
    
    console.warn(`📡 SIMULACIÓN: Enviando comando: ${commandName} -> ${commandValue} a Máquina ${maquinaId}`);

    // --- SIMULACIÓN DE LÓGICA DE PLC ---
    // 1. Prepara el objeto de actualización de estado general
    const updateData = {};
    if (commandName === 'Inicio') {
        updateData['estado'] = 'En Ciclo';
        updateData['lote_actual'] = `LT-${Math.floor(Math.random() * 900) + 100}`;
    }
    if (commandName === 'Paro') {
        updateData['estado'] = 'Detenida';
        updateData['controles.Inicio'] = false; // El paro resetea el 'Inicio' dentro del JSON
    }

    // 2. Prepara la actualización del JSON 'controles'
    // Usamos la sintaxis de punto para actualizar una clave dentro de un JSON
    const controlPath = `controles.${commandName}`;
    updateData[controlPath] = commandValue;
    
    // 3. (Lógica de radio buttons) Si encendemos uno, apagamos el otro
    if (commandName === 'online_llenado' && commandValue) updateData['controles.online_vaciado'] = false;
    if (commandName === 'online_vaciado' && commandValue) updateData['controles.online_llenado'] = false;
    if (commandName === 'online_arriba' && commandValue) updateData['controles.online_abajo'] = false;
    if (commandName === 'online_abajo' && commandValue) updateData['controles.online_arriba'] = false;

    // 4. (Lógica de radio 'OFF') Apagar ambos
    if (commandName === 'apagar_llenado_vaciado') {
        updateData['controles.online_llenado'] = false;
        updateData['controles.online_vaciado'] = false;
    }
    if (commandName === 'apagar_arriba_abajo') {
        updateData['controles.online_arriba'] = false;
        updateData['controles.online_abajo'] = false;
    }
    
    // 5. Enviar la actualización a Supabase
    // Esto disparará el realtime para TODOS los clientes
    const { error } = await db.from('maquinas')
        .update(updateData)
        .eq('id', maquinaId);
    
    if (error) {
        console.error(`❌ Error al actualizar la máquina (sim):`, error);
        alert('Error en simulación: ' + error.message);
    }
    // --- FIN DE SIMULACIÓN ---
    
    setTimeout(() => {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }, 1000); 
}

/**
 * Configura los listeners para los botones del panel (MEJORADO)
 */
function setupEventListeners(container, userRole) {
    console.log('👂 Configurando event listeners del panel...');
    const canControl = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);
    if (!canControl) return;

    // Listener para Botones (Iniciar, Paro)
    container.addEventListener('click', async (event) => {
        const button = event.target.closest('button.btn-control');
        if (button && !button.disabled) {
            const command = button.dataset.command;
            const value = button.dataset.value === 'true'; 
            const maquinaId = button.dataset.maquinaId; // Obtenemos el ID de la máquina
            if (command && maquinaId) {
                await sendPlcCommand(maquinaId, command, value, button);
            }
        }
    });

    // Listener para Radios (Llenado, Vaciado, etc.)
    container.addEventListener('change', async (event) => {
        if (event.target.type === 'radio' && event.target.name.startsWith('switch-')) {
            const radio = event.target;
            const maquinaId = radio.closest('.switch-3-pos').dataset.maquinaId;
            if (!maquinaId) return;

            // Comandos para ON
            const commandOn = radio.dataset.commandOn;
            const commandOff = radio.dataset.commandOff;
            // Comandos para OFF
            const commandsToTurnOff = radio.dataset.commandsOff?.split(',');

            if (commandOn) { // Si es un botón de ON (Llenado, Vaciado, Arriba, Abajo)
                await sendPlcCommand(maquinaId, commandOn, true, null);
                if (commandOff) { // Apaga el opuesto
                    await sendPlcCommand(maquinaId, commandOff, false, null);
                }
            } else if (commandsToTurnOff) { // Si es el botón OFF
                if (commandsToTurnOff.includes('online_llenado')) {
                    await sendPlcCommand(maquinaId, 'apagar_llenado_vaciado', false, null);
                }
                if (commandsToTurnOff.includes('online_arriba')) {
                    await sendPlcCommand(maquinaId, 'apagar_arriba_abajo', false, null);
                }
            }
        }
    });
}

/**
 * Se suscribe a cambios en tiempo real (MEJORADO)
 * Ahora actualiza los radio buttons
 */
function subscribeToChanges(container, userRole, userArea) {
    console.log('📡 Suscribiéndose a cambios en tiempo real para "maquinas"...');
    const channel = db.channel('maquinas-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'maquinas' }, 
            (payload) => {
                console.log('⚡ Cambio recibido:', payload);
                const record = payload.new; // Solo nos importa el nuevo estado
                if (!record) return;

                const machineElement = document.getElementById(`maquina-${record.id}`);
                const isInArea = (userRole === 'Operador' || userRole === 'Supervisor') ? record.area === userArea : true;
                
                if (payload.eventType === 'DELETE' && machineElement) {
                    machineElement.remove();
                } 
                else if (payload.eventType === 'UPDATE' && machineElement && isInArea) {
                    console.log(`🔄 Actualizando DOM para máquina: ${record.id}`);
                    // Actualizar estado
                    const statusSpan = document.getElementById(`estado-${record.id}`);
                    if (statusSpan) {
                        statusSpan.textContent = record.estado || 'Desconocido';
                        statusSpan.className = `badge ${record.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger'}`;
                    }
                    // Actualizar lote
                    const loteP = document.getElementById(`lote-${record.id}`);
                    if (loteP) {
                         loteP.innerHTML = record.lote_actual ? `<strong>Lote Actual:</strong> ${record.lote_actual}` : '';
                    }
                    
                    // --- MEJORA: Actualizar radio buttons en tiempo real ---
                    if (record.id === 1 && record.controles) {
                        const { online_llenado, online_vaciado, online_arriba, online_abajo } = record.controles;
                        
                        // Determinar estado y chequear el radio correcto
                        if (online_llenado) document.getElementById('llenado-1').checked = true;
                        else if (online_vaciado) document.getElementById('vaciado-1').checked = true;
                        else document.getElementById('fill-off-1').checked = true;

                        if (online_arriba) document.getElementById('arriba-1').checked = true;
                        else if (online_abajo) document.getElementById('abajo-1').checked = true;
                        else document.getElementById('tray-off-1').checked = true;
                    }
                } 
                else if (payload.eventType === 'INSERT' && !machineElement && isInArea) {
                    container.insertAdjacentHTML('beforeend', createMachineHTML(record, userRole));
                }
            }
        )
        .subscribe((status, err) => {
             if (status === 'SUBSCRIBED') console.log('✅ Conectado al canal de cambios de máquinas!');
             else console.error(`❌ Error en canal Realtime: ${status}`, err || '');
        });
}

/**
 * Punto de entrada del panel: decide qué mostrar
 */
async function initializePanel(session) {
    const panelLoginPrompt = document.getElementById('panel-login-form');
    const panelContenido = document.getElementById('panel-contenido');
    const headerTitle = document.getElementById('header-title');

    const { data: profile, error } = await db
        .from('perfiles')
        .select('rol, area')
        .eq('id', session.user.id)
        .single();
    
    if (error || !profile) {
        console.error('Error obteniendo perfil de personal:', error);
        panelLoginPrompt.innerHTML = 'Error al cargar tu perfil. Contacta a sistemas.';
        panelLoginPrompt.style.display = 'block';
        return;
    }

    if (profile.rol === 'Cliente') {
        alert('Acceso denegado. Esta área es solo para el personal autorizado.');
        window.location.href = 'index.html'; 
        return;
    }

    console.log(`✓ Perfil de personal obtenido: Rol=${profile.rol}, Área=${profile.area || 'N/A'}`);
    panelLoginPrompt.style.display = 'none';
    panelContenido.style.display = 'block';
    if(headerTitle) headerTitle.textContent = "Panel de Control";

    const { rol, area } = profile;
    const adminBar = document.getElementById('admin-bar');
    const container = document.getElementById('maquinas-container');

    renderAdminBar(adminBar, rol);
    await loadAndRenderMaquinas(container, rol);
    setupEventListeners(container, rol);
    subscribeToChanges(container, rol, area);
}


// --- GESTIÓN DE UI Y EVENTOS (ACTUALIZADA) ---

function actualizarUI(session) {
    const authLinksContainer = document.getElementById('auth-links-container'); 
    const path = window.location.pathname;

    // --- LÓGICA DE HEADER (GLOBAL) ---
    if (session) {
        if (authLinksContainer) {
            authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Mi Cuenta</a>
                <button id="header-logout" class="btn btn-secondary btn-sm">Cerrar Sesión</button>
            `;
            document.getElementById('header-logout').addEventListener('click', manejarLogout);
        }
    } else {
        if (authLinksContainer) {
             authLinksContainer.innerHTML = `
                <a href="cuenta.html" class="nav-link">Iniciar Sesión</a>
                <a href="cuenta.html" class="btn btn-primary btn-sm">Registrarse</a>
            `;
        }
    }

    // --- LÓGICA DE PÁGINA ESPECÍFICA ---
    if (path.includes('cuenta.html')) {
        const authForms = document.getElementById('auth-forms');
        const userInfo = document.getElementById('user-info');
        if (session) {
            if (authForms) authForms.style.display = 'none';
            if (userInfo) {
                userInfo.style.display = 'grid';
                cargarDatosPerfil(session.user);
                document.getElementById('form-perfil').addEventListener('submit', (e) => actualizarPerfil(e, session.user));
                document.getElementById('btn-logout').addEventListener('click', manejarLogout);
            }
        } else {
            if (authForms) authForms.style.display = 'block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
    
    else if (path.includes('checkout.html')) {
        const checkoutLoginPrompt = document.getElementById('checkout-login-prompt');
        const checkoutContainer = document.getElementById('checkout-container');
        if (session) {
            if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'none';
            if (checkoutContainer) {
                checkoutContainer.style.display = 'grid';
                autocompletarDatosEnvio(session.user);
                cargarResumenCheckout();
            }
        } else {
            if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = 'block';
            if (checkoutContainer) checkoutContainer.style.display = 'none';
        }
    }

    else if (path.includes('panel.html')) {
        const panelLoginPrompt = document.getElementById('panel-login-form');
        const panelContenido = document.getElementById('panel-contenido');
        if (session) {
            initializePanel(session);
        } else {
            if (panelLoginPrompt) panelLoginPrompt.style.display = 'block';
            if (panelContenido) panelContenido.style.display = 'none';
        }
    }
}

// --- CÓDIGO QUE SE EJECUTA AL CARGAR LA PÁGINA ---

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Actualizar contador del carrito
    const carritoActual = leerCarrito();
    actualizarContadorCarrito(carritoActual);
    
    // 2. Revisar la sesión de autenticación
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session); // Esta función ahora maneja todo
    });
    
    // 3. Cargar productos
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }

    // 4. Listeners formularios de auth (CLIENTE)
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);
    
    // 5. Listener formulario de auth (PERSONAL)
    const formLoginPersonal = document.getElementById('form-login-personal');
    if (formLoginPersonal) {
        formLoginPersonal.addEventListener('submit', manejarLogin);
    }

    // 6. Listener botón de carrito
    const btnCarrito = document.getElementById('btn-anadir-carrito');
    if (btnCarrito) btnCarrito.addEventListener('click', manejarAnadirAlCarrito);
    
    // 7. Listener para el botón de confirmar compra
    const formCheckout = document.getElementById('form-checkout');
    if (formCheckout) {
        formCheckout.addEventListener('submit', manejarConfirmarCompra);
    }
});