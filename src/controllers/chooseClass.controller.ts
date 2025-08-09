import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";

interface AuthReq extends Request {
  user?: { id: string; username: string };
}

export const chooseClass = async (req: AuthReq, res: Response) => {
  const { selectedClass } = req.body; // _id de CharacterClass
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ message: "No autenticado" });
  if (!selectedClass) return res.status(400).json({ message: "Falta selectedClass" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.classChosen) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "La clase ya fue elegida" });
    }

    const alreadyHasChar = await Character.findOne({ userId: user._id }).session(session);
    if (alreadyHasChar) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "El usuario ya tiene personaje" });
    }

    const charClass = await CharacterClass.findById(selectedClass).session(session);
    if (!charClass) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Clase no encontrada" });
    }

    const character = await Character.create(
      [
        {
          userId: user._id,
          classId: charClass._id,
          level: 1,
          experience: 0,
          stats: charClass.baseStats,
          resistances: charClass.resistances,
          combatStats: charClass.combatStats,
          passivesUnlocked: [charClass.passiveDefault?.name].filter(Boolean),
          subclassId: null, // aún no eligió subclase
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    user.characterClass = charClass._id;
    user.classChosen = true;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    const characterPopulated = await Character.findById(character._id).populate("classId").lean();

    return res.status(200).json({
      message: "Clase asignada con éxito.",
      user: {
        id: user._id,
        username: user.username,
        classChosen: true,
        characterClass: user.characterClass,
      },
      character: characterPopulated ?? character,
    });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();

    if (err?.code === 11000) {
      return res.status(400).json({ message: "El usuario ya posee un personaje" });
    }

    console.error("Error al elegir clase:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
