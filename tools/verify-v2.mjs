// tools/verify-v2.mjs — arnés de la ECONOMÍA v2 (design/economia-v2.md).
// Reconstruye el mundo oficial con la SIEMBRA REAL de arranque (réplica de setupNations: fábrica del resType de la
// corona + mercado/templo/cuartel de los estamentos + riqueza inicial) y corre la economía N años. Comprueba:
//  (1) INVARIANTE de la regla: Σ(tesoros + estamentos) + Σ plazas + sumideros − grifos = constante.
//  (2) sin NaN.
//  (3) objetivos de calibración (§9): fracción vendida/producida del campesino 20-35%; neto del campesino por ducado.
//  (4) por nación grande: ingreso de la corona /mes, riqueza por estamento, cobertura de las 3 necesidades.
//  (5) precios mundiales por bien (media y rango) y comercio exterior.
//   node tools/verify-v2.mjs [años=5] [--v1]      (--v1 corre la economía vieja para comparar la corona)
import fs from "fs"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","call-of-war");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");
  t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");
loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const imp=f=>import(pathToFileURL(path.join(base,"js",f)).href);
const st=await imp("state.js"),cfg=await imp("config.js"),mg=await imp("mapgen.js"),ec=await imp("economy.js"),e2=await imp("economy2.js"),es=await imp("estates.js");
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,NPLAY,NATIONS,RES_KEYS,START_STOCK,UNITS,newBuildings,BUILDINGS,STRATA,RES_BUILDING}=cfg;
const args=process.argv.slice(2); const V1=args.includes("--v1"); const YEARS=+(args.find(a=>/^\d+$/.test(a))||5);
const NAC=args.includes("--nac")?args[args.indexOf("--nac")+1]:null; // desglose de flujos por estamento de esa nación
const AI=args.includes("--ia"); // corre la IA real de obras + gestión por presupuesto + construcción + demolición (estates.js)

// ---- mundo ----
S.econV2=!V1; // la IA de obras (estates.js) elige fórmulas según el interruptor
const snap=OFFICIAL_MAP;S.rand=mg.mulberry32(193909);S.hour=0;S.armies=[];
S.provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
  named:!!a[4],coastal:false,morale:75,urban:!!a[5],capital:!!a[6],
  terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,
  buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.seedCities();mg.assignTerrain();mg.assignResources();mg.assignPopulation();
for(const p of S.provs){if(p.wasteland){p.owner=NEUTRAL;p.capital=false;p.urban=false}else mg.seedStrata(p);}
S.mktDirty=true;mg.ensureMarketTopology();
S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
  ai:true,capital:-1,alive:!n.neutral,startProvs:0,sWealth:{campesino:0,burgues:0,clero:0,nobleza:0},mkt:{},taxRate:0.08}));
function seedEstateBld(p,b,e){if(ec.lvlOf(p,b)>=1||ec.usedSlots(p)>=ec.buildSlots(p))return;p.buildings[b]=(p.buildings[b]||0)+1;(p.bOwner||(p.bOwner={}))[b]=e}
for(const p of S.provs)if(!p.wasteland&&p.owner<NPLAY){
  p.sold=ec.soldCap(p);p.bOwner=p.bOwner||{};const b=RES_BUILDING[p.resType];
  if(b&&ec.canStaffIndustry(p,b)){const B=BUILDINGS[b];p.buildings[b]=(ec.specialistCap(p)>=2*ec.jobsOf(b)&&(B.unique?1:(B.max||3)>=2))?2:1;if(!V1){const o=e2.seedOwner2(b);if(o!=="corona")p.bOwner[b]=o}}
  if(!V1)e2.seedEstates2(p,seedEstateBld);else if(p.urban){seedEstateBld(p,"mercado","burgues");seedEstateBld(p,"templo","clero")}else seedEstateBld(p,"cuartel","nobleza");
  p.store={};for(const k of ec.SUBS_BASICS)p.store[k]=ec.storeCap(p,k)*0.6;}
