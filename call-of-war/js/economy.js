// economy.js
import { NPLAY, BUILDINGS, BUILD_JOBS, TERRAINS, UNITS, RES_KEYS, RES_LABEL, LOOT_FRAC, STRATA, EXTRA_GOODS, RES_CAT, RES_RAW_CATS, START_DATE } from "./config.js";
import { S } from "./state.js";
// El comercio deja de ser un pool GLOBAL: cada par de reinos tiene su geografía y su política.
// kmBetween es la MISMA haversine que ya usan las marchas de ejércitos (sim.js) — no hay geometría nueva.
// Sin ciclo de imports: mapgen.js y diplomacy.js solo importan de config.js y state.js.
import { kmBetween, pxToLonLat } from "./mapgen.js";
import { isEmbargoed, atWarPair } from "./diplomacy.js";

// ---- Ocupación (estilo EU4): la provincia sigue siendo de iure de su dueño (p.owner) pero
// está controlada militarmente por p.occupier. Su renta se le niega al dueño y el ocupante
// saquea una fracción. p.occupier===-1 (o indefinido) = la controla su dueño. ----
function isOccupied(p){return p.occupier>=0&&p.occupier!==p.owner}

// Claves de BUILDINGS precalculadas (el catálogo no cambia tras cargar config.js). Recorrer un array es ~3× más rápido
// que for-in, y cada efecto (prodMul, mano, moral…) solo lo tienen unos pocos edificios: provProdMul recorría los 56
// tipos por provincia y tick (~50 ms/día). Mismo orden que BUILDINGS → mismas sumas, bit a bit.
const BKEYS=Object.keys(BUILDINGS);
const FX_KEYS={};for(const b of BKEYS){const fx=BUILDINGS[b].fx||{};for(const k in fx)(FX_KEYS[k]||(FX_KEYS[k]=[])).push(b)}
const fxKeys=k=>FX_KEYS[k]||[];

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
// Soldadesca: el cupo de gente movilizable de una provincia. Su techo escala con la
// población y con los edificios militares (fx.mano, reinterpretado como % de cupo extra).
function soldCap(p){
  if(!p||p.wasteland||p.owner>=NPLAY)return 0;
  let bonus=1;
  for(const b of fxKeys("mano"))bonus+=BUILDINGS[b].fx.mano*lvlOf(p,b);
  bonus+=NOBLE_LEVY*stratFrac(p,"nobleza"); // Fase D: la nobleza (clase militar) amplía la leva
  return (p.pop||0)*SOLD_FRAC*bonus;
}
function soldAvail(p){return p.sold!=null?p.sold:soldCap(p)} // stock actual (o el techo si aún no se sembró)

/* ---- Subsistencia local por provincia: el GRANO ----
 * Los campesinos (pops de serie) NO trabajan en fábricas: trabajan la tierra y producen/consumen su
 * propio GRANO ≈ autosuficiente. El grano se guarda en una DESPENSA local por provincia (p.store.comida),
 * cuyo tope amplía el Almacén, como colchón anti-hambruna. Un modificador de COSECHA (harvestMul,
 * determinista = año agrícola COMÚN a todo el mapa + suerte local de la provincia) afecta al grano
 * (bien ORGÁNICO) y al flujo económico campesino (flujoBase). En un mal año se
 * consume más de lo que se produce → se drena la despensa; si se agota y sigue negativa → HAMBRUNA
 * (muertes) [+ migración, futura]. El grano ES la misma unidad que el recurso nacional (para socorro/
 * requisa). Capa SEPARADA del Tesoro: los edificios rinden a la nación, los campesinos comen su grano.
 * Los DEMÁS bienes (madera/piedra/hierro, lujos) NO se acopian por provincia: son FLUJO al mercado
 * nacional — el excedente campesino (resType) y los edificios los ponen a la venta y los estamentos los
 * compran para comer (trigo) y construir (materiales). Ver E1/E2 en [[basileus-pop-economy-vision]]. */
