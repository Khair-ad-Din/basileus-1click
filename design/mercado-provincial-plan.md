# Plan de implementación — Mercado provincial

**Estado:** Planeado (sin implementar) · **Fecha:** 2026-07-16 · Implementa [ADR 0001](adr/0001-lo-local-es-la-verdad.md).
Diseñado por el `/consejo` (mercader + campesino + artesano) y sintetizado por el consejero.

## Objetivo

Hacer que el mercado sea PROVINCIAL (hoy es nacional, `N.mkt`), cumpliendo la piedra angular: la
provincia es el átomo, lo macro es sumatorio. Migración **incremental**, de dentro afuera.

## Hallazgos que sostienen el plan

- **Casi todo el motor ya existe.** La jerarquía la dan flags ya sembrados (`p.urban`, `p.capital` —
  `manorOf` ya bifurca por ellos). El grafo de rutas ya está (`S.adj`, `S.seaAdj`, `S.roads`). La
  fricción por distancia ya está escrita (`tradeCost`, hoy solo entre capitales). Las distancias
  (`kmBetween`) ya se calculan.
- **La línea roja es `sWealth`, no el mercado.** El invariante `ledger==economy` es contabilidad de
  PRODUCCIÓN (`provEconomyByOwner`/`provBreakdown`/`nationLedger`); el mercado (`N.mkt`/`sWealth`) es
  una capa aditiva encima. **Mover stock y precio a la provincia NO toca el invariante.
  Provincializar `sWealth` SÍ.** Por eso ese paso se aparca al final.
- **Lo caro y lejano no se localiza.** Los lujos y la materia de largo alcance (seda, especias,
  alumbre, tinte, azúcar, pieles, ámbar) siguen viajando capital-capital — se concentraban en pocas
  plazas; poner un nodo de seda en 3680 provincias es gastar cómputo donde la historia dice que no.

## Jerarquía de 3 niveles (cero campos nuevos)

| Nivel | Criterio (ya existe) | Qué es |
|---|---|---|
| 0 — Aldea | `!p.urban` (**3.259 = 88,6%**) | Sin mercado. Satélite de su plaza (`p.marketOf`). |
| 1 — Plaza local | `p.urban \|\| p.capital` (**423 = 11,5%**) | Mercado propio (`p.mkt`/`p.mktPrice`). |
| 2 — Nodo internacional | `p.capital` (**59**) | El arbitraje de larga distancia de hoy, tal cual. |

Recuentos **medidos** en Fase 0 (antes eran una estimación de confianza baja). Ojo al criterio de plaza:
es `p.urban || p.capital`, no `p.urban` a secas — Nikšić y Aqaba son capitales sin `urban`, y sin el
`|| p.capital` **Ragusa se quedaba sin ninguna plaza** y sus aldeas sin sitio al que ir en la Fase 1.

## Las fases (en orden de dependencia)

### Fase 0 — Medir y construir la topología ✅ HECHA (2026-07-16)
`buildMarketEdges()` en `mapgen.js` (grafo ralo: `S.adj` + `S.seaAdj` + arista extra si
`kmBetween < MKT_LINK_KM`, solo entre plazas del mismo dueño) + `S.marketEdges` en `state.js` +
el arnés de medida `tools/market-topology.mjs`. **Cero cambio de comportamiento: nadie lo consume
todavía** (no hay ni una llamada desde el juego; el consumidor llega en la Fase 1).

**`MKT_LINK_KM = 250`, fijado midiendo.** Los 150 km del plan eran a ojo y dejaban el grafo ROTO:

| radio | aristas | plazas aisladas | reinos con el mercado partido | plazas huérfanas |
|---|---|---|---|---|
| 150 | 487 | 40 | 36/59 | 66 |
| **250** | **879** | **6** | **15/59** | **11** |
| 300 | 1.070 | 5 | 12/59 | 10 |

