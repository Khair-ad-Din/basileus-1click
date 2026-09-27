# Economía v2 — "una sola regla"

> Estado: **ÚNICA ECONOMÍA DEL JUEGO** (implementada 2026-09-25; la v1 se borró el 2026-09-27): `call-of-war/js/economy2.js`.
> Pasado por /consejo (§10). Decisiones de implementación y primera calibración en §11. Pendiente de /ux.
> Sustituye a la economía actual (`economy.js`, `economyTick`) por un módulo nuevo `economy2.js` en paralelo,
> tras un interruptor. v1 se borra cuando v2 se juegue mejor.

## Por qué

La v1 acumuló 5 capas históricas: 6 grifos de dinero, 3 fugas donde el dinero desaparece sin contraparte
(ventas de materia prima que no cobra nadie, déficit de básicos pagando solo el margen, arbitraje que crea el
diferencial), producción de la corona contada dos veces, 37 bienes, dos filtros de distancia solapados
(acceso + flete), sobreconsumo con elasticidades por bien, precio por llenado de stock con EMA y techo por
disposición a pagar. **No se puede calibrar ni explicar al jugador.**

Se conserva el ESPÍRITU: la provincia es la verdad (ADR 0001), el campesino es el grifo único, los estamentos
extraen de él (reparto feudal), hay cadenas de producción, y el comercio va entre centros con coste de transporte.

## La regla

> **El dinero solo nace cuando alguien vende un bien. Cada ducado que se paga lo cobra alguien.**

Invariante comprobable por el arnés cada tick:
`Δ(dinero total) = ventas del campo al mercado − transporte − consumo del Estado (obras, ejército)`.
Sin excepciones. No hay sueldos planos, ni monetización abstracta, ni arbitraje que imprima dinero.

## 1. Bienes (37 → 17)

| Grupo | Bien | Lo produce | Lo consume |
|---|---|---|---|
| Subsistencia | **Grano** | campesino (todas) | todos (el campesino, de su despensa) |
| Subsistencia | **Sal** | campesino (costa/salinas) | todos |
| Subsistencia | **Lienzo** (ropa basta) | campesino (hilado doméstico) | todos |
| Vida diaria | **Carne** | campesino (pastos) | todos; los ricos más |
| Vida diaria | **Pescado** | campesino (costa) | todos; los ricos más |
| Vida diaria | **Bebida** (vino en el Sur / cerveza en el Norte, un solo bien) | campesino + bodega/cervecería | todos |
| Vida diaria | **Paño** | taller ← **Lana** | todos; los ricos más |
| Vida diaria | **Herramientas** | herrería ← **Hierro** | campesino (y mantenimiento de talleres) |
| Lujo | **Seda** | campesino (zonas sederas) + sedería | clero, nobleza |
| Lujo | **Especias** (incl. azúcar) | importación (Levante) | burgués, clero, nobleza |
| Lujo | **Pieles** (incl. ámbar) | campesino (Norte) | clero, nobleza |
| Materias | **Lana** | campesino (pastos) | taller de paño |
| Materias | **Hierro** (en barra, con el carbón vegetal dentro) | campesino (6 zonas mineras, **solo con mineral + bosque**) | herrería, armería, obras |
| Materiales | **Madera** | campesino (bosque) | obras, astilleros |
| Materiales | **Piedra** | campesino (relieve) | obras |
| Militar | **Caballos** | campesino (llanuras/dehesas) | ejército, nobleza |
| Militar | **Armas** | armería ← **Hierro** | ejército, nobleza |

**3 cadenas** (las que el jugador tiene que entender): Lana→Paño · Hierro→Herramientas · Hierro→Armas.
Fuera: alumbre, estaño, cobre, bronce, acero, carbón, hulla, tinte, uva, aceituna/aceite, caña, algodón/fustán,
cuero, cera, vidrio, cerámica, papel (se funden en el bien de arriba o salen). El ámbar se funde en Pieles; la cera
sale (gasto de fondo del clero). **Tinte = candidato a bien 18** (aplazado, §10).
Cada bien lleva su categoría de `TRADE_BULK` (§7): así grano y piedra se quedan locales por su peso, sin caso especial.

## 2. Producción — una fórmula

```
producción del bien = campesinos × RENDIMIENTO(terreno, bien) × moral × cosecha   (+ edificios)
edificio:  nivel × 1 unidad/mes × moral   (fábrica: × min(1, insumo conseguido / insumo pedido))
```
Sin afinidad, sin dotación fraccionaria, sin multiplicadores del reino (o agrupados en UN "rendimiento" con desglose).

## 3. Consumo — tres necesidades por estamento

