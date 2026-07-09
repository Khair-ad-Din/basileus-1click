// Genera mapdata.js — Europa 1444 estilo EU4.
// Masa terrestre: Natural Earth 1:110m (data/countries.geo.json).
// Fronteras de 1444: Voronoi sobre anclas históricas (ciudades de época) por nación.
// Uso: node build_map.mjs
import fs from "fs";

const WEST=-11, EAST=50, SOUTH=27, NORTH=66.5;
const MH=920;
const mercY=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const YN=mercY(NORTH), YS=mercY(SOUTH);
const MW=Math.round(MH*((EAST-WEST)*Math.PI/180)/(YN-YS));
const px=lon=>(lon-WEST)/(EAST-WEST)*MW;
const py=lat=>(YN-mercY(lat))/(YN-YS)*MH;

// Países modernos usados solo como máscara de tierra
const LAND_ISOS=["DEU","AUT","CZE","SVK","FRA","DZA","TUN","GBR","EGY","CYP","ITA","ALB","LBY",
  "RUS","UKR","BLR","GEO","ARM","AZE","POL","ESP","TUR","PRT","IRL","BEL","NLD","LUX","DNK",
  "NOR","SWE","FIN","EST","LVA","LTU","CHE","HUN","ROU","BGR","GRC","SVN","HRV","BIH","SRB",
  "MNE","MKD","MDA","MAR","SYR","LBN","ISR","JOR","IRQ","SAU","IRN","KWT","MLT"];
const LAND_NAMES=["Northern Cyprus"]; // piezas con id "-99"

