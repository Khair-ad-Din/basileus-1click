// economy2.js — ECONOMÍA v2 "una sola regla" (design/economia-v2.md).
//
// LA REGLA: el dinero solo nace cuando alguien VENDE un bien a la plaza; cada ducado que se paga lo cobra alguien.
// La PLAZA (N.e2.plaza) es el intermediario de cada reino: paga al productor cuando entrega y cobra al consumidor
// cuando compra. Su saldo acumulado es exactamente el dinero creado (−) o destruido (+) por el comercio. Aparte de
// ella, solo hay tres grifos/sumideros EXPLÍCITOS y contados en S.e2L: minas de plata/oro (acuñación), mantenimiento
// en dinero (edificios y ejército) y el flete del comercio entre reinos. El arnés (tools/verify-v2.mjs) comprueba:
//      Σ(tesoros + riqueza de estamentos) + Σ plazas + sumideros − grifos = constante.
//
// Es la ÚNICA economía del juego (la v1 se borró el 2026-09-27); economy.js conserva lo compartido (despensa, tasas, libros…).
// Unidades: 1 unidad = lo que come UNA persona en UN año de grano. Rates "por persona y año"; el tick multiplica
// por f = dt/YR_TICKS. Precios de referencia en ducados/unidad (grano = 1 × PRICE_SCALE).
import { NPLAY, BUILDINGS, UNITS, STRATA, TERRAINS } from "./config.js";
import { S } from "./state.js";
import { kmBetween, pxToLonLat, ensureMarketTopology } from "./mapgen.js";
import { isEmbargoed, atWarPair } from "./diplomacy.js";
import { BKEYS, calOf, harvestMonth, monthsToHarvest, ledger, sinkAdd, canAfford, isOccupied, effLvl, lvlOf, bOwnerOf, manorOf, taxRateOf, alcabalaOf, almojOf, harvestMul, terrMul, DIEZMO, terrCatMul, staffing, storeCap, armyFood, soldCap, provProdMul, ensureMarket, recFlow, recBuy, recCrown, YR_TICKS, TRADE_KM, TRADE_SEA, TRADE_WAR, TRADE_BULK, MANOR_RENT, TOLL_FRAC, FLETE_MAX, FAMINE_DEF, STARVE_RATE, POP_GROWTH_BASE, SOLD_REGEN, PROMO_RATE, targetBurgFrac, monthKeyOf } from "./economy.js";

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
const GRAIN_YIELD=1.35;  // cosecha por campesino y año (× terreno × año del ducado). Con el granero del ducado, lo que no se
                         // vende vuelve al granero y alimenta la natalidad: con 1,55 sobraba ~50% y no había hambre en décadas.
                         // 1,40 (medido a 25 años): hambre notable en alguna región cada ~5 años, grande (20-35 ducados) cada ~6-8,
                         // ~0,5% de muertos en 25 años, la población crece ~0,5%/año; pero por granero, una cada 50-100 años en
                         // Occidente: poco para la carestía local. 1,35 por decisión de Sergio (2026-09-28)
                         // (~30% de lo que come) triplicaba lo que compran ciudades y élites (~12% de la población)
// GRANERO DEL DUCADO (design/grano-ducado.md): las provincias de un ducado (del mismo dueño) guardan su grano en común.
// De él comen sus campesinos; vende a la plaza del reino SOLO lo que sobra por encima de lo que necesitan hasta la
// próxima siega (× GRAIN_RESERVE); lo que no cabe se vende entero. Si se vacía, compra en la plaza pagando el precio
// MÁS EL FLETE desde su centro de comercio: el grano es lo más caro de mover, así que el ducado remoto o de montaña lo
// paga más caro (limitado por coste, no por cantidad: Granada puede importarlo si puede pagarlo).
const GRAIN_RESERVE=1.2;  // guarda un 20% más de lo que necesita hasta la próxima siega antes de vender
const GRAIN_SELL_DAYS=30; // el sobrante se va vendiendo en ~un mes (no de golpe)
// NATALIDAD: el grano acumulado se convierte en súbditos (más grano → más natalidad → más consumo → equilibrio). Es el
// tope natural del exceso de alimento y el motor de crecimiento que quiere todo rey. Meses de reserva → factor.
// RENDIMIENTO DECRECIENTE (design/capacidad-agraria.md): la cosecha por campesino según la ocupación x = campesinos / K
// de su provincia (p.K, mapgen.js seedLandCap). Rinde pleno hasta LAND_FULL (tierra de sobra); por encima, cada
// campesino nuevo labra peor tierra y parcelas más pequeñas; con x = 1, en un año normal y en tierra de fertilidad
// media, la cosecha por cabeza es justo lo que come (1/GRAIN_YIELD). Por encima de 1 no se alimentan: el hambre la
// pone el granero de siempre, en cuanto se encadenan los malos años. La ciudad no tiene techo: come de la plaza.
// LAND_FULL 0,8 (medido, variante D): con 0,7 Europa arrancaba en 1444 ya dentro de la banda decreciente (x ≈ 0,77-0,80)
// y pasaba hambre desde el primer mal año. En la práctica el techo queda en x ≈ 0,88: hace falta margen para el mal año.
const LAND_FULL=0.8, LAND_FLOOR=0.25;
const LAND_SLOPE=(1-1/GRAIN_YIELD)/(1-LAND_FULL);
// EL TECHO SE DESPLAZA: capacidad = tierra de 1444 (p.K, fija) × lo que sabe cultivar la NACIÓN (N.agro: tecnologías de
// roturación, rotación, arado, cultivos nuevos — el árbol tecnológico, futuro) × las obras de la provincia (drenaje,
// regadío: futuro, se multiplican aquí). El reino que no lo desplaza vive pegado al techo y lo paga en hambrunas.
function landCap(p){const K=p.K||0;if(!(K>0))return 0;const N=S.nations[p.owner];return K*(N&&N.agro>0?N.agro:1)}
function landOcc(p){const K=landCap(p);return K>0?(p.pops.campesino||0)/K:0}
function landYield(p){const x=landOcc(p);
  return x<=LAND_FULL?1:Math.max(LAND_FLOOR,1-LAND_SLOPE*(x-LAND_FULL))}
// FRENO PREVENTIVO: con la tierra llena, parcelas pequeñas → boda tardía → menos nacimientos (el patrón de Hajnal).
// Parcial a propósito: en x = 1 la natalidad sigue a ×LAND_BIRTH_AT_K, así que la población sigue empujando contra el
// techo. Quien lo desplaza convierte ese empuje en crecimiento; quien no, lo paga en hambre cada mal año.
const LAND_BIRTH_AT_K=0.4, LAND_BIRTH_MIN=0.15;
function landBirth(p){const x=landOcc(p);
  return x<=LAND_FULL?1:Math.max(LAND_BIRTH_MIN,1-(1-LAND_BIRTH_AT_K)*(x-LAND_FULL)/(1-LAND_FULL))}
// LA VÁLVULA DEL OFICIO (consejo 2026-09-28, decisión 5 del artesano): cuando la tierra aprieta, el campesino no solo
// pasa hambre: hila y teje a destajo en su casa (Prato 1390-92: 88 cardadores en el taller frente a ≥356 hilanderas en
// las aldeas). Por encima de LAND_FULL la fracción objetivo de burgueses sube hasta +LAND_VALVE en x = 1. Es NECESIDAD,
// no atracción: no espera a que los burgueses prosperen; pero si el oficio no da para vivir (POOR_LINE), vuelven al
// campo igual que los demás. El que sale de la tierra come de la plaza: la presión pasa al precio del grano.
const LAND_VALVE=0.10;
function landPush(p){const x=landOcc(p);return x<=LAND_FULL?0:LAND_VALVE*Math.min(1,(x-LAND_FULL)/(1-LAND_FULL))}
function foodGrowth(months){return months<=1?0.3:months<=12?0.3+0.7*(months-1)/11:Math.min(1.8,1+0.8*(months-12)/6)}
// Lo que produce TODA provincia según su terreno (la categoría "mar" solo rinde en la COSTA: sal marina y pesca de bajura).
// Revisado 2026-09-27 con el informe regional (--regiones): sal y pescado faltaban en todo el Mediterráneo y el Este,
// los caballos solo salían en la estepa y el Norte no tenía cerveza. Bebida = vino/cerveza/hidromiel caseros.
const BASE2={materiales:[0.02,"bosque"], piedra:[0.004,"extractivo"], metal:[0.01,"extractivo"],
             ganado:[0.012,"ganado"], vino:[0.012,"cereal"], lienzo:[0.002,"cultivo"], lana:[0.012,"ganado"],
             sal:[0.006,"mar"], pescado:[0.006,"mar"], petroleo:[0.0005,"ganado"]};
