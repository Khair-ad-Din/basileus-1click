// sim.js
import { BUILDINGS, NATIONS, NEUTRAL, NPLAY, RES_KEYS, START_STOCK, TERRAINS, UNITS } from "./config.js";
import { S } from "./state.js";
import { armyAtk, armyCount, armyDef, armyHp, armySpd, buildBlock, buildMax, canAfford, costFor, foodBalance, foodCap, foodCons, FOOD_PRICE, lvlOf, nationProvCount, nationStrength, NEED_PC, NEED_PRICE, pay, provDefMul, provEconomy, recruitTime, soldAvail, soldCap, timeFor } from "./economy.js";
import { hasRoad, kmBetween, roadKey } from "./mapgen.js";
import { drawRoads, repaintProvince } from "./render.js";
import { saveGame } from "./save.js";
import { log, refreshBuildBar, refreshSide, refreshTop } from "./ui.js";

// POPs: 1 tick = 1 hora de juego (8760/año). Ver [[basileus-pop-economy-vision]].
const SOLD_REGEN=0.0012;          // la soldadesca recupera este % del hueco hasta su techo, por tick
// Fase 2 (demografía por comida):
const POP_GROWTH_BASE=0.008/8760; // crecimiento con la despensa llena ≈1.1%/año; escala con el llenado
const STARVE_RATE=0.6;            // en hambruna, fracción del déficit que se lleva por delante a la población
const FAMINE_DEF=0.12;            // déficit (fracción del consumo sin cubrir) por encima del cual hay hambruna

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
    const start={infanteria:2,miliciano:2};
    if(S.nations[n].startProvs>=12)start.blindadoLigero=2; // las grandes potencias empiezan con caballería
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
      // nación pequeña: el refuerzo se integra en el ejército de la capital
      const a=S.armies.find(x=>x.nation===n&&x.prov===cap);
      if(a)a.units.infanteria=(a.units.infanteria||0)+T;
    }else if(posts.length===1){
      spawnArmy(n,posts[0].id,{infanteria:T});
    }else{
      const h=Math.ceil(T/2);
      spawnArmy(n,posts[0].id,{infanteria:h});
      spawnArmy(n,posts[1].id,{infanteria:T-h});
    }
  }
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
function atWar(a,b){
  if(a===b)return false;
  if(a===NEUTRAL||b===NEUTRAL)return true;
  return S.wars.has(a<b?a+"|"+b:b+"|"+a);
}
function declareWar(a,b){
  if(a===NEUTRAL||b===NEUTRAL||a===b||atWar(a,b))return;
  S.wars.add(a<b?a+"|"+b:b+"|"+a);
  log(NATIONS[a].name+" declara la guerra a "+NATIONS[b].name+".");
}
function makePeace(a,b){
  S.wars.delete(a<b?a+"|"+b:b+"|"+a);
  S.truces.set(a<b?a+"|"+b:b+"|"+a,S.hour+17520); // tregua de 2 años para la IA
  // detener las marchas contra el ex-enemigo (si no, la llegada re-declara la guerra)
  for(const ar of S.armies){
    if(ar.nation!==a&&ar.nation!==b)continue;
    const other=ar.nation===a?b:a;
    if(ar.path.some(p=>S.provs[p].owner===other)){ar.path=[];ar.legDone=0;ar.legTotal=0}
  }
  log("Paz firmada entre "+NATIONS[a].name+" y "+NATIONS[b].name+".");
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
function captureProv(pid,nation){
  const p=S.provs[pid];
  const old=p.owner;
  p.owner=nation;p.morale=25;p.buildQueue=[];p.recruitQueue=[];
  repaintProvince(pid);
  if(nation===S.player||old===S.player)log(NATIONS[nation].name+" captura "+p.name+".");
  if(old<NPLAY&&nationProvCount(old)===0){
    S.nations[old].alive=false;
    log(NATIONS[old].name+" ha sido eliminada del mapa.");
  }
  checkVictory();
}
function hourTick(){
  S.hour++;
  // 0. mano de obra movilizada por provincia (soldados que dejaron el trabajo): retira dotación
  for(const p of S.provs)p.mob=0;
  for(const a of S.armies)if(a.src)for(const pid in a.src){const P=S.provs[pid];if(P)P.mob+=a.src[pid]}
  // 1. economía y moral
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const R=S.nations[n].res;
    // bono de moral al reino por obras únicas (catedral…)
    let realmMor=0;
    for(const p of S.provs)if(p.owner===n)for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.realmMoral)realmMor+=fx.realmMoral*lvlOf(p,b)}
    let nationPop=0;
    for(const p of S.provs){
      if(p.owner!==n)continue;
      if(!p.wasteland)nationPop+=p.pop||0;
      const e=provEconomy(p);
      for(const k in e.res)R[k]+=e.res[k];
      // moral: recuperación lenta hacia su techo (100 + fe/prestigio)
      let mreg=0.004;
      for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.moral)mreg+=fx.moral*lvlOf(p,b)}
      const cap=Math.min(100,90+realmMor);
      if(p.morale<cap)p.morale=Math.min(cap,p.morale+mreg);
    }
    // mantenimiento: sostener el ejército es lo caro, como en la época
    let troops=0;
    for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
    R.dinero-=0.6*troops;
    R.comida-=0.5*troops;
    // necesidades de confort de la población (madera/paño/vino/sal): consumo del stock, compra en
    // el mercado con ducados si falta, y desabastecimiento (baja moral) si tampoco alcanza el dinero
    let unmet=0;
    for(const k in NEED_PC){
      let need=nationPop*NEED_PC[k]-R[k];
      if(need<=0){R[k]-=nationPop*NEED_PC[k];continue}  // hay stock: se consume
      R[k]=0;                                            // agotado el stock; el resto se compra
      const canBuy=Math.min(need,R.dinero/NEED_PRICE[k]);
      R.dinero-=canBuy*NEED_PRICE[k];
      unmet+=(need-canBuy)/Math.max(1,nationPop*NEED_PC[k]); // fracción de la necesidad sin cubrir
    }
    if(unmet>0){const drop=Math.min(0.03,unmet*0.03);for(const p of S.provs)if(p.owner===n&&!p.wasteland&&p.morale>25)p.morale=Math.max(25,p.morale-drop)}
    for(const k of RES_KEYS)if(R[k]<0)R[k]=0; // ningún recurso baja de 0 (impagos = escasez)
  }
  // 1b. comida, población y soldadesca (por provincia)
  for(const p of S.provs){
    if(p.wasteland)continue;
    // despensa: acumula el excedente, se vacía con el déficit; su llenado impulsa el crecimiento
    const cap=foodCap(p);
    if(p.food==null)p.food=cap*0.6;
    p.food+=foodBalance(p);
    if(p.food>cap)p.food=cap;
    let famine=false;
    if(p.food<0){
      let deficit=-p.food;p.food=0;
      if(p.owner<NPLAY){ // alivio: el reino compra grano en el mercado para paliar la hambruna
        const R=S.nations[p.owner].res;
        const relief=Math.min(deficit,(R.dinero||0)/FOOD_PRICE);
        if(relief>0){R.dinero-=relief*FOOD_PRICE;deficit-=relief}
      }
      const cons=foodCons(p);
      if(cons>0&&deficit/cons>FAMINE_DEF){p.pop=Math.max(0,(p.pop||0)-deficit*STARVE_RATE);famine=true} // hambruna
    }
    p.famine=famine;
    if(!famine){                                     // crecimiento ligado al excedente almacenado
      const fill=cap>0?p.food/cap:0;
      p.pop=(p.pop||0)*(1+POP_GROWTH_BASE*(0.4+fill));
    }
    if(p.owner<NPLAY){
      const sc=soldCap(p),s=p.sold!=null?p.sold:sc;
      p.sold=s+(sc-s)*SOLD_REGEN;                     // la soldadesca tiende a su techo (= %pop)
    }
  }
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
          if(q.nation===S.player)log(UNITS[q.u].label+" reclutado en "+p.name+".");
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
      a.prov=a.path.shift();
      const p=S.provs[a.prov];
      if(p.owner!==a.nation){
        if(p.owner<NPLAY)declareWar(a.nation,p.owner);
        const defenders=armiesIn(a.prov).filter(x=>x.nation===p.owner);
        if(defenders.length===0){
          captureProv(a.prov,a.nation);
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
    for(const p of S.provs){
      if(p.wasteland)continue;
      let hostile=0;
      for(const a of S.adj[p.id])if(!S.provs[a].wasteland&&S.provs[a].owner!==p.owner&&atWar(p.owner,S.provs[a].owner))hostile++;
      const target=Math.max(25,(p.capital?85:75)-6*hostile);
      p.morale+=Math.max(-4,Math.min(4,target-p.morale));
      p.morale=Math.max(5,Math.min(100,p.morale));
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
  for(const[pid,list]of byProv){
    const p=S.provs[pid];
    const def=list.filter(a=>a.nation===p.owner);
    const atk=list.filter(a=>a.nation!==p.owner&&atWar(a.nation,p.owner));
    if(!atk.length)continue;
    if(!def.length){captureProv(pid,atk[0].nation);continue}
    S.battleFlash[pid]=S.hour;
    const terr=TERRAINS[p.terrain].def;
    const A=atk.reduce((s,a)=>s+armyAtk(a),0);
    const fort=provDefMul(p);
    const D=def.reduce((s,a)=>s+armyDef(a),0)*fort*terr;
    const hpA=atk.reduce((s,a)=>s+armyHp(a),0);
    const hpD=def.reduce((s,a)=>s+armyHp(a),0);
    // batallas y asedios se resuelven en días de juego, no en horas
    const dmgToDef=A*0.04/(fort*terr);
    const dmgToAtk=D*0.04;
    applyDamage(def,dmgToDef,hpD);
    applyDamage(atk,dmgToAtk,hpA);
    p.morale=Math.max(5,p.morale-0.05);
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
function aiTurn(n){
  const N=S.nations[n];
  const owned=S.provs.filter(p=>p.owner===n);
  if(!owned.length)return;
  // construir: prioridad militar en la capital, economía en el resto
  for(let t=0;t<2;t++){
    const p=owned[(S.rand()*owned.length)|0];
    if(p.buildQueue.length)continue;
    // orden de preferencia según recurso de la provincia y si es capital
    const pri=[];
    if(p.capital){pri.push("cuartel","fabrica","fortaleza","templo","mercado");}
    const byRes={comida:"granja",materiales:"aserradero",piedra:"cantera",metal:"mina"};
    if(byRes[p.resType])pri.push(byRes[p.resType]);
    pri.push("mercado","gremio","granja","templo","cuartel","fabrica","campo");
    if(p.coastal)pri.push("puerto");
    for(const b of pri){
      if(lvlOf(p,b)>=buildMax(p,b))continue;
      if(buildBlock(p,b))continue;
      pay(n,costFor(p,b));
      p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
      break;
    }
  }
  // reclutar
  let troops=0;
  for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  if(troops<6+owned.length){
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
  // guerra: declarar al vecino con el que más frontera se comparte, ponderado por debilidad
  const enemies=[];
  for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m].alive&&atWar(n,m))enemies.push(m);
  const day=S.hour/24;
  if(!enemies.length&&day>90&&S.rand()<0.001){ // las guerras surgen cada pocos años, no cada semana
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
    if(best>=0&&nationStrength(n)>nationStrength(best)*1.3)declareWar(n,best);
  }
  // mover ejércitos (la guarnición por provincia se precalcula una vez por turno)
  const wantNeutral=day>1;
  const garrison=new Map();
  for(const g of S.armies){
    if(g.path.length)continue;
    garrison.set(g.prov,(garrison.get(g.prov)||0)+armyDef(g));
  }
  for(const a of S.armies){
    if(a.nation!==n||a.path.length)continue;
    if(armyCount(a)<1.5)continue;
    if(S.provs[a.prov].capital&&armiesIn(a.prov).filter(x=>x.nation===n).length<=1&&enemies.length)continue;
    const target=findTarget(a.prov,n,enemies,wantNeutral,armyAtk(a)+armyDef(a),garrison);
    if(target>=0){
      // no cruzar territorio de terceros pacíficos (evita declaraciones de guerra al pasar)
      const pass=p=>{const o=S.provs[p].owner;return o===n||o===NEUTRAL||enemies.includes(o)};
      orderMove(a,target,pass);
    }
  }
  // paz si va muy mal
  for(const m of enemies){
    if(m===S.player)continue;
    if(nationStrength(n)<nationStrength(m)*0.4&&S.rand()<0.015)makePeace(n,m);
  }
}
function findTarget(from,n,enemies,wantNeutral,myPower,garrison){
  // Explora por anillos puntuando candidatos en vez de devolver el primero:
  // cerca > lejos, la travesía marítima cuesta más que la terrestre, una
  // provincia rodeada por territorio propio tiene prioridad máxima, y la
  // lejanía respecto a la CAPITAL penaliza (el país se expande alrededor de
  // su núcleo, no alrededor de sus conquistas avanzadas).
  const capId=S.nations[n].capital;
  const capP=capId>=0?S.provs[capId]:S.provs[from];
  const seen=new Map([[from,0]]);
  let ring=[from];
  let best=-1,bs=-1e9;
  for(let d=0;d<7&&ring.length;d++){
    const next=[];
    for(const c of ring){
      const dc=seen.get(c);
      const step=(a,cost)=>{
        if(seen.has(a))return;
        seen.set(a,cost);
        if(S.provs[a].wasteland)return; // ni objetivo ni tránsito
        next.push(a);
        const o=S.provs[a].owner;
        let s;
        if(enemies.includes(o))s=10;
        else if(wantNeutral&&o===NEUTRAL&&myPower>(garrison.get(a)||0)*1.6)s=4;
        else return;
        s-=cost*1.6;
        s-=Math.hypot(S.provs[a].x-capP.x,S.provs[a].y-capP.y)/90; // atracción de la capital
        let mine=0,tot=0;
        for(const b of S.adj[a]){if(S.provs[b].wasteland)continue;tot++;if(S.provs[b].owner===n)mine++}
        if(tot)s+=6*mine/tot; // bonus de cerco: enclaves y bolsas primero
        if(S.provs[a].capital)s+=1.5;
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
  if(p.owner!==S.player||buildBlock(p,b))return;
  pay(S.player,costFor(p,b));
  p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
  refreshSide();refreshTop();refreshBuildBar();
}
function tryRecruit(pid,u){
  const p=S.provs[pid];
  if(p.owner!==S.player)return;
  const U=UNITS[u];
  for(const r in U.req)if(p.buildings[r]<U.req[r])return;
  if(!canAfford(S.player,U.cost)||soldAvail(p)<U.mano)return;
  pay(S.player,U.cost);p.sold=soldAvail(p)-U.mano;
  p.recruitQueue.push({u,nation:S.player,hoursLeft:recruitTime(p,u)});
  refreshSide();refreshTop();
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
  atWar, declareWar, makePeace, underTruce, spawnArmy, setupNations, tryRoad, nbrs, bfsPath, startLeg, orderMove, captureProv, hourTick, resolveBattles, applyDamage, mergeIdle, aiTurn, findTarget, tryBuild, tryRecruit, checkVictory, armiesIn
};
