/* =============================================
 * ECOTECHSOLUTIONS - MAIN JAVASCRIPT FILE
 * Versión 1.5.1 (Corrección de Pedidos y Perfiles)
 * ============================================= */

/* ===== 1. CONFIGURACIÓN Y CLIENTE SUPABASE ===== */
const SUPABASE_URL = 'https://dtdtqedzfuxfnnipdorg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHRxZWR6ZnV4Zm5uaXBkb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzI4MjYsImV4cCI6MjA3Nzg0ODgyNn0.xMdOs7tr5g8z8X6V65I29R_f3Pib2x1qc-FsjRTHKBY';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Cliente de Supabase conectado.');


/* ===== 2. LÓGICA DE PRODUCTOS (TIENDA E INICIO) ===== */

async function cargarProducto(productoID = 1) {
    console.log(`Intentando cargar producto ID: ${productoID}...`);
    
    const path = window.location.pathname;
    const esPaginaDeProducto = path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/');

    const { data, error } = await db
        .from('productos')
        .select('*')
        .eq('id', productoID) 
        .single();
        
    if (error) { 
        console.error('Error al cargar el producto:', error.message); 
        return null; // Devolver null si falla
    }
    
    if (data && esPaginaDeProducto) {
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
    
    return data; // Devolver los datos del producto
}


/* ===== 3. LÓGICA DE AUTENTICACIÓN Y PERFILES (CLIENTES) ===== */

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

    // Insertar ID, rol y AHORA TAMBIÉN email
    const { error: profileError } = await db
        .from('perfiles')
        .insert({ 
            id: authData.user.id, 
            rol: 'cliente',
            email: authData.user.email // <--- CAMBIO IMPORTANTE
        });
        
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
    console.log("Intentando iniciar sesión de CLIENTE con:", email);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Error en el inicio de sesión de cliente:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión de cliente exitoso:', data.user);
        window.location.href = 'cuenta.html';
    }
}

async function manejarLoginPersonal(e) {
    e.preventDefault();
    const email = document.getElementById('personal-email').value;
    const password = document.getElementById('personal-password').value;
    console.log("Intentando iniciar sesión de PERSONAL con:", email);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Error en el inicio de sesión de personal:', error.message);
        alert('Error: ' + error.message);
    } else {
        console.log('Inicio de sesión de personal exitoso:', data.user);
        window.location.reload(); 
    }
}

async function manejarLogout() {
    const { error } = await db.auth.signOut();
    if (error) console.error('Error al cerrar sesión:', error.message);
    else window.location.href = 'index.html';
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
        .update({ 
            nombre_completo: nombre, 
            telefono: telefono, 
            direccion: direccion,
            email: user.email // Actualizar email también
        })
        .eq('id', user.id);
        
    if (error) {
        console.error('Error actualizando el perfil:', error.message);
        alert('Error al guardar: ' + error.message);
    } else {
        console.log("Perfil actualizado exitosamente.");
        alert('¡Datos guardados con éxito!');
    }
}


/* ===== 4. LÓGICA DEL CARRITO (LOCALSTORAGE) ===== */

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
    alert(`¡${cantidad} paquete(s) añadidos al carrito!`);
}


/* ===== 5. LÓGICA DE CHECKOUT (COMPRA) (ACTUALIZADA) ===== */

async function cargarResumenCheckout() {
    console.log("Cargando resumen de checkout...");
    const carrito = leerCarrito();
    const [productoID, cantidad] = Object.entries(carrito)[0] || [];
    if (!productoID) {
        document.getElementById('checkout-items').innerHTML = "<p>Tu carrito está vacío.</p>";
        return;
    }
    
    const producto = await cargarProducto(productoID); 
    if (!producto) {
         document.getElementById('checkout-items').innerHTML = "<p>Error al cargar el producto.</p>";
         return;
    }

    const subtotal = producto.precio * cantidad;
    const envio = 0; 
    const total = subtotal + envio;
    
    document.getElementById('checkout-items').innerHTML = `
        <p>
            <span>${producto.nombre} (x${cantidad})</span>
            <span>$${subtotal.toLocaleString('es-MX')}</span>
        </p>
    `;
    document.getElementById('checkout-subtotal').textContent = `$${subtotal.toLocaleString('es-MX')}`;
    document.getElementById('checkout-envio').textContent = `$${envio.toLocaleString('es-MX')}`;
    document.getElementById('checkout-total').textContent = `$${total.toLocaleString('es-MX')}`;
}

