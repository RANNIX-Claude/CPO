import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useApp } from '../../context/AppContext.jsx';
import { NIVEL_LABELS, ROL_LABELS } from '../../lib/constants.js';

const NIVELES = Object.keys(NIVEL_LABELS);
const ROLES = Object.keys(ROL_LABELS);
// Mapeo sugerido nivel -> rol (no rígido), ver ARQUITECTURA.md
const ROL_SUGERIDO = {
  director: 'director_area', subdirector: 'director_area', gerente: 'ejecutivo_area',
  analista: 'solicitante', ejecutivo: 'solicitante',
};

export default function Personas() {
  const { empresas } = useApp();
  const [personas, setPersonas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ empresa_id: '', area_id: '', nombre_completo: '', puesto: '', nivel: 'analista', lado: 'negocio', email: '', rol: '' });

  const cargar = () => supabase.from('personas').select('*, empresas(nombre), user_roles(rol)').order('nombre_completo').then(({ data }) => setPersonas(data ?? []));
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!form.empresa_id) { setAreas([]); return; }
    supabase.from('areas').select('*').eq('empresa_id', form.empresa_id).then(({ data }) => setAreas(data ?? []));
  }, [form.empresa_id]);

  const sugerido = ROL_SUGERIDO[form.nivel];

  const crear = async () => {
    if (!form.empresa_id || !form.nombre_completo || !form.email) return;
    const { data: p, error } = await supabase.from('personas').insert({
      empresa_id: form.empresa_id, area_id: form.area_id || null, nombre_completo: form.nombre_completo,
      puesto: form.puesto, nivel: form.nivel, lado: form.lado, email: form.email,
    }).select().single();
    if (error) { alert(error.message); return; }
    // El rol de sistema se asigna después de que la persona complete su primer login
    // (necesita auth_user_id real); aquí solo se registra la intención en un comentario del admin.
    setForm({ empresa_id: '', area_id: '', nombre_completo: '', puesto: '', nivel: 'analista', lado: 'negocio', email: '', rol: '' });
    cargar();
  };

  return (
    <div>
      <h2>Personas</h2>
      <div className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <select value={form.empresa_id} onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}>
          <option value="">Empresa…</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })}>
          <option value="">Área…</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <input placeholder="Nombre completo" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} />
        <input placeholder="Puesto" value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })} />
        <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
          {NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABELS[n]}</option>)}
        </select>
        <select value={form.lado} onChange={(e) => setForm({ ...form, lado: e.target.value })}>
          <option value="negocio">Negocio</option>
          <option value="tecnologia">Tecnología</option>
        </select>
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div style={{ fontSize: 12, color: 'var(--ink3)', alignSelf: 'center' }}>
          Rol de sistema sugerido: <strong>{ROL_LABELS[sugerido]}</strong> (se asigna al aprobar su acceso)
        </div>
        <button className="btn btn-primary" onClick={crear}>Agregar persona</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Empresa</th><th>Nivel</th><th>Email</th><th>Rol(es)</th></tr></thead>
        <tbody>
          {personas.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre_completo}</td>
              <td>{p.empresas?.nombre}</td>
              <td>{NIVEL_LABELS[p.nivel]}</td>
              <td className="mono">{p.email}</td>
              <td>{(p.user_roles ?? []).map((r) => ROL_LABELS[r.rol]).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
