// sim.js
import { BUILDINGS, GARR_CITADEL, GARR_FORT, GARR_MIN, GOLD_PER_WS, LEVY_RAISE_HOURS, NATIONS, NEUTRAL, NPLAY, RES_KEYS, SIEGE_BASE_H, START_STOCK, TERRAINS, UNITS, WAR_LOCK_HOURS, WS_BATTLE, WS_DUCHY_BASE, WS_DUCHY_PER } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyDef, armyHp, armySpd, buildBlock, buildJobs, buildMax, canAfford, costFor, economyTick, foodCap, freeLabor, isOccupied, JOBS_PER_LEVEL, lvlOf, moraleGrowth, MORALE_HOSTILE, MORALE_MIN, nationProvCount, nationStrength, pay, provDefMul, recruitTime, soldAvail, soldCap, timeFor } from "./economy.js";
import { buildDuchies, hasRoad, isDuchyCap, kmBetween, roadKey } from "./mapgen.js";
import { drawRoads, paintBorders, repaintProvince } from "./render.js";
import { saveGame } from "./save.js";
import { log, refreshBuildBar, refreshSide, refreshTop } from "./ui.js";

// El núcleo económico/demográfico del tick vive en economy.js (economyTick), sin DOM, para
// compartirlo con el arnés de análisis. Aquí quedan lo militar, la construcción y el movimiento.

