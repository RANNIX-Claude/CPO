import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useApp } from '../context/AppContext.jsx';
import { STATUS_CONFIG } from '../lib/constants.js';
import StatusBadge from '../components/UI/StatusBadge.jsx';
import UrgencyBadge from '../components/UI/UrgencyBadge.jsx';
import EmpresaTag from '../components/UI/EmpresaTag.jsx';
import EmptyState from '../components/UI/EmptyState.jsx';

export default function Bandeja() {
  const { empresas } = useApp();
  const [iniciativas, setIniciativas] = useState([]);
  const [vista, setVista] = useState('tabla');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [filtroUrgencia, setFiltroUrgencia] = useState('');

  useEffect(() => {
    supabase.from('iniciativas').select('*, empresas(*)').order('created_at', { ascending: false }).then(({ data }) => setIniciativas(data ?? []));
  }, []);

  const filtradas = useMemo(() => iniciativas.filter((i) =>
    (!filtroEmpresa || i.empresa_id === filtroEmpresa) &&
    (!filtroEstatus || i.estatus === filtroEstatus) &&
    (!filtroUrgencia || i.urgencia === filtroUrgencia) &&
    (!busqueda || i.folio.toLowerCase().includes(busqueda.toLowerCase()) || i.titulo.toLowerCase().includes(busqueda.toLowerCase()))
  ), [iniciativas, filtroEmpresa, filtroEstatus, filtroUrgencia, busqueda]);

  const exportarCSV = () => {
    const filas = [['Folio', 'Título', 'Empresa', 'Estatus', 'Urgencia', 'Fecha compromiso']];
    filtradas.forEach((i) => filas.push([i.folio, i.titulo, i.empresas?.nombre, i.estatus, i.urgencia, i.fecha_compromiso ?? '']));
    const csv = filas.map((f) => f.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'iniciativas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Bandeja de iniciativas</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setVista(vista === 'tabla' ? 'kanban' : 'tabla')}>
            Vista: {vista === 'tabla' ? 'Tabla' : 'Kanban'}
          </button>
          <button className="btn" onClick={exportarCSV}>Export CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Buscar por folio o texto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value)}>
          <option value="">Todos los estatus</option>
          {Object.entries(STATUS_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select value={filtroUrgencia} onChange={(e) => setFiltroUrgencia(e.target.value)}>
          <option value="">Toda urgencia</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      {filtradas.length === 0 && <EmptyState titulo="Sin iniciativas" descripcion="Ajusta los filtros o la búsqueda." />}

      {vista === 'tabla' && filtradas.length > 0 && (
        <div className="card">
          <table>
            <thead><tr><th>Folio</th><th>Título</th><th>Empresa</th><th>Estatus</th><th>Urgencia</th><th>Compromiso</th></tr></thead>
            <tbody>
              {filtradas.map((i) => (
                <tr key={i.id}>
                  <td className="mono"><Link to={`/ficha/${i.id}`}>{i.folio}</Link></td>
                  <td>{i.titulo}</td>
                  <td><EmpresaTag empresa={i.empresas} /></td>
                  <td><StatusBadge estatus={i.estatus} /></td>
                  <td><UrgencyBadge urgencia={i.urgencia} /></td>
                  <td className="mono">{i.fecha_compromiso ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'kanban' && filtradas.length > 0 && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
          {Object.entries(STATUS_CONFIG).map(([estatus, cfg]) => {
            const items = filtradas.filter((i) => i.estatus === estatus);
            if (items.length === 0) return null;
            return (
              <div key={estatus} style={{ minWidth: 240 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, marginBottom: 8 }}>{cfg.label} ({items.length})</div>
                {items.map((i) => (
                  <Link key={i.id} to={`/ficha/${i.id}`} className="card" style={{ display: 'block', marginBottom: 8, textDecoration: 'none', color: 'inherit' }}>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink3)' }}>{i.folio}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{i.titulo}</div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
