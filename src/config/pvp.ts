/* eslint-disable no-console */
export const FORCE_ALL_PROCS = process.env.PVP_FORCE_ALL_PROCS === "1" || String(process.env.PVP_FORCE_ALL_PROCS || "").toLowerCase() === "true";

console.log(`[PVP] FORCE_ALL_PROCS = ${FORCE_ALL_PROCS ? "ON" : "OFF"} (env: ${process.env.PVP_FORCE_ALL_PROCS ?? "undefined"})`);

// CombatManager: decide impactos/mitigación/estados y emite events.
// pvpRunner: itera turnos, traduce events a timeline/log/snapshots. (En test puede forzar procs).
// simulateCombat.controller: carga Match, llama al runner y (en resolve) persiste y aplica recompensas.
