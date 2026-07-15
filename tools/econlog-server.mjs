// econlog-server.mjs — recolector del LOG ECONÓMICO de Basileus.
//
// El juego (main.js, startEconLog) acumula una foto mensual en S.econLog y cada 2 s POSTea las nuevas
// a este recolector, que las va añadiendo a un fichero .jsonl que Claude puede leer EN VIVO mientras
// Sergio juega. Así se diagnostica la economía con el tick REAL (IA, guerras, construcción) y a la
// velocidad que él quiera, en vez de con un arnés sintético.
//
//   node tools/econlog-server.mjs                  → escribe en tools/econlog.jsonl
//   node tools/econlog-server.mjs mi-partida.jsonl → nombre propio
//
// En el juego: consola (F12) → startEconLog()   ·   o el botón del panel.
// Fallback sin recolector: downloadEconLog() descarga el .jsonl.
//
// Formato: una línea JSON por mes. Ver logEconMonth() en call-of-war/js/economy.js para el esquema
// (v2). ⚠ Al leerlo: mira `desp` (llenado de despensas) ANTES de concluir nada sobre el mercado —
// con desp<1 el grano aún está llenando las despensas locales y NADIE comercia: es calentamiento.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(DIR, process.argv[2] || "econlog.jsonl");
const PORT = 8124;

let lineas = 0;
if (fs.existsSync(FILE)) {
  lineas = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).length;
  console.log(`Continuando un log que ya tenía ${lineas} meses. Para empezar de cero, borra el fichero`);
  console.log(`o usa clearEconLog() en la consola del juego y otro nombre de fichero.`);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  if (req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 8e6) req.destroy(); });
    req.on("end", () => {
      const nuevas = body.split("\n").filter(Boolean);
      if (nuevas.length) {
        fs.appendFileSync(FILE, nuevas.join("\n") + "\n");
        lineas += nuevas.length;
        // Enseña el último mes recibido: así se ve el avance sin abrir el fichero.
        let cola = "";
        try {
          const x = JSON.parse(nuevas[nuevas.length - 1]);
          cola = `  ${x.d}  desp=${x.desp}  cos=${x.cos}  duc=${x.duc}  fam=${x.fam}`;
        } catch {}
        console.log(`+${nuevas.length} mes(es) → ${lineas} total.${cola}`);
      }
      res.writeHead(200, { ...CORS, "Content-Type": "text/plain" });
      res.end("ok");
    });
    return;
  }

  // GET = health check (lo usa startEconLog para avisar si el recolector no está)
  res.writeHead(200, { ...CORS, "Content-Type": "text/plain" });
  res.end(`recolector vivo · ${lineas} meses · ${FILE}`);
}).listen(PORT, () => {
  console.log(`Recolector de log económico escuchando en http://localhost:${PORT}`);
  console.log(`Escribiendo en: ${FILE}`);
  console.log(`En el juego: consola (F12) → startEconLog()`);
});
