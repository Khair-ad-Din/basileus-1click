#!/bin/bash
# SessionStart — estado del proyecto Basileus 1-click.
# Sale en el contexto de CADA sesion: hay que ser MUY breve. Solo lo accionable.
# Sin stdin.

echo "=== Basileus 1-click ==="

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -n "$BRANCH" ] && echo "Rama: $BRANCH  |  HEAD: $(git log --oneline -1 2>/dev/null)"

# Arbol sucio: cuantos archivos, no la lista entera
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ] && [ -n "$DIRTY" ]; then
    echo "Arbol: $DIRTY archivo(s) sin commitear"
fi

# Commits locales sin pushear (este proyecto los acumula a proposito)
UPSTREAM=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
if [ -n "$UPSTREAM" ]; then
    AHEAD=$(git rev-list --count "$UPSTREAM"..HEAD 2>/dev/null)
    [ -n "$AHEAD" ] && [ "$AHEAD" != "0" ] && echo "Sin pushear: $AHEAD commit(s)  (push a master = DEPLOY a Pages)"
fi

# --- Trampas conocidas (silencio si todo esta bien) ---

# WAR_LOCK_HOURS a 0 = modo test. Nunca debe llegar a Pages.
if grep -rqE 'WAR_LOCK_HOURS\s*=\s*0\b' call-of-war/js/ 2>/dev/null; then
    echo "!! WAR_LOCK_HOURS=0 (modo test) — RESTAURAR a 4*8760 antes de desplegar"
fi

# Arneses de test colandose en el repo
TESTS=$(git ls-files 'call-of-war/_test_*' 'call-of-war/_preview*' 2>/dev/null | head -3)
if [ -n "$TESTS" ]; then
    echo "!! Arnes de test trackeado en git (deberia borrarse):"
    echo "$TESTS" | sed 's/^/   /'
fi

# Servidor local (SIN CACHÉ: tools/serve.mjs manda no-store; nada de python -m http.server, que cachea
# y hacía ver versiones viejas al recargar). Se arranca aqui si esta caido.
if command -v curl >/dev/null 2>&1; then
    if curl -s -o /dev/null -m 1 http://localhost:8123/ 2>/dev/null; then
        echo "Servidor 8123: vivo -> http://localhost:8123/call-of-war/ (sin cache si es serve.mjs)"
    elif command -v node >/dev/null 2>&1; then
        PROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
        ( cd "$PROOT" && nohup node tools/serve.mjs . 8123 >/dev/null 2>&1 & ) 2>/dev/null
        echo "Servidor 8123: arrancado sin cache (tools/serve.mjs) -> http://localhost:8123/call-of-war/"
    fi
fi

# Simulaciones en GitHub Actions (skill /simular): las que corren o terminaron hace poco, para no olvidar resultados.
if command -v gh >/dev/null 2>&1; then
    SIMS=$(timeout 4 gh run list --workflow simulacion.yml --limit 3 --json databaseId,status,conclusion,headBranch,createdAt         -q '.[] | "   \(.headBranch) \(.status) \(.conclusion // "") \(.createdAt[0:10]) (id \(.databaseId))"' 2>/dev/null)
    if [ -n "$SIMS" ]; then
        echo "Simulaciones (GitHub Actions; leer con: node tools/sim.mjs resultados <nombre>):"
        echo "$SIMS"
    fi
fi
echo "Simulaciones largas: SIEMPRE en GitHub -> /simular (node tools/sim.mjs lanzar <nombre>), nunca en el PC"
echo "Consejo: /consejo (5 estamentos + arbitro) · /ux (director de UX) · /destilar (poso de sesion)"
echo "======================="
exit 0
