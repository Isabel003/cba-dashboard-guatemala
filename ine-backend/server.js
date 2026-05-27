/**
 * ============================================================
 *  INE Guatemala — Canasta Básica Alimentaria API Backend
 *  Node.js + Express
 * ============================================================
 *  Descarga los archivos XLSX del INE, los parsea y expone
 *  una API REST propia sin restricciones CORS.
 * ============================================================
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { fetchAndParseAllData } = require("./src/ineService");
const routes = require("./src/routes");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// ── Request logger ───────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toLocaleString("es-GT", { timeZone: "America/Guatemala" });
  console.log(`[${ts}]  ${req.method} ${req.path}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/v1", routes);

// ── Root info ────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    nombre: "INE Guatemala — Canasta Básica API",
    version: "1.0.0",
    descripcion: "API REST que consume y expone datos del portal datos.ine.gob.gt",
    endpoints: {
      estado:         "GET /api/v1/status",
      resumenGeneral: "GET /api/v1/canasta/resumen",
      costosHistorico:"GET /api/v1/canasta/historico",
      costosMensual:  "GET /api/v1/canasta/mensual/:periodo",
      productos:      "GET /api/v1/productos",
      producto:       "GET /api/v1/productos/:nombre",
      categorias:     "GET /api/v1/categorias",
      variaciones:    "GET /api/v1/variaciones",
    },
    fuenteDatos: "https://datos.ine.gob.gt",
  });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint no encontrado" });
});

// ── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
});

// ── Startup: carga inicial de datos ─────────────────────────
async function start() {
  console.log("\n════════════════════════════════════════════════");
  console.log("  INE Guatemala — Canasta Básica API Backend");
  console.log("════════════════════════════════════════════════");
  console.log(`  Puerto      : ${PORT}`);
  console.log(`  Actualiza   : cada 24 horas (00:00 GT)`);
  console.log(`  Fuente      : datos.ine.gob.gt`);
  console.log("════════════════════════════════════════════════\n");

  console.log("⟳ Cargando datos del INE por primera vez...");
  await fetchAndParseAllData();
  console.log("✓ Datos cargados correctamente.\n");

  // Actualizar datos automáticamente cada día a medianoche GT
  cron.schedule("0 0 * * *", async () => {
    console.log("⟳ [CRON] Actualizando datos del INE...");
    await fetchAndParseAllData();
    console.log("✓ [CRON] Datos actualizados.");
  }, { timezone: "America/Guatemala" });
  
  app.listen(PORT, () => {
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`  Prueba:  http://localhost:${PORT}/api/v1/canasta/resumen\n`);
  });
}

start();