const YR_TICKS=8760;             // ticks (horas de juego) por año
const MONTH_TICKS=YR_TICKS/12;   // ≈730 ticks/mes (la campaña avanza en meses de calendario)
// ---- COSECHA: shock COMÚN del año + shock IDIOSINCRÁTICO de la provincia ----
// El sorteo NO puede ser solo por provincia: si cada una tira su dado por su cuenta, un reino de 20
// provincias promedia su CV a 0.19/√20 ≈ 0.04 y la cosecha deja de existir a escala de reino (era el
// caso hasta 2026-07-15). Los años de hambre de verdad —1315-16, 1349-51, 1437-38— fueron PANEUROPEOS,
// no sorteos por parroquia: sin componente común, una cola de desastre tampoco se notaría.
// La AMPLITUD TOTAL por provincia no cambia (CV = AMP/√3 ≈ 0.19, contra 0.205 del trigo bruto histórico,
// Campbell & Ó Gráda 1268-1480): lo que cambia es cómo se reparte y su forma. NO subir HARVEST_AMP.
const HARVEST_AMP=0.33;          // variación anual TOTAL por provincia (±33% → CV≈0.19)
const HARVEST_COMMON=0.70;       // fracción de la VARIANZA que es común a todo el mapa (calibración, no historia)
const HARVEST_TAIL_P=0.014;      // prob/año de un desastre general: 3 episodios encadenados >25% en 212 años
const HARVEST_TAIL=0.30;         // caída EXTRA (máx.) del año de desastre: la cola que una uniforme no tiene
// NO se añadió correlación serial (AR(1)) A PROPÓSITO: la autocorrelación real es de solo +14% sobre la
// independencia y "mixed" entre granos (Campbell & Ó Gráda) → un AR(1) fuerte sería tan falso como la
// independencia. Lo que faltaba era COLA y correlación ESPACIAL, no memoria.
// CONSECUENCIA ACEPTADA, NO ES UN BUG: el mantenimiento es fijo, así que un shock del 15% en el bruto
// apalanca el NETO a un CV≈0.8 y la corona cierra en déficit ~27 de cada 200 años. Es el siglo XV: por eso
// los reyes convocaban Cortes y pedían prestado. Si eso es demasiado, la perilla es HARVEST_COMMON, no AMP.
const HARVEST_FLOOR=0.25;        // suelo: ni el peor año anula la cosecha del todo
const HARVEST_AC=HARVEST_AMP*Math.sqrt(HARVEST_COMMON);     // amplitud del shock común
const HARVEST_AL=HARVEST_AMP*Math.sqrt(1-HARVEST_COMMON);   // amplitud del shock local (AC²+AL²=AMP²)
const SUBS_BASICS=["comida"];    // único básico con DESPENSA local (colchón anti-hambruna); el resto es flujo
// El GRANO es casi autosuficiente por terreno (0.8-1.4): es el staple de supervivencia y, SIN mercado
// internacional aún (Bloque 3), un país de terreno pobre no puede importarlo → no debe colapsar por hambre.
// La ESPECIALIZACIÓN fuerte va en los básicos industriales (madera/piedra/hierro), que no matan de hambre y
// son los que mueven el comercio. (Cuando exista la importación internacional, el grano podrá endurecerse.)
// Multiplicadores calibrados para que la producción MEDIA de cada básico ≈1.1-1.2× la necesidad (mercados con
// excedente estructural que llenan su stock → precio diferenciado) manteniendo FUERTE la especialización (bosque
// exporta madera; montaña, piedra/hierro; llanura fértil, grano pero importa materiales). Así nace el comercio.
// VOCACIÓN DEL TERRENO POR CATEGORÍA (no por bien): con ~37 bienes, el terreno tiene un factor por CATEGORÍA de
// materia prima (cereal/cultivo/ganado/bosque/extractivo/mar) y cada bien hereda el de la suya (ver RES_CAT). El
// GRANO (cereal) queda suave (0.9-1.4, no matar de hambre); los industriales fuertes por zona → mueven el comercio.
const TERRAIN_CAT={ // terreno → {categoría: multiplicador de producción}
  vega:    {cereal:1.4, cultivo:1.3, ganado:0.8, bosque:0.5, extractivo:0.4},
  pradera: {cereal:1.3, cultivo:0.9, ganado:1.5, bosque:0.6, extractivo:0.5},
  llanura: {cereal:1.15,cultivo:1.0, ganado:1.0, bosque:0.8, extractivo:0.75},
  colinas: {cereal:1.0, cultivo:1.2, ganado:1.0, bosque:1.0, extractivo:1.55},
  bosque:  {cereal:0.95,cultivo:0.5, ganado:1.0, bosque:2.6, extractivo:0.8},
  pantano: {cereal:0.92,cultivo:0.6, ganado:0.8, bosque:2.0, extractivo:0.7},
  estepa:  {cereal:0.97,cultivo:0.5, ganado:1.5, bosque:0.6, extractivo:1.05},
  desierto:{cereal:0.9, cultivo:0.5, ganado:0.6, bosque:0.35,extractivo:1.55},
  montana: {cereal:0.9, cultivo:0.4, ganado:0.7, bosque:0.7, extractivo:2.5},
  tundra:  {cereal:0.9, cultivo:0.2, ganado:0.7, bosque:1.1, extractivo:0.85},
};
const MAR_MUL=1.2, MAR_INLAND=0.15; // categoría 'mar' (pescado/sal/ámbar): solo rinde en la COSTA
const SUBS_STORE_YEARS={comida:0.7}; // capacidad de la despensa de GRANO en años de consumo (× Almacén)
function terrMul(p,k){ // vocación del terreno para el bien k, POR CATEGORÍA
  const cat=RES_CAT[k]; if(!cat)return 1;
  if(cat==="mar")return p.coastal?MAR_MUL:MAR_INLAND;
  const t=TERRAIN_CAT[p.terrain]; return (t&&t[cat]!=null)?t[cat]:1;
}
function terrCatMul(p,cat){ // igual pero por categoría directa (para la ficha de provincia)
  if(cat==="mar")return p.coastal?MAR_MUL:MAR_INLAND;
  const t=TERRAIN_CAT[p.terrain]; return (t&&t[cat]!=null)?t[cat]:1;
}
function hash01(a,b){ // hash determinista → [0,1)
  let n=(a*73856093^b*19349663)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;
  return (n>>>0)/4294967296;
}
// ⚠ La semilla NO es arbitraria: se eligió (de 1914 candidatas equivalentes) porque el sorteo es
// DETERMINISTA por año, así que los años 0 y 1 son los mismos EN TODAS LAS PARTIDAS. Con la semilla
// anterior (0x5f3a) salían -16,9% y -20,0%: dos hambrunas encadenadas nada más empezar, siempre, en
// todas las partidas — un lastre fijo, no variedad. Verificado en una partida real de Sergio (log de
// 1444-11 a 1446-06): despensas 0,595 → 0,338 y hambruna desde 1446-02.
// 0x1057 da -4,3% y -3,7% (años normalitos: ni regalo ni desastre) y mantiene la distribución sana a
// 100 años: 27 años malos (<-12%) y 25 buenos (>+12%), el peor a -27%.
const HARVEST_SEED=0x1057;
function harvestYear(year){ // el AÑO AGRÍCOLA que comparte todo el mapa (esto es lo que se nota en el tesoro)
  let m=HARVEST_AC*(hash01(year,HARVEST_SEED)*2-1);
  const t=hash01(year,0x1b7d);
  if(t<HARVEST_TAIL_P)m-=HARVEST_TAIL*(1-t/HARVEST_TAIL_P); // cola izquierda: el desastre general y raro
  return m;
}
function harvestMul(p){ // calidad de la cosecha de esta provincia este año (año común + suerte local)
  const year=Math.floor(S.hour/YR_TICKS);
  const local=HARVEST_AL*(hash01(p.id,year)*2-1);
  return Math.max(HARVEST_FLOOR,1+harvestYear(year)+local);
}
function storeCap(p,k){return (p.pop||0)*(SUBS_STORE_YEARS[k]||0.5)*(1+0.8*lvlOf(p,"almacen"))} // el Almacén amplía la reserva
function storeOf(p,k){const c=storeCap(p,k);return (p.store&&p.store[k]!=null)?p.store[k]:c*0.6} // reserva actual (o siembra)
function foodFill(p){const c=storeCap(p,"comida");return c>0?Math.min(1,storeOf(p,"comida")/c):0.5} // llenado de la despensa (0..1)

