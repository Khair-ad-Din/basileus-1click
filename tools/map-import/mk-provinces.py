# FASE C: partir cada ducado en provincias.  (reescrito limpio: los 4 intentos anteriores eran
# parches encima de parches y cada uno arreglaba la metrica que yo miraba rompiendo lo que se veia)
#
# K-MEDIAS CON CAPACIDAD. La k-medias normal reparte por distancia, y eso la deja escaquearse:
# si el ducado tiene un tentaculo costero (el 18% de la tierra no cae en ninguna region de EU4 y
# se rellena por vecindad) o una isla pegada (la fusion de islotes), separar ESO es lo que menos
# distancia cuesta. Medido: la 2a provincia medía el 4% de la 1a en la mediana, y el 80% de los
# ducados salian con un reparto de mentira. Con capacidad, cada trozo tiene que llevarse su parte
# del area, asi que no le queda mas remedio que partir el bloque: las provincias salen como gajos
# desde el centro, que es como ya salian bien los ducados compactos.
#
# Uso: python mk-provinces.py [px_por_provincia]
import json, math, sys
from collections import Counter, defaultdict
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
TARGET=int(sys.argv[1]) if len(sys.argv)>1 else 390
# HOLGURA DEL CUPO: el mando entre las FRANJAS y el equilibrio de los gajos (bug 3b del LEEME).
# Con el cupo justo, los pixeles disputados —los del borde, los que se colocan los ULTIMOS— no
# tienen donde caer y acaban en un centroide lejano: dejan una tira de 1 px del color equivocado
# incrustada en la vecina. Con mas holgura caben en el suyo.
# Medido: al cambiar los ducados (matar los fantasmas) las franjas pasaron de 39 a 757 px con 1.08.
HOLGURA=float(sys.argv[2]) if len(sys.argv)>2 else 1.08
SUF=sys.argv[3] if len(sys.argv)>3 else ""
MIN_PX=70          # la provincia mas pequena del mapa actual son 71 px
KMAX_BAL=14        # por encima de esto (Sahara, Rusia) la capacidad es lenta y alli no se nota

d=Image.open(SP+"duchies.png").convert("RGB"); dp=d.load(); MW,MH=d.size
meta=json.load(open(SP+"duchies.json",encoding="utf8")); ids=meta["ids"]

class RNG:                                   # mulberry32, el mismo del juego: determinista
    def __init__(s,seed): s.a=seed&0xFFFFFFFF
    def __call__(s):
        s.a=(s.a+0x6D2B79F5)&0xFFFFFFFF
        t=s.a
        t=((t^(t>>15))*(t|1))&0xFFFFFFFF
        t=(t^(t+(((t^(t>>7))*(t|61))&0xFFFFFFFF)))&0xFFFFFFFF
        return ((t^(t>>14))&0xFFFFFFFF)/4294967296
rnd=RNG(193909)

px_of=defaultdict(list)
for y in range(MH):
    for x in range(MW):
        r,g,b=dp[x,y]; n=r|(g<<8)|(b<<16)
        if n: px_of[n].append((x,y))
print(f"ducados: {len(px_of)}")

