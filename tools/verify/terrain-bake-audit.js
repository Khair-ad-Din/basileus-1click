// AUDITORIA DEL HORNEADO en una carga limpia: para cada terreno, ¿cuantas provincias tienen
// realmente pintura en el lienzo de sprites? Mira el LIENZO, no el codigo.
const http = require('http'); const WS = require('ws');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const EXPR = `(function(){
  var S = dbg.S, P = S.provs, T = window.__terr, out = [];
  if (!T) return "window.__terr no expuesto (¿cache?)";
  out.push("sprites cargados: " + T.ready());
  out.push("sprites que existen: " + Object.keys(T.img).join(", "));
  out.push("tabla SPRITE: " + JSON.stringify(T.SPRITE));
  var ctx = T.c.getContext("2d", {willReadFrequently:true});
  // por terreno: cuantas provincias hay y en cuantas el lienzo tiene pintura en su centro
  var por = {};
  var mira = function(p){
    var px = S.pixOfProv[p.id]; if (!px || !px.length) return null;
    // muestrear 12 pixeles repartidos, en coordenadas del lienzo horneado (BS x)
    var pinta = 0, n = 0;
    for (var k = 0; k < 12; k++) {
      var i = px[(k * 7919) % px.length];
      var x = (i % 1813) * T.BS + (T.BS>>1), y = ((i/1813)|0) * T.BS + (T.BS>>1);
      var d = ctx.getImageData(x, y, 1, 1).data;
      n++; if (d[3] > 8) pinta++;
    }
    return pinta / n;
  };
  var muestra = {};
  for (var i = 0; i < P.length; i++) {
    var p = P[i];
    var k = p.wasteland ? "(paramo)" : (p.terrain || "(null)");
    if (!por[k]) { por[k] = {n:0, conSprite:0, sinSprite:0}; muestra[k] = []; }
    por[k].n++;
    if (por[k].n > 40) continue;                 // 40 por terreno basta y no cuesta un siglo
    var f = mira(p);
    if (f === null) continue;
    if (f > 0.5) por[k].conSprite++; else { por[k].sinSprite++; if (muestra[k].length < 2) muestra[k].push(p.name); }
  }
  out.push("");
  out.push("terreno            provincias   de 40 muestreadas: con sprite / SIN");
  for (var k in por) {
    var v = por[k];
    out.push("  " + k.padEnd(18) + String(v.n).padStart(6) + "        " + String(v.conSprite).padStart(3) + " / " + String(v.sinSprite).padStart(3) +
             (v.sinSprite && muestra[k].length ? "   ej: " + muestra[k].join(", ") : ""));
  }
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
  await new Promise(r => setTimeout(r, 45000));
  const r = await send('Runtime.evaluate', {expression:EXPR, returnByValue:true});
  console.log(r.exceptionDetails ? ('EXCEPCION: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)) : r.result.value);
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
