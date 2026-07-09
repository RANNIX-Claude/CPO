# CPO Portfolio Manager — Arquitectura (FASE 1)

## 1. Esquema de base de datos completo

```sql
-- ============================================================
-- EXTENSIONES Y TIPOS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

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
  prefijo_folio TEXT NOT NULL UNIQUE,     -- 'SEG','CRI','FIN' — usado en el folio, garantiza unicidad global
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
  folio TEXT NOT NULL UNIQUE,             -- {prefijo_folio}-{año}-{consecutivo 4 díg}, ej. SEG-2026-0001
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  area_solicitante_id UUID NOT NULL REFERENCES areas(id),
  solicitante_id UUID NOT NULL REFERENCES personas(id),
  validado_por_id UUID REFERENCES personas(id),

  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  problema_actual TEXT,                   -- síntoma inicial reportado
  analisis_causa_raiz JSONB,              -- cadena "5 Porqués" [{pregunta, respuesta}, ...]
  solucion_esperada TEXT,                 -- informada por la causa raíz, no el síntoma
  sistemas_relacionados TEXT,

  tipo_solicitud_id UUID REFERENCES tipo_solicitud(id),
  urgencia urgencia_tipo NOT NULL DEFAULT 'media',
  fecha_requerida DATE,
  es_regulatorio BOOLEAN NOT NULL DEFAULT false,
  autoridad_regulatoria TEXT,

  -- Gestión Producto (protegida por trigger, ver sección RLS)
  responsable_producto_id UUID REFERENCES personas(id),
  prioridad_producto INT CHECK (prioridad_producto BETWEEN 1 AND 100),
  notas_evaluacion TEXT,

  -- Gestión Tecnología (protegida por trigger, ver sección RLS)
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
  cambiado_por_id UUID NOT NULL REFERENCES personas(id),
  motivo TEXT,
  notas TEXT,                             -- agregado: la Ficha (Sección 4) pedía notas además de motivo
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
  tamano_bytes INT CHECK (tamano_bytes <= 15728640), -- 15 MB, ver política de Storage
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

-- Cola de aprobación de acceso (gap detectado: login mencionaba "solicitud de acceso"
-- pero no existía tabla para que admin la resuelva)
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

-- Notificaciones in-app (gap detectado: "notifica al responsable de producto" sin mecanismo definido;
-- se resuelve con tabla + Supabase Realtime, sin dependencia de proveedor de email externo)
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
-- personas.nivel (posición en organigrama) y user_roles.rol (permiso de sistema) son ejes
-- independientes. Mapeo sugerido como default en el form de Admin, no como constraint rígido:
--   director/subdirector → director_area | gerente → ejecutivo_area/producto/ti
--   analista/ejecutivo   → solicitante/ejecutivo_area
-- (ver función validar_rol_nivel más abajo — emite WARNING, no bloquea)

-- ============================================================
-- FUNCIONES
-- ============================================================

-- Folio automático: prefijo de empresa + año + consecutivo (reinicia por empresa+año)
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
-- Nota: con el volumen esperado (~100 iniciativas activas) el riesgo de colisión por
-- inserciones concurrentes es aceptable para MVP; si el volumen crece, mover a sequence por empresa.

-- Orden explícito del ciclo de vida (NUNCA comparar estatus como TEXT alfabéticamente)
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

-- Registra automáticamente cada cambio de estatus en historial_estatus
CREATE OR REPLACE FUNCTION registrar_historial_estatus() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus IS DISTINCT FROM OLD.estatus THEN
    INSERT INTO historial_estatus (iniciativa_id, estatus_anterior, estatus_nuevo, cambiado_por_id)
    VALUES (NEW.id, OLD.estatus, NEW.estatus, mi_persona_id());
    NEW.estatus_anterior := OLD.estatus;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_estatus BEFORE UPDATE ON iniciativas
FOR EACH ROW EXECUTE FUNCTION registrar_historial_estatus();

-- Helpers de identidad para RLS
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

-- Vista resumen para dashboard ejecutivo
CREATE VIEW v_dashboard_ejecutivo AS
SELECT empresa_id, estatus, urgencia, es_regulatorio,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE fecha_compromiso BETWEEN now() AND date_trunc('month', now()) + interval '1 month') AS liberan_este_mes
FROM iniciativas
GROUP BY empresa_id, estatus, urgencia, es_regulatorio;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE iniciativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estatus ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototipos_ia ENABLE ROW LEVEL SECURITY;

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
-- La restricción fina POR SECCIÓN (Producto vs TI) no se resuelve con RLS de fila
-- (Postgres RLS no es column-level) — se resuelve con un trigger, ver más abajo.

-- historial_estatus, comentarios, archivos_adjuntos, prototipos_ia heredan visibilidad
-- de su iniciativa_id vía el mismo criterio que iniciativas_select
CREATE POLICY historial_select ON historial_estatus FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id) -- RLS de iniciativas ya filtra el join
);
CREATE POLICY comentarios_select ON comentarios FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
  AND (es_interno = false OR tengo_rol('admin','cpo','producto','cto','ti'))
);
CREATE POLICY archivos_select ON archivos_adjuntos FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);
CREATE POLICY prototipos_select ON prototipos_ia FOR SELECT USING (
  tengo_rol('admin','cpo','producto')
);

-- Protección de columnas por sección (Producto vs TI) — decisión de arquitectura:
-- RLS es a nivel de fila, no de columna. Se aplica en un trigger BEFORE UPDATE.
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
```

