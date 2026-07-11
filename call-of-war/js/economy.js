// economy.js
import { NPLAY, BUILDINGS, BUILD_JOBS, TERRAINS, UNITS, RES_KEYS, RES_LABEL, LOOT_FRAC } from "./config.js";
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
  return (p.pop||0)*SOLD_FRAC*bonus;
}
function soldAvail(p){return p.sold!=null?p.sold:soldCap(p)} // stock actual (o el techo si aún no se sembró)

/* ---- Subsistencia local por provincia (bienes BÁSICOS) ----
 * Los campesinos (pops de serie) NO trabajan en fábricas: trabajan la tierra y producen/consumen
 * localmente una cesta de bienes BÁSICOS (comida, madera, piedra, hierro) ≈ autosuficiente. Cada
 * bien se guarda en una RESERVA local por provincia (p.store), cuyo tope amplía el Almacén. Un
 * modificador de COSECHA (harvestMul, ±HARVEST_AMP/año, determinista por provincia+año) afecta a
 * los bienes ORGÁNICOS (hoy la comida; extensible al vino cuando el lujo pase a local). En un mal
 * año se consume más de lo que se produce → se drena la reserva; si la de COMIDA se agota y sigue
 * negativa → HAMBRUNA (muertes) [+ migración, futura]. Los demás básicos, de momento, solo se
 * vacían sin efecto (hay planes para ellos). Es la MISMA unidad que el recurso nacional, para que
 * el reino pueda socorrer/requisar en el futuro. Capa SEPARADA del Tesoro (los edificios rinden a
 * la nación; los campesinos se alimentan a sí mismos). Los LUJOS (paño/vino/sal) siguen nacionales. */
const YR_TICKS=8760;             // ticks (horas de juego) por año
const HARVEST_AMP=0.33;          // variación anual de cosecha (±33%)
const SUBS_BASICS=["comida","materiales","piedra","metal"];   // cesta de subsistencia campesina (madera=materiales, hierro=metal)
const SUBS_ORGANIC={comida:1};   // bienes afectados por el desastre de cosecha (extensible: vino cuando sea local)
// producción y consumo por HABITANTE y tick de cada básico, calibrados ≈ iguales (autosuficiencia):
// la comida a escala histórica (1/hab/año); los demás, cantidades pequeñas. Tunables.
const SUBS_CONS={comida:1/YR_TICKS, materiales:0.0000010, piedra:0.0000004, metal:0.0000004};
const SUBS_PROD={comida:1/YR_TICKS, materiales:0.0000010, piedra:0.0000004, metal:0.0000004};
const SUBS_STORE_YEARS={comida:0.7, materiales:0.5, piedra:0.5, metal:0.5}; // capacidad de reserva (× Almacén)
// rendimiento alimentario del terreno: ~1 = autosuficiente; >1 da excedente (crece). Suelo 1.0:
// el terreno pobre no crece pero tampoco muere de hambre; la hambruna llega por una mala racha de
// cosechas (harvestMul) cuando la reserva de comida está baja.
const FOOD_FERT={vega:1.4,pradera:1.25,llanura:1.1,colinas:1.05,bosque:1.02,pantano:1.0,
  estepa:1.02,desierto:1.0,montana:1.0,tundra:1.0};
