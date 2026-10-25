// PreToolUse(Bash): corta las simulaciones LARGAS en el PC de Sergio y manda a GitHub Actions (skill /simular).
//
// POR QUÉ EXISTE (2026-10-25): las corridas de 80 años de la capacidad agraria iban a 2-6 min por año en el portátil,
// tres a la vez se peleaban por la CPU y al cerrar la tapa se pausaban: una tarde entera para una medición. En GitHub
// (repo público: gratis, 4 núcleos, una máquina por variante) salen en ~1-2 h sin ocupar el PC.
//
// Deja pasar las pruebas cortas (≤ 5 años: humo, invariantes) y todo lo que no sea una sonda económica.
let raw="";process.stdin.on("data",d=>raw+=d).on("end",()=>{
  let cmd="";try{cmd=JSON.parse(raw).tool_input.command||""}catch(e){process.exit(0)}
  // solo cuando NODE EJECUTA la sonda (no cuando un sed/grep/cat la menciona): se mira cada tramo del comando
  let m=null;
  for(const seg of cmd.split(/&&|\|\||[;|\n]/)){
    const x=seg.match(/^\s*(?:\w+=\S*\s+)*(?:timeout\s+\d+\s+)?node\s+(?:--\S+\s+)*\S*?(capacidad-probe|sim-run|verify-v2)\.mjs((?:\s+[^\s>]+)*)/);
    if(x){m=x;break}}
  if(!m)process.exit(0);
  const nums=m[2].trim().split(/\s+/).filter(a=>/^\d+$/.test(a)).map(Number);
  // verify-v2: [años]; capacidad-probe: [años] [década]; sim-run: <variante> [años] [década]
  const years=m[1]==="verify-v2"?(nums[0]??5):(nums[0]??80);
  if(years<=5)process.exit(0);
  process.stderr.write(
`Simulación de ${years} años en local: NO. En el portátil son horas y se pausa al cerrar la tapa.
Se lanza en GitHub Actions (skill /simular), cada variante en su máquina y en paralelo:

    node tools/sim.mjs lanzar <nombre> [variante...] [--años N]   (simula lo que hay en disco, commiteado o no)
    node tools/sim.mjs estado <nombre>
    node tools/sim.mjs resultados <nombre>

Las variantes se definen en tools/sim-variants.json. En local, solo pruebas de humo (≤ 5 años).
`);process.exit(2)});
