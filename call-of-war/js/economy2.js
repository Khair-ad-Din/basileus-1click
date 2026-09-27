// economy2.js — ECONOMÍA v2 "una sola regla" (design/economia-v2.md).
//
// LA REGLA: el dinero solo nace cuando alguien VENDE un bien a la plaza; cada ducado que se paga lo cobra alguien.
// La PLAZA (N.e2.plaza) es el intermediario de cada reino: paga al productor cuando entrega y cobra al consumidor
// cuando compra. Su saldo acumulado es exactamente el dinero creado (−) o destruido (+) por el comercio. Aparte de
// ella, solo hay tres grifos/sumideros EXPLÍCITOS y contados en S.e2L: minas de plata/oro (acuñación), mantenimiento
// en dinero (edificios y ejército) y el flete del comercio entre reinos. El arnés (tools/verify-v2.mjs) comprueba:
//      Σ(tesoros + riqueza de estamentos) + Σ plazas + sumideros − grifos = constante.
//
// Se activa con S.econV2 (ver sim.js). La v1 (economy.js) queda intacta hasta que v2 se juegue mejor.
// Unidades: 1 unidad = lo que come UNA persona en UN año de grano. Rates "por persona y año"; el tick multiplica
// por f = dt/YR_TICKS. Precios de referencia en ducados/unidad (grano = 1 × PRICE_SCALE).
import { NPLAY, BUILDINGS, UNITS, STRATA, TERRAINS } from "./config.js";
import { S } from "./state.js";
import { kmBetween, pxToLonLat } from "./mapgen.js";
import { isEmbargoed, atWarPair } from "./diplomacy.js";
import { isOccupied, effLvl, lvlOf, bOwnerOf, manorOf, taxRateOf, alcabalaOf, almojOf, repartoRates, harvestMul, terrMul, DIEZMO,
  terrCatMul, staffing, storeCap, armyFood, soldCap, provProdMul, ensureMarket, recFlow, recBuy, YR_TICKS,
  TRADE_KM, TRADE_SEA, TRADE_WAR, TRADE_BULK, MANOR_RENT, TOLL_FRAC, FLETE_MAX, FAMINE_DEF, STARVE_RATE, POP_GROWTH_BASE,
  SOLD_REGEN, PROMO_RATE, targetBurgFrac } from "./economy.js";

// ============================== CONSTANTES (todo lo tunable está aquí) ==============================
const PRICE_SCALE=8;     // palanca GLOBAL de precios: iguala el dinero del comercio a la escala de costes de la v1
                         // (edificios, tropas, mantenimiento). Con 1, clero y nobleza no cubrían ni el mantenimiento.

// Los 17 bienes. Reusan las claves de la v1 (iconos/UI); la etiqueta v2 está en LABEL2.
const GOODS2=["comida","sal","lienzo","ganado","pescado","vino","pano","herramientas","seda","raros","pieles",
  "lana","metal","materiales","piedra","petroleo","armas"];
const LABEL2={comida:"Grano",sal:"Sal",lienzo:"Lienzo",ganado:"Carne",pescado:"Pescado",vino:"Bebida",pano:"Paño",
  herramientas:"Herramientas",seda:"Seda",raros:"Especias",pieles:"Pieles",lana:"Lana",metal:"Hierro",
  materiales:"Madera",piedra:"Piedra",petroleo:"Caballos",armas:"Armas"};
const REF2={comida:1,sal:3,lienzo:4,ganado:3,pescado:3,vino:2,pano:8,herramientas:6,seda:30,raros:30,pieles:20,
  lana:2,metal:3,materiales:1,piedra:1,petroleo:25,armas:15};
// categoría de PESO para el transporte (TRADE_BULK de la v1, calibrado): grano y piedra se quedan locales solos
const BULK2={comida:"cereal",sal:"mar",lienzo:"manufactura",ganado:"ganado",pescado:"mar",vino:"manufactura",
  pano:"manufactura",herramientas:"manufactura",seda:"manufactura",raros:"comercio",pieles:"bosque",lana:"ganado",
  metal:"extractivo",materiales:"bosque",piedra:"extractivo",petroleo:"ganado",armas:"manufactura"};
// TRADE_KM de la v1 está anclado al grano a 0,8 (1.100 km = 50% del valor); aquí el grano vale 1.
const TRADE_KM2=TRADE_KM/0.8;

// NECESIDADES por persona y año, en TRES ESCALONES. WANT multiplica cada escalón por estamento (los ricos piden más).
const NEED2={
  subs:{comida:1.0, sal:0.01, lienzo:0.01},
  vida:{ganado:0.006, pescado:0.006, vino:0.012, pano:0.004, herramientas:0.003, materiales:0.012, piedra:0.002},
  lujo:{seda:0.005, raros:0.005, pieles:0.004, petroleo:0.002, armas:0.002},
};
const TIERS=["subs","vida","lujo"];
const TIER_OF={};for(const t in NEED2)for(const g in NEED2[t])TIER_OF[g]=t;
const WANT2={campesino:{subs:1,vida:1,lujo:0}, burgues:{subs:1,vida:2,lujo:1},
             clero:{subs:1,vida:3,lujo:2},     nobleza:{subs:1,vida:4,lujo:3}};
const BUY_ORDER=["nobleza","clero","burgues"];   // si falta: talleres (insumos), luego quien más paga, luego el campesino

// PRODUCCIÓN del campesino por campesino y año (× vocación del terreno × moral).
const GRAIN_YIELD=1.55;  // con diezmo (10%) y renta (10-28%) EN ESPECIE, al campesino le queda ~60-80% de la cosecha  // grano (× terreno × granja × cosecha); el campesino come 1 de su despensa. Con 1,2 el excedente
                         // (~30% de lo que come) triplicaba lo que compran ciudades y élites (~12% de la población)
const STORE_KEEP=0.5;    // el campesino guarda media despensa; lo que produzca por encima lo vende
// Lo que produce TODA provincia según su terreno (la categoría "mar" solo rinde en la COSTA: sal marina y pesca de bajura).
// Revisado 2026-09-27 con el informe regional (--regiones): sal y pescado faltaban en todo el Mediterráneo y el Este,
// los caballos solo salían en la estepa y el Norte no tenía cerveza. Bebida = vino/cerveza/hidromiel caseros.
const BASE2={materiales:[0.02,"bosque"], piedra:[0.004,"extractivo"], metal:[0.01,"extractivo"],
             ganado:[0.012,"ganado"], vino:[0.012,"cereal"], lienzo:[0.002,"cultivo"], lana:[0.012,"ganado"],
             sal:[0.006,"mar"], pescado:[0.006,"mar"], petroleo:[0.0005,"ganado"]};
// Ciudades-puerto de especias y ciudades sederas (su resType es de ciudad): el mercader las trae / el taller las teje,
// por habitante y año. Alejandría, Beirut, Venecia, Génova… eran la puerta de entrada de las especias en Europa.
const URBAN2={raros:0.05, seda:0.006};   // especias: solo por las puertas de entrada (SPICE_GATES), de ahí la tasa mayor
// Hierro: fuera de las 6 zonas mineras hay hierro de pantano y de ladera en casi todas partes (poco); en ellas, ×8.
const IRON_ZONE2=8;
// ESPECIALIDAD de la provincia (su resType de la v1, plegado a los 17 bienes) por campesino y año
const SPEC2={vino:0.06, seda:0.02, raros:0.02, sal:0.12, petroleo:0.02, lana:0.2, ganado:0.03, lienzo:0.03,
             pescado:0.12, pieles:0.04};
