import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { DEMO_PERSONA_ID } from '../../lib/constants.js';
import AnalisisCausaRaiz from './AnalisisCausaRaiz.jsx';

const MIN_PROBLEMA = 40;
const MIN_SOLUCION = 20;
const MAX_ARCHIVO_BYTES = 15 * 1024 * 1024;

export default function FormNuevaIniciativa() {
  const { persona } = useAuth();
  const solicitanteId = persona?.id ?? DEMO_PERSONA_ID; // sin sesión: se atribuye a la persona demo
  const { empresas } = useApp();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [areas, setAreas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [archivos, setArchivos] = useState([]);

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
  const problemaCompleto = form.problema_actual.trim().length >= MIN_PROBLEMA;
  const solucionCompleta = form.solucion_esperada.trim().length >= MIN_SOLUCION;
  const paso2Completo = form.titulo.trim().length > 0 && problemaCompleto && causaRaizCompleta && solucionCompleta;

  const agregarArchivos = (e) => {
    const nuevos = Array.from(e.target.files ?? []);
    const rechazados = nuevos.filter((f) => f.size > MAX_ARCHIVO_BYTES);
    if (rechazados.length > 0) {
      alert(`${rechazados.map((f) => f.name).join(', ')} supera 15 MB y no se agregó.`);
    }
    setArchivos((prev) => [...prev, ...nuevos.filter((f) => f.size <= MAX_ARCHIVO_BYTES)]);
    e.target.value = '';
  };

  const quitarArchivo = (i) => setArchivos((prev) => prev.filter((_, idx) => idx !== i));

  const enviar = async () => {
    setEnviando(true);
    const { data: folio, error: folioError } = await supabase.rpc('generar_folio', { p_empresa_id: form.empresa_id });
    if (folioError) { alert(folioError.message); setEnviando(false); return; }

    const { data: nueva, error } = await supabase.from('iniciativas').insert({
      folio,
      empresa_id: form.empresa_id,
      area_solicitante_id: form.area_solicitante_id,
      solicitante_id: solicitanteId,
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
    }).select().single();

    if (error) { alert(error.message); setEnviando(false); return; }

    for (const file of archivos) {
      const path = `${form.empresa_id}/${nueva.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('adjuntos-iniciativas').upload(path, file);
      if (upErr) { alert(`No se pudo subir ${file.name}: ${upErr.message}`); continue; }
      const { data: signed } = await supabase.storage.from('adjuntos-iniciativas').createSignedUrl(path, 60 * 60 * 24 * 7);
      await supabase.from('archivos_adjuntos').insert({
        iniciativa_id: nueva.id,
        nombre: file.name,
        url: signed?.signedUrl ?? path,
        tipo_mime: file.type,
        tamano_bytes: file.size,
        subido_por_id: solicitanteId,
      });
    }

    setEnviando(false);
    navigate(persona ? '/mis-solicitudes' : `/ficha/${nueva.id}`);
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
            <textarea
              value={form.problema_actual}
              onChange={set('problema_actual')}
              style={{ width: '100%', minHeight: 70 }}
              placeholder="Qué pasa, quién lo reporta, con qué frecuencia, desde cuándo, qué impacto tiene hoy…"
            />
            <div style={{ fontSize: 12, color: problemaCompleto ? 'var(--ink3)' : 'var(--amber)', marginTop: 2 }}>
              {form.problema_actual.trim().length}/{MIN_PROBLEMA} caracteres mínimos
            </div>
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
              placeholder={causaRaizCompleta ? 'Qué resultado esperas obtener, no cómo construirlo' : 'Completa el análisis de causa raíz primero'}
            />
            {causaRaizCompleta && (
              <div style={{ fontSize: 12, color: solucionCompleta ? 'var(--ink3)' : 'var(--amber)', marginTop: 2 }}>
                {form.solucion_esperada.trim().length}/{MIN_SOLUCION} caracteres mínimos
              </div>
            )}
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

          <label>Documentación de soporte (opcional, máx. 15 MB por archivo)
            <input type="file" multiple onChange={agregarArchivos} style={{ display: 'block', marginTop: 4 }} />
          </label>
          {archivos.length > 0 && (
            <div>
              {archivos.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                  <span>{f.name} <span style={{ color: 'var(--ink3)' }}>({(f.size / 1024).toFixed(0)} KB)</span></span>
                  <button type="button" className="btn" onClick={() => quitarArchivo(i)}>Quitar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {paso === 4 && (
        <div>
          <h4>Revisión</h4>
          <p><strong>{form.titulo}</strong></p>
          <p style={{ color: 'var(--ink3)' }}>{form.problema_actual}</p>
          <details style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--blue)' }}>
              Análisis de causa raíz ({form.analisis_causa_raiz.length} pasos)
            </summary>
            {form.analisis_causa_raiz.map((item, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{item.pregunta}</div>
                <div>{item.respuesta}</div>
              </div>
            ))}
          </details>
          <p><strong>Solución esperada:</strong> {form.solucion_esperada}</p>
          <p><strong>Urgencia:</strong> {form.urgencia} {form.es_regulatorio && `· Regulatorio (${form.autoridad_regulatoria})`}</p>
          <p><strong>Documentación adjunta:</strong> {archivos.length === 0 ? 'Ninguna' : archivos.map((f) => f.name).join(', ')}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        {paso > 1 ? <button className="btn" onClick={() => setPaso(paso - 1)}>Atrás</button> : <span />}
        {paso < 4 && (
          <button
            className="btn btn-primary"
            onClick={() => setPaso(paso + 1)}
            disabled={paso === 2 && !paso2Completo}
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
