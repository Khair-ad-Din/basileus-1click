# Un ducado debe ser UNA pieza (o una pieza + sus islas). El relleno de la franja costera por
# vecindad deja trozos sueltos: pedazos del ducado 37 perdidos en medio del 10, el 42 y el 1.
# Eso lo hereda el reparto de provincias y produce astillas imposibles de fusionar (sus vecinas
# son de otro ducado).
# Aqui: cada ducado se queda con su CUERPO; los fragmentos rodeados de TIERRA ajena pasan al
# ducado que mas los rodea. Los fragmentos rodeados de MAR son islas de verdad y se respetan.
# LA REGLA DE LA ISLA ESTABA MAL PENSADA (y es la causa de un bug que costo media sesion).
# Antes: "mas mar que tierra alrededor -> es una isla, se respeta". Pero un FANTASMA de paleta (una
# mezcla de antialiasing que decodifica al id de otra region) que cae en la costa esta rodeado de
# agua, asi que pasaba por isla y se quedaba ahi para siempre.
# Medido: el ducado de CUENCA tenia 22 px en EGIPTO, a 3.400 km. Eastern_Siberia, 6 px en Creta.
# 26 provincias de 5.787 salian desperdigadas por media Europa.
# El sintoma que lo destapo era otro y parecia no tener nada que ver: la provincia se veia SIN
# TEXTURA. bakeTerrain escala el sprite para cubrir el RECUADRO de la provincia; con 286 px repartidos
# en un recuadro de 1109x463, el sprite se estira tanto que dentro de la provincia solo cae un
# pedacito hipermagnificado -> color casi plano. El sprite si se pintaba: a un zoom absurdo.
# AHORA: una isla pertenece a un ducado QUE ESTA AL LADO. Un trozo a mas de LEJOS_KM de su propio
# cuerpo no es una isla, sea lo que sea lo que lo rodee: es un fantasma y se reasigna.
import json, math
from collections import Counter, defaultdict, deque
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
LEJOS_KM=400.0     # merge-islets une islotes hasta 220 km y Feroe esta a ~300 de Shetland: 400 sobra
GW,GE,GS,GN=-11,50,27,66.5
im=Image.open(SP+"duchies.png").convert("RGB"); ip=im.load(); MW,MH=im.size
g=[[0]*MW for _ in range(MH)]
for y in range(MH):
    for x in range(MW):
        r,gg,b=ip[x,y]; g[y][x]=r|(gg<<8)|(b<<16)
