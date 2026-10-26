# La economía, visible: plan de interfaz

> `/ux --planear` del 2026-10-26 (director de UX, con capturas reales de Castilla en el día 61). Aceptado por Sergio:
> diseño **B** y plan por fases. Referencia de lo que hay que hacer visible: el esquema "Anatomía económica del reino"
> (artefacto https://claude.ai/artifact/9Kpo16vfeWFi62Dr48Qr6f), que recorre `economyTick2` fase a fase.

## El problema

El jugador ve **cuánto** entra en cada bolsa (Tesorería, ficha de provincia, Estamentos), pero no **por qué** ni **qué
viene después**. Ejemplos de las capturas: el precio sube y no se sabe cuánto subirá; el campesinado de Castilla pierde
144.624 al mes y la columna que lo avisaría queda tras una barra de scroll; "281.878 sin comprador" no dice si es
dinero, grano o basura. Contratos, ascensos, nacimientos, muertes e inversiones no salen en ninguna parte.

## Diseño elegido: B = tooltips EU4 + la ficha del bien de Victoria 3

- **Tooltips (A):** ningún número sin desglose. Cada cifra en pantalla suma sus partes con `tipRows`.
- **Ficha del bien (`renderMktGood2`) como centro de la economía:** oferta y demanda como barras por tipo y en orden de
  compra (hover: pide / consigue), destino del sobrante (vendido / ← granero / ✗ perdido / podrido), contratos con
  escudos (atenuado = cortado por guerra o embargo), historial de 12 semanas. Sin ventanas nuevas.
- Descartado **C** (pestaña "Reino" en Tesorería): repetiría lo que ya cuentan Tesorería y Estamentos. De C solo se
  rescata la Tierra, como chip en la leyenda de Graneros.

## Inventario de brechas (resumen)

| Pieza | Hoy | Falta | Dato |
|---|---|---|---|
| Siega y tierra | Filas Granero y Tierra | Próxima siega en unidades; vista del reino; "Produce" sin grano 11 meses | Calculable; última cosecha sin guardar |
| Granero y reserva | Fila Granero, mapa | Reserva como cifra; vendido este mes; grano devuelto | Ventas por provincia sin apuntar |
| Precio semanal | Precio y flecha | Por qué; la semana que viene; historial | Calculable (`weeklyPrice`); historial sin guardar |
| Plaza, merma, tirado | "Sin comprador" | Grano vuelve vs resto se pierde; merma por reino | Merma solo mundial (`S.e2L`) |
| Reparto de cada venta | Barra por cobrador | Reparto por bien; comisión y alcabala; **flete = código muerto** (`m.lost` nunca sube) | Calculable: `saleSplit(p,g)` |
| Orden de compras | Nada | Pedido vs conseguido por estamento | Lo pedido sin apuntar |
| Prosperidad, ascensos, válvula | Nada | Todo | Ascensos sin apuntar |
| Hambre y natalidad | Dos líneas sueltas | Crecimiento sumado; muertos; nacidos | Sin apuntar |
| Contratos exteriores | Totales, ↗/↙ | Socios, cantidad, margen, cortes | `N.e2.ctr`; cortes sin apuntar |
| Decisiones de estamentos | 5 últimos cierres | Cierres por pérdidas, reaperturas, inversiones | `budLog` incompleto |
| Tesorería día 1 | Vacía | Previsión del mes | Libro del día ×30 |

## Plan por fases

- **Fase 0 — defectos (en curso):** ensanchar Estamentos y flecha de tendencia del ahorro; flete como segmento propio
  (el `m.lost` muerto); `budLog` completo (cierra por pérdidas, reabre, invierte) con icono y porqué; "sin comprador"
  → "← granero" / "✗ perdido"; desglose EU4 en la barra superior.
- **Fase 1 — planificar con tooltips:** crecimiento de población sumado; `saleSplit(p,g)` en Produce y la barra de
  cobradores; `priceWhy(N,g)` con el precio de la semana que viene; sliders de Hacienda con su efecto; cobertura por bien.
- **Fase 2 — la ficha del bien:** registrar lo pedido (`recWant`), oferta por tipo, merma por reino, cortes de
  contratos; rehacer `renderMktGood2`; socios en la celda Exterior; iconos de estamento en vez de texto.
- **Fase 3 — historia y demografía:** anillo de 12 semanas de precio (sparkline); muertos, nacidos y ascensos en el
  libro de provincia; Tesorería del día 1 como previsión.
- **Fase 4 — mapa:** chip "Tierra" en la leyenda de Graneros. Dinero creado/destruido: como mucho un tooltip.
