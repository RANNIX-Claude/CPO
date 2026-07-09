-- ============================================================
-- CPO Portfolio Manager — Schema completo + RLS + Storage + Seed
-- Ejecutar una sola vez contra un proyecto Supabase nuevo.
-- ============================================================

-- ============================================================
-- EXTENSIONES Y TIPOS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE nivel_persona AS ENUM ('director','subdirector','gerente','analista','ejecutivo');
CREATE TYPE lado_persona  AS ENUM ('negocio','tecnologia');
CREATE TYPE urgencia_tipo AS ENUM ('critica','alta','media','baja');
CREATE TYPE rol_tipo AS ENUM (
  'admin','cpo','producto','cto','ti','solicitante','ejecutivo_area','director_area'
);

-- ============================================================
-- CATÁLOGOS
-- ============================================================
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  prefijo_folio TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  color_hex TEXT NOT NULL DEFAULT '#0066ff',
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(empresa_id, nombre)
);

CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  area_id UUID REFERENCES areas(id),
  nombre_completo TEXT NOT NULL,
  puesto TEXT,
  nivel nivel_persona NOT NULL,
  lado lado_persona NOT NULL,
  email TEXT NOT NULL UNIQUE,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id),
  activa BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE tipo_solicitud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  es_regulatorio BOOLEAN NOT NULL DEFAULT false,
  requiere_fecha_limite BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- CORE
-- ============================================================
CREATE TABLE iniciativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  area_solicitante_id UUID NOT NULL REFERENCES areas(id),
  solicitante_id UUID NOT NULL REFERENCES personas(id),
  validado_por_id UUID REFERENCES personas(id),

  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  problema_actual TEXT,
  analisis_causa_raiz JSONB,
  solucion_esperada TEXT,
  sistemas_relacionados TEXT,

  tipo_solicitud_id UUID REFERENCES tipo_solicitud(id),
  urgencia urgencia_tipo NOT NULL DEFAULT 'media',
  fecha_requerida DATE,
  es_regulatorio BOOLEAN NOT NULL DEFAULT false,
  autoridad_regulatoria TEXT,

  responsable_producto_id UUID REFERENCES personas(id),
  prioridad_producto INT CHECK (prioridad_producto BETWEEN 1 AND 100),
  notas_evaluacion TEXT,

  responsable_ti_id UUID REFERENCES personas(id),
  ejecutivo_ti_id UUID REFERENCES personas(id),
  estimacion_horas INT,
  porcentaje_avance INT NOT NULL DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
  fecha_inicio_real DATE,
  fecha_compromiso DATE,
  fecha_liberacion_real DATE,

  estatus TEXT NOT NULL DEFAULT 'recibida' CHECK (estatus IN (
    'recibida','en_revision','en_evaluacion','aprobada','rechazada','en_espera',
    'por_iniciar','en_analisis_ti','en_desarrollo','en_qa','en_uat',
    'proximo_liberar','en_produccion','cancelado'
  )),
  estatus_anterior TEXT,
  motivo_estatus TEXT, -- motivo de rechazo/cancelación/espera, mostrado en Ficha

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_iniciativas_empresa ON iniciativas(empresa_id);
CREATE INDEX idx_iniciativas_estatus ON iniciativas(estatus);
CREATE INDEX idx_iniciativas_solicitante ON iniciativas(solicitante_id);
CREATE INDEX idx_iniciativas_folio ON iniciativas(folio);

CREATE TABLE historial_estatus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciativa_id UUID NOT NULL REFERENCES iniciativas(id) ON DELETE CASCADE,
  estatus_anterior TEXT,
  estatus_nuevo TEXT NOT NULL,
  cambiado_por_id UUID REFERENCES personas(id),
  motivo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciativa_id UUID NOT NULL REFERENCES iniciativas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES personas(id),
  texto TEXT NOT NULL,
  es_interno BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE archivos_adjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciativa_id UUID NOT NULL REFERENCES iniciativas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_mime TEXT,
  tamano_bytes INT CHECK (tamano_bytes <= 15728640),
  subido_por_id UUID NOT NULL REFERENCES personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prototipos_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciativa_id UUID NOT NULL REFERENCES iniciativas(id) ON DELETE CASCADE,
  generado_por_id UUID NOT NULL REFERENCES personas(id),
  prompt_usado TEXT NOT NULL,
  resultado TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(iniciativa_id, version)
);

