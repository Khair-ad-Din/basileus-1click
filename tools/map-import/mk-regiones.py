# FASE A-0: que regiones del SVG PUEDEN estar en nuestra caja, segun EU4.
#
# Sale antes que todo lo demas porque mk-duchies.py lo necesita.
#
# POR QUE EXISTE ESTE FICHERO. El bug 1 del LEEME ("Columbia y Nunavut en Europa") NO estaba muerto.
# La paleta en rejilla mato los trozos de 1 px —de 8.068 a 47— y cante victoria midiendo eso. Pero
# mk-duchies.py RELLENA POR VECINDAD cada pixel de tierra sin ducado: los 47 supervivientes no se
# quedaron en 47 pixeles, cada uno sembro un BFS y CRECIO HASTA SER UN DUCADO. Medido con la tabla
# de superregiones de EU4: 30 ducados fantasma, 4.293 px (0,19% de la tierra), 24 de ellos
# norteamericanos. `Bushubi` eran 1.197 px EN DINAMARCA, y al importar los duenos de EU4 se
# convertia en el estado africano de Buha gobernando Jutlandia.
#
# LA IDEA: no hay que adivinar nada. EU4 agrupa sus provincias en superregiones y dice, con su
# propia autoridad, que Norteamerica no esta en nuestra caja. Un pixel que decodifica a Canada es,
# POR DEFINICION, un error de decodificacion. Se tira antes del relleno y esa tierra se la queda su
# vecino legitimo, que es de quien siempre debio ser. Causa, no sintoma.
#
# OJO — LO QUE ESTO NO PILLA: un fantasma EUROPEO (una mezcla que decodifica a otra region de
# nuestra caja) pasa este filtro. Por eso, despues de regenerar, hay que volver a pasar la prueba de
# posicion (predecir cada ducado con sus vecinos y mirar el error): esa si los pilla a todos.
#
# Uso: python mk-regiones.py   ->  regiones.json
import json, re, os, glob, sys, unicodedata
from collections import defaultdict, Counter

EU4 = "C:/Program Files (x86)/Steam/steamapps/common/Europa Universalis IV/"
SP = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# EL FILTRO BUENO ES LA POSICION, NO LA SUPERREGION.
# Primero use superregiones y se me colaron 12 fantasmas, porque `africa_superregion` va del Magreb
# (dentro) a Benin (fuera) y `tartary_superregion` de la estepa pontica (dentro) a Siberia (fuera).
# Filtrar por ellas era o dejar pasar Benin o cargarme el Magreb.
# EU4 da la posicion de cada provincia en pixeles de su mapa (map/positions.txt). Ajustando contra
# los 952 ducados ya casados sale una recta con error MEDIANO DE 49 km (p90 136), que sobra para
# distinguir Europa de Siberia. Validado: Columbia -> -126,1/67,6 (Columbia Britanica), Atakora ->
# 1,3/13,1 (Benin), Hoboksar -> 86,0/46,7 (Xinjiang), y Creta -> 24,8/35,3 y Rodas -> 27,8/36,2
# clavadas. Los coeficientes son una propiedad del mapa de EU4, no de nuestra generacion: fijos.
AX, BX = 0.063884, -179.217         # lon = AX*x + BX
AY, BY = 0.051223, -27.924          # lat = AY*y + BY
CAJA = (-11, 50, 27, 66.5)          # nuestra caja: W, E, S, N
MARGEN = 10.0                       # GRADOS. El marcador es UN PUNTO y la provincia se EXTIENDE:
# `Lappland` marca 67,3 —0,8 por encima del borde— y es un ducado nuestro de 17.588 px. Sin margen
# me cargaba Laponia. Con 10 grados (~1.100 km) los que rozan el borde se quedan y los fantasmas
# (a 3.000+ km) caen igual. El error del ajuste (49 km) es despreciable frente al margen.

# Solo para provincias SIN posicion (los paramos no estan en positions.txt). Aqui SI se puede usar
# la superregion, pero unicamente las que no rozan nuestra caja por ningun lado.
IMPOSIBLES = {"india_superregion", "east_indies_superregion", "oceania_superregion",
              "china_superregion", "far_east_superregion", "southern_africa_superregion",
              "south_america_superregion", "andes_superregion", "north_america_superregion",
              "central_america_superregion", "new_world_superregion"}

def rd(p, enc="latin-1"): return open(p, encoding=enc, errors="replace").read()
def norm(s):
    s = unicodedata.normalize("NFKD", s); s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ı","i").replace("İ","i").replace("ø","o").replace("Ø","o")
    s = s.replace("æ","ae").replace("ł","l").replace("ß","ss")
    return re.sub(r"[^a-z0-9]", "", s.lower())
def bloques(t):
    t = re.sub(r"#[^\n]*", "", t); out = {}
    for m in re.finditer(r"([a-z_0-9]+)\s*=\s*\{", t):
        j = m.end(); prof = 1
        while j < len(t) and prof:
            if t[j] == "{": prof += 1
            elif t[j] == "}": prof -= 1
            j += 1
        out[m.group(1)] = t[m.end():j-1]
    return out

