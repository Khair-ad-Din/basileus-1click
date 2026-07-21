// tools/verify-fase2.mjs — arnés de verificación de la FASE 2 del mercado por centros (el flujo del dinero).
// Reconstruye el mundo oficial (como sim-economy.mjs), corre economyTick, y comprueba lo que el consejo pidió:
//  (1) INVARIANTE ledger==economy: Σ nationLedger(n)[k] == nationEconomy(n).res[k]  (∀ nación, ∀ recurso), en
//      frío y tras simular — el acceso/flete/portazgo NO deben descuadrar el tesoro fijo.
//  (2) sin NaN en res/sWealth/inputCover.
//  (3) COBERTURA de insumos (decisión 1): ¿modula la producción? distribución + insumos más escasos.
//  (4) ACCESO al mercado (decisión 2, marketKm): ¿silencia la periferia sin castigar la Europa normal?
//  (5) FLETE al centro (decisión 4, hubKm): ¿el interior profundo topa el flete (se desintegra del mercado)?
//  (6) PORTAZGO (decisión 5): ¿se reparte por manor y llega a la corona?
//   node tools/verify-fase2.mjs [nivelEdificios=3] [años=6]
// NOTA: siembra edificios UNIFORMES (telar en todas las prov) → la cobertura sale ~0; es un ARTEFACTO del arnés,
// no un bug (la distribución de fábricas real es dispersa). El nivel de cobertura se calibra con fábricas reales
// y startEconLog en la partida. Ver design/mercado-centros-eu5.md y [[basileus-mercado-fase2-flujo]].
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","call-of-war");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");
  t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");
loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const st=await import("file:///"+base.replace(/\\/g,"/")+"/js/state.js");
const cfg=await import("file:///"+base.replace(/\\/g,"/")+"/js/config.js");
const mg=await import("file:///"+base.replace(/\\/g,"/")+"/js/mapgen.js");
const ec=await import("file:///"+base.replace(/\\/g,"/")+"/js/economy.js");
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings,BUILDINGS}=cfg;

const snap=OFFICIAL_MAP;
S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.assignTerrain();mg.assignResources();mg.seedCities();mg.assignPopulation();
for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}
S.mktDirty=true;mg.ensureMarketTopology(); // Fase 2: poblar marketOf/marketKm/hubOf/hubKm (el acceso/flete los leen)
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0}));
const BUILD=+(process.argv[2]||3); // nivel de edificios económicos UNIFORME (para que HAYA fábricas con cadenas)
const ECO=["granja","aserradero","cantera","mina","mercado","gremio","templo","almacen","telar","sastre","curtiduria","fundicion",
  "herreria","vidrieria","cerveceria","alfar","molinoPapel","carbonera","dehesa","majada"]; // + cadenas y materias de los bienes nuevos
for(let n=0;n<NPLAY;n++){let cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}
  S.nations[n].capital=cap.id;cap.morale=85;cap.buildings.cuartel=1;
  const units={infanteria:2,miliciano:2};let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  S.armies.push({id:n+1,nation:n,prov:cap.id,units,src:{[cap.id]:w},path:[],legDone:0,legTotal:0});}
if(BUILD>0)for(const p of S.provs)if(!p.wasteland&&p.owner<NPLAY)for(const b of ECO)if(BUILDINGS[b])p.buildings[b]=Math.min(BUILDINGS[b].unique?1:(BUILDINGS[b].max||BUILD),BUILD);
for(const p of S.provs)if(!p.wasteland){if(p.owner<NPLAY)p.sold=ec.soldCap(p);p.store={};for(const k of ec.SUBS_BASICS)p.store[k]=ec.storeCap(p,k)*0.6}

const YEARS=+(process.argv[3]||6);
console.log(`verify-fase2: BUILD=${BUILD} niveles (uniforme), ${YEARS} años, ${S.nations.filter(n=>n.alive).length} naciones vivas.`);

