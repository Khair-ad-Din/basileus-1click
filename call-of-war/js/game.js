import { S } from "./state.js";
/* ============================= RNG ============================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
S.rand=mulberry32(193909);
function hashN(ix,iy){let n=(ix*374761393+iy*668265263)|0;n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return(n>>>0)/4294967296}

import {
  MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, START_STOCK, BUILDINGS, BUILD_CATS, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, terrainFx
} from "./config.js";

/* ============================= Estado global ============================= */
let acc=0;
const START_DATE=Date.UTC(1444,10,11,6);
const MESES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

/* ============================= Generación del mapa (Europa real) ============================= */
const SYL_A=["Bran","Kel","Vos","Tor","Mar","Lun","Ost","Var","Gal","Dor","Bel","Cra","Stal","Nor","Pet","Riv","Sar","Tan","Ulm","Vin","Kos","Bre","Ang","Mon","Tar"];
const SYL_M=["a","e","o","en","ar","el","in","or","an","ur"];
const SYL_B=["burgo","grado","via","landia","mark","stein","polis","feld","holm","gorod","novo","berg","minas","puerto","castro","stadt","kovo","mira"];
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
let countryAt=null; // 0 = mar, 1.. = índice de país en MAPDATA.countries
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
    for(const s of seeds){const dx=s.x-x,dy=s.y-y;if(dx*dx+dy*dy<16*16){ok=false;break}}
    if(ok)seeds.push({x,y,c:countryAt[y*MW+x],comp:compAt[y*MW+x],aname:name});
  }
  // relleno procedural (rejilla con jitter hasta los bordes; si cae en mar se reintenta),
  // dejando sitio alrededor de las anclas
  const anchorCount=seeds.length;
  for(let gy=28;gy<MH-10;gy+=58){
    for(let gx=28;gx<MW-10;gx+=58){
      for(let t=0;t<5;t++){
        const x=Math.max(1,Math.min(MW-2,Math.round(gx+(S.rand()-0.5)*44)));
        const y=Math.max(1,Math.min(MH-2,Math.round(gy+(S.rand()-0.5)*44)));
        const c=countryAt[y*MW+x];
        if(c>0){
          let ok=true;
          for(let s=0;s<anchorCount;s++){const dx=seeds[s].x-x,dy=seeds[s].y-y;if(dx*dx+dy*dy<28*28){ok=false;break}}
          if(ok)seeds.push({x,y,c,comp:compAt[y*MW+x]});
          break;
        }
      }
    }
  }
  // garantizar al menos una semilla por componente con territorio suficiente
  const haveSeed=new Set(seeds.map(s=>s.comp));
  const wantPix=new Map();
  comps.forEach((cm,id)=>{if(cm.size>=160&&!haveSeed.has(id))wantPix.set(id,(cm.size/2)|0)});
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
      if(counts[s]>0&&counts[s]<160&&compBest.get(seeds[s].comp)!==s)tiny.add(s);
    if(tiny.size){
      bad=[];
      for(let i=0;i<MW*MH;i++)if(S.provIdx[i]>=0&&tiny.has(S.provIdx[i])){isBad[i]=1;bad.push(i)}
      dilate();
    }
  }
  // provincias definitivas (los nombres históricos se reservan para no duplicarlos)
  const used=new Set(seeds.filter(s=>s.aname).map(s=>s.aname));
  const remap=new Int16Array(seeds.length).fill(-1);
  for(let i=0;i<seeds.length;i++){
    if(counts[i]<160)continue;
    remap[i]=S.provs.length;
    const an=seeds[i].aname;
    const own=MAPDATA.countries[seeds[i].c-1].nation;
    S.provs.push({id:S.provs.length,name:an||genName(used),x:seeds[i].x,y:seeds[i].y,country:seeds[i].c,
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
  assignTerrain();
  assignResources();
  // desierto profundo = territorio impracticable (estilo EU4): sin dueño ni tránsito;
  // la costa y los oasis con nombre histórico quedan como corredores jugables
  for(const p of S.provs)if(p.wasteland==null)p.wasteland=p.terrain==="desierto"&&!p.coastal&&!p.named;
  isolateWastePockets();
  for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
}
// Bolsas jugables rodeadas de páramo (p. ej. un oasis sin salida): quedan fuera del juego.
// Se conserva solo el componente conexo jugable mayor (tierra + rutas marítimas).
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
// Cordilleras y humedales históricos [lat, lon, radio en grados] para el terreno automático
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
  [31.5,-6.5,1.8],[33.0,-4.0,1.5],[35.5,1.5,1.5],[36.3,4.5,1.2],   // Atlas
  [61.5,8.5,2.2],[63.5,11.5,1.8],[65.0,14.0,2.5],           // Alpes escandinavos
  [56.9,-4.5,1.2],                                          // Highlands escocesas
  [45.2,2.8,1.4],[50.2,13.0,1.0]                            // Macizo Central, Sudetes
];
const MARSH_ZONES=[[52.2,27.5,1.6],[45.3,29.5,0.8],[53.0,5.8,0.7]]; // Prípiat, delta del Danubio, marismas neerlandesas
// Vegas fértiles: valles fluviales de alta producción [lat, lon, radio]
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
    if(!t&&lat<31.2)t="desierto";                            // Sáhara y Arabia
    if(!t&&lat<33.5&&lon>36.5&&lon<48)t="desierto";          // interior sirio-iraquí
    if(!t&&lat>=44&&lat<=49.5&&lon>=28&&lon<=50)t="estepa";  // estepa póntica
    if(!t&&lat>=46&&lat<=48.5&&lon>=18.5&&lon<=22)t="estepa";// puszta húngara
    if(!t&&lat>57)t="bosque";                                // taiga escandinava y rusa
    if(!t&&lat>52&&lon>20)t="bosque";                        // cinturón boscoso báltico-ruso
    if(!t&&lat>44&&lat<57&&S.rand()<0.14)t="bosque";           // bosques dispersos europeos
    if(!t&&lat>=43&&lat<=55&&lon<=12&&S.rand()<0.5)t="pradera";// praderas atlánticas templadas
    p.terrain=t||"llanura";
  }
}
// Cada provincia produce UN recurso, sesgado por su terreno. Las ciudades dan Ducados.
// Una minoría produce un bien de lujo regional (especias, paño, vino, sal, seda): son
// escasos a propósito y serán el motor del futuro comercio entre reinos.
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
    else if(t==="estepa"||t==="pradera")strat=["petroleo","petroleo","comida","comida"];
    else if(t==="vega")strat=["comida","comida","comida","vino"];
    else if(t==="desierto")strat=["comida","petroleo","sal"];
    else strat=["comida","comida","materiales","metal"]; // llanura
    p.resType=strat[(S.rand()*strat.length)|0];
  }
}
// listas de píxeles, bordes, adyacencia, costa y rutas marítimas — se recalcula tras
// generar el mapa y tras cada edición de forma en el editor
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
  // centro de provincia: si el punto de referencia quedó fuera (por una edición), usar el centroide
  for(const p of S.provs){
    if(!S.pixOfProv[p.id].length)continue;
    if(S.provIdx[p.y*MW+p.x]===p.id)continue;
    let sx=0,sy=0;
    for(const i of S.pixOfProv[p.id]){sx+=i%MW;sy+=(i/MW)|0}
    const cx=sx/S.pixOfProv[p.id].length,cy=sy/S.pixOfProv[p.id].length;
    let best=-1,bd=1e18;
    for(const i of S.pixOfProv[p.id]){
      const d=(i%MW-cx)**2+(((i/MW)|0)-cy)**2;
      if(d<bd){bd=d;best=i}
    }
    p.x=best%MW;p.y=(best/MW)|0;
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

/* ============================= Naciones iniciales ============================= */
function setupNations(){
  S.nations=NATIONS.map((n,i)=>({idx:i,res:Object.fromEntries(RES_KEYS.map(k=>[k,START_STOCK[k]||0])),
    mano:3000,ai:true,capital:-1,alive:!n.neutral,lastAI:0,startProvs:0}));
  // capitales históricas (marcadas por las ciudades del mapa) y tropas iniciales
  for(let n=0;n<NPLAY;n++){
    let cap=-1;
    for(const p of S.provs)if(p.owner===n&&p.capital){cap=p.id;break}
    if(cap<0)for(const p of S.provs)if(p.owner===n){cap=p.id;p.capital=true;break}
    S.nations[n].capital=cap;
    if(cap<0){S.nations[n].alive=false;continue}
    S.nations[n].startProvs=nationProvCount(n);
    const c=S.provs[cap];
    c.buildings.cuartel=1;c.morale=85;
    const start={infanteria:2,miliciano:2};
    if(S.nations[n].startProvs>=12)start.blindadoLigero=2; // las grandes potencias empiezan con caballería
    spawnArmy(n,cap,start);
  }
  for(const p of S.provs)if(p.owner<NPLAY)p.morale=75;
  // tropas territoriales concentradas: cada nación arranca con 3 formaciones como máximo
  // (capital + hasta dos cuerpos en los extremos del reino), sin unidades sueltas
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const cap=S.nations[n].capital;
    const capP=S.provs[cap];
    const owned=S.provs.filter(p=>p.owner===n&&!p.capital);
    const T=Math.round(owned.length/3); // misma masa total que el antiguo reparto disperso
    if(T<=0)continue;
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const posts=[];
    if(owned.length>=3){
      let far=null,fd=-1;
      for(const p of owned){const d=dist(p,capP);if(d>fd){fd=d;far=p}}
      posts.push(far);
      if(owned.length>=8){
        let far2=null,fd2=-1;
        for(const p of owned){
          if(p===far)continue;
          const d=Math.min(dist(p,capP),dist(p,far));
          if(d>fd2){fd2=d;far2=p}
        }
        if(far2)posts.push(far2);
      }
    }
    if(!posts.length||T<2){
      // nación pequeña: el refuerzo se integra en el ejército de la capital
      const a=S.armies.find(x=>x.nation===n&&x.prov===cap);
      if(a)a.units.infanteria=(a.units.infanteria||0)+T;
    }else if(posts.length===1){
      spawnArmy(n,posts[0].id,{infanteria:T});
    }else{
      const h=Math.ceil(T/2);
      spawnArmy(n,posts[0].id,{infanteria:h});
      spawnArmy(n,posts[1].id,{infanteria:T-h});
    }
  }
}
function spawnArmy(nation,prov,units){
  const a={id:S.armyIdSeq++,nation,prov,units:Object.assign({},units),path:[],legDone:0,legTotal:0};
  S.armies.push(a);
  return a;
}

/* ============================= Caminos ============================= */
// Los caminos son enlaces entre dos provincias adyacentes, no un edificio de provincia.
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
// Red inicial plausible: radiales de cada capital a sus ciudades, y arterias
// entre capitales vecinas (las viejas calzadas que unen los reinos).
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
function tryRoad(a,b){
  const cost={dinero:800,materiales:1200};
  if(S.provs[a].owner!==S.player||S.provs[b].owner!==S.player)return;
  if(hasRoad(a,b)||S.roadQueue.some(q=>q.key===roadKey(a,b)))return;
  if(!canAfford(S.player,cost))return;
  pay(S.player,cost);
  S.roadQueue.push({key:roadKey(a,b),hoursLeft:4320,nation:S.player}); // 6 meses de obra
  refreshSide();refreshTop();
}
window.tryRoad=tryRoad;

