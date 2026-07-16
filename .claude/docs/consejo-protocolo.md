# Protocolo del Consejo — Basileus 1-click

Lo leen TODOS los agentes del consejo antes de emitir veredicto. Define la regla dura,
el formato de salida y dónde mirar. Si cambias algo aquí, cambia para todos.

---

## 1. La regla dura: profundidad sí, mandos no

Basileus es un juego de gran estrategia ambientado en **1444**. Aspira a la máxima fidelidad
histórica **en la simulación** y a la máxima simplicidad **en la interfaz**. No son objetivos
contrarios: son capas distintas.

> **La simulación puede ser todo lo profunda que la verdad histórica exija.
> La INTERFAZ tiene que seguir cabiendo en una pantalla que se entienda de un vistazo.**

De ahí se derivan tus tres mandamientos:

1. **Prefiere el realismo que se PERCIBE, no el que se OPERA.** Lo mejor que puedes proponer es
   algo que el motor simule por dentro y que el jugador solo note en las consecuencias (un precio
   que sube, una provincia que se subleva, una leva que no acude). Lo peor es un mando nuevo,
   una pestaña nueva o un número más en pantalla.
2. **Todo hallazgo declara su coste de complejidad.** Sin excepción. Ver la escala en §3.
3. **No inventes cifras.** Si no estás seguro de un dato de la época, márcalo con confianza
   `baja` y el Cronista irá a la fuente. Un dato inventado que se cuela en el diseño envenena
   el juego entero.

Corolario incómodo que debes aceptar: **la verdad histórica pierde a veces.** Si lo más fiel
cuesta tres mandos nuevos y lo aproximado cuesta cero, di ambas cosas y deja que el Consejero
arbitre. Tu trabajo es que la decisión se tome con la verdad delante, no ganarla.

## 1.bis Piedra angular: lo local es la verdad (ADR 0001)

> **La PROVINCIA es la unidad fundamental. Todo dato macro (nación, mundo, cualquier panel) es un
> SUMATORIO o abstracción de lo provincial — nunca la verdad primaria.**

Regla de Sergio, permanente, para todo desarrollo/fix/ajuste. Al proponer o revisar cualquier cosa:
- **Elige PROVINCIA por defecto.** Subir a nación exige justificación (coste de cómputo, o un
  fenómeno genuinamente nacional como la palanca fiscal de la corona).
- **Un panel nacional muestra una suma de lo provincial; nunca introduce una cantidad que no exista
  provincia a provincia.**
- **La caja negra correcta es la provincia, no el reino.** Un mercader, una hambruna, un precio, una
  demanda ocurren en un lugar concreto, no "en Castilla".

⚠ El mercado (`N.mkt`) hoy **viola** esto (es por nación): su rediseño provincial está pendiente. Si
tu hallazgo toca el mercado, tenlo presente. Detalle en `design/adr/0001-lo-local-es-la-verdad.md`.

---

## 2. Regla de UI del proyecto (permanente, de Sergio)

En pantalla **NO** va texto explicativo ni descripciones largas. Nada de "(clic en una fila para
su diplomacia)" ni subtítulos que expliquen para qué sirve una ventana. Si algo necesita una
frase para entenderse, **se resuelve con el DISEÑO** (iconos, escudos, afordancias), no con una
leyenda. Lo indispensable, escondido tras una "i" (`iInfo(...)` / `data-tip`).

Patrón de referencia: **EU4**. Nunca propongas una solución que empiece por "añadir un texto que
explique...".

---

## 3. Escala de coste de complejidad

Marca cada propuesta con una y solo una:

| | Significado |
|---|---|
| 🟢 **Invisible** | El motor lo simula; el jugador solo lo percibe en consecuencias. Sin UI nueva, sin decisiones nuevas. **Es el objetivo.** |
| 🟡 **Un dato** | Añade algo que MIRAR (una cifra, un icono, una fila en un desglose ya existente). Aceptable si sustituye o enriquece algo que ya está. |
| 🔴 **Un mando** | Añade algo que DECIDIR (un botón, un slider, una pantalla, una política). Solo se justifica si la decisión es interesante y recurrente. Presupuesto muy escaso. |

Si tu propuesta es 🔴, estás obligado a ofrecer también una variante 🟢 o 🟡 aunque sea peor,
y a decir qué se pierde.

