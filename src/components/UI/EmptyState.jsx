export default function EmptyState({ titulo = 'Sin datos', descripcion, accion }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--ink3)' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>{titulo}</div>
      {descripcion && <div style={{ fontSize: 14, marginBottom: 16 }}>{descripcion}</div>}
      {accion}
    </div>
  );
}
