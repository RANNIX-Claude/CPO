import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROL_LABELS } from '../../lib/constants.js';

export default function Topbar() {
  const { user, persona, roles, logout } = useAuth();
  return (
    <header className="topbar">
      <div style={{ fontSize: 14, color: 'var(--ink3)' }}>
        {user ? roles.map((r) => ROL_LABELS[r] ?? r).join(' · ') : 'Modo demo — solo lectura, sin login'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{persona?.nombre_completo ?? user.email}</span>
            <button className="btn" onClick={logout}>Salir</button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary">Entrar con Google</Link>
        )}
      </div>
    </header>
  );
}
