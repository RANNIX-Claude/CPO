-- ============================================================
-- MODO DEMO — permite crear "Nueva solicitud" sin login, atribuida a
-- una persona demo fija. El resto de las escrituras (cambiar estatus,
-- comentar, admin) sigue bloqueado sin sesión real.
-- Revertir con demo_close_write.sql
-- ============================================================
INSERT INTO personas (id, empresa_id, nombre_completo, puesto, nivel, lado, email)
VALUES (
  '00000000-0000-0000-0000-0000000000d0',
  (SELECT id FROM empresas WHERE prefijo_folio='SEG'),
  'Invitado Demo', 'Visitante', 'analista', 'negocio', 'demo@cpoapp.local'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS iniciativas_insert ON iniciativas;
CREATE POLICY iniciativas_insert ON iniciativas FOR INSERT WITH CHECK (
  solicitante_id = mi_persona_id()
  OR tengo_rol('admin','cpo','producto')
  OR solicitante_id = '00000000-0000-0000-0000-0000000000d0'
);

DROP POLICY IF EXISTS archivos_insert ON archivos_adjuntos;
CREATE POLICY archivos_insert ON archivos_adjuntos FOR INSERT WITH CHECK (
  (subido_por_id = mi_persona_id() OR subido_por_id = '00000000-0000-0000-0000-0000000000d0')
  AND EXISTS (SELECT 1 FROM iniciativas i WHERE i.id = iniciativa_id)
);
