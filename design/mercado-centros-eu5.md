# Modelo de mercado por centros y coste de movimiento (inspirado en EU5)

Acordado con Sergio el 2026-07-18. Evoluciona el mercado provincial (ADR 0001, ver
`design/mercado-provincial-plan.md`, fases 0-1 hechas) hacia el modelo de **centros de comercio +
propagación por dificultad de movimiento** de EU5 / Project Caesar. Continúa la fase 4 del
[roadmap del mapa nuevo](mapa-nuevo-roadmap.md).

## ⭐ FASE 2 (EL FLUJO — EL DINERO) — IMPLEMENTADA, SIN CALIBRAR EN REAL (2026-07-21)

**Estado:** las 5 decisiones del consejo (deliberado 2026-07-21, dictamen abajo) están ESCRITAS en
`economy.js` y VERIFICADAS con arnés (`scratchpad/verify-cover.mjs`): **invariante `ledger==economy`
intacto en frío y tras simular** (Δ<1e-6, 190 naciones), **sin NaN**. FALTA la CALIBRACIÓN en la partida
real de Sergio (`startEconLog`). NADA COMMITEADO aún. Precede: topología commiteada `af05dd9` (Capa 1
`marketOf`/`marketKm`, Capa 2 `hubOf`/`hubKm`, 57 centros).

**Lo implementado (5 decisiones, en este orden):**
1. **COBERTURA DE INSUMOS (prerrequisito que nadie vio salvo el artesano).** Antes `prodAdd` era
   INCONDICIONAL: el telar tejía paño existiera o no la lana comprada, así que estrangular la materia prima
   no se notaba. Ahora `prodAdd` × `inputCoverOf` (= `fbuy/fneed` suavizado EMA en `N.inputCover`, min sobre
   los inputs de la cadena). Aplicado en los 3 espejos (`provEconomyByOwner`/`provBreakdown`/`nationLedger`)
   + `buildingYield`. **Sin esto la Fase 2 no se puede medir.** Verificado: la cadena YA puede fallar.
2. **ACCESO 0..1 sobre `marketKm`** (NO `hubKm` — medir contra los 57 hubs hundiría la Europa rural normal;
   el campesino vendía en la plaza local, malla densa). Smoothstep pleno ≤`ACCESS_NEAR`=60 km → suelo
   `ACCESS_FLOOR`=0.10 en `ACCESS_FAR`=280 km. Gatea `campCash` + lo que el campesino vierte a `N.mkt`
   (grano sobrante, básicos no-grano, materia prima regional); EXENTOS los de largo alcance (`ACCESS_EXEMPT`:
   pieles/ámbar/alumbre/tinte/sedacruda/seda/raros). NO toca subsistencia/despensa/hambruna ni extracción
   feudal (decisión cerrada de Sergio). **Medido: mediana 0.81, 27% pleno; las de menor acceso son fiordos
   escandinavos a >500 km — periferia genuina, NO Francia/Castilla.**
3. **RE-ANCLAJE del arbitraje** (`capKm`/`tradeCost`): la distancia internacional sale del `hubOf` de la
   capital (centro de comercio real: Brujas/Danzig no eran capitales — de Roover), no de la capital política.
   Barato, sin estado nuevo, sin tocar `N.mkt`. (La reescritura completa a mercado-por-hub sigue APARCADA.)
4. **FLETE sobre el excedente monetizado** (`provFlete`): coste = `TRADE_KM × hubKm × peso/precio` del grano,
   sin descuento marítimo (acopio terrestre; hubKm ya lleva la orografía dentro). CLAMP `FLETE_MAX`=0.85. El
   GRUESO evapora (carretero/merma). **Medido: mediana 0.20; el interior profundo a ~1300 km del hub topa a
   0.85 → su grano no compensa moverlo (esto DESINTEGRA el Este, no el acceso).**
