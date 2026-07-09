import { useAuth } from '../../context/AuthContext.jsx';
import { ROL_LABELS } from '../../lib/constants.js';

export default function Topbar() {
  const { persona, roles, logout } = useAuth();
  return (
    <header className="topbar">
      <div style={{ fontSize: 14, color: 'var(--ink3)' }}>
        {roles.map((r) => ROL_LABELS[r] ?? r).join(' · ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{persona?.nombre_completo}</span>
        <button className="btn" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
