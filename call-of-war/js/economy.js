// economy.js
import { NPLAY, BUILDINGS, TERRAINS, UNITS, RES_KEYS } from "./config.js";
import { S } from "./state.js";

/* ===================== POPs Fase 1: constantes ======================
 * La población es ahora el motor: paga impuestos, aporta la soldadesca (el cupo
 * movilizable) y crece. Ver [[basileus-pop-economy-vision]]. */
const SOLD_FRAC=0.02;      // techo de soldadesca = 2% de la población (movilización máxima realista)
const TAX_PC=0.000012;     // ducados/mes por habitante (campo); la ciudad rinde más
const TAX_URBAN=2.4;       // multiplicador de impuestos en provincia urbana
// Producción del BIEN BASE de la provincia: escala con la POBLACIÓN (los "pops de serie" trabajan
// su tierra), no con el nº de provincias. Así la riqueza va con la gente, no con tener mucho
// territorio despoblado. La provincia tiene AFINIDAD por su bien (+15%, bonus pequeño y stackeable).
const BASE_PC=0.00005;     // producción base del bien de la provincia por habitante (calibrado a nivel jugable)
const BASE_URBAN=1.6;      // la ciudad rinde más por habitante (comercio/artesanía)
const AFFINITY=0.15;       // +15% al bien base (pops de serie y fábricas de ESE bien)
// Soldadesca: el cupo de gente movilizable de una provincia. Su techo escala con la
// población y con los edificios militares (fx.mano, reinterpretado como % de cupo extra).
function soldCap(p){
  if(!p||p.wasteland||p.owner>=NPLAY)return 0;
  let bonus=1;
  for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.mano)bonus+=fx.mano*lvlOf(p,b)}
  return (p.pop||0)*SOLD_FRAC*bonus;
}
function soldAvail(p){return p.sold!=null?p.sold:soldCap(p)} // stock actual (o el techo si aún no se sembró)

/* ---- Comida / subsistencia (Fase 2) ----
 * Cada provincia produce comida trabajando su tierra y la consume su población. El excedente
 * se guarda en la DESPENSA (almacén, p.food); su llenado impulsa el crecimiento. La cosecha
 * varía cada año (±HARVEST_AMP): en un mal año, si la despensa está vacía, hay HAMBRUNA. */
const YR_TICKS=8760;             // ticks (horas de juego) por año
const FOOD_STORE_YEARS=0.7;      // capacidad de despensa ≈ 8 meses de consumo
const HARVEST_AMP=0.33;          // variación anual de cosecha (±33%)
// rendimiento alimentario del terreno: ~1 = autosuficiente por defecto; >1 da excedente (crece).
// Suelo en 1.0: el terreno pobre no crece pero tampoco se muere de hambre; la hambruna llega
// por una mala racha de cosechas (harvestMul) cuando la despensa está baja.
const FOOD_FERT={vega:1.4,pradera:1.25,llanura:1.1,colinas:1.05,bosque:1.02,pantano:1.0,
  estepa:1.02,desierto:1.0,montana:1.0,tundra:1.0};
function harvestMul(p){ // calidad de la cosecha de este año (determinista por provincia+año)
  const year=Math.floor(S.hour/YR_TICKS);
  let n=(p.id*73856093^year*19349663)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;
  return 1+HARVEST_AMP*((n>>>0)/4294967296*2-1);
}
function foodCons(p){return (p.pop||0)/YR_TICKS}                         // consumo por tick
function foodProd(p){                                                    // producción de subsistencia por tick
  const fert=FOOD_FERT[p.terrain]||1;
  return (p.pop||0)/YR_TICKS*fert*(1+0.4*lvlOf(p,"granja"))*harvestMul(p);
}
function foodBalance(p){return foodProd(p)-foodCons(p)}                  // >0 excedente, <0 déficit (por tick)
function foodCap(p){return (p.pop||0)*FOOD_STORE_YEARS*(1+0.8*lvlOf(p,"almacen"))} // el Almacén amplía la despensa

/* ---- Necesidades de confort y mercado (Fase 4) ----
 * Además de comida, la población necesita madera, paño, vino y sal. El reino las consume de
 * su stock; si falta, compra en el mercado con ducados y, si tampoco puede, hay desabastecimiento
 * (baja la moral). En hambruna, el reino puede comprar grano para paliar la mortandad. */
