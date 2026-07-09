-- ============================================================
-- Revertir MODO DEMO — restaura las políticas de lectura originales de schema.sql
-- Ejecutar antes de usar la app con datos reales / usuarios externos.
-- ============================================================
DROP POLICY IF EXISTS empresas_select ON empresas;
CREATE POLICY empresas_select ON empresas FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS areas_select ON areas;
CREATE POLICY areas_select ON areas FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS personas_select ON personas;
CREATE POLICY personas_select ON personas FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS tipo_solicitud_select ON tipo_solicitud;
CREATE POLICY tipo_solicitud_select ON tipo_solicitud FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS iniciativas_select ON iniciativas;
CREATE POLICY iniciativas_select ON iniciativas FOR SELECT USING (
  tengo_rol('admin','cpo','producto')
  OR (tengo_rol('cto','ti') AND estatus_orden(estatus) >= estatus_orden('por_iniciar'))
  OR (tengo_rol('director_area') AND empresa_id = mi_empresa_id())
  OR (tengo_rol('solicitante','ejecutivo_area') AND (
        solicitante_id = mi_persona_id()
        OR area_solicitante_id = (SELECT area_id FROM personas WHERE id = mi_persona_id())
      ))
);

DROP POLICY IF EXISTS historial_select ON historial_estatus;
CREATE POLICY historial_select ON historial_estatus FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);

DROP POLICY IF EXISTS comentarios_select ON comentarios;
CREATE POLICY comentarios_select ON comentarios FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
  AND (es_interno = false OR tengo_rol('admin','cpo','producto','cto','ti'))
);

DROP POLICY IF EXISTS archivos_select ON archivos_adjuntos;
CREATE POLICY archivos_select ON archivos_adjuntos FOR SELECT USING (
  EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);
