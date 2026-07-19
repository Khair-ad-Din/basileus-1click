// gen-places.mjs — regenera call-of-war/places.js (gazetteer de topónimos) desde un volcado de
// GeoNames, CURADO para ~1444: filtra barrios/arrondissements (feature code PPLX), asentamientos
// modernos (STLMT), formas de nombre modernas (dígitos, sufijos administrativos), aplica una
// blocklist de fundaciones post-1444 y una tabla de EXÓNIMOS de época (modern -> 1444). Proyección
// Mercator idéntica a la del juego (mapgen.js pxToLonLat). Uso:
//   1) descargar  https://download.geonames.org/export/dump/cities1000.zip  y descomprimir
//   2) node tools/gen-places.mjs <ruta/cities1000.txt> [ruta/exonimos-1444.json]
// Sin el JSON de exónimos hace solo el filtro mecánico (útil para ver el resultado antes de curar).
import fs from "fs";

const SRC = process.argv[2];
const EXO = process.argv[3];
if (!SRC || !fs.existsSync(SRC)) { console.error("Falta el volcado de GeoNames (cities1000.txt). Uso: node tools/gen-places.mjs <cities1000.txt> [exonimos.json]"); process.exit(1); }

const G = { WEST:-11, EAST:50, SOUTH:27, NORTH:66.5 }, MW=1813, MH=1840;
const yn = Math.log(Math.tan(Math.PI/4 + G.NORTH*Math.PI/360));
const ys = Math.log(Math.tan(Math.PI/4 + G.SOUTH*Math.PI/360));
function proj(lon, lat){
  const x = Math.round((lon - G.WEST)/(G.EAST - G.WEST)*MW);
  const my = Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));
  const y = Math.round((yn - my)/(yn - ys)*MH);
  return [x, y];
}

// normaliza para comparar sin acentos ni mayúsculas (GeoNames romaniza con diacríticos variables:
// İzmir/Izmir, Ḩalab, Sevastopol'… — aviso del cronista)
const norm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[’']/g,"'").trim();
// exónimos + blocklist (curación histórica del cronista). Se indexan además NORMALIZADOS.
let exonyms = {}, exoNorm = new Map(), blocklist = new Set();
if (EXO && fs.existsSync(EXO)) {
  const j = JSON.parse(fs.readFileSync(EXO, "utf8"));
  exonyms = j.exonyms || {};
  for (const [k,v] of Object.entries(exonyms)) exoNorm.set(norm(k), v);
  for (const b of (j.blocklist || [])) blocklist.add(norm(b));
}

// feature codes a DESCARTAR: PPLX=barrio/sección (arrondissements), STLMT=asentamiento (moderno,
// Israel), PPLW=destruido, PPLQ=abandonado. Se mantienen PPL/PPLA*/PPLC/PPLL/PPLG/PPLF/PPLR/PPLH.
const DROP_FC = new Set(["PPLX","STLMT","PPLW","PPLQ"]);
// TECHO DE POBLACIÓN: las ciudades grandes ya las nombran las capas curadas del juego (217 ciudades
// de MAPDATA + 319 de CITIES1444). Todo lo que supere este techo en GeoNames es o una de esas (ya
// cubierta) o una metrópolis/suburbio MODERNO (Montreuil, Shubrā al Khaymah, Casablanca…) que gana la
// provincia vecina por su población de hoy. Tirándolas de aquí, el relleno rural se queda con las
// VILLAS pequeñas, que son las auténticamente medievales. Los exónimos (Constantinopla…) se aplican
// ANTES del techo para no perder los que sí queremos por su pop moderno.
const MAX_POP = 45000;
// patrones de nombre MODERNO (administrativos): dígitos, arrondissements, sufijos de aglomeración.
const MODERN = /(\d|Arrondissement|Cedex| Oblast| Raion|Raión| Sector\b|Settlement| Municipality)/i;
const MODERN_SUFFIX = /(-sur-|-lès-|-les-|-en-|-la-|La Vallée|-le-Grand|-le-Petit|-sous-|-devant-)/i;
const LATIN = /^[ -ɏḀ-ỿ'’\-\.\/\(\) ]+$/; // ¿alfabeto latino (con diacríticos)?

const lines = fs.readFileSync(SRC, "utf8").split("\n");
const cand = []; // {name,x,y,pop}
let seenBox=0, dropFC=0, dropModern=0, dropBlock=0, dropProj=0, dropHigh=0;

for (const ln of lines) {
  if (!ln) continue;
  const c = ln.split("\t");
  const lat=+c[4], lon=+c[5], fc=c[7], pop=+c[14]||0;
  if (!(lat>=G.SOUTH && lat<=G.NORTH && lon>=G.WEST && lon<=G.EAST)) continue;
  seenBox++;
  if (DROP_FC.has(fc)) { dropFC++; continue; }
  // NOMBRE CANÓNICO (inglés/GeoNames). Los exónimos de época NO se aplican aquí: el juego guarda el
  // canónico y localiza en runtime con la tabla EXONYMS (call-of-war/exonyms.js). Las ciudades grandes
  // (notables, con exónimo) las nombran las capas curadas (CITIES1444/MAPDATA); el techo de población
  // las tira de aquí para que este relleno rural se quede con las villas pequeñas auténticas.
  let name = c[1] || c[2];
  if (pop > MAX_POP) { dropHigh++; continue; }
  if (!LATIN.test(name)) name = c[2]; // romanizar: usar asciiname
  if (MODERN.test(name) || MODERN_SUFFIX.test(name)) { dropModern++; continue; }
  if (blocklist.has(norm(name)) || blocklist.has(norm(c[1])) || blocklist.has(norm(c[2]))) { dropBlock++; continue; }
  const [x,y] = proj(lon, lat);
  if (x<0||y<0||x>=MW||y>=MH) { dropProj++; continue; }
  cand.push({ name, x, y, pop });
}

// dedup por nombre final: se queda el más poblado (para no repetir topónimo)
const byName = new Map();
for (const p of cand) { const e = byName.get(p.name); if (!e || p.pop > e.pop) byName.set(p.name, p); }
const out = [...byName.values()].sort((a,b)=> b.pop - a.pop); // orden por población desc (importantes primero)

const body = out.map(p => `["${p.name.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}",${p.x},${p.y}]`).join(",");
const header = `// places.js — gazetteer de ${out.length} topónimos CANÓNICOS (GeoNames cities1000 CURADO para ~1444:\n`+
  `// sin barrios/arrondissements (PPLX), sin formas modernas, con techo de población y blocklist de\n`+
  `// fundaciones post-1444). Romanizados, proyectados al pixel del mapa: [nombre,x,y]. Orden por\n`+
  `// población desc. La localización (exónimos español) va aparte en call-of-war/exonyms.js, en runtime.\n`+
  `// Regenerar: node tools/gen-places.mjs <cities1000.txt> tools/exonimos-1444.json\n`;
fs.writeFileSync("call-of-war/places.js", header + `const PLACES=[${body}];\n`);

console.error(`en la caja: ${seenBox} | descartados: FC=${dropFC} pop>${MAX_POP}=${dropHigh} modernos=${dropModern} blocklist=${dropBlock} proj=${dropProj}`);
console.error(`topónimos finales canónicos (dedup): ${out.length}`);
console.error(`top 25: ${out.slice(0,25).map(p=>p.name).join(", ")}`);
