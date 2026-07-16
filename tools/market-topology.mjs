// tools/market-topology.mjs — Fase 0 del mercado provincial (ADR 0001): MEDIR y ver la topología.
// No cambia nada del juego: reconstruye el mundo oficial, cuenta las plazas reales, construye el
// grafo ralo `S.marketEdges` (buildMarketEdges de mapgen.js) y cronometra lo que costará el mercado
// provincial frente al nacional de hoy. Ninguna constante del plan se fija sin estos números.
//
//   node tools/market-topology.mjs [--km N] [--ticks N]
//     --km N     radio de enlace entre plazas del mismo dueño (por defecto: el MKT_LINK_KM del código).
//                Con varios valores separados por coma compara topologías: --km 100,150,200
//     --ticks N  ticks de economyTick a cronometrar para la línea base (por defecto 200).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","call-of-war");
function loadGlobal(file,name){
  let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");
  t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");
  (0,eval)(t);
}
loadGlobal("mapdata.js","MAPDATA");
loadGlobal("places.js","PLACES");
loadGlobal("official_map.js","OFFICIAL_MAP");
loadGlobal("cities1444.js","CITIES1444");
const st=await import("file:///"+base.replace(/\\/g,"/")+"/js/state.js");
const cfg=await import("file:///"+base.replace(/\\/g,"/")+"/js/config.js");
const mg=await import("file:///"+base.replace(/\\/g,"/")+"/js/mapgen.js");
const ec=await import("file:///"+base.replace(/\\/g,"/")+"/js/economy.js");
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings}=cfg;

const args=process.argv.slice(2);
let KMS=[mg.MKT_LINK_KM],TICKS=200;
for(let i=0;i<args.length;i++){
  if(args[i]==="--km")KMS=args[++i].split(",").map(Number).filter(x=>x>0);
  else if(args[i]==="--ticks")TICKS=parseInt(args[++i])||200;
}

// ---- reconstruir el mundo desde el mapa oficial (igual que sim-economy.mjs) ----
const snap=OFFICIAL_MAP;
S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.assignTerrain();mg.assignResources();
mg.seedCities(); // ciudades reales de 1444 (igual que loadProvMap); va ANTES de assignPopulation
mg.assignPopulation();
for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0}));
for(let n=0;n<NPLAY;n++){
  const cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}
  S.nations[n].capital=cap.id;cap.morale=85;
}
for(const p of S.provs)if(!p.wasteland){if(p.owner<NPLAY)p.sold=ec.soldCap(p);p.store={};for(const k of ec.SUBS_BASICS)p.store[k]=ec.storeCap(p,k)*0.6}

const pad=(s,n)=>String(s).padStart(n);
const pct=(a,b)=>b?(a*100/b).toFixed(1)+"%":"—";

// ================= 1. RECUENTO: ¿cuántas plazas hay de verdad? =================
const vivas=S.provs.filter(p=>!p.wasteland&&p.owner<NPLAY);
const plazas=vivas.filter(p=>p.urban||p.capital);
const caps=vivas.filter(p=>p.capital);
const capNoUrban=caps.filter(p=>!p.urban);
const aldeas=vivas.filter(p=>!p.urban);
const nacVivas=S.nations.filter(n=>n.alive&&n.capital>=0).length;
console.log(`===== 1. RECUENTO (mapa oficial) =====`);
console.log(`Provincias vivas (dueño real, no yermo): ${pad(vivas.length,5)}`);
console.log(`  Nivel 0 — aldeas (!urban):            ${pad(aldeas.length,5)}  ${pct(aldeas.length,vivas.length)}`);
console.log(`  Nivel 1 — plazas (urban||capital):    ${pad(plazas.length,5)}  ${pct(plazas.length,vivas.length)}`);
console.log(`     de ellas nivel 2 — capitales:      ${pad(caps.length,5)}`);
console.log(`Naciones vivas (nodos del mercado hoy): ${pad(nacVivas,5)}`);
if(capNoUrban.length)console.log(`⚠ capitales que NO son urban: ${capNoUrban.length} (${capNoUrban.map(p=>p.name).join(", ")})`);

