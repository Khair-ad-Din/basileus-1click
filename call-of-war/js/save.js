// save.js
import { GH_PER_SEC, MH, MW, NATIONS, NEUTRAL, TERRAIN_KEYS, newBuildings } from "./config.js";
import { S } from "./state.js";
import { assignPopulation, assignResources, assignTerrain, isolateWastePockets, mulberry32, rebuildProvinceData, seedCities, seedStrata, localize } from "./mapgen.js";
import { canvas, clampPan, drawRoads, paintAll } from "./render.js";
import { hourTick, syncDuchyOcc } from "./sim.js";
import { resetTsyLedger } from "./economy.js";
import { buildRealmMenu, fmtDur, log, refreshSide, refreshTop } from "./ui.js";

// Reconstruye S.roads como Map clave->nivel. Compatible hacia atrás: los guardados y el mapa
// oficial antiguos almacenan solo la clave (string) => nivel 1; el formato nuevo son pares [clave,nivel].
function parseRoads(arr){
  const m=new Map();
  if(Array.isArray(arr))for(const e of arr){
    if(Array.isArray(e))m.set(e[0],e[1]||1); else m.set(e,1);
  }
  return m;
}
function buildSnapshot(){
  const rle=[];
  let cur=S.provIdx[0],run=1;
  for(let i=1;i<MW*MH;i++){
    if(S.provIdx[i]===cur)run++;
    else{rle.push(cur,run);cur=S.provIdx[i];run=1}
  }
  rle.push(cur,run);
  // v2: EL MAR YA ES PROVINCIA. La semántica del formato cambió (antes -1 era todo el océano; ahora
  // solo los agujeros: Caspio, Mar Blanco y lagos) y los ids son otros. Una instantánea v1 guardada
  // en el navegador cargaría SIN ERROR contra el código nuevo y taparía en silencio el mapa oficial
  // —la precedencia es localStorage > OFFICIAL_MAP (main.js:565)—, así que el gate de abajo la
  // rechaza y el mapa nuevo entra solo. No hay que borrarle nada a mano a nadie.
  // [10] = duchy0 y `duchies` = sus nombres. SIN ESTO, EL EDITOR SE COME LOS DUCADOS: en cuanto se
  // pulsa "Guardar cambios" (o se hace undo, que tambien pasa por aqui) los 944 ducados historicos
  // desaparecen del snapshot y buildDuchies() vuelve a inventarselos al recargar.
  return{v:2,W:MW,H:MH,rle,roads:[...S.roads],duchies:S.duchyNames?S.duchyNames.slice():null,
    provs:S.provs.map(p=>[p.canon||p.name,p.x,p.y,p.owner0,p.named?1:0,p.urban?1:0,p.capital?1:0,TERRAIN_KEYS.indexOf(p.terrain),p.wasteland?1:0,p.pop!=null?Math.round(p.pop):null,p.duchy0!=null?p.duchy0:-1])};
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
    if(!snap||snap.v!==2||snap.W!==MW||snap.H!==MH||!Array.isArray(snap.rle)||!Array.isArray(snap.provs))return null;
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
  // duchy0 = EL DUCADO IMPORTADO (a[10]). Si viene, buildDuchies() lo respeta en vez de inventarse
  // cúmulos de 3-4 provincias: son los 974 ducados históricos de EU4 (Lappland, Abruzzi, Kola), que
  // es de donde salió el corte de las propias provincias. Los mapas viejos no lo traen (a[10] es
  // undefined) y siguen funcionando exactamente igual.
  S.duchyNames=Array.isArray(snap.duchies)?snap.duchies.slice():null;
  // a[0] es el nombre CANÓNICO (inglés). p.canon lo guarda; p.name muestra el LOCALIZADO (Basel->Basilea).
  S.provs=snap.provs.map((a,i)=>({id:i,name:localize(a[0]),canon:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
    duchy0:a[10]!=null?a[10]:-1,
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
  seedCities(); // el `urban` de la instantánea es el sorteo viejo: se rehace con las ciudades reales
  assignPopulation();          // OJO: lee p.urban, así que va DESPUÉS de seedCities
  if(snap.roads){S.roads=parseRoads(snap.roads);S.roadQueue=[];S.customRoads=true}
  else S.customRoads=false;
}
function roundStore(store){ // reservas locales por bien (redondeadas), o null
  if(!store)return null;const o={};for(const k in store)o[k]=Math.round(store[k]);return o;
}
function roundProsp(pr){ // barras de prosperidad por canal (2 decimales), o null
  if(!pr)return null;const o={};for(const k in pr)o[k]=Math.round(pr[k]*100)/100;return o;
}
function saveGame(){
  if(!S.started||S.gameOver||S.player<0)return;
  try{
    const s={v:4,t:Date.now(),econV2:!!S.econV2,hour:S.hour,player:S.player,armyIdSeq:S.armyIdSeq,
      wars:[...S.wars],truces:[...S.truces],rel:[...S.rel],embargoes:[...S.embargoes],claims:[...S.claims],pacts:[...S.pacts],coalitions:[...S.coalitions],coalSeq:S.coalSeq,leagues:S.leagues,leagueSeq:S.leagueSeq,roads:[...S.roads],roadQueue:S.roadQueue,reports:S.reports,
      nations:S.nations.map(x=>({res:x.res,ai:x.ai,capital:x.capital,alive:x.alive,startProvs:x.startProvs,sWealth:x.sWealth,sRes:x.sRes,mkt:x.mkt,e2:x.e2,taxRate:x.taxRate,alcabala:x.alcabala,almojarifazgo:x.almojarifazgo,aggro:x.aggro,rivals:x.rivals})),
      provs:S.provs.map(p=>[p.owner,Math.round(p.morale*10)/10,p.buildings,p.buildQueue,p.recruitQueue,Math.round(p.pop||0),Math.round(p.sold||0),roundStore(p.store),p.occupier==null?-1:p.occupier,p.siege||null,p.bOwner||null,roundProsp(p.prosp),p.bOff||null,roundProsp(p.bCond)]),
      armies:S.armies.map(a=>({id:a.id,nation:a.nation,prov:a.prov,units:a.units,src:a.src,path:a.path,legDone:a.legDone,legTotal:a.legTotal,supply:a.supply})),
      mapCheck:S.provs.length+"|"+S.provs[0].name};
    localStorage.setItem("basileus_save",JSON.stringify(s));
  }catch(e){}
}
function loadSaveMeta(){
  try{
    const s=JSON.parse(localStorage.getItem("basileus_save"));
    if(!s||s.v!==4||s.mapCheck!==S.provs.length+"|"+S.provs[0].name)return null;
    return s;
  }catch(e){return null}
}
function continueGame(){
  const s=loadSaveMeta();
  if(!s)return;
  S.hour=s.hour;S.player=s.player;S.armyIdSeq=s.armyIdSeq;
  S.econV2=!!s.econV2; // la partida guardada sigue con la economía con la que se empezó
  S.wars=new Map(s.wars);S.truces=new Map(s.truces);
  S.rel=new Map(s.rel||[]);S.relMonthKey=-1; // relaciones diplomáticas (v4 antiguos sin rel → vacío)
  S.embargoes=new Set(s.embargoes||[]);S.claims=new Set(s.claims||[]);S.pacts=new Map(s.pacts||[]);S.dipCd=new Map();S.dipSel=-1;
  S.coalitions=new Map(s.coalitions||[]);S.coalSeq=s.coalSeq||0;S.council=null;
  S.leagues=s.leagues||[];S.leagueSeq=s.leagueSeq||0;
  S.roads=parseRoads(s.roads);S.roadQueue=s.roadQueue||[];
  S.reports=s.reports||[];
  S.peaceWith=-1;S.peaceSel=new Set();S.peaceGold=0;S.incomingPeace=null;S.callToArms=null;S.diploView={mode:"own",target:-1};S.leagueView=null;
  s.nations.forEach((x,i)=>Object.assign(S.nations[i],x));
  s.provs.forEach((d,i)=>{
    const p=S.provs[i];
    p.owner=d[0];p.morale=d[1];
    p.buildings=Object.assign(newBuildings(),d[2]||{});
    p.buildQueue=d[3]||[];p.recruitQueue=d[4]||[];
    if(d[5]!=null)p.pop=d[5];   // población viva (creció/decreció durante la partida)
    if(d[6]!=null)p.sold=d[6];  // soldadesca acumulada
    if(d[7]!=null)p.store=(typeof d[7]==="object")?d[7]:{comida:d[7]};  // reservas locales por bien (v3: era un escalar de comida)
    p.occupier=d[8]!=null?d[8]:-1; // control militar (ocupación EU4)
    p.siege=d[9]||null;            // asedio en curso {by,need,prog}
    p.bOwner=d[10]||{};            // E2: dueño de cada edificio por estamento (vacío = todo corona)
    p.prosp=d[11]||{};             // barras de prosperidad por canal (sobreconsumo sostenido)
    p.bOff=d[12]||{};              // edificios DESHABILITADOS (ciclo de vida)
    p.bCond=d[13]||{};             // condición 0..1 de los deshabilitados (degradación)
    seedStrata(p);                 // Fase A: re-derivar estratos con la población cargada
  });
  syncDuchyOcc(); // recomputar occBy de cada ducado a partir de la ocupación cargada
  S.armies=s.armies;
  for(const a of S.armies){a.src=a.src||{};if(a.supply==null)a.supply=70;} // origen (bajas) y suministro por defecto
  S.nations[S.player].ai=false;
  S.started=true;S.gameOver=false;S.selProv=-1;S.selArmy=null;S.battleFlash={};
  document.getElementById("startOverlay").style.display="none";
  S.recruitProv=S.nations[S.player].capital;
  resetTsyLedger(); // reinicia la capa de tesoro mensual para la partida retomada
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
