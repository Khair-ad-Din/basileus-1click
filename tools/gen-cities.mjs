// Genera call-of-war/cities1444.js desde el CSV del cronista. Reproducible: si el dataset mejora,
// se vuelve a correr. Proyecta con la MISMA aritmetica que el juego (inversa de pxToLonLat).
import fs from "fs";
const SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/";
const base="c:/Users/sergi/OneDrive/Documentos/Basileus 1 click/call-of-war/";
function lg(f,n){let t=fs.readFileSync(base+f,"utf8").replace(/\r\n/g,"\n");
  t=t.replace(new RegExp("^const\\s+"+n+"\\s*=","m"),"globalThis."+n+"=");(0,eval)(t);}
lg("mapdata.js","MAPDATA");lg("official_map.js","OFFICIAL_MAP");
const cfg=await import("file:///"+base+"js/config.js");
const {MW,MH}=cfg;

const G=MAPDATA.geo;
const yn=Math.log(Math.tan(Math.PI/4+G.NORTH*Math.PI/360)), ys=Math.log(Math.tan(Math.PI/4+G.SOUTH*Math.PI/360));
const lonLatToPx=(lon,lat)=>[Math.round((lon-G.WEST)/(G.EAST-G.WEST)*MW),
  Math.round((yn-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)))/(yn-ys)*MH)];

function parseCSV(txt){const out=[],L=txt.replace(/\r/g,"").split("\n").filter(l=>l.trim());
  const head=L[0].split(",");
  for(let i=1;i<L.length;i++){const row=[];let cur="",q=false;
    for(const ch of L[i]){if(ch==='"'){q=!q;continue}if(ch===","&&!q){row.push(cur);cur="";continue}cur+=ch}
    row.push(cur);const o={};head.forEach((h,j)=>o[h]=row[j]);out.push(o)}
  return out;}
const rows=parseCSV(fs.readFileSync(SP+"basileus_ciudades_1444.csv","utf8"));

// provIdx del mapa oficial, para descartar las que caen en mar/yermo
const provIdx=new Int16Array(MW*MH).fill(-1);
let pos=0;for(let i=0;i<OFFICIAL_MAP.rle.length;i+=2){const pid=OFFICIAL_MAP.rle[i],run=OFFICIAL_MAP.rle[i+1];
  if(pid>=0)provIdx.fill(pid,pos,pos+run);pos+=run;}
const waste=OFFICIAL_MAP.provs.map(a=>a[8]!=null?!!a[8]:false);

const num=v=>{const x=parseFloat(v);return isFinite(x)?x:null};
// nombre limpio: "Fustat (Cairo, ~Heliopolis, Al-Kahira)" -> "Fustat"
const limpia=s=>s.replace(/\s*\(.*$/,"").trim();

const out=[];let mar=0,yerma=0,fuera=0,bajas=0;
for(const r of rows){
  // poblacion de 1444: la de 1450 si existe, si no la de 1400. NUNCA la de 1500:
  // Estambul seria 200k cuando en 1444 era una ruina pre-1453 (45k).
  const p50=num(r.pop1450_k), pop=p50??num(r.pop1400_k), año=p50!=null?1450:1400;
  if(pop==null||pop<5){bajas++;continue}
  const lat=num(r.lat),lon=num(r.lon);
  if(lat==null||lon==null){fuera++;continue}
  const[x,y]=lonLatToPx(lon,lat);
  if(x<0||y<0||x>=MW||y>=MH){fuera++;continue}
  const pid=provIdx[y*MW+x];
  if(pid<0){mar++;continue}
  if(waste[pid]){yerma++;continue}
  out.push([limpia(r.city),x,y,Math.round(pop*1000),año]);
}
out.sort((a,b)=>b[3]-a[3]);
console.log(`CSV ${rows.length} -> ${out.length} ciudades sembrables`);
console.log(`  descartadas: ${bajas} por debajo de 5k · ${fuera} fuera del mapa · ${mar} en mar · ${yerma} en yermo`);
console.log(`  mayores: ${out.slice(0,10).map(c=>c[0]+" "+(c[3]/1000)+"k").join(" · ")}`);

const head=`// cities1444.js — ciudades REALES del mapa hacia 1444, con su poblacion historica.
// [nombre, x, y, habitantes, ano_de_la_cifra] ordenadas por poblacion desc. Sustituye al sorteo (S.rand()<0.06) que
// decidia que provincia era urbana: ahora una provincia es CIUDAD porque alli habia una ciudad.
//
// FUENTES (via el cronista, ver design/epoca/): Buringh 2021 (DANS, CC0, 2.262 ciudades) + Bosker,
// Buringh & van Zanden 2013 (Harvard Dataverse) + Chandler 1987 geocodificado (Reba/Reitsma/Seto).
// Poblacion = la de 1450 (Chandler) si existe, si no la de 1400. NUNCA la de 1500: la recuperacion
// europea arranca hacia 1450-70 y 1444 sigue en el hoyo de la Peste — con 1500, Estambul saldria a
// 200k cuando en 1444 era una ruina pre-1453 (45k) y Edirne a 127k cuando apenas despegaba.
// Umbral 5.000 hab: nuestra plaza es el mercado REGIONAL (radio ~85 km), no el semanal de aldea
// (radio real 5-11 km segun Bracton y el Gazetteer ingles), y ese lo lidera una ciudad de >=5k.
//
// EL 5o CAMPO ES EL ANO DE LA CIFRA (1400 o 1450), y hay que respetarlo: solo 44 de las 319 tienen
// dato de 1450, y la mediana del salto 1450/1400 es x1,6 — asi que las cifras de 1450 NO son
// comparables sin mas con las de 1400. Para el flag de ciudad da igual (el umbral lo pasan las dos),
// pero si algun dia la poblacion mueve una mecanica, normaliza por el ano antes de comparar.
//
// AVISO DE SESGO: estas bases se hicieron para estudiar la urbanizacion EUROPEA. Rusia, la estepa,
// Escandinavia, Persia y el Levante estan infrarrepresentados (Persia tiene 7 ciudades en todo el
// fichero; el Levante, 4). Por eso el sembrado NO usa solo esto: MAPDATA.cities (curadas a mano)
// actua de SUELO donde el dataset no ve nada. Ver seedCities() en mapgen.js.
// Regenerar: tools/gen-cities.mjs
const CITIES1444=[`;
const body=out.map(c=>`["${c[0].replace(/"/g,'\\"')}",${c[1]},${c[2]},${c[3]},${c[4]}]`).join(",\n");
fs.writeFileSync(base+"cities1444.js",head+"\n"+body+"];\n","utf8");
console.log(`\nEscrito call-of-war/cities1444.js (${out.length} ciudades)`);
