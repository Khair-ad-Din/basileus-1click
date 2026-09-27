// estates.js — IA de OBRAS y GESTIÓN de edificios de los estamentos (y de la corona IA). Sin DOM: la usan el juego
// (sim.js, 1 vez al día) y los arneses (tools/verify-v2.mjs), así se mide lo que de verdad corre.
// Movido tal cual desde sim.js (2026-09-26); lo nuevo es budgetManage (v2): cada dueño cuadra sus cuentas.
import { NPLAY, BUILDINGS } from "./config.js";
import { S } from "./state.js";
import { BKEYS, sinkAdd, lvlOf, bOwnerOf, buildMax, usedSlots, buildSlots, freeLabor, buildJobs, JOBS_PER_LEVEL, costFor, timeFor, canAfford, pay, recFlow, isOccupied, ESTATES_BUILD, bOff, buildBlock } from "./economy.js";
import { ESTATE_BUILDS2, buildingProfit2, buildingOutput2, upkeepScale, siteOK2, crownStockOut, isMarketDay } from "./economy2.js";
// La IA de obras usa la rentabilidad y la producción de la economía (economy2.js, design/economia-v2.md)
const profitOf=(p,b,l,o)=>buildingProfit2(p,b,l,o);
const outputOf=(p,b,l)=>buildingOutput2(p,b,l);
// el dinero que un estamento gasta en obras sale de la economía → sumidero contado (invariante del dinero)
function sink2(v,cat="Obras y reparaciones"){sinkAdd(cat,v)}

/* ---- Construcción autónoma de los ESTAMENTOS (E2) ----
 * Cada estamento levanta SU tipo de edificio en las provincias donde tiene presencia, pagándolo de su
 * riqueza (compra los materiales a precio nominal). Compiten por el mismo hueco de obra que el rey (una
 * obra por provincia). Clero → iglesias + viñedos; Nobleza → industria BASE + militar; Burgués →
 * industria de LUJO + comercio/infraestructura. El dueño se fija al completar la obra (hourTick). */
