-- ============================================================
-- MODO DEMO — abre lectura sin login (revertir con demo_close_read.sql)
-- La escritura (INSERT/UPDATE/DELETE) sigue bloqueada por rol, esto solo afecta SELECT.
-- ============================================================
DROP POLICY IF EXISTS empresas_select ON empresas;
CREATE POLICY empresas_select ON empresas FOR SELECT USING (true);

DROP POLICY IF EXISTS areas_select ON areas;
CREATE POLICY areas_select ON areas FOR SELECT USING (true);

DROP POLICY IF EXISTS personas_select ON personas;
CREATE POLICY personas_select ON personas FOR SELECT USING (true);

DROP POLICY IF EXISTS tipo_solicitud_select ON tipo_solicitud;
CREATE POLICY tipo_solicitud_select ON tipo_solicitud FOR SELECT USING (true);

DROP POLICY IF EXISTS iniciativas_select ON iniciativas;
CREATE POLICY iniciativas_select ON iniciativas FOR SELECT USING (true);

DROP POLICY IF EXISTS historial_select ON historial_estatus;
CREATE POLICY historial_select ON historial_estatus FOR SELECT USING (true);

DROP POLICY IF EXISTS comentarios_select ON comentarios;
CREATE POLICY comentarios_select ON comentarios FOR SELECT USING (es_interno = false);

DROP POLICY IF EXISTS archivos_select ON archivos_adjuntos;
CREATE POLICY archivos_select ON archivos_adjuntos FOR SELECT USING (true);
