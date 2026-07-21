## Región 12 — Escandinavia N / subártico

> **Caja:** 4–31 E, 60–66,5 N. Cubre Vestlandet y Trøndelag noruegos, Norrland sueco, la
> Ostrobotnia/Laponia finlandesa y Carelia. **Zona casi vacía**: régimen de subsistencia + pesca
> costera + pastoreo sami de renos en el interior. Post-Peste Negra Noruega perdió **≥50 %** de su
> población y no se recuperó en siglos [2][3].
>
> **Estado del worklist:** `_work-12.json` llega **VACÍO** — ninguna entrada de `cities1444` cae en
> la caja. Es coherente con el sesgo occidental del dataset (Buringh/Chandler apenas cubren
> Escandinavia). Por tanto **no hay núcleos verificados que reconciliar** aquí. Lo urbano real de la
> zona (Bergen, Nidaros) NO está sembrado; lo documento abajo como **laguna**, no como fila
> verificada, porque no procede de ninguna de las dos tablas y no debe sobrescribir nada.

### Núcleos urbanos verificados
| Canon 1444 | x | y | hab ~1450 | año fuente | fuente [ref] | fiab. | veredicto vs tablas |
|---|---:|---:|---:|---:|---|---|---|
| — | — | — | — | — | — | — | worklist vacío: sin núcleos en `cities1444` ni `CITY_POP` dentro de la caja |

### Núcleos NO sembrados (laguna — no en worklist, no sobrescriben nada; solo aviso al pipeline)
| Ciudad (canon 1444) | lon/lat aprox. | hab ~1450 (estimado) | fuente [ref] | fiab. | nota |
|---|---|---:|---|---|---|
| Bergen | 5,3 E / 60,4 N | **~5 000–9 000** | [4][5] | C | Mayor urbe de Noruega y del reino; Kontor hanseático de Bryggen activo en 1450 (visita de Christian I) [5]. Pico pre-peste ~10 000 en el s.XIV [4]; tras 1349 (mitad muerta) rondaría 5–7k hacia 1450. Cae en el borde S de la caja (lat 60,4); podría corresponder también a la región 11. |
| Nidaros (Trondheim) | 10,4 E / 63,4 N | **~1 500–3 000** | [4] | C/D | Sede arzobispal de Noruega; villa pequeña. Sin cifra académica accesible en sesión → confianza baja. |
| Uppsala / Åbo (Turku) | fuera o borde | villas de miles | — | D | Åbo (Turku), sede episcopal de Finlandia, ~lat 60,5 / 22 E: entra en la caja pero no está sembrada; villa de unos pocos miles. No inventar cifra. |

> **Recomendación honrada:** si el pipeline quiere sembrar Bergen, usar **~7 000** (año fuente ~1450,
> tag "Bergen-wiki", confianza **baja**), muy por debajo del umbral de centro de comercio (25k). Todo
> lo demás de la caja es rural. Ninguna de estas entra en `cities1444` hoy, así que el efecto sobre el
> total provincial es marginal y no altera ningún centro.

### Densidad rural (horquilla EFECTIVA hab/km²)
Refino la banda subártica de §2 (0,2–1,5) separando la **franja costera noruega** del **interior
ártico**, que en esta caja difieren mucho:

| Subzona | min | max | fuente [ref] | fiab. |
|---|---:|---:|---|---|
| Costa noruega SO (Vestlandet, Trøndelag; fiordos y pesca) | 1,0 | 3,0 | [1][2][3] | B |
| Interior/N: Norrland, Laponia, Finnmark, Ostrobotnia, Carelia (sami, subsistencia) | 0,05 | 0,8 | [1][2] | B |
| **Conjunto de la caja (media efectiva)** | **0,2** | **1,5** | [1] | B — mantiene §2 |

> La costa concentra casi toda la población (pesca de bacalao/stockfish para la Hansa); el interior es
> tundra y bosque boreal con densidades cercanas a 0. La fertilidad de terreno del pipeline
> (montaña/tundra baja) ya empuja el interior hacia el suelo de la horquilla, así que **no hace falta
> tocar la banda de §2**: se valida tal cual (0,2–1,5 efectivos), con la nota de que el máximo solo
> aplica a la costa SO.

### Anacronismos de nombre
| Canon actual | → Canon 1444 | Exónimo (existe? / añadir) | motivo |
|---|---|---|---|
| — | — | — | Sin ciudades en el worklist → no hay canon que auditar en esta región. (Si se siembra Nidaros, es el nombre correcto de 1444 para Trondheim; Åbo es el nombre de época de Turku.) |

### Fuentes de la región
[1] J. C. Russell, en C. M. Cipolla (ed.), *The Fontana Economic History of Europe*, vol. I (1972),
vía Fordham Medieval Sourcebook — <https://sourcebooks.fordham.edu/source/pop-in-eur.asp>. Macro
"Alemania+Escandinavia" 7,3 M en 1450; Escandinavia ~1–3 hab/km² de media, subártico muy por debajo.
**Fiab. B** (heredada del método; página abierta en la sesión del método).

[2] *How did the Black Death affect Scandinavia?*, The Viking Herald —
<https://thevikingherald.com/article/how-did-the-black-death-the-bubonic-plague-affect-scandinavia/408>.
La peste borró ~la mitad de la población escandinava a mediados del s.XIV; Noruega la más golpeada
(≥50 %); el norte remoto de Noruega/Suecia/Finlandia, muy poco poblado y aislado. **Fiab. C** (solo
resumen de buscador leído en sesión).

[3] *Black Death in Norway*, Wikipedia —
<https://en.wikipedia.org/wiki/Black_Death_in_Norway>. Noruega perdió al menos la mitad de su
población; recuperación de siglos. Sustenta la densidad hundida de 1450. **Fiab. C** (solo resumen de
buscador; página no abierta con éxito).

[4] *Bergen*, Wikipedia — <https://en.wikipedia.org/wiki/Bergen>. Bergen "una de las mayores ciudades
de Escandinavia", mayor de Noruega hasta 1830; ~10 000 en el s.XIV (pico pre-peste), mitad muerta en
1349. WebFetch confirmó lo cualitativo pero **no** dio cifra dura de 1450. **Fiab. C** (cualitativo;
la cifra de 10k viene de resumen de buscador, no de la página abierta → estimación de 1450 es
inferencia propia, marcada baja).

[5] *The History of Bergen / The Hanseatic League & Bergen*, The Hidden North —
<https://thehiddennorth.com/history-of-bergen/>. Kontor hanseático de Bryggen; mencionado activo en
la visita de Christian I en 1450. Da contexto institucional, **no** cifra demográfica dura.
**Fiab. C** (resumen de buscador).

> **Deudas declaradas de la región (convertirían C en A/B):**
> - Ole Jørgen Benedictow, *The Black Death in Norway* / *Plague in the Late Medieval Nordic
>   Countries* — la referencia dura de demografía noruega post-peste. No abierta en sesión (D).
> - Knut Helle (ed.), *The Cambridge History of Scandinavia*, vol. I — cifras urbanas de Bergen y
>   Nidaros con aparato. Deuda D.
> - Registros de diezmo/*skattematrikkel* noruegos del s.XV — para la densidad rural costera con base
>   fiscal en vez de macro-estimación. Deuda D.