// Naciones de 1444 (estilo EU4): [nombre, color, [[ciudad,lat,lon],...]] — la primera ancla es la capital.
const NATIONS1444=[
  ["Castilla","#c8a838",[["Toledo",39.86,-4.03],["Burgos",42.34,-3.70],["León",42.60,-5.57],["Sevilla",37.39,-5.99],["Murcia",37.99,-1.13],["Santiago",42.88,-8.54],["Bilbao",43.26,-2.93],["Badajoz",38.88,-6.97]]],
  ["Aragón","#c87060",[["Zaragoza",41.65,-0.88],["Barcelona",41.39,2.17],["Valencia",39.47,-0.38],["Palma",39.57,2.65],["Cagliari",39.22,9.12],["Palermo",38.12,13.36],["Mesina",38.19,15.55]]],
  ["Portugal","#2e7d4f",[["Lisboa",38.72,-9.14],["Oporto",41.15,-8.61],["Faro",37.02,-7.93]]],
  ["Granada","#8b2635",[["Granada",37.18,-3.60],["Málaga",36.72,-4.42],["Almería",36.83,-2.46]]],
  ["Navarra","#d4c25a",[["Pamplona",42.82,-1.64]]],
  ["Francia","#4a66b8",[["París",48.85,2.35],["Orleans",47.90,1.90],["Reims",49.26,4.03],["Lyon",45.76,4.84],["Tolosa",43.60,1.44],["Poitiers",46.58,0.34],["Montpellier",43.61,3.88],["La Rochelle",46.16,-1.15],["Bourges",47.08,2.40]]],
  ["Inglaterra","#b84848",[["Londres",51.51,-0.13],["York",53.96,-1.08],["Bristol",51.45,-2.59],["Norwich",52.63,1.30],["Ruan",49.44,1.10],["Burdeos",44.84,-0.58],["Calais",50.95,1.85]]],
  ["Escocia","#4a5a9e",[["Edimburgo",55.95,-3.19],["Aberdeen",57.15,-2.09],["Inverness",57.48,-4.22]]],
  ["Irlanda","#3f8f4f",[["Dublín",53.35,-6.26],["Cork",51.90,-8.47],["Galway",53.27,-9.05]]],
  ["Borgoña","#75406e",[["Dijon",47.32,5.04],["Bruselas",50.85,4.35],["Brujas",51.21,3.22],["Ámsterdam",52.37,4.90],["Luxemburgo",49.61,6.13],["Arrás",50.29,2.78]]],
  ["Bretaña","#8a93a6",[["Rennes",48.11,-1.68],["Nantes",47.22,-1.55],["Brest",48.39,-4.49]]],
  ["Provenza","#b8763a",[["Aix",43.53,5.45],["Aviñón",43.95,4.81]]],
  ["Saboya","#5d7ab0",[["Chambéry",45.57,5.92],["Turín",45.07,7.69],["Niza",43.70,7.27]]],
  ["Austria","#d9d9d0",[["Viena",48.21,16.37],["Graz",47.07,15.44],["Innsbruck",47.27,11.39],["Trieste",45.65,13.78]]],
  ["Bohemia","#6878a8",[["Praga",50.08,14.43],["Brno",49.20,16.61],["Breslavia",51.11,17.04]]],
  ["Brandeburgo","#768089",[["Berlín",52.52,13.40],["Fráncfort del Óder",52.35,14.55]]],
  ["Sajonia","#7a9a45",[["Dresde",51.05,13.74],["Leipzig",51.34,12.37]]],
  ["Baviera","#6fa3d6",[["Múnich",48.14,11.58],["Ratisbona",49.02,12.10],["Núremberg",49.45,11.08]]],
  ["Renania","#a8a070",[["Colonia",50.94,6.96],["Fráncfort",50.11,8.68],["Estrasburgo",48.57,7.75],["Maguncia",50.00,8.27]]],
  ["Hansa","#aa5742",[["Lübeck",53.87,10.69],["Hamburgo",53.55,10.00],["Bremen",53.08,8.80],["Hannover",52.37,9.73]]],
  ["Pomerania","#708898",[["Estetino",53.43,14.55],["Rostock",54.09,12.10]]],
  ["Suiza","#b8b84a",[["Berna",46.95,7.45],["Zúrich",47.37,8.54]]],
  ["Venecia","#2f9e8e",[["Venecia",45.44,12.34],["Verona",45.44,10.99],["Zara",44.12,15.23],["Candía",35.34,25.13],["Corfú",39.62,19.92]]],
  ["Milán","#5f7d3a",[["Milán",45.46,9.19],["Parma",44.80,10.33]]],
  ["Génova","#993647",[["Génova",44.41,8.93],["Bastia",42.70,9.45]]],
  ["Florencia","#d6a24a",[["Florencia",43.77,11.26],["Pisa",43.72,10.40]]],
  ["Estados Pontificios","#d8d49a",[["Roma",41.90,12.50],["Bolonia",44.49,11.34],["Ancona",43.62,13.51]]],
  ["Nápoles","#bfae74",[["Nápoles",40.85,14.27],["Bari",41.13,16.87],["Taranto",40.47,17.23],["Cosenza",39.30,16.25]]],
  ["Ragusa","#d0d0e8",[["Ragusa",42.65,18.09]]],
  ["Unión de Kalmar","#9e3c3c",[["Copenhague",55.68,12.57],["Oslo",59.91,10.75],["Bergen",60.39,5.32],["Estocolmo",59.33,18.07],["Åbo",60.45,22.27],["Trondheim",63.43,10.40],["Víborg",60.71,28.73]]],
  ["Orden Teutónica","#cfcfc4",[["Marienburgo",54.04,19.03],["Königsberg",54.71,20.45],["Danzig",54.35,18.65]]],
  ["Orden Livona","#b3b394",[["Riga",56.95,24.11],["Reval",59.44,24.75]]],
  ["Lituania","#7d6745",[["Vilna",54.69,25.28],["Minsk",53.90,27.56],["Kiev",50.45,30.52],["Smolensk",54.78,32.05],["Lutsk",50.75,25.34],["Poltava",49.59,34.55],["Chernígov",51.49,31.30]]],
  ["Polonia","#c8809a",[["Cracovia",50.06,19.94],["Varsovia",52.23,21.01],["Poznán",52.41,16.93],["Lublin",51.25,22.57],["Leópolis",49.84,24.03]]],
  ["Moscovia","#3f6045",[["Moscú",55.76,37.62],["Vologda",59.22,39.88],["Riazán",54.63,39.74],["Nizhni Nóvgorod",56.33,44.00]]],
  ["Nóvgorod","#5f8585",[["Nóvgorod",58.52,31.27],["Pskov",57.82,28.33],["Arcángel",64.54,40.52],["Petrozavodsk",61.78,34.35]]],
  ["Gran Horda","#8f7a4f",[["Sarai",48.50,45.00],["Azov",47.11,39.42],["Astracán",46.35,48.04],["Voronezh",51.67,39.21]]],
  ["Kanato de Crimea","#6f9e6f",[["Bajchisarái",44.75,33.86],["Perekop",46.16,33.70]]],
  ["Kanato de Kazán","#85a045",[["Kazán",55.79,49.11]]],
  ["Hungría","#57a857",[["Buda",47.50,19.04],["Presburgo",48.15,17.11],["Cluj",46.77,23.60],["Zagreb",45.81,15.98],["Belgrado",44.79,20.45],["Debrecen",47.53,21.62]]],
  ["Serbia","#8d8d8d",[["Smederevo",44.66,20.93],["Niš",43.32,21.90],["Pristina",42.66,21.17]]],
  ["Bosnia","#6f7f93",[["Sarajevo",43.86,18.41],["Mostar",43.34,17.81]]],
  ["Albania","#a04545",[["Krujë",41.51,19.79]]],
  ["Valaquia","#b08035",[["Târgoviste",44.93,25.46],["Craiova",44.32,23.80]]],
  ["Moldavia","#a8a845",[["Suceava",47.65,26.26],["Chisináu",47.01,28.86],["Cetatea Albă",46.20,30.35]]],
  ["Imperio Bizantino","#8a5fc0",[["Constantinopla",41.01,28.98],["Mistra",37.07,22.43],["Atenas",37.98,23.73]]],
  ["Imperio Otomano","#4a8a4a",[["Adrianópolis",41.68,26.56],["Bursa",40.18,29.07],["Ankara",39.93,32.86],["Salónica",40.64,22.93],["Sofía",42.70,23.32],["Üsküp",42.00,21.43],["Plovdiv",42.14,24.75]]],
  ["Karamán","#c0a445",[["Konya",37.87,32.49],["Adana",37.00,35.32]]],
  ["Trebisonda","#b070a0",[["Trebisonda",41.00,39.72],["Sinope",42.03,35.15]]],
  ["Chipre","#7fa3c8",[["Nicosia",35.17,33.36]]],
  ["Caballeros de Rodas","#c8c8e0",[["Rodas",36.44,28.22]]],
  ["Georgia","#c06585",[["Tiflis",41.72,44.78],["Kutaisi",42.27,42.70]]],
  ["Aq Qoyunlu","#cac2ae",[["Diyarbakır",37.91,40.24],["Van",38.50,43.38],["Mardin",37.31,40.74]]],
  ["Qara Qoyunlu","#50505c",[["Tabriz",38.07,46.30],["Bagdad",33.34,44.40],["Ereván",40.18,44.51],["Mosul",36.34,43.13],["Basora",30.51,47.78]]],
  ["Timúridas","#86a886",[["Hamadán",34.80,48.51],["Sultaniya",36.43,48.79]]],
  ["Mamelucos","#d2c878",[["El Cairo",30.04,31.24],["Alejandría",31.20,29.92],["Damasco",33.51,36.29],["Jerusalén",31.78,35.22],["Alepo",36.20,37.13],["Ammán",31.95,35.93],["Suez",29.97,32.55],["Bengasi",32.12,20.07]]],
  ["Tribus beduinas","#a89868",[["Ha'il",27.52,41.69],["Dumat al-Yandal",29.79,40.10],["Tabuk",28.38,36.57]]],
  ["Túnez","#b0a890",[["Túnez",36.81,10.18],["Constantina",36.36,6.61],["Trípoli",32.89,13.19],["Kairuán",35.68,10.10]]],
  ["Tlemcen","#a08050",[["Tlemcen",34.88,-1.31],["Argel",36.75,3.06],["Orán",35.70,-0.65]]],
  ["Marruecos","#b06030",[["Fez",34.03,-5.00],["Marrakech",31.63,-8.00],["Tánger",35.77,-5.80]]]
];

