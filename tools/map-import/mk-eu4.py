# FASE D-1b: los duenos de VERDAD, sacados de EU4 en su fecha de arranque (11-nov-1444).
#
# Sustituye a mk-owners.py (que muestreaba nuestro raster viejo de 60 naciones pintado a mano).
# Decision de Sergio: "me dan igual los paises actuales, son un primer boceto".
#
# EL ENGANCHE. Nuestros ducados salen del SVG de MapChart, cuyos paths llevan NOMBRE
# (id="Outer_Hebrides"), no numero de provincia. Asi que hay que casar nombre -> id de EU4. Medido,
# y aqui esta la trampa que casi me como:
#   - `map/definition.csv` tiene 664 NOMBRES AMBIGUOS (el mismo nombre para varias provincias) y
#     ademas MIENTE a ratos: dice que "Ustyug" es la 314, que en realidad se llama Vologda.
#   - `localisation/prov_names_l_english.yml` tambien miente a ratos, pero en OTROS sitios: dice que
#     "Karelia" es la 4124, que se llama Kovero.
#   - Ninguna de las dos es de fiar por si sola. Enganchar por una sola fuente da un mapa que PARECE
#     bien y tiene a Bremen gobernando Stade.
# SOLUCION: cruzar las TRES fuentes (definition.csv, localisation y el NOMBRE DEL FICHERO de
# history/provinces, que es el que esta pegado al dueno que leemos). Medido sobre nuestros 1.006:
#   957 unico y sin discusion · 13 varias fuentes pero coinciden · 17 ambiguo de verdad · 19 sin
#   candidato (paramos de EU4 tipo The_Alps_1, y variantes de nombre tipo Kyiv/Kiev).
#
# LA FECHA. El bloque base del fichero es el estado al principio de la historia, NO en 1444: hay que
# aplicar encima los bloques fechados hasta 1444.11.11. Ile-de-France lo enseña: base owner=FRA,
# 1420 controller=ENG (los ingleses toman Paris), 1437 controller=FRA (Carlos VII la recupera).
#
# Uso: python mk-eu4.py
import json, re, os, glob, sys, unicodedata
from collections import defaultdict, Counter

EU4 = "C:/Program Files (x86)/Steam/steamapps/common/Europa Universalis IV/"
SP = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
INICIO = (1444, 11, 11)          # el arranque de EU4
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ı","i").replace("İ","i").replace("ø","o").replace("Ø","o")
    s = s.replace("æ","ae").replace("ł","l").replace("ß","ss")
    return re.sub(r"[^a-z0-9]", "", s.lower())
def rd(p, enc="utf-8-sig"):
    return open(p, encoding=enc, errors="replace").read()

# ---------- 1. nombre de provincia -> id, cruzando las TRES fuentes ----------
src = {k: defaultdict(set) for k in ("def", "loc", "hist")}
for ln in open(EU4+"map/definition.csv", encoding="latin-1").read().splitlines()[1:]:
    f = ln.split(";")
    if len(f) >= 5 and f[0].isdigit(): src["def"][norm(f[4])].add(int(f[0]))
for m in re.finditer(r'PROV(\d+):\d*\s+"([^"]*)"', rd(EU4+"localisation/prov_names_l_english.yml")):
    src["loc"][norm(m.group(2))].add(int(m.group(1)))
fich = {}
for p in glob.glob(EU4+"history/provinces/*.txt"):
    m = re.match(r"(\d+)\s*-\s*(.+)\.txt", os.path.basename(p))
    if m: src["hist"][norm(m.group(2))].add(int(m.group(1))); fich[int(m.group(1))] = p

# Los alias de MapChart: parte los PARAMOS en trozos numerados (The_Alps_1..5, Egyptian_Desert_1,
# Zagros_1) y desambigua nombres repetidos con un sufijo de zona (Beja_Iberia, Caceres_Iberia).
# Quitando el sufijo, el nombre casa con el de EU4. Los cuatro ultimos son variantes de grafia.
ALIAS = {"kyiv": "kiev", "majorca": "mallorca", "constance": "konstanz", "denbosch": "breda"}
def candidatos(nom):
    for k in (norm(nom), norm(re.sub(r"_\d+$", "", nom)), norm(re.sub(r"_(Iberia|Italy|France)$", "", nom))):
        if ALIAS.get(k): k = ALIAS[k]
        cand = [src[s].get(k, set()) for s in ("def", "loc", "hist")]
        union = set().union(*cand)
        if union: return cand, union
    return [set()]*3, set()
