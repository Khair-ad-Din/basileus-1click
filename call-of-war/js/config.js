// config.js — datos de diseno del juego (recursos, edificios, unidades, terrenos,
// naciones). Datos puros; MAPDATA es un global de mapdata.js (script clasico previo).

/* ============================= Constantes ============================= */
const MW=MAPDATA.W,MH=MAPDATA.H;
const NATIONS=MAPDATA.nations.map(n=>({name:n.name,color:n.color}));
NATIONS.push({name:"Independientes",color:"#8d8d84",neutral:true});
const NPLAY=MAPDATA.nations.length;
const NEUTRAL=NPLAY;
// Recursos estratégicos (los produce mucha gente, se gastan en construir y sostener)
// y bienes de comercio/lujo (regionales, solo ciertas zonas): base del futuro comercio.
const RES_KEYS=["dinero","comida","materiales","piedra","metal","petroleo","raros","pano","vino","sal","seda"];
const RES_STRAT=["dinero","comida","materiales","piedra","metal","petroleo"];
const RES_TRADE=["raros","pano","vino","sal","seda"];
const RES_LABEL={dinero:"Ducados",comida:"Grano",materiales:"Madera",piedra:"Piedra",metal:"Hierro",petroleo:"Caballos",
  raros:"Especias",pano:"Paño",vino:"Vino",sal:"Sal",seda:"Seda"};
const RES_SHORT={dinero:"Duc",comida:"Gra",materiales:"Mad",piedra:"Pie",metal:"Hie",petroleo:"Cab",
  raros:"Esp",pano:"Pañ",vino:"Vin",sal:"Sal",seda:"Sed"};
const RES_ICON={dinero:"🪙",comida:"🌾",materiales:"🪵",piedra:"🪨",metal:"⛓",petroleo:"🐎",
  raros:"🌶",pano:"🧵",vino:"🍷",sal:"🧂",seda:"🎗"};
const START_STOCK={dinero:5000,comida:3000,materiales:4000,piedra:2500,metal:2500,petroleo:1500,
  raros:800,pano:600,vino:600,sal:800,seda:300};
