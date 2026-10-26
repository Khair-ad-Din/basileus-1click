// ui.js
import { START_DATE, MESES, BUILDINGS, BUILD_CATS, GOLD_PER_WS, NATIONS, NPLAY, RES_DESC, RES_ICON, RES_KEYS, RES_LABEL, RES_SHORT, RES_STRAT, RES_TRADE, TERRAINS, UNITS, WAR_LOCK_HOURS, terrainFx, STRATA, STRATA_INFO, RES_ART, RES_CAT } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyPops, armyFood, armyForage, troopDrainOn, armyDef, armySpd, buildBlock, buildJobs, buildMax, buildSlots, canAfford, costFor, foodFill, harvestMul, storeCap, storeOf, SUBS_BASICS, freeLabor, isOccupied, jobsOf, lvlOf, moraleGrowth, MORALE_HOSTILE, nationProvCount, nationStrength, provDefMul, recruitable, recruitTime, soldAvail, soldCap, specialistCap, staffing, timeFor, usedSlots, terrMul, terrCatMul, RES_RAW_CATS, MONTH_TICKS, resetTsyLedger, tsyAvail, tsyMonthBal, taxRateOf, alcabalaOf, almojOf, ALCABALA, ALMOJ_DEFAULT, DIEZMO, provProdMul, YR_TICKS, manorOf, MANOR_RENT, bOwnerOf } from "./economy.js";
import { hasRoad, kmBetween, roadKey } from "./mapgen.js";
import { GOODS2, LABEL2, REF2, NEED2, WANT2, BLD2, PRICE_SCALE, CROWN_STOCK, specialty2, obsolete2, siteOK2, transport, buildingProfit2, buildingOutput2, upkeepScale, granaryOf, foodGrowth, reliefQuote, landYield, landCap, landBirth, LAND_FULL, popGrowthWhy, saleSplit, priceWhy, ARTISAN_MIX } from "./economy2.js";
import { calOf, MONTHS_ES, monthsToHarvest, harvestMonth } from "./economy.js";
import { canvas, clampPan, repaintProvince } from "./render.js";
import { continueGame, loadSaveMeta } from "./save.js";
import { armiesIn, atWar, duchyValue, fortGarrison, occupiedDuchiesBy, tryBuild, tryRecruit, tryRoad, warscore, coalitionOf, coalScore, coalCededDuchies } from "./sim.js";
import { getRel, relTier, THRESH, canDeclareWar, canInsult, isEmbargoed, hasClaim, relBreakdown, hasPact, canPact, MAX_LEAGUE, leagueOf, leagueById, sameLeague, canApplyLeague, MAX_RIVALS, rivalsOf, isRival, canRival, NAP_BONUS, ALLY_BONUS } from "./diplomacy.js";


// ===== tipBox: EL tooltip estructurado (design/ux/guia-estilo.md §1b, patrón Victoria 3). No se escribe otro a mano. =====
// blocks: [{h:"Cabecera" (1-2 palabras), sub:"resumen", rows:[[etiqueta,valor,color?,{in:1} sangrado?]], tot:[etiqueta,valor],
//           cols:["Concepto","Pide","Consigue"], trows:[[c0,c1,c2,...]], ttot:[c0,c1,...]}]. Entre bloques, un separador.
function tipBox(title,blocks,sub){
  let h="<div class='tbT'>"+title+"</div>"+(sub?"<div class='tbS'>"+sub+"</div>":"");
  blocks.filter(b=>b&&((b.rows&&b.rows.length)||(b.trows&&b.trows.length)||b.tot)).forEach((b,i)=>{
    if(i>0||sub)h+="<div class='tipSep'></div>";
    if(b.h)h+="<div class='tbH'>"+b.h+"</div>";
    if(b.sub)h+="<div class='tbS'>"+b.sub+"</div>";
    for(const r of b.rows||[])h+="<div class='tipR"+(r[3]&&r[3].in?" in":"")+"'><span>"+r[0]+"</span><span"+(r[2]?" style='color:"+r[2]+"'":"")+">"+r[1]+"</span></div>";
    if(b.cols){const n=b.cols.length;h+="<div class='tipGrid' style='grid-template-columns:1fr"+" auto".repeat(n-1)+"'>";
      for(const c of b.cols)h+="<span class='gh'>"+c+"</span>";
      b.trows.forEach((r,j)=>{for(let k=0;k<n;k++){const c=r[k];const col=c&&typeof c==="object"&&c.c?c.c:null,v=c&&typeof c==="object"&&"v" in c?c.v:c;
        h+="<span class='gc"+(k===0?" c0":"")+(j%2?" odd":"")+"'"+(col?" style='color:"+col+"'":"")+">"+(v==null?"":v)+"</span>"}});
      if(b.ttot)for(let k=0;k<n;k++)h+="<span class='gc tot"+(k===0?" c0":"")+"'>"+(b.ttot[k]==null?"":b.ttot[k])+"</span>";
      h+="</div>"}
    if(b.tot)h+="<div class='tipR tipTot'><span>"+b.tot[0]+"</span><span>"+b.tot[1]+"</span></div>";
  });
  return h;
}
// Hueco de icono: donde iría un icono que aún no tiene sprite (regla 2: nada de iconos Unicode). data-ico dice cuál.
const ph=name=>"<span class='icoPh' data-ico='"+name+"' title='icono: "+name+"'>[ ]</span>";
// Flecha de tendencia dibujada en CSS: up = sube (rojo: encarece), dn = baja (verde); upg/dnr = colores al revés.
const arw=k=>"<i class='arw "+k+"'></i>";
const COIN=()=>resImg("dinero");

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
function siegeLine(p){ // guarnición del fuerte y progreso de asedio en curso
  if(p.wasteland)return "";
  let s="";
  const g=fortGarrison(p);
  if(g>0)s+="<div class='tl'>"+uiIcon('defensa')+" Guarnición <b>"+g+"</b> levas"+(p.buildings.fortaleza?" · Castillo "+p.buildings.fortaleza:" · capital de ducado")+"</div>";
  if(p.siege){
    const pct=Math.round(100*Math.min(1,p.siege.prog/p.siege.need));
    const meses=Math.max(0,Math.round((p.siege.need-p.siege.prog)/730));
    s+="<div class='tl'><b style='color:#e0a17a'>⚔ ASEDIADA</b> por "+NATIONS[p.siege.by].name+" · "+pct+"% ("+meses+" meses)</div>";
  }
  return s;
}
function fmtDur(h){ // horas de juego -> texto legible
  if(h>=8760)return (h/8760).toFixed(1).replace(".0","")+" años";
  if(h>=720)return Math.round(h/730)+" meses";
  if(h>=48)return Math.round(h/24)+" días";
  return Math.round(h)+" h";
}
// icono de UI (stats, pestañas, menús): sprite de assets/ui. big = tamaño de botón/pestaña.
function uiIcon(name,big){return "<img class='uic"+(big?" big":"")+"' src='assets/ui/"+name+".png' alt=''>"}
// icono de recurso: sprite de assets/res (el archivo se llama como la clave del bien); sin sprite, el hueco [ ]
// nombre de un bien: en la v2 algunas claves de la v1 cambian de sentido (ganado=Carne, vino=Bebida, petroleo=Caballos…)
function gLabel(k){return LABEL2[k]||RES_LABEL[k]||k}
function resImg(k){
  return RES_ART.has(k) // ¿tiene sprite .png? si no, se pinta con su emoji (bienes nuevos)
    ?"<img class='ric' src='assets/res/"+k+".png' alt='"+gLabel(k)+"' title='"+gLabel(k)+"'>"
    :ph(k);
}
function buildResBar(){
  const bar=document.getElementById("resbar");
  if(bar.dataset.built)return;
  // El topbar es el RESUMEN DE TESORERÍA: el tesoro y el balance REAL del mes (libro de la corona) — la misma suma que la Tesorería
  const sep="<span class='barsep'></span>",hdr=t=>"<span class='reshdr'>"+t+"</span>";
  const tsy=" style='cursor:pointer' onclick='openTreasury()'";
  bar.innerHTML=
    "<span class='res' title='Ducados del tesoro — lo que puedes gastar este mes'>"+resImg('dinero')+"<b id='t_duc'>0</b> <small class='reslab'>ducados</small></span>"+sep+
    "<span id='t_hdr'>"+hdr("Mes pasado")+"</span>"+
    "<span class='res' id='t_incBox'"+tsy+"><small class='reslab'>Ingresos</small> <b id='t_inc' class='pos'>0</b></span>"+
    "<span class='res' id='t_expBox'"+tsy+"><small class='reslab'>Gastos</small> <b id='t_exp' class='neg'>0</b></span>"+
    "<span class='res' id='t_netBox'"+tsy+"><small class='reslab'>Balance</small> <b id='t_net'>0</b></span>"+sep+
    "<span class='res' title='Soldadesca del reino (cupo movilizable disponible)'>"+uiIcon('soldadesca')+"<b id='t_mano'>0</b></span>";
  bar.dataset.built="1";
}
// Desglose EU4 del resumen de tesorería: cada cifra de la barra superior suma sus partidas (libro de la corona, el mismo
// que la Tesorería). Solo se reescribe si cambia (refreshTop corre a menudo).
function topBookTips(cb){
  const ks=Object.keys(cb.cats), inc=ks.filter(c=>cb.cats[c]>=0.5).sort((a,b)=>cb.cats[b]-cb.cats[a]),
    exp=ks.filter(c=>cb.cats[c]<=-0.5).sort((a,b)=>cb.cats[a]-cb.cats[b]);
  const when=cb.forecast?"Previsión":cb.cur?"Este mes":"Mes pasado", row=c=>[c,{v:sgnE(cb.cats[c]),c:cb.cats[c]<0?"#d08080":null}];
  const tips={t_incBox:tipBox("Ingresos",[{cols:["Partida","Ducados"],trows:inc.map(row),ttot:["Total",sgnE(cb.inc)]}],when),
    t_expBox:tipBox("Gastos",[{cols:["Partida","Ducados"],trows:exp.map(row),ttot:["Total",sgnE(cb.exp)]}],when),
    t_netBox:tipBox("Balance",[{cols:["Concepto","Ducados"],trows:[["Ingresos",sgnE(cb.inc)],["Gastos",{v:sgnE(cb.exp),c:"#d08080"}]],ttot:["Tesoro",sgnE(cb.net)]}],when)};
  for(const id in tips){const el=document.getElementById(id);if(el&&el.getAttribute("data-tiph")!==tips[id])el.setAttribute("data-tiph",tips[id])}
}
function refreshTop(){
  // la fecha avanza siempre (también en modo observador, sin jugador)
  const d0=new Date(START_DATE+S.hour*3600e3);
  document.getElementById("dateBox").textContent=
    "Día "+(1+(S.hour/24|0))+" · "+d0.getUTCDate()+" "+MESES[d0.getUTCMonth()]+" "+d0.getUTCFullYear()+
    ", "+String(d0.getUTCHours()).padStart(2,"0")+":00";
  if(S.player<0){
    const bar=document.getElementById("resbar");
    bar.dataset.built="";  // fuerza reconstruir los chips al tomar el mando
    bar.innerHTML="<span style='color:#9aa3ad;font-style:italic;padding:0 10px;font-size:13px'>👁 Modo observador — toma el mando de una nación desde el <b>Registro</b></span>";
    return;
  }
  buildResBar();
  // Resumen de tesorería: el libro de la corona del mes cerrado (economy.js recCrown)
  const cb=crownBook("prev"),inc=cb.inc,exp=cb.exp,net=cb.net;
  {const hd=document.getElementById("t_hdr");if(hd)hd.innerHTML="<span class='reshdr'>"+(cb.forecast?"Previsión":cb.cur?"Este mes":"Mes pasado")+"</span>"}
  const setV=(id,txt,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=txt;if(cls!=null)el.className=cls};
  setV("t_duc",fmt(tsyAvail(S.player,"dinero")));
  setV("t_inc","+"+fmt(inc),"pos");
  setV("t_exp",(exp<-0.5?"−":"")+fmt(Math.abs(exp)),"neg");
  setV("t_net",(net>=0?"+":"−")+fmt(Math.abs(net)),net<0?"neg":"pos");
  topBookTips(cb);
  let realmSold=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland&&!isOccupied(p))realmSold+=soldAvail(p);
  setV("t_mano",fmt(realmSold));
}
function costStr(cost,mano){
  const parts=[];
  for(const k in cost)parts.push(fmt(cost[k])+" "+RES_LABEL[k]);
  if(mano)parts.push(mano+" soldadesca");
  return parts.join(", ");
}
function n1(v){return (Math.round(v*10)/10).toString().replace(/\.0$/,"")}
function costLine(c,owner){
  return Object.keys(c).map(k=>{
    const no=owner!=null&&tsyAvail(owner,k)<c[k];
    return "<span"+(no?" class='no'":"")+">"+resImg(k)+fmt(c[k])+"</span>";
  }).join(" ");
}
function renderBuildTabs(){
  const t=document.getElementById("buildtabs");
  const opts=[["all","Todos"]].concat(BUILD_CATS);
  t.innerHTML=opts.map(o=>"<span class='btab"+(S.buildFilter===o[0]?" on":"")+"' onclick='setBuildCat(\""+o[0]+"\")'>"+o[1]+"</span>").join("");
  t.className="show";t.style.display="flex";
}
// ---- Tooltips (ⓘ de ayuda y desglose de un valor al hover) ----
function ta(s){return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"&#10;")}
function iInfo(t){return " <i class='i' data-tip=\""+ta(t)+"\">i</i>"}
function statv(val,brk){return "<b class='statv' data-tip=\""+ta(brk)+"\">"+val+"</b>"}
// Línea del TERRENO: su nombre + su vocación por CATEGORÍA de producción (cereal/cultivo/ganado/bosque/
// extractivo/mar). El campo produce según el terreno: verde ×>1 rinde bien, rojo ×<1 rinde mal. Cada bien
// hereda el factor de su categoría. Va en su propia línea (separada del recurso estratégico).
const VOC_CATS=[["cereal","🌾","Cereal"],["cultivo","🍇","Cultivo"],["carne","🐑","Ganadería"],
  ["bosque","🪵","Bosque"],["extractivo","⛏","Minería"],["mar","🐟","Mar"]];
