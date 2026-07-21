# 0002 — Pops: dataset estático horneado de fuentes 1450, tabla única

## Contexto
Dos tablas de núcleo urbano coexistían (`cityPop` de cities1444.js vs `CITY_POP` en mapgen.js);
54 de 61 ciudades comunes discrepaban en ambos sentidos. El `pop` era null y se calculaba en carga.
La premisa inicial ("el Este está infravalorado") resultó invertida: cities1444 lo INFLABA.

## Opciones consideradas
- (a) Elegir una de las dos tablas. Cada una acierta en una mitad del mapa; ninguna es buena entera.
- (b) `max()` de ambas. Amplifica los errores al alza de las dos.
- (c) Reconstruir UNA tabla estática con fuentes de ~1450 y hornear el pop en official_map.js.

## Decisión
(c). cities1444.js reconstruida por región con fuentes de 1450 (jerarquía Buringh>Chandler, techo
~50k latino; ver `.claude/agent-memory/cronista.md` y `design/pops-1450/`). CITY_POP retirada del
cálculo (queda solo para nombrado). pop horneado en official_map.js; la carga lo respeta como baseline
de 1450 y la sim evoluciona desde ahí. Umbral urbano CITY_MIN=5000 estricto, sin excepción de sedes.

## Consecuencias
- + Dataset consultable, estático, auditable por región (Sergio: "estático y consultable").
- + Reproducible: `tools/gen-cities1444.mjs` + `tools/gen-pops.mjs`.
- - Trabajo manual grande; re-hornear si cambian las fuentes.
- - Riesgo de doble-horneado: el wasteland debe fijarse ANTES del gen-pops final.
- Constriñe: NO reintroducir una segunda tabla de pops ni volver a max(); el pop se HORNEA, no se
  calcula en carga.

## Estado
Aceptado (2026-07-20).
