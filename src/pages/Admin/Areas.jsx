import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useApp } from '../../context/AppContext.jsx';

export default function Areas() {
  const { empresas } = useApp();
  const [areas, setAreas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [nombre, setNombre] = useState('');

  const cargar = () => supabase.from('areas').select('*, empresas(nombre)').order('nombre').then(({ data }) => setAreas(data ?? []));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!empresaId || !nombre) return;
    const { error } = await supabase.from('areas').insert({ empresa_id: empresaId, nombre });
    if (error) { alert(error.message); return; }
    setNombre('');
    cargar();
  };

  const toggleActiva = async (a) => {
    await supabase.from('areas').update({ activa: !a.activa }).eq('id', a.id);
    cargar();
  };

  return (
    <div>
      <h2>Áreas</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Empresa…</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <input placeholder="Nombre del área" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn btn-primary" onClick={crear}>Agregar área</button>
      </div>
      <table>
        <thead><tr><th>Empresa</th><th>Área</th><th>Activa</th></tr></thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.id}>
              <td>{a.empresas?.nombre}</td>
              <td>{a.nombre}</td>
              <td><button className="btn" onClick={() => toggleActiva(a)}>{a.activa ? 'Activa' : 'Inactiva'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