const porDueno=new Map();
for(const p of plazas){if(!porDueno.has(p.owner))porDueno.set(p.owner,[]);porDueno.get(p.owner).push(p)}
const sinPlaza=[];
for(let n=0;n<NPLAY;n++)if(S.nations[n].alive&&S.nations[n].capital>=0&&!porDueno.has(n))sinPlaza.push(NATIONS[n].name);
const cnt=[...porDueno.entries()].map(([n,l])=>({n:NATIONS[n].name,k:l.length})).sort((a,b)=>b.k-a.k);
console.log(`\nPlazas por reino: media ${(plazas.length/Math.max(1,porDueno.size)).toFixed(1)}, `+
  `mediana ${cnt[cnt.length>>1]?cnt[cnt.length>>1].k:0}, máx ${cnt[0]?cnt[0].k:0} (${cnt[0]?cnt[0].n:"—"})`);
console.log(`  Top 5:  ${cnt.slice(0,5).map(r=>r.n+" "+r.k).join(" · ")}`);
console.log(`  Con 1:  ${cnt.filter(r=>r.k===1).length} reinos   ·   sin ninguna plaza: ${sinPlaza.length}${sinPlaza.length?" ("+sinPlaza.join(", ")+")":""}`);

// ================= 2. TOPOLOGÍA: el grafo ralo =================
console.log(`\n===== 2. TOPOLOGÍA (S.marketEdges) =====`);
console.log(`radio   aristas  grado medio  máx  aisladas  componentes  comp.mayor  km medio  km máx   ms`);
for(const km of KMS){
  const t0=performance.now();
  const g=buildWith(km);
  const ms=performance.now()-t0;
  let ar=0,gmax=0,iso=0;
  for(const[,v]of g){ar+=v.length;if(v.length>gmax)gmax=v.length;if(!v.length)iso++}
  ar/=2;
  // componentes conexas
  const seen=new Set();let comps=0,mayor=0;
  for(const k of g.keys()){
    if(seen.has(k))continue;
    comps++;let sz=0;const st2=[k];seen.add(k);
    while(st2.length){const c=st2.pop();sz++;for(const q of g.get(c))if(!seen.has(q)){seen.add(q);st2.push(q)}}
    if(sz>mayor)mayor=sz;
  }
  let kmSum=0,kmMax=0,pares=0;
  for(const[a,v]of g)for(const b of v)if(a<b){const d=mg.kmBetween(S.provs[a],S.provs[b]);kmSum+=d;if(d>kmMax)kmMax=d;pares++}
  console.log(`${pad(km,5)}  ${pad(ar,7)}  ${pad((ar*2/g.size).toFixed(2),11)}  ${pad(gmax,3)}  ${pad(iso,8)}  `+
    `${pad(comps,11)}  ${pad(mayor,10)}  ${pad(pares?(kmSum/pares).toFixed(0):0,8)}  ${pad(kmMax.toFixed(0),6)}  ${pad(ms.toFixed(0),3)}`);
}
// Fragmentación INTERNA: ¿el mercado de un reino queda de una pieza o en islas? (subgrafo del dueño)
console.log(`\nFragmentación interna por reino (solo aristas entre plazas del MISMO dueño):`);
console.log(`radio   reinos partidos  islas/reino  reinos de 1 sola pieza  plazas huérfanas (isla de 1)`);
for(const km of KMS){
  const g=buildWith(km);
  let partidos=0,islas=0,enteros=0,huerf=0;
  for(const[n,list]of porDueno){
    const ids=new Set(list.map(p=>p.id)),seen=new Set();let c=0;
    for(const k of ids){
      if(seen.has(k))continue;
      c++;let sz=0;const st2=[k];seen.add(k);
      while(st2.length){const x=st2.pop();sz++;for(const q of g.get(x))if(ids.has(q)&&!seen.has(q)){seen.add(q);st2.push(q)}}
      if(sz===1&&list.length>1)huerf++;
    }
    islas+=c; if(c>1)partidos++; else enteros++;
  }
  console.log(`${pad(km,5)}  ${pad(partidos+"/"+porDueno.size,15)}  ${pad((islas/porDueno.size).toFixed(2),11)}  ${pad(enteros,22)}  ${pad(huerf,27)}`);
}