for vuelta in range(6):
    # componentes conexas de cada ducado
    comp=[[0]*MW for _ in range(MH)]
    cid=0; info={}
    for y0 in range(MH):
        for x0 in range(MW):
            if not g[y0][x0] or comp[y0][x0]: continue
            cid+=1; d=g[y0][x0]; n=0
            dq=deque([(x0,y0)]); comp[y0][x0]=cid
            while dq:
                x,y=dq.popleft(); n+=1
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<MW and 0<=ny<MH and g[ny][nx]==d and not comp[ny][nx]:
                        comp[ny][nx]=cid; dq.append((nx,ny))
            info[cid]=(d,n)
    porDuc=defaultdict(list)
    for c,(d,n) in info.items(): porDuc[d].append((n,c))
    huesped={}                       # componente -> ducado que se lo queda
    cuerpo={}                        # ducado -> componente de su cuerpo
    for d,lst in porDuc.items():
        lst.sort(reverse=True)
        cuerpo[d]=lst[0][1]
        for n,c in lst[1:]:          # todos menos el CUERPO
            huesped[c]=None
    if not huesped: break
    # centroide de cada componente, para medir a que distancia esta del cuerpo de su ducado
    cen=defaultdict(lambda:[0,0,0])
    for y in range(MH):
        for x in range(MW):
            c=comp[y][x]
            if c: a=cen[c]; a[0]+=x; a[1]+=y; a[2]+=1
    yn=math.log(math.tan(math.pi/4+GN*math.pi/360)); ys=math.log(math.tan(math.pi/4+GS*math.pi/360))
    def lonlat(c):
        a=cen[c]; x=a[0]/a[2]; y=a[1]/a[2]
        return GW+x/MW*(GE-GW), (math.atan(math.exp(yn-y/MH*(yn-ys)))-math.pi/4)*360/math.pi
    def kmDelCuerpo(c):
        b=cuerpo[info[c][0]]
        lo1,la1=lonlat(c); lo2,la2=lonlat(b)
        return math.hypot((lo1-lo2)*111*math.cos((la1+la2)/2*math.pi/180), (la1-la2)*111)
    # ¿que rodea a cada fragmento? tierra ajena o mar
    rod=defaultdict(Counter); mar=Counter()
    for y in range(MH):
        for x in range(MW):
            c=comp[y][x]
            if c not in huesped: continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if not(0<=nx<MW and 0<=ny<MH): mar[c]+=1; continue
                o=g[ny][nx]
                if not o: mar[c]+=1
                elif o!=info[c][0]: rod[c][o]+=1
    ren={}; fant=0; fantPx=0
    for c in huesped:
        lejos = kmDelCuerpo(c) > LEJOS_KM
        if lejos:
            # FANTASMA: esta a la otra punta del mapa de su propio cuerpo. No es una isla, se mire
            # como se mire. Se lo queda quien lo rodee; si solo tiene mar al lado, se busca el ducado
            # mas cercano en espiral (un fantasma en mitad del oceano no puede quedarse ahi).
            # OJO: NO vale "el que mas me rodea" a secas. Dos fantasmas VECINOS son cada uno el que
            # mas rodea al otro y se pasan la pelota eternamente (medido: 2 fragmentos rebotando en
            # las vueltas 4, 5 y 6 sin converger). Se elige entre los vecinos el que tenga su CUERPO
            # mas cerca de aqui: o sea, quien de verdad manda en esta zona.
            # SOLO UN CUERPO PUEDE ABSORBER A UN FANTASMA, nunca otro fragmento. Sin esta regla dos
            # fantasmas VECINOS se absorben mutuamente y rebotan para siempre: medido, dos islotes de
            # las Hebridas adjudicados a Nenets (Artico ruso) y a Constanza (Alemania) —por mi propio
            # rescate de islas, que en su espiral se trago un pixel fantasma— se pasaban la pelota en
            # las vueltas 3, 4, 5 y 6 sin converger.
            esCuerpo=lambda x,y: comp[y][x]==cuerpo.get(g[y][x])
            lo1,la1=lonlat(c)
            def kmACuerpoDe(d):
                b=cuerpo.get(d)
                if b is None: return 1e9
                lo2,la2=lonlat(b)
                return math.hypot((lo1-lo2)*111*math.cos((la1+la2)/2*math.pi/180), (la1-la2)*111)
            cand=[d for d in rod[c] if cuerpo.get(d) is not None and kmACuerpoDe(d)<=LEJOS_KM]
            if cand:
                ren[c]=min(cand, key=lambda d:(kmACuerpoDe(d), -rod[c][d]))
            else:
                # sin tierra al lado (islote en mitad del agua): el CUERPO mas cercano en espiral
                a=cen[c]; x0=int(a[0]/a[2]); y0=int(a[1]/a[2]); best=None
                for rr in range(1,260):
                    for dx in range(-rr,rr+1):
                        for dy in ((-rr,rr) if abs(dx)<rr else range(-rr,rr+1)):
                            x,y=x0+dx,y0+dy
                            if 0<=x<MW and 0<=y<MH and g[y][x] and g[y][x]!=info[c][0] and esCuerpo(x,y):
                                best=g[y][x]; break
                        if best: break
                    if best: break
                if best: ren[c]=best
                else: continue
            fant+=1; fantPx+=info[c][1]
            continue
        if not rod[c]: continue                       # isla de verdad, y CERCA de su cuerpo: se respeta
        borde=sum(rod[c].values())
        if borde < mar[c]*0.5: continue               # mas mar que tierra: es una isla
        ren[c]=rod[c].most_common(1)[0][0]
    if not ren: break
    n=0
    for y in range(MH):
        for x in range(MW):
            c=comp[y][x]
            if c in ren: g[y][x]=ren[c]; n+=1
    print(f"vuelta {vuelta+1}: {len(ren)} fragmentos sueltos ({n:,} px) devueltos a quien los rodea"
          + (f"  ·  de ellos {fant} FANTASMAS ({fantPx} px) a mas de {LEJOS_KM:.0f} km de su cuerpo" if fant else ""))
