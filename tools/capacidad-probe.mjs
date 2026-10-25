// tools/capacidad-probe.mjs — sonda de la CAPACIDAD AGRARIA (design/capacidad-agraria.md). Mundo oficial con la siembra
// real (copiada de verify-v2.mjs), economía v2 sin IA ni guerras, N años. Por región y década: ocupación x (campesinos /
// capacidad efectiva), % de la capacidad con x > 0,9, episodios de hambre (granero-año), muertos, precio del grano
// (× referencia), semanas-nación con el grano en el techo ×3 y renta del señorío. Al final, ADELANTADOS (sus reinos suben
// N.agro ×1,1 cada 20 años: simulan el árbol tecnológico) frente a ATRASADOS.
//   node tools/capacidad-probe.mjs [años=80] [década=10]       (COW=ruta a otra copia de call-of-war · TAG=etiqueta)
import fs from "fs"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const base=process.env.COW||path.join(path.dirname(fileURLToPath(import.meta.url)),"..","call-of-war");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");
  t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");
loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const imp=f=>import(pathToFileURL(path.join(base,"js",f)).href);
const st=await imp("state.js"),cfg=await imp("config.js"),mg=await imp("mapgen.js"),ec=await imp("economy.js"),e2=await imp("economy2.js"),es=await imp("estates.js");
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings,BUILDINGS,STRATA,RES_BUILDING}=cfg;

// ---- mundo ----
const snap=OFFICIAL_MAP;S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.duchyNames=Array.isArray(snap.duchies)?snap.duchies.slice():null;
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],duchy0:a[10]!=null?a[10]:-1,
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.buildDuchies();mg.seedCities();mg.assignTerrain();mg.assignResources();mg.assignPopulation();
for(const p of S.provs){if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}else mg.seedStrata(p);}
S.mktDirty=true;mg.ensureMarketTopology();
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0,sWealth:{campesino:0,burgues:0,clero:0,nobleza:0},mkt:{},taxRate:0.08}));
function seedEstateBld(p,b,e){if(ec.lvlOf(p,b)>=1||ec.usedSlots(p)>=ec.buildSlots(p))return;p.buildings[b]=(p.buildings[b]||0)+1;(p.bOwner||(p.bOwner={}))[b]=e}
for(const p of S.provs)if(!p.wasteland&&p.owner<NPLAY){
  p.sold=ec.soldCap(p);p.bOwner=p.bOwner||{};const b=e2.obsolete2(RES_BUILDING[p.resType])?null:RES_BUILDING[p.resType];
  if(b&&ec.canStaffIndustry(p,b)){const B=BUILDINGS[b];p.buildings[b]=(ec.specialistCap(p)>=2*ec.jobsOf(b)&&(B.unique?1:(B.max||3)>=2))?2:1;const o=e2.seedOwner2(b);if(o!=="corona")p.bOwner[b]=o}
  e2.seedEstates2(p,seedEstateBld);
  p.store={};for(const k of ec.SUBS_BASICS)p.store[k]=ec.storeCap(p,k)*0.6;}
for(let n=0;n<NPLAY;n++){let cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}S.nations[n].capital=cap.id;
  const units={infanteria:2,miliciano:2};let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  S.armies.push({id:n+1,nation:n,prov:cap.id,units,src:{[cap.id]:w},path:[],legDone:0,legTotal:0});}
e2.seedWealth2();
const names=NATIONS.map(n=>n.name);
const fmt=v=>{const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(2)+"M":a>=1e3?(v/1e3).toFixed(1)+"k":v.toFixed(a<10?2:0)};
const TAG=process.env.TAG||"run";
const YEARS=+(process.argv[2]||80), DEC=+(process.argv[3]||10);
const LP=S.provs.filter(p=>p.owner<NPLAY&&!p.wasteland&&p.pops);
const REG=[["Iberia",-10,3.5,35.5,44],["Islas Británicas",-11,2,49.5,61],["Francia",-5,7.5,42.5,51],["Italia",6.5,19,36,47],["P.Bajos-Alemania",3,16,47,55.5],["Escandinavia",4,32,55.5,71],["Polonia-Lituania",14,32,49,57],["Rusia",32,60,50,70],["Hungría-Balcanes",13,30,39,49],["Anatolia-Levante",25,50,29,42.5],["Egipto-Magreb",-10,35,20,37]];
const regOfXY=(x,y)=>{const[lo,la]=mg.pxToLonLat(x,y);for(const[r,a,b,c,d]of REG)if(lo>=a&&lo<=b&&la>=c&&la<=d)return r;return "Otras"};
const preg=new Map();for(const p of LP)preg.set(p,regOfXY(p.x,p.y));
const RN=[...REG.map(r=>r[0]),"Otras"];
const natReg=n=>{const c=S.provs[S.nations[n].capital];return c?regOfXY(c.x,c.y):"Otras"};
const gk=p=>(p.duchy>=0?"d"+p.duchy:"p"+p.id)+"|"+p.owner;
const ADVN=["Inglaterra","Francia","Borgoña","Brabante","Flandes","Holanda"].map(x=>names.indexOf(x)).filter(i=>i>=0);
const isAdv=p=>ADVN.includes(p.owner);
{const k0={};for(const r of RN)k0[r]={c:0,K:0};for(const p of LP){const a=k0[preg.get(p)];a.c+=p.pops.campesino||0;a.K+=e2.landCap(p)}
 console.log(`[${TAG}] x inicial (campesinos/capacidad) por región: `+RN.filter(r=>k0[r].K>0).map(r=>`${r} ${(k0[r].c/k0[r].K).toFixed(2)}`).join(" · "))}
