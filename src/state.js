// src/state.js

/**
 * SISTEMA DE ESTADO REACTIVO (PROXY PATTERN)
 * * Este módulo convierte el estado global en un objeto observable.
 * Cualquier cambio en las propiedades de 'globalState' notificará automáticamente
 * a los suscriptores, permitiendo una UI reactiva sin frameworks pesados.
 */

// Estado inicial privado
const internalState = {
    userProfile: null,       // Datos del usuario logueado
    realtimeSubscription: null, // Suscripción a cambios en DB
    tempWalletData: null,    // Datos temporales de tarjeta
    currentChannel: 'General', // Canal de chat activo
    
    // Estado de Maquinaria (HMI)
    machinePhysics: {
        m2_temp: 0,
        m2_heating: false
    },
    lastAlertTime: 0,
    isEmergencyActive: false,
    
    // Flag de inicialización para evitar recargas dobles
    dashboardInitialized: false
};

// Sistema de suscripción (Pub/Sub)
const listeners = new Set();

/**
 * Suscribe una función para que se ejecute cuando el estado cambie.
 * @param {Function} callback - Función a ejecutar (recibe el nuevo estado).
 * @returns {Function} Función para desuscribirse (cleanup).
 */
export const subscribe = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

/**
 * Notifica a todos los oyentes sobre un cambio.
 * Se utiliza un microtask (Promise) para agrupar actualizaciones rápidas
 * y evitar renderizados excesivos (Batching).
 */
let isNotifyPending = false;
const notifyListeners = () => {
    if (isNotifyPending) return;
    isNotifyPending = true;
    
    Promise.resolve().then(() => {
        listeners.forEach(cb => {
            try {
                cb(globalState);
            } catch (e) {
                console.error("Error en suscriptor de estado:", e);
            }
        });
        isNotifyPending = false;
    });
};

// El Proxy intercepta las asignaciones (setters)
export const globalState = new Proxy(internalState, {
    set(target, prop, value) {
        // Solo notificamos si el valor realmente cambió
        if (target[prop] !== value) {
            target[prop] = value;
            notifyListeners();
        }
        return true;
    },
    get(target, prop) {
        return target[prop];
    }
});