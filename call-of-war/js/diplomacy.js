// diplomacy.js — RELACIONES ENTRE PAÍSES (feature en construcción; ver memoria basileus-diplomacy-design).
//
// Modelo: UN campo COMPARTIDO por par de naciones, de −100 (máxima TENSIÓN) a +100 (máxima
// CONCORDIA), 0 de serie. No es el modelo bilateral de EU (A opina de B y viceversa): es UN
// número que ambos empujan. Dos motores lo mueven: (1) ACCIONES discretas (regalos, insultos,
// reclamaciones… — fases siguientes) y (2) una DERIVA mensual hacia una línea base ESTRUCTURAL
// (fronteras, guerra, comercio…). Los umbrales de las acciones (declarar guerra ≤ −50, aliarse
// ≥ +50…) leen este campo. La "infamia" NO es un escalar aparte: los actos agresivos reparten
// tensión a los vecinos (fase posterior), en esta misma moneda.
import { NPLAY, START_DATE } from "./config.js";
import { S } from "./state.js";

const REL_MIN=-100, REL_MAX=100;
// UMBRALES del campo que gatean las acciones (el eje es continuo; estos son los cortes de reglas).
// Negativos = hace falta TENSIÓN; positivos = hace falta CONCORDIA ("no tensión"). Se pulirán jugando.
const THRESH={war:-50, embargo:-35, nap:10, league:25, alliance:50};
const REL_DRIFT=0.10;   // fracción del hueco hacia la línea base que se recorre cada mes
const BASE_WAR=-80;     // línea base cuando dos países están EN GUERRA (arrastra al fondo)
const BASE_BORDER=-10;  // fricción de frontera: dos vecinos tienden a una tensión leve de serie

function clamp(x){return x<REL_MIN?REL_MIN:x>REL_MAX?REL_MAX:x}
function monthKeyOf(hour){const d=new Date(START_DATE+hour*3600e3);return d.getUTCFullYear()*12+d.getUTCMonth()}
// Clave simétrica por par (idéntico patrón a warKey en sim.js): el campo es UNO solo para a↔b.
function relKey(a,b){return a<b?a+"|"+b:b+"|"+a}

// Lee el campo compartido a↔b. 0 si no hay entrada (por defecto). Negativo=Tensión, positivo=Concordia.
function getRel(a,b){if(a===b||a<0||b<0)return 0;const v=S.rel.get(relKey(a,b));return v==null?0:v}
// Suma delta al campo con clamp [−100,+100]; borra la entrada si vuelve a ~0 (0 = por defecto, no se almacena).
// Devuelve el valor final. Toda modificación del campo pasa por aquí.
function addRel(a,b,delta){
  if(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY||!delta)return getRel(a,b);
  const k=relKey(a,b), v=clamp((S.rel.get(k)||0)+delta);
  if(Math.abs(v)<1e-6)S.rel.delete(k); else S.rel.set(k,v);
  return v;
}
// Fija el campo a un valor absoluto (para debug/escenarios). Devuelve el valor final.
function setRel(a,b,val){if(a===b||a<0||b<0||a>=NPLAY||b>=NPLAY)return 0;return addRel(a,b,clamp(val)-getRel(a,b))}

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

// Línea base ESTRUCTURAL hacia la que deriva el campo a↔b. Fase 1: mínima (guerra + frontera).
// Fases siguientes sumarán: enemigo común (+), volumen de comercio (+), diferencia de tamaño (−)…
function baseline(a,b,adj){
  if(atWarPair(a,b))return BASE_WAR;
  return adj?BASE_BORDER:0;
}

// DERIVA mensual del campo hacia su línea base. La llama hourTick cada tick; se autodispara solo al
// cambiar de mes de calendario (mismo patrón que prosperityTick). Recorre los pares con entrada +
// los vecinos + los que están en guerra (aunque su campo esté aún a 0).
function relTick(){
  const mk=monthKeyOf(S.hour);
  if(mk===S.relMonthKey)return;
  S.relMonthKey=mk;
  const adj=nationAdjSet();
  const pairs=new Set(S.rel.keys());
  for(const k of adj)pairs.add(k);
  for(const k of S.wars.keys())pairs.add(k);
  for(const k of pairs){
    const i=k.indexOf("|");if(i<0)continue;
    const a=+k.slice(0,i), b=+k.slice(i+1);
    if(a>=NPLAY||b>=NPLAY||!S.nations[a]||!S.nations[b]||!S.nations[a].alive||!S.nations[b].alive)continue;
    const cur=getRel(a,b), base=baseline(a,b,adj.has(k));
    if(Math.abs(base-cur)<0.01)continue;
    addRel(a,b,(base-cur)*REL_DRIFT);
  }
}

// ¿Puede A declararle la guerra a B según la tensión? (la línea dura del gate; el jugador la usa en la UI)
// Devuelve {ok, need} donde need = tensión que aún falta (0 si ya se cumple).
function canDeclareWar(a,b){
  const cur=getRel(a,b), ok=cur<=THRESH.war;
  return{ok, need:ok?0:cur-THRESH.war}; // p.ej. cur=-20 → faltan 30 puntos de tensión
}

export { relKey, getRel, addRel, setRel, relTier, baseline, relTick, nationAdjSet, THRESH, canDeclareWar };
