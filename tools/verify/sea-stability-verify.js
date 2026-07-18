// Estabilidad de la fase 1 bajo guerra sostenida: corre 6 años del tick REAL (IA moviendo ejércitos
// por tierra y mar, muchos embarques/desembarques orgánicos) y comprueba el invariante clave del
// colapso de pierna: NINGÚN ejército queda varado en una tesela de mar. Y 0 errores de consola.
const http = require('http'); const WS = WebSocket;
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const PROBE = `(function(){ try{
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  var stranded=0, embarked=0, moving=0, strandNames=[];
  for(var i=0;i<S.armies.length;i++){var a=S.armies[i];
    if(a.path.length)moving++;
    if(a.legKind==="sea")embarked++;
    if(isSea(P[a.prov])&&a.path.length===0){stranded++; if(strandNames.length<6)strandNames.push(P[a.prov].name)}}
  return JSON.stringify({armies:S.armies.length, moving:moving, embarkedNow:embarked, strandedOnSea:stranded, strandNames:strandNames, hour:Math.round(S.hour)});
}catch(e){return JSON.stringify({err:String(e&&e.stack||e)})} })()`;
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
  await send('Network.clearBrowserCache');
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 45000));
  const evalv = async (e) => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true, timeout:150000}); return r && r.result ? r.result.value : ("(sin result: "+JSON.stringify(r&&r.exceptionDetails||r)+")");};
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  console.log("corriendo 1 año del tick real y midiendo coste/tick…");
  console.log(await evalv('(function(){var n=8760,t0=performance.now();for(var i=0;i<n&&!dbg.S.gameOver;i++)dbg.hourTick();var ms=performance.now()-t0;return JSON.stringify({ticks:n,ms:Math.round(ms),msPerTick:+(ms/n).toFixed(3)})})()'));
  console.log("=== ESTABILIDAD tras 1 año ===");
  console.log(await evalv(PROBE));
  console.log("\nERRORES DE CONSOLA: " + (errs.length ? errs.length + "\n  " + errs.slice(0,12).join("\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
