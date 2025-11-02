import mongoose from "mongoose";

const WaveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Wave title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    thumbnail: {
      type: String,
      required: [true, "Thumbnail URL is required"],
      trim: true,
    },
    youtubeUrl: {
      type: String,
      required: [true, "YouTube URL is required"],
      trim: true,
    },
  },
  { timestamps: true }
);


WaveSchema.index({ title: 1 }, { unique: false });

export default mongoose.model("Wave", WaveSchema);
