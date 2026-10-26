# Guía de estilo de UX — Basileus 1-click

Fundamento del agente `ux-director`. Inventario de **lo que existe de verdad** en el código, no de
lo que nos gustaría. Levantado el 2026-07-15 sobre `call-of-war/js/ui.js` (1588 líneas) e
`index.html`.

**Mantenimiento:** cuando arregles algo de la §6 (deuda), táchalo aquí. Una guía que miente es peor
que no tenerla.

---

## 1. Las dos reglas

**1. Nada de texto explicativo visible.** Regla permanente de Sergio, literal:

> *"nunca pongas textos así, la interfaz debe ser intuitiva gráficamente, no explicativa con texto"*

No hay descripciones, ni párrafos, ni subtítulos que expliquen para qué sirve una ventana, ni
instrucciones tipo *"(clic en una fila para su diplomacia)"*. Si algo necesita una frase, **se
resuelve con diseño** —iconos, escudos, afordancias, posición, color—, no con una leyenda. Lo
indispensable va tras una "i" (`iInfo(...)`).

Excepción única: `#helpOverlay`, que ES la ayuda.

Esta regla la vigila un hook: `.claude/hooks/lint-ui-texto.mjs` avisa al escribir prosa larga
visible en `ui.js`/`index.html`. Solo mira lo recién escrito, no el archivo entero.

**2. EU4 es el patrón de referencia.** Dicho por Sergio: *"simplemente es imitar las interfaces de
EU4"*. No es inspiración vaga: es la instrucción. Se ofreció a dejar capturas si hace falta afinar.

Reglas ya derivadas y aplicadas en la vista de diplomacia:
- **El color solo NO identifica.** Para elegir un país hace falta **escudo + NOMBRE**. Una rejilla
  de banderitas de colores es inusable.
- **Los desgloses NO se muestran por defecto**: van en un hover estructurado (`data-tiph`).
- **Cada acción con ajustes abre su PROPIA ventana**, nunca el ajuste inline junto al botón.
- **Destacar con grafismo, no con símbolos sueltos**: el líder de una liga es un escudo con borde
  dorado (`.esc.lead`), no una corona ♛ al lado.
- Donde no hay nada, un botón **"+"** para actuar, en vez de un "—" muerto.

## 1b. Las reglas de estructura (Sergio, 2026-10-26) — PERMANENTES

Dictadas por Sergio al revisar la UI económica, con capturas. Valen para **toda** pantalla, tooltip y ventana, nueva o
vieja. Las vigila un hook (`.claude/hooks/lint-ui-texto.mjs`: avisa del "·" y de los iconos Unicode en lo recién escrito).

1. **Un tema por bloque, y separados.** Si un desglose cuenta varias cosas, cada una va en su bloque con un **separador
   visible** entre ellos. Ejemplo que lo motivó: el tooltip del precio mezclaba "cómo se forma el precio" con "lo que se
   produjo y movió este mes" en una sola lista: un churro. Son dos bloques.
2. **Nada de iconos Unicode** (emoji, ▲▼, →, ✖, ■, ☠…). Donde haría falta un icono y aún no hay sprite, se pone el hueco
   **`[ ]`** con el helper `ph("nombre")`, que deja dicho qué icono va ahí. Si hay sprite (`resImg`, `uiIcon`), se usa el
   sprite. Las flechas y marcas de estado se dibujan con CSS, no con caracteres.
3. **Todo en rejilla, y cada dato con su nombre.** El contenido se coloca en una rejilla (visible o invisible según el
   caso) que separa un concepto de otro, y **las columnas nombran el dato** con su cabecera. Ejemplo que lo motivó: en la
   ficha del bien salía "4 · ×0,5 ▼ · normal 8 · [gráfica]" en una fila: números e iconos sin decir qué es cada uno.
4. **Nombres de 1 palabra, 2 como mucho.** Funciones, mecánicas, cabeceras y etiquetas. "Del campo al oficio" es
   inaceptable: "Ascensos". "Lo que sobra hasta la siega": "Excedente".
5. **Prohibido el "·" como separador.** Siempre la regla 3: columnas, filas, rejilla. Se corrige también donde ya exista.

**Patrón de Victoria 3** (leído de sus `game/gui/tooltip.gui` y su localización, 2026-10-26):
- Tooltip: **título** sobre su propia banda de fondo + una línea de resumen; luego `TOOLTIP_DELIMITER`, un **separador**
  gráfico (línea con degradado a los lados) **entre cada tema**; los desgloses **sangrados** bajo su total.
