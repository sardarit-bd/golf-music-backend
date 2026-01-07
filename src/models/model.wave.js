import mongoose from "mongoose";

const WaveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Wave title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    youtubeUrl: {
      type: String,
      required: [true, "YouTube URL is required"],
      trim: true,
    },

    // Auto-generated from YouTube (or custom upload if provided)
    thumbnail: {
      type: String,
      trim: true,
      default: null, // optional, auto-generated in controller
    },
  },
  {
    timestamps: true,
  }
);

// 🔹 Case-insensitive title search support
WaveSchema.index({ title: 1 });

// 🔹 Prevent exact duplicate YouTube videos
WaveSchema.index({ youtubeUrl: 1 }, { unique: true });

export default mongoose.model("Wave", WaveSchema);