// buildMarketEdges usa la MKT_LINK_KM del módulo; para comparar radios se reimplementa aquí igual.
function buildWith(km){
  if(km===mg.MKT_LINK_KM)return mg.buildMarketEdges();
  const g=new Map();
  const pl=S.provs.filter(p=>(p.urban||p.capital)&&!p.wasteland);
  for(const p of pl)g.set(p.id,new Set());
  const link=(a,b)=>{g.get(a).add(b);g.get(b).add(a)};
  for(const p of pl){
    for(const q of S.adj[p.id])if(g.has(q))link(p.id,q);
    for(const q of S.seaAdj[p.id])if(g.has(q))link(p.id,q);
  }
  const by=new Map();
  for(const p of pl){if(!by.has(p.owner))by.set(p.owner,[]);by.get(p.owner).push(p)}
  for(const l of by.values())for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++)
    if(mg.kmBetween(l[i],l[j])<km)link(l[i].id,l[j].id);
  for(const[k,v]of g)g.set(k,[...v].sort((a,b)=>a-b));
  return g;
}

// ================= 3. COSTE: ¿cuánto más caro que hoy? =================
console.log(`\n===== 3. COSTE (línea base de hoy, ${TICKS} ticks dt=24) =====`);
const g=mg.buildMarketEdges();
let aristas=0;for(const[,v]of g)aristas+=v.length;aristas/=2;
function crono(n,doArb){
  ec.economyTick(24,doArb); // calentar
  const t0=performance.now();
  for(let i=0;i<n;i++)ec.economyTick(24,doArb);
  return (performance.now()-t0)/n;
}
const msSin=crono(TICKS,false), msCon=crono(Math.max(20,TICKS>>2),true);
const bienes=ec.MKT_TRADE.length;
const paresHoy=nacVivas*(nacVivas-1)/2, paresMan=aristas;
console.log(`Tick sin arbitraje (23 de cada 24):   ${msSin.toFixed(3)} ms`);
console.log(`Tick CON arbitraje (1 de cada 24):    ${msCon.toFixed(3)} ms   (+${(msCon-msSin).toFixed(3)} ms = el arbitraje)`);
console.log(`Coste medio real por tick (1/24 arb): ${(msSin+(msCon-msSin)/24).toFixed(3)} ms`);
console.log(`\nEscalado del ARBITRAJE (${bienes} bienes comerciados):`);
console.log(`  hoy:     ${nacVivas} nodos → ${paresHoy} pares × ${bienes} bienes = ${(paresHoy*bienes).toLocaleString("es")} evaluaciones/mes`);
console.log(`  mañana:  ${g.size} plazas → ${paresMan} aristas × ${bienes} bienes = ${(paresMan*bienes).toLocaleString("es")} evaluaciones/mes  `+
  `(×${(paresMan/Math.max(1,paresHoy)).toFixed(2)})`);
console.log(`  (grafo ralo: el arbitraje es O(aristas), no O(plazas²)=${(g.size*(g.size-1)/2).toLocaleString("es")} — ×${(g.size*(g.size-1)/2/Math.max(1,paresHoy)).toFixed(0)} si fuera malla completa)`);
console.log(`\nEscalado del PRECIO/STOCK de básicos (el tick de cada mes, no solo el de arbitraje):`);
console.log(`  hoy: ${nacVivas} nodos (N.mkt)  →  mañana: ${g.size} plazas (p.mkt)  =  ×${(g.size/Math.max(1,nacVivas)).toFixed(1)} nodos`);
const arbMs=msCon-msSin;
console.log(`\nProyección gruesa (el arbitraje escala con las aristas, lineal):`);
console.log(`  arbitraje mensual hoy ${arbMs.toFixed(2)} ms → mañana ~${(arbMs*paresMan/Math.max(1,paresHoy)).toFixed(2)} ms si es MENSUAL`);
console.log(`  … y ~${(arbMs*paresMan/Math.max(1,paresHoy)*24).toFixed(1)} ms/día si corriera CADA TICK → heredar la cadencia mensual (doArb).`);
console.log(`\nConstrucción del grafo: ${(()=>{const t=performance.now();mg.buildMarketEdges();return (performance.now()-t).toFixed(1)})()} ms (1× al cambiar fronteras).`);

// ================= 4. PERTENENCIA: p.marketOf (Fase 1) =================
console.log(`\n===== 4. PERTENENCIA aldea → plaza (p.marketOf) =====`);
const tA=performance.now();mg.assignMarkets();const msA=performance.now()-tA;
const conMkt=vivas.filter(p=>p.marketOf>=0);
const huerfanas=vivas.filter(p=>p.marketOf<0);
console.log(`Provincias con plaza asignada: ${conMkt.length}/${vivas.length}  (${pct(conMkt.length,vivas.length)})`);
if(huerfanas.length)console.log(`⚠ SIN plaza: ${huerfanas.length} — ${huerfanas.slice(0,8).map(p=>p.name+"/"+NATIONS[p.owner].name).join(", ")}`);