- Tablas (`caligula_table`): **cabecera por columna** (26 px) con una línea debajo; la 1.ª columna a la izquierda y el
  resto a la derecha; filas de 30 px (23 en la versión condensada), **fondo alterno** en las impares; márgenes 20/3 px.
- Ancho máximo del tooltip: 550 px.
- Componentes en el código: `tipBox(title, blocks)` (bloques separados, cada uno con su cabecera y sus filas o su
  tabla), `ph(nombre)` (hueco de icono) y `.tipSep`/`.tipGrid`/`.icoPh` en `index.html`. **No se escribe un tooltip a mano.**

---

## 2. Inventario de pantallas

### Chrome fijo (siempre montado)

| Elemento | Función | Refresco |
|---|---|---|
| `#topbar` / `#resbar` | Stock de la corona + balance mensual. Máx. 2 filas | `refreshTop()` `ui.js:189` |
| `#bottombar` | Fecha, velocidad (0/1x/60x/720x), botonera de ventanas | estático |
| `#side` | KPIs del reino + ejércitos desplegados (arriba-dcha) | `refreshMetricsLog()` `ui.js:716` |
| `#realmMenu` | Escudo + botonera-placa del reino | `buildRealmMenu()` `ui.js:691` |
| `#log` | Mensajes efímeros, `pointer-events:none` | `log()` `ui.js:19` |

### Cluster de provincia (abajo-izquierda, estilo EU4)

`#provPanel` (detalle, `left:8px`) → `#provTabs` (columna de 4 botones 50×50, `left:336px`) →
`#provWin` (ventana activa, `left:392px`) → `#buildtabs` (categorías, `left:396px;bottom:342px`).

Gobernado por `S.selProv` + `S.provTab` (`"build"|"roads"|"army"|"prosp"`). `refreshProvWin()`
`ui.js:559` conmuta entre `.build` (ancha y baja, tiles en fila) y `.list` (alta y estrecha).
`#armyWin`/`#armyEdit` ocupan el mismo hueco y son **excluyentes** con `#provPanel`.

⚠ **Layout posicional frágil**: esos `left:` están calculados a mano. Cambiar el ancho de
`#provPanel` (322px) descoloca otros tres elementos.

### Overlays modales (`.overlay` + `.panel`)

`startOverlay` · `helpOverlay` · `dipOverlay` · `councilOverlay` · `coalPeaceOverlay` ·
`dipModalOverlay` · `leagueOverlay` · `callToArmsOverlay` · `ledgerOverlay` · `treasuryOverlay` ·
`estatesOverlay` · `mercadoOverlay` · `fiscalOverlay` · `reportsOverlay` · `peaceOverlay` ·
`endOverlay`.

Apertura canónica (`main.js:170-193`): guard `S.player<0` → `style.display="flex"` → `refreshX()`.
`#armyPanel` es flotante **no modal** (`display:block`).

**Refresco idempotente:** cada `refreshX()` se autoinhibe si su overlay está cerrado
(`if(!ov||ov.style.display!=="flex")return`), lo que permite el barrido ciego del tick
(`main.js:1033`).

---

## 3. Tooltips — el sistema más importante de esta UI

**Es la documentación del juego.** La regla del texto solo funciona porque esto existe.

Handler único delegado en `main.js:975-985` sobre `document`, con `closest("[data-tip],[data-tiph]")`
y posicionamiento en `mousemove` con clamp a viewport.

| | Uso |
|---|---|
| `data-tip` | Texto plano → `textContent`. Saltos como `&#10;` (los codifica `ta()`) |
| `data-tiph` | HTML estructurado → `innerHTML` + clase `.rich` |

**Constructores** (`ui.js:288-291`):
- `ta(s)` — **escapa siempre** antes de interpolar en un atributo.
- `iInfo(t)` → `<i class='i' data-tip="...">i</i>`. **El vehículo de la regla del texto.**
- `statv(val,brk)` → `<b class='statv' data-tip="...">` (subrayado punteado).

### Dos dialectos de desglose — usa el segundo

1. **Texto multilínea** (`moraleBreak` `:311`, `dotBreak` `:323`, `slotBreak` `:337`, `defBreak`
   `:342`, `netBreak` `:350`): título, líneas `"  etiqueta: +valor\n"`, cierre `"  = total"`.
2. **HTML estructurado** (`relTipHTML` `:904`): `.tipT` (título) + N× `.tipR` (label/valor) +
   `.tipR.tipTot` (total). Se envuelve con `relBarTip` `:913`.

