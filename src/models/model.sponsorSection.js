import mongoose from "mongoose";

const sponsorSectionSchema = new mongoose.Schema(
  {
    sectionTitle: {
      type: String,
      default: "Our Sponsors",
      trim: true,
      required: [true, "Section title is required"],
    },
    
    sectionSubtitle: {
      type: String,
      default: "We're proud to partner with amazing local businesses and community supporters.",
      trim: true,
      required: [true, "Section subtitle is required"],
    },
  },
  { timestamps: true }
);

const SponsorSection = mongoose.model("SponsorSection", sponsorSectionSchema);
export default SponsorSection;