import mongoose from "mongoose";

const WavePageSettingsSchema = new mongoose.Schema(
  {
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

// Only one document allowed
WavePageSettingsSchema.index({}, { unique: true });

export default mongoose.model("WavePageSettings", WavePageSettingsSchema);