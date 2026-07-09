export default function EmpresaTag({ empresa }) {
  if (!empresa) return null;
  return (
    <span className="badge" style={{ background: empresa.color_hex + '1a', color: empresa.color_hex }}>
      {empresa.nombre}
    </span>
  );
}