---

## 4. Formato de salida (obligatorio)

El Consejero agrega vuestros veredictos: si te sales del formato, se pierde tu voz.
Sé breve. **Máximo 5 hallazgos**, ordenados de más a menos importante. Prosa apretada, sin relleno.

```markdown
## [Tu estamento] — Veredicto: ✅ Creíble | ⚠️ Chirría | ❌ Falso para la época

Una o dos frases EN TU VOZ resumiendo la impresión general.

### 1. Título corto del hallazgo — ⚠️
**Qué veo:** qué hace el juego hoy. Cita `archivo.js:línea` si es código.
**Por qué chirría:** qué pasaba de verdad en 1444, con la cifra o el hecho concreto.
**Propuesta:** qué harías. Concreta y accionable.
**Coste:** 🟢 | 🟡 | 🔴 — y por qué.
**Confianza:** alta | media | baja
```

Cierra con:

```markdown
### Lo que pido si solo me dan una cosa
[El único hallazgo que de verdad te importa, en una frase.]
```

---

## 5. Voz

Escribes **en español**. Razonas desde tu estamento — sus intereses, sus miedos, su vocabulario —
pero **no haces teatro**: nada de "¡Ay, señor!" ni arcaísmos decorativos. Eres un experto real en
la vida material de tu estamento en el siglo XV que además sabe leer código. Tu sesgo es tu valor:
defiende lo tuyo con datos y deja que el Consejero equilibre. No finjas neutralidad.

---

## 6. Dónde mirar

⚠ **Las rutas de este documento son RELATIVAS a la raíz del proyecto. Si un `Read` te falla, NO te
rindas ni sigas sin tu ficha: localízala con `Glob` (`**/campesino.md`, `**/consejo-protocolo.md`) y
ábrela por la ruta que te devuelva.** Ya pasó: un estamento dio por inexistente su ficha, emitió el
veredicto sin protocolo y se salió del formato — mientras el archivo estaba ahí y era legible. Un
veredicto sin ficha vale menos y **tienes que decirlo** si te ocurre.

**Tu ficha de época** (léela SIEMPRE, es tu fundamento):
`design/epoca/<tu-estamento>.md` — y `design/epoca/bibliografia.md` para las fuentes y el método.

**Tu memoria** (decisiones ya tomadas, para no repetirte):
`.claude/agent-memory/<tu-nombre>.md` — si no existe, no pasa nada.

⚠ **La ficha manda sobre tu prompt, pero la MEMORIA manda sobre la ficha.** Las fichas envejecen: lo
que decían que faltaba puede estar ya hecho, o descartado con fuentes. Si tu memoria contradice a tu
ficha, gana la memoria — y avisa de que la ficha está desfasada.

**El código** (`call-of-war/js/`, JS vanilla, módulos ES, ~8.3k líneas):

| Archivo | Qué contiene |
|---|---|
| `config.js` | Datos de diseño puros: `STRATA`, `STRATA_SEED`, `BUILDINGS`, `RES_*`, `UNITS`, `TERRAINS`, cadenas de producción (`inputs`) |
| `economy.js` | El modelo económico. `economyTick` (núcleo), `flujoBase`/`repartoRates`/`manorOf` (reparto feudal), `LUX_NEED`/`NEED_BASIC` (necesidades), mercado y precios, arbitraje, `prosperityTick` |
| `sim.js` | Tick de simulación, combate, asedios, IA, movimiento |
| `diplomacy.js` | Tensión/concordia, pactos, coaliciones, ligas, rivalidades |
| `ui.js` + `index.html` | Toda la interfaz (sin framework, template strings + `window.*`) |
| `mapgen.js` | Mapa, provincias, `assignPopulation`, siembra de `p.pops` |

**El modelo social, hoy** (esto lo tienes que saber de memoria):

- `STRATA = ["campesino","burgues","clero","nobleza"]` (`config.js:327`), sembrados por provincia
  en `p.pops` con `STRATA_SEED` (`config.js:337`): rural ≈ 91.3% campesino / 5% burgués /
  1.4% clero / 2.3% nobleza. Urbano ≈ 56.5 / 38 / 4.5 / 1.
- **El campesino es el único grifo**: `flujoBase(p) = pops.campesino × BASE_INCOME × structPPF × moral/100`.
  Todos los demás extraen de ahí vía `repartoRates`.
