import mongoose from "mongoose";

const MovieSchema = new mongoose.Schema(
  {
    tmdbId: { type: Number, unique: true, index: true, required: true },
    title: { type: String, required: true },
    posterPath: { type: String },
    releaseDate: { type: String }
  },
  { timestamps: true }
);

export const Movie = mongoose.model("Movie", MovieSchema);
