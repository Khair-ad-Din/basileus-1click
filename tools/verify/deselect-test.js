const http = require('http'); const WS = require('ws');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const EXPR = `(function(){
  var out = [], S = dbg.S, P = S.provs;
  var ok = function(t,c){ out.push((c?"  OK   ":"  FALLA")+" "+t); };
  var cv = document.getElementById("map") || document.querySelector("canvas");
  if (!cv) return "no encuentro el canvas";
  if (!S.started) return "LA PARTIDA NO ARRANCO: el manejador de clics ni se ejecuta, la prueba seria humo";

  // un pixel de TIERRA y un pixel de MAR, en coordenadas de mundo
  var tierra = -1, mar = -1;
  for (var i = 0; i < S.provIdx.length && (tierra < 0 || mar < 0); i++) {
    var q = S.provIdx[i]; if (q < 0) continue;
    if (P[q].terrain === 'mar') { if (mar < 0) mar = i; }
    else if (!P[q].wasteland) { if (tierra < 0) tierra = i; }
  }
  var pix2cli = function(i){
    var wx = i % 1813, wy = (i / 1813) | 0;
    var r = cv.getBoundingClientRect();
    return { clientX: r.left + wx * S.zoom + S.panX, clientY: r.top + wy * S.zoom + S.panY };
  };
  var clic = function(i){
    var c = pix2cli(i);
    for (var _ of [0]) {}
    cv.dispatchEvent(new MouseEvent("mousedown", {button:0, clientX:c.clientX, clientY:c.clientY, bubbles:true}));
    cv.dispatchEvent(new MouseEvent("mouseup",   {button:0, clientX:c.clientX, clientY:c.clientY, bubbles:true}));
  };

  // encuadrar para que el pixel caiga dentro del canvas
  var centrar = function(i){ var wx = i % 1813, wy = (i/1813)|0;
    S.zoom = 1; S.panX = cv.width/2 - wx; S.panY = cv.height/2 - wy; };

  // 1. clic en TIERRA selecciona
  centrar(tierra); clic(tierra);
  var selTierra = S.selProv;
  ok("clic en tierra: selecciona (" + (selTierra>=0 ? P[selTierra].name : "nada") + ")", selTierra >= 0 && P[selTierra].terrain !== 'mar');

  // 2. clic en MAR deselecciona  <-- lo que pidio Sergio
  centrar(mar); clic(mar);
  ok("clic en el MAR: DESELECCIONA (no selecciona la tesela)", S.selProv === -1);

  // 3. Esc en juego
  centrar(tierra); clic(tierra);
  var hab = S.selProv >= 0;
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  window.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
  ok("Esc en juego: suelta la provincia", hab && S.selProv === -1);

  out.push("");
  out.push("tierra probada: " + P[S.provIdx[tierra]].name + " · mar probado: " + P[S.provIdx[mar]].name);
  return out.join("\\n");
})()`;
(async () => {
  const t = (await cdp())[0];
  const ws = new WS(t.webSocketDebuggerUrl, {perMessageDeflate:false});
  let id = 0; const pend = {};
  const send = (m,p) => new Promise(r => {const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method:m, params:p||{}}))});
  ws.on('message', m => {const o = JSON.parse(m); if (o.id && pend[o.id]) {pend[o.id](o.result); delete pend[o.id]}});
  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 40000));
  // fuera el dialogo de inicio para que el canvas reciba los clics
  // ARRANCAR LA PARTIDA: sin esto el manejador de clics se sale en `if(wasDrag||!S.started)return`
  // y no se procesa NADA. La primera version de esta prueba escondia el dialogo y ya, asi que el
  // "clic en el mar deselecciona" salia en VERDE sin haber seleccionado nunca nada: aprobado vacio.
  await send('Runtime.evaluate', {expression:'document.getElementById("observerCard").click()'});
  await new Promise(r => setTimeout(r, 2500));
  const r = await send('Runtime.evaluate', {expression:EXPR, returnByValue:true});
  console.log(r.exceptionDetails ? ('EXCEPCION: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)) : r.result.value);
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
