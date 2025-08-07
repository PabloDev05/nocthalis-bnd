import { Request, Response } from "express";
import { User } from "../models/User";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";

export const chooseClass = async (req: Request, res: Response) => {
  try {
    const { userId, selectedClass } = req.body;

    if (!userId || !selectedClass) {
      return res.status(400).json({ message: "Faltan datos requeridos." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user.classChosen) {
      return res.status(400).json({ message: "La clase ya fue elegida." });
    }

    const charClass = await CharacterClass.findById(selectedClass);
    if (!charClass) {
      return res.status(404).json({ message: "Clase no encontrada." });
    }

    const character = new Character({
      userId: user._id,
      classId: charClass._id,
      stats: charClass.baseStats,
      resistances: charClass.resistances,
      passivesUnlocked: [charClass.passiveDefault?.name],
    });
    await character.save();

    user.characterClass = selectedClass;
    user.classChosen = true;
    await user.save();

    return res.status(200).json({
      message: "Clase asignada con éxito.",
      user: {
        id: user._id,
        username: user.username,
        classChosen: user.classChosen,
        characterClass: user.characterClass,
      },
      character,
    });
  } catch (err) {
    console.error("Error al elegir clase:", err);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};
