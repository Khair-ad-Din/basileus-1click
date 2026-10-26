# Capacidad agraria: la tierra pone el techo a la población

> Estado: **/consejo HECHO y aceptado por Sergio (2026-09-28); en medición.** K regional + f(x) implementados (sin commitear).
> Viene de `design/grano-ducado.md` (granero por ducado, siega anual, natalidad por el grano: HECHO).

## El problema

Sobra mucho grano y no tiene salida. La natalidad ya sigue a los meses de grano (`foodGrowth`), pero **cada campesino
nuevo produce un rendimiento fijo** (`GRAIN_YIELD` × terreno × año): el crecimiento nunca se frena, el grano sobrante
crece con la población y las hambrunas solo vienen de los malos años, no de la presión sobre la tierra.

## La idea de Sergio (2026-09-28)

El grano que no necesita el mercado se queda en el campesinado y se convierte en natalidad; la población crece hasta
lo que la tierra puede sostener; por encima, cada campesino rinde menos hasta no alimentarse, y el hambre devuelve la
población al equilibrio. El techo sube con tecnologías de cultivo. El jugador puede crear metrópolis por encima de su
techo alimentándolas desde fuera del ducado (como la *annona* de Roma).

## Qué hacen otros juegos

- **EU5 (2025)** — el más cercano: capacidad de población por localidad; "tierra libre abundante" da hasta +1,5% de
  crecimiento; el grano almacenado suma crecimiento (+0,08% por cada 12 meses guardados); la hambruna baja el
  crecimiento (−5%), recorta la capacidad a la mitad y hace emigrar. Comida: localidad → provincia → mercado.
- **Imperator: Rome** — capacidad de población + comida; el hambre mataba por encima de lo sostenible. Crítica más
  repetida: el grano no se podía mover (Egipto no podía alimentar a Roma). **Lección: que el grano viaje, con flete.**
- **Victoria 3** — la tierra cultivable limita las granjas; las granjas de subsistencia absorben a los campesinos
  sobrantes y casi nunca se agotan. Crítica: casi imposible provocar una hambruna. **Lección: el techo tiene que morder.**

## La propuesta

1. **Capacidad agraria por provincia (K)**: la gente que alimenta su tierra con las técnicas de 1444. Ancla: Europa en
   1444 sigue por debajo de su techo anterior a la Peste Negra (hacia 1300 había bastante más gente). **Decisión de
   Sergio: más tensión desde el principio aunque sea algo menos histórico** → K ≈ población de 1444 × **~1,3** (no ~1,5),
   algo menos en la montaña. El cronista debe fijar el ancla por región (población ~1300 frente a ~1444).
2. **Rendimiento decreciente** por campesino según la ocupación x = campesinos / K:
   - x ≤ ~0,7: rinde pleno (tierra de sobra; la natalidad aprovecha el grano que sobra);
   - 0,7-1: cada campesino nuevo rinde menos (peores tierras, parcelas más pequeñas);
   - x = 1: en un año normal y en tierra de fertilidad media, la cosecha BRUTA por cabeza es justo lo que come
     (corregido por el consejo: la renta y el diezmo del grano se cobran sobre lo VENDIDO, no sobre el bruto);
   - x > 1: no se alimentan; hambre en cuanto viene un mal año; las muertes devuelven la población a K.
3. **El lazo que sale**: tras la Peste sobra grano (barato, la gente se multiplica: la "edad de oro del jornalero");
   con las décadas la población se acerca a K, el margen se estrecha y las hambrunas se hacen más frecuentes (el XVI).
   La salida del grano sobrante es la natalidad y el tope es la tierra: no hay que tirar nada.
4. **Las ciudades no tienen techo agrario**: burgueses, clero y nobleza no cultivan; comen de la plaza, del socorro y
   de los contratos. Una metrópoli puede superar su tierra si alguien le trae el grano y lo puede pagar (tubería ya
   hecha: `reliefQuote`/`reliefSend`, contratos entre reinos).
