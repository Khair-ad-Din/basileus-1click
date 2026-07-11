// render.js
import { MW, MH, NATIONS, TERRAINS, TERRAIN_KEYS } from "./config.js";
import { S } from "./state.js";
import { hashN, roadKey, hasRoad, kmBetween } from "./mapgen.js";
import { armyCount } from "./economy.js";

const baseC=Object.assign(document.createElement("canvas"),{width:MW,height:MH});
const baseCtx=baseC.getContext("2d");
let baseData;
const borderC=Object.assign(document.createElement("canvas"),{width:MW,height:MH});
function hex2rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
const NCOL=NATIONS.map(n=>hex2rgb(n.color));
const TCOL=Object.fromEntries(TERRAIN_KEYS.map(k=>[k,hex2rgb(TERRAINS[k].color)]));
const WASTECOL=hex2rgb("#847c6a");
// Jerarquía de fronteras (estilo EU4): nación = gruesa y opaca, ducado = media, provincia = fina.
// [r,g,b,a]. La nacional se engrosa 1px hacia dentro en paintBorders.
const B_NATION=[6,8,11,255];
const B_DUCHY=[12,15,19,205];
const B_PROV=[26,30,34,72];
const B_WASTE=[8,10,12,190];
// ---- Sprites de ejército por nación (estética 2D en lugar del recuadro con número) ----
// La hoja de cada reino es el "mockup" tal cual: fondo gris sólido, con títulos arriba y
// una columna de etiquetas/escudos a la izquierda. Al cargar se PROCESA en el navegador:
//   1) se recorta a la rejilla 5×4 (SHEET_LAYOUT define dónde empieza y el paso de celda),
//   2) se quita el gris de fondo (clave de color: píxeles neutros y de brillo ~fondo -> alfa 0),
//   3) se detecta el recuadro ajustado de cada sprite para poder centrarlo en el mapa.
//   filas (tropa): 0 Infantería · 1 Piqueros · 2 Caballería · 3 Arqueros · 4 Ballesteros
//   columnas (estado): 0 Reposo · 1 Movimiento · 2 Atacando · 3 Derrotada
const NATION_SPRITE={0:"castilla"};            // nación -> archivo sprites/<slug>.png (override por país)
const DEFAULT_SPRITE="castilla";               // TEMPORAL: las naciones sin hoja propia usan esta
// geometría de la rejilla dentro de la hoja, por slug (tras la columna de escudos; afinable)
const SHEET_LAYOUT={castilla:{x0:150,y0:22,cw:232,ch:139,cols:4,rows:5}};
// unidad del juego -> fila (las 7 se mapean sobre 5; Bombardas/artilleria sin sprite -> recuadro)
const UNIT_ROW={miliciano:0,infanteria:1,antitanque:1,motorizada:2,blindadoLigero:2,blindadoMedio:2};
const _sheets={};
function processSheet(slug,img){
  const L=SHEET_LAYOUT[slug]||{x0:0,y0:0,cw:img.naturalWidth/4,ch:img.naturalHeight/5,cols:4,rows:5};
  const W=img.naturalWidth,H=img.naturalHeight;
  const cv=Object.assign(document.createElement("canvas"),{width:W,height:H});
  const c=cv.getContext("2d");c.drawImage(img,0,0);
  const im=c.getImageData(0,0,W,H),d=im.data;
  // si el fondo ya es transparente (hoja con alfa), no hace falta clave de color; solo si es
  // un mockup con fondo gris opaco quitamos el gris (neutros con brillo ~fondo -> transparente)
  if(d[(2*W+2)*4+3]>128){
    const bgLum=(d[12]+d[13]+d[14])/3;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      const neutral=Math.max(r,g,b)-Math.min(r,g,b)<16;
      if(neutral&&Math.abs((r+g+b)/3-bgLum)<32)d[i+3]=0;
    }
    c.putImageData(im,0,0);
  }
  // recuadro ajustado de cada celda (píxeles no transparentes)
  const frames=[];
  for(let r=0;r<L.rows;r++){
    frames[r]=[];
    for(let col=0;col<L.cols;col++){
      const cx0=Math.round(L.x0+col*L.cw),cy0=Math.round(L.y0+r*L.ch);
      const cx1=Math.min(W,cx0+Math.round(L.cw)),cy1=Math.min(H,cy0+Math.round(L.ch));
      let mnx=cx1,mny=cy1,mxx=cx0,mxy=cy0,any=false;
      for(let y=cy0;y<cy1;y++)for(let x=cx0;x<cx1;x++){
        if(d[(y*W+x)*4+3]>40){any=true;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y}
      }
      frames[r][col]=any?{sx:mnx,sy:mny,sw:mxx-mnx+1,sh:mxy-mny+1}:null;
    }
  }
  return{canvas:cv,frames};
}
function armySheet(nation){
  const slug=NATION_SPRITE[nation]||DEFAULT_SPRITE; // cache por HOJA: una sola carga compartida
  if(!slug)return null;
  let e=_sheets[slug];
  if(!e){
    e=_sheets[slug]={ready:false};
    const img=new Image();
    img.onload=()=>{try{const p=processSheet(slug,img);e.canvas=p.canvas;e.frames=p.frames;e.ready=true}
      catch(err){e.bad=true;console.warn("Sprites: no se pudo procesar sprites/"+slug+".png. Si abriste el juego como archivo (file://) el canvas queda 'tainted' y falla getImageData; ábrelo por http://localhost:8123 .",(err&&err.message)||err)}};
    img.onerror=()=>{e.bad=true;console.warn("Sprites: no se pudo cargar sprites/"+slug+".png (ruta/servidor).")};
    img.src="sprites/"+slug+".png";
  }
  return e.ready?e:null;
}
function dominantUnit(a){ // tropa más numerosa que tenga sprite asignado
  let best=null,bc=-1;
  for(const k in a.units)if(a.units[k]>bc&&UNIT_ROW[k]!=null){bc=a.units[k];best=k}
  return best;
}
// rampa de color del mapa de población: escala logarítmica de crema pálida (poca gente)
// a granate profundo (gran urbe). El páramo va en gris; sin población, crema.
const POP_STOPS=[[0,[247,242,216]],[0.35,[244,199,82]],[0.6,[224,122,42]],[0.8,[181,52,31]],[1,[110,20,20]]];
const POP_LO=Math.log(200),POP_HI=Math.log(220000);
function popColor(pid){
  const p=S.provs[pid];
  if(p.wasteland)return WASTECOL;
  const pop=p.pop||0;
  if(pop<=0)return[236,232,214];
  let t=(Math.log(pop)-POP_LO)/(POP_HI-POP_LO);t=t<0?0:t>1?1:t;
  for(let i=1;i<POP_STOPS.length;i++){
    if(t<=POP_STOPS[i][0]){
      const a=POP_STOPS[i-1],b=POP_STOPS[i],f=(t-a[0])/(b[0]-a[0]||1);
      return[a[1][0]+(b[1][0]-a[1][0])*f,a[1][1]+(b[1][1]-a[1][1])*f,a[1][2]+(b[1][2]-a[1][2])*f];
    }
  }
  return POP_STOPS[POP_STOPS.length-1][1];
}
function provColor(p){
  if(S.popView)return popColor(p);
  if(S.terrainView)return TCOL[S.provs[p].terrain];
  return S.provs[p].wasteland?WASTECOL:NCOL[S.provs[p].owner];
}
function paintAll(){
  baseData=baseCtx.createImageData(MW,MH);
  const d=baseData.data;
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const i=y*MW+x,o=i*4,p=S.provIdx[i];
    if(p<0){
      const v=hashN(x>>3,y>>3)*14;
      d[o]=50+v;d[o+1]=72+v;d[o+2]=100+v;d[o+3]=255;
    }else{
      const P=S.provs[p];let c=provColor(p);
      // ocupación (solo en vista política): franjas diagonales del color del ocupante
      if(!S.terrainView&&!S.popView&&!P.wasteland&&P.occupier>=0&&P.occupier!==P.owner&&((x+y)>>2&1))c=NCOL[P.occupier];
      const s=P.shade;
      d[o]=c[0]*s;d[o+1]=c[1]*s;d[o+2]=c[2]*s;d[o+3]=255;
    }
  }
  baseCtx.putImageData(baseData,0,0);
  paintBorders();
}
const borderCtx=borderC.getContext("2d");
let borderData;
function borderIsOuter(i){
  const p=S.provIdx[i],x=i%MW;
  if(x===0||x===MW-1||i<MW||i>=MW*MH-MW)return true;
  const own=S.provs[p].owner;
  let q;
  q=S.provIdx[i-1];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i+1];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i-MW];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i+MW];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  return false;
}
function putPx(o,c){const d=borderData.data;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=c[3]}
function setBorderPx(i){
  const o=i*4;
  if(S.provs[S.provIdx[i]].wasteland){
    // el páramo no tiene divisiones internas; solo contorno con tierras habitadas o mar
    if(borderIsWasteEdge(i))putPx(o,B_WASTE);else borderData.data[o+3]=0;
    return;
  }
  if(borderIsOuter(i))putPx(o,B_NATION);
  else if(borderIsDuchyEdge(i))putPx(o,B_DUCHY);   // división de ducado: intermedia
  else putPx(o,B_PROV);                             // división de provincia: fina
}
// borde interno entre provincias del MISMO dueño pero de DUCADOS distintos (subdivisión de iure)
function borderIsDuchyEdge(i){
  const p=S.provIdx[i],x=i%MW;
  const P=S.provs[p],du=P.duchy;
  if(du<0)return false;
  const chk=q=>q>=0&&q!==p&&S.provs[q].owner===P.owner&&!S.provs[q].wasteland&&S.provs[q].duchy!==du;
  if(x>0&&chk(S.provIdx[i-1]))return true;
  if(x<MW-1&&chk(S.provIdx[i+1]))return true;
  if(i>=MW&&chk(S.provIdx[i-MW]))return true;
  if(i<MW*MH-MW&&chk(S.provIdx[i+MW]))return true;
  return false;
}
function borderIsWasteEdge(i){
  const x=i%MW;
  if(x===0||x===MW-1||i<MW||i>=MW*MH-MW)return true;
  let q;
  q=S.provIdx[i-1];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i+1];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i-MW];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i+MW];if(q<0||!S.provs[q].wasteland)return true;
  return false;
}
function paintBorders(){
  borderData=borderCtx.createImageData(MW,MH);
  for(let p=0;p<S.provs.length;p++)for(const i of S.borderPxOfProv[p])setBorderPx(i);
  // engrosar la frontera NACIONAL 1px hacia dentro (queda ~2px: país > ducado > provincia)
  for(let p=0;p<S.provs.length;p++){
    if(S.provs[p].wasteland)continue;
    for(const i of S.borderPxOfProv[p]){
      if(!borderIsOuter(i))continue;
      const x=i%MW;
      if(x>0&&S.provIdx[i-1]===p)putPx((i-1)*4,B_NATION);
      if(x<MW-1&&S.provIdx[i+1]===p)putPx((i+1)*4,B_NATION);
      if(i>=MW&&S.provIdx[i-MW]===p)putPx((i-MW)*4,B_NATION);
      if(i<MW*MH-MW&&S.provIdx[i+MW]===p)putPx((i+MW)*4,B_NATION);
    }
  }
  borderCtx.putImageData(borderData,0,0);
  drawGraph(); // la malla de conexiones/nodos se rehace cuando cambia el mapa
}
function updateBordersAround(pid){
  if(!borderData)return;
  let x0=MW,y0=MH,x1=-1,y1=-1;
  const upd=p=>{
    for(const i of S.borderPxOfProv[p]){
      setBorderPx(i);
      const x=i%MW,y=(i/MW)|0;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
    }
  };
  upd(pid);
  for(const n of S.adj[pid])upd(n);
  if(x1<0)return;
  borderCtx.putImageData(borderData,0,0,x0,y0,x1-x0+1,y1-y0+1);
}
function repaintProvince(pid){
  const P=S.provs[pid],base=provColor(pid),s=P.shade,d=baseData.data;
  const occ=(!S.terrainView&&!S.popView&&!P.wasteland&&P.occupier>=0&&P.occupier!==P.owner)?NCOL[P.occupier]:null;
  for(const i of S.pixOfProv[pid]){
    const o=i*4;let c=base;
    if(occ){const x=i%MW,y=(i/MW)|0;if((x+y)>>2&1)c=occ}
    d[o]=c[0]*s;d[o+1]=c[1]*s;d[o+2]=c[2]*s;
  }
  baseCtx.putImageData(baseData,0,0);
  updateBordersAround(pid); // la frontera se mueve con la conquista/ocupación
}
// Malla de conexiones (grafo de movimiento): líneas finas entre centros de provincias adyacentes
// (tierra sólida, mar punteado) y un nodo ROJO en el centro REAL de cada provincia. Aclara dónde
// está de verdad una unidad, ya que el sprite del ejército flota por encima y engaña. Se hornea
// una vez (la adyacencia es estable) y se dibuja como imagen; el toggle es S.showGraph.
const graphC=Object.assign(document.createElement("canvas"),{width:MW,height:MH});
function drawGraph(){
  const c=graphC.getContext("2d");
  c.clearRect(0,0,MW,MH);
  if(!S.adj||!S.adj.length)return;
  c.lineWidth=0.7;
  // conexiones terrestres
  c.strokeStyle="rgba(240,240,255,0.16)";c.beginPath();
  for(let p=0;p<S.provs.length;p++){
    const P=S.provs[p];if(P.wasteland)continue;
    for(const a of S.adj[p]){if(a<p||S.provs[a].wasteland)continue;c.moveTo(P.x,P.y);c.lineTo(S.provs[a].x,S.provs[a].y)}
  }
  c.stroke();
  // conexiones marítimas (punteadas, más tenues)
  c.strokeStyle="rgba(120,200,255,0.20)";c.setLineDash([2,3]);c.beginPath();
  for(let p=0;p<S.provs.length;p++){
    const P=S.provs[p];if(P.wasteland)continue;
    for(const a of S.seaAdj[p]){if(a<p||S.provs[a].wasteland)continue;c.moveTo(P.x,P.y);c.lineTo(S.provs[a].x,S.provs[a].y)}
  }
  c.stroke();c.setLineDash([]);
  // nodos: punto rojo en el centro real de cada provincia
  c.fillStyle="rgba(224,54,44,0.92)";
  for(let p=0;p<S.provs.length;p++){
    const P=S.provs[p];if(P.wasteland)continue;
    c.beginPath();c.arc(P.x,P.y,1.5,0,7);c.fill();
  }
}
const roadsC=Object.assign(document.createElement("canvas"),{width:MW,height:MH});
function roadCurve(c,a,b){
  const ax=S.provs[a].x,ay=S.provs[a].y,bx=S.provs[b].x,by=S.provs[b].y;
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1;
  const nx=-dy/L,ny=dx/L; // perpendicular al tramo
  const h1=hashN(a*7+1,b*13+3)-0.5, h2=hashN(a*11+5,b*17+7)-0.5;
  const w=Math.min(34,L*0.3);
  const isLand=(x,y)=>{
    const ix=x|0,iy=y|0;
    return ix>=0&&iy>=0&&ix<MW&&iy<MH&&S.provIdx[iy*MW+ix]>=0;
  };
  // probar curvaturas cada vez más suaves (y espejadas) hasta que el trazo no pise el mar
  for(const k of[1,-1,0.5,-0.5,0.25,-0.25,0]){
    const c1x=ax+dx/3+nx*w*h1*2*k, c1y=ay+dy/3+ny*w*h1*2*k;
    const c2x=ax+dx*2/3+nx*w*h2*2*k, c2y=ay+dy*2/3+ny*w*h2*2*k;
    let ok=true;
    for(let t=0.05;t<1&&ok;t+=0.05){
      const u=1-t;
      const x=u*u*u*ax+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*bx;
      const y=u*u*u*ay+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*by;
      if(!isLand(x,y))ok=false;
    }
    if(ok){
      c.moveTo(ax,ay);
      c.bezierCurveTo(c1x,c1y,c2x,c2y,bx,by);
      return;
    }
  }
  // ni la recta vale (una bahía en medio): pasar por el centro de la frontera compartida
  let sx=0,sy=0,cnt=0;
  for(const i of S.borderPxOfProv[a]){
    const x=i%MW,y=(i/MW)|0;
    if((x>0&&S.provIdx[i-1]===b)||(x<MW-1&&S.provIdx[i+1]===b)||
       (i>=MW&&S.provIdx[i-MW]===b)||(i<MW*MH-MW&&S.provIdx[i+MW]===b)){sx+=x;sy+=y;cnt++}
  }
  c.moveTo(ax,ay);
  if(cnt){c.lineTo(sx/cnt,sy/cnt);c.lineTo(bx,by)}
  else c.lineTo(bx,by);
}
function drawRoads(){
  const c=roadsC.getContext("2d");
  c.clearRect(0,0,MW,MH);
  c.lineCap="round";c.lineJoin="round";
  const seg=(a,b)=>{c.beginPath();roadCurve(c,a,b);c.stroke()};
  for(const k of S.roads){
    const[a,b]=k.split("|").map(Number);
    if(!S.provs[a]||!S.provs[b])continue;
    c.setLineDash([]);
    c.strokeStyle="rgba(45,34,20,.2)";c.lineWidth=3.4;seg(a,b); // sombra sutil
    c.strokeStyle="rgba(112,86,54,.45)";c.lineWidth=1.7;seg(a,b); // tierra apagada
  }
  for(const q of S.roadQueue){
    const[a,b]=q.key.split("|").map(Number);
    if(!S.provs[a]||!S.provs[b])continue;
    c.strokeStyle="rgba(112,86,54,.3)";c.lineWidth=1.6;c.setLineDash([7,8]);seg(a,b);
  }
  c.setLineDash([]);
}
const canvas=document.getElementById("map"),ctx=canvas.getContext("2d");
function fitCanvas(){
  const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
  canvas.width=w;canvas.height=h;
}
function clampPan(){
  S.panX=Math.min(60,Math.max(canvas.width-MW*S.zoom-60,S.panX));
  S.panY=Math.min(60,Math.max(canvas.height-MH*S.zoom-60,S.panY));
}
function drawArrow(x0,y0,x1,y1){
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);
  ctx.strokeStyle="rgba(255,210,74,.95)";ctx.lineWidth=2.2/S.zoom;ctx.stroke();
  const ang=Math.atan2(y1-y0,x1-x0),s=9/S.zoom;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x1-Math.cos(ang-0.45)*s,y1-Math.sin(ang-0.45)*s);
  ctx.lineTo(x1-Math.cos(ang+0.45)*s,y1-Math.sin(ang+0.45)*s);
  ctx.closePath();
  ctx.fillStyle="rgba(255,210,74,.95)";ctx.fill();
}
function drawEditorOverlay(){
  if(S.shapeSel>=0&&S.shapePoly.length){
    ctx.beginPath();
    ctx.moveTo(S.shapePoly[0][0],S.shapePoly[0][1]);
    for(let i=1;i<S.shapePoly.length;i++)ctx.lineTo(S.shapePoly[i][0],S.shapePoly[i][1]);
    ctx.closePath();
    ctx.strokeStyle="rgba(255,255,255,.95)";ctx.lineWidth=1.6/S.zoom;ctx.stroke();
    const r=3.6/Math.sqrt(S.zoom);
    for(let i=0;i<S.shapePoly.length;i++){
      const q=S.shapePoly[i];
      ctx.fillStyle=i===S.dragVi?"#ff9c3a":(i===S.splitFrom?"#ff5c5c":"#ffd24a");
      ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);
      ctx.strokeStyle="#15181c";ctx.lineWidth=1/S.zoom;
      ctx.strokeRect(q[0]-r,q[1]-r,2*r,2*r);
    }
    if(S.splitFrom>=0&&S.splitCur){
      ctx.beginPath();
      ctx.moveTo(S.shapePoly[S.splitFrom][0],S.shapePoly[S.splitFrom][1]);
      ctx.lineTo(S.splitCur[0],S.splitCur[1]);
      ctx.strokeStyle="rgba(255,92,92,.95)";ctx.lineWidth=2/S.zoom;
      ctx.setLineDash([5/S.zoom,4/S.zoom]);ctx.stroke();ctx.setLineDash([]);
    }
  }
  if(S.mergeFrom>=0&&S.mergeCur){
    const p=S.provs[S.mergeFrom];
    drawArrow(p.x,p.y,S.mergeCur[0],S.mergeCur[1]);
  }
  if(S.editTool==="roads"){
    // resaltar la red mientras se edita
    ctx.lineWidth=1.6/S.zoom;
    ctx.strokeStyle="rgba(255,214,110,.75)";
    for(const k of S.roads){
      const[x,y]=k.split("|").map(Number);
      if(!S.provs[x]||!S.provs[y])continue;
      ctx.beginPath();ctx.moveTo(S.provs[x].x,S.provs[x].y);ctx.lineTo(S.provs[y].x,S.provs[y].y);ctx.stroke();
    }
    if(S.roadFrom>=0&&S.roadCur){
      const p=S.provs[S.roadFrom];
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(S.roadCur[0],S.roadCur[1]);
      ctx.strokeStyle="rgba(130,220,130,.9)";ctx.lineWidth=2.2/S.zoom;
      ctx.setLineDash([6/S.zoom,5/S.zoom]);ctx.stroke();ctx.setLineDash([]);
    }
  }
}
function armyPos(a){
  const p=S.provs[a.prov];
  if(a.path.length&&a.legTotal>0){
    const t=S.provs[a.path[0]];
    const f=Math.min(1,a.legDone/a.legTotal);
    return{x:p.x+(t.x-p.x)*f,y:p.y+(t.y-p.y)*f};
  }
  const here=S.armies.filter(x=>x.prov===a.prov&&!x.path.length);
  const idx=here.indexOf(a);
  if(idx>0){
    const ang=idx*2.1;
    return{x:p.x+Math.cos(ang)*26,y:p.y+Math.sin(ang)*26};
  }
  return{x:p.x,y:p.y};
}
let selOutline=null,selOutlineProv=-1;
function clearSelOutline(){selOutline=null;selOutlineProv=-1} // reset del contorno cacheado (otros módulos no pueden reasignar los locals de este)
function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle="#27384a";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(S.zoom,0,0,S.zoom,S.panX,S.panY);
  ctx.imageSmoothingEnabled=S.zoom<1.5;
  ctx.drawImage(baseC,0,0);
  ctx.drawImage(roadsC,0,0);
  ctx.drawImage(borderC,0,0);
  // marcadores de capital como DIBUJO DE FONDO: centrados en la provincia, pequeños y translúcidos.
  // Se pintan BAJO la malla, así el nodo rojo del centro queda visible encima. No bloquean clics
  // (el clic se resuelve por píxel de provincia, no por la geometría del marcador).
  if(!S.editMode&&S.started){
    for(const d of S.duchies){                       // capital de ducado = rombo pequeño
      const p=S.provs[d.cap];
      if(!p||p.capital)continue;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);
      ctx.fillStyle="rgba(216,203,160,0.45)";ctx.fillRect(-2.5,-2.5,5,5);
      ctx.strokeStyle="rgba(42,36,24,0.45)";ctx.lineWidth=0.7/S.zoom;ctx.strokeRect(-2.5,-2.5,5,5);
      ctx.restore();
    }
    for(const p of S.provs){                          // capital nacional = disco pequeño
      if(!p.capital)continue;
      ctx.beginPath();ctx.arc(p.x,p.y,4,0,7);
      ctx.fillStyle="rgba(240,230,200,0.5)";ctx.fill();
      ctx.strokeStyle="rgba(34,34,34,0.45)";ctx.lineWidth=0.9/S.zoom;ctx.stroke();
    }
  }
  if(S.showGraph)ctx.drawImage(graphC,0,0); // malla de conexiones + nodos reales (encima de los marcadores)
  // contorno de provincia seleccionada
  if(S.selProv>=0){
    if(selOutlineProv!==S.selProv){
      selOutline=document.createElement("canvas");selOutline.width=MW;selOutline.height=MH;
      const c2=selOutline.getContext("2d");
      const im=c2.createImageData(MW,MH);
      for(const i of S.borderPxOfProv[S.selProv]){const o=i*4;im.data[o]=255;im.data[o+1]=255;im.data[o+2]=255;im.data[o+3]=230}
      c2.putImageData(im,0,0);
      selOutlineProv=S.selProv;
    }
    ctx.drawImage(selOutline,0,0);
  }
  if(S.editMode){
    drawEditorOverlay();
    requestAnimationFrame(draw);
    return;
  }
  // (los marcadores de capital se dibujan como fondo, más arriba, bajo la malla de conexiones)
  // flecha de orden del ejército seleccionado
  if(S.selArmy&&S.selArmy.path.length){
    const pos=armyPos(S.selArmy);
    ctx.beginPath();ctx.moveTo(pos.x,pos.y);
    for(const pid of S.selArmy.path)ctx.lineTo(S.provs[pid].x,S.provs[pid].y);
    ctx.strokeStyle="rgba(255,255,255,.65)";ctx.lineWidth=2/S.zoom;
    ctx.setLineDash([6/S.zoom,4/S.zoom]);ctx.stroke();ctx.setLineDash([]);
  }
  // asedios en curso: anillo de progreso (grís de fondo + arco ámbar según prog/need)
  for(const p of S.provs){
    if(!p.siege)continue;
    const frac=Math.min(1,p.siege.prog/p.siege.need);
    ctx.beginPath();ctx.arc(p.x,p.y-14,7,0,7);
    ctx.strokeStyle="rgba(15,15,15,.6)";ctx.lineWidth=3/S.zoom;ctx.stroke();
    ctx.beginPath();ctx.arc(p.x,p.y-14,7,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
    ctx.strokeStyle="rgba(232,162,60,.95)";ctx.lineWidth=3/S.zoom;ctx.stroke();
  }
  // combates
  for(const pid in S.battleFlash){
    if(S.hour-S.battleFlash[pid]>2)continue;
    const p=S.provs[pid];
    const r=16+6*Math.sin(performance.now()/150);
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);
    ctx.strokeStyle="rgba(255,80,50,.9)";ctx.lineWidth=2.5/S.zoom;ctx.stroke();
  }
  // ejércitos: sprite 2D por nación/tipo/estado; si no hay hoja, recuadro con número
  ctx.textAlign="center";ctx.textBaseline="middle";
  const smoothWas=ctx.imageSmoothingEnabled;
  for(const a of S.armies){
    const pos=armyPos(a);
    // punto rojo en la posición REAL de la unidad (el sprite flota por encima y engaña)
    if(S.showGraph){
      ctx.beginPath();ctx.arc(pos.x,pos.y,3/S.zoom,0,7);
      ctx.fillStyle="rgba(230,40,30,0.95)";ctx.fill();
      ctx.lineWidth=1/S.zoom;ctx.strokeStyle="rgba(255,255,255,0.85)";ctx.stroke();
    }
    const cnt=Math.round(armyCount(a));
    const sheet=armySheet(a.nation);
    const du=sheet?dominantUnit(a):null;
    let fr=null,row=0;
    if(sheet&&du!=null){
      row=UNIT_ROW[du];
      const col=a.path.length?1:0; // Atacando/Derrotada: pendiente de enganchar al combate
      fr=(sheet.frames[row]&&sheet.frames[row][col])||(sheet.frames[row]&&sheet.frames[row][0]);
    }
    if(fr){
      const Hd=22, Wd=Hd*fr.sw/fr.sh, half=Math.min(Wd,Hd);
      let flip=false; // el arte mira a la derecha; al ir hacia la izquierda, espejo
      if(a.path.length){const tgt=S.provs[a.path[a.path.length-1]];if(tgt&&tgt.x<pos.x)flip=true}
      ctx.save();
      ctx.beginPath();ctx.ellipse(pos.x,pos.y+Hd*0.40,half*0.34,Hd*0.10,0,0,7);
      ctx.fillStyle="rgba(0,0,0,.28)";ctx.fill();
      if(a===S.selArmy){ctx.lineWidth=2.6/S.zoom;ctx.strokeStyle="#fff";ctx.stroke()}
      else if(a.nation===S.player){ctx.lineWidth=2/S.zoom;ctx.strokeStyle="#ffe9a0";ctx.stroke()}
      ctx.imageSmoothingEnabled=false;
      ctx.translate(pos.x,pos.y);if(flip)ctx.scale(-1,1);
      ctx.drawImage(sheet.canvas,fr.sx,fr.sy,fr.sw,fr.sh,-Wd/2,-Hd*0.62,Wd,Hd);
      ctx.restore();
      if(cnt>0){
        const bx=pos.x+half*0.42,by=pos.y+Hd*0.30;
        ctx.beginPath();ctx.arc(bx,by,6,0,7);
        ctx.fillStyle="rgba(20,24,28,.85)";ctx.fill();
        ctx.lineWidth=1/S.zoom;ctx.strokeStyle=a===S.selArmy?"#fff":NATIONS[a.nation].color;ctx.stroke();
        ctx.fillStyle="#fff";ctx.font="bold 8px Arial";ctx.fillText(cnt,bx,by+0.3);
      }
    }else{
      const w=40,hh=26;
      ctx.fillStyle=NATIONS[a.nation].color;
      ctx.fillRect(pos.x-w/2,pos.y-hh/2,w,hh);
      ctx.lineWidth=(a===S.selArmy?4.8:2)/Math.max(1,S.zoom*0.7);
      ctx.strokeStyle=a===S.selArmy?"#fff":(a.nation===S.player?"#ffe9a0":"#15181c");
      ctx.strokeRect(pos.x-w/2,pos.y-hh/2,w,hh);
      ctx.fillStyle="#fff";ctx.font="bold 18px Arial";
      ctx.fillText(cnt,pos.x,pos.y+1);
    }
  }
  ctx.imageSmoothingEnabled=smoothWas;
  requestAnimationFrame(draw);
}

export {
  hex2rgb, provColor, paintAll, borderIsOuter, setBorderPx, borderIsWasteEdge, paintBorders, updateBordersAround, repaintProvince, drawGraph, roadCurve, drawRoads, fitCanvas, clampPan, armyPos, draw, drawArrow, drawEditorOverlay, NCOL, TCOL, WASTECOL, baseC, baseCtx, borderC, borderCtx, roadsC, canvas, baseData, borderData, selOutline, clearSelOutline
};
