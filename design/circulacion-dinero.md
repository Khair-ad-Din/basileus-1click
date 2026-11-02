# La circulación del dinero: gasto de la corona e inversión de los estamentos

Consejo de 2026-11-02 (cinco estamentos + cronista + consejero). Material completo (dossier, veredictos, cronista) en
el scratchpad de la sesión 30fb8ae8 (no versionado); las fuentes nuevas, en `design/epoca/bibliografia.md` (pasada de
verificación del 2026-11-02). Aquí queda lo decidido. **PENDIENTE de aprobación de Sergio.**

## Lo medido (juego real, 1 año, 189 reinos IA, tras el tope de obras de la corona `8a5e123`)
- La corona se queda el 10-11% de la renta total: los impuestos NO son excesivos. Pero gasta solo el 41-65% de lo que
  ingresa y acumula ~8 meses de ingreso al año.
- Los estamentos casi no invierten: exigen 12 meses de cesta ahorrados (INVEST_MONTHS) y tienen 4-5. En un año, nobleza y
  clero 0 niveles; burgueses 20.
- Hallazgo del consejero: los "23 meses de ahorro" campesino son una incoherencia de unidades. `seedWealth2` siembra 6
  meses de la cesta CON grano; `N.e2.basket` del campesino es SIN grano. Con 23 meses, WEALTH_BOOST le hace pedir
  ~×2,8 de vida y lujo: eso explica que compre 530k e ingrese 347k.

## Dictamen (en orden de implementación)
0. **Siembra** (✅): `seedWealth2` en las mismas unidades que `N.e2.basket` (sin grano para el campesino). Métrica buena:
   saldo de caja campesino en régimen (años 3-10) contra la cesta BASE, no la riqueza total.
1. **Presupuesto de la corona + mercedes** (✅, la principal): reserva R = 3 meses de ingreso (6 en guerra o tensión alta
   con un rival). Sobre R: ejército → obras → MERCEDES = 1/6 al mes de lo que quede por encima de R, a nobleza y clero en
   proporción a lo que ya cobran en rentas (renta del señorío + diezmo; perilla de diseño, sin fuente), y a las
   provincias por sus pops (pmPay). También para la corona del jugador por defecto, sin mando. Fila "Mercedes" en
   Tesorería y Estamentos. Requiere la IA de la corona en verify-v2 para medirla.
2. **Inversión de los estamentos** (✅): INVEST_MONTHS 12 → 4 (OBRA_KEEP 0,5 igual); WEALTH_BOOST 2 → 1 (arranque en 12
   meses). Escalona reserva → inversión → lujo sin regla nueva. La producción crece si crece la demanda (needMore): la
   decisión 1 es la que la mueve; la 2 quita el freno.
3. **Comisión 10%** (⏳ medir): sin fuente para ningún nivel; interactúa con la inversión burguesa. Cuando se toque, por
   escalón del bien (TIER_OF) o por distancia (transport).
4. **Diezmo dividido** (tercias 2/9, fábrica 1/9; verificado para Sevilla) (⏳): hoy engordaría el tesoro que no se gasta.
5. **Corte y casa real** (⏳): las mercedes ya llevan el dinero a la demanda de lujo noble; no medibles por separado.
Descartados: deuda/juros como deuda (anacrónico en 1444: el juro de heredad es merced); exención de alcabala del diezmo
(sin fuente para 1444); destajo textil (ya existe JORNAL=0.20); umbral de rentabilidad del 10% (sin fuente); repertorio
campesino (otro bloque).
Notas del cronista para no repetir: ninguna proporción del gasto de una corona de 1440-60 tiene fuente (el "situado"
≥30% de los ingresos ordinarios es de 1483); los reyes sí atesoraban, en joyas y plata labrada (Enrique IV, Segovia);
el 81,9% de costes de comercialización es de lana Londres-Venecia; minas: regalía con un tercio para los terratenientes
en Hungría y del príncipe territorial en el Imperio.

## Variantes para /simular (10 años)
ctrl-actual · siembra · inv4/inv3/inv6 · wb1/wb0.5 (con inv4) · presup3/presup6 y presup3-obras6 (con IA de la corona
en el arnés) · margin05. Siempre invariante y NaN.

## Aparcado al consejo de lealtad
Lealtad noble (sube con mercedes, baja con atrasos y presión fiscal; leva que no acude, motín, sublevación) · mercedes
por menor lealtad · pirámide noble (pops^k, peso regional) · lealtad o migración campesina por extracción sin retorno ·
mercedes como mando del jugador. Se retoma con la regla de presupuesto medida y estable.
