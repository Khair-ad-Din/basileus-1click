// mapgen.js
import { MW, MH, NATIONS, NPLAY, NEUTRAL, TERRAINS, TERRAIN_KEYS, newBuildings, STRATA, STRATA_SEED, isSea, SEA_KM_MULT, NAV_KM, CITY_MIN, CENTER_POP, CURATED_HUBS } from "./config.js";
import { S } from "./state.js";

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashN(ix,iy){let n=(ix*374761393+iy*668265263)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return(n>>>0)/4294967296}
const SYL_A=["Bran","Kel","Vos","Tor","Mar","Lun","Ost","Var","Gal","Dor","Bel","Cra","Stal","Nor","Pet","Riv","Sar","Tan","Ulm","Vin","Kos","Bre","Ang","Mon","Tar",
  "Wers","Krak","Lem","Zven","Halic","Prus","Sten","Dra","Vel","Rud","Bys","Chern","Zag","Vil","Kaun","Sud","Trak","Grod","Volk","Sand","Torn","Els","Ravn","Gorz",
  "Lip","Mel","Wroc","Opol","Brno","Rze","Byd","Sib","Bra","Vid","Nis","Skop"];
const SYL_M=["a","e","o","en","ar","el","in","or","an","ur","is","os","ov","yn","itz"];
const SYL_B=["burgo","grado","via","landia","mark","stein","polis","feld","holm","gorod","novo","berg","minas","puerto","castro","stadt","kovo","mira",
  "hafen","furt","bruck","wald","thal","heim","dorf","ovce","itsa","ava","gard","borg","nes","vik","sund","toft","ford","ton","by"];
