// debug.js — herramientas de observación por consola (window.dbg). No afecta al juego.
// Pensado para inspeccionar partidas reales: adelantar años, ver el estado POP de una provincia
// o nación, y rankings. Abre la consola del navegador (F12) y usa:
//   dbg.run(10)            adelanta 10 años de juego (con IA, guerras y construcción) y resume
//   dbg.prov("Toledo")     estado POP completo de una provincia
//   dbg.nation("Castilla") resumen de una nación
//   dbg.top("pop")         ranking de naciones (pop | din | troops | fam | growth)
import { S } from "./state.js";
import { NATIONS, NPLAY } from "./config.js";
import { hourTick } from "./sim.js";
import {
  nationEconomy, nationProvCount, nationStrength, armyCount,
  soldCap, soldAvail, foodCap, foodBalance, foodCons, foodFill, harvestMul, staffing, buildJobs, freeLabor, specialistCap, structPPF
} from "./economy.js";

const fmt=n=>Math.round(n||0).toLocaleString("es-ES");
const pct=(x)=>Math.round((x||0)*100)+"%";
function nIdx(x){
  if(typeof x==="number")return x;
  const i=NATIONS.findIndex(n=>n.name.toLowerCase()===String(x).toLowerCase());
  return i;
}
function nationPop(n){let t=0;for(const p of S.provs)if(p.owner===n&&!p.wasteland)t+=p.pop||0;return t}
function nationFamine(n){let f=0,c=0;for(const p of S.provs)if(p.owner===n&&!p.wasteland){c++;if(p.famine)f++}return c?f/c:0}

const dbg={
  // Adelanta `years` años de juego llamando al tick REAL (IA, guerras, construcción). Bloquea
  // mientras corre (sin render); para observar, no para jugar. Devuelve el resumen final.
  run(years=10){
    if(!S.started){console.warn("Empieza una partida primero (elige una nación).");return}
    const ticks=Math.round(years*8760);
    const before=this.snapshot();
    console.log(`⏩ Simulando ${years} años (${ticks.toLocaleString("es")} ticks)… bloquea unos segundos.`);
    console.time("dbg.run");
    for(let i=0;i<ticks&&!S.gameOver;i++)hourTick();
    console.timeEnd("dbg.run");
    const after=this.snapshot();
    console.log(`Población mundial: ${fmt(before.worldPop)} → ${fmt(after.worldPop)} `+
      `(${((Math.pow(after.worldPop/before.worldPop,1/years)-1)*100).toFixed(2)}%/año). `+
      `Día ${1+(S.hour/24|0)}.`);
    this.top("pop");
    return after;
  },
  snapshot(){
    let worldPop=0;for(const p of S.provs)if(!p.wasteland)worldPop+=p.pop||0;
    return {hour:S.hour,worldPop,nations:NATIONS.map((n,i)=>i<NPLAY&&S.nations[i]&&S.nations[i].alive?
      {name:n.name,pop:Math.round(nationPop(i)),provs:nationProvCount(i)}:null).filter(Boolean)};
  },
  // Estado POP completo de una provincia (por nombre).
  prov(name){
    const p=S.provs.find(q=>q.name&&q.name.toLowerCase()===String(name).toLowerCase());
    if(!p){console.warn("No encuentro la provincia:",name);return}
    if(p.wasteland){console.log(`${p.name}: impracticable.`);return}
    const fc=foodCap(p),fill=foodFill(p),jobs=buildJobs(p),c$=(p.store&&p.store.comida!=null)?p.store.comida:fc*0.6;
    console.log(`%c${p.name}${p.capital?" ★":""}  (${NATIONS[p.owner]?NATIONS[p.owner].name:"—"})`,"font-weight:bold");
    console.table({
      Población:fmt(p.pop), Terreno:p.terrain, Moral:Math.round(p.morale)+"%",
      "Cosecha del año":(harvestMul(p)>=1?"+":"")+Math.round((harvestMul(p)-1)*100)+"%",
      "Comida balance/año":(foodBalance(p)*8760>=0?"+":"")+fmt(foodBalance(p)*8760),
      "Despensa":`${pct(fill)} (${fmt(c$)}/${fmt(fc)})`, Hambruna:p.famine?"SÍ ⚠":"no",
      "Soldadesca":`${fmt(soldAvail(p))}/${fmt(soldCap(p))}`,
      "Especialistas (cap)":fmt(specialistCap(p)), "structPPF":structPPF(p).toFixed(2),
      "Dotación":jobs>0?`${pct(staffing(p))} (${fmt(freeLabor(p))} libres / ${fmt(jobs)} puestos)`:"sin edificios",
      Movilizados:fmt(p.mob)
    });
  },
  // Resumen de una nación (por nombre o índice).
  nation(x){
    const n=nIdx(x);if(n<0||n>=NPLAY){console.warn("Nación no encontrada:",x);return}
    const ne=nationEconomy(n),pop=nationPop(n);
    console.log(`%c${NATIONS[n].name}`,"font-weight:bold");
    console.table({
      Provincias:nationProvCount(n), Población:fmt(pop),
      "Hambruna prov":pct(nationFamine(n)), Tropas:ne.troops, Fuerza:Math.round(nationStrength(n)),
      "Ducados/mes":(ne.res.dinero>=0?"+":"")+ (Math.round(ne.res.dinero*10)/10),
      "Duc/100k hab":pop>0?(Math.round(ne.res.dinero*1e5/pop*10)/10):0,
      "Grano/mes":Math.round((ne.res.comida||0)*10)/10, "Madera/mes":Math.round((ne.res.materiales||0)*10)/10,
      "Paño/mes":Math.round((ne.res.pano||0)*10)/10, "Vino/mes":Math.round((ne.res.vino||0)*10)/10,
      "Sal/mes":Math.round((ne.res.sal||0)*10)/10
    });
  },
  // Ranking de naciones por métrica: pop | din | pc(=riqueza per cápita) | troops | fam | provs
  top(metric="pop",k=15){
    const rows=[];
    for(let n=0;n<NPLAY;n++){if(!S.nations[n]||!S.nations[n].alive)continue;
      const ne=nationEconomy(n),pop=nationPop(n),din=ne.res.dinero||0;
      rows.push({Nación:NATIONS[n].name,Pob:Math.round(pop),Prov:nationProvCount(n),
        Tropas:ne.troops,"Ducados/mes":Math.round(din*10)/10,
        "Duc/100k hab":pop>0?Math.round(din*1e5/pop*10)/10:0,"Hambr%":Math.round(nationFamine(n)*100)});
    }
    const key={pop:"Pob",din:"Ducados/mes",pc:"Duc/100k hab",troops:"Tropas",fam:"Hambr%",provs:"Prov"}[metric]||"Pob";
    rows.sort((a,b)=>b[key]-a[key]);
    console.table(rows.slice(0,k));
    return rows;
  }
};
window.dbg=dbg;
console.log("%c[dbg] Depuración POP lista. Prueba dbg.run(10), dbg.prov(\"Toledo\"), dbg.nation(\"Castilla\"), dbg.top(\"pop\").","color:#9fb878");
export { dbg };
