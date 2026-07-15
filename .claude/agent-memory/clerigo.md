# Memoria — clérigo

- **2026-07-15 — [CERRADO POR EVIDENCIA] Invertir `manorOf` (rural→abadengo)** porque "el señorío
  eclesiástico era abrumadoramente rural".
  → El Cronista lo tumbó con **Liddy, *The Making of Towns, the Making of Polities*, Past & Present 264
  (2024), fiab. A**: *"three-quarters of England's six hundred or so towns around 1300 were seigneurial"*, y
  de esas, **el 61% las fundaron señores SEGLARES y el 39% eclesiásticos** (≈29% de todas las villas
  inglesas) — frente a una cuota de tierra del clero de **≥1/6 (16,7%)**, Savine. O sea: **estabas
  SOBRE-representado en el señorío urbano respecto a tu cuota rural.** `urbana→abadengo` está **exagerada,
  no invertida**: invertirla habría sido **un error MAYOR que el statu quo**.
  ⚠ **El hecho de fondo sobrevive y NO está descartado:** el error no es el **sentido** de la regla, es que
  **haya una regla**. Hoy tienes el **100%** de las urbanas (exagerado) y el noble **cero** (falso). Sigue
  vivo como **decisión 5 del dictamen: `manorOf` pasa de geometría a sorteo** (~30% clero / ~70% seglar en
  urbanas; ~17/83 en rurales), **sin decidir aún**. Pídelo así, **nunca como "invertir"**.
  ⚠ Y "la tierra del clero era rural" es cierto **y vacío como criterio**: la de todos lo era.

- **2026-07-15 — [CERRADO POR EVIDENCIA] Sustituir `seda` por `cera` en el coste de la Catedral.**
  → **CATEGORY ERROR**, destapado leyendo el código: `seda:400` está en **`cost:`** = coste de CONSTRUCCIÓN
  único (`config.js:126`); el mantenimiento es `up:`. **La cera es un coste CORRIENTE del culto**, no un
  material de obra: meterla en `cost:` es **pagar la catedral en velas**. Y `LUX_NEED.clero.cera=4.4` **ya
  la modela** — duplicarla sería peor que el error original.
  ⚠ **El hecho sobrevive y sigue abierto: la `seda` en el coste de la catedral SÍ sobra** (falta obra:
  plomo, vidrio y madera, que ni existen como recurso). Pide **quitar la seda**, no meter cera en `cost:`.
  Si algún día pides cera, que sea en `up:` y vigilando no duplicar `LUX_NEED`.

- **2026-07-15 — [CORRECCIÓN a tu propio dossier]** Sí usas `p.bOwner`: `ESTATE_BUILDS.clero =
  ["catedral","templo","vinedo","universidad"]` (`sim.js:464`), pagados de `N.sWealth.clero`. Lo que NO
  tienes es **`granja`** — está en la lista de la **nobleza** (`sim.js:465`). Un monasterio con una granja es
  hoy mecánicamente imposible. **Sigue vivo** dentro de la decisión 5.

- **2026-07-15 — [SIGUE VIVO, sin decidir]** El diezmo sordo a la cosecha (el diezmo **era** la cosecha:
  se apartaba en el campo, como gavilla); el reparto real del diezmo en Castilla (~67% clero / **~22%
  tercias reales → CORONA** / ~11% fábrica), que es sólido y sigue sin implementar; la catedral con dos
  dueños según quién la construya (el Consejero lo aparcó: pide UI).
