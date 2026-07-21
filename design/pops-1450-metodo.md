# Método para reconstruir POBLACIÓN y NOMBRES por provincia — Basileus, c. 1444/1450

> **Qué es esto.** El documento que cierra el MÉTODO (Tanda A) antes de abrir el abanico de ~18
> agentes-región (Tanda B). Levantado por el Cronista el 2026-07-19. **No toca código**: define la
> regla de reconciliación, la tabla de densidades, el formato del dataset estático, los criterios de
> anacronismo y la partición del trabajo. Es el paso "verificar pops" de la secuencia de
> `design/mercado-centros-eu5.md` (gazetteer → **pops** → centros de comercio).
>
> **Fiabilidad de este método.** El esqueleto demográfico macro (población por macrorregión en 1450)
> descansa en cita dura (Russell/Cipolla y Munro, abiertos en sesión). Las cifras de ciudad concretas
> van de **A** (extraídas) a **C** (solo resumen de buscador): cada una lleva su marca. Las regiones
> **islámicas y orientales** (Anatolia interior, Persia, Levante, Magreb, estepa) tienen la fuente más
> floja y ahí las horquillas son las menos fiables — está avisado y marcado ❓.

---

## 0. El problema, medido

Hoy conviven **dos** tablas de núcleo urbano que se pelean, y `assignPopulation` (`mapgen.js:743`)
las mezcla mal:

- **`CITIES1444`** (`cities1444.js`, 319 ciudades, formato `[nombre, x, y, hab, año(1400|1450)]`).
  Fuentes: Buringh 2021 + Bosker/Buringh/van Zanden 2013 + Chandler 1987 geocodificado. Es lo que
  siembra `p.cityPop` en `seedCities()` y lo que decide qué provincia es `urban`.
- **`CITY_POP_RAW`** (`mapgen.js:714`, 217 ciudades curadas a mano, en español, ANTIGUA). Es la que
  `assignPopulation` PREFIERE para el núcleo (`mapgen.js:764`: `CITY_POP ?? p.cityPop`).

**El bug de fondo:** el núcleo `hist` prefiere `CITY_POP` sobre `cityPop`; y ninguna de las dos mira
el 5º campo (el AÑO), así que un valor de 1400 compite de tú a tú contra uno de ~1450. De 61 ciudades
con núcleo en ambas tablas, **54 discrepan, en los dos sentidos**.

La conclusión de la verificación de esta sesión —y es el hallazgo que ordena todo lo demás— es que
**ninguna de las dos tablas es fiable por sí sola, y `max()` es exactamente la regla equivocada**:

| Ciudad | cities1444 | CITY_POP | **Cifra ~1450 correcta (verificada)** | Quién acierta |
|---|---:|---:|---|---|
| Fustat/El Cairo | 380 000 (1450) | 200 000 | **~150 000–200 000** [3][10] | CITY_POP (y aun así en el techo) |
| Granada | 165 000 (1450) | 70 000 | **~50 000** en 1492 [6] | CITY_POP (pero 165k es el pico de ~1300) |
| Firenze | 53 000 (1450) | 60 000 | **~37 000** (1427: 37 144 · 1459: 37 369) [2][9] | **ninguna** — ambas inflan |
| Bursa | 130 000 (1450) | 30 000 | **~35 000–45 000** (45k en 1487) [5] | CITY_POP |
| Paris | 150 000 (1450) | 100 000 | **~100 000** (150k es la cifra de 1500) [4] | CITY_POP |
| Núremberg | 6 000 (1400) | 25 000 | **~20 800** en 1450 [7] | CITY_POP (cities1444 = error) |
| Lyon | 8 000 (1400) | 25 000 | **~8 000–15 000** (el boom es post-1464) [8] | **cities1444** — CITY_POP es dato posterior |
| Trapani | 12 000 (1400) | 40 000 | **~10 000–12 000** (puerto pequeño) | **cities1444** — CITY_POP es absurdo |
| Venezia | 100 000 (1450) | 100 000 | **~100 000** [1] | ambas ✅ |
| Milano | 83 000 (1450) | 90 000 | **~90 000–100 000** [1] | ambas ✅ |

**El patrón (esto es lo importante para la regla):**

- **`cities1444` (Buringh/Chandler) infla las ciudades GRANDES** importando cifras de **pico
  (c.1300)** o de **1500** pese a la etiqueta "1450": Cairo 380k, Granada 165k (=pico ~1300, cuando
  Milán y Granada rozaban 150k [1]), Firenze 53k, Paris 150k (=la cifra de 1500 [4]), Bursa 130k,
  Tabriz 250k. Su campo "año" es inconsistente y **Chandler 1987 es notorio por inflar el Este y las
  ciudades-residencia** (Trakai 50k, Gorkij 55k, Târgoviște 40k son errores de geocodificación: eran
  villas de unos pocos miles).
