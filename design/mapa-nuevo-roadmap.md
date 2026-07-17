# Roadmap de pulido del mapa nuevo (rama `mapa-nuevo`)

Acordado con Sergio el 2026-07-18. Cierra el pulido del mapa nuevo (6.131 provincias, 974
ducados de EU4, 190 naciones) hasta dejarlo **estático y jugable**. Ver
[[basileus-mapa-nuevo-import]] para el estado del mapa y [ADR 0001](adr/0001-lo-local-es-la-verdad.md)
(lo local es la verdad) como principio rector de las fases 3–4.

---

## El hallazgo que ordena todo: qué se congela y qué se recalcula

Hay **dos clases de operación**, y el orden del roadmap sale de no mezclarlas:

1. **Regeneración de pipeline** (`tools/map-import/`, Python → reescribe `official_map.js`
   desde EU4). **PISA cualquier edición manual del editor.** Solo el terreno de EU4 (fase 0)
   es de este tipo, y por eso va **primero**, antes de tocar el editor.

2. **Cálculo en carga** (`mapgen.js`: `assignTerrain`, `assignResources`, `assignPopulation`,
   `buildAdjacency`). Corre en cada arranque **respetando los campos ya congelados** y
   rellenando solo los `null`. NO pisa el trabajo del editor. Las fases 1, 3 y 4 son de este
   tipo → se pueden iterar (cambiar código, recargar, ver) sin perder nada.

3. **Edición manual** (editor → `buildSnapshot` → persiste en `official_map.js`/instantánea).
   Los campos que persisten: `owner0`, `duchy0`, `terrain` (`[7]`), `wasteland` (`[8]`), `pop`.

**Regla de oro del orden:** toda regeneración de pipeline ocurre ANTES de la edición manual;
todo cálculo en carga puede ir después porque respeta lo congelado. Congelar del todo es la
última fase.

