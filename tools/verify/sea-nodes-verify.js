// Verifica la FASE 1 (conexión marítima por nodos, opción B) en el juego VIVO:
//  - 0 errores de consola tras la gran refactorización de S.seaAdj / pathfinding / mercado
//  - integridad del grafo: navAdj cubre la costa, S.seaAdj apunta a TESELAS de mar (no a costeras),
//    el mercado quedó asignado (marketOf) y las teselas de mar transportaron fuente
//  - demostración de una travesía embarcada: ruta óptima Valencia→Venecia (embarca→navega→desembarca)
const http = require('http'); const WS = WebSocket;
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}

const PROBE = `(function(){
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  // --- integridad del grafo ---
  var coast=0, navCov=0, seaAdjToSea=0, seaAdjTotal=0, seaAdjToLand=0;
  for(var i=0;i<P.length;i++){var p=P[i];
    if(isSea(p)||p.wasteland)continue;
    if(!p.coastal)continue; coast++;
    if(S.navAdj[i] && S.navAdj[i].size>0)navCov++;
    S.seaAdj[i].forEach(function(q){seaAdjTotal++; if(isSea(P[q]))seaAdjToSea++;});
  }
  var seaTiles=0, seaTileWithLand=0;
  for(var i=0;i<P.length;i++){if(!isSea(P[i]))continue; seaTiles++;
    var hasLand=false; S.seaAdj[i].forEach(function(q){if(!isSea(P[q]))hasLand=true;}); if(hasLand)seaTileWithLand++;}
  // --- mercado ---
  var landNoMkt=0, landMkt=0, seaCarry=0;
  for(var i=0;i<P.length;i++){var p=P[i];
    if(isSea(p)){ if(p.marketOf>=0)seaCarry++; continue; }
    if(p.wasteland||p.owner>=dbg.S.provs.length)continue; // (todo dueño real; el filtro fino no importa aquí)
    if(p.marketOf>=0)landMkt++; else landNoMkt++;
  }
  return JSON.stringify({coast:coast, navCov:navCov, seaAdjTotal:seaAdjTotal, seaAdjToSea:seaAdjToSea,
    seaTiles:seaTiles, seaTileWithLand:seaTileWithLand, landMkt:landMkt, landNoMkt:landNoMkt, seaCarry:seaCarry});
})()`;

// Dijkstra UNIFICADO inline (coste = distancia px, tramo de mar ×0.4) para demostrar la travesía.
const ROUTE = `(function(){
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  function ll(p){ return dbg.pxToLonLat ? dbg.pxToLonLat(p.x,p.y) : [p.x,p.y]; }
  // localizar la costera de tierra más cercana a un lon/lat objetivo
  function nearest(tlon,tlat){var best=-1,bd=1e18;
    for(var i=0;i<P.length;i++){var p=P[i]; if(isSea(p)||p.wasteland||!p.coastal)continue;
      var c=ll(p),dx=c[0]-tlon,dy=c[1]-tlat,d=dx*dx+dy*dy; if(d<bd){bd=d;best=i}} return best;}
  var A=nearest(-0.37,39.47), B=nearest(12.33,45.44); // Valencia, Venecia
  function dist(a,b){var dx=P[a].x-P[b].x,dy=P[a].y-P[b].y;return Math.hypot(dx,dy);}
  function edge(a,b){var w=(isSea(P[a])||isSea(P[b]))?0.4:1;return dist(a,b)*w;}
  function nbrs(c){var r=[]; S.adj[c].forEach(function(x){if(!P[x].wasteland)r.push(x)}); S.seaAdj[c].forEach(function(x){if(!P[x].wasteland)r.push(x)}); return r;}
  // Dijkstra
  var D={}, prev={}, seen={}; D[A]=0; var pq=[[0,A]];
  while(pq.length){ pq.sort(function(x,y){return x[0]-y[0]}); var top=pq.shift(), d=top[0], c=top[1];
    if(seen[c])continue; seen[c]=1; if(c===B)break;
    var ns=nbrs(c); for(var k=0;k<ns.length;k++){var nb=ns[k], nd=d+edge(c,nb);
      if(D[nb]===undefined||nd<D[nb]){D[nb]=nd;prev[nb]=c;pq.push([nd,nb])}}}
  if(D[B]===undefined)return JSON.stringify({ok:false, A:A, B:B, nameA:P[A].name, nameB:P[B].name});
  var path=[]; for(var cur=B; cur!==undefined && cur!==A; cur=prev[cur])path.unshift(cur); path.unshift(A);
  var landHops=0, seaHops=0, embarks=0; var terr=[]; var prevSea=false;
  for(var i=0;i<path.length;i++){var s=isSea(P[path[i]]); terr.push(s?"~":"#"); if(i>0){if(s||isSea(P[path[i-1]]))seaHops++; else landHops++; if(s&&!prevSea)embarks++;} prevSea=s;}
  // ruta SOLO por tierra (sin usar teselas de mar) para comparar
  function nbrsLand(c){var r=[]; S.adj[c].forEach(function(x){if(!P[x].wasteland&&!isSea(P[x]))r.push(x)}); return r;}
  var D2={}, seen2={}; D2[A]=0; var pq2=[[0,A]]; var landOnly=false;
  while(pq2.length){pq2.sort(function(x,y){return x[0]-y[0]}); var t=pq2.shift(), d=t[0], c=t[1]; if(seen2[c])continue; seen2[c]=1; if(c===B){landOnly=true;break}
    var ns=nbrsLand(c); for(var k=0;k<ns.length;k++){var nb=ns[k],nd=d+dist(c,nb); if(D2[nb]===undefined||nd<D2[nb]){D2[nb]=nd;pq2.push([nd,nb])}}}
  return JSON.stringify({ok:true, nameA:P[A].name, nameB:P[B].name, hops:path.length-1, landHops:landHops, seaHops:seaHops, embarks:embarks,
    shape:terr.join(""), landOnlyReachable:landOnly});
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
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  // disparar el cálculo del mercado (perezoso: solo corre al abrir la vista Mercados)
  await evalv('typeof setMapView==="function" ? (setMapView("mkt"),1) : "NO setMapView"');
  await new Promise(r => setTimeout(r, 2000));
  console.log("=== INTEGRIDAD DEL GRAFO (tras calcular el mercado) ===");
  console.log(await evalv(PROBE));
  console.log("\n=== TRAVESÍA Valencia→Venecia (demo Dijkstra unificado) ===");
  console.log(await evalv(ROUTE));
  console.log("\nERRORES DE CONSOLA: " + (errs.length ? errs.length + "\n  " + errs.slice(0,12).join("\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