function genName(used){
  for(let t=0;t<200;t++){
    let n=SYL_A[(S.rand()*SYL_A.length)|0];
    if(t>=40||S.rand()<0.35)n+=SYL_M[(S.rand()*SYL_M.length)|0];
    n+=SYL_B[(S.rand()*SYL_B.length)|0];
    if(!used.has(n)){used.add(n);return n}
  }
  let n;
  do{n="Provincia "+(1+((S.rand()*9999)|0))}while(used.has(n));
  used.add(n);
  return n;
}
const RLE_ALPHA="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@^_{}|~";
let countryAt=null;
function decodeCountries(){
  countryAt=new Uint8Array(MW*MH);
  const s=MAPDATA.rle;let i=0,pos=0;
  while(i<s.length){
    const c=RLE_ALPHA.indexOf(s[i++]);
    let n=0;
    while(i<s.length&&s.charCodeAt(i)>=48&&s.charCodeAt(i)<=57)n=n*10+(s.charCodeAt(i++)-48);
    countryAt.fill(c,pos,pos+n);pos+=n;
  }
}
function generateMap(){
  S.rand=mulberry32(193909); // determinista también al regenerar desde el editor
  S.customRoads=false; // mundo generado = red de caminos generada
  decodeCountries();
  // componentes conexas de cada nación (para no fusionar territorios separados por mar u otras naciones)
  const compAt=new Int32Array(MW*MH).fill(-1);
  const comps=[];
  for(let i=0;i<MW*MH;i++){
    if(countryAt[i]===0||compAt[i]>=0)continue;
    const c=countryAt[i],id=comps.length;
    let size=0;
    const stack=[i];compAt[i]=id;
    while(stack.length){
      const k=stack.pop();size++;
      const x=k%MW;
      let j;
      if(x>0){j=k-1;if(countryAt[j]===c&&compAt[j]<0){compAt[j]=id;stack.push(j)}}
      if(x<MW-1){j=k+1;if(countryAt[j]===c&&compAt[j]<0){compAt[j]=id;stack.push(j)}}
      if(k>=MW){j=k-MW;if(countryAt[j]===c&&compAt[j]<0){compAt[j]=id;stack.push(j)}}
      if(k<MW*MH-MW){j=k+MW;if(countryAt[j]===c&&compAt[j]<0){compAt[j]=id;stack.push(j)}}
    }
    comps.push({c,size});
  }
  // semillas de provincia: 1) ciudades históricas, 2) anclas de provincia (editables), 3) relleno procedural
  const seeds=[];
  const citySeedIdx=[];
  for(const[name,cx,cy]of MAPDATA.cities){
    const c=countryAt[cy*MW+cx];
    if(c>0){citySeedIdx.push(seeds.length);seeds.push({x:cx,y:cy,c,comp:compAt[cy*MW+cx],aname:name})}
    else citySeedIdx.push(-1);
  }
  const provAnchors=MAPDATA.provinces||[];
  for(const[name,ax,ay]of provAnchors){
    const x=Math.max(1,Math.min(MW-2,Math.round(ax))), y=Math.max(1,Math.min(MH-2,Math.round(ay)));
    if(countryAt[y*MW+x]<=0)continue;
    let ok=true;
    for(const s of seeds){const dx=s.x-x,dy=s.y-y;if(dx*dx+dy*dy<11*11){ok=false;break}}
    if(ok)seeds.push({x,y,c:countryAt[y*MW+x],comp:compAt[y*MW+x],aname:name});
  }
  // relleno procedural (rejilla con jitter hasta los bordes; si cae en mar se reintenta),
  // dejando sitio alrededor de las anclas
  const anchorCount=seeds.length;
  for(let gy=12;gy<MH-6;gy+=21){
    for(let gx=12;gx<MW-6;gx+=21){
      for(let t=0;t<5;t++){
        const x=Math.max(1,Math.min(MW-2,Math.round(gx+(S.rand()-0.5)*20)));
        const y=Math.max(1,Math.min(MH-2,Math.round(gy+(S.rand()-0.5)*20)));
        const c=countryAt[y*MW+x];
        if(c>0){
          let ok=true;
          for(let s=0;s<anchorCount;s++){const dx=seeds[s].x-x,dy=seeds[s].y-y;if(dx*dx+dy*dy<15*15){ok=false;break}}
          if(ok)seeds.push({x,y,c,comp:compAt[y*MW+x]});
          break;
        }
      }
    }
  }
  // garantizar al menos una semilla por componente con territorio suficiente
  const haveSeed=new Set(seeds.map(s=>s.comp));
  const wantPix=new Map();
  comps.forEach((cm,id)=>{if(cm.size>=70&&!haveSeed.has(id))wantPix.set(id,(cm.size/2)|0)});
  if(wantPix.size){
    const seen=new Map();
    for(let i=0;i<MW*MH;i++){
      const id=compAt[i];
      if(id<0||!wantPix.has(id))continue;
      const s=(seen.get(id)||0);seen.set(id,s+1);
      if(s===wantPix.get(id)){
        seeds.push({x:i%MW,y:(i/MW)|0,c:countryAt[i],comp:id});
        wantPix.delete(id);
        if(!wantPix.size)break;
      }
    }
  }
  // vecino más cercano de la misma componente: listas de candidatos por celda sobre arrays
  // planos (los objetos y la búsqueda por anillos eran ~20x más lentos a esta resolución)
  const CS=64,bw=Math.ceil(MW/CS),bh=Math.ceil(MH/CS);
  const nSeeds=seeds.length;
  const seedX=new Float64Array(nSeeds),seedY=new Float64Array(nSeeds),seedComp=new Int32Array(nSeeds);
  for(let i=0;i<nSeeds;i++){seedX[i]=seeds[i].x;seedY[i]=seeds[i].y;seedComp[i]=seeds[i].comp}
  // cada celda conoce las semillas de las celdas a ±2 (cubre un radio de 128px desde el píxel)
  const candCount=new Int32Array(bw*bh);
  for(let i=0;i<nSeeds;i++){
    const sx=(seedX[i]/CS)|0,sy=(seedY[i]/CS)|0;
    for(let by=Math.max(0,sy-2);by<=Math.min(bh-1,sy+2);by++)
      for(let bx=Math.max(0,sx-2);bx<=Math.min(bw-1,sx+2);bx++)
        candCount[by*bw+bx]++;
  }
  const candStart=new Int32Array(bw*bh+1);
  for(let b=0;b<bw*bh;b++)candStart[b+1]=candStart[b]+candCount[b];
  const candSeed=new Int32Array(candStart[bw*bh]);
  {
    const fill=new Int32Array(bw*bh);
    for(let i=0;i<nSeeds;i++){
      const sx=(seedX[i]/CS)|0,sy=(seedY[i]/CS)|0;
      for(let by=Math.max(0,sy-2);by<=Math.min(bh-1,sy+2);by++)
        for(let bx=Math.max(0,sx-2);bx<=Math.min(bw-1,sx+2);bx++){
          const b=by*bw+bx;
          candSeed[candStart[b]+fill[b]++]=i;
        }
    }
  }
  function nearestSeed(x,y,comp){
    const b=((y/CS)|0)*bw+((x/CS)|0);
    let best=-1,bd=1e18;
    for(let k=candStart[b],e=candStart[b+1];k<e;k++){
      const si=candSeed[k];
      if(seedComp[si]!==comp)continue;
      const dx=seedX[si]-x,dy=seedY[si]-y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=si}
    }
    if(best>=0&&bd<=16384)return best; // exacto: nada más cercano puede quedar fuera de ±2 celdas
    // caso raro (componente con semillas lejanas): barrido completo
    for(let si=0;si<nSeeds;si++){
      if(seedComp[si]!==comp)continue;
      const dx=seedX[si]-x,dy=seedY[si]-y,d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=si}
    }
    return best;
  }
  // ruido suave para deformar las fronteras (formas orgánicas tipo EU4)
  function makeNoise(cell){
    const nw=Math.ceil(MW/cell)+2, nh=Math.ceil(MH/cell)+2;
    const g=new Float32Array(nw*nh);
    for(let i=0;i<g.length;i++)g[i]=S.rand()*2-1;
    return(x,y)=>{
      const fx=x/cell, fy=y/cell, ix=fx|0, iy=fy|0;
      let tx=fx-ix, ty=fy-iy;
      tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty);
      const o=iy*nw+ix, a=g[o],b=g[o+1],c=g[o+nw],e=g[o+nw+1];
      return a+(b-a)*tx+(c-a)*ty+(a-b-c+e)*tx*ty;
    };
  }
  const nx1=makeNoise(96),nx2=makeNoise(32),ny1=makeNoise(96),ny2=makeNoise(32);
  const warpX=(x,y)=>nx1(x,y)*16+nx2(x,y)*7;
  const warpY=(x,y)=>ny1(x,y)*16+ny2(x,y)*7;
  // asignación de píxeles (Voronoi limitado por componente nacional, con deformación)
  S.provIdx=new Int16Array(MW*MH).fill(-1);
  const counts=new Uint32Array(seeds.length);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const i=y*MW+x;
    if(countryAt[i]===0)continue;
    const wx=Math.max(0,Math.min(MW-1,x+warpX(x,y)));
    const wy=Math.max(0,Math.min(MH-1,y+warpY(x,y)));
    const s=nearestSeed(wx,wy,compAt[i]);
    if(s>=0){S.provIdx[i]=s;counts[s]++}
  }
  // limpieza: la deformación puede dejar fragmentos desconectados de su provincia
  {
    const frag=new Int32Array(MW*MH).fill(-1);
    const fragProv=[],fragPix=[];
    for(let i=0;i<MW*MH;i++){
      if(S.provIdx[i]<0||frag[i]>=0)continue;
      const fid=fragProv.length,p=S.provIdx[i],pix=[];
      fragProv.push(p);frag[i]=fid;
      const stack=[i];
      while(stack.length){
        const k=stack.pop();pix.push(k);
        const x=k%MW;
        let j;
        if(x>0){j=k-1;if(S.provIdx[j]===p&&frag[j]<0){frag[j]=fid;stack.push(j)}}
        if(x<MW-1){j=k+1;if(S.provIdx[j]===p&&frag[j]<0){frag[j]=fid;stack.push(j)}}
        if(k>=MW){j=k-MW;if(S.provIdx[j]===p&&frag[j]<0){frag[j]=fid;stack.push(j)}}
        if(k<MW*MH-MW){j=k+MW;if(S.provIdx[j]===p&&frag[j]<0){frag[j]=fid;stack.push(j)}}
      }
      fragPix.push(pix);
    }
    const mainFrag=new Map();
    for(let f=0;f<fragProv.length;f++){
      const p=fragProv[f];
      if(!mainFrag.has(p)||fragPix[f].length>fragPix[mainFrag.get(p)].length)mainFrag.set(p,f);
    }
    const isBad=new Uint8Array(MW*MH);
    let bad=[];
    for(let f=0;f<fragPix.length;f++){
      if(mainFrag.get(fragProv[f])===f)continue;
      for(const k of fragPix[f]){isBad[k]=1;bad.push(k)}
    }
    // reasignar por dilatación a la provincia vecina del mismo componente
    function dilate(){
      while(bad.length){
        const next=[];
        let changed=false;
        for(const k of bad){
          const x=k%MW;let pick=-1,j;
          if(x>0){j=k-1;if(S.provIdx[j]>=0&&!isBad[j]&&compAt[j]===compAt[k])pick=S.provIdx[j]}
          if(pick<0&&x<MW-1){j=k+1;if(S.provIdx[j]>=0&&!isBad[j]&&compAt[j]===compAt[k])pick=S.provIdx[j]}
          if(pick<0&&k>=MW){j=k-MW;if(S.provIdx[j]>=0&&!isBad[j]&&compAt[j]===compAt[k])pick=S.provIdx[j]}
          if(pick<0&&k<MW*MH-MW){j=k+MW;if(S.provIdx[j]>=0&&!isBad[j]&&compAt[j]===compAt[k])pick=S.provIdx[j]}
          if(pick>=0){counts[S.provIdx[k]]--;counts[pick]++;S.provIdx[k]=pick;isBad[k]=0;changed=true}
          else next.push(k);
        }
        if(!changed)break;
        bad=next;
      }
    }
    dilate();
    // fusionar provincias demasiado pequeñas en sus vecinas (evita huecos en la costa)
    const compBest=new Map();
    for(let s=0;s<seeds.length;s++){
      if(counts[s]===0)continue;
      const b=compBest.get(seeds[s].comp);
      if(b===undefined||counts[s]>counts[b])compBest.set(seeds[s].comp,s);
    }
    const tiny=new Set();
    for(let s=0;s<seeds.length;s++)
      if(counts[s]>0&&counts[s]<70&&compBest.get(seeds[s].comp)!==s)tiny.add(s);
    if(tiny.size){
      bad=[];
      for(let i=0;i<MW*MH;i++)if(S.provIdx[i]>=0&&tiny.has(S.provIdx[i])){isBad[i]=1;bad.push(i)}
      dilate();
    }
  }
  // provincias definitivas (el nombre real se asigna después con el gazetteer; las
  // anclas históricas conservan el suyo, el resto queda vacío hasta assignRealNames)
  const remap=new Int16Array(seeds.length).fill(-1);
  for(let i=0;i<seeds.length;i++){
    if(counts[i]<70)continue;
    remap[i]=S.provs.length;
    const an=seeds[i].aname;
    const own=MAPDATA.countries[seeds[i].c-1].nation;
    S.provs.push({id:S.provs.length,name:an||"",x:seeds[i].x,y:seeds[i].y,country:seeds[i].c,
      owner:own,owner0:own,named:!!an,coastal:false,
      morale:60,urban:false,resType:null,shade:0.85+S.rand()*0.3,capital:false, // urban lo siembra seedCities (datos, no sorteo)
      buildings:newBuildings(),buildQueue:[],recruitQueue:[]});
  }
  for(let i=0;i<S.provIdx.length;i++){
    const s=S.provIdx[i];
    S.provIdx[i]=s>=0?remap[s]:-1;
  }
  rebuildProvinceData();
  // nombres y capitales con ciudades reales (las ciudades son provincias urbanas)
  for(let ci=0;ci<MAPDATA.cities.length;ci++){
    const[name,cx,cy,c,cap]=MAPDATA.cities[ci];
    let pid=citySeedIdx[ci]>=0?remap[citySeedIdx[ci]]:-1;
    if(pid<0)pid=S.provIdx[cy*MW+cx];
    if(pid<0)continue;
    const p=S.provs[pid];
    p.name=name;p.named=true;p.urban=true;
    if(cap)p.capital=true;
  }
  // marca las provincias con nombre HISTORICO (anclas de pais + ciudades reales de MAPDATA)
  // ANTES de que el gazetteer las cubra: solo estas dan corredores jugables en el desierto.
  // Sin esto, assignRealNames pone toponimos reales (radio amplio) hasta en el Sahara profundo
  // y el desierto dejaba de ser impracticable (el Magreb crecia hacia el sur sin limite).
  for(const p of S.provs)p.anchor=p.named;
  assignRealNames();
  seedCities();          // las ciudades reales de 1444 (y el suelo curado); sustituye al sorteo
  assignTerrain();
  assignResources();
  // territorio impracticable (estilo EU4): sin dueño ni transito. Dos biomas hostiles:
  //  - Sahara profundo (desierto)
  //  - norte subártico lat>62.5 (Laponia/interior nórdico, casi permafrost en 1444)
  // En ambos, la costa y los enclaves con nombre historico (anchor) quedan como corredores.
  for(const p of S.provs)if(p.wasteland==null){
    const lat=pxToLonLat(p.x,p.y)[1];
    p.wasteland=(p.terrain==="desierto"||lat>62.5)&&!p.coastal&&!p.anchor;
  }
  isolateWastePockets();
  for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
  applyNationOverrides();
  assignPopulation();
}
// Correcciones manuales de frontera: cada [lat, lon, nación] fuerza el dueño de la provincia
// que CONTIENE ese punto. NO toca el Voronoi (los países conservan su forma), solo cambia de
// bando provincias concretas contiguas a esa nación. Para retoques finos que el Voronoi por
// anclas no acierta sin desbordarse. Se aplica al final de generateMap.
const NATION_OVERRIDES=[
  [42.32,-6.53,"Castilla"], // El Bierzo (Ponferrada): castellano; el Voronoi lo daba a Portugal
  [42.00,-7.27,"Castilla"], // Galicia SE (Verín/Ourense): castellano
  [38.35,-0.48,"Aragón"],   // Alicante: del Reino de Valencia (Corona de Aragón)
  [38.64,-0.84,"Aragón"],   // Elche: ídem
  [38.509,-3.766,"Castilla"], // Ciudad Real: castellana, el Voronoi la daba a Granada
  [38.087,-2.723,"Castilla"], // Campiña: ídem
  [37.768,-3.800,"Castilla"], // Jaén: ídem
  // — frontera húngara: le faltaban estas (Burgenland, Banato, Bácska) —
  [47.353,16.455,"Hungría"],  // Simmering
  [46.665,16.253,"Hungría"],  // Eisenzicken
  [46.987,16.926,"Hungría"],  // Szombathely
  [45.475,22.040,"Hungría"],  // Reşiţa
  [45.286,21.637,"Hungría"],  // Timişoara
  [45.049,18.205,"Hungría"],  // Sombor
  // — y estas le sobraban, son de Serbia —
  [44.138,20.089,"Serbia"],   // Čačak
  [44.499,20.392,"Serbia"],   // Belgrado
  [44.643,19.719,"Serbia"]    // Valjevo
];
function applyNationOverrides(){
  const G=MAPDATA.geo;
  const yn=Math.log(Math.tan(Math.PI/4+G.NORTH*Math.PI/360)), ys=Math.log(Math.tan(Math.PI/4+G.SOUTH*Math.PI/360));
  for(const[lat,lon,name]of NATION_OVERRIDES){
    const ni=MAPDATA.nations.findIndex(n=>n.name===name);
    if(ni<0)continue;
    const x=Math.round((lon-G.WEST)/(G.EAST-G.WEST)*MW);
    const my=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
    const y=Math.round((yn-my)/(yn-ys)*MH);
    if(x<0||y<0||x>=MW||y>=MH)continue;
    const pid=S.provIdx[y*MW+x];
    if(pid<0)continue;
    const p=S.provs[pid];
    if(p.wasteland)continue;
    p.owner=ni;p.owner0=ni;
  }
}
// ============ Renombrar el mapa con el gazetteer HISTÓRICO (acción del editor) ============
// Rehace de cero el nombre de TODAS las provincias, y mueve las capitales a su ciudad.
//
// EL BUG QUE ARREGLA: assignRealNames bautiza a la provincia cuyo CENTRO le pilla más cerca a la
// ciudad — no a la que la CONTIENE. Como además recorre PLACES (GeoNames ordenado por población
// MODERNA), un barrio de Madrid llegaba antes que Toledo y le quitaba su provincia: medido, 54 de
// las 217 ciudades curadas acabaron en la provincia de al lado, la de Toledo se llamaba "Puente de
// Vallecas", y 11 capitales (Toledo, Praga, Lübeck, Nóvgorod, Buda, Tabriz…) dejaban de coincidir
// con su ciudad. Aquí la regla es CONTIENE, que es exacta y no depende de dónde caiga el centro.
//
// Es EXPLÍCITA, no automática: el editor deja renombrar a mano (renameProvince), así que calcular
// los nombres al cargar borraría ese trabajo. Y es DESTRUCTIVA: no distingue un nombre puesto a
// mano de uno del gazetteer.
function renameProvincesHistorical(){
  const provAt=(x,y)=>{                                  // la provincia que CONTIENE ese píxel
    if(!(x>=0&&y>=0&&x<MW&&y<MH))return null;
    const pid=S.provIdx[y*MW+x];
    if(pid<0)return null;
    const p=S.provs[pid];
    return p.wasteland?null:p;
  };
  // Las capitales de reinos cuya ciudad NO está curada (Nikšić, Aqaba) conservan la que tenían:
  // sin esto se quedarían sin capital y setupNations les daría una provincia cualquiera.
  const capPrevia=new Map();
  for(const p of S.provs)if(p.capital&&p.owner<NPLAY)capPrevia.set(p.owner,p.id);
  for(const p of S.provs){p.name="";p.named=false;p.capital=false}
  const used=new Set();
  // CAPA 1 — las 217 ciudades curadas a mano. Mandan ellas: son las de Sergio y van en español
  // (CITY_POP_RAW, la tabla de población, está indexada por esos nombres: renombrar al inglés le
  // haría perder a Praga sus 40.000 habitantes). Capitales primero y, a igualdad, la más poblada,
  // para que si dos caen en la misma provincia gane la que importa.
  const curadas=[...MAPDATA.cities].sort((a,b)=>
    ((b[4]?1:0)-(a[4]?1:0))||((CITY_POP[popNormKey(b[0])]||0)-(CITY_POP[popNormKey(a[0])]||0)));
  for(const[name,cx,cy,c,cap] of curadas){
    const p=provAt(cx,cy);
    if(!p)continue;
    // La capital solo se planta si la provincia es de SU reino. El campo `c` de MAPDATA.cities es
    // 1-based sobre countries (Toledo c=1 → countries[0] → Castilla; verificado con Zaragoza→Aragón
    // y Lisboa→Portugal). Sin esta comprobación el Imperio Otomano salía con DOS capitales:
    // Adrianópolis (la suya de verdad en 1444) y Rodas, cuyo reino perdió su provincia en el mapa.
    if(cap){
      const co=MAPDATA.countries[c-1];
      if(co&&p.owner===co.nation)p.capital=true;         // va aunque la provincia ya tenga nombre
    }
    if(p.named)continue;                                 // se la quedó una mayor
    p.name=name;p.named=true;used.add(popNormKey(name));
  }
  for(const[owner,pid] of capPrevia)                     // reinos sin ciudad curada: capital intacta
    if(!S.provs.some(p=>p.owner===owner&&p.capital))S.provs[pid].capital=true;
  // CAPA 2 — las ciudades del dataset que la curación no vio (Siwas, Tokat, Pérgamo, Asiut…, casi
  // todas en Anatolia y Oriente Medio). CITIES1444 viene ordenado por población desc, así que si
  // dos caen en la misma provincia se la queda la mayor. Las que la curación SÍ vio no llegan aquí:
  // coinciden a 0-3 km con la suya, o sea en la misma provincia, que ya quedó nombrada en la capa 1.
  if(typeof CITIES1444!=="undefined")for(const[name,x,y,pop] of CITIES1444){
    const p=provAt(x,y);
    if(!p||p.named||used.has(popNormKey(name)))continue;
    p.name=name;p.named=true;used.add(popNormKey(name));
  }
  // CAPA 3 — el resto (rural): el gazetteer moderno de siempre. Respeta las ya nombradas.
  assignRealNames();
  // LOCALIZACIÓN: guardar el nombre CANÓNICO en p.canon y mostrar el LOCALIZADO en p.name (Basel->Basilea).
  for(const p of S.provs){p.canon=p.name;p.name=localize(p.name)}
}
// nombres reales de ciudad por cercanía: recorre el gazetteer PLACES (ordenado por
// población desc) y cada ciudad reclama la provincia SIN nombre más cercana dentro de un
// radio. Así cada provincia toma el topónimo real de su zona y las urbes importantes caen
// primero. Las que no tengan ciudad cerca (interiores despoblados) quedan con nombre por
// sílabas. Se ignora si el gazetteer no está cargado (mantiene el comportamiento antiguo).
function assignRealNames(){
  // `used` NORMALIZADO (sin acentos ni mayúsculas): evita duplicados por variante gráfica —
  // "Perigueux" no se coloca si "Périgueux" ya está usada (Écija/Ecija, Úbeda/Ubeda…).
  const used=new Set();
  for(const p of S.provs)if(p.named&&p.name)used.add(popNormKey(p.name));
  if(typeof PLACES!=="undefined"&&PLACES){
    const CS=32,bw=Math.ceil(MW/CS),bh=Math.ceil(MH/CS);
    const claimed=new Uint8Array(S.provs.length);
    // pasada 1 (por ciudad, población desc): cada urbe reclama la provincia sin nombre más
    // cercana en un radio corto → las ciudades importantes caen sobre "su" provincia
    const provCell=Array.from({length:bw*bh},()=>[]);
    for(const p of S.provs)if(!p.named)provCell[((p.y/CS)|0)*bw+((p.x/CS)|0)].push(p.id);
    const R=44,R2=R*R,rc=Math.ceil(R/CS);
    for(const pl of PLACES){
      const name=pl[0];if(used.has(popNormKey(name)))continue;
      const x=pl[1],y=pl[2],bx=(x/CS)|0,by=(y/CS)|0;
      let best=-1,bd=R2;
      for(let cy=Math.max(0,by-rc);cy<=Math.min(bh-1,by+rc);cy++)
        for(let cx=Math.max(0,bx-rc);cx<=Math.min(bw-1,bx+rc);cx++)
          for(const pid of provCell[cy*bw+cx]){
            if(claimed[pid])continue;
            const p=S.provs[pid],dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
            if(d<bd){bd=d;best=pid}
          }
      if(best>=0){S.provs[best].name=name;S.provs[best].named=true;claimed[best]=1;used.add(popNormKey(name))}
    }
    // pasada 2 (por provincia): las que sigan sin nombre toman la ciudad libre más cercana en
    // un radio amplio → recoge las provincias rurales lejos de cualquier urbe grande
    const placeCell=Array.from({length:bw*bh},()=>[]);
    for(let i=0;i<PLACES.length;i++)placeCell[((PLACES[i][2]/CS)|0)*bw+((PLACES[i][1]/CS)|0)].push(i);
    const RB=260,RB2=RB*RB,rcb=Math.ceil(RB/CS);
    for(const p of S.provs){
      if(p.named)continue;
      const bx=(p.x/CS)|0,by=(p.y/CS)|0;
      let best=-1,bd=RB2;
      for(let cy=Math.max(0,by-rcb);cy<=Math.min(bh-1,by+rcb);cy++)
        for(let cx=Math.max(0,bx-rcb);cx<=Math.min(bw-1,bx+rcb);cx++)
          for(const pi of placeCell[cy*bw+cx]){
            const pl=PLACES[pi];if(used.has(popNormKey(pl[0])))continue;
            const dx=pl[1]-p.x,dy=pl[2]-p.y,d=dx*dx+dy*dy;
            if(d<bd){bd=d;best=pi}
          }
      if(best>=0){p.name=PLACES[best][0];p.named=true;used.add(popNormKey(PLACES[best][0]))}
    }
  }
  // relleno: provincias sin ninguna ciudad real cerca toman nombre por sílabas (no "named")
  for(const p of S.provs)if(!p.name)p.name=genName(used);
}
function isolateWastePockets(){
  // EL MAR SE QUEDA FUERA DE ESTO, y no es un detalle: esta función se queda con el componente MAYOR
  // y convierte en PÁRAMO todo lo demás. Las 344 teselas de mar forman su propio componente (S.adj
  // no cruza medios), que es más pequeño que Eurasia -> el océano entero acabaría siendo páramo.
  const seen=new Set();
  const comps=[];
  for(const p of S.provs){
    if(p.wasteland||isSea(p)||seen.has(p.id))continue;
    const st=[p.id];seen.add(p.id);
    const comp=[];
    while(st.length){
      const k=st.pop();comp.push(k);
      for(const b of S.adj[k])if(!S.provs[b].wasteland&&!isSea(S.provs[b])&&!seen.has(b)){seen.add(b);st.push(b)}
      // el salto de mar que engancha las islas (Britania, Sicilia…) al continente va por navAdj
      // (costera↔costera): S.seaAdj ahora apunta a las TESELAS de mar, que este flood excluye.
      for(const b of S.navAdj[k])if(!S.provs[b].wasteland&&!isSea(S.provs[b])&&!seen.has(b)){seen.add(b);st.push(b)}
    }
    comps.push(comp);
  }
  comps.sort((a,b)=>b.length-a.length);
  for(let c=1;c<comps.length;c++)for(const id of comps[c])S.provs[id].wasteland=true;
}
const MOUNTAIN_ZONES=[
  [46.4,8.0,1.6],[46.8,11.5,1.8],[47.0,14.5,1.5],           // Alpes
  [42.7,0.5,1.7],[42.8,-1.8,1.2],                           // Pirineos
  [43.1,-5.5,1.3],[37.2,-3.2,0.9],                          // Cantábrico, Sierra Nevada
  [44.2,10.5,1.2],[42.8,13.2,1.1],[41.0,15.0,1.0],[39.3,16.3,0.9], // Apeninos
  [44.0,17.5,1.6],[42.5,19.8,1.3],[39.8,21.2,1.2],          // Dináricos, Pindo
  [48.9,23.5,1.5],[47.0,25.3,1.4],[45.5,24.5,1.4],[42.5,24.5,1.2], // Cárpatos, Balcanes
  [43.0,42.5,1.8],[42.5,45.5,1.8],                          // Cáucaso
  [37.3,32.5,1.6],[38.5,35.5,1.5],[39.5,41.0,2.2],[38.5,43.5,2.0], // Tauro, Anatolia oriental
  [34.5,47.0,2.0],[32.5,49.0,1.8],                          // Zagros
  // Atlas del Magreb: espina INTERIOR (la costa es franja fertil, ver assignTerrain).
  // Alto/Medio Atlas marroquies, Tell tras la costa argelina, Aures, Atlas Sahariano
  // (muro sur del Magreb) y Dorsal tunecina. Radios ajustados para no invadir la costa.
  [31.0,-7.5,1.0],[31.8,-5.3,1.0],[32.6,-4.2,0.8],                 // Alto/Medio Atlas (interior de Marruecos)
  [34.9,-4.2,0.6],                                                 // Rif (a la costa; pequeno)
  [35.4,0.2,0.7],[35.9,2.8,0.8],                                   // Atlas Telliano tras la costa (Oran, Argel)
  [36.2,4.6,0.6],[36.0,5.9,0.6],                                   // Kabilias (pequenas)
  [35.2,6.5,0.8],                                                  // Aures
  [33.6,0.5,1.0],[34.1,3.0,1.0],[34.6,5.5,0.9],                    // Atlas Sahariano (muro sur, interior)
  [35.5,9.0,0.6],                                                  // Dorsal tunecina (pequena)
  [61.5,8.5,2.2],[63.5,11.5,1.8],[65.0,14.0,2.5],           // Alpes escandinavos
  [56.9,-4.5,1.2],                                          // Highlands escocesas
  [45.2,2.8,1.4],[50.2,13.0,1.0]                            // Macizo Central, Sudetes
];
const MARSH_ZONES=[[52.2,27.5,1.6],[45.3,29.5,0.8],[53.0,5.8,0.7]];
const FERTILE_ZONES=[
  [31.0,31.2,0.9],[29.5,31.0,1.0],[27.8,30.8,0.9],   // valle y delta del Nilo
  [33.2,44.3,1.2],[31.6,46.6,1.2],[34.6,43.4,1.0],   // Mesopotamia (Tigris-Éufrates)
  [45.1,28.6,1.0],[44.2,26.3,1.1],                   // bajo Danubio y su desembocadura
  [51.3,4.6,1.0],                                    // Países Bajos y Flandes
  [45.1,10.5,1.3],                                   // valle del Po
  [37.5,-5.6,0.9],[39.4,-0.5,0.6]                    // Guadalquivir, huerta de Valencia
];
function pxToLonLat(x,y){
  const G=MAPDATA.geo;
  const lon=G.WEST+x/MW*(G.EAST-G.WEST);
  const yn=Math.log(Math.tan(Math.PI/4+G.NORTH*Math.PI/360)), ys=Math.log(Math.tan(Math.PI/4+G.SOUTH*Math.PI/360));
  const m=yn-y/MH*(yn-ys);
  const lat=(Math.atan(Math.exp(m))-Math.PI/4)*360/Math.PI;
  return[lon,lat];
}
function assignTerrain(){
  for(const p of S.provs){
    if(p.terrain)continue;
    const[lon,lat]=pxToLonLat(p.x,p.y);
    const kx=Math.cos(lat*Math.PI/180);
    // Costa del Magreb (Tell): franja fertil donde se concentro la poblacion. Se asigna
    // ANTES que el Atlas para que la costa sea vega, no montaña. Excluye la costa sahariana
    // atlantica (lat<=30) y la costa iberica (lat>=35.8 solo cuenta al este de lon 3).
    if(p.coastal&&lon>-11&&lon<11&&lat>30&&lat<37.5&&(lat<35.8||lon>3)){p.terrain="vega";continue}
    let t=null,hill=false;
    for(const[zla,zlo,r]of MOUNTAIN_ZONES){
      const d=Math.hypot(lat-zla,(lon-zlo)*kx);
      if(d<r*0.8){t="montana";break}
      if(d<r*1.25)hill=true;
    }
    if(!t)for(const[zla,zlo,r]of MARSH_ZONES){
      const d=Math.hypot(lat-zla,(lon-zlo)*kx);
      if(d<r){t="pantano";break}
    }
    if(!t)for(const[zla,zlo,r]of FERTILE_ZONES){ // antes que colinas y desierto: el Nilo es vega, no Sáhara
      const d=Math.hypot(lat-zla,(lon-zlo)*kx);
      if(d<r){t="vega";break}
    }
    if(!t&&hill)t="colinas";
    // Magreb: el Sahara empieza justo al sur del Atlas, cuya cresta sube de oeste
    // (~30N en Marruecos) a este (~34N en Tunez); por eso el umbral de desierto depende
    // de la longitud, no una latitud plana. Entre los dos Atlas queda el altiplano (estepa).
    if(!t&&lon>-11&&lon<11){
      const desLat=Math.min(34.3,30.2+(lon+9)*0.28);
      if(lat<desLat)t="desierto";
      else if(lat<35&&lon>-2)t="estepa";                     // Altos Plateaux argelinos
    }
    if(!t&&lat<31.2)t="desierto";                            // Sahara oriental, Egipto, Arabia
    if(!t&&lat<33.5&&lon>36.5&&lon<48)t="desierto";          // interior sirio-iraquí
    if(!t&&lat>=44&&lat<=49.5&&lon>=28&&lon<=50)t="estepa";  // estepa póntica
    if(!t&&lat>=46&&lat<=48.5&&lon>=18.5&&lon<=22)t="estepa";// puszta húngara
    if(!t&&lat>62.5)t="tundra";                              // norte subártico (Laponia): casi permafrost
    if(!t&&lat>57)t="bosque";                                // taiga escandinava y rusa
    if(!t&&lat>52&&lon>20)t="bosque";                        // cinturón boscoso báltico-ruso
    if(!t&&lat>44&&lat<57&&S.rand()<0.14)t="bosque";           // bosques dispersos europeos
    if(!t&&lat>=43&&lat<=55&&lon<=12&&S.rand()<0.5)t="pradera";// praderas atlánticas templadas
    p.terrain=t||"llanura";
  }
}
// Yacimientos de metal precioso (distribución histórica del s.XV). [latMin,latMax,lonMin,lonMax].
// La plata es común en la Europa central minera; el oro es raro (Cárpatos).
const SILVER_ZONES=[
  [48.5,50.6,12.5,17],   // Bohemia (Kutná Hora, Jáchymov)
  [46.3,48.2,9.5,13.6],  // Tirol y Alpes orientales
  [50.4,52,9.3,13.6],    // Sajonia / Harz / Erzgebirge
  [38.8,41.3,7.8,10],    // Cerdeña (Iglesiente)
  [41.8,44.6,18.8,22.2], // Serbia / Bosnia (Novo Brdo, Srebrenica)
  [37.3,41.2,-7.2,-1.8]  // Sierras ibéricas (Sierra Morena, Guadalcanal)
];
const GOLD_ZONES=[
  [47.8,49.6,17.4,20.6], // Eslovaquia / Cárpatos (Kremnica, Banská Štiavnica)
  [45.4,47.6,22.3,25.7]  // Transilvania (Baia Mare, Roșia Montană)
];
function inZones(zones,lon,lat){for(const[la0,la1,lo0,lo1]of zones)if(lat>=la0&&lat<=la1&&lon>=lo0&&lon<=lo1)return true;return false}
// El TERRENO manda los BÁSICOS (grano/madera/piedra/hierro). El resType de una provincia es un ESPECIAL de
// COMERCIO situado por su ZONA HISTÓRICA de producción (cajas [latMin,latMax,lonMin,lonMax], como plata/oro):
// vino donde había viñedos, seda en las rutas de la seda, especias en los entrepôts, sal en las salinas
// históricas, caballos en las llanuras ganaderas. Fuera de esas zonas la provincia es agrícola pura
// (resType=null). Así se acaba el "vino en Rusia": la distribución es histórica y por eso los bienes escasean
// donde no se producen → nace el comercio. (Ver [[basileus-pop-economy-vision]].)
// Catálogo de ZONAS históricas de producción por bien: z = cajas [latMin,latMax,lonMin,lonMax]; terr = terrenos
// permitidos (o null = cualquier tierra); coast = solo costa; urban = manufactura de ciudad (se prefiere en urbes).
const RES_SPEC={
  // ---- bienes de comercio (materia prima y lujos del campo) ----
  vino:{z:[[36,43.5,-9,3.5],[43,49,-2.5,6.5],[37,46.5,7,18.5],[47.8,51.5,6,9.2],[44.5,48.5,15.5,23],[34.5,41.5,19,28],[31,37,32,37.5]],terr:["colinas","llanura","vega","pradera"]},
  uva:{z:[[36,43.5,-9,3.5],[43,49,-2.5,6.5],[37,46.5,7,18.5],[47.8,51.5,6,9.2],[44.5,48.5,15.5,23],[34.5,41.5,19,28]],terr:["colinas","llanura","vega","pradera"]},
  seda:{z:[[42.8,46,8.5,13.2],[36.8,40,14.5,17.2],[36.3,40,-5.5,0.3],[36.5,41.5,20,29.5],[31,37,33.5,38.5],[36,42.5,46,53]],urban:true},
  sedacruda:{z:[[36.8,40,14.5,17.2],[36.3,40,-5.5,0.3],[36.5,41.5,20,29.5],[31,37,33.5,38.5],[36,42.5,46,53]],terr:["colinas","vega","llanura"]},
  raros:{z:[[45,46.4,11.8,13.8],[43.3,45,7.8,10.2],[29,32,28,32.8],[31,36.2,33.8,38.5],[38,41.6,26,31],[40,46,32.5,41.5]],urban:true}, // especias: entrepôts
  sal:{z:[[37,47.5,-10,-1],[34,40,-1.5,15.5],[46.5,51,12,21.5],[43,46.5,12,16.8],[43.5,47.5,31,39],[52,54.8,-3.3,-1.6],[31,37,32,37.5]],terr:null},
  petroleo:{z:[[44.5,48.8,15,23],[49,56,17,29.5],[36.5,40.5,30.5,37.5],[36,39.8,-7.5,-1],[28,36,-9.5,11.5],[43.5,50,28,47]],terr:["llanura","pradera","estepa","vega"]}, // caballos
  aceituna:{z:[[36,39.5,-7,-1],[38,44.5,11,18.5],[36,40.5,20,27],[31,37,33.5,37.5],[31,37,-9,11.5],[37,40,25,28]],terr:["colinas","llanura","vega"]},
  cana:{z:[[34.4,35.6,32.3,34.6],[36.8,38.2,12.5,15.6],[38.4,40,-0.8,0.6],[31,35.5,33.8,37],[29,31.5,29.5,32.5]],terr:["vega","llanura"]},
  lana:{z:[[49.8,55.5,-5.6,1.7],[39.5,43.5,-7,-0.5],[40,42.5,-1,1.5]],terr:["colinas","pradera","estepa","llanura","montana"]},
  ganado:{z:[[44.5,48.5,15,23],[42,46.5,17,26],[51.5,55.5,-11,-5.5],[54,57.5,7.5,13],[28,36,-9.5,11.5]],terr:["pradera","llanura","estepa","vega"]},
  lino:{z:[[46,50.5,-1.5,5.5],[49.5,52.5,2,6],[48,52.5,6.5,13.5],[52.5,57.5,17,27],[29,31.5,29,32.5]],terr:["vega","llanura","pradera"]},
  algodon:{z:[[32.5,37.5,34.5,38.5],[36.5,40.5,26.5,37],[29,31.5,29,32.5],[36.8,38.2,12.5,15.6]],terr:["vega","llanura","desierto","colinas"]},
  tinte:{z:[[42.8,44.5,0.5,2.8],[50,52,10,12.5],[37,40.5,-4.5,0.5],[37,39.5,21.5,24.5]],terr:["llanura","vega","pradera","colinas"]},
  pescado:{z:[[50.5,59,-5,10],[57.5,66.5,3,13],[53.5,60.5,9,27],[38,42,25,30]],coast:true},
  pieles:{z:[[51.5,64,26,52],[57.5,66.5,9,28],[53.5,60,19,31]],terr:["bosque","tundra"]},
  cera:{z:[[51.5,63,26,52],[49.5,55.5,14,25],[53.5,58.5,19,29],[30,36,-6,11]],terr:["bosque","llanura","pradera","colinas"]},
  ambar:{z:[[53,57.5,14,24]],coast:true}, // costa báltica (Prusia/Pomerania/Lituania), ampliada para que caiga en ≥ varias costeras
  cobre:{z:[[59,62,14,17.5],[46.2,48,10,13],[47.5,49.6,17,22]],terr:["montana","colinas"]},
  // estaño: Cornualles + Erzgebirge + Galicia + Alpes; terreno RELAJADO (montana/colinas casi no caían) para que ≥ varias provincias lo produzcan → resucita el bronce
  estano:{z:[[49.3,51.4,-6,-2.5],[50,51,12,14],[42,43.5,-8.5,-6],[46,48,10,13.5]],terr:["montana","colinas","llanura","pradera","vega"]},
  hulla:{z:[[54,56,-2.2,-0.8],[50,51.3,4.5,6.5],[51,53,-4.5,-3],[50,51.6,15.5,19.5],[51,52.2,6,8.2]],terr:["montana","colinas","llanura"]},
  // alumbre: Focea (Anatolia occ.) + Tolfa (Lacio); cajas AMPLIADAS y terreno relajado (antes 0 provincias) → desbloquea el paño de calidad
  alumbre:{z:[[37.5,40.5,25,29.5],[41,43,10.5,13.2]],terr:["montana","colinas","llanura","estepa","vega"]},
  // ---- manufacturas de ciudad (se prefieren en urbes; su fábrica compra la materia del mercado) ----
  pano:{z:[[49.3,52.6,1.3,5.7],[42.8,46,8.3,13.2],[49.8,55.5,-5.6,1.7],[41,44.6,-1.2,4.6]],urban:true},
  lienzo:{z:[[50.5,52.6,6.8,9.2],[47,49.5,3,5.5],[47.5,49.2,9.3,11.3],[29,31.5,29,32.5]],urban:true},
  fustan:{z:[[47.8,48.9,10.2,11.4],[48,48.9,9.5,10.4],[45,46.2,8.3,9.7]],urban:true},
  aceite:{z:[[36,39.5,-7,-1],[38,44.5,11,18.5],[36,40.5,20,27],[31,37,33.5,37.5],[31,37,-9,11.5]],urban:false,terr:["colinas","llanura","vega"]},
  azucar:{z:[[34.4,35.6,32.3,34.6],[36.8,38.2,12.5,15.6],[38.4,40,-0.8,0.6]],urban:true},
  cuero:{z:[[37,39.5,-6.5,-2.5],[30,35.5,-9.5,-2.5],[42,46.5,17.5,24.5],[45,48,16,22.5]],urban:true},
  acero:{z:[[47,48,14,15.5],[45,46,8.5,10],[39.5,41,-4.5,-3.5],[50.8,51.5,6.5,7.5]],urban:true},
  bronce:{z:[[49,50,10.8,11.6],[50.8,51.5,4.2,5],[45,46,8.5,9.6]],urban:true},
  armas:{z:[[45,46,8.5,10.5],[45.3,45.9,10,10.6],[39.5,41,-4.5,-3.5],[50.8,51.4,6.8,7.5]],urban:true},
  carbon:{z:[[45,66,-6,55]],terr:["bosque"]}, // carboneras: cualquier bosque de Europa
};
function resTerrOK(spec,p){
  if(spec.coast)return !!p.coastal;
  if(!spec.terr)return true;
  return spec.terr.indexOf(p.terrain)>=0;
}
function assignResources(){
  for(const p of S.provs){
    p.resType=null;
    if(p.wasteland||isSea(p))continue;      // en el agua no hay yacimientos
    const[lon,lat]=pxToLonLat(p.x,p.y);
    const t=p.terrain;
    // Yacimientos de plata/oro (zonas mineras históricas) — prioridad
    if(t==="montana"||t==="colinas"||t==="bosque"){
      if(inZones(GOLD_ZONES,lon,lat)&&S.rand()<0.40){p.resType="oro";continue}
      if(inZones(SILVER_ZONES,lon,lat)&&S.rand()<0.48){p.resType="plata";continue}
    }
    // candidatos: bienes cuya ZONA histórica contiene la provincia y cuyo terreno/costa encaja
    const urban=[],rural=[];
    for(const g in RES_SPEC){const s=RES_SPEC[g];
      if(!inZones(s.z,lon,lat)||!resTerrOK(s,p))continue;
      (s.urban?urban:rural).push(g);
    }
    // Ciudades: prefieren las manufacturas de su región (paño, seda, armas…); si no, una materia local
    if(p.urban){
      const pool=urban.length?urban:rural;
      if(pool.length)p.resType=pool[(S.rand()*pool.length)|0];
      continue;
    }
    // Campo: la materia prima de su zona (~55% de las provincias en zona la llevan; el resto, agrícolas puras)
    if(rural.length&&S.rand()<0.55)p.resType=rural[(S.rand()*rural.length)|0];
  }
}
/* ============================== Población =============================
 * Población realista de ~1444. Es DERIVADA (no se guarda en la instantánea):
 * se recalcula al cargar tanto en generateMap como en loadProvMap, así el mapa
 * oficial y el procedural quedan iguales y determinista para todos los jugadores.
 * No es plana por país: sale de (a) densidad RURAL = densidad regional histórica ×
 * fertilidad del terreno × área real de la provincia (km², con corrección Mercator)
 * y (b) un núcleo URBANO para las ciudades, con tabla de las grandes urbes de la
 * época para que las principales lleven su peso real. El páramo no tiene población. */
