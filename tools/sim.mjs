// tools/sim.mjs — SIMULACIONES LARGAS EN GITHUB ACTIONS (skill /simular). Nunca en el PC de Sergio: allí una corrida de
// 80 años son horas y se pausa al cerrar la tapa. En GitHub cada variante corre en su propia máquina, en paralelo.
//
//   node tools/sim.mjs lanzar <nombre> [variante...] [--años N]   simula LO QUE HAY EN DISCO (commiteado o no) en la
//                                                                rama sim/<nombre>; sin variantes = las de "run"
//   node tools/sim.mjs estado [nombre]                           ejecuciones recientes y progreso por década
//   node tools/sim.mjs resultados <nombre|id>                    baja los textos a tools/sim-out/<id>/ e imprime el
//                                                                resumen adelantados/atrasados de cada variante
//
// Cómo funciona `lanzar`: hace una instantánea del árbol de trabajo con un ÍNDICE TEMPORAL (no toca HEAD, ni el índice
// real, ni la rama de trabajo), cambia "run"/"years" de tools/sim-variants.json si se piden, crea un commit hijo de HEAD
// y lo empuja a sim/<nombre>. El workflow (.github/workflows/simulacion.yml) se dispara con el push.
// Trampa que esto evita: empujar a sim/** un commit que YA existía en otra rama no dispara el workflow; aquí el commit
// siempre es nuevo.
import fs from "fs"; import os from "os"; import path from "path"; import { execFileSync } from "child_process"; import { fileURLToPath } from "url";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const WF="simulacion.yml";
const sh=(cmd,args,opts={})=>execFileSync(cmd,args,{cwd:root,encoding:"utf8",stdio:["pipe","pipe","pipe"],...opts}).trim();
const gh=(...a)=>sh("gh",a);
const die=m=>{console.error("✖ "+m);process.exit(1)};
const [cmd,...rest]=process.argv.slice(2);

function repo(){return gh("repo","view","--json","nameWithOwner","-q",".nameWithOwner")}
function runsOf(branch,limit=5){
  const a=["run","list","--workflow",WF,"--limit",String(limit),"--json","databaseId,status,conclusion,headBranch,createdAt,displayTitle"];
  if(branch)a.push("--branch",branch);return JSON.parse(gh(...a))}
