export const STATUS_CONFIG = {
  recibida:          { color: '#888888', label: 'Recibida',           icon: '○' },
  en_revision:       { color: '#3b82f6', label: 'En revisión',        icon: '◎' },
  en_evaluacion:     { color: '#0066ff', label: 'En evaluación',      icon: '◉' },
  aprobada:          { color: '#00a868', label: 'Aprobada',           icon: '✓' },
  rechazada:         { color: '#d42b2b', label: 'Rechazada',          icon: '✗' },
  en_espera:         { color: '#e07800', label: 'En espera',          icon: '⏸' },
  por_iniciar:       { color: '#8b5cf6', label: 'Por iniciar',        icon: '◷' },
  en_analisis_ti:    { color: '#6e3fce', label: 'Análisis TI',        icon: '⊙' },
  en_desarrollo:     { color: '#4f46e5', label: 'En desarrollo',      icon: '⟳' },
  en_qa:             { color: '#f97316', label: 'En QA',              icon: '⊕' },
  en_uat:            { color: '#ea580c', label: 'En UAT',             icon: '⊗' },
  proximo_liberar:   { color: '#16a34a', label: 'Próximo a liberar',  icon: '⬆' },
  en_produccion:     { color: '#15803d', label: 'En producción',      icon: '✦' },
  cancelado:         { color: '#374151', label: 'Cancelado',          icon: '⊘' },
};

export const ESTATUS_ORDEN = [
  'recibida', 'en_revision', 'en_evaluacion', 'aprobada', 'rechazada', 'en_espera',
  'por_iniciar', 'en_analisis_ti', 'en_desarrollo', 'en_qa', 'en_uat',
  'proximo_liberar', 'en_produccion', 'cancelado',
];

export const ESTATUS_ETAPA_PROYECTO = [
  'por_iniciar', 'en_analisis_ti', 'en_desarrollo', 'en_qa', 'en_uat',
  'proximo_liberar', 'en_produccion',
];

export const URGENCIA_CONFIG = {
  critica: { color: '#d42b2b', label: 'Crítica' },
  alta:    { color: '#e07800', label: 'Alta' },
  media:   { color: '#0066ff', label: 'Media' },
  baja:    { color: '#888880', label: 'Baja' },
};

export const NIVEL_LABELS = {
  director: 'Director', subdirector: 'Subdirector', gerente: 'Gerente',
  analista: 'Analista', ejecutivo: 'Ejecutivo',
};

export const ROL_LABELS = {
  admin: 'Administrador', cpo: 'CPO', producto: 'Producto', cto: 'CTO', ti: 'TI',
  solicitante: 'Solicitante', ejecutivo_area: 'Ejecutivo de área', director_area: 'Director de área',
};

// Roles con visibilidad total sobre iniciativas (todas las empresas)
export const ROLES_VISIBILIDAD_TOTAL = ['admin', 'cpo', 'producto'];
// Roles que solo ven la etapa proyecto (estatus >= por_iniciar)
export const ROLES_ETAPA_PROYECTO = ['cto', 'ti'];
