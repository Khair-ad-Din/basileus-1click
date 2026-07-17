# FASE E-1: la lista de naciones del juego, sacada de EU4.
#
# El juego tenia 60 naciones pintadas a mano ("un primer boceto", dice Sergio) con agregados
# INVENTADOS: "Renania", "Hansa", "Tribus beduinas" no son paises de EU4. Ahora salen 192 de verdad.
#
# LO QUE HACE VIABLE ESTO: no hay ni un 60 clavado en el codigo. Todo se deriva de la lista —
# `NPLAY=MAPDATA.nations.length` (config.js:8), `NEUTRAL=NPLAY` (config.js:9),
# `NCOL=NATIONS.map(...)` (render.js:19), `S.nations=NATIONS.map(...)` (sim.js:22). Cambiar la lista
# es cambiar el dato, no el codigo.
#
# OJO CON `countries`: MAPDATA.countries[c-1].nation es la indireccion pais->nacion del raster viejo
# y solo la usa generateMap() (el camino procedural). Con official_map.js cargado ese camino NO
# corre, pero se regenera igual para que no quede un array de 60 al lado de uno de 192.
#
# Uso: python mk-nations.py    ->  nations.json  +  reescribe call-of-war/mapdata.js
import json, re, sys, os
from collections import Counter

SP = "C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
REPO = "c:/Users/sergi/OneDrive/Documentos/Basileus 1 click/"
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# NACIONES QUE NACEN MUERTAS. Tener un ducado no basta: si TODAS sus provincias caen bajo la regla
# del paramo (desierto + sin costa + sin nombre, save.js:65), el juego se las pasa a NEUTRAL y la
# nacion se queda con cero. Medido EN EL JUEGO VIVO, no deducido: estas tres salian con 0 provincias.
# Son tribus del desierto interior de Arabia, en el borde de la caja. Decision de Sergio: fuera.
# Si algun dia se afina la regla del paramo o se amplia la caja, revisar esta lista.
MUERTAS = {"ALH": "Haasa", "ANZ": "Aniza", "SHM": "Shammar"}   # ALH, no HAS: el tag me lo iba a inventar

E = json.load(open(SP+"eu4.json", encoding="utf8"))["duchy"]
usados = Counter(v["tag"] for v in E.values() if v["tag"])
print(f"paises de EU4 con al menos un ducado nuestro: {len(usados)}")
fuera = [t for t in list(usados) if t in MUERTAS]
for t in fuera: del usados[t]
if fuera: print(f"  fuera por nacer muertas (todo su suelo es paramo): {', '.join(MUERTAS[t] for t in fuera)}")

# Orden: por numero de ducados (desc) y luego por tag. Determinista, y deja a los grandes delante,
# que ayuda a leer cualquier volcado. El indice es el id de nacion del juego.
info = {}
for d, v in E.items():
    if v["tag"] and v["tag"] not in info:
        info[v["tag"]] = {"name": v["pais"], "color": v["color"]}
orden = sorted(usados, key=lambda t: (-usados[t], t))
nations = [{"name": info[t]["name"], "color": "#%02x%02x%02x" % tuple(info[t]["color"])} for t in orden]
idx = {t: i for i, t in enumerate(orden)}

# los nombres se repiten? (dos tags con el mismo nombre en espanol romperian los desplegables)
rep = [k for k, v in Counter(n["name"] for n in nations).items() if v > 1]
if rep:
    print(f"OJO: {len(rep)} nombres repetidos -> {rep[:8]}")
    vis = Counter()
    for n, t in zip(nations, orden):
        vis[n["name"]] += 1
        if Counter(x["name"] for x in nations)[n["name"]] > 1: n["name"] = f"{n['name']} ({t})"

print(f"\nNACIONES: {len(nations)}   (el boceto tenia 60)")
print("las 12 primeras: " + " · ".join(f"{n['name']} {usados[t]}" for n, t in zip(nations[:12], orden[:12])))
print(f"con UN solo ducado: {sum(1 for t in orden if usados[t]==1)}")

json.dump({"nations": nations, "tag2idx": idx, "orden": orden},
          open(AQUI+"/nations.json", "w", encoding="utf8"), ensure_ascii=False)

# ---------- reescribir mapdata.js ----------
src = open(REPO+"call-of-war/mapdata.js", encoding="utf8").read()
M = json.loads(src[src.index("{"):src.rindex("}")+1])
viejo = len(M["nations"])
M["nations"] = nations
M["countries"] = [{"nation": i} for i in range(len(nations))]
open(REPO+"call-of-war/mapdata.js", "w", encoding="utf8").write(
    "const MAPDATA=" + json.dumps(M, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"\n-> nations.json")
print(f"-> mapdata.js reescrito: nations {viejo} -> {len(nations)} · countries {len(nations)}")
print(f"   (NPLAY pasa a {len(nations)} y NEUTRAL a {len(nations)}, solos, por config.js)")