const geo=JSON.parse(fs.readFileSync("data/countries.geo.json","utf8"));
const features=geo.features.filter(f=>LAND_ISOS.includes(f.id)||LAND_NAMES.includes(f.properties.name));
console.log("Piezas de tierra:",features.length);

// 1. máscara de tierra
const land=new Uint8Array(MW*MH);
for(const f of features){
  const g=f.geometry;
  const polys=g.type==="Polygon"?[g.coordinates]:g.coordinates;
  for(const rings of polys){
    const pr=rings.map(r=>r.map(([lon,lat])=>[px(lon),py(lat)]));
    let minY=1e9,maxY=-1e9;
    for(const r of pr)for(const p of r){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])}
    const y0=Math.max(0,Math.ceil(minY)),y1=Math.min(MH-1,Math.floor(maxY));
    for(let y=y0;y<=y1;y++){
      const yc=y+0.5,xs=[];
      for(const r of pr)for(let i=0;i<r.length-1;i++){
        const[ax,ay]=r[i],[bx,by]=r[i+1];
        if((ay>yc)!==(by>yc))xs.push(ax+(yc-ay)/(by-ay)*(bx-ax));
      }
      xs.sort((a,b)=>a-b);
      for(let k=0;k+1<xs.length;k+=2){
        const xa=Math.max(0,Math.ceil(xs[k]-0.5)),xb=Math.min(MW-1,Math.floor(xs[k+1]-0.5));
        for(let x=xa;x<=xb;x++)land[y*MW+x]=1;
      }
    }
  }
}