function harvestMul(p){ // calidad de la cosecha de este año (determinista por provincia+año)
  const year=Math.floor(S.hour/YR_TICKS);
  let n=(p.id*73856093^year*19349663)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;
  return 1+HARVEST_AMP*((n>>>0)/4294967296*2-1);
}
function subsCons(p,k){return (p.pop||0)*(SUBS_CONS[k]||0)}              // consumo del bien k por tick
function subsProd(p,k){                                                  // producción del bien k por tick
  let v=(p.pop||0)*(SUBS_PROD[k]||0);
  if(k==="comida")v*=(FOOD_FERT[p.terrain]||1)*(1+0.4*lvlOf(p,"granja")); // fertilidad + granja mejoran la comida
  if(SUBS_ORGANIC[k])v*=harvestMul(p);                                  // desastre de cosecha en los orgánicos
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
function structPPF(p){return (FOOD_FERT[p.terrain]||1)*(1+0.4*lvlOf(p,"granja"))} // comida/campesino (sin cosecha)
function specialistCap(p){  // cuántos pops puede sostener la provincia fuera del campo
  const f=Math.max(0.02,Math.min(SPEC_MAX,SPEC_BASE+SPEC_K*(structPPF(p)-1)));
  return (p.pop||0)*f;
}
function jobsOf(b){return BUILD_JOBS[b]!=null?BUILD_JOBS[b]:JOBS_PER_LEVEL} // empleos por nivel de ese edificio
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
  return g;
}
function provEconomy(p){
  const out={res:{},mano:0};
  if(!p||p.owner>=NPLAY||p.wasteland)return out;
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p);
  const add=(k,v)=>{out.res[k]=(out.res[k]||0)+v};
  add("dinero",taxOf(p));                                    // impuestos de la población (motor de ducados; no dependen de la dotación)
  const mul=1+(provProdMul(p)-1)*st;                         // multiplicador de producción (gremio/fundición/universidad), escalado por dotación
  for(const b in BUILDINGS){                                 // TODA la producción de bienes viene de los edificios (con afinidad si coincide el bien)
    const lvl=lvlOf(p,b);if(!lvl)continue;
    const fx=BUILDINGS[b].fx;
    if(fx.prodAdd)for(const k in fx.prodAdd)add(k,fx.prodAdd[k]*lvl*terr*mor*st*(resAff(p,b,k)?1+AFFINITY:1)*mul);
    if(fx.goldAdd)add("dinero",fx.goldAdd*lvl*mor*st*(p.resType==="dinero"?1+AFFINITY:1));
  }
  const up=provUpkeep(p);
  for(const k in up)add(k,-up[k]); // mantenimiento de los edificios
  return out;
}
function provBreakdown(p){
  const income=[],upkeep=[];let mano=0;
  const net={};
  if(!p||p.owner>=NPLAY||p.wasteland)return{income,upkeep,net,mano};
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p);
  const mul=1+(provProdMul(p)-1)*st; // multiplicador de producción (gremio/fundición/universidad)
  income.push({label:"Impuestos de la población",res:"dinero",amt:taxOf(p)});
  for(const b in BUILDINGS){ // TODA la producción de bienes viene de edificios (afinidad si coincide el bien)
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(!lvl)continue;
    if(fx.prodAdd)for(const k in fx.prodAdd)income.push({label:BUILDINGS[b].label,res:k,amt:fx.prodAdd[k]*lvl*terr*mor*st*(resAff(p,b,k)?1+AFFINITY:1)*mul});
    if(fx.goldAdd)income.push({label:BUILDINGS[b].label,res:"dinero",amt:fx.goldAdd*lvl*mor*st*(p.resType==="dinero"?1+AFFINITY:1)});
  }
  mano=soldAvail(p); // "mano" del desglose ahora = soldadesca disponible (stock, no ingreso)
  const up=provUpkeep(p);
  for(const b in BUILDINGS){
    const bu=BUILDINGS[b].up,lvl=lvlOf(p,b);if(!lvl||!bu)continue;
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
    push("dinero","Impuestos",p.name,taxOf(p));                       // impuestos de la población
    for(const b in BUILDINGS){
      const lvl=lvlOf(p,b);if(!lvl)continue;
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
    const R=S.nations[n].res,e=provEconomy(p);
    for(const k in e.res)R[k]+=e.res[k]*dt;
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
  // Pasada B: subsistencia LOCAL por bien básico (reserva por provincia p.store), hambruna de comida,
  // crecimiento ligado al llenado de la despensa y regeneración de la soldadesca.
  const regen=Math.min(1,SOLD_REGEN*dt);
  for(const p of S.provs){
    if(p.wasteland)continue;
    if(!p.store)p.store={};
    let famine=false;
    for(const k of SUBS_BASICS){
      const cap=storeCap(p,k);
      if(p.store[k]==null)p.store[k]=cap*0.6;
      p.store[k]+=subsBalance(p,k)*dt;
      if(p.store[k]>cap)p.store[k]=cap;
      if(p.store[k]<0){
        let deficit=-p.store[k];p.store[k]=0;
        if(k==="comida"){
          // el reino socorre comprando grano (relieve automático; el socorro/requisa dirigido por el jugador es futuro)
          if(p.owner<NPLAY){const R=S.nations[p.owner].res;const relief=Math.min(deficit,(R.dinero||0)/FOOD_PRICE);if(relief>0){R.dinero-=relief*FOOD_PRICE;deficit-=relief}}
          const cons=subsCons(p,"comida")*dt;
          if(cons>0&&deficit/cons>FAMINE_DEF){p.pop=Math.max(0,(p.pop||0)-deficit*STARVE_RATE);famine=true}
        }
        // madera/piedra/hierro: la reserva se vacía sin efecto por ahora (hay planes para ellos)
      }
    }
    p.famine=famine;
    if(!famine){const cap=storeCap(p,"comida");const fill=cap>0?p.store.comida/cap:0;p.pop=(p.pop||0)*(1+POP_GROWTH_BASE*(0.4+fill)*dt)}
    if(p.owner<NPLAY){const sc=soldCap(p),s=p.sold!=null?p.sold:sc;p.sold=s+(sc-s)*regen}
  }
}

export {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, nationLedger, isOccupied, occupierOf, provLoot, armyCount, armyPops, armyFood, armyForage, troopDrainOn, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, soldCap, soldAvail, recruitable, taxOf, moraleGrowth, MORALE_MIN, MORALE_HOSTILE, SOLD_FRAC, foodCons, foodBalance, foodCap, foodFill, harvestMul, subsProd, subsCons, subsBalance, storeCap, storeOf, SUBS_BASICS, specialistCap, buildJobs, freeLabor, staffing, employedIn, jobsOf, buildingYield, buildSlots, usedSlots, structPPF, JOBS_PER_LEVEL, NEED_PC, NEED_PRICE, FOOD_PRICE, economyTick
};