const POP_GAIN=0.62;   // palanca global de calibración del total
const RURAL_CAP=70000; // tope de población RURAL por provincia (el campo no concentra cientos de miles)
// Área real (km²) de un píxel a una latitud dada. El mapa es equirectangular en x
// (lon lineal) y Mercator en y; el ancho y el alto reales de un píxel escalan ambos
// con cos(lat), de ahí el cos² (ver pxToLonLat para las constantes de proyección).
function pxAreaConst(){
  const G=MAPDATA.geo,R=6371;
  const dlon=(G.EAST-G.WEST)/MW*Math.PI/180;
  const yn=Math.log(Math.tan(Math.PI/4+G.NORTH*Math.PI/360)), ys=Math.log(Math.tan(Math.PI/4+G.SOUTH*Math.PI/360));
  const dmerc=(yn-ys)/MH;
  return R*R*dlon*dmerc; // km²/px a cos²=1 (ecuador); multiplicar por cos²(lat)
}
// Densidad rural base (hab/km²) por región histórica. [latMin,latMax,lonMin,lonMax,dens];
// primer rectángulo que contiene el punto gana. Fuera de todos, se usa un valor por latitud.
const POP_REGIONS=[
  [26.5,31.5,29,33.5, 46],  // valle y delta del Nilo (el corazón demográfico del área)
  [50.3,53.6,2,7.6, 42],    // Flandes / Países Bajos
  [43.5,46.6,7,13.5, 40],   // Norte de Italia (Po, Toscana, Lombardía)
  [45.6,50,0,5.5, 30],      // Francia norte (cuenca de París)
  [46.8,52,5.5,10.5, 27],   // Renania / Alemania occidental
  [40.5,43.6,11.5,18.5, 24],// Italia central-sur
  [36.5,40.5,12,17, 22],    // Sicilia / Calabria / Nápoles
  [42.8,46.6,-1.5,6, 22],   // Francia sur / Occitania
  [49.8,53.6,-5.5,1.8, 21], // Inglaterra sur + Gales
  [35.5,39.6,-7.5,0.5, 18], // Iberia sur (Andalucía, Murcia, Valencia)
  [35.5,41,19,29.5, 17],    // Grecia / Egeo / costa oeste de Anatolia
  [30.5,37,37.5,48.5, 19],  // Mesopotamia (Tigris-Éufrates)
  [30.5,37.5,33.5,37.8, 17],// Levante costero
  [45,51.5,9.5,20, 16],     // Bohemia / Austria / Baviera / Hungría
  [29.5,37.6,-9,11.5, 12],  // costa del Magreb (Tell) — franja poblada
  [39.4,43.6,-9,3.5, 12],   // Iberia norte-centro (Meseta, Cataluña, Portugal norte)
  [40.5,46,14.5,25.5, 12],  // Balcanes
  [48.5,55.5,14.5,25.5, 9], // Polonia / Báltico sur
  [36.5,41.5,29,42.5, 8],   // Anatolia interior
  [50,60,25,50.5, 5.5],     // Rusia occidental
  [53.5,60.5,4.5,18, 6],    // Escandinavia meridional (Dinamarca, Escania, sur de Suecia/Noruega)
  [43.5,50.5,27,50.5, 3.5], // estepa póntica / Crimea
  [26.5,33,33.5,50.5, 2.5], // bordes de Arabia/desierto (casi vacío)
  [60,66.5,4,50.5, 1.5]     // Escandinavia y Rusia septentrionales (subártico)
];
function regionDensity(lon,lat){
  for(const[la0,la1,lo0,lo1,d]of POP_REGIONS)
    if(lat>=la0&&lat<=la1&&lon>=lo0&&lon<=lo1)return d;
  return lat<40?12:lat<50?15:lat<58?7:3; // fallback por latitud
}
const POP_TERR_FERT={vega:1.5,pradera:1.25,llanura:1.1,bosque:0.7,colinas:0.85,
  pantano:0.55,meseta:0.6,estepa:0.5,montana:0.35,desierto:0.06,tundra:0.1};
