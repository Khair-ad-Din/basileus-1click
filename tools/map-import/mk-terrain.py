# FASE 0 del roadmap de pulido: OROGRAFÍA REAL DESDE EU4.
#
# Saca el terreno de cada ducado directamente de EU4 y lo mapea a nuestros tipos. Como mk-eu4.py ya
# casó cada ducado con su id de provincia de EU4 (eu4.json), aquí solo hay que consultar el terreno
# de esa provincia. Fuentes, por prioridad:
#   1. map/terrain.txt -> categories{}.terrain_override: listas explícitas (cubre el 69% de la caja).
#   2. muestreo de map/terrain.bmp (paletado; el índice de paleta ES la categoría vía el bloque
#      `terrain`) por MAYORÍA de píxeles, usando map/provinces.bmp (RGB->id) + definition.csv. Para
#      el 31% sin override.
#   3. map/climate.txt -> `arctic` (->tundra) e `impassable` (->páramo; se les da terreno pero se
#      marcan wasteland; Sergio resucita en el editor los de África/OrMedio).
#
# Salida: terrain.json = { "<ducado>": ["<tipo nuestro>", paramo0o1], ... }  (ducado = id del SVG,
# la misma clave que usa eu4.json y prov_duchy.json). Lo lee mk-export.py para el campo [7]/[8].
#
# Uso: python mk-terrain.py
import json, re, sys
from collections import Counter, defaultdict
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

EU4 = "C:/Program Files (x86)/Steam/steamapps/common/Europa Universalis IV/"
SP  = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
AQUI = __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0] if "\\" in __file__ or "/" in __file__ else "."
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def rd(p, enc="latin-1"): return open(p, encoding=enc, errors="replace").read()

# ---------- categoría EU4 -> tipo NUESTRO (decidido con Sergio; caja acaba en el Atlas) ----------
CAT2NUESTRO = {
    "grasslands": "llanura",
    "farmlands": "vega",
    "hills": "colinas",
    "mountain": "montana", "impassable_mountains": "montana",
    "forest": "bosque", "woods": "bosque",
    "marsh": "pantano",
    "desert": "desierto", "coastal_desert": "desierto",
    "steppe": "estepa",
    "drylands": "meseta", "highlands": "meseta", "savannah": "meseta",  # savannah no cae en la caja
    "glacier": "tundra",
    "coastline": "llanura",
    # aguas: no deberían tocar tierra, pero por si acaso
    "ocean": "llanura", "inland_ocean": "llanura",
}

# ---------- 1. ducado -> id de provincia de EU4 ----------
E = json.load(open(SP+"eu4.json", encoding="utf8"))["duchy"]
duc_pid = {int(d): v["eu4"] for d, v in E.items() if v.get("eu4") is not None}
nom_duc = {int(d): (v.get("nombre") or "?") for d, v in E.items()}
pids = set(duc_pid.values())
print(f"ducados con id EU4: {len(duc_pid)} · provincias EU4 distintas: {len(pids)}")

# ---------- 2. terrain.txt: override (pid->cat) y bloque `terrain` (índice paleta -> cat) ----------
txt = re.sub(r"#[^\n]*", "", rd(EU4+"map/terrain.txt"))
m = re.search(r"categories\s*=\s*\{", txt); i = m.end(); depth = 1; start = i
while depth:
    depth += (txt[i] == "{") - (txt[i] == "}"); i += 1
cats_txt = txt[start:i-1]
override = {}   # pid -> categoria
j = 0
while j < len(cats_txt):
    mm = re.match(r"\s*([a-z_]+)\s*=\s*\{", cats_txt[j:])
    if not mm: j += 1; continue
    k = j + mm.end(); d = 1
    while d: d += (cats_txt[k] == "{") - (cats_txt[k] == "}"); k += 1
    body = cats_txt[j+mm.end():k-1]
    ov = re.search(r"terrain_override\s*=\s*\{([\d\s]*)\}", body)
    if ov:
        for pid in ov.group(1).split(): override[int(pid)] = mm.group(1)
    j = k
