import mongoose from "mongoose";

const SubtitleSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    language: { type: String, required: true },
    srtText: { type: String, required: true }
  },
  { timestamps: true }
);

SubtitleSchema.index({ movie: 1, language: 1 });

export const Subtitle = mongoose.model("Subtitle", SubtitleSchema);
