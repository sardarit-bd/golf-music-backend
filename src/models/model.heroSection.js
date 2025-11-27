import mongoose from 'mongoose';

const heroSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Welcome to Our Platform"
    },
    subtitle: {
      type: String,
      required: true,
      default: "Discover amazing features and services"
    },
    buttonText: {
      type: String,
      required: true,
      default: "Get Started"
    },
    videoUrl: {
      type: String,
      default: null
    },
    videoPublicId: {
      type: String,
      default: null
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model('HeroSection', heroSectionSchema);