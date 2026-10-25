// tools/sim-run.mjs — lanza la sonda de capacidad agraria sobre una VARIANTE (tools/sim-variants.json): copia call-of-war
// a una carpeta temporal, aplica los cambios de la variante (cada texto debe aparecer exactamente una vez) y corre
// tools/capacidad-probe.mjs con COW apuntando a la copia. Lo usa el workflow de GitHub Actions; también vale en local.
//   node tools/sim-run.mjs <variante> [años=80] [década=10]
import fs from "fs"; import os from "os"; import path from "path"; import { spawnSync } from "child_process"; import { fileURLToPath } from "url";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const [V,years="80",dec="10"]=process.argv.slice(2);
const cfg=JSON.parse(fs.readFileSync(path.join(root,"tools","sim-variants.json"),"utf8")), vr=cfg.variants[V];
if(!vr){console.error("variante desconocida: "+V+" (hay: "+Object.keys(cfg.variants).join(", ")+")");process.exit(1)}
const dst=fs.mkdtempSync(path.join(os.tmpdir(),"cow_"+V+"_"));
fs.cpSync(path.join(root,"call-of-war"),dst,{recursive:true,filter:s=>!/[\/]assets[\/]/.test(s)});
for(const[file,from,to]of vr.edits){const f=path.join(dst,file),t=fs.readFileSync(f,"utf8"),n=t.split(from).length-1;
  if(n!==1){console.error(`[${V}] "${from}" aparece ${n} veces en ${file}: la variante no encaja con el código`);process.exit(1)}
  fs.writeFileSync(f,t.replace(from,to));console.log(`[${V}] ${file}: ${from} → ${to}`)}
console.log(`[${V}] ${vr.desc} · ${years} años`);
const r=spawnSync(process.execPath,[path.join(root,"tools","capacidad-probe.mjs"),years,dec],{stdio:"inherit",env:{...process.env,COW:dst,TAG:V}});
fs.rmSync(dst,{recursive:true,force:true});process.exit(r.status??1);
