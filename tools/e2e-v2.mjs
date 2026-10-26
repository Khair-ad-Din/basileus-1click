// tools/e2e-v2.mjs — prueba E2E del juego REAL en Chrome headless (CDP): arranca Castilla, avanza N días con
// el tick real (sim.hourTick), abre los paneles de economía y lista los errores JS. Requiere el servidor en :8123.
//   node tools/e2e-v2.mjs [días=90]
import { spawn } from "child_process";
import fs from "fs";
const PORT=9331, DAYS=+(process.argv[2]||90);
const udd="C:/tmp/cudd-"+Date.now();
const chrome=spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu",
  "--remote-debugging-port="+PORT,"--user-data-dir="+udd,"--window-size=1600,1000","about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let tgt,lastErr;for(let i=0;i<120;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/new?`+encodeURIComponent("http://localhost:8123/call-of-war/"),{method:"PUT"});tgt=await r.json();if(tgt&&tgt.webSocketDebuggerUrl)break;lastErr=JSON.stringify(tgt)}catch(e){lastErr=e.message;await sleep(250)}}
if(!tgt||!tgt.webSocketDebuggerUrl){console.log("sin chrome:",lastErr);chrome.kill();process.exit(1)}
const ws=new WebSocket(tgt.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();const errs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  if(m.method==="Runtime.exceptionThrown")errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")errs.push("console.error: "+m.params.args.map(a=>a.value||a.description).join(" "))};
const call=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const ev=async(expr)=>{const r=await call("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true});
  if(r.result.exceptionDetails)return "EXC: "+(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text);return r.result.result.value};
await call("Runtime.enable");await call("Page.enable");
await sleep(9000);
await ev(`(async()=>{window.__S=(await import('./js/state.js')).S;return 1})()`);
console.log("click:",await ev(`(()=>{const c=[...document.querySelectorAll('#nationGrid .ncard[data-n]')].find(x=>/Castilla/.test(x.textContent))||document.querySelector('#nationGrid .ncard[data-n]');if(!c)return 'no card';c.click();return c.textContent.slice(0,30)})()`));
await sleep(2500);
console.log("run:",await ev(`(async()=>{const sim=await import('./js/sim.js');const S=window.__S;const t0=Date.now();for(let h=0;h<${DAYS}*24;h++)sim.hourTick();
  const N=S.nations[S.player];return {dias:${DAYS},ms:Date.now()-t0,player:S.player,tesoro:Math.round(N.res.dinero),riqueza:Object.fromEntries(Object.entries(N.sWealth).map(([k,v])=>[k,Math.round(v)])),
   cov:N.e2&&N.e2.cov,precios:Object.fromEntries(Object.entries(N.mktPrice||{}).filter(([k])=>['grano','pano','herramientas','seda','lana','hierro'].includes(k)).map(([k,v])=>[k,+v.toFixed(1)])),
   obras:S.provs.filter(p=>p.owner===S.player).reduce((a,p)=>a+p.buildQueue.length,0)}})()`));
for(const [name,expr] of [["Mercado","openMercado()"],["Bien paño","openMktGood('pano')"],["cerrar bien","closeMktGood()"],["Estamentos","openEstates()"],["Tesorería","openTreasury()"],["Fiscal","openFiscal()"],["Mapa bien","showGoodMap&&showGoodMap('pano')"],
  ["Ficha provincia","(()=>{const S=window.__S;S.selProv=S.nations[S.player].capital;S.selArmy=null;S.provTab=null;setProvTab('build');return document.getElementById('provPanel').className})()"],["Economía provincia","setProvTab('eco')"],["Detalle cobrador","provEcoDrill('corona')"],
  ["Ejércitos","setProvTab('army')"],["Caminos","setProvTab('roads')"]]){
  console.log(name+":",await ev(`(()=>{try{${expr};return 'ok'}catch(e){return 'ERR '+e.message}})()`));await sleep(400)}
await ev(`(()=>{const S=window.__S;const cap=S.provs[S.nations[S.player].capital];S.selProv=cap.id;return 1})()`);
await call("Page.navigate",{url:"about:blank"}).catch(()=>{});
console.log("\nErrores JS capturados ("+errs.length+"):");for(const e of [...new Set(errs)].slice(0,15))console.log(" -",e.split("\n").slice(0,3).join(" | "));
ws.close();chrome.kill();await sleep(500);try{fs.rmSync(udd,{recursive:true,force:true})}catch(e){}
process.exit(0);
