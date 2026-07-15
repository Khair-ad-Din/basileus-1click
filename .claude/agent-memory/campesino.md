# Memoria — campesino

- **2026-07-15 — [ENTRA] Cosecha: shock COMÚN de año + idiosincrático de provincia, con cola izquierda**
  (`HARVEST_COMMON=0.70`, `HARVEST_TAIL_P=0.014`) y `flujoBase` multiplicando por `harvestMul`.
  → **Sergio: "Adelante".** Implementado y commiteado (`ec22e0a`).
  El fallo real no era el que decía tu ficha: `harvestMul` **ya existía** y su amplitud ya estaba casi
  clavada (CV 0,190 vs 0,205 histórico). Lo que fallaba era que **el sorteo era independiente por
  provincia** → un reino de 50 promediaba su CV a **0,027** y la cosecha no existía a escala de reino.
  **Se rechazó subir `HARVEST_AMP`**: sobraba simetría, no amplitud.
  **Consecuencia mala ACEPTADA, no es un bug:** el mantenimiento es fijo → el neto se apalanca (CV≈0,8) y
  la corona cierra en déficit ~27 de cada 200 años. Si alguna vez es demasiado, la perilla es
  `HARVEST_COMMON`, no `HARVEST_AMP`.

- **2026-07-15 — [CERRADO POR EVIDENCIA] AR(1) / correlación serial en la cosecha.**
  → El Cronista lo tumbó con **Campbell & Ó Gráda (JEH 71:4, fiab. A)** — la misma fuente `[4]` que tu ficha
  citaba **mal**: los déficits encadenados >10% ocurrieron solo *"14 per cent more often than 'expected'"*
  sobre la **independencia pura**, y *"evidence on their randomness is **mixed**"*. **Un AR(1) fuerte sería
  tan falso como la independencia.** Lo que faltaba era **cola** y **correlación espacial**, no memoria —
  y ambas entraron en `ec22e0a`. El "dos años malos seguidos 1 de cada 9" resultante sale de pura
  independencia (histórico ≈1 de cada 12). **No lo reabras.** (Tu ficha ya está corregida en los dos sitios
  donde lo pedía.)

- **2026-07-15 — [CERRADO POR EVIDENCIA] `WEALTH_CAP.campesino=0.02` "prohíbe al labrador acomodado".**
  → **`WEALTH_CAP` es CÓDIGO MUERTO**: cero usos en `js/` (`economy.js:958` dice *"sin TOPE artificial (se
  quitó)"*). El hecho histórico sobrevive intacto (el *farmer* es el personaje central del XV; Robert Parman
  arrendó un dominio abacial por £10/año **en 1443**), pero **el mecanismo era inventado**: el hueco real es
  que el estamento `campesino` es **homogéneo**, no que haya un tope. De aquí salió la §6.bis del protocolo.

- **2026-07-15 — [SIGUE VIVO, sin decidir]** Renta fija en dinero como alternativa a `MANOR_RENT`
  proporcional; estratificación interna del campesinado (proxy barato: `structPPF`); `NEED_BASIC.{piedra,metal}`
  inerte (el Cronista confirmó que **no hay fuente**, pero *por ausencia de prueba* — no es lo mismo que "el
  campesino no usaba hierro"). El Consejero aparcó los tres.