// precio nominal de los insumos de obra (ducados/unidad) para que el estamento valore el coste y lo pague de su bolsillo
const BUILD_MAT_PRICE={dinero:1,materiales:1,piedra:1,metal:2,comida:0.8,pano:2.2,vino:2.2,sal:1.6,seda:5,raros:4,petroleo:2};
const INVEST_MONTHS=12; // v2: un estamento invierte solo lo que le sobra tras asegurarse un año de su cesta
const ESTATE_BUILD_KEEP=4; // colchón: solo construyen si su riqueza supera KEEP× el coste (invierten el excedente, no el principal)
function estateCostDinero(cost){let t=0;for(const k in cost)t+=cost[k]*(BUILD_MAT_PRICE[k]||1);return t}
// IA de ajuste del mercado: deshabilita las FÁBRICAS que pierden dinero (sobreoferta / insumo caro) y reactiva
// (reparando) las que vuelven a ser rentables. Histéresis (deadband) para no oscilar. Solo fábricas de producción.
const BLDG_LOSS=-120, BLDG_GAIN=100; // umbrales mensuales en ducados: tolera pérdidas pequeñas (no apagar toda una industria por poco); apaga solo lo claramente ruinoso; reactiva sobre +100/mes
const ESTATE_FILLER=250; // puntuación de la infraestructura sin ingreso directo (gremio/lonja/almacén/puerto): relleno cuando no hay fábrica más rentable
const SUPPLY_MARGIN=1.15; // la IA construye una fábrica SOLO si la oferta prevista del bien (+ talleres cerrados y EN OBRA) aún no cubre la demanda del reino × este margen
// ESCALONADO (design/precios-cadencia.md): todos los talleres de un reino ven el MISMO precio, así que con un umbral
// común se apagaban todos a la vez, la oferta se hundía, el precio saltaba a ×3 y se encendían todos otra vez (la "ola
// de telares": Lituania, 175 telares abiertos/cerrados cada ~2 meses). Ahora, cada día de mercado, cada reino cierra
// como mucho este % de sus talleres de un tipo (primero los que más pierden) y reabre igual (primero los que más ganan).
const MANAGE_SHARE=0.25;
function reopen(p,b,o,N){                                            // reactivar, reparando la parte degradada
  const cond=(p.bCond&&p.bCond[b]!=null)?p.bCond[b]:1, frac=Math.max(0,1-cond);
  if(o==="corona"){const c={},base=costFor(p,b);for(const k in base)c[k]=Math.round(base[k]*frac);
    if(canAfford(p.owner,c)){pay(p.owner,c,"Reparaciones",BUILDINGS[b].label);delete p.bOff[b];p.bCond[b]=1;}}   // (pay apunta el sumidero)
  else{const rep=estateCostDinero(costFor(p,b))*frac;
    if((N.sWealth[o]||0)>=rep){if(rep>0){N.sWealth[o]-=rep;recFlow(p.owner,o,"Construcción",-rep);sink2(rep);}delete p.bOff[b];p.bCond[b]=1;}}
}
function manageWorkshops(){
  const groups=new Map();                                            // "nación|taller" → abiertos, cerrados y candidatos
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland||isOccupied(p))continue;
    const N=S.nations[p.owner]; if(!N||!N.sWealth)continue;
    for(const b of BKEYS){
      if(!(p.buildings[b]>0))continue;
      const o=bOwnerOf(p,b); if(o==="corona"&&!N.ai)continue;       // el jugador gestiona su corona a mano
      const B=BUILDINGS[b],fx=B.fx; if(!(B.inputs||(fx&&fx.prodAdd)))continue; // solo FÁBRICAS de producción (la infra/multiplicadores no se auto-apaga)
      const k=p.owner+"|"+b; let G=groups.get(k); if(!G){G={N,open:0,closed:0,lose:[],win:[]};groups.set(k,G)}
      const prof=profitOf(p,b);
      if(!bOff(p,b)){G.open++;if(prof<BLDG_LOSS)G.lose.push({p,b,o,prof})}
      else{G.closed++;if(prof>BLDG_GAIN)G.win.push({p,b,o,prof})}
    }
  }
  for(const G of groups.values()){
    G.lose.sort((x,y)=>x.prof-y.prof);
    const nc=Math.min(G.lose.length,Math.max(1,Math.ceil(G.open*MANAGE_SHARE)));
    for(let i=0;i<nc;i++){const{p,b}=G.lose[i];(p.bOff||(p.bOff={}))[b]=true;if(!p.bCond)p.bCond={};if(p.bCond[b]==null)p.bCond[b]=1}
    G.win.sort((x,y)=>y.prof-x.prof);
    const nr=Math.min(G.win.length,Math.max(1,Math.ceil(G.closed*MANAGE_SHARE)));
    for(let i=0;i<nr;i++){const{p,b,o}=G.win[i];reopen(p,b,o,G.N)}
  }
}
// ¿Hace falta MÁS capacidad de un bien en un reino? La OFERTA PREVISTA cuenta todo lo que llega a la plaza (campo,
// artesanos, importación: la previsión semanal de economy2) más los talleres CERRADOS y EN OBRA (que se pueden abrir o
// están al llegar). Antes solo se miraba la producción del día: en la fase en que los talleres estaban cerrados parecía
// que faltaba y se construían más (Lituania: 175 telares, 3× la demanda de paño).
let _need=null;                                                      // por reino: {sup, dem} al mes, del último día de mercado
function needMore(n,g){
  const x=_need&&_need[n]&&_need[n][g];
  if(!x){const mi=S.nations[n].mktInfo&&S.nations[n].mktInfo[g];return !mi||(mi.prod||0)<(mi.dem||0)*SUPPLY_MARGIN} // sin previsión aún
  return x.sup<x.dem*SUPPLY_MARGIN;
}
function pickEstateBuild(p,e,N){ // el edificio del repertorio del estamento MÁS RENTABLE que aún HAGA FALTA aquí
  let best=null,bestScore=-Infinity;
  if(usedSlots(p)>=buildSlots(p))return null;              // sin hueco (se miraba por candidato; no cambia dentro)
  for(const b of ESTATE_BUILDS2[e]){
    if(lvlOf(p,b)>0&&bOwnerOf(p,b)!==e)continue;          // ya existe y es de otro (o de la corona) → no lo toco
    if(lvlOf(p,b)>=buildMax(p,b))continue;
    const B=BUILDINGS[b];
    if(B.coastal&&!p.coastal)continue;
    if(B.urban&&!p.urban)continue;
    if(B.resReq&&p.resType!==B.resReq)continue;
    if(!siteOK2(p,b))continue;                            // el taller va donde está su materia
    if(B.req){let ok=true;for(const r in B.req)if(lvlOf(p,r)<B.req[r]){ok=false;break}if(!ok)continue}
    const fx=B.fx,economic=fx.prodAdd||fx.goldAdd||fx.prodMul; // productivos: solo donde se pueda dotar
    if(economic&&freeLabor(p)<buildJobs(p)+JOBS_PER_LEVEL)continue;
    // solo invierten el EXCEDENTE: guardan un colchón (KEEP× el coste) para seguir comiendo y no arruinarse
    if(N.sWealth[e]<estateCostDinero(costFor(p,b))*ESTATE_BUILD_KEEP)continue;
    if(N.e2&&N.e2.basket&&N.sWealth[e]<estateCostDinero(costFor(p,b))*ESTATE_BUILD_KEEP+INVEST_MONTHS*(N.e2.basket[e]||0))continue; // v2: primero su año de cesta
    // PREVISIÓN DE DEMANDA: ¿la capacidad (construida + EN OBRA) del bien ya cubre la demanda del reino? entonces NO hace
    // falta otra fábrica (aunque el precio siga alto por el lag de obra). Así la IA calcula cuántas hacen falta y no se pasa.
    const outG=outputOf(p,b,1).g; // el bien que de verdad vende (cervecería → bebida)
    if(outG&&!needMore(p.owner,outG))continue;
    // PUNTUAR por RENTABILIDAD y elegir la mejor: fábricas/comercio por su beneficio mensual esperado (skip si no renta);
    // la infra sin ingreso directo (gremio/lonja/almacén/puerto), relleno de baja prioridad. Así, entre lo que hace falta,
    // la IA persigue lo más escaso/caro (p.ej. fustán) → completa las cadenas donde de verdad hacen falta.
    let score;
    if(B.inputs||fx.prodAdd||fx.goldAdd){ score=profitOf(p,b,lvlOf(p,b)+1); if(score<=0)continue; }
    else{ // servicio sin ingreso (fortaleza, templo, catedral…): en v2 solo si puede MANTENERLO mucho tiempo (si no, lo cerraría enseguida)
      {const upM=(B.up&&B.up.dinero?B.up.dinero/12*730*upkeepScale(p,b):0), own=ownerUpkeepMonth(p.owner,e);
        if(N.sWealth[e]<REOPEN_MONTHS*(own+upM)||((N.budTr&&N.budTr[e]&&N.budTr[e].d)||0)<0)continue}
      score=ESTATE_FILLER;}
    if(score>bestScore){bestScore=score;best=b;}
  }
  return best;
}
/* ---- Obras de la CORONA IA (v2): la MISMA lógica que los estamentos ----
 * Mismos filtros (sitio de la materia, hueco, dotación, requisitos), mismo colchón (solo invierte si su tesoro supera
 * ESTATE_BUILD_KEEP× el coste), misma previsión de demanda para lo que VENDE y misma rentabilidad (buildingProfit2 con
 * owner "corona": lo que va a su almacén vale solo si le hace falta). Los servicios (cuartel, fortaleza, templo…) solo
 * si puede mantenerlos holgado, como un estamento. Antes era una lista fija de prioridades (mercado, gremio, granja…). */
