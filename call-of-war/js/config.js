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
    desc:"Amplía la DESPENSA de grano de la provincia: más colchón para resistir malas cosechas y hambrunas."},
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

/* ===================== RECURSOS HISTÓRICOS AMPLIADOS (bienes nuevos + cadenas) =====================
 * Ampliación a ~37 bienes con distribución HISTÓRICA (zonas en mapgen) y CADENAS de producción (la fábrica
 * de un bien derivado consume su materia prima del mercado: lana→paño, uva→vino, cobre+estaño+carbón→bronce,
 * hierro+carbón→acero→armas, etc.). Iconos EMOJI (ver RES_ART: qué bienes tienen sprite .png y cuáles no).
 * Los ESTRATÉGICOS (metales, combustibles, armas, alumbre) los stockea la corona (RES_KEYS → resbar); los de
 * consumo (textiles, alimentos, lujos) viven solo en el MERCADO. Todos comercian (ver MKT_GOODS en economy). */
// key, etiqueta, abrev, icono(emoji), precio ref, estratégico?(corona lo stockea), descripción
const NEW_GOODS=[
  ["cobre","Cobre","Cob","🟠",3.0,true,"Metal para el bronce y la moneda. De Falun (Suecia), el Tirol, Eslovaquia y Hungría."],
  ["estano","Estaño","Est","🔩",4.0,true,"Aliado del cobre para el bronce. Casi monopolio de Cornualles y Devon."],
  ["carbon","Carbón vegetal","Cav","⚫",1.4,true,"Combustible de la metalurgia (acero, bronce, vidrio). Se hace en las carboneras del bosque."],
  ["hulla","Hulla","Hul","⬛",1.0,true,"Carbón mineral: calefacción, forja, sal blanca y cal. De Newcastle, Lieja, Gales y Silesia."],
  ["acero","Acero","Ace","⚙️",6.0,true,"Hierro afinado con carbón vegetal: la materia de las buenas armas. Estiria, Milán, Toledo, Solingen."],
  ["bronce","Bronce","Bro","🔔",6.0,true,"Aleación de cobre y estaño: campanas y, sobre todo, cañones. Núremberg, Malinas, Milán."],
  ["armas","Armas","Arm","⚔️",9.0,true,"Espadas, arneses y artillería de las grandes armerías. Necesita acero."],
  ["alumbre","Alumbre","Alu","⚗️",4.5,true,"Mordiente imprescindible para fijar los tintes del paño. Focea (Anatolia) y Tolfa (Lacio)."],
  ["lana","Lana","Lan","🐑",1.4,false,"Vellón de oveja, materia del paño. Inglaterra (Cotswolds), Castilla (merino), Aragón."],
  ["lino","Lino","Lin","🌿",1.2,false,"Fibra vegetal, materia del lienzo. Norte de Francia, Flandes, Alemania, Báltico, Egipto."],
  ["lienzo","Lienzo","Lie","🧺",2.2,false,"Tejido de lino de uso diario. Westfalia, Champaña, Suabia, Egipto."],
  ["sedacruda","Seda cruda","SCr","🧶",3.5,false,"Capullos de gusano, materia de la seda. Calabria, Granada, Grecia, Levante, Caspio."],
  ["algodon","Algodón","Alg","☁️",1.6,false,"Fibra del fustán. Levante, Anatolia, Egipto, Sicilia."],
  ["fustan","Fustán","Fus","🪡",2.2,false,"Tejido barato de algodón y lino. Augsburgo, Ulm, Milán."],
  ["tinte","Tinte","Tin","🎨",3.0,false,"Pastel (azul) y grana (rojo) para teñir paño y seda. Toulouse, Turingia, Mediterráneo."],
  ["uva","Uva","Uva","🍇",0.8,false,"Fruto de la vid, materia del vino. Iberia, Francia, Italia, Rin, Grecia, Hungría."],
  ["aceituna","Aceituna","Ait","🫒",0.9,false,"Fruto del olivo, materia del aceite. Todo el Mediterráneo."],
  ["aceite","Aceite","Aei","🫙",2.4,false,"Aceite de oliva: cocina, lámparas y jabón. Andalucía, Puglia, Grecia, Levante, Magreb."],
  ["pescado","Pescado","Pes","🐟",1.5,false,"Bacalao y arenque salados, alimento de vigilia. Mar del Norte, Noruega, Báltico."],
  ["cana","Caña","Can","🎋",0.9,false,"Caña de azúcar, materia del azúcar. Chipre, Sicilia, Valencia, Levante, Egipto."],
  ["azucar","Azúcar","Azu","🍬",5.0,false,"Dulce de lujo de los ingenios. Chipre, Sicilia, Valencia, Madeira."],
  ["pieles","Pieles","Pie","🦫",4.5,false,"Marta, armiño y ardilla: lujo del norte. Rusia (Nóvgorod), Escandinavia, Báltico."],
  ["cuero","Cuero","Cue","👞",2.0,false,"Piel curtida para calzado y arneses. Córdoba (cordobán), Marruecos, Balcanes, Hungría."],
  ["ganado","Ganado","Gan","🐄",1.2,false,"Reses en pie, materia del cuero y la carne. Hungría, Balcanes, Irlanda, Dinamarca, Magreb."],
  ["cera","Cera","Cer","🕯️",2.5,false,"Cera de abeja para las velas de iglesia y los sellos. Rusia, Polonia, Báltico, Magreb."],
  ["ambar","Ámbar","Amb","🟡",5.0,false,"Resina fósil para rosarios y joyas. Costa del Báltico (Prusia)."],
  // --- Bienes añadidos 2026-07-21 (consejo + cronista): tapan huecos de la vida material de 1444 ---
  ["herramientas","Herramientas","Her","🔨",3.5,false,"Reja, hoz, hacha, clavos y herraduras: el hierro trabajado que toda labranza e industria necesita. Solingen, Núremberg, Milán, Lieja, País Vasco."],
  ["vidrio","Vidrio","Vid","🪟",4.0,false,"Vidrio de ventana y vasija, del vidrio forestal del norte (Bohemia, Alemania, Normandía) al cristallo de lujo de Murano."],
  ["cerveza","Cerveza","Cev","🍺",1.6,false,"La bebida diaria del Norte, como el vino en el Sur. De la malta del grano; el gran export hanseático es de Hamburgo y las villas holandesas."],
  ["ceramica","Cerámica","Crm","🏺",2.0,false,"Loza y vasija de barro cocido. La común es local; el lujo es la loza dorada de Manises (Valencia) y la maiólica italiana."],
  ["papel","Papel","Pap","📜",4.0,false,"Hoja de trapo de lino para cancillerías, universidades y mercaderes. La industria despega en Fabriano justo antes de la imprenta."],
];
for(const[k,label,short,icon,price,strat,desc]of NEW_GOODS){
  RES_LABEL[k]=label; RES_SHORT[k]=short; RES_ICON[k]=icon; RES_DESC[k]=desc;
  // TODOS los bienes nuevos los stockea la corona (RES_KEYS → resbar): los estratégicos en su grupo, los de
  // consumo en el grupo de comercio. Así la barra de recursos se llena (2 filas) con todo el catálogo.
  RES_KEYS.push(k); START_STOCK[k]=0; (strat?RES_STRAT:RES_TRADE).push(k);
}
// Bienes con SPRITE .png (assets/res/); los demás se pintan con su emoji (RES_ICON). El resbar y resImg lo usan.
const RES_ART=new Set(["dinero","comida","materiales","piedra","metal","petroleo","raros","pano","vino","sal","seda"]);
// Fábricas de los bienes nuevos. inputs = CADENA: la fábrica consume esos bienes del mercado por nivel (ver economy).
// key, etiqueta, icono, bien que produce, inputs(cadena) | null, empleos, ¿coste con piedra?
const NEW_BLDGS=[
  // --- extractores de materia prima (sin cadena) ---
  ["minaCobre","Mina de cobre","🟠","cobre",null,600],
  ["minaEstano","Mina de estaño","🔩","estano",null,600],
  ["minaHulla","Mina de hulla","⬛","hulla",null,550],
  ["alumbrera","Alumbrera","⚗️","alumbre",null,500],
  ["majada","Majada","🐑","lana",null,450],
  ["linar","Linar","🌿","lino",null,500],
  ["morera","Criadero de seda","🧶","sedacruda",null,450],
  ["algodonal","Algodonal","☁️","algodon",null,500],
  ["tintoreria","Tintorería","🎨","tinte",null,400],
  ["majuelo","Majuelo","🍇","uva",null,600],
  ["olivar","Olivar","🫒","aceituna",null,600],
  ["canaveral","Cañaveral","🎋","cana",null,550],
  ["pesqueria","Pesquería","🐟","pescado",null,500],
  ["cazadero","Coto de caza","🦫","pieles",null,350],
  ["dehesa","Dehesa","🐄","ganado",null,450],
  ["colmenar","Colmenar","🕯️","cera",null,300],
  ["ambarera","Ambarera","🟡","ambar",null,300],
  // --- manufacturas (CADENAS: consumen su materia) ---
  ["carbonera","Carbonera","⚫","carbon",{materiales:0.5},400],
  ["aceria","Acería","⚙️","acero",{metal:0.5,carbon:0.4},500],
  ["fundibronce","Fundición de bronce","🔔","bronce",{cobre:0.4,estano:0.2,carbon:0.3},500],
  ["armeria","Armería","⚔️","armas",{acero:0.6},450],
  ["telarLino","Telar de lino","🧺","lienzo",{lino:0.6},500],
  ["fustaneria","Fustanería","🪡","fustan",{algodon:0.4,lino:0.3},500],
  ["almazara","Almazara","🫙","aceite",{aceituna:0.7},500],
  ["ingenio","Ingenio azucarero","🍬","azucar",{cana:0.7},550],
  ["curtiduria","Curtiduría","👞","cuero",{ganado:0.5},450],
  // --- cadenas de los bienes añadidos 2026-07-21 (materia prima abstraída donde toca, cronista) ---
  ["herreria","Herrería","🔨","herramientas",{metal:0.5,carbon:0.3},450],   // hierro trabajado + fuel
  ["vidrieria","Vidriería","🪟","vidrio",{materiales:0.6},450],             // madera = fuel dominante (~200:1) Y potasa (cronista): un solo input de madera
  ["cerveceria","Cervecería","🍺","cerveza",{comida:0.6},450],             // malta del grano (lúpulo abstraído)
  ["alfar","Alfar","🏺","ceramica",{materiales:0.4},400],                   // barro ubicuo (abstraído) + fuel de madera
  ["molinoPapel","Molino de papel","📜","papel",{lino:0.5},400],           // trapo de lino + fuerza hidráulica
];
for(const[k,label,icon,prod,inputs,jobs]of NEW_BLDGS){
  const B={label,cat:"eco",icon,max:3,time:2880,cost:{materiales:500,dinero:300},
    fx:{prodAdd:{[prod]:0.6}},up:{dinero:3},
    desc:label+": produce "+RES_LABEL[prod]+(inputs?" (consume del mercado "+Object.keys(inputs).map(x=>RES_LABEL[x]).join(" + ")+")":".")};
  if(inputs)B.inputs=inputs; // CADENA de producción (la consume economy)
  BUILDINGS[k]=B; BUILD_JOBS[k]=jobs; RES_BUILDING[prod]=k;
}
// Cadenas en las fábricas de lujo EXISTENTES: el paño necesita lana (+alumbre), el vino uva, la seda seda cruda (+tinte).
BUILDINGS.telar.inputs={lana:0.5,alumbre:0.05};
BUILDINGS.vinedo.inputs={uva:0.7};
BUILDINGS.sederia.inputs={sedacruda:0.4,tinte:0.1};
// key de los bienes de comercio NUEVOS (todos), para que economy los añada al mercado.
const EXTRA_GOODS=NEW_GOODS.map(g=>({key:g[0],price:g[4]}));
// CATEGORÍA de cada bien. El terreno tiene un factor por CATEGORÍA (no por bien), y cada provincia produce su
// materia prima (resType) al ritmo de la categoría de ese bien. Categorías de MATERIA PRIMA (las produce el
// campo por terreno): cereal, cultivo, ganado, bosque, extractivo, mar. Las MANUFACTURAS salen de fábricas
// (cadenas); comercio = entrepôt (especias); moneda = plata/oro (acuñación). Ver TERRAIN_CAT en economy.
const RES_CAT={
  comida:"cereal",
  uva:"cultivo",aceituna:"cultivo",lino:"cultivo",algodon:"cultivo",cana:"cultivo",tinte:"cultivo",sedacruda:"cultivo",
  lana:"ganado",ganado:"ganado",petroleo:"ganado",cera:"ganado",
  materiales:"bosque",carbon:"bosque",pieles:"bosque",
  piedra:"extractivo",metal:"extractivo",cobre:"extractivo",estano:"extractivo",hulla:"extractivo",alumbre:"extractivo",
  pescado:"mar",sal:"mar",ambar:"mar",
  pano:"manufactura",lienzo:"manufactura",seda:"manufactura",fustan:"manufactura",aceite:"manufactura",
  azucar:"manufactura",acero:"manufactura",bronce:"manufactura",armas:"manufactura",vino:"manufactura",cuero:"manufactura",
  herramientas:"manufactura",vidrio:"manufactura",cerveza:"manufactura",ceramica:"manufactura",papel:"manufactura",
  raros:"comercio", plata:"moneda",oro:"moneda",dinero:"moneda",
};
const RES_RAW_CATS=["cereal","cultivo","ganado","bosque","extractivo","mar"]; // categorías que produce el CAMPO por terreno

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
  tundra:{label:"Tundra",mov:0.65,def:1.1,prod:0.45,color:"#c6d3d6"},
  // EL MAR ES UN TERRENO. Antes el océano era el hueco donde NO había provincia (provIdx=-1); ahora
  // está teselado en 344 hexágonos que son provincias de pleno derecho: sin dueño, pero con área,
  // vecinas y grafo. Eso es lo que permite mover tropas por mar, rutas de comercio y, el día que
  // los haya, barcos. Se modela como terreno —y no como un campo nuevo en la tupla— porque el
  // formato ya lo lleva y porque `isSea(p)` sale gratis de ahí.
  // prod 0 y def/mov neutros: nada se produce ni se defiende en el agua (de momento).
  mar:{label:"Mar",mov:1,def:1,prod:0,color:"#2a3a72"},
  // MESETA/ALTIPLANO: el tipo nuevo del volcado de orografía de EU4 (drylands+highlands: meseta
  // ibérica, altiplano anatolio, Atlas, Levante interior — 140 ducados, 14% del mapa). Va AL FINAL
  // para no mover ningún índice guardado. Stats PROVISIONALES (entre colinas y estepa): se revisarán
  // junto al resto de terrenos con el consejo + investigación histórica. Sin sprite → color pelado.
  // mov 0.87 (antes 1.0, = igual que llanura, un error): la meseta ESTORBA el paso ~15% (dificultad
  // ×1.15 en velocidad = 1/1.15 ≈ 0.87). El dictamen de mercado-centros lo pedía como "factor 1.15";
  // como `mov` es VELOCIDAD (mayor = más fácil), el valor correcto es su inverso, no 1.15. Lo usan la
  // marcha del ejército (sim.js) y la tinta de los centros de comercio (assignHubs) — una sola verdad.
  meseta:{label:"Meseta",mov:0.87,def:1.1,prod:0.8,color:"#c9a86a"}
};
const SEA_TERRAIN="mar";
const isSea=p=>p&&p.terrain===SEA_TERRAIN;
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
const WAR_LOCK_HOURS=1*8760;   // 1 año de paz obligada al inicio (bajar a 0 solo para testear guerras)
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

