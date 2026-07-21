// tools/diag-paises.mjs — DIAGNÓSTICO ECONÓMICO POR PAÍS (mundo 1444, mapa oficial).
// Mide, por nación y por bien, la PRODUCCIÓN de materia prima vs el CONSUMO, para: (2) cazar déficits
// ANTIHISTÓRICOS de bienes que salen de la tierra (que Francia no importe grano, Suecia tenga hierro…) y
// (3) el balance MUNDIAL raw↔fábricas (cuánta materia prima hay y cuántas cadenas podría alimentar).
// Siembra el estado REAL de arranque (extractores de resType, como setupNations), NO fábricas uniformes.
// Reusa las funciones de economy.js (no duplica fórmulas). Calienta el mercado unos años para leer precios.
//
//   node tools/diag-paises.mjs [años_calentamiento=3] [--nac "Nombre"] [--bien lana]
//     --nac X   perfil DETALLADO de una nación (todos sus bienes: prod/cons/neto/precio)
//     --bien g  quién PRODUCE y quién CONSUME el bien g (ranking de naciones)
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
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings,BUILDINGS,STRATA,TERRAINS,RES_BUILDING,RES_CAT,RES_LABEL,RES_RAW_CATS}=cfg;
const {subsProd,subsCons,terrMul,buildingOutput,isRawSpecialty,RESTYPE_RATE,LUX_NEED,YR_TICKS,TOOL_UP_JOB,alcoholSplit,
  staffing,provProdMul,buildJobs,canStaffIndustry,specialistCap,jobsOf,soldCap,storeCap,SUBS_BASICS,BASICS,MKT_PRICE,MKT_TRADE,effLvl,economyTick,nationEconomy}=ec;

// ---- args ----
const args=process.argv.slice(2); let WARM=3,NAC=null,BIEN=null;
for(let i=0;i<args.length;i++){if(args[i]==="--nac")NAC=args[++i];else if(args[i]==="--bien")BIEN=args[++i];else if(/^\d+$/.test(args[i]))WARM=+args[i];}

// ---- reconstruir mundo (como sim-economy/verify-fase2) ----
const snap=OFFICIAL_MAP;S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.seedCities();mg.assignTerrain();mg.assignResources();mg.assignPopulation(); // ORDEN del juego (mapgen): seedCities pone urban ANTES de assignResources, o las manufacturas no se siembran
for(const p of S.provs){if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}else mg.seedStrata(p);}
S.mktDirty=true;mg.ensureMarketTopology();
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0,sWealth:{campesino:0,burgues:0,clero:0,nobleza:0},mkt:{},taxRate:0.08}));
for(let n=0;n<NPLAY;n++){let cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}S.nations[n].capital=cap.id;}
// SEMBRADO REAL de arranque: una fábrica del resType por provincia donde se pueda dotar (réplica de setupNations)
for(const p of S.provs)if(!p.wasteland&&p.owner<NPLAY){
  p.sold=soldCap(p);const b=RES_BUILDING[p.resType];
  if(b&&canStaffIndustry(p,b)){const B=BUILDINGS[b];p.buildings[b]=(specialistCap(p)>=2*jobsOf(b)&&(B.unique?1:(B.max||3)>=2))?2:1;}
  p.store={};for(const k of SUBS_BASICS)p.store[k]=storeCap(p,k)*0.6;}

// ---- calentar el mercado (rellenar despensas + mover precios) ----
for(let y=0;y<WARM;y++)for(let d=0;d<365;d++){S.hour+=24;economyTick(24);}
const names=NATIONS.map(n=>n.name);
const alive=[];for(let n=0;n<NPLAY;n++)if(S.nations[n].alive)alive.push(n);

