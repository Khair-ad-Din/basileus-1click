# Modelo de mercado por centros y coste de movimiento (inspirado en EU5)

Acordado con Sergio el 2026-07-18. Evoluciona el mercado provincial (ADR 0001, ver
`design/mercado-provincial-plan.md`, fases 0-1 hechas) hacia el modelo de **centros de comercio +
propagación por dificultad de movimiento** de EU5 / Project Caesar. Continúa la fase 4 del
[roadmap del mapa nuevo](mapa-nuevo-roadmap.md).

## Secuencia acordada (importante: este es el ORDEN)
1. **Gazetteer**: nombres históricos de las provincias (hoy provisionales/silábicos).
2. **Verificar pops**: que la población se ubique de forma histórica, **sobre todo en las ciudades
   históricas**. En el campo o zonas sin datos, improvisar está bien.
3. Con **nombres bien + pops bien**, **propagar los centros de comercio y todo el sistema** (abajo).

Es decir, el sistema de mercado por centros se construye **después** de tener nombres y pops
creíbles, porque los centros salen de las ciudades históricas y su población.

## Qué robamos de EU5 (investigado 2026-07-18, Tinto Talks + wiki oficial)
EU5 tiene **dos** sistemas de propagación por coste; robamos el bueno:
- **Proximity/Control** (bueno): mancha de tinta desde un nodo por **coste de movimiento acumulado**
  con **multiplicadores de terreno**. Limpio y legible. **Es justo lo que ya hace `assignMarkets`.**
- **Market Access** (malo): por píxeles y **penaliza el mar** → rutas absurdas que evitan el agua.
  La comunidad lo critica. **NO lo copiamos**: nosotros ya invertimos el sesgo (el mar ABARATA,
  fase 1, `SEA_KM_MULT`).
- **Clave**: en EU5 **NO toda ciudad es centro de mercado**. Los centros son un conjunto limitado;
  el resto de ciudades *pertenecen* a un centro cercano.

Números portables de EU5 (Proximity, wiki Control): base +40/tramo; topografía **meseta +12,5% ·
colinas/pantano +25% · montaña +50%**; vegetación **desierto/vega +5% · arboleda +12,5% · bosque
+25% · selva +50%**; **ríos y caminos abaratan**; mar con puerto muy barato. Fundar mercado = acción
del jugador, habilitada si la localización es **urbana** o está **mal servida (<25% de acceso)**.
Fuentes: Tinto Talks #10 (mercados) y #47 (Market Attraction, Trade Range); wiki EU5 Control/Market.

## El modelo acordado

### A) Ciudad ≠ centro de mercado (arregla el "caos" de 378 plazas)
Hoy toda provincia `urban` + toda capital es nodo de mercado → **378 plazas** (mosaico ilegible).
Separar dos conceptos:
- **Ciudad** (`urban`): hay una ciudad (pops, edificios, nombre).
- **Centro de mercado**: solo un subconjunto — las **grandes**.

**Los centros se deciden por población histórica** (`cities1444.js`). Distribución medida:
≥10k = 162 · ≥15k = 105 · ≥20k = 80 · **≥25k = 58** · ≥30k = 53. **DECIDIDO (Sergio, 2026-07-18):
umbral 25k → 58 centros por dataset** (+ lista curada, ver dictamen abajo). Sale solo lo deseado:
**Italia/Flandes/Renania densísimos**, **Rusia/Escandinavia/estepa casi vacíos** (dominio
hanseático/veneciano, puro 1444). Ciudades pequeñas y curadas a mano (`MAPDATA.cities`, pop=0) dejan
de ser centros → pertenecen al más cercano.

**Crecimiento** ("que se vayan extendiendo"): el jugador **funda un mercado** en una localización
**urbana** o **mal servida**, con coste de oro + meses. La red se densifica con el tiempo.

### B) Orografía en la tinta (propagación por dificultad de movimiento)
El Dijkstra de `assignMarkets` ya suma coste por paso; se multiplica por un **factor de dificultad
del terreno** de destino. Tabla propuesta (adaptada de EU5 a nuestros tipos):

| Terreno | Factor | | Terreno | Factor |
|---|---|---|---|---|
| llanura / vega | ×1.0 | | bosque | ×1.25 |
| estepa / desierto | ×1.05 | | pantano / tundra | ×1.3 |
| meseta | ×1.15 | | montaña | ×1.6 |
| colinas | ×1.25 | | ríos / caminos (futuro) | abaratan |

Orden que pidió Sergio: **llanura 1.0 < meseta 1.15 < montaña 1.6** ✓. **DECIDIDO (consejo): reusar
`TERRAINS[t].mov`** (una sola verdad de dificultad de terreno, DRY — arreglar `mov` de meseta, hoy
1.0 → ~1.15). Cambia la **forma** de los territorios, no el número de centros. Nota honesta del
mercader: los factores son convención EU5 razonable, **no** dato de comercio de 1444 — no venderlos
como "fieles" en ningún changelog.

