// tools/gen-cities1444.mjs — regenera cities1444.js como FUENTE ÚNICA del núcleo urbano, con las
// poblaciones de ~1450 RECONCILIADAS a mano por el consejo de cronistas (Tanda B, ver
// design/pops-1450/region-NN.md y design/pops-1450-metodo.md). Sustituye al antiguo gen-cities.mjs
// (GeoNames), que ya NO debe re-ejecutarse: estas cifras son curadas, no derivadas.
//
// Entrada: design/pops-1450/data/_cores-flat.json (318 núcleos parseados de las fichas) + 3 añadidas
// (Palermo/Messina/Cagliari, que no venían en cities1444) + renombres del cubo A (era equivocada).
// Salida: call-of-war/cities1444.js con formato [canon, x, y, hab_1450, 1450, confianza(A-D)].
//
//   node tools/gen-cities1444.mjs           (simulacro: informa, no escribe)
//   node tools/gen-cities1444.mjs --write   (escribe cities1444.js, backup .bak)
import fs from "fs"; import path from "path";
import { fileURLToPath } from "url";
const base=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const url=p=>"file:///"+path.join(base,p).replace(/\\/g,"/");
const DESIGN=path.join(base,"..","design","pops-1450");
const WRITE=process.argv.includes("--write");

function loadGlobal(file,name){let t=fs.readFileSync(path.join(base,file),"utf8").replace(/\r\n/g,"\n");t=t.replace(new RegExp("^const\\s+"+name+"\\s*=","m"),"globalThis."+name+"=");(0,eval)(t);}
loadGlobal("mapdata.js","MAPDATA");loadGlobal("places.js","PLACES");loadGlobal("official_map.js","OFFICIAL_MAP");
const cfg=await import(url("js/config.js"));const mg=await import(url("js/mapgen.js"));
const {MW,MH}=cfg;

// reconstrucción mínima solo para coords/lonlat (hallar la provincia de las 3 añadidas)
const snap=OFFICIAL_MAP;
const provs=snap.provs.map((a,i)=>({id:i,x:a[1],y:a[2]}));
const nearestXY=(lon,lat)=>{
  let best=null,bd=1e9;
  for(const p of provs){const[lo,la]=mg.pxToLonLat(p.x,p.y);const d=(lo-lon)**2+(la-lat)**2;if(d<bd){bd=d;best=p}}
  return[best.x,best.y];
};

// --- núcleos reconciliados ---
const flat=JSON.parse(fs.readFileSync(path.join(DESIGN,"data","_cores-flat.json"),"utf8"));
// CUBO A: renombres de canon por era equivocada (los demás cubos B/C van en un pase posterior)
const RENAME_A={ "Fustat":"Cairo", "Kaliningrad":"Konigsberg", "Gorkij":"Nizhny Novgorod",
  "Feodosija":"Caffa", "Sudak":"Soldaia", "Astrakan":"Hajji Tarkhan" };
let cities=flat.map(c=>({canon:RENAME_A[c.canon]||c.canon,x:c.x,y:c.y,pop:c.pop,conf:c.conf}));
// --- 3 añadidas (no estaban en cities1444; fuente: design/pops-1450/region-03.md) ---
const add=[
  {name:"Palermo",lon:13.36,lat:38.11,pop:30000,conf:"B"},
  {name:"Messina",lon:15.55,lat:38.19,pop:22000,conf:"C"},
  {name:"Cagliari",lon:9.11,lat:39.22,pop:5100,conf:"B"},
];
for(const a of add){const[x,y]=nearestXY(a.lon,a.lat);cities.push({canon:a.name,x,y,pop:a.pop,conf:a.conf})}

