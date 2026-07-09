// Proxy hacia el API de Claude — la API key vive solo aquí (variable de entorno de Netlify),
// nunca se expone al cliente. Ver PrototipoIA.jsx y SUPERPROMPT.TXT sección 6bis.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en Netlify' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { titulo, problema_actual, analisis_causa_raiz, solucion_esperada, sistemas_relacionados } = payload;

  const causaRaizTexto = (analisis_causa_raiz ?? [])
    .map((p, i) => `${i + 1}. ${p.pregunta} → ${p.respuesta}`)
    .join('\n');

  const prompt = `Eres un arquitecto de producto senior. A partir de esta solicitud interna, propone un prototipo técnico breve.

Título: ${titulo}
Síntoma inicial: ${problema_actual}
Análisis de causa raíz (5 Porqués):
${causaRaizTexto || 'No capturado'}
Solución esperada: ${solucion_esperada}
Sistemas relacionados: ${sistemas_relacionados || 'No especificados'}

Responde en español, en este formato:
- Enfoque técnico sugerido (2-4 líneas)
- Historias de usuario (3-5 bullets)
- Criterios de aceptación (3-5 bullets)
- Riesgos/dependencias (1-3 bullets)`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Claude API error', detail: errBody }) };
    }

    const data = await resp.json();
    const resultado = data.content?.[0]?.text ?? '';

    return {
      statusCode: 200,
      body: JSON.stringify({ resultado, prompt_usado: prompt }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
