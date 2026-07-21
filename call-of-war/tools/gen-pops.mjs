// tools/gen-pops.mjs — HORNEA la población total de cada provincia en official_map.js (índice 9),
// para que el dataset sea ESTÁTICO y consultable (requisito de Sergio). Reconstruye el mundo EXACTAMENTE
// como loadProvMap (save.js) con el pipeline nuevo (cities1444 reconciliado + seedCities umbral 5k +
// assignPopulation fuente única), y escribe el `pop` computado. Al cargar, el juego respeta pop!=null
// (mapgen.js:747), así que el valor horneado manda como PUNTO DE PARTIDA de 1450; la simulación lo
// evoluciona desde ahí (la etiqueta del mapa muestra el pop VIVO). Re-ejecutar tras tocar cities1444
// o las densidades.
//
//   node tools/gen-pops.mjs           (simulacro: estadísticas, NO escribe)
//   node tools/gen-pops.mjs --write   (escribe official_map.js, backup .bak)
import fs from "fs"; import path from "path";
import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const url=p=>"file:///"+path.join(base,p).replace(/\\/g,"/");
const WRITE=process.argv.includes("--write");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");loadGlobal("exonyms.js","EXONYMS");loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const cfg=await import(url("js/config.js"));const st=await import(url("js/state.js"));const mg=await import(url("js/mapgen.js"));
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,newBuildings,isSea}=cfg;

// --- reconstruir = loadProvMap(snap) con el pipeline nuevo ---
const snap=OFFICIAL_MAP;S.rand=mg.mulberry32(193909);
S.provIdx=new Int16Array(MW*MH).fill(-1);let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:mg.localize(a[0]),canon:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],duchy0:a[10]!=null?a[10]:-1,named:!!a[4],coastal:false,capital:!!a[6],terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9]!=null?a[9]:null,urban:!!a[5],buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
mg.rebuildProvinceData();mg.assignTerrain();mg.assignResources();
let comp=false;for(const p of S.provs)if(p.wasteland==null){p.wasteland=p.terrain==="desierto"&&!p.coastal&&!p.named;comp=true}
if(comp)mg.isolateWastePockets();
for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
// --fresh: NULA el pop horneado para forzar recálculo completo (assignPopulation respeta pop!=null, así
// que sin esto un re-horneo tras cambiar cities1444 sería no-op). Con el mismo seed el pipeline es
// determinista: reproduce todas las provincias sin núcleo tocado y solo mueve las que cambiaron.
if(process.argv.includes("--fresh"))for(const p of S.provs)p.pop=null;
mg.seedCities();mg.assignPopulation();

// --- estadísticas para revisar ANTES de escribir ---
let world=0,land=0,urb=0;const byTerr={};
for(const p of S.provs){
  if(p.wasteland||isSea(p))continue;
  land++;world+=p.pop||0;if(p.urban)urb++;
  const t=p.terrain||"?";byTerr[t]=byTerr[t]||{n:0,pop:0};byTerr[t].n++;byTerr[t].pop+=p.pop||0;
}
console.log("Provincias de tierra:",land,"· urbanas:",urb);
console.log("POBLACIÓN MUNDIAL horneada:",(world/1e6).toFixed(1),"M");
console.log("\nMedia de pop por TERRENO (chequeo de desierto→bajo):");
for(const t of Object.keys(byTerr).sort((a,b)=>byTerr[b].pop-byTerr[a].pop))
  console.log("  "+t.padEnd(10)+" n="+String(byTerr[t].n).padStart(4)+"  media="+Math.round(byTerr[t].pop/byTerr[t].n).toString().padStart(6)+"  total="+(byTerr[t].pop/1e6).toFixed(2)+"M");
const top=[...S.provs].filter(p=>!p.wasteland&&!isSea(p)).sort((a,b)=>b.pop-a.pop).slice(0,15);
console.log("\nTop 15 provincias por pop:");
for(const p of top)console.log("  "+String(Math.round(p.pop)).padStart(7)+"  "+(p.cityName||p.name)+(p.cityPop?" [núcleo "+p.cityPop+"]":""));

if(!WRITE){console.log("\n(simulacro; usa --write para hornear official_map.js)");process.exit(0)}
// --- escribir SOLO pop[9] ---
for(const p of S.provs)snap.provs[p.id][9]=(p.wasteland||isSea(p))?0:Math.max(0,Math.round(p.pop||0));
const out=path.join(base,"official_map.js");
fs.copyFileSync(out,out+".bak");
fs.writeFileSync(out,"const OFFICIAL_MAP="+JSON.stringify(snap)+";","utf8");
console.log("\nHorneado official_map.js ("+land+" provincias de tierra) · backup .bak");
