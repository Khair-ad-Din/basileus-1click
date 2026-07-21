// tools/sahara-wasteland.mjs — marca INHÁBIL (wasteland) el Sáhara profundo: por debajo del Atlas,
// del Atlántico hasta el Nilo. Preserva SIEMPRE: (1) todo lo que toca el mar → el corredor costero de
// Tripolitania (Túnez→Trípoli→Bengasi→Cirene) queda habitable; (2) el valle del Nilo (vega/llanura, no
// desierto); (3) al este del Nilo (lon>31) no se toca (Sinaí, Levante, Arabia). Verifica que el corredor
// Túnez↔Cirene sigue CONECTADO por tierra habitable antes de dar por buena la selección.
//   node tools/sahara-wasteland.mjs           (simulacro + verificación; NO escribe)
//   node tools/sahara-wasteland.mjs --write    (aplica: wasteland=1, pop=0; backup .bak)
import fs from "fs"; import path from "path";
import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const url=p=>"file:///"+path.join(base,p).replace(/\\/g,"/");
const WRITE=process.argv.includes("--write");
function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");loadGlobal("exonyms.js","EXONYMS");loadGlobal("official_map.js","OFFICIAL_MAP");loadGlobal("cities1444.js","CITIES1444");
const st=await import(url("js/state.js"));const cfg=await import(url("js/config.js"));const mg=await import(url("js/mapgen.js"));
const S=st.S,{MW,MH,NEUTRAL,TERRAIN_KEYS,newBuildings,isSea}=cfg;
const snap=OFFICIAL_MAP;S.rand=mg.mulberry32(193909);
S.provIdx=new Int16Array(MW*MH).fill(-1);let pos=0;for(let i=0;i<snap.rle.length;i+=2){const pid=snap.rle[i],run=snap.rle[i+1];if(pid>=0)S.provIdx.fill(pid,pos,pos+run);pos+=run;}
S.provs=snap.provs.map((a,i)=>({id:i,name:mg.localize(a[0]),canon:a[0],x:a[1],y:a[2],owner:a[3],capital:!!a[6],terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,wasteland:a[8]!=null?!!a[8]:null,pop:a[9],urban:!!a[5],buildings:newBuildings()}));
mg.rebuildProvinceData();mg.assignTerrain();
for(const p of S.provs){const[lo,la]=mg.pxToLonLat(p.x,p.y);p.lon=lo;p.la=la;}
const touchesSea=p=>{for(const nb of S.adj[p.id]||[])if(isSea(S.provs[nb]))return true;for(const nb of (S.seaAdj[p.id]||[]))if(isSea(S.provs[nb]))return true;return false;};

// --- SELECCIÓN ---
const sel=new Set();
for(const p of S.provs){
  if(isSea(p)||p.wasteland)continue;
  if(p.terrain!=="desierto")continue;      // solo desierto (Nilo vega/llanura se salva)
  if(p.lon>31)continue;                     // al este del Nilo, no tocar
  if(p.la>34)continue;                      // nada demasiado al norte
  if(touchesSea(p))continue;                // preserva TODA la costa (corredor mediterráneo incl.)
  sel.add(p.id);
}

