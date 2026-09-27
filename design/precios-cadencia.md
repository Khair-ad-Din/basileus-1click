# Precios y comercio por cadencia — "tres relojes"

> Estado: pasos 1-3 **HECHOS** (2026-09-27, rama `economia-v2`); paso 4 (hambruna) pendiente.
> Ver "Resultado" al final.
> Origen: la sonda de lujos e industria (3 años con la IA de obras) mostró que los talleres de un reino se abren y
> cierran TODOS A LA VEZ cada ~2 meses, con el precio saltando entre ×0,5 y ×3. Sergio propone que precios y comercio
> no se actualicen cada tick sino por semana o mes, con un buffer de oferta/demanda prevista.

## Por qué

**Lo que mide la sonda** (`node probe.mjs 3 --ia`, muestras cada 61 días):

| Lituania | día 61 | 122 | 183 | 244 | 305 | año 2: 61 | 122 | 183 | 244 | 305 |
|---|---|---|---|---|---|---|---|---|---|---|
| precio del paño ×ref | 1,05 | 3,00 | 1,19 | 3,00 | 0,83 | 1,15 | 0,50 | 1,65 | 0,50 | 1,22 |
| telares abiertos / cerrados | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 86/0 | 86/0 | 0/121 | 128/0 | 0/171 |

- No es "el Este": en la foto final los Otomanos tienen 228 telares cerrados, Inglaterra 73 herrerías y Hungría 52.
  La foto cae en una fase u otra de la ola.
- **Causa 1 — precio sin memoria + umbral común.** `price = ref × demanda/oferta` se recalcula cada día; todos los
  talleres del reino ven el mismo precio y el mismo `BLDG_LOSS` → se apagan juntos, la oferta de paño cae de 4.100 a 94
  al mes, el precio sube a ×3, se encienden juntos, y otra vez.
- **Causa 2 — la IA sobre-construye.** Su "¿ya cubre la oferta la demanda?" (`mktInfo.prod`) lee la fase apagada:
  Lituania levanta 175 telares que, encendidos, hacen 4.100 de paño/mes para una demanda de 1.300.
- (Causa 3, aparte: la herrería a precios de referencia deja ~+85/mes frente a ~+400 del telar; con el hierro a ×1,13
  ya pierde. Va al /consejo con los lujos.)

**Advertencia del código:** `sim.js:526` — *"arbitraje TAMBIÉN diario (barato) para reponer gradual y evitar la
oscilación mensual"*. Comerciar una vez al mes **sin buffer** ya se probó y oscilaba. El buffer es el corazón de esto.

## El diseño: tres relojes

### 1. Diario — lo físico (no cambia)
Producción, despensa, hambre, entregas a la plaza y compras. Se compra y vende **al precio vigente de la semana**. Lo
que sobra o falta en el día lo absorbe el **stock de la plaza** (el buffer).

### 2. Semanal — el día de mercado (precio local)
Cada 7 días, por reino y bien:
- **Previsión**: oferta y demanda medias de las últimas semanas (media móvil).
- **Precio objetivo** por los **días de cobertura del stock** frente a un objetivo (poco stock → sube; mucho → baja),
  corregido por la previsión.
- **Tope de paso**: el precio se mueve como mucho **±15% por semana** hacia su objetivo (×2 en ~5 semanas: una
  carestía seria del XV se notaba en meses, no en días). Acotado a ×0,5..×3 como hoy.
- Las **decisiones de los dueños** se toman con el **beneficio medio del mes**, no el del día: abrir/cerrar talleres
  (`autoManageBuildings`) y la IA de obras (`estateBuild`) pasan al reloj semanal. Esto corta la causa 1 y la 2.

### 3. Mensual — el comercio de largo recorrido (contratos)
Cada mes, por par de reinos y bien, el mercader firma un **contrato**: cuánto al mes, calculado con los precios que le
llegan **con retraso según la distancia**. Se **entrega a diario en fracciones** (sin golpes de mercancía). El mes
coincide con el libro de la Tesorería: el mes que lee el jugador es el periodo del contrato.

### Qué se recalcula en el acto (eventos)
El precio no se toca nunca fuera del día de mercado; lo que se recalcula son **contratos**:

| Evento | Qué pasa |
|---|---|
| Embargo o guerra entre A y B | se cancelan los contratos de ese par; **la mercancía en camino no se entrega y vuelve a su plaza de origen** (decisión de Sergio: sin subsistema de confiscación) |
| Paz / fin de embargo | el par vuelve a contratar en el siguiente ciclo mensual |
| Conquista de una capital | cambia el centro de comercio → se recalculan los contratos de ese reino |
| Ocupación de una provincia | deja de producir (ya es físico y diario) |
| Cambio de impuestos | se aplica a los flujos al momento, sin tocar el precio |

## Cadencia (decisión 1)

**Semana** para el precio local y **mes** para el comercio exterior. Por qué no más grande (estación):

- *Histórico*: el día de mercado era semanal (las mercuriales del grano se anotaban por semana; el pan se tasaba por
  ellas). El largo recorrido era estacional (galeras venecianas, flotas de la Hansa; ferias de Medina dos veces al año)
  y la información viajaba 3-4 semanas (Venecia-Brujas). *Pendiente de verificar por el cronista.*
- *Jugabilidad*: con estaciones, un embargo o un taller nuevo tardaría hasta 3 meses en notarse: el jugador no vería la
  causa y el efecto. El mes con contratos que usan precios con retraso ya recoge la lentitud histórica.

## La hambruna a mitad de semana (decisión 2 — en estudio)

**Lo primero: el precio no es lo que decide la hambruna; lo decide el grano que llega.** La hambruna se evalúa cada
día (`FAMINE_DEF=0,12`: si falta más del 12% del consumo, muere `STARVE_RATE` del déficit). El colchón real es la
despensa del campesino (0,7 años de consumo): solo compra en la plaza cuando la vacía. Y el grano sobra en todas las
regiones (×4-9 en el informe regional), así que hoy la hambruna es de guerra, asedio o mala cosecha local.

Lo que de verdad cambia con los relojes es **cuándo reacciona la importación**: hoy el arbitraje trae grano al día
siguiente; con contratos mensuales, hasta un mes después.

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Esperar** | Precio y contratos esperan a su día. Lo que no hay, no se compra (racionamiento). | Predecible, sin excepciones, histórico (tasa del pan, el concejo fija el precio). | La importación de grano tarda hasta un mes: más muertos en una crisis local. |
| **B. Precio de alarma** | Si el stock cubre < N días, el precio se recalcula en el acto. | El jugador ve la señal enseguida. | **No trae grano** (los contratos siguen siendo mensuales); solo reparte lo que hay por bolsillo: el pobre compra menos y muere más. Vuelven los saltos, justo en la crisis. Dos caminos que probar. |
| **C. Esperar + contrato de urgencia de grano** | Como A, pero declarar hambruna en un reino dispara el mismo evento que un embargo: sus contratos de **grano** se renegocian ese día. | No es un subsistema nuevo (usa el camino de los eventos). Histórico: licencias de saca de pan, compras de grano de los concejos y pósitos. El grano llega en fracciones diarias. | Un disparador más. Solo el grano tiene excepción. |

**Recomendación: C**, y medirla: el arnés compara muertes por hambre y días de hambruna entre el sistema de hoy, A y C
en un escenario de mala cosecha local. Si A no empeora apreciablemente, se queda A (más simple).

## Rendimiento (decisión 4)

Medido en el arnés (ms por día de juego, 190 naciones): producción y mercado de las provincias ~177 · IA de obras
~156 · comercio exterior ~17 · presupuesto ~11. **Pasar el precio a semanal casi no ahorra** (el precio es una
división). Donde está el tiempo:

- **IA de obras**: pasa al reloj semanal (arriba) → ~7× menos. Cambia el comportamiento, va dentro de este bloque.
- **El bucle de edificios de cada provincia** recorre los ~80 tipos de edificio del juego, no los construidos
  (~480.000 vueltas al día). Recorrer solo los construidos da **exactamente los mismos resultados**: se hace **aparte y
  primero**, y se verifica con el arnés comparando la salida número a número antes y después.

## Orden de trabajo

1. Bucle de edificios (solo velocidad, salida idéntica). Commit propio.
2. Reloj semanal: precio con buffer y tope + decisiones de dueños semanales con beneficio medio. Medir con la sonda:
   la ola de telares debe desaparecer.