const FOLD2={vino:"vino",uva:"vino",sedacruda:"seda",sal:"sal",petroleo:"petroleo",lana:"lana",ganado:"ganado",
  cuero:"ganado",lino:"lienzo",algodon:"lienzo",pescado:"pescado",pieles:"pieles",ambar:"pieles",cana:"raros"};

// EDIFICIOS que venden a la plaza. Cada nivel produce BLD_VALUE ducados/año (a precio de referencia) × v.
// in = unidades de insumo por unidad de producto. raw = categoría de terreno que modula la extracción.
const BLD_VALUE=1500;    // (6000 rendía ~4× un taller de la v1 y se amortizaba en semanas: se construían por todas partes)
const BLD2={
  aserradero:{out:"materiales",raw:"bosque"}, cantera:{out:"piedra",raw:"extractivo"}, mina:{out:"metal",raw:"extractivo"},
  salina:{out:"sal"}, vinedo:{out:"vino"}, majuelo:{out:"vino"}, cerveceria:{out:"vino",in:{comida:0.5}},
  telar:{out:"pano",in:{lana:1},v:1.5}, telarLino:{out:"lienzo"}, linar:{out:"lienzo"}, fustaneria:{out:"lienzo"},
  algodonal:{out:"lienzo"}, sederia:{out:"seda",v:4}, morera:{out:"seda"}, especiar:{out:"raros",v:4}, canaveral:{out:"raros"},
  ingenio:{out:"raros"}, yeguada:{out:"petroleo"}, majada:{out:"lana",raw:"ganado"}, dehesa:{out:"ganado",raw:"ganado"},
  pesqueria:{out:"pescado"}, cazadero:{out:"pieles"}, ambarera:{out:"pieles"},
  herreria:{out:"herramientas",in:{metal:1},v:1.5}, armeria:{out:"armas",in:{metal:2},v:1.5}, aceria:{out:"armas",in:{metal:2},v:1.5},
};
// ARTESANOS: cada burgués trabaja en su oficio y produce ARTISAN_VALUE ducados/año (a precio de referencia) de
// manufacturas, repartidos según ARTISAN_MIX. Compra sus insumos en la plaza (misma receta que el taller: in por
// unidad) y paga el jornal a las hilanderas del campo. Es su ingreso: el burgués vive de lo que fabrica y vende.
const ARTISAN_VALUE=1.6;  // el oficio rinde ~2× la subsistencia (con 1,1 el grano solo ya se comía su jornal)
const ARTISAN_MIX={lienzo:0.45, pano:0.2, herramientas:0.35};       // oficio común (lienzo y herrería de aldea)
const ARTISAN_MIX_PANO={lienzo:0.1, pano:0.8, herramientas:0.1};   // ciudades pañeras (su especialidad es el paño):
                         // el paño fino se concentraba en Flandes, Italia e Inglaterra y desde allí se exportaba
const ARTISAN_MIX_ARMS={armas:0.5, herramientas:0.35, pano:0.15};  // centros armeros (Milán-Brescia, Núremberg, Toledo…): la forja es su oficio
const ARTISAN_IN={pano:{lana:1}, herramientas:{metal:1}, armas:{metal:2}};
const POOR_LINE=0.5;     // por debajo de este % de vida diaria cubierta, parte de los burgueses vuelve a campesino
// ============================== GEOGRAFÍA DE LOS RECURSOS (cronista, 2026-09-27) ==============================
// Cajas [latMin,latMax,lonMin,lonMax]. Fuentes y razonamiento: design/economia-v2.md §12. Lo esencial:
//  · la sal MARINA solo al sur de ~47°N (al norte no hay sol para evaporar y el Báltico es casi dulce): el Norte IMPORTA
//    sal de Bourgneuf e Iberia; tierra adentro, solo las minas de roca y salmuera.
//  · las ESPECIAS no se producen en el mapa: ENTRAN por Alejandría y Beirut-Damasco.
//  · Egipto y el Magreb casi sin madera ni hierro; en el islam casi no se bebe (vino/cerveza).
const SALT_SEA_LAT=47;
const SALT_POINTS=[[49.8,50.2,19.8,20.6],[53.0,53.5,10.1,10.7],[47.4,48.0,12.8,14.0],[46.7,47.1,5.6,6.1],[48.6,49.1,6.2,6.9],
  [53.0,53.5,-2.8,-2.2],[46.2,47.3,23.3,25.0],[57.8,58.2,31.0,31.6],[38.4,39.3,32.8,33.9],[44.9,46.2,33.3,35.5],
  [46.7,47.2,-2.4,-1.8],[45.6,46.1,-1.3,-0.8],[38.3,38.7,-9.1,-8.6],[36.2,36.8,-6.5,-5.9],[38.7,39.2,1.1,1.7],
  [37.8,38.2,12.3,12.7],[44.0,45.4,12.1,12.5],[34.5,35.2,32.9,33.8]];   // Wieliczka, Lüneburg, Salzkammergut, Salins, Lorena, Cheshire, Transilvania, Staraya Russa, Tuz Gölü, Crimea, Bourgneuf, Brouage, Setúbal, Cádiz, Ibiza, Trapani, Chioggia-Cervia, Chipre
const FISH_POINTS=[[55.2,56.3,12.3,14.6],[51.3,53.6,3.4,5.6],[59.8,63.5,4.3,7.5],[63,67,-25,-13],[52.2,53.1,0.9,2.0],
  [35.9,37.4,-7.6,-5.4],[36.5,38.4,12.2,15.8],[45.0,47.6,35.0,49.5]];   // Escania, Holanda-Zelanda, Noruega-Bergen, Islandia, East Anglia, almadrabas de Andalucía y Sicilia, Azov-Volga
const SPICE_GATES=[[30.9,31.5,29.6,30.3],[33.2,34.1,35.2,36.6]];      // Alejandría · Beirut-Damasco
const HORSE_POINTS=[[36.0,38.6,-7.6,-2.0],[40.4,41.9,15.0,18.6],[50.7,53.6,3.0,7.6],[45.8,48.6,17.8,22.6]]; // Andalucía, Apulia, Frisia-Flandes, Hungría (+ estepa por terreno)
const IRON_EXTRA2=[[42.6,43.3,9.9,11.4],[50.5,51.4,7.5,8.5],[42.1,42.6,23.2,23.9]]; // Elba-Toscana, Siegerland-Westfalia, Samokov
const ARMS_CENTERS=[[45.1,46.0,8.6,10.7],[49.0,49.9,10.6,11.6],[48.0,48.8,10.4,12.2],[48.4,48.8,12.9,13.6],[50.7,51.1,6.7,7.3],
  [39.6,40.1,-4.3,-3.7],[42.9,43.5,-3.3,-1.8]];                         // Milán-Brescia, Núremberg, Augsburgo-Landshut, Passau, Colonia, Toledo, Vizcaya
