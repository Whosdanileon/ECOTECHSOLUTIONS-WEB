// src/maps.js
export const Maps = {
    init: (elementId, lat = 19.4326, lng = -99.1332, editable = true) => { 
        const el = document.getElementById(elementId);
        if (!el) return; 

        // Verificar si Leaflet está cargado
        if (typeof L === 'undefined') {
            console.warn("Librería Leaflet no cargada. El mapa no se mostrará.");
            el.innerHTML = '<p style="text-align:center; padding:20px; background:#f8f9fa; color:#666;">Mapa no disponible</p>';
            return;
        }

        // Limpiar instancia previa si existe (para evitar errores de "Map already initialized")
        if (el._leaflet_id) {
            el._leaflet_id = null;
            el.innerHTML = '';
        }

        try {
            const map = L.map(elementId).setView([lat, lng], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                attribution: '© OpenStreetMap' 
            }).addTo(map);
            
            const marker = L.marker([lat, lng], { draggable: editable }).addTo(map);
            
            if (editable) {
                const updateInputs = (pos) => {
                    const latIn = document.getElementById('profile-lat');
                    const lngIn = document.getElementById('profile-lng');
                    if(latIn) latIn.value = pos.lat;
                    if(lngIn) lngIn.value = pos.lng;
                };
                
                marker.on('dragend', function(e) {
                    updateInputs(marker.getLatLng());
                });
                
                map.on('click', function(e) {
                    marker.setLatLng(e.latlng);
                    updateInputs(e.latlng);
                });
            }
            
            // Forzar renderizado correcto
            setTimeout(() => map.invalidateSize(), 500);

        } catch (e) {
            console.error("Error al iniciar mapa:", e);
        }
    }
};