- **`CITY_POP` (curada, objetivo ~1450) es mejor para las grandes en varios casos** (Cairo 200k,
  Granada 70k, Bursa 30k, Paris 100k) pero **arrastra el anacronismo inverso**: mete cifras del
  **XV tardío/XVI** en ciudades que en 1450 aún eran pequeñas (Lyon 25k, Trapani 40k) y también infla
  alguna (Firenze 60k).

Por eso NO sirve ni `max()` (elegiría Cairo 380k, Granada 165k, Firenze 60k, Trapani 40k — todo mal
por arriba) ni `min()` (elegiría Núremberg 6k — mal por abajo). **Hace falta verificación ciudad por
ciudad contra historiografía**, que es justo el trabajo de la Tanda B.

---

## 1. Regla de fuente única de verdad para el NÚCLEO URBANO

**La reconciliación no es una fórmula entre las dos tablas: es una jerarquía de fuentes.**

### Prioridad 1 — Cifra académica de ~1450 verificada (lo que produce la Tanda B)
Cuando un agente-región documenta la población de una ciudad para **c.1430–1460** con fuente A o B,
**esa cifra manda e ignora ambas tablas.** Es obligatorio para toda villa/ciudad que hoy pasa el
umbral urbano (encargo explícito de Sergio: *"mirar bien las históricas, sobre todo las que
consideramos villa/ciudad"*). Cada cifra se guarda con **año de la fuente, fuente y confianza**.

### Prioridad 2 — Sin cifra académica accesible: reconciliar las dos tablas (NUNCA con `max()`)
Reglas de desempate, en orden:

1. **Normaliza por AÑO.** El 5º campo de `cities1444` es dato: un valor fechado 1400 **no** es
   comparable con uno de 1450 (la mediana del salto 1450/1400 es ×1,6 según la propia cabecera). Si
   la ciudad claramente creció (imperial libre alemana, ciudad de feria) o decayó (textil flamenca
   hundida), ajusta hacia el año objetivo 1450 antes de comparar.
2. **Ante la duda, la cifra MENOR** — porque el sesgo documentado de la mayor es el pico c.1300 o la
   cifra de 1500. Excepción: si la menor está fechada 1400 y hay evidencia de crecimiento (Núremberg,
   Danzig, ciudades imperiales), gana la ~1450.
3. **Prefiere Buringh 2021 sobre Chandler 1987** cuando se puedan distinguir. Chandler infla el Este
   y las capitales-residencia pequeñas.
4. **Techo de cordura del Occidente latino en 1450.** Salvo las poquísimas metrópolis reales
   —Cairo ~150–200k (el único gigante), Paris/Venecia/Milán ~100k, Nápoles ~75–100k— **ninguna
   ciudad latina superaba los ~50 000 en 1450**. Constantinopla era una **ruina pre-1453 (~40–50k)**.
   Todo lo que pase de ~50k sin una fuente A es sospechoso y va marcado.
5. Marca **confianza baja** y deja rastro de qué tabla se tomó y por qué.

### Prioridad 3 — Ciudad sin dato en ninguna tabla
Modelo por región: núcleo = f(densidad regional), como ya hace el código para las no tabuladas
(`mapgen.js:767-772`). Es el suelo, no una cifra histórica.

### Veredictos de las discrepancias mayores (materia prima para la Tanda B)

> **### "Fustat 380000" (cities1444) vs "El Cairo 200000" (CITY_POP)**
> **Veredicto:** ❌ FALSO (380k) · 🟡 MATIZADO (200k, en el techo)
> **Fuentes:** André Raymond estima El Cairo a comienzos del s.XV en **150 000–200 000**, hundido
> desde su pico anterior; la peste de **833 H/1430 mató ~90 000** en la ciudad y la de 1460 otros
> ~70 000 [3]. Borsch sostiene que Egipto quedó **más devastado que Europa** (colapso del regadío)
> [10]. Para 1450, tras la peste de 1430, el núcleo estaba en el **suelo** de esa horquilla o por
> debajo: **~150 000**. Y "Fustat" es además un **anacronismo de nombre** (ver §4): en 1444 la
> ciudad era al-Qāhira/El Cairo; Fustat era ruina desde el s.XII.
> **Qué cambia:** el mayor núcleo del mapa baja de 380k a ~150–180k, y cambia de nombre.

> **### "Granada 165000" vs "Granada 70000"**
> **Veredicto:** ❌ FALSO (165k) · 🟡 MATIZADO (70k)
> **Fuentes:** la ciudad de Granada tenía **~50 000** en la conquista de 1492 (la población musulmana
> se cifra en "cincuenta mil almas") [6]. Los 165k confunden la **ciudad** con el **reino**
> (~250 000–300 000 hab.) [6], y 150k era su pico hacia 1300 [1]. Real ~1450: **~50 000**, quizá algo
> más en su apogeo nazarí de mediados de siglo, nunca 165k.
> **Qué cambia:** Granada deja de ser una de las 3 mayores de Europa; queda como gran ciudad ~50k.

> **### "Firenze 53000" vs "Florencia 60000"**
> **Veredicto:** ❌ FALSO las dos.
> **Fuentes:** Florencia estaba en su **mínimo histórico** a mediados del XV: **37 144 en 1427** (cita
> Malanima, ya en `artesano.md`), **37 369 en 1459**, **40 332 en 1469** [2][9]. Real ~1450:
> **~37 000**. Es el ejemplo canónico de que ninguna tabla sirve sola.
> **Qué cambia:** −40% en la mayor ciudad toscana. Cuidado: arrastra a Pisa/Siena/Lucca.

> **### "Bursa 130000" vs "Bursa 30000"**
> **Veredicto:** ❌ FALSO (130k) · 🟡 MATIZADO (30k, algo bajo)
> **Fuentes:** Bursa tenía **~45 000 en 1487** [5]. En 1450 algo menos: **~35 000–45 000**. 130k es
> imposible para la época.
> **Qué cambia:** la vieja capital otomana y entrepôt de la seda queda en ~40k.

> **### "Paris 150000" vs "Paris 100000"**
> **Veredicto:** 🟡 MATIZADO — gana 100k.
> **Fuentes:** París cayó a **~100 000 en 1422** por la peste, la guerra civil armañac-borgoñona y la
> Guerra de los Cien Años, y **solo recuperó los ~150 000 hacia 1500** [4]. La cifra de 150k de
> cities1444 es literalmente la de 1500 — justo lo que su propia cabecera prohíbe. Real ~1450 (recién
> salida de la ocupación inglesa, 1436): **~100 000**.
> **Qué cambia:** París ~100k, no 150k.

> **### "Núremberg 6000" (año 1400) vs "Núremberg 25000"**
> **Veredicto:** ❌ FALSO (6k) — gana ~21k.
> **Fuentes:** Núremberg tenía **~22 800 en 1431** y **~20 800 en 1450** (tras la peste de 1437 y las
> guerras) [7]. Los 6 000 de cities1444 son un **error** (ni siquiera un dato de 1400 defendible).
> Real ~1450: **~20 000–21 000**.
> **Qué cambia:** confirma que las cifras BAJAS de cities1444 para las grandes ciudades alemanas
> también fallan; no basta con "es de 1400".

> **### "Lyon 8000" (año 1400) vs "Lyon 25000"**
> **Veredicto:** 🟡 MATIZADO — gana ~8–15k para 1450.
> **Fuentes:** el despegue de Lyon es **posterior a 1450**: ferias en 1420 (2/año), 1464 (4/año,
> exentas de impuestos para atraer a los mercaderes de Ginebra), sederos milaneses desde 1466; el
> crecimiento real es de finales del XV y del XVI [8]. En 1450 Lyon aún era modesta: **~8 000–15 000**.
> Los 25k de CITY_POP son un dato del XV tardío/XVI.
> **Qué cambia:** ejemplo de que CITY_POP también mete anacronismos "hacia arriba".

> **### "Tabriz 250000" vs "Tabriz 40000"**
> **Veredicto:** ❓ NO CONCLUYENTE.
> **Fuentes:** Tabriz era la capital de los Qara Qoyunlu (r. 1400–68) y una gran metrópoli de la Ruta
> de la Seda, pero **no encontré cifra académica firme para ~1450** (las bases usadas apenas cubren
> Persia: 7 ciudades en todo el fichero). 250k parece alto y 40k bajo. Horquilla honesta: **~80 000–
> 200 000**, confianza baja. Que el agente de Cáucaso-Persia lo marque ❓ y no invente.

> **### "Edirne 85000" vs "Adrianópolis 22000"** y **### "Fez 125000" vs "Fez 55000"**
> **Veredicto:** ❓ NO CONCLUYENTE ambas.
> **Fuentes:** Edirne fue la **capital otomana en 1444** (1413–1453), floreciente — así que >22k es
> razonable, pero 85k parece alto (la propia cabecera dice "apenas despegaba"); horquilla **~30 000–
> 50 000**. Fez fue capital meriní en declive hacia el fin de la dinastía (Wattásidas ~1465); los 200k
> que circulan son el **pico del s.XII**; horquilla ~1450 **~40 000–80 000**. Ambas con confianza baja
> y a cargo de sus agentes-región (Balcanes-Bizancio y Magreb).

**Cierre de §1:** retirar `CITY_POP_RAW` y dejar `cities1444.js` **regenerado** como fuente única del
núcleo urbano (ver §3). El conflicto de dos tablas desaparece por construcción.

---

## 2. Horquillas de densidad regional ~1450 (para el campo sin dato)

**Esqueleto macro (cita dura).** Población por macrorregión en **1450**, en millones [1] (Russell
vía Cipolla, corroborado por Munro [2], que da el total de Europa en **51 M** frente a los 73,5 M de
1340):

| Macrorregión (1450) | Millones [1] | Área aprox. (km²) | Densidad media derivada (hab/km²) |
|---|---:|---:|---:|
| Italia (con islas) | 7,3 | ~300 000 | ~24 |
| Francia + Países Bajos | 12 | ~490 000 | ~24 (pero Flandes ≫ media) |
| Islas Británicas | 3 | ~315 000 | ~10 (Inglaterra sola ~17) |
| Iberia | 7 | ~580 000 | ~12 |
| Alemania + Escandinavia | 7,3 | ~1 150 000 | ~6 (Alemania sola ~16; Escandinavia ~1–3) |
| Grecia + Balcanes | 4,5 | ~550 000 | ~8 |
| Polonia-Lituania | 2 | ~800 000 | ~2,5 (Polonia core ~8; Lituania ~2) |
| Hungría (+ Bohemia) | 1,5 | ~450 000 | ~4 |
| Rusia | 6 | ~2 000 000+ | ~2–3 |

> **Aviso duro:** la media macro es AVERAGE de toda la macrorregión; la densidad **provincial** varía
> mucho dentro (núcleo denso vs periferia vacía). La horquilla de abajo refleja ese abanico interno.
> Inglaterra 1450 ≈ **2,25 M** [2] confirma el suelo de las Islas.

**Cómo se relaciona con el código.** Hoy `regionDensity()` (`mapgen.js:705`) da una densidad
"potencial" por caja lon/lat que luego se multiplica por **fertilidad de terreno** (`POP_TERR_FERT`,
0,1–1,5) y por **`POP_GAIN=0,62`** (palanca global). Es decir, la densidad EFECTIVA que aterriza en
una provincia ≈ `listada × 0,62 × fertilidad`. Las cifras "listadas" actuales son coherentes con [1]
una vez aplicado ese 0,62. **Recomendación:** que la Tanda B razone en **hab/km² EFECTIVOS** (lo que
de verdad cuenta la provincia) y dé una **horquilla min–max**, y que el pipeline reparta dentro de
ella (ver §3, reparto por área).

**Tabla de horquillas propuesta (hab/km² EFECTIVOS ~1450).** "Hoy" = valor listado en `POP_REGIONS`;
"efectivo hoy" ≈ ×0,62. La horquilla es lo que debe validar/ajustar cada agente-región con su fuente.

| Región del mapa | Hoy (listado) | Horquilla EFECTIVA propuesta | Fuente / fiab. |
|---|---:|---|---|
| Italia N (Po, Toscana, Lombardía) | 40 | **20–32** | [1][2] A/B — la más densa de Europa |
| Italia Centro-Sur | 24 | **10–18** | [1] B |
| Sicilia / Calabria | 22 | **8–16** | [1] B |
| Cerdeña | (fallback) | **4–8** | [1] B — muy vacía |
| Países Bajos / Flandes | 42 | **26–40** | [1][2] A/B — pico continental |
| Francia norte (cuenca de París) | 30 | **14–24** | [1][4] B — devastada por la guerra hasta 1436 |
| Francia sur / Occitania | 22 | **10–18** | [1] B |
| Renania / Alemania occ. | 27 | **14–22** | [1] B |
| Alemania sur / Baviera / Bohemia / Austria | 16 | **8–15** | [1] B |
| Alemania norte / Báltico | (16/9) | **5–10** | [1] B |
| Inglaterra sur + Gales | 21 | **10–18** | [2] A (Ingl. 2,25 M) |
| Inglaterra norte / Escocia / Irlanda | (fallback) | **2–7** | [2] A/B |
| Iberia sur (Andalucía, Murcia, Valencia) | 18 | **8–15** | [1] B |
| Iberia norte-centro (Meseta, Cataluña, Portugal N) | 12 | **4–10** (Meseta baja) | [1] B |
| Escandinavia meridional | 6 | **1,5–4** | [1] B |
| Escandinavia / Rusia septentrional (subártico) | 1,5 | **0,2–1,5** | [1] B |
| Polonia / Báltico sur | 9 | **3–8** | [1] B |
| Lituania / Rutenia | (5,5/fallback) | **1,5–4** | [1] B |
| Hungría / puszta | 16 | **3–8** | [1] B |
| Balcanes | 12 | **4–9** | [1] B |
| Grecia / Egeo / costa O de Anatolia | 17 | **5–12** | [1] B |
| Rus / Moscovia (zona forestal) | 5,5 | **1,5–4** | [1][2] B |
| Estepa póntica / Crimea | 3,5 | **0,5–3** | [1] B |
| **Anatolia interior** | 8 | **3–8** ❓ | fuente floja — marcar baja |
| **Levante costero / Siria** | 17 | **4–10** ❓ | fuente floja |
| **Mesopotamia (Tigris-Éufrates)** | 19 | **4–12** ❓ | fuente floja |
| **Egipto (valle y delta habitable)** | 46 | **25–55** ❓ | [10] C — hundido por peste+regadío, pero concentrado |
| **Magreb (franja del Tell)** | 12 | **3–10** ❓ | fuente floja |
| **Cáucaso / Persia** | (fallback) | **1,5–8** ❓ | fuente casi nula |
| **Arabia / desierto** | 2,5 | **0,1–2** ❓ | casi vacío |

> **Egipto** merece nota: la densidad del **habitable** (valle+delta, ~30–35 000 km²) es alta porque
> toda la población se apretuja ahí, pero Borsch [10] documenta que Egipto quedó **más despoblado que
> Europa** tras la peste (colapso del regadío). Los 46 de hoy son plausibles para la franja habitable
> *ya deprimida*; el desierto que la rodea va a ~0.

**Regla de reparto por área (para provincias sin dato claro).** Dentro de la horquilla de su región,
la densidad de cada provincia sin dato se fija **determinísticamente** por un hash de su posición
(como el `hashN(p.x,p.y)` que ya usa el código para el jitter, `mapgen.js:768`), interpolando entre
min y max y modulando por:
1. **Fertilidad del terreno** (`POP_TERR_FERT`, ya existe): vega/pradera arriba, montaña/desierto abajo.
2. **Costa** (+15%, ya existe: `p.coastal`).
3. **Área real** de la provincia en km² (ya existe: `pxAreaConst()×cos²(lat)`).

Así el reparto es **determinista** (mismo mundo para todos los jugadores, invariante del proyecto) y
**anclado a lo local** (ADR 0001): la provincia sale de su terreno y su comarca, no de una media
nacional. Total provincial = `densidad_efectiva × área_km² + núcleo_urbano` (con el `RURAL_CAP`
actual como tope de comarca).

---

## 3. Formato exacto del dataset estático (arquitectura)

**Requisito de Sergio:** el listado provincia→(nombre, pop) debe ser **estático y consultable**
(horneado), no calculado en carga. Y DRY, respetando ADR 0001 y "el pipeline pisa, la carga respeta".

### Arquitectura recomendada (la más limpia)

**A) `cities1444.js` = fuente ÚNICA del núcleo urbano.** Se **regenera** con las cifras verificadas de
la Tanda B y se **retira `CITY_POP_RAW`** de `mapgen.js` (borrar el bloque `mapgen.js:714-734` y su
uso en `mapgen.js:764`). El formato gana dos campos:

```
[nombre_canon, x, y, hab_1450, año_fuente, fuente_tag, confianza]
//  ej:  ["Cairo", 1256, 1737, 160000, 1450, "Raymond", "media"]
```

- `hab_1450`: la cifra reconciliada por §1, ya normalizada al año objetivo.
- `año_fuente`: el año real del dato (para auditoría; ya no se usa para elegir, porque ya está
  normalizado).
- `fuente_tag` + `confianza`: rastro de por qué (auditable; no lo lee el motor).

`assignPopulation` (`mapgen.js:764-766`) queda: `hist = p.cityPop>0 ? p.cityPop : (modelo por región)`.
Una sola tabla, sin `??` a una segunda.

**B) `official_map.js` índice 9 (`pop`) = TOTAL provincial HORNEADO.** El pipeline (un `tools/gen-pops.mjs`
nuevo) calcula una vez `pop = rural(densidad×área×fertilidad) + núcleo(cities1444)` para las 5 786
provincias de tierra y **escribe el número** en el índice 9 (hoy `null`). Al cargar, `assignPopulation`
ya **respeta** cualquier `p.pop!=null` (`mapgen.js:747`) → el valor horneado manda y no se recalcula.
Mar y páramo siguen a 0.

Esto cumple las tres cosas:
- **Estático y consultable:** el número vive en el snapshot, se puede abrir y leer.
- **Pipeline pisa / carga respeta:** el tool escribe; el juego solo lee (regla del roadmap).
- **DRY + local es la verdad:** una sola cifra por provincia, en la unidad fundamental (ADR 0001); no
  hay total nacional guardado, se suma de lo provincial.

