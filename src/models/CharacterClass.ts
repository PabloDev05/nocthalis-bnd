import mongoose from "mongoose";

const PassiveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  detail: { type: String },
});

const SubclassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  iconName: { type: String, required: true },
  imageSubclassUrl: { type: String, required: false }, // <== Nueva imagen opcional
  passives: [PassiveSchema],
});

const CharacterClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  iconName: { type: String, required: true },
  imageMainClassUrl: { type: String, required: true }, // <== Aquí está la imagen principal
  passiveDefault: PassiveSchema,
  subclasses: [SubclassSchema],
});

export const CharacterClass = mongoose.model("CharacterClass", CharacterClassSchema);
