import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend
} from "recharts";

const API_BASE = "http://localhost:3001/api/v1";

// ── Paleta de colores (referencia imagen) ────────────────────
const LIGHT = {
  bg:         "#f0f4f8",
  card:       "#ffffff",
  sidebar:    "#0d1f2d",
  sidebarSub: "#1a3347",
  text:       "#0d1f2d",
  textSub:    "#64748b",
  textMuted:  "#94a3b8",
  border:     "#e2e8f0",
  accent:     "#10b981",   // esmeralda — color principal
  accentSoft: "#ecfdf5",
  accentDark: "#059669",
  positive:   "#10b981",
  negative:   "#ef4444",
  neutral:    "#f59e0b",
  gridLine:   "#f1f5f9",
  input:      "#f8fafc",
  navBg:      "#ffffff",
  navBorder:  "#e2e8f0",
};
const DARK = {
  bg:         "#060f1a",
  card:       "#0d1f2d",
  sidebar:    "#060f1a",
  sidebarSub: "#0d1f2d",
  text:       "#e2e8f0",
  textSub:    "#64748b",
  textMuted:  "#334155",
  border:     "#1e3347",
  accent:     "#10b981",
  accentSoft: "#042f1e",
  accentDark: "#34d399",
  positive:   "#34d399",
  negative:   "#f87171",
  neutral:    "#fbbf24",
  gridLine:   "#0d1f2d",
  input:      "#0d1f2d",
  navBg:      "#0d1f2d",
  navBorder:  "#1e3347",
};

// ── Colores por grupo alimenticio ────────────────────────────
const CAT_COLORS = {
  "Cereales y derivados":    "#10b981",
  "Verduras y hortalizas":   "#22c55e",
  "Carnes":                  "#ef4444",
  "Lácteos y huevos":        "#3b82f6",
  "Aceites y grasas":        "#8b5cf6",
  "Leguminosas":             "#f59e0b",
  "Azúcares":                "#ec4899",
  "Frutas":                  "#06b6d4",
  "Bebidas":                 "#0ea5e9",
  "Condimentos y otros":     "#f97316",
  "Comidas preparadas":      "#a855f7",
  "Otros":                   "#64748b",
};

// ── Fallback ─────────────────────────────────────────────────
const FB_RESUMEN = {
  ultimoPeriodo:"Enero 2026", cbauPerCapita:2237.85, cbarPerCapita:1403.97,
  variacionMensualU:0.42, variacionMensualR:0.29,
  variacionAnualU:7.4, variacionAnualR:6.8, brechaUrbanoRural:833.88,
};
const FB_HISTORICO = [
  {mes:"Ene 24",cbau:2022,cbar:1274},{mes:"Feb 24",cbau:2030,cbar:1278},
  {mes:"Mar 24",cbau:2041,cbar:1285},{mes:"Abr 24",cbau:2058,cbar:1295},
  {mes:"May 24",cbau:2079,cbar:1307},{mes:"Jun 24",cbau:2095,cbar:1315},
  {mes:"Jul 24",cbau:2108,cbar:1323},{mes:"Ago 24",cbau:2122,cbar:1332},
  {mes:"Sep 24",cbau:2135,cbar:1340},{mes:"Oct 24",cbau:2149,cbar:1349},
  {mes:"Nov 24",cbau:2162,cbar:1358},{mes:"Dic 24",cbau:2179,cbar:1368},
  {mes:"Ene 25",cbau:2195,cbar:1379},{mes:"Feb 25",cbau:2209,cbar:1388},
  {mes:"Mar 25",cbau:2219,cbar:1395},{mes:"Abr 25",cbau:2228,cbar:1400},
  {mes:"Ene 26",cbau:2238,cbar:1404},
];
const FB_PRODUCTOS = [
  {nombre:"Tortillas frescas",grupo:"Cereales y derivados",precio:4,unidad:"Gramos",cambio:0},
  {nombre:"Arroz corriente",grupo:"Cereales y derivados",precio:8,unidad:"Gramos",cambio:0},
  {nombre:"Frijoles negros, secos",grupo:"Leguminosas",precio:8,unidad:"Gramos",cambio:0},
  {nombre:"Tomate fresco",grupo:"Verduras y hortalizas",precio:6,unidad:"Gramos",cambio:0},
  {nombre:"Huevos de gallina de granja",grupo:"Lácteos y huevos",precio:1,unidad:"Gramos",cambio:0},
  {nombre:"Carne de pollo blanco",grupo:"Carnes",precio:15,unidad:"Gramos",cambio:0},
  {nombre:"Leche entera líquida industrializada",grupo:"Lácteos y huevos",precio:13,unidad:"Mililitros",cambio:0},
  {nombre:"Aceite vegetal mixtos",grupo:"Aceites y grasas",precio:23,unidad:"Mililitros",cambio:0},
  {nombre:"Azúcar de caña blanca",grupo:"Azúcares",precio:4,unidad:"Gramos",cambio:0},
  {nombre:"Café molido",grupo:"Bebidas",precio:42,unidad:"Gramos",cambio:0},
];

