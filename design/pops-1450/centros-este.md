# Centros de comercio del ESTE — dictamen del Cronista, c. 1444

> **Encargo:** ampliar `CURATED_HUBS` (Capa 2 del mercado, `hubOf`) hacia el Este para que Moscú
> (1202 provincias) y Lübeck (996) no engullan todo el Báltico/Rusia, **sin forzar**: solo entran
> entrepôts comerciales reales de ~1450. Donde una ciudad genuinamente comercial esté a pop 0 o
> infravalorada, se propone un `cityPop` defendible con fuente (nunca `max()`).
> **No toco código.** Esto es recomendación; Sergio aprueba y aplica.
> **Método:** `design/pops-1450-metodo.md` (jerarquía de fuentes, "Este al alto del rango honesto").
> Las cifras de población vienen de mis fichas `region-13/19/11/16.md`; la FUNCIÓN comercial (el eje
> del encargo) la fundamento con fuentes abiertas en esta sesión (dos tesis doctorales CEU, grado A).

---

## 0. CORRECCIÓN AL ENCARGO (el Cronista contradice cuando el dato lo exige)

**La premisa "Nóvgorod = 0" es falsa contra el dataset vivo.** `cities1444.js` línea 33 tiene hoy:

```
["Novgorod",1257,517,40000,1450,"C"]
```

Es **mi propia reconstrucción de la Tanda B** (`region-13.md`: rango honesto 25–50k, tomé 40k al
alto). **40 000 ≥ CENTER_POP (25 000) → Nóvgorod YA ES CENTRO por población**, sin necesidad de
curarlo. El `.bak` pre-reconstrucción lo tenía a **60 000** (Chandler inflado) — también centro. **En
ninguna versión estuvo a 0.**

Lo mismo con **Saray**: el encargo lo da a "0/<5k"; el archivo lo tiene a **10 000** (`region-19.md`,
línea 152). También está.

**Qué significa esto (importante, es un aviso de código, no lo arreglo yo):** si en la topología que
generó "Moscú 1202 / Lübeck 996" Nóvgorod **no** aparece recortando su cuenca del NO, entonces el
problema **no es que falte el hub, es que su `cityPop` de 40k no está llegando a `hubSeeds()`**
(`mapgen.js:1229` lee `p.cityPop`). Causas candidatas a verificar ANTES de tocar la lista curada:
(a) la topología se corrió contra un snapshot viejo (el `.bak`, o `official_map.js` con `pop[9]`
horneado stale); (b) la entrada de Nóvgorod no engancha a una provincia de tierra por
geocodificación (coordenada 1257,517 cayendo en agua o en una provincia ya ocupada por otra ciudad);
(c) `seedCities()` no se re-ejecutó. **Añadir Nóvgorod a `CURATED_HUBS` enmascararía el bug en vez de
arreglarlo** (aunque como es idempotente con la regla de población, no haría daño — Roma y Köln ya
están en la lista "por robustez"). Recomiendo: confirmar que Nóvgorod sale como centro en la vista
Centros ANTES de dar por bueno el resto.

---

## 1. Tabla de veredictos (compacta)

**Leyenda:** A = centro por población (≥25k, ya lo es) · B = curada por función (entrepôt real <25k)
· C = fuera (no era entrepôt de 1444, o su función la cubre un vecino ya propuesto).
`cityPop` en **negrita** = cambio propuesto; el resto ya está en el dataset.