**El 2 es el diseño bueno y solo lo usa diplomacia.** Es el patrón EU4 canónico (modificadores que
suman a un total). Para desgloses nuevos, usa el 2.

---

## 4. Componentes

- **Escudo `.esc`** — `clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)`, fondo = color de
  nación. `escOf(n,big,lead)` `ui.js:902`. Variantes `.escL` (grande), `.esc.lead` (borde dorado
  por triple `drop-shadow`). **Sustituye al `.chip` cuadrado.** Migración a medias → §6.
- **`nameChip(n)` / `nameChipL(n,lead)`** `:915` — escudo + nombre clicable → `openDiplo(n)`.
- **`.panelX`** — cierre `✕` sticky arriba-derecha dentro del `.panel`.
- **Pestañas** — cuatro sistemas: `.ttab` (tesorería), `.btab` (categorías de edificio), `.ptab`
  (botones cuadrados de provincia), `.cChip` (consejo). Todos usan `.on` como estado activo.
- **Tarjetas** — `.ncard` (nación), `.btile` (edificio, **fijo 192×246**, con `.foot2{margin-top:auto}`
  para anclar coste/tiempo abajo), `.acard` (ejército), `.dCard` (diplomacia).
- **Barras** — `.relbar`/`.relfill`/`.relzero` (bipolar con cero central, `relBarHTML` `:886`).
  Prosperidad y estamentos usan barras **inline ad-hoc** (`:91`, `:1446`) → deuda.
- **Libro mayor navegable** (tesorería) — `.tbook` > `.trow` / `.trow.click` / `.tsec` / `.ttotal` /
  `.tcrumb`. Drill-down con `S.treasuryPath` + migas `tsyCrumb()` `:603`. **Es el mejor patrón del
  código y no se reutiliza en ningún otro panel.** Candidato claro para mercado y estamentos.
- **Tabla ordenable** — `table.dip.led`, `th` sticky, `.on` + `▾` en la columna activa
  (`refreshLedger` `:1269`).
- **Iconos** — `uiIcon(name,big)` → `<img class='uic'>` de `assets/ui/`; `resImg(k)` → sprite `.ric`
  o `span.ricEmoji` de respaldo. Los emoji sueltos se interpolan a pelo por todas partes.

---

## 5. Paleta y convenciones

### Variables (`index.html:11-21`) — el único bloque de tokens

```
--txt   #ecebe4   texto general (blanco cálido)
--muted #9aa3ad   secundario
--dim   #7a828b   muy atenuado
--pos   #5fbf4c   ingreso / ganancia (verde EU4)
--neg   #d85c50   pérdida
--title #d8c191   cabeceras
--fs 12px · --fs-t 14px · --fs-s 11px
```

Utilidades: `.pos .neg .muted .sm .dim .ttl`.

### Colores estándar SIN tokenizar (literales repetidos decenas de veces)

- Fondos: `#1c2127` (body) · `#262b31` (barras/panel) · `#31373e` (tarjeta) · `#2a2f36` · `#20252b`
- Bordes: `#3a4047` (separador) · `#4a525b` (borde panel) · `#454d56` · `#3f464e`
- Acentos: `#9fb878`/`#7fa56b` (verde activo) · `#c9a86a`/`#e8c24a` (dorado) · `#e8e0c8` (título
  claro) · `#6ba7d0` (azul aliado) · `#e0a17a` (alerta)

**Si vas a tocar color, tokeniza primero lo que toques.** No añadas un literal más.

### Código

- **Refresco**: `refreshSide()` `:872` → `refreshMetricsLog` + `refreshBuildBar` + `refreshArmyPanel`
  + `refreshArmyWin`. `refreshBuildBar()` `:582` es alias de compatibilidad → `refreshProvPanel` +
  `refreshProvTabs` + `refreshProvWin`.
- **Cableado**: todo por `window.*` + `onclick` inline en template strings. Las acciones viven en
  `main.js:119-400`.
- **HTML**: concatenación (`let h=""; h+=...`) → `.innerHTML=`. Sin escapado salvo `ta()` en
  atributos de tooltip.
- **Estado de UI en `S`** (`state.js`): `S.provTab`, `S.buildFilter`, `S.treasuryTab`/`S.treasuryPath`,
  `S.dipModal`, `S.diploView`, `S.leagueView`, `S.coalPeace`, `S.armyEdit`, `S.recruitUnit`…

---

## 6. Deuda viva (inventariada — no la redescubras)

### Violaciones de la regla del texto