// ---- Movilidad social (Fase C): ascensos/descensos campesino<->burgués ----
// Modelo "fracción objetivo + deriva": cada provincia tiende a una composición según su DESARROLLO
// (urbanización + edificios de comercio); los pops migran lento hacia ella. El ASCENSO se modula por
// la PROSPERIDAD de los burgueses del reino (si prosperan, atraen; si penan, no); el DESCENSO es libre.
const PROMO_RATE=0.0010;      // fracción de la brecha corregida por tick (lento, stackeable)
function targetBurgFrac(p){   // fracción objetivo de burgueses sobre la clase baja (campesino+burgués)
  // Base = el sembrado inicial (sobre la clase baja): así NO hay descenso de arranque; solo el
  // comercio construido empuja por encima → ascenso. Ciudad ~0.40, campo ~0.052.
  let f=p.urban?0.40:0.052;
  for(const b of ["mercado","gremio","lonja","puerto"])f+=0.03*lvlOf(p,b); // el comercio atrae burguesía
  return Math.min(0.6,f);
}
// ---- COSTE DE TRANSPORTE POR PAR: aquí es donde el pool global se convierte en mercados locales ----
// LA REGLA, y es la que gobierna toda la geografía comercial de 1444: el flete se paga por PESO, pero lo
// que decide si compensa moverlo es su peso frente a lo que VALE. Por mucho que pese, si vale muchísimo,
// compensa. Por eso la pimienta cruzaba medio mundo y la piedra no salía del valle:
//        coste (fracción del valor) = km × PESO por unidad ÷ PRECIO por unidad
// ⚠ ERROR CORREGIDO (2026-07-15): la primera versión NO dividía por el precio. Se calibró con dos anclas
// —grano Danzig→Brujas y sal Portugal→Brujas— que daban el mismo coeficiente por km, y de ahí se concluyó
// que "en el granel manda la distancia, no el precio". Era un espejismo: grano y sal tienen densidad de
// valor PARECIDA. Al generalizarlo, el peso pasó a ser "por ducado" y por categoría, lo que metió a las
// PIELES (ref 4.5) en el mismo saco que la MADERA (ref 1.0) por ser ambas "bosque", y al ÁMBAR (5.0) con
// el PESCADO (1.5) por ser "mar". Resultado medido en partida real: fletes del 230-350% y un mundo con
// 436.529 de lino a 0,43 que no podía llegar a un reino que lo pagaba a 1,20.
// Ahora TRADE_BULK es peso FÍSICO por unidad (no por ducado) y el precio divide: dentro de una categoría,
// lo caro viaja y lo barato no. Que es justo lo que pasaba.
const TRADE_KM=5.35e-4;       // calibrado: grano (ref 0.8, peso 1.0) a 1100 km por mar = 50% del valor
const TRADE_SEA=0.68;         // ambas capitales costeras. NO es el 8:4:1 tierra:río:mar (eso es por
                              // TONELADA-MILLA); en rutas comparables el mar ganaba ~1,5× (Brujas→Barcelona
                              // 1398: mar 15% vs tierra 22%). Tampoco se modela el tipo de barco, aunque
                              // pesaba tanto como el mar (misma saca de lana: 25% en galera veneciana vs
                              // 5,16% en coca genovesa): demasiado ruido para lo que aporta.
