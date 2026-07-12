// economy.js
import { NPLAY, BUILDINGS, BUILD_JOBS, TERRAINS, UNITS, RES_KEYS, RES_LABEL, LOOT_FRAC, STRATA } from "./config.js";
import { S } from "./state.js";

// ---- Ocupación (estilo EU4): la provincia sigue siendo de iure de su dueño (p.owner) pero
// está controlada militarmente por p.occupier. Su renta se le niega al dueño y el ocupante
// saquea una fracción. p.occupier===-1 (o indefinido) = la controla su dueño. ----
function isOccupied(p){return p.occupier>=0&&p.occupier!==p.owner}
function occupierOf(p){return isOccupied(p)?p.occupier:-1}
function provLoot(p){const e=provEconomy(p);return Math.max(0,e.res.dinero||0)*LOOT_FRAC} // saqueo de dinero/tick

/* ===================== POPs Fase 1: constantes ======================
 * La población es ahora el motor: paga impuestos, aporta la soldadesca (el cupo
 * movilizable) y crece. Ver [[basileus-pop-economy-vision]]. */
const SOLD_FRAC=0.02;      // techo de soldadesca = 2% de la población (movilización máxima realista)
// ---- Mecánicas propias de estratos (Fase D) ----
// Clero = legitimidad (moral extra donde su peso supera la base ~2%); Nobleza = clase militar
// (más soldadesca donde su peso supera la base). Efectos por DESVIACIÓN sobre el 2% de referencia,
// así el clero urbano (catedrales) da moral y la nobleza rural (señoríos) da leva. Mods pequeños.
const STRATA_BASE=0.02;    // peso de referencia de clero/nobleza (≈2% del reino)
const CLERO_MORALE=0.5;    // puntos de moral/mes extra por cada +2% de clero sobre la base
const NOBLE_LEVY=0.6;      // +% de techo de soldadesca por cada +2% de nobleza sobre la base
function stratFrac(p,k){return (p.pops&&p.pop>0)?Math.max(0,((p.pops[k]||0)/p.pop-STRATA_BASE)/STRATA_BASE):0}
// Impuestos = MOTOR de los ducados (realista: las arcas medievales vivían del impuesto, no de las
// minas). Antes la producción base de las ciudades daba "dinero gratis" y eclipsaba al impuesto;
// ahora las ciudades producen manufacturas y el ducado sale del impuesto + comercio + minas.
const TAX_PC=0.000015;     // ducados/mes por habitante (campo); sube algo: ahora es el grifo principal
const TAX_URBAN=3.0;       // multiplicador de impuestos en ciudad (burguesía): compensa que ya no dan dinero base
// Extracción de metal precioso: la producción base de un yacimiento (los pops "de serie" que lo
// trabajan) rinde DUCADOS a estas tasas. Plata = fuente secundaria; oro = raro y muy rentable.
// AFINIDAD DE RECURSO: el bien base de una provincia (su resType) ya NO lo minan los pops
// directamente; ahora es un BONUS de producción a los edificios que producen ESE mismo bien.
// Así una mina de hierro rinde más en una provincia de hierro que en una de vino, un viñedo
// rinde más donde hay afinidad al vino, etc. TODA la producción de bienes viene de edificios;
// los ducados salen de los impuestos + comercio (mercado/lonja) + minas de plata/oro.
const AFFINITY=0.25;       // +25% de producción al edificio cuyo bien coincide con el de la provincia (tunable)
// ¿el bien k que produce el edificio b recibe la afinidad de la provincia p?
function resAff(p,b,k){
  return k===p.resType||(b==="minaPlata"&&p.resType==="plata")||(b==="minaOro"&&p.resType==="oro");
}
// Soldadesca: el cupo de gente movilizable de una provincia. Su techo escala con la
// población y con los edificios militares (fx.mano, reinterpretado como % de cupo extra).
function soldCap(p){
  if(!p||p.wasteland||p.owner>=NPLAY)return 0;
  let bonus=1;
  for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.mano)bonus+=fx.mano*lvlOf(p,b)}
  bonus+=NOBLE_LEVY*stratFrac(p,"nobleza"); // Fase D: la nobleza (clase militar) amplía la leva
  return (p.pop||0)*SOLD_FRAC*bonus;
}
function soldAvail(p){return p.sold!=null?p.sold:soldCap(p)} // stock actual (o el techo si aún no se sembró)

/* ---- Subsistencia local por provincia: el GRANO ----
 * Los campesinos (pops de serie) NO trabajan en fábricas: trabajan la tierra y producen/consumen su
 * propio GRANO ≈ autosuficiente. El grano se guarda en una DESPENSA local por provincia (p.store.comida),
 * cuyo tope amplía el Almacén, como colchón anti-hambruna. Un modificador de COSECHA (harvestMul,
 * ±HARVEST_AMP/año, determinista por provincia+año) afecta al grano (bien ORGÁNICO). En un mal año se
 * consume más de lo que se produce → se drena la despensa; si se agota y sigue negativa → HAMBRUNA
 * (muertes) [+ migración, futura]. El grano ES la misma unidad que el recurso nacional (para socorro/
 * requisa). Capa SEPARADA del Tesoro: los edificios rinden a la nación, los campesinos comen su grano.
 * Los DEMÁS bienes (madera/piedra/hierro, lujos) NO se acopian por provincia: son FLUJO al mercado
 * nacional — el excedente campesino (resType) y los edificios los ponen a la venta y los estamentos los
 * compran para comer (trigo) y construir (materiales). Ver E1/E2 en [[basileus-pop-economy-vision]]. */
const YR_TICKS=8760;             // ticks (horas de juego) por año
const HARVEST_AMP=0.33;          // variación anual de cosecha (±33%)
// ---- BLOQUE 1: vocación productiva del TERRENO por bien básico ----
// El campesino produce los 4 BÁSICOS (grano/madera/piedra/hierro) según su TERRENO, y NECESITA la misma
// cesta que todos. Ningún terreno es bueno en todo → cada provincia VENDE sus superávits y COMPRA sus
// déficits en el mercado nacional (ese volumen es el ingreso del burgués por margen). Multiplicador 1.0 =
// autoabastece justo esa necesidad; >1 excedente (vende); <1 déficit (compra). Solo el GRANO tiene despensa
// (colchón anti-hambruna); los demás básicos son flujo puro. La afinidad de recurso (resType) se reserva
// para los especiales históricos (plata/oro/sal/seda por zona), no para los básicos (los manda el terreno).
const BASICS=["comida","materiales","piedra","metal"]; // cesta básica que produce y necesita el campesino
const SUBS_BASICS=["comida"];    // único básico con DESPENSA local (colchón anti-hambruna); el resto es flujo
const SUBS_ORGANIC={comida:1};   // bienes afectados por el desastre de cosecha (harvestMul): el grano
const NEED_BASIC={comida:1.0, materiales:0.35, piedra:0.12, metal:0.12}; // cesta por hab/AÑO (igual para todos)
// El GRANO es casi autosuficiente por terreno (0.8-1.4): es el staple de supervivencia y, SIN mercado
// internacional aún (Bloque 3), un país de terreno pobre no puede importarlo → no debe colapsar por hambre.
// La ESPECIALIZACIÓN fuerte va en los básicos industriales (madera/piedra/hierro), que no matan de hambre y
// son los que mueven el comercio. (Cuando exista la importación internacional, el grano podrá endurecerse.)
// Multiplicadores calibrados para que la producción MEDIA de cada básico ≈1.1-1.2× la necesidad (mercados con
// excedente estructural que llenan su stock → precio diferenciado) manteniendo FUERTE la especialización (bosque
// exporta madera; montaña, piedra/hierro; llanura fértil, grano pero importa materiales). Así nace el comercio.
const TERRAIN_PROD={ // producción campesina por terreno y básico (mult; 1.0=autoabastece esa necesidad)
  vega:    {comida:1.4, materiales:0.5, piedra:0.4, metal:0.4},
  pradera: {comida:1.3, materiales:0.6, piedra:0.55,metal:0.5},
  llanura: {comida:1.15,materiales:0.8, piedra:0.7, metal:0.8},
  colinas: {comida:1.0, materiales:1.0, piedra:1.7, metal:1.4},
  bosque:  {comida:0.95,materiales:2.6, piedra:0.7, metal:0.9},
  pantano: {comida:0.92,materiales:2.0, piedra:0.6, metal:0.8},
  estepa:  {comida:0.97,materiales:0.6, piedra:1.0, metal:1.1},
  desierto:{comida:0.9, materiales:0.35,piedra:1.6, metal:1.5},
  montana: {comida:0.9, materiales:0.7, piedra:2.4, metal:2.6},
  tundra:  {comida:0.9, materiales:1.1, piedra:0.8, metal:0.9},
};
const SUBS_STORE_YEARS={comida:0.7}; // capacidad de la despensa de GRANO en años de consumo (× Almacén)
function terrMul(p,k){const t=TERRAIN_PROD[p.terrain];return t&&t[k]!=null?t[k]:1} // vocación del terreno para el básico k
function harvestMul(p){ // calidad de la cosecha de este año (determinista por provincia+año)
  const year=Math.floor(S.hour/YR_TICKS);
  let n=(p.id*73856093^year*19349663)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;
  return 1+HARVEST_AMP*((n>>>0)/4294967296*2-1);
}
function subsCons(p,k){return (p.pop||0)*(NEED_BASIC[k]||0)/YR_TICKS}    // consumo del básico k por tick (cesta universal)
function subsProd(p,k){                                                  // producción del básico k por tick (según terreno)
  let v=(p.pop||0)*(NEED_BASIC[k]||0)/YR_TICKS*terrMul(p,k);
  if(k==="comida")v*=(1+0.4*lvlOf(p,"granja"))*harvestMul(p);           // la granja y la cosecha (desastre) afectan al grano
  return v;
}
function subsBalance(p,k){return subsProd(p,k)-subsCons(p,k)}           // >0 excedente, <0 déficit (por tick)
function storeCap(p,k){return (p.pop||0)*(SUBS_STORE_YEARS[k]||0.5)*(1+0.8*lvlOf(p,"almacen"))} // el Almacén amplía la reserva
function storeOf(p,k){const c=storeCap(p,k);return (p.store&&p.store[k]!=null)?p.store[k]:c*0.6} // reserva actual (o siembra)
function foodFill(p){const c=storeCap(p,"comida");return c>0?Math.min(1,storeOf(p,"comida")/c):0.5} // llenado de la despensa (0..1)
// aliases de comida (compatibilidad con UI/sim/debug/arnés): la comida es el básico organico principal
function foodCons(p){return subsCons(p,"comida")}
function foodBalance(p){return subsBalance(p,"comida")}
function foodCap(p){return storeCap(p,"comida")}

