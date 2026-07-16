# Genera un SVG donde cada region de EU4 va pintada de un color unico que codifica su indice.
# Al renderizarlo con Chrome (curvas Bezier de verdad, no aproximadas) y leer los pixeles,
# recuperamos que region cubre cada punto.
import re, math, json
SP="C:/Users/sergi/AppData/Local/Temp/claude/c--Users-sergi-OneDrive-Documentos-Basileus-1-click/c21bac07-d2c6-42b3-aefa-d92e590eb691/scratchpad/"
SRC=r"c:/Users/sergi/OneDrive/Documentos/Basileus 1 click/MapChart_Map.svg"

# proyeccion del SVG ajustada maximizando la coincidencia de tierra/mar (96.44%)
A,B,AY,BY=3.3420,598.400,-191.0636,296.386
def miller(la): return 1.25*math.log(math.tan(math.pi/4+0.4*la*math.pi/180))
GW,GE,GS,GN=-11,50,27,66.5
x0=A*GW+B; x1=A*GE+B
y0=AY*miller(GN)+BY; y1=AY*miller(GS)+BY     # AY es negativo: NORTE = y menor
PAD=2.0
vx,vy=x0-PAD,y0-PAD
vw,vh=(x1-x0)+2*PAD,(y1-y0)+2*PAD
SCALE=16
W,H=int(round(vw*SCALE)),int(round(vh*SCALE))
print(f"recorte del SVG: x {x0:.1f}..{x1:.1f}  y {y0:.1f}..{y1:.1f}")
print(f"viewBox = {vx:.2f} {vy:.2f} {vw:.2f} {vh:.2f}   ->  render {W}x{H} px (x{SCALE})")

s=open(SRC,encoding="utf8").read()
ids=[]
def repl(m):
    pid=m.group(1)
    i=len(ids); ids.append(pid)
    n=i+1                                   # 0 se reserva para "ninguna region"
    col="#%02x%02x%02x"%(n&255,(n>>8)&255,(n>>16)&255)
    # EL TRAZO VA DEL MISMO COLOR QUE EL RELLENO. EU4 dibuja las regiones con stroke negro de
    # 0.25 y ese trazo TAPA las costuras entre paths (no teselan perfecto). Al quitarlo, el 37% de
    # la tierra se quedaba en negro. Con el trazo del color de la region, cada una crece media
    # anchura y la costura se cierra sola.
    return f'<path id="{pid}" fill="{col}" stroke="{col}" stroke-width=".45" shape-rendering="crispEdges"'
s2=re.sub(r'<path id="([^"]+)"\s+fill="[^"]*"(?:\s+fill-rule="[^"]*")?\s+stroke="[^"]*"\s+stroke-width="[^"]*"', repl, s)
print(f"paths recoloreados: {len(ids)}")
# el fondo a negro (0 = sin region) y el recorte
s2=re.sub(r'<svg id="wrapper"[^>]*>',
  f'<svg id="wrapper" viewBox="{vx:.4f} {vy:.4f} {vw:.4f} {vh:.4f}" width="{W}" height="{H}" '
  f'style="background-color:#000" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" '
  f'xmlns:xlink="http://www.w3.org/1999/xlink">', s2, count=1)
s2=re.sub(r'<rect id="svg-background"[^>]*></rect>','',s2)   # el </rect> tambien, o el XML rompe
# hay un SVG ANIDADO (id="map", viewBox propio 0 0 1200 480) que contiene los paths: el recorte
# se hace en el wrapper y el anidado se deja tal cual, en 1:1 con las coordenadas del wrapper.
s2=re.sub(r'<svg xmlns="http://www.w3.org/2000/svg" id="map"[^>]*>',
  '<svg xmlns="http://www.w3.org/2000/svg" id="map" width="1200" height="480" viewBox="0 0 1200 480" overflow="visible">', s2, count=1)
open(SP+"ids.svg","w",encoding="utf8").write(s2)
json.dump({"ids":ids,"vx":vx,"vy":vy,"vw":vw,"vh":vh,"W":W,"H":H,"SCALE":SCALE,
           "A":A,"B":B,"AY":AY,"BY":BY}, open(SP+"idsvg.json","w",encoding="utf8"))
print(f"-> ids.svg  ({len(s2)/1e6:.1f} MB)")
