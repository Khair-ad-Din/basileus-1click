// Valida los 4 arreglos del feedback de Sergio sobre la marcha marítima (tesela a tesela + embarque):
//   A) PEAJE DE EMBARQUE: dos costeras adyacentes por tierra NO deben enrutar por el mar.
//   B) TRAVESÍA LARGA: Valencia→Venecia sí va por mar y la tropa ESTÁ en las teselas (per-tile).
//   C) DESCANSO EN EL MAR (punto 2) + REDIRECCIÓN sin teleport (punto 3).
const http = require('http'); const WS = WebSocket;
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const TEST = `(function(){ try{
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  function ll(p){return dbg.pxToLonLat(p.x,p.y)}
  function nearest(tlon,tlat){var best=-1,bd=1e18;for(var i=0;i<P.length;i++){var p=P[i];
    if(isSea(p)||p.wasteland||!p.coastal)continue;var c=ll(p),dx=c[0]-tlon,dy=c[1]-tlat,d=dx*dx+dy*dy;if(d<bd){bd=d;best=i}}return best}
  function noAI(pid){var o=P[pid].owner; if(S.nations[o])S.nations[o].ai=false; return o;}
  S.hour=9000; // pasar el bloqueo inicial de guerra

  // A) peaje de embarque: costera con vecino de TIERRA que también es costera
  var aA=-1,aB=-1;
  for(var i=0;i<P.length&&aA<0;i++){var p=P[i]; if(isSea(p)||p.wasteland||!p.coastal)continue;
    S.adj[i].forEach(function(q){ if(aA<0&&!isSea(P[q])&&!P[q].wasteland&&P[q].coastal){aA=i;aB=q} }); }
  noAI(aA); var armyL=dbg.spawnArmy(P[aA].owner,aA,{miliciano:6});
  dbg.orderMove(armyL,aB);
  var usesSea=false; armyL.path.forEach(function(pid){if(isSea(P[pid]))usesSea=true});
  var A={from:P[aA].name,to:P[aB].name,pathLen:armyL.path.length,usesSea:usesSea};

  // B) travesía larga Valencia->Venecia
  var vA=nearest(-0.37,39.47), vB=nearest(12.33,45.44); noAI(vA);
  var army=dbg.spawnArmy(P[vA].owner,vA,{miliciano:6});
  var ok=dbg.orderMove(army,vB);
  var pathHasSea=false; army.path.forEach(function(pid){if(isSea(P[pid]))pathHasSea=true});
  var wasOnSea=false, arrived=false, ticks=0;
  for(;ticks<8760;ticks++){ dbg.hourTick(); if(S.armies.indexOf(army)<0)break;
    if(isSea(P[army.prov]))wasOnSea=true; if(army.prov===vB){arrived=true;break} if(army.path.length===0)break; }
  var B={from:P[vA].name,to:P[vB].name,ordered:ok,pathHasSea:pathHasSea,wasOnSea:wasOnSea,arrived:arrived,final:P[army.prov]?P[army.prov].name:"(?)",finalIsSea:isSea(P[army.prov])};

  // C) descanso en el mar + redirección sin teleport
  var cA=nearest(-0.37,39.47); noAI(cA); var army2=dbg.spawnArmy(P[cA].owner,cA,{miliciano:6});
  var seaTile=-1; S.seaAdj[cA].forEach(function(q){if(seaTile<0&&isSea(P[q]))seaTile=q});
  var seaTile2=-1; if(seaTile>=0)S.adj[seaTile].forEach(function(q){if(seaTile2<0&&isSea(P[q])&&q!==seaTile)seaTile2=q});
  dbg.orderMove(army2,seaTile);
  var reachedSea=false; for(var k=0;k<3000;k++){dbg.hourTick(); if(army2.prov===seaTile){reachedSea=true;break} if(army2.path.length===0)break;}
  var restedOnSea=(army2.prov===seaTile&&army2.path.length===0&&isSea(P[army2.prov]));
  var before=army2.prov; var okC=seaTile2>=0?dbg.orderMove(army2,seaTile2):false;
  var teleported=(army2.prov!==before);
  var C={seaTile:seaTile>=0?"#"+seaTile:"(none)", reachedSea:reachedSea, restedOnSea:restedOnSea, redirected:okC, teleported:teleported};

  return JSON.stringify({A_embarkPenalty:A, B_longCrossing:B, C_restAndRedirect:C});
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
  const evalv = async (e) => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true, timeout:120000}); return r && r.result ? r.result.value : "(sin result)";};
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  console.log("=== MARCHA MARÍTIMA (tesela a tesela + embarque) ===");
  console.log(await evalv(TEST));
  console.log("\nERRORES DE CONSOLA: " + (errs.length ? errs.length + "\n  " + errs.slice(0,12).join("\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
