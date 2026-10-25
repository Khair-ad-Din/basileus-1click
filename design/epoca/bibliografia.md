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

---

## Añadidos de la pasada de verificación del 2026-09-27 (Oficio 1, consejo sobre dinero/flete, lujos y herrería)

Abiertas en esta sesión. Dos de ellas **corrigen a fichas existentes** (ver nota al pie de la tabla).

| Autor / obra | Año | Enlace | Qué cubre | Fiab. |
|---|---|---|---|---|
| **K. O'Rourke & J. Williamson**, *Did Vasco da Gama Matter for European Markets? Testing Frederick Lane's Hypotheses Fifty Years Later*, NBER WP 11884 (publ. EcHR 2009) | 2005 | [PDF](https://www.nber.org/system/files/working_papers/w11884/w11884.pdf) | **Matiza a Lane (`_fuentes-mercader.md [9]`, que era C).** Pimienta en Venecia 84,9 → 51,1 ducados/cargo (1400-25 → 1475-1500, −40%); la caída de 1420-50 es sobre todo el **fin de un pico 1410-27** (ruptura de oferta atribuida a las armadas de Zheng He: Inglaterra ×8 en 1410-11, +45% aún en 1423-27, normal tras 1427). **Fuera de Venecia la pimienta SUBE tras 1450** (Austria +1,5%/año, Países Bajos +1,1%/año 1450-9→1490-9; Inglaterra +0,4%/año en el siglo; Cracovia sin tendencia significativa). Ashtor documenta **aumento de cantidades ofertadas en Alejandría y Beirut** (vía ORW, pp. 9-10) | **A** (working paper de autores de referencia, publicado en revista arbitrada; leído por `pdftotext`) |
| **J. H. Munro**, WP 361 (ya `_fuentes-mercader.md [5]`), **serie anual** del cesto flamenco | 2009 | [PDF](https://www.economics.utoronto.ca/public/workingPapers/tecipa-361.pdf) | **El "−21,5% en una década" de `mercader.md` §3 parte de un pico de hambruna**: cesto en d. groot 1437 = 140,3 → **1438 = 235,0 → 1439 = 241,3** → 1440 = 146,3. Sin el pico: 1431-35 → 1446-50 = **−11%**; 1421-35 → 1461-70 = **−21%** (≈ −0,6%/año). Deflación real, pero lenta | **A** |
| **P. Claughton & C. Smart**, *The Crown silver mines in Devon*, **Historical Metallurgy 44(2)**, 112-125 | 2010 | [PDF](https://www.hmsjournal.org/index.php/home/article/download/152/148) | Minas de plata de Bere Ferrers bajo **gestión directa de la Corona 1292-1349**, luego **arrendadas**; la Corona impone "a prerogative on precious metals, along with copper" *ad dignitatem regalium*, "breaking with the custom which regulated other forms of mineral exploitation" | **A** |
| **Bula de Oro** (1356), cap. IX (trad. ingl., Avalon Project, Yale) | 1356 | [Avalon](https://avalon.law.yale.edu/medieval/golden.asp) | El rey de Bohemia y los electores poseen "all the gold and silver mines and mines of tin, copper, lead, **iron** and any other kind of metal, and also of salt" → **en el Imperio el hierro TAMBIÉN es regalía (del príncipe)** | **A** (edición documental) |
| *Mittelalter-Lexikon*, "Bergrecht" | — | [enlace](https://www.mittelalter-lexikon.de/wiki/Bergrecht) | Regalía primero regia, luego territorial (*landesherrlich*); el descubridor explota pagando al dueño del suelo una compensación y al príncipe el *Bergzehnt*; fragmentación en ordenanzas regionales | **B** |
| **M. Diago Hernando**, *Carreteros y arrieros en el transporte de mercancías en la Corona de Castilla (ss. XIV-XVII)*, **Chronica Nova** | 2024 | [PDF](https://revistaseug.ugr.es/index.php/cnova/article/download/29967/28147/135988) | La visión clásica (transporte "muy poco profesionalizado… prestado preferentemente por campesinos… actividad secundaria") **es "inexacta"**: hubo empresarios con asalariados junto a campesinos. Portazgos: concejos que los imponen a carreteros foráneos (1487), exenciones regias (yangüeses desde el s. XIV), portazgo de Soria cobrado por un caballero "por real privilegio" (1496). Cabaña Real de Carreteros = **1497** (post-1444) | **A** (casi todos los documentos son de 1480-1500) |
| **R. Sharpe**, *Common Carriers in Medieval England: Evidence from Oxford Archives* | s.f. | [ORA](https://ora.ox.ac.uk/objects/uuid:53bbd65d-9c0c-489e-b4b6-431465840d10/files/ma657c8a74f0909171813b2d639a135af) | **El transportista regular nace justo en 1444**: antes de 1420 no hay rastro; **"by 1450 carriage was usually provided more cheaply by regular carriers"**; Henry Bathe, carrier Oxford-Londres **desde 1449**. Coexiste con el alquiler de acémilas y el viaje por encargo | **A** |
| **VCH Gloucestershire** vol. 5, Forest of Dean: Industries | — | [BHO](https://www.british-history.ac.uk/vch/glos/vol5/pp326-354) | Dean = "chief iron producing district of medieval England at least until the 14th century"; **49 forjas en 1317 → 33 a mediados de los 1430** | **A** (leído vía WebFetch, citas literales) |
| Wikipedia, *Wealden iron industry* | — | [enlace](https://en.wikipedia.org/wiki/Wealden_iron_industry) | Weald pre-alto horno: ~30 bloomeries, <10 hidráulicas; auge **solo tras el alto horno (1490s) y sobre todo desde 1540** | **B** |
| *Historisches Lexikon Bayerns*, "Hammereinungen" | — | [enlace](https://www.historisches-lexikon-bayerns.de/Lexikon/Hammereinungen) | Gran Hammereinung del Alto Palatinado **1387**: 64 señores de martinete, **77 martinetes**, cartel de Amberg-Sulzbach con burgueses de Núremberg; 93.200 acarreos de mineral en 1475 | **B** |
| **L. F. Salzman**, *English Industries of the Middle Ages* (ya listado arriba) | 1923 | Gutenberg | El carbón de piedra ("sea coal") se usaba en Inglaterra sobre todo para **forja y cal** | **B** |
| **W. Childs**, *England's Iron Trade in the Fifteenth Century*, EcHR 34 | 1981 | [Wiley](https://onlinelibrary.wiley.com/doi/10.1111/j.1468-0289.1981.tb02004.x) | Importaciones inglesas de hierro **mayores de lo que se creía y casi todas de España** | **C** (solo resumen, vía buscador) |

> **Correcciones que estas fuentes piden a fichas existentes (no aplicadas; decide quien mantenga la ficha):**
> `mercader.md` §6.1 ("la pimienta se abarató ~50%") → es verdad **en Venecia** y es la salida de un pico, no abundancia
> estructural; en el resto de Europa la pimienta **sube** desde 1450. `mercader.md` §3 ("−21,5% en una década") → la
> base 1436-40 es la hambruna de 1438-39; la deflación subyacente es ~−11% en 15 años.

---

## Añadidos de la pasada de verificación del 2026-09-28 (Oficio 1, capacidad agraria: población ~1300 / ~1444 por región)

Abiertas en esta sesión. Sirven al ancla K = población 1444 × factor de `design/capacidad-agraria.md`.

| Autor / obra | Año | Enlace | Qué cubre | Fiab. |
|---|---|---|---|---|
| **NCMH vol. VII**, cap. 5 *Rural Europe* — secciones "The demographic crisis" y "Regional variations" | 1998 | [erenow 25](https://erenow.org/postclassical/MedivalHistory7/25.php) · [erenow 26](https://erenow.org/postclassical/MedivalHistory7/26.php) | Suelo demográfico **1420-1450**, población "a half or two-thirds" de la pre-Peste; Francia 18 M (1330) → <10 M (1450, "guesswork"); Inglaterra ~6 M → 2,5-3 M; contado de Florencia 300.000 (1338) → 104.000 (1427); Provenza 400.000 (1315-16) → 150.000 (1471); Alemania: >40.000 de 170.000 asentamientos desaparecen (Brandeburgo/Suabia alta 60-70%); Noruega: la mitad de las granjas abandonadas; Suecia 10-36%; cuenca de París ~60% del cultivo fuera del arado a mediados del XV. **Variación:** impacto limitado en partes del Este y en Castilla (Castilla crece a principios del XV); Wrocław retrasa la crisis a 1425-80; Sicilia crece en los 1450; Toscana rural tras 1460; Lyonnais desde 1430, Normandía 1450; Brabante tras 1495; Inglaterra hasta bien entrado el XVI | **A** (contenido CUP; espejo) |
| **Federico & Malanima**, *Progress, decline, growth: product and productivity in Italian agriculture, 1000-2000*, EcHR 57(3), tabla 4 | 2004 | [PDF](https://web.stanford.edu/~avner/Greif_228_2005/Federico%20and%20Malanima%202004%20EHR%201000-2000.pdf) | Italia (miles): 1300 = 12.500 · 1350 = 9.500 · 1400 = 8.000 · **1450 = 7.500** · 1500 = 9.000 · 1550 = 11.500 · 1600 = 13.273. Centro-Norte 7.750 → 4.425 (1450) | **A** |
| **Ş. Pamuk**, *The Black Death and the origins of the 'Great Divergence'*, EREH 11, tabla 1 (datos de Malanima, inédito) | 2007 | [PDF](https://ata.bogazici.edu.tr/sites/ata.boun.edu.tr/files/faculty/sevket.pamuk/pamuk_ereh_black_death.pdf) | Miles, 1300 / 1400 / 1500: Ingl.+Gales 5.750/3.000/3.500 · Holanda 800/600/950 · Bélgica 1.250/1.000/1.400 · Italia 12.500/8.000/9.000 · España 5.500/4.500/5.000 · **Europa 94.200/67.950/82.950**. Recuperación del nivel de 1300: Países Bajos en el XV; Francia, España, Italia en el XVI; Ingl. y Gales en el XVIII; Egipto "probablemente" no hasta el XIX | **A** (la tabla es de un manuscrito inédito de Malanima: cifra de segunda mano) |
| **Álvarez-Nogal & Prados de la Escosura**, *The Rise and Fall of Spain (1270-1850)*, WP UC3M 11-02 (publ. EcHR 2013) | 2011 | [PDF](https://e-archivo.uc3m.es/rest/api/core/bitstreams/b048a822-7f2b-40e6-b5a5-c6528e098f75/content) | Peste "más suave" en España; Castilla pierde "probablemente menos del 25%"; Teruel 35%; Navarra 25-40%; Aragón/Cataluña peor que Castilla; Andalucía la más castigada de Castilla. Sin serie de población tabulada | **A** |
| **P. Guzowski**, *Did the Black Death reach the Kingdom of Poland in the middle of the 14th century?* (arXiv 2111.02714) | 2021 | [PDF](https://arxiv.org/pdf/2111.02714) | Gran Polonia + Pequeña Polonia + Mazovia: **~1.250.000 c.1340 → ~3.100.000 c.1580** (Gieysztorowa 1981), +0,38%/año **sin catástrofe**; conclusión: no hubo despoblación a mediados del XIV. Crecimiento europeo desde mediados del XV 0,25-0,28%/año; Alemania 0,7% 1520-70; Inglaterra >0,5% (hasta 0,9%) en el XVI | **B** (preprint de académico; datos de Gieysztorowa = D) |
| **Pfister & Fertig**, *The population history of Germany*, MPIDR WP 2010-035, tabla 1 | 2010 | [PDF](https://www.demogr.mpg.de/papers/working/wp-2010-035.pdf) | Alemania (Kaiserreich) 1500 = 9,2 M → 1560 = 13,7 M → 1618 = 17,2 M. **No da cifra medieval** | **A** (solo post-1500) |
| **J. Munro**, *Medieval Population Dynamics to 1500, Part C* (diapositivas, U. Toronto), tabla de J. C. Russell | s.f. | [PDF](https://www.economics.utoronto.ca/munro5/L02MedievalPopulationC.pdf) | Russell (M): Mediterráneo (Grecia, Balcanes, Italia, Iberia) 25,0 → 19,0 (1450) · Centro-Oeste (Francia, P. Bajos, Alemania, Escandinavia, Islas) 35,5 → 22,5 · Este (Rusia, Polonia-Lituania, Hungría, Bohemia) 13,0 → 9,5 · total 73,5 → 51,0. Tabla descolumnada en la extracción, reconstruida por sumas | **B** (Russell es de los 1950-60 y bajo) |
| **Aarhus Univ.**, *danmarkshistorien.dk*, "Population and the structure of society" (1340-1523) | s.f. | [enlace](https://cas.au.dk/en/danish-history/modules/module-3-the-late-middle-ages-1340-1523/2-population-and-the-structure-of-society) | Dinamarca ~950.000 antes de la Peste → ~550.000 desde 1350 → ~600.000 hacia 1500; crecimiento real solo desde mediados del XV | **B** |
| Wikipedia, *Black Death in Norway* | — | [enlace](https://en.wikipedia.org/wiki/Black_Death_in_Norway) | Noruega ~350.000 c.1300 (Benedictow = D); 36.500 granjas / 60.000 hogares c.1300 → 16.000 / 23.000 en 1520 (Harrison = D); XV "menos de la mitad" de 1300; recuperación en el XVII | **B/C** |
| Wikipedia (es), *Lo mal any primer* | — | [enlace](https://es.wikipedia.org/wiki/Lo_mal_any_primer) | Cataluña ~500.000 c.1300 → ~224.000 en 1497 (Vicens Vives & Nadal 1965 = D); 508.000 en 1717 | **B/C** |
| **A. Laiou (ed.)**, *The Economic History of Byzantium*, cap. "The Agrarian Economy, 13th-15th c." (texto en Internet Archive) | 2002 | [IA](https://archive.org/stream/laiou-economic-history-of-byzantium/Laiou_Economic%20History%20of%20Byzantium_djvu.txt) | Declive "virtually unrelieved" desde principios/mediados del XIV hasta el fin del Imperio; caída ya antes de 1341 en Macedonia; aldeas que vuelven a niveles del XII; 10 brotes en el Peloponeso 1347-1440; recuperación "débil" en Macedonia al final. **Sin cifras globales** ("educated guesses") | **A** |
| **N. Varlık**, *Plague epidemics in the post-Black Death Mediterranean and the Ottoman Empire* (seminario, OSU) | 2012 | [PDF](https://bpb-us-w2.wpmucdn.com/u.osu.edu/dist/a/49661/files/2017/08/VARLIK_CHR-Seminar_462012-2cksi22.pdf) | Anatolia: la Peste de 1347 documentada en Trebisonda, Kayseri, Karaman…; conocimiento "rudimentario" de su efecto en tierras otomanas; **la peste solo cobra "real momentum" en el ámbito otomano desde mediados del XV** | **B** (texto de seminario de una especialista) |
| **S. Borsch**, *Plague Depopulation and Irrigation Decay in Medieval Egypt*, *The Medieval Globe* 1 | 2014 | [PDF vía r.jina.ai](https://scholarworks.wmich.edu/cgi/viewcontent.cgi?article=1013&context=tmg) | Egipto rural pierde **>40% entre 1347 y 1517** (Abū Ghāzī 2000, que Borsch juzga realista; Dols 1977: un tercio); brotes de 1430 y 1460 los peores (Cairo ~90.000 y ~70.000 muertos); **decadencia del sistema de riego >60% en provincias del Delta**; Egipto no se recuperó (a diferencia de Inglaterra) | **A** |
| Varios, Wikipedia/buscador: Russia (1352-53; "Nastas'in pestilence" 1417-25, Penskoy et al. 2022, resumen PubMed) | — | — | Rus: brotes 1352-53 y 1417-25; **ninguna cifra de población** | **C** |