function checkInvariant(tag){
  let worst=0,worstN=-1,worstK="";
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;
    const ne=ec.nationEconomy(n).res, items=ec.nationLedger(n);
    const led={};for(const it of items)led[it.res]=(led[it.res]||0)+it.amt;
    const keys=new Set([...Object.keys(ne),...Object.keys(led)]);
    for(const k of keys){const a=ne[k]||0,b=led[k]||0;const d=Math.abs(a-b);const rel=d/(Math.abs(a)+1e-9);
      if(d>1e-6&&rel>1e-9&&d>worst){worst=d;worstN=n;worstK=k;}}}
  if(worst>1e-6)console.log(`  [${tag}] ⚠ ledger≠economy: peor Δ=${worst.toExponential(3)} en nación ${worstN} (${NATIONS[worstN]?.name}) recurso ${worstK}`);
  else console.log(`  [${tag}] ✅ ledger==economy (Δ<1e-6 en todas las naciones/recursos)`);
  return worst;
}

let nan=false;
checkInvariant("t=0");
for(let y=0;y<YEARS;y++)for(let d=0;d<365;d++){S.hour+=24;ec.economyTick(24);}
for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;
  for(const k in N.res)if(!isFinite(N.res[k]))nan=true;
  if(N.sWealth)for(const k in N.sWealth)if(!isFinite(N.sWealth[k]))nan=true;
  if(N.inputCover)for(const k in N.inputCover)if(!isFinite(N.inputCover[k]))nan=true;}
console.log(`  NaN en res/sWealth/inputCover tras ${YEARS} años: ${nan?"⚠ SÍ":"✅ no"}`);
checkInvariant(`t=${YEARS}a`);

// (3) cobertura de insumos
const covVals=[],covByGood={};
for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive||!N.inputCover)continue;
  for(const g in N.inputCover){covVals.push(N.inputCover[g]);(covByGood[g]||(covByGood[g]=[])).push(N.inputCover[g]);}}
covVals.sort((a,b)=>a-b);
if(covVals.length){const q=p=>covVals[Math.floor(p*(covVals.length-1))];
  console.log(`  cobertura de insumos: n=${covVals.length}  min=${q(0).toFixed(2)}  p25=${q(.25).toFixed(2)}  mediana=${q(.5).toFixed(2)}  p75=${q(.75).toFixed(2)}  max=${q(1).toFixed(2)}`);
  const below=covVals.filter(v=>v<0.95).length;
  console.log(`  fábricas-reino con cobertura <95%: ${below}/${covVals.length} (${(below/covVals.length*100).toFixed(0)}%) → ${below>0?"la cadena SÍ puede fallar":"⚠ nada estrangulado"}`);
  const avg=o=>o.reduce((a,b)=>a+b,0)/o.length;
  const worst=Object.entries(covByGood).map(([g,a])=>[g,avg(a),a.length]).sort((x,y)=>x[1]-y[1]).slice(0,6);
  console.log("  insumos más escasos (cobertura media):",worst.map(([g,v,c])=>`${g} ${v.toFixed(2)}(×${c})`).join("  "));
}else console.log("  ⚠ inputCover vacío (sin fábricas con cadena que demandaran insumos).");

// (4) acceso al mercado (marketKm)
const acc=[],accByProv=[];
for(const p of S.provs){if(p.wasteland||p.owner>=NPLAY)continue;const a=ec.marketAccess(p);acc.push(a);accByProv.push([p,a]);}
acc.sort((a,b)=>a-b);
if(acc.length){const q=p=>acc[Math.floor(p*(acc.length-1))];
  console.log(`\n  ACCESO (marketKm, n=${acc.length}): min=${q(0).toFixed(2)} p10=${q(.1).toFixed(2)} p25=${q(.25).toFixed(2)} mediana=${q(.5).toFixed(2)} p75=${q(.75).toFixed(2)} p90=${q(.9).toFixed(2)}`);
  const pleno=acc.filter(a=>a>=0.999).length, suelo=acc.filter(a=>a<=0.11).length;
  console.log(`  a acceso PLENO: ${pleno} (${(pleno/acc.length*100).toFixed(0)}%) · en el SUELO: ${suelo} (${(suelo/acc.length*100).toFixed(0)}%)`);
  accByProv.sort((a,b)=>a[1]-b[1]);
  console.log("  las 8 de MENOR acceso:",accByProv.slice(0,8).map(([p,a])=>`${p.name}(${a.toFixed(2)},${Math.round(p.marketKm)}km)`).join(" "));
}