# bloque `terrain = { nombre = { type = cat color = { idx } } }`
idx2cat = {}
tb = re.search(r"\bterrain\s*=\s*\{(.*?)\n\}", txt, re.S)
for mm in re.finditer(r"type\s*=\s*([a-z_]+)\s*color\s*=\s*\{\s*(\d+)\s*\}", tb.group(1)):
    idx2cat[int(mm.group(2))] = mm.group(1)
print(f"terrain.txt: {len(override)} overrides globales · {len(idx2cat)} índices de paleta mapeados")

# ---------- 3. climate.txt: impassable / arctic ----------
cl = re.sub(r"#[^\n]*", "", rd(EU4+"map/climate.txt"))
def lista(tag):
    mm = re.search(tag + r"\s*=\s*\{([\d\s]*)\}", cl)
    return set(int(x) for x in mm.group(1).split()) if mm else set()
impassable, arctic = lista("impassable"), lista("arctic")
print(f"climate.txt: impassable={len(impassable)} · arctic={len(arctic)}")

# ---------- 4. muestreo de terrain.bmp para los pids SIN override ----------
need = {p for p in pids if p not in override}
print(f"pids que necesitan muestreo de bitmap: {len(need)} (los demás van por override)")
cat_sample = {}   # pid -> categoria por mayoría
if need:
    print("  cargando definition.csv (RGB->id)...")
    rgb2pid = {}
    for ln in rd(EU4+"map/definition.csv").splitlines()[1:]:
        f = ln.split(";")
        if len(f) >= 4 and f[0].isdigit():
            rgb2pid[(int(f[1]) << 16) | (int(f[2]) << 8) | int(f[3])] = int(f[0])
    print("  cargando provinces.bmp y terrain.bmp (bytes crudos)...")
    prov = Image.open(EU4+"map/provinces.bmp").convert("RGB")
    terr = Image.open(EU4+"map/terrain.bmp")            # modo P: el valor ES el índice de paleta
    W, H = prov.size
    pb = prov.tobytes()                                 # 3 bytes/px
    tbz = terr.tobytes()                                # 1 byte/px
    npx = W * H
    hist = defaultdict(Counter)                         # pid -> Counter(categoria)
    print(f"  recorriendo {npx:,} píxeles (Python puro, ~1-2 min)...")
    for q in range(npx):
        b3 = q*3
        key = (pb[b3] << 16) | (pb[b3+1] << 8) | pb[b3+2]
        pid = rgb2pid.get(key)
        if pid is None or pid not in need: continue
        cat = idx2cat.get(tbz[q])
        if cat: hist[pid][cat] += 1
    for p in need:
        if hist[p]: cat_sample[p] = hist[p].most_common(1)[0][0]
    print(f"  muestreados: {len(cat_sample)}/{len(need)}")

# ---------- 5. resolver el terreno de cada ducado ----------
out = {}
motivo = Counter(); tipos = Counter()
sin = []
for d, pid in duc_pid.items():
    paramo = 1 if pid in impassable else 0
    cat = override.get(pid) or cat_sample.get(pid)
    if cat: motivo["override" if pid in override else "bitmap"] += 1
    else:
        # sin dato: cae a llanura (raro; se anota). El editor lo remata.
        cat = "grasslands"; sin.append((d, nom_duc[d])); motivo["sin dato->llanura"] += 1
    terr = CAT2NUESTRO.get(cat, "llanura")
    if pid in arctic and paramo == 0: terr = "tundra"   # clima ártico manda sobre la categoría
    out[str(d)] = [terr, paramo]
    tipos[terr] += 1

print(f"\nresueltos por: " + " · ".join(f"{k}={v}" for k, v in motivo.items()))
print("distribución de NUESTROS tipos sobre los ducados:")
for k, v in tipos.most_common(): print(f"  {k:10} {v:4d}")
print(f"páramos (impassable): {sum(1 for v in out.values() if v[1])}")
if sin:
    print(f"\nSIN dato de terreno ({len(sin)}, caen a llanura): {[n for _, n in sin[:15]]}")

json.dump(out, open(SP+"terrain.json", "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
print(f"\n-> terrain.json ({len(out)} ducados) en el scratchpad")
