import mongoose from "mongoose";

const WaveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    // Auto-generated from YouTube (or custom upload if provided)
    thumbnail: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

WaveSchema.index({ title: 1 });
WaveSchema.index({ title: "text", description: "text" });

export default mongoose.model("Wave", WaveSchema);