// PESO FÍSICO por unidad, relativo al grano (=1.0). Calibrado: la sal a 1800 km por mar = 85% de su valor
// (ref 1.6) exige peso 2.1 — es un mineral, pesa más que el grano por unidad. El ganado ANDA SOLO.
const TRADE_BULK={cereal:1.0, cultivo:1.0, mar:2.1, ganado:0.8, bosque:1.6, extractivo:2.2,
  manufactura:0.6, comercio:0.5, moneda:0.05};
// El riesgo era POLÍTICO, no meteorológico: ≥50% del coste del seguro marítimo venía de corso e
// incautaciones por guerra (el recargo de invierno nunca pasó del 13%).
const TRADE_WAR=3.0;          // la guerra ENCARECE el par; no lo corta (había contrabando y neutrales)
function ensureMarket(N){ // inicializa el estado de mercado/riqueza de una nación si falta (los precios los fija economy2 cada día)
  if(!N.sWealth){N.sWealth={};for(const k of STRATA)N.sWealth[k]=0}
  if(!N.mkt)N.mkt={};
  if(!N.mktPrice)N.mktPrice={};
  if(!N.inputCover)N.inputCover={};
}
const DIEZMO=0.10;         // fracción del flujo para el clero (fija)
const ALCABALA=0.08;       // impuesto de la corona sobre el comercio INTERNO (ventas del mercado). Ajustable por nación (N.alcabala).
const ALMOJ_DEFAULT=0.05;  // ALMOJARIFAZGO: aduana de la corona sobre el comercio EXTERIOR (arbitraje). Histórico Castilla ~5% (2,5% export/5% import). Ajustable (N.almojarifazgo).
// Señorío de la provincia (derivado, sin estado nuevo): renta de la tierra y a quién va.
//  capital→realengo (renta a la CORONA) · ciudad→abadengo (renta al CLERO) · resto→solariego (renta a la NOBLEZA)
const MANOR_RENT={realengo:0.10,solariego:0.28,abadengo:0.22};
function manorOf(p){return p.capital?"realengo":(p.urban?"abadengo":"solariego")}
function taxRateOf(n){const N=S.nations[n];return N&&N.taxRate!=null?Math.max(0.02,Math.min(0.20,N.taxRate)):0.08} // impuesto FEUDAL (parte de la corona del reparto), ajustable por nación
function alcabalaOf(n){const N=S.nations[n];return N&&N.alcabala!=null?Math.max(0,Math.min(0.30,N.alcabala)):ALCABALA}      // ALCÁBALA (comercio interno), ajustable
function almojOf(n){const N=S.nations[n];return N&&N.almojarifazgo!=null?Math.max(0,Math.min(0.60,N.almojarifazgo)):ALMOJ_DEFAULT} // ALMOJARIFAZGO (aduana comercio exterior), ajustable
// ================= FLETE 0..1 (Fase 2, decisión 4 del consejo) =================
// Coste de TRANSPORTE de llevar el excedente monetizado del campesino al CENTRO DE COMERCIO, como fracción de su
// valor. Distancia = hubKm (la Capa 2 ya lleva la OROGRAFÍA dentro: una ruta de montaña tiene hubKm mayor que su
// recta). Es ACOPIO TERRESTRE, fórmula DISTINTA del arbitraje marítimo (sin el descuento TRADE_SEA — artesano#3).
// Referencia = grano (lo que el campesino mueve a granel: pesa mucho, vale poco → mucho flete; la pimienta cruza
// el mundo, la piedra no sale del valle). CLAMP a FLETE_MAX: a ~1300 km el flete superaría el valor del grano →
// nunca pasa del 85% (ancla: coste TOTAL de ruta sal Portugal→Brujas, mercader/cronista; no extrae más que el
// valor). Es lo que de verdad DESINTEGRA el Este del mercado occidental (su grano remoto no compensa moverlo),
// distinto del acceso (decisión 2, marketKm, "¿hay plaza local?"): capas separadas, variables distintas, NO doble
// penalización (campesino#2). El grueso del flete EVAPORA (carretero, bestias, merma); solo TOLL_FRAC es portazgo.
const FLETE_MAX=0.85;    // techo del flete (fracción del valor): ancla histórica, nunca extrae más que el valor del bien
const TOLL_FRAC=0.15;    // porción del flete que queda como PORTAZGO del señor de origen (~15%, DISEÑO no dato: el cronista no halló cifra para 1444); el resto se pierde en el transporte
// constantes del tick demográfico (las usa economy2.js)
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
// buildJobs recorre TODOS los edificios y se llama varias veces por provincia y por tick (vía staffing).
// Como los edificios NO cambian DURANTE un economyTick (solo entre ticks, en la fase de construcción de
// sim.js), se memoiza con un sello de tick (_bjGen, que economyTick incrementa al empezar): la primera
// llamada del tick calcula, las demás devuelven el valor. Sin invalidadores dispersos → no puede quedar
// obsoleto. Perfilado: buildJobs+staffing+afines eran ~34% del tick.
let _bjGen=0;
function buildJobs(p){
  if(p._bjGen===_bjGen)return p._bj;
  let j=0;for(const b of BKEYS)j+=effLvl(p,b)*jobsOf(b);
  p._bj=j; p._bjGen=_bjGen; return j;
}
function freeLabor(p){return Math.max(0,specialistCap(p)-(p.mob||0))}    // libres tras descontar movilizados
function staffing(p){const j=buildJobs(p);return j>0?Math.min(1,freeLabor(p)/j):1} // dotación 0..1