/* ============================= Render del mapa base ============================= */
const baseC=document.createElement("canvas");baseC.width=MW;baseC.height=MH;
const baseCtx=baseC.getContext("2d");
let baseData;
const borderC=document.createElement("canvas");borderC.width=MW;borderC.height=MH;
function hex2rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
const NCOL=NATIONS.map(n=>hex2rgb(n.color));
const TCOL={};for(const k of TERRAIN_KEYS)TCOL[k]=hex2rgb(TERRAINS[k].color);
const WASTECOL=hex2rgb("#847c6a"); // territorio impracticable en vista política
let terrainView=false; // modo de mapa: false = político, true = terreno
function provColor(p){
  if(terrainView)return TCOL[S.provs[p].terrain];
  return S.provs[p].wasteland?WASTECOL:NCOL[S.provs[p].owner];
}
function paintAll(){
  baseData=baseCtx.createImageData(MW,MH);
  const d=baseData.data;
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const i=y*MW+x,o=i*4,p=S.provIdx[i];
    if(p<0){
      const v=hashN(x>>3,y>>3)*14;
      d[o]=50+v;d[o+1]=72+v;d[o+2]=100+v;d[o+3]=255;
    }else{
      const c=provColor(p),s=S.provs[p].shade;
      d[o]=c[0]*s;d[o+1]=c[1]*s;d[o+2]=c[2]*s;d[o+3]=255;
    }
  }
  baseCtx.putImageData(baseData,0,0);
  paintBorders();
}
// bordes: frontera exterior de nación (o costa) destacada, divisiones internas sutiles
const borderCtx=borderC.getContext("2d");
let borderData;
function borderIsOuter(i){
  const p=S.provIdx[i],x=i%MW;
  if(x===0||x===MW-1||i<MW||i>=MW*MH-MW)return true;
  const own=S.provs[p].owner;
  let q;
  q=S.provIdx[i-1];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i+1];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i-MW];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  q=S.provIdx[i+MW];if(q<0||(q!==p&&S.provs[q].owner!==own))return true;
  return false;
}
function setBorderPx(i){
  const o=i*4,d=borderData.data;
  if(S.provs[S.provIdx[i]].wasteland){
    // el páramo no tiene divisiones internas; solo contorno con tierras habitadas o mar
    if(borderIsWasteEdge(i)){d[o]=8;d[o+1]=10;d[o+2]=12;d[o+3]=190}
    else{d[o+3]=0}
    return;
  }
  if(borderIsOuter(i)){d[o]=8;d[o+1]=10;d[o+2]=12;d[o+3]=235}
  else{d[o]=15;d[o+1]=18;d[o+2]=20;d[o+3]=60}
}
function borderIsWasteEdge(i){
  const x=i%MW;
  if(x===0||x===MW-1||i<MW||i>=MW*MH-MW)return true;
  let q;
  q=S.provIdx[i-1];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i+1];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i-MW];if(q<0||!S.provs[q].wasteland)return true;
  q=S.provIdx[i+MW];if(q<0||!S.provs[q].wasteland)return true;
  return false;
}
function paintBorders(){
  borderData=borderCtx.createImageData(MW,MH);
  for(let p=0;p<S.provs.length;p++)for(const i of S.borderPxOfProv[p])setBorderPx(i);
  borderCtx.putImageData(borderData,0,0);
}
function updateBordersAround(pid){
  if(!borderData)return;
  let x0=MW,y0=MH,x1=-1,y1=-1;
  const upd=p=>{
    for(const i of S.borderPxOfProv[p]){
      setBorderPx(i);
      const x=i%MW,y=(i/MW)|0;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
    }
  };
  upd(pid);
  for(const n of S.adj[pid])upd(n);
  if(x1<0)return;
  borderCtx.putImageData(borderData,0,0,x0,y0,x1-x0+1,y1-y0+1);
}
function repaintProvince(pid){
  const c=provColor(pid),s=S.provs[pid].shade,d=baseData.data;
  for(const i of S.pixOfProv[pid]){
    const o=i*4;d[o]=c[0]*s;d[o+1]=c[1]*s;d[o+2]=c[2]*s;
  }
  baseCtx.putImageData(baseData,0,0);
  updateBordersAround(pid); // la frontera nacional se mueve con la conquista
}
// capa de caminos: curvas serpenteantes entre provincias enlazadas (las obras, discontinuas).
// La curvatura es determinista (hash de las dos provincias), así el camino siempre luce igual.
const roadsC=document.createElement("canvas");roadsC.width=MW;roadsC.height=MH;
function roadCurve(c,a,b){
  const ax=S.provs[a].x,ay=S.provs[a].y,bx=S.provs[b].x,by=S.provs[b].y;
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1;
  const nx=-dy/L,ny=dx/L; // perpendicular al tramo
  const h1=hashN(a*7+1,b*13+3)-0.5, h2=hashN(a*11+5,b*17+7)-0.5;
  const w=Math.min(34,L*0.3);
  const isLand=(x,y)=>{
    const ix=x|0,iy=y|0;
    return ix>=0&&iy>=0&&ix<MW&&iy<MH&&S.provIdx[iy*MW+ix]>=0;
  };
  // probar curvaturas cada vez más suaves (y espejadas) hasta que el trazo no pise el mar
  for(const k of[1,-1,0.5,-0.5,0.25,-0.25,0]){
    const c1x=ax+dx/3+nx*w*h1*2*k, c1y=ay+dy/3+ny*w*h1*2*k;
    const c2x=ax+dx*2/3+nx*w*h2*2*k, c2y=ay+dy*2/3+ny*w*h2*2*k;
    let ok=true;
    for(let t=0.05;t<1&&ok;t+=0.05){
      const u=1-t;
      const x=u*u*u*ax+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*bx;
      const y=u*u*u*ay+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*by;
      if(!isLand(x,y))ok=false;
    }
    if(ok){
      c.moveTo(ax,ay);
      c.bezierCurveTo(c1x,c1y,c2x,c2y,bx,by);
      return;
    }
  }
  // ni la recta vale (una bahía en medio): pasar por el centro de la frontera compartida
  let sx=0,sy=0,cnt=0;
  for(const i of S.borderPxOfProv[a]){
    const x=i%MW,y=(i/MW)|0;
    if((x>0&&S.provIdx[i-1]===b)||(x<MW-1&&S.provIdx[i+1]===b)||
       (i>=MW&&S.provIdx[i-MW]===b)||(i<MW*MH-MW&&S.provIdx[i+MW]===b)){sx+=x;sy+=y;cnt++}
  }
  c.moveTo(ax,ay);
  if(cnt){c.lineTo(sx/cnt,sy/cnt);c.lineTo(bx,by)}
  else c.lineTo(bx,by);
}
function drawRoads(){
  const c=roadsC.getContext("2d");
  c.clearRect(0,0,MW,MH);
  c.lineCap="round";c.lineJoin="round";
  const seg=(a,b)=>{c.beginPath();roadCurve(c,a,b);c.stroke()};
  for(const k of S.roads){
    const[a,b]=k.split("|").map(Number);
    if(!S.provs[a]||!S.provs[b])continue;
    c.setLineDash([]);
    c.strokeStyle="rgba(45,34,20,.2)";c.lineWidth=3.4;seg(a,b); // sombra sutil
    c.strokeStyle="rgba(112,86,54,.45)";c.lineWidth=1.7;seg(a,b); // tierra apagada
  }
  for(const q of S.roadQueue){
    const[a,b]=q.key.split("|").map(Number);
    if(!S.provs[a]||!S.provs[b])continue;
    c.strokeStyle="rgba(112,86,54,.3)";c.lineWidth=1.6;c.setLineDash([7,8]);seg(a,b);
  }
  c.setLineDash([]);
}

/* ============================= Cámara y canvas ============================= */
const canvas=document.getElementById("map"),ctx=canvas.getContext("2d");
let zoom=1,panX=0,panY=0;
function fitCanvas(){
  const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
  canvas.width=w;canvas.height=h;
}
window.addEventListener("resize",fitCanvas);
function clampPan(){
  panX=Math.min(60,Math.max(canvas.width-MW*zoom-60,panX));
  panY=Math.min(60,Math.max(canvas.height-MH*zoom-60,panY));
}

/* ============================= Utilidades de juego ============================= */
function atWar(a,b){
  if(a===b)return false;
  if(a===NEUTRAL||b===NEUTRAL)return true;
  return S.wars.has(a<b?a+"|"+b:b+"|"+a);
}
function declareWar(a,b){
  if(a===NEUTRAL||b===NEUTRAL||a===b||atWar(a,b))return;
  S.wars.add(a<b?a+"|"+b:b+"|"+a);
  log(NATIONS[a].name+" declara la guerra a "+NATIONS[b].name+".");
}
function makePeace(a,b){
  S.wars.delete(a<b?a+"|"+b:b+"|"+a);
  S.truces.set(a<b?a+"|"+b:b+"|"+a,S.hour+17520); // tregua de 2 años para la IA
  // detener las marchas contra el ex-enemigo (si no, la llegada re-declara la guerra)
  for(const ar of S.armies){
    if(ar.nation!==a&&ar.nation!==b)continue;
    const other=ar.nation===a?b:a;
    if(ar.path.some(p=>S.provs[p].owner===other)){ar.path=[];ar.legDone=0;ar.legTotal=0}
  }
  log("Paz firmada entre "+NATIONS[a].name+" y "+NATIONS[b].name+".");
}
function underTruce(a,b){
  const t=S.truces.get(a<b?a+"|"+b:b+"|"+a);
  return t!==undefined&&S.hour<t;
}
function canAfford(n,cost){
  for(const k in cost)if(S.nations[n].res[k]<cost[k])return false;
  return true;
}
function pay(n,cost){for(const k in cost)S.nations[n].res[k]-=cost[k]}

/* ---- Edificios: coste, tiempo, requisitos y efecto sobre la provincia ---- */
function lvlOf(p,b){return p.buildings[b]||0}
// coste del SIGUIENTE nivel (escala con el nivel ya construido; las obras únicas no escalan)
function costFor(p,b){
  const B=BUILDINGS[b],lvl=lvlOf(p,b),f=B.unique?1:(1+0.5*lvl),c={};
  for(const k in B.cost)c[k]=Math.round(B.cost[k]*f);
  return c;
}
function timeFor(p,b){
  const B=BUILDINGS[b],lvl=lvlOf(p,b);
  let h=B.time*(B.unique?1:(1+0.35*lvl));
  h*=1-buildSpeedBonus(p); // la universidad acelera las obras de su provincia
  return Math.max(24,Math.round(h));
}
function buildSpeedBonus(p){
  let s=0;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.buildSpeed)s+=fx.buildSpeed*lvlOf(p,b)}
  return Math.min(0.6,s);
}
function buildMax(p,b){return BUILDINGS[b].unique?1:BUILDINGS[b].max}
// motivo por el que NO se puede construir (o null si se puede)
function buildBlock(p,b){
  const B=BUILDINGS[b];
  if(lvlOf(p,b)>=buildMax(p,b))return B.unique?"Ya construida":"Nivel máximo";
  if(p.buildQueue.length)return"Obra en curso";
  if(B.coastal&&!p.coastal)return"Requiere costa";
  if(B.urban&&!p.urban)return"Requiere ciudad";
  if(B.req)for(const r in B.req)if(lvlOf(p,r)<B.req[r])return"Requiere "+BUILDINGS[r].label+" "+B.req[r];
  if(!canAfford(p.owner,costFor(p,b)))return"Sin recursos";
  return null;
}
// multiplicador a la producción del recurso propio (gremio, fundición, universidad)
function provProdMul(p){
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.prodMul)m+=fx.prodMul*lvlOf(p,b)}
  return m;
}
// multiplicador de defensa de la provincia (castillo, ciudadela)
function provDefMul(p){
  let m=1;for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.def)m+=fx.def*lvlOf(p,b)}
  return m;
}
// mantenimiento/tick de una provincia (mantenimiento anual de sus edificios / 12)
function provUpkeep(p){
  const u={};
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b),up=BUILDINGS[b].up;if(!lvl||!up)continue;
    for(const k in up)u[k]=(u[k]||0)+up[k]/12*lvl;
  }
  return u;
}
// producción NETA/tick de una provincia (ya con moral y menos mantenimiento). La usan
// el tick de simulación y la tesorería; el desglose por fuente lo da provBreakdown().
function provEconomy(p){
  const out={res:{},mano:0};
  if(!p||p.owner>=NPLAY||p.wasteland)return out;
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod;
  const add=(k,v)=>{out.res[k]=(out.res[k]||0)+v};
  add(p.resType,(p.resType==="dinero"?2.8:1.3)*provProdMul(p)*terr*mor); // recurso propio
  add("dinero",0.4*mor);                                                  // oro base
  out.mano+=(p.urban?0.5:0.2)*mor;                                        // MO base
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b);if(!lvl)continue;
    const fx=BUILDINGS[b].fx;
    if(fx.prodAdd)for(const k in fx.prodAdd)add(k,fx.prodAdd[k]*lvl*terr*mor);
    if(fx.goldAdd)add("dinero",fx.goldAdd*lvl*mor);
    if(fx.mano)out.mano+=fx.mano*lvl*mor;
  }
  const up=provUpkeep(p);
  for(const k in up)add(k,-up[k]); // mantenimiento de los edificios
  return out;
}
// desglose por fuente para la UI: de dónde viene cada ingreso y cada gasto de la provincia
function provBreakdown(p){
  const income=[],upkeep=[];let mano=0;
  const net={};
  if(!p||p.owner>=NPLAY||p.wasteland)return{income,upkeep,net,mano};
  const mor=p.morale/100,terr=TERRAINS[p.terrain].prod;
  const baseNoMul=(p.resType==="dinero"?2.8:1.3)*terr*mor;
  income.push({label:p.urban?"Comercio de la ciudad":"Producción",res:p.resType,amt:baseNoMul});
  for(const b in BUILDINGS){ // multiplicadores de producción (gremio, fundición, universidad)
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);
    if(fx.prodMul&&lvl)income.push({label:BUILDINGS[b].label+" +"+Math.round(fx.prodMul*100)+"%",res:p.resType,amt:baseNoMul*fx.prodMul*lvl});
  }
  income.push({label:"Impuestos",res:"dinero",amt:0.4*mor});
  for(const b in BUILDINGS){
    const fx=BUILDINGS[b].fx,lvl=lvlOf(p,b);if(!lvl)continue;
    if(fx.prodAdd)for(const k in fx.prodAdd)income.push({label:BUILDINGS[b].label,res:k,amt:fx.prodAdd[k]*lvl*terr*mor});
    if(fx.goldAdd)income.push({label:BUILDINGS[b].label,res:"dinero",amt:fx.goldAdd*lvl*mor});
    if(fx.mano)mano+=fx.mano*lvl*mor;
  }
  mano+=(p.urban?0.5:0.2)*mor;
  const up=provUpkeep(p);
  for(const b in BUILDINGS){
    const bu=BUILDINGS[b].up,lvl=lvlOf(p,b);if(!lvl||!bu)continue;
    for(const k in bu)upkeep.push({label:BUILDINGS[b].label,res:k,amt:bu[k]/12*lvl});
  }
  for(const it of income)net[it.res]=(net[it.res]||0)+it.amt;
  for(const it of upkeep)net[it.res]=(net[it.res]||0)-it.amt;
  return{income,upkeep,net,mano};
}
// tesorería del reino: producción menos mantenimiento de edificios (en provEconomy) y del ejército
function nationEconomy(n){
  const res={},prov=S.provs.filter(p=>p.owner===n);
  for(const p of prov){const e=provEconomy(p);for(const k in e.res)res[k]=(res[k]||0)+e.res[k]}
  let troops=0;for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  res.dinero=(res.dinero||0)-0.6*troops;
  res.comida=(res.comida||0)-0.5*troops;
  return{res,provs:prov.length,troops,army:{dinero:0.6*troops,comida:0.5*troops}};
}
function armyCount(a){let t=0;for(const k in a.units)t+=a.units[k];return t}
function armyAtk(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].atk;return t}
function armyDef(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].def;return t}
function armyHp(a){let t=0;for(const k in a.units)t+=a.units[k]*UNITS[k].hp;return t}
function armySpd(a){let s=999;for(const k in a.units)if(a.units[k]>0.05)s=Math.min(s,UNITS[k].spd);return s===999?18:s} // km/día
function kmBetween(a,b){
  const[lo1,la1]=pxToLonLat(a.x,a.y),[lo2,la2]=pxToLonLat(b.x,b.y);
  const R=6371,dla=(la2-la1)*Math.PI/180,dlo=(lo2-lo1)*Math.PI/180;
  const h=Math.sin(dla/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function nationStrength(n){let t=0;for(const a of S.armies)if(a.nation===n)t+=armyAtk(a)+armyDef(a);return t}
function nationProvCount(n){let t=0;for(const p of S.provs)if(p.owner===n)t++;return t}
function armiesIn(pid){return S.armies.filter(a=>a.prov===pid&&a.path.length===0)}
function nbrs(c){return[...S.adj[c],...S.seaAdj[c]].filter(p=>!S.provs[p].wasteland)}
function bfsPath(from,to,passable){
  if(from===to)return[];
  const prev=new Map([[from,-1]]);
  const q=[from];
  while(q.length){
    const c=q.shift();
    for(const a of nbrs(c)){
      if(prev.has(a))continue;
      if(passable&&a!==to&&!passable(a))continue;
      prev.set(a,c);
      if(a===to){
        const path=[a];let cur=c;
        while(cur!==from){path.unshift(cur);cur=prev.get(cur)}
        return path;
      }
      q.push(a);
    }
  }
  return null;
}
function startLeg(a){
  if(!a.path.length){a.legDone=0;a.legTotal=0;return}
  const from=S.provs[a.prov],to=S.provs[a.path[0]];
  const km=kmBetween(from,to);
  if(!S.adj[a.prov].has(a.path[0])){
    // travesía marítima embarcada: ~90 km/día de cabotaje, mínimo 1 día de embarque
    a.legTotal=Math.max(24,km/90*24);
  }else{
    const terr=(TERRAINS[from.terrain].mov+TERRAINS[to.terrain].mov)/2;
    const road=hasRoad(a.prov,a.path[0])?1.5:1; // los caminos aceleran la marcha un 50%
    a.legTotal=Math.max(6,km/(armySpd(a)*terr*road)*24);
  }
  a.legDone=0;
}
function orderMove(a,target,passable){
  const origin=(a.path.length&&a.legDone>0)?a.path[0]:a.prov;
  let rest=bfsPath(origin,target,passable);
  if(rest===null&&passable)rest=bfsPath(origin,target); // sin ruta limpia, cualquier ruta
  if(rest===null)return false;
  if(a.path.length&&a.legDone>0){
    a.path=[a.path[0],...rest];
  }else{
    a.path=rest;startLeg(a);
  }
  return true;
}
function captureProv(pid,nation){
  const p=S.provs[pid];
  const old=p.owner;
  p.owner=nation;p.morale=25;p.buildQueue=[];p.recruitQueue=[];
  repaintProvince(pid);
  if(nation===S.player||old===S.player)log(NATIONS[nation].name+" captura "+p.name+".");
  if(old<NPLAY&&nationProvCount(old)===0){
    S.nations[old].alive=false;
    log(NATIONS[old].name+" ha sido eliminada del mapa.");
  }
  checkVictory();
}

/* ============================= Simulación (1 tick = 1 hora) ============================= */
function hourTick(){
  S.hour++;
  // 1. economía y moral
  for(let n=0;n<NPLAY;n++){
    if(!S.nations[n].alive)continue;
    const R=S.nations[n].res;
    // bono de moral al reino por obras únicas (catedral…)
    let realmMor=0;
    for(const p of S.provs)if(p.owner===n)for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.realmMoral)realmMor+=fx.realmMoral*lvlOf(p,b)}
    for(const p of S.provs){
      if(p.owner!==n)continue;
      const e=provEconomy(p);
      for(const k in e.res)R[k]+=e.res[k];
      S.nations[n].mano=Math.min(99999,S.nations[n].mano+e.mano);
      // moral: recuperación lenta hacia su techo (100 + fe/prestigio)
      let mreg=0.004;
      for(const b in BUILDINGS){const fx=BUILDINGS[b].fx;if(fx.moral)mreg+=fx.moral*lvlOf(p,b)}
      const cap=Math.min(100,90+realmMor);
      if(p.morale<cap)p.morale=Math.min(cap,p.morale+mreg);
    }
    // mantenimiento: sostener el ejército es lo caro, como en la época
    let troops=0;
    for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
    R.dinero-=0.6*troops;
    R.comida-=0.5*troops;
    for(const k of RES_KEYS)if(R[k]<0)R[k]=0; // ningún recurso baja de 0 (impagos = escasez)
  }
  // 2. construcción
  for(const p of S.provs){
    if(p.buildQueue.length){
      const q=p.buildQueue[0];
      if(--q.hoursLeft<=0){
        p.buildings[q.b]++;p.buildQueue.shift();
        if(p.owner===S.player)log(BUILDINGS[q.b].label+" nivel "+p.buildings[q.b]+" terminada en "+p.name+".");
      }
    }
    if(p.recruitQueue.length){
      const q=p.recruitQueue[0];
      if(--q.hoursLeft<=0){
        p.recruitQueue.shift();
        if(p.owner===q.nation||q.nation===p.owner){
          let a=S.armies.find(x=>x.nation===q.nation&&x.prov===p.id&&x.path.length===0);
          if(!a)a=spawnArmy(q.nation,p.id,{});
          a.units[q.u]=(a.units[q.u]||0)+1;
          if(q.nation===S.player)log(UNITS[q.u].label+" reclutado en "+p.name+".");
        }
      }
    }
  }
  // 2b. caminos en obra
  for(let i=S.roadQueue.length-1;i>=0;i--){
    const q=S.roadQueue[i];
    if(--q.hoursLeft<=0){
      S.roads.add(q.key);
      S.roadQueue.splice(i,1);
      drawRoads();
      const[ra,rb]=q.key.split("|").map(Number);
      if(q.nation===S.player)log("Camino terminado entre "+S.provs[ra].name+" y "+S.provs[rb].name+".");
    }
  }
  // 3. movimiento
  for(const a of S.armies){
    if(!a.path.length)continue;
    a.legDone++;
    if(a.legDone>=a.legTotal){
      a.prov=a.path.shift();
      const p=S.provs[a.prov];
      if(p.owner!==a.nation){
        if(p.owner<NPLAY)declareWar(a.nation,p.owner);
        const defenders=armiesIn(a.prov).filter(x=>x.nation===p.owner);
        if(defenders.length===0){
          captureProv(a.prov,a.nation);
        }else{
          a.path=[];a.legDone=0;a.legTotal=0;
        }
      }
      if(a.path.length)startLeg(a);else{a.legDone=0;a.legTotal=0}
    }
  }
  // 4. combates
  resolveBattles();
  // 5. fusión de ejércitos parados
  mergeIdle();
  // 6. IA cada 6 horas
  if(S.hour%6===0)for(let n=0;n<NPLAY;n++)if(S.nations[n].alive&&S.nations[n].ai)aiTurn(n);
  // 7. diario: moral y autoguardado
  if(S.hour%24===0){
    saveGame();
    for(const p of S.provs){
      if(p.wasteland)continue;
      let hostile=0;
      for(const a of S.adj[p.id])if(!S.provs[a].wasteland&&S.provs[a].owner!==p.owner&&atWar(p.owner,S.provs[a].owner))hostile++;
      const target=Math.max(25,(p.capital?85:75)-6*hostile);
      p.morale+=Math.max(-4,Math.min(4,target-p.morale));
      p.morale=Math.max(5,Math.min(100,p.morale));
    }
    checkVictory();
  }
}
function resolveBattles(){
  const byProv=new Map();
  for(const a of S.armies){
    if(a.path.length)continue;
    if(!byProv.has(a.prov))byProv.set(a.prov,[]);
    byProv.get(a.prov).push(a);
  }
  for(const[pid,list]of byProv){
    const p=S.provs[pid];
    const def=list.filter(a=>a.nation===p.owner);
    const atk=list.filter(a=>a.nation!==p.owner&&atWar(a.nation,p.owner));
    if(!atk.length)continue;
    if(!def.length){captureProv(pid,atk[0].nation);continue}
    S.battleFlash[pid]=S.hour;
    const terr=TERRAINS[p.terrain].def;
    const A=atk.reduce((s,a)=>s+armyAtk(a),0);
    const fort=provDefMul(p);
    const D=def.reduce((s,a)=>s+armyDef(a),0)*fort*terr;
    const hpA=atk.reduce((s,a)=>s+armyHp(a),0);
    const hpD=def.reduce((s,a)=>s+armyHp(a),0);
    // batallas y asedios se resuelven en días de juego, no en horas
    const dmgToDef=A*0.04/(fort*terr);
    const dmgToAtk=D*0.04;
    applyDamage(def,dmgToDef,hpD);
    applyDamage(atk,dmgToAtk,hpA);
    p.morale=Math.max(5,p.morale-0.05);
  }
  // limpiar ejércitos vacíos
  for(let i=S.armies.length-1;i>=0;i--){
    if(armyCount(S.armies[i])<0.05){
      if(S.selArmy===S.armies[i]){S.selArmy=null;refreshSide()}
      S.armies.splice(i,1);
    }
  }
}
function applyDamage(list,dmg,totalHp){
  if(totalHp<=0)return;
  const frac=Math.min(0.9,dmg/totalHp);
  for(const a of list)for(const k in a.units){
    a.units[k]*=(1-frac);
    if(a.units[k]<0.05)delete a.units[k];
  }
}
function mergeIdle(){
  const key=new Map();
  for(let i=S.armies.length-1;i>=0;i--){
    const a=S.armies[i];
    if(a.path.length)continue;
    const k=a.nation+":"+a.prov;
    if(key.has(k)){
      const t=key.get(k);
      for(const u in a.units)t.units[u]=(t.units[u]||0)+a.units[u];
      if(S.selArmy===a)S.selArmy=t;
      S.armies.splice(i,1);
    }else key.set(k,a);
  }
}

