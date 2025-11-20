import mongoose from "mongoose";

const heroSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Welcome to Gulf Coast Music",
    },
    subtitle: {
      type: String,
      default: "Experience the best with stunning venues and powerful performances.",
    },
    buttonText: {
      type: String,
      default: "Get Started",
    },
    videoUrl: {
      type: String,
      default: null, // will store Cloudinary URL
    }
  },
  { timestamps: true }
);

const HeroSection = mongoose.model("HeroSection", heroSectionSchema);
export default HeroSection;
