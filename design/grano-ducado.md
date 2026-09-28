# El grano: granero por ducado, siega anual y natalidad

> Estado: **pasos 1-4 HECHOS** (2026-09-28, rama `economia-v2`). Pendiente: anclas del jugador (paso 5, con `/ux`).
> Decisiones de Sergio (2026-09-28): simplificar; suerte de la cosecha por ducado; siega por provincia según su
> cultivo; comercio de grano limitado por COSTE, no por cantidad, y cristalino para el jugador; el grano acumulado se
> convierte en natalidad (tope natural del exceso y motor de crecimiento). Hambrunas periódicas, no erradicarlas.

## Por qué

Antes (medido, 20 años): **la hambruna no existía**. Despensas al 95-100%, grano a ×0,5 en todos los reinos, y en la
peor cosecha (−27%) solo 5 de ~5.000 provincias con hambre. Tres colchones apilados:
1. El diezmo y la renta en especie que la plaza no compraba (~85%) **volvían a la despensa de la aldea**.
2. Despensa de 0,7 años.
3. El grano de socorro llegaba de todo el reino al precio nacional y **sin flete**.

## Cómo funciona ahora

1. **Siega anual por provincia, en su mes** (`harvestMonth`, economy.js): Nilo en abril, Mediterráneo en junio,
   centro en julio, norte en agosto, Escandinavia en septiembre (hoy por latitud; en el futuro, por cultivo).
   Cosecha del año = campesinos × `GRAIN_YIELD` (1,40) × fertilidad del terreno × año del ducado.
2. **El año del ducado** (`harvestMul`): el año común a Europa (70% de la varianza, con cola de desastre) + la suerte
   del DUCADO (antes, de cada provincia). Amplitud total intacta (Campbell & Ó Gráda).
3. **Granero del ducado** (`granaryPass`, economy2.js): las provincias de un ducado del mismo dueño (926 graneros)
   ponen su grano en común; sus campesinos comen de él cada día. Capacidad: 1,25 años (× Almacén).
4. **Vende solo lo que sobra**: lo que pasa de 1,2 × lo necesario hasta la próxima siega (`GRAIN_RESERVE`) se vende
   a la plaza del reino en ~un mes. El dinero se reparte como la cosecha: diezmo al clero, renta al señor, el resto al
   campesino (con su pecho). Lo que la plaza no compra vuelve al granero.
5. **Si se vacía, compra en la plaza pagando precio + flete** desde su centro de comercio: el grano es lo más caro de
   mover. Un ducado remoto o de montaña lo paga más caro, pero puede importarlo si puede pagarlo (Granada). El flete
   lo cobran los transportistas. Si no le llega (dinero o grano), hambre: muere el 60% del déficit por encima del 12%.
6. **Natalidad según los meses de grano** (`foodGrowth`): ×0,3 con el granero casi vacío, ×1 con un año, hasta ×1,8
   con más de 18 meses. El grano que sobra se convierte en súbditos, que comen más: el exceso se regula solo.

## Calibración (medida, 25 años)

| `GRAIN_YIELD` | Años con hambre notable | Grandes (20-35 ducados) | Muertos 25 años | Población |
|---|---|---|---|---|
| 1,55 | ~ninguno (sobra ~50%) | 0 | ~10k | +0,65%/año |
| **1,40** | **5 de 25** | **2** | **~300k (0,5%)** | **+0,5%/año** |
| 1,45 | 3 de 25 | 2 (más suaves) | ~170k | +0,5%/año |

El hambre llega **el año siguiente a la mala cosecha** (cuando el granero se vacía antes de la siega: el hambre de
primavera). Regional: como mucho ~35 de 926 ducados a la vez.

**Dónde cae** (20 años, medido). Con 1,40 y el flete de socorro solo desde el centro más cercano, un reino grande era un
seguro gigante: Polonia-Lituania nunca, Rusia una vez por granero cada ~720 años, mientras el Sacro Imperio, Italia e
Irlanda (reinos de 1-3 ducados) cargaban con todo. Decisión de Sergio (2026-09-28): **B** el grano de socorro paga el
flete desde el centro de comercio de la CAPITAL (`reliefRoute`/`reliefFlete`), y **C** `GRAIN_YIELD` 1,40 → 1,35.

