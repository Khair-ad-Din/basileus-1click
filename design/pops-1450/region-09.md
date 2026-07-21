## Región 9 — HRE Renania y NO

> **Caja:** lon 5–10,5 E · lat 47–53 N. Cubre Renania (Colonia, Tréveris), Westfalia (Münster,
> Dortmund, Soest), Baja Sajonia (Braunschweig, Hannover, Hildesheim, Goslar, Göttingen), Alto Rin /
> Alsacia (Estrasburgo, Mulhouse), Suabia / Baden (Freiburg, Esslingen, Heilbronn, Würzburg,
> Rothenburg, Schwäbisch Hall), Suiza N (Basilea, Zúrich) y el Franco Condado N (Besançon).
> **Zona BIEN documentada (Occidente):** aplico el sesgo conservador del método (ante la duda, la
> cifra menor). Ninguna ciudad de esta región se acerca al techo de cordura; Colonia (~40k) es la
> única grande y la mayor del Imperio.
> **Nota de método:** las 30 entradas venían fechadas 1400 en `cities1444` y con `cityPopRaw=null`
> (no había curación en CITY_POP para esta caja). No hay `max()` que reconciliar: se trata de
> verificar contra historiografía y, donde no la hay, normalizar 1400→1450 (mundo post-Peste, estas
> ciudades están planas o en leve declive, no en expansión, salvo excepciones).

### Núcleos urbanos verificados

| Canon 1444 | x | y | hab ~1450 | año fuente | fuente [ref] | fiab. | veredicto vs tablas |
|---|---:|---:|---:|---:|---|---|---|
| Köln (Colonia) | 533 | 910 | 40000 | 1500 | [1] | B | ✅ 40k (mayor del Imperio; techo ~45k) |
| Braunschweig | 639 | 846 | 15000 | 1400 | [5] | C | 🟡 18k algo alto → ~15k |
| Strasbourg (Estrasburgo) | 557 | 1018 | 16000 | 1444 | [2] | B | ✅ 17k ≈ 16k (cifra exacta de 1444) |
| **Frankfurt** (era "Frankenthal") | 585 | 948 | 9000 | 1444 | [3] | B | ❌ 15k — declive del XV; **error de nombre** |
| Münster | 553 | 861 | 10000 | 1400 | [4] | C | 🟡 11k → ~10k |
| Aachen (Aquisgrán) | 508 | 916 | 10000 | 1450 | [4] | C | ✅ 10k |
| Metz | 510 | 993 | 15000 | 1400 | [6] | C | 🟡 10k bajo — "Metz la Rica" ~15k |
| Basel (Basilea) | 552 | 1063 | 10000 | 1450 | [7] | C | 🟡 10k (ciudad del Concilio 1431–49) |
| Trier (Tréveris) | 524 | 964 | 8000 | 1400 | [8] | D | 🟡 10k → ~8k (ciudad episcopal modesta) |
| Esslingen | 604 | 1010 | 5000 | 1400 | [8] | D | 🟡 10k alto — villa imperial pequeña |
| Worms | 576 | 970 | 8000 | 1400 | [8] | D | 🟡 10k → ~8k |
| Dortmund | 549 | 881 | 8000 | 1400 | [8] | D | 🟡 9k → ~8k |
| Mulhouse | 545 | 1055 | 4000 | 1400 | [8] | D | 🟡 9k alto — villa alsaciana pequeña |
| Freiburg | 560 | 1044 | 8000 | 1400 | [8] | D | 🟡 9k → ~8k |
| Mainz (Maguncia) | 573 | 952 | 8000 | 1400 | [8] | D | 🟡 9k → ~8k (declive tras 1462) |
| Soest | 568 | 879 | 7000 | 1400 | [8] | D | 🟡 8k → ~7k |
| Goslar | 637 | 863 | 6000 | 1400 | [8] | D | ✅ 6k |
| Hildesheim | 623 | 851 | 6000 | 1400 | [8] | D | ✅ 6k |
| Besançon | 506 | 1077 | 6000 | 1400 | [8] | D | ✅ 6k |
| Würzburg | 622 | 962 | 6000 | 1400 | [8] | D | ✅ 6k |
| Heilbronn | 601 | 993 | 5000 | 1400 | [8] | D | 🟡 6k → ~5k |
| Rothenburg ob der Tauber | 629 | 981 | 5000 | 1400 | [8] | D | 🟡 6k → ~5k (pico ~5,5k) |
| Schwäbisch Hall | 616 | 993 | 5000 | 1400 | [8] | D | 🟡 6k → ~5k |
| Wesel | 524 | 874 | 5000 | 1400 | [8] | D | 🟡 6k → ~5k |
| Speyer (Espira) | 577 | 984 | 5000 | 1400 | [8] | D | ✅ 5k |
| Göttingen | 623 | 881 | 5000 | 1400 | [8] | D | ✅ 5k |
| Hannover | 616 | 839 | 5000 | 1400 | [8] | D | ✅ 5k |
| Osnabrück | 566 | 845 | 5000 | 1400 | [8] | D | ✅ 5k |
| Zürich (Zúrich) | 580 | 1071 | 5000 | 1400 | [8] | D | ✅ 5k |
| Langensalza | 644 | 900 | 4000 | 1400 | [8] | D | 🟡 5k → ~4k (villa pequeña) |

