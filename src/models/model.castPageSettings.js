import mongoose from "mongoose";

const castPageSettingsSchema = new mongoose.Schema(
  {
    sectionTitle: {
      type: String,
      default: "Casts",
      trim: true,
    },

    sectionSubtitle: {
      type: String,
      default: "Explore the latest audio casts and conversations.",
      trim: true,
    },

    yourCastsTitle: {
      type: String,
      default: "Your Casts",
      trim: true,
    },
  },
  { timestamps: true }
);

// Only one document allowed
castPageSettingsSchema.index({}, { unique: true });

export default mongoose.model("CastPageSettings", castPageSettingsSchema);