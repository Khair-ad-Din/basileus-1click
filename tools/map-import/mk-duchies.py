# FASE A+B: costa de Natural Earth + ducados de EU4, en NUESTRA proyeccion y resolucion.
# Salida: duchies.png (id de ducado por pixel, 0 = mar) + duchies.json (nombres)
import json, math
from collections import deque
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
MW,MH=1813,1840
GW,GE,GS,GN=-11,50,27,66.5
yn=math.log(math.tan(math.pi/4+GN*math.pi/360)); ys=math.log(math.tan(math.pi/4+GS*math.pi/360))
def proj(lon,lat):
    lat=max(-85,min(85,lat))
    m=math.log(math.tan(math.pi/4+lat*math.pi/360))
    return ((lon-GW)/(GE-GW)*MW, (yn-m)/(yn-ys)*MH)

# ---------- A: la costa (Natural Earth 10m) ----------
land=Image.new("L",(MW,MH),0); dr=ImageDraw.Draw(land)
def paint(fn,val,only_ext=False):
    d=json.load(open(SP+fn,encoding="utf8")); v=0
    for f in d["features"]:
        g=f["geometry"]
        polys=[g["coordinates"]] if g["type"]=="Polygon" else g["coordinates"]
        for p in polys:
            for i,ring in enumerate(p):
                if only_ext and i>0: continue
                pts=[proj(c[0],c[1]) for c in ring]
                xs=[q[0] for q in pts]; ys_=[q[1] for q in pts]
                if max(xs)<-50 or min(xs)>MW+50 or max(ys_)<-50 or min(ys_)>MH+50: continue
                v+=len(pts)
                dr.polygon(pts, fill=(val if i==0 else (0 if val else 255)))
    return v
paint("ne/ne_10m_land.geojson",255)
paint("ne/ne_10m_minor_islands.geojson",255)
paint("ne/ne_10m_lakes.geojson",0,only_ext=True)
lp=land.load()
nland=sum(1 for y in range(MH) for x in range(MW) if lp[x,y])
print(f"A) costa Natural Earth: {nland:,} px de tierra ({nland*100/(MW*MH):.1f}%)")

# ---------- B: los ducados (EU4) ----------
meta=json.load(open(SP+"idsvg.json",encoding="utf8"))
ids=meta["ids"]; A,B,AY,BY=meta["A"],meta["B"],meta["AY"],meta["BY"]
vx,vy,SC=meta["vx"],meta["vy"],meta["SCALE"]
im=Image.open(SP+"ids.png").convert("RGB"); ip=im.load(); IW,IH=im.size
# DECODIFICAR = CUANTIZAR contra la rejilla de la paleta (ver mk-idsvg.py). Un color solo vale si
# cae CERCA de un punto de la rejilla y no es oscuro: una mezcla con el negro del fondo baja de
# BASE y se descarta sola. Antes se decodificaba (n, n>>8, n>>16) y cualquier mezcla era un id
# valido de otra region: de ahi Canada en Europa.
BASE=meta.get("BASE",80); STEP=meta.get("STEP",11); NG=meta.get("N",16)
TOL=STEP*0.34
def idx_of(r,g,b):
    if r<BASE-TOL or g<BASE-TOL or b<BASE-TOL: return 0          # mezcla con el fondo
    o=[]
    for v in (r,g,b):
        k=round((v-BASE)/STEP)
        if k<0 or k>=NG: return 0
        if abs(v-(BASE+k*STEP))>TOL: return 0                    # entre dos casillas: mezcla
        o.append(k)
    i=o[0]+NG*o[1]+NG*NG*o[2]
    return i+1 if i<len(ids) else 0
def miller(la): return 1.25*math.log(math.tan(math.pi/4+0.4*la*math.pi/180))

duchy=[[0]*MW for _ in range(MH)]
lat_of=[]
for y in range(MH):
    m=yn-y/MH*(yn-ys)
    lat_of.append((math.atan(math.exp(m))-math.pi/4)*360/math.pi)
lon_of=[GW+x/MW*(GE-GW) for x in range(MW)]
sy_of=[int((AY*miller(la)+BY-vy)*SC) for la in lat_of]
sx_of=[int((A*lo+B-vx)*SC) for lo in lon_of]
sinreg=0
for y in range(MH):
    py=sy_of[y]
    if not(0<=py<IH): continue
    row=duchy[y]
    for x in range(MW):
        if not lp[x,y]: continue
        px=sx_of[x]
        if not(0<=px<IW): continue
        r,g,b=ip[px,py]
        n=idx_of(r,g,b)
        if n: row[x]=n
        else: sinreg+=1
print(f"B) tierra sin region (costuras del SVG y desajuste de costa): {sinreg:,} px")

# ---------- relleno: cada pixel de tierra sin ducado toma el mas cercano ----------
dq=deque()
for y in range(MH):
    for x in range(MW):
        if duchy[y][x]:
            dq.append((x,y))
while dq:
    x,y=dq.popleft(); d=duchy[y][x]
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx,ny=x+dx,y+dy
        if 0<=nx<MW and 0<=ny<MH and lp[nx,ny] and not duchy[ny][nx]:
            duchy[ny][nx]=d; dq.append((nx,ny))
huerf=sum(1 for y in range(MH) for x in range(MW) if lp[x,y] and not duchy[y][x])
print(f"   tras rellenar: {huerf} px de tierra sin ducado")

# ---------- estadisticas ----------
from collections import Counter
cnt=Counter()
for y in range(MH):
    for x in range(MW):
        if duchy[y][x]: cnt[duchy[y][x]]+=1
print(f"\nDUCADOS con tierra: {len(cnt)}")
sz=sorted(cnt.values())
print(f"tamano (px): mediana {sz[len(sz)//2]:,} · p10 {sz[len(sz)//10]:,} · p90 {sz[int(len(sz)*.9)]:,} · max {sz[-1]:,}")
KM2=(61/MW*111)*(39.5/MH*111)*0.7
print(f"~superficie mediana: {sz[len(sz)//2]*KM2:,.0f} km2  (un ducado de 3-4 provincias nuestras ~ 25.000 km2)")
print(f"\nlos 8 mayores: "+" · ".join(f"{ids[n-1]} {c:,}" for n,c in cnt.most_common(8)))
tiny=[n for n,c in cnt.items() if c<40]
print(f"ducados minusculos (<40 px, islotes): {len(tiny)}")

# guardar
out=Image.new("RGB",(MW,MH))
op=out.load()
for y in range(MH):
    for x in range(MW):
        n=duchy[y][x]
        op[x,y]=(n&255,(n>>8)&255,(n>>16)&255)
out.save(SP+"duchies.png")
json.dump({"ids":ids,"MW":MW,"MH":MH}, open(SP+"duchies.json","w",encoding="utf8"))
print("\n-> duchies.png (id de ducado por pixel, 0=mar)")
