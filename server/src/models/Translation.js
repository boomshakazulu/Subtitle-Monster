import mongoose from "mongoose";

const TranslationSchema = new mongoose.Schema(
  {
    subtitle: { type: mongoose.Schema.Types.ObjectId, ref: "Subtitle", required: true },
    targetLang: { type: String, required: true },
    provider: { type: String, required: true },
    srtText: { type: String, required: true }
  },
  { timestamps: true }
);

TranslationSchema.index({ subtitle: 1, targetLang: 1, provider: 1 }, { unique: true });

export const Translation = mongoose.model("Translation", TranslationSchema);
