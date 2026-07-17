# Importar el mapa: costa de Natural Earth + mundo de EU4 en 1444

Fases A-C hechas, verificadas y aprobadas. C2 (el MAR son provincias) y D-1 (los DUENOS de EU4 en
1444) hechas y aprobadas ("lo veo en general genial"). Faltan el resto de D (terreno, nombres,
ciudades) y E (meter los 192 paises en el juego, exportar official_map.js, verificar el juego).

## Los pasos, en orden
`mk-idsvg.py` -> Chrome -> `mk-regiones.py` -> `mk-duchies.py` -> `merge-islets.py` ->
`clean-duchies.py` -> `mk-provinces.py` -> `mk-sea.py` -> `mk-eu4.py`

## EL MUNDO DE 1444 SALE DE EU4 (fase D-1)
Decision de Sergio: "me dan igual los paises actuales, son un primer boceto; vamos a explorar los
archivos de EU4 y copiar las fronteras, y meter paises que falten". EU4 en
`C:/Program Files (x86)/Steam/steamapps/common/Europa Universalis IV/`.

**968 de 974 ducados (99,4%) con su dueno real. 192 paises** donde el boceto tenia 60. Verificado a
ojo y por casos: Rodas -> Orden de San Juan · Lesbos -> Genova (los Gattilusi) · Luxemburgo ->
Borgona (Felipe el Bueno la tomo en 1443) · Mesambria -> Imperio Bizantino · Tripoli -> Tunez (los
hafsidas) · Inglaterra con Gascuna. Suecia y Noruega salen SEPARADAS de Dinamarca (union personal),
no como el "Union de Kalmar" del boceto.

De donde sale cada cosa:
- **el dueno**: `history/provinces/<id> - <nombre>.txt`. El bloque base es el estado al principio de
  la historia, NO en 1444: hay que aplicar encima los bloques fechados hasta **1444.11.11**.
  Ile-de-France lo enseña: base owner=FRA, 1420 controller=ENG (los ingleses toman Paris), 1437
  controller=FRA (Carlos VII la recupera).
- **el nombre del pais**: repartido por **144 ficheros** `*_l_spanish.yml`, no en uno.
  `countries_l_spanish.yml` manda y el resto rellena. BYZ (Imperio Bizantino) y HSA (Lubeck) estan
  en `text_l_spanish.yml`.
- **el color**: `common/countries/*.txt`, via `common/country_tags/00_countries.txt` (OJO: el tag
  lleva un TABULADOR antes del `=`, y Castilla es `Castille.txt` con dos eles).
- **donde esta una provincia**: `map/positions.txt`, en pixeles del mapa de EU4. La recta a lon/lat
  esta en mk-regiones.py.

Los 6 sin resolver son paramos (Sahara Central, El Djouf, los Escandes, Kola, Finnmark) que **en
1444 no tienen dueno de todos modos**: quedarse sin resolver ES el resultado correcto.

## AL RETOMAR: HAY QUE REGENERAR LOS INTERMEDIOS
`ids.svg`, `ids.png`, `duchies.png` y `provs.png` son grandes y vivian en el scratchpad TEMPORAL de
la sesion: **ya no existen**. Hay que correr la cadena entera de abajo (~40 min, casi todo Python
puro sobre 3,3M de pixeles). Los .geojson de Natural Earth tambien: se bajan con curl (ver Fuentes).
Todo es DETERMINISTA (RNG mulberry32 con semilla 193909), asi que sale identico.

## Resultado
- 1.006 ducados historicos (Lappland, Abruzzi, Kola...), 5.789 provincias.
- Provincia mediana 388 px = 2.417 km2 = 49 km de lado. El mapa de hoy: 4.828 provincias, 428 px,
  52 km. El nuevo es MAS UNIFORME (p10 328 px contra 232) y solo tiene 20 provincias de <60 px.
- Todo ducado partido en 2+ provincias del MISMO tamano (proporcion menor/mayor: mediana 1,00).

