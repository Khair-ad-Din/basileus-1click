---
name: destilar
description: "Destila la sesión de trabajo en poso duradero: qué merece convertirse en hook automático, ADR de decisión, memoria de proyecto o memoria de un agente del consejo. Úsalo al cerrar una sesión larga o un bloque de trabajo, cuando una regla se haya repetido sin quedar escrita, o cuando Sergio acepte/descarte una propuesta del consejo (para que ese estamento no la vuelva a pedir)."
argument-hint: "[--sesion | --consejo | --todo]"
---

# /destilar — el escribano

Saca del chat lo que merece sobrevivir, antes de que se pierda y lo redescubramos dentro de tres
semanas perdiendo una tarde.

**El listón es alto a propósito.** "Nada que destilar" es el resultado normal y correcto. Un hook de
más se ejecuta para siempre y nadie lo borra nunca.

---

## Fase 1 — Reunir el material

**Escribe tú el digesto.** Tienes la sesión en contexto; el escribano no. Sé concreto y honesto —
incluye los tropiezos, que es donde está el poso:

- **Qué se construyó o decidió**, con archivos.
- **Qué se rompió, qué costó tiempo, qué se descubrió a base de perderlo.** *Esta es la sección que
  produce hooks.* Si algo te mordió, dilo aunque quede feo: fue exactamente el punto del ejercicio.
- **Qué reglas o preferencias dijo Sergio**, con sus palabras literales cuando sea posible.
- **Qué se propuso y qué se aceptó/aparcó/descartó** (esto alimenta las memorias de agente).
- **Qué se repitió por segunda o tercera vez.** La repetición es la señal más fuerte de todas.

Si la sesión fue larga o hubo compactación, busca el transcript para rellenar huecos:
`~/.claude/projects/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/*.jsonl` (el más reciente),
y pásale la ruta al escribano — puede grepearla.

**Argumentos:**
- `--consejo` → solo el poso del último `/consejo`: qué decidió Sergio sobre cada propuesta →
  memorias de agente. Es el uso más frecuente y el más valioso.
- `--sesion` (por defecto) → toda la sesión.
- `--todo` → además, revisa si algo ya sabido sigue sin escribir en ninguna parte.

## Fase 2 — Destilar

Lanza el `Agent` **`escribano`** con el digesto (+ la ruta del transcript si la tienes).

## Fase 3 — Presentar y aplicar

Enseña las propuestas tal cual, incluido el **"considerado y descartado"** — le dice a Sergio que se
ha mirado de verdad y no es relleno.

Sobre cada una, pregunta. Y aplica solo lo aprobado:

| Destino | Dónde | Cuidado con |
|---|---|---|
| 🪝 **Hook** | `.claude/hooks/` + cablear en `.claude/settings.json` | **Pruébalo antes de cablearlo** (§Verificación). Un hook roto rompe todas las llamadas a esa tool. |
| 📐 **ADR** | `design/adr/NNNN-titulo.md` | Numera correlativo. Incluye las consecuencias **malas**. |
| 🧠 **Memoria** | El sistema de memoria + su línea en `MEMORY.md` | Actualiza el archivo que ya cubre el tema; no dupliques. |
| ⚔️ **Memoria de agente** | `.claude/agent-memory/<agente>.md` | Una línea, con fecha y el porqué de Sergio. |

## Verificación (obligatoria para hooks)

Un hook nuevo se prueba **antes** de cablearlo, alimentándole por stdin el JSON que recibiría:

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"call-of-war/js/ui.js","new_string":"..."}}' \
  | bash .claude/hooks/tu-hook.sh; echo "exit=$?"
```

Comprueba **los dos casos**: que salta con el caso malo, y —más importante— **que calla con el caso
bueno**. Un hook que avisa siempre se ignora siempre, y entonces no avisa nunca.

---

## Cuándo NO usar esto

- A media sesión. El poso se ve al final, con el resultado delante.
- Para documentar lo que el código ya cuenta. Eso no es memoria: es ruido en el índice.
- Para guardar algo que solo importa en esta conversación.
