// El ducado de Cuenca: mirar SUS provincias y su horneado. Sergio dice que ahi falla y en otros no.
const http = require('http'); const WS = require('ws'); const fs = require('fs');
function cdp(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json/list',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const EXPR = `(function(){
  var S = dbg.S, P = S.provs, T = window.__terr, out = [];
  var D = null;
  for (var i = 0; i < S.duchies.length; i++) if (S.duchies[i].name.indexOf("Cuenca") >= 0) { D = S.duchies[i]; break }
  if (!D) return "no hay ducado de Cuenca";
  out.push(D.name + " -> " + D.provs.length + " provincias, de " + MAPDATA.nations[D.home].name);
  var ctx = T.c.getContext("2d", {willReadFrequently:true});
  var mira = function(id){
    var p = P[id], px = S.pixOfProv[id];
    var minx=1e9,miny=1e9,maxx=-1,maxy=-1;
    for (var k=0;k<px.length;k++){var x=px[k]%1813,y=(px[k]/1813)|0;
      if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y}
    var cols={};
    for (var k=0;k<40;k++){var q=px[(k*7919)%px.length];
      var d=ctx.getImageData((q%1813)*T.BS+1,((q/1813)|0)*T.BS+1,1,1).data;
      cols[(d[0]>>4)+","+(d[1]>>4)+","+(d[2]>>4)+" a"+(d[3]>128?1:0)]=1}
    // trozos: ¿la provincia es UNA pieza?
    var set={}; for(var k=0;k<px.length;k++) set[px[k]]=1;
    var vis={}, piezas=0;
    for (var k=0;k<px.length;k++){ if(vis[px[k]])continue; piezas++;
      var st=[px[k]]; vis[px[k]]=1;
      while(st.length){ var c=st.pop(), x=c%1813, y=(c/1813)|0;
        var nb=[x<1812?c+1:-1, x>0?c-1:-1, y<1839?c+1813:-1, y>0?c-1813:-1];
        for(var j=0;j<4;j++){var n=nb[j]; if(n>=0&&set[n]&&!vis[n]){vis[n]=1;st.push(n)}} } }
    return {id:id, nombre:p.name, terr:p.terrain, paramo:p.wasteland, px:px.length,
            recuadro:(maxx-minx+1)+"x"+(maxy-miny+1), bordePx:S.borderPxOfProv[id].length,
            piezas:piezas, coloresHorneados:Object.keys(cols).length};
  };
  var filas = D.provs.map(mira);
  out.push("");
  out.push("id     nombre         terreno   px   recuadro   borde  piezas  coloresHorneados");
  filas.forEach(function(f){
    out.push("  " + String(f.id).padEnd(6) + String(f.nombre).padEnd(15) + String(f.terr).padEnd(10) +
             String(f.px).padStart(4) + "  " + String(f.recuadro).padStart(9) + "  " +
             String(f.bordePx).padStart(5) + "  " + String(f.piezas).padStart(5) + "  " +
             String(f.coloresHorneados).padStart(6) + (f.coloresHorneados<=2 ? "   <-- LISA" : ""));
  });
  // encuadre para la foto
  var todos = [];
  D.provs.forEach(function(id){ todos = todos.concat(Array.prototype.slice.call(S.pixOfProv[id], 0, 400)) });
  var sx=0, sy=0;
  todos.forEach(function(i){ sx += i%1813; sy += (i/1813)|0 });
  var cx = sx/todos.length, cy = sy/todos.length;
  var cv = document.getElementById("map");
  S.zoom = 5; S.panX = cv.width/2 - cx*5; S.panY = cv.height/2 - cy*5;
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
  await send('Runtime.evaluate', {expression:'document.getElementById("observerCard").click()'});
  await new Promise(r => setTimeout(r, 2000));
  const r = await send('Runtime.evaluate', {expression:EXPR, returnByValue:true});
  console.log(r.exceptionDetails ? ('EXCEPCION: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)) : r.result.value);
  await new Promise(r => setTimeout(r, 1500));
  const s = await send('Page.captureScreenshot', {});
  if (s && s.data) { fs.writeFileSync('C:/tmp/mar/cuenca.png', Buffer.from(s.data, 'base64')); console.log('\n-> C:/tmp/mar/cuenca.png'); }
  ws.close(); process.exit(0);
})().catch(e => {console.log('FALLO:', e.message); process.exit(1)});
