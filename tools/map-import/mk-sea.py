# FASE C2: el MAR tambien son provincias.
#
# Por que hexagonos y no k-medias como en tierra: la k-medias es EMERGENTE (siembra, converge, y lo
# que sale sale) y por eso en tierra cada arreglo mio parió el artefacto siguiente. Aqui no hay nada
# que emerja: cada pixel de agua cae en su hexagono por FORMULA CERRADA. Sin semillas, sin RNG, sin
# convergencia. Los hexagonos son regulares en PIXELES, no en km — el mapa es Mercator y estira
# hacia el norte, igual que ya les pasa a las provincias de tierra. Es lo que se ve regular en
# pantalla, que es lo que se pidio.
#
# Lo unico que no es analitico es la REPARACION de la costa, y son las dos patologias que ya
# derrotamos en tierra: una viruta de agua en un hexagono casi todo tierra, y un hexagono partido en
# dos charcos por una peninsula. Regla de UNA SOLA PIEZA + fusion de virutas con la vecina.
#
# NAVEGABLE = lista explicita de mares (por punto semilla), NO "lo que toca el borde del recuadro".
# Medido: esa regla habria dejado el Mar Negro y Azov como lagos (el Bosforo mide 700 m y el raster
# va a 2,7 km/px: el estrecho es SUBPIXEL, y Natural Earth tiene razon al cerrarlo) y habria colado
# el Caspio y el Golfo Persico como oceano abierto (tocan el borde solo porque la caja los corta).
# Los estrechos NO se carvan en la costa: son ARISTAS explicitas del grafo. La costa dice la verdad
# y la topologia la arregla el grafo. Ademas asi Constantinopla controla el paso, que es lo suyo.
#
# Agua NO navegable (Caspio, Mar Blanco, Golfo Persico, ~1.100 lagos) = AGUJERO: sin provincia, se
# pinta de mar. Es el mismo trato que hoy recibe todo el oceano.
#
# Uso: python mk-sea.py [px_por_tesela] [min_frac] [sufijo]
#   px_por_tesela: 4000 por defecto (~147 km de lado, 345 teselas)
#   min_frac: 0.15 por defecto. ES EL MANDO ENTRE UNIFORMIDAD DE TAMANO Y REGULARIDAD DE FORMA, y
#     tira en las dos direcciones: subirlo fusiona mas virutas costeras (tamanos parejos) pero cada
#     fusion pega un trozo del hexagono de al lado y DEJA DE SER UN HEXAGONO. Los "pulpos" del
#     archipielago danes son esto. Se pidio forma regular -> valor bajo. Medido en LEEME.md.
import json, math, sys
from collections import deque, Counter, defaultdict
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SP = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
MIN_FRAC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.15
SUF = sys.argv[3] if len(sys.argv) > 3 else ""      # sufijo de salida, para comparar variantes
GW, GE, GS, GN = -11, 50, 27, 66.5   # el recuadro geografico del raster (ver mk-duchies.py)

# Los mares navegables, por punto semilla. Explicito y auto-documentado: si manana el raster cambia,
# el punto sigue cayendo donde debe (o el script grita).
NAVEGABLES = [
    ("Atlantico/Mediterraneo/Baltico", -5.0, 45.0),
    ("Marmara",                        28.2, 40.7),
    ("Mar Negro",                      34.0, 43.5),
    ("Azov",                           36.5, 45.9),
]
# Los estrechos, como pares de mares que hay que unir. El PUNTO de cruce no se clava a mano: se
# busca el sitio donde los dos mares quedan mas cerca, que es la definicion de estrecho.
ESTRECHOS = [
    ("Dardanelos", "Atlantico/Mediterraneo/Baltico", "Marmara"),
    ("Bosforo",    "Marmara",                        "Mar Negro"),
    ("Kerch",      "Mar Negro",                      "Azov"),
]
GAP_MAX_KM = 60.0                    # un salto mayor que esto no es un estrecho: es una invencion

d = Image.open(SP + "duchies.png").convert("RGB"); dp = d.load(); W, H = d.size
yn = math.log(math.tan(math.pi/4 + GN*math.pi/360))
ys = math.log(math.tan(math.pi/4 + GS*math.pi/360))
def px_of(lon, lat):
    m = math.log(math.tan(math.pi/4 + lat*math.pi/360))
    return int((lon-GW)/(GE-GW)*W), int((yn-m)/(yn-ys)*H)
def lat_of_y(y):
    return (math.atan(math.exp(yn - y/H*(yn-ys))) - math.pi/4) * 360/math.pi
KM_X = (GE-GW)/W * 111.0             # km por pixel en x, corregido por latitud al usarlo
KM_Y_MED = (GN-GS)/H * 111.0

print(f"raster {W}x{H} · objetivo {TARGET} px/tesela · min_frac {MIN_FRAC}")