// Ciudades-puerto de especias y ciudades sederas (su resType es de ciudad): el mercader las trae / el taller las teje,
// por habitante y año. Alejandría, Beirut, Venecia, Génova… eran la puerta de entrada de las especias en Europa.
const URBAN2={raros:0.4, seda:0.006};    // especias: solo por las puertas de entrada (SPICE_GATES), de ahí la tasa mayor.
                         // 0,05 dejaba la oferta en el 23% de la demanda y el precio en el techo ×3; en 1444 la pimienta ya
                         // había salido del pico de 1410-27 y Alejandría/Beirut ofrecían más (Ashtor; O'Rourke-Williamson):
                         // objetivo ~×1 (consejo 2026-09-27)
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
  granja:{out:"comida",raw:"cereal"},   // explotación directa del señor (reserva, granja cisterciense): su grano es de su DUEÑO
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
const ARTISAN_IN={pano:{lana:1}, herramientas:{metal:1}, armas:{metal:2}};   // (misma receta que BLD2)
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
const IRON_EXTRA2=[[42.6,43.3,9.9,11.4],[50.5,51.4,7.5,8.5],[42.1,42.6,23.2,23.9], // Elba-Toscana, Siegerland-Westfalia, Samokov
  [42.9,43.45,-3.4,-1.7],[49.2,49.8,11.4,12.3],[47.2,47.8,14.4,15.3],[59.4,60.8,14.0,16.2]];
  // + País Vasco (ferrerías de Vizcaya-Guipúzcoa: Inglaterra importaba su hierro "casi todo de España", Childs 1981),
  //   Alto Palatinado (Amberg-Sulzbach, Hammereinung 1387), Erzberg de Estiria, Bergslagen-Dalarna (hierro osmund).
  //   Weald NO: su auge es posterior a 1490 (cronista, consejo 2026-09-27)
const IRON_MINOR2=[[51.6,52.0,-2.8,-2.3]]; // Forest of Dean: el distrito férreo de Inglaterra, en declive (33 forjas hacia 1435)
const IRON_MINOR_MUL=3;
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
    case "metal": return inBox(p,ARID_LOW)?ARID_MUL:(((p.metalMul!=null&&p.metalMul>1)||inBox(p,IRON_EXTRA2))?IRON_ZONE2:inBox(p,IRON_MINOR2)?IRON_MINOR_MUL:1);
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
// Edificios heredados de la v1 que en esta economía NO HACEN NADA: producen bienes que ya no existen (tinte, aceite,
// cera, carbón, cobre, vidrio…) o solo daban oro "de la nada" (mercado, lonja). No se siembran al arrancar, no se
// ofrecen al jugador y nadie los construye (su mantenimiento era dinero tirado hasta que el presupuesto los cerraba).
function obsolete2(b){const B=BUILDINGS[b]; if(!B||BLD2[b])return false; const fx=B.fx||{};
  if(fx.prodAdd)return !Object.keys(fx.prodAdd).some(k=>CROWN_STOCK.has(k)||k==="dinero");
  return !!fx.goldAdd&&Object.keys(fx).every(k=>k==="goldAdd")&&!B.unlock}
// Lo que DISTINGUE a la provincia en v2 (para la ficha): su especialidad plegada a los 17 bienes y lo que da su sitio
// (puerta de las especias, ciudad sedera o pañera, salina/mina de sal, centro armero). Solo lectura (UI).
function specialty2(p){const s=[],add=g=>{if(s.indexOf(g)<0)s.push(g)};
  if(inBox(p,SPICE_GATES))add("raros");
  if(p.urban&&p.resType==="seda")add("seda");
  if(p.urban&&p.resType==="pano")add("pano");
  const sg=FOLD2[p.resType]; if(sg&&!p.urban)add(sg);
  if(inBox(p,SALT_POINTS))add("sal");
  if(inBox(p,ARMS_CENTERS))add("armas");
  return s}