Con 150 km, 36 de 59 reinos tendrían su mercado interno en dos o más islas que jamás comerciarían
entre sí en la Fase 3. El radio solo crea la ARISTA; que el trato salga a cuenta ya lo decide el flete.

**Cadencia del arbitraje inter-plaza: heredar `doArb` mensual** (mensual ≈ 1,5 ms; cada tick ≈ 37 ms/día).

### Fase 1 — `p.marketOf`: aldea → plaza más cercana ✅ HECHA (2026-07-16)
`assignMarkets()` en `mapgen.js`: deja `p.marketOf` (su plaza) y `p.marketKm` (los km de CAMINO hasta
ella — el flete que la Fase 2 le cobrará). `ensureMarketTopology()` rehace grafo+pertenencia solo si
`S.mktDirty`; lo ensucian `transferDuchy` (único sitio donde cambia `p.owner` en partida) y
`rebuildProvinceData` (carga/editor). **Cero ducados movidos: nadie lo consume aún** — verificado con
equivalencia **exacta byte a byte** contra HEAD (`node tools/sim-economy.mjs 8`).

**3.680/3.680 asignadas. Mediana 85 km de camino, p90 163, p99 279, máx 467.** Coste: ~15 ms, solo al
conquistar un ducado.

Tres correcciones al plan, todas obligadas por lo medido:

1. **El BFS no va sobre `S.marketEdges`.** Ese grafo solo une plazas entre sí: las aldeas no están en
   él. La pertenencia va sobre `S.adj`/`S.seaAdj`; `marketEdges` es para el arbitraje de la Fase 3.
2. **No es BFS, es Dijkstra en KILÓMETROS.** Un BFS cuenta saltos, y un salto por mar son 500 km:
   contando saltos, Alanya vendía en Port Said (624 km) y Alghero en Perpiñán (537 km) porque llegaban
   en menos saltos que a su plaza de tierra. Contando km, cada una va a la suya.
3. **La frontera NO confina** (ver abajo).

### La frontera no confina: peaje, no pasaporte 🔴 DECISIÓN
Primero se confinó el BFS al reino (una aldea no cruza a otro país). **Medido, eso mandaba a Temryuk
—la Crimea genovesa— a vender su grano en Génova, a 2.245 km cruzando el Mediterráneo**, porque
Génova no tenía plaza cerca. Consultados mercader y cronista, el confinamiento es históricamente
falso y se quitó:

- Aragón Ruano (Álava/Navarra, s. XV): la frontera **fiscalizó** el comercio, no lo redirigió — *"lo
  que sí varió, sin duda, fue la fiscalización de ese comercio"*. Los alaveses seguían sacando el vino
  de Navarra; el alcalde de sacas procesaba a los labradores de Vitoria (1450-69) — **cruzaban, y les
  caía el fisco encima**.
- Balard (*La Romanie génoise*): en el s. XV **Caffa se abastecía de su hinterland** (grano, pescado,
  sal de las llanuras rusas) y sus inversiones eran más regionales que occidentales. Hacer que Caffa
  dependa de Génova para su mercado cotidiano **contradice a Balard**.

Quien frena la arista extranjera es el **FLUJO**, no la topología: aduana (`almojOf`), guerra
(`TRADE_WAR`) y embargo (`isEmbargoed`), todo ya escrito en `economy.js:368-378`. Por eso
**`p.marketOf` no se recalcula al declarar una guerra**: la aldea sigue perteneciendo a su plaza, pero
el flujo con ella se ahoga mientras dure. Resultado: **331 aldeas (10,2%) venden en plaza extranjera**
—sobre todo la estepa y Rusia, donde las plazas escasean— y la cola absurda desaparece (máx 2.245 →
467 km). Los 5 casos que quedan por encima de 400 km son el desierto líbico, el Sáhara y la Traklandia
remota: **comarcas genuinamente lejos de todo nodo, que es la verdad de la época y no un bug**.