# ---------- 1. la mascara de agua y sus componentes ----------
agua = bytearray(W*H)
for y in range(H):
    for x in range(W):
        r, g, b = dp[x, y]
        if not (r | (g << 8) | (b << 16)): agua[y*W + x] = 1
print(f"agua total (oceano + lagos): {sum(agua):,} px")

comp = [0]*(W*H); nc = 0; tam = {}
for s in range(W*H):
    if agua[s] and not comp[s]:
        nc += 1; q = deque([s]); comp[s] = nc; n = 0
        while q:
            i = q.popleft(); n += 1
            x = i % W; y = i // W
            for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
                nx, ny = x+dx, y+dy
                if 0 <= nx < W and 0 <= ny < H:
                    j = ny*W + nx
                    if agua[j] and not comp[j]: comp[j] = nc; q.append(j)
        tam[nc] = n

# ---------- 2. cuales son navegables ----------
mar_de = {}                          # nombre -> id de componente
for nom, lo, la in NAVEGABLES:
    x, y = px_of(lo, la)
    c = comp[y*W + x] if 0 <= x < W and 0 <= y < H else 0
    if not c:
        raise SystemExit(f"ERROR: la semilla de '{nom}' ({lo},{la}) no cae en agua. Raster cambiado?")
    if c in mar_de.values():
        raise SystemExit(f"ERROR: '{nom}' cae en un mar ya sembrado. Semillas mal puestas?")
    mar_de[nom] = c
    print(f"  navegable · {nom:32} comp {c:4d} · {tam[c]:9,} px")
navcomp = set(mar_de.values())
nav = sum(tam[c] for c in navcomp)
print(f"NAVEGABLE: {nav:,} px  ·  agujeros (Caspio, Mar Blanco, lagos...): {sum(agua)-nav:,} px")

# ---------- 3. los estrechos: donde dos mares quedan mas cerca ----------
def borde_de(c, bbox=None):
    out = []
    for i in range(W*H):
        if comp[i] != c: continue
        x = i % W; y = i // W
        if bbox and not (bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]): continue
        for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < W and 0 <= ny < H and comp[ny*W + nx] != c:
                out.append((x, y)); break
    return out
def bbox_de(c):
    x0 = y0 = 10**9; x1 = y1 = -1
    for i in range(W*H):
        if comp[i] == c:
            x = i % W; y = i // W
            x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
    return x0, y0, x1, y1

cruces = []                          # (nombre, (xa,ya), (xb,yb), km)
for nom, a, b in ESTRECHOS:
    ca, cb = mar_de[a], mar_de[b]
    # el recuadro del mar PEQUENO, ensanchado: el estrecho esta ahi por fuerza
    peq, gra = (ca, cb) if tam[ca] <= tam[cb] else (cb, ca)
    x0, y0, x1, y1 = bbox_de(peq); M = 60
    bb = (max(0, x0-M), max(0, y0-M), min(W-1, x1+M), min(H-1, y1+M))
    ba, bbo = borde_de(peq, bb), borde_de(gra, bb)
    mejor = None
    for (xa, ya) in ba:
        kx = KM_X * math.cos(lat_of_y(ya)*math.pi/180)
        for (xb, yb) in bbo:
            dkm = math.hypot((xa-xb)*kx, (ya-yb)*KM_Y_MED)
            if mejor is None or dkm < mejor[0]: mejor = (dkm, (xa, ya), (xb, yb))
    if mejor is None: raise SystemExit(f"ERROR: no encuentro el cruce de '{nom}'")
    dkm, pa, pb = mejor
    if dkm > GAP_MAX_KM:
        raise SystemExit(f"ERROR: '{nom}' saltaria {dkm:.0f} km. Eso no es un estrecho.")
    if peq != ca: pa, pb = pb, pa
    cruces.append((nom, pa, pb, dkm))
    print(f"  estrecho · {nom:12} salto de {dkm:5.1f} km  en {pa} <-> {pb}")

# ---------- 4. la rejilla hexagonal (esto es lo analitico: formula cerrada, cero proceso) ----------
S = math.sqrt(TARGET / (3*math.sqrt(3)/2))       # circunradio para que el hexagono mida TARGET px
print(f"\nhexagono: circunradio {S:.1f} px · ancho {S*math.sqrt(3):.1f} px · alto {S*2:.1f} px")
def hex_of(x, y):                                # pointy-top, coords axiales + redondeo cubico
    q = (math.sqrt(3)/3 * x - y/3) / S
    r = (2/3 * y) / S
    xc, zc = q, r; yc = -xc - zc
    rx, ry, rz = round(xc), round(yc), round(zc)
    dx, dy, dz = abs(rx-xc), abs(ry-yc), abs(rz-zc)
    if dx > dy and dx > dz: rx = -ry - rz
    elif dy > dz: ry = -rx - rz
    else: rz = -rx - ry
    return int(rx), int(rz)

