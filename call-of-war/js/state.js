// state.js — estado mutable compartido del juego, en un unico objeto S.
// Se lee y se escribe como S.provs, S.hour, S.player… Cualquier modulo que
// importe S ve el mismo estado (las reasignaciones son propiedades del objeto,
// no bindings, asi que se comparten sin problema entre modulos ES).
export const S = {
  rand: null,
  provs: [], provIdx: null, pixOfProv: [], borderPxOfProv: [], adj: [], seaAdj: [],
  nations: [], armies: [], wars: new Set(), truces: new Map(), armyIdSeq: 1,
  roads: new Set(), roadQueue: [], customRoads: false,
  player: -1, hour: 0, speed: 1, started: false, gameOver: false,
  selProv: -1, selArmy: null, battleFlash: {},
  // vista (compartida por render, entrada y guardado)
  zoom: 1, panX: 0, panY: 0, terrainView: false,
  // editor (compartido por editor, entrada y render del overlay)
  editMode: false, shapeSel: -1, shapePoly: [], dragVi: -1, editTool: "shape",
  mergeFrom: -1, mergeCur: null, splitFrom: -1, splitCur: null,
  roadFrom: -1, roadCur: null, dragWas: null, dragIns: false,
  buildFilter: "eco",
  editUndoStack: [], editBackup: null, editDirty: false
};
