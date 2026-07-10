// ui.js
import { START_DATE, MESES, BUILDINGS, BUILD_CATS, NATIONS, NPLAY, RES_ICON, RES_KEYS, RES_LABEL, RES_SHORT, RES_STRAT, RES_TRADE, TERRAINS, UNITS, terrainFx } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyDef, armySpd, buildBlock, buildMax, canAfford, costFor, lvlOf, nationEconomy, nationProvCount, nationStrength, provBreakdown, provDefMul, recruitTime, timeFor } from "./economy.js";
import { hasRoad, kmBetween, roadKey } from "./mapgen.js";
import { canvas, clampPan } from "./render.js";
import { continueGame, loadSaveMeta } from "./save.js";
import { armiesIn, atWar, tryBuild, tryRecruit, tryRoad } from "./sim.js";

function log(msg){
  const el=document.getElementById("log");
  const d=document.createElement("div");
  d.textContent="Día "+(1+(S.hour/24|0))+" — "+msg;
  el.appendChild(d);
  while(el.children.length>8)el.removeChild(el.firstChild);
  setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},25000);
}
function fmt(v){return v>=10000?(v/1000).toFixed(1)+"k":Math.floor(v)}
function fmtDur(h){ // horas de juego -> texto legible
  if(h>=8760)return (h/8760).toFixed(1).replace(".0","")+" años";
  if(h>=720)return Math.round(h/730)+" meses";
  if(h>=48)return Math.round(h/24)+" días";
  return Math.round(h)+" h";
}
function buildResBar(){
  const bar=document.getElementById("resbar");
  if(bar.dataset.built)return;
  const cell=(k,cls)=>"<span class='res "+cls+"' title='"+RES_LABEL[k]+"'><span class='ic'>"+RES_ICON[k]+
    "</span><b id='r_"+k+"'>0</b></span>";
  let h=RES_STRAT.map(k=>cell(k,"strat")).join("");
  h+="<span class='sep'></span>";
  h+=RES_TRADE.map(k=>cell(k,"trade")).join("");
  h+="<span class='sep'></span><span class='res' title='Mano de obra'><span class='ic'>👥</span><b id='r_mano'>0</b></span>";
  bar.innerHTML=h;bar.dataset.built="1";
}
function refreshTop(){
  if(S.player<0)return;
  buildResBar();
  const R=S.nations[S.player].res;
  const inc=nationEconomy(S.player).res;
  for(const k of RES_KEYS){
    const el=document.getElementById("r_"+k);if(!el)continue;
    el.textContent=fmt(R[k]);
    const g=inc[k]||0;
    el.title=RES_LABEL[k]+": "+(g>=0?"+":"")+(Math.round(g*10)/10)+"/mes";
    el.style.color=g<-0.05?"#e08a7a":"#fff";
  }
  document.getElementById("r_mano").textContent=fmt(S.nations[S.player].mano);
  const d=new Date(START_DATE+S.hour*3600e3);
  document.getElementById("dateBox").textContent=
    "Día "+(1+(S.hour/24|0))+" · "+d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear()+
    ", "+String(d.getUTCHours()).padStart(2,"0")+":00";
}
function costStr(cost,mano){
  const parts=[];
  for(const k in cost)parts.push(fmt(cost[k])+" "+RES_LABEL[k]);
  if(mano)parts.push(mano+" MO");
  return parts.join(", ");
}
function n1(v){return (Math.round(v*10)/10).toString().replace(/\.0$/,"")}
function fxText(B){
  const fx=B.fx,t=[];
  if(fx.prodAdd)for(const k in fx.prodAdd)t.push("+"+n1(fx.prodAdd[k])+" "+RES_SHORT[k]);
  if(fx.prodMul)t.push("+"+Math.round(fx.prodMul*100)+"% prod");
  if(fx.goldAdd)t.push("+"+n1(fx.goldAdd)+" Duc");
  if(fx.mano)t.push("+"+n1(fx.mano)+" MO");
  if(fx.def)t.push("+"+Math.round(fx.def*100)+"% defensa");
  if(fx.moral)t.push("+moral");
  if(fx.realmMoral)t.push("+moral del reino");
  if(fx.buildSpeed)t.push("obras -"+Math.round(fx.buildSpeed*100)+"%");
  if(fx.seaMarch)t.push("marcha marítima");
  if(B.unlock)t.push("desbloquea tropas");
  return t.join(" · ");
}
function costLine(c,owner){
  return Object.keys(c).map(k=>{
    const no=owner!=null&&S.nations[owner].res[k]<c[k];
    return "<span"+(no?" class='no'":"")+">"+RES_ICON[k]+fmt(c[k])+"</span>";
  }).join(" ");
}
function renderBuildTabs(){
  const t=document.getElementById("buildtabs");
  const opts=[["all","Todos"]].concat(BUILD_CATS);
  t.innerHTML=opts.map(o=>"<span class='btab"+(S.buildFilter===o[0]?" on":"")+"' onclick='setBuildCat(\""+o[0]+"\")'>"+o[1]+"</span>").join("");
  t.className="show";t.style.display="flex";
}
function refreshBuildBar(){
  const bar=document.getElementById("buildbar"),tabs=document.getElementById("buildtabs");
  const hide=()=>{bar.className="";bar.style.display="none";tabs.className="";tabs.style.display="none"};
  if(S.selArmy||S.selProv<0){hide();return}
  const p=S.provs[S.selProv];
  if(p.owner!==S.player||p.wasteland){hide();return}
  renderBuildTabs();
  const scroll=bar.scrollLeft;
  // desglose de ingresos y gastos de la provincia (de dónde proviene cada cosa)
  const bd=provBreakdown(p);
  const row=(lab,val,cls)=>"<div class='prow'><span>"+lab+"</span><b class='"+(cls||"")+"'>"+val+"</b></div>";
  let s="<div class='bsum'><h4>"+p.name+(p.capital?" ★":"")+"</h4>"+
    "<div class='tl'>"+(p.urban?"Ciudad":RES_LABEL[p.resType])+" · "+TERRAINS[p.terrain].label+
    " · moral "+Math.round(p.morale)+"%</div>";
  // Ingresos (por fuente), en /mes
  s+="<div class='bsec'>Ingresos <span class='u'>/mes</span></div>";
  for(const it of bd.income){if(it.amt<0.005)continue;
    s+=row(RES_ICON[it.res]+" "+it.label,"+"+n1(it.amt),"pos");}
  if(bd.mano>0.005)s+=row("👥 Mano de obra","+"+n1(bd.mano),"pos");
  // Mantenimiento (anual), por edificio
  s+="<div class='bsec'>Mantenimiento <span class='u'>/año</span></div>";
  let anyUp=false;
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b),bu=BUILDINGS[b].up;if(!lvl||!bu)continue;anyUp=true;
    const parts=Object.keys(bu).map(k=>RES_ICON[k]+n1(bu[k]*lvl)).join(" ");
    s+=row(BUILDINGS[b].label+((lvl>1&&!BUILDINGS[b].unique)?" ×"+lvl:""),"−"+parts,"neg");
  }
  if(!anyUp)s+="<div class='prow'><span class='dim'>Sin edificios que sostener</span></div>";
  // Balance neto, en /mes
  s+="<div class='bsec'>Balance <span class='u'>/mes</span></div>";
  const nk=Object.keys(bd.net).filter(k=>Math.abs(bd.net[k])>0.005).sort((a,b)=>bd.net[b]-bd.net[a]);
  for(const k of nk)s+=row(RES_ICON[k]+" "+RES_LABEL[k],(bd.net[k]>=0?"+":"")+n1(bd.net[k]),bd.net[k]<0?"neg":"pos");
  const dm=provDefMul(p);
  if(dm>1)s+=row("🏰 Defensa","+"+Math.round((dm-1)*100)+"%","");
  s+="</div>";
  // tarjetas de la categoría activa (o todas si el filtro es "Todos")
  const showAll=S.buildFilter==="all";
  const cList=showAll?BUILD_CATS:BUILD_CATS.filter(c=>c[0]===S.buildFilter);
  let cats="<div class='bcats'>";
  for(const[cat,label]of cList){
    let tiles="";
    for(const b in BUILDINGS){
      const B=BUILDINGS[b];if(B.cat!==cat)continue;
      const lvl=lvlOf(p,b),max=buildMax(p,b),inQ=p.buildQueue.some(q=>q.b===b);
      const block=inQ?null:buildBlock(p,b);
      const maxed=lvl>=max;
      let cls="btile";
      if(inQ)cls+=" building";else if(maxed)cls+=" done";else if(block)cls+=" locked";
      // indicador de nivel
      let lvIndicator;
      if(B.unique)lvIndicator="<span class='uni'>Única</span>";
      else{let d="";for(let i=0;i<max;i++)d+="<span class='dot"+(i<lvl?" on":"")+"'></span>";lvIndicator="<span class='dots'>"+d+"</span>";}
      // pie: coste, estado o acción
      let foot;
      if(inQ){const q=p.buildQueue.find(q=>q.b===b);foot="<div class='foot' style='color:#c9a86a'>En obra · "+fmtDur(q.hoursLeft)+"</div>";}
      else if(maxed)foot="<div class='foot' style='color:#8fbc62'>"+(B.unique?"Construida":"Nivel máximo")+"</div>";
      else{
        foot="<div class='cost'>"+costLine(costFor(p,b),S.player)+"</div>"+
          "<div class='foot'>"+(block?"🔒 "+block:"⏱ "+fmtDur(timeFor(p,b)))+"</div>";
      }
      // mantenimiento anual por nivel (lo que sostiene cada nivel)
      const upStr=B.up?"<div class='up' title='Mantenimiento anual por nivel'>🔧 "+
        Object.keys(B.up).map(k=>RES_ICON[k]+n1(B.up[k])).join(" ")+"/año</div>":"";
      const onclick=(!inQ&&!maxed&&!block)?" onclick='tryBuild("+p.id+",\""+b+"\")'":"";
      tiles+="<div class='"+cls+"'"+onclick+" title='"+B.desc.replace(/'/g,"’")+"'>"+
        "<div class='th'><span class='ic'>"+B.icon+"</span><span class='nm'>"+B.label+"</span>"+
        (B.unique?"":"<span class='lv'>"+lvl+"/"+max+"</span>")+"</div>"+
        lvIndicator+
        "<div class='fx'>"+fxText(B)+"</div>"+upStr+foot+"</div>";
    }
    cats+="<div class='bcat'>"+(showAll?"<div class='lab'>"+label+"</div>":"")+"<div class='btiles'>"+tiles+"</div></div>";
  }
  cats+="</div>";
  bar.innerHTML=s+cats;
  bar.className="show";bar.style.display="flex";
  bar.scrollLeft=scroll;
}
function refreshSide(){
  refreshBuildBar();
  const el=document.getElementById("side");
  if(S.selArmy){
    const a=S.selArmy;
    let h="<h2>Ejército de "+NATIONS[a.nation].name+"</h2>";
    h+="<div class='row'><span>Posición</span><b>"+S.provs[a.prov].name+"</b></div>";
    h+="<h3>Composición</h3>";
    for(const k in a.units)h+="<div class='row'><span>"+UNITS[k].label+"</span><b>"+Math.round(a.units[k])+"</b></div>";
    h+="<div class='row sm'><span>Ataque "+armyAtk(a).toFixed(1)+" · Defensa "+armyDef(a).toFixed(1)+"</span><span>"+armySpd(a)+" km/día</span></div>";
    if(a.path.length)h+="<div class='row'><span class='sm'>En marcha hacia "+S.provs[a.path[a.path.length-1]].name+"</span>"+
      (a.nation===S.player?"<button class='bbtn red' onclick='haltArmy()'>Detener</button>":"")+"</div>";
    else h+="<p class='sm' style='margin-top:6px;color:#9aa3ad'>Clic derecho en una provincia para mover.</p>";
    el.innerHTML=h;el.style.display="block";return;
  }
  if(S.selProv<0){el.style.display="none";return}
  const p=S.provs[S.selProv];
  if(p.wasteland){
    el.innerHTML="<h2>"+p.name+"</h2>"+
      "<div class='row'><span>Terreno</span><b>"+TERRAINS[p.terrain].label+"</b></div>"+
      "<p class='sm' style='color:#9aa3ad;margin-top:6px'>Territorio impracticable: nadie puede reclamarlo ni atravesarlo.</p>";
    el.style.display="block";return;
  }
  const own=p.owner===S.player;
  let h="<h2>"+p.name+(p.capital?" ★":"")+"</h2>";
  h+="<div class='row'><span>Nación</span><span><span class='chip' style='background:"+NATIONS[p.owner].color+"'></span> "+NATIONS[p.owner].name+"</span></div>";
  h+="<div class='row'><span>Recurso</span><b>"+(p.resType==="dinero"?"Ciudad (Ducados)":RES_LABEL[p.resType])+"</b></div>";
  h+="<div class='row'><span>Terreno</span><b title='"+terrainFx(p.terrain)+"'>"+TERRAINS[p.terrain].label+"</b></div>";
  h+="<div class='row sm'><span>"+terrainFx(p.terrain)+"</span></div>";
  h+="<div class='row'><span>Moral</span><b>"+Math.round(p.morale)+"%</b></div>";
  if(own){
    const ne=nationEconomy(S.player);
    h+="<h3>Tesorería del reino</h3>";
    h+="<div class='row sm'><span>"+ne.provs+" provincias · mantiene "+ne.troops+" tropas</span></div>";
    const ks=Object.keys(ne.res).filter(k=>Math.abs(ne.res[k])>0.05).sort((a,b)=>ne.res[b]-ne.res[a]);
    for(const k of ks){const v=ne.res[k];
      h+="<div class='row'><span>"+RES_ICON[k]+" "+RES_LABEL[k]+"</span><b style='color:"+(v<0?"#e08a7a":"#8fce7e")+"'>"+(v>=0?"+":"")+n1(v)+"/mes</b></div>";}
    if(p.buildQueue.length)h+="<div class='row sm'><span>En obra: "+BUILDINGS[p.buildQueue[0].b].label+"</span><span>"+fmtDur(p.buildQueue[0].hoursLeft)+"</span></div>";
    h+="<p class='sm' style='color:#9aa3ad;margin-top:3px'>Gestiona los edificios en la barra inferior ↓</p>";
  }else{
    const blist=Object.keys(BUILDINGS).filter(b=>lvlOf(p,b)>0);
    if(blist.length){
      h+="<h3>Construcciones enemigas</h3>";
      for(const b of blist)h+="<div class='row sm'><span>"+BUILDINGS[b].icon+" "+BUILDINGS[b].label+"</span><b>"+(BUILDINGS[b].unique?"✓":lvlOf(p,b))+"</b></div>";
    }
  }
  if(own){
    h+="<h3>Caminos</h3>";
    let anyRoadRow=false;
    for(const b of S.adj[p.id]){
      if(S.provs[b].owner!==S.player)continue;
      anyRoadRow=true;
      const kmR=Math.round(kmBetween(p,S.provs[b]));
      if(hasRoad(p.id,b)){
        h+="<div class='row sm'><span>→ "+S.provs[b].name+" ("+kmR+" km)</span><span>camino</span></div>";
      }else if(S.roadQueue.some(q=>q.key===roadKey(p.id,b))){
        const q=S.roadQueue.find(q=>q.key===roadKey(p.id,b));
        h+="<div class='row sm'><span>→ "+S.provs[b].name+"</span><span>en obra ("+fmtDur(q.hoursLeft)+")</span></div>";
      }else{
        const dis=!canAfford(S.player,{dinero:800,materiales:1200});
        h+="<div class='row'><span class='sm'>→ "+S.provs[b].name+" ("+kmR+" km)</span>"+
          "<button class='bbtn' "+(dis?"disabled":"")+" title='800 Ducados, 1200 Madera — 6 meses' onclick='tryRoad("+p.id+","+b+")'>Camino</button></div>";
      }
    }
    if(!anyRoadRow)h+="<p class='sm' style='color:#9aa3ad'>Sin provincias propias adyacentes.</p>";
    h+="<h3>Reclutamiento</h3>";
    for(const u in UNITS){
      const U=UNITS[u];
      let okReq=true;
      for(const r in U.req)if(p.buildings[r]<U.req[r])okReq=false;
      if(!okReq)continue;
      const dis=!canAfford(S.player,U.cost)||S.nations[S.player].mano<U.mano;
      h+="<div class='row'><span>"+U.label+" <span class='sm'>("+fmtDur(recruitTime(p,u))+")</span></span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" title='"+costStr(U.cost,U.mano)+"' onclick='tryRecruit("+p.id+",\""+u+"\")'>Reclutar</button></div>";
    }
    if(p.recruitQueue.length){
      h+="<div class='row sm'><span>En cola: "+p.recruitQueue.map(q=>UNITS[q.u].label).join(", ")+"</span><span>"+fmtDur(p.recruitQueue[0].hoursLeft)+"</span></div>";
    }
  }
  const here=armiesIn(p.id);
  if(here.length){
    h+="<h3>Ejércitos</h3>";
    for(const a of here){
      h+="<div class='row'><span><span class='chip' style='background:"+NATIONS[a.nation].color+"'></span> "+
        Math.round(armyCount(a))+" unidades</span>"+
        (a.nation===S.player?"<button class='bbtn' onclick='selectArmyId("+a.id+")'>Seleccionar</button>":"")+"</div>";
    }
  }
  el.innerHTML=h;el.style.display="block";
}
function refreshDiplomacy(){
  let h="<table class='dip'><tr><th>Nación</th><th>Provincias</th><th>Fuerza</th><th>Estado</th><th></th></tr>";
  for(let n=0;n<NPLAY;n++){
    if(n===S.player)continue;
    const alive=S.nations[n].alive;
    h+="<tr><td><span class='chip' style='background:"+NATIONS[n].color+"'></span> "+NATIONS[n].name+"</td>";
    h+="<td>"+nationProvCount(n)+"</td><td>"+Math.round(nationStrength(n))+"</td>";
    if(!alive){h+="<td colspan='2'>Eliminada</td></tr>";continue}
    if(atWar(S.player,n)){
      h+="<td style='color:#d08080'>EN GUERRA</td><td><button class='bbtn' onclick='proposePeace("+n+")'>Proponer paz</button></td>";
    }else{
      h+="<td style='color:#90b080'>Paz</td><td><button class='bbtn red' onclick='playerDeclare("+n+")'>Declarar guerra</button></td>";
    }
    h+="</tr>";
  }
  h+="</table>";
  document.getElementById("dipBody").innerHTML=h;
}
function showNationPicker(){
  const grid=document.getElementById("nationGrid");
  let h="";
  const sv=loadSaveMeta();
  if(sv){
    const d=new Date(START_DATE+sv.hour*3600e3);
    h+="<div class='ncard' id='continueCard' style='grid-column:1/-1;border-color:#9fb878'>"+
      "<b>▶ Continuar partida</b><span>"+NATIONS[sv.player].name+" · "+d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear()+"</span></div>";
  }
  for(let n=0;n<NPLAY;n++){
    h+="<div class='ncard' data-n='"+n+"'><span class='chip' style='background:"+NATIONS[n].color+"'></span>"+
      "<b>"+NATIONS[n].name+"</b><span>"+nationProvCount(n)+" provincias</span></div>";
  }
  grid.innerHTML=h;
  grid.querySelectorAll(".ncard").forEach(c=>c.addEventListener("click",()=>{
    if(c.id==="continueCard"){
      document.getElementById("startOverlay").style.display="none";
      continueGame();
      return;
    }
    if(sv&&!confirm("Empezar una partida nueva descartará la guardada. ¿Continuar?"))return;
    try{localStorage.removeItem("basileus_save")}catch(e){}
    S.player=+c.dataset.n;
    S.nations[S.player].ai=false;
    document.getElementById("startOverlay").style.display="none";
    document.getElementById("nationChip").innerHTML=
      "<span class='chip' style='background:"+NATIONS[S.player].color+"'></span>"+NATIONS[S.player].name;
    S.started=true;
    const cap=S.provs[S.nations[S.player].capital];
    S.panX=canvas.width/2-cap.x*S.zoom;S.panY=canvas.height/2-cap.y*S.zoom;clampPan();
    S.selProv=cap.id;refreshSide();refreshTop();
    log("Has tomado el mando de "+NATIONS[S.player].name+". Capital: "+cap.name+".");
  }));
  document.getElementById("startOverlay").style.display="flex";
}

export {
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, showNationPicker
};