def kOf(a):
    # todo ducado se parte en DOS como minimo, y en mas cuantos quepan
    return max(1, min(max(2, round(a/TARGET)), a//MIN_PX))

def particion(pts,k):
    n=len(pts)
    cent=[pts[int(rnd()*n)]]                 # k-medias++ para arrancar
    while len(cent)<k:
        dd=[min((p[0]-c[0])**2+(p[1]-c[1])**2 for c in cent) for p in pts]
        tot=sum(dd) or 1
        r=rnd()*tot; acc=0; pick=pts[-1]
        for p,v in zip(pts,dd):
            acc+=v
            if acc>=r: pick=p; break
        cent.append(pick)
    lab=None
    balanced = k<=KMAX_BAL and n*k<=400000
    for it in range(12):
        if balanced:
            # Reparto con cupo, POR VENTAJA (no por distancia absoluta).
            # Ordenar por distancia absoluta era el error: el centroide se llenaba con sus pixeles
            # mas proximos —que forman un DISCO— y al alcanzar el cupo el resto se lo comian los
            # vecinos, dejando circulos de una provincia incrustados en otra. Y los empates de
            # distancia se rompian por orden de pixel (fila a fila), lo que dejaba recuadros
            # alineados con los ejes en los ducados pequenos (Italia).
            # Ahora manda la VENTAJA que el mejor centroide le saca al segundo: primero se colocan
            # los pixeles con dueno claro y los disputados se reparten al final. Fronteras rectas.
            cap=int(n/k*HOLGURA)+1  # holgura: con el cupo justo, los ultimos pixeles
            orden=[]              # (los del borde) no tienen donde caer y acaban en un centroide lejano
            for i,p in enumerate(pts):
                ds=sorted(((p[0]-c[0])**2+(p[1]-c[1])**2, j) for j,c in enumerate(cent))
                # ventaja = lo que el 2o esta peor que el 1o. Cuanto mayor, menos discutible.
                orden.append((-(ds[1][0]-ds[0][0]), i, [j for _,j in ds]))
            orden.sort()
            nl=[-1]*n; cnt=[0]*k
            for _,i,pref in orden:
                for j in pref:
                    if cnt[j]<cap: nl[i]=j; cnt[j]+=1; break
                if nl[i]<0: nl[i]=pref[0]
        else:
            nl=[]
            for p in pts:
                best=0;bd=1e18
                for j,c in enumerate(cent):
                    dx=p[0]-c[0];dy=p[1]-c[1];v=dx*dx+dy*dy
                    if v<bd: bd=v;best=j
                nl.append(best)
        if nl==lab: break
        lab=nl
        sx=[0]*k;sy=[0]*k;sn=[0]*k
        for i,p in enumerate(pts):
            j=lab[i];sx[j]+=p[0];sy[j]+=p[1];sn[j]+=1
        for j in range(k):
            if sn[j]: cent[j]=(sx[j]/sn[j],sy[j]/sn[j])
    # CADA PROVINCIA, UNA SOLA PIEZA. El reparto por ventaja coloca los pixeles disputados —los del
    # borde— los ULTIMOS, cuando sus centroides preferidos ya han llenado el cupo: caian en uno
    # lejano y dejaban una FRANJA fina del color equivocado pegada a la costura, que en la practica
    # era un trozo de una provincia cuyo cuerpo estaba a 40 km. Aqui cada trozo suelto se lo queda
    # el gajo que mas lo rodea.
    idx={p:i for i,p in enumerate(pts)}
    for _ in range(6):
        vis=[False]*n; cuerpo={}
        for i0 in range(n):
            if vis[i0]: continue
            l=lab[i0]; pila=[i0]; vis[i0]=True; trozo=[i0]
            while pila:
                i=pila.pop(); x,y=pts[i]
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    j=idx.get((x+dx,y+dy))
                    if j is not None and not vis[j] and lab[j]==l:
                        vis[j]=True; pila.append(j); trozo.append(j)
            if l not in cuerpo or len(trozo)>len(cuerpo[l][1]): cuerpo.setdefault(l,(0,[]))
            if len(trozo)>len(cuerpo[l][1]): cuerpo[l]=(len(trozo),trozo)
            else: cuerpo.setdefault(l,(len(trozo),trozo))
        # recorrer otra vez marcando los trozos que NO son el cuerpo de su gajo
        vis=[False]*n; sueltos=[]
        for i0 in range(n):
            if vis[i0]: continue
            l=lab[i0]; pila=[i0]; vis[i0]=True; trozo=[i0]
            while pila:
                i=pila.pop(); x,y=pts[i]
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    j=idx.get((x+dx,y+dy))
                    if j is not None and not vis[j] and lab[j]==l:
                        vis[j]=True; pila.append(j); trozo.append(j)
            if len(trozo)<cuerpo[l][0]: sueltos.append(trozo)
        if not sueltos: break
        cambio=False
        for trozo in sueltos:
            v=Counter()
            for i in trozo:
                x,y=pts[i]
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    j=idx.get((x+dx,y+dy))
                    if j is not None and lab[j]!=lab[i]: v[lab[j]]+=1
            if not v: continue
            nuevo=v.most_common(1)[0][0]
            for i in trozo: lab[i]=nuevo
            cambio=True
        if not cambio: break
    return lab

prov=[[0]*MW for _ in range(MH)]
pid=0; duc={}
for n,pts in sorted(px_of.items()):
    k=kOf(len(pts))
    if k<=1:
        pid+=1
        for p in pts: prov[p[1]][p[0]]=pid
        duc[pid]=n
        continue
    lab=particion(pts,k)
    base=pid
    for i,p in enumerate(pts): prov[p[1]][p[0]]=base+lab[i]+1
    for i in range(k): duc[base+i+1]=n
    pid+=k
print(f"provincias creadas: {pid}")

# ---- LA PRUEBA QUE IMPORTA: la 2a provincia frente a la 1a, dentro de cada ducado ----
pd=defaultdict(Counter)
for y in range(MH):
    for x in range(MW):
        p=prov[y][x]
        if p: pd[duc[p]][p]+=1
rat=sorted((sorted(c.values())[0]/sorted(c.values())[-1]) if len(c)>1 else 0.0 for c in pd.values())
print(f"\nproporcion menor/mayor dentro del ducado: MEDIANA {rat[len(rat)//2]:.2f} · p10 {rat[len(rat)//10]:.2f}")
print(f"  (1.00 = trozos iguales · con la k-medias normal la mediana era 0.04)")
print(f"  ducados con la 2a por debajo del 30% de la 1a: {sum(1 for r in rat if r<0.30)} de {len(rat)}")

cnt=Counter()
for y in range(MH):
    for x in range(MW):
        if prov[y][x]: cnt[prov[y][x]]+=1
sz=sorted(cnt.values())
KM2=(61/MW*111)*(39.5/MH*111)*0.7
print(f"\nPROVINCIAS: {len(cnt)}   (hoy: 4.828)")
print(f"tamano: mediana {sz[len(sz)//2]:,} px = {sz[len(sz)//2]*KM2:,.0f} km2 = {math.sqrt(sz[len(sz)//2]*KM2):.0f} km de lado   [hoy: 428 px / 52 km]")
print(f"  p10 {sz[len(sz)//10]:,} px · min {sz[0]} px · menores de 60 px: {sum(1 for v in sz if v<60)}")

out=Image.new("RGB",(MW,MH)); op=out.load()
for y in range(MH):
    for x in range(MW):
        n=prov[y][x]; op[x,y]=(n&255,(n>>8)&255,(n>>16)&255)
out.save(SP+f"provs{SUF}.png")
json.dump({str(k):v for k,v in duc.items()}, open(SP+f"prov_duchy{SUF}.json","w",encoding="utf8"))
print("-> provs.png + prov_duchy.json")
