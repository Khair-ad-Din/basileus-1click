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
// Nota: "plata" y "oro" NO son recursos de stock (no van en RES_KEYS/START_STOCK): son un
// resType de provincia (yacimiento) cuya extracción rinde DUCADOS (plata poco, oro mucho).
// Estas etiquetas solo sirven para pintar el bien de la provincia en la UI.
const RES_LABEL={dinero:"Ducados",comida:"Grano",materiales:"Madera",piedra:"Piedra",metal:"Hierro",petroleo:"Caballos",
  raros:"Especias",pano:"Paño",vino:"Vino",sal:"Sal",seda:"Seda",plata:"Plata",oro:"Oro"};
const RES_SHORT={dinero:"Duc",comida:"Gra",materiales:"Mad",piedra:"Pie",metal:"Hie",petroleo:"Cab",
  raros:"Esp",pano:"Pañ",vino:"Vin",sal:"Sal",seda:"Sed",plata:"Pla",oro:"Oro"};
const RES_ICON={dinero:"🪙",comida:"🌾",materiales:"🪵",piedra:"🪨",metal:"⛓",petroleo:"🐎",
  raros:"🌶",pano:"🧵",vino:"🍷",sal:"🧂",seda:"🎗",plata:"🥈",oro:"🥇"};
const START_STOCK={dinero:5000,comida:3000,materiales:4000,piedra:2500,metal:2500,petroleo:1500,
  raros:800,pano:600,vino:600,sal:800,seda:300};
