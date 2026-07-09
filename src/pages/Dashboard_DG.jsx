import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import KpiCard from '../components/UI/KpiCard.jsx';
import StatusBadge from '../components/UI/StatusBadge.jsx';
import EmpresaTag from '../components/UI/EmpresaTag.jsx';

export default function Dashboard_DG() {
  const { persona, hasRole } = useAuth();
  const [iniciativas, setIniciativas] = useState([]);

  useEffect(() => {
    let query = supabase.from('iniciativas').select('*, empresas(*)').order('fecha_compromiso', { ascending: true });
    if (hasRole('director_area') && !hasRole('admin', 'cpo')) {
      query = query.eq('empresa_id', persona?.empresa_id);
    }
    query.then(({ data }) => setIniciativas(data ?? []));
  }, [persona, hasRole]);

  const total = iniciativas.length;
  const enProduccion = iniciativas.filter((i) => i.estatus === 'en_produccion').length;
  const enRiesgo = iniciativas.filter((i) => i.es_regulatorio && !['en_produccion', 'cancelado'].includes(i.estatus)).length;

  return (
    <div>
      <h2>Dashboard ejecutivo (solo lectura)</h2>
      <div className="kpi-grid">
        <KpiCard label="Total iniciativas" value={total} />
        <KpiCard label="En producción" value={enProduccion} color="var(--green)" />
        <KpiCard label="Regulatorias en riesgo" value={enRiesgo} color="var(--red)" />
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Folio</th><th>Título</th><th>Empresa</th><th>Estatus</th><th>Fecha compromiso</th></tr></thead>
          <tbody>
            {iniciativas.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.folio}</td>
                <td>{i.titulo}</td>
                <td><EmpresaTag empresa={i.empresas} /></td>
                <td><StatusBadge estatus={i.estatus} /></td>
                <td className="mono">{i.fecha_compromiso ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
