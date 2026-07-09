import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/UI/StatusBadge.jsx';
import EmptyState from '../components/UI/EmptyState.jsx';

export default function MisSolicitudes() {
  const { persona } = useAuth();
  const [iniciativas, setIniciativas] = useState([]);

  useEffect(() => {
    if (!persona) return;
    supabase.from('iniciativas').select('*').eq('solicitante_id', persona.id).order('created_at', { ascending: false })
      .then(({ data }) => setIniciativas(data ?? []));
  }, [persona]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Mis solicitudes</h2>
        <Link to="/nueva-solicitud" className="btn btn-primary">Nueva solicitud</Link>
      </div>
      {iniciativas.length === 0 && <EmptyState titulo="Aún no tienes solicitudes" descripcion="Crea tu primera solicitud." />}
      {iniciativas.map((i) => (
        <Link key={i.id} to={`/ficha/${i.id}`} className="card" style={{ display: 'block', marginBottom: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink3)' }}>{i.folio}</div>
              <div style={{ fontWeight: 500 }}>{i.titulo}</div>
            </div>
            <StatusBadge estatus={i.estatus} />
          </div>
        </Link>
      ))}
    </div>
  );
}