// Lo que la CORONA produce en sus propios edificios para sus obras y su ejército NO va a la plaza: va a su almacén.
const CROWN_STOCK=new Set(["materiales","piedra","metal","comida","petroleo"]);
const CROWN_STOCK_WANT=3000;   // unidades en el almacén de la corona por debajo de las cuales le HACE FALTA producir ese bien
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
// CONTRATOS DE COMERCIO (design/precios-cadencia.md §3): una vez al mes el mercader firma cuánto llevará cada día de un
// reino a otro, con la PREVISIÓN de oferta y demanda (la que se puede pagar) y los precios de la semana; se entrega a
// diario. Antes el mercader diario solo traía lo que al importador le FALTÓ AYER: lo traído se vendía y se abría un hueco
// igual, así que el importador recibía la mitad de lo que podía pagar (especias: ~40% vendido con oferta = demanda).
const CONTRACT_DAYS=30;  // cada cuántos días se renuevan los contratos (el mes del mercader; la muda, la feria)
const TRADE_MIN=0.02;    // margen neto mínimo (fracción del precio de referencia) para que compense mover
const COV_SMOOTH=1/720;  // ritmo (por hora) con que se asienta la cobertura de necesidades (~1 mes)
// RELOJ SEMANAL — el DÍA DE MERCADO (design/precios-cadencia.md §2). El precio se fija una vez por semana y toda la
// semana se compra y vende a ese precio; lo que sobra o falta cada día lo absorbe el stock de la plaza (el buffer).
// Antes se recalculaba cada día como demanda/(stock+oferta del día): era casi binario (×3 con la plaza vacía, ×0,5 en
// cuanto quedaba algo) y todos los talleres de un reino se abrían y cerraban a la vez (la "ola de telares").
const MARKET_DAYS=7;     // cada cuántos días hay mercado (el día de mercado semanal de las villas del XV)
const FC_K=0.5;          // peso de la última semana en la PREVISIÓN de oferta y demanda (~2 semanas de memoria)
const COVER_TARGET=30;   // días de demanda por encima de los cuales el stock de la plaza SOBRA…
const COVER_EXP=0.3;     // …y empuja el precio a la baja (solo a la baja: la plaza vende cada día lo que compra, así
const COVER_MIN=0.7;     // que un bien equilibrado nunca acumula stock; la escasez ya la marca demanda ÷ oferta)
const PRICE_STEP=0.15;   // el precio se mueve como mucho ±15% por semana hacia su objetivo (×2 en ~5 semanas)
function dayOf(h){return Math.floor(h/24)}
function isMarketDay(){return dayOf(S.hour)%MARKET_DAYS===0}
// Fija el precio de la semana de un reino con lo acumulado desde el último mercado (N.e2.wk, por día):
// objetivo = referencia × (demanda prevista ÷ oferta prevista) × factor de stock sobrante, y un paso de como mucho ±15%.
// La demanda es la que PUEDE PAGAR (comprado + lo que faltó con dinero en la mano) más lo que se EXPORTA; la oferta,
// lo entregado a la plaza más lo que se IMPORTA (el comercio es parte del mercado).
// La primera vez (partida nueva o guardada antes de esto) se fija directamente al objetivo.
const PRICE_HIST=12;     // semanas de precio que recuerda cada reino (la gráfica de la ficha del bien)
function weeklyPrice(N){
  const wk=N.e2.wk, first=!N.e2.fc, fc=N.e2.fc||(N.e2.fc={d:{},s:{}}), days=wk.days;
  if(!(days>0))return;
  for(const g of GOODS2){
    const d=(wk.d[g]||0)/days, s=(wk.s[g]||0)/days;
    fc.d[g]=first||fc.d[g]==null?d:fc.d[g]+(d-fc.d[g])*FC_K;
    fc.s[g]=first||fc.s[g]==null?s:fc.s[g]+(s-fc.s[g])*FC_K;
    const D=fc.d[g], P=fc.s[g], stock=N.mkt[g]||0;
    let r;
    if(D<=1e-12)r=(P>0||stock>0)?0.5:1;          // nadie lo pide: por los suelos (o a la par si tampoco hay)
    else if(P<=1e-12)r=3;                         // lo piden y no llega nada
    else{const cover=stock/D; r=(D/P)*Math.max(COVER_MIN,Math.min(1,Math.pow(COVER_TARGET/Math.max(cover,1),COVER_EXP)))}
    const target=ref(g)*Math.max(0.5,Math.min(3,r)), old=N.mktPrice[g];
    N.mktPrice[g]=(first||!(old>0))?target:old*Math.max(1/(1+PRICE_STEP),Math.min(1+PRICE_STEP,target/old));
    const H=(N.ph||(N.ph={}))[g]||(N.ph[g]=[]);H.push(N.mktPrice[g]);if(H.length>PRICE_HIST)H.shift();   // historial (UI; no se guarda)
  }
  wk.d={};wk.s={};wk.days=0;
}

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
  pmProd(p,g,q);
  N.e2.st.prodV+=q*REF2[g];
}
// LIBRO DE CADA PROVINCIA (todas las naciones; solo telemetría, no toca la economía): p._m = mes en curso, p.m = el último
// mes cerrado. prod[g] = unidades producidas · val[g] = lo que la plaza paga por ellas · pay[quién][concepto] = a quién va
// ese dinero · lost = lo que se come el flete · bld[b] = unidades de cada taller · stock[k] = lo que va al almacén de la
// corona. Invariante: Σ pay + lost = Σ val (lo comprueba el arnés). La ficha de provincia lo lee (ui.js).
function pm(p){return p._m||(p._m={prod:{},val:{},pay:{},lost:0,bld:{},stock:{}})}
function pmProd(p,g,q){if(q>0){const m=pm(p);m.prod[g]=(m.prod[g]||0)+q}}
function pmPay(p,who,cat,v){if(!v)return;const m=pm(p),w=m.pay[who]||(m.pay[who]={});w[cat]=(w[cat]||0)+v}
function pmClose(dt){ // al cambiar de mes de calendario, el libro en curso pasa a ser el del mes cerrado.
  // Se mira el mes del tick ANTERIOR: así el primer día del mes nuevo cae en el mes que cierra, igual que en el libro
  // de la corona (tsyTick cierra DESPUÉS del tick) y la suma de las provincias cuadra con la Tesorería.
  const mk=monthKeyOf(S.hour-dt); if(mk===S.pmKey)return;
  if(S.pmKey!=null)for(const p of S.provs){p.m=p._m||null;p._m=null}
  S.pmKey=mk;
}
function addInc(N,o,v){if(v>0&&N.e2&&N.e2.incTick)N.e2.incTick[o]=(N.e2.incTick[o]||0)+v}
function ensure2(N){
  ensureMarket(N);
  if(!N.e2)N.e2={plaza:0,cover:{},cov:{}};
  if(!N.e2.st)N.e2.st={prodV:0,soldV:0,grossV:0,campNet:0,jornal:0}; // contadores de calibración (el arnés los lee y resetea)
  for(const e of STRATA)if(!N.e2.cov[e])N.e2.cov[e]={subs:1,vida:1,lujo:1};
}
// (ledger y sinkAdd viven en economy.js: también los usa pay() de la corona)
// TRANSPORTE (consejo 2026-09-27): el flete no se evapora, lo COBRA quien lleva la mercancía. De la provincia a su
// centro de comercio, la primera jornada de carro (CART_KM) la hace el campesino de la aldea con sus bestias; más allá,
// el arriero o carretero burgués. Entre reinos, el burgués del reino que exporta (galeras, cocas, recuas).
// Fuentes: fin de las corveas c.1390-1420 (Bailey); transportistas regulares hacia 1450 (Sharpe); arrieros asalariados
// en Castilla (Diago Hernando). Antes se perdía: era el mayor sumidero del juego (~17M/año) y la economía deflacionaba ~5%/año.
const CART_KM=30;         // una jornada de carro (DISEÑO): hasta aquí el acarreo es del campesino
function cartShare(p){const km=p.hubKm||0;return km<=CART_KM?1:CART_KM/km}   // parte del flete local que cobra el campesino
function crownPayee(p){return isOccupied(p)?p.occupier:p.owner} // lo que es de la corona en una provincia ocupada, se lo lleva el ocupante
// Producción ANUAL de un nivel de edificio v2 (a plena cobertura), para UI e IA.
function bldYear(p,b,lvl){
  const D=BLD2[b]; if(!D)return null;
  const mor=(p.morale||0)/100, st=staffing(p), terr=D.raw?terrCatMul(p,D.raw):1;
  return {g:D.out, q:lvl*BLD_VALUE*(D.v||1)/REF2[D.out]*mor*st*terr, in:D.in||null};
}
// Beneficio MENSUAL de un edificio (al precio actual): venta neta de transporte y jornal − insumos − mantenimiento.
// Lo que un taller de la CORONA manda a su almacén (unidades/mes; misma fórmula que la pasada A), o null si vende.
function crownStockOut(p,b,lvl){
  const fx=BUILDINGS[b].fx||{}; if(!fx.prodAdd)return null;
  const ks=Object.keys(fx.prodAdd).filter(k=>CROWN_STOCK.has(k)); if(!ks.length)return null;
  const mor=(p.morale||0)/100, st=staffing(p), terr=(TERRAINS[p.terrain]||{prod:1}).prod, mul=1+(provProdMul(p)-1)*st, o={};
  for(const k of ks)o[k]=fx.prodAdd[k]*lvl*terr*mor*st*mul*(YR_TICKS/12);
  return o;
}
// Beneficio MENSUAL de un edificio PARA SU DUEÑO. owner: quién lo tendría (por defecto, el dueño actual si ya existe).
// Si es de la corona y su producto va al ALMACÉN, no se vende: vale su precio en la plaza SOLO mientras al almacén le
// falte ese bien (por debajo de CROWN_STOCK_WANT); si el almacén va sobrado, el taller solo cuesta su mantenimiento.
function buildingProfit2(p,b,lvlArg,owner){
  const lvl=lvlArg!=null?lvlArg:(p.buildings[b]||0); if(!lvl)return 0;
  const N=S.nations[p.owner]; const pr=g=>(N&&N.mktPrice&&N.mktPrice[g]!=null)?N.mktPrice[g]:ref(g);
  const B=BUILDINGS[b], o=owner||(lvlOf(p,b)>0?bOwnerOf(p,b):null);
  const upM=(B.up&&B.up.dinero)?B.up.dinero/12*lvl*(YR_TICKS/12)*upkeepScale(p,b):0;
  if(o==="corona"){const so=crownStockOut(p,b,lvl);
    if(so){let v=0;for(const k in so)if(N&&(N.res[k]||0)<CROWN_STOCK_WANT)v+=so[k]*pr(k);return v-upM}}
  const y=bldYear(p,b,lvl); let v=0;
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
// LIBRO DE CADA BIEN POR REINO (design/ux/economia-visible.md, fase 2): de dónde sale la oferta, quién pide y quién
// consigue (en orden de compra), lo que se exporta, lo que se estropea y los contratos cortados. Solo telemetría: lo lee
// la ficha del bien (ui.js renderMktGood2). Vive en N.gl, FUERA de N.e2, para no inflar la partida guardada (se rehace
// en un mes). Unidades acumuladas en el mes; cur.days dice cuántos días lleva.
function glOf(N){const mk=monthKeyOf(S.hour),G=N.gl||(N.gl={k:mk,cur:{days:0,g:{}},prev:null});
  if(G.k!==mk){G.prev=G.cur;G.cur={days:0,g:{}};G.k=mk}return G}
function glG(G,g){return G.cur.g[g]||(G.cur.g[g]={sup:{},dem:{},exp:0,imp:0,merma:0,unsold:0,cut:{}})}
function glDem(G,g,who,want,got){const d=glG(G,g).dem,x=d[who]||(d[who]=[0,0]);x[0]+=want;x[1]+=got}
function economyTick2(dt=24,doArb=true){
  const f=dt/YR_TICKS, L=ledger();
  pmClose(dt);            // libro de cada provincia: cierra el mes si ha cambiado
  ensureMarketTopology(); // centros de comercio (p.hubOf/hubKm → flete y portazgo). Antes solo se calculaban al abrir la vista
                          // de mapa "Centros": en partida el flete era 0 y el arnés (que sí los calcula) no medía lo mismo. Barato: solo si cambian fronteras.
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
  const pay=(n,who,amt,cat,sub)=>{ // abona a corona (tesoro) o a un estamento (su riqueza); sub = detalle del libro de la corona
    if(!amt)return; const N=S.nations[n]; if(!N)return;
    if(who==="corona"){N.res.dinero+=amt;recCrown(n,cat,sub,amt)}else{N.sWealth[who]+=amt;recFlow(n,who,cat,amt)}
    if(amt>0)N.e2.incTick[who]=(N.e2.incTick[who]||0)+amt;
  };

  // ---------------- PASADA A: producción provincial ----------------
  for(const p of S.provs){
    const n=p.owner; if(n>=NPLAY||p.wasteland||!p.pops)continue;
    const N=S.nations[n]; if(!N||!N.alive)continue;
    for(const k of STRATA)strata[n][k]+=p.pops[k]||0;
    const c=p.pops.campesino||0, mor=(p.morale||0)/100;
    // GRANO: la provincia SIEGA una vez al año, en su mes, y lo cosechado entra en el granero (p.store.comida, que se
    // pone en común con su ducado después de esta pasada: granaryPass). Sus campesinos comen de él cada día.
    if(!p.store)p.store={};
    if(p.store.comida==null)p.store.comida=storeCap(p,"comida")*0.6;
    {const cal=calOf(S.hour);
      if(cal.m===harvestMonth(p)&&p.store.hy!==cal.y){p.store.hy=cal.y;
        const gh=c*GRAIN_YIELD*landYield(p)*terrMul(p,"comida")*harvestMul(p);   // la cosecha del AÑO, con el techo de la tierra (la Granja no la multiplica: es la explotación de su dueño, BLD2)
        p.store.comida+=gh; N.e2.st.prodV+=gh*REF2.comida; pmProd(p,"comida",gh)}}
    p.store.comida-=c*f;
    p._grainNeed=0;p._grainGot=0;
    const sh=harvestShares(p);
    // lo que produce toda provincia + su especialidad
    for(const g in BASE2){const[r,cat]=BASE2[g];let q=c*r*terrCatMul(p,cat)*mor*f;
      q*=geoMul(p,g);
      if(q>0)pushHarvest(deliv[n],p,g,q,sh,N)}
    const sg=FOLD2[p.resType];
    const ug=inBox(p,SPICE_GATES)?"raros":(p.urban&&p.resType==="seda"?"seda":null);   // puertas de las especias (tenga el resType que tenga) · ciudades sederas
    if(ug&&!isOccupied(p)){const q=(p.pop||0)*URBAN2[ug]*mor*f;if(q>0){deliv[n].push({p,g:ug,q,kind:"bld",owner:"burgues"});pmProd(p,ug,q)}}
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
        if(q*cov>0){deliv[n].push({p,g,q:q*cov,kind:"bld",owner:"burgues",art:1});pmProd(p,g,q*cov)}
        if(ins)for(const k in ins)fn[k]=(fn[k]||0)+q*ins[k]}}
    // EDIFICIOS
    const st=staffing(p), mul=1+(provProdMul(p)-1)*st, terr=(TERRAINS[p.terrain]||{prod:1}).prod;
    for(const b of BKEYS){
      const lvl=effLvl(p,b); if(!lvl)continue;
      const B=BUILDINGS[b], fx=B.fx||{}, o=bOwnerOf(p,b);
      // mantenimiento: dinero → sumidero; bienes → la corona los descuenta de su almacén, un estamento los paga
      if(B.up)for(const k in B.up){const a=B.up[k]/12*lvl*dt*upkeepScale(p,b);
        if(k==="dinero"){if(o==="corona"){N.res.dinero-=a;recCrown(n,"Mantenimiento de edificios",B.label,-a)}else{N.sWealth[o]-=a;recFlow(n,o,"Mantenimiento de edificios",-a);upMonth[n][o]=(upMonth[n][o]||0)+a/dt*730}sinkAdd("Mantenimiento",a)}
        else if(o==="corona")N.res[k]=(N.res[k]||0)-a;}  // el mantenimiento en BIENES es del almacén de la corona (unidades de la v1); un estamento solo paga el dinero
      if(isOccupied(p))continue; // ocupada: no produce para su dueño
      // minas de plata/oro: el ÚNICO dinero que nace sin venta (acuñación), contado aparte
      if(fx.prodAdd&&fx.prodAdd.dinero){const a=fx.prodAdd.dinero*lvl*mor*st*dt;pay(n,o,a,"Minas de plata y oro",B.label);L.mint+=a}
      // la corona abastece su almacén de obra y ejército (misma fórmula y unidades que la v1)
      if(o==="corona"&&fx.prodAdd){let used=false;
        for(const k in fx.prodAdd)if(CROWN_STOCK.has(k)){const a=fx.prodAdd[k]*lvl*terr*mor*st*mul*dt;N.res[k]=(N.res[k]||0)+a;used=true;const m=pm(p);m.stock[k]=(m.stock[k]||0)+a}
        if(used)continue;}
      const D=BLD2[b]; if(!D||!siteOK2(p,b))continue;   // un taller fuera del sitio de su materia no produce
      const y=bldYear(p,b,lvl); const cov=inputCov(N,b);
      const q=y.q*mul*f;
      if(q*cov>0){deliv[n].push({p,g:D.out,q:q*cov,kind:"bld",owner:o});pmProd(p,D.out,q*cov);const m=pm(p);m.bld[b]=(m.bld[b]||0)+q*cov}
      if(D.in){const fn=factNeed[n][o]||(factNeed[n][o]={});for(const k in D.in)fn[k]=(fn[k]||0)+q*D.in[k]}
    }
  }

  granaryPass(deliv,grainReq,dt);

  // ---------------- MERCADO de cada reino: precio, cobro de productores, compras ----------------
  const marketDay=isMarketDay();
  const bought=Array.from({length:NPLAY},()=>({}));
  for(let n=0;n<NPLAY;n++){
    const N=S.nations[n]; if(!N||!N.alive)continue;
    const str=strata[n], W=N.sWealth, alc=alcabalaOf(n);
    if(N.e2.islam==null||N.e2.islamCap!==N.capital){const c=S.provs[N.capital];N.e2.islam=!!(c&&islamic(c));N.e2.islamCap=N.capital} // reino de capital islámica
    for(const d of deliv[n])supply[n][d.g]=(supply[n][d.g]||0)+d.q;   // oferta OFRECIDA (el precio la ve toda; la plaza compra solo lo que cabe)
    const GL=glOf(N);GL.cur.days+=dt/24;
    for(const d of deliv[n]){const s=glG(GL,d.g).sup,k=d.kind==="bld"?(d.art?"artesanos":"talleres"):"campo";s[k]=(s[k]||0)+d.q}
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
    let reqQ=0;for(const r of grainReq[n])reqQ+=r.q;
    dem.comida=(dem.comida||0)+reqQ;
    // el almacén de la plaza se dimensiona con la demanda ESTABLE: sin las compras de socorro de los graneros vacíos, que
    // van a ráfagas (un día la plaza aceptaba mucho grano y al siguiente, con el tope más bajo, tiraba lo ya pagado)
    const demCap=g=>(dem[g]||0)-(g==="comida"?reqQ:0);
    for(const o in factNeed[n])for(const g in factNeed[n][o])dem[g]=(dem[g]||0)+factNeed[n][o][g];
    // PRECIO de la semana: el día de mercado se fija el de la semana que empieza (weeklyPrice) con lo acumulado en la
    // anterior (tras las compras, abajo). Entre mercados, todos compran y venden al precio fijado.
    const wk=N.e2.wk||(N.e2.wk={d:{},s:{},days:0});
    if(!N.e2.fc||!(N.mktPrice.comida>0)){   // primera vez (o partida guardada sin precio): con la demanda DESEADA de hoy
      if(!(wk.days>0)){for(const g of GOODS2){wk.d[g]=dem[g]||0;wk.s[g]=supply[n][g]||0}wk.days=dt/24}
      weeklyPrice(N)}
    else if(marketDay)weeklyPrice(N);
    const price={};
    for(const g of GOODS2)price[g]=N.mktPrice[g];
    // la plaza solo COMPRA lo que puede vender este tick o guardar (hasta CAP_MONTHS de demanda): la mercancía que no
    // acepta no se paga (si no, crearía dinero por bienes que se tiran). El grano rechazado vuelve a la despensa.
    const acc={},unsold={};
    for(const g of GOODS2){const sup=supply[n][g]||0;if(!sup){acc[g]=1;continue}
      const dx=demCap(g)+ctrOut(N,g)*dt/24;                           // su demanda + lo que tiene contratado para exportar hoy
      const room=dx+Math.max(0,dx/dt*730*CAP_MONTHS-(N.mkt[g]||0));
      acc[g]=Math.min(1,room/sup);unsold[g]=(1-acc[g])*sup/dt*730;glG(GL,g).unsold+=(1-acc[g])*sup}
    // la PLAZA paga a los productores (el dinero nace aquí)
    for(const d0 of deliv[n]){
      const a=acc[d0.g]; if(a<1&&d0.g==="comida"&&d0.p.store)d0.p.store.comida=Math.min(storeCap(d0.p,"comida"),d0.p.store.comida+d0.q*(1-a));
      const d=a<1?{...d0,q:d0.q*a}:d0; if(d.q<=0)continue;
      const p=d.p, val=d.q*price[d.g]*(1-MARGIN-alc), t=transport(p,d.g);
      const net=val*(1-t), toll=val*t*TOLL_FRAC;
      const carry=val*t*(1-TOLL_FRAC), cs=cartShare(p);    // el flete: lo cobran los que transportan
      N.e2.plaza-=net+toll+carry;
      {const m=pm(p);m.val[d.g]=(m.val[d.g]||0)+val}
      if(carry>0){pmPay(p,"campesino","Transporte",carry*cs);pay(n,"campesino",carry*cs,"Transporte");
        if(cs<1){pmPay(p,"burgues","Transporte",carry*(1-cs));pay(n,"burgues",carry*(1-cs),"Transporte")}}
      N.mkt[d.g]=(N.mkt[d.g]||0)+d.q;
      if(toll>0){const m=manorOf(p);
        pmPay(p,m==="abadengo"?"clero":m==="solariego"?"nobleza":"corona","Portazgo",toll);
        if(m==="abadengo")pay(n,"clero",toll,"Portazgo");else if(m==="solariego")pay(n,"nobleza",toll,"Portazgo");
        else{pay(crownPayee(p),"corona",toll,"Portazgo",p.name);const C=S.nations[crownPayee(p)];if(C)C.tollRate+=toll/dt}}
      if(d.kind==="camp"){
        N.e2.st.soldV+=d.q*REF2[d.g]; N.e2.st.campNet+=net*(1-taxRateOf(n)); N.e2.st.grossV+=d.q*price[d.g];
        // diezmo y renta ya se cobraron EN ESPECIE: sobre lo que vende de SU parte, el campesino solo paga el pecho
        const tax=taxRateOf(n); pay(crownPayee(p),"corona",net*tax,"Pecho",p.name); pmPay(p,"corona","Pecho",net*tax); pmPay(p,"campesino","Ventas en la plaza",net*(1-tax)); pay(n,"campesino",net*(1-tax),"Ventas en la plaza")}
      else if(d.kind==="rent"){pmPay(p,d.owner,d.owner==="corona"?"Renta del realengo":"Renta del señorío",net);if(d.owner==="corona")pay(crownPayee(p),"corona",net,"Renta del realengo",LABEL2[d.g]);else pay(n,d.owner,net,"Renta del señorío (en especie)")}
      else if(d.kind==="tithe"){pay(n,"clero",net,"Diezmo (en especie)");pmPay(p,"clero","Diezmo",net)}
      else{const j=net*JORNAL;N.e2.st.jornal+=j;pmPay(p,"campesino","Jornales",j);pmPay(p,d.owner,"Talleres",net-j);pay(n,"campesino",j,"Jornales");pay(n,d.owner,net-j,"Ventas de sus talleres",LABEL2[d.g])}
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
      recFlow(n,"burgues","Comisión de la plaza",cost*MARGIN); recCrown(n,"Alcabala",LABEL2[g],cost*alc);
      if(who!=="corona"){recFlow(n,who,"Compras",-cost);recBuy(n,who,g,q,cost)}
      bought[n][g]=(bought[n][g]||0)+q; return q;
    };
    // 1) grano para las despensas vacías (antes que nadie: es hambre)
    for(const r of grainReq[n]){ // el grano de socorro llega desde el centro de comercio: se paga el precio MÁS EL FLETE
      const t=reliefFlete(r.p), pr=price.comida*(1+t), can=Math.min(r.q,Math.max(0,W.campesino||0)/pr);
      r.got=buy("campesino","comida",can); r.p._grainGot=r.got; glDem(GL,"comida","socorro",r.q,r.got);
      const fr=r.got*price.comida*t; if(fr>0){const cs=cartShare(r.p);W.campesino-=fr;recFlow(n,"campesino","Compras",-fr);
        pay(n,"campesino",fr*cs,"Transporte");if(cs<1)pay(n,"burgues",fr*(1-cs),"Transporte")}}
    // 2) talleres: su materia prima (es capital de trabajo, va antes que el consumo de sus dueños)
    const coverIn={};
    for(const o in factNeed[n])for(const g in factNeed[n][o]){const need=factNeed[n][o][g];const q=buy(o,g,need,true);glDem(GL,g,"talleres",need,q); // la materia prima se servía a crédito al taller: el pedido entero atrae al mercader
      const ci=coverIn[g]||(coverIn[g]={need:0,got:0});ci.need+=need;ci.got+=q}
    // 3) élites por orden de bolsillo  4) campesino
    for(const e of BUY_ORDER)for(const g in want[e]){got[e][g]=buy(e,g,want[e][g]);glDem(GL,g,e,want[e][g],got[e][g])}
    for(const g in want.campesino){got.campesino[g]=buy("campesino",g,want.campesino[g]);glDem(GL,g,"campesino",want.campesino[g],got.campesino[g])}
    // cobertura de insumos (la leen los talleres el próximo tick)
    for(const g in coverIn){const c=coverIn[g].need>0?coverIn[g].got/coverIn[g].need:1;
      N.e2.cover[g]=c; N.inputCover[g]=c}
    // para el precio de la próxima semana: la oferta del día y la demanda que PUEDE PAGAR (lo comprado + lo que se habría
    // comprado con el dinero en la mano si hubiera habido mercancía). Con la demanda DESEADA, un lujo que casi nadie
    // puede pagar se quedaba en el techo ×3 para siempre, nadie lo compraba y el comercio (que solo lleva a quien puede
    // pagar) no lo movía: especias amontonadas a ×0,5 en Egipto y a ×3 en el resto.
    for(const g of GOODS2){wk.d[g]=(wk.d[g]||0)+(bought[n][g]||0)+(gapStock[g]||0);wk.s[g]=(wk.s[g]||0)+(supply[n][g]||0)}
    wk.days+=dt/24;
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
    // la plaza no guarda más de CAP_MONTHS de demanda: lo que pasa de ahí se va estropeando
    for(const g of GOODS2){const capS=(demCap(g)/dt*730+ctrOut(N,g)*730/24)*CAP_MONTHS, s=N.mkt[g]||0;
      if(s>capS){const x=(s-capS)*Math.min(1,dt/24/30),v=x*price[g];L.discard+=v;glG(GL,g).merma+=x;const db=L.dby||(L.dby={});db[g]=(db[g]||0)+v;N.mkt[g]=s-x}}  // MERMA: lo que sobra se estropea poco a poco (1/30 al día): da un mes para que los contratos o el mercado lo coloquen; tirarlo de golpe al renovarse los contratos tiraba lo ya pagado
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
    for(const k in a.units){const u=UNITS[k].up||{};for(const r in u){const v=u[r]*a.units[k]*dt;R[r]=(R[r]||0)-v;if(r==="dinero"){sinkAdd("Ejército",v);recCrown(a.nation,"Ejército",UNITS[k].label,-v)}}}
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
      const cons=c*f; if(cons>0&&left/cons>FAMINE_DEF){p.pop=Math.max(0,pop0-left*STARVE_RATE);famine=true;const m=pm(p);m.dead=(m.dead||0)+(pop0-p.pop)}}
    p.famine=famine;
    if(!famine){const vida=N.e2.cov.campesino.vida;   // la natalidad sigue a los MESES de grano del granero de su ducado
      p.pop=pop0*(1+POP_GROWTH_BASE*foodGrowth(p._gm!=null?p._gm:6)*landBirth(p)*(0.5+0.5*vida)*dt);const m=pm(p);m.born=(m.born||0)+(p.pop-pop0)}
    if(pop0>0){const r=(p.pop||0)/pop0;for(const k in p.pops)p.pops[k]*=r}
    const base=(p.pops.campesino||0)+(p.pops.burgues||0);
    if(base>0){const bu=p.pops.burgues||0, att=Math.max(0,targetBurgFrac(p)*base-bu), gap=(targetBurgFrac(p)+landPush(p))*base-bu;
      // hasta el objetivo de siempre, el ascenso espera a que los burgueses prosperen; lo que empuja la tierra llena, no
      let move=(gap>0?Math.min(gap,att)*Math.max(0,N.prosp==null?1:N.prosp)+Math.max(0,gap-att):gap)*PROMO_RATE*dt;
      if(N.prosp!=null&&N.prosp<POOR_LINE)move-=(p.pops.burgues||0)*PROMO_RATE*dt*(POOR_LINE-N.prosp)*2; // el artesano que no gana para vivir vuelve al campo
      move=Math.max(-p.pops.burgues,Math.min(p.pops.campesino,move));p.pops.burgues+=move;p.pops.campesino-=move;
      if(move){const m=pm(p);if(move>0)m.up=(m.up||0)+move;else m.down=(m.down||0)-move}}
    const sc=soldCap(p),s=p.sold!=null?p.sold:sc;p.sold=s+(sc-s)*regen;
  }

  // ---------------- COMERCIO ENTRE REINOS: contratos mensuales, entrega diaria ----------------
  if(!doArb)return;
  kmSync2();
  // coste de cada PAR de reinos (km × mar × guerra; ∞ si embargo), 1 vez por tick; cada bien lo escala por su peso
  const live=[];for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(N&&N.alive&&N.e2)live.push(n)}
  const K=live.length, pairF=new Float64Array(K*K), idx=new Int16Array(NPLAY).fill(-1);
  live.forEach((n,i)=>{idx[n]=i});
  for(let i=0;i<K;i++)for(let j=i+1;j<K;j++){const v=pairBase(live[i],live[j]);pairF[i*K+j]=v;pairF[j*K+i]=v}
  if(dayOf(S.hour)%CONTRACT_DAYS===0||live.some(n=>!S.nations[n].e2.ctr))signContracts(live,pairF,idx);
  for(const a of live){const A=S.nations[a],C=A.e2.ctr;if(!C)continue;
    for(const g in C){const list=C[g];if(!list.length)continue;
      const w=(TRADE_BULK[BULK2[g]]||1)*PRICE_SCALE, pA=A.mktPrice[g]!=null?A.mktPrice[g]:ref(g), aA=alcabalaOf(a);
      for(let k=list.length-1;k>=0;k--){const c=list[k], b=c.b, B=S.nations[b], j=b<NPLAY?idx[b]:-1;
        if(j<0||!B||!B.alive){list.splice(k,1);continue}                          // el reino ya no existe
        const cost=pairF[idx[a]*K+j]*w; if(!isFinite(cost)){list.splice(k,1);glG(glOf(A),g).cut[b]="embargo";continue} // EMBARGO: se cancela; la mercancía no sale
        const pB=B.mktPrice[g]!=null?B.mktPrice[g]:ref(g), pn=pB*(1-MARGIN-alcabalaOf(b)), m=pn-pA-cost;
        if(m<0){glG(glOf(A),g).cut[b]=S.wars&&atWarPair(a,b)?"guerra":"no sale a cuenta";continue} // hoy no sale a cuenta (guerra, precios): no se envía
        const q=Math.min(c.q*dt/24,A.mkt[g]||0); if(q<=1e-9)continue;
        A.mkt[g]-=q; B.mkt[g]=(B.mkt[g]||0)+q;
        // El mercader COMPRA en la plaza de origen como cualquier comprador (paga allí la comisión y la alcabala) y VENDE
        // en la de destino como cualquier productor (cobra el precio neto): así ninguna plaza crea dinero.
        {const v=q*pA;A.e2.plaza+=v*(1-MARGIN-aA);A.sWealth.burgues+=v*MARGIN;A.res.dinero+=v*aA;A.alcabalaRate+=v*aA/dt;
          addInc(A,"burgues",v*MARGIN);addInc(A,"corona",v*aA);recFlow(a,"burgues","Comisión de la plaza",v*MARGIN);recCrown(a,"Alcabala",LABEL2[g],v*aA)}
        B.e2.plaza-=q*pn;
        {const fr=q*cost;A.sWealth.burgues+=fr;addInc(A,"burgues",fr);recFlow(a,"burgues","Transporte",fr)} // el flete lo cobra el transportista del reino que exporta
        const half=q*m*0.5, tA=half*almojOf(a), tB=half*almojOf(b);          // el mercader se queda el margen neto, menos la aduana
        A.res.dinero+=tA; A.almojRate+=tA/dt; A.sWealth.burgues+=half-tA; addInc(A,"corona",tA); addInc(A,"burgues",half-tA); recFlow(a,"burgues","Comercio exterior",half-tA); recCrown(a,"Almojarifazgo",LABEL2[g],tA);
        B.res.dinero+=tB; B.almojRate+=tB/dt; B.sWealth.burgues+=half-tB; addInc(B,"corona",tB); addInc(B,"burgues",half-tB); recFlow(b,"burgues","Comercio exterior",half-tB); recCrown(b,"Almojarifazgo",LABEL2[g],tB);
        A.mktInfo[g].exp+=q/dt*730; B.mktInfo[g].imp+=q/dt*730; {const X=glG(glOf(A),g);X.exp+=q;(X.ok||(X.ok={}))[b]=1} glG(glOf(B),g).imp+=q;
        A.e2.wk.d[g]=(A.e2.wk.d[g]||0)+q; B.e2.wk.s[g]=(B.e2.wk.s[g]||0)+q}   // para el precio de la próxima semana
    }
  }
}
// Unidades/día que un reino tiene CONTRATADAS para exportar de un bien (su plaza las guarda además de su demanda).
function ctrOut(N,g){const l=N.e2&&N.e2.ctr&&N.e2.ctr[g];if(!l)return 0;let t=0;for(const c of l)t+=c.q;return t}
function ctrIn(n,g){let t=0;for(let a=0;a<NPLAY;a++){const A=S.nations[a];const l=A&&A.e2&&A.e2.ctr&&A.e2.ctr[g];if(l)for(const c of l)if(c.b===n)t+=c.q}return t}
// FIRMA de los contratos del mes. Por bien: cada reino mira su hueco NETO de lo propio (la demanda que puede pagar,
// prevista, menos lo que produce; sin contar sus contratos actuales). Le sobra → exportador; le falta → importador.
// Los exportadores más baratos firman primero y cada uno vende donde más gana (margen neto de flete, comisión y alcabala)
// hasta agotar su sobrante o cubrir el hueco del comprador. Precios: los de la semana (el retraso de la noticia).
function signContracts(live,pairF,idx){
  const K=live.length;
  for(const n of live){const N=S.nations[n];N.e2.ctrPrev=N.e2.ctr||{};}
  const inPrev=g=>{const t=new Float64Array(NPLAY);for(const a of live){const l=S.nations[a].e2.ctrPrev[g];if(l)for(const c of l)if(c.b<NPLAY)t[c.b]+=c.q}return t};
  for(const n of live)S.nations[n].e2.ctr={};
  for(const g of GOODS2){
    const w=(TRADE_BULK[BULK2[g]]||1)*PRICE_SCALE, minM=TRADE_MIN*ref(g), imp=inPrev(g);
    const node=live.map(n=>{const N=S.nations[n],fc=N.e2.fc,p=N.mktPrice[g]!=null?N.mktPrice[g]:ref(g);
      const outQ=(N.e2.ctrPrev[g]||[]).reduce((t,c)=>t+c.q,0);
      const D=Math.max(0,((fc&&fc.d[g])||0)-outQ), P=Math.max(0,((fc&&fc.s[g])||0)-imp[n]), st=N.mkt[g]||0;
      const surplus=Math.max(0,P-D)+Math.max(0,st-D*COVER_TARGET)/CONTRACT_DAYS;   // lo que le sobra al día (+ el stock de más)
      return {n,N,i:idx[n],p,pn:p*(1-MARGIN-alcabalaOf(n)),surplus,need:Math.max(0,D-P)}});
    const sellers=node.filter(x=>x.surplus>1e-9).sort((x,y)=>x.p-y.p);
    for(const A of sellers){
      const cand=[];
      for(const B of node){if(B===A||B.need<=1e-9)continue;
        const cost=pairF[A.i*K+B.i]*w, m=B.pn-A.p-cost; if(m>=minM)cand.push({B,m})}
      cand.sort((x,y)=>y.m-x.m);
      for(const c of cand){if(A.surplus<=1e-9)break;const q=Math.min(A.surplus,c.B.need);
        A.surplus-=q;c.B.need-=q;(A.N.e2.ctr[g]||(A.N.e2.ctr[g]=[])).push({b:c.B.n,q})}
    }
  }
  for(const n of live)delete S.nations[n].e2.ctrPrev;
}
function inputCov(N,b){const D=BLD2[b];if(!D||!D.in)return 1;let c=1;for(const k in D.in){const v=N.e2.cover[k];if(v!=null&&v<c)c=v}return c}

