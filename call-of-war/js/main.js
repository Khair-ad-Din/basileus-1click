import {
  saveGame, loadSaveMeta, continueGame, runCatchup, buildSnapshot, saveProvMap, loadProvMapSnapshot, loadProvMap
} from "./save.js";
import {
  enterEditor, exitEditor, pushUndo, restoreWorldFromSnap, toggleRoadEdit, setProvinceOwner, dpSimplify, simplifyRing, traceProvince, applyShape, mergeProvinces, rasterPoly, keepLargestFragment, splitProvince, refreshEditorPanel, vertexAt, nearestSegment
} from "./editor.js";
import {
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, refreshLedger, refreshReports, refreshPeace, showNationPicker, refreshArmyPanel, buildRealmMenu, refreshTreasury, refreshEstates, refreshMercado, refreshFiscal, refreshCouncil, refreshCoalPeace, refreshLeagues, refreshCallToArms, refreshDipModal
} from "./ui.js";
import {
  atWar, declareWar, makePeace, underTruce, spawnArmy, setupNations, tryRoad, nbrs, bfsPath, startLeg, orderMove, takeTile, updateDuchy, isKeyTile, hourTick, resolveBattles, applyDamage, mergeIdle, aiTurn, findTarget, tryBuild, tryRecruit, disbandUnit, raiseLevies, checkVictory, armiesIn,
  getWar, warscore, duchyValue, occupiedDuchiesBy, report, coalitionOf, coalitionPeace
} from "./sim.js";
import { insult, giftGold, isEmbargoed, setEmbargo, fabricateClaim, getRel, THRESH, formPact, breakPact, hasPact,
  leagueOf, createLeague, applyToLeague, resolveApplication, proposeExpel, leaveLeague, refuseDefense,
  MAX_RIVALS, rivalsOf, canRival, addRival, removeRival } from "./diplomacy.js";
import { openCouncil, councilToggle, councilConvene, launchCouncil, cancelCouncil, playerJoinDefense } from "./council.js";
import {
  hex2rgb, provColor, paintAll, paintBorders, repaintProvince, roadCurve, drawRoads, fitCanvas, clampPan, armyPos, draw, drawArrow, drawEditorOverlay, NCOL, TCOL, WASTECOL, baseC, baseCtx, roadsC, canvas, baseData, clearSelOutline
} from "./render.js";
import {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, armyCount, armyFood, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime, recruitable, resetTsyLedger
} from "./economy.js";
import {
  mulberry32, hashN, genName, SYL_A, SYL_M, SYL_B, decodeCountries, RLE_ALPHA, countryAt, generateMap, isolateWastePockets, MOUNTAIN_ZONES, MARSH_ZONES, FERTILE_ZONES, pxToLonLat, assignTerrain, assignResources, assignPopulation, rebuildProvinceData, kmBetween, roadKey, hasRoad, landPath, generateRoads
} from "./mapgen.js";
import { S } from "./state.js";
import "./debug.js"; // registra window.dbg (herramientas de observación por consola)
/* ============================= RNG ============================= */

S.rand=mulberry32(193909);

import {
  GH_PER_SEC, MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, START_STOCK, BUILDINGS, BUILD_CATS, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, GOLD_PER_WS, terrainFx
} from "./config.js";

/* ============================= Estado global ============================= */
// El acumulador del bucle de simulación vive en S.acc (lo resetean también editor.js y
// regenerateWorld al reconstruir el mundo; los locals de módulo no se pueden reasignar desde fuera).

/* ============================= Generación del mapa (Europa real) ============================= */

 // 0 = mar, 1.. = índice de país en MAPDATA.countries

// Bolsas jugables rodeadas de páramo (p. ej. un oasis sin salida): quedan fuera del juego.
// Se conserva solo el componente conexo jugable mayor (tierra + rutas marítimas).

// Cordilleras y humedales históricos [lat, lon, radio en grados] para el terreno automático

 // Prípiat, delta del Danubio, marismas neerlandesas
// Vegas fértiles: valles fluviales de alta producción [lat, lon, radio]

// Cada provincia produce UN recurso, sesgado por su terreno. Las ciudades dan Ducados.
// Una minoría produce un bien de lujo regional (especias, paño, vino, sal, seda): son
// escasos a propósito y serán el motor del futuro comercio entre reinos.

// listas de píxeles, bordes, adyacencia, costa y rutas marítimas — se recalcula tras
// generar el mapa y tras cada edición de forma en el editor

/* ============================= Naciones iniciales ============================= */

/* ============================= Caminos ============================= */
// Los caminos son enlaces entre dos provincias adyacentes, no un edificio de provincia.

// Red inicial plausible: radiales de cada capital a sus ciudades, y arterias
// entre capitales vecinas (las viejas calzadas que unen los reinos).

window.tryRoad=tryRoad;

/* ============================= Render del mapa base ============================= */

 // territorio impracticable en vista política

// bordes: frontera exterior de nación (o costa) destacada, divisiones internas sutiles

// capa de caminos: curvas serpenteantes entre provincias enlazadas (las obras, discontinuas).
// La curvatura es determinista (hash de las dos provincias), así el camino siempre luce igual.

/* ============================= Cámara y canvas ============================= */

window.addEventListener("resize",fitCanvas);

/* ============================= Utilidades de juego ============================= */

/* ---- Edificios: coste, tiempo, requisitos y efecto sobre la provincia ---- */

// coste del SIGUIENTE nivel (escala con el nivel ya construido; las obras únicas no escalan)

// motivo por el que NO se puede construir (o null si se puede)

// multiplicador a la producción del recurso propio (gremio, fundición, universidad)

// multiplicador de defensa de la provincia (castillo, ciudadela)

// mantenimiento/tick de una provincia (mantenimiento anual de sus edificios / 12)

// producción NETA/tick de una provincia (ya con moral y menos mantenimiento). La usan
// el tick de simulación y la tesorería; el desglose por fuente lo da provBreakdown().

// desglose por fuente para la UI: de dónde viene cada ingreso y cada gasto de la provincia

// tesorería del reino: producción menos mantenimiento de edificios (en provEconomy) y del ejército

 // km/día

/* ============================= Simulación (1 tick = 1 hora) ============================= */

/* ============================= IA ============================= */

/* ============================= Acciones del jugador ============================= */

/* ============================= UI ============================= */

// efecto legible de un edificio (por nivel)

// línea de coste con iconos; marca en rojo lo que no puedes pagar

// categoría de edificios seleccionada en el índice de la barra inferior
window.setBuildCat=function(k){S.buildFilter=k;refreshBuildBar()};

// barra inferior de edificios (estilo EU4): resumen de la provincia + tarjetas por categoría