## Los pasos, en orden (el orden importa: cada uno limpia para el siguiente)
1. `mk-idsvg.py` -> `ids.svg`: cada region de EU4 con un color unico.
2. Chrome a x16: `chrome --headless=new --window-size=3326,2794 --screenshot=ids.png ids.svg`
3. `mk-duchies.py` -> `duchies.png`: costa de Natural Earth 10m + id de ducado por pixel.
4. `merge-islets.py`: los islotes que no dan para 2 provincias se unen al ducado vecino (cruzando
   el mar hasta 220 km). Malta con Sicilia, las Cicladas juntas. 1.421 -> 1.006 ducados.
5. `clean-duchies.py`: cada ducado se queda con su cuerpo; los fragmentos rodeados de tierra ajena
   pasan a quien los rodea. Las islas (rodeadas de mar) se respetan.
6. `mk-provinces.py [px]` -> `provs.png`: k-medias CON CAPACIDAD, 390 px por provincia.
7. `mk-sea.py [px] [min_frac]` -> `sea.png` + `sea.json`: el MAR tambien son provincias (ver abajo).

## EL MAR SON PROVINCIAS (fase C2)
El mar dejo de ser "el vacio donde no hay provincia": ahora esta teselado. Sin dueno, pero con id,
area, forma y vecinas. Es INFRAESTRUCTURA, no decorado: al existir, el mapa deja de ser un grafo de
tierra con un agujero en medio y se puede ir de una costa a otra por un camino medible. De ahi
cuelgan el transporte de tropas, los barcos y las rutas de comercio. Aqui se construye el DATO; la
mecanica que lo consume es aparte y puede esperar.

**345 teselas, ids 5790-6134** (la tierra ocupa 1-5789), mediana 3.471 px = 147 km de lado.
Cada tesela guarda sus coordenadas axiales `(q,r)` del hexagono: agrupar en "ducados de mar" el dia
de manana es trivial (son bloques contiguos de la rejilla), no hay que reconstruir nada.

**Hexagonos, no k-medias.** La k-medias es EMERGENTE y por eso en tierra cada arreglo mio parió el
artefacto siguiente. La rejilla hexagonal es ANALITICA: cada pixel cae en su hexagono por formula
cerrada, sin semillas, sin RNG, sin convergencia. No hay artefacto posible porque no hay proceso del
que emerja uno. Regulares en PIXELES, no en km (el mapa es Mercator y estira al norte, igual que ya
les pasa a las provincias de tierra: es lo que se ve regular en pantalla).

**NAVEGABLE = lista explicita de mares por punto semilla**, NO "lo que toca el borde del recuadro".
Medido: esa regla habria fallado en las DOS direcciones. Habria dejado el Mar Negro (55.945 px) y el
Azov (5.885) como lagos, y habria colado el Caspio y el Golfo Persico como oceano abierto (tocan el
borde solo porque la caja los corta a lon 50).

**Los estrechos son ARISTAS del grafo, no un canal carvado en la costa.** El raster va a ~2,7 km/px
y el Bosforo mide 700 m: el estrecho es SUBPIXEL y Natural Earth tiene razon al cerrarlo. Carvar 1 px
seria mentir sobre la geometria para arreglar un problema de topologia — y ya sabemos como acaba eso.
La costa dice la verdad y el grafo arregla la topologia. Ademas asi Constantinopla controla el paso.
Medido, la cadena real es: **Egeo -(Dardanelos, 7,7 km)- MARMARA -(Bosforo, 28,5 km)- Mar Negro
-(Kerch, 5,4 km)- Azov**. El Marmara sale como componente propia de 1.305 px: tesela suelta entre
DOS estrechos. Eso no lo puso nadie, sale de la geometria. (El Bosforo salta 28,5 km porque el
Bosforo MIDE 30 km de largo: como el canal no existe en el raster, el salto es su longitud entera.)
El cruce no se clava a mano: se busca donde los dos mares quedan mas cerca, que es la definicion de
estrecho, y el script aborta si el salto pasa de 60 km (eso no seria un estrecho, seria una invencion).

**Agua NO navegable = AGUJERO** (decision de Sergio): Caspio, Mar Blanco, Golfo Persico y ~1.100
lagos. Sin provincia, se pintan de mar. Es el mismo trato que hoy recibe todo el oceano, asi que no
hace falta categoria nueva. El Mar Blanco ademas es correcto por epoca: la ruta del Cabo Norte a
Arjangelsk no se abre hasta 1553 (Chancellor); en 1444 esta cerrada de verdad.

