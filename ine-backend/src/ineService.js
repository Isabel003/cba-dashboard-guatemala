/**
 * ineService.js
 * ─────────────────────────────────────────────────────────────
 * Obtiene datos del INE Guatemala via API CKAN.
 * Incluye mapa de grupos basado en los 66 productos reales
 * de la CBAU — el INE no provee columna "grupo" en CKAN.
 * ─────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const XLSX  = require("xlsx");
const path  = require("path");
const fs    = require("fs");

// ── Mapa de grupos por producto (66 productos reales del INE) ─
const GRUPOS = {
  // Cereales y derivados
  "Arroz corriente":              "Cereales y derivados",
  "Arroz precocido":              "Cereales y derivados",
  "Pan francés":                  "Cereales y derivados",
  "Pan dulce":                    "Cereales y derivados",
  "Galletas dulces":              "Cereales y derivados",
  "Tortillas frescas":            "Cereales y derivados",
  "Cereales de bolsa o caja":     "Cereales y derivados",
  "Espagueti":                    "Cereales y derivados",
  "Fideos en todas sus formas (Excepto macarrones y espagueti)": "Cereales y derivados",

  // Carnes
  "Carne de res molida":          "Carnes",
  "Carne de res para asar (con y sin hueso)": "Carnes",
  "Carne de res sin hueso (posta)": "Carnes",
  "Carne de res con hueso para cocido": "Carnes",
  "Posta de cerdo sin hueso":     "Carnes",
  "Carne de pollo blanco":        "Carnes",
  "Carne de pollo amarillo":      "Carnes",
  "Salchichas y productos similares de carne": "Carnes",
  "Jamón (pollo, res, cerdo, mixto, etc.)": "Carnes",
  "Longanizas y chorizos (de todo tipo)": "Carnes",

  // Lácteos y huevos
  "Leche entera líquida industrializada": "Lácteos y huevos",
  "Crema artesanal":              "Lácteos y huevos",
  "Crema industrializada":        "Lácteos y huevos",
  "Queso fresco (Incluye el queso supercremoso)": "Lácteos y huevos",
  "Huevos de gallina de granja":  "Lácteos y huevos",

  // Aceites y grasas
  "Aceite vegetal mixtos":        "Aceites y grasas",
  "Margarina vegetal regular":    "Aceites y grasas",

  // Frutas
  "Aguacates frescos":            "Frutas",
  "Bananos frescos":              "Frutas",
  "Plátanos frescos":             "Frutas",
  "Papayas frescas":              "Frutas",
  "Limones y limas frescas":      "Frutas",
  "Manzanas frescas":             "Frutas",

  // Verduras y hortalizas
  "Lechuga, achicoria y rúgula, fresca o refrigerada": "Verduras y hortalizas",
  "Lechuga, achicoria y rugula, fresca o refrigerada": "Verduras y hortalizas",
  "Apio":                         "Verduras y hortalizas",
  "Cilantro, perejil y hierbabuena": "Verduras y hortalizas",
  "Macuy/Hierba mora/Quilete":    "Verduras y hortalizas",
  "Chile pimiento fresco":        "Verduras y hortalizas",
  "Pepinos y pepinillos, frescos o refrigerados": "Verduras y hortalizas",
  "Tomate fresco":                "Verduras y hortalizas",
  "Güisquil":                     "Verduras y hortalizas",
  "Zanahorias":                   "Verduras y hortalizas",
  "Cebollas":                     "Verduras y hortalizas",
  "Verduras frescas o refrigeradas limpias y cortadas (excluye las ensaladas)": "Verduras y hortalizas",
  "Papas":                        "Verduras y hortalizas",

  // Leguminosas
  "Frijoles negros, secos":       "Leguminosas",
  "Frijoles preparados, procesados y condimentados (enlatados o empaquetados)": "Leguminosas",

  // Azúcares
  "Azúcar de caña blanca":        "Azúcares",
  "Azúcar de caña morena":        "Azúcares",

  // Condimentos y otros
  "Sopas instantáneas (Vaso y bolsa)": "Condimentos y otros",
  "Sal":                          "Condimentos y otros",
  "Consomé":                      "Condimentos y otros",
  "Salsa de tomate (Ranchera, Queso etc.)": "Condimentos y otros",
  "Mayonesa":                     "Condimentos y otros",
  "Bases para sopas":             "Condimentos y otros",
  "Snacks (excluye papalinas, plataninas, yucas, malangas, etc.)": "Condimentos y otros",

  // Bebidas
  "Jugos de frutas líquidos":     "Bebidas",
  "Jugos de frutas en polvo":     "Bebidas",
  "Café molido":                  "Bebidas",
  "Café instantáneo":             "Bebidas",
  "Agua purificada":              "Bebidas",
  "Gaseosas":                     "Bebidas",
  "Atoles":                       "Bebidas",

  // Comidas preparadas
  "Desayuno o cena continental (bebida y dos acompañamientos elaborados)": "Comidas preparadas",
  "Almuerzo o cena simple (bebida, carne de pollo y acompañamiento) excluye gaseosa": "Comidas preparadas",
  "Tamales y paches":             "Comidas preparadas",
  "Piezas de pollo individual o entero (sin acompañamiento)": "Comidas preparadas",
};

// Función para obtener grupo por nombre de producto
function getGrupo(nombreProducto) {
  // Búsqueda exacta primero
  if (GRUPOS[nombreProducto]) return GRUPOS[nombreProducto];
  // Búsqueda parcial si no hay coincidencia exacta
  const key = Object.keys(GRUPOS).find(k =>
    nombreProducto.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(nombreProducto.toLowerCase())
  );
  return key ? GRUPOS[key] : "Otros";
}

// ── Recursos INE ──────────────────────────────────────────────
const RECURSOS = {
  cbauPercapita: {
    resourceId:  "6721d034-7af0-4622-ae34-be10f0f2ac89",
    xlsxUrl:     "https://datos.ine.gob.gt/dataset/0317e7b9-9563-4a9c-800f-c74473103063/resource/6721d034-7af0-4622-ae34-be10f0f2ac89/download/costo-cba-percapita_u.xlsx",
    descripcion: "Costo per cápita CBAU mensual",
  },
  cbarPercapita: {
    resourceId:  "69abf503-56da-4de5-9017-875009394843",
    xlsxUrl:     "https://datos.ine.gob.gt/dataset/0317e7b9-9563-4a9c-800f-c74473103063/resource/69abf503-56da-4de5-9017-875009394843/download/costo-cba-percapita_r.xlsx",
    descripcion: "Costo per cápita CBAR mensual",
  },
  cbauHistorico: {
    resourceId:  "595747ff-a866-4192-99fa-fc032a7795b7",
    xlsxUrl:     "https://datos.ine.gob.gt/dataset/0317e7b9-9563-4a9c-800f-c74473103063/resource/595747ff-a866-4192-99fa-fc032a7795b7/download/historico-cbau_es_2024-2026.xlsx",
    descripcion: "Histórico por producto CBAU",
  },
  cbarHistorico: {
    resourceId:  "23cf94ba-25e9-457b-87fd-a5c7c1e92bcd",
    xlsxUrl:     "https://datos.ine.gob.gt/dataset/0317e7b9-9563-4a9c-800f-c74473103063/resource/23cf94ba-25e9-457b-87fd-a5c7c1e92bcd/download/historico-cbar_es_2024-2026.xlsx",
    descripcion: "Histórico por producto CBAR",
  },
};

const INE_BASE  = "https://datos.ine.gob.gt/api/3/action";
const CACHE_DIR = path.join(__dirname, "../cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "es-GT,es;q=0.9",
  "Referer":         "https://datos.ine.gob.gt/",
};

let DB = {
  ultimaActualizacion: null,
  metodo: null,
  estado: "sin_datos",
  errores: [],
  cbauPercapita:    [],
  cbarPercapita:    [],
  productosUrbanos: [],
  productosRurales: [],
};

// ── Fetch CKAN ────────────────────────────────────────────────
async function fetchCKAN(resourceId, limit = 1000) {
  const url = `${INE_BASE}/datastore_search?resource_id=${resourceId}&limit=${limit}`;
  const resp = await axios.get(url, { timeout: 60000, headers: HEADERS });
  if (!resp.data?.success) throw new Error("CKAN devolvió success=false");
  return resp.data.result;
}

// ── Parser percápita ──────────────────────────────────────────
// Columnas reales INE: _id | Año | Mes | "Costo diario (Per cápita Q)" | "Costo mensual Per cápita (Q)"
function parseCKANPercapita(result) {
  return (result.records || []).map(row => {
    const anio     = row["Año"]  || row["Anio"] || "";
    const mes      = row["Mes"]  || "";
    const diario   = findVal(row, /diario/i);
    const mensual  = findVal(row, /mensual/i);
    if (!mes || mensual == null) return null;
    const costoMensual = parseFloat(mensual);
    if (isNaN(costoMensual)) return null;
    return {
      periodo:      `${mes} ${anio}`.trim(),
      costoDiario:  parseFloatSafe(diario),
      costoMensual: r2(costoMensual),
    };
  }).filter(Boolean);
}

// ── Parser histórico — asigna grupo por nombre de producto ────
// Columnas reales INE: _id | Año | Mes | Producto | Cantidad base | Unidad de medida base | ... | Precio según unidad de medida base
function parseCKANHistorico(result) {
  return (result.records || []).map(row => {
    const anio     = row["Año"]  || row["Anio"] || "";
    const mes      = row["Mes"]  || "";
    const producto = row["Producto"] || findVal(row, /producto|alimento/i);
    const cantidad = row["Cantidad base"] || findVal(row, /cantidad/i);
    const unidad   = row["Unidad de medida base"] || findVal(row, /unidad/i);
    // Precio: "Precio según unidad de medida base" es la columna real del INE
    const precio   = row["Precio seg\u00fan unidad de medida base"]
                  || row["Precio segun unidad de medida base"]
                  || row["Precio"]
                  || findVal(row, /precio/i);
    // Costo mensual del producto
    const costo    = row["Costo mensual"] || findVal(row, /costo.*mens|mens.*costo/i);

    if (!mes || !producto) return null;
    const nombreProducto = String(producto).trim();
    return {
      periodo:    `${mes} ${anio}`.trim(),
      grupo:      getGrupo(nombreProducto),   // ← asignado por nuestro mapa
      producto:   nombreProducto,
      cantidad:   parseFloatSafe(cantidad),
      unidad:     String(unidad || "").trim(),
      precio:     parseFloatSafe(precio),
      costoTotal: parseFloatSafe(costo),
    };
  }).filter(p => p && p.producto);
}

// ── Parser XLSX fallback ──────────────────────────────────────
function parseXLSXPercapita(buffer) {
  const wb    = XLSX.read(buffer, { type: "buffer" });
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  return filas.map(fila => {
    const keys = Object.keys(fila);
    const anioK    = keys.find(k => /a.o|year/i.test(k));
    const mesK     = keys.find(k => /^mes$/i.test(k));
    const diarioK  = keys.find(k => /diario/i.test(k));
    const mensualK = keys.find(k => /mensual/i.test(k));
    const periodo  = `${fila[mesK]||""} ${fila[anioK]||""}`.trim();
    const costoMensual = parseFloat(fila[mensualK]);
    if (!periodo || isNaN(costoMensual)) return null;
    return { periodo, costoDiario: parseFloatSafe(fila[diarioK]), costoMensual: r2(costoMensual) };
  }).filter(Boolean);
}

function parseXLSXHistorico(buffer) {
  const wb    = XLSX.read(buffer, { type: "buffer" });
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  return filas.map(fila => {
    const keys = Object.keys(fila);
    const anioK     = keys.find(k => /a.o|year/i.test(k));
    const mesK      = keys.find(k => /^mes$/i.test(k));
    const productoK = keys.find(k => /producto|alimento/i.test(k));
    const cantidadK = keys.find(k => /cantidad/i.test(k));
    const unidadK   = keys.find(k => /unidad/i.test(k));
    const precioK   = keys.find(k => /precio/i.test(k));
    const totalK    = keys.find(k => /costo.*mens|total/i.test(k));
    const periodo   = `${fila[mesK]||""} ${fila[anioK]||""}`.trim();
    const producto  = String(fila[productoK]||"").trim();
    if (!periodo || !producto) return null;
    return {
      periodo, producto,
      grupo:     getGrupo(producto),
      cantidad:  parseFloatSafe(fila[cantidadK]),
      unidad:    String(fila[unidadK]||"").trim(),
      precio:    parseFloatSafe(fila[precioK]),
      costoTotal:parseFloatSafe(fila[totalK]),
    };
  }).filter(Boolean);
}

// ── Descarga XLSX ─────────────────────────────────────────────
async function fetchXLSX(clave, recurso) {
  const archivo = path.join(CACHE_DIR, `${clave}.xlsx`);
  try {
    console.log(`    ↓ Descargando XLSX: ${recurso.descripcion}`);
    const resp = await axios.get(recurso.xlsxUrl, { responseType:"arraybuffer", timeout:90000, headers:HEADERS });
    fs.writeFileSync(archivo, resp.data);
    return resp.data;
  } catch (e) {
    if (fs.existsSync(archivo)) { console.warn(`    ⚠ Usando caché XLSX: ${clave}`); return fs.readFileSync(archivo); }
    throw new Error(`No se pudo obtener ${clave}: ${e.message}`);
  }
}

// ── Función principal ─────────────────────────────────────────
async function fetchAndParseAllData() {
  DB.estado = "cargando"; DB.errores = []; DB.metodo = null;

  let usarCKAN = false;
  console.log("  🔍 Probando API CKAN del INE (timeout: 60s)...");
  try {
    const test = await fetchCKAN(RECURSOS.cbauPercapita.resourceId, 1);
    usarCKAN = true;
    console.log(`  ✓ CKAN accesible — ${test.total} registros`);
  } catch(e) {
    console.log(`  ⚠ CKAN no accesible: ${e.message} → usando XLSX`);
  }

  const tareas = [
    { clave:"cbauPercapita", dbField:"cbauPercapita",    ckanP:parseCKANPercapita,  xlsxP:parseXLSXPercapita },
    { clave:"cbarPercapita", dbField:"cbarPercapita",    ckanP:parseCKANPercapita,  xlsxP:parseXLSXPercapita },
    { clave:"cbauHistorico", dbField:"productosUrbanos", ckanP:parseCKANHistorico,  xlsxP:parseXLSXHistorico },
    { clave:"cbarHistorico", dbField:"productosRurales", ckanP:parseCKANHistorico,  xlsxP:parseXLSXHistorico },
  ];

  for (const t of tareas) {
    console.log(`\n  📡 ${RECURSOS[t.clave].descripcion}...`);
    try {
      let datos;
      if (usarCKAN) {
        const result = await fetchCKAN(RECURSOS[t.clave].resourceId, 2000);
        datos = t.ckanP(result);
        fs.writeFileSync(path.join(CACHE_DIR, `${t.clave}.json`), JSON.stringify({ ts: new Date().toISOString(), datos }, null, 2));
      } else {
        const jsonPath = path.join(CACHE_DIR, `${t.clave}.json`);
        if (fs.existsSync(jsonPath)) {
          const cached = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          if ((Date.now() - new Date(cached.ts)) / 3600000 < 25) {
            console.log(`    ✓ Caché JSON válido`); datos = cached.datos;
          }
        }
        if (!datos) {
          const buffer = await fetchXLSX(t.clave, RECURSOS[t.clave]);
          datos = t.xlsxP(buffer);
          fs.writeFileSync(path.join(CACHE_DIR, `${t.clave}.json`), JSON.stringify({ ts: new Date().toISOString(), datos }, null, 2));
        }
      }
      DB[t.dbField] = datos;
      console.log(`    ✓ ${datos.length} registros cargados`);
    } catch(e) {
      console.error(`    ✗ Error: ${e.message}`);
      DB.errores.push({ recurso: t.clave, error: e.message });
      const jsonPath = path.join(CACHE_DIR, `${t.clave}.json`);
      if (fs.existsSync(jsonPath)) {
        try { const c = JSON.parse(fs.readFileSync(jsonPath,"utf8")); DB[t.dbField]=c.datos; console.log(`    ⚠ Caché disco: ${c.datos.length} registros`); } catch{}
      }
    }
  }

  DB.metodo             = usarCKAN ? "ckan" : "xlsx";
  DB.ultimaActualizacion = new Date().toISOString();
  DB.estado = DB.errores.length === 0 ? "ok" : DB.errores.length === tareas.length ? "error" : "error_parcial";
  console.log(`\n  ════ estado: ${DB.estado} | método: ${DB.metodo} ════\n`);
  return DB;
}

// ── Helpers ───────────────────────────────────────────────────
function r2(n)             { return Math.round(n * 100) / 100; }
function parseFloatSafe(v) { const n = parseFloat(v); return isNaN(n) ? null : r2(n); }
function findVal(obj, re)  { const k = Object.keys(obj).find(k => re.test(k)); return k ? obj[k] : null; }

// ── Getters ───────────────────────────────────────────────────
function getDB() { return DB; }
function getPeriodos() { return [...new Set(DB.cbauPercapita.map(r => r.periodo))]; }

function getResumen() {
  const u = DB.cbauPercapita; const r = DB.cbarPercapita;
  if (!u.length || !r.length) return null;
  const lu=u[u.length-1]; const pu=u[u.length-2];
  const lr=r[r.length-1]; const pr=r[r.length-2];
  return {
    ultimoPeriodo:     lu.periodo,
    cbauPerCapita:     lu.costoMensual,
    cbarPerCapita:     lr.costoMensual,
    variacionMensualU: pu ? r2(((lu.costoMensual-pu.costoMensual)/pu.costoMensual)*100) : null,
    variacionMensualR: pr ? r2(((lr.costoMensual-pr.costoMensual)/pr.costoMensual)*100) : null,
    variacionAnualU:   u.length>=13 ? r2(((lu.costoMensual-u[u.length-13].costoMensual)/u[u.length-13].costoMensual)*100) : null,
    variacionAnualR:   r.length>=13 ? r2(((lr.costoMensual-r[r.length-13].costoMensual)/r[r.length-13].costoMensual)*100) : null,
    brechaUrbanoRural: r2(lu.costoMensual - lr.costoMensual),
    metodoObtencion:   DB.metodo,
  };
}

function getHistorico() {
  const mapU={}; DB.cbauPercapita.forEach(r=>{mapU[r.periodo]=r.costoMensual;});
  const mapR={}; DB.cbarPercapita.forEach(r=>{mapR[r.periodo]=r.costoMensual;});
  return [...new Set([...Object.keys(mapU),...Object.keys(mapR)])].map(p=>({
    periodo:p, cbau:mapU[p]??null, cbar:mapR[p]??null,
    brecha:mapU[p]&&mapR[p]?r2(mapU[p]-mapR[p]):null,
  }));
}

function getMensual(periodo) {
  const up=periodo.toUpperCase();
  return {
    urbanos: DB.productosUrbanos.filter(p=>p.periodo.toUpperCase().includes(up)),
    rurales: DB.productosRurales.filter(p=>p.periodo.toUpperCase().includes(up)),
  };
}

function getProductos(filtros={}) {
  let datos = DB.productosUrbanos;
  if (filtros.periodo) datos=datos.filter(p=>p.periodo.toUpperCase().includes(filtros.periodo.toUpperCase()));
  if (filtros.grupo)   datos=datos.filter(p=>p.grupo.toLowerCase().includes(filtros.grupo.toLowerCase()));
  if (filtros.nombre)  datos=datos.filter(p=>p.producto.toLowerCase().includes(filtros.nombre.toLowerCase()));
  return datos;
}

function getVariaciones() {
  const periodos=[...new Set(DB.productosUrbanos.map(p=>p.periodo))].sort();
  if (periodos.length<2) return [];
  const ultimo=periodos[periodos.length-1];
  const anterior=periodos[periodos.length-2];
  const mapU={}; DB.productosUrbanos.filter(p=>p.periodo===ultimo)  .forEach(p=>{mapU[p.producto]=p;});
  const mapA={}; DB.productosUrbanos.filter(p=>p.periodo===anterior).forEach(p=>{mapA[p.producto]=p;});
  return Object.keys(mapU).map(nombre=>{
    const actual=mapU[nombre]; const prev=mapA[nombre];
    const variacion=actual.precio&&prev?.precio?r2(((actual.precio-prev.precio)/prev.precio)*100):null;
    return {producto:nombre,grupo:actual.grupo,periodoActual:ultimo,periodoAnterior:anterior,
            precioActual:actual.precio,precioAnterior:prev?.precio??null,variacionPct:variacion};
  }).sort((a,b)=>(b.variacionPct??0)-(a.variacionPct??0));
}

function getCategorias() {
  // Solo usar el último período — evita acumular todos los meses históricos
  const MESES={"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
    "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12};
  const sortP=p=>{const s=(p||"").toLowerCase().split(" ");return(parseInt(s[1])||0)*100+(MESES[s[0]]||0);};
  const periodos=[...new Set(DB.productosUrbanos.map(p=>p.periodo))].sort((a,b)=>sortP(a)-sortP(b));
  const ultimoPeriodo=periodos[periodos.length-1];
  const soloUltimo=DB.productosUrbanos.filter(p=>p.periodo===ultimoPeriodo);

  const grupos={};
  soloUltimo.forEach(p=>{
    if (!grupos[p.grupo]) grupos[p.grupo]={grupo:p.grupo,productos:new Set(),costoTotal:0};
    grupos[p.grupo].productos.add(p.producto);
    if (p.precio) grupos[p.grupo].costoTotal+=p.precio;
  });
  return Object.values(grupos).map(g=>({
    grupo:g.grupo, numProductos:g.productos.size, costoTotal:r2(g.costoTotal),
  })).sort((a,b)=>b.costoTotal-a.costoTotal);
}

module.exports = {
  fetchAndParseAllData, getDB, getResumen, getHistorico,
  getMensual, getProductos, getVariaciones, getCategorias, getPeriodos,
};