const CROWN_BUILDS2=["cuartel","fortaleza","templo","puerto","almacen","gremio","granja","aserradero","cantera","mina",
  "minaPlata","minaOro","yeguada","salina","pesqueria"];
function pickCrownBuild(p){
  const n=p.owner,N=S.nations[n]; if(!N)return null;
  const treas=N.res.dinero||0, up=ownerUpkeepMonth(n,"corona"), inc=(N.e2&&N.e2.inc&&N.e2.inc.corona)||0;
  let best=null,bestScore=-Infinity;
  for(const b of CROWN_BUILDS2){
    if(!BUILDINGS[b])continue;
    if(lvlOf(p,b)>0&&bOwnerOf(p,b)!=="corona")continue;  // es de un estamento: no lo toco
    if(buildBlock(p,b))continue;                          // máximo, obra en curso, costa, ciudad, yacimiento, hueco, requisitos, fondos
    if(!siteOK2(p,b))continue;                            // el taller va donde está su materia
    const B=BUILDINGS[b],fx=B.fx||{},economic=fx.prodAdd||fx.goldAdd||fx.prodMul;
    if(economic&&freeLabor(p)<buildJobs(p)+JOBS_PER_LEVEL)continue;
    if(treas<(costFor(p,b).dinero||0)*ESTATE_BUILD_KEEP)continue; // mismo colchón que un estamento
    let score;
    if(B.inputs||fx.prodAdd){
      if(!crownStockOut(p,b,1)){const g=buildingOutput2(p,b,1).g;   // lo que VENDE: ¿hace falta más?
        if(g&&!needMore(n,g))continue}
      score=buildingProfit2(p,b,lvlOf(p,b)+1,"corona"); if(score<=0)continue;
    }else{
      const upM=(B.up&&B.up.dinero?B.up.dinero/12*730*upkeepScale(p,b):0);
      if(treas<REOPEN_MONTHS*(up+upM)||inc-up-upM<0)continue;   // solo si puede mantenerlo holgado
      score=ESTATE_FILLER;
    }
    if(score>bestScore){bestScore=score;best=b}
  }
  return best;
}
function estateBuild(){
  manageWorkshops();                                   // primero se cierra/reabre lo que pierde/gana (escalonado)
  // por reino: oferta PREVISTA de cada bien (lo que llega a la plaza + talleres cerrados + en obra) y su demanda, al mes
  const M=730/24, cl=Array.from({length:NPLAY},()=>({}));   // cl: capacidad de talleres CERRADOS y EN OBRA
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland)continue; const n=p.owner;
    for(const b of BKEYS){if(!(p.buildings[b]>0)||!bOff(p,b))continue;const o=outputOf(p,b);if(o.g)cl[n][o.g]=(cl[n][o.g]||0)+o.q;}
    if(p.buildQueue)for(const q of p.buildQueue){const o=outputOf(p,q.b,1);if(o.g)cl[n][o.g]=(cl[n][o.g]||0)+o.q;}
  }
  _need=Array.from({length:NPLAY},()=>null);
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];const fc=N&&N.e2&&N.e2.fc;if(!fc)continue;const o={};
    for(const g in fc.d)o[g]={sup:(fc.s[g]||0)*M+(cl[n][g]||0),dem:(fc.d[g]||0)*M};_need[n]=o}
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland||isOccupied(p))continue;
    const N=S.nations[p.owner];if(!N||!N.sWealth)continue;
    if(p.buildQueue.length||usedSlots(p)>=buildSlots(p)||!p.pops)continue; // ya no CONSTRUIR más aquí (pero la auto-gestión de arriba sí corre)
    // el estamento con MÁS presencia (población) en la provincia intenta primero
    const order=ESTATES_BUILD.slice().sort((a,b)=>(p.pops[b]||0)-(p.pops[a]||0));
    for(const e of order){
      if(!(p.pops[e]>0))continue;                        // sin presencia, no construye aquí
      const b=pickEstateBuild(p,e,N);
      if(!b)continue;
      const bcost=estateCostDinero(costFor(p,b));
      N.sWealth[e]-=bcost;recFlow(p.owner,e,"Construcción",-bcost);sink2(bcost);      // paga la obra de su riqueza
      p.buildQueue.push({b,hoursLeft:timeFor(p,b),owner:e});
      const o=outputOf(p,b,1),x=o.g&&_need[p.owner]&&_need[p.owner][o.g];if(x)x.sup+=o.q; // suma la capacidad recién encolada → las demás provincias ya la cuentan (no todas construyen lo mismo a la vez)
      break;                                             // una obra por provincia
    }
  }
}

