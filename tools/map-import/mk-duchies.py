# FASE A+B: costa de Natural Earth + ducados de EU4, en NUESTRA proyeccion y resolucion.
# Salida: duchies.png (id de ducado por pixel, 0 = mar) + duchies.json (nombres)
import json, math, os
from collections import deque
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
AQUI=os.path.dirname(os.path.abspath(__file__))
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
# EL VETO (ver mk-regiones.py). La paleta redujo las mezclas que decodifican a un id valido AJENO,
# pero no a cero: las 47 que quedaban sembraban el relleno por vecindad de mas abajo y CRECIAN hasta
# ser un ducado. Medido: 30 ducados fantasma (Pegu en Dinamarca, Huillimapu en Jutlandia).
# EU4 dice, con su tabla de superregiones, que Norteamerica no esta en nuestra caja: un pixel que
# decodifica a Canada es POR DEFINICION un error, y se tira. La tierra se la queda su vecino
# legitimo en el relleno. Se vetan la mitad de los colores de la paleta, asi que ademas la mitad de
# las mezclas restantes caen ahora en hueco vetado y mueren solas.
# VETO POR NOMBRE, NUNCA POR INDICE: mk-idsvg.py usa un regex estricto (3.352 paths) y mk-regiones.py
# uno amplio (3.359). Casar por posicion desplazaria la tabla entera y vetaria regiones al azar.
VETADAS=set(json.load(open(AQUI+"/regiones.json",encoding="utf8"))["fuera"])
veto=[n in VETADAS for n in ids]
print(f"   veto: {sum(veto)} de {len(ids)} regiones del SVG son de otro continente (imposibles aqui)")
def idx_of(r,g,b):
    if r<BASE-TOL or g<BASE-TOL or b<BASE-TOL: return 0          # mezcla con el fondo
    o=[]
    for v in (r,g,b):
        k=round((v-BASE)/STEP)
        if k<0 or k>=NG: return 0
        if abs(v-(BASE+k*STEP))>TOL: return 0                    # entre dos casillas: mezcla
        o.append(k)
    i=o[0]+NG*o[1]+NG*NG*o[2]
    if i>=len(ids): return 0
    if veto[i]: vetados[0]+=1; return 0                          # mezcla disfrazada de otro continente
    return i+1
vetados=[0]
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
print(f"   de esos, MEZCLAS VETADAS (decodificaban a otro continente): {vetados[0]:,} px")
print(f"   -> antes crecian por vecindad hasta ser ducados fantasma (Pegu en Dinamarca). Ya no.")

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
print(f"   tras rellenar: {huerf:,} px de tierra sin ducado")

# ---------- ISLAS HUERFANAS: las que el SVG no cubre por el desajuste de proyeccion ----------
# El relleno de arriba solo cruza TIERRA, asi que una isla sin ni un pixel de region se queda a 0.
# Y 0 significa MAR: mk-sea.py las teselaba tan contento. Medido en la primera generacion —la que se
# aprobo—: 8.738 px de tierra de Natural Earth DEBAJO de una tesela de oceano. Feroe, Shetland,
# Orcadas, Oland, Bornholm, Rodas y las Hebridas Exteriores no eran tierra.
# No lo pillo la verificacion del mar porque alli defini "agua" como "lo que vale 0 en duchies.png":
# comprobe el resultado contra si mismo en vez de contra Natural Earth, que es la materia prima.
# CAUSA: la costa de EU4 y la de Natural Earth coinciden al 96,44%, y en una isla pequena ese 3,56%
# basta para que nuestro pixel de tierra caiga en el MAR del SVG. `Outer_Hebrides` SI existe en el
# SVG — solo que desplazada unos pixeles.
# ARREGLO: por cada trozo huerfano, buscar en ids.png en espiral la region mas cercana. Asi las
# Hebridas caen en "Outer_Hebrides" y no en la Escocia continental, que es lo que pasaria si me
# limitara a darselas al ducado mas proximo de nuestro propio raster.
RBUSCA=90                                # radio maximo en px de ids.png (~45 px nuestros, ~120 km)

# ISLAS A MANO. El SVG de MapChart es un mapa MUNDIAL y las islas chicas se le caen: Orkney, Rhodes,
# Chios y Malta NO SE DIBUJAN, y Shetland y Bornholm salen con 4 px (ruido, no la isla). Existen en
# la LISTA de regiones pero no en el render, asi que la busqueda en espiral no las encuentra y les
# da la region continental mas proxima. Medido: Rodas -> Mentese (la costa turca de enfrente) y
# Orkney -> Sutherland (Escocia). Eso no es cosmetico: en 1444 Rodas son los CABALLEROS DE SAN JUAN
# y Orkney es NORUEGA, asi que la isla acabaria otomana y escocesa respectivamente.
# Como la region SI esta en la lista, se le puede asignar su indice directamente. Siete lineas.
# Feroe es el unico caso sin region propia (MapChart no la tiene; EU4 si): va con Shetland, que en
# 1444 tambien era noruega.
A_MANO=[("Rodas",       27.93, 36.20, "Rhodes"),
        ("Orcadas",     -3.09, 59.03, "Orkney"),
        ("Shetland",    -1.33, 60.29, "Shetland"),
        ("Feroe",       -6.88, 62.19, "Shetland"),   # sin region propia en el SVG; ambas noruegas
        ("Quios",       26.05, 38.40, "Chios"),      # 1444: GENOVESA (la Maona de Quios)
        ("Lesbos",      26.30, 39.20, "Lesbos"),     # 1444: GENOVESA (los Gattilusi)
        ("Bornholm",    14.89, 55.14, "Bornholm"),
        ("Malta",       14.40, 35.90, "Malta")]
