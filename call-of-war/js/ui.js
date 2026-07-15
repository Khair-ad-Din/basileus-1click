// ui.js
import { START_DATE, MESES, BUILDINGS, BUILD_CATS, GOLD_PER_WS, NATIONS, NPLAY, RES_DESC, RES_ICON, RES_KEYS, RES_LABEL, RES_SHORT, RES_STRAT, RES_TRADE, TERRAINS, UNITS, WAR_LOCK_HOURS, terrainFx, STRATA, STRATA_INFO, RES_ART, RES_CAT } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyPops, armyFood, armyForage, troopDrainOn, armyDef, armySpd, buildBlock, buildingYield, buildJobs, buildMax, buildSlots, canAfford, costFor, employedIn, foodBalance, foodCap, foodCons, foodFill, harvestMul, subsProd, subsCons, storeCap, storeOf, SUBS_BASICS, freeLabor, isOccupied, jobsOf, lvlOf, moraleGrowth, MORALE_HOSTILE, nationEconomy, nationLedger, nationProvCount, nationStrength, provBreakdown, provDefMul, recruitable, recruitTime, soldAvail, soldCap, specialistCap, staffing, timeFor, usedSlots, MKT_GOODS, MKT_TRADE, MKT_PRICE, BASICS, terrMul, terrCatMul, RES_RAW_CATS, MONTH_TICKS, resetTsyLedger, tsyAvail, tsyMonthBal, BONUS_BIEN, PROSP_CHANNELS, prospLevel, PROSP_LEVEL_PTS, PROSP_MAX_PTS, CHANNEL_GOODS, NAT_BONUS_PER_LEVEL, taxRateOf, alcabalaOf, almojOf, ALCABALA, ALMOJ_DEFAULT, DIEZMO, buildingProfit, sourceableSet, inputsSourceable } from "./economy.js";
import { hasRoad, kmBetween, roadKey } from "./mapgen.js";
import { canvas, clampPan } from "./render.js";
import { continueGame, loadSaveMeta } from "./save.js";
import { armiesIn, atWar, duchyValue, fortGarrison, occupiedDuchiesBy, tryBuild, tryRecruit, tryRoad, warscore, coalitionOf, coalScore, coalCededDuchies } from "./sim.js";
import { getRel, relTier, THRESH, canDeclareWar, canInsult, isEmbargoed, hasClaim, relBreakdown, hasPact, canPact,
  MAX_LEAGUE, leagueOf, leagueById, sameLeague, canApplyLeague, MAX_RIVALS, rivalsOf, isRival, canRival,
  NAP_BONUS, ALLY_BONUS } from "./diplomacy.js";