> **Fiabilidad honesta:** solo Colonia, Estrasburgo y Frankfurt tienen cifra académica de época
> accesible (A/B no llega — son enciclopedia seria, B). El resto (Metz, Basilea, Braunschweig,
> Münster, Aachen) es **C** por falta de censo fiscal abierto en sesión; las ~20 villas pequeñas van
> **D**: cifra derivada de `cities1444`/Buringh normalizada a la baja por juicio, sin verificación
> independiente. Para cerrarlas haría falta Bairoch (1988) o los libros de impuestos de cada ciudad
> imperial (deuda declarada del método).

### Densidad rural (horquilla EFECTIVA hab/km²)

| Subzona | min | max | fuente [ref] | fiab. |
|---|---:|---:|---|---|
| Renania / Westfalia (valle del Rin, tierras fértiles) | 14 | 22 | [8] | B |
| Alto Rin / Alsacia / Suabia (Estrasburgo–Freiburg–Heilbronn) | 12 | 20 | [8] | B |
| Baja Sajonia / borde de la llanura N-alemana | 8 | 14 | [8] | B |
| Selva Negra / Jura / Suiza N / uplands (Basilea–Zúrich–Besançon) | 6 | 12 | [8] | B |

> Confirmo la horquilla "Renania / Alemania occidental **14–22**" del método §2 para el núcleo del
> Rin; las subzonas de montaña (Selva Negra, Jura suizo) y el borde arenoso hacia el N bajan a
> 6–14. Son densidades EFECTIVAS (el pipeline ya aplica POP_GAIN=0,62): **no reescalar**.

### Anacronismos de nombre

| Canon actual | → Canon 1444 | Exónimo (existe? / añadir) | motivo |
|---|---|---|---|
| **Frankenthal** (585,948) | **Frankfurt** | Fráncfort (verificar en `exonyms.js`; añadir si falta) | Las coords (8,68 E / 50,1 N) son **exactamente** Frankfurt am Main; Frankenthal (Pfalz) está en 8,35/49,53 y era una aldea de pocos miles. Error de geocodificación, no de era. Además la pop de 15k es del anacronismo: Frankfurt era ~9k en declive (10k en 1385 → 7,6k en 1499) |
| Koeln / Muenster / Zuerich / Osnabrueck / Wuerzburg / Goettingen | Köln / Münster / Zürich / Osnabrück / Würzburg / Göttingen | Colonia / — / Zúrich / Osnabrück / Wurzburgo / — | **No es anacronismo**: solo transliteración ASCII (ö→oe). Restaurar el diacrítico en el canon; los exónimos españoles legítimos (Colonia, Aquisgrán, Estrasburgo, Maguncia, Tréveris, Basilea, Espira, Zúrich) se conservan |

