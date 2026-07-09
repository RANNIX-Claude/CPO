import { URGENCIA_CONFIG } from '../../lib/constants.js';

export default function UrgencyBadge({ urgencia }) {
  const cfg = URGENCIA_CONFIG[urgencia] ?? { color: '#888', label: urgencia };
  return (
    <span className="badge" style={{ background: cfg.color + '1a', color: cfg.color }}>
      {cfg.label}
    </span>
  );
}