// ---- PRODUCCIÓN y CONSUMO por nación y bien (por AÑO), desde las funciones de economy.js ----
const prod={},cons={},strata={},popN={},jobsN={};
for(const n of alive){prod[n]={};cons[n]={};strata[n]={campesino:0,burgues:0,clero:0,nobleza:0};popN[n]=0;jobsN[n]=0;}
const add=(o,n,g,v)=>{o[n][g]=(o[n][g]||0)+v;};
for(const p of S.provs){
  const n=p.owner;if(n>=NPLAY||p.wasteland||!S.nations[n].alive)continue;
  popN[n]+=p.pop||0; if(p.pops)for(const k of STRATA)strata[n][k]+=p.pops[k]||0;
  jobsN[n]+=buildJobs(p);
  const mor=(p.morale||0)/100;
  // PRODUCCIÓN: básicos (subsProd), especialidad (resType), y la de cada edificio (buildingOutput)
  for(const g of BASICS)add(prod,n,g,subsProd(p,g)*YR_TICKS);
  if(isRawSpecialty(p.resType))add(prod,n,p.resType,(p.pop||0)*RESTYPE_RATE*terrMul(p,p.resType)*mor);
  for(const b in p.buildings){if(!effLvl(p,b))continue;const o=buildingOutput(p,b);if(o.g&&o.q)add(prod,n,o.g,o.q*12);}
  // CONSUMO: subsistencia de básicos (subsCons) + insumos de las cadenas (factDem)
  for(const g of BASICS)add(cons,n,g,subsCons(p,g)*YR_TICKS);
  const terr=TERRAINS[p.terrain].prod,st=staffing(p),mul=1+(provProdMul(p)-1)*st;
  for(const b in p.buildings){const lvl=effLvl(p,b);if(!lvl)continue;const B=BUILDINGS[b];if(!B.inputs)continue;
    for(const k in B.inputs)add(cons,n,k,B.inputs[k]*lvl*terr*mor*st*mul*YR_TICKS);}
}
// CONSUMO de las cestas (LUX_NEED) por estrato, con el reparto cerveza/vino por latitud + mantenimiento de herramientas
for(const n of alive){const beerW=alcoholSplit(n);
  for(const k of STRATA)for(const g in LUX_NEED[k]){
    const am=g==="vino"?(1-beerW):(g==="cerveza"?beerW:1);
    add(cons,n,g,strata[n][k]*LUX_NEED[k][g]*YR_TICKS*am);}
  add(cons,n,"herramientas",jobsN[n]*TOOL_UP_JOB*YR_TICKS);}

// ---- helpers de informe ----
const M=1e6, r0=v=>Math.round(v);
const priceR=(n,g)=>{const N=S.nations[n];const p=N.mktPrice&&N.mktPrice[g];const ref=MKT_PRICE[g]||1;return p?p/ref:1;};
const ALLGOODS=[...new Set([...MKT_TRADE,...Object.keys(RES_CAT)])].filter(g=>g!=="dinero"&&g!=="plata"&&g!=="oro");
const RAWS=ALLGOODS.filter(g=>RES_RAW_CATS.indexOf(RES_CAT[g])>=0); // materias primas del campo

// ===================== MODO --bien: quién produce/consume un bien =====================
if(BIEN){const g=BIEN;
  console.log(`\n=== BIEN "${g}" (${RES_LABEL[g]||g}, cat ${RES_CAT[g]}, ref ${MKT_PRICE[g]}) — calentado ${WARM} años ===`);
  const rows=alive.map(n=>({n,p:prod[n][g]||0,c:cons[n][g]||0,pr:priceR(n,g)})).filter(r=>r.p>1||r.c>1);
  rows.sort((a,b)=>b.p-a.p);
  console.log("\n  TOP PRODUCTORES (u/año):");
  for(const r of rows.slice(0,12))console.log(`    ${names[r.n].padEnd(16)} prod ${r0(r.p).toString().padStart(9)}  cons ${r0(r.c).toString().padStart(9)}  neto ${(r.p-r.c>=0?"+":"")+r0(r.p-r.c)}  precio×${r.pr.toFixed(2)}`);
  rows.sort((a,b)=>(b.c-b.p)-(a.c-a.p));
  console.log("\n  TOP DÉFICIT (consume mucho más de lo que produce — ¿antihistórico?):");
  for(const r of rows.slice(0,12))if(r.c-r.p>1)console.log(`    ${names[r.n].padEnd(16)} déficit ${r0(r.c-r.p).toString().padStart(9)}  (prod ${r0(r.p)} / cons ${r0(r.c)})  precio×${r.pr.toFixed(2)}`);
  let TP=0,TC=0;for(const n of alive){TP+=prod[n][g]||0;TC+=cons[n][g]||0;}
  console.log(`\n  MUNDO: producción ${r0(TP)}/año · consumo ${r0(TC)}/año · ratio prod/cons ${(TP/(TC||1)).toFixed(2)} ${TP>=TC?"(excedente)":"(DÉFICIT global)"}`);
  process.exit(0);
}

