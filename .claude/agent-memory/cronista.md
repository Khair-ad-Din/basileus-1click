# Memoria — cronista

- **2026-07-15 — [CERRADO POR EVIDENCIA] Fusionar los cinco `design/epoca/_fuentes-<estamento>.md` en un
  `bibliografia.md` único y renumerado.**
  → **Rompería las ~700 marcas `[N]` de las cinco fichas, y las rompería EN SILENCIO**: nada falla, las
  citas solo dejan de apuntar donde dicen. Los archivos separados **NO son escombro pendiente de limpiar**:
  son el diseño, y además nacieron de que los cronistas en paralelo se pisaban escribiendo el mismo archivo.
  `bibliografia.md` es **índice y guía de método**: ahí solo se **AGREGA** (método, deudas grandes, y las
  fuentes que resuelven choques *entre* fichas). **Nunca se refunde.** (Tu prompt ya está corregido; antes
  te mandaba lo contrario.)

- **2026-07-15 — [MÉTODO, vale oro]** WebFetch no parsea PDFs, pero **hay dos vías probadas**: `curl` +
  `pdftotext -layout` (ya tienes **Bash**; antes no lo tenías y tu propio prompt te mandaba usarlo), y
  **`https://r.jina.ai/<url>`** con WebFetch. Con ellas entraron Campbell & Ó Gráda, de Roover (545 pp.),
  Munro, Prestwich y la *Agricultural History Review*. **`erenow.org` espeja la New Cambridge Medieval
  History vol. VII (1415-1500)** — el volumen exacto de la época; resolvió la tabla de % de nobleza.

- **2026-07-15 — [TRAMPA que casi envenena una ficha]** **WebFetch ALUCINA sobre PDFs.** Pedido a pelo,
  devolvió unos CV **inventados** ("trigo 0,20-0,25") que contradecían la extracción buena. Se cazaron solo
  porque se cruzaron con ella. **Si la respuesta viene con "binary content", lo que la acompaña es humo:
  descártalo entero**, no lo cites "con reservas".

- **2026-07-15 — [DATO CADUCO ya identificado, no lo re-investigues]** La única cifra de reparto
  realengo/señorío/abadengo que circula (**Albacete 61,1 / 25,8 / 13,1**; Murcia 52,7 / 24,4 / 22,4,
  Murgetana 69) **es de 1752** — 300 años tarde. Estaba marcada *"fecha incierta, NO USAR"* en
  `_fuentes-clerigo.md [20]`; queda confirmada y **descartada para 1444**. La fracción del campo bajo
  señorío eclesiástico vs laico en 1444 sigue **❓**.

- **2026-07-15 — [DEUDA]** `MANOR_RENT.solariego=0.28` **no está desmentido: está SIN VERIFICAR.** Ninguna
  fuente accesible da una fracción defendible del bruto campesino; lo que circula mezcla diezmo + renta +
  impuesto + banalidades sin declarar la base. Alemania e Italia siguen ❓ en la tabla de % de nobleza (el
  "1-3%" del Imperio de `noble.md` no se pudo confirmar en la NCMH).