### Fundar ciudades es del JUGADOR, no del algoritmo 🔴 DECISIÓN
Se propuso **promover automáticamente** a plaza la aldea demasiado lejos de toda plaza (a 250 km:
48 plazas nuevas, y la lista salía llena de mercados históricos reales — Acre, Sivas, Erzurum, Samsun,
Varna, Messina, Alghero, Kalmar). **Rechazado, y por la razón correcta:**

- **Fundar ciudades va a ser una mecánica del jugador.** La corona no construía fábricas, pero sí
  otorgaba cartas de fundación; fundar crea un nodo y las provincias del entorno pasan a acudir a él
  en vez de a uno lejano (flete más barato, más acceso a bienes, desarrollo). Promover por algoritmo
  le roba al jugador su palanca principal.
- **La comarca remota de subsistencia es histórica**, no un defecto: vive del propio huerto, con poco
  metálico y una élite local pobre. Es el hueco que la fundación viene a llenar.

⚠ **Aviso del cronista para cuando se diseñe esa mecánica** (fuente: informe ESRC del *Gazetteer of
Markets and Fairs in England and Wales to 1516*): la premisa "el rey funda ciudades para desarrollar
la economía" es **falsa como regla**. En 1444 el rey **licencia**, no funda (~3/4 de las villas
inglesas eran señoriales), y *"los picos y valles de fundación de mercados los explica la política y
el patronazgo, no las tendencias comerciales"*: se concedían para **premiar servicios y recaudar**.
Dos tercios de los beneficiarios eran señores de un solo manor que **pagaban** por la concesión, y
**más del 60% de los mercados fracasó** — muchos comprados como marca de estatus, no por esperar
beneficio (el 61% de los mercados del obispo de Winchester no daba ningún ingreso en 1300-1). Eso es
**mejor juego**: una apuesta con clientelismo, no un botón de constructor. La carta otorgaba un
paquete real (concejo, sello, jurisdicción, fiscalidad, paz de mercado, portazgo; *Stadt* vs *Markt* =
poder amurallarse) → árbol de privilegios, no un interruptor.

### ⚠ Deuda conocida: nuestra plaza es el mercado REGIONAL, no el semanal
El cronista midió lo que nuestra mediana de 85 km significa de verdad. El radio real de un mercado
semanal era de **~5-11 km**, no de 15-30: Bracton da 6⅔ millas = **10,7 km** (la jornada de 20 millas
se parte en tres: ir, comerciar, volver), y el *Gazetteer* mide **2.016 plazas en 150.837 km² en 1300
= 75 km²/plaza → radio ~5 km**; el hinterland cerealista de Colchester, una ciudad regional, era de
8-10 millas (13-16 km). **Nuestros 85 km son ~8× el radio inglés real.** Pero ~93 km es el radio de
Noruega (~12 villas en todo el país), así que **el error no es uniforme: el radio histórico varía ×10-20
entre Essex y Escandinavia**. Conclusión para el diseño: nuestra "plaza" representa el **mercado
regional**, no el semanal de aldea — una provincia nuestra contiene del orden de 10-30 mercados
semanales ingleses. No bloquea nada, pero **un radio global es falso en casi todo el mapa**: tenerlo en
cuenta si alguna vez se calibra el alcance por región.

### Fase 2 — Los 4 básicos se limpian en la PLAZA, no en el pozo nacional 🟡 ⭐ EL CORAZÓN
El desbordamiento de grano (`economy.js:1195`) y el neto de los no-grano (`1209-1212`) dejan de caer
en `N.mkt` y caen en `p.mkt` de la plaza; la aldea compra/vende en su `marketOf` pagando `tradeCost`
corto. `N.mkt` de básicos pasa a ser **suma para el panel**, no verdad primaria. Precio de básicos →
`p.mktPrice` por plaza.
**Aquí paga el ADR:** se disuelve "las élites no consiguen grano" (compiten en su plaza, no en un pozo
con techo) y **el hambre se localiza**. Es el 80% del valor. No toca el invariante.
*Es el "si solo una cosa" del plan.*