/* ============================= IA ============================= */
function aiTurn(n){
  const N=S.nations[n];
  const owned=S.provs.filter(p=>p.owner===n);
  if(!owned.length)return;
  // construir: prioridad militar en la capital, economía en el resto
  for(let t=0;t<2;t++){
    const p=owned[(S.rand()*owned.length)|0];
    if(p.buildQueue.length)continue;
    // orden de preferencia según recurso de la provincia y si es capital
    const pri=[];
    if(p.capital){pri.push("cuartel","fabrica","fortaleza","templo","mercado");}
    const byRes={comida:"granja",materiales:"aserradero",piedra:"cantera",metal:"mina"};
    if(byRes[p.resType])pri.push(byRes[p.resType]);
    pri.push("mercado","gremio","granja","templo","cuartel","fabrica","campo");
    if(p.coastal)pri.push("puerto");
    for(const b of pri){
      if(lvlOf(p,b)>=buildMax(p,b))continue;
      if(buildBlock(p,b))continue;
      pay(n,costFor(p,b));
      p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
      break;
    }
  }
  // reclutar
  let troops=0;
  for(const a of S.armies)if(a.nation===n)troops+=armyCount(a);
  if(troops<6+owned.length){
    for(const p of owned){
      if(p.recruitQueue.length||p.buildings.cuartel<1)continue;
      let u="infanteria";
      if(p.buildings.fabrica>=3&&S.rand()<0.3)u="blindadoMedio";
      else if(p.buildings.fabrica>=1&&S.rand()<0.35)u="blindadoLigero";
      else if(p.buildings.fabrica>=2&&S.rand()<0.3)u="artilleria";
      if(canAfford(n,UNITS[u].cost)&&N.mano>=UNITS[u].mano){
        pay(n,UNITS[u].cost);N.mano-=UNITS[u].mano;
        p.recruitQueue.push({u,nation:n,hoursLeft:recruitTime(p,u)});
        break;
      }
    }
  }
  // guerra: declarar al vecino con el que más frontera se comparte, ponderado por debilidad
  const enemies=[];
  for(let m=0;m<NPLAY;m++)if(m!==n&&S.nations[m].alive&&atWar(n,m))enemies.push(m);
  const day=S.hour/24;
  if(!enemies.length&&day>90&&S.rand()<0.001){ // las guerras surgen cada pocos años, no cada semana
    const capP=S.provs[S.nations[n].capital];
    const contact=new Map(); // nación -> {c: frontera compartida, d: distancia mínima a mi capital}
    const register=(a,w)=>{
      const o=S.provs[a].owner;
      if(o>=NPLAY||o===n||!S.nations[o].alive)return;
      const e=contact.get(o)||{c:0,d:1e9};
      e.c+=w;
      const dd=Math.hypot(S.provs[a].x-capP.x,S.provs[a].y-capP.y);
      if(dd<e.d)e.d=dd;
      contact.set(o,e);
    };
    for(const p of owned){
      for(const a of S.adj[p.id])register(a,1);
      for(const a of S.seaAdj[p.id])register(a,0.4); // el mar cuenta menos
    }
    let best=-1,bs=-1;
    for(const[m,e]of contact){
      if(underTruce(n,m))continue; // respetar la tregua tras una paz
      const score=e.c/(nationStrength(m)+50)/(1+e.d/350); // vecino pegado a casa > lejano
      if(score>bs){bs=score;best=m}
    }
    if(best>=0&&nationStrength(n)>nationStrength(best)*1.3)declareWar(n,best);
  }
  // mover ejércitos (la guarnición por provincia se precalcula una vez por turno)
  const wantNeutral=day>1;
  const garrison=new Map();
  for(const g of S.armies){
    if(g.path.length)continue;
    garrison.set(g.prov,(garrison.get(g.prov)||0)+armyDef(g));
  }
  for(const a of S.armies){
    if(a.nation!==n||a.path.length)continue;
    if(armyCount(a)<1.5)continue;
    if(S.provs[a.prov].capital&&armiesIn(a.prov).filter(x=>x.nation===n).length<=1&&enemies.length)continue;
    const target=findTarget(a.prov,n,enemies,wantNeutral,armyAtk(a)+armyDef(a),garrison);
    if(target>=0){
      // no cruzar territorio de terceros pacíficos (evita declaraciones de guerra al pasar)
      const pass=p=>{const o=S.provs[p].owner;return o===n||o===NEUTRAL||enemies.includes(o)};
      orderMove(a,target,pass);
    }
  }
  // paz si va muy mal
  for(const m of enemies){
    if(m===S.player)continue;
    if(nationStrength(n)<nationStrength(m)*0.4&&S.rand()<0.015)makePeace(n,m);
  }
}
function findTarget(from,n,enemies,wantNeutral,myPower,garrison){
  // Explora por anillos puntuando candidatos en vez de devolver el primero:
  // cerca > lejos, la travesía marítima cuesta más que la terrestre, una
  // provincia rodeada por territorio propio tiene prioridad máxima, y la
  // lejanía respecto a la CAPITAL penaliza (el país se expande alrededor de
  // su núcleo, no alrededor de sus conquistas avanzadas).
  const capId=S.nations[n].capital;
  const capP=capId>=0?S.provs[capId]:S.provs[from];
  const seen=new Map([[from,0]]);
  let ring=[from];
  let best=-1,bs=-1e9;
  for(let d=0;d<7&&ring.length;d++){
    const next=[];
    for(const c of ring){
      const dc=seen.get(c);
      const step=(a,cost)=>{
        if(seen.has(a))return;
        seen.set(a,cost);
        if(S.provs[a].wasteland)return; // ni objetivo ni tránsito
        next.push(a);
        const o=S.provs[a].owner;
        let s;
        if(enemies.includes(o))s=10;
        else if(wantNeutral&&o===NEUTRAL&&myPower>(garrison.get(a)||0)*1.6)s=4;
        else return;
        s-=cost*1.6;
        s-=Math.hypot(S.provs[a].x-capP.x,S.provs[a].y-capP.y)/90; // atracción de la capital
        let mine=0,tot=0;
        for(const b of S.adj[a]){if(S.provs[b].wasteland)continue;tot++;if(S.provs[b].owner===n)mine++}
        if(tot)s+=6*mine/tot; // bonus de cerco: enclaves y bolsas primero
        if(S.provs[a].capital)s+=1.5;
        if(s>bs){bs=s;best=a}
      };
      for(const a of S.adj[c])step(a,dc+1);
      for(const a of S.seaAdj[c])step(a,dc+2.2);
    }
    ring=next;
  }
  return best;
}

