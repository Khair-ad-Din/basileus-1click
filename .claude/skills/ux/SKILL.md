---
name: ux
description: "Pasa el director de UX por una pantalla, un panel o un diseño de interfaz de Basileus. Revisa desde los ojos del jugador con EU4 como patrón de referencia, aplica la regla de nada-de-texto-explicativo, y propone reutilizando los componentes que ya existen. Úsalo al planear una ventana nueva, al revisar una existente, o cuando el consejo proponga algo que haya que hacer visible."
argument-hint: "[panel | archivo | idea de interfaz] [--planear]"
---

# /ux — el director de UX

**Dos reglas que no se negocian:** nada de texto explicativo visible (todo tras una "i"), y EU4 es
el patrón de referencia. Ver `design/ux/guia-estilo.md`.

---

## Fase 1 — Acotar

- **Un panel** (`tesorería`, `mercado`, `diplomacia`, `estamentos`, `ficha de provincia`,
  `prosperidad`, `registro`, `topbar`…) → localiza su `refreshX()` en `ui.js` y su HTML/CSS en
  `index.html`.
- **Un archivo o rango** → léelo.
- **Una idea** ("cómo enseño la nobleza interior") → `--planear`: es diseño desde cero, no revisión.
- **Sin argumento** → revisa lo último tocado (`git diff`) si toca UI; si no, pregunta qué panel.

## Fase 2 — Ver de verdad

**Esto es lo que separa una revisión útil de un ensayo.** El director lee código, pero el jugador ve
píxeles. Cuando se pueda, **mira la pantalla**:

Arnés de captura (está en la memoria del proyecto, `basileus-dev-workflow`, y funciona):
servidor estático → copia de `index.html` a `call-of-war/_test_index.html` con un `<script type=module>`
apendido que auto-clica la nación y monta el escenario → `chrome.exe --headless=new --screenshot`
→ leer el PNG con `Read`.

**Trampas que te van a morder** (ambas están documentadas y ambas han costado tiempo):
- Calcula el corte SIEMPRE, nunca uses un `head -N` fijo:
  `MAINLINE=$(grep -n 'src="./js/main.js"' index.html | cut -d: -f1); CUT=$((MAINLINE-1))`.
  Si cortas antes, te quedas sin `MAPDATA` y el juego no arranca en silencio.
- **Borra `_test_index.html` del repo al acabar.** Verifícalo con `ls`.

Si montar la captura cuesta más que el hallazgo, revisa sobre el código y **dilo**: el veredicto vale
menos y Sergio tiene que saberlo.

## Fase 3 — Revisar

Lanza el `Agent` **`ux-director`** con: el objeto de la revisión, el código pertinente, la captura si
la hay, y el contexto de qué intenta conseguir la pantalla.

Con `--planear`, el encargo cambia: no es auditar, es **proponer 2-3 diseños alternativos** con su
ASCII y su coste, y recomendar uno.

## Fase 4 — Presentar

El veredicto del director, tal cual. Luego, si hay captura, enséñala.

Cierra con **lo primero que arreglaría** y ofrece ejecutarlo.

---

## El listón

Un hallazgo de UX vale si nombra **el elemento, el archivo y la línea**. "Mejorar la jerarquía
visual" no es un hallazgo: es una queja. Si el director te devuelve prosa vaga, devuélvesela.

## Deuda conocida (no la redescubras)

Ya está inventariada en `design/ux/guia-estilo.md`: los sitios que violan la regla del texto, los
cinco dialectos de cerrar ventana, el escudo `.esc` a medio migrar, los overlays que no se
auto-refrescan. **Si el director "descubre" algo de esa lista, es que no leyó la guía.**
