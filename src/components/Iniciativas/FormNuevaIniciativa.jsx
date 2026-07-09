import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApp } from '../../context/AppContext.jsx';
import AnalisisCausaRaiz from './AnalisisCausaRaiz.jsx';

export default function FormNuevaIniciativa() {
  const { persona } = useAuth();
  const { empresas } = useApp();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [areas, setAreas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    empresa_id: persona?.empresa_id ?? '',
    area_solicitante_id: persona?.area_id ?? '',
    titulo: '',
    problema_actual: '',
    analisis_causa_raiz: [],
    solucion_esperada: '',
    sistemas_relacionados: '',
    tipo_solicitud_id: '',
    urgencia: 'media',
    fecha_requerida: '',
    es_regulatorio: false,
    autoridad_regulatoria: '',
  });

  useEffect(() => {
    if (!form.empresa_id) return;
    supabase.from('areas').select('*').eq('empresa_id', form.empresa_id).eq('activa', true)
      .then(({ data }) => setAreas(data ?? []));
  }, [form.empresa_id]);

  useEffect(() => {
    supabase.from('tipo_solicitud').select('*').then(({ data }) => setTipos(data ?? []));
  }, []);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const causaRaizCompleta = form.analisis_causa_raiz.length >= 2;

  const enviar = async () => {
    setEnviando(true);
    const { data: folio, error: folioError } = await supabase.rpc('generar_folio', { p_empresa_id: form.empresa_id });
    if (folioError) { alert(folioError.message); setEnviando(false); return; }

    const { error } = await supabase.from('iniciativas').insert({
      folio,
      empresa_id: form.empresa_id,
      area_solicitante_id: form.area_solicitante_id,
      solicitante_id: persona.id,
      titulo: form.titulo,
      descripcion: form.problema_actual,
      problema_actual: form.problema_actual,
      analisis_causa_raiz: form.analisis_causa_raiz,
      solucion_esperada: form.solucion_esperada,
      sistemas_relacionados: form.sistemas_relacionados,
      tipo_solicitud_id: form.tipo_solicitud_id || null,
      urgencia: form.urgencia,
      fecha_requerida: form.fecha_requerida || null,
      es_regulatorio: form.es_regulatorio,
      autoridad_regulatoria: form.autoridad_regulatoria || null,
    });
    setEnviando(false);
    if (error) { alert(error.message); return; }
    navigate('/mis-solicitudes');
  };

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Nueva solicitud — Paso {paso} de 4</h2>

      {paso === 1 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Empresa
            <select value={form.empresa_id} onChange={set('empresa_id')} style={{ width: '100%' }}>
              <option value="">Selecciona…</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <label>Área
            <select value={form.area_solicitante_id} onChange={set('area_solicitante_id')} style={{ width: '100%' }}>
              <option value="">Selecciona…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
        </div>
      )}

      {paso === 2 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Título
            <input value={form.titulo} onChange={set('titulo')} style={{ width: '100%' }} />
          </label>
          <label>¿Cuál es el problema? (síntoma inicial)
            <textarea value={form.problema_actual} onChange={set('problema_actual')} style={{ width: '100%', minHeight: 60 }} />
          </label>
          <AnalisisCausaRaiz
            value={form.analisis_causa_raiz}
            onChange={(v) => setForm((f) => ({ ...f, analisis_causa_raiz: v }))}
          />
          <label>Solución esperada (ya informada por la causa raíz)
            <textarea
              value={form.solucion_esperada}
              onChange={set('solucion_esperada')}
              style={{ width: '100%', minHeight: 60 }}
              disabled={!causaRaizCompleta}
              placeholder={causaRaizCompleta ? '' : 'Completa el análisis de causa raíz primero'}
            />
          </label>
        </div>
      )}

      {paso === 3 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Sistemas relacionados
            <input value={form.sistemas_relacionados} onChange={set('sistemas_relacionados')} style={{ width: '100%' }} />
          </label>
          <label>Tipo de solicitud
            <select value={form.tipo_solicitud_id} onChange={set('tipo_solicitud_id')} style={{ width: '100%' }}>
              <option value="">Selecciona…</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label>Urgencia
            <select value={form.urgencia} onChange={set('urgencia')} style={{ width: '100%' }}>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.es_regulatorio}
              onChange={(e) => setForm((f) => ({ ...f, es_regulatorio: e.target.checked }))}
            />
            ¿Tiene fecha límite regulatoria?
          </label>
          {form.es_regulatorio && (
            <>
              <label>Autoridad regulatoria
                <input value={form.autoridad_regulatoria} onChange={set('autoridad_regulatoria')} style={{ width: '100%' }} />
              </label>
              <label>Fecha requerida
                <input type="date" value={form.fecha_requerida} onChange={set('fecha_requerida')} />
              </label>
            </>
          )}
        </div>
      )}

      {paso === 4 && (
        <div>
          <h4>Revisión</h4>
          <p><strong>{form.titulo}</strong></p>
          <p style={{ color: 'var(--ink3)' }}>{form.problema_actual}</p>
          <p><strong>Solución esperada:</strong> {form.solucion_esperada}</p>
          <p><strong>Urgencia:</strong> {form.urgencia} {form.es_regulatorio && `· Regulatorio (${form.autoridad_regulatoria})`}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        {paso > 1 ? <button className="btn" onClick={() => setPaso(paso - 1)}>Atrás</button> : <span />}
        {paso < 4 && (
          <button
            className="btn btn-primary"
            onClick={() => setPaso(paso + 1)}
            disabled={paso === 2 && !causaRaizCompleta}
          >
            Siguiente
          </button>
        )}
        {paso === 4 && (
          <button className="btn btn-primary" disabled={enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        )}
      </div>
    </div>
  );
}
