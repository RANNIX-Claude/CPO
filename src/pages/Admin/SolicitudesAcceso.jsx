import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROL_LABELS } from '../../lib/constants.js';

export default function SolicitudesAcceso() {
  const { persona } = useAuth();
  const [pendientes, setPendientes] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [seleccion, setSeleccion] = useState({}); // { solicitudId: { personaId, rol } }

  const cargar = () => {
    supabase.from('solicitudes_acceso').select('*, empresas(nombre)').eq('estatus', 'pendiente').then(({ data }) => setPendientes(data ?? []));
    supabase.from('personas').select('id, nombre_completo, email').is('auth_user_id', null).then(({ data }) => setPersonas(data ?? []));
  };
  useEffect(() => { cargar(); }, []);

  const set = (solicitudId, campo, valor) => setSeleccion((s) => ({ ...s, [solicitudId]: { ...s[solicitudId], [campo]: valor } }));

  const aprobar = async (solicitud) => {
    const sel = seleccion[solicitud.id];
    if (!sel?.personaId || !sel?.rol) { alert('Selecciona persona y rol.'); return; }
    const { error: e1 } = await supabase.from('personas').update({ auth_user_id: solicitud.auth_user_id }).eq('id', sel.personaId);
    if (e1) { alert(e1.message); return; }
    const { error: e2 } = await supabase.from('user_roles').insert({ auth_user_id: solicitud.auth_user_id, persona_id: sel.personaId, rol: sel.rol });
    if (e2) { alert(e2.message); return; }
    await supabase.from('solicitudes_acceso').update({ estatus: 'aprobada', resuelto_por_id: persona.id }).eq('id', solicitud.id);
    cargar();
  };

  const rechazar = async (solicitud) => {
    await supabase.from('solicitudes_acceso').update({ estatus: 'rechazada', resuelto_por_id: persona.id }).eq('id', solicitud.id);
    cargar();
  };

  return (
    <div>
      <h2>Solicitudes de acceso pendientes</h2>
      {pendientes.length === 0 && <p style={{ color: 'var(--ink3)' }}>No hay solicitudes pendientes.</p>}
      {pendientes.map((s) => (
        <div key={s.id} className="card" style={{ marginBottom: 12 }}>
          <p><strong>{s.nombre_completo}</strong> · {s.email} · {s.empresas?.nombre ?? 'sin empresa'}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select onChange={(e) => set(s.id, 'personaId', e.target.value)}>
              <option value="">Vincular a persona…</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo} ({p.email})</option>)}
            </select>
            <select onChange={(e) => set(s.id, 'rol', e.target.value)}>
              <option value="">Rol…</option>
              {Object.keys(ROL_LABELS).map((r) => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => aprobar(s)}>Aprobar</button>
            <button className="btn" onClick={() => rechazar(s)}>Rechazar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