function terrainVocationHTML(p){
  if(p.wasteland||!p.terrain)return"";
  let cells="";
  for(const[cat,ico,lab]of VOC_CATS){
    if(cat==="mar"&&!p.coastal)continue; // el mar solo cuenta en la costa
    const m=terrCatMul(p,cat), cls=m>1.05?"pos":(m<0.95?"neg":"dim");
    const tip=lab+": ×"+m.toFixed(2)+(m>1.05?" — el terreno lo produce bien":m<0.95?" — el terreno lo produce mal":" — normal");
    cells+="<span class='voc "+cls+"' data-tip=\""+ta(tip)+"\">"+ico+"×"+m.toFixed(1)+"</span>";
  }
  return "<div class='tl vocrow'><span class='dim'>"+TERRAINS[p.terrain].label+
    iInfo(TERRAINS[p.terrain].label+" — "+terrainFx(p.terrain)+"\n\nRendimientos del terreno POR CATEGORÍA: qué produce bien o mal el campo. Cada bien hereda el factor de su categoría (cereal, cultivo, ganadería, bosque, minería, mar). La provincia produce grano y su especialidad (resType) según estos factores.")+
    ":</span> "+cells+"</div>";
}
// ---- Desgloses estilo EU4 (texto multilínea para el tooltip flotante) ----
function moraleBreak(p){
  let realmG=0;for(const q of S.provs){if(q.owner!==p.owner||q.wasteland)continue;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.realmMoral)realmG+=fx.realmMoral*(q.buildings[b]||0)}}
  let hostile=0;for(const a of (S.adj[p.id]||[]))if(!S.provs[a].wasteland&&S.provs[a].owner!==p.owner&&atWar(p.owner,S.provs[a].owner))hostile++;
  const loc=moraleGrowth(p),per=loc+realmG-MORALE_HOSTILE*hostile;
  let t="Moral "+Math.round(p.morale)+"% -> productividad x"+n1(p.morale/100)+"\n\nCambio mensual:\n";
  t+="  edificios de moral: "+(loc>=0?"+":"")+n1(loc)+"\n";
  if(realmG>0)t+="  obras del reino: +"+n1(realmG)+"\n";
  if(hostile>0)t+="  enemigos vecinos ("+hostile+"): -"+n1(MORALE_HOSTILE*hostile)+"\n";
  t+="  = "+(per>=0?"+":"")+n1(per)+"/mes";
  if(per<=0&&p.morale<100)t+="\n(construye templos para ganártela)";
  return t;
}
function dotBreak(p){
  const st=staffing(p);
  let t="Dotación de los edificios (multiplica su producción)\n"+
    "  Especialistas (cupo): "+fmtPop(specialistCap(p))+"\n"+
    ((p.mob||0)>1?"  - movilizados: "+fmtPop(p.mob)+"\n":"")+
    "  = mano de obra libre: "+fmtPop(freeLabor(p))+"\n"+
    "  Puestos exigidos: "+fmtPop(buildJobs(p))+"\n"+
    "  Dotación = "+Math.round(st*100)+"%\n\nDónde trabajan los pops (empleados / puestos):\n";
  let any=false;
  for(const b in BUILDINGS){const lvl=lvlOf(p,b),jb=jobsOf(b);if(!lvl||jb<=0)continue;any=true;
    t+="  "+BUILDINGS[b].label+(lvl>1&&!BUILDINGS[b].unique?" x"+lvl:"")+": "+fmtPop(lvl*jb*st)+" / "+fmtPop(lvl*jb)+"\n";}
  if(!any)t+="  (aún no hay edificios que empleen pops)\n";
  return t.replace(/\n$/,"");
}
function slotBreak(p){
  return "Huecos de construcción: "+usedSlots(p)+" usados de "+buildSlots(p)+"\n"+
    "Cupo = 5 base + 1 por cada 8.000 habitantes (máx 40).\n"+
    "Población: "+fmtPop(p.pop)+" hab. Más gente -> más edificios.";
}
function defBreak(p){
  let t="Defensa de la provincia\n";
  const T=TERRAINS[p.terrain];
  for(const b in BUILDINGS){const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(fx.def&&lvl)t+="  "+BUILDINGS[b].label+(lvl>1&&!BUILDINGS[b].unique?" x"+lvl:"")+": +"+Math.round(fx.def*lvl*100)+"%\n"}
  t+="  = x"+n1(provDefMul(p))+" por edificios\n";
  if(T.def!==1)t+="  terreno ("+T.label+"): x"+n1(T.def)+" (aparte, en combate)";
  return t;
}
// ---- Ficha de provincia — DETALLE (abajo-izquierda, estilo EU4) ----
function refreshProvPanel(){
  const panel=document.getElementById("provPanel");
  if(S.selArmy||S.selProv<0){panel.className="";panel.style.display="none";return}
  const p=S.provs[S.selProv];
  const own=p.owner===S.player&&!p.wasteland&&!isOccupied(p);
  // icono de estado junto al nombre: ★ capital del reino · ◼ capital de ducado
  const realmCap=S.nations[p.owner]&&S.nations[p.owner].capital===p.id;
  const duchyCap=p.duchy>=0&&S.duchies[p.duchy]&&S.duchies[p.duchy].cap===p.id;
  let statusIco="";
  if(realmCap)statusIco=" <span data-tip=\"Capital del reino\" style='color:#e8c24a'>★</span>";
  else if(duchyCap)statusIco=" <span data-tip=\"Capital de ducado\" style='color:#c9b06a;font-size:12px'>◼</span>";
  const lord=!p.wasteland&&p.owner<NPLAY;
  let s="<div class='ph'><h4 style='font-size:15px;color:#fff;margin:0;display:flex;justify-content:space-between;align-items:center'><span>"+p.name+statusIco+"</span>"+(lord?manorIcon(p):"")+"</h4></div><div class='bsum'>";
  if(p.wasteland){
    s+="<div class='tl'>"+TERRAINS[p.terrain].label+"</div>"+
       "<div class='prow'><span class='dim'>Territorio impracticable: nadie puede reclamarlo ni atravesarlo.</span></div></div>";
    panel.innerHTML=s;panel.className="show";panel.style.display="block";return;
  }
  // Identidad: reino (clicable → diplomacia si es otro) + ducado
  s+="<div class='tl'>"+(p.owner!==S.player&&p.owner<NPLAY?nameChip(p.owner):escOf(p.owner)+" "+NATIONS[p.owner].name)+
     (p.duchy>=0&&S.duchies[p.duchy]?" <span style='color:#5c636b'>|</span> "+uiIcon('ducado')+" "+S.duchies[p.duchy].name:"")+"</div>";
  if(isOccupied(p))s+="<div class='tl' style='color:#e0a17a'>⚔ Ocupada por "+escOf(p.occupier)+" "+NATIONS[p.occupier].name+"</div>";
  const sp=specialty2(p);
  s+="<div class='tl'>"+(p.urban?"Ciudad":"Campo")+(sp.length?" · "+sp.map(g=>resImg(g)+" "+gLabel(g)).join(" · "):"")+"</div>";
  s+=terrainVocationHTML(p);
  s+=provStats2(p,own)+siegeLine(p)+(own?tradeRow2(p):"")+pantryRow2(p)+landRow2(p)+produceRow2(p)+(own?yieldRows2(p):"");
  if(!own){const blist=Object.keys(BUILDINGS).filter(b=>lvlOf(p,b)>0);
    if(blist.length)s+="<div class='bsec'>Construcciones</div><div style='display:flex;flex-wrap:wrap;gap:2px 12px'>"+blist.map(b=>"<span>"+BUILDINGS[b].icon+" "+BUILDINGS[b].label+(BUILDINGS[b].unique?"":" ×"+lvlOf(p,b))+"</span>").join("")+"</div>";}
  const here=armiesIn(p.id);
  if(here.length){
    s+="<div class='bsec'>Ejércitos</div>";
    for(const a of here)s+="<div class='prow'><span>"+escOf(a.nation)+" "+Math.round(armyCount(a))+" u</span><b class='dim'>"+NATIONS[a.nation].name+"</b></div>";
  }
  s+="</div>";
  panel.innerHTML=s;panel.className="show";panel.style.display="block";
}
// tarjetas de construcción (una por categoría filtrada); las pinta la ventana de Construir
function buildTilesHTML(p){
  const showAll=S.buildFilter==="all";
  const cList=showAll?BUILD_CATS:BUILD_CATS.filter(c=>c[0]===S.buildFilter);
  let cats="<div class='bcats'>";
  for(const[cat,label]of cList){
    let tiles="";
    for(const b in BUILDINGS){
      const B=BUILDINGS[b];if(B.cat!==cat)continue;
      if(B.resReq&&p.resType!==B.resReq)continue; // mina de plata/oro: solo donde hay yacimiento
      const lvl=lvlOf(p,b),max=buildMax(p,b),inQ=p.buildQueue.some(q=>q.b===b);
      if(!lvl&&obsolete2(b))continue; // heredado de la v1 (bien que ya no existe u oro "de la nada"): no se ofrece
      const block=inQ?null:(buildBlock(p,b)||siteBlock2(p,b));
      const maxed=lvl>=max;
      let cls="btile";
      if(inQ)cls+=" building";else if(maxed)cls+=" done";else if(block)cls+=" locked";
      const lvBadge=B.unique?"<span class='uni'>Única</span>":(lvl>0?"<span class='lvb'>Nivel "+lvl+"</span>":"");
      // pie anclado abajo (misma posición en TODAS las tarjetas): mantenimiento · coste · tiempo/estado
      const upStr=B.up?"<div class='up'>"+uiIcon('mantenimiento')+" "+Object.keys(B.up).map(k=>resImg(k)+n1(B.up[k])).join(" ")+"/año</div>":"";
      let foot;
      if(inQ){const q=p.buildQueue.find(q=>q.b===b);foot="<div class='ftime' style='color:var(--title)'>⏳ En obra · "+fmtDur(q.hoursLeft)+"</div>";}
      else if(maxed)foot="<div class='ftime pos'>"+(B.unique?"✓ Construida":"Nivel máximo")+"</div>";
      else foot="<div class='cost'>"+costLine(costFor(p,b),S.player)+"</div>"+
          "<div class='ftime'>"+(block?"🔒 "+block:"⏱ "+fmtDur(timeFor(p,b)))+"</div>";
      // beneficios (producción viva + efectos, cada uno en su línea) y empleos en su propia fila
      const jb=jobsOf(b);
      const jobsHtml=jb>0?"<div class='jobs2'>"+uiIcon('poblacion')+" "+fmtPop(jb)+" empleos/niv</div>":"";
      const onclick=(!inQ&&!maxed&&!block)?" onclick='tryBuild("+p.id+",\""+b+"\")'":"";
      // ---- ciclo de vida (solo edificios YA construidos): rentabilidad + deshabilitar/reactivar + barra de condición ----
      const off=lvl>0&&!!(p.bOff&&p.bOff[b]);
      let ctrl="";
      if(lvl>0){
        const prof=(BLD2[b]||(B.fx&&B.fx.prodAdd))?bldEcon2(p,b,lvl).profit:null;
        const profTxt=prof!=null?"<span class='"+(prof>=0?"pos":"neg")+"' style='font-weight:bold'>"+(prof>=0?"+":"−")+fmt(Math.abs(prof))+"🪙/mes</span>":"<span></span>";
        const bs="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px;margin-top:5px;padding:3px 7px;border-radius:5px;cursor:pointer;";
        const own2=bOwnerOf(p,b);
        if(own2!=="corona"){ // v2: el taller de un estamento lo gestiona su dueño (lo cierra si no le rinde)
          ctrl="<div style='"+bs+"background:#262b31' data-tip=\""+ta("De "+STRATA_INFO[own2].label.toLowerCase()+": lo gestiona su dueño"+(off?" (ahora cerrado)":""))+"\">"+
            profTxt+"<span style='color:#9aa3ad;white-space:nowrap'>"+STRATA_INFO[own2].icon+(off?" cerrado":"")+"</span></div>";
        } else if(off){
          const cond=(p.bCond&&p.bCond[b]!=null)?p.bCond[b]:1;
          let rep=0;const base=costFor(p,b);for(const k in base)rep+=base[k]*(1-cond);rep=Math.round(rep);
          ctrl="<div style='"+bs+"background:#3a2a22' onclick='event.stopPropagation();toggleBuilding("+p.id+",\""+b+"\")' title='Reactivar (repara la parte degradada)'>"+
            "<span style='flex:1;height:5px;background:#241a14;border-radius:3px;overflow:hidden;display:inline-block'><i style='display:block;height:100%;background:#c98a3a;width:"+Math.round(cond*100)+"%'></i></span>"+
            "<span style='color:#e0a860;white-space:nowrap'>▶ Reactivar"+(cond<0.995?" · "+rep+"🪙":"")+"</span></div>";
        } else {
          ctrl="<div style='"+bs+"background:#262b31' onclick='event.stopPropagation();toggleBuilding("+p.id+",\""+b+"\")' title='Deshabilitar: libera dotación y deja de producir'>"+
            profTxt+"<span style='color:#9aa3ad;white-space:nowrap'>⏸ Off</span></div>";
        }
      }
      // lo que añade el SIGUIENTE nivel (marginal), con la rentabilidad v2 del dueño
      const hint=((BLD2[b]||(B.fx&&B.fx.prodAdd))&&!maxed&&!inQ&&!block)?nextHint2(p,b,lvl):"";
      tiles+="<div class='"+cls+"'"+onclick+(off?" style='opacity:.62'":"")+" data-tip=\""+ta(B.desc)+"\">"+
        "<img class='bic' src='assets/buildings/"+b+".png' alt='"+B.label+"' title='"+B.label+"' onerror=\"this.replaceWith(bemoji('"+B.icon+"'))\">"+
        "<div class='th'><span class='nm'>"+B.label+"</span>"+lvBadge+"</div>"+
        "<div class='ben'>"+benefitHTML2(p,b,lvl)+jobsHtml+hint+"</div>"+ctrl+
        "<div class='foot2'>"+upStr+foot+"</div></div>";
    }
    cats+="<div class='bcat'><div class='lab'>"+label+"</div><div class='btiles'>"+tiles+"</div></div>";
  }
  return cats+"</div>";
}
// lista de caminos (enlaces a provincias propias adyacentes); la pinta la ventana de Caminos
function roadsHTML(p){
  let rows="",any=false;
  for(const b of S.adj[p.id]){
    if(S.provs[b].owner!==S.player)continue;
    any=true;
    const kmR=Math.round(kmBetween(p,S.provs[b]));
    const key=roadKey(p.id,b), lvl=S.roads.get(key)||0;
    const q=S.roadQueue.find(q=>q.key===key);
    const name="→ "+S.provs[b].name;
    if(q){
      rows+="<div class='recrow'><span class='u'>"+name+" <span class='sm'>(→ nivel "+q.toLvl+")</span></span><span class='cst'>obra "+fmtDur(q.hoursLeft)+"</span></div>";
    }else if(lvl>=3){
      rows+="<div class='recrow'><span class='u'>"+name+"</span><span class='cst'>✓ nivel 3/3</span></div>";
    }else{
      const dis=!canAfford(S.player,{dinero:800,madera:1200});
      const tag=lvl>0?"<span class='cst' style='margin-right:6px'>nivel "+lvl+"/3</span>":"<span class='sm'>("+kmR+" km)</span> ";
      rows+="<div class='recrow'><span class='u'>"+name+" "+tag+"</span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" onclick='tryRoad("+p.id+","+b+")'>"+(lvl>0?"Mejorar":"Camino")+"</button></div>";
    }
  }
  if(!any)return "<div class='prow'><span class='dim'>Sin provincias propias adyacentes a las que unir por camino.</span></div>";
  return "<div class='sm' style='color:#9aa3ad;margin-bottom:7px'>Une provincias propias adyacentes: +10% de velocidad de marcha por nivel (máx nivel 3, +30%). Cada nivel cuesta 800 Ducados y 1200 Madera (6 meses).</div>"+rows;
}
// ejércitos presentes + reclutamiento de esta provincia; la pinta la ventana de Ejércitos
function armyHTML(p){
  let s="<div class='sm' style='margin:0 0 8px;color:#c9c2ae'>"+uiIcon('soldadesca')+" Soldadesca: <b>"+fmtPop(soldAvail(p))+"</b> / "+fmtPop(soldCap(p))+" <span style='color:#9aa3ad'>(de "+fmtPop(p.pop)+" hab)</span></div>";
  let any=false,r="";
  for(const u in UNITS){
    const U=UNITS[u];
    let ok=true;for(const req in U.req)if((p.buildings[req]||0)<U.req[req])ok=false;
    if(!ok)continue;
    any=true;
    const dis=!canAfford(S.player,U.cost)||soldAvail(p)<U.mano;
    r+="<div class='recrow'><span class='u'>"+U.label+" <span class='sm'>("+fmtDur(recruitTime(p,u))+")</span>"+
      "<div class='cst'>"+costStr(U.cost,U.mano)+"</div></span>"+
      "<button class='bbtn' "+(dis?"disabled":"")+" onclick='tryRecruit("+p.id+",\""+u+"\")'>Reclutar</button></div>";
  }
  s+="<div class='winh' style='font-size:12px;margin-top:2px'>Reclutar</div>";
  s+=any?r:"<div class='prow'><span class='dim'>Construye un Cuartel de levas para reclutar aquí.</span></div>";
  if(p.recruitQueue.length){
    s+="<div class='winh' style='font-size:12px'>En cola</div>";
    for(const q of p.recruitQueue)s+="<div class='recrow'><span class='u'>"+UNITS[q.u].label+"</span><span class='cst'>"+fmtDur(q.hoursLeft)+"</span></div>";
  }
  const here=armiesIn(p.id);
  s+="<div class='winh' style='font-size:12px'>Aquí ("+here.length+")</div>";
  if(!here.length)s+="<div class='prow'><span class='dim'>Sin ejércitos en la provincia.</span></div>";
  for(const a of here){
    const mine=a.nation===S.player;
    const comp=Object.keys(a.units).filter(k=>a.units[k]>0.5).map(k=>Math.round(a.units[k])+"× "+UNITS[k].label).join(", ")||"—";
    s+="<div class='acard'><div class='top'><b><span class='chip' style='background:"+NATIONS[a.nation].color+"'></span> "+Math.round(armyCount(a))+" u</b>"+
      (mine?"<button class='bbtn' onclick='selectArmyId("+a.id+")'>Seleccionar</button>":"<span class='sm' style='color:#9aa3ad'>"+NATIONS[a.nation].name+"</span>")+"</div>"+
      "<div class='comp'>"+comp+"</div></div>";
  }
  return s;
}
// ---- Columna de botones cuadrados a la derecha del detalle (abren su ventana) ----
function refreshProvTabs(){
  const el=document.getElementById("provTabs");
  if(S.selArmy||S.selProv<0){el.className="";el.style.display="none";return}
  const p=S.provs[S.selProv];
  const own=p.owner===S.player&&!p.wasteland&&!isOccupied(p);
  if(!own){el.className="";el.style.display="none";return}
  const tabs=[["build","trabajo","Construir"],["roads","caminos","Caminos"],["army","espadas","Ejércitos"],["eco","pergamino","Economía"]];
  el.innerHTML=tabs.map(t=>"<div class='ptab"+(S.provTab===t[0]?" on":"")+"' onclick='setProvTab(\""+t[0]+"\")'>"+
    uiIcon(t[1],true)+"<span class='lb'>"+t[2]+"</span></div>").join("");
  el.className="show";el.style.display="flex";
}
// ---- Ventana activa: Construir / Caminos / Ejércitos (según S.provTab) ----
function refreshProvWin(){
  const win=document.getElementById("provWin"),tabs=document.getElementById("buildtabs");
  const hide=()=>{win.className="";win.style.display="none";tabs.className="";tabs.style.display="none"};
  if(S.selArmy||S.selProv<0){hide();return}
  const p=S.provs[S.selProv];
  const own=p.owner===S.player&&!p.wasteland&&!isOccupied(p);
  if(!own||!S.provTab){hide();return}
  if(S.provTab==="build"){
    renderBuildTabs();
    const scroll=win.scrollLeft;
    win.innerHTML=buildTilesHTML(p);
    win.className="show build";win.style.display="flex";win.scrollLeft=scroll;
    return;
  }
  tabs.className="";tabs.style.display="none";
  let body;
  if(S.provTab==="roads")body="<div class='winh'>"+uiIcon('caminos')+" Caminos</div>"+roadsHTML(p);
  else if(S.provTab==="eco")body=provEcoWinHTML(p);
  else body="<div class='winh'>"+uiIcon('espadas')+" Ejércitos y reclutamiento</div>"+armyHTML(p);
  win.innerHTML="<div class='winbody'>"+body+"</div>";
  win.className="show list";win.style.display="block";
}
// compatibilidad: los llamadores antiguos refrescan la ficha completa (detalle + botones + ventana)
function refreshBuildBar(){refreshProvPanel();refreshProvTabs();refreshProvWin();}
// menú del reino (arriba-izquierda, estilo EU4): escudo + botonera de ajustes del reino
/* ============================= Tesorería (libro mayor navegable) =============================
 * Dos pestañas: TESORO (el libro de la corona por partidas; cada una abre su detalle, y el total verifica la
 * suma) y ALMACÉN (lo que guarda la corona para obras y ejército). Ver refreshTreasury2 (bloque v2, abajo). */
function tsyCrumb(path){ // migas de pan de navegación (volver a niveles superiores)
  let h="<span class='tcrumbi' onclick='treasuryBack(0)'>"+(S.treasuryTab==="tesoro"?"🪙 Tesoro":"📦 Almacén")+"</span>";
  for(let i=0;i<path.length;i++){
    const label=(S.treasuryTab==="inv"&&i===0)?RES_LABEL[path[i]]:path[i];
    h+=" › "+(i===path.length-1?"<b class='tcrumbc'>"+label+"</b>":"<span class='tcrumbi' onclick='treasuryBack("+(i+1)+")'>"+label+"</span>");
  }
  return "<div class='tcrumb'>"+h+"</div>";
}
function refreshTreasury(){
  const ov=document.getElementById("treasuryOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("treasuryBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver su tesorería.</p>";return}
  refreshTreasury2(body);
}
function buildRealmMenu(){
  if(S.player<0)return;
  const el=document.getElementById("realmMenu");
  const N=NATIONS[S.player];
  const btns=[
    {img:"btn_ejercito",on:"openArmyPanel()"},
    {img:"btn_corte",dis:1},
    {img:"btn_tesoreria",on:"openTreasury()"},
    {img:"btn_leyes",dis:1},
    {img:"btn_estamentos",on:"openEstates()"},
    {emoji:"🕊",on:"openDiplo()",title:"Diplomacia: ligas, alianzas y rivalidades (clic derecho en un país para su diplomacia)"},
    {emoji:"⚖️",on:"openFiscal()",title:"Cortes · Hacienda (ajustar impuestos)"},
    {emoji:"🏪",on:"openMercado()",title:"Mercado"},
    {emoji:"📝",on:"startEconLog()",title:"Log económico EN VIVO (elige un fichero; se rellena mientras juegas)"},
    {emoji:"💾",on:"downloadEconLog()",title:"Descargar el log económico acumulado (JSON)"}
  ];
  el.innerHTML="<div class='rmEscudo' title='"+N.name+"'><span class='rmEscCol' style='background:"+N.color+"'></span>"+
      "<img src='assets/ui/escudo.png' alt='"+N.name+"'></div>"+
    btns.map(b=>b.emoji
      ?"<span class='rmBtnEmoji' title='"+b.title+"' onclick='"+b.on+"'>"+b.emoji+"</span>"
      :"<img class='rmBtnImg"+(b.dis?" dis":"")+"' src='assets/ui/"+b.img+".png' alt=''"+
        (b.dis?" title='Próximamente'":" onclick='"+b.on+"'")+">").join("");
  el.className="show";
}
// log de métricas del reino (arriba-derecha, fijo): KPIs de tesorería + ejércitos desplegados
function refreshMetricsLog(){
  const el=document.getElementById("side");
  if(S.player<0||!S.started){el.style.display="none";return}
  const N=NATIONS[S.player];
  let nprov=0,troops=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)nprov++;for(const a of S.armies)if(a.nation===S.player)troops+=armyCount(a);
  let realmPop=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)realmPop+=p.pop||0;
  let h="<div class='mlog'><span class='sh' style='background:"+N.color+"'></span>"+
    "<div><b>"+N.name+"</b><div style='color:#9aa3ad;font-size:11px'>"+nprov+" provincias · "+uiIcon('poblacion')+" "+fmtPop(realmPop)+"<br>"+Math.round(troops)+" tropas</div></div></div>";
  // balance real del tesoro (libro de la corona) + almacén de la corona
  {
    const cb=crownBook("prev");
    h+="<h3 style='cursor:pointer' onclick='openTreasury()'>Tesorería del reino <span style='color:#7a828b;font-weight:normal'>"+(cb.cur?"este mes":"mes pasado")+"</span></h3>";
    const kpi=(lab,v)=>"<div class='kpi'><span>"+lab+"</span><span class='v "+(v<0?"neg":"pos")+"'>"+(v>=0?"+":"−")+fmt(Math.abs(v))+"</span></div>";
    h+=kpi(resImg("dinero")+" Ingresos",cb.inc)+kpi(resImg("dinero")+" Gastos",cb.exp)+kpi("<b>Balance</b>",cb.net);
    const R=S.nations[S.player].res,ks=Object.keys(R).filter(k=>k!=="dinero"&&Math.abs(tsyMonthBal(k))>=0.5);
    if(ks.length){h+="<div class='kpicat'>📦 Almacén de la corona</div>";for(const k of ks)h+=kpi(resImg(k)+" "+gLabel(k),tsyMonthBal(k))}
  }
  const mine=S.armies.filter(a=>a.nation===S.player);
  h+="<h3>Ejércitos desplegados <span style='color:#7a828b;font-weight:normal'>"+mine.length+"</span></h3>";
  if(!mine.length)h+="<div class='kpi'><span style='color:#7a828b'>Ninguno. Recluta en ⚔ Ejército.</span></div>";
  for(const a of mine){
    const sel=S.selArmy&&S.selArmy.id===a.id;
    const loc=a.path.length?"→ "+S.provs[a.path[a.path.length-1]].name:S.provs[a.prov].name;
    const comp=Object.keys(a.units).filter(k=>a.units[k]>0.5).map(k=>Math.round(a.units[k])+" "+UNITS[k].label).join(", ");
    h+="<div class='armrow"+(sel?" sel":"")+"' onclick='selectArmyId("+a.id+")'>"+
      "<div><b>"+fmt(armyPops(a))+" "+uiIcon('soldadesca')+"</b> <span class='comp'>· "+loc+"</span><div class='comp'>"+comp+"</div></div>"+
      "<span class='comp'>"+armySpd(a)+" km/d</span></div>";
  }
  // el DETALLE del ejército seleccionado (composición, licenciar, suministro, mover) vive ahora en
  // su ventana propia (#armyWin, abajo-izquierda); aquí arriba-derecha solo la LISTA para seleccionar.
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
    R+="<div class='sm' style='margin:4px 0 6px;color:#c9c2ae'>"+uiIcon('soldadesca')+" Soldadesca disponible: <b>"+fmtPop(soldAvail(p))+"</b> / "+fmtPop(soldCap(p))+" <span style='color:#9aa3ad'>(de "+fmtPop(p.pop)+" hab)</span></div>";
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
// ventana de EJÉRCITO propia (abajo-izquierda, estilo EU4): composición por tipo, crear/licenciar,
// reclutar, SUMINISTRO (slider forrajeo local ↔ nacional) y levantar levas. Se muestra al seleccionar
// un ejército propio (excluyente con la ficha de provincia).
function refreshArmyWin(){
  const el=document.getElementById("armyWin");
  const a=S.selArmy;
  if(!a||a.nation!==S.player||!S.armies.includes(a)){
    el.className="";el.style.display="none";
    if(S.recruitUnit||S.armyEdit){S.recruitUnit=null;S.armyEdit=false} // limpiar modos al perder la selección
    refreshArmyEdit(null);
    return;
  }
  const P=S.provs[a.prov];
  const loc=a.path.length?"en marcha → "+S.provs[a.path[a.path.length-1]].name:"en "+(P?P.name:"—");
  let s="<div class='bsum'>";
  // cabecera: identidad izquierda, POPS soldados a la derecha
  s+="<div class='ph' style='display:flex;justify-content:space-between;align-items:center'>"+
     "<h4 style='font-size:15px;color:#fff;margin:0'>"+uiIcon('espadas')+" Ejército</h4>"+
     "<b style='font-size:14px'>"+fmt(armyPops(a))+" "+uiIcon('soldadesca')+"</b></div>";
  s+="<div class='tl' style='color:#9aa3ad'>"+loc+" · ⚔ "+armyAtk(a).toFixed(1)+" · 🛡 "+armyDef(a).toFixed(1)+" · "+armySpd(a)+" km/d</div>";
  if(a.path.length)s+="<div class='uline'><span class='sm' style='color:#c9a86a'>En marcha</span><button class='mini red' onclick='haltArmy()'>Detener</button></div>";
  else if(a.muster&&S.hour<a.muster.until)s+="<div class='tl' style='color:#c9a86a'>⏳ Reuniendo tropas…</div>";
  // COMPOSICIÓN (tabla Tipo | Cantidad | Pops) + botón Editar
  s+="<div class='bsec' style='display:flex;justify-content:space-between;align-items:center'>"+
     "<span>Composición</span><button class='mini"+(S.armyEdit?" on":"")+"' onclick='toggleArmyEdit()'>✎ Editar</button></div>";
  s+="<table class='ctab'><tr><th>Tipo</th><th>Cantidad</th><th>Pops</th></tr>";
  let anyU=false;
  for(const k in a.units){if(a.units[k]<0.5)continue;anyU=true;const n=Math.round(a.units[k]);
    s+="<tr><td>"+UNITS[k].label+"</td><td>×"+n+"</td><td>"+fmt(n*(UNITS[k].mano||0))+"</td></tr>";}
  if(!anyU)s+="<tr><td colspan='3' style='color:#7a828b'>Sin tropas</td></tr>";
  s+="</table>";
  // RECLUTAMIENTO: todas las unidades reclutables en el reino; clic → modo reclutar-desde-el-mapa
  s+="<div class='bsec'>Reclutamiento</div>";
  const rec=Object.keys(UNITS).filter(u=>S.provs.some(p=>recruitable(p,u)));
  if(!rec.length)s+="<div class='tl' style='color:#7a828b'>Sin edificios para reclutar. Construye un Cuartel.</div>";
  for(const u of rec){
    const on=S.recruitUnit===u;
    s+="<div class='uline'><button class='rbtn"+(on?" on":"")+"' onclick='setRecruitUnit(\""+u+"\")'>"+
       (on?"✓ ":"")+UNITS[u].label+" <span style='color:#9aa3ad'>· "+fmt(UNITS[u].mano)+" "+uiIcon('soldadesca')+"</span></button>"+
       (u==="miliciano"?"<span class='qlev'><button class='mini' onclick='raiseLevies("+a.id+",5)'>+5</button> <button class='mini' onclick='raiseLevies("+a.id+",10)'>+10</button></span>":"")+"</div>";
  }
  if(S.recruitUnit)s+="<div class='tl' style='color:#9fb878;font-size:11px'>Clic en el mapa en las provincias con <b>+</b> para reclutar (las tropas marchan a reunirse con este ejército).</div>";
  // SUMINISTRO de grano (slider reserva local ↔ nacional + consumo/mes); detalle en la ⓘ
  const sup=a.supply==null?70:a.supply, foodMonth=armyFood(a)*730; // 730 ticks ≈ 1 mes de juego
  s+="<div class='bsec'>Suministro de grano"+iInfo("Reparte de dónde saca el grano el ejército: la reserva NACIONAL gasta el Grano del tesoro del reino; la reserva LOCAL lo toma de la despensa de la provincia donde está y sus vecinas, repartido para no vaciar una sola (si aprieta, puede provocar hambruna local).")+"</div>";
  s+="<input class='supply' type='range' min='0' max='100' step='5' value='"+sup+"' oninput='setArmySupply("+a.id+",this.value)'>";
  s+="<div class='prow' id='supLbl'><span>Reserva local <b>"+sup+"%</b></span><b>Reserva nacional "+(100-sup)+"%</b></div>";
  // consumo/mes dividido: IZQUIERDA lo que sostienen las provincias (con desglose al hover), DERECHA lo
  // que sostienen las arcas nacionales. Alineado bajo los % de arriba. (Sin la palabra "Consumo".)
  const localM=foodMonth*(sup/100), natM=foodMonth*(1-sup/100), fp=armyForage(a);
  let ltip="De las reservas LOCALES: "+n1(localM)+" grano/mes\nForrajeado de la provincia que pisa y sus vecinas (a prorrata de la reserva de cada una):\n";
  if(fp.length)for(const it of fp)ltip+="  · "+it.p.name+": "+n1(it.amt*730)+"/mes\n";
  else ltip+="  · sin reservas locales alrededor";
  s+="<div class='prow'>"+
     "<b class='statv' id='supLoc' data-tip=\""+ta(ltip)+"\"><span class='n'>"+n1(localM)+"</span> "+resImg('grano')+"/mes</b>"+
     "<b class='statv' data-tip=\""+ta("De las arcas NACIONALES: "+n1(natM)+" grano/mes\nSale del Grano del tesoro del reino.")+"\" id='supNat'><span class='n'>"+n1(natM)+"</span> "+resImg('grano')+"/mes</b></div>";
  s+="</div>";
  el.innerHTML=s;el.className="show";el.style.display="block";
  refreshArmyEdit(a); // menú Editar (licenciar) a la derecha
}
// menú "Editar" a la derecha de la ventana de ejército: licenciar tropas por tipo
function refreshArmyEdit(a){
  const ed=document.getElementById("armyEdit");if(!ed)return;
  if(!S.armyEdit||!a){ed.className="";ed.style.display="none";return}
  let s="<div class='winh' style='font-size:13px'>✎ Licenciar</div>"+
    "<div class='sm' style='color:#9aa3ad;margin-bottom:6px'>Devuelve la soldadesca a sus provincias de origen y baja el consumo.</div>";
  let any=false;
  for(const k in a.units){if(a.units[k]<0.5)continue;any=true;const n=Math.round(a.units[k]);
    s+="<div class='uline'><span class='sm'>"+UNITS[k].label+" <span style='color:#9aa3ad'>×"+n+"</span></span>"+
       "<span><button class='mini' onclick='disbandUnit("+a.id+",\""+k+"\",1)'>−1</button> "+
       "<button class='mini red' onclick='disbandUnit("+a.id+",\""+k+"\",99)'>Todas</button></span></div>";}
  if(!any)s+="<div class='sm' style='color:#7a828b'>Sin tropas.</div>";
  ed.innerHTML=s;ed.className="show";ed.style.display="block";
}
function refreshSide(){
  refreshMetricsLog();
  refreshBuildBar();
  refreshArmyPanel();
  refreshArmyWin();
}
// Barra visual del campo compartido Tensión↔Concordia (−100..+100). El 0 es el centro; la barra
// se llena a la IZQUIERDA en rojo (tensión) o a la DERECHA en verde/azul (concordia).
function relBarHTML(v){
  const half=50, w=Math.abs(v)/100*half, t=relTier(v);
  const seg=v<0?"left:"+(half-w)+"%;width:"+w+"%;background:#c0564e"
            :v>0?"left:"+half+"%;width:"+w+"%;background:"+t.color
            :"left:"+half+"%;width:0";
  return "<div class='relbar' title='"+t.label+" ("+(v>0?"+":"")+Math.round(v)+")'>"+
    "<div class='relfill' style='"+seg+"'></div><div class='relzero'></div></div>";
}
// ============ VISTA DE DIPLOMACIA (componente único) ============
// TODA la diplomacia vive aquí. Dos modos en S.diploView:
//  · "own"    → resumen de MI diplomacia + las ENTIDADES del tablero (ligas, alianzas, rivalidades) + tabla.
//  · "nation" → diplomacia BILATERAL con un país: su perfil y todas las acciones.
// Se abre con el botón del reino (arriba-izq), con clic DERECHO sobre un país (sin ejército seleccionado)
// o desde la ficha de provincia. refreshDiplomacy() se sigue llamando desde todos los handlers.
// Escudo simplificado del reino (forma de escudo, color de la nación). Sustituye al chip cuadrado.
// `lead` = líder/fundador: borde dorado siguiendo la silueta.
const escOf=(n,big,lead)=>"<span class='esc"+(big?" escL":"")+(lead?" lead":"")+"' title='"+NATIONS[n].name+"' style='background:"+NATIONS[n].color+"'></span>";
// Desglose de la relación como tooltip ESTRUCTURADO (data-tiph): una fila por aporte + total.
function relTipHTML(a,b){
  const br=relBreakdown(a,b), v=getRel(a,b), t=relTier(v);
  let h="<div class='tipT'>"+NATIONS[a].name+" · "+NATIONS[b].name+"</div>";
  if(br.length)for(const x of br)h+="<div class='tipR'><span>"+x.label+"</span><span style='color:"+(x.v>=0?"#8fb06a":"#d08080")+"'>"+(x.v>0?"+":"")+Math.round(x.v)+"</span></div>";
  else h+="<div class='tipR'><span style='color:#7a828b'>Sin modificadores</span><span>0</span></div>";
  h+="<div class='tipR tipTot'><span>"+t.label+"</span><span style='color:"+t.color+"'>"+(v>0?"+":"")+Math.round(v)+"</span></div>";
  return h;
}
// Barra de relación con el desglose en el hover (no ocupa sitio en pantalla).
const relBarTip=(a,b)=>"<span data-tiph=\""+ta(relTipHTML(a,b))+"\" style='cursor:help'>"+relBarHTML(getRel(a,b))+"</span>";
const chipOf=escOf, chipT=escOf;
const nameChip=n=>"<span class='dChip' onclick='openDiplo("+n+")' title='Diplomacia con "+NATIONS[n].name+"'>"+escOf(n)+" "+NATIONS[n].name+"</span>";
// igual, marcando al LÍDER de la liga con el borde dorado
const nameChipL=(n,lead)=>"<span class='dChip' onclick='openDiplo("+n+")' title='"+(lead?"Fundador · ":"")+NATIONS[n].name+"'>"+escOf(n,0,lead)+" "+NATIONS[n].name+"</span>";
const dDash="<span class='dim'>—</span>";
// aliados (pacto de alianza) de n
function alliesOf(n){const o=[];for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m]&&S.nations[m].alive&&hasPact(n,m)==="alliance")o.push(m);return o;}
// quién rivaliza a n (rivalidad entrante)
function rivaledBy(n){const o=[];for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m]&&S.nations[m].alive&&(rivalsOf(m)||[]).includes(n))o.push(m);return o;}

