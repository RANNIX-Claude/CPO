import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ textAlign: 'center', padding: 40, width: 360 }}>
        <h1 style={{ fontSize: 20 }}>CPO Portfolio Manager</h1>
        <p style={{ color: 'var(--ink3)', marginBottom: 24 }}>Gestión de iniciativas y proyectos del grupo</p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={login}>
          Entrar con Google
        </button>
      </div>
    </div>
  );
}