for(let n=0;n<NPLAY;n++){let cap=S.provs.find(p=>p.owner===n&&p.capital)||S.provs.find(p=>p.owner===n);
  if(!cap){S.nations[n].alive=false;continue}S.nations[n].capital=cap.id;
  const units={infanteria:2,miliciano:2};let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  S.armies.push({id:n+1,nation:n,prov:cap.id,units,src:{[cap.id]:w},path:[],legDone:0,legTotal:0});}
if(V1)ec.seedStrataWealth();else e2.seedWealth2();
if(NAC){S.player=NATIONS.findIndex(x=>x.name===NAC);if(S.player<0){console.log("no existe "+NAC);process.exit(1)}}
function census(){const c={};for(const p of S.provs){if(p.owner>=NPLAY||p.wasteland)continue;const n=p.owner;const C=c[n]||(c[n]={});
  for(const b in p.buildings){const l=p.buildings[b]||0;if(!l)continue;const o=ec.bOwnerOf(p,b);const k=b+"@"+o;const x=C[k]||(C[k]={open:0,off:0});
    if(ec.bOff(p,b))x.off+=l;else x.open+=l}}return c}
const census0=census();
const tick=V1?()=>ec.economyTick(24,true):()=>e2.economyTick2(24,true);
const names=NATIONS.map(n=>n.name);
const alive=()=>{const a=[];for(let n=0;n<NPLAY;n++)if(S.nations[n].alive)a.push(n);return a};
const fmt=v=>{const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(2)+"M":a>=1e3?(v/1e3).toFixed(1)+"k":v.toFixed(a<10?2:0)};
const pct=v=>(v*100).toFixed(0)+"%";

// naciones grandes para el informe
const popOf=n=>{let t=0;for(const p of S.provs)if(p.owner===n&&!p.wasteland)t+=p.pop||0;return t};
const big=alive().sort((a,b)=>popOf(b)-popOf(a)).slice(0,12);
console.log(`verify-v2: ${V1?"ECONOMÍA v1 (referencia)":"ECONOMÍA v2"} · ${YEARS} años · ${alive().length} naciones vivas`);

// invariante
const L=()=>S.e2L||{mint:0,sink:0,rescue:0};
const inv=()=>{if(V1)return 0;const{m,pl}=e2.moneyStock();const l=L();return m+pl+l.sink-l.mint-l.rescue};
const inv0=inv();
let nan=false,worstInv=0;
const treas0=new Map();
for(let y=0;y<YEARS;y++){
  for(const n of alive())treas0.set(n,S.nations[n].res.dinero);
  for(const n of alive())if(S.nations[n].e2)S.nations[n].e2.st={prodV:0,soldV:0,grossV:0,campNet:0,jornal:0};
  S.sFlow={};
  for(let d=0;d<365;d++){S.hour+=24;tick();
    if(AI){es.estateBuild();if(!V1)es.budgetManage();for(let h=0;h<24;h++)ec.degradeBuildings();
      for(const p of S.provs)if(p.buildQueue.length){const q=p.buildQueue[0];q.hoursLeft-=24;
        if(q.hoursLeft<=0){p.buildings[q.b]++;p.buildQueue.shift();if(q.owner)(p.bOwner||(p.bOwner={}))[q.b]=q.owner}}}}
  for(const n of alive()){const N=S.nations[n];for(const k in N.res)if(!isFinite(N.res[k]))nan=true;for(const k in N.sWealth)if(!isFinite(N.sWealth[k]))nan=true}
  const iv=inv(); const rel=Math.abs(iv-inv0)/(Math.abs(inv0)+1); worstInv=Math.max(worstInv,rel);
  // resumen mundial del año
  let pop=0,money=0,st={prodV:0,soldV:0,grossV:0,campNet:0,jornal:0};
  for(const n of alive()){const N=S.nations[n];pop+=popOf(n);money+=N.res.dinero;for(const k in N.sWealth)money+=N.sWealth[k];
    if(N.e2&&N.e2.st)for(const k in st)st[k]+=N.e2.st[k]}
  const extra=V1?"":` · vendido/producido ${pct(st.soldV/Math.max(1,st.prodV))} · neto campesino por ducado vendido ${(st.campNet/Math.max(1,st.grossV)).toFixed(2)} · jornales ${fmt(st.jornal)}/año · invariante Δrel ${rel.toExponential(1)}`;
  console.log(`año ${y+1}: población ${fmt(pop)} · dinero en manos ${fmt(money)}${extra}`);
}
console.log(`\nNaN: ${nan?"⚠ SÍ":"✅ no"}${V1?"":` · invariante del dinero: ${worstInv<1e-6?"✅":"⚠"} peor Δrel ${worstInv.toExponential(2)}`}`);
if(!V1){const l=L();console.log(`grifos/sumideros acumulados: minas ${fmt(l.mint)} · rescates ${fmt(l.rescue)} · mantenimiento+flete ${fmt(l.sink)} · tirado de la plaza (valor) ${fmt(l.discard)}`)}

