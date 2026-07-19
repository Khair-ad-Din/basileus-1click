// serve.mjs — servidor estático de DESARROLLO SIN CACHÉ para Basileus. Reemplaza a
// `python -m http.server`, que cacheaba y hacía ver versiones viejas de official_map.js/places.js/
// módulos ES al recargar (había que Ctrl+Shift+R). Manda `Cache-Control: no-store` en TODO, así que
// cada recarga sirve lo último — datos Y módulos. Sin dependencias.
//   Uso:  node tools/serve.mjs            (raíz = cwd, puerto 8123)  ->  http://localhost:8123/call-of-war/
//         node tools/serve.mjs <root> <puerto>
import http from "http";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.argv[2] || ".");
const PORT = +(process.argv[3] || 8123);
const MIME = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".gif":"image/gif", ".webp":"image/webp",
  ".bmp":"image/bmp", ".ico":"image/x-icon", ".woff":"font/woff", ".woff2":"font/woff2", ".ttf":"font/ttf",
  ".map":"application/json", ".txt":"text/plain; charset=utf-8", ".wasm":"application/wasm",
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end("403"); return; } // sin ../ fuera de la raíz
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, {"Content-Type":"text/plain"}); res.end("404 " + rel); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1", () => console.log(`serve (SIN CACHÉ) en http://localhost:${PORT}/  ·  raíz ${ROOT}`));
