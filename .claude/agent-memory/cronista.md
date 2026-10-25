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

- **2026-07-19/20 — [JERARQUÍA DE FUENTES para POBLACIÓN 1450, vale oro]** Al reconstruir pops:
  (1) manda el dato académico de ~1450; si no hay, reconcilia **Buringh > Chandler** (Chandler es el
  que más infla). (2) **Chandler infla el ESTE y las capitales-residencia**: Trakai, Gorkij (Nizhny),
  Târgoviște eran villas de miles, no urbes. (3) **Techo ~50k para la Cristiandad latina** en 1450
  (salvo excepciones italianas/flamencas). (4) `cities1444.js` (derivado de Chandler) INFLA las grandes
  con cifras de pico ~1300 o de ~1500. (5) **NUNCA `max()` de dos tablas**: reconstruye UNA. Detalle por
  región en `design/pops-1450/region-NN.md`, método en `design/pops-1450-metodo.md`.

- **2026-07-19 — [PREFERENCIA DE SERGIO]** Donde la fuente del Este sea floja, tira al **ALTO del rango
  honesto** ("algo más de pops, más fácil de nivelar"). Occidente a la baja, Este al alto — pero SIEMPRE
  dentro del rango defendible, no es licencia para inflar.

- **2026-07-20/21 — [CERRADO POR EVIDENCIA · craft de RADIOS DE MERCADO, no lo re-derives]**
  Radio de venta del **grano** ~1444: **~10 mi / ~16 km** (Farmer, manors de Deverill, Wiltshire,
  *AgHR* 37, 1989). La **lana** (más valor/peso): **~20 mi / ~32 km**. Grano = bien pesado de bajo
  valor, no aguanta flete terrestre largo (Danzig→Brujas ~50% del precio, y por MAR). **TRAMPA:**
  la doctrina "viaje de un día → catchment ~10 mi" es de **Bracton** (c.1216-27), NO del *Statute of
  Winchester* (1285 = orden público) — misatribución común vía Britnell/Nichols; el "6⅔" es
  *separación* entre mercados (leguas mal traducidas como millas). **Sesgo temporal/geográfico:**
  Inglaterra tuvo ~2.000 mercados nuevos 1200-1349 → radios ~10mi solapados; en **1444 post-Peste
  hay MENOS mercados y radios mayores**, y el Continente (Castilla/Polonia/Egipto) probablemente aún
  mayores por menor densidad (❓ sin dato continental abierto). Las mallas eclesiásticas de acopio
  (parroquia/grange, diócesis) NO coinciden con las seculares (ducados). **Fuentes abiertas ya
  localizadas** (empieza por aquí): Alsford *Medieval English Towns* (B), IHR/ESRC *Markets and Fairs
  in 13th-c England* PDF (B), Gazetteer of Markets to 1516 (B). **Deudas D** (de pago): Britnell EcHR
  1981, Farmer AgHR 1989 directo, Masschaele EHR 1992. Motivó el descarte de "plaza=capital del
  ducado" en la Capa 1 (`design/mercado-centros-eu5.md`).

