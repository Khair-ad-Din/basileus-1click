# Región 14 — Hungría y Balcanes

> **Caja:** lon 14,5–29,5 E · lat 40–48,5 N. Cubre la cuenca panónica (Hungría/Alföld),
> Transilvania, Serbia, la Bulgaria noroccidental/Macedonia (Rumelia otomana), Valaquia y el
> ángulo NE de Moldavia. **Zona de fuente FLOJA** (Europa del Este, poco cubierta por Buringh/
> Chandler): decisión de Sergio para esta región → ante horquilla ancha, **tirar al alto del rango
> honesto**, marcando confianza C/D con honradez. Ninguna cifra dura sin fuente.
> **Dato más sólido de la región:** el defter otomano de Skopje (1467/68). El resto son estimaciones
> con confianza baja.

### Núcleos urbanos verificados

| Canon 1444 | x | y | hab ~1450 | año fuente | fuente [ref] | fiab. | veredicto vs tablas |
|---|---:|---:|---:|---:|---|---|---|
| Buda | 893 | 1066 | 12 000 | ~1500 | [1] | B | 🟡 8k (bajo) / 🟡 20k (=aglomeración, no núcleo) |
| Belgrade (Nándorfehérvár) | 936 | 1180 | 20 000 | ~1400 | [2] | C | 🟡 30k (alto): 50k es pico del Despotado, no 1444 |
| Skopje (Üsküb) | 964 | 1297 | 5 000 | 1467/68 | [3] | B | ❌ 30k (=cifra del s.XVII); defter ~914 casas → ~4,6k |
| Brasov (Kronstadt) | 1088 | 1146 | 10 000 | s.XV | [4] | C | 🟡 11k (algo alto pero plausible) |
| Nis (Niš) | 978 | 1243 | 7 000 | — | [2][5] | D | 🟡 15k (alto): fortaleza-villa del Morava |
| Suceava | 1109 | 1059 | 8 000 | s.XV | [6] | D | 🟡 9k (residencia-capital, prob. algo inflada) |
| Târgoviște | 1084 | 1176 | 8 000 | s.XV | [7] | C | ❌ 40k (error Chandler de capital-residencia) |
| Prizren | 943 | 1287 | 7 500 | — | [5] | D | 🟡 7k OK (villa serbia mediana) |
| Cluj (Kolozsvár) | 1029 | 1097 | 6 000 | — | [4] | D | 🟡 5k OK (villa sajona/húngara mediana) |
| Banská Štiavnica (Selmecbánya) | 890 | 1022 | 6 000 | s.XV | [8] | D | 🟡 5k OK (villa minera de plata) |
| Shumen | 1127 | 1245 | 4 000 | — | [5] | D | 🟡 5k algo alto (villa búlgara menor) |

**Notas de reconciliación (§1):**
- **Skopje** es la corrección más dura de la región y la mejor fundada: el defter otomano de 1467/68
  registra 637 casas musulmanas + 277 cristianas = **914 casas ≈ 4 600 hab.**; hacia 1500 era una
  villa de "4–5 000" [3]. Los **30 000** de cities1444 son una cifra del **s.XVII** (relatos de
  viajeros dan 30–60k en el 1600), anacrónica. **Skopje 30k → ~5k.** Excepción a "tira al alto":
  aquí hay dato, y el dato manda.
- **Buda:** el núcleo urbano a fines de la Edad Media se estima en **~13 500 (con la corte)**, la
  mayor villa del reino; con Pest, Óbuda y arrabales la **aglomeración pasaba de 20 000** [1]. El
  `cityPopRaw=20 000` es la aglomeración, no el núcleo; los 8 000 (1400) de cities1444 se quedan
  cortos para 1450. Núcleo ~1450: **~12 000** (por debajo del pico de ~1500).
- **Belgrade:** ~20 000 a fines del s.XIV; "hasta 50 000" bajo el déspota Stefan Lazarević, pero eso
  es el **pico del Despotado (1403–1427)**, cuando fue capital [2]. Desde 1427/1430 pasó a ser
  **fortaleza fronteriza húngara** (Nándorfehérvár); en 1444 seguía siendo un puerto danubiano de
  peso pero sin la corte. Estimación ~1444: **~20 000** (horquilla 15–25k), confianza C. El 50k no
  es de 1444.
- **Târgoviște:** capital de Valaquia (1418–1659), pero Valaquia entera rondaba ~500 000 hab. [7]:
  los **40 000** de cities1444 son el error típico de Chandler con capitales-residencia (como
  Trakai/Gorkij que avisa el método). Villa principesca real: **~8 000** (horquilla 6–10k), C.

### Densidad rural (horquilla EFECTIVA hab/km²)

Densidades EFECTIVAS (el pipeline ya aplica POP_GAIN=0,62; NO reescalar). Validadas contra §2
([9] Russell/Cipolla), sin fuente mejor accesible para afinar → confianza B/C.

| Subzona | min | max | fuente [ref] | fiab. |
|---|---:|---:|---|---|
| Llanura húngara / Alföld / puszta | 3 | 8 | [9] | B — pastoril, poco poblada tras la Peste |
| Transilvania / altiplanos cárpatos | 3 | 7 | [9] | C — villas sajonas densas, campo vacío |
| Serbia / Bosnia oriental / uplands balcánicos | 4 | 9 | [9] | B |
| Bulgaria NO / Macedonia (Rumelia otomana) | 4 | 9 | [9] | C |
| Valaquia / Moldavia (tierras bajas de frontera) | 2 | 6 | [9] | C — frontera despoblada |

### Anacronismos de nombre

En 1444 el reino de Hungría usaba nombres húngaros/alemanes/latinos; los cánones romanos/eslovacos
modernos de Transilvania y la Alta Hungría son **posteriores**. Los exónimos hay que verificarlos en
`exonyms.js` (no editado aquí).