/* ---- Huecos de construcción por población (modelo EU5) ----
 * El nº de edificios (niveles) que sostiene una provincia crece con su población: una aldea solo
 * cabe unas pocas obras; una metrópoli, muchas. Antes era plano (solo el max por edificio). */
const SLOT_BASE=5;          // huecos mínimos de cualquier provincia habitada
const POP_PER_SLOT=8000;    // +1 hueco por cada tanto de población
const SLOT_MAX=40;          // tope de huecos (gran metrópoli)
function buildSlots(p){if(!p||p.wasteland||p.owner>=NPLAY)return 0;return Math.min(SLOT_MAX,SLOT_BASE+Math.floor((p.pop||0)/POP_PER_SLOT))}
function usedSlots(p){let s=0;const B=p.buildings;for(let i=0;i<BKEYS.length;i++)s+=B[BKEYS[i]]||0;return s} // cada nivel ocupa un hueco

function nn(v){return (Math.round(v*100)/100).toString().replace(/\.?0+$/,"")||"0"} // 2 decimales, sin ceros de cola
function canAfford(n,cost){
  for(const k in cost)if(tsyAvail(n,k)<cost[k])return false;
  return true;
}
/* ============ Capa de presentación MENSUAL de la tesorería del jugador ============
 * La economía (economy2.js economyTick2) mueve res[k] cada día. Para que el jugador
 * vea y gaste su tesoro "mes a mes" mantenemos, SOLO para su nación:
 *   S.tsyAccrual[k]  → suma del Δ real de res[k] en los ticks del mes EN CURSO
 *   S.tsyMonthBal[k] → total recurrente del ÚLTIMO mes cerrado = la cifra "/mes" (estable)
 *   S.monthKey       → mes de calendario en curso (para detectar el cambio de mes)
 * El saldo COMPROMETIDO (lo que se muestra y se puede gastar) = res − max(0, acumulado):
 * como res crece a la par que el acumulado, el comprometido se queda en el PRINCIPAL de
 * inicio de mes; el beneficio del mes "llega" de golpe en el rollover (día de paga), y las
 * pérdidas/gastos se notan al momento. La IA usa el saldo real (res), sin tocar nada. */
