import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PrototipoIA({ iniciativa }) {
  const { persona } = useAuth();
  const [versiones, setVersiones] = useState([]);
  const [generando, setGenerando] = useState(false);

  const cargar = () => {
    supabase
      .from('prototipos_ia')
      .select('*')
      .eq('iniciativa_id', iniciativa.id)
      .order('version', { ascending: false })
      .then(({ data }) => setVersiones(data ?? []));
  };

  useEffect(cargar, [iniciativa.id]);

  const tieneCausaRaiz = Array.isArray(iniciativa.analisis_causa_raiz) && iniciativa.analisis_causa_raiz.length > 0;

  const prototipar = async () => {
    setGenerando(true);
    try {
      const resp = await fetch('/.netlify/functions/prototipar-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: iniciativa.titulo,
          problema_actual: iniciativa.problema_actual,
          analisis_causa_raiz: iniciativa.analisis_causa_raiz,
          solucion_esperada: iniciativa.solucion_esperada,
          sistemas_relacionados: iniciativa.sistemas_relacionados,
        }),
      });
      if (!resp.ok) throw new Error(`Function respondió ${resp.status}`);
      const { resultado, prompt_usado } = await resp.json();
      const version = (versiones[0]?.version ?? 0) + 1;
      await supabase.from('prototipos_ia').insert({
        iniciativa_id: iniciativa.id,
        generado_por_id: persona.id,
        prompt_usado,
        resultado,
        version,
      });
      cargar();
    } catch (err) {
      alert('No se pudo generar el prototipo: ' + err.message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div>
      <button className="btn btn-primary" disabled={!tieneCausaRaiz || generando} onClick={prototipar}>
        {generando ? 'Generando…' : 'Prototipar con Claude'}
      </button>
      {!tieneCausaRaiz && (
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6 }}>
          Requiere análisis de causa raíz capturado en la solicitud.
        </p>
      )}
      {versiones.map((v) => (
        <div key={v.id} className="card" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 6 }}>
            Versión {v.version} · {new Date(v.created_at).toLocaleString('es-MX')}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{v.resultado}</div>
        </div>
      ))}
    </div>
  );
}
