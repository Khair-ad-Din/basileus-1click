# Obras, tropas y mantenimiento sin almacén de la corona (simplificación A)

Consejo de 2026-11-01 (cinco estamentos + cronista + consejero). Material del consejo: dossier, veredictos y dictamen del
cronista en el scratchpad de la sesión f9e3a418 (no versionado); aquí queda lo decidido.

## Decisiones de Sergio (previas al consejo)
1. Si la plaza no tiene el material, la obra o el reclutamiento ESPERA; esa demanda cuenta para precio y contratos.
2. La comida del ejército se compra en la plaza cada día con prioridad de hambre; lo que falte, forrajeo local.
3. El mantenimiento en bienes se compra en la plaza: cifra y libros mensuales, compra repartida en las 4 semanas.
4. Si el mantenimiento no se cubre, barra de estado que se deteriora (edificio produce peor; tropa: moral y más; más
   adelante motín o desbandada).
5. Costes recalibrados desde cero.

## Dictamen del consejero (pendiente de aprobación de Sergio)

### 1. Regla de coste de obra
`coste(b, nivel) = V_b × (1 + 0,5·nivel)`, reparto fijo 50% jornal, 10% herramientas, 40% materiales según plantilla;
unidades = parte / precio de referencia, pagadas al precio del día.
- Plantillas del 40%: **Madera** (madera 70, piedra 20, hierro 10): granja, aserradero, viñedo, telar, sedería,
  especiería, yeguada, majada, dehesa, pesquería, coto, cervecería, cadena del lienzo y del azúcar, campo, almacén,
  puerto. **Piedra** (piedra 70, madera 20, hierro 10): templo, mercado, salina, castillo, catedral, universidad, lonja,
  ciudadela. **Hierro** (madera 50, hierro 35, piedra 15): minas, cantera, herrería, armería, acería, fundición, gremio,
  cuartel.
- V (ducados de referencia): todo edificio que produce 12.000; cantera y mina de hierro 15.000; mina de plata 24.000,
  de oro 36.000 (acuñan: mirar su amortización aparte); mercado 15k, gremio 20k, templo 6k, cuartel 12k, campo 10k,
  almacén 8k, puerto 20k, fundición 30k, castillo 60k; catedral 90k, universidad 40k, lonja 45k, ciudadela 120k. Sin
  seda ni paño en las obras únicas.
- Ejemplo granja: 6.000 jornal, ~25 herramientas, 420 madera, 120 piedra, 20 hierro ≈ 12.000.
- Se borran BUILD_MAT_PRICE (estates.js) y CROWN_STOCK (economy2.js).

### 2. Pago por tramos semanales en TODA obra
Cada día de mercado se compra coste/semanas (jornal y bienes). Tramo no servido → la obra no avanza esa semana (y no se
paga jornal). Duración mínima 3 meses las que producen, 12 los servicios. Templo 12 meses, fundición 18, castillo 60,
lonja 72, universidad 96, ciudadela 96, catedral 144.

### 3. Reclutamiento = enganche (2 meses de soldada) + equipo de la plaza (sin grano)
| Tropa (hombres) | Equipo | Enganche | Total ref. |
|---|---|---|---|
| Levas (200) | lienzo 20, herramientas 10 | 600 | ~1,7k |
| Piqueros (400) | madera 100, hierro 40, paño 40 | 2.400 | ~6,7k |
| Alabarderos (300) | armas 50, hierro 30, paño 30 | 3.600 | ~12,2k |
| Bombardas (300) | hierro 400, madera 200, herramientas 30, armas 10, paño 15 | 4.200 | ~19k |
| Caballería ligera (500) | caballos 100, armas 25, paño 50 | 4.500 | ~30,7k |
| Caballería (300) | caballos 150, armas 50, paño 30 | 3.600 | ~41,5k |
| Caballeros (400) | caballos 240, armas 70, seda 10, paño 40 | 9.600 | ~71k |

### 4. Armerías ×5 (producción mundial ~2,6k armas/mes). Si no aguanta: 5 de hierro por arma.

### 5. Mantenimiento de edificios: 0,3% de V por nivel al mes, reparto 50/10/40 y misma plantilla; sin escalado por
población (granja 36/mes, castillo 180, catedral 270).

### 6. Mantenimiento de tropas = soldada por hombre y mes
Levas 1,5 · Piqueros 3 · Caballería ligera 4,5 · Alabarderos 6 · Bombardas 7 · Caballería 6 · Caballeros 12 (unidad:
300 / 1.200 / 2.250 / 1.800 / 2.100 / 1.800 / 4.800) × SOLDADA_K, + reposición 1% del equipo al mes. Comida: armyFood,
solo grano. Objetivo: ~6.000 combatientes = 15-30% del ingreso del reino.

### 7. Quién cobra
Jornal de obra y mantenimiento: 70% campesino / 30% burgués de la provincia (55/45 en plantilla piedra). Materiales: los
que venden en la plaza ("Suministro"). Soldada y enganche: pops de la provincia de origen (campesino en levas, piqueros,
alabarderos y ligera; burgués en bombardas; nobleza en caballería y caballeros).

### 8. Barra de edificios
c = pagado/debido del mes. Baja 0,02×(1−c)/mes (fortificaciones y únicas 0,01×(1−c)); sube +0,04/mes si c ≥ 0,98.
Efecto ×(0,5+0,5·estado) en producción, defensa y moral. Bajo 0,2 cierra (bOff/bCond existentes).

### 9. Barra de tropas
c = 0,55 soldada + 0,30 comida + 0,15 reposición. Sube +0,25/mes si c ≥ 0,98; si no, baja 0,30×(1−c)/mes. Techo de
moral 40+60·estado; fuerza ×(0,85+0,15·estado); bajo 0,3 deserta 5%/mes (a p.sold); en 0 se desbanda (4º mes sin cobrar).

### 10. Orden y tope en la plaza
La demanda de capital (obras, reclutamiento, mantenimiento, de corona y estamentos) se sirve DESPUÉS de insumos de taller
y consumo, con tope 25% de la oferta semanal por bien, repartido entre compradores; lo no servido cuenta para precio y
contratos. Excepción: grano del ejército con prioridad de hambre. La corona no se paga alcabala.

### 11. Forrajeo como requisa: solo lo no comprado; tope 40% de store.grano por provincia y mes; propio/aliado se paga a
precio de plaza al campesino; enemigo expolio; hambruna por la vía normal. Se borra el control de suministro
local/nacional (a.supply).

### 12. Flete de materiales pesados (madera, piedra, hierro) desde el centro de comercio, con reliefFlete. Segundo commit.

### Descartado
Ración mixta y +25% de campaña (grano = 78% de las calorías del soldado hacia 1300); purveyance y asiento (anacrónicos en
1444); pagar jornal con la obra parada; Koszyce como restricción a la corona (corregir design/epoca/noble.md 206, 250-251,
304).

### Aparcado
Al consejo de lealtad: mesnada noble con plazo de 3 meses; saqueo y motín por atrasos; prestación señorial; consentimiento
noble para castillos en Polonia y Hungría; obras de la Iglesia pagadas por el clero (la IA necesita un motivo nuevo);
diezmo de fábrica 1/9 y tercias 2/9 (bloque fiscal); estacionalidad de las levas; tope de obra por brazos de la provincia.

### /simular
Variantes: coste 1,0 vs 1,5 años; SOLDADA_K 1,0 vs 0,6; armerías ×5 vs ×3. Vigilar riqueza de los estamentos, precio de
madera y piedra (la demanda mundial ya duplica la oferta), y peso del ejército sobre el ingreso de la corona.