// Metadata de las CATEGORÍAS de bienes (orden, icono, etiqueta), reutilizada por el Mercado, la Tesorería y
// el panel del reino para agrupar los bienes por categoría. 'moneda' (Ducados) va aparte (su propia pestaña).
const RESCAT_META=[["cereal","🌾","Cereal"],["cultivo","🍇","Cultivo"],["ganado","🐑","Ganadería"],
  ["bosque","🪵","Bosque"],["extractivo","⛏","Minería"],["mar","🐟","Mar"],
  ["manufactura","🏭","Manufacturas"],["comercio","🌶","Comercio lejano"]];

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
// Sección "Reservas" (categoría propia, como Balance): TODO el grano local en la MISMA unidad que el
// consumo de las tropas (grano/mes), con desglose producción campesina / consumo población / consumo
// tropas, el neto, el crecimiento anual, la despensa y cuánto aguanta o tarda en llenarse.
// Ventana dedicada de PROSPERIDAD (pestaña propia, como Construir/Caminos/Ejércitos). Muestra TODOS los canales con su
// barra de XP (0..3), tendencia (▲/▼/=), y por canal los BIENES que lo alimentan con ✓ (excedente) o ✗ (falta), más la
// satisfacción actual vs el umbral del siguiente nivel → el jugador ve qué excedentes necesita para activar cada modificador.
const PROSP_META=[
  ["natalidad","🍞","Natalidad","+ crecimiento de población",true],
  ["campoProd","🌾","Productividad del campo","+ producción agrícola",false],
  ["indProd","🏭","Productividad industrial","+ producción de fábricas",false],
  ["moral","⛪","Moral y prestigio","+ moral (contento, legitimidad)",false],
  ["militar","⚔","Poder militar","+ ejército / leva",false],
];
function prosperityWinHTML(p){
  const N=S.nations[S.player], pr=p.prosp||{}, minfo=(N&&N.mktInfo)||{};
  const ROMAN=["","I","II","III"];
  let h="<div class='winh'>"+uiIcon('poblacion')+" Prosperidad"+iInfo("Cada bien que la provincia consigue en EXCEDENTE (✓, precio ≤ referencia) suma +1 punto al mes a SU barra; si falta (✗), −1. Niveles: I = 12 pts (1 año seguido) · II = 36 (3 años) · III = 60 (5 años). Cada nivel logrado de cada bien da un bonus pequeño que STACKEA con los demás bienes del mismo tipo. De momento solo la Natalidad aplica efecto.")+"</div>";
  for(const[ch,ico,lab,eff,active]of PROSP_META){
    const goods=CHANNEL_GOODS[ch]||[];
    // efecto del canal (natalidad: crecimiento de población anual = Σ niveles × bono, con su máximo posible)
    let effLine;
    if(active){let cur=0;for(const g of goods)cur+=prospLevel(pr[g]||0)*NAT_BONUS_PER_LEVEL;const max=goods.length*3*NAT_BONUS_PER_LEVEL;
      effLine="<span style='color:var(--pos)'>+"+(cur*100).toFixed(2)+"%</span> / +"+(max*100).toFixed(2)+"% al año";}
    else effLine="<i>próximamente</i>";
    h+="<div style='margin:9px 0 2px;display:flex;align-items:center;gap:7px;border-top:1px solid #2f363d;padding-top:7px'>"+
       "<span style='font-size:15px'>"+ico+"</span><b style='flex:1'>"+lab+"</b></div>";
    h+="<div style='font-size:10px;color:#7a828b;margin:0 0 3px 22px'>"+eff+": "+effLine+"</div>";
    for(const g of goods){
      const pts=pr[g]||0, lvl=prospLevel(pts);
      const price=(minfo[g]&&minfo[g].price!=null)?minfo[g].price:(MKT_PRICE[g]||1), ref=MKT_PRICE[g]||1, ok=price<=ref*1.08;
      const fillLvl=lvl>=3?3:lvl+1;                                   // nivel-objetivo (I→II→III); en máx queda III
      const prev=lvl>0?PROSP_LEVEL_PTS[lvl-1]:0, next=lvl<3?PROSP_LEVEL_PTS[lvl]:PROSP_MAX_PTS;
      const frac=lvl>=3?1:(pts-prev)/(next-prev);
      h+="<div style='display:flex;align-items:center;gap:6px;font-size:11px;margin:1px 0 1px 22px'>"+
         "<span title='"+ta(RES_LABEL[g]||g)+"'>"+resImg(g)+"</span>"+
         "<span style='width:12px;color:"+(ok?"var(--pos)":"var(--neg)")+"' title='"+(ok?"excedente (+1/mes)":"falta (−1/mes)")+"'>"+(ok?"✓":"✗")+"</span>"+
         "<span style='width:42px;text-align:right;color:#9aa3ad'>"+pts+"/"+next+"</span>"+
         "<span style='flex:1;height:7px;background:#2a2f36;border-radius:4px;overflow:hidden'><span style='display:block;height:100%;width:"+Math.round(frac*100)+"%;background:"+(lvl>=1?"var(--pos)":"#7a828b")+"'></span></span>"+
         "<b style='width:20px;text-align:center;color:"+(lvl>=1?"var(--pos)":"#7a828b")+"'>"+ROMAN[fillLvl]+"</b></div>";
    }
  }
  return h;
}
function reservesSection(p){
  if(p.wasteland)return "";
  const prodM=subsProd(p,"comida")*730, consM=subsCons(p,"comida")*730, troopM=troopDrainOn(p)*730;
  const netM=prodM-consM-troopM, netT=netM/730;
  const cap=foodCap(p), fill=foodFill(p), store=fill*cap;
  const hv=Math.round((harvestMul(p)-1)*100);
  let dur;
  if(p.famine)dur="<b class='neg'>⚠ HAMBRUNA</b>";
  else if(Math.abs(netM)<0.5)dur="estable";
  else if(netM<0)dur="aguanta ~"+foodMonths(store/-netT);
  else if(fill<0.99)dur="se llena en ~"+foodMonths((cap-store)/netT);
  else dur="llena";
  let h="<div class='bsec'>Reservas de grano <span class='u'>/mes</span>"+iInfo("El grano LOCAL de la provincia: lo producen sus campesinos y lo consumen su población y las tropas que forrajean aquí (o en las vecinas). El neto llena o vacía la despensa; si se agota en un mal año, hay hambruna. Misma unidad (grano/mes) que el consumo de las tropas.")+"</div>";
  h+="<div class='prow'><span>🌾 Producción "+iInfo("Los campesinos trabajan la tierra: población × fertilidad del terreno × granjas × cosecha del año.")+"</span><b class='pos'>+"+fmt(prodM)+"</b></div>";
  h+="<div class='prow'><span>"+uiIcon('poblacion')+" Consumo población</span><b class='neg'>−"+fmt(consM)+"</b></div>";
  if(troopM>0.5)h+="<div class='prow'><span>"+uiIcon('espadas')+" Consumo tropas</span><b class='neg'>−"+fmt(troopM)+"</b></div>";
  h+="<div class='prow' style='border-top:1px solid #3a4047;margin-top:2px;padding-top:3px'><span>Neto</span>"+
     "<b class='"+(netM<0?"neg":"pos")+"'>"+(netM>=0?"+":"")+fmt(netM)+"/mes · "+(netM>=0?"+":"")+fmt(netM*12)+"/año</b></div>";
  h+="<div class='prow'><span>🥖 Despensa "+Math.round(fill*100)+"% <span style='color:#7a828b'>("+fmt(store)+"/"+fmt(cap)+")</span></span><b>"+dur+"</b></div>";
  const hvTxt=hv>=5?"<b class='pos'>+"+hv+"%</b>":hv<=-5?"<b class='neg'>"+hv+"%</b>":"<b style='color:#9aa3ad'>normal</b>";
  h+="<div class='prow'><span>🌾 Cosecha del año</span>"+hvTxt+"</div>";
  return h;
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
  return RES_ART.has(k) // ¿tiene sprite .png? si no, se pinta con su emoji (bienes nuevos)
    ?"<img class='ric' src='assets/res/"+k+".png' alt='"+(RES_LABEL[k]||k)+"' title='"+(RES_LABEL[k]||k)+"'>"
    :"<span class='ric ricEmoji' title='"+(RES_LABEL[k]||k)+"'>"+(RES_ICON[k]||"")+"</span>";
}
function buildResBar(){
  const bar=document.getElementById("resbar");
  if(bar.dataset.built)return;
  // El topbar es ahora un RESUMEN DE TESORERÍA (solo ducados): stock + ingresos/gastos FIJOS y la ALCÁBALA
  // acumulada (variable, se cobra a fin de mes). Las materias primas viven en Tesorería › Inventario y en el Mercado.
  const sep="<span class='barsep'></span>",hdr=t=>"<span class='reshdr'>"+t+"</span>";
  bar.innerHTML=
    "<span class='res' title='Ducados del tesoro — lo que puedes gastar este mes'>"+resImg('dinero')+"<b id='t_duc'>0</b> <small class='reslab'>ducados</small></span>"+sep+
    hdr("Fijo")+
    "<span class='res' title='Ingreso FIJO y predecible: impuestos feudales + producción de la corona + minas'><small class='reslab'>Ingresos</small> <b id='t_inc' class='pos'>0</b> <small class='reslab'>/mes</small></span>"+
    "<span class='res' title='Gastos: mantenimiento del ejército + necesidades de la población'><small class='reslab'>Gastos</small> <b id='t_exp' class='neg'>0</b> <small class='reslab'>/mes</small></span>"+
    "<span class='res' title='Balance neto FIJO (ingresos − gastos). No incluye la alcábala, que es variable.'><small class='reslab'>Balance</small> <b id='t_net'>0</b> <small class='reslab'>/mes</small></span>"+sep+
    hdr("Variable")+
    "<span class='res' title='Alcábala: 8% sobre las ventas del mercado nacional. Es VARIABLE por naturaleza, así que se acumula tick a tick y se cobra entera a fin de mes.'><small class='reslab'>Alcábala</small> <b id='t_alc' class='pos'>0</b> <small class='reslab'>acum.</small></span>"+sep+
    "<span class='res' title='Soldadesca del reino (cupo movilizable disponible)'>"+uiIcon('soldadesca')+"<b id='t_mano'>0</b></span>";
  bar.dataset.built="1";
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
  // Resumen de tesorería (ducados). Ingreso/gasto FIJO en vivo (refleja tus decisiones al instante), de la
  // misma fuente que la Tesorería; la ALCÁBALA (variable) va aparte como acumulado del mes.
  let inc=0,exp=0;
  for(const it of nationLedger(S.player)){if(it.res!=="dinero")continue;if(it.amt>=0)inc+=it.amt;else exp+=it.amt}
  inc*=MONTH_TICKS;exp*=MONTH_TICKS;const net=inc+exp;
  const setV=(id,txt,cls)=>{const el=document.getElementById(id);if(!el)return;el.textContent=txt;if(cls!=null)el.className=cls};
  setV("t_duc",fmt(tsyAvail(S.player,"dinero")));
  setV("t_inc","+"+fmt(inc),"pos");
  setV("t_exp",(exp<-0.5?"−":"")+fmt(Math.abs(exp)),"neg");
  setV("t_net",(net>=0?"+":"−")+fmt(Math.abs(net)),net<0?"neg":"pos");
  setV("t_alc","+"+fmt(S.tsyAlc||0),"pos");
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
const VOC_CATS=[["cereal","🌾","Cereal"],["cultivo","🍇","Cultivo"],["ganado","🐑","Ganadería"],
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
     (p.duchy>=0&&S.duchies[p.duchy]?" <span style='color:#5c636b'>|</span> "+uiIcon('ducado')+" "+S.duchies[p.duchy].name:"")+
     ((S.player>=0&&p.owner!==S.player&&p.owner<NPLAY&&S.nations[p.owner]&&S.nations[p.owner].alive)
       ?" <button class='bbtn sm' onclick='openDiplo("+p.owner+")' title='Diplomacia con "+NATIONS[p.owner].name+"'>🕊 Diplomacia</button>":"")+"</div>";
  if(isOccupied(p))s+="<div class='tl' style='color:#e0a17a'>⚔ Ocupada por <span class='chip' style='background:"+NATIONS[p.occupier].color+"'></span> "+NATIONS[p.occupier].name+"</div>";
  const good=p.urban?("Ciudad"+(p.resType?" · "+RES_LABEL[p.resType]:"")):(p.resType?RES_LABEL[p.resType]:"Sin especial");
  s+="<div class='tl'>"+(p.resType?resImg(p.resType)+" ":"")+good+"</div>";
  s+=terrainVocationHTML(p);
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
  s+=siegeLine(p); // la despensa/cosecha se muestra ahora en la sección "Reservas" (abajo)
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
  s+=reservesSection(p); // Reservas de grano local (categoría propia, en grano/mes como las tropas)
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
  const src=sourceableSet(); // para avisar de fábricas sin fuente de insumo (una vez por render)
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
      // ---- ciclo de vida (solo edificios YA construidos): rentabilidad + deshabilitar/reactivar + barra de condición ----
      const off=lvl>0&&!!(p.bOff&&p.bOff[b]);
      let ctrl="";
      if(lvl>0){
        const isEco=!!(B.fx&&(B.fx.prodAdd||B.fx.goldAdd))||!!B.inputs;
        const prof=isEco?buildingProfit(p,b):null;
        const profTxt=prof!=null?"<span class='"+(prof>=0?"pos":"neg")+"' style='font-weight:bold'>"+(prof>=0?"+":"−")+fmt(Math.abs(prof))+"🪙/mes</span>":"<span></span>";
        const bs="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px;margin-top:5px;padding:3px 7px;border-radius:5px;cursor:pointer;";
        if(off){
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
      // hint de FÁBRICAS: aviso si el insumo no tiene fuente (gate), o rentabilidad esperada del próximo nivel
      let hint="";
      const isFact=!!(B.inputs||(B.fx&&B.fx.prodAdd));
      if(isFact&&!maxed&&!inQ){
        if(B.inputs&&!inputsSourceable(b,src))
          hint="<div style='font-size:10px;color:#d0913a'>⚠ sin fuente de "+Object.keys(B.inputs).filter(k=>!src.has(k)).map(k=>RES_LABEL[k]||k).join("/")+"</div>";
        else{const ep=Math.round(buildingProfit(p,b,lvl+1));
          hint="<div style='font-size:10px;color:"+(ep>=0?"#8aa478":"#c9776a")+"'>≈ "+(ep>=0?"+":"−")+fmt(Math.abs(ep))+"🪙/mes "+(lvl>0?"el sig. nivel":"si la construyes")+"</div>";}
      }
      tiles+="<div class='"+cls+"'"+onclick+(off?" style='opacity:.62'":"")+" data-tip=\""+ta(B.desc)+"\">"+
        "<img class='bic' src='assets/buildings/"+b+".png' alt='"+B.label+"' title='"+B.label+"' onerror=\"this.replaceWith(bemoji('"+B.icon+"'))\">"+
        "<div class='th'><span class='nm'>"+B.label+"</span>"+lvBadge+"</div>"+
        "<div class='ben'>"+benefitHTML(p,b)+jobsHtml+hint+"</div>"+ctrl+
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
      const dis=!canAfford(S.player,{dinero:800,materiales:1200});
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
  const tabs=[["build","trabajo","Construir"],["roads","caminos","Caminos"],["army","espadas","Ejércitos"],["prosp","poblacion","Prosperidad"]];
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
  else if(S.provTab==="prosp")body=prosperityWinHTML(p);
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
    h+=tsyTotal("Balance neto (fijo)",tsySum(dm),"dinero");
    // la ALCÁBALA (variable) no entra en el balance fijo: se acumula el mes y se cobra al cierre
    if((S.tsyAlc||0)>0.5)h+="<div class='trow' style='margin-top:6px;border-top:1px solid #3a4047;padding-top:6px'>"+
      "<span>⏳ Alcábala acumulada <small style='color:#7a828b'>· se cobra a fin de mes</small></span>"+
      "<b class='pos'>+"+n1(S.tsyAlc)+" "+resImg('dinero')+"</b></div>";
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
  const inv=items.filter(x=>x.res!=="dinero"),path=S.treasuryPath;
  let h="";
  if(path.length===0){
    const byRes=tsyAgg(inv,"res");
    h+="<div class='trow thead'><span>Recurso</span><span>Stock · balance/mes</span></div>";
    let any=false;
    const rowOf=k=>{
      const net=(byRes.find(r=>r.key===k)||{amt:0}).amt,stock=tsyAvail(S.player,k);
      if(Math.abs(net)<0.005&&stock<0.5)return"";
      any=true;
      return "<div class='trow click' onclick=\"treasuryDrill('"+k+"')\"><span>"+resImg(k)+" "+RES_LABEL[k]+" <span class='tarrow'>›</span></span>"+
        "<b><span class='tstock'>"+fmt(stock)+"</span> <span class='"+(net<0?"neg":"pos")+"'>"+(net>=0?"+":"")+n1(net)+"</span></b></div>";
    };
    // agrupado POR CATEGORÍA (cereal, cultivo, ganadería, bosque, minería, mar, manufacturas, comercio)
    for(const[cat,ico,lab]of RESCAT_META){
      const rows=RES_KEYS.filter(k=>k!=="dinero"&&RES_CAT[k]===cat).map(rowOf).filter(Boolean).join("");
      if(rows)h+="<div class='tsec'>"+ico+" "+lab+"</div>"+rows;
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
  const N=NATIONS[S.player];
  // el libro mayor rinde importes por tick; se escalan a /mes para que la magnitud y los signos
  // cuadren con el balance "/mes" del topbar (la capa de presentación mensual)
  const items=nationLedger(S.player).map(it=>({...it,amt:it.amt*MONTH_TICKS}));
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
  const ne=nationEconomy(S.player),N=NATIONS[S.player];
  let realmPop=0;for(const p of S.provs)if(p.owner===S.player&&!p.wasteland)realmPop+=p.pop||0;
  let h="<div class='mlog'><span class='sh' style='background:"+N.color+"'></span>"+
    "<div><b>"+N.name+"</b><div style='color:#9aa3ad;font-size:11px'>"+ne.provs+" provincias · "+uiIcon('poblacion')+" "+fmtPop(realmPop)+"<br>"+ne.troops+" tropas</div></div></div>";
  h+="<h3>Tesorería del reino <span style='color:#7a828b;font-weight:normal'>/mes</span></h3>";
  const bal={};for(const k of RES_KEYS)bal[k]=(ne.res[k]||0)*MONTH_TICKS; // tasa mensual EN VIVO (refleja tus decisiones al instante; alcábala suavizada)
  const kpiRow=(k,v)=>"<div class='kpi'><span>"+resImg(k)+" "+RES_LABEL[k]+"</span><span class='v "+(v<0?"neg":"pos")+"'>"+(v>=0?"+":"")+n1(v)+"</span></div>";
  let anyBal=false;
  if(Math.abs(bal.dinero||0)>0.05){h+=kpiRow("dinero",bal.dinero);anyBal=true;} // Ducados primero (ingreso FIJO)
  if((S.tsyAlc||0)>0.5){h+="<div class='kpi'><span>⏳ Alcábala <small style='color:#7a828b'>acum.</small></span><span class='v pos'>+"+n1(S.tsyAlc)+"</span></div>";anyBal=true;} // variable: se cobra a fin de mes
  for(const[cat,ico,lab]of RESCAT_META){ // el resto AGRUPADO por categoría
    const ks=RES_KEYS.filter(k=>k!=="dinero"&&RES_CAT[k]===cat&&Math.abs(bal[k]||0)>0.05).sort((a,b)=>bal[b]-bal[a]);
    if(!ks.length)continue;
    anyBal=true;
    h+="<div class='kpicat'>"+ico+" "+lab+"</div>";
    for(const k of ks)h+=kpiRow(k,bal[k]);
  }
  if(!anyBal)h+="<div class='kpi'><span class='dim' style='color:#7a828b'>Sin balance neto.</span></div>";
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
     "<b class='statv' id='supLoc' data-tip=\""+ta(ltip)+"\"><span class='n'>"+n1(localM)+"</span> "+resImg('comida')+"/mes</b>"+
     "<b class='statv' data-tip=\""+ta("De las arcas NACIONALES: "+n1(natM)+" grano/mes\nSale del Grano del tesoro del reino.")+"\" id='supNat'><span class='n'>"+n1(natM)+"</span> "+resImg('comida')+"/mes</b></div>";
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
// Desglose de la relación como texto para el tooltip ("Frontera −10 · Insultos −8 · Conquista (rencor) −24").
function relTip(a,b){
  const bd=relBreakdown(a,b);
  if(!bd.length)return "Sin tensión ni concordia (0)";
  return bd.map(x=>x.label+" "+(x.v>0?"+":"−")+Math.abs(Math.round(x.v))).join(" · ");
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
    // ingreso /mes para comparar naciones: fijo + alcábala PROYECTADA (aquí sí, como tasa, porque no hay acumulado por nación)
    const income=((nationEconomy(n).res.dinero||0)+(S.nations[n].alcabalaRate||0))*MONTH_TICKS;
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
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver sus estamentos.</p>";return}
  const N=NATIONS[S.player],NA=S.nations[S.player];
  const cnt={};let pop=0;for(const k of STRATA)cnt[k]=0;
  const owned={corona:{}};for(const k of STRATA)owned[k]={}; // edificios (niveles) por dueño
  for(const p of S.provs){
    if(p.owner!==S.player||p.wasteland||isOccupied(p))continue;
    pop+=p.pop||0;
    if(p.pops)for(const k of STRATA)cnt[k]+=p.pops[k]||0;
    for(const b in p.buildings){const lv=p.buildings[b]||0;if(!lv)continue;const o=(p.bOwner&&p.bOwner[b])||"corona";if(owned[o])owned[o][b]=(owned[o][b]||0)+lv}
  }
  const wl=(NA&&NA.sWealth)||{}, mkt=(NA&&NA.mkt)||{};
  const nf=v=>Math.round(v).toLocaleString("es-ES");
  let h="<div class='tsyhead'><span class='chip' style='background:"+N.color+"'></span> "+N.name+" · "+nf(pop)+" hab.</div>";
  h+="<div style='display:flex;font-size:10px;color:#7a828b;margin:8px 2px 3px'><span style='flex:1'></span><span style='width:88px;text-align:right'>habitantes</span><span style='width:52px;text-align:right'>%</span><span style='width:78px;text-align:right'>riqueza 🪙</span></div>";
  for(const k of STRATA){
    const info=STRATA_INFO[k],c=cnt[k],pct=pop>0?100*c/pop:0;
    h+="<div style='margin-bottom:8px'>"+
       "<div style='display:flex;align-items:center;gap:7px;font-size:13px'>"+
         "<span style='font-size:16px'>"+info.icon+"</span>"+
         "<b style='flex:1'>"+info.label+"</b>"+
         "<span style='color:var(--txt);width:88px;text-align:right'>"+nf(c)+"</span>"+
         "<span style='color:#9aa3ad;width:52px;text-align:right'>"+pct.toFixed(1)+"%</span>"+
         "<span style='color:var(--title);width:78px;text-align:right'>"+nf(wl[k]||0)+"</span>"+
       "</div>"+
       "<div style='height:6px;background:#2a2f36;border-radius:3px;margin-top:3px;overflow:hidden'>"+
         "<div style='height:100%;width:"+pct.toFixed(1)+"%;background:"+N.color+"'></div>"+
       "</div>";
    // reservas de bienes + edificios que POSEE el estamento (el campesino no construye)
    if(k!=="campesino"){
      const sr=(NA&&NA.sRes&&NA.sRes[k])||{};
      const resP=[];for(const g in sr)if(sr[g]>1)resP.push((RES_ICON[g]||RES_LABEL[g]||g)+" "+nf(sr[g]));
      const ob=owned[k];let nb=0;const types=[];for(const b in ob){nb+=ob[b];types.push((BUILDINGS[b]?BUILDINGS[b].label:b)+"×"+ob[b])}
      const bTxt=nb?"🏛 "+nb+" edificios <span style='color:#7a828b'>("+types.slice(0,6).join(", ")+(types.length>6?"…":"")+")</span>":"🏛 sin edificios";
      h+="<div style='font-size:11px;color:#9aa3ad;margin-top:2px;padding-left:23px'>"+bTxt+"</div>";
      if(resP.length)h+="<div style='font-size:11px;color:#7a828b;padding-left:23px'>📦 "+resP.join(" · ")+"</div>";
    }
    // DESGLOSE de flujos de riqueza del estamento (mes en curso): de dónde entra y en qué se gasta
    const fl=(S.sFlow&&S.sFlow[k])||{};
    const cats=Object.keys(fl).filter(c=>Math.abs(fl[c])>0.5).sort((a,b)=>Math.abs(fl[b])-Math.abs(fl[a]));
    if(cats.length){
      let net=0;for(const c of cats)net+=fl[c];
      h+="<div style='padding-left:23px;margin-top:4px'>"+
         "<div style='font-size:9px;color:#7a828b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px'>Flujo este mes</div>";
      for(const c of cats)h+="<div style='display:flex;font-size:11px;justify-content:space-between;gap:8px'>"+
        "<span style='color:#9aa3ad'>"+c+"</span><span style='color:"+(fl[c]<0?"var(--neg)":"var(--pos)")+"'>"+(fl[c]>=0?"+":"−")+nf(Math.abs(fl[c]))+"</span></div>";
      h+="<div style='display:flex;font-size:11px;justify-content:space-between;gap:8px;border-top:1px solid #3a4047;margin-top:2px;padding-top:2px'>"+
        "<span style='color:#c9c2ae'>Neto del mes</span><span style='color:"+(net<0?"var(--neg)":"var(--pos)")+"'>"+(net>=0?"+":"−")+nf(Math.abs(net))+" 🪙</span></div></div>";
    }
    // DESGLOSE de CONSUMO por bien (qué compra el estamento en el mercado, cantidad y gasto)
    const cons=(S.sConsume&&S.sConsume[k])||{};
    const goods=Object.keys(cons).filter(g=>cons[g][1]>0.5).sort((a,b)=>cons[b][1]-cons[a][1]);
    if(goods.length){
      h+="<div style='padding-left:23px;margin-top:4px'>"+
         "<div style='font-size:9px;color:#7a828b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px'>Compra por bien (gasto · cantidad)</div>"+
         "<div style='display:flex;flex-wrap:wrap;gap:3px 12px'>";
      for(const g of goods)h+="<span style='font-size:11px;color:#c9c2ae;white-space:nowrap' title='"+(RES_LABEL[g]||g)+"'>"+
        resImg(g)+" "+nf(cons[g][1])+"🪙 <span style='color:#7a828b'>("+nf(cons[g][0])+")</span></span>";
      h+="</div></div>";
    }
    h+="</div>";
  }
  h+="<p style='color:#7a828b;font-size:11px;margin-top:10px;text-align:center'>Los estratos ganan por su rol, comen y compran sus lujos. El comercio de bienes vive ahora en la ventana <b>🏪 Mercado</b>.</p>";
  body.innerHTML=h;
}
// ---- Mercado del reino (ventana propia): comercio de bienes, precios, oferta/demanda interna y exterior ----
function refreshMercado(){
  const ov=document.getElementById("mercadoOverlay");
  if(!ov||ov.style.display!=="flex")return;
  const body=document.getElementById("mercadoBody");
  if(S.player<0){body.innerHTML="<p style='text-align:center;color:#9aa3ad'>Estás en modo observador. Toma el mando de una nación (desde el <b>Registro</b>) para ver su mercado.</p>";return}
  const N=NATIONS[S.player],NA=S.nations[S.player];
  const mkt=(NA&&NA.mkt)||{}, info=(NA&&NA.mktInfo)||{};
  const nf=v=>Math.round(v).toLocaleString("es-ES");
  const n1v=v=>Math.round(v*10)/10;
  // agregados de comercio (valor = volumen × precio; /mes, se anualiza ×12)
  const vol=S.mktVol||{}; // VOLUMEN físico del mes en curso (producido/vendido/tirado por bien; solo jugador)
  let expVal=0,impVal=0,intVal=0,expVol=0,impVol=0,intVol=0,prodVol=0,discVol=0,discVal=0;
  for(const g of MKT_TRADE){const mi=info[g]||{},pr=mi.price!=null?mi.price:MKT_PRICE[g];
    expVal+=(mi.exp||0)*pr; impVal+=(mi.imp||0)*pr; intVal+=(mi.sold||0)*pr;
    expVol+=mi.exp||0; impVol+=mi.imp||0; intVol+=mi.sold||0;
    const vg=vol[g]||{}; prodVol+=vg.prod||0; discVol+=vg.discard||0; discVal+=(vg.discard||0)*pr;}
  const bal=expVal-impVal;
  let h="<div class='tsyhead'><span class='chip' style='background:"+N.color+"'></span> "+N.name+" · comercio de bienes</div>";
  // tarjetas resumen
  const card=(lab,val,sub,col)=>"<div style='flex:1;min-width:120px;background:#20252b;border:1px solid #2f363d;border-radius:7px;padding:8px 10px'>"+
    "<div style='font-size:10px;color:#7a828b;text-transform:uppercase;letter-spacing:.4px'>"+lab+"</div>"+
    "<div style='font-size:17px;font-weight:bold;color:"+(col||"var(--txt)")+"'>"+val+"</div>"+
    "<div style='font-size:10px;color:#7a828b'>"+sub+"</div></div>";
  h+="<div style='display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px'>"+
    card("Balance comercial",(bal>=0?"+":"")+nf(bal)+"🪙",(bal>=0?"superávit":"déficit")+" /mes",bal>=0?"var(--pos)":"var(--neg)")+
    card("Exportación",nf(expVal)+"🪙",nf(expVol)+" u/mes · "+nf(expVal*12)+"🪙/año","var(--pos)")+
    card("Importación",nf(impVal)+"🪙",nf(impVol)+" u/mes · "+nf(impVal*12)+"🪙/año","#d6a15a")+
    card("Comercio interno",nf(intVal)+"🪙",nf(intVol)+" u/mes (dentro del reino)")+
    card("Producción al mercado",nf(prodVol)+" u",nf(prodVol)+" u/mes (materias del campo)")+
    card("Tirado (sobreproducción)",nf(discVol)+" u",nf(discVal)+"🪙 desperdiciado /mes",discVol>1?"var(--neg)":"#7a828b")+
    "</div>";
  // tabla por bien, agrupada en Básicos y Lujos
  const th="<div style='display:flex;font-size:10px;color:#7a828b;padding:3px 1px 2px;border-bottom:1px solid #2a2f36'>"+
    "<span style='flex:1'>bien</span><span style='width:60px;text-align:right'>precio</span><span style='width:58px;text-align:right'>stock</span>"+
    "<span style='width:60px;text-align:right'>producido</span><span style='width:62px;text-align:right'>demanda</span><span style='width:58px;text-align:right'>vendido</span>"+
    "<span style='width:56px;text-align:right' title='producido por encima del tope de inventario = sobreproducción tirada'>tirado</span>"+
    "<span style='width:52px;text-align:right'>exporta</span><span style='width:52px;text-align:right'>importa</span></div>";
  const rowFor=g=>{
    const mi=info[g]||{}, price=mi.price!=null?mi.price:MKT_PRICE[g], ref=MKT_PRICE[g];
    const dev=ref>0?Math.round((price/ref-1)*100):0;
    const pcol=price>ref*1.05?"var(--neg)":(price<ref*0.95?"var(--pos)":"#9aa3ad");
    const expTxt=(mi.exp>1)?"<span style='color:var(--pos)'>↗"+nf(mi.exp)+"</span>":"<span style='color:#5a6470'>—</span>";
    const impTxt=(mi.imp>1)?"<span style='color:#d6a15a'>↙"+nf(mi.imp)+"</span>":"<span style='color:#5a6470'>—</span>";
    const vg=vol[g]||{}, prodTxt=(vg.prod>1)?nf(vg.prod):"<span style='color:#5a6470'>—</span>";
    const discTxt=(vg.discard>1)?"<span style='color:var(--neg)'>"+nf(vg.discard)+"</span>":"<span style='color:#5a6470'>—</span>";
    return "<div style='display:flex;align-items:center;font-size:12px;padding:2px 1px'>"+
      "<span style='flex:1'>"+(RES_ICON[g]||"")+" "+RES_LABEL[g]+"</span>"+
      "<span style='width:60px;text-align:right;color:"+pcol+"' title='ref. "+ref+"🪙 · "+(dev>=0?"+":"")+dev+"%'>"+n1v(price)+"🪙</span>"+
      "<span style='width:58px;text-align:right;color:var(--txt)'>"+nf(mkt[g]||0)+"</span>"+
      "<span style='width:60px;text-align:right;color:#9aa3ad'>"+prodTxt+"</span>"+
      "<span style='width:62px;text-align:right;color:#9aa3ad'>"+nf(mi.dem||0)+"</span>"+
      "<span style='width:58px;text-align:right;color:#9aa3ad'>"+nf(mi.sold||0)+"</span>"+
      "<span style='width:56px;text-align:right'>"+discTxt+"</span>"+
      "<span style='width:52px;text-align:right'>"+expTxt+"</span>"+
      "<span style='width:52px;text-align:right'>"+impTxt+"</span></div>";
  };
  // agrupado POR CATEGORÍA (cereal, cultivo, ganadería, bosque, minería, mar, manufacturas, comercio)
  const MKT_CATS=[["cereal","🌾","Cereal"],["cultivo","🍇","Cultivo"],["ganado","🐑","Ganadería"],
    ["bosque","🪵","Bosque"],["extractivo","⛏","Minería"],["mar","🐟","Mar"],
    ["manufactura","🏭","Manufacturas"],["comercio","🌶","Comercio lejano"]];
  for(const[cat,ico,lab]of MKT_CATS){
    const goods=MKT_TRADE.filter(g=>RES_CAT[g]===cat);
    if(!goods.length)continue;
    h+="<div style='margin-top:11px'><div style='font-size:12px;color:var(--title);margin-bottom:2px'>"+ico+" "+lab+"</div>"+th;
    for(const g of goods)h+=rowFor(g);
    h+="</div>";
  }
  h+="<div style='display:flex;font-size:10px;color:#7a828b;gap:14px;flex-wrap:wrap;margin-top:10px;justify-content:center'>"+
    "<span>precio en 🪙 (color: rojo caro / verde barato vs. referencia)</span><span>demanda/interno en unidades/mes</span>"+
    "<span><span style='color:var(--pos)'>↗</span> exporta a otros reinos · <span style='color:#d6a15a'>↙</span> importa (u/mes)</span></div>";
  h+="<p style='color:#7a828b;font-size:11px;margin-top:8px;text-align:center'>Los burgueses compran los bienes donde están baratos (excedente) y los venden donde están caros (déficit): el comercio hace CONVERGER los precios entre reinos.</p>";
  body.innerHTML=h;
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
  const alcInc=(N.alcabalaRate||0)*MONTH_TICKS, almInc=(N.almojRate||0)*MONTH_TICKS;
  const coronaMes=nationEconomy(n).res.dinero*MONTH_TICKS;
  const slider=(label,val,min,max,kind,info,inc)=>
    "<div style='background:#20252b;border:1px solid #2f363d;border-radius:8px;padding:11px 13px;margin-bottom:9px'>"+
      "<div style='display:flex;justify-content:space-between;align-items:baseline'>"+
        "<span style='font-weight:bold'>"+label+iInfo(info)+"</span>"+
        "<span style='font-family:monospace;font-size:15px;color:var(--title)'>"+pct(val)+"%</span></div>"+
      (inc!=null?"<div style='font-size:11px;color:#8aa478'>≈ +"+nf(inc)+"🪙/mes a la corona (variable)</div>":"")+
      "<input type='range' min='"+min+"' max='"+max+"' value='"+pct(val)+"' step='1' style='width:100%;margin-top:6px' oninput='setTax(\""+kind+"\",this.value)'></div>";
  let h="<div style='text-align:center;font-size:12px;color:#9aa3ad;margin-bottom:11px'>Ingreso fijo de la corona: <b style='color:var(--title)'>"+nf(coronaMes)+"🪙/mes</b> + comercio (abajo)</div>";
  h+=slider("🌾 Impuesto feudal",feud,2,20,"feudal","La parte de la corona del reparto feudal (sobre la producción del campesino). Histórico Castilla ~8%. Más ingreso, pero empobrece al campesino y le baja la moral.",null);
  h+=slider("🏪 Alcábala (comercio interno)",alc,0,30,"alcabala","Impuesto sobre las VENTAS del mercado interno del reino. Histórico Castilla ~10% (empezó más bajo). Ingreso variable según cuánto se comercie.",alcInc);
  h+=slider("⚓ Almojarifazgo (aduana exterior)",alm,0,60,"almoj","Aduana sobre el comercio EXTERIOR (el arbitraje entre reinos, que enriquece a los burgueses). Histórico Castilla ~5% (2,5% exportación / 5% importación). Súbelo para frenar ese enriquecimiento y financiar a la corona.",almInc);
  h+="<div style='background:#1c2026;border:1px solid #2a2f36;border-radius:8px;padding:9px 13px;margin-bottom:4px;opacity:.75'>"+
      "<div style='display:flex;justify-content:space-between;align-items:baseline'><span>⛪ Diezmo (Iglesia)"+iInfo("El 10% de la producción del campesino va al CLERO, no a la corona. Fijo: es derecho de la Iglesia.")+"</span><span style='font-family:monospace'>"+pct(DIEZMO)+"%</span></div></div>";
  body.innerHTML=h;
}
export {
  log, fmt, fmtDur, buildResBar, refreshTop, costStr, n1, fxText, costLine, renderBuildTabs, refreshBuildBar, refreshSide, refreshDiplomacy, refreshLedger, refreshReports, refreshPeace, showNationPicker, buildRealmMenu, refreshMetricsLog, refreshArmyPanel, refreshTreasury, refreshEstates, refreshMercado, refreshFiscal, refreshCouncil, refreshCoalPeace, refreshLeagues, refreshCallToArms, refreshDipModal
};
