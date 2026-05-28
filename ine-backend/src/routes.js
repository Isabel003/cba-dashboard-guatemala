/**
 * routes.js
 * ─────────────────────────────────────────────────────────────
 * Todos los endpoints REST de la API INE Guatemala.
 *
 *  GET /api/v1/status                  — Estado del servidor
 *  GET /api/v1/canasta/resumen         — KPIs principales
 *  GET /api/v1/canasta/historico       — Serie histórica CBAU/CBAR
 *  GET /api/v1/canasta/mensual/:p      — Productos de un período
 *  GET /api/v1/productos               — Lista de productos
 *  GET /api/v1/productos/:nombre       — Historial de un producto
 *  GET /api/v1/categorias              — Grupos alimenticios
 *  GET /api/v1/variaciones             — Variaciones de precio
 *  GET /api/v1/admin/refresh           — Fuerza actualización
 *  ── IA (API key solo en el backend) ──────────────────────────
 *  GET /api/v1/ia/canasta              — Análisis general IA
 *  GET /api/v1/ia/producto/:nombre     — Análisis de un producto
 *  GET /api/v1/ia/reporte              — Reporte ejecutivo completo
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express");
const router  = express.Router();
const svc     = require("./ineService");
const ai      = require("./aiService");

// ── Helpers ───────────────────────────────────────────────────
function ok(res, data, meta = {}) {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    fuente: "INE Guatemala — datos.ine.gob.gt",
    ...meta,
    data,
  });
}

function err(res, status, mensaje) {
  res.status(status).json({ ok: false, error: mensaje });
}

// ── Middleware: datos cargados ────────────────────────────────
function requireData(req, res, next) {
  const db = svc.getDB();
  if (db.estado === "cargando")  return err(res, 503, "Datos cargándose, reintenta en unos segundos.");
  if (db.estado === "sin_datos") return err(res, 503, "Datos no disponibles aún.");
  next();
}

// ── Middleware: API key de Anthropic configurada ──────────────
function requireAIKey(req, res, next) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "ANTHROPIC_API_KEY no configurada en el archivo .env del backend.",
      ayuda: "Agrega: ANTHROPIC_API_KEY=sk-ant-... en tu archivo .env y reinicia el servidor.",
      docs: "https://console.anthropic.com/settings/keys",
    });
  }
  next();
}

// ════════════════════════════════════════════════════════════
//  GET /status
// ════════════════════════════════════════════════════════════
router.get("/status", (req, res) => {
  const db = svc.getDB();
  ok(res, {
    estado:              db.estado,
    ultimaActualizacion: db.ultimaActualizacion,
    iaDisponible:        !!process.env.OPENAI_API_KEY,
    registros: {
      cbauPercapita:    db.cbauPercapita.length,
      cbarPercapita:    db.cbarPercapita.length,
      productosUrbanos: db.productosUrbanos.length,
      productosRurales: db.productosRurales.length,
    },
    errores:  db.errores,
    periodos: svc.getPeriodos(),
  });
});

// ════════════════════════════════════════════════════════════
//  GET /canasta/resumen
// ════════════════════════════════════════════════════════════
router.get("/canasta/resumen", requireData, (req, res) => {
  const resumen = svc.getResumen();
  if (!resumen) return err(res, 503, "No hay datos suficientes para generar resumen.");
  ok(res, resumen, { descripcion: "KPIs de la Canasta Básica Alimentaria" });
});

// ════════════════════════════════════════════════════════════
//  GET /canasta/historico
// ════════════════════════════════════════════════════════════
router.get("/canasta/historico", requireData, (req, res) => {
  const historico = svc.getHistorico();
  ok(res, historico, { total: historico.length });
});

// ════════════════════════════════════════════════════════════
//  GET /canasta/mensual/:periodo
// ════════════════════════════════════════════════════════════
router.get("/canasta/mensual/:periodo", requireData, (req, res) => {
  const datos = svc.getMensual(req.params.periodo);
  if (!datos.urbanos.length && !datos.rurales.length) {
    return err(res, 404, `Sin datos para el período: "${req.params.periodo}"`);
  }
  ok(res, datos, {
    periodo: req.params.periodo,
    totalProductosUrbanos: datos.urbanos.length,
    totalProductosRurales: datos.rurales.length,
  });
});

// ════════════════════════════════════════════════════════════
//  GET /productos   ?periodo= ?grupo= ?nombre=
//  Sin filtros: devuelve SOLO el último período con variaciones
// ════════════════════════════════════════════════════════════
router.get("/productos", requireData, (req, res) => {
  const { periodo, grupo, nombre } = req.query;

  // Si hay filtros explícitos, usarlos directamente
  if (periodo || grupo || nombre) {
    const productos = svc.getProductos({ periodo, grupo, nombre });
    if (!productos.length) return err(res, 404, "Sin productos con esos filtros.");
    return ok(res, productos, {
      total: productos.length,
      filtros: { periodo: periodo || "todos", grupo: grupo || "todos", nombre: nombre || "todos" },
    });
  }

  // Sin filtros: devolver solo el último período enriquecido con variaciones
  const todos = svc.getProductos({});
  if (!todos.length) return err(res, 404, "Sin productos disponibles.");

  // Ordenar períodos cronológicamente (no alfabéticamente)
  const MESES = {
    "enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
    "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12
  };
  const sortPeriodo = (p) => {
    const parts = (p || "").toLowerCase().split(" ");
    return (parseInt(parts[1]) || 0) * 100 + (MESES[parts[0]] || 0);
  };

  const periodos = [...new Set(todos.map(p => p.periodo))]
    .sort((a, b) => sortPeriodo(a) - sortPeriodo(b));
  const ultimoPeriodo   = periodos[periodos.length - 1];
  const anteriorPeriodo = periodos[periodos.length - 2];

  // Filtrar solo el último período
  const soloUltimo = todos.filter(p => p.periodo === ultimoPeriodo);

  // Calcular variaciones respecto al período anterior
  const mapAnterior = {};
  if (anteriorPeriodo) {
    todos.filter(p => p.periodo === anteriorPeriodo)
         .forEach(p => { mapAnterior[p.producto] = p.precio; });
  }

  const conVariacion = soloUltimo.map(p => {
    const precioAnterior = mapAnterior[p.producto];
    const variacion = (p.precio && precioAnterior)
      ? Math.round(((p.precio - precioAnterior) / precioAnterior) * 10000) / 100
      : null;
    return { ...p, variacionPct: variacion, precioAnterior: precioAnterior ?? null };
  }).sort((a, b) => (b.variacionPct ?? 0) - (a.variacionPct ?? 0));

  ok(res, conVariacion, {
    total:          conVariacion.length,
    ultimoPeriodo,
    anteriorPeriodo: anteriorPeriodo ?? null,
  });
});

// ════════════════════════════════════════════════════════════
//  GET /productos/:nombre
// ════════════════════════════════════════════════════════════
router.get("/productos/:nombre", requireData, (req, res) => {
  const todos = svc.getProductos({ nombre: req.params.nombre });
  if (!todos.length) return err(res, 404, `Producto no encontrado: "${req.params.nombre}"`);

  const historial = todos.map(p => ({ periodo: p.periodo, precio: p.precio, costoTotal: p.costoTotal, cantidad: p.cantidad, unidad: p.unidad }));
  const precios   = historial.map(h => h.precio).filter(Boolean);

  ok(res, {
    producto:      todos[0].producto,
    grupo:         todos[0].grupo,
    unidad:        todos[0].unidad,
    precioActual:  historial[historial.length - 1]?.precio ?? null,
    estadisticas:  {
      precioMin:     precios.length ? Math.min(...precios) : null,
      precioMax:     precios.length ? Math.max(...precios) : null,
      precioPromedio:precios.length ? Math.round(precios.reduce((a,b)=>a+b,0)/precios.length*100)/100 : null,
    },
    historial,
  });
});

// ════════════════════════════════════════════════════════════
//  GET /categorias
// ════════════════════════════════════════════════════════════
router.get("/categorias", requireData, (req, res) => {
  const categorias = svc.getCategorias();
  ok(res, categorias, { total: categorias.length });
});

// ════════════════════════════════════════════════════════════
//  GET /variaciones
// ════════════════════════════════════════════════════════════
router.get("/variaciones", requireData, (req, res) => {
  const variaciones = svc.getVariaciones();
  const alzas = variaciones.filter(v => v.variacionPct > 0);
  const bajas = variaciones.filter(v => v.variacionPct < 0);
  ok(res, variaciones, {
    total:         variaciones.length,
    productosAlza: alzas.length,
    productosBaja: bajas.length,
    mayorAlza:     alzas[0] ?? null,
    mayorBaja:     bajas[bajas.length - 1] ?? null,
  });
});

// ════════════════════════════════════════════════════════════
//  GET /admin/refresh
// ════════════════════════════════════════════════════════════
router.get("/admin/refresh", async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (token && req.query.token !== token) {
    return err(res, 401, "Token requerido: ?token=TU_TOKEN");
  }
  try {
    await svc.fetchAndParseAllData();
    const db = svc.getDB();
    ok(res, {
      estado:              db.estado,
      ultimaActualizacion: db.ultimaActualizacion,
      registros: {
        cbauPercapita:    db.cbauPercapita.length,
        cbarPercapita:    db.cbarPercapita.length,
        productosUrbanos: db.productosUrbanos.length,
        productosRurales: db.productosRurales.length,
      },
    }, { mensaje: "Datos actualizados desde el INE." });
  } catch (e) {
    err(res, 500, `Error: ${e.message}`);
  }
});

// ════════════════════════════════════════════════════════════
//  IA — API KEY VIVE SOLO EN EL BACKEND (.env)
//  El navegador NUNCA ve la clave de Anthropic.
// ════════════════════════════════════════════════════════════

// ── GET /ia/canasta ──────────────────────────────────────────
// Devuelve: { semaforo, resumen, alerta, recomendacion, confianza }
router.get("/ia/canasta", requireData, requireAIKey, async (req, res) => {
  const resumen     = svc.getResumen();
  const variaciones = svc.getVariaciones();
  if (!resumen) return err(res, 503, "Sin datos suficientes.");
  try {
    console.log("🤖 [IA] Analizando canasta...");
    const analisis = await ai.analizarCanasta(resumen, variaciones);
    ok(res, analisis, {
      descripcion: "Análisis IA de la Canasta Básica Alimentaria",
      modelo:      "claude-sonnet-4-20250514",
      periodo:     resumen.ultimoPeriodo,
    });
  } catch (e) {
    console.error("[IA]", e.message);
    err(res, 500, `Error IA: ${e.message}`);
  }
});

// ── GET /ia/producto/:nombre ──────────────────────────────────
// Devuelve: { tendencia, descripcion, riesgo, proyeccion }
router.get("/ia/producto/:nombre", requireData, requireAIKey, async (req, res) => {
  const { nombre } = req.params;
  const productos   = svc.getProductos({ nombre });
  if (!productos.length) return err(res, 404, `Producto no encontrado: "${nombre}"`);

  const historial = productos.map(p => ({ periodo: p.periodo, precio: p.precio }));
  const grupo     = productos[0].grupo;
  try {
    console.log(`🤖 [IA] Analizando producto: ${nombre}`);
    const analisis = await ai.analizarProducto(nombre, grupo, historial);
    ok(res, analisis, { producto: nombre, grupo, registros: historial.length, modelo: "claude-sonnet-4-20250514" });
  } catch (e) {
    console.error("[IA]", e.message);
    err(res, 500, `Error IA: ${e.message}`);
  }
});

// ── GET /ia/reporte ───────────────────────────────────────────
// Devuelve: { titulo, introduccion, analisisCostos, productosCriticos,
//             brechaDesigualdad, perspectivas, conclusiones }
router.get("/ia/reporte", requireData, requireAIKey, async (req, res) => {
  const resumen     = svc.getResumen();
  const variaciones = svc.getVariaciones();
  const categorias  = svc.getCategorias();
  if (!resumen) return err(res, 503, "Sin datos suficientes.");
  try {
    console.log("🤖 [IA] Generando reporte ejecutivo...");
    const reporte = await ai.generarReporte(resumen, variaciones, categorias);
    ok(res, reporte, {
      descripcion: "Reporte ejecutivo IA — Canasta Básica Alimentaria",
      modelo:      "claude-sonnet-4-20250514",
      periodo:     resumen.ultimoPeriodo,
      generadoEn:  new Date().toLocaleString("es-GT", { timeZone: "America/Guatemala" }),
    });
  } catch (e) {
    console.error("[IA]", e.message);
    err(res, 500, `Error IA: ${e.message}`);
  }
});

module.exports = router;
