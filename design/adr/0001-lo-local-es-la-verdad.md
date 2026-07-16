# ADR 0001 — Lo local es la verdad; lo macro es un sumatorio

**Estado:** Aceptado · **Fecha:** 2026-07-16 · **Decisor:** Sergio

## Contexto

Basileus simula un mundo de ~3680 provincias agrupadas en ~60 naciones. A lo largo del desarrollo,
distintos sistemas se han modelado a distintos niveles de agregación según lo que era cómodo en cada
momento:

- **Nivel provincia:** la población (`p.pop`, `p.pops`), la producción (cada provincia produce según
  su terreno y edificios), la despensa de grano (`p.store.comida`), la moral, la cosecha (`harvestMul`).
- **Nivel nación:** el **mercado** (`N.mkt[g]` — un stock y un precio por bien y por reino), la
  riqueza de los estamentos (`N.sWealth`), la demanda de consumo (agregada por nación:
  `nationStrata`, `nationPop`), el tesoro de la corona (`N.res`), el arbitraje (empareja **capitales**,
  nación↔nación).

El mercado, en concreto, colapsa TODA la economía de un reino en un único pozo: la producción de
todas las provincias cae en `N.mkt`, todos los estamentos de todas las provincias compran de ese
único pozo al mismo precio, y el comercio exterior va de capital a capital. Solo la despensa de grano
sobrevive a nivel provincial.

Este colapso genera artefactos que hemos encontrado midiendo partidas reales:
- Las élites "no consiguen grano" (cobertura ~15%) — porque compiten en un pozo nacional único con
  un techo de precio, no en su mercado local.
- El hambre no se puede localizar — una provincia rica y una pobre del mismo reino comparten mercado.
- La geografía comercial hay que forzarla con `tradeCost` entre capitales, en vez de que emerja de
  dónde está cada provincia.

Verificación histórica (mercader, con fuentes): el mercado de 1444 **no** era un pozo por reino. Era
una **jerarquía de plazas** — aldeas sin mercado propio que dependían de la villa con derecho de
mercado más cercana, y un puñado de nodos internacionales (Brujas, Venecia, Génova, Florencia,
Londres, Barcelona). Menos denso que "un mercado por provincia", pero muchísimo más que "uno por
reino". El nivel nación es el **menos** fiel de los posibles.

## Decisión

**La PROVINCIA es la unidad fundamental de la simulación. Todo dato que hoy vive a nivel de nación,
mundo o cualquier agregado debe ser el SUMATORIO/ABSTRACCIÓN de datos que viven a nivel de provincia
— nunca la verdad primaria.**

En palabras de Sergio: *"todo lo que veamos a nivel de datos macro del país, del mercado local, lo
que sea, sea simplemente una abstracción/sumatorio de lo local, pero todo debe funcionar a nivel de
provincias. Quiero que esto sea piedra angular tenida en cuenta en todo desarrollo/fix/ajuste de
cosas existentes y futuras."*

Corolarios operativos:

1. **Un panel nacional (topbar, tesorería, mercado, ledger) muestra una SUMA o media de lo
   provincial. Nunca introduce una cantidad que no exista provincia a provincia.**
2. **Cuando un sistema nuevo elija su nivel, elige PROVINCIA por defecto.** Subir a nación es una
   decisión que hay que justificar (coste de cómputo, o que el fenómeno sea genuinamente nacional
   —p.ej. la palanca fiscal del jugador, que es una decisión de la corona—).
3. **La caja negra correcta es la provincia, no el reino.** Un mercader, una hambruna, un precio,
   una demanda: ocurren en un lugar concreto, no "en Castilla".

## Consecuencias

**Buenas:**
- La geografía deja de forzarse: emerge de dónde está cada provincia.
- Se disuelven artefactos en vez de parchearse (élites/grano, hambre local, oscilación).
- El principio da una regla clara para cada decisión futura: ante la duda, provincial.

**Malas / costes:**
- **El mercado nacional (`N.mkt`) es el mayor incumplidor y su rediseño es grande** — el núcleo
  económico. No es un ajuste. Se planea aparte (ver Alcance).
- **Más granular = más caro de computar.** Un mercado por provincia es O(provincias) donde hoy es
  O(naciones). Mitigante: acabamos de ganar ~28× de rendimiento (economía diaria, commit `29e81dd`),
  parte de ese margen se reinvierte aquí. Y la jerarquía histórica (no toda provincia tiene mercado)
  reduce el número real de nodos de mercado.
- **Retrofit:** aplicar el principio a lo ya construido es trabajo, no solo aplicarlo a lo nuevo.
  Se hace de forma incremental, sistema a sistema, no de golpe.

## Alternativas consideradas

- **Dejar el mercado nacional y parchear los artefactos uno a uno** (dar grano forzoso a las élites,
  localizar el hambre con reglas ad-hoc): rechazado. Cada parche es deuda; el principio los disuelve
  de raíz.
- **Un nivel intermedio (ducado/región) como átomo:** no elegido. La provincia ya existe como unidad
  con población, producción y despensa; añadir un nivel intermedio es complejidad sin fundamento
  claro. La jerarquía histórica (qué provincias tienen mercado) se puede modelar SOBRE la provincia,
  no sustituyéndola.

## Alcance y estado de implementación

Este ADR fija el **principio**, no lo implementa. El mercado provincial —el mayor incumplidor— se
diseñará con el `/consejo` antes de tocar código (mercader + campesino + el resto), decidiendo:
jerarquía de plazas (qué provincias tienen mercado y cuáles dependen de otra), cómo se conectan los
mercados locales, cómo se abastecen los estamentos de su plaza, y el presupuesto de rendimiento.

Los sistemas que YA son provinciales (población, producción, cosecha, despensa) están conformes.
El resto se audita y migra incrementalmente cuando se toque, no en una sola reescritura.
