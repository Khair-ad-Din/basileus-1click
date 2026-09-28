# Capacidad agraria: la tierra pone el techo a la población

> Estado: **PROPUESTA** (2026-09-28), pendiente de `/consejo` + medición + implementación en una sesión nueva.
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
   - x = 1: en un año normal, al campesino le queda tras la renta y el diezmo justo lo que come;
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