// Descripción larga de cada bien (para los tooltips del menú): qué es, para qué sirve, quién lo
// produce/consume y su papel económico. plata/oro no son stock: son yacimientos que rinden ducados.
const RES_DESC={
  dinero:"Moneda del reino y bien de PRESTIGIO, ahora escaso. Paga construcciones, el mantenimiento de los ejércitos y la compra de bienes en el mercado. Su motor son los IMPUESTOS a la población (los mayores ingresos); lo completan el comercio (mercado, lonja, puerto) y las raras minas de plata y oro.",
  comida:"Grano: alimenta a la población (subsistencia) y a los ejércitos. El excedente llena la despensa e impulsa el crecimiento demográfico; su falta trae hambrunas y muertes. Lo da el campo —granjas y tierras fértiles (vega, pradera)—.",
  materiales:"Madera: material básico de construcción y de muchas unidades, y además una NECESIDAD de confort de la población. La dan aserraderos y provincias de bosque.",
  piedra:"Para murallas, castillos, catedrales y grandes obras. La dan canteras y el terreno montañoso.",
  metal:"Hierro: arma a las tropas pesadas (alabarderos, bombardas, caballeros) y desbloquea la fundición. Lo dan minas de hierro y montañas/colinas.",
  petroleo:"Caballos: monturas para la caballería y el transporte. Los crían estepas y praderas.",
  raros:"Especias: lujo de comercio regional, usado en obras y unidades caras. Escaso y muy demandado.",
  pano:"Paño: NECESIDAD de confort de la población y bien de lujo. Lo producen sobre todo las CIUDADES (manufactura textil) y algunas comarcas laneras.",
  vino:"Vino: NECESIDAD de confort de la población. De viñedos en vegas y colinas soleadas.",
  sal:"Sal: NECESIDAD de confort crítica (conserva los alimentos). Deficitaria en gran parte de Europa —el cuello de botella histórico—; tenerla es una ventaja.",
  seda:"Seda: lujo caro y escaso, imprescindible para obras únicas (catedral, universidad). Llega por las rutas de Oriente.",
  plata:"Yacimiento de PLATA (común en la Europa central minera: Bohemia, Tirol, Sajonia, Serbia). Su mina rinde DUCADOS de forma modesta y constante: una fuente secundaria de tesoro y prestigio.",
  oro:"Raro yacimiento de ORO (los Cárpatos: Hungría, Transilvania). Su mina rinde MUCHOS ducados y prestigio: controlarlo es una ventaja estratégica de primer orden."
};
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
    desc:"Cultiva la tierra: más Grano según los trabajadores empleados. Llena la despensa, sostiene el crecimiento y su excedente libera manos del campo para otros oficios. Ocupa un hueco de construcción."},
  aserradero:{label:"Aserradero",cat:"eco",icon:"🪵",max:3,time:2160,
    cost:{materiales:400,metal:150},fx:{prodAdd:{materiales:0.9}},up:{dinero:2},
    desc:"Tala y asierra: más Madera según sus trabajadores. Alimenta la construcción, el ejército y el confort de la población."},
  cantera:{label:"Cantera",cat:"eco",icon:"🪨",max:3,time:2880,
    cost:{materiales:700,metal:250},fx:{prodAdd:{piedra:0.8}},up:{dinero:3},
    desc:"Extrae Piedra según sus trabajadores. Imprescindible para murallas, castillos y grandes obras."},
  mina:{label:"Mina de hierro",cat:"eco",icon:"⛏",max:3,time:3600,
    cost:{materiales:800,piedra:400},fx:{prodAdd:{metal:0.8}},up:{dinero:4,materiales:2},
    desc:"Extrae Hierro según sus trabajadores. El metal arma a la tropa pesada y la artillería, y desbloquea la fundición."},
  // Minas de metal precioso: SOLO en provincias con el yacimiento (resReq). Rinden DUCADOS
  // (no un recurso de stock). La plata es común y modesta; el oro, raro y muy rentable.
  minaPlata:{label:"Mina de plata",cat:"eco",icon:"🥈",max:3,time:4320,resReq:"plata",
    cost:{materiales:700,piedra:500,dinero:600},fx:{prodAdd:{dinero:4}},up:{dinero:3,materiales:2},
    desc:"Explota el filón de plata: única fuente de Ducados de una provincia de plata (fuente secundaria y de prestigio)."},
  minaOro:{label:"Mina de oro",cat:"eco",icon:"🥇",max:2,time:7200,resReq:"oro",
    cost:{materiales:1000,piedra:800,dinero:1500},fx:{prodAdd:{dinero:11}},up:{dinero:6,materiales:3},
    desc:"Explota el raro filón de oro: gran renta en Ducados y prestigio para el reino."},
  mercado:{label:"Mercado",cat:"eco",icon:"🏪",max:3,time:2880,
    cost:{materiales:700,piedra:400,dinero:800},fx:{goldAdd:2},up:{dinero:3},
    desc:"Comercio local: renta FIJA de Ducados por nivel (de momento no depende de la población; se reworkeará con el sistema de comercio). Uno de los pocos grifos de tesoro que quedan."},
  gremio:{label:"Gremio de artesanos",cat:"eco",icon:"🧵",max:3,time:4320,
    cost:{materiales:900,metal:500,dinero:1200},fx:{prodMul:0.12,goldAdd:0.5},up:{dinero:5,materiales:3},
    desc:"Los artesanos elevan la producción: +12% a TODA la producción de la provincia por nivel (según la dotación) y algo de Ducados. Se apila con otros multiplicadores."},
  // ---- Producción de bienes de confort y lujo (buildables en cualquier sitio; rinden MÁS con afinidad) ----
  vinedo:{label:"Viñedo",cat:"eco",icon:"🍇",max:3,time:2880,
    cost:{materiales:500,dinero:300},fx:{prodAdd:{vino:0.6}},up:{dinero:3},
    desc:"Cultiva la vid: produce Vino según sus trabajadores. Rinde MÁS en provincias con afinidad al vino. El vino es una necesidad de confort de la población."},
  salina:{label:"Salina",cat:"eco",icon:"🧂",max:3,time:2880,
    cost:{materiales:400,piedra:300,dinero:300},fx:{prodAdd:{sal:0.6}},up:{dinero:3},
    desc:"Extrae Sal (por evaporación o mina): rinde MÁS donde hay afinidad salina. La sal es una necesidad de confort crítica y el cuello de botella histórico."},
  telar:{label:"Telar",cat:"eco",icon:"🧶",max:3,time:3600,
    cost:{materiales:500,dinero:500},fx:{prodAdd:{pano:0.6}},up:{dinero:4},
    desc:"Manufactura textil: produce Paño según sus trabajadores. Rinde MÁS en comarcas laneras (afinidad). El paño es una necesidad de confort."},
  sederia:{label:"Sedería",cat:"eco",icon:"🎗",max:2,time:4320,
    cost:{materiales:600,dinero:900},fx:{prodAdd:{seda:0.4}},up:{dinero:5},
    desc:"Hila y teje seda: lujo caro. Rinde MÁS donde llega la ruta de la seda (afinidad). Imprescindible para las obras únicas (catedral, universidad)."},
  especiar:{label:"Especiería",cat:"eco",icon:"🌶",max:2,time:3600,
    cost:{materiales:500,dinero:700},fx:{prodAdd:{raros:0.4}},up:{dinero:4},
    desc:"Cultiva y comercia especias: lujo muy demandado. Rinde MÁS en zonas con afinidad. Usado en obras y unidades caras."},
  yeguada:{label:"Yeguada",cat:"eco",icon:"🐎",max:3,time:2880,
    cost:{materiales:500,comida:400},fx:{prodAdd:{petroleo:0.6}},up:{dinero:3,comida:2},
    desc:"Cría caballos para la caballería y el transporte: rinde MÁS en estepas y praderas (afinidad)."},
  templo:{label:"Templo",cat:"eco",icon:"⛪",max:3,time:3600,
    cost:{piedra:900,materiales:400,dinero:600},fx:{moral:1.2},up:{dinero:4},
    desc:"Gana el corazón de la provincia: crecimiento mensual de moral (súbelo apilando templos)."},
  // ---- Militar (con niveles) ----
  cuartel:{label:"Cuartel de levas",cat:"mil",icon:"🛡",max:3,time:2880,
    cost:{dinero:900,materiales:1200,piedra:300},fx:{mano:0.25,recruit:0.15},up:{dinero:6,comida:6},
    desc:"Adiestra las levas más rápido y amplía el cupo de soldadesca movilizable de la provincia. Requisito de la tropa profesional."},
  fabrica:{label:"Fundición",cat:"mil",icon:"🔨",max:4,time:6480,
    cost:{dinero:2500,materiales:2200,metal:1000,piedra:500},fx:{prodMul:0.10},unlock:true,up:{dinero:8,metal:4},
    desc:"Fundición: +10% de producción por nivel (según la dotación) y desbloquea la tropa pesada (alabarderos, bombardas, caballería). Fuerte mantenimiento en Hierro."},
  campo:{label:"Campo de entrenamiento",cat:"mil",icon:"🏹",max:2,time:4320,req:{cuartel:1},
    cost:{dinero:1200,materiales:800,comida:600},fx:{mano:0.4},up:{dinero:6,comida:8},
    desc:"Eleva bastante el cupo de soldadesca movilizable. Requiere Cuartel."},
  fortaleza:{label:"Castillo",cat:"mil",icon:"🏰",max:5,time:17520,
    cost:{piedra:2200,materiales:1500,metal:600,dinero:1500},fx:{def:0.3},up:{dinero:8,piedra:2},
    desc:"+30% de defensa de la provincia por nivel y guarnición que socorre en batalla; convierte la plaza en un tapón que el enemigo debe ASEDIAR."},
  // ---- Infraestructura (costera) ----
  puerto:{label:"Puerto",cat:"inf",icon:"⚓",max:2,time:3600,coastal:true,
    cost:{materiales:1500,piedra:500,dinero:800},fx:{goldAdd:1.2,mano:0.2,seaMarch:true},up:{dinero:5,materiales:3},
    desc:"Comercio marítimo: Ducados y cupo de soldadesca extra, y habilita la marcha por mar de los ejércitos. Solo en provincias costeras."},
  almacen:{label:"Almacén",cat:"inf",icon:"🏚",max:3,time:2880,
    cost:{materiales:800,piedra:300},fx:{store:0.8},up:{dinero:2},
    desc:"Amplía las reservas LOCALES de la provincia de cada bien básico (grano, madera, piedra, hierro): más colchón para resistir malas cosechas y hambrunas."},
  // ---- Obras únicas (caras, con modificadores especiales; no todos podrán costearlas) ----
  catedral:{label:"Catedral",cat:"uni",icon:"⛪",unique:true,time:26280,urban:true,req:{templo:1},
    cost:{piedra:6000,dinero:8000,materiales:2000,seda:400},fx:{moral:3,realmMoral:2},up:{dinero:20},
    desc:"Obra única: fuerte crecimiento de moral local y un empujón de moral a TODO el reino."},
  universidad:{label:"Universidad",cat:"uni",icon:"🎓",unique:true,time:26280,urban:true,req:{templo:1},
    cost:{dinero:10000,piedra:3000,pano:500,seda:300},fx:{buildSpeed:0.25,prodMul:0.2},up:{dinero:25},
    desc:"Obra única: acelera un 25% todas las obras de la provincia y +20% de producción. Saber y prestigio; exige lujos (Paño, Seda)."},
  lonja:{label:"Lonja de comercio",cat:"uni",icon:"🏛",unique:true,time:21900,coastal:true,req:{mercado:1},
    cost:{dinero:9000,piedra:2500,pano:600,sal:600},fx:{goldAdd:7},up:{dinero:15},
    desc:"Obra única: enorme renta de Ducados en un gran puerto comercial. (Comercio flat por ahora; se reworkeará con el sistema de comercio.)"},
  ciudadela:{label:"Ciudadela",cat:"uni",icon:"🏯",unique:true,time:35040,req:{fortaleza:2},
    cost:{piedra:8000,metal:3000,dinero:6000,materiales:3000},fx:{def:1.0},up:{dinero:30,piedra:5,metal:5},
    desc:"Obra única: fortaleza casi inexpugnable (+100% defensa) y fuerte guarnición. La plaza más dura de asediar del reino."}
};
// EMPLEOS por NIVEL de cada edificio: los pops que ocupa esa industria. La producción del
// edificio escala con los trabajadores realmente empleados (nivel × empleos × dotación), no es
// una cantidad fija. Los productivos ocupan mucha mano de obra; comercio/clero/entrenamiento,
// menos; los fuertes usan guarnición (soldadesca), no mano de obra civil → 0 empleos.
// Sin entrada aquí => JOBS_PER_LEVEL por defecto (economy.js).
const BUILD_JOBS={
  granja:700,aserradero:550,cantera:550,mina:600,minaPlata:600,minaOro:600,
  vinedo:550,salina:550,telar:550,sederia:450,especiar:450,yeguada:500,
  fabrica:500,mercado:350,gremio:450,lonja:300,puerto:350,
  templo:150,catedral:250,universidad:250,cuartel:250,campo:200,almacen:120,
  fortaleza:0,ciudadela:0
};
// Edificio PRODUCTOR de cada bien (para sembrar una fábrica del tipo del resType en cada
// provincia al iniciar la partida, y evitar el déficit general del arranque building-driven).
const RES_BUILDING={comida:"granja",materiales:"aserradero",piedra:"cantera",metal:"mina",
  petroleo:"yeguada",raros:"especiar",pano:"telar",vino:"vinedo",sal:"salina",seda:"sederia",
  plata:"minaPlata",oro:"minaOro",dinero:"mercado"};
