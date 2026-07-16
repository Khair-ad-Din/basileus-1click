# Importar el mapa: costa de Natural Earth + ducados de EU4

Pipeline del mapa nuevo (WIP, fases A-C hechas; faltan D-E). Los ficheros intermedios
(ids.svg, ids.png, duchies.png, provs.png) son grandes y viven en el scratchpad, no aqui.

## Fuentes
- **Costa**: Natural Earth 10m, dominio publico. Tres capas de
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/`:
  `ne_10m_land`, `ne_10m_minor_islands`, `ne_10m_lakes` (los lagos se RESTAN).
  166.208 vertices dentro de nuestro recuadro. Nuestra costa actual, comparada, es un poligono
  basto: Dinamarca no tenia islas y Grecia no tenia Peloponeso.
- **Divisiones**: `MapChart_Map.svg` (provincias de EU4). Solo las divisiones interiores.

## La proyeccion del SVG (proyeccion.json)
Es MILLER, deducida ajustando hasta MAXIMIZAR la coincidencia de tierra/mar con nuestro mapa:
`svgX = 3.3420*lon + 598.400` · `svgY = -191.0636*miller(lat) + 296.386`, con
`miller(lat) = 1.25*ln(tan(pi/4 + 0.4*lat*pi/180))`. Coincidencia: **96,44%**.
El primer ajuste (cruzando ids del SVG con places.js) daba 90,96% y era insuficiente.
Donde no coinciden, EU4 suele acertar MAS que nosotros: dibuja Ladoga, Onega y Saimaa como agua.

## Los pasos
1. `mk-idsvg.py` -> `ids.svg`: cada region con un color unico que codifica su indice.
   - El trazo va DEL COLOR DE LA REGION: EU4 tapa con un stroke negro las costuras entre paths
     (no teselan perfecto). Sin el, el 37% de la tierra se quedaba sin region.
   - Hay un SVG ANIDADO (id="map", viewBox propio): el recorte se hace en el wrapper.
2. Renderizar con Chrome a x16 (curvas Bezier de verdad, no aproximadas):
   `chrome --headless=new --window-size=3326,2794 --screenshot=ids.png ids.svg`
3. `mk-duchies.py` -> `duchies.png`: costa de Natural Earth + id de ducado por pixel.
   - FILTRO ANTI-ARTEFACTO: el antialiasing mezcla dos colores y produce ids FALSOS; asi salian
     "Columbia" y "Nunavut" (Canada) en Europa. Solo valen los colores con >=60 px de cuerpo.
   - El 18% de la tierra no cae en ninguna region de EU4 (su costa no es la de Natural Earth) y
     se rellena con el ducado mas cercano. OJO: en costas rectas eso deja RAYAS (cada ducado
     reclama una tira perpendicular). Pendiente: rellenar por distancia euclidea real.
4. `mk-provinces.py` -> `provs.png`: 2-4 provincias por ducado segun area (k-medias).
   - K-MEDIAS, no farthest-point: sembrar por lejania ponia una semilla en el fragmento mas
     remoto del ducado y salian astillas de 60 px (1.630 de ellas). K-medias reparte por area.

## Estado
- 1.421 ducados · 3.297 provincias (hoy: ~920 y 3.680)
- provincia mediana 231 px = ~1.439 km2 = 38 km de lado (hoy: ~7.000 km2 / 85 km)
- PENDIENTE: 871 provincias de <60 px (islotes y fragmentos de la costura costera)
- PENDIENTE fase D: duenos (del raster de paises de MAPDATA, que esta alineado con la costa
  VIEJA: las provincias de la orilla van a fallar), terreno, paramo, nombres, ciudades, caminos.
- PENDIENTE fase E: exportar official_map.js y verificar el juego entero.
