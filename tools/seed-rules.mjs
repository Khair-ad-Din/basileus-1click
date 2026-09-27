// tools/seed-rules.mjs — deduce REGLAS REDONDEADAS de edificios de arranque a partir del equilibrio simulado.
// Entrada: el volcado de `node tools/verify-v2.mjs N --ia --dump ruta.json` (estado final por provincia).
// Para cada tipo de edificio (con su dueño) mide DÓNDE sobrevive y CUÁNTO, frente a lo que decide su tamaño:
//   · servicios (cuartel, templo): % de provincias que lo mantienen por tramo de población → umbral redondo
//   · talleres: niveles por cada 10.000 burgueses (o campesinos) del reino, y en qué especialidad (resType) se dan
//   node tools/seed-rules.mjs ruta.json
import fs from "fs";
const rows=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const pct=v=>(v*100).toFixed(0)+"%";
// ---- 1) servicios: supervivencia por tramo de población ----
const BANDS=[0,2000,5000,10000,20000,40000,80000,1e9];
const band=pop=>BANDS.findIndex((b,i)=>pop>=b&&pop<BANDS[i+1]);
const bl=i=>BANDS[i+1]>=1e9?`≥${BANDS[i]/1000}k`:`${BANDS[i]/1000}-${BANDS[i+1]/1000}k`;
for(const [b,where] of [["cuartel","rural"],["templo","urbana"]]){
  const tot=new Array(BANDS.length).fill(0),keep=new Array(BANDS.length).fill(0);
  for(const r of rows){if(where==="rural"&&r.urban)continue;if(where==="urbana"&&!r.urban)continue;
    const i=band(r.pop);tot[i]++;const x=r.b[b];if(x&&!x.off)keep[i]++}
  console.log(`\n${b.toUpperCase()} (provincias ${where}s): % que lo mantiene abierto por población de la provincia`);
  for(let i=0;i<BANDS.length-1;i++)if(tot[i])console.log(`  ${bl(i).padEnd(10)} ${String(tot[i]).padStart(5)} prov. → ${pct(keep[i]/tot[i]).padStart(4)}`);
}
// ---- 2) talleres y extractores: niveles por reino vs su población de burgueses / campesinos ----
const byNat={};
for(const r of rows){const N=byNat[r.n]||(byNat[r.n]={nat:r.nat,pop:0,burg:0,camp:0,b:{}});
  N.pop+=r.pop;if(r.pops){N.burg+=r.pops.burgues||0;N.camp+=r.pops.campesino||0}
  for(const k in r.b){const x=r.b[k];if(x.off)continue;const key=k+"@"+x.o;N.b[key]=(N.b[key]||0)+x.l}}
const nats=Object.values(byNat).filter(N=>N.pop>500000);
const keys=new Set();for(const N of nats)for(const k in N.b)keys.add(k);
console.log(`\nTALLERES en reinos >500k hab. (${nats.length}): niveles por 10.000 burgueses y por 100.000 campesinos (mediana · rango)`);
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
for(const k of [...keys].sort()){if(/^(cuartel|templo|mercado|fortaleza|catedral)@/.test(k))continue;
  const pb=nats.map(N=>(N.b[k]||0)/Math.max(1,N.burg)*1e4), pc=nats.map(N=>(N.b[k]||0)/Math.max(1,N.camp)*1e5);
  const have=nats.filter(N=>N.b[k]>0).length; if(!have)continue;
  console.log(`  ${k.padEnd(22)} en ${String(have).padStart(2)}/${nats.length} reinos · /10k burg ${med(pb).toFixed(2)} (${Math.min(...pb).toFixed(1)}–${Math.max(...pb).toFixed(1)}) · /100k camp ${med(pc).toFixed(2)}`)}
// ---- 3) qué resType acompaña a cada taller (¿se construye donde está su materia?) ----
console.log(`\nDÓNDE están los talleres (especialidad de la provincia, top 3):`);
const where={};for(const r of rows)for(const k in r.b){const x=r.b[k];if(x.off||/^(cuartel|templo|mercado)$/.test(k))continue;
  const W=where[k]||(where[k]={n:0,rt:{},urb:0});W.n+=x.l;W.rt[r.resType||"—"]=(W.rt[r.resType||"—"]||0)+x.l;if(r.urban)W.urb+=x.l}
for(const k of Object.keys(where).sort()){const W=where[k];const top=Object.entries(W.rt).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,v])=>`${t} ${pct(v/W.n)}`).join(", ");
  console.log(`  ${k.padEnd(14)} ${String(W.n).padStart(5)} niv. · ${pct(W.urb/W.n)} en ciudad · ${top}`)}
