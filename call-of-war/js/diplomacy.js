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
import { NPLAY, NATIONS, START_DATE } from "./config.js";
import { S } from "./state.js";
import { recCrown } from "./economy.js";

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
const DECAY={insult:0.88, gift:0.88, claim:0.93, conqNbr:0.953, conqVic:0.984, betray:0.976}; // ~1,5·1,5·2,5·4·12·8 años
const IMP_LABEL={insult:"Insultos",gift:"Regalos",claim:"Reclamación",conqNbr:"Conquista (vecino)",conqVic:"Conquista (rencor)",betray:"Traición",debug:"(fijado)"};
// PACTOS (Fase 6): aportes ESTRUCTURALES (+ mientras el pacto esté activo). Romperlos = impulso "betray".
const NAP_BONUS=5;        // no agresión: leve concordia estructural mientras dure
const ALLY_BONUS=15;      // alianza: concordia estructural mayor
const BETRAY_TENSION=30;  // golpe de tensión (impulso "betray", decae ~8 años) al traicionado al ROMPER un pacto
const BETRAY_FANOUT=8;    // reputación: tensión a TERCEROS (vecinos de ambos) — quedas como poco fiable
// LIGAS DEFENSIVAS (Fase 6c): la liga es una ORGANIZACIÓN multi-miembro, no un pacto por par.
const MAX_LEAGUE=5;        // tope de miembros por liga (evita el 'blob' que arrastra a media Europa; tunable)
const LEAGUE_BONUS=5;      // concordia ESTRUCTURAL entre cada par de co-miembros (mientras compartan liga)
const LEAGUE_ADMIT_MIN=0;  // un miembro vota SÍ a admitir a un aspirante si no está tenso con él (getRel≥esto)
const LEAGUE_EXPEL_MAX=0;  // un miembro vota expulsar a otro si su relación con él cayó por debajo (getRel<esto)
// RIVALIDADES (Fase 7b): declaración PÚBLICA (visible para todos) de rivalidad. Motor de alianzas/ligas.
const MAX_RIVALS=3;         // rivales máximos por nación
const RIVAL_TENSION=15;     // tensión ESTRUCTURAL entre rivales (en cualquier dirección) mientras dure
const COMMON_RIVAL_BONUS=12;// concordia ESTRUCTURAL por cada RIVAL COMÚN (ambos rivalizan a un tercero), tope 2

function clamp(x){return x<REL_MIN?REL_MIN:x>REL_MAX?REL_MAX:x}
function monthKeyOf(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCFullYear()*12+d.getUTCMonth()}
// Clave simétrica por par (idéntico patrón a warKey en sim.js): el campo es UNO solo para a↔b.
function relKey(a,b){return a<b?a+"|"+b:b+"|"+a}

