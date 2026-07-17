// Verifica el volcado de orografia de EU4 (fase 0) en el juego VIVO: distribucion de terreno,
// meseta presente, paramos, errores de consola, y el toggle setSprinkle (variante B). Saca capturas.
const http = require('http'); const WS = WebSocket; const fs = require('fs');
const OUT = process.argv[2] || '.';
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const DIST = `(function(){
  var P=dbg.S.provs, terr={}, paramo=0, nullt=0, meseta=0;
  for(var i=0;i<P.length;i++){var p=P[i];
    if(p.terrain==="mar")continue;
    if(p.wasteland){paramo++;continue}
    if(p.terrain==null){nullt++;continue}
    terr[p.terrain]=(terr[p.terrain]||0)+1; if(p.terrain==="meseta")meseta++;}
  var lines=["provincias por terreno:"];
  Object.keys(terr).sort(function(a,b){return terr[b]-terr[a]}).forEach(function(k){lines.push("  "+k+": "+terr[k])});
  lines.push("paramo: "+paramo+" · null: "+nullt+" · MESETA: "+meseta);
  return lines.join("\\n");
})()`;
(async () => {
  const errs = [];
  const t = (await cdp()).find(x => x.type === 'page') || (await cdp())[0];
  const ws = new WS(t.webSocketDebuggerUrl);
  let id = 0; const pend = {};
  const send = (m,p) => new Promise(r => {const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method:m, params:p||{}}))});
  ws.onmessage = ev => {const o = JSON.parse(ev.data);
    if (o.id && pend[o.id]) {pend[o.id](o.result); delete pend[o.id]}
    if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') errs.push(o.params.args.map(a=>a.value||a.description||'').join(' '));
    if (o.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (o.params.exceptionDetails.exception && o.params.exceptionDetails.exception.description || o.params.exceptionDetails.text));
  };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 45000));
  const evalv = async (e) => (await send('Runtime.evaluate', {expression:e, returnByValue:true})).result.value;
  // cerrar el menu de inicio entrando en modo observador, y poner vista de terreno
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 1500));
  await evalv('typeof toggleTerrainView==="function" && !dbg.S.terrainView ? (toggleTerrainView(),1):1');
  await new Promise(r => setTimeout(r, 1500));
  console.log("=== VARIANTE A (EU4 puro) ===");
  console.log(await evalv(DIST));
  const shot = async (name) => { const d = await send('Page.captureScreenshot', {format:'png'}); fs.writeFileSync(OUT+'/'+name, Buffer.from(d.data,'base64')); console.log('captura -> '+name); };
  await shot('terreno-A-puro.png');
  // toggle salpicado
  const msg = await evalv('typeof setSprinkle==="function" ? setSprinkle(true) : "NO setSprinkle"');
  console.log("\\nsetSprinkle(true) => " + msg);
  await new Promise(r => setTimeout(r, 2500));
  console.log("=== VARIANTE B (salpicado) ===");
  console.log(await evalv(DIST));
  await shot('terreno-B-salpicado.png');
  console.log("\\nERRORES DE CONSOLA: " + (errs.length ? errs.length + "\\n  " + errs.slice(0,10).join("\\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