// invariantes: la plaza asignada existe, es plaza y no es yerma. (El dueño NO es invariante:
// la frontera no confina — la aldea va a la plaza más cercana aunque sea extranjera.)
let noPlaza=0,yerma=0;
for(const p of conMkt){
  const m=S.provs[p.marketOf];
  if(!m||!(m.urban||m.capital)){noPlaza++;continue}
  if(m.wasteland)yerma++;
}
console.log(`Invariantes: destino que no es plaza ${noPlaza} · destino yermo ${yerma}   ${(noPlaza+yerma)?"❌":"✅ los dos a cero"}`);

// adscripción EXTRANJERA: esperada y sana (peaje, no pasaporte). Lo que importa es su tamaño.
const fuera=conMkt.filter(p=>p.marketOf!==p.id&&S.provs[p.marketOf].owner!==p.owner);
console.log(`\nAldeas adscritas a plaza EXTRANJERA: ${fuera.length}/${kmsBase()} (${pct(fuera.length,vivas.length-plazas.length)}) — pagarán aduana (almojOf) y sufrirán la guerra (TRADE_WAR), no están prohibidas.`);
function kmsBase(){return vivas.length-plazas.length}
const pierde=new Map(),gana=new Map();
for(const p of fuera){
  pierde.set(p.owner,(pierde.get(p.owner)||0)+1);
  const o=S.provs[p.marketOf].owner;gana.set(o,(gana.get(o)||0)+1);
}
const topP=[...pierde.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
const topG=[...gana.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
console.log(`  Más aldeas vendiendo fuera: ${topP.map(([n,k])=>NATIONS[n].name+" "+k).join(" · ")}`);
console.log(`  Plazas que más forasteros atraen: ${topG.map(([n,k])=>NATIONS[n].name+" "+k).join(" · ")}`);

// satélites por plaza
const sat=new Map();
for(const p of conMkt)sat.set(p.marketOf,(sat.get(p.marketOf)||0)+1);
const sv=[...sat.values()].sort((a,b)=>a-b);
const plazasVacias=plazas.filter(p=>!sat.has(p.id)||sat.get(p.id)===1);
console.log(`\nSatélites por plaza (incluyéndose): media ${(conMkt.length/sat.size).toFixed(1)} · `+
  `mediana ${sv[sv.length>>1]} · máx ${sv[sv.length-1]} · plazas sin ninguna aldea ${plazasVacias.length}`);
const top=[...sat.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
console.log(`  Top 5: ${top.map(([id,k])=>S.provs[id].name+" "+k).join(" · ")}`);

// distancia real aldea → su plaza: km de CAMINO (p.marketKm), que es lo que pagará de flete
const kms=conMkt.filter(p=>p.marketOf!==p.id).map(p=>p.marketKm).sort((a,b)=>a-b);
const q=f=>kms[Math.min(kms.length-1,Math.floor(kms.length*f))];
console.log(`\nCamino aldea → su plaza (${kms.length} aldeas, p.marketKm): mediana ${q(.5).toFixed(0)} km · `+
  `p90 ${q(.9).toFixed(0)} · p99 ${q(.99).toFixed(0)} · máx ${kms[kms.length-1].toFixed(0)} km`);
const lejos=conMkt.filter(p=>p.marketOf!==p.id&&p.marketKm>400).sort((a,b)=>b.marketKm-a.marketKm);
console.log(`  Aldeas a más de 400 km de su plaza: ${lejos.length}${lejos.length?" — "+lejos.slice(0,6).map(p=>p.name+"→"+S.provs[p.marketOf].name+" "+p.marketKm.toFixed(0)+"km").join(", "):""}`);

console.log(`\nCoste: assignMarkets ${msA.toFixed(1)} ms · rehacer topología entera (grafo+pertenencia) `+
  `${(()=>{const t=performance.now();S.mktDirty=true;mg.ensureMarketTopology();return (performance.now()-t).toFixed(1)})()} ms `+
  `— solo al conquistar un ducado (transferDuchy), no por tick.`);