**Por qué NO un `provpops.js` aparte:** duplicaría la clave (id de provincia) y obligaría a mantener
dos ficheros en sincronía con los índices de `official_map.js` — frágil y anti-DRY. El `pop` ya tiene
su hueco reservado (índice 9); usarlo es lo natural.

**Por qué mantener `cities1444.js` separado del `pop` horneado:** el núcleo urbano es un dato
**auditable y con fuente** que además alimenta otra mecánica (el umbral `CENTER_POP=25000` de los
centros de comercio, `design/mercado-centros-eu5.md`). Conviene tenerlo aparte del total provincial
(que mezcla campo). El pipeline los combina; el runtime lee el total horneado y, para el flag de
centro, el `cityPop`.

**Resumen del flujo:**
```
cities1444.js (núcleos verificados) ─┐
POP_REGIONS + horquillas (densidad) ─┼─► tools/gen-pops.mjs ─► escribe pop[9] en official_map.js
POP_TERR_FERT + área + costa        ─┘         (una vez)              (horneado, estático)
                                                                          │
                                          en carga: assignPopulation respeta pop!=null ─► seedStrata
```

---

## 4. Criterios de anacronismo de nombres para 1444

**Qué se considera anacrónico** (a corregir en `p.canon` y/o en `exonyms.js`):