def resolver(nom):
    cand, union = candidatos(nom)
    if not union: return None, "sin candidato"
    if len(union) == 1: return next(iter(union)), "unico"
    # EL NOMBRE DEL FICHERO DE HISTORIA MANDA. Es la etiqueta que EU4 pone AL LADO del dueno que
    # leemos ("1755 - Ustyug.txt"), asi que es la fuente autorizada; las otras dos son catalogos
    # aparte que se desincronizan. Comprobado en los dos sentidos: en Ustyug, definition.csv decia
    # la 314 (que se llama Vologda) y el fichero acertaba; en Karelia, la localizacion decia la 4124
    # (que se llama Kovero) y el fichero volvia a acertar.
    if len(cand[2]) == 1: return next(iter(cand[2])), "el fichero de historia"
    inter = set.intersection(*[c for c in cand if c])
    if len(inter) == 1: return next(iter(inter)), "coinciden"
    return None, f"ambiguo {sorted(union)}"

# ---------- EL DESEMPATE POR POSICION ----------
# El nombre da 2-3 candidatos y la posicion elige: `Tripoli` es la 354 o la 378, una en Libia y otra
# en el Libano, a 3.000 km. La recta EU4 px -> lon/lat (ver mk-regiones.py) tiene 49 km de error
# mediano, asi que la eleccion no admite duda. Los coeficientes son los mismos de alli.
AX, BX = 0.063884, -179.217
AY, BY = 0.051223, -27.924
pos = {}
for m in re.finditer(r"(\d+)=\{\s*position=\{\s*([\d.\-\s]+)\}", rd(EU4+"map/positions.txt", "latin-1")):
    v = m.group(2).split()
    if len(v) >= 2: pos[int(m.group(1))] = (AX*float(v[0])+BX, AY*float(v[1])+BY)

# ---------- 2. tag -> nombre en espanol y color ----------
tagfile = dict(re.findall(r'^([A-Z0-9]{3})\s*=\s*"([^"]+)"', rd(EU4+"common/country_tags/00_countries.txt"), re.M))
# Los nombres NO estan solo en countries_l_spanish.yml: estan repartidos por 144 ficheros. BYZ
# (Imperio Bizantino) y HSA (Lubeck) viven en text_l_spanish.yml. countries_ manda; el resto rellena
# huecos sin pisar. (Y ojo: GNV es GINEBRA, no Genova — Genova es GEN. Casi me lo invento.)
nombre = {}
orden = sorted(glob.glob(EU4+"localisation/*_l_spanish.yml"),
               key=lambda p: (0 if "countries_l_spanish" in p else 1, p))
for p in orden:
    for tag, nom in re.findall(r'^ ([A-Z0-9]{3}):\d*\s+"([^"]*)"', rd(p), re.M):
        if tag in tagfile and tag not in nombre and nom.strip(): nombre[tag] = nom
color = {}
for tag, rel in tagfile.items():
    p = EU4 + "common/" + rel
    if not os.path.exists(p): continue
    m = re.search(r"color\s*=\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}", rd(p, "latin-1"))
    if m: color[tag] = tuple(int(x) for x in m.groups())
print(f"EU4: {len(tagfile)} tags · {len(nombre)} nombres en espanol · {len(color)} colores")

# ---------- 3. el dueno de una provincia en 1444.11.11 ----------
def bloques(t):
    """(fecha, cuerpo) de cada bloque fechado; devuelve tambien el texto base."""
    t = re.sub(r"#[^\n]*", "", t)                       # fuera comentarios
    out = []; base = []; i = 0
    for m in re.finditer(r"(\d{1,4})\.(\d{1,2})\.(\d{1,2})\s*=\s*\{", t):
        base.append(t[i:m.start()])
        j = m.end(); prof = 1
        while j < len(t) and prof:
            if t[j] == "{": prof += 1
            elif t[j] == "}": prof -= 1
            j += 1
        out.append(((int(m.group(1)), int(m.group(2)), int(m.group(3))), t[m.end():j-1]))
        i = j
    base.append(t[i:])
    return "".join(base), out