### C) Extras de EU5 para más adelante
- **Market Attraction**: un centro rico/grande **empuja su frontera más lejos** (ventaja inicial en
  la tinta según tamaño) → territorio de Venecia > el de un pueblo; competencia entre centros vecinos.
- **Acceso 0..1** por provincia (distancia → comercia menos): es el knob del **flujo** (fase 2 del
  mercado provincial), no de la topología. Modula cuánto de la producción entra al mercado.

## Dictamen del consejo (2026-07-18) — deliberado antes de implementar
Los cinco estamentos (⚠️ los cinco) + cronista + consejero revisaron el modelo. **El hallazgo de
fondo: esta ronda es TOPOLOGÍA, no dinero** — `p.marketOf`/`p.marketKm` hoy solo los lee la vista de
mapa (la economía no los toca). Pulir el mapa no cambia el bolsillo de nadie *aún*; el dinero es la
fase 2 (flujo). Cuatro de cinco estamentos coincidieron: **la población pura no basta para elegir un
centro**.

**Decisiones que ENTRAN (topología, sin mandos nuevos):**
1. **Ronda = topología pura**: `marketOf`/`marketKm`/`hubOf` NO enganchan `flujoBase`/`CAMP_CASH` aún.
2. **DOBLE CAPA** (clave): el grano es mercado **local y ubicuo** (radio ~10 km; cronista confirma la
   regla del "viaje de un día", matiz: tras la Peste menos mercados y más grandes). → las **378 plazas
   actuales se QUEDAN** como destino del grano (`marketOf`), y los **58 centros** son una **2ª capa**
   de arbitraje de largo alcance en campos NUEVOS `hubOf`/`hubKm`. Mismo Dijkstra, otro set de semillas,
   **sin pisar `marketOf`**.
3. **Criterio de centro COMPUESTO + capital siempre**: semilla = `pop≥25k` **O** lista curada de
   función. Curada = **todas las capitales** + Lübeck (¡no está en `cities1444.js`!), Cracovia, Ragusa,
   Augsburgo, sedes de peregrinación (Roma, Santiago, Canterbury, Colonia). **Ypres FUERA** (cronista:
   hundido en 1444, de >90k piezas/año a <25k). Lovaina marginal (en declive). Patrón "suelo" tipo
   `MAPDATA.cities` para la lista curada.
4. **Orografía reusa `TERRAINS[t].mov`** (ver B; arreglar meseta).
5. **Icono distinto centro ≠ villa** (sin texto, regla de UI).

**Aparcado con fecha (FASE 2 — cuando se enganche el flujo):**
- El **flete NO se evapora**: una fracción del coste de distancia → **renta señorial** vía
  `manorOf`/`bOwnerOf` (abadengo→clero, solariego→noble, **nunca la corona**). El diezmo grueso es
  grano físico que alimenta la oferta hacia el centro (clero).
- El coste de terreno multiplica `km×peso/precio` (reconectar `tradeCost`/`TRADE_BULK`, ya escrito), no
  coste plano (grano ≠ paño).
- **Aduana** (`almojOf`) la cobra el lado de **ORIGEN**.
- **RÍOS**: hueco prioritario (más que el mar para el grano interior: Rin, Loira, Vístula, Danubio).
  **Dos números obligatorios**: descuento de velocidad + **suelo de peaje** (el Rin tenía 79 estaciones
  de portazgo) — **nunca cero** (no repetir el error `TRADE_COST=0`).
- **Sund**: arista de coste alto en `seaAdj`/`navAdj` (peaje danés desde 1429, confirmado).
- **Market Attraction con TECHO** relativo (`sqrt(pop)` o `sWealth` del propietario dominante, no
  lineal) para no romper la policentricidad de 1444.
- **Fundar mercado** (🔴, es un mando): mismo botón, distinto pagador según `bOwner` (abadía/señor/rey);
  autopromoción de provincia solariega rica como motor de fondo. ESPERA.
- Investigación futura: aranceles políticos (lana inglesa); usura/precio justo (sin propuesta, necesita
  sesión dedicada del cronista).

**Primer entregable (decisiones 1+2+3 juntas):** en `assignMarkets`, set de semillas de centro =
capitales ∪ curada ∪ {urbanas con pop≥25k}, y 2ª pasada del Dijkstra que escribe `hubOf`/`hubKm` sin
tocar `marketOf`. Va DESPUÉS del gazetteer + verificación de pops (secuencia de Sergio).

**Fix colateral pendiente**: la ficha `design/epoca/noble.md` tiene invertido el privilegio de Koszyce
(1374) — es una EXENCIÓN de carga al noble (no pagar/construir castillos sin su acuerdo), NO un veto
del noble sobre la construcción real del rey. Corregir (cronista lo señaló: líneas ~143, 250-251, 304).

## Recordatorio transversal
**IA detallada**: para ver todo esto (mercados, orografía, marcha marítima, economía) de verdad en
acción hace falta una **IA de nación buena y detallada** (comercio, guerra, construcción, fundación
de ciudades/mercados coherentes). Anotado como trabajo mayor pendiente, transversal a estas fases.
