import mongoose from "mongoose";

const castSchema = new mongoose.Schema(
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

    videoType: {
      type: String,
      enum: ["upload", "youtube"],
      required: true,
    },

    // Cloudinary video URL
    video: {
      type: String,
      required: function () {
        return this.videoType === "upload";
      },
    },

    // Cloudinary public_id (for delete)
    videoPublicId: {
      type: String,
      required: function () {
        return this.videoType === "upload";
      },
    },

    // YouTube URL
    youtubeUrl: {
      type: String,
      required: function () {
        return this.videoType === "youtube";
      },
      trim: true,
    },

    // Thumbnail (YouTube or custom)
    thumbnail: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique title (case-sensitive)
castSchema.index({ title: 1 }, { unique: true });

// Text index for search
castSchema.index({ title: "text", description: "text" });

export default mongoose.model("Cast", castSchema);