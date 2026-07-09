import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', roles: null },
  { to: '/dashboard-dg', label: 'Dashboard DG', roles: ['director_area', 'cpo', 'admin'] },
  { to: '/bandeja', label: 'Bandeja', roles: ['admin', 'cpo', 'producto', 'cto', 'ti'] },
  { to: '/mis-solicitudes', label: 'Mis solicitudes', roles: ['solicitante', 'ejecutivo_area'] },
  { to: '/nueva-solicitud', label: 'Nueva solicitud', roles: null },
  { to: '/admin/empresas', label: 'Admin · Empresas', roles: ['admin', 'cpo'] },
  { to: '/admin/areas', label: 'Admin · Áreas', roles: ['admin', 'cpo'] },
  { to: '/admin/personas', label: 'Admin · Personas', roles: ['admin', 'cpo'] },
  { to: '/admin/catalogos', label: 'Admin · Catálogos', roles: ['admin', 'cpo'] },
  { to: '/admin/solicitudes-acceso', label: 'Admin · Accesos', roles: ['admin', 'cpo'] },
];

export default function Sidebar() {
  const { hasRole } = useAuth();
  return (
    <nav className="sidebar">
      <div style={{ fontWeight: 700, marginBottom: 24, fontSize: 15 }}>CPO Portfolio</div>
      {LINKS.filter((l) => !l.roles || hasRole(...l.roles)).map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({
            display: 'block', padding: '8px 10px', borderRadius: 8, marginBottom: 4,
            fontSize: 14, textDecoration: 'none', color: isActive ? 'var(--blue)' : 'var(--ink2)',
            background: isActive ? 'var(--bg2)' : 'transparent', fontWeight: isActive ? 600 : 400,
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
