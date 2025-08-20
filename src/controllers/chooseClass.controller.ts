import { RequestHandler } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";

/**
 * POST /character/choose-class
 * body: { selectedClass: string }  // _id de CharacterClass
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

    // Crear personaje clonando valores base de la clase
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
          subclassId: null,
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    // Marcar usuario
    user.characterClass = charClass._id;
    user.classChosen = true;
    await user.save({ session });

    await session.commitTransaction();

    // Respuesta con metadatos de clase (sin stats del template si no querés)
    const characterPopulated = await Character.findById(character._id).populate({ path: "classId", select: "name iconName imageMainClassUrl passiveDefault subclasses" }).lean();

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