/* ---- Necesidades de confort y mercado (Fase 4) ----
 * Además de comida, la población necesita madera, paño, vino y sal. El reino las consume de
 * su stock; si falta, compra en el mercado con ducados y, si tampoco puede, hay desabastecimiento
 * (baja la moral). En hambruna, el reino puede comprar grano para paliar la mortandad. */
// LUJOS de confort a nivel NACIONAL (la madera pasó a subsistencia local; los caballos, fuera por ahora).
// No cubrir un lujo, de momento, NO tiene efecto (el BONUS de moral por lujos cubiertos es feature futura).
const NEED_PC={pano:0.00000018,vino:0.00000018,sal:0.00000028}; // por habitante y tick
const NEED_PRICE={pano:2.2,vino:2.2,sal:1.6};  // ducados por unidad al comprar en el mercado
const FOOD_PRICE=4.0;                                          // ducados por unidad de grano (alivio de hambruna): caro, para que la hambruna se sienta

/* ---- Mercado nacional de comercio + riqueza de estratos (Fase B) ----
 * Capa ADITIVA sobre la economía de la corona (que NO se toca en esta fase): cada estrato gana
 * dinero por su rol (S.nations[n].sWealth) y compra sus lujos en un mercado nacional por reino
 * (S.nations[n].mkt). La producción de bienes de comercio se ESPEJA al mercado (la corona conserva
 * su copia como hasta ahora); en la próxima pasada se unificará (quitar NEED_PC de la corona y
 * encaminar la producción real al mercado). Precios FIJOS. Todo tunable (mods pequeños). */