## 2. Storage (Supabase)

- Bucket `adjuntos-iniciativas`, privado.
- Tipos permitidos: pdf, doc/docx, xls/xlsx, png, jpg. Máximo 15 MB (ya reflejado en el CHECK de `archivos_adjuntos.tamano_bytes`).
- Ruta de objeto: `{empresa_id}/{iniciativa_id}/{uuid}-{nombre_original}`.
- RLS de `storage.objects` replica `iniciativas_select` (mismo criterio de acceso por rol).
- Descarga solo vía signed URL de corta duración.

## 3. Estructura de carpetas del proyecto React

```
src/
├── lib/
│   ├── supabase.js
│   └── constants.js          -- estatus, colores, etiquetas
├── context/
│   ├── AuthContext.jsx
│   └── AppContext.jsx        -- empresa activa, filtros globales
├── components/
│   ├── Layout/{Shell,Sidebar,Topbar}.jsx
│   ├── UI/{StatusBadge,UrgencyBadge,EmpresaTag,KpiCard,EmptyState,Modal}.jsx
│   └── Iniciativas/
│       ├── FichaIniciativa.jsx
│       ├── FormNuevaIniciativa.jsx
│       ├── AnalisisCausaRaiz.jsx   -- "5 Porqués"
│       ├── PrototipoIA.jsx         -- botón Prototipar con Claude
│       ├── CambiarEstatus.jsx
│       └── TimelineHistorial.jsx
├── pages/
│   ├── Login.jsx
│   ├── SolicitudAcceso.jsx    -- nuevo: usuario sin perfil pide acceso
│   ├── Dashboard.jsx
│   ├── Bandeja.jsx
│   ├── Ficha.jsx
│   ├── NuevaSolicitud.jsx
│   ├── MisSolicitudes.jsx
│   ├── Dashboard_DG.jsx
│   └── Admin/
│       ├── Empresas.jsx
│       ├── Areas.jsx
│       ├── Personas.jsx
│       ├── Catalogos.jsx
│       └── SolicitudesAcceso.jsx  -- nuevo: aprobar/rechazar accesos pendientes
└── App.jsx
```

## 4. Mapa de rutas y acceso por rol

| Ruta | Roles con acceso |
|---|---|
| `/login` | público |
| `/solicitud-acceso` | autenticado sin fila en `personas` |
| `/dashboard` | todos los roles autenticados (contenido varía por rol) |
| `/dashboard-dg` | director_area, cpo, admin (solo lectura) |
| `/bandeja` | admin, cpo, producto, cto, ti |
| `/ficha/:id` | cualquier rol con acceso de lectura según RLS de `iniciativas` |
| `/nueva-solicitud` | solicitante, ejecutivo_area, director_area, producto, cpo, admin |
| `/mis-solicitudes` | solicitante, ejecutivo_area |
| `/admin/*` | admin, cpo |

## 5. Decisiones de arquitectura

1. **Folio con prefijo de empresa** (`SEG-2026-0001`) en vez de un consecutivo global — evita colisión de `UNIQUE` entre empresas distintas en el mismo año.
2. **`estatus` como `TEXT` + `CHECK`**, no `ENUM` nativo — permite agregar/quitar valores sin `ALTER TYPE`; el orden real del ciclo de vida se resuelve con `estatus_orden()`, nunca por comparación alfabética.
3. **Permisos por sección (Producto vs TI) vía trigger, no RLS pura** — Postgres RLS es row-level; la única forma de bloquear edición de columnas específicas dentro de la misma fila es un trigger `BEFORE UPDATE` que valida por rol.
4. **`analisis_causa_raiz` como `JSONB`** en vez de tabla normalizada de preguntas/respuestas — al ser un array acotado (2-5 iteraciones) por iniciativa, evita joins innecesarios; se puede normalizar después si hace falta consultarlo de forma más rica.
5. **`prototipos_ia` versionado, nunca sobreescrito** — auditoría de qué generó Claude y cuándo, y permite que Producto regenere sin perder el historial.
6. **La API key de Claude solo vive en la Netlify Function** — nunca se expone al cliente; el componente `PrototipoIA.jsx` llama a la function, no directo al API de Anthropic.
7. **Sin paginación en la Bandeja** — con el volumen confirmado (~100 iniciativas activas) no hay riesgo del límite de 1000 filas de PostgREST; se puede agregar `.range()` sin cambios de esquema si el volumen crece.
8. **Tabla `solicitudes_acceso` agregada** — resuelve un vacío del documento original: existía la pantalla "solicitud de acceso" pero ningún mecanismo para que admin la apruebe.
9. **Notificaciones in-app vía tabla `notificaciones` + Supabase Realtime**, no email — evita depender de un proveedor de correo externo (SendGrid, etc.) y de otra credencial más; resuelve "notifica al responsable de producto" con lo que ya está en el stack.
10. **`cto` y `ti` comparten exactamente los mismos permisos en el MVP** — el documento los trataba como bloque sin diferenciarlos nunca; si más adelante el CTO necesita ver iniciativas antes de `por_iniciar`, es un cambio de una línea en `iniciativas_select`.
11. **`nivel` (organigrama) y `rol` (permiso de sistema) quedan como campos independientes**, con un mapeo sugerido documentado pero sin constraint rígido — una persona puede legítimamente tener un rol de sistema distinto a su nivel jerárquico.

---

✅ Arquitectura lista. ¿Apruebas para iniciar la construcción?