| Ciudad | Veredicto | cityPop 1450 | Fuente (1 línea) |
|---|---|---:|---|
| **Nóvgorod** | **A (ya centro)** | 40 000 (existe) | Kontor hanseático de Peterhof (pieles/cera); rep. mercantil hasta 1478. Ya ≥25k [3][región-13] |
| Caffa | A (ya centro) | 55 000 (existe) | Gran entrepôt genovés del mar Negro [región-19] |
| Moscú | A (ya centro) | 35 000 (existe) | [región-19] |
| **Lviv (Lwów)** | **B** | **10 000** (hoy 0) | **Staple reforzado por carta de Vladislao III en jul. 1444**; eje Caffa→Lwów→Kraków (Via Tartarica) [1] A |
| **Danzig (Gdansk)** | **B** | 20 000 (existe) | Primer entrepôt de grano/madera del Báltico (Vístula→Brujas) [región-13][3] |
| **Riga** | **B** | 8 000 (existe) | Cabeza de la Hansa livonia; boca del Dvina hacia el interior ruso [3] |
| **Reval (Tallinn)** | **B** | **6 000** (hoy 0) | Puerta hanseática Báltico↔Nóvgorod (viajaba 2×/año a Peterhof) [3] |
| **Pskov** | **B** | 20 000 (existe) | Rep. mercantil; terminal ruso occidental hacia Livonia [3] |
| **Smolensk** | **B** | 18 000 (existe) | Tránsito del alto Dniéper: corredor Moscú↔Lituania↔Dvina/Riga [región-19][3] |
| **Kazán** | **B** | 7 000 (existe) | Entrepôt del Volga medio (feria de Markiz/bazar Taşayaq); heredera de la Bulgaria del Volga [6] |
| **Astracán (Hajji Tarkhan)** | **B** | 6 000 (existe) | Volga bajo: puerta Caspio↔Persia↔Asia Central [7] |
| **Tana (Azov)** | **B** | **5 000** (hoy 0) | Factoría veneciana/genovesa del Don; recuperada tras Timur, comercio ↑1405–1450 [2] A |
| **Trebisonda** | **B** | 8 000 (existe) | Terminal póntica de la ruta de la seda de Tabriz [región-16] |
| Königsberg | C | 8 000 (existe) | Puerto teut. secundario; capital de la Orden solo desde 1457; lo cubre Danzig |
| Elbing (Elbląg) | C | 5 000 (existe) | 2ª de Prusia a la sombra de Danzig |
| Dorpat (Tartu) | C | 0 | Hansa livonia secundaria; su corredor lo anclan Reval+Pskov |
| Vilna (Vilnius) | C | 10 000 (existe) | CAPITAL (excluida por regla); entrepôt aún emergente en 1444 |
| Polotsk | C | 5 000 (existe) | Plaza fluvial del Dvina secundaria; la cubre Riga+Smolensk |
| Saray | C | 10 000 (existe) | Capital de la Horda **arrasada por Timur 1395**, ciudad-sombra; función migrada a Astracán/Kazán |
| Kiev | C | 0 | Villa fronteriza lituana decaída en 1444; la ruta del Dniéper estaba muerta; auge comercial post-1550 |

**Resumen:** 3 ya-centros (Nóvgorod, Caffa, Moscú) + **10 curadas nuevas** por función. Ninguna es
capital metida de tapadillo; todas tienen función de entrepôt documentada. 7 cierres (C) por
conservadurismo o por ser sombra histórica.

---

## 2. Las 10 curadas, por corredor (justificación y fuente)

### A) Báltico hanseático — cierra la cuenca de Lübeck (996 prov.)
- **Danzig (Gdansk), 20k [B].** El mayor entrepôt del Báltico oriental en el s.XV: **staple del grano
  polaco** por la Vístula reexportado a Brujas y Flandes, más madera, potasa y cereal. Su función no
  admite discusión; que su núcleo (~20k en 1450, pico 70k en 1650 [región-13]) no llegue a 25k es
  irrelevante para un centro por FUNCIÓN. **Sin cambio de pop.**
- **Riga, 8k [B].** Cabeza de la **Hansa livonia** y boca del Dvina (Düna), la vía de agua que
  penetra hacia Polotsk–Vítebsk–Smolensk. Uno de los cuatro socios que comerciaban con Nóvgorod [3].
  **Sin cambio de pop.**