const MKT_GOODS=["pano","vino","sal","seda","raros"];           // LUJOS de comercio (se espejan al mercado desde los edificios)
// E1: el GRANO también se mercadea. Oferta = excedente campesino (overflow de la despensa); demanda =
// las élites que NO cultivan (burgués/clero/nobleza) COMEN comprando grano del mercado. El campesino
// come lo suyo (subsistencia), no compra. MKT_TRADE = todos los bienes que se compran/venden y ponen precio.
// Bloque 1: los 4 BÁSICOS también se mercadean (el campesino vende superávit / compra déficit por terreno).
const MKT_TRADE=[...BASICS,...MKT_GOODS];  // básicos (grano/madera/piedra/hierro) + lujos
const NONGRAIN=["materiales","piedra","metal"]; // básicos no-grano: stock+precio nacional como los lujos (comercian por arbitraje)
const MKT_PRICE={comida:0.8,materiales:1.0,piedra:1.0,metal:2.0,pano:2.2,vino:2.2,sal:1.6,seda:5.0,raros:4.0}; // ducados/unidad (referencia)
const NPC=1e-7;                                                 // escala "por habitante y tick"
// Necesidad por hab/tick y estrato. La COMIDA es un staple: las élites comen ≈1/año (=1/YR_TICKS), como
// todo el mundo, pero comprándola en el mercado. Los lujos, mucho menos (los altos, más y más fino).
const EAT=1/YR_TICKS; // ración de grano por hab y tick (mismo que la subsistencia campesina)
const LUX_NEED={
  campesino:{pano:1.2*NPC,vino:1.0*NPC,sal:2.4*NPC},                                     // el campesino come su propio grano (no compra comida)
  burgues:  {comida:EAT,pano:3.0*NPC,vino:3.0*NPC,sal:2.8*NPC,seda:0.8*NPC,raros:0.6*NPC},
  clero:    {comida:EAT,pano:3.0*NPC,vino:4.0*NPC,sal:2.8*NPC,seda:1.0*NPC,raros:1.0*NPC},
  nobleza:  {comida:EAT,pano:4.0*NPC,vino:5.0*NPC,sal:3.0*NPC,seda:2.0*NPC,raros:2.0*NPC},
};
// Ingreso base de dinero por hab/tick y estrato. Campesino/burgués ≈ su cesta (viven al día);
// clero (diezmos) y nobleza (rentas de la tierra) MUY por encima de su consumo → son la ÉLITE que
// acumula (para, en el futuro, construir por su cuenta). Los burgueses ADEMÁS cobran un margen de
// las ventas del mercado (BURGUES_MARGIN), no toda la venta.
const STRATA_INCOME={campesino:10*NPC,burgues:26*NPC,clero:60*NPC,nobleza:85*NPC};
const BURGUES_MARGIN=0.10;   // los burgueses (comerciantes) se quedan solo este margen de las ventas; el resto = costes (sumidero)
// Tope de riqueza acumulada por habitante, POR ESTRATO (estabiliza y fija la jerarquía de riqueza:
// campesinos pobres, burgueses acomodados, clero y nobleza ricos). El exceso se consume/reinvierte.
const WEALTH_CAP={campesino:0.02,burgues:0.04,clero:2.0,nobleza:3.0};
// ---- Movilidad social (Fase C): ascensos/descensos campesino<->burgués ----
// Modelo "fracción objetivo + deriva": cada provincia tiende a una composición según su DESARROLLO
// (urbanización + edificios de comercio); los pops migran lento hacia ella. El ASCENSO se modula por
// la PROSPERIDAD de los burgueses del reino (si prosperan, atraen; si penan, no); el DESCENSO es libre.
const PROMO_RATE=0.0010;      // fracción de la brecha corregida por tick (lento, stackeable)
const PROSP_REF=0.02;         // riqueza/hab de burgués de referencia (prosperidad = actual/REF, ~1 al inicio)
function targetBurgFrac(p){   // fracción objetivo de burgueses sobre la clase baja (campesino+burgués)
  // Base = el sembrado inicial (sobre la clase baja): así NO hay descenso de arranque; solo el
  // comercio construido empuja por encima → ascenso. Ciudad ~0.40, campo ~0.052.
  let f=p.urban?0.40:0.052;
  for(const b of ["mercado","gremio","lonja","puerto"])f+=0.03*lvlOf(p,b); // el comercio atrae burguesía
  return Math.min(0.6,f);
}
const MKT_CAP_DAYS=120;   // tope de inventario del mercado = tantos días de demanda (acota la sobreoferta sin destruir bienes cada tick)
const BASIC_CAP_DAYS=15;  // básicos = bienes de FLUJO: buffer CORTO (el precio responde rápido al superávit/déficit, no tarda meses)
function capDays(g){return NONGRAIN.indexOf(g)>=0?BASIC_CAP_DAYS:MKT_CAP_DAYS}
// ---- Precios DINÁMICOS por oferta/demanda ----
// El precio de cada bien en el mercado de un reino ya no es fijo: sube cuando el inventario está bajo
// respecto a la demanda (escasez) y baja cuando hay excedente. MKT_PRICE es el precio de REFERENCIA
// (mercado medio lleno). Así los bienes que un reino PRODUCE se abaratan y los que le FALTAN se
// encarecen (presión comercial realista), y el panel deja de estar congelado. Mods pequeños y suaves.
const PRICE_ADJ=0.02;     // velocidad de ajuste del precio por tick (EMA lenta: ~1-2 días de vida media)
const PRICE_K=1.2;        // amplitud: mercado vacío → +PRICE_K sobre el precio ref; lleno → −PRICE_K
const PRICE_MIN=0.6;      // suelo del multiplicador de precio (excedente barato)
const PRICE_MAX=2.2;      // techo del multiplicador de precio (escasez cara)
// ---- Comercio ENTRE mercados nacionales (arbitraje; Bloque 3) ----
// No hay "mercado internacional" como entidad: son transacciones entre los mercados de los reinos. El
// burgués compra el bien donde su precio está BAJO (país con excedente) y lo vende donde está ALTO (país
// con déficit): mueve stock del mercado barato al caro → los precios CONVERGEN. El burgués se lleva el
// diferencial (comprar barato/vender caro). Global sin distancia en v1 (futuro: coste por distancia/ruta).
const TRADE_RATE=0.05;        // fracción del stock exportable que se mueve por tick (convergencia gradual)
const TRADE_MIN_SPREAD=0.06;  // diferencial mínimo (sobre el precio ref) para que el arbitraje sea rentable
const TRADE_COST=0.0;         // coste de transporte (0 = frictionless; futuro: por distancia entre reinos)
// El comercio de cada tick es "a golpes" (el arbitraje empareja rotando: un reino comercia mucho un tick y
// nada el siguiente). Para el PANEL se suaviza con una media móvil (EMA) → un RITMO mensual estable que no
// parpadea. TEL_SMOOTH ≈ media de ~35 ticks (1-2 días de juego): estable pero sigue los cambios reales.
const TEL_SMOOTH=0.02;
function ensureMarket(N){ // inicializa el estado de mercado/riqueza de una nación si falta
  if(!N.sWealth){N.sWealth={};for(const k of STRATA)N.sWealth[k]=0}
  if(!N.mkt)N.mkt={};
  if(!N.mktPrice){N.mktPrice={};for(const g of MKT_TRADE)N.mktPrice[g]=MKT_PRICE[g]} // precio actual por bien (arranca en el de referencia)
  if(!N.sRes){N.sRes={};for(const e of ESTATES_BUILD)N.sRes[e]={}} // reservas de BIENES por estamento (E2); el dinero va en sWealth
  if(!N.mktTel){N.mktTel={};for(const g of MKT_TRADE)N.mktTel[g]={sold:0,exp:0,imp:0}} // telemetría de comercio SUAVIZADA (para el panel)
}
// Riqueza INICIAL por habitante y estrato: la nobleza y el clero nacen RICOS (tierras, tesoro
// eclesiástico) y los campesinos pobres. Fija la jerarquía de riqueza desde el arranque (~mitad
// del tope de cada estrato). Se siembra en setupNations (partidas nuevas); las guardadas la restauran.
const START_WEALTH_PC={campesino:0.005,burgues:0.02,clero:1.0,nobleza:1.5};
function seedStrataWealth(){
  const str=Array.from({length:NPLAY},()=>{const o={};for(const k of STRATA)o[k]=0;return o});
  for(const p of S.provs){if(p.owner>=NPLAY||p.wasteland||!p.pops)continue;const s=str[p.owner];for(const k of STRATA)s[k]+=p.pops[k]||0}
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N)continue;ensureMarket(N);for(const k of STRATA)N.sWealth[k]=(START_WEALTH_PC[k]||0)*str[n][k]}
}
// ================= REPARTO FEUDAL: un solo grifo campesino =================
// El dinero de la capa 3 ya no lo genera cada estrato de la nada. Hay UN grifo: la producción
// campesina (abstracción de vender su excedente), del que CLERO, NOBLEZA y CORONA extraen un %;
// el resto queda al campesino. El burgués es la excepción (vive del margen del mercado). Como el
// flujo cuelga de los mismos multiplicadores que la subsistencia (terreno·granja·moral), una
// hambruna (menos campesinos) o una provincia desmoralizada golpea el ingreso de TODOS a la vez.
// Sustituye a la vez los ingresos planos por rol (salvo burgués) y el impuesto plano taxOf.
// BASE_INCOME calibrado para PARIDAD del ingreso de la corona con el antiguo taxOf: el viejo
// impuesto de Castilla (~Σ taxOf) equivale a ~corona·ΣflujoBase; con corona≈0.08+realengo eso da
// BASE_INCOME≈2.4e-4 (ver arnés de validación). Todo tunable.
const BASE_INCOME=2.4e-4;  // ducados por campesino y tick, antes del reparto (grifo único)
const DIEZMO=0.10;         // fracción del flujo para el clero (fija)
const ALCABALA=0.08;       // impuesto de la corona sobre el comercio (sobre las ventas del mercado)
// Señorío de la provincia (derivado, sin estado nuevo): renta de la tierra y a quién va.
//  capital→realengo (renta a la CORONA) · ciudad→abadengo (renta al CLERO) · resto→solariego (renta a la NOBLEZA)
const MANOR_RENT={realengo:0.10,solariego:0.28,abadengo:0.22};
function manorOf(p){return p.capital?"realengo":(p.urban?"abadengo":"solariego")}
function taxRateOf(n){const N=S.nations[n];return N&&N.taxRate!=null?Math.max(0.02,Math.min(0.20,N.taxRate)):0.08} // palanca fiscal por nación
function flujoBase(p){ // flujo campesino por tick (mismos multiplicadores que la subsistencia)
  if(!p||p.owner>=NPLAY||p.wasteland||!p.pops)return 0;
  return p.pops.campesino*BASE_INCOME*structPPF(p)*(p.morale/100);
}
// Reparto del flujo en fracciones {clero,nobleza,corona,campesino}. Clamp defensivo: si la
// extracción supera 0.9, se escala para que al campesino le quede siempre ≥10%.
function repartoRates(p,taxRate){
  const manor=manorOf(p),rent=MANOR_RENT[manor];
  let clero=DIEZMO,nobleza=0,corona=taxRate;
  if(manor==="abadengo")clero+=rent; else if(manor==="realengo")corona+=rent; else nobleza+=rent;
  let ext=clero+nobleza+corona;
  if(ext>0.9){const s=0.9/ext;clero*=s;nobleza*=s;corona*=s;ext=0.9}
  return{clero,nobleza,corona,campesino:1-ext};
}
// constantes del tick demográfico (compartidas con el arnés de análisis tools/sim-economy.mjs)
const SOLD_REGEN=0.0012;          // la soldadesca recupera este % del hueco hasta su techo, por tick
const POP_GROWTH_BASE=0.008/8760; // crecimiento con la despensa llena ≈1.1%/año; escala con el llenado
const STARVE_RATE=0.6;            // en hambruna, fracción del déficit que se lleva por delante a la población
const FAMINE_DEF=0.12;            // déficit (fracción del consumo sin cubrir) por encima del cual hay hambruna

/* ---- Trabajo / especialización (Fase 3) ----
 * Los edificios exigen trabajadores. Una provincia solo puede liberar del campo tantos
 * especialistas como permita su excedente agrícola estructural (fértil/desarrollada → más).
 * Movilizar soldados (p.mob) retira mano de obra. La producción de los edificios escala con
 * su DOTACIÓN (staffing); los impuestos y la producción base de la tierra, no. */