/* ============================= Acciones del jugador ============================= */
function recruitTime(p,u){
  return Math.max(2,Math.round(UNITS[u].time*(1-0.15*p.buildings.cuartel)*(UNITS[u].req.fabrica?1-0.08*p.buildings.fabrica:1)));
}
function tryBuild(pid,b){
  const p=S.provs[pid];
  if(p.owner!==S.player||buildBlock(p,b))return;
  pay(S.player,costFor(p,b));
  p.buildQueue.push({b,hoursLeft:timeFor(p,b)});
  refreshSide();refreshTop();refreshBuildBar();
}
function tryRecruit(pid,u){
  const p=S.provs[pid];
  if(p.owner!==S.player)return;
  const U=UNITS[u];
  for(const r in U.req)if(p.buildings[r]<U.req[r])return;
  if(!canAfford(S.player,U.cost)||S.nations[S.player].mano<U.mano)return;
  pay(S.player,U.cost);S.nations[S.player].mano-=U.mano;
  p.recruitQueue.push({u,nation:S.player,hoursLeft:recruitTime(p,u)});
  refreshSide();refreshTop();
}
function checkVictory(){
  if(S.gameOver||S.player<0)return;
  if(S.hour>=876000){ // año 1544: fin de la era, gana quien más domina
    S.gameOver=true;
    let best=-1,bc=-1;
    for(let n=0;n<NPLAY;n++){const c=nationProvCount(n);if(c>bc){bc=c;best=n}}
    document.getElementById("endTitle").textContent=best===S.player?"¡VICTORIA!":"FIN DE LA ERA";
    document.getElementById("endText").textContent="Corre el año 1544. "+NATIONS[best].name+" domina Europa con "+bc+
      " provincias"+(best===S.player?". Tu dinastía pasa a la historia.":"; tu nación termina con "+nationProvCount(S.player)+".");
    document.getElementById("endOverlay").style.display="flex";
    return;
  }
  const total=S.provs.filter(p=>!p.wasteland).length;
  const mine=nationProvCount(S.player);
  const myArmies=S.armies.some(a=>a.nation===S.player);
  const goal=Math.max(Math.ceil(total*0.33),Math.ceil(S.nations[S.player].startProvs*1.8));
  if(mine>=goal){
    S.gameOver=true;
    document.getElementById("endTitle").textContent="¡VICTORIA!";
    document.getElementById("endText").textContent="Controlas "+mine+" de "+total+" provincias. Europa es tuya.";
    document.getElementById("endOverlay").style.display="flex";
  }else if(mine===0&&!myArmies){
    S.gameOver=true;
    document.getElementById("endTitle").textContent="DERROTA";
    document.getElementById("endText").textContent="Tu nación ha sido borrada del mapa.";
    document.getElementById("endOverlay").style.display="flex";
  }
}