- **Reval (Tallinn), 0 → 6k [B].** Puerto hanseático que era **la puerta del comercio con Nóvgorod**:
  "mercaderes de Lübeck, **Reval**, Riga y Dorpat viajaban dos veces al año a Nóvgorod" [3]. Hoy a
  pop 0: propongo **cityPop 6 000** (media villa hanseática báltica, coherente con Riga 8k) para que
  además sea plaza local (Capa 1, ≥`CITY_MIN`). Canon 1444 = **Reval** (no Tallinn). Ancla el golfo
  de Finlandia. *Coordenada (x,y) a geocodificar (Tallin ≈ 59,4 N 24,7 E; al N de Riga 1043,605).*

### B) Rusia occidental / repúblicas — parte la cuenca de Moscú por el NO y el Dniéper
- **Pskov, 20k [B].** República mercantil, "hermana menor" de Nóvgorod; terminal occidental del
  comercio ruso hacia Livonia (lino, cera). Tras la caída de Nóvgorod (1478) Moscú **reencaminó su
  comercio por Pskov, Narva, Dorpat y Smolensk** [3] — prueba de su papel de nodo. **Sin cambio.**
- **Smolensk, 18k [B].** Fortaleza del alto Dniéper en el **corredor de tránsito Moscú↔Lituania↔Dvina
  (Riga)**; mayor villa de la Lituania del s.XV [región-19]. Ancla el hueco entre Moscú y Cracovia.
  **Sin cambio.**

### C) Rutenia y mar Negro overland — el hueco más grande del SO (LA adición clave)
- **Lviv (Lwów), 0 → 10k [B, y la mejor fundada].** Es el entrepôt del Este peor representado en el
  dataset (pop 0) y el más importante: la **ciudad-staple del comercio terrestre entre el mar Negro y
  Centroeuropa**. La ruta era **Caffa → Lwów → Kraków / Torun** (la *Via Tartarica*), documentada por
  los notarios genoveses ("se puede trazar una conexión directa de Caffa a Lwów y de ahí a Kraków",
  desde 1376 con la familia armenia Sirkis) [1]. Y — dato de oro para nuestra fecha exacta — el
  **staple de Lwów fue reforzado por carta de Vladislao III el 16 de julio de 1444**, meses antes de
  Varna, obligando a todos los mercaderes (Italianos incluidos) a ofrecer allí su mercancía salvo la
  destinada "trans mare"; en 1460 obtuvo el **staple completo**, "el punto de referencia primero de
  todo el comercio que iba y venía del Este a través de territorio polaco" [1]. **Propongo cityPop
  10 000** (Kraków, la mayor de Polonia, era solo ~12–14k en 1340–1444 [1]; Lwów algo menor pero
  cabeza del comercio oriental → 10k al alto del rango honesto, confianza C en la cifra, A en la
  función). *Coordenada a geocodificar (Lwów ≈ 49,8 N 24,0 E; al SE de Kraków 921,951).*

### D) Volga — parte la cuenca de Moscú por el este
- **Kazán, 7k [B].** Entrepôt naciente del **Volga medio**: la feria de la isla de Markiz y el bazar
  Taşayaq, heredera de la "Ruta de las Pieles" de la Bulgaria del Volga; capital kanal desde 1438 [6].
  Ancla el Volga medio frente a Moscú. **Sin cambio.**
- **Astracán (Hajji Tarkhan), 6k [B].** Entrepôt del **Volga bajo**, cruce de las rutas Volga↔Caspio↔
  Persia/India/Asia Central; los viajeros anotan mercaderes rusos, tártaros, persas y centroasiáticos
  [7]. Capital kanal solo desde 1459, pero plaza mercantil de la Horda ya en 1444. Ancla el Volga
  bajo. **Sin cambio.**