// Dinero total en circulación de todo el mundo (para el invariante del arnés).
function moneyStock(){let m=0,pl=0;for(let n=0;n<NPLAY;n++){const N=S.nations[n];if(!N)continue;m+=N.res.dinero||0;
  if(N.sWealth)for(const k in N.sWealth)m+=N.sWealth[k];if(N.e2)pl+=N.e2.plaza}return{m,pl}}

// ============================== GRANERO DEL DUCADO ==============================
// Clave del granero: el ducado y su dueño (un ducado partido por una conquista tiene dos graneros); una provincia sin
// ducado es su propio granero.
function granaryKey(p){return (p.duchy>=0?"d"+p.duchy:"p"+p.id)+"|"+p.owner}
// Pone en común el grano de las provincias de cada ducado (lo reparte según sus campesinos), vende el SOBRANTE a la plaza
// del reino (el dinero se reparte como la cosecha: diezmo al clero, renta al señor, el resto al campesino) y, si se ha
// vaciado, pide comprar. Deja en cada provincia p._gm (meses de grano que le quedan al granero) para la natalidad y la UI.
// FLETE DEL GRANO DE SOCORRO: el grano de la plaza del reino está en el centro de comercio de su CAPITAL. Traerlo cuesta
// el camino de ese centro al de la provincia más el de su centro a la provincia (por mar, ×TRADE_SEA si ambos centros son
// costeros). Antes solo contaba el último tramo: un reino grande era un seguro gigante (Polonia-Lituania, Rusia: casi
// nunca hambre en 20 años) y el Sacro Imperio, Italia o Irlanda, reinos de 1-3 ducados, cargaban con toda el hambre.
// payer: el reino que manda el grano (por defecto, el dueño). Con otro reino (ayuda a un aliado, futuro) la ruta sale del
// centro de comercio de la capital de QUIEN PAGA: mismo cálculo, más lejos, más flete.
function reliefRoute(p,payer=p.owner){
  const H=hubOfNation(payer), h=(p.hubOf!=null&&p.hubOf>=0&&S.provs[p.hubOf])||p;
  let far=(H&&h&&H.id!==h.id)?kmBetween(h,H):0; if(far&&H.coastal&&h.coastal)far*=TRADE_SEA;
  return {km:(p.hubKm||0)+far, from:H||h};
}
function reliefFlete(p,payer=p.owner){return Math.min(FLETE_MAX,TRADE_KM2*reliefRoute(p,payer).km*(TRADE_BULK[BULK2.comida]||1)/REF2.comida)}
// ============================== PARA PLANIFICAR (design/ux/economia-visible.md, fase 1) ==============================
// Fuentes ÚNICAS de lo que la interfaz explica: la misma fórmula que corre el tick, sin escribir estado.
// CRECIMIENTO de una provincia (la misma fórmula que DEMOGRAFÍA): %/año y sus factores; y la deriva campesino → burgués.
function popGrowthWhy(p){
  const N=S.nations[p.owner], vida=N&&N.e2?N.e2.cov.campesino.vida:1, months=p._gm!=null?p._gm:6;
  const food=foodGrowth(months), land=landBirth(p), life=0.5+0.5*vida, base=POP_GROWTH_BASE*YR_TICKS;
  const c=p.pops?p.pops.campesino||0:0, bu=p.pops?p.pops.burgues||0:0, lowBase=c+bu;
  return {base, months, food, land, vida, life, famine:!!p.famine, rate:p.famine?null:base*food*land*life,
    burgNow:lowBase>0?bu/lowBase:0, burgTarget:targetBurgFrac(p), push:landPush(p), prosp:N?N.prosp:null, poor:POOR_LINE};
}
// REPARTO DE UNA VENTA: de cada ducado que paga el comprador en la plaza por el bien g de la provincia p, quién se lleva
// qué (fracciones que suman 1). kind: "campo" (cosecha: diezmo y renta en especie, pecho sobre la parte del campesino)
// o "taller" (jornal a los campesinos y el resto al dueño). Misma cuenta que el cobro del tick (MERCADO de cada reino).
function saleSplit(p,g,kind,owner){
  const n=p.owner, alc=alcabalaOf(n), net0=1-MARGIN-alc, t=transport(p,g), m=manorOf(p);
  const lord=m==="abadengo"?"clero":m==="solariego"?"nobleza":"corona", cs=cartShare(p), net=net0*(1-t), out=[];
  const add=(who,concept,f)=>{if(f>1e-9)out.push({who,concept,f})};
  add("burgues","Comisión del comerciante",MARGIN); add("corona","Alcabala",alc);
  add(lord,"Portazgo",net0*t*TOLL_FRAC); add("campesino","Acarreo",net0*t*(1-TOLL_FRAC)*cs); add("burgues","Flete largo",net0*t*(1-TOLL_FRAC)*(1-cs));
  if(kind==="taller"){add("campesino","Jornales",net*JORNAL);add(owner||"burgues","Su taller",net*(1-JORNAL))}
  else{const rent=MANOR_RENT[m]||0, camp=net*(1-DIEZMO_KIND-rent), tax=taxRateOf(n);
    add("clero","Diezmo",net*DIEZMO_KIND); add(lord,m==="realengo"?"Renta del realengo":"Renta del señorío",net*rent);
    add("corona","Pecho",camp*tax); add("campesino","Su parte",camp*(1-tax))}
  return {rows:out, flete:t, manor:m};
}
// POR QUÉ TIENE ESTE PRECIO (misma fórmula que weeklyPrice, sin escribir): demanda y oferta previstas si el día de
// mercado fuera hoy (la previsión + lo que lleva la semana), el factor del stock, el objetivo y el precio que saldrá.
function priceWhy(N,g){
  if(!N||!N.e2||!N.mktPrice)return null;
  const fc=N.e2.fc, wk=N.e2.wk, days=wk&&wk.days>0?wk.days:0;
  const blend=(f,w)=>{const x=days?(w||0)/days:null;return f==null?(x||0):x==null?f:f+(x-f)*FC_K};
  const D=blend(fc&&fc.d[g],wk&&wk.d[g]), P=blend(fc&&fc.s[g],wk&&wk.s[g]), stock=N.mkt[g]||0;
  let r,stockF=1;
  if(D<=1e-12)r=(P>0||stock>0)?0.5:1; else if(P<=1e-12)r=3;
  else{const cover=stock/D;stockF=Math.max(COVER_MIN,Math.min(1,Math.pow(COVER_TARGET/Math.max(cover,1),COVER_EXP)));r=(D/P)*stockF}
  const clamped=Math.max(0.5,Math.min(3,r)), target=ref(g)*clamped, now=N.mktPrice[g]!=null?N.mktPrice[g]:ref(g);
  const next=now*Math.max(1/(1+PRICE_STEP),Math.min(1+PRICE_STEP,target/now));
  const d=dayOf(S.hour)%MARKET_DAYS;
  return {D:D*30,P:P*30,stock,ratio:D>1e-12&&P>1e-12?D/P:null,stockF,r,clamped,target,now,next,inDays:d===0?MARKET_DAYS:MARKET_DAYS-d,step:PRICE_STEP};
}
// ============================== SOCORRO DE GRANO (design/grano-ducado.md, ancla 1+2) ==============================
// Una sola acción: la corona llena el granero de un ducado HASTA SU PRÓXIMA SIEGA (con la reserva de GRAIN_RESERVE, así
// que el granero no revende lo que le llega). Primero saca grano de su ALMACÉN (solo paga el flete), sin tocar los
// RELIEF_ARMY_MONTHS meses que come su ejército; lo que falte lo COMPRA en la plaza del reino a precio + flete. No compra a
// medias. reliefQuote es la ÚNICA fuente del precio: tooltip, botón, (futuro) mapa, pósito automático, IA y aliados.
const RELIEF_ARMY_MONTHS=3;
function granaryMembers(p){const k=granaryKey(p),ps=[];
  for(const q of S.provs)if(q.owner===p.owner&&!q.wasteland&&q.pops&&q.store&&q.store.comida!=null&&granaryKey(q)===k)ps.push(q);return ps}
