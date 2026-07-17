#!/bin/sh
# node --check sobre un .js con `import` NO COMPRUEBA NADA (Node lo trata como CommonJS y se rinde
# en silencio). Hay que copiarlo a .mjs para que lo parsee como modulo. Verificado con un fichero
# roto a proposito: .js -> salida 0; .mjs -> SyntaxError.
ok=0; mal=0
for f in "$@"; do
  cp "$f" "/c/tmp/_chk.mjs"
  if node --check "/c/tmp/_chk.mjs" 2>/tmp/_err; then ok=$((ok+1));
  else mal=$((mal+1)); echo "ROTO: $f"; sed -n '2,4p' /tmp/_err; fi
done
echo "sintaxis: $ok bien · $mal ROTOS"