function setupNations(){
  S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
    ai:true,capital:-1,alive:!n.neutral,lastAI:0,startProvs:0}));
  // sembrar la soldadesca (cupo movilizable) y la despensa (almacén de comida) iniciales
  for(const p of S.provs)if(!p.wasteland){if(p.owner<NPLAY)p.sold=soldCap(p);p.food=foodCap(p)*0.6}
  // capitales históricas (marcadas por las ciudades del mapa) y tropas iniciales
  for(let n=0;n<NPLAY;n++){
    let cap=-1;
    for(const p of S.provs)if(p.owner===n&&p.capital){cap=p.id;break}
    if(cap<0)for(const p of S.provs)if(p.owner===n){cap=p.id;p.capital=true;break}
    S.nations[n].capital=cap;
    if(cap<0){S.nations[n].alive=false;continue}
    S.nations[n].startProvs=nationProvCount(n);
    const c=S.provs[cap];
    c.buildings.cuartel=1;c.morale=85;
    // grueso medieval: el ejército inicial son LEVAS, con un núcleo profesional pequeño
    const start={miliciano:3,infanteria:1};
    if(S.nations[n].startProvs>=12)start.blindadoLigero=1; // las grandes potencias, algo de caballería
    spawnArmy(n,cap,start);
  }
  for(const p of S.provs)if(p.owner<NPLAY)p.morale=75;
  // tropas territoriales concentradas: cada nación arranca con 3 formaciones como máximo
  // (capital + hasta dos cuerpos en los extremos del reino), sin unidades sueltas
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const cap=S.nations[n].capital;
    const capP=S.provs[cap];
    const owned=S.provs.filter(p=>p.owner===n&&!p.capital);
    const T=Math.round(owned.length/3); // misma masa total que el antiguo reparto disperso
    if(T<=0)continue;
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const posts=[];
    if(owned.length>=3){
      let far=null,fd=-1;
      for(const p of owned){const d=dist(p,capP);if(d>fd){fd=d;far=p}}
      posts.push(far);
      if(owned.length>=8){
        let far2=null,fd2=-1;
        for(const p of owned){
          if(p===far)continue;
          const d=Math.min(dist(p,capP),dist(p,far));
          if(d>fd2){fd2=d;far2=p}
        }
        if(far2)posts.push(far2);
      }
    }
    if(!posts.length||T<2){
      // nación pequeña: el refuerzo (levas) se integra en el ejército de la capital
      const a=S.armies.find(x=>x.nation===n&&x.prov===cap);
      if(a)a.units.miliciano=(a.units.miliciano||0)+T;
    }else if(posts.length===1){
      spawnArmy(n,posts[0].id,{miliciano:T});
    }else{
      const h=Math.ceil(T/2);
      spawnArmy(n,posts[0].id,{miliciano:h});
      spawnArmy(n,posts[1].id,{miliciano:T-h});
    }
  }
  // ducados: subdivisión de iure del mapa (unidad de conquista). Determinista, tras fijar capitales.
  buildDuchies();
}
function spawnArmy(nation,prov,units){
  // a.src = mapa provincia->pops que la componen (para que las bajas resten pop a su origen)
  const src={};
  let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  if(w>0)src[prov]=w;
  const a={id:S.armyIdSeq++,nation,prov,units:Object.assign({},units),src,path:[],legDone:0,legTotal:0};
  S.armies.push(a);
  return a;
}
function tryRoad(a,b){
  const cost={dinero:800,materiales:1200};
  if(S.provs[a].owner!==S.player||S.provs[b].owner!==S.player)return;
  if(hasRoad(a,b)||S.roadQueue.some(q=>q.key===roadKey(a,b)))return;
  if(!canAfford(S.player,cost))return;
  pay(S.player,cost);
  S.roadQueue.push({key:roadKey(a,b),hoursLeft:4320,nation:S.player}); // 6 meses de obra
  refreshSide();refreshTop();
}
// "Informes Reales": crónica mundial de sucesos (guerras, paces, plazas, reinos caídos, batallas).
// who = naciones implicadas (para resaltar lo que toca al jugador). Se acumula y se cap a 150.
function report(icon,text,who){
  S.reports.push({hour:S.hour,icon,text,who:who||null});
  if(S.reports.length>150)S.reports.shift();
}
// ===== Guerras con warscore (estilo EU4). S.wars es un Map key "a|b" (a<b) -> objeto guerra
// {a,b,start,tA,tB} donde tA/tB son los puntos de batalla acumulados por cada bando. =====
function warKey(a,b){return a<b?a+"|"+b:b+"|"+a}
function getWar(a,b){return S.wars.get(warKey(a,b))}
function atWar(a,b){
  if(a===b)return false;
  if(a===NEUTRAL||b===NEUTRAL)return true;
  return S.wars.has(warKey(a,b));
}
function declareWar(a,b){
  if(a===NEUTRAL||b===NEUTRAL||a===b||atWar(a,b))return;
  if(S.hour<WAR_LOCK_HOURS)return; // los primeros 4 años no hay guerras
  const lo=Math.min(a,b),hi=Math.max(a,b);
  S.wars.set(warKey(a,b),{a:lo,b:hi,start:S.hour,tA:0,tB:0});
  log(NATIONS[a].name+" declara la guerra a "+NATIONS[b].name+".");
  report("⚔","<b>"+NATIONS[a].name+"</b> declara la guerra a <b>"+NATIONS[b].name+"</b>.",[a,b]);
}
function tallyOf(w,nation){return nation===w.a?w.tA:w.tB}
function addBattleScore(w,nation,pts){if(nation===w.a)w.tA+=pts;else w.tB+=pts}
// valor en warscore de un ducado (según su tamaño)
function duchyValue(d){return Math.min(40,WS_DUCHY_BASE+WS_DUCHY_PER*d.provs.length)}
// ducados de `victim` que `occ` ocupa por completo (candidatos a cesión en la paz)
function occupiedDuchiesBy(occ,victim){
  return S.duchies.filter(d=>d.occBy===occ&&S.provs[d.cap].owner===victim);
}
// warscore desde el punto de vista de `a` frente a `b` (−100..100)
function warscore(a,b){
  const w=getWar(a,b);if(!w)return 0;
  let s=tallyOf(w,a)-tallyOf(w,b);
  for(const d of S.duchies){
    if(d.occBy<0)continue;
    const owner=S.provs[d.cap].owner;
    if(d.occBy===a&&owner===b)s+=duchyValue(d);
    else if(d.occBy===b&&owner===a)s-=duchyValue(d);
  }
  return Math.max(-100,Math.min(100,s));
}
// Transfiere un ducado a `to`: sus provincias cambian de dueño de iure (solo aquí cambia p.owner),
// se levanta la ocupación y se reinician colas/moral. `home` se mantiene fijo (de iure histórico).
function transferDuchy(d,to){
  for(const pid of d.provs){
    const p=S.provs[pid];
    p.owner=to;p.occupier=-1;p.morale=25;p.buildQueue=[];p.recruitQueue=[];
    repaintProvince(pid);
  }
  d.occBy=-1;
}
// Levanta la ocupación mutua entre a y b (las provincias vuelven al control de su dueño).
function clearOccupation(a,b){
  const touched=new Set();
  for(const p of S.provs){
    if(p.occupier<0)continue;
    if((p.occupier===a&&p.owner===b)||(p.occupier===b&&p.owner===a)){
      p.occupier=-1;repaintProvince(p.id);if(p.duchy>=0)touched.add(p.duchy);
    }
  }
  for(const d of touched)if(S.duchies[d])S.duchies[d].occBy=-1;
}
// Recalcula d.occBy de todos los ducados a partir de p.occupier (sin efectos: para cargar partida).
function syncDuchyOcc(){
  for(const d of S.duchies){
    const cap=S.provs[d.cap],owner=cap.owner;
    let occ=(cap.occupier>=0&&cap.occupier!==owner)?cap.occupier:-1;
    if(occ>=0)for(const pid of d.provs){const P=S.provs[pid];if(pid!==d.cap&&P.buildings.fortaleza>0&&P.occupier!==occ){occ=-1;break}}
    d.occBy=occ;
  }
}
// Firma la paz entre a y b. terms (opcional) = {duchies:[id…], gold, goldFrom, goldTo}. Cada ducado
// listado se cede a quien lo OCUPA; el oro se transfiere. Sin terms = paz blanca (solo se levanta
// la ocupación). El owner de iure de una provincia SOLO cambia aquí.
function makePeace(a,b,terms){
  const key=warKey(a,b);
  S.wars.delete(key);
  S.truces.set(key,S.hour+17520); // tregua de 2 años
  let transferred=false;const parts=[];
  if(terms){
    for(const did of (terms.duchies||[])){
      const d=S.duchies[did];if(!d||d.occBy<0)continue;
      const to=d.occBy,from=S.provs[d.cap].owner;
      parts.push(NATIONS[from].name+" cede el "+d.name+" a "+NATIONS[to].name);
      transferDuchy(d,d.occBy);transferred=true;
    }
    if(terms.gold>0&&terms.goldFrom!=null&&terms.goldTo!=null){
      const amt=Math.min(terms.gold,S.nations[terms.goldFrom].res.dinero||0);
      S.nations[terms.goldFrom].res.dinero-=amt;
      S.nations[terms.goldTo].res.dinero=(S.nations[terms.goldTo].res.dinero||0)+amt;
      if(amt>0)parts.push(NATIONS[terms.goldFrom].name+" paga "+Math.round(amt)+" ducados");
    }
  }
  clearOccupation(a,b); // lo no cedido revierte a su dueño
  if(transferred)paintBorders(); // el owner cambió: reconstruir la jerarquía de fronteras
  // detener las marchas contra el ex-enemigo (si no, la llegada re-declara la guerra)
  for(const ar of S.armies){
    if(ar.nation!==a&&ar.nation!==b)continue;
    const other=ar.nation===a?b:a;
    if(ar.path.some(p=>S.provs[p].owner===other)){ar.path=[];ar.legDone=0;ar.legTotal=0}
  }
  log("Paz firmada entre "+NATIONS[a].name+" y "+NATIONS[b].name+".");
  report("🕊","Paz entre <b>"+NATIONS[a].name+"</b> y <b>"+NATIONS[b].name+"</b>."+(parts.length?" "+parts.join("; ")+".":" Paz blanca."),[a,b]);
  // eliminación diferida: solo al perder el último ducado en la mesa de paz
  for(const nn of [a,b])if(nn<NPLAY&&S.nations[nn].alive&&nationProvCount(nn)===0){
    S.nations[nn].alive=false;
    log(NATIONS[nn].name+" ha sido borrada del mapa.");
    report("☠","El reino de <b>"+NATIONS[nn].name+"</b> desaparece del mapa.",[nn]);
  }
  checkVictory();
}
function underTruce(a,b){
  const t=S.truces.get(a<b?a+"|"+b:b+"|"+a);
  return t!==undefined&&S.hour<t;
}
function armiesIn(pid){return S.armies.filter(a=>a.prov===pid&&a.path.length===0)}
function nbrs(c){return[...S.adj[c],...S.seaAdj[c]].filter(p=>!S.provs[p].wasteland)}
function bfsPath(from,to,passable){
  if(from===to)return[];
  const prev=new Map([[from,-1]]);
  const q=[from];
  while(q.length){
    const c=q.shift();
    for(const a of nbrs(c)){
      if(prev.has(a))continue;
      if(passable&&a!==to&&!passable(a))continue;
      prev.set(a,c);
      if(a===to){
        const path=[a];let cur=c;
        while(cur!==from){path.unshift(cur);cur=prev.get(cur)}
        return path;
      }
      q.push(a);
    }
  }
  return null;
}
function startLeg(a){
  if(!a.path.length){a.legDone=0;a.legTotal=0;return}
  const from=S.provs[a.prov],to=S.provs[a.path[0]];
  const km=kmBetween(from,to);
  if(!S.adj[a.prov].has(a.path[0])){
    // travesía marítima embarcada: ~90 km/día de cabotaje, mínimo 1 día de embarque
    a.legTotal=Math.max(24,km/90*24);
  }else{
    const terr=(TERRAINS[from.terrain].mov+TERRAINS[to.terrain].mov)/2;
    const road=hasRoad(a.prov,a.path[0])?1.5:1; // los caminos aceleran la marcha un 50%
    a.legTotal=Math.max(6,km/(armySpd(a)*terr*road)*24);
  }
  a.legDone=0;
}
function orderMove(a,target,passable){
  const origin=(a.path.length&&a.legDone>0)?a.path[0]:a.prov;
  let rest=bfsPath(origin,target,passable);
  if(rest===null&&passable)rest=bfsPath(origin,target); // sin ruta limpia, cualquier ruta
  if(rest===null)return false;
  if(a.path.length&&a.legDone>0){
    a.path=[a.path[0],...rest];
  }else{
    a.path=rest;startLeg(a);
  }
  return true;
}
// ---- Conquista por OCUPACIÓN (estilo EU4): tomar un tile no cambia el dueño de iure (p.owner),
// solo su control militar (p.occupier). El ducado "pasa a tu poder" cuando controlas su capital y
// todos sus forts; entonces se ocupa entero. La transferencia real de owner ocurre solo en la paz. ----
function isKeyTile(pid){return isDuchyCap(pid)||S.provs[pid].buildings.fortaleza>0} // capital de ducado o fort
// Un ejército de `nation` toma el control de un tile indefenso. Si es su dueño de iure, lo libera.
function takeTile(pid,nation){
  const p=S.provs[pid];
  if(nation===p.owner){ // liberación: el soberano recupera su tile ocupado
    if(p.occupier>=0){p.occupier=-1;repaintProvince(pid);if(isKeyTile(pid))updateDuchy(p.duchy)}
    return;
  }
  // solo los tiles clave (capital/fort) se ocupan explícitamente; el resto sigue al ducado
  if(!isKeyTile(pid))return;
  if(p.occupier===nation)return;
  p.occupier=nation;repaintProvince(pid);
  updateDuchy(p.duchy);
}
// Recalcula el control pleno de un ducado: si la capital y TODOS los forts están en manos de un
// mismo ocupante (distinto del dueño), el ducado entero pasa a su poder; si se rompe, revierte.
function updateDuchy(dId){
  const d=S.duchies[dId];if(!d)return;
  const cap=S.provs[d.cap],owner=cap.owner;
  let occ=(cap.occupier>=0&&cap.occupier!==owner)?cap.occupier:-1;
  if(occ>=0)for(const pid of d.provs){
    const P=S.provs[pid];
    if(pid!==d.cap&&P.buildings.fortaleza>0&&P.occupier!==occ){occ=-1;break}
  }
  const prev=d.occBy;
  if(occ===prev)return;
  d.occBy=occ;
  if(occ>=0){
    // el ducado pasa a poder del ocupante: se ocupan también los tiles no clave (marcador visual)
    for(const pid of d.provs){const P=S.provs[pid];if(P.occupier!==occ){P.occupier=occ;repaintProvince(pid)}}
    if(occ===S.player||owner===S.player)log(NATIONS[occ].name+" ocupa el "+d.name+" ("+NATIONS[owner].name+").");
    report("🏰","<b>"+NATIONS[occ].name+"</b> ocupa el <b>"+d.name+"</b> ("+NATIONS[owner].name+").",[occ,owner]);
  }else{
    // control roto: los tiles no clave (ocupados solo por el efecto ducado) vuelven a su dueño
    for(const pid of d.provs){
      const P=S.provs[pid];
      if(!isKeyTile(pid)&&P.occupier===prev){P.occupier=-1;repaintProvince(pid)}
    }
    if(prev===S.player||owner===S.player)log("Se ha roto la ocupación del "+d.name+".");
  }
}
// ===== Fuertes y asedios: un tile clave (capital de ducado o Castillo) NO se toma directo; hay que
// ASEDIARLO meses. La duración escala con castillo, guarnición, moral y comida; un ejército grande
// asalta más rápido. La guarnición hostiga a los sitiadores y socorre en batalla. =====
function fortGarrison(p){ // milicianos-equivalentes que defienden un tile clave
  if(!p||p.wasteland)return 0;
  const fort=p.buildings.fortaleza||0,cit=p.buildings.ciudadela||0;
  if(!isDuchyCap(p.id)&&fort<=0)return 0;
  return (isDuchyCap(p.id)?GARR_MIN:0)+GARR_FORT*fort+GARR_CITADEL*cit;
}
function siegeNeed(p,atk){ // ticks (horas de juego) para tomar el fuerte
  const fort=p.buildings.fortaleza||0,cit=p.buildings.ciudadela||0;
  const fortMul=1+0.7*fort+(cit?1.0:0);
  const foodFull=foodCap(p)>0?Math.min(1,(p.food||0)/foodCap(p)):0.5;
  const supplyMul=(0.6+0.4*(p.morale/100))*(0.7+0.5*foodFull);
  const garr=fortGarrison(p);
  const assaultMul=Math.max(0.6,Math.min(2.2,atk/(garr*3+8))); // más asaltantes vs guarnición → más rápido
  return Math.max(720,Math.round(SIEGE_BASE_H*fortMul*supplyMul/assaultMul));
}
function advanceSiege(p,by,atkList){
  const atkStr=atkList.reduce((s,a)=>s+armyAtk(a),0);
  if(!p.siege||p.siege.by!==by)p.siege={by,need:siegeNeed(p,atkStr),prog:0};
  p.siege.prog++;
  if(p.siege.prog>=p.siege.need){
    const garr=fortGarrison(p);
    if(garr>0)p.pop=Math.max(0,(p.pop||0)-garr*(UNITS.miliciano.mano||0)); // la guarnición cae con el fuerte (coste en pob)
    p.siege=null;
    takeTile(p.id,by);
    if(by===S.player||p.owner===S.player)log("Cae el fuerte de "+p.name+" tras el asedio.");
  }
}
function hourTick(){
  S.hour++;
  economyTick(); // secciones 0/1/1b: movilizados, economía+necesidades por nación, comida/población/soldadesca (sin DOM)
  // 2. construcción
  for(const p of S.provs){
    if(p.buildQueue.length){
      const q=p.buildQueue[0];
      if(--q.hoursLeft<=0){
        p.buildings[q.b]++;p.buildQueue.shift();
        if(p.owner===S.player)log(BUILDINGS[q.b].label+" nivel "+p.buildings[q.b]+" terminada en "+p.name+".");
      }
    }
    if(p.recruitQueue.length){
      const q=p.recruitQueue[0];
      if(--q.hoursLeft<=0){
        p.recruitQueue.shift();
        if(p.owner===q.nation||q.nation===p.owner){
          let a=S.armies.find(x=>x.nation===q.nation&&x.prov===p.id&&x.path.length===0);
          if(!a)a=spawnArmy(q.nation,p.id,{});
          a.units[q.u]=(a.units[q.u]||0)+1;
          a.src=a.src||{};a.src[p.id]=(a.src[p.id]||0)+(UNITS[q.u].mano||0); // pops que aporta esta provincia
          // rally: las levas marchan al PUNTO DE REUNIÓN FIJO (q.rally = provincia), no a un blanco móvil
          if(q.rally!=null&&q.rally!==a.prov){
            orderMove(a,q.rally,pp=>{const P=S.provs[pp];return P.owner===q.nation||P.occupier===q.nation});
          }
          if(q.nation===S.player&&q.rally==null)log(UNITS[q.u].label+" reclutado en "+p.name+".");
        }
      }
    }
  }
  // 2b. caminos en obra
  for(let i=S.roadQueue.length-1;i>=0;i--){
    const q=S.roadQueue[i];
    if(--q.hoursLeft<=0){
      S.roads.add(q.key);
      S.roadQueue.splice(i,1);
      drawRoads();
      const[ra,rb]=q.key.split("|").map(Number);
      if(q.nation===S.player)log("Camino terminado entre "+S.provs[ra].name+" y "+S.provs[rb].name+".");
    }
  }
  // 3. movimiento
  for(const a of S.armies){
    if(!a.path.length)continue;
    a.legDone++;
    if(a.legDone>=a.legTotal){
      // controlador del tile destino: quien lo ocupa, o su dueño de iure si no está ocupado
      const np=S.provs[a.path[0]],nc=np.occupier>=0?np.occupier:np.owner;
      // conquista congelada los primeros 4 años: el ejército no entra en territorio ajeno
      if(S.hour<WAR_LOCK_HOURS&&nc!==a.nation){
        a.path=[];a.legDone=0;a.legTotal=0;continue;
      }
      a.prov=a.path.shift();
      const p=S.provs[a.prov];
      const controller=p.occupier>=0?p.occupier:p.owner;
      if(controller!==a.nation){
        if(p.owner<NPLAY&&p.owner!==a.nation)declareWar(a.nation,p.owner);
        const defenders=armiesIn(a.prov).filter(x=>x.nation===controller);
        if(defenders.length===0){
          if(a.nation===p.owner)takeTile(a.prov,a.nation);        // liberación de tile propio ocupado
          else if(isKeyTile(a.prov)){a.path=[];a.legDone=0;a.legTotal=0} // fuerte/capital: se planta a ASEDIAR
          // tile no clave ajeno: no se ocupa, se atraviesa (sigue su camino)
        }else{
          a.path=[];a.legDone=0;a.legTotal=0;
        }
      }
      if(a.path.length)startLeg(a);else{a.legDone=0;a.legTotal=0}
    }
  }
  // 4. combates
  resolveBattles();
  // 5. fusión de ejércitos parados
  mergeIdle();
  // 6. IA cada 6 horas
  if(S.hour%6===0)for(let n=0;n<NPLAY;n++)if(S.nations[n].alive&&S.nations[n].ai)aiTurn(n);
  // 7. diario: moral y autoguardado
  if(S.hour%24===0){
    saveGame();
    // Moral diaria (Fase 3): la moral es el FACTOR DE PRODUCTIVIDAD (mor=morale/100 multiplica toda
    // la producción) y NO se recupera sola. La hacen crecer los EDIFICIOS de moral de la provincia
    // (templo/catedral; en el futuro, tecnologías) y las obras únicas del reino (realmMoral), en
    // dosis mensuales pequeñas y stackeables; la erosionan las provincias vecinas enemigas en guerra.
    // Así una provincia conquistada (moral baja) hay que "ganársela" construyendo.
    const realmG=new Float64Array(NPLAY);
    for(const p of S.provs){const n=p.owner;if(n>=NPLAY||p.wasteland)continue;
      for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.realmMoral)realmG[n]+=fx.realmMoral*(p.buildings[b]||0)}}
    for(const p of S.provs){
      if(p.wasteland||p.owner>=NPLAY)continue;
      let hostile=0;
      for(const a of S.adj[p.id])if(!S.provs[a].wasteland&&S.provs[a].owner!==p.owner&&atWar(p.owner,S.provs[a].owner))hostile++;
      const perMonth=moraleGrowth(p)+realmG[p.owner]-MORALE_HOSTILE*hostile; // puntos de moral/mes
      p.morale+=perMonth/30;                                                 // aplicados por día
      p.morale=Math.max(MORALE_MIN,Math.min(100,p.morale));
    }
    checkVictory();
  }
}
function resolveBattles(){
  const byProv=new Map();
  for(const a of S.armies){
    if(a.path.length)continue;
    if(!byProv.has(a.prov))byProv.set(a.prov,[]);
    byProv.get(a.prov).push(a);
  }
  if(!S._battling)S._battling=new Set();   // provincias con batalla el tick anterior (para reportar solo el inicio)
  const nowBattling=new Set();
  for(const[pid,list]of byProv){
    const p=S.provs[pid];
    // el defensor es el CONTROLADOR del tile (ocupante si lo hay, si no el dueño de iure)
    const controller=p.occupier>=0?p.occupier:p.owner;
    const def=list.filter(a=>a.nation===controller);
    const atk=list.filter(a=>a.nation!==controller&&(atWar(a.nation,p.owner)||atWar(a.nation,controller)));
    if(!atk.length)continue;
    if(S.hour<WAR_LOCK_HOURS)continue; // sin conquista durante el bloqueo inicial
    if(!def.length){
      // sin defensor de campo: liberación inmediata del dueño, ASEDIO si es tile clave, o toma directa si no
      const taker=atk[0].nation;
      if(taker===p.owner){p.siege=null;takeTile(pid,taker)}
      else if(isKeyTile(pid))advanceSiege(p,taker,atk);
      else takeTile(pid,taker);
      continue;
    }
    // batalla de campo. SOCORRO: si es un tile clave del dueño, su guarnición pelea del lado defensor.
    S.battleFlash[pid]=S.hour;
    // reportar el CHOQUE una vez (al iniciarse), si ambos bandos son de cierta entidad
    const atkU=atk.reduce((s,a)=>s+armyCount(a),0),defU=def.reduce((s,a)=>s+armyCount(a),0);
    if(atkU>=4&&defU>=4){
      nowBattling.add(pid);
      if(!S._battling.has(pid))report("⚔","Choque de ejércitos en <b>"+p.name+"</b>: <b>"+NATIONS[atk[0].nation].name+"</b> contra <b>"+NATIONS[controller].name+"</b>.",[atk[0].nation,controller]);
    }
    const terr=TERRAINS[p.terrain].def;
    const fort=provDefMul(p);
    const relief=(isKeyTile(pid)&&controller===p.owner)?fortGarrison(p):0;
    const A=atk.reduce((s,a)=>s+armyAtk(a),0);
    const D=(def.reduce((s,a)=>s+armyDef(a),0)+relief*UNITS.miliciano.def)*fort*terr;
    const hpA=atk.reduce((s,a)=>s+armyHp(a),0);
    const hpD=def.reduce((s,a)=>s+armyHp(a),0)+relief*UNITS.miliciano.hp; // la guarnición absorbe daño
    const dmgToDef=A*0.04/(fort*terr);
    const dmgToAtk=D*0.04;
    applyDamage(def,dmgToDef,hpD);
    applyDamage(atk,dmgToAtk,hpA);
    // warscore de batalla: cada bando suma según el daño infligido al otro, en su guerra con el rival
    const netAtk=Math.max(0,dmgToDef-dmgToAtk),netDef=Math.max(0,dmgToAtk-dmgToDef);
    if(netAtk>0)for(const ar of atk){const w=getWar(ar.nation,controller);if(w)addBattleScore(w,ar.nation,WS_BATTLE*Math.min(1,netAtk/Math.max(1,hpD)))}
    if(netDef>0)for(const dr of def){const w=getWar(dr.nation,atk[0].nation);if(w)addBattleScore(w,dr.nation,WS_BATTLE*Math.min(1,netDef/Math.max(1,hpA)))}
    p.morale=Math.max(5,p.morale-0.05);
  }
  S._battling=nowBattling; // memoria de batallas para no re-reportar el mismo choque
  // limpiar asedios: se levantan si el sitiador se marchó O ya no está en guerra con el dueño/
  // ocupante (paz, tregua o eliminación). Sin esto, una paz firmada durante un asedio lo dejaba
  // clavado (el ejército aparcado no cuenta como atacante válido pero seguía "asediando").
  for(const p of S.provs){
    if(!p.siege)continue;
    const by=p.siege.by,ctrl=p.occupier>=0?p.occupier:p.owner;
    const here=S.armies.some(a=>a.prov===p.id&&!a.path.length&&a.nation===by);
    const hostile=by!==ctrl&&(atWar(by,p.owner)||atWar(by,ctrl));
    if(!here||!hostile){p.siege=null;if(p.owner===S.player)log("Se ha levantado el asedio de "+p.name+".")}
  }
  // limpiar ejércitos vacíos
  for(let i=S.armies.length-1;i>=0;i--){
    if(armyCount(S.armies[i])<0.05){
      if(S.selArmy===S.armies[i]){S.selArmy=null;refreshSide()}
      S.armies.splice(i,1);
    }
  }
}
function applyDamage(list,dmg,totalHp){
  if(totalHp<=0)return;
  const frac=Math.min(0.9,dmg/totalHp);
  for(const a of list){
    // los caídos se restan PARA SIEMPRE de la población de las provincias que los aportaron
    if(a.src)for(const pid in a.src){
      const loss=a.src[pid]*frac;
      const P=S.provs[pid];if(P&&!P.wasteland)P.pop=Math.max(0,(P.pop||0)-loss);
      a.src[pid]-=loss;
    }
    for(const k in a.units){
      a.units[k]*=(1-frac);
      if(a.units[k]<0.05)delete a.units[k];
    }
  }
}
function mergeIdle(){
  const key=new Map();
  for(let i=S.armies.length-1;i>=0;i--){
    const a=S.armies[i];
    if(a.path.length)continue;
    const k=a.nation+":"+a.prov;
    if(key.has(k)){
      const t=key.get(k);
      for(const u in a.units)t.units[u]=(t.units[u]||0)+a.units[u];
      if(a.src){t.src=t.src||{};for(const pid in a.src)t.src[pid]=(t.src[pid]||0)+a.src[pid]}
      if(S.selArmy===a)S.selArmy=t;
      S.armies.splice(i,1);
    }else key.set(k,a);
  }
}
// potencia de una nación para decisiones de agresión: fuerza militar + territorio (levas latentes)
function mightOf(n){let s=0;for(const a of S.armies)if(a.nation===n)s+=armyAtk(a)+armyDef(a);return s+6*nationProvCount(n)}
function aiTurn(n){
  const N=S.nations[n];
  const owned=S.provs.filter(p=>p.owner===n&&!isOccupied(p)); // no desarrollar lo ocupado
  if(!owned.length)return;
  // construir: prioridad militar en la capital, economía en el resto
  for(let t=0;t<2;t++){
    const p=owned[(S.rand()*owned.length)|0];
    if(p.buildQueue.length)continue;
    // orden de preferencia según recurso de la provincia y si es capital
    const pri=[];
    if(p.capital){pri.push("cuartel","fabrica","fortaleza","templo","mercado");}
    const byRes={comida:"granja",materiales:"aserradero",piedra:"cantera",metal:"mina",plata:"minaPlata",oro:"minaOro"};
    if(byRes[p.resType])pri.push(byRes[p.resType]);
    pri.push("mercado","gremio","granja","templo","cuartel","fabrica","campo");
    if(p.coastal)pri.push("puerto");
    for(const b of pri){
      if(lvlOf(p,b)>=buildMax(p,b))continue;
      if(buildBlock(p,b))continue;
      // no construir un edificio productivo si la provincia no puede DOTARLO (mano de obra libre)
      const fx=BUILDINGS[b].fx, economic=fx.prodAdd||fx.goldAdd||fx.prodMul;
      if(economic&&freeLabor(p)<buildJobs(p)+JOBS_PER_LEVEL)continue;
      pay(n,costFor(p,b));
      p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
      break;
    }
  }
  // reclutar
  let troops=0;
  for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  const treasury=S.nations[n].res.dinero;
  if(troops<6+owned.length&&treasury>800){ // no reclutar si el tesoro está bajo
    for(const p of owned){
      if(p.recruitQueue.length||p.buildings.cuartel<1)continue;
      let u="infanteria";
      if(p.buildings.fabrica>=3&&S.rand()<0.3)u="blindadoMedio";
      else if(p.buildings.fabrica>=1&&S.rand()<0.35)u="blindadoLigero";
      else if(p.buildings.fabrica>=2&&S.rand()<0.3)u="artilleria";
      if(canAfford(n,UNITS[u].cost)&&soldAvail(p)>=UNITS[u].mano){
        pay(n,UNITS[u].cost);p.sold=soldAvail(p)-UNITS[u].mano;
        p.recruitQueue.push({u,nation:n,hoursLeft:recruitTime(p,u)});
        break;
      }
    }
  }
  // solvencia: en bancarrota, licenciar la tropa MÁS CARA de mantener para no hundir el tesoro
  if(treasury<0){
    let big=null,bc=-1;for(const a of S.armies)if(a.nation===n){const c=armyCount(a);if(c>bc){bc=c;big=a}}
    if(big){
      let bu=null,bup=-1;for(const k in big.units){if(big.units[k]<1)continue;const up=(UNITS[k].up&&UNITS[k].up.dinero)||0;if(up>bup){bup=up;bu=k}}
      if(bu)disbandUnit(big,bu,1);
    }
  }
  // guerra: declarar al vecino con el que más frontera se comparte, ponderado por debilidad
  const enemies=[];
  for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m].alive&&atWar(n,m))enemies.push(m);
  // engrosar con LEVAS antes de campaña: reúne levas alrededor del mayor ejército propio parado en casa
  if(enemies.length&&treasury>1500&&S.rand()<0.06){
    let host=null,hc=-1;
    for(const a of S.armies)if(a.nation===n&&!a.path.length&&!(a.muster&&S.hour<a.muster.until)&&S.provs[a.prov].owner===n&&!isOccupied(S.provs[a.prov])){
      const c=armyCount(a);if(c>hc){hc=c;host=a}
    }
    if(host&&hc<14)raiseLevies(host,6);
  }
  const day=S.hour/24;
  if(!enemies.length&&day>90&&S.rand()<0.0025){ // las guerras surgen cada pocos años, no cada semana
    const capP=S.provs[S.nations[n].capital];
    const contact=new Map(); // nación -> {c: frontera compartida, d: distancia mínima a mi capital}
    const register=(a,w)=>{
      const o=S.provs[a].owner;
      if(o>=NPLAY||o===n||!S.nations[o].alive)return;
      const e=contact.get(o)||{c:0,d:1e9};
      e.c+=w;
      const dd=Math.hypot(S.provs[a].x-capP.x,S.provs[a].y-capP.y);
      if(dd<e.d)e.d=dd;
      contact.set(o,e);
    };
    for(const p of owned){
      for(const a of S.adj[p.id])register(a,1);
      for(const a of S.seaAdj[p.id])register(a,0.4); // el mar cuenta menos
    }
    let best=-1,bs=-1;
    for(const[m,e]of contact){
      if(underTruce(n,m))continue; // respetar la tregua tras una paz
      const score=e.c/(nationStrength(m)+50)/(1+e.d/350); // vecino pegado a casa > lejano
      if(score>bs){bs=score;best=m}
    }
    // fuerza para decidir: ejércitos + territorio (potencial de levas). Ejércitos levy-heavy pesan menos.
    if(best>=0&&mightOf(n)>mightOf(best)*1.05)declareWar(n,best);
  }
  // mover ejércitos. La guarnición (def de ejércitos parados por tile) se precalcula una vez.
  const wantNeutral=day>1&&S.hour>=WAR_LOCK_HOURS; // sin expansión durante el bloqueo inicial
  const garrison=new Map();
  for(const g of S.armies){
    if(g.path.length)continue;
    garrison.set(g.prov,(garrison.get(g.prov)||0)+armyDef(g));
  }
  // fuertes PROPIOS bajo asedio → candidatos a socorro
  const besieged=[];
  for(const p of S.provs)if(p.owner===n&&p.siege)besieged.push(p.id);
  for(const a of S.armies){
    if(a.nation!==n||a.path.length)continue;
    if(armyCount(a)<1.2)continue;
    if(a.muster&&S.hour<a.muster.until)continue;                 // reuniendo levas: aguarda
    const here=S.provs[a.prov];
    if(here.siege&&here.siege.by===n)continue;                   // asediando: no abandonar el asedio
    if(isKeyTile(a.prov)&&(here.occupier>=0?here.occupier:here.owner)!==n&&enemies.includes(here.owner))continue; // plantado sobre el fuerte a tomar
    if(armiesIn(a.prov).some(x=>x.nation!==n&&atWar(n,x.nation)))continue; // combatiendo: quedarse
    if(here.owner===n&&here.siege)continue;                      // defendiendo su propio fuerte asediado
    if(here.capital&&armiesIn(a.prov).filter(x=>x.nation===n).length<=1&&enemies.length)continue; // guardia de la capital
    const myPower=armyAtk(a)+armyDef(a);
    // socorro: si un fuerte propio cercano está asediado, ir a romper el asedio (la guarnición ayuda)
    let target=-1,bd=1e9;
    for(const pid of besieged){const d=Math.hypot(here.x-S.provs[pid].x,here.y-S.provs[pid].y);if(d<bd){bd=d;target=pid}}
    if(target<0||bd>520)target=findTarget(a.prov,n,enemies,wantNeutral,myPower,garrison);
    const pass=p=>{const P=S.provs[p];return P.owner===n||P.occupier===n||P.owner===NEUTRAL||enemies.includes(P.owner)};
    if(target>=0){
      // tránsito por lo propio/ocupado/neutral y por el enemigo en guerra (evita declarar al pasar por terceros)
      orderMove(a,target,pass);
    }else if(here.owner!==n&&here.occupier!==n){
      // REPLIEGUE: varado en tierra ajena sin objetivo (guerra acabada) → volver a la provincia propia más cercana
      let home=-1,hd=1e18;
      for(const p of S.provs)if(p.owner===n&&!p.wasteland&&!isOccupied(p)){const d=(p.x-here.x)**2+(p.y-here.y)**2;if(d<hd){hd=d;home=p.id}}
      if(home>=0){
        const path=bfsPath(a.prov,home,pass);
        if(path){a.path=path;startLeg(a)}                          // marcha a casa por ruta limpia
        else{a.prov=home;a.path=[];a.legDone=0;a.legTotal=0}       // atrapado: repliegue directo
      }
    }
  }
  // paz: el bando que gana propone quedándose con 1 ducado (contiguo/por mar) u oro.
  for(const m of enemies){
    const w=getWar(n,m);if(!w)continue;
    const ws=warscore(n,m);
    if(m===S.player){maybeOfferPlayerPeace(n,m,ws);continue}
    // IA vs IA: solo el que va ganando cierra la paz con sus condiciones
    if(ws>=20&&S.rand()<0.03){
      const terms=aiDemandTerms(n,m,ws);
      if(terms)makePeace(n,m,terms);
    }else if(S.hour-w.start>3*8760&&Math.abs(ws)<10&&S.rand()<0.01){
      makePeace(n,m); // guerra larga y equilibrada: paz blanca
    }
  }
}
// Elige UN ducado a exigir (requisito: solo 1 por paz), priorizando contiguos por tierra, luego por
// mar (caso Túnez→Sicilia), luego el más cercano a la capital del demandante.
function bestDuchyToTake(n,list){
  const cap=S.nations[n].capital>=0?S.provs[S.nations[n].capital]:null;
  let best=null,bs=-1e18;
  for(const d of list){
    let adj=0;
    for(const pid of d.provs){for(const a of S.adj[pid])if(S.provs[a].owner===n){adj=2;break}if(adj)break}
    if(!adj)for(const pid of d.provs){for(const a of S.seaAdj[pid])if(S.provs[a].owner===n){adj=1;break}if(adj)break}
    const dp=S.provs[d.cap],dist=cap?Math.hypot(dp.x-cap.x,dp.y-cap.y):0;
    const s=adj*1e4-dist;
    if(s>bs){bs=s;best=d}
  }
  return best;
}
// Condiciones que la IA `n` exige a `m` con su warscore `ws`: 1 ducado ocupado (preferente) u oro.
function aiDemandTerms(n,m,ws){
  const occ=occupiedDuchiesBy(n,m);
  if(occ.length){
    const pick=bestDuchyToTake(n,occ);
    if(pick&&duchyValue(pick)<=ws+3)return{duchies:[pick.id],gold:0};
  }
  const gold=Math.min((S.nations[m].res.dinero||0)*0.5,Math.round(ws*GOLD_PER_WS));
  if(gold>=300)return{duchies:[],gold,goldFrom:m,goldTo:n};
  return null;
}
// Oferta de paz de la IA `n` al jugador `m` cuando va claramente ganando (la UI la muestra).
function maybeOfferPlayerPeace(n,m,ws){
  if(S.incomingPeace||ws<25||S.rand()>0.03)return;
  const terms=aiDemandTerms(n,m,ws);
  if(!terms)return;
  S.incomingPeace={enemy:n,terms,ws};
}
function findTarget(from,n,enemies,wantNeutral,myPower,garrison){
  // Con el modelo de ocupación, lo ÚNICO que hace progresar la guerra es tomar TILES CLAVE
  // (capitales de ducado y fuertes): son los que se ocupan y voltean el ducado. Así que el
  // objetivo es siempre un tile clave enemigo que YO no controle y que pueda asaltar con mi
  // fuerza (puerta de fuerza: no alimento fuertes que me superan). Se puntúa cerca>lejos,
  // cerco (rodeado de lo mío) y debilidad del objetivo. El tránsito atraviesa cualquier tile.
  const capId=S.nations[n].capital;
  const capP=capId>=0?S.provs[capId]:S.provs[from];
  const seen=new Map([[from,0]]);
  let ring=[from];
  let best=-1,bs=-1e9;
  for(let d=0;d<9&&ring.length;d++){
    const next=[];
    for(const c of ring){
      const dc=seen.get(c);
      const step=(a,cost)=>{
        if(seen.has(a))return;
        seen.set(a,cost);
        const P=S.provs[a];
        if(P.wasteland)return; // ni objetivo ni tránsito
        next.push(a);
        if(!isKeyTile(a))return; // solo los tiles clave son OBJETIVO (lo demás es solo tránsito)
        const o=P.owner,ctrl=P.occupier>=0?P.occupier:o;
        if(ctrl===n)return; // ya lo controlo
        let s;
        if(o===n&&P.occupier>=0&&enemies.includes(P.occupier))s=14; // MI fuerte ocupado: liberar (prioritario)
        else if(enemies.includes(o))s=12;                          // fuerte enemigo a tomar
        else if(wantNeutral&&o===NEUTRAL)s=5;
        else return;
        // fuerza defensiva del objetivo: guarnición del fuerte + ejércitos parados en él
        const defHere=fortGarrison(P)*UNITS.miliciano.def+(garrison.get(a)||0);
        if(myPower<defHere*0.8)return; // demasiado fuerte para asaltarlo solo → no lo elijo (concentrar)
        s-=cost*1.3;
        s-=Math.hypot(P.x-capP.x,P.y-capP.y)/110; // atracción de la capital propia
        let mine=0,tot=0;
        for(const b of S.adj[a]){if(S.provs[b].wasteland)continue;tot++;if(S.provs[b].owner===n)mine++}
        if(tot)s+=5*mine/tot;           // cerco: enclaves y bolsas primero
        s-=defHere*0.02;                // a igualdad, el más débil
        if(s>bs){bs=s;best=a}
      };
      for(const a of S.adj[c])step(a,dc+1);
      for(const a of S.seaAdj[c])step(a,dc+2.2);
    }
    ring=next;
  }
  return best;
}
function tryBuild(pid,b){
  const p=S.provs[pid];
  if(p.owner!==S.player||isOccupied(p)||buildBlock(p,b))return;
  pay(S.player,costFor(p,b));
  p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
  refreshSide();refreshTop();refreshBuildBar();
}
function tryRecruit(pid,u){
  const p=S.provs[pid];
  if(p.owner!==S.player||isOccupied(p))return;
  const U=UNITS[u];
  for(const r in U.req)if(p.buildings[r]<U.req[r])return;
  if(!canAfford(S.player,U.cost)||soldAvail(p)<U.mano)return;
  pay(S.player,U.cost);p.sold=soldAvail(p)-U.mano;
  p.recruitQueue.push({u,nation:S.player,hoursLeft:recruitTime(p,u)});
  refreshSide();refreshTop();
}
// Licenciar `n` unidades de un tipo: desmoviliza (NO mata población), devuelve la soldadesca a las
// provincias de origen (baja el mantenimiento y recupera mano de obra). Devuelve cuántas licenció.
function disbandUnit(army,type,n){
  if(!army||!army.units[type])return 0;
  n=Math.min(n,Math.floor(army.units[type]+1e-6));
  if(n<=0)return 0;
  const freed=n*(UNITS[type].mano||0);
  let tot=0;for(const pid in army.src)tot+=army.src[pid];
  if(tot>0&&freed>0)for(const pid in army.src){
    const back=freed*(army.src[pid]/tot);
    army.src[pid]=Math.max(0,army.src[pid]-back);
    const P=S.provs[pid];
    if(P&&!P.wasteland)P.sold=Math.min(soldCap(P),(P.sold||0)+back); // la gente vuelve a casa
  }
  army.units[type]-=n;
  if(army.units[type]<0.05)delete army.units[type];
  if(armyCount(army)<0.05){
    const i=S.armies.indexOf(army);
    if(i>=0){if(S.selArmy===army)S.selArmy=null;S.armies.splice(i,1)}
  }
  return n;
}
// Levanta `n` levas ALREDEDOR de un ejército: BFS por anillos sobre territorio propio no ocupado,
// repartiendo en round-robin entre las provincias capaces (soldadesca + recursos); si no hay cerca,
// se aleja a las más próximas capaces. Cada leva marcha sola a reunirse con el ejército (rally).
function raiseLevies(army,n){
  if(!army)return 0;
  const nat=army.nation,U=UNITS.miliciano;
  const muster=army.prov;                 // punto de reunión FIJO (donde está el ejército al llamar)
  let raised=0;
  const seen=new Set([muster]);
  let ring=[muster];
  while(raised<n&&ring.length){
    const capable=ring.filter(pid=>{
      const p=S.provs[pid];
      return p.owner===nat&&!p.wasteland&&!isOccupied(p)&&soldAvail(p)>=U.mano&&canAfford(nat,U.cost);
    });
    let progressed=true;
    while(raised<n&&progressed){
      progressed=false;
      for(const pid of capable){
        if(raised>=n)break;
        const p=S.provs[pid];
        if(soldAvail(p)<U.mano||!canAfford(nat,U.cost))continue;
        pay(nat,U.cost);p.sold=soldAvail(p)-U.mano;
        p.recruitQueue.push({u:"miliciano",nation:nat,hoursLeft:LEVY_RAISE_HOURS,rally:muster}); // rally al punto FIJO
        raised++;progressed=true;
      }
    }
    const next=[];
    for(const pid of ring)for(const a of S.adj[pid])if(!seen.has(a)){seen.add(a);next.push(a)}
    ring=next;
  }
  if(raised>0){
    // el ejército se PLANTA a reunir las levas (no las persigue): halt + estado de muster
    army.path=[];army.legDone=0;army.legTotal=0;
    army.muster={prov:muster,until:S.hour+LEVY_RAISE_HOURS+2400}; // espera ~reclutamiento + viaje
  }
  if(nat===S.player){
    if(raised>0)log("Se levantan "+raised+" levas; el ejército aguarda a que se reúnan.");
    else log("No hay provincias cercanas con soldadesca o recursos para levantar levas.");
    refreshSide();refreshTop();
  }
  return raised;
}
function checkVictory(){
  if(S.gameOver||S.player<0)return;
  if(S.hour>=876000){ // año 1544: fin de la era, gana quien más domina
    S.gameOver=true;
    let best=-1,bc=-1;
    for(let n=0;n<NPLAY;n++){const c=nationProvCount(n);if(c>bc){bc=c;best=n}}
    document.getElementById("endTitle").textContent=best===S.player?"¡VICTORIA!":"FIN DE LA ERA";
    document.getElementById("endText").textContent="Corre el año 1544. "+NATIONS[best].name+" domina Europa con "+bc+
      " provincias"+(best===S.player?". Tu dinastía pasa a la historia.":"; tu nación termina con "+nationProvCount(S.player)+".");
    document.getElementById("endOverlay").style.display="flex";
    return;
  }
  const total=S.provs.filter(p=>!p.wasteland).length;
  const mine=nationProvCount(S.player);
  const myArmies=S.armies.some(a=>a.nation===S.player);
  const goal=Math.max(Math.ceil(total*0.33),Math.ceil(S.nations[S.player].startProvs*1.8));
  if(mine>=goal){
    S.gameOver=true;
    document.getElementById("endTitle").textContent="¡VICTORIA!";
    document.getElementById("endText").textContent="Controlas "+mine+" de "+total+" provincias. Europa es tuya.";
    document.getElementById("endOverlay").style.display="flex";
  }else if(mine===0&&!myArmies){
    S.gameOver=true;
    document.getElementById("endTitle").textContent="DERROTA";
    document.getElementById("endText").textContent="Tu nación ha sido borrada del mapa.";
    document.getElementById("endOverlay").style.display="flex";
  }
}

export {
  atWar, declareWar, makePeace, underTruce, spawnArmy, setupNations, tryRoad, nbrs, bfsPath, startLeg, orderMove, takeTile, updateDuchy, isKeyTile, hourTick, resolveBattles, applyDamage, mergeIdle, aiTurn, findTarget, tryBuild, tryRecruit, disbandUnit, raiseLevies, checkVictory, armiesIn,
  getWar, warscore, duchyValue, occupiedDuchiesBy, bestDuchyToTake, syncDuchyOcc, fortGarrison, siegeNeed
};
