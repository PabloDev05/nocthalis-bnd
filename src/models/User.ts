import mongoose, { Schema } from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subClass: { type: String, default: "" },
  characterClass: { type: Schema.Types.ObjectId, ref: "CharacterClass", default: null },
  classChosen: { type: Boolean, default: false },
});

export const User = mongoose.model("User", userSchema);