name2i={n:i+1 for i,n in enumerate(ids)}
for nom,lo,la,reg in A_MANO:
    i=name2i.get(reg)
    if i is None: print(f"   OJO: '{reg}' no esta en la lista del SVG, {nom} se queda sin asignar"); continue
    x0,y0=proj(lo,la); x0=int(x0); y0=int(y0)
    if not(0<=x0<MW and 0<=y0<MH):
        print(f"   OJO: {nom} ({lo},{la}) cae fuera del recuadro"); continue
    if not lp[x0,y0]:                                 # la coordenada a ojo puede caer en el agua
        halla=None                                    # (me paso con Quios: 26.23/39.19 era Lesbos)
        for rr in range(1,14):
            for dx in range(-rr,rr+1):
                for dy in (-rr,rr) if abs(dx)<rr else range(-rr,rr+1):
                    px,py=x0+dx,y0+dy
                    if 0<=px<MW and 0<=py<MH and lp[px,py]: halla=(px,py); break
                if halla: break
            if halla: break
        if not halla: print(f"   OJO: {nom} ({lo},{la}) no cae en tierra de Natural Earth"); continue
        x0,y0=halla
    q=deque([(x0,y0)]); mark={(x0,y0)}; n=0
    while q:                                          # toda la isla, no solo el punto
        x,y=q.popleft(); duchy[y][x]=i; n+=1
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<MW and 0<=ny<MH and lp[nx,ny] and (nx,ny) not in mark:
                mark.add((nx,ny)); q.append((nx,ny))
    print(f"   a mano: {nom:10} -> {reg:16} ({n:4d} px)")

huerf=sum(1 for y in range(MH) for x in range(MW) if lp[x,y] and not duchy[y][x])
if huerf:
    vis=[[False]*MW for _ in range(MH)]
    trozos=[]
    for y0 in range(MH):
        for x0 in range(MW):
            if not lp[x0,y0] or duchy[y0][x0] or vis[y0][x0]: continue
            q=deque([(x0,y0)]); vis[y0][x0]=True; c=[]
            while q:
                x,y=q.popleft(); c.append((x,y))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<MW and 0<=ny<MH and lp[nx,ny] and not duchy[ny][nx] and not vis[ny][nx]:
                        vis[ny][nx]=True; q.append((nx,ny))
            trozos.append(c)
    salvados=0; perdidos=0
    for c in trozos:
        cx=sum(p[0] for p in c)/len(c); cy=sum(p[1] for p in c)/len(c)
        bx=int((A*(GW+cx/MW*(GE-GW))+B-vx)*SC); by=sy_of[min(MH-1,max(0,int(cy)))]
        mejor=None
        for rr in range(1,RBUSCA):
            for dx in range(-rr,rr+1):
                for dy in (-rr,rr) if abs(dx)<rr else range(-rr,rr+1):
                    px,py=bx+dx,by+dy
                    if not(0<=px<IW and 0<=py<IH): continue
                    n=idx_of(*ip[px,py])
                    if n: mejor=n; break
                if mejor: break
            if mejor: break
        if mejor is None:
            # 2o escalon: el SVG no tiene nada cerca (Feroe no existe en MapChart). Agarrarse al
            # ducado YA ASIGNADO mas cercano de nuestro propio raster. Asi las otras islas de un
            # archipielago (Unst, Yell y Fetlar en Shetland) caen con la isla principal, que es a
            # donde pertenecen. Sin esto quedaban 302 px sueltos = mar.
            bd=None
            for rr in range(1,120):
                for dx in range(-rr,rr+1):
                    for dy in (-rr,rr) if abs(dx)<rr else range(-rr,rr+1):
                        x,y=int(cx)+dx,int(cy)+dy
                        if 0<=x<MW and 0<=y<MH and duchy[y][x]: bd=duchy[y][x]; break
                    if bd: break
                if bd: break
            mejor=bd
        if mejor:
            for x,y in c: duchy[y][x]=mejor
            salvados+=len(c)
        else: perdidos+=len(c)
    print(f"   islas huerfanas: {len(trozos)} trozos · {salvados:,} px RESCATADOS del mar · {perdidos:,} px sin region cerca")
huerf2=sum(1 for y in range(MH) for x in range(MW) if lp[x,y] and not duchy[y][x])
print(f"   tierra sin ducado al final: {huerf2:,} px  (era {huerf:,})")

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