CREATE TABLE solicitudes_acceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  nombre_completo TEXT,
  empresa_solicitada_id UUID REFERENCES empresas(id),
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobada','rechazada')),
  resuelto_por_id UUID REFERENCES personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),
  iniciativa_id UUID REFERENCES iniciativas(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USUARIOS Y ROLES
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  persona_id UUID NOT NULL REFERENCES personas(id),
  rol rol_tipo NOT NULL,
  UNIQUE(auth_user_id, rol)
);

-- ============================================================
-- FUNCIONES
-- ============================================================
CREATE OR REPLACE FUNCTION generar_folio(p_empresa_id UUID) RETURNS TEXT AS $$
DECLARE
  v_prefijo TEXT;
  v_anio TEXT := to_char(now(), 'YYYY');
  v_consecutivo INT;
BEGIN
  SELECT prefijo_folio INTO v_prefijo FROM empresas WHERE id = p_empresa_id;
  SELECT COUNT(*) + 1 INTO v_consecutivo
    FROM iniciativas
    WHERE empresa_id = p_empresa_id AND folio LIKE v_prefijo || '-' || v_anio || '-%';
  RETURN v_prefijo || '-' || v_anio || '-' || lpad(v_consecutivo::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION estatus_orden(p_estatus TEXT) RETURNS INT AS $$
  SELECT CASE p_estatus
    WHEN 'recibida' THEN 1  WHEN 'en_revision' THEN 2      WHEN 'en_evaluacion' THEN 3
    WHEN 'aprobada' THEN 4  WHEN 'rechazada' THEN 5        WHEN 'en_espera' THEN 6
    WHEN 'por_iniciar' THEN 7        WHEN 'en_analisis_ti' THEN 8
    WHEN 'en_desarrollo' THEN 9      WHEN 'en_qa' THEN 10
    WHEN 'en_uat' THEN 11            WHEN 'proximo_liberar' THEN 12
    WHEN 'en_produccion' THEN 13     WHEN 'cancelado' THEN 14
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iniciativas_updated_at BEFORE UPDATE ON iniciativas
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION mi_persona_id() RETURNS UUID AS $$
  SELECT persona_id FROM user_roles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mi_empresa_id() RETURNS UUID AS $$
  SELECT empresa_id FROM personas WHERE id = mi_persona_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION tengo_rol(VARIADIC roles TEXT[]) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE auth_user_id = auth.uid() AND rol::TEXT = ANY(roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION registrar_historial_estatus() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus IS DISTINCT FROM OLD.estatus THEN
    INSERT INTO historial_estatus (iniciativa_id, estatus_anterior, estatus_nuevo, cambiado_por_id, motivo)
    VALUES (NEW.id, OLD.estatus, NEW.estatus, mi_persona_id(), NEW.motivo_estatus);
    NEW.estatus_anterior := OLD.estatus;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_estatus BEFORE UPDATE ON iniciativas
FOR EACH ROW EXECUTE FUNCTION registrar_historial_estatus();

CREATE OR REPLACE FUNCTION proteger_columnas_iniciativas() RETURNS TRIGGER AS $$
BEGIN
  IF NOT tengo_rol('admin','cpo','producto') AND (
    NEW.responsable_producto_id IS DISTINCT FROM OLD.responsable_producto_id OR
    NEW.prioridad_producto      IS DISTINCT FROM OLD.prioridad_producto OR
    NEW.notas_evaluacion        IS DISTINCT FROM OLD.notas_evaluacion
  ) THEN
    RAISE EXCEPTION 'Solo Producto puede editar los campos de gestión de producto';
  END IF;

  IF NOT tengo_rol('admin','cto','ti') AND (
    NEW.responsable_ti_id     IS DISTINCT FROM OLD.responsable_ti_id OR
    NEW.ejecutivo_ti_id       IS DISTINCT FROM OLD.ejecutivo_ti_id OR
    NEW.estimacion_horas      IS DISTINCT FROM OLD.estimacion_horas OR
    NEW.porcentaje_avance     IS DISTINCT FROM OLD.porcentaje_avance OR
    NEW.fecha_inicio_real     IS DISTINCT FROM OLD.fecha_inicio_real OR
    NEW.fecha_compromiso      IS DISTINCT FROM OLD.fecha_compromiso OR
    NEW.fecha_liberacion_real IS DISTINCT FROM OLD.fecha_liberacion_real
  ) THEN
    RAISE EXCEPTION 'Solo TI puede editar los campos de gestión de tecnología';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_proteger_columnas BEFORE UPDATE ON iniciativas
FOR EACH ROW EXECUTE FUNCTION proteger_columnas_iniciativas();

CREATE VIEW v_dashboard_ejecutivo AS
SELECT empresa_id, estatus, urgencia, es_regulatorio,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE fecha_compromiso BETWEEN now() AND date_trunc('month', now()) + interval '1 month') AS liberan_este_mes
FROM iniciativas
GROUP BY empresa_id, estatus, urgencia, es_regulatorio;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_solicitud ENABLE ROW LEVEL SECURITY;
ALTER TABLE iniciativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estatus ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototipos_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Catálogos: lectura para cualquier usuario autenticado con perfil, escritura solo admin/cpo
CREATE POLICY empresas_select ON empresas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY empresas_write ON empresas FOR ALL USING (tengo_rol('admin','cpo')) WITH CHECK (tengo_rol('admin','cpo'));

CREATE POLICY areas_select ON areas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY areas_write ON areas FOR ALL USING (tengo_rol('admin','cpo')) WITH CHECK (tengo_rol('admin','cpo'));

CREATE POLICY personas_select ON personas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY personas_write ON personas FOR ALL USING (tengo_rol('admin','cpo')) WITH CHECK (tengo_rol('admin','cpo'));

CREATE POLICY tipo_solicitud_select ON tipo_solicitud FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY tipo_solicitud_write ON tipo_solicitud FOR ALL USING (tengo_rol('admin','cpo')) WITH CHECK (tengo_rol('admin','cpo'));

CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (auth_user_id = auth.uid() OR tengo_rol('admin'));
CREATE POLICY user_roles_write ON user_roles FOR ALL USING (tengo_rol('admin')) WITH CHECK (tengo_rol('admin'));

CREATE POLICY solicitudes_acceso_select ON solicitudes_acceso FOR SELECT USING (
  auth_user_id = auth.uid() OR tengo_rol('admin','cpo')
);
CREATE POLICY solicitudes_acceso_insert ON solicitudes_acceso FOR INSERT WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY solicitudes_acceso_update ON solicitudes_acceso FOR UPDATE USING (tengo_rol('admin','cpo'));

CREATE POLICY notificaciones_select ON notificaciones FOR SELECT USING (persona_id = mi_persona_id());
CREATE POLICY notificaciones_update ON notificaciones FOR UPDATE USING (persona_id = mi_persona_id());

-- Iniciativas: el core del sistema
CREATE POLICY iniciativas_select ON iniciativas FOR SELECT USING (
  tengo_rol('admin','cpo','producto')
  OR (tengo_rol('cto','ti') AND estatus_orden(estatus) >= estatus_orden('por_iniciar'))
  OR (tengo_rol('director_area') AND empresa_id = mi_empresa_id())
  OR (tengo_rol('solicitante','ejecutivo_area') AND (
        solicitante_id = mi_persona_id()
        OR area_solicitante_id = (SELECT area_id FROM personas WHERE id = mi_persona_id())
      ))
);

CREATE POLICY iniciativas_insert ON iniciativas FOR INSERT WITH CHECK (
  solicitante_id = mi_persona_id() OR tengo_rol('admin','cpo','producto')
);

CREATE POLICY iniciativas_update ON iniciativas FOR UPDATE USING (
  tengo_rol('admin','cpo','producto','cto','ti')
);

CREATE POLICY historial_select ON historial_estatus FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);
CREATE POLICY historial_insert ON historial_estatus FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);