const JOBS_PER_LEVEL=550;   // puestos de trabajo que exige cada nivel de edificio
const SPEC_BASE=0.06;       // fracción de la población especializable (siempre hay algo de artesanía)
const SPEC_K=0.6;           // + capacidad de especialistas por excedente agrícola estructural
const SPEC_MAX=0.35;        // tope de especialistas (urbanización máxima medieval)
function structPPF(p){return terrMul(p,"comida")*(1+0.4*lvlOf(p,"granja"))} // capacidad de grano/campesino del terreno (sin cosecha)
function specialistCap(p){  // cuántos pops puede sostener la provincia fuera del campo
  const f=Math.max(0.02,Math.min(SPEC_MAX,SPEC_BASE+SPEC_K*(structPPF(p)-1)));
  return (p.pop||0)*f;
}
function jobsOf(b){return BUILD_JOBS[b]!=null?BUILD_JOBS[b]:JOBS_PER_LEVEL} // empleos por nivel de ese edificio
// ¿la provincia p puede DOTAR una fábrica de tipo b (al menos un nivel completo con su población)?
// Los reinos extensos y despoblados NO deben sembrar/construir industria en cada provincia diminuta:
// una fábrica que no se puede dotar solo produce a medias y drena su mantenimiento. La industria se
// concentra así en los NÚCLEOS poblados (idea de diseño), y las provincias pobres quedan agrícolas.
function canStaffIndustry(p,b){return !!p&&!p.wasteland&&specialistCap(p)>=jobsOf(b)}
function buildJobs(p){let j=0;for(const b in BUILDINGS)j+=lvlOf(p,b)*jobsOf(b);return j}
function freeLabor(p){return Math.max(0,specialistCap(p)-(p.mob||0))}    // libres tras descontar movilizados
function staffing(p){const j=buildJobs(p);return j>0?Math.min(1,freeLabor(p)/j):1} // dotación 0..1
// Producción POP-DRIVEN: cada nivel de edificio ofrece jobsOf(b) puestos; los pops libres los cubren
// (staffing). La producción de un edificio = trabajadores empleados en él × rendimiento/trabajador.
// employedIn = pops realmente trabajando en ese edificio (nivel × puestos × dotación). Así una
// provincia populosa dota (y produce) más; una despoblada se queda a medias.
function employedIn(p,b){return lvlOf(p,b)*jobsOf(b)*staffing(p)}

/* ---- Huecos de construcción por población (modelo EU5) ----
 * El nº de edificios (niveles) que sostiene una provincia crece con su población: una aldea solo
 * cabe unas pocas obras; una metrópoli, muchas. Antes era plano (solo el max por edificio). */
const SLOT_BASE=5;          // huecos mínimos de cualquier provincia habitada
const POP_PER_SLOT=8000;    // +1 hueco por cada tanto de población
const SLOT_MAX=40;          // tope de huecos (gran metrópoli)
function buildSlots(p){if(!p||p.wasteland||p.owner>=NPLAY)return 0;return Math.min(SLOT_MAX,SLOT_BASE+Math.floor((p.pop||0)/POP_PER_SLOT))}
function usedSlots(p){let s=0;for(const b in BUILDINGS)s+=lvlOf(p,b);return s} // cada nivel ocupa un hueco

// Producción VIVA que añadiría UN nivel de b en ESTA provincia (lo que el jugador obtendrá de
// verdad al construir): escala con terreno, moral, afinidad del bien y la dotación RESULTANTE
// (contando los empleos que añade). Devuelve [{res, amt, mul?}]. Así la misma granja rinde más
// en una vega con moral alta que en una montaña. Empareja el cálculo real de provEconomy.
function buildingYield(p,b){
  if(!p||p.owner>=NPLAY||p.wasteland)return [];
  const B=BUILDINGS[b],fx=B.fx,mor=p.morale/100,terr=TERRAINS[p.terrain].prod;
  const jb=jobsOf(b);
  const futureJobs=buildJobs(p)+jb; // dotación tras añadir este nivel
  const st=futureJobs>0?Math.min(1,freeLabor(p)/futureJobs):1;
  const workers=Math.round(jb*st), terrL=TERRAINS[p.terrain].label;
  const mul=1+(provProdMul(p)-1)*st; // multiplicadores del reino (gremio/fundición/universidad)
  const out=[];
  // pasos del cálculo VIVO (para el desglose tipo EU4): [etiqueta, valor]
  const S1=(base,affinity,useTerr)=>{
    const s=[["Base del edificio","+"+nn(base)]];
    if(useTerr&&terr!==1)s.push(["Terreno ("+terrL+")","×"+nn(terr)]);
    s.push(["Moral "+Math.round(mor*100)+"%","×"+nn(mor)]);
    s.push(["Dotación "+Math.round(st*100)+"% ("+workers+" trab.)","×"+nn(st)]);
    if(affinity)s.push(["Afinidad del bien de la provincia","×"+nn(1+AFFINITY)]);
    if(useTerr&&mul!==1)s.push(["Multiplicadores del reino","×"+nn(mul)]);
    return s;
  };
  if(fx.prodAdd)for(const k in fx.prodAdd){
    const aff=resAff(p,b,k), amt=fx.prodAdd[k]*terr*mor*st*(aff?1+AFFINITY:1)*mul;
    out.push({res:k,amt,steps:S1(fx.prodAdd[k],aff,true)});
  }
  if(fx.goldAdd){
    const aff=(p.resType==="dinero"), amt=fx.goldAdd*mor*st*(aff?1+AFFINITY:1);
    out.push({res:"dinero",amt,steps:S1(fx.goldAdd,aff,false)});
  }
  return out;
}
function nn(v){return (Math.round(v*100)/100).toString().replace(/\.?0+$/,"")||"0"} // 2 decimales, sin ceros de cola
function canAfford(n,cost){
  for(const k in cost)if(S.nations[n].res[k]<cost[k])return false;
  return true;
}
function pay(n,cost){for(const k in cost)S.nations[n].res[k]-=cost[k]}
function lvlOf(p,b){return p.buildings[b]||0}
function costFor(p,b){
  const B=BUILDINGS[b],lvl=lvlOf(p,b),f=B.unique?1:(1+0.5*lvl),c={};
  for(const k in B.cost)c[k]=Math.round(B.cost[k]*f);
  return c;
}
function timeFor(p,b){
  const B=BUILDINGS[b],lvl=lvlOf(p,b);
  let h=B.time*(B.unique?1:(1+0.35*lvl));
  h*=1-buildSpeedBonus(p); // la universidad acelera las obras de su provincia
  return Math.max(24,Math.round(h));
}
function buildSpeedBonus(p){
  let s=0;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.buildSpeed)s+=fx.buildSpeed*lvlOf(p,b)}
  return Math.min(0.6,s);
}
// Sin límite por edificio (los HUECOS de construcción por población limitan el total): las obras
// únicas siguen en 1; el resto usa un tope alto y práctico (el coste creciente y los slots frenan antes).
function buildMax(p,b){return BUILDINGS[b].unique?1:20}
function buildBlock(p,b){
  const B=BUILDINGS[b];
  if(lvlOf(p,b)>=buildMax(p,b))return B.unique?"Ya construida":"Nivel máximo";
  if(p.buildQueue.length)return"Obra en curso";
  if(B.coastal&&!p.coastal)return"Requiere costa";
  if(B.urban&&!p.urban)return"Requiere ciudad";
  if(B.resReq&&p.resType!==B.resReq)return"Requiere yacimiento de "+B.resReq;
  if(usedSlots(p)>=buildSlots(p))return"Sin espacio ("+usedSlots(p)+"/"+buildSlots(p)+" edificios)";
  if(B.req)for(const r in B.req)if(lvlOf(p,r)<B.req[r])return"Requiere "+BUILDINGS[r].label+" "+B.req[r];
  if(!canAfford(p.owner,costFor(p,b)))return"Sin recursos";
  return null;
}
function provProdMul(p){
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.prodMul)m+=fx.prodMul*lvlOf(p,b)}
  return m;
}
function provDefMul(p){
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.def)m+=fx.def*lvlOf(p,b)}
  return m;
}
function provUpkeep(p){
  const u={};
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b),up=BUILDINGS[b].up;if(!lvl||!up)continue;
    for(const k in up)u[k]=(u[k]||0)+up[k]/12*lvl;
  }
  return u;
}
function taxOf(p){ // impuestos que pagan los pops (antes salían de la nada)
  return (p.pop||0)*TAX_PC*(p.urban?TAX_URBAN:1)*(p.morale/100);
}
/* ---- Moral: factor de productividad ganado con edificios (Fase 3) ----
 * mor = morale/100 multiplica TODA la producción (ver provEconomy). Al 100% los pops rinden a su
 * valor base; por debajo, es un reductor. La moral NO se recupera sola: la hacen crecer los
 * EDIFICIOS de moral (templo, catedral; en el futuro, tecnologías) en dosis pequeñas y stackeables,
 * y las obras únicas dan crecimiento a TODO el reino (realmMoral). Las provincias conquistadas
 * nacen con la moral baja y hay que "ganárselas" construyendo; la cercanía de enemigos en guerra
 * la erosiona. fx.moral y fx.realmMoral = puntos de moral por MES y nivel (el bloque diario de
 * sim.js aplica 1/30 por día). */
