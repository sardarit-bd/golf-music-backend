import mongoose from "mongoose";

const photographerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // BASIC INFO (Free & Pro)
  name: {
    type: String,
    required: true,
    trim: true,
  },

  city: {
    type: String,
    enum: ["new orleans", "biloxi", "mobile", "pensacola"],
    required: true,
    set: (v) => v.toLowerCase().trim(),
  },

  biography: {
    type: String,
    maxlength: 2000,
    default: "",
  },

  // PRO FEATURES
  services: [
    {
      service: {
        type: String,
        required: true,
        trim: true,
      },
      price: {
        type: String,
        required: true,
        trim: true,
      },
    },
  ],

  photos: [
    {
      url: String,
      caption: String,
      public_id: String,
    },
  ],

  videos: [
    {
      url: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        default: "Untitled Video",
      },
      public_id: {
        type: String,
        required: true,
      },
      duration: Number,
      format: String,
      bytes: Number,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  /* ==========================================
     SUBSCRIPTION-RELATED (Like Artist/Venue)
  =========================================== */
  photosLimit: {
    type: Number,
    default: 0,
  },

  videosLimit: {
    type: Number,
    default: 0,
  },

  featuresLocked: {
    type: Boolean,
    default: true,
  },
  /* ========================================== */

  isActive: {
    type: Boolean,
    default: false,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

photographerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Photographer = mongoose.model("Photographer", photographerSchema);
export default Photographer;
