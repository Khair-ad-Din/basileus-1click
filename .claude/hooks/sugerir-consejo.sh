#!/bin/bash
# PostToolUse (Write|Edit) — Al tocar un modulo que LLEVA DISENO (no UI, no fontaneria),
# sugiere pasar el consejo de estamentos. UNA VEZ POR SESION: un aviso repetido se ignora.
#
# Es una SUGERENCIA, nunca un gate. Sergio decide.

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    SID=$(echo "$INPUT" | jq -r '.session_id // "x"')
else
    FILE=$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//')
    SID=$(echo "$INPUT" | grep -oE '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//')
fi
[ -z "$FILE" ] && exit 0
[ -z "$SID" ] && SID="x"

# Modulos donde vive el DISENO del mundo. ui.js/render.js/save.js quedan fuera a proposito:
# esos son de /ux o de fontaneria, y el consejo no pinta nada ahi.
case "${FILE//\\//}" in
    */call-of-war/js/economy.js|*/call-of-war/js/config.js|*/call-of-war/js/diplomacy.js|*/call-of-war/js/sim.js|*/call-of-war/js/mapgen.js) ;;
    *) exit 0 ;;
esac

MARK=".claude/.state/consejo-$SID"
[ -f "$MARK" ] && exit 0
mkdir -p .claude/.state 2>/dev/null
touch "$MARK" 2>/dev/null

MOD=$(basename "${FILE//\\//}")

cat >&2 <<EOF
SUGERENCIA (una vez por sesion, no es un gate)

Estas tocando $MOD, que lleva DISENO del mundo, no fontaneria.

Si lo que estas haciendo cambia COMO FUNCIONA el mundo (no si arreglas un bug ni si mueves
codigo), plantea a Sergio pasar /consejo: los cinco estamentos de 1444 lo miran en paralelo,
el cronista verifica los datos y el consejero arbitra.

Si es un bug, un refactor o algo ya decidido: ignora esto y sigue. No vuelve a salir.
EOF
exit 2