- **2026-07-21 — [PASADA DE VERIFICACIÓN · Fase 2 mercado por centros] 7 afirmaciones dictaminadas:**
  - **BANALIDAD ≠ PORTAZGO (clave de diseño).** Banalidades inglesas (molino, corvea, talla)
    desaparecen c.1390-1420 (**Bailey, AgHR 62, 2014 — A**, `_fuentes-campesino.md [5]`). Pero el
    **portazgo/pontazgo = peaje de TRÁNSITO sobre el comercio, institución DISTINTA**, sí vivo en el
    s.XV: castillos-peaje del Rin (Bacharach Landfriede 1317; 79 estaciones 800-1800, Gardner `[8]`
    mercader). Inglaterra conservó peajes urbanos (murage/pavage/pontage/quayage), no la banalidad
    señorial. Un peaje señorial UNIVERSAL y permanente sobre todo transporte sería anacrónico para
    Ing. 1444; un peaje de tránsito en corredores (Rin/Loira/portazgo castellano) NO.
  - **FRACCIÓN peaje vs flete real = ❓ NO CONCLUYENTE para 1444.** El ancla del mercader "sal
    Portugal→Brujas 85%" (Munro `[3]`) es COSTE TOTAL DE RUTA sobre el valor (sobre todo flete de MAR
    + riesgo + manejo), **NO el peaje**. No hay descomposición peaje-vs-transportista accesible para
    1444 (cifras del Rin son del s.XIII). Dirección cualitativa: por MAR flete+riesgo dominan y el
    peaje es menor; en corredores INTERIORES muy peajeados el peaje acumulado podía ser sustancial
    para granel de bajo valor. Sin %.
  - **NODOS DE PRECIO = centros de comercio, no capitales políticas. CONFIRMADO.** Medici: 8
    sucursales, ninguna al E del Rin/España/Levante (de Roover `[6]` — A). Brujas/Danzig/Nóvgorod/
    Barcelona no eran capitales de estado.
  - **GRANO BÁLTICO de Danzig = fenómeno s.XVI-XVII, no 1444.** "Only really took off in the 16th c";
    patrón regular desde el último cuarto del XV; Danzig 19.000 lasts ~1500 → 80.000 en 1567. En 1444
    la ruta báltica ECLESIÁSTICA documentada movía **CERA** ("wax de Polane" vía Hansa, Sapoznik `[7]`
    clérigo), no grano; los cistercienses ya habían ARRENDADO reservas (Dyer `[9]`, VCH Fountains `[5]`).
    Usar "grano monástico báltico" para 1444 es anacronismo; el bien correcto es cera.
  - **DIEZMO GRUESO = gavilla apartada en el campo, sobre el BRUTO, ANTES de vender → NUNCA dependió
    del mercado. CONFIRMADO** (Dodds `[8]` campesino — A; Martín Riego `[3]` clérigo — A: grueso en
    especie). Matiz: el diezmo MENUDO sí se arrendaba/conmutaba a metálico y ese sí tocaba dinero.
  - **RADIO de mercado local corto (no cientos de km): CONFIRMADO**, ya cerrado arriba (2026-07-20/21).
  - **SUELO de acceso >0 (buhonero/trueque/feria anual en casi toda aldea): cualitativamente sí**
    (Dyer material world `[19]` campesino — A); el **número 10-15% es perilla de DISEÑO, no dato
    histórico**. **Grokipedia** reapareció en las búsquedas de báltico → descartada por norma.

- **2026-09-28 — [PASADA · capacidad agraria, ratio pob. ~1300 / ~1444 por región]** Fuentes en
  `bibliografia.md` (añadidos 2026-09-28). Resultado: Europa ~1,4-1,45 (Malanima vía Pamuk; Russell);
  Inglaterra ~2,3-2,5; Francia ≥1,8; Italia 1,67; Castilla ~1,1-1,3 (crece en el XV); Cataluña ~2;
  Países Bajos ~1,25-1,35; Noruega ~2,2-2,6; Dinamarca ~1,6; **Polonia <1 (0,65-0,7: más gente en
  1444 que en 1340)**; Rus/Balcanes/Anatolia/Magreb ❓. **Clave de diseño:** en fronteras de
  colonización (Polonia, Castilla, Rus, Anatolia) el techo NO es la población de 1300 — usar el
  pico ~1580-1600 como prueba de K. En **Egipto el techo mismo cayó** (riego arruinado >60%).
  **Atajos:** erenow NCMH VII 25.php/26.php = demografía y variación regional; Federico & Malanima
  2004 (Stanford PDF) tabla 4 = Italia; Pamuk 2007 tabla 1 (usar `pdftotext -raw`, -layout la
  descoloca); scholarworks.wmich.edu tiene Cloudflare → `curl r.jina.ai/<url>` sí entra.
