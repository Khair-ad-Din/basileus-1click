// mapgen.js
import { MW, MH, NATIONS, NPLAY, NEUTRAL, TERRAINS, TERRAIN_KEYS, newBuildings } from "./config.js";
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
      morale:60,urban:S.rand()<0.06,resType:null,shade:0.85+S.rand()*0.3,capital:false,
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
// nombres reales de ciudad por cercanía: recorre el gazetteer PLACES (ordenado por
// población desc) y cada ciudad reclama la provincia SIN nombre más cercana dentro de un
// radio. Así cada provincia toma el topónimo real de su zona y las urbes importantes caen
// primero. Las que no tengan ciudad cerca (interiores despoblados) quedan con nombre por
// sílabas. Se ignora si el gazetteer no está cargado (mantiene el comportamiento antiguo).
function assignRealNames(){
  const used=new Set();
  for(const p of S.provs)if(p.named&&p.name)used.add(p.name);
  if(typeof PLACES!=="undefined"&&PLACES){
    const CS=32,bw=Math.ceil(MW/CS),bh=Math.ceil(MH/CS);
    const claimed=new Uint8Array(S.provs.length);
    // pasada 1 (por ciudad, población desc): cada urbe reclama la provincia sin nombre más
    // cercana en un radio corto → las ciudades importantes caen sobre "su" provincia
    const provCell=Array.from({length:bw*bh},()=>[]);
    for(const p of S.provs)if(!p.named)provCell[((p.y/CS)|0)*bw+((p.x/CS)|0)].push(p.id);
    const R=44,R2=R*R,rc=Math.ceil(R/CS);
    for(const pl of PLACES){
      const name=pl[0];if(used.has(name))continue;
      const x=pl[1],y=pl[2],bx=(x/CS)|0,by=(y/CS)|0;
      let best=-1,bd=R2;
      for(let cy=Math.max(0,by-rc);cy<=Math.min(bh-1,by+rc);cy++)
        for(let cx=Math.max(0,bx-rc);cx<=Math.min(bw-1,bx+rc);cx++)
          for(const pid of provCell[cy*bw+cx]){
            if(claimed[pid])continue;
            const p=S.provs[pid],dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
            if(d<bd){bd=d;best=pid}
          }
      if(best>=0){S.provs[best].name=name;S.provs[best].named=true;claimed[best]=1;used.add(name)}
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
            const pl=PLACES[pi];if(used.has(pl[0]))continue;
            const dx=pl[1]-p.x,dy=pl[2]-p.y,d=dx*dx+dy*dy;
            if(d<bd){bd=d;best=pi}
          }
      if(best>=0){p.name=PLACES[best][0];p.named=true;used.add(PLACES[best][0])}
    }
  }
  // relleno: provincias sin ninguna ciudad real cerca toman nombre por sílabas (no "named")
  for(const p of S.provs)if(!p.name)p.name=genName(used);
}
function isolateWastePockets(){
  const seen=new Set();
  const comps=[];
  for(const p of S.provs){
    if(p.wasteland||seen.has(p.id))continue;
    const st=[p.id];seen.add(p.id);
    const comp=[];
    while(st.length){
      const k=st.pop();comp.push(k);
      for(const b of S.adj[k])if(!S.provs[b].wasteland&&!seen.has(b)){seen.add(b);st.push(b)}
      for(const b of S.seaAdj[k])if(!S.provs[b].wasteland&&!seen.has(b)){seen.add(b);st.push(b)}
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
function assignResources(){
  for(const p of S.provs){
    if(p.urban){p.resType="dinero";continue}
    const t=p.terrain;
    // bien de lujo regional (~13% del campo), según terreno y costa
    if(S.rand()<0.13){
      const lux=["pano","vino","sal","raros","seda"];
      if(t==="vega"||t==="pradera"||t==="llanura")lux.push("vino","pano","pano");
      if(t==="colinas"||t==="montana")lux.push("vino","raros");
      if(t==="estepa"||t==="desierto")lux.push("raros","seda","sal");
      if(p.coastal)lux.push("sal","seda","raros");
      p.resType=lux[(S.rand()*lux.length)|0];
      continue;
    }
    // recurso estratégico según terreno
    let strat;
    if(t==="montana"||t==="colinas")strat=["piedra","piedra","metal","metal","petroleo"];
    else if(t==="bosque"||t==="pantano")strat=["materiales","materiales","materiales","comida"];
    else if(t==="tundra")strat=["materiales","comida","comida"]; // costa nórdica jugable: pieles/pesca
    else if(t==="estepa"||t==="pradera")strat=["petroleo","petroleo","comida","comida"];
    else if(t==="vega")strat=["comida","comida","comida","vino"];
    else if(t==="desierto")strat=["comida","petroleo","sal"];
    else strat=["comida","comida","materiales","metal"]; // llanura
    p.resType=strat[(S.rand()*strat.length)|0];
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
  pantano:0.55,estepa:0.5,montana:0.35,desierto:0.15,tundra:0.1};
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
// Rellena la población SOLO donde no hay valor (p.pop==null): siembra inicial en la
// generación y red de seguridad al cargar. Los valores ya guardados o editados a mano se
// respetan (el tope RURAL_CAP vive aquí, así que solo afecta a la siembra, nunca a tus ediciones).
function assignPopulation(){
  const K=pxAreaConst();
  for(const p of S.provs){
    if(p.wasteland){p.pop=0;continue}        // el páramo nunca tiene población
    if(p.pop!=null)continue;                 // valor guardado/editado: se respeta
    const npx=(S.pixOfProv[p.id]||[]).length;
    if(!npx){p.pop=0;continue}
    const[lon,lat]=pxToLonLat(p.x,p.y);
    const c=Math.cos(lat*Math.PI/180);
    const areaKm2=npx*K*c*c;
    let dens=regionDensity(lon,lat)*(POP_TERR_FERT[p.terrain]||1);
    if(p.coastal)dens*=1.15;                 // la gente se concentra en la costa
    dens=Math.max(0.2,Math.min(58,dens));
    const rural=Math.min(RURAL_CAP,areaKm2*dens*POP_GAIN); // rural, con tope por comarca
    let pop=p.urban?rural*0.5:rural;                        // la ciudad edifica parte del campo
    // núcleo urbano (solo ciudades reales, no los duplicados rurales del gazetteer):
    // tabla histórica para las grandes; el resto de urbes se modelan por región.
    if(p.urban){
      const tabled=CITY_POP[popNormKey(p.name)];
      if(tabled!=null)pop+=tabled;
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
}
function rebuildProvinceData(){
  S.adj=S.provs.map(()=>new Set());
  S.seaAdj=S.provs.map(()=>new Set());
  S.pixOfProv=S.provs.map(()=>[]);
  S.borderPxOfProv=S.provs.map(()=>[]);
  for(const p of S.provs)p.coastal=false;
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const i=y*MW+x,p=S.provIdx[i];
    if(p<0)continue;
    S.pixOfProv[p].push(i);
    const r=x<MW-1?S.provIdx[i+1]:-2, d=y<MH-1?S.provIdx[i+MW]:-2;
    const l=x>0?S.provIdx[i-1]:-2, u=y>0?S.provIdx[i-MW]:-2;
    if(r!==p||d!==p||l!==p||u!==p)S.borderPxOfProv[p].push(i);
    if(r===-1||d===-1||l===-1||u===-1)S.provs[p].coastal=true;
    if(r>=0&&r!==p){S.adj[p].add(r);S.adj[r].add(p)}
    if(d>=0&&d!==p){S.adj[p].add(d);S.adj[d].add(p)}
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
  // rutas marítimas (convoyes) entre provincias costeras cercanas
  const coast=S.provs.filter(p=>p.coastal);
  for(let i=0;i<coast.length;i++)for(let j=i+1;j<coast.length;j++){
    const a=coast[i],b=coast[j];
    if(S.adj[a.id].has(b.id))continue;
    const dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy);
    if(dd>220)continue;
    const steps=Math.max(8,(dd/12)|0);
    let ok=true,sea=0;
    for(let s=1;s<steps&&ok;s++){
      const x=Math.round(a.x+dx*s/steps),y=Math.round(a.y+dy*s/steps);
      const pid=S.provIdx[y*MW+x];
      if(pid===-1){sea++;continue}
      if(pid!==a.id&&pid!==b.id)ok=false;
    }
    if(ok&&sea>=1){S.seaAdj[a.id].add(b.id);S.seaAdj[b.id].add(a.id)}
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
  // provincias agrupadas por dueño de iure (owner0); el páramo queda fuera
  const byHome=new Map();
  for(const p of S.provs){
    if(p.wasteland)continue;
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
  S.roads=new Set();S.roadQueue=[];
  for(let n=0;n<NPLAY;n++){
    const cap=S.nations[n].capital;
    if(cap<0)continue;
    for(const p of S.provs){
      if(p.owner!==n||!p.urban||p.id===cap)continue;
      const path=landPath(cap,p.id,x=>S.provs[x].owner===n&&!S.provs[x].wasteland);
      if(path)for(let i=0;i<path.length-1;i++)S.roads.add(roadKey(path[i],path[i+1]));
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
    if(path&&path.length<=14)for(let i=0;i<path.length-1;i++)S.roads.add(roadKey(path[i],path[i+1]));
  }
}
function kmBetween(a,b){
  const[lo1,la1]=pxToLonLat(a.x,a.y),[lo2,la2]=pxToLonLat(b.x,b.y);
  const R=6371,dla=(la2-la1)*Math.PI/180,dlo=(lo2-lo1)*Math.PI/180;
  const h=Math.sin(dla/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

export {
  mulberry32, hashN, genName, SYL_A, SYL_M, SYL_B, decodeCountries, RLE_ALPHA, countryAt, generateMap, isolateWastePockets, MOUNTAIN_ZONES, MARSH_ZONES, FERTILE_ZONES, pxToLonLat, assignTerrain, assignResources, assignPopulation, rebuildProvinceData, buildDuchies, isDuchyCap, kmBetween, roadKey, hasRoad, landPath, generateRoads
};