const BUILD_CATS=[["eco","Economía"],["mil","Militar"],["inf","Infraestructura"],["uni","Obras únicas"]];
function newBuildings(){const o={};for(const b in BUILDINGS)o[b]=0;return o}
// up = MANTENIMIENTO por unidad y MES (dinero/comida/recurso). Las levas son baratísimas de sostener
// (campesinos armados) pero su coste real es la POBLACIÓN: la soldadesca sale de los pops y las bajas
// restan pob para siempre. Las tropas profesionales muerden fuerte el tesoro cada mes.
// food = RACIÓN de grano por POP y AÑO (el consumo de comida del ejército es pop-driven y se
// forrajea de las reservas locales / nacional según el slider de suministro; ya NO va en up).
// Levas = ración de campesino (1/año); los profesionales comen más (mejor alimentados, monturas).
// up = mantenimiento en dinero/recursos (SIN comida). cost.comida sigue siendo el gasto de reclutar.
const UNITS={
  miliciano:{label:"Levas",atk:1.2,def:2.5,hp:12,spd:16,time:504,cost:{dinero:350,comida:250},up:{dinero:0.15},food:1,mano:200,req:{}},                                  // 3 semanas
  infanteria:{label:"Piqueros",atk:2.5,def:4,hp:18,spd:18,time:1440,cost:{dinero:850,comida:560,materiales:280},up:{dinero:0.8},food:1.45,mano:400,req:{cuartel:1}},      // 2 meses
  motorizada:{label:"Caballería ligera",atk:4,def:5,hp:20,spd:40,time:2160,cost:{dinero:1300,comida:700,petroleo:420,materiales:420},up:{dinero:1.2,petroleo:0.4},food:2.2,mano:500,req:{cuartel:2}}, // 3 meses
  antitanque:{label:"Alabarderos",atk:3,def:7,hp:16,spd:16,time:1800,cost:{dinero:1300,metal:850,materiales:420},up:{dinero:1.0,metal:0.2},food:1.45,mano:300,req:{cuartel:1,fabrica:1}},
  artilleria:{label:"Bombardas",atk:7,def:2,hp:14,spd:10,time:4320,cost:{dinero:2100,metal:1300,materiales:560},up:{dinero:1.6,metal:0.3},food:1.45,mano:300,req:{fabrica:2}},        // 6 meses
  blindadoLigero:{label:"Caballería",atk:6,def:4,hp:22,spd:35,time:2400,cost:{dinero:2000,metal:1100,petroleo:700},up:{dinero:1.5,petroleo:0.5},food:2.2,mano:300,req:{fabrica:1}},
  blindadoMedio:{label:"Caballeros",atk:9,def:6,hp:30,spd:28,time:4320,cost:{dinero:3400,metal:2100,petroleo:1100,raros:420},up:{dinero:2.2,petroleo:0.7,metal:0.4},food:2.2,mano:400,req:{fabrica:3}} // 6 meses
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
  vega:{label:"Vega fértil",mov:1,def:0.85,prod:1.35,color:"#63a83e"},
  tundra:{label:"Tundra",mov:0.65,def:1.1,prod:0.45,color:"#c6d3d6"}
};
const TERRAIN_KEYS=Object.keys(TERRAINS);
function terrainFx(t){
  const T=TERRAINS[t],fx=[];
  if(T.def!==1)fx.push("defensa "+(T.def>1?"+":"")+Math.round((T.def-1)*100)+"%");
  if(T.mov!==1)fx.push("movimiento "+(T.mov>1?"+":"")+Math.round((T.mov-1)*100)+"%");
  if(T.prod!==1)fx.push("producción "+(T.prod>1?"+":"")+Math.round((T.prod-1)*100)+"%");
  return fx.length?fx.join(" · "):"sin modificadores";
}

