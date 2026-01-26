import mongoose from "mongoose";

const WaveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: function() {
        return !this.isPageText;
      },
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    youtubeUrl: {
      type: String,
      required: function() { 
        return !this.isPageText;
      },
      trim: true,
    },

    // Auto-generated from YouTube (or custom upload if provided)
    thumbnail: {
      type: String,
      trim: true,
      default: null,
    },


    isPageText: {
      type: Boolean,
      default: false,
    },

    sectionTitle: {
      type: String,
      default: "Waves",
      trim: true,
    },

    sectionSubtitle: {
      type: String,
      default: "Explore the freshest waves and top audio experiences.",
      trim: true,
    },

    yourWavesTitle: {
      type: String,
      default: "Your Waves",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

WaveSchema.index({ title: 1 });

WaveSchema.index({ 
  youtubeUrl: 1 
}, { 
  unique: true,
  partialFilterExpression: { isPageText: false }
});

WaveSchema.index({ isPageText: 1 }, { unique: true, sparse: true });

export default mongoose.model("Wave", WaveSchema);