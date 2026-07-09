// Genera mapdata.js — Europa 1444 estilo EU4.
// Masa terrestre: Natural Earth 1:110m (data/countries.geo.json).
// Fronteras de 1444: Voronoi sobre anclas históricas (ciudades de época) por nación.
// Uso: node build_map.mjs
import fs from "fs";

const WEST=-11, EAST=50, SOUTH=27, NORTH=66.5;
const MH=1840;
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

// Provincias históricas de 1444: anclas [nombre, lat, lon] que siembran el Voronoi de provincias.
// No definen fronteras nacionales (eso lo hacen las anclas de NATIONS1444): solo nombre y posición.
// Las zonas sin ancla se rellenan con semillas procedurales en el juego.
const PROVINCES1444=[
  // — Iberia —
  ["Oviedo",43.36,-5.85],["Santander",43.46,-3.80],["Vitoria",42.85,-2.67],["Logroño",42.47,-2.44],["Soria",41.77,-2.47],
  ["Valladolid",41.65,-4.72],["Salamanca",40.97,-5.66],["Zamora",41.50,-5.75],["Ávila",40.66,-4.70],["Segovia",40.95,-4.12],
  ["Cuenca",40.07,-2.14],["Guadalajara",40.63,-3.16],["Cáceres",39.48,-6.37],["Córdoba",37.89,-4.78],["Jaén",37.77,-3.79],
  ["La Mancha",38.99,-3.93],["Albacete",38.99,-1.86],["Lugo",43.01,-7.56],["Orense",42.34,-7.86],["Niebla",37.26,-6.94],
  ["Ronda",36.74,-5.17],["Huesca",42.14,-0.41],["Lérida",41.62,0.62],["Teruel",40.34,-1.11],["Gerona",41.98,2.82],
  ["Tortosa",40.81,0.52],["Alicante",38.35,-0.48],["Játiva",38.99,-0.52],["Évora",38.57,-7.91],["Coímbra",40.21,-8.43],
  ["Braga",41.55,-8.42],["Beja",38.02,-7.86],
  // — Francia —
  ["Caen",49.18,-0.37],["Amiens",49.89,2.30],["Laon",49.56,3.62],["Tours",47.39,0.69],["Angers",47.47,-0.55],
  ["Le Mans",48.01,0.20],["Chartres",48.45,1.48],["Troyes",48.30,4.07],["Auxerre",47.80,3.57],["Nevers",46.99,3.16],
  ["Moulins",46.57,3.33],["Clermont",45.78,3.08],["Limoges",45.83,1.26],["Périgueux",45.18,0.72],["Cahors",44.45,1.44],
  ["Rodez",44.35,2.57],["Albi",43.93,2.15],["Auch",43.65,0.59],["Pau",43.30,-0.37],["Bayona",43.49,-1.47],
  ["Angulema",45.65,0.16],["Saintes",45.75,-0.63],["Vannes",47.66,-2.76],["Saint-Brieuc",48.51,-2.76],["Quimper",47.99,-4.10],
  ["Grenoble",45.19,5.72],["Valence",44.93,4.89],["Le Puy",45.04,3.88],["Narbona",43.18,3.00],["Carcasona",43.21,2.35],
  ["Perpiñán",42.70,2.90],["Foix",42.97,1.61],["Nancy",48.69,6.18],["Metz",49.12,6.18],["Besanzón",47.24,6.02],
  ["Bresse",46.21,5.23],["Toulon",43.12,5.93],["Ginebra",46.20,6.15],["Valais",46.23,7.36],["Aosta",45.74,7.32],
  // — Islas Británicas —
  ["Exeter",50.72,-3.53],["Cornualles",50.26,-5.05],["Wessex",50.90,-1.40],["Kent",51.28,1.08],["Oxford",51.75,-1.26],
  ["Gloucester",51.86,-2.24],["Lincoln",53.23,-0.54],["Nottingham",52.95,-1.15],["Chester",53.19,-2.89],["Lancaster",54.05,-2.80],
  ["Carlisle",54.89,-2.94],["Newcastle",54.98,-1.61],["Gales del Sur",51.48,-3.18],["Gwynedd",53.14,-4.27],["Shrewsbury",52.71,-2.75],
  ["Ipswich",52.06,1.16],["Cambridge",52.21,0.12],["Glasgow",55.86,-4.25],["Galloway",55.07,-3.61],["Perth",56.40,-3.43],
  ["Úlster",54.60,-5.93],["Limerick",52.66,-8.63],["Kilkenny",52.65,-7.25],["Sligo",54.27,-8.47],
  // — Países Bajos y Borgoña —
  ["Gante",51.05,3.72],["Amberes",51.22,4.40],["Utrecht",52.09,5.12],["Groninga",53.22,6.57],["Frisia",53.20,5.79],
  ["Overijssel",52.51,6.09],["Güeldres",51.98,5.91],["Lieja",50.63,5.57],["Henao",50.45,3.95],["Zelanda",51.50,3.61],
  // — Sacro Imperio y Alpes —
  ["Münster",51.96,7.63],["Paderborn",51.72,8.75],["Kassel",51.32,9.48],["Fulda",50.55,9.68],["Wurzburgo",49.79,9.95],
  ["Bamberg",49.90,10.90],["Augsburgo",48.37,10.90],["Ulm",48.40,9.99],["Wurtemberg",48.78,9.18],["Brisgovia",48.00,7.85],
  ["Constanza",47.66,9.18],["Palatinado",49.41,8.69],["Tréveris",49.75,6.64],["Coblenza",50.36,7.59],["Aquisgrán",50.78,6.08],
  ["Brunswick",52.27,10.52],["Magdeburgo",52.13,11.62],["Erfurt",50.98,11.03],["Mecklemburgo",53.63,11.41],["Holstein",54.32,10.14],
  ["Lusacia",51.15,14.99],["Passau",48.57,13.43],["Salzburgo",47.80,13.05],["Linz",48.31,14.29],["Carintia",46.62,14.31],
  ["Tirol del Sur",46.50,11.35],["Basilea",47.56,7.59],["Grisones",46.85,9.53],
  // — Italia —
  ["Mantua",45.16,10.79],["Brescia",45.54,10.22],["Trento",46.07,11.12],["Friuli",46.06,13.24],["Rávena",44.42,12.20],
  ["Urbino",43.73,12.64],["Siena",43.32,11.33],["Perugia",43.11,12.39],["Viterbo",42.42,12.11],["Abruzos",42.35,13.40],
  ["Chieti",42.35,14.17],["Molise",41.56,14.66],["Capitanata",41.46,15.55],["Salerno",40.68,14.77],["Basilicata",40.64,15.80],
  ["Otranto",40.35,18.17],["Catanzaro",38.91,16.59],["Catania",37.50,15.09],["Trapani",38.02,12.51],["Agrigento",37.31,13.58],
  ["Sassari",40.73,8.56],["Ajaccio",41.93,8.74],
  // — Escandinavia y Finlandia —
  ["Escania",55.60,13.00],["Gotemburgo",57.71,11.97],["Kalmar",56.66,16.36],["Småland",57.78,14.16],["Östergötland",58.41,15.62],
  ["Örebro",59.27,15.21],["Uppsala",59.86,17.64],["Gävle",60.67,17.14],["Dalarna",60.61,15.63],["Sundsvall",62.39,17.31],
  ["Umeå",63.83,20.26],["Luleå",65.58,22.15],["Jämtland",63.18,14.64],["Jutlandia",56.16,10.20],["Aalborg",57.05,9.92],
  ["Ribe",55.33,8.77],["Fionia",55.40,10.39],["Stavanger",58.97,5.73],["Agder",58.15,8.00],["Hamar",60.79,11.07],
  ["Vaasa",63.10,21.62],["Oulu",65.01,25.47],["Savonia",62.89,27.68],["Tavastia",61.50,23.76],["Porvoo",60.39,25.66],
  // — Báltico y Prusia —
  ["Memel",55.71,21.13],["Kaunas",54.90,23.90],["Grodno",53.68,23.83],["Dorpat",58.38,26.72],["Semigalia",56.65,23.71],
  ["Wenden",57.31,25.27],["Ösel",58.25,22.48],["Narva",59.38,28.19],["Thorn",53.01,18.60],["Allenstein",53.78,20.49],
  // — Polonia, Lituania y Rutenia —
  ["Kalisz",51.76,18.09],["Płock",52.55,19.71],["Sandomierz",50.68,21.75],["Radom",51.40,21.16],["Częstochowa",50.81,19.12],
  ["Przemyśl",49.78,22.77],["Brest-Litovsk",52.10,23.70],["Polesia",52.11,26.10],["Nowogródek",53.60,25.83],["Vítebsk",55.19,30.20],
  ["Pólatsk",55.49,28.77],["Mogilev",53.90,30.33],["Gomel",52.44,30.98],["Zhytómir",50.25,28.66],["Vinnytsia",49.23,28.47],
  ["Podolia",48.68,26.58],["Cherkasy",49.44,32.06],["Briansk",53.24,34.36],["Kursk",51.73,36.19],["Oriol",52.97,36.07],
  // — Hungría y Balcanes —
  ["Kosice",48.72,21.26],["Várad",47.05,21.92],["Temesvár",45.76,21.23],["Szeged",46.25,20.15],["Pécs",46.07,18.23],
  ["Alba Iulia",46.07,23.57],["Brasov",45.65,25.61],["Eslavonia",45.55,18.69],["Banja Luka",44.77,17.19],["Dalmacia",43.51,16.44],
  ["Zeta",42.39,18.92],["Vlorë",40.47,19.49],["Epiro",39.66,20.85],["Tesalia",39.64,22.42],["Patras",38.25,21.73],
  ["Negroponte",38.46,23.60],["Vidin",43.99,22.87],["Tarnovo",43.08,25.65],["Varna",43.21,27.92],["Dobruja",44.12,27.26],
  ["Monastir",41.03,21.33],["Serres",41.09,23.55],["Galípoli",40.41,26.67],
  // — Anatolia —
  ["Esmirna",38.42,27.14],["Karesi",39.65,27.89],["Germiyan",39.42,29.98],["Eskişehir",39.78,30.52],["Kastamonu",41.38,33.78],
  ["Amasya",40.65,35.83],["Sivas",39.75,37.02],["Kayseri",38.72,35.49],["Teke",36.90,30.70],["Menteşe",37.22,28.36],
  ["Aydın",37.85,27.85],["Erzurum",39.90,41.27],["Erzincan",39.75,39.49],["Malatya",38.35,38.31],["Dulkadir",37.58,36.93],
  ["Kars",40.60,43.10],["Samsun",41.29,36.33],
  // — Rusia y estepa —
  ["Tver",56.86,35.89],["Yaroslavl",57.63,39.87],["Kostromá",57.77,40.93],["Vladímir",56.13,40.40],["Tula",54.19,37.62],
  ["Kaluga",54.51,36.26],["Múrom",55.58,42.05],["Tambov",52.72,41.45],["Penza",53.20,45.00],["Simbirsk",54.32,48.40],
  ["Sarátov",51.53,46.03],["Tsaritsyn",48.71,44.51],["Chuvasia",56.13,47.25],["Viatka",58.60,49.66],["Ustyug",60.76,46.30],
  ["Beloozero",60.03,37.79],["Kargopol",61.50,38.95],["Kem",64.95,34.60],["Yelets",52.62,38.50],
  ["Caffa",45.03,35.38],["Ochakov",46.62,31.55],["Zaporozhia",47.85,35.10],["Kubán",45.04,38.98],["Alania",43.02,44.68],
  // — Cáucaso —
  ["Derbent",42.06,48.29],["Shirvan",40.63,48.64],["Ganja",40.68,46.36],["Samtskhe",41.64,42.99],["Abjasia",43.00,41.02],
  ["Batumi",41.65,41.64],
  // — Persia y Mesopotamia —
  ["Ardabil",38.25,48.29],["Gilán",37.28,49.58],["Kermanshah",34.31,47.06],["Juzestán",32.05,48.85],["Kirkuk",35.47,44.39],
  ["Samarra",34.20,43.87],["Kufa",32.03,44.35],["Raqqa",35.95,39.01],["Deir ez-Zor",35.34,40.14],
  // — Levante y Arabia —
  ["Beirut",33.89,35.50],["Trípoli de Siria",34.44,35.85],["Acre",32.93,35.08],["Gaza",31.52,34.45],["Homs",34.73,36.71],
  ["Palmira",34.56,38.28],["Al-Arish",31.13,33.80],
  // — Egipto —
  ["Damieta",31.42,31.81],["Fayún",29.31,30.84],["Minya",28.09,30.75],["Asiut",27.30,31.18],["Siwa",29.20,25.52],
  ["Marsa Matruh",31.35,27.25],
  // — Libia y Magreb —
  ["Tobruk",32.08,23.96],["Derna",32.77,22.64],["Ajdabiya",30.75,20.22],["Sirte",31.21,16.59],["Misrata",32.38,15.09],
  ["Ghadames",30.13,9.50],["Gabès",33.88,10.10],["Sfax",34.74,10.76],["Bugía",36.75,5.06],["Biskra",34.85,5.73],
  ["Tiaret",35.37,1.32],["Uxda",34.68,-1.91],["Ceuta",35.89,-5.31],["Salé",34.02,-6.84],["Anfa",33.57,-7.59],
  ["Safi",32.30,-9.24],["Agadir",30.42,-9.60],["Sijilmasa",31.28,-4.28],["Taza",34.21,-4.01],
  // — Islas —
  ["Mdina",35.89,14.40],["Quíos",38.37,26.14],["Mitilene",39.11,26.55],["La Canea",35.51,24.02],["Famagusta",35.12,33.94]
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
    if(comp.length<10000){for(const c of comp)land[c]=1;holes++}
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
  for(let dy=-14;dy<=14;dy++)for(let dx=-14;dx<=14;dx++){
    const nx=x+dx,ny=y+dy;
    if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
    if(grid[ny*MW+nx]===want){const d=dx*dx+dy*dy;if(d<bd){bd=d;fx=nx;fy=ny}}
  }
  if(fx<0){console.warn("Ancla sin tierra de su nación:",a.name);continue}
  cities.push([a.name,fx,fy,want,a.cap]);
}