/* ============================= UI ============================= */
function log(msg){
  const el=document.getElementById("log");
  const d=document.createElement("div");
  d.textContent="Día "+(1+(S.hour/24|0))+" — "+msg;
  el.appendChild(d);
  while(el.children.length>8)el.removeChild(el.firstChild);
  setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d)},25000);
}
function fmt(v){return v>=10000?(v/1000).toFixed(1)+"k":Math.floor(v)}
function fmtDur(h){ // horas de juego -> texto legible
  if(h>=8760)return (h/8760).toFixed(1).replace(".0","")+" años";
  if(h>=720)return Math.round(h/730)+" meses";
  if(h>=48)return Math.round(h/24)+" días";
  return Math.round(h)+" h";
}
function buildResBar(){
  const bar=document.getElementById("resbar");
  if(bar.dataset.built)return;
  const cell=(k,cls)=>"<span class='res "+cls+"' title='"+RES_LABEL[k]+"'><span class='ic'>"+RES_ICON[k]+
    "</span><b id='r_"+k+"'>0</b></span>";
  let h=RES_STRAT.map(k=>cell(k,"strat")).join("");
  h+="<span class='sep'></span>";
  h+=RES_TRADE.map(k=>cell(k,"trade")).join("");
  h+="<span class='sep'></span><span class='res' title='Mano de obra'><span class='ic'>👥</span><b id='r_mano'>0</b></span>";
  bar.innerHTML=h;bar.dataset.built="1";
}
function refreshTop(){
  if(S.player<0)return;
  buildResBar();
  const R=S.nations[S.player].res;
  const inc=nationEconomy(S.player).res;
  for(const k of RES_KEYS){
    const el=document.getElementById("r_"+k);if(!el)continue;
    el.textContent=fmt(R[k]);
    const g=inc[k]||0;
    el.title=RES_LABEL[k]+": "+(g>=0?"+":"")+(Math.round(g*10)/10)+"/mes";
    el.style.color=g<-0.05?"#e08a7a":"#fff";
  }
  document.getElementById("r_mano").textContent=fmt(S.nations[S.player].mano);
  const d=new Date(START_DATE+S.hour*3600e3);
  document.getElementById("dateBox").textContent=
    "Día "+(1+(S.hour/24|0))+" · "+d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear()+
    ", "+String(d.getUTCHours()).padStart(2,"0")+":00";
}
function costStr(cost,mano){
  const parts=[];
  for(const k in cost)parts.push(fmt(cost[k])+" "+RES_LABEL[k]);
  if(mano)parts.push(mano+" MO");
  return parts.join(", ");
}
function n1(v){return (Math.round(v*10)/10).toString().replace(/\.0$/,"")}
// efecto legible de un edificio (por nivel)
function fxText(B){
  const fx=B.fx,t=[];
  if(fx.prodAdd)for(const k in fx.prodAdd)t.push("+"+n1(fx.prodAdd[k])+" "+RES_SHORT[k]);
  if(fx.prodMul)t.push("+"+Math.round(fx.prodMul*100)+"% prod");
  if(fx.goldAdd)t.push("+"+n1(fx.goldAdd)+" Duc");
  if(fx.mano)t.push("+"+n1(fx.mano)+" MO");
  if(fx.def)t.push("+"+Math.round(fx.def*100)+"% defensa");
  if(fx.moral)t.push("+moral");
  if(fx.realmMoral)t.push("+moral del reino");
  if(fx.buildSpeed)t.push("obras -"+Math.round(fx.buildSpeed*100)+"%");
  if(fx.seaMarch)t.push("marcha marítima");
  if(B.unlock)t.push("desbloquea tropas");
  return t.join(" · ");
}
// línea de coste con iconos; marca en rojo lo que no puedes pagar
function costLine(c,owner){
  return Object.keys(c).map(k=>{
    const no=owner!=null&&S.nations[owner].res[k]<c[k];
    return "<span"+(no?" class='no'":"")+">"+RES_ICON[k]+fmt(c[k])+"</span>";
  }).join(" ");
}
// categoría de edificios seleccionada en el índice de la barra inferior
let buildFilter="eco";
window.setBuildCat=function(k){buildFilter=k;refreshBuildBar()};
function renderBuildTabs(){
  const t=document.getElementById("buildtabs");
  const opts=[["all","Todos"]].concat(BUILD_CATS);
  t.innerHTML=opts.map(o=>"<span class='btab"+(buildFilter===o[0]?" on":"")+"' onclick='setBuildCat(\""+o[0]+"\")'>"+o[1]+"</span>").join("");
  t.className="show";t.style.display="flex";
}
// barra inferior de edificios (estilo EU4): resumen de la provincia + tarjetas por categoría
function refreshBuildBar(){
  const bar=document.getElementById("buildbar"),tabs=document.getElementById("buildtabs");
  const hide=()=>{bar.className="";bar.style.display="none";tabs.className="";tabs.style.display="none"};
  if(S.selArmy||S.selProv<0){hide();return}
  const p=S.provs[S.selProv];
  if(p.owner!==S.player||p.wasteland){hide();return}
  renderBuildTabs();
  const scroll=bar.scrollLeft;
  // desglose de ingresos y gastos de la provincia (de dónde proviene cada cosa)
  const bd=provBreakdown(p);
  const row=(lab,val,cls)=>"<div class='prow'><span>"+lab+"</span><b class='"+(cls||"")+"'>"+val+"</b></div>";
  let s="<div class='bsum'><h4>"+p.name+(p.capital?" ★":"")+"</h4>"+
    "<div class='tl'>"+(p.urban?"Ciudad":RES_LABEL[p.resType])+" · "+TERRAINS[p.terrain].label+
    " · moral "+Math.round(p.morale)+"%</div>";
  // Ingresos (por fuente), en /mes
  s+="<div class='bsec'>Ingresos <span class='u'>/mes</span></div>";
  for(const it of bd.income){if(it.amt<0.005)continue;
    s+=row(RES_ICON[it.res]+" "+it.label,"+"+n1(it.amt),"pos");}
  if(bd.mano>0.005)s+=row("👥 Mano de obra","+"+n1(bd.mano),"pos");
  // Mantenimiento (anual), por edificio
  s+="<div class='bsec'>Mantenimiento <span class='u'>/año</span></div>";
  let anyUp=false;
  for(const b in BUILDINGS){
    const lvl=lvlOf(p,b),bu=BUILDINGS[b].up;if(!lvl||!bu)continue;anyUp=true;
    const parts=Object.keys(bu).map(k=>RES_ICON[k]+n1(bu[k]*lvl)).join(" ");
    s+=row(BUILDINGS[b].label+((lvl>1&&!BUILDINGS[b].unique)?" ×"+lvl:""),"−"+parts,"neg");
  }
  if(!anyUp)s+="<div class='prow'><span class='dim'>Sin edificios que sostener</span></div>";
  // Balance neto, en /mes
  s+="<div class='bsec'>Balance <span class='u'>/mes</span></div>";
  const nk=Object.keys(bd.net).filter(k=>Math.abs(bd.net[k])>0.005).sort((a,b)=>bd.net[b]-bd.net[a]);
  for(const k of nk)s+=row(RES_ICON[k]+" "+RES_LABEL[k],(bd.net[k]>=0?"+":"")+n1(bd.net[k]),bd.net[k]<0?"neg":"pos");
  const dm=provDefMul(p);
  if(dm>1)s+=row("🏰 Defensa","+"+Math.round((dm-1)*100)+"%","");
  s+="</div>";
  // tarjetas de la categoría activa (o todas si el filtro es "Todos")
  const showAll=buildFilter==="all";
  const cList=showAll?BUILD_CATS:BUILD_CATS.filter(c=>c[0]===buildFilter);
  let cats="<div class='bcats'>";
  for(const[cat,label]of cList){
    let tiles="";
    for(const b in BUILDINGS){
      const B=BUILDINGS[b];if(B.cat!==cat)continue;
      const lvl=lvlOf(p,b),max=buildMax(p,b),inQ=p.buildQueue.some(q=>q.b===b);
      const block=inQ?null:buildBlock(p,b);
      const maxed=lvl>=max;
      let cls="btile";
      if(inQ)cls+=" building";else if(maxed)cls+=" done";else if(block)cls+=" locked";
      // indicador de nivel
      let lvIndicator;
      if(B.unique)lvIndicator="<span class='uni'>Única</span>";
      else{let d="";for(let i=0;i<max;i++)d+="<span class='dot"+(i<lvl?" on":"")+"'></span>";lvIndicator="<span class='dots'>"+d+"</span>";}
      // pie: coste, estado o acción
      let foot;
      if(inQ){const q=p.buildQueue.find(q=>q.b===b);foot="<div class='foot' style='color:#c9a86a'>En obra · "+fmtDur(q.hoursLeft)+"</div>";}
      else if(maxed)foot="<div class='foot' style='color:#8fbc62'>"+(B.unique?"Construida":"Nivel máximo")+"</div>";
      else{
        foot="<div class='cost'>"+costLine(costFor(p,b),S.player)+"</div>"+
          "<div class='foot'>"+(block?"🔒 "+block:"⏱ "+fmtDur(timeFor(p,b)))+"</div>";
      }
      // mantenimiento anual por nivel (lo que sostiene cada nivel)
      const upStr=B.up?"<div class='up' title='Mantenimiento anual por nivel'>🔧 "+
        Object.keys(B.up).map(k=>RES_ICON[k]+n1(B.up[k])).join(" ")+"/año</div>":"";
      const onclick=(!inQ&&!maxed&&!block)?" onclick='tryBuild("+p.id+",\""+b+"\")'":"";
      tiles+="<div class='"+cls+"'"+onclick+" title='"+B.desc.replace(/'/g,"’")+"'>"+
        "<div class='th'><span class='ic'>"+B.icon+"</span><span class='nm'>"+B.label+"</span>"+
        (B.unique?"":"<span class='lv'>"+lvl+"/"+max+"</span>")+"</div>"+
        lvIndicator+
        "<div class='fx'>"+fxText(B)+"</div>"+upStr+foot+"</div>";
    }
    cats+="<div class='bcat'>"+(showAll?"<div class='lab'>"+label+"</div>":"")+"<div class='btiles'>"+tiles+"</div></div>";
  }
  cats+="</div>";
  bar.innerHTML=s+cats;
  bar.className="show";bar.style.display="flex";
  bar.scrollLeft=scroll;
}
function refreshSide(){
  refreshBuildBar();
  const el=document.getElementById("side");
  if(S.selArmy){
    const a=S.selArmy;
    let h="<h2>Ejército de "+NATIONS[a.nation].name+"</h2>";
    h+="<div class='row'><span>Posición</span><b>"+S.provs[a.prov].name+"</b></div>";
    h+="<h3>Composición</h3>";
    for(const k in a.units)h+="<div class='row'><span>"+UNITS[k].label+"</span><b>"+Math.round(a.units[k])+"</b></div>";
    h+="<div class='row sm'><span>Ataque "+armyAtk(a).toFixed(1)+" · Defensa "+armyDef(a).toFixed(1)+"</span><span>"+armySpd(a)+" km/día</span></div>";
    if(a.path.length)h+="<div class='row'><span class='sm'>En marcha hacia "+S.provs[a.path[a.path.length-1]].name+"</span>"+
      (a.nation===S.player?"<button class='bbtn red' onclick='haltArmy()'>Detener</button>":"")+"</div>";
    else h+="<p class='sm' style='margin-top:6px;color:#9aa3ad'>Clic derecho en una provincia para mover.</p>";
    el.innerHTML=h;el.style.display="block";return;
  }
  if(S.selProv<0){el.style.display="none";return}
  const p=S.provs[S.selProv];
  if(p.wasteland){
    el.innerHTML="<h2>"+p.name+"</h2>"+
      "<div class='row'><span>Terreno</span><b>"+TERRAINS[p.terrain].label+"</b></div>"+
      "<p class='sm' style='color:#9aa3ad;margin-top:6px'>Territorio impracticable: nadie puede reclamarlo ni atravesarlo.</p>";
    el.style.display="block";return;
  }
  const own=p.owner===S.player;
  let h="<h2>"+p.name+(p.capital?" ★":"")+"</h2>";
  h+="<div class='row'><span>Nación</span><span><span class='chip' style='background:"+NATIONS[p.owner].color+"'></span> "+NATIONS[p.owner].name+"</span></div>";
  h+="<div class='row'><span>Recurso</span><b>"+(p.resType==="dinero"?"Ciudad (Ducados)":RES_LABEL[p.resType])+"</b></div>";
  h+="<div class='row'><span>Terreno</span><b title='"+terrainFx(p.terrain)+"'>"+TERRAINS[p.terrain].label+"</b></div>";
  h+="<div class='row sm'><span>"+terrainFx(p.terrain)+"</span></div>";
  h+="<div class='row'><span>Moral</span><b>"+Math.round(p.morale)+"%</b></div>";
  if(own){
    const ne=nationEconomy(S.player);
    h+="<h3>Tesorería del reino</h3>";
    h+="<div class='row sm'><span>"+ne.provs+" provincias · mantiene "+ne.troops+" tropas</span></div>";
    const ks=Object.keys(ne.res).filter(k=>Math.abs(ne.res[k])>0.05).sort((a,b)=>ne.res[b]-ne.res[a]);
    for(const k of ks){const v=ne.res[k];
      h+="<div class='row'><span>"+RES_ICON[k]+" "+RES_LABEL[k]+"</span><b style='color:"+(v<0?"#e08a7a":"#8fce7e")+"'>"+(v>=0?"+":"")+n1(v)+"/mes</b></div>";}
    if(p.buildQueue.length)h+="<div class='row sm'><span>En obra: "+BUILDINGS[p.buildQueue[0].b].label+"</span><span>"+fmtDur(p.buildQueue[0].hoursLeft)+"</span></div>";
    h+="<p class='sm' style='color:#9aa3ad;margin-top:3px'>Gestiona los edificios en la barra inferior ↓</p>";
  }else{
    const blist=Object.keys(BUILDINGS).filter(b=>lvlOf(p,b)>0);
    if(blist.length){
      h+="<h3>Construcciones enemigas</h3>";
      for(const b of blist)h+="<div class='row sm'><span>"+BUILDINGS[b].icon+" "+BUILDINGS[b].label+"</span><b>"+(BUILDINGS[b].unique?"✓":lvlOf(p,b))+"</b></div>";
    }
  }
  if(own){
    h+="<h3>Caminos</h3>";
    let anyRoadRow=false;
    for(const b of S.adj[p.id]){
      if(S.provs[b].owner!==S.player)continue;
      anyRoadRow=true;
      const kmR=Math.round(kmBetween(p,S.provs[b]));
      if(hasRoad(p.id,b)){
        h+="<div class='row sm'><span>→ "+S.provs[b].name+" ("+kmR+" km)</span><span>camino</span></div>";
      }else if(S.roadQueue.some(q=>q.key===roadKey(p.id,b))){
        const q=S.roadQueue.find(q=>q.key===roadKey(p.id,b));
        h+="<div class='row sm'><span>→ "+S.provs[b].name+"</span><span>en obra ("+fmtDur(q.hoursLeft)+")</span></div>";
      }else{
        const dis=!canAfford(S.player,{dinero:800,materiales:1200});
        h+="<div class='row'><span class='sm'>→ "+S.provs[b].name+" ("+kmR+" km)</span>"+
          "<button class='bbtn' "+(dis?"disabled":"")+" title='800 Ducados, 1200 Madera — 6 meses' onclick='tryRoad("+p.id+","+b+")'>Camino</button></div>";
      }
    }
    if(!anyRoadRow)h+="<p class='sm' style='color:#9aa3ad'>Sin provincias propias adyacentes.</p>";
    h+="<h3>Reclutamiento</h3>";
    for(const u in UNITS){
      const U=UNITS[u];
      let okReq=true;
      for(const r in U.req)if(p.buildings[r]<U.req[r])okReq=false;
      if(!okReq)continue;
      const dis=!canAfford(S.player,U.cost)||S.nations[S.player].mano<U.mano;
      h+="<div class='row'><span>"+U.label+" <span class='sm'>("+fmtDur(recruitTime(p,u))+")</span></span>"+
        "<button class='bbtn' "+(dis?"disabled":"")+" title='"+costStr(U.cost,U.mano)+"' onclick='tryRecruit("+p.id+",\""+u+"\")'>Reclutar</button></div>";
    }
    if(p.recruitQueue.length){
      h+="<div class='row sm'><span>En cola: "+p.recruitQueue.map(q=>UNITS[q.u].label).join(", ")+"</span><span>"+fmtDur(p.recruitQueue[0].hoursLeft)+"</span></div>";
    }
  }
  const here=armiesIn(p.id);
  if(here.length){
    h+="<h3>Ejércitos</h3>";
    for(const a of here){
      h+="<div class='row'><span><span class='chip' style='background:"+NATIONS[a.nation].color+"'></span> "+
        Math.round(armyCount(a))+" unidades</span>"+
        (a.nation===S.player?"<button class='bbtn' onclick='selectArmyId("+a.id+")'>Seleccionar</button>":"")+"</div>";
    }
  }
  el.innerHTML=h;el.style.display="block";
}
window.tryBuild=tryBuild;window.tryRecruit=tryRecruit;
window.haltArmy=function(){if(S.selArmy){S.selArmy.path=[];S.selArmy.legDone=0;S.selArmy.legTotal=0;refreshSide()}};
window.selectArmyId=function(id){const a=S.armies.find(x=>x.id===id);if(a){S.selArmy=a;S.selProv=-1;refreshSide()}};

function refreshDiplomacy(){
  let h="<table class='dip'><tr><th>Nación</th><th>Provincias</th><th>Fuerza</th><th>Estado</th><th></th></tr>";
  for(let n=0;n<NPLAY;n++){
    if(n===S.player)continue;
    const alive=S.nations[n].alive;
    h+="<tr><td><span class='chip' style='background:"+NATIONS[n].color+"'></span> "+NATIONS[n].name+"</td>";
    h+="<td>"+nationProvCount(n)+"</td><td>"+Math.round(nationStrength(n))+"</td>";
    if(!alive){h+="<td colspan='2'>Eliminada</td></tr>";continue}
    if(atWar(S.player,n)){
      h+="<td style='color:#d08080'>EN GUERRA</td><td><button class='bbtn' onclick='proposePeace("+n+")'>Proponer paz</button></td>";
    }else{
      h+="<td style='color:#90b080'>Paz</td><td><button class='bbtn red' onclick='playerDeclare("+n+")'>Declarar guerra</button></td>";
    }
    h+="</tr>";
  }
  h+="</table>";
  document.getElementById("dipBody").innerHTML=h;
}
window.proposePeace=function(n){
  if(nationStrength(n)<nationStrength(S.player)*0.8){makePeace(S.player,n)}
  else log(NATIONS[n].name+" rechaza tu propuesta de paz.");
  refreshDiplomacy();
};
window.playerDeclare=function(n){declareWar(S.player,n);refreshDiplomacy()};

/* ============================= Editor de formas de provincia ============================= */
// Al seleccionar una provincia se vectoriza su contorno (trazado de borde + simplificación).
// Editar los vértices y soltar re-rasteriza: los píxeles ganados se toman de la provincia
// vecina y los perdidos se le ceden. El mapa editado se guarda como instantánea (localStorage)
// y se carga al arrancar en lugar de regenerarse.
let editMode=false,shapeSel=-1,shapePoly=[],dragVi=-1;
let editTool="shape"; // "shape" | "merge" | "split" | "roads"
let mergeFrom=-1,mergeCur=null;   // gesto de fusión (provincia origen y cursor)
let splitFrom=-1,splitCur=null;   // gesto de división (vértice origen y cursor)
let roadFrom=-1,roadCur=null;     // gesto de camino (provincia origen y cursor)
let dragWas=null,dragIns=false;   // posición original del vértice arrastrado / si fue insertado
// sesión de edición: nada se persiste hasta «Guardar cambios»
let editUndoStack=[],editBackup=null,editDirty=false;

function enterEditor(){
  editMode=true;shapeSel=-1;shapePoly=[];dragVi=-1;
  editTool="shape";mergeFrom=-1;splitFrom=-1;roadFrom=-1;
  editBackup=buildSnapshot();editUndoStack=[];editDirty=false;
  document.getElementById("buildbar").style.display="none";
  document.getElementById("buildtabs").style.display="none";
  S.speed=0;
  document.querySelectorAll(".spdBtn").forEach(x=>x.classList.toggle("active",x.dataset.s==="0"));
  document.getElementById("startOverlay").style.display="none";
  refreshEditorPanel();
}
function exitEditor(){
  if(editDirty){
    if(confirm("Hay cambios sin guardar. ¿Guardarlos antes de salir?")){
      window.saveChanges();
    }else if(confirm("¿Salir descartando los cambios?")){
      restoreWorldFromSnap(editBackup);
      editUndoStack=[];editDirty=false;
    }else return;
  }
  editMode=false;shapeSel=-1;shapePoly=[];dragVi=-1;
  editTool="shape";mergeFrom=-1;splitFrom=-1;roadFrom=-1;
  document.getElementById("side").style.display="none";
  if(!S.started)showNationPicker();
}
function pushUndo(){
  editUndoStack.push(buildSnapshot());
  if(editUndoStack.length>20)editUndoStack.shift();
  editDirty=true;
}
function restoreWorldFromSnap(snap){
  S.provs=[];S.armies=[];S.wars=new Set();S.truces=new Map();S.armyIdSeq=1;
  S.player=-1;S.hour=0;acc=0;S.started=false;S.gameOver=false;
  S.selProv=-1;S.selArmy=null;S.battleFlash={};selOutline=null;selOutlineProv=-1;
  shapeSel=-1;shapePoly=[];dragVi=-1;mergeFrom=-1;splitFrom=-1;roadFrom=-1;
  document.getElementById("nationChip").innerHTML="";
  loadProvMap(snap);
  setupNations();
  if(!S.customRoads)generateRoads();
  paintAll();
  drawRoads();
  if(editMode)refreshEditorPanel();
}
window.saveChanges=function(){
  saveProvMap();
  editBackup=buildSnapshot();
  editDirty=false;
  refreshEditorPanel();
  log("Mapa guardado en el navegador.");
};
window.undoEdit=function(){
  if(!editUndoStack.length)return;
  restoreWorldFromSnap(editUndoStack.pop());
  editDirty=editUndoStack.length>0;
  refreshEditorPanel();
};
window.discardChanges=function(){
  if(!confirm("Se restaurará el estado del último guardado. ¿Continuar?"))return;
  restoreWorldFromSnap(editBackup);
  editUndoStack=[];editDirty=false;
  refreshEditorPanel();
};
window.setTool=function(t){
  editTool=t;mergeFrom=-1;splitFrom=-1;roadFrom=-1;dragVi=-1;
  refreshEditorPanel();
};
function toggleRoadEdit(a,b){
  if(a===b||!S.adj[a].has(b)){log("Los caminos solo unen provincias adyacentes por tierra.");return}
  if(S.provs[a].wasteland||S.provs[b].wasteland)return;
  pushUndo();
  S.customRoads=true;
  const k=roadKey(a,b);
  if(S.roads.has(k))S.roads.delete(k);else S.roads.add(k);
  S.roadQueue=S.roadQueue.filter(q=>q.key!==k);
  drawRoads();
  refreshEditorPanel();
}

// --- vectorización del contorno ---
function dpSimplify(pts,tol){
  const keep=new Uint8Array(pts.length);
  keep[0]=keep[pts.length-1]=1;
  const st=[[0,pts.length-1]];
  while(st.length){
    const[a,b]=st.pop();
    if(b-a<2)continue;
    const ax=pts[a][0],ay=pts[a][1],dx=pts[b][0]-ax,dy=pts[b][1]-ay;
    const L=Math.hypot(dx,dy)||1e-9;
    let mx=-1,mi=-1;
    for(let i=a+1;i<b;i++){
      const d=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L;
      if(d>mx){mx=d;mi=i}
    }
    if(mx>tol){keep[mi]=1;st.push([a,mi],[mi,b])}
  }
  const out=[];
  for(let i=0;i<pts.length;i++)if(keep[i])out.push(pts[i]);
  return out;
}
function simplifyRing(pts,tol){
  if(pts.length<8)return pts.map(p=>[p[0],p[1]]);
  let far=0,fd=-1;
  for(let i=0;i<pts.length;i++){
    const d=(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2;
    if(d>fd){fd=d;far=i}
  }
  const A=dpSimplify(pts.slice(0,far+1),tol);
  const B=dpSimplify(pts.slice(far).concat([pts[0]]),tol);
  return A.slice(0,-1).concat(B.slice(0,-1)).map(p=>[p[0],p[1]]);
}
function traceProvince(pid){
  const pix=S.pixOfProv[pid];
  if(!pix||!pix.length)return[];
  let mnX=MW,mnY=MH,mxX=0,mxY=0;
  for(const i of pix){
    const x=i%MW,y=(i/MW)|0;
    if(x<mnX)mnX=x;if(x>mxX)mxX=x;if(y<mnY)mnY=y;if(y>mxY)mxY=y;
  }
  const ox=mnX-1,oy=mnY-1,w=mxX-mnX+3,h=mxY-mnY+3;
  const m=new Uint8Array(w*h);
  for(const i of pix)m[((i/MW|0)-oy)*w+(i%MW-ox)]=1;
  // trazado de contorno (vecindad de Moore, sentido horario)
  const DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1];
  let s=-1;
  for(let i=0;i<w*h;i++)if(m[i]){s=i;break}
  const sx=s%w,sy=(s/w)|0;
  let cx=sx,cy=sy,back=4;
  const pts=[[sx,sy]];
  for(let guard=0;guard<600000;guard++){
    let f=-1;
    for(let k=1;k<=8;k++){
      const d=(back+k)%8,nx=cx+DX[d],ny=cy+DY[d];
      if(nx>=0&&ny>=0&&nx<w&&ny<h&&m[ny*w+nx]){f=d;break}
    }
    if(f<0)break;
    cx+=DX[f];cy+=DY[f];back=(f+4)%8;
    if(cx===sx&&cy===sy)break;
    pts.push([cx,cy]);
  }
  const poly=simplifyRing(pts,2.6);
  for(const q of poly){q[0]+=ox+0.5;q[1]+=oy+0.5}
  return poly;
}

// --- re-rasterizado de la forma editada ---
function applyShape(pid,poly){
  if(poly.length<3)return;
  pushUndo();
  let mnX=1e9,mnY=1e9,mxX=-1e9,mxY=-1e9;
  for(const q of poly){
    if(q[0]<mnX)mnX=q[0];if(q[0]>mxX)mxX=q[0];
    if(q[1]<mnY)mnY=q[1];if(q[1]>mxY)mxY=q[1];
  }
  const x0=Math.max(0,Math.floor(mnX)-1),x1=Math.min(MW-1,Math.ceil(mxX)+1);
  const y0=Math.max(0,Math.floor(mnY)-1),y1=Math.min(MH-1,Math.ceil(mxY)+1);
  const bw=x1-x0+1,bh=y1-y0+1;
  const inside=new Uint8Array(bw*bh);
  for(let y=y0;y<=y1;y++){
    const yc=y+0.5,xs=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      if((a[1]>yc)!==(b[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    xs.sort((u,v)=>u-v);
    for(let k=0;k+1<xs.length;k+=2){
      const xa=Math.max(x0,Math.ceil(xs[k]-0.5)),xb=Math.min(x1,Math.floor(xs[k+1]-0.5));
      for(let x=xa;x<=xb;x++)inside[(y-y0)*bw+(x-x0)]=1;
    }
  }
  // ganancias: píxeles de otras provincias dentro del polígono; ninguna vecina puede quedar casi vacía
  const gains=new Map();
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(!inside[(y-y0)*bw+(x-x0)])continue;
    const i=y*MW+x,q=S.provIdx[i];
    if(q>=0&&q!==pid){
      if(!gains.has(q))gains.set(q,[]);
      gains.get(q).push(i);
    }
  }
  let blocked=0;
  for(const[v,list]of gains){
    if(S.pixOfProv[v].length-list.length<48){blocked++;continue}
    for(const i of list)S.provIdx[i]=pid;
  }
  // pérdidas: píxeles propios fuera del polígono se ceden a la provincia vecina (dilatación)
  const isLost=new Uint8Array(MW*MH);
  let pend=[];
  for(const i of S.pixOfProv[pid]){
    const x=i%MW,y=(i/MW)|0;
    const ins=(x>=x0&&x<=x1&&y>=y0&&y<=y1)?inside[(y-y0)*bw+(x-x0)]:0;
    if(!ins){pend.push(i);isLost[i]=1}
  }
  while(pend.length){
    const next=[];
    let changed=false;
    for(const k of pend){
      const x=k%MW;
      let pick=-1;
      for(const j of[k-1,k+1,k-MW,k+MW]){
        if(j<0||j>=MW*MH)continue;
        if(Math.abs((j%MW)-x)>1)continue;
        const q=S.provIdx[j];
        if(q>=0&&q!==pid&&!isLost[j]){pick=q;break}
      }
      if(pick>=0){S.provIdx[k]=pick;isLost[k]=0;changed=true}
      else next.push(k);
    }
    if(!changed)break; // lo rodeado solo por la propia provincia o el mar se conserva
    pend=next;
  }
  rebuildProvinceData();
  paintAll();
  drawRoads(); // los centros de provincia pueden haberse movido
  selOutline=null;selOutlineProv=-1;
  if(blocked)log("Edición limitada: "+blocked+" provincia(s) vecina(s) no pueden quedar vacías.");
}

// --- fusión: la provincia origen se disuelve dentro de la destino ---
function mergeProvinces(a,b){
  if(a===b||!S.provs[a]||!S.provs[b])return;
  pushUndo();
  const A=S.provs[a],B=S.provs[b];
  const bName=B.name;
  B.urban=B.urban||A.urban;
  if(A.capital)B.capital=true;
  // eliminar la provincia origen y reindexar todo lo que apunta a ids
  const newIdOf=i=>i<a?i:i-1;
  const target=newIdOf(b);
  S.provs.splice(a,1);
  S.provs.forEach((p,i)=>p.id=i);
  for(let i=0;i<MW*MH;i++){
    const q=S.provIdx[i];
    if(q<0)continue;
    S.provIdx[i]=q===a?target:newIdOf(q);
  }
  for(const ar of S.armies){
    ar.prov=ar.prov===a?target:newIdOf(ar.prov);
    ar.path=ar.path.map(p=>p===a?target:newIdOf(p));
    ar.path=ar.path.filter((p,i)=>i===0?p!==ar.prov:p!==ar.path[i-1]);
    if(!ar.path.length){ar.legDone=0;ar.legTotal=0}
  }
  for(const n of S.nations){
    if(n.capital===a)n.capital=target;
    else if(n.capital>a)n.capital--;
  }
  S.battleFlash={};
  S.selProv=-1;S.selArmy=null;
  rebuildProvinceData();
  if(S.customRoads){
    // remapear las claves de camino a los nuevos ids de provincia
    const nr=new Set();
    for(const k of S.roads){
      let[x,y]=k.split("|").map(Number);
      x=x===a?target:newIdOf(x);
      y=y===a?target:newIdOf(y);
      if(x!==y&&S.adj[x]&&S.adj[x].has(y))nr.add(roadKey(x,y));
    }
    S.roads=nr;S.roadQueue=[];
  }else generateRoads(); // los ids de provincia han cambiado
  paintAll();
  drawRoads();
  selOutline=null;selOutlineProv=-1;
  shapeSel=target;shapePoly=traceProvince(target);
  refreshEditorPanel();
  log(A.name+" fusionada con "+bName+".");
}

// --- división: cortar una provincia por la cuerda entre dos vértices ---
function rasterPoly(poly){
  let mnX=1e9,mnY=1e9,mxX=-1e9,mxY=-1e9;
  for(const q of poly){
    if(q[0]<mnX)mnX=q[0];if(q[0]>mxX)mxX=q[0];
    if(q[1]<mnY)mnY=q[1];if(q[1]>mxY)mxY=q[1];
  }
  const x0=Math.max(0,Math.floor(mnX)-1),x1=Math.min(MW-1,Math.ceil(mxX)+1);
  const y0=Math.max(0,Math.floor(mnY)-1),y1=Math.min(MH-1,Math.ceil(mxY)+1);
  const out=[];
  for(let y=y0;y<=y1;y++){
    const yc=y+0.5,xs=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      if((a[1]>yc)!==(b[1]>yc))xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    xs.sort((u,v)=>u-v);
    for(let k=0;k+1<xs.length;k+=2){
      const xa=Math.max(x0,Math.ceil(xs[k]-0.5)),xb=Math.min(x1,Math.floor(xs[k+1]-0.5));
      for(let x=xa;x<=xb;x++)out.push(y*MW+x);
    }
  }
  return out;
}
function keepLargestFragment(pid,fallbackPid){
  const pix=[];
  for(let i=0;i<MW*MH;i++)if(S.provIdx[i]===pid)pix.push(i);
  if(!pix.length)return;
  const seen=new Set();
  const frags=[];
  for(const start of pix){
    if(seen.has(start))continue;
    const st=[start];seen.add(start);
    const fr=[];
    while(st.length){
      const k=st.pop();fr.push(k);
      const x=k%MW;
      for(const j of[k-1,k+1,k-MW,k+MW]){
        if(j<0||j>=MW*MH)continue;
        if(Math.abs((j%MW)-x)>1)continue;
        if(S.provIdx[j]===pid&&!seen.has(j)){seen.add(j);st.push(j)}
      }
    }
    frags.push(fr);
  }
  if(frags.length<2)return;
  frags.sort((u,v)=>v.length-u.length);
  for(let f=1;f<frags.length;f++)for(const k of frags[f])S.provIdx[k]=fallbackPid;
}
function splitProvince(pid,poly,vi,vj,forcedName){
  const n=poly.length;
  const ring=vi<vj?poly.slice(vi,vj+1):poly.slice(vi).concat(poly.slice(0,vj+1));
  if(ring.length<3)return;
  const part=rasterPoly(ring).filter(i=>S.provIdx[i]===pid);
  const rest=S.pixOfProv[pid].length-part.length;
  if(part.length<48||rest<48){alert("Las dos partes deben tener un tamaño mínimo.");return}
  const raw=forcedName!==undefined?forcedName:prompt("Nombre de la nueva provincia:",S.provs[pid].name+" II");
  if(!raw||!raw.trim())return;
  const nm=raw.trim();
  if(S.provs.some(p=>p.name===nm)){alert("Ya existe una provincia con ese nombre.");return}
  pushUndo();
  const src=S.provs[pid];
  const np={id:S.provs.length,name:nm,x:0,y:0,country:src.country,owner:src.owner,owner0:src.owner0,
    named:true,coastal:false,morale:60,urban:false,resType:src.resType,shade:0.85+S.rand()*0.3,capital:false,
    terrain:src.terrain,wasteland:src.wasteland,
    buildings:newBuildings(),buildQueue:[],recruitQueue:[]};
  S.provs.push(np);
  for(const i of part)S.provIdx[i]=np.id;
  // cada parte conserva solo su fragmento conexo mayor (el resto pasa a la otra)
  keepLargestFragment(np.id,pid);
  keepLargestFragment(pid,np.id);
  rebuildProvinceData();
  if(!S.customRoads)generateRoads(); // con red editada, los ids existentes siguen siendo válidos
  paintAll();
  drawRoads();
  selOutline=null;selOutlineProv=-1;
  shapeSel=np.id;shapePoly=traceProvince(np.id);
  refreshEditorPanel();
  log(src.name+" dividida: nace "+nm+".");
}

// --- instantánea del mapa editado ---
function buildSnapshot(){
  const rle=[];
  let cur=S.provIdx[0],run=1;
  for(let i=1;i<MW*MH;i++){
    if(S.provIdx[i]===cur)run++;
    else{rle.push(cur,run);cur=S.provIdx[i];run=1}
  }
  rle.push(cur,run);
  return{v:1,W:MW,H:MH,rle,roads:[...S.roads],
    provs:S.provs.map(p=>[p.name,p.x,p.y,p.owner0,p.named?1:0,p.urban?1:0,p.capital?1:0,TERRAIN_KEYS.indexOf(p.terrain),p.wasteland?1:0])};
}
function saveProvMap(){
  try{localStorage.setItem("basileus_provmap",JSON.stringify(buildSnapshot()))}
  catch(e){log("No se pudo guardar el mapa editado: "+e.message)}
}
function loadProvMapSnapshot(){
  try{
    const s=localStorage.getItem("basileus_provmap");
    if(!s)return null;
    const snap=JSON.parse(s);
    if(!snap||snap.v!==1||snap.W!==MW||snap.H!==MH||!Array.isArray(snap.rle)||!Array.isArray(snap.provs))return null;
    let tot=0;
    for(let i=1;i<snap.rle.length;i+=2)tot+=snap.rle[i];
    if(tot!==MW*MH)return null;
    return snap;
  }catch(e){return null}
}
function loadProvMap(snap){
  S.rand=mulberry32(193909);
  S.provIdx=new Int16Array(MW*MH).fill(-1);
  let pos=0;
  for(let i=0;i<snap.rle.length;i+=2){
    const pid=snap.rle[i],run=snap.rle[i+1];
    if(pid>=0)S.provIdx.fill(pid,pos,pos+run);
    pos+=run;
  }
  S.provs=snap.provs.map((a,i)=>({id:i,name:a[0],x:a[1],y:a[2],country:0,owner:a[3],owner0:a[3],
    named:!!a[4],coastal:false,morale:60,urban:!!a[5],resType:null,shade:0.85+S.rand()*0.3,capital:!!a[6],
    terrain:(a[7]!=null&&TERRAIN_KEYS[a[7]])||null,
    wasteland:a[8]!=null?!!a[8]:null,
    buildings:newBuildings(),buildQueue:[],recruitQueue:[]}));
  rebuildProvinceData();
  assignTerrain(); // rellena el terreno si la instantánea es antigua y no lo trae
  assignResources();
  let computed=false;
  for(const p of S.provs)if(p.wasteland==null){p.wasteland=p.terrain==="desierto"&&!p.coastal&&!p.named;computed=true}
  if(computed)isolateWastePockets(); // los flags editados a mano se respetan tal cual
  for(const p of S.provs)if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
  if(snap.roads){S.roads=new Set(snap.roads);S.roadQueue=[];S.customRoads=true}
  else S.customRoads=false;
}
function initWorld(){
  const snap=loadProvMapSnapshot();
  if(snap)loadProvMap(snap);
  else generateMap();
}
function regenerateWorld(){
  document.getElementById("loadMsg").style.display="flex";
  document.getElementById("endOverlay").style.display="none";
  setTimeout(()=>{
    S.provs=[];S.armies=[];S.wars=new Set();S.truces=new Map();S.armyIdSeq=1;
    S.player=-1;S.hour=0;acc=0;S.started=false;S.gameOver=false;
    S.selProv=-1;S.selArmy=null;S.battleFlash={};selOutline=null;selOutlineProv=-1;
    shapeSel=-1;shapePoly=[];dragVi=-1;
    document.getElementById("nationChip").innerHTML="";
    initWorld();setupNations();if(!S.customRoads)generateRoads();paintAll();drawRoads();
    document.getElementById("loadMsg").style.display="none";
    if(editMode){
      editBackup=buildSnapshot();editUndoStack=[];editDirty=false;
      refreshEditorPanel();
    }else showNationPicker();
  },30);
}

// --- panel y acciones ---
function refreshEditorPanel(){
  const el=document.getElementById("side");
  let h="<h2>Editor de provincias</h2>";
  const tb=(t,lab)=>"<button class='bbtn' style='flex:1"+(editTool===t?";outline:2px solid #9fb878":"")+"' onclick='setTool(\""+t+"\")'>"+lab+"</button>";
  h+="<div class='row'>"+tb("shape","Formas")+tb("merge","Fusionar")+tb("split","Dividir")+tb("roads","Caminos")+"</div>";
  if(editTool==="shape"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Clic: seleccionar provincia · arrastra un vértice para remodelar · clic sobre un borde: nuevo vértice · clic derecho en un vértice: borrarlo · Esc: deseleccionar. Los cambios se aplican al soltar, pero no se guardan hasta que pulses <b>Guardar cambios</b>.</p>";
  }else if(editTool==="merge"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Arrastra desde una provincia hasta otra: la primera se <b>disuelve dentro</b> de la segunda (que conserva su nombre).</p>";
  }else if(editTool==="roads"){
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>Arrastra entre dos provincias <b>adyacentes</b>: crea el camino si no existe y lo quita si ya existe. Los caminos se resaltan mientras esta herramienta está activa.</p>";
    h+="<div class='row sm'><span>Caminos en el mapa</span><b>"+S.roads.size+"</b></div>";
  }else{
    h+="<p style='font-size:11px;color:#9aa3ad;line-height:1.5'>"+(shapeSel>=0?
      "Arrastra desde un vértice hasta otro <b>no contiguo</b>: la provincia se corta por esa línea y el lado del arrastre se convierte en una provincia nueva.":
      "Primero haz clic en una provincia para seleccionarla; después arrastra de un vértice a otro para cortarla.")+"</p>";
  }
  if(shapeSel>=0&&S.provs[shapeSel]){
    const p=S.provs[shapeSel];
    h+="<h3>"+(p.capital?"★ ":"")+"Provincia seleccionada</h3>";
    h+="<input id='provName' style='width:100%;background:#1c2127;border:1px solid #4a525b;color:#e8e4d8;padding:4px 6px;border-radius:4px' value='"+p.name.replace(/'/g,"&#39;").replace(/"/g,"&quot;")+"' onkeydown=\"if(event.key==='Enter')renameProvince()\">";
    h+="<div class='row' style='margin-top:6px'><button class='bbtn' onclick='renameProvince()'>Renombrar</button><button class='bbtn' onclick='deselectShape()'>Deseleccionar</button></div>";
    h+="<div class='row sm'><span>Nación</span><span>"+NATIONS[p.owner].name+"</span></div>";
    h+="<div class='row sm'><span>Vértices / píxeles</span><span>"+shapePoly.length+" / "+S.pixOfProv[shapeSel].length+"</span></div>";
    h+="<h3>Terreno <span style='font-weight:normal;color:#9aa3ad;font-size:11px'>("+terrainFx(p.terrain)+")</span></h3>";
    h+="<div style='display:flex;flex-wrap:wrap;gap:4px;margin:4px 0'>";
    for(const t of TERRAIN_KEYS){
      h+="<button class='bbtn' style='"+(p.terrain===t?"outline:2px solid #9fb878;":"")+
        "border-left:6px solid "+TERRAINS[t].color+"' onclick='setTerrain(\""+t+"\")'>"+TERRAINS[t].label+"</button>";
    }
    h+="</div>";
    h+="<div class='row'><span>Impracticable</span><button class='bbtn"+(p.wasteland?" red":"")+
      "' onclick='toggleWasteland()'>"+(p.wasteland?"Sí (quitar)":"No (marcar)")+"</button></div>";
  }
  h+="<h3>Cambios</h3>";
  h+=editDirty
    ?"<p style='font-size:11px;color:#d0a050'>Hay cambios sin guardar.</p>"
    :"<p style='font-size:11px;color:#9aa3ad'>Sin cambios pendientes.</p>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='saveChanges()'>Guardar cambios</button></div>";
  if(editUndoStack.length)h+="<div class='row'><button class='bbtn' style='width:100%' onclick='undoEdit()'>Deshacer última edición (Ctrl+Z)</button></div>";
  if(editDirty)h+="<div class='row'><button class='bbtn red' style='width:100%' onclick='discardChanges()'>Descartar y volver al último guardado</button></div>";
  h+="<h3>Mapa</h3>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='toggleTerrainView()'>Vista: "+(terrainView?"Terreno":"Política")+" (cambiar)</button></div>";
  if(loadProvMapSnapshot())h+="<p style='font-size:11px;color:#9fb878'>Jugando sobre un mapa editado (guardado en el navegador).</p>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='downloadMap()'>Descargar mapa editado (JSON)</button></div>";
  h+="<div class='row'><label class='bbtn' style='width:100%;text-align:center'>Importar mapa (JSON)<input type='file' accept='.json,application/json' style='display:none' onchange='importMapFile(this)'></label></div>";
  h+="<div class='row'><button class='bbtn red' style='width:100%' onclick='restoreGenerated()'>Descartar ediciones y regenerar</button></div>";
  h+="<div class='row'><button class='bbtn' style='width:100%' onclick='exitEditorBtn()'>Salir del editor</button></div>";
  el.innerHTML=h;el.style.display="block";
}
window.renameProvince=function(){
  if(shapeSel<0)return;
  const v=document.getElementById("provName").value.trim();
  if(!v||v===S.provs[shapeSel].name)return;
  if(S.provs.some(p=>p.id!==shapeSel&&p.name===v)){alert("Ya existe una provincia con ese nombre.");return}
  pushUndo();
  S.provs[shapeSel].name=v;S.provs[shapeSel].named=true;
  refreshEditorPanel();
};
window.deselectShape=function(){shapeSel=-1;shapePoly=[];dragVi=-1;refreshEditorPanel()};
window.setTerrain=function(t){
  if(shapeSel<0||!TERRAINS[t]||S.provs[shapeSel].terrain===t)return;
  pushUndo();
  S.provs[shapeSel].terrain=t;
  if(terrainView)repaintProvince(shapeSel);
  refreshEditorPanel();
};
window.toggleWasteland=function(){
  if(shapeSel<0)return;
  pushUndo();
  const p=S.provs[shapeSel];
  p.wasteland=!p.wasteland;
  if(p.wasteland){p.owner=NEUTRAL;p.owner0=NEUTRAL;p.capital=false;p.urban=false}
  repaintProvince(shapeSel);
  refreshEditorPanel();
};
window.toggleTerrainView=function(){
  terrainView=!terrainView;
  paintAll();
  document.getElementById("terrBtn").textContent=terrainView?"Político":"Terreno";
  document.getElementById("terrLegend").style.display=terrainView?"block":"none";
  if(editMode)refreshEditorPanel();
};
window.downloadMap=function(){
  const s=JSON.stringify(buildSnapshot());
  const blob=new Blob([s],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="mapa_editado.json";
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(a.href);
};
window.importMapFile=function(input){
  const f=input.files&&input.files[0];
  if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const snap=JSON.parse(rd.result);
      if(!snap||snap.v!==1||snap.W!==MW||snap.H!==MH)throw new Error("formato no válido");
      localStorage.setItem("basileus_provmap",JSON.stringify(snap));
      regenerateWorld();
    }catch(e){alert("No se pudo importar el mapa: "+e.message)}
  };
  rd.readAsText(f);
};
window.restoreGenerated=function(){
  if(!confirm("Se descartará el mapa editado y se regenerará el original. ¿Continuar?"))return;
  try{
    localStorage.removeItem("basileus_provmap");
    localStorage.removeItem("basileus_anchors");
  }catch(e){}
  regenerateWorld();
};
window.exitEditorBtn=exitEditor;

// --- pruebas de impacto sobre el polígono ---
function vertexAt(wx,wy){
  const r=8/zoom;
  let best=-1,bd=r*r;
  for(let i=0;i<shapePoly.length;i++){
    const d=(shapePoly[i][0]-wx)**2+(shapePoly[i][1]-wy)**2;
    if(d<bd){bd=d;best=i}
  }
  return best;
}
function nearestSegment(poly,wx,wy){
  let bi=-1,bd=1e18,bx=0,by=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy||1e-9;
    let t=((wx-a[0])*dx+(wy-a[1])*dy)/L;
    t=Math.max(0,Math.min(1,t));
    const qx=a[0]+dx*t,qy=a[1]+dy*t;
    const d=(qx-wx)**2+(qy-wy)**2;
    if(d<bd){bd=d;bi=i;bx=qx;by=qy}
  }
  return{i:bi,d:Math.sqrt(bd),x:bx,y:by};
}
function drawArrow(x0,y0,x1,y1){
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);
  ctx.strokeStyle="rgba(255,210,74,.95)";ctx.lineWidth=2.2/zoom;ctx.stroke();
  const ang=Math.atan2(y1-y0,x1-x0),s=9/zoom;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x1-Math.cos(ang-0.45)*s,y1-Math.sin(ang-0.45)*s);
  ctx.lineTo(x1-Math.cos(ang+0.45)*s,y1-Math.sin(ang+0.45)*s);
  ctx.closePath();
  ctx.fillStyle="rgba(255,210,74,.95)";ctx.fill();
}
function drawEditorOverlay(){
  if(shapeSel>=0&&shapePoly.length){
    ctx.beginPath();
    ctx.moveTo(shapePoly[0][0],shapePoly[0][1]);
    for(let i=1;i<shapePoly.length;i++)ctx.lineTo(shapePoly[i][0],shapePoly[i][1]);
    ctx.closePath();
    ctx.strokeStyle="rgba(255,255,255,.95)";ctx.lineWidth=1.6/zoom;ctx.stroke();
    const r=3.6/Math.sqrt(zoom);
    for(let i=0;i<shapePoly.length;i++){
      const q=shapePoly[i];
      ctx.fillStyle=i===dragVi?"#ff9c3a":(i===splitFrom?"#ff5c5c":"#ffd24a");
      ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);
      ctx.strokeStyle="#15181c";ctx.lineWidth=1/zoom;
      ctx.strokeRect(q[0]-r,q[1]-r,2*r,2*r);
    }
    if(splitFrom>=0&&splitCur){
      ctx.beginPath();
      ctx.moveTo(shapePoly[splitFrom][0],shapePoly[splitFrom][1]);
      ctx.lineTo(splitCur[0],splitCur[1]);
      ctx.strokeStyle="rgba(255,92,92,.95)";ctx.lineWidth=2/zoom;
      ctx.setLineDash([5/zoom,4/zoom]);ctx.stroke();ctx.setLineDash([]);
    }
  }
  if(mergeFrom>=0&&mergeCur){
    const p=S.provs[mergeFrom];
    drawArrow(p.x,p.y,mergeCur[0],mergeCur[1]);
  }
  if(editTool==="roads"){
    // resaltar la red mientras se edita
    ctx.lineWidth=1.6/zoom;
    ctx.strokeStyle="rgba(255,214,110,.75)";
    for(const k of S.roads){
      const[x,y]=k.split("|").map(Number);
      if(!S.provs[x]||!S.provs[y])continue;
      ctx.beginPath();ctx.moveTo(S.provs[x].x,S.provs[x].y);ctx.lineTo(S.provs[y].x,S.provs[y].y);ctx.stroke();
    }
    if(roadFrom>=0&&roadCur){
      const p=S.provs[roadFrom];
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(roadCur[0],roadCur[1]);
      ctx.strokeStyle="rgba(130,220,130,.9)";ctx.lineWidth=2.2/zoom;
      ctx.setLineDash([6/zoom,5/zoom]);ctx.stroke();ctx.setLineDash([]);
    }
  }
}
document.getElementById("editBtn").addEventListener("click",()=>{editMode?exitEditor():enterEditor()});
document.getElementById("editFromPicker").addEventListener("click",enterEditor);
window.addEventListener("keydown",e=>{
  if(!editMode)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();
    window.undoEdit();
    return;
  }
  if(e.key==="Escape"){
    if(mergeFrom>=0||splitFrom>=0||roadFrom>=0){mergeFrom=-1;mergeCur=null;splitFrom=-1;splitCur=null;roadFrom=-1;roadCur=null;return}
    if(shapeSel>=0){shapeSel=-1;shapePoly=[];dragVi=-1;refreshEditorPanel()}
  }
});