// ===================== MODO --nac: perfil detallado de un país =====================
if(NAC){const n=names.findIndex(x=>x.toLowerCase()===NAC.toLowerCase());
  if(n<0||!S.nations[n].alive){console.log(`(no encuentro la nación "${NAC}" o está muerta)`);process.exit(0);}
  const ne=nationEconomy(n);
  console.log(`\n=== ${names[n]} — perfil (calentado ${WARM} años) ===`);
  console.log(`  pobl ${(popN[n]/M).toFixed(2)}M · estratos c/b/cl/n: ${STRATA.map(k=>r0(strata[n][k])).join(" / ")} · ducados/mes ${(ne.res.dinero||0).toFixed(1)} · beerW ${alcoholSplit(n).toFixed(2)}`);
  const rows=ALLGOODS.map(g=>({g,p:prod[n][g]||0,c:cons[n][g]||0,pr:priceR(n,g)})).filter(r=>r.p>1||r.c>1);
  rows.sort((a,b)=>(b.p-b.c)-(a.p-a.c));
  console.log("\n  EXCEDENTES (produce > consume) — lo que EXPORTA:");
  for(const r of rows.filter(r=>r.p-r.c>1).slice(0,12))console.log(`    ${r.g.padEnd(13)} +${r0(r.p-r.c).toString().padStart(8)}  (prod ${r0(r.p)} / cons ${r0(r.c)})  ×${r.pr.toFixed(2)}`);
  console.log("\n  DÉFICITS (consume > produce) — lo que IMPORTA (¿algún raw antihistórico?):");
  for(const r of rows.filter(r=>r.c-r.p>1).reverse().slice(0,14)){const raw=RAWS.indexOf(r.g)>=0?" [RAW]":"";console.log(`    ${r.g.padEnd(13)} -${r0(r.c-r.p).toString().padStart(8)}  (prod ${r0(r.p)} / cons ${r0(r.c)})  ×${r.pr.toFixed(2)}${raw}`);}
  process.exit(0);
}

// ===================== MODO por defecto: balance MUNDIAL + cazador de déficits raw =====================
console.log(`\n===== DIAGNÓSTICO MUNDIAL (${alive.length} naciones, calentado ${WARM} años) =====`);
// (3) balance mundial por bien: producción vs consumo, y "cadenas alimentables"
const world=ALLGOODS.map(g=>{let P=0,C=0,pr=0,np=0;for(const n of alive){P+=prod[n][g]||0;C+=cons[n][g]||0;pr+=priceR(n,g);np++;}
  return {g,P,C,pr:pr/np,ratio:P/(C||1)};});
console.log("\n── MATERIAS PRIMAS del campo (raw): producción vs consumo mundial (u/año) ──");
console.log("  bien           producción    consumo     ratio  precio×   estado");
for(const w of world.filter(w=>RAWS.indexOf(w.g)>=0).sort((a,b)=>b.P-a.P)){
  const est=w.ratio>1.3?"EXCEDENTE (industrializable)":w.ratio<0.8?"DÉFICIT global":"equilibrado";
  console.log(`  ${w.g.padEnd(13)} ${r0(w.P).toString().padStart(11)} ${r0(w.C).toString().padStart(11)}  ${w.ratio.toFixed(2).padStart(6)}  ×${w.pr.toFixed(2)}   ${est}`);}
console.log("\n── MANUFACTURAS: producción vs consumo mundial (u/año) ──");
console.log("  bien           producción    consumo     ratio  precio×");
for(const w of world.filter(w=>RES_CAT[w.g]==="manufactura").sort((a,b)=>b.C-a.C)){
  console.log(`  ${w.g.padEnd(13)} ${r0(w.P).toString().padStart(11)} ${r0(w.C).toString().padStart(11)}  ${w.ratio.toFixed(2).padStart(6)}  ×${w.pr.toFixed(2)}`);}

// (2) cazador de déficits raw ANTIHISTÓRICOS: por cada raw, las naciones que MÁS lo importan
console.log("\n── DÉFICITS de materia prima por nación (¿antihistórico? el que NO debería faltar donde falta) ──");
for(const g of RAWS){
  const defs=alive.map(n=>({n,d:(cons[n][g]||0)-(prod[n][g]||0)})).filter(r=>r.d>0).sort((a,b)=>b.d-a.d).slice(0,4);
  if(defs.length&&defs[0].d>50)console.log(`  ${g.padEnd(13)} ${defs.map(r=>`${names[r.n]}(-${r0(r.d)})`).join("  ")}`);
}
console.log("\nPistas: ratio prod/cons MUNDIAL >1 = hay materia para industrializar (objetivo de juego); <1 = falta.");
console.log("Uso: --nac \"Castile\" (perfil país) · --bien lana (quién la produce/consume). Nombres en NATIONS.");
