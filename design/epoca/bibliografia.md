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