/* ============================= Entrada ============================= */
let dragging=false,dragMoved=false,lastMx=0,lastMy=0;
function evWorld(e){
  const r=canvas.getBoundingClientRect();
  return[(e.clientX-r.left-panX)/zoom,(e.clientY-r.top-panY)/zoom];
}
function provAtWorld(wx,wy){
  const ix=wx|0,iy=wy|0;
  return(ix>=0&&iy>=0&&ix<MW&&iy<MH)?S.provIdx[iy*MW+ix]:-1;
}
canvas.addEventListener("mousedown",e=>{
  if(e.button===0){
    if(editMode){
      const[wx,wy]=evWorld(e);
      if(editTool==="merge"){
        const pid=provAtWorld(wx,wy);
        if(pid>=0){mergeFrom=pid;mergeCur=[wx,wy];return}
      }else if(editTool==="roads"){
        const pid=provAtWorld(wx,wy);
        if(pid>=0&&!S.provs[pid].wasteland){roadFrom=pid;roadCur=[wx,wy];return}
      }else if(editTool==="split"&&shapeSel>=0&&shapePoly.length){
        const vi=vertexAt(wx,wy);
        if(vi>=0){splitFrom=vi;splitCur=[wx,wy];return}
      }else if(editTool==="shape"&&shapeSel>=0&&shapePoly.length){
        const vi=vertexAt(wx,wy);
        if(vi>=0){dragVi=vi;dragWas=[shapePoly[vi][0],shapePoly[vi][1]];dragIns=false;return}
        const seg=nearestSegment(shapePoly,wx,wy);
        if(seg.i>=0&&seg.d<6/zoom){
          shapePoly.splice(seg.i+1,0,[seg.x,seg.y]);
          dragVi=seg.i+1;
          dragWas=[seg.x,seg.y];dragIns=true;
          refreshEditorPanel();
          return;
        }
      }
    }
    dragging=true;dragMoved=false;lastMx=e.clientX;lastMy=e.clientY;
  }
});
window.addEventListener("mousemove",e=>{
  if(dragVi>=0&&shapeSel>=0){
    const[wx,wy]=evWorld(e);
    shapePoly[dragVi][0]=Math.max(0.5,Math.min(MW-0.5,wx));
    shapePoly[dragVi][1]=Math.max(0.5,Math.min(MH-0.5,wy));
    return;
  }
  if(mergeFrom>=0){mergeCur=evWorld(e);return}
  if(roadFrom>=0){roadCur=evWorld(e);return}
  if(splitFrom>=0){splitCur=evWorld(e);return}
  if(!dragging)return;
  const dx=e.clientX-lastMx,dy=e.clientY-lastMy;
  if(Math.abs(dx)+Math.abs(dy)>3)dragMoved=true;
  if(dragMoved){panX+=dx;panY+=dy;clampPan()}
  lastMx=e.clientX;lastMy=e.clientY;
});
window.addEventListener("mouseup",e=>{
  if(e.button!==0)return;
  if(dragVi>=0){
    const vi=dragVi;dragVi=-1;
    const moved=!dragWas||shapePoly[vi][0]!==dragWas[0]||shapePoly[vi][1]!==dragWas[1];
    if(!moved){
      if(dragIns)shapePoly.splice(vi,1); // clic sin arrastre sobre un borde: no insertar
      dragWas=null;dragIns=false;
      refreshEditorPanel();
      return;
    }
    dragWas=null;dragIns=false;
    applyShape(shapeSel,shapePoly);
    shapePoly=traceProvince(shapeSel);
    refreshEditorPanel();
    return;
  }
  if(mergeFrom>=0){
    const from=mergeFrom;
    mergeFrom=-1;mergeCur=null;
    const[wx,wy]=evWorld(e);
    const pid=provAtWorld(wx,wy);
    if(pid>=0&&pid!==from)mergeProvinces(from,pid);
    return;
  }
  if(roadFrom>=0){
    const from=roadFrom;
    roadFrom=-1;roadCur=null;
    const[wx,wy]=evWorld(e);
    const pid=provAtWorld(wx,wy);
    if(pid>=0&&pid!==from&&!S.provs[pid].wasteland)toggleRoadEdit(from,pid);
    return;
  }
  if(splitFrom>=0){
    const from=splitFrom;
    splitFrom=-1;splitCur=null;
    const[wx,wy]=evWorld(e);
    const vi=vertexAt(wx,wy);
    if(vi>=0&&vi!==from&&shapeSel>=0){
      const n=shapePoly.length;
      const ringDist=Math.min((vi-from+n)%n,(from-vi+n)%n);
      if(ringDist>=2)splitProvince(shapeSel,shapePoly,from,vi);
      else alert("Elige dos vértices no contiguos.");
    }
    return;
  }
  const wasDrag=dragMoved;dragging=false;
  if(editMode){
    if(wasDrag||e.target!==canvas)return;
    const[ewx,ewy]=evWorld(e);
    const pid=provAtWorld(ewx,ewy);
    if(pid>=0){shapeSel=pid;shapePoly=traceProvince(pid)}
    else{shapeSel=-1;shapePoly=[]}
    refreshEditorPanel();
    return;
  }
  if(wasDrag||!S.started)return;
  const r=canvas.getBoundingClientRect();
  if(e.target!==canvas)return;
  const wx=(e.clientX-r.left-panX)/zoom, wy=(e.clientY-r.top-panY)/zoom;
  // ejército propio cerca
  let hit=null,hd=28*28;
  for(const a of S.armies){
    const pos=armyPos(a);
    const d=(pos.x-wx)**2+(pos.y-wy)**2;
    if(d<hd){hd=d;hit=a}
  }
  if(hit&&hit.nation===S.player){S.selArmy=hit;S.selProv=-1;refreshSide();return}
  const ix=wx|0,iy=wy|0;
  if(ix>=0&&iy>=0&&ix<MW&&iy<MH&&S.provIdx[iy*MW+ix]>=0){
    S.selProv=S.provIdx[iy*MW+ix];S.selArmy=null;
  }else{S.selProv=-1;S.selArmy=null}
  refreshSide();
});
canvas.addEventListener("contextmenu",e=>{
  e.preventDefault();
  if(editMode){
    if(shapeSel>=0&&shapePoly.length>3){
      const r=canvas.getBoundingClientRect();
      const wx=(e.clientX-r.left-panX)/zoom, wy=(e.clientY-r.top-panY)/zoom;
      const vi=vertexAt(wx,wy);
      if(vi>=0){
        shapePoly.splice(vi,1);
        applyShape(shapeSel,shapePoly);
        shapePoly=traceProvince(shapeSel);
        refreshEditorPanel();
      }
    }
    return;
  }
  if(!S.started||!S.selArmy||S.selArmy.nation!==S.player)return;
  const r=canvas.getBoundingClientRect();
  const wx=(e.clientX-r.left-panX)/zoom, wy=(e.clientY-r.top-panY)/zoom;
  const ix=wx|0,iy=wy|0;
  if(ix<0||iy<0||ix>=MW||iy>=MH)return;
  const t=S.provIdx[iy*MW+ix];
  if(t<0)return;
  if(orderMove(S.selArmy,t)){
    const tp=S.provs[t];
    if(tp.owner!==S.player&&tp.owner<NPLAY&&!atWar(S.player,tp.owner))
      log("Aviso: entrar en "+NATIONS[tp.owner].name+" declarará la guerra.");
    refreshSide();
  }
});
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  const mx=e.clientX-r.left,my=e.clientY-r.top;
  const old=zoom;
  zoom=Math.max(0.35,Math.min(5,zoom*(e.deltaY<0?1.15:0.87)));
  panX=mx-(mx-panX)*zoom/old;
  panY=my-(my-panY)*zoom/old;
  clampPan();
},{passive:false});