async function autocompletarDatosEnvio(user) {
    const { data, error } = await db.from('perfiles').select('nombre_completo, telefono, direccion').eq('id', user.id).single();
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
    const { data: { user } } = await db.auth.getUser();

    if (!productoID || !user) {
        alert("Error: Carrito vacío o sesión no encontrada. Por favor, inicia sesión de nuevo.");
        return;
    }
    
    const datosEnvio = {
        nombre: document.getElementById('checkout-name').value,
        direccion: document.getElementById('checkout-address').value,
        telefono: document.getElementById('checkout-phone').value
    };
    
    if (!datosEnvio.nombre || !datosEnvio.direccion) {
        alert("Por favor, completa tu nombre y dirección de envío.");
        return;
    }

    const { data: producto, error: stockError } = await db
        .from('productos')
        .select('nombre, precio, stock_disponible')
        .eq('id', productoID)
        .single();

    if (stockError) { alert("Error al verificar el stock: " + stockError.message); return; }

    const nuevoStock = producto.stock_disponible - cantidad;
    if (nuevoStock < 0) { alert("Error: Stock insuficiente. Alguien compró el producto."); return; }
    
    const total = producto.precio * cantidad;
    const itemsPedido = [{
        id: productoID,
        nombre: producto.nombre,
        cantidad: cantidad,
        precio_unitario: producto.precio
    }];

    // 1. Crear el pedido
    const { error: pedidoError } = await db
        .from('pedidos')
        .insert({
            user_id: user.id,
            items: itemsPedido,
            total: total,
            datos_envio: datosEnvio,
            estado: 'Procesando'
        });

    if (pedidoError) {
        console.error("Error al guardar el pedido:", pedidoError);
        alert("Error al guardar tu pedido: " + pedidoError.message + "\n\n(Asegúrate de que la tabla 'pedidos' y su RLS estén creadas correctamente.)");
        return;
    }
    
    console.log("¡Pedido guardado en la base de datos!");

    // 2. Actualizar el stock (solo si el pedido se creó)
    const { error: updateError } = await db
        .from('productos')
        .update({ stock_disponible: nuevoStock })
        .eq('id', productoID);
        
    if (updateError) { 
        console.error("¡Error CRÍTICO! El pedido se creó pero el stock no se actualizó:", updateError);
        alert("Error al actualizar el inventario. Por favor, contacta a soporte.");
        return; 
    }

    // 3. Éxito
    console.log("¡Compra exitosa! Stock actualizado.");
    guardarCarrito({});
    alert("¡Gracias por tu compra! Tu pedido ha sido procesado.");
    window.location.href = 'index.html';
}


/* ===== 6. LÓGICA DEL PANEL DE PERSONAL (ROLES Y MÁQUINAS) ===== */

function renderAdminBar(adminBar, userRole) {
    let adminHTML = '';
    
    if (userRole === 'Lider' || userRole === 'Sistemas') {
        adminHTML = `
            <h4>Panel de Administrador</h4>
            <a href="admin-personal.html" class="btn btn-secondary"><i class="fa-solid fa-users-cog"></i> Administrar Personal</a>
        `;
    }
    
    if (userRole === 'Sistemas') {
        adminHTML += `
            <a href="#" class="btn btn-secondary disabled"><i class="fa-solid fa-chart-line"></i> Ver Reportes Globales</a>
            <a href="#" class="btn btn-secondary disabled"><i class="fa-solid fa-boxes-stacked"></i> Gestionar Inventario</a>
            <a href="#" class="btn btn-secondary disabled"><i class="fa-solid fa-file-invoice"></i> Ver Pedidos</a>
        `;
    }
    else if (userRole === 'Mecanico') adminHTML = `<h4>Panel de Mecánico</h4>`;
    else if (userRole === 'Supervisor') adminHTML = `<h4>Panel de Supervisor</h4>`;
    else if (userRole === 'Operador') adminHTML = `<h4>Panel de Operador</h4>`;

    if (adminHTML) adminBar.innerHTML = adminHTML;
    adminBar.style.display = adminHTML ? 'flex' : 'none';
}

