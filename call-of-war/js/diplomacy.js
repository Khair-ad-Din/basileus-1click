// diplomacy.js — RELACIONES ENTRE PAÍSES (feature en construcción; ver memoria basileus-diplomacy-design).
//
// Modelo: UN campo COMPARTIDO por par de naciones, de −100 (máxima TENSIÓN) a +100 (máxima CONCORDIA).
// No es el modelo bilateral de EU (A opina de B y viceversa): es UN número que ambos empujan. Ese número
// = aportes ESTRUCTURALES permanentes-mientras-activos (guerra, frontera, y futuros alianza/embargo/
// mercado) + IMPULSOS que DECAEN cada uno a su ritmo (insultos y regalos ~1,5 años; conquista: alarma del
// vecino ~4 años, rencor de la víctima ~12 años). Un mismo número para el jugador, pero cada aporte se
// olvida a su velocidad; `relBreakdown` da el desglose para el tooltip. Los umbrales (declarar guerra ≤
// −50, aliarse ≥ +50…) leen la relación efectiva. La "infamia" NO es un escalar aparte: conquistar reparte
// tensión (impulsos) a la víctima y a los vecinos.
import { NPLAY, START_DATE } from "./config.js";
import { S } from "./state.js";

const REL_MIN=-100, REL_MAX=100;
// UMBRALES del campo que gatean las acciones (el eje es continuo; estos son los cortes de reglas).
const THRESH={war:-50, embargo:-35, nap:10, league:25, alliance:50};
// La relación a↔b = aportes ESTRUCTURALES (permanentes mientras dure la condición: guerra, frontera, y
// futuros alianza/embargo/mercado) + IMPULSOS que DECAEN a su propio ritmo (insultos, regalos, conquista).
// Los impulsos se guardan por TIPO en S.rel (Map "a|b" → {tipo:valor}); un mismo tipo se ACUMULA.
// getRel = estructural + Σ impulsos. Lo permanente se COMPUTA (no se guarda); lo que decae se guarda.
const BASE_WAR=-80;     // estructural: EN GUERRA (mientras dure)
const BASE_BORDER=-10;  // estructural: FRONTERA compartida (mientras sean vecinos)
// RETENCIÓN mensual por tipo de impulso (1=nunca se olvida; <1 decae). Comentario = ~años hasta caer a ~10%.
const DECAY={insult:0.88, gift:0.88, claim:0.93, conqNbr:0.953, conqVic:0.984}; // ~1,5 · 1,5 · 2,5 · 4 · 12 años
const IMP_LABEL={insult:"Insultos",gift:"Regalos",claim:"Reclamación",conqNbr:"Conquista (vecino)",conqVic:"Conquista (rencor)",debug:"(fijado)"};

function clamp(x){return x<REL_MIN?REL_MIN:x>REL_MAX?REL_MAX:x}
function monthKeyOf(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCFullYear()*12+d.getUTCMonth()}
// Clave simétrica por par (idéntico patrón a warKey en sim.js): el campo es UNO solo para a↔b.
function relKey(a,b){return a<b?a+"|"+b:b+"|"+a}

// Aporte ESTRUCTURAL (permanente mientras dure la condición): guerra o frontera (y futuros alianza/
// embargo/mercado). Se COMPUTA de otro estado, no se guarda.
function structural(a,b){
  if(atWarPair(a,b))return BASE_WAR;
  return nationAdjSet().has(relKey(a,b))?BASE_BORDER:0;
}
// Suma de los IMPULSOS guardados del par (los que decaen).
function impSum(a,b){const m=S.rel.get(relKey(a,b));if(!m)return 0;let s=0;for(const k in m)s+=m[k];return s;}
// Relación efectiva a↔b = estructural + impulsos, con clamp [−100,+100]. Negativo=Tensión, positivo=Concordia.
function getRel(a,b){if(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY)return 0;return clamp(structural(a,b)+impSum(a,b));}
// Añade un IMPULSO de un TIPO al par (se acumula con los del mismo tipo; decae según DECAY[tipo]).
// Devuelve la relación efectiva resultante. Toda acción de tensión/concordia pasa por aquí.
function addImpulse(a,b,type,delta){
  if(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY||!delta)return getRel(a,b);
  const key=relKey(a,b); let m=S.rel.get(key); if(!m){m={};S.rel.set(key,m);}
  m[type]=(m[type]||0)+delta;
  if(Math.abs(m[type])<1e-6)delete m[type];
  if(!Object.keys(m).length)S.rel.delete(key);
  return getRel(a,b);
}
// Fija la relación a un valor absoluto (debug/consola): resetea los impulsos del par a uno "fijado".
function setRel(a,b,val){
  if(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY)return 0;
  const key=relKey(a,b), need=clamp(val)-structural(a,b);
  if(Math.abs(need)<1e-6)S.rel.delete(key); else S.rel.set(key,{debug:need});
  return getRel(a,b);
}
// Desglose de la relación para el tooltip: lista de {label, v} de cada aporte activo (estructural + impulsos).
function relBreakdown(a,b){
  const out=[];
  if(atWarPair(a,b))out.push({label:"Guerra",v:BASE_WAR});
  else if(nationAdjSet().has(relKey(a,b)))out.push({label:"Frontera",v:BASE_BORDER});
  const m=S.rel.get(relKey(a,b));
  if(m)for(const k in m)if(Math.abs(m[k])>=0.5)out.push({label:IMP_LABEL[k]||k,v:m[k]});
  return out;
}