CREATE POLICY comentarios_select ON comentarios FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
  AND (es_interno = false OR tengo_rol('admin','cpo','producto','cto','ti'))
);
CREATE POLICY comentarios_insert ON comentarios FOR INSERT WITH CHECK (
  autor_id = mi_persona_id() AND EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);

CREATE POLICY archivos_select ON archivos_adjuntos FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);
CREATE POLICY archivos_insert ON archivos_adjuntos FOR INSERT WITH CHECK (
  subido_por_id = mi_persona_id() AND EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);

CREATE POLICY prototipos_select ON prototipos_ia FOR SELECT USING (tengo_rol('admin','cpo','producto'));
CREATE POLICY prototipos_insert ON prototipos_ia FOR INSERT WITH CHECK (tengo_rol('admin','cpo','producto'));

-- ============================================================
-- STORAGE
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'adjuntos-iniciativas', 'adjuntos-iniciativas', false, 15728640,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png','image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_select ON storage.objects FOR SELECT USING (
  bucket_id = 'adjuntos-iniciativas' AND
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id::text = (storage.foldername(name))[2])
);
CREATE POLICY storage_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'adjuntos-iniciativas' AND
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id::text = (storage.foldername(name))[2])
);

-- ============================================================
-- SEED — datos de prueba: 3 empresas, 5 áreas c/u, 20 iniciativas
-- ============================================================

