// Aísla el coste de rendimiento de la fase 1: ¿el coste por tick lo domina el pathfinding (mi Dijkstra
// unificado) o el tick económico de 6131 provincias? Mide coste/tick, coste de un pathfind LARGO por
// mar (Valencia→Venecia) y de uno CORTO por tierra, sin avanzar mucho el reloj.
const http = require('http'); const WS = WebSocket;
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const PERF = `(function(){ try{
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  function ll(p){return dbg.pxToLonLat(p.x,p.y)}
  function nearest(tlon,tlat){var best=-1,bd=1e18;for(var i=0;i<P.length;i++){var p=P[i];
    if(isSea(p)||p.wasteland||!p.coastal)continue;var c=ll(p),dx=c[0]-tlon,dy=c[1]-tlat,d=dx*dx+dy*dy;if(d<bd){bd=d;best=i}}return best}
  var A=nearest(-0.37,39.47), B=nearest(12.33,45.44);   // Valencia, Venecia (larga, por mar)
  var owner=P[A].owner; var army=dbg.spawnArmy(owner,A,{miliciano:6});
  // vecino de tierra cercano a A (corta)
  var Cnear=-1; for(var x of S.adj[A]){ if(!isSea(P[x])&&!P[x].wasteland){Cnear=x;break} }
  function timeIt(fn,n){var t0=performance.now();for(var i=0;i<n;i++)fn();return +( (performance.now()-t0)/n ).toFixed(4);}
  var longMs = timeIt(function(){dbg.bfsPath(A,B,null,army)}, 200);
  var shortMs= Cnear>=0 ? timeIt(function(){dbg.bfsPath(A,Cnear,null,army)}, 500) : -1;
  var tickMs = timeIt(function(){dbg.hourTick()}, 300);
  return JSON.stringify({tickMs:tickMs, pathLongSeaMs:longMs, pathShortLandMs:shortMs, armies:S.armies.length, hour:Math.round(S.hour)});
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
    if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') errs.push(o.params.args.map(a=>a.value||a.description||'').join(' '));
  };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true}); await send('Network.clearBrowserCache');
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 45000));
  const evalv = async (e) => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true, timeout:120000}); return r && r.result ? r.result.value : ("(sin result)");};
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  console.log("=== RENDIMIENTO (coste medio por llamada) ===");
  console.log(await evalv(PERF));
  console.log("\nERRORES: " + (errs.length ? errs.slice(0,8).join("\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