### E) Don / mar de Azov y sur del mar Negro
- **Tana (Azov), 0 → 5k [B, grado A en la función].** Factoría **veneciana y genovesa** en la boca
  del Don, "el emporio más lejano de todo el sistema colonial veneciano" y la **puerta de los
  géneros de la ruta de la seda vía Saray y Astracán** [2][5]. Arrasada por Timur en 1395 pero
  **reconstruida y en recuperación en el s.XV**: Khvalkov documenta que "el s.XV comenzó con la
  recuperación de la crisis y el crecimiento de la dinámica comercial" y que **el comercio creció de
  1405 a 1450** (grano, cera, pescado, caviar, seda, esclavos) [2]. Veneciana hasta la toma otomana
  de 1475. Hoy a pop 0: propongo **cityPop 5 000** (declinante y pequeña, confianza C). Canon 1444 =
  **Tana**. Ancla el Don/mar de Azov. *Coordenada a geocodificar (Azov ≈ 47,1 N 39,4 E; al NE de
  Caffa 1378,1171).*
- **Trebisonda, 8k [B].** Capital del Imperio de Trebisonda y **terminal póntica de la ruta de la
  seda de Tabriz** (el eje Trebisonda–Tabriz) [región-16]. Núcleo pequeño (Pero Tafur cuenta ~4.000
  en 1437; tomé 8k con arrabales), pero entrepôt genuino de largo alcance. Al sur del mar Negro; el
  encargo la pedía "si aplica" — aplica. **Sin cambio.**

---

## 3. Los siete cierres (C) y por qué NO forzar

- **Königsberg (8k).** Puerto teutónico del ámbar, pero **secundario a Danzig** (~140 km al este) y
  capital de la Orden solo desde 1457 (hasta entonces Marienburg). Su corredor lo cubre Danzig. *Si*
  la cuenca de Danzig resultara demasiado grande hacia el Niemen/Kaunas, Königsberg sería el primer
  candidato a reconsiderar.
- **Elbing (5k).** 2ª de Prusia, a la sombra de Danzig en la laguna del Vístula. Cubierta.
- **Dorpat (Tartu), 0.** Miembro real de la Hansa livonia en la ruta a Pskov/Nóvgorod [3], pero
  secundario a Reval/Riga; su función la anclan Reval + Pskov. Conservador → fuera. *Es el candidato
  a ancla livonia interior si se quiere una más.*
- **Vilna (10k).** **Capital de Lituania → excluida por la regla** ("la capital no cuenta por serlo").
  Como entrepôt puro aún emergía en 1444 (su peso comercial es del s.XVI). *Si el triángulo
  Kraków–Riga–Smolensk deja un hueco central lituano demasiado grande, Vilna es el menos-malo.*
- **Polotsk (5k).** Plaza del Dvina (cera/pieles hacia Riga) pero secundaria; la cubren Riga (aguas
  abajo) y Smolensk. Fuera.
- **Saray (10k).** Vieja capital de la Horda de Oro **arrasada por Timur en 1395**; en 1444
  ciudad-sombra, con la función migrada a Astracán (abajo) y Kazán (arriba) [región-19]. **La verdad
  incómoda: el Volga medio-bajo no tenía un gran entrepôt vivo en 1444 salvo esos dos; el vacío es
  real.** Mantiene sus 10k como villa, no como hub.
- **Kiev, 0.** La gran capital de la Rus, pero en 1444 **villa fronteriza lituana decaída**, en la
  zona de razzias tártaras; la ruta del Dniéper ("de los varegos a los griegos") llevaba siglos
  muerta y su renacimiento comercial es del s.XVI–XVII. Fuera como hub. *Merecería una pop de villa
  modesta por realismo, pero no es centro.* **El vacío del Dniéper medio es históricamente honesto.**

---

## 4. Qué aplicar (resumen operativo para Sergio — NO lo aplico yo)