// 2. rellenar agujeros interiores pequeños (Kosovo, etc.): mar no conectado al borde y < 2500 px
{
  const reach=new Uint8Array(MW*MH);
  const q=[];
  for(let x=0;x<MW;x++){q.push(x,(MH-1)*MW+x)}
  for(let y=0;y<MH;y++){q.push(y*MW,y*MW+MW-1)}
  for(const i of q)if(!land[i])reach[i]=1;
  while(q.length){
    const i=q.pop();
    if(land[i]||!reach[i])continue;
    const x=i%MW,y=(i/MW)|0;
    for(const j of[i-1,i+1,i-MW,i+MW]){
      if(j<0||j>=MW*MH)continue;
      if(Math.abs((j%MW)-x)>1)continue;
      if(!land[j]&&!reach[j]){reach[j]=1;q.push(j)}
    }
  }
  // componentes de mar no alcanzadas
  const compId=new Int32Array(MW*MH).fill(-1);
  let holes=0;
  for(let i=0;i<MW*MH;i++){
    if(land[i]||reach[i]||compId[i]>=0)continue;
    const comp=[i];compId[i]=1;
    for(let h=0;h<comp.length;h++){
      const c=comp[h],x=c%MW;
      for(const j of[c-1,c+1,c-MW,c+MW]){
        if(j<0||j>=MW*MH)continue;
        if(Math.abs((j%MW)-x)>1)continue;
        if(!land[j]&&!reach[j]&&compId[j]<0){compId[j]=1;comp.push(j)}
      }
    }
    if(comp.length<2500){for(const c of comp)land[c]=1;holes++}
  }
  console.log("Agujeros rellenados:",holes);
}

// 3. asignar nación de 1444 por ancla más cercana
const anchors=[];
NATIONS1444.forEach(([name,color,list],ni)=>{
  list.forEach(([cn,lat,lon],ai)=>anchors.push({x:px(lon),y:py(lat),n:ni,name:cn,cap:ai===0?1:0}));
});
console.log("Naciones:",NATIONS1444.length,"· anclas:",anchors.length);
const grid=new Uint8Array(MW*MH); // 0 = mar, 1.. = nación+1
for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
  const i=y*MW+x;
  if(!land[i])continue;
  let best=-1,bd=1e18;
  for(let a=0;a<anchors.length;a++){
    const dx=anchors[a].x-x,dy=anchors[a].y-y,d=dx*dx+dy*dy;
    if(d<bd){bd=d;best=a}
  }
  grid[i]=anchors[best].n+1;
}

// 4. RLE
const ALPHA="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@^_{}|~";
if(NATIONS1444.length+1>ALPHA.length)throw new Error("Demasiadas naciones para el alfabeto RLE");
let rle="",cur=grid[0],run=1;
for(let i=1;i<grid.length;i++){
  if(grid[i]===cur)run++;
  else{rle+=ALPHA[cur]+run;cur=grid[i];run=1}
}
rle+=ALPHA[cur]+run;

// 5. ciudades = anclas (ancladas al píxel más cercano de su nación)
const cities=[];
for(const a of anchors){
  let x=Math.round(a.x),y=Math.round(a.y);
  const want=a.n+1;
  let fx=-1,fy=-1,bd=1e9;
  for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){
    const nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
    if(grid[ny*MW+nx]===want){const d=dx*dx+dy*dy;if(d<bd){bd=d;fx=nx;fy=ny}}
  }
  if(fx<0){console.warn("Ancla sin tierra de su nación:",a.name);continue}
  cities.push([a.name,fx,fy,want,a.cap]);
}

const landCount=land.reduce((s,v)=>s+v,0);
console.log(`Mapa ${MW}x${MH}, tierra ${(100*landCount/grid.length).toFixed(1)}%, RLE ${(rle.length/1024).toFixed(1)} KB, ciudades ${cities.length}`);

const out="const MAPDATA="+JSON.stringify({
  W:MW,H:MH,
  nations:NATIONS1444.map(([name,color])=>({name,color})),
  countries:NATIONS1444.map((_,i)=>({nation:i})),
  rle,cities
})+";\n";
fs.writeFileSync("mapdata.js",out);
console.log("mapdata.js escrito.");