5. **Palancas del jugador que suben K**: tecnologías de cultivo (futuro: rotación trienal, arado de vertedera, cultivos
   nuevos tras 1500); obras que amplían la tierra (drenaje, regadío; la Granja podría pasar a subir K en vez de producir
   aparte).
6. **Decreto real "Reserva de los graneros"** (en Hacienda, junto al futuro Pósito): cuánto guarda cada granero antes
   de vender (hoy fijo: 1,2 × lo necesario hasta la siega; `GRAIN_RESERVE`). Más reserva = menos hambre tras un mal año,
   menos ingresos para los estamentos, grano más caro en las ciudades. **Idea de Sergio para cuando se enganche la
   lealtad de los estamentos**: la nobleza quiere reserva baja (vender, dinero); el campesinado, alta (seguro). Es el
   primero de una familia de "decretos" reales. (Sustituye a la "prohibición de saca", que aportaba poco: un granero
   que no llega a la siega ya no vende.)
7. **Interfaz**: una fila en la ficha, "🌾 Tierra · barra · 82%", con tooltip (capacidad, campesinos, rendimiento ×0,9,
   "por encima del 100% la tierra no los alimenta"); el mapa "Graneros" podría ganar una vista "presión sobre la tierra".

## Tiempos (a vigilar)

Con ~0,5%/año de crecimiento, pasar del 65% al 95% de ocupación lleva ~75 años. Con el factor 1,3 se arranca más cerca
(~77% de ocupación): más tensión desde el principio.

## Plan de la sesión nueva

1. `/consejo` sobre esta propuesta (cronista: el ancla 1300/1444 por región; campesino y noble: la curva y el decreto).
2. Medir 80-100 años con el arnés: población frente a K, hambrunas por década, precio del grano, dinero.
3. Implementar (economy2: K por provincia y rendimiento decreciente en la siega; ui: fila "Tierra") + `/ux`.
4. Después, lo pendiente de `grano-ducado.md`: Pósito (socorro automático con tope, también la IA) y el decreto de
   reserva; alerta "🌾".

## Dictamen del consejo (2026-09-28) — aceptado por Sergio

Voces: campesino ⚠️, noble ⚠️, mercader ✅, clérigo ⚠️, artesano ⚠️, cronista, consejero.

**El cronista (ancla ~1300 / ~1444, R):** media europea ~1,4-1,45; 1444 es el fondo del pozo casi en todas partes, pero
la horquilla va de 0,7 a 2,5: Inglaterra ~2,4 · Francia ≥1,8 · Aragón-Cataluña ~2 · Noruega ~2,2 · Italia 1,67 ·
Dinamarca 1,6 · Imperio ~1,45 · Países Bajos ~1,3 · Suecia ~1,25 · Castilla ~1,1-1,3 · **Polonia ~0,7 (más gente en
1444 que en 1340)** · Rus, Balcanes, Anatolia, Magreb: sin dato. En las fronteras de colonización el techo no era la
población de 1300; en Egipto el techo cayó (el riego). La historia tardó 100-250 años en volver a K. Fuentes en
`design/epoca/bibliografia.md` (bloque 2026-09-28).

**Decisiones:**
1. ✅ **f(x) como multiplicador en la siega** (`landYield`, economy2.js): 1 hasta x = 0,7; lineal hasta 1/GRAIN_YIELD en
   x = 1; sigue bajando por encima (suelo 0,25). Sin chequeo de hambre nuevo: el hambre la pone el granero de siempre
   (fallos encadenados). No se toca granaryPass, weeklyPrice, contratos ni socorro (la *annona* ya existe: la plaza).
