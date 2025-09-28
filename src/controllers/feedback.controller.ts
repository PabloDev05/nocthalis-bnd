/* eslint-disable no-console */
import { Request, Response } from "express";
import { Feedback } from "../models/Feedback";

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { email, username, message, client } = req.body as {
      email?: string;
      username?: string;
      message?: string;
      client?: { ua?: string; tz?: string };
    };

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Email inválido" });
    }
    if (!message || message.trim().length < 3) {
      return res.status(400).json({ message: "Mensaje muy corto" });
    }

    const userId = (req.user && req.user.id) || null;

    await Feedback.create({
      email: String(email).trim().toLowerCase(),
      username: username?.trim() || null,
      message: message.trim().slice(0, 600),
      userId,
      meta: {
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null,
        ua: client?.ua || req.headers["user-agent"] || null,
        tz: client?.tz || null,
      },
    });

    return res.status(201).json({ message: "Feedback registrado, ¡gracias!" });
  } catch (err) {
    console.error("[submitFeedback] error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};