function reliefQuote(payer,p){
  const N=S.nations[payer]; if(!N||!p||!p.pops)return null;
  const ps=granaryMembers(p); let st=0,need=0,c=0;
  for(const q of ps){const cq=q.pops.campesino||0;c+=cq;st+=q.store.comida||0;need+=cq*monthsToHarvest(q,S.hour)/12*GRAIN_RESERVE}
  const falta=Math.max(0,need-st);
  let army=0;for(const a of S.armies)if(a.nation===payer)army+=armyFood(a)*730*RELIEF_ARMY_MONTHS;
  const almacen=Math.min(falta,Math.max(0,(N.res.comida||0)-army)), compra=falta-almacen;
  // price: lo que le cuesta a la corona cada unidad comprada = el de la plaza SIN su propia alcabala (no se paga a sí misma)
  const mktPrice=(N.mktPrice&&N.mktPrice.comida)||ref("comida"), alc=alcabalaOf(payer), price=mktPrice*(1-alc);
  const t=reliefFlete(p,payer), rr=reliefRoute(p,payer);
  const enPlaza=N.mkt.comida||0, flete=falta*mktPrice*t, cost=compra*price, total=cost+flete;
  const why=falta<=0?"no le falta":compra>enPlaza+1e-9?"no hay tanto grano en la plaza":!canAfford(payer,{dinero:total})?"sin dinero":null;
  return {falta,almacen,compra,price,mktPrice,alc,fletePct:t,km:rr.km,from:rr.from?rr.from.name:"",flete,cost,total,enPlaza,ps,c,st,need,ok:!why,why};
}
// Ejecuta el socorro. El dinero no nace ni muere: lo comprado se paga como una compra en la plaza (comisión al burgués,
// el resto a la plaza; SIN alcabala: la corona no se paga su propio impuesto, así el total anunciado es exactamente lo
// que baja el tesoro) y el flete lo cobran los transportistas.
function reliefSend(payer,p){
  const q=reliefQuote(payer,p); if(!q||!q.ok)return q;
  const N=S.nations[payer], dn=p.duchy>=0&&S.duchies&&S.duchies[p.duchy]?S.duchies[p.duchy].name:p.name;
  N.res.comida=(N.res.comida||0)-q.almacen; N.mkt.comida=(N.mkt.comida||0)-q.compra;
  N.res.dinero-=q.total; recCrown(payer,"Socorro",dn,-q.total);
  const mv=q.compra*q.mktPrice;                                   // lo comprado a precio de la plaza
  N.sWealth.burgues+=mv*MARGIN; recFlow(payer,"burgues","Comisión de la plaza",mv*MARGIN);
  N.e2.plaza+=mv*(1-MARGIN-q.alc);                                // = q.cost − comisión: la plaza, neutra como en cualquier venta
  const cs=cartShare(p); N.sWealth.campesino+=q.flete*cs; recFlow(payer,"campesino","Transporte",q.flete*cs);
  N.sWealth.burgues+=q.flete*(1-cs); recFlow(payer,"burgues","Transporte",q.flete*(1-cs));
  const st2=q.st+q.falta;   // el granero ya llega a la siega: se actualiza al momento (el mapa y la ficha no esperan al tick)
  for(const r of q.ps){const w=q.c>0?(r.pops.campesino||0)/q.c:1/q.ps.length;r.store.comida+=q.falta*w;
    r._gm=q.c>0?st2/(q.c/12):12; r._gshort=st2<q.need/GRAIN_RESERVE; r._grainNeed=0}
  return q;
}
function granaryPass(deliv,grainReq,dt){
  const G=new Map();
  for(const p of S.provs){
    if(p.owner>=NPLAY||p.wasteland||!p.pops||!p.store||p.store.comida==null)continue;
    const N=S.nations[p.owner]; if(!N||!N.alive)continue;
    const k=granaryKey(p); let g=G.get(k); if(!g){g={ps:[],c:0,st:0,cap:0,res:0,need:0};G.set(k,g)}
    const c=p.pops.campesino||0, nd=c*monthsToHarvest(p,S.hour)/12; g.ps.push(p); g.c+=c; g.st+=p.store.comida; g.cap+=storeCap(p,"comida");
    g.need+=nd; g.res+=nd*GRAIN_RESERVE;                           // lo que necesita hasta su próxima siega (y con reserva)
  }
  for(const g of G.values()){
    if(g.c<=0){for(const p of g.ps){p._gm=12;p._gshort=false;if(p.store.comida<0)p.store.comida=0}continue}
    if(g.st<0){const need=-g.st;
      for(const p of g.ps){const w=(p.pops.campesino||0)/g.c;p.store.comida=0;p._gm=0;p._gshort=true;
        if(w>0){p._grainNeed=need*w;grainReq[p.owner].push({p,q:need*w,got:0})}}
      continue}
    const over=Math.max(0,g.st-g.cap), sale=over+Math.max(0,g.st-over-g.res)*Math.min(1,dt/24/GRAIN_SELL_DAYS);
    const left=g.st-sale;
    // _gshort: ¿llega el GRANERO a la siega de sus provincias? Se decide con el granero entero (un ducado puede segar en
    // dos meses distintos), igual que el socorro: si una provincia sale "no llega", su botón de socorro existe
    for(const p of g.ps){const w=(p.pops.campesino||0)/g.c;p.store.comida=left*w;p._gm=left/(g.c/12);p._gshort=left<g.need;
      if(sale*w>1e-9)pushGrain(deliv[p.owner],p,sale*w)}
  }
}
function pushGrain(list,p,q){const sh=harvestShares(p);
  list.push({p,g:"comida",q:q*(1-sh.tithe-sh.rent),kind:"camp"},{p,g:"comida",q:q*sh.tithe,kind:"tithe"},{p,g:"comida",q:q*sh.rent,kind:"rent",owner:sh.lord})}