def dueno(pid):
    p = fich.get(pid)
    if not p: return None
    base, fech = bloques(rd(p, "latin-1"))
    o = re.findall(r"\bowner\s*=\s*([A-Z0-9]{3})\b", base)
    ow = o[-1] if o else None
    for fecha, cuerpo in sorted(fech):
        if fecha > INICIO: break
        o = re.findall(r"\bowner\s*=\s*([A-Z0-9]{3})\b", cuerpo)
        if o: ow = o[-1]
    return ow

# ---------- 4. nuestros ducados ----------
ids = json.load(open(SP+"duchies.json", encoding="utf8"))["ids"]
enCaja = sorted(set(json.load(open(SP+"prov_duchy.json", encoding="utf8")).values()))

# el centroide de cada ducado, en lon/lat, para el desempate
import math
from PIL import Image as _I
_I.MAX_IMAGE_PIXELS = None
GW, GE, GS, GN = -11, 50, 27, 66.5
_d = _I.open(SP+"duchies.png").convert("RGB"); _p = _d.load(); _W, _H = _d.size
_yn = math.log(math.tan(math.pi/4+GN*math.pi/360)); _ys = math.log(math.tan(math.pi/4+GS*math.pi/360))
_acc = defaultdict(lambda: [0, 0, 0])
for y in range(_H):
    for x in range(_W):
        r, g, b = _p[x, y]; n = r | (g << 8) | (b << 16)
        if n: a = _acc[n]; a[0] += x; a[1] += y; a[2] += 1
cen = {d: (GW + sx/c/_W*(GE-GW), (math.atan(math.exp(_yn - sy/c/_H*(_yn-_ys))) - math.pi/4)*360/math.pi)
       for d, (sx, sy, c) in _acc.items()}
def km(a, b): return math.hypot((a[0]-b[0])*111*math.cos(a[1]*math.pi/180), (a[1]-b[1])*111)

# que marcadores de EU4 caen DENTRO de cada ducado (lon/lat -> nuestro pixel -> que ducado hay ahi)
dentroDe = defaultdict(list)
for u, (lo, la) in pos.items():
    if not (GW <= lo <= GE and GS <= la <= GN): continue
    x = int((lo-GW)/(GE-GW)*_W)
    m = math.log(math.tan(math.pi/4 + max(-85, min(85, la))*math.pi/360))
    y = int((_yn-m)/(_yn-_ys)*_H)
    if not (0 <= x < _W and 0 <= y < _H): continue
    r, g, b = _p[x, y]; n = r | (g << 8) | (b << 16)
    if n: dentroDe[n].append(u)
print(f"marcadores de EU4 que caen dentro de un ducado nuestro: {sum(len(v) for v in dentroDe.values())}")