// fecha de inicio y meses (para la UI del calendario)
const GH_PER_SEC=730.5/3600; // horas de juego por segundo real a 1x
const START_DATE=Date.UTC(1444,10,11,6);
const MESES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// ===== Guerra: bloqueo inicial, ocupación y warscore =====
const WAR_LOCK_HOURS=0;        // TEMPORAL testeo: bloqueo desactivado (valor normal: 4*8760 = 4 años)
const LOOT_FRAC=0.35;          // fracción de la renta de dinero que saquea el ocupante de una provincia
const GOLD_PER_WS=120;         // ducados por punto de warscore al exigir/ceder oro en la paz
const WS_DUCHY_BASE=12;        // valor en warscore de un ducado = base + WS_DUCHY_PER·nProvs
const WS_DUCHY_PER=5;
const WS_BATTLE=0.6;           // puntos de warscore por batalla ganada (proporcional al daño)
// ---- Levas rápidas (levantamiento alrededor de un ejército) ----
const LEVY_RAISE_HOURS=96;     // ~4 días: las levas se movilizan mucho más rápido que la tropa entrenada
// ---- Asedios y guarnición de fuertes ----
const SIEGE_BASE_H=2920;       // ~4 meses base para tomar una capital de ducado L1 (escala con fuerte/moral/comida)
const GARR_MIN=2;              // guarnición mínima (milicianos-equiv) de TODA capital de ducado
const GARR_FORT=2;             // guarnición extra por nivel de Castillo
const GARR_CITADEL=3;          // guarnición extra de la Ciudadela

export {
  GH_PER_SEC, START_DATE, MESES, WAR_LOCK_HOURS, LOOT_FRAC, GOLD_PER_WS, WS_DUCHY_BASE, WS_DUCHY_PER, WS_BATTLE,
  LEVY_RAISE_HOURS, SIEGE_BASE_H, GARR_MIN, GARR_FORT, GARR_CITADEL,
  MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, RES_DESC, START_STOCK, BUILDINGS, BUILD_JOBS, BUILD_CATS, RES_BUILDING, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, terrainFx
};