// --- MODO "own": mi diplomacia + entidades del tablero + tabla por nación ---
function diploOwnHTML(){
  const me=S.player;
  const myL=leagueOf(me), myA=alliesOf(me), myR=rivalsOf(me)||[], byR=rivaledBy(me);
  let h="";
  if(S.hour<WAR_LOCK_HOURS)h+="<div class='sm' style='color:#c9a86a;margin-bottom:8px'>⚔ Paz obligada: no se puede declarar la guerra hasta dentro de "+fmtDur(WAR_LOCK_HOURS-S.hour)+".</div>";
  const rivFull=myR.length>=MAX_RIVALS;
  h+="<div class='dipDetail'><div style='margin-bottom:6px'>"+escOf(me,1)+" <b style='font-size:15px'>"+NATIONS[me].name+"</b></div><div class='dGrid'>"+
     "<div><span class='dLbl'>🛡 Liga</span>"+(myL?("<span class='dChip' onclick='openLeagues("+myL.id+")'>🛡 <b>"+myL.name+"</b></span> <span class='sm' style='color:#7a828b'>("+myL.members.length+")</span>"):("<span class='dim'>—</span> <button class='bbtn sm' onclick='openLeagues()' title='Ligas'>+</button>"))+"</div>"+
     "<div><span class='dLbl'>🤝 Aliados</span>"+(myA.length?myA.map(nameChip).join(" "):dDash)+"</div>"+
     "<div><span class='dLbl'>⚔ Rivales</span>"+(myR.length?myR.map(nameChip).join(" "):"")+
       "<button class='bbtn sm'"+(rivFull?" disabled title='Ya tienes "+MAX_RIVALS+" rivales'":" onclick='openDipModal(&quot;rival&quot;)' title='Declarar rival'")+">+</button>"+
       "<span class='sm' style='color:#7a828b'>"+myR.length+"/"+MAX_RIVALS+"</span></div>"+
     "<div><span class='dLbl'>☠ Enemigos</span>"+(byR.length?byR.map(nameChip).join(" "):dDash)+"</div>"+
     "</div></div>";
  // ENTIDADES: ligas
  h+="<div class='dSecT'>🛡 Ligas <span class='statv' data-tip='Organización defensiva multi-miembro: atacar a un miembro convoca a los demás a defenderlo. El escudo con borde dorado es el fundador.'>ⓘ</span></div>";
  if(S.leagues.length){
    h+="<div class='dCards'>";
    for(const L of S.leagues){
      const mine=L.members.includes(me);
      h+="<div class='dCard"+(mine?" mine":"")+"'><div class='dCardT'><span class='dChip' onclick='openLeagues("+L.id+")'>🛡 "+L.name+"</span> <span class='sm' style='color:#7a828b'>("+L.members.length+"/"+MAX_LEAGUE+")</span></div>"+
         "<div>"+L.members.map(m=>nameChipL(m,m===L.founder)).join(" ")+"</div></div>";
    }
    h+="</div>";
  } else h+="<div class='dim sm'>No hay ligas.</div>";
  // ENTIDADES: alianzas
  const pairs=[];
  for(const [k,t] of S.pacts){
    if(t!=="alliance")continue;
    const i=k.indexOf("|"), a=+k.slice(0,i), b=+k.slice(i+1);
    if(!S.nations[a]||!S.nations[a].alive||!S.nations[b]||!S.nations[b].alive)continue;
    pairs.push([a,b]);
  }
  h+="<div class='dSecT'>🤝 Alianzas</div>";
  h+=pairs.length?("<div class='dPairs'>"+pairs.map(x=>"<span class='dPair"+((x[0]===me||x[1]===me)?" mine":"")+"'>"+nameChip(x[0])+" ↔ "+nameChip(x[1])+"</span>").join("")+"</div>"):"<div class='dim sm'>Ninguna.</div>";
  // TABLA por nación
  h+="<div class='dSecT'>Por nación</div>";
  h+="<table class='dip'><tr><th>Nación</th><th>Liga</th><th>Aliados</th><th>Rivales</th><th>Enemigos</th><th>Relación</th><th>Estado</th></tr>";
  for(let n=0;n<NPLAY;n++){
    if(n===me||!S.nations[n])continue;
    if(!S.nations[n].alive)continue;
    const L=leagueOf(n), A=alliesOf(n), R=rivalsOf(n)||[], E=rivaledBy(n), v=getRel(me,n), t=relTier(v);
    h+="<tr class='dipRow' onclick='openDiplo("+n+")'>";
    h+="<td class='dipName'>"+escOf(n)+" "+NATIONS[n].name+"</td>";
    h+="<td class='sm'>"+(L?("🛡 "+L.name):dDash)+"</td>";
    h+="<td class='sm'>"+(A.length?A.map(m=>escOf(m)).join(" "):dDash)+"</td>";
    h+="<td class='sm'>"+(R.length?R.map(m=>escOf(m)).join(" "):dDash)+"</td>";
    h+="<td class='sm'>"+(E.length?E.map(m=>escOf(m)).join(" "):dDash)+"</td>";
    h+="<td>"+relBarTip(me,n)+" <span style='color:"+t.color+";font-weight:600'>"+(v>0?"+":"")+Math.round(v)+"</span></td>";
    h+="<td class='sm' style='color:"+(atWar(me,n)?"#d08080":t.color)+"'>"+(atWar(me,n)?"EN GUERRA":t.label)+"</td>";
    h+="</tr>";
  }
  h+="</table>";
  return h;
}

