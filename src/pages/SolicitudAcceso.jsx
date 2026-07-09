import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function SolicitudAcceso() {
  const { user, logout } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviada, setEnviada] = useState(false);
  const [yaExiste, setYaExiste] = useState(false);

  useEffect(() => {
    supabase.from('empresas').select('*').eq('activa', true).then(({ data }) => setEmpresas(data ?? []));
    supabase.from('solicitudes_acceso').select('estatus').eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setYaExiste(true); });
  }, [user.id]);

  const enviar = async () => {
    const { error } = await supabase.from('solicitudes_acceso').insert({
      auth_user_id: user.id,
      email: user.email,
      nombre_completo: nombre,
      empresa_solicitada_id: empresaId || null,
    });
    if (error) { alert(error.message); return; }
    setEnviada(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 400, padding: 32 }}>
        <h2>Solicitud de acceso</h2>
        {enviada || yaExiste ? (
          <p>Tu solicitud fue enviada. Un administrador la revisará y te asignará un perfil.</p>
        ) : (
          <>
            <p style={{ color: 'var(--ink3)', fontSize: 14 }}>
              No encontramos un perfil asociado a <strong>{user.email}</strong>. Completa estos datos para pedir acceso.
            </p>
            <label>Nombre completo
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', marginTop: 8 }}>Empresa
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Selecciona…</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={enviar}>
              Solicitar acceso
            </button>
          </>
        )}
        <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={logout}>Salir</button>
      </div>
    </div>
  );
}
