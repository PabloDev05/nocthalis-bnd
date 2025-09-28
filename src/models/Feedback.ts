// src/models/Feedback.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IFeedback extends Document {
  email: string;
  username?: string | null;
  message: string;
  userId?: mongoose.Types.ObjectId | null;
  meta?: { ip?: string | null; ua?: string | null; tz?: string | null };
  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  email: { type: String, required: true, trim: true },
  username: { type: String, trim: true },
  message: { type: String, required: true, maxlength: 600 },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  meta: {
    ip: { type: String, default: null },
    ua: { type: String, default: null },
    tz: { type: String, default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

export const Feedback = mongoose.model<IFeedback>("Feedback", FeedbackSchema);