const ARID_LOW=[[20,31.6,24,35.5],[27,37.5,-10,11.5]];                  // Egipto (Nilo) y Magreb: casi sin madera ni hierro
const ISLAM=[[20,37.5,-10,35.5],[29,42.5,26,50]];                      // mundo islámico (Egipto-Magreb, Anatolia-Levante): apenas bebe
const ISLAM_EXCEPT=[[34.5,35.8,32,34.7],[34.8,35.7,23.4,26.4]];        // Chipre y Creta (cristianas)
const SALT_ZONE_RATE=0.4, FISH_ZONE_MUL=6, HORSE_ZONE_MUL=3, ARID_MUL=0.1, ISLAM_DRINK=0.12;
function ll(p){if(p._ll)return p._ll;return p._ll=pxToLonLat(p.x,p.y)}
function inBox(p,boxes){
  // Las cajas pequeñas (una mina, un puerto) pueden no contener el CENTRO de ninguna provincia: una caja cuenta para las
  // provincias cuyo centro cae dentro O a menos de NEAR_KM de su punto medio. Se cachea por lista de cajas.
  let set=_near.get(boxes);
  if(!set){set=new Set();
    for(const q of S.provs){if(!q||q.wasteland)continue;const[lo,la]=ll(q);
      for(const[a,b,c,d]of boxes){if(la>=a&&la<=b&&lo>=c&&lo<=d){set.add(q.id);break}
        const mla=(a+b)/2,mlo=(c+d)/2,dla=(la-mla)*111,dlo=(lo-mlo)*111*Math.cos(mla*Math.PI/180);
        if(dla*dla+dlo*dlo<NEAR_KM*NEAR_KM){set.add(q.id);break}}}
    _near.set(boxes,set)}
  return set.has(p.id);
}
const NEAR_KM=60; const _near=new Map();
function islamic(p){return inBox(p,ISLAM)&&!inBox(p,ISLAM_EXCEPT)}
// multiplicador geográfico de lo que produce TODA provincia (BASE2), por bien
function geoMul(p,g){
  switch(g){
    case "sal": return (p.coastal&&ll(p)[1]<SALT_SEA_LAT)?1:0;          // sal marina solo en el Sur; la de roca va aparte (SALT_POINTS)
    case "pescado": return inBox(p,FISH_POINTS)?FISH_ZONE_MUL:1;
    case "petroleo": return (inBox(p,HORSE_POINTS)||p.terrain==="estepa")?HORSE_ZONE_MUL:(inBox(p,ARID_LOW)?0.3:1);
    case "metal": return inBox(p,ARID_LOW)?ARID_MUL:(((p.metalMul!=null&&p.metalMul>1)||inBox(p,IRON_EXTRA2))?IRON_ZONE2:1);
    case "materiales": return inBox(p,ARID_LOW)?ARID_MUL:1;
    case "vino": return islamic(p)?ISLAM_DRINK:1;
  }
  return 1;
}
// DÓNDE se puede levantar cada taller en v2: donde está su materia (la especialidad de la provincia, la costa, el
// terreno). Sin esto la IA ponía salinas en el interior de Hungría, pesquerías lejos del mar y especias de la nada.
// Los que compran su materia en la plaza (telar, herrería, armería, cervecería) y los básicos van en cualquier sitio.
const RT=(...ks)=>p=>ks.indexOf(p.resType)>=0;
const TR=(...ts)=>p=>ts.indexOf(p.terrain)>=0;
const OR=(...fs)=>p=>fs.some(fn=>fn(p));
const SITE2={
  salina:OR(RT("sal"),p=>inBox(p,SALT_POINTS),p=>!!p.coastal&&ll(p)[1]<SALT_SEA_LAT), pesqueria:p=>!!p.coastal, cazadero:OR(RT("pieles","ambar"),TR("bosque","tundra")),
  ambarera:RT("ambar"), especiar:p=>inBox(p,SPICE_GATES), ingenio:RT("cana","azucar"), canaveral:RT("cana","azucar"),
  sederia:RT("seda","sedacruda"), morera:RT("seda","sedacruda"), yeguada:OR(RT("petroleo"),TR("estepa","pradera")),
  majada:OR(RT("lana"),TR("pradera","colinas","montana","estepa")), dehesa:OR(RT("ganado","cuero"),TR("pradera","estepa","llanura")),
  vinedo:RT("vino","uva"), majuelo:RT("vino","uva"), linar:RT("lino","lienzo","algodon"), algodonal:RT("algodon","fustan"),
  armeria:OR(RT("armas","acero"),p=>inBox(p,ARMS_CENTERS)), aceria:OR(RT("armas","acero"),p=>inBox(p,ARMS_CENTERS)),
  telarLino:OR(RT("lino","lienzo","algodon","fustan"),TR("vega","llanura","pradera")), fustaneria:RT("algodon","fustan","lino"),
};
function siteOK2(p,b){const f=SITE2[b];return !f||f(p)}
// Lo que la CORONA produce en sus propios edificios para sus obras y su ejército NO va a la plaza: va a su almacén.
const CROWN_STOCK=new Set(["materiales","piedra","metal","comida","petroleo"]);
// DUEÑO de los talleres sembrados al arrancar (el del resType de cada provincia). En la v1 eran todos de la corona
// porque su producción iba a su almacén; en la v2 se VENDE, y una corona dueña de toda la industria sería 5× más rica
// que en la v1 y dejaría sin oficio a burgueses y nobles. Cada uno, a su dueño histórico. La corona: regalías (minas).
const SEED_OWNER2={telar:"burgues",sederia:"burgues",especiar:"burgues",telarLino:"burgues",fustaneria:"burgues",
  herreria:"burgues",armeria:"burgues",aceria:"burgues",cerveceria:"burgues",ingenio:"burgues",pesqueria:"burgues",
  salina:"nobleza",yeguada:"nobleza",majada:"nobleza",dehesa:"nobleza",cazadero:"nobleza",mina:"nobleza",
  aserradero:"nobleza",cantera:"nobleza",granja:"nobleza",ambarera:"nobleza",
  vinedo:"clero",majuelo:"clero",colmenar:"clero",morera:"burgues",linar:"nobleza",algodonal:"nobleza",canaveral:"nobleza"};
function seedOwner2(b){return SEED_OWNER2[b]||"corona"}
// SIEMBRA de servicios de los estamentos al arrancar (v2), deducida del equilibrio simulado (tools/seed-rules.mjs,
// 2026-09-27): el cuartel de la nobleza en cada provincia RURAL de ≥2.000 hab. (coincide con lo que cada nobleza sostiene
// en 9 de 10 reinos grandes) y el templo del clero en cada CIUDAD de ≥20.000 hab. Sin mercado: en v2 no rinde.
const SEED_CUARTEL_POP=2000, SEED_TEMPLO_POP=20000;
function seedEstates2(p,seed){
  if(p.urban){if((p.pop||0)>=SEED_TEMPLO_POP)seed(p,"templo","clero")}
  else if((p.pop||0)>=SEED_CUARTEL_POP)seed(p,"cuartel","nobleza");
}
// Riqueza inicial: MESES_INICIALES de su cesta a precio de referencia (la de la v1 estaba en otra escala).
const START_MONTHS2=6;
function seedWealth2(){
  const str=Array.from({length:NPLAY},()=>{const o={};for(const k of STRATA)o[k]=0;return o});
  for(const p of S.provs){if(p.owner>=NPLAY||p.wasteland||!p.pops)continue;for(const k of STRATA)str[p.owner][k]+=p.pops[k]||0}
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N)continue;ensure2(N);
    for(const e of STRATA){let yr=0;for(const t of TIERS){const w=WANT2[e][t];if(w)for(const g in NEED2[t])yr+=NEED2[t][g]*w*ref(g)}
      N.sWealth[e]=yr*START_MONTHS2/12*str[n][e]}}
}
// Repertorio de obra de cada estamento en v2 (solo edificios que v2 entiende).
const ESTATE_BUILDS2={
  clero:["catedral","templo","vinedo","cerveceria","majada","universidad"],
  nobleza:["fortaleza","cuartel","granja","aserradero","cantera","mina","minaPlata","minaOro","yeguada","dehesa","majada"],
  burgues:["telar","telarLino","herreria","armeria","sederia","especiar","salina","pesqueria","cazadero"],
  // (mercado/gremio/puerto/almacén/lonja fuera: en v2 no rinden a su dueño —su goldAdd ya no crea dinero— hasta darles efecto)
};