function monthKeyOf(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCFullYear()*12+d.getUTCMonth()}
function resetTsyLedger(){ // (re)inicia el ledger al empezar/retomar partida o al tomar el mando
  S.tsyAccrual={};S.monthKey=monthKeyOf(S.hour);S.tsyAlc=0;S.sFlow={};S.sConsume={};S.mktVol={};S.sNG={};
  S.tsyMonthBal={};S.sFlowPrev=null;S.sConsumePrev=null;
  S.cBook={};S.cPrev=null;S.cStart=S.player>=0?(S.nations[S.player].res.dinero||0):0; // libro de la corona (v2)
}
// LOG ECONÓMICO MENSUAL (diagnóstico de series temporales para dejar el juego corriendo y analizar el log).
// Cada mes cerrado guarda una foto del JUGADOR: riqueza y flujos COMPLETOS por estamento + mercado por bien
// [prod,sold,discard,inv,price,dem]. Un botón lo descarga como JSON (ver main.js downloadEconLog). Barato (1/mes).
const ESTATE_ABBR={campesino:"c",burgues:"b",clero:"cl",nobleza:"n"};
// Foto MENSUAL de la economía del jugador → S.econLog (una línea JSON por mes). La activa el jugador con
// startEconLog() y un enviador la POSTea al recolector local (main.js). Es la herramienta de diagnóstico
// REAL del juego: mucho más fiel que cualquier arnés sintético, porque corre el tick de verdad, con IA,
// guerras y construcción, y a la velocidad que el jugador quiera.
//
// ⚠ CÓMO LEER ESTE LOG SIN ENGAÑARTE: el campesino guarda media despensa antes de vender su grano; mira `desp`
// (llenado de despensas) antes de concluir nada sobre el mercado del grano en los primeros meses.
const ECONLOG_V=4;               // v4: economía v2 (libro de la corona C, cobertura de las 3 necesidades, 17 bienes); v3 y anteriores eran v1
function logEconMonth(monthIdx){ // se llama ANTES de cerrar el mes: S.cBook/S.sFlow aún son los del mes que cierra
  const n=S.player; if(n<0)return; const N=S.nations[n]; if(!N||!N.sWealth)return;
  const yr=Math.floor(monthIdx/12), mo=(monthIdx%12)+1, d=yr+"-"+String(mo).padStart(2,"0");
  // ---- Agregados de PROVINCIA ----
  let pop=0,fam=0,nprov=0,st=0,stc=0,cos=0,mor=0,mob=0,dot=0,ndot=0,slots=0,used=0;
  const P={}; for(const k of STRATA)P[ESTATE_ABBR[k]]=0;
  for(const p of S.provs)if(p.owner===n&&!p.wasteland){
    nprov++; pop+=p.pop||0; if(p.famine)fam++;
    if(p.pops)for(const k of STRATA)P[ESTATE_ABBR[k]]+=p.pops[k]||0;
    st+=(p.store&&p.store.comida)||0; stc+=storeCap(p,"comida");
    cos+=harvestMul(p); mor+=(p.morale||0)*(p.pop||0); mob+=p.mob||0;
    const j=buildJobs(p); if(j>0){dot+=staffing(p);ndot++}
    slots+=buildSlots(p); used+=usedSlots(p);
  }
  // ---- Estamentos: riqueza, flujos del mes, ingreso medio y cobertura de las 3 necesidades ----
  const W={},F={},I={},V={}; for(const k of STRATA){const a=ESTATE_ABBR[k];
    W[a]=Math.round(N.sWealth[k]||0);
    const src=(S.sFlow&&S.sFlow[k])||{},o={}; for(const c in src)o[c]=Math.round(src[c]); F[a]=o;
    I[a]=Math.round((N.e2&&N.e2.inc&&N.e2.inc[k])||0);
    const cv=N.e2&&N.e2.cov&&N.e2.cov[k]; V[a]=cv?[+cv.subs.toFixed(3),+cv.vida.toFixed(3),+cv.lujo.toFixed(3)]:null;
  }
  // ---- Libro de la corona del mes (categoría → ducados) ----
  const C={}; for(const cat in (S.cBook||{})){let v=0;for(const k in S.cBook[cat])v+=S.cBook[cat][k];C[cat]=Math.round(v)}
  // ---- Mercado por bien (u/mes): [0]producido [1]comprado [2]sin comprador [3]en la plaza [4]precio [5]demanda [6]exporta [7]importa
  const M={},info=N.mktInfo||{},mkt=N.mkt||{},pr=N.mktPrice||{};
  for(const g in info){const mi=info[g];
    M[g]=[Math.round(mi.prod||0),Math.round(mi.sold||0),Math.round(mi.unsold||0),Math.round(mkt[g]||0),+((pr[g]||0).toFixed(2)),Math.round(mi.dem||0),Math.round(mi.exp||0),Math.round(mi.imp||0)]}
  let wars=0,embs=0,trp=0;
  for(let m=0;m<NPLAY;m++){if(m===n)continue;const O=S.nations[m];if(!O||!O.alive)continue;
    if(atWarPair(n,m))wars++; if(isEmbargoed(n,m))embs++}
  for(const a of S.armies)if(a.nation===n)for(const k in a.units)trp+=a.units[k];
  S.econLog.push({
    v:ECONLOG_V, d,
    pop:Math.round(pop), prov:nprov,
    P:Object.fromEntries(Object.entries(P).map(([k,v])=>[k,Math.round(v)])), // pops por estamento
    tes:Math.round(N.res.dinero||0),                          // tesoro acumulado
    C,                                                        // libro de la corona del mes (su suma = Δ del tesoro, salvo "Otros")
    fisc:[+taxRateOf(n).toFixed(3),+alcabalaOf(n).toFixed(3),+almojOf(n).toFixed(3)], // pecho, alcabala, almojarifazgo
    cos:+(nprov?cos/nprov:1).toFixed(3),                      // cosecha media del año (1.0 normal)
    desp:+(stc?st/stc:0).toFixed(3),                          // llenado de despensas 0..1
    fam:+(nprov?fam/nprov:0).toFixed(3),                      // fracción de provincias en hambruna
    mor:+(pop?mor/pop:0).toFixed(1),                          // moral media ponderada por población
    mob:Math.round(mob), trp:Math.round(trp),                 // movilizados y tropas
    dot:+(ndot?dot/ndot:0).toFixed(3),                        // dotación media de los edificios
    hue:[used,slots],                                         // huecos de construcción usados/totales
    war:[wars,embs],                                          // guerras y embargos activos
    W, F, I, V, M});                                          // riqueza · flujos · ingreso/mes · cobertura [subs,comod.,lujo] · mercado
  if(S.econLog.length>3600)S.econLog.shift(); // cap ~300 años de juego
}
// Lo llama hourTick con la foto de res ANTES de economyTick. El delta (después−antes) ES la economía
// recurrente exacta del tick (los gastos del jugador —pay— ocurren FUERA del tick, no aquí), así que el
// acumulado y la cifra "/mes" reconcilian con res al céntimo, sin la deriva de nationEconomy.
function tsyTick(before){
  if(S.player<0||!before)return;
  const mk=monthKeyOf(S.hour);
  if(mk!==S.monthKey){
    if(S.econLogOn)logEconMonth(S.monthKey);   // foto del mes que CIERRA (usa sFlow/mktVol/tsyAlc antes de limpiarlos)
    S.sFlowPrev=S.sFlow;S.sConsumePrev=S.sConsume;   // el mes CERRADO se guarda: la UI enseña un mes completo, no uno a medias
    const cd=S.nations[S.player].res.dinero||0;
    S.cPrev={book:S.cBook||{},delta:cd-(S.cStart||0)};S.cBook={};S.cStart=cd; // libro de la corona: su Δ real verifica la suma
    S.tsyMonthBal=S.tsyAccrual;S.tsyAccrual={};S.tsyAlc=0;S.sFlow={};S.sConsume={};S.mktVol={};S.sNG={};S.monthKey=mk // cierra el mes: se "cobra" la alcábala y se reinician los desgloses de estamentos
  }
  const R=S.nations[S.player].res;
  for(const k in R){const d=R[k]-(before[k]||0);if(d)S.tsyAccrual[k]=(S.tsyAccrual[k]||0)+d}
  S.tsyAlc=(S.tsyAlc||0)+(S.nations[S.player].alcabalaRate||0)+(S.nations[S.player].almojRate||0)+(S.nations[S.player].tollRate||0); // impuestos de comercio VARIABLES (alcábala interna + almojarifazgo aduana + portazgo señorial de la corona) acumulados este mes
}
function tsyAvail(n,k){ // saldo comprometido (mostrable/gastable) del recurso k de la nación n
  const v=(S.nations[n].res[k])||0;
  if(n!==S.player||!S.tsyAccrual)return v;      // la IA (y el arranque) usan el saldo real
  return v-Math.max(0,S.tsyAccrual[k]||0);      // retiene el beneficio pendiente del mes en curso
}
function tsyMonthBal(k){return (S.tsyMonthBal&&S.tsyMonthBal[k])||0}
// Telemetría del DESGLOSE de estamentos (solo la nación del jugador): acumula, por estamento y categoría,
// el dinero que ENTRA (+) y SALE (−) de su riqueza este mes. Es pura telemetría (no toca la economía real).
// Se muestra en la ventana de Estamentos. Se resetea al cambiar de mes (ver tsyTick) → total del mes en curso.
function recFlow(n,estate,cat,amt){
  if(n!==S.player||!amt)return;
  const f=S.sFlow||(S.sFlow={}),e=f[estate]||(f[estate]={});
  e[cat]=(e[cat]||0)+amt;
}
// Consumo detallado POR BIEN de cada estamento (solo jugador, mes en curso): cuánto compra (cantidad) y
// cuánto gasta (dinero) en cada bien. Alimenta el desglose "qué compra cada estrato" en la ventana de Estamentos.
function recBuy(n,estate,good,qty,spend){
  if(n!==S.player||!(qty>0))return;
  const f=S.sConsume||(S.sConsume={}),e=f[estate]||(f[estate]={}),c=e[good]||(e[good]=[0,0]);
  c[0]+=qty;c[1]+=spend;
}
// LIBRO DE LA CORONA (solo jugador, mes en curso): S.cBook[categoría][detalle] = ducados que entran (+) o salen (−) del
// tesoro. Lo escribe la v2 en cada cobro/pago de la corona y pay() en cada gasto. Al cerrar el mes pasa a S.cPrev junto
// con el Δ REAL del tesoro: si la suma no cuadra, a la Tesorería le falta un apunte ("Otros").
function recCrown(n,cat,sub,amt){
  if(n!==S.player||!amt)return;
  const b=S.cBook||(S.cBook={}),c=b[cat]||(b[cat]={}),k=sub||"—";
  c[k]=(c[k]||0)+amt;
}
function pay(n,cost,cat,sub){for(const k in cost)S.nations[n].res[k]-=cost[k];
  if(cost.dinero)recCrown(n,cat||"Gastos varios",sub,-cost.dinero)}
