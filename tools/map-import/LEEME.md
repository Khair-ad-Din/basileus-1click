# Importar el mapa: costa de Natural Earth + ducados de EU4

Fases A-C hechas y verificadas. Faltan D (duenos, terreno, nombres, ciudades) y E (exportar
official_map.js + verificar el juego). Los intermedios (ids.png, duchies.png, provs.png) son
grandes y viven en el scratchpad, no aqui.

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
