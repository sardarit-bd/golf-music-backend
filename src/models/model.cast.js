import mongoose from "mongoose";

const castSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      default: "",
    },

    videoType: {
      type: String,
      enum: ["upload", "youtube"],
      required: true,
    },

    // Cloudinary video URL
    video: String,

    // Cloudinary public_id (for delete)
    videoPublicId: String,

    // YouTube
    youtubeUrl: String,

    // Thumbnail (YouTube or custom)
    thumbnail: String,
  },
  { timestamps: true }
);

export default mongoose.model("Cast", castSchema);