function resolveRun(x){
  if(/^\d+$/.test(x))return x;
  const r=runsOf("sim/"+x.replace(/^sim\//,""),1)[0]; if(!r)die("no hay ejecuciones en sim/"+x);return String(r.databaseId)}

if(cmd==="lanzar"){
  const name=rest[0]; if(!name||name.startsWith("-"))die("uso: node tools/sim.mjs lanzar <nombre> [variante...] [--años N]");
  if(!/^[\w.-]+$/.test(name))die("nombre de rama inválido: "+name);
  let years=null;const vs=[];
  for(let i=1;i<rest.length;i++){if(rest[i]==="--años"||rest[i]==="--anos"){years=+rest[++i];if(!(years>0))die("--años necesita un número")}else vs.push(rest[i])}
  const vf=path.join(root,"tools","sim-variants.json"), cfg=JSON.parse(fs.readFileSync(vf,"utf8"));
  for(const v of vs)if(!cfg.variants[v])die(`variante "${v}" no existe en tools/sim-variants.json (hay: ${Object.keys(cfg.variants).join(", ")})`);
  if(vs.length)cfg.run=vs; if(years)cfg.years=years;
  for(const v of cfg.run)if(!cfg.variants[v])die(`"run" incluye "${v}", que no existe`);
  try{gh("auth","status")}catch(e){die("gh no está autenticado (gh auth login)")}
  // instantánea del disco con un índice temporal
  const idx=path.join(os.tmpdir(),"sim-index-"+process.pid), env={...process.env,GIT_INDEX_FILE:idx};
  try{
    sh("git",["read-tree","HEAD"],{env});
    sh("git",["add","-A","--","."],{env});
    const blob=sh("git",["hash-object","-w","--stdin"],{input:JSON.stringify(cfg,null,2)+"\n"});
    sh("git",["update-index","--add","--cacheinfo","100644,"+blob+",tools/sim-variants.json"],{env});
    const tree=sh("git",["write-tree"],{env});
    const dirty=sh("git",["status","--porcelain"]).split("\n").filter(Boolean).length;
    const msg=`sim: ${cfg.run.join(", ")} · ${cfg.years||80} años${dirty?` · con ${dirty} cambio(s) sin commitear`:""}`;
    const sha=sh("git",["commit-tree",tree,"-p","HEAD","-m",msg]);
    const before=new Set(runsOf("sim/"+name,10).map(r=>r.databaseId));
    sh("git",["push","-f","origin",sha+":refs/heads/sim/"+name]);
    console.log(`✔ empujado ${sha.slice(0,7)} → sim/${name}  (${msg})`);
    for(const v of cfg.run)console.log(`   ${v}: ${cfg.variants[v].desc}`);
    // esperar a que GitHub cree la ejecución (unos segundos)
    let run=null;for(let i=0;i<40&&!run;i++){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);run=runsOf("sim/"+name,5).find(r=>!before.has(r.databaseId))}
    if(!run)die("GitHub no ha creado la ejecución en 2 min: mira https://github.com/"+repo()+"/actions");
    console.log(`✔ ejecución ${run.databaseId}: https://github.com/${repo()}/actions/runs/${run.databaseId}`);
    console.log(`  estado:     node tools/sim.mjs estado ${name}\n  resultados: node tools/sim.mjs resultados ${name}`);
  }finally{try{fs.rmSync(idx,{force:true})}catch(e){}}
}
else if(cmd==="estado"){
  const runs=runsOf(rest[0]?"sim/"+rest[0].replace(/^sim\//,""):null,rest[0]?3:6);
  if(!runs.length){console.log("sin simulaciones");process.exit(0)}
  for(const r of runs){
    console.log(`${r.databaseId}  ${r.headBranch}  ${r.status}${r.conclusion?" · "+r.conclusion:""}  ${r.createdAt.replace("T"," ").slice(0,16)}  ${r.displayTitle}`);
    if(r.status==="completed")continue;
    const jobs=JSON.parse(gh("run","view",String(r.databaseId),"--json","jobs")).jobs.filter(j=>j.name.startsWith("sim"));
    // GitHub no sirve el log de un trabajo hasta que termina: en curso solo se puede dar el tiempo que lleva
    // (80 años ≈ 60-120 min; tope del trabajo, 350 min)
    for(const j of jobs){const mins=j.startedAt&&j.status==="in_progress"?Math.round((Date.now()-Date.parse(j.startedAt))/60000):null;
      console.log(`   ${j.name}: ${j.status}${j.conclusion?" · "+j.conclusion:""}${mins!=null?` · lleva ${mins} min`:""}`)}
  }
}
else if(cmd==="resultados"){
  if(!rest[0])die("uso: node tools/sim.mjs resultados <nombre|id>");
  const id=resolveRun(rest[0]), info=JSON.parse(gh("run","view",id,"--json","status,conclusion,headBranch"));
  if(info.status!=="completed")console.log(`⚠ la ejecución ${id} aún está ${info.status}: bajo lo que haya`);
  const out=path.join(root,"tools","sim-out",id); fs.mkdirSync(out,{recursive:true});
  try{gh("run","download",id,"--dir",out)}catch(e){die("no se pudieron bajar los artefactos: "+e.message.split("\n")[0])}
  for(const d of fs.readdirSync(out).sort()){const dir=path.join(out,d);if(!fs.statSync(dir).isDirectory())continue;
    for(const f of fs.readdirSync(dir)){const t=fs.readFileSync(path.join(dir,f),"utf8"),i=t.indexOf("ADELANTADOS");
      console.log(`\n=== ${d} (${path.relative(root,path.join(dir,f))}) ===`);
      console.log(i>=0?t.slice(t.lastIndexOf("\n",i)+1).trim():"(sin resumen: ¿falló? mira el texto completo)");
      const pop=t.match(/población total final .*/);if(pop)console.log(pop[0])}}
}
else{console.log(fs.readFileSync(fileURLToPath(import.meta.url),"utf8").split("\n").slice(0,10).join("\n"));process.exit(cmd?1:0)}
