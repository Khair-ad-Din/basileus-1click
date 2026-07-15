#!/usr/bin/env node
// PostToolUse (Write|Edit) — Regla permanente de Sergio: en la UI de Basileus NO va texto
// explicativo visible. Todo texto largo se esconde tras una "i" (iInfo/data-tip/data-tiph).
//
// Solo mira lo que se ACABA de escribir (new_string/content), nunca el archivo entero: asi no
// vuelve a gritar por las violaciones historicas que ya estan inventariadas en la guia de UX.
//
// Avisa (exit 2 = el aviso llega a Claude). NUNCA bloquea el trabajo: la edicion ya ocurrio.
// Calla si todo esta bien.

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try { input = JSON.parse(raw); } catch { process.exit(0); }

const fp = (input?.tool_input?.file_path || "").replace(/\\/g, "/");

// Solo archivos que PINTAN interfaz.
if (!/call-of-war\/(js\/(ui|editor|main)\.js|index\.html)$/.test(fp)) process.exit(0);

const nuevo = input?.tool_input?.new_string ?? input?.tool_input?.content ?? "";
if (!nuevo || nuevo.length < 100) process.exit(0);

// 1) Vaciar los valores de atributo: ahi es DONDE DEBE vivir el texto largo (data-tip, title...).
//    Si no, marcariamos como violacion justo lo que es la solucion correcta.
let s = nuevo
  .replace(/([\w-]+)\s*=\s*"[^"]*"/g, '$1=""')
  .replace(/([\w-]+)\s*=\s*'[^']*'/g, "$1=''");

// 2) Vaciar los helpers que ESCONDEN texto tras una "i": iInfo("...") y ta("..."). Su contenido
//    es la solucion, no el problema. (Sin esto, marcabamos justo lo que queremos que se haga.)
s = s.replace(/\b(iInfo|ta)\s*\(\s*(["'`])(?:\\.|(?!\2)[\s\S])*\2\s*\)/g, " ¤ ");

// 3) Las interpolaciones no son prosa.
s = s.replace(/\$\{[^}]*\}/g, " ¤ ");

// 3) Nodos de texto de HTML: lo que queda entre > y <  es lo que el jugador LEE en pantalla.
const hallazgos = [];
for (const m of s.matchAll(/>([^<>]{100,})</g)) {
  const txt = m[1].replace(/\s+/g, " ").trim();
  if (txt.length < 100) continue;

  const palabras = txt.split(/\s+/).filter(w => w.length > 1);
  if (palabras.length < 15) continue;                       // cifras y etiquetas, no prosa

  const letras = (txt.match(/[a-záéíóúñüA-ZÁÉÍÓÚÑÜ ,.;:¿?¡!()-]/g) || []).length;
  if (letras / txt.length < 0.85) continue;                 // codigo o datos, no prosa

  if ((txt.match(/¤/g) || []).length > 2) continue;    // plantilla de datos, no parrafo

  hallazgos.push(txt.length > 120 ? txt.slice(0, 117) + "..." : txt);
  if (hallazgos.length >= 3) break;
}

if (!hallazgos.length) process.exit(0);

const err = [
  `AVISO UI — texto explicativo visible en ${fp}`,
  ``,
  `Regla permanente de Sergio: la interfaz debe ser intuitiva GRAFICAMENTE, no explicativa con`,
  `texto. Nada de descripciones, parrafos ni subtitulos que expliquen para que sirve una ventana.`,
  `Lo indispensable va escondido tras una "i": iInfo("...") o data-tip / data-tiph.`,
  ``,
  `Detectado:`,
  ...hallazgos.map((h, i) => `  ${i + 1}. "${h}"`),
  ``,
  `Si es prosa que ve el jugador -> metela en iInfo(...) o resuelvelo con diseno (iconos, escudos,`,
  `afordancias). Excepciones legitimas: #helpOverlay (la ayuda) y los valores de data-tip.`,
  `Si es un falso positivo, ignora este aviso y sigue.`,
].join("\n");

console.error(err);
process.exit(2);
