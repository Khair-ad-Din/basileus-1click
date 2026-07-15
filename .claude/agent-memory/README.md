# Memoria de los agentes del consejo

Un archivo por agente: `campesino.md`, `artesano.md`, `mercader.md`, `noble.md`, `clerigo.md`,
`consejero.md`, `cronista.md`, `ux-director.md`, `escribano.md`. **Si no existe, no pasa nada** —
cada agente lo lee solo si está.

**Para qué sirve:** es lo que hace que el consejo **aprenda**. Cuando Sergio acepta, aparca o
descarta una propuesta, ese agente tiene que enterarse o volverá a pedir exactamente lo mismo en el
próximo `/consejo`. Sin esto, el consejo es un oráculo con amnesia.

**Quién escribe aquí:** los agentes NO (son de solo lectura). Lo alimenta `/destilar` con el
escribano, y siempre con Sergio aprobando. Deliberado: así el "entrenamiento" es un paso revisado,
no algo que pasa a espaldas de nadie.

## Formato

Una línea por decisión, la más reciente arriba:

```
2026-07-15 — [DESCARTADO] Partir el burgues en artesano y mercader → Sergio: no; ademas la ficha
             dice que el lanaiuolo era un mercader que no tejia, asi que el estamento unico es
             historicamente correcto.
2026-07-15 — [ENTRA] Sacar `piedra` del bucle de arbitraje → coste 🟢, una linea que RESTA.
2026-07-15 — [ESPERA] Coste de transporte por distancia (haversine) → despues del embargo.
```

Estados y **quién puede cerrar cada uno**:

| Estado | Lo cierra | Regla |
|---|---|---|
| `ENTRA` · `ESPERA` · `DESCARTADO` | **Sergio** | Siempre con **su** porqué |
| `CERRADO POR EVIDENCIA` | **El cronista con fuentes**, o el consejero arbitrando | Cita la **fuente y su fiabilidad**. No necesita la firma de Sergio |
| `SIGUE VIVO` | — | Lo que el consejo propuso y **nadie ha decidido**. Anótalo o parecerá descartado |

**Nunca le pongas palabras en la boca a Sergio.** Atribuye cada cierre a quien lo cerró de verdad.
Un cierre por evidencia es **más duradero** que un "no": para reabrirlo hace falta **una fuente mejor**,
no cambiar de opinión.

**Y lo más importante: si el hecho de fondo sobrevive al descarte, DILO en la misma línea.** Casi
siempre pasa — se tumba la *propuesta*, no el *hallazgo*. Una memoria que entierra el hallazgo bueno
junto con la propuesta mala hace más daño que no escribir nada.

## Qué NO va aquí

- Hechos históricos → van a la ficha (`design/epoca/`), que es donde está el aparato de fuentes.
- Decisiones de arquitectura con alternativas → van a un ADR (`design/adr/`).
- Preferencias generales de Sergio o estado del proyecto → van a la memoria del proyecto.

Aquí solo va **lo que ya se debatió y se cerró**, para no volver a debatirlo.
