// src/models/User.ts
import mongoose, { Schema, model, type Document, type Model, Types } from "mongoose";

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  /** Hash o password plano según tu flujo actual (ambos ocultos al serializar). */
  password: string;
  passwordHash?: string;

  /** Legacy: lo mantenemos para no romper nada de tu front actual. */
  subClass: string;

  /** Ref a CharacterClass, o null si todavía no eligió.  */
  characterClass: Types.ObjectId | null;

  /** Bandera para bloquear re-elección. */
  classChosen: boolean;

  /** Usado por requireAuth como heartbeat. */
  lastSeen?: Date;

  /** Virtual id string */
  id: string;
}

export interface UserModel extends Model<UserDocument> {}

const UserSchema = new Schema<UserDocument>(
  {
    // ❌ sin index/unique aquí (lo declaramos abajo con schema.index)
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    // Mantengo ambos campos por compat; ambos se ocultan en toJSON/toObject.
    password: { type: String, required: true, select: false },
    passwordHash: { type: String, select: false },

    subClass: { type: String, default: "" },

    // ❌ sin index aquí
    characterClass: {
      type: Schema.Types.ObjectId,
      ref: "CharacterClass",
      default: null,
    },

    classChosen: { type: Boolean, default: false },

    // ❌ sin index aquí
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        // seguridad: nunca exponer credenciales
        delete (ret as any).password;
        delete (ret as any).passwordHash;
        delete (ret as any)._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete (ret as any).password;
        delete (ret as any).passwordHash;
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

// Virtual id (string)
UserSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

/* Índices — declarados SOLO acá para evitar duplicados */
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ characterClass: 1 });
UserSchema.index({ lastSeen: -1 });

export const User = (mongoose.models.User as UserModel) || model<UserDocument, UserModel>("User", UserSchema);