# provincia -> area -> region -> superregion
provArea = {}
for a, cuerpo in bloques(rd(EU4+"map/area.txt")).items():
    for pid in re.findall(r"\b(\d+)\b", re.sub(r"color\s*=\s*\{[^}]*\}", "", cuerpo)): provArea[int(pid)] = a
areaReg = {}
for r, cuerpo in bloques(rd(EU4+"map/region.txt")).items():
    m = re.search(r"areas\s*=\s*\{([^}]*)\}", cuerpo)
    if m:
        for a in m.group(1).split(): areaReg[a] = r
regSup = {}
for s, cuerpo in bloques(rd(EU4+"map/superregion.txt")).items():
    for r in cuerpo.split(): regSup[r] = s
def superOf(pid): return regSup.get(areaReg.get(provArea.get(pid)))

# nombre -> id, cruzando las TRES fuentes (ninguna es fiable sola: ver mk-eu4.py)
src = {k: defaultdict(set) for k in ("def", "loc", "hist")}
for ln in rd(EU4+"map/definition.csv").splitlines()[1:]:
    f = ln.split(";")
    if len(f) >= 5 and f[0].isdigit(): src["def"][norm(f[4])].add(int(f[0]))
for m in re.finditer(r'PROV(\d+):\d*\s+"([^"]*)"', rd(EU4+"localisation/prov_names_l_english.yml", "utf-8-sig")):
    src["loc"][norm(m.group(2))].add(int(m.group(1)))
for p in glob.glob(EU4+"history/provinces/*.txt"):
    m = re.match(r"(\d+)\s*-\s*(.+)\.txt", os.path.basename(p))
    if m: src["hist"][norm(m.group(2))].add(int(m.group(1)))
def resolver(nom):
    k = norm(nom)
    cand = [src[s].get(k, set()) for s in ("def", "loc", "hist")]
    union = set().union(*cand)
    if not union: return None
    if len(union) == 1: return next(iter(union))
    inter = set.intersection(*[c for c in cand if c])
    return next(iter(inter)) if len(inter) == 1 else None

# las regiones del SVG
ids = re.findall(r'<path id="([^"]+)"', rd(AQUI+"/../../MapChart_Map.svg", "utf8"))
ids = [i for i in ids if not i.startswith("pattern")]
print(f"regiones en el SVG: {len(ids)}")

# posicion de cada provincia en el mapa de EU4
pos = {}
for m in re.finditer(r"(\d+)=\{\s*position=\{\s*([\d.\-\s]+)\}", rd(EU4+"map/positions.txt")):
    v = m.group(2).split()
    if len(v) >= 2: pos[int(m.group(1))] = (float(v[0]), float(v[1]))
print(f"provincias con posicion en EU4: {len(pos)}")

fuera = []; dentro = []; duda = []; porQue = Counter()
for nom in ids:
    pid = resolver(nom)
    if pid is None: duda.append(nom); porQue["no resuelvo el nombre"] += 1; continue
    if pid in pos:                                  # criterio PRINCIPAL: donde lo pone EU4
        lo = AX*pos[pid][0] + BX; la = AY*pos[pid][1] + BY
        if (CAJA[0]-MARGEN <= lo <= CAJA[1]+MARGEN) and (CAJA[2]-MARGEN <= la <= CAJA[3]+MARGEN):
            dentro.append(nom)
        else: fuera.append(nom); porQue["fuera de la caja (posicion)"] += 1
        continue
    s = superOf(pid)                                # sin posicion (paramos): tirar de superregion
    if s in IMPOSIBLES: fuera.append(nom); porQue["sin posicion, superregion imposible"] += 1
    else: dentro.append(nom); porQue["sin posicion, superregion dudosa -> dentro"] += 1
print(f"  PUEDEN estar en la caja ... {len(dentro)}")
print(f"  IMPOSIBLES ................ {len(fuera)}   <- estas se tiran al decodificar")
print(f"  sin veredicto (van dentro)  {len(duda)}")
print("\npor que:")
for k, v in porQue.most_common(): print(f"    {k:38} {v:4d}")
print("\ncomprobacion (deben salir como se indica):")
for q, esp in (("Columbia","fuera"), ("Atakora","fuera"), ("Mangazea","fuera"), ("Hoboksar","fuera"),
               ("Lappland","dentro"), ("Crete","dentro"), ("Rhodes","dentro"), ("Nenets","dentro")):
    real = "fuera" if q in fuera else ("dentro" if q in dentro else "duda->dentro")
    ok = "OK" if real.startswith(esp) else "*** MAL ***"
    print(f"    {q:12} -> {real:14} (esperado {esp}) {ok}")

json.dump({"fuera": sorted(fuera), "dentro": sorted(dentro), "duda": sorted(duda)},
          open(AQUI+"/regiones.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print(f"\n-> regiones.json ({len(fuera)} regiones vetadas)")
