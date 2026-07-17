# FASE E-2: escribir call-of-war/official_map.js.
#
# Junta todo: provs.png (tierra) + sea.png (mar) + eu4.json (duenos de 1444) + nations.json (los 193
# paises) + las capitales de EU4.
#
# LO QUE HAY QUE SABER DEL FORMATO (deducido de save.js:46-72, que es quien lo lee):
#  - `id = INDICE DEL ARRAY`, 0-based. No hay campo id. Nuestro pipeline es 1-based y ademas DEJA
#    HUECOS (mk-provinces reserva k ids por ducado y algun gajo sale vacio: 5.793 reservados, 5.787
#    con pixeles). Asi que aqui se RENUMERA contiguo y a cero. La tierra va delante y el mar detras.
#  - `rle` son pares [pid, tirada] fila a fila, y tienen que sumar MW*MH EXACTO.
#  - `-1` = sin provincia. Antes era TODO el oceano; ahora solo los AGUJEROS (Caspio, Mar Blanco,
#    Golfo Persico y los ~1.100 lagos), que se pintan de mar pero no son provincia.
#  - la tupla: [name, x, y, owner0, named, urban, capital, terreno, paramo, pop].
#    `null` en terreno/paramo/pop significa "calculalo tu": el juego lo hace al cargar
#    (assignTerrain, seedCities, assignPopulation). Es lo que hace viable todo esto.
#  - `v` sube a 2: la semantica cambia (el mar ya es provincia) y una instantanea v1 vieja guardada
#    en el navegador NO debe cargarse contra el codigo nuevo (main.js:565-576 la dejaria pasar y
#    taparia el mapa nuevo en silencio).
#
# Uso: python mk-export.py
import json, re, os, sys, glob, math
from collections import Counter, defaultdict
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

EU4 = "C:/Program Files (x86)/Steam/steamapps/common/Europa Universalis IV/"
SP = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
REPO = "c:/Users/sergi/OneDrive/Documentos/Basileus 1 click/"
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

E = json.load(open(SP+"eu4.json", encoding="utf8"))["duchy"]
pd = json.load(open(SP+"prov_duchy.json", encoding="utf8"))
# TERRENO DE EU4 (fase 0): mk-terrain.py -> {ducado: [tipo, paramo]}. Si un ducado no está (los ~6
# sin resolver tipo Central_Sahara), su terreno queda None y lo calcula el juego al cargar.
TER = json.load(open(SP+"terrain.json", encoding="utf8"))
NAT = json.load(open(AQUI+"/nations.json", encoding="utf8"))
tag2idx = NAT["tag2idx"]; NPLAY = len(NAT["nations"]); NEUTRAL = NPLAY
# el indice del terreno "mar": tiene que coincidir con TERRAIN_KEYS de config.js
cfg = open(REPO+"call-of-war/js/config.js", encoding="utf8").read()
TK = re.search(r"const TERRAINS=\{(.*?)\n\};", cfg, re.S).group(1)
TERRAIN_KEYS = re.findall(r"^\s{2}([a-z_]+):\{", TK, re.M)
IMAR = TERRAIN_KEYS.index("mar")
print(f"terrenos: {len(TERRAIN_KEYS)} · 'mar' es el indice {IMAR}")
print(f"naciones: {NPLAY} · NEUTRAL={NEUTRAL}")

land = Image.open(SP+"provs.png").convert("RGB"); lp = land.load(); MW, MH = land.size
sea = Image.open(SP+"sea.png").convert("RGB"); sq = sea.load()

# ---------- renumerar contiguo y a cero: tierra primero, mar despues ----------
pxL = defaultdict(list); pxS = defaultdict(list)
for y in range(MH):
    for x in range(MW):
        r, g, b = lp[x, y]; n = r | (g << 8) | (b << 16)
        if n: pxL[n].append(y*MW + x); continue
        r, g, b = sq[x, y]; n = r | (g << 8) | (b << 16)
        if n: pxS[n].append(y*MW + x)
print(f"tierra: {len(pxL):,} provincias · mar: {len(pxS)} teselas")
ordL = sorted(pxL); ordS = sorted(pxS)
new = {}
for i, n in enumerate(ordL): new[("L", n)] = i
for i, n in enumerate(ordS): new[("S", n)] = len(ordL) + i
NPROV = len(ordL) + len(ordS)
print(f"renumeradas 0..{NPROV-1}  (tierra 0..{len(ordL)-1} · mar {len(ordL)}..{NPROV-1})")

# ---------- la capital de cada nacion, segun EU4 ----------
# EU4 la da como id de PROVINCIA suya ("capital = 219 # Toledo"). Hay que traducirla a la nuestra:
# provincia de EU4 -> nuestro ducado -> la provincia de ese ducado mas cercana al centro.
duc_de_eu4 = {}
for d, v in E.items():
    if v["eu4"] is not None: duc_de_eu4.setdefault(v["eu4"], int(d))