3. Reloj mensual: contratos con retraso por distancia, entrega diaria, eventos (embargo/guerra/paz/capital).
4. Hambruna: A vs C en el arnés; decidir.
5. /consejo sobre lujos y la receta de la herrería, con los datos ya estables.
6. /ux: la ficha del bien debe mostrar el precio de la semana y los contratos del mes.

## Resultado (2026-09-27)

**Paso 1** (commit `df57aa4`): −43% de tiempo por día, salida idéntica byte a byte.

**Paso 2** — reloj semanal (`economy2.js` weeklyPrice, `estates.js` estatesDaily/manageWorkshops/needMore):
- La ola desaparece: los telares de Lituania pasan de 0 a ~120 en 3 años sin un solo cierre en bloque.
- El factor de stock solo empuja el precio **a la baja**: la plaza vende cada día lo que compra, así que un bien
  equilibrado nunca acumula stock; con un factor simétrico todo lo equilibrado se quedaba en ×1,5.
- **La plaza imprimía dinero sin que el invariante lo viera** (cuenta el saldo de la plaza como dinero):
  (1) el precio diario oscilante: compraba caro los días de ×3 y vendía barato los de ×0,5 (~20M/año); (2) las
  importaciones: la plaza de destino pagaba el precio entero y solo recuperaba precio×(1−comisión−alcabala) (~5M/año).
  Ahora el mercader compra en origen como un comprador y vende en destino como un productor. **Vara de control:
  saldo de las plazas ≈ −(valor del stock + lo tirado).**
- Al quedar neutra, afloró la deflación (−5%/año). Consejo del 2026-09-27: el flete lo cobra quien transporta
  (campesino hasta 30 km, burgués más allá y entre reinos: concepto "Transporte" en la interfaz), y pay() de la corona
  apunta su gasto en el libro de sumideros. Queda −2%/año (histórico ~−0,6%/año, cronista).

**Arreglado después (precio con demanda pagable):** antes, el precio semanal se calculaba con la demanda **deseada**, no con la que se puede pagar:
los lujos se quedan en el techo ×3, casi nadie los compra y el comercio (que lleva solo a quien puede pagar) no los
mueve. Especias: oferta mundial = demanda, pero 47% vendido.
  → Ahora usa la demanda que **puede pagar** (comprado + lo que faltó con dinero en la mano) más lo exportado:
  especias ×2,8 → ×2,0, pieles ×2,1 → ×1,5, caballos ×1,4 → ×0,8, armas ×2,2 → ×1,6. Lo vendido apenas se mueve.

**El tapón real del comercio → paso 3.** El mercader diario solo trae lo que al importador le FALTÓ AYER (`B.gap`).
Lo que llega se vende y se abre un hueco igual: en equilibrio el importador recibe la MITAD de lo que puede pagar
(todos los importadores de especias traen ~87/mes con un hueco constante de ~2,85/día; Egipto con 2.300 en stock).
Los CONTRATOS mensuales dimensionados con la demanda prevista (paso 3) lo resuelven de raíz. Probado y retirado:
dimensionar el almacén del exportador con la demanda prevista no ayuda sin contratos y duplica lo que se tira.

**Paso 3 — contratos** (`economy2.js` signContracts, entrega diaria en economyTick2): cada 30 días, por bien, cada
reino calcula su hueco neto de lo propio (demanda pagable prevista − oferta propia, sin sus contratos). Los
exportadores más baratos firman primero y venden donde más ganan (margen neto de flete, comisión y alcabala) hasta
agotar su sobrante o cubrir el hueco. Entrega diaria de 1/30 con los precios de la semana (el retraso de la noticia);
si ese día no sale a cuenta, no se envía. Embargo o reino desaparecido → contrato cancelado, la mercancía no sale.
La plaza del exportador guarda también lo contratado. Contratos en `N.e2.ctr` (se guardan con la partida).
Resultado a 3 años: especias ×2,0 → ×1,28 (52% vendido), pieles 39% → 59%, caballos 55% → 77%; lujo de la nobleza
y el clero de Polonia de 0-3% a ~50%. Deflación −1,5%/año. Plazas ≈ −(stock + tirado): sin impresora.
Pendiente: los burgueses de Venecia y Francia gastan más de lo que ingresan (calibración, no los contratos);
lo tirado sube (~1,7M/año: stock guardado para contratos que no salen a cuenta).
