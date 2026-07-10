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
  selProv: -1, selArmy: null, battleFlash: {}
};
