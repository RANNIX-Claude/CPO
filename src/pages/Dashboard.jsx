import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { STATUS_CONFIG } from '../lib/constants.js';
import KpiCard from '../components/UI/KpiCard.jsx';
import StatusBadge from '../components/UI/StatusBadge.jsx';
import EmpresaTag from '../components/UI/EmpresaTag.jsx';

const COLORS = ['#0066ff', '#00a868', '#e07800', '#d42b2b', '#6e3fce', '#4f46e5', '#f97316'];

export default function Dashboard() {
  const { hasRole, persona } = useAuth();
  const [iniciativas, setIniciativas] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    supabase.from('iniciativas').select('*, empresas(*)').order('created_at', { ascending: false }).then(({ data }) => setIniciativas(data ?? []));
    supabase.from('empresas').select('*').then(({ data }) => setEmpresas(data ?? []));
  }, []);

  if (hasRole('solicitante', 'ejecutivo_area') && !hasRole('admin', 'cpo', 'producto', 'cto', 'ti', 'director_area')) {
    const mias = iniciativas.filter((i) => i.solicitante_id === persona?.id);
    return (
      <div>
        <h2>Mis solicitudes</h2>
        <Link to="/nueva-solicitud" className="btn btn-primary">Nueva solicitud</Link>
        <table style={{ marginTop: 16 }}>
          <thead><tr><th>Folio</th><th>Título</th><th>Estatus</th></tr></thead>
          <tbody>
            {mias.map((i) => (
              <tr key={i.id}>
                <td className="mono"><Link to={`/ficha/${i.id}`}>{i.folio}</Link></td>
                <td>{i.titulo}</td>
                <td><StatusBadge estatus={i.estatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const total = iniciativas.length;
  const enEvaluacion = iniciativas.filter((i) => i.estatus === 'en_evaluacion').length;
  const aprobadas = iniciativas.filter((i) => i.estatus === 'aprobada').length;
  const hoy = new Date();
  const enProduccionEsteMes = iniciativas.filter((i) => i.estatus === 'en_produccion' && i.fecha_liberacion_real && new Date(i.fecha_liberacion_real).getMonth() === hoy.getMonth()).length;
  const enRiesgo = iniciativas.filter((i) => i.es_regulatorio && i.fecha_requerida && new Date(i.fecha_requerida) <= new Date(hoy.getTime() + 30 * 86400000) && !['en_produccion', 'cancelado'].includes(i.estatus)).length;

  const porEmpresa = empresas.map((e) => ({ nombre: e.nombre, total: iniciativas.filter((i) => i.empresa_id === e.id).length }));
  const porEstatus = Object.keys(STATUS_CONFIG).map((s) => ({ name: STATUS_CONFIG[s].label, value: iniciativas.filter((i) => i.estatus === s).length })).filter((d) => d.value > 0);

  const alertas = iniciativas.filter((i) => i.es_regulatorio && i.fecha_requerida && new Date(i.fecha_requerida) <= new Date(hoy.getTime() + 30 * 86400000) && !['en_produccion', 'cancelado'].includes(i.estatus));

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="kpi-grid">
        <KpiCard label="Total iniciativas" value={total} />
        <KpiCard label="En evaluación" value={enEvaluacion} color="var(--blue)" />
        <KpiCard label="Aprobadas" value={aprobadas} color="var(--green)" />
        <KpiCard label="En producción este mes" value={enProduccionEsteMes} color="var(--green)" />
        <KpiCard label="En riesgo" value={enRiesgo} color="var(--red)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h4>Iniciativas por empresa</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porEmpresa}>
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4>Distribución por estatus</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porEstatus} dataKey="value" nameKey="name" outerRadius={80}>
                {porEstatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 24 }}>
          <h4 style={{ color: 'var(--red)' }}>⚠ Regulatorias con fecha límite &lt; 30 días</h4>
          {alertas.map((a) => (
            <div key={a.id} style={{ fontSize: 14, marginBottom: 4 }}>
              <Link to={`/ficha/${a.id}`}>{a.folio}</Link> — {a.titulo} ({a.fecha_requerida})
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h4>Últimas 10 iniciativas</h4>
        <table>
          <thead><tr><th>Folio</th><th>Título</th><th>Empresa</th><th>Estatus</th></tr></thead>
          <tbody>
            {iniciativas.slice(0, 10).map((i) => (
              <tr key={i.id}>
                <td className="mono"><Link to={`/ficha/${i.id}`}>{i.folio}</Link></td>
                <td>{i.titulo}</td>
                <td><EmpresaTag empresa={i.empresas} /></td>
                <td><StatusBadge estatus={i.estatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