// --- CENTROS DE COMERCIO DEL ESTE (Capa 2, design/mercado-centros-eu5.md) ---
// Pop AHISTÓRICA elevada al umbral de centro (CENTER_POP=25.000). Decisión de Sergio (2026-07-21): "no
// centros fantasma" — un centro es una ciudad que LLEGA al umbral, no una excepción por función. Estos
// 10 eran entrepôts reales de ~1450 (Hansa oriental, repúblicas rusas, Volga, mar Negro) pero por debajo
// de 25k; se suben para que cumplan ciudad(≥5k)+centro(≥25k) por la regla normal. Las cifras HISTÓRICAS
// verificadas (Danzig ~20k, Riga ~8k, Tana ~5k…) quedan en design/pops-1450/centros-este.md; aquí manda
// el gameplay. conf="D" lo marca como horquilla/gameplay, no cita académica.
const EAST_POP=25000;
const eastBump=new Set(["Gdansk","Pskov","Smolensk","Riga","Kazan","Hajji Tarkhan","Trebisonda"]); // ya existían
let bumped=0;for(const c of cities)if(eastBump.has(c.canon)){c.pop=EAST_POP;c.conf="D";bumped++}
const eastAdd=[  // no existían como núcleo (<5k, pop 0): se AÑADEN. x,y = centroide de su provincia (verificado).
  {canon:"Lviv", x:1039,y:958,  pop:EAST_POP,conf:"D"},   // prov "Leópolis" #2927
  {canon:"Reval",x:1070,y:467,  pop:EAST_POP,conf:"D"},   // prov "Reval" #1399
  {canon:"Tana", x:1494,y:1092, pop:EAST_POP,conf:"D"},   // prov "Azov" #3414 (Tana, factoría veneciana del Don)
  // Fantasmas del OESTE: estaban como centro solo por la lista curada, a pop 0. Mismo principio (un centro
  // es una ciudad que llega al umbral): se suben a 25k y salen de CURATED_HUBS. Dubrovnik = Ragusa dálmata
  // (rep. mercantil real); Santiago (peregrinación) y Dover (=Canterbury, peregrinación) son los más
  // ahistóricos del lote. Lübeck/Krakow/Augsburg SÍ siguen en la curada (ciudades reales de ~15-20k).
  {canon:"Dubrovnik",x:867,y:1248, pop:EAST_POP,conf:"D"}, // prov "Dubrovnik" #3950
  {canon:"Santiago", x:80, y:1257, pop:EAST_POP,conf:"D"}, // prov "Santiago" #3906
  {canon:"Dover",    x:379,y:920,  pop:EAST_POP,conf:"D"}, // prov "Dover" #2774 (Canterbury)
];
for(const a of eastAdd)cities.push(a);
console.log(`Centros a ${EAST_POP}: ${bumped} subidos + ${eastAdd.length} añadidos (ahistórico, ver centros-este.md)`);

cities.sort((a,b)=>b.pop-a.pop);

console.log("Núcleos totales:",cities.length,"(318 reconciliados + 3 añadidos)");
console.log("Renombres cubo A aplicados:",Object.entries(RENAME_A).map(([a,b])=>a+"→"+b).join(", "));
console.log("Añadidas:",add.map(a=>a.name+"("+a.pop+")").join(", "));
const ge5=cities.filter(c=>c.pop>=5000).length;
console.log("≥5000 (ciudad):",ge5," · <5000 (rural salvo capital):",cities.length-ge5);

const rows=cities.map(c=>`[${JSON.stringify(c.canon)},${c.x},${c.y},${c.pop},1450,${JSON.stringify(c.conf)}]`).join(",\n");
const header=`// cities1444.js — nucleo urbano de cada ciudad hacia ~1450, RECONCILIADO a mano (Tanda B, 2026-07-19).
// Formato: [canon, x, y, hab_1450, ano(=1450, ya normalizado), confianza(A|B|C|D)].
// FUENTE UNICA del nucleo urbano (retira la antigua tabla CITY_POP de mapgen.js). Cada cifra viene de
// la verificacion historica por region en design/pops-1450/region-NN.md (jerarquia de fuentes del
// metodo design/pops-1450-metodo.md): cifra academica ~1450 manda; si no, reconciliacion con Buringh
// sobre Chandler + techo de cordura (nada latino >50k en 1450 salvo Cairo/Paris/Venecia/Milan/Napoles).
// Confianza: A=cita academica dura · B=abierta no arbitrada · C=resumen de buscador · D=horquilla sin
// dato directo (sobre todo el Este: Anatolia interior, Persia, Levante, Magreb).
// NO regenerar con el viejo gen-cities.mjs (GeoNames): estas cifras son curadas. Para re-ensamblar tras
// editar las fichas: tools/gen-cities1444.mjs.
const CITIES1444=[
${rows}
];
`;
if(!WRITE){console.log("\n(simulacro; usa --write para escribir cities1444.js)");process.exit(0)}
const out=path.join(base,"cities1444.js");
fs.copyFileSync(out,out+".bak");
fs.writeFileSync(out,header,"utf8");
console.log("\nEscrito cities1444.js ("+cities.length+" núcleos) · backup .bak");
