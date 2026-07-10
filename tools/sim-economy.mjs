// tools/sim-economy.mjs — arnés de análisis de la economía POP (sin navegador).
// Corre el núcleo económico REAL (economyTick de economy.js) muchos años sobre el mapa oficial y
// TODAS las naciones, y saca conclusiones: crecimiento, hambrunas, dotación y cuellos de botella.
// NO simula IA, construcción, guerras ni movimiento (línea base económica/demográfica pura).
//
//   node tools/sim-economy.mjs [años] [--build N] [--watch "Nación"]
//     años      horizonte de simulación (por defecto 30). Más años = más lento.
//     --build N pone los edificios económicos comunes a nivel N en todas las provincias
//               (para observar dotación/especialización; por defecto sin desarrollo).
//     --watch X series año a año de la nación X (además del resumen global).
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
const st=await import("file:///"+base.replace(/\\/g,"/")+"/js/state.js");
const cfg=await import("file:///"+base.replace(/\\/g,"/")+"/js/config.js");
const mg=await import("file:///"+base.replace(/\\/g,"/")+"/js/mapgen.js");
const ec=await import("file:///"+base.replace(/\\/g,"/")+"/js/economy.js");
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings}=cfg;

// ---- argumentos ----
const args=process.argv.slice(2);
let YEARS=30,BUILD=0,WATCH=null;
for(let i=0;i<args.length;i++){
  if(args[i]==="--build")BUILD=parseInt(args[++i])||0;
  else if(args[i]==="--watch")WATCH=args[++i];
  else if(/^\d+$/.test(args[i]))YEARS=parseInt(args[i]);
}

// ---- reconstruir el mundo desde el mapa oficial (equivalente a loadProvMap) ----
const snap=OFFICIAL_MAP;
S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.assignTerrain();mg.assignResources();mg.assignPopulation();
for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}

// ---- setup de naciones (equivalente económico de setupNations) ----
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0}));
const ECO=["granja","aserradero","cantera","mina","mercado","gremio","templo","almacen"];
for(let n=0;n<NPLAY;n++){
  let cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}
  S.nations[n].capital=cap.id;cap.morale=85;cap.buildings.cuartel=1;
  const units={infanteria:2,miliciano:2};let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  S.armies.push({id:n+1,nation:n,prov:cap.id,units,src:{[cap.id]:w},path:[],legDone:0,legTotal:0});
}
if(BUILD>0)for(const p of S.provs)if(!p.wasteland&&p.owner<NPLAY)for(const b of ECO)p.buildings[b]=Math.min(cfg.BUILDINGS[b].unique?1:cfg.BUILDINGS[b].max,BUILD);
for(const p of S.provs)if(!p.wasteland){if(p.owner<NPLAY)p.sold=ec.soldCap(p);p.food=ec.foodCap(p)*0.6}

// ---- telemetría ----
const names=NATIONS.map(n=>n.name);
const NKEY=["materiales","pano","vino","sal","comida"]; // bienes cuyo déficit es "cuello de botella"
const tel={}; // por nación
function livingProvs(n){return S.provs.filter(p=>p.owner===n&&!p.wasteland)}
function initTel(){
  for(let n=0;n<NPLAY;n++){if(!S.nations[n].alive)continue;
    tel[n]={pop0:0,popEnd:0,provs:livingProvs(n).length,famSum:0,fillSum:0,staffSum:0,samples:0,series:[]};
    for(const p of livingProvs(n))tel[n].pop0+=p.pop;}
}
function sample(){
  for(let n=0;n<NPLAY;n++){const t=tel[n];if(!t)continue;
    const lp=livingProvs(n);let pop=0,fam=0,fill=0,staff=0,sc=0;
    for(const p of lp){pop+=p.pop;if(p.famine)fam++;const fc=ec.foodCap(p);fill+=fc>0?p.food/fc:0;
      if(ec.buildJobs(p)>0){staff+=ec.staffing(p);sc++}}
    t.samples++;t.famSum+=lp.length?fam/lp.length:0;t.fillSum+=lp.length?fill/lp.length:0;t.staffSum+=sc?staff/sc:1;t.popEnd=pop;
  }
}
function totalPop(){let t=0;for(const p of S.provs)if(!p.wasteland)t+=p.pop;return t}

