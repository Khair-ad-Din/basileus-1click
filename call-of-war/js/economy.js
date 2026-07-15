// economy.js
import { NPLAY, BUILDINGS, BUILD_JOBS, TERRAINS, UNITS, RES_KEYS, RES_LABEL, LOOT_FRAC, STRATA, EXTRA_GOODS, RES_CAT, RES_RAW_CATS, START_DATE } from "./config.js";
import { S } from "./state.js";
// El comercio deja de ser un pool GLOBAL: cada par de reinos tiene su geografía y su política.
// kmBetween es la MISMA haversine que ya usan las marchas de ejércitos (sim.js) — no hay geometría nueva.
// Sin ciclo de imports: mapgen.js y diplomacy.js solo importan de config.js y state.js.
import { kmBetween } from "./mapgen.js";
import { isEmbargoed, atWarPair } from "./diplomacy.js";

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
const RESTYPE_RATE=0.50;                                  // producción de la ESPECIALIDAD (resType) por hab/año (× terreno). SUBIDO 0.35→0.50.
// NOTA (medido con arnés, A/B): MÁS producción BAJA el ingreso del campesino por sus materias (0.35→130k/mes vs 0.50→51k/mes):
// el glut hunde el precio más rápido de lo que sube el volumen. Con escasez + precio SIN tope, la industria le paga carísimo.
const BASIC_SET=new Set(["comida","materiales","piedra","metal"]); // los 4 básicos universales (los produce toda provincia)
// ¿el bien g es una MATERIA PRIMA de especialidad? (categoría de campo, y no uno de los 4 básicos universales)
function isRawSpecialty(g){return !!g&&!BASIC_SET.has(g)&&RES_RAW_CATS.indexOf(RES_CAT[g])>=0}
function hash01(a,b){ // hash determinista → [0,1)
  let n=(a*73856093^b*19349663)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;
  return (n>>>0)/4294967296;
}
function harvestYear(year){ // el AÑO AGRÍCOLA que comparte todo el mapa (esto es lo que se nota en el tesoro)
  let m=HARVEST_AC*(hash01(year,0x5f3a)*2-1);
  const t=hash01(year,0x1b7d);
  if(t<HARVEST_TAIL_P)m-=HARVEST_TAIL*(1-t/HARVEST_TAIL_P); // cola izquierda: el desastre general y raro
  return m;
}
function harvestMul(p){ // calidad de la cosecha de esta provincia este año (año común + suerte local)
  const year=Math.floor(S.hour/YR_TICKS);
  const local=HARVEST_AL*(hash01(p.id,year)*2-1);
  return Math.max(HARVEST_FLOOR,1+harvestYear(year)+local);
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
// bienes de comercio: lujos + caballos + los ~26 NUEVOS (recursos históricos, ver EXTRA_GOODS en config).
const MKT_GOODS=["pano","vino","sal","seda","raros","petroleo",...EXTRA_GOODS.map(g=>g.key)];
// E1: el GRANO también se mercadea. Oferta = excedente campesino (overflow de la despensa); demanda =
// las élites que NO cultivan (burgués/clero/nobleza) COMEN comprando grano del mercado. El campesino
// come lo suyo (subsistencia), no compra. MKT_TRADE = todos los bienes que se compran/venden y ponen precio.
// Bloque 1: los 4 BÁSICOS también se mercadean (el campesino vende superávit / compra déficit por terreno).
const MKT_TRADE=[...BASICS,...MKT_GOODS];  // básicos (grano/madera/piedra/hierro) + lujos
const NONGRAIN=["materiales","piedra","metal"]; // básicos no-grano: stock+precio nacional como los lujos (comercian por arbitraje)
const MKT_PRICE={comida:0.8,materiales:1.0,piedra:1.0,metal:2.0,pano:2.2,vino:2.2,sal:1.6,seda:5.0,raros:4.0,petroleo:3.0}; // ducados/unidad (referencia); caballos caros
for(const g of EXTRA_GOODS)MKT_PRICE[g.key]=g.price; // precios de referencia de los bienes nuevos (config)
// MANUFACTURAS: bienes cuya fábrica tiene CADENA (inputs). Su vendedor es el industrial (burgués), que cobra la
// venta al consumidor (no solo el margen); así recupera lo que pagó por la materia prima. Ver economyTick.
const MANUF=new Set();
for(const b in BUILDINGS){const B=BUILDINGS[b];if(B.inputs&&B.fx&&B.fx.prodAdd)for(const g in B.fx.prodAdd)MANUF.add(g)}
const NPC=1e-7;                                                 // escala "por habitante y tick"
// Necesidad por hab/tick y estrato. La COMIDA es un staple: las élites comen ≈1/año (=1/YR_TICKS), como
// todo el mundo, pero comprándola en el mercado. Los lujos, mucho menos (los altos, más y más fino).
const EAT=1/YR_TICKS; // ración de grano por hab y tick (mismo que la subsistencia campesina)
// Consumo por hab/tick y estrato. Bienes de MASAS (los consume toda la población: sal, paño, vino, aceite,
// pescado, lienzo, cuero, hulla) y de ÉLITE (solo los altos: seda, especias, azúcar, pieles, ámbar, armas).
// Los bienes INTERMEDIOS (lana, uva, aceituna, cobre, carbón…) NO se consumen aquí: su demanda la crea la
// CADENA de producción (las fábricas los compran del mercado, ver el consumo de insumos en economyTick).
// Cestas AMPLIADAS (Paso 2): consumo mayor y con más MANUFACTURAS (el campesino ya compra fustán, más paño/cuero…)
// para que la demanda absorba la oferta y los pops gasten su renta. Se calibra con la oferta (sembrado de fábricas).
const LUX_NEED={
  // Campesino: cesta AGRANDADA y con el canal "COMER MEJOR" (ganado=carne). Hallazgo histórico: el excedente del campesino
  // se iba en mejor dieta (carne/lácteos/cerveza) y en manufacturas del artesano (paño/lino/cuero/hierro), NO en ahorro. El
  // peso está en las MANUFACTURAS (drenan hacia el burgués) + carne (elástica: el rico come mucha más). Escala con la riqueza
  // vía sobreconsumo (ver over[k]×OVER_ELAST). Se calibra junto a CAMP_CASH: cesta grande + grifo pequeño → ahorro ≈ 0.
  campesino:{pano:5.0*NPC,vino:3.5*NPC,sal:4.0*NPC,aceite:4.5*NPC,pescado:3.6*NPC,ganado:2.5*NPC,lienzo:4.0*NPC,cuero:3.0*NPC,hulla:3.4*NPC,fustan:3.5*NPC,cera:0.4*NPC},
  burgues:  {comida:EAT,pano:6.0*NPC,vino:6.0*NPC,sal:4.2*NPC,seda:1.6*NPC,raros:1.2*NPC,petroleo:2.0*NPC,aceite:4.5*NPC,pescado:3.2*NPC,lienzo:3.2*NPC,fustan:2.8*NPC,cuero:2.4*NPC,hulla:3.6*NPC,azucar:0.9*NPC,cera:1.0*NPC},
  clero:    {comida:EAT,pano:6.0*NPC,vino:8.0*NPC,sal:4.2*NPC,seda:2.0*NPC,raros:2.0*NPC,petroleo:1.0*NPC,aceite:5.2*NPC,pescado:4.0*NPC,lienzo:3.2*NPC,cuero:2.0*NPC,hulla:3.2*NPC,azucar:1.4*NPC,cera:4.4*NPC}, // el clero quema mucha cera (velas)
  nobleza:  {comida:EAT,pano:8.0*NPC,vino:10.0*NPC,sal:4.5*NPC,seda:4.0*NPC,raros:4.0*NPC,petroleo:6.0*NPC,aceite:6.0*NPC,pescado:3.6*NPC,cuero:3.2*NPC,hulla:4.0*NPC,azucar:2.4*NPC,pieles:3.2*NPC,ambar:1.2*NPC,armas:2.4*NPC,bronce:1.0*NPC,cera:2.0*NPC}, // arma y viste a su séquito
};
// Ingreso base de dinero por hab/tick y estrato. Campesino/burgués ≈ su cesta (viven al día);
// clero (diezmos) y nobleza (rentas de la tierra) MUY por encima de su consumo → son la ÉLITE que
// acumula (para, en el futuro, construir por su cuenta). Los burgueses ADEMÁS cobran un margen de
// las ventas del mercado (BURGUES_MARGIN), no toda la venta.
const STRATA_INCOME={campesino:10*NPC,burgues:26*NPC,clero:60*NPC,nobleza:85*NPC};
// MONETIZACIÓN del campesino (hallazgo histórico c.1450, ver artefacto): el campesino monetizaba solo ~10-20% de su
// producción; el resto era comida autoconsumida + semilla (~25%), NO dinero. Su flujoBase RETENIDO se acreditaba 100%
// como efectivo → ~2400× su cesta → atesoraba sin fin ("grifo sin desagüe"). CAMP_CASH deja como EFECTIVO GASTABLE solo
// esta fracción del reparto campesino; el resto es sustento en especie (ya cubierto por la subsistencia subsCons). NO toca
// corona/clero/nobleza (extraen del BRUTO, su renta era dinero real). Es la palanca MAESTRA del ahorro: menor = menos hucha.
const CAMP_CASH=0.30;
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
// PRECIO LIBRE (sin techo/suelo artificiales): el multiplicador emerge del llenado del inventario respecto a
// su objetivo, en forma MULTIPLICATIVA (siempre positivo, ilimitado hacia arriba cuando escasea). fill=0.5 =
// referencia (×1). PRICE_ELAST = cuánto reacciona el precio al desequilibrio. La antigua banda [0.6,2.2] se retiró.
const PRICE_ELAST=0.9;    // sensibilidad del precio al llenado (mayor = precios más volátiles con la escasez)
const PRICE_MULMIN=0.05, PRICE_MULMAX=30; // clamp de SEGURIDAD (no de diseño): nunca 0/negativo ni infinito
// DISPOSICIÓN A PAGAR por estrato: precio de reserva = ref × RMUL. Cada clase compra su deseo pleno al precio de
// referencia, MENOS a medida que el precio sube hacia su reserva, y NADA por encima (se cae del mercado). Los
// ricos (RMUL alto) aguantan comprando cuando escasea; los pobres se caen antes. Un poco MÁS cuando está barato (DMAX).
const RMUL={campesino:1.5, burgues:2.0, clero:2.5, nobleza:3.2};
const RMUL_FACT=2.2;      // disposición a pagar de las FÁBRICAS por sus insumos (para producir)
const RMUL_BASIC=2.8;     // disposición a pagar por los BÁSICOS de construcción/subsistencia (madera/piedra/hierro)
const RMUL_ORDER=["nobleza","clero","burgues","campesino"]; // se sirve primero al de mayor disposición a pagar (si escasea)
const DMAX=1.4;           // demanda máxima (×deseo base) cuando el bien está muy barato
// SOBRECONSUMO (Paso 2.5): además de cubrir su cesta básica, cada estrato desea MÁS cuanto más rico es (convierte la
// hucha en DEMANDA → competencia por los bienes → precios más altos, y la riqueza se gasta). Rendimientos DECRECIENTES
// para no desbocar: extra = OVER_MAX × ratio/(ratio+OVER_K), con ratio = riqueza / (coste de la cesta básica × horizonte).
const OVER_MAX=4.0;       // deseo EXTRA máximo (×cesta básica) de un estrato muy rico (subido 3→4: techo de gasto más alto → drena mejor la hucha)
const OVER_K=10;          // "meses de colchón" de riqueza antes de sobreconsumir con fuerza (rendim. decrecientes)
const OVER_HORIZON=730;   // ticks (~1 mes) para medir el colchón de riqueza respecto al gasto básico
// LEY DE ENGEL: el sobreconsumo NO afecta igual a todos los bienes. Los STAPLES son inelásticos (no comes 4× pan
// ni te pones 4× la misma ropa básica); los LUJOS son elásticos (el rico compra mucha más seda/especias). Este
// factor multiplica el sobreconsumo por bien (0 = nada, 1 = pleno). Sin entrada = 1 (lujo por defecto).
const OVER_ELAST={comida:0.15,sal:0.3,pescado:0.8,aceite:0.7,pano:0.8,lienzo:0.8,fustan:0.9,cuero:0.9,hulla:0.4,
  materiales:0.3,piedra:0.2,metal:0.3,ganado:1.0}; // COMER MEJOR: el pan (comida) es inelástico (no comes 4× pan), pero el rico
  // pasa a CARNE (ganado=1, como un lujo) y a MÁS/MEJOR ropa (paño/lino/fustán/cuero elásticos) → el sobreconsumo va ahí, no al grano.
  // el resto (seda, especias, vino, pieles, azúcar, ámbar, cera…) = 1
// PROSPERIDAD por sobreconsumo (bonuses PEQUEÑOS y realistas): cada bien, al consumirse por ENCIMA de la
// subsistencia, aporta a su(s) canal(es). El score del canal = satisfacción (consumido/básico) por encima de 1,
// con rendimientos decrecientes → un bonus pequeño. FASE 1: solo la NATALIDAD está enganchada (el resto, futuro).
const BONUS_BIEN={
  pescado:{natalidad:1.2}, sal:{natalidad:0.8}, aceite:{natalidad:0.8}, // (la comida/grano NO: es subsistencia, ya cuenta vía la despensa)
  ganado:{natalidad:0.6,campoProd:0.6}, pano:{natalidad:1.0}, lienzo:{natalidad:0.8}, fustan:{natalidad:0.8},
  petroleo:{campoProd:1.2,militar:1.0}, metal:{campoProd:0.7}, cuero:{campoProd:0.5,militar:0.6}, // petroleo = caballos
  hulla:{indProd:1.0}, carbon:{indProd:0.8},
  vino:{moral:0.8}, seda:{moral:1.2}, pieles:{moral:1.0}, ambar:{moral:0.8}, azucar:{moral:0.8}, raros:{moral:1.0}, cera:{moral:1.0},
  armas:{militar:1.5}, acero:{militar:1.0}, bronce:{militar:1.0},
};
const PROSP_CHANNELS=["natalidad","campoProd","indProd","moral","militar"];
// PROSPERIDAD por PROVINCIA y por BIEN (cada bien su propia barra; el canal solo agrupa el TIPO de bonus, que STACKEA).
// Progresión por PUNTOS mensuales: +1 el mes que hay EXCEDENTE de ese bien (precio ≤ referencia), −1 el mes que no.
// Umbrales de nivel: I = 12 pts (1 año seguido) · II = 36 (3 años) · III = 60 (5 años). El estado vive en p.prosp[bien].
const PROSP_LEVEL_PTS=[12,36,60];   // puntos acumulados para Nv I / II / III
const PROSP_MAX_PTS=60;
function prospLevel(pts){return pts>=60?3:pts>=36?2:pts>=12?1:0}
const NAT_BONUS_PER_LEVEL=0.0001;   // +natalidad ANUAL por cada NIVEL de cada bien (0.01%/año); 7 bienes × 3 niv = 0.21% máx
// canal → bienes que lo alimentan (invierte BONUS_BIEN)
const CHANNEL_GOODS={}; for(const _g in BONUS_BIEN)for(const _ch in BONUS_BIEN[_g])(CHANNEL_GOODS[_ch]||(CHANNEL_GOODS[_ch]=[])).push(_g);
// ---- Comercio ENTRE mercados nacionales (arbitraje; Bloque 3) ----
// No hay "mercado internacional" como entidad: son transacciones entre los mercados de los reinos. El
// burgués compra el bien donde su precio está BAJO (país con excedente) y lo vende donde está ALTO (país
// con déficit): mueve stock del mercado barato al caro → los precios CONVERGEN. El burgués se lleva el
// diferencial (comprar barato/vender caro). Global sin distancia en v1 (futuro: coste por distancia/ruta).
const TRADE_RATE=0.05;        // fracción del stock exportable que se mueve por tick (convergencia gradual)
const TRADE_MIN_SPREAD=0.06;  // diferencial mínimo (sobre el precio ref) para que el arbitraje sea rentable
// ---- COSTE DE TRANSPORTE POR PAR: aquí es donde el pool global se convierte en mercados locales ----
// Calibrado contra dos rutas MARÍTIMAS reales: grano báltico Danzig→Brujas (~1100 km) ≈ 50% del precio de
// desembarco, y sal Portugal→Brujas (~1800 km) ≈ 85%. Las dos dan ~4.6e-4 por km: dentro de los bienes a
// granel manda la DISTANCIA, no el precio → aquí NO hay divisor de precio, a propósito.
// ⚠ NO es el 8:4:1 tierra:río:mar: eso es por TONELADA-MILLA. En rutas comparables reales el mar solo le
// ganaba a la tierra ~1,5× (Brujas→Barcelona 1398: mar 15% vs tierra 22%). Tampoco se modela el tipo de
// barco, aunque pesaba tanto como el mar (misma saca de lana: 25% en galera veneciana, 5,16% en coca
// genovesa): es demasiado ruido para lo que aporta.
const TRADE_KM=6.8e-4;        // fracción del valor por km, ruta TERRESTRE y bien a granel
const TRADE_SEA=0.68;         // ambas capitales costeras → 6.8e-4*0.68 ≈ 4.6e-4, que es el ancla histórica
// Lo que de verdad decide QUÉ viaja es la DENSIDAD DE VALOR: solo lo caro por unidad de peso soportaba el
// flete. Por eso la piedra no cruzaba Europa y la seda sí. Peso por ducado, por categoría de bien.
const TRADE_BULK={cereal:1.0, mar:1.0, cultivo:1.0, ganado:0.8, bosque:1.6, extractivo:2.2,
  manufactura:0.3, comercio:0.15, moneda:0.05};
// El riesgo era POLÍTICO, no meteorológico: ≥50% del coste del seguro marítimo venía de corso e
// incautaciones por guerra (el recargo de invierno nunca pasó del 13%).
const TRADE_WAR=3.0;          // la guerra ENCARECE el par; no lo corta (había contrabando y neutrales)
function tradeCost(g,a,b){    // fracción del valor de referencia; Infinity = par cortado
  if(isEmbargoed(a,b))return Infinity;                    // el embargo del jugador CORTA el par (ya no es un placebo)
  const pa=S.provs[S.nations[a].capital], pb=S.provs[S.nations[b].capital];
  if(!pa||!pb)return Infinity;
  let c=TRADE_KM*kmBetween(pa,pb)*(TRADE_BULK[RES_CAT[g]]||1);
  if(pa.coastal&&pb.coastal)c*=TRADE_SEA;
  if(atWarPair(a,b))c*=TRADE_WAR;
  return c;
}
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
// flujo cuelga de los mismos multiplicadores que la subsistencia (terreno·granja·moral·COSECHA), una
// hambruna (menos campesinos), una provincia desmoralizada o un mal año agrícola golpean el ingreso
// de TODOS a la vez. (La cosecha se enganchó el 2026-07-15: hasta entonces este comentario era falso
// — el reparto era sordo al año agrícola, que solo tocaba la despensa.)
// Sustituye a la vez los ingresos planos por rol (salvo burgués) y el impuesto plano taxOf.
// BASE_INCOME calibrado para PARIDAD del ingreso de la corona con el antiguo taxOf: el viejo
// impuesto de Castilla (~Σ taxOf) equivale a ~corona·ΣflujoBase; con corona≈0.08+realengo eso da
// BASE_INCOME≈2.4e-4 (ver arnés de validación). Todo tunable.
const BASE_INCOME=2.4e-4;  // ducados por campesino y tick, antes del reparto (grifo único)
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
function flujoBase(p){ // flujo campesino por tick (los MISMOS multiplicadores que la subsistencia, cosecha incluida)
  if(!p||p.owner>=NPLAY||p.wasteland||!p.pops)return 0;
  return p.pops.campesino*BASE_INCOME*structPPF(p)*(p.morale/100)*harvestMul(p);
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
function buildJobs(p){let j=0;for(const b in BUILDINGS)j+=effLvl(p,b)*jobsOf(b);return j} // deshabilitados NO exigen empleos → liberan dotación
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
  // producción MENSUAL (para el display): la base del edificio es por tick; se escala ×MONTH_TICKS para
  // que la tarjeta, el total y el desglose EU4 estén en /mes y cuadren con la Tesorería (capa mensual).
  if(fx.prodAdd)for(const k in fx.prodAdd){
    const aff=resAff(p,b,k), base=fx.prodAdd[k]*MONTH_TICKS, amt=base*terr*mor*st*(aff?1+AFFINITY:1)*mul;
    out.push({res:k,amt,steps:S1(base,aff,true)});
  }
  if(fx.goldAdd){
    const aff=(p.resType==="dinero"), base=fx.goldAdd*MONTH_TICKS, amt=base*mor*st*(aff?1+AFFINITY:1);
    out.push({res:"dinero",amt,steps:S1(base,aff,false)});
  }
  return out;
}
function nn(v){return (Math.round(v*100)/100).toString().replace(/\.?0+$/,"")||"0"} // 2 decimales, sin ceros de cola
function canAfford(n,cost){
  for(const k in cost)if(tsyAvail(n,k)<cost[k])return false;
  return true;
}
/* ============ Capa de presentación MENSUAL de la tesorería del jugador ============
 * El motor (economyTick) sigue moviendo res[k] cada tick, intacto. Para que el jugador
 * vea y gaste su tesoro "mes a mes" mantenemos, SOLO para su nación:
 *   S.tsyAccrual[k]  → suma del balance recurrente (nationEconomy) del mes EN CURSO
 *   S.tsyMonthBal[k] → total recurrente del ÚLTIMO mes cerrado = la cifra "/mes" (estable)
 *   S.monthKey       → mes de calendario en curso (para detectar el cambio de mes)
 * El saldo COMPROMETIDO (lo que se muestra y se puede gastar) = res − max(0, acumulado):
 * como res crece a la par que el acumulado, el comprometido se queda en el PRINCIPAL de
 * inicio de mes; el beneficio del mes "llega" de golpe en el rollover (día de paga), y las
 * pérdidas/gastos se notan al momento. La IA usa el saldo real (res), sin tocar nada. */
function monthKeyOf(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCFullYear()*12+d.getUTCMonth()}
function resetTsyLedger(){ // (re)inicia el ledger al empezar/retomar partida o al tomar el mando
  S.tsyAccrual={};S.monthKey=monthKeyOf(S.hour);S.tsyAlc=0;S.sFlow={};S.sConsume={};S.mktVol={};
  S.tsyMonthBal={};
  if(S.player>=0){const ec=nationEconomy(S.player).res;for(const k in ec)S.tsyMonthBal[k]=ec[k]*MONTH_TICKS} // semilla: proyección mensual del ritmo actual
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
// ⚠ CÓMO LEER ESTE LOG SIN ENGAÑARTE — la trampa que ya nos costó una conclusión falsa:
// el grano llena PRIMERO la despensa local de cada provincia y SOLO el excedente sale al mercado. Los
// primeros meses no se comercia en ningún sitio: eso es CALENTAMIENTO, no un diagnóstico. Mira `desp`
// (llenado de despensas) ANTES de concluir nada sobre el mercado: con desp<1 el mercado aún no existe.
// Por lo mismo, `M.comida[6]/[7]` (export/import) solo significa algo con las despensas llenas.
const ECONLOG_V=2;               // versión del esquema (v2: +exp/imp por bien, +despensa, +cosecha, +fiscalidad, +pops)
function logEconMonth(monthIdx){
  const n=S.player; if(n<0)return; const N=S.nations[n]; if(!N||!N.sWealth)return;
  const yr=Math.floor(monthIdx/12), mo=(monthIdx%12)+1, d=yr+"-"+String(mo).padStart(2,"0");
  // ---- Agregados de PROVINCIA ----
  let pop=0,fam=0,nprov=0,st=0,stc=0,cos=0,mor=0,mob=0,dot=0,ndot=0,slots=0,used=0,pr0=0,npr=0;
  const P={}; for(const k of STRATA)P[ESTATE_ABBR[k]]=0;
  for(const p of S.provs)if(p.owner===n&&!p.wasteland){
    nprov++; pop+=p.pop||0; if(p.famine)fam++;
    if(p.pops)for(const k of STRATA)P[ESTATE_ABBR[k]]+=p.pops[k]||0;   // se redondea al final
    st+=storeOf(p,"comida"); stc+=storeCap(p,"comida");           // ⚠ storeCap toma (p,k): sin la k usaría otro tope
    cos+=harvestMul(p); mor+=(p.morale||0)*(p.pop||0); mob+=p.mob||0;
    const j=buildJobs(p); if(j>0){dot+=staffing(p);ndot++}
    slots+=buildSlots(p); used+=usedSlots(p);
    if(p.prosp)for(const g in p.prosp){pr0+=p.prosp[g];npr++}
  }
  // ---- Estamentos: riqueza y flujos por categoría ----
  const W={},F={}; for(const k of STRATA){
    W[ESTATE_ABBR[k]]=Math.round(N.sWealth[k]||0);
    const src=(S.sFlow&&S.sFlow[k])||{},o={}; for(const c in src)o[c]=Math.round(src[c]); F[ESTATE_ABBR[k]]=o;
  }
  // ---- Mercado por bien ----
  const M={},vol=S.mktVol||{},info=N.mktInfo||{},mkt=N.mkt||{},pr=N.mktPrice||{},tel=N.mktTel||{};
  for(const g of MKT_TRADE){const v=vol[g]||{},mi=info[g]||{},t=tel[g]||{};
    const prod=Math.round(v.prod||0),sold=Math.round(v.sold||0),disc=Math.round(v.discard||0),inv=Math.round(mkt[g]||0);
    // exp/imp salen de mktTel (SUAVIZADO): mktInfo se RECONSTRUYE cada tick y perdería el arbitraje.
    const exp=Math.round(t.exp||0), imp=Math.round(t.imp||0);
    if(prod||sold||disc||inv||mi.dem||exp||imp)
      M[g]=[prod,sold,disc,inv,+((pr[g]||0).toFixed(2)),Math.round(mi.dem||0),exp,imp,+((MKT_PRICE[g]||1).toFixed(2))];
      //   [0]prod [1]vendido [2]tirado [3]inventario [4]precio [5]demanda [6]EXPORTA [7]IMPORTA [8]precio de REFERENCIA
  }
  // ---- Diplomacia: ahora MUERDE en el comercio (guerra ×3, embargo corta) ----
  let wars=0,embs=0;
  for(let m=0;m<NPLAY;m++){if(m===n)continue;const O=S.nations[m];if(!O||!O.alive)continue;
    if(atWarPair(n,m))wars++; if(isEmbargoed(n,m))embs++}
  const eco=nationEconomy(n);
  S.econLog.push({
    v:ECONLOG_V, d,
    pop:Math.round(pop), prov:nprov,
    P:Object.fromEntries(Object.entries(P).map(([k,v])=>[k,Math.round(v)])), // pops por estamento (movilidad social: Fase C)
    // ⚠ `duc` NO incluye la alcábala ni el almojarifazgo (nationEconomy los excluye a propósito: son
    // variables por naturaleza). El ingreso real del mes es duc + alc + almoj. No los sumes dos veces.
    duc:+(eco.res.dinero).toFixed(1),                         // ingreso NETO/mes tras mantenimiento fijo → MUY apalancado por la cosecha
    tes:Math.round(N.res.dinero||0),                          // tesoro ACUMULADO (el stock, no el flujo)
    alc:+((N.alcabalaRate||0)*730).toFixed(1),                // ALCÁBALA/mes (comercio INTERNO)
    almoj:+((N.almojRate||0)*730).toFixed(1),                 // ALMOJARIFAZGO/mes (aduana del comercio EXTERIOR) → con geografía, esto ya se mueve
    tsyv:Math.round(S.tsyAlc||0),                             // acumulado del mes de AMBOS (es lo que ve la tesorería; S.tsyAlc suma los dos)
    fisc:[+taxRateOf(n).toFixed(3),+alcabalaOf(n).toFixed(3),+almojOf(n).toFixed(3)], // las 3 palancas del jugador: sin esto el log no se puede interpretar
    cos:+(nprov?cos/nprov:1).toFixed(3),                      // cosecha MEDIA del año (1.0 normal): desde ec22e0a es COMÚN a todo el mapa
    desp:+(stc?st/stc:0).toFixed(3),                          // llenado de despensas 0..1 → CALENTAMIENTO vs diagnóstico
    fam:+(nprov?fam/nprov:0).toFixed(3),                      // fracción de provincias en hambruna
    mor:+(pop?mor/pop:0).toFixed(1),                          // moral media ponderada por población (multiplica flujoBase)
    mob:Math.round(mob), trp:eco.troops||0,                   // movilizados (retiran mano de obra) y tropas
    dot:+(ndot?dot/ndot:0).toFixed(3),                        // dotación media (staffing): diagnostica escasez de mano de obra
    hue:[used,slots],                                         // huecos de construcción usados/totales
    prsp:+(npr?pr0/npr:0).toFixed(2),                         // puntos de prosperidad medios por bien y provincia (0..60)
    war:[wars,embs],                                          // guerras y embargos activos: ambos cambian el coste del comercio
    W, F, M});
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
    S.tsyMonthBal=S.tsyAccrual;S.tsyAccrual={};S.tsyAlc=0;S.sFlow={};S.sConsume={};S.mktVol={};S.monthKey=mk // cierra el mes: se "cobra" la alcábala y se reinician los desgloses de estamentos
  }
  const R=S.nations[S.player].res;
  for(const k in R){const d=R[k]-(before[k]||0);if(d)S.tsyAccrual[k]=(S.tsyAccrual[k]||0)+d}
  S.tsyAlc=(S.tsyAlc||0)+(S.nations[S.player].alcabalaRate||0)+(S.nations[S.player].almojRate||0); // impuestos de comercio VARIABLES (alcábala interna + almojarifazgo aduana) acumulados este mes
}
function tsyAvail(n,k){ // saldo comprometido (mostrable/gastable) del recurso k de la nación n
  const v=(S.nations[n].res[k])||0;
  if(n!==S.player||!S.tsyAccrual)return v;      // la IA (y el arranque) usan el saldo real
  return v-Math.max(0,S.tsyAccrual[k]||0);      // retiene el beneficio pendiente del mes en curso
}
function tsyMonthBal(k){return (S.tsyMonthBal&&S.tsyMonthBal[k])||0}
// PROSPERIDAD (todas las naciones): una vez al MES, cada provincia gana +1 punto por cada bien en EXCEDENTE (precio ≤
// referencia) y pierde −1 por cada bien en falta. Cada bien tiene su barra (0..60 pts). Lo llama hourTick cada tick;
// se autodispara solo al cambiar de mes de calendario. El estado (p.prosp[bien]) vive por provincia (conquista = arranca a 0).
function prosperityTick(){
  const mk=monthKeyOf(S.hour);
  if(mk===S.prospMonthKey)return;
  S.prospMonthKey=mk;
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland)continue;
    const N=S.nations[p.owner]; if(!N||!N.mktInfo)continue;
    if(!p.prosp)p.prosp={};
    for(const g in BONUS_BIEN){
      const mi=N.mktInfo[g], price=(mi&&mi.price!=null)?mi.price:(MKT_PRICE[g]||1), ref=MKT_PRICE[g]||1;
      p.prosp[g]=Math.max(0,Math.min(PROSP_MAX_PTS,(p.prosp[g]||0)+(price<=ref*1.08?1:-1)));
    }
  }
}
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
// VOLUMEN FÍSICO por bien (solo jugador, mes en curso): cuánto se PRODUCE y pone en el mercado, cuánto se VENDE, y
// cuánto se TIRA (producido por encima del tope de inventario = sobreproducción pura). Diagnostica si el campesino
// sobreproduce (mucho prod y descarte, poca venta) vs. abastece justo. Alimenta el panel de Mercado (volumen).
function recVol(n,g,field,amt){
  if(n!==S.player||!(amt>0))return;
  const f=S.mktVol||(S.mktVol={}),e=f[g]||(f[g]={prod:0,sold:0,discard:0});
  e[field]+=amt;
}
function pay(n,cost){for(const k in cost)S.nations[n].res[k]-=cost[k]}
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
  let s=0;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.buildSpeed)s+=fx.buildSpeed*effLvl(p,b)}
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
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.prodMul)m+=fx.prodMul*effLvl(p,b)}
  return m;
}
function provDefMul(p){
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.def)m+=fx.def*effLvl(p,b)}
  return m;
}
function provUpkeep(p){
  const u={};
  for(const b in BUILDINGS){
    const lvl=effLvl(p,b),up=BUILDINGS[b].up;if(!lvl||!up)continue;   // deshabilitado (effLvl 0) no paga mantenimiento
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
    const lvl=effLvl(p,b);if(!lvl)continue;                          // deshabilitado (effLvl 0) no produce ni paga mantenimiento
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
// Beneficio NETO mensual del edificio b (a precios de mercado ACTUALES): producción − insumos − mantenimiento.
// + = gana, − = pierde. Lo usan la UI (avisar de edificios ruinosos) y (futuro) la IA (deshabilitar los que pierden).
// Usa el nivel ESTRUCTURAL (lo que rendiría OPERATIVO), para poder decidir si merece la pena tenerlo encendido.
function buildingProfit(p,b,lvlArg){
  const lvl=lvlArg!=null?lvlArg:(p.buildings[b]||0); if(!lvl)return 0; // lvlArg = puntuar a un nivel dado (p.ej. el próximo, para decidir si construir)
  const B=BUILDINGS[b]; if(!B.fx)return 0;
  const N=(p.owner<NPLAY)?S.nations[p.owner]:null;
  const price=k=>k==="dinero"?1:((N&&N.mktPrice&&N.mktPrice[k]!=null)?N.mktPrice[k]:(MKT_PRICE[k]||1));
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p),mul=1+(provProdMul(p)-1)*st;
  let v=0;
  if(B.fx.prodAdd)for(const k in B.fx.prodAdd)v+=B.fx.prodAdd[k]*lvl*terr*mor*st*mul*price(k)*MONTH_TICKS;
  if(B.fx.goldAdd)v+=B.fx.goldAdd*lvl*mor*st*MONTH_TICKS;
  if(B.inputs)for(const k in B.inputs)v-=B.inputs[k]*lvl*terr*mor*st*mul*price(k)*MONTH_TICKS;
  if(B.up)for(const k in B.up)v-=B.up[k]/12*lvl*price(k);
  return v;
}
// Producción (unidades/MES) del bien PRINCIPAL de la fábrica b a un nivel dado. La IA la usa para calcular CUÁNTAS
// fábricas hacen falta para cubrir la demanda (demanda / producción-por-fábrica), en vez de construir a ciegas.
function buildingOutput(p,b,lvlArg){
  const lvl=lvlArg!=null?lvlArg:(p.buildings[b]||0);
  const B=BUILDINGS[b]; if(!lvl||!B.fx||!B.fx.prodAdd)return {g:null,q:0};
  const g=Object.keys(B.fx.prodAdd)[0];
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p),mul=1+(provProdMul(p)-1)*st;
  return {g, q:B.fx.prodAdd[g]*lvl*terr*mor*st*mul*MONTH_TICKS};
}
// Conjunto de bienes OBTENIBLES ahora mismo por cualquier reino: básicos universales + los que produce alguna
// provincia por su especialidad (terreno) + los que hay en algún mercado (importables por arbitraje global). GATE de
// construcción (Opción 1): no levantar una fábrica cuyo INSUMO no exista en el alcance. Como la producción es por
// terreno y el comercio global, casi siempre existe → no crea el deadlock "sin demanda↔sin import".
function sourceableSet(){
  const s=new Set(BASICS);
  for(const p of S.provs)if(!p.wasteland&&p.resType)s.add(p.resType);
  for(let i=0;i<NPLAY;i++){const N=S.nations[i];if(N&&N.alive&&N.mkt)for(const g in N.mkt)if(N.mkt[g]>1)s.add(g)}
  return s;
}
function inputsSourceable(b,src){const B=BUILDINGS[b];if(!B.inputs)return true;for(const k in B.inputs)if(!src.has(k))return false;return true}
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
  // los importes son por tick; se escalan a /mes para el display (cuadran con la Tesorería mensual). La
  // soldadesca (mano) es un stock, no se escala.
  for(const it of income)it.amt*=MONTH_TICKS;
  for(const it of upkeep)it.amt*=MONTH_TICKS;
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
  // NOTA: la alcábala (variable) ya NO se suma aquí — es la parte impredecible del ingreso; el display la
  // muestra aparte como ACUMULADO del mes (S.tsyAlc). Esta tasa es el ingreso FIJO/predecible del reino.
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
  // la ALCÁBALA (variable) NO va en el libro de tasas fijas: se muestra aparte como acumulado del mes (S.tsyAlc)
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
  const factDem=Array.from({length:NPLAY},()=>({})); // demanda de INSUMOS de las fábricas (cadenas de producción)
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
    // CADENAS: demanda de insumos de las fábricas de esta provincia (la compran del mercado del reino, ver abajo)
    {const morF=p.morale/100, terrF=TERRAINS[p.terrain].prod, stF=staffing(p), mulF=1+(provProdMul(p)-1)*stF;
     for(const b in p.buildings){const lvl=effLvl(p,b);if(!lvl)continue;const B=BUILDINGS[b];if(!B.inputs)continue; // deshabilitado no compra insumos
       for(const k in B.inputs)factDem[n][k]=(factDem[n][k]||0)+B.inputs[k]*lvl*terrF*morF*stF*mulF;}}
    const N=S.nations[n];ensureMarket(N);const R=N.res;
    const byOwner=provEconomyByOwner(p),cr=byOwner.corona||{};
    R.dinero+=flujoBase(p)*repartoRates(p,taxRateOf(p.owner)).corona*dt; // parte de la corona del reparto feudal
    for(const k in cr)R[k]+=cr[k]*dt;                                    // edificios de la CORONA → tesoro
    // Fase B: la producción de comercio de la corona se espeja al mercado nacional (conserva su copia)
    for(const g of MKT_GOODS)if(cr[g]>0){N.mkt[g]=(N.mkt[g]||0)+cr[g]*dt;recVol(n,g,"prod",cr[g]*dt)} // producción de la CORONA al mercado (+ telemetría "producido")
    // E2: edificios de ESTAMENTOS → su bolsillo. El dinero producido/gastado va a sWealth. Los BIENES:
    // lo que PRODUCEN va a su reserva (sRes) y los lujos también alimentan el mercado; lo que CONSUMEN de
    // mantenimiento (neto negativo) lo COMPRAN (coste en dinero a precio de referencia), así no hay reserva negativa.
    for(const e of ESTATES_BUILD){const eo=byOwner[e];if(!eo)continue;
      for(const k in eo){const v=eo[k]*dt;
        if(k==="dinero"){N.sWealth[e]+=v;recFlow(n,e,v>=0?"Producción de edificios":"Mantenimiento de edificios",v);continue}
        if(v>=0){N.sRes[e][k]=(N.sRes[e][k]||0)+v; if(MKT_GOODS.indexOf(k)>=0){N.mkt[k]=(N.mkt[k]||0)+v;recVol(n,k,"prod",v)}} // producción del ESTAMENTO (manufacturas) al mercado (+ telemetría "producido")
        else{const c=v*(MKT_PRICE[k]||1);N.sWealth[e]+=c;recFlow(n,e,"Mantenimiento de edificios",c)}}} // consumo de mantenimiento en bienes → comprado (coste en dinero)
    // reparto feudal del flujo campesino a los estamentos (la parte de la corona ya va arriba)
    const fb=flujoBase(p)*dt;
    if(fb>0){const rr=repartoRates(p,taxRateOf(n));const campCash=fb*rr.campesino*CAMP_CASH; // solo una fracción se MONETIZA (resto = sustento en especie)
      N.sWealth.clero+=fb*rr.clero; N.sWealth.nobleza+=fb*rr.nobleza; N.sWealth.campesino+=campCash;
      recFlow(n,"clero","Reparto feudal",fb*rr.clero);recFlow(n,"nobleza","Reparto feudal",fb*rr.nobleza);recFlow(n,"campesino","Reparto feudal",campCash)}
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
    recFlow(n,"burgues","Sueldo (comercio)",STRATA_INCOME.burgues*str.burgues*dt);
    if(!N.mktInfo)N.mktInfo={};
    // SOBRECONSUMO por estrato: extra deseado sobre la cesta básica según su riqueza (rendim. decrecientes). Rico→más.
    const over={};
    for(const k of STRATA){
      let baseSpend=0;for(const g of MKT_TRADE)baseSpend+=(LUX_NEED[k][g]||0)*str[k]*(MKT_PRICE[g]||1);
      const ratio=baseSpend>0?(W[k]||0)/(baseSpend*OVER_HORIZON):0;
      over[k]=OVER_MAX*ratio/(ratio+OVER_K);
    }
    let revTotal=0;
    for(const g of MKT_TRADE){                                        // lujos + COMIDA (las élites compran grano para comer)
      let stock=N.mkt[g]||0,rev=0,demand=0,sold=0;
      const oe=OVER_ELAST[g]!=null?OVER_ELAST[g]:1;                    // elasticidad de sobreconsumo del bien (Engel)
      for(const k of STRATA)demand+=(LUX_NEED[k][g]||0)*str[k]*(1+over[k]*oe)*dt; // básico + sobreconsumo elástico
      if(basicDem[n][g])demand+=basicDem[n][g]*dt;                    // básicos: demanda de subsistencia/construcción del campesinado (da precio dinámico)
      if(factDem[n][g])demand+=factDem[n][g]*dt;                      // CADENAS: demanda de insumos de las fábricas (da precio a la materia prima)
      // PRECIO LIBRE de mercado: emerge del llenado del inventario respecto a su objetivo (demanda×días), en forma
      // multiplicativa (positivo siempre, ilimitado hacia arriba si escasea). fill 0.5 = referencia (×1). Sin banda.
      const ref=MKT_PRICE[g];
      const cap=(demand/dt)*24*capDays(g);
      const fill=cap>0?stock/cap:0.5;
      let mul=Math.pow(0.5/Math.max(fill,0.02),PRICE_ELAST);
      // TECHO por DISPOSICIÓN A PAGAR = la CURVA DE DEMANDA (no una banda ficticia): el precio no puede superar lo que
      // paga el comprador de MAYOR reserva que quiere este bien (ref×RMUL). Por encima NADIE compra → el mercado se
      // congela (precio disparado, ventas 0, sin corregir porque el precio lo mueve el llenado, no las ventas; le pasaba
      // al grano y al tinte, de oferta fina). Con este techo el precio sube con la escasez HASTA donde se paga y ahí se vacía.
      let maxRmul=0;
      for(const k of STRATA)if((LUX_NEED[k][g]||0)>0)maxRmul=Math.max(maxRmul,RMUL[k]);
      if((factDem[n][g]||0)>0)maxRmul=Math.max(maxRmul,RMUL_FACT);
      if((basicDem[n][g]||0)>0)maxRmul=Math.max(maxRmul,RMUL_BASIC);
      if(maxRmul>0)mul=Math.min(mul,0.92*maxRmul);
      const targetMul=Math.max(PRICE_MULMIN,Math.min(PRICE_MULMAX,mul));
      let price=N.mktPrice[g]!=null?N.mktPrice[g]:ref;
      price+=(ref*targetMul-price)*Math.min(1,PRICE_ADJ*dt);         // desliza hacia el objetivo (EMA)
      if(price<ref*PRICE_MULMIN)price=ref*PRICE_MULMIN;              // suelo de seguridad (nunca 0/negativo)
      N.mktPrice[g]=price;
      // COMPRA con DISPOSICIÓN A PAGAR: cada estrato compra su deseo pleno al precio de referencia, MENOS según el
      // precio sube hacia SU reserva (ref×RMUL) y NADA por encima; un poco MÁS si está barato (DMAX). Se sirve primero
      // al de mayor disposición (por si escasea): así el noble consigue su seda y el campesino se cae del paño caro.
      for(const k of RMUL_ORDER){
        const need=(LUX_NEED[k][g]||0)*str[k]*(1+over[k]*oe)*dt;     // deseo = cesta básica × (1 + sobreconsumo elástico por riqueza)
        if(need<=0)continue;
        const res=ref*(RMUL[k]||1.5);
        const frac=Math.max(0,Math.min(DMAX,(res-price)/(res-ref))); // 1 a precio ref · 0 a la reserva · >1 si barato
        const buy=Math.min(need*frac,stock,(W[k]||0)/price);         // limitado por deseo elástico, stock y bolsillo
        if(buy>0){W[k]-=buy*price;stock-=buy;rev+=buy*price;sold+=buy;recFlow(n,k,"Necesidades (lujos)",-buy*price);recBuy(n,k,g,buy,buy*price)}
      }
      // CADENAS: las FÁBRICAS compran su materia prima del mercado. El industrial (burgués) paga; el productor de
      // la materia (campesino) cobra su parte. Así la lana/uva/cobre… tienen demanda real → comercian y ponen precio.
      const fneed=(factDem[n][g]||0)*dt;
      if(fneed>0){const fbuy=Math.min(fneed,stock,(W.burgues||0)/price);
        if(fbuy>0){const t=fbuy*price;stock-=fbuy;W.burgues-=t*(1-BURGUES_MARGIN);W.campesino+=t*(1-BURGUES_MARGIN);sold+=fbuy;
          recFlow(n,"burgues","Compra de materias primas",-t*(1-BURGUES_MARGIN));recFlow(n,"campesino","Venta de materias primas",t*(1-BURGUES_MARGIN))}}
      W.burgues+=rev*BURGUES_MARGIN;                                 // los burgueses (comerciantes) se quedan un margen de la venta al consumidor
      recFlow(n,"burgues","Comisión de mercado",rev*BURGUES_MARGIN);
      // El VENDEDOR cobra el resto: la COMIDA y las materias primas del campo → campesino; las MANUFACTURAS → el
      // industrial (burgués) que las fabricó (así recupera lo que pagó por la materia prima). Cierra la cadena.
      if(g==="comida"||g==="ganado"){W.campesino+=rev*(1-BURGUES_MARGIN);recFlow(n,"campesino",g==="ganado"?"Venta de ganado":"Venta de comida",rev*(1-BURGUES_MARGIN))}
      else if(MANUF.has(g)){W.burgues+=rev*(1-BURGUES_MARGIN);recFlow(n,"burgues","Venta de manufacturas",rev*(1-BURGUES_MARGIN))}
      revTotal+=rev;
      recVol(n,g,"sold",sold);
      if(cap>0&&stock>cap)recVol(n,g,"discard",stock-cap);           // sobreproducción TIRADA (producido por encima del tope de inventario)
      N.mkt[g]=cap>0?Math.min(stock,cap):stock;                      // sobreoferta topada; los bienes escasos quedan bajos
      // info para el panel (flujo/mes, escasez y precio): el mercado trabaja y el precio se mueve con la oferta
      N.mktInfo[g]={dem:demand/dt*730,sold:sold/dt*730,short:sold<demand*0.98,price};
    }
    N.res.dinero+=revTotal*alcabalaOf(n);                            // ALCABALA: la corona cobra del comercio INTERNO (compensa el ×3 urbano perdido)
    N.alcabalaRate=revTotal/dt*alcabalaOf(n);                        // por tick (dinero real que entró). Es VARIABLE por naturaleza (mercado):
    // el display NO la proyecta como tasa; la ACUMULA tick a tick (ver tsyTick → S.tsyAlc) y la "cobra" a fin de mes.
    for(const k of STRATA)if(W[k]<0)W[k]=0; // sin TOPE artificial (se quitó): la riqueza la nivela la economía, no un clamp. Solo suelo en 0.
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
      if(p.store.comida>cap){const over=p.store.comida-cap;p.store.comida=cap;if(N){N.mkt.comida=(N.mkt.comida||0)+over;recVol(n,"comida","prod",over)}} // excedente → mercado
      if(p.store.comida<0){
        let deficit=-p.store.comida;p.store.comida=0;
        if(N){ // comprar grano del mercado nacional (lo que otras provincias vendieron); el burgués cobra su margen
          const price=N.mktPrice.comida||MKT_PRICE.comida, buy=Math.min(deficit,N.mkt.comida||0);
          if(buy>0){N.mkt.comida-=buy;deficit-=buy;const turn=buy*price;N.sWealth.burgues+=turn*BURGUES_MARGIN;N.sWealth.campesino-=turn*BURGUES_MARGIN;recFlow(n,"burgues","Margen de básicos",turn*BURGUES_MARGIN);recFlow(n,"campesino","Compra de básicos",-turn*BURGUES_MARGIN)}
        }
        const cons=subsCons(p,"comida")*dt;
        if(cons>0&&deficit/cons>FAMINE_DEF){p.pop=Math.max(0,(p.pop||0)-deficit*STARVE_RATE);famine=true} // no pudo importar grano → hambruna
      }
    }
    // --- MADERA/PIEDRA/HIERRO: excedente → stock del mercado nacional; déficit → comprar del stock ---
    if(N)for(const k of NONGRAIN){
      const net=subsBalance(p,k)*dt;
      if(net>=0){N.mkt[k]=(N.mkt[k]||0)+net;recVol(n,k,"prod",net)}              // excedente campesino → mercado del reino
      else{                                                                      // déficit: comprar del stock (lo no cubierto es inerte; los básicos no matan de hambre)
        const price=N.mktPrice[k]||MKT_PRICE[k]||1, buy=Math.min(-net,N.mkt[k]||0);
        if(buy>0){N.mkt[k]-=buy;const turn=buy*price;N.sWealth.burgues+=turn*BURGUES_MARGIN;N.sWealth.campesino-=turn*BURGUES_MARGIN;bSold[n][k]=(bSold[n][k]||0)+buy;recFlow(n,"burgues","Margen de básicos",turn*BURGUES_MARGIN);recFlow(n,"campesino","Compra de básicos",-turn*BURGUES_MARGIN)}
      }
    }
    // --- ESPECIALIDAD (resType): la provincia produce SU materia prima (lana/uva/cobre/pescado…) por terreno →
    // mercado del reino. Es la oferta ANCHA de los bienes nuevos (resType-driven): el campo la produce aunque no
    // haya fábrica; las fábricas y otras provincias la compran (cadenas). El campesino cobra al venderla (al comprarla). ---
    if(N&&isRawSpecialty(p.resType)){
      const g=p.resType, prod=(p.pop||0)*RESTYPE_RATE/YR_TICKS*terrMul(p,g)*(p.morale/100)*dt;
      if(prod>0){N.mkt[g]=(N.mkt[g]||0)+prod;recVol(n,g,"prod",prod)}
    }
    p.famine=famine;
    // crecimiento: base×(despensa) + BONUS de natalidad por prosperidad (la barra por-bien la lleva prosperityTick, mensual).
    // El bonus STACKEA: cada NIVEL logrado de cada bien de salud suma NAT_BONUS_PER_LEVEL (anual). Pequeño y de largo plazo.
    if(!famine){const cap=storeCap(p,"comida");const fill=cap>0?p.store.comida/cap:0;
      let natB=0; if(p.prosp)for(const g of (CHANNEL_GOODS.natalidad||[]))natB+=prospLevel(p.prosp[g]||0)*NAT_BONUS_PER_LEVEL;
      p.pop=(p.pop||0)*(1+(POP_GROWTH_BASE*(0.4+fill)+natB/YR_TICKS)*dt)}
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
  // distancia/ruta). La corona grava la aduana (ALMOJARIFAZGO, ver almojOf) → res.dinero + tsyAlc (variable, como la alcábala).
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(N&&N.alive)N.almojRate=0} // reset aduana/tick (se acumula en el arbitraje de abajo)
  for(const g of MKT_TRADE){
    const ref=MKT_PRICE[g]||1, node=[];
    for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;ensureMarket(N);if(!N.mktInfo[g])N.mktInfo[g]={price:N.mktPrice[g]||ref};
      node.push({N,p:N.mktPrice[g]!=null?N.mktPrice[g]:ref,s:N.mkt[g]||0});}
    if(node.length<2)continue;
    node.sort((a,b)=>a.p-b.p);                                                  // ascendente por precio: baratos primero
    let lo=0,hi=node.length-1;
    while(lo<hi){
      const A=node[lo],B=node[hi];                                             // A barato (vende su excedente), B caro (compra)
      // El COSTE del par (geografía + política) es lo que convierte este pool en mercados locales
      // conectados: el flete entra en el TEST DE RENTABILIDAD, no solo en el margen. Ponerlo solo en el
      // margen sería inútil — recortaría al mercader mientras el stock sigue viajando y los precios
      // convergiendo global. Y por eso el corte ya no puede ser `break`: con coste POR PAR, que el par de
      // mayor diferencial no sea rentable ya no implica que ningún otro lo sea (los extremos suelen estar
      // lejos; dos vecinos con menos spread sí comercian). Embargo → Infinity; guerra → ×TRADE_WAR.
      const cost=tradeCost(g,A.N.idx,B.N.idx)*ref;                             // ducados/unidad (Infinity = par cortado)
      if(!(B.p-A.p>=TRADE_MIN_SPREAD*ref+cost)){lo++;hi--;continue}            // este par no; puede que otro sí
      const q=(A.s||0)*TRADE_RATE*dt;                                          // A exporta una fracción de su stock (convergencia gradual)
      if(q>1e-9){
        A.N.mkt[g]=Math.max(0,(A.N.mkt[g]||0)-q); B.N.mkt[g]=(B.N.mkt[g]||0)+q; // el stock viaja del mercado barato al caro
        const half=q*(B.p-A.p-cost)*0.5;                                       // el mercader paga el flete y se queda medio diferencial NETO
        const taxA=half*almojOf(A.N.idx), taxB=half*almojOf(B.N.idx);         // ALMOJARIFAZGO: la corona de cada reino grava la aduana del comercio EXTERIOR
        A.N.res.dinero+=taxA; A.N.almojRate=(A.N.almojRate||0)+taxA/dt; A.N.sWealth.burgues+=half-taxA;
        B.N.res.dinero+=taxB; B.N.almojRate=(B.N.almojRate||0)+taxB/dt; B.N.sWealth.burgues+=half-taxB;
        recFlow(A.N.idx,"burgues","Arbitraje",half-taxA);recFlow(B.N.idx,"burgues","Arbitraje",half-taxB);
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
  MKT_GOODS, MKT_TRADE, MKT_PRICE, ensureMarket, seedStrataWealth, flujoBase, repartoRates, taxRateOf, alcabalaOf, almojOf, ALCABALA, ALMOJ_DEFAULT, DIEZMO, manorOf, canStaffIndustry, bOwnerOf, provEconomyByOwner, ESTATES_BUILD, tradeCost, TRADE_BULK,
  BASICS, TERRAIN_CAT, terrMul, terrCatMul, RES_RAW_CATS,
  MONTH_TICKS, resetTsyLedger, tsyTick, tsyAvail, tsyMonthBal, recFlow, BONUS_BIEN, PROSP_CHANNELS,
  bOff, bCond, effLvl, buildingProfit, buildingOutput, degradeBuildings, sourceableSet, inputsSourceable,
  prosperityTick, prospLevel, PROSP_LEVEL_PTS, PROSP_MAX_PTS, CHANNEL_GOODS, NAT_BONUS_PER_LEVEL
};
