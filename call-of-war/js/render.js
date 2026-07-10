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
function provColor(p){
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
      const c=provColor(p),s=S.provs[p].shade;
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
function setBorderPx(i){
  const o=i*4,d=borderData.data;
  if(S.provs[S.provIdx[i]].wasteland){
    // el páramo no tiene divisiones internas; solo contorno con tierras habitadas o mar
    if(borderIsWasteEdge(i)){d[o]=8;d[o+1]=10;d[o+2]=12;d[o+3]=190}
    else{d[o+3]=0}
    return;
  }
  if(borderIsOuter(i)){d[o]=8;d[o+1]=10;d[o+2]=12;d[o+3]=235}
  else{d[o]=15;d[o+1]=18;d[o+2]=20;d[o+3]=60}
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
  borderCtx.putImageData(borderData,0,0);
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
  const c=provColor(pid),s=S.provs[pid].shade,d=baseData.data;
  for(const i of S.pixOfProv[pid]){
    const o=i*4;d[o]=c[0]*s;d[o+1]=c[1]*s;d[o+2]=c[2]*s;
  }
  baseCtx.putImageData(baseData,0,0);
  updateBordersAround(pid); // la frontera nacional se mueve con la conquista
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
function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle="#27384a";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(S.zoom,0,0,S.zoom,S.panX,S.panY);
  ctx.imageSmoothingEnabled=S.zoom<1.5;
  ctx.drawImage(baseC,0,0);
  ctx.drawImage(roadsC,0,0);
  ctx.drawImage(borderC,0,0);
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
  // capitales
  for(const p of S.provs){
    if(!p.capital)continue;
    ctx.beginPath();ctx.arc(p.x,p.y-24,8,0,7);
    ctx.fillStyle="#f0e6c8";ctx.fill();
    ctx.strokeStyle="#222";ctx.lineWidth=1.5/S.zoom;ctx.stroke();
  }
  // flecha de orden del ejército seleccionado
  if(S.selArmy&&S.selArmy.path.length){
    const pos=armyPos(S.selArmy);
    ctx.beginPath();ctx.moveTo(pos.x,pos.y);
    for(const pid of S.selArmy.path)ctx.lineTo(S.provs[pid].x,S.provs[pid].y);
    ctx.strokeStyle="rgba(255,255,255,.65)";ctx.lineWidth=2/S.zoom;
    ctx.setLineDash([6/S.zoom,4/S.zoom]);ctx.stroke();ctx.setLineDash([]);
  }
  // combates
  for(const pid in S.battleFlash){
    if(S.hour-S.battleFlash[pid]>2)continue;
    const p=S.provs[pid];
    const r=16+6*Math.sin(performance.now()/150);
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);
    ctx.strokeStyle="rgba(255,80,50,.9)";ctx.lineWidth=2.5/S.zoom;ctx.stroke();
  }
  // ejércitos
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(const a of S.armies){
    const pos=armyPos(a);
    const w=40,hh=26;
    ctx.fillStyle=NATIONS[a.nation].color;
    ctx.fillRect(pos.x-w/2,pos.y-hh/2,w,hh);
    ctx.lineWidth=(a===S.selArmy?4.8:2)/Math.max(1,S.zoom*0.7);
    ctx.strokeStyle=a===S.selArmy?"#fff":(a.nation===S.player?"#ffe9a0":"#15181c");
    ctx.strokeRect(pos.x-w/2,pos.y-hh/2,w,hh);
    ctx.fillStyle="#fff";ctx.font="bold 18px Arial";
    ctx.fillText(Math.round(armyCount(a)),pos.x,pos.y+1);
  }
  requestAnimationFrame(draw);
}

export {
  hex2rgb, provColor, paintAll, borderIsOuter, setBorderPx, borderIsWasteEdge, paintBorders, updateBordersAround, repaintProvince, roadCurve, drawRoads, fitCanvas, clampPan, armyPos, draw, drawArrow, drawEditorOverlay, NCOL, TCOL, WASTECOL, baseC, baseCtx, borderC, borderCtx, roadsC, canvas, baseData, borderData, selOutline
};
