# Arnes de verificacion

## `check-syntax.sh` — comprobar la sintaxis DE VERDAD
    sh tools/verify/check-syntax.sh call-of-war/js/*.js

**`node --check fichero.js` NO COMPRUEBA NADA si el fichero tiene `import`**: Node lo trata como
CommonJS y se rinde en silencio (salida 0). Se descubrio porque un parentesis que faltaba paso el
check tan campante — y con el, toda una sesion de "sintaxis OK" que era humo. Este script copia cada
fichero a `.mjs`, que es lo unico que hace que Node lo parsee como modulo.

## `editor-test.js` — ejercitar el editor CONTRA EL JUEGO VIVO
    python -m http.server 8123                       # desde la raiz del repo
    chrome --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/x about:blank &
    node tools/verify/editor-test.js

Disuelve, fusiona, cambia de ducado y de nacion, y comprueba los invariantes que NADIE ve fallar:
que no queden ids muertos en el raster, que los ejercitos y las capitales no apunten a provincias
que ya no existen, que los ducados se reconstruyan y que el snapshot conserve `duchy0`.

Necesita `dbg.S` (debug.js) y `window.__ed` (main.js). La cache del navegador MIENTE: sin
`Network.setCacheDisabled` se prueba el codigo de hace dos horas.

**Ojo con las pruebas mismas.** `capital === -1` significa "sin capital" y lo lleva NEUTRAL siempre;
la primera version de este arnes lo daba por invalido y casi me hace "arreglar" codigo sano. Cuando
una prueba falle, la primera pregunta es si la equivocada es la prueba.