**a) `CURATED_HUBS` (`config.js:360`) — añadir 10** (usar el nombre EXACTO del canon en
`cities1444.js`, que es lo que `hubSeeds()` casa por `norm(cityName)`):

```
"Gdansk","Lviv","Riga","Reval","Pskov","Smolensk","Kazan","Hajji Tarkhan","Tana","Trebisonda"
```

> ⚠ Dos avisos de casado: (1) `region-13.md` recomendó cambiar el **canon** Gdansk→**Danzig**; si se
> aplica ese cambio, la entrada curada debe seguir al canon (poner la que quede en `cities1444.js`).
> (2) Astracán está en el dataset como **"Hajji Tarkhan"**: la curada debe decir eso, no "Astrakan".

**b) `cities1444.js` — 3 entradas NUEVAS** (hoy a pop 0), formato `[canon,x,y,hab,año,conf]`, con
`(x,y)` **a geocodificar** por el gazetteer (no invento coordenada):

```
["Lviv",  <x>,<y>, 10000, 1450, "C"]   // ~49,8N 24,0E — SE de Kraków
["Reval", <x>,<y>,  6000, 1450, "C"]   // ~59,4N 24,7E — N de Riga
["Tana",  <x>,<y>,  5000, 1450, "C"]   // ~47,1N 39,4E — NE de Caffa
```

Las tres a `CITY_MIN=5000` o más → serán además **plaza local** (Capa 1), coherente con su función.
Ninguna otra ciudad cambia de población: las 7 curadas restantes ya están en el dataset con su cifra.

**c) Verificar PRIMERO** (§0): que Nóvgorod (40k) sale como centro en la vista Centros. Si no, hay un
bug de seedeo/geocodificación de `cityPop`, no un hub que falte.

---

## 5. Fuentes

**Escala:** A = abierta y académica (cita dura, abierta y extraída esta sesión) · B = abierta, no
arbitrada · C = solo resumen de buscador · D = no abierta. Ninguna cita es de memoria. Las cifras de
población provienen de mis fichas de región (que llevan su propia lista); aquí numero solo las
fuentes de FUNCIÓN comercial abiertas para este dictamen.

- **[1] Leslie Carr-Riegel, *Italian Traders in Poland 1300–1500*, tesis doctoral, Central European
  University, 2021** — <https://www.etd.ceu.edu/2021/carr-riegel_leslie.pdf> (PDF descargado con
  `curl` y extraído con `pdftotext -layout`, 28.091 líneas). Sostiene: conexión directa **Caffa →
  Lwów → Kraków** por la *Via Tartarica* desde 1376 (familia armenia Sirkis, con propiedad en Caffa);
  **staple de Lwów reforzado por carta de Vladislao III el 16 de julio de 1444** (obligaba a todos
  los mercaderes salvo los "trans mare vendendo"); **staple completo en 1460** = "the premier point
  of reference for all trade travelling to and from the East through Polish territory". Kraków, la
  mayor de Polonia, **~12.000 en 1340 (13–14k con Kazimierz), ~15.000 en 1500** (Russell; Carter,
  *Trade*). **Fiab. A** (tesis doctoral abierta y extraída; cita literal verificada en el texto).
- **[2] Ievgen Khvalkov, *Tana, a Venetian and Genoese Black Sea Trading Station in the 1430s*, tesis
  doctoral, Central European University, 2011** — <https://www.etd.ceu.edu/2011/khvalkov_ievgen.pdf>
  (descargado y extraído, 8.919 líneas). Sostiene: Tana, "el emporio más lejano de todo el sistema
  colonial veneciano"; tras la crisis (Timur 1395) **"el s.XV comenzó con la recuperación de la
  crisis y el crecimiento de la dinámica comercial"**; **el comercio creció de 1405 a 1450** (medido
  por las tasas de subasta); géneros: grano, cera, pescado, caviar, seda, esclavos. **Fiab. A** (tesis
  doctoral abierta y extraída).