// Grandes urbes con población histórica aproximada de mediados del s.XV (clave sin acentos).
// Las que no estén en la tabla se modelan por región. Cubre las que existen en el mapa.
const CITY_POP_RAW={
  "el cairo":200000,"cairo":200000,"constantinopla":50000,"istanbul":50000,
  "paris":100000,"venecia":100000,"milan":90000,"napoles":80000,"granada":70000,
  "genova":60000,"florencia":60000,"tunez":60000,"fez":55000,"damasco":50000,
  "sevilla":50000,"lisboa":50000,"londres":50000,"brujas":45000,"gante":45000,
  "alepo":45000,"bagdad":45000,"colonia":40000,"praga":40000,"palermo":40000,
  "cordoba":40000,"valencia":40000,"tabriz":40000,"roma":35000,"barcelona":35000,
  "bolonia":35000,"ruan":30000,"bruselas":30000,"moscu":30000,"verona":30000,
  "marrakech":30000,"tlemcen":30000,"bursa":30000,"sarai":30000,"nuremberg":25000,
  "viena":25000,"lubeck":25000,"toulouse":25000,"burdeos":25000,"lyon":25000,
  "salonica":25000,"toledo":25000,"zaragoza":25000,"novgorod":25000,"amberes":25000,
  "adrianopolis":22000,"estrasburgo":20000,"augsburgo":20000,"hamburgo":18000,
  "danzig":20000,"cracovia":20000,"buda":20000,"belgrado":20000,"valladolid":20000,
  "tiflis":20000,"mesina":20000,"malaga":16000,"murcia":15000,"oporto":15000,
  "esmirna":15000,"konya":15000,"diyarbakir":15000,"edimburgo":12000,"york":12000,
  "bristol":12000,"atenas":10000,"dublin":10000,"copenhague":10000,"vilna":10000,
  "cagliari":10000,"trebisonda":10000,"nicosia":10000,"riga":8000,"ragusa":8000,
  "rodas":8000,"bergen":7000,"estocolmo":6000,"hail":5000
};
function popNormKey(s){return(s||"").toLowerCase().normalize("NFD").replace(/[^a-z ]/g,"").trim()}
const CITY_POP=(()=>{const m={};for(const k in CITY_POP_RAW)m[popNormKey(k)]=CITY_POP_RAW[k];return m})();
// LOCALIZACIÓN de un nombre CANÓNICO (inglés/GeoNames) a su forma de ~1444 (español), con la tabla
// EXONYMS (call-of-war/exonyms.js, global). Si no hay exónimo, se muestra el canónico tal cual. El mapa
// guarda el canónico (p.canon) y muestra el localizado (p.name): misma provincia, "Basel" clave y
// "Basilea" mostrado. Futuro i18n: EXONYMS[idioma][clave].
function localize(name){return(typeof EXONYMS!=="undefined"&&EXONYMS[popNormKey(name)])||name;}
// Rellena la población SOLO donde no hay valor (p.pop==null): siembra inicial en la
// generación y red de seguridad al cargar. Los valores ya guardados o editados a mano se
// respetan (el tope RURAL_CAP vive aquí, así que solo afecta a la siembra, nunca a tus ediciones).
function assignPopulation(){
  const K=pxAreaConst();
  for(const p of S.provs){
    if(p.wasteland||isSea(p)){p.pop=0;continue}   // ni el páramo ni el mar tienen población
    if(p.pop!=null)continue;                 // valor guardado/editado: se respeta
    const npx=(S.pixOfProv[p.id]||[]).length;
    if(!npx){p.pop=0;continue}
    const[lon,lat]=pxToLonLat(p.x,p.y);
    const c=Math.cos(lat*Math.PI/180);
    const areaKm2=npx*K*c*c;
    let dens=regionDensity(lon,lat)*(POP_TERR_FERT[p.terrain]||1);
    if(p.coastal)dens*=1.15;                 // la gente se concentra en la costa
    // suelo de densidad dependiente del terreno: el desierto/tundra reales quedan CASI vacíos (el
    // Sáhara/Arabia no tienen un mínimo de 0,2 hab/km²; la gente se apretuja en la vega, que es otro
    // terreno). Evita que provincias de desierto enormes sumen miles por el suelo uniforme.
    const floor=(p.terrain==="desierto"||p.terrain==="tundra")?0.03:0.2;
    dens=Math.max(floor,Math.min(58,dens));
    const rural=Math.min(RURAL_CAP,areaKm2*dens*POP_GAIN); // rural, con tope por comarca
    let pop=p.urban?rural*0.5:rural;                        // la ciudad edifica parte del campo
    // núcleo urbano (solo ciudades reales, no los duplicados rurales del gazetteer):
    // tabla histórica para las grandes; el resto de urbes se modelan por región.
    if(p.urban){
      // NÚCLEO urbano: `p.cityPop` (cities1444, reconciliado a mano en la Tanda B) es la FUENTE ÚNICA.
      // La antigua tabla CITY_POP ya NO decide el pop (fuente en conflicto: mostraba 250k y sumaba 40k);
      // solo queda como heurística de nombrado (mapgen.js:373). Sin cityPop (capital sin dato) → modelo.
      const hist=p.cityPop>0?p.cityPop:null;
      if(hist!=null)pop+=hist;
      else{
        const jit=0.7+0.6*hashN(p.x,p.y);       // determinista por posición
        const rd=regionDensity(lon,lat);
        let core=rd*(p.capital?900:340)*jit;
        core=Math.max(p.capital?6000:2000,Math.min(p.capital?34000:20000,core));
        pop+=core;
      }
    }
    p.pop=Math.max(0,Math.round(pop));
  }
  for(const p of S.provs)seedStrata(p); // Fase A: reparte la población en estratos
}
// Reparte p.pop en estratos (p.pops) según ciudad/campo e inicializa la riqueza por estrato
// (p.wealth) si aún no existe. Determinista; los estratos se recalibran proporcionalmente en el
// tick demográfico. La riqueza NO se resiembra (la acumulará el mercado en la Fase B).
function seedStrata(p){
  const pop=p.pop||0, f=(p.urban?STRATA_SEED.urban:STRATA_SEED.rural);
  p.pops={}; for(const k of STRATA)p.pops[k]=pop*(f[k]||0);
  if(!p.wealth){p.wealth={}; for(const k of STRATA)p.wealth[k]=0}
}
function rebuildProvinceData(){
  S.mktDirty=true;      // el mundo cambia (carga, editor, generación): la topología del mercado caduca
  S.adj=S.provs.map(()=>new Set());
  S.seaAdj=S.provs.map(()=>new Set());
  S.navAdj=S.provs.map(()=>new Set());
  S.pixOfProv=S.provs.map(()=>[]);
  S.borderPxOfProv=S.provs.map(()=>[]);
  for(const p of S.provs)p.coastal=false;
  // `S.adj` = VECINO DEL MISMO MEDIO: tierra con tierra, mar con mar, nunca cruzando.
  // Antes el océano no era provincia (provIdx=-1) y esto daba igual: cualquier vecino con id>=0 era
  // tierra por fuerza. Ahora el mar son 344 provincias, y si entraran en S.adj envenenarían todo lo
  // que trata una arista como "se puede andar por ahí": landPath (los ejércitos irían ANDANDO a
  // Chipre), generateRoads (caminos cruzando el Mediterráneo), buildDuchies y assignMarkets.
  // Separándolos, la tierra funciona exactamente igual que antes Y el grafo del mar sale gratis, que
  // es justo lo que hará falta para mover tropas por mar y para las rutas de comercio.
  // El cruce entre medios no se pierde: es `coastal`, y de ahí cuelga `S.seaAdj` (abajo).
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const i=y*MW+x,p=S.provIdx[i];
    if(p<0)continue;
    S.pixOfProv[p].push(i);
    const r=x<MW-1?S.provIdx[i+1]:-2, d=y<MH-1?S.provIdx[i+MW]:-2;
    const l=x>0?S.provIdx[i-1]:-2, u=y>0?S.provIdx[i-MW]:-2;
    if(r!==p||d!==p||l!==p||u!==p)S.borderPxOfProv[p].push(i);
    const mio=isSea(S.provs[p]);
    // COSTERA = toca una provincia de MAR. Antes era "toca la nada", y con el mar teselado esa
    // pregunta la contestarían que NO todas: se caía el bonus costero de población, la pesca, los
    // puertos, la vega del Magreb y, peor, la regla del páramo (`!p.coastal`) habría convertido en
    // páramo medio Sáhara y la costa subártica. Nada de eso da error: el mapa cambia en silencio.
    // Los agujeros (-1: Caspio, Mar Blanco, lagos) NO hacen costera a nadie: no son navegables.
    // CRUCE ENTRE MEDIOS (fase 1): la costera se une en `S.seaAdj` a CADA tesela de mar que toca su
    // playa (y viceversa). Es la arista embarque/desembarque del grafo unificado: `S.adj` mueve
    // dentro de un medio (tierra↔tierra, mar↔mar) y `S.seaAdj` cruza de tierra a mar. Antes esto era
    // un enlace costera↔costera por recta; ahora el enrutado naval camina de verdad por los nodos.
    for(const q of (mio?[]:[r,d,l,u])){
      if(q>=0&&isSea(S.provs[q])){S.provs[p].coastal=true;S.seaAdj[p].add(q);S.seaAdj[q].add(p)}
    }
    if(r>=0&&r!==p&&isSea(S.provs[r])===mio){S.adj[p].add(r);S.adj[r].add(p)}
    if(d>=0&&d!==p&&isSea(S.provs[d])===mio){S.adj[p].add(d);S.adj[d].add(p)}
  }
  // centro visual de cada provincia = POLO DE INACCESIBILIDAD (el píxel interior más alejado de
  // cualquier borde). La semilla del Voronoi suele quedar descentrada o pegada a un borde; este
  // punto, en cambio, siempre cae bien dentro (incluso en formas cóncavas o multilóbulo, elige el
  // centro del lóbulo mayor). Se calcula por transformada de distancia (BFS desde el borde) dentro
  // del recuadro de la provincia. Aquí se fija p.x/p.y para marcadores, ejércitos y caminos.
  for(const p of S.provs){
    const px=S.pixOfProv[p.id];
    if(!px.length)continue;
    let minx=MW,miny=MH,maxx=0,maxy=0;
    for(const i of px){const x=i%MW,y=(i/MW)|0;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y}
    const bw=maxx-minx+1,bh=maxy-miny+1;
    const inside=new Uint8Array(bw*bh);
    for(const i of px)inside[((((i/MW)|0)-miny)*bw)+(i%MW-minx)]=1;
    const dist=new Int32Array(bw*bh).fill(-1);
    const q=new Int32Array(px.length);let qn=0;
    for(const i of px){                              // sembrar BFS en los píxeles de borde (dist 0)
      const gx=i%MW-minx,gy=((i/MW)|0)-miny,c=gy*bw+gx;
      if(gx===0||gy===0||gx===bw-1||gy===bh-1||
         !inside[c-1]||!inside[c+1]||!inside[c-bw]||!inside[c+bw]){dist[c]=0;q[qn++]=c}
    }
    let head=0,best=q.length?q[0]:-1,bd=0;
    while(head<qn){
      const c=q[head++],cd=dist[c],cx=c%bw,cy=(c/bw)|0;
      if(cd>bd){bd=cd;best=c}
      if(cx>0){const j=c-1;if(inside[j]&&dist[j]<0){dist[j]=cd+1;q[qn++]=j}}
      if(cx<bw-1){const j=c+1;if(inside[j]&&dist[j]<0){dist[j]=cd+1;q[qn++]=j}}
      if(cy>0){const j=c-bw;if(inside[j]&&dist[j]<0){dist[j]=cd+1;q[qn++]=j}}
      if(cy<bh-1){const j=c+bw;if(inside[j]&&dist[j]<0){dist[j]=cd+1;q[qn++]=j}}
    }
    if(best>=0){p.x=minx+(best%bw);p.y=miny+((best/bw)|0)}
  }
  // PROFUNDIDAD DEL MAR: a cuántas teselas de la costa está cada una (BFS por el grafo del mar).
  // Idea de Sergio: las teselas que tocan tierra, más claritas; las de mar abierto, más oscuras ->
  // se distingue de un vistazo el agua somera de la profunda. Se calcula aquí (y no al pintar)
  // porque es topología del mapa: sale gratis del grafo que acabamos de construir y no cambia nunca.
  {
    const q=[];
    for(const p of S.provs){
      if(!isSea(p)){p.depth=-1;continue}
      p.depth=Infinity;
      // toca tierra = alguna vecina del grafo... no: S.adj no cruza medios. Se mira el ráster.
      for(const i of S.borderPxOfProv[p.id]){
        const x=i%MW,y=(i/MW)|0;
        const v=[x<MW-1?S.provIdx[i+1]:-1, x>0?S.provIdx[i-1]:-1, y<MH-1?S.provIdx[i+MW]:-1, y>0?S.provIdx[i-MW]:-1];
        if(v.some(k=>k>=0&&!isSea(S.provs[k]))){p.depth=0;q.push(p.id);break}
      }
    }
    for(let h=0;h<q.length;h++){
      const d=S.provs[q[h]].depth;
      for(const b of S.adj[q[h]])if(S.provs[b].depth===Infinity){S.provs[b].depth=d+1;q.push(b)}
    }
    for(const p of S.provs)if(isSea(p)&&!isFinite(p.depth))p.depth=0;   // mares cerrados (Mármara)
  }
  // NAVADJ — "vecino por mar" costera↔costera, ACOTADO (fase 1). Es lo que preguntan los heurísticos
  // de IA ("¿a qué costas llego de un salto de mar corto?": elegir enemigo, ducado a exigir, objetivo
  // militar) y el grafo ralo de plazas del mercado. Antes esto era `S.seaAdj` calculado por RECTA
  // (< 220 px); ahora `S.seaAdj` es el cruce a las teselas y navAdj se DERIVA del grafo de nodos:
  // BFS en km por las teselas de mar desde las que tocan la playa de cada costera, hasta NAV_KM. Así
  // una costa se une a la de enfrente del estrecho (Sicilia↔Túnez, Dover↔Calais) rodeando de verdad,
  // pero no al otro extremo del mar. (El enrutado LARGO —Valencia→Venecia, mercado por mar— no usa
  // esto: va por Dijkstra sobre el grafo unificado, sin tope.)
  {
    const coast=S.provs.filter(p=>p.coastal&&!isSea(p)&&!p.wasteland);
    for(const p of coast){
      const km=new Map(),h=[];               // tesela de mar -> km desde p; frontera [km,tesela]
      for(const t of S.seaAdj[p.id]){if(!km.has(t)){km.set(t,0);h.push([0,t])}}  // sembrar en su playa
      const reached=new Set();
      while(h.length){
        let bi=0;for(let k=1;k<h.length;k++)if(h[k][0]<h[bi][0])bi=k;   // frontera pequeña: scan lineal
        const[d,t]=h.splice(bi,1)[0];
        if(d>km.get(t))continue;
        for(const c of S.seaAdj[t])if(c!==p.id&&!isSea(S.provs[c])&&!S.provs[c].wasteland)reached.add(c);
        for(const nb of S.adj[t]){             // S.adj de una tesela = sólo teselas de mar (mismo medio)
          const nd=d+kmBetween(S.provs[t],S.provs[nb]);
          if(nd<=NAV_KM&&nd<(km.has(nb)?km.get(nb):Infinity)){km.set(nb,nd);h.push([nd,nb])}
        }
      }
      for(const c of reached){S.navAdj[p.id].add(c);S.navAdj[c].add(p.id)}
    }
  }
}
// ============================= Ducados =============================
// Subdivisión interna de cada reino en ducados (grupos de 3-4 provincias contiguas), la
// unidad de conquista del juego. Es DETERMINISTA: depende solo de owner0 (dueño de iure) y
// de la adyacencia terrestre, ambos estables, así que se reconstruye idéntica en cada carga
// sin necesidad de persistirla. Los `home`=owner0 (NEUTRAL para independientes); la capital
// del ducado es la capital nacional si cae dentro, si no la provincia más urbana/poblada.
function buildDuchies(){
  const TARGET=4,MAXMERGE=5; // 3-4 por ducado; al fusionar fragmentos no pasar de 5
  for(const p of S.provs){p.duchy=-1;if(p.occupier==null)p.occupier=-1}
  // LOS DUCADOS IMPORTADOS MANDAN. Si el mapa los trae (duchy0), son los 974 HISTÓRICOS de EU4
  // —Lappland, Abruzzi, Kola—, que además son el molde del que salieron nuestras provincias: un
  // ducado ES una provincia de EU4. Inventárselos aquí era tirar el 90% del trabajo del pipeline.
  // Se puede hacer porque el dueño ahora se asigna POR DUCADO: todas sus provincias comparten
  // owner0 por construcción, así que ningún ducado queda a caballo de una frontera (que era la
  // objeción real: un ducado partido rompe el warscore, los asedios y las reclamaciones).
  // Los mapas viejos no traen duchy0 y caen al camino de siempre, intacto.
  if(S.provs.some(p=>p.duchy0>=0)){
    const byD=new Map();
    for(const p of S.provs){
      if(p.wasteland||isSea(p)||!(p.duchy0>=0))continue;   // páramo y mar nunca forman ducado
      if(!byD.has(p.duchy0))byD.set(p.duchy0,[]);
      byD.get(p.duchy0).push(p.id);
    }
    S.duchies=[];
    for(const d of [...byD.keys()].sort((a,b)=>a-b)){
      const m=byD.get(d);
      const id=S.duchies.length;
      for(const pid of m)S.provs[pid].duchy=id;
      let cap=m.find(pid=>S.provs[pid].capital);
      if(cap==null)cap=m.reduce((best,pid)=>{
        const P=S.provs[pid],B=S.provs[best];
        return (P.urban?1e9:0)+(P.pop||0)>(B.urban?1e9:0)+(B.pop||0)?pid:best;
      },m[0]);
      const nom=(S.duchyNames&&S.duchyNames[d])||S.provs[cap].name;
      S.duchies.push({id,home:S.provs[m[0]].owner0,provs:m.slice(),cap,occBy:-1,name:"Ducado de "+nom});
    }
    return;
  }
  // provincias agrupadas por dueño de iure (owner0); el páramo y el MAR quedan fuera
  // (sin el filtro del mar, las 344 teselas comparten owner0=NEUTRAL y se agruparían en "ducados"
  // de océano: asediables, reclamables por la diplomacia y con warscore. No.)
  const byHome=new Map();
  for(const p of S.provs){
    if(p.wasteland||isSea(p))continue;
    if(!byHome.has(p.owner0))byHome.set(p.owner0,[]);
    byHome.get(p.owner0).push(p.id);
  }
  // 1. cúmulos tentativos: cada provincia recibe un id de grupo (group[])
  const group=new Int32Array(S.provs.length).fill(-1);
  const members=[]; // gid -> [pids]
  for(const[home,provs]of byHome){
    const unassigned=new Set(provs);
    // orden de siembra determinista: capital nacional, luego ciudades, luego por id
    const seeds=[...provs].sort((a,b)=>{
      const A=S.provs[a],B=S.provs[b];
      const sa=(A.capital?2:0)+(A.urban?1:0),sb=(B.capital?2:0)+(B.urban?1:0);
      return sa!==sb?sb-sa:a-b;
    });
    for(const seed of seeds){
      if(!unassigned.has(seed))continue;
      const cluster=[seed];unassigned.delete(seed);
      // crecer al vecino contiguo del mismo dueño más "compacto" (más lazos con el cúmulo)
      while(cluster.length<TARGET){
        let cand=-1,cb=-1;
        for(const a of unassigned){
          let ties=0;for(const c of cluster)if(S.adj[c].has(a))ties++;
          if(ties>cb){cb=ties;cand=a}
        }
        if(cand<0||cb<=0)break; // no hay más provincias contiguas del mismo reino
        cluster.push(cand);unassigned.delete(cand);
      }
      const gid=members.length;
      for(const pid of cluster)group[pid]=gid;
      members.push(cluster);
    }
  }
  // 2. fusionar fragmentos pequeños (stragglers de la codicia) en un ducado vecino del mismo reino,
  //    empezando por los más pequeños; nunca por encima de MAXMERGE. Las islas sin vecino terrestre
  //    del mismo dueño se quedan solas. Determinista (orden por tamaño y luego por id).
  const order=members.map((m,g)=>g).sort((a,b)=>members[a].length-members[b].length||a-b);
  for(const g of order){
    const m=members[g];
    if(!m.length||m.length>2)continue; // solo fragmentos de 1-2 provincias
    const home=S.provs[m[0]].owner0;
    // grupos vecinos del mismo reino (por tierra), con su tamaño
    const adjG=new Map();
    for(const pid of m)for(const a of S.adj[pid]){
      const ag=group[a];
      if(ag<0||ag===g||S.provs[a].owner0!==home)continue;
      adjG.set(ag,members[ag].length);
    }
    let best=-1,bs=1e9;
    for(const[ag,sz]of adjG){if(sz+m.length<=MAXMERGE&&(sz<bs||(sz===bs&&ag<best))){bs=sz;best=ag}}
    if(best<0)continue;
    for(const pid of m){group[pid]=best;members[best].push(pid)}
    members[g]=[]; // vaciado
  }
  // 3. ducados finales (ids compactados) con capital y nombre
  S.duchies=[];
  const remap=new Map();
  for(let g=0;g<members.length;g++){
    const m=members[g];if(!m.length)continue;
    const id=S.duchies.length;remap.set(g,id);
    for(const pid of m)S.provs[pid].duchy=id;
    // capital del ducado: la capital nacional si está dentro; si no, la más urbana/poblada
    let cap=m.find(pid=>S.provs[pid].capital);
    if(cap==null)cap=m.reduce((best,pid)=>{
      const P=S.provs[pid],B=S.provs[best];
      return (P.urban?1e9:0)+(P.pop||0)>(B.urban?1e9:0)+(B.pop||0)?pid:best;
    },m[0]);
    S.duchies.push({id,home:S.provs[m[0]].owner0,provs:m.slice(),cap,occBy:-1,name:"Ducado de "+S.provs[cap].name});
  }
}
// ¿es `pid` la capital de su ducado?
function isDuchyCap(pid){const p=S.provs[pid];return p.duchy>=0&&S.duchies[p.duchy]&&S.duchies[p.duchy].cap===pid}
function roadKey(a,b){return a<b?a+"|"+b:b+"|"+a}
function hasRoad(a,b){return S.roads.has(roadKey(a,b))}
function roadLvl(a,b){return S.roads.get(roadKey(a,b))||0} // 0 = sin camino; 1..3 = nivel
function landPath(from,to,allow){
  if(from===to)return[from];
  const prev=new Map([[from,-1]]);
  const q=[from];
  while(q.length){
    const c=q.shift();
    for(const a of S.adj[c]){
      if(prev.has(a)||(a!==to&&!allow(a)))continue;
      prev.set(a,c);
      if(a===to){
        const path=[a];let cur=c;
        while(cur!==-1){path.unshift(cur);cur=prev.get(cur)}
        return path;
      }
      q.push(a);
    }
  }
  return null;
}
function generateRoads(){
  S.roads=new Map();S.roadQueue=[]; // clave -> nivel (1..3); los generados nacen a nivel 1
  for(let n=0;n<NPLAY;n++){
    const cap=S.nations[n].capital;
    if(cap<0)continue;
    for(const p of S.provs){
      if(p.owner!==n||!p.urban||p.id===cap)continue;
      const path=landPath(cap,p.id,x=>S.provs[x].owner===n&&!S.provs[x].wasteland);
      if(path)for(let i=0;i<path.length-1;i++)S.roads.set(roadKey(path[i],path[i+1]),1);
    }
  }
  // arteria hacia la capital extranjera más cercana
  for(let n=0;n<NPLAY;n++){
    const capN=S.nations[n].capital;
    if(capN<0)continue;
    let best=-1,bd=1e18;
    for(let m=0;m<NPLAY;m++){
      if(m===n||S.nations[m].capital<0)continue;
      const d=kmBetween(S.provs[capN],S.provs[S.nations[m].capital]);
      if(d<bd){bd=d;best=m}
    }
    if(best<0||n>best)continue; // cada pareja una sola vez
    const path=landPath(capN,S.nations[best].capital,x=>!S.provs[x].wasteland);
    if(path&&path.length<=14)for(let i=0;i<path.length-1;i++)S.roads.set(roadKey(path[i],path[i+1]),1);
  }
}
// ===================== Topología del mercado provincial =====================
// Grafo RALO entre PLAZAS (las provincias `urban`), la osamenta que el mercado provincial
// (ADR 0001) usará para el arbitraje corto. Nadie lo consume todavía: construirlo no cambia
// el comportamiento. Dos plazas se enlazan si son vecinas por tierra o por mar, o si son del
// mismo dueño y distan menos de MKT_LINK_KM (las plazas rara vez se tocan: el 93% del mapa
// son aldeas, así que sin el radio el grafo saldría casi vacío).
// Depende del dueño → hay que rehacerlo cuando cambian las fronteras.
// El radio se fijó MIDIENDO (tools/market-topology.mjs), no a ojo: con 150 km el grafo sale roto
// (40 plazas aisladas, 36 de 59 reinos con el mercado en dos o más islas que jamás comerciarían);
// con 250 quedan 6 aisladas y 15 reinos partidos, y sigue siendo la mitad de caro que el arbitraje
// nacional de hoy. 250 km ≈ 8-10 días de carreta: el circuito regional de un mercader.
// El radio solo crea la ARISTA; que el trato salga a cuenta ya lo decide el flete (tradeCost).
const MKT_LINK_KM=250;
function buildMarketEdges(){
  const g=new Map(); S.marketEdges=g;
  // toda capital es nodo de mercado aunque no sea `urban` (medido: Nikšić y Aqaba lo son; sin esto
  // Ragusa se quedaba sin ninguna plaza y sus aldeas no tendrían dónde ir en la Fase 1).
  const plazas=S.provs.filter(p=>(p.urban||p.capital)&&!p.wasteland);
  for(const p of plazas)g.set(p.id,new Set());
  const link=(a,b)=>{g.get(a).add(b);g.get(b).add(a)};
  for(const p of plazas){
    for(const q of S.adj[p.id])if(g.has(q))link(p.id,q);        // vecina por tierra
    for(const q of S.navAdj[p.id])if(g.has(q))link(p.id,q);     // plaza a un salto de mar corto (navAdj, no las teselas)
  }
  const byOwner=new Map();
  for(const p of plazas){if(!byOwner.has(p.owner))byOwner.set(p.owner,[]);byOwner.get(p.owner).push(p)}
  for(const list of byOwner.values())
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)
      if(kmBetween(list[i],list[j])<MKT_LINK_KM)link(list[i].id,list[j].id);
  for(const[k,v]of g)g.set(k,[...v].sort((a,b)=>a-b));
  return g;
}
// ===================== Las ciudades, donde las hubo =====================
// Una provincia es CIUDAD porque allí había una ciudad en 1444 — no por sorteo. Hasta ahora la
// mitad de las plazas salían de `S.rand()<0.06`: 209 provincias urbanas al azar (algunas ni eran
// ciudades: "Gales del Sur", "Frisia", "Holstein" son REGIONES). Ahora mandan los datos.
//
// DOS FUENTES, y las dos hacen falta:
//  1. cities1444.js — 319 ciudades ≥5.000 hab con lat/lon y población (Buringh 2021 + Bosker 2013
//     + Chandler 1987). Es el dato duro, pero sus autores estudiaban la urbanización EUROPEA:
//     medido, deja Rusia con 5 ciudades para 1.033 provincias y Escandinavia con 5 para 440 —
//     332 km de mediana al mercado en la estepa. Eso no es historia, es el agujero de la fuente.
//  2. MAPDATA.cities — las 217 ciudades curadas a mano, que SÍ cubren todo el mapa. Actúan de
//     SUELO: tapan los 96 huecos que el dataset no ve. Sin ellas, media Rusia se queda sin mercado.
// Resultado medido: 378 plazas (antes 423, la mitad al azar). Europa 81 km de mediana al mercado
// (antes 76: casi igual, el dataset confirma lo que ya había); Rusia 192 y Escandinavia 148 (antes
// 84 y 91) — peor acceso al mercado, que es la verdad de 1444 y el hueco que la fundación de
// ciudades del rey vendrá a llenar.
// Regenerar cities1444.js: node tools/gen-cities.mjs
function seedCities(){
  if(typeof CITIES1444==="undefined")return;   // sin el fichero de datos, se respeta lo que haya
  for(const p of S.provs)if(!p.wasteland){p.urban=false;p.cityPop=0;p.cityName=null}
  // marca SOLO el núcleo (cityPop/cityName). El flag `urban` se decide DESPUÉS por umbral, no aquí:
  // así una coordenada de ciudad no hace urbana a su provincia por el mero hecho de existir.
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const landAt=q=>q>=0&&!isSea(S.provs[q])&&!S.provs[q].wasteland;
  const setCore=(x,y,pop,name)=>{
    let pid=S.provIdx[y*MW+x];
    // Si la coordenada cae en MAR/HUECO/YERMO, la ciudad se PERDÍA en silencio (bug: Nóvgorod 40k caía
    // en el lago Ilmen; Málaga/Catania mar adentro → 5 ciudades sin sembrar, ~71k pop fantasma). La
    // rescatamos saltando a la tierra más cercana (≤SNAP px), PREFIRIENDO una provincia HOMÓNIMA si la
    // hay (así Nóvgorod cae en la provincia "Nóvgorod", no en la vecina Pankovka a la misma distancia);
    // sin homónima, la tierra más cercana (Málaga→Vélez-Málaga costera). Más allá de SNAP se descarta.
    if(!landAt(pid)){
      const SNAP=4,nc=norm(name);let bm=-1,bmD=1e9,ba=-1,baD=1e9;
      for(let dy=-SNAP;dy<=SNAP;dy++){const yy=y+dy;if(yy<0||yy>=MH)continue;
        for(let dx=-SNAP;dx<=SNAP;dx++){const xx=x+dx;if(xx<0||xx>=MW)continue;
          const q=S.provIdx[yy*MW+xx];if(!landAt(q))continue;
          const d=dx*dx+dy*dy;
          if(d<baD){baD=d;ba=q}
          if(name&&norm(S.provs[q].name)===nc&&d<bmD){bmD=d;bm=q}
        }}
      pid=bm>=0?bm:ba;
      if(pid<0)return;                       // ni tierra cerca (isla minúscula): se descarta como antes
    }
    const p=S.provs[pid];
    // varias ciudades reales caen en la MISMA provincia (son grandes, ~85 km): manda la MÁS POBLADA
    if(pop>(p.cityPop||0)){p.cityPop=pop;p.cityName=name}
  };
  for(const[name,x,y,pop] of CITIES1444)setCore(x,y,pop,name);
  for(const[name,cx,cy] of MAPDATA.cities)setCore(cx,cy,0,null); // suelo curado: solo aporta ancla, pop 0
  // URBANA ⇔ núcleo histórico ≥ CITY_MIN (umbral "ciudad" de 1450, Bairoch/Buringh) O capital nacional
  // (sede = ciudad por función, aunque no llegue). Por debajo, la provincia es RURAL (conserva su nombre).
  for(const p of S.provs){
    if(p.wasteland)continue;
    p.urban=(p.cityPop>=CITY_MIN)||!!p.capital;
  }
}
// Cada provincia pertenece a UNA plaza: `p.marketOf` (la plaza es satélite de sí misma). Es la
// pertenencia de la aldea a su mercado — dónde irá a vender su grano en la Fase 2. Aquí NO se
// mueve un ducado: solo se asigna.
// DIJKSTRA MULTIFUENTE en KILÓMETROS desde todas las plazas a la vez, sobre la adyacencia real
// (tierra + mar). Deja en `p.marketKm` los km de camino hasta su plaza — que es justo lo que la
// Fase 2 necesita para cobrarle el flete a la aldea.
// (El plan decía "BFS sobre S.marketEdges". Dos correcciones, ambas medidas: (1) ese grafo solo une
// plazas entre sí, las aldeas no están en él — la pertenencia va sobre S.adj/S.seaAdj y marketEdges
// es para el arbitraje; (2) un BFS cuenta SALTOS, y un salto por mar son 500 km: contando saltos,
// Alanya vendía en Port Said a 624 km y Alghero en Perpiñán a 537, porque llegaban en menos saltos
// que a su plaza de tierra. Contando kilómetros, cada una va a la suya.)
// LA FRONTERA NO CONFINA: la aldea va a la plaza más cercana AUNQUE SEA EXTRANJERA. En 1444 se
// pagaba PEAJE, no pasaporte — la frontera fiscalizaba el comercio, no lo redirigía (Aragón Ruano
// sobre Álava/Navarra: los alaveses seguían sacando el vino de Navarra; "lo que sí varió, sin duda,
// fue la fiscalización de ese comercio"). Quien frena la arista extranjera es la aduana (almojOf)
// y la guerra/embargo (TRADE_WAR, isEmbargoed) cuando llegue el FLUJO, no la topología: por eso
// esto no se rehace al declarar una guerra. Confinar por dueño mandaba a Temryuk a vender su grano
// a Génova, a 2.245 km — y Balard documenta lo contrario: Caffa se abastecía de su hinterland
// tártaro, no de Liguria.
// Empate a saltos → gana la plaza más cercana en km. La aldea que no alcanza ninguna plaza (isla
// sin puerto) cae en la capital de su reino.
function assignMarkets(){
  const km=new Float64Array(S.provs.length).fill(Infinity);
  for(const p of S.provs){p.marketOf=-1;p.marketKm=0}
  const h=[];                                             // montículo binario de [km, provincia]
  const push=(d,i)=>{
    h.push([d,i]);
    for(let c=h.length-1;c>0;){const par=(c-1)>>1;if(h[par][0]<=h[c][0])break;[h[par],h[c]]=[h[c],h[par]];c=par}
  };
  const pop=()=>{
    const top=h[0],last=h.pop();
    if(h.length){h[0]=last;
      for(let c=0;;){const l=2*c+1,r=l+1;let m=c;
        if(l<h.length&&h[l][0]<h[m][0])m=l;
        if(r<h.length&&h[r][0]<h[m][0])m=r;
        if(m===c)break;[h[m],h[c]]=[h[c],h[m]];c=m}
    }
    return top;
  };
  const plazas=S.provs.filter(p=>(p.urban||p.capital)&&!p.wasteland&&p.owner<NPLAY);
  plazas.sort((a,b)=>a.id-b.id);                          // orden fijo de las fuentes = determinista
  for(const p of plazas){p.marketOf=p.id;km[p.id]=0;push(0,p.id)}
  while(h.length){
    const[d,c]=pop();
    if(d>km[c])continue;                                  // entrada rancia
    const P=S.provs[c];
    // El grafo es UNIFICADO: S.adj mueve dentro de un medio, S.seaAdj cruza a las teselas de mar. Una
    // tesela de mar es TRÁNSITO (no plaza, no pop): reparte la fuente `marketOf` que le llega pero
    // ninguna aldea "pertenece" a ella. El km por mar va con DESCUENTO (SEA_KM_MULT: el barco es más
    // rápido) → una aldea compara su plaza terrestre con una de ultramar y va a la MÁS BARATA.
    for(const nb of [...S.adj[c],...S.seaAdj[c]]){
      const Q=S.provs[nb];
      if(Q.wasteland)continue;
      const w=(isSea(P)||isSea(Q))?SEA_KM_MULT:1;            // arista que toca el mar = cabotaje
      const nd=d+kmBetween(P,Q)*w;
      if(nd<km[nb]-1e-9){km[nb]=nd;Q.marketOf=P.marketOf;Q.marketKm=nd;push(nd,nb)}
      else if(Math.abs(nd-km[nb])<1e-9&&P.marketOf<Q.marketOf)Q.marketOf=P.marketOf; // empate exacto: id menor
    }
  }
  for(const p of S.provs){                                // isla sin puerto → la capital de su reino
    if(p.marketOf>=0||p.wasteland||p.owner>=NPLAY)continue;
    const N=S.nations[p.owner];
    if(N&&N.capital>=0){p.marketOf=N.capital;p.marketKm=kmBetween(p,S.provs[N.capital])}
  }
}
// ============ CAPA 2: CENTROS DE COMERCIO (hubOf/hubKm) — design/mercado-centros-eu5.md ============
// 2ª pasada del MISMO Dijkstra multifuente, con OTRO set de semillas (los pocos CENTROS, no las ~400
// plazas) y con la OROGRAFÍA en la tinta. NO toca marketOf: la Capa 1 (grano local, radio corto) y la
// Capa 2 (arbitraje de largo alcance entre centros) conviven. Sigue siendo TOPOLOGÍA — nadie lee
// hubOf/hubKm para mover dinero todavía (eso es la Fase 2 del flujo).
// SEMILLA = centro ⇔ cityPop≥CENTER_POP  O  está en CURATED_HUBS. La CAPITAL NO cuenta por serlo (a
// diferencia de las plazas de assignMarkets, que sí incluyen p.capital): un centro se gana por tamaño
// o por función comercial, no por ser sede política (dictamen 2026-07-19).
// OROGRAFÍA: el coste de cada arista es km × dificultad de terreno, reusando TERRAINS[t].mov (una sola
// verdad, DRY). mov es VELOCIDAD (mayor=más fácil), así que el coste va con 1/mov (media de las dos
// teselas): montaña (mov .6) cuesta ×1.67, meseta (.87) ×1.15, llanura (1.0) ×1, estepa (1.15) ×0.87.
// El mar conserva su descuento de cabotaje (SEA_KM_MULT), sin penalización de terreno. Cambia la FORMA
// del territorio de cada centro (los pasos de montaña lo estrangulan; los llanos y el mar lo estiran),
// no el número de centros.
function hubSeeds(){
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const curated=new Set(CURATED_HUBS.map(norm));
  const seeds=[];
  for(const p of S.provs){
    if(p.wasteland||isSea(p)||p.owner>=NPLAY)continue;
    if((p.cityPop||0)>=CENTER_POP||curated.has(norm(p.cityName))||curated.has(norm(p.name)))seeds.push(p);
  }
  return seeds;
}
function assignHubs(){
  const km=new Float64Array(S.provs.length).fill(Infinity);
  for(const p of S.provs){p.hubOf=-1;p.hubKm=0}
  const h=[];
  const push=(d,i)=>{h.push([d,i]);for(let c=h.length-1;c>0;){const par=(c-1)>>1;if(h[par][0]<=h[c][0])break;[h[par],h[c]]=[h[c],h[par]];c=par}};
  const pop=()=>{const top=h[0],last=h.pop();if(h.length){h[0]=last;for(let c=0;;){const l=2*c+1,r=l+1;let m=c;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===c)break;[h[m],h[c]]=[h[c],h[m]];c=m}}return top};
  const seeds=hubSeeds();
  seeds.sort((a,b)=>a.id-b.id);                            // orden fijo = determinista
  for(const p of seeds){p.hubOf=p.id;km[p.id]=0;push(0,p.id)}
  while(h.length){
    const[d,c]=pop();
    if(d>km[c])continue;
    const P=S.provs[c];
    for(const nb of [...S.adj[c],...S.seaAdj[c]]){
      const Q=S.provs[nb];
      if(Q.wasteland)continue;
      const w=(isSea(P)||isSea(Q))?SEA_KM_MULT                         // mar: cabotaje, sin orografía
        :2/((TERRAINS[P.terrain]?.mov||1)+(TERRAINS[Q.terrain]?.mov||1)); // tierra: km × dificultad (1/mov)
      const nd=d+kmBetween(P,Q)*w;
      if(nd<km[nb]-1e-9){km[nb]=nd;Q.hubOf=P.hubOf;Q.hubKm=nd;push(nd,nb)}
      else if(Math.abs(nd-km[nb])<1e-9&&P.hubOf<Q.hubOf)Q.hubOf=P.hubOf; // empate exacto: id menor
    }
  }
  for(const p of S.provs){  // sin centro alcanzable (isla) → el del centro de su capital, si lo tiene; si no, -1 (autarquía)
    if(p.hubOf>=0||p.wasteland||p.owner>=NPLAY)continue;
    const N=S.nations[p.owner];
    if(N&&N.capital>=0&&S.provs[N.capital].hubOf>=0){p.hubOf=S.provs[N.capital].hubOf;p.hubKm=kmBetween(p,S.provs[N.capital])}
  }
}
// Rehace la topología del mercado (grafo + pertenencia + centros). Solo cuesta cuando cambian las
// fronteras: `transferDuchy` es el ÚNICO sitio donde cambia p.owner en partida, y marca S.mktDirty.
function ensureMarketTopology(){
  if(S.marketEdges&&!S.mktDirty)return;
  buildMarketEdges();assignMarkets();assignHubs();S.mktDirty=false;
}
function kmBetween(a,b){
  const[lo1,la1]=pxToLonLat(a.x,a.y),[lo2,la2]=pxToLonLat(b.x,b.y);
  const R=6371,dla=(la2-la1)*Math.PI/180,dlo=(lo2-lo1)*Math.PI/180;
  const h=Math.sin(dla/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

// ================== SALPICADO (variante B de la orografía de EU4) ==================
// EU4 da UN terreno por provincia = por ducado, así que las ~6 provincias del ducado salen iguales
// (homogéneo). Esta función rompe esa homogeneidad de forma OPCIONAL y determinista: cachea la base
// congelada de EU4 (p.terrainEU4) y, con probabilidad SPRINKLE_P, cambia cada provincia a un terreno
// "de la misma familia" (montaña→colinas, meseta→colinas/estepa, llanura→bosque/colinas...). Nunca
// mete desierto donde no lo había (no resucita el Sáhara falso). Es un TOGGLE de comparación
// (window.setSprinkle): la base congelada sigue siendo EU4 puro; esto es un overlay que Sergio
// adopta o no. Si lo adopta, se hornea en la fase 5 (mapa estático).
const SPRINKLE_P = 0.35;
const SPRINKLE_POOL = {
  montana: ["colinas"], colinas: ["montana", "llanura"], meseta: ["colinas", "estepa"],
  estepa: ["meseta", "llanura"], llanura: ["bosque", "colinas"], bosque: ["llanura", "colinas"],
  vega: ["llanura"], pantano: ["llanura"], tundra: ["montana"], desierto: ["estepa"],
};
function sprinkleTerrain(on) {
  for (const p of S.provs) {
    if (isSea(p) || p.wasteland) continue;
    if (p.terrainEU4 === undefined) p.terrainEU4 = p.terrain;   // cachea la base de EU4 la 1ª vez
    if (!on || p.terrainEU4 == null) { p.terrain = p.terrainEU4; continue }
    const pool = SPRINKLE_POOL[p.terrainEU4];
    if (!pool) { p.terrain = p.terrainEU4; continue }
    const h = hashN(p.id, 7);                                    // determinista por provincia
    p.terrain = h < SPRINKLE_P ? pool[(h * 1e6 | 0) % pool.length] : p.terrainEU4;
  }
}

export {
  mulberry32, hashN, genName, SYL_A, SYL_M, SYL_B, decodeCountries, RLE_ALPHA, countryAt, generateMap, isolateWastePockets, MOUNTAIN_ZONES, MARSH_ZONES, FERTILE_ZONES, pxToLonLat, assignTerrain, assignResources, assignPopulation, seedStrata, rebuildProvinceData, buildDuchies, isDuchyCap, seedCities, renameProvincesHistorical, buildMarketEdges, assignMarkets, assignHubs, ensureMarketTopology, MKT_LINK_KM, kmBetween, roadKey, hasRoad, roadLvl, landPath, generateRoads, sprinkleTerrain, CITY_POP, popNormKey, localize
};