// --- PRESERVAR EL CORREDOR: camino costero continuo Túnez→Cirene ---
// Wastelandear el Sáhara desconecta el Magreb del continente; hay que dejar una tira de 1 provincia de
// ancho pegada al mar. Dijkstra sobre la tierra no-inhábil (ignorando `sel`), con coste que PREFIERE las
// que tocan el mar → el camino hugea la costa. Sus provincias se sacan de `sel` (quedan habitables).
const near=(lon,lat)=>S.provs.filter(p=>!isSea(p)).reduce((b,p)=>{const d=(p.lon-lon)**2+(p.la-lat)**2;return d<b.d?{p,d}:b;},{p:null,d:1e9}).p;
const tunis=near(10.2,36.8), cyrene=near(21.9,32.8);
function coastPath(a,b){                    // Dijkstra a→b sobre tierra no-wasteland, coste pro-costa
  const N=S.provs.length, dist=new Float64Array(N).fill(Infinity), prev=new Int32Array(N).fill(-1);
  dist[a.id]=0; const pq=[[0,a.id]];
  const seaT=p=>{for(const nb of S.adj[p.id]||[])if(isSea(S.provs[nb]))return true;for(const nb of (S.seaAdj[p.id]||[]))if(isSea(S.provs[nb]))return true;return false;};
  while(pq.length){
    pq.sort((x,y)=>x[0]-y[0]); const [d,c]=pq.shift();
    if(d>dist[c])continue; if(c===b.id)break;
    for(const nb of S.adj[c]||[]){
      const q=S.provs[nb]; if(isSea(q)||q.wasteland)continue;
      const w=1+(seaT(q)?0:4); if(dist[c]+w<dist[nb]){dist[nb]=dist[c]+w;prev[nb]=c;pq.push([dist[nb],nb]);}
    }
  }
  if(dist[b.id]===Infinity)return null;
  const path=[]; for(let c=b.id;c!==-1;c=prev[c])path.push(c); return path.reverse();
}
const cpath=coastPath(tunis,cyrene);
const corridor=[];
if(cpath)for(const id of cpath){if(sel.has(id)){sel.delete(id);corridor.push(id);}}
// --- VERIFICACIÓN: Túnez↔Cirene conectado por tierra habitable ---
const habit=p=>!isSea(p)&&!p.wasteland&&!sel.has(p.id);
function connected(a,b){
  const seen=new Set([a.id]),q=[a.id];
  while(q.length){const c=q.shift();if(c===b.id)return true;for(const nb of S.adj[c]||[]){if(seen.has(nb))continue;if(!habit(S.provs[nb]))continue;seen.add(nb);q.push(nb);}}
  return false;
}
const corridorOK=cpath&&connected(tunis,cyrene);

console.log("Provincias a marcar INHÁBIL:",sel.size);
const arr=[...sel].map(i=>S.provs[i]);
const lons=arr.map(p=>p.lon),las=arr.map(p=>p.la);
console.log("  extensión: lon "+Math.min(...lons).toFixed(1)+"…"+Math.max(...lons).toFixed(1)+"  lat "+Math.min(...las).toFixed(1)+"…"+Math.max(...las).toFixed(1));
console.log("  población que se retira:",arr.reduce((s,p)=>s+(p.pop||0),0).toLocaleString("es"));
console.log("\nCorredor: rescatadas "+corridor.length+" prov interiores como puente costero para no cortar el Magreb.");
console.log("VERIFICACIÓN corredor Túnez("+tunis.name+")↔Cirene("+cyrene.name+"):",corridorOK?"✅ CONECTADO por tierra habitable":"❌ ROTO");
// preservados clave
const keepDesertCoast=S.provs.filter(p=>p.terrain==="desierto"&&!sel.has(p.id)&&!p.wasteland&&touchesSea(p)&&p.lon>=8&&p.lon<=24);
console.log("\nCorredor preservado ("+keepDesertCoast.length+" costeras): "+keepDesertCoast.sort((a,b)=>a.lon-b.lon).map(p=>p.cityName||p.name).join(" · "));
const nileKeep=S.provs.filter(p=>!sel.has(p.id)&&!p.wasteland&&p.lon>=29&&p.lon<=33&&p.la>=22&&p.la<=31&&(p.pop||0)>3000);
console.log("Valle del Nilo preservado (muestra): "+nileKeep.slice(0,12).map(p=>(p.cityName||p.name)+"("+p.pop+")").join(", "));

if(!WRITE){console.log("\n(simulacro; --write para aplicar)");process.exit(0)}
if(!corridorOK){console.log("\nABORTADO: el corredor quedaría roto. No escribo.");process.exit(1)}
for(const i of sel){snap.provs[i][8]=1;snap.provs[i][9]=0;}
const out=path.join(base,"official_map.js");
fs.copyFileSync(out,out+".bak");
fs.writeFileSync(out,"const OFFICIAL_MAP="+JSON.stringify(snap)+";","utf8");
console.log("\nAplicado: "+sel.size+" provincias → inhábil. official_map.js escrito · backup .bak");
