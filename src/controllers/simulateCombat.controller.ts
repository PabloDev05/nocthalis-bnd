import { Request, Response } from "express";
import { simulateCombat } from "../services/combat/simulateCombat";

export const simulateCombatController = (_req: Request, res: Response) => {
  console.log("=== Simulación de combate iniciada ===");

  const result = simulateCombat();

  return res.json({
    message: "Simulación completada (ver consola para detalle)",
    winner: result.winner,
    log: result.log,
  });
};
