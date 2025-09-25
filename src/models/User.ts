// src/models/User.ts
import mongoose, { Schema, model, type Document, type Model, Types } from "mongoose";

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  /** Hash o password plano según tu flujo actual (ambos ocultos al serializar). */
  password?: string;
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
    // Declaramos validaciones mínimas y normalización
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: /^[a-zA-Z0-9_.-]+$/, // simple y suficiente
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      minlength: 5,
      maxlength: 254,
    },

    // Mantengo ambos campos por compat; ambos se ocultan en toJSON/toObject.
    password: { type: String, select: false },
    passwordHash: { type: String, select: false },

    subClass: { type: String, default: "" },

    characterClass: {
      type: Schema.Types.ObjectId,
      ref: "CharacterClass",
      default: null,
      index: true,
    },

    classChosen: { type: Boolean, default: false },

    lastSeen: { type: Date, default: Date.now, index: true },
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

/* Índices — case-insensitive donde conviene */
UserSchema.index({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
// Si querés username case-insensitive también, deja este; si no, quítale la collation.
UserSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const User =
  (mongoose.models.User as UserModel) ||
  model<UserDocument, UserModel>("User", UserSchema);
