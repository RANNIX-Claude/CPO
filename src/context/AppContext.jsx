import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaActivaId, setEmpresaActivaId] = useState(null);
  const [filtros, setFiltros] = useState({ empresa: null, area: null, estatus: null, urgencia: null });

  useEffect(() => {
    supabase.from('empresas').select('*').eq('activa', true).order('nombre').then(({ data }) => {
      setEmpresas(data ?? []);
    });
  }, []);

  const value = { empresas, empresaActivaId, setEmpresaActivaId, filtros, setFiltros };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
