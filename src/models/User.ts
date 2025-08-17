import mongoose, { Schema, Document, Types } from "mongoose";

export interface UserDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  subClass: string;
  characterClass: Types.ObjectId | null; // ref a CharacterClass
  classChosen: boolean;
  lastSeen?: Date;
  id: string;
}

const userSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
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
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
  }
);

userSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

export const User = (mongoose.models.User as mongoose.Model<UserDocument>) || mongoose.model<UserDocument>("User", userSchema);
