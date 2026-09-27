// sim.js
import { BUILDINGS, GARR_CITADEL, GARR_FORT, GARR_MIN, GOLD_PER_WS, LEVY_RAISE_HOURS, NATIONS, NEUTRAL, NPLAY, RES_BUILDING, RES_KEYS, SIEGE_BASE_H, START_STOCK, TERRAINS, UNITS, WAR_LOCK_HOURS, WS_BATTLE, WS_DUCHY_BASE, WS_DUCHY_PER, isSea, EMBARK_HOURS } from "./config.js";
import { S } from "./state.js";
import { fxKeys, armyAtk, armyCount, armyDef, armyHp, armySpd, bOwnerOf, buildBlock, buildJobs, buildMax, buildSlots, canAfford, canStaffIndustry, costFor, ESTATES_BUILD, foodFill, storeCap, SUBS_BASICS, freeLabor, isOccupied, JOBS_PER_LEVEL, lvlOf, moraleGrowth, MORALE_HOSTILE, MORALE_MIN, nationProvCount, nationStrength, pay, provDefMul, recruitTime, soldAvail, soldCap, timeFor, usedSlots, tsyTick, recFlow, recCrown, specialistCap, jobsOf, degradeBuildings } from "./economy.js";
import { relTick, getRel, THRESH, conquestFanout, insult, fabricateClaim, hasClaim, duchyOwner, sameLeague, hasPact, nationNeighbors, rivalsOf, isRival, sharedRivals, MAX_RIVALS, canPact, formPact, leagueOf, canApplyLeague, applyToLeague, createLeague, leaveLeague, resolveApplication, MAX_LEAGUE } from "./diplomacy.js";
import { aiOpenWar } from "./council.js";
import { buildDuchies, hasRoad, roadLvl, isDuchyCap, kmBetween, roadKey } from "./mapgen.js";
import { drawRoads, paintBorders, repaintProvince } from "./render.js";
import { saveGame } from "./save.js";
import { economyTick2, seedOwner2, seedWealth2, seedEstates2, siteOK2, BLD2, obsolete2 } from "./economy2.js";
// IA de obras y gestión de edificios de los ESTAMENTOS (y de la corona IA): vive en estates.js, sin DOM (la usa el arnés)
import { estateBuild, budgetManage, profitOf, pickCrownBuild } from "./estates.js";
import { log, refreshBuildBar, refreshSide, refreshTop } from "./ui.js";

// El núcleo económico/demográfico del tick vive en economy.js (economyTick), sin DOM, para
// compartirlo con el arnés de análisis. Aquí quedan lo militar, la construcción y el movimiento.

