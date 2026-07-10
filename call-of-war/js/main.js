import {
  saveGame, loadSaveMeta, continueGame, runCatchup, buildSnapshot, saveProvMap, loadProvMapSnapshot, loadProvMap
} from "./save.js";
import {
  enterEditor, exitEditor, pushUndo, restoreWorldFromSnap, toggleRoadEdit, setProvinceOwner, dpSimplify, simplifyRing, traceProvince, applyShape, mergeProvinces, rasterPoly, keepLargestFragment, splitProvince, refreshEditorPanel, vertexAt, nearestSegment
} from "./editor.js";
import {
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, showNationPicker, refreshArmyPanel
} from "./ui.js";
import {
  atWar, declareWar, makePeace, underTruce, spawnArmy, setupNations, tryRoad, nbrs, bfsPath, startLeg, orderMove, captureProv, hourTick, resolveBattles, applyDamage, mergeIdle, aiTurn, findTarget, tryBuild, tryRecruit, checkVictory, armiesIn
} from "./sim.js";
import {
  hex2rgb, provColor, paintAll, borderIsOuter, setBorderPx, borderIsWasteEdge, paintBorders, updateBordersAround, repaintProvince, roadCurve, drawRoads, fitCanvas, clampPan, armyPos, draw, drawArrow, drawEditorOverlay, NCOL, TCOL, WASTECOL, baseC, baseCtx, borderC, borderCtx, roadsC, canvas, baseData, borderData, clearSelOutline
} from "./render.js";
import {
  canAfford, pay, lvlOf, costFor, timeFor, buildSpeedBonus, buildMax, buildBlock, provProdMul, provDefMul, provUpkeep, provEconomy, provBreakdown, nationEconomy, armyCount, armyAtk, armyDef, armyHp, armySpd, nationStrength, nationProvCount, recruitTime
} from "./economy.js";
import {
  mulberry32, hashN, genName, SYL_A, SYL_M, SYL_B, decodeCountries, RLE_ALPHA, countryAt, generateMap, isolateWastePockets, MOUNTAIN_ZONES, MARSH_ZONES, FERTILE_ZONES, pxToLonLat, assignTerrain, assignResources, rebuildProvinceData, kmBetween, roadKey, hasRoad, landPath, generateRoads
} from "./mapgen.js";
import { S } from "./state.js";
/* ============================= RNG ============================= */

S.rand=mulberry32(193909);

import {
  GH_PER_SEC, MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, START_STOCK, BUILDINGS, BUILD_CATS, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, terrainFx
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
window.haltArmy=function(){if(S.selArmy){S.selArmy.path=[];S.selArmy.legDone=0;S.selArmy.legTotal=0;refreshSide()}};
window.selectArmyId=function(id){const a=S.armies.find(x=>x.id===id);if(a){S.selArmy=a;S.selProv=-1;refreshSide()}};

// panel de Ejército (botón ⚔ del menú de reino): ejércitos + reclutamiento global
window.openArmyPanel=function(){S.armyPanelOpen=true;refreshArmyPanel();document.getElementById("armyPanel").style.display="block"};
window.closeArmyPanel=function(){S.armyPanelOpen=false;document.getElementById("armyPanel").style.display="none"};
window.setRecruitProv=function(id){S.recruitProv=+id;refreshArmyPanel()};

window.proposePeace=function(n){
  if(nationStrength(n)<nationStrength(S.player)*0.8){makePeace(S.player,n)}
  else log(NATIONS[n].name+" rechaza tu propuesta de paz.");
  refreshDiplomacy();
};
window.playerDeclare=function(n){declareWar(S.player,n);refreshDiplomacy()};

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
  generateMap();
}
function regenerateWorld(){
  document.getElementById("loadMsg").style.display="flex";
  document.getElementById("endOverlay").style.display="none";
  setTimeout(()=>{
    S.provs=[];S.armies=[];S.wars=new Set();S.truces=new Map();S.armyIdSeq=1;
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
  if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
  repaintProvince(S.shapeSel);
  refreshEditorPanel();
};
window.toggleTerrainView=function(){
  S.terrainView=!S.terrainView;
  paintAll();
  document.getElementById("terrBtn").textContent=S.terrainView?"Político":"Terreno";
  document.getElementById("terrLegend").style.display=S.terrainView?"block":"none";
  if(S.editMode)refreshEditorPanel();
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
  if(!S.started||!S.selArmy||S.selArmy.nation!==S.player)return;
  const r=canvas.getBoundingClientRect();
  const wx=(e.clientX-r.left-S.panX)/S.zoom, wy=(e.clientY-r.top-S.panY)/S.zoom;
  const ix=wx|0,iy=wy|0;
  if(ix<0||iy<0||ix>=MW||iy>=MH)return;
  const t=S.provIdx[iy*MW+ix];
  if(t<0)return;
  if(orderMove(S.selArmy,t)){
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
document.getElementById("dipBtn").addEventListener("click",()=>{refreshDiplomacy();document.getElementById("dipOverlay").style.display="flex"});
document.getElementById("terrBtn").addEventListener("click",()=>window.toggleTerrainView());
{
  let lh="<b style='font-size:12px'>Terrenos</b>";
  for(const k of TERRAIN_KEYS){
    lh+="<div class='row' style='margin:2px 0'><span><span class='chip' style='background:"+TERRAINS[k].color+
      "'></span> "+TERRAINS[k].label+"</span><span style='color:#9aa3ad;font-size:10px'>"+terrainFx(k)+"</span></div>";
  }
  document.getElementById("terrLegend").innerHTML=lh;
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
  if(steps){refreshTop();refreshSide()}
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
