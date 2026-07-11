// ui.js
import { START_DATE, MESES, BUILDINGS, BUILD_CATS, GOLD_PER_WS, NATIONS, NPLAY, RES_DESC, RES_ICON, RES_KEYS, RES_LABEL, RES_SHORT, RES_STRAT, RES_TRADE, TERRAINS, UNITS, WAR_LOCK_HOURS, terrainFx } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyPops, armyFood, armyDef, armySpd, buildBlock, buildingYield, buildJobs, buildMax, buildSlots, canAfford, costFor, employedIn, foodBalance, foodCap, foodCons, foodFill, harvestMul, storeCap, storeOf, SUBS_BASICS, freeLabor, isOccupied, jobsOf, lvlOf, moraleGrowth, MORALE_HOSTILE, nationEconomy, nationLedger, nationProvCount, nationStrength, provBreakdown, provDefMul, recruitTime, soldAvail, soldCap, specialistCap, staffing, timeFor, usedSlots } from "./economy.js";
import { hasRoad, kmBetween, roadKey } from "./mapgen.js";
import { canvas, clampPan } from "./render.js";
import { continueGame, loadSaveMeta } from "./save.js";
import { armiesIn, atWar, duchyValue, fortGarrison, occupiedDuchiesBy, tryBuild, tryRecruit, tryRoad, warscore } from "./sim.js";

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
// duración de juego → texto que PREFIERE meses (hasta 2 años; luego años), para no chocar con el
// resto de la UI que razona en meses. ticks de juego (1 tick = 1 hora, 730 ≈ 1 mes, 8760 = 1 año).
function foodMonths(ticks){
  const m=ticks/730;
  if(m<24)return Math.round(m)+(Math.round(m)===1?" mes":" meses");
  return (m/12).toFixed(1).replace(".0","")+" años";
}
function foodLine(p){ // despensa de comida: llenado, balance como % del consumo, cuánto AGUANTA la reserva; cosecha en fila propia
  if(p.wasteland)return "";
  const fill=foodFill(p),consT=foodCons(p),balT=foodBalance(p);
  const balPct=consT>0?Math.round(balT/consT*100):0;   // balance como % del consumo (sin unidad de tiempo)
  const cap=foodCap(p),store=fill*cap;
  const hv=Math.round((harvestMul(p)-1)*100);
  const hvRow=hv>=5?"<div class='tl'><span class='pos'>🌾 Buena cosecha +"+hv+"%</span></div>"
    :hv<=-5?"<div class='tl'><span class='neg'>🌾 Mala cosecha "+hv+"%</span></div>"
    :"<div class='tl' style='color:#9aa3ad'>🌾 Cosecha normal</div>";
  if(p.famine)return "<div class='tl'><b class='neg'>"+uiIcon('despensa')+" ⚠ HAMBRUNA</b> · despensa de comida vacía</div>"+hvRow;
  let extra;                                            // cuánto aguanta / cuánto tarda en llenarse (duración, no tasa)
  if(Math.abs(balPct)<1)extra=" · estable";
  else if(balT<0)extra=" · aguanta ~"+foodMonths(store/-balT);
  else if(fill<0.99)extra=" · se llena en ~"+foodMonths((cap-store)/balT);
  else extra=" · llena";
  const pct="<span class='"+(balPct<0?"neg":"pos")+"'>"+(balPct>=0?"+":"")+balPct+"%</span>";
  return "<div class='tl'>"+uiIcon('despensa')+" Despensa "+Math.round(fill*100)+"% · "+pct+extra+"</div>"+hvRow;
}
function reservesLine(p){ // reservas locales de los demás bienes básicos de subsistencia (madera/piedra/hierro)
  if(p.wasteland)return "";
  const parts=[];
  for(const k of SUBS_BASICS){
    if(k==="comida")continue; // la comida ya va en foodLine
    const cap=storeCap(p,k);if(cap<=0)continue;
    parts.push(resImg(k)+" "+Math.round(storeOf(p,k)/cap*100)+"%");
  }
  if(!parts.length)return "";
  return "<div class='tl' style='color:#9aa3ad'>🏚 Reservas locales · "+parts.join(" · ")+"</div>";
}
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
function slotsLine(p){ // huecos de construcción (crecen con la población, modelo EU5)
  if(p.wasteland)return "";
  const used=usedSlots(p),tot=buildSlots(p);
  const col=used>=tot?"#e0a17a":used>=tot-1?"#d9c07a":"#9aa3ad";
  return "<div class='tl'>🏗 Edificios <span style='color:"+col+"'>"+used+"/"+tot+"</span> <span style='color:#7a828b'>(el cupo crece con la población)</span></div>";
}
function laborLine(p){ // dotación de los edificios: puestos exigidos vs mano de obra libre
  if(p.wasteland)return "";
  const jobs=buildJobs(p);
  if(jobs<=0)return "";
  const st=Math.round(staffing(p)*100);
  const col=st>=90?"#8fbf78":st>=50?"#d9c07a":"#e0a17a";
  const mob=(p.mob||0)>1?" · "+fmtPop(p.mob)+" movilizados":"";
  return "<div class='tl'>🔨 Dotación <span style='color:"+col+"'>"+st+"%</span> <span style='color:#9aa3ad'>("+fmtPop(freeLabor(p))+" trab. / "+fmtPop(jobs)+" puestos"+mob+")</span></div>";
}
function fmtDur(h){ // horas de juego -> texto legible
  if(h>=8760)return (h/8760).toFixed(1).replace(".0","")+" años";
  if(h>=720)return Math.round(h/730)+" meses";
  if(h>=48)return Math.round(h/24)+" días";
  return Math.round(h)+" h";
}
// icono de UI (stats, pestañas, menús): sprite de assets/ui. big = tamaño de botón/pestaña.
function uiIcon(name,big){return "<img class='uic"+(big?" big":"")+"' src='assets/ui/"+name+".png' alt=''>"}
// icono de recurso: sprite de assets/res para los 11 bienes de stock; emoji para plata/oro (sin sprite)
function resImg(k){
  return RES_KEYS.includes(k)
    ?"<img class='ric' src='assets/res/"+k+".png' alt='"+(RES_LABEL[k]||k)+"' title='"+(RES_LABEL[k]||k)+"'>"
    :(RES_ICON[k]||"");
}
function buildResBar(){
  const bar=document.getElementById("resbar");
  if(bar.dataset.built)return;
  // cada bien: sprite + stock actual + balance mensual (+/-) inline
  const cell=(k,cls)=>"<span class='res "+cls+"'><img class='ric' src='assets/res/"+k+".png' alt='"+RES_LABEL[k]+"' title='"+RES_LABEL[k]+"'>"+
    "<b id='r_"+k+"'>0</b><small class='rd' id='d_"+k+"'></small></span>";
  let h=RES_STRAT.map(k=>cell(k,"strat")).join("");
  h+="<span class='sep'></span>";
  h+=RES_TRADE.map(k=>cell(k,"trade")).join("");
  h+="<span class='sep'></span><span class='res' title='Soldadesca del reino (cupo movilizable disponible)'>"+uiIcon('soldadesca')+"<b id='r_mano'>0</b></span>";
  bar.innerHTML=h;bar.dataset.built="1";
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
  const R=S.nations[S.player].res;
  const inc=nationEconomy(S.player).res;
  for(const k of RES_KEYS){
    const el=document.getElementById("r_"+k);if(!el)continue;
    el.textContent=fmt(R[k]);
    const g=inc[k]||0;
    el.title=RES_LABEL[k]+": "+(g>=0?"+":"")+(Math.round(g*10)/10)+"/mes\n\n"+(RES_DESC[k]||"");
    el.style.color="#fff";
    // balance mensual (+/-) mostrado inline junto al stock — verde ingreso, rojo pérdida
    const dd=document.getElementById("d_"+k);
    if(dd){
      const gv=Math.abs(g)>=10?Math.round(g):Math.round(g*10)/10;
      dd.textContent=(g>=0?"+":"")+gv;
      dd.title="Balance de "+RES_LABEL[k]+": "+(g>=0?"+":"")+(Math.round(g*10)/10)+"/mes";
      dd.style.color=g<-0.05?"var(--neg)":g>0.05?"var(--pos)":"var(--muted)";
    }
  }
  let realmSold=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland&&!isOccupied(p))realmSold+=soldAvail(p);
  document.getElementById("r_mano").textContent=fmt(realmSold);
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
  if(fx.store)t.push("+"+Math.round(fx.store*100)+"% reservas");
  if(fx.def)t.push("+"+Math.round(fx.def*100)+"% defensa");
  if(fx.moral)t.push("+"+n1(fx.moral)+" moral/mes");
  if(fx.realmMoral)t.push("+"+n1(fx.realmMoral)+" moral/mes al reino");
  if(fx.buildSpeed)t.push("obras -"+Math.round(fx.buildSpeed*100)+"%");
  if(fx.seaMarch)t.push("marcha marítima");
  if(B.unlock)t.push("desbloquea tropas");
  return t.join(" · ");
}
// Desglose EU4 del cálculo VIVO de un beneficio (para el tooltip al hover del valor verde):
// base · terreno · moral · dotación · afinidad = total.
function yieldTip(y){
  let t=(RES_LABEL[y.res]||y.res)+" — producción de un nivel /mes\n\n";
  for(const s of y.steps)t+="  "+s[0]+": "+s[1]+"\n";
  t+="  ─────────────\n  = "+n1(y.amt)+" "+(RES_LABEL[y.res]||y.res)+"/mes";
  return t;
}
// Beneficios de un edificio para la tarjeta: una LÍNEA por beneficio (verde), producción VIVA con
// su icono de recurso y su DESGLOSE al hover; los % también en verde. Los empleos van en su fila.
function benefitHTML(p,b){
  const B=BUILDINGS[b],fx=B.fx,lines=[];
  for(const y of buildingYield(p,b))
    lines.push("<div class='bl' data-tip=\""+ta(yieldTip(y))+"\">±"+n1(y.amt)+" "+resImg(y.res)+(y.mul?" <span class='mul'>+"+y.mul+"%</span>":"")+"</div>");
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
// efectos que NO son producción de recurso (la producción viva se muestra aparte en la tarjeta)
function fxOtherText(B){
  const fx=B.fx,t=[];
  if(fx.mano)t.push("+"+Math.round(fx.mano*100)+"% soldadesca");
  if(fx.store)t.push("+"+Math.round(fx.store*100)+"% reservas");
  if(fx.def)t.push("+"+Math.round(fx.def*100)+"% defensa");
  if(fx.moral)t.push("+"+n1(fx.moral)+" moral/mes");
  if(fx.realmMoral)t.push("+"+n1(fx.realmMoral)+" al reino");
  if(fx.buildSpeed)t.push("obras -"+Math.round(fx.buildSpeed*100)+"%");
  if(fx.seaMarch)t.push("marcha marítima");
  if(B.unlock)t.push("desbloquea tropas");
  return t.join(" · ");
}
function costLine(c,owner){
  return Object.keys(c).map(k=>{
    const no=owner!=null&&S.nations[owner].res[k]<c[k];
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
function netBreak(bd,res){
  let t=RES_LABEL[res]+" — desglose /mes\n";
  for(const it of bd.income)if(it.res===res&&Math.abs(it.amt)>0.005)t+="  +"+n1(it.amt)+"  "+it.label+"\n";
  for(const it of bd.upkeep)if(it.res===res&&Math.abs(it.amt)>0.005)t+="  -"+n1(it.amt)+"  "+it.label+"\n";
  t+="  = "+(bd.net[res]>=0?"+":"")+n1(bd.net[res])+" neto";
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
  let s="<div class='ph'><h4 style='font-size:15px;color:#fff;margin:0'>"+p.name+statusIco+"</h4></div><div class='bsum'>";
  if(p.wasteland){
    s+="<div class='tl'>"+TERRAINS[p.terrain].label+"</div>"+
       "<div class='prow'><span class='dim'>Territorio impracticable: nadie puede reclamarlo ni atravesarlo.</span></div></div>";
    panel.innerHTML=s;panel.className="show";panel.style.display="block";return;
  }
  // Identidad agrupada arriba: reino + ducado juntos
  s+="<div class='tl'><span class='chip' style='background:"+NATIONS[p.owner].color+"'></span> "+NATIONS[p.owner].name+
     (p.duchy>=0&&S.duchies[p.duchy]?" <span style='color:#5c636b'>|</span> "+uiIcon('ducado')+" "+S.duchies[p.duchy].name:"")+"</div>";
  if(isOccupied(p))s+="<div class='tl' style='color:#e0a17a'>⚔ Ocupada por <span class='chip' style='background:"+NATIONS[p.occupier].color+"'></span> "+NATIONS[p.occupier].name+"</div>";
  const good=p.urban?("Ciudad"+(p.resType?" · "+RES_LABEL[p.resType]:"")):(RES_LABEL[p.resType]||"—");
  s+="<div class='tl'>"+(p.resType?resImg(p.resType)+" ":"")+good+" · "+TERRAINS[p.terrain].label+
     iInfo(TERRAINS[p.terrain].label+" — "+terrainFx(p.terrain))+"</div>";
  s+="<div class='prow'><span>"+uiIcon('poblacion')+" Población"+iInfo("Habitantes: trabajan la tierra (producción base), dotan los edificios, pagan impuestos y aportan la soldadesca. Crece con el excedente de comida.")+"</span>"+
     statv(fmtPop(p.pop),"Población: "+fmtPop(p.pop)+" hab\nCrece con la despensa llena; cae en hambruna.")+"</div>";
  s+="<div class='prow'><span>🙂 Moral"+iInfo("Factor de PRODUCTIVIDAD: al 100% los pops rinden al máximo; por debajo, reducen su producción. No se recupera sola: la hacen crecer los edificios de moral (templo, catedral).")+"</span>"+
     statv(Math.round(p.morale)+"%",moraleBreak(p))+"</div>";
  if(own){
    s+="<div class='prow'><span>"+uiIcon('soldadesca')+" Soldadesca"+iInfo("Cupo de población movilizable para reclutar (≈2% de la pop × edificios militares). Se regenera con el tiempo.")+"</span>"+
       statv(fmtPop(soldAvail(p))+"/"+fmtPop(soldCap(p)),"Soldadesca disponible: "+fmtPop(soldAvail(p))+"\nTecho: "+fmtPop(soldCap(p))+"  (de "+fmtPop(p.pop)+" hab)")+"</div>";
    if(buildJobs(p)>0)s+="<div class='prow'><span>"+uiIcon('trabajo')+" Dotación"+iInfo("Los edificios producen según los trabajadores empleados. Dotación = mano de obra libre / puestos exigidos; por debajo del 100% la producción de edificios baja.")+"</span>"+
       statv(Math.round(staffing(p)*100)+"%",dotBreak(p))+"</div>";
    s+="<div class='prow'><span>"+uiIcon('edificios')+" Edificios"+iInfo("Huecos de construcción de la provincia: crecen con su población. Cuanta más gente, más edificios puede sostener.")+"</span>"+
       statv(usedSlots(p)+"/"+buildSlots(p),slotBreak(p))+"</div>";
  }
  s+=foodLine(p)+siegeLine(p); // reservesLine (madera/piedra/hierro) oculta hasta que tengan uso
  if(own){
    const bd=provBreakdown(p);
    s+="<div class='bsec'>Balance <span class='u'>/mes</span>"+iInfo("Ingresos menos mantenimiento de la provincia, por recurso. Pasa el ratón por un valor para ver de dónde sale.")+"</div>";
    const nk=Object.keys(bd.net).filter(k=>Math.abs(bd.net[k])>0.005).sort((a,b)=>bd.net[b]-bd.net[a]);
    if(!nk.length)s+="<div class='prow'><span class='dim'>Sin balance neto.</span></div>";
    for(const k of nk)s+="<div class='prow'><span>"+resImg(k)+" "+RES_LABEL[k]+"</span>"+
      "<span class='statv "+(bd.net[k]<0?"neg":"pos")+"' data-tip=\""+ta(netBreak(bd,k))+"\">"+(bd.net[k]>=0?"+":"")+n1(bd.net[k])+"</span></div>";
    const dm=provDefMul(p);
    if(dm>1)s+="<div class='prow'><span>"+uiIcon('defensa')+" Defensa"+iInfo("Multiplicador de defensa en batalla y asedio, por castillo/ciudadela. El terreno multiplica aparte.")+"</span>"+
       statv("+"+Math.round((dm-1)*100)+"%",defBreak(p))+"</div>";
  }else{
    const blist=Object.keys(BUILDINGS).filter(b=>lvlOf(p,b)>0);
    if(blist.length){
      s+="<div class='bsec'>Construcciones</div>";
      for(const b of blist)s+="<div class='prow'><span>"+BUILDINGS[b].icon+" "+BUILDINGS[b].label+"</span><b>"+(BUILDINGS[b].unique?"✓":lvlOf(p,b))+"</b></div>";
    }
  }
  const here=armiesIn(p.id);
  if(here.length){
    s+="<div class='bsec'>Ejércitos</div>";
    for(const a of here)s+="<div class='prow'><span><span class='chip' style='background:"+NATIONS[a.nation].color+"'></span> "+
      Math.round(armyCount(a))+" u</span><b class='dim'>"+NATIONS[a.nation].name+"</b></div>";
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
      const block=inQ?null:buildBlock(p,b);
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
      tiles+="<div class='"+cls+"'"+onclick+" data-tip=\""+ta(B.desc)+"\">"+
        "<img class='bic' src='assets/buildings/"+b+".png' alt='"+B.label+"' title='"+B.label+"' onerror=\"this.replaceWith(bemoji('"+B.icon+"'))\">"+
        "<div class='th'><span class='nm'>"+B.label+"</span>"+lvBadge+"</div>"+
        "<div class='ben'>"+benefitHTML(p,b)+jobsHtml+"</div>"+
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
    if(hasRoad(p.id,b))rows+="<div class='recrow'><span class='u'>→ "+S.provs[b].name+"</span><span class='cst'>✓ camino</span></div>";
    else if(S.roadQueue.some(q=>q.key===roadKey(p.id,b))){
      const q=S.roadQueue.find(q=>q.key===roadKey(p.id,b));
      rows+="<div class='recrow'><span class='u'>→ "+S.provs[b].name+"</span><span class='cst'>obra "+fmtDur(q.hoursLeft)+"</span></div>";
    }else{
      const dis=!canAfford(S.player,{dinero:800,materiales:1200});
      rows+="<div class='recrow'><span class='u'>→ "+S.provs[b].name+" <span class='sm'>("+kmR+" km)</span></span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" onclick='tryRoad("+p.id+","+b+")'>Camino</button></div>";
    }
  }
  if(!any)return "<div class='prow'><span class='dim'>Sin provincias propias adyacentes a las que unir por camino.</span></div>";
  return "<div class='sm' style='color:#9aa3ad;margin-bottom:7px'>Une provincias propias adyacentes: +50% de velocidad de marcha entre ellas. Cada camino cuesta 800 Ducados y 1200 Madera (6 meses).</div>"+rows;
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
  const tabs=[["build","trabajo","Construir"],["roads","caminos","Caminos"],["army","espadas","Ejércitos"]];
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
  else body="<div class='winh'>"+uiIcon('espadas')+" Ejércitos y reclutamiento</div>"+armyHTML(p);
  win.innerHTML="<div class='winbody'>"+body+"</div>";
  win.className="show list";win.style.display="block";
}
// compatibilidad: los llamadores antiguos refrescan la ficha completa (detalle + botones + ventana)
function refreshBuildBar(){refreshProvPanel();refreshProvTabs();refreshProvWin();}
// menú del reino (arriba-izquierda, estilo EU4): escudo + botonera de ajustes del reino
/* ============================= Tesorería (libro mayor navegable) =============================
 * Panel con dos pestañas: TESORO (balance de Ducados por categoría) e INVENTARIO (el resto de
 * recursos, cada uno en modo balance). Cada categoría es clicable y abre su detalle (desglosado
 * por sub-categorías) con el total abajo, que verifica la suma. Datos: nationLedger(). */
function tsyAgg(list,field){ // agrega los ítems por un campo (group o sub o res) → [{key,amt}]
  const m=new Map();
  for(const x of list)m.set(x[field],(m.get(x[field])||0)+x.amt);
  return [...m].map(([key,amt])=>({key,amt})).filter(r=>Math.abs(r.amt)>0.005);
}
function tsySum(list){let s=0;for(const x of list)s+=x.amt;return s}
function tsyRow(label,amt,res,drillKey){ // fila de categoría; drillKey!=null → clicable a su detalle
  const drill=drillKey!=null;
  const attrs=drill?" class='trow click' onclick=\"treasuryDrill('"+drillKey+"')\"":" class='trow'";
  return "<div"+attrs+"><span>"+label+(drill?" <span class='tarrow'>›</span>":"")+"</span>"+
    "<b class='"+(amt<0?"neg":"pos")+"'>"+(amt>=0?"+":"")+n1(amt)+" "+resImg(res)+"</b></div>";
}
function tsyTotal(label,amt,res){ // fila de TOTAL (verifica la suma de las filas de arriba)
  return "<div class='ttotal'><span>"+label+"</span><b class='"+(amt<0?"neg":"pos")+"'>"+(amt>=0?"+":"")+n1(amt)+" "+resImg(res)+"</b></div>";
}
function tsyCrumb(path){ // migas de pan de navegación (volver a niveles superiores)
  let h="<span class='tcrumbi' onclick='treasuryBack(0)'>"+(S.treasuryTab==="tesoro"?"🪙 Tesoro":"📦 Inventario")+"</span>";
  for(let i=0;i<path.length;i++){
    const label=(S.treasuryTab==="inv"&&i===0)?RES_LABEL[path[i]]:path[i];
    h+=" › "+(i===path.length-1?"<b class='tcrumbc'>"+label+"</b>":"<span class='tcrumbi' onclick='treasuryBack("+(i+1)+")'>"+label+"</span>");
  }
  return "<div class='tcrumb'>"+h+"</div>";
}
function tsyTesoro(items){ // pestaña TESORO: balance de Ducados
  const dm=items.filter(x=>x.res==="dinero"),path=S.treasuryPath;
  let h="";
  if(path.length===0){
    const g=tsyAgg(dm,"group");
    const inc=g.filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
    const exp=g.filter(x=>x.amt<0).sort((a,b)=>a.amt-b.amt);
    h+="<div class='tsec'>Ingresos</div>";
    h+=inc.length?inc.map(x=>tsyRow(x.key,x.amt,"dinero",x.key)).join(""):"<div class='trow tdim'>Sin ingresos</div>";
    h+="<div class='tsec'>Gastos</div>";
    h+=exp.length?exp.map(x=>tsyRow(x.key,x.amt,"dinero",x.key)).join(""):"<div class='trow tdim'>Sin gastos</div>";
    h+=tsyTotal("Balance neto",tsySum(dm),"dinero");
  }else{
    const group=path[0],sel=dm.filter(x=>x.group===group);
    const subs=tsyAgg(sel,"sub").sort((a,b)=>Math.abs(b.amt)-Math.abs(a.amt));
    h+=tsyCrumb([group]);
    h+=subs.map(x=>tsyRow(x.key,x.amt,"dinero",null)).join("");
    h+=tsyTotal("Total · "+group,tsySum(sel),"dinero");
  }
  return h;
}
function tsyInv(items){ // pestaña INVENTARIO: el resto de recursos, en balance
  const inv=items.filter(x=>x.res!=="dinero"),path=S.treasuryPath,R=S.nations[S.player].res;
  let h="";
  if(path.length===0){
    const byRes=tsyAgg(inv,"res");
    h+="<div class='trow thead'><span>Recurso</span><span>Stock · balance/mes</span></div>";
    let any=false;
    for(const k of RES_KEYS){
      if(k==="dinero")continue;
      const net=(byRes.find(r=>r.key===k)||{amt:0}).amt,stock=R[k]||0;
      if(Math.abs(net)<0.005&&stock<0.5)continue;
      any=true;
      h+="<div class='trow click' onclick=\"treasuryDrill('"+k+"')\"><span>"+resImg(k)+" "+RES_LABEL[k]+" <span class='tarrow'>›</span></span>"+
        "<b><span class='tstock'>"+fmt(stock)+"</span> <span class='"+(net<0?"neg":"pos")+"'>"+(net>=0?"+":"")+n1(net)+"</span></b></div>";
    }
    if(!any)h+="<div class='trow tdim'>Sin recursos ni movimientos.</div>";
  }else if(path.length===1){
    const res=path[0],sel=inv.filter(x=>x.res===res);
    const g=tsyAgg(sel,"group");
    const inc=g.filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
    const exp=g.filter(x=>x.amt<0).sort((a,b)=>a.amt-b.amt);
    h+=tsyCrumb([res]);
    h+="<div class='tsec'>Producción</div>";
    h+=inc.length?inc.map(x=>tsyRow(x.key,x.amt,res,x.key)).join(""):"<div class='trow tdim'>—</div>";
    h+="<div class='tsec'>Consumo</div>";
    h+=exp.length?exp.map(x=>tsyRow(x.key,x.amt,res,x.key)).join(""):"<div class='trow tdim'>—</div>";
    h+=tsyTotal("Balance neto · "+RES_LABEL[res],tsySum(sel),res);
  }else{
    const res=path[0],group=path[1],sel=inv.filter(x=>x.res===res&&x.group===group);
    const subs=tsyAgg(sel,"sub").sort((a,b)=>Math.abs(b.amt)-Math.abs(a.amt));
    h+=tsyCrumb([res,group]);
    h+=subs.map(x=>tsyRow(x.key,x.amt,res,null)).join("");
    h+=tsyTotal("Total · "+group,tsySum(sel),res);
  }
  return h;
}
function refreshTreasury(){
  const ov=document.getElementById("treasuryOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("treasuryBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver su tesorería.</p>";return}
  const N=NATIONS[S.player],items=nationLedger(S.player);
  const tab=(k,lab)=>"<span class='ttab"+(S.treasuryTab===k?" on":"")+"' onclick=\"setTreasuryTab('"+k+"')\">"+lab+"</span>";
  let h="<div class='tsyhead'><span class='chip' style='background:"+N.color+"'></span> "+N.name+"</div>";
  h+="<div class='ttabs'>"+tab("tesoro","🪙 Tesoro")+tab("inv","📦 Inventario")+"</div>";
  h+="<div class='tbook'>"+(S.treasuryTab==="tesoro"?tsyTesoro(items):tsyInv(items))+"</div>";
  body.innerHTML=h;
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
    {img:"btn_estamentos",dis:1}
  ];
  el.innerHTML="<div class='rmEscudo' title='"+N.name+"'><span class='rmEscCol' style='background:"+N.color+"'></span>"+
      "<img src='assets/ui/escudo.png' alt='"+N.name+"'></div>"+
    btns.map(b=>"<img class='rmBtnImg"+(b.dis?" dis":"")+"' src='assets/ui/"+b.img+".png' alt=''"+
      (b.dis?" title='Próximamente'":" onclick='"+b.on+"'")+">").join("");
  el.className="show";
}
// log de métricas del reino (arriba-derecha, fijo): KPIs de tesorería + ejércitos desplegados
function refreshMetricsLog(){
  const el=document.getElementById("side");
  if(S.player<0||!S.started){el.style.display="none";return}
  const ne=nationEconomy(S.player),N=NATIONS[S.player];
  let realmPop=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)realmPop+=p.pop||0;
  let h="<div class='mlog'><span class='sh' style='background:"+N.color+"'></span>"+
    "<div><b>"+N.name+"</b><div style='color:#9aa3ad;font-size:11px'>"+ne.provs+" provincias · "+uiIcon('poblacion')+" "+fmtPop(realmPop)+"<br>"+ne.troops+" tropas</div></div></div>";
  h+="<h3>Tesorería del reino <span style='color:#7a828b;font-weight:normal'>/mes</span></h3>";
  const ks=Object.keys(ne.res).filter(k=>Math.abs(ne.res[k])>0.05).sort((a,b)=>ne.res[b]-ne.res[a]);
  if(!ks.length)h+="<div class='kpi'><span class='dim' style='color:#7a828b'>Sin balance neto.</span></div>";
  for(const k of ks){const v=ne.res[k];
    h+="<div class='kpi'><span>"+resImg(k)+" "+RES_LABEL[k]+"</span><span class='v "+(v<0?"neg":"pos")+"'>"+(v>=0?"+":"")+n1(v)+"</span></div>";}
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
  if(!a||a.nation!==S.player||!S.armies.includes(a)){el.className="";el.style.display="none";return}
  const P=S.provs[a.prov];
  const loc=a.path.length?"en marcha → "+S.provs[a.path[a.path.length-1]].name:"en "+(P?P.name:"—");
  let s="<div class='bsum'>";
  s+="<div class='ph'><h4 style='font-size:15px;color:#fff;margin:0'>"+uiIcon('espadas')+" Ejército · "+fmt(armyPops(a))+" "+uiIcon('soldadesca')+"</h4></div>";
  s+="<div class='tl' style='color:#9aa3ad'>"+loc+"</div>";
  s+="<div class='prow'><span>⚔ "+armyAtk(a).toFixed(1)+" · 🛡 "+armyDef(a).toFixed(1)+"</span><b>"+armySpd(a)+" km/d</b></div>";
  if(a.path.length)s+="<div class='uline'><span class='sm' style='color:#c9a86a'>En marcha</span><button class='mini red' onclick='haltArmy()'>Detener</button></div>";
  else if(a.muster&&S.hour<a.muster.until)s+="<div class='tl' style='color:#c9a86a'>⏳ Reuniendo levas…</div>";
  else s+="<div class='tl' style='color:#7a828b'>Clic derecho en el mapa para mover.</div>";
  // composición por tipo (con licenciar)
  s+="<div class='bsec'>Composición</div>";
  for(const k in a.units){
    if(a.units[k]<0.5)continue;
    const n=Math.round(a.units[k]);
    s+="<div class='uline'><span>"+UNITS[k].label+" <span style='color:#9aa3ad'>×"+n+" · "+fmt(n*(UNITS[k].mano||0))+" "+uiIcon('soldadesca')+"</span></span>"+
      "<span><button class='mini' onclick='disbandUnit("+a.id+",\""+k+"\",1)'>−1</button> "+
      "<button class='mini red' onclick='disbandUnit("+a.id+",\""+k+"\",99)' title='Licenciar todas'>✕</button></span></div>";
  }
  // reclutar unidades disponibles en la provincia donde está
  if(P&&P.owner===S.player&&!isOccupied(P)&&!P.wasteland){
    s+="<div class='bsec'>Reclutar aquí</div>";
    let any=false;
    for(const u in UNITS){
      const U=UNITS[u];let ok=true;for(const req in U.req)if((P.buildings[req]||0)<U.req[req])ok=false;
      if(!ok)continue;any=true;
      const dis=!canAfford(S.player,U.cost)||soldAvail(P)<U.mano;
      s+="<div class='uline'><span class='sm'>"+U.label+" <span style='color:#7a828b'>("+fmtDur(recruitTime(P,u))+")</span></span>"+
        "<button class='mini' "+(dis?"disabled":"")+" onclick='tryRecruit("+P.id+",\""+u+"\")'>+1</button></div>";
    }
    if(!any)s+="<div class='tl' style='color:#7a828b'>Construye un Cuartel aquí para reclutar.</div>";
  }
  // SUMINISTRO: slider forrajeo local ↔ nacional + consumo/mes
  const sup=a.supply==null?70:a.supply, foodMonth=armyFood(a)*730; // 730 ticks ≈ 1 mes de juego
  s+="<div class='bsec'>Suministro de grano</div>";
  s+="<input class='supply' type='range' min='0' max='100' step='5' value='"+sup+"' oninput='setArmySupply("+a.id+",this.value)'>";
  s+="<div class='prow' id='supLbl'><span>🌾 Forrajeo local <b>"+sup+"%</b></span><b>Nacional "+(100-sup)+"%</b></div>";
  s+="<div class='prow'><span style='color:#9aa3ad'>Consumo (sus pops)</span><b>"+n1(foodMonth)+" "+resImg('comida')+"/mes</b></div>";
  s+="<div class='tl' style='color:#7a828b;font-size:11px'>El forrajeo drena la despensa de la provincia y sus vecinas; lo nacional gasta el Grano del reino.</div>";
  // levantar levas alrededor del ejército
  s+="<div class='bsec'>Levantar levas</div>";
  s+="<div class='uline'><span class='sm'>Alrededor del ejército</span><span>"+
    "<button class='mini' onclick='raiseLevies("+a.id+",5)'>+5</button> "+
    "<button class='mini' onclick='raiseLevies("+a.id+",10)'>+10</button> "+
    "<button class='mini' onclick='raiseLevies("+a.id+",20)'>+20</button></span></div>";
  s+="</div>";
  el.innerHTML=s;el.className="show";el.style.display="block";
}
function refreshSide(){
  refreshMetricsLog();
  refreshBuildBar();
  refreshArmyPanel();
  refreshArmyWin();
}
function refreshDiplomacy(){
  const locked=S.hour<WAR_LOCK_HOURS;
  let h="";
  if(locked)h+="<div class='sm' style='color:#c9a86a;margin-bottom:8px'>⚔ Paz obligada: no se puede declarar la guerra hasta dentro de "+fmtDur(WAR_LOCK_HOURS-S.hour)+".</div>";
  h+="<table class='dip'><tr><th>Nación</th><th>Provincias</th><th>Fuerza</th><th>Estado</th><th></th></tr>";
  for(let n=0;n<NPLAY;n++){
    if(n===S.player)continue;
    const alive=S.nations[n].alive;
    h+="<tr><td><span class='chip' style='background:"+NATIONS[n].color+"'></span> "+NATIONS[n].name+"</td>";
    h+="<td>"+nationProvCount(n)+"</td><td>"+Math.round(nationStrength(n))+"</td>";
    if(!alive){h+="<td colspan='2'>Eliminada</td></tr>";continue}
    if(atWar(S.player,n)){
      h+="<td style='color:#d08080'>EN GUERRA</td><td><button class='bbtn' onclick='openPeace("+n+")'>Gestionar paz</button></td>";
    }else{
      h+="<td style='color:#90b080'>Paz</td><td><button class='bbtn red'"+(locked?" disabled title='Bloqueo de guerra inicial'":" onclick='playerDeclare("+n+")'")+">Declarar guerra</button></td>";
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
    const income=nationEconomy(n).res.dinero||0;
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
  const maxGive=Math.max(0,Math.floor(S.nations[S.player].res.dinero||0));
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
    "<b>👁 Modo observador</b><span>Mira evolucionar la partida sin atarte a ningún país: los 60 reinos actúan por IA. Toma el mando de cualquiera desde el Registro cuando quieras revisar sus estadísticas, y suéltalo al terminar.</span></div>";
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
      log("Modo observador: las 60 naciones actúan por IA. Abre el Registro para tomar el mando de una y revisar sus estadísticas.");
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
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, refreshLedger, refreshReports, refreshPeace, showNationPicker, buildRealmMenu, refreshMetricsLog, refreshArmyPanel, refreshTreasury
};
