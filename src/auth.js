import { db } from './db.js';
import { globalState } from './state.js';
import { notify } from './utils.js';

export const Auth = {
    // Iniciar Sesión
    login: async (email, password) => {
        try {
            const { data, error } = await db.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;
            
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
            // 1. Crear usuario en Auth
            const { data, error } = await db.auth.signUp({ 
                email: email.trim(), 
                password: password 
            });

            if (error) throw error;

            // 2. Crear perfil base en la tabla 'perfiles' si el registro fue exitoso
            if (data.user) {
                const { error: profileError } = await db.from('perfiles').upsert([{ 
                    id: data.user.id, 
                    email: email.trim(), 
                    rol: 'Cliente', 
                    nombre_completo: 'Nuevo Usuario',
                    created_at: new Date()
                }]);
                
                if (profileError) console.warn('Error creando perfil base:', profileError);
            }

            notify.success('Cuenta creada exitosamente. ¡Bienvenido!');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Register error:', error);
            notify.error(error.message || 'Error en el registro');
            return { success: false, error };
        }
    },

    // Cerrar Sesión
    logout: async () => {
        try {
            const { error } = await db.auth.signOut();
            if (error) throw error;
            
            // Limpiar estado global
            globalState.userProfile = null;
            if (globalState.realtimeSubscription) {
                db.removeChannel(globalState.realtimeSubscription);
            }
            
            window.location.href = 'index.html';
        } catch (error) {
            notify.error('Error al cerrar sesión');
        }
    },

    // Obtener Usuario Actual y Perfil
    checkSession: async () => {
        const { data: { session } } = await db.auth.getSession();
        if (session?.user) {
            await Auth.loadProfile(session.user.id);
            return session.user;
        }
        return null;
    },

    // Cargar datos extendidos del perfil (Rol, Dirección, etc.)
    loadProfile: async (userId) => {
        try {
            const { data, error } = await db.from('perfiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Guardar en estado global para usarlo en toda la app
            globalState.userProfile = data;
            console.log('👤 Perfil cargado:', data.rol);
            return data;
        } catch (error) {
            console.error('Error cargando perfil:', error);
            return null;
        }
    },

    // Actualizar Perfil (Usado en cuenta.html)
    updateProfile: async (userId, updates) => {
        try {
            notify.loading('Guardando cambios...');
            
            const { error } = await db.from('perfiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            // Actualizar estado local
            globalState.userProfile = { ...globalState.userProfile, ...updates };
            
            notify.success('Perfil actualizado correctamente');
            return true;
        } catch (error) {
            notify.error('Error al actualizar: ' + error.message);
            return false;
        }
    }
};