import mongoose from 'mongoose';

const heroSectionSchema = new mongoose.Schema(
  {
    // Main title
    title: {
      type: String,
      required: true,
      default: "Welcome to Gulf Coast Music"
    },
    
    // Static part of subtitle (before flash text)
    subtitlePrefix: {
      type: String,
      required: true,
      default: "Experience the best with stunning"
    },
    
    // Flash text array
    flashWords: {
      type: [String],
      default: ["Artists", "Venues", "Photographers", "Studios", "Journalists"]
    },
    
    // Button text
    buttonText: {
      type: String,
      required: true,
      default: "Get Started"
    },
    
    // Video
    videoUrl: {
      type: String,
      default: null
    },
    videoPublicId: {
      type: String,
      default: null
    },
    
    // Bottom right text box
    bottomText: {
      artistName: {
        type: String,
        default: "Anna E. Westcoat"
      },
      songName: {
        type: String,
        default: "Gulf County"
      },
      separator: {
        type: String,
        default: "-"
      },
      isVisible: {
        type: Boolean,
        default: true
      }
    },
    
    // Flash animation settings
    animationSettings: {
      interval: {
        type: Number,
        default: 1500 // milliseconds
      },
      textColor: {
        type: String,
        default: "#FBBF24" // yellow-400
      },
      isEnabled: {
        type: Boolean,
        default: true
      }
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model('HeroSection', heroSectionSchema);