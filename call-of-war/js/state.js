// state.js — estado mutable compartido del juego, en un unico objeto S.
// Se lee y se escribe como S.provs, S.hour, S.player… Cualquier modulo que
// importe S ve el mismo estado (las reasignaciones son propiedades del objeto,
// no bindings, asi que se comparten sin problema entre modulos ES).
export const S = {
  rand: null,
  provs: [], provIdx: null, pixOfProv: [], borderPxOfProv: [], adj: [], seaAdj: [],
  nations: [], armies: [], wars: new Map(), truces: new Map(), armyIdSeq: 1,
  duchies: [], reports: [],
  roads: new Set(), roadQueue: [], customRoads: false,
  player: -1, hour: 0, acc: 0, speed: 1, started: false, gameOver: false,
  selProv: -1, selArmy: null, battleFlash: {},
  // vista (compartida por render, entrada y guardado)
  zoom: 1, panX: 0, panY: 0, terrainView: false, popView: false, resView: false, showGraph: true,
  provTab: null, // pestaña abierta junto a la ficha de provincia: null | "build" | "roads" | "army"
  // editor (compartido por editor, entrada y render del overlay)
  editMode: false, shapeSel: -1, shapePoly: [], dragVi: -1, editTool: "shape",
  mergeFrom: -1, mergeCur: null, splitFrom: -1, splitCur: null,
  roadFrom: -1, roadCur: null, dragWas: null, dragIns: false, ownerPaint: -1,
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
  editUndoStack: [], editBackup: null, editDirty: false
};