5. **PORTAZGO** = `TOLL_FRAC`=15% del flete al señor de ORIGEN vía `manorOf` (abadengo→clero, solariego→
   noble, realengo→CORONA — **SIN excepción "nunca corona"**, mercader#2). Anotado en `p.tollIncome` por
   provincia (semilla de "señores con tierra"). El de la corona es ingreso VARIABLE (como la alcábala:
   `N.tollRate`→`S.tsyAlc`, fuera del ledger fijo → no rompe el invariante). Campo `toll` en el econlog.

**REENCUADRE clave (materia prima corrigió la expectativa):** el plan esperaba que el ACCESO fuera el
antídoto del Este. Pero como en la recon de pops sembramos plazas propias en el Este (entrepôts de 25k), los
rusos tienen mercado LOCAL → acceso decente (correcto: comerciaban local). Lo ahistórico es su grano fluyendo
al mercado OCCIDENTAL, y eso lo frena el FLETE (decisión 4) + el re-anclaje (3). **Acceso silencia la
periferia sin mercado (Escandinavia); flete+re-anclaje desintegran el Este del Oeste. Capas separadas
(marketKm vs hubKm) → sin doble penalización (campesino#2).**

**PENDIENTE (calibración de Sergio en local con `startEconLog` + fábricas reales):**
- **Cobertura ~0 con fábricas UNIFORMES** (arnés siembra telar en las 6.000 prov; irreal). El mecanismo es
  correcto (spread 0→1, no bug), pero el nivel depende de colocación de fábrica vs `RESTYPE_RATE` vs
  intensidad de `B.inputs`. Se calibra al fijar CUÁNTAS fábricas y DÓNDE arranca la partida (decisión de
  Sergio 2026-07-21: "luego calibramos... lo mismo con extracción de recursos").
- Perillas de acceso (`ACCESS_NEAR/FAR/FLOOR`; p25=0.19 quizá estrangula de más) y flete (`FLETE_MAX`,
  `TRADE_KM` terrestre) y portazgo (`TOLL_FRAC`).

**Invariante:** `ledger==economy` verificado (el acceso/flete/portazgo solo tocan `sWealth`/`N.mkt`/ingreso
variable, nunca el tesoro fijo). Ojo al calentamiento del econlog ([[basileus-econlog-y-calentamiento]]).
**Riesgo transversal:** para ver el flujo hace falta una IA de nación decente. Trabajo mayor aparte.

---

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

## CAPA 1 (grano local) — DICTAMEN DEL CONSEJO (2026-07-20/21) — ✅ HECHO (commit `af05dd9`)

Sergio vio la Capa 1 (mercado local del grano, `assignMarkets`→`marketOf`) como un **mosaico ilegible** y
propuso simplificarla: (A) grano difunde a adyacentes cada mes, o (B) plaza local = **capital del ducado**.
Se convocó el consejo (5 estamentos + cronista + consejero). **Veredicto unánime:**

- **(B) DESCARTADA con dato duro.** El grano se vendía en radio **~16 km** (Farmer, cuentas de los manors
  de Deverill, Wiltshire, AgHR 1989; lana ~32 km). El ducado (~35-40 km) es **2-2,5× demasiado grande**
  para el grano, y confunde tres cosas distintas de 1444: el **señorío/granero** (renta, ya en `manorOf`),
  la **plaza de mercado** (villa con carta), y el **ducado** (demarcación de justicia/vasallaje). Los seis
  coincidieron. La doctrina "viaje de un día → catchment ~10 millas" es de **Bracton**, no del Statute of
  Winchester (corrección del cronista). No re-proponer B.
- **(A) DESCARTADA**: borra el **nodo de precio fijo** que la Capa 2 necesita encima.
- **(C) el Dijkstra en km actual SE QUEDA** intacto: es el modelo correcto (central place theory sobre
  villas-mercado), respeta el km del carro y ya alimenta `marketKm` para el flete. **La ilegibilidad es un
  problema de RENDER, no de mecánica** (mandamiento del consejo: el realismo se PERCIBE, no se OPERA).

**LO PERTINENTE A ARREGLAR DE LA CAPA 1 (primer bloque de la próxima sesión, ANTES de los centros):**
1. **Render** (🟡, la "una sola cosa"): `render.js:57-58` — el color por-plaza (`marketOf*137.508`) es
   confeti de ~400 tonos. Agrupar el color por comarca/ducado + contorno suave (BS=3 ya existe) + relleno
   desaturado → zonas legibles, subdivisiones como líneas finas. **Sin tocar una línea de economía.**
2. **Disciplina de nombre** (🟢): el nodo por comarca es **"núcleo urbano de la comarca"**, NUNCA "capital
   del ducado" (el código ya elige la provincia más urbana, no la corte — si se etiqueta mal, alguien lo
   "corrige" hacia la sede señorial y rompe la mecánica).
3. **Aparcado con fecha**: si tras pintarlo bien la vista SIGUE siendo confeti → consolidar a un nodo por
   comarca (≤974 semillas **resueltas por km**, nunca asignación directa a la capital = eso es B con otro
   nombre). Gatillo: Sergio corre la vista pintada y dice "sigue siendo confeti".
4. **Nota para la Fase 2 (flujo)**: el flete solo pesa sobre el **excedente monetizado**
   (`fb*rr.campesino*CAMP_CASH`), no sobre `flujoBase` bruto (campesino) — no cobrar peaje por el grano que
   el campesino se come en casa.

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
3. **Criterio de centro COMPUESTO — la CAPITAL NO cuenta** (⚠️ CORREGIDO por Sergio 2026-07-19, revoca
   el "capital siempre" original): semilla = `pop≥25k` **O** lista curada **de función comercial**.
   Ser sede política no hace centro de comercio: una capital pequeña se abastece de centros vecinos,
   **aunque sean de otro país** (la frontera no confina, ya es así en `assignMarkets`). Motivo del giro:
   con 190 naciones, "capital siempre" disparaba los centros de ~57 a **233** (medido en la vista
   Ciudades) — deshacía la reducción que era el objetivo (378→~58 legibles). Curada = Lübeck (¡no está
   en `cities1444.js`!), Cracovia, Ragusa, Augsburgo, sedes de peregrinación (Roma, Santiago, Canterbury,
   Colonia) — **por su comercio, no por ser capitales**. **Ypres FUERA** (cronista: hundido en 1444, de
   >90k piezas/año a <25k). Lovaina marginal (en declive). Patrón "suelo" tipo `MAPDATA.cities` para la
   lista curada. Umbral en `config.js` `CENTER_POP=25000`.
4. **Orografía reusa `TERRAINS[t].mov`** (ver B; arreglar meseta).
5. **Icono distinto centro ≠ villa** (sin texto, regla de UI).

**Aparcado con fecha (FASE 2) — ⚠️ REVISADO por el consejo 2026-07-21 (ver dictamen arriba):**
- El flete: el consejo lo CORRIGIÓ. El **grueso EVAPORA** (coste de transporte: carretero, bestias, merma
  — la banalidad inglesa murió c.1400, cronista C); solo una fracción PEQUEÑA (`TOLL_FRAC`~15%, PARÁMETRO
  no dato) es **portazgo** del señor de ORIGEN vía `manorOf`. **Se ELIMINA el "nunca corona"** (mercader#2:
  el portazgo sigue `manorOf`, realengo→corona incluido, o se contradice `manorOf`). ~~El diezmo grueso
  alimenta la oferta hacia el centro~~ → FRASE RETIRADA (cronista G: el diezmo grueso se apartaba en gavilla
  en el campo, ANTES de la venta; NUNCA dependió del mercado — no mezclar con el flete).
- El coste de terreno multiplica `km×peso/precio` (`tradeCost`/`TRADE_BULK`) — HECHO en `provFlete` (hubKm
  ya lleva la orografía). Clamp `FLETE_MAX`=0.85 (ancla: coste TOTAL de ruta sal Portugal→Brujas; el "85%"
  del mercader era coste de ruta, NO peaje — cronista D).
- **Aduana** (`almojOf`) la cobra el lado de **ORIGEN**.
- **Báltico 1444**: el bien eclesiástico de larga distancia es **CERA**, no grano (el grano báltico a
  Occidente es s. XVI+, nobleza polaca — cronista F). Solo flavor.
- **APARCADO aún**: mercado-por-hub completo (precio regional real, estado nuevo por hub — 🔴); lotería
  ~17% abadengo del flete rural + `granja`→`ESTATE_BUILDS.clero` (clero#2/#5, junto con `MANOR_RENT`); la
  fábrica paga flete por su propio `hubKm` (artesano#2, refinamiento tras calibrar la cobertura).
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
curada ∪ {urbanas con `cityPop≥CENTER_POP`} — **sin las capitales** (ver corrección en la decisión 3),
y 2ª pasada del Dijkstra que escribe `hubOf`/`hubKm` sin tocar `marketOf`. Va DESPUÉS del gazetteer +
verificación de pops (secuencia de Sergio).

**Ciudades FUSIONADAS en el mapa político (HECHO 2026-07-19, decisión de Sergio):** no hay modo aparte.
En el político (y solo ahí, no en las vistas de datos) cada urbe se rotula: **villa** = punto + nombre
(el nombre aparece al acercar el zoom, `z>2.4`, para no amontonar); **centro** (`cityPop≥CENTER_POP`) =
**cuadro dorado** + nombre SIEMPRE (con población), que **sustituye** al rombo de la
capital de ducado cuando coinciden. El punto de villa se omite si ya hay rombo de ducado o disco de
capital (no doblar ancla). Así se leen a la vez villa / capital de ducado / capital de ducado+ciudad+
mercado. Todo en el bloque de marcadores de `render.js` (`politicalView`). Recuento (materia prima):
**526 ciudades · 57 centros**, encabezados por Fustat, Tabriz, Venezia, Milano, Gent, Genova, Brugge…
(comprobado reconstruyendo el mundo oficial en Node). Es el paso "verificar pops" de la secuencia.

**Fix colateral pendiente**: la ficha `design/epoca/noble.md` tiene invertido el privilegio de Koszyce
(1374) — es una EXENCIÓN de carga al noble (no pagar/construir castillos sin su acuerdo), NO un veto
del noble sobre la construcción real del rey. Corregir (cronista lo señaló: líneas ~143, 250-251, 304).

## Recordatorio transversal
**IA detallada**: para ver todo esto (mercados, orografía, marcha marítima, economía) de verdad en
acción hace falta una **IA de nación buena y detallada** (comercio, guerra, construcción, fundación
de ciudades/mercados coherentes). Anotado como trabajo mayor pendiente, transversal a estas fases.
