import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function Empresas() {
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState({ nombre: '', prefijo_folio: '', color_hex: '#0066ff', logo_url: '' });

  const cargar = () => supabase.from('empresas').select('*').order('nombre').then(({ data }) => setEmpresas(data ?? []));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!form.nombre || !form.prefijo_folio) return;
    const { error } = await supabase.from('empresas').insert(form);
    if (error) { alert(error.message); return; }
    setForm({ nombre: '', prefijo_folio: '', color_hex: '#0066ff', logo_url: '' });
    cargar();
  };

  const toggleActiva = async (e) => {
    await supabase.from('empresas').update({ activa: !e.activa }).eq('id', e.id);
    cargar();
  };

  return (
    <div>
      <h2>Empresas</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <input placeholder="Prefijo folio (ej. SEG)" value={form.prefijo_folio} onChange={(e) => setForm({ ...form, prefijo_folio: e.target.value.toUpperCase() })} style={{ width: 140 }} />
        <input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} />
        <input placeholder="Logo URL" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        <button className="btn btn-primary" onClick={crear}>Agregar empresa</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Prefijo</th><th>Color</th><th>Activa</th></tr></thead>
        <tbody>
          {empresas.map((e) => (
            <tr key={e.id}>
              <td>{e.nombre}</td>
              <td className="mono">{e.prefijo_folio}</td>
              <td><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: e.color_hex }} /></td>
              <td><button className="btn" onClick={() => toggleActiva(e)}>{e.activa ? 'Activa' : 'Inactiva'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