window.tryBuild=tryBuild;window.tryRecruit=tryRecruit;
// Ciclo de vida de edificios: deshabilitar (libera dotación, deja de producir/pagar) o reactivar (reparando la parte degradada)
window.toggleBuilding=function(pid,b){
  const p=S.provs[pid]; if(!p||p.owner!==S.player||!(p.buildings[b]>0))return;
  if(!p.bOff)p.bOff={}; if(!p.bCond)p.bCond={};
  if(p.bOff[b]){ // REACTIVAR: repara la parte degradada (coste de creación prorrateado)
    const cond=p.bCond[b]!=null?p.bCond[b]:1, frac=Math.max(0,1-cond);
    if(frac>0.001){
      const base=costFor(p,b),cost={}; for(const k in base)cost[k]=Math.round(base[k]*frac);
      if(!canAfford(S.player,cost)){log("No puedes pagar la reparación de "+BUILDINGS[b].label+" en "+p.name+".");return}
      pay(S.player,cost);
    }
    delete p.bOff[b]; p.bCond[b]=1;
    log(BUILDINGS[b].label+" reactivada en "+p.name+(frac>0.001?" (reparada)":"")+".");
  } else { // DESHABILITAR
    p.bOff[b]=true; if(p.bCond[b]==null)p.bCond[b]=1;
    log(BUILDINGS[b].label+" deshabilitada en "+p.name+": libera dotación y deja de producir; se degradará poco a poco.");
  }
  refreshBuildBar(); refreshTop();
};
window.haltArmy=function(){if(S.selArmy){S.selArmy.path=[];S.selArmy.legDone=0;S.selArmy.legTotal=0;refreshSide()}};
// slider de suministro del ejército: solo actualiza el % y la etiqueta (no reconstruye el panel, para
// no cortar el arrastre); el resto de la ventana se refresca en el siguiente tick.
window.setArmySupply=function(id,val){
  const a=S.armies.find(x=>x.id===+id);if(!a)return;
  a.supply=Math.max(0,Math.min(100,Math.round(+val)));
  const el=document.getElementById("supLbl");
  if(el)el.innerHTML="<span>Reserva local <b>"+a.supply+"%</b></span><b>Reserva nacional "+(100-a.supply)+"%</b>";
  // reparto del consumo en vivo (el desglose por provincia se refresca en el próximo tick)
  const fm=armyFood(a)*730,f=a.supply/100,r1=v=>Math.round(v*10)/10;
  const lo=document.querySelector("#supLoc .n"),na=document.querySelector("#supNat .n");
  if(lo)lo.textContent=r1(fm*f);
  if(na)na.textContent=r1(fm*(1-f));
};
// reclutar-desde-el-mapa: alterna el modo para la unidad u (clic de nuevo lo apaga); abrir Editar
window.setRecruitUnit=function(u){S.recruitUnit=(S.recruitUnit===u?null:u);S.armyEdit=false;refreshSide()};
window.toggleArmyEdit=function(){S.armyEdit=!S.armyEdit;S.recruitUnit=null;refreshSide()};
window.selectArmyId=function(id){const a=S.armies.find(x=>x.id===id);if(a){S.selArmy=a;S.selProv=-1;S.recruitUnit=null;S.armyEdit=false;refreshSide()}};
window.raiseLevies=function(id,n){const a=S.armies.find(x=>x.id===id);if(a){raiseLevies(a,n);refreshSide();refreshTop()}};
window.disbandUnit=function(id,type,n){const a=S.armies.find(x=>x.id===id);if(a){disbandUnit(a,type,n);refreshSide();refreshTop()}};