INSERT INTO empresas (nombre, prefijo_folio, color_hex) VALUES
  ('Aseguradora Vanguardia', 'SEG', '#0066ff'),
  ('CriptoNova Exchange',    'CRI', '#6e3fce'),
  ('FinPay Fintech',         'FIN', '#00a868');

INSERT INTO areas (empresa_id, nombre) VALUES
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), 'Jurídica'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), 'Emisión'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), 'Siniestros'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), 'Finanzas'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), 'Tecnología'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), 'Cumplimiento/AML'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), 'Riesgos'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), 'Comercial'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), 'Finanzas'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), 'Tecnología'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), 'Operaciones'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), 'Riesgos'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), 'Comercial'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), 'Finanzas'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), 'Tecnología');

INSERT INTO tipo_solicitud (nombre, es_regulatorio, requiere_fecha_limite) VALUES
  ('Regulatorio/Legal', true, true),
  ('Optimización de proceso', false, false),
  ('Ventaja competitiva', false, false),
  ('Corrección/Bug', false, false),
  ('Infraestructura', false, false),
  ('Proyecto estratégico', false, false);

-- Personas centrales (Producto/Tecnología del grupo)
INSERT INTO personas (empresa_id, area_id, nombre_completo, puesto, nivel, lado, email) VALUES
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Tecnología' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Roberto Aguilar Cota', 'CPO', 'director', 'tecnologia', 'roberto.aguilar.cota@gmail.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Tecnología' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Luis Fernández', 'Responsable de Producto', 'gerente', 'tecnologia', 'luis.fernandez@grupocpo.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Tecnología' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Marcos Reyes', 'CTO', 'director', 'tecnologia', 'marcos.reyes@grupocpo.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Tecnología' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Diana Salas', 'Líder de Proyecto TI', 'subdirector', 'tecnologia', 'diana.salas@grupocpo.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Tecnología' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Jorge Núñez', 'Desarrollador', 'ejecutivo', 'tecnologia', 'jorge.nunez@grupocpo.com');