### Fase 3 — Grafo ralo entre plazas + materia regional en dos radios 🟡
Arbitraje O(aristas) sobre `S.marketEdges` para básicos y materia de cadena **regional** (lana,
ganado, cuero, algodón, lino, uva, aceituna, minerales del entorno). La materia de **largo alcance**
(alumbre, tinte, especias, azúcar, pieles, ámbar) sigue capital-capital. `factDem` de las fábricas
tira de la plaza, no del agregado nacional.
⚠ **Hueco técnico a resolver antes:** `tradeCost` usa `capKm` (capital-capital); para plaza-plaza hay
que extenderlo a km provincia-provincia (`kmBetween` ya existe, es menor).

### Fase 4 — Manufactura: consumo local primero, destajo anclado a la plaza 🟡
El paño sirve la `LUX_NEED` de su plaza+satélites **antes** de exportar el excedente (reordena un
bucle, como `RMUL_ORDER`). El pago de `factDem` al campesino se **pondera por `p.pops.campesino` de
las provincias-origen**, no al campesino nacional — la variante barata del artesano, que ancla el
destajo a la geografía **sin** provincializar `sWealth`.

### Fase 5 — Provincializar `sWealth.burgues` 🔴 ⏳ ESPERA (línea roja)
Mover el bolsillo del burgués de `N.sWealth` a `p.pops.burgues`. **Punto de no retorno:** cruza
`ledger==economy` y toca a los cuatro estratos. Se retoma solo cuando (a) las Fases 1-4 estén probadas
y (b) un profiling demuestre que el bolsillo nacional es el artefacto que queda. Hasta entonces, la
Fase 4 cubre el sabor.

### Ortogonal (cualquier momento) — `tinte` + Tolfa 🟢
Añadir `tinte` a `BUILDINGS.telar.inputs` (hoy solo `{lana:0.5,alumbre:0.05}` — el alumbre sin tinte
es la cerradura sin la llave) y quitar "Tolfa" de `RES_DESC.alumbre` (anacronismo: se descubre ~1461).
Independiente de todo lo anterior.

## Rendimiento (medido en Fase 0 — el mercader tenía media razón)

Se creía que sería más caro que hoy por todos lados. **Medido, se parte en dos:**

- **El arbitraje sale MÁS BARATO que hoy (×0,28).** Hoy son 59 naciones en malla completa =
  1.711 pares × 36 bienes = 61.596 evaluaciones/mes. Mañana, sobre el grafo ralo, son 879 aristas =
  31.644. El grafo ralo gana porque hoy *todo el mundo se evalúa contra todo el mundo*. (Contra la
  malla completa de 423 plazas —89.253 pares, ×52— sería un desastre, pero nadie va a construir eso.)
- **El precio/stock de básicos SÍ es más caro: ×7,2 nodos** (59 `N.mkt` → 423 `p.mkt`). Es el gasto
  real de la migración, y cae sobre un término pequeño del tick (hoy 33,5 ms/tick, de los que el
  arbitraje mensual son 5,4).

Línea base para comparar en las fases 2-4: **33,5 ms/tick** (dt=24, mapa oficial, sin desarrollo);
tick sin arbitraje 33,3 ms; el arbitraje mensual añade 5,4 ms. Construir el grafo: 1,1 ms, 1× al
cambiar fronteras. Reproducir con `node tools/market-topology.mjs`.

## Verificación (todas las fases)

Arnés de equivalencia (`dt=24`) + preservar `Σ nationLedger(n) ≡ nationEconomy(n)` por recurso.
- Fases 0-1: equivalencia **exacta** (cero cambio económico).
- Fases 2-4: cambian el reparto espacial → la equivalencia se mide sobre los **agregados nacionales**
  (la suma de `p.mkt` debe reproducir el `N.mkt` anterior dentro de tolerancia). Si un agregado
  nacional se desvía, hay una fuga.
- `ensureMarket(N)` antes de tocar; escalar todo por `dt`.
