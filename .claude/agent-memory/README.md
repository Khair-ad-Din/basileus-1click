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

Estados: `ENTRA` · `ESPERA` · `DESCARTADO`. **Siempre con el porqué de Sergio**, no solo el veredicto:
un "no" sin motivo no enseña nada y el agente lo reabrirá con otra forma.

## Qué NO va aquí

- Hechos históricos → van a la ficha (`design/epoca/`), que es donde está el aparato de fuentes.
- Decisiones de arquitectura con alternativas → van a un ADR (`design/adr/`).
- Preferencias generales de Sergio o estado del proyecto → van a la memoria del proyecto.

Aquí solo va **lo que ya se debatió y se cerró**, para no volver a debatirlo.