// panel de Ejército (botón ⚔ del menú de reino): ejércitos + reclutamiento global
// respaldo del icono de un edificio si su sprite (assets/buildings/<clave>.png) no existe: emoji centrado
window.bemoji=function(e){const s=document.createElement("span");s.className="bic bemoji";s.textContent=e;return s};
window.openArmyPanel=function(){S.armyPanelOpen=true;refreshArmyPanel();document.getElementById("armyPanel").style.display="block"};
window.closeArmyPanel=function(){S.armyPanelOpen=false;document.getElementById("armyPanel").style.display="none"};
// --- Tesorería (libro mayor navegable): abrir, cambiar de pestaña, entrar en una categoría y volver ---
window.openTreasury=function(){
  if(S.player<0)return;
  S.treasuryTab="tesoro";S.treasuryPath=[];
  document.getElementById("treasuryOverlay").style.display="flex";
  refreshTreasury();
};
// --- Estamentos (composición social del reino; Fase A: solo lectura) ---
window.openEstates=function(){
  if(S.player<0)return;
  document.getElementById("estatesOverlay").style.display="flex";
  refreshEstates();
};
// --- Mercado del reino (comercio de bienes: precios, oferta/demanda interna y exterior) ---
window.openMercado=function(){
  if(S.player<0)return;
  document.getElementById("mercadoOverlay").style.display="flex";
  refreshMercado();
};
// --- Cortes · Hacienda: ajustar los impuestos de la corona (feudal / alcábala / almojarifazgo) ---
window.openFiscal=function(){
  if(S.player<0)return;
  document.getElementById("fiscalOverlay").style.display="flex";
  refreshFiscal();
};
window.setTax=function(kind,val){
  if(S.player<0)return;
  const N=S.nations[S.player], v=Math.max(0,(+val||0)/100);
  if(kind==="feudal")N.taxRate=v; else if(kind==="alcabala")N.alcabala=v; else if(kind==="almoj")N.almojarifazgo=v;
  refreshFiscal(); refreshTop();
};
// --- LOG ECONÓMICO EN VIVO: el motor acumula S.econLog (una foto por mes, ver economy.js logEconMonth). Un
// enviador asíncrono (fuera del tick) ENVÍA las fotos nuevas por POST a un recolector local (node, puerto 8124)
// que las añade a un fichero que Claude lee en vivo. Funciona en CUALQUIER navegador (sin File System Access API).
// Fallback: botón "💾 Descargar". ---
let _logPosted=0,_logBusy=false,_logWarned=false;
window.startEconLog=async function(){
  S.econLogOn=true;
  try{
    await fetch("http://localhost:8124/",{method:"GET"});
    log("📝 Log en vivo ACTIVO: enviando al recolector (puerto 8124). Déjalo correr; Claude lo lee del disco.");
  }catch(e){
    alert("El recolector de log (puerto 8124) no responde.\nPídele a Claude que lo arranque.\nMientras tanto puedes usar 💾 para descargar el log.");
  }
};
async function flushEconLog(){
  if(_logBusy||!S.econLogOn||S.econLog.length<=_logPosted)return;
  _logBusy=true;
  const slice=S.econLog.slice(_logPosted);
  const body=slice.map(x=>JSON.stringify(x)).join("\n")+"\n"; // text/plain = petición simple (sin preflight CORS)
  try{
    await fetch("http://localhost:8124/log",{method:"POST",headers:{"Content-Type":"text/plain"},body});
    _logPosted=S.econLog.length;
  }catch(e){ if(!_logWarned){console.warn("[econlog] recolector no disponible (puerto 8124); usa 💾 Descargar");_logWarned=true} }
  _logBusy=false;
}
setInterval(flushEconLog,2000);
window.downloadEconLog=function(){
  if(!S.econLog.length){alert("El log está vacío todavía. Deja correr el juego unos meses.");return}
  const blob=new Blob([S.econLog.map(x=>JSON.stringify(x)).join("\n")+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download="basileus_econ_"+(S.econLog[S.econLog.length-1].d||"log")+".jsonl";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  log("💾 Log económico descargado ("+S.econLog.length+" meses).");
};
window.clearEconLog=function(){S.econLog.length=0;_logPosted=0;log("Log económico reiniciado.")};
window.setTreasuryTab=function(t){S.treasuryTab=t;S.treasuryPath=[];refreshTreasury()};
window.treasuryDrill=function(key){S.treasuryPath.push(key);refreshTreasury()};
window.treasuryBack=function(len){S.treasuryPath=S.treasuryPath.slice(0,len);refreshTreasury()};
window.setRecruitProv=function(id){S.recruitProv=+id;refreshArmyPanel()};

// ---- Pantalla de gestión de paz (estilo EU4) ----
window.openPeace=function(n){
  if(!atWar(S.player,n))return;
  S.peaceWith=n;S.peaceMode="out";S.peaceSel=new Set();S.peaceGold=0;S.peaceGive=0;
  refreshPeace();
  document.getElementById("peaceOverlay").style.display="flex";
};
window.openIncomingPeace=function(){
  if(!S.incomingPeace)return;
  S.peaceMode="in";
  refreshPeace();
  document.getElementById("peaceOverlay").style.display="flex";
};
window.closePeace=function(){
  document.getElementById("peaceOverlay").style.display="none";
  if(S.peaceMode==="in")S.incomingPeace=null; // cerrar una oferta entrante = rechazarla
  S.peaceWith=-1;S.peaceMode="out";
};
window.togglePeaceDuchy=function(id){
  if(S.peaceSel.has(id))S.peaceSel.delete(id);else S.peaceSel.add(id);
  refreshPeace();
};
window.setPeaceGold=function(v){
  const m=S.peaceWith;if(m<0)return;
  S.peaceGold=Math.max(0,Math.min(Math.floor(S.nations[m].res.dinero||0),Math.round(+v||0)));
  refreshPeace();
};
window.setPeaceGive=function(v){
  S.peaceGive=Math.max(0,Math.min(Math.floor(S.nations[S.player].res.dinero||0),Math.round(+v||0)));
  refreshPeace();
};
window.proposePeaceDeal=function(){
  const m=S.peaceWith;if(m<0)return;
  const ws=warscore(S.player,m);
  let demandCost=0,concedeVal=0;
  for(const id of S.peaceSel){const d=S.duchies[id];if(!d)continue;if(d.occBy===S.player)demandCost+=duchyValue(d);else if(d.occBy===m)concedeVal+=duchyValue(d)}
  demandCost+=S.peaceGold/GOLD_PER_WS;concedeVal+=S.peaceGive/GOLD_PER_WS;
  if(demandCost-concedeVal>ws+0.001){log(NATIONS[m].name+" rechaza tu propuesta de paz.");return}
  const netGold=S.peaceGold-S.peaceGive;
  const terms={duchies:[...S.peaceSel],gold:Math.abs(netGold)};
  if(netGold>0){terms.goldFrom=m;terms.goldTo=S.player}
  else if(netGold<0){terms.goldFrom=S.player;terms.goldTo=m}
  makePeace(S.player,m,terms);
  window.closePeace();
  refreshDiplomacy();refreshSide();refreshTop();paintAll();
};
window.acceptIncomingPeace=function(){
  const o=S.incomingPeace;if(!o)return;
  makePeace(o.enemy,S.player,o.terms);
  S.incomingPeace=null;
  document.getElementById("peaceOverlay").style.display="none";
  S.peaceMode="out";S.peaceWith=-1;
  refreshDiplomacy();refreshSide();refreshTop();paintAll();
};
window.rejectIncomingPeace=function(){
  S.incomingPeace=null;
  document.getElementById("peaceOverlay").style.display="none";
  S.peaceMode="out";S.peaceWith=-1;
};
// Declarar guerra ya no es instantáneo: abre el CONSEJO de deliberación (Fase 6b). Si ya hay uno abierto,
// lo reabre. El consejo llama aliados, vota y lanza la coalición (o la cancela).
function openCouncilOverlay(){document.getElementById("councilOverlay").style.display="flex";document.getElementById("councilBtn").style.display="block";refreshCouncil();}
function closeCouncilUI(){document.getElementById("councilOverlay").style.display="none";document.getElementById("councilBtn").style.display="none";}
window.playerDeclare=function(n){
  if(S.council){openCouncilOverlay();return;} // ya hay un consejo en curso → reabrir
  const r=openCouncil(S.player,n);
  if(!r.ok){log("No puedes convocar el consejo contra "+NATIONS[n].name+" ahora (tensión o pacto).");return;}
  openCouncilOverlay();
};
window.councilInvite=function(n){councilToggle(n);refreshCouncil()};
window.councilDoConvene=function(){councilConvene();refreshCouncil()};
window.councilLaunch=function(){const r=launchCouncil();if(r.ok){closeCouncilUI();refreshDiplomacy();refreshTop();}else log("No se pudo lanzar la guerra.")};
window.councilCancel=function(){cancelCouncil();closeCouncilUI();refreshDiplomacy()};
document.getElementById("councilBtn").addEventListener("click",openCouncilOverlay);
// --- Paz conjunta del jugador-líder (Etapa 3b) ---
function readCoalGold(){const el=document.getElementById("coalGold");if(el&&S.coalPeace)S.coalPeace.gold=Math.max(0,Math.floor(+el.value||0));}
window.openCoalPeace=function(n){
  const coal=coalitionOf(S.player,n); if(!coal||coal.leadA!==S.player)return;
  S.coalPeace={coalId:coal.id,sel:new Set(),gold:0};
  document.getElementById("coalPeaceOverlay").style.display="flex";refreshCoalPeace();
};
window.coalPeaceToggle=function(did){readCoalGold();const cp=S.coalPeace;if(!cp)return;if(cp.sel.has(did))cp.sel.delete(did);else cp.sel.add(did);refreshCoalPeace();};
window.coalPeaceSign=function(){
  readCoalGold();const cp=S.coalPeace;if(!cp)return;
  coalitionPeace(cp.coalId,{duchies:[...cp.sel],gold:cp.gold});
  S.coalPeace=null;document.getElementById("coalPeaceOverlay").style.display="none";
  refreshDiplomacy();refreshTop();
};
window.coalPeaceCancel=function(){S.coalPeace=null;document.getElementById("coalPeaceOverlay").style.display="none";};
// --- Diplomacia (Fase 4): seleccionar país y acciones. La función de acción toca estado; aquí van
// el parte al periódico (report), el log y el refresco de UI. ---
// --- VISTA DE DIPLOMACIA (componente único). openDiplo() sin argumento = resumen propio; openDiplo(n) =
// diplomacia bilateral con n. Se abre desde el botón del reino, el clic DERECHO en el mapa (sin ejército
// seleccionado) y la ficha de provincia. ---
window.openDiplo=function(n){
  if(S.player<0)return;
  S.diploView=(n!=null&&n>=0&&n!==S.player)?{mode:"nation",target:n}:{mode:"own",target:-1};
  refreshDiplomacy();
  document.getElementById("dipOverlay").style.display="flex";
};
window.diploBack=function(){S.diploView={mode:"own",target:-1};refreshDiplomacy();};
// --- popups de ACCIÓN diplomática: cada acción con ajustes abre su propia ventana ---
window.openDipModal=function(kind,target,extra){
  if(S.player<0)return;
  S.dipModal={kind,target:(target!=null?target:-1),gold:0,ptype:extra};
  refreshDipModal();
  document.getElementById("dipModalOverlay").style.display="flex";
};
window.closeDipModal=function(){S.dipModal=null;document.getElementById("dipModalOverlay").style.display="none";};
// regalo: el importe se ajusta de 5000 en 5000, topado al tesoro
window.giftStep=function(d){
  const M=S.dipModal; if(!M||M.kind!=="gift")return;
  const have=Math.floor(S.nations[S.player].res.dinero||0);
  M.gold=Math.max(0,Math.min(have,(M.gold||0)+d));
  refreshDipModal();
};
// pacto (no agresión / alianza): se propone desde su ventana, no en seco
window.pactSend=function(){
  const M=S.dipModal; if(!M||M.kind!=="pact")return;
  const n=M.target, type=M.ptype;
  window.closeDipModal();
  window.dipPact(n,type);
};
window.giftSend=function(){
  const M=S.dipModal; if(!M||M.kind!=="gift"||!(M.gold>0))return;
  const n=M.target, r=giftGold(S.player,n,M.gold);
  if(r.ok){report("🎁","<b>"+NATIONS[S.player].name+"</b> obsequia "+Math.round(r.given)+" ducados a <b>"+NATIONS[n].name+"</b>.",[S.player,n]);
    log("Regalas "+Math.round(r.given)+" ducados a "+NATIONS[n].name+" (+"+r.gain.toFixed(1)+" de concordia).");}
  else if(r.reason==="sinfondos")log("No tienes ducados para ese regalo.");
  window.closeDipModal();
  refreshDiplomacy();refreshTop();
};
// Declarar/quitar RIVALIDAD (pública): tensión con él y concordia con quien comparta ese rival.
window.dipRival=function(n){
  const mine=(rivalsOf(S.player)||[]).includes(n);
  if(mine){
    removeRival(S.player,n);
    report("⚔","<b>"+NATIONS[S.player].name+"</b> deja de considerar rival a <b>"+NATIONS[n].name+"</b>.",[S.player,n]);
    log("Retiras la rivalidad con "+NATIONS[n].name+".");
  }else{
    if((rivalsOf(S.player)||[]).length>=MAX_RIVALS){log("Ya tienes "+MAX_RIVALS+" rivales: retira uno primero.");return;}
    if(!canRival(S.player,n)){log("No puedes rivalizar a un aliado ni a un co-miembro de tu liga.");return;}
    addRival(S.player,n);
    report("⚔","<b>"+NATIONS[S.player].name+"</b> declara públicamente su rivalidad con <b>"+NATIONS[n].name+"</b>.",[S.player,n]);
    log("Declaras rival a "+NATIONS[n].name+". Quien comparta este rival te verá con mejores ojos.");
  }
  if(S.dipModal&&S.dipModal.kind==="rival")window.closeDipModal(); // el popup se cierra al elegir
  refreshDiplomacy();
};
window.dipSelect=function(n){window.openDiplo(n)};
window.dipInsult=function(n){
  const r=insult(S.player,n);
  if(r.ok){report("⚡","<b>"+NATIONS[S.player].name+"</b> lanza un insulto a <b>"+NATIONS[n].name+"</b>.",[S.player,n]);
    log("Insultas a "+NATIONS[n].name+". La tensión sube.");}
  refreshDiplomacy();
};
// Embargo: solo TOGGLE de estado (sin efecto económico aún; ver diplomacy.js). Gate a ≤ THRESH.embargo.
window.dipEmbargo=function(n){
  const on=!isEmbargoed(S.player,n);
  if(on&&getRel(S.player,n)>THRESH.embargo){log("Necesitas ≤ "+THRESH.embargo+" de tensión para cerrar el mercado.");return;}
  setEmbargo(S.player,n,on);
  log(on?("Cierras el mercado a "+NATIONS[n].name+" (efecto económico pendiente del comercio localizado)."):("Levantas el embargo a "+NATIONS[n].name+"."));
  refreshDiplomacy();
};
// Pactos: proponer no agresión / alianza (con gate de concordia) y romper pacto (traición).
window.dipPact=function(n,type){
  const r=formPact(S.player,n,type);
  if(r.ok){const nm=type==="alliance"?"una alianza":"un pacto de no agresión";
    report("🤝","<b>"+NATIONS[S.player].name+"</b> y <b>"+NATIONS[n].name+"</b> firman "+nm+".",[S.player,n]);
    log("Firmas "+nm+" con "+NATIONS[n].name+".");}
  else if(r.reason==="tension")log("Necesitas "+Math.ceil(r.need)+" de concordia más para eso.");
  refreshDiplomacy();
};
window.dipBreakPact=function(n){
  const r=breakPact(S.player,n);
  if(r.ok){report("💔","<b>"+NATIONS[S.player].name+"</b> rompe su pacto con <b>"+NATIONS[n].name+"</b>.",[S.player,n]);
    log("Rompes el pacto con "+NATIONS[n].name+". La traición dispara la tensión.");}
  refreshDiplomacy();
};
// Fabricar reclamación sobre un ducado del país seleccionado: guarda el casus belli y sube la tensión.
window.dipClaim=function(duchyId){
  const r=fabricateClaim(S.player,duchyId);
  if(r.ok){report("📜","<b>"+NATIONS[S.player].name+"</b> fabrica una reclamación sobre el <b>"+r.duchy+"</b> ("+NATIONS[r.owner].name+").",[S.player,r.owner]);
    log("Reclamas el "+r.duchy+". La tensión con "+NATIONS[r.owner].name+" sube.");}
  refreshDipModal();refreshDiplomacy(); // el popup de reclamaciones sigue abierto
};
// --- LIGAS DEFENSIVAS (Fase 6c): fundar, aplicar (voto IA al momento), votar solicitudes, expulsar, salir ---
// openLeagues() = vista general de ligas; openLeagues(id) = ficha de esa liga (miembros, aplicar, gestionar).
window.openLeagues=function(id){
  S.leagueView=(id!=null&&id>=0)?id:null;
  document.getElementById("leagueOverlay").style.display="flex";refreshLeagues();
};
window.leagueBack=function(){S.leagueView=null;refreshLeagues();};
window.leagueFound=function(){
  const el=document.getElementById("leagueName"), r=createLeague(S.player,el?el.value:"");
  if(r.ok){report("🛡","<b>"+NATIONS[S.player].name+"</b> funda <b>"+r.league.name+"</b>, una liga defensiva.",[S.player]);log("Fundas "+r.league.name+".");}
  else log("No puedes fundar una liga ahora.");
  refreshLeagues();refreshDiplomacy();
};
window.leagueApply=function(id){
  if(!applyToLeague(S.player,id).ok){log("No puedes aplicar a esa liga.");return;}
  const r=resolveApplication(id,S.player), L=leagueOf(S.player); // los miembros (IA) votan al momento
  if(r.admitted){report("🛡","<b>"+NATIONS[S.player].name+"</b> ingresa en <b>"+(L?L.name:"la liga")+"</b>.",[S.player]);log("Te admiten en la liga ("+r.yes+"/"+r.total+" votos).");}
  else log("Tu solicitud fue rechazada ("+r.yes+"/"+r.total+" votos).");
  refreshLeagues();refreshDiplomacy();
};
window.leagueVote=function(ap,accept){
  const myL=leagueOf(S.player); if(!myL)return;
  const r=resolveApplication(myL.id,ap,accept);
  if(r.admitted){report("🛡","<b>"+NATIONS[ap].name+"</b> ingresa en <b>"+myL.name+"</b>.",[S.player,ap]);log(NATIONS[ap].name+" admitido ("+r.yes+"/"+r.total+").");}
  else log(NATIONS[ap].name+" no fue admitido ("+r.yes+"/"+r.total+" votos).");
  refreshLeagues();refreshDiplomacy();
};
window.leagueExpel=function(m){
  const myL=leagueOf(S.player); if(!myL)return;
  const r=proposeExpel(myL.id,m,true);
  if(r.expelled){report("🛡","<b>"+NATIONS[m].name+"</b> es expulsado de <b>"+myL.name+"</b>.",[S.player,m]);log(NATIONS[m].name+" expulsado ("+r.yes+"/"+r.total+").");}
  else log("No hay mayoría para expulsar a "+NATIONS[m].name+" ("+r.yes+"/"+r.total+").");
  refreshLeagues();refreshDiplomacy();
};
window.leagueLeave=function(){
  const myL=leagueOf(S.player); if(!myL)return;
  const nm=myL.name, r=leaveLeague(S.player);
  if(r.ok){report("🛡","<b>"+NATIONS[S.player].name+"</b> abandona <b>"+nm+"</b>.",[S.player]);log(r.disbanded?("Sales de "+nm+"; la liga se disuelve."):("Sales de "+nm+"."));}
  refreshLeagues();refreshDiplomacy();
};
// --- LLAMADA A LAS ARMAS (Fase 7): atacan a un aliado/co-miembro de liga → acudir a defender o rehusar. ---
function closeCallToArms(){const el=document.getElementById("callToArmsOverlay");if(el)el.style.display="none";}
window.openCallToArms=function(){if(!S.callToArms)return;document.getElementById("callToArmsOverlay").style.display="flex";refreshCallToArms();};
window.acceptCallToArms=function(){
  const c=S.callToArms;if(!c)return;
  const joined=playerJoinDefense(c.coalId);
  if(joined)report("⚔","<b>"+NATIONS[S.player].name+"</b> acude a defender a <b>"+NATIONS[c.victim].name+"</b>.",[S.player,c.victim,...c.attackers]);
  else log("La guerra ya no admite tu ayuda.");
  S.callToArms=null;closeCallToArms();
  refreshDiplomacy();refreshTop();
};
window.rejectCallToArms=function(){
  const c=S.callToArms;if(!c){closeCallToArms();return;}
  const r=refuseDefense(S.player,c.victim); // rehusar SEVERA el vínculo + reputación (traición)
  report("💔","<b>"+NATIONS[S.player].name+"</b> rehúsa acudir en defensa de <b>"+NATIONS[c.victim].name+"</b>.",[S.player,c.victim,...(r.hits||[])]);
  log("Rehúsas la llamada a las armas de "+NATIONS[c.victim].name+((r.broke&&r.broke.length)?" (rompes "+r.broke.join(" y ")+"; tu reputación sufre).":"."));
  S.callToArms=null;closeCallToArms();
  refreshDiplomacy();refreshLeagues();
};

/* ============================= Observador / tomar-soltar el mando ============================= */
// Modo espectador: la partida corre con TODAS las naciones bajo IA (S.player=-1). Desde el
// Registro puedes TOMAR el mando de cualquier reino para revisar sus estadísticas y actuar, y
// SOLTARLO de vuelta a la IA cuando acabes, para observar a otro o a ninguno en concreto.
window.takeControl=function(n){
  if(n==null||n<0||n>=NPLAY||!S.nations[n].alive)return;
  if(S.player===n)return;
  if(S.player>=0)S.nations[S.player].ai=true;   // el reino que soltabas vuelve a la IA
  S.player=n;
  S.nations[n].ai=false;
  S.started=true;
  resetTsyLedger(); // reinicia el tesoro mensual para la nación que tomas
  S.recruitProv=S.nations[n].capital;
  buildRealmMenu();
  const cap=S.provs[S.nations[n].capital];
  if(cap){S.panX=canvas.width/2-cap.x*S.zoom;S.panY=canvas.height/2-cap.y*S.zoom;clampPan();S.selProv=cap.id}
  document.getElementById("ledgerOverlay").style.display="none";
  refreshTop();refreshSide();refreshLedger();
  log("Tomas el mando de "+NATIONS[n].name+". Actúa a tu antojo; suéltalo cuando quieras desde el Registro.");
};
window.releaseControl=function(){
  if(S.player<0)return;
  const n=S.player;
  S.nations[n].ai=true;   // vuelve a manos de la IA
  S.player=-1;
  document.getElementById("realmMenu").className="";
  document.getElementById("side").style.display="none";
  document.getElementById("armyPanel").style.display="none";
  S.selArmy=null;S.armyPanelOpen=false;
  refreshTop();refreshSide();refreshLedger();
  log("Sueltas el mando de "+NATIONS[n].name+": vuelve a actuar por IA. Sigues observando la partida.");
};

/* ============================= Editor de formas de provincia ============================= */
// Al seleccionar una provincia se vectoriza su contorno (trazado de borde + simplificación).
// Editar los vértices y soltar re-rasteriza: los píxeles ganados se toman de la provincia
// vecina y los perdidos se le ceden. El mapa editado se guarda como instantánea (localStorage)
// y se carga al arrancar en lugar de regenerarse.
// sesión de edición: nada se persiste hasta «Guardar cambios»

window.saveChanges=function(){
  saveProvMap();
  S.editBackup=buildSnapshot();
  S.editDirty=false;
  refreshEditorPanel();
  log("Mapa guardado en el navegador.");
};
window.undoEdit=function(){
  if(!S.editUndoStack.length)return;
  restoreWorldFromSnap(S.editUndoStack.pop());
  S.editDirty=S.editUndoStack.length>0;
  refreshEditorPanel();
};
window.discardChanges=function(){
  if(!confirm("Se restaurará el estado del último guardado. ¿Continuar?"))return;
  restoreWorldFromSnap(S.editBackup);
  S.editUndoStack=[];S.editDirty=false;
  refreshEditorPanel();
};
window.setTool=function(t){
  S.editTool=t;S.mergeFrom=-1;S.splitFrom=-1;S.roadFrom=-1;S.dragVi=-1;
  refreshEditorPanel();
};
window.clearOwnerPaint=function(){S.ownerPaint=-1;refreshEditorPanel()};

// --- vectorización del contorno ---

// --- re-rasterizado de la forma editada ---

// --- fusión: la provincia origen se disuelve dentro de la destino ---

// --- división: cortar una provincia por la cuerda entre dos vértices ---

// --- instantánea del mapa editado ---

function initWorld(){
  // precedencia del mapa: (1) ediciones locales del jugador en localStorage,
  // (2) mapa OFICIAL empaquetado en el repo (OFFICIAL_MAP, cargado como global), (3) generacion procedural.
  // El oficial evita que cada carga regenere un mapa distinto y fija el que se ve en el deploy.
  const snap=loadProvMapSnapshot();
  if(snap){
    // auto-reparación: si el mapa editado guardado es incompatible (versión antigua/corrupto)
    // y su carga falla, se descarta y se regenera, para no dejar el juego atascado al arrancar
    try{
      loadProvMap(snap);
      return;
    }catch(e){
      console.error("Mapa editado guardado incompatible; se descarta y regenera:",e);
      try{localStorage.removeItem("basileus_provmap");localStorage.removeItem("basileus_anchors")}catch(_){}
      S.provs=[];S.armies=[];S.customRoads=false;
    }
  }
  if(typeof OFFICIAL_MAP!=="undefined"&&OFFICIAL_MAP){
    try{
      loadProvMap(OFFICIAL_MAP);
      return;
    }catch(e){
      console.error("Mapa oficial incompatible; se regenera:",e);
      S.provs=[];S.armies=[];S.customRoads=false;
    }
  }
  generateMap();
}
function regenerateWorld(){
  document.getElementById("loadMsg").style.display="flex";
  document.getElementById("endOverlay").style.display="none";
  setTimeout(()=>{
    S.provs=[];S.armies=[];S.wars=new Map();S.truces=new Map();S.armyIdSeq=1;S.duchies=[];S.reports=[];
    S.rel=new Map();S.relMonthKey=-1;S.dipCd=new Map();S.dipSel=-1;S.embargoes=new Set();S.claims=new Set();S.pacts=new Map();
    S.council=null;S.coalitions=new Map();S.coalSeq=0;S.leagues=[];S.leagueSeq=0;S.callToArms=null;S.diploView={mode:"own",target:-1};S.leagueView=null;
    S.peaceWith=-1;S.peaceSel=new Set();S.peaceGold=0;S.incomingPeace=null;
    S.player=-1;S.hour=0;S.acc=0;S.started=false;S.gameOver=false;
    S.selProv=-1;S.selArmy=null;S.battleFlash={};clearSelOutline();
    S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;
    S.recruitProv=-1;S.armyPanelOpen=false;
    document.getElementById("realmMenu").className="";
    document.getElementById("side").style.display="none";
    document.getElementById("armyPanel").style.display="none";
    initWorld();setupNations();if(!S.customRoads)generateRoads();paintAll();drawRoads();
    document.getElementById("loadMsg").style.display="none";
    if(S.editMode){
      S.editBackup=buildSnapshot();S.editUndoStack=[];S.editDirty=false;
      refreshEditorPanel();
    }else showNationPicker();
  },30);
}

// --- panel y acciones ---

window.renameProvince=function(){
  if(S.shapeSel<0)return;
  const v=document.getElementById("provName").value.trim();
  if(!v||v===S.provs[S.shapeSel].name)return;
  if(S.provs.some(p=>p.id!==S.shapeSel&&p.name===v)){alert("Ya existe una provincia con ese nombre.");return}
  pushUndo();
  S.provs[S.shapeSel].name=v;S.provs[S.shapeSel].named=true;
  refreshEditorPanel();
};
window.deselectShape=function(){S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;refreshEditorPanel()};
window.setTerrain=function(t){
  if(S.shapeSel<0||!TERRAINS[t]||S.provs[S.shapeSel].terrain===t)return;
  pushUndo();
  S.provs[S.shapeSel].terrain=t;
  if(S.terrainView)repaintProvince(S.shapeSel);
  refreshEditorPanel();
};
window.toggleWasteland=function(){
  if(S.shapeSel<0)return;
  pushUndo();
  const p=S.provs[S.shapeSel];
  p.wasteland=!p.wasteland;
  if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false;p.pop=0}
  else{p.pop=null;assignPopulation()} // al reactivarla, el modelo la resiembra (solo esta, que está a null)
  repaintProvince(S.shapeSel);
  refreshEditorPanel();
};
// Editor de población: fija a mano la población de la provincia seleccionada (valor persistente
// que viaja con el mapa y el modelo ya no sobrescribe). "Fijar" toma el input; los botones escalan.
window.setProvPop=function(){
  if(S.shapeSel<0)return;
  const p=S.provs[S.shapeSel];
  if(p.wasteland)return;
  const el=document.getElementById("provPop");
  const v=Math.max(0,Math.round(parseFloat(el&&el.value)||0));
  if(v===Math.round(p.pop||0))return;
  pushUndo();
  p.pop=v;
  if(S.popView)repaintProvince(S.shapeSel);
  refreshEditorPanel();
};
window.scaleProvPop=function(f){
  if(S.shapeSel<0)return;
  const p=S.provs[S.shapeSel];
  if(p.wasteland)return;
  pushUndo();
  p.pop=Math.max(0,Math.round((p.pop||0)*f));
  if(S.popView)repaintProvince(S.shapeSel);
  refreshEditorPanel();
};
function syncMapModeUI(){
  const cur=S.terrainView?"Terreno":S.popView?"Población":S.resView?"Recursos":"Político";
  const mb=document.getElementById("mapBtn");
  if(mb){mb.textContent="🗺 "+cur;mb.classList.toggle("active",cur!=="Político");}
  const tl=document.getElementById("terrLegend");if(tl)tl.style.display=S.terrainView?"block":"none";
  const pl=document.getElementById("popLegend");if(pl)pl.style.display=S.popView?"block":"none";
  const rl=document.getElementById("resLegend");if(rl)rl.style.display=S.resView?"block":"none";
}
// vista de mapa: político (null) o "terrain"/"pop"/"res" (excluyentes entre sí)
window.setMapView=function(mode){
  S.terrainView=mode==="terrain";S.popView=mode==="pop";S.resView=mode==="res";
  paintAll();
  syncMapModeUI();
  if(S.editMode)refreshEditorPanel();
};
// wrappers (el panel del editor usa toggleTerrainView para alternar terreno/político)
window.toggleTerrainView=function(){window.setMapView(S.terrainView?null:"terrain")};
window.togglePopView=function(){window.setMapView(S.popView?null:"pop")};
window.toggleResView=function(){window.setMapView(S.resView?null:"res")};
window.setProvTab=function(t){
  S.provTab=(S.provTab===t?null:t); // clic en el botón activo lo cierra (pestañas mutuamente excluyentes)
  refreshSide();
};
window.downloadMap=function(){
  const s=JSON.stringify(buildSnapshot());
  const blob=new Blob([s],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="mapa_editado.json";
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(a.href);
};
window.importMapFile=function(input){
  const f=input.files&&input.files[0];
  if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const snap=JSON.parse(rd.result);
      if(!snap||snap.v!==1||snap.W!==MW||snap.H!==MH)throw new Error("formato no válido");
      localStorage.setItem("basileus_provmap",JSON.stringify(snap));
      regenerateWorld();
    }catch(e){alert("No se pudo importar el mapa: "+e.message)}
  };
  rd.readAsText(f);
};
window.restoreGenerated=function(){
  if(!confirm("Se descartará el mapa editado y se regenerará el original. ¿Continuar?"))return;
  try{
    localStorage.removeItem("basileus_provmap");
    localStorage.removeItem("basileus_anchors");
  }catch(e){}
  regenerateWorld();
};
window.exitEditorBtn=exitEditor;

