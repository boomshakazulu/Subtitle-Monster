import mongoose from "mongoose";

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not configured");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}