// Para la interfaz: el granero del ducado de una provincia (meses que le quedan, cuándo siega, cómo viene el año, y lo
// que costaría traer grano: precio + flete).
function granaryOf(p){
  if(!p||!p.store||p.store.comida==null||!p.pops)return null;
  const k=granaryKey(p);let st=0,c=0,cap=0,need=0;
  for(const q of S.provs)if(q.owner===p.owner&&!q.wasteland&&q.pops&&q.store&&granaryKey(q)===k){const cq=q.pops.campesino||0;st+=q.store.comida||0;c+=cq;cap+=storeCap(q,"comida");need+=cq*monthsToHarvest(q,S.hour)/12}
  const N=S.nations[p.owner], pr=(N&&N.mktPrice&&N.mktPrice.comida)||ref("comida"), t=reliefFlete(p), rr=reliefRoute(p);
  const months=c>0?st/(c/12):12, hm=harvestMonth(p), mth=monthsToHarvest(p,S.hour);
  return {st,cap,c,months,harvestMonth:hm,monthsToHarvest:mth,harvest:harvestMul(p),price:pr,flete:t,priceIn:pr*(1+t),short:st<need,from:rr.from?rr.from.name:"",km:rr.km}
}

export { economyTick2, siteOK2, seedEstates2, upkeepScale, seedOwner2, seedWealth2, GOODS2, LABEL2, REF2, NEED2, WANT2, TIERS, BLD2, ESTATE_BUILDS2, buildingProfit2, buildingOutput2,
  transport, tradeCost2, moneyStock, sinkAdd, ARTISAN_IN, ctrOut, ctrIn, granaryOf, foodGrowth, landYield, landCap, landOcc, landBirth, LAND_FULL, popGrowthWhy, saleSplit, priceWhy, ARTISAN_MIX, GRAIN_RESERVE, reliefQuote, reliefSend, isMarketDay, MARKET_DAYS, PRICE_SCALE, JORNAL, MARGIN, CROWN_STOCK, CROWN_STOCK_WANT, crownStockOut, specialty2, obsolete2 };