// --- pruebas de impacto sobre el polígono ---

document.getElementById("editBtn").addEventListener("click",()=>{S.editMode?exitEditor():enterEditor()});
document.getElementById("editFromPicker").addEventListener("click",enterEditor);
window.addEventListener("keydown",e=>{
  if(!S.editMode)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();
    window.undoEdit();
    return;
  }
  if(e.key==="Escape"){
    if(S.mergeFrom>=0||S.splitFrom>=0||S.roadFrom>=0){S.mergeFrom=-1;S.mergeCur=null;S.splitFrom=-1;S.splitCur=null;S.roadFrom=-1;S.roadCur=null;return}
    if(S.shapeSel>=0){S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;refreshEditorPanel()}
  }
});

/* ============================= Entrada ============================= */
let dragging=false,dragMoved=false,lastMx=0,lastMy=0;
function evWorld(e){
  const r=canvas.getBoundingClientRect();
  return[(e.clientX-r.left-S.panX)/S.zoom,(e.clientY-r.top-S.panY)/S.zoom];
}
function provAtWorld(wx,wy){
  const ix=wx|0,iy=wy|0;
  return(ix>=0&&iy>=0&&ix<MW&&iy<MH)?S.provIdx[iy*MW+ix]:-1;
}
canvas.addEventListener("mousedown",e=>{
  if(e.button===0){
    if(S.editMode){
      const[wx,wy]=evWorld(e);
      if(S.editTool==="merge"){
        const pid=provAtWorld(wx,wy);
        if(pid>=0){S.mergeFrom=pid;S.mergeCur=[wx,wy];return}
      }else if(S.editTool==="roads"){
        const pid=provAtWorld(wx,wy);
        if(pid>=0&&!S.provs[pid].wasteland){S.roadFrom=pid;S.roadCur=[wx,wy];return}
      }else if(S.editTool==="split"&&S.shapeSel>=0&&S.shapePoly.length){
        const vi=vertexAt(wx,wy);
        if(vi>=0){S.splitFrom=vi;S.splitCur=[wx,wy];return}
      }else if(S.editTool==="shape"&&S.shapeSel>=0&&S.shapePoly.length){
        const vi=vertexAt(wx,wy);
        if(vi>=0){S.dragVi=vi;S.dragWas=[S.shapePoly[vi][0],S.shapePoly[vi][1]];S.dragIns=false;return}
        const seg=nearestSegment(S.shapePoly,wx,wy);
        if(seg.i>=0&&seg.d<6/S.zoom){
          S.shapePoly.splice(seg.i+1,0,[seg.x,seg.y]);
          S.dragVi=seg.i+1;
          S.dragWas=[seg.x,seg.y];S.dragIns=true;
          refreshEditorPanel();
          return;
        }
      }
    }
    dragging=true;dragMoved=false;lastMx=e.clientX;lastMy=e.clientY;
  }
});
window.addEventListener("mousemove",e=>{
  if(S.dragVi>=0&&S.shapeSel>=0){
    const[wx,wy]=evWorld(e);
    S.shapePoly[S.dragVi][0]=Math.max(0.5,Math.min(MW-0.5,wx));
    S.shapePoly[S.dragVi][1]=Math.max(0.5,Math.min(MH-0.5,wy));
    return;
  }
  if(S.mergeFrom>=0){S.mergeCur=evWorld(e);return}
  if(S.roadFrom>=0){S.roadCur=evWorld(e);return}
  if(S.splitFrom>=0){S.splitCur=evWorld(e);return}
  if(!dragging)return;
  const dx=e.clientX-lastMx,dy=e.clientY-lastMy;
  if(Math.abs(dx)+Math.abs(dy)>3)dragMoved=true;
  if(dragMoved){S.panX+=dx;S.panY+=dy;clampPan()}
  lastMx=e.clientX;lastMy=e.clientY;
});
window.addEventListener("mouseup",e=>{
  if(e.button!==0)return;
  if(S.dragVi>=0){
    const vi=S.dragVi;S.dragVi=-1;
    const moved=!S.dragWas||S.shapePoly[vi][0]!==S.dragWas[0]||S.shapePoly[vi][1]!==S.dragWas[1];
    if(!moved){
      if(S.dragIns)S.shapePoly.splice(vi,1); // clic sin arrastre sobre un borde: no insertar
      S.dragWas=null;S.dragIns=false;
      refreshEditorPanel();
      return;
    }
    S.dragWas=null;S.dragIns=false;
    applyShape(S.shapeSel,S.shapePoly);
    S.shapePoly=traceProvince(S.shapeSel);
    refreshEditorPanel();
    return;
  }
  if(S.mergeFrom>=0){
    const from=S.mergeFrom;
    S.mergeFrom=-1;S.mergeCur=null;
    const[wx,wy]=evWorld(e);
    const pid=provAtWorld(wx,wy);
    if(pid>=0&&pid!==from)mergeProvinces(from,pid);
    return;
  }
  if(S.roadFrom>=0){
    const from=S.roadFrom;
    S.roadFrom=-1;S.roadCur=null;
    const[wx,wy]=evWorld(e);
    const pid=provAtWorld(wx,wy);
    if(pid>=0&&pid!==from&&!S.provs[pid].wasteland)toggleRoadEdit(from,pid);
    return;
  }
  if(S.splitFrom>=0){
    const from=S.splitFrom;
    S.splitFrom=-1;S.splitCur=null;
    const[wx,wy]=evWorld(e);
    const vi=vertexAt(wx,wy);
    if(vi>=0&&vi!==from&&S.shapeSel>=0){
      const n=S.shapePoly.length;
      const ringDist=Math.min((vi-from+n)%n,(from-vi+n)%n);
      if(ringDist>=2)splitProvince(S.shapeSel,S.shapePoly,from,vi);
      else alert("Elige dos vértices no contiguos.");
    }
    return;
  }
  const wasDrag=dragMoved;dragging=false;
  if(S.editMode){
    if(wasDrag||e.target!==canvas)return;
    const[ewx,ewy]=evWorld(e);
    const pid=provAtWorld(ewx,ewy);
    if(S.editTool==="owner"){
      if(pid>=0){
        if(S.ownerPaint<0){S.ownerPaint=S.provs[pid].owner;refreshEditorPanel()}
        else setProvinceOwner(pid,S.ownerPaint);
      }
      return;
    }
    if(pid>=0){S.shapeSel=pid;S.shapePoly=traceProvince(pid)}
    else{S.shapeSel=-1;S.shapePoly=[]}
    refreshEditorPanel();
    return;
  }
  if(wasDrag||!S.started)return;
  const r=canvas.getBoundingClientRect();
  if(e.target!==canvas)return;
  const wx=(e.clientX-r.left-S.panX)/S.zoom, wy=(e.clientY-r.top-S.panY)/S.zoom;
  // modo RECLUTAR DESDE EL MAPA: clic en una provincia apta recluta allí (auto-rally al ejército
  // seleccionado); se mantiene el modo para reclutar en varias. No cambia la selección.
  if(S.recruitUnit){
    const ix=wx|0,iy=wy|0;
    const pid=(ix>=0&&iy>=0&&ix<MW&&iy<MH)?S.provIdx[iy*MW+ix]:-1;
    if(pid>=0&&recruitable(S.provs[pid],S.recruitUnit))tryRecruit(pid,S.recruitUnit,S.selArmy?S.selArmy.prov:null);
    return;
  }
  // ejército propio bajo el cursor: hitbox ajustada al sprite pequeño (centrada en el cuerpo,
  // no en los pies) y solo sobre los propios, para no tapar el clic a la provincia
  let hit=null,hd=12*12;
  for(const a of S.armies){
    if(a.nation!==S.player)continue;
    const pos=armyPos(a);
    const d=(pos.x-wx)**2+(pos.y-3-wy)**2;
    if(d<hd){hd=d;hit=a}
  }
  if(hit){S.selArmy=hit;S.selProv=-1;refreshSide();return}
  const ix=wx|0,iy=wy|0;
  if(ix>=0&&iy>=0&&ix<MW&&iy<MH&&S.provIdx[iy*MW+ix]>=0){
    S.selProv=S.provIdx[iy*MW+ix];S.selArmy=null;
  }else{S.selProv=-1;S.selArmy=null}
  refreshSide();
});
canvas.addEventListener("contextmenu",e=>{
  e.preventDefault();
  if(S.editMode){
    if(S.editTool==="owner"){
      const r=canvas.getBoundingClientRect();
      const wx=(e.clientX-r.left-S.panX)/S.zoom, wy=(e.clientY-r.top-S.panY)/S.zoom;
      const pid=provAtWorld(wx,wy);
      if(pid>=0){S.ownerPaint=S.provs[pid].owner;refreshEditorPanel()}
      return;
    }
    if(S.shapeSel>=0&&S.shapePoly.length>3){
      const r=canvas.getBoundingClientRect();
      const wx=(e.clientX-r.left-S.panX)/S.zoom, wy=(e.clientY-r.top-S.panY)/S.zoom;
      const vi=vertexAt(wx,wy);
      if(vi>=0){
        S.shapePoly.splice(vi,1);
        applyShape(S.shapeSel,S.shapePoly);
        S.shapePoly=traceProvince(S.shapeSel);
        refreshEditorPanel();
      }
    }
    return;
  }
  if(!S.started)return;
  const r=canvas.getBoundingClientRect();
  const wx=(e.clientX-r.left-S.panX)/S.zoom, wy=(e.clientY-r.top-S.panY)/S.zoom;
  const ix=wx|0,iy=wy|0;
  if(ix<0||iy<0||ix>=MW||iy>=MH)return;
  const t=S.provIdx[iy*MW+ix];
  if(t<0)return;
  // SIN ejército seleccionado, el clic derecho sobre un país ABRE su diplomacia (con ejército = orden de marcha)
  if(!S.selArmy||S.selArmy.nation!==S.player){
    const o=S.provs[t].owner;
    if(S.player>=0&&o>=0&&o<NPLAY&&o!==S.player&&S.nations[o]&&S.nations[o].alive)window.openDiplo(o);
    return;
  }
  if(orderMove(S.selArmy,t)){
    S.selArmy.muster=null; // mover a mano cancela la espera de levas
    const tp=S.provs[t];
    if(tp.owner!==S.player&&tp.owner<NPLAY&&!atWar(S.player,tp.owner))
      log("Aviso: entrar en "+NATIONS[tp.owner].name+" declarará la guerra.");
    refreshSide();
  }
});
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  const mx=e.clientX-r.left,my=e.clientY-r.top;
  const old=S.zoom;
  S.zoom=Math.max(0.35,Math.min(5,S.zoom*(e.deltaY<0?1.15:0.87)));
  S.panX=mx-(mx-S.panX)*S.zoom/old;
  S.panY=my-(my-S.panY)*S.zoom/old;
  clampPan();
},{passive:false});

