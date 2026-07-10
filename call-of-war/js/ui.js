// ui.js
import { START_DATE, MESES, BUILDINGS, BUILD_CATS, NATIONS, NPLAY, RES_ICON, RES_KEYS, RES_LABEL, RES_SHORT, RES_STRAT, RES_TRADE, TERRAINS, UNITS, terrainFx } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyDef, armySpd, buildBlock, buildMax, canAfford, costFor, foodBalance, foodCap, lvlOf, nationEconomy, nationProvCount, nationStrength, provBreakdown, provDefMul, recruitTime, soldAvail, soldCap, timeFor } from "./economy.js";
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
function fmtPop(n){return Math.round(n||0).toLocaleString("es-ES")}
function foodLine(p){ // estado de la despensa (almacén de comida) y balance anual
  if(p.wasteland)return "";
  const cap=foodCap(p),fill=cap>0?(p.food||0)/cap:0,balYr=foodBalance(p)*8760;
  if(p.famine)return "<div class='tl'><b style='color:#e79070'>🥖 ⚠ HAMBRUNA</b> · despensa vacía</div>";
  const bal="<span style='color:"+(balYr<-0.5?"#e0a17a":"#8fbf78")+"'>"+(balYr>=0?"+":"")+fmtPop(balYr)+"/año</span>";
  return "<div class='tl'>🥖 Despensa "+Math.round(fill*100)+"% · "+bal+"</div>";
}
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
  h+="<span class='sep'></span><span class='res' title='Soldadesca del reino (cupo movilizable disponible)'><span class='ic'>👥</span><b id='r_mano'>0</b></span>";
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
  let realmSold=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)realmSold+=soldAvail(p);
  document.getElementById("r_mano").textContent=fmt(realmSold);
  const d=new Date(START_DATE+S.hour*3600e3);
  document.getElementById("dateBox").textContent=
    "Día "+(1+(S.hour/24|0))+" · "+d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear()+
    ", "+String(d.getUTCHours()).padStart(2,"0")+":00";
}
function costStr(cost,mano){
  const parts=[];
  for(const k in cost)parts.push(fmt(cost[k])+" "+RES_LABEL[k]);
  if(mano)parts.push(mano+" soldadesca");
  return parts.join(", ");
}
function n1(v){return (Math.round(v*10)/10).toString().replace(/\.0$/,"")}
function fxText(B){
  const fx=B.fx,t=[];
  if(fx.prodAdd)for(const k in fx.prodAdd)t.push("+"+n1(fx.prodAdd[k])+" "+RES_SHORT[k]);
  if(fx.prodMul)t.push("+"+Math.round(fx.prodMul*100)+"% prod");
  if(fx.goldAdd)t.push("+"+n1(fx.goldAdd)+" Duc");
  if(fx.mano)t.push("+"+Math.round(fx.mano*100)+"% soldadesca");
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
// ficha de solo lectura para una provincia ajena o impracticable (se gestiona abajo)
function readonlyProvCard(p){
  let s="<div class='bsum' style='flex:0 0 320px'><h4>"+p.name+(p.capital?" ★":"")+"</h4>";
  if(p.wasteland){
    s+="<div class='tl'>"+TERRAINS[p.terrain].label+"</div>";
    s+="<div class='prow'><span class='dim'>Territorio impracticable: nadie puede reclamarlo ni atravesarlo.</span></div>";
    return s+"</div>";
  }
  s+="<div class='tl'>"+(p.urban?"Ciudad":RES_LABEL[p.resType])+" · "+TERRAINS[p.terrain].label+" · moral "+Math.round(p.morale)+"%</div>";
  s+="<div class='prow'><span>👥 Población</span><b>"+fmtPop(p.pop)+"</b></div>";
  s+=foodLine(p);
  s+="<div class='prow'><span>Nación</span><b><span class='chip' style='background:"+NATIONS[p.owner].color+"'></span> "+NATIONS[p.owner].name+"</b></div>";
  s+="<div class='prow'><span class='dim'>"+terrainFx(p.terrain)+"</span></div>";
  const blist=Object.keys(BUILDINGS).filter(b=>lvlOf(p,b)>0);
  if(blist.length){
    s+="<div class='bsec'>Construcciones</div>";
    for(const b of blist)s+="<div class='prow'><span>"+BUILDINGS[b].icon+" "+BUILDINGS[b].label+"</span><b>"+(BUILDINGS[b].unique?"✓":lvlOf(p,b))+"</b></div>";
  }
  const here=armiesIn(p.id);
  if(here.length){
    s+="<div class='bsec'>Ejércitos</div>";
    for(const a of here)s+="<div class='prow'><span><span class='chip' style='background:"+NATIONS[a.nation].color+"'></span> "+
      Math.round(armyCount(a))+" u</span><b class='dim'>"+NATIONS[a.nation].name+"</b></div>";
  }
  return s+"</div>";
}
function refreshBuildBar(){
  const bar=document.getElementById("buildbar"),tabs=document.getElementById("buildtabs");
  const hide=()=>{bar.className="";bar.style.display="none";tabs.className="";tabs.style.display="none"};
  if(S.selArmy||S.selProv<0){hide();return}
  const p=S.provs[S.selProv];
  if(p.owner!==S.player||p.wasteland){
    tabs.className="";tabs.style.display="none";
    bar.innerHTML=readonlyProvCard(p);
    bar.className="show";bar.style.display="flex";
    return;
  }
  renderBuildTabs();
  const scroll=bar.scrollLeft;
  // desglose de ingresos y gastos de la provincia (de dónde proviene cada cosa)
  const bd=provBreakdown(p);
  const row=(lab,val,cls)=>"<div class='prow'><span>"+lab+"</span><b class='"+(cls||"")+"'>"+val+"</b></div>";
  let s="<div class='bsum'><h4>"+p.name+(p.capital?" ★":"")+"</h4>"+
    "<div class='tl'>"+(p.urban?"Ciudad":RES_LABEL[p.resType])+" · "+TERRAINS[p.terrain].label+
    " · moral "+Math.round(p.morale)+"%</div>"+
    "<div class='tl'>👥 "+fmtPop(p.pop)+" hab · ⚔ "+fmtPop(soldAvail(p))+"/"+fmtPop(soldCap(p))+" soldadesca</div>"+
    foodLine(p);
  // Ingresos (por fuente), en /mes
  s+="<div class='bsec'>Ingresos <span class='u'>/mes</span></div>";
  for(const it of bd.income){if(it.amt<0.005)continue;
    s+=row(RES_ICON[it.res]+" "+it.label,"+"+n1(it.amt),"pos");}
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
  // Caminos: enlaces a provincias propias adyacentes (se gestionan aquí, en el panel de provincia)
  s+="<div class='bsec'>Caminos</div>";
  let anyRoad=false;
  for(const b of S.adj[p.id]){
    if(S.provs[b].owner!==S.player)continue;
    anyRoad=true;
    const kmR=Math.round(kmBetween(p,S.provs[b]));
    if(hasRoad(p.id,b)){
      s+="<div class='prow'><span>→ "+S.provs[b].name+"</span><b class='dim'>camino</b></div>";
    }else if(S.roadQueue.some(q=>q.key===roadKey(p.id,b))){
      const q=S.roadQueue.find(q=>q.key===roadKey(p.id,b));
      s+="<div class='prow'><span>→ "+S.provs[b].name+"</span><b class='dim'>obra "+fmtDur(q.hoursLeft)+"</b></div>";
    }else{
      const dis=!canAfford(S.player,{dinero:800,materiales:1200});
      s+="<div class='prow'><span>→ "+S.provs[b].name+" ("+kmR+" km)</span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" title='800 Ducados, 1200 Madera — 6 meses' onclick='tryRoad("+p.id+","+b+")'>Camino</button></div>";
    }
  }
  if(!anyRoad)s+="<div class='prow'><span class='dim'>Sin provincias propias adyacentes.</span></div>";
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
// menú del reino (arriba-izquierda, estilo EU4): escudo + botonera de ajustes del reino
function buildRealmMenu(){
  if(S.player<0)return;
  const el=document.getElementById("realmMenu");
  const N=NATIONS[S.player];
  const btns=[
    {ic:"⚔",lab:"Ejército",on:"openArmyPanel()"},
    {ic:"🏛",lab:"Corte",dis:1},
    {ic:"📜",lab:"Leyes",dis:1},
    {ic:"⛪",lab:"Iglesia",dis:1}
  ];
  el.innerHTML="<div class='rmRow'><span class='rmShield' style='background:"+N.color+"' title='"+N.name+"'></span>"+
    btns.map(b=>"<button class='rmBtn'"+
      (b.dis?" disabled title='Próximamente'":" onclick='"+b.on+"'")+">"+
      "<span class='ic'>"+b.ic+"</span><span class='lab'>"+b.lab+"</span></button>").join("")+"</div>";
  el.className="show";
}
// log de métricas del reino (arriba-derecha, fijo): KPIs de tesorería + ejércitos desplegados
function refreshMetricsLog(){
  const el=document.getElementById("side");
  if(S.player<0||!S.started){el.style.display="none";return}
  const ne=nationEconomy(S.player),N=NATIONS[S.player];
  let realmPop=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)realmPop+=p.pop||0;
  let h="<div class='mlog'><span class='sh' style='background:"+N.color+"'></span>"+
    "<div><b>"+N.name+"</b><div style='color:#9aa3ad;font-size:11px'>"+ne.provs+" provincias · 👥 "+fmtPop(realmPop)+"<br>"+ne.troops+" tropas</div></div></div>";
  h+="<h3>Tesorería del reino <span style='color:#7a828b;font-weight:normal'>/mes</span></h3>";
  const ks=Object.keys(ne.res).filter(k=>Math.abs(ne.res[k])>0.05).sort((a,b)=>ne.res[b]-ne.res[a]);
  if(!ks.length)h+="<div class='kpi'><span class='dim' style='color:#7a828b'>Sin balance neto.</span></div>";
  for(const k of ks){const v=ne.res[k];
    h+="<div class='kpi'><span>"+RES_ICON[k]+" "+RES_LABEL[k]+"</span><span class='v' style='color:"+(v<0?"#e08a7a":"#8fce7e")+"'>"+(v>=0?"+":"")+n1(v)+"</span></div>";}
  const mine=S.armies.filter(a=>a.nation===S.player);
  h+="<h3>Ejércitos desplegados <span style='color:#7a828b;font-weight:normal'>"+mine.length+"</span></h3>";
  if(!mine.length)h+="<div class='kpi'><span style='color:#7a828b'>Ninguno. Recluta en ⚔ Ejército.</span></div>";
  for(const a of mine){
    const sel=S.selArmy&&S.selArmy.id===a.id;
    const loc=a.path.length?"→ "+S.provs[a.path[a.path.length-1]].name:S.provs[a.prov].name;
    const comp=Object.keys(a.units).filter(k=>a.units[k]>0.5).map(k=>Math.round(a.units[k])+" "+UNITS[k].label).join(", ");
    h+="<div class='armrow"+(sel?" sel":"")+"' onclick='selectArmyId("+a.id+")'>"+
      "<div><b>"+Math.round(armyCount(a))+" u</b> <span class='comp'>· "+loc+"</span><div class='comp'>"+comp+"</div></div>"+
      "<span class='comp'>"+armySpd(a)+" km/d</span></div>";
  }
  if(S.selArmy&&S.selArmy.nation===S.player){
    const a=S.selArmy;
    h+="<h3>Ejército seleccionado</h3>";
    h+="<div class='kpi'><span>Ataque "+armyAtk(a).toFixed(1)+" · Def "+armyDef(a).toFixed(1)+"</span><span class='v'>"+armySpd(a)+" km/d</span></div>";
    if(a.path.length)h+="<div class='row'><span class='sm'>En marcha → "+S.provs[a.path[a.path.length-1]].name+"</span><button class='bbtn red' onclick='haltArmy()'>Detener</button></div>";
    else h+="<div class='kpi'><span style='color:#7a828b'>Clic derecho en el mapa para mover.</span></div>";
  }
  el.innerHTML=h;el.style.display="block";
}
// panel de Ejército (overlay): ejércitos del reino + reclutamiento global con selector de provincia
function refreshArmyPanel(){
  if(!S.armyPanelOpen)return;
  const el=document.getElementById("armyBody");
  const mine=S.armies.filter(a=>a.nation===S.player);
  let L="<div class='col'><h2>Tus ejércitos ("+mine.length+")</h2>";
  if(!mine.length)L+="<p class='sm' style='color:#9aa3ad'>No tienes ejércitos. Recluta unidades a la derecha; al completarse aparecerán en su provincia.</p>";
  for(const a of mine){
    const loc=a.path.length?"en marcha → "+S.provs[a.path[a.path.length-1]].name:"en "+S.provs[a.prov].name;
    const comp=Object.keys(a.units).filter(k=>a.units[k]>0.5).map(k=>Math.round(a.units[k])+"× "+UNITS[k].label).join(", ")||"—";
    L+="<div class='acard'><div class='top'><b>"+Math.round(armyCount(a))+" unidades</b>"+
      "<button class='bbtn' onclick='selectArmyId("+a.id+");closeArmyPanel()'>Seleccionar</button></div>"+
      "<div class='comp'>"+comp+"</div>"+
      "<div class='stat'>"+loc+" · Ataque "+armyAtk(a).toFixed(1)+" · Defensa "+armyDef(a).toFixed(1)+" · "+armySpd(a)+" km/día</div></div>";
  }
  L+="</div>";
  const provs=S.provs.filter(p=>p.owner===S.player&&!p.wasteland).sort((a,b)=>a.name.localeCompare(b.name));
  if(S.recruitProv<0||!provs.some(p=>p.id===S.recruitProv))S.recruitProv=provs.length?provs[0].id:-1;
  let R="<div class='col'><h2>Reclutamiento</h2>";
  if(!provs.length)R+="<p class='sm' style='color:#9aa3ad'>Sin provincias donde reclutar.</p>";
  else{
    R+="<select class='recSel' onchange='setRecruitProv(this.value)'>"+
      provs.map(p=>"<option value='"+p.id+"'"+(p.id===S.recruitProv?" selected":"")+">"+p.name+(p.capital?" ★":"")+"</option>").join("")+"</select>";
    const p=S.provs[S.recruitProv];
    R+="<div class='sm' style='margin:4px 0 6px;color:#c9c2ae'>⚔ Soldadesca disponible: <b>"+fmtPop(soldAvail(p))+"</b> / "+fmtPop(soldCap(p))+" <span style='color:#9aa3ad'>(de "+fmtPop(p.pop)+" hab)</span></div>";
    let any=false;
    for(const u in UNITS){
      const U=UNITS[u];
      let okReq=true;for(const r in U.req)if(p.buildings[r]<U.req[r])okReq=false;
      if(!okReq)continue;
      any=true;
      const dis=!canAfford(S.player,U.cost)||soldAvail(p)<U.mano;
      R+="<div class='recrow'><span class='u'>"+U.label+" <span class='sm'>("+fmtDur(recruitTime(p,u))+")</span>"+
        "<div class='cst'>"+costStr(U.cost,U.mano)+"</div></span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" onclick='tryRecruit("+p.id+",\""+u+"\")'>Reclutar</button></div>";
    }
    if(!any)R+="<p class='sm' style='color:#9aa3ad'>Esta provincia aún no puede reclutar: construye un Cuartel de levas.</p>";
    if(p.recruitQueue.length){
      R+="<h3 style='color:#c9c2ae;font-size:13px;margin:12px 0 4px;border-bottom:1px solid #3a4047;padding-bottom:2px'>En cola</h3>";
      for(const q of p.recruitQueue)R+="<div class='recrow'><span class='u'>"+UNITS[q.u].label+"</span><span class='cst'>"+fmtDur(q.hoursLeft)+"</span></div>";
    }
  }
  R+="</div>";
  el.innerHTML=L+R;
}
// orquestador: refresca el log de métricas (dcha), la barra de provincia (abajo) y el panel de ejército
function refreshSide(){
  refreshMetricsLog();
  refreshBuildBar();
  refreshArmyPanel();
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
// Registro (ledger estilo EU4): tabla ordenable de todas las naciones vivas con provincias,
// población, tropas, fuerza militar e ingreso neto de ducados/mes. Referencia para balancear.
let ledgerSort="pop";
function ledgerRows(){
  const provsBy=new Array(NPLAY).fill(0),popBy=new Array(NPLAY).fill(0);
  for(const p of S.provs){const o=p.owner;if(o<0||o>=NPLAY||p.wasteland)continue;provsBy[o]++;popBy[o]+=p.pop||0}
  const troopsBy=new Array(NPLAY).fill(0),strBy=new Array(NPLAY).fill(0);
  for(const a of S.armies){const o=a.nation;if(o<0||o>=NPLAY)continue;troopsBy[o]+=armyCount(a);strBy[o]+=armyAtk(a)+armyDef(a)}
  const rows=[];
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    rows.push({n,name:NATIONS[n].name,color:NATIONS[n].color,provs:provsBy[n],pop:popBy[n],
      troops:Math.round(troopsBy[n]),str:Math.round(strBy[n]),income:nationEconomy(n).res.dinero||0});
  }
  return rows;
}
function refreshLedger(){
  const rows=ledgerRows();
  rows.sort((a,b)=>ledgerSort==="name"?a.name.localeCompare(b.name):(b[ledgerSort]-a[ledgerSort]));
  const th=(key,lab)=>"<th onclick=\"sortLedger('"+key+"')\" style='cursor:pointer'"+
    (ledgerSort===key?" class='on'":"")+">"+lab+(ledgerSort===key?" ▾":"")+"</th>";
  let h="<table class='dip led'><tr><th>#</th>"+th("name","Nación")+th("provs","Prov.")+
    th("pop","Población")+th("troops","Tropas")+th("str","Fuerza")+th("income","Ducados/mes")+"</tr>";
  rows.forEach((r,i)=>{
    const me=r.n===S.player;
    h+="<tr"+(me?" style='background:rgba(159,184,120,.18)'":"")+"><td>"+(i+1)+"</td>";
    h+="<td><span class='chip' style='background:"+r.color+"'></span> "+r.name+(me?" <b style='color:#9fb878'>(tú)</b>":"")+"</td>";
    h+="<td>"+r.provs+"</td><td>"+fmtPop(r.pop)+"</td><td>"+r.troops+"</td><td>"+r.str+"</td>";
    h+="<td style='color:"+(r.income<0?"#e08a7a":"#8fce7e")+"'>"+(r.income>=0?"+":"")+n1(r.income)+"</td></tr>";
  });
  h+="</table>";
  document.getElementById("ledgerBody").innerHTML=h;
}
window.sortLedger=function(k){ledgerSort=k;refreshLedger()};
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
    S.started=true;
    S.recruitProv=S.nations[S.player].capital;
    buildRealmMenu();
    const cap=S.provs[S.nations[S.player].capital];
    S.panX=canvas.width/2-cap.x*S.zoom;S.panY=canvas.height/2-cap.y*S.zoom;clampPan();
    S.selProv=cap.id;refreshSide();refreshTop();
    log("Has tomado el mando de "+NATIONS[S.player].name+". Capital: "+cap.name+".");
  }));
  document.getElementById("startOverlay").style.display="flex";
}

export {
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, refreshLedger, showNationPicker, buildRealmMenu, refreshMetricsLog, refreshArmyPanel
};