Cada estamento tiene una cesta en 3 escalones. Cobertura = conseguido / pedido, por escalón.

| Escalón | Si se cubre | Si falta |
|---|---|---|
| Subsistencia | — | hambre → muertes (grano) / descontento (sal, lienzo) |
| Vida diaria | crecimiento de población + ascenso campesino→burgués | sin crecimiento |
| Lujo (solo élites) | estamento leal | estamento descontento |

Los ricos piden más de Vida diaria y Lujo (un multiplicador por estamento, fijo: campesino 1, burgués 2,
clero 3, nobleza 4). Fuera: sobreconsumo por riqueza, elasticidades por bien, prosperidad por bien con puntos.

## 4. Precio — una fórmula legible

```
precio = referencia × (demanda / oferta)     acotado a [×0,5 ; ×3]
```
Oferta = lo producido + importado este mes (+ poco stock). Si falta, compra primero quien más paga
(nobleza → clero → burgués → fábricas → campesino). UI: "Oferta 120 · Demanda 150 → ×1,25".

## 5. Dinero — quién cobra

```
Campesino vende su excedente en la plaza  (precio × cantidad = VALOR)
   ├─ diezmo 10% ───────────────► clero
   ├─ renta del señorío 20-28% ─► nobleza (solariego) · clero (abadengo) · corona (realengo)
   ├─ pecho/impuesto 8% ────────► corona
   └─ resto ────────────────────► campesino  (con eso compra su cesta)

Taller vende paño (VALOR):
   ├─ insumo (lana) ────────────► campesino que la vendió
   ├─ JORNAL 20% del valor ─────► campesinos de la provincia (hilado/tejido a destajo)
   └─ resto ────────────────────► burgués (beneficio)
Alcabala 8% sobre toda venta ──► corona
```
Todo comprador PAGA y todo vendedor COBRA. El único dinero "nuevo" es el valor de lo que el campo vende.

## 6. Transporte y comercio — una sola distancia

- **Coste de transporte** de cada provincia a su centro de comercio (`hubKm`, con orografía): un % del valor,
  mayor para bienes pesados y baratos (grano, piedra) que para ligeros y caros (seda, especias).
  Sustituye a acceso + flete. El campesino cobra el precio del centro MENOS el transporte. El 15% del transporte
  es portazgo del señor local; el resto se pierde (el único sumidero del comercio).
- **Entre centros**: se comercia si `precio destino − precio origen > transporte + aduana`.
  El comprador paga, el vendedor cobra, el mercader (burgués) se queda la diferencia menos el almojarifazgo 5%.
- El transporte entre centros usa la fórmula YA CALIBRADA de v1 (`tradeCost`): km × peso por categoría ÷ precio,
  **× 0,68 si ambos centros son costeros**, **× 3 si los reinos están en guerra**, **∞ (par cortado) si hay embargo**.

## 7. Números

- Rates por persona y año; la UI muestra /mes. **1 unidad = lo que come UNA persona en UN año** (cambiado al implementar:
  con "1.000 personas/mes" todo el dinero salía ~100× menor que los costes de edificios/tropas de la v1).
- Grano = 1 × `PRICE_SCALE` (=8). Precios de referencia 1-30 × `PRICE_SCALE`: la palanca iguala el dinero del comercio
  a la escala de costes heredada (mantenimiento, obras).
- Todo tunable en UN bloque de constantes al principio de `economy2.js`.
- `taxRateOf` (pecho) sigue siendo la palanca del jugador; 8% es el valor por defecto.

### Constantes heredadas de v1 (se PORTAN literalmente, no se reinventan)

| Constante | Valor | Origen | Qué fija |
|---|---|---|---|
| `TRADE_KM` | 5.35e-4 | economy.js:344 | grano a 1.100 km = 50% del valor |
| `TRADE_SEA` | 0.68 | economy.js:345 | mar ~1,5× más barato (Brujas→Barcelona 1398), solo entre centros |
| `TRADE_BULK` | por categoría | economy.js:352 | peso físico por unidad (grano 1, sal 2,1, manufactura 0,6…) |
| `TRADE_WAR` / embargo | ×3 / ∞ | economy.js:356, :390 | el riesgo era político, no meteorológico |
| acopio terrestre | `provFlete` | economy.js:491 | = el "transporte a tu centro" de §6 (tope 85%, 15% portazgo) |
| `MANOR_RENT` | realengo 0.10 · abadengo 0.22 · solariego 0.28 | economy.js:445 | renta del señorío (proporcional, sin verificar como fracción: perilla) |
| `DIEZMO` | 0.10 → 100% clero | economy.js:440 | |
| despensa | 0,7 años (× Almacén) | economy.js:125 | colchón anti-hambruna |
| `FAMINE_DEF` / `STARVE_RATE` | 0.12 / 0.6 | economy.js:525-526 | hambruna por déficit ACUMULADO de la despensa, no por un mes suelto |