| Región | Episodios por granero (años entre uno y otro) antes → ahora |
|---|---|
| Islas Británicas · P.Bajos-Alemania · Egipto-Magreb · Anatolia | 53-63 → **30-37** |
| Francia · Italia | 80-100 → **53-60** |
| Iberia | 142 → **89** |
| Hungría-Balcanes · Rusia | 460-720 → **125-131** |
| Escandinavia | 453 → **194** |
| Polonia-Lituania | nunca → casi nunca (el granero de Europa: llanura fértil y poca gente) |

El 22% de los graneros pasa hambre alguna vez en 20 años. Repiten la **montaña** (Salzburgo, Trentino, Granada,
Albania, Avaria) y los **reinos diminutos y lejos de su centro** (los irlandeses: 420-560 km). ~550k muertos en 20 años
(~0,9%); la población sigue creciendo.

## En la interfaz

Ficha de provincia, fila **🌾 Granero** (`pantryRow2`, ui.js): barra de meses + "hasta abril" / "⚠ no llega a julio" /
"🛒 comprando" / "⚠ Hambre". El tooltip explica: el ducado, grano guardado / capacidad, para cuántos meses alcanza,
próxima siega, cosecha del ducado este año, lo que comen, diezmo + renta, **lo que cuesta traer grano (precio + flete =
total)** y la natalidad por el grano.

## Anclas del jugador (paso 5) — `/ux` 2026-09-28, diseño B del director (patrón EU4)

Decisiones de fondo: las anclas 1 (almacén) y 2 (comprar) son **una sola acción, "Socorro"**; la cantidad es **tiempo**
("hasta la siega"), un clic, sin compras a medias; **una sola fuente del precio**, `reliefQuote(pagador, provincia)`
(economy2.js), que leen tooltip, botón, mapa, pósito, IA y aliados; `reliefRoute(p, pagador)` ya acepta otro pagador
(aliados, futuro); todo gasto va al libro de la corona como **"🌾 Socorro"** por ducado.

- **HECHO — botón en la ficha** (`reliefRow2`, ui.js): solo en ducados propios que no llegan a la siega o tienen hambre.
  "🛒 Socorro → julio · 10.216 🪙" (desactivado y en rojo si no se puede). Tooltip: falta hasta la siega, del almacén
  de la corona (sin tocar 3 meses de comida del ejército), comprado en la plaza × precio, flete desde · km · % · 🪙,
  total. `reliefSend` descuenta almacén, compra en la plaza (comisión, alcabala, plaza), paga el flete a los
  transportistas y reparte el grano por el granero. Invariante del dinero exacto (Δ = 0, medido).
- **HECHO — modo de mapa "Graneros"** (menú de mapas; `S.granView`, `computeGranMap`/`refreshGranLegend` en ui.js,
  `granColor` en render.js): cada provincia propia en verde (de sobra, ≥12 m) / ocre (llega) / rojo (no llega a su
  siega) / granate (hambre); lo ajeno, apagado. La leyenda lista los ducados que no llegan, del más urgente, con su botón
  `🛒 total` (la misma cifra que la ficha). Se repinta solo lo que cambia, una vez al día y tras cada socorro.
  "No llega" se decide con el GRANERO entero (un ducado puede segar en dos meses): si sale rojo, hay botón.
  La corona compra a su precio efectivo (sin su propia alcabala): lo anunciado es exactamente lo que baja el tesoro.
- Pendiente, en orden: **⛔ prohibir la saca** en la fila del granero (tooltip: lo que pierden campesinos/clero/señor/plaza y los meses
  que gana); **Pósito** en Hacienda (tope mensual; socorre solo, del que antes se vacía; la IA usa la misma palanca);
  opcional, alerta "🌾3" junto al botón del mapa.