// DINERO de cada venta a la plaza
const WEALTH_BOOST=2;    // quien tiene más de un año de cesta ahorrado pide hasta el TRIPLE de vida diaria y lujo
const RESERVE_MONTHS=3;  // un estamento aparta tantos meses de mantenimiento antes de gastar en su cesta (= BUDGET_MONTHS)
// DIEZMO EN ESPECIE: el clero se lleva la décima de TODA la cosecha a sus graneros y la vende en la plaza (así era en
// 1444). Cobrarlo solo sobre lo que el campesino vendía (~20% de lo producido) dejaba al clero en la ruina.
const DIEZMO_KIND=0.10;
const MARGIN=0.10;       // comisión del comerciante (burgués) sobre cada compra en la plaza
const JORNAL=0.20;       // de lo que cobra un taller, esta parte va como jornal a los campesinos de su provincia
const CAP_MONTHS=2;      // la plaza guarda como mucho tantos meses de demanda; el resto se tira
const TRADE_SHARE=0.5;   // fracción del SOBRANTE de la plaza que sale al comercio exterior cada día
const TRADE_MIN=0.02;    // margen neto mínimo (fracción del precio de referencia) para que compense mover
const COV_SMOOTH=1/720;  // ritmo (por hora) con que se asienta la cobertura de necesidades (~1 mes)

// ============================== helpers ==============================
// MANTENIMIENTO DE LOS SERVICIOS según la GENTE a la que sirven. Un cuartel, un templo o un almacén rinden en
// proporción a la población de su provincia (+25% de leva es un % de SUS hombres), así que deben COSTAR en proporción
// también. Con un coste fijo por edificio, el tamaño de las provincias del mapa decidía la fuerza de un reino:
// Moscovia (328 provincias de ~3.600 hab.) pagaba 7× más cuarteles por habitante que Castilla (94 de ~23.700).
// Referencia: una provincia de SERVICE_REF_POP habitantes paga el mantenimiento nominal. Fábricas y obras únicas, no.
const SERVICE_REF_POP=100000, SERVICE_MIN=0.03, SERVICE_MAX=1.5; // calibrado: un cuartel ≈20% de la renta noble de su provincia (con 20.000 se llevaba casi toda)
function upkeepScale(p,b){const B=BUILDINGS[b];
  if(B.unique||B.inputs||(B.fx&&(B.fx.prodAdd||B.fx.goldAdd)))return 1;
  return Math.max(SERVICE_MIN,Math.min(SERVICE_MAX,(p.pop||0)/SERVICE_REF_POP))}
function ref(g){return REF2[g]*PRICE_SCALE}
function transport(p,g){ // fracción del valor que se pierde llevando el bien de la provincia a su centro de comercio
  const km=(p&&p.hubKm!=null)?p.hubKm:0;
  return Math.min(FLETE_MAX,TRADE_KM2*km*(TRADE_BULK[BULK2[g]]||1)/REF2[g]);
}
function hubOfNation(n){const N=S.nations[n];if(!N||N.capital<0)return null;const c=S.provs[N.capital];if(!c)return null;
  return (c.hubOf!=null&&c.hubOf>=0&&S.provs[c.hubOf])||c}
let _km=new Map(),_kmKey="";
function kmSync2(){ // 1× por tick de comercio: invalida la caché si alguna capital cambió (conquista)
  let key="";for(let n=0;n<NPLAY;n++){const N=S.nations[n];key+=(N?N.capital:-1)+","}
  if(key!==_kmKey){_kmKey=key;_km=new Map()}
}
function hubKm(a,b){ // distancia entre los centros de comercio de dos reinos (cacheada)
  const k=a<b?a*1000+b:b*1000+a;let v=_km.get(k);
  if(v===undefined){const pa=hubOfNation(a),pb=hubOfNation(b);v=(pa&&pb)?kmBetween(pa,pb):Infinity;_km.set(k,v)}
  return v;
}
function pairBase(a,b){ // coste del PAR entre reinos por unidad de peso, en ducados de grano (∞ = cortado)
  if(isEmbargoed(a,b))return Infinity;
  const km=hubKm(a,b); if(!isFinite(km))return Infinity;
  let c=TRADE_KM2*km;
  const pa=hubOfNation(a),pb=hubOfNation(b); if(pa&&pb&&pa.coastal&&pb.coastal)c*=TRADE_SEA;
  if(atWarPair(a,b))c*=TRADE_WAR;
  return c;
}
function tradeCost2(g,a,b){return pairBase(a,b)*(TRADE_BULK[BULK2[g]]||1)/REF2[g]} // fracción del valor de referencia (UI)
// PARTES DE LA COSECHA en especie (opción 1 de Sergio, 2026-09-27): el clero se lleva el DIEZMO y el señor su RENTA
// (MANOR_RENT: solariego 28% nobleza · abadengo 22% clero · realengo 10% corona) de TODO lo que produce el campo, y los
// venden en la plaza. Lo que no encuentra comprador (grano) se queda en la aldea: la renta en especie que no se vendía
// la acababa comiendo la comarca. El campesino paga luego solo el PECHO sobre lo que vende de su parte.
function harvestShares(p){const m=manorOf(p);
  return {tithe:DIEZMO_KIND, rent:MANOR_RENT[m]||0, lord:m==="solariego"?"nobleza":(m==="abadengo"?"clero":"corona")}}
function pushHarvest(list,p,g,q,sh,N){
  list.push({p,g,q:q*(1-sh.tithe-sh.rent),kind:"camp"},{p,g,q:q*sh.tithe,kind:"tithe"},{p,g,q:q*sh.rent,kind:"rent",owner:sh.lord});
  N.e2.st.prodV+=q*REF2[g];
}
function addInc(N,o,v){if(v>0&&N.e2&&N.e2.incTick)N.e2.incTick[o]=(N.e2.incTick[o]||0)+v}
function ensure2(N){
  ensureMarket(N);
  if(!N.e2)N.e2={plaza:0,cover:{},cov:{}};
  if(!N.e2.st)N.e2.st={prodV:0,soldV:0,grossV:0,campNet:0,jornal:0}; // contadores de calibración (el arnés los lee y resetea)
  for(const e of STRATA)if(!N.e2.cov[e])N.e2.cov[e]={subs:1,vida:1,lujo:1};
}
function ledger(){return S.e2L||(S.e2L={mint:0,sink:0,rescue:0,discard:0})}
function crownPayee(p){return isOccupied(p)?p.occupier:p.owner} // lo que es de la corona en una provincia ocupada, se lo lleva el ocupante
// Producción ANUAL de un nivel de edificio v2 (a plena cobertura), para UI e IA.
function bldYear(p,b,lvl){
  const D=BLD2[b]; if(!D)return null;
  const mor=(p.morale||0)/100, st=staffing(p), terr=D.raw?terrCatMul(p,D.raw):1;
  return {g:D.out, q:lvl*BLD_VALUE*(D.v||1)/REF2[D.out]*mor*st*terr, in:D.in||null};
}
// Beneficio MENSUAL de un edificio (al precio actual): venta neta de transporte y jornal − insumos − mantenimiento.
function buildingProfit2(p,b,lvlArg){
  const lvl=lvlArg!=null?lvlArg:(p.buildings[b]||0); if(!lvl)return 0;
  const N=S.nations[p.owner]; const pr=g=>(N&&N.mktPrice&&N.mktPrice[g]!=null)?N.mktPrice[g]:ref(g);
  const B=BUILDINGS[b], y=bldYear(p,b,lvl); let v=0;
  if(y){v+=y.q*pr(y.g)*(1-MARGIN-alcabalaOf(p.owner))*(1-transport(p,y.g))*(1-JORNAL);
    if(y.in)for(const k in y.in)v-=y.q*y.in[k]*pr(k);}
  if(B.fx&&B.fx.prodAdd&&B.fx.prodAdd.dinero)v+=B.fx.prodAdd.dinero*lvl*YR_TICKS;
  v/=12;
  if(B.up&&B.up.dinero)v-=B.up.dinero/12*lvl*(YR_TICKS/12)*upkeepScale(p,b);
  return v;
}
function buildingOutput2(p,b,lvlArg){ // unidades/MES del bien del edificio (la IA dimensiona contra la demanda/mes)
  const lvl=lvlArg!=null?lvlArg:(p.buildings[b]||0); const y=bldYear(p,b,lvl);
  return y?{g:y.g,q:y.q/12}:{g:null,q:0};
}

