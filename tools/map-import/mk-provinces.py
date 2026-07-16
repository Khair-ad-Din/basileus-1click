# FASE C: subdividir cada ducado en 2-4 provincias segun su tamano.
# Semillas repartidas (farthest-point) + BFS GEODESICO dentro del ducado: cada provincia sale
# conexa por construccion (un Voronoi euclideo podria partirla en trozos al cruzar un fiordo).
# Determinista: RNG propio con semilla fija.
import json, math
from collections import deque, Counter
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
d=Image.open(SP+"duchies.png").convert("RGB"); dp=d.load(); MW,MH=d.size
meta=json.load(open(SP+"duchies.json",encoding="utf8")); ids=meta["ids"]

# RNG determinista (mulberry32, el mismo del juego)
class RNG:
    def __init__(s,seed): s.a=seed&0xFFFFFFFF
    def __call__(s):
        s.a=(s.a+0x6D2B79F5)&0xFFFFFFFF
        t=s.a
        t=((t^(t>>15))*(t|1))&0xFFFFFFFF
        t=(t^(t+(((t^(t>>7))*(t|61))&0xFFFFFFFF)))&0xFFFFFFFF
        return ((t^(t>>14))&0xFFFFFFFF)/4294967296
rnd=RNG(193909)

# pixeles por ducado
px_of={}
for y in range(MH):
    for x in range(MW):
        r,g,b=dp[x,y]; n=r|(g<<8)|(b<<16)
        if n: px_of.setdefault(n,[]).append((x,y))
print(f"ducados: {len(px_of)}")

# cuantas provincias por ducado, SEGUN SU TAMANO
def kOf(a):
    if a<200: return 1        # islotes: partirlos daria astillas de 100 px
    if a<1200: return 2
    if a<2400: return 3
    return 4
kk=Counter(kOf(len(v)) for v in px_of.values())
print("provincias por ducado: "+" · ".join(f"{k} -> {kk[k]} ducados" for k in sorted(kk)))
TOT=sum(kOf(len(v)) for v in px_of.values())
print(f"TOTAL de provincias que saldran: {TOT}   (hoy hay 3.680)")

prov=[[0]*MW for _ in range(MH)]
pid=0
info=[]
# K-MEDIAS (Lloyd), no farthest-point. La siembra por lejania ponia una semilla en el fragmento
# mas REMOTO del ducado: como la costa de Natural Earth no casa con las regiones de EU4, muchos
# ducados quedan troceados en islitas, la semilla caia alli y salia una astilla de 60 px.
# K-medias reparte por AREA: las provincias salen parejas y compactas.
for n,pts in sorted(px_of.items()):
    k=kOf(len(pts))
    if k==1:
        pid+=1
        for p in pts: prov[p[1]][p[0]]=pid
        info.append({"duchy":ids[n-1],"pid":pid})
        continue
    # k-medias++: la 1a al azar; las siguientes con prob. proporcional a la distancia^2
    cent=[pts[int(rnd()*len(pts))]]
    while len(cent)<k:
        dd=[min((p[0]-c[0])**2+(p[1]-c[1])**2 for c in cent) for p in pts]
        tot=sum(dd) or 1
        r=rnd()*tot; acc=0; pick=pts[-1]
        for p,v in zip(pts,dd):
            acc+=v
            if acc>=r: pick=p; break
        cent.append(pick)
    lab=[0]*len(pts)
    for it in range(14):
        moved=False
        for i,p in enumerate(pts):
            best=0;bd=1e18
            for j,c in enumerate(cent):
                dx=p[0]-c[0];dy=p[1]-c[1];v=dx*dx+dy*dy
                if v<bd: bd=v;best=j
            if lab[i]!=best: lab[i]=best;moved=True
        sx=[0]*k;sy=[0]*k;sn=[0]*k
        for i,p in enumerate(pts):
            j=lab[i];sx[j]+=p[0];sy[j]+=p[1];sn[j]+=1
        for j in range(k):
            if sn[j]: cent[j]=(sx[j]/sn[j],sy[j]/sn[j])
        if not moved: break
    base=pid
    for i,p in enumerate(pts): prov[p[1]][p[0]]=base+lab[i]+1
    for i in range(k): info.append({"duchy":ids[n-1],"pid":base+i+1})
    pid+=k
print(f"provincias creadas: {pid}")

cnt=Counter()
for y in range(MH):
    for x in range(MW):
        if prov[y][x]: cnt[prov[y][x]]+=1
sz=sorted(cnt.values())
KM2=(61/MW*111)*(39.5/MH*111)*0.7
print(f"tamano de provincia (px): mediana {sz[len(sz)//2]:,} · p10 {sz[len(sz)//10]:,} · p90 {sz[int(len(sz)*.9)]:,} · max {sz[-1]:,}")
print(f"~superficie mediana: {sz[len(sz)//2]*KM2:,.0f} km2  ({math.sqrt(sz[len(sz)//2]*KM2):.0f} km de lado)   [hoy: ~7.000 km2 / 85 km]")
print(f"provincias de menos de 60 px: {sum(1 for v in sz if v<60)}")

out=Image.new("RGB",(MW,MH)); op=out.load()
for y in range(MH):
    for x in range(MW):
        n=prov[y][x]; op[x,y]=(n&255,(n>>8)&255,(n>>16)&255)
out.save(SP+"provs.png")
json.dump(info,open(SP+"provs.json","w",encoding="utf8"))
print("-> provs.png + provs.json")