**La fontanería para congelar terreno ya existe y funciona:**
- `assignTerrain` hace `if(p.terrain)continue` → no pisa terreno ya puesto ([mapgen.js:516](../call-of-war/js/mapgen.js#L516)).
- `save.js` lee `[7]` congelado ([save.js:71](../call-of-war/js/save.js#L71)) y lo reescribe en el snapshot ([save.js:36](../call-of-war/js/save.js#L36)).
- El editor cambia terreno y rehornea el sprite → los retoques a mano persisten solos.

---

## Fase 0 — Orografía real desde EU4 ✅ HECHA (2026-07-18, sin commitear)

**Implementado y verificado en el juego vivo (0 errores de consola):**
- `tools/map-import/mk-terrain.py`: extrae terreno EU4 por ducado (666 override + 302 muestreo de
  `terrain.bmp`) → `terrain.json`. `mk-export.py` lo vuelca a `[7]` y fija `[8]` (páramo SOLO los 19
  `impassable` de EU4; desactiva la heurística vieja `desierto→páramo` que dejaba sin dueño 44
  desiertos reales + ~479 falsos del Sáhara).
- Tipo `meseta` añadido a `TERRAINS` (config.js) y `POP_TERR_FERT` (0.6, mapgen.js). 647 provincias.
- `official_map.js` regenerado: 5.576 provincias con terreno congelado, 211 null (los ~6 ducados
  sin resolver del Sáhara profundo → los computa el juego), meseta prominente en Iberia/Anatolia/Magreb.
- **Variante B (salpicado)**: `sprinkleTerrain()` en mapgen + toggle `window.setSprinkle(true/false)`.
  La base congelada sigue siendo EU4 puro (variante A, por defecto); B es un overlay de comparación.
- Verificador: `tools/verify/terrain-eu4-verify.js` (CDP, saca capturas A y B).

**DECIDIDO: variante A (EU4 puro).** B queda como toggle de dev por si acaso.

**Sprites nuevos (2026-07-18, de `Downloads/Assets CoW/suelos1.png`, 5 teselas):** meseta (tesela 4,
la ocre con rocas), tundra (tesela 2, nieve), y **vega nueva SIN vallas** (tesela 3, reemplaza
`farmland.png` — la vieja tenía vallas que quedaban raras). Troceadas con floodfill desde esquinas
(`scratchpad/slice_suelos1.py`) y registradas en `TERRAIN_SPRITE`/`TERRAIN_FILL` de render.js.
Además **desierto** ← `Recursos5.png` (dunas). Verificado: **10/10 sprites, todos los terrenos de
tierra 40/40 con sprite** (solo páramo y mar sin sprite, correcto), 0 errores. Teselas 1 (meseta alt)
y 5 (rocoso) de suelos1 sin usar.

**Todo SIN COMMITEAR** (norma: commits a petición).

---

## (referencia) Fase 0 — diseño original

**Qué:** volcar el terreno de EU4 al campo `[7]` de cada provincia. Hoy va a `null` y el juego
lo inventa con reglas de lat/lon ([mapgen.js:516-555](../call-of-war/js/mapgen.js#L516-L555)):
el mapa nuevo, tan histórico en fronteras, sigue con la orografía procedural del viejo.

**Cómo:** [mk-eu4.py](../tools/map-import/mk-eu4.py) ya casa cada ducado con su **id de provincia
de EU4** (`v["eu4"]`). El terreno es un *lookup* más:
- Fuente EU4: `map/terrain.txt` (`terrain_override`, explícito pero parcial) + muestreo de
  `map/terrain.bmp` + `map/tree.bmp` (completo, voto por mayoría de píxeles por provincia usando
  `provinces.bmp` + `definition.csv`) + `map/climate.txt` (`arctic`→tundra, `impassable`→páramos).
  Vía recomendada: **override primero, bitmap de relleno**.
- Un terreno por provincia de EU4 = por ducado → las ~6 provincias del ducado lo heredan
  (homogéneo a propósito; Sergio rompe la homogeneidad a mano en la fase 2).

**Materia prima MEDIDA (2026-07-18, `scratchpad/medir-terreno.py`)** sobre 968 ducados casados:
- **69% (666) con `terrain_override` explícito**; 31% (283) hay que sacarlo de `terrain.bmp`
  (muestreo por mayoría de píxeles; `provinces.bmp` RGB→id + `terrain.bmp` paletado + `trees.bmp`).
- Distribución EU4: woods 191, farmlands 119, highlands 74, hills 68, drylands 66, steppe 47,
  mountain 35, grasslands 27, forest 15, marsh 12, desert+coastal_desert 7.
- **140 ducados → meseta** (highlands 74 + drylands 66) = 14% del mapa: justifica el tipo nuevo.
- **19 IMPASSABLE** (cordilleras, no desierto): EUROPA (mantener páramo): Langfjella, Cárpatos,
  Alpes 1-5, Pirineos, Montes Pónticos. ÁFRICA/OR.MEDIO (resucitar, punto 2a): Alto Atlas 1-3,
  Aurès, Desierto Egipcio, Badiyat ash-Sham, Zagros 1-2, Hakkari, Cáucaso. **9 ARCTIC → tundra.**
- **Bonus:** hoy `assignTerrain` marca ~479 páramos de "Sáhara" por la regla desierto+lat; EU4
  dice que casi todo eso es drylands/highlands=meseta → al volcar EU4 **deja de ser páramo solo**.
  El punto 2a se reduce a decidir esos 19 impasables a mano en el editor.

**Mapeo EU4 → nuestros tipos** (DECIDIDO; caja acaba en el Atlas, sin selva ni sabana):

| categoría EU4 | nuestro |
|---|---|
| grasslands, plains | llanura |
| farmlands | vega |
| hills | colinas |
| mountain, impassable_mountains, desert_mountain | montaña |
| forest, woods | bosque |
| marsh | pantano |
| desert, coastal_desert | desierto |
| steppe | estepa |
| **drylands, highlands, dry_highlands, savannah** | **meseta (TIPO NUEVO)** |
| glacier, climate arctic | tundra |
| coastline | llanura (o vega si costera fértil) — solo 5 en la caja |

**Tipo nuevo `meseta`** (a añadir en `TERRAINS`, [config.js:281](../call-of-war/js/config.js#L281)):
propuesta entre colinas y estepa — `mov:1.0, def:1.1, prod:0.8, color:#c9a86a` (tono ocre-tierra).
Sprite opcional (sin él, color pelado como desierto/tundra hoy — no es bug).

**Impasables en el volcado:** el pipeline les da terreno (montaña / desierto) pero **mantiene
`[8]=1` (páramo)**. Sergio resucita en el editor (2a) los de África/OrMedio poniéndolos a `[8]=0`
+ nación. Si no fijáramos `[8]=1`, las cordilleras (montaña, no desierto) NO dispararían la regla
`desierto→páramo` y quedarían jugables sin dueño (mal).

**Decisiones RESUELTAS:** ✅ tipo nuevo = **meseta** (sin sabana). ✅ homogeneidad: **generar
AMBAS variantes** (EU4 puro vs. EU4 + salpicado procedural) para que Sergio compare y decida.

---

## Fase 1 — Conexión marítima por nodos (código en `mapgen.js`, no toca datos)

**Qué (punto 3 de Sergio, importante):** hoy dos provincias costeras se enlazan **directamente**
por mar si hay línea recta de mar < 220 px entre ellas ([mapgen.js:859-879](../call-of-war/js/mapgen.js#L859-L879)):
España toca Marruecos saltándose los nodos de mar. Queremos lo contrario: **cada provincia
costera se conecta al/los nodo(s) de mar que bordean su playa, y toda conexión marítima va por
el grafo de nodos de mar.**

**Cómo:** el grafo de mar ya existe (344 teselas hexagonales, `S.adj` entre teselas de mar,
estrechos como aristas). El cambio:
- Reescribir `S.seaAdj`: en vez de costera↔costera, **costera↔nodo de mar adyacente** (por ráster).
- El enrutado naval (convoyes, marcha marítima de ejércitos, alcance de la IA) pasa a ser
  costera → nodo → grafo de mar → nodo → costera.

**Ojo — consumidores de `S.seaAdj` que hay que reenganchar al grafo de nodos:**
- **Mercado por mar**: [mapgen.js:1066](../call-of-war/js/mapgen.js#L1066) une plazas por `S.seaAdj`.
  Afecta a la topología del mercado (piedra angular, ADR 0001) → recalcular por el grafo de nodos.
- Convoyes / rutas comerciales por mar, alcance naval de la IA, marcha marítima de ejércitos.

**Por qué va antes de las fases 3–4:** cambia el grafo del mercado, del que dependen recursos
(fase 3) y prosperidad/pops (fase 4). Debe estar cerrado antes.

**Detalle de diseño (al implementar):** coste/distancia naval = saltos de nodo (o px por el
grafo); las teselas tienen `depth`, útil para penalizar aguas profundas o no.

---

## Fase 2 — Edición manual (Sergio, en el editor; persiste en snapshot)

Todo esto se hace **después** de la fase 0 (que ya dejó el terreno de EU4 congelado) para no
perder trabajo en una regeneración.

### 2a — Resucitar impasables (África / Oriente Medio) — CONFIRMADO que el editor lo hace
Pocas zonas. Por provincia, en este **orden obligatorio**:
1. **Quitar páramo**: botón "Impracticable → Sí (quitar)" (`toggleWasteland()`, [editor.js:512](../call-of-war/js/editor.js#L512)).
2. **Terreno**: botones de terreno ([editor.js:508](../call-of-war/js/editor.js#L508)).
3. **Nación**: pincel "Nación" ([editor.js:460](../call-of-war/js/editor.js#L460)).

⚠️ El pincel Nación **se niega a pintar un páramo** (`if(p.wasteland)return`, [editor.js:68](../call-of-war/js/editor.js#L68)),
por eso hay que quitar el páramo PRIMERO. **Los pops salen solos** al dejar de ser páramo
(fertilidad de desierto 0.15 → poca población); el reequilibrio fino es la fase 4.

### 2b — Fusionar reinos menores en los mayores — manual ("a malas")
Sergio prefiere hacerlas a mano con el pincel Nación, provincia a provincia. Son pocas.
(Existe la opción de una tabla de absorción en `mk-nations.py` si algún día cambia de idea, pero
eso sería regen de pipeline → habría que hacerlo antes de la fase 2, no después.)

### 2c — Romper la homogeneidad del terreno a mano
Sobre el lienzo homogéneo de EU4, Sergio salpica colinas/bosque/etc. según lo que sabe de
orografía. Persiste solo (rehornea sprite).

---

## Fase 3 — Recursos estratégicos (código/config + consejo; recalcula en carga)

**Qué (punto 4 de Sergio):** pulir y quizá **expandir bastante** los recursos estratégicos de
las provincias. Hoy `assignResources` los calcula en carga desde zonas históricas por bien
(`BONUS_BIEN`, [mapgen.js:579+](../call-of-war/js/mapgen.js#L579)), terreno-dependientes → por
eso va **después** de que el terreno esté final (fases 0 y 2).

**A plantear (pendiente de diseñar):** alcance de la expansión, nuevos bienes/cadenas, cómo
casan con las categorías de terreno. **Convocar al consejo** (mercader/artesano/campesino) para
realismo de 1444 antes de fijar catálogo.

---

## Fase 4 — Ciudades, pops y estamentos (código/config + investigación del consejo)

**Qué (punto 5 de Sergio):**
- **Declarar qué provincias son ciudad** desde el inicio y cuáles rurales (hoy `urban`/
  `CITY_POP` va por nombre; ver punto 2 de [[basileus-mapa-nuevo-import]]).
- **Reequilibrar pops y estamentos** por provincia, con la **investigación del consejo**
  (campesino/clérigo/noble/artesano) para densidades y reparto de estratos creíbles de 1444.

Va al final del contenido porque depende de todo lo anterior: geometría final (2a/2b), terreno
final (0/2c) y acceso al mercado final (fase 1). Recalcula en carga, no pisa ediciones.

---

## Fase 5 — Congelar el mapa estático + ajustes manuales finales

**Qué:** volver el mapa **estático** — congelar terreno, pops, recursos y ciudades en
`official_map.js` para que nada se recalcule en carga (hoy `[7]/[8]/[9]` y recursos se computan).
Después, los últimos ajustes finos a mano.

**Requiere confirmación explícita de Sergio** antes de congelar (una vez estático, cada cambio
vuelve a ser edición manual persistida, no un knob que se recarga).

---

## Orden final (resumen)

| Fase | Qué | Tipo | Depende de |
|---|---|---|---|
| **0** | Orografía de EU4 → `[7]` (+ tipo nuevo) | Pipeline (regen) | — (va primero: pisa edición) |
| **1** | Conexión marítima por nodos | Código (carga) | independiente; antes de 3–4 |
| **2a** | Resucitar impasables (editor) | Manual | fase 0 hecha |
| **2b** | Fusionar naciones menores (editor) | Manual | fase 0 hecha |
| **2c** | Romper homogeneidad del terreno | Manual | fase 0 hecha |
| **3** | Recursos estratégicos (+ consejo) | Código/config (carga) | terreno final (0, 2c) |
| **4** | Ciudades + pops + estamentos (+ consejo) | Código/config (carga) | 1, 2, 3 |
| **5** | Congelar estático + ajustes finales | Freeze | confirmación de Sergio |

## Decisiones pendientes de Sergio
- [x] Fase 0: tipo nuevo = **meseta** (sin sabana); homogeneidad = **A (EU4 puro)**. HECHO y commiteado (`c0d3bc8`).
- [ ] **Stats de terreno PROVISIONALES**: los stats de TODOS los terrenos (incl. `meseta` mov 1.0/def
  1.1/prod 0.8, fertilidad 0.6) son de relleno → **revisión general con el consejo (mercader/campesino)
  + cronista (investigación histórica) antes de congelar** (fase 5). Palabras de Sergio: "ponle esos
  provisionalmente, luego revisaremos en general los stats de los terrenos".
- [ ] Fase 3: alcance de la expansión de recursos (se plantea con el consejo).
- [ ] Fase 5: luz verde para congelar.
