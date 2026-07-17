const http = require('http'); const WS = require('ws');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const EXPR = `(function(){
  var out = [], S = dbg.S, P = S.provs;
  var ok = function(t,c){ out.push((c?"  OK   ":"  FALLA")+" "+t) };
  var cv = document.getElementById("map"), i = -1;
  for (var k = 0; k < S.provIdx.length; k++) { var q = S.provIdx[k];
    if (q >= 0 && P[q].terrain !== 'mar' && !P[q].wasteland && S.pixOfProv[q].length > 300) { i = k; break } }
  var wx = i % 1813, wy = (i / 1813) | 0;
  S.zoom = 3; S.panX = cv.width/2 - wx*3; S.panY = cv.height/2 - wy*3;
  var r = cv.getBoundingClientRect();
  var cx = r.left + wx*3 + S.panX, cy = r.top + wy*3 + S.panY;
  cv.dispatchEvent(new MouseEvent("mousedown",{button:0,clientX:cx,clientY:cy,bubbles:true}));
  cv.dispatchEvent(new MouseEvent("mouseup",  {button:0,clientX:cx,clientY:cy,bubbles:true}));
  ok("clic selecciona (" + (S.shapeSel>=0 ? P[S.shapeSel].name : "nada") + ")", S.shapeSel >= 0);

  var X = String.fromCharCode(0x2715);
  var b = Array.prototype.slice.call(document.querySelectorAll("#side h3 span"))
            .filter(function(e){ return e.textContent.trim() === X; })[0];
  ok("la X esta en la cabecera del panel", !!b);
  if (b) {
    var rr = b.getBoundingClientRect(), sd = document.getElementById("side").getBoundingClientRect();
    ok("la X se ve sin bajar scroll", rr.top >= sd.top && rr.bottom <= sd.bottom);
    b.click();
    ok("la X DESELECCIONA", S.shapeSel === -1);
  }
  ok("ya no queda boton 'Deseleccionar' de texto (era redundante)",
     !Array.prototype.slice.call(document.querySelectorAll("#side button"))
        .some(function(x){ return x.textContent.indexOf("Deselec") >= 0 }));
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
  await send('Runtime.evaluate', {expression:'document.getElementById("editFromPicker").click()'});
  await new Promise(r => setTimeout(r, 1500));
  const r = await send('Runtime.evaluate', {expression:EXPR, returnByValue:true});
  console.log(r.exceptionDetails ? ('EXCEPCION: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)) : r.result.value);
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
