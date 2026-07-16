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
| 0 — Aldea | `!p.urban` (~93%) | Sin mercado. Satélite de su plaza (`p.marketOf`). |
| 1 — Plaza local | `p.urban && !p.capital` (~300-500?, medir) | Mercado propio (`p.mkt`/`p.mktPrice`). |
| 2 — Nodo internacional | `p.capital` (~40-70) | El arbitraje de larga distancia de hoy, tal cual. |

## Las fases (en orden de dependencia)

### Fase 0 — Medir y construir la topología 🟢
Contar `p.urban`/`p.capital` reales (el recuento ~300-500 es confianza BAJA); precalcular
`S.marketEdges` (grafo ralo: `S.adj` + `S.seaAdj` + arista extra si `kmBetween < ~150 km`, solo entre
plazas del mismo dueño); instrumentar coste/tick. **Cero cambio de comportamiento.** Ninguna constante
se fija sin estos números.

### Fase 1 — `p.marketOf`: aldea → plaza más cercana 🟢
BFS multifuente sobre `S.marketEdges` desde plazas del mismo dueño (fallback a capital si aislada).
O(provincias), una vez (y al cambiar fronteras). Solo asigna pertenencia; **no mueve un ducado**.
Verificable coloreando provincias por su plaza.

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

## Rendimiento (corrección al mercader)

El "más barato que hoy" del mercader es contra la malla completa (4,8M ops), que nadie construirá —
no contra hoy. **Contra hoy es MÁS caro**: el precio local pasa de ~60 naciones a ~300-500 plazas
(6-8× nodos) + el arbitraje de aristas. Asumible por el ~28× ganado en `29e81dd`, pero es gasto.
**Medir en Fase 0:** recuento real de plazas, `|S.marketEdges|`, coste del tick de básicos por plaza,
y **decidir la cadencia del arbitraje inter-plaza** (recomendado: heredar `doArb` mensual; si corre
cada tick, el coste se dispara).

## Verificación (todas las fases)

Arnés de equivalencia (`dt=24`) + preservar `Σ nationLedger(n) ≡ nationEconomy(n)` por recurso.
- Fases 0-1: equivalencia **exacta** (cero cambio económico).
- Fases 2-4: cambian el reparto espacial → la equivalencia se mide sobre los **agregados nacionales**
  (la suma de `p.mkt` debe reproducir el `N.mkt` anterior dentro de tolerancia). Si un agregado
  nacional se desvía, hay una fuga.
- `ensureMarket(N)` antes de tocar; escalar todo por `dt`.