const MESES_ORD = {
  "enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
  "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12
};
const sortPer = p => {
  const s=(p||"").toLowerCase().split(" ");
  return (parseInt(s[1])||0)*100+(MESES_ORD[s[0]]||0);
};
const fQ = n => `Q${(+n||0).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// ── HOOK ─────────────────────────────────────────────────────
function useINEApi() {
  const [status,      setStatus]      = useState("idle");
  const [resumen,     setResumen]     = useState(null);
  const [historico,   setHistorico]   = useState([]);
  const [productos,   setProductos]   = useState([]);
  const [variaciones, setVariaciones] = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [serverInfo,  setServerInfo]  = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [iaKeyOk,     setIaKeyOk]     = useState(null);
  const [periodos,    setPeriodos]    = useState([]);
  const [periodoSel,  setPeriodoSel]  = useState(null);

  const addLog = useCallback((msg,type="info") => {
    const ts=new Date().toLocaleTimeString("es-GT");
    setLogs(p=>[...p.slice(-14),{ts,msg,type}]);
  },[]);

  const get = useCallback(async path => {
    const r=await fetch(`${API_BASE}${path}`);
    const j=await r.json();
    if(!j.ok) throw new Error(j.error||`Error en ${path}`);
    return j;
  },[]);

  const loadFallback = useCallback(motivo => {
    addLog(`→ ${motivo}. Datos de respaldo.`,"warn");
    setResumen(FB_RESUMEN); setHistorico(FB_HISTORICO); setProductos(FB_PRODUCTOS);
    setVariaciones(FB_PRODUCTOS.map(p=>({producto:p.nombre,grupo:p.grupo,variacionPct:p.cambio,precioActual:p.precio,precioAnterior:p.precio,periodoActual:"",periodoAnterior:""})));
    setCategorias(Object.entries(FB_PRODUCTOS.reduce((a,p)=>{a[p.grupo]=(a[p.grupo]||0)+p.precio;return a;},{})).map(([grupo,costoTotal])=>({grupo,costoTotal:+costoTotal.toFixed(2),numProductos:FB_PRODUCTOS.filter(p=>p.grupo===grupo).length})));
    setStatus("fallback");
  },[addLog]);

  const connect = useCallback(async () => {
    setStatus("connecting"); setLogs([]);
    addLog(`Conectando a ${API_BASE}…`);
    try {
      const st=await get("/status");
      setServerInfo(st.data); setIaKeyOk(st.data.iaDisponible);
      if(st.data.periodos?.length){
        setPeriodos([...st.data.periodos].sort((a,b)=>sortPer(a)-sortPer(b)));
      }
      addLog(`✓ Servidor OK · ${st.data.estado}`,"success");
      if(st.data.estado==="sin_datos"||st.data.estado==="cargando"){
        addLog("⚠ Cargando datos, reintentando en 5s…","warn");
        setTimeout(connect,5000); return;
      }
      const res=await get("/canasta/resumen"); setResumen(res.data);
      const hist=await get("/canasta/historico"); setHistorico(hist.data.map(h=>({...h,mes:h.periodo?.replace(" 20","'")?.replace("iembre","").replace("ubre","").replace("iembre","").replace("tiembre","").replace("osto","").replace("unio","").replace("ulio","").replace("arzo","").replace("bril","").replace("nero","").replace("brero","").replace("ayo","")||h.periodo})));
      const vars=await get("/variaciones"); setVariaciones(vars.data);
      const cats=await get("/categorias"); setCategorias(cats.data);
      const prods=await get("/productos");
      setProductos(prods.data.map(p=>({nombre:p.producto,grupo:p.grupo,precio:p.precio??0,unidad:p.unidad??"—",cambio:p.variacionPct??0,periodo:p.periodo??"",precioAnterior:p.precioAnterior??null})));
      if(prods.ultimoPeriodo) setPeriodoSel(prods.ultimoPeriodo);
      setLastUpdated(new Date().toLocaleString("es-GT"));
      setStatus("live");
      addLog("✅ Todo cargado.","success");
    } catch(e){
      addLog(`✗ ${e.message}`,"error");
      loadFallback("Backend no disponible");
    }
  },[addLog,get,loadFallback]);

  const forceRefresh = useCallback(async()=>{
    addLog("⟳ Actualizando…");
    try{await get("/admin/refresh"); addLog("✓ OK","success"); await connect();}
    catch(e){addLog(`✗ ${e.message}`,"error");}
  },[addLog,get,connect]);

  const fetchProductosPorPeriodo = useCallback(async(periodo)=>{
    addLog(`📅 Cargando ${periodo}…`);
    try {
      const prods=await get(`/productos?periodo=${encodeURIComponent(periodo)}`);
      const perOrdenados=[...periodos].sort((a,b)=>sortPer(a)-sortPer(b));
      const idx=perOrdenados.indexOf(periodo);
      let varMap={};
      if(idx>0){
        const ant=perOrdenados[idx-1];
        const prodsAnt=await get(`/productos?periodo=${encodeURIComponent(ant)}`);
        prodsAnt.data.forEach(p=>{varMap[p.producto]=p.precio;});
      }
      setPeriodoSel(periodo);
      setProductos(prods.data.map(p=>{
        const pa=varMap[p.producto];
        const cambio=(p.precio&&pa)?Math.round(((p.precio-pa)/pa)*10000)/100:(p.variacionPct??0);
        return{nombre:p.producto,grupo:p.grupo,precio:p.precio??0,unidad:p.unidad??"—",cambio,periodo:p.periodo??"",precioAnterior:pa??null};
      }));
      addLog(`✓ ${prods.data.length} productos · ${periodo}`,"success");
    }catch(e){addLog(`✗ ${e.message}`,"error");}
  },[addLog,get,periodos]);

  const iaAnalisis  = useCallback(async()=>{const j=await get("/ia/canasta"); return j.data;},[get]);
  const iaProducto  = useCallback(async(n)=>{const j=await get(`/ia/producto/${encodeURIComponent(n)}`); return j.data;},[get]);
  const iaReporte   = useCallback(async()=>{const j=await get("/ia/reporte"); return j.data;},[get]);

  return{status,resumen,historico,productos,variaciones,categorias,serverInfo,logs,lastUpdated,
    iaKeyOk,periodos,periodoSel,connect,forceRefresh,iaAnalisis,iaProducto,iaReporte,fetchProductosPorPeriodo};
}

// ── COMPONENTES BASE ──────────────────────────────────────────
const Tip=({active,payload,label,t})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 16px",fontSize:12,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>
      <div style={{fontWeight:700,color:t.text,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
          <span style={{color:t.textSub}}>{p.name}:</span>
          <strong style={{color:t.text}}>{typeof p.value==="number"?fQ(p.value):p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const ChangeBadge=({value})=>{
  const v=value??0; const z=v===0||value===null;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:3,
      background:z?"#f1f5f9":v>0?"#fef2f2":"#f0fdf4",
      color:z?"#64748b":v>0?"#ef4444":"#10b981",
      borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700}}>
      {z?"—":v>0?"↑":"↓"} {z?"0.00":Math.abs(v).toFixed(2)}%
    </span>
  );
};

// KPI Card — estilo imagen referencia
const KPI=({label,value,sub,subIcon,subColor,t})=>(
  <div style={{background:t.card,borderRadius:14,padding:"22px 24px",
    border:`1px solid ${t.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
    <div style={{fontSize:11,color:t.textMuted,fontWeight:600,
      textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>{label}</div>
    <div style={{fontSize:30,fontWeight:800,color:t.text,lineHeight:1,marginBottom:10}}>{value}</div>
    {sub&&(
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:13}}>
        <span style={{color:subColor||t.accent,fontWeight:700}}>{subIcon}{sub}</span>
        <span style={{color:t.textSub}}>vs mes anterior</span>
      </div>
    )}
  </div>
);