document.querySelectorAll(".spdBtn").forEach(b=>b.addEventListener("click",()=>{
  S.speed=+b.dataset.s;
  document.querySelectorAll(".spdBtn").forEach(x=>x.classList.toggle("active",x===b));
}));
document.getElementById("helpBtn").addEventListener("click",()=>document.getElementById("helpOverlay").style.display="flex");
document.getElementById("dipBtn").addEventListener("click",()=>{refreshDiplomacy();document.getElementById("dipOverlay").style.display="flex"});
document.getElementById("terrBtn").addEventListener("click",()=>window.toggleTerrainView());
{
  let lh="<b style='font-size:12px'>Terrenos</b>";
  for(const k of TERRAIN_KEYS){
    lh+="<div class='row' style='margin:2px 0'><span><span class='chip' style='background:"+TERRAINS[k].color+
      "'></span> "+TERRAINS[k].label+"</span><span style='color:#9aa3ad;font-size:10px'>"+terrainFx(k)+"</span></div>";
  }
  document.getElementById("terrLegend").innerHTML=lh;
}

/* ============================= Dibujo ============================= */
function armyPos(a){
  const p=S.provs[a.prov];
  if(a.path.length&&a.legTotal>0){
    const t=S.provs[a.path[0]];
    const f=Math.min(1,a.legDone/a.legTotal);
    return{x:p.x+(t.x-p.x)*f,y:p.y+(t.y-p.y)*f};
  }
  const here=S.armies.filter(x=>x.prov===a.prov&&!x.path.length);
  const idx=here.indexOf(a);
  if(idx>0){
    const ang=idx*2.1;
    return{x:p.x+Math.cos(ang)*26,y:p.y+Math.sin(ang)*26};
  }
  return{x:p.x,y:p.y};
}
let selOutline=null,selOutlineProv=-1;
function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle="#27384a";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(zoom,0,0,zoom,panX,panY);
  ctx.imageSmoothingEnabled=zoom<1.5;
  ctx.drawImage(baseC,0,0);
  ctx.drawImage(roadsC,0,0);
  ctx.drawImage(borderC,0,0);
  // contorno de provincia seleccionada
  if(S.selProv>=0){
    if(selOutlineProv!==S.selProv){
      selOutline=document.createElement("canvas");selOutline.width=MW;selOutline.height=MH;
      const c2=selOutline.getContext("2d");
      const im=c2.createImageData(MW,MH);
      for(const i of S.borderPxOfProv[S.selProv]){const o=i*4;im.data[o]=255;im.data[o+1]=255;im.data[o+2]=255;im.data[o+3]=230}
      c2.putImageData(im,0,0);
      selOutlineProv=S.selProv;
    }
    ctx.drawImage(selOutline,0,0);
  }
  if(editMode){
    drawEditorOverlay();
    requestAnimationFrame(draw);
    return;
  }
  // capitales
  for(const p of S.provs){
    if(!p.capital)continue;
    ctx.beginPath();ctx.arc(p.x,p.y-24,8,0,7);
    ctx.fillStyle="#f0e6c8";ctx.fill();
    ctx.strokeStyle="#222";ctx.lineWidth=1.5/zoom;ctx.stroke();
  }
  // flecha de orden del ejército seleccionado
  if(S.selArmy&&S.selArmy.path.length){
    const pos=armyPos(S.selArmy);
    ctx.beginPath();ctx.moveTo(pos.x,pos.y);
    for(const pid of S.selArmy.path)ctx.lineTo(S.provs[pid].x,S.provs[pid].y);
    ctx.strokeStyle="rgba(255,255,255,.65)";ctx.lineWidth=2/zoom;
    ctx.setLineDash([6/zoom,4/zoom]);ctx.stroke();ctx.setLineDash([]);
  }
  // combates
  for(const pid in S.battleFlash){
    if(S.hour-S.battleFlash[pid]>2)continue;
    const p=S.provs[pid];
    const r=16+6*Math.sin(performance.now()/150);
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);
    ctx.strokeStyle="rgba(255,80,50,.9)";ctx.lineWidth=2.5/zoom;ctx.stroke();
  }
  // ejércitos
  ctx.textAlign="center";ctx.textBaseline="middle";
  for(const a of S.armies){
    const pos=armyPos(a);
    const w=40,hh=26;
    ctx.fillStyle=NATIONS[a.nation].color;
    ctx.fillRect(pos.x-w/2,pos.y-hh/2,w,hh);
    ctx.lineWidth=(a===S.selArmy?4.8:2)/Math.max(1,zoom*0.7);
    ctx.strokeStyle=a===S.selArmy?"#fff":(a.nation===S.player?"#ffe9a0":"#15181c");
    ctx.strokeRect(pos.x-w/2,pos.y-hh/2,w,hh);
    ctx.fillStyle="#fff";ctx.font="bold 18px Arial";
    ctx.fillText(Math.round(armyCount(a)),pos.x,pos.y+1);
  }
  requestAnimationFrame(draw);
}