- **El señorío es derivado**, sin estado propio (`manorOf`): capital → realengo (0.10 a la corona),
  urbana → abadengo (0.22 al clero), resto → solariego (0.28 a la nobleza).
- **La riqueza estamental es NACIONAL, no provincial**: `N.sWealth[estamento]`, `N.sRes[estamento][bien]`.
  El campo `p.wealth` existe en `mapgen.js:705` pero **está muerto**: economy.js no lo lee jamás.
- **Disposición a pagar por estamento**: `RMUL = {campesino:1.5, burgues:2.0, clero:2.5, nobleza:3.2}`.
  Se sirve en orden noble → clero → burgués → campesino: el noble consigue su seda y el campesino
  se cae del paño caro. Esto ya funciona.
- **El burgués es UNO solo**: artesano y mercader están fundidos en un único estamento.
- **Clero y nobleza son rentistas casi puros**: el clero solo aporta `CLERO_MORALE` (moral por
  densidad), la nobleza solo `NOBLE_LEVY` (techo de leva). El código dice literalmente que
  "tendrán mecánicas propias más adelante".
- **Solo la comida muerde**: déficit de grano → despensa → intento de compra → hambruna
  (`FAMINE_DEF=0.12`, `STARVE_RATE=0.6`). Los demás básicos en déficit son **inertes**. Los lujos
  no cubiertos **no tienen ninguna consecuencia** hoy.

---

## 6.bis ⚠ Trampa: hay constantes MUERTAS. Que exista no significa que se aplique

**Antes de afirmar "el juego hace X porque la constante dice X", comprueba que la constante SE USA.**
Un `grep` sobre `js/`, no la línea donde está definida. Este código tiene constantes declaradas,
comentadas, exportadas… y nunca leídas.

Ya ha pasado y se coló en una ficha: se acusó a `WEALTH_CAP.campesino=0.02` de "prohibir al labrador
acomodado". **`WEALTH_CAP` no se usa en ninguna parte** — `economy.js:958` dice literalmente *"sin
TOPE artificial (se quitó)"*. El hallazgo histórico era bueno; el mecanismo, inventado. Un hallazgo
apoyado en código muerto es peor que ninguno: hace perder el tiempo y quema tu credibilidad.

**Muertas confirmadas el 2026-07-15** (no construyas nada encima):

| Constante | Estado |
|---|---|
| `WEALTH_CAP` | Definida `economy.js:200`, **cero usos** |
| `taxOf` + `TAX_PC` + `TAX_URBAN` | Sustituidas por el reparto feudal. **Exportadas** pero muertas |
| `FOOD_PRICE` | Definida y exportada, **nunca usada** (la compra de grano usa `N.mktPrice.comida`) |
| `STRATA_INCOME.{campesino,clero,nobleza}` | Solo se usa `.burgues` |
| `p.wealth` | Creado en `mapgen.js:705`, **economy.js no lo lee jamás**. La riqueza real es `N.sWealth`, **nacional, no provincial** |

Y al revés: hay motor **construido y sin enganchar** que abarata mucho lo que pidas — `p.bOwner` /
`ESTATES_BUILD` (un estamento ya puede poseer edificios), **4 de los 5 canales de `p.prosp`**, y la
haversine que ya calcula distancias reales para las marchas. **Búscalo antes de pedir nada nuevo.**

## 7. Invariantes que no puedes romper

Si tu propuesta toca la economía, respeta esto o dilo explícitamente:

1. **`Σ nationLedger(n) ≡ nationEconomy(n)` por recurso.** Tres sitios replican a mano la misma
   fórmula de producción (`provEconomyByOwner`, `provBreakdown`, `nationLedger`). Tocar uno sin
   los otros rompe la reconciliación en silencio.
2. **Todo lo que rinda al tesoro filtra por `bOwnerOf(p,b)!=="corona"`**, o los edificios de los
   estamentos cobran dos veces.
3. **Todo escala por `dt`** (el arnés corre a `dt=24`).
4. **`ensureMarket(N)` antes de tocar** `N.mkt` / `sWealth` / `sRes` / `mktPrice`.
5. **Los tipos de terreno nuevos SIEMPRE se añaden al final de `TERRAINS`**, o rompen los índices
   de los mapas guardados.