async function getMaquinas() {
    console.log('🚚 Obteniendo lista de máquinas...');
    const { data, error } = await db.from('maquinas').select('*'); 
    if (error) throw new Error(error.message);
    return data;
}

async function loadAndRenderMaquinas(container, userRole) {
    container.innerHTML = '<p>Cargando máquinas...</p>';
    try {
        const maquinas = await getMaquinas();
        console.log(`✓ ${maquinas.length} máquinas recibidas.`);
        container.innerHTML = ''; 
        if (maquinas.length > 0) {
            maquinas.forEach(maquina => {
                container.insertAdjacentHTML('beforeend', createMachineHTML(maquina, userRole));
            });
            maquinas.forEach(maquina => {
                if (maquina.id === 1 && maquina.controles) {
                    actualizarBotonesParo(maquina.controles.Paro === true);
                }
            });
        } else {
            container.innerHTML = '<p>No hay máquinas asignadas a tu área o disponibles.</p>';
        }
    } catch (error) {
        console.error('❌ Error al obtener/renderizar máquinas:', error);
        container.innerHTML = `<p style="color: red;">Error al cargar máquinas: ${error.message}</p>`;
    }
}

function actualizarBotonesParo(estaEnParo) {
    const controlesCiclo = document.getElementById('controles-ciclo-1');
    const controlesManuales = document.getElementById('controles-manuales-1');
    const controlesReset = document.getElementById('controles-reset-1');

    if (estaEnParo) {
        if (controlesCiclo) controlesCiclo.style.display = 'none';
        if (controlesManuales) controlesManuales.style.display = 'none';
        if (controlesReset) controlesReset.style.display = 'block';
    } else {
        if (controlesCiclo) controlesCiclo.style.display = 'block';
        if (controlesManuales) controlesManuales.style.display = 'block';
        if (controlesReset) controlesReset.style.display = 'none';
    }
}

function createMachineHTML(maquina, userRole) {
    let controlesHTML = '';
    const loteInfo = `<p id="lote-${maquina.id}"><strong>Lote Actual:</strong> ${maquina.lote_actual || 'N/A'}</p>`;
    const canControlThisUser = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);

    if (maquina.id === 1 && maquina.controles) {
        const { online_llenado, online_vaciado, online_arriba, online_abajo } = maquina.controles;
        const fillState = online_llenado ? 'llenado' : (online_vaciado ? 'vaciado' : 'fill-off');
        const trayState = online_arriba ? 'arriba' : (online_abajo ? 'abajo' : 'tray-off');

        if (canControlThisUser) {
            controlesHTML = `
                <div class="controles" id="controles-ciclo-1">
                    <p><strong>Ciclo de Proceso:</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-control" data-command="Inicio" data-value="true" data-maquina-id="1">Iniciar Ciclo</button>
                        <button class="btn btn-danger btn-control" data-command="Paro" data-value="true" data-maquina-id="1">Paro de Emergencia</button>
                    </div>
                </div>
                <div class="controles" id="controles-reset-1" style="display: none;">
                    <p><strong>¡Paro de Emergencia Activo!</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-success btn-control" data-command="Paro" data-value="false" data-maquina-id="1">Restablecer Paro</button>
                    </div>
                </div>
                <div class="controles-manuales" id="controles-manuales-1">
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
                </div>
            `;
        }
    } 
    else if (canControlThisUser) {
        controlesHTML = `<div class="controles"><p>Controles no disponibles para esta máquina.</p></div>`;
    }
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

