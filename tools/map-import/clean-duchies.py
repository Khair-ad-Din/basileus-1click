# Un ducado debe ser UNA pieza (o una pieza + sus islas). El relleno de la franja costera por
# vecindad deja trozos sueltos: pedazos del ducado 37 perdidos en medio del 10, el 42 y el 1.
# Eso lo hereda el reparto de provincias y produce astillas imposibles de fusionar (sus vecinas
# son de otro ducado).
# Aqui: cada ducado se queda con su CUERPO; los fragmentos rodeados de TIERRA ajena pasan al
# ducado que mas los rodea. Los fragmentos rodeados de MAR son islas de verdad y se respetan.
import json
from collections import Counter, defaultdict, deque
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
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
    for d,lst in porDuc.items():
        lst.sort(reverse=True)
        for n,c in lst[1:]:          # todos menos el CUERPO
            huesped[c]=None
    if not huesped: break
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
    ren={}
    for c in huesped:
        if not rod[c]: continue                       # isla de verdad: se respeta
        borde=sum(rod[c].values())
        if borde < mar[c]*0.5: continue               # mas mar que tierra: es una isla
        ren[c]=rod[c].most_common(1)[0][0]
    if not ren: break
    n=0
    for y in range(MH):
        for x in range(MW):
            c=comp[y][x]
            if c in ren: g[y][x]=ren[c]; n+=1
    print(f"vuelta {vuelta+1}: {len(ren)} fragmentos sueltos ({n:,} px) devueltos a quien los rodea")
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
