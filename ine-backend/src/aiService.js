/**
 * aiService.js — OpenAI GPT-4o mini
 * ─────────────────────────────────────────────────────────────
 * Servicio de análisis IA usando el SDK oficial de OpenAI.
 * La API key vive SOLO aquí en el backend — nunca en el frontend.
 *
 * Funciones exportadas:
 *   analizarCanasta(resumen, variaciones)   → { semaforo, resumen, alerta, recomendacion, confianza }
 *   analizarProducto(nombre, grupo, hist)   → { tendencia, descripcion, riesgo, proyeccion }
 *   generarReporte(resumen, vars, cats)     → { titulo, introduccion, ... }
 *
 * Costo estimado por llamada con gpt-4o-mini:
 *   ~$0.0003 USD — prácticamente gratis para uso personal
 * ─────────────────────────────────────────────────────────────
 */

const OpenAI = require("openai");

// ── Cliente OpenAI — usa la key del .env ──────────────────────
function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no está configurada en el archivo .env");
  return new OpenAI({ apiKey: key });
}

// ── Helper: llama a GPT-4o mini y parsea JSON ─────────────────
async function callGPT(systemPrompt, userPrompt, maxTokens = 700) {
  const client = getClient();
  const resp = await client.chat.completions.create({
    model:      "gpt-4o-mini",
    max_tokens: maxTokens,
    temperature: 0.3,          // respuestas consistentes y precisas
    response_format: { type: "json_object" },  // garantiza JSON válido
    messages: [
      { role: "system",  content: systemPrompt },
      { role: "user",    content: userPrompt   },
    ],
  });

  const text = resp.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

// ── 1. Análisis general de la canasta ────────────────────────
async function analizarCanasta(resumen, variaciones = []) {
  const topAlza = variaciones
    .filter(v => v.variacionPct > 0).slice(0, 3)
    .map(v => `${v.producto} (+${v.variacionPct}%)`).join(", ");
  const topBaja = variaciones
    .filter(v => v.variacionPct < 0).slice(-3)
    .map(v => `${v.producto} (${v.variacionPct}%)`).join(", ");

  return await callGPT(
    `Eres analista económico especialista en seguridad alimentaria de Guatemala.
Respondes SOLO con un objeto JSON válido con exactamente estas claves:
semaforo, resumen, alerta, recomendacion, confianza.`,

    `Datos de la Canasta Básica Alimentaria Urbana de Guatemala (INE):
- Período: ${resumen.ultimoPeriodo}
- Costo CBAU per cápita: Q${resumen.cbauPerCapita}
- Costo CBAR per cápita: Q${resumen.cbarPerCapita}
- Variación mensual urbana: ${resumen.variacionMensualU}%
- Variación mensual rural: ${resumen.variacionMensualR}%
- Variación anual urbana: ${resumen.variacionAnualU ?? "N/D"}%
- Brecha urbano-rural: Q${resumen.brechaUrbanoRural}
- Mayores alzas: ${topAlza || "N/D"}
- Mayores bajas: ${topBaja || "N/D"}

Devuelve exactamente este JSON:
{
  "semaforo": "verde|amarillo|rojo",
  "resumen": "2-3 oraciones sobre la situación actual de precios en Guatemala",
  "alerta": "1 oración sobre el mayor riesgo alimentario para las familias guatemaltecas",
  "recomendacion": "1 consejo práctico para hogares guatemaltecos de bajos recursos",
  "confianza": 85
}
semaforo: verde si var. mensual < 1%, amarillo si 1-3%, rojo si > 3%.
confianza: número 0-100 según calidad de los datos disponibles.`
  );
}

// ── 2. Análisis de un producto específico ────────────────────
async function analizarProducto(nombre, grupo, historial = []) {
  const precios = historial
    .map(h => `${h.periodo}: Q${h.precio}`)
    .join(", ");

  const n = historial.length;
  const primero = historial[0];
  const ultimo  = historial[n - 1];
  const variacionTotal = primero && ultimo && primero.precio
    ? (((ultimo.precio - primero.precio) / primero.precio) * 100).toFixed(2)
    : null;

  return await callGPT(
    `Eres analista de precios de alimentos en Guatemala.
Respondes SOLO con un objeto JSON válido con exactamente estas claves:
tendencia, descripcion, riesgo, proyeccion.`,

    `Producto de la Canasta Básica Alimentaria de Guatemala:
- Nombre: ${nombre}
- Grupo: ${grupo}
- Historial: ${precios || "sin historial"}
- Variación total del período: ${variacionTotal !== null ? variacionTotal + "%" : "N/D"}

Devuelve exactamente este JSON:
{
  "tendencia": "alcista|bajista|estable",
  "descripcion": "1-2 oraciones sobre el comportamiento del precio",
  "riesgo": "bajo|medio|alto",
  "proyeccion": "1 oración sobre qué se espera en los próximos meses para este producto en Guatemala"
}`
  );
}

// ── 3. Reporte ejecutivo completo ─────────────────────────────
async function generarReporte(resumen, variaciones = [], categorias = []) {
  const topAlzas = variaciones
    .filter(v => v.variacionPct > 0).slice(0, 5)
    .map(v => `${v.producto} (+${v.variacionPct}%)`).join(", ");
  const topBajas = [...variaciones]
    .filter(v => v.variacionPct < 0).sort((a, b) => a.variacionPct - b.variacionPct).slice(0, 5)
    .map(v => `${v.producto} (${v.variacionPct}%)`).join(", ");
  const catResumen = categorias
    .map(c => `${c.grupo}: Q${c.costoTotal}`).join(" | ");

  return await callGPT(
    `Eres economista del INE Guatemala especialista en seguridad alimentaria.
Escribes reportes ejecutivos formales en español.
Respondes SOLO con un objeto JSON válido.`,

    `Genera un reporte ejecutivo mensual de la Canasta Básica Alimentaria de Guatemala:

PERÍODO: ${resumen.ultimoPeriodo}
CBAU: Q${resumen.cbauPerCapita} | CBAR: Q${resumen.cbarPerCapita}
VAR. MENSUAL: Urbana ${resumen.variacionMensualU}% | Rural ${resumen.variacionMensualR}%
VAR. ANUAL: Urbana ${resumen.variacionAnualU ?? "N/D"}%
BRECHA U-R: Q${resumen.brechaUrbanoRural}
MAYORES ALZAS: ${topAlzas || "N/D"}
MAYORES BAJAS: ${topBajas || "N/D"}
POR CATEGORÍA: ${catResumen || "N/D"}

Devuelve exactamente este JSON:
{
  "titulo": "Reporte Ejecutivo CBA Guatemala — [mes año]",
  "introduccion": "párrafo de contexto sobre la situación alimentaria",
  "analisisCostos": "párrafo analizando costos urbano y rural",
  "productosCriticos": "párrafo sobre productos con mayores alzas y su impacto",
  "brechaDesigualdad": "párrafo sobre brecha urbano-rural y sus implicaciones sociales",
  "perspectivas": "párrafo con perspectivas para el próximo mes",
  "conclusiones": "3 conclusiones numeradas como texto"
}`,
    1400
  );
}

module.exports = { analizarCanasta, analizarProducto, generarReporte };