| Dónde | Qué |
|---|---|
| `index.html:424-429` | Párrafo de ~6 líneas en el selector de nación |
| `index.html:438-488` | `helpOverlay` entero (9 párrafos) — **excepción legítima**, es la ayuda |
| `index.html:506,515,532,540,549,558,567,576,585` | **Subtítulo-párrafo bajo cada `<h1>`**, con el mismo estilo inline copiado 8 veces. Candidatos a `iInfo()` junto al título |
| `ui.js:1483` | Párrafo al pie de Estamentos |
| `ui.js:1578` | Línea explicativa en Hacienda |
| `ui.js:863` | Subtítulo en `#armyEdit` |
| `ui.js:372` | "Territorio impracticable: nadie puede reclamarlo…" |
| `ui.js:147` | "(el cupo crece con la población)" incrustado |

### Cinco dialectos para cerrar una ventana

1. `.panelX` + `onclick` inline con `getElementById(...).style.display='none'` — 9 overlays.
2. `.panelX` + función dedicada: `closeDipModal()`.
3. Botón `.uiBtn` "Cerrar" al pie, **sin `.panelX`**: `helpOverlay`, `reportsOverlay`,
   `peaceOverlay`, `endOverlay`.
4. `.apClose` (estilo propio): `#armyPanel`.
5. `callToArmsOverlay` — **no tiene ningún botón de cierre**.

**Sin salida global:** `Escape` solo funciona en modo editor (`main.js:731`). Ningún overlay lo
escucha, y no hay clic-en-backdrop.

### Tres representaciones de una nación

`.esc` (oficial), `.chip` cuadrado (en `refreshLedger` `:1273`, `refreshProvPanel` `:376,380,418`,
`refreshTreasury` `:686`, `refreshEstates` `:1434`) y `.mlog .sh` (un tercer clon, `index.html:341`).
Alias muertos: `const chipOf=escOf, chipT=escOf;` `:914`.

### Overlays que no se auto-actualizan

El tick (`main.js:1033`) refresca **5 de ~14**. Quedan congelados hasta una acción:
**Diplomacia, Registro, Ligas y Prosperidad**. Además `#dipOverlay`, `#councilOverlay`,
`#ledgerOverlay` y `#reportsOverlay` **no llevan el guard** `display!=="flex"`, así que reconstruyen
HTML aunque estén cerrados.

### Las tres pantallas más nuevas son las que más se desvían

Prosperidad (`ui.js:78-92`), Estamentos (`:1435-1479`) y Hacienda (`:1572-1583`) se construyen
íntegramente con `style='...'` inline, **hardcodean colores fuera de la paleta** y no reutilizan
`.prow`/`.bsec`/`.trow`.

### Otros

- **`title=` compite con `data-tip`**: `relBarHTML` usa `title` `:891` mientras `relBarTip` envuelve
  con `data-tiph` `:913` → **doble tooltip** (nativo + custom) sobre el mismo elemento.
- **`className="show"` + `style.display` a la vez** (`:422,556,570,579,870`): la clase `.show` ya
  define el `display`; escribir ambos la vuelve decorativa.
- **CSS duplicado**: `.res` definido dos veces con `gap` distinto (`index.html:35` y `:184`).
- **Código muerto**: `foodLine` `:36`, `reservesLine` `:120`, `slotsLine` `:143`, `laborLine` `:149`,
  `fxOtherText` `:264`.
- **Botones muertos visibles**: `btn_corte` y `btn_leyes` con `title='Próximamente'` (`:697,699`);
  `<i>próximamente</i>` visible en 4 de los 5 canales de Prosperidad (`:77`).
- **Copia repetida**: el mensaje de modo observador está **cuadruplicado** con variantes
  (`:680, 1422, 1491, 1565`).
- **Sin foco ni accesibilidad**: los "botones" son `<span>`/`<div>` con `onclick` (`.btab`, `.ptab`,
  `.ttab`, `.trow.click`, `th` del ledger). No son tabulables.

---

## 7. De dónde robar

- **EU4** — la fuente. Topbar de recursos, ficha de provincia, mapmodes, ledger, tooltips que suman.
  **Su gran lección: el tooltip es la documentación.**
- **Victoria 3** — el referente para lo que se está construyendo ahora: mercado, bienes, estratos,
  cadenas de producción, necesidades de POPs sin hoja de cálculo.
- **CK3** — si algún día entran personajes o la nobleza interior.
- **Anno 1800 / Frostpunk** — cadenas legibles de un vistazo; alertas que no gritan.
