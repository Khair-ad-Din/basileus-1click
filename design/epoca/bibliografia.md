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

## Avisos de método que valen para futuras fichas

- **En 1444 la evidencia serial de rendimientos casi se ha agotado**: 1432 es el último año con >50
  observaciones. Cualquier rendimiento "de 1444" es **extrapolación**, y hay que decirlo.
- **Ojo con los debates abiertos.** Ogilvie vs. Epstein discrepan frontalmente sobre si los gremios
  eran eficientes o rentistas. Cuando toques uno, da las dos posiciones; no elijas en silencio.
- **Las cifras que circulan sin aparato suelen ser de otro siglo.** La carga fiscal "25-50%" es del
  mundo antiguo o del XVIII francés; el "un tercio de la tierra en manos de la Iglesia" está
  cuestionado y es munición de apologetas. Se descartaron.