1. **Topónimo posterior a 1444 en el CANON** — sobre todo nombres soviéticos/modernos. El exónimo ya
   traduce bien en varios casos, pero el **canon** (lo que guarda y ordena el mapa) debe ser el nombre
   vigente en 1444.
2. **Nombre de la POLÍTICA/era equivocada** — llamar a una ciudad por un topónimo muerto siglos antes
   (Fustat por El Cairo) o por uno que aún no existía (Istanbul por Constantinopla, pre-1453).
3. **No confundir con exónimo legítimo.** Los nombres clásicos/latinos que un europeo de 1444 SÍ usaba
   (Iconio por Konya, Cesarea, Nicea, Trebisonda, Andrinópolis) **no son anacrónicos**: son el exónimo
   de época y se quedan. El criterio es "¿lo habría dicho así alguien en 1444?", no "¿es el nombre
   moderno?".

**Ejemplos concretos ya detectados** (canon → corrección):

| Canon actual | Problema | Corrección 1444 | Exónimo (español) |
|---|---|---|---|
| **Fustat** (380k, 1256,1737) | Fustat era ruina desde el s.XII | `Cairo` / `al-Qahira` | El Cairo (ya en exonyms) |
| **Istanbul** | otomana solo desde 1453 | `Constantinople` | Constantinopla (ya) |
| **Kaliningrad** (936,723) | nombre soviético de 1946 | `Konigsberg` | Königsberg (ya) |
| **Gorkij** (55k, 1635,638) | nombre soviético 1932–90 | `Nizhny Novgorod` | (añadir exónimo) — y 55k es error |
| **Feodosija** (60k, 1378,1171) | nombre ruso moderno | `Caffa` (genovesa en 1444) | Kaffa (ya) |
| **Szczecin** (759,790) | forma polaca moderna | `Stettin` (pomerana/hanseática) | Stettin (ya) |
| **Astrakan** (1755,1116) | ciudad de la Horda | `Hajji Tarkhan` / `Astrakhan` | (revisar) |
| **Volgograd** (si aparece) | nombre soviético | `Tsaritsyn` no existía aún — probablemente no debe ser ciudad | — |
| **Târgoviște / Trakai** | no es nombre, es POP | (nombre OK) | — pop absurda: 40k y 50k → miles |

