# Bibliografía — Basileus, Europa c. 1444

Índice común de las fuentes que fundamentan las fichas de época. Levantado el **2026-07-15** por los
cinco cronistas, trabajando en paralelo.

## Cómo está organizado esto (léelo antes de tocar nada)

**Cada ficha tiene su propia lista de fuentes, con su propia numeración**, y **las marcas `[N]` de
dentro de la ficha apuntan a ESA lista**:

| Ficha | Su lista de fuentes |
|---|---|
| `campesino.md` | `_fuentes-campesino.md` |
| `artesano.md` | `_fuentes-artesano.md` |
| `mercader.md` | `_fuentes-mercader.md` |
| `noble.md` | `_fuentes-noble.md` |
| `clerigo.md` | `_fuentes-clerigo.md` |

⚠ **NO fusiones las cinco listas en una sola renumerada.** Las cinco fichas suman ~700 marcas `[N]`
locales; renumerar las rompería todas en silencio. Este archivo es un **índice y una guía de método**,
no un refundido. Si añades una fuente, va a la lista de su ficha.

---

## Escala de fiabilidad (común a todas las listas)

| Marca | Significado |
|---|---|
| **A — abierta y académica** | Texto abierto en sesión, historiografía arbitrada o edición documental. **Cita dura.** |
| **B — abierta, no arbitrada** | Texto abierto; enciclopedia, sociedad erudita o divulgación seria. Buena para cronología e institución; floja para juicio. |
| **C — solo resumen** | Solo el abstract o el fragmento del buscador. **NO es cita dura.** |
| **D — no abierta** | La fuente existe y es la buena, pero no se pudo abrir. **Deuda declarada, no cita.** |

**La regla que sostiene todo esto:** ninguna entrada de ninguna lista es una cita de memoria. Lo que
no se abrió, se marcó **D** y se dejó como hueco. Un enlace inventado destruiría la razón de ser de
las fichas.

---

## Método — cómo llegar a las fuentes buenas

Descubierto trabajando, y es la diferencia entre una ficha de enciclopedia y una con historiografía:

- **WebFetch NO parsea PDFs** (devuelve binario) — pero **sí los guarda en disco**. Y se pueden bajar
  con **`curl`** y extraer con **`pdftotext -layout`** o **`pypdf`**. Así entraron la
  *Agricultural History Review*, los working papers del LSE, Broadberry, Campbell & Ó Gráda,
  Prestwich, de Roover (545 pp.) y Munro. **Que un PDF no se abra a la primera no es motivo para
  marcar D.**
- **`erenow.org` espeja la *New Cambridge Medieval History* vol. VII (1415-1500)** — el volumen que
  cubre exactamente la época del juego. Fuente de referencia natural para todas las fichas.
- **JSTOR, Cairn e Internet Archive con préstamo restringido** devuelven el resumen: eso es **C**.

---

## Deudas grandes (lo que falta y sería lo mejor)

Estas son las lagunas que más limitan las fichas. Si alguna vez se consiguen, mejoran el fundamento
de golpe:

| Deuda | Afecta a | Por qué duele |
|---|---|---|
| **Spufford**, *Power and Profit* y *Money and its Use* | mercader | Era la referencia central del encargo. Internet Archive con préstamo restringido (403 al texto). **Ni una cifra suya está citada.** |
| **Dollinger** y la historiografía moderna de la Hansa | mercader | La Hansa entera va con fiabilidad media |
| **Castilla**, casi entera | campesino, noble | Cobertura ~cero, y es la nación contra la que está calibrado `BASE_INCOME` |
| **Le Roy Ladurie** / Francia | campesino | La taille depende de una entrada enciclopédica |
| **% de clero y % de tierra de la Iglesia** fuera de Inglaterra | clerigo | Sin censo; las cifras que circulan van de 1-2% a 5-10% sin aparato |
| **Fracción del bruto campesino que capta el señor** | noble, campesino | Es literalmente `MANOR_RENT.solariego=0.28`. **No está desmentido: está sin verificar.** Ninguna fuente accesible da una fracción defendible de la base |
| **El Islam** (clero en El Cairo, Edirne…) | clerigo | Sin fundamentar. El juego pone la misma casilla "clero" ahí |
| **Peajes del Rin/Loira en 1444** | mercader | Solo hay cifras del s. XIII |