// 6. anclas de provincia histórica (ancladas al píxel de tierra más cercano)
const provinces=[];
{
  const seenP=new Set(cities.map(c=>c[0]));
  for(const[name,lat,lon]of PROVINCES1444){
    if(seenP.has(name)){console.warn("Provincia duplicada, omitida:",name);continue}
    const x=Math.round(px(lon)),y=Math.round(py(lat));
    let fx=-1,fy=-1,bd=1e9;
    for(let dy=-14;dy<=14;dy++)for(let dx=-14;dx<=14;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx<1||ny<1||nx>=MW-1||ny>=MH-1)continue;
      if(land[ny*MW+nx]){const d=dx*dx+dy*dy;if(d<bd){bd=d;fx=nx;fy=ny}}
    }
    if(fx<0){console.warn("Ancla de provincia sin tierra cerca, omitida:",name);continue}
    seenP.add(name);
    provinces.push([name,fx,fy]);
  }
}

const landCount=land.reduce((s,v)=>s+v,0);
console.log(`Mapa ${MW}x${MH}, tierra ${(100*landCount/grid.length).toFixed(1)}%, RLE ${(rle.length/1024).toFixed(1)} KB, ciudades ${cities.length}, provincias ${provinces.length}`);

const out="const MAPDATA="+JSON.stringify({
  W:MW,H:MH,
  geo:{WEST,EAST,SOUTH,NORTH},
  nations:NATIONS1444.map(([name,color])=>({name,color})),
  countries:NATIONS1444.map((_,i)=>({nation:i})),
  rle,cities,provinces
})+";\n";
fs.writeFileSync("mapdata.js",out);
console.log("mapdata.js escrito.");