// ---- por nación (último año) ----
console.log(`\nNación            pobl.  corona Δ/mes   riqueza/hab: camp  burg  clero  nob`+(V1?"":"   cobertura (subs/vida/lujo): camp · burg · clero · nob"));
for(const n of big){const N=S.nations[n],W=N.sWealth;const sp={campesino:0,burgues:0,clero:0,nobleza:0};
  for(const p of S.provs)if(p.owner===n&&p.pops)for(const k in sp)sp[k]+=p.pops[k]||0;
  const dT=(N.res.dinero-treas0.get(n))/12;
  let cov="";if(!V1){const c=N.e2.cov;cov="   "+STRATA.map(e=>`${pct(c[e].subs)}/${pct(c[e].vida)}/${e==="campesino"?"—":pct(c[e].lujo)}`).join(" · ")}
  console.log(`${names[n].padEnd(16)} ${fmt(popOf(n)).padStart(6)} ${fmt(dT).padStart(10)}      `+
    STRATA.map(k=>(W[k]/Math.max(1,sp[k])).toFixed(3).padStart(6)).join("")+cov);
}
// ---- precios mundiales ----
if(!V1){
  console.log(`\nBien            ref   precio medio (min–max)   prod/mes   demanda/mes   vendido   export/mes`);
  for(const g of e2.GOODS2){let s=0,c=0,mn=1e9,mx=0,pr=0,dm=0,so=0,ex=0;
    for(const n of alive()){const i=S.nations[n].mktInfo&&S.nations[n].mktInfo[g];if(!i)continue;s+=i.price;c++;mn=Math.min(mn,i.price);mx=Math.max(mx,i.price);
      pr+=i.prod||0;dm+=i.dem||0;so+=i.sold||0;ex+=i.exp||0}
    console.log(`${e2.LABEL2[g].padEnd(14)} ${String(e2.REF2[g]).padStart(4)}   ${(s/c).toFixed(2).padStart(6)} (${mn.toFixed(2)}–${mx.toFixed(2)})`.padEnd(46)+
      `${fmt(pr).padStart(8)}   ${fmt(dm).padStart(10)}   ${pct(so/Math.max(1e-9,dm)).padStart(6)}   ${fmt(ex).padStart(8)}`)}
}

if(NAC){console.log(`
Flujos del último año en ${NAC} (ducados/año, + entra / − sale):`);
  for(const e in S.sFlow){const f=S.sFlow[e];console.log(`  ${e}: `+Object.entries(f).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`${k} ${fmt(v)}`).join(" · "))}}

