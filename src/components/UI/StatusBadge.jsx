import { STATUS_CONFIG } from '../../lib/constants.js';

export default function StatusBadge({ estatus, onClick }) {
  const cfg = STATUS_CONFIG[estatus] ?? { color: '#888', label: estatus, icon: '○' };
  return (
    <span
      className="badge"
      onClick={onClick}
      style={{
        background: cfg.color + '1a',
        color: cfg.color,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