const P0={adv:0,rest:0};for(const p of LP)P0[isAdv(p)?"adv":"rest"]+=p.pop||0;
const grp={adv:[],rest:[]};let acc=null,gAcc=null;
const newAcc=()=>{const a={};for(const r of RN)a[r]={fam:new Set(),dead:0,pr:0,prN:0,cap:0,rent:0};return a};
const rows=[];let pmKey0=S.pmKey;const t0=Date.now();
for(let y=0;y<YEARS;y++){
  if(y%DEC===0){acc=newAcc();gAcc={adv:{dead:0,fam:new Set()},rest:{dead:0,fam:new Set()}}}
  if(y>0&&y%20===0)for(const n of ADVN)S.nations[n].agro=(S.nations[n].agro||1)*1.10;   // simula que investigan
  for(let d=0;d<365;d++){S.hour+=24;const before=new Map();for(const p of LP)before.set(p,p.pop||0);
    e2.economyTick2(24,true);es.budgetManage();
    for(const p of LP)if(p.famine){const A=acc[preg.get(p)],k=gk(p)+"|"+y;A.fam.add(k);const b=before.get(p),dd=b>(p.pop||0)?b-(p.pop||0):0;
      A.dead+=dd;const G=gAcc[isAdv(p)?"adv":"rest"];G.dead+=dd;G.fam.add(k)}
    if(d%7===0)for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N.alive||!N.mktPrice||!(N.mktPrice.comida>0))continue;const A=acc[natReg(n)];
      const r=N.mktPrice.comida/(e2.REF2.comida*e2.PRICE_SCALE);A.pr+=r;A.prN++;if(r>=2.9)A.cap++}
    if(S.pmKey!==pmKey0){pmKey0=S.pmKey;for(const p of LP){const m=p.m;if(m&&m.pay.nobleza&&m.pay.nobleza["Renta del señorío"])acc[preg.get(p)].rent+=m.pay.nobleza["Renta del señorío"]}}}
  if((y+1)%DEC===0){const snap={y:y+1,r:{}};
    for(const r of RN)snap.r[r]={c:0,K:0,pop:0,hi:0};
    for(const p of LP){const s=snap.r[preg.get(p)],c=p.pops.campesino||0,Kc=e2.landCap(p);s.c+=c;s.K+=Kc;s.pop+=p.pop||0;if(Kc>0&&c/Kc>0.9)s.hi+=Kc}
    for(const r of RN){const s=snap.r[r],A=acc[r];s.x=s.K?s.c/s.K:0;s.hi=s.K?s.hi/s.K:0;s.fam=A.fam.size;s.dead=A.dead;s.pr=A.prN?A.pr/A.prN:0;s.cap=A.cap;s.rent=A.rent/DEC}
    for(const k of ["adv","rest"]){let pop=0,c=0,K=0;for(const p of LP){if((k==="adv")!==isAdv(p))continue;pop+=p.pop||0;c+=p.pops.campesino||0;K+=e2.landCap(p)}
      grp[k].push({y:y+1,pop,x:c/K,dead:gAcc[k].dead,fam:gAcc[k].fam.size})}
    rows.push(snap);
    // progreso con el resumen de grupos de la década (se puede leer a medias en el log)
    const ga=grp.adv[grp.adv.length-1],gr=grp.rest[grp.rest.length-1];
    console.log(`[${TAG}] ${1444+y+1} (${((Date.now()-t0)/60000).toFixed(1)} min) · adelantados ${fmt(ga.pop)} x ${ga.x.toFixed(2)} muertos ${fmt(ga.dead)} · atrasados ${fmt(gr.pop)} x ${gr.x.toFixed(2)} muertos ${fmt(gr.dead)}`)}}
console.log(`\n[${TAG}] ${YEARS} años. Por región y ${DEC} años: x (campesinos/capacidad) · % de la capacidad con x>0,9 · episodios de hambre (granero-año) · muertos · precio grano ×ref · semanas-nación en el techo · renta del señorío/año`);
for(const r of RN){if(!rows[0].r[r].K)continue;console.log(`\n${r}  (pobl. → final: ${fmt(rows[0].r[r].pop)} → ${fmt(rows[rows.length-1].r[r].pop)})`);
  for(const s of rows){const q=s.r[r];console.log(`  ${String(1444+s.y).padEnd(5)} x ${q.x.toFixed(2)} · >0,9 ${(100*q.hi).toFixed(0).padStart(3)}% · hambre ${String(q.fam).padStart(4)} · muertos ${fmt(q.dead).padStart(7)} · grano ×${q.pr.toFixed(2)} · techo ${String(q.cap).padStart(4)} · renta ${fmt(q.rent)}`)}}
let pop=0;for(const p of LP)pop+=p.pop||0;console.log(`\npoblación total final ${fmt(pop)}`);
console.log(`\n[${TAG}] ADELANTADOS (${ADVN.map(n=>names[n]).join(", ")}; capacidad +10% cada 20 años) frente a ATRASADOS (el resto, capacidad fija):`);
for(const k of ["adv","rest"]){console.log(k==="adv"?"  adelantados":"  atrasados");let prev=P0[k];
  for(const r of grp[k]){console.log(`    ${1444+r.y}  pobl. ${fmt(r.pop)} (${(100*(Math.pow(r.pop/prev,1/DEC)-1)).toFixed(2)}%/año) · x ${r.x.toFixed(2)} · hambre ${r.fam} · muertos ${fmt(r.dead)} (${(100*r.dead/r.pop/DEC).toFixed(2)}%/año)`);prev=r.pop}}
