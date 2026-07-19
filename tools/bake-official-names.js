// Hornea los nombres históricos del gazetteer en call-of-war/official_map.js. Corre
// renameProvincesHistorical() en el juego VIVO (con el places.js curado ya cargado), extrae el
// nombre de cada provincia, y lo escribe en el snapshot (a[0]=name) SIN tocar el flag `named` (a[4]),
// geometría (RLE), dueños, capitales, terreno ni pops. OJO: NO se toca `named` a propósito — la regla
// de carga `wasteland = desierto && !coastal && !named` usa ese flag, y ponerlo a 1 resucitaría las
// provincias del Sáhara profundo (a[8]=null). El nombre se muestra igual con named=0.
// Requisitos: Chrome con --remote-debugging-port=9222 y el juego servido en :8123.
// Uso: node tools/bake-official-names.js
const http = require('http'); const WS = WebSocket; const fs = require('fs');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const EXTRACT = `(function(){ try{
  var S=dbg.S;
  dbg.renameProvincesHistorical();   // aplica el gazetteer (canónico en p.canon, localizado en p.name)
  var caps=S.provs.filter(function(p){return p.capital}).length;
  var named=S.provs.filter(function(p){return p.named}).length;
  // se hornea el CANÓNICO (a[0]); el localizado se deriva en carga con EXONYMS
  return JSON.stringify({ names:S.provs.map(function(p){return [p.canon||p.name, p.named?1:0]}), caps:caps, named:named, n:S.provs.length });
}catch(e){return JSON.stringify({err:String(e&&e.stack||e)})} })()`;
(async () => {
  const errs = [];
  const t = (await cdp()).find(x => x.type === 'page') || (await cdp())[0];
  const ws = new WS(t.webSocketDebuggerUrl);
  let id = 0; const pend = {};
  const send = (m,p) => new Promise(r => {const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method:m, params:p||{}}))});
  ws.onmessage = ev => {const o = JSON.parse(ev.data);
    if (o.id && pend[o.id]) {pend[o.id](o.result); delete pend[o.id]}
    if (o.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (o.params.exceptionDetails.exception && o.params.exceptionDetails.exception.description || o.params.exceptionDetails.text));
  };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true}); await send('Network.clearBrowserCache');
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 45000));
  const evalv = async (e) => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true, timeout:120000}); return r && r.result ? r.result.value : "(sin result)";};
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  const raw = await evalv(EXTRACT);
  ws.close();
  const data = JSON.parse(raw);
  if (data.err) { console.log("FALLO en el juego:", data.err); process.exit(1); }
  console.log(`extraídos ${data.n} nombres | named=${data.named} | capitales=${data.caps} | errores CDP=${errs.length}`);
  // --- parchear official_map.js ---
  const path = "call-of-war/official_map.js";
  let src = fs.readFileSync(path, "utf8");
  const m = src.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
  const obj = eval("(" + m[1] + ")");
  if (obj.provs.length !== data.names.length) { console.log("DESAJUSTE de longitudes:", obj.provs.length, "vs", data.names.length); process.exit(1); }
  let changed = 0;
  for (let i = 0; i < obj.provs.length; i++) {
    const nm = data.names[i][0];
    if (obj.provs[i][0] !== nm) changed++;
    obj.provs[i][0] = nm;      // solo el nombre histórico; a[4] (named) se deja como estaba
  }
  fs.writeFileSync(path, "const OFFICIAL_MAP=" + JSON.stringify(obj) + ";\n");
  console.log(`official_map.js horneado: ${changed} nombres cambiados de ${obj.provs.length}. Tamaño: ${(fs.statSync(path).size/1024/1024).toFixed(2)} MB`);
  process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