// Barra de progreso para grupos (panel derecho)
const BarraGrupo=({nombre,valor,max,t})=>(
  <div style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
      <span style={{fontSize:13,color:t.text,fontWeight:500}}>{nombre}</span>
      <span style={{fontSize:13,color:t.textSub,fontWeight:600}}>Q{Math.round(valor)}</span>
    </div>
    <div style={{height:5,background:t.border,borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min((valor/max)*100,100)}%`,
        background:t.accent,borderRadius:3,transition:"width .5s ease"}}/>
    </div>
  </div>
);

// Panel IA
function IAPanel({api,t}) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const cargar=async()=>{setLoading(true);setError(null);try{setData(await api.iaAnalisis());}catch(e){setError(e.message);}setLoading(false);};
  if(!api.iaKeyOk&&api.iaKeyOk!==null) return(
    <div style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`,height:"100%",boxSizing:"border-box"}}>
      <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:12}}>Análisis IA</div>
      <div style={{background:t.accentSoft,borderRadius:10,padding:14,border:`1px solid ${t.accent}33`}}>
        <div style={{fontSize:12,fontWeight:700,color:t.accent,marginBottom:6}}>API Key no configurada</div>
        <div style={{fontSize:12,color:t.textSub,lineHeight:1.7}}>
          Agrega <code style={{background:t.border,borderRadius:4,padding:"1px 5px",fontSize:11}}>OPENAI_API_KEY</code> en el <strong>.env</strong> del backend.
        </div>
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
          style={{display:"inline-block",marginTop:10,fontSize:12,color:t.accent,fontWeight:600}}>
          Obtener API Key →
        </a>
      </div>
    </div>
  );
  return(
    <div style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`,display:"flex",flexDirection:"column",height:"100%",boxSizing:"border-box"}}>
      <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:14}}>Análisis IA</div>
      {error&&<div style={{background:"#fef2f2",borderRadius:8,padding:10,marginBottom:10,fontSize:12,color:"#ef4444"}}>{error}</div>}
      {data?(
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
          {[{label:"Situación",content:data.resumen,accent:"#3b82f6"},
            {label:"Alerta",content:data.alerta,accent:"#f59e0b"},
            {label:"Consejo",content:data.recomendacion,accent:t.accent},
          ].filter(x=>x.content).map((x,i)=>(
            <div key={i} style={{background:t.bg,borderRadius:10,padding:12,border:`1px solid ${t.border}`}}>
              <div style={{fontSize:10,fontWeight:700,color:x.accent,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>{x.label}</div>
              <div style={{fontSize:12,color:t.textSub,lineHeight:1.65}}>{x.content}</div>
            </div>
          ))}
          <button onClick={()=>setData(null)} style={{marginTop:"auto",background:"transparent",border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,color:t.textSub,fontWeight:600}}>Nuevo análisis</button>
        </div>
      ):(
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:12,textAlign:"center"}}>
          <div style={{width:48,height:48,borderRadius:12,background:t.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🧠</div>
          <div style={{fontSize:13,color:t.textSub,lineHeight:1.7,maxWidth:220}}>Claude analiza los datos reales del INE y genera observaciones contextualizadas.</div>
          <button onClick={cargar} disabled={loading} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",cursor:loading?"not-allowed":"pointer",fontSize:13,fontWeight:700,opacity:loading?0.7:1}}>
            {loading?"Analizando…":"✨ Generar análisis IA"}
          </button>
        </div>
      )}
    </div>
  );
}

// Reporte IA
function ReportePage({api,t}) {
  const [rep,setRep]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const gen=async()=>{setLoading(true);setError(null);try{setRep(await api.iaReporte());}catch(e){setError(e.message);}setLoading(false);};
  return(
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Reportes</div>
        <h1 style={{fontSize:26,fontWeight:800,color:t.text,margin:0}}>Reporte Ejecutivo IA</h1>
        <p style={{color:t.textSub,fontSize:13,marginTop:4}}>Análisis narrativo generado por IA · datos del INE Guatemala</p>
      </div>
      {!api.iaKeyOk&&api.iaKeyOk!==null?(
        <div style={{background:t.card,borderRadius:14,padding:40,border:`1px solid ${t.border}`,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔑</div>
          <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:8}}>API Key requerida</div>
          <div style={{fontSize:13,color:t.textSub,marginBottom:16}}>Agrega tu clave en el archivo <code>.env</code> del backend.</div>
          <a href="https://platform.openai.com" target="_blank" rel="noreferrer"
            style={{background:t.accent,color:"#fff",borderRadius:10,padding:"10px 24px",textDecoration:"none",fontWeight:700,fontSize:13}}>Obtener API Key →</a>
        </div>
      ):!rep?(
        <div style={{background:t.card,borderRadius:14,padding:40,border:`1px solid ${t.border}`,textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:16,background:t.accentSoft,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📝</div>
          <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:8}}>Reporte ejecutivo mensual</div>
          <div style={{fontSize:13,color:t.textSub,marginBottom:20,lineHeight:1.7,maxWidth:360,margin:"0 auto 20px"}}>Genera un análisis completo con costos, productos críticos y perspectivas.</div>
          {error&&<div style={{background:"#fef2f2",borderRadius:10,padding:12,marginBottom:14,fontSize:12,color:"#ef4444"}}>{error}</div>}
          <button onClick={gen} disabled={loading} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:700,opacity:loading?0.7:1}}>
            {loading?"⟳ Generando…":"Generar reporte con IA"}
          </button>
          {loading&&<div style={{fontSize:12,color:t.textSub,marginTop:10}}>Puede tardar 10–20 segundos…</div>}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:t.accent,borderRadius:14,padding:24,color:"#fff"}}>
            <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",opacity:0.8,marginBottom:8}}>Reporte · INE Guatemala</div>
            <div style={{fontSize:20,fontWeight:800,lineHeight:1.3}}>{rep.titulo}</div>
          </div>
          {[{titulo:"Introducción",content:rep.introduccion},{titulo:"Análisis de costos",content:rep.analisisCostos},{titulo:"Productos críticos",content:rep.productosCriticos},{titulo:"Brecha urbano-rural",content:rep.brechaDesigualdad},{titulo:"Perspectivas",content:rep.perspectivas},{titulo:"Conclusiones",content:rep.conclusiones}]
            .filter(s=>s.content).map((s,i)=>(
            <div key={i} style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`}}>
              <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:10}}>{s.titulo}</div>
              <div style={{fontSize:13,color:t.textSub,lineHeight:1.8,whiteSpace:"pre-line"}}>{s.content}</div>
            </div>
          ))}
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setRep(null)} style={{background:"transparent",border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 20px",cursor:"pointer",fontSize:13,color:t.textSub,fontWeight:600}}>Nuevo reporte</button>
            <button onClick={()=>{const b=new Blob([Object.entries(rep).map(([k,v])=>`## ${k}\n${v}`).join("\n\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="reporte-cba.txt";a.click();}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontSize:13,fontWeight:700}}>
              Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PANEL GENERAL ─────────────────────────────────────────────
function OverviewPage({api,t}) {
  const{resumen,historico,categorias,connect,status,lastUpdated}=api;
  const r=resumen||FB_RESUMEN;
  const h=historico.length?historico:FB_HISTORICO;

  // Grupos para barras de progreso
  const cats=(categorias.length?categorias:Object.entries(FB_PRODUCTOS.reduce((a,p)=>{a[p.grupo]=(a[p.grupo]||0)+p.precio;return a;},{})).map(([grupo,costoTotal])=>({grupo,costoTotal:+costoTotal.toFixed(2)})))
    .sort((a,b)=>b.costoTotal-a.costoTotal).slice(0,7);
  const maxCat=cats[0]?.costoTotal||1;

  const now=new Date();
  const dateStr=`${r.ultimoPeriodo} · Guatemala · ${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")}/${now.getFullYear()}`;

  return(
    <div>
      {/* Top bar de página */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>
            Panel General
          </div>
          <h1 style={{fontSize:26,fontWeight:800,color:t.text,margin:0,lineHeight:1.1}}>
            Canasta Básica Alimentaria
          </h1>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          {/* Badge En vivo */}
          {status==="live"&&(
            <div style={{display:"flex",alignItems:"center",gap:6,background:t.accentSoft,border:`1px solid ${t.accent}44`,borderRadius:20,padding:"6px 14px"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:t.accent,animation:"pulse 2s infinite",flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:700,color:t.accent}}>En vivo</span>
            </div>
          )}
          <span style={{fontSize:12,color:t.textSub}}>{dateStr}</span>
          <button onClick={connect} disabled={status==="connecting"}
            style={{display:"flex",alignItems:"center",gap:8,background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:status==="connecting"?"not-allowed":"pointer",fontSize:13,fontWeight:700,opacity:status==="connecting"?0.7:1}}>
            ↻ {status==="connecting"?"Conectando…":"Actualizar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:16,marginBottom:24}}>
        <KPI label="CBAI per cápita" value={fQ(r.cbauPerCapita)}
          sub={`${r.variacionMensualU>0?"+":""}${r.variacionMensualU}%`}
          subIcon={r.variacionMensualU>0?"↗ ":"↘ "} subColor={r.variacionMensualU>0?t.positive:t.negative} t={t}/>
        <KPI label="CBAR per cápita" value={fQ(r.cbarPerCapita)}
          sub={`${r.variacionMensualR>0?"+":""}${r.variacionMensualR}%`}
          subIcon={r.variacionMensualR>0?"↗ ":"↘ "} subColor={r.variacionMensualR>0?t.positive:t.negative} t={t}/>
        <KPI label="Brecha CBAI-CBAR" value={fQ(r.brechaUrbanoRural)}
          sub="-0.6% reducción mensual" subColor={t.positive} t={t}/>
        <KPI label="Var. anual CBAI" value={`${r.variacionAnualU??"-"}%`}
          sub={`+${r.variacionAnualU??0}pp interanual`} subIcon="↗ " subColor={t.positive} t={t}/>
      </div>

      {/* Gráfica + Grupos */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:18,marginBottom:18}}>
        {/* Área chart */}
        <div style={{background:t.card,borderRadius:14,padding:24,border:`1px solid ${t.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:t.text}}>Evolución CBAI vs CBAR — per cápita mensual (Q)</div>
              <div style={{fontSize:12,color:t.textSub,marginTop:2}}>Fuente: INE Guatemala · valores reales</div>
            </div>
            <div style={{display:"flex",gap:16,fontSize:12}}>
              <span style={{display:"flex",alignItems:"center",gap:5,color:t.textSub}}><span style={{width:20,height:2,background:t.accent,borderRadius:1,display:"inline-block"}}/>CBAI</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:t.textSub}}><span style={{width:20,height:2,background:"#94a3b8",borderRadius:1,display:"inline-block",borderStyle:"dashed"}}/>CBAR</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={h} margin={{top:10,right:4,bottom:0,left:0}}>
              <defs>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={t.accent} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={t.accent} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.gridLine} vertical={false}/>
              <XAxis dataKey="mes" tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false} interval={2}/>
              <YAxis tick={{fill:t.textMuted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`Q${v}`} width={58}/>
              <Tooltip content={<Tip t={t}/>}/>
              <Area type="monotone" dataKey="cbau" name="CBAI" stroke={t.accent} strokeWidth={2.5} fill="url(#gU)" dot={false} activeDot={{r:4,fill:t.accent}}/>
              <Area type="monotone" dataKey="cbar" name="CBAR" stroke="#94a3b8" strokeWidth={2} fill="url(#gR)" dot={false} strokeDasharray="4 3" activeDot={{r:3,fill:"#94a3b8"}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Costo por grupo — barras horizontales */}
        <div style={{background:t.card,borderRadius:14,padding:24,border:`1px solid ${t.border}`}}>
          <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Costo por Grupo Alimenticio (Q)</div>
          <div style={{fontSize:12,color:t.textSub,marginBottom:20}}>Último período disponible</div>
          {cats.map((c,i)=>(
            <BarraGrupo key={i} nombre={c.grupo?.length>14?c.grupo.substring(0,14)+"…":c.grupo} valor={c.costoTotal} max={maxCat} t={t}/>
          ))}
        </div>
      </div>

      {/* Gráfica barras grupos + IA */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:18}}>
        <div style={{background:t.card,borderRadius:14,padding:24,border:`1px solid ${t.border}`}}>
          <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:4}}>Costo acumulado por grupo alimenticio (Q)</div>
          <div style={{fontSize:12,color:t.textSub,marginBottom:16}}>Suma de precios unitarios por categoría</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(categorias.length?categorias:Object.entries(FB_PRODUCTOS.reduce((a,p)=>{a[p.grupo]=(a[p.grupo]||0)+p.precio;return a;},{})).map(([grupo,costoTotal])=>({grupo,costoTotal}))).map(c=>({name:c.grupo?.length>11?c.grupo.substring(0,11)+"…":c.grupo,value:c.costoTotal,fill:CAT_COLORS[c.grupo]||t.accent}))} margin={{top:4,right:4,bottom:30,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.gridLine} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={50}/>
              <YAxis tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`Q${v}`} width={44}/>
              <Tooltip content={<Tip t={t}/>}/>
              <Bar dataKey="value" name="Costo" radius={[6,6,0,0]}>
                {(categorias.length?categorias:Object.entries(FB_PRODUCTOS.reduce((a,p)=>{a[p.grupo]=(a[p.grupo]||0)+p.precio;return a;},{})).map(([grupo,costoTotal])=>({grupo,costoTotal}))).map((c,i)=>(
                  <Cell key={i} fill={CAT_COLORS[c.grupo]||t.accent}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{minHeight:300}}>
          <IAPanel api={api} t={t}/>
        </div>
      </div>

      {/* Animación pulse para "En vivo" */}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── PRODUCTOS ─────────────────────────────────────────────────
function ProductosPage({api,t}) {
  const{productos,iaProducto,iaKeyOk,periodos,periodoSel,fetchProductosPorPeriodo,status}=api;
  const periodosOrdenados=useMemo(()=>[...periodos].sort((a,b)=>sortPer(a)-sortPer(b)),[periodos]);
  const periodoActual=periodoSel||(periodosOrdenados.length?periodosOrdenados[periodosOrdenados.length-1]:null);
  const lista=productos.length?productos:FB_PRODUCTOS;
  const [search,setSearch]=useState("");
  const [cat,setCat]=useState("Todos");
  const [modal,setModal]=useState(null);
  const [iaData,setIaData]=useState({});
  const [iaLoading,setIaLoading]=useState({});
  const [showPerMenu,setShowPerMenu]=useState(false);

  useEffect(()=>{
    if(!showPerMenu) return;
    const close=()=>setShowPerMenu(false);
    document.addEventListener("click",close);
    return()=>document.removeEventListener("click",close);
  },[showPerMenu]);

  const cats=useMemo(()=>["Todos",...new Set(lista.map(p=>p.grupo))],[lista]);
  const filtrada=useMemo(()=>lista
    .filter(p=>cat==="Todos"||p.grupo===cat)
    .filter(p=>(p.nombre||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.cambio-a.cambio)
  ,[lista,search,cat]);

  const analizarProducto=async p=>{
    if(iaData[p.nombre]||!iaKeyOk) return;
    setIaLoading(prev=>({...prev,[p.nombre]:true}));
    try{const r=await iaProducto(p.nombre);setIaData(prev=>({...prev,[p.nombre]:r}));}catch{}
    setIaLoading(prev=>({...prev,[p.nombre]:false}));
  };

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Productos</div>
          <h1 style={{fontSize:26,fontWeight:800,color:t.text,margin:0}}>Canasta Básica Urbana</h1>
          <p style={{color:t.textSub,fontSize:13,marginTop:4}}>
            {status==="live"&&periodoActual
              ?<span>Período: <strong style={{color:t.accent}}>{periodoActual}</strong> · variación vs mes anterior</span>
              :"Conecta el backend para datos reales del INE"}
          </p>
        </div>
        {/* Selector período */}
        {periodosOrdenados.length>0&&(
          <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowPerMenu(m=>!m)} style={{
              display:"flex",alignItems:"center",gap:8,padding:"10px 18px",
              borderRadius:10,border:`1.5px solid ${t.accent}`,background:t.accentSoft,
              color:t.accent,fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
            }}>
              📅 {periodoActual||"Seleccionar"} {showPerMenu?"▲":"▼"}
            </button>
            {showPerMenu&&(
              <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:300,
                background:t.card,border:`1px solid ${t.border}`,borderRadius:12,
                boxShadow:"0 12px 40px rgba(0,0,0,0.15)",minWidth:210,maxHeight:360,overflowY:"auto",padding:"8px 0"}}>
                <div style={{fontSize:11,color:t.textMuted,fontWeight:700,padding:"6px 16px 8px",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:`1px solid ${t.border}`,marginBottom:4}}>
                  {periodosOrdenados.length} períodos disponibles
                </div>
                {[...periodosOrdenados].reverse().map(p=>(
                  <button key={p} onClick={()=>{fetchProductosPorPeriodo(p);setShowPerMenu(false);}} style={{
                    width:"100%",textAlign:"left",padding:"10px 16px",
                    background:p===periodoActual?t.accentSoft:"transparent",
                    color:p===periodoActual?t.accent:t.text,
                    border:"none",cursor:"pointer",fontSize:13,fontWeight:p===periodoActual?700:400,
                    borderLeft:p===periodoActual?`3px solid ${t.accent}`:"3px solid transparent",
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                  }}>
                    {p}
                    {p===periodosOrdenados[periodosOrdenados.length-1]&&(
                      <span style={{fontSize:10,background:t.accentSoft,color:t.accent,borderRadius:6,padding:"2px 7px",fontWeight:700}}>último</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,minWidth:180,position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:t.textMuted}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto…"
            style={{width:"100%",padding:"10px 12px 10px 34px",borderRadius:10,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <select value={cat} onChange={e=>setCat(e.target.value)}
          style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:13,outline:"none"}}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{fontSize:12,color:t.textMuted,padding:"0 4px",whiteSpace:"nowrap"}}>{filtrada.length} productos</div>
      </div>

      {/* Tabla */}
      <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
          <thead>
            <tr style={{background:t.bg,borderBottom:`1px solid ${t.border}`}}>
              {["Producto","Grupo","Precio","Unidad","Var. mensual"].map(h=>(
                <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrada.map((p,i)=>(
              <tr key={(p.nombre||"")+i}
                style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=t.accentSoft}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                onClick={()=>{setModal(p);analizarProducto(p);}}>
                <td style={{padding:"12px 16px",color:t.text,fontWeight:600,fontSize:13}}>{p.nombre}</td>
                <td style={{padding:"12px 16px"}}>
                  <span style={{
                    background:(CAT_COLORS[p.grupo]||"#64748b")+"18",
                    color:CAT_COLORS[p.grupo]||"#64748b",
                    borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700
                  }}>{p.grupo}</span>
                </td>
                <td style={{padding:"12px 16px",fontFamily:"monospace",fontWeight:700,color:t.text,fontSize:13}}>Q{(+p.precio||0).toFixed(2)}</td>
                <td style={{padding:"12px 16px",color:t.textMuted,fontSize:12}}>{p.unidad}</td>
                <td style={{padding:"12px 16px"}}><ChangeBadge value={p.cambio}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={()=>setModal(null)}>
          <div style={{background:t.card,borderRadius:20,padding:28,width:"100%",maxWidth:520,border:`1px solid ${t.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:t.text}}>{modal.nombre}</div>
                <div style={{color:t.textSub,fontSize:13,marginTop:2}}>{modal.grupo} · {modal.unidad}</div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:t.textMuted,lineHeight:1}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
              {[{l:"Precio actual",v:`Q${(+modal.precio||0).toFixed(2)}`},{l:"Var. mensual",v:<ChangeBadge value={modal.cambio}/>},
                {l:"Período",v:modal.periodo||periodoActual||"—"},{l:"Fuente",v:"INE Guatemala"},
              ].map(({l,v},i)=>(
                <div key={i} style={{background:t.bg,borderRadius:10,padding:13,border:`1px solid ${t.border}`}}>
                  <div style={{fontSize:10,color:t.textMuted,marginBottom:4,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em"}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:t.text}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{borderTop:`1px solid ${t.border}`,paddingTop:16}}>
              <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:10}}>Análisis IA del producto</div>
              {!iaKeyOk?(
                <div style={{fontSize:12,color:t.textSub,background:t.bg,borderRadius:10,padding:12,border:`1px solid ${t.border}`}}>Configura <code>OPENAI_API_KEY</code> en el backend para activar análisis IA.</div>
              ):iaLoading[modal.nombre]?(
                <div style={{fontSize:13,color:t.textSub,textAlign:"center",padding:16}}>Analizando con IA…</div>
              ):iaData[modal.nombre]?(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{background:t.accentSoft,color:t.accent,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>
                      {iaData[modal.nombre].tendencia==="alcista"?"↗ Alcista":iaData[modal.nombre].tendencia==="bajista"?"↘ Bajista":"→ Estable"}
                    </span>
                    <span style={{background:t.bg,color:t.textSub,borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,border:`1px solid ${t.border}`}}>
                      Riesgo {iaData[modal.nombre].riesgo}
                    </span>
                  </div>
                  {[{l:"Comportamiento",v:iaData[modal.nombre].descripcion},{l:"Proyección",v:iaData[modal.nombre].proyeccion}].map(({l,v},i)=>v&&(
                    <div key={i} style={{background:t.bg,borderRadius:10,padding:12,border:`1px solid ${t.border}`}}>
                      <div style={{fontSize:10,color:t.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
                      <div style={{fontSize:12,color:t.textSub,lineHeight:1.65}}>{v}</div>
                    </div>
                  ))}
                </div>
              ):(
                <button onClick={()=>analizarProducto(modal)} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700}}>✨ Analizar con IA</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TENDENCIAS ─────────────────────────────────────────────────
function TendenciasPage({api,t}) {
  const vars=api.variaciones.length?api.variaciones:FB_PRODUCTOS.map(p=>({producto:p.nombre,grupo:p.grupo,variacionPct:p.cambio,precioActual:p.precio})).sort((a,b)=>b.variacionPct-a.variacionPct);
  const hist=api.historico.length?api.historico:FB_HISTORICO;
  const brechaData=hist.map(h=>({mes:h.mes||h.periodo,brecha:h.cbau&&h.cbar?+(h.cbau-h.cbar).toFixed(2):null})).filter(h=>h.brecha!==null);
  const top10a=vars.filter(v=>v.variacionPct>0).slice(0,10);
  const top10b=[...vars].filter(v=>v.variacionPct<0).sort((a,b)=>a.variacionPct-b.variacionPct).slice(0,10);
  return(
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Estadísticas</div>
        <h1 style={{fontSize:26,fontWeight:800,color:t.text,margin:0}}>Tendencias de Precios</h1>
        <p style={{color:t.textSub,fontSize:13,marginTop:4}}>Variaciones mensuales · INE Guatemala</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
        {[{title:"Mayores alzas del período",data:top10a,pos:true},{title:"Mayores bajas del período",data:top10b,pos:false}].map(({title,data,pos},ti)=>(
          <div key={ti} style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:16}}>{title}</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} layout="vertical" margin={{left:0,right:10,top:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.gridLine} horizontal={false}/>
                <XAxis type="number" tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <YAxis dataKey="producto" type="category" tick={{fill:t.textSub,fontSize:10}} width={130} tickLine={false} axisLine={false} tickFormatter={v=>v.length>16?v.substring(0,16)+"…":v}/>
                <Tooltip content={<Tip t={t}/>}/>
                <ReferenceLine x={0} stroke={t.border} strokeWidth={1}/>
                <Bar dataKey="variacionPct" name="Variación %" radius={[0,4,4,0]}>
                  {data.map((d,i)=><Cell key={i} fill={pos?t.accent:"#ef4444"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      <div style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`}}>
        <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:2}}>Brecha urbano–rural histórica (Q per cápita/mes)</div>
        <div style={{fontSize:12,color:t.textSub,marginBottom:16}}>Diferencia entre CBAI y CBAR</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={brechaData} margin={{top:4,right:4,bottom:0,left:0}}>
            <defs>
              <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={t.accent} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={t.accent} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={t.gridLine} vertical={false}/>
            <XAxis dataKey="mes" tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} interval={2}/>
            <YAxis tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`Q${v}`} width={52}/>
            <Tooltip content={<Tip t={t}/>}/>
            <Area type="monotone" dataKey="brecha" name="Brecha U-R" stroke={t.accent} fill="url(#gB)" strokeWidth={2.5} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── CONEXIÓN API ───────────────────────────────────────────────
function ApiPage({api,t}) {
  const{status,serverInfo,logs,connect,forceRefresh,iaKeyOk}=api;
  const endpoints=[
    {p:"/status",d:"Estado y períodos disponibles"},
    {p:"/canasta/resumen",d:"KPIs: CBAU, CBAR, variaciones"},
    {p:"/canasta/historico",d:"Serie histórica mensual"},
    {p:"/productos",d:"Último período con variaciones"},
    {p:"/productos?periodo=Enero+2025",d:"Productos de un período específico"},
    {p:"/variaciones",d:"Ranking alzas y bajas"},
    {p:"/categorias",d:"Grupos alimenticios y costos"},
    {p:"/admin/refresh",d:"Fuerza re-descarga desde el INE"},
    {p:"/ia/canasta",d:"🤖 Análisis general IA"},
    {p:"/ia/producto/:nombre",d:"🤖 Análisis de producto"},
    {p:"/ia/reporte",d:"🤖 Reporte ejecutivo completo"},
  ];
  const statusColors={idle:"#64748b",connecting:"#f59e0b",live:t.accent,fallback:"#f97316",error:"#ef4444"};
  const statusLabels={idle:"Sin conectar",connecting:"Conectando…",live:"En vivo",fallback:"Datos locales",error:"Error"};
  return(
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Sistema</div>
        <h1 style={{fontSize:26,fontWeight:800,color:t.text,margin:0}}>Conexión Backend INE</h1>
        <p style={{color:t.textSub,fontSize:13,marginTop:4}}>Backend Node.js · descarga datos del INE en tiempo real</p>
      </div>
      {/* Estado IA */}
      <div style={{background:iaKeyOk?t.accentSoft:"#fff7ed",borderRadius:14,padding:20,border:`1px solid ${iaKeyOk?t.accent+"44":"#fcd34d44"}`,marginBottom:18,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{width:44,height:44,borderRadius:12,background:iaKeyOk?t.accentSoft:"#fff7ed",border:`1px solid ${iaKeyOk?t.accent+"44":"#fcd34d44"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
          {iaKeyOk?"🤖":"🔑"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:t.text,marginBottom:3,fontSize:14}}>{iaKeyOk?"IA lista — API Key configurada":"API Key de OpenAI no configurada"}</div>
          <div style={{fontSize:12,color:t.textSub}}>{iaKeyOk?"La clave vive solo en el servidor. Arquitectura segura.":"Agrega OPENAI_API_KEY=sk-... en el .env y reinicia el backend."}</div>
        </div>
        {!iaKeyOk&&<a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{background:t.accent,color:"#fff",borderRadius:10,padding:"9px 18px",textDecoration:"none",fontWeight:700,fontSize:13}}>Obtener key →</a>}
      </div>
      {/* URL + botones */}
      <div style={{background:t.card,borderRadius:14,padding:20,border:`1px solid ${t.border}`,marginBottom:18,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <code style={{flex:1,fontSize:12,color:t.accent,fontFamily:"monospace",background:t.bg,padding:"10px 14px",borderRadius:10,border:`1px solid ${t.border}`}}>{API_BASE}</code>
        <button onClick={connect} disabled={status==="connecting"} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:status==="connecting"?"not-allowed":"pointer",fontSize:13,fontWeight:700,opacity:status==="connecting"?0.7:1}}>
          {status==="connecting"?"Conectando…":"Conectar"}
        </button>
        <button onClick={forceRefresh} style={{background:"transparent",border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 20px",cursor:"pointer",fontSize:13,color:t.textSub,fontWeight:600}}>
          Forzar refresh
        </button>
      </div>
      {/* Info servidor */}
      {serverInfo&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:18}}>
          {[{l:"Estado",v:statusLabels[status]||status,c:statusColors[status]||t.accent},{l:"CBAU",v:`${serverInfo.registros?.cbauPercapita||0} registros`},{l:"Productos",v:`${serverInfo.registros?.productosUrbanos||0}`},{l:"Períodos",v:`${serverInfo.periodos?.length||0}`}]
            .map((s,i)=>(
            <div key={i} style={{background:t.card,borderRadius:12,padding:"16px 18px",border:`1px solid ${t.border}`}}>
              <div style={{fontSize:11,color:t.textMuted,textTransform:"uppercase",fontWeight:600,letterSpacing:"0.06em",marginBottom:6}}>{s.l}</div>
              <div style={{fontSize:15,fontWeight:700,color:s.c||t.text}}>{s.v}</div>
            </div>
          ))}
        </div>
      )}
      {/* Consola */}
      <div style={{background:"#060f1a",borderRadius:14,padding:20,border:"1px solid #1e3347",marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#10b981",fontFamily:"monospace"}}>▶ Consola</div>
          <span style={{background:statusColors[status]+"22",color:statusColors[status]||"#64748b",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{statusLabels[status]||"—"}</span>
        </div>
        <div style={{fontFamily:"monospace",fontSize:12,minHeight:100,maxHeight:200,overflow:"auto"}}>
          {logs.length===0
            ?<div style={{color:"#334155"}}>&gt; Presiona "Conectar"…</div>
            :logs.map((l,i)=>(
              <div key={i} style={{marginBottom:3,color:l.type==="success"?"#34d399":l.type==="error"?"#f87171":l.type==="warn"?"#fbbf24":"#64748b"}}>
                <span style={{color:"#1e3347"}}>[{l.ts}] </span>{l.msg}
              </div>
            ))}
        </div>
      </div>
      {/* Endpoints */}
      <div style={{background:t.card,borderRadius:14,padding:22,border:`1px solid ${t.border}`}}>
        <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:16}}>Endpoints disponibles</div>
        {endpoints.map((ep,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0",borderBottom:i<endpoints.length-1?`1px solid ${t.border}`:"none",flexWrap:"wrap"}}>
            <span style={{background:t.accentSoft,color:t.accent,borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700,flexShrink:0}}>GET</span>
            <code style={{fontSize:12,color:t.accent,fontFamily:"monospace",minWidth:220}}>{ep.p}</code>
            <span style={{fontSize:12,color:t.textSub}}>{ep.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NAVEGACIÓN ────────────────────────────────────────────────
const NAV=[
  {id:"overview",  icon:"▦",  label:"Panel General"},
  {id:"productos", icon:"⊞",  label:"Productos"},
  {id:"tendencias",icon:"↗",  label:"Estadísticas"},
  {id:"reporte",   icon:"☰",  label:"Reportes API"},
  {id:"api",       icon:"⚙",  label:"Configuración"},
];

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [dark,setDark]=useState(false);
  const [page,setPage]=useState("overview");
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const t=dark?DARK:LIGHT;
  const api=useINEApi();

  return(
    <div style={{display:"flex",height:"100vh",background:t.bg,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",overflow:"hidden",fontSize:14}}>
      {/* Sidebar */}
      <div style={{width:sidebarOpen?250:64,background:t.sidebar,display:"flex",flexDirection:"column",transition:"width .2s ease",overflow:"hidden",flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.04)"}}>
        {/* Logo */}
        <div style={{padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>▦</div>
            {sidebarOpen&&(
              <div>
                <div style={{color:"#e2e8f0",fontWeight:800,fontSize:14,whiteSpace:"nowrap",lineHeight:1.2}}>CBA Dashboard</div>
                <div style={{color:"#334155",fontSize:11,whiteSpace:"nowrap"}}>Guatemala · INE</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
          {NAV.map((item,i)=>{
            const isActive=page===item.id;
            return(
              <button key={item.id} onClick={()=>setPage(item.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:12,
                padding:"10px 12px",borderRadius:10,marginBottom:2,
                background:isActive?t.accent:"transparent",
                border:"none",cursor:"pointer",textAlign:"left",
                transition:"all .15s",
              }}>
                <span style={{fontSize:16,flexShrink:0,color:isActive?"#fff":t.textSub,lineHeight:1}}>{item.icon}</span>
                {sidebarOpen&&<span style={{color:isActive?"#fff":"#4a6080",fontSize:13,fontWeight:isActive?700:500,whiteSpace:"nowrap"}}>{item.label}</span>}
                {sidebarOpen&&i===1&&api.periodoSel&&isActive&&(
                  <span style={{marginLeft:"auto",background:"rgba(255,255,255,0.2)",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                    {api.variaciones?.length||0}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{padding:"12px 8px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          {/* Toggle modo oscuro */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:4}}>
            <span style={{fontSize:14,color:"#4a6080",flexShrink:0}}>🌙</span>
            {sidebarOpen&&(
              <>
                <span style={{color:"#4a6080",fontSize:13,flex:1}}>Modo Oscuro</span>
                <div onClick={()=>setDark(d=>!d)} style={{
                  width:40,height:22,borderRadius:11,background:dark?t.accent:"#1e3347",
                  cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0,
                }}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:dark?21:3,transition:"left .2s"}}/>
                </div>
              </>
            )}
          </div>
          {/* Usuario */}
          {sidebarOpen&&(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12,flexShrink:0}}>AN</div>
              <div>
                <div style={{color:"#e2e8f0",fontSize:12,fontWeight:600,lineHeight:1.2}}>Analista INE</div>
                <div style={{color:"#334155",fontSize:11}}>Guatemala</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Top bar */}
        <div style={{height:60,background:t.navBg,borderBottom:`1px solid ${t.navBorder}`,display:"flex",alignItems:"center",padding:"0 24px",gap:12,flexShrink:0}}>
          <button onClick={()=>setSidebarOpen(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,fontSize:18,padding:4,lineHeight:1}}>☰</button>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:t.textMuted}}>
            <span>Portal BI</span>
            <span>›</span>
            <span style={{color:t.text,fontWeight:600}}>{NAV.find(n=>n.id===page)?.label||"Panel General"}</span>
          </div>
          <div style={{flex:1}}/>
          {/* Estado conexión */}
          {api.status==="live"&&(
            <div style={{display:"flex",alignItems:"center",gap:5,background:t.accentSoft,border:`1px solid ${t.accent}33`,borderRadius:20,padding:"5px 12px"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:t.accent}}/>
              <span style={{fontSize:11,fontWeight:700,color:t.accent}}>En vivo</span>
            </div>
          )}
          {api.status==="fallback"&&(
            <div style={{display:"flex",alignItems:"center",gap:5,background:"#fff7ed",border:"1px solid #fcd34d44",borderRadius:20,padding:"5px 12px"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b"}}/>
              <span style={{fontSize:11,fontWeight:700,color:"#d97706"}}>Datos locales</span>
            </div>
          )}
          <a href="https://datos.ine.gob.gt" target="_blank" rel="noreferrer"
            style={{fontSize:12,color:t.textSub,textDecoration:"none",fontWeight:500}}>
            datos.ine.gob.gt
          </a>
          {/* Campana */}
          <button style={{background:"none",border:"none",cursor:"pointer",color:t.textMuted,fontSize:18,padding:4}}>🔔</button>
          {/* Avatar */}
          <div style={{width:34,height:34,borderRadius:"50%",background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12,flexShrink:0}}>GT</div>
        </div>

        {/* Página */}
        <div style={{flex:1,overflow:"auto",padding:"28px 28px"}}>
          {page==="overview"   && <OverviewPage   api={api} t={t}/>}
          {page==="productos"  && <ProductosPage  api={api} t={t}/>}
          {page==="tendencias" && <TendenciasPage api={api} t={t}/>}
          {page==="reporte"    && <ReportePage    api={api} t={t}/>}
          {page==="api"        && <ApiPage        api={api} t={t}/>}
        </div>
      </div>
    </div>
  );
}