async function sendPlcCommand(maquinaId, commandName, commandValue, button) {
    let originalText;
    if (button) {
        originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span>';
    }
    
    console.warn(`📡 SIMULACIÓN: Comando: ${commandName} -> ${commandValue} a Máquina ${maquinaId}`);

    const { data: maquina, error: fetchError } = await db
        .from('maquinas')
        .select('controles, estado, lote_actual')
        .eq('id', maquinaId)
        .single();

    if (fetchError) {
        console.error('❌ Error al LEER la máquina antes de actualizar:', fetchError);
        alert('Error al leer la máquina: ' + fetchError.message);
        if (button) { button.disabled = false; button.textContent = originalText; }
        return;
    }

    const newControls = maquina.controles ? { ...maquina.controles } : {};
    const newMaquinaState = {
        estado: maquina.estado,
        lote_actual: maquina.lote_actual
    };

    if (commandName === 'Paro' && commandValue === true) {
        newMaquinaState.estado = 'Detenida';
        newControls['Inicio'] = false;
        newControls['online_llenado'] = false;
        newControls['online_vaciado'] = false;
        newControls['online_arriba'] = false;
        newControls['online_abajo'] = false;
        newControls['Paro'] = true;
    } 
    else if (commandName === 'Paro' && commandValue === false) {
        newControls['Paro'] = false;
    }
    else if (newControls['Paro'] === true) {
         console.warn("Simulación: Paro de Emergencia está activo. Ignorando comando.");
         if (button) { button.disabled = false; button.textContent = originalText; }
         return; 
    }
    else if (commandName === 'Inicio') {
        newMaquinaState.estado = 'En Ciclo';
        newMaquinaState.lote_actual = `LT-${Math.floor(Math.random() * 900) + 100}`;
        newControls['Inicio'] = true;
    }
    else if (commandName === 'online_llenado' && commandValue) {
        newControls['online_llenado'] = true;
        newControls['online_vaciado'] = false;
    }
    else if (commandName === 'online_vaciado' && commandValue) {
        newControls['online_llenado'] = false;
        newControls['online_vaciado'] = true;
    }
    else if (commandName === 'online_arriba' && commandValue) {
        newControls['online_arriba'] = true;
        newControls['online_abajo'] = false;
    }
    else if (commandName === 'online_abajo' && commandValue) {
        newControls['online_arriba'] = false;
        newControls['online_abajo'] = true;
    }
    else if (commandName === 'apagar_llenado_vaciado') {
        newControls['online_llenado'] = false;
        newControls['online_vaciado'] = false;
    }
    else if (commandName === 'apagar_arriba_abajo') {
        newControls['online_arriba'] = false;
        newControls['online_abajo'] = false;
    }
    
    if (commandName === 'Paro') {
        actualizarBotonesParo(commandValue);
    }

    const { error: updateError } = await db.from('maquinas')
        .update({ 
            controles: newControls, 
            estado: newMaquinaState.estado,
            lote_actual: newMaquinaState.lote_actual
        })
        .eq('id', maquinaId);
    
    if (updateError) {
        console.error(`❌ Error al actualizar la máquina (sim):`, updateError);
        alert('Error en simulación: ' + updateError.message);
    }
    
    setTimeout(() => {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }, 1000); 
}


function setupEventListeners(container, userRole) {
    console.log('👂 Configurando event listeners del panel...');
    const canControl = ['Supervisor', 'Mecanico', 'Lider', 'Sistemas'].includes(userRole);
    if (!canControl) return;

    container.addEventListener('click', async (event) => {
        const button = event.target.closest('button.btn-control');
        if (button && !button.disabled) {
            const command = button.dataset.command;
            const value = (button.dataset.value === 'true'); 
            const maquinaId = button.dataset.maquinaId;
            if (command && maquinaId) {
                await sendPlcCommand(maquinaId, command, value, button);
            }
        }
    });

    container.addEventListener('change', async (event) => {
        if (event.target.type === 'radio' && event.target.name.startsWith('switch-')) {
            const radio = event.target;
            const maquinaId = radio.closest('.switch-3-pos').dataset.maquinaId;
            if (!maquinaId) return;
            const commandOn = radio.dataset.commandOn;
            const commandsToTurnOff = radio.dataset.commandsOff?.split(',');
            if (commandOn) {
                await sendPlcCommand(maquinaId, commandOn, true, null);
            } else if (commandsToTurnOff) {
                if (commandsToTurnOff.includes('online_llenado')) await sendPlcCommand(maquinaId, 'apagar_llenado_vaciado', false, null);
                if (commandsToTurnOff.includes('online_arriba')) await sendPlcCommand(maquinaId, 'apagar_arriba_abajo', false, null);
            }
        }
    });
}