// Bonus estructural del PACTO activo entre a y b (mientras dure).
function pactBonus(a,b){const t=S.pacts.get(relKey(a,b));return t==="alliance"?ALLY_BONUS:t==="nap"?NAP_BONUS:0;}
// Tipo de pacto activo entre a y b, o null.
function hasPact(a,b){return S.pacts.get(relKey(a,b))||null;}
// LIGAS: una nación pertenece como mucho a UNA liga. Helpers de pertenencia (usados por structural).
function leagueById(id){for(const L of S.leagues)if(L.id===id)return L;return null;}
function leagueOf(n){for(const L of S.leagues)if(L.members.includes(n))return L;return null;}
function sameLeague(a,b){if(a===b)return false;const L=leagueOf(a);return !!L&&L.members.includes(b);}
// Bonus estructural entre co-miembros de una misma liga (mientras compartan liga).
function leagueBonus(a,b){return sameLeague(a,b)?LEAGUE_BONUS:0;}
// RIVALIDADES: lista de rivales de una nación (índices), o vacío. N.rivals se guarda en la nación.
function rivalsOf(n){const N=S.nations[n];return (N&&N.rivals)||[];}
// ¿Son rivales a y b? (declaración en CUALQUIER dirección → antagonismo público).
function isRival(a,b){return rivalsOf(a).includes(b)||rivalsOf(b).includes(a);}
// Nº de RIVALES COMUNES: terceros a los que AMBOS rivalizan (motor de concordia entre aptos a aliarse).
function sharedRivals(a,b){
  const ra=rivalsOf(a); if(!ra.length)return 0; const rb=rivalsOf(b); if(!rb.length)return 0;
  let c=0; for(const t of ra)if(t!==a&&t!==b&&rb.includes(t))c++; return c;
}
// Aporte estructural de la rivalidad: −tensión si son rivales; +concordia por cada rival común (tope 2).
function rivalStructural(a,b){
  let s=0;
  if(isRival(a,b))s-=RIVAL_TENSION;
  const sh=sharedRivals(a,b); if(sh)s+=Math.min(sh,2)*COMMON_RIVAL_BONUS;
  return s;
}
// Aporte ESTRUCTURAL (permanente mientras dure la condición): guerra, frontera, PACTOS, LIGA y RIVALIDADES
// (y futuros embargo/mercado). Se COMPUTA de otro estado, no se guarda.
function structural(a,b){
  if(atWarPair(a,b))return BASE_WAR;
  return (nationAdjSet().has(relKey(a,b))?BASE_BORDER:0)+pactBonus(a,b)+leagueBonus(a,b)+rivalStructural(a,b);
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
  else{
    if(nationAdjSet().has(relKey(a,b)))out.push({label:"Frontera",v:BASE_BORDER});
    const t=hasPact(a,b); if(t)out.push({label:t==="alliance"?"Alianza":"No agresión", v:pactBonus(a,b)});
    if(sameLeague(a,b))out.push({label:"Liga",v:LEAGUE_BONUS});
    if(isRival(a,b))out.push({label:"Rival",v:-RIVAL_TENSION});
    const sh=sharedRivals(a,b); if(sh)out.push({label:"Rival común",v:Math.min(sh,2)*COMMON_RIVAL_BONUS});
  }
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
  leagueTick(); // ligas: poda muertos, solicitudes IA y resolución de ligas sin el jugador (mensual)
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
  recCrown(a,"Diplomacia","Regalo a "+NATIONS[b].name,-amt);recCrown(b,"Diplomacia","Regalo de "+NATIONS[a].name,amt);
  const gain=GIFT_MAX*amt/(amt+GIFT_REF);
  const rel=addImpulse(a,b,"gift",gain);
  return{ok:true,given:amt,gain,rel};
}

// ---- EMBARGO: estado + helpers. MUERDE desde 2026-07-15. El comercio dejó de ser un pool global: el
// arbitraje de economy.js tiene coste POR PAR (geografía + política), así que `tradeCost` devuelve
// Infinity para un par embargado y sus mercaderes dejan de arbitrar entre ambos mercados. Mutuo por par.
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

