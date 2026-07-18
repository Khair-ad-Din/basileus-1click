// Valida la reversión a mitad de salto (feedback de Sergio): si vas de A a B y reordenas a un destino
// que pasa por A, el ejército se da la vuelta DE INMEDIATO en vez de llegar antes a B.
const http = require('http'); const WS = WebSocket;
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const TEST = `(function(){ try{
  var S=dbg.S, P=S.provs, isSea=function(p){return p&&p.terrain==="mar"};
  S.hour=9000;
  // A0 = provincia de tierra con >=2 vecinos de tierra (para tener B y un destino distinto)
  var A0=-1,B0=-1;
  for(var i=0;i<P.length&&A0<0;i++){var p=P[i]; if(isSea(p)||p.wasteland)continue;
    var lands=[]; S.adj[i].forEach(function(q){if(!isSea(P[q])&&!P[q].wasteland)lands.push(q)});
    if(lands.length>=2){A0=i;B0=lands[0]}}
  if(S.nations[P[A0].owner])S.nations[P[A0].owner].ai=false;

  // CASO REVERSIÓN: ir a B0, avanzar, reordenar a A0 (origen) -> debe volverse ya
  var army=dbg.spawnArmy(P[A0].owner,A0,{miliciano:6});
  dbg.orderMove(army,B0);
  var legT=army.legTotal;
  for(var k=0;k<3;k++)dbg.hourTick();               // mitad de salto A0->B0
  var midProv=army.prov, midNext=army.path[0], midDone=army.legDone;
  dbg.orderMove(army,A0);                            // reordenar de vuelta al origen
  var rev={ before:{prov:midProv,next:midNext,legDone:Math.round(midDone)},
            after:{prov:army.prov,next:army.path[0]},
            headsBackToA: (army.prov===B0 && army.path[0]===A0),
            teleportedToNode: (army.legDone===0 && army.legTotal===0) };

  // CASO CONTINUAR: ir a B0, avanzar, reordenar a un vecino de B0 lejos de A0 -> debe seguir por B0
  var C=-1; S.adj[B0].forEach(function(q){ if(C<0&&!isSea(P[q])&&!P[q].wasteland&&q!==A0&&!S.adj[A0].has(q))C=q; });
  var contCase=null;
  if(C>=0){
    var army2=dbg.spawnArmy(P[A0].owner,A0,{miliciano:6});
    dbg.orderMove(army2,B0); for(var k=0;k<3;k++)dbg.hourTick();
    dbg.orderMove(army2,C);
    contCase={ target:"#"+C, continuesThroughB:(army2.prov===A0 && army2.path[0]===B0), next:army2.path[0] };
  }
  return JSON.stringify({reverse:rev, continue:contCase});
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
  const evalv = async (e) => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true, timeout:60000}); return r && r.result ? r.result.value : "(sin result)";};
  await evalv('(function(){var c=document.getElementById("observerCard");if(c)c.click();return !!c})()');
  await new Promise(r => setTimeout(r, 2500));
  console.log("=== REVERSIÓN A MITAD DE SALTO ===");
  console.log(await evalv(TEST));
  console.log("\nERRORES DE CONSOLA: " + (errs.length ? errs.length + "\n  " + errs.slice(0,10).join("\n  ") : "0"));
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