// ---- Rutas marítimas: grafo único tierra+mar (fase 1 del mapa nuevo) ----
// El mar es transitable por NODOS (las 344 teselas). El enrutado —mercado y marcha del ejército—
// corre sobre el grafo unificado (S.adj tierra↔tierra y mar↔mar, S.seaAdj el cruce costera↔tesela)
// en km reales; el tramo de mar lleva DESCUENTO de velocidad porque el barco es más rápido que la
// carreta (cabotaje ~90 km/día vs. carreta ~30). Con esto el mercado y la marcha eligen la ruta
// más rápida entre "por tierra siguiendo la costa" y "por mar". Knobs a calibrar en vivo.
const SEA_KM_MULT=0.45;   // coste de mercado del km por mar = 45% del km por tierra
// CENTRO DE COMERCIO (modelo EU5, design/mercado-centros-eu5.md): una ciudad es CENTRO si su núcleo
// histórico llega a este umbral (40 centros con el dataset actual) O está en la lista CURADA de abajo.
// La CAPITAL NO cuenta por serlo (corrección de Sergio 2026-07-19: "capital siempre" disparaba a 233
// centros con 190 naciones). Es la semilla de la 2ª capa del mercado (assignHubs → hubOf/hubKm), que
// NO pisa marketOf (la plaza local del grano). Sigue siendo solo TOPOLOGÍA (no engancha dinero aún).
const CENTER_POP=25000;
// Lista CURADA: ciudades que son CENTRO por FUNCIÓN comercial o de peregrinación aunque su núcleo no
// llegue a CENTER_POP. Se resuelven por nombre (cityName o name de provincia) en assignHubs. Ypres
// queda FUERA (hundida en 1444, cronista). Dover = puerto del ducado de Kent, proxy de Canterbury
// (la peregrinación inglesa; "Kent" es nombre de DUCADO, no de provincia). Dubrovnik = Ragusa dálmata,
// NO la Ragusa siciliana. Roma y Köln ya entran por población; van en la lista por robustez
// (idempotente). Ampliable por Sergio (p.ej. Hansa oriental: Reval/Riga/Danzig/Nóvgorod).
const CURATED_HUBS=["Lübeck","Krakow","Augsburg"];  // reales de ~15-20k, centro por función. Los demás
// (Dubrovnik, Santiago, Dover, y el Este) ahora son centro por población ≥25k (cities1444); Roma/Köln ya
// pasaban de 25k. Así NO hay centros fantasma: todo centro es una ciudad que llega al umbral.
// UMBRAL URBANO (¿qué es "ciudad" en 1450?): núcleo histórico ≥ CITY_MIN. Es el umbral estándar de
// Bairoch/Buringh (la fuente de cities1444). Por debajo = villa grande/aldea → provincia RURAL (pierde
// el flag urbano; conserva su nombre). Anulación funcional: las capitales nacionales son urbanas aunque
// no lleguen (sede = ciudad). Decidido por Sergio 2026-07-19 (ver design/pops-1450-metodo.md).
const CITY_MIN=5000;
const NAV_KM=350;         // alcance de "vecino por mar" (S.navAdj) para los heurísticos de IA
// TIEMPO DE EMBARQUE: coste fijo (horas) que se paga UNA vez al embarcar (tierra→mar). El barco es
// mucho más rápido por km que la marcha, así que sin esto cualquier salto —aunque las dos provincias
// estén pegadas por tierra— preferiría meterse en el mar. Este peaje hace que para moverse "un par de
// provincias" compense ir directo por tierra, y solo las travesías largas o sin ruta terrestre usen el
// mar. Se paga en el pathfinding (elige ruta) y en la duración real de la pierna. Knob a calibrar.
const EMBARK_HOURS=96;    // ~4 días de preparar el embarque