Nueva: `JORNAL=0.20` (fracción de la venta de TODO taller que va a los campesinos de su provincia).

## 8. Lo que ve el jugador (a pasar por /ux)

- **Provincia**: produce X, vende Y; barra de a dónde va el dinero (clero/señor/corona/campesino).
- **Estamento**: 3 semáforos (Subsistencia / Vida diaria / Lujo) + su efecto.
- **Mercado**: por bien, oferta · demanda · precio · de dónde viene.

## 9. Plan de trabajo

1. /consejo sobre este borrador → decisiones.
2. /ux sobre las 3 pantallas.
3. `economy2.js` + interruptor + arnés con el invariante de la regla.
4. Calibración con `diag-paises` adaptado. **Objetivos medibles** (el arnés los comprueba):
   - fracción vendida / producida del campesino en **20-35%** (Dyer; ya no es perilla, es emergente);
   - **neto del campesino** tras diezmo + renta + pecho + transporte, por bien, en rango (lo decide la renta, no el
     flete: el transporte local es ~3-7% con radio de venta 16-32 km, cronista);
   - ⚠ el grano llena la despensa ANTES de ir al mercado: los primeros meses no se vende nada y no es un fallo.
5. Borrar v1.

## 10. Dictamen del consejo (2026-09-25)

Criterio rector: **simplicidad**. 5/5 estamentos ⚠️, ninguno ❌, ningún mando 🔴 propuesto.

**Entra en v2:** (1) portar literalmente lo calibrado de v1 (tabla §7) · (2) guerra ×3 / embargo explícitos en §6 ·
(3) `JORNAL=0.20` en todo taller (destajo rural, Lovaina 1434 ~20%) · (4) Hierro solo donde hay mineral + bosque
(Byrkeknott 1408: carbón ~45% del coste de la barra) · (5) objetivos de calibración en §9.

**Aplazado (con condición):**
| Qué | Pide | Se retoma cuando |
|---|---|---|
| Renta FIJA en dinero (Noroeste) + deriva `RENT_DRIFT` (Great Slump) | campesino, noble | tras la 1ª calibración estática, con una variable regional Noroeste/Mediterráneo sembrada (la renta fija NO es el caso general europeo: en el Sur champart ≤25%, mezzadria 50% — cronista) |
| Tercias reales (22% del diezmo a la corona) | clérigo | cuando haya fiscalidad por reino (dato castellano) |
| Mezcla de señorío / señorío noble urbano | clérigo, noble | si `diag-paises` deja al clero o al noble fuera de rango |
| Tinte (Paño ← lana + tinte) | artesano | si el comercio entre centros sale plano (2ª ola de bienes); alumbre fuera |
| Fricción con la nobleza al subir el pecho | noble | bloque "estamentos que dicen no", tras borrar v1 |
| Estratificación campesina; oro/plata y deflación | campesino, mercader | tras v2 estable |

**Descartado:** fundir la cera en Pieles (ahora Pieles incl. ámbar; la cera sale).
**Confirmado:** burgués único (no partir), sin progreso técnico del telar, constantes en un bloque, metálico de venta real.

## 11. Implementación (2026-09-25)

Código: `call-of-war/js/economy2.js` (motor; `economy.js` conserva lo compartido: despensa, tasas, libros de cuentas)
· enganche en `sim.js` (tick, siembra) y `estates.js` (IA de obras de estamentos y corona) · arnés `tools/verify-v2.mjs`
(invariante del dinero + libros de cuentas) y `tools/e2e-v2.mjs` (juego real en Chrome). Las partidas guardadas con la v1
ya no se cargan.

**Cambios del 2026-09-27 (decisiones de Sergio):** la **Granja** es la explotación de su dueño (produce grano para él,
BLD2; ya no multiplica el grano del campesino). La **corona** guarda en su almacén lo de sus talleres de madera, piedra,
hierro, grano y caballos, y su IA elige obras con la misma lógica que los estamentos (`pickCrownBuild`): lo del almacén
vale su precio solo mientras le haga falta (`CROWN_STOCK_WANT`). Los **centros de comercio** se calculan en el tick
(antes solo al abrir la vista de mapa: flete y portazgo eran 0 en partida).