const NEED_PC={materiales:0.0000010,pano:0.00000018,vino:0.00000018,sal:0.00000028}; // por habitante y tick
const NEED_PRICE={materiales:0.5,pano:2.2,vino:2.2,sal:1.6};  // ducados por unidad al comprar en el mercado
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
function buildJobs(p){let j=0;for(const b in BUILDINGS)j+=lvlOf(p,b)*JOBS_PER_LEVEL;return j}
function freeLabor(p){return Math.max(0,specialistCap(p)-(p.mob||0))}    // libres tras descontar movilizados
function staffing(p){const j=buildJobs(p);return j>0?Math.min(1,freeLabor(p)/j):1} // dotación 0..1

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
function buildMax(p,b){return BUILDINGS[b].unique?1:BUILDINGS[b].max}
function buildBlock(p,b){
  const B=BUILDINGS[b];
  if(lvlOf(p,b)>=buildMax(p,b))return B.unique?"Ya construida":"Nivel máximo";
  if(p.buildQueue.length)return"Obra en curso";
  if(B.coastal&&!p.coastal)return"Requiere costa";
  if(B.urban&&!p.urban)return"Requiere ciudad";
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
function provEconomy(p){
  const out={res:{},mano:0};
  if(!p||p.owner>=NPLAY||p.wasteland)return out;
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod,st=staffing(p);
  const add=(k,v)=>{out.res[k]=(out.res[k]||0)+v};
  // producción base del bien de la provincia: pop-driven (pops de serie), con afinidad; SIN dotación
  const base=(p.pop||0)*BASE_PC*(p.urban?BASE_URBAN:1)*terr*mor;
  add(p.resType,base*(1+AFFINITY)*(1+(provProdMul(p)-1)*st));             // afinidad + multiplicador de edificios (este sí con dotación)
  add("dinero",taxOf(p));                                                 // impuestos de la población (no dependen de la dotación)
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b);if(!lvl)continue;
    const fx=BUILDINGS[b].fx;
    // las fábricas del bien base de la provincia reciben también la afinidad
    if(fx.prodAdd)for(const k in fx.prodAdd)add(k,fx.prodAdd[k]*lvl*terr*mor*st*(k===p.resType?1+AFFINITY:1));
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
  const baseNoMul=(p.pop||0)*BASE_PC*(p.urban?BASE_URBAN:1)*terr*mor*(1+AFFINITY); // pop-driven + afinidad
  income.push({label:p.urban?"Comercio de la ciudad":"Producción",res:p.resType,amt:baseNoMul});
  for(const b in BUILDINGS){ // multiplicadores de producción (gremio, fundición, universidad), con dotación
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);
    if(fx.prodMul&&lvl)income.push({label:BUILDINGS[b].label+" +"+Math.round(fx.prodMul*100)+"%",res:p.resType,amt:baseNoMul*fx.prodMul*lvl*st});
  }
  income.push({label:"Impuestos de la población",res:"dinero",amt:taxOf(p)});
  for(const b in BUILDINGS){
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(!lvl)continue;
    if(fx.prodAdd)for(const k in fx.prodAdd)income.push({label:BUILDINGS[b].label,res:k,amt:fx.prodAdd[k]*lvl*terr*mor*st*(k===p.resType?1+AFFINITY:1)});
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
  const res={},prov=S.provs.filter(p=>p.owner===n);
  let pop=0;
  for(const p of prov){if(!p.wasteland)pop+=p.pop||0;const e=provEconomy(p);for(const k in e.res)res[k]=(res[k]||0)+e.res[k]}
  let troops=0;for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  res.dinero=(res.dinero||0)-0.6*troops;
  res.comida=(res.comida||0)-0.5*troops;
  for(const k in NEED_PC)res[k]=(res[k]||0)-pop*NEED_PC[k]; // necesidades de confort de la población
  return{res,provs:prov.length,troops,pop,army:{dinero:0.6*troops,comida:0.5*troops}};
}
function armyCount(a){let t=0;for(const k in a.units)t+=a.units[k];return t}
function armyAtk(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].atk;return t}
function armyDef(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].def;return t}
function armyHp(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].hp;return t}
function armySpd(a){let s=999;for(const k in a.units)if(a.units[k]>0.05)s=Math.min(s,UNITS[k].spd);return s===999?18:s}
function nationStrength(n){let t=0;for(const a of S.armies)if(a.nation===n)t+=armyAtk(a)+armyDef(a);return t}
function nationProvCount(n){let t=0;for(const p of S.provs)if(p.owner===n)t++;return t}
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
  // agregados por nación en pasadas O(provincias), no O(naciones×provincias): moral de obras
  // únicas, tropas, y población (esta última se llena en la pasada A)
  const realmMor=new Float64Array(NPLAY),troops=new Float64Array(NPLAY),nationPop=new Float64Array(NPLAY);
  for(const p of S.provs){const n=p.owner;if(n>=NPLAY)continue;const bl=p.buildings;
    for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.realmMoral){const l=bl[b]||0;if(l)realmMor[n]+=fx.realmMoral*l}}}
  for(const a of S.armies)if(a.nation<NPLAY)troops[a.nation]+=armyCount(a);
  // Pasada A: producción de cada provincia → tesoro de su nación, y recuperación de moral.
  // (Mismo orden que antes: toda la economía ANTES de necesidades y ANTES de la comida.)
  for(const p of S.provs){
    const n=p.owner;
    if(n>=NPLAY||p.wasteland)continue;
    nationPop[n]+=p.pop||0;
    const R=S.nations[n].res,e=provEconomy(p);
    for(const k in e.res)R[k]+=e.res[k]*dt;
    let mreg=0.004;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.moral)mreg+=fx.moral*(p.buildings[b]||0)}
    const cap=Math.min(100,90+realmMor[n]);
    if(p.morale<cap)p.morale=Math.min(cap,p.morale+mreg*dt);
  }
  // Por nación: mantenimiento del ejército y necesidades de confort (consumo/mercado/desabastecimiento).
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const R=S.nations[n].res;
    R.dinero-=0.6*troops[n]*dt;R.comida-=0.5*troops[n]*dt;
    let unmet=0;
    for(const k in NEED_PC){
      const demand=nationPop[n]*NEED_PC[k]*dt;
      let need=demand-R[k];
      if(need<=0){R[k]-=demand;continue}
      R[k]=0;
      const canBuy=Math.min(need,R.dinero/NEED_PRICE[k]);
      R.dinero-=canBuy*NEED_PRICE[k];
      unmet+=(need-canBuy)/Math.max(1,demand);
    }
    if(unmet>0){const drop=Math.min(0.03,unmet*0.03)*dt;for(const p of S.provs)if(p.owner===n&&!p.wasteland&&p.morale>25)p.morale=Math.max(25,p.morale-drop)}
    for(const k of RES_KEYS)if(R[k]<0)R[k]=0;
  }
  // Pasada B: comida, despensa, hambruna (con alivio del mercado ya con el dinero tras necesidades),
  // crecimiento ligado al excedente y regeneración de la soldadesca.
  const regen=Math.min(1,SOLD_REGEN*dt);
  for(const p of S.provs){
    if(p.wasteland)continue;
    const cap=foodCap(p);
    if(p.food==null)p.food=cap*0.6;
    p.food+=foodBalance(p)*dt;
    if(p.food>cap)p.food=cap;
    let famine=false;
    if(p.food<0){
      let deficit=-p.food;p.food=0;
      if(p.owner<NPLAY){const R=S.nations[p.owner].res;const relief=Math.min(deficit,(R.dinero||0)/FOOD_PRICE);if(relief>0){R.dinero-=relief*FOOD_PRICE;deficit-=relief}}
      const cons=foodCons(p)*dt;
      if(cons>0&&deficit/cons>FAMINE_DEF){p.pop=Math.max(0,(p.pop||0)-deficit*STARVE_RATE);famine=true}
    }
    p.famine=famine;
    if(!famine){const fill=cap>0?p.food/cap:0;p.pop=(p.pop||0)*(1+POP_GROWTH_BASE*(0.4+fill)*dt)}
    if(p.owner<NPLAY){const sc=soldCap(p),s=p.sold!=null?p.sold:sc;p.sold=s+(sc-s)*regen}
  }
}

export {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, armyCount, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, soldCap, soldAvail, taxOf, SOLD_FRAC, foodProd, foodCons, foodBalance, foodCap, specialistCap, buildJobs, freeLabor, staffing, structPPF, JOBS_PER_LEVEL, NEED_PC, NEED_PRICE, FOOD_PRICE, economyTick
};
