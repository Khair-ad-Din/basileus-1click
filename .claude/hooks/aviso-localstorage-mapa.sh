#!/bin/bash
# PostToolUse(Write|Edit): al tocar DATOS del mapa que se cachean en localStorage, recuerda UNA VEZ
# por sesion que los cambios NO se ven en un navegador normal hasta limpiar la instantanea.
# POR QUE: initWorld() (main.js) prefiere localStorage 'basileus_provmap' sobre official_map.js y hace
# return sin regenerar. Ni Ctrl+F5 ni "Nueva partida" la invalidan. Mordio 2+ veces entre sesiones
# (pops/labels/Sahara invisibles; Sergio: "veo el mapa como antes"). Avisa, no bloquea.

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

# Solo los DATOS que se cachean: el snapshot oficial, el nucleo de ciudades, y la codegen del mapa.
case "${FILE//\\//}" in
    */official_map.js|*/cities1444.js|*/call-of-war/js/mapgen.js) ;;
    *) exit 0 ;;
esac

MARK=".claude/.state/localstorage-$SID"
[ -f "$MARK" ] && exit 0
mkdir -p .claude/.state 2>/dev/null
touch "$MARK" 2>/dev/null

cat >&2 <<'EOF'
RECORDATORIO (una vez por sesion): acabas de tocar DATOS del mapa. En un navegador normal NO se veran
hasta limpiar la instantanea cacheada (initWorld prefiere localStorage sobre official_map.js; ni Ctrl+F5
ni "Nueva partida" la borran):
    localStorage.removeItem('basileus_provmap');localStorage.removeItem('basileus_anchors');localStorage.removeItem('basileus_save');location.reload()
El arnes headless con --user-data-dir nuevo NO se ve afectado (localStorage limpio).
EOF
exit 2