> Nota: para varias del Este el exónimo español **ya está bien** en `exonyms.js`; lo que falla es el
> **canon** (Kaliningrad, Gorkij, Feodosija, Szczecin, Istanbul, Fustat). El canon manda la ordenación
> y las claves, así que corregirlo importa aunque el jugador vea el exónimo.

**Regla operativa para la Tanda B:** al revisar cada ciudad, comprobar si su canon es (a) posterior a
1444, o (b) de era equivocada. Si sí, proponer el canon de 1444 **y** verificar que el exónimo español
existe en `exonyms.js` (si no, añadirlo). **No** tocar los exónimos clásicos legítimos.

---

## 5. Plan de partición para la Tanda B (~18 agentes-región)

Cada agente recibe una **caja lon/lat**, la **lista de entradas de `cities1444` + `CITY_POP` que caen
dentro**, y su **horquilla de densidad** (de §2). Entrega SIEMPRE el mismo formato (abajo), para que
las 18 salidas encajen sin fricción en el pipeline.

### Regiones (cerradas)

| # | Región | Caja aprox. (lon, lat) | Densidad urbana | Notas |
|---|---|---|---|---|
| 1 | Italia Norte | 7–14 E, 43,5–47 N | densísima | Po, Toscana, Lombardía, Emilia, Véneto. Verificar Firenze/Venezia/Milano |
| 2 | Italia Centro-Sur | 11–19 E, 38–43,5 N | media | Roma, Nápoles, Apulia. Ojo Nápoles ~75–100k |
| 3 | Sicilia + Cerdeña | 8–16 E, 36,5–40 N | media-baja | Trapani/Palermo — CITY_POP infla Trapani |
| 4 | Francia | −5–8 E, 43–51 N | media | Verificar Paris 100k, Lyon (pre-boom), Ruan, Tolosa, Burdeos |
| 5 | Países Bajos / Flandes | 2–7 E, 50–53,6 N | pico continental | Gante, Brujas, Amberes — textil en declive (ver artesano.md) |
| 6 | Islas Británicas | −11–2 E, 50–60 N | baja | Londres ~50k; resto pequeño. Inglaterra 2,25M [2] |
| 7 | Iberia Norte | −9–3,5 E, 40–43,6 N | baja | Meseta, Cataluña, Portugal N. Castilla = laguna (ver bibliografía) |
| 8 | Iberia Sur | −9–1 E, 35,5–40 N | media | **Granada ~50k, no 165k**; Sevilla, Córdoba, Valencia |
| 9 | HRE Renania + NO | 5–10,5 E, 47–53 N | media-alta | Colonia (la mayor alemana), Estrasburgo, Aquisgrán |
| 10 | HRE Sur + Bohemia | 8,5–17 E, 46–51 N | media | **Núremberg ~21k**, Augsburgo, Praga, Viena |
| 11 | HRE Norte / Báltico / Escandinavia S | 6–18 E, 53–60 N | baja | Lübeck, Hamburgo, Danzig(=Stettin/Gdansk), Copenhague, Estocolmo |
| 12 | Escandinavia N / subártico | 4–31 E, 60–66,5 N | mínima | Bergen, Nidaros. Casi vacío |
| 13 | Polonia-Lituania-Rutenia | 14,5–32 E, 48,5–60 N | baja | Cracovia, Vilna(→miles, no 50k Trakai), Leópolis. **Anacronismos: Kaliningrad** |
| 14 | Hungría + Balcanes | 14,5–29,5 E, 40–48,5 N | baja-media | Buda, Belgrado, Skopje, Ragusa. Târgoviște→miles |
| 15 | Grecia + Bizancio + Rumelia otomana | 19–29,5 E, 34,5–43 N | baja-media | **Constantinopla ruina ~40–50k**; **Edirne ❓ ~30–50k**; Salónica, Atenas |
| 16 | Anatolia + Cáucaso | 26–48 E, 36–42 N | baja ❓ | **Bursa ~40k**, Konya(=Iconio), **Tabriz ❓ 80–200k**, Trebisonda |
| 17 | Levante + Siria + Mesopotamia | 33,5–48 E, 29–37,5 N | baja-media ❓ | Damasco, Alepo, Bagdad, Jerusalén. Fuente floja |
| 18 | Egipto + Magreb | −11–34 E, 26–37,5 N | Nilo alto ❓ | **El Cairo(=Fustat) ~150–180k**, Alejandría, **Fez ❓ 40–80k**, Túnez, Tremecén |