/* ============================= Bucle de simulación ============================= */
// Ritmo real: a 1x, 1 hora real = 1 mes de juego (12 h reales = 1 año; la partida
// completa, 1444-1544, dura ~50 días reales). 60x y 720x son velocidades de prueba.
const GH_PER_SEC=730.5/3600; // horas de juego por segundo real a 1x
setInterval(()=>{
  if(!S.started||S.gameOver)return;
  acc+=S.speed*GH_PER_SEC/4;
  let steps=0;
  while(acc>=1&&steps<60){acc-=1;hourTick();steps++}
  if(steps){refreshTop();refreshSide()}
},250);

/* ============================= Partida guardada ============================= */
// La campaña dura ~50 días reales: se guarda sola (cada día de juego y al cerrar)
// y al volver el mundo se pone al día con el tiempo real transcurrido (máx. 1 año de juego).
function saveGame(){
  if(!S.started||S.gameOver||S.player<0)return;
  try{
    const s={v:2,t:Date.now(),hour:S.hour,player:S.player,armyIdSeq:S.armyIdSeq,
      wars:[...S.wars],truces:[...S.truces],roads:[...S.roads],roadQueue:S.roadQueue,
      nations:S.nations.map(x=>({res:x.res,mano:x.mano,ai:x.ai,capital:x.capital,alive:x.alive,startProvs:x.startProvs})),
      provs:S.provs.map(p=>[p.owner,Math.round(p.morale*10)/10,p.buildings,p.buildQueue,p.recruitQueue]),
      armies:S.armies.map(a=>({id:a.id,nation:a.nation,prov:a.prov,units:a.units,path:a.path,legDone:a.legDone,legTotal:a.legTotal})),
      mapCheck:S.provs.length+"|"+S.provs[0].name};
    localStorage.setItem("basileus_save",JSON.stringify(s));
  }catch(e){}
}
function loadSaveMeta(){
  try{
    const s=JSON.parse(localStorage.getItem("basileus_save"));
    if(!s||s.v!==2||s.mapCheck!==S.provs.length+"|"+S.provs[0].name)return null;
    return s;
  }catch(e){return null}
}
function continueGame(){
  const s=loadSaveMeta();
  if(!s)return;
  S.hour=s.hour;S.player=s.player;S.armyIdSeq=s.armyIdSeq;
  S.wars=new Set(s.wars);S.truces=new Map(s.truces);
  S.roads=new Set(s.roads);S.roadQueue=s.roadQueue||[];
  s.nations.forEach((x,i)=>Object.assign(S.nations[i],x));
  s.provs.forEach((d,i)=>{
    const p=S.provs[i];
    p.owner=d[0];p.morale=d[1];
    p.buildings=Object.assign(newBuildings(),d[2]||{});
    p.buildQueue=d[3]||[];p.recruitQueue=d[4]||[];
  });
  S.armies=s.armies;
  S.nations[S.player].ai=false;
  S.started=true;S.gameOver=false;S.selProv=-1;S.selArmy=null;S.battleFlash={};
  document.getElementById("startOverlay").style.display="none";
  document.getElementById("nationChip").innerHTML=
    "<span class='chip' style='background:"+NATIONS[S.player].color+"'></span>"+NATIONS[S.player].name;
  paintAll();drawRoads();
  const cap=S.provs[S.nations[S.player].capital];
  if(cap){panX=canvas.width/2-cap.x*zoom;panY=canvas.height/2-cap.y*zoom;clampPan()}
  refreshTop();
  // puesta al día: el mundo siguió su curso mientras no estabas
  const missed=Math.min(8760,Math.floor((Date.now()-s.t)/1000*GH_PER_SEC));
  if(missed>24)runCatchup(missed);
  else log("Partida retomada. Bienvenido de nuevo, soberano.");
}
function runCatchup(ticks){
  const msg=document.getElementById("loadMsg");
  msg.style.display="flex";
  const total=ticks;
  const wasSpeed=S.speed;S.speed=0;
  (function step(){
    const n=Math.min(600,ticks);
    for(let i=0;i<n&&!S.gameOver;i++)hourTick();
    ticks-=n;
    msg.textContent="El mundo avanzó en tu ausencia… "+Math.round((1-ticks/total)*100)+"% ("+fmtDur(total-ticks)+" de juego)";
    if(ticks>0&&!S.gameOver)setTimeout(step,0);
    else{
      msg.style.display="none";
      S.speed=wasSpeed;
      refreshTop();refreshSide();
      saveGame();
      log("Han pasado "+fmtDur(total)+" desde tu última visita.");
    }
  })();
}
window.addEventListener("beforeunload",saveGame);

/* ============================= Arranque ============================= */
function showNationPicker(){
  const grid=document.getElementById("nationGrid");
  let h="";
  const sv=loadSaveMeta();
  if(sv){
    const d=new Date(START_DATE+sv.hour*3600e3);
    h+="<div class='ncard' id='continueCard' style='grid-column:1/-1;border-color:#9fb878'>"+
      "<b>▶ Continuar partida</b><span>"+NATIONS[sv.player].name+" · "+d.getUTCDate()+" "+MESES[d.getUTCMonth()]+" "+d.getUTCFullYear()+"</span></div>";
  }
  for(let n=0;n<NPLAY;n++){
    h+="<div class='ncard' data-n='"+n+"'><span class='chip' style='background:"+NATIONS[n].color+"'></span>"+
      "<b>"+NATIONS[n].name+"</b><span>"+nationProvCount(n)+" provincias</span></div>";
  }
  grid.innerHTML=h;
  grid.querySelectorAll(".ncard").forEach(c=>c.addEventListener("click",()=>{
    if(c.id==="continueCard"){
      document.getElementById("startOverlay").style.display="none";
      continueGame();
      return;
    }
    if(sv&&!confirm("Empezar una partida nueva descartará la guardada. ¿Continuar?"))return;
    try{localStorage.removeItem("basileus_save")}catch(e){}
    S.player=+c.dataset.n;
    S.nations[S.player].ai=false;
    document.getElementById("startOverlay").style.display="none";
    document.getElementById("nationChip").innerHTML=
      "<span class='chip' style='background:"+NATIONS[S.player].color+"'></span>"+NATIONS[S.player].name;
    S.started=true;
    const cap=S.provs[S.nations[S.player].capital];
    panX=canvas.width/2-cap.x*zoom;panY=canvas.height/2-cap.y*zoom;clampPan();
    S.selProv=cap.id;refreshSide();refreshTop();
    log("Has tomado el mando de "+NATIONS[S.player].name+". Capital: "+cap.name+".");
  }));
  document.getElementById("startOverlay").style.display="flex";
}
function init(){
  try{
    fitCanvas();
    initWorld();
    setupNations();
    if(!S.customRoads)generateRoads();
    paintAll();
    drawRoads();
    zoom=Math.max(0.35,Math.min(canvas.width/MW,canvas.height/MH));
    panX=(canvas.width-MW*zoom)/2;panY=(canvas.height-MH*zoom)/2;
    document.getElementById("loadMsg").style.display="none";
    showNationPicker();
    refreshTop();
    requestAnimationFrame(draw);
  }catch(err){
    document.getElementById("loadMsg").textContent="Error al generar el mapa: "+err.message;
    console.error(err);
  }
}
setTimeout(init,30);