---

## Añadidos de la pasada de verificación del 2026-07-15 (Oficio 1)

Fuentes **nuevas**, abiertas en esa sesión, que no estaban en ninguna de las cinco listas. Van aquí porque
resuelven choques **entre** fichas (no pertenecen a una sola). Si se tocan `clerigo.md` o `noble.md`, incorpóralas.

| Autor / obra | Año | Enlace | Qué cubre | Fiab. |
|---|---|---|---|---|
| **Christian D. Liddy**, *The Making of Towns, the Making of Polities: Towns and Lords in Late Medieval Europe*, **Past & Present 264** | 2024 | [Oxford Academic](https://academic.oup.com/past/article/264/1/3/7637471) | **LA fuente que arbitra el choque `manorOf`.** *"perhaps three-quarters of England's six hundred or so towns around 1300 were seigneurial, that is, their immediate lord was not the king"*; **61% de las villas de señorío inglesas fundadas por señores SEGLARES y 39% por señores ECLESIÁSTICOS**. Tesis: *"urban development necessitated lordship"* | **A** (revista arbitrada de primer nivel; leído vía extracción con cita literal, **corroborado por búsqueda independiente que reproduce el 61/39**) |
| **NCMH vol. VII**, cap. "The European Nobility" | — | [erenow (espejo)](https://erenow.org/postclassical/MedivalHistory7/20.php) | Reabierto: confirma la tabla de `noble.md` y **añade Navarra ~15% y Aragón ~1,5-2%** | **A** (contenido CUP; espejo no oficial) |
| **Campbell & Ó Gráda**, *Harvest Shortfalls…* (borrador 2009) | 2011 | [PDF](https://www.pseweb.eu/ydepot/semin/texte0910/OGR2010HAR.pdf) vía `r.jina.ai` | **Cierra la deuda de la correlación serial.** Tabla 5: *"the predicted frequency is set at the once-off probability of such a shortfall squared or cubed"* → "esperado" = **independencia**. *"back-to-back shortfalls … were somewhat more common than might be expected on the basis of squaring once-off probabilities … but such shortfalls occurred **14 per cent more often than 'expected'**"*. Veredicto de los autores: *"Evidence on their randomness is mixed"*. **CV netos (nuevos): trigo 0,268 · cebada 0,244 · avena 0,240** | **A** (los CV brutos coinciden **exactamente** con la extracción previa por `pdftotext`, lo que valida ambas) |
| *Realengo, señorío nobiliario y abadengo en el reino de Murcia*, **Murgetana 69** | — | [PDF](https://www.regmurcia.com/docs/murgetana/N069/N069_005.pdf) vía `r.jina.ai` | **Identifica la fuente [20] de `_fuentes-clerigo.md`**, que estaba marcada *"fecha incierta, NO USAR"*: **es de 1752**. Murcia 1752: realengo 52,7% / nobiliario 24,4% / abadengo 22,4% (de él, Órdenes Militares 22,08%). El Partido de Albacete 61,1/25,8 coincide → confirmada la sospecha. **Sigue sin valer para 1444** | **B** — y **descartada para la época** |

> **Aviso de método nuevo y útil:** en esta sesión **no había Bash** (ni `curl` ni `pdftotext` ni `pdftoppm`), así que
> el método canónico de la bibliografía no era ejecutable. **`https://r.jina.ai/<url-del-pdf>` con WebFetch sí extrae
> texto de PDFs** y resolvió Campbell & Ó Gráda y Murgetana. **WebFetch a pelo sobre un PDF alucina**: devolvió unos CV
> inventados ("trigo 0,20-0,25, cebada 0,22-0,27") que contradecían la extracción buena — se descartó. Si un PDF
> devuelve "binary content", **no te fíes de la respuesta que lo acompaña**.

## Avisos de método que valen para futuras fichas

- **En 1444 la evidencia serial de rendimientos casi se ha agotado**: 1432 es el último año con >50
  observaciones. Cualquier rendimiento "de 1444" es **extrapolación**, y hay que decirlo.
- **Ojo con los debates abiertos.** Ogilvie vs. Epstein discrepan frontalmente sobre si los gremios
  eran eficientes o rentistas. Cuando toques uno, da las dos posiciones; no elijas en silencio.
- **Las cifras que circulan sin aparato suelen ser de otro siglo.** La carga fiscal "25-50%" es del
  mundo antiguo o del XVIII francés; el "un tercio de la tierra en manos de la Iglesia" está
  cuestionado y es munición de apologetas. Se descartaron.

---

## Añadidos de la pasada de verificación del 2026-09-25 (Oficio 1, revisión de `design/economia-v2.md`)

Abiertas en esta sesión. Resuelven preguntas que cruzan fichas (artesano/campesino/noble/clérigo).

| Autor / obra | Año | Enlace | Qué cubre | Fiab. |
|---|---|---|---|---|
| **G. T. Lapsley**, *The Account Roll of a Fifteenth-Century Iron Master*, **EHR 14** (55), pp. 509-529 | 1899 | [Internet Archive, texto](https://archive.org/download/sim_english-historical-review_1899-07_14_55/sim_english-historical-review_1899-07_14_55_djvu.txt) | Edición del compoto de la ferrería de **Byrkeknott (Durham), 1408-09**: 278 *blomes*; carbón a 2s la docena de cargas + 6d de acarreo; *blomer* 6d/blome, herrero 6d+1d. **Cálculo propio sobre 9 semanas: carbón (quemado + acarreo) = 45-62% del gasto semanal** (media ~55%); el mineral se compraba aparte (£13 5s/año); gasto total £83 0s 1d. **La leña salía gratis del parque del obispo**, así que el coste del carbón está infravalorado | **A** (edición documental) |
| **L. F. Salzman**, *English Industries of the Middle Ages* (Gutenberg) | 1923 | [Gutenberg](https://www.gutenberg.org/cache/epub/48588/pg48588.txt) | Tudeley (Kent) 1333/1353 y Bedburn 1408: salarios por blome; bloom a 3s 4d en Tudeley (Eduardo III). Sin reparto de costes | **B** (antiguo) |
| **G. Clark**, *Markets and Economic Growth: The Grain Market of Medieval England* (working paper UC Davis) | c.1999 | [PDF](https://faculty.econ.ucdavis.edu/faculty/gclark/210a/readings/market99.pdf) | Trigo **~6 s/quarter**; transporte terrestre **~0,2 s/quarter por 10 millas c.1300** (cita a Campbell, Galloway, Keene & Murphy 1993, pp. 193-8) → **~3,3% del precio cada 16 km**; el agua ~1/10 de la tierra | **B** (working paper; dato base de Campbell et al. = **D**) |
| **Heldring, Robinson & Vollmer**, *The Long-Run Impact of the Dissolution of the English Monasteries* (working paper) | 2020 | [PDF](https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/f/1135/files/2018/06/Valor-June-15-2020.pdf) | **Tabla 1 (adaptada de Clay 1986, p. 143 / Overton 1996, tabla 4.8): reparto de la tierra cultivada en Inglaterra en 1436**: aristocracia+gran gentry 15-20% · gentry media y menor 25% · yeomen y pequeños propietarios 20% · **Iglesia y Corona 25-35%** (Iglesia ~20-30%, Corona ~5%) | **B** (working paper; Clay y Overton = **D**). **Es de 1436: fecha buena** |
| **NCMH vol. VII**, cap. 5 *Rural Europe* | 1998 | [erenow (espejo)](https://erenow.org/postclassical/MedivalHistory7/24.php) | Rentas a la baja en casi toda Europa; **champart (sur de Europa): de 1/2 o 1/3 de la cosecha en el XIII a "1/4 o menos"** en el XV; rentas en dinero pactadas y dues consuetudinarios también bajan; excepciones: **Países Bajos del sur** (sin reducción general) y **Castilla** (la gran nobleza gana poder y explota reservas y Mesta); mezzadria toscana con "rentas altas" | **A** (contenido CUP; espejo no oficial) |
| Wikipedia, *Thomas Percy, 1st Baron Egremont* | — | [enlace](https://en.wikipedia.org/wiki/Thomas_Percy,_1st_Baron_Egremont) | "the Percy Cumberland estates suffered a decline of 25% between 1416 and 1470" (cita Tuck, *Northern History* 21, 1985, p. 42 — **D**) | **B/C** |
