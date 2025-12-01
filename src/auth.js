// src/auth.js
import { db } from './db.js';
import { globalState } from './state.js';
import { notify } from './utils.js';
import { Store } from './store.js';
import { CONFIG } from './config.js'; // Necesitamos config para sacar el ID del proyecto si es necesario

export const Auth = {
    // Iniciar Sesión
    login: async (email, password) => {
        try {
            const { data, error } = await db.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;
            
            if (data.user) {
                await Auth.loadProfile(data.user.id);
                await Store.mergeWithCloud(data.user.id);
            }

            notify.success('Bienvenido de nuevo');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            notify.error(error.message || 'Error al iniciar sesión');
            return { success: false, error };
        }
    },

    // Registrarse
    register: async (email, password) => {
        try {
            const { data, error } = await db.auth.signUp({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await db.from('perfiles').upsert([{ 
                    id: data.user.id, 
                    email: email.trim(), 
                    rol: 'Cliente', 
                    nombre_completo: 'Nuevo Usuario', 
                    created_at: new Date()
                }]);
                
                if (profileError) console.warn('Error perfil:', profileError);
                
                await Auth.loadProfile(data.user.id);
                await Store.mergeWithCloud(data.user.id);
            }

            notify.success('Cuenta creada. ¡Bienvenido!');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Register error:', error);
            notify.error(error.message || 'Error en registro');
            return { success: false, error };
        }
    },

    // --- FIX DEFINITIVO: LOGOUT NUCLEAR ---
    logout: async () => {
        try {
            // Intentamos ser amables con Supabase
            await db.auth.signOut();
        } catch (error) {
            console.warn('Supabase no pudo cerrar sesión (Bloqueo de navegador), forzando cierre local...');
        } finally {
            // AQUI ESTÁ LA MAGIA: Borrado Manual
            // Supabase guarda el token bajo la llave: sb-<PROJECT_ID>-auth-token
            // Tu Project ID es: dtdtqedzfuxfnnipdorg (lo saqué de tu URL en config.js)
            
            const projectID = 'dtdtqedzfuxfnnipdorg';
            
            // 1. Borramos el token específico de Supabase
            localStorage.removeItem(`sb-${projectID}-auth-token`);
            
            // 2. Por seguridad, borramos cualquier rastro de supabase en el storage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                    localStorage.removeItem(key);
                }
            });

            // 3. Limpiamos estado en memoria
            globalState.userProfile = null;
            if (globalState.realtimeSubscription) {
                db.removeChannel(globalState.realtimeSubscription);
                globalState.realtimeSubscription = null;
            }
            
            // 4. Limpiamos el carrito local
            Store.clearCart(false); 
            
            notify.show('Sesión cerrada', 'info');
            return { success: true };
        }
    },

    // Verificar Sesión
    checkSession: async () => {
        try {
            const { data: { session }, error } = await db.auth.getSession();
            if (error || !session?.user) return null;

            await Auth.loadProfile(session.user.id);
            return session.user;
        } catch (e) {
            return null;
        }
    },

    loadProfile: async (userId) => {
        try {
            const { data, error } = await db.from('perfiles').select('*').eq('id', userId).single();
            if (error) throw error;
            globalState.userProfile = data;
            console.log('👤 Perfil cargado:', data.rol);
            return data;
        } catch (error) {
            console.error('Error perfil:', error);
            return null;
        }
    },

    updateProfile: async (userId, updates) => {
        try {
            notify.loading('Guardando...');
            const { error } = await db.from('perfiles').update(updates).eq('id', userId);
            if (error) throw error;
            globalState.userProfile = { ...globalState.userProfile, ...updates };
            notify.success('Perfil actualizado');
            return true;
        } catch (error) {
            notify.error(error.message);
            return false;
        }
    }
};