| Canon actual | → Canon 1444 | Exónimo español (verificar/añadir) | motivo |
|---|---|---|---|
| Brasov | **Kronstadt** (alt. Corona / Brassó) | Corona (latino, legítimo) | nombre rumano moderno; en 1444 villa sajona = Kronstadt/Corona |
| Cluj | **Kolozsvár** (alt. Klausenburg) | — (añadir si procede) | nombre rumano moderno; en 1444 = Kolozsvár/Klausenburg |
| Banska Stiavnica | **Selmecbánya** (alt. Schemnitz) | — | nombre eslovaco moderno; en 1444 villa minera húngara/alemana |
| Prizrend | **Prizren** | — | errata del canon (falta corregir "Prizrend" → "Prizren") |
| Belgrade | Nándorfehérvár (húng.) / Beograd | **Belgrado** (verificar en exonyms) | en 1444 fortaleza húngara; "Belgrade" es forma inglesa |
| Skopje | Üsküb (otom.) / Skopje (eslavo) | Escopia (raro) | otomana desde 1392; canon Skopje aceptable |
| Tirgoviste | Târgoviște | — | solo falta el diacrítico; el nombre ya existía en 1444 (no es anacronismo, sí pop absurda) |

> No se tocan exónimos clásicos legítimos. Las correcciones de canon de Transilvania/Alta Hungría
> importan porque el canon ordena claves aunque el jugador vea el exónimo (§4).

### Fuentes de la región

**Escala:** A = abierta y académica · B = abierta, no arbitrada · C = solo resumen de buscador ·
D = no abierta / inferido por comparanda. Ninguna cita es de memoria; todas abiertas esta sesión
salvo las marcadas D.

- **[1]** *History of Budapest / Buda* (Wikipedia) — <https://en.wikipedia.org/wiki/History_of_Budapest>
  y budavar.abtk.hu. Núcleo de Buda a fines de la Edad Media **~13 500 (con la corte)**, mayor villa
  del reino; con Pest/Óbuda/arrabales la aglomeración **>20 000**. Coherente con Kubinyi. **Fiab. B.**
- **[2]** *Demographic history of Belgrade* (Wikipedia) —
  <https://en.wikipedia.org/wiki/Demographic_history_of_Belgrade>. ~20 000 a fines del s.XIV;
  "hasta 50 000" bajo Stefan Lazarević (pico del Despotado 1403–1427, sin fecha precisa); de 1430
  fortaleza húngara. **No da cifra para 1440–1456.** **Fiab. C.**
- **[3]** *History of Skopje* / *Timeline of Skopje* (Wikipedia) y estudios del defter —
  <https://en.wikipedia.org/wiki/History_of_Skopje>. Defter 1467/68: **637 casas musulmanas + 277
  cristianas = 914 casas ≈ 4 600 hab.**; hacia 1500 "villa de 4–5 000". Las cifras 30–60k son del
  s.XVII. **Fiab. B** (el dato mejor fundado de la región; defter fiscal citado en secundaria).
- **[4]** *Brașov* (Wikipedia/Britannica) — <https://en.wikipedia.org/wiki/Bra%C8%99ov>. Mayor villa
  comercial sajona de Transilvania, en el cruce de rutas Imperio otomano–Europa occidental; sin
  cifra directa del s.XV. Estimación ~10 000 por comparanda con Sibiu/Hermannstadt. **Fiab. C.**
- **[5]** Comparanda de villas balcánicas (Niš, Prizren, Shumen) — sin cifra académica ~1450
  accesible; estimadas por tamaño de villa de fortaleza/mercado del Despotado serbio y la Rumelia
  temprana. **Fiab. D** (inferido, horquilla ancha, confianza baja).
- **[6]** *Suceava* / *Stephen the Great* (Wikipedia/Britannica) —
  <https://en.wikipedia.org/wiki/Stephen_the_Great>. Capital de Moldavia (1388–1565), villa de
  aduana y comercio con fortaleza; sin cifra directa. Moldavia entera ~250 000–600 000 en su apogeo
  del s.XV. Estimación ~8 000. **Fiab. D.**
- **[7]** *Târgoviște* (Wikipedia/Britannica) —
  <https://en.wikipedia.org/wiki/T%C3%A2rgovi%C8%99te>. Capital de Valaquia 1418–1659; Valaquia
  entera ~500 000 hab. en el s.XV. Los 40k de cities1444 son error de capital-residencia.
  Estimación ~8 000. **Fiab. C.**
- **[8]** *Banská Štiavnica / Selmecbánya* — villa minera de plata/oro clave del reino de Hungría;
  sin cifra académica ~1450 accesible. Estimación ~6 000 por su peso minero. **Fiab. D.**
- **[9]** J. C. Russell en C. M. Cipolla (ed.), *The Fontana Economic History of Europe*, vol. I
  (1972), vía Fordham — <https://sourcebooks.fordham.edu/source/pop-in-eur.asp>. Población 1450:
  Hungría 1,5 M; Grecia/Balcanes 4,5 M. Base de las densidades de §2 del método. **Fiab. B** (el
  autor las llama "quite speculative").

### Deudas declaradas (mejorarían la región si se abren)
- **Defters otomanos (Barkan / Todorov) para Rumelia** — Skopje, Niš, Shumen, Belgrado post-1521 con
  censo fiscal en vez de Wikipedia: convertiría las D en cifras defendibles.
- **A. Kubinyi, estudios sobre la red urbana húngara** — para Buda/Pest, Cluj, Brasov con aparato.
- **Historiografía rumana (Panaitescu, Giurescu)** sobre Târgoviște/Suceava/Valaquia.
