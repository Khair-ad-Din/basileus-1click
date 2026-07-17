// Cambia el terreno de una provincia en el editor y comprueba QUE LA PANTALLA CAMBIA.
// Compara los pixeles del canvas antes y despues: es la unica prueba que vale para un bug visual.
const http = require('http'); const WS = require('ws'); const fs = require('fs');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}

// Deja el mapa centrado y ampliado sobre una provincia de tierra con sprite, y la selecciona.
const PREP = `(function(){
  var S = dbg.S, P = S.provs, cv = document.getElementById("map");
  // una provincia grande, de tierra, NO paramo, con terreno que TENGA sprite
  var conSprite = {montana:1,colinas:1,bosque:1,pantano:1,vega:1,pradera:1,llanura:1,estepa:1};
  var pid = -1;
  for (var i = 0; i < P.length; i++) {
    var p = P[i];
    if (p.terrain === 'mar' || p.wasteland) continue;
    if (!conSprite[p.terrain]) continue;
    if (S.pixOfProv[i].length > 600) { pid = i; break }
  }
  if (pid < 0) return "no hay provincia apta";
  var px = S.pixOfProv[pid], sx = 0, sy = 0;
  for (var k = 0; k < px.length; k++) { sx += px[k] % 1813; sy += (px[k] / 1813) | 0 }
  var cx = sx / px.length, cy = sy / px.length;
  S.zoom = 4; S.panX = cv.width/2 - cx*4; S.panY = cv.height/2 - cy*4;
  var r = cv.getBoundingClientRect();
  var clx = r.left + cx*4 + S.panX, cly = r.top + cy*4 + S.panY;
  cv.dispatchEvent(new MouseEvent("mousedown",{button:0,clientX:clx,clientY:cly,bubbles:true}));
  cv.dispatchEvent(new MouseEvent("mouseup",  {button:0,clientX:clx,clientY:cly,bubbles:true}));
  return JSON.stringify({pid:pid, nombre:P[pid].name, terreno:P[pid].terrain, sel:S.shapeSel,
                         cx:Math.round(clx), cy:Math.round(cly)});
})()`;

const cambia = t => `(function(){ window.setTerrain("${t}"); var S=dbg.S;
  return S.provs[S.shapeSel] ? S.provs[S.shapeSel].terrain : "sin seleccion"; })()`;

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
  const ev = async e => {const r = await send('Runtime.evaluate', {expression:e, returnByValue:true});
    return r.exceptionDetails ? ('ERR: ' + ((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text)) : r.result?.value};
  await ev('document.getElementById("editFromPicker").click()');
  await new Promise(r => setTimeout(r, 1500));
  const prep = await ev(PREP);
  console.log('provincia:', prep);
  const info = JSON.parse(prep);
  const foto = async n => {
    await new Promise(r => setTimeout(r, 900));
    const s = await send('Page.captureScreenshot', {});
    fs.writeFileSync('C:/tmp/mar/terr_' + n + '.png', Buffer.from(s.data, 'base64'));
  };
  await foto('antes');
  // cambiar a MONTAÑA (sprite bien distinto) y volver a fotografiar
  console.log('terreno ->', await ev(cambia('montana')));
  await foto('montana');
  console.log('terreno ->', await ev(cambia('bosque')));
  await foto('bosque');
  // y a DESIERTO, que NO tiene sprite: debe quedarse a color pelado
  console.log('terreno ->', await ev(cambia('desierto')));
  await foto('desierto');
  console.log('centro de la provincia en pantalla:', info.cx + ',' + info.cy);
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