-- Personas de negocio por empresa (solicitantes / directores que validan)
INSERT INTO personas (empresa_id, area_id, nombre_completo, puesto, nivel, lado, email) VALUES
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Jurídica' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Carla Mendoza', 'Directora Jurídica', 'director', 'negocio', 'carla.mendoza@seg.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Emisión' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), 'Pedro Ibarra', 'Analista de Emisión', 'analista', 'negocio', 'pedro.ibarra@seg.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Cumplimiento/AML' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), 'Sofía Ramos', 'Directora de Cumplimiento', 'director', 'negocio', 'sofia.ramos@cri.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Riesgos' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), 'Iván Castro', 'Ejecutivo de Riesgos', 'ejecutivo', 'negocio', 'ivan.castro@cri.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Operaciones' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), 'Laura Gómez', 'Directora de Operaciones', 'director', 'negocio', 'laura.gomez@fin.com'),
  ((SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Comercial' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), 'Tomás Vega', 'Analista Comercial', 'analista', 'negocio', 'tomas.vega@fin.com');

-- 20 iniciativas: 7 SEG, 7 CRI, 6 FIN, cubriendo las 14 etapas del ciclo de vida
INSERT INTO iniciativas (folio, empresa_id, area_solicitante_id, solicitante_id, validado_por_id, titulo, descripcion, problema_actual, solucion_esperada, tipo_solicitud_id, urgencia, fecha_requerida, es_regulatorio, autoridad_regulatoria, responsable_producto_id, estatus) VALUES
('SEG-2026-0001', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Emisión' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Automatizar emisión de pólizas de auto', 'Permitir emisión digital sin intervención manual', 'El proceso actual toma 3 días por póliza y requiere captura manual repetida', 'Emisión automática en menos de 10 minutos', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'media', NULL, false, NULL, NULL, 'recibida'),
('SEG-2026-0002', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Siniestros' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Portal de seguimiento de siniestros', 'Los clientes no tienen visibilidad del estatus de su siniestro', 'Alto volumen de llamadas preguntando estatus', 'Portal de autoconsulta en línea', (SELECT id FROM tipo_solicitud WHERE nombre='Ventaja competitiva'), 'alta', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_revision'),
('SEG-2026-0003', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Jurídica' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Adecuación a nueva circular CNSF', 'Nueva circular exige cambios en el proceso de suscripción', 'Riesgo de incumplimiento regulatorio', 'Proceso de suscripción alineado a la circular', (SELECT id FROM tipo_solicitud WHERE nombre='Regulatorio/Legal'), 'critica', CURRENT_DATE + INTERVAL '20 days', true, 'CNSF', (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_evaluacion'),
('SEG-2026-0004', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Finanzas' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Conciliación automática de pagos', 'Conciliación manual propensa a errores', 'Diferencias no detectadas a tiempo', 'Conciliación automática diaria', (SELECT id FROM tipo_solicitud WHERE nombre='Infraestructura'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'aprobada'),
('SEG-2026-0005', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Emisión' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Firma electrónica de pólizas', 'Firma física retrasa la entrega de pólizas', 'Clientes esperan hasta 5 días por su póliza firmada', 'Firma electrónica integrada al flujo de emisión', (SELECT id FROM tipo_solicitud WHERE nombre='Proyecto estratégico'), 'alta', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'por_iniciar'),
('SEG-2026-0006', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Siniestros' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'App móvil de reporte de siniestros', 'Reporte de siniestros solo disponible por call center', 'Tiempo de primer contacto muy alto', 'App móvil para reporte y evidencia fotográfica', (SELECT id FROM tipo_solicitud WHERE nombre='Ventaja competitiva'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_desarrollo'),
('SEG-2026-0007', (SELECT id FROM empresas WHERE prefijo_folio='SEG'), (SELECT id FROM areas WHERE nombre='Finanzas' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='SEG')), (SELECT id FROM personas WHERE email='pedro.ibarra@seg.com'), (SELECT id FROM personas WHERE email='carla.mendoza@seg.com'), 'Dashboard financiero ejecutivo', 'Reportes financieros se arman manualmente en Excel', 'Toma 2 días armar el reporte mensual', 'Dashboard en tiempo real', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'baja', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_produccion'),

('CRI-2026-0001', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Comercial' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='ivan.castro@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Programa de referidos', 'No existe incentivo para que usuarios refieran nuevos clientes', 'Bajo crecimiento orgánico', 'Sistema de referidos con recompensas', (SELECT id FROM tipo_solicitud WHERE nombre='Ventaja competitiva'), 'baja', NULL, false, NULL, NULL, 'recibida'),
('CRI-2026-0002', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Riesgos' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='ivan.castro@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Límites dinámicos de retiro', 'Solicitud fuera del apetito de riesgo actual', 'N/A', 'N/A', (SELECT id FROM tipo_solicitud WHERE nombre='Infraestructura'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'rechazada'),
('CRI-2026-0003', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Cumplimiento/AML' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Motor de scoring AML de terceros', 'Depende de aprobación de proveedor externo', 'Bloqueado hasta firma de contrato', 'Integración con motor de scoring AML', (SELECT id FROM tipo_solicitud WHERE nombre='Regulatorio/Legal'), 'alta', CURRENT_DATE + INTERVAL '60 days', true, 'CNBV', (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_espera'),
('CRI-2026-0004', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Finanzas' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='ivan.castro@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Liquidación automática de comisiones', 'Cálculo manual de comisiones por operador', 'Errores frecuentes en el pago', 'Liquidación automática mensual', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_analisis_ti'),
('CRI-2026-0005', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Comercial' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='ivan.castro@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Trading recurrente (DCA)', 'Usuarios piden compras automáticas periódicas', 'Fuga de usuarios a competencia con esta función', 'Función de compra recurrente configurable', (SELECT id FROM tipo_solicitud WHERE nombre='Ventaja competitiva'), 'alta', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_qa'),
('CRI-2026-0006', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Riesgos' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='ivan.castro@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Alertas de operaciones inusuales', 'Detección de fraude es reactiva', 'Pérdidas por operaciones fraudulentas no detectadas a tiempo', 'Motor de alertas en tiempo real', (SELECT id FROM tipo_solicitud WHERE nombre='Infraestructura'), 'critica', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_uat'),
('CRI-2026-0007', (SELECT id FROM empresas WHERE prefijo_folio='CRI'), (SELECT id FROM areas WHERE nombre='Cumplimiento/AML' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='CRI')), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), (SELECT id FROM personas WHERE email='sofia.ramos@cri.com'), 'Reporte regulatorio automático CNBV', 'Reporte mensual se arma manualmente', 'Riesgo de error humano en reporte regulatorio', 'Generación automática del reporte', (SELECT id FROM tipo_solicitud WHERE nombre='Regulatorio/Legal'), 'critica', CURRENT_DATE + INTERVAL '15 days', true, 'CNBV', (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'proximo_liberar'),

('FIN-2026-0001', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Comercial' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='tomas.vega@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Onboarding digital de comercios', 'Alta de comercios toma hasta 2 semanas', 'Pérdida de comercios por proceso lento', 'Onboarding 100% digital en menos de 48h', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'alta', NULL, false, NULL, NULL, 'recibida'),
('FIN-2026-0002', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Riesgos' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Adecuación a nueva disposición CNBV de PLD', 'Nueva disposición exige validación adicional de operaciones', 'Riesgo de sanción regulatoria', 'Validaciones PLD alineadas a la nueva disposición', (SELECT id FROM tipo_solicitud WHERE nombre='Regulatorio/Legal'), 'critica', CURRENT_DATE + INTERVAL '25 days', true, 'CNBV', (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_revision'),
('FIN-2026-0003', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Operaciones' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='tomas.vega@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Conciliación multi-adquirente', 'Conciliación manual entre 3 adquirentes distintos', 'Cierre mensual toma 5 días', 'Conciliación automática consolidada', (SELECT id FROM tipo_solicitud WHERE nombre='Infraestructura'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_evaluacion'),
('FIN-2026-0004', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Comercial' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='tomas.vega@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Widget de checkout embebido', 'Presupuesto reasignado a otra prioridad del trimestre', 'N/A', 'N/A', (SELECT id FROM tipo_solicitud WHERE nombre='Ventaja competitiva'), 'baja', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'cancelado'),
('FIN-2026-0005', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Operaciones' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='tomas.vega@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Disputas y contracargos automatizados', 'Gestión de contracargos 100% manual', 'Tiempo de resolución promedio de 10 días', 'Flujo automatizado de disputas', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'media', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_desarrollo'),
('FIN-2026-0006', (SELECT id FROM empresas WHERE prefijo_folio='FIN'), (SELECT id FROM areas WHERE nombre='Finanzas' AND empresa_id=(SELECT id FROM empresas WHERE prefijo_folio='FIN')), (SELECT id FROM personas WHERE email='tomas.vega@fin.com'), (SELECT id FROM personas WHERE email='laura.gomez@fin.com'), 'Reporte de comisiones para comercios', 'Comercios no tienen visibilidad de comisiones cobradas', 'Alto volumen de tickets de soporte por dudas de cobro', 'Reporte descargable mensual por comercio', (SELECT id FROM tipo_solicitud WHERE nombre='Optimización de proceso'), 'baja', NULL, false, NULL, (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'en_produccion');

-- Completar campos de Gestión Tecnología en las iniciativas que ya están en etapa proyecto
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=120, porcentaje_avance=0, fecha_compromiso=CURRENT_DATE + INTERVAL '30 days' WHERE folio='SEG-2026-0005';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=200, porcentaje_avance=40, fecha_inicio_real=CURRENT_DATE - INTERVAL '15 days', fecha_compromiso=CURRENT_DATE + INTERVAL '20 days' WHERE folio='SEG-2026-0006';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=80, porcentaje_avance=100, fecha_inicio_real=CURRENT_DATE - INTERVAL '90 days', fecha_liberacion_real=CURRENT_DATE - INTERVAL '10 days' WHERE folio='SEG-2026-0007';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=150, porcentaje_avance=25, fecha_compromiso=CURRENT_DATE + INTERVAL '10 days' WHERE folio='CRI-2026-0004';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=180, porcentaje_avance=70, fecha_inicio_real=CURRENT_DATE - INTERVAL '30 days', fecha_compromiso=CURRENT_DATE + INTERVAL '5 days' WHERE folio='CRI-2026-0005';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=100, porcentaje_avance=85, fecha_inicio_real=CURRENT_DATE - INTERVAL '25 days', fecha_compromiso=CURRENT_DATE + INTERVAL '3 days' WHERE folio='CRI-2026-0006';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=60, porcentaje_avance=95, fecha_inicio_real=CURRENT_DATE - INTERVAL '40 days', fecha_compromiso=CURRENT_DATE + INTERVAL '2 days' WHERE folio='CRI-2026-0007';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=140, porcentaje_avance=35, fecha_inicio_real=CURRENT_DATE - INTERVAL '10 days', fecha_compromiso=CURRENT_DATE + INTERVAL '25 days' WHERE folio='FIN-2026-0005';
UPDATE iniciativas SET responsable_ti_id=(SELECT id FROM personas WHERE email='diana.salas@grupocpo.com'), ejecutivo_ti_id=(SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), estimacion_horas=90, porcentaje_avance=100, fecha_inicio_real=CURRENT_DATE - INTERVAL '80 days', fecha_liberacion_real=CURRENT_DATE - INTERVAL '20 days' WHERE folio='FIN-2026-0006';
UPDATE iniciativas SET motivo_estatus='Fuera del apetito de riesgo definido para el trimestre' WHERE folio='CRI-2026-0002';
UPDATE iniciativas SET motivo_estatus='Presupuesto reasignado a otra prioridad del trimestre' WHERE folio='FIN-2026-0004';

-- Comentarios de ejemplo
INSERT INTO comentarios (iniciativa_id, autor_id, texto, es_interno) VALUES
  ((SELECT id FROM iniciativas WHERE folio='SEG-2026-0006'), (SELECT id FROM personas WHERE email='jorge.nunez@grupocpo.com'), 'Avance del sprint 2 completado, iniciando integración con cámara del dispositivo.', true),
  ((SELECT id FROM iniciativas WHERE folio='SEG-2026-0006'), (SELECT id FROM personas WHERE email='luis.fernandez@grupocpo.com'), 'Vamos en tiempo para la fecha compromiso.', false);
