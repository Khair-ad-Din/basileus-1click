// tools/edit-sahara-arabia.mjs — ediciones puntuales de Sergio sobre el mapa (2026-07-20):
//  · desactiva (wasteland) el ducado "Central Sahara" entero
//  · re-habilita la provincia "Birżebbuġa" (la wastelandeó de más el pase del Sáhara; ya está en Thubaqt)
//  · en Arabia, desactiva los ducados INDEPENDIENTES (dueño NEUTRAL) + "Al Wajh" + "Tabuk"
// Verifica que no se rompe la conectividad terrestre (corredor Tripolitania, Tell Marruecos↔Túnez).
//   node tools/edit-sahara-arabia.mjs           (simulacro + verificación)
//   node tools/edit-sahara-arabia.mjs --write    (aplica; backup .bak)
import fs from "fs"; import path from "path";
import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const url=p=>"file:///"+path.join(base,p).replace(/\\/g,"/");
const WRITE=process.argv.includes("--write");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");loadGlobal("exonyms.js","EXONYMS");loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const st=await import(url("js/state.js"));const cfg=await import(url("js/config.js"));const mg=await import(url("js/mapgen.js"));
const S=st.S,{MW,MH,NEUTRAL,NATIONS,TERRAIN_KEYS,isSea}=cfg;
const snap=OFFICIAL_MAP,DN=snap.duchies;
S.rand=mg.mulberry32(193909);
S.provIdx=new Int16Array(MW*MH).fill(-1);let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,canon:a[0],x:a[1],y:a[2],owner:a[3],terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,duchy0:a[10]!=null?a[10]:-1}));
mg.rebuildProvinceData();
for(const p of S.provs){const[lo,la]=mg.pxToLonLat(p.x,p.y);p.lon=lo;p.la=la;}

// --- objetivos ---
const wasteDuchyNames=new Set(["Central Sahara","Al Wajh","Tabuk"]);
// Arabia: ducados con dueño dominante NEUTRAL (independientes)
const arabia=S.provs.filter(p=>!isSea(p)&&p.lon>=33&&p.lon<=62&&p.la>=10&&p.la<=33);
const dOwn={};for(const p of arabia){const d=p.duchy0;dOwn[d]=dOwn[d]||{};dOwn[d][p.owner]=(dOwn[d][p.owner]||0)+1;}
const indepIdx=[];
for(const d in dOwn){const dom=+Object.entries(dOwn[d]).sort((a,b)=>b[1]-a[1])[0][0];if(dom===NEUTRAL)indepIdx.push(+d);}
const wasteIdx=new Set(indepIdx);
for(const nm of wasteDuchyNames){const i=DN.indexOf(nm);if(i>=0)wasteIdx.add(i);}

// aplicar en un mapa de trabajo (Set de ids a wasteland, y la re-habilitada)
const toWaste=new Set(), reEnable=new Set();
for(const p of S.provs)if(wasteIdx.has(p.duchy0)&&!isSea(p)&&!p.wasteland)toWaste.add(p.id);
const birz=S.provs.find(p=>p.canon==="Birżebbuġa");
if(birz&&birz.wasteland)reEnable.add(birz.id);

// estado simulado
const isWaste=p=>(p.wasteland||toWaste.has(p.id))&&!reEnable.has(p.id);
const habit=p=>!isSea(p)&&!isWaste(p);
const near=(lo,la)=>S.provs.filter(p=>!isSea(p)).reduce((b,p)=>{const d=(p.lon-lo)**2+(p.la-la)**2;return d<b.d?{p,d}:b;},{p:null,d:1e9}).p;
function conn(a,b){const seen=new Set([a.id]),q=[a.id];while(q.length){const c=q.shift();if(c===b.id)return true;for(const nb of S.adj[c]||[]){if(seen.has(nb)||!habit(S.provs[nb]))continue;seen.add(nb);q.push(nb);}}return false;}
const tunis=near(10.2,36.8),cyrene=near(21.9,32.8),fez=near(-5,34),cairo=near(31.2,30);

console.log("=== EDICIONES ===");
console.log("Ducados a desactivar:");
for(const i of [...wasteIdx].sort((a,b)=>a-b)){const n=S.provs.filter(p=>p.duchy0===i&&!isSea(p)).length;console.log("  idx"+String(i).padStart(4)+"  "+(DN[i]||"?").padEnd(22)+" "+n+" prov"+(wasteDuchyNames.has(DN[i])?"  (nombrado)":"  (independiente)"));}
console.log("\nProvincias que pasan a INHÁBIL (nuevas):",toWaste.size);
console.log("Re-habilitadas:",[...reEnable].map(i=>S.provs[i].canon+" (Thubaqt)").join(", ")||"—");
console.log("\n=== CONECTIVIDAD (tras aplicar) ===");
console.log("  Corredor Túnez↔Cirene:",conn(tunis,cyrene)?"✅":"❌ ROTO");
console.log("  Tell Marruecos↔Túnez :",conn(fez,tunis)?"✅":"❌ ROTO");
console.log("  Túnez↔El Cairo       :",conn(tunis,cairo)?"✅":"❌ ROTO");

if(!WRITE){console.log("\n(simulacro; --write para aplicar)");process.exit(0)}
if(!(conn(tunis,cyrene)&&conn(fez,tunis)&&conn(tunis,cairo))){console.log("\nABORTADO: rompería conectividad.");process.exit(1)}
for(const id of toWaste){snap.provs[id][8]=1;snap.provs[id][9]=0;}
for(const id of reEnable){snap.provs[id][8]=0;snap.provs[id][9]=null;} // pop null → lo recomputa la carga
const out=path.join(base,"official_map.js");
fs.copyFileSync(out,out+".bak");
fs.writeFileSync(out,"const OFFICIAL_MAP="+JSON.stringify(snap)+";","utf8");
console.log("\nAplicado: +"+toWaste.size+" inhábiles, "+reEnable.size+" re-habilitada. official_map.js · backup .bak");
