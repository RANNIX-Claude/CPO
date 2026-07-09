import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [persona, setPersona] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = useCallback(async (authUserId) => {
    if (!authUserId) {
      setPersona(null);
      setRoles([]);
      return;
    }
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('rol, persona_id, personas(*)')
      .eq('auth_user_id', authUserId);

    if (rolesData && rolesData.length > 0) {
      setPersona(rolesData[0].personas);
      setRoles(rolesData.map((r) => r.rol));
    } else {
      setPersona(null);
      setRoles([]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      cargarPerfil(data.session?.user?.id).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      cargarPerfil(newSession?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [cargarPerfil]);

  const login = () => supabase.auth.signInWithOAuth({ provider: 'google' });
  const logout = () => supabase.auth.signOut();
  const hasRole = (...rolesAConsultar) => rolesAConsultar.some((r) => roles.includes(r));

  const value = { session, user: session?.user ?? null, persona, roles, loading, login, logout, hasRole };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