// Tiempos en horas de juego (1 h real = 1 mes de juego a velocidad 1x).
// spd de unidad = kilómetros por día de marcha (ritmos medievales reales).
// Edificios: cat (eco/mil/inf/uni), niveles (max) o únicos, coste que escala con el
// nivel, y fx = efecto legible por la economía y por la UI (mismo dato en ambos sitios).
//   prodAdd: recurso/hora fijo por nivel   prodMul: +% al recurso propio por nivel
//   goldAdd: ducados/hora por nivel         mano: MO/hora por nivel
//   def: +% defensa por nivel               moral: recuperación de moral por nivel
//   realmMoral: moral extra a TODO el reino  buildSpeed: obras más rápidas en la provincia
// req: {edificio:nivel}. coastal/urban: exige costa o ciudad.
// up = MANTENIMIENTO ANUAL por nivel (dinero y/o recursos); se descuenta a razón de up/12
// por tick, así queda en la misma unidad "/mes" que los ingresos. Sostener es lo caro.
const BUILDINGS={
  // ---- Economía (con niveles) ----
  granja:{label:"Granja",cat:"eco",icon:"🌾",max:3,time:2160,
    cost:{materiales:600,piedra:200},fx:{prodAdd:{comida:0.9}},up:{dinero:2},
    desc:"La despensa del reino: más Grano cada mes."},
  aserradero:{label:"Aserradero",cat:"eco",icon:"🪵",max:3,time:2160,
    cost:{materiales:400,metal:150},fx:{prodAdd:{materiales:0.9}},up:{dinero:2},
    desc:"Más Madera para construir y armar."},
  cantera:{label:"Cantera",cat:"eco",icon:"🪨",max:3,time:2880,
    cost:{materiales:700,metal:250},fx:{prodAdd:{piedra:0.8}},up:{dinero:3},
    desc:"Más Piedra para murallas y grandes obras."},
  mina:{label:"Mina de hierro",cat:"eco",icon:"⛏",max:3,time:3600,
    cost:{materiales:800,piedra:400},fx:{prodAdd:{metal:0.8}},up:{dinero:4,materiales:2},
    desc:"Más Hierro para armas y herramientas."},
  mercado:{label:"Mercado",cat:"eco",icon:"🏪",max:3,time:2880,
    cost:{materiales:700,piedra:400,dinero:800},fx:{goldAdd:2},up:{dinero:3},
    desc:"Comercio local: más Ducados cada mes."},
  gremio:{label:"Gremio de artesanos",cat:"eco",icon:"🧵",max:3,time:4320,
    cost:{materiales:900,metal:500,dinero:1200},fx:{prodMul:0.12,goldAdd:0.5},up:{dinero:5,materiales:3},
    desc:"+12% a la producción del recurso propio por nivel."},
  templo:{label:"Templo",cat:"eco",icon:"⛪",max:3,time:3600,
    cost:{piedra:900,materiales:400,dinero:600},fx:{goldAdd:0.9,moral:0.012},up:{dinero:4},
    desc:"Diezmos y fe: más Ducados y moral de la provincia."},
  // ---- Militar (con niveles) ----
  cuartel:{label:"Cuartel de levas",cat:"mil",icon:"🛡",max:3,time:2880,
    cost:{dinero:900,materiales:1200,piedra:300},fx:{mano:0.25,recruit:0.15},up:{dinero:6,comida:6},
    desc:"Recluta más rápido y aporta Mano de obra."},
  fabrica:{label:"Fundición",cat:"mil",icon:"🔨",max:4,time:6480,
    cost:{dinero:2500,materiales:2200,metal:1000,piedra:500},fx:{prodMul:0.10},unlock:true,up:{dinero:8,metal:4},
    desc:"+10% producción; desbloquea la tropa pesada."},
  campo:{label:"Campo de entrenamiento",cat:"mil",icon:"🏹",max:2,time:4320,req:{cuartel:1},
    cost:{dinero:1200,materiales:800,comida:600},fx:{mano:0.4},up:{dinero:6,comida:8},
    desc:"Adiestramiento: bastante más Mano de obra."},
  fortaleza:{label:"Castillo",cat:"mil",icon:"🏰",max:5,time:17520,
    cost:{piedra:2200,materiales:1500,metal:600,dinero:1500},fx:{def:0.3},up:{dinero:8,piedra:2},
    desc:"+30% defensa de la provincia por nivel."},
  // ---- Infraestructura (costera) ----
  puerto:{label:"Puerto",cat:"inf",icon:"⚓",max:2,time:3600,coastal:true,
    cost:{materiales:1500,piedra:500,dinero:800},fx:{goldAdd:1.2,mano:0.2,seaMarch:true},up:{dinero:5,materiales:3},
    desc:"Comercio marítimo: más Ducados y Mano de obra."},
  // ---- Obras únicas (caras, con modificadores especiales; no todos podrán costearlas) ----
  catedral:{label:"Catedral",cat:"uni",icon:"⛪",unique:true,time:26280,urban:true,req:{templo:1},
    cost:{piedra:6000,dinero:8000,materiales:2000,seda:400},fx:{goldAdd:4,moral:0.04,realmMoral:3},up:{dinero:20},
    desc:"Obra única: prestigio y moral para TODO el reino."},
  universidad:{label:"Universidad",cat:"uni",icon:"🎓",unique:true,time:26280,urban:true,req:{templo:1},
    cost:{dinero:10000,piedra:3000,pano:500,seda:300},fx:{buildSpeed:0.25,prodMul:0.2},up:{dinero:25},
    desc:"Obra única: obras un 25% más rápidas y +20% producción."},
  lonja:{label:"Lonja de comercio",cat:"uni",icon:"🏛",unique:true,time:21900,coastal:true,req:{mercado:1},
    cost:{dinero:9000,piedra:2500,pano:600,sal:600},fx:{goldAdd:7},up:{dinero:15},
    desc:"Obra única: enorme renta comercial en el puerto."},
  ciudadela:{label:"Ciudadela",cat:"uni",icon:"🏯",unique:true,time:35040,req:{fortaleza:2},
    cost:{piedra:8000,metal:3000,dinero:6000,materiales:3000},fx:{def:1.0},up:{dinero:30,piedra:5,metal:5},
    desc:"Obra única: fortaleza inexpugnable (+100% defensa)."}
};
const BUILD_CATS=[["eco","Economía"],["mil","Militar"],["inf","Infraestructura"],["uni","Obras únicas"]];
function newBuildings(){const o={};for(const b in BUILDINGS)o[b]=0;return o}
const UNITS={
  miliciano:{label:"Levas",atk:1.2,def:2.5,hp:12,spd:16,time:504,cost:{dinero:300,comida:200},mano:200,req:{}},                                  // 3 semanas
  infanteria:{label:"Piqueros",atk:2.5,def:4,hp:18,spd:18,time:1440,cost:{dinero:600,comida:400,materiales:200},mano:400,req:{cuartel:1}},      // 2 meses
  motorizada:{label:"Caballería ligera",atk:4,def:5,hp:20,spd:40,time:2160,cost:{dinero:900,comida:500,petroleo:300,materiales:300},mano:500,req:{cuartel:2}}, // 3 meses
  antitanque:{label:"Alabarderos",atk:3,def:7,hp:16,spd:16,time:1800,cost:{dinero:900,metal:600,materiales:300},mano:300,req:{cuartel:1,fabrica:1}},
  artilleria:{label:"Bombardas",atk:7,def:2,hp:14,spd:10,time:4320,cost:{dinero:1500,metal:900,materiales:400},mano:300,req:{fabrica:2}},        // 6 meses
  blindadoLigero:{label:"Caballería",atk:6,def:4,hp:22,spd:35,time:2400,cost:{dinero:1400,metal:800,petroleo:500},mano:300,req:{fabrica:1}},
  blindadoMedio:{label:"Caballeros",atk:9,def:6,hp:30,spd:28,time:4320,cost:{dinero:2400,metal:1500,petroleo:800,raros:300},mano:400,req:{fabrica:3}} // 6 meses
};
// Tipos de terreno: def multiplica la defensa en combate, mov la velocidad de
// movimiento terrestre, prod la producción de la provincia.
const TERRAINS={
  llanura:{label:"Llanura",mov:1,def:1,prod:1,color:"#b7bd76"},
  bosque:{label:"Bosque",mov:0.8,def:1.25,prod:0.9,color:"#41703f"},
  colinas:{label:"Colinas",mov:0.85,def:1.3,prod:0.9,color:"#b39a5e"},
  montana:{label:"Montaña",mov:0.6,def:1.6,prod:0.75,color:"#8d857c"},
  pantano:{label:"Pantano",mov:0.7,def:1.2,prod:0.8,color:"#588a70"},
  desierto:{label:"Desierto",mov:0.85,def:1,prod:0.6,color:"#dbc98f"},
  estepa:{label:"Estepa",mov:1.15,def:0.9,prod:0.85,color:"#c4b168"},
  // los nuevos van al final: los índices guardados en instantáneas no deben moverse
  pradera:{label:"Pradera",mov:1.05,def:0.95,prod:1.1,color:"#8fbc62"},
  vega:{label:"Vega fértil",mov:1,def:0.85,prod:1.35,color:"#63a83e"}
};
const TERRAIN_KEYS=Object.keys(TERRAINS);
function terrainFx(t){
  const T=TERRAINS[t],fx=[];
  if(T.def!==1)fx.push("defensa "+(T.def>1?"+":"")+Math.round((T.def-1)*100)+"%");
  if(T.mov!==1)fx.push("movimiento "+(T.mov>1?"+":"")+Math.round((T.mov-1)*100)+"%");
  if(T.prod!==1)fx.push("producción "+(T.prod>1?"+":"")+Math.round((T.prod-1)*100)+"%");
  return fx.length?fx.join(" · "):"sin modificadores";
}

export {
  MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, START_STOCK, BUILDINGS, BUILD_CATS, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, terrainFx
};