// --- MODO "nation": diplomacia bilateral con n (su perfil + TODAS las acciones) ---
function diploNationHTML(n){
  const me=S.player, v=getRel(me,n), t=relTier(v);
  const L=leagueOf(n), A=alliesOf(n), R=rivalsOf(n)||[], E=rivaledBy(n);
  const locked=S.hour<WAR_LOCK_HOURS;
  let h="<div style='margin-bottom:8px'><button class='bbtn' onclick='diploBack()'>←</button></div>";
  h+="<div class='dipDetail'>";
  h+="<div style='margin-bottom:4px'>"+escOf(n,1)+" <b style='font-size:15px'>"+NATIONS[n].name+"</b> "+
     "<span style='color:"+t.color+";font-weight:600'>"+(v>0?"+":"")+Math.round(v)+" · "+t.label+"</span>"+
     (isRival(me,n)?" <span class='dPair mine' style='padding:1px 6px'>⚔ Rivalidad</span>":"")+"</div>";
  h+="<div style='margin:5px 0 8px'>"+relBarTip(me,n)+"</div>"; // el desglose vive en el hover de la barra
  h+="<div class='dGrid'>"+
     "<div><span class='dLbl'>🛡 Liga</span>"+(L?("<span class='dChip' onclick='openLeagues("+L.id+")'>🛡 <b>"+L.name+"</b></span> <span class='sm' style='color:#7a828b'>("+L.members.length+")</span>"):dDash)+"</div>"+
     "<div><span class='dLbl'>🤝 Aliados</span>"+(A.length?A.map(nameChip).join(" "):dDash)+"</div>"+
     "<div><span class='dLbl'>⚔ Rivales</span>"+(R.length?R.map(nameChip).join(" "):dDash)+"</div>"+
     "<div><span class='dLbl'>☠ Enemigos</span>"+(E.length?E.map(nameChip).join(" "):dDash)+"</div>"+
     "</div></div>";
  // --- gestos / economía ---
  const ci=canInsult(me,n);
  h+="<div class='dipActs'>";
  h+="<button class='bbtn'"+(ci.ok?" onclick='dipInsult("+n+")'":" disabled title='En cooldown (≈1 mes entre insultos)'")+">⚡ Insultar</button>";
  h+="<button class='bbtn' onclick='openDipModal(&quot;gift&quot;,"+n+")'>🎁 Regalar</button>";
  h+="<button class='bbtn' onclick='openDipModal(&quot;claim&quot;,"+n+")'>📜 Reclamaciones</button>";
  const emb=isEmbargoed(me,n), canEmb=v<=THRESH.embargo;
  if(emb) h+="<button class='bbtn' onclick='dipEmbargo("+n+")' title='Corta el comercio con este reino: vuestros mercaderes dejan de arbitrar entre los dos mercados'>🚫 Levantar embargo</button>";
  else h+="<button class='bbtn'"+(canEmb?" onclick='dipEmbargo("+n+")' title='Corta el comercio con este reino: vuestros mercaderes dejan de arbitrar entre los dos mercados'":" disabled title='Necesitas ≤ "+THRESH.embargo+" de tensión'")+">🚫 Embargo</button>";
  h+="</div>";
  // --- rivalidad (pública) ---
  const myR=rivalsOf(me)||[], isR=myR.includes(n);
  h+="<div class='dipActs' style='margin-top:6px'>";
  if(isR) h+="<button class='bbtn' onclick='dipRival("+n+")' title='Dejar de considerarlo rival'>⚔ Quitar rivalidad</button>";
  else{
    const full=myR.length>=MAX_RIVALS, ok=canRival(me,n);
    const tip=full?("Ya tienes "+MAX_RIVALS+" rivales: quita uno primero"):(!ok?"No puedes rivalizar a un aliado ni a un co-miembro de tu liga":"Declaración pública: tensión con él, y concordia con quien comparta este rival");
    h+="<button class='bbtn'"+((ok&&!full)?" onclick='dipRival("+n+")' title=\""+tip+"\"":" disabled title=\""+tip+"\"")+">⚔ Declarar rival</button>";
  }
  h+="<span class='sm' style='color:#7a828b'>Tus rivales: "+myR.length+"/"+MAX_RIVALS+"</span></div>";
  // --- pactos ---
  const pact=hasPact(me,n);
  const pTip=c=>c.reason==="guerra"?"Haz la paz primero":("Necesitas "+Math.ceil(c.need||0)+" de concordia más (o un rival común)");
  h+="<div class='dipActs' style='margin-top:6px'>";
  if(pact==="alliance"){
    h+="<span class='dipPactTag ally'>🤝 Aliados</span><button class='bbtn' onclick='dipBreakPact("+n+")' title='Romper = traición: gran tensión'>💔 Romper alianza</button>";
  }else if(pact==="nap"){
    h+="<span class='dipPactTag'>🕊 No agresión</span><button class='bbtn' onclick='dipBreakPact("+n+")' title='Romper = traición: gran tensión'>💔 Romper</button>";
    const ca=canPact(me,n,"alliance"); if(ca.ok)h+="<button class='bbtn' onclick='openDipModal(&quot;pact&quot;,"+n+",&quot;alliance&quot;)'>🤝 Alianza</button>";
  }else{
    const cn=canPact(me,n,"nap"), ca=canPact(me,n,"alliance");
    h+="<button class='bbtn'"+(cn.ok?" onclick='openDipModal(&quot;pact&quot;,"+n+",&quot;nap&quot;)'":" disabled title=\""+pTip(cn)+"\"")+">🕊 No agresión</button>";
    h+="<button class='bbtn'"+(ca.ok?" onclick='openDipModal(&quot;pact&quot;,"+n+",&quot;alliance&quot;)'":" disabled title=\""+pTip(ca)+"\"")+">🤝 Alianza</button>";
  }
  h+="</div>";
  // --- guerra / paz ---
  h+="<div class='dipActs' style='margin-top:6px'>";
  if(atWar(me,n)){
    const cl=coalitionOf(me,n);
    if(cl){
      const lead=cl.leadA===me;
      h+="<span style='color:#d08080;font-weight:600'>EN GUERRA</span> <button class='bbtn'"+(lead?" onclick='openCoalPeace("+n+")'":" disabled title='Espera a que el líder de la coalición proponga la paz'")+">⚔ Coalición</button>";
    }else h+="<span style='color:#d08080;font-weight:600'>EN GUERRA</span> <button class='bbtn' onclick='openPeace("+n+")'>Gestionar paz</button>";
  }else{
    const cw=canDeclareWar(me,n), dis=locked||!cw.ok;
    const tip=locked?"Bloqueo de guerra inicial":(cw.league?"Es co-miembro de tu liga defensiva":(cw.pact?"Rompe el pacto primero":(!cw.ok?("Necesitas "+Math.ceil(cw.need)+" de tensión más (≤ "+THRESH.war+")"):"")));
    h+="<button class='bbtn red'"+(dis?" disabled title=\""+tip+"\"":" onclick='playerDeclare("+n+")'")+">Declarar guerra</button>";
  }
  h+="</div>";
  return h;
}
// --- popup de ACCIÓN diplomática (S.dipModal): cada acción con ajustes tiene su propia ventana ---
function refreshDipModal(){
  const el=document.getElementById("dipModalBody"), tl=document.getElementById("dipModalTitle");
  if(!el||!tl)return;
  const M=S.dipModal; if(!M){el.innerHTML="";return;}
  const me=S.player;
  let h="";
  if(M.kind==="rival"){
    tl.textContent="⚔ Declarar rival";
    const cand=[];
    for(let m=0;m<NPLAY;m++)if(m!==me&&S.nations[m]&&S.nations[m].alive&&canRival(me,m))cand.push(m);
    cand.sort((a,b)=>getRel(me,a)-getRel(me,b)); // los más tensos primero
    h+="<div class='dList'>";
    for(const m of cand){ const v=getRel(me,m), t=relTier(v);
      h+="<div class='dRow' onclick='dipRival("+m+")'>"+escOf(m,1)+"<span class='dRowN'>"+NATIONS[m].name+"</span>"+
         "<span style='color:"+t.color+";font-weight:600'>"+(v>0?"+":"")+Math.round(v)+"</span>"+
         "<span class='sm' style='color:#7a828b;min-width:52px;text-align:right'>"+t.label+"</span></div>";
    }
    h+="</div>";
    if(!cand.length)h="<p style='text-align:center;color:#9aa3ad'>No hay países a los que puedas rivalizar.</p>";
  }else if(M.kind==="gift"){
    const n=M.target, have=Math.floor(S.nations[me].res.dinero||0), amt=Math.min(M.gold||0,have);
    tl.textContent="🎁 Regalar";
    h+="<div style='text-align:center;margin-bottom:10px'>"+escOf(n,1)+" <b>"+NATIONS[n].name+"</b></div>";
    h+="<div style='display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px'>"+
       "<button class='uiBtn' onclick='giftStep(-5000)'"+(amt<=0?" disabled":"")+">−</button>"+
       "<span class='giftBig'>"+fmt(amt)+"</span>"+
       "<button class='uiBtn' onclick='giftStep(5000)'"+(amt>=have?" disabled":"")+">+</button></div>";
    h+="<div class='sm' style='text-align:center;color:#7a828b;margin-bottom:14px'>Tesoro: "+fmt(have)+" ducados</div>";
    h+="<div style='display:flex;gap:8px;justify-content:center'>"+
       "<button class='uiBtn' style='border-color:#8fb06a'"+(amt>0?" onclick='giftSend()'":" disabled")+">Enviar</button>"+
       "<button class='uiBtn' onclick='closeDipModal()'>Cancelar</button></div>";
  }else if(M.kind==="pact"){
    const n=M.target, ally=M.ptype==="alliance";
    tl.textContent=ally?"🤝 Alianza":"🕊 No agresión";
    h+="<div style='text-align:center;margin-bottom:12px'>"+escOf(n,1)+" <b>"+NATIONS[n].name+"</b></div>";
    h+="<div class='dEff'>";
    h+="<div class='tipR'><span>Concordia</span><span style='color:#8fb06a'>+"+(ally?ALLY_BONUS:NAP_BONUS)+"</span></div>";
    h+="<div class='tipR'><span>Guerra entre ambos</span><span style='color:#8fb06a'>bloqueada</span></div>";
    if(ally)h+="<div class='tipR'><span>Llamada a las armas</span><span style='color:#c9a86a'>mutua</span></div>";
    h+="<div class='tipR'><span>Romperlo</span><span style='color:#d08080'>traición</span></div>";
    h+="</div>";
    h+="<div style='display:flex;gap:8px;justify-content:center;margin-top:14px'>"+
       "<button class='uiBtn' style='border-color:#8fb06a' onclick='pactSend()'>Proponer</button>"+
       "<button class='uiBtn' onclick='closeDipModal()'>Cancelar</button></div>";
  }else if(M.kind==="claim"){
    const n=M.target;
    tl.textContent="📜 Reclamaciones";
    h+="<div style='text-align:center;margin-bottom:10px'>"+escOf(n,1)+" <b>"+NATIONS[n].name+"</b> "+
       "<span class='statv' data-tip='Fabrica un derecho sobre el ducado: sube la tensión con el dueño y servirá de casus belli (anulará la reacción de los vecinos al conquistarlo).'>ⓘ</span></div>";
    const duchies=S.duchies.filter(d=>S.provs[d.cap]&&S.provs[d.cap].owner===n);
    if(duchies.length){
      h+="<div class='dList'>";
      for(const d of duchies){
        const done=hasClaim(me,d.id);
        h+="<div class='dRow'"+(done?" style='cursor:default;opacity:.65'":" onclick='dipClaim("+d.id+")'")+">"+
           "<span class='dRowN'>"+d.name+" <span class='sm' style='color:#7a828b'>("+d.provs.length+")</span></span>"+
           (done?"<span style='color:#c9a86a'>📜</span>":"<span class='sm' style='color:#8fb06a'>Reclamar</span>")+"</div>";
      }
      h+="</div>";
    }else h+="<p style='text-align:center;color:#9aa3ad'>No tiene ducados.</p>";
  }
  el.innerHTML=h;
}
function refreshDiplomacy(){
  const el=document.getElementById("dipBody"); if(!el)return;
  if(S.player<0){el.innerHTML="<p style='text-align:center;color:#9aa3ad'>Toma el mando de un reino para ejercer la diplomacia.</p>";return;}
  const v=S.diploView||(S.diploView={mode:"own",target:-1});
  const tgt=v.target;
  const okTgt=v.mode==="nation"&&tgt>=0&&tgt<NPLAY&&tgt!==S.player&&S.nations[tgt]&&S.nations[tgt].alive;
  el.innerHTML = okTgt ? diploNationHTML(tgt) : diploOwnHTML();
}
// Consejo de deliberación (Fase 6b, Etapa 3a): ventana del líder para llamar a sus aliados a la guerra,
// ver sus votos y lanzar/cancelar. El estado vive en S.council.
function refreshCouncil(){
  const el=document.getElementById("councilBody"); if(!el)return;
  const c=S.council;
  if(!c){el.innerHTML="<p style='text-align:center;color:#9aa3ad'>No hay consejo activo.</p>";return;}
  let h="<div style='margin-bottom:12px'>Objetivo: <span class='chip' style='background:"+NATIONS[c.target].color+"'></span> <b>"+NATIONS[c.target].name+"</b></div>";
  if(c.phase==="invite"){
    if(c.candidates.length){
      h+="<div class='sm' style='color:#9aa3ad;margin-bottom:6px'>¿A qué aliados llamas?</div><div style='display:flex;flex-wrap:wrap;gap:6px'>";
      for(const n of c.candidates){
        const inv=c.invited.has(n);
        h+="<span class='cChip"+(inv?" on":"")+"' onclick='councilInvite("+n+")'>"+(inv?"✓ ":"")+NATIONS[n].name+"</span>";
      }
      h+="</div>";
    } else h+="<div class='sm' style='color:#c9a86a'>No tienes aliados a quien llamar; declararás la guerra en solitario.</div>";
    h+="<div style='display:flex;gap:8px;margin-top:16px'>";
    if(c.invited.size>0) h+="<button class='uiBtn' onclick='councilDoConvene()'>Convocar consejo ("+c.invited.size+")</button>";
    else h+="<button class='uiBtn' style='border-color:#a85a5a' onclick='councilLaunch()'>Declarar guerra en solitario</button>";
    h+="<button class='uiBtn' onclick='councilCancel()'>Cancelar</button></div>";
  }else{ // vote
    let support=0;
    h+="<div class='sm' style='color:#9aa3ad;margin-bottom:4px'>Deliberación:</div><table class='dip'>";
    for(const [n,v] of c.invited){ const join=v==="join"; if(join)support++;
      h+="<tr><td><span class='chip' style='background:"+NATIONS[n].color+"'></span> "+NATIONS[n].name+"</td>"+
         "<td style='color:"+(join?"#8fb06a":"#d08080")+";font-weight:600'>"+(join?"Se une ✓":"Declina ✗")+"</td></tr>";
    }
    h+="</table><div style='margin:12px 0'>Apoyos: <b>"+support+"</b> de "+c.invited.size+"</div>";
    h+="<div style='display:flex;gap:8px'><button class='uiBtn' style='border-color:#a85a5a' onclick='councilLaunch()'>⚔ Lanzar la guerra ("+(support+1)+" reinos)</button>"+
       "<button class='uiBtn' onclick='councilCancel()'>Cancelar</button></div>";
  }
  el.innerHTML=h;
}
// Paz conjunta del jugador-líder (Etapa 3b): elige ducados ocupados a ceder + oro; firma por todo el bando.
function refreshCoalPeace(){
  const el=document.getElementById("coalPeaceBody"); if(!el)return;
  const cp=S.coalPeace; if(!cp){el.innerHTML="";return;}
  const coal=S.coalitions.get(cp.coalId);
  if(!coal){el.innerHTML="<p style='text-align:center;color:#9aa3ad'>La coalición ya no existe.</p>";return;}
  const sc=coalScore(coal), ceded=coalCededDuchies(coal), goldCap=Math.max(0,Math.round(Math.max(0,sc)*GOLD_PER_WS));
  let h="<div style='margin-bottom:6px'>Contra <span class='chip' style='background:"+NATIONS[coal.leadD].color+"'></span> <b>"+NATIONS[coal.leadD].name+"</b> y su bando</div>";
  h+="<div style='margin-bottom:10px'>Warscore conjunto: <b style='color:"+(sc>=0?"#8fb06a":"#d08080")+"'>"+Math.round(sc)+"</b></div>";
  h+="<div class='sm' style='color:#9aa3ad;margin-bottom:4px'>Ducados ocupados a ceder (cada uno a su ocupante):</div>";
  if(ceded.length){
    h+="<div style='display:flex;flex-wrap:wrap;gap:6px'>";
    for(const did of ceded){ const d=S.duchies[did], sel=cp.sel.has(did);
      h+="<span class='cChip"+(sel?" on":"")+"' onclick='coalPeaceToggle("+did+")'>"+(sel?"✓ ":"")+d.name+" → "+NATIONS[d.occBy].name+"</span>";
    }
    h+="</div>";
  }else h+="<div class='sm' style='color:#c9a86a'>Aún no ocupas ningún ducado enemigo.</div>";
  h+="<div style='margin-top:12px'>💰 Oro exigido: <input id='coalGold' type='number' min='0' step='100' value='"+Math.round(cp.gold||0)+"' style='width:96px'> <span class='sm' style='color:#7a828b'>(sugerido ≤ "+goldCap+")</span></div>";
  h+="<div style='display:flex;gap:8px;margin-top:16px'><button class='uiBtn' style='border-color:#8fb06a' onclick='coalPeaceSign()'>🕊 Firmar paz conjunta</button><button class='uiBtn' onclick='coalPeaceCancel()'>Cancelar</button></div>";
  el.innerHTML=h;
}
// Ligas defensivas: ventana con dos modos. Si S.leagueView apunta a una liga → su FICHA (miembros,
// solicitudes, aplicar/salir/expulsar). Si no → general: fundar (si no tienes liga) + lista de ligas.
// Se llega aquí desde la vista de diplomacia (clic en el nombre de una liga) o el botón de Ligas.
function leagueDetailHTML(L){
  const me=S.player, mine=L.members.includes(me);
  let h="<div style='margin-bottom:8px'><button class='bbtn' onclick='leagueBack()'>←</button></div>";
  h+="<div style='margin-bottom:10px'><b style='font-size:16px'>🛡 "+L.name+"</b> <span class='sm' style='color:#7a828b'>("+L.members.length+"/"+MAX_LEAGUE+")</span></div>";
  h+="<table class='dip'>";
  for(const m of L.members){
    h+="<tr><td>"+escOf(m,0,m===L.founder)+" "+NATIONS[m].name+
       (m===me?" <span class='sm' style='color:#7a828b'>(tú)</span>":"")+"</td>";
    h+=(mine&&m!==me&&m!==L.founder)
      ?"<td><button class='bbtn sm' onclick='leagueExpel("+m+")' title='Proponer expulsión: votan los miembros'>Expulsar</button></td>"
      :"<td></td>";
    h+="</tr>";
  }
  h+="</table>";
  if(mine){
    if(L.apps.length){
      h+="<div class='dSecT'>Solicitudes <span class='statv' data-tip='Deciden los miembros por mayoría: tu voto cuenta junto al de los demás.'>ⓘ</span></div><table class='dip'>";
      for(const ap of L.apps){ const rv=getRel(me,ap);
        h+="<tr><td>"+escOf(ap)+" "+NATIONS[ap].name+" <span class='sm' style='color:#7a828b'>("+(rv>0?"+":"")+Math.round(rv)+")</span></td>"+
           "<td><button class='bbtn sm' onclick='leagueVote("+ap+",true)'>Admitir</button> <button class='bbtn sm' onclick='leagueVote("+ap+",false)'>Rechazar</button></td></tr>";
      }
      h+="</table>";
    }
    h+="<div style='margin-top:16px'><button class='uiBtn' onclick='leagueLeave()' title='Si eres el fundador, la liga la hereda otro miembro'>Salir de la liga</button></div>";
  }else{
    const ca=canApplyLeague(me,L.id);
    const tip=ca.ok?"":(ca.reason==="llena"?"Liga completa"
      :ca.reason==="enotraliga"?"Ya estás en otra liga"
      :ca.reason==="yaaplico"?"Ya has solicitado entrar"
      :ca.reason==="tension"?("Necesitas "+Math.ceil(ca.need||0)+" de concordia más con "+NATIONS[L.founder].name+", o un rival común con un miembro")
      :"No disponible");
    h+="<div style='margin-top:16px'><button class='uiBtn'"+(ca.ok?" style='border-color:#8fb06a' onclick='leagueApply("+L.id+")'":" disabled title=\""+tip+"\"")+">Aplicar</button></div>";
  }
  return h;
}
function leagueGeneralHTML(){
  const me=S.player, myL=leagueOf(me);
  let h="";
  if(!myL)h+="<div style='margin-bottom:14px;display:flex;gap:8px;align-items:center'><input id='leagueName' type='text' maxlength='28' placeholder='Nombre de la liga' style='width:200px'> "+
    "<button class='uiBtn' style='border-color:#8fb06a' onclick='leagueFound()'>Fundar liga</button></div>";
  if(S.leagues.length){
    h+="<div class='dCards'>";
    for(const L of S.leagues){
      const mine=L.members.includes(me);
      h+="<div class='dCard"+(mine?" mine":"")+"'><div class='dCardT'><span class='dChip' onclick='openLeagues("+L.id+")'>🛡 "+L.name+"</span> <span class='sm' style='color:#7a828b'>("+L.members.length+"/"+MAX_LEAGUE+")</span></div>"+
         "<div>"+L.members.map(m=>escOf(m,0,m===L.founder)).join(" ")+"</div></div>";
    }
    h+="</div>";
  } else h+="<div class='dim sm'>No hay ligas.</div>";
  return h;
}
function refreshLeagues(){
  const el=document.getElementById("leagueBody"); if(!el)return;
  if(S.player<0){el.innerHTML="<p style='text-align:center;color:#9aa3ad'>Toma el mando de un reino para gestionar ligas.</p>";return;}
  const L=(S.leagueView!=null)?leagueById(S.leagueView):null;
  el.innerHTML = L ? leagueDetailHTML(L) : leagueGeneralHTML();
}
// Llamada a las armas (Fase 7): atacan a un aliado/co-miembro de liga del jugador → decidir si acude a
// defenderlo (entra en el bando defensor de la coalición) o rehúsa (rompe el vínculo + reputación).
function refreshCallToArms(){
  const el=document.getElementById("callToArmsBody"); if(!el)return;
  const c=S.callToArms; if(!c){el.innerHTML="";return;}
  const ally=hasPact(S.player,c.victim)==="alliance", inLg=sameLeague(S.player,c.victim);
  let h="<div style='margin-bottom:10px'><b>"+NATIONS[c.leadA].name+"</b> y su coalición atacan a "+
    "<span class='chip' style='background:"+NATIONS[c.victim].color+"'></span> <b>"+NATIONS[c.victim].name+"</b>, "+
    ((ally&&inLg)?"tu aliado y co-miembro de liga.":(ally?"tu aliado.":"co-miembro de tu liga."))+"</div>";
  h+="<div class='sm' style='color:#9aa3ad;margin-bottom:4px'>Atacantes: "+c.attackers.map(a=>NATIONS[a].name).join(", ")+"</div>";
  h+="<div class='sm' style='color:#c9a86a;margin-bottom:14px'>Si rehúsas, romperás el vínculo y tu reputación sufrirá (traición).</div>";
  h+="<div style='display:flex;gap:8px'><button class='uiBtn' style='border-color:#8fb06a' onclick='acceptCallToArms()'>⚔ Acudir a defender</button>"+
     "<button class='uiBtn' style='border-color:#a85a5a' onclick='rejectCallToArms()'>Rehusar</button></div>";
  el.innerHTML=h;
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
    // ingreso medio mensual de la corona (impuestos, rentas, ventas) para comparar naciones
    const E2=S.nations[n].e2, income=(E2&&E2.inc&&E2.inc.corona)||0;
    rows.push({n,name:NATIONS[n].name,color:NATIONS[n].color,provs:provsBy[n],pop:popBy[n],
      troops:Math.round(troopsBy[n]),str:Math.round(strBy[n]),income,
      pc:popBy[n]>0?income*1e5/popBy[n]:0}); // riqueza per cápita: ducados netos/mes por 100.000 hab
  }
  return rows;
}
function refreshLedger(){
  const rows=ledgerRows();
  rows.sort((a,b)=>ledgerSort==="name"?a.name.localeCompare(b.name):(b[ledgerSort]-a[ledgerSort]));
  const th=(key,lab)=>"<th onclick=\"sortLedger('"+key+"')\" style='cursor:pointer'"+
    (ledgerSort===key?" class='on'":"")+">"+lab+(ledgerSort===key?" ▾":"")+"</th>";
  let h="<table class='dip led'><tr><th>#</th>"+th("name","Nación")+th("provs","Prov.")+
    th("pop","Población")+th("troops","Tropas")+th("str","Fuerza")+th("income","Ducados/mes")+
    th("pc","Duc/100k hab")+"<th>Mando</th></tr>";
  rows.forEach((r,i)=>{
    const me=r.n===S.player;
    h+="<tr"+(me?" style='background:rgba(159,184,120,.18)'":"")+"><td>"+(i+1)+"</td>";
    h+="<td><span class='chip' style='background:"+r.color+"'></span> "+r.name+(me?" <b style='color:#9fb878'>(tú)</b>":"")+"</td>";
    h+="<td>"+r.provs+"</td><td>"+fmtPop(r.pop)+"</td><td>"+r.troops+"</td><td>"+r.str+"</td>";
    h+="<td class='"+(r.income<0?"neg":"pos")+"'>"+(r.income>=0?"+":"")+n1(r.income)+"</td>";
    h+="<td class='"+(r.pc<0?"neg":"")+"'>"+(r.pc>=0?"+":"")+n1(r.pc)+"</td>";
    // tomar/soltar el mando de esta nación (modo observador / cambio de país)
    h+="<td>"+(me
      ? "<button class='bbtn' onclick='releaseControl()'>Soltar</button>"
      : "<button class='bbtn' onclick='takeControl("+r.n+")'>Tomar mando</button>")+"</td></tr>";
  });
  h+="</table>";
  document.getElementById("ledgerBody").innerHTML=h;
}
window.sortLedger=function(k){ledgerSort=k;refreshLedger()};
// Informes Reales: crónica mundial (guerras, batallas, plazas, paces, reinos caídos), lo más
// reciente arriba, con fecha; se resalta lo que implica al reino del jugador.
function reportDate(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear();}
function refreshReports(){
  const el=document.getElementById("reportsBody");if(!el)return;
  if(!S.reports.length){el.innerHTML="<p style='text-align:center;color:#9aa3ad;font-style:italic'>Aún no hay sucesos que reportar. La paz reina… por ahora.</p>";return}
  let h="";
  for(let i=S.reports.length-1;i>=0;i--){
    const r=S.reports[i];
    const hi=r.who&&S.player>=0&&r.who.includes(S.player);
    h+="<div style='display:flex;gap:10px;align-items:baseline;padding:7px 8px;border-bottom:1px solid #3a3628"+
      (hi?";background:rgba(159,184,120,.12);border-left:3px solid #9fb878;padding-left:5px":"")+"'>"+
      "<span style='color:#9c8f6f;font-size:11px;min-width:98px;white-space:nowrap'>"+reportDate(r.hour)+"</span>"+
      "<span style='font-size:15px'>"+r.icon+"</span>"+
      "<span style='font-size:13px;color:#d8cfb8'>"+r.text+"</span></div>";
  }
  el.innerHTML=h;
}
// ---- Pantalla de gestión de paz (estilo EU4) ----
function peaceBar(ws){
  const pct=(ws+100)/2;
  return "<div class='sm' style='margin-bottom:4px'>Warscore: <b style='color:"+(ws>=0?"#8fce7e":"#e08a7a")+"'>"+(ws>=0?"+":"")+n1(ws)+"</b></div>"+
    "<div style='height:14px;border-radius:4px;background:#3a2020;position:relative;overflow:hidden'>"+
    "<div style='position:absolute;left:0;top:0;bottom:0;width:"+pct+"%;background:linear-gradient(90deg,#7a3030,#8fce7e)'></div>"+
    "<div style='position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.5)'></div></div>";
}
function duchyRow(d,on,cost,sign){
  return "<div class='recrow' style='cursor:pointer' onclick='togglePeaceDuchy("+d.id+")'>"+
    "<span class='u'>"+(on?"☑":"☐")+" "+d.name+" <span class='sm'>("+d.provs.length+" prov)</span></span>"+
    "<span class='cst'>"+sign+cost+" pts</span></div>";
}
function refreshPeace(){
  const body=document.getElementById("peaceBody"),title=document.getElementById("peaceTitle");
  if(!body)return;
  // modo "oferta entrante de la IA"
  if(S.peaceMode==="in"&&S.incomingPeace){
    const o=S.incomingPeace,t=o.terms;
    title.textContent="Oferta de paz — "+NATIONS[o.enemy].name;
    let h="<div class='sm' style='margin-bottom:10px'>"+NATIONS[o.enemy].name+" te ofrece la paz a cambio de:</div>";
    for(const id of (t.duchies||[])){const d=S.duchies[id];if(!d)continue;
      h+="<div class='recrow'><span class='u'>Cedes "+d.name+"</span><span class='cst'>"+d.provs.length+" prov</span></div>";}
    if(t.gold>0)h+="<div class='recrow'><span class='u'>Pagas oro</span><span class='cst'>"+fmt(t.gold)+" Ducados</span></div>";
    if(!(t.duchies&&t.duchies.length)&&!(t.gold>0))h+="<div class='sm'>Paz blanca (sin cesiones).</div>";
    h+="<div style='text-align:center;margin-top:14px'><button class='bbtn' onclick='acceptIncomingPeace()'>Aceptar</button> "+
      "<button class='bbtn red' onclick='rejectIncomingPeace()'>Rechazar</button></div>";
    body.innerHTML=h;return;
  }
  const m=S.peaceWith;
  if(m<0){body.innerHTML="";return}
  title.textContent="Negociación de paz — "+NATIONS[m].name;
  const ws=warscore(S.player,m);
  let h=peaceBar(ws);
  const dem=occupiedDuchiesBy(S.player,m),con=occupiedDuchiesBy(m,S.player);
  h+="<h3 style='margin-top:14px'>Exiges a "+NATIONS[m].name+"</h3>";
  if(!dem.length)h+="<div class='sm' style='color:#9aa3ad'>No ocupas ningún ducado suyo. Toma su capital de ducado (y todos sus fuertes) para poder exigirlo.</div>";
  for(const d of dem)h+=duchyRow(d,S.peaceSel.has(d.id),duchyValue(d),"");
  const maxGold=Math.max(0,Math.floor(S.nations[m].res.dinero||0));
  h+="<div class='recrow'><span class='u'>Exigir oro <span class='sm'>(máx "+fmt(maxGold)+")</span></span>"+
    "<span class='cst'><input type='number' min='0' max='"+maxGold+"' value='"+S.peaceGold+"' style='width:88px' oninput='setPeaceGold(this.value)'> <span class='sm'>("+n1(S.peaceGold/GOLD_PER_WS)+" pts)</span></span></div>";
  h+="<h3 style='margin-top:14px'>Cedes a "+NATIONS[m].name+"</h3>";
  if(!con.length)h+="<div class='sm' style='color:#9aa3ad'>No ocupa ningún ducado tuyo.</div>";
  for(const d of con)h+=duchyRow(d,S.peaceSel.has(d.id),duchyValue(d),"−");
  const maxGive=Math.max(0,Math.floor(tsyAvail(S.player,"dinero")));
  h+="<div class='recrow'><span class='u'>Ofrecer oro <span class='sm'>(máx "+fmt(maxGive)+")</span></span>"+
    "<span class='cst'><input type='number' min='0' max='"+maxGive+"' value='"+S.peaceGive+"' style='width:88px' oninput='setPeaceGive(this.value)'> <span class='sm'>(−"+n1(S.peaceGive/GOLD_PER_WS)+" pts)</span></span></div>";
  let demandCost=0,concedeVal=0;
  for(const id of S.peaceSel){const d=S.duchies[id];if(!d)continue;if(d.occBy===S.player)demandCost+=duchyValue(d);else if(d.occBy===m)concedeVal+=duchyValue(d)}
  demandCost+=S.peaceGold/GOLD_PER_WS;concedeVal+=S.peaceGive/GOLD_PER_WS;
  const net=demandCost-concedeVal,ok=net<=ws+0.001;
  h+="<div style='text-align:center;margin-top:12px;font-size:13px;color:#c9c2ae'>Coste de la propuesta: <b style='color:"+(ok?"#8fce7e":"#e0a17a")+"'>"+n1(net)+" pts</b> <span class='sm'>/ warscore "+n1(ws)+"</span></div>";
  h+="<div style='text-align:center;margin-top:8px'><button class='bbtn'"+(ok?"":" disabled")+" onclick='proposePeaceDeal()'>Proponer paz</button></div>";
  if(!ok)h+="<div class='sm' style='color:#e0a17a;text-align:center;margin-top:6px'>El enemigo rechazará: exiges "+n1(net)+" pts pero tu warscore es "+n1(ws)+".</div>";
  else if(net<=0&&(S.peaceSel.size||S.peaceGold||S.peaceGive))h+="<div class='sm' style='color:#8fce7e;text-align:center;margin-top:6px'>Concesión favorable al enemigo: la aceptará.</div>";
  body.innerHTML=h;
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
  h+="<div class='ncard' id='observerCard' style='grid-column:1/-1;border-color:#7f9bbf'>"+
    "<b>👁 Modo observador</b><span>Mira evolucionar la partida sin atarte a ningún país: los "+NPLAY+" reinos actúan por IA. Toma el mando de cualquiera desde el Registro cuando quieras revisar sus estadísticas, y suéltalo al terminar.</span></div>";
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
    if(c.id==="observerCard"){
      // Espectador: nadie es el jugador (S.player=-1); todas las naciones siguen con IA.
      document.getElementById("startOverlay").style.display="none";
      S.player=-1;S.started=true;S.selProv=-1;
      refreshTop();refreshSide();
      log("Modo observador: las "+NPLAY+" naciones actúan por IA. Abre el Registro para tomar el mando de una y revisar sus estadísticas.");
      return;
    }
    if(sv&&!confirm("Empezar una partida nueva descartará la guardada. ¿Continuar?"))return;
    try{localStorage.removeItem("basileus_save")}catch(e){}
    S.player=+c.dataset.n;
    S.nations[S.player].ai=false;
    document.getElementById("startOverlay").style.display="none";
    S.started=true;
    resetTsyLedger(); // arranca el tesoro mensual del jugador
    S.recruitProv=S.nations[S.player].capital;
    buildRealmMenu();
    const cap=S.provs[S.nations[S.player].capital];
    S.panX=canvas.width/2-cap.x*S.zoom;S.panY=canvas.height/2-cap.y*S.zoom;clampPan();
    S.selProv=cap.id;refreshSide();refreshTop();
    log("Has tomado el mando de "+NATIONS[S.player].name+". Capital: "+cap.name+".");
  }));
  document.getElementById("startOverlay").style.display="flex";
}