2. ✅ **K regional** (`seedLandCap`/`landCapFactor`, mapgen.js): factor = 1 + α·(R−1), α = 0,6 (la perilla de tensión
   de Sergio), suelo 1,2; fronteras (Castilla-Portugal, Polonia, Rus, Balcanes, Anatolia, Magreb) 1,3 fijo; Egipto
   1,15; montaña −0,1. Se calcula en la carga con la población de 1444 (respeta la edición; no se guarda).
   Arranque: Islas Británicas x≈0,55 · Francia 0,67 · Italia 0,72 · Iberia 0,74 · el resto ~0,77-0,79.
3. ✅ Tooltip del diezmo en Hacienda alineado con el código (del grano, sobre lo vendido).
4. ✅ Fila "🌱 Tierra" en la ficha (ocupación, capacidad, rendimiento; no habla de renta: la renta es del ducado). → `/ux`.
5. ✅ (segunda pasada, tras medir la línea base) La deriva campesino → burgués sube con x > 0,7: la hilandera rural
   (Prato 1390-92). Ojo con `specialistCap` capado por `structPPF`.
6. ⏳ Se mide: ¿el techo de precio ×3 frena la exportación de grano de un reino que roza K? Si no, subirlo solo al grano.
7. ⏳ Decreto de reserva + Pósito: el bloque siguiente. Nace con coste de tensión con la nobleza (modificador de
   `diplomacy.js` hacia dentro), y el golpe al campesino lo da el CAMBIO de reserva, no el nivel. No se presenta como
   institución de 1444. Preparación barata: `GRAIN_RESERVE` → `N.grainReserve`.
8. ⏳ Aparcados: renta solariega fija (con la lealtad de los estamentos), diezmo sobre el bruto (solo si la medición lo
   pide: recalibra el granero), diezmo en tercias, abadengo rural por sorteo, Granja del clero, Granja/tecnologías que
   suben K (con las tecnologías), jornal que se comprime con x.

**La renta se queda sobre lo vendido** (decisión "opción 1" de Sergio, no se reabre): reproduce sola el hundimiento de
las rentas de 1440-80 (el excedente vendible se estrecha antes que la subsistencia cuando x → 1).

**Criterio de aceptación del ritmo:** Inglaterra y Francia no pasan de x = 0,9 antes de ~1540. Si no se cumple, se baja
el crecimiento (hacia el 0,25-0,3%/año de mediados del XV: `foodGrowth`/`POP_GROWTH_BASE`), **nunca K**.

## Medición (2026-09-28, 80 años, sin IA ni guerras)

| | Línea base (sin f(x)) | α = 0,6 | α = 0,5 |
|---|---|---|---|
| Población 1444 → 1524 | 62 M → **90 M** (+0,45%/año) | → **67,6 M** (+0,1%/año) | → 66,3 M |
| x en 1524 | 1,1-1,3 en todas partes (menos Islas 0,87) | 0,77-0,93 | 0,77-0,93 |
| Muertos de hambre, última década | ~0,5 M | **~4,8 M (~0,7%/año)** | ~4,9 M |
| Grano ×ref | pegado al suelo ×0,5-0,6 | sube a ×0,8-1,0 | igual |
| Criterio (Ingl./Francia < 0,9 hasta ~1540) | falla | Ingl. 0,84 ✅ · Francia 0,93 en 1504 ❌ por poco | peor |

**Lectura:** el techo muerde y α casi no cambia nada (0,6 basta). Pero **muerde matando, no frenando la natalidad**:
x se estanca en 0,8-0,95 y la población se regula a golpe de hambruna (Italia no crece; Países Bajos-Alemania, Anatolia
y Egipto encogen). Con x alto el margen de la cosecha es fino, el granero vende lo que pasa de 1,2× y el primer mal año
mata. La renta del señorío no hace el Slump (plana). El grano toca el techo ×3 a menudo en Anatolia y PB-Alemania.

**Propuesta (sin decidir con Sergio):** freno PREVENTIVO — la natalidad cae con x (boda tardía, patrón de Hajnal):
`foodGrowth × g(x)`, g = 1 hasta 0,7 y ~0 en x = 1. Luego la válvula del artesano (decisión 5) y volver a medir.