/* ---- GESTIÓN POR PRESUPUESTO (v2) ----
 * Nadie quiebra por mantener lo que no puede pagar. Cada dueño (burgués, clero, nobleza y la corona si es IA; el
 * jugador gestiona la suya) mira cada día su caja: si baja de BUDGET_MONTHS meses de mantenimiento Y sigue perdiendo
 * dinero, CIERRA el edificio que menos le rinde (primero las fábricas con pérdidas y los servicios que solo cuestan:
 * cuartel, templo, fortaleza; una fábrica que gana solo se cierra si ya no queda caja). Lo cerrado no paga
 * mantenimiento, se degrada y en ~4 años se demuele nivel a nivel (degradeBuildings). Si vuelve a ir HOLGADO,
 * reabre (reparando) el servicio cerrado; las fábricas las reabre manageWorkshops (el día de mercado) cuando vuelven a ganar. */
const BUDGET_MONTHS=3;    // reserva deseada: meses de mantenimiento en caja
const REOPEN_MONTHS=9;    // holgura (meses de mantenimiento en caja) para que un estamento levante un servicio nuevo
const REOPEN_SHARE=0.2;   // reabre un servicio cerrado si, pagándolo, aún le sobra este % de su ingreso
const TREND_K=0.1;        // ritmo de la media de la variación diaria de la caja (~10 días)
// mantenimiento mensual (dinero) de todo lo ABIERTO de un dueño en una nación (lo usa la IA de obras antes de sumar otro servicio)
let _upC=null,_upH=-1;
function ownerUpkeepMonth(n,o){ // (una pasada por día, cacheada)
  if(_upH!==S.hour||!_upC){_upH=S.hour;_upC=new Map();
    for(const p of S.provs){if(p.owner>=NPLAY)continue;for(const b of BKEYS)if(p.buildings[b]>0&&!bOff(p,b)){const k=p.owner+"|"+bOwnerOf(p,b);_upC.set(k,(_upC.get(k)||0)+upkeepMonth(p,b))}}}
  return _upC.get(n+"|"+o)||0;
}
function upkeepMonth(p,b){const u=BUILDINGS[b].up;return u&&u.dinero?u.dinero/12*(p.buildings[b]||0)*730*upkeepScale(p,b):0}
function purseOf(N,o){return o==="corona"?(N.res.dinero||0):(N.sWealth[o]||0)}
function isProductive(b){const B=BUILDINGS[b];return !!(B.inputs||(B.fx&&(B.fx.prodAdd||B.fx.goldAdd)))}
function budgetManage(){
  const inv=new Map();                                   // "nación|dueño" → {mantenimiento abierto/mes, abiertos, cerrados}
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland)continue; const N=S.nations[p.owner]; if(!N||!N.alive||!N.sWealth)continue;
    for(const b of BKEYS){
      if(!(p.buildings[b]>0))continue; const o=bOwnerOf(p,b);
      if(o==="corona"&&!N.ai)continue;                   // la corona del jugador la gestiona él
      const k=p.owner+"|"+o; let e=inv.get(k); if(!e){e={n:p.owner,o,up:0,open:[],closed:[]};inv.set(k,e)}
      const prod=isProductive(b), up=upkeepMonth(p,b), val=prod?profitOf(p,b):-up;
      if(bOff(p,b))e.closed.push({p,b,val,up,prod}); else{e.up+=up;e.open.push({p,b,val,up,prod})}
    }
  }
  for(const e of inv.values()){
    const N=S.nations[e.n], purse=purseOf(N,e.o);
    const tr=N.budTr||(N.budTr={}), t=tr[e.o]||(tr[e.o]={prev:purse,d:0});
    t.d+=((purse-t.prev)-t.d)*TREND_K; t.prev=purse;     // tendencia de la caja (ducados/día)
    // CUENTAS DEL MES: lo que le entra − lo que le cuesta comer (subsistencia) − el mantenimiento de lo abierto.
    // La vida diaria y el lujo NO cuentan: se ajustan solos (se compran con lo que sobra). Se cierra solo si no llega.
    const inc=(N.e2&&N.e2.inc&&N.e2.inc[e.o])||0, subs=(e.o==="corona"||!N.e2||!N.e2.subsCost)?0:(N.e2.subsCost[e.o]||0);
    const margin=inc-subs-e.up;
    const broke=margin<0&&purse<BUDGET_MONTHS*e.up;
    if(broke&&e.open.length){                            // no le llega: cierra lo que menos le rinde
      let x=null;for(const c of e.open)if(!x||c.val<x.val)x=c;
      if(x.val<0||purse<=0){(x.p.bOff||(x.p.bOff={}))[x.b]=true;if(!x.p.bCond)x.p.bCond={};if(x.p.bCond[x.b]==null)x.p.bCond[x.b]=1;
        (N.budLog||(N.budLog=[])).push({h:S.hour,o:e.o,b:x.b,p:x.p.id,act:"cierra"})}
    } else if(e.closed.length){                          // le sobra: reabre el servicio cerrado más barato si su margen lo cubre holgado
      let x=null;for(const c of e.closed)if(!c.prod&&(!x||c.up<x.up))x=c;
      if(x&&margin-x.up>REOPEN_SHARE*inc&&purse>BUDGET_MONTHS*(e.up+x.up)){
        const cond=(x.p.bCond&&x.p.bCond[x.b]!=null)?x.p.bCond[x.b]:1, frac=Math.max(0,1-cond);
        if(e.o==="corona"){const c={},base=costFor(x.p,x.b);for(const k in base)c[k]=Math.round(base[k]*frac);
          if(!canAfford(e.n,c))continue; pay(e.n,c,"Reparaciones",BUILDINGS[x.b].label);}   // (pay apunta el sumidero)
        else{const rep=estateCostDinero(costFor(x.p,x.b))*frac; if(N.sWealth[e.o]<rep)continue;
          if(rep>0){N.sWealth[e.o]-=rep;recFlow(e.n,e.o,"Construcción",-rep);sink2(rep)}}
        delete x.p.bOff[x.b]; x.p.bCond[x.b]=1;
        (N.budLog||(N.budLog=[])).push({h:S.hour,o:e.o,b:x.b,p:x.p.id,act:"reabre"})
      }
    }
  }
}

// Lo que los dueños hacen CADA DÍA: el presupuesto (cerrar lo que no pueden pagar) a diario; las obras y el
// cierre/reapertura de talleres por rentabilidad, el DÍA DE MERCADO (semanal), con el precio ya fijado para la semana.
// Lo llaman el juego (sim.js) y el arnés (tools/verify-v2.mjs): así se mide lo mismo que corre.
function estatesDaily(){
  if(isMarketDay())estateBuild();
  budgetManage();
}

export { estatesDaily, estateBuild, pickCrownBuild, budgetManage, manageWorkshops, pickEstateBuild, estateCostDinero, profitOf, outputOf,
  BUILD_MAT_PRICE, BUDGET_MONTHS };
