---
name: simular
description: "Lanza, sigue y lee las SIMULACIONES LARGAS de la economía de Basileus en GitHub Actions (nunca en el PC de Sergio). Úsalo siempre que haya que medir o calibrar algo a más de ~5 años (población, hambre, capacidad agraria, precios, renta, variantes de constantes), al comparar variantes de una perilla, o cuando Sergio pregunte por resultados de una simulación en curso."
argument-hint: "[lanzar <nombre> [variantes] [--años N] | estado [nombre] | resultados <nombre>]"
---

# /simular — simulaciones largas en GitHub Actions

**La regla:** una simulación de más de 5 años **no** se corre en el portátil de Sergio. Allí 80 años son horas (2-6 min
por año), varias a la vez se pelean por la CPU, y al cerrar la tapa se pausa. En GitHub (repo público: gratis, 4
núcleos, máx. 6 h por trabajo) cada variante corre en su propia máquina, en paralelo, en ~1-2 h. Un hook
(`.claude/hooks/sim-en-github.mjs`) corta las corridas largas en local; el inicio de sesión lista las simulaciones
recientes.

## Las piezas

| Pieza | Qué hace |
|---|---|
| `tools/capacidad-probe.mjs` | La sonda: mundo oficial + economía v2 sin IA ni guerras, N años. Por región y década: ocupación x, hambre, muertos, precio del grano, techo ×3, renta; al final ADELANTADOS (N.agro ×1,1 cada 20 años) frente a ATRASADOS |
| `tools/sim-variants.json` | Las VARIANTES: cambios de texto exactos sobre una copia de `call-of-war` (`[archivo, texto actual, texto nuevo]`). `run` = las que se lanzan; `years` = años (80 por defecto) |
| `tools/sim-run.mjs <variante> [años] [década]` | Copia el juego, aplica la variante (falla si un texto no aparece exactamente una vez) y corre la sonda |
| `.github/workflows/simulacion.yml` | Push a `sim/**` → un trabajo por variante en paralelo; artefacto `sim-<variante>` + resumen en la página |
| `tools/sim.mjs` | **El único comando que hace falta** (abajo) |

## Procedimiento

1. **Define las variantes** en `tools/sim-variants.json`. Copia el texto actual EXACTO de la constante (`grep -n` antes)
   y deja siempre una variante de **control** (la calibración vigente) para comparar en las mismas condiciones.
2. **Prueba de humo en local** (≤ 5 años; el hook la deja pasar): `node tools/sim-run.mjs <variante> 1 1`. Caza la
   variante que no encaja y el error de sintaxis antes de gastar una hora.
3. **Lanza:** `node tools/sim.mjs lanzar <nombre> [variante...] [--años N]`. Simula **lo que hay en disco**, commiteado
   o no: hace una instantánea con un índice temporal y la empuja a `sim/<nombre>` sin tocar la rama de trabajo, el
   índice ni HEAD. Devuelve la URL de la ejecución.
4. **Sigue:** `node tools/sim.mjs estado [nombre]` (minutos que lleva cada trabajo; GitHub no da el log hasta que acaba).
   Para esperar sin bloquear la conversación: `gh run watch <id> --interval 120` en segundo plano (`run_in_background`).
   No hace falta que el PC siga encendido: Sergio puede cerrar la tapa.
5. **Lee:** `node tools/sim.mjs resultados <nombre>` → baja los textos a `tools/sim-out/<id>/` (ignorado por git) e
   imprime el resumen adelantados/atrasados de cada variante. El texto completo (por región y década) está en el archivo.
6. **Apunta** el resultado en el `design/*.md` del sistema (tabla por variante + lectura + siguiente paso) y en la
   memoria. Los artefactos de GitHub caducan a los 90 días.

## Trampas conocidas

- **Empujar a `sim/**` un commit que ya existía en otra rama NO dispara el workflow** (pasó el 2026-10-25). `sim.mjs`
  crea siempre un commit nuevo; no empujes ramas sim a mano.
- `workflow_dispatch` (botón "Run workflow") solo funciona si el workflow está en `master`, y `master` es el deploy de
  Pages: no se toca para esto. El disparador es el push a `sim/**`.
- Las ramas `sim/*` son públicas (el repo lo es). Se pueden borrar al acabar: `git push origin --delete sim/<nombre>`.
- La sonda no corre la IA ni las guerras: mide la economía pura. Si una conclusión depende de la IA, dilo.
- Una medición nueva necesita su sonda en `tools/` (commiteada o no: `lanzar` sube lo que hay en disco) y, si no es
  `capacidad-probe.mjs`, que `sim-run.mjs` la llame (hoy llama a esa).
