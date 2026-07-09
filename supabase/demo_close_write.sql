-- ============================================================
-- Revertir MODO DEMO de escritura — restaura las políticas originales
-- de schema.sql y elimina la persona demo fija.
-- ============================================================
DROP POLICY IF EXISTS iniciativas_insert ON iniciativas;
CREATE POLICY iniciativas_insert ON iniciativas FOR INSERT WITH CHECK (
  solicitante_id = mi_persona_id() OR tengo_rol('admin','cpo','producto')
);

DROP POLICY IF EXISTS archivos_insert ON archivos_adjuntos;
CREATE POLICY archivos_insert ON archivos_adjuntos FOR INSERT WITH CHECK (
  subido_por_id = mi_persona_id() AND EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);

DELETE FROM personas WHERE id = '00000000-0000-0000-0000-0000000000d0';
