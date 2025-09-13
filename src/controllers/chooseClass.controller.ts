/* eslint-disable no-console */
// src/controllers/chooseClass.controller.ts
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";

/**
 * POST /character/choose-class
 * body: { selectedClass: string }  // _id de CharacterClass
 *
 * Flujo:
 * - Usuario elige clase -> creamos Character asociado
 * - Copiamos stats/resistencias/combatStats de la clase
 * - currentHP = maxHP
 * - equipo inicial con defaultWeapon
 * - skillState inicial
 * - stamina inicial = 100/100, regen por defecto (full en 24h → staminaRegenPerHour = 0)
 */
export const chooseClass: RequestHandler = async (req, res) => {
  const { selectedClass } = (req.body as { selectedClass?: string }) || {};
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }
  if (!selectedClass || !mongoose.Types.ObjectId.isValid(selectedClass)) {
    res.status(400).json({ message: "selectedClass inválido" });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Usuario
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    if (user.classChosen) {
      await session.abortTransaction();
      res.status(400).json({ message: "La clase ya fue elegida" });
      return;
    }

    // Evitar duplicado de personaje
    const alreadyHasChar = await Character.findOne({ userId: user._id }).session(session);
    if (alreadyHasChar) {
      await session.abortTransaction();
      res.status(400).json({ message: "El usuario ya tiene personaje" });
      return;
    }

    // Clase
    const charClass = await CharacterClass.findById(selectedClass).session(session);
    if (!charClass) {
      await session.abortTransaction();
      res.status(404).json({ message: "Clase no encontrada" });
      return;
    }

    // Bloques base clonados
    const stats = { ...charClass.baseStats };
    const resistances = { ...charClass.resistances };
    const combatStats = { ...charClass.combatStats };

    // Vida inicial = tope
    const currentHP = Math.max(1, Number(combatStats.maxHP ?? 1));

    // Equipo inicial
    const equipment = {
      helmet: null,
      chest: null,
      gloves: null,
      boots: null,
      mainWeapon: charClass.defaultWeapon ?? null,
      offWeapon: null,
      ring: null,
      belt: null,
      amulet: null,
    } as const;

    // Estado de skills
    const skillState = {
      passiveBuff: null,
      ultimate: charClass.ultimateSkill?.enabled
        ? {
            name: charClass.ultimateSkill.name,
            cooldownLeft: 0,
            silencedUntilTurn: null,
          }
        : null,
    };

    // Stamina inicial (política full en 24h)
    const now = new Date();
    const STAMINA_INIT = {
      stamina: 100,
      staminaMax: 100,
      staminaRegenPerHour: 0, // 0 = usar “full en 24h” desde stamina.service
      staminaUpdatedAt: now,
      nextStaminaFullAt: null,
    };

    // Crear personaje
    const character = await Character.create(
      [
        {
          userId: user._id,
          classId: charClass._id,

          level: 1,
          experience: 0,

          stats,
          resistances,
          combatStats,

          maxHP: combatStats.maxHP,
          currentHP,

          equipment,
          inventory: [],

          skillState,

          gold: 0,
          honor: 0,

          // stamina
          ...STAMINA_INIT,

          subclassId: null,
        } as any,
      ],
      { session }
    ).then((docs) => docs[0]);

    // Marcar usuario
    user.characterClass = charClass._id as any;
    user.classChosen = true;
    await user.save({ session });

    await session.commitTransaction();

    // Respuesta con metadatos
    const characterPopulated = await Character.findById(character._id)
      .populate({
        path: "classId",
        select: "name iconName imageMainClassUrl primaryWeapons secondaryWeapons defaultWeapon allowedWeapons passiveDefaultSkill ultimateSkill subclasses",
      })
      .lean();

    res.status(200).json({
      message: "Clase asignada con éxito.",
      user: {
        id: user._id.toString(),
        username: user.username,
        classChosen: true,
        characterClass: user.characterClass?.toString() ?? null,
      },
      character: characterPopulated ?? character,
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {}
    console.error("Error al elegir clase:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    session.endSession();
  }
};