// (5) flete al centro (hubKm)
const fl=[],flByProv=[];
for(const p of S.provs){if(p.wasteland||p.owner>=NPLAY)continue;const f=ec.provFlete(p);fl.push(f);flByProv.push([p,f]);}
fl.sort((a,b)=>a-b);
if(fl.length){const q=p=>fl[Math.floor(p*(fl.length-1))];
  console.log(`\n  FLETE (hubKm, n=${fl.length}): min=${q(0).toFixed(2)} mediana=${q(.5).toFixed(2)} p75=${q(.75).toFixed(2)} p90=${q(.9).toFixed(2)} p99=${q(.99).toFixed(2)} max=${q(1).toFixed(2)}`);
  const alto=fl.filter(f=>f>=0.5).length, tope=fl.filter(f=>f>=0.849).length;
  console.log(`  con flete ALTO (≥50%): ${alto} (${(alto/fl.length*100).toFixed(0)}%) · en el TECHO (0.85): ${tope} (${(tope/fl.length*100).toFixed(0)}%)`);
  flByProv.sort((a,b)=>b[1]-a[1]);
  console.log("  las 8 de MAYOR flete:",flByProv.slice(0,8).map(([p,f])=>`${p.name}(${f.toFixed(2)},${Math.round(p.hubKm)}km)`).join(" "));
}
// (6) portazgo
let tollN=0,tollP=0;for(const p of S.provs)if(p.tollIncome){tollN++;tollP+=p.tollIncome}
console.log(`  provincias generando portazgo: ${tollN} · portazgo total/tick: ${tollP.toExponential(2)}`);

// (7) bienes NUEVOS 2026-07-21: ¿se producen y se consumen? (precio actual vs referencia; sold/mes; inv). Media entre naciones vivas.
const NEW=["herramientas","vidrio","cerveza","ceramica","papel"];
console.log("\n  BIENES NUEVOS (media naciones vivas):");
for(const g of NEW){let np=0,pr=0,sold=0,inv=0,dem=0;
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;np++;
    pr+=(N.mktPrice&&N.mktPrice[g])||0; const mi=(N.mktInfo&&N.mktInfo[g])||{};
    sold+=mi.sold||0; inv+=(N.mkt&&N.mkt[g])||0; dem+=mi.dem||0;}
  if(np){const ref=cfg.MKT_PRICE?cfg.MKT_PRICE[g]:0;
    console.log(`    ${g.padEnd(12)} precio≈${(pr/np).toFixed(2)}  vendido/mes≈${Math.round(sold/np)}  demanda/mes≈${Math.round(dem/np)}  inv≈${Math.round(inv/np)}`);}}
// cerveza vs vino por latitud: ¿un reino norteño bebe cerveza y uno sureño vino?
function alcOf(name){const i=NATIONS.findIndex(x=>x.name===name);if(i<0)return null;const N=S.nations[i];if(!N||!N.alive)return null;
  const mi=N.mktInfo||{};return {cerv:Math.round((mi.cerveza||{}).sold||0),vino:Math.round((mi.vino||{}).sold||0)};}
for(const nm of ["England","Denmark","Castile","Aragon","Naples"]){const a=alcOf(nm);if(a)console.log(`    [${nm}] cerveza/mes=${a.cerv} vino/mes=${a.vino}`);}