// ---- Estamentos (Fase A: composición social del reino, solo lectura) ----
// Suma los estratos de las provincias propias (no ocupadas) y los muestra con recuento, % y barra.
// La riqueza por estrato y el mercado llegan en la Fase B (por ahora la riqueza es 0).
function refreshEstates(){
  const ov=document.getElementById("estatesOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("estatesBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver su estamentos.</p>";return}
  refreshEstates2(body);
}
// ---- Mercado del reino (ventana propia): comercio de bienes, precios, oferta/demanda interna y exterior ----
// ---- Geografía de un bien: producción por nación (suma de lo provincial, ADR 0001) + demanda del mercado.
// Se calcula al PULSAR un bien (O(provincias), no por tick). Equivalente en juego de tools/diag-paises.mjs. ----
function goodGeography(g){ // lo que cada reino lleva a su plaza (N.mktInfo, u/mes → /año)
  const rows=[];
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;const mi=(N.mktInfo&&N.mktInfo[g])||{};
    rows.push({n,prod:(mi.prod||0)*12,cons:(mi.dem||0)*12,net:((mi.prod||0)-(mi.dem||0))*12})}
  return rows;
}
// Precalcula, por nación, los valores que el map mode "Comercio de un bien" pinta (render.js los lee de S.gm*):
// producción, déficit neto y ratio de precio. Se llama al cambiar de bien (no por tick). Evita que render importe economy.
window.computeGoodMap=function(g){
  const geo=goodGeography(g);
  const prodA=new Float64Array(NPLAY),netA=new Float64Array(NPLAY),prA=new Float64Array(NPLAY).fill(1);
  const ref=REF2[g]*PRICE_SCALE; let maxP=1,maxN=1;
  for(const r of geo){prodA[r.n]=r.prod;netA[r.n]=r.net;if(r.prod>maxP)maxP=r.prod;if(Math.abs(r.net)>maxN)maxN=Math.abs(r.net);
    const N=S.nations[r.n];prA[r.n]=((N&&N.mktPrice&&N.mktPrice[g])||ref)/ref;}
  S.gmProd=prodA;S.gmNet=netA;S.gmPriceR=prA;S.gmMaxP=maxP;S.gmMaxN=maxN;
};
// Leyenda-selector del map mode "Comercio de un bien": nombre del bien + pestañas de métrica + picker de iconos.
window.refreshGoodLegend=function(){
  const el=document.getElementById("goodLegend"); if(!el)return;
  if(!S.goodView){el.style.display="none";return;}
  const g=S.mapGood||"lana", m=S.mapMetric||"deficit";
  const mchip=(k,lab)=>"<span onclick=\"setGoodMetric('"+k+"')\" style='cursor:pointer;padding:1px 7px;border-radius:4px;font-size:11px;"+(m===k?"background:#3a4550;color:#fff":"color:#9aa3ad")+"'>"+lab+"</span>";
  const picker=GOODS2.map(x=>"<span onclick=\"setMapGood('"+x+"')\" data-tip=\""+ta(gLabel(x))+"\" style='cursor:pointer;font-size:16px;opacity:"+(x===g?"1":".4")+"'>"+(RES_ICON[x]||"·")+"</span>").join(" ");
  const scale=m==="prod"
    ?"<span style='color:#7a828b'>poco</span> <span style='background:linear-gradient(90deg,#3a483a,#6cb05c);width:64px;height:8px;display:inline-block;border-radius:2px;vertical-align:middle'></span> <span style='color:#6cb05c'>mucho</span>"
    :"<span style='color:var(--neg)'>"+(m==="price"?"caro":"déficit")+"</span> <span style='background:linear-gradient(90deg,#c4563e,#82888e,#6cb05c);width:74px;height:8px;display:inline-block;border-radius:2px;vertical-align:middle'></span> <span style='color:var(--pos)'>"+(m==="price"?"barato":"excedente")+"</span>";
  el.innerHTML="<b style='font-size:12px'>"+(RES_ICON[g]||"")+" "+gLabel(g)+iInfo("Colorea el mundo por un bien. Producción = cuánto produce cada reino (verde=mucho). Precio/Déficit = por reino (rojo escasea/caro, verde sobra/barato). Cambia el bien con los iconos, la métrica con las pestañas.")+"</b>"+
    "<div style='margin:4px 0'>"+mchip("prod","Producción")+" "+mchip("price","Precio")+" "+mchip("deficit","Déficit")+"</div>"+
    "<div style='font-size:10px;margin-bottom:5px'>"+scale+"</div>"+
    "<div style='display:flex;flex-wrap:wrap;gap:4px;max-width:220px;line-height:1.7'>"+picker+"</div>";
  el.style.display="block";
};
// ---------- Modo de mapa GRANEROS (design/grano-ducado.md §Anclas, diseño B del /ux) ----------
// Cada provincia PROPIA pintada por "¿llega su granero a la siega?". S.gmGran[pid]: -1 ajena · 0 de sobra (≥12 m) ·
// 1 llega · 2 no llega a su siega · 3 hambre. Lo pinta render.js (granColor) sin importar la economía.
const GRAN_LBL=["de sobra","llega","no llega","hambre"],GRAN_CSS=["#6cb05c","#c9a44e","#c4563e","#8a2a3a"];
const LAND_LBL=["holgada","aprieta","al límite","no los alimenta"];
const GRAN_ROWS=5;   // filas de la lista de la leyenda: más y se mete bajo el panel lateral (la leyenda crece hacia arriba)
function landState(p){const x=landOcc2(p);return x<LAND_FULL?0:x<0.9?1:x<=1?2:3}   // 80% · 90% · 100%: los tramos de la tierra
function granState(p){
  if(p.owner!==S.player||p.wasteland||!p.pops||!p.store)return -1;
  if(S.granMode==="tierra")return landCap(p)>0?landState(p):-1;
  if(p.famine)return 3; const gm=p._gm!=null?p._gm:12;
  const short=p._gshort!=null?p._gshort:gm<monthsToHarvest(p,S.hour);   // ¿llega el GRANERO entero a la siega? (economy2)
  return short?2:gm>=12?0:1;
}
window.computeGranMap=function(){ // devuelve las provincias que cambian de estado (para repintar solo esas)
  const prev=S.gmGran,a=new Int8Array(S.provs.length),ch=[];
  for(const p of S.provs){a[p.id]=granState(p);if(prev&&prev[p.id]!==a[p.id])ch.push(p.id)}
  S.gmGran=a; return ch;
};
window.refreshGranView=function(){ // 1 vez al día con el modo abierto (sim.js), y tras un socorro
  if(!S.granView)return; for(const pid of window.computeGranMap())repaintProvince(pid); window.refreshGranLegend();
};
window.granFocus=function(pid){const p=S.provs[pid];if(!p)return;
  S.panX=canvas.width/2-p.x*S.zoom;S.panY=canvas.height/2-p.y*S.zoom;clampPan();S.selProv=pid;S.selArmy=null;
  if(window.setProvTab)window.setProvTab("build");refreshSide()};
