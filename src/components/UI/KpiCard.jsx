export default function KpiCard({ label, value, color = 'var(--ink)' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}