function lvlOf(p,b){return p.buildings[b]||0}                          // nivel ESTRUCTURAL (existe, aunque esté deshabilitado)
// ---- Ciclo de vida de edificios: DESHABILITAR / degradar / destruir / reparar ----
// Un edificio deshabilitado no produce, no consume insumos, no exige dotación ni paga mantenimiento (libera
// dotación para otros), pero se DEGRADA poco a poco; al llegar la condición a 0 se destruye (baja un nivel).
// Reactivarlo cuesta reparar la parte degradada (coste de creación prorrateado). Estado en p.bOff / p.bCond.
const BLDG_DEGRADE=1/(4*YR_TICKS);                                    // condición perdida por tick deshabilitado (~4 años de juego de 1→0)
function bOff(p,b){return !!(p.bOff&&p.bOff[b])}                      // ¿edificio DESHABILITADO?
function bCond(p,b){return (p.bCond&&p.bCond[b]!=null)?p.bCond[b]:1}  // condición 0..1 (1 = perfecto)
function effLvl(p,b){return bOff(p,b)?0:(p.buildings[b]||0)}          // nivel OPERATIVO (0 si deshabilitado): lo usan producción/dotación/insumos/mantenimiento
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
  let s=0;for(const b of fxKeys("buildSpeed"))s+=BUILDINGS[b].fx.buildSpeed*effLvl(p,b);
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
  let m=1;for(const b of fxKeys("prodMul"))m+=BUILDINGS[b].fx.prodMul*effLvl(p,b);
  return m;
}
function provDefMul(p){
  let m=1;for(const b of fxKeys("def"))m+=BUILDINGS[b].fx.def*effLvl(p,b);
  return m;
}
/* ---- Moral: factor de productividad ganado con edificios (Fase 3) ----
 * mor = morale/100 multiplica TODA la producción (economy2.js). Al 100% los pops rinden a su
 * valor base; por debajo, es un reductor. La moral NO se recupera sola: la hacen crecer los
 * EDIFICIOS de moral (templo, catedral; en el futuro, tecnologías) en dosis pequeñas y stackeables,
 * y las obras únicas dan crecimiento a TODO el reino (realmMoral). Las provincias conquistadas
 * nacen con la moral baja y hay que "ganárselas" construyendo; la cercanía de enemigos en guerra
 * la erosiona. fx.moral y fx.realmMoral = puntos de moral por MES y nivel (el bloque diario de
 * sim.js aplica 1/30 por día). */