*(Rus-Moscovia queda repartida entre 12/13; la estepa póntica/Crimea entre 13/16 según longitud. Si
el volumen lo pide, sepárense en un agente 19.)*

**Reparto del trabajo (materia prima):** ~526 ciudades sembradas y ~57 centros ≥25k
(`design/mercado-centros-eu5.md`). La carga NO es uniforme: regiones 1, 4, 5, 9, 10 concentran el
grueso de las urbes europeas; 12, 16, 17, 18 tienen poquísimas ciudades pero la **fuente más floja**
(ahí el trabajo es marcar ❓ con honradez, no producir cifras). Un reparto ~equilibrado por *esfuerzo*
agrupa Occidente denso en más agentes y deja el Este con agentes de menos ciudades pero más
incertidumbre.

### Formato de salida uniforme de cada agente-región

```markdown
## Región N — [nombre]

### Núcleos urbanos verificados
| Canon 1444 | x | y | hab ~1450 | año fuente | fuente [ref] | fiab. | veredicto vs tablas |
|---|---:|---:|---:|---:|---|---|---|
| Cairo | 1256 | 1737 | 160000 | 1450 | Raymond [3] | C | ❌ 380k / 🟡 200k |
...

### Densidad rural (horquilla EFECTIVA hab/km²)
| Subzona | min | max | fuente [ref] | fiab. |
...

### Anacronismos de nombre
| Canon actual | → Canon 1444 | Exónimo (existe? / añadir) | motivo |
...

### Fuentes de la región
[ref] Autor, Obra, año, pp. — enlace. Qué sostiene. Fiabilidad A/B/C/D.
```

Los `[ref]` son **locales a cada salida de región** (numeración propia, como los `_fuentes-*.md` de
las fichas de época) — **no** se fusionan ni renumeran al integrarlas.

---

## Fuentes de este método

**Escala:** A = abierta y académica (cita dura) · B = abierta, no arbitrada · C = solo resumen de
buscador · D = no abierta (deuda). Ninguna cita es de memoria.

- **[1] J. C. Russell, en C. M. Cipolla (ed.), *The Fontana Economic History of Europe*, vol. I** (1972),
  vía Fordham Medieval Sourcebook — <https://sourcebooks.fordham.edu/source/pop-in-eur.asp>. Tabla de
  población europea por macrorregión 1340/1450 (millones): Italia 7,3 · Iberia 7 · Francia+PP.BB. 12 ·
  Islas Británicas 3 · Alemania+Escandinavia 7,3 · Grecia/Balcanes 4,5 · Polonia-Lituania 2 · Rusia 6 ·
  Hungría 1,5; total 50 M. El propio autor las llama "quite speculative". **Fiab. B** (página abierta
  en sesión; el autor advierte que no hay censos hasta el s.XVIII).
