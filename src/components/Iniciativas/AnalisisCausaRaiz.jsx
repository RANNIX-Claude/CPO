import { useState } from 'react';

const PREGUNTA_INICIAL = '¿Por qué está ocurriendo este problema?';

export default function AnalisisCausaRaiz({ value = [], onChange }) {
  const [actual, setActual] = useState('');

  const agregar = () => {
    if (!actual.trim()) return;
    const pregunta = value.length === 0
      ? PREGUNTA_INICIAL
      : `¿Por qué ocurre eso? (a raíz de: "${value[value.length - 1].respuesta}")`;
    onChange([...value, { pregunta, respuesta: actual.trim() }]);
    setActual('');
  };

  const quitarUltima = () => onChange(value.slice(0, -1));

  const puedeAgregarMas = value.length < 5;
  const yaCumpleMinimo = value.length >= 2;

  return (
    <div style={{ margin: '12px 0' }}>
      <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 8 }}>
        Análisis de causa raíz ("5 Porqués") — encadena al menos 2 preguntas antes de definir la solución.
      </p>
      {value.map((item, i) => (
        <div key={i} className="card" style={{ marginBottom: 8, padding: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{item.pregunta}</div>
          <div style={{ fontWeight: 500 }}>{item.respuesta}</div>
        </div>
      ))}
      {puedeAgregarMas && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder={value.length === 0 ? PREGUNTA_INICIAL : '¿Por qué ocurre eso?'}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregar())}
          />
          <button type="button" className="btn" onClick={agregar}>Agregar</button>
        </div>
      )}
      {value.length > 0 && (
        <button type="button" className="btn" style={{ marginTop: 8 }} onClick={quitarUltima}>Quitar última</button>
      )}
      {!yaCumpleMinimo && (
        <div style={{ color: 'var(--amber)', fontSize: 12, marginTop: 6 }}>
          Captura al menos 2 iteraciones para continuar.
        </div>
      )}
    </div>
  );
}