document.querySelectorAll(".spdBtn").forEach(b=>b.addEventListener("click",()=>{
  S.speed=+b.dataset.s;
  document.querySelectorAll(".spdBtn").forEach(x=>x.classList.toggle("active",x===b));
}));
document.getElementById("helpBtn").addEventListener("click",()=>document.getElementById("helpOverlay").style.display="flex");
document.getElementById("dipBtn").addEventListener("click",()=>window.openDiplo());
document.getElementById("reportsBtn").addEventListener("click",()=>{refreshReports();document.getElementById("reportsOverlay").style.display="flex"});
document.getElementById("ledgerBtn").addEventListener("click",()=>{refreshLedger();document.getElementById("ledgerOverlay").style.display="flex"});
{
  // dropdown de mapas: en político abre el menú; en cualquier vista, vuelve a político
  const mb=document.getElementById("mapBtn"),ml=document.getElementById("mapList");
  if(mb&&ml){
    mb.addEventListener("click",e=>{
      e.stopPropagation();
      if(S.terrainView||S.popView||S.resView){window.setMapView(null);ml.style.display="none";}
      else ml.style.display=(ml.style.display==="none"?"block":"none");
    });
    ml.querySelectorAll("div").forEach(d=>d.addEventListener("click",e=>{
      e.stopPropagation();window.setMapView(d.dataset.m);ml.style.display="none";
    }));
    document.addEventListener("click",()=>{ml.style.display="none"});
  }
}
{
  // leyenda del mapa de recursos: color por bien de la provincia (mismos hex que resColor en render.js)
  const rl=document.getElementById("resLegend");
  if(rl){
    const legend=[["#d9c463","Grano"],["#4a7c3f","Madera"],["#9a948a","Piedra"],["#6b7078","Hierro"],
      ["#b0824e","Caballos"],["#d9713a","Especias"],["#7fb0c0","Paño"],["#8a3d6b","Vino"],
      ["#e6e0cf","Sal"],["#d18ac0","Seda"],["#cfd3d9","Plata"],["#e8c24a","Oro"]];
    let lh="<b style='font-size:12px'>Recurso de la provincia</b>";
    for(const[c,lab]of legend)lh+="<div class='row' style='margin:2px 0'><span><span class='chip' style='background:"+c+"'></span> "+lab+"</span></div>";
    lh+="<div class='row' style='margin:2px 0'><span><span class='chip' style='background:#847c6a'></span> Impracticable</span></div>";
    rl.innerHTML=lh;
  }
}
{
  // tooltip flotante reutilizable: cualquier elemento con [data-tip] lo muestra al pasar el ratón
  const tipEl=document.getElementById("tip");
  if(tipEl){
    // data-tip = texto plano · data-tiph = tooltip HTML ESTRUCTURADO (tablas de desglose, etc.)
    document.addEventListener("mouseover",e=>{const t=e.target.closest&&e.target.closest("[data-tip],[data-tiph]");if(t){
      const html=t.getAttribute("data-tiph");
      if(html!=null){tipEl.innerHTML=html;tipEl.classList.add("rich")} else {tipEl.textContent=t.getAttribute("data-tip");tipEl.classList.remove("rich")}
      tipEl.style.display="block";
    }});
    document.addEventListener("mouseout",e=>{const t=e.target.closest&&e.target.closest("[data-tip],[data-tiph]");if(t)tipEl.style.display="none"});
    document.addEventListener("mousemove",e=>{if(tipEl.style.display!=="block")return;let x=e.clientX+14,y=e.clientY+16;const w=tipEl.offsetWidth,h=tipEl.offsetHeight;if(x+w>innerWidth-8)x=innerWidth-8-w;if(y+h>innerHeight-8)y=innerHeight-8-h;tipEl.style.left=x+"px";tipEl.style.top=y+"px"});
  }
}
window.toggleGraph=function(){
  S.showGraph=!S.showGraph;
  const b=document.getElementById("graphBtn");
  if(b)b.classList.toggle("active",S.showGraph);
};
{
  const gb=document.getElementById("graphBtn");
  if(gb){gb.classList.toggle("active",S.showGraph);gb.addEventListener("click",()=>window.toggleGraph())}
}
{
  let lh="<b style='font-size:12px'>Terrenos</b>";
  for(const k of TERRAIN_KEYS){
    lh+="<div class='row' style='margin:2px 0'><span><span class='chip' style='background:"+TERRAINS[k].color+
      "'></span> "+TERRAINS[k].label+"</span><span style='color:#9aa3ad;font-size:10px'>"+terrainFx(k)+"</span></div>";
  }
  document.getElementById("terrLegend").innerHTML=lh;
}
{
  // leyenda del mapa de población: rampa con los mismos cortes que popColor en render.js
  const pl=document.getElementById("popLegend");
  if(pl){
    const stops=[["#f7f2d8","despoblado"],["#f4c752","~2.000"],["#e07a2a","~15.000"],
      ["#b5341f","~60.000"],["#6e1414","gran urbe"]];
    let lh="<b style='font-size:12px'>Población de la provincia</b>";
    lh+="<div style='height:12px;margin:6px 0 3px;border-radius:3px;border:1px solid #0006;"+
      "background:linear-gradient(90deg,#f7f2d8,#f4c752,#e07a2a,#b5341f,#6e1414)'></div>";
    lh+="<div class='row' style='font-size:10px;color:#9aa3ad'>";
    for(const s of stops)lh+="<span>"+s[1]+"</span>";
    lh+="</div>";
    lh+="<div class='row' style='margin-top:5px'><span><span class='chip' style='background:#847c6a'></span> Impracticable</span>"+
      "<span style='color:#9aa3ad;font-size:10px'>sin población</span></div>";
    pl.innerHTML=lh;
  }
}

