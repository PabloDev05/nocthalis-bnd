import type { Request, Response } from "express";
import { getStaminaByUserId, spendStamina, setStamina } from "../services/stamina.service";

/** GET /stamina  → snapshot actualizado (con regen perezosa) */
export async function getMyStamina(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    const snap = await getStaminaByUserId(userId);
    return res.json(snap);
  } catch (err: any) {
    console.error("[STAMINA][GET] error:", err?.message || err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /stamina/use  { amount } → intenta gastar stamina */
export async function useStamina(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const amount = Math.max(0, Math.floor(Number((req.body || {}).amount ?? 0)));
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "amount inválido" });

    const out = await spendStamina(userId, amount);
    if (!out.ok) {
      if (out.reason === "insufficient") return res.status(400).json({ ok: false, message: "Stamina insuficiente" });
      return res.status(404).json({ ok: false, message: "Personaje no encontrado" });
    }
    return res.json({ ok: true, ...out.after });
  } catch (err: any) {
    console.error("[STAMINA][USE] error:", err?.message || err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /stamina/admin/set  { value }  → util de admin/debug */
export async function adminSetStamina(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    const value = Math.floor(Number((req.body || {}).value ?? NaN));
    if (!Number.isFinite(value)) return res.status(400).json({ message: "value inválido" });

    // Aquí podrías chequear rol admin si tenés roles en req.user
    const snap = await setStamina(userId, value);
    return res.json({ ok: true, ...snap });
  } catch (err: any) {
    console.error("[STAMINA][ADMIN_SET] error:", err?.message || err);
    return res.status(500).json({ message: "Error interno" });
  }
}
