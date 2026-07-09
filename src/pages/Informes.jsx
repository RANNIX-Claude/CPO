import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../lib/supabase.js';
import { STATUS_CONFIG, URGENCIA_CONFIG } from '../lib/constants.js';
import KpiCard from '../components/UI/KpiCard.jsx';

const COLORS = ['#0066ff', '#00a868', '#e07800', '#d42b2b', '#6e3fce', '#4f46e5', '#f97316', '#16a34a'];

function agrupar(lista, obtenerClave) {
  const mapa = new Map();
  for (const item of lista) {
    const clave = obtenerClave(item) ?? 'Sin asignar';
    mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
  }
  return Array.from(mapa.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export default function Informes() {
  const [iniciativas, setIniciativas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from('iniciativas')
      .select('*, empresas(nombre), areas(nombre), tipo_solicitud(nombre), responsable_producto:personas!iniciativas_responsable_producto_id_fkey(nombre_completo), responsable_ti:personas!iniciativas_responsable_ti_id_fkey(nombre_completo)')
      .then(({ data }) => { setIniciativas(data ?? []); setCargando(false); });
  }, []);

  const total = iniciativas.length;
  const activas = iniciativas.filter((i) => !['en_produccion', 'cancelado', 'rechazada'].includes(i.estatus)).length;
  const enProduccion = iniciativas.filter((i) => i.estatus === 'en_produccion').length;
  const canceladasORechazadas = iniciativas.filter((i) => ['cancelado', 'rechazada'].includes(i.estatus)).length;
  const regulatorias = iniciativas.filter((i) => i.es_regulatorio).length;
  const enRiesgo = iniciativas.filter((i) => {
    if (!i.es_regulatorio || !i.fecha_requerida) return false;
    const dias = (new Date(i.fecha_requerida) - new Date()) / 86400000;
    return dias <= 30 && !['en_produccion', 'cancelado'].includes(i.estatus);
  }).length;
  const tasaAprobacion = total > 0 ? Math.round(((total - canceladasORechazadas) / total) * 100) : 0;

  const porEmpresa = useMemo(() => agrupar(iniciativas, (i) => i.empresas?.nombre), [iniciativas]);
  const porEstatus = useMemo(
    () => Object.keys(STATUS_CONFIG)
      .map((s) => ({ name: STATUS_CONFIG[s].label, value: iniciativas.filter((i) => i.estatus === s).length, color: STATUS_CONFIG[s].color }))
      .filter((d) => d.value > 0),
    [iniciativas]
  );
  const porUrgencia = useMemo(
    () => Object.keys(URGENCIA_CONFIG)
      .map((u) => ({ name: URGENCIA_CONFIG[u].label, value: iniciativas.filter((i) => i.urgencia === u).length, color: URGENCIA_CONFIG[u].color }))
      .filter((d) => d.value > 0),
    [iniciativas]
  );
  const porTipo = useMemo(() => agrupar(iniciativas, (i) => i.tipo_solicitud?.nombre), [iniciativas]);
  const porArea = useMemo(() => agrupar(iniciativas, (i) => i.areas?.nombre).slice(0, 10), [iniciativas]);
  const regulatorioVsNo = useMemo(() => ([
    { name: 'Regulatorio', value: regulatorias },
    { name: 'No regulatorio', value: total - regulatorias },
  ]), [iniciativas, total, regulatorias]);
  const cargaProducto = useMemo(() => agrupar(iniciativas, (i) => i.responsable_producto?.nombre_completo), [iniciativas]);
  const cargaTi = useMemo(
    () => agrupar(iniciativas.filter((i) => i.responsable_ti), (i) => i.responsable_ti?.nombre_completo),
    [iniciativas]
  );

  const tendenciaMensual = useMemo(() => {
    const mapa = new Map();
    iniciativas.forEach((i) => {
      const mes = i.created_at?.slice(0, 7); // YYYY-MM
      if (!mes) return;
      mapa.set(mes, (mapa.get(mes) ?? 0) + 1);
    });
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total }));
  }, [iniciativas]);

  if (cargando) return <p>Cargando informes…</p>;

  return (
    <div>
      <h2>Informes Ejecutivos</h2>
      <p style={{ color: 'var(--ink3)', marginTop: -8, marginBottom: 20 }}>
        Corte al {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} · {total} iniciativas en el sistema
      </p>

      <div className="kpi-grid">
        <KpiCard label="Total iniciativas" value={total} />
        <KpiCard label="Activas" value={activas} color="var(--blue)" />
        <KpiCard label="En producción" value={enProduccion} color="var(--green)" />
        <KpiCard label="Canceladas / rechazadas" value={canceladasORechazadas} color="var(--red)" />
        <KpiCard label="Regulatorias en riesgo (<30 días)" value={enRiesgo} color="var(--amber)" />
        <KpiCard label="Tasa de avance sin cancelar" value={`${tasaAprobacion}%`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h4>Por empresa</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porEmpresa}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4>Por estatus</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porEstatus} dataKey="value" nameKey="name" outerRadius={80}>
                {porEstatus.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h4>Por urgencia</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porUrgencia} dataKey="value" nameKey="name" outerRadius={80}>
                {porUrgencia.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4>Regulatorio vs. no regulatorio</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={regulatorioVsNo} dataKey="value" nameKey="name" outerRadius={80}>
                <Cell fill="var(--red)" />
                <Cell fill="var(--ink3)" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Por tipo de solicitud</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porTipo} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--purple)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Por área solicitante (top 10)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porArea} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--green)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h4>Carga por responsable de Producto</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cargaProducto} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--blue)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4>Carga por responsable de TI</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cargaTi} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--indigo, #4f46e5)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h4>Tendencia mensual de iniciativas recibidas</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={tendenciaMensual}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" name="Iniciativas" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