// ---- Estratos sociales (Fase A: tipos de pop) ----
// Cada provincia reparte su población en estos estratos (p.pops[k]) y cada estrato tiene su propia
// riqueza (p.wealth[k], dinero del estrato). Campesinos y burgueses trabajan/comercian; clero y
// nobleza tendrán mecánicas propias más adelante. Orden = de base a cúspide.
const STRATA=["campesino","burgues","clero","nobleza"];
const STRATA_INFO={
  campesino:{label:"Campesinos",icon:"<span class='icoPh' data-ico='campesino'>[ ]</span>"},
  burgues:{label:"Burgueses",icon:"<span class='icoPh' data-ico='burgues'>[ ]</span>"},
  clero:{label:"Clero",icon:"<span class='icoPh' data-ico='clero'>[ ]</span>"},
  nobleza:{label:"Nobleza",icon:"<span class='icoPh' data-ico='nobleza'>[ ]</span>"},
};
// Reparto inicial de la población por provincia (rural vs ciudad); tunable, cada bloque suma 1.
// Clero y nobleza ≈2% del reino cada uno de media: la NOBLEZA se concentra en el campo (señoríos)
// y el CLERO en la ciudad (cabildos/catedrales), de ahí los sesgos rural↔urbano.
const STRATA_SEED={
  rural:{campesino:0.913,burgues:0.05,clero:0.014,nobleza:0.023},
  urban:{campesino:0.565,burgues:0.38,clero:0.045,nobleza:0.010},
};

export {
  GH_PER_SEC, START_DATE, MESES, WAR_LOCK_HOURS, LOOT_FRAC, GOLD_PER_WS, WS_DUCHY_BASE, WS_DUCHY_PER, WS_BATTLE,
  LEVY_RAISE_HOURS, SIEGE_BASE_H, GARR_MIN, GARR_FORT, GARR_CITADEL, SEA_KM_MULT, NAV_KM, EMBARK_HOURS, CENTER_POP, CURATED_HUBS, CITY_MIN,
  MW, MH, NATIONS, NPLAY, NEUTRAL, RES_KEYS, RES_STRAT, RES_TRADE, RES_LABEL, RES_SHORT, RES_ICON, RES_DESC, START_STOCK, BUILDINGS, BUILD_JOBS, BUILD_CATS, RES_BUILDING, newBuildings, UNITS, TERRAINS, TERRAIN_KEYS, terrainFx, SEA_TERRAIN, isSea,
  STRATA, STRATA_INFO, STRATA_SEED, RES_ART, EXTRA_GOODS, RES_CAT, RES_RAW_CATS
};
