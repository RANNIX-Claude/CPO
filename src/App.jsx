import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Shell from './components/Layout/Shell.jsx';
import Login from './pages/Login.jsx';
import SolicitudAcceso from './pages/SolicitudAcceso.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Dashboard_DG from './pages/Dashboard_DG.jsx';
import Bandeja from './pages/Bandeja.jsx';
import Ficha from './pages/Ficha.jsx';
import NuevaSolicitud from './pages/NuevaSolicitud.jsx';
import MisSolicitudes from './pages/MisSolicitudes.jsx';
import Empresas from './pages/Admin/Empresas.jsx';
import Areas from './pages/Admin/Areas.jsx';
import Personas from './pages/Admin/Personas.jsx';
import Catalogos from './pages/Admin/Catalogos.jsx';
import SolicitudesAcceso from './pages/Admin/SolicitudesAcceso.jsx';

export default function App() {
  const { loading, user, persona, hasRole } = useAuth();

  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>;
  if (!user) return <Login />;
  if (!persona) return <SolicitudAcceso />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/dashboard-dg"
          element={hasRole('director_area', 'cpo', 'admin') ? <Dashboard_DG /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/bandeja"
          element={hasRole('admin', 'cpo', 'producto', 'cto', 'ti') ? <Bandeja /> : <Navigate to="/dashboard" />}
        />
        <Route path="/ficha/:id" element={<Ficha />} />
        <Route path="/nueva-solicitud" element={<NuevaSolicitud />} />
        <Route
          path="/mis-solicitudes"
          element={hasRole('solicitante', 'ejecutivo_area') ? <MisSolicitudes /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin/empresas"
          element={hasRole('admin', 'cpo') ? <Empresas /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin/areas"
          element={hasRole('admin', 'cpo') ? <Areas /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin/personas"
          element={hasRole('admin', 'cpo') ? <Personas /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin/catalogos"
          element={hasRole('admin', 'cpo') ? <Catalogos /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin/solicitudes-acceso"
          element={hasRole('admin', 'cpo') ? <SolicitudesAcceso /> : <Navigate to="/dashboard" />}
        />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}
