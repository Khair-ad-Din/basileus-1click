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

# Servidor local de Sergio
if command -v curl >/dev/null 2>&1 && curl -s -o /dev/null -m 1 http://localhost:8123/ 2>/dev/null; then
    echo "Servidor 8123: vivo -> http://localhost:8123/call-of-war/"
fi

echo "Consejo: /consejo (5 estamentos + arbitro) · /ux (director de UX) · /destilar (poso de sesion)"
echo "======================="
exit 0