// Etiqueta cualitativa del tier (el eje es continuo; esto es solo para UI y lectura de umbrales).
//  ≤ −50 hostil (guerra posible) · (−50,−15] tenso · (−15,15) neutral · [15,50) cordial · ≥ 50 aliado posible
function relTier(v){
  if(v<=-50)return{key:"hostil",label:"Hostil",color:"#d06b6b"};
  if(v<=-15)return{key:"tenso",label:"Tenso",color:"#cf9b5a"};
  if(v<15)return{key:"neutral",label:"Neutral",color:"#9aa3ad"};
  if(v<50)return{key:"cordial",label:"Cordial",color:"#8fb06a"};
  return{key:"aliado",label:"Amistoso",color:"#6ba7d0"};
}

// ¿A y B están en guerra? (S.wars usa la MISMA clave simétrica que relKey → consulta directa sin importar sim.js)
function atWarPair(a,b){return S.wars.has(relKey(a,b))}

// Conjunto de pares de naciones que COMPARTEN frontera (terrestre o marítima). Se recalcula una vez
// al mes (barrido de bordes de provincia) y se cachea; base de la deriva estructural.
let _adjMonth=-1, _adjSet=null;
function nationAdjSet(){
  const mk=monthKeyOf(S.hour);
  if(mk===_adjMonth&&_adjSet)return _adjSet;
  _adjMonth=mk;_adjSet=new Set();
  for(const p of S.provs){
    if(!p||p.wasteland||p.owner<0||p.owner>=NPLAY)continue;
    const nbs=S.adj[p.id]; if(!nbs)continue;
    for(const nb of nbs){
      const q=S.provs[nb];
      if(!q||q.wasteland||q.owner<0||q.owner>=NPLAY||q.owner===p.owner)continue;
      _adjSet.add(relKey(p.owner,q.owner));
    }
  }
  return _adjSet;
}

// Tick MENSUAL: los IMPULSOS guardados decaen según su tipo (lo estructural no se guarda → no decae);
// y la agresión reciente se olvida. Se autodispara al cambiar de mes (mismo patrón que prosperityTick).
function relTick(){
  const mk=monthKeyOf(S.hour);
  if(mk===S.relMonthKey)return;
  S.relMonthKey=mk;
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(N&&N.aggro)N.aggro*=AGGRO_DECAY;}
  for(const [key,m] of S.rel){
    for(const k in m){const r=DECAY[k];if(r==null)continue;m[k]*=r;if(Math.abs(m[k])<0.05)delete m[k];}
    if(!Object.keys(m).length)S.rel.delete(key);
  }
}

// ================= ACCIONES (Fase 4) =================
// Las funciones de acción SOLO tocan estado (rel, res, cooldowns) y devuelven un resultado {ok,...};
// el report()/log()/refresh de UI lo hace el handler en main.js (mantiene diplomacy.js desacoplado).
const INSULT_DELTA=4;    // cada insulto sube la tensión (baja rel) en esto
const INSULT_CD_H=730;   // cooldown ≈ 1 mes entre insultos al mismo país (anti-spam del campo compartido)
const GIFT_MAX=20;       // concordia máxima que da un SOLO regalo (saturación: no se compra +100 barato)
const GIFT_REF=2000;     // ducados para media saturación del regalo (2000→+10, 6000→+15…). Tunable.