> Solo **1 anacronismo/error real** de nombre (Frankenthal→Frankfurt). El resto son diacríticos ASCII.
> Exónimos españoles legítimos a verificar en `exonyms.js` (no los edito yo): Colonia, Aquisgrán,
> Estrasburgo, Maguncia, Tréveris, Basilea, Espira, Zúrich, Fráncfort.

### Fuentes de la región

[1] *History of Cologne* / *Cologne* / *List of towns and cities in Germany by historical population*
(Wikipedia), abiertos en sesión — Colonia nunca superó ~45.000 hasta el s.XVIII; ~50–55k en su pico
de 1300; 45.000 en 1500; mayor ciudad del Imperio. Uso ~40.000 para ~1450 (algo por debajo del techo).
<https://en.wikipedia.org/wiki/History_of_Cologne> · <https://en.wikipedia.org/wiki/List_of_towns_and_cities_in_Germany_by_historical_population> — **Fiab. B**.

[2] *Strasbourg* (Encyclopedia.com), abierto en sesión — **16.000 habitantes en 1444**, subiendo a
20–25k a comienzos del s.XVI. Cifra exacta de época; manda sobre los 17k de `cities1444`.
<https://www.encyclopedia.com/places/britain-ireland-france-and-low-countries/french-political-geography/strasbourg> — **Fiab. B**.

[3] *Timeline of Frankfurt* / *Frankfurt am Main* (Wikipedia; Encyclopedia.com), abiertos en sesión —
máximo medieval ~10.000 en 1385; declive del XV hasta **7.600 en 1499**; recuperación posterior
(12k en 1555). Para ~1444, en pleno declive: **~9.000**. Confirma además que la entrada "Frankenthal
15k" es Frankfurt mal etiquetada e inflada.
<https://en.wikipedia.org/wiki/Timeline_of_Frankfurt> — **Fiab. B**.

[4] *Aachen* (Britannica; Wikipedia) — ciudad imperial libre con **~10.000–20.000 a comienzos del
s.XVI**; suelo bajo de la horquilla para ~1450 (~10.000). Münster (Westfalia) sin cifra firme abierta;
estimo ~10.000 por analogía con las capitales episcopales westfalianas.
<https://www.britannica.com/place/Aachen> — **Fiab. C**.

[5] *Braunschweig* (Wikipedia; Britannica) — gran ciudad hanseática del N; los príncipes trasladaron
la Residenz a Wolfenbüttel en 1432 por el poder de los burgueses; 7ª de Alemania hacia 1600. **Sin
cifra total de 1400–1450 abierta**; estimo ~15.000 (los 18k de `cities1444` parecen algo altos).
<https://en.wikipedia.org/wiki/Braunschweig> — **Fiab. C**.

[6] *History of Metz* / *Metz* (Grokipedia; Wikipedia) — "Metz la Rica", república imperial próspera;
población **cercana a 15.000 a comienzos del s.XV**, centro bancario. Los 10k de `cities1444` quedan
bajos. Grokipedia es fuente floja: podría ser algo mayor (hasta ~20k según estimaciones altas), por
eso confianza baja. <https://en.wikipedia.org/wiki/History_of_Metz> — **Fiab. C**.

[7] *Basel* / *Council of Basel* (Wikipedia; Britannica) — sede del Concilio 1431–1449, llena de
dignatarios y extranjeros; reconstruida tras el terremoto de 1356. **Sin cifra total firme abierta**;
estimo ~10.000 (la afluencia del concilio es temporal, no estructural).
<https://en.wikipedia.org/wiki/Basel> — **Fiab. C**.

[8] Método §2 (J. C. Russell en Cipolla, *Fontana Economic History of Europe* vol. I, 1972; y Munro,
*Medieval Population Dynamics to 1500*) — horquilla de densidad efectiva "Renania / Alemania
occidental 14–22 hab/km²", y cifras de las villas pequeñas heredadas de `cities1444.js`
(Buringh 2021 + Bosker/Buringh/van Zanden 2013), normalizadas a la baja por el sesgo conservador del
método. <https://sourcebooks.fordham.edu/source/pop-in-eur.asp> — **Fiab. B** (densidad) / **D** (villas
pequeñas: dataset citado, no reauditado ciudad por ciudad).
