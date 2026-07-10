// editor.js
import { MH, MW, NATIONS, TERRAINS, TERRAIN_KEYS, newBuildings, terrainFx } from "./config.js";
import { S } from "./state.js";
import { generateRoads, rebuildProvinceData, roadKey } from "./mapgen.js";
import { drawRoads, paintAll, repaintProvince, clearSelOutline } from "./render.js";
import { buildSnapshot, loadProvMap, loadProvMapSnapshot } from "./save.js";
import { setupNations } from "./sim.js";
import { log, showNationPicker } from "./ui.js";

function enterEditor(){
  S.editMode=true;S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;
  S.editTool="shape";S.mergeFrom=-1;S.splitFrom=-1;S.roadFrom=-1;S.ownerPaint=-1;
  S.editBackup=buildSnapshot();S.editUndoStack=[];S.editDirty=false;
  document.getElementById("buildbar").style.display="none";
  document.getElementById("buildtabs").style.display="none";
  document.getElementById("realmMenu").className="";
  document.getElementById("side").style.display="none";
  document.getElementById("armyPanel").style.display="none";
  S.armyPanelOpen=false;
  S.speed=0;
  document.querySelectorAll(".spdBtn").forEach(x=>x.classList.toggle("active",x.dataset.s==="0"));
  document.getElementById("startOverlay").style.display="none";
  refreshEditorPanel();
}
function exitEditor(){
  if(S.editDirty){
    if(confirm("Hay cambios sin guardar. ¿Guardarlos antes de salir?")){
      window.saveChanges();
    }else if(confirm("¿Salir descartando los cambios?")){
      restoreWorldFromSnap(S.editBackup);
      S.editUndoStack=[];S.editDirty=false;
    }else return;
  }
  S.editMode=false;S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;
  S.editTool="shape";S.mergeFrom=-1;S.splitFrom=-1;S.roadFrom=-1;S.ownerPaint=-1;
  document.getElementById("side").style.display="none";
  if(!S.started)showNationPicker();
}
function pushUndo(){
  S.editUndoStack.push(buildSnapshot());
  if(S.editUndoStack.length>20)S.editUndoStack.shift();
  S.editDirty=true;
}
function restoreWorldFromSnap(snap){
  S.provs=[];S.armies=[];S.wars=new Set();S.truces=new Map();S.armyIdSeq=1;
  S.player=-1;S.hour=0;S.acc=0;S.started=false;S.gameOver=false;
  S.selProv=-1;S.selArmy=null;S.battleFlash={};clearSelOutline();
  S.shapeSel=-1;S.shapePoly=[];S.dragVi=-1;S.mergeFrom=-1;S.splitFrom=-1;S.roadFrom=-1;
  S.armyPanelOpen=false;S.recruitProv=-1;
  document.getElementById("realmMenu").className="";
  document.getElementById("side").style.display="none";
  loadProvMap(snap);
  setupNations();
  if(!S.customRoads)generateRoads();
  paintAll();
  drawRoads();
  if(S.editMode)refreshEditorPanel();
}
// herramienta "Nación": reasigna el propietario de una provincia (para ajustar fronteras a mano).
// Cambia owner y owner0 (owner0 es lo que persiste en el snapshot/export). Limpia el flag de
// capital para no dejar una capital en manos ajenas (setupNations re-deriva capital al cargar).
function setProvinceOwner(pid,nation){
  const p=S.provs[pid];
  if(!p||p.wasteland||nation<0||p.owner===nation)return;
  pushUndo();
  p.owner=nation;p.owner0=nation;p.capital=false;
  repaintProvince(pid); // repinta el relleno y recalcula la frontera nacional alrededor
  refreshEditorPanel();
}
function toggleRoadEdit(a,b){
  if(a===b||!S.adj[a].has(b)){log("Los caminos solo unen provincias adyacentes por tierra.");return}
  if(S.provs[a].wasteland||S.provs[b].wasteland)return;
  pushUndo();
  S.customRoads=true;
  const k=roadKey(a,b);
  if(S.roads.has(k))S.roads.delete(k);else S.roads.add(k);
  S.roadQueue=S.roadQueue.filter(q=>q.key!==k);
  drawRoads();
  refreshEditorPanel();
}
function dpSimplify(pts,tol){
  const keep=new Uint8Array(pts.length);
  keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]];
  while(st.length){
    const[a,b]=st.pop();
    if(b-a<2)continue;
    const ax=pts[a][0],ay=pts[a][1],dx=pts[b][0]-ax,dy=pts[b][1]-ay;
    const L=Math.hypot(dx,dy)||1e-9;
    let mx=-1,mi=-1;
    for(let i=a+1;i<b;i++){
      const d=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L;
      if(d>mx){mx=d;mi=i}
    }
    if(mx>tol){keep[mi]=1;st.push([a,mi],[mi,b])}
  }
  const out=[];
  for(let i=0;i<pts.length;i++)if(keep[i])out.push(pts[i]);
  return out;
}
function simplifyRing(pts,tol){
  if(pts.length<8)return pts.map(p=>[p[0],p[1]]);
  let far=0,fd=-1;
  for(let i=0;i<pts.length;i++){
    const d=(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2;
    if(d>fd){fd=d;far=i}
  }
  const A=dpSimplify(pts.slice(0,far+1),tol);
  const B=dpSimplify(pts.slice(far).concat([pts[0]]),tol);
  return A.slice(0,-1).concat(B.slice(0,-1)).map(p=>[p[0],p[1]]);
}
function traceProvince(pid){
  const pix=S.pixOfProv[pid];
  if(!pix||!pix.length)return[];
  let mnX=MW,mnY=MH,mxX=0,mxY=0;
  for(const i of pix){
    const x=i%MW,y=(i/MW)|0;
    if(x<mnX)mnX=x;if(x>mxX)mxX=x;if(y<mnY)mnY=y;if(y>mxY)mxY=y;
  }
  const ox=mnX-1,oy=mnY-1,w=mxX-mnX+3,h=mxY-mnY+3;
  const m=new Uint8Array(w*h);
  for(const i of pix)m[((i/MW|0)-oy)*w+(i%MW-ox)]=1;
  // trazado de contorno (vecindad de Moore, sentido horario)
  const DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1];
  let s=-1;
  for(let i=0;i<w*h;i++)if(m[i]){s=i;break}
  const sx=s%w,sy=(s/w)|0;
  let cx=sx,cy=sy,back=4;
  const pts=[[sx,sy]];
  for(let guard=0;guard<600000;guard++){
    let f=-1;
    for(let k=1;k<=8;k++){
      const d=(back+k)%8,nx=cx+DX[d],ny=cy+DY[d];
      if(nx>=0&&ny>=0&&nx<w&&ny<h&&m[ny*w+nx]){f=d;break}
    }
    if(f<0)break;
    cx+=DX[f];cy+=DY[f];back=(f+4)%8;
    if(cx===sx&&cy===sy)break;
    pts.push([cx,cy]);
  }
  const poly=simplifyRing(pts,2.6);
  for(const q of poly){q[0]+=ox+0.5;q[1]+=oy+0.5}
  return poly;
}
function applyShape(pid,poly){
  if(poly.length<3)return;
  pushUndo();
  let mnX=1e9,mnY=1e9,mxX=-1e9,mxY=-1e9;
  for(const q of poly){
    if(q[0]<mnX)mnX=q[0];if(q[0]>mxX)mxX=q[0];
    if(q[1]<mnY)mnY=q[1];if(q[1]>mxY)mxY=q[1];
  }
  const x0=Math.max(0,Math.floor(mnX)-1),x1=Math.min(MW-1,Math.ceil(mxX)+1);
  const y0=Math.max(0,Math.floor(mnY)-1),y1=Math.min(MH-1,Math.ceil(mxY)+1);
  const bw=x1-x0+1,bh=y1-y0+1;
  const inside=new Uint8Array(bw*bh);
  for(let y=y0;y<=y1;y++){
    const yc=y+0.5,xs=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      if((a[1]>yc)!==(b[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    xs.sort((u,v)=>u-v);
    for(let k=0;k+1<xs.length;k+=2){
      const xa=Math.max(x0,Math.ceil(xs[k]-0.5)),xb=Math.min(x1,Math.floor(xs[k+1]-0.5));
      for(let x=xa;x<=xb;x++)inside[(y-y0)*bw+(x-x0)]=1;
    }
  }
  // ganancias: píxeles de otras provincias dentro del polígono; ninguna vecina puede quedar casi vacía
  const gains=new Map();
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(!inside[(y-y0)*bw+(x-x0)])continue;
    const i=y*MW+x,q=S.provIdx[i];
    if(q>=0&&q!==pid){
      if(!gains.has(q))gains.set(q,[]);
      gains.get(q).push(i);
    }
  }
  let blocked=0;
  for(const[v,list]of gains){
    if(S.pixOfProv[v].length-list.length<48){blocked++;continue}
    for(const i of list)S.provIdx[i]=pid;
  }
  // pérdidas: píxeles propios fuera del polígono se ceden a la provincia vecina (dilatación)
  const isLost=new Uint8Array(MW*MH);
  let pend=[];
  for(const i of S.pixOfProv[pid]){
    const x=i%MW,y=(i/MW)|0;
    const ins=(x>=x0&&x<=x1&&y>=y0&&y<=y1)?inside[(y-y0)*bw+(x-x0)]:0;
    if(!ins){pend.push(i);isLost[i]=1}
  }
  while(pend.length){
    const next=[];
    let changed=false;
    for(const k of pend){
      const x=k%MW;
      let pick=-1;
      for(const j of[k-1,k+1,k-MW,k+MW]){
        if(j<0||j>=MW*MH)continue;
        if(Math.abs((j%MW)-x)>1)continue;
        const q=S.provIdx[j];
        if(q>=0&&q!==pid&&!isLost[j]){pick=q;break}
      }
      if(pick>=0){S.provIdx[k]=pick;isLost[k]=0;changed=true}
      else next.push(k);
    }
    if(!changed)break; // lo rodeado solo por la propia provincia o el mar se conserva
    pend=next;
  }
  rebuildProvinceData();
  paintAll();
  drawRoads(); // los centros de provincia pueden haberse movido
  clearSelOutline();
  if(blocked)log("Edición limitada: "+blocked+" provincia(s) vecina(s) no pueden quedar vacías.");
}
function mergeProvinces(a,b){
  if(a===b||!S.provs[a]||!S.provs[b])return;
  pushUndo();
  const A=S.provs[a],B=S.provs[b];
  const bName=B.name;
  B.urban=B.urban||A.urban;
  if(A.capital)B.capital=true;
  B.pop=B.wasteland?0:(B.pop||0)+(A.pop||0); // la fusionada conserva la población de ambas
  // eliminar la provincia origen y reindexar todo lo que apunta a ids
  const newIdOf=i=>i<a?i:i-1;
  const target=newIdOf(b);
  S.provs.splice(a,1);
  S.provs.forEach((p,i)=>p.id=i);
  for(let i=0;i<MW*MH;i++){
    const q=S.provIdx[i];
    if(q<0)continue;
    S.provIdx[i]=q===a?target:newIdOf(q);
  }
  for(const ar of S.armies){
    ar.prov=ar.prov===a?target:newIdOf(ar.prov);
    ar.path=ar.path.map(p=>p===a?target:newIdOf(p));
    ar.path=ar.path.filter((p,i)=>i===0?p!==ar.prov:p!==ar.path[i-1]);
    if(!ar.path.length){ar.legDone=0;ar.legTotal=0}
  }
  for(const n of S.nations){
    if(n.capital===a)n.capital=target;
    else if(n.capital>a)n.capital--;
  }
  S.battleFlash={};
  S.selProv=-1;S.selArmy=null;
  rebuildProvinceData();
  if(S.customRoads){
    // remapear las claves de camino a los nuevos ids de provincia
    const nr=new Set();
    for(const k of S.roads){
      let[x,y]=k.split("|").map(Number);
      x=x===a?target:newIdOf(x);
      y=y===a?target:newIdOf(y);
      if(x!==y&&S.adj[x]&&S.adj[x].has(y))nr.add(roadKey(x,y));
    }
    S.roads=nr;S.roadQueue=[];
  }else generateRoads(); // los ids de provincia han cambiado
  paintAll();
  drawRoads();
  clearSelOutline();
  S.shapeSel=target;S.shapePoly=traceProvince(target);
  refreshEditorPanel();
  log(A.name+" fusionada con "+bName+".");
}
function rasterPoly(poly){
  let mnX=1e9,mnY=1e9,mxX=-1e9,mxY=-1e9;
  for(const q of poly){
    if(q[0]<mnX)mnX=q[0];if(q[0]>mxX)mxX=q[0];
    if(q[1]<mnY)mnY=q[1];if(q[1]>mxY)mxY=q[1];
  }
  const x0=Math.max(0,Math.floor(mnX)-1),x1=Math.min(MW-1,Math.ceil(mxX)+1);
  const y0=Math.max(0,Math.floor(mnY)-1),y1=Math.min(MH-1,Math.ceil(mxY)+1);
  const out=[];
  for(let y=y0;y<=y1;y++){
    const yc=y+0.5,xs=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      if((a[1]>yc)!==(b[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    xs.sort((u,v)=>u-v);
    for(let k=0;k+1<xs.length;k+=2){
      const xa=Math.max(x0,Math.ceil(xs[k]-0.5)),xb=Math.min(x1,Math.floor(xs[k+1]-0.5));
      for(let x=xa;x<=xb;x++)out.push(y*MW+x);
    }
  }
  return out;
}
function keepLargestFragment(pid,fallbackPid){
  const pix=[];
  for(let i=0;i<MW*MH;i++)if(S.provIdx[i]===pid)pix.push(i);
  if(!pix.length)return;
  const seen=new Set();
  const frags=[];
  for(const start of pix){
    if(seen.has(start))continue;
    const st=[start];seen.add(start);
    const fr=[];
    while(st.length){
      const k=st.pop();fr.push(k);
      const x=k%MW;
      for(const j of[k-1,k+1,k-MW,k+MW]){
        if(j<0||j>=MW*MH)continue;
        if(Math.abs((j%MW)-x)>1)continue;
        if(S.provIdx[j]===pid&&!seen.has(j)){seen.add(j);st.push(j)}
      }
    }
    frags.push(fr);
  }
  if(frags.length<2)return;
  frags.sort((u,v)=>v.length-u.length);
  for(let f=1;f<frags.length;f++)for(const k of frags[f])S.provIdx[k]=fallbackPid;
}
function splitProvince(pid,poly,vi,vj,forcedName){
  const n=poly.length;
  const ring=vi<vj?poly.slice(vi,vj+1):poly.slice(vi).concat(poly.slice(0,vj+1));
  if(ring.length<3)return;
  const part=rasterPoly(ring).filter(i=>S.provIdx[i]===pid);
  const rest=S.pixOfProv[pid].length-part.length;
  if(part.length<48||rest<48){alert("Las dos partes deben tener un tamaño mínimo.");return}
  const raw=forcedName!==undefined?forcedName:prompt("Nombre de la nueva provincia:",S.provs[pid].name+" II");
  if(!raw||!raw.trim())return;
  const nm=raw.trim();
  if(S.provs.some(p=>p.name===nm)){alert("Ya existe una provincia con ese nombre.");return}
  pushUndo();
  const src=S.provs[pid];
  const srcPop=src.pop||0; // se repartirá por área entre las dos partes
  const np={id:S.provs.length,name:nm,x:0,y:0,country:src.country,owner:src.owner,owner0:src.owner0,
    named:true,coastal:false,morale:60,urban:false,resType:src.resType,shade:0.85+S.rand()*0.3,capital:false,
    terrain:src.terrain,wasteland:src.wasteland,pop:0,
    buildings:newBuildings(),buildQueue:[],recruitQueue:[]};
  S.provs.push(np);
  for(const i of part)S.provIdx[i]=np.id;
  // cada parte conserva solo su fragmento conexo mayor (el resto pasa a la otra)
  keepLargestFragment(np.id,pid);
  keepLargestFragment(pid,np.id);
  rebuildProvinceData();
  // repartir la población de la original entre las dos partes según su área nueva
  if(!src.wasteland){
    const aNew=S.pixOfProv[np.id].length,aOld=S.pixOfProv[pid].length,tot=aNew+aOld;
    np.pop=tot?Math.round(srcPop*aNew/tot):0;
    S.provs[pid].pop=Math.max(0,srcPop-np.pop);
  }
  if(!S.customRoads)generateRoads(); // con red editada, los ids existentes siguen siendo válidos
  paintAll();
  drawRoads();
  clearSelOutline();
  S.shapeSel=np.id;S.shapePoly=traceProvince(np.id);
  refreshEditorPanel();
  log(src.name+" dividida: nace "+nm+".");
}
function refreshEditorPanel(){
  const el=document.getElementById("side");
  let h="<h2>Editor de provincias</h2>";
  const tb=(t,lab)=>"<button class='bbtn' style='flex:1"+(S.editTool===t?";outline:2px solid #9fb878":"")+"' onclick='setTool(\""+t+"\")'>"+lab+"</button>";
  h+="<div class='row'>"+tb("shape","Formas")+tb("merge","Fusionar")+tb("split","Dividir")+tb("roads","Caminos")+tb("owner","Nación")+"</div>";
  if(S.editTool==="shape"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Clic: seleccionar provincia · arrastra un vértice para remodelar · clic sobre un borde: nuevo vértice · clic derecho en un vértice: borrarlo · Esc: deseleccionar. Los cambios se aplican al soltar, pero no se guardan hasta que pulses <b>Guardar cambios</b>.</p>";
  }else if(S.editTool==="merge"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Arrastra desde una provincia hasta otra: la primera se <b>disuelve dentro</b> de la segunda (que conserva su nombre).</p>";
  }else if(S.editTool==="roads"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Arrastra entre dos provincias <b>adyacentes</b>: crea el camino si no existe y lo quita si ya existe. Los caminos se resaltan mientras esta herramienta está activa.</p>";
    h+="<div class='row sm'><span>Caminos en el mapa</span><b>"+S.roads.size+"</b></div>";
  }else if(S.editTool==="owner"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'><b>Clic derecho</b> (o el primer clic izquierdo) en una provincia <b>elige su nación</b>; luego <b>clic izquierdo</b> en otras provincias para asignárselas. Ideal para ajustar fronteras. No se guarda hasta <b>Guardar cambios</b>.</p>";
    if(S.ownerPaint>=0){
      h+="<div class='row'><span>Pintando</span><span><span class='chip' style='background:"+NATIONS[S.ownerPaint].color+"'></span> <b>"+NATIONS[S.ownerPaint].name+"</b></span></div>";
      h+="<div class='row'><button class='bbtn' style='width:100%' onclick='clearOwnerPaint()'>Cambiar país (elegir otro)</button></div>";
    }else{
      h+="<p style='font-size:11px;color:#d0a050'>Elige una nación: clic en cualquier provincia suya.</p>";
    }
  }else{
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>"+(S.shapeSel>=0?
      "Arrastra desde un vértice hasta otro <b>no contiguo</b>: la provincia se corta por esa línea y el lado del arrastre se convierte en una provincia nueva.":
      "Primero haz clic en una provincia para seleccionarla; después arrastra de un vértice a otro para cortarla.")+"</p>";
  }
  if(S.shapeSel>=0&&S.provs[S.shapeSel]){
    const p=S.provs[S.shapeSel];
    h+="<h3>"+(p.capital?"★ ":"")+"Provincia seleccionada</h3>";
    h+="<input id='provName' style='width:100%;background:#1c2127;border:1px solid #4a525b;color:#e8e4d8;padding:4px 6px;border-radius:4px' value='"+p.name.replace(/'/g,"&#39;").replace(/"/g,"&quot;")+"' onkeydown=\"if(event.key==='Enter')renameProvince()\">";
    h+="<div class='row' style='margin-top:6px'><button class='bbtn' onclick='renameProvince()'>Renombrar</button><button class='bbtn' onclick='deselectShape()'>Deseleccionar</button></div>";
    h+="<div class='row sm'><span>Nación</span><span>"+NATIONS[p.owner].name+"</span></div>";
    h+="<div class='row sm'><span>Vértices / píxeles</span><span>"+S.shapePoly.length+" / "+S.pixOfProv[S.shapeSel].length+"</span></div>";
    h+="<h3>Terreno <span style='font-weight:normal;color:#9aa3ad;font-size:11px'>("+terrainFx(p.terrain)+")</span></h3>";
    h+="<div style='display:flex;flex-wrap:wrap;gap:4px;margin:4px 0'>";
    for(const t of TERRAIN_KEYS){
      h+="<button class='bbtn' style='"+(p.terrain===t?"outline:2px solid #9fb878;":"")+
        "border-left:6px solid "+TERRAINS[t].color+"' onclick='setTerrain(\""+t+"\")'>"+TERRAINS[t].label+"</button>";
    }
    h+="</div>";
    h+="<div class='row'><span>Impracticable</span><button class='bbtn"+(p.wasteland?" red":"")+
      "' onclick='toggleWasteland()'>"+(p.wasteland?"Sí (quitar)":"No (marcar)")+"</button></div>";
    if(!p.wasteland){
      h+="<h3>Población <span style='font-weight:normal;color:#9aa3ad;font-size:11px'>habitantes</span></h3>";
      h+="<div class='row'><input id='provPop' type='number' min='0' step='500' style='flex:1;background:#1c2127;border:1px solid #4a525b;color:#e8e4d8;padding:4px 6px;border-radius:4px' value='"+Math.round(p.pop||0)+"' onkeydown=\"if(event.key==='Enter')setProvPop()\"><button class='bbtn' onclick='setProvPop()'>Fijar</button></div>";
      h+="<div class='row sm'><button class='bbtn' style='flex:1' onclick='scaleProvPop(0.75)'>−25%</button><button class='bbtn' style='flex:1' onclick='scaleProvPop(1.33)'>+33%</button></div>";
    }
  }
  h+="<h3>Cambios</h3>";
  h+=S.editDirty
    ?"<p style='font-size:11px;color:#d0a050'>Hay cambios sin guardar.</p>"
    :"<p style='font-size:11px;color:#9aa3ad'>Sin cambios pendientes.</p>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='saveChanges()'>Guardar cambios</button></div>";
  if(S.editUndoStack.length)h+="<div class='row'><button class='bbtn' style='width:100%' onclick='undoEdit()'>Deshacer última edición (Ctrl+Z)</button></div>";
  if(S.editDirty)h+="<div class='row'><button class='bbtn red' style='width:100%' onclick='discardChanges()'>Descartar y volver al último guardado</button></div>";
  h+="<h3>Mapa</h3>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='toggleTerrainView()'>Vista: "+(S.terrainView?"Terreno":"Política")+" (cambiar)</button></div>";
  if(loadProvMapSnapshot())h+="<p style='font-size:11px;color:#9fb878'>Jugando sobre un mapa editado (guardado en el navegador).</p>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='downloadMap()'>Descargar mapa editado (JSON)</button></div>";
  h+="<div class='row'><label class='bbtn' style='width:100%;text-align:center'>Importar mapa (JSON)<input type='file' accept='.json,application/json' style='display:none' onchange='importMapFile(this)'></label></div>";
  h+="<div class='row'><button class='bbtn red' style='width:100%' onclick='restoreGenerated()'>Descartar ediciones y regenerar</button></div>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='exitEditorBtn()'>Salir del editor</button></div>";
  el.innerHTML=h;el.style.display="block";
}
function vertexAt(wx,wy){
  const r=8/S.zoom;
  let best=-1,bd=r*r;
  for(let i=0;i<S.shapePoly.length;i++){
    const d=(S.shapePoly[i][0]-wx)**2+(S.shapePoly[i][1]-wy)**2;
    if(d<bd){bd=d;best=i}
  }
  return best;
}
function nearestSegment(poly,wx,wy){
  let bi=-1,bd=1e18,bx=0,by=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy||1e-9;
    let t=((wx-a[0])*dx+(wy-a[1])*dy)/L;
    t=Math.max(0,Math.min(1,t));
    const qx=a[0]+dx*t,qy=a[1]+dy*t;
    const d=(qx-wx)**2+(qy-wy)**2;
    if(d<bd){bd=d;bi=i;bx=qx;by=qy}
  }
  return{i:bi,d:Math.sqrt(bd),x:bx,y:by};
}

export {
  enterEditor, exitEditor, pushUndo, restoreWorldFromSnap, toggleRoadEdit, setProvinceOwner, dpSimplify, simplifyRing, traceProvince, applyShape, mergeProvinces, rasterPoly, keepLargestFragment, splitProvince, refreshEditorPanel, vertexAt, nearestSegment
};