// ============================== EL TICK ==============================
function economyTick2(dt=24,doArb=true){
  const f=dt/YR_TICKS, L=ledger();
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N)continue;ensure2(N);N.tollRate=0;N.alcabalaRate=0;N.almojRate=0;
    // INGRESO MENSUAL de cada dueño (media de ~1 mes): lo que de verdad le entra. La gestión por presupuesto lo compara con
    // su subsistencia + mantenimiento (no con la caja del día, que el consumo deja siempre rozando la reserva)
    const it=N.e2.incTick, inc=N.e2.inc||(N.e2.inc={});
    if(it&&N.e2.incDt){const k=Math.min(1,N.e2.incDt/720);for(const o of ["corona",...STRATA]){const v=(it[o]||0)/N.e2.incDt*730;inc[o]=inc[o]==null?v:inc[o]+(v-inc[o])*k}}
    N.e2.incTick={};N.e2.incDt=dt}
  // 0. mano de obra movilizada (la leva deja huecos en los talleres)
  for(const p of S.provs)p.mob=0;
  for(const a of S.armies)if(a.src)for(const pid in a.src){const P=S.provs[pid];if(P)P.mob+=a.src[pid]}

  // acumuladores por nación
  const strata=Array.from({length:NPLAY},()=>{const o={};for(const k of STRATA)o[k]=0;return o});
  const deliv=Array.from({length:NPLAY},()=>[]);             // entregas a la plaza: {p,g,q,kind,owner}
  const supply=Array.from({length:NPLAY},()=>({}));           // unidades entregadas este tick por bien
  const factNeed=Array.from({length:NPLAY},()=>({}));         // insumos pedidos: owner → {bien: q}
  const grainReq=Array.from({length:NPLAY},()=>[]);           // provincias con la despensa vacía: {p,q}
  const upMonth=Array.from({length:NPLAY},()=>({}));          // mantenimiento en dinero por estamento, al mes
  const pay=(n,who,amt,cat,estateSide)=>{ // abona a corona (tesoro) o a un estamento (su riqueza)
    if(!amt)return; const N=S.nations[n]; if(!N)return;
    if(who==="corona"){N.res.dinero+=amt}else{N.sWealth[who]+=amt;recFlow(n,who,cat,amt)}
    if(amt>0)N.e2.incTick[who]=(N.e2.incTick[who]||0)+amt;
  };

  // ---------------- PASADA A: producción provincial ----------------
  for(const p of S.provs){
    const n=p.owner; if(n>=NPLAY||p.wasteland||!p.pops)continue;
    const N=S.nations[n]; if(!N||!N.alive)continue;
    for(const k of STRATA)strata[n][k]+=p.pops[k]||0;
    const c=p.pops.campesino||0, mor=(p.morale||0)/100;
    // GRANO: el campesino come de su despensa; lo que desborda va a la plaza; si se vacía, pide comprar
    if(!p.store)p.store={};
    const cap=storeCap(p,"comida"); if(p.store.comida==null)p.store.comida=cap*0.6;
    const gprod=c*GRAIN_YIELD*terrMul(p,"comida")*(1+0.4*lvlOf(p,"granja"))*harvestMul(p)*f;
    const sh=harvestShares(p), kept=1-sh.tithe-sh.rent;   // DIEZMO y RENTA en especie sobre TODA la cosecha
    if(gprod>0){deliv[n].push({p,g:"comida",q:gprod*sh.tithe,kind:"tithe"},{p,g:"comida",q:gprod*sh.rent,kind:"rent",owner:sh.lord})} // la décima del grano, al granero del clero
    p.store.comida+=gprod*kept-c*f; N.e2.st.prodV+=gprod*REF2.comida;
    p._grainNeed=0;p._grainGot=0;
    // por encima de la mitad de la despensa, el excedente del tick se VENDE (el campesino vendía tras la cosecha, no
    // esperaba a tener el granero lleno); por debajo, rellena la despensa. Sin esto los primeros meses no hay grano en la plaza.
    const keep=cap*STORE_KEEP;
    if(p.store.comida>keep&&gprod>c*f){const q=Math.min(gprod-c*f,p.store.comida-keep);p.store.comida-=q;deliv[n].push({p,g:"comida",q,kind:"camp"})}
    if(p.store.comida>cap){const q=p.store.comida-cap;p.store.comida=cap;deliv[n].push({p,g:"comida",q,kind:"camp"})}
    else if(p.store.comida<0){p._grainNeed=-p.store.comida;p.store.comida=0;grainReq[n].push({p,q:p._grainNeed,got:0})}
    // lo que produce toda provincia + su especialidad
    for(const g in BASE2){const[r,cat]=BASE2[g];let q=c*r*terrCatMul(p,cat)*mor*f;
      q*=geoMul(p,g);
      if(q>0)pushHarvest(deliv[n],p,g,q,sh,N)}
    const sg=FOLD2[p.resType];
    const ug=inBox(p,SPICE_GATES)?"raros":(p.urban&&p.resType==="seda"?"seda":null);   // puertas de las especias (tenga el resType que tenga) · ciudades sederas
    if(ug&&!isOccupied(p)){const q=(p.pop||0)*URBAN2[ug]*mor*f;if(q>0)deliv[n].push({p,g:ug,q,kind:"bld",owner:"burgues"})}
    if(inBox(p,SALT_POINTS)){const q=c*SALT_ZONE_RATE*mor*f;if(q>0)pushHarvest(deliv[n],p,"sal",q,sh,N)} // mina de sal de roca/salmuera o gran salina
    if(sg&&!p.urban){const q=c*SPEC2[sg]*terrMul(p,p.resType)*mor*f;if(q>0)pushHarvest(deliv[n],p,sg,q,sh,N)}
    // ARTESANOS (burgueses de la provincia)
    const bu=p.pops.burgues||0;
    if(bu>0&&!isOccupied(p)){const fn=factNeed[n].burgues||(factNeed[n].burgues={});
      // el artesano trabaja en lo que MEJOR SE PAGA: su oficio base se reparte según el precio (² → responde rápido);
      // si el lienzo está por los suelos, teje menos lienzo y forja más herramientas o hace más paño
      const mix0=inBox(p,ARMS_CENTERS)?ARTISAN_MIX_ARMS:(p.resType==="pano"?ARTISAN_MIX_PANO:ARTISAN_MIX), mix={};let tw=0;
      for(const g in mix0){const r=(N.mktPrice[g]||ref(g))/ref(g);mix[g]=mix0[g]*r*r;tw+=mix[g]}
      for(const g in mix){const q=bu*ARTISAN_VALUE*(mix[g]/tw)/REF2[g]*mor*f, ins=ARTISAN_IN[g];
        let cov=1;if(ins)for(const k in ins){const v=N.e2.cover[k];if(v!=null&&v<cov)cov=v}
        if(q*cov>0)deliv[n].push({p,g,q:q*cov,kind:"bld",owner:"burgues"});
        if(ins)for(const k in ins)fn[k]=(fn[k]||0)+q*ins[k]}}
    // EDIFICIOS
    const st=staffing(p), mul=1+(provProdMul(p)-1)*st, terr=(TERRAINS[p.terrain]||{prod:1}).prod;
    for(const b in p.buildings){
      const lvl=effLvl(p,b); if(!lvl)continue;
      const B=BUILDINGS[b], fx=B.fx||{}, o=bOwnerOf(p,b);
      // mantenimiento: dinero → sumidero; bienes → la corona los descuenta de su almacén, un estamento los paga
      if(B.up)for(const k in B.up){const a=B.up[k]/12*lvl*dt*upkeepScale(p,b);
        if(k==="dinero"){if(o==="corona")N.res.dinero-=a;else{N.sWealth[o]-=a;recFlow(n,o,"Mantenimiento de edificios",-a);upMonth[n][o]=(upMonth[n][o]||0)+a/dt*730}L.sink+=a}
        else if(o==="corona")N.res[k]=(N.res[k]||0)-a;}  // el mantenimiento en BIENES es del almacén de la corona (unidades de la v1); un estamento solo paga el dinero
      if(isOccupied(p))continue; // ocupada: no produce para su dueño
      // minas de plata/oro: el ÚNICO dinero que nace sin venta (acuñación), contado aparte
      if(fx.prodAdd&&fx.prodAdd.dinero){const a=fx.prodAdd.dinero*lvl*mor*st*dt;pay(n,o,a,"Minas de plata y oro");L.mint+=a}
      // la corona abastece su almacén de obra y ejército (misma fórmula y unidades que la v1)
      if(o==="corona"&&fx.prodAdd){let used=false;
        for(const k in fx.prodAdd)if(CROWN_STOCK.has(k)){N.res[k]=(N.res[k]||0)+fx.prodAdd[k]*lvl*terr*mor*st*mul*dt;used=true}
        if(used)continue;}
      const D=BLD2[b]; if(!D||!siteOK2(p,b))continue;   // un taller fuera del sitio de su materia no produce
      const y=bldYear(p,b,lvl); const cov=inputCov(N,b);
      const q=y.q*mul*f;
      if(q*cov>0)deliv[n].push({p,g:D.out,q:q*cov,kind:"bld",owner:o});
      if(D.in){const fn=factNeed[n][o]||(factNeed[n][o]={});for(const k in D.in)fn[k]=(fn[k]||0)+q*D.in[k]}
    }
  }

  // ---------------- MERCADO de cada reino: precio, cobro de productores, compras ----------------
  const bought=Array.from({length:NPLAY},()=>({}));
  for(let n=0;n<NPLAY;n++){
    const N=S.nations[n]; if(!N||!N.alive)continue;
    const str=strata[n], W=N.sWealth, alc=alcabalaOf(n);
    if(N.e2.islam==null||N.e2.islamCap!==N.capital){const c=S.provs[N.capital];N.e2.islam=!!(c&&islamic(c));N.e2.islamCap=N.capital} // reino de capital islámica
    for(const d of deliv[n])supply[n][d.g]=(supply[n][d.g]||0)+d.q;   // oferta OFRECIDA (el precio la ve toda; la plaza compra solo lo que cabe)
    // demanda deseada por estamento, escalón y bien
    // want[e][g] = lo que pide; base[e][g] = su cesta sin extra (la cobertura se mide contra la base).
    // A quien le sobra más de un año de cesta, pide MÁS vida diaria y lujo (come y viste mejor), hasta ×(1+WEALTH_BOOST).
    const want={},base={};
    for(const e of STRATA){want[e]={};base[e]={};
      const bm=(N.e2.basket&&N.e2.basket[e])||0, spare=bm>0?Math.max(0,Math.min(1,(W[e]||0)/(12*bm)-1)):0;
      for(const t of TIERS){const w=WANT2[e][t];if(!w)continue;const boost=t==="subs"?1:1+WEALTH_BOOST*spare;
        for(const g in NEED2[t]){if(e==="campesino"&&g==="comida")continue; // el campesino come de su despensa; en el islam apenas se bebe
          const q=NEED2[t][g]*w*str[e]*f*(g==="vino"&&N.e2.islam?ISLAM_DRINK:1); base[e][g]=(base[e][g]||0)+q; want[e][g]=(want[e][g]||0)+q*boost}}}
    const dem={};
    for(const e of STRATA)for(const g in want[e])dem[g]=(dem[g]||0)+want[e][g];
    for(const r of grainReq[n])dem.comida=(dem.comida||0)+r.q;
    for(const o in factNeed[n])for(const g in factNeed[n][o])dem[g]=(dem[g]||0)+factNeed[n][o][g];
    // PRECIO = referencia × demanda/oferta, acotado a ×0,5..×3
    const price={};
    for(const g of GOODS2){const sup=(N.mkt[g]||0)+(supply[n][g]||0), d=dem[g]||0;
      const r=sup>0?(d>0?d/sup:0):(d>0?3:1);
      price[g]=ref(g)*Math.max(0.5,Math.min(3,r)); N.mktPrice[g]=price[g]}
    // la plaza solo COMPRA lo que puede vender este tick o guardar (hasta CAP_MONTHS de demanda): la mercancía que no
    // acepta no se paga (si no, crearía dinero por bienes que se tiran). El grano rechazado vuelve a la despensa.
    const acc={},unsold={};
    for(const g of GOODS2){const sup=supply[n][g]||0;if(!sup){acc[g]=1;continue}
      const room=(dem[g]||0)+Math.max(0,(dem[g]||0)/dt*730*CAP_MONTHS-(N.mkt[g]||0));
      acc[g]=Math.min(1,room/sup);unsold[g]=(1-acc[g])*sup/dt*730}
    // la PLAZA paga a los productores (el dinero nace aquí)
    for(const d0 of deliv[n]){
      const a=acc[d0.g]; if(a<1&&d0.g==="comida"&&d0.p.store)d0.p.store.comida=Math.min(storeCap(d0.p,"comida"),d0.p.store.comida+d0.q*(1-a));
      const d=a<1?{...d0,q:d0.q*a}:d0; if(d.q<=0)continue;
      const p=d.p, val=d.q*price[d.g]*(1-MARGIN-alc), t=transport(p,d.g);
      const net=val*(1-t), toll=val*t*TOLL_FRAC;
      N.e2.plaza-=net+toll;
      N.mkt[d.g]=(N.mkt[d.g]||0)+d.q;
      if(toll>0){const m=manorOf(p);
        if(m==="abadengo")pay(n,"clero",toll,"Portazgo");else if(m==="solariego")pay(n,"nobleza",toll,"Portazgo");
        else{pay(crownPayee(p),"corona",toll);const C=S.nations[crownPayee(p)];if(C)C.tollRate+=toll/dt}}
      if(d.kind==="camp"){const rr=repartoRates(p,taxRateOf(n));
        N.e2.st.soldV+=d.q*REF2[d.g]; N.e2.st.campNet+=net*(1-taxRateOf(n)); N.e2.st.grossV+=d.q*price[d.g];
        // diezmo y renta ya se cobraron EN ESPECIE: sobre lo que vende de SU parte, el campesino solo paga el pecho
        const tax=taxRateOf(n); pay(crownPayee(p),"corona",net*tax); pay(n,"campesino",net*(1-tax),"Ventas en la plaza")}
      else if(d.kind==="rent"){if(d.owner==="corona")pay(crownPayee(p),"corona",net);else pay(n,d.owner,net,"Renta del señorío (en especie)")}
      else if(d.kind==="tithe")pay(n,"clero",net,"Diezmo (en especie)");
      else{const j=net*JORNAL;N.e2.st.jornal+=j;pay(n,"campesino",j,"Jornales");pay(n,d.owner,net-j,"Ventas de sus talleres")}
    }
    // COMPRAS: quien compra paga el precio; comisión al burgués, alcabala a la corona, el resto a la plaza
    const got={},gapStock={};for(const e of STRATA)got[e]={};
    const reserve={};for(const e of STRATA)reserve[e]=RESERVE_MONTHS*(upMonth[n][e]||0); // meses de mantenimiento que cada estamento no gasta en su cesta
    const buy=(who,g,need,onCredit)=>{ // devuelve lo comprado. onCredit: pedido de taller (cuenta entero como hueco a importar)
      const noReserve=onCredit||TIER_OF[g]==="subs";   // la subsistencia y los insumos no esperan a la reserva de mantenimiento
      if(need<=0)return 0; const stock=N.mkt[g]||0, pr=price[g];
      const purse=who==="corona"?Math.max(0,N.res.dinero):Math.max(0,(W[who]||0)-(noReserve?0:(reserve[who]||0))); // vida y lujo respetan la reserva de mantenimiento
      const aff=Math.min(need,purse/pr), q=Math.min(aff,stock); gapStock[g]=(gapStock[g]||0)+Math.max(0,(onCredit?need:aff)-q); if(q<=0)return 0;
      const cost=q*pr; N.mkt[g]=stock-q;
      if(who==="corona")N.res.dinero-=cost;else W[who]-=cost;
      W.burgues+=cost*MARGIN; N.res.dinero+=cost*alc; N.e2.incTick.burgues=(N.e2.incTick.burgues||0)+cost*MARGIN; N.e2.incTick.corona=(N.e2.incTick.corona||0)+cost*alc; N.alcabalaRate+=cost*alc/dt; N.e2.plaza+=cost*(1-MARGIN-alc);
      recFlow(n,"burgues","Comisión de la plaza",cost*MARGIN);
      if(who!=="corona"){recFlow(n,who,"Compras",-cost);recBuy(n,who,g,q,cost)}
      bought[n][g]=(bought[n][g]||0)+q; return q;
    };
    // 1) grano para las despensas vacías (antes que nadie: es hambre)
    for(const r of grainReq[n]){r.got=buy("campesino","comida",r.q);r.p._grainGot=r.got}
    // 2) talleres: su materia prima (es capital de trabajo, va antes que el consumo de sus dueños)
    const coverIn={};
    for(const o in factNeed[n])for(const g in factNeed[n][o]){const need=factNeed[n][o][g];const q=buy(o,g,need,true); // la materia prima se servía a crédito al taller: el pedido entero atrae al mercader
      const ci=coverIn[g]||(coverIn[g]={need:0,got:0});ci.need+=need;ci.got+=q}
    // 3) élites por orden de bolsillo  4) campesino
    for(const e of BUY_ORDER)for(const g in want[e])got[e][g]=buy(e,g,want[e][g]);
    for(const g in want.campesino)got.campesino[g]=buy("campesino",g,want.campesino[g]);
    // cobertura de insumos (la leen los talleres el próximo tick)
    for(const g in coverIn){const c=coverIn[g].need>0?coverIn[g].got/coverIn[g].need:1;
      N.e2.cover[g]=c; N.inputCover[g]=c}
    // cobertura de las TRES NECESIDADES por estamento (por valor), asentada ~1 mes
    const k=Math.min(1,COV_SMOOTH*dt);
    for(const e of STRATA)for(const t of TIERS){
      if(!WANT2[e][t]){N.e2.cov[e][t]=1;continue}
      let nv=0,gv=0;for(const g in NEED2[t]){if(e==="campesino"&&g==="comida")continue;
        const w=base[e][g]||0;nv+=w*REF2[g];gv+=Math.min(w,got[e][g]||0)*REF2[g]}
      if(e==="campesino"&&t==="subs"){ // su grano: lo que no tuvo que comprar + lo que pudo comprar
        let need=0,miss=0;for(const r of grainReq[n]){need+=r.q;miss+=r.q-r.got}
        const tot=(str.campesino||0)*f; nv+=tot*REF2.comida; gv+=(tot-miss)*REF2.comida}
      const c=nv>0?gv/nv:1; N.e2.cov[e][t]+=(c-N.e2.cov[e][t])*k}
    // coste MENSUAL de la cesta de cada estamento al precio de hoy: la IA de obras invierte solo lo que sobra tras
    // asegurarse INVEST_MONTHS de cesta (si no, las élites lo meten todo en talleres y dejan de consumir)
    if(!N.e2.basket)N.e2.basket={};
    if(!N.e2.subsCost)N.e2.subsCost={};
    for(const e of STRATA){let m=0,sm=0;for(const g in base[e]){const v=base[e][g]*price[g];m+=v;if(TIER_OF[g]==="subs")sm+=v}
      N.e2.basket[e]=m/dt*730; N.e2.subsCost[e]=sm/dt*730}   // /mes: cesta completa y solo subsistencia
    N.prosp=N.e2.cov.burgues.vida;                             // el ascenso a burgués sigue a la vida diaria del burgués
    // la plaza no guarda más de CAP_MONTHS de demanda: el resto se tira
    for(const g of GOODS2){const capS=(dem[g]||0)/dt*730*CAP_MONTHS, s=N.mkt[g]||0;
      if(s>capS){L.discard+=(s-capS)*price[g];N.mkt[g]=capS}}
    // demanda que se quedó sin cubrir POR FALTA DE MERCANCÍA: es lo único que un mercader puede venir a vender
    if(!N.e2.gap)N.e2.gap={};
    for(const g of GOODS2)N.e2.gap[g]=gapStock[g]||0;   // lo que se habría comprado (había dinero) pero no había mercancía
    // telemetría para el panel (unidades/mes)
    if(!N.mktInfo)N.mktInfo={};
    for(const g of GOODS2){const d=dem[g]||0,b=bought[n][g]||0;
      N.mktInfo[g]={dem:d/dt*730,sold:b/dt*730,prod:(supply[n][g]||0)/dt*730,unsold:unsold[g]||0,short:b<d*0.98,price:price[g],exp:0,imp:0}}
    // riqueza negativa (mantenimiento sin fondos): se rescata a 0 y se cuenta como grifo
    for(const e of STRATA)if(W[e]<0){L.rescue+=-W[e];W[e]=0}
  }

  // ---------------- EJÉRCITO: mantenimiento y comida (como en la v1) ----------------
  for(const a of S.armies){if(a.nation>=NPLAY)continue;const R=S.nations[a.nation].res;
    for(const k in a.units){const u=UNITS[k].up||{};for(const r in u){const v=u[r]*a.units[k]*dt;R[r]=(R[r]||0)-v;if(r==="dinero")L.sink+=v}}
    const food=armyFood(a)*dt; if(food<=1e-9)continue;
    const forage=(a.supply==null?70:a.supply)/100;
    R.comida=Math.max(0,(R.comida||0)-food*(1-forage));
    const localNeed=food*forage;
    if(localNeed>1e-9){const P=S.provs[a.prov],pool=[];
      if(P&&!P.wasteland&&P.store&&P.store.comida>0)pool.push(P);
      for(const nb of (S.adj[a.prov]||[])){const q=S.provs[nb];if(q&&!q.wasteland&&q.store&&q.store.comida>0)pool.push(q)}
      let avail=0;for(const q of pool)avail+=q.store.comida;
      if(avail>0){const take=Math.min(localNeed,avail);for(const q of pool)q.store.comida-=take*(q.store.comida/avail)}}
  }
  for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N||!N.alive)continue;
    for(const k in N.res)if(k!=="dinero"&&N.res[k]<0)N.res[k]=0}

  // ---------------- DEMOGRAFÍA: hambre, crecimiento, ascensos, leva ----------------
  const regen=Math.min(1,SOLD_REGEN*dt);
  for(const p of S.provs){
    if(p.wasteland||p.owner>=NPLAY||!p.pops)continue;
    const N=S.nations[p.owner]; if(!N||!N.e2)continue;
    const pop0=p.pop||0, c=p.pops.campesino||0; let famine=false;
    if(p._grainNeed>0){const left=p._grainNeed-(p._grainGot||0);
      const cons=c*f; if(cons>0&&left/cons>FAMINE_DEF){p.pop=Math.max(0,pop0-left*STARVE_RATE);famine=true}}
    p.famine=famine;
    if(!famine){const cap=storeCap(p,"comida"),fill=cap>0?p.store.comida/cap:0;
      const vida=N.e2.cov.campesino.vida;
      p.pop=pop0*(1+POP_GROWTH_BASE*(0.4+fill)*(0.5+0.5*vida)*dt)}
    if(pop0>0){const r=(p.pop||0)/pop0;for(const k in p.pops)p.pops[k]*=r}
    const base=(p.pops.campesino||0)+(p.pops.burgues||0);
    if(base>0){let move=(targetBurgFrac(p)*base-(p.pops.burgues||0))*PROMO_RATE*dt;
      if(move>0)move*=Math.max(0,N.prosp==null?1:N.prosp);
      if(N.prosp!=null&&N.prosp<POOR_LINE)move-=(p.pops.burgues||0)*PROMO_RATE*dt*(POOR_LINE-N.prosp)*2; // el artesano que no gana para vivir vuelve al campo
      move=Math.max(-p.pops.burgues,Math.min(p.pops.campesino,move));p.pops.burgues+=move;p.pops.campesino-=move}
    const sc=soldCap(p),s=p.sold!=null?p.sold:sc;p.sold=s+(sc-s)*regen;
  }

  // ---------------- COMERCIO ENTRE REINOS (arbitraje de muchos a muchos) ----------------
  if(!doArb)return;
  kmSync2();
  // coste de cada PAR de reinos (km × mar × guerra; ∞ si embargo), 1 vez por tick; cada bien lo escala por su peso
  const live=[];for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(N&&N.alive&&N.e2)live.push(n)}
  const K=live.length, pairF=new Float64Array(K*K);
  for(let i=0;i<K;i++)for(let j=i+1;j<K;j++){const v=pairBase(live[i],live[j]);pairF[i*K+j]=v;pairF[j*K+i]=v}
  for(const g of GOODS2){
    const w=(TRADE_BULK[BULK2[g]]||1)*PRICE_SCALE, minM=TRADE_MIN*ref(g);   // coste = pairF × peso (el ÷precio y ×precio se cancelan)
    const node=live.map((n,i)=>{const N=S.nations[n];return{n,N,i,p:N.mktPrice[g]!=null?N.mktPrice[g]:ref(g)}});
    // el mercader lleva SOLO lo que al destino le falta (su demanda sin cubrir) y SOLO lo que al origen le sobra:
    // así la mercancía no rebota entre plazas cobrando margen en cada viaje
    for(const B of node)B.gap=B.N.e2.gap?B.N.e2.gap[g]||0:0;
    for(const A of node){
      if(A.gap>0)continue;                                                      // quien no cubre su propia demanda no exporta
      const cupo=(A.N.mkt[g]||0)*Math.min(1,TRADE_SHARE*dt/24); if(cupo<=1e-9)continue;
      let tot=0;const cand=[];
      for(const B of node){if(B===A||B.gap<=1e-9||B.p-A.p<minM)continue;      // sin hueco que llenar, o ni sin flete compensaría
        const cost=pairF[A.i*K+B.i]*w, m=B.p-A.p-cost;
        if(m>=minM){cand.push({B,cost,m});tot+=m}}
      if(!cand.length)continue;
      for(const c of cand){const B=c.B;const q=Math.min(cupo*(c.m/tot),B.gap);if(q<=1e-9)continue;B.gap-=q;
        A.N.mkt[g]-=q; B.N.mkt[g]=(B.N.mkt[g]||0)+q;
        A.N.e2.plaza+=q*A.p; B.N.e2.plaza-=q*B.p; L.sink+=q*c.cost;          // la plaza de origen vende, la de destino compra; el flete se pierde
        const half=q*c.m*0.5, tA=half*almojOf(A.n), tB=half*almojOf(B.n);   // el mercader se queda el margen neto, menos la aduana
        A.N.res.dinero+=tA; A.N.almojRate+=tA/dt; A.N.sWealth.burgues+=half-tA; addInc(A.N,"corona",tA); addInc(A.N,"burgues",half-tA); recFlow(A.n,"burgues","Comercio exterior",half-tA);
        B.N.res.dinero+=tB; B.N.almojRate+=tB/dt; B.N.sWealth.burgues+=half-tB; addInc(B.N,"corona",tB); addInc(B.N,"burgues",half-tB); recFlow(B.n,"burgues","Comercio exterior",half-tB);
        A.N.mktInfo[g].exp+=q/dt*730; B.N.mktInfo[g].imp+=q/dt*730}
    }
  }
}
function inputCov(N,b){const D=BLD2[b];if(!D||!D.in)return 1;let c=1;for(const k in D.in){const v=N.e2.cover[k];if(v!=null&&v<c)c=v}return c}

// Dinero total en circulación de todo el mundo (para el invariante del arnés).
function moneyStock(){let m=0,pl=0;for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N)continue;m+=N.res.dinero||0;
  if(N.sWealth)for(const k in N.sWealth)m+=N.sWealth[k];if(N.e2)pl+=N.e2.plaza}return{m,pl}}

export { economyTick2, siteOK2, seedEstates2, upkeepScale, seedOwner2, seedWealth2, GOODS2, LABEL2, REF2, NEED2, WANT2, TIERS, BLD2, ESTATE_BUILDS2, buildingProfit2, buildingOutput2,
  transport, tradeCost2, moneyStock, PRICE_SCALE, JORNAL, MARGIN };