const MORALE_MIN=15;        // suelo de moral (una provincia hostil no cae por debajo)
const MORALE_HOSTILE=2.0;   // moral/mes que drena cada provincia vecina enemiga en guerra
function moraleGrowth(p){   // crecimiento de moral/mes por los edificios de moral de ESTA provincia
  let g=0;for(const b of fxKeys("moral"))g+=BUILDINGS[b].fx.moral*lvlOf(p,b);
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
function degradeBuildings(){ // 1 tick: los edificios DESHABILITADOS pierden condición; al llegar a 0 se destruyen (−1 nivel)
  for(const p of S.provs){
    if(!p.bOff)continue;
    for(const b in p.bOff){
      if(!p.bOff[b]||!(p.buildings[b]>0))continue;
      if(!p.bCond)p.bCond={};
      const c=(p.bCond[b]!=null?p.bCond[b]:1)-BLDG_DEGRADE;
      if(c<=0){
        p.buildings[b]=Math.max(0,(p.buildings[b]||0)-1);                                   // se cae un nivel
        if(p.buildings[b]<=0){delete p.bOff[b];delete p.bCond[b];if(p.bOwner)delete p.bOwner[b]} // destruido del todo
        else p.bCond[b]=1;                                                                    // queda nivel: sigue deshabilitado, condición reiniciada
      } else p.bCond[b]=c;
    }
  }
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

export {
  BKEYS, fxKeys, canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, isOccupied, armyCount, armyPops, armyFood, armyForage, troopDrainOn, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, soldCap, soldAvail, recruitable, moraleGrowth, MORALE_MIN, MORALE_HOSTILE, SOLD_FRAC, foodFill, harvestMul, storeCap, storeOf, SUBS_BASICS, specialistCap, buildJobs, freeLabor, staffing, jobsOf, buildSlots, usedSlots, structPPF, JOBS_PER_LEVEL, ensureMarket, taxRateOf, alcabalaOf, almojOf, ALCABALA, ALMOJ_DEFAULT, DIEZMO, manorOf, canStaffIndustry, bOwnerOf, ESTATES_BUILD, TRADE_BULK, TERRAIN_CAT, terrMul, terrCatMul, RES_RAW_CATS, MONTH_TICKS, monthKeyOf, resetTsyLedger, tsyTick, tsyAvail, tsyMonthBal, recFlow, recCrown, bOff, bCond, effLvl, degradeBuildings, YR_TICKS, TRADE_KM, TRADE_SEA, TRADE_WAR, MANOR_RENT, TOLL_FRAC, FLETE_MAX, FAMINE_DEF, STARVE_RATE, POP_GROWTH_BASE, SOLD_REGEN, PROMO_RATE, targetBurgFrac, recBuy
};