const MORALE_MIN=15;        // suelo de moral (una provincia hostil no cae por debajo)
const MORALE_HOSTILE=2.0;   // moral/mes que drena cada provincia vecina enemiga en guerra
function moraleGrowth(p){   // crecimiento de moral/mes por los edificios de moral de ESTA provincia
  let g=0;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.moral)g+=fx.moral*lvlOf(p,b)}
  g+=CLERO_MORALE*stratFrac(p,"clero"); // Fase D: el clero legitima → moral extra donde abunda (catedrales)
  return g;
}
/* ---- Propiedad de los edificios por ESTAMENTO (E2) ----
 * Cada edificio de una provincia tiene un DUEÑO (corona/burgués/clero/nobleza), fijado al construir su
 * primer nivel (p.bOwner[b]). Los efectos de MORAL/PRODUCTIVIDAD van SIEMPRE a la provincia (da igual
 * quién lo construyó); el DINERO y los BIENES que produce, y su MANTENIMIENTO, van al DUEÑO. Los de la
 * corona rinden al tesoro (S.nations[n].res); los de un estamento, a sus reservas (sWealth/sRes). Por
 * defecto (sin p.bOwner) todo es de la corona → comportamiento retrocompatible. */
const ESTATES_BUILD=["burgues","clero","nobleza"]; // estamentos con capacidad de construir (el campesino no)
function bOwnerOf(p,b){return (p.bOwner&&p.bOwner[b])||"corona"}
// Producción NETA (output − mantenimiento) de los edificios de p, BUCKETEADA por dueño, en un solo
// recorrido. Comparte el cálculo por edificio (terreno·moral·dotación·afinidad·multiplicadores) entre
// la corona y los estamentos. Con todo "corona" equivale al cálculo anterior. Devuelve {dueño:{res}}.
function provEconomyByOwner(p){
  const out={corona:{}};
  if(!p||p.owner>=NPLAY||p.wasteland)return out;
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p),mul=1+(provProdMul(p)-1)*st;
  const bucket=(o,k,v)=>{(out[o]||(out[o]={}));out[o][k]=(out[o][k]||0)+v};
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b);if(!lvl)continue;
    const o=bOwnerOf(p,b),fx=BUILDINGS[b].fx;
    if(fx.prodAdd)for(const k in fx.prodAdd)bucket(o,k,fx.prodAdd[k]*lvl*terr*mor*st*(resAff(p,b,k)?1+AFFINITY:1)*mul);
    if(fx.goldAdd)bucket(o,"dinero",fx.goldAdd*lvl*mor*st*(p.resType==="dinero"?1+AFFINITY:1));
    const up=BUILDINGS[b].up;if(up)for(const k in up)bucket(o,k,-up[k]/12*lvl);
  }
  return out;
}
function provEconomy(p){ // economía que rinde a la CORONA: reparto feudal (su parte) + sus edificios
  const out={res:{},mano:0};
  if(!p||p.owner>=NPLAY||p.wasteland)return out;
  out.res.dinero=flujoBase(p)*repartoRates(p,taxRateOf(p.owner)).corona; // parte de la corona del reparto feudal
  const cr=provEconomyByOwner(p).corona||{};
  for(const k in cr)out.res[k]=(out.res[k]||0)+cr[k];
  return out;
}
function provBreakdown(p){
  const income=[],upkeep=[];let mano=0;
  const net={};
  if(!p||p.owner>=NPLAY||p.wasteland)return{income,upkeep,net,mano};
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p);
  const mul=1+(provProdMul(p)-1)*st; // multiplicador de producción (gremio/fundición/universidad)
  income.push({label:"Impuesto feudal (reparto)",res:"dinero",amt:flujoBase(p)*repartoRates(p,taxRateOf(p.owner)).corona});
  for(const b in BUILDINGS){ // solo los edificios de la CORONA rinden al tesoro (los de estamentos, a sus reservas)
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(!lvl||bOwnerOf(p,b)!=="corona")continue;
    if(fx.prodAdd)for(const k in fx.prodAdd)income.push({label:BUILDINGS[b].label,res:k,amt:fx.prodAdd[k]*lvl*terr*mor*st*(resAff(p,b,k)?1+AFFINITY:1)*mul});
    if(fx.goldAdd)income.push({label:BUILDINGS[b].label,res:"dinero",amt:fx.goldAdd*lvl*mor*st*(p.resType==="dinero"?1+AFFINITY:1)});
  }
  mano=soldAvail(p); // "mano" del desglose ahora = soldadesca disponible (stock, no ingreso)
  for(const b in BUILDINGS){
    const bu=BUILDINGS[b].up,lvl=lvlOf(p,b);if(!lvl||!bu||bOwnerOf(p,b)!=="corona")continue; // mantenimiento solo de los de la corona
    for(const k in bu)upkeep.push({label:BUILDINGS[b].label,res:k,amt:bu[k]/12*lvl});
  }
  for(const it of income)net[it.res]=(net[it.res]||0)+it.amt;
  for(const it of upkeep)net[it.res]=(net[it.res]||0)-it.amt;
  return{income,upkeep,net,mano};
}
function nationEconomy(n){
  const res={},prov=S.provs.filter(p=>p.owner===n&&!isOccupied(p)); // las ocupadas no rinden al dueño
  let pop=0;
  for(const p of prov){if(!p.wasteland)pop+=p.pop||0;const e=provEconomy(p);for(const k in e.res)res[k]=(res[k]||0)+e.res[k]}
  // saqueo de las provincias que ESTA nación ocupa a otros
  for(const p of S.provs)if(isOccupied(p)&&p.occupier===n&&!p.wasteland)res.dinero=(res.dinero||0)+provLoot(p);
  // mantenimiento del ejército POR TIPO de unidad (las levas casi no cuestan; los profesionales sí)
  let troops=0;const up={};
  for(const a of S.armies)if(a.nation===n)for(const k in a.units){
    troops+=a.units[k];const u=UNITS[k].up||{};
    for(const r in u)up[r]=(up[r]||0)+u[r]*a.units[k];
  }
  for(const r in up)res[r]=(res[r]||0)-up[r];
  for(const k in NEED_PC)res[k]=(res[k]||0)-pop*NEED_PC[k]; // necesidades de confort de la población
  res.dinero=(res.dinero||0)+(S.nations[n].alcabalaRate||0); // alcabala del comercio (reconcilia con el tick)
  return{res,provs:prov.length,troops,pop,army:up};
}
/* ---- Libro mayor del reino (Tesorería) ----
 * Desglosa TODA la economía de una nación en ítems firmados {res, group, sub, amt}
 * (amt>0 ingreso, amt<0 gasto). group = categoría (Impuestos, Comercio, Mantenimiento…);
 * sub = detalle dentro de la categoría (provincia, edificio, tipo de unidad, bien). La suma
 * de los ítems por recurso CUADRA con nationEconomy(n).res[k] (el balance del topbar), así que
 * los totales del panel verifican. La UI agrupa por group (nivel 1) y por sub (detalle). */