**Cómo se cumple la regla — la PLAZA.** Cada reino tiene una plaza (`N.e2.plaza`) que paga al productor cuando entrega
y cobra al consumidor cuando compra. Su saldo acumulado ES el dinero creado por el comercio. Grifos/sumideros
explícitos contados en `S.e2L`: minas de plata/oro (acuñación, la única excepción), mantenimiento en dinero, flete
entre reinos, y "rescates" (un estamento que no puede pagar su mantenimiento queda a 0). El arnés comprueba
`Σ tesoros + Σ estamentos + Σ plazas + sumideros − grifos = constante` → error relativo ~1e-12.

**Decisiones tomadas al implementar (no estaban en el borrador):**
1. **El burgués es ARTESANO**: cada burgués produce `ARTISAN_VALUE` de manufacturas (lienzo/paño/herramientas), compra
   su materia prima en la plaza y paga el jornal. Sin esto no tenía ingresos (la v1 le daba un sueldo de la nada).
2. **Talleres sembrados a su dueño histórico** (`SEED_OWNER2`): telar/sedería/especiería → burgués; salina/yeguada/
   majada/mina → nobleza; viñedo → clero; minas de plata/oro → corona. Con todos de la corona, ésta era 5× más rica
   que en la v1 y burgueses/nobles no tenían oficio.
3. **La corona abastece su almacén** con sus propios edificios de madera/piedra/hierro/grano/caballos (unidades v1,
   para obras y tropas); lo demás que produzca, lo vende.
4. **Mantenimiento en BIENES solo para la corona** (son unidades internas de la v1); un estamento paga solo el dinero.
5. **`goldAdd` (mercado, lonja, puerto, gremio) no crea dinero** en v2 → hoy esos edificios no rinden. PENDIENTE darles
   un efecto (p. ej. subir la comisión de la plaza o bajar el transporte).
6. **Grano**: el campesino vende su excedente en cuanto la despensa pasa de la mitad (`STORE_KEEP`), no al llenarse.
7. **Comercio exterior**: el mercader solo lleva mercancía a un reino que se quedó sin ella teniendo dinero para
   pagarla, y solo desde uno al que le sobra. Sin eso la mercancía rebotaba entre plazas cobrando margen.
8. Los talleres compran sus insumos ANTES del consumo de las élites (capital de trabajo).
9. La corona no compra en la plaza (seda/paño/sal de las obras únicas siguen saliendo de su almacén). PENDIENTE.

**Primera calibración (arnés, 3 años, sin IA de obras):** vendido/producido del campesino **27%** ✅ (objetivo 20-35%) ·
neto del campesino **0,40** por ducado vendido · subsistencia ~100% en todos · vida diaria del campesino 60-95% · lujo
de la nobleza 36-74% en la mayoría · precios casi todos entre ×1 y ×2 de la referencia; los lujos en el techo (escasos).
Rendimiento: 90 días de partida real en el navegador **191 s con v2 vs 311 s con v1**.

**Pendiente de calibración:** corona ~2,5× más rica que en v1 · nobleza en quiebra en Lituania/Moscovia (heredado de
la v1: el cuartel sembrado en cada provincia rural cuesta más que su renta) · armas y lujos escasos hasta que la IA
construya · la interfaz (Tesorería/Mercado) sigue mostrando conceptos de la v1 → /ux.

## 12. Gestión de edificios, siembra y geografía (2026-09-26/27)

**Nadie quiebra por mantener lo que no puede pagar** (petición de Sergio). `estates.js` (IA de obras movida desde sim.js,
sin DOM, la usa el arnés) + `budgetManage`: cada dueño (estamentos y corona IA; la del jugador, él) compara cada día su
**ingreso mensual** con su **subsistencia + mantenimiento**. Si no le llega (y su caja baja de 3 meses de mantenimiento),
**cierra** lo que menos le rinde; lo cerrado se degrada y se demuele en ~4 años. Si le sobra holgado, reabre. La vida
diaria y el lujo no cuentan: se ajustan solos. Reglas de apoyo: el consumo respeta una reserva de mantenimiento (salvo la
subsistencia); se invierte solo tras asegurar un año de cesta; un servicio sin ingreso solo se construye si se puede
mantener; la IA mira la oferta TOTAL del bien antes de levantar otro taller.

**Mantenimiento de los servicios ∝ población servida** (`upkeepScale`, referencia 100.000 hab.): el tamaño de las
provincias del mapa ya no decide la fuerza de un reino (Moscovia: 328 provincias de ~3.600 hab. pagaba 7× más cuarteles
por habitante que Castilla y se quedaba con 4). Ahora sostiene su leva en proporción a su gente.

