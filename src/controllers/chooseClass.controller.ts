// src/controllers/chooseClass.controller.ts
import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { User, type UserDocument } from "../models/User";
import { CharacterClass, type CharacterClassDocument } from "../models/CharacterClass";
import { Character } from "../models/Character";

interface AuthReq extends Request {
  user?: { id: string; username: string };
}

export const chooseClass = async (req: AuthReq, res: Response) => {
  const { selectedClass } = req.body as { selectedClass?: string }; // _id de CharacterClass
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ message: "No autenticado" });
  if (!selectedClass || !Types.ObjectId.isValid(selectedClass)) {
    return res.status(400).json({ message: "selectedClass inválido" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = (await User.findById(userId).session(session)) as UserDocument | null;
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.classChosen) {
      await session.abortTransaction();
      return res.status(400).json({ message: "La clase ya fue elegida" });
    }

    const alreadyHasChar = await Character.findOne({ userId: user._id }).session(session);
    if (alreadyHasChar) {
      await session.abortTransaction();
      return res.status(400).json({ message: "El usuario ya tiene personaje" });
    }

    const charClass = (await CharacterClass.findById(selectedClass).session(session)) as CharacterClassDocument | null;
    if (!charClass) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Clase no encontrada" });
    }

    // Crear personaje inicial
    const character = await Character.create(
      [
        {
          userId: user._id,
          classId: charClass._id, // ObjectId tipado
          level: 1,
          experience: 0,
          stats: charClass.baseStats,
          resistances: charClass.resistances,
          combatStats: charClass.combatStats,
          passivesUnlocked: [charClass.passiveDefault?.name].filter(Boolean),
          subclassId: null,
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    // Actualizar user
    user.characterClass = charClass._id; // ✅ ahora es Types.ObjectId
    user.classChosen = true;
    await user.save({ session });

    await session.commitTransaction();

    // Respuesta (podemos poblar classId para el front)
    const characterPopulated = await Character.findById(character._id).populate("classId").lean();

    return res.status(200).json({
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
    await session.abortTransaction();
    console.error("Error al elegir clase:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    session.endSession();
  }
};