// ---- PACTOS (Fase 6): no agresión / alianza. Aportan bonus estructural (arriba) y BLOQUEAN la guerra
// entre las partes. Formar exige CONCORDIA (nap ≥ +10, alianza ≥ +50). Romper = traición (impulso).
// ¿Puede A proponer un pacto `type` a B? {ok, need}.
function canPact(a,b,type){
  if(!validPair(a,b)||atWarPair(a,b))return{ok:false,reason:"guerra"};
  if(hasPact(a,b)===type)return{ok:false,reason:"yaexiste"};
  const cur=getRel(a,b);
  if(type==="alliance"){
    // alianza: por CONCORDIA alta (≥+50) O por RIVAL COMÚN (aptos naturales) sin estar tensos (≥0)
    const ok=cur>=THRESH.alliance || (sharedRivals(a,b)>=1&&cur>=0);
    return{ok, need:ok?0:THRESH.alliance-cur};
  }
  const need=THRESH.nap;
  return{ok:cur>=need, need:cur>=need?0:need-cur};
}
// ---- RIVALIDADES (Fase 7b): gestión. Declarar/quitar rival (público). No se rivaliza a un aliado/co-liga.
function canRival(a,b){
  if(!validPair(a,b))return false;
  if(hasPact(a,b)||sameLeague(a,b))return false;     // no se rivaliza a un amigo (pacto o liga)
  return !rivalsOf(a).includes(b);
}
// a declara rival a b (hasta MAX_RIVALS). Devuelve true si se añadió; false si lleno/ inválido.
function addRival(a,b){
  if(!canRival(a,b))return false;
  const N=S.nations[a]; if(!N)return false;
  if(!N.rivals)N.rivals=[];
  if(N.rivals.length>=MAX_RIVALS)return false;       // lleno: el llamante decide si reemplaza (removeRival)
  N.rivals.push(b); return true;
}
function removeRival(a,b){
  const N=S.nations[a]; if(!N||!N.rivals)return false;
  const i=N.rivals.indexOf(b); if(i<0)return false;
  N.rivals.splice(i,1); return true;
}
function formPact(a,b,type){
  const c=canPact(a,b,type); if(!c.ok)return{ok:false,reason:c.reason||"tension",need:c.need};
  S.pacts.set(relKey(a,b),type);
  return{ok:true,type};
}
// Rompe el pacto entre a y b (traición): quita el pacto, golpea al traicionado (impulso "betray" grande)
// y REPARTE reputación a terceros (vecinos de ambos) → `a` queda como poco fiable. Devuelve {..,hits}.
function breakPact(a,b){
  const key=relKey(a,b), t=S.pacts.get(key);
  if(!t)return{ok:false,reason:"nopact"};
  S.pacts.delete(key);
  const rel=addImpulse(a,b,"betray",-BETRAY_TENSION);
  const cand=new Set([...nationNeighbors(a),...nationNeighbors(b)]);
  cand.delete(a);cand.delete(b);
  const hits=[];
  for(const c of cand){if(!S.nations[c]||!S.nations[c].alive)continue;addImpulse(a,c,"betray",-BETRAY_FANOUT);hits.push(c);}
  return{ok:true,type:t,rel,hits};
}

// Rehusar una LLAMADA A LAS ARMAS (defender a un aliado/co-miembro de liga atacado): fallar al bando
// SEVERA el vínculo con la víctima (rompe la alianza y/o te saca de la liga compartida) y golpea tu
// REPUTACIÓN igual que una traición (impulso "betray" a la víctima + reparto a terceros). Uniforme para
// alianzas y ligas (decisión de Sergio). Devuelve {broke:[...tipos], rel, hits}.
function refuseDefense(defender,victim){
  if(!validPair(defender,victim))return{ok:false};
  const broke=[];
  if(hasPact(defender,victim)){S.pacts.delete(relKey(defender,victim));broke.push("pacto");}
  if(sameLeague(defender,victim)){leaveLeague(defender);broke.push("liga");}
  const rel=addImpulse(defender,victim,"betray",-BETRAY_TENSION);
  const cand=new Set([...nationNeighbors(defender),...nationNeighbors(victim)]);
  cand.delete(defender);cand.delete(victim);
  const hits=[];
  for(const c of cand){if(!S.nations[c]||!S.nations[c].alive)continue;addImpulse(defender,c,"betray",-BETRAY_FANOUT);hits.push(c);}
  return{ok:true,broke,rel,hits};
}

// ¿Puede A declararle la guerra a B? Bloqueado si hay PACTO (rómpelo antes) o si falta tensión.
// Devuelve {ok, need, pact} donde need = tensión que aún falta.
function canDeclareWar(a,b){
  if(sameLeague(a,b))return{ok:false,league:true}; // co-miembros de liga no se atacan (bloque defensivo)
  if(hasPact(a,b))return{ok:false,pact:true};
  const cur=getRel(a,b), ok=cur<=THRESH.war;
  return{ok, need:ok?0:cur-THRESH.war}; // p.ej. cur=-20 → faltan 30 puntos de tensión
}

