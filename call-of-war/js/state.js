// state.js — estado mutable compartido del juego, en un unico objeto S.
// Se lee y se escribe como S.provs, S.hour, S.player… Cualquier modulo que
// importe S ve el mismo estado (las reasignaciones son propiedades del objeto,
// no bindings, asi que se comparten sin problema entre modulos ES).
export const S = {
  rand: null,
  provs: [], provIdx: null, pixOfProv: [], borderPxOfProv: [], adj: [], seaAdj: [], navAdj: [],
  nations: [], armies: [], wars: new Map(), truces: new Map(), armyIdSeq: 1,
  duchies: [], reports: [],
  rel: new Map(), relMonthKey: -1, // diplomacia: campo compartido Tensión↔Concordia por par "a|b" (−100..+100); mes del último tick de deriva
  dipCd: new Map(), dipSel: -1, // diplomacia: cooldowns de acción ("accion|a|b"→hora) y nación seleccionada en el panel
  diploView: {mode:"own", target:-1}, // vista de diplomacia: "own" (resumen + entidades) | "nation" (bilateral con target)
  leagueView: null, // liga concreta que se está viendo en la ventana de ligas (null = vista general)
  dipModal: null, // popup de acción diplomática: {kind:"rival"|"gift"|"claim", target, gold}
  embargoes: new Set(), claims: new Set(), // embargos por par "a|b" (sin efecto econ. aún) y reclamaciones "nacion|duchyId"
  pacts: new Map(), // pactos diplomáticos por par "a|b" → "nap" | "alliance"
  council: null, // consejo de deliberación activo (guerra ofensiva): {leader,target,candidates,invited:Map,phase}
  coalitions: new Map(), coalSeq: 0, // coaliciones de guerra id→{atk,def,leadA,leadD,start}; las guerras pairwise llevan .coal
  coalPeace: null, // pantalla de paz conjunta del jugador: {coalId, sel:Set(duchyIds), gold}
  leagues: [], leagueSeq: 0, // ligas defensivas: [{id,name,founder,members[],apps[]}]; org. multi-miembro (Fase 6c)
  roads: new Map(), roadQueue: [], customRoads: false, // clave "a|b" -> nivel (1..3)
  marketEdges: null, mktDirty: false, // topología del mercado provincial: plaza -> [plazas vecinas]
  // (buildMarketEdges) + p.marketOf (assignMarkets). mktDirty: las fronteras han cambiado, hay que rehacerla.
  player: -1, hour: 0, acc: 0, speed: 1, started: false, gameOver: false,
  // capa de presentación mensual de la tesorería del jugador (ver economy.js: tsyTick/tsyAvail)
  tsyAccrual: {}, tsyMonthBal: {}, monthKey: -1, tsyAlc: 0, // tsyAlc = alcábala acumulada del mes en curso
  sFlow: {}, // desglose de flujos de riqueza por estamento (mes en curso): {estamento:{categoria:importe}}
  sConsume: {}, // consumo por estamento y BIEN (mes en curso): {estamento:{bien:[cantidad,gasto]}}
  mktVol: {}, // volumen físico por bien (mes en curso): {bien:{prod,sold,discard}}
  econLog: [], econLogOn: true, // LOG económico mensual (series temporales para diagnóstico); botón lo descarga
  prospMonthKey: -1, // mes de calendario del último tick de prosperidad (para el +1/−1 mensual por bien)
  selProv: -1, selArmy: null, battleFlash: {},
  // vista (compartida por render, entrada y guardado)
  zoom: 1, panX: 0, panY: 0, terrainView: false, popView: false, resView: false, mktView: false, showGraph: true,
  provTab: null, // pestaña abierta junto a la ficha de provincia: null | "build" | "roads" | "army"
  // editor (compartido por editor, entrada y render del overlay)
  editMode: false, shapeSel: -1, shapePoly: [], dragVi: -1, editTool: "shape",
  mergeFrom: -1, mergeCur: null, splitFrom: -1, splitCur: null,
  roadFrom: -1, roadCur: null, dragWas: null, dragIns: false, ownerPaint: -1, duchyPaint:-1,
  buildFilter: "eco",
  // panel de reino / ejército (arriba-izquierda estilo EU4)
  recruitProv: -1, armyPanelOpen: false,
  // ventana de ejército: unidad en modo "reclutar desde el mapa" (null=off) y menú Editar abierto
  recruitUnit: null, armyEdit: false,
  // tesorería (libro mayor): pestaña activa y ruta de navegación por categorías
  treasuryTab: "tesoro", treasuryPath: [],
  // negociación de paz (pantalla estilo EU4): con quién, ducados en la mesa, oro exigido/ofrecido,
  // modo ("out"=propones tú / "in"=oferta de la IA) y la oferta pendiente de la IA
  peaceWith: -1, peaceSel: new Set(), peaceGold: 0, peaceGive: 0, peaceMode: "out", incomingPeace: null,
  callToArms: null, // llamada a las armas pendiente para el jugador (defensa de aliado/liga): {coalId,victim,leadA,attackers}
  editUndoStack: [], editBackup: null, editDirty: false
};