/* ============================= Dibujo ============================= */

/* ============================= Bucle de simulación ============================= */
// Ritmo real: a 1x, 1 hora real = 1 mes de juego (12 h reales = 1 año; la partida
// completa, 1444-1544, dura ~50 días reales). 60x y 720x son velocidades de prueba.
setInterval(()=>{
  if(!S.started||S.gameOver)return;
  S.acc+=S.speed*GH_PER_SEC/4;
  let steps=0;
  while(S.acc>=1&&steps<60){S.acc-=1;hourTick();steps++}
  if(steps){refreshTop();refreshSide();refreshTreasury();refreshEstates();refreshMercado()} // los refresh solo actúan si su overlay está abierto
  // oferta de paz de la IA: abrir la pantalla si no hay ya un overlay visible
  if(S.incomingPeace&&document.getElementById("peaceOverlay").style.display!=="flex")window.openIncomingPeace();
  // llamada a las armas: atacan a un aliado/co-miembro de liga → abrir la pantalla de decisión
  if(S.callToArms&&document.getElementById("callToArmsOverlay").style.display!=="flex")window.openCallToArms();
},250);

/* ============================= Partida guardada ============================= */
// La campaña dura ~50 días reales: se guarda sola (cada día de juego y al cerrar)
// y al volver el mundo se pone al día con el tiempo real transcurrido (máx. 1 año de juego).

window.addEventListener("beforeunload",saveGame);

/* ============================= Arranque ============================= */

function init(){
  try{
    fitCanvas();
    initWorld();
    setupNations();
    if(!S.customRoads)generateRoads();
    paintAll();
    drawRoads();
    S.zoom=Math.max(0.35,Math.min(canvas.width/MW,canvas.height/MH));
    S.panX=(canvas.width-MW*S.zoom)/2;S.panY=(canvas.height-MH*S.zoom)/2;
    document.getElementById("loadMsg").style.display="none";
    showNationPicker();
    refreshTop();
    requestAnimationFrame(draw);
  }catch(err){
    document.getElementById("loadMsg").textContent="Error al generar el mapa: "+err.message;
    console.error(err);
  }
}
setTimeout(init,30);