if(AI){const c1=census();console.log(`
EDIFICIOS por nación (niveles abiertos al final · Δ respecto al inicio · cerrados):`);
  for(const n of big){const A=census0[n]||{},B=c1[n]||{};const keys=new Set([...Object.keys(A),...Object.keys(B)]);const rows=[];
    for(const k of keys){const a=A[k]?A[k].open:0,b=B[k]?B[k].open:0,off=B[k]?B[k].off:0;if(a||b||off)rows.push([k,b,b-a,off])}
    rows.sort((x,y)=>y[1]-x[1]);
    console.log(`${names[n]}: `+rows.map(([k,b,d,off])=>`${k} ${b}${d?`(${d>0?"+":""}${d})`:""}${off?` [${off} cerr.]`:""}`).join(" · "));}
  let cl=0,ro=0;for(const n of alive()){const L=S.nations[n].budLog||[];for(const x of L)x.act==="cierra"?cl++:ro++}
  console.log(`
gestión por presupuesto: ${cl} cierres · ${ro} reaperturas en todo el mundo`);}
// --dump ruta.json: estado final por provincia (para deducir las reglas de edificios de arranque)
if(args.includes("--dump")){const out=args[args.indexOf("--dump")+1];
  const rows=S.provs.filter(p=>p.owner<NPLAY&&!p.wasteland).map(p=>({id:p.id,n:p.owner,nat:names[p.owner],pop:Math.round(p.pop||0),
    urban:!!p.urban,capital:!!p.capital,terrain:p.terrain,resType:p.resType,hubKm:Math.round(p.hubKm||0),
    pops:p.pops?Object.fromEntries(Object.entries(p.pops).map(([k,v])=>[k,Math.round(v)])):null,
    b:Object.fromEntries(Object.entries(p.buildings).filter(([k,v])=>v>0).map(([k,v])=>[k,{l:v,o:ec.bOwnerOf(p,k),off:ec.bOff(p,k)}]))}));
  fs.writeFileSync(out,JSON.stringify(rows));console.log(`volcado ${rows.length} provincias → ${out}`)}

// --regiones: oferta vs demanda de cada bien por GRANDES REGIONES (por la capital de cada reino). Para cazar recursos
// estratégicos mal repartidos: una región que produce 5× lo que consume, o que no produce nada de lo que necesita.
if(args.includes("--regiones")&&!V1){
  const REG=[["Iberia",-10,3.5,35.5,44],["Islas Británicas",-11,2,49.5,61],["Francia",-5,7.5,42.5,51],["Italia",6.5,19,36,47],
    ["Países Bajos-Alemania",3,16,47,55.5],["Escandinavia",4,32,55.5,71],["Polonia-Lituania",14,32,49,57],["Rusia",32,60,50,70],
    ["Hungría-Balcanes",13,30,39,49],["Anatolia-Levante",25,50,29,42.5],["Egipto-Magreb",-10,35,20,37]];
  const regOf=n=>{const N=S.nations[n];const c=S.provs[N.capital];if(!c)return "Otras";const[lo,la]=mg.pxToLonLat(c.x,c.y);
    for(const[r,a,b,c2,d]of REG)if(lo>=a&&lo<=b&&la>=c2&&la<=d)return r;return "Otras"};
  const agg={};for(const n of alive()){const r=regOf(n),N=S.nations[n];const A=agg[r]||(agg[r]={pop:0,g:{}});A.pop+=popOf(n);
    for(const g of e2.GOODS2){const i=N.mktInfo&&N.mktInfo[g];if(!i)continue;const x=A.g[g]||(A.g[g]={p:0,d:0});x.p+=(i.prod||0)-(i.unsold||0)*0;x.d+=i.dem||0}}
  const regs=Object.keys(agg).sort((a,b)=>agg[b].pop-agg[a].pop);
  console.log(`
OFERTA / DEMANDA por región (producido ÷ demandado; <0,5 falta mucho · >2 sobra mucho)`);
  console.log("Bien          "+regs.map(r=>r.slice(0,9).padStart(10)).join(""));
  for(const g of e2.GOODS2)console.log(e2.LABEL2[g].padEnd(14)+regs.map(r=>{const x=agg[r].g[g];if(!x||x.d<=0)return (x&&x.p>0?"  sólo-of":"         —").padStart(10);
    const v=x.p/x.d;return ((v<0.5?"▼":v>2?"▲":" ")+v.toFixed(2)).padStart(10)}).join(""));
  console.log("población     "+regs.map(r=>((agg[r].pop/1e6).toFixed(1)+"M").padStart(10)).join(""));
}
