#!/bin/sh
# PreToolUse(Bash): corta `node --check` sobre un .js del juego.
#
# POR QUE EXISTE: `node --check fichero.js` NO COMPRUEBA NADA si el fichero tiene `import`. Node lo
# trata como CommonJS, detecta sintaxis de modulo y se rinde EN SILENCIO devolviendo 0. Una sesion
# entera de "sintaxis OK" fue humo; se descubrio porque a un fichero le faltaba un parentesis y paso
# el check tan campante. Los modulos de call-of-war/js/ TODOS llevan `import`.
#
# El comprobador bueno copia a .mjs, que es lo unico que hace que Node parsee como modulo:
#     sh tools/verify/check-syntax.sh call-of-war/js/*.js
#
# Verificado: fichero roto como .js -> salida 0 (pasa); el mismo como .mjs -> SyntaxError.

CMD=$(cat | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)

case "$CMD" in
  *"node --check"*.js*|*"node -c "*.js*)
    case "$CMD" in
      *.mjs*) exit 0 ;;   # sobre .mjs si vale
    esac
    cat >&2 <<'MSG'
`node --check` sobre un .js con `import` NO COMPRUEBA NADA: Node lo trata como CommonJS y se rinde
en SILENCIO devolviendo 0. Ya paso una vez — un parentesis que faltaba supero el check y con el toda
una tanda de "sintaxis OK" que era humo.

Usa el que comprueba de verdad (copia a .mjs, que es lo unico que Node parsea como modulo):

    sh tools/verify/check-syntax.sh call-of-war/js/*.js
MSG
    exit 2 ;;
esac
exit 0