## Segunda ronda (2026-09-28): el techo se desplaza (árbol tecnológico futuro)

Decisión de Sergio: habrá un árbol tecnológico que suba el rendimiento y abra tierras nuevas; el reino que no desplace el
techo acabará con más gente de la que sostiene → hambrunas. Implementado:
- `landCap(p)` = p.K (tierra de 1444) × `N.agro` (tecnologías, futuro) × obras de la provincia (futuro). La siega
  (`landYield`) y la fila Tierra leen la capacidad efectiva.
- **Freno preventivo PARCIAL** `landBirth(p)`: la natalidad cae con x (boda tardía, patrón de Hajnal); vale 1 hasta
  LAND_FULL y `LAND_BIRTH_AT_K` en x = 1 (no 0: la población sigue empujando contra el techo).
- Medición: ADELANTADOS (Inglaterra, Francia, Borgoña, Brabante, Flandes, Holanda: N.agro ×1,1 cada 20 años) frente a
  ATRASADOS (el resto).

| 1444-1524 | A: freno ×0,4 | B: A + POP_GROWTH_BASE 0,006 |
|---|---|---|
| Adelantados | +0,5%/año, hambre ~0 | **+0,4%/año**, hambre 0 |
| Atrasados hasta ~1500 | +0,1-0,3%/año | +0,05-0,24%/año |
| Atrasados 1504-1524 | −0,2%/año, hambre ~0,5%/año | −0,2%/año, hambre ~0,4%/año |

La divergencia sale (el diseño funciona) y B acierta el ritmo, pero: (1) los atrasados pasan hambre ya en 1444-64
(~0,25%/año) porque arrancan en x ≈ 0,77-0,80, dentro de la banda decreciente; (2) el techo real queda en x ≈ 0,85, y al
final encogen en vez de vivir pegados al techo. **Siguiente (variante C):** B + LAND_FULL 0,8 + LAND_BIRTH_AT_K 0,2.
Las simulaciones largas se lanzan en GitHub Actions (`.github/workflows/simulacion.yml`, variantes en
`tools/sim-variants.json`).

## Tercera ronda (2026-10-26, GitHub Actions, run 40240492552) — CALIBRACIÓN ADOPTADA: D

| Atrasados | B (control) | C: B + LAND_FULL 0,8 + freno ×0,2 | **D: B + LAND_FULL 0,8** |
|---|---|---|---|
| Hambre 1444-1464 | 0,24%/año | 0,13-0,14% | 0,13-0,15% |
| Crecimiento hasta ~1494 | 0,04-0,24% | ~0,25% | **~0,25%** |
| x máxima | 0,86 | 0,90 | 0,89 |
| Peor década (1514) | −0,22%/año, hambre 0,45% | −0,16%, 0,38% | −0,15%, 0,39% |
| Población 1524 | 66,1 M | 69,1 M | 69,3 M |

Adelantados en las tres: +0,4%/año, hambre ~0. B reproduce exactamente la medición local (el arnés de GitHub es fiable).

**Lectura:** el umbral 0,8 es lo que arregla el arranque; el freno ×0,2 no aporta (C ≈ D): el hambre llega en x ≈ 0,88
(hace falta margen para el mal año), antes de que el freno muerda. La caída final coincide con la peor racha de la
secuencia FIJA de cosechas (`harvestYear`: 1504-1523, 8 años malos de 20; 1444-1453 también arranca mal), la misma en
todas las partidas: en esos años los adelantados no pasan hambre. **Es el diseño: el mismo mal tiempo mata al atrasado.**

**Adoptado (D):** `LAND_FULL` 0,8 · `POP_GROWTH_BASE` 0,006 · freno de natalidad ×0,4 en x = 1. Siguiente: válvula del
artesano (decisión 5, medida con /simular) y `/ux` de la fila Tierra.
