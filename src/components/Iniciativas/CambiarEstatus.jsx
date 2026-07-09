import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { STATUS_CONFIG } from '../../lib/constants.js';
import Modal from '../UI/Modal.jsx';

export default function CambiarEstatus({ iniciativa, onChanged }) {
  const [open, setOpen] = useState(false);
  const [nuevo, setNuevo] = useState(iniciativa.estatus);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const requiereMotivo = ['rechazada', 'en_espera', 'cancelado'].includes(nuevo);

  const guardar = async () => {
    setGuardando(true);
    const { error } = await supabase
      .from('iniciativas')
      .update({ estatus: nuevo, motivo_estatus: motivo || null })
      .eq('id', iniciativa.id);
    setGuardando(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    setMotivo('');
    onChanged?.();
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>Cambiar estatus</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cambiar estatus">
        <select value={nuevo} onChange={(e) => setNuevo(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        {requiereMotivo && (
          <textarea
            placeholder="Motivo (requerido para este estatus)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ width: '100%', minHeight: 80, marginBottom: 12 }}
          />
        )}
        <button className="btn btn-primary" disabled={guardando || (requiereMotivo && !motivo.trim())} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </Modal>
    </>
  );
}
