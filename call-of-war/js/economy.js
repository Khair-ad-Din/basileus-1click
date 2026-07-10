// economy.js
import { NPLAY, BUILDINGS, TERRAINS, UNITS } from "./config.js";
import { S } from "./state.js";

/* ===================== POPs Fase 1: constantes ======================
 * La población es ahora el motor: paga impuestos, aporta la soldadesca (el cupo
 * movilizable) y crece. Ver [[basileus-pop-economy-vision]]. */
const SOLD_FRAC=0.02;      // techo de soldadesca = 2% de la población (movilización máxima realista)
const TAX_PC=0.000012;     // ducados/mes por habitante (campo); la ciudad rinde más
const TAX_URBAN=2.4;       // multiplicador de impuestos en provincia urbana
// Soldadesca: el cupo de gente movilizable de una provincia. Su techo escala con la
// población y con los edificios militares (fx.mano, reinterpretado como % de cupo extra).
function soldCap(p){
  if(!p||p.wasteland||p.owner>=NPLAY)return 0;
  let bonus=1;
  for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.mano)bonus+=fx.mano*lvlOf(p,b)}
  return (p.pop||0)*SOLD_FRAC*bonus;
}
function soldAvail(p){return p.sold!=null?p.sold:soldCap(p)} // stock actual (o el techo si aún no se sembró)

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
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod;
  const add=(k,v)=>{out.res[k]=(out.res[k]||0)+v};
  add(p.resType,(p.resType==="dinero"?2.8:1.3)*provProdMul(p)*terr*mor); // recurso propio
  add("dinero",taxOf(p));                                                 // impuestos de la población
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b);if(!lvl)continue;
    const fx=BUILDINGS[b].fx;
    if(fx.prodAdd)for(const k in fx.prodAdd)add(k,fx.prodAdd[k]*lvl*terr*mor);
    if(fx.goldAdd)add("dinero",fx.goldAdd*lvl*mor);
  }
  const up=provUpkeep(p);
  for(const k in up)add(k,-up[k]); // mantenimiento de los edificios
  return out;
}
function provBreakdown(p){
  const income=[],upkeep=[];let mano=0;
  const net={};
  if(!p||p.owner>=NPLAY||p.wasteland)return{income,upkeep,net,mano};
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod;
  const baseNoMul=(p.resType==="dinero"?2.8:1.3)*terr*mor;
  income.push({label:p.urban?"Comercio de la ciudad":"Producción",res:p.resType,amt:baseNoMul});
  for(const b in BUILDINGS){ // multiplicadores de producción (gremio, fundición, universidad)
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);
    if(fx.prodMul&&lvl)income.push({label:BUILDINGS[b].label+" +"+Math.round(fx.prodMul*100)+"%",res:p.resType,amt:baseNoMul*fx.prodMul*lvl});
  }
  income.push({label:"Impuestos de la población",res:"dinero",amt:taxOf(p)});
  for(const b in BUILDINGS){
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(!lvl)continue;
    if(fx.prodAdd)for(const k in fx.prodAdd)income.push({label:BUILDINGS[b].label,res:k,amt:fx.prodAdd[k]*lvl*terr*mor});
    if(fx.goldAdd)income.push({label:BUILDINGS[b].label,res:"dinero",amt:fx.goldAdd*lvl*mor});
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
  for(const p of prov){const e=provEconomy(p);for(const k in e.res)res[k]=(res[k]||0)+e.res[k]}
  let troops=0;for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  res.dinero=(res.dinero||0)-0.6*troops;
  res.comida=(res.comida||0)-0.5*troops;
  return{res,provs:prov.length,troops,army:{dinero:0.6*troops,comida:0.5*troops}};
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

export {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, armyCount, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, soldCap, soldAvail, taxOf, SOLD_FRAC
};
