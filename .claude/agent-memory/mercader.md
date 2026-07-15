# Memoria — mercader

- **2026-07-15 — [ENTRA] Mercado localizado: coste de transporte por par + embargo + guerra.**
  → **Sergio: "Vamos a la 2".** Implementado y commiteado (`703ad1a`). **Tu escándalo principal está
  resuelto: `TRADE_COST=0` ya no existe.**
  `tradeCost(g,a,b)` = `kmBetween(capitales)` × `TRADE_BULK[RES_CAT[g]]`, descuento marítimo 0.68 si ambas
  capitales son costeras, ×3 si hay guerra, **Infinity si hay embargo**. Calibrado con tus dos anclas
  (grano Danzig→Brujas ~1100 km ≈ 50%; sal Portugal→Brujas ~1800 km ≈ 85% → las dos dan ~4.6e-4/km).
  **Tu diagnóstico era correcto y tu implementación NO:** el consejero te corrigió y tenía razón. Poner el
  coste en el margen (`:1082`) solo te habría recortado el beneficio **mientras el stock seguía viajando y
  los precios convergiendo global**. El coste va en el **test de rentabilidad**, y el `break` tuvo que
  pasar a `continue` (con coste por par, que los extremos no sean rentables ya no implica que ningún par lo
  sea). **Ese era el cambio estructural.** Recuérdalo la próxima vez que propongas una fórmula.

- **2026-07-15 — [YA NO HACE FALTA] "Restar `piedra` de `MKT_TRADE`"** — era tu petición nº1 ("si solo me
  dan una cosa").
  → **La física lo resuelve, y mejor que el hardcodeo.** Medido tras `703ad1a`: piedra cuesta **49%** del
  valor con un vecino a 328 km y **690%** con uno a 4.611 km; su volumen arbitrado cayó al 5,6%. Ya solo se
  mueve **en la vecindad**, que es justo lo que hacía. Borrarla de la tabla **mataría también el tráfico
  fluvial de corta distancia, que sí existía** → sería overshoot. **No lo pidas otra vez.**
  Bonus medido: **`comida` cayó a 0,0%** — el grano ya no cruza Europa.

- **2026-07-15 — [SIGUE VIVO, sin decidir]** Pérdida de carga por corso en su versión 🟡 (que la carga se
  pierda y se vea). La versión 🟢 (la guerra encarece el par) **ya entró** en `703ad1a` con `TRADE_WAR=3.0`.

- **2026-07-15 — [TÚ MISMO LO APARCASTE, y bien]** Circuito dual oro/plata + deflación de la escasez de
  metálico 1440-70 (cecas de Flandes: 102,7 kg de plata en 1441-45 vs 3.505 kg en 1436-40, −97%). Es real y
  el `dinero` único no lo representa, pero **es sistema nuevo**, no un parche: va contra el encargo de
  "pulir, no añadir". Si algún día entra, que sea una petición aparte y explícita. **Igual de descartados:
  el mapa de nodos de EU4 con flujo direccional y el tipo de barco** (galera vs coca: pesaba tanto como el
  mar —25% vs 5,16% para la misma saca de lana— pero es demasiado ruido para lo que aporta).

- **2026-07-15 — [OJO con tu propio tópico]** No vendas el **8:4:1 tierra:río:mar**: es por **tonelada-milla**,
  no por ruta. En rutas comparables reales el mar solo le ganaba a la tierra **~1,5×** (Brujas→Barcelona
  1398: mar 15% vs tierra 22%). El modelo usa 0.68, coherente con eso.
