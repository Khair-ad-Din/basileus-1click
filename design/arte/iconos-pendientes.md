# Iconos pendientes

> Lista viva de lo que hoy sale como hueco `[ ]` en la interfaz (regla 2 de `design/ux/guia-estilo.md` §1b: nada de
> iconos Unicode). Al crear un icono, se tacha aquí. Actualizada el 2026-10-26.

## Cómo se integran (ya preparado)

| Tipo | Carpeta y nombre | Qué hay que hacer al recibirlo |
|---|---|---|
| Icono de interfaz | `call-of-war/assets/ui/<nombre>.png` | Añadir `<nombre>` a `UI_ART` en `js/ui.js`: todos los `ph("<nombre>")` de la app pasan solos del hueco al sprite |
| Edificio | `call-of-war/assets/buildings/<clave>.png` | Nada: la tarjeta lo carga sola (si falta, pinta el hueco) |
| Bien | `call-of-war/assets/res/<clave>.png` | Añadir la clave a `RES_ART` en `js/config.js` (los 17 bienes ya están) |

Si llegan en una hoja (varios en una imagen), se recortan con el método de la memoria `basileus-art-ui`: fondo blanco
quitado por relleno desde el borde (solo el blanco neutro, para no comerse el interior claro), componentes conexos,
hoja de contacto sobre fondo oscuro para comprobar. Se hizo así con los 7 bienes (commit 600bbe7).

## Estilo

El de los existentes en `assets/res/` y `assets/ui/` (para ver los once bienes juntos: abrir `assets/res/`):

- Pixel art pintado con sombreado suave, sin contorno negro grueso; paleta terrosa y saturada.
- Vista 3/4 ligeramente desde arriba; luz arriba a la izquierda.
- **Fondo transparente**, sombra suave en la base, sin recortar al ras.
- Iconos de interfaz y bienes: **~160-240 px** de lado (se ven a ~16 px). Edificios: **~300-350 × 250-270 px**, una
  construcción entera con algo de terreno, como `granja.png` o `templo.png`.
- Un objeto o grupo compacto que se lea a 16 px: silueta clara antes que detalle.

## Prioridad 1: estamentos y necesidades — HECHA (2026-10-26)

| Icono | Archivo | Motivo sugerido |
|---|---|---|
| ~~Campesinos~~ | `ui/campesino.png` | HECHO (2026-10-26) |
| ~~Burgueses~~ | `ui/burgues.png` | HECHO (2026-10-26) |
| ~~Clero~~ | `ui/clero.png` | HECHO (2026-10-26) |
| ~~Nobleza~~ | `ui/nobleza.png` | HECHO (2026-10-26) |
| ~~Subsistencia~~ | `ui/subsistencia.png` | HECHO (2026-10-26) |
| ~~Comodidades~~ | `ui/comodidades.png` | HECHO (2026-10-26) |
| ~~Lujo~~ | `ui/lujo.png` | HECHO (2026-10-26) |
| ~~Materias~~ | `ui/materias.png` | HECHO (2026-10-26) |

## Prioridad 2: edificios base — HECHA (2026-10-26)

| Edificio | Archivo | Motivo sugerido |
|---|---|---|
| ~~Viñedo~~ | `buildings/vinedo.png` | HECHO (2026-10-26) |
| ~~Salina~~ | `buildings/salina.png` | HECHO (2026-10-26) |
| ~~Telar~~ | `buildings/telar.png` | HECHO (2026-10-26) |
| ~~Sedería~~ | `buildings/sederia.png` | HECHO (2026-10-26) |
| ~~Especiería~~ | `buildings/especiar.png` | HECHO (2026-10-26) |
| ~~Yeguada~~ | `buildings/yeguada.png` | HECHO (2026-10-26) |

## Prioridad 3: provincia y Hacienda

| Icono | Archivo | Motivo sugerido |
|---|---|---|
| Granero | `ui/granero.png` | Hórreo o granero de madera sobre pilares |
| Tierra | `ui/tierra.png` | Parcela arada con surcos y un mojón de piedra |
| Socorro | `ui/socorro.png` | Carro con sacos de grano |
| Moral | `ui/moral.png` | Estandarte del reino ondeando |
| Capital | `ui/capital.png` | Corona real sobre una torre |
| Almacén | `ui/almacen.png` | Pila de cajas y barriles bajo un tejadillo |
| Pecho | `ui/pecho.png` | Saca de monedas con el sello de la corona |
| Alcabala | `ui/alcabala.png` | Puesto de mercado con un recaudador y su libro |
| Almojarifazgo | `ui/almojarifazgo.png` | Barril con el sello de aduana junto a un ancla |
| Diezmo | `ui/diezmo.png` | Gavilla de trigo marcada con una cruz |
| Realengo | `ui/realengo.png` | Corona sobre una gavilla |
| Taller | `ui/taller.png` | Banco de trabajo con herramientas |
| Minas | `ui/minas.png` | Monedas de plata y oro sobre una vagoneta de mina |
| Otros | `ui/otros.png` | Cofre entreabierto |

## Prioridad 4: diplomacia, obras, terreno e interfaz

