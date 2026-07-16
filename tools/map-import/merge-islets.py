# FUSION DE DUCADOS MINUSCULOS (islotes y fragmentos de costa).
# Un islote demasiado pequeno para partirse en dos no debe ser un ducado el solo: se une al ducado
# vecino -aunque haya mar de por medio- y el conjunto ya da para dos o mas provincias.
# Malta con Sicilia, las Cicladas juntas: que ademas es lo que fueron.
# Lee y reescribe duchies.png (haz copia antes si quieres volver).
import json, math
from collections import Counter, defaultdict
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
MIN_DUCHY=180      # px: por debajo de esto un ducado no da para 2 provincias decentes (2x70 + holgura)
MAX_KM=220         # no se fusiona con un ducado que este mas lejos que esto (islas oceanicas sueltas)

d=Image.open(SP+"duchies.png").convert("RGB"); dp=d.load(); MW,MH=d.size
meta=json.load(open(SP+"duchies.json",encoding="utf8")); ids=meta["ids"]
GW,GE,GS,GN=-11,50,27,66.5
yn=math.log(math.tan(math.pi/4+GN*math.pi/360)); ys=math.log(math.tan(math.pi/4+GS*math.pi/360))
def lonlat(x,y):
    m=yn-y/MH*(yn-ys)
    return (GW+x/MW*(GE-GW),(math.atan(math.exp(m))-math.pi/4)*360/math.pi)
def km(a,b):
    lo1,la1=lonlat(*a); lo2,la2=lonlat(*b)
    R=6371;dla=(la2-la1)*math.pi/180;dlo=(lo2-lo1)*math.pi/180
    h=math.sin(dla/2)**2+math.cos(la1*math.pi/180)*math.cos(la2*math.pi/180)*math.sin(dlo/2)**2
    return 2*R*math.asin(math.sqrt(h))

grid=[[0]*MW for _ in range(MH)]
for y in range(MH):
    for x in range(MW):
        r,g,b=dp[x,y]; grid[y][x]=r|(g<<8)|(b<<16)

for vuelta in range(8):
    area=Counter(); sx=defaultdict(int); sy=defaultdict(int)
    for y in range(MH):
        for x in range(MW):
            n=grid[y][x]
            if n: area[n]+=1; sx[n]+=x; sy[n]+=y
    cent={n:(sx[n]/area[n],sy[n]/area[n]) for n in area}
    small=[n for n,a in area.items() if a<MIN_DUCHY]
    if not small: break
    # vecinos por contacto
    touch=defaultdict(Counter)
    ss=set(small)
    for y in range(MH):
        for x in range(MW):
            a=grid[y][x]
            if a not in ss: continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if 0<=nx<MW and 0<=ny<MH:
                    b=grid[ny][nx]
                    if b and b!=a: touch[a][b]+=1
    ren={}
    for n in small:
        # 1) si toca tierra con otro ducado, se une al que MAS borde comparta
        cand=[q for q in touch[n] if q not in ss or area[q]>area[n]]
        if touch[n]:
            ren[n]=max(touch[n].items(), key=lambda kv:(kv[1],area[kv[0]]))[0]
            continue
        # 2) isla: al ducado GRANDE mas cercano (cruzando el mar), si esta a tiro
        best=None;bd=MAX_KM
        for q,a in area.items():
            if q==n or a<MIN_DUCHY: continue
            dkm=km(cent[n],cent[q])
            if dkm<bd: bd=dkm;best=q
        if best: ren[n]=best
    if not ren: break
    # resolver cadenas (a->b->c)
    for n in list(ren):
        seen=set()
        while ren[n] in ren and ren[n] not in seen:
            seen.add(ren[n]); ren[n]=ren[ren[n]]
    for y in range(MH):
        for x in range(MW):
            a=grid[y][x]
            if a in ren: grid[y][x]=ren[a]
    print(f"vuelta {vuelta+1}: {len(ren)} ducados minusculos fusionados con su vecino")

area=Counter()
for y in range(MH):
    for x in range(MW):
        if grid[y][x]: area[grid[y][x]]+=1
v=sorted(area.values())
KM2=(61/MW*111)*(39.5/MH*111)*0.7
print(f"\nDUCADOS: {len(area)}  (antes 1.421)")
print(f"  tamano: mediana {v[len(v)//2]:,} px · p10 {v[len(v)//10]:,} · min {v[0]}")
print(f"  ducados que aun no dan para 2 provincias (<{MIN_DUCHY} px): {sum(1 for a in v if a<MIN_DUCHY)}")
out=Image.new("RGB",(MW,MH)); op=out.load()
for y in range(MH):
    for x in range(MW):
        n=grid[y][x]; op[x,y]=(n&255,(n>>8)&255,(n>>16)&255)
out.save(SP+"duchies.png")
print("-> duchies.png reescrito")
