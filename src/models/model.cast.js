import mongoose from "mongoose";

const castSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: function() {
        return !this.isPageText;
      },
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
      required: function() {
        return !this.isPageText;
      },
    },

    // Cloudinary video URL
    video: {
      type: String,
      required: function() {
        return this.videoType === "upload" && !this.isPageText;
      },
    },

    // Cloudinary public_id (for delete)
    videoPublicId: {
      type: String,
      required: function() {
        return this.videoType === "upload" && !this.isPageText;
      },
    },

    // YouTube URL
    youtubeUrl: {
      type: String,
      required: function() {
        return this.videoType === "youtube" && !this.isPageText;
      },
      trim: true,
    },

    // Thumbnail (YouTube or custom)
    thumbnail: {
      type: String,
      trim: true,
    },

    // SECTION TEXT SETTINGS (For Admin to edit page text)
    isPageText: {
      type: Boolean,
      default: false,
    },

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

    // Optional: Duration in seconds
    // duration: {
    //   type: Number,
    //   default: 0,
    // },

    // Optional: Tags or categories
    // tags: [{
    //   type: String,
    //   trim: true,
    // }],
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Case-insensitive title search support
castSchema.index({ title: 1 });

// Unique title for non-pageText documents
castSchema.index({ 
  title: 1 
}, { 
  unique: true,
  partialFilterExpression: { isPageText: false }
});

// Ensure only one page text document exists
castSchema.index({ isPageText: 1 }, { unique: true, sparse: true });

// Text index for search
castSchema.index({ title: 'text', description: 'text' });

// Virtual for formatted duration
castSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return '0:00';
  
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

export default mongoose.model("Cast", castSchema);