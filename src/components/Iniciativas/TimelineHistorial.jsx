import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import StatusBadge from '../UI/StatusBadge.jsx';

export default function TimelineHistorial({ iniciativaId }) {
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    supabase
      .from('historial_estatus')
      .select('*, personas(nombre_completo)')
      .eq('iniciativa_id', iniciativaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistorial(data ?? []));
  }, [iniciativaId]);

  if (historial.length === 0) {
    return <p style={{ color: 'var(--ink3)', fontSize: 14 }}>Sin cambios de estatus todavía.</p>;
  }

  return (
    <div>
      {historial.map((h) => (
        <div key={h.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            {h.estatus_anterior && <StatusBadge estatus={h.estatus_anterior} />}
            {h.estatus_anterior && <span>→</span>}
            <StatusBadge estatus={h.estatus_nuevo} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {h.personas?.nombre_completo ?? 'Sistema'} · {new Date(h.created_at).toLocaleString('es-MX')}
          </div>
          {h.motivo && <div style={{ fontSize: 13, marginTop: 4 }}>Motivo: {h.motivo}</div>}
          {h.notas && <div style={{ fontSize: 13 }}>Notas: {h.notas}</div>}
        </div>
      ))}
    </div>
  );
}