// Cooldowns de acción: clave "accion|par simétrico" → hora hasta la que no se repite.
function cdKey(action,a,b){return action+"|"+relKey(a,b)}
function onCooldown(action,a,b){const t=S.dipCd.get(cdKey(action,a,b));return t!=null&&S.hour<t}
function setCooldown(action,a,b,hours){S.dipCd.set(cdKey(action,a,b),S.hour+hours)}
function validPair(a,b){return !(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY)}

// ¿Se puede insultar ya? (cooldown). Devuelve {ok, until} para la UI.
function canInsult(a,b){
  if(!validPair(a,b))return{ok:false};
  const t=S.dipCd.get(cdKey("insult",a,b));
  return{ok:!(t!=null&&S.hour<t), until:t||0};
}
// INSULTAR: gesto hostil barato → sube la tensión. Cooldown para que no se spamee.
function insult(a,b){
  if(!validPair(a,b))return{ok:false,reason:"invalido"};
  if(onCooldown("insult",a,b))return{ok:false,reason:"cooldown"};
  const rel=addImpulse(a,b,"insult",-INSULT_DELTA);
  setCooldown("insult",a,b,INSULT_CD_H);
  return{ok:true,rel,delta:-INSULT_DELTA};
}
// REGALAR DUCADOS: transfiere oro de a→b y sube la concordia con saturación (regalo grande → rendimiento
// decreciente). El importe se topa a lo que a tiene en caja.
function giftGold(a,b,amount){
  if(!validPair(a,b))return{ok:false,reason:"invalido"};
  amount=Math.max(0,Math.floor(amount||0));
  const have=(S.nations[a].res.dinero)||0, amt=Math.min(amount,have);
  if(amt<=0)return{ok:false,reason:"sinfondos"};
  S.nations[a].res.dinero-=amt;
  S.nations[b].res.dinero=((S.nations[b].res.dinero)||0)+amt;
  const gain=GIFT_MAX*amt/(amt+GIFT_REF);
  const rel=addImpulse(a,b,"gift",gain);
  return{ok:true,given:amt,gain,rel};
}

// ---- EMBARGO (Fase 4b): estado + helpers, SIN efecto económico todavía. El comercio es GLOBAL (pool de
// arbitraje en economy.js), así que un embargo por par no puede morder hasta que LOCALICEMOS el comercio.
// Se deja la maquinaria y el helper isEmbargoed listos; el enganche en el bucle de arbitraje será un
// one-liner (`if(isEmbargoed(A.idx,B.idx))…`) cuando exista comercio bilateral/regional. Mutuo por par.
function isEmbargoed(a,b){return validPair(a,b)&&S.embargoes.has(relKey(a,b))}
function setEmbargo(a,b,on){
  if(!validPair(a,b))return false;
  const k=relKey(a,b);
  if(on)S.embargoes.add(k); else S.embargoes.delete(k);
  return true;
}

// ---- RECLAMACIONES (Fase 4b): un país fabrica un derecho sobre un DUCADO de otro. Guarda el casus belli
// (la Fase 5 lo usará para ANULAR el abanico de infamia al conquistar ese ducado) y es un acto hostil →
// sube la tensión con el dueño. Clave "reclamante|duchyId".
const CLAIM_TENSION=6;   // la fabricación provoca al dueño (sube tensión). Tunable.
function claimKey(nation,duchyId){return nation+"|"+duchyId}
function hasClaim(nation,duchyId){return S.claims.has(claimKey(nation,duchyId))}
function duchyOwner(duchyId){const d=S.duchies[duchyId];return d?S.provs[d.cap].owner:-1}
function fabricateClaim(claimant,duchyId){
  const d=S.duchies[duchyId]; if(!d)return{ok:false,reason:"noduchy"};
  const owner=duchyOwner(duchyId);
  if(owner<0||owner>=NPLAY||owner===claimant)return{ok:false,reason:"propio"};
  if(hasClaim(claimant,duchyId))return{ok:false,reason:"yareclamado"};
  S.claims.add(claimKey(claimant,duchyId));
  const rel=addImpulse(claimant,owner,"claim",-CLAIM_TENSION);
  return{ok:true,owner,rel,duchy:d.name,delta:-CLAIM_TENSION};
}

