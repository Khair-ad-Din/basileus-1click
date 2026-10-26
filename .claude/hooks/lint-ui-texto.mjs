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
if (!nuevo) process.exit(0);

// REGLAS DE ESTRUCTURA (Sergio, 2026-10-26; design/ux/guia-estilo.md §1b): nada de "·" como separador y nada de
// iconos Unicode (emoji, flechas, ▲▼, ✖, ■…) en lo que pinta la interfaz. Se miran solo las líneas de código, sin
// los comentarios (en los comentarios el "·" y las flechas son legítimos).
{
  const codigo = nuevo.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .map(l => l.replace(/(^|[\s;{}),])\/\/ .*$/, "$1")).join("\n");
  const ICON = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}]/gu;
  const puntos = (codigo.match(/·/g) || []).length, iconos = [...new Set(codigo.match(ICON) || [])];
  if (puntos || iconos.length) {
    console.error([
      `AVISO UI — reglas de estructura (guia-estilo.md §1b) en ${fp}`,
      ...(puntos ? [`  · ${puntos} uso(s) de "·" como separador: prohibido. Usa columnas, filas o rejilla (tipBox, .tipGrid).`] : []),
      ...(iconos.length ? [`  · iconos Unicode: ${iconos.slice(0, 12).join(" ")} — prohibidos. Sprite si existe (resImg/uiIcon);`,
        `    si no, el hueco ph("nombre") ("[ ]"). Flechas y marcas de estado, en CSS.`] : []),
      `Si es un falso positivo (no lo ve el jugador), ignora el aviso.`].join("\n"));
    process.exit(2);
  }
}
if (nuevo.length < 100) process.exit(0);

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