celda = {}                                       # (q,r) -> [i, ...]
for i in range(W*H):
    if comp[i] in navcomp:
        k = hex_of(i % W, i // W)
        celda.setdefault(k, []).append(i)
print(f"celdas hexagonales con agua: {len(celda):,}")

# ---------- 5. UNA SOLA PIEZA: cada celda se parte en sus trozos conexos ----------
tile = [0]*(W*H); nt = 0; qr_de = {}; pxs = defaultdict(list)
for (q, r), idxs in celda.items():
    dentro = set(idxs)
    vis = set()
    for s in idxs:
        if s in vis: continue
        pila = [s]; vis.add(s); trozo = []
        while pila:
            i = pila.pop(); trozo.append(i)
            x = i % W; y = i // W
            for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
                nx, ny = x+dx, y+dy
                if 0 <= nx < W and 0 <= ny < H:
                    j = ny*W + nx
                    if j in dentro and j not in vis: vis.add(j); pila.append(j)
        nt += 1
        for i in trozo: tile[i] = nt
        qr_de[nt] = (q, r); pxs[nt] = trozo
print(f"trozos tras exigir una sola pieza: {nt:,}  (celdas partidas por una peninsula: {nt-len(celda):,})")

# ---------- 6. fusionar las virutas con la vecina que mas las rodea ----------
MIN_PX = int(TARGET * MIN_FRAC)
def vecinas(t):
    v = Counter()
    for i in pxs[t]:
        x = i % W; y = i // W
        for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < W and 0 <= ny < H:
                o = tile[ny*W + nx]
                if o and o != t: v[o] += 1
    return v
aislados = 0
while True:
    chicas = sorted((t for t in pxs if len(pxs[t]) < MIN_PX), key=lambda t: len(pxs[t]))
    if not chicas: break
    movido = False
    for t in chicas:
        if t not in pxs: continue
        v = vecinas(t)
        if not v: continue                       # mar aislado (Marmara): no tiene con quien fusionar
        dst = v.most_common(1)[0][0]
        for i in pxs[t]: tile[i] = dst
        pxs[dst].extend(pxs[t]); del pxs[t]; del qr_de[t]
        movido = True
    if not movido:
        aislados = len(chicas); break
print(f"teselas tras fusionar virutas (<{MIN_PX} px): {len(pxs):,}"
      + (f"  ·  {aislados} mar(es) aislado(s) por debajo del minimo, se respetan" if aislados else ""))

# ---------- 7. renumerar detras de la tierra y sacar la prueba ----------
land = json.load(open(SP + "prov_duchy.json", encoding="utf8"))
BASE = max(int(k) for k in land)
print(f"\nid maximo de tierra: {BASE} · el mar empieza en {BASE+1}")
orden = sorted(pxs, key=lambda t: (min(i // W for i in pxs[t]), min(i % W for i in pxs[t])))
nuevo = {t: BASE + 1 + k for k, t in enumerate(orden)}
sea = {}
for t, n in nuevo.items():
    ps = pxs[t]
    cx = sum(i % W for i in ps)/len(ps); cy = sum(i // W for i in ps)/len(ps)
    q, r = qr_de[t]
    sea[n] = {"q": q, "r": r, "px": len(ps), "cx": round(cx, 1), "cy": round(cy, 1)}
out = Image.new("RGB", (W, H)); op = out.load()
for i in range(W*H):
    t = tile[i]
    n = nuevo[t] if t else 0
    op[i % W, i // W] = (n & 255, (n >> 8) & 255, (n >> 16) & 255)
out.save(SP + f"sea{SUF}.png")

# los estrechos, ya como aristas entre teselas
links = []
for nom, pa, pb, dkm in cruces:
    ta = nuevo[tile[pa[1]*W + pa[0]]]; tb = nuevo[tile[pb[1]*W + pb[0]]]
    links.append({"nombre": nom, "a": ta, "b": tb, "km": round(dkm, 1)})
    print(f"  estrecho · {nom:12} tesela {ta} <-> {tb}")

json.dump({"W": W, "H": H, "base": BASE, "target": TARGET,
           "teselas": {str(k): v for k, v in sea.items()}, "estrechos": links},
          open(SP + f"sea{SUF}.json", "w", encoding="utf8"))

sz = sorted(v["px"] for v in sea.values())
KM2 = (61/W*111) * (39.5/H*111) * 0.7
print(f"\nTESELAS DE MAR: {len(sea)}")
print(f"tamano: mediana {sz[len(sz)//2]:,} px = {math.sqrt(sz[len(sz)//2]*KM2):.0f} km de lado"
      f"  ·  p10 {sz[len(sz)//10]:,} · min {sz[0]} · max {sz[-1]:,}")
print(f"  (tierra: 389 px = 49 km)")
print("-> sea.png + sea.json")