// ================= LIGAS DEFENSIVAS (Fase 6c) =================
// La liga es una ENTIDAD multi-miembro (S.leagues=[{id,name,founder,members[],apps[]}]) con GESTIÓN propia:
// los países APLICAN (canApplyLeague/applyToLeague) y los MIEMBROS votan por mayoría su admisión
// (resolveApplication + aiVoteAdmit); también se EXPULSA por voto (proposeExpel) y se puede SALIR
// (leaveLeague). Da un bonus ESTRUCTURAL +5 entre co-miembros (leagueBonus, arriba) y es DEFENSIVA:
// atacar a un miembro convoca a los demás — ese rally vive en council.js (resolveDefenders, que los hace
// votar con aiVoteDefend). Los co-miembros NO se declaran guerra (canDeclareWar). Una nación está en ≤1 liga.

// Funda una liga con `founder` como primer miembro (no debe estar ya en otra). Nombre opcional.
function createLeague(founder,name){
  if(founder<0||founder>=NPLAY||!S.nations[founder]||!S.nations[founder].alive)return{ok:false,reason:"invalido"};
  if(leagueOf(founder))return{ok:false,reason:"yaenliga"};
  const id=(S.leagueSeq=(S.leagueSeq||0)+1);
  const L={id,name:(name&&(""+name).trim())||("Liga de "+NATIONS[founder].name),founder,members:[founder],apps:[]};
  S.leagues.push(L);
  return{ok:true,league:L};
}
// ¿Puede `n` APLICAR a la liga `id`? Gate: vivo, sin liga, liga con hueco, sin haber aplicado/ser miembro,
// y CONCORDIA ≥ THRESH.league con el FUNDADOR (que representa a la liga). Devuelve {ok, reason, need}.
function canApplyLeague(n,id){
  const L=leagueById(id);
  if(!L)return{ok:false,reason:"noliga"};
  if(n<0||n>=NPLAY||!S.nations[n]||!S.nations[n].alive)return{ok:false,reason:"invalido"};
  if(L.members.includes(n))return{ok:false,reason:"yamiembro"};
  if(leagueOf(n))return{ok:false,reason:"enotraliga"};
  if(L.members.length>=MAX_LEAGUE)return{ok:false,reason:"llena"};
  if(L.apps.includes(n))return{ok:false,reason:"yaaplico"};
  // gate: concordia ≥ THRESH.league con el fundador, O RIVAL COMÚN con algún miembro y sin estar tenso (≥0)
  const cur=getRel(n,L.founder), need=THRESH.league-cur;
  const byRival=L.members.some(m=>m!==n&&sharedRivals(n,m)>=1)&&cur>=0;
  return{ok:cur>=THRESH.league||byRival, need:need>0?need:0, reason:(cur>=THRESH.league||byRival)?"":"tension"};
}
function applyToLeague(n,id){
  const c=canApplyLeague(n,id); if(!c.ok)return{ok:false,reason:c.reason,need:c.need};
  leagueById(id).apps.push(n);
  return{ok:true};
}
// Voto IA de un MIEMBRO sobre admitir a `applicant`: SÍ si no está tenso con él (getRel≥LEAGUE_ADMIT_MIN).
function aiVoteAdmit(member,applicant){return getRel(member,applicant)>=LEAGUE_ADMIT_MIN;}
// Resuelve una solicitud por VOTO de miembros (MAYORÍA estricta). El voto del jugador-miembro se pasa en
// `playerVote` (bool) cuando procede; los demás miembros votan por aiVoteAdmit. Devuelve {ok,admitted,yes,total}.
function resolveApplication(id,applicant,playerVote){
  const L=leagueById(id); if(!L)return{ok:false,reason:"noliga"};
  const ix=L.apps.indexOf(applicant); if(ix<0)return{ok:false,reason:"noaplico"};
  L.apps.splice(ix,1);
  const total=L.members.length;
  if(!S.nations[applicant]||!S.nations[applicant].alive||leagueOf(applicant)||total>=MAX_LEAGUE)
    return{ok:true,admitted:false,yes:0,total};
  let yes=0;
  for(const m of L.members)if((m===S.player&&playerVote!=null)?!!playerVote:aiVoteAdmit(m,applicant))yes++;
  const admitted=yes*2>total;
  if(admitted)L.members.push(applicant);
  return{ok:true,admitted,yes,total};
}
// Voto IA de un miembro sobre EXPULSAR a `target`: SÍ si su relación con él se agrió (getRel<LEAGUE_EXPEL_MAX).
function aiVoteExpel(member,target){return getRel(member,target)<LEAGUE_EXPEL_MAX;}
// Expulsa a `target` por VOTO de los DEMÁS miembros (mayoría estricta). No se puede expulsar al fundador.
// `playerVote` = voto del jugador-miembro (bool) si procede. Devuelve {ok,expelled,yes,total}.
function proposeExpel(id,target,playerVote){
  const L=leagueById(id); if(!L)return{ok:false,reason:"noliga"};
  if(!L.members.includes(target))return{ok:false,reason:"nomiembro"};
  if(target===L.founder)return{ok:false,reason:"fundador"};
  const voters=L.members.filter(m=>m!==target), total=voters.length;
  let yes=0;
  for(const m of voters)if((m===S.player&&playerVote!=null)?!!playerVote:aiVoteExpel(m,target))yes++;
  const expelled=yes*2>total;
  if(expelled)L.members=L.members.filter(m=>m!==target);
  return{ok:true,expelled,yes,total};
}
// Un miembro ABANDONA su liga. Si era el fundador, hereda members[0]; si queda vacía, se disuelve.
function leaveLeague(n){
  const L=leagueOf(n); if(!L)return{ok:false,reason:"noenliga"};
  L.members=L.members.filter(m=>m!==n);
  L.apps=L.apps.filter(a=>a!==n);
  if(!L.members.length){S.leagues=S.leagues.filter(x=>x!==L);return{ok:true,disbanded:true};}
  if(L.founder===n)L.founder=L.members[0];
  return{ok:true,disbanded:false};
}
// Tick MENSUAL de ligas (llamado desde relTick). PODA miembros muertos y disuelve ligas vacías; y resuelve
// por voto las solicitudes de ligas SIN el jugador (las de la liga del jugador esperan su decisión en la UI).
// La DECISIÓN de aplicar/fundar/cambiar de liga la toma la IA rival-driven (sim.js aiDiplomacy, Fase 7b).
function leagueTick(){
  for(const L of S.leagues.slice()){
    L.members=L.members.filter(m=>S.nations[m]&&S.nations[m].alive);
    L.apps=L.apps.filter(a=>S.nations[a]&&S.nations[a].alive&&!L.members.includes(a));
    if(!L.members.length){S.leagues=S.leagues.filter(x=>x!==L);continue;}
    if(!L.members.includes(L.founder))L.founder=L.members[0];
  }
  for(const L of S.leagues)if(!L.members.includes(S.player))for(const applicant of L.apps.slice())resolveApplication(L.id,applicant);
}

export { relKey, getRel, setRel, addImpulse, relBreakdown, relTier, relTick, nationAdjSet, THRESH, canDeclareWar,
  insult, giftGold, canInsult, isEmbargoed, setEmbargo, atWarPair, fabricateClaim, hasClaim, duchyOwner,
  conquestFanout, nationNeighbors, hasPact, canPact, formPact, breakPact,
  MAX_LEAGUE, leagueOf, sameLeague, leagueById, createLeague, canApplyLeague, applyToLeague,
  resolveApplication, proposeExpel, leaveLeague, refuseDefense,
  MAX_RIVALS, rivalsOf, isRival, sharedRivals, canRival, addRival, removeRival,
  NAP_BONUS, ALLY_BONUS, BETRAY_TENSION };
