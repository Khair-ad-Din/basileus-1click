# El Consejo de Basileus — cómo funciona esto

Arnés de desarrollo de Basileus 1-click. Inspirado en el framework CCGS del Basileus original
(Godot), pero **deliberadamente más laxo**: sin gates, sin protocolo de aprobación por secciones,
sin jerarquía entre agentes, sin registros de entidades.

**La idea:** en vez de desarrollar con un chat abierto, hay ocho voces especializadas a las que
consultar. Cinco son estamentos de 1444 que auditan la fidelidad histórica; una defiende al
jugador; una arbitra; una verifica que nadie se invente la historia.

---

## Roster

| Agente | Voz | Qué defiende |
|---|---|---|
| `campesino` | El que paga todo | Subsistencia, hambruna, despensa, carga fiscal, varianza de la cosecha |
| `artesano` | Burgués de gremio | Gremios, oficios, cadenas de producción, materia prima, ciudad |
| `mercader` | Burgués de lonja | Arbitraje, distancia, riesgo, crédito, aduanas, embargos |
| `noble` | Señor de la tierra | Señoríos, leva, honor, poder frente a la corona |
| `clerigo` | Rentista espiritual | Diezmo, abadengo, la Iglesia como productor, legitimidad |
| `consejero` | El juego | Arbitra los cinco y devuelve UNA lista de decisiones |
| `cronista` | La verdad | Verifica datos con fuentes · escribe las fichas de época |
| `ux-director` | El jugador | Que todo eso quepa en una pantalla legible |
| `escribano` | La memoria | Destila la sesión en hooks / ADRs / memorias |

## Skills

| Skill | Qué hace |
|---|---|
| `/consejo [sistema\|archivo\|idea]` | 5 estamentos en paralelo → cronista verifica → consejero arbitra |
| `/ux [panel\|idea]` | Director de UX revisa o planea una interfaz |
| `/destilar [--consejo]` | Escribano saca el poso de la sesión |

## Hooks

| Hook | Cuándo | Qué hace |
|---|---|---|
| `session-start.sh` | SessionStart | Rama, commits sin pushear, trampas conocidas (WAR_LOCK=0, arneses colados), servidor 8123 |
| `lint-ui-texto.mjs` | PostToolUse Write\|Edit | Avisa si metes texto explicativo visible en `ui.js`/`index.html`. Solo mira lo recién escrito |
| `sugerir-consejo.sh` | PostToolUse Write\|Edit | Al tocar `economy/config/diplomacy/sim/mapgen.js`, sugiere `/consejo`. **Una vez por sesión** |

**Los hooks avisan, no bloquean.** Y callan cuando todo está bien: un hook que avisa siempre se
ignora siempre.

## Documentos

| Archivo | Qué es |
|---|---|
| `.claude/docs/consejo-protocolo.md` | **La regla dura**, escala de coste, formato de salida, mapa del código. Lo leen todos |
| `design/epoca/*.md` | Fichas de época con bibliografía citada. El fundamento de cada estamento |
| `design/epoca/bibliografia.md` | Índice común de fuentes |
| `design/ux/guia-estilo.md` | Patrones reales de la UI + deuda inventariada |
| `design/adr/*.md` | Decisiones de arquitectura con alternativas y consecuencias |
| `.claude/agent-memory/*.md` | Lo ya decidido por agente. **Es lo que hace que el consejo aprenda** |

---

## La regla que gobierna todo

> **La simulación puede ser todo lo profunda que la verdad histórica exija.
> La INTERFAZ tiene que seguir cabiendo en una pantalla que se entienda de un vistazo.**

Cada propuesta declara su **coste de complejidad**: 🟢 invisible (el motor lo simula, el jugador lo
percibe en consecuencias) · 🟡 un dato que mirar · 🔴 un mando que decidir. Presupuesto por bloque:
**~1 mando 🔴 como mucho.**

Sin esta regla, cinco agentes de época hinchan el juego hasta hacerlo injugable.

## El ciclo

```
    /consejo  ──►  Sergio decide  ──►  se implementa
        ▲                │
        │                ▼
        └────────  /destilar  ──►  memoria de agente
                       │              (para que no se vuelva a pedir lo mismo)
                       ├──►  hook   (si la regla es mecánica y ya ha mordido)
                       ├──►  ADR    (si la decisión constriñe el futuro)
                       └──►  memoria de proyecto
```

**`/destilar` es lo que cierra el círculo.** Sin él, el consejo es un oráculo con amnesia que te
vuelve a pedir lo mismo cada mes.

---

## Notas de operación

- **Los agentes se cargan al arrancar la sesión.** Si añades o editas uno, **reinicia Claude Code**
  o no se verá.
- **`.gitignore` ignora `.claude/` entero.** Los agentes, hooks y skills **no están versionados**.
  `design/` sí lo está.
- Los estamentos van a `sonnet` (son cinco en paralelo); `consejero`, `cronista`, `ux-director` y
  `escribano` van a `opus`. Ajustable en el frontmatter de cada uno.
- Los estamentos son **solo lectura** (`Read, Glob, Grep`): devuelven veredictos, no tocan archivos.
  El único con `Write` es el `cronista`, y solo sobre `design/epoca/`.