# EL NOMBRE PROPONE, LA POSICION DISPONE.
# Este fue mi error de fondo durante toda la importacion: dejar que el nombre decidiera SOLO. Los
# nombres de EU4 mienten y se repiten por todo el globo, y ninguna fuente es fiable por si sola:
#   - `definition.csv` jura que "Ustyug" es la 314, que en realidad se llama Vologda (664 nombres
#     ambiguos ahi dentro).
#   - la localizacion jura que "Karelia" es la 4124, que se llama Kovero.
#   - y el fichero de historia, que parecia la autoridad, tiene UN solo "Tripoli" y es el del
#     LIBANO: nuestro Tripoli es el de Libia, a 3.000 km. Resolver un nombre sin ambiguedad NO
#     significa que sea NUESTRA provincia.
# Asi que ninguna propuesta sobrevive sin pasar el metro: la provincia elegida tiene que estar
# ENCIMA de nuestro ducado (150 km; un ducado mide ~40 km, y la recta de posicion yerra 49 km de
# mediana). El nombre solo sirve para ESTRECHAR entre las que caen encima.
# El nombre resuelve; la posicion solo VETA LOS ABSURDOS. El tope NO decide: un ducado normal mide
# 40 km, pero Central_Sahara son 65.412 px y su centroide esta legitimamente a cientos de km del
# marcador de EU4. Si el tope decide, se cargan los ducados grandes; si solo veta, cazan a Tripoli
# sin danar a nadie. Y el recurso a "la provincia libre mas cercana" es CODICIOSO (depende del orden
# y regala provincias ajenas: me dio Rothenburg -> Dinamarca), asi que es el ultimo recurso, no el
# primero.
ABSURDO_KM = 400.0
res = {}; motivo = Counter(); pend = []; lejos = []
for d in enCaja:
    nom = ids[d-1]
    pid, por = resolver(nom)
    c = cen.get(d)
    if pid is not None and c and pid in pos and km(c, pos[pid]) > ABSURDO_KM:
        # el nombre resolvia, pero apunta a la otra punta del mundo: es OTRA provincia con el mismo
        # nombre. `Tripoli`: hay UN fichero de historia asi y es el del LIBANO; el nuestro es Libia.
        _, union = candidatos(nom)
        ok = sorted((km(c, pos[u]), u) for u in union if u in pos)
        if ok and ok[0][0] <= ABSURDO_KM:
            pid = ok[0][1]; por = f"el nombre apuntaba lejos, manda la posicion ({ok[0][0]:.0f} km)"
        else: pid = None; por = "el nombre solo da provincias lejanisimas"
    if pid is None and c:
        _, union = candidatos(nom)
        if union:
            ok = sorted((km(c, pos[u]), u) for u in union if u in pos)
            if ok and ok[0][0] < ABSURDO_KM and (len(ok) == 1 or ok[1][0] > ok[0][0]*1.3):
                pid = ok[0][1]; por = f"ambiguo, gana la de encima ({ok[0][0]:.0f} km)"
        else:
            usados = {v["eu4"] for v in res.values()}
            ok = sorted((km(c, q), u) for u, q in pos.items() if u not in usados and km(c, q) < 120)
            if ok: pid = ok[0][1]; por = f"sin nombre, la mas cercana ({ok[0][0]:.0f} km)"
    if pid is None:
        # ULTIMO RECURSO, y el mas exacto de todos: ¿que marcadores de EU4 caen DENTRO de este
        # ducado? La distancia al centroide es una mala vara para los ducados grandes —Central_Sahara
        # son 65.412 px y su centro esta lejos de todo por pura geometria—, y con el tope de 400 km
        # se quedaban sin resolver los paramos enormes. "Caer dentro" no depende del tamano.
        dent = [u for u in dentroDe.get(d, ())]
        if dent:
            _, union = candidatos(nom)
            elegido = next((u for u in dent if u in union), None)      # el nombre, si esta entre ellos
            if elegido: pid, por = elegido, "el marcador cae dentro, y el nombre cuadra"
            else:
                pid = min(dent, key=lambda u: km(cen[d], pos[u]))
                por = f"el marcador cae dentro ({len(dent)} candidatos)"
    if pid is None:
        motivo["sin resolver"] += 1; pend.append((nom, por)); continue
    motivo[por.split(" (")[0]] += 1
    if c and pid in pos and km(c, pos[pid]) > 200: lejos.append((km(c, pos[pid]), nom))
    tag = dueno(pid)
    res[d] = {"eu4": pid, "nombre": nom, "tag": tag, "porque": por,
              "pais": nombre.get(tag, tag) if tag else None, "color": color.get(tag)}

print(f"\nENGANCHE de nuestros {len(enCaja)} ducados:")
for k, v in motivo.most_common(): print(f"  {k:14} {v:4d}")
print(f"  -> resueltos: {len(res)} ({100*len(res)/len(enCaja):.1f}%)")

sinD = [d for d, v in res.items() if not v["tag"]]
print(f"\nde los resueltos, SIN dueno en 1444 (paramos / sin colonizar): {len(sinD)}")
paises = Counter(v["pais"] for v in res.values() if v["tag"])
print(f"\nPAISES DE EU4 EN NUESTRA CAJA: {len(paises)}   (nuestro boceto tenia 60)")
print("los 20 con mas ducados:")
for k, v in paises.most_common(20): print(f"    {k:26} {v:3d}")
sinNom = sorted({v["tag"] for v in res.values() if v["tag"] and v["tag"] not in nombre})
if sinNom: print(f"\ntags SIN nombre en espanol: {len(sinNom)} -> {', '.join(sinNom[:20])}")
sinCol = sorted({v["tag"] for v in res.values() if v["tag"] and not v["color"]})
if sinCol: print(f"tags SIN color: {len(sinCol)} -> {', '.join(sinCol[:20])}")

print(f"\nLOS {len(pend)} PENDIENTES (a resolver por posicion o a mano):")
for nom, por in pend: print(f"  {nom:24} {por}")

json.dump({"duchy": {str(k): v for k, v in res.items()},
           "pendientes": [[n, p] for n, p in pend]},
          open(SP+"eu4.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print("\n-> eu4.json")