- **[3] Función hanseática oriental (Kontor de Peterhof en Nóvgorod; Reval/Riga/Dorpat)** — síntesis
  de World History Encyclopedia, Britannica, hanse.org y Wikipedia vía WebSearch. "Mercaderes de
  Lübeck, **Reval, Riga y Dorpat** viajaban dos veces al año (verano e invierno) a Nóvgorod";
  Peterhof bajo jurisdicción propia; Nóvgorod surtía **pieles, cera y miel** y recibía plata y paño
  flamenco; tras 1478 Moscú reencaminó el comercio por **Pskov, Narva, Dorpat y Smolensk**; el Yard
  alemán cerró en 1494. **Fiab. C** (solo resúmenes de buscador; corrobora historiografía hanseática
  establecida — la cita dura sería Dollinger, *La Hanse*, **deuda D**).
- **[4] Lviv como cruce de rutas** — Encyclopedia.com ("Lviv, Polish Lwów…") y *Encyclopedia of
  Ukraine* vía WebSearch. Lwów "en la intersección de rutas que unían el Báltico con el mar Negro y
  Cracovia con Kiev"; diásporas armenia y alemana; sucursal de un mercader judío de Caffa abierta en
  Lwów en 1442. **Fiab. C** (resúmenes; corrobora [1], que es la cita dura).
- **[5] Tana/Azov, contexto de la ruta de la seda** — Grokipedia/Wikipedia (*Genoese Gazaria*,
  *Azov*, *Tanais*) vía WebSearch. Sack de Timur 1395; reconstrucción bajo la Horda; **puerta de los
  géneros de la ruta de la seda vía Saray y Astracán**; incorporación otomana 1475. **Fiab. C**
  (resúmenes; la cita dura es [2]).
- **[6] Kazán / Bulgaria del Volga** — Wikipedia (*Khanate of Kazan*, *Volga Bulgaria*) vía
  WebSearch. **Bazar Taşayaq en Kazán y feria de la isla de Markiz en el Volga**; control de la "Ruta
  de las Pieles" entre Asia Central y el norte de Europa; kanato fundado por Ulugh Muhammad en 1438.
  **Fiab. C**.
- **[7] Astracán / Hajji Tarkhan** — Encyclopedia.com (*Astrakhan, Khanate of*), Wikipedia
  (*Xacitarxan*) vía WebSearch. En la ruta de caravanas Este↔Oeste; **cruce de Rusia con Persia,
  India y Asia Central**; presencia de mercaderes rusos, tártaros, persas, transcaucásicos y
  centroasiáticos. **Fiab. C**.

**Referencias cruzadas a mis fichas** (llevan su propia numeración de fuentes, no se fusiona):
`design/pops-1450/region-13.md` (Nóvgorod, Danzig, Pskov, Riga, Vilna, Polotsk, Königsberg, Elbing),
`region-19.md` (Caffa, Moscú, Smolensk, Saray, Kazán, Astracán), `region-16.md` (Trebisonda),
`region-11.md` (Báltico hanseático occidental), y `design/pops-1450-metodo.md` (jerarquía de fuentes,
techo de cordura, "Este al alto del rango honesto").

### Deudas declaradas (elevarían C→A si se abren)
- **Philippe Dollinger, *La Hanse (XIIe–XVIIe siècles)*** — la cita dura para Reval/Riga/Dorpat y el
  Kontor de Peterhof (hoy sostenidos por [3], resumen de buscador).
- **M. Małowist**, *Kaffa – kolonia genueńska…* (ya citado por Carr-Riegel [1]) y **S. Karpov** sobre
  el comercio ítalo-póntico — para Tana/Caffa con aparato ruso-italiano.
- **Bairoch/Batou/Chèvre, *La population des villes européennes 800–1850*** — para una cifra dura de
  Lwów y Reval en vez de la estimación por comparanda con Kraków.
</content>
</invoke>
