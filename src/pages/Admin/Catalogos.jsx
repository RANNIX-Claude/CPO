import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function Catalogos() {
  const [tipos, setTipos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [esRegulatorio, setEsRegulatorio] = useState(false);
  const [requiereFecha, setRequiereFecha] = useState(false);

  const cargar = () => supabase.from('tipo_solicitud').select('*').order('nombre').then(({ data }) => setTipos(data ?? []));
  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nombre) return;
    const { error } = await supabase.from('tipo_solicitud').insert({ nombre, es_regulatorio: esRegulatorio, requiere_fecha_limite: requiereFecha });
    if (error) { alert(error.message); return; }
    setNombre(''); setEsRegulatorio(false); setRequiereFecha(false);
    cargar();
  };

  return (
    <div>
      <h2>Catálogos — Tipos de solicitud</h2>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="Nombre del tipo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label><input type="checkbox" checked={esRegulatorio} onChange={(e) => setEsRegulatorio(e.target.checked)} /> Regulatorio</label>
        <label><input type="checkbox" checked={requiereFecha} onChange={(e) => setRequiereFecha(e.target.checked)} /> Requiere fecha límite</label>
        <button className="btn btn-primary" onClick={crear}>Agregar tipo</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Regulatorio</th><th>Requiere fecha</th></tr></thead>
        <tbody>
          {tipos.map((t) => (
            <tr key={t.id}>
              <td>{t.nombre}</td>
              <td>{t.es_regulatorio ? 'Sí' : 'No'}</td>
              <td>{t.requiere_fecha_limite ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
