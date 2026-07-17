// Ejercita las herramientas del editor CONTRA EL JUEGO VIVO: no basta con que compile.
const http = require('http'); const WS = require('ws');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}

const PRUEBA = `(function(){
  var out = [];
  var ok = function(t, c){ out.push((c ? "  OK   " : "  FALLA") + " " + t); return c; };
  var S = dbg.S, P = S.provs;
  var ed = window.__ed;
  if (!ed) return "editor no expuesto";

  // --- estado de partida ---
  var nProv0 = P.length, nDuc0 = S.duchies.length;
  out.push("estado inicial: " + nProv0 + " provincias, " + nDuc0 + " ducados");

  // una provincia de tierra, con vecinas del mismo ducado, que no sea capital
  var vic = -1;
  for (var i = 0; i < P.length; i++) {
    var p = P[i];
    if (p.terrain === 'mar' || p.wasteland || p.capital || !(p.duchy0 >= 0)) continue;
    var nb = Array.from(S.adj[i]).filter(function(q){ return P[q].duchy0 === p.duchy0 && !P[q].wasteland; });
    if (nb.length >= 2) { vic = i; break; }
  }
  if (vic < 0) return "no encuentro provincia de prueba";
  var vicNom = P[vic].name, vicDuc = P[vic].duchy0, vicPix = S.pixOfProv[vic].length;
  var vecPop0 = Array.from(S.adj[vic]).map(function(q){ return P[q].pop || 0; }).reduce(function(a,b){return a+b;},0);
  var vicPop = P[vic].pop || 0;

  // ============ 1. DISOLVER ============
  ed.dissolveProvince(vic);
  ok("disolver: hay una provincia menos", S.provs.length === nProv0 - 1);
  ok("disolver: no queda ni un pixel suyo en el raster", (function(){
    for (var k = 0; k < S.provIdx.length; k++) if (S.provIdx[k] === S.provs.length) return false;
    return true; })());
  ok("disolver: los ids del raster son todos validos", (function(){
    for (var k = 0; k < S.provIdx.length; k++) { var q = S.provIdx[k]; if (q >= S.provs.length) return false; }
    return true; })());
  ok("disolver: ningun ejercito apunta a un id muerto",
     S.armies.every(function(a){ return a.prov >= 0 && a.prov < S.provs.length; }));
  // -1 es "sin capital" y es LEGITIMO: NEUTRAL (el cajon de lo no poseido) lo lleva siempre. La
  // primera version de esta prueba lo daba por invalido y casi me hace "arreglar" codigo sano.
  ok("disolver: ninguna capital nacional apunta a un id muerto",
     S.nations.every(function(n){ return n.capital == null || n.capital === -1 || (n.capital >= 0 && n.capital < S.provs.length); }));
  ok("disolver: los ducados se han reconstruido (cap valida)",
     S.duchies.every(function(d){ return d.cap >= 0 && d.cap < S.provs.length; }));
  ok("disolver: sus provincias existen", S.duchies.every(function(d){
     return d.provs.every(function(q){ return q >= 0 && q < S.provs.length; }); }));

  // ============ 2. CAMBIAR DE DUCADO ============
  var P2 = S.provs;
  var a = -1, otroDuc = -1;
  for (var i = 0; i < P2.length; i++) {
    if (P2[i].terrain === 'mar' || P2[i].wasteland || !(P2[i].duchy0 >= 0)) continue;
    var nb2 = Array.from(S.adj[i]).filter(function(q){ return P2[q].duchy0 >= 0 && P2[q].duchy0 !== P2[i].duchy0 && !P2[q].wasteland; });
    if (nb2.length) { a = i; otroDuc = P2[nb2[0]].duchy0; break; }
  }
  if (a >= 0) {
    var antes = P2[a].duchy0, nDucAntes = S.duchies.length;
    ed.setProvinceDuchy(a, otroDuc);
    ok("ducado: la provincia ha cambiado de duchy0", P2[a].duchy0 === otroDuc);
    ok("ducado: S.duchies refleja el cambio", (function(){
      var d = S.duchies[P2[a].duchy]; return d && d.provs.indexOf(a) >= 0; })());
    ed.setProvinceDuchy(a, antes);
    ok("ducado: se puede devolver", P2[a].duchy0 === antes);
  } else out.push("  (sin par de ducados vecinos para probar)");

  // ============ 3. NACION ============
  var b = -1;
  for (var i = 0; i < P2.length; i++) if (P2[i].terrain !== 'mar' && !P2[i].wasteland) { b = i; break; }
  var own0 = P2[b].owner0, nuevo = (own0 + 1) % MAPDATA.nations.length;
  ed.setProvinceOwner(b, nuevo);
  ok("nacion: cambia owner y owner0", P2[b].owner === nuevo && P2[b].owner0 === nuevo);
  ed.setProvinceOwner(b, own0);

  // ============ 4. EL SNAPSHOT CONSERVA LOS DUCADOS ============
  var snap = ed.buildSnapshot();
  ok("guardar: el snapshot lleva los nombres de ducado", Array.isArray(snap.duchies) && snap.duchies.length > 0);
  ok("guardar: cada provincia lleva su ducado en [10]", snap.provs.every(function(t){ return t.length >= 11; }));
  ok("guardar: el ducado guardado coincide con el vivo",
     snap.provs.every(function(t, i){ return t[10] === (S.provs[i].duchy0 != null ? S.provs[i].duchy0 : -1); }));
  ok("guardar: el rle suma W*H", (function(){
     var t = 0; for (var k = 1; k < snap.rle.length; k += 2) t += snap.rle[k];
     return t === snap.W * snap.H; })());
  ok("guardar: v=2", snap.v === 2);

  // ============ 5. FUSIONAR ============
  var c = -1, d2 = -1;
  for (var i = 0; i < P2.length; i++) {
    if (P2[i].terrain === 'mar' || P2[i].wasteland || P2[i].capital) continue;
    var nb3 = Array.from(S.adj[i]).filter(function(q){ return !P2[q].wasteland && P2[q].terrain !== 'mar'; });
    if (nb3.length) { c = i; d2 = nb3[0]; break; }
  }
  var nP = S.provs.length;
  ed.mergeProvinces(c, d2);
  ok("fusionar: hay una provincia menos", S.provs.length === nP - 1);
  ok("fusionar: los ducados siguen validos", S.duchies.every(function(d){
     return d.cap >= 0 && d.cap < S.provs.length && d.provs.every(function(q){ return q < S.provs.length; }); }));
  ok("fusionar: el raster no tiene ids muertos", (function(){
    for (var k = 0; k < S.provIdx.length; k++) if (S.provIdx[k] >= S.provs.length) return false;
    return true; })());

  out.push("");
  out.push("provincia de prueba: " + vicNom + " (" + vicPix + " px, pop " + Math.round(vicPop) + ")");
  return out.join("\\n");
})()`;

(async () => {
  const t = (await cdp())[0];
  const ws = new WS(t.webSocketDebuggerUrl, {perMessageDeflate:false});
  let id = 0; const pend = {};
  const send = (m,p) => new Promise(r => {const i = ++id; pend[i] = r; ws.send(JSON.stringify({id:i, method:m, params:p||{}}))});
  const errs = [];
  ws.on('message', m => {const o = JSON.parse(m);
    if (o.id && pend[o.id]) {pend[o.id](o.result); delete pend[o.id]}
    if (o.method === 'Runtime.exceptionThrown') errs.push(o.params.exceptionDetails.exception?.description || o.params.exceptionDetails.text);
  });
  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Page.navigate', {url:'http://localhost:8123/call-of-war/?nc=' + Date.now()});
  await new Promise(r => setTimeout(r, 40000));
  const r = await send('Runtime.evaluate', {expression:PRUEBA, returnByValue:true});
  if (r.exceptionDetails) console.log('EXCEPCION:', (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  else console.log(r.result.value);
  if (errs.length) { console.log('\nEXCEPCIONES SUELTAS:'); console.log(errs.slice(0,5).join('\n')); }
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
