// src/auth.js
import { db } from './db.js';
import { globalState } from './state.js';
import { notify } from './utils.js';
import { Store } from './store.js';
import { CONFIG } from './config.js';

/**
 * Módulo de Autenticación y Gestión de Sesiones.
 * Implementa el patrón Facade para interactuar con Supabase Auth.
 */
export const Auth = {
    /**
     * Inicia sesión con correo y contraseña.
     * @param {string} email - Correo del usuario.
     * @param {string} password - Contraseña.
     * @returns {Promise<{success: boolean, user?: object, error?: object}>} Resultado de la operación.
     */
    login: async (email, password) => {
        try {
            // Validación preliminar para evitar llamadas innecesarias a la API
            if (!email || !password) throw new Error('Credenciales incompletas.');

            const { data, error } = await db.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;
            
            if (data.user) {
                // Carga paralela de datos críticos para mejorar la percepción de velocidad (Perceived Performance)
                await Promise.all([
                    Auth.loadProfile(data.user.id),
                    Store.mergeWithCloud(data.user.id)
                ]);
            }

            notify.success('Bienvenido de nuevo');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('[Auth System] Login error:', error);
            notify.error(error.message || 'Error al iniciar sesión');
            return { success: false, error };
        }
    },

    /**
     * Registra un nuevo usuario en la plataforma.
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{success: boolean, user?: object, error?: object}>}
     */
    register: async (email, password) => {
        try {
            const { data, error } = await db.auth.signUp({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;

            if (data.user) {
                // Utilizamos upsert para garantizar idempotencia en la creación del perfil
                const { error: profileError } = await db.from('perfiles').upsert([{ 
                    id: data.user.id, 
                    email: email.trim(), 
                    rol: 'Cliente', // Rol por defecto (Principio de menor privilegio)
                    nombre_completo: 'Nuevo Usuario', 
                    created_at: new Date().toISOString()
                }], { onConflict: 'id' });
                
                if (profileError) {
                    console.warn('[Auth System] Profile creation warning:', profileError.message);
                }
                
                await Promise.all([
                    Auth.loadProfile(data.user.id),
                    Store.mergeWithCloud(data.user.id)
                ]);
            }

            notify.success('Cuenta creada. ¡Bienvenido!');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('[Auth System] Register error:', error);
            notify.error(error.message || 'Error en el registro');
            return { success: false, error };
        }
    },

    /**
     * Cierre de sesión robusto y limpieza de estado local.
     * Reemplaza la lógica "nuclear" anterior por una limpieza determinista.
     * @returns {Promise<{success: boolean}>}
     */
    logout: async () => {
        try {
            // 1. Intento oficial de cierre de sesión
            const { error } = await db.auth.signOut();
            if (error) console.warn('[Auth System] Supabase signOut warning:', error.message);

        } catch (error) {
            console.error('[Auth System] Logout exception:', error);
        } finally {
            // 2. Limpieza Determinista del Storage (Higiene de Datos)
            // En lugar de iterar ciegamente, eliminamos las claves conocidas y específicas del proyecto.
            const projectID = CONFIG.PROJECT_REF;
            const authKey = `sb-${projectID}-auth-token`;
            
            localStorage.removeItem(authKey); // Token de Supabase
            localStorage.removeItem(CONFIG.CART_KEY); // Carrito local
            
            // Limpieza de claves residuales de Supabase si existen con otros prefijos estándar
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && key.includes('auth-token')) {
                    localStorage.removeItem(key);
                }
            });

            // 3. Reset del Estado en Memoria (Garbage Collection friendly)
            globalState.userProfile = null;
            
            if (globalState.realtimeSubscription) {
                db.removeChannel(globalState.realtimeSubscription);
                globalState.realtimeSubscription = null;
            }
            
            // Reiniciamos el store local a un estado virgen
            Store.clearCart(false); 
            
            notify.show('Sesión cerrada correctamente', 'info');
            return { success: true };
        }
    },

    /**
     * Verifica la validez de la sesión actual.
     * @returns {Promise<object|null>} Objeto de usuario o null.
     */
    checkSession: async () => {
        try {
            const { data: { session }, error } = await db.auth.getSession();
            
            if (error || !session?.user) {
                return null;
            }

            // Recarga del perfil para asegurar consistencia de datos
            await Auth.loadProfile(session.user.id);
            return session.user;
        } catch (e) {
            console.error('[Auth System] Session check failed:', e);
            return null;
        }
    },

    /**
     * Recupera el perfil extendido del usuario desde la base de datos.
     * @param {string} userId - UUID del usuario.
     * @returns {Promise<object|null>}
     */
    loadProfile: async (userId) => {
        try {
            const { data, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            
            // Actualización atómica del estado global
            globalState.userProfile = data;
            return data;
        } catch (error) {
            console.error('[Auth System] Error loading profile:', error);
            return null;
        }
    },

    /**
     * Actualiza parcialmente los datos del perfil.
     * @param {string} userId 
     * @param {object} updates - Objeto con los campos a actualizar.
     * @returns {Promise<boolean>}
     */
    updateProfile: async (userId, updates) => {
        try {
            notify.loading('Sincronizando perfil...');
            
            const { error } = await db
                .from('perfiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            // Fusión optimista del estado (Optimistic UI Update)
            globalState.userProfile = { ...globalState.userProfile, ...updates };
            
            notify.success('Perfil actualizado correctamente');
            return true;
        } catch (error) {
            notify.error(`Error de actualización: ${error.message}`);
            return false;
        }
    }
};