// ---- correr ----
initTel();
const pop0=totalPop();
console.log(`Simulando ${YEARS} años (${BUILD?'con edificios nivel '+BUILD:'sin desarrollo'})… mapa oficial, `+
  `${Object.keys(tel).length} naciones vivas.`);
for(let y=0;y<YEARS;y++){
  for(let d=0;d<365;d++){S.hour+=24;ec.economyTick(24);if(d%30===0)sample();} // paso de día (24×), muestreo ~mensual
  for(let n=0;n<NPLAY;n++)if(tel[n])tel[n].series.push(Math.round(livingProvs(n).reduce((a,p)=>a+p.pop,0)));
}
const pop1=totalPop();

// ---- informe ----
const M=1e6;
console.log(`\n===== RESUMEN (${YEARS} años) =====`);
console.log(`Población total: ${(pop0/M).toFixed(1)}M → ${(pop1/M).toFixed(1)}M  `+
  `(${((Math.pow(pop1/pop0,1/YEARS)-1)*100).toFixed(2)}%/año)`);
const rows=Object.keys(tel).map(n=>{
  const t=tel[n];const ne=ec.nationEconomy(+n);
  const gr=(Math.pow(t.popEnd/Math.max(1,t.pop0),1/YEARS)-1)*100;
  // cuello de botella: el bien (no dinero) con el balance más negativo por habitante
  let bott="—",bv=0;for(const k of NKEY){const v=ne.res[k]||0;if(v<bv){bv=v;bott=k}}
  return {n:names[n],pop0:t.pop0,popEnd:t.popEnd,gr,fam:t.famSum/t.samples*100,fill:t.fillSum/t.samples*100,
    staff:t.staffSum/t.samples*100,din:ne.res.dinero||0,bott,bv};
}).sort((a,b)=>b.popEnd-a.popEnd);
console.log(`\nNación            Pobl.ini  Pobl.fin  %/año  Hambr%  Despensa  Dotac.  Ducados/mes  Duc/100k hab  Cuello de botella`);
for(const r of rows.slice(0,16)){
  const bn={materiales:"Madera",pano:"Paño",vino:"Vino",sal:"Sal",comida:"Grano"}[r.bott]||r.bott;
  const pc=r.popEnd>0?r.din*1e5/r.popEnd:0;
  console.log(
    r.n.padEnd(16),
    (r.pop0/M).toFixed(2).padStart(7),(r.popEnd/M).toFixed(2).padStart(9),
    (r.gr>=0?"+":"")+r.gr.toFixed(2).padStart(5),
    r.fam.toFixed(1).padStart(6),
    (r.fill.toFixed(0)+"%").padStart(8),
    (r.staff.toFixed(0)+"%").padStart(6),
    ((r.din>=0?"+":"")+r.din.toFixed(1)).padStart(11),
    ((pc>=0?"+":"")+pc.toFixed(1)).padStart(11),
    "  "+(r.bv<-0.05?bn+" ("+r.bv.toFixed(1)+")":"ninguno"));
}
console.log(`\nPistas: Hambr% = % medio de provincias en hambruna · Despensa = llenado medio · `+
  `Dotación = staffing medio de edificios · Cuello = bien de confort con mayor déficit /mes.`);

if(WATCH){
  const n=names.findIndex(x=>x.toLowerCase()===WATCH.toLowerCase());
  if(n>=0&&tel[n]){console.log(`\n===== ${names[n]} año a año (población) =====`);
    tel[n].series.forEach((p,i)=>console.log(`  año ${String(i+1).padStart(3)}: ${p.toLocaleString("es")}`));}
  else console.log(`\n(no encuentro la nación "${WATCH}")`);
}