function seedEstateBld(p,b,estate){ // E2: siembra 1 nivel de b propiedad de estate, si cabe y no existe ya
  if(lvlOf(p,b)>=1||usedSlots(p)>=buildSlots(p))return;
  p.buildings[b]=(p.buildings[b]||0)+1;(p.bOwner||(p.bOwner={}))[b]=estate;
}
// OVERRIDE de capital: reinos cuya ciudad-capital histórica NO cae en su ducado-capital de EU4 (o la
// supera en pop una vecina), así que el ajuste por ducado no basta. Se fijan por NOMBRE. Ampliable.
const CAPITAL_FIX={Mamelucos:"El Cairo",Polonia:"Cracovia","Milán":"Milán",Navarra:"Pamplona"};
function setupNations(){
  S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
    ai:true,capital:-1,alive:!n.neutral,lastAI:0,startProvs:0,
    sWealth:{campesino:0,burgues:0,clero:0,nobleza:0},mkt:{},taxRate:0.08})); // Fase B: riqueza de estratos + mercado + palanca fiscal
  // sembrar la soldadesca (cupo movilizable) y la despensa (almacén de comida) iniciales, y
  // una FÁBRICA del bien de la provincia (su resType) para que la economía building-driven no
  // arranque en déficit general: cada provincia produce de serie su propio recurso.
  for(const p of S.provs)if(!p.wasteland){
    // fábrica del resType SOLO donde la provincia pueda dotarla (los núcleos poblados); las provincias
    // demasiado pequeñas quedan agrícolas y no arruinan a los reinos extensos con fábricas ociosas.
    if(p.owner<NPLAY){
      p.sold=soldCap(p);p.bOwner=p.bOwner||{};
      // fábrica de la CORONA del resType, sembrada a NIVEL 2 (Paso 2): más producción de arranque para que el
      // mundo no empiece con oferta ≈0. Nivel 2 solo si la provincia puede dotar dos niveles; si no, nivel 1.
      const b=obsolete2(RES_BUILDING[p.resType])?null:RES_BUILDING[p.resType]; // sin los talleres heredados de la v1 que ya no producen
      if(b&&canStaffIndustry(p,b)){const B=BUILDINGS[b];p.buildings[b]=(specialistCap(p)>=2*jobsOf(b)&&(B.unique?1:(B.max||3)>=2))?2:1;
        const o=seedOwner2(b);if(o!=="corona")p.bOwner[b]=o} // cada taller a su dueño histórico (su producción se VENDE)
      // E2: base inicial por estamento (lever de nivelado). Urbano: el burgués tiene su comercio (INGRESO)
      // y el clero su templo (moral + COSTE); rural: la nobleza su cuartel (leva + COSTE). Todo tunable.
      seedEstates2(p,seedEstateBld);                        // cuartel en rural ≥2.000 hab., templo en ciudad ≥20.000 (economy2)
    }
    p.store={};for(const k of SUBS_BASICS)p.store[k]=storeCap(p,k)*0.6; // despensa de grano inicial
  }
  // capitales históricas (marcadas por las ciudades del mapa) y tropas iniciales
  for(let n=0;n<NPLAY;n++){
    let cap=-1;
    for(const p of S.provs)if(p.owner===n&&p.capital){cap=p.id;break}
    if(cap<0)for(const p of S.provs)if(p.owner===n){cap=p.id;p.capital=true;break}
    // La capital de EU4 cae en el DUCADO correcto, pero en la sub-provincia donde quedó la coordenada
    // (a menudo una aldea: "Arroyomolinos" por Toledo, "Suresnes" por París). Se mueve el flag a la
    // CIUDAD principal de ese mismo ducado (urbana, más poblada) → la capital histórica de verdad.
    if(cap>=0&&S.provs[cap].duchy0>=0){
      const duc=S.provs[cap].duchy0;let best=cap,bp=-1;
      for(const p of S.provs){if(p.owner!==n||p.wasteland||p.duchy0!==duc)continue;
        const sc=(p.urban?1e7:0)+(p.cityPop||0)+(p.pop||0);if(sc>bp){bp=sc;best=p.id}}
      if(best!==cap){S.provs[cap].capital=false;S.provs[best].capital=true;cap=best}
    }
    // override curado (por nombre) para las excepciones donde la ciudad-capital cae fuera del ducado
    const ov=CAPITAL_FIX[NATIONS[n].name];
    if(ov)for(const p of S.provs)if(p.owner===n&&!p.wasteland&&(p.canon===ov||p.name===ov)){
      if(cap>=0&&cap!==p.id)S.provs[cap].capital=false;p.capital=true;cap=p.id;break;}
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
  seedWealth2(); // riqueza inicial por estrato: meses de su cesta
  seedHistoricalDiplomacy(); // Fase 7: pactos y ligas históricos de ~1450 al inicio de partida
}
// Fase 7 — SEED HISTÓRICO ~1450: siembra al inicio los pactos (S.pacts) y ligas (S.leagues) reales de la
// época. Se resuelve por NOMBRE de nación (robusto a reordenaciones del mapa) y solo entre naciones VIVAS.
// Hasta que la IA gestione pactos de forma autónoma (7b), esto da un tablero diplomático histórico de partida.
// Los seeds de LIGA pueden EXCEDER el tope de miembros (el tope solo limita nuevas solicitudes, canApplyLeague).
function seedHistoricalDiplomacy(){
  const idx={};for(let i=0;i<NATIONS.length;i++)idx[NATIONS[i].name]=i;
  const A=nm=>{const i=idx[nm];return (i!=null&&S.nations[i]&&S.nations[i].alive)?i:-1;};
  const pact=(x,y,type)=>{const a=A(x),b=A(y);if(a<0||b<0||a===b)return;S.pacts.set(warKey(a,b),type);};
  const inLeague=m=>S.leagues.some(L=>L.members.includes(m));
  const league=(name,founderNm,memberNms)=>{
    const members=[];
    for(const nm of memberNms){const m=A(nm);if(m>=0&&!members.includes(m)&&!inLeague(m))members.push(m);}
    if(members.length<2)return;
    const f=A(founderNm), founder=members.includes(f)?f:members[0];
    S.leagues.push({id:(S.leagueSeq=(S.leagueSeq||0)+1),name,founder,members,apps:[]});
  };
  // --- ALIANZAS históricas (S.pacts "alliance") ---
  pact("Francia","Escocia","alliance");            // Auld Alliance (anti-inglesa)
  pact("Portugal","Inglaterra","alliance");        // Tratado de Windsor (1386), la alianza más longeva
  pact("Aragón","Nápoles","alliance");             // Alfonso V el Magnánimo: unión personal (1442)
  pact("Polonia","Lituania","alliance");           // unión jagellónica (Krewo, 1385)
  pact("Orden Teutónica","Orden Livona","alliance");// dos ramas de la Orden Teutónica
  pact("Imperio Bizantino","Trebisonda","alliance");// remanentes griegos ortodoxos (Comnenos)
  // --- NO AGRESIÓN (S.pacts "nap") ---
  pact("Castilla","Francia","nap");                // eje anti-inglés
  pact("Castilla","Aragón","nap");                 // dinástico Trastámara (pre-unión de 1469)
  // --- LIGAS defensivas (S.leagues) ---
  league("Liga Itálica","Estados Pontificios",["Estados Pontificios","Venecia","Milán","Florencia","Nápoles"]); // Paz de Lodi (1454)
  league("Sacro Imperio","Austria",["Austria","Bohemia","Brandeburgo","Sajonia","Baviera","Renania","Pomerania"]); // HRE defensivo (excede el tope)
  league("Liga contra el Turco","Hungría",["Hungría","Serbia","Bosnia","Valaquia","Albania"]); // bloque cristiano anti-otomano (era de Hunyadi)
}
function spawnArmy(nation,prov,units){
  // a.src = mapa provincia->pops que la componen (para que las bajas resten pop a su origen)
  const src={};
  let w=0;for(const k in units)w+=units[k]*(UNITS[k].mano||0);
  if(w>0)src[prov]=w;
  const a={id:S.armyIdSeq++,nation,prov,units:Object.assign({},units),src,path:[],legDone:0,legTotal:0,supply:70}; // supply = % de grano forrajeado localmente (resto, nacional)
  S.armies.push(a);
  return a;
}
function tryRoad(a,b){
  const cost={dinero:800,materiales:1200};
  if(S.provs[a].owner!==S.player||S.provs[b].owner!==S.player)return;
  const key=roadKey(a,b), lvl=S.roads.get(key)||0;
  if(lvl>=3)return;                                   // ya al nivel máximo
  if(S.roadQueue.some(q=>q.key===key))return;         // ya en obra
  if(!canAfford(S.player,cost))return;
  pay(S.player,cost,"Caminos");                      // mismo coste por nivel
  S.roadQueue.push({key,hoursLeft:4320,nation:S.player,toLvl:lvl+1}); // 6 meses de obra por nivel
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
// force=true salta el gate de tensión (marcha a territorio enemigo = acto de guerra; y la IA hasta
// que aprenda a escalar tensión en la Fase 7). El jugador NO fuerza: necesita ≤ THRESH.war de tensión.
function declareWar(a,b,opts){
  if(a===NEUTRAL||b===NEUTRAL||a===b||atWar(a,b))return false;
  if(S.hour<WAR_LOCK_HOURS)return false; // los primeros años no hay guerras
  if(S.pacts.has(warKey(a,b)))return false; // hay pacto (no agresión/alianza): rómpelo antes de la guerra
  if(!(opts&&opts.force)&&getRel(a,b)>THRESH.war)return false; // sin suficiente tensión no se puede declarar
  const lo=Math.min(a,b),hi=Math.max(a,b);
  S.wars.set(warKey(a,b),{a:lo,b:hi,start:S.hour,tA:0,tB:0,coal:(opts&&opts.coal)||null}); // coal = id de coalición (paz conjunta)
  if(!(opts&&opts.quiet)){ // quiet: la coalición emite UN solo parte por su cuenta (no uno por par)
    log(NATIONS[a].name+" declara la guerra a "+NATIONS[b].name+".");
    report("⚔","<b>"+NATIONS[a].name+"</b> declara la guerra a <b>"+NATIONS[b].name+"</b>.",[a,b]);
  }
  return true;
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
  S.mktDirty=true; // las fronteras han cambiado: la topología del mercado se rehace al próximo uso
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
  const wCur=S.wars.get(key); if(wCur&&wCur.coal!=null)return; // guerra de COALICIÓN: se cierra con coalitionPeace, no pairwise
  S.wars.delete(key);
  S.truces.set(key,S.hour+17520); // tregua de 2 años
  let transferred=false;const parts=[];
  if(terms){
    for(const did of (terms.duchies||[])){
      const d=S.duchies[did];if(!d||d.occBy<0)continue;
      const to=d.occBy,from=S.provs[d.cap].owner;
      parts.push(NATIONS[from].name+" cede el "+d.name+" a "+NATIONS[to].name);
      const fan=conquestFanout(to,from,did); // infamia: reparte tensión a los vecinos (salvo casus belli)
      if(!fan.claim&&fan.hits.length&&(to===S.player||fan.hits.some(x=>x.n===S.player)))
        report("📜","La conquista del <b>"+d.name+"</b> por <b>"+NATIONS[to].name+"</b> inquieta a la región.",[to,...fan.hits.map(x=>x.n)]);
      transferDuchy(d,d.occBy);transferred=true;
    }
    if(terms.gold>0&&terms.goldFrom!=null&&terms.goldTo!=null){
      const amt=Math.min(terms.gold,S.nations[terms.goldFrom].res.dinero||0);
      S.nations[terms.goldFrom].res.dinero-=amt;
      S.nations[terms.goldTo].res.dinero=(S.nations[terms.goldTo].res.dinero||0)+amt;
      recCrown(terms.goldFrom,"Paces y tributos",NATIONS[terms.goldTo].name,-amt);recCrown(terms.goldTo,"Paces y tributos",NATIONS[terms.goldFrom].name,amt);
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
// ---- COALICIONES (Fase 6b, Etapa 2): warscore CONJUNTO + PAZ CONJUNTA ----
// Aportación de un ATACANTE = suma de sus warscores pairwise contra los defensores.
function coalMemberScore(coal,n){let s=0;for(const d of coal.def)s+=warscore(n,d);return s;}
// Warscore CONJUNTO de la coalición (ventaja total del bando atacante).
function coalScore(coal){let s=0;for(const a of coal.atk)s+=coalMemberScore(coal,a);return s;}
// Coalición a la que pertenece la guerra a↔b (o null).
function coalitionOf(a,b){const w=getWar(a,b);return w&&w.coal!=null?S.coalitions.get(w.coal):null;}
// Ducados ocupados cedibles en la paz de esta coalición (ocupados por un ATACANTE, dueño DEFENSOR).
function coalCededDuchies(coal){const o=[];for(const d of S.duchies)if(d.occBy>=0&&coal.atk.includes(d.occBy)&&coal.def.includes(S.provs[d.cap].owner))o.push(d.id);return o;}

// PAZ CONJUNTA: los líderes firman por todo el bando. terms={duchies:[id…], gold}. Cada ducado se cede a
// quien lo OCUPA; el ORO (lo paga el líder defensor) se reparte entre los atacantes con warscore POSITIVO,
// proporcional a su aportación (los de warscore ≤0 quedan fuera del pool). Termina TODAS las guerras
// pairwise de la coalición + treguas. El warscore se captura ANTES de ceder (para no perder la aportación).
function coalitionPeace(coalId,terms){
  const coal=S.coalitions.get(coalId);if(!coal)return false;
  terms=terms||{};
  const parts=[];let transferred=false;
  // 1) capturar la aportación de cada atacante ANTES de ceder ducados
  const scores=coal.atk.filter(n=>n<NPLAY).map(n=>({n,s:coalMemberScore(coal,n)})).filter(x=>x.s>0);
  const totalPos=scores.reduce((a,x)=>a+x.s,0);
  // 2) cesión de ducados ocupados (cada uno a su ocupante), con su infamia
  for(const did of (terms.duchies||[])){
    const d=S.duchies[did];if(!d||d.occBy<0||!coal.atk.includes(d.occBy)||!coal.def.includes(S.provs[d.cap].owner))continue;
    const to=d.occBy,from=S.provs[d.cap].owner;
    parts.push(NATIONS[from].name+" cede el "+d.name+" a "+NATIONS[to].name);
    conquestFanout(to,from,did);transferDuchy(d,to);transferred=true;
  }
  // 3) oro: el líder defensor paga; se reparte entre atacantes de warscore positivo, proporcional
  if(terms.gold>0&&totalPos>0){
    const payer=coal.leadD;
    const paid=Math.min(terms.gold,(S.nations[payer]&&S.nations[payer].res.dinero)||0);
    if(paid>0){
      S.nations[payer].res.dinero-=paid;recCrown(payer,"Paces y tributos","Coalición",-paid);
      for(const x of scores){S.nations[x.n].res.dinero=((S.nations[x.n].res.dinero)||0)+paid*(x.s/totalPos);recCrown(x.n,"Paces y tributos",NATIONS[payer].name,paid*(x.s/totalPos))}
      parts.push(NATIONS[payer].name+" paga "+Math.round(paid)+" ducados (repartidos por warscore)");
    }
  }
  // 4) terminar todas las guerras pairwise + tregua + levantar ocupación restante + parar marchas
  for(const a of coal.atk)for(const d of coal.def){
    S.wars.delete(warKey(a,d));S.truces.set(warKey(a,d),S.hour+17520);clearOccupation(a,d);
    for(const ar of S.armies){if(ar.nation!==a&&ar.nation!==d)continue;const other=ar.nation===a?d:a;if(ar.path.some(p=>S.provs[p].owner===other)){ar.path=[];ar.legDone=0;ar.legTotal=0}}
  }
  S.coalitions.delete(coalId);
  if(transferred)paintBorders();
  log("Paz de coalición entre "+NATIONS[coal.leadA].name+" y "+NATIONS[coal.leadD].name+".");
  report("🕊","Paz de coalición: <b>"+NATIONS[coal.leadA].name+"</b> y <b>"+NATIONS[coal.leadD].name+"</b> firman."+(parts.length?" "+parts.join("; ")+".":" Paz blanca."),[...coal.atk,...coal.def]);
  for(const nn of [...coal.atk,...coal.def])if(nn<NPLAY&&S.nations[nn].alive&&nationProvCount(nn)===0){
    S.nations[nn].alive=false;log(NATIONS[nn].name+" ha sido borrada del mapa.");report("☠","El reino de <b>"+NATIONS[nn].name+"</b> desaparece del mapa.",[nn]);
  }
  checkVictory();
  return true;
}
// Términos que exige una coalición IA que va ganando: todos los ducados ocupados + oro por warscore.
function aiCoalitionTerms(coal,sc){return{duchies:coalCededDuchies(coal),gold:Math.round(Math.max(0,sc)*GOLD_PER_WS)};}
function underTruce(a,b){
  const t=S.truces.get(a<b?a+"|"+b:b+"|"+a);
  return t!==undefined&&S.hour<t;
}
function armiesIn(pid){return S.armies.filter(a=>a.prov===pid&&a.path.length===0)}
// VECINO NAVEGABLE del grafo UNIFICADO: S.adj mueve dentro de un medio (tierra↔tierra, mar↔mar) y
// S.seaAdj cruza costera↔tesela de mar. Así una carrera de teselas de mar es transitable de verdad.
function nbrs(c){return[...S.adj[c],...S.seaAdj[c]].filter(p=>!S.provs[p].wasteland)}
// Coste de una arista en HORAS de marcha: por tierra = km/(velocidad·terreno·camino); por mar (arista
// que toca una tesela) = cabotaje ~90 km/día. Sin esto el ejército, al ser el mar nodos, tomaría el
// barco por tener MENOS saltos aunque andar fuese más rápido. Con el coste, elige la ruta más rápida.
// EMBARCAR (tierra→mar) añade un peaje fijo (EMBARK_HOURS): así un salto corto no prefiere el mar solo
// por ser el barco más veloz — solo compensa en travesías largas o sin ruta terrestre.
function edgeHours(a,from,to){
  const F=S.provs[from],T=S.provs[to],km=kmBetween(F,T);
  if(isSea(F)||isSea(T)){
    const embark=(!isSea(F)&&isSea(T))?EMBARK_HOURS:0;    // solo al subir a bordo, no al desembarcar
    return embark+km/90*24;                               // travesía marítima (cabotaje)
  }
  const terr=(TERRAINS[F.terrain].mov+TERRAINS[T.terrain].mov)/2;
  const road=1+0.1*roadLvl(from,to);
  return km/(armySpd(a)*terr*road)*24;
}
// DIJKSTRA por tiempo sobre el grafo unificado. Devuelve la lista de nodos desde el 1er paso hasta
// `to` (sin `from`), o null. Las teselas de mar son TRÁNSITO puro: nunca las corta el filtro
// `passable` (para poder embarcar sobre agua neutral). `a` es el ejército (velocidad/caminos).
function bfsPath(from,to,passable,a){
  if(from===to)return[];
  const dist=new Map([[from,0]]),prev=new Map([[from,-1]]);
  const h=[];
  const hp=(d,i)=>{h.push([d,i]);let c=h.length-1;while(c>0){const p=(c-1)>>1;if(h[p][0]<=h[c][0])break;[h[p],h[c]]=[h[c],h[p]];c=p}};
  const hpop=()=>{const top=h[0],last=h.pop();if(h.length){h[0]=last;let c=0;for(;;){const l=2*c+1,r=l+1;let m=c;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===c)break;[h[m],h[c]]=[h[c],h[m]];c=m}}return top};
  hp(0,from);
  while(h.length){
    const[d,c]=hpop();
    if(d>(dist.get(c)??Infinity))continue;                // entrada rancia
    if(c===to)break;
    for(const nb of nbrs(c)){
      if(passable&&nb!==to&&!isSea(S.provs[nb])&&!passable(nb))continue; // el mar no lo bloquea el filtro
      const nd=d+edgeHours(a,c,nb);
      if(nd<(dist.get(nb)??Infinity)){dist.set(nb,nd);prev.set(nb,c);hp(nd,nb)}
    }
  }
  if(!prev.has(to))return null;
  const path=[];let cur=to;
  while(cur!==from){path.unshift(cur);cur=prev.get(cur)}
  return path;
}
// Arranca la siguiente pierna: UN salto a la provincia `a.path[0]` (tesela a tesela, también por mar,
// para que el ejército pueda estar y detenerse EN el mar). Duración por tierra = km/(vel·terreno·
// camino); por mar = cabotaje ~90 km/día, con el peaje de EMBARQUE al subir a bordo (tierra→mar).
function startLeg(a){
  if(!a.path.length){a.legDone=0;a.legTotal=0;return}
  const from=S.provs[a.prov],to=S.provs[a.path[0]];
  const km=kmBetween(from,to);
  if(isSea(from)||isSea(to)){
    const embark=(!isSea(from)&&isSea(to))?EMBARK_HOURS:0;       // el peaje se paga solo al embarcar
    a.legTotal=Math.max(24,embark+km/90*24);
  }else{
    const terr=(TERRAINS[from.terrain].mov+TERRAINS[to.terrain].mov)/2;
    const road=1+0.1*roadLvl(a.prov,a.path[0]); // los caminos aceleran la marcha un 10% por nivel (máx +30%)
    a.legTotal=Math.max(6,km/(armySpd(a)*terr*road)*24);
  }
  a.legDone=0;
}
// suma el tiempo (horas) de recorrer `path` (lista de nodos) partiendo de `from`
function pathHours(a,from,path){let t=0,prev=from;for(const nb of path){t+=edgeHours(a,prev,nb);prev=nb}return t;}
function orderMove(a,target,passable){
  const plan=(from)=>{let r=bfsPath(from,target,passable,a);if(r===null&&passable)r=bfsPath(from,target,null,a);return r;};
  if(!(a.path.length&&a.legDone>0)){        // parado o pierna recién arrancada: replanificar desde donde está
    const rest=plan(a.prov);
    if(rest===null)return false;
    a.path=rest;startLeg(a);
    return true;
  }
  // A MITAD DE SALTO entre A(prov) y B(path[0]): elegir CONTINUAR a B o DARSE LA VUELTA a A, lo que
  // llegue ANTES al destino contando el tramo ya recorrido. Así, si la nueva ruta pasa por A, se da la
  // vuelta al instante en vez de tocar B primero (feedback de Sergio); y si B queda de paso, sigue.
  const A0=a.prov,B0=a.path[0];
  const pB=plan(B0),pA=plan(A0);
  const tB=pB?(a.legTotal-a.legDone)+pathHours(a,B0,pB):Infinity; // seguir hasta B y desde allí
  const tA=pA?a.legDone+pathHours(a,A0,pA):Infinity;             // volver a A (cuesta lo ya andado) y desde allí
  if(!isFinite(tA)&&!isFinite(tB))return false;
  if(tA<tB){                                // darse la vuelta: espejar el tramo para regresar a A0
    const f=a.legDone/a.legTotal;
    a.prov=B0;a.path=[A0,...pA];startLeg(a); // ahora la pierna es B0→A0…
    a.legDone=Math.min(a.legTotal,(1-f)*a.legTotal); // …con el progreso espejado: seguimos en el mismo punto
  }else{                                     // continuar a B0 (se conserva el progreso del salto actual)
    a.path=[B0,...pB];
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
  const foodFull=foodFill(p); // reservas de comida de la plaza: una despensa llena aguanta más el asedio
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
  // ECONOMÍA: 1×/DÍA con dt=24 (antes: cada hora con dt=1). El recorrido de las ~3680 provincias es el 90%
  // del coste del tick y es LINEAL en dt (población: 0% de error a dt=24, verificado), así que espaciarlo
  // no cambia el resultado y da ~24× de velocidad. El ARBITRAJE internacional corre 1×/MES (era lento de
  // verdad: la muda de Flandes, ~1 expedición cada 14 meses). Movimiento/combate/construcción siguen
  // horarios (abajo). Equivalencia medida vs. todo-horario: población 0%, tesoro 1,1%.
  if(S.hour%24===0){
    const tsyBefore=S.player>=0?{...S.nations[S.player].res}:null; // foto del tesoro antes del tick económico
    economyTick2(24,true); // dt=24 (1 día); arbitraje TAMBIÉN diario (barato) para reponer gradual y evitar la oscilación mensual
    tsyTick(tsyBefore); // capa mensual: acumula el delta recurrente del jugador y publica la cifra "/mes"
    relTick(); // diplomacia: deriva mensual del campo de relaciones hacia su línea base (se autodispara al mes)
    estateBuild(); // E2: los estamentos levantan su tipo de edificio con su riqueza (1 vez/día)
    budgetManage(); // cada dueño cuadra sus cuentas (cierra lo que no puede pagar, reabre si va holgado)
  }
  degradeBuildings(); // ciclo de vida: los edificios deshabilitados se degradan y, a condición 0, se destruyen
  // 2. construcción
  for(const p of S.provs){
    if(p.buildQueue.length){
      const q=p.buildQueue[0];
      if(--q.hoursLeft<=0){
        p.buildings[q.b]++;p.buildQueue.shift();
        if(q.owner){(p.bOwner||(p.bOwner={}))[q.b]=q.owner} // E2: fija el dueño (estamento) al completar la obra
        if(p.owner===S.player&&!q.owner)log(BUILDINGS[q.b].label+" nivel "+p.buildings[q.b]+" terminada en "+p.name+".");
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
      S.roads.set(q.key,q.toLvl||((S.roads.get(q.key)||0)+1));
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
      // conquista congelada los primeros años: no se entra en TIERRA ajena (el mar es neutral y
      // transitable: no se bloquea, o no se podría cruzar para invadir una isla durante la tregua).
      if(S.hour<WAR_LOCK_HOURS&&!isSea(np)&&nc!==a.nation){
        a.path=[];a.legDone=0;a.legTotal=0;continue;
      }
      a.prov=a.path.shift();
      const p=S.provs[a.prov];
      const controller=p.occupier>=0?p.occupier:p.owner;
      if(controller!==a.nation){
        if(p.owner<NPLAY&&p.owner!==a.nation)declareWar(a.nation,p.owner,{force:true});
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
      for(const b of fxKeys("realmMoral"))realmG[n]+=BUILDINGS[b].fx.realmMoral*(p.buildings[b]||0);}
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
// Fase 7a — IA a la guerra: en vez de forzar la guerra en seco, la IA fija un objetivo (N.foe) y ESCALA la
// tensión con acciones VISIBLES (insultos, reclamaciones) hasta el umbral (−50); entonces lanza una
// COALICIÓN ofensiva (aiOpenWar) con sus aliados dispuestos. Constantes tunables (modificadores pequeños).
const PICK_FOE_CHANCE=0.0025;  // prob/turno de FIJAR un nuevo objetivo (ritmo con que antes surgían las guerras)
const ESCALATE_CHANCE=0.02;    // prob/turno de una acción de escalada (insulto o reclamación) hacia el objetivo
// Fase 7b — DIPLOMACIA AUTÓNOMA por RIVALIDADES. La IA rivaliza AMENAZAS cercanas de poder comparable/superior
// (no presa débil), y de los rivales COMUNES emergen alianzas/ligas. Constantes tunables.
const RIVAL_MIN_RATIO=0.7;     // solo es RIVAL quien tiene ≥ esto veces mi fuerza (comparable/superior; el resto es presa)
const RIVAL_EVAL_CHANCE=0.004; // prob/turno de reevaluar mis rivales (amenazas vecinas)
const DIPLO_CHANCE=0.006;      // prob/turno de dar un paso diplomático (alianza/liga) con un apto por rival común
const RIVAL_FOE_APPETITE=1.6;  // apetito extra por fijar como objetivo a un RIVAL (frente a presa cualquiera)
// Fuerza de una COALICIÓN de n contra `target`: la mía + la de mis ALIADOS que acudirían (mismo criterio que
// aiVote: no atacan a quien tienen pacto o aprecian). Permite a la IA ir a por un rival fuerte ENTRE VARIOS.
function coalitionMight(n,target){
  let m=mightOf(n);
  for(let a=0;a<NPLAY;a++){
    if(a===n||a===target||!S.nations[a]||!S.nations[a].alive)continue;
    if(hasPact(n,a)!=="alliance")continue;                 // solo aliados formales acuden al ataque
    if(hasPact(a,target)||getRel(a,target)>=25)continue;   // no atacan a quien aprecian/tienen pacto
    m+=mightOf(a);
  }
  return m;
}
// Reevalúa los RIVALES de la nación IA n: amenazas VECINAS de poder comparable/superior (no presa débil,
// ni aliados/co-miembros de liga), ordenadas por fuerza, hasta MAX_RIVALS. Rivalizar es público y estructural.
function aiPickRivals(n){
  const N=S.nations[n]; if(!N||!N.alive||!N.ai)return;
  const myMight=mightOf(n), scored=[];
  for(const m of nationNeighbors(n)){
    if(!S.nations[m]||!S.nations[m].alive)continue;
    if(hasPact(n,m)||sameLeague(n,m))continue;         // no se rivaliza a un amigo (pacto o liga)
    const mm=mightOf(m);
    if(mm<RIVAL_MIN_RATIO*myMight)continue;            // presa débil → objetivo de conquista, no rival
    scored.push([m,mm]);
  }
  scored.sort((a,b)=>b[1]-a[1]);                       // mayor amenaza primero
  N.rivals=scored.slice(0,MAX_RIVALS).map(x=>x[0]);
}
// Paso de LIGA rival-driven: entra en la MEJOR liga ajena que comparte mi rival; si ya estoy en una, salto a
// otra claramente mejor (consolidación); si no hay ninguna afín y tengo ≥2 aptos, FUNDO una. Al jugador no se
// le mete: aplicar a la liga del jugador queda PENDIENTE de su voto (no se auto-resuelve).
function aiLeagueStep(n,partners){
  const myL=leagueOf(n);
  const affic=L=>{let a=0;for(const m of L.members)if(m!==n&&sharedRivals(n,m)>=1)a++;return a;};
  let target=null,ts=-1;
  for(const L of S.leagues){
    if(myL&&L.id===myL.id)continue;
    const a=affic(L); if(a<=0)continue;                // solo ligas que comparten mi rival
    if(!myL&&!canApplyLeague(n,L.id).ok)continue;      // desde fuera: debo poder entrar (hueco+gate)
    if(myL&&L.members.length>=MAX_LEAGUE)continue;
    const s=a*10+L.members.length;                     // más afines y más grande = mejor
    if(s>ts){ts=s;target=L;}
  }
  const joinLeague=L=>{ if(applyToLeague(n,L.id).ok && !L.members.includes(S.player)) resolveApplication(L.id,n); };
  if(myL){
    if(target && ts > affic(myL)*10+myL.members.length){ leaveLeague(n); joinLeague(target); } // saltar a una mejor
    return;
  }
  if(target){ joinLeague(target); return; }            // entrar en la mejor liga afín
  if(partners.length>=2) createLeague(n);              // fundar con ≥2 aptos por rival común
}
// Paso DIPLOMÁTICO autónomo de la nación IA n (Fase 7b): con un APTO por rival común (comparte un rival
// conmigo, sin guerra/pacto/rivalidad y sin tensión), entra/funda/cambia de liga y forma una alianza con el
// más fuerte. El JUGADOR queda EXCLUIDO de la auto-alianza/auto-liga (necesita su consentimiento). El
// ritmo (probabilidad por turno) lo gobierna el llamante (aiTurn), no esta función.
function aiDiplomacy(n){
  const N=S.nations[n]; if(!N||!N.alive||!N.ai)return;
  const partners=[];
  for(let m=0;m<NPLAY;m++){
    if(m===n||m===S.player||!S.nations[m]||!S.nations[m].alive)continue; // al jugador no se le auto-alía
    if(atWar(n,m)||hasPact(n,m)||isRival(n,m))continue;
    if(sharedRivals(n,m)>=1&&getRel(n,m)>=0)partners.push(m);
  }
  if(!partners.length)return;
  aiLeagueStep(n,partners);
  let best=-1,bm=-1;for(const m of partners){if(hasPact(n,m))continue;const mm=mightOf(m);if(mm>bm){bm=mm;best=m;}}
  if(best>=0&&canPact(n,best,"alliance").ok)formPact(n,best,"alliance");
}
function aiTurn(n){
  const N=S.nations[n];
  const owned=S.provs.filter(p=>p.owner===n&&!isOccupied(p)); // no desarrollar lo ocupado
  if(!owned.length)return;
  // construir: la corona elige sus obras con la MISMA lógica que los estamentos (estates.js pickCrownBuild)
  for(let t=0;t<2;t++){
    const p=owned[(S.rand()*owned.length)|0];
    if(p.buildQueue.length)continue;
    const b=pickCrownBuild(p); if(!b)continue;
    pay(n,costFor(p,b),"Obras",BUILDINGS[b].label);
    p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
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
        pay(n,UNITS[u].cost,"Reclutamiento",UNITS[u].label);p.sold=soldAvail(p)-UNITS[u].mano;
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
  // diplomacia autónoma (Fase 7b): reevaluar rivales y, de los rivales comunes, formar alianzas/ligas
  if(S.hour>=WAR_LOCK_HOURS){
    if(S.rand()<RIVAL_EVAL_CHANCE)aiPickRivals(n);
    if(S.rand()<DIPLO_CHANCE)aiDiplomacy(n);
  }
  // guerra: declarar al vecino con el que más frontera se comparte, ponderado por debilidad
  const enemies=[];
  for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m].alive&&atWar(n,m))enemies.push(m);
  // PAZ: las levas vuelven a casa. En tiempos de paz solo se mantienen las unidades PROFESIONALES; las
  // levas (milicianos) se levantan al entrar en guerra (raiseLevies) y se licencian al firmar la paz. Así
  // el mantenimiento en paz no escala con el territorio (era la ruina de los reinos extensos y despoblados).
  if(!enemies.length)for(const a of S.armies.slice())if(a.nation===n&&a.units.miliciano>0.05)disbandUnit(a,"miliciano",a.units.miliciano);
  // engrosar con LEVAS antes de campaña: reúne levas alrededor del mayor ejército propio parado en casa
  if(enemies.length&&treasury>1500&&S.rand()<0.06){
    let host=null,hc=-1;
    for(const a of S.armies)if(a.nation===n&&!a.path.length&&!(a.muster&&S.hour<a.muster.until)&&S.provs[a.prov].owner===n&&!isOccupied(S.provs[a.prov])){
      const c=armyCount(a);if(c>hc){hc=c;host=a}
    }
    if(host&&hc<14)raiseLevies(host,6);
  }
  const day=S.hour/24;
  if(!enemies.length&&day>90&&S.hour>=WAR_LOCK_HOURS){
    // (1) validar el objetivo actual: se olvida si murió, ya hay guerra/tregua, o un pacto/liga lo blindan
    if(N.foe!=null){const F=S.nations[N.foe];
      if(!F||!F.alive||atWar(n,N.foe)||underTruce(n,N.foe)||S.pacts.has(warKey(n,N.foe))||sameLeague(n,N.foe))N.foe=null;
    }
    // (2) FIJAR objetivo (ocasional): el vecino pegado a casa y débil, si le saco ventaja de fuerza
    if(N.foe==null&&S.rand()<PICK_FOE_CHANCE){
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
        for(const a of S.navAdj[p.id])register(a,0.4); // vecino por mar (navAdj); el mar cuenta menos
      }
      let best=-1,bs=-1;
      for(const[m,e]of contact){
        if(underTruce(n,m)||S.pacts.has(warKey(n,m))||sameLeague(n,m))continue; // no fijar un objetivo bloqueado
        // VIABILIDAD: presa que bato en SOLITARIO, o un RIVAL que supero con COALICIÓN (yo + aliados)
        const solo=mightOf(n)>mightOf(m)*1.05;
        const coal=isRival(n,m)&&coalitionMight(n,m)>mightOf(m)*1.05;
        if(!(solo||coal))continue;                          // no fijo un objetivo que no puedo batir ni con aliados
        let score=e.c/(nationStrength(m)+50)/(1+e.d/350);   // vecino pegado a casa > lejano
        if(isRival(n,m))score*=RIVAL_FOE_APPETITE;          // prefiere ir a por su rival declarado
        if(score>bs){bs=score;best=m}
      }
      if(best>=0)N.foe=best;
    }
    // (3) ESCALAR hacia el objetivo con acciones VISIBLES, o DECLARAR (coalición) al alcanzar el umbral
    if(N.foe!=null){
      const foe=N.foe;
      if(getRel(n,foe)<=THRESH.war){
        aiOpenWar(n,foe); // consejo ofensivo headless: coalición con aliados dispuestos + rally del defensor
        N.foe=null;
      }else if(S.rand()<ESCALATE_CHANCE){
        // reclamar un ducado del objetivo (casus belli) o, si no queda ninguno, insultar. El parte solo se
        // emite si el objetivo es el JUGADOR (telegrafía la agresión sin inundar el periódico con IA vs IA).
        const dus=[];for(const d of S.duchies)if(d&&d.provs&&duchyOwner(d.id)===foe&&!hasClaim(n,d.id))dus.push(d);
        if(dus.length&&S.rand()<0.5){
          const d=dus[(S.rand()*dus.length)|0], r=fabricateClaim(n,d.id);
          if(r.ok&&foe===S.player)report("📜","<b>"+NATIONS[n].name+"</b> fabrica una reclamación sobre el <b>"+r.duchy+"</b>.",[n,foe]);
        }else{
          const r=insult(n,foe);
          if(r.ok&&foe===S.player)report("⚡","<b>"+NATIONS[n].name+"</b> lanza un insulto a <b>"+NATIONS[foe].name+"</b>.",[n,foe]);
        }
      }
    }
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
        const path=bfsPath(a.prov,home,pass,a);
        if(path){a.path=path;startLeg(a)}                          // marcha a casa por ruta limpia
        else{a.prov=home;a.path=[];a.legDone=0;a.legTotal=0}       // atrapado: repliegue directo
      }
    }
  }
  // paz: el bando que gana propone quedándose con 1 ducado (contiguo/por mar) u oro.
  for(const m of enemies){
    const w=getWar(n,m);if(!w)continue;
    if(w.coal)continue; // guerra de COALICIÓN: la paz es conjunta (Etapa 2), no se firma pairwise aquí
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
  // paz de COALICIÓN: si n LIDERA una coalición atacante (n===leadA), negocia por todo el bando.
  for(const [id,coal] of S.coalitions){
    if(coal.leadA!==n)continue;
    if(coal.leadD===S.player)continue; // ofrecer al jugador = Etapa 3 (UI); por ahora, solo IA vs IA
    const sc=coalScore(coal);
    if(sc>=25&&S.rand()<0.03)coalitionPeace(id,aiCoalitionTerms(coal,sc));
    else if(S.hour-coal.start>3*8760&&Math.abs(sc)<10&&S.rand()<0.01)coalitionPeace(id,{}); // larga y equilibrada: blanca
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
    if(!adj)for(const pid of d.provs){for(const a of S.navAdj[pid])if(S.provs[a].owner===n){adj=1;break}if(adj)break}
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
      for(const a of S.navAdj[c])step(a,dc+2.2); // salto por mar (navAdj: costeras a un salto corto)
    }
    ring=next;
  }
  return best;
}
function tryBuild(pid,b){
  const p=S.provs[pid];
  if(p.owner!==S.player||isOccupied(p)||buildBlock(p,b))return;
  if(obsolete2(b)||(BLD2[b]&&!siteOK2(p,b)))return;   // heredado de la v1 (no hace nada) o taller sin su materia prima
  if(!canAfford(S.player,costFor(p,b)))return; // solvencia sobre el saldo comprometido (tesoro mensual)
  pay(S.player,costFor(p,b),"Obras",BUILDINGS[b].label);
  p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
  refreshSide();refreshTop();refreshBuildBar();
}
// rally = provincia a la que la unidad marchará al terminar (auto-rally; p.ej. reunirse con un
// ejército seleccionado). Si es null o la misma provincia, la unidad se queda donde se recluta.
function tryRecruit(pid,u,rally){
  const p=S.provs[pid];
  if(p.owner!==S.player||isOccupied(p))return false;
  const U=UNITS[u];
  for(const r in U.req)if(p.buildings[r]<U.req[r])return false;
  if(!canAfford(S.player,U.cost)||soldAvail(p)<U.mano)return false;
  pay(S.player,U.cost,"Reclutamiento",U.label);p.sold=soldAvail(p)-U.mano;
  const q={u,nation:S.player,hoursLeft:recruitTime(p,u)};
  if(rally!=null&&rally!==pid)q.rally=rally; // marchará a reunirse (profesionales y levas por igual)
  p.recruitQueue.push(q);
  refreshSide();refreshTop();
  return true;
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
        pay(nat,U.cost,"Reclutamiento",U.label);p.sold=soldAvail(p)-U.mano;
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
  getWar, warscore, duchyValue, occupiedDuchiesBy, bestDuchyToTake, syncDuchyOcc, fortGarrison, siegeNeed, report,
  coalScore, coalMemberScore, coalitionPeace, coalitionOf, coalCededDuchies,
  mightOf, coalitionMight, aiPickRivals, aiDiplomacy
};