function nationLedger(n){
  const items=[];
  const push=(res,group,sub,amt)=>{if(Math.abs(amt)>1e-9)items.push({res,group,sub,amt})};
  const prov=S.provs.filter(p=>p.owner===n&&!p.wasteland&&!isOccupied(p));
  let pop=0;
  for(const p of prov){
    pop+=p.pop||0;
    const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p);
    const mul=1+(provProdMul(p)-1)*st;                                // multiplicador de producción (gremio/fundición/universidad)
    push("dinero","Impuestos",p.name,flujoBase(p)*repartoRates(p,taxRateOf(p.owner)).corona); // reparto feudal (parte de la corona)
    for(const b in BUILDINGS){
      const lvl=lvlOf(p,b);if(!lvl||bOwnerOf(p,b)!=="corona")continue;   // solo los edificios de la CORONA en el tesoro
      const fx=BUILDINGS[b].fx,lab=BUILDINGS[b].label;
      if(fx.prodAdd)for(const k in fx.prodAdd){
        const amt=fx.prodAdd[k]*lvl*terr*mor*st*(resAff(p,b,k)?1+AFFINITY:1)*mul;
        if(k==="dinero")push("dinero",(b==="minaPlata"||b==="minaOro")?"Minería":"Comercio",lab,amt); // minas de plata/oro
        else push(k,"Producción (edificios)",lab,amt);
      }
      if(fx.goldAdd)push("dinero","Comercio",lab,fx.goldAdd*lvl*mor*st*(p.resType==="dinero"?1+AFFINITY:1));
      const up=BUILDINGS[b].up;                                       // mantenimiento del edificio
      if(up)for(const k in up)push(k,"Mantenimiento de edificios",lab,-up[k]/12*lvl);
    }
  }
  for(const p of S.provs)if(isOccupied(p)&&p.occupier===n&&!p.wasteland)push("dinero","Saqueo",p.name,provLoot(p));
  for(const a of S.armies)if(a.nation===n)for(const u in a.units){       // mantenimiento del ejército por tipo
    const uu=UNITS[u].up||{};
    for(const r in uu)push(r,"Mantenimiento del ejército",UNITS[u].label,-uu[r]*a.units[u]);
  }
  for(const k in NEED_PC)push(k,"Necesidades de la población",RES_LABEL[k],-pop*NEED_PC[k]); // consumo de confort
  push("dinero","Comercio","Alcabala",S.nations[n].alcabalaRate||0); // impuesto de la corona sobre el mercado
  return items;
}
function armyCount(a){let t=0;for(const k in a.units)t+=a.units[k];return t}
function armyPops(a){let t=0;for(const k in a.units)t+=a.units[k]*(UNITS[k].mano||0);return t} // pops soldados totales del ejército
// consumo de comida del ejército POR TICK (pop-driven): pops × ración/año / YR_TICKS. Los profesionales
// comen más que las levas (campo). Se forrajea de reservas locales/nacional según el slider a.supply.
function armyFood(a){let t=0;for(const k in a.units)t+=a.units[k]*(UNITS[k].mano||0)*(UNITS[k].food||0);return t/YR_TICKS}
// reparto del grano LOCAL que forrajea el ejército a, por provincia: [{p, amt/tick}] (provincia que
// pisa + vecinas, proporcional a su reserva). Para el desglose "de dónde come" en la UI del ejército.
function armyForage(a){
  const out=[],localNeed=armyFood(a)*((a.supply==null?70:a.supply)/100);
  if(localNeed<=1e-9)return out;
  const A=S.provs[a.prov],pool=[];
  if(A&&!A.wasteland&&A.store&&A.store.comida>0)pool.push(A);
  for(const nb of (S.adj[a.prov]||[])){const q=S.provs[nb];if(q&&!q.wasteland&&q.store&&q.store.comida>0)pool.push(q)}
  let avail=0;for(const q of pool)avail+=q.store.comida;
  if(avail<=0)return out;
  const take=Math.min(localNeed,avail);
  for(const q of pool)out.push({p:q,amt:take*(q.store.comida/avail)});
  return out.sort((x,y)=>y.amt-x.amt);
}
// grano que las tropas forrajean de la reserva de la provincia p POR TICK (replica el reparto del
// tick: cada ejército reparte su parte local entre la provincia que pisa y sus vecinas, proporcional
// a la reserva). Suma la porción que toca a p de todos los ejércitos que la incluyen en su pool.
function troopDrainOn(p){
  if(!p||p.wasteland||!p.store||!(p.store.comida>0))return 0;
  let drain=0;
  for(const a of S.armies){
    if(a.nation>=NPLAY)continue;
    const localNeed=armyFood(a)*((a.supply==null?70:a.supply)/100);
    if(localNeed<=1e-9)continue;
    const A=S.provs[a.prov],pool=[];
    if(A&&!A.wasteland&&A.store&&A.store.comida>0)pool.push(A);
    for(const nb of (S.adj[a.prov]||[])){const q=S.provs[nb];if(q&&!q.wasteland&&q.store&&q.store.comida>0)pool.push(q)}
    if(pool.indexOf(p)<0)continue;
    let avail=0;for(const q of pool)avail+=q.store.comida;
    if(avail>0)drain+=Math.min(localNeed,avail)*(p.store.comida/avail);
  }
  return drain;
}
function armyAtk(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].atk;return t}
function armyDef(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].def;return t}
function armyHp(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].hp;return t}
function armySpd(a){let s=999;for(const k in a.units)if(a.units[k]>0.05)s=Math.min(s,UNITS[k].spd);return s===999?18:s}
function nationStrength(n){let t=0;for(const a of S.armies)if(a.nation===n)t+=armyAtk(a)+armyDef(a);return t}
function nationProvCount(n){let t=0;for(const p of S.provs)if(p.owner===n)t++;return t}
// ¿la provincia p puede reclutar la unidad u (para el jugador)? Comprueba dueño/estado y los edificios
// requeridos; la solvencia y la soldadesca se comprueban al reclutar. Usado por la UI, el mapa y el clic.
function recruitable(p,u){
  if(!p||p.owner!==S.player||isOccupied(p)||p.wasteland)return false;
  const U=UNITS[u];for(const r in U.req)if((p.buildings[r]||0)<U.req[r])return false;
  return true;
}
function recruitTime(p,u){
  return Math.max(2,Math.round(UNITS[u].time*(1-0.15*p.buildings.cuartel)*(UNITS[u].req.fabrica?1-0.08*p.buildings.fabrica:1)));
}
// Núcleo económico/demográfico de un tick, SIN DOM: movilizados, economía+necesidades por nación,
// y comida/población/soldadesca por provincia. Lo llaman hourTick (juego) y el arnés de análisis,
// así lo que se mide es exactamente lo que corre. NO incrementa S.hour (lo hace quien llama).
// dt = número de ticks (horas de juego) que representa esta llamada. El juego usa dt=1 (idéntico
// al modelo original); el arnés de análisis puede avanzar a paso de día (dt=24) para ir más rápido.
// Todas las magnitudes por tick (producción, consumo, crecimiento, regeneración) se escalan por dt.
function economyTick(dt=1){
  // 0. mano de obra movilizada por provincia (soldados que dejaron el trabajo): retira dotación
  for(const p of S.provs)p.mob=0;
  for(const a of S.armies)if(a.src)for(const pid in a.src){const P=S.provs[pid];if(P)P.mob+=a.src[pid]}
  // agregados por nación en pasadas O(provincias), no O(naciones×provincias): tropas y población
  // (esta última se llena en la pasada A). La MORAL ya no se integra aquí: la gobierna el bloque
  // diario de sim.js (crecimiento pop-driven por edificios; ver moraleGrowth/moraleTarget).
  const troops=new Float64Array(NPLAY),nationPop=new Float64Array(NPLAY);
  const nationStrata=Array.from({length:NPLAY},()=>{const o={};for(const k of STRATA)o[k]=0;return o}); // pop por estrato y nación (Fase B)
  const basicDem=Array.from({length:NPLAY},()=>({})); // demanda de básicos no-grano por nación (para el precio dinámico)
  const armyUp=Array.from({length:NPLAY},()=>({})); // mantenimiento del ejército por nación y recurso
  for(const a of S.armies){if(a.nation>=NPLAY)continue;
    for(const k in a.units){troops[a.nation]+=a.units[k];const u=UNITS[k].up||{};
      for(const r in u)armyUp[a.nation][r]=(armyUp[a.nation][r]||0)+u[r]*a.units[k]}}
  // Pasada A: producción de cada provincia → tesoro de su nación, y recuperación de moral.
  // (Mismo orden que antes: toda la economía ANTES de necesidades y ANTES de la comida.)
  for(const p of S.provs){
    const n=p.owner;
    if(n>=NPLAY||p.wasteland)continue;
    // provincia ocupada: no rinde a su dueño (ni cuenta para sus necesidades); el ocupante saquea dinero
    if(isOccupied(p)){
      const occ=p.occupier;
      if(occ<NPLAY)S.nations[occ].res.dinero+=provLoot(p)*dt;
      continue;
    }
    nationPop[n]+=p.pop||0;
    if(p.pops){const ns=nationStrata[n];for(const k of STRATA)ns[k]+=p.pops[k]||0} // Fase B: agregado de estratos
    for(const k of NONGRAIN)basicDem[n][k]=(basicDem[n][k]||0)+subsCons(p,k); // demanda de básicos (para el precio del mercado)
    const N=S.nations[n];ensureMarket(N);const R=N.res;
    const byOwner=provEconomyByOwner(p),cr=byOwner.corona||{};
    R.dinero+=flujoBase(p)*repartoRates(p,taxRateOf(p.owner)).corona*dt; // parte de la corona del reparto feudal
    for(const k in cr)R[k]+=cr[k]*dt;                                    // edificios de la CORONA → tesoro
    // Fase B: la producción de comercio de la corona se espeja al mercado nacional (conserva su copia)
    for(const g of MKT_GOODS)if(cr[g]>0)N.mkt[g]=(N.mkt[g]||0)+cr[g]*dt;
    // E2: edificios de ESTAMENTOS → su bolsillo. El dinero producido/gastado va a sWealth. Los BIENES:
    // lo que PRODUCEN va a su reserva (sRes) y los lujos también alimentan el mercado; lo que CONSUMEN de
    // mantenimiento (neto negativo) lo COMPRAN (coste en dinero a precio de referencia), así no hay reserva negativa.
    for(const e of ESTATES_BUILD){const eo=byOwner[e];if(!eo)continue;
      for(const k in eo){const v=eo[k]*dt;
        if(k==="dinero"){N.sWealth[e]+=v;continue}
        if(v>=0){N.sRes[e][k]=(N.sRes[e][k]||0)+v; if(MKT_GOODS.indexOf(k)>=0)N.mkt[k]=(N.mkt[k]||0)+v}
        else N.sWealth[e]+=v*(MKT_PRICE[k]||1)}} // consumo de mantenimiento en bienes → comprado (coste en dinero)
    // reparto feudal del flujo campesino a los estamentos (la parte de la corona ya va arriba)
    const fb=flujoBase(p)*dt;
    if(fb>0){const rr=repartoRates(p,taxRateOf(n));
      N.sWealth.clero+=fb*rr.clero; N.sWealth.nobleza+=fb*rr.nobleza; N.sWealth.campesino+=fb*rr.campesino}
  }
  // Por nación: mantenimiento del ejército y necesidades de confort (consumo/mercado/desabastecimiento).
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const R=S.nations[n].res;
    for(const r in armyUp[n])R[r]-=armyUp[n][r]*dt; // mantenimiento del ejército por tipo
    for(const k in NEED_PC){ // consumo de lujos de confort (nacional); si falta, se compra en el mercado
      const demand=nationPop[n]*NEED_PC[k]*dt;
      let need=demand-R[k];
      if(need<=0){R[k]-=demand;continue}
      R[k]=0;
      const canBuy=Math.min(need,R.dinero/NEED_PRICE[k]);
      R.dinero-=canBuy*NEED_PRICE[k];
      // sin penalización de moral: no cubrir un lujo, de momento, no tiene efecto
    }
    for(const k of RES_KEYS)if(R[k]<0)R[k]=0;
  }
  // Fase B: MERCADO NACIONAL de comercio + riqueza de estratos (capa aditiva; no toca el tesoro).
  // Cada estrato gana un ingreso base por su rol y compra sus lujos del mercado; lo que paga va a
  // los burgueses (comerciantes). El exceso de riqueza se topa por hab (estabiliza) y el stock del
  // mercado no vendido se disipa. Nada de esto altera S.nations[n].res (la corona sigue igual).
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const N=S.nations[n];ensureMarket(N);const str=nationStrata[n],W=N.sWealth;
    W.burgues+=STRATA_INCOME.burgues*str.burgues*dt;                 // solo el burgués tiene sueldo flat; el resto vive del reparto feudal
    if(!N.mktInfo)N.mktInfo={};
    let revTotal=0;
    for(const g of MKT_TRADE){                                        // lujos + COMIDA (las élites compran grano para comer)
      let stock=N.mkt[g]||0,rev=0,demand=0,sold=0;
      for(const k of STRATA)demand+=(LUX_NEED[k][g]||0)*str[k]*dt;    // demanda total del bien este tick (élites)
      if(basicDem[n][g])demand+=basicDem[n][g]*dt;                    // básicos: demanda de subsistencia/construcción del campesinado (da precio dinámico)
      // precio dinámico: del llenado del inventario respecto a su tope (demanda×días). Vacío→caro, lleno→barato.
      const cap=(demand/dt)*24*capDays(g);
      const fill=cap>0?Math.min(1,stock/cap):0.5;                    // 0.5 = referencia (precio base) si no hay demanda
      const targetMul=Math.max(PRICE_MIN,Math.min(PRICE_MAX,1+PRICE_K*(1-2*fill)));
      let price=N.mktPrice[g]!=null?N.mktPrice[g]:MKT_PRICE[g];
      price+=(MKT_PRICE[g]*targetMul-price)*Math.min(1,PRICE_ADJ*dt); // desliza hacia el objetivo (EMA)
      N.mktPrice[g]=price;
      for(const k of STRATA){
        const need=(LUX_NEED[k][g]||0)*str[k]*dt;
        if(need<=0)continue;
        const buy=Math.min(need,stock,(W[k]||0)/price);             // limitado por deseo, stock y bolsillo (al precio actual)
        if(buy>0){W[k]-=buy*price;stock-=buy;rev+=buy*price;sold+=buy}
      }
      W.burgues+=rev*BURGUES_MARGIN;                                 // los burgueses (comerciantes) se quedan un margen
      // E2: el VENDEDOR cobra el resto. La COMIDA la vende el campesino (su excedente) → su bolsillo; así
      // el ciclo cierra (el grano no se regala) y el campesino tiene ingreso por vender. Los lujos, de
      // momento, siguen sin vendedor con bolsillo (capa espejada); se les dará dueño con la producción real.
      if(g==="comida")W.campesino+=rev*(1-BURGUES_MARGIN);
      revTotal+=rev;
      N.mkt[g]=cap>0?Math.min(stock,cap):stock;                      // sobreoferta topada; los bienes escasos quedan bajos
      // info para el panel (flujo/mes, escasez y precio): el mercado trabaja y el precio se mueve con la oferta
      N.mktInfo[g]={dem:demand/dt*730,sold:sold/dt*730,short:sold<demand*0.98,price};
    }
    N.res.dinero+=revTotal*ALCABALA;                                 // ALCABALA: la corona cobra del comercio (compensa el ×3 urbano perdido)
    N.alcabalaRate=revTotal/dt*ALCABALA;                             // por tick, para reconciliar el display de Tesorería
    for(const k of STRATA){const cap=(WEALTH_CAP[k]||0.1)*str[k];if(W[k]>cap)W[k]=cap;if(W[k]<0)W[k]=0}
    N.prosp=str.burgues>0?Math.min(1.5,(W.burgues/str.burgues)/PROSP_REF):1; // prosperidad burguesa (Fase C)
  }
  // Comida del EJÉRCITO (pop-driven): cada ejército consume grano por sus pops. El slider a.supply
  // reparte entre FORRAJEO local (la provincia que pisa + sus vecinas, proporcional a la reserva de
  // cada una, para no drenar una sola) y el grano NACIONAL. Se resuelve ANTES de la subsistencia,
  // así el forrajeo cuenta como consumo extra y puede provocar hambruna local si aprieta.
  // Atrición (morir si no hay comida) es futura: por ahora el déficit simplemente no se cubre.
  for(const a of S.armies){
    if(a.nation>=NPLAY)continue;
    const food=armyFood(a)*dt;
    if(food<=1e-9)continue;
    const forage=(a.supply==null?70:a.supply)/100;        // % del grano forrajeado localmente
    const R=S.nations[a.nation].res;
    R.comida=Math.max(0,(R.comida||0)-food*(1-forage));    // parte NACIONAL
    const localNeed=food*forage;                           // parte LOCAL (provincia + vecinas)
    if(localNeed>1e-9){
      const P=S.provs[a.prov],pool=[];
      if(P&&!P.wasteland&&P.store&&P.store.comida>0)pool.push(P);
      for(const nb of (S.adj[a.prov]||[])){const q=S.provs[nb];if(q&&!q.wasteland&&q.store&&q.store.comida>0)pool.push(q)}
      let avail=0;for(const q of pool)avail+=q.store.comida;
      if(avail>0){const take=Math.min(localNeed,avail);for(const q of pool)q.store.comida-=take*(q.store.comida/avail)}
    }
  }
  // Pasada B: el campesino produce los 4 BÁSICOS según su TERRENO y comercia su superávit/déficit en el
  // mercado NACIONAL de cada bien (stock + precio dinámico, como los lujos). El GRANO tiene además despensa
  // (colchón) y hambruna. Cada bien básico se acumula como STOCK del reino (N.mkt[k]): el excedente lo
  // llena, el déficit lo compra (el burgués cobra su margen; el campesino lo paga). Los desequilibrios ENTRE
  // reinos los resuelve luego el arbitraje (Bloque 3), que mueve stock del mercado barato al caro.
  const bSold=Array.from({length:NPLAY},()=>({})); // básico comprado del mercado por déficit local (para el panel)
  const regen=Math.min(1,SOLD_REGEN*dt);
  for(const p of S.provs){
    if(p.wasteland)continue;
    if(!p.store)p.store={};
    const pop0=p.pop||0; // Fase A: para reescalar los estratos con el cambio de población
    const n=p.owner, N=(n<NPLAY)?S.nations[n]:null; if(N)ensureMarket(N);
    let famine=false;
    // --- GRANO: despensa + venta de excedente + compra de déficit del mercado nacional + hambruna ---
    {
      const cap=storeCap(p,"comida");
      if(p.store.comida==null)p.store.comida=cap*0.6;
      p.store.comida+=subsBalance(p,"comida")*dt;
      if(p.store.comida>cap){const over=p.store.comida-cap;p.store.comida=cap;if(N)N.mkt.comida=(N.mkt.comida||0)+over} // excedente → mercado
      if(p.store.comida<0){
        let deficit=-p.store.comida;p.store.comida=0;
        if(N){ // comprar grano del mercado nacional (lo que otras provincias vendieron); el burgués cobra su margen
          const price=N.mktPrice.comida||MKT_PRICE.comida, buy=Math.min(deficit,N.mkt.comida||0);
          if(buy>0){N.mkt.comida-=buy;deficit-=buy;const turn=buy*price;N.sWealth.burgues+=turn*BURGUES_MARGIN;N.sWealth.campesino-=turn*BURGUES_MARGIN}
        }
        const cons=subsCons(p,"comida")*dt;
        if(cons>0&&deficit/cons>FAMINE_DEF){p.pop=Math.max(0,(p.pop||0)-deficit*STARVE_RATE);famine=true} // no pudo importar grano → hambruna
      }
    }
    // --- MADERA/PIEDRA/HIERRO: excedente → stock del mercado nacional; déficit → comprar del stock ---
    if(N)for(const k of NONGRAIN){
      const net=subsBalance(p,k)*dt;
      if(net>=0){N.mkt[k]=(N.mkt[k]||0)+net}                                     // excedente campesino → mercado del reino
      else{                                                                      // déficit: comprar del stock (lo no cubierto es inerte; los básicos no matan de hambre)
        const price=N.mktPrice[k]||MKT_PRICE[k]||1, buy=Math.min(-net,N.mkt[k]||0);
        if(buy>0){N.mkt[k]-=buy;const turn=buy*price;N.sWealth.burgues+=turn*BURGUES_MARGIN;N.sWealth.campesino-=turn*BURGUES_MARGIN;bSold[n][k]=(bSold[n][k]||0)+buy}
      }
    }
    p.famine=famine;
    if(!famine){const cap=storeCap(p,"comida");const fill=cap>0?p.store.comida/cap:0;p.pop=(p.pop||0)*(1+POP_GROWTH_BASE*(0.4+fill)*dt)}
    if(p.pops&&pop0>0){const f=(p.pop||0)/pop0;for(const k in p.pops)p.pops[k]*=f} // estratos siguen a la población
    // Fase C: movilidad campesino<->burgués hacia la fracción objetivo de la provincia
    if(p.pops&&p.owner<NPLAY){
      const base=(p.pops.campesino||0)+(p.pops.burgues||0);
      if(base>0){
        const gap=targetBurgFrac(p)*base-(p.pops.burgues||0);
        const prosp=S.nations[p.owner].prosp;
        let move=gap*PROMO_RATE*dt;
        if(move>0)move*=(prosp==null?1:Math.max(0,prosp)); // el ascenso exige burguesía próspera; el descenso es libre
        move=Math.max(-p.pops.burgues,Math.min(p.pops.campesino,move));
        p.pops.burgues+=move;p.pops.campesino-=move;
      }
    }
    if(p.owner<NPLAY){const sc=soldCap(p),s=p.sold!=null?p.sold:sc;p.sold=s+(sc-s)*regen}
  }
  // Mantenimiento de los mercados de BÁSICOS no-grano: topar el stock (evita sobreacumulación) y refrescar el
  // panel (demanda, comprado del mercado por los déficit locales, escasez, precio). El comercio ENTRE reinos
  // (arbitraje) va justo debajo y añade exp/imp.
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;ensureMarket(N);if(!N.mktInfo)N.mktInfo={};
    for(const k of NONGRAIN){
      const dem=basicDem[n][k]||0, cap=dem*24*BASIC_CAP_DAYS;                   // tope de inventario = días de demanda (buffer corto)
      if(cap>0&&N.mkt[k]>cap)N.mkt[k]=cap;
      const price=N.mktPrice[k]||MKT_PRICE[k]||1, stock=N.mkt[k]||0;
      N.mktInfo[k]={dem:dem*730,sold:(bSold[n][k]||0)/dt*730,short:cap>0&&stock<cap*0.15,price,exp:0,imp:0};
    }
  }
  // BLOQUE 3 — COMERCIO ENTRE MERCADOS NACIONALES (arbitraje). Para cada bien (básicos + comida + lujos), el
  // burgués compra donde el precio está BAJO (país con excedente/stock alto) y lo vende donde está ALTO (país
  // con déficit/stock bajo): mueve stock del mercado barato al caro, y los precios CONVERGEN. NO hay "mercado
  // internacional" como entidad: son transacciones entre los mercados de los reinos, movidas por los burgueses,
  // que se quedan el DIFERENCIAL (comprar barato/vender caro). Global sin distancia en v1 (futuro: coste por
  // distancia/ruta). Solo mueve mkt+sWealth: el Tesoro de la corona NO se toca (reconciliación intacta).
  for(const g of MKT_TRADE){
    const ref=MKT_PRICE[g]||1, node=[];
    for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;ensureMarket(N);if(!N.mktInfo[g])N.mktInfo[g]={price:N.mktPrice[g]||ref};
      node.push({N,p:N.mktPrice[g]!=null?N.mktPrice[g]:ref,s:N.mkt[g]||0});}
    if(node.length<2)continue;
    node.sort((a,b)=>a.p-b.p);                                                  // ascendente por precio: baratos primero
    let lo=0,hi=node.length-1;
    while(lo<hi){
      const A=node[lo],B=node[hi];                                             // A barato (vende su excedente), B caro (compra)
      if(B.p-A.p<TRADE_MIN_SPREAD*ref)break;                                   // diferencial ya cerrado → sin arbitraje rentable
      const q=(A.s||0)*TRADE_RATE*dt;                                          // A exporta una fracción de su stock (convergencia gradual)
      if(q>1e-9){
        A.N.mkt[g]=Math.max(0,(A.N.mkt[g]||0)-q); B.N.mkt[g]=(B.N.mkt[g]||0)+q; // el stock viaja del mercado barato al caro
        const half=q*(B.p-A.p)*(1-TRADE_COST)*0.5;                            // el mercader de cada punta se lleva medio diferencial
        A.N.sWealth.burgues+=half; B.N.sWealth.burgues+=half;
        A.N.mktInfo[g].exp=(A.N.mktInfo[g].exp||0)+q/dt*730;                   // exporta (panel)
        B.N.mktInfo[g].imp=(B.N.mktInfo[g].imp||0)+q/dt*730;                   // importa (panel)
      }
      lo++;hi--;                                                               // cada reino comercia con su opuesto; converge en varios ticks
    }
  }
  // Telemetría de comercio SUAVIZADA (para el panel): el volumen de cada tick es "a golpes" (el arbitraje
  // empareja rotando). Se promedia con EMA → un ritmo mensual estable que no parpadea. El panel lee estos
  // valores suavizados (sold/exp/imp en unidades/mes); dem y price ya son estables por su cuenta.
  const sm=Math.min(1,TEL_SMOOTH*dt);
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive||!N.mktInfo)continue;ensureMarket(N);
    for(const g of MKT_TRADE){const mi=N.mktInfo[g];if(!mi)continue;const t=N.mktTel[g]||(N.mktTel[g]={sold:0,exp:0,imp:0});
      t.sold+=((mi.sold||0)-t.sold)*sm; t.exp+=((mi.exp||0)-t.exp)*sm; t.imp+=((mi.imp||0)-t.imp)*sm;
      mi.sold=t.sold; mi.exp=t.exp; mi.imp=t.imp; // el panel lee el valor SUAVIZADO (estable)
    }
  }
}

export {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, nationLedger, isOccupied, occupierOf, provLoot, armyCount, armyPops, armyFood, armyForage, troopDrainOn, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, soldCap, soldAvail, recruitable, taxOf, moraleGrowth, MORALE_MIN, MORALE_HOSTILE, SOLD_FRAC, foodCons, foodBalance, foodCap, foodFill, harvestMul, subsProd, subsCons, subsBalance, storeCap, storeOf, SUBS_BASICS, specialistCap, buildJobs, freeLabor, staffing, employedIn, jobsOf, buildingYield, buildSlots, usedSlots, structPPF, JOBS_PER_LEVEL, NEED_PC, NEED_PRICE, FOOD_PRICE, economyTick,
  MKT_GOODS, MKT_TRADE, MKT_PRICE, ensureMarket, seedStrataWealth, flujoBase, repartoRates, taxRateOf, manorOf, canStaffIndustry, bOwnerOf, provEconomyByOwner, ESTATES_BUILD,
  BASICS, TERRAIN_PROD, terrMul
};