window.granRelief=function(pid){window.reliefSendProv(pid);window.refreshGranView()};
window.setGranMode=function(m){S.granMode=m;window.refreshGranView()};
// Leyenda: la escala de 4 estados y la LISTA de los ducados propios que no llegan a la siega (o con hambre), del que
// antes se vacía al que después, cada uno con su botón de socorro y el total (reliefQuote, la misma cifra que la ficha).
window.refreshGranLegend=function(){
  const el=document.getElementById("granLegend"); if(!el)return;
  if(!S.granView||S.player<0){el.style.display="none";return}
  const mchip=(k,lab)=>"<span onclick=\"setGranMode('"+k+"')\" style='cursor:pointer;padding:1px 7px;border-radius:4px;font-size:11px;"+((S.granMode||"grano")===k?"background:#3a4550;color:#fff":"color:#9aa3ad")+"'>"+lab+"</span>";
  const chips="<div style='margin:4px 0'>"+mchip("grano","Grano")+" "+mchip("tierra","Tierra")+"</div>";
  if(S.granMode==="tierra"){ // la presión sobre la tierra: de la más apretada a la más holgada
    const ps=S.provs.filter(p=>p.owner===S.player&&p.pops&&landCap(p)>0).sort((a,b)=>landOcc2(b)-landOcc2(a));
    const sc=LAND_LBL.map((l,i)=>"<span style='white-space:nowrap'><i style='display:inline-block;width:9px;height:9px;border-radius:2px;background:"+GRAN_CSS[i]+";vertical-align:middle'></i> "+l+"</span>").join(" &nbsp;");
    let li="";for(const p of ps.slice(0,GRAN_ROWS)){const x=landOcc2(p),st=landState(p);
      li+="<div class='prow' style='gap:6px'><span style='cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' onclick='granFocus("+p.id+")'><i class='sw' style='background:"+GRAN_CSS[st]+"'></i>"+p.name+"</span><b>"+barE(Math.min(100,Math.round(100*x)),34,GRAN_CSS[st])+" "+Math.round(100*x)+"%</b></div>"}
    if(ps.length>GRAN_ROWS)li+="<div class='prow'><span class='dim'>+"+(ps.length-GRAN_ROWS)+" más</span></div>";
    el.innerHTML="<b style='font-size:12px'>"+ph("tierra")+" Tierra</b>"+iInfo("Cuánto de su capacidad agraria ocupan los campesinos de cada provincia. Por encima del 80% cada campesino nuevo cosecha menos y nacen menos; al 100%, en un año normal, cosechan justo lo que comen. La lista: las más apretadas.")+
      chips+"<div style='font-size:10px;margin:4px 0 6px'>"+sc+"</div>"+li;
    el.style.display="block";return}
  const G=new Map();
  for(const p of S.provs){if(p.owner!==S.player||!p.pops||!p.store)continue;const st=granState(p);if(st<2)continue;
    const k=(p.duchy>=0?"d"+p.duchy:"p"+p.id), g=G.get(k), rec={pid:p.id,gm:p._gm||0,mth:monthsToHarvest(p,S.hour),hm:harvestMonth(p)};
    if(!g)G.set(k,{...rec,st}); else{g.st=Math.max(g.st,st);if((p.pop||0)>(S.provs[g.pid].pop||0))Object.assign(g,rec)}}  // el ducado: su peor estado, y su provincia más poblada
  const rows=[...G.values()].sort((a,b)=>(b.st-a.st)||((a.gm-a.mth)-(b.gm-b.mth)));
  const scale=GRAN_LBL.map((l,i)=>"<span style='white-space:nowrap'><i style='display:inline-block;width:9px;height:9px;border-radius:2px;background:"+GRAN_CSS[i]+";vertical-align:middle'></i> "+l+"</span>").join(" &nbsp;");
  let list="";
  for(const r of rows.slice(0,GRAN_ROWS)){const p=S.provs[r.pid],q=reliefQuote(S.player,p);
    const dn=p.duchy>=0&&S.duchies[p.duchy]?S.duchies[p.duchy].name.replace(/^Ducado de /,""):p.name;
    const ic="<i class='sw' style='background:"+GRAN_CSS[r.st]+"'></i>",m=r.gm<1?"&lt;1":Math.floor(r.gm);
    list+="<div class='prow' style='gap:6px'><span style='cursor:pointer' onclick='granFocus("+r.pid+")' data-tip=\""+ta("Siega en "+MONTHS_ES[r.hm])+"\">"+
      ic+dn+"</span><b>"+barE(Math.min(100,Math.round(100*r.gm/12)),34)+" "+m+" m "+
      (q&&q.falta>0?"<button class='bbtn' "+(q.ok?"":"disabled")+" onclick='granRelief("+r.pid+")' data-tip=\""+ta(q.ok?"Socorro hasta la siega (desglose en la ficha)":q.why)+"\">"+nfE(q.total)+" "+COIN()+"</button>":"")+"</b></div>";}
  if(rows.length>GRAN_ROWS)list+="<div class='prow'><span class='dim'>+"+(rows.length-GRAN_ROWS)+" más</span></div>";
  if(!rows.length)list="<div class='prow'><span class='dim'>Todos llegan a la siega</span></div>";
  el.innerHTML="<b style='font-size:12px'>"+ph("granero")+" Graneros</b>"+iInfo("Cada ducado de tu reino según si su grano llega a la próxima siega. La lista: los que no llegan, del que antes se vacía; pulsa el nombre para ir, 🛒 para socorrerlo hasta la siega (grano del almacén de la corona y lo que falte comprado en la plaza, más el flete).")+
    chips+"<div style='font-size:10px;margin:4px 0 6px'>"+scale+"</div>"+list;
  el.style.display="block";
};
function refreshMercado(){
  const ov=document.getElementById("mercadoOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("mercadoBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver su mercado.</p>";return}
  refreshMercado2(body);
}
// ---- Cortes · Hacienda Real: ajustar los impuestos/gravámenes de la corona ----
function refreshFiscal(){
  const ov=document.getElementById("fiscalOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("fiscalBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Toma el mando de una nación para gestionar su hacienda.</p>";return}
  const n=S.player, N=S.nations[n];
  const nf=v=>Math.round(v).toLocaleString("es-ES"), pct=v=>Math.round(v*100);
  const feud=taxRateOf(n), alc=alcabalaOf(n), alm=almojOf(n);
  const slider=(label,val,min,max,kind,info,inc,tip)=>
    "<div style='background:#20252b;border:1px solid #2f363d;border-radius:8px;padding:11px 13px;margin-bottom:9px'"+(tip?" data-tiph=\""+ta(tip)+"\"":"")+">"+
      "<div style='display:flex;justify-content:space-between;align-items:baseline'>"+
        "<span style='font-weight:bold'>"+label+iInfo(info)+"</span>"+
        "<span style='font-family:monospace;font-size:15px;color:var(--title)'>"+pct(val)+"%</span></div>"+
      (inc!=null?"<div style='font-size:11px;color:#8aa478'>≈ +"+nf(inc)+"🪙/mes a la corona (variable)</div>":"")+
      "<input type='range' min='"+min+"' max='"+max+"' value='"+pct(val)+"' step='1' style='width:100%;margin-top:6px' oninput='setTax(\""+kind+"\",this.value)'></div>";
  // lo que rindió cada impuesto el mes pasado (libro de la corona)
  const cb=crownBook("prev"),got=c=>cb.cats[c]||0,lab=cb.cur?"este mes":"el mes pasado";
  const TAX_WHO={feudal:"Campesino",alcabala:"Vendedor",almoj:"Mercader"};
  const taxTip=(label,kind,val,inc)=>{const base=val>0?inc/val:0;
    return tipBox(label.replace(/^\S+\s/,""),[{cols:["Concepto","Valor"],trows:[["Tipo",pct(val)+"%"],["Paga",TAX_WHO[kind]],["Rindió","+"+nf(inc)],...(base>0?[["Base",nf(base)],["Por punto","+"+nf(base/100)+" /mes"]]:[])]}],lab)};
  const slider2=(label,val,min,max,kind,info,inc)=>slider(label,val,min,max,kind,info,null,taxTip(label,kind,val,inc)).replace("</span></div>","</span></div><div style='font-size:11px;color:#8aa478'>+"+nf(inc)+" "+COIN()+" "+lab+"</div>");
  let h="<div style='text-align:center;font-size:12px;color:#9aa3ad;margin-bottom:11px'>Ingresos de la corona "+lab+": <b style='color:var(--title)'>"+nf(cb.inc)+" 🪙</b></div>";
  h+=slider2(ph("pecho")+" Pecho",feud,2,20,"feudal","Lo paga el campesino sobre lo que vende de su cosecha en la plaza. Más pecho, menos le queda para sus comodidades.",got("Pecho"));
  h+=slider2(ph("alcabala")+" Alcabala",alc,0,30,"alcabala","Sobre cada venta en la plaza del reino: el comprador paga el precio y la corona se queda su parte, así que el que vende cobra menos.",got("Alcabala"));
  h+=slider2(ph("almojarifazgo")+" Almojarifazgo",alm,0,60,"almoj","Aduana sobre el comercio con otros reinos: resta margen al mercader.",got("Almojarifazgo"));
  h+="<div style='background:#1c2026;border:1px solid #2a2f36;border-radius:8px;padding:9px 13px;margin-bottom:4px;opacity:.75'>"+
    "<div style='display:flex;justify-content:space-between;align-items:baseline'><span>"+ph("diezmo")+" Diezmo"+iInfo("La décima de la cosecha va al clero: del grano, de lo que el granero vende en la plaza; del resto, de todo lo que se produce. Es derecho de la Iglesia: no se toca.")+"</span><span style='font-family:monospace'>"+pct(DIEZMO)+"%</span></div></div>";
  body.innerHTML=h;
}
/* ============================= ECONOMÍA v2: Tesorería, Mercado y Estamentos =============================
 * Qué cuentan: design/economia-v2.md §13.
 * Datos: el libro de la corona (S.cBook/S.cPrev, economy.js recCrown), los flujos de los estamentos del mes cerrado
 * (S.sFlowPrev/S.sConsumePrev), N.e2 (cobertura de las 3 necesidades, ingreso, cesta) y N.mktInfo (u/mes). */
const TIER2={};for(const t in NEED2)for(const g in NEED2[t])TIER2[g]=t;
const TIER_META={subs:[ph("subsistencia"),"Subsistencia","Subsist."],vida:[ph("comodidades"),"Comodidades","Comodidades"],lujo:[ph("lujo"),"Lujo","Lujo"],mat:[ph("materias"),"Materias","Materias"]}; // [icono, nombre, cabecera corta]
const tierTh=()=>["subs","vida","lujo"].map(t=>"<th>"+TIER_META[t][0]+" "+TIER_META[t][2]+"</th>").join("");
function estateCounts(){const cnt={};let pop=0;for(const k of STRATA)cnt[k]=0;
  for(const p of S.provs){if(p.owner!==S.player||p.wasteland)continue;pop+=p.pop||0;if(p.pops)for(const k of STRATA)cnt[k]+=p.pops[k]||0}
  return {cnt,pop}}
const popPct=(c,pop)=>{const pc=pop>0?100*c/pop:0;return (pc<1?pc.toFixed(1).replace(".",","):Math.round(pc))+"%"};
const TIER_TIP={subs:"Grano, sal y lienzo. Si falta el grano, hay hambre.",
  vida:"Carne, pescado, bebida, paño, herramientas, madera y piedra. Cubierta, la población crece y el campesino asciende a burgués.",
  lujo:"Seda, especias, pieles, caballos y armas. Solo lo piden las élites.",
  mat:"Materias que compran los talleres y los artesanos."};
const gRef=g=>REF2[g]*PRICE_SCALE;                                   // precio normal (v2)
const nfE=v=>Math.round(v||0).toLocaleString("es-ES");
const sgnE=v=>(v>=0?"+":"−")+nfE(Math.abs(v));
const prE=v=>v<10?(Math.round(v*10)/10).toLocaleString("es-ES"):nfE(v);  // precio: un decimal si es pequeño
const pctE=v=>Math.round(Math.max(0,v)*100);
function barE(pc,w,col){ // barra 0..100 (rojo <60, ámbar <90, verde, o el color que se pase) — misma estética que relFillBar, ancho a medida
  return "<span style='display:inline-block;width:"+(w||46)+"px;height:7px;background:#241a14;border-radius:3px;overflow:hidden;vertical-align:middle'><i style='display:block;height:100%;width:"+Math.max(0,Math.min(100,pc))+"%;background:"+(col||(pc<60?"#c0563e":pc<90?"#c98a3a":"#6fae5a"))+"'></i></span>";
}
function tipRows(title,rows,tot){ // tooltip estructurado (data-tiph): título + filas [etiqueta, valor, color?] + total opcional
  let h="<div class='tipT'>"+title+"</div>";
  for(const r of rows)h+="<div class='tipR'><span>"+r[0]+"</span><span"+(r[2]?" style='color:"+r[2]+"'":"")+">"+r[1]+"</span></div>";
  if(tot)h+="<div class='tipR tipTot'><span>"+tot[0]+"</span><span>"+tot[1]+"</span></div>";
  return h;
}
const headE=(extra)=>"<div class='e2head'>"+escOf(S.player,true)+" <b>"+NATIONS[S.player].name+"</b>"+(extra||"")+"</div>";

// ---------- el libro de la corona ----------
// Categorías: icono, qué es (tooltip) y, si es un impuesto, su palanca en Hacienda.
const CROWN_CAT={
  "Pecho":["🌾","Lo que paga el campesino sobre lo que vende de su cosecha en la plaza.","feudal"],
  "Alcabala":["🏪","Impuesto sobre cada compra en la plaza del reino.","alcabala"],
  "Almojarifazgo":["⚓","Aduana sobre el comercio con otros reinos.","almoj"],
  "Renta del realengo":["👑","Tu parte de la cosecha en las tierras de realengo, vendida en la plaza."],
  "Ventas de sus talleres":["🏭","Lo que venden los talleres de la corona."],
  "Portazgo":["🛤","Peaje del transporte hasta la plaza en tierras de realengo."],
  "Minas de plata y oro":["🪙","Acuñación: el único dinero que nace sin venta."],
  "Paces y tributos":["📜","Oro pactado en los tratados de paz."],
  "Diplomacia":["🕊","Regalos entre reinos."],
  "Ejército":["⚔","Soldada de las tropas."],
  "Mantenimiento de edificios":["🏛","Mantenimiento de los edificios de la corona."],
  "Obras":["🔨","Edificios que has mandado construir."],
  "Reclutamiento":["🛡","Tropas reclutadas."],
  "Caminos":["🛣","Caminos que has mandado construir."],
  "Reparaciones":["🔧","Edificios reabiertos y reparados."],
  "Socorro":["🌾","Grano enviado a ducados que no llegaban a la siega: comprado en la plaza y su flete."],
  "Gastos varios":["·","Otros pagos de la corona."],
  "Otros":["❔","Movimientos del tesoro sin apunte en el libro."]
};
// Conceptos de las cuentas de los ESTAMENTOS que necesitan explicación (icono + tooltip; el resto se lee solo).
const TIP_TRANSPORTE="Llevar la mercancía hasta el centro de comercio. La primera jornada de carro (30 km) la cobran los campesinos de la aldea; más allá, los arrieros burgueses. Entre reinos, el flete lo cobran los burgueses del reino que exporta.";
const FLOW_CAT={"Transporte":["🛤",TIP_TRANSPORTE]};
const flowLabel=c=>{const x=FLOW_CAT[c];return x?"<span data-tip=\""+ta(x[1])+"\" style='cursor:help'>"+x[0]+" "+c+"</span>":c};
function crownRate(kind){const n=S.player;return kind==="feudal"?taxRateOf(n):kind==="alcabala"?alcabalaOf(n):almojOf(n)}
// El libro que se enseña: el mes CERRADO (estable); en el primer mes de partida, el que va en curso.
function crownBook(which){ // which: "prev"|"cur" (por defecto, lo elegido en la Tesorería)
  const N=S.nations[S.player], cur=(which||S.tsyMonth)==="cur"||!S.cPrev;
  const book=cur?(S.cBook||{}):S.cPrev.book, delta=cur?((N.res.dinero||0)-(S.cStart||0)):S.cPrev.delta;
  const cats={};let sum=0;
  for(const c in book){let v=0;for(const s in book[c])v+=book[c][s];cats[c]=v;sum+=v}
  const other=delta-sum; if(Math.abs(other)>Math.max(1,Math.abs(delta)*0.002))cats["Otros"]=other; // el total VERIFICA la suma
  let inc=0,exp=0;for(const c in cats){if(cats[c]>=0)inc+=cats[c];else exp+=cats[c]}
  // PRIMER MES (aún no hay mes cerrado): previsión del mes = lo que lleva × 30 días / días transcurridos
  const days=(S.hour-(S.cStartH||0))/24;
  if(!S.cPrev&&days>=1){const k=30/days;for(const c in cats)cats[c]*=k;return {book,cats,cur:true,forecast:true,inc:inc*k,exp:exp*k,net:delta*k}}
  return {book,cats,cur,inc,exp,net:delta};
}
function crownRow(cat,amt,drill){
  const m=CROWN_CAT[cat]||["·",""], lever=m[2];
  const chip=lever?"<span class='e2chip' data-tip='Ajustar en Hacienda' onclick='event.stopPropagation();openFiscal()'>"+pctE(crownRate(lever))+"%</span>":"";
  return "<div class='trow"+(drill?" click":"")+"'"+(drill?" onclick=\"treasuryDrill('"+cat+"')\"":"")+(m[1]?" data-tip=\""+ta(m[1])+"\"":"")+">"+
    "<span>"+ph(cat)+" "+cat+chip+(drill?" <span class='tarrow'>›</span>":"")+"</span>"+
    "<b class='"+(amt<0?"neg":"pos")+"'>"+sgnE(amt)+" "+resImg("dinero")+"</b></div>";
}
function treasuryTesoro2(){
  const cb=crownBook(),path=S.treasuryPath;
  const mt=(k,lab)=>"<span class='e2seg"+((S.tsyMonth==="cur"?"cur":"prev")===k?" on":"")+"' onclick=\"setTsyMonth('"+k+"')\">"+lab+"</span>";
  let h=S.cPrev?"<div style='text-align:center;margin-bottom:8px'>"+mt("prev","Mes pasado")+mt("cur","Este mes")+"</div>"
    :cb.forecast?"<div style='text-align:center;margin-bottom:8px'><span class='e2seg on' data-tip='Primer mes: lo que lleva el mes, llevado a 30 días'>Previsión</span></div>":"";
  h+="<div class='tbook'>";
  if(!path.length){
    const inc=Object.keys(cb.cats).filter(c=>cb.cats[c]>=0.5).sort((a,b)=>cb.cats[b]-cb.cats[a]);
    const exp=Object.keys(cb.cats).filter(c=>cb.cats[c]<=-0.5).sort((a,b)=>cb.cats[a]-cb.cats[b]);
    const drillable=c=>c!=="Otros"&&cb.book[c]&&Object.keys(cb.book[c]).length>1;
    h+="<div class='tsec'>Ingresos</div>"+(inc.length?inc.map(c=>crownRow(c,cb.cats[c],drillable(c))).join(""):"<div class='trow tdim'>—</div>");
    h+="<div class='tsec'>Gastos</div>"+(exp.length?exp.map(c=>crownRow(c,cb.cats[c],drillable(c))).join(""):"<div class='trow tdim'>—</div>");
    h+="<div class='ttotal'><span>"+(cb.forecast?"Balance previsto del mes":cb.cur?"Balance en lo que va de mes":"Balance del mes")+"</span><b class='"+(cb.net<0?"neg":"pos")+"'>"+sgnE(cb.net)+" "+resImg("dinero")+"</b></div>";
  }else{
    const cat=path[0],subs=cb.book[cat]||{},ks=Object.keys(subs).sort((a,b)=>Math.abs(subs[b])-Math.abs(subs[a]));
    const TOP=14;let rest=0;for(const k of ks.slice(TOP))rest+=subs[k];
    h+=tsyCrumb([cat]);
    for(const k of ks.slice(0,TOP))h+="<div class='trow'><span>"+k+"</span><b class='"+(subs[k]<0?"neg":"pos")+"'>"+sgnE(subs[k])+"</b></div>";
    if(ks.length>TOP)h+="<div class='trow'><span class='e2sub'>Resto ("+(ks.length-TOP)+")</span><b class='"+(rest<0?"neg":"pos")+"'>"+sgnE(rest)+"</b></div>";
    h+="<div class='ttotal'><span>Total · "+cat+"</span><b class='"+(cb.cats[cat]<0?"neg":"pos")+"'>"+sgnE(cb.cats[cat]||0)+" "+resImg("dinero")+"</b></div>";
  }
  return h+"</div>";
}
function treasuryAlmacen2(){ // el almacén de la corona: lo que producen sus edificios para obras y ejército (no va a la plaza)
  const N=S.nations[S.player];
  const ks=Object.keys(N.res).filter(k=>k!=="dinero"&&((N.res[k]||0)>=0.5||Math.abs(tsyMonthBal(k))>=0.5)).sort((a,b)=>(N.res[b]||0)-(N.res[a]||0));
  let h="<div class='tbook'><div class='trow thead'><span>Bien</span><span>Existencias · balance/mes</span></div>";
  if(!ks.length)h+="<div class='trow tdim'>—</div>";
  for(const k of ks){const d=tsyMonthBal(k);
    h+="<div class='trow'><span>"+resImg(k)+" "+gLabel(k)+"</span><b><span class='tstock'>"+nfE(N.res[k])+"</span> <span class='"+(d<0?"neg":"pos")+"'>"+(Math.abs(d)<0.5?"<span class='e2sub'>0</span>":sgnE(d))+"</span></b></div>"}
  return h+"</div>";
}
function refreshTreasury2(body){
  const tab=(k,lab)=>"<span class='ttab"+(S.treasuryTab===k?" on":"")+"' onclick=\"setTreasuryTab('"+k+"')\">"+lab+"</span>";
  body.innerHTML=headE(iInfo("Lo que entra y sale del tesoro de la corona. Pulsa una partida para ver su detalle. Los impuestos se ajustan en Hacienda (el % junto a cada uno)."))+
    "<div class='ttabs'>"+tab("tesoro","🪙 Tesoro")+tab("inv","📦 Almacén")+"</div>"+
    (S.treasuryTab==="inv"?treasuryAlmacen2():treasuryTesoro2());
}
window.setTsyMonth=function(k){S.tsyMonth=k;S.treasuryPath=[];refreshTreasury()};

// ---------- Mercado ----------
function priceBlocks(N,g){ // economy2 priceWhy: la misma fórmula que el día de mercado
  const w=priceWhy(N,g); if(!w)return [];
  const x=v=>"×"+(Math.round(v*100)/100).toLocaleString("es-ES"), up=w.next>w.now*1.005, dn=w.next<w.now*0.995;
  return [{h:"Formación",cols:["Factor","Valor"],trows:[["Demanda",nfE(w.D)+" /mes"],["Oferta",nfE(w.P)+" /mes"],
      ...(w.ratio!=null?[["Cociente",x(w.ratio)]]:[]),...(w.stockF<0.999?[["Excedente",x(w.stockF)]]:[]),
      ...(w.r!==w.clamped?[["Tope",x(w.clamped)]]:[])],ttot:["Objetivo",prE(w.target)]},
    {h:"Próximo",cols:["Concepto","Valor"],trows:[["Días",w.inDays],["Precio",{v:prE(w.next)+(up?arw("up"):dn?arw("dn"):""),c:up?"#d08080":dn?"#8fb04a":null}]]}];
}
function mktRowTip(g,mi,N){
  const p=N.mktPrice[g]!=null?N.mktPrice[g]:gRef(g);
  const un=mi.unsold>0.5?[[g==="grano"?"Devuelto":"Perdido",{v:nfE(mi.unsold),c:"#d6a15a"}]]:[];
  return tipBox(gLabel(g),[...priceBlocks(N,g),{h:"Mes",cols:["Flujo","Unidades"],trows:[["Producido",nfE(mi.prod)],["Importado",nfE(mi.imp)],["Exportado",nfE(mi.exp)],
    ["Demanda",nfE(mi.dem)],["Comprado",nfE(mi.sold)],...un,["Plaza",nfE(N.mkt[g])]]}],"Precio "+prE(p)+" "+COIN()+" (normal "+prE(gRef(g))+")");
}
function ratioTxt(r){ // precio frente al normal: ×r con flecha (rojo caro, verde barato)
  const col=r>=1.15?"var(--neg)":r<=0.87?"var(--pos)":"var(--muted)", ar=r>=1.15?arw("up"):r<=0.87?arw("dn"):"";
  return "<span style='color:"+col+"'>×"+(Math.round(r*10)/10).toLocaleString("es-ES")+ar+"</span>";
}
function plazaCell(mi){ // ¿se cubre la demanda? barra comprado/demanda + aviso si sobra género
  if(!(mi.dem>0.5))return mi.prod>0.5?"<span class='e2tag sobra'>sin demanda</span>":"<span class='e2sub'>—</span>";
  const pc=Math.min(100,Math.round(100*(mi.sold||0)/mi.dem));
  const sob=mi.unsold>Math.max(1,0.02*(mi.prod||0));
  return barE(pc,54)+" <span style='display:inline-block;width:34px'>"+pc+"%</span>"+(sob?"<span class='e2tag sobra'>sobra</span>":(pc<90?"<span class='e2tag falta'>falta</span>":"<span style='display:inline-block;width:38px'></span>"));
}
function refreshMercado2(body){
  const NA=S.nations[S.player],info=NA.mktInfo||{};
  if(S.mktGood&&GOODS2.indexOf(S.mktGood)>=0){renderMktGood2(body,NA,S.mktGood);return}
  let expV=0,impV=0;
  for(const g of GOODS2){const mi=info[g]||{},p=NA.mktPrice[g]!=null?NA.mktPrice[g]:gRef(g);expV+=(mi.exp||0)*p;impV+=(mi.imp||0)*p}
  const bal=expV-impV;
  let h=headE(iInfo("Lo que se compra y se vende en la plaza del reino. El precio sube cuando la demanda supera a la oferta (entre ×0,5 y ×3 del normal). El mercader lleva lo que sobra a quien le falta. Pulsa un bien para su ficha."));
  h+="<div class='e2stats'><span data-tip='Valor de lo que el mercader saca a otros reinos'>↗ Exporta <b class='pos'>"+nfE(expV)+"</b></span>"+
    "<span data-tip='Valor de lo que el mercader trae de otros reinos'>↙ Importa <b style='color:#d6a15a'>"+nfE(impV)+"</b></span>"+
    "<span>Balance <b class='"+(bal<0?"neg":"pos")+"'>"+sgnE(bal)+"</b> "+resImg("dinero")+"<span class='e2sub'>/mes</span></span></div>";
  h+="<table class='e2t'><tr><th>Bien</th><th>Precio</th><th data-tip='Precio frente al normal'>vs normal</th><th data-tip='Parte de la demanda que se llega a comprar'>Demanda cubierta</th><th>Exterior</th></tr>";
  for(const t of ["subs","vida","lujo","mat"]){
    const goods=GOODS2.filter(g=>(TIER2[g]||"mat")===t); if(!goods.length)continue;
    h+="<tr class='grp'><td colspan='5' data-tip=\""+ta(TIER_TIP[t])+"\">"+TIER_META[t][0]+" "+TIER_META[t][1]+"</td></tr>";
    for(const g of goods){const mi=info[g]||{},p=NA.mktPrice[g]!=null?NA.mktPrice[g]:gRef(g);
      const ext0=[(mi.exp>0.5?"<span class='pos' data-tip='Exporta'>+"+nfE(mi.exp)+"</span>":""),(mi.imp>0.5?"<span style='color:#d6a15a' data-tip='Importa'>−"+nfE(mi.imp)+"</span>":"")].filter(Boolean).join(" ");
      const ct=ext0?ctrTip(NA,S.player,g):null, ext=ext0?(ct?"<span style='cursor:help' data-tiph=\""+ta(ct)+"\">"+ext0+"</span>":ext0):"<span class='e2sub'>—</span>";
      h+="<tr class='click' onclick=\"openMktGood('"+g+"')\" data-tiph=\""+ta(mktRowTip(g,mi,NA))+"\">"+
        "<td>"+resImg(g)+" "+gLabel(g)+"</td><td>"+prE(p)+" "+resImg("dinero")+"</td><td>"+ratioTxt(p/gRef(g))+"</td>"+
        "<td>"+plazaCell(mi)+"</td><td>"+ext+"</td></tr>"}
  }
  body.innerHTML=h+"</table>";
}
// cadena de un bien en v2: de qué se hace y para qué sirve (talleres BLD2 + oficio de los artesanos)
const ARTISAN_IN2={pano:{lana:1},herramientas:{hierro:1},armas:{hierro:2}};
function chain2(g){
  const from=new Set(),to=new Set();
  const add=(out,ins)=>{if(!ins)return;if(out===g)for(const k in ins)from.add(k);if(ins[g]!=null)to.add(out)};
  for(const b in BLD2)add(BLD2[b].out,BLD2[b].in);
  for(const o in ARTISAN_IN2)add(o,ARTISAN_IN2[o]);
  return {from:[...from],to:[...to]};
}
// CONTRATOS de un bien (economy2: N.e2.ctr del exportador, unidades/día): a quién vende y de quién compra este reino, y
// los que el mes en curso no salieron (guerra, embargo, no sale a cuenta; N.gl). Filas para tipRows.
function ctrList(N,n,g){
  const out=[], cutA=(G,b)=>{const x=G&&G.cur.g[g];return x&&x.cut[b]&&!(x.ok&&x.ok[b])?x.cut[b]:null}; // cortado = este mes no ha salido NADA por esa ruta
  for(const c of (N.e2&&N.e2.ctr&&N.e2.ctr[g])||[])out.push({dir:"exp",b:c.b,q:c.q*30,cut:cutA(N.gl,c.b)});
  for(let a=0;a<NPLAY;a++){const A=S.nations[a];const l=A&&A.e2&&A.e2.ctr&&A.e2.ctr[g];if(!l)continue;
    for(const c of l)if(c.b===n)out.push({dir:"imp",b:a,q:c.q*30,cut:cutA(A.gl,n)})}
  return out.sort((x,y)=>y.q-x.q);
}
function ctrTip(N,n,g){const L=ctrList(N,n,g).slice(0,10); if(!L.length)return null;
  return tipBox("Contratos",[{cols:["Reino","Sentido","Mes","Estado"],trows:L.map(c=>[NATIONS[c.b].name,c.dir==="exp"?"Exporta":"Importa",nfE(c.q),c.cut?{v:c.cut,c:"#d08080"}:"Activo"])}],gLabel(g))}
// LIBRO DEL BIEN (economy2 N.gl): el mes cerrado o, si aún no hay, el que va (escalado a 30 días)
function glMonth(N,g){const G=N.gl;if(!G)return null;const M=G.prev&&G.prev.days>=20?G.prev:G.cur;if(!M||!(M.days>0))return null;
  const x=M.g[g];return x?{x,k:30/M.days}:null}
// barra apilada con tooltip (el patrón de estateBar): parts = [{lab,v,col,tip?}]
function stackBar(parts,w,tip){ // barra apilada con tooltip ya hecho (tipBox); parts = [{v,col}]
  const tot=parts.reduce((t,x)=>t+Math.max(0,x.v),0)||1;let seg="";
  for(const x of parts)if(x.v>0)seg+="<i style='display:block;height:100%;width:"+(100*x.v/tot).toFixed(2)+"%;background:"+x.col+"'></i>";
  return "<span data-tiph=\""+ta(tip)+"\" style='display:inline-flex;width:"+(w||170)+"px;height:9px;border-radius:3px;overflow:hidden;background:#241a14;vertical-align:middle;cursor:help'>"+seg+"</span>";
}
const DEM_ORDER=[["socorro","Graneros","#c0563e"],["talleres","Talleres","#8d7a4a"],["nobleza"],["clero"],["burgues"],["campesino"]];
function goodFlowHTML(N,g){
  const gm=glMonth(N,g); if(!gm)return "";
  const {x,k}=gm, sup=x.sup, sw=c=>"<i class='sw' style='background:"+c+"'></i>";
  const sp=[{lab:"Campo",v:(sup.campo||0)*k,col:WHO_COL.campesino},{lab:"Artesanos",v:(sup.artesanos||0)*k,col:WHO_COL.burgues},
    {lab:"Talleres",v:(sup.talleres||0)*k,col:"#8d7a4a"},{lab:"Importado",v:(x.imp||0)*k,col:"#d6a15a"}];
  const supT=sp.reduce((t,y)=>t+y.v,0), pc=v=>Math.round(100*v/(supT||1))+"%";
  const supTip=tipBox("Oferta",[{cols:["Origen","Unidades","Parte"],trows:sp.filter(y=>y.v>=0.5).map(y=>[sw(y.col)+y.lab,nfE(y.v),pc(y.v)]),ttot:["Total",nfE(supT),"100%"]}],"Al mes");
  const dp=[],drows=[];let wantT=0,gotT=0;
  for(const [key,lab0,col0] of DEM_ORDER){const d=x.dem[key];if(!d)continue;const w=d[0]*k,gq=d[1]*k;wantT+=w;gotT+=gq;
    const lab=lab0||STRATA_INFO[key].label, col=col0||WHO_COL[key], r=w>0?gq/w:1;
    dp.push({v:gq,col});drows.push([sw(col)+lab,nfE(w),nfE(gq),{v:Math.round(100*r)+"%",c:r<0.9?"#d08080":null}])}
  const ex=(x.exp||0)*k; if(ex>=0.5){dp.push({v:ex,col:"#6fae5a"});drows.push([sw("#6fae5a")+"Exportado",nfE(ex),nfE(ex),"100%"])}
  const miss=Math.max(0,wantT-gotT); if(miss>=0.5)dp.push({v:miss,col:"#4a2a26"});
  const demTip=tipBox("Demanda",[{h:"Orden de compra",cols:["Comprador","Pide","Consigue","Parte"],trows:drows,ttot:["Total",nfE(wantT+ex),nfE(gotT+ex),""]},
    ...(miss>=0.5?[{rows:[["Sin cubrir",nfE(miss),"#d08080"]]}]:[])],"Al mes");
  let h="<table class='e2t' style='margin-top:4px'><tr><th>Flujo</th><th>Composición</th><th class='r'>Al mes</th></tr>"+
    "<tr><td>Oferta</td><td>"+stackBar(sp,170,supTip)+"</td><td class='r'>"+nfE(supT)+"</td></tr>"+
    "<tr><td>Demanda</td><td>"+stackBar(dp,170,demTip)+"</td><td class='r'>"+nfE(wantT+ex)+"</td></tr></table>";
  const un=x.unsold*k, me=x.merma*k;
  h+="<table class='e2t' style='margin-top:8px'><tr><th>"+(g==="grano"?"Devuelto":"Perdido")+"</th><th>Merma</th><th>Plaza</th></tr><tr>"+
    "<td data-tip='"+(g==="grano"?"Vuelve al granero de su ducado":"Llega sin comprador y no se paga")+"'"+(un>=0.5?" class='"+(g==="grano"?"":"neg")+"'":"")+">"+nfE(un)+"</td>"+
    "<td data-tip='Se estropea en la plaza'"+(me>=0.5?" class='neg'":"")+">"+nfE(me)+"</td><td>"+nfE(N.mkt[g]||0)+"</td></tr></table>";
  return h;
}
function ctrBlockHTML(N,g){
  const L=ctrList(N,S.player,g); if(!L.length)return "";
  let h="<div class='bsec' style='margin-top:8px'>Contratos <span class='u'>/mes</span></div><table class='e2t'><tr><th>Reino</th><th>Sentido</th><th class='r'>Cantidad</th><th>Estado</th></tr>";
  for(const c of L.slice(0,8))h+="<tr"+(c.cut?" style='opacity:.55'":"")+"><td>"+nameChip(c.b)+"</td><td>"+(c.dir==="exp"?"Exporta":"Importa")+"</td><td class='r'>"+nfE(c.q)+"</td><td"+(c.cut?" class='neg'":"")+">"+(c.cut?c.cut:"Activo")+"</td></tr>";
  return h+"</table>";
}
// Gráfica de las últimas semanas de precio (economy2 N.ph; la línea punteada es el precio normal)
function sparkPrice(N,g){
  const H=N.ph&&N.ph[g]; if(!H||H.length<2)return "<span class='e2sub'>—</span>";
  const ref=gRef(g), all=H.concat([ref]), lo=Math.min(...all), hi=Math.max(...all), W=84, Hh=22, sp=hi-lo||1;
  const X=i=>(i*(W-4)/(H.length-1)+2).toFixed(1), Y=v=>(Hh-2-(v-lo)/sp*(Hh-4)).toFixed(1);
  const pts=H.map((v,i)=>X(i)+","+Y(v)).join(" "), last=H[H.length-1], up=last>=H[0];
  const tip=tipBox("Tendencia",[{cols:["Momento","Precio"],trows:[["Inicio",prE(H[0])],["Mínimo",prE(Math.min(...H))],["Máximo",prE(Math.max(...H))],["Ahora",prE(last)],["Normal",prE(ref)]]}],H.length+" semanas");
  return "<span data-tiph=\""+ta(tip)+"\" style='cursor:help'><svg width='"+W+"' height='"+Hh+"' style='vertical-align:middle'>"+
    "<line x1='2' x2='"+(W-2)+"' y1='"+Y(ref)+"' y2='"+Y(ref)+"' stroke='#6a7077' stroke-dasharray='2 3'/>"+
    "<polyline points='"+pts+"' fill='none' stroke='"+(up?"#d08080":"#8fb04a")+"' stroke-width='1.6'/>"+
    "<circle cx='"+X(H.length-1)+"' cy='"+Y(last)+"' r='2.2' fill='"+(up?"#d08080":"#8fb04a")+"'/></svg></span>";
}
function renderMktGood2(body,N,g){
  const mi=(N.mktInfo&&N.mktInfo[g])||{},p=N.mktPrice[g]!=null?N.mktPrice[g]:gRef(g),r=p/gRef(g),t=TIER2[g]||"mat";
  let h="<div class='tcrumb' style='margin-bottom:10px'><span class='tcrumbi' onclick='closeMktGood()'>🏪 Mercado</span> › <b class='tcrumbc'>"+resImg(g)+" "+gLabel(g)+"</b></div>";
  const who=t==="mat"?"":STRATA.filter(e=>WANT2[e][t]>0).map(e=>"<span data-tip=\""+ta(STRATA_INFO[e].label)+"\">"+STRATA_INFO[e].icon+"</span>").join(" ");
  const ch=chain2(g), lab=ks=>ks.map(k=>resImg(k)+" "+gLabel(k)).join(" ");
  const kv=(k,v,tip)=>"<div"+(tip?" style='cursor:help' data-tiph=\""+ta(tip)+"\"":"")+"><div class='k'>"+k+"</div><div class='v'>"+v+"</div></div>";
  h+="<div class='kvg'>"+kv("Precio",prE(p)+" "+resImg("dinero"),tipBox(gLabel(g),priceBlocks(N,g)))+kv("Normal",prE(gRef(g)))+kv("Relación",ratioTxt(r))+kv("Tendencia",sparkPrice(N,g))+"</div>";
  h+="<div class='kvg'>"+kv("Necesidad","<span data-tip=\""+ta(TIER_TIP[t])+"\">"+TIER_META[t][1]+"</span>")+(who?kv("Compradores",who):"")+
    (ch.from.length?kv("Insumo",lab(ch.from)):"")+(ch.to.length?kv("Uso",lab(ch.to)):"")+"</div>";
  h+="<div class='bsum'><div class='bsec'>En "+NATIONS[S.player].name+" <span class='u'>/mes</span></div>";
  const line=(lab,val,col,tip)=>"<div class='prow'"+(tip?" data-tip=\""+ta(tip)+"\"":"")+"><span>"+lab+"</span><b"+(col?" style='color:"+col+"'":"")+">"+val+"</b></div>";
  const flow=goodFlowHTML(N,g);
  if(flow)h+=flow;
  else{ // primer mes: aún no hay libro del bien
    h+=line("Producido",nfE(mi.prod));h+=line("Demanda",nfE(mi.dem));
    const pc=mi.dem>0.5?Math.min(100,Math.round(100*(mi.sold||0)/mi.dem)):100;
    h+="<div class='prow'><span>Comprado</span><b>"+nfE(mi.sold)+" &nbsp;"+barE(pc)+" "+pc+"%</b></div>";h+=line("En la plaza",nfE(N.mkt[g]))}
  const cov=N.e2&&N.e2.cover&&N.e2.cover[g];
  if(cov!=null)h+="<div class='prow' data-tip='Parte de la materia que piden talleres y artesanos que llega a comprarse. Si baja, producen menos.'><span>Talleres abastecidos</span><b>"+barE(pctE(cov))+" "+pctE(cov)+"%</b></div>";
  // en el mundo: quién lo produce y a quién le falta
  const rows=[];for(let n=0;n<NPLAY;n++){const O=S.nations[n];if(!O||!O.alive||!O.mktInfo||!O.mktInfo[g])continue;const m=O.mktInfo[g];
    rows.push({n,prod:m.prod||0,gap:Math.max(0,(m.dem||0)-(m.sold||0)),p:O.mktPrice[g]})}
  const top=rows.filter(x=>x.prod>0.5).sort((a,b)=>b.prod-a.prod).slice(0,6), fal=rows.filter(x=>x.gap>0.5).sort((a,b)=>b.gap-a.gap).slice(0,6);
  const col=(title,list,f,cls)=>"<div style='flex:1;min-width:0'><div class='bsec'>"+title+"</div>"+(list.length?list.map(x=>"<div class='prow'><span>"+nameChip(x.n)+"</span><b class='"+cls+"'>"+nfE(f(x))+"</b></div>").join(""):"<div class='prow'><span class='dim'>—</span></div>")+"</div>";
  h+=ctrBlockHTML(N,g);
  h+="<div style='display:flex;gap:14px;margin-top:6px'>"+col("Más lo producen",top,x=>x.prod,"pos")+col("Más les falta",fal,x=>x.gap,"neg")+"</div></div>";
  h+="<div style='display:flex;gap:8px;justify-content:center;margin-top:10px'>"+
    "<button class='bbtn sm' onclick='showGoodMap(\""+g+"\",\"prod\")'>🗺 Producción</button>"+
    "<button class='bbtn sm' onclick='showGoodMap(\""+g+"\",\"price\")'>🗺 Precio</button>"+
    "<button class='bbtn sm' onclick='showGoodMap(\""+g+"\",\"deficit\")'>🗺 Déficit</button></div>";
  body.innerHTML=h;
}

// ---------- Estamentos ----------
function estateOwned(e){ // edificios del estamento en el reino: {b:{lv,off}}
  const o={};
  for(const p of S.provs){if(p.owner!==S.player||p.wasteland)continue;
    for(const b in p.buildings){const lv=p.buildings[b]||0;if(!lv)continue;if(((p.bOwner&&p.bOwner[b])||"corona")!==e)continue;
      const x=o[b]||(o[b]={lv:0,off:0});x.lv+=lv;if(p.bOff&&p.bOff[b])x.off+=lv}}
  return o;
}
function covCell(N,e,t,cnt){
  if(!WANT2[e][t])return "<td></td>";
  const v=N.e2.cov[e][t],pc=pctE(v), cons=S.sConsumePrev?S.sConsumePrev[e]||{}:(S.sConsume&&S.sConsume[e])||{}, trows=[];
  if(e==="campesino"&&t==="subs")trows.push([resImg("grano")+" Grano","granero","",""]);
  if(cnt)for(const g in NEED2[t]){if(e==="campesino"&&g==="grano")continue;
    const want=NEED2[t][g]*WANT2[e][t]*(cnt[e]||0)/12, got=(cons[g]&&cons[g][0])||0; if(want<0.5)continue;
    const r=got/want;trows.push([resImg(g)+" "+gLabel(g),nfE(got),nfE(want),{v:Math.min(999,Math.round(100*r))+"%",c:r<0.9?"#d08080":null}])}
  const tip=trows.length?tipBox(TIER_META[t][1],[{cols:["Bien","Consigue","Pide","Parte"],trows}],STRATA_INFO[e].label+", al mes"):tipBox(TIER_META[t][1],[{rows:[[TIER_TIP[t],""]]}]);
  return "<td style='cursor:help' data-tiph=\""+ta(tip)+"\">"+barE(pc,52)+" <span style='display:inline-block;width:32px'>"+pc+"%</span></td>";
}
function estateNet(e){ // balance del mes de un estamento (lo que entra − lo que gasta): sus cuentas, el mismo libro que su ficha
  const fl=S.sFlowPrev?S.sFlowPrev[e]:(S.sFlow&&S.sFlow[e]);if(!fl)return null;let t=0;for(const k in fl)t+=fl[k];return t}
function savingsTxt(N,e){ // ahorro en MESES de su cesta (más de un año → pide más vida y lujo) y hacia dónde va
  const bm=N.e2.basket&&N.e2.basket[e],w=N.sWealth[e]||0;
  if(!(bm>0))return "<span class='e2sub'>—</span>";
  const m=w/bm, col=m<3?"var(--neg)":m>=12?"var(--pos)":"var(--txt)";
  const txt=m>=24?Math.round(m/12)+" años":Math.round(m)+" m";
  const net=estateNet(e), dn=net!=null&&net<-0.5&&w>0, left=dn?w/-net:null;
  const arrow=net==null||Math.abs(net)<0.5?"":(net<0?arw("dnr"):arw("upg"));
  const tip=tipBox("Ahorro",[{cols:["Concepto","Valor"],trows:[["Riqueza",nfE(w)],["Cesta",nfE(bm)+" /mes"],
    ...(net!=null?[["Balance",{v:sgnE(net)+" /mes",c:net<0?"#d08080":null}]]:[]),
    ...(dn?[["Duración",{v:left>=24?Math.round(left/12)+" años":Math.round(left)+" meses",c:"#d08080"}]]:[]),
    ...(m>=12?[["Consumo","aumentado"]]:[])]}],STRATA_INFO[e].label);
  return "<span style='color:"+col+";cursor:help' data-tiph=\""+ta(tip)+"\">"+txt+arrow+"</span>";
}
const BUD_ACT={cierra:["neg","Cierra"],reabre:["pos","Reabre"],invierte:["","Levanta"]};
function budWhy(x){return x.why==="pierde"?"Pierde "+nfE(-x.prof)+" al mes":x.why==="gana"?"Gana "+nfE(x.prof)+" al mes":
  x.why==="presupuesto"?(x.act==="cierra"?"Sin presupuesto":"Presupuesto holgado"):x.act==="invierte"?"Coste "+nfE(x.cost||0):""}
function refreshEstates2(body){
  const N=S.nations[S.player];
  if(S.estSel&&STRATA.indexOf(S.estSel)>=0){renderEstate2(body,N,S.estSel);return}
  const {cnt,pop}=estateCounts();
  let h=headE(" · "+nfE(pop)+" hab."+iInfo("Cada estamento compra en la plaza sus tres necesidades: "+TIER_META.subs[1].toLowerCase()+", "+TIER_META.vida[1].toLowerCase()+" y lujo (solo las élites). La barra es la parte que consigue. Pulsa un estamento para ver sus cuentas."));
  h+="<table class='e2t'><tr><th>Estamento</th><th>Habitantes</th>"+tierTh()+
    "<th data-tip='Ingreso medio del último mes'>Ingreso/mes</th><th data-tip='Ahorro medido en meses de su cesta'>Ahorro</th></tr>";
  for(const e of STRATA){const I=STRATA_INFO[e];
    h+="<tr class='click' onclick=\"openEstate('"+e+"')\"><td>"+I.icon+" <b>"+I.label+"</b></td><td data-tip=\""+ta(popPct(cnt[e],pop)+" de la población")+"\">"+nfE(cnt[e])+"</td>"+
      covCell(N,e,"subs",cnt)+covCell(N,e,"vida",cnt)+covCell(N,e,"lujo",cnt)+
      "<td>"+nfE((N.e2.inc&&N.e2.inc[e])||0)+" "+resImg("dinero")+"</td><td>"+savingsTxt(N,e)+" <span class='tarrow'>›</span></td></tr>"}
  h+="</table>";
  // cierres y reaperturas recientes de edificios (la gestión por presupuesto de cada dueño)
  const ev=(N.budLog||[]).slice(-8).reverse();
  if(ev.length){h+="<div class='bsum' style='margin-top:10px'><div class='bsec'>Decisiones</div><table class='e2t'><tr><th>Acción</th><th>Edificio</th><th>Provincia</th><th>Dueño</th><th class='r'>Fecha</th></tr>";
    for(const x of ev){const P=S.provs[x.p],a=BUD_ACT[x.act]||["",x.act],why=budWhy(x);
      h+="<tr"+(why?" data-tip=\""+ta(why)+"\"":"")+"><td class='"+a[0]+"'>"+a[1]+"</td><td>"+(BUILDINGS[x.b]?BUILDINGS[x.b].label:x.b)+"</td><td>"+(P?P.name:"")+"</td><td>"+(STRATA_INFO[x.o]?STRATA_INFO[x.o].label:"Corona")+"</td><td class='r e2sub'>"+reportDate(x.h)+"</td></tr>"}
    h+="</table></div>"}
  body.innerHTML=h;
}
function renderEstate2(body,N,e){
  const I=STRATA_INFO[e];
  const fl=S.sFlowPrev?S.sFlowPrev[e]||{}:(S.sFlow&&S.sFlow[e])||{}, cons=S.sConsumePrev?S.sConsumePrev[e]||{}:(S.sConsume&&S.sConsume[e])||{};
  let h="<div class='tcrumb' style='margin-bottom:10px'><span class='tcrumbi' onclick='openEstate(null)'>Estamentos</span> › <b class='tcrumbc'>"+I.icon+" "+I.label+"</b></div>";
  const {cnt,pop}=estateCounts();
  if(e==="burgues"||e==="campesino"){let up=0,dn=0,cur=false;for(const p of S.provs){if(p.owner!==S.player)continue;const b=provBook(p);if(!b)continue;cur=cur||b.cur;up+=b.m.up||0;dn+=b.m.down||0}
    const pr=N.prosp!=null?N.prosp:1, poor=pr<0.5;
    h+="<table class='e2t' style='margin-bottom:8px' data-tip=\""+ta("Ascensos: del campo al oficio. Retornos: del oficio al campo. Con la prosperidad del burgués por debajo del 50%, vuelven al campo.")+"\"><tr><th>Ascensos</th><th>Retornos</th><th>Prosperidad</th></tr>"+
      "<tr><td class='pos'>+"+nfE(up)+"</td><td class='"+(dn>0?"neg":"e2sub")+"'>−"+nfE(dn)+"</td><td"+(poor?" class='neg'":"")+">"+pctE(pr)+"%</td></tr></table>"}
  h+="<table class='e2t'><tr><th>Habitantes</th>"+tierTh()+"<th>Ingreso/mes</th><th>Ahorro</th></tr>"+
    "<tr><td>"+nfE(cnt[e])+" <span class='e2sub'>"+popPct(cnt[e],pop)+"</span></td>"+covCell(N,e,"subs",cnt)+covCell(N,e,"vida",cnt)+covCell(N,e,"lujo",cnt)+"<td>"+nfE((N.e2.inc&&N.e2.inc[e])||0)+" "+resImg("dinero")+"</td><td>"+savingsTxt(N,e)+"</td></tr></table>";
  // sus cuentas del mes (mismo libro que la Tesorería)
  const ks=Object.keys(fl).filter(c=>Math.abs(fl[c])>=0.5);
  const inc=ks.filter(c=>fl[c]>0).sort((a,b)=>fl[b]-fl[a]),exp=ks.filter(c=>fl[c]<0).sort((a,b)=>fl[a]-fl[b]);
  let net=0;for(const c of ks)net+=fl[c];
  const row=c=>"<div class='trow'><span>"+flowLabel(c)+"</span><b class='"+(fl[c]<0?"neg":"pos")+"'>"+sgnE(fl[c])+" "+resImg("dinero")+"</b></div>";
  h+="<div class='tbook' style='margin-top:10px'><div class='tsec'>Ingresos"+(S.sFlowPrev?"":" (este mes)")+"</div>"+(inc.length?inc.map(row).join(""):"<div class='trow tdim'>—</div>")+
    "<div class='tsec'>Gastos</div>"+(exp.length?exp.map(row).join(""):"<div class='trow tdim'>—</div>")+
    "<div class='ttotal'><span>Balance del mes</span><b class='"+(net<0?"neg":"pos")+"'>"+sgnE(net)+" "+resImg("dinero")+"</b></div></div>";
  // qué compra, por necesidad
  const gs=Object.keys(cons).filter(g=>cons[g][1]>=0.5);
  if(gs.length){h+="<div class='bsum' style='margin-top:10px'>";
    for(const t of ["subs","vida","lujo","mat"]){const tg=gs.filter(g=>(TIER2[g]||"mat")===t).sort((a,b)=>cons[b][1]-cons[a][1]);if(!tg.length)continue;
      h+="<table class='e2t' style='margin-bottom:6px'><tr><th>"+TIER_META[t][0]+" "+(t==="mat"?"Materias":TIER_META[t][1])+"</th><th class='r'>Gasto</th><th class='r'>Cantidad</th></tr>";
      for(const g of tg)h+="<tr><td>"+resImg(g)+" "+gLabel(g)+"</td><td class='r'>"+nfE(cons[g][1])+" "+resImg("dinero")+"</td><td class='r e2sub'>"+nfE(cons[g][0])+"</td></tr>";
      h+="</table>"}
    h+="</div>"}
  // sus edificios
  const own=estateOwned(e),bs=Object.keys(own).sort((a,b)=>own[b].lv-own[a].lv);
  if(bs.length){h+="<div class='bsum' style='margin-top:6px'><div class='bsec'>Edificios</div><div style='display:flex;flex-wrap:wrap;gap:4px 14px'>";
    for(const b of bs){const x=own[b];h+="<span"+(x.off?" data-tip=\""+ta(x.off+" niveles cerrados: no le rinden lo que cuestan")+"\"":"")+">"+(BUILDINGS[b]?BUILDINGS[b].label:b)+" ×"+x.lv+(x.off?" <span class='neg'>("+x.off+" cerr.)</span>":"")+"</span>"}
    h+="</div></div>"}
  body.innerHTML=h;
}
window.openEstate=function(e){S.estSel=e;refreshEstates()};

// ---------- Ficha de provincia (v2): resumen ----------
const ESTATE_COL={campesino:"#a8904e",burgues:"#4f86b0",clero:"#9a82c4",nobleza:"#c0563e"};
function manorIcon(p){ // quién es el señor de la tierra: la corona (su escudo), el clero ⛪ o la nobleza 👑
  const m=manorOf(p), who=m==="solariego"?"nobleza":m==="abadengo"?"clero":null;
  const lab={realengo:"Realengo",abadengo:"Abadengo",solariego:"Señorío solariego"}[m]||m;
  const tip=tipRows(lab,[["Renta en especie",Math.round((MANOR_RENT[m]||0)*100)+"% → "+(who?STRATA_INFO[who].label:"la corona")],
    ["Diezmo",pctE(DIEZMO)+"% → Clero"],["Portazgo","→ "+(who?STRATA_INFO[who].label:"la corona")]]);
  return "<span data-tiph=\""+ta(tip)+"\" style='cursor:help;font-size:15px'>"+(who?STRATA_INFO[who].icon:escOf(p.owner))+"</span>";
}
function estateBar(p,w){ // los cuatro estamentos apilados (ancho = su parte de la población)
  const pops=p.pops||{};let tot=0;for(const e of STRATA)tot+=pops[e]||0;
  let seg="";const rows=[];
  for(const e of STRATA){const v=pops[e]||0;if(!(v>0))continue;
    seg+="<i style='display:block;height:100%;width:"+(100*v/tot).toFixed(2)+"%;background:"+ESTATE_COL[e]+"'></i>";
    rows.push(["<span style='color:"+ESTATE_COL[e]+"'>■</span> "+STRATA_INFO[e].label,nfE(v)+" · "+popPct(v,tot)])}
  return "<span data-tiph=\""+ta(tipRows("Población · "+nfE(p.pop),rows))+"\" style='display:inline-flex;width:"+(w||110)+"px;height:8px;border-radius:3px;overflow:hidden;background:#241a14;vertical-align:middle;cursor:help'>"+seg+"</span>";
}
// ---------- Tarjetas de Construir (v2): lo que da un edificio a SU dueño ----------
function siteBlock2(p,b){return BLD2[b]&&!siteOK2(p,b)?"Sin materia prima aquí":null}
function bldEcon2(p,b,lvl){ // {o, stock:[{k,q}] | out:{g,q}, ins, noSite, profit (🪙/mes)} para lvl niveles
  const B=BUILDINGS[b],fx=B.fx||{},o=lvlOf(p,b)>0?bOwnerOf(p,b):"corona",D=BLD2[b];
  const up=B.up&&B.up.dinero?B.up.dinero/12*lvl*MONTH_TICKS*upkeepScale(p,b):0;
  const stock=o==="corona"&&fx.prodAdd?Object.keys(fx.prodAdd).filter(k=>CROWN_STOCK.has(k)):[];
  if(stock.length){ // lo de la corona que va a su ALMACÉN (obras y ejército): no se vende (economy2, pasada A)
    const mor=(p.morale||0)/100,st=staffing(p),terr=(TERRAINS[p.terrain]||{prod:1}).prod,mul=1+(provProdMul(p)-1)*st;
    return {o,stock:stock.map(k=>({k,q:fx.prodAdd[k]*lvl*terr*mor*st*mul*MONTH_TICKS})),profit:-up}}
  if(D&&!siteOK2(p,b))return {o,noSite:true,profit:-up};
  return {o,out:D?buildingOutput2(p,b,lvl):null,ins:(D&&D.in)||null,profit:buildingProfit2(p,b,lvl)};
}
function benefitHTML2(p,b,lvl){
  const B=BUILDINGS[b],fx=B.fx||{},e=bldEcon2(p,b,Math.max(1,lvl)),N=S.nations[p.owner],lines=[];
  if(b==="granja")lines.push("<div class='bl'>+40% "+resImg("grano")+" del campo</div>");
  if(e.stock)for(const x of e.stock)lines.push("<div class='bl' data-tip='Al almacén de la corona (obras y ejército): no se vende'>→ "+resImg(x.k)+" "+nfE(x.q)+"/mes 📦</div>");
  if(e.noSite)lines.push("<div class='bl' style='color:#d0913a'>✖ sin materia prima aquí</div>");
  if(e.out&&e.out.g)lines.push("<div class='bl' data-tip=\""+ta("Lo que vende a la plaza"+(lvl>0?"":" (un nivel)")+", al mes")+"\">→ "+resImg(e.out.g)+" "+nfE(e.out.q)+"/mes</div>");
  if(e.ins&&e.out)for(const k in e.ins){const cv=N&&N.e2&&N.e2.cover?N.e2.cover[k]:null;
    lines.push("<div class='bl' style='color:#c9c2ae' data-tip=\""+ta("Materia que compra en la plaza"+(cv!=null?" · se consigue el "+pctE(cv)+"%":""))+"\">← "+resImg(k)+" "+nfE(e.out.q*e.ins[k])+"/mes"+(cv!=null&&cv<0.98?" <span style='color:"+(cv<0.6?"#c0563e":"#d0913a")+"'>"+pctE(cv)+"%</span>":"")+"</div>")}
  if(fx.prodAdd&&fx.prodAdd.dinero)lines.push("<div class='bl'>+ "+resImg("dinero")+" acuñación</div>");
  if(fx.prodMul)lines.push("<div class='bl'>+"+Math.round(fx.prodMul*100)+"% a la producción</div>");
  if(fx.mano)lines.push("<div class='bl'>+"+Math.round(fx.mano*100)+"% soldadesca</div>");
  if(fx.store)lines.push("<div class='bl'>+"+Math.round(fx.store*100)+"% despensa</div>");
  if(fx.def)lines.push("<div class='bl'>+"+Math.round(fx.def*100)+"% defensa</div>");
  if(fx.moral)lines.push("<div class='bl'>+"+n1(fx.moral)+" moral/mes</div>");
  if(fx.realmMoral)lines.push("<div class='bl'>+"+n1(fx.realmMoral)+" moral al reino</div>");
  if(fx.buildSpeed)lines.push("<div class='bl'>obras -"+Math.round(fx.buildSpeed*100)+"%</div>");
  if(fx.seaMarch)lines.push("<div class='bl eff'>marcha marítima</div>");
  if(B.unlock)lines.push("<div class='bl eff'>desbloquea tropas</div>");
  return lines.join("");
}
function nextHint2(p,b,lvl){ // lo que AÑADE el siguiente nivel (marginal), no el total
  const a=bldEcon2(p,b,lvl+1),z=lvl>0?bldEcon2(p,b,lvl):{profit:0};
  if(a.noSite)return "";
  const d=a.profit-(z.profit||0),col=d>=0?"#8aa478":"#c9776a";
  const st=a.stock?" · +"+a.stock.map(x=>nfE(x.q-((z.stock||[]).find(y=>y.k===x.k)||{q:0}).q)+resImg(x.k)).join(" ")+"📦":"";
  return "<div style='font-size:10px;color:"+col+"'>≈ "+(d>=0?"+":"−")+fmt(Math.abs(d))+"🪙/mes"+st+" "+(lvl>0?"el sig. nivel":"si la construyes")+"</div>";
}
// CRECIMIENTO de la provincia, sumado como en EU4 (economy2 popGrowthWhy: la misma fórmula que el tick)
function popTip(p){
  const w=popGrowthWhy(p), x=v=>"×"+v.toFixed(2), pc=v=>(v>=0?"+":"")+(v*100).toFixed(2).replace(".",",")+"%", red=v=>v<1?"#d08080":null;
  const blocks=[];
  if(w.famine)blocks.push({h:"Hambre",rows:[["Granero","vacío","#d08080"]]});
  else blocks.push({h:"Crecimiento",cols:["Factor","Estado","Efecto"],trows:[
    ["Natalidad","",pc(w.base)],
    ["Granero",(w.months>=24?"24+":w.months.toFixed(0))+" meses",{v:x(w.food),c:red(w.food)}],
    ["Tierra",Math.round(100*landOcc2(p))+"%",{v:x(w.land),c:red(w.land)}],
    ["Comodidades",pctE(w.vida)+"%",{v:x(w.life),c:red(w.life)}]],
    ttot:["Total",sgnE((p.pop||0)*w.rate)+" al año",pc(w.rate)]});
  const poor=w.prosp!=null&&w.prosp<w.poor;
  blocks.push({h:"Burgueses",cols:["Concepto","Valor"],trows:[["Ahora",pctE(w.burgNow)+"%"],["Objetivo",pctE(w.burgTarget+w.push)+"%"],
    ...(w.push>0.0005?[["Válvula","+"+pctE(w.push)+" puntos"]]:[]),...(w.prosp!=null?[["Prosperidad",{v:pctE(w.prosp)+"%",c:poor?"#d08080":null}]]:[])]});
  const b=provBook(p);
  if(b&&(b.m.born||b.m.dead||b.m.up||b.m.down))blocks.push({h:b.cur?"Este mes":"Mes pasado",cols:["Movimiento","Personas"],trows:[
    ["Nacimientos","+"+nfE(b.m.born||0)],["Hambre",{v:"−"+nfE(b.m.dead||0),c:(b.m.dead||0)>=0.5?"#d08080":null}],
    ["Ascensos","+"+nfE(b.m.up||0)],["Retornos",{v:"−"+nfE(b.m.down||0),c:(b.m.down||0)>=0.5?"#d08080":null}]]});
  return tipBox("Población",blocks,p.name);
}
function landOcc2(p){const K=landCap(p);return K>0&&p.pops?(p.pops.campesino||0)/K:0}
function provStats2(p,own){ // población + moral/soldadesca/dotación/huecos en UNA fila (sus desgloses, al hover)
  let h="<div class='prow'><span data-tiph=\""+ta(popTip(p))+"\" style='cursor:help'>"+uiIcon('poblacion')+" "+nfE(p.pop)+"</span><b>"+estateBar(p)+"</b></div>";
  const it=(ico,val,tip)=>"<span style='display:inline-flex;align-items:center;gap:3px'>"+ico+statv(val,tip)+"</span>";
  const cells=[it("🙂",Math.round(p.morale)+"%",moraleBreak(p))];
  if(own){cells.push(it(uiIcon('soldadesca'),fmtPop(soldAvail(p))+"/"+fmtPop(soldCap(p)),"Soldadesca disponible: "+fmtPop(soldAvail(p))+"\nTecho: "+fmtPop(soldCap(p))));
    if(buildJobs(p)>0)cells.push(it(uiIcon('trabajo'),Math.round(staffing(p)*100)+"%",dotBreak(p)));
    cells.push(it(uiIcon('edificios'),usedSlots(p)+"/"+buildSlots(p),slotBreak(p)));
    const dm=provDefMul(p);if(dm>1)cells.push(it(uiIcon('defensa'),"+"+Math.round((dm-1)*100)+"%",defBreak(p)));}
  return h+"<div class='prow' style='justify-content:space-between'>"+cells.join("")+"</div>";
}
function pantryRow2(p){ // el GRANERO del ducado: cuántos meses de grano quedan, si llega a la siega, y qué cuesta traerlo
  const g=granaryOf(p); if(!g)return "";
  const hv=Math.round((g.harvest-1)*100),m=manorOf(p),troop=troopDrainOn(p)*730,need=p._grainNeed||0,got=p._grainGot||0;
  const mo=Math.floor(g.months),cal=calOf(S.hour),until=MONTHS_ES[(cal.m+mo)%12],hm=MONTHS_ES[g.harvestMonth];
  const dn=p.duchy>=0&&S.duchies&&S.duchies[p.duchy]?S.duchies[p.duchy].name:p.name;
  const state=p.famine?"<b class='neg'>Hambre</b>":need>0?"<span class='neg'>Comprando</span>"
    :g.short?"<span class='neg'>No llega</span>":mo>=12?"<span class='pos'>Sobra</span>":"<span class='dim'>Hasta "+until+"</span>";
  const tip=tipBox("Granero",[
    {h:"Reserva",cols:["Concepto","Valor"],trows:[["Guardado",nfE(g.st)],["Capacidad",nfE(g.cap)],["Duración",g.months>=24?"24+ meses":g.months.toFixed(1)+" meses"],
      ["Siega",hm+", en "+Math.ceil(g.monthsToHarvest)+" m"],["Cosecha",(hv>=0?"+":"")+hv+"%"],["Consumo",nfE(g.c/12)+" /mes"],...(troop>0.5?[["Tropas",{v:nfE(troop)+" /mes",c:"#d08080"}]]:[]),
      ...(need>0?[["Compra",{v:Math.round(100*got/need)+"%",c:"#d08080"}]]:[])]},
    {h:"Importación",cols:["Concepto","Valor"],trows:[["Precio",nfE(g.price)],["Flete",pctE(g.flete)+"%"],["Origen",g.from],["Distancia",Math.round(g.km)+" km"]],ttot:["Total",nfE(g.priceIn)+" /u"]},
    {h:"Excedente",cols:["Concepto","Valor"],trows:[["Destino","Plaza"],["Diezmo",pctE(DIEZMO)+"%"],["Renta",Math.round((MANOR_RENT[m]||0)*100)+"%"]]}],dn);
  const pc=Math.min(100,Math.round(100*g.months/12));
  return "<div class='prow' data-tiph=\""+ta(tip)+"\" style='cursor:help'><span>"+ph("granero")+" Granero</span><b>"+barE(pc,64)+" "+(g.months>=24?"24+":g.months<1?"&lt;1":mo)+" m &nbsp;"+state+"</b></div>"+
    reliefRow2(p,g,hm);
}
// TIERRA (design/capacidad-agraria.md): cuánto de su capacidad agraria ocupan los campesinos de la provincia. Por encima
// del 70% cada campesino nuevo rinde menos; al 100%, en un año normal, cosecha justo lo que come. No habla de renta: la
// renta sale del granero del ducado, no de la provincia.
function landRow2(p){
  const K=p.pops?landCap(p):0; if(!(K>0))return "";
  const c=p.pops.campesino||0,x=c/K,pc=Math.round(100*x),y=landYield(p);
  const state=x>1?"<b class='neg'>Desborda</b>":x>LAND_FULL?"<span class='dim'>Rinde ×"+y.toFixed(2)+"</span>":"<span class='pos'>Holgada</span>";
  const tip=tipBox("Tierra",[{cols:["Concepto","Valor"],trows:[["Capacidad",nfE(K)],["Campesinos",nfE(c)],["Ocupación",pc+"%"],
      ["Rendimiento",{v:"×"+y.toFixed(2),c:y<1?"#d08080":null}],["Natalidad",{v:"×"+landBirth(p).toFixed(2),c:landBirth(p)<1?"#d08080":null}]]},
    {h:"Umbrales",cols:["Tramo","Ocupación"],trows:[["Pleno","hasta "+Math.round(LAND_FULL*100)+"%"],["Límite","100%"]]}],p.name);
  return "<div class='prow' data-tiph=\""+ta(tip)+"\" style='cursor:help'><span>"+ph("tierra")+" Tierra</span><b>"+
    barE(pc,64,x>1?"#c0563e":x>LAND_FULL?"#c98a3a":"#6fae5a")+" "+pc+"% &nbsp;"+state+"</b></div>";
}
// SOCORRO: solo en ducados propios que no llegan a la siega (o con hambre). Un clic llena el granero hasta la siega; el
// botón enseña el total antes de pulsar y el tooltip el desglose (almacén, compra, flete). Todo sale de reliefQuote.
function reliefRow2(p,g,hm){
  if(p.owner!==S.player||!(g.short||p.famine||(p._grainNeed||0)>0))return "";
  const q=reliefQuote(S.player,p); if(!q||q.falta<=0)return "";
  const dn=p.duchy>=0&&S.duchies&&S.duchies[p.duchy]?S.duchies[p.duchy].name:p.name;
  const tip=tipBox("Socorro",[{cols:["Concepto","Cantidad","Ducados"],trows:[["Falta",nfE(q.falta),""],
      ...(q.almacen>=0.5?[["Almacén",nfE(q.almacen),""]]:[]),...(q.compra>=0.5?[["Compra",nfE(q.compra),nfE(q.compra*q.price)]]:[]),
      ["Flete",Math.round(q.km)+" km",nfE(q.flete)]],ttot:["Total","",nfE(q.total)]},
    ...(q.why?[{rows:[["Bloqueo",q.why,"#d08080"]]}]:[])],dn+", hasta "+hm);
  return "<div class='prow' data-tiph=\""+ta(tip)+"\"><span></span><b><button class='bbtn' "+(q.ok?"":"disabled")+
    " onclick='reliefSendProv("+p.id+")'>"+ph("socorro")+" Socorro "+hm+" <span class='"+(q.ok?"":"neg")+"'>"+nfE(q.total)+"</span> "+COIN()+"</button></b></div>";
}
function tradeRow2(p){ // su centro de comercio y lo que cuesta llevar allí cada bien (flete)
  const hub=(p.hubOf!=null&&p.hubOf>=0)?S.provs[p.hubOf]:null, km=Math.round(p.hubKm||0);
  const rows=[["Centro de comercio",hub?hub.name+(km?" · "+km+" km":""):"—"]];
  for(const g of ["grano","lana","pano","seda"])rows.push(["Flete "+gLabel(g).toLowerCase(),pctE(transport(p,g))+"% del valor"]);
  rows.push(["Lo cobran",km<=30?"los campesinos (acarreo)":"campesinos y arrieros burgueses"]);
  const val=!hub?"—":hub.id===p.id?"Centro de comercio":"→ "+hub.name+" <span class='e2sub'>"+km+" km</span>";
  return "<div class='prow' data-tiph=\""+ta(tipRows("Comercio",rows))+"\" style='cursor:help'><span>🛤 Comercio</span><b>"+val+"</b></div>";
}
// ---------- Ficha de provincia (v2): Produce, Rinde y la ventana Economía (libro de la provincia: p.m / p._m) ----------
const WHO_ORDER=["campesino","burgues","clero","nobleza","corona"];
const whoIcon=(w,n)=>w==="corona"?escOf(n):STRATA_INFO[w].icon;
const whoLabel=w=>w==="corona"?"Corona":STRATA_INFO[w].label;
const WHO_COL=Object.assign({corona:"#d8c191"},ESTATE_COL);
function provBook(p){ // el mes cerrado (estable) o, si aún no hay, el que va en curso
  const cur=S.pMonth==="cur"||!p.m, m=cur?p._m:p.m;
  if(!m)return null;
  let val=0;for(const g in m.val)val+=m.val[g];
  const who={};for(const w in m.pay){let v=0;for(const c in m.pay[w])v+=m.pay[w][c];who[w]=v}
  return {m,cur,val,who};
}
function goodsByValue(m){return Object.keys(m.prod).filter(g=>m.prod[g]>=0.5).sort((x,y)=>((m.val[y]||0)-(m.val[x]||0))||(m.prod[y]-m.prod[x]))}
// De cada 100 ducados que paga el comprador por este bien, quién se lleva qué (economy2 saleSplit). Un bien sale "de
// taller" si en la provincia hay un taller que lo hace o es oficio de los artesanos; si no, es cosecha del campo.
function saleKind(p,g){
  for(const b in p.buildings)if((p.buildings[b]||0)>0&&BLD2[b]&&BLD2[b].out===g)return ["taller",bOwnerOf(p,b)];
  if(ARTISAN_MIX[g]!=null||g==="armas")return ["taller","burgues"];
  return ["campo",null];
}
function splitBlock(p,g){ // reparto de cada 100 ducados del comprador (economy2 saleSplit)
  const [kind,owner]=saleKind(p,g), sp=saleSplit(p,g,kind,owner);
  const trows=[];for(const w of WHO_ORDER)for(const r of sp.rows)if(r.who===w&&r.f>=0.005)trows.push(["<i class='sw' style='background:"+WHO_COL[w]+"'></i>"+whoLabel(w),r.concept,Math.round(100*r.f)]);
  return {h:"Reparto",sub:kind==="taller"?"Taller":"Cosecha",cols:["Quién","Concepto","De 100"],trows,ttot:["Total","",100]};
}
function produceRow2(p){ // lo que sale de la provincia, los bienes de más valor (u/mes; tooltip con su valor y su reparto)
  const b=provBook(p); if(!b)return "";
  const gs=goodsByValue(b.m), st=Object.keys(b.m.stock).filter(k=>b.m.stock[k]>=0.5);
  if(!gs.length&&!st.length)return "";
  const cell=(g,q,v)=>{const blocks=[{h:"Producción",cols:["Concepto","Valor"],trows:[["Unidades",nfE(q)+" /mes"],v!=null?["Plaza",nfE(v)+" "+COIN()]:["Destino","Almacén"]]}];
    if(v!=null)blocks.push(splitBlock(p,g));
    return "<span data-tiph=\""+ta(tipBox(gLabel(g),blocks))+"\" style='cursor:help;white-space:nowrap'>"+resImg(g)+nfE(q)+"</span>"};
  return "<div class='bsec'>Produce <span class='u'>/mes</span></div><div style='display:flex;flex-wrap:wrap;gap:3px 10px;font-size:var(--fs)'>"+
    gs.slice(0,6).map(g=>cell(g,b.m.prod[g],b.m.val[g]||0)).join("")+st.map(k=>cell(k,b.m.stock[k],null)).join("")+"</div>";
}
function yieldBar2(p,b,w){ // barra apilada: a quién va el dinero que paga la plaza; el FLETE aparte (lo cobran los que transportan)
  let seg="";const tot=b.val||1, fr={};let frT=0;
  for(const k in b.m.pay){const v=b.m.pay[k].Transporte||0;if(v>0){fr[k]=v;frT+=v}}
  const own=k=>(b.who[k]||0)-(fr[k]||0), pc=v=>Math.round(100*v/tot)+"%";
  for(const k of WHO_ORDER){const v=own(k);if(v<=0)continue;seg+="<i style='display:block;height:100%;width:"+(100*v/tot).toFixed(2)+"%;background:"+WHO_COL[k]+"'></i>"}
  if(frT>0)seg+="<i style='display:block;height:100%;width:"+(100*frT/tot).toFixed(2)+"%;background:#6a7077'></i>";
  const trows=WHO_ORDER.filter(k=>own(k)>=0.5).map(k=>["<i class='sw' style='background:"+WHO_COL[k]+"'></i>"+whoLabel(k),nfE(own(k)),pc(own(k))]);
  const blocks=[{cols:["Quién","Ducados","Parte"],trows,ttot:["Total",nfE(b.val),"100%"]}];
  if(frT>=0.5)blocks.push({h:"Flete",cols:["Cobra","Ducados","Parte"],trows:WHO_ORDER.filter(k=>(fr[k]||0)>=0.5).map(k=>["<i class='sw' style='background:#6a7077'></i>"+whoLabel(k),nfE(fr[k]),pc(fr[k])])});
  return "<span data-tiph=\""+ta(tipBox("Rinde",blocks,p.name))+"\" style='display:inline-flex;width:"+(w||110)+"px;height:8px;border-radius:3px;overflow:hidden;background:#241a14;vertical-align:middle;cursor:help'>"+seg+"</span>";
}
function yieldRows2(p){ // "Rinde": el valor que la provincia lleva a la plaza, repartido, y lo que te toca a ti
  const b=provBook(p); if(!b||!(b.val>0.5))return "";
  return "<div class='bsec'>Rinde <span class='u'>/mes</span></div>"+
    "<div class='prow'><span>"+yieldBar2(p,b)+"</span><b>"+nfE(b.val)+" "+resImg("dinero")+"</b></div>"+
    "<div class='prow' style='cursor:pointer' onclick=\"setProvTab('eco')\"><span>"+escOf(p.owner)+" Corona</span><b class='"+((b.who.corona||0)>0?"pos":"dim")+"'>"+sgnE(b.who.corona||0)+" "+resImg("dinero")+" <span class='tarrow'>›</span></b></div>";
}
function provEcoWinHTML(p){ // ventana Economía: el mismo libro que la Tesorería, pero de esta provincia
  const b=provBook(p);
  const mt=(k,lab)=>"<span class='e2seg"+((S.pMonth==="cur"?"cur":"prev")===k?" on":"")+"' onclick=\"setProvMonth('"+k+"')\">"+lab+"</span>";
  let h="<div class='winh' style='display:flex;justify-content:space-between;align-items:center'><span>"+resImg("dinero")+" Economía</span>"+(p.m?"<span>"+mt("prev","Mes pasado")+mt("cur","Este mes")+"</span>":"")+"</div>";
  if(!b)return h+"<div class='prow'><span class='dim'>Aún sin datos.</span></div>";
  const path=S.pEcoPath||null;
  h+="<div class='tbook'>";
  if(path&&b.m.pay[path]){ // detalle de un cobrador
    const cs=b.m.pay[path],ks=Object.keys(cs).sort((x,y)=>cs[y]-cs[x]);
    h+="<div class='tcrumb'><span class='tcrumbi' onclick=\"provEcoDrill(null)\">Economía</span> › <b class='tcrumbc'>"+whoIcon(path,p.owner)+" "+whoLabel(path)+"</b></div>";
    for(const c of ks)h+="<div class='trow'><span>"+flowLabel(c)+"</span><b class='pos'>"+sgnE(cs[c])+" "+resImg("dinero")+"</b></div>";
    return h+"<div class='ttotal'><span>Total · "+whoLabel(path)+"</span><b class='pos'>"+sgnE(b.who[path])+" "+resImg("dinero")+"</b></div></div>";
  }
  h+="<div class='trow thead'><span>Producción</span><span>u/mes · 🪙 plaza</span></div>";
  for(const g of goodsByValue(b.m))h+="<div class='trow'><span>"+resImg(g)+" "+gLabel(g)+"</span><b><span class='tstock'>"+nfE(b.m.prod[g])+"</span> "+(b.m.val[g]>=0.5?nfE(b.m.val[g]):"<span class='e2sub'>—</span>")+"</b></div>";
  for(const k in b.m.stock)if(b.m.stock[k]>=0.5)h+="<div class='trow' data-tip='Al almacén de la corona: no se vende'><span>"+resImg(k)+" "+gLabel(k)+" 📦</span><b><span class='tstock'>"+nfE(b.m.stock[k])+"</span> <span class='e2sub'>—</span></b></div>";
  h+="<div class='tsec'>Quién cobra</div>";
  for(const w of WHO_ORDER){const v=b.who[w]||0;if(v<0.5)continue;
    h+="<div class='trow click' onclick=\"provEcoDrill('"+w+"')\"><span>"+whoIcon(w,p.owner)+" "+whoLabel(w)+" <span class='tarrow'>›</span></span><b>"+barE(pctE(v/(b.val||1)),50)+" <span class='pos'>"+sgnE(v)+"</span> "+resImg("dinero")+"</b></div>"}
  h+="<div class='ttotal'><span>Pagado en la plaza</span><b>"+nfE(b.val)+" "+resImg("dinero")+"</b></div></div>";
  // talleres de la provincia: dueño, lo que sacan y si están cerrados
  const bs=Object.keys(p.buildings).filter(x=>(p.buildings[x]||0)>0&&(BLD2[x]||(BUILDINGS[x].fx&&BUILDINGS[x].fx.prodAdd)));
  if(bs.length){h+="<div class='tbook' style='margin-top:8px'><div class='tsec'>Talleres</div>";
    for(const x of bs){const o=bOwnerOf(p,x),off=p.bOff&&p.bOff[x],q=b.m.bld[x]||0,D=BLD2[x];
      h+="<div class='trow'"+(off?" style='opacity:.6'":"")+"><span>"+BUILDINGS[x].label+" ×"+p.buildings[x]+" <span data-tip=\""+ta(whoLabel(o))+"\">"+whoIcon(o,p.owner)+"</span></span><b>"+
        (off?"<span class='neg'>cerrado</span>":q>=0.5&&D?"→ "+resImg(D.out)+" "+nfE(q):"<span class='e2sub'>—</span>")+"</b></div>"}
    h+="</div>"}
  return h;
}
window.setProvMonth=function(k){S.pMonth=k;S.pEcoPath=null;refreshBuildBar()};
window.provEcoDrill=function(w){S.pEcoPath=w;refreshBuildBar()};
export {
  log, fmt, fmtDur, iInfo, buildResBar, refreshTop, costStr, n1, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, refreshLedger, refreshReports, refreshPeace, showNationPicker, buildRealmMenu, refreshMetricsLog, refreshArmyPanel, refreshTreasury, refreshEstates, refreshMercado, refreshFiscal, refreshCouncil, refreshCoalPeace, refreshLeagues, refreshCallToArms, refreshDipModal
};