**Siembra de arranque** (deducida del equilibrio simulado con `tools/seed-rules.mjs`, aprobada por Sergio):
cuartel de la nobleza en toda provincia RURAL ≥ 2.000 hab. · templo del clero en toda CIUDAD ≥ 20.000 hab. · talleres del
resType a su dueño histórico · sin mercado (en v2 no rinde).

**Diezmo y renta EN ESPECIE sobre toda la cosecha** (opción 1 de Sergio): 10% al clero, renta del señorío al señor
(solariego 28% nobleza · abadengo 22% clero · realengo 10% corona); lo venden en la plaza; lo que no encuentra comprador
se queda en la aldea. El campesino solo paga el pecho sobre lo que vende de su parte (le quedan ~0,68 por ducado).
Rendimiento del grano 1,55 para que coma tras entregar su parte.

**Burgués**: artesano que reparte su oficio según el precio; si no gana para vivir, parte vuelve al campo (<50% de vida
diaria). Ciudades pañeras → paño; centros armeros → armas.

**Geografía de recursos** (verificada por el cronista, fuentes en su informe): sal marina solo al sur de 47°N; minas de
sal de roca/salmuera y grandes salinas (Wieliczka, Lüneburg, Salzkammergut, Bourgneuf…) → el Norte IMPORTA sal; pesca
costera baja y zonas pesqueras (Escania, Holanda, Bergen, Islandia, almadrabas, Azov); especias SOLO entran por Alejandría y
Beirut-Damasco; seda en Italia, Granada, Levante; caballos en Andalucía, Apulia, Frisia, Hungría y la estepa; hierro poco
en todas partes y ×8 en 9 zonas (+Elba, Siegerland, Samokov); Egipto y el Magreb casi sin madera ni hierro; el islam apenas
bebe; armas solo en sus centros (Milán-Brescia, Núremberg, Augsburgo, Passau, Colonia, Toledo, Vizcaya); pieles en el Norte
y el Este (correcto). Un taller fuera del sitio de su materia no produce. Informe: `verify-v2.mjs --regiones`.

**Resultado (6 años, IA de obras real):** dinero cuadra (~1e-12) · sin quiebras · 192 cierres en 6 años · población +1%/año
· los cuatro estamentos cubren subsistencia y vida diaria en casi todos los reinos, lujo 20-60% · sal mundial 1,0 con el
Norte importador · navegador: 0 errores JS, 2,6 s/día de juego (v1: 3,5).

**Pendiente:** grano muy sobrado (la renta en especie que no se vende vuelve a la aldea — intencionado, pero conviene que la
IU lo explique) · burgueses de Francia y Venecia justos · seda y especias escasas (lujo) · /ux de las 3 pantallas.

## 13. La v2 explicada al jugador (base para /ux)

Una regla: **el dinero nace cuando alguien vende a la plaza, y cada ducado que se paga lo cobra alguien.**

- **Quién produce:** el campesino (grano —del que come primero—, algo de madera/hierro/carne/lienzo y la especialidad de
  su provincia); el burgués-artesano (lienzo, paño, herramientas; armas en los centros armeros), que compra lana y hierro
  en la plaza; los talleres (edificios) de un dueño: burgués, noble, clero o corona.
- **De cada cosecha:** 10% de diezmo al clero y la renta a su señor (noble 28% · abadengo 22% · realengo 10%), en especie;
  cada uno lo vende en la plaza (lo que no se vende se queda en la aldea). De lo que el campesino vende de su parte paga
  el pecho (8%) a la corona. De cada compra en la plaza: 10% comisión al burgués y 8% alcabala a la corona. Transporte al
  centro de comercio (más lejos, más se pierde). Taller: 20% de jornal a los campesinos, el resto a su dueño.
- **Tres necesidades por estamento:** 🍞 Subsistencia (grano, sal, lienzo; si falta grano → hambre) · 🏠 Vida diaria (carne,
  pescado, bebida, paño, herramientas, madera, piedra; cubierta → la población crece y el campesino asciende a burgués) ·
  👑 Lujo, solo élites (seda, especias, pieles, caballos, armas; efecto de lealtad aún NO enganchado). Quien ahorra más de
  un año de cesta pide más vida y lujo (hasta ×3).
- **Precio** = precio normal × demanda ÷ oferta, entre ×0,5 y ×3. **Entre reinos:** el mercader lleva lo que le SOBRA a uno
  a otro al que le FALTA y puede pagarlo, si la diferencia cubre el viaje (guerra ×3, embargo lo corta; aduana a la corona).
- **Edificios:** cada dueño cierra lo que no puede pagar con su ingreso (se degrada y se demuele) y reabre si le sobra.