| Icono | Archivo | Motivo sugerido |
|---|---|---|
| Paz | `ui/paz.png` | Rama de olivo sobre un pergamino sellado |
| Alianza | `ui/alianza.png` | Dos manos con guantelete estrechándose |
| Enemigo | `ui/enemigo.png` | Calavera sobre dos espadas cruzadas |
| Ruptura | `ui/ruptura.png` | Pergamino roto por la mitad con el sello partido |
| Insulto | `ui/insulto.png` | Guantelete arrojado al suelo |
| Regalo | `ui/regalo.png` | Cofre abierto con oro y una cinta |
| Embargo | `ui/embargo.png` | Cadena cruzada sobre una carreta de mercancía |
| Caída | `ui/caida.png` | Corona caída y rota en el suelo |
| Obra | `ui/obra.png` | Andamio de madera con una grúa de rueda |
| Tiempo | `ui/tiempo.png` | Reloj de arena |
| Bloqueado | `ui/bloqueado.png` | Candado de hierro |
| Reactivar | `ui/reactivar.png` | Rueda de molino girando |
| Pausa | `ui/pausa.png` | Rueda de molino quieta con una cuña |
| Cereal | `ui/cereal.png` | Espigas de trigo |
| Cultivo | `ui/cultivo.png` | Racimo de uvas con hoja |
| Ganadería | `ui/ganaderia.png` | Oveja |
| Minería | `ui/mineria.png` | Pico y pala cruzados |
| Mapa | `ui/mapa.png` | Mapa enrollado con una rosa de los vientos |
| Mercado | `ui/mercado.png` | Toldo de puesto de mercado |
| Diplomacia | `ui/diplomacia.png` | Pluma y tintero sobre un tratado |
| Editar | `ui/editar.png` | Pluma de ave |
| Observador | `ui/observador.png` | Catalejo |
| Registro | `ui/registro.png` | Libro de cuentas abierto |
| Guardar | `ui/guardar.png` | Cofre cerrado con candado |
| Plaza | `ui/plaza.png` | Fuente de una plaza mayor |

## Prioridad 5: edificios de la cadena de producción

| Edificio | Archivo | Motivo sugerido |
|---|---|---|
| Mina de cobre | `buildings/minaCobre.png` | Bocamina con vetas verdosas y vagoneta |
| Mina de estaño | `buildings/minaEstano.png` | Bocamina en roca gris clara con lavaderos |
| Mina de hulla | `buildings/minaHulla.png` | Bocamina con montones negros de carbón |
| Alumbrera | `buildings/alumbrera.png` | Hornos de calcinar con balsas blanquecinas |
| Majada | `buildings/majada.png` | Redil de piedra con ovejas |
| Linar | `buildings/linar.png` | Campo de lino azul con haces secándose |
| Criadero de seda | `buildings/morera.png` | Moreras y una casa con zarzos de gusanos |
| Algodonal | `buildings/algodonal.png` | Campo de algodón en flor con cestos |
| Tintorería | `buildings/tintoreria.png` | Tinas de colores humeantes junto a un río |
| Majuelo | `buildings/majuelo.png` | Viña joven en espaldera |
| Olivar | `buildings/olivar.png` | Olivos en hileras sobre tierra roja |
| Cañaveral | `buildings/canaveral.png` | Cañas de azúcar altas junto a una acequia |
| Pesquería | `buildings/pesqueria.png` | Embarcadero con redes tendidas y una barca |
| Coto de caza | `buildings/cazadero.png` | Cabaña de cazador con pieles colgadas en el bosque |
| Dehesa | `buildings/dehesa.png` | Encinas dispersas con vacas pastando |
| Colmenar | `buildings/colmenar.png` | Colmenas de corcho en fila en una ladera |
| Ambarera | `buildings/ambarera.png` | Playa báltica con recolectores y cestos de ámbar |
| Carbonera | `buildings/carbonera.png` | Pila de leña humeante cubierta de tierra |
| Acería | `buildings/aceria.png` | Forja con horno alto y fuelles |
| Fundición de bronce | `buildings/fundibronce.png` | Taller con una campana recién fundida |
| Armería | `buildings/armeria.png` | Taller con armaduras y espadas en estantes |
| Telar de lino | `buildings/telarLino.png` | Telar con piezas de lienzo blanco |
| Fustanería | `buildings/fustaneria.png` | Telar con piezas de tela listada |
| Almazara | `buildings/almazara.png` | Molino de aceite con muela de piedra y tinajas |
| Ingenio azucarero | `buildings/ingenio.png` | Trapiche con calderas y panes de azúcar |
| Curtiduría | `buildings/curtiduria.png` | Pozas de curtir con pieles extendidas |
| Herrería | `buildings/herreria.png` | Fragua con yunque y herramientas colgadas |
| Vidriería | `buildings/vidrieria.png` | Horno de vidrio con piezas de colores |
| Cervecería | `buildings/cerveceria.png` | Casa con barriles y un caldero de malta |
| Alfar | `buildings/alfar.png` | Torno de alfarero y horno con vasijas |
| Molino de papel | `buildings/molinoPapel.png` | Molino de agua con pliegos secándose |
