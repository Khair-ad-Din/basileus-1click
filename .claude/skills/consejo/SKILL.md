---
name: consejo
description: "Convoca el consejo de estamentos de Basileus sobre un diseño, un sistema o un diff. Los cinco estamentos de 1444 (campesino, artesano, mercader, noble, clérigo) lo revisan en paralelo desde su vida material, el cronista verifica los datos dudosos con fuentes, y el consejero arbitra y devuelve UNA lista de decisiones priorizada. Úsalo antes de construir un bloque nuevo, al revisar un sistema existente, o cuando dudes de si algo es creíble para la época."
argument-hint: "[sistema | archivo | idea de diseño] [--solo agente,agente] [--rapido]"
---

# /consejo — el consejo de estamentos

Cinco voces de 1444 revisan lo que estamos diseñando, un historiador verifica que no se inventen
nada, y un árbitro te devuelve **una** recomendación en vez de cinco opiniones.

**La regla que gobierna todo esto:** la simulación puede ser profunda; la interfaz tiene que seguir
siendo simple. Ver `.claude/docs/consejo-protocolo.md`.

---

## Fase 1 — Acotar

Del argumento, saca **qué se revisa**:

- **Un sistema** (`economía`, `mercado`, `diplomacia`, `guerra`, `población`, `impuestos`…) → localiza
  su código en `call-of-war/js/` y quédate con las partes relevantes.
- **Un archivo o rango** → léelo.
- **Sin argumento** o **una idea en prosa** (p. ej. "quiero que la nobleza pueda negarse a la leva")
  → el objeto de revisión es la idea; añade el código con el que chocaría.
- **`diff`** → `git diff` (o `git diff HEAD~1` si el árbol está limpio).

Si el argumento es ambiguo, **no preguntes**: elige lo más probable, dilo en una línea y sigue.
El consejo es barato; equivocarse de alcance cuesta menos que interrumpir a Sergio.

**Prepara un dossier común** (el mismo texto para los cinco): qué se revisa, el código pertinente
citado con `archivo:línea`, y lo que Sergio ha pedido. Sin este dossier cada estamento explora por
su cuenta y gastas cinco veces lo mismo.

## Fase 2 — Convocar (en paralelo)

Lanza **en un solo mensaje** los cinco `Agent` (o los de `--solo`), con `run_in_background: false`:

`campesino` · `artesano` · `mercader` · `noble` · `clerigo`

A cada uno pásale: el dossier íntegro + *"Emite tu veredicto según `.claude/docs/consejo-protocolo.md`.
Máximo 5 hallazgos."*

Elige a quién convocas por sentido común, no por ritual: un cambio de UI del mercado no necesita al
clérigo. Pero **ante la duda, convócalos a todos** — el valor está en el hallazgo que no esperabas,
y ese suele venir del estamento que parecía no pintar nada.

Con `--rapido`, sáltate la fase 3.

## Fase 3 — Verificar

Recoge de los cinco veredictos toda afirmación con **`Confianza: baja`** (y las `media` que sostengan
un hallazgo importante). Si no hay ninguna, sáltate la fase.

Lanza **un solo** `cronista` con la lista completa: *"Verifica estas afirmaciones con fuentes según
tu oficio 1. Una sola pasada."* Un cronista con diez afirmaciones es mucho más barato que diez
cronistas — y ve las contradicciones entre ellas.

## Fase 4 — Arbitrar

Lanza el `consejero` con: los cinco veredictos **íntegros** + el dictamen del cronista + el dossier.

*"Arbitra según tu protocolo. Devuelve el dictamen con las decisiones priorizadas."*

## Fase 5 — Presentar

Muestra a Sergio, en este orden:

1. **El dictamen del consejero** — es la respuesta. Va primero, entero.
2. **Un índice de las voces**: una línea por estamento con su veredicto (✅/⚠️/❌) y su
   "si solo me dan una cosa". Compacto.
3. **Los veredictos completos**, solo si aportan algo que el dictamen no recoja.

No repitas el mismo hallazgo tres veces con distinto envoltorio. Si el consejero ya lo dijo, está dicho.

Cierra ofreciendo lo obvio: *¿ejecutamos la decisión 1?* Y si Sergio decide algo —acepta, aparca o
descarta—, **acuérdate de `/destilar`**: si no, el estamento volverá a pedir lo mismo el mes que viene.

---

## Cuándo NO usar esto

- Para arreglar un bug. El consejo revisa **diseño**, no corrección.
- Para una decisión de UI. Eso es `/ux`.
- Para algo ya decidido y archivado en `.claude/agent-memory/`. Míralo antes.