# ---------- LOS TENTACULOS DE 1 PIXEL ----------
# Medido: duchies.png traia 138 franjas de 1 px (812 px) y provs.png sacaba 124 (732) EN LAS MISMAS
# COORDENADAS. Las provincias no generan las franjas: las HEREDAN. Por eso la holgura del cupo no
# movia la aguja (124/122/124/123 con 1.08/1.20/1.35/1.50) — el LEEME apuntaba al cupo porque ahi
# estuvo la causa la PRIMERA vez, no esta.
# Un tentaculo es un pixel con 3+ vecinos del MISMO ducado ajeno: no hay forma de que eso sea
# frontera de verdad, es el rastro de dos frentes de relleno que se cruzaron.
# CON CUIDADO (bug 5 del LEEME: "el filtro de mayoria erosiona los ducados pequenos, se comio 167"):
# esto NO es un filtro de mayoria. Solo toca pixeles rodeados por 3+ lados del MISMO vecino, nunca
# adelgaza un cuerpo, y se niega a tocar un ducado que ya sea pequeno.
MIN_INTOCABLE=120        # por debajo de esto, ni un pixel: son islotes que no pueden permitirse perder
tot=0
# HASTA CONVERGER, no 4 vueltas. La erosion solo come pixeles con 3+ vecinos del MISMO vecino,
# o sea LA PUNTA del dedo: cada vuelta pela una fila, y un dedo de 6 px necesita 6 vueltas.
# Capado en 4, los dedos sobrevivian a medio pelar — y yo lei el '128 px por vuelta' como
# desbocamiento (bug 5) cuando era justo lo contrario: trabajo sin terminar.
# No puede comerse el mapa: en un borde solido ningun pixel tiene 3 vecinos del mismo ajeno,
# asi que se para sola. El tope es solo un cinturon de seguridad.
for vuelta in range(40):
    area=Counter()
    for y in range(MH):
        for x in range(MW):
            if g[y][x]: area[g[y][x]]+=1
    cambio=[]
    for y in range(1,MH-1):
        for x in range(1,MW-1):
            d=g[y][x]
            if not d or area[d]<=MIN_INTOCABLE: continue
            v=Counter()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                o=g[y+dy][x+dx]
                if o and o!=d: v[o]+=1
            if not v: continue
            o,k=v.most_common(1)[0]
            if k>=3: cambio.append((x,y,o))     # rodeado por 3+ lados del mismo: es un tentaculo
    if not cambio: break
    for x,y,o in cambio: g[y][x]=o
    tot+=len(cambio)
    print(f"tentaculos: vuelta {vuelta+1} · {len(cambio):,} px de 1 px de ancho absorbidos por quien los rodea")
if tot: print(f"   total {tot:,} px  (los ducados de <={MIN_INTOCABLE} px no se tocan)")

area=Counter()
for y in range(MH):
    for x in range(MW):
        if g[y][x]: area[g[y][x]]+=1
print(f"\nDUCADOS: {len(area)}  · min {min(area.values())} px")
out=Image.new("RGB",(MW,MH)); op=out.load()
for y in range(MH):
    for x in range(MW):
        n=g[y][x]; op[x,y]=(n&255,(n>>8)&255,(n>>16)&255)
out.save(SP+"duchies.png")
print("-> duchies.png")