// ---- INFAMIA = REPARTO DE TENSIÓN (Fase 5) ----
// NO hay escalar global de infamia: conquistar un ducado reparte un golpe de tensión a cada país VECINO
// (del ducado o del agresor) — terceros alarmados. El casus belli (reclamación previa sobre ese ducado)
// ANULA el abanico. El golpe escala con el tamaño del ducado, la AGRESIÓN RECIENTE del agresor (evita la
// bola de nieve del conquistador en serie) y la AFINIDAD del candidato con la víctima. Decae solo (la
// deriva mensual + el decaimiento de N.aggro). Filosofía de Sergio: modificadores pequeños y stackeables.
// Modelo PLANO y transparente (el jugador puede calcularlo de cabeza), sin afinidad:
//   tensión a cada país afectado = TENSION_PER_PROV·(provincias del ducado) + agresión reciente
//   + DUCHY_NBR_BONUS extra si BORDEA el ducado conquistado (está más afectado que un vecino lejano tuyo).
// Afectados = vecinos del DUCADO ∪ vecinos del AGRESOR (menos el agresor y la víctima). "Amigo o no" da igual.
const TENSION_PER_PROV=1;   // tensión (a los VECINOS) por PROVINCIA conquistada del ducado (plano)
const DUCHY_NBR_BONUS=2;    // tensión ADICIONAL para quien bordea el ducado conquistado
const VICTIM_PER_PROV=4;    // tensión (RENCOR) a la VÍCTIMA por provincia: bastante más y decae lentísimo
const AGGRO_DECAY=0.9;      // la agresión reciente (N.aggro, sumando plano) se olvida ×esto cada mes (en relTick)

// Vecinas de una nación (naciones que comparten frontera con n).
function nationNeighbors(n){
  const adj=nationAdjSet(), out=new Set();
  for(const k of adj){const i=k.indexOf("|"),a=+k.slice(0,i),b=+k.slice(i+1);if(a===n)out.add(b);else if(b===n)out.add(a);}
  return out;
}
// Reparte la "infamia" de que `to` conquiste el ducado `duchyId` a `from`. Llamar ANTES de transferDuchy
// (con `from` aún de dueño). Devuelve {claim, base, hits:[{n,hit}]} para que el llamante informe si quiere.
function conquestFanout(to,from,duchyId){
  const d=S.duchies[duchyId]; if(!d||to<0||to>=NPLAY)return{claim:false,base:0,hits:[]};
  if(hasClaim(to,duchyId)){S.claims.delete(claimKey(to,duchyId));return{claim:true,base:0,hits:[]};} // casus belli: sin reacción; consume la reclamación
  const N=S.nations[to]; if(!N)return{claim:false,base:0,hits:[]};
  const extra=Math.round(N.aggro||0);                 // conquistas recientes previas (sumando plano)
  const base=TENSION_PER_PROV*d.provs.length+extra;
  const vic=VICTIM_PER_PROV*d.provs.length+extra;     // rencor de la víctima (mayor)
  N.aggro=(N.aggro||0)+1;                              // esta conquista cuenta para las próximas (decae en relTick)
  // la VÍCTIMA guarda rencor (impulso conqVic, decae lentísimo ~12 años)
  if(from>=0&&from<NPLAY&&S.nations[from]&&S.nations[from].alive)addImpulse(to,from,"conqVic",-vic);
  // vecinos del DUCADO conquistado
  const duchyNbrs=new Set();
  for(const pid of d.provs)for(const nb of (S.adj[pid]||[])){const q=S.provs[nb];if(q&&!q.wasteland&&q.owner>=0&&q.owner<NPLAY)duchyNbrs.add(q.owner);}
  // afectados = vecinos del ducado ∪ vecinos del agresor (impulso conqNbr, decae ~4 años)
  const cand=new Set(duchyNbrs);
  for(const c of nationNeighbors(to))cand.add(c);
  cand.delete(to);cand.delete(from);
  const hits=[];
  for(const c of cand){
    if(!S.nations[c]||!S.nations[c].alive)continue;
    const hit=base+(duchyNbrs.has(c)?DUCHY_NBR_BONUS:0);
    addImpulse(to,c,"conqNbr",-hit);
    hits.push({n:c,hit});
  }
  return{claim:false,base,vic,hits};
}

// ¿Puede A declararle la guerra a B según la tensión? (la línea dura del gate; el jugador la usa en la UI)
// Devuelve {ok, need} donde need = tensión que aún falta (0 si ya se cumple).
function canDeclareWar(a,b){
  const cur=getRel(a,b), ok=cur<=THRESH.war;
  return{ok, need:ok?0:cur-THRESH.war}; // p.ej. cur=-20 → faltan 30 puntos de tensión
}

export { relKey, getRel, setRel, addImpulse, relBreakdown, relTier, relTick, nationAdjSet, THRESH, canDeclareWar,
  insult, giftGold, canInsult, isEmbargoed, setEmbargo, fabricateClaim, hasClaim, duchyOwner,
  conquestFanout, nationNeighbors };
