import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ESTATUS_ETAPA_PROYECTO } from '../../lib/constants.js';
import StatusBadge from '../UI/StatusBadge.jsx';
import UrgencyBadge from '../UI/UrgencyBadge.jsx';
import EmpresaTag from '../UI/EmpresaTag.jsx';
import CambiarEstatus from './CambiarEstatus.jsx';
import TimelineHistorial from './TimelineHistorial.jsx';
import PrototipoIA from './PrototipoIA.jsx';

const DEBOUNCE_MS = 1500;

export default function FichaIniciativa({ iniciativaId }) {
  const { persona, hasRole } = useAuth();
  const [iniciativa, setIniciativa] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [comentarioInterno, setComentarioInterno] = useState(true);
  const debounceRef = useRef(null);

  const puedeEditarProducto = hasRole('admin', 'cpo', 'producto');
  const puedeEditarTi = hasRole('admin', 'cto', 'ti');
  const seccionTiVisible = iniciativa && ESTATUS_ETAPA_PROYECTO.includes(iniciativa.estatus);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('iniciativas').select('*, empresas(*), personas!iniciativas_solicitante_id_fkey(nombre_completo), validador:personas!iniciativas_validado_por_id_fkey(nombre_completo), areas(nombre)').eq('id', iniciativaId).single();
    if (data) {
      setIniciativa(data);
      setEmpresa(data.empresas);
    }
    const { data: com } = await supabase.from('comentarios').select('*, personas(nombre_completo)').eq('iniciativa_id', iniciativaId).order('created_at');
    setComentarios(com ?? []);
    const { data: adj } = await supabase.from('archivos_adjuntos').select('*').eq('iniciativa_id', iniciativaId);
    setArchivos(adj ?? []);
  }, [iniciativaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarCampo = (campo, valor) => {
    setIniciativa((prev) => ({ ...prev, [campo]: valor }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from('iniciativas').update({ [campo]: valor }).eq('id', iniciativaId);
      if (error) alert(error.message);
    }, DEBOUNCE_MS);
  };

  const enviarComentario = async () => {
    if (!nuevoComentario.trim()) return;
    const { error } = await supabase.from('comentarios').insert({
      iniciativa_id: iniciativaId,
      autor_id: persona.id,
      texto: nuevoComentario.trim(),
      es_interno: comentarioInterno,
    });
    if (error) { alert(error.message); return; }
    setNuevoComentario('');
    cargar();
  };

  const subirArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { alert('Archivo mayor a 15 MB.'); return; }
    const path = `${iniciativa.empresa_id}/${iniciativaId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('adjuntos-iniciativas').upload(path, file);
    if (upErr) { alert(upErr.message); return; }
    const { data: signed } = await supabase.storage.from('adjuntos-iniciativas').createSignedUrl(path, 60 * 60 * 24 * 7);
    await supabase.from('archivos_adjuntos').insert({
      iniciativa_id: iniciativaId,
      nombre: file.name,
      url: signed?.signedUrl ?? path,
      tipo_mime: file.type,
      tamano_bytes: file.size,
      subido_por_id: persona.id,
    });
    cargar();
  };

  if (!iniciativa) return <p>Cargando…</p>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 800 }}>
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontWeight: 600 }}>{iniciativa.folio}</span>
          <EmpresaTag empresa={empresa} />
          <StatusBadge estatus={iniciativa.estatus} />
          <UrgencyBadge urgencia={iniciativa.urgencia} />
          {iniciativa.fecha_requerida && (
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Requerida: {iniciativa.fecha_requerida}
            </span>
          )}
        </div>
        <h2 style={{ margin: '10px 0 0' }}>{iniciativa.titulo}</h2>
      </div>

      <section className="card">
        <h3>1. Solicitud original</h3>
        <p><strong>Área:</strong> {iniciativa.areas?.nombre} · <strong>Solicitante:</strong> {iniciativa.personas?.nombre_completo} · <strong>Validó:</strong> {iniciativa.validador?.nombre_completo ?? '—'}</p>
        <p><strong>Problema:</strong> {iniciativa.problema_actual}</p>
        <p><strong>Solución esperada:</strong> {iniciativa.solucion_esperada}</p>
        <p><strong>Sistemas relacionados:</strong> {iniciativa.sistemas_relacionados || '—'}</p>
        {iniciativa.es_regulatorio && (
          <p><strong>Regulatorio:</strong> {iniciativa.autoridad_regulatoria} — plazo {iniciativa.fecha_requerida}</p>
        )}
        {iniciativa.analisis_causa_raiz?.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--blue)' }}>Ver análisis de causa raíz</summary>
            {iniciativa.analisis_causa_raiz.map((item, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{item.pregunta}</div>
                <div>{item.respuesta}</div>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="card">
        <h3>2. Gestión Producto</h3>
        <label>Notas de evaluación
          <textarea
            style={{ width: '100%', minHeight: 60 }}
            defaultValue={iniciativa.notas_evaluacion ?? ''}
            disabled={!puedeEditarProducto}
            onChange={(e) => guardarCampo('notas_evaluacion', e.target.value)}
          />
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>Prioridad (1-100)
          <input
            type="number" min="1" max="100"
            defaultValue={iniciativa.prioridad_producto ?? ''}
            disabled={!puedeEditarProducto}
            onChange={(e) => guardarCampo('prioridad_producto', Number(e.target.value))}
          />
        </label>
        {persona && (
          <div style={{ marginTop: 12 }}>
            <PrototipoIA iniciativa={iniciativa} />
          </div>
        )}
      </section>

      {seccionTiVisible && (
        <section className="card">
          <h3>3. Gestión Tecnología</h3>
          <label style={{ display: 'block' }}>% Avance
            <input
              type="number" min="0" max="100"
              defaultValue={iniciativa.porcentaje_avance}
              disabled={!puedeEditarTi}
              onChange={(e) => guardarCampo('porcentaje_avance', Number(e.target.value))}
            />
          </label>
          <div style={{ background: 'var(--bg2)', borderRadius: 8, height: 8, marginTop: 8 }}>
            <div style={{ width: `${iniciativa.porcentaje_avance}%`, background: 'var(--green)', height: 8, borderRadius: 8 }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 8 }}>
            Estimación: {iniciativa.estimacion_horas ?? '—'} h · Compromiso: {iniciativa.fecha_compromiso ?? '—'}
          </p>
        </section>
      )}

      <section className="card">
        <h3>4. Timeline de historial</h3>
        <TimelineHistorial iniciativaId={iniciativaId} />
      </section>

      <section className="card">
        <h3>5. Comentarios</h3>
        {comentarios.map((c) => (
          <div key={c.id} style={{ marginBottom: 8, padding: 8, background: c.es_interno ? 'var(--bg2)' : '#eaf6ff', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
              {c.personas?.nombre_completo} · {c.es_interno ? 'Interno' : 'Externo'} · {new Date(c.created_at).toLocaleString('es-MX')}
            </div>
            <div>{c.texto}</div>
          </div>
        ))}
        {persona ? (
          <>
            <textarea style={{ width: '100%', minHeight: 50 }} value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} placeholder="Escribe un comentario…" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <label style={{ fontSize: 13 }}>
                <input type="checkbox" checked={comentarioInterno} onChange={(e) => setComentarioInterno(e.target.checked)} /> Interno
              </label>
              <button className="btn btn-primary" onClick={enviarComentario}>Agregar comentario</button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Inicia sesión para comentar.</p>
        )}
      </section>

      <section className="card">
        <h3>6. Archivos</h3>
        {archivos.map((a) => (
          <div key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.nombre}</a></div>
        ))}
        {persona && <input type="file" onChange={subirArchivo} style={{ marginTop: 8 }} />}
      </section>

      {persona && (
        <div style={{ position: 'sticky', bottom: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <CambiarEstatus iniciativa={iniciativa} onChanged={cargar} />
        </div>
      )}
    </div>
  );
}