function subscribeToChanges(container, userRole, userArea) {
    console.log('📡 Suscribiéndose a cambios en tiempo real para "maquinas"...');
    const channel = db.channel('maquinas-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'maquinas' }, 
            (payload) => {
                console.log('⚡ Cambio recibido:', payload);
                const record = payload.new; 
                if (!record) return;

                const machineElement = document.getElementById(`maquina-${record.id}`);
                const isInArea = (userRole === 'Operador' || userRole === 'Supervisor') ? record.area === userArea : true;
                
                if (payload.eventType === 'DELETE' && machineElement) {
                    machineElement.remove();
                } 
                else if (payload.eventType === 'UPDATE' && machineElement && isInArea) {
                    console.log(`🔄 Actualizando DOM para máquina: ${record.id}`);
                    const statusSpan = document.getElementById(`estado-${record.id}`);
                    if (statusSpan) {
                        statusSpan.textContent = record.estado || 'Desconocido';
                        statusSpan.className = `badge ${record.estado?.toLowerCase() === 'en ciclo' ? 'badge-success' : 'badge-danger'}`;
                    }
                    const loteP = document.getElementById(`lote-${record.id}`);
                    if (loteP) {
                         loteP.innerHTML = record.lote_actual ? `<strong>Lote Actual:</strong> ${record.lote_actual}` : '<strong>Lote Actual:</strong> N/A';
                    }
                    
                    if (record.id === 1 && record.controles) {
                        const { online_llenado, online_vaciado, online_arriba, online_abajo, Paro } = record.controles;
                        
                        actualizarBotonesParo(Paro === true);

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
        console.error('Error obteniendo perfil de personal:', error ? error.message : "Perfil no encontrado");
        panelLoginPrompt.innerHTML = '<p style="color:red;">Error al cargar tu perfil. Contacta a sistemas.</p>';
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


/* ===== 7. GESTOR DE UI GLOBAL (ACTUALIZADO) ===== */
let currentUserProfile = null; // Caché para el perfil del usuario

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
                
                // Listeners para las pestañas
                const btnTabDatos = document.getElementById('btn-tab-datos');
                const btnTabPedidos = document.getElementById('btn-tab-pedidos');
                if(btnTabDatos) btnTabDatos.addEventListener('click', () => manejarTabsCuenta('datos'));
                if(btnTabPedidos) btnTabPedidos.addEventListener('click', () => manejarTabsCuenta('pedidos', session.user.id));
                
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
    
    else if (path.includes('admin-personal.html')) {
        const adminContainer = document.getElementById('admin-personal-container');
        if (session) {
            initializeAdminPersonalPage(session.user);
        } else {
            alert('Acceso denegado. Debes iniciar sesión.');
            window.location.href = 'panel.html';
        }
    }
}


/* ===== 8. LÓGICA DE GESTIÓN DE PERSONAL (NUEVO) ===== */

/**
 * Inicializa la página de admin-personal.html
 */
async function initializeAdminPersonalPage(user) {
    // 1. Obtener el perfil del *administrador* (tú)
    const { data: profile, error } = await db
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        alert('Error al verificar tu permiso.');
        window.location.href = 'panel.html';
        return;
    }
    
    const adminRole = profile.rol;
    
    // 2. Proteger la página
    if (adminRole !== 'Sistemas' && adminRole !== 'Lider') {
        alert('No tienes permiso para ver esta página.');
        window.location.href = 'panel.html';
        return;
    }

    // 3. Si tiene permiso, mostrar el contenido y cargar los datos
    const adminContainer = document.getElementById('admin-personal-container');
    if (adminContainer) adminContainer.style.display = 'block';
    
    const adminBar = document.getElementById('admin-bar');
    if (adminBar) renderAdminBar(adminBar, adminRole);
    
    // Cargar la tabla de usuarios (pasando el ID del admin)
    await loadAllUsersAndProfiles(adminRole, user.id); 
}

/**
 * Carga todos los perfiles y usuarios (Función CORREGIDA)
 */
async function loadAllUsersAndProfiles(adminRole, currentAdminId) {
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = '<tr><td colspan="4">Cargando usuarios...</td></tr>';

    // 1. Llamar a la función RPC que creamos en Supabase
    const { data: perfiles, error: profileError } = await db
        .rpc('get_all_user_profiles'); // <--- Llama a la función SQL
        
    if (profileError) {
        console.error('Error cargando perfiles:', profileError);
        tableBody.innerHTML = '<tr><td colspan="4" style="color:red;">Error al cargar perfiles. (Asegúrate de crear la función RPC `get_all_user_profiles` en el SQL Editor de Supabase)</td></tr>';
        return;
    }
    
    console.log('Perfiles cargados:', perfiles);

    const rolesDisponibles = ['Cliente', 'Operador', 'Supervisor', 'Mecanico', 'Lider', 'Sistemas'];

    tableBody.innerHTML = perfiles.map(p => {
        const esSistemas = p.rol === 'Sistemas';
        const esMiMismoUsuario = p.id === currentAdminId; 
        const noPuedeEditar = (adminRole === 'Lider' && esSistemas);
        
        // --- CORRECCIÓN DE ESTILOS AQUÍ ---
        return `
            <tr data-user-id="${p.id}">
                <td>${p.email || 'Email no encontrado'}</td>
                <td>
                    <div class="input-group" style="margin-bottom: 0;">
                        <select class="input-group" data-field="rol" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>
                            ${rolesDisponibles.map(r => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </td>
                <td>
                    <div class="input-group" style="margin-bottom: 0;">
                        <input type="text" class="input-group" data-field="area" value="${p.area || ''}" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>
                    </div>
                </td>
                <td class="btn-group">
                    <button class="btn btn-primary btn-sm btn-save-user" ${esSistemas || noPuedeEditar ? 'disabled' : ''}>Guardar</button>
                    <button class="btn btn-danger btn-sm btn-delete-user" ${esSistemas || esMiMismoUsuario || adminRole !== 'Sistemas' ? 'disabled' : ''}>Borrar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Añadir listeners a los nuevos botones
    document.querySelectorAll('.btn-save-user').forEach(btn => {
        btn.addEventListener('click', handleUserUpdate);
    });
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', handleUserDelete);
    });
}

/**
 * Maneja el clic en "Guardar" en la tabla de usuarios
 */
async function handleUserUpdate(event) {
    const row = event.target.closest('tr');
    const userId = row.dataset.userId;
    const newRol = row.querySelector('select[data-field="rol"]').value;
    const newArea = row.querySelector('input[data-field="area"]').value;

    console.log(`Actualizando usuario ${userId}: Rol=${newRol}, Área=${newArea}`);
    
    const { error } = await db
        .from('perfiles')
        .update({ rol: newRol, area: newArea })
        .eq('id', userId);
        
    if (error) {
        console.error('Error al actualizar perfil:', error);
        alert('Error al guardar: ' + error.message);
    } else {
        alert('¡Perfil de usuario actualizado!');
    }
}

/**
 * Maneja el clic en "Borrar" en la tabla de usuarios
 */
async function handleUserDelete(event) {
    const row = event.target.closest('tr');
    const userId = row.dataset.userId;
    
    if (!confirm(`¿Estás seguro de que quieres BORRAR a este usuario?\nID: ${userId}\n¡Esta acción es irreversible y borrará sus datos de Auth y Perfil!`)) {
        return;
    }
    
    console.log(`Borrando usuario ${userId}...`);
    
    // Llamar a la función RPC 'delete_user_and_profile'
    const { data, error } = await db.rpc('delete_user_and_profile', {
        user_id_to_delete: userId
    });
    
    if (error) {
        console.error('Error al borrar usuario:', error);
        alert('Error al borrar: ' + error.message + '\n\n(Asegúrate de que la función RPC `delete_user_and_profile` exista y tenga permisos de `SECURITY DEFINER` y que el rol `postgres` tenga permiso de DELETE en `auth.users`.)');
    } else {
        alert(data); // Debería decir "Usuario ... borrado exitosamente"
        row.remove(); // Quitarlo de la tabla
    }
}


/* ===== 9. LÓGICA DE "MIS PEDIDOS" (CLIENTE) ===== */

function manejarTabsCuenta(tab, userId) {
    const seccionDatos = document.getElementById('seccion-mis-datos');
    const seccionPedidos = document.getElementById('seccion-mis-pedidos');
    const btnDatos = document.getElementById('btn-tab-datos');
    const btnPedidos = document.getElementById('btn-tab-pedidos');

    if (tab === 'datos') {
        if (seccionDatos) seccionDatos.style.display = 'block';
        if (seccionPedidos) seccionPedidos.style.display = 'none';
        if (btnDatos) btnDatos.classList.add('active');
        if (btnPedidos) btnPedidos.classList.remove('active');
    } 
    else if (tab === 'pedidos') {
        if (seccionDatos) seccionDatos.style.display = 'none';
        if (seccionPedidos) seccionPedidos.style.display = 'block';
        if (btnDatos) btnDatos.classList.remove('active');
        if (btnPedidos) btnPedidos.classList.add('active');
        // Cargar los pedidos
        cargarMisPedidos(userId);
    }
}

async function cargarMisPedidos(userId) {
    const container = document.getElementById('pedidos-lista-container');
    if (!container) return; // Salir si no estamos en la página correcta
    container.innerHTML = '<p>Cargando tus pedidos...</p>';

    const { data: pedidos, error } = await db
        .from('pedidos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al cargar pedidos:", error);
        container.innerHTML = '<p style="color:red;">No se pudieron cargar tus pedidos.</p>';
        return;
    }
    
    if (pedidos.length === 0) {
        container.innerHTML = '<p>No has realizado ningún pedido todavía.</p>';
        return;
    }

    container.innerHTML = pedidos.map(pedido => {
        const fecha = new Date(pedido.created_at).toLocaleDateString('es-MX');
        // Asegurarse de que 'items' exista y sea un array
        const itemsHtml = (pedido.items && Array.isArray(pedido.items)) 
            ? pedido.items.map(item => `<p>${item.nombre} (x${item.cantidad})</p>`).join('')
            : '<p>Error en items</p>';
        
        return `
            <div class="pedido-card">
                <div class="pedido-header">
                    <span class="pedido-id">Pedido #${pedido.id}</span>
                    <span class="badge badge-warning">${pedido.estado}</span>
                </div>
                <div class="order-info">
                    <span>Fecha:</span>
                    <span class="info-value">${fecha}</span>
                </div>
                <div class="order-info">
                    <span>Items:</span>
                    <div class="info-value">${itemsHtml}</div>
                </div>
                <div class="order-info">
                    <span>Total:</span>
                    <span class="info-value total">$${pedido.total.toLocaleString('es-MX')}</span>
                </div>
            </div>
        `;
    }).join('');
}


/* ===== 10. PUNTO DE ENTRADA (DOMCONTENTLOADED) ===== */

document.addEventListener('DOMContentLoaded', () => {
    
    const carritoActual = leerCarrito();
    actualizarContadorCarrito(carritoActual);
    
    db.auth.getSession().then(({ data: { session } }) => {
        actualizarUI(session); 
    });
    
    const path = window.location.pathname;
    if (path.includes('tienda.html') || path.includes('index.html') || path.endsWith('/ECOTECHSOLUTIONS-WEB/')) {
        cargarProducto();
    }

    // Listeners de auth
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    const formLoginPersonal = document.getElementById('form-login-personal');
    if (formLogin) formLogin.addEventListener('submit', manejarLogin);
    if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);
    if (formLoginPersonal) formLoginPersonal.addEventListener('submit', manejarLoginPersonal); 

    // Listeners de tienda
    const btnCarrito = document.getElementById('btn-anadir-carrito');
    if (btnCarrito) btnCarrito.addEventListener('click', manejarAnadirAlCarrito);
    const formCheckout = document.getElementById('form-checkout');
    if (formCheckout) formCheckout.addEventListener('submit', manejarConfirmarCompra);
});