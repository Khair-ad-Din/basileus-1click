// save.js
import { GH_PER_SEC, MH, MW, NATIONS, NEUTRAL, TERRAIN_KEYS, newBuildings } from "./config.js";
import { S } from "./state.js";
import { assignPopulation, assignResources, assignTerrain, isolateWastePockets, mulberry32, rebuildProvinceData } from "./mapgen.js";
import { canvas, clampPan, drawRoads, paintAll } from "./render.js";
import { hourTick } from "./sim.js";
import { buildRealmMenu, fmtDur, log, refreshSide, refreshTop } from "./ui.js";

function buildSnapshot(){
  const rle=[];
  let cur=S.provIdx[0],run=1;
  for(let i=1;i<MW*MH;i++){
    if(S.provIdx[i]===cur)run++;
    else{rle.push(cur,run);cur=S.provIdx[i];run=1}
  }
  rle.push(cur,run);
  return{v:1,W:MW,H:MH,rle,roads:[...S.roads],
    provs:S.provs.map(p=>[p.name,p.x,p.y,p.owner0,p.named?1:0,p.urban?1:0,p.capital?1:0,TERRAIN_KEYS.indexOf(p.terrain),p.wasteland?1:0,p.pop!=null?Math.round(p.pop):null])};
}
function saveProvMap(){
  try{localStorage.setItem("basileus_provmap",JSON.stringify(buildSnapshot()))}
  catch(e){log("No se pudo guardar el mapa editado: "+e.message)}
}
function loadProvMapSnapshot(){
  try{
    const s=localStorage.getItem("basileus_provmap");
    if(!s)return null;
    const snap=JSON.parse(s);
    if(!snap||snap.v!==1||snap.W!==MW||snap.H!==MH||!Array.isArray(snap.rle)||!Array.isArray(snap.provs))return null;
    let tot=0;
    for(let i=1;i<snap.rle.length;i+=2)tot+=snap.rle[i];
    if(tot!==MW*MH)return null;
    return snap;
  }catch(e){return null}
}
function loadProvMap(snap){
  S.rand=mulberry32(193909);
  S.provIdx=new Int16Array(MW*MH).fill(-1);
  let pos=0;
  for(let i=0;i<snap.rle.length;i+=2){
    const pid=snap.rle[i],run=snap.rle[i+1];
    if(pid>=0)S.provIdx.fill(pid,pos,pos+run);
    pos+=run;
  }
  S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
    named:!!a[4],coastal:false,morale:60,urban:!!a[5],resType:null,shade:0.85+S.rand()*0.3,capital:!!a[6],
    terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,
    wasteland:a[8]!=null?!!a[8]:null,
    pop:a[9]!=null?a[9]:null, // población persistida (editable); null = la siembra el modelo
    buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
  rebuildProvinceData();
  assignTerrain(); // rellena el terreno si la instantánea es antigua y no lo trae
  assignResources();
  let computed=false;
  for(const p of S.provs)if(p.wasteland==null){p.wasteland=p.terrain==="desierto"&&!p.coastal&&!p.named;computed=true}
  if(computed)isolateWastePockets(); // los flags editados a mano se respetan tal cual
  for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
  assignPopulation();
  if(snap.roads){S.roads=new Set(snap.roads);S.roadQueue=[];S.customRoads=true}
  else S.customRoads=false;
}
function saveGame(){
  if(!S.started||S.gameOver||S.player<0)return;
  try{
    const s={v:2,t:Date.now(),hour:S.hour,player:S.player,armyIdSeq:S.armyIdSeq,
      wars:[...S.wars],truces:[...S.truces],roads:[...S.roads],roadQueue:S.roadQueue,
      nations:S.nations.map(x=>({res:x.res,ai:x.ai,capital:x.capital,alive:x.alive,startProvs:x.startProvs})),
      provs:S.provs.map(p=>[p.owner,Math.round(p.morale*10)/10,p.buildings,p.buildQueue,p.recruitQueue,Math.round(p.pop||0),Math.round(p.sold||0)]),
      armies:S.armies.map(a=>({id:a.id,nation:a.nation,prov:a.prov,units:a.units,src:a.src,path:a.path,legDone:a.legDone,legTotal:a.legTotal})),
      mapCheck:S.provs.length+"|"+S.provs[0].name};
    localStorage.setItem("basileus_save",JSON.stringify(s));
  }catch(e){}
}
function loadSaveMeta(){
  try{
    const s=JSON.parse(localStorage.getItem("basileus_save"));
    if(!s||s.v!==2||s.mapCheck!==S.provs.length+"|"+S.provs[0].name)return null;
    return s;
  }catch(e){return null}
}
function continueGame(){
  const s=loadSaveMeta();
  if(!s)return;
  S.hour=s.hour;S.player=s.player;S.armyIdSeq=s.armyIdSeq;
  S.wars=new Set(s.wars);S.truces=new Map(s.truces);
  S.roads=new Set(s.roads);S.roadQueue=s.roadQueue||[];
  s.nations.forEach((x,i)=>Object.assign(S.nations[i],x));
  s.provs.forEach((d,i)=>{
    const p=S.provs[i];
    p.owner=d[0];p.morale=d[1];
    p.buildings=Object.assign(newBuildings(),d[2]||{});
    p.buildQueue=d[3]||[];p.recruitQueue=d[4]||[];
    if(d[5]!=null)p.pop=d[5];   // población viva (creció/decreció durante la partida)
    if(d[6]!=null)p.sold=d[6];  // soldadesca acumulada
  });
  S.armies=s.armies;
  for(const a of S.armies)a.src=a.src||{}; // partidas antiguas sin origen: sin baja de pop
  S.nations[S.player].ai=false;
  S.started=true;S.gameOver=false;S.selProv=-1;S.selArmy=null;S.battleFlash={};
  document.getElementById("startOverlay").style.display="none";
  S.recruitProv=S.nations[S.player].capital;
  buildRealmMenu();
  paintAll();drawRoads();
  const cap=S.provs[S.nations[S.player].capital];
  if(cap){S.panX=canvas.width/2-cap.x*S.zoom;S.panY=canvas.height/2-cap.y*S.zoom;clampPan()}
  refreshTop();refreshSide();
  // puesta al día: el mundo siguió su curso mientras no estabas
  const missed=Math.min(8760,Math.floor((Date.now()-s.t)/1000*GH_PER_SEC));
  if(missed>24)runCatchup(missed);
  else log("Partida retomada. Bienvenido de nuevo, soberano.");
}
function runCatchup(ticks){
  const msg=document.getElementById("loadMsg");
  msg.style.display="flex";
  const total=ticks;
  const wasSpeed=S.speed;S.speed=0;
  (function step(){
    const n=Math.min(600,ticks);
    for(let i=0;i<n&&!S.gameOver;i++)hourTick();
    ticks-=n;
    msg.textContent="El mundo avanzó en tu ausencia… "+Math.round((1-ticks/total)*100)+"% ("+fmtDur(total-ticks)+" de juego)";
    if(ticks>0&&!S.gameOver)setTimeout(step,0);
    else{
      msg.style.display="none";
      S.speed=wasSpeed;
      refreshTop();refreshSide();
      saveGame();
      log("Han pasado "+fmtDur(total)+" desde tu última visita.");
    }
  })();
}

export {
  saveGame, loadSaveMeta, continueGame, runCatchup, buildSnapshot, saveProvMap, loadProvMapSnapshot, loadProvMap
};
