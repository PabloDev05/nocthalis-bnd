import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  classChosen: { type: Boolean, default: false },
  characterClass: { type: String, default: null },
});

export const User = mongoose.model("User", userSchema);
