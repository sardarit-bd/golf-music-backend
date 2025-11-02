import mongoose from "mongoose";

const castSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a podcast title"],
      trim: true,
      unique: true
    },
    youtubeUrl: {
      type: String,
      required: [true, "Please add a YouTube link"],
      unique: true,
      match: [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
        "Please provide a valid YouTube link",
      ],
    },
    thumbnail: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);


const Cast = mongoose.model("Cast", castSchema);
export default Cast;
