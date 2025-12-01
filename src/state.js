export const globalState = {
    userProfile: null,       // Datos del usuario logueado
    realtimeSubscription: null, // Suscripción a cambios en DB
    tempWalletData: null,    // Datos temporales de tarjeta (solo en sesión)
    currentChannel: 'General', // Canal de chat activo
    
    // Estado de Maquinaria (HMI)
    machinePhysics: {
        m2_temp: 0,
        m2_heating: false
    },
    lastAlertTime: 0,        // Timestamp de última alerta crítica
    isEmergencyActive: false // Estado de paro de emergencia global
};