**Los 4 invariantes** (los comprueba el script; deben dar 0): pixeles navegables sin tesela · teselas
sobre tierra · teselas invadiendo un agujero · teselas en varios trozos (UNA SOLA PIEZA).

## Fuentes
- **Costa**: Natural Earth 10m, dominio publico. `ne_10m_land` + `ne_10m_minor_islands` -
  `ne_10m_lakes` (los lagos se RESTAN), de
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/`.
  166.208 vertices en nuestro recuadro. La costa actual es un poligono basto: Dinamarca no tenia
  islas y Grecia no tenia Peloponeso.
- **Divisiones**: `MapChart_Map.svg` (provincias de EU4). Solo las divisiones interiores.
- **Proyeccion** (proyeccion.json): MILLER, deducida maximizando la coincidencia de tierra/mar con
  nuestro mapa -> 96,44%. `svgX = 3.3420*lon + 598.400` · `svgY = -191.0636*miller(lat) + 296.386`
  con `miller(lat) = 1.25*ln(tan(pi/4 + 0.4*lat*pi/180))`. Donde no coinciden, EU4 suele acertar
  MAS: dibuja Ladoga, Onega y Saimaa como agua y nosotros los teniamos como tierra.

## 7. EL BUG 1 NO ESTABA MUERTO: LOS DUCADOS FANTASMA
"Columbia y Nunavut (Canada) en Europa" seguia vivo un dia despues de darlo por resuelto. La paleta
mato los trozos de 1 px —de 8.068 a 47— **y eso era justo lo que yo medi**. Pero mk-duchies.py
RELLENA POR VECINDAD cada pixel de tierra sin ducado: los 47 supervivientes no se quedaron en 47
pixeles, **cada uno sembro un BFS y crecio hasta ser un ducado**. Medido: 30 ducados fantasma. Un
estado birmano (`Pegu`) en Dinamarca, `Bushubi` (Africa) en Jutlandia con 1.197 px, la Columbia
Britanica en Rusia.
Sobrevivio un dia entero porque hasta entonces **el nombre del ducado daba igual** — solo eran
andamio para cortar provincias. Al traer los duenos de EU4, el nombre paso a decidir quien gobierna
y el bug se hizo visible de golpe.
**Mate el sintoma que miraba y no el que venia despues.** Cuarto asalto del mismo patron.
Arreglo en la causa (`mk-regiones.py` + el veto de `mk-duchies.py`): EU4 dice donde esta cada
provincia, asi que un pixel que decodifica a Canada es POR DEFINICION un error de decodificacion.
De 30 a 0.

## 8. LAS ISLAS ESTABAN DEBAJO DEL MAR (y mi verificacion no lo vio)
En el mapa que Sergio aprobo, **8.738 px de tierra de Natural Earth estaban pintados de oceano**:
Feroe, Shetland, Orcadas, Hebridas Exteriores, Rodas, Bornholm y Oland NO EXISTIAN.
Causa: la costa de EU4 y la de Natural Earth coinciden al 96,44%, y en una isla pequena ese 3,56%
basta para que nuestro pixel de tierra caiga en el MAR del SVG y se quede sin region. Sin region =
0, y 0 significa mar.
**Por que no lo pillo la verificacion del mar**: alli defini "agua" como *"lo que vale 0 en
duchies.png"*. Comprobe el RESULTADO CONTRA SI MISMO en vez de contra Natural Earth, que es la
materia prima. Los cuatro invariantes daban 0 y eran ciertos y el mapa estaba roto. Otra vez la
metrica que cumple la letra.
La prueba buena es una linea: *contar tierra de Natural Earth con tesela de mar encima*. Ahora: 0.

## 9. EL NOMBRE PROPONE, LA POSICION DISPONE
Los nombres de EU4 mienten y se repiten por todo el globo. **Ninguna fuente es fiable sola**:
`definition.csv` tiene 664 nombres ambiguos y jura que "Ustyug" es la 314, que se llama Vologda; la
localizacion jura que "Karelia" es la 4124, que se llama Kovero. Cruzar las tres deja 96,4%.
Y la trampa mas fina: **el fichero de historia parecia la autoridad** (es la etiqueta pegada al dueno
que leemos) y con el subi al 99,9%... **regalandole Tripoli a Siria**. Hay UN solo fichero llamado
"Tripoli" y es el del Libano; el nuestro es el de Libia, a 3.000 km. **Que una fuente resuelva un
nombre sin ambiguedad NO significa que sea NUESTRA provincia.**
Regla final: el nombre solo PROPONE; la posicion VETA los absurdos (>400 km) y desempata. Y para los
ducados grandes la vara no es la distancia al centroide (Central_Sahara son 65.412 px y su centro
esta lejos de todo por geometria) sino **si el marcador cae DENTRO**.

## 10. MIS PROPIOS ERRORES DE ESTA TANDA (todos de dar cosas por hechas)
- **`GNV` no es Genova, es GINEBRA** (Genova es `GEN`). Lo di por hecho al escribir un informe. Si
  no lo llego a comprobar por costumbre, Ginebra acaba gobernando el Mediterraneo.
- **Casi veto por INDICE**: mk-idsvg.py usa un regex estricto (3.352 paths) y mk-regiones.py uno
  amplio (3.359). Casar por posicion habria desplazado la tabla entera y vetado regiones al azar —
  mil veces peor que el bug que arreglaba. Se casa POR NOMBRE.
- **Un `*2` de mas** en una formula inversa me decia que Gotland estaba "desviada 6.381 km" cuando
  esta clavada. Antes de acusar al mapa, revisa tu formula.
- **Un tope de 150 km** que decidia en vez de vetar: se cargaba el Sahara por ser grande.
- **Una guardia solo RELATIVA** (que el 2o candidato este un 50% mas lejos) colo `Eastern_Siberia`
  con un enganche a 5.447 km. Todo umbral relativo necesita un tope absoluto.

## 6. EL MANDO `min_frac` DEL MAR: MI TEORIA ESTABA DEL REVES
`min_frac` decide que viruta de agua se fusiona con su vecina (0,15 = por debajo del 15% del
objetivo). Yo le dije a Sergio que subirlo fabricaria mas "pulpos" (teselas serpenteantes), porque
cada fusion pega un trozo del hexagono de al lado. **Sonaba impecable y era falso.** Medido a 0,15 /
0,35 / 0,60, la forma MEJORA al subirlo (dispersion mediana 1,36 -> 1,34 -> 1,28; teselas feas 22 ->
7 -> 6): los pulpos ERAN las virutas sin fusionar, y al absorberlas dejan de existir como tesela.
El coste real era otro, y los promedios lo escondian: **el MAXIMO se dispara** (max/mediana 1,31 ->
1,67 -> 3,16). A 0,60 la peor tesela son 12.630 px en el Atlantico ABIERTO frente a Marruecos — la
fusion encadenandose contra el borde del mapa y engullendo hexagonos de mar libre. El canje no era
"tamano contra forma", era "virutas pequenas contra gigantes".

La prueba que de verdad decide no es un promedio, es **QUIEN es la peor tesela**: a 0,35 las cinco
peores son Marmara, Cadiz, Bristol, Azov y el Golfo de Finlandia — geografia real, irreducible. A
0,60 las peores son manchas inventadas en mar abierto. Si lo peor que produce el algoritmo es la
forma que el agua tiene de verdad, el algoritmo ha terminado.

**Sergio eligio 0,15** (el original) despues de ver las tres. Es el valor por defecto. Yo habia
recomendado 0,35; manda la pantalla, no mi tabla.

## LOS CINCO BUGS QUE COSTARON UN DIA (no repetirlos)
Los cinco eran de la MISMA familia: mirar el resultado en vez de la materia prima.

1. **La codificacion del color era la causa raiz de dos de ellos.** Codificar el id como
   `(n, n>>8, n>>16)` hace que casi cualquier mezcla de antialiasing siga siendo un id VALIDO —
   de otra region. Aparecian "Columbia" y "Nunavut" (¡Canada!) en Europa. Taparlo con un trazo del
   color propio hacia que las regiones se pisaran: confeti de 1 px por toda frontera (93.472
   componentes para 1.421 ducados; 8.068 trozos de UN pixel). Quitar el trazo devolvia Canada.
   Estuve horas rebotando entre los dos sintomas de una sola causa.
   SOLUCION: paleta en rejilla 16x16x16 sobre [80..255], todos los colores CLAROS y separados 11.
   Una mezcla con el fondo negro baja de 80 y se descarta; una mezcla entre dos regiones cae, como
   mucho, en una de las dos. Decodificar = cuantizar. Resultado: 47 trozos de 1 px (eran 8.068).
2. **Sembrar por lejania (farthest-point)** ponia una semilla en el fragmento mas remoto del ducado:
   1.630 astillas. La k-medias normal tampoco vale: si el ducado tiene una isla o un tentaculo,
   separar ESO es lo que menos distancia cuesta -> la 2a provincia medía el 4% de la 1a (mediana).
   SOLUCION: k-medias CON CAPACIDAD. Cada trozo se lleva su parte del area.
3. **Repartir con cupo por DISTANCIA ABSOLUTA** deja discos: el centroide se llena con sus pixeles
   mas proximos (un circulo) y el resto se lo comen los vecinos -> circulos de una provincia
   incrustados en otra. Y los empates se rompian por orden de pixel -> recuadros alineados con los
   ejes en los ducados pequenos (Italia).
   SOLUCION: repartir por VENTAJA (d2-d1): primero los pixeles con dueno claro.
3b. **Pero repartir por ventaja creo el siguiente artefacto**: los pixeles disputados (los del
   BORDE, los de menos ventaja) se colocan los ULTIMOS, cuando sus centroides preferidos ya han
   llenado el cupo -> caen en uno lejano y dejan una FRANJA fina del color equivocado pegada a la
   costura. En la practica: un trozo de una provincia cuyo cuerpo esta a 40 km.
   SOLUCION: holgura en el cupo (x1,08) + exigir que CADA PROVINCIA SEA UNA SOLA PIEZA (cada trozo
   suelto se lo queda el gajo que mas lo rodea). Quedan 68 de 5.789 en varios trozos (1,2%): son
   ISLAS, que no tienen vecina terrestre a la que unirse. Correcto: el mapa de hoy tambien tiene
   provincias multilobulo. Coste: la proporcion menor/mayor baja de 1,00 a 0,84 — los gajos ya no
   son exactos, y esta bien: 0,84 es un reparto de verdad.
4. **Limpiar fragmentos sobre un raster sucio** se desboca: movio 830.000 px (37% de la tierra) sin
   converger y destrozo un ducado. Sobre el raster limpio converge en 3 vueltas y 56.000 px.
   El orden importa: limpiar DESPUES de arreglar la causa, no antes.
5. **El filtro de mayoria** sobre el raster (66 -> 3,3 trozos por ducado) parecia el arreglo, pero
   erosiona los ducados pequenos: se comio 167. Era tapar el ruido en vez de no generarlo.

## EL PATRON (lo mas importante de todo esto)
CADA arreglo mio mato un sintoma y CREO el siguiente:
  semillas por lejania -> astillas
  k-medias normal      -> la 2a provincia al 4%
  cupo por distancia   -> discos incrustados
  cupo por ventaja     -> franjas en las costuras
Cuatro arreglos, cuatro artefactos nuevos, y las cuatro veces los detecto SERGIO mirando la
pantalla mientras mi metrica sonreia. Cuando un arreglo "funciona" segun el numero, MIRAR LA IMAGEN
antes de cantarlo. Siempre.

## LA LECCION DE METODO
Medi el RESULTADO (provincias por ducado, tamanos, proporciones) durante ocho horas y cada metrica
decia que todo iba bien mientras la pantalla decia que no. La primera vez que mire la MATERIA PRIMA
(el render del que sale todo) el bug aparecio en un minuto.
Y ojo con las metricas que cumplen la letra: "cero ducados con menos de 2 provincias" era CIERTO y
el mapa estaba roto — la 2a provincia era una viruta del 4%. Si una metrica dice que todo va bien y
el usuario dice que no, el que se equivoca es la metrica.