- **[2] John Munro, *Medieval Population Dynamics to 1500*, Univ. of Toronto** (apuntes de curso) —
  <https://www.economics.utoronto.ca/munro5/L02MedievalPopulationC.pdf> (extraído con `pdftotext -layout`).
  Total Europa 1450 = **51 M** (vs 73,5 en 1340); Inglaterra **~2,25 M** hacia 1379–1450; serie de
  Florencia (Russell/de Vries): 1300=120 000 · 1427=**37 144** · 1459=**37 369** · 1469=40 332 · 1488=42 000.
  Reparto Mediterráneo 19 / Centro-Oeste 22,5 / Este 9,5 M en 1450. **Fiab. A** (PDF académico extraído
  y leído; el más sólido de la lista).
- **[3] André Raymond sobre El Cairo mameluco** (vía resumen de buscador y estudios de mortalidad por
  peste de Cairo, Project MUSE / ResearchGate) — El Cairo a comienzos del s.XV en **150 000–200 000**;
  peste de 1430 ~90 000 muertos, la de 1460 ~70 000. **Fiab. C** (solo resúmenes; Raymond no abierto —
  deuda D pendiente de abrir su *Cairo* directamente).
- **[4] *Paris in the Middle Ages* (Wikipedia) y demografía parisina** —
  <https://en.wikipedia.org/wiki/Paris_in_the_Middle_Ages>. París cae a **~100 000 en 1422** (peste +
  guerra armañac-borgoñona + Cien Años); recupera **~150 000 hacia 1500**. 1328: ~61 000 hogares →
  220 000–270 000. **Fiab. B**.
- **[5] *Bursa* (Wikipedia/Britannica)** — <https://en.wikipedia.org/wiki/Bursa>. Población **45 000 en
  1487**; centro sedero otomano. **Fiab. B**.
- **[6] *Emirate of Granada* (Wikipedia) y crónicas de la conquista** —
  <https://en.wikipedia.org/wiki/Emirate_of_Granada>. Ciudad de Granada **~50 000 en 1492** ("cincuenta
  mil almas" musulmanas); el **reino** ~250 000–300 000 (no confundir con la ciudad). **Fiab. B**.
- **[7] *Free Imperial City of Nuremberg* (Wikipedia)** —
  <https://en.wikipedia.org/wiki/Free_Imperial_City_of_Nuremberg>. **22 800 en 1431 · 20 800 en 1450**
  (peste de 1437 + guerras); ~20 000 hacia 1493, solo Colonia mayor en la región. **Fiab. B**.
- **[8] *Timeline of Lyon / History of Lyon* (Wikipedia) y estudios de las ferias** —
  <https://en.wikipedia.org/wiki/History_of_Lyon>. Ferias en 1420 (2/año), 1464 (4/año, exentas); el
  despegue demográfico es de finales del XV–XVI. En 1450, aún modesta. **Fiab. B**.
- **[9] Malanima, vía la ficha `design/epoca/artesano.md` [2]** — Florencia **37 144 en 1427** (mínimo
  histórico, 31 % del máximo medieval). Coincide con [2]. **Fiab. A** (así marcada en la ficha).
- **[10] Stuart Borsch, *Plague Depopulation and Irrigation Decay in Medieval Egypt*, Project MUSE**
  (y *The Black Death in Egypt and England*) — <https://muse.jhu.edu/pub/306/article/758487>. Egipto
  quedó **más despoblado que Europa** por el colapso del regadío tras la peste. **Fiab. C** (solo
  resumen; PDF no abierto — deuda D).
- **[11] `cities1444.js` (cabecera) — Buringh 2021 (DANS, CC0) + Bosker/Buringh/van Zanden 2013
  (Harvard Dataverse) + Chandler 1987 geocodificado.** La base del dataset actual. Su propia cabecera
  avisa de no usar cifras de 1500 y del sesgo europeo (Persia 7 ciudades, Levante 4). **Fiab. B/D**
  (dataset citado, no reauditado en sesión).

### Deudas declaradas (lo que mejoraría el método si se abre)
- **André Raymond, *Le Caire des janissaires* / *Cairo* (trad.)** — para cerrar El Cairo mameluco con
  cita A en vez de C.
- **Stuart Borsch, *The Black Death in Egypt and England* (2005)** — para la densidad del Nilo con
  aparato, no resumen.
- **Bairoch/Batou/Chèvre, *La population des villes européennes 800–1850* (1988)** — la referencia de
  ciudad europea; hoy solo se cita vía fuente secundaria (ver `_fuentes-artesano.md`).
- **Ö. L. Barkan / defters otomanos** — para Bursa, Edirne, Anatolia con censo fiscal en vez de
  Wikipedia. Es lo que convertiría las ❓ del Este en cifras defendibles.
- **Historiografía persa (Tabriz, Soltaniyeh)** — la mayor laguna: sin fuente accesible, las cifras
  del Este iranio son horquillas anchas, no datos.
```
