// src/maps.js
// Registro interno para mantener referencias a las instancias de mapas
const mapInstances = {};

export const Maps = {
    /**
     * Inicializa un mapa de Leaflet de forma segura, limpiando instancias previas.
     * @param {string} elementId - ID del contenedor HTML
     * @param {number} lat - Latitud
     * @param {number} lng - Longitud
     * @param {boolean} editable - Si el marcador se puede arrastrar
     */
    init: (elementId, lat = 19.4326, lng = -99.1332, editable = true) => { 
        const el = document.getElementById(elementId);
        if (!el) return; 

        // Verificar si Leaflet está cargado
        if (typeof L === 'undefined') {
            console.warn("Librería Leaflet no cargada. El mapa no se mostrará.");
            el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#666;border-radius:8px;"><i class="fa-solid fa-map-location-dot"></i>&nbsp;Mapa no disponible</div>';
            return;
        }

        // LIMPIEZA PROFUNDA: Si ya existe un mapa en este ID, lo destruimos correctamente
        if (mapInstances[elementId]) {
            mapInstances[elementId].remove();
            delete mapInstances[elementId];
        }
        
        // Limpiar HTML residual por seguridad
        el.innerHTML = '';

        try {
            // Crear nueva instancia
            const map = L.map(elementId).setView([lat, lng], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map);
            
            const marker = L.marker([lat, lng], { draggable: editable }).addTo(map);
            
            if (editable) {
                const updateInputs = (pos) => {
                    const latIn = document.getElementById('profile-lat');
                    const lngIn = document.getElementById('profile-lng');
                    if(latIn) latIn.value = pos.lat.toFixed(6);
                    if(lngIn) lngIn.value = pos.lng.toFixed(6);
                };
                
                // Inicializar inputs con valores actuales
                updateInputs({ lat, lng });

                marker.on('dragend', function(e) {
                    updateInputs(marker.getLatLng());
                });
                
                map.on('click', function(e) {
                    marker.setLatLng(e.latlng);
                    updateInputs(e.latlng);
                });
            }
            
            // Guardar referencia para futura limpieza
            mapInstances[elementId] = map;
            
            // Fix visual para contenedores ocultos (tabs)
            setTimeout(() => {
                map.invalidateSize();
            }, 500);

        } catch (e) {
            console.error("Error crítico al iniciar mapa:", e);
        }
    }
};