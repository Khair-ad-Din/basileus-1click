// council.js — CONSEJO DE DELIBERACIÓN (Fase 6b, Etapa 1). Declarar una guerra OFENSIVA no es instantáneo:
// el líder abre un consejo, LLAMA a sus ALIADOS (la liga es solo defensiva, no entra en ataques), estos
// VOTAN (join/decline) y el líder LANZA una COALICIÓN (varias guerras pairwise agrupadas, con paz conjunta
// en la Etapa 2) o la CANCELA si no reúne apoyos. Ver memoria basileus-diplomacy-design.
import { NPLAY, NATIONS } from "./config.js";
import { S } from "./state.js";
import { getRel, hasPact, canDeclareWar, relKey } from "./diplomacy.js";
import { declareWar, report } from "./sim.js";

function alive(n){return n>=0&&n<NPLAY&&S.nations[n]&&S.nations[n].alive;}
function countWars(n){let c=0;for(let m=0;m<NPLAY;m++)if(m!==n&&S.wars.has(relKey(n,m)))c++;return c;}

// Voto de un ALIADO al que se llama a atacar `target`: se une salvo que aprecie al objetivo, tenga pacto
// con él o esté sobrecargado de guerras. Heurística simple y tuneable (la IA se afina en la Fase 7).
function aiVote(ally,leader,target){
  if(hasPact(ally,target))return "decline";      // tiene pacto con el objetivo: no lo ataca
  if(getRel(ally,target)>=25)return "decline";   // aprecia al objetivo
  if(countWars(ally)>=2)return "decline";        // ya sobrecargado de guerras
  return "join";
}

// Abre el consejo del jugador-líder para atacar a `target`. Candidatos = sus ALIADOS vivos.
// Requiere poder declarar la guerra (tensión suficiente y sin pacto con el objetivo).
function openCouncil(leader,target){
  if(!alive(leader)||!alive(target)||leader===target)return{ok:false,reason:"invalido"};
  if(!canDeclareWar(leader,target).ok)return{ok:false,reason:"nogate"};
  const candidates=[];
  for(let n=0;n<NPLAY;n++)if(n!==leader&&n!==target&&alive(n)&&hasPact(leader,n)==="alliance")candidates.push(n);
  S.council={leader,target,candidates,invited:new Map(),phase:"invite"};
  return{ok:true,candidates};
}
// El líder marca/desmarca a un aliado como invitado (solo en la fase de invitación).
function councilToggle(n){
  const c=S.council;if(!c||c.phase!=="invite"||!c.candidates.includes(n))return false;
  if(c.invited.has(n))c.invited.delete(n); else c.invited.set(n,"pending");
  return true;
}
// Convocar: los invitados (IA) emiten su voto. (El consejo del DEFENSOR es la Etapa 3.)
function councilConvene(){
  const c=S.council;if(!c||c.phase!=="invite")return false;
  for(const n of [...c.invited.keys()])c.invited.set(n,aiVote(n,c.leader,c.target));
  c.phase="vote";
  return true;
}
// Nº de apoyos (votos "join").
function councilSupport(){const c=S.council;if(!c)return 0;let s=0;for(const v of c.invited.values())if(v==="join")s++;return s;}

// LANZAR: crea la coalición {atacantes=líder+los que se unieron; defensores=objetivo} y sus guerras
// pairwise (silenciosas), con UN parte de coalición. El defensor y su consejo entran en la Etapa 3.
function launchCouncil(){
  const c=S.council;if(!c||c.phase!=="vote")return{ok:false,reason:"fase"};
  const attackers=[c.leader];
  for(const [n,v] of c.invited)if(v==="join"&&alive(n))attackers.push(n);
  const defenders=[c.target];
  const id=(S.coalSeq=(S.coalSeq||0)+1);
  let any=false;
  for(const a of attackers)for(const d of defenders)if(declareWar(a,d,{force:true,coal:id,quiet:true}))any=true;
  if(!any){S.council=null;return{ok:false,reason:"nowar"};}
  const coal={id,atk:attackers.slice(),def:defenders.slice(),leadA:c.leader,leadD:c.target,start:S.hour};
  S.coalitions.set(id,coal);
  const alliesJoined=attackers.length-1;
  report("⚔","<b>"+NATIONS[c.leader].name+"</b> forma una coalición"+(alliesJoined>0?(" con "+alliesJoined+" aliado(s)"):"")+" y declara la guerra a <b>"+NATIONS[c.target].name+"</b>.",[...attackers,...defenders]);
  S.council=null;
  return{ok:true,coal};
}
function cancelCouncil(){S.council=null;return{ok:true};}

export { openCouncil, councilToggle, councilConvene, councilSupport, launchCouncil, cancelCouncil, aiVote };