cap_eu4 = {}
for p in glob.glob(EU4+"history/countries/*.txt"):
    m = re.match(r"([A-Z0-9]{3})\s*-", os.path.basename(p))
    if not m: continue
    c = re.search(r"^\s*capital\s*=\s*(\d+)", open(p, encoding="latin-1", errors="replace").read(), re.M)
    if c: cap_eu4[m.group(1)] = int(c.group(1))
print(f"capitales declaradas por EU4: {len(cap_eu4)}")

# provincias de cada ducado, y su centroide
provsDeDuc = defaultdict(list)
for n in ordL: provsDeDuc[int(pd[str(n)])].append(n)
cent = {}
for n in ordL:
    ps = pxL[n]
    cent[n] = (sum(i % MW for i in ps)/len(ps), sum(i // MW for i in ps)/len(ps))

capitales = {}                                    # nuestra provincia -> nacion
sinCap = []
choques = 0
for tag, idx in tag2idx.items():
    pe = cap_eu4.get(tag)
    d = duc_de_eu4.get(pe) if pe else None
    if d is None or not provsDeDuc.get(d):
        sinCap.append(tag); continue
    # DOS PAISES PUEDEN PEDIR EL MISMO DUCADO: nuestros ducados son ~6 provincias y EU4 mete varias
    # capitales de estaditos en el mismo sitio. Como esto es un dict provincia->nacion, el segundo
    # PISABA al primero en silencio y Marruecos se quedaba sin capital. Ahora el que llega despues
    # coge otra provincia libre del mismo ducado; si no queda ninguna, a la cola de rescate.
    libres = [n for n in provsDeDuc[d] if n not in capitales]
    if not libres: sinCap.append(tag); choques += 1; continue
    cx = sum(cent[n][0] for n in provsDeDuc[d])/len(provsDeDuc[d])
    cy = sum(cent[n][1] for n in provsDeDuc[d])/len(provsDeDuc[d])
    # la mas cercana al centro del ducado: la mas "cabeza" sin inventarse nada
    capitales[min(libres, key=lambda n: (cent[n][0]-cx)**2 + (cent[n][1]-cy)**2)] = idx
print(f"capitales colocadas: {len(capitales)} · sin capital: {len(sinCap)} (de ellas {choques} por ducado lleno)")

# Una nacion sin capital se queda coja. Si EU4 no la da (o su capital cae fuera de la caja), se le
# pone su ducado mas grande: es una conjetura, pero una nacion sin capital es un bug seguro.
porNacion = defaultdict(list)
for n in ordL:
    v = E.get(str(pd[str(n)]))
    if v and v["tag"]: porNacion[v["tag"]].append(n)
rescatadas = 0
for tag in sinCap:
    ps = [n for n in porNacion.get(tag, ()) if n not in capitales]     # solo provincias LIBRES
    if not ps: continue
    if any(capitales.get(n) == tag2idx[tag] for n in porNacion.get(tag, ())): continue
    capitales[max(ps, key=lambda n: len(pxL[n]))] = tag2idx[tag]; rescatadas += 1
print(f"  de esas, rescatadas con su provincia mayor: {rescatadas}")
huerf = [t for t in tag2idx if not any(v == tag2idx[t] for v in capitales.values())]
if huerf: print(f"  OJO: {len(huerf)} naciones siguen sin capital -> {huerf[:6]}")

# ---------- los ducados: los de EU4, no los que se inventa el juego ----------
# UN DUCADO = UNA PROVINCIA DE EU4 (Lappland, Abruzzi, Kola...), que es de donde salio el corte de
# nuestras provincias. Antes esto no se podia: los ducados salian PARTIDOS entre paises (220 de
# 1.006 medidos) porque el dueno se sacaba provincia a provincia del raster viejo, y un ducado a
# caballo de una frontera rompe el warscore, los asedios y las reclamaciones. Ahora el dueno se
# asigna POR DUCADO, asi que todas sus provincias comparten dueno por construccion y la objecion
# desaparece sola.
ducsUsados = sorted({int(pd[str(n)]) for n in ordL})
ducIdx = {d: i for i, d in enumerate(ducsUsados)}
# El nombre del ducado: el de EU4 si se resolvio; si no, el del SVG, que SIEMPRE lo tenemos (los 6
# sin resolver son paramos tipo Central_Sahara). Poner "Sin nombre" teniendo el nombre delante era
# tirar informacion por pereza: salia "Ducado de Sin nombre" en el juego.
svg = json.load(open(SP+"duchies.json", encoding="utf8"))["ids"]
ducNom = []
for d in ducsUsados:
    v = E.get(str(d))
    nom = v["nombre"] if v else (svg[d-1] if 0 < d <= len(svg) else None)
    ducNom.append((nom or "Sin nombre").replace("_", " "))
print(f"\nducados: {len(ducsUsados)} (historicos de EU4) · antes el juego se inventaba ~1.400 de 3-4 provincias")
pxDuc = Counter(pd[str(n)] for n in ordL)
sz = sorted(Counter(int(pd[str(n)]) for n in ordL).values())
print(f"  provincias por ducado: mediana {sz[len(sz)//2]} · min {sz[0]} · max {sz[-1]}")

# ---------- las tuplas ----------
nomDuc = Counter()
provs = [None]*NPROV
for n in ordL:
    i = new[("L", n)]
    d = int(pd[str(n)]); v = E.get(str(d))
    nom = v["nombre"].replace("_", " ") if v else "Sin nombre"
    nomDuc[nom] += 1
    if nomDuc[nom] > 1: nom = f"{nom} {nomDuc[nom]}"      # provisional: 6 provincias por ducado
    tag = v["tag"] if v else None
    own = tag2idx[tag] if (tag and tag in tag2idx) else NEUTRAL
    cx, cy = cent[n]
    # TERRENO Y PÁRAMO congelados desde EU4 (fase 0). El [7] es el índice en TERRAIN_KEYS; el [8] es
    # 1 SOLO si EU4 lo marca `impassable` (los 19 páramos), 0 en el resto. Fijar el [8] explícito
    # DESACTIVA la heurística vieja `desierto->páramo` de save.js (que dejaba sin dueño 44 desiertos
    # reales de EU4 y ~479 falsos del Sáhara). Los ~6 ducados sin dato quedan a null -> los computa el
    # juego. pop sigue a null: lo calcula assignPopulation (fase 4 lo reequilibra).
    t = TER.get(str(d))
    terr = TERRAIN_KEYS.index(t[0]) if t else None
    param = t[1] if t else None
    # El [10] es EL DUCADO, y es el motivo de que exista este campo: sin el, buildDuchies() se los
    # INVENTA al arrancar (cumulos de 3-4 provincias del mismo dueno, "Ducado de <su capital>") y los
    # 974 ducados historicos de EU4 —que son el 90% del trabajo de este pipeline— se tiran a la
    # basura. Lo canto Sergio mirando el mapa: "juraria que los ducados son otra vez inventados".
    provs[i] = [nom, int(cx), int(cy), own, 0, 0, 1 if capitales.get(n) == own else 0, terr, param, None,
                ducIdx[d]]
for n in ordS:
    i = new[("S", n)]
    ps = pxS[n]
    cx = sum(k % MW for k in ps)/len(ps); cy = sum(k // MW for k in ps)/len(ps)
    # el mar: sin dueno, terreno "mar", NUNCA paramo (si lo fuera, isolateWastePockets lo saltaria
    # y cada isla del mapa quedaria aislada -> paramo), poblacion 0.
    provs[i] = [f"Mar {i-len(ordL)+1}", int(cx), int(cy), NEUTRAL, 0, 0, 0, IMAR, 0, 0, -1]  # -1: el mar no tiene ducado

# ---------- el raster comprimido ----------
idx = [-1]*(MW*MH)
for n in ordL:
    v = new[("L", n)]
    for i in pxL[n]: idx[i] = v
for n in ordS:
    v = new[("S", n)]
    for i in pxS[n]: idx[i] = v
rle = []
cur = idx[0]; run = 1
for i in range(1, MW*MH):
    if idx[i] == cur: run += 1
    else: rle += [cur, run]; cur = idx[i]; run = 1
rle += [cur, run]
suma = sum(rle[1::2])
if suma != MW*MH: raise SystemExit(f"ERROR: el rle suma {suma:,} y deberia sumar {MW*MH:,}")
hueco = sum(rle[i+1] for i in range(0, len(rle), 2) if rle[i] < 0)
print(f"\nrle: {len(rle):,} numeros · suma {suma:,} = {MW}x{MH} OK")
print(f"  agujeros (-1, se pintan de mar y no son provincia): {hueco:,} px = {100*hueco/(MW*MH):.1f}%")
print(f"  (en el mapa de hoy el -1 eran 1.088.299 px: TODO el oceano)")

out = {"v": 2, "W": MW, "H": MH, "rle": rle, "duchies": ducNom, "provs": provs}
open(REPO+"call-of-war/official_map.js", "w", encoding="utf8").write(
    "const OFFICIAL_MAP=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
mb = os.path.getsize(REPO+"call-of-war/official_map.js")/1e6
print(f"\n-> official_map.js ({mb:.2f} MB) · v2 · {NPROV:,} provincias ({len(ordL):,} tierra + {len(ordS)} mar)")
c = Counter(p[3] for p in provs)
print(f"   sin dueno (NEUTRAL): {c[NEUTRAL]:,} provincias (incluye las {len(ordS)} de mar)")
print(f"   con dueno: {NPROV-c[NEUTRAL]:,}")
