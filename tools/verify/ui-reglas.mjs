// tools/verify/ui-reglas.mjs — comprueba en TODO el código que pinta interfaz las reglas de estructura de Sergio
// (design/ux/guia-estilo.md §1b): ni iconos Unicode (emoji, flechas, ✓✕, ▲▼, ■, ★…) ni "·" como separador.
// Ignora los comentarios. Sale con código 1 si encuentra algo (vale para CI o para cerrar una tarea).
//   node tools/verify/ui-reglas.mjs
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","..","call-of-war");
const ICON=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2605}\u{FE0F}]|·/gu;
const files=[...fs.readdirSync(path.join(root,"js")).filter(f=>f.endsWith(".js")&&f!=="debug.js").map(f=>"js/"+f),"index.html"]; // debug.js: solo consola del desarrollador
let total=0;
for(const f of files){
  const L=fs.readFileSync(path.join(root,f),"utf8").replace(/\r\n/g,"\n").split("\n");let inBlock=false;
  L.forEach((l,i)=>{
    let code=l;
    if(inBlock){const e=code.indexOf("*/");if(e<0)return;code=code.slice(e+2);inBlock=false}
    code=code.replace(/\/\*.*?\*\//g,"");
    const b=code.indexOf("/*");if(b>=0){code=code.slice(0,b);inBlock=true}
    if(/^\s*(\/\/|\*)/.test(code))return;
    code=code.replace(/(^|[\s;{}),])\/\/ .*$/,"$1");
    const ms=[...code.matchAll(ICON)];if(!ms.length)return;total+=ms.length;
    console.log(f+":"+(i+1)+"  "+ms.map(m=>m[0]).join(" ")+"   "+code.trim().slice(0,140));
  });
}
console.log(total?`\n${total} violación(es) de las reglas de estructura`:"reglas de estructura: ✓ sin iconos Unicode ni \"·\" en la interfaz");
process.exit(total?